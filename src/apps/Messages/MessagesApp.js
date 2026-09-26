import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { eventBus } from '../../core/EventBus.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const MESSAGES_SHELL_TEMPLATE_PATH = 'src/apps/Messages/MessagesApp.html';
export class MessagesApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeThreadId = null;
        const caseData = stateManager.get('caseData');
        this.threads = caseData?.messages || [];
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex-layered');
            const initialMessage = this.threads.length ? 'SELECT A COMMS THREAD TO REVIEW' : 'NO COMMS INTERCEPTED';
            const template = TemplateLoader.getSync(MESSAGES_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{initialMessage}}', initialMessage);
            this._renderList();
        }
        return this.element;
    }
    _renderList() {
        const listEl = this.element.querySelector(`#messages-list-${this.id}`);
        if (!listEl) return;
        listEl.innerHTML = '';
        this.threads.forEach(thread => {
            const isActive = this.activeThreadId === thread.id;
            const item = this._renderListItem({
                active: isActive,
                innerHtml: `<div style="color: ${isActive ? 'var(--accent-blue)' : 'var(--text-primary)'}; font-weight: bold; font-size: 13px;">${thread.contact}</div><div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">${thread.role || ('ID: ' + thread.id)}</div>`,
                onClick: () => {
                    this.activeThreadId = thread.id;
                    this._renderList();
                    this._loadThread(thread);
                }
            });
            listEl.appendChild(item);
        });
    }
    _loadThread(thread) {
        eventBus.emit('THREAD_OPENED', { threadId: thread.id });
        const readerEl = this.element.querySelector(`#messages-reader-${this.id}`);
        if (!readerEl) return;
        let chatHtml = thread.chat.map(msg => {
            const PLAYER_SENDER_NAMES = ['you', 'operator', 'me'];
            const isPlayer = PLAYER_SENDER_NAMES.includes((msg.sender || '').toLowerCase());
            const isTarget = !isPlayer;
            const align = isTarget ? 'flex-start' : 'flex-end';
            const bg = isTarget ? 'rgba(0,0,0,0.5)' : 'rgba(0, 195, 255, 0.1)';
            const border = isTarget ? '1px solid var(--border-subtle)' : '1px solid var(--accent-blue)';
            return `
                <div style="display: flex; flex-direction: column; align-items: ${align}; margin-bottom: 15px; width: 100%;">
                    <span style="font-size: 10px; color: var(--text-muted); margin-bottom: 4px;">${msg.sender} // ${msg.time}</span>
                    <div style="background: ${bg}; border: ${border}; padding: 10px 15px; max-width: 70%; border-radius: 4px; font-size: 13px; line-height: 1.4;">
                        ${msg.text}
                    </div>
                </div>
            `;
        }).join('');
        readerEl.innerHTML = `
            <div style="padding: 15px 25px; border-bottom: 1px solid var(--border-subtle); background: rgba(0,0,0,0.8); flex-shrink: 0;">
                <h3 style="margin: 0; color: var(--accent-blue); font-size: 16px;">${thread.contact}</h3>
                <span style="font-size: 11px; color: var(--text-secondary);">STATUS: ENCRYPTED // INTERCEPTED</span>
            </div>
            <div style="flex: 1; padding: 25px; overflow-y: auto; display: flex; flex-direction: column; animation: fadeIn 0.3s ease-out;">
                ${chatHtml}
            </div>
        `;
    }
}
