import { eventBus } from './EventBus.js';
import { stateManager } from './StateManager.js';
import { SaveManager } from './SaveManager.js';
import { AudioController } from './AudioController.js';
import { NotificationManager } from './NotificationManager.js';
import { FirebaseSync } from './FirebaseSync.js';
import { WALLPAPERS } from './DesktopManager.js';
import { TemplateLoader } from '../services/TemplateLoader.js';
import { DevToolsAuth } from './DevToolsAuth.js';

const DEVTOOLS_PANEL_TEMPLATE_PATH = 'src/core/DevTools.html';

const ALL_CASE_IDS = ['case001', 'case002', 'case003', 'case004', 'case005', 'case006', 'case007', 'case008', 'case009', 'case010'];

const ALL_APP_IDS = [
    'case-files', 'messages', 'suspects', 'locker', 'media', 'cctv',
    'timeline', 'map', 'forensics', 'terminal', 'network', 'notes',
    'archive', 'settings', 'submit'
];

const CORNER_BUTTON_APP_IDS = {
    'help': 'btn-help-system',
    'case-archive': 'btn-case-archive',
};

const AUDIO_TESTS = [
    ['Hover', 'hover'], ['Click', 'click'], ['Window Open', 'windowOpen'],
    ['Window Close', 'windowClose'], ['Notification', 'notify'],
    ['Success', 'success'], ['Error', 'error'], ['Case Complete', 'caseComplete'],
];

const LOG_KINDS = ['log', 'warn', 'error'];

export class DevTools {
    constructor(osController) {
        this.os = osController;
        this.enabled = this._checkEnabled();
        this.panelEl = null;
        this._refreshTimer = null;
        this._fpsFrames = 0;
        this._fpsLastTime = performance.now();
        this._fps = 0;
        this._logs = [];
        this._logCap = 200;
        if (this.enabled) this._patchConsole();

        if (this.enabled) {
            eventBus.on('CASE_LOADED', () => this._updateCurrentCaseLabel());
            eventBus.on('FIREBASE_STATUS_CHANGED', () => this._updateFirebaseIndicator());
        }
    }

    _checkEnabled() {
        const params = new URLSearchParams(window.location.search);
        return params.get('dev') === '1' || window.location.port === '4173';
    }

        _patchConsole() {
        LOG_KINDS.forEach(kind => {
            const original = console[kind].bind(console);
            console[kind] = (...args) => {
                this._logs.push({ kind, time: Date.now(), text: args.map(a => {
                    try { return typeof a === 'string' ? a : JSON.stringify(a); }
                    catch { return String(a); }
                }).join(' ') });
                if (this._logs.length > this._logCap) this._logs.shift();
                original(...args);
            };
        });
    }

