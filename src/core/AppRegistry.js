/**
 * Her-Story — application registry.
 *
 * Every application in the investigation system is declared here exactly once:
 * identity, icon, description, window geometry, launch behaviour and the
 * conditions that unlock it. The shell (desktop icons, taskbar, launcher,
 * Alt+<slot> shortcuts) is generated from this list, so adding an application is
 * a data change rather than a rewrite of main.js.
 */

import { icon } from '../ui/icons.js';

/** Availability requirement kinds understood by `evaluateRequirements()`. */
export const REQUIREMENT = Object.freeze({
    APP: 'app',
    EVIDENCE: 'evidence',
    VERIFIED: 'verified',
    RELATIONSHIP: 'relationship',
    PEOPLE: 'people',
    MESSAGES_READ: 'messages-read',
    TIMELINE: 'timeline',
    FLAG: 'flag',
    OBJECTIVE: 'objective',
});

const def = (config) => ({
    singleton: true,
    desktop: true,
    taskbar: true,
    unlockRequirements: [],
    unlockReason: '',
    ...config,
});

/**
 * The ordered application catalogue. `load` is a lazy dynamic import so the
 * desktop boots without parsing every application's code up front.
 */
export const APP_DEFINITIONS = [
    def({
        id: 'case-manager',
        name: 'Case Manager',
        icon: icon('case-manager'),
        description: 'Open dockets, track objectives, case status and investigation progress.',
        category: 'Operations',
        slot: 1,
        window: { width: 1000, height: 660, minWidth: 620, minHeight: 420 },
        load: () => import('../apps/CaseManager/CaseManagerApp.js'),
    }),
    def({
        id: 'evidence-locker',
        name: 'Evidence Locker',
        icon: icon('evidence-locker'),
        description: 'Catalogue, search, filter and verify collected evidence.',
        category: 'Investigation',
        slot: 2,
        window: { width: 1080, height: 680, minWidth: 640, minHeight: 440 },
        load: () => import('../apps/EvidenceLocker/EvidenceLockerApp.js'),
    }),
    def({
        id: 'messages',
        name: 'Messages',
        icon: icon('messages'),
        description: 'Read recovered correspondence and pull evidence out of it.',
        category: 'Investigation',
        slot: 3,
        window: { width: 1020, height: 640, minWidth: 600, minHeight: 400 },
        load: () => import('../apps/Messages/MessagesApp.js'),
    }),
    def({
        id: 'people',
        name: 'People',
        icon: icon('people'),
        description: 'Dossiers on everyone connected to the case.',
        category: 'Investigation',
        slot: 4,
        window: { width: 1000, height: 640, minWidth: 600, minHeight: 400 },
        load: () => import('../apps/People/PeopleApp.js'),
    }),
    def({
        id: 'timeline',
        name: 'Timeline',
        icon: icon('timeline'),
        description: 'Reconstruct what happened, in order, with certainty levels.',
        category: 'Investigation',
        slot: 5,
        window: { width: 1000, height: 620, minWidth: 600, minHeight: 400 },
        load: () => import('../apps/Timeline/TimelineApp.js'),
    }),
    def({
        id: 'investigation-map',
        name: 'Investigation Map',
        icon: icon('investigation-map'),
        description: 'Plot locations, movement and the links between them.',
        category: 'Investigation',
        slot: 6,
        window: { width: 1000, height: 660, minWidth: 620, minHeight: 440 },
        load: () => import('../apps/InvestigationMap/InvestigationMapApp.js'),
    }),
    def({
        id: 'analysis-lab',
        name: 'Analysis Lab',
        icon: icon('analysis-lab'),
        description: 'Run inspection tools over evidence and collect findings.',
        category: 'Forensics',
        slot: 8,
        unlockRequirements: [{ type: 'evidence', value: 1 }],
        unlockReason: 'Becomes available once any evidence is logged.',
        window: { width: 1000, height: 660, minWidth: 640, minHeight: 440 },
        load: () => import('../apps/AnalysisLab/AnalysisLabApp.js'),
    }),
    def({
        id: 'terminal',
        name: 'Terminal',
        icon: icon('terminal'),
        description: 'Query the investigation system from a sandboxed shell.',
        category: 'Operations',
        slot: 9,
        window: { width: 1000, height: 640, minWidth: 520, minHeight: 340 },
        load: () => import('../apps/Terminal/TerminalApp.js'),
    }),
    def({
        id: 'notes',
        name: 'Notes',
        icon: icon('notes'),
        description: 'Case scratchpad. Everything you write is saved locally.',
        category: 'Operations',
        desktop: false,
        window: { width: 820, height: 580, minWidth: 520, minHeight: 360 },
        load: () => import('../apps/Notes/NotesApp.js'),
    }),
    def({
        id: 'evidence-board',
        name: 'Evidence Board',
        icon: icon('evidence-board'),
        description: 'Arrange evidence, draw relationships and draft theories.',
        category: 'Analysis',
        desktop: false,
        unlockRequirements: [{ type: 'evidence', value: 2 }],
        unlockReason: 'Opens once two pieces of evidence are logged.',
        window: { width: 1140, height: 700, minWidth: 720, minHeight: 480 },
        load: () => import('../apps/EvidenceBoard/EvidenceBoardApp.js'),
    }),
    def({
        id: 'reports',
        name: 'Reports',
        icon: icon('reports'),
        description: 'Assemble findings and file a conclusion for the active case.',
        category: 'Analysis',
        desktop: false,
        unlockRequirements: [{ type: 'verified', value: 1 }],
        unlockReason: 'Opens once at least one item of evidence is verified.',
        window: { width: 940, height: 660, minWidth: 600, minHeight: 420 },
        load: () => import('../apps/Reports/ReportsApp.js'),
    }),
    def({
        id: 'settings',
        name: 'Settings',
        icon: icon('settings'),
        description: 'Appearance, audio, accessibility and saved data.',
        category: 'System',
        desktop: false,
        window: { width: 880, height: 620, minWidth: 560, minHeight: 400 },
        load: () => import('../apps/Settings/SettingsApp.js'),
    }),
    def({
        id: 'system-info',
        name: 'System Information',
        icon: icon('system-info'),
        description: 'Build details, session data, storage use and event log.',
        category: 'System',
        desktop: false,
        window: { width: 900, height: 620, minWidth: 560, minHeight: 400 },
        load: () => import('../apps/SystemInfo/SystemInfoApp.js'),
    }),
];

