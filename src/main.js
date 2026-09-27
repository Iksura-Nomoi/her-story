import { WindowManager } from './core/WindowManager.js';
import { eventBus } from './core/EventBus.js';
import { stateManager } from './core/StateManager.js';
import { SaveManager } from './core/SaveManager.js';
import { dataLoader } from './core/DataLoader.js';
import { AudioController } from './core/AudioController.js';
import { narrativeManager } from './core/NarrativeManager.js';
import { DevTools } from './core/DevTools.js';
import { DesktopManager } from './core/DesktopManager.js';
import { NotificationManager } from './core/NotificationManager.js';
import { BootSequenceManager, DEFAULT_BOOT_LINES, PRE_LANDING_BOOT_LINES, buildCaseTransitionBootLines } from './core/BootSequenceManager.js';
import { LandingPageManager } from './core/LandingPageManager.js';
import { OnboardingManager } from './core/OnboardingManager.js';
import { FirebaseSync } from './core/FirebaseSync.js';
import { TemplateLoader } from './services/TemplateLoader.js';

const SYSTEM_STATUS_POPOVER_TEMPLATE_PATH = 'templates/system-status-popover.html';

import { CaseFilesApp } from './apps/CaseFiles/CaseFilesApp.js';
import { MessagesApp } from './apps/Messages/MessagesApp.js';
import { SuspectsApp } from './apps/Suspects/SuspectsApp.js';
import { LockerApp } from './apps/Locker/LockerApp.js';
import { MediaApp } from './apps/Media/MediaApp.js';
import { CCTVApp } from './apps/CCTV/CCTVApp.js';
import { TimelineApp } from './apps/Timeline/TimelineApp.js';
import { MapApp } from './apps/Map/MapApp.js';
import { ForensicsApp } from './apps/Forensics/ForensicsApp.js';
import { NetworkApp } from './apps/Network/NetworkApp.js';
import { TerminalApp } from './apps/Terminal/TerminalApp.js';
import { NotesApp } from './apps/Notes/NotesApp.js';
import { ArchiveApp } from './apps/Archive/ArchiveApp.js';
import { SettingsApp } from './apps/Settings/SettingsApp.js';
import { SubmitApp } from './apps/Submit/SubmitApp.js';
import { HelpApp } from './apps/Help/HelpApp.js';
import { CaseArchiveApp } from './apps/CaseArchive/CaseArchiveApp.js';
import { AchievementManager } from './core/AchievementManager.js';
import { EndingSequence } from './core/EndingSequence.js';
const TOTAL_CASE_COUNT = 10;
const ALL_CASE_IDS = ['case001', 'case002', 'case003', 'case004', 'case005', 'case006', 'case007', 'case008', 'case009', 'case010'];
const BASE_UNLOCKED_APPS = ['case-files', 'messages', 'media', 'locker', 'terminal'];
window.__DEBUG__ = { eventBus, stateManager, SaveManager };

const APP_BUTTON_IDS = {
    'case-files': 'btn-app-files',
    'messages': 'btn-app-messages',
    'suspects': 'btn-app-suspects',
    'locker': 'btn-app-locker',
    'media': 'btn-app-media',
    'cctv': 'btn-app-cctv',
    'timeline': 'btn-app-timeline',
    'map': 'btn-app-map',
    'forensics': 'btn-app-forensics',
    'terminal': 'btn-app-terminal',
    'network': 'btn-app-network',
    'notes': 'btn-app-notes',
    'archive': 'btn-app-archive',
    'case-archive': 'btn-app-case-archive'
};

const ALL_APP_BUTTON_IDS = {
    ...APP_BUTTON_IDS,
    'settings': 'btn-app-settings',
    'submit': 'btn-app-submit'
};

const ALWAYS_VISIBLE_APPS = ['settings', 'submit'];

const APP_CLASSES = {
    'case-files': CaseFilesApp,
    'messages': MessagesApp,
    'suspects': SuspectsApp,
    'locker': LockerApp,
    'media': MediaApp,
    'cctv': CCTVApp,
    'timeline': TimelineApp,
    'map': MapApp,
    'forensics': ForensicsApp,
    'network': NetworkApp,
    'terminal': TerminalApp,
    'notes': NotesApp,
    'archive': ArchiveApp,
    'settings': SettingsApp,
    'submit': SubmitApp
};

const APP_WINDOW_SIZES = {
    'case-files': [700, 500],
    'messages': [640, 480],
    'suspects': [640, 480],
    'locker': [600, 460],
    'media': [700, 520],
    'cctv': [720, 520],
    'timeline': [720, 480],
    'map': [720, 540],
    'forensics': [800, 520],
    'network': [700, 500],
    'terminal': [1000, 640],
    'notes': [520, 440],
    'archive': [640, 480],
    'settings': [500, 400],
    'submit': [500, 450]
};

const APP_ICON_DIR = 'assets/app-icons';
const appIconImg = (file, label) =>
    `<img src="${APP_ICON_DIR}/${file}.svg" alt="" draggable="false" loading="eager" />`;

