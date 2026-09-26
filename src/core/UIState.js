/**
 * Her-Story — UI state.
 *
 * Windows, focus, panels, desktop layout and user settings. Persisted next to
 * the game state, but deliberately separate: wiping a case never resets the
 * player's theme, and a corrupt window layout never costs investigation data.
 */

import { createStore } from './Store.js';

export const DEFAULT_SETTINGS = Object.freeze({
    wallpaper: 'darkroom',
    theme: 'graphite',
    fontScale: 100,
    soundEnabled: true,
    soundVolume: 0.7,
    ambientHum: false,
    crtEffects: true,
    animations: true,
    clock24h: true,
    showDesktopGrid: true,
    showTips: true,
});

export function createInitialUIState() {
    return {
        phase: 'landing',
        boot: { completed: false, introSeen: false },
        windows: {},
        windowOrder: [],
        activeWindowId: null,
        panels: {
            launcher: false,
            notifications: false,
            statusMenu: false,
            shortcuts: false,
            wallpaper: false,
        },
        desktop: { iconPositions: {}, selected: [], grid: true },
        settings: { ...DEFAULT_SETTINGS },
        notifications: [],
        lastActiveApp: null,
    };
}

export const uiStore = createStore(createInitialUIState(), { name: 'ui' });

// ---------------------------------------------------------------------------
// Window lifecycle — mirrored into the store so SaveManager and the taskbar can
// read the layout without touching the DOM.
// ---------------------------------------------------------------------------

/** Shape of a window record stored in ui.windows. */
export function emptyWindowRecord() {
    return { open: false, minimized: false, maximized: false, z: 0, bounds: null, openedAt: null };
}

export function readWindowRecord(appId) {
    return uiStore.getState().windows[appId] || emptyWindowRecord();
}

export function patchWindow(appId, partial) {
    uiStore.patch(['windows', appId], (current) => ({
        ...emptyWindowRecord(),
        ...(current || {}),
        ...partial,
    }), { appId });
}

export function setWindowBounds(appId, bounds) {
    patchWindow(appId, { bounds });
}

export function markWindowOpen(appId, { z, bounds } = {}) {
    const current = readWindowRecord(appId);
    patchWindow(appId, {
        open: true,
        minimized: false,
        z: typeof z === 'number' ? z : current.z,
        bounds: bounds || current.bounds,
        openedAt: current.openedAt || new Date().toISOString(),
    });
}

export function markWindowClosed(appId) {
    const order = uiStore.getState().windowOrder.filter((id) => id !== appId);
    uiStore.setState({
        windowOrder: order,
        activeWindowId: uiStore.getState().activeWindowId === appId ? (order[order.length - 1] || null) : uiStore.getState().activeWindowId,
    });
    patchWindow(appId, { open: false, minimized: false, maximized: false });
}

export function setActiveWindow(appId) {
    const state = uiStore.getState();
    const order = state.windowOrder.filter((id) => id !== appId);
    if (appId) order.push(appId);
    uiStore.setState({
        activeWindowId: appId || null,
        windowOrder: order,
        lastActiveApp: appId || state.lastActiveApp,
    });
}

/** Bring to front, returning the z-index the window should adopt. */
export function focusWindow(appId) {
    setActiveWindow(appId);
    const highest = Object.values(uiStore.getState().windows)
        .reduce((max, record) => Math.max(max, record.z || 0), 100);
    const z = highest + 1;
    patchWindow(appId, { z, minimized: false });
    return z;
}

export function minimizeWindow(appId) {
    patchWindow(appId, { minimized: true, open: true });
    const order = uiStore.getState().windowOrder.filter((id) => id !== appId);
    uiStore.setState({
        windowOrder: order,
        activeWindowId: order[order.length - 1] || null,
    });
}

export function desktopWindows() {
    const state = uiStore.getState();
    return state.windowOrder
        .map((appId) => ({ appId, ...readWindowRecord(appId) }))
        .filter((record) => record.open);
}

// ---------------------------------------------------------------------------
// Panels, desktop layout, settings
// ---------------------------------------------------------------------------

export function togglePanel(name, force = null) {
    const state = uiStore.getState();
    const nextValue = force === null ? !state.panels[name] : Boolean(force);
    const panels = { ...state.panels };
    Object.keys(panels).forEach((key) => { panels[key] = key === name ? nextValue : false; });
    uiStore.setState({ panels });
}

export function closeAllPanels() {
    const panels = { ...uiStore.getState().panels };
    Object.keys(panels).forEach((key) => { panels[key] = false; });
    uiStore.setState({ panels });
}

export function setIconPosition(appId, cell) {
    uiStore.patch(['desktop', 'iconPositions'], (positions) => ({ ...(positions || {}), [appId]: cell }));
}

export function setIconPositions(positions) {
    uiStore.patch(['desktop', 'iconPositions'], () => ({ ...positions }));
}

export function setSelectedIcons(ids) {
    uiStore.patch(['desktop', 'selected'], () => ids.slice());
}

export function updateSettings(partial) {
    uiStore.patch(['settings'], (current) => ({ ...current, ...partial }), { settings: partial });
}

export function selectSettings(state = uiStore.getState()) {
    return state.settings;
}

export const selectPanels = (state = uiStore.getState()) => state.panels;
export const selectPhase = (state = uiStore.getState()) => state.phase;
export const selectActiveWindowId = (state = uiStore.getState()) => state.activeWindowId;
