/**
 * Her-Story — analysis lab foundation.
 *
 * The Lab never invents conclusions. Every "tool" below is a deterministic
 * reduction over data that already exists: field coverage, metadata pairs, text
 * statistics, timestamp sanity and relationship counts. A case can add its own
 * tools in `case.json` (`analysis: [...]`), and their output is merged in the
 * same shape, so scripting content stays a data job.
 */

import { EVENTS, announce } from '../core/events.js';
import { gameStore, updateCase, getCaseStateSafe, ANALYSIS_STATUS } from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { humanizeId, formatDateTime } from '../ui/dom.js';
import { systems } from './registry.js';

const activeCaseId = () => gameStore.getState().activeCaseId;
const PROCESS_DELAY_MS = 1400;

/** Turn an object into sorted `key: value` finding lines. */
function metadataFindings(item) {
    const entries = Object.entries(item.metadata || {});
    if (entries.length === 0) return ['No embedded metadata fields are present on this record.'];
    return entries.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
}

function wordStats(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim().length > 0);
    return { words: words.length, characters: String(text || '').length, lines: lines.length };
}

/** Built-in tool catalogue. `run` returns an array of finding strings. */
export const BUILTIN_TOOLS = Object.freeze([
    {
        id: 'record-inspection',
        label: 'Record Inspection',
        description: 'Structural summary: populated fields, linked records and open flags.',
        appliesTo: ['*'],
        run: (item) => [
            `Record type: ${item.type}`,
            `Fields populated: ${[
                item.description && 'description', item.source && 'source',
                item.timestamp && 'timestamp', item.location && 'location',
            ].filter(Boolean).join(', ') || 'none'}`,
            `Linked people: ${item.relatedPeople.length}; linked evidence: ${item.relatedEvidence.length}`,
            `Verification state: ${item.verification}`,
        ],
    },
    {
        id: 'metadata-extraction',
        label: 'Metadata Extraction',
        description: 'Lists every embedded metadata field exactly as stored.',
        appliesTo: ['image', 'document', 'digital', 'video', 'audio'],
        run: (item) => metadataFindings(item),
    },
    {
        id: 'text-analysis',
        label: 'Text Analysis',
        description: 'Word, character and line counts for written material.',
        appliesTo: ['document', 'testimony', 'digital'],
        run: (item) => {
            const stats = wordStats(`${item.description}\n${item.summary}`);
            return [
                `Characters: ${stats.characters}`,
                `Words: ${stats.words}`,
                `Non-empty lines: ${stats.lines}`,
                `Average word length: ${stats.words ? (stats.characters / stats.words).toFixed(1) : '0'} characters`,
            ];
        },
    },
    {
        id: 'timestamp-check',
        label: 'Timestamp Check',
        description: 'Validates the recorded timestamp and places it against the case timeline.',
        appliesTo: ['*'],
        run: (item, context) => {
            if (!item.timestamp) return ['No timestamp recorded on this record.'];
            const parsed = new Date(item.timestamp);
            const valid = !Number.isNaN(parsed.getTime());
            const events = systems.timeline?.list(context) || [];
            const around = events.filter((event) => event.timestamp
                && Math.abs(new Date(event.timestamp).getTime() - parsed.getTime()) < 86400000);
            return [
                `Recorded timestamp: ${valid ? formatDateTime(parsed) : 'unparseable'}`,
                `Timeline events on the same day: ${around.length}`,
                around.length ? `Nearby: ${around.map((event) => event.title).join('; ')}` : 'No same-day events logged yet.',
            ];
        },
    },
    {
        id: 'relationship-audit',
        label: 'Relationship Audit',
        description: 'Counts inbound and outbound connections for this record.',
        appliesTo: ['*'],
        run: (item, context) => {
            const edges = systems.relationships?.forEntity('evidence', item.id, context) || [];
            if (edges.length === 0) return ['No connections have been drawn for this record yet.'];
            return edges.map((edge) => {
                const other = edge.from.kind === 'evidence' && edge.from.id === item.id ? edge.to : edge.from;
                return `${edge.type} -> ${other.kind} ${other.id}`;
            });
        },
    },
]);

/** Tools for a case: built-ins plus any authored in `case.json`. */
export function toolCatalog(caseId = activeCaseId()) {
    const record = caseRepository.getCase(caseId);
    const authored = (record?.analysisTools || []).map((tool) => ({
        id: tool.id,
        label: tool.label || humanizeId(tool.id),
        description: tool.description || '',
        appliesTo: tool.appliesTo || ['*'],
        authored: true,
        run: (item) => (tool.findings || []).map((finding) =>
            String(finding).replaceAll('{title}', item.title).replaceAll('{id}', item.id)),
    }));
    return [...BUILTIN_TOOLS, ...authored];
}

export function toolApplies(tool, item) {
    return tool.appliesTo.includes('*') || tool.appliesTo.includes(item.type);
}

export class AnalysisSystem {
    static tools(caseId = activeCaseId()) {
        return toolCatalog(caseId);
    }

    static tool(toolId, caseId = activeCaseId()) {
        return toolCatalog(caseId).find((tool) => tool.id === toolId) || null;
    }

