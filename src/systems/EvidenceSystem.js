/**
 * Her-Story — evidence system.
 *
 * One place decides what evidence exists, whether the player has found it,
 * whether it has been verified and what it points at. Every other application
 * (Locker, Board, Terminal, Reports, Media Viewer, Analysis Lab) reads through
 * this module, so evidence found inside Messages is instantly visible in the
 * Evidence Locker.
 */

import { EVENTS, announce, notify } from '../core/events.js';
import { gameStore, updateCase, getCaseStateSafe, VERIFICATION_STATUS } from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { AudioController } from '../core/AudioController.js';
import { humanizeId, unique } from '../ui/dom.js';
import { systems } from './registry.js';

export const EVIDENCE_TYPES = Object.freeze({
    IMAGE: 'image',
    DOCUMENT: 'document',
    VIDEO: 'video',
    AUDIO: 'audio',
    PHYSICAL: 'physical',
    DIGITAL: 'digital',
    TESTIMONY: 'testimony',
});

export const EVIDENCE_TYPE_LABELS = Object.freeze({
    [EVIDENCE_TYPES.IMAGE]: 'Image',
    [EVIDENCE_TYPES.DOCUMENT]: 'Document',
    [EVIDENCE_TYPES.VIDEO]: 'Video',
    [EVIDENCE_TYPES.AUDIO]: 'Audio',
    [EVIDENCE_TYPES.PHYSICAL]: 'Physical',
    [EVIDENCE_TYPES.DIGITAL]: 'Digital',
    [EVIDENCE_TYPES.TESTIMONY]: 'Testimony',
});

export const RELIABILITY = Object.freeze({
    CONFIRMED: 'confirmed',
    PROBABLE: 'probable',
    UNCERTAIN: 'uncertain',
    UNKNOWN: 'unknown',
});

export const RELIABILITY_LABELS = Object.freeze({
    [RELIABILITY.CONFIRMED]: 'Confirmed',
    [RELIABILITY.PROBABLE]: 'Probable',
    [RELIABILITY.UNCERTAIN]: 'Uncertain',
    [RELIABILITY.UNKNOWN]: 'Unknown',
});

const activeCaseId = () => gameStore.getState().activeCaseId;

/** Authored record for an evidence id inside a case (may be null). */
export function evidenceRecord(id, caseId = activeCaseId()) {
    return caseRepository.findRecord(caseId, 'evidence', id);
}

/** Merge authored data with player state into the shape applications consume. */
export function resolveEvidence(record, caseState = getCaseStateSafe(activeCaseId())) {
    if (!record) return null;
    return {
        id: record.id,
        caseId: caseState.caseId,
        title: record.title || humanizeId(record.id),
        type: record.type || EVIDENCE_TYPES.DIGITAL,
        description: record.description || '',
        source: record.source || 'Unknown',
        discovery: record.discovery || {},
        timestamp: record.timestamp || null,
        location: record.location || null,
        relatedPeople: unique(record.relatedPeople || []),
        relatedEvidence: unique(record.relatedEvidence || []),
        reliability: record.reliability || RELIABILITY.UNKNOWN,
        tags: unique([...(record.tags || []), ...((caseState.tags || {})[record.id] || [])]),
        metadata: record.metadata || {},
        media: record.media || null,
        reveals: record.reveals || {},
        discovered: caseState.discoveredEvidence.includes(record.id),
        verified: caseState.verifiedEvidence.includes(record.id),
        inspected: caseState.inspectedEvidence.includes(record.id),
        verification: (caseState.verification || {})[record.id]
            || record.status
            || VERIFICATION_STATUS.UNVERIFIED,
        analysis: (caseState.analysis || {})[record.id] || null,
        summary: record.summary || record.discovery?.method || record.description || '',
    };
}

/** Follow an evidence record's `reveals` block into the other systems. */
function revealLinked(record, caseId, { silent = true } = {}) {
    const reveals = record?.reveals || {};
    const options = { caseId, silent };
    (reveals.people || []).forEach((id) => systems.people?.discover(id, options));
    (reveals.locations || []).forEach((id) => systems.locations?.discover(id, options));
    (reveals.timeline || []).forEach((id) => systems.timeline?.discover(id, options));
    (reveals.messages || []).forEach((id) => systems.messages?.discover(id, options));
    (reveals.evidence || []).forEach((id) => systems.evidence?.discover(id, { ...options, silent: true }));
}