    init() {

        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                this.toggle();
            }
        });

    }

    async toggle() {
        if (this.panelEl) {
            this._teardownPanel();
            return;
        }
        const ok = await DevToolsAuth.promptAndVerify();
        if (!ok) return;
        this._buildPanel();
    }

    _buildPanel() {
        if (this.panelEl) return;

        const panel = document.createElement('div');
        panel.id = 'dev-tools-panel';
        const sections = [
            this._sectionCaseNav(),
            this._sectionFirebaseDetail(),
            this._sectionSaveTools(),
            this._sectionPlayerTools(),
            this._sectionStoryTools(),
            this._sectionAppTesting(),
            this._sectionNotificationTesting(),
            this._sectionAudioTesting(),
            this._sectionWallpaperTesting(),
            this._sectionPerformance(),
            this._sectionEventBus(),
            this._sectionLogPanel()
        ].join('\n                ');
        const template = TemplateLoader.getSync(DEVTOOLS_PANEL_TEMPLATE_PATH);
        panel.innerHTML = template.replace('{{sections}}', sections);
        document.body.appendChild(panel);
        this.panelEl = panel;

        this._bindCaseNav();
        this._bindFirebaseDetail();
        this._bindSaveTools();
        this._bindPlayerTools();
        this._bindStoryTools();
        this._bindAppTesting();
        this._bindNotificationTesting();
        this._bindAudioTesting();
        this._bindWallpaperTesting();
        this._bindEventBus();
        this._bindLogPanel();

        panel.querySelector('#dev-tools-close').addEventListener('click', () => this._teardownPanel());

        this._escHandler = (e) => {
            if (e.key === 'Escape') this._teardownPanel();
        };
        document.addEventListener('keydown', this._escHandler);

        this._updateCurrentCaseLabel();
        this._updateFirebaseIndicator();
        this._startLiveRefresh();

        ['dev-tools-perf', 'dev-tools-eventlog', 'dev-tools-consolelog'].forEach(id => {
            const details = this.panelEl.querySelector(`#${id}`)?.closest('details');
            details?.addEventListener('toggle', () => {
                this._updatePerformance();
                this._updateEventBusPanel();
                this._updateLogPanel();
            });
        });
    }

    _teardownPanel() {
        if (!this.panelEl) return;
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        this.panelEl.remove();
        this.panelEl = null;
    }

    _startLiveRefresh() {

        this._refreshTimer = setInterval(() => {
            this._updatePerformance();
            this._updateEventBusPanel();
            this._updateLogPanel();
        }, 500);

        const sampleFrame = () => {
            this._fpsFrames++;
            const now = performance.now();
            if (now - this._fpsLastTime >= 1000) {
                this._fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsLastTime));
                this._fpsFrames = 0;
                this._fpsLastTime = now;
            }
            if (this.panelEl) requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
    }

    _sectionCaseNav() {
        return `
            <details class="dev-tools-section" open>
                <summary class="dev-tools-label">Jump to case</summary>
                <div class="dev-tools-case-grid" id="dev-tools-case-grid"></div>
                <button class="dev-tools-btn" id="dev-tools-jump-ending" style="margin-top:6px;">Jump to Ending Sequence</button>
            </details>
        `;
    }

    _bindCaseNav() {
        const grid = this.panelEl.querySelector('#dev-tools-case-grid');
        ALL_CASE_IDS.forEach(caseId => {
            const btn = document.createElement('button');
            btn.className = 'dev-tools-btn dev-tools-case-btn';
            btn.textContent = caseId.replace('case0', '#').replace('case', '#');
            btn.title = caseId;
            btn.addEventListener('click', () => this.os.switchToCase(caseId, { resetProgress: true }));
            grid.appendChild(btn);
        });

        this.panelEl.querySelector('#dev-tools-jump-ending').addEventListener('click', async () => {

            let epilogueText = "Investigation complete. All evidence has been submitted.";
            try {
                const case010 = await this._fetchCaseJson('case010');
                epilogueText = case010?.solution?.successMessage || epilogueText;
            } catch (err) {
                console.error('DevTools: could not preload case010 for ending simulation:', err);
            }
            eventBus.emit('CASE_SOLVED', { caseId: 'case010' });
            eventBus.emit('CAMPAIGN_COMPLETE', { epilogueText });
        });
    }

    _updateCurrentCaseLabel() {
        if (!this.panelEl) return;
        const label = this.panelEl.querySelector('#dev-tools-current-case');
        if (label) label.textContent = stateManager.get('currentCase');
    }

    _sectionFirebaseDetail() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Firebase Detail</summary>
                <div id="dev-tools-fb-detail" class="dev-tools-kv"></div>
            </details>
        `;
    }

    _bindFirebaseDetail() {
        this._updateFirebaseDetail();
    }

    _updateFirebaseIndicator() {
        if (!this.panelEl) return;
        const btn = this.panelEl.querySelector('#dev-tools-fb-indicator');
        if (!btn) return;
        const status = FirebaseSync.getStatus();
        let dot = '🔴', label = 'Firebase Offline';
        if (status.initState === 'connecting') { dot = '🟡'; label = 'Connecting…'; }
        else if (status.dbConnected) { dot = '🟢'; label = 'Firebase Online'; }
        btn.textContent = `${dot} ${label}`;
        this._updateFirebaseDetail();
    }

    _updateFirebaseDetail() {
        if (!this.panelEl) return;
        const el = this.panelEl.querySelector('#dev-tools-fb-detail');
        if (!el) return;
        const s = FirebaseSync.getStatus();
        const rows = [
            ['Init state', s.initState],
            ['Authenticated', s.authenticated ? 'yes' : 'no'],
            ['DB connected', s.dbConnected ? 'yes' : 'no'],
            ['Network', navigator.onLine ? 'online' : 'offline'],
            ['Latency', s.latencyMs != null ? `${s.latencyMs}ms` : '—'],
            ['Operator', s.operator || '—'],
            ['Errors', String(s.errors.length)],
        ];
        el.innerHTML = rows.map(([k, v]) => `<div class="dev-tools-kv-row"><span>${k}</span><span>${v}</span></div>`).join('');
    }

    // ------------------------------------------------------------------
    // Save Tools
    // ------------------------------------------------------------------

    _sectionSaveTools() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Save Tools</summary>
                <button class="dev-tools-btn dev-tools-btn-danger" id="dev-tools-reset-save">Reset Save</button>
                <button class="dev-tools-btn" id="dev-tools-export-save">Export Save</button>
                <button class="dev-tools-btn" id="dev-tools-import-save">Import Save</button>
                <button class="dev-tools-btn" id="dev-tools-view-save">View Save JSON</button>
                <button class="dev-tools-btn dev-tools-btn-danger" id="dev-tools-clear-cache">Clear Local Storage</button>
                <textarea id="dev-tools-save-output" class="dev-tools-textarea hidden" readonly></textarea>
                <input type="file" id="dev-tools-import-input" accept="application/json" class="hidden">
            </details>
        `;
    }

    _bindSaveTools() {
        const panel = this.panelEl;
        panel.querySelector('#dev-tools-reset-save').addEventListener('click', () => {
            if (!confirm('Reset the current save? This cannot be undone.')) return;
            SaveManager.wipeSave();
            window.location.reload();
        });
        panel.querySelector('#dev-tools-export-save').addEventListener('click', () => {
            const data = JSON.stringify(stateManager.getAll(), null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `her-story-save-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        });
        panel.querySelector('#dev-tools-view-save').addEventListener('click', () => {
            const out = panel.querySelector('#dev-tools-save-output');
            out.value = JSON.stringify(stateManager.getAll(), null, 2);
            out.classList.toggle('hidden');
        });
        panel.querySelector('#dev-tools-import-save').addEventListener('click', () => {
            panel.querySelector('#dev-tools-import-input').click();
        });
        panel.querySelector('#dev-tools-import-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                localStorage.setItem('offset_save_data', JSON.stringify(parsed));
                window.location.reload();
            } catch (err) {
                alert('Invalid save file: ' + err.message);
            }
            e.target.value = '';
        });
        panel.querySelector('#dev-tools-clear-cache').addEventListener('click', () => {
            if (!confirm('Clear ALL local storage for this site and reload? This is broader than Reset Save.')) return;
            localStorage.clear();
            window.location.reload();
        });
    }

    _sectionPlayerTools() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Player Tools — Operator</summary>
                <div class="dev-tools-kv-row"><span>Name</span><span id="dev-tools-operator-name"></span></div>
                <button class="dev-tools-btn" id="dev-tools-change-name">Change Name</button>
                <button class="dev-tools-btn dev-tools-btn-danger" id="dev-tools-reset-registration">Reset Registration</button>
            </details>
        `;
    }

    _bindPlayerTools() {
        const panel = this.panelEl;
        const nameEl = panel.querySelector('#dev-tools-operator-name');
        nameEl.textContent = stateManager.get('operator_name') || '(unregistered)';

        panel.querySelector('#dev-tools-change-name').addEventListener('click', () => {
            const current = stateManager.get('operator_name') || '';
            const next = prompt('Operator name:', current);
            if (next === null) return;
            stateManager.set('operator_name', next.trim());
            nameEl.textContent = next.trim() || '(unregistered)';
        });
        panel.querySelector('#dev-tools-reset-registration').addEventListener('click', () => {
            if (!confirm('Clear operator_name? The next boot will show the registration screen again.')) return;
            stateManager.set('operator_name', '');
            nameEl.textContent = '(unregistered)';
        });
    }

    // ------------------------------------------------------------------
    // Story Tools
    // ------------------------------------------------------------------

    _sectionStoryTools() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Story Tools</summary>
                <button class="dev-tools-btn" id="dev-tools-unlock-apps">Unlock all apps</button>
                <button class="dev-tools-btn" id="dev-tools-lock-apps">Lock all apps</button>
                <button class="dev-tools-btn" id="dev-tools-reveal-evidence">Reveal all evidence</button>
                <button class="dev-tools-btn" id="dev-tools-hide-evidence">Hide all evidence</button>
                <button class="dev-tools-btn" id="dev-tools-complete-case">Complete current case</button>
                <button class="dev-tools-btn dev-tools-btn-danger" id="dev-tools-fail-case">Fail current case</button>
                <button class="dev-tools-btn" id="dev-tools-reset-current-case">Reset current case</button>
                <button class="dev-tools-btn" id="dev-tools-unlock-all-cases">Unlock all cases</button>
                <button class="dev-tools-btn dev-tools-btn-danger" id="dev-tools-reset-campaign">Reset entire campaign</button>
            </details>
        `;
    }

    /** Live-refreshes any open Case Files/Help windows — same pattern main.js's FLAG_UNLOCKED handler uses. */
    _refreshOpenContentWindows() {
        const caseFilesApp = this.os.windowManager.activeApps.get('case-files');
        if (caseFilesApp?.isOpen) caseFilesApp.refresh();
        const helpApp = this.os.windowManager.activeApps.get('help');
        if (helpApp?.isOpen) helpApp.refresh({ resetTutorial: false });
    }

    _bindStoryTools() {
        const panel = this.panelEl;

        panel.querySelector('#dev-tools-unlock-apps').addEventListener('click', () => {
            ALL_APP_IDS.forEach(id => stateManager.unlockApp(id));
            eventBus.emit('FLAG_UNLOCKED', 'NEW_EVIDENCE');
            this._refreshOpenContentWindows();
        });
        panel.querySelector('#dev-tools-lock-apps').addEventListener('click', () => {
            if (!confirm('Lock all apps? Open windows for now-locked apps stay open until closed.')) return;
            stateManager.set('unlocked_apps', []);
        });
        panel.querySelector('#dev-tools-reveal-evidence').addEventListener('click', () => {

            const caseData = stateManager.get('caseData') || {};
            const flags = new Set();
            (caseData.evidence || []).forEach(e => e.requiredFlag && flags.add(e.requiredFlag));
            (caseData.media || []).forEach(m => m.reveal?.resultingFlag && flags.add(m.reveal.resultingFlag));
            Object.values(caseData.forensics?.recover || {}).forEach(r => r.resultingFlag && flags.add(r.resultingFlag));
            (caseData.puzzles || []).forEach(p => p.resultingFlag && flags.add(p.resultingFlag));
            flags.forEach(f => stateManager.unlockFlag(f));
            eventBus.emit('FLAG_UNLOCKED', 'NEW_EVIDENCE');
            this._refreshOpenContentWindows();
        });
        panel.querySelector('#dev-tools-hide-evidence').addEventListener('click', () => {
            if (!confirm('Clear all unlocked flags for this case? This hides all gated evidence again.')) return;
            stateManager.set('unlockedFlags', []);
            this._refreshOpenContentWindows();
        });
        panel.querySelector('#dev-tools-complete-case').addEventListener('click', () => {
            const current = stateManager.get('currentCase');
            eventBus.emit('CASE_SOLVED', { caseId: current });
        });
        panel.querySelector('#dev-tools-fail-case').addEventListener('click', () => {
            NotificationManager.push({ title: 'Case Failed (simulated)', body: 'Dev Tools QA trigger.', kind: 'error' });
            eventBus.emit('CASE_FAILED', { caseId: stateManager.get('currentCase') });
        });
        panel.querySelector('#dev-tools-reset-current-case').addEventListener('click', () => {
            const current = stateManager.get('currentCase');
            this.os.switchToCase(current, { resetProgress: true });
        });
        panel.querySelector('#dev-tools-unlock-all-cases').addEventListener('click', async () => {

            const completed = [];
            for (const id of ALL_CASE_IDS) {
                try {
                    const caseData = await this._fetchCaseJson(id);
                    if (!caseData) continue;
                    const evidenceManifest = (caseData.evidence || []).map(e => ({ id: e.id, title: e.title, summary: e.summary || e.title }));
                    completed.push({ id, title: caseData.title || id, evidenceManifest });
                } catch (err) {
                    console.error(`DevTools: could not preload ${id} for Unlock All Cases:`, err);
                }
            }
            stateManager.set('completed_cases', completed);
            if (this.os.refreshCaseArchiveVisibility) this.os.refreshCaseArchiveVisibility();
        });
        panel.querySelector('#dev-tools-reset-campaign').addEventListener('click', () => {
            if (!confirm('Reset the ENTIRE campaign? This wipes all progression back to Case 001.')) return;
            stateManager.set('collected_evidence', []);
            stateManager.set('notification_history', []);
            stateManager.set('seen_desktop_icons', []);
            stateManager.set('seen_evidence', []);
            stateManager.set('help_hint_level', {});
            stateManager.set('completed_cases', []);
            if (this.os.refreshCaseArchiveVisibility) this.os.refreshCaseArchiveVisibility();
            this.os.switchToCase('case001', { resetProgress: true });
        });
    }

    _sectionAppTesting() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">App Testing</summary>
                <div class="dev-tools-case-grid" id="dev-tools-app-grid"></div>
                <button class="dev-tools-btn" id="dev-tools-open-all-apps" style="margin-top:6px;">Open every app</button>
                <button class="dev-tools-btn dev-tools-btn-danger" id="dev-tools-close-all-apps">Close every app</button>
            </details>
        `;
    }

    _bindAppTesting() {
        const grid = this.panelEl.querySelector('#dev-tools-app-grid');
        ALL_APP_IDS.forEach(appId => {
            const btn = document.createElement('button');
            btn.className = 'dev-tools-btn dev-tools-case-btn';
            btn.textContent = appId.slice(0, 4);
            btn.title = `Open ${appId}`;
            btn.addEventListener('click', () => this.os.launchApp(appId));
            grid.appendChild(btn);
        });
        Object.entries(CORNER_BUTTON_APP_IDS).forEach(([appId, btnId]) => {
            const btn = document.createElement('button');
            btn.className = 'dev-tools-btn dev-tools-case-btn';
            btn.textContent = appId.slice(0, 4);
            btn.title = `Open ${appId}`;
            btn.addEventListener('click', () => document.getElementById(btnId)?.click());
            grid.appendChild(btn);
        });

        this.panelEl.querySelector('#dev-tools-open-all-apps').addEventListener('click', () => {

            ALL_APP_IDS.forEach(id => stateManager.unlockApp(id));
            ALL_APP_IDS.forEach(id => this.os.launchApp(id));
            Object.values(CORNER_BUTTON_APP_IDS).forEach(btnId => document.getElementById(btnId)?.click());
        });
        this.panelEl.querySelector('#dev-tools-close-all-apps').addEventListener('click', () => {

            Array.from(this.os.windowManager.activeApps.values()).forEach(app => app.close());
        });
    }

    _sectionNotificationTesting() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Notification Testing</summary>
                <div class="dev-tools-case-grid" id="dev-tools-notif-grid"></div>
            </details>
        `;
    }

    _bindNotificationTesting() {
        const grid = this.panelEl.querySelector('#dev-tools-notif-grid');
        [['Success', 'success'], ['Warning', 'warning'], ['Error', 'error'], ['Info', 'info']].forEach(([label, kind]) => {
            const btn = document.createElement('button');
            btn.className = 'dev-tools-btn dev-tools-case-btn';
            btn.textContent = label;
            btn.addEventListener('click', () => {
                NotificationManager.push({ title: `${label} Notification`, body: 'Dev Tools test trigger.', kind });
            });
            grid.appendChild(btn);
        });
    }

    _sectionAudioTesting() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Audio Testing</summary>
                <div class="dev-tools-case-grid" id="dev-tools-audio-grid"></div>
            </details>
        `;
    }

    _bindAudioTesting() {
        const grid = this.panelEl.querySelector('#dev-tools-audio-grid');
        AUDIO_TESTS.forEach(([label, method]) => {
            const btn = document.createElement('button');
            btn.className = 'dev-tools-btn dev-tools-case-btn';
            btn.textContent = label;
            btn.addEventListener('click', () => {
                AudioController.init();
                if (typeof AudioController[method] === 'function') AudioController[method]();
            });
            grid.appendChild(btn);
        });
    }

    _sectionWallpaperTesting() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Wallpaper Testing</summary>
                <div class="dev-tools-case-grid" id="dev-tools-wallpaper-grid"></div>
            </details>
        `;
    }

    _bindWallpaperTesting() {
        const grid = this.panelEl.querySelector('#dev-tools-wallpaper-grid');
        WALLPAPERS.forEach(wp => {
            const btn = document.createElement('button');
            btn.className = 'dev-tools-btn dev-tools-case-btn';
            btn.textContent = wp.name;
            btn.title = wp.id;
            btn.addEventListener('click', () => eventBus.emit('WALLPAPER_CHANGE', wp.id));
            grid.appendChild(btn);
        });
    }

    _sectionPerformance() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Performance</summary>
                <div id="dev-tools-perf" class="dev-tools-kv"></div>
            </details>
        `;
    }

    _updatePerformance() {
        if (!this.panelEl) return;
        const details = this.panelEl.querySelector('#dev-tools-perf')?.closest('details');
        if (!details || !details.open) return;
        const el = this.panelEl.querySelector('#dev-tools-perf');

        const mem = performance.memory
            ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB`
            : 'n/a (Chrome only)';
        let listenerCount = 0;
        eventBus.listeners.forEach(cbs => { listenerCount += cbs.length; });
        let saveSize = '—';
        try {
            const raw = localStorage.getItem('offset_save_data');
            if (raw) saveSize = `${(raw.length / 1024).toFixed(1)} KB`;
        } catch {  }

        const rows = [
            ['FPS', this._fps],
            ['Memory', mem],
            ['Current case', stateManager.get('currentCase') || '—'],
            ['Current operator', stateManager.get('operator_name') || '(unregistered)'],
            ['Unlocked apps', (stateManager.get('unlocked_apps') || []).length],
            ['Window count', this.os.windowManager.activeApps.size],
            ['Active listeners', listenerCount],
            ['Save size', saveSize],
        ];
        el.innerHTML = rows.map(([k, v]) => `<div class="dev-tools-kv-row"><span>${k}</span><span>${v}</span></div>`).join('');
    }

    // ------------------------------------------------------------------
    // Event Bus
    // ------------------------------------------------------------------

    _sectionEventBus() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Event Bus — last 100</summary>
                <div id="dev-tools-eventlog" class="dev-tools-log"></div>
            </details>
        `;
    }

    _bindEventBus() { this._updateEventBusPanel(); }

    _updateEventBusPanel() {
        if (!this.panelEl) return;
        const el = this.panelEl.querySelector('#dev-tools-eventlog');
        const details = el?.closest('details');
        if (!el || !details || !details.open) return;
        const history = eventBus.getHistory().slice().reverse();
        el.innerHTML = history.map(h => {
            const t = new Date(h.time).toLocaleTimeString();
            return `<div class="dev-tools-log-row"><span class="dev-tools-log-time">${t}</span> ${this._esc(h.event)}</div>`;
        }).join('') || '<div class="dev-tools-log-empty">No events yet.</div>';
    }

    // ------------------------------------------------------------------
    // Log Panel
    // ------------------------------------------------------------------

    _sectionLogPanel() {
        return `
            <details class="dev-tools-section">
                <summary class="dev-tools-label">Console Log</summary>
                <div id="dev-tools-consolelog" class="dev-tools-log"></div>
            </details>
        `;
    }

    _bindLogPanel() { this._updateLogPanel(); }

    _updateLogPanel() {
        if (!this.panelEl) return;
        const el = this.panelEl.querySelector('#dev-tools-consolelog');
        const details = el?.closest('details');
        if (!el || !details || !details.open) return;
        const rows = this._logs.slice().reverse();
        el.innerHTML = rows.map(l => {
            const t = new Date(l.time).toLocaleTimeString();
            return `<div class="dev-tools-log-row dev-tools-log-${l.kind}"><span class="dev-tools-log-time">${t}</span> ${this._esc(l.text)}</div>`;
        }).join('') || '<div class="dev-tools-log-empty">No logs yet.</div>';
    }

    _esc(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Case JSON with a `public/` retry for plain static servers (no vite).
    async _fetchCaseJson(id) {
        for (const url of [`./data/cases/${id}.json`, `./public/data/cases/${id}.json`]) {
            try {
                const res = await fetch(url);
                if (res.ok) return await res.json();
            } catch {}
        }
        return null;
    }
}
