/**
 * Her-Story — case system.
 *
 * The front door of the game: loads authored case data, opens a case slice in
 * game state, seeds the material the case starts with, and keeps the derived
 * status/progress in sync as the player works. Everything else in the game
 * follows the events this system publishes.
 */

import { EVENTS, announce, notify } from '../core/events.js';
import { eventBus } from '../core/EventBus.js';
import {
    gameStore, updateGame, updateCase, getCaseStateSafe, setCaseStatus, logCaseEvent,
    CASE_STATUS, CASE_STATUS_META,
} from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { appRegistry } from '../core/AppRegistry.js';
import { computeProgress, deriveCaseStatus } from './progress.js';
import { systems } from './registry.js';

export const REPORT_VERDICTS = Object.freeze([
    'accidental', 'deliberate', 'unresolved', 'misadventure', 'withdrawn',
]);

export class CaseSystem {
    static install() {
        const refreshTriggers = [
            EVENTS.EVIDENCE_DISCOVERED, EVENTS.EVIDENCE_VERIFIED, EVENTS.PERSON_DISCOVERED,
            EVENTS.LOCATION_DISCOVERED, EVENTS.TIMELINE_UPDATED, EVENTS.MESSAGE_OPENED,
            EVENTS.RELATIONSHIP_CREATED, EVENTS.ANALYSIS_COMPLETED,
        ];
        refreshTriggers.forEach((event) => {
            eventBus.on(event, (payload) => {
                const caseId = payload?.caseId || this.activeCaseId();
                if (caseId) this.refresh({ caseId, silent: true });
            });
        });
    }

    // -- discovery ---------------------------------------------------------

    static async loadManifest(options = {}) {
        return caseRepository.loadManifest(options);
    }

    /** Manifest rows for the Case Manager list (no per-case fetch). */
    static summaries() {
        const summaries = caseRepository.listCaseSummaries();
        const game = gameStore.getState();
        return summaries.map((entry) => {
            const caseState = game.cases[entry.id] || null;
            const entryStatus = caseState?.status || entry.status || CASE_STATUS.NEW;
            return {
                ...entry,
                tracked: Boolean(caseState),
                active: game.activeCaseId === entry.id,
                status: entryStatus,
                statusLabel: CASE_STATUS_META[entryStatus]?.label || entryStatus,
                progress: caseState?.progress?.overall ?? 0,
            };
        });
    }

    /**
     * Open a case: load its data, create its state slice, seed starting material
     * and make it the active investigation.
     */
    static async openCase(caseId, { silent = false } = {}) {
        await caseRepository.loadManifest();
        const record = await caseRepository.loadCase(caseId);
        if (!record) {
            notify('Case unavailable', `Could not load case data for ${caseId}.`, 'error');
            return null;
        }

        updateCase(caseId, () => { /* force-create the slice */ });
        const alreadyOpened = Boolean(getCaseStateSafe(caseId).openedAt);

        const start = record.start || {};
        systems.evidence?.discoverMany(start.evidence || [], { caseId });
        (start.people || []).forEach((id) => systems.people?.discover(id, { caseId, silent: true }));
        (start.locations || []).forEach((id) => systems.locations?.discover(id, { caseId, silent: true }));
        (start.timeline || []).forEach((id) => systems.timeline?.discover(id, { caseId, silent: true }));
        (start.messages || []).forEach((id) => systems.messages?.discover(id, { caseId, silent: true }));

        updateGame({ activeCaseId: caseId });
        setCaseStatus(caseId, alreadyOpened ? getCaseStateSafe(caseId).status : CASE_STATUS.INVESTIGATING);
        logCaseEvent(caseId, {
            kind: alreadyOpened ? 'case-reopened' : 'case-opened',
            text: alreadyOpened ? 'Case reopened.' : 'Case opened and docket attached.',
        });

        this.refresh({ caseId, silent: true });
        systems.apps?.evaluate({ silent });
        systems.objectives?.evaluate({ caseId, silent: true });
        systems.analysis?.processPending(caseId);

        announce(EVENTS.CASE_LOADED, { caseId, title: record.meta.title });
        if (!silent) {
            notify('Case opened', `${record.meta.id.toUpperCase()} — ${record.meta.title}`, 'case');
        }
        return record;
    }

    // -- reads -------------------------------------------------------------

    static activeCaseId() {
        return gameStore.getState().activeCaseId;
    }

    static activeData() {
        return caseRepository.getCase(this.activeCaseId());
    }

    static data(caseId = this.activeCaseId()) {
        return caseRepository.getCase(caseId);
    }

    static meta(caseId = this.activeCaseId()) {
        return this.data(caseId)?.meta || null;
    }

    static progress(caseId = this.activeCaseId()) {
        return computeProgress(this.data(caseId), getCaseStateSafe(caseId));
    }