const ICON_GLYPHS = {
    'case-files': appIconImg('case-files'),
    'messages': appIconImg('messages'),
    'suspects': appIconImg('suspects'),
    'locker': appIconImg('locker'),
    'media': appIconImg('media'),
    'cctv': appIconImg('cctv'),
    'timeline': appIconImg('timeline'),
    'map': appIconImg('map'),
    'forensics': appIconImg('forensics'),
    'network': appIconImg('network'),
    'terminal': appIconImg('terminal'),
    'notes': appIconImg('notes'),
    'archive': appIconImg('archive'),
    'settings': appIconImg('settings'),
    'submit': appIconImg('submit'),

    'help': appIconImg('help'),
    'case-archive': appIconImg('case-archive')
};

const APP_LABELS = {
    'case-files': 'Case Files', 'messages': 'Messages', 'suspects': 'Suspects',
    'locker': 'Locker', 'media': 'Media Viewer', 'cctv': 'CCTV',
    'timeline': 'Timeline', 'map': 'Investigation Map', 'forensics': 'Forensics',
    'network': 'Network Observer', 'terminal': 'Terminal', 'notes': 'Notes',
    'archive': 'Archive', 'settings': 'Settings', 'submit': 'Submit Report',
    'help': 'Investigation Guide'
};

const DESKTOP_ICON_ORDER = [

    'case-files', 'messages', 'suspects', 'locker',

    'media', 'cctv', 'forensics', 'timeline', 'map', 'network',

    'terminal', 'notes', 'archive',

    'settings', 'submit'
];
class OSController {
    constructor() {
        this.landingEl = document.getElementById('landing-page');
        this.bootSequenceEl = document.getElementById('boot-sequence');
        this.bootTerminalEl = document.getElementById('boot-terminal');
        this.loginScreenEl = document.getElementById('login-screen');
        this.desktopEl = document.getElementById('desktop-environment');
        this.clockEl = document.getElementById('system-clock');
        this.loginBtn = document.getElementById('btn-login');
        this.skipBootBtn = document.getElementById('btn-skip-boot');
        this.windowManager = null;
        this.desktopManager = null;
        this.devTools = null;
        this.endingSequence = new EndingSequence();
        this.onboardingManager = new OnboardingManager();
        this.bootManager = new BootSequenceManager(this.bootTerminalEl, { glitchTarget: this.bootSequenceEl });
        this.init();
    }
    init() {
        AudioController.ensureUnlockOnGesture();
        SaveManager.init();
        AchievementManager.init();
        NotificationManager.init(document.getElementById('notification-tray'));
        FirebaseSync.init();

        eventBus.on('CASE_LOADED', (payload) => {
            FirebaseSync.logEvent('case_loaded', { caseId: payload?.caseId || stateManager.get('currentCase') });
        });
        eventBus.on('CASE_SOLVED', (payload) => {
            FirebaseSync.logEvent('case_solved', { caseId: payload?.caseId || stateManager.get('currentCase') });
        });
        eventBus.on('REQUEST_CASE_SWITCH', ({ caseId, resetProgress } = {}) => {
            if (caseId) this.switchToCase(caseId, { resetProgress });
        });
        eventBus.on('CAMPAIGN_COMPLETE', ({ epilogueText } = {}) => {
            this.endingSequence.start({
                epilogueText,
                onComplete: () => this.returnToEntry(),
            });
        });
        this.setupLandingPage();
        this.setupLoginButton();
        this.startClock();
        this.initEnvironmentalGlow();
        this.bindTaskbarNotifications();
        this.bindNotificationPanel();
        this.bindSystemCornerButtons();

        this.devTools = new DevTools(this);
        this.devTools.init();

        const ref = document.referrer || '';
        const navEntries = performance.getEntriesByType("navigation");
        const isReload = navEntries.length > 0 && navEntries[0].type === 'reload';

        if (!isReload && (ref.includes('developer-notes') || ref.includes('privacy'))) {
            this.bootSequenceEl.classList.add('hidden');
            this.loginScreenEl.classList.add('hidden');
            this.landingEl.classList.remove('hidden');
            this.landingEl.classList.add('fade-in');
            this.landingManager.mount();
        } else {
            this.playPreLandingBoot();
        }
    }

