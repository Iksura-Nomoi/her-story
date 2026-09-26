import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const NOTES_SHELL_TEMPLATE_PATH = 'src/apps/Notes/NotesApp.html';
export class NotesApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.notes = stateManager.get('player_notes') || {
            theories: "",
            passwords: "",
            timeline: ""
        };
        this.activeTab = 'theories';
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex');
            const tabButtons = [
                this._createTabBtn('theories', 'Theories'),
                this._createTabBtn('passwords', 'Passwords'),
                this._createTabBtn('timeline', 'Timeline Notes')
            ].join('\n                            ');
            const template = TemplateLoader.getSync(NOTES_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{tabButtons}}', tabButtons);
            this._bindTabs();
            this._loadTab(this.activeTab);
        }
        return this.element;
    }
    _createTabBtn(id, label) {
        return this._createSidebarBtn('notes-tab-btn', 'tab', id, label);
    }
    _bindTabs() {
        const btns = this.element.querySelectorAll('.notes-tab-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (typeof AudioController !== 'undefined' && AudioController.hover) AudioController.hover();
                this._saveCurrentTab();
                this.activeTab = e.target.getAttribute('data-tab');
                this._updateTabStyles();
                this._loadTab(this.activeTab);
            });
        });
        const editor = this.element.querySelector(`#notes-editor-${this.id}`);
        const status = this.element.querySelector(`#notes-status-${this.id}`);
        if (editor) {
            let saveTimeout;
            editor.addEventListener('input', () => {
                if (stateManager.get('os_settings')?.keypressClick !== false) AudioController.keyPress();
                clearTimeout(saveTimeout);
                if (status) status.textContent = "○ SAVING...";
                saveTimeout = setTimeout(() => {
                    this._saveCurrentTab();
                    if (status) status.textContent = "● AUTO-SAVE ACTIVE";
                }, 500);
            });
        }
    }
    _updateTabStyles() {
        const btns = this.element.querySelectorAll('.notes-tab-btn');
        btns.forEach(b => {
            if (b.getAttribute('data-tab') === this.activeTab) {
                b.style.borderLeft = '3px solid var(--accent-blue)';
                b.style.background = 'rgba(0,0,0,0.4)';
                b.style.color = 'var(--accent-blue)';
            } else {
                b.style.borderLeft = '3px solid transparent';
                b.style.background = 'transparent';
                b.style.color = 'var(--text-primary)';
            }
        });
    }
    _loadTab(tabId) {
        const editor = this.element.querySelector(`#notes-editor-${this.id}`);
        const headerTitle = this.element.querySelector(`#notes-header-title-${this.id}`);
        if (editor && headerTitle) {
            editor.textContent = this.notes[tabId] || '';
            headerTitle.textContent = `EDITING: ${tabId.toUpperCase()}`;
            this._updateTabStyles();
        }
    }
    _onClose() {
        this._saveCurrentTab();
    }

    _saveCurrentTab() {
        const editor = this.element.querySelector(`#notes-editor-${this.id}`);
        if (editor) {
            this.notes[this.activeTab] = editor.innerText;
            stateManager.set('player_notes', this.notes);
        }
    }
}
