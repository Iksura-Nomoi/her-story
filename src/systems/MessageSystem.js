/**
 * Her-Story — message system.
 *
 * Opening a message is what makes its attachments real: the message marks itself
 * read, then hands every attached evidence id to the EvidenceSystem, which
 * publishes it to the Locker, Board and Terminal. This is the cross-app flow the
 * event system exists for — Messages never touches the Locker directly.
 */

import { EVENTS, announce, notify } from '../core/events.js';
import { gameStore, updateCase, getCaseStateSafe } from '../core/GameState.js';
import { caseRepository } from '../core/CaseRepository.js';
import { humanizeId } from '../ui/dom.js';
import { systems } from './registry.js';

export const MESSAGE_FOLDERS = Object.freeze({
    ALL: 'all',
    UNREAD: 'unread',
    FLAGGED: 'flagged',
    EVIDENCE: 'evidence',
});

const activeCaseId = () => gameStore.getState().activeCaseId;

export function messageRecord(id, caseId = activeCaseId()) {
    return caseRepository.findRecord(caseId, 'message', id);
}

export function resolveMessage(record, caseState = getCaseStateSafe(activeCaseId())) {
    if (!record) return null;
    const read = caseState.messagesRead.includes(record.id);
    return {
        id: record.id,
        caseId: caseState.caseId,
        threadId: record.threadId || record.id,
        subject: record.subject || '(no subject)',
        body: record.body || '',
        sender: record.sender || null,
        recipients: record.recipients || [],
        cc: record.cc || [],
        timestamp: record.timestamp || null,
        attachments: record.attachments || [],
        evidence: record.evidence || [],
        priority: record.priority || 'normal',
        folder: record.folder || 'inbox',
        tags: record.tags || [],
        discovered: caseState.messagesDiscovered.includes(record.id),
        read,
        flagged: caseState.flaggedMessages.includes(record.id),
    };
}

export class MessageSystem {
    static discover(id, { caseId = activeCaseId(), silent = true } = {}) {
        if (!id || !caseId) return { ok: false };
        const state = getCaseStateSafe(caseId);
        if (state.messagesDiscovered.includes(id)) return { ok: true, alreadyKnown: true };
        updateCase(caseId, (draft) => {
            draft.messagesDiscovered.push(id);
            if (!draft.discoveryLog) draft.discoveryLog = [];
            draft.discoveryLog.push({ messageId: id, at: new Date().toISOString() });
        });
        announce(EVENTS.MESSAGE_DISCOVERED, { caseId, messageId: id });
        if (!silent) notify('Message recovered', messageRecord(id, caseId)?.subject || humanizeId(id), 'message');
        return { ok: true, alreadyKnown: false };
    }

    /**
     * Open a message: marks it read, reveals its senders/recipients and pushes
     * every attachment into the evidence system.
     */
    static open(id, { caseId = activeCaseId() } = {}) {
        const record = messageRecord(id, caseId);
        if (!record) return { ok: false, revealed: [] };

        const state = getCaseStateSafe(caseId);
        if (!state.messagesDiscovered.includes(id)) this.discover(id, { caseId, silent: true });

        const firstRead = !state.messagesRead.includes(id);
        if (firstRead) {
            updateCase(caseId, (draft) => { draft.messagesRead.push(id); });
            gameStore.patch(['counters'], (counters) => ({
                ...counters,
                messagesRead: (counters.messagesRead || 0) + 1,
            }));
        }

        const revealed = [];
        [record.sender, ...(record.recipients || [])].filter(Boolean).forEach((personId) => {
            const result = systems.people?.discover(personId, { caseId });
            if (result && !result.alreadyKnown) revealed.push(`person:${personId}`);
        });

        const attachments = (record.attachments || []).map((entry) => (typeof entry === 'string' ? entry : entry.evidenceId));
        [...new Set([...attachments, ...(record.evidence || [])])].filter(Boolean).forEach((evidenceId) => {
            const result = systems.evidence?.discover(evidenceId, {
                caseId,
                method: `Message ${record.id}`,
                source: 'Recovered correspondence',
            });
            if (result?.ok && !result.alreadyKnown) revealed.push(`evidence:${evidenceId}`);
        });

        const reveals = record.reveals || {};
        (reveals.evidence || []).forEach((evidenceId) => systems.evidence?.discover(evidenceId, { caseId }));
        (reveals.people || []).forEach((personId) => systems.people?.discover(personId, { caseId }));
        (reveals.timeline || []).forEach((eventId) => systems.timeline?.discover(eventId, { caseId }));

        announce(EVENTS.MESSAGE_OPENED, { caseId, messageId: id, firstRead, revealed });
        return { ok: true, revealed, message: resolveMessage(record, getCaseStateSafe(caseId)) };
    }