        playPreLandingBoot() {
        this.bootSequenceEl.classList.remove('hidden', 'fade-out');
        this.bootSequenceEl.classList.add('fade-in');
        this.loginScreenEl.classList.add('hidden');
        this.loginScreenEl.classList.remove('fade-in');
        if (this.skipBootBtn) {
            this.skipBootBtn.classList.remove('hidden');
            this.skipBootBtn.onclick = () => this.bootManager.skip();
        }
        this.bootManager.play(PRE_LANDING_BOOT_LINES, () => {
            if (this.skipBootBtn) this.skipBootBtn.classList.add('hidden');
            this.bootSequenceEl.classList.add('fade-out');
            setTimeout(() => {
                this.bootSequenceEl.classList.add('hidden');
                this.bootSequenceEl.classList.remove('fade-out', 'fade-in');
                this.landingEl.classList.remove('hidden');
                this.landingEl.classList.add('fade-in');
                this.landingManager.mount();
            }, 700);
        });
    }
    setupLandingPage() {
        this.landingManager = new LandingPageManager({
            root: this.landingEl,
            bgHost: document.getElementById('landing-bg'),
            playBtn: document.getElementById('btn-landing-play'),
            quitBtn: document.getElementById('btn-landing-quit'),
            continueBtn: document.getElementById('btn-landing-continue'),
            continueCaptionEl: document.getElementById('landing-continue-caption'),
            onPlay: ({ isNewGame } = {}) => {
                AudioController.init();
                if (isNewGame) {
                    SaveManager.wipeSave();
                    location.reload();
                    return;
                }
                this.playBootSequence();
            },
            onContinue: () => {
                AudioController.init();
                this.playBootSequence(() => this.transitionToDesktop());
            },
        });
        this._refreshLandingResumeState();
    }
    _refreshLandingResumeState() {
        const operatorName = stateManager.get('operator_name');
        this.landingManager.setResumable(!!operatorName, operatorName);
    }
    playBootSequence(onDone) {
        this.bootSequenceEl.classList.remove('hidden', 'fade-out');
        this.bootSequenceEl.classList.add('fade-in');
        this.loginScreenEl.classList.add('hidden');
        this.loginScreenEl.classList.remove('fade-in');
        if (this.skipBootBtn) {
            this.skipBootBtn.classList.remove('hidden');
            this.skipBootBtn.onclick = () => this.bootManager.skip();
        }
        this.bootManager.play(DEFAULT_BOOT_LINES, () => {
            if (this.skipBootBtn) this.skipBootBtn.classList.add('hidden');
            if (onDone) {
                onDone();
            } else {
                this.loginScreenEl.classList.remove('hidden');
                this.loginScreenEl.classList.add('fade-in');
            }
        });
    }
    setupLoginButton() {
        this.loginBtn.addEventListener('click', () => {
            AudioController.init(); 
            AudioController.click();
            this.runOnboarding();
        });
    }
    runOnboarding() {
        this.bootSequenceEl.classList.add('fade-out');
        setTimeout(() => {
            this.bootSequenceEl.classList.add('hidden');
            this.bootSequenceEl.classList.remove('fade-out', 'fade-in');
            this.loginScreenEl.classList.add('hidden');
            this.loginScreenEl.classList.remove('fade-in');
            this.onboardingManager.showRegistration(() => {
                this.onboardingManager.showBriefing(() => {
                    this.playBootSequence(() => this.transitionToDesktop());
                });
            });
        }, 800);
    }
    transitionToDesktop() {
        this.bootSequenceEl.classList.add('fade-out');
        setTimeout(() => {
            this.bootSequenceEl.classList.add('hidden');
            this.bootSequenceEl.classList.remove('fade-out', 'fade-in');
            this.desktopEl.classList.remove('hidden');
            this.desktopEl.classList.add('fade-in');
            if (!this.windowManager) this.startOS();
            else this.refreshCaseArchiveVisibility();
        }, 800);
    }
    returnToEntry() {
        if (this.windowManager) {
            Array.from(this.windowManager.activeApps.values()).forEach(app => {
                try { if (app.isOpen) app.close(); } catch (err) { console.error(err); }
            });
            this.windowManager.activeApps.clear();
        }
        this.desktopEl.classList.add('hidden');
        this.desktopEl.classList.remove('fade-out', 'fade-in');
        this.bootSequenceEl.classList.add('hidden');
        this.bootSequenceEl.classList.remove('fade-in', 'fade-out');
        this.loginScreenEl.classList.add('hidden');
        this.loginScreenEl.classList.remove('fade-in');
        this.onboardingManager.registrationEl.classList.add('hidden');
        this.onboardingManager.registrationEl.classList.remove('fade-in', 'fade-out');
        this.onboardingManager.briefingEl.classList.add('hidden');
        this.onboardingManager.briefingEl.classList.remove('fade-in', 'fade-out');
        this._refreshLandingResumeState();
        this.landingManager.showAgain();
    }
        _startPlayTimeTracking() {
        let sessionSeconds = 0;
        const flush = () => {
            if (sessionSeconds === 0) return;
            const total = (stateManager.get('play_time_seconds') || 0) + sessionSeconds;
            sessionSeconds = 0;
            stateManager.set('play_time_seconds', total);
        };
        setInterval(() => {
            if (document.visibilityState === 'visible') sessionSeconds += 1;
        }, 1000);
        setInterval(flush, 60000);
        window.addEventListener('pagehide', flush);
        window.addEventListener('beforeunload', flush);
    }

