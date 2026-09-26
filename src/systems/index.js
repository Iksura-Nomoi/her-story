/**
 * Her-Story — system wiring.
 *
 * Importing this module makes every system reachable through `systems.*` and
 * `installSystems()` attaches the event listeners that keep the game state in
 * sync. Systems that only serve reads (evidence, people, locations, timeline,
 * messages, relationships, board) need no installation.
 */

import { systems } from './registry.js';
import { EvidenceSystem } from './EvidenceSystem.js';
import { RelationshipSystem } from './RelationshipSystem.js';
import { PeopleSystem } from './PeopleSystem.js';
import { LocationSystem } from './LocationSystem.js';
import { TimelineSystem } from './TimelineSystem.js';
import { MessageSystem } from './MessageSystem.js';
import { ObjectiveSystem } from './ObjectiveSystem.js';
import { AnalysisSystem } from './AnalysisSystem.js';
import { BoardSystem } from './BoardSystem.js';
import { AppUnlockSystem } from './AppUnlockSystem.js';
import { CaseSystem } from './CaseSystem.js';

let installed = false;

/** Attach event listeners. Safe to call more than once. */
export function installSystems() {
    if (installed) return systems;
    installed = true;
    ObjectiveSystem.install();
    CaseSystem.install();
    AppUnlockSystem.install();
    return systems;
}

export function systemsInstalled() {
    return installed;
}

export {
    systems,
    EvidenceSystem,
    RelationshipSystem,
    PeopleSystem,
    LocationSystem,
    TimelineSystem,
    MessageSystem,
    ObjectiveSystem,
    AnalysisSystem,
    BoardSystem,
    AppUnlockSystem,
    CaseSystem,
};

export { computeProgress, deriveCaseStatus, objectiveRequirementMet } from './progress.js';
export { ENTITY_KINDS, RELATIONSHIP_TYPES, RELATIONSHIP_LABELS } from './RelationshipSystem.js';
export { EVIDENCE_TYPES, EVIDENCE_TYPE_LABELS, RELIABILITY, RELIABILITY_LABELS } from './EvidenceSystem.js';
export { PERSON_STATUS, PERSON_STATUS_LABELS } from './PeopleSystem.js';
export { LOCATION_TYPES, LOCATION_TYPE_LABELS } from './LocationSystem.js';
export { CERTAINTY, CERTAINTY_LABELS } from './TimelineSystem.js';
