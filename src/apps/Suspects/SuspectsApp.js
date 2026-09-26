import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const SUSPECTS_SHELL_TEMPLATE_PATH = 'src/apps/Suspects/SuspectsApp.html';
export class SuspectsApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeSuspectId = null;
        const caseData = stateManager.get('caseData');
        this.suspects = caseData?.suspects || [];
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex');
            const initialMessage = this.suspects.length ? 'AWAITING OSINT QUERY...' : 'NO SUSPECTS IDENTIFIED';
            const template = TemplateLoader.getSync(SUSPECTS_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{initialMessage}}', initialMessage);
            this._renderList(this.suspects);
            this._bindAppEvents();
        }
        return this.element;
    }
    _renderList(data) {
        const listEl = this.element.querySelector(`#suspect-list-${this.id}`);
        if (!listEl) return;
        listEl.innerHTML = '';
        data.forEach(suspect => {
            const isActive = this.activeSuspectId === suspect.id;
            const item = this._renderListItem({
                active: isActive,
                innerHtml: `<div style="color: ${isActive ? 'var(--accent-blue)' : 'var(--text-primary)'}; font-weight: bold; letter-spacing: 1px;">${suspect.name}</div><div style="font-size: 0.8em; color: var(--text-secondary); margin-top: 4px;">ID: ${suspect.id}</div>`,
                onClick: () => {
                    this.activeSuspectId = suspect.id;
                    this._renderList(this.suspects);
                    this._showDossier(suspect);
                }
            });
            listEl.appendChild(item);
        });
    }
    _showDossier(suspect) {
        const dossierEl = this.element.querySelector(`#suspect-dossier-${this.id}`);
        if (!dossierEl) return;
        const status = suspect.status || 'UNVERIFIED';
        const occupation = suspect.occupation || suspect.role || 'UNKNOWN';
        const threat = suspect.threat || 'UNASSESSED';
        const notes = suspect.notes || 'No analyst notes on file for this individual.';
        const threatColor = (threat === 'Critical' || threat === 'Severe') ? 'var(--status-error)' : (threat === 'High' ? 'var(--status-warning)' : 'var(--accent-blue)');
        const formatList = (arr) => (arr && arr.length) ? arr.map(i => `<div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">&bull; ${i}</div>`).join('') : '<div style="color: var(--text-muted); font-style: italic;">None on file.</div>';
        const connectionsHtml = (suspect.connections || []).map(connId => {
            const connPerson = this.suspects.find(s => s.id === connId);
            if (!connPerson) return '';
            return `<button class="suspect-conn-btn" data-id="${connId}" style="background: var(--bg-void); border: 1px solid var(--border-subtle); color: var(--accent-blue); padding: 4px 8px; cursor: pointer; font-family: var(--font-mono); font-size: 11px; margin-right: 5px;">🔗 ${connPerson.name}</button>`;
        }).join('');
        dossierEl.innerHTML = `
            <div style="animation: fadeIn 0.3s ease-out; width: 100%; max-width: 800px; margin: 0 auto;">
                <div style="display: flex; gap: 25px; margin-bottom: 25px; padding-bottom: 25px; border-bottom: 1px solid var(--border-subtle);">
                    <div style="width: 140px; height: 140px; border: 1px solid var(--border-subtle); background: var(--bg-surface); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                        ${suspect.photo || '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'}
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <h2 style="margin: 0 0 10px 0; color: var(--accent-blue); text-transform: uppercase; font-size: 28px; letter-spacing: 2px;">${suspect.name}</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px;">
                            <div><span style="color: var(--text-secondary);">ID NO:</span><br>${suspect.id}</div>
                            <div><span style="color: var(--text-secondary);">STATUS:</span><br>${status}</div>
                            <div style="grid-column: span 2;"><span style="color: var(--text-secondary);">OCCUPATION:</span><br>${occupation}</div>
                        </div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                    <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); padding: 15px; font-size: 12px;">
                        <div style="color: var(--text-secondary); margin-bottom: 10px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 5px;">KNOWN ALIASES</div>
                        ${formatList(suspect.aliases)}
                    </div>
                    <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); padding: 15px; font-size: 12px;">
                        <div style="color: var(--text-secondary); margin-bottom: 10px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 5px;">REGISTERED DEVICES</div>
                        ${formatList(suspect.devices)}
                    </div>
                    <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); padding: 15px; font-size: 12px;">
                        <div style="color: var(--text-secondary); margin-bottom: 10px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 5px;">FREQUENT LOCATIONS</div>
                        ${formatList(suspect.locations)}
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div style="font-size: 13px;">
                        <span style="color: var(--text-secondary); display: block; margin-bottom: 8px;">RELATIONSHIPS / CONNECTIONS:</span>
                        ${connectionsHtml || '<span style="color: var(--text-muted);">No known connections.</span>'}
                    </div>
                    <div style="background: rgba(0,0,0,0.3); border-left: 3px solid ${threatColor}; padding: 15px; font-size: 13px; line-height: 1.6;">
                        <span style="color: ${threatColor}; font-weight: bold; margin-bottom: 8px; display: block;">OSINT NOTES // THREAT: ${threat}</span>
                        ${notes}
                    </div>
                </div>
            </div>
        `;
        const connBtns = dossierEl.querySelectorAll('.suspect-conn-btn');
        connBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
                const targetId = e.target.getAttribute('data-id');
                const targetSuspect = this.suspects.find(s => s.id === targetId);
                if (targetSuspect) {
                    this.activeSuspectId = targetId;
                    this._renderList(this.suspects);
                    this._showDossier(targetSuspect);
                }
            });
        });
    }
    _bindAppEvents() {
        const searchInput = this.element.querySelector(`#suspect-search-${this.id}`);
        if (!searchInput) return;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = this.suspects.filter(s => 
                s.name.toLowerCase().includes(query) || 
                s.id.toLowerCase().includes(query) || 
                (s.aliases && s.aliases.some(alias => alias.toLowerCase().includes(query)))
            );
            this._renderList(filtered);
        });
    }
}