    async startOS() {
        this.windowManager = new WindowManager();
        this.initDesktopManager();
        const caseId = stateManager.get('currentCase') || 'case001';
        let loadedCase = await dataLoader.loadCase(caseId);
        if (!loadedCase) {
            console.error(`Failed to load ${caseId} on boot.`);
            if (caseId !== 'case001') {
                console.warn('Falling back to case001.');
                loadedCase = await dataLoader.loadCase('case001');
                if (loadedCase) stateManager.set('currentCase', 'case001');
            }
            if (!loadedCase) {
                console.error('Failed to load fallback case001; the desktop will boot without case data.');
            }
        }
        stateManager.set('caseData', loadedCase);
        eventBus.emit('CASE_LOADED', loadedCase);
        if (!loadedCase) {
            eventBus.emit('CASE_LOAD_FAILED', { caseId });
            NotificationManager.push({
                title: 'Case Data Unavailable',
                body: 'Could not load investigation data. Try refreshing.',
                kind: 'error',
            });
        }
        const savedClearance = stateManager.get('clearance');
        if (savedClearance === 2) document.body.classList.add('tier-2');
        const osSettings = stateManager.get('os_settings');
        if (osSettings) {
            // Mirrors SettingsApp._applySettingsToOS() — that only runs once the
            // Settings window is opened, so boot needs to re-apply every visual
            // setting here too, not just CRT scanlines + animations.
            document.body.classList.toggle('crt-scanlines', !!osSettings.crtMode);
            document.body.classList.toggle('crt-curvature', !!osSettings.crtCurvature);
            document.body.classList.toggle('disable-animations', osSettings.animations === false);
            if (osSettings.theme && osSettings.theme !== 'default') {
                document.documentElement.setAttribute('data-theme', osSettings.theme);
            }
            if (osSettings.fontScale && osSettings.fontScale != 100) {
                document.documentElement.setAttribute('data-font-scale', String(osSettings.fontScale));
            }
            AudioController.toggleAmbient(Boolean(osSettings.ambientHum));
        }
        this._startPlayTimeTracking();
        eventBus.on('EVIDENCE_BOOKMARKED', (data) => {
            const evidence = stateManager.get('collected_evidence') || [];
            if (!evidence.find(e => e.id === data.id)) {
                evidence.push(data);
                stateManager.set('collected_evidence', evidence);
                if (AudioController.bookmark) AudioController.bookmark();
                NotificationManager.push({ title: 'Evidence Bookmarked', body: data.title || data.id, kind: 'evidence' });
            }
        });

        eventBus.on('DOCUMENT_OPENED', ({ docId } = {}) => {
            if (!docId) return;
            const seen = stateManager.get('seen_evidence') || [];
            if (!seen.includes(docId)) {
                seen.push(docId);
                stateManager.set('seen_evidence', seen);
            }
        });

        eventBus.on('CASE_SOLVED', ({ caseId } = {}) => {
            if (AudioController.caseComplete) AudioController.caseComplete();
            NotificationManager.push({ title: 'Case Completed', body: 'Investigation report accepted.', kind: 'success' });

            const id = caseId || stateManager.get('currentCase');
            if (id) {
                const completed = [...(stateManager.get('completed_cases') || [])];
                if (!completed.find(c => c.id === id)) {
                    const caseData = stateManager.get('caseData') || {};
                    const title = caseData.title || id;

                    const evidenceManifest = (caseData.evidence || [])
                        .filter(e => !e.requiredFlag || stateManager.hasFlag(e.requiredFlag))
                        .map(e => ({ id: e.id, title: e.title, summary: e.summary || e.title }));
                    completed.push({ id, title, evidenceManifest });
                    stateManager.set('completed_cases', completed);
                }
                this.refreshCaseArchiveVisibility();
            }
        });

        eventBus.on('FLAG_UNLOCKED', (flag) => {
            if (flag === 'NEW_EVIDENCE') {
                NotificationManager.push({ title: 'New Evidence Added', kind: 'evidence' });
                if (this.desktopManager) this.desktopManager.setBadge('case-files', true);
            }

            const caseFilesApp = this.windowManager.activeApps.get('case-files');
            if (caseFilesApp?.isOpen) caseFilesApp.refresh();
            const helpApp = this.windowManager.activeApps.get('help');
            if (helpApp?.isOpen) helpApp.refresh({ resetTutorial: false });
        });

        document.getElementById('btn-app-settings')?.addEventListener('click', () => {
            if (!this.windowManager.activeApps.has('settings')) {
                const app = new SettingsApp('settings', 'OS Settings', 500, 400, this.windowManager);
                this.windowManager.activeApps.set('settings', app);
                app.open();
            } else this.windowManager.activeApps.get('settings').open();
        });
        document.getElementById('btn-app-submit')?.addEventListener('click', () => this.launchSubmitApp());
        document.addEventListener('LAUNCH_APP', (e) => {
            if (e.detail === 'submit') this.launchSubmitApp();
            else if (e.detail) this.launchApp(e.detail);
        });
    }

