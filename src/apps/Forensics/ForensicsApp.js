import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const FORENSICS_SHELL_TEMPLATE_PATH = 'src/apps/Forensics/ForensicsApp.html';
export class ForensicsApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeModule = 'afis';
        // The AFIS module lays out a 220px sidebar plus two fixed-width
        // (160px + 180px) columns side by side; once padding/borders and
        // .window-content's 24px inset are counted, that needs ~745px of
        // window width to fit without a horizontal scrollbar cutting it off.
        this.minWidth = 760;
        this.minHeight = 480;
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--reset');
            const moduleButtons = [
                this._createModuleBtn('afis', 'AFIS // Biometrics'),
                this._createModuleBtn('hash', 'MD5 // Hash Compare'),
                this._createModuleBtn('chem', 'CHEM // Spectrogram'),
                this._createModuleBtn('recover', 'RECOVER // Signal Reconstruction')
            ].join('\n                            ');
            const template = TemplateLoader.getSync(FORENSICS_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{moduleButtons}}', moduleButtons);
            this._bindModules();
            this._loadModule(this.activeModule);
        }
        return this.element;
    }
    _createModuleBtn(id, label) {
        return this._createSidebarBtn('forensics-mod-btn', 'module', id, label);
    }
    _bindModules() {
        const btns = this.element.querySelectorAll('.forensics-mod-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (typeof AudioController !== 'undefined' && AudioController.hover) AudioController.hover();
                this.activeModule = e.target.getAttribute('data-module');
                btns.forEach(b => {
                    b.style.borderLeft = '3px solid transparent';
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-primary)';
                });
                e.target.style.borderLeft = '3px solid var(--accent-blue)';
                e.target.style.background = 'rgba(0,0,0,0.4)';
                e.target.style.color = 'var(--accent-blue)';
                this._loadModule(this.activeModule);
            });
        });
        const initialBtn = this.element.querySelector(`[data-module="${this.activeModule}"]`);
        if (initialBtn) {
            initialBtn.style.borderLeft = '3px solid var(--accent-blue)';
            initialBtn.style.background = 'rgba(0,0,0,0.4)';
            initialBtn.style.color = 'var(--accent-blue)';
        }
    }
    _loadModule(moduleId) {
        const stage = this.element.querySelector(`#forensics-stage-${this.id}`);
        if (!stage) return;
        switch(moduleId) {
            case 'afis': stage.innerHTML = this._getAFISLayout(); this._bindAFIS(); break;
            case 'hash': stage.innerHTML = this._getHashLayout(); this._bindHash(); break;
            case 'chem': stage.innerHTML = this._getChemLayout(); this._bindChem(); break;
            case 'recover': stage.innerHTML = this._getRecoverLayout(); this._bindRecover(); break;
        }
    }
    _getAFISLayout() {
        return `
            <div style="padding: 25px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; animation: fadeIn 0.3s ease-out;">
                <div style="margin-bottom: 20px; color: var(--text-secondary); font-size: 13px; letter-spacing: 1px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">AUTOMATED FINGERPRINT IDENTIFICATION SYSTEM</div>
                <div style="display: flex; gap: 30px; flex: 1; align-items: center; justify-content: center;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <input type="text" id="afis-input-${this.id}" placeholder="ENTER EVID-ID" style="text-align: center; width: 160px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--accent-blue); padding: 10px; font-family: var(--font-mono); outline: none;">
                        <div style="width: 160px; height: 180px; border: 1px solid var(--accent-blue); background: rgba(0, 195, 255, 0.05); display: flex; align-items: center; justify-content: center; position: relative;">
                            <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="var(--accent-blue)" stroke-width="1"><path d="M12 2a10 10 0 0 0-10 10v2a10 10 0 0 0 10 10 10 10 0 0 0 10-10v-2a10 10 0 0 0-10-10z"></path><path d="M8 12a4 4 0 0 1 8 0"></path><path d="M12 16v-4"></path></svg>
                        </div>
                    </div>
                    <button id="afis-run-${this.id}" class="os-button" style="padding: 10px 20px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary); cursor: pointer;">INITIATE QUERY</button>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <div id="afis-result-box-${this.id}" style="width: 180px; height: 232px; border: 1px dashed var(--border-subtle); background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); font-size: 11px; padding: 15px;">AWAITING QUERY</div>
                    </div>
                </div>
            </div>
        `;
    }
    _bindAFIS() {
        const runBtn = this.element.querySelector(`#afis-run-${this.id}`);
        const input = this.element.querySelector(`#afis-input-${this.id}`);
        const resultBox = this.element.querySelector(`#afis-result-box-${this.id}`);
        if (!runBtn) return;
        runBtn.addEventListener('click', () => {
            const val = input.value.trim().toUpperCase();
            if (!val) return;
            if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
            runBtn.disabled = true;
            resultBox.innerHTML = `<span style="color: var(--accent-blue); animation: blink 1s infinite;">QUERYING DB...</span>`;
            setTimeout(() => {
                runBtn.disabled = false;
                const caseData = stateManager.get('caseData')?.forensics?.afis || {};
                if (caseData[val]) {
                    if (typeof AudioController !== 'undefined' && AudioController.success) AudioController.success();
                    resultBox.style.borderColor = "var(--status-success)";
                    resultBox.style.background = "rgba(46, 204, 113, 0.1)";
                    resultBox.innerHTML = `<div style="color: var(--status-success); font-weight: bold; margin-bottom: 10px;">MATCH FOUND</div><div style="color: #fff; font-size: 12px; margin-bottom: 5px;">${caseData[val].name}</div><div style="color: var(--text-secondary); font-size: 10px;">ID: ${caseData[val].recordId}</div>`;
                } else {
                    if (typeof AudioController !== 'undefined' && AudioController.error) AudioController.error();
                    resultBox.style.borderColor = "var(--status-error)";
                    resultBox.style.background = "rgba(0,0,0,0.3)";
                    resultBox.innerHTML = `<span style="color: var(--status-error);">NO MATCH FOUND IN DATABASE.</span>`;
                }
            }, 1500);
        });
    }
    _getHashLayout() {
        return `
            <div style="padding: 25px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; animation: fadeIn 0.3s ease-out;">
                <div style="margin-bottom: 20px; color: var(--text-secondary); font-size: 13px; letter-spacing: 1px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">FILE HASH INTEGRITY VERIFIER</div>
                <div style="display: flex; flex-direction: column; gap: 20px; max-width: 500px; margin: 0 auto; width: 100%; margin-top: 20px;">
                    <div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">INPUT MD5/SHA256 HASH</div>
                        <input type="text" id="hash-input-${this.id}" placeholder="e.g., e99a18c428..." style="width: 100%; box-sizing: border-box; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--accent-blue); padding: 10px; font-family: var(--font-mono); outline: none; text-transform: lowercase;">
                    </div>
                    <button id="hash-run-${this.id}" class="os-button" style="padding: 10px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary); cursor: pointer;">COMPARE AGAINST REGISTRY</button>
                    <div id="hash-result-${this.id}" style="min-height: 80px; border: 1px dashed var(--border-subtle); padding: 15px; font-size: 12px; color: var(--text-muted); background: rgba(0,0,0,0.2);">WAITING FOR INPUT...</div>
                </div>
            </div>
        `;
    }
    _bindHash() {
        const runBtn = this.element.querySelector(`#hash-run-${this.id}`);
        const input = this.element.querySelector(`#hash-input-${this.id}`);
        const result = this.element.querySelector(`#hash-result-${this.id}`);
        if (!runBtn) return;
        runBtn.addEventListener('click', () => {
            const val = input.value.trim().toLowerCase();
            if (!val) return;
            if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
            result.innerHTML = `<span style="color: var(--accent-blue);">CHECKING REGISTRY...</span>`;
            setTimeout(() => {
                const caseData = stateManager.get('caseData')?.forensics?.hash || {};
                if (caseData[val]) {
                    if (typeof AudioController !== 'undefined' && AudioController.success) AudioController.success();
                    result.innerHTML = `<span style="color: var(--status-error); font-weight: bold;">MATCH FOUND IN MALWARE REGISTRY</span><br><br>ORIGIN: ${caseData[val].origin}<br>PAYLOAD: ${caseData[val].payload}`;
                    result.style.borderColor = "var(--status-error)";
                    if (caseData[val].resultingFlag) stateManager.unlockFlag(caseData[val].resultingFlag);
                } else {
                    if (typeof AudioController !== 'undefined' && AudioController.error) AudioController.error();
                    result.innerHTML = `<span style="color: var(--status-warning);">FILE HASH CLEAN. NO REGISTRY MATCH.</span>`;
                    result.style.borderColor = "var(--border-subtle)";
                }
            }, 1000);
        });
    }
    _getChemLayout() {
        return `
            <div style="padding: 25px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; animation: fadeIn 0.3s ease-out;">
                <div style="margin-bottom: 20px; color: var(--text-secondary); font-size: 13px; letter-spacing: 1px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">MASS SPECTROMETRY ANALYSIS</div>
                <div style="display: flex; flex-direction: column; gap: 20px; flex: 1;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="text" id="chem-input-${this.id}" placeholder="ENTER EVID-ID" style="width: 200px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--accent-blue); padding: 10px; font-family: var(--font-mono); outline: none;">
                        <button id="chem-run-${this.id}" class="os-button" style="padding: 10px 20px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary); cursor: pointer;">ANALYZE SAMPLE</button>
                    </div>
                    <div style="flex: 1; border: 1px solid var(--border-subtle); background: var(--bg-surface); position: relative; overflow: hidden; display: flex; align-items: flex-end; padding: 0 20px;">
                        <div id="chem-spectrum-${this.id}" style="width: 100%; height: 100%; display: flex; align-items: flex-end; opacity: 0; transition: opacity 0.5s;">
                            <div style="width: 15%; height: 40%; background: rgba(0, 195, 255, 0.4); margin-right: 5px;"></div>
                            <div style="width: 10%; height: 85%; background: rgba(0, 195, 255, 0.8); margin-right: 5px;"></div>
                            <div style="width: 5%; height: 20%; background: rgba(0, 195, 255, 0.3); margin-right: 5px;"></div>
                            <div style="width: 20%; height: 60%; background: rgba(0, 195, 255, 0.6); margin-right: 5px;"></div>
                            <div style="width: 8%; height: 95%; background: rgba(0, 195, 255, 0.9); margin-right: 5px;"></div>
                        </div>
                    </div>
                    <div id="chem-result-${this.id}" style="min-height: 60px; padding: 10px; border: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
                        AWAITING INITIALIZATION
                    </div>
                </div>
            </div>
        `;
    }
    _getRecoverLayout() {
        return `
            <div style="padding: 25px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; animation: fadeIn 0.3s ease-out;">
                <div style="margin-bottom: 20px; color: var(--text-secondary); font-size: 13px; letter-spacing: 1px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">CORRUPTED SIGNAL RECONSTRUCTION</div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="recover-fileid-${this.id}" placeholder="ENTER FILE-ID" style="width: 180px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--accent-blue); padding: 10px; font-family: var(--font-mono); outline: none;">
                    <input type="text" id="recover-key-${this.id}" placeholder="ENTER RECOVERY KEY" style="width: 220px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--accent-blue); padding: 10px; font-family: var(--font-mono); outline: none;">
                    <button id="recover-run-${this.id}" class="os-button" style="padding: 10px 20px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary); cursor: pointer;">ATTEMPT RECONSTRUCTION</button>
                </div>
                <div id="recover-output-${this.id}" style="flex: 1; margin-top: 20px; border: 1px dashed var(--border-subtle); padding: 20px; font-size: 13px; line-height: 1.7; background: rgba(0,0,0,0.2); overflow-y: auto; color: var(--text-muted);">
                    ENTER A FILE-ID TO BEGIN
                </div>
            </div>
        `;
    }

    _bindRecover() {
        const runBtn = this.element.querySelector(`#recover-run-${this.id}`);
        const fileIdInput = this.element.querySelector(`#recover-fileid-${this.id}`);
        const keyInput = this.element.querySelector(`#recover-key-${this.id}`);
        const output = this.element.querySelector(`#recover-output-${this.id}`);
        if (!runBtn) return;

        const recoverMap = stateManager.get('caseData')?.forensics?.recover || {};

        const showCorrupted = (fileId) => {
            const entry = recoverMap[fileId];
            if (!entry) {
                output.style.borderColor = "var(--status-error)";
                output.style.color = "var(--text-muted)";
                output.innerHTML = `<span style="color: var(--status-error);">NO FILE MATCHING THAT ID.</span>`;
                return;
            }
            output.style.borderColor = "var(--border-subtle)";
            output.innerHTML = `<span class="forensics-corrupted-text">${entry.corruptedPreview}</span>`;
        };

        fileIdInput.addEventListener('blur', () => {
            const fileId = fileIdInput.value.trim();
            if (fileId) showCorrupted(fileId);
        });

        runBtn.addEventListener('click', () => {
            const fileId = fileIdInput.value.trim();

            const key = keyInput.value.trim().toLowerCase();
            if (!fileId || !key) return;
            if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();

            const entry = recoverMap[fileId];
            if (!entry) {
                showCorrupted(fileId);
                return;
            }

            if (key === (entry.recoveryKey || '').trim().toLowerCase()) {
                if (typeof AudioController !== 'undefined' && AudioController.success) AudioController.success();
                output.style.borderColor = "var(--status-success)";
                output.innerHTML = `<div style="color: var(--status-success); font-weight: bold; margin-bottom: 10px;">SIGNAL RECONSTRUCTED</div><div style="color: #fff;">${entry.recoveredContent}</div>`;
                if (entry.resultingFlag) stateManager.unlockFlag(entry.resultingFlag);
            } else {
                if (typeof AudioController !== 'undefined' && AudioController.error) AudioController.error();
                output.style.borderColor = "var(--status-error)";
                output.innerHTML = `<span style="color: var(--status-error);">RECOVERY KEY REJECTED.</span><br><br><span class="forensics-corrupted-text">${entry.corruptedPreview}</span>`;
            }
        });
    }

    _bindChem() {
        const runBtn = this.element.querySelector(`#chem-run-${this.id}`);
        const input = this.element.querySelector(`#chem-input-${this.id}`);
        const result = this.element.querySelector(`#chem-result-${this.id}`);
        const spectrum = this.element.querySelector(`#chem-spectrum-${this.id}`);
        if (!runBtn) return;
        runBtn.addEventListener('click', () => {
            const val = input.value.trim().toUpperCase();
            if (!val) return;
            if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
            runBtn.disabled = true;
            spectrum.style.opacity = '0';
            result.innerHTML = `<span style="color: var(--accent-blue);">BURNING SAMPLE... PROCESSING PEAKS...</span>`;
            setTimeout(() => {
                runBtn.disabled = false;
                const caseData = stateManager.get('caseData')?.forensics?.chem || {};
                if (caseData[val]) {
                    if (typeof AudioController !== 'undefined' && AudioController.success) AudioController.success();
                    spectrum.style.opacity = '1';
                    result.innerHTML = `<span style="color: var(--status-warning); font-weight: bold;">COMPOUND IDENTIFIED</span><br>${caseData[val]}`;
                    result.style.borderColor = "var(--status-warning)";
                } else {
                    if (typeof AudioController !== 'undefined' && AudioController.error) AudioController.error();
                    result.innerHTML = `<span style="color: var(--status-error);">SAMPLE INCONCLUSIVE OR INVALID ID.</span>`;
                    result.style.borderColor = "var(--status-error)";
                }
            }, 1500);
        });
    }
}
