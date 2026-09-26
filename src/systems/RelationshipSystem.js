/**
 * Her-Story — relationship system.
 *
 * Relationships are data, not decoration: an edge can join any two records
 * (evidence, person, location, message, timeline event, theory) and the Evidence
 * Board, People and Media apps all read the same list. Authored edges come from
 * `relationships.json`; the player can add their own from the board.
 */

import { EVENTS, announce } from '../core/events.js';
import { gameStore, updateCase, getCaseStateSafe } from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { systems } from './registry.js';

export const RELATIONSHIP_TYPES = Object.freeze({
    RELATED_TO: 'related_to',
    MENTIONS: 'mentions',
    CREATED_BY: 'created_by',
    LOCATED_AT: 'located_at',
    CONTRADICTS: 'contradicts',
    CONFIRMS: 'confirms',
    DERIVED_FROM: 'derived_from',
    CONNECTED_TO: 'connected_to',
});

export const RELATIONSHIP_LABELS = Object.freeze({
    [RELATIONSHIP_TYPES.RELATED_TO]: 'related to',
    [RELATIONSHIP_TYPES.MENTIONS]: 'mentions',
    [RELATIONSHIP_TYPES.CREATED_BY]: 'created by',
    [RELATIONSHIP_TYPES.LOCATED_AT]: 'located at',
    [RELATIONSHIP_TYPES.CONTRADICTS]: 'contradicts',
    [RELATIONSHIP_TYPES.CONFIRMS]: 'confirms',
    [RELATIONSHIP_TYPES.DERIVED_FROM]: 'derived from',
    [RELATIONSHIP_TYPES.CONNECTED_TO]: 'connected to',
});

export const ENTITY_KINDS = Object.freeze({
    EVIDENCE: 'evidence',
    PERSON: 'person',
    LOCATION: 'location',
    MESSAGE: 'message',
    TIMELINE: 'timeline',
    THEORY: 'theory',
});

const activeCaseId = () => gameStore.getState().activeCaseId;

/** Has the player actually seen this record? Gates authored edges. */
export function endpointVisible(kind, id, caseState) {
    if (!caseState) return false;
    switch (kind) {
        case ENTITY_KINDS.EVIDENCE:
            return caseState.discoveredEvidence.includes(id);
        case ENTITY_KINDS.PERSON:
            return caseState.peopleDiscovered.includes(id);
        case ENTITY_KINDS.LOCATION:
            return caseState.locationsDiscovered.includes(id);
        case ENTITY_KINDS.MESSAGE:
            return caseState.messagesDiscovered.includes(id) || caseState.messagesRead.includes(id);
        case ENTITY_KINDS.TIMELINE:
            return caseState.timelineDiscovered.includes(id);
        case ENTITY_KINDS.THEORY:
            return (caseState.board?.theories || []).some((theory) => theory.id === id);
        default:
            return false;
    }
}

function normalizeEdge(edge, origin) {
    return {
        id: edge.id,
        type: edge.type || RELATIONSHIP_TYPES.RELATED_TO,
        from: { kind: edge.from?.kind, id: edge.from?.id },
        to: { kind: edge.to?.kind, id: edge.to?.id },
        note: edge.note || '',
        origin,
        confirmed: edge.confirmed !== false,
        createdAt: edge.createdAt || null,
    };
}

export class RelationshipSystem {
    /** Authored + player-created edges, filtered to what has been discovered. */
    static list({ caseId = activeCaseId(), includeHidden = false, kinds = null } = {}) {
        const state = getCaseStateSafe(caseId);
        const authored = (caseRepository.getCase(caseId)?.relationships || [])
            .map((edge) => normalizeEdge(edge, 'case'));
        const player = (state.relationships || []).map((edge) => normalizeEdge(edge, 'player'));
        const all = [...authored, ...player];

        return all.filter((edge) => {
            if (kinds && !kinds.includes(edge.from.kind) && !kinds.includes(edge.to.kind)) return false;
            if (!edge.from.id || !edge.to.id || edge.from.id === edge.to.id) return false;
            if (includeHidden) return true;
            return endpointVisible(edge.from.kind, edge.from.id, state)
                && endpointVisible(edge.to.kind, edge.to.id, state);
        });
    }

