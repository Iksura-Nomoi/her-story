import { eventBus } from './EventBus.js';
import { stateManager } from './StateManager.js';
import { NotificationManager } from './NotificationManager.js';
const SAVE_KEY = 'offset_save_data';
const LEGACY_SAVE_KEY = 'case_zero_save_data';
export class SaveManager {
    static init() {
        try {
            let savedData = localStorage.getItem(SAVE_KEY);
            if (!savedData) {
                const legacyData = localStorage.getItem(LEGACY_SAVE_KEY);
                if (legacyData) {
                    savedData = legacyData;
                    localStorage.setItem(SAVE_KEY, legacyData);
                    console.log('Migrated pre-rebrand save to HER STORY save data.');
                }
            }
            if (savedData) {
                stateManager.loadState(JSON.parse(savedData));
                console.log('OS State Restored.');
            } else {
                stateManager.set('first_launch', new Date().toISOString());
            }
        } catch (error) {
            console.error('Failed to parse save data:', error);
        }
        eventBus.on('STATE_UPDATED', (newState) => {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(newState));
            } catch (error) {
                console.error('Failed to persist save data:', error);
                eventBus.emit('SAVE_ERROR', error);
                NotificationManager.push({
                    title: 'Save Failed',
                    body: 'Your progress could not be saved. Check available storage space.',
                    kind: 'error',
                });
            }
        });
    }
    static wipeSave() {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(LEGACY_SAVE_KEY);
        console.warn('OS State Wiped. Refresh to start over.');
    }
}
