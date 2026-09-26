import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const ARCHIVE_SHELL_TEMPLATE_PATH = 'src/apps/Archive/ArchiveApp.html';
export class ArchiveApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeRecord = null;
        const caseData = stateManager.get('caseData');
        this.records = caseData?.archive || [];
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--reset');
            const initialMessage = this.records.length ? 'SELECT AN ARCHIVED RECORD FROM THE SIDEBAR TO REVIEW.' : 'ARCHIVE DATABASE IS EMPTY.';
            const template = TemplateLoader.getSync(ARCHIVE_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{initialMessage}}', initialMessage);
            this._renderList(this.records);
            this._bindAppEvents();
        }
        return this.element;
    }
    _bindAppEvents() {
        const searchInput = this.element.querySelector(`#archive-search-${this.id}`);
        if (!searchInput) return;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = this.records.filter(rec =>
                (rec.title || '').toLowerCase().includes(query) ||
                (rec.summary || '').toLowerCase().includes(query) ||
                (rec.commentary || '').toLowerCase().includes(query)
            );
            this._renderList(filtered);
        });
    }
    _renderList(data) {
        const listEl = this.element.querySelector(`#archive-list-${this.id}`);
        if (!listEl) return;
        listEl.innerHTML = '';
        data.forEach(rec => {
            const isActive = this.activeRecord && this.activeRecord.id === rec.id;
            const item = this._renderListItem({
                active: isActive,
                innerHtml: `<div style="color: ${isActive ? 'var(--accent-blue)' : 'var(--text-primary)'}; font-weight: bold; font-size: 13px;">${rec.title}</div><div style="font-size: 10px; color: var(--status-success); margin-top: 4px;">${rec.status}</div>`,
                onClick: () => {
                    this._loadRecord(rec);
                    this._renderList(data);
                }
            });
            listEl.appendChild(item);
        });
    }
    _loadRecord(rec) {
        this.activeRecord = rec;
        const viewport = this.element.querySelector(`#archive-viewport-${this.id}`);
        if (!viewport) return;
        viewport.innerHTML = `
            <div style="animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 20px; max-width: 700px;">
                <div>
                    <div style="font-size: 11px; color: var(--status-success); text-transform: uppercase; margin-bottom: 5px;">${rec.status} // ${rec.date}</div>
                    <h2 style="color: var(--accent-blue); margin: 0 0 15px 0; font-size: 22px;">${rec.title}</h2>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 20px; font-size: 14px; line-height: 1.6; color: var(--text-primary);">
                    <span style="color: var(--text-secondary); font-size: 11px; display: block; margin-bottom: 8px;">CASE SUMMARY:</span>
                    ${rec.summary}
                </div>
                <div style="background: rgba(0, 195, 255, 0.03); border-left: 3px solid var(--accent-blue); padding: 15px; font-size: 12px; line-height: 1.5; color: var(--text-secondary);">
                    ${rec.commentary}
                </div>
                ${(rec.relatedTo && rec.relatedTo.length) ? `
                <div>
                    <span style="color: var(--text-secondary); font-size: 11px; display: block; margin-bottom: 8px;">RELATED RECORDS:</span>
                    <div id="archive-related-${this.id}" style="display: flex; flex-direction: column; gap: 6px;">
                        ${rec.relatedTo.map(relId => {
                            const relRec = this.records.find(r => r.id === relId);
                            if (!relRec) return '';
                            return `<div class="archive-related-link" data-rel-id="${relId}" style="cursor: pointer; padding: 8px 12px; border: 1px solid var(--border-subtle); color: var(--accent-blue); font-size: 12px; background: rgba(0,0,0,0.2);">&rarr; ${relRec.title}</div>`;
                        }).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        this._bindRelatedLinks();
    }
    _bindRelatedLinks() {
        const links = this.element.querySelectorAll('.archive-related-link');
        links.forEach(link => {
            link.addEventListener('click', () => {
                const relId = link.getAttribute('data-rel-id');
                const relRec = this.records.find(r => r.id === relId);
                if (relRec) {
                    this._loadRecord(relRec);
                    this._renderList(this.records);
                }
            });
        });
    }
}
