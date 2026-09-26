/**
 * Her-Story — central event vocabulary.
 *
 * Every module talks to every other module through these event names instead of
 * importing each other directly. Systems (src/systems/*) listen for these and
 * fold the payloads into the game state, so an app only has to announce *what
 * happened* — never *who needs to know*.
 *
 * Naming rules:
 *  - past tense: the event already happened and is not cancellable
 *  - UPPER_SNAKE_CASE, grouped by domain prefix
 */

import { eventBus } from './EventBus.js';

export const EVENTS = Object.freeze({
    // ---- evidence -------------------------------------------------------
    EVIDENCE_DISCOVERED: 'EVIDENCE_DISCOVERED',
    EVIDENCE_VERIFIED: 'EVIDENCE_VERIFIED',
    EVIDENCE_UNVERIFIED: 'EVIDENCE_UNVERIFIED',
    EVIDENCE_INSPECTED: 'EVIDENCE_INSPECTED',
    EVIDENCE_TAGGED: 'EVIDENCE_TAGGED',

    // ---- messages -------------------------------------------------------
    MESSAGE_DISCOVERED: 'MESSAGE_DISCOVERED',
    MESSAGE_OPENED: 'MESSAGE_OPENED',
    MESSAGE_FLAGGED: 'MESSAGE_FLAGGED',

    // ---- people / locations --------------------------------------------
    PERSON_DISCOVERED: 'PERSON_DISCOVERED',
    PERSON_UPDATED: 'PERSON_UPDATED',
    LOCATION_DISCOVERED: 'LOCATION_DISCOVERED',

    // ---- timeline / relationships --------------------------------------
    TIMELINE_UPDATED: 'TIMELINE_UPDATED',
    RELATIONSHIP_CREATED: 'RELATIONSHIP_CREATED',
    RELATIONSHIP_REMOVED: 'RELATIONSHIP_REMOVED',
    BOARD_NODE_MOVED: 'BOARD_NODE_MOVED',
    THEORY_UPDATED: 'THEORY_UPDATED',

    // ---- objectives / cases --------------------------------------------
    OBJECTIVE_UPDATED: 'OBJECTIVE_UPDATED',
    OBJECTIVE_COMPLETED: 'OBJECTIVE_COMPLETED',
    CASE_LOADED: 'CASE_LOADED',
    CASE_UPDATED: 'CASE_UPDATED',
    CASE_STATUS_CHANGED: 'CASE_STATUS_CHANGED',
    REPORT_SAVED: 'REPORT_SAVED',
    REPORT_SUBMITTED: 'REPORT_SUBMITTED',

    // ---- analysis -------------------------------------------------------
    ANALYSIS_QUEUED: 'ANALYSIS_QUEUED',
    ANALYSIS_COMPLETED: 'ANALYSIS_COMPLETED',

    // ---- shell / applications -------------------------------------------
    APP_REGISTERED: 'APP_REGISTERED',
    APP_LAUNCHED: 'APP_LAUNCHED',
    APP_UNLOCKED: 'APP_UNLOCKED',
    APP_STATE_CHANGED: 'APP_STATE_CHANGED',
    WINDOW_FOCUS_CHANGED: 'WINDOW_FOCUS_CHANGED',
    NOTIFY: 'NOTIFY',
    NOTIFICATION_PUSHED: 'NOTIFICATION_PUSHED',
    TERMINAL_COMMAND: 'TERMINAL_COMMAND',
    NAVIGATE_TO: 'NAVIGATE_TO',
    SETTINGS_CHANGED: 'SETTINGS_CHANGED',
    SAVE_WRITTEN: 'SAVE_WRITTEN',
    SAVE_ERROR: 'SAVE_ERROR',
    SAVE_LOADED: 'SAVE_LOADED',
    SAVE_WIPED: 'SAVE_WIPED',
});

/** Where a piece of game data came from. Used by evidence/relationship payloads. */
export const SOURCES = Object.freeze({
    CASE_DATA: 'case-data',
    PLAYER: 'player',
    SYSTEM: 'system',
});

/**
 * Announce a game event. Systems pick these up and mutate the game state;
 * the shell picks up `NOTIFY` to surface a toast.
 */
export function announce(type, payload = {}) {
    eventBus.emit(type, payload);
    return payload;
}

/** Convenience: request a toast without importing NotificationManager everywhere. */
export function notify(title, body = '', kind = 'info') {
    return announce(EVENTS.NOTIFY, { title, body, kind });
}

/** Deep-link another application to a specific record (e.g. evidence-004). */
export function navigateTo(appId, focus = null) {
    return announce(EVENTS.NAVIGATE_TO, { appId, focus });
}
