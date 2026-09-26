import { BaseApp } from '../BaseApp.js';
import { dataLoader } from '../../core/DataLoader.js';
import { stateManager } from '../../core/StateManager.js';
import { eventBus } from '../../core/EventBus.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const SUBMIT_SHELL_TEMPLATE_PATH = 'src/apps/Submit/SubmitApp.html';
export class SubmitApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
    }
    render() {
        if (this.element) return this.element;
        super.render();
        const contentArea = this.element.querySelector('.window-content');
        const suspects = dataLoader.getSuspects();
        let suspectOptions = `<option value="">-- Select Target --</option>`;
        suspects.forEach(s => {
            suspectOptions += `<option value="${s.id}">${s.name} (${s.role})</option>`;
        });
        const solutionPreview = dataLoader.getSolution();
        const isMultiEvidence = Array.isArray(solutionPreview?.evidenceIds);
        let evidenceFieldHtml;
        if (isMultiEvidence) {
            const caseData = stateManager.get('caseData');
            const ownItems = (dataLoader.getEvidence() || [])
                .filter(e => !e.requiredFlag || stateManager.hasFlag(e.requiredFlag))
                .map(e => ({ id: e.id, title: e.title, group: 'This Case' }));
            const crossItems = caseData?.showCrossCaseArchive
                ? stateManager.getCrossCaseEvidencePool().map(e => ({ id: e.id, title: e.title, group: e.sourceCaseTitle }))
                : [];
            const allItems = [...ownItems, ...crossItems];
            const groups = [];
            const groupIndex = {};
            allItems.forEach(item => {
                if (!(item.group in groupIndex)) {
                    groupIndex[item.group] = groups.length;
                    groups.push({ label: item.group, items: [] });
                }
                groups[groupIndex[item.group]].items.push(item);
            });
            const checkboxes = groups.map(g => `
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin: 10px 0 4px;">${g.label}</div>
                ${g.items.map(item => `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;">
                        <input type="checkbox" class="submit-evidence-checkbox-${this.id}" value="${item.id}" />
                        <span>${item.title}</span>
                    </label>
                `).join('')}
            `).join('');
            evidenceFieldHtml = `
                <div class="form-group">
                    <label class="form-label">Supporting Evidence (select all that apply)</label>
                    <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--border-subtle); padding: 8px 10px;">
                        ${checkboxes || '<div style="color: var(--text-muted); font-size: 12px;">No evidence available.</div>'}
                    </div>
                </div>
            `;
        } else {
            // Build Evidence Options (Only show evidence the player has actually unlocked)
            const evidence = dataLoader.getEvidence();
            let evidenceOptions = `<option value="">-- Select Proof --</option>`;
            evidence.forEach(e => {
                const isLocked = e.requiredFlag && !stateManager.hasFlag(e.requiredFlag);
                if (!isLocked) {
                    evidenceOptions += `<option value="${e.id}">${e.title}</option>`;
                }
            });
            evidenceFieldHtml = `
                <div class="form-group">
                    <label class="form-label">Supporting Evidence</label>
                    <select class="os-select" id="select-evidence-${this.id}">
                        ${evidenceOptions}
                    </select>
                </div>
            `;
        }
        const template = TemplateLoader.getSync(SUBMIT_SHELL_TEMPLATE_PATH);
        contentArea.innerHTML = template
            .replaceAll('{{id}}', this.id)
            .replace('{{suspectOptions}}', suspectOptions)
            .replace('{{evidenceFieldHtml}}', evidenceFieldHtml);
        this._bindSubmitEvent(contentArea, isMultiEvidence);
        return this.element;
    }
    _bindSubmitEvent(contentArea, isMultiEvidence) {
        const btn = contentArea.querySelector(`#btn-submit-case-${this.id}`);
        const suspectSelect = contentArea.querySelector(`#select-suspect-${this.id}`);
        const evidenceSelect = isMultiEvidence ? null : contentArea.querySelector(`#select-evidence-${this.id}`);
        const resultDiv = contentArea.querySelector(`#submit-result-${this.id}`);
        const formDiv = contentArea.querySelector(`#submit-form-${this.id}`);
        btn.addEventListener('click', () => {
            const selectedSuspect = suspectSelect.value;
            const solution = dataLoader.getSolution();
            let selectedEvidence = null;
            let selectedEvidenceIds = null;
            if (isMultiEvidence) {
                selectedEvidenceIds = Array.from(contentArea.querySelectorAll(`.submit-evidence-checkbox-${this.id}:checked`)).map(cb => cb.value);
            } else {
                selectedEvidence = evidenceSelect.value;
            }
            const missingParams = isMultiEvidence
                ? (!selectedSuspect || selectedEvidenceIds.length === 0)
                : (!selectedSuspect || !selectedEvidence);
            if (missingParams) {
                resultDiv.textContent = "ERR: Incomplete parameters.";
                resultDiv.style.color = "var(--status-error)";
                resultDiv.classList.remove('hidden');
                return;
            }
            const evidenceMatches = isMultiEvidence
                ? (selectedEvidenceIds.length === solution.evidenceIds.length &&
                   selectedEvidenceIds.every(id => solution.evidenceIds.includes(id)))
                : (selectedEvidence === solution.evidenceId);
            if (selectedSuspect === solution.culpritId && evidenceMatches) {
                if (Array.isArray(solution.unlocks)) {
                    solution.unlocks.forEach(appId => stateManager.unlockApp(appId));
                }
                eventBus.emit('CASE_SOLVED', { caseId: stateManager.get('currentCase') });
                formDiv.classList.add('fade-out');
                setTimeout(() => {
                    formDiv.classList.add('hidden');
                    let successHTML = `${solution.successMessage}`;
                    if (solution.nextCase) {
                        const isCampaignEnd = solution.nextCase === 'END_OF_CAMPAIGN';
                        successHTML += `\n\n<button class="os-button" id="btn-next-case" style="width: 100%;">${isCampaignEnd ? 'CLOSE OUT OPERATION' : 'INITIALIZE NEXT DOSSIER'}</button>`;
                    }
                    resultDiv.innerHTML = successHTML;
                    resultDiv.style.color = "var(--status-success)";
                    resultDiv.classList.remove('hidden');
                    resultDiv.classList.add('fade-in');
                    if (solution.nextCase) {
                        this.element.querySelector('#btn-next-case').addEventListener('click', () => {
                            if (solution.nextCase === 'END_OF_CAMPAIGN') {
                                eventBus.emit('CAMPAIGN_COMPLETE', { epilogueText: solution.successMessage });
                                return;
                            }
                            eventBus.emit('REQUEST_CASE_SWITCH', { caseId: solution.nextCase, resetProgress: true });
                        });
                    }
                }, 800);
            } else {
                resultDiv.textContent = "ERR: Causality mismatch. Logic rejected by system.";
                resultDiv.style.color = "var(--status-error)";
                resultDiv.classList.remove('hidden');
            }
        });
    }
}
