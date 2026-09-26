import { AudioController } from './AudioController.js';
import { eventBus } from './EventBus.js';
import { stateManager } from './StateManager.js';

const AUTO_DISMISS_MS = 4200;
const MAX_STACK = 4;
const MAX_HISTORY = 30;

export class NotificationManager {
    static containerEl = null;
    static queue = [];

    static init(containerEl) {
        this.containerEl = containerEl;
    }

        static push({ title, body = '', kind = 'info', onClick = null }) {
        this._recordHistory({ title, body, kind, ts: Date.now() });

        if (!this.containerEl) return;

        const el = document.createElement('div');
        el.className = `os-toast os-toast-${kind}`;
        el.innerHTML = `
            <div class="os-toast-icon"></div>
            <div class="os-toast-text">
                <div class="os-toast-title">${title}</div>
                ${body ? `<div class="os-toast-body">${body}</div>` : ''}
            </div>
        `;
        if (onClick) {
            el.classList.add('is-clickable');
            el.addEventListener('click', onClick);
        }

        while (this.containerEl.children.length >= MAX_STACK) {
            this.containerEl.firstElementChild.remove();
        }

        this.containerEl.appendChild(el);
        requestAnimationFrame(() => el.classList.add('is-visible'));
        if (AudioController.notify) AudioController.notify();
        else if (AudioController.hover) AudioController.hover();

        const dismiss = () => {
            el.classList.remove('is-visible');
            el.classList.add('is-leaving');
            setTimeout(() => el.remove(), 300);
        };
        let activeTimer = setTimeout(dismiss, AUTO_DISMISS_MS);
        el.addEventListener('mouseenter', () => clearTimeout(activeTimer));
        el.addEventListener('mouseleave', () => { activeTimer = setTimeout(dismiss, 1200); });
    }

        static getHistory() {
        return stateManager.get('notification_history') || [];
    }

    static _recordHistory(entry) {
        const history = [entry, ...this.getHistory()].slice(0, MAX_HISTORY);
        stateManager.set('notification_history', history);
        eventBus.emit('NOTIFICATION_HISTORY_UPDATED', history);
    }
}
