import { eventBus } from './EventBus.js';
class StateManager {
    constructor() {
        this.state = {
            currentCase: 'case001',
            unlockedFlags: [], 
            unlocked_apps: ['case-files', 'messages', 'media', 'locker', 'terminal'],
            notes: ""
        };
    }
    loadState(savedState) {
        if (savedState) {
            this.state = { ...this.state, ...savedState };
        }
    }
    set(key, value) {
        this.state[key] = value;
        eventBus.emit('STATE_UPDATED', this.state);
    }
    get(key) {
        return this.state[key];
    }
    getAll() {
        return JSON.parse(JSON.stringify(this.state));
    }
    unlockFlag(flagName) {
        if (!this.state.unlockedFlags.includes(flagName)) {
            this.state.unlockedFlags.push(flagName);
            eventBus.emit('FLAG_UNLOCKED', flagName);
            eventBus.emit('STATE_UPDATED', this.state);
        }
    }
    hasFlag(flagName) {
        return this.state.unlockedFlags.includes(flagName);
    }
    unlockApp(appId) {
        if (!this.state.unlocked_apps.includes(appId)) {
            this.state.unlocked_apps.push(appId);
            eventBus.emit('APP_UNLOCKED', appId);
            eventBus.emit('STATE_UPDATED', this.state);
        }
    }
    hasApp(appId) {
        return this.state.unlocked_apps.includes(appId);
    }
    getCrossCaseEvidencePool() {
        const completed = this.get('completed_cases') || [];
        return completed.flatMap(c => (c.evidenceManifest || []).map(e => ({
            ...e,
            sourceCaseId: c.id,
            sourceCaseTitle: c.title
        })));
    }
}
export const stateManager = new StateManager();
