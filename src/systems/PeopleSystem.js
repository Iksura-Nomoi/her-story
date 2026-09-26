/**
 * Her-Story — people system.
 *
 * Person dossiers plus the glue that answers "what do we have on this person?" by
 * pulling from evidence, messages, the timeline and relationships. Nothing is
 * duplicated: a dossier only stores what a person *is*, never what the player has
 * attached to them.
 */

import { EVENTS, announce, notify } from '../core/events.js';
import { gameStore, updateCase, getCaseStateSafe } from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { humanizeId } from '../ui/dom.js';
import { systems } from './registry.js';

export const PERSON_STATUS = Object.freeze({
    UNKNOWN: 'unknown',
    SUBJECT: 'subject',
    PERSON_OF_INTEREST: 'person_of_interest',
    WITNESS: 'witness',
    VICTIM: 'victim',
    CLEARED: 'cleared',
});

export const PERSON_STATUS_LABELS = Object.freeze({
    [PERSON_STATUS.UNKNOWN]: 'Unclassified',
    [PERSON_STATUS.SUBJECT]: 'Subject',
    [PERSON_STATUS.PERSON_OF_INTEREST]: 'Person of interest',
    [PERSON_STATUS.WITNESS]: 'Witness',
    [PERSON_STATUS.VICTIM]: 'Victim',
    [PERSON_STATUS.CLEARED]: 'Cleared',
});

const activeCaseId = () => gameStore.getState().activeCaseId;

export function personRecord(id, caseId = activeCaseId()) {
    return caseRepository.findRecord(caseId, 'person', id);
}

export function resolvePerson(record, caseState = getCaseStateSafe(activeCaseId())) {
    if (!record) return null;
    return {
        id: record.id,
        caseId: caseState.caseId,
        name: record.name || humanizeId(record.id),
        role: record.role || 'Unassigned',
        status: (caseState.personStatus || {})[record.id] || record.status || PERSON_STATUS.UNKNOWN,
        description: record.description || '',
        aliases: record.aliases || [],
        notes: record.notes || '',
        knownLocations: record.knownLocations || [],
        associatedEvidence: record.associatedEvidence || [],
        messages: record.messages || [],
        timelineEvents: record.timelineEvents || [],
        metadata: record.metadata || {},
        discovered: caseState.peopleDiscovered.includes(record.id),
    };
}

export class PeopleSystem {
    static discover(id, { caseId = activeCaseId(), silent = false } = {}) {
        if (!id || !caseId) return { ok: false };
        const state = getCaseStateSafe(caseId);
        if (state.peopleDiscovered.includes(id)) return { ok: true, alreadyKnown: true };

        updateCase(caseId, (draft) => {
            draft.peopleDiscovered.push(id);
            if (!draft.discoveryLog) draft.discoveryLog = [];
            draft.discoveryLog.push({ personId: id, at: new Date().toISOString() });
        });

        const record = personRecord(id, caseId);
        const reveals = record?.reveals || {};
        (reveals.locations || []).forEach((entry) => systems.locations?.discover(entry, { caseId, silent }));
        (reveals.evidence || []).forEach((entry) => systems.evidence?.discover(entry, { caseId, silent }));
        (reveals.timeline || []).forEach((entry) => systems.timeline?.discover(entry, { caseId, silent }));

        announce(EVENTS.PERSON_DISCOVERED, { caseId, personId: id });
        if (!silent) notify('Person identified', record?.name || humanizeId(id), 'person');
        return { ok: true, alreadyKnown: false };
    }

    static setStatus(id, status, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            draft.personStatus = { ...(draft.personStatus || {}), [id]: status };
        });
        announce(EVENTS.PERSON_UPDATED, { caseId, personId: id, status });
        return true;
    }

    static list({ caseId = activeCaseId(), includeUndiscovered = false } = {}) {
        const record = caseRepository.getCase(caseId);
        if (!record) return [];
        const state = getCaseStateSafe(caseId);
        return record.people
            .map((person) => resolvePerson(person, state))
            .filter((person) => person && (includeUndiscovered || person.discovered));
    }

    static get(id, options = {}) {
        return this.list(options).find((person) => person.id === id) || null;
    }

    static displayName(id, options = {}) {
        return this.get(id, options)?.name || humanizeId(id);
    }

    static query({ text = '', status = 'all', sort: sortKey = 'name', order = 'asc' } = {}, options = {}) {
        const needle = text.trim().toLowerCase();
        let people = this.list(options);
        if (status !== 'all') people = people.filter((person) => person.status === status);
        if (needle) {
            people = people.filter((person) => [
                person.id, person.name, person.role, person.description, ...person.aliases,
            ].some((field) => String(field || '').toLowerCase().includes(needle)));
        }
        const accessors = {
            name: (person) => person.name.toLowerCase(),
            status: (person) => person.status,
            role: (person) => person.role.toLowerCase(),
            evidence: (person) => -this.evidenceFor(person.id, options).length,
        };
        const accessor = accessors[sortKey] || accessors.name;
        const factor = order === 'desc' ? -1 : 1;
        return people.slice().sort((a, b) => {
            const left = accessor(a);
            const right = accessor(b);
            if (left === right) return a.name.localeCompare(b.name) * factor;
            return left > right ? factor : -factor;
        });
    }

    /** Unique-by-id helper for the cross-links below. */
    static _dedupe(items) {
        const seen = new Set();
        return items.filter((item) => {
            if (!item || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });
    }

    /** Evidence that names this person, directly or through a relationship edge. */
    static evidenceFor(id, options = {}) {
        const direct = (systems.evidence?.list(options) || [])
            .filter((item) => item.relatedPeople.includes(id));
        const viaEdges = (systems.relationships?.neighbours('person', id, options) || [])
            .filter((neighbour) => neighbour.kind === 'evidence')
            .map((neighbour) => systems.evidence?.get(neighbour.id, options));
        return this._dedupe([...direct, ...viaEdges]);
    }

    static messagesFor(id, options = {}) {
        const person = this.get(id, options);
        const direct = (person?.messages || []).map((messageId) => systems.messages?.get(messageId, options));
        const involved = (systems.messages?.list(options) || [])
            .filter((message) => message.sender === id || (message.recipients || []).includes(id));
        return this._dedupe([...direct, ...involved]);
    }

    static timelineFor(id, options = {}) {
        return (systems.timeline?.list(options) || [])
            .filter((event) => (event.people || []).includes(id));
    }

    static locationsFor(id, options = {}) {
        const person = this.get(id, options);
        const direct = (person?.knownLocations || []).map((locationId) => systems.locations?.get(locationId, options));
        const involved = (systems.locations?.list(options) || [])
            .filter((location) => (location.people || []).includes(id));
        return this._dedupe([...direct, ...involved]);
    }

    static relationshipsFor(id, options = {}) {
        return systems.relationships?.forEntity('person', id, options) || [];
    }

    static statusCounts(options = {}) {
        return this.list(options).reduce((counts, person) => {
            counts[person.status] = (counts[person.status] || 0) + 1;
            return counts;
        }, {});
    }
}

systems.people = PeopleSystem;
export default PeopleSystem;
