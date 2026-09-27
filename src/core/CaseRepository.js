/**
 * Her-Story — case data repository.
 *
 * Case content is data, never code. A case lives in `public/data/cases/<dir>/`
 * as a small set of JSON files:
 *
 *   case.json          docket metadata, objectives, analysis tools, terminal files,
 *                      and the *starting* visibility lists
 *   evidence.json      evidence records
 *   people.json        person dossiers
 *   locations.json     locations
 *   timeline.json      timeline events
 *   messages.json      recovered messages
 *   relationships.json relationship edges between any two records
 *
 * `index.json` is the manifest the Case Manager lists. Only the active case's
 * files are fetched — the manifest alone is enough to render every other row.
 */

const DEFAULT_ROOT = './data/cases';
const CASE_FILES = ['case', 'evidence', 'people', 'locations', 'timeline', 'messages', 'relationships'];

/** Records may be written as `{ items: [...] }` or as a bare array. */
function asArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    return [];
}

function indexBy(records, key = 'id') {
    const map = new Map();
    records.forEach((record) => {
        if (record && record[key]) map.set(record[key], record);
    });
    return map;
}

export class CaseRepository {
    constructor(root = DEFAULT_ROOT) {
        this.root = root;
        this._manifest = null;
        this._cases = new Map();
        this._pending = new Map();
    }

    // -- manifest ---------------------------------------------------------

    async loadManifest({ force = false } = {}) {
        if (this._manifest && !force) return this._manifest;
        const payload = await this._fetchJson(`${this.root}/index.json`);
        this._manifest = {
            schemaVersion: payload?.schemaVersion || 1,
            updated: payload?.updated || null,
            cases: Array.isArray(payload?.cases) ? payload.cases : [],
        };
        return this._manifest;
    }

    getManifest() {
        return this._manifest;
    }

    /** Case list rows for the Case Manager (no per-case fetch required). */
    listCaseSummaries() {
        return (this._manifest?.cases || []).slice();
    }

    getManifestEntry(caseId) {
        return (this._manifest?.cases || []).find((entry) => entry.id === caseId) || null;
    }

    // -- case loading -----------------------------------------------------

    /**
     * Load and normalise one case. Repeat calls are served from cache; pass
     * `{ force: true }` after editing data files.
     */
    async loadCase(caseId, { force = false } = {}) {
        if (!caseId) throw new Error('loadCase() requires a caseId');
        if (this._cases.has(caseId) && !force) return this._cases.get(caseId);
        if (this._pending.has(caseId) && !force) return this._pending.get(caseId);

        const entry = this.getManifestEntry(caseId);
        const directory = entry?.directory || caseId;

        const job = (async () => {
            const payloads = await Promise.all(CASE_FILES.map((name) =>
                this._fetchJson(`${this.root}/${directory}/${name}.json`)));

            const raw = {};
            CASE_FILES.forEach((name, i) => { raw[name] = payloads[i]; });

            const record = this._normalize(caseId, entry, raw);
            this._cases.set(caseId, record);
            this._pending.delete(caseId);
            return record;
        })();

        this._pending.set(caseId, job);
        return job;
    }

    /** Synchronous read of an already-loaded case. */
    getCase(caseId) {
        return this._cases.get(caseId) || null;
    }

    isLoaded(caseId) {
        return this._cases.has(caseId);
    }

    loadedCaseIds() {
        return Array.from(this._cases.keys());
    }

    /** Drop cached case data (used by Settings -> reload content). */
    clear(caseId = null) {
        if (caseId) this._cases.delete(caseId);
        else {
            this._cases.clear();
            this._manifest = null;
        }
    }

    // -- internals --------------------------------------------------------

    async _fetchJson(url) {
        // Plain static servers (no vite) serve these under `public/…`.
        const candidates = [url];
        if (!/^(public\/|https?:|data:|blob:)/.test(url)) candidates.push(`public/${url.replace(/^\.\//, '')}`);
        for (const candidate of candidates) {
            try {
                const response = await fetch(candidate, { cache: 'no-cache' });
                if (!response.ok) continue;
                return await response.json();
            } catch (error) {
                continue;
            }
        }
        console.warn(`[Her-Story] could not load ${url}`);
        return null;
    }

    _normalize(caseId, manifestEntry, raw) {
        const meta = {
            id: caseId,
            title: raw.case?.title || manifestEntry?.title || caseId,
            subtitle: raw.case?.subtitle || manifestEntry?.subtitle || '',
            description: raw.case?.description || manifestEntry?.summary || '',
            status: raw.case?.status || manifestEntry?.status || 'new',
            classification: raw.case?.classification || 'placeholder',
            tags: raw.case?.tags || manifestEntry?.tags || [],
            briefing: raw.case?.briefing || { summary: '', paragraphs: [] },
            openingNote: raw.case?.openingNote || '',
        };

        const evidence = asArray(raw.evidence);
        const people = asArray(raw.people);
        const locations = asArray(raw.locations);
        const timeline = asArray(raw.timeline);
        const messages = asArray(raw.messages);
        const relationships = asArray(raw.relationships);
        const objectives = asArray(raw.case?.objectives);

        return {
            caseId,
            directory: manifestEntry?.directory || caseId,
            meta,
            objectives,
            analysisTools: asArray(raw.case?.analysis),
            terminalFiles: asArray(raw.case?.terminal),
            start: {
                evidence: raw.case?.start?.evidence || [],
                people: raw.case?.start?.people || [],
                locations: raw.case?.start?.locations || [],
                timeline: raw.case?.start?.timeline || [],
                messages: raw.case?.start?.messages || [],
            },
            evidence,
            people,
            locations,
            timeline,
            messages,
            relationships,
            indexes: {
                evidence: indexBy(evidence),
                people: indexBy(people),
                locations: indexBy(locations),
                timeline: indexBy(timeline),
                messages: indexBy(messages),
                objectives: indexBy(objectives),
            },
        };
    }

    /** Look up any record inside an already-loaded case. */
    findRecord(caseId, kind, id) {
        const record = this.getCase(caseId);
        if (!record || !id) return null;
        const table = record.indexes?.[kind];
        return table ? (table.get(id) || null) : null;
    }
}

export const caseRepository = new CaseRepository();
export default caseRepository;