    static status(caseId = this.activeCaseId()) {
        return getCaseStateSafe(caseId).status;
    }

    /**
     * Player context consumed by the application registry.
     * Delegates to the unlock system so there is a single definition.
     */
    static context() {
        return systems.apps?.context() || {
            unlockedApps: gameStore.getState().unlockedApps,
            flags: gameStore.getState().flags,
            evidenceCount: 0,
            verifiedCount: 0,
            relationshipCount: 0,
            peopleCount: 0,
            messagesRead: 0,
            timelineCount: 0,
            completedObjectives: [],
        };
    }

    // -- derived state -----------------------------------------------------

    /**
     * Recompute objectives, progress and case status. Cheap enough to run on
     * every investigation event; it only writes when something actually moved.
     */
    static refresh({ caseId = this.activeCaseId(), silent = true } = {}) {
        if (!caseId || !caseRepository.getCase(caseId)) return null;
        systems.objectives?.evaluate({ caseId, silent: true });

        const data = this.data(caseId);
        const state = getCaseStateSafe(caseId);
        const progress = computeProgress(data, state);
        const nextStatus = deriveCaseStatus(data, state, progress);

        updateCase(caseId, (draft) => { draft.progress = progress; });
        const moved = nextStatus !== state.status && setCaseStatus(caseId, nextStatus);

        announce(EVENTS.CASE_UPDATED, { caseId, progress, status: nextStatus });
        if (moved) {
            const meta = CASE_STATUS_META[nextStatus];
            announce(EVENTS.CASE_STATUS_CHANGED, { caseId, status: nextStatus, label: meta?.label });
            if (!silent) notify('Case status', `${meta?.label || nextStatus} — ${meta?.hint || ''}`, 'case');
        }
        return { progress, status: nextStatus };
    }

    /** Toast for a completed objective (called by the objective system). */
    static announceObjective(objective) {
        if (!objective) return;
        notify('Objective complete', objective.title, 'success');
        logCaseEvent(this.activeCaseId(), {
            kind: 'objective-complete',
            text: `Objective complete: ${objective.title}`,
            objectiveId: objective.id,
        });
    }

    static isReadyForConclusion(caseId = this.activeCaseId()) {
        return this.status(caseId) === CASE_STATUS.READY_FOR_CONCLUSION;
    }

    // -- reports -----------------------------------------------------------

    /** File a conclusion. The report is player-authored; the game only records it. */
    static conclude({ title, summary = '', theory = '', verdict = 'unresolved', evidenceIds = [], personId = null } = {}, { caseId = this.activeCaseId() } = {}) {
        if (!title) return { ok: false, reason: 'A report title is required.' };
        const report = {
            id: `report-${Date.now().toString(36)}`,
            caseId,
            title: String(title).slice(0, 140),
            summary: String(summary).slice(0, 8000),
            theory: String(theory).slice(0, 8000),
            verdict,
            evidenceIds: evidenceIds.slice(0, 60),
            personId,
            submittedAt: new Date().toISOString(),
            operator: gameStore.getState().session.operator || 'Unnamed investigator',
        };

        updateGame({ reports: [...gameStore.getState().reports, report] });
        setCaseStatus(caseId, CASE_STATUS.COMPLETED);
        logCaseEvent(caseId, {
            kind: 'report-submitted',
            text: `Report filed: ${report.title}`,
            reportId: report.id,
        });

        announce(EVENTS.REPORT_SUBMITTED, { caseId, report });
        announce(EVENTS.CASE_STATUS_CHANGED, {
            caseId, status: CASE_STATUS.COMPLETED, label: CASE_STATUS_META[CASE_STATUS.COMPLETED].label,
        });
        notify('Report filed', report.title, 'success');
        this.refresh({ caseId, silent: true });
        return { ok: true, report };
    }

    static reports(caseId = null) {
        const reports = gameStore.getState().reports;
        return caseId ? reports.filter((report) => report.caseId === caseId) : reports;
    }

    /** Case list plus the operator's standing, for the Case Manager header. */
    static overview() {
        const caseId = this.activeCaseId();
        const meta = this.meta(caseId);
        if (!meta) return null;
        return {
            caseId,
            meta,
            status: this.status(caseId),
            statusMeta: CASE_STATUS_META[this.status(caseId)],
            progress: this.progress(caseId),
            objectives: systems.objectives?.list({ caseId }) || [],
            evidence: systems.evidence?.list({ caseId }) || [],
            people: systems.people?.list({ caseId }) || [],
            locations: systems.locations?.list({ caseId }) || [],
            timeline: systems.timeline?.list({ caseId }) || [],
            reports: this.reports(caseId),
            lockedApps: appRegistry.locked(this.context()),
        };
    }
}

systems.case = CaseSystem;
export default CaseSystem;
