/**
 * Her-Story — progress maths.
 *
 * Pure functions only: given a case's authored data and the player's state, work
 * out how far along the investigation is and which status it should show. Kept
 * separate from the systems so it can be unit tested without a DOM.
 */

import { CASE_STATUS } from '../core/GameState.js';

const WEIGHTS = { evidence: 0.4, objectives: 0.35, people: 0.15, timeline: 0.1 };

const ratio = (part, total) => (total > 0 ? Math.min(1, part / total) : 0);
const percent = (value) => Math.round(value * 100);

export function computeProgress(caseData, caseState) {
    const evidenceTotal = caseData?.evidence?.length || 0;
    const peopleTotal = caseData?.people?.length || 0;
    const timelineTotal = caseData?.timeline?.length || 0;
    const objectives = caseData?.objectives || [];

    const discovered = caseState?.discoveredEvidence?.length || 0;
    const verified = caseState?.verifiedEvidence?.length || 0;
    const completedObjectives = objectives
        .filter((objective) => caseState?.objectives?.[objective.id] === 'complete').length;

    const evidenceRatio = ratio(discovered, evidenceTotal);
    const objectiveRatio = ratio(completedObjectives, objectives.length);
    const peopleRatio = ratio(caseState?.peopleDiscovered?.length || 0, peopleTotal);
    const timelineRatio = ratio(caseState?.timelineDiscovered?.length || 0, timelineTotal);

    const overall = (
        evidenceRatio * WEIGHTS.evidence
        + objectiveRatio * WEIGHTS.objectives
        + peopleRatio * WEIGHTS.people
        + timelineRatio * WEIGHTS.timeline
    );

    return {
        evidence: percent(evidenceRatio),
        objectives: percent(objectiveRatio),
        people: percent(peopleRatio),
        timeline: percent(timelineRatio),
        overall: percent(overall),
        counts: {
            evidence: { found: discovered, verified, total: evidenceTotal },
            objectives: { complete: completedObjectives, total: objectives.length },
            people: { found: caseState?.peopleDiscovered?.length || 0, total: peopleTotal },
            timeline: { found: caseState?.timelineDiscovered?.length || 0, total: timelineTotal },
        },
    };
}

/**
 * Pick the status the Case Manager should display.
 * Priority: completed > ready for conclusion > analysis required > evidence found
 * > investigating > new.
 */
export function deriveCaseStatus(caseData, caseState, progress = null) {
    if (!caseState) return CASE_STATUS.NEW;
    if (caseState.status === CASE_STATUS.COMPLETED) return CASE_STATUS.COMPLETED;

    const metrics = progress || computeProgress(caseData, caseState);
    const objectives = caseData?.objectives || [];
    const allObjectivesDone = objectives.length > 0
        && metrics.counts.objectives.complete >= objectives.length;

    if (allObjectivesDone) return CASE_STATUS.READY_FOR_CONCLUSION;

    const analysisValues = Object.values(caseState.analysis || {});
    const analysisPending = analysisValues.some((entry) => entry && entry.status === 'queued');
    if (analysisPending) return CASE_STATUS.ANALYSIS_REQUIRED;

    const discovered = metrics.counts.evidence.found;
    if (discovered > 0) {
        const hasUnanalysed = (caseData?.evidence || []).some((item) => {
            if (!caseState.discoveredEvidence.includes(item.id)) return false;
            const entry = caseState.analysis?.[item.id];
            return !entry || entry.status !== 'complete';
        });
        return hasUnanalysed ? CASE_STATUS.INVESTIGATING : CASE_STATUS.EVIDENCE_FOUND;
    }

    if (caseState.messagesRead?.length || caseState.peopleDiscovered?.length) {
        return CASE_STATUS.INVESTIGATING;
    }
    return CASE_STATUS.NEW;
}

/** Objective requirement kinds evaluated by ObjectiveSystem. */
export function objectiveRequirementMet(requirement, context, caseState) {
    if (!requirement) return true;
    const value = requirement.value ?? 1;
    switch (requirement.type) {
        case 'evidence-discovered':
            return caseState.discoveredEvidence.length >= value;
        case 'evidence-verified':
            return caseState.verifiedEvidence.length >= value;
        case 'evidence-specific':
            return caseState.discoveredEvidence.includes(requirement.id);
        case 'evidence-verified-specific':
            return caseState.verifiedEvidence.includes(requirement.id);
        case 'people-discovered':
            return caseState.peopleDiscovered.length >= value;
        case 'person-specific':
            return caseState.peopleDiscovered.includes(requirement.id);
        case 'location-specific':
            return caseState.locationsDiscovered.includes(requirement.id);
        case 'message-read':
            return caseState.messagesRead.includes(requirement.id);
        case 'timeline-event':
            return caseState.timelineDiscovered.includes(requirement.id);
        case 'relationship':
            return caseState.relationships.length >= value;
        case 'analysis-complete':
            return Object.values(caseState.analysis || {})
                .filter((entry) => entry && entry.status === 'complete').length >= value;
        case 'flag':
            return Boolean(context.flags[requirement.id]);
        default:
            return false;
    }
}