    launchSubmitApp() {
        if (!this.windowManager.activeApps.has('submit')) {
            const app = new SubmitApp('submit', 'Submit Report', 500, 450, this.windowManager);
            this.windowManager.activeApps.set('submit', app);
            app.open();
        } else this.windowManager.activeApps.get('submit').open();
    }

    initDesktopManager() {
        if (this.desktopManager) return;
        const registry = DESKTOP_ICON_ORDER.map(id => ({
            id,
            label: APP_LABELS[id],
            icon: ICON_GLYPHS[id],
            alwaysVisible: ALWAYS_VISIBLE_APPS.includes(id)
        }));
        this.desktopManager = new DesktopManager({
            mountEl: document.getElementById('desktop-icons'),
            wallpaperEl: document.getElementById('wallpaper-layer'),
            registry,
            onLaunch: (appId) => this.launchApp(appId)
        });
        this.desktopManager.render();
    }

    // Central launcher for every desktop-icon / taskbar app. 'settings' and
    // 'submit' are always-visible utility apps with their own dedicated
    // helpers/handlers elsewhere, but routing them through here too means
    // double-clicking their desktop icons (and the desktop context menu's
    // "Settings"/"Appearance" actions, which dispatch LAUNCH_APP) works.
    launchApp(appId) {
        if (!this.windowManager) return;
        if (appId === 'submit') { this.launchSubmitApp(); return; }
        const AppClass = APP_CLASSES[appId];
        if (!AppClass) {
            console.warn(`launchApp: unknown app id "${appId}"`);
            return;
        }
        if (!this.windowManager.activeApps.has(appId)) {
            const [w, h] = APP_WINDOW_SIZES[appId] || [640, 480];
            const label = APP_LABELS[appId] || appId;
            const app = new AppClass(appId, label, w, h, this.windowManager);
            this.windowManager.activeApps.set(appId, app);
            app.open();
        } else {
            this.windowManager.activeApps.get(appId).open();
        }
        if (appId === 'case-files' && this.desktopManager) {
            this.desktopManager.setBadge('case-files', false);
        }
    }

    // Apps whose entire UI is a list/view driven by one case-data array.
    // Cumulative unlocking (below) means once an app is unlocked from an
    // earlier case's solution.unlocks, it stays unlocked forever — but not
    // every later case's JSON actually has data for that array. Without
    // this, e.g. Network stays "unlocked" from case001 into case004, whose
    // case004.json has no `network` key at all, so the app opens to a
    // silently empty screen. Gate visibility per-case on data presence too
    // — but ONLY while the player is still building up their toolkit. Once
    // every gated app has been granted by some earlier case's
    // solution.unlocks, the full set stays visible for the rest of the
    // campaign regardless of whether a given case actually uses it — see
    // FULL_TOOLKIT_APPS below.
    static DATA_GATED_APPS = { cctv: 'cctv', network: 'network', map: 'map', timeline: 'timeline', archive: 'archive' };

    // The complete set of apps that are ever subject to data-gating
    // (DATA_GATED_APPS + forensics, which has its own content check below).
    // Used to detect the point in the campaign where the player has earned
    // every one of them — from that case onward, gating is skipped entirely.
    static FULL_TOOLKIT_APPS = [...Object.keys(OSController.DATA_GATED_APPS ?? {}), 'forensics'];

    // Forensics is data-gated too, but its shape doesn't fit the simple
    // array-length check above: `forensics` is an object with four
    // sub-modules (afis/hash/chem/recover), each itself an object keyed by
    // evidence/file ID. A case can have a `forensics: {}` (or one with all
    // sub-modules empty) and still pass a bare `!!entries` truthiness check,
    // which is exactly how this app used to stay open-but-empty (e.g.
    // case006, which sits between two forensics-heavy cases but has no
    // forensics content of its own). Content only counts if at least one
    // sub-module has at least one entry.
    static FORENSICS_SUBKEYS = ['afis', 'hash', 'chem', 'recover'];
    static forensicsHasContent(forensics) {
        if (!forensics || typeof forensics !== 'object') return false;
        return OSController.FORENSICS_SUBKEYS.some(sub => {
            const entry = forensics[sub];
            return entry && typeof entry === 'object' && Object.keys(entry).length > 0;
        });
    }

