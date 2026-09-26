import { BaseApp } from '../BaseApp.js';
import { stateManager } from '../../core/StateManager.js';
import { eventBus } from '../../core/EventBus.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';

const CASE_ARCHIVE_SHELL_TEMPLATE_PATH = 'src/apps/CaseArchive/CaseArchiveApp.html';

export class CaseArchiveApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.minWidth = 480;
        this.minHeight = 360;
    }

    render() {
        if (this.element) return this.element;
        super.render();

        const contentArea = this.element.querySelector('.window-content');
        contentArea.classList.add('app-content-area--reset');
        const template = TemplateLoader.getSync(CASE_ARCHIVE_SHELL_TEMPLATE_PATH);
        contentArea.innerHTML = template.replaceAll('{{id}}', this.id);

        this._renderList();
        return this.element;
    }

    _renderList() {
        const listEl = this.element.querySelector(`#case-archive-list-${this.id}`);
        if (!listEl) return;

        const completed = stateManager.get('completed_cases') || [];
        listEl.innerHTML = '';

        if (completed.length === 0) {
            listEl.innerHTML = `<div style="color: var(--text-muted); text-align:center; padding: 40px; font-style: italic;">No investigations archived yet.</div>`;
            return;
        }

        completed.forEach(record => {
            const item = this._renderListItem({
                active: false,
                innerHtml: `
                    <div style="color: var(--text-primary); font-weight: bold; font-size: 13px;">${record.title || record.id}</div>
                    <div style="font-size: 10px; color: var(--status-success); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Closed — Replay Available</div>
                `,
                onClick: () => this._replay(record.id)
            });
            listEl.appendChild(item);
        });
    }

    _replay(caseId) {
        const currentCase = stateManager.get('currentCase');
        if (currentCase === caseId) return;

        eventBus.emit('REQUEST_CASE_SWITCH', { caseId, resetProgress: true });
        this.close();
    }
}