export class EvidenceSystem {
    /**
     * Log evidence into the case. Idempotent: discovering the same id twice is a
     * no-op, which makes it safe to call from Messages, the Terminal or case load.
     */
    static discover(id, { caseId = activeCaseId(), method = null, source = null, silent = false } = {}) {
        if (!id || !caseId) return { ok: false, alreadyKnown: false, evidence: null };
        const record = evidenceRecord(id, caseId);
        const state = getCaseStateSafe(caseId);
        if (state.discoveredEvidence.includes(id)) {
            return { ok: true, alreadyKnown: true, evidence: resolveEvidence(record, state) };
        }

        updateCase(caseId, (draft) => {
            draft.discoveredEvidence.push(id);
            if (!draft.discoveryLog) draft.discoveryLog = [];
            draft.discoveryLog.push({
                evidenceId: id,
                method: method || record?.discovery?.method || 'Direct entry',
                source: source || record?.source || 'Field work',
                at: new Date().toISOString(),
            });
        });

        const resolved = resolveEvidence(record, getCaseStateSafe(caseId));
        gameStore.patch(['counters'], (counters) => ({
            ...counters,
            evidenceDiscovered: (counters.evidenceDiscovered || 0) + 1,
        }));

        if (record) revealLinked(record, caseId, { silent });
        announce(EVENTS.EVIDENCE_DISCOVERED, { caseId, evidenceId: id, evidence: resolved, method, silent });
        if (!silent) {
            AudioController.evidenceFound();
            notify('Evidence logged', resolved?.title || humanizeId(id), 'evidence');
        }
        return { ok: true, alreadyKnown: false, evidence: resolved };
    }

    /** Bulk discover — used when a case opens with pre-collected material. */
    static discoverMany(ids = [], options = {}) {
        return ids.map((id) => this.discover(id, { ...options, silent: options.silent !== false }));
    }

    static verify(id, { caseId = activeCaseId(), silent = false } = {}) {
        const state = getCaseStateSafe(caseId);
        if (!state.discoveredEvidence.includes(id) || state.verifiedEvidence.includes(id)) return false;
        updateCase(caseId, (draft) => {
            draft.verifiedEvidence.push(id);
            draft.verification = { ...(draft.verification || {}), [id]: VERIFICATION_STATUS.VERIFIED };
        });
        gameStore.patch(['counters'], (counters) => ({
            ...counters,
            evidenceVerified: (counters.evidenceVerified || 0) + 1,
        }));
        announce(EVENTS.EVIDENCE_VERIFIED, { caseId, evidenceId: id });
        if (!silent) {
            AudioController.verified();
            notify('Evidence verified', evidenceRecord(id, caseId)?.title || humanizeId(id), 'success');
        }
        return true;
    }

