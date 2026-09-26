import { BaseApp } from '../BaseApp.js';
import { stateManager } from '../../core/StateManager.js';
import { dataLoader } from '../../core/DataLoader.js';
import { eventBus } from '../../core/EventBus.js';
import { AudioController } from '../../core/AudioController.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';

const CASE_FILES_TEMPLATE_PATH = 'src/apps/CaseFiles/CaseFilesApp.html';

export class CaseFilesApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeDocId = null;
        const caseData = stateManager.get('caseData');
        this.showCrossCaseArchive = !!(caseData && caseData.showCrossCaseArchive);
    }

    render() {
        if (this.element) return this.element;
        super.render();

        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex');
            const template = TemplateLoader.getSync(CASE_FILES_TEMPLATE_PATH);
            const crossCaseSection = this.showCrossCaseArchive
                ? `<div class="cfl-s3" style="margin-top:16px;">PRIOR CASE ARCHIVE</div><div class="cfl-s4" id="case-files-crosscase-list-${this.id}"></div>`
                : '';
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{crossCaseSection}}', crossCaseSection)
                .replace('{{initialMessage}}', 'Select a document to begin reading.');

            this._loadCategories();
            this._bindCaseEvents();
        }
        return this.element;
    }

    // NOTE: intentionally not named `_bindEvents` — BaseApp.render() calls
    // `this._bindEvents()` polymorphically to wire up window dragging and
    // the close/minimize/maximize buttons. A same-named override here would
    // shadow that base wiring and silently break the window chrome.
    _bindCaseEvents() {
        this._unsubCase = eventBus.on('CASE_LOADED', () => this._loadCategories());
    }

    // Called by main.js whenever a FLAG_UNLOCKED event may have revealed
    // new evidence while this app is open.
    refresh() {
        this._loadCategories();
    }

    _onClose() {
        if (this._unsubCase) this._unsubCase();
        super._onClose();
    }

    _loadCategories() {
        const caseData = stateManager.get('caseData');
        // Evidence unlocking follows the same requiredFlag/hasFlag convention
        // used everywhere else (SubmitApp, HelpApp, DevTools) — case JSON
        // stores documents under `evidence`, not a separate `documents` list,
        // and there is no standalone `unlockedDocuments` state key.
        const allDocs = caseData?.evidence || [];
        const unlockedDocs = allDocs.filter(e => !e.requiredFlag || stateManager.hasFlag(e.requiredFlag));
        const lockedDocs = allDocs.filter(e => e.requiredFlag && !stateManager.hasFlag(e.requiredFlag));

        const catContainer = this.element.querySelector(`#case-files-list-${this.id}`);
        if (!catContainer) return;
        this._renderDocList(catContainer, unlockedDocs);
        // Locked evidence still shows in the list (title only, no content) so
        // operators know more is out there — matches the pattern already used
        // by HelpApp's "Evidence — Still Locked" section.
        this._renderDocList(catContainer, lockedDocs, { locked: true, append: true });

        if (this.showCrossCaseArchive) {
            const crossContainer = this.element.querySelector(`#case-files-crosscase-list-${this.id}`);
            if (crossContainer) {
                const crossCaseDocs = stateManager.getCrossCaseEvidencePool().map(e => ({
                    ...e,
                    content: e.summary || e.content || ''
                }));
                this._renderDocList(crossContainer, crossCaseDocs);
            }
        }

        if (unlockedDocs.length > 0 && !this.activeDocId) {
            const firstDoc = unlockedDocs[0];
            this.activeDocId = firstDoc.id;
            const firstItem = catContainer.querySelector('.case-files-item:not(.locked)');
            if (firstItem) firstItem.classList.add('active');
            this._loadDocument(firstDoc);
        }
    }

    _renderDocList(container, docs, { locked = false, append = false } = {}) {
        if (!append) container.innerHTML = '';
        docs.forEach(doc => {
            const item = document.createElement('div');
            item.className = locked ? 'case-files-item locked' : 'case-files-item';
            if (!locked && this.activeDocId === doc.id) item.classList.add('active');
            item.dataset.docId = doc.id;
            item.innerHTML = `<span class="icon">${locked ? '🔒' : '📄'}</span> ${doc.title}`;

            if (locked) {
                item.title = 'Still classified — keep investigating to unlock this file.';
            } else {
                item.addEventListener('click', () => {
                    this.element.querySelectorAll('.case-files-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    this.activeDocId = doc.id;
                    this._loadDocument(doc);
                });
            }

            container.appendChild(item);
        });
    }

    _loadDocument(doc) {
        eventBus.emit('DOCUMENT_OPENED', { docId: doc.id });
        const readerEl = this.element.querySelector(`#case-files-reader-${this.id}`);
        if (!readerEl) return;

        readerEl.innerHTML = `
            <div style="animation: fadeIn 0.3s ease-out; max-width: 800px; margin: 0 auto;">
                <h2 style="color: var(--accent-blue); text-transform: uppercase; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px; margin-top: 0; letter-spacing: 1px;">${doc.title}</h2>
                <div style="color: var(--text-secondary); margin-bottom: 25px; font-size: 12px; font-weight: bold;">CLASSIFICATION: <span style="color: var(--status-error);">RESTRICTED</span></div>
                <div style="color: var(--text-primary); text-align: justify; font-size: 14px;">${doc.content}</div>
            </div>
        `;

        this._bindEvidenceLinks();
    }

    _bindEvidenceLinks() {
        const links = this.element.querySelectorAll('.evidence-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                // Resolve target evidence element
                const target = e.target.closest('.evidence-link');
                if (!target) return;

                const evidenceId = target.getAttribute('data-evidence-id');
                const evidenceText = target.innerText;
                const evidenceType = target.getAttribute('data-evidence-type') || 'Document';

                if (!target.classList.contains('bookmarked')) {
                    if (typeof AudioController !== 'undefined' && AudioController.success) AudioController.success();
                    target.classList.add('bookmarked');
                    eventBus.emit('EVIDENCE_BOOKMARKED', {
                        id: evidenceId,
                        text: evidenceText,
                        source: `Case Files: ${this.activeDocId}`,
                        type: evidenceType
                    });
                    this._spawnTooltip(e.clientX, e.clientY, "BOOKMARKED TO LOCKER");
                }
            });
        });
    }

    _spawnTooltip(x, y, text) {
        const tip = document.createElement('div');
        tip.textContent = text;
        tip.style.cssText = `position: fixed; top: ${y - 30}px; left: ${x + 10}px; background: #2ecc71; color: #000; font-family: var(--font-mono); font-size: 11px; padding: 4px 8px; font-weight: bold; border-radius: 2px; pointer-events: none; z-index: 9999; animation: floatUp 1s ease-out forwards;`;
        document.body.appendChild(tip);

        if (!document.getElementById('float-anim-style')) {
            const style = document.createElement('style');
            style.id = 'float-anim-style';
            style.innerHTML = `@keyframes floatUp { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }`;
            document.head.appendChild(style);
        }
        setTimeout(() => tip.remove(), 1000);
    }
}