    static markUnread(id, { caseId = activeCaseId() } = {}) {
        updateCase(caseId, (draft) => {
            draft.messagesRead = draft.messagesRead.filter((entry) => entry !== id);
        });
        announce(EVENTS.MESSAGE_OPENED, { caseId, messageId: id, firstRead: false, unread: true });
        return true;
    }

    static toggleFlag(id, { caseId = activeCaseId() } = {}) {
        let flagged = false;
        updateCase(caseId, (draft) => {
            flagged = !draft.flaggedMessages.includes(id);
            draft.flaggedMessages = flagged
                ? [...draft.flaggedMessages, id]
                : draft.flaggedMessages.filter((entry) => entry !== id);
        });
        announce(EVENTS.MESSAGE_FLAGGED, { caseId, messageId: id, flagged });
        return flagged;
    }

    // -- reads -------------------------------------------------------------

    static list({ caseId = activeCaseId(), includeUndiscovered = false } = {}) {
        const record = caseRepository.getCase(caseId);
        if (!record) return [];
        const state = getCaseStateSafe(caseId);
        return record.messages
            .map((message) => resolveMessage(message, state))
            .filter((message) => message && (includeUndiscovered || message.discovered))
            .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    }

    static get(id, options = {}) {
        return this.list(options).find((message) => message.id === id) || null;
    }

    /** Folder list used by the Messages app sidebar. */
    static folderCounts(options = {}) {
        const messages = this.list(options);
        return {
            [MESSAGE_FOLDERS.ALL]: messages.length,
            [MESSAGE_FOLDERS.UNREAD]: messages.filter((message) => !message.read).length,
            [MESSAGE_FOLDERS.FLAGGED]: messages.filter((message) => message.flagged).length,
            [MESSAGE_FOLDERS.EVIDENCE]: messages.filter((message) =>
                (message.attachments || []).length || (message.evidence || []).length).length,
        };
    }

    static query({ text = '', folder = MESSAGE_FOLDERS.ALL } = {}, options = {}) {
        const needle = text.trim().toLowerCase();
        return this.list(options).filter((message) => {
            if (folder === MESSAGE_FOLDERS.UNREAD && message.read) return false;
            if (folder === MESSAGE_FOLDERS.FLAGGED && !message.flagged) return false;
            if (folder === MESSAGE_FOLDERS.EVIDENCE
                && !((message.attachments || []).length || (message.evidence || []).length)) return false;
            if (!needle) return true;
            return [message.id, message.subject, message.body, message.sender]
                .some((field) => String(field || '').toLowerCase().includes(needle));
        });
    }

    /** Attachments resolved into evidence records for the reading pane. */
    static attachmentsFor(id, options = {}) {
        const message = this.get(id, options);
        if (!message) return [];
        const ids = new Set([
            ...(message.attachments || []).map((entry) => (typeof entry === 'string' ? entry : entry.evidenceId)),
            ...(message.evidence || []),
        ].filter(Boolean));
        return Array.from(ids)
            .map((evidenceId) => systems.evidence?.get(evidenceId, options))
            .filter(Boolean);
    }

    static unreadCount(options = {}) {
        return this.list(options).filter((message) => !message.read).length;
    }
}

systems.messages = MessageSystem;
export default MessageSystem;