    // Cumulative app unlocks for a given case = base toolkit + every
    // solution.unlocks entry from every case before it in campaign order.
    // While the player is still earning apps, gated apps (see
    // DATA_GATED_APPS / forensicsHasContent above) are further filtered to
    // only ones with actual content in THIS case. Once the player has been
    // granted every gated app by some earlier case, that filtering is
    // skipped from then on — the full toolkit stays visible for every
    // remaining case, used or not.
    async computeUnlockedAppsForCase(caseId) {
        const targetIndex = ALL_CASE_IDS.indexOf(caseId);
        const unlocked = new Set(BASE_UNLOCKED_APPS);
        if (targetIndex > 0) {
            const priorCaseIds = ALL_CASE_IDS.slice(0, targetIndex);
            const priorCases = await Promise.all(priorCaseIds.map(id => dataLoader.loadCase(id)));
            priorCases.forEach(data => {
                const unlocks = data?.solution?.unlocks;
                if (Array.isArray(unlocks)) unlocks.forEach(appId => unlocked.add(appId));
            });
        }

        // Has every gated app already been earned from a prior case? If so,
        // the toolkit is complete — skip content-based filtering entirely.
        const toolkitComplete = OSController.FULL_TOOLKIT_APPS.every(appId => unlocked.has(appId));
        if (toolkitComplete) {
            return Array.from(unlocked);
        }

        const currentCaseData = await dataLoader.loadCase(caseId);
        Object.entries(OSController.DATA_GATED_APPS).forEach(([appId, dataKey]) => {
            if (!unlocked.has(appId)) return;
            const entries = currentCaseData?.[dataKey];
            const hasContent = Array.isArray(entries) ? entries.length > 0 : !!entries;
            if (!hasContent) unlocked.delete(appId);
        });
        if (unlocked.has('forensics') && !OSController.forensicsHasContent(currentCaseData?.forensics)) {
            unlocked.delete('forensics');
        }
        return Array.from(unlocked);
    }