    static get(id, options = {}) {
        return this.list({ ...options, includeHidden: true }).find((edge) => edge.id === id) || null;
    }

    /** Every edge touching one entity. */
    static forEntity(kind, id, options = {}) {
        return this.list(options).filter((edge) =>
            (edge.from.kind === kind && edge.from.id === id)
            || (edge.to.kind === kind && edge.to.id === id));
    }

    /** Neighbours of a record, each paired with the connecting edge. */
    static neighbours(kind, id, options = {}) {
        return this.forEntity(kind, id, options).map((edge) => {
            const other = (edge.from.kind === kind && edge.from.id === id) ? edge.to : edge.from;
            return { edge, kind: other.kind, id: other.id };
        });
    }

    static findBetween(from, to, options = {}) {
        return this.list(options).find((edge) =>
            (edge.from.kind === from.kind && edge.from.id === from.id
                && edge.to.kind === to.kind && edge.to.id === to.id)
            || (edge.to.kind === from.kind && edge.to.id === from.id
                && edge.from.kind === to.kind && edge.from.id === to.id)) || null;
    }

    /**
     * Create a player-authored edge. Endpoints must already be discovered — you
     * cannot relate something you have never seen.
     */
    static create({ type = RELATIONSHIP_TYPES.RELATED_TO, from, to, note = '' } = {}, { caseId = activeCaseId() } = {}) {
        if (!from?.kind || !from?.id || !to?.kind || !to?.id) {
            return { ok: false, reason: 'Both endpoints are required.' };
        }
        if (from.kind === to.kind && from.id === to.id) {
            return { ok: false, reason: 'An item cannot relate to itself.' };
        }

        const state = getCaseStateSafe(caseId);
        if (!endpointVisible(from.kind, from.id, state) || !endpointVisible(to.kind, to.id, state)) {
            return { ok: false, reason: 'Both items must be logged before they can be connected.' };
        }

        const key = [from, to].map((endpoint) => `${endpoint.kind}:${endpoint.id}`).sort().join('|');
        const duplicate = this.list({ caseId, includeHidden: true }).find((edge) => {
            const edgeKey = [edge.from, edge.to]
                .map((endpoint) => `${endpoint.kind}:${endpoint.id}`).sort().join('|');
            return edgeKey === key && edge.type === type;
        });
        if (duplicate) return { ok: false, reason: 'That connection already exists.', edge: duplicate };

        const edge = {
            id: `rel-player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            from: { kind: from.kind, id: from.id },
            to: { kind: to.kind, id: to.id },
            note,
            confirmed: true,
            createdAt: new Date().toISOString(),
        };

        updateCase(caseId, (draft) => { draft.relationships.push(edge); });
        gameStore.patch(['counters'], (counters) => ({
            ...counters,
            relationshipsCreated: (counters.relationshipsCreated || 0) + 1,
        }));
        announce(EVENTS.RELATIONSHIP_CREATED, { caseId, edge });
        return { ok: true, edge };
    }

    /** Authored edges belong to the case; only player edges can be deleted. */
    static remove(edgeId, { caseId = activeCaseId() } = {}) {
        const edge = this.get(edgeId, { caseId });
        if (!edge || edge.origin !== 'player') return false;
        updateCase(caseId, (draft) => {
            draft.relationships = draft.relationships.filter((entry) => entry.id !== edgeId);
        });
        announce(EVENTS.RELATIONSHIP_REMOVED, { caseId, edgeId });
        return true;
    }
}

systems.relationships = RelationshipSystem;
export default RelationshipSystem;
