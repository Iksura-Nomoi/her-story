import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
// NOTE: xterm.css loads via <link> in index.html (not a JS import) so this
// module also runs on plain static servers without a bundler.

const WEBVM_TEMPLATE_PATH = 'src/apps/Terminal/TerminalApp.html';

// Pinned immutable CheerpX build (API-stable, never changes upstream).
const CHEERPX_ESM_URL = 'https://cxrtnc.leaningtech.com/1.2.8/cx.esm.js';
// WebVM's prebuilt Debian image, streamed read-only over WebSocket; local
// writes persist in IndexedDB via the overlay below.
const DEBIAN_IMAGE_URL = 'wss://disks.webvm.io/debian_large_20230522_5044875331.ext2';

const SHELL_ENV = [
    'HOME=/home/user',
    'USER=user',
    'SHELL=/bin/bash',
    'EDITOR=vim',
    'LANG=en_US.UTF-8',
    'LC_ALL=C',
];

// The VM boots once per page load and is shared if the window is closed and
// reopened — booting Debian twice would double the memory cost.
let cxPromise = null;

function bootVm(onPhase) {
    if (!cxPromise) {
        cxPromise = (async () => {
            onPhase('STARTING TERMINAL', 'Preparing the Linux runtime.');
            const CheerpX = await import(/* @vite-ignore */ CHEERPX_ESM_URL);

            onPhase('CONNECTING DISK IMAGE', 'Streaming Debian blocks (cached locally after first boot).');
            const cloudDevice = await CheerpX.CloudDevice.create(DEBIAN_IMAGE_URL);
            const idbDevice = await CheerpX.IDBDevice.create('her-story-terminal');
            const overlayDevice = await CheerpX.OverlayDevice.create(cloudDevice, idbDevice);
            const webDevice = await CheerpX.WebDevice.create('');
            const dataDevice = await CheerpX.DataDevice.create();

            onPhase('BOOTING DEBIAN', 'Starting the Linux userspace.');
            const cx = await CheerpX.Linux.create({
                mounts: [
                    { type: 'ext2', path: '/', dev: overlayDevice },
                    { type: 'dir', path: '/app', dev: webDevice },
                    { type: 'dir', path: '/data', dev: dataDevice },
                    { type: 'devs', path: '/dev' },
                ],
            });
            return cx;
        })().catch((err) => {
            // Allow a later RETRY to boot from scratch.
            cxPromise = null;
            throw err;
        });
    }
    return cxPromise;
}

/**
 * Terminal — a real Debian GNU/Linux virtual machine running entirely in
 * the browser. No site is embedded: the engine and the Debian disk blocks
 * stream in as data; everything executes client-side, server-less.
 *
 * NOTE: the legacy KestrelOS puzzle commands (decrypt / trace / netstat /
 * archive / mapresolve) are intentionally gone — this is a real Linux box,
 * not the case-file shell. Terminal-driven case puzzles no longer resolve
 * from here.
 */
