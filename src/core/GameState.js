/**
 * Her-Story — GAME state.
 *
 * Everything the player has *learned* lives here. Nothing about window
 * positions, themes or panels does — that is UI state (see UIState.js).
 *
 * The game state is deliberately serialisable: systems mutate it through
 * `updateCase()` / `updateGame()`, SaveManager snapshots it, and nothing inside
 * holds DOM references.
 */

import { createStore, deepClone } from './Store.js';

export const SAVE_SCHEMA_VERSION = 1;

/** Case statuses the Case Manager understands. */
export const CASE_STATUS = Object.freeze({
    NEW: 'new',
    INVESTIGATING: 'investigating',
    EVIDENCE_FOUND: 'evidence_found',
    ANALYSIS_REQUIRED: 'analysis_required',
    READY_FOR_CONCLUSION: 'ready_for_conclusion',
    COMPLETED: 'completed',
});

export const CASE_STATUS_META = Object.freeze({
    [CASE_STATUS.NEW]: { label: 'New', tone: 'neutral', hint: 'Docket opened, no work logged yet.' },
    [CASE_STATUS.INVESTIGATING]: { label: 'Investigating', tone: 'info', hint: 'Work in progress.' },
    [CASE_STATUS.EVIDENCE_FOUND]: { label: 'Evidence Found', tone: 'accent', hint: 'Evidence is accumulating.' },
    [CASE_STATUS.ANALYSIS_REQUIRED]: { label: 'Analysis Required', tone: 'warn', hint: 'Findings need lab work.' },
    [CASE_STATUS.READY_FOR_CONCLUSION]: { label: 'Ready for Conclusion', tone: 'success', hint: 'Objectives met — draft a report.' },
    [CASE_STATUS.COMPLETED]: { label: 'Completed', tone: 'muted', hint: 'Report filed.' },
});

export const CASE_STATUS_ORDER = Object.freeze([
    CASE_STATUS.NEW,
    CASE_STATUS.INVESTIGATING,
    CASE_STATUS.EVIDENCE_FOUND,
    CASE_STATUS.ANALYSIS_REQUIRED,
    CASE_STATUS.READY_FOR_CONCLUSION,
    CASE_STATUS.COMPLETED,
]);

export const OBJECTIVE_STATUS = Object.freeze({
    LOCKED: 'locked',
    ACTIVE: 'active',
    COMPLETE: 'complete',
    FAILED: 'failed',
});

export const VERIFICATION_STATUS = Object.freeze({
    UNVERIFIED: 'unverified',
    PENDING: 'pending',
    VERIFIED: 'verified',
    DISPUTED: 'disputed',
});

export const ANALYSIS_STATUS = Object.freeze({
    NONE: 'none',
    QUEUED: 'queued',
    COMPLETE: 'complete',
});

const nowIso = () => new Date().toISOString();

/** A case slice is created the first time a case is touched, never by hand. */
export function createEmptyCaseState(caseId) {
    return {
        caseId,
        status: CASE_STATUS.NEW,
        discoveredEvidence: [],
        verifiedEvidence: [],
        inspectedEvidence: [],
        peopleDiscovered: [],
        locationsDiscovered: [],
        timelineDiscovered: [],
        messagesDiscovered: [],
        messagesRead: [],
        flaggedMessages: [],
        relationships: [],
        objectives: {},
        analysis: {},
        board: { nodes: {}, groups: [], theories: [] },
        progress: { evidence: 0, objectives: 0, people: 0, timeline: 0, overall: 0 },
        // player-authored material
        playerTimeline: [],
        tags: {},
        personStatus: {},
        verification: {},
        discoveryLog: [],
        log: [],
        openedAt: null,
        updatedAt: null,
        completedAt: null,
    };
}

export function createInitialGameState() {
    return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        session: {
            sessionId: `hs-${Math.random().toString(36).slice(2, 10)}`,
            operator: '',
            startedAt: null,
            lastPlayedAt: null,
            playtimeMs: 0,
        },
        activeCaseId: null,
        cases: {},
        /** case-scoped scratch notes keyed by case id */
        notes: {},
        /** filed conclusion reports */
        reports: [],
        /** applications the player has access to; grows as cases progress */
        unlockedApps: [
            'case-manager', 'evidence-locker', 'messages', 'people',
            'timeline', 'media-viewer', 'terminal', 'notes',
        ],
        /** boolean narrative switches future cases can set/read */
        flags: {},
        counters: {
            evidenceDiscovered: 0,
            evidenceVerified: 0,
            relationshipsCreated: 0,
            analysesRun: 0,
            messagesRead: 0,
        },
    };
}

export const gameStore = createStore(createInitialGameState(), { name: 'game' });

/** Merge a partial into the root game state. */
export function updateGame(partial, meta = {}) {
    return gameStore.setState(partial, meta);
}

/**
 * Mutate one case slice. The updater receives a private draft; the return value
 * is ignored, so callers can write imperative-looking code safely.
 */
export function updateCase(caseId, updater, meta = {}) {
    if (!caseId) throw new Error('updateCase() requires a caseId');
    gameStore.patch(['cases', caseId], (current) => {
        const draft = current ? deepClone(current) : createEmptyCaseState(caseId);
        updater(draft);
        draft.updatedAt = nowIso();
        if (!draft.openedAt) draft.openedAt = draft.updatedAt;
        return draft;
    }, { caseId, ...meta });
}

/** Push a line onto a case's investigation log (surfaced by the Reports app). */
export function logCaseEvent(caseId, entry) {
    updateCase(caseId, (draft) => {
        draft.log.push({ at: nowIso(), ...entry });
        if (draft.log.length > 200) draft.log.splice(0, draft.log.length - 200);
    });
}

/** Read a case slice without creating one. */
export function getCaseState(caseId) {
    if (!caseId) return null;
    return gameStore.getState().cases[caseId] || null;
}

export function getCaseStateSafe(caseId) {
    return getCaseState(caseId) || createEmptyCaseState(caseId);
}

/** Returns true when the status actually moved. */
export function setCaseStatus(caseId, status) {
    let changed = false;
    updateCase(caseId, (draft) => {
        if (draft.status === status) return;
        draft.status = status;
        if (status === CASE_STATUS.COMPLETED && !draft.completedAt) draft.completedAt = nowIso();
        changed = true;
    });
    return changed;
}

/** Case slice the player is currently working, or null before a case is loaded. */
export function activeCaseState() {
    return getCaseState(gameStore.getState().activeCaseId);
}

// ---------------------------------------------------------------------------
// Selectors — cheap, pure reads used by apps and the shell.
// ---------------------------------------------------------------------------

export const selectActiveCaseId = (state = gameStore.getState()) => state.activeCaseId;
export const selectUnlockedApps = (state = gameStore.getState()) => state.unlockedApps;
export const selectOperator = (state = gameStore.getState()) => state.session.operator;
export const selectNotes = (caseId) => gameStore.getState().notes[caseId] || [];
export const selectReports = (caseId = null) => {
    const reports = gameStore.getState().reports;
    return caseId ? reports.filter((report) => report.caseId === caseId) : reports;
};
export const selectDayCount = (state = gameStore.getState()) => {
    if (!state.session.startedAt) return 1;
    const elapsed = Date.now() - new Date(state.session.startedAt).getTime();
    return Math.max(1, Math.floor(elapsed / 86400000) + 1);
};
