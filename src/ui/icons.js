/**
 * Her-Story — icon set.
 *
 * Desktop / application icons are the colourful Material folder + file icons
 * vendored from vscode-material-icon-theme (see public/assets/app-icons/),
 * so the desktop looks like a real OS instead of monochrome line glyphs.
 * Window chrome / shell controls stay as hand-written 24x24 line icons drawn
 * with `currentColor`, so they inherit text colour.
 */

const wrap = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

// Material app icon (vendored SVG file). Returns an <img> tag so the full
// colour artwork renders as-is instead of being forced to currentColor.
const appIcon = (file) =>
    `<img src="assets/app-icons/${file}.svg" alt="" draggable="false" loading="eager" />`;

export const ICONS = Object.freeze({
    // ---- applications (vscode-material-icon-theme, MIT) -------------------
    'case-manager': appIcon('case-files'),
    'evidence-locker': appIcon('locker'),
    messages: appIcon('messages'),
    people: appIcon('suspects'),
    timeline: appIcon('timeline'),
    'investigation-map': appIcon('map'),
    'media-viewer': appIcon('media'),
    'analysis-lab': appIcon('forensics'),
    terminal: appIcon('terminal'),
    notes: appIcon('notes'),
    'evidence-board': appIcon('case-archive'),
    reports: appIcon('submit'),
    settings: appIcon('settings'),
    'system-info': appIcon('help'),

    // ---- shell / controls -----------------------------------------------
    launcher: wrap('<rect x="3.6" y="3.6" width="6.4" height="6.4" rx="1.4"/><rect x="14" y="3.6" width="6.4" height="6.4" rx="1.4"/><rect x="3.6" y="14" width="6.4" height="6.4" rx="1.4"/><rect x="14" y="14" width="6.4" height="6.4" rx="1.4"/>'),
    bell: wrap('<path d="M6.6 16.6V11a5.4 5.4 0 0 1 10.8 0v5.6l1.4 1.9H5.2z"/><path d="M10.2 19.9a2 2 0 0 0 3.6 0"/>'),
    clock: wrap('<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3 1.9"/>'),
    'sound-on': wrap('<path d="M5 10h3l4-3.4v10.8L8 14H5z"/><path d="M15 9.4a3.6 3.6 0 0 1 0 5.2M17.4 7.2a7 7 0 0 1 0 9.6"/>'),
    'sound-off': wrap('<path d="M5 10h3l4-3.4v10.8L8 14H5z"/><path d="M15 10.2l4 3.6M19 10.2l-4 3.6"/>'),
    fullscreen: wrap('<path d="M9 4.5H4.5V9M15 4.5h4.5V9M15 19.5h4.5V15M9 19.5H4.5V15"/>'),
    refresh: wrap('<path d="M19 12a7 7 0 1 1-2.2-5.1"/><path d="M19.4 4.6v3.6h-3.6"/>'),
    search: wrap('<circle cx="10.8" cy="10.8" r="5.8"/><path d="M15.2 15.2 20 20"/>'),
    filter: wrap('<path d="M4.5 6.4h15M7.2 12h9.6M10 17.6h4"/>'),
    sort: wrap('<path d="M7 5v13M7 18l-2.6-2.6M7 18l2.6-2.6M13.6 6.5h6.4M13.6 11.5h4.4M13.6 16.5h2.4"/>'),
    close: wrap('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    minimize: wrap('<path d="M5.5 12h13"/>'),
    maximize: wrap('<rect x="5.5" y="5.5" width="13" height="13" rx="1.4"/>'),
    restore: wrap('<rect x="4.6" y="7.4" width="11" height="11" rx="1.4"/><path d="M8.4 7.4V5.6h11v11h-1.9"/>'),
    check: wrap('<path d="M5 12.6 9.6 17 19 7.4"/>'),
    plus: wrap('<path d="M12 5.4v13.2M5.4 12h13.2"/>'),
    lock: wrap('<rect x="5.4" y="10.4" width="13.2" height="9" rx="1.6"/><path d="M8.6 10.4V8a3.4 3.4 0 0 1 6.8 0v2.4"/>'),
    pin: wrap('<path d="M12 4.4v8.2"/><path d="M8.4 4.4h7.2l-1.1 3.6 2.1 2.4H7.4l2.1-2.4z"/><path d="M12 15.4v4.2"/>'),
    trash: wrap('<path d="M5.6 7.4h12.8M9.4 7.4V5.6h5.2v1.8M7 7.4l.9 11.2h8.2L17 7.4"/><path d="M10.4 10.6v5M13.6 10.6v5"/>'),
    link: wrap('<path d="M9.6 14.4 14.4 9.6"/><path d="M11.2 7.2l1.6-1.6a3.4 3.4 0 0 1 4.8 4.8l-1.6 1.6M12.8 16.8l-1.6 1.6a3.4 3.4 0 0 1-4.8-4.8l1.6-1.6"/>'),
    'arrow-left': wrap('<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>'),
    'arrow-right': wrap('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'),
    'chevron-down': wrap('<path d="M6.5 9.5 12 15l5.5-5.5"/>'),
    external: wrap('<path d="M14 4.6h5.4V10"/><path d="M19.4 4.6 11.6 12.4"/><path d="M18 14.4v4.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.6V7.4A1.4 1.4 0 0 1 5.4 6h4.2"/>'),
    download: wrap('<path d="M12 4.6v10.2"/><path d="M7.8 10.6 12 14.8l4.2-4.2"/><path d="M5 18.6h14"/>'),
    upload: wrap('<path d="M12 15V4.8"/><path d="M7.8 9 12 4.8 16.2 9"/><path d="M5 18.6h14"/>'),
    save: wrap('<path d="M5 5.4h10.4L19 9v9.6H5z"/><path d="M8.4 5.4v4.4h6.6V5.4"/><rect x="8.4" y="13" width="7.2" height="5.6" rx="0.8"/>'),
    edit: wrap('<path d="M15.4 5.6l3 3L9.6 17.4H6.6v-3z"/><path d="M5 20h14"/>'),
    mystery: wrap('<circle cx="12" cy="12" r="7.6"/><path d="M9.8 9.9a2.3 2.3 0 0 1 4.4.7c0 1.6-2.2 2.1-2.2 3.6"/><path d="M12 17.2h.01"/>'),
    key: wrap('<circle cx="8.4" cy="12" r="3.4"/><path d="M11.8 12H20M17 12v2.6M14.6 12v2"/>'),
});

/** Inline SVG string for an icon name (falls back to a neutral marker). */
export function icon(name) {
    return ICONS[name] || ICONS.mystery;
}

