import { stateManager } from './StateManager.js';
import { eventBus } from './EventBus.js';
import { AudioController } from './AudioController.js';
import { NotificationManager } from './NotificationManager.js';

export const ACHIEVEMENTS = [
    {
        id: 'FLAWLESS_CONVICTION',
        title: 'Flawless Conviction',
        desc: 'Solve a case without opening the Help App for hints.',
        icon: '🎯'
    },
    {
        id: 'CODEBREAKER',
        title: 'Codebreaker',
        desc: 'Successfully decrypt 3 terminal file payloads.',
        icon: '💻'
    },
    {
        id: 'SPEEDY_OPERATOR',
        title: 'Speedy Operator',
        desc: 'Solve any case in under 5 minutes of active play.',
        icon: '⚡'
    },
    {
        id: 'MASTER_ANALYST',
        title: 'Master Analyst',
        desc: 'Complete all 10 cases in the investigation campaign.',
        icon: '🏆'
    }
];

export class AchievementManager {
    static init() {
        if (this._initialized) return;
        this._initialized = true;

        this.unlocked = new Set(stateManager.get('unlocked_achievements') || []);
        this.decryptionsCount = stateManager.get('decryptions_count') || 0;
        this.usedHelpInCurrentCase = false;
        this.caseStartTime = Date.now();

        eventBus.on('CASE_LOADED', () => {
            this.usedHelpInCurrentCase = false;
            this.caseStartTime = Date.now();
        });

        eventBus.on('HELP_HINT_REVEALED', () => {
            this.usedHelpInCurrentCase = true;
        });

        eventBus.on('TERMINAL_DECRYPT_SUCCESS', () => {
            this.decryptionsCount++;
            stateManager.set('decryptions_count', this.decryptionsCount);
            if (this.decryptionsCount >= 3) {
                this.unlock('CODEBREAKER');
            }
        });

        eventBus.on('CASE_SOLVED', ({ caseId } = {}) => {
            const durationSec = (Date.now() - this.caseStartTime) / 1000;
            if (durationSec > 0 && durationSec < 300) {
                this.unlock('SPEEDY_OPERATOR');
            }
            if (!this.usedHelpInCurrentCase) {
                this.unlock('FLAWLESS_CONVICTION');
            }

            const completed = stateManager.get('completed_cases') || [];
            if (completed.length >= 10) {
                this.unlock('MASTER_ANALYST');
            }
        });
    }

    static unlock(achievementId) {
        if (this.unlocked.has(achievementId)) return;

        this.unlocked.add(achievementId);
        stateManager.set('unlocked_achievements', Array.from(this.unlocked));

        const badge = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (badge) {
            NotificationManager.push({
                title: 'ACHIEVEMENT UNLOCKED',
                body: `${badge.icon} ${badge.title}: ${badge.desc}`,
                kind: 'success'
            });
        }
    }

    static getUnlocked() {
        return Array.from(this.unlocked);
    }
}