export class TerminalApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.term = null;
        this.fit = null;
        this._resizeObserver = null;
        this._shellAlive = false;
        this._bootFailed = false;
    }

    render() {
        if (this.element) return this.element;
        super.render();

        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex');
            const template = TemplateLoader.getSync(WEBVM_TEMPLATE_PATH);
            contentArea.innerHTML = template.replaceAll('{{id}}', this.id);
            this._bindAppEvents();
            this._boot();
        }
        return this.element;
    }

    _els() {
        const q = (name) => this.element?.querySelector(`#${name}-${this.id}`) || null;
        return {
            viewport: q('webvm-viewport'),
            xtermHost: q('webvm-xterm'),
            boot: q('webvm-boot'),
            bootTitle: q('webvm-boot-title'),
            bootSub: q('webvm-boot-sub'),
            retry: q('webvm-retry'),
            status: q('webvm-status'),
            dot: q('webvm-dot'),
        };
    }

    _setPhase(title, sub) {
        const { bootTitle, bootSub } = this._els();
        if (bootTitle) bootTitle.textContent = title;
        if (sub !== undefined && bootSub) bootSub.innerHTML = sub;
    }

    _setStatus(mode) {
        const { status, dot } = this._els();
        const label = mode === 'live' ? 'LIVE' : mode === 'exited' ? 'EXITED' : mode === 'error' ? 'ERROR' : 'BOOTING';
        if (status) {
            status.textContent = label;
            status.classList.toggle('is-live', mode === 'live');
            status.classList.toggle('is-booting', mode !== 'live');
        }
        if (dot) {
            dot.classList.toggle('is-live', mode === 'live');
            dot.classList.toggle('is-booting', mode !== 'live');
        }
    }

    _fail(message, hint) {
        this._bootFailed = true;
        this._setStatus('error');
        this._setPhase('BOOT FAILED', `${message}${hint ? `<br><br>${hint}` : ''}`);
        const { retry, boot } = this._els();
        const spinner = this.element?.querySelector(`#webvm-boot-${this.id} .webvm-spinner`);
        if (spinner) spinner.style.display = 'none';
        if (retry) retry.classList.remove('hidden');
        if (boot) boot.classList.remove('hidden');
    }

    async _boot() {
        if (!window.crossOriginIsolated) {
            this._fail(
                'Cross-origin isolation is missing.',
                'This page must be served with COOP: same-origin + COEP: require-corp headers.'
            );
            return;
        }
        try {
            const cx = await bootVm((title, sub) => this._setPhase(title, sub));
            if (!this.element) return; // window closed mid-boot
            this._createTerminal();
            await this._startShell(cx);
        } catch (err) {
            console.error('[Terminal] VM boot failed:', err);
            if (!this.element) return;
            this._fail(
                'Could not start the virtual machine.',
                err?.message ? String(err.message).slice(0, 220) : 'Check your connection and press RETRY.'
            );
        }
    }

    _createTerminal() {
        const { xtermHost, viewport } = this._els();
        if (!xtermHost || this.term) return;

        this.term = new Terminal({
            cursorBlink: true,
            convertEol: true,
            scrollback: 2000,
            fontSize: 13,
            fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
            theme: {
                background: '#000000',
                foreground: '#d8dad8',
                cursor: '#5cb85c',
                selectionBackground: 'rgba(92, 184, 92, 0.3)',
            },
        });
        this.fit = new FitAddon();
        this.term.loadAddon(this.fit);
        this.term.open(xtermHost);
        this.fit.fit();
        this.term.focus();

        xtermHost.addEventListener('click', () => this.term?.focus());
        if (viewport && window.ResizeObserver) {
            this._resizeObserver = new ResizeObserver(() => {
                try { this.fit?.fit(); } catch {}
            });
            this._resizeObserver.observe(viewport);
        }
    }

    async _startShell(cx) {
        if (!this.term || this._shellAlive) return;
        const term = this.term;
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8');

        // Wire the VM's stdio to xterm (same pattern WebVM itself uses).
        const send = cx.setCustomConsole((buf) => {
            try { term.write(decoder.decode(buf)); } catch {}
        });
        term.onData((data) => {
            try {
                const bytes = encoder.encode(data);
                for (let i = 0; i < bytes.length; i++) send(bytes[i]);
            } catch {}
        });

        this._shellAlive = true;
        this._setStatus('live');
        this._els().boot?.classList.add('hidden');
        if (AudioController.bookmark) AudioController.bookmark();

        try {
            await cx.run('/bin/bash', ['--login'], {
                env: SHELL_ENV,
                cwd: '/home/user',
                uid: 1000,
                gid: 1000,
            });
        } finally {
            this._shellAlive = false;
            if (this.element) {
                this._setStatus('exited');
                try { term.write('\r\n[shell exited — press NEW SHELL to start another]\r\n'); } catch {}
            }
        }
    }

    _bindAppEvents() {
        const shellBtn = this.element.querySelector(`#webvm-shell-${this.id}`);
        if (shellBtn) {
            shellBtn.addEventListener('click', async () => {
                AudioController.click();
                if (!this.term || this._shellAlive) return;
                try {
                    const cx = await bootVm(() => {});
                    if (!this.element) return;
                    this.term.clear();
                    await this._startShell(cx);
                } catch (err) {
                    console.error('[Terminal] new shell failed:', err);
                }
            });
        }

        const clearBtn = this.element.querySelector(`#webvm-clear-${this.id}`);
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                AudioController.click();
                try { this.term?.clear(); this.term?.focus(); } catch {}
            });
        }

        const retryBtn = this.element.querySelector(`#webvm-retry-${this.id}`);
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                AudioController.click();
                const spinner = this.element?.querySelector(`#webvm-boot-${this.id} .webvm-spinner`);
                if (spinner) spinner.style.display = '';
                retryBtn.classList.add('hidden');
                this._bootFailed = false;
                this._setStatus('booting');
                this._boot();
            });
        }
    }

    _onResize() {
        try { this.fit?.fit(); } catch {}
    }

    _onClose() {
        // Tear down the visible terminal. The VM itself stays booted (module
        // singleton) so reopening is instant; the shell keeps running headless
        // and the next window re-attaches a fresh xterm to a new shell.
        try { this._resizeObserver?.disconnect(); } catch {}
        this._resizeObserver = null;
        try { this.fit?.dispose(); } catch {}
        this.fit = null;
        try { this.term?.dispose(); } catch {}
        this.term = null;
        this._shellAlive = false;
    }
}
