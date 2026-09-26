import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { eventBus } from '../../core/EventBus.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';

const LOCKER_SHELL_TEMPLATE_PATH = 'src/apps/Locker/LockerApp.html';

export class LockerApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.evidence = stateManager.get('collected_evidence') || [];
        this.filter = 'all';
        this._onEvidenceBookmarked = () => {
            this.evidence = stateManager.get('collected_evidence') || [];
            if (this.element) this._renderGrid();
        };
        eventBus.on('EVIDENCE_BOOKMARKED', this._onEvidenceBookmarked);
    }
    _onClose() {
        eventBus.off('EVIDENCE_BOOKMARKED', this._onEvidenceBookmarked);
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex-layered');
            const filterButtons = [
                this._createFilterBtn('all', 'All Evidence'),
                this._createFilterBtn('Document', 'Documents'),
                this._createFilterBtn('Image', 'Media / Imagery'),
                this._createFilterBtn('Comm', 'Intercepts'),
                this._createFilterBtn('Physical', 'Physical Traces')
            ].join('\n                            ');
            const template = TemplateLoader.getSync(LOCKER_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{filterButtons}}', filterButtons);
            this._bindFilters();
            this._renderGrid();
        }
        return this.element;
    }
    _createFilterBtn(id, label) {
        return this._createSidebarBtn('locker-filter-btn', 'filter', id, label);
    }
    _bindFilters() {
        const btns = this.element.querySelectorAll('.locker-filter-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (typeof AudioController !== 'undefined' && AudioController.hover) AudioController.hover();
                this.filter = e.target.getAttribute('data-filter');
                this._renderGrid();
            });
        });
    }
    _renderGrid() {
        const gridEl = this.element.querySelector(`#locker-grid-${this.id}`);
        const emptyEl = this.element.querySelector(`#locker-empty-${this.id}`);
        const btns = this.element.querySelectorAll('.locker-filter-btn');
        if (!gridEl || !emptyEl) return;
        btns.forEach(btn => {
            if (btn.getAttribute('data-filter') === this.filter) {
                btn.style.borderLeft = '3px solid var(--accent-blue)';
                btn.style.background = 'rgba(0,0,0,0.4)';
                btn.style.color = 'var(--accent-blue)';
            } else {
                btn.style.borderLeft = '3px solid transparent';
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-primary)';
            }
        });
        gridEl.innerHTML = '';
        const filtered = this.filter === 'all' ? this.evidence : this.evidence.filter(e => e.type === this.filter);
        if (filtered.length === 0) {
            gridEl.style.display = 'none';
            emptyEl.style.display = 'flex';
            return;
        }
        gridEl.style.display = 'grid';
        emptyEl.style.display = 'none';
        filtered.forEach(ev => {
            const card = document.createElement('div');
            card.style.cssText = `background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 15px; display: flex; flex-direction: column; animation: fadeIn 0.3s ease-out; position: relative;`;
            card.innerHTML = `
                <div style="font-size: 10px; color: var(--accent-blue); border-bottom: 1px solid var(--border-subtle); padding-bottom: 5px; margin-bottom: 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>${ev.id}</span>
                    <button class="pin-note-btn sys-button" style="padding: 2px 6px; font-size: 9px;" title="Pin as Sticky Note to Desktop">📌 PIN</button>
                </div>
                <div style="flex: 1; color: var(--text-primary); font-size: 12px; line-height: 1.5; margin-bottom: 15px;">
                    "${ev.text}"
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: auto; padding-top: 10px; border-top: 1px dashed var(--border-subtle);">
                    SRC: ${ev.source}
                </div>
            `;

            const pinBtn = card.querySelector('.pin-note-btn');
            if (pinBtn) {
                pinBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (AudioController.bookmark) AudioController.bookmark();
                    eventBus.emit('PIN_STICKY_NOTE', {
                        title: `EVIDENCE ${ev.id}`,
                        text: `"${ev.text}"\n\nSRC: ${ev.source}`
                    });
                });
            }

            gridEl.appendChild(card);
        });
    }
}
