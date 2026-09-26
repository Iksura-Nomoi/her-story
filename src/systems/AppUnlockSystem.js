/**
 * Her-Story — application unlock system.
 *
 * The registry declares *when* an application becomes reachable; this system is
 * the only thing that actually grants it. It re-evaluates on every event that can
 * change the player's investigation context, so unlocking stays declarative and
 * case authors never have to touch application code.
 */

import { EVENTS, announce } from '../core/events.js';
import { eventBus } from '../core/EventBus.js';
import { gameStore, updateGame } from '../core/GameState.js';
import { appRegistry } from '../core/AppRegistry.js';
import { systems } from './registry.js';

const RECHECK_EVENTS = [
    EVENTS.EVIDENCE_DISCOVERED,
    EVENTS.EVIDENCE_VERIFIED,
    EVENTS.PERSON_DISCOVERED,
    EVENTS.LOCATION_DISCOVERED,
    EVENTS.TIMELINE_UPDATED,
    EVENTS.MESSAGE_OPENED,
    EVENTS.RELATIONSHIP_CREATED,
    EVENTS.ANALYSIS_COMPLETED,
    EVENTS.CASE_LOADED,
];

export class AppUnlockSystem {
    static install() {
        RECHECK_EVENTS.forEach((event) => eventBus.on(event, () => this.evaluate()));
    }

    /**
     * Context every availability rule is checked against.
     * Kept in one place so the registry, the Case Manager and the launcher all
     * agree on what "3 pieces of verified evidence" means right now.
     */
    static context() {
        const game = gameStore.getState();
        const caseId = game.activeCaseId;
        const evidence = systems.evidence?.list({ caseId }) || [];
        return {
            unlockedApps: game.unlockedApps,
            flags: game.flags,
            caseId,
            evidenceCount: evidence.length,
            verifiedCount: evidence.filter((item) => item.verified).length,
            relationshipCount: (systems.relationships?.list({ caseId }) || []).length,
            peopleCount: (systems.people?.list({ caseId }) || []).length,
            messagesRead: (systems.messages?.list({ caseId }) || []).filter((message) => message.read).length,
            timelineCount: (systems.timeline?.list({ caseId }) || []).length,
            completedObjectives: systems.objectives?.completedIds({ caseId }) || [],
        };
    }

    /** @returns {string[]} app ids granted by this pass */
    static evaluate({ silent = false } = {}) {
        const context = this.context();
        const granted = [];

        appRegistry.list().forEach((entry) => {
            if (context.unlockedApps.includes(entry.id)) return;
            const { available } = appRegistry.availability(entry.id, context);
            if (!available) return;
            granted.push(entry.id);
        });

        if (!granted.length) return granted;

        updateGame({
            unlockedApps: Array.from(new Set([...gameStore.getState().unlockedApps, ...granted])),
        });

        granted.forEach((appId) => {
            const entry = appRegistry.get(appId);
            announce(EVENTS.APP_UNLOCKED, { appId, name: entry?.name || appId });
            if (!silent) {
                announce(EVENTS.NOTIFY, {
                    title: 'Application available',
                    body: `${entry?.name || appId} is now reachable from the launcher.`,
                    kind: 'system',
                });
            }
        });

        return granted;
    }

    /** Explicit grant (used by Terminal commands and future story beats). */
    static grant(appId, { silent = false } = {}) {
        if (!appRegistry.has(appId)) return false;
        const { unlockedApps } = gameStore.getState();
        if (unlockedApps.includes(appId)) return false;
        updateGame({ unlockedApps: [...unlockedApps, appId] });
        const entry = appRegistry.get(appId);
        announce(EVENTS.APP_UNLOCKED, { appId, name: entry?.name || appId });
        if (!silent) {
            announce(EVENTS.NOTIFY, {
                title: 'Application available',
                body: `${entry?.name || appId} is now reachable.`,
                kind: 'system',
            });
        }
        return true;
    }

    static locked() {
        return appRegistry.locked(this.context());
    }
}

systems.apps = AppUnlockSystem;
export default AppUnlockSystem;
