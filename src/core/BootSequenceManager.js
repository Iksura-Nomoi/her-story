import { AudioController } from './AudioController.js';

export const DEFAULT_BOOT_LINES = [
    { text: 'HER STORY', highlight: true },
    { text: 'Investigation Operating Environment' },
    { text: 'Build 1.0' },
    { text: '' },
    { text: 'Initializing kernel...' },
    { text: 'Mounting encrypted volumes...' },
    { text: 'Loading forensic modules...' },
    { text: 'Synchronizing investigation database...' },
    { text: 'Authorizing operator...' },
    { text: 'READY.', highlight: true },
];

// Pre-landing hardware self-test lines
export const PRE_LANDING_BOOT_LINES = [
    { text: 'HER STORY TERMINAL SYSTEMS', highlight: true },
    { text: 'Hardware Self-Test' },
    { text: '' },
    { text: 'Powering on...' },
    { text: 'Checking memory integrity...' },
    { text: 'Verifying secure boot signature...' },
    { text: 'Loading environment shell...' },
    { text: 'STANDBY.', highlight: true },
];

// Case transition boot lines
export const CASE_TRANSITION_BOOT_LINES = [
    { text: 'HER STORY', highlight: true },
    { text: 'Case File Closed' },
    { text: '' },
    { text: 'Archiving investigation record...' },
    { text: 'Clearing active workspace...' },
    { text: 'Loading next assignment...' },
    { text: 'Synchronizing case data...' },
    { text: 'READY.', highlight: true },
];

// Build case transition boot lines with case titles
export function buildCaseTransitionBootLines({ outgoingTitle, incomingTitle } = {}) {
    return [
        { text: 'HER STORY', highlight: true },
        { text: outgoingTitle ? `Case File Closed: ${outgoingTitle}` : 'Case File Closed' },
        { text: '' },
        { text: 'Archiving investigation record...' },
        { text: 'Clearing active workspace...' },
        { text: incomingTitle ? `Loading assignment: ${incomingTitle}...` : 'Loading next assignment...' },
        { text: 'Synchronizing case data...' },
        { text: 'READY.', highlight: true },
    ];
}

const GLITCH_CLASS = 'boot-glitch-pulse';

export class BootSequenceManager {
        constructor(container, options = {}) {
        this.container = container;
        this.opts = {
            lineDelay: 140,
            charDelay: 16,
            sound: true,
            glitchTarget: options.glitchTarget || container.closest('.fullscreen-layer') || container,
            ...options,
        };
        this._timeouts = [];
        this._glitchInterval = null;
        this._skipped = false;
        this._playing = false;
    }

        play(lines = DEFAULT_BOOT_LINES, onComplete) {
        this._clearTimers();
        this._skipped = false;
        this._playing = true;
        this._onComplete = onComplete;
        this.container.innerHTML = '';

        if (this.opts.sound) AudioController.bootHum();
        this._startGlitch();
        this._runLine(lines, 0);
    }

    /** Jump straight to completion — safe to call even if not playing. */
    skip() {
        if (!this._playing) return;
        this._skipped = true;
        this._clearTimers();
        this._finish();
    }

    _runLine(lines, i) {
        if (this._skipped) return;
        if (i >= lines.length) {
            this._finish();
            return;
        }

        const line = lines[i];
        const lineEl = document.createElement('p');
        lineEl.className = 'boot-line' + (line.highlight ? ' highlight' : '');
        this.container.appendChild(lineEl);

        if (!line.text) {
            const t = setTimeout(() => this._runLine(lines, i + 1), this.opts.lineDelay);
            this._timeouts.push(t);
            return;
        }

        this._typeText(lineEl, line.text, () => {
            if (line.highlight && this.opts.sound) AudioController.bootReady();
            const t = setTimeout(() => this._runLine(lines, i + 1), this.opts.lineDelay);
            this._timeouts.push(t);
        });
    }

    _typeText(el, text, done) {
        let idx = 0;
        const cursor = document.createElement('span');
        cursor.className = 'boot-caret';
        el.appendChild(document.createTextNode(''));
        el.appendChild(cursor);

        const tick = () => {
            if (this._skipped) return;
            idx += 1;
            el.firstChild.textContent = text.slice(0, idx);
            if (idx % 4 === 0 && this.opts.sound) AudioController.bootKey();
            if (idx < text.length) {
                const jitter = Math.random() * 14;
                const t = setTimeout(tick, this.opts.charDelay + jitter);
                this._timeouts.push(t);
            } else {
                cursor.remove();
                done();
            }
        };
        tick();
    }

        _startGlitch() {
        const target = this.opts.glitchTarget;
        const pulse = () => {
            if (this._skipped || !this._playing) return;
            target.classList.add(GLITCH_CLASS);
            setTimeout(() => target.classList.remove(GLITCH_CLASS), 90 + Math.random() * 120);
        };
        this._glitchInterval = setInterval(pulse, 900 + Math.random() * 1400);
    }

    _stopGlitch() {
        clearInterval(this._glitchInterval);
        this._glitchInterval = null;
        this.opts.glitchTarget.classList.remove(GLITCH_CLASS);
    }

    _clearTimers() {
        this._timeouts.forEach(clearTimeout);
        this._timeouts = [];
        if (this._glitchInterval) this._stopGlitch();
    }

    _finish() {
        this._playing = false;
        this._stopGlitch();
        if (this._onComplete) {
            const cb = this._onComplete;
            this._onComplete = null;
            cb();
        }
    }
}

export default BootSequenceManager;
