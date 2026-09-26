import { BaseApp } from '../BaseApp.js';
import { stateManager } from '../../core/StateManager.js';
import { dataLoader } from '../../core/DataLoader.js';
import { AudioController } from '../../core/AudioController.js';
import { eventBus } from '../../core/EventBus.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';

const HELP_SHELL_TEMPLATE_PATH = 'src/apps/Help/HelpApp.html';

const APP_LABELS = {
    'case-files': 'Case Files', 'messages': 'Messages', 'suspects': 'Suspects',
    'locker': 'Evidence Locker', 'media': 'Media Viewer', 'cctv': 'CCTV',
    'timeline': 'Timeline Analysis', 'map': 'Investigation Map', 'forensics': 'Forensics Lab',
    'network': 'Network Observer', 'terminal': 'System Terminal', 'notes': 'Notes',
    'archive': 'Archive', 'settings': 'Settings', 'submit': 'Submit Report'
};

const APP_BLURBS = {
    'case-files': 'The official case file: incident summary, background, and any documents attached to the investigation.',
    'messages': 'Message threads between people connected to the case — read every thread, including older ones further down.',
    'suspects': 'Profiles for every named suspect, including how they connect to each other and to the evidence.',
    'locker': 'Physical/digital evidence collected so far, logged automatically as you uncover it elsewhere.',
    'media': 'Photos, images, and other media pulled from the case — inspect these closely, details are often visual.',
    'cctv': 'Security camera footage relevant to the case, with timestamps worth cross-referencing against Timeline.',
    'timeline': 'A chronological log of events — useful for spotting gaps or contradictions in a suspect\'s story.',
    'map': 'Locations relevant to the investigation, plotted geographically.',
    'forensics': 'Lab analysis results — fingerprints, samples, and other technical findings.',
    'network': 'Network/traffic activity tied to the case, for the more technical trails.',
    'terminal': 'A real command-line shell. Type "help" inside it for the current case\'s available commands.',
    'notes': 'Your own scratch space — nothing here is checked or graded, it\'s just for your working theory.',
    'archive': 'Read-only records from cases you\'ve already closed.',
    'settings': 'Wallpaper, desktop grid, audio, and other OS preferences.',
    'submit': 'Where you file your conclusion: the suspect this evidence points to, and the evidence that proves it.'
};