    // Handles REQUEST_CASE_SWITCH — used both by "INITIALIZE NEXT DOSSIER"
    // (SubmitApp) and "Replay" (CaseArchiveApp). Reconstructs full campaign
    // state for the target case rather than leaving the previous case's
    // unlocked_apps / collected_evidence / notification_history behind.
    async switchToCase(caseId, { resetProgress = true } = {}) {
        if (!ALL_CASE_IDS.includes(caseId)) {
            console.error(`switchToCase: unknown case id "${caseId}"`);
            return;
        }
        const outgoingCaseData = stateManager.get('caseData');
        if (this.windowManager) {
            Array.from(this.windowManager.activeApps.values()).forEach(app => {
                try { if (app.isOpen) app.close(); } catch (err) { console.error(err); }
            });
            this.windowManager.activeApps.clear();
        }

        const unlockedApps = await this.computeUnlockedAppsForCase(caseId);
        const loadedCase = await dataLoader.loadCase(caseId);

        this.desktopEl.classList.add('fade-out');
        setTimeout(() => {
            this.desktopEl.classList.add('hidden');
            this.desktopEl.classList.remove('fade-out', 'fade-in');
        }, 800);
        this.bootSequenceEl.classList.remove('hidden', 'fade-out');
        this.bootSequenceEl.classList.add('fade-in');
        if (this.skipBootBtn) {
            this.skipBootBtn.classList.remove('hidden');
            this.skipBootBtn.onclick = () => this.bootManager.skip();
        }

        const transitionLines = buildCaseTransitionBootLines({
            outgoingTitle: outgoingCaseData?.title,
            incomingTitle: loadedCase?.title,
        });

        this.bootManager.play(transitionLines, () => {
            if (this.skipBootBtn) this.skipBootBtn.classList.add('hidden');

            stateManager.set('currentCase', caseId);
            stateManager.set('unlocked_apps', unlockedApps);
            if (resetProgress) {
                stateManager.set('collected_evidence', []);
                stateManager.set('seen_evidence', []);
                stateManager.set('notification_history', []);
            }
            stateManager.set('caseData', loadedCase);
            eventBus.emit('CASE_LOADED', loadedCase);
            if (!loadedCase) {
                eventBus.emit('CASE_LOAD_FAILED', { caseId });
                NotificationManager.push({
                    title: 'Case Data Unavailable',
                    body: 'Could not load investigation data. Try refreshing.',
                    kind: 'error',
                });
            }
            if (this.desktopManager) this.desktopManager.render();

            this.bootSequenceEl.classList.add('fade-out');
            setTimeout(() => {
                this.bootSequenceEl.classList.add('hidden');
                this.bootSequenceEl.classList.remove('fade-out', 'fade-in');
                this.desktopEl.classList.remove('hidden', 'fade-out');
                this.desktopEl.classList.add('fade-in');
                this.refreshCaseArchiveVisibility();
            }, 800);
        });
    }
        bindSystemCornerButtons() {
        const helpBtn = document.getElementById('btn-help-system');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                if (AudioController.click) AudioController.click();
                if (!this.windowManager.activeApps.has('help')) {
                    const app = new HelpApp('help', 'Investigation Guide', 480, 560, this.windowManager);
                    this.windowManager.activeApps.set('help', app);
                    app.open();
                } else this.windowManager.activeApps.get('help').open();
            });
        }

        const archiveBtn = document.getElementById('btn-case-archive');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', () => {
                if (AudioController.click) AudioController.click();
                if (!this.windowManager.activeApps.has('case-archive')) {
                    const app = new CaseArchiveApp('case-archive', 'Campaign Archive', 560, 480, this.windowManager);
                    this.windowManager.activeApps.set('case-archive', app);
                    app.open();
                } else this.windowManager.activeApps.get('case-archive').open();
            });
        }
    }

        refreshCaseArchiveVisibility() {
        const archiveBtn = document.getElementById('btn-case-archive');
        if (!archiveBtn) return;
        const completed = stateManager.get('completed_cases') || [];
        archiveBtn.classList.toggle('hidden', completed.length < TOTAL_CASE_COUNT);
    }

        startIdleHelpNudge() {
        const IDLE_MS = 4 * 60 * 1000;
        let idleTimer = null;

        const scheduleNudge = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                const helpOpen = this.windowManager.activeApps.get('help')?.isOpen;
                if (!helpOpen) {
                    NotificationManager.push({
                        title: 'Stuck?',
                        body: 'The Investigation Guide can help — top right corner.',
                        kind: 'system'
                    });
                }
                scheduleNudge();
            }, IDLE_MS);
        };

        ['mousemove', 'keydown', 'click'].forEach(evt => {
            document.addEventListener(evt, scheduleNudge, { passive: true });
        });
        scheduleNudge();
    }

    bindAudioHoverEffects() {
        const icons = document.querySelectorAll('.app-icon');
        icons.forEach(icon => {
            icon.addEventListener('mouseenter', () => { if(AudioController.hover) AudioController.hover(); });
        });
    }
    startClock() {
        const updateClock = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            if(this.clockEl) this.clockEl.textContent = `${hours}:${minutes}`;
        };
        updateClock();
        setInterval(updateClock, 10000); 
    }
    initEnvironmentalGlow() {
        document.addEventListener('mousemove', (e) => {
            requestAnimationFrame(() => {
                if(this.desktopEl) {
                    this.desktopEl.style.setProperty('--mouse-x', `${e.clientX}px`);
                    this.desktopEl.style.setProperty('--mouse-y', `${e.clientY}px`);
                }
            });
        });
    }
    bindTaskbarNotifications() {
        const btnFiles = document.getElementById('btn-app-files');
        if (btnFiles) {
            btnFiles.addEventListener('click', () => {
                if (this.desktopManager) this.desktopManager.setBadge('case-files', false);
            });
        }
        const desktopBtn = document.getElementById('btn-desktop-shortcut');
        if (desktopBtn) {
            let hiddenByShortcut = [];
            desktopBtn.addEventListener('click', () => {
                if (!this.windowManager) return;
                AudioController.click();
                if (hiddenByShortcut.length) {
                    hiddenByShortcut.forEach(appId => {
                        const app = this.windowManager.activeApps.get(appId);
                        if (app && app.isOpen) app.open(); 
                    });
                    hiddenByShortcut = [];
                } else {
                    hiddenByShortcut = [];
                    this.windowManager.activeApps.forEach((app, appId) => {
                        if (app.isOpen && !app.isMinimized) {
                            app.minimize();
                            hiddenByShortcut.push(appId);
                        }
                    });
                }
            });
            desktopBtn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.toggleSystemStatusPopover(desktopBtn);
            });
            const updateDesktopBtnState = () => {
                if (!this.windowManager) return;
                const anyOpen = Array.from(this.windowManager.activeApps.values()).some(a => a.isOpen);
                desktopBtn.classList.toggle('is-running', anyOpen);
            };
            eventBus.on('APP_STATE_CHANGED', updateDesktopBtnState);
        }
        eventBus.on('APP_STATE_CHANGED', () => this._renderTaskbarRunning());
        this._renderTaskbarRunning();
        this._bindFullscreenToggle();
    }

    // Populates #taskbar-running with one icon per open app (mirroring the
    // desktop-icon glyph/label) so running apps are reachable from the
    // taskbar, with the is-running/is-minimized dot indicator BaseApp's
    // APP_STATE_CHANGED events were always meant to drive.
    _renderTaskbarRunning() {
        const mount = document.getElementById('taskbar-running');
        if (!mount || !this.windowManager) return;
        mount.innerHTML = '';
        this.windowManager.activeApps.forEach((app, appId) => {
            if (!app.isOpen) return;
            const btn = document.createElement('button');
            btn.className = 'app-icon is-running';
            btn.classList.toggle('is-minimized', !!app.isMinimized);
            btn.dataset.appId = appId;
            btn.setAttribute('aria-label', app.title || APP_LABELS[appId] || appId);
            btn.setAttribute('data-tooltip', app.title || APP_LABELS[appId] || appId);
            btn.innerHTML = ICON_GLYPHS[appId] || '';
            btn.addEventListener('click', () => {
                AudioController.click();
                if (app.isMinimized) {
                    app.open();
                } else {
                    this.windowManager.bringToFront(appId);
                }
            });
            mount.appendChild(btn);
        });
    }

    _bindFullscreenToggle() {
        const btn = document.getElementById('taskbar-fullscreen-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            AudioController.click();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
            } else {
                document.exitFullscreen?.();
            }
        });
        document.addEventListener('fullscreenchange', () => {
            const isFullscreen = !!document.fullscreenElement;
            btn.classList.toggle('is-active', isFullscreen);
            btn.setAttribute('aria-label', isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen');
            btn.setAttribute('data-tooltip', isFullscreen ? 'Exit Fullscreen' : 'Fullscreen');
        });
    }
    toggleSystemStatusPopover(anchorEl) {
        let popover = document.getElementById('system-status-popover');
        if (popover) { popover.remove(); return; }
        const caseId = stateManager.get('currentCase') || '—';
        const unlockedCount = (stateManager.get('unlocked_apps') || []).length;
        const evidenceCount = (stateManager.get('collected_evidence') || []).length;
        popover = document.createElement('div');
        popover.id = 'system-status-popover';
        popover.className = 'notification-panel';
        popover.innerHTML = TemplateLoader.getSync(SYSTEM_STATUS_POPOVER_TEMPLATE_PATH)
            .replace('{{caseId}}', caseId)
            .replace('{{unlockedCount}}', unlockedCount)
            .replace('{{evidenceCount}}', evidenceCount);
        document.body.appendChild(popover);
        const closeOnOutside = (e) => {
            if (!popover.contains(e.target) && e.target !== anchorEl) {
                popover.remove();
                document.removeEventListener('mousedown', closeOnOutside);
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                popover.remove();
                document.removeEventListener('mousedown', closeOnOutside);
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('mousedown', closeOnOutside);
        document.addEventListener('keydown', closeOnEscape);
    }
    bindNotificationPanel() {
        const bellBtn = document.getElementById('notification-tray-btn');
        const panel = document.getElementById('notification-panel');
        if (!bellBtn || !panel) return;
        const relativeTime = (ts) => {
            const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
            if (diffSec < 60) return 'just now';
            const diffMin = Math.floor(diffSec / 60);
            if (diffMin < 60) return `${diffMin}m ago`;
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `${diffHr}h ago`;
            return `${Math.floor(diffHr / 24)}d ago`;
        };
        const renderPanel = () => {
            const history = NotificationManager.getHistory();
            if (!history.length) {
                panel.innerHTML = `
                    <div class="notification-panel-header"><span>NOTIFICATIONS</span></div>
                    <div class="notification-panel-empty">No notifications</div>
                `;
                return;
            }
            const items = history.map(n => `
                <div class="notification-panel-item kind-${n.kind}">
                    <div class="notification-panel-item-title">${n.title}</div>
                    ${n.body ? `<div class="notification-panel-item-body">${n.body}</div>` : ''}
                    <div class="notification-panel-item-time">${relativeTime(n.ts)}</div>
                </div>
            `).join('');
            panel.innerHTML = `
                <div class="notification-panel-header">
                    <span>NOTIFICATIONS</span>
                    <button class="notification-panel-clear" id="notification-panel-clear">CLEAR</button>
                </div>
                <div class="notification-panel-list">${items}</div>
            `;
            const clearBtn = panel.querySelector('#notification-panel-clear');
            if (clearBtn) clearBtn.addEventListener('click', () => {
                stateManager.set('notification_history', []);
                renderPanel();
            });
        };
        const openPanel = () => {
            renderPanel();
            panel.classList.remove('hidden');
            if (AudioController.click) AudioController.click();
        };
        const closePanel = () => panel.classList.add('hidden');
        const isOpen = () => !panel.classList.contains('hidden');
        bellBtn.addEventListener('click', () => {
            if (isOpen()) closePanel(); else openPanel();
        });
        bellBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bellBtn.click(); }
        });
        document.addEventListener('mousedown', (e) => {
            if (isOpen() && !panel.contains(e.target) && e.target !== bellBtn && !bellBtn.contains(e.target)) closePanel();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen()) closePanel();
        });
        eventBus.on('NOTIFICATION_HISTORY_UPDATED', () => { if (isOpen()) renderPanel(); });
    }
}
document.addEventListener('DOMContentLoaded', async () => {

    await TemplateLoader.preload([
        'templates/base-app.html',
        'src/apps/Forensics/ForensicsApp.html',
        'src/apps/CaseFiles/CaseFilesApp.html',
        'src/apps/Media/MediaApp.html',
        'src/apps/Network/NetworkApp.html',
        'src/apps/Map/MapApp.html',
        'src/apps/CCTV/CCTVApp.html',
        'src/core/DevTools.html',
        'src/apps/Timeline/TimelineApp.html',
        'src/apps/Terminal/TerminalApp.html',
        'src/apps/Suspects/SuspectsApp.html',
        'src/apps/Messages/MessagesApp.html',
        'src/apps/Locker/LockerApp.html',
        'src/apps/CaseArchive/CaseArchiveApp.html',
        'src/apps/Archive/ArchiveApp.html',
        'src/apps/Submit/SubmitApp.html',
        'src/apps/Settings/SettingsApp.html',
        'src/apps/Notes/NotesApp.html',
        'src/apps/Help/HelpApp.html',
        'templates/system-status-popover.html'
    ]);
    new OSController();
});
