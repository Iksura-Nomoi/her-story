/**
 * Her-Story — evidence board system.
 *
 * Owns the board's layout and the player's theories. Layout lives in game state
 * so it survives reloads, and theories reference evidence by id rather than
 * copying it, so a theory can never drift out of sync with the Locker.
 */

import { EVENTS, announce } from '../core/events.js';
import { gameStore, updateCase, getCaseStateSafe } from '../core/GameState.js';
import { systems } from './registry.js';

const activeCaseId = () => gameStore.getState().activeCaseId;

const DEFAULT_COLUMNS = 4;
const CELL = { x: 240, y: 190 };
const ORIGIN = { x: 48, y: 40 };

/** Deterministic fallback position for a card the player hasn't placed yet. */
export function autoPosition(index) {
    return {
        x: ORIGIN.x + (index % DEFAULT_COLUMNS) * CELL.x,
        y: ORIGIN.y + Math.floor(index / DEFAULT_COLUMNS) * CELL.y,
    };
}

export class BoardSystem {
    static board({ caseId = activeCaseId() } = {}) {
        const state = getCaseStateSafe(caseId);
        return state.board || { nodes: {}, groups: [], theories: [] };
    }

    /** Cards to draw: discovered evidence resolved with its board position. */
    static nodes({ caseId = activeCaseId() } = {}) {
        const board = this.board({ caseId });
        return (systems.evidence?.list({ caseId }) || []).map((item, index) => {
            const placed = board.nodes?.[item.id];
            return {
                evidence: item,
                position: placed || autoPosition(index),
                groupId: placed?.groupId || null,
            };
        });
    }

    static setNodePosition(evidenceId, { x, y }, { caseId = activeCaseId(), silent = false } = {}) {
        updateCase(caseId, (draft) => {
            if (!draft.board) draft.board = { nodes: {}, groups: [], theories: [] };
            draft.board.nodes = {
                ...draft.board.nodes,
                [evidenceId]: { ...(draft.board.nodes[evidenceId] || {}), x, y },
            };
        });
        if (!silent) announce(EVENTS.BOARD_NODE_MOVED, { caseId, evidenceId, x, y });
        return true;
    }

    static assignToGroup(evidenceId, groupId, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            if (!draft.board) draft.board = { nodes: {}, groups: [], theories: [] };
            draft.board.nodes = {
                ...draft.board.nodes,
                [evidenceId]: { ...(draft.board.nodes[evidenceId] || {}), groupId },
            };
        });
        return true;
    }

    /** Re-flow every card into the default grid. */
    static autoArrange({ caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            const board = { ...(draft.board || { nodes: {}, groups: [], theories: [] }) };
            const nodes = {};
            (systems.evidence?.list({ caseId }) || []).forEach((item, index) => {
                nodes[item.id] = { ...(board.nodes?.[item.id] || {}), ...autoPosition(index) };
            });
            draft.board = { ...board, nodes };
        });
        announce(EVENTS.BOARD_NODE_MOVED, { caseId, rearrange: true });
        return true;
    }

    static clearLayout({ caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            if (!draft.board) draft.board = { nodes: {}, groups: [], theories: [] };
            draft.board.nodes = {};
        });
        return true;
    }

    static addGroup({ label, colour = 'amber', evidenceIds = [] } = {}, { caseId = activeCaseId() } = {}) {
        const group = {
            id: `grp-${Date.now().toString(36)}`,
            label: label || 'Untitled group',
            colour,
            createdAt: new Date().toISOString(),
        };
        updateCase(caseId, (draft) => {
            if (!draft.board) draft.board = { nodes: {}, groups: [], theories: [] };
            draft.board.groups = [...draft.board.groups, group];
        });
        evidenceIds.forEach((id) => this.assignToGroup(id, group.id, { caseId }));
        return group;
    }

    static removeGroup(groupId, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            if (!draft.board) return;
            draft.board.groups = draft.board.groups.filter((group) => group.id !== groupId);
            Object.entries(draft.board.nodes || {}).forEach(([evidenceId, node]) => {
                if (node.groupId === groupId) draft.board.nodes[evidenceId] = { ...node, groupId: null };
            });
        });
        return true;
    }

    // -- theories ----------------------------------------------------------

    static theories({ caseId = activeCaseId() } = {}) {
        return this.board({ caseId }).theories || [];
    }

    static createTheory({ title, body = '', evidenceIds = [] } = {}, { caseId = activeCaseId() } = {}) {
        if (!title) return { ok: false, reason: 'Give the theory a title first.' };
        const theory = {
            id: `theory-${Date.now().toString(36)}`,
            title: String(title).slice(0, 120),
            body: String(body).slice(0, 4000),
            evidenceIds: evidenceIds.slice(0, 40),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        updateCase(caseId, (draft) => {
            if (!draft.board) draft.board = { nodes: {}, groups: [], theories: [] };
            draft.board.theories = [...draft.board.theories, theory];
        });
        announce(EVENTS.THEORY_UPDATED, { caseId, theoryId: theory.id, reason: 'created' });
        return { ok: true, theory };
    }

    static updateTheory(theoryId, patch = {}, { caseId = activeCaseId() } = {}) {
        let updated = null;
        updateCase(caseId, (draft) => {
            if (!draft.board) return;
            draft.board.theories = draft.board.theories.map((theory) => {
                if (theory.id !== theoryId) return theory;
                updated = { ...theory, ...patch, updatedAt: new Date().toISOString() };
                return updated;
            });
        });
        announce(EVENTS.THEORY_UPDATED, { caseId, theoryId, reason: 'updated' });
        return updated;
    }

    static removeTheory(theoryId, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            if (!draft.board) return;
            draft.board.theories = draft.board.theories.filter((theory) => theory.id !== theoryId);
        });
        announce(EVENTS.THEORY_UPDATED, { caseId, theoryId, reason: 'removed' });
        return true;
    }
}

systems.board = BoardSystem;
export default BoardSystem;
