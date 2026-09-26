/**
 * Her-Story — DOM + formatting helpers shared by every application.
 * No framework: apps build elements directly, these keep that code short and
 * consistent (and keep user/case text escaped).
 */

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/** Escape untrusted text before it goes into an innerHTML template. */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function qs(selector, root = document) {
    return root.querySelector(selector);
}

export function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}

/**
 * Create an element. `attrs` supports `class`, `text`, `html`, `dataset`,
 * `on<Event>` handlers and plain attributes.
 */
export function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
        else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, String(value));
    });
    const list = Array.isArray(children) ? children : [children];
    list.filter(Boolean).forEach((child) => {
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
}

/** Remove every child of a node. */
export function clear(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function debounce(fn, delay = 160) {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn(...args);
        }, delay);
    };
}

export function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
}

export function groupBy(list, keyFn) {
    return list.reduce((groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
        return groups;
    }, {});
}

export function sortBy(list, accessor, direction = 'asc') {
    const factor = direction === 'desc' ? -1 : 1;
    return list.slice().sort((a, b) => {
        const left = accessor(a);
        const right = accessor(b);
        if (left === right) return 0;
        if (left === null || left === undefined) return 1;
        if (right === null || right === undefined) return -1;
        return left > right ? factor : -factor;
    });
}

export function truncate(text, length = 120) {
    const value = String(text || '');
    return value.length <= length ? value : `${value.slice(0, length - 1).trimEnd()}…`;
}

/** `evidence-004` -> `Evidence 004`; `case-001` -> `Case 001`. */
export function humanizeId(id) {
    return String(id || '')
        .split(/[-_]/)
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join(' ');
}

export function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return '—';
    return date.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

export function formatTime(value) {
    const date = parseDate(value);
    if (!date) return '—';
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value) {
    const date = parseDate(value);
    if (!date) return '—';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

/** "3 min ago" style stamp for feeds and notifications. */
export function formatRelative(value) {
    const date = parseDate(value);
    if (!date) return '—';
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 45) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(date);
}

export function formatClock(date, use24Hour = true) {
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !use24Hour,
    });
}

/** Trigger a client-side text download (save export, notes export). */
export function downloadText(filename, text, mime = 'application/json') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/** Read a File object as text (save import). */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}