    /** Queue a tool run for one evidence item (analysis takes a moment). */
    static queue(evidenceId, toolId, { caseId = activeCaseId(), onComplete = null } = {}) {
        const item = systems.evidence?.get(evidenceId, { caseId });
        const tool = this.tool(toolId, caseId);
        if (!item) return { ok: false, reason: 'Unknown evidence record.' };
        if (!tool) return { ok: false, reason: 'Unknown analysis tool.' };
        if (!toolApplies(tool, item)) {
            return { ok: false, reason: `${tool.label} does not apply to ${item.type} records.` };
        }

        updateCase(caseId, (draft) => {
            draft.analysis = {
                ...(draft.analysis || {}),
                [evidenceId]: {
                    evidenceId,
                    tool: tool.id,
                    label: tool.label,
                    status: ANALYSIS_STATUS.QUEUED,
                    startedAt: new Date().toISOString(),
                    findings: (draft.analysis?.[evidenceId]?.findings) || [],
                },
            };
        });
        announce(EVENTS.ANALYSIS_QUEUED, { caseId, evidenceId, toolId });

        setTimeout(() => {
            const result = this.complete(evidenceId, tool.id, caseId);
            if (typeof onComplete === 'function') onComplete(result);
        }, PROCESS_DELAY_MS);

        return { ok: true, tool };
    }

    /** Run the tool for real and store the derived findings. */
    static complete(evidenceId, toolId, caseId = activeCaseId()) {
        const item = systems.evidence?.get(evidenceId, { caseId });
        const tool = this.tool(toolId, caseId);
        if (!item || !tool) return { ok: false, findings: [] };

        let findings = [];
        try {
            findings = tool.run(item, { caseId }) || [];
        } catch (error) {
            console.error('[Her-Story] analysis tool failed', error);
            findings = ['This tool could not read the record.'];
        }

        updateCase(caseId, (draft) => {
            draft.analysis = {
                ...(draft.analysis || {}),
                [evidenceId]: {
                    evidenceId,
                    tool: tool.id,
                    label: tool.label,
                    status: ANALYSIS_STATUS.COMPLETE,
                    startedAt: draft.analysis?.[evidenceId]?.startedAt || new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    findings,
                },
            };
        });
        gameStore.patch(['counters'], (counters) => ({
            ...counters,
            analysesRun: (counters.analysesRun || 0) + 1,
        }));
        announce(EVENTS.ANALYSIS_COMPLETED, { caseId, evidenceId, toolId, findings });
        return { ok: true, findings };
    }

    /** Any run left queued by a reload during processing. */
    static processPending(caseId = activeCaseId()) {
        const state = getCaseStateSafe(caseId);
        Object.values(state.analysis || {}).forEach((entry) => {
            if (entry?.status === ANALYSIS_STATUS.QUEUED && entry.tool) {
                this.complete(entry.evidenceId, entry.tool, caseId);
            }
        });
    }

    static findings(evidenceId, caseId = activeCaseId()) {
        return getCaseStateSafe(caseId).analysis?.[evidenceId]?.findings || [];
    }

    static entry(evidenceId, caseId = activeCaseId()) {
        return getCaseStateSafe(caseId).analysis?.[evidenceId] || null;
    }

    /** Completed runs, newest first — the Lab's activity list. */
    static history(caseId = activeCaseId()) {
        const state = getCaseStateSafe(caseId);
        return Object.values(state.analysis || {})
            .filter((entry) => entry && entry.status === ANALYSIS_STATUS.COMPLETE)
            .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
    }

    static counts(caseId = activeCaseId()) {
        const state = getCaseStateSafe(caseId);
        const entries = Object.values(state.analysis || {}).filter(Boolean);
        return {
            total: entries.length,
            queued: entries.filter((entry) => entry.status === ANALYSIS_STATUS.QUEUED).length,
            complete: entries.filter((entry) => entry.status === ANALYSIS_STATUS.COMPLETE).length,
        };
    }

    /**
     * Compare two records side by side — the basis of the comparison tools.
     * Reports measurable differences only, never a verdict.
     */
    static compare(leftId, rightId, caseId = activeCaseId()) {
        const left = systems.evidence?.get(leftId, { caseId });
        const right = systems.evidence?.get(rightId, { caseId });
        if (!left || !right) return { ok: false, rows: [], sharedPeople: [] };

        const rows = [
            { field: 'Type', left: left.type, right: right.type, matches: left.type === right.type },
            { field: 'Source', left: left.source, right: right.source, matches: left.source === right.source },
            { field: 'Timestamp', left: left.timestamp || '—', right: right.timestamp || '—', matches: left.timestamp === right.timestamp },
            { field: 'Location', left: left.location || '—', right: right.location || '—', matches: left.location === right.location },
            { field: 'Reliability', left: left.reliability, right: right.reliability, matches: left.reliability === right.reliability },
            { field: 'Verification', left: left.verification, right: right.verification, matches: left.verification === right.verification },
        ];
        return {
            ok: true,
            rows,
            sharedPeople: left.relatedPeople.filter((id) => right.relatedPeople.includes(id)),
            sharedTags: left.tags.filter((tag) => right.tags.includes(tag)),
        };
    }
}

systems.analysis = AnalysisSystem;
export default AnalysisSystem;
