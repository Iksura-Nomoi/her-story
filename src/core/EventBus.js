
class EventBus {
    constructor() {
        this.listeners = new Map();
        this._history = [];
        this._historyLimit = 100;
    }
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return () => this.off(event, callback);
    }
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
        this.listeners.set(event, callbacks);
    }
    emit(event, payload = null) {
        this._history.push({ event, payload, time: Date.now() });
        if (this._history.length > this._historyLimit) this._history.shift();
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                console.error(`Error in EventBus listener for ${event}:`, error);
            }
        });
    }
    getHistory() {
        return this._history.slice();
    }
}
export const eventBus = new EventBus();
