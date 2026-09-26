/**
 * Her-Story — timeline system.
 *
 * Authored events come from `timeline.json` and become visible as they are
 * discovered. The player can also add reconstruction entries, which live in game
 * state (never in the authored file) with an explicit certainty level, so
 * speculation never masquerades as fact.
 */

import { EVENTS, announce, notify } from '../core/events.js';
import { gameStore, updateCase, getCaseStateSafe } from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { humanizeId } from '../ui/dom.js';
import { systems } from './registry.js';

export const CERTAINTY = Object.freeze({
    CONFIRMED: 'confirmed',
    LIKELY: 'likely',
    UNCONFIRMED: 'unconfirmed',
});

export const CERTAINTY_LABELS = Object.freeze({
    [CERTAINTY.CONFIRMED]: 'Confirmed',
    [CERTAINTY.LIKELY]: 'Likely',
    [CERTAINTY.UNCONFIRMED]: 'Unconfirmed',
});

const activeCaseId = () => gameStore.getState().activeCaseId;

export function timelineRecord(id, caseId = activeCaseId()) {
    return caseRepository.findRecord(caseId, 'timeline', id);
}

export function resolveEvent(record, caseState = getCaseStateSafe(activeCaseId())) {
    if (!record) return null;
    const playerEvent = (caseState.playerTimeline || []).find((entry) => entry.id === record.id);
    return {
        id: record.id,
        caseId: caseState.caseId,
        timestamp: record.timestamp || null,
        title: record.title || humanizeId(record.id),
        description: record.description || '',
        locationId: record.locationId || record.location || null,
        people: record.people || [],
        evidence: record.evidence || [],
        certainty: record.certainty || CERTAINTY.UNCONFIRMED,
        source: record.source || 'Case file',
        origin: playerEvent ? 'player' : 'case',
        discovered: caseState.timelineDiscovered.includes(record.id),
    };
}

export class TimelineSystem {
    static discover(id, { caseId = activeCaseId(), silent = false } = {}) {
        if (!id || !caseId) return { ok: false };
        const state = getCaseStateSafe(caseId);
        if (state.timelineDiscovered.includes(id)) return { ok: true, alreadyKnown: true };

        updateCase(caseId, (draft) => { draft.timelineDiscovered.push(id); });
        const record = timelineRecord(id, caseId);
        announce(EVENTS.TIMELINE_UPDATED, { caseId, eventId: id, reason: 'discovered' });
        if (!silent) notify('Timeline updated', record?.title || humanizeId(id), 'timeline');
        return { ok: true, alreadyKnown: false };
    }

    /** Authored (discovered) + player-added entries, sorted chronologically. */
    static list({ caseId = activeCaseId(), includeUndiscovered = false, includePlayer = true } = {}) {
        const record = caseRepository.getCase(caseId);
        if (!record) return [];
        const state = getCaseStateSafe(caseId);
        const authored = record.timeline
            .map((event) => resolveEvent(event, state))
            .filter((event) => event && (includeUndiscovered || event.discovered));
        const player = includePlayer
            ? (state.playerTimeline || []).map((event) => resolveEvent(event, state)).filter(Boolean)
            : [];
        return [...authored, ...player].sort((a, b) => {
            const left = a.timestamp || '9999';
            const right = b.timestamp || '9999';
            if (left === right) return String(a.title).localeCompare(String(b.title));
            return left > right ? 1 : -1;
        });
    }

    static get(id, options = {}) {
        return this.list(options).find((event) => event.id === id) || null;
    }

    static addPlayerEvent({
        timestamp, title, description = '', locationId = null,
        people = [], evidence = [], certainty = CERTAINTY.UNCONFIRMED,
    } = {}, { caseId = activeCaseId() } = {}) {
        if (!title) return { ok: false, reason: 'A title is required.' };
        const event = {
            id: `tl-player-${Date.now().toString(36)}`,
            timestamp: timestamp || new Date().toISOString(),
            title: String(title).slice(0, 120),
            description: String(description).slice(0, 2000),
            locationId,
            people,
            evidence,
            certainty,
            source: 'Investigator reconstruction',
            origin: 'player',
        };
        updateCase(caseId, (draft) => {
            if (!draft.playerTimeline) draft.playerTimeline = [];
            draft.playerTimeline.push(event);
            if (!draft.timelineDiscovered.includes(event.id)) draft.timelineDiscovered.push(event.id);
        });
        announce(EVENTS.TIMELINE_UPDATED, { caseId, eventId: event.id, reason: 'player-added' });
        return { ok: true, event };
    }

    static removePlayerEvent(eventId, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            draft.playerTimeline = (draft.playerTimeline || []).filter((entry) => entry.id !== eventId);
            draft.timelineDiscovered = draft.timelineDiscovered.filter((entry) => entry !== eventId);
        });
        announce(EVENTS.TIMELINE_UPDATED, { caseId, eventId, reason: 'player-removed' });
        return true;
    }

    static query({ text = '', certainty = 'all', personId = null, locationId = null } = {}, options = {}) {
        const needle = text.trim().toLowerCase();
        return this.list(options).filter((event) => {
            if (certainty !== 'all' && event.certainty !== certainty) return false;
            if (personId && !event.people.includes(personId)) return false;
            if (locationId && event.locationId !== locationId) return false;
            if (!needle) return true;
            return [event.id, event.title, event.description, event.source]
                .some((field) => String(field || '').toLowerCase().includes(needle));
        });
    }

    /** Earliest / latest timestamps, for the Timeline app's range header. */
    static range(options = {}) {
        const events = this.list(options).filter((event) => event.timestamp);
        if (events.length === 0) return { from: null, to: null };
        return { from: events[0].timestamp, to: events[events.length - 1].timestamp };
    }

    static certaintyCounts(options = {}) {
        return this.list(options).reduce((counts, event) => {
            counts[event.certainty] = (counts[event.certainty] || 0) + 1;
            return counts;
        }, {});
    }

    static evidenceFor(eventId, options = {}) {
        const event = this.get(eventId, options);
        return (event?.evidence || []).map((id) => systems.evidence?.get(id, options)).filter(Boolean);
    }
}

systems.timeline = TimelineSystem;
export default TimelineSystem;