/** Evaluate a single requirement against the current player context. */
export function meetsRequirement(requirement, context) {
    switch (requirement.type) {
        case REQUIREMENT.APP:
            return context.unlockedApps.includes(requirement.value);
        case REQUIREMENT.EVIDENCE:
            return context.evidenceCount >= requirement.value;
        case REQUIREMENT.VERIFIED:
            return context.verifiedCount >= requirement.value;
        case REQUIREMENT.RELATIONSHIP:
            return context.relationshipCount >= requirement.value;
        case REQUIREMENT.PEOPLE:
            return context.peopleCount >= requirement.value;
        case REQUIREMENT.MESSAGES_READ:
            return context.messagesRead >= requirement.value;
        case REQUIREMENT.TIMELINE:
            return context.timelineCount >= requirement.value;
        case REQUIREMENT.FLAG:
            return Boolean(context.flags[requirement.value]);
        case REQUIREMENT.OBJECTIVE:
            return context.completedObjectives.includes(requirement.value);
        default:
            console.warn(`[Her-Story] unknown requirement type "${requirement.type}"`);
            return false;
    }
}

export function evaluateRequirements(requirements, context) {
    return (requirements || []).every((requirement) => meetsRequirement(requirement, context));
}

class AppRegistry {
    constructor(definitions) {
        this._definitions = definitions.slice();
        this._byId = new Map(definitions.map((entry) => [entry.id, entry]));
    }

    list() {
        return this._definitions.slice();
    }

    /** Applications that earn a desktop icon. */
    listDesktop() {
        return this._definitions.filter((entry) => entry.desktop);
    }

    get(appId) {
        return this._byId.get(appId) || null;
    }

    has(appId) {
        return this._byId.has(appId);
    }

    /** Alt+<slot> shortcut lookup (1..9). */
    bySlot(slot) {
        return this._definitions.find((entry) => entry.slot === slot) || null;
    }

    /**
     * @returns {{ available: boolean, granted: boolean, reason: string }}
     */
    availability(appId, context) {
        const entry = this.get(appId);
        if (!entry) return { available: false, granted: false, reason: 'Unknown application.' };
        const granted = context.unlockedApps.includes(appId);
        return {
            granted,
            available: granted || evaluateRequirements(entry.unlockRequirements, context),
            reason: entry.unlockReason,
        };
    }

    /** Applications reachable right now, in registry order. */
    available(context) {
        return this._definitions.filter((entry) => this.availability(entry.id, context).available);
    }

    /** Locked entries and the reason, for Settings / System Information. */
    locked(context) {
        return this._definitions
            .filter((entry) => !this.availability(entry.id, context).available)
            .map((entry) => ({ id: entry.id, name: entry.name, reason: entry.unlockReason }));
    }

    /** Free-text search used by the application launcher. */
    search(query) {
        const needle = String(query || '').trim().toLowerCase();
        if (!needle) return this._definitions.slice();
        return this._definitions.filter((entry) => [
            entry.name, entry.description, entry.category,
        ].some((field) => String(field || '').toLowerCase().includes(needle)));
    }
}

export const appRegistry = new AppRegistry(APP_DEFINITIONS);
export default appRegistry;
