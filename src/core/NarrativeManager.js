import { eventBus } from './EventBus.js';
import { dataLoader } from './DataLoader.js';

export class NarrativeManager {
    constructor() {
        this._queue = [];
        this._showing = false;
        this._overlayEl = null;
        this._shownFlags = new Set(); 
        this._beats = null;
    }

        init() {
        this._ensureOverlay();
        this._refreshBeats();

        if (this._listenersBound) return;
        this._listenersBound = true;

        eventBus.on('CASE_LOADED', () => this._refreshBeats());

        eventBus.on('DOCUMENT_OPENED', ({ docId } = {}) => this._trigger('onDocument', docId));
        eventBus.on('THREAD_OPENED', ({ threadId } = {}) => this._trigger('onThread', threadId));
        eventBus.on('EVIDENCE_BOOKMARKED', ({ id } = {}) => this._trigger('onBookmark', id));
        eventBus.on('FLAG_UNLOCKED', (flagName) => {
            if (this._shownFlags.has(flagName)) return;
            this._shownFlags.add(flagName);
            this._trigger('onFlag', flagName);
        });
        eventBus.on('CASE_SOLVED', () => {
            if (this._beats && this._beats.onSubmitSuccess) {
                this._enqueue(this._beats.onSubmitSuccess);
            }
        });
    }

    _refreshBeats() {
        const beats = dataLoader.getNarrativeBeats();
        this._beats = (beats && Object.keys(beats).length > 0) ? beats : null;
        this._shownFlags.clear();
        this._queue = [];
        this._showing = false;
        if (this._overlayEl) this._overlayEl.classList.remove('narrative-overlay-visible');
    }

    _trigger(bucket, key) {
        if (!key || !this._beats || !this._beats[bucket]) return;
        const line = this._beats[bucket][key];
        if (line) this._enqueue(line);
    }

    _enqueue(line) {
        this._queue.push(line);
        this._processQueue();
    }

    _processQueue() {
        if (this._showing || this._queue.length === 0) return;
        const line = this._queue.shift();
        this._showing = true;

        this._overlayEl.textContent = line;
        this._overlayEl.classList.add('narrative-overlay-visible');

        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
            this._overlayEl.classList.remove('narrative-overlay-visible');

            setTimeout(() => {
                this._showing = false;
                this._processQueue();
            }, 350);
        }, 4200);
    }

    _ensureOverlay() {
        if (this._overlayEl) return;
        const el = document.createElement('div');
        el.id = 'narrative-overlay';
        el.className = 'narrative-overlay';
        document.body.appendChild(el);
        this._overlayEl = el;
    }
}

export const narrativeManager = new NarrativeManager();
