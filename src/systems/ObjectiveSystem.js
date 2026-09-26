/**
 * Her-Story — objective system.
 *
 * Objectives are authored in `case.json` with a machine-checkable requirement.
 * This system owns their status: it activates objectives whose prerequisites are
 * met, completes them when their requirement passes, and reveals whatever the
 * objective points at. Case status then falls out of the objective set (see
 * systems/progress.js).
 */

import { EVENTS, announce } from '../core/events.js';
import { eventBus } from '../core/EventBus.js';
import { gameStore, updateCase, getCaseStateSafe, OBJECTIVE_STATUS } from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { objectiveRequirementMet } from './progress.js';
import { systems } from './registry.js';

const activeCaseId = () => gameStore.getState().activeCaseId;

/** Events that can change whether an objective is satisfied. */
const TRIGGER_EVENTS = [
    EVENTS.EVIDENCE_DISCOVERED,
    EVENTS.EVIDENCE_VERIFIED,
    EVENTS.PERSON_DISCOVERED,
    EVENTS.LOCATION_DISCOVERED,
    EVENTS.TIMELINE_UPDATED,
    EVENTS.MESSAGE_OPENED,
    EVENTS.RELATIONSHIP_CREATED,
    EVENTS.ANALYSIS_COMPLETED,
];

export class ObjectiveSystem {
    static install() {
        TRIGGER_EVENTS.forEach((event) => {
            eventBus.on(event, (payload) => {
                const caseId = payload?.caseId || activeCaseId();
                if (caseId) this.evaluate({ caseId });
            });
        });
    }

    static context(caseId = activeCaseId()) {
        return { flags: gameStore.getState().flags, caseId };
    }

    /**
     * Recompute every authored objective for a case and publish the deltas.
     * @returns {string[]} ids that moved to complete during this pass
     */
    static evaluate({ caseId = activeCaseId(), silent = false } = {}) {
        const record = caseRepository.getCase(caseId);
        if (!record) return [];
        const context = this.context(caseId);
        const completedNow = [];

        updateCase(caseId, (draft) => {
            if (!draft.objectives) draft.objectives = {};
            record.objectives.forEach((objective) => {
                const current = draft.objectives[objective.id];
                const prerequisitesMet = (objective.requires || [])
                    .every((id) => draft.objectives[id] === OBJECTIVE_STATUS.COMPLETE);

                if (!prerequisitesMet) {
                    if (!current) draft.objectives[objective.id] = OBJECTIVE_STATUS.LOCKED;
                    return;
                }

                const satisfied = objectiveRequirementMet(objective.requirement, context, draft);
                const next = satisfied ? OBJECTIVE_STATUS.COMPLETE : OBJECTIVE_STATUS.ACTIVE;
                if (current === next) return;
                draft.objectives[objective.id] = next;
                if (satisfied) completedNow.push(objective.id);
            });
        });

        completedNow.forEach((objectiveId) => {
            const objective = record.indexes.objectives.get(objectiveId);
            const reveals = objective?.reveals || {};
            (reveals.evidence || []).forEach((id) => systems.evidence?.discover(id, { caseId, silent: true }));
            (reveals.people || []).forEach((id) => systems.people?.discover(id, { caseId, silent: true }));
            (reveals.locations || []).forEach((id) => systems.locations?.discover(id, { caseId, silent: true }));
            (reveals.timeline || []).forEach((id) => systems.timeline?.discover(id, { caseId, silent: true }));
            (reveals.messages || []).forEach((id) => systems.messages?.discover(id, { caseId, silent: true }));
            announce(EVENTS.OBJECTIVE_COMPLETED, {
                caseId, objectiveId, title: objective?.title || objectiveId,
            });
            if (!silent) systems.case?.announceObjective?.(objective);
        });

        return completedNow;
    }

    /** Authored objectives resolved with their live status. */
    static list({ caseId = activeCaseId() } = {}) {
        const record = caseRepository.getCase(caseId);
        if (!record) return [];
        const state = getCaseStateSafe(caseId);
        return record.objectives.map((objective) => ({
            id: objective.id,
            title: objective.title || objective.id,
            description: objective.description || '',
            kind: objective.kind || 'primary',
            requirement: objective.requirement || null,
            status: (state.objectives || {})[objective.id] || OBJECTIVE_STATUS.LOCKED,
        }));
    }

    static get(id, options = {}) {
        return this.list(options).find((objective) => objective.id === id) || null;
    }

    static active({ caseId = activeCaseId() } = {}) {
        return this.list({ caseId }).filter((objective) => objective.status === OBJECTIVE_STATUS.ACTIVE);
    }

    static completed({ caseId = activeCaseId() } = {}) {
        return this.list({ caseId }).filter((objective) => objective.status === OBJECTIVE_STATUS.COMPLETE);
    }

    static completedIds({ caseId = activeCaseId() } = {}) {
        return this.completed({ caseId }).map((objective) => objective.id);
    }

    static counts({ caseId = activeCaseId() } = {}) {
        const objectives = this.list({ caseId });
        return {
            total: objectives.length,
            complete: objectives.filter((entry) => entry.status === OBJECTIVE_STATUS.COMPLETE).length,
            active: objectives.filter((entry) => entry.status === OBJECTIVE_STATUS.ACTIVE).length,
            locked: objectives.filter((entry) => entry.status === OBJECTIVE_STATUS.LOCKED).length,
        };
    }

    /** Direct status write — used by the Report flow and the Terminal. */
    static setStatus(objectiveId, status, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            draft.objectives = { ...(draft.objectives || {}), [objectiveId]: status };
        });
        announce(EVENTS.OBJECTIVE_UPDATED, { caseId, objectiveId, status });
        return true;
    }
}

systems.objectives = ObjectiveSystem;
export default ObjectiveSystem;
