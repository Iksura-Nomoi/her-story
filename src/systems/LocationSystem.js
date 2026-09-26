/**
 * Her-Story — location system.
 *
 * Locations carry an approximate position on a normalised 0..100 map plane, the
 * people and evidence attached to them, and the links between them. The
 * Investigation Map renders exactly this data.
 */

import { EVENTS, announce, notify } from '../core/events.js';
import { gameStore, updateCase, getCaseStateSafe } from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { humanizeId } from '../ui/dom.js';
import { systems } from './registry.js';

export const LOCATION_TYPES = Object.freeze({
    RESIDENCE: 'residence',
    WORKPLACE: 'workplace',
    COMMERCIAL: 'commercial',
    PUBLIC: 'public',
    TRANSIT: 'transit',
    STORAGE: 'storage',
    REMOTE: 'remote',
    UNKNOWN: 'unknown',
});

export const LOCATION_TYPE_LABELS = Object.freeze({
    [LOCATION_TYPES.RESIDENCE]: 'Residence',
    [LOCATION_TYPES.WORKPLACE]: 'Workplace',
    [LOCATION_TYPES.COMMERCIAL]: 'Commercial',
    [LOCATION_TYPES.PUBLIC]: 'Public space',
    [LOCATION_TYPES.TRANSIT]: 'Transit',
    [LOCATION_TYPES.STORAGE]: 'Storage',
    [LOCATION_TYPES.REMOTE]: 'Remote / off-site',
    [LOCATION_TYPES.UNKNOWN]: 'Unclassified',
});

const activeCaseId = () => gameStore.getState().activeCaseId;

function dedupeById(items) {
    const seen = new Set();
    return items.filter((item) => {
        if (!item || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

export function locationRecord(id, caseId = activeCaseId()) {
    return caseRepository.findRecord(caseId, 'location', id);
}

export function resolveLocation(record, caseState = getCaseStateSafe(activeCaseId())) {
    if (!record) return null;
    return {
        id: record.id,
        caseId: caseState.caseId,
        name: record.name || humanizeId(record.id),
        type: record.type || LOCATION_TYPES.UNKNOWN,
        description: record.description || '',
        address: record.address || '',
        grid: record.grid || 'unmapped',
        coordinates: record.coordinates || null,
        people: record.people || [],
        evidence: record.evidence || [],
        timelineEvents: record.timelineEvents || [],
        connectedLocations: record.connectedLocations || [],
        metadata: record.metadata || {},
        discovered: caseState.locationsDiscovered.includes(record.id),
    };
}

export class LocationSystem {
    static discover(id, { caseId = activeCaseId(), silent = false } = {}) {
        if (!id || !caseId) return { ok: false };
        const state = getCaseStateSafe(caseId);
        if (state.locationsDiscovered.includes(id)) return { ok: true, alreadyKnown: true };

        updateCase(caseId, (draft) => {
            draft.locationsDiscovered.push(id);
            if (!draft.discoveryLog) draft.discoveryLog = [];
            draft.discoveryLog.push({ locationId: id, at: new Date().toISOString() });
        });

        const record = locationRecord(id, caseId);
        const reveals = record?.reveals || {};
        (reveals.people || []).forEach((entry) => systems.people?.discover(entry, { caseId, silent }));
        (reveals.evidence || []).forEach((entry) => systems.evidence?.discover(entry, { caseId, silent }));

        announce(EVENTS.LOCATION_DISCOVERED, { caseId, locationId: id });
        if (!silent) notify('Location mapped', record?.name || humanizeId(id), 'location');
        return { ok: true, alreadyKnown: false };
    }

    static list({ caseId = activeCaseId(), includeUndiscovered = false } = {}) {
        const record = caseRepository.getCase(caseId);
        if (!record) return [];
        const state = getCaseStateSafe(caseId);
        return record.locations
            .map((location) => resolveLocation(location, state))
            .filter((location) => location && (includeUndiscovered || location.discovered));
    }

    static get(id, options = {}) {
        return this.list(options).find((location) => location.id === id) || null;
    }

    static displayName(id, options = {}) {
        return this.get(id, options)?.name || humanizeId(id);
    }

    /** Points for the map, falling back to a stable spread when unplaced. */
    static mapPoints(options = {}) {
        const fallback = [
            { x: 22, y: 30 }, { x: 58, y: 22 }, { x: 41, y: 54 },
            { x: 76, y: 45 }, { x: 30, y: 75 }, { x: 66, y: 72 },
            { x: 85, y: 64 }, { x: 50, y: 87 },
        ];
        return this.list(options).map((location, index) => ({
            ...location,
            point: location.coordinates || fallback[index % fallback.length],
        }));
    }

    static evidenceFor(id, options = {}) {
        const location = this.get(id, options);
        const direct = (location?.evidence || []).map((entry) => systems.evidence?.get(entry, options));
        const located = (systems.evidence?.list(options) || [])
            .filter((item) => item.location === id || (item.discovery || {}).location === id);
        return dedupeById([...direct, ...located]);
    }

    static peopleFor(id, options = {}) {
        const location = this.get(id, options);
        const direct = (location?.people || []).map((entry) => systems.people?.get(entry, options));
        const viaEdges = (systems.relationships?.neighbours('location', id, options) || [])
            .filter((neighbour) => neighbour.kind === 'person')
            .map((neighbour) => systems.people?.get(neighbour.id, options));
        return dedupeById([...direct, ...viaEdges]);
    }

    static connectionsFor(id, options = {}) {
        const location = this.get(id, options);
        const declared = (location?.connectedLocations || []).map((entry) => this.get(entry, options));
        const viaEdges = (systems.relationships?.neighbours('location', id, options) || [])
            .filter((neighbour) => neighbour.kind === 'location')
            .map((neighbour) => this.get(neighbour.id, options));
        return dedupeById([...declared, ...viaEdges]);
    }

    static typeCounts(options = {}) {
        return this.list(options).reduce((counts, location) => {
            counts[location.type] = (counts[location.type] || 0) + 1;
            return counts;
        }, {});
    }
}

systems.locations = LocationSystem;
export default LocationSystem;