export class HelpApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.minWidth = 420;
        this.minHeight = 420;

        this.activeTab = 'case';

        this._tutorialConfirming = false;
        this._tutorialRevealed = false;
    }

    render() {
        if (this.element) return this.element;
        super.render();

        const contentArea = this.element.querySelector('.window-content');
        contentArea.classList.add('app-content-area--flex');
        const template = TemplateLoader.getSync(HELP_SHELL_TEMPLATE_PATH);
        contentArea.innerHTML = template.replaceAll('{{id}}', this.id);

        this.element.querySelectorAll(`#help-tabs-${this.id} .help-tab-btn`).forEach(btn => {
            btn.addEventListener('click', () => {
                if (AudioController.click) AudioController.click();
                this.activeTab = btn.dataset.tab;
                this._renderBody();
            });
        });

        this._renderBody();
        return this.element;
    }

    refresh({ resetTutorial = true } = {}) {
        if (this.element) {
            if (resetTutorial) {
                this._tutorialConfirming = false;
                this._tutorialRevealed = false;
            }
            this._renderBody();
        }
    }

    _renderTabState() {
        this.element.querySelectorAll(`#help-tabs-${this.id} .help-tab-btn`).forEach(btn => {
            const isActive = btn.dataset.tab === this.activeTab;
            btn.style.background = isActive ? 'var(--accent-blue)' : 'transparent';
            btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
            btn.style.borderColor = isActive ? 'var(--accent-blue)' : 'var(--border-subtle)';
        });
    }

    _caseId() {
        return stateManager.get('currentCase') || 'case001';
    }

    _caseNumberLabel(caseId) {
        const m = /case0*(\d+)/i.exec(caseId || '');
        const num = m ? m[1].padStart(3, '0') : '???';
        return `CASE ${num}`;
    }

    _hintLevel() {
        const levels = stateManager.get('help_hint_level') || {};
        return levels[this._caseId()] || 0;
    }

    _bumpHintLevel() {
        const levels = { ...(stateManager.get('help_hint_level') || {}) };
        const caseId = this._caseId();
        levels[caseId] = Math.min((levels[caseId] || 0) + 1, 3);
        stateManager.set('help_hint_level', levels);
    }

    _renderBody() {
        const body = this.element.querySelector(`#help-body-${this.id}`);
        if (!body) return;
        this._renderTabState();

        if (this.activeTab === 'system') {
            this._renderSystemGuide(body);
            return;
        }

        this._renderCaseGuide(body);
    }

        _computeStage(caseData) {
        const evidence = dataLoader.getEvidence() || caseData.evidence || [];
        const puzzles = dataLoader.getPuzzles() || caseData.puzzles || [];
        const seen = stateManager.get('seen_evidence') || [];

        const unlocked = evidence.filter(e => !e.requiredFlag || stateManager.hasFlag(e.requiredFlag));
        const locked = evidence.filter(e => e.requiredFlag && !stateManager.hasFlag(e.requiredFlag));
        const unread = unlocked.filter(e => !seen.includes(e.id));

        const unsolvedPuzzles = puzzles.filter(p => p.resultingFlag && !stateManager.hasFlag(p.resultingFlag));
        const solvedPuzzles = puzzles.filter(p => p.resultingFlag && stateManager.hasFlag(p.resultingFlag));

        let stage;
        if (unread.length > 0) {

            stage = 'unread';
        } else if (unsolvedPuzzles.length > 0) {
            stage = 'puzzle';
        } else if (locked.length > 0) {

            stage = 'followup';
        } else {
            stage = 'ready';
        }

        return { stage, evidence, unlocked, locked, unread, unsolvedPuzzles, solvedPuzzles, seen };
    }

    _renderCaseGuide(body) {
        const caseData = stateManager.get('caseData');

        if (!caseData) {
            body.innerHTML = `<div style="color: var(--text-muted);">No active investigation loaded.</div>`;
            return;
        }

        const beats = dataLoader.getNarrativeBeats() || caseData.narrativeBeats || {};
        const pos = this._computeStage(caseData);
        const hintLevel = this._hintLevel();
        const hints = this._buildHints(pos, beats, hintLevel);

        body.innerHTML = `
            <div style="color: var(--accent-blue); font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">${this._caseNumberLabel(caseData.id)}</div>
            <h2 style="margin: 0 0 20px 0; color: var(--text-primary); font-size: 20px;">${caseData.title || caseData.id}</h2>

            ${this._section('Next Objective', this._objectiveText(pos))}

            ${this._section('Evidence — Unlocked', pos.unlocked.length
                ? `<ul style="margin:0; padding-left: 18px; line-height:1.7;">${pos.unlocked.map(e => `<li>${e.title}${pos.seen.includes(e.id) ? '' : ' <span style="font-size:10px; color: var(--accent-blue); text-transform:uppercase; letter-spacing:0.5px;">· not yet opened</span>'}</li>`).join('')}</ul>`
                : `<div style="color: var(--text-muted); font-style: italic;">Nothing unlocked yet.</div>`)}

            ${this._section('Evidence — Still Locked', pos.locked.length
                ? `<ul style="margin:0; padding-left: 18px; line-height:1.7; color: var(--text-secondary);">${pos.locked.map(e => `<li>${e.title}</li>`).join('')}</ul>`
                : `<div style="color: var(--status-success);">All known evidence for this case is unlocked.</div>`)}

            ${this._section('Hints', `
                <div style="line-height:1.7; color: var(--text-secondary);">${hints.text}</div>
                ${hints.canReveal
                    ? `<button class="os-button" id="btn-reveal-hint-${this.id}" style="margin-top: 12px;">Reveal Next Hint (${hintLevel}/3)</button>`
                    : `<div style="margin-top:10px; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">All hints revealed for this stage.</div>`}
            `)}

            ${this._section('Full Tutorial', this._renderTutorialSection(caseData, pos))}

            ${beats.onSubmitSuccess ? this._section('Important Observations', `<div style="color: var(--text-muted); font-style: italic;">${beats.onSubmitSuccess}</div>`) : ''}
        `;

        const revealBtn = body.querySelector(`#btn-reveal-hint-${this.id}`);
        if (revealBtn) {
            revealBtn.addEventListener('click', () => {
                if (AudioController.click) AudioController.click();
                this._bumpHintLevel();
                eventBus.emit('HELP_HINT_REVEALED', {});
                this._renderBody();
            });
        }

        this._bindTutorialControls(body, caseData, pos);
    }

    _objectiveText(pos) {
        if (pos.stage === 'unread') {
            const next = pos.unread[0];
            return `You have evidence available that you haven't opened yet — start with "${next.title}" in Case Files (or Messages/Media, if that's where it lives).`;
        }
        if (pos.stage === 'puzzle') {
            return `Everything currently available has been read. The next step is gated behind an action — most likely a Terminal command, or a Forensics module run against something you've already found.`;
        }
        if (pos.stage === 'followup') {
            return `You've solved everything currently actionable, but at least one piece of evidence is still locked. Re-check the tools relevant to this case (see below) — something you already have should point at how to reach it.`;
        }
        return `All visible evidence has been recovered and read. Open Submit Report and construct the causality chain: pick the suspect this evidence points to, and the single piece of evidence that proves it.`;
    }

    _section(title, innerHtml) {
        return `
            <div style="margin-bottom: 22px;">
                <div style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">${title}</div>
                ${innerHtml}
            </div>
        `;
    }

        _buildHints(pos, beats, level) {
        const tiers = [];

        if (pos.stage === 'unread') {
            const next = pos.unread[0];
            tiers.push(`You've got unread evidence sitting in your apps. Open "${next.title}" before looking for anything new.`);
            tiers.push(`Check Case Files first, then Messages and Media — unread items are usually what unblocks the next step.`);
            tiers.push(`Specifically: "${next.title}"${pos.unread.length > 1 ? ` (and ${pos.unread.length - 1} more waiting)` : ''}.`);
        } else if (pos.stage === 'puzzle') {
            const puzzle = pos.unsolvedPuzzles[0];
            const cmd = puzzle?.triggerCommand || '';
            const verb = cmd.split(' ')[0] || 'a command';
            tiers.push(`Re-read what you already have. Something in it points toward the Terminal, or a specific Forensics module.`);
            tiers.push(`The Terminal is relevant here. Try a "${verb}" style command against something you've already found.`);
            tiers.push(cmd
                ? `Exact command: <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 3px;">${cmd}</code>`
                : `If you're stuck, open Case Files and re-check each document's linked references — one of them is the key.`);
        } else if (pos.stage === 'followup') {
            const target = pos.locked[0];
            tiers.push(`"${target.title}" is still locked. Something you already hold names the tool or key that reaches it.`);
            tiers.push(`Check every unlocked app for anything still marked unread or unexamined — the trigger for this one isn't in the Terminal's puzzle list.`);
            tiers.push(`Look specifically at Forensics and any media with a brightness/zoom-style reveal — "${target.title}" is gated behind one of those, not a command.`);
        } else {
            tiers.push(`Everything is unlocked and read. You're ready to file this one.`);
            tiers.push(`Open Submit Report: pick the suspect the evidence points to.`);
            tiers.push(`Pair that suspect with the single piece of evidence that actually proves it — not just the most recent thing you found.`);
        }

        const text = tiers.slice(0, Math.max(level, 0) + 1).map((t, i) => `<div style="margin-bottom: 8px;"><strong style="color: var(--accent-blue);">Hint ${i + 1}:</strong> ${t}</div>`).join('');
        return { text, canReveal: level < tiers.length - 1 };
    }

    // Render full-spoiler walkthrough section
    _renderTutorialSection(caseData, pos) {
        if (this._tutorialConfirming) {
            return `
                <div style="border: 1px solid var(--status-warning); padding: 14px; background: rgba(255,180,0,0.06);">
                    <div style="color: var(--text-primary); margin-bottom: 12px; line-height:1.6;">
                        This will reveal the complete solution path for this case, including the suspect and the exact evidence to submit. Are you sure?
                    </div>
                    <div style="display:flex; gap: 10px;">
                        <button class="os-button" id="btn-tutorial-yes-${this.id}">Yes, reveal it</button>
                        <button class="os-button" id="btn-tutorial-no-${this.id}">No, go back</button>
                    </div>
                </div>
            `;
        }

        if (!this._tutorialRevealed) {
            return `
                <div style="color: var(--text-secondary); line-height:1.7; margin-bottom: 12px;">
                    Every hint above stops short of the answer. This section doesn't — it lays out the full solve, step by step, including the culprit.
                </div>
                <button class="os-button" id="btn-tutorial-open-${this.id}">Reveal Full Tutorial</button>
            `;
        }

        return this._buildFullTutorial(caseData, pos);
    }

    _bindTutorialControls(body, caseData, pos) {
        const openBtn = body.querySelector(`#btn-tutorial-open-${this.id}`);
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                if (AudioController.click) AudioController.click();
                this._tutorialConfirming = true;
                this._renderBody();
            });
        }
        const yesBtn = body.querySelector(`#btn-tutorial-yes-${this.id}`);
        if (yesBtn) {
            yesBtn.addEventListener('click', () => {
                if (AudioController.click) AudioController.click();
                this._tutorialConfirming = false;
                this._tutorialRevealed = true;
                this._renderBody();
            });
        }
        const noBtn = body.querySelector(`#btn-tutorial-no-${this.id}`);
        if (noBtn) {
            noBtn.addEventListener('click', () => {
                if (AudioController.click) AudioController.click();
                this._tutorialConfirming = false;
                this._renderBody();
            });
        }
    }

    _buildFullTutorial(caseData, pos) {
        const evidence = pos.evidence;
        const puzzles = dataLoader.getPuzzles() || caseData.puzzles || [];
        const solution = dataLoader.getSolution ? dataLoader.getSolution() : caseData.solution;
        const suspects = caseData.suspects || [];
        const culprit = suspects.find(s => s.id === (solution?.culpritId));

        const evidenceSteps = evidence.map((e, i) => `
            <li style="margin-bottom:6px;"><strong>${e.title}</strong>${e.requiredFlag ? ` <span style="color: var(--text-muted); font-size:11px;">(unlocks on flag: ${e.requiredFlag})</span>` : ''}</li>
        `).join('');

        const puzzleSteps = puzzles.length
            ? puzzles.map(p => `<li style="margin-bottom:6px;">Terminal: <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 3px;">${p.triggerCommand}</code></li>`).join('')
            : `<li style="color: var(--text-muted);">No Terminal puzzle in this case — progression is driven entirely by Forensics/media reveals.</li>`;

        const recoverEntries = Object.entries(caseData.forensics?.recover || {});
        const recoverSteps = recoverEntries.length
            ? recoverEntries.map(([fileId, v]) => `<li style="margin-bottom:6px;">Forensics &gt; RECOVER: file-ID <code>${fileId}</code>, key <code>${v.recoveryKey}</code></li>`).join('')
            : '';

        const evidenceIdList = Array.isArray(solution?.evidenceIds) ? solution.evidenceIds : [solution?.evidenceId].filter(Boolean);
        const solutionEvidenceTitles = evidenceIdList.map(id => {
            const found = evidence.find(e => e.id === id);
            return found ? found.title : id;
        });

        return `
            <div style="border: 1px solid var(--status-success); padding: 14px; background: rgba(46,204,113,0.05);">
                <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color: var(--status-success); margin-bottom:10px;">Full Solution Path</div>

                <div style="color: var(--text-secondary); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin: 10px 0 4px;">1. Evidence, in unlock order</div>
                <ul style="margin:0; padding-left:18px; line-height:1.6; color: var(--text-primary);">${evidenceSteps}</ul>

                <div style="color: var(--text-secondary); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin: 14px 0 4px;">2. Terminal command(s)</div>
                <ul style="margin:0; padding-left:18px; line-height:1.6; color: var(--text-primary);">${puzzleSteps}</ul>

                ${recoverSteps ? `
                <div style="color: var(--text-secondary); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin: 14px 0 4px;">3. Forensics</div>
                <ul style="margin:0; padding-left:18px; line-height:1.6; color: var(--text-primary);">${recoverSteps}</ul>
                ` : ''}

                <div style="color: var(--text-secondary); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin: 14px 0 4px;">${recoverSteps ? '4' : '3'}. Submit Report</div>
                <div style="color: var(--text-primary); line-height:1.6;">
                    Suspect: <strong>${culprit ? culprit.name : (solution?.culpritId || '—')}</strong><br>
                    Evidence: <strong>${solutionEvidenceTitles.join(', ') || '—'}</strong>
                </div>
            </div>
        `;
    }

    // Render general OS & application system guide
    _renderSystemGuide(body) {
        const appRows = Object.keys(APP_LABELS).map(id => `
            <div style="display:flex; gap:10px; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
                <div style="min-width: 130px; color: var(--text-primary); font-weight: 600;">${APP_LABELS[id]}</div>
                <div style="color: var(--text-secondary); line-height:1.5;">${APP_BLURBS[id] || ''}</div>
            </div>
        `).join('');

        body.innerHTML = `
            <div style="color: var(--accent-blue); font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">System Guide</div>
            <h2 style="margin: 0 0 20px 0; color: var(--text-primary); font-size: 20px;">Getting Around HER STORY</h2>

            ${this._section('Windows', `
                <div style="line-height:1.7; color: var(--text-secondary);">
                    Drag a window by its title bar to move it. Drag any edge or corner to resize it —
                    the minimize button sends it to the taskbar, the maximize button fills the workspace
                    (click again to restore), and the close button ends the session for that app.
                    Click any window to bring it to the front.
                </div>
            `)}

            ${this._section('Desktop & Taskbar', `
                <div style="line-height:1.7; color: var(--text-secondary);">
                    Each app you've unlocked gets an icon on the desktop — double-click (or single-click,
                    depending on your Settings) to launch it. Icons can be dragged to any free grid cell;
                    right-click the desktop for more options (sort, arrange, wallpaper, appearance).
                    Anything currently open or minimized shows up as a running icon in the taskbar at the
                    bottom — click it to bring that window back.
                </div>
            `)}

            ${this._section('Notifications & Progress', `
                <div style="line-height:1.7; color: var(--text-secondary);">
                    New evidence, unlocked apps, and other events raise a notification in the tray —
                    click the bell icon in the taskbar to review your history. The Archive (top corner)
                    holds every case you've already closed, and Campaign Archive unlocks once you've
                    finished all cases.
                </div>
            `)}

            ${this._section('Applications', appRows)}

            ${this._section('Terminal Basics', `
                <div style="line-height:1.7; color: var(--text-secondary);">
                    The Terminal is a real shell, not a puzzle-only prop — type <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 3px;">help</code>
                    inside it any time for the commands available in the current case. Command syntax and
                    file names are usually surfaced elsewhere in the case first (Messages, Case Files,
                    Notes) — the Terminal is where you act on what you've already found, not where you
                    start looking.
                </div>
            `)}

            ${this._section('Stuck on a case?', `
                <div style="line-height:1.7; color: var(--text-secondary);">
                    Switch to the <strong style="color: var(--text-primary);">Case Guide</strong> tab above —
                    it tracks your current objective, which evidence is unlocked vs. still locked, offers
                    progressive hints tailored to exactly where you are in the case, and has a Full Tutorial
                    section if you want the complete solution path.
                </div>
            `)}
        `;
    }
}