    static unverify(id, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            draft.verifiedEvidence = draft.verifiedEvidence.filter((entry) => entry !== id);
            draft.verification = { ...(draft.verification || {}), [id]: VERIFICATION_STATUS.UNVERIFIED };
        });
        announce(EVENTS.EVIDENCE_UNVERIFIED, { caseId, evidenceId: id });
        return true;
    }

    static markInspected(id, { caseId = activeCaseId() } = {}) {
        const state = getCaseStateSafe(caseId);
        if (state.inspectedEvidence.includes(id)) return false;
        updateCase(caseId, (draft) => { draft.inspectedEvidence.push(id); });
        announce(EVENTS.EVIDENCE_INSPECTED, { caseId, evidenceId: id });
        return true;
    }

    static addTag(id, tag, { caseId = activeCaseId() } = {}) {
        const clean = String(tag || '').trim().slice(0, 32);
        if (!clean) return false;
        updateCase(caseId, (draft) => {
            const tags = { ...(draft.tags || {}) };
            tags[id] = unique([...(tags[id] || []), clean]);
            draft.tags = tags;
        });
        announce(EVENTS.EVIDENCE_TAGGED, { caseId, evidenceId: id, tag: clean });
        return true;
    }

    static removeTag(id, tag, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            const tags = { ...(draft.tags || {}) };
            tags[id] = (tags[id] || []).filter((entry) => entry !== tag);
            draft.tags = tags;
        });
        announce(EVENTS.EVIDENCE_TAGGED, { caseId, evidenceId: id, tag: null });
        return true;
    }

    // -- reads -------------------------------------------------------------

    /** Every evidence record in the case, resolved. Undiscovered ones included. */
    static listAll({ caseId = activeCaseId(), includeUndiscovered = true } = {}) {
        const record = caseRepository.getCase(caseId);
        if (!record) return [];
        const state = getCaseStateSafe(caseId);
        return record.evidence
            .map((item) => resolveEvidence(item, state))
            .filter((item) => item && (includeUndiscovered || item.discovered));
    }

    /** What the player has actually logged. Most apps want this. */
    static list(options = {}) {
        return this.listAll({ ...options, includeUndiscovered: false });
    }

    static get(id, options = {}) {
        return this.list(options).find((item) => item.id === id) || null;
    }

    /** Declared type counts for filters. */
    static typeCounts(options = {}) {
        return this.list(options).reduce((counts, item) => {
            counts[item.type] = (counts[item.type] || 0) + 1;
            return counts;
        }, {});
    }

    static tagList(options = {}) {
        const tags = new Set();
        this.list(options).forEach((item) => item.tags.forEach((tag) => tags.add(tag)));
        return Array.from(tags).sort();
    }

    /**
     * Search + filter + sort used by the Locker and Terminal.
     * @param {{ text?: string, type?: string, verification?: string, tag?: string,
     *           reliability?: string, onlyVerified?: boolean, sort?: string, order?: string }} options
     */
    static query(options = {}) {
        const {
            text = '', type = 'all', verification = 'all', tag = 'all',
            reliability = 'all', sort: sortKey = 'discovered', order = 'desc',
        } = options;

        const needle = text.trim().toLowerCase();
        let items = this.list(options);

        if (type !== 'all') items = items.filter((item) => item.type === type);
        if (verification !== 'all') {
            items = items.filter((item) => (verification === 'verified' ? item.verified : !item.verified));
        }
        if (reliability !== 'all') items = items.filter((item) => item.reliability === reliability);
        if (tag !== 'all') items = items.filter((item) => item.tags.includes(tag));
        if (needle) {
            items = items.filter((item) => [
                item.id, item.title, item.description, item.source, item.summary,
                ...item.tags, ...Object.values(item.metadata || {}).map(String),
            ].some((field) => String(field || '').toLowerCase().includes(needle)));
        }

        const accessors = {
            title: (item) => item.title.toLowerCase(),
            type: (item) => item.type,
            timestamp: (item) => item.timestamp || '',
            reliability: (item) => item.reliability,
            status: (item) => (item.verified ? 1 : 0),
            discovered: (item) => item.timestamp || item.id,
        };
        const accessor = accessors[sortKey] || accessors.discovered;
        const factor = order === 'asc' ? 1 : -1;
        return items.slice().sort((a, b) => {
            const left = accessor(a);
            const right = accessor(b);
            if (left === right) return a.id.localeCompare(b.id);
            return left > right ? factor : -factor;
        });
    }

    /** Evidence linked to an item through `relatedEvidence` and relationships. */
    static relatedEvidence(id, options = {}) {
        const item = this.get(id, options);
        if (!item) return [];
        const relatedIds = new Set(item.relatedEvidence);
        systems.relationships?.list(options).forEach((edge) => {
            if (edge.from.kind === 'evidence' && edge.from.id === id && edge.to.kind === 'evidence') relatedIds.add(edge.to.id);
            if (edge.to.kind === 'evidence' && edge.to.id === id && edge.from.kind === 'evidence') relatedIds.add(edge.from.id);
        });
        relatedIds.delete(id);
        return Array.from(relatedIds)
            .map((relatedId) => this.get(relatedId, options))
            .filter(Boolean);
    }

    static counts(options = {}) {
        const items = this.list(options);
        return {
            total: items.length,
            verified: items.filter((item) => item.verified).length,
            unverified: items.filter((item) => !item.verified).length,
            inspected: items.filter((item) => item.inspected).length,
        };
    }
}

systems.evidence = EvidenceSystem;
export default EvidenceSystem;
