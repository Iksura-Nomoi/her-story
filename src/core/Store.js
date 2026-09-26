/**
 * Her-Story — minimal reactive store.
 *
 * Deliberately tiny (the project has no external state library): a store is a
 * value plus a listener set. Consumers subscribe through *selectors* so a
 * change to `notes` never re-renders a component that only watches `windows`.
 */

/** Structural-ish equality for the plain JSON shapes this game stores. */
export function shallowEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    return aKeys.every((key) => a[key] === b[key]);
}

/** Immutable deep clone that survives undefined/Date/arrays (structuredClone when present). */
export function deepClone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch {
            /* fall through to JSON clone */
        }
    }
    return JSON.parse(JSON.stringify(value));
}

/**
 * Read a nested path out of an object without throwing on missing links.
 * @param {object} source
 * @param {string[]} path
 */
export function readPath(source, path) {
    let cursor = source;
    for (const key of path) {
        if (cursor === null || typeof cursor !== 'object') return undefined;
        cursor = cursor[key];
    }
    return cursor;
}

export function createStore(initialState, { name = 'store' } = {}) {
    let state = initialState;
    const listeners = new Set();
    let revision = 0;

    const commit = (nextState, meta = {}) => {
        if (nextState === state) return state;
        state = nextState;
        revision += 1;
        for (const listener of Array.from(listeners)) {
            try {
                listener(state, meta);
            } catch (error) {
                console.error(`[${name}] listener failed`, error);
            }
        }
        return state;
    };

    const store = {
        name,
        getState() {
            return state;
        },
        getRevision() {
            return revision;
        },
        /** Shallow merge of a partial, or a full updater function. */
        setState(partialOrUpdater, meta = {}) {
            const partial = typeof partialOrUpdater === 'function'
                ? partialOrUpdater(state)
                : partialOrUpdater;
            if (!partial) return state;
            return commit({ ...state, ...partial }, meta);
        },
        /**
         * Update one nested branch through an immutable path write.
         * `patch(['cases', 'case-001', 'status'], (current) => 'investigating')`
         */
        patch(path, updater, meta = {}) {
            if (!Array.isArray(path) || path.length === 0) {
                throw new Error(`[${name}] patch() needs a non-empty path`);
            }
            const nextRoot = { ...state };
            let cursor = nextRoot;
            for (let i = 0; i < path.length - 1; i += 1) {
                const key = path[i];
                const current = cursor[key];
                const clone = Array.isArray(current)
                    ? current.slice()
                    : (current && typeof current === 'object' ? { ...current } : {});
                cursor[key] = clone;
                cursor = clone;
            }
            const leaf = path[path.length - 1];
            cursor[leaf] = typeof updater === 'function' ? updater(cursor[leaf]) : updater;
            return commit(nextRoot, meta);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        /**
         * Subscribe to a derived slice. The listener only fires when the slice
         * actually changes, which keeps DOM work proportional to real updates.
         */
        subscribeSelector(selector, listener, equality = shallowEqual) {
            let previous = selector(state);
            return store.subscribe((nextState) => {
                const next = selector(nextState);
                if (equality(previous, next)) return;
                const before = previous;
                previous = next;
                listener(next, before);
            });
        },
        peek(selector) {
            return selector(state);
        },
        replace(nextState, meta = {}) {
            return commit(nextState, meta);
        },
        reset(factory) {
            return commit(typeof factory === 'function' ? factory() : factory);
        },
    };

    return store;
}
