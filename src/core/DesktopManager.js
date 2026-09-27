import { eventBus } from './EventBus.js';
import { stateManager } from './StateManager.js';
import { AudioController } from './AudioController.js';

const GRID_W = 96;
const GRID_H = 104;
const GRID_PAD_X = 24;
const GRID_PAD_Y = 24;

const ICON_W = 84;
const ICON_H = 92;

export const WALLPAPERS = [
    { id: 'blueprint', name: 'Blueprint', file: 'blueprint.jpg' },
    { id: 'satellite', name: 'Satellite Earth', file: 'satellite.jpg' },
    { id: 'worldmap', name: 'World Map', file: 'worldmap.jpg' },
    { id: 'grid', name: 'Digital Grid', file: 'grid.jpg' },
    { id: 'circuit', name: 'Circuit Board', file: 'circuit.jpg' },
    { id: 'board', name: 'Investigation Board', file: 'board.jpg' },
    { id: 'govmin', name: 'Government Minimal', file: 'govmin.jpg' },
    { id: 'abstract', name: 'Abstract Dark', file: 'abstract.jpg' }
];

const WALLPAPER_DIR = 'assets/wallpapers/';

export class DesktopManager {
        constructor({ mountEl, wallpaperEl, registry, onLaunch }) {
        this.mountEl = mountEl;
        this.wallpaperEl = wallpaperEl;
        this.registry = registry;
        this.onLaunch = onLaunch;
        this.selectedId = null;
        this.selectedIds = new Set();
        this.contextMenuEl = document.getElementById('desktop-context-menu');

        this._loadPositionState();
        this._seenIds = new Set(stateManager.get('seen_desktop_icons') || []);
        this.applyWallpaper(stateManager.get('wallpaper') || 'blueprint');
        this.applyGridVisibility(stateManager.get('desktop_grid') !== false);

        this._bindDesktopClick();
        this._bindMarquee();
        this._bindContextMenu();

        eventBus.on('APP_UNLOCKED', () => this.render());
        eventBus.on('WALLPAPER_CHANGE', (id) => this.applyWallpaper(id));
        eventBus.on('DESKTOP_GRID_TOGGLE', (show) => this.applyGridVisibility(show));
        eventBus.on('PIN_STICKY_NOTE', (payload) => this.spawnStickyNote(payload));

        window.addEventListener('resize', () => this._clampAllPositions());
    }

    spawnStickyNote({ title, text }) {
        const workspace = document.getElementById('workspace') || document.body;
        const note = document.createElement('div');
        note.className = 'desktop-sticky-note';
        const offsetX = 100 + Math.floor(Math.random() * 120);
        const offsetY = 100 + Math.floor(Math.random() * 120);
        note.style.cssText = `position: absolute; left: ${offsetX}px; top: ${offsetY}px; width: 230px; background: rgba(14, 18, 16, 0.95); border: 1px solid var(--accent-blue); box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 4px; z-index: 50; color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; padding: 0; animation: fadeIn 0.2s ease-out;`;
        
        note.innerHTML = `
            <div class="sticky-header" style="background: var(--bg-surface); padding: 4px 8px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; cursor: move; font-weight: bold; font-size: 10px; color: var(--accent-blue);">
                <span>📌 ${title || 'STICKY NOTE'}</span>
                <button class="sticky-close-btn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 12px; font-weight: bold;">✕</button>
            </div>
            <div class="sticky-body" style="padding: 10px; white-space: pre-wrap; word-break: break-word; line-height: 1.4;">${text}</div>
        `;

        note.querySelector('.sticky-close-btn').addEventListener('click', () => {
            if (AudioController.windowClose) AudioController.windowClose();
            note.remove();
        });

        const header = note.querySelector('.sticky-header');
        let isDragging = false, startX, startY, initialLeft, initialTop;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = note.offsetLeft;
            initialTop = note.offsetTop;
            note.style.zIndex = 1000;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            note.style.left = `${initialLeft + dx}px`;
            note.style.top = `${initialTop + dy}px`;
        });

        document.addEventListener('mouseup', () => { isDragging = false; });

        workspace.appendChild(note);
        if (AudioController.bookmark) AudioController.bookmark();
    }

        _gridBounds() {
        if (!this.mountEl) return this._lastGoodBounds || { maxCol: 39, maxRow: 39 };
        const rect = this.mountEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            if (this._lastGoodBounds) return this._lastGoodBounds;

            const maxCol = Math.max(0, Math.floor((window.innerWidth - GRID_PAD_X - ICON_W) / GRID_W));
            const maxRow = Math.max(0, Math.floor((window.innerHeight - GRID_PAD_Y - ICON_H) / GRID_H));
            return { maxCol, maxRow };
        }
        const maxCol = Math.max(0, Math.floor((rect.width - GRID_PAD_X - ICON_W) / GRID_W));
        const maxRow = Math.max(0, Math.floor((rect.height - GRID_PAD_Y - ICON_H) / GRID_H));
        this._lastGoodBounds = { maxCol, maxRow };
        return this._lastGoodBounds;
    }

        _clampAllPositions() {
        const apps = this._visibleApps();
        const before = JSON.stringify(this.positions);
        this._resolvePositions(apps);
        if (JSON.stringify(this.positions) !== before) this.render();
    }

        _resolvePositions(apps) {
        const { maxCol, maxRow } = this._gridBounds();
        const occupied = new Set();
        apps.forEach(app => {
            const pos = this.positions[app.id];
            const inBounds = pos && pos.col >= 0 && pos.row >= 0 && pos.col <= maxCol && pos.row <= maxRow;
            const key = pos ? `${pos.col},${pos.row}` : null;
            if (inBounds && !occupied.has(key)) {
                occupied.add(key);
            } else {
                const cell = this._nextFreeCell(occupied);
                occupied.add(`${cell.col},${cell.row}`);
                this.positions[app.id] = cell;
            }
        });
    }

    _loadPositionState() {
        this.positions = stateManager.get('icon_positions') || {};
    }

    _savePositions() {
        stateManager.set('icon_positions', this.positions);
    }

    _unlockedSet() {
        const unlocked = stateManager.get('unlocked_apps') || [];
        return new Set(unlocked);
    }

    _visibleApps() {
        const unlocked = this._unlockedSet();
        return this.registry.filter(app => app.alwaysVisible || unlocked.has(app.id));
    }

        _nextFreeCell(occupied) {
        const { maxCol, maxRow } = this._gridBounds();
        for (let col = 0; col <= maxCol; col++) {
            for (let row = 0; row <= maxRow; row++) {
                const key = `${col},${row}`;
                if (!occupied.has(key)) return { col, row };
            }
        }

        return { col: 0, row: 0 };
    }

    render() {
        if (!this.mountEl) return;
        const apps = this._visibleApps();
        const knownIds = new Set(apps.map(a => a.id));

        Object.keys(this.positions).forEach(id => { if (!knownIds.has(id)) delete this.positions[id]; });

        this._resolvePositions(apps);

        this.mountEl.innerHTML = '';
        if (this._marqueeEl) this.mountEl.appendChild(this._marqueeEl);
        apps.forEach((app, idx) => {
            const pos = this.positions[app.id];
            const isNewUnlock = this._hasRenderedOnce && !this._seenIds.has(app.id);
            const iconEl = this._buildIcon(app, pos);
            if (isNewUnlock) iconEl.classList.add('is-new-unlock');
            this._seenIds.add(app.id);
            this.mountEl.appendChild(iconEl);

            requestAnimationFrame(() => {
                setTimeout(() => iconEl.classList.add('is-in'), idx * 30);
            });
            if (isNewUnlock) {
                setTimeout(() => iconEl.classList.remove('is-new-unlock'), 2200);
            }
        });
        this._hasRenderedOnce = true;
        stateManager.set('seen_desktop_icons', Array.from(this._seenIds));
        this._savePositions();

        this.selectedIds.forEach(id => {
            const el = this.mountEl.querySelector(`.desktop-icon[data-app-id="${id}"]`);
            if (el) el.classList.add('is-selected');
        });
    }

    _buildIcon(app, pos) {
        const el = document.createElement('div');
        el.className = 'desktop-icon';
        el.dataset.appId = app.id;
        el.style.left = `${GRID_PAD_X + pos.col * GRID_W}px`;
        el.style.top = `${GRID_PAD_Y + pos.row * GRID_H}px`;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', app.label);
        el.innerHTML = `
            <div class="desktop-icon-glyph">${app.icon}</div>
            <div class="desktop-icon-label">${app.label}</div>
            <span class="notification-badge hidden" data-badge-for="${app.id}"></span>
        `;

        let dragging = false, moved = false, offsetX = 0, offsetY = 0, downAt = 0;
        let groupStartPositions = null; 

        const onMouseMove = (e) => {
            moved = true;
            const workspaceRect = this.mountEl.getBoundingClientRect();
            const maxX = Math.max(4, workspaceRect.width - ICON_W - 4);
            const maxY = Math.max(4, workspaceRect.height - ICON_H - 4);
            let x = e.clientX - workspaceRect.left - offsetX;
            let y = e.clientY - workspaceRect.top - offsetY;
            x = Math.min(maxX, Math.max(4, x));
            y = Math.min(maxY, Math.max(4, y));

            if (groupStartPositions) {
                const dx = x - parseFloat(el.style.left);
                const dy = y - parseFloat(el.style.top);
                groupStartPositions.forEach(({ el: memberEl }) => {
                    if (memberEl === el) return;
                    const nextLeft = Math.min(maxX, Math.max(4, parseFloat(memberEl.style.left) + dx));
                    const nextTop = Math.min(maxY, Math.max(4, parseFloat(memberEl.style.top) + dy));
                    memberEl.style.left = `${nextLeft}px`;
                    memberEl.style.top = `${nextTop}px`;
                });
            }
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
        };

        const onMouseUp = (e) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (dragging && moved) {

                const { maxCol, maxRow } = this._gridBounds();
                const workspaceRect = this.mountEl.getBoundingClientRect();
                const rawX = e.clientX - workspaceRect.left - offsetX;
                const rawY = e.clientY - workspaceRect.top - offsetY;
                const col = Math.min(maxCol, Math.max(0, Math.round((rawX - GRID_PAD_X) / GRID_W)));
                const row = Math.min(maxRow, Math.max(0, Math.round((rawY - GRID_PAD_Y) / GRID_H)));
                const colDelta = col - pos.col;
                const rowDelta = row - pos.row;

                if (groupStartPositions && groupStartPositions.size > 1) {

                    groupStartPositions.forEach(({ pos: memberPos }, memberId) => {
                        this.positions[memberId] = {
                            col: Math.min(maxCol, Math.max(0, memberPos.col + colDelta)),
                            row: Math.min(maxRow, Math.max(0, memberPos.row + rowDelta))
                        };
                    });
                } else {

                    const collidingId = Object.keys(this.positions).find(id =>
                        id !== app.id && this.positions[id].col === col && this.positions[id].row === row
                    );
                    if (collidingId) {
                        this.positions[collidingId] = { col: pos.col, row: pos.row };
                    }
                    this.positions[app.id] = { col, row };
                    pos = this.positions[app.id];
                }
                this.render();
            }
            dragging = false;
            groupStartPositions = null;
        };

        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const isGroupDrag = this.selectedIds.has(app.id) && this.selectedIds.size > 1;
            if (!isGroupDrag) this._selectIcon(app.id);

            if (isGroupDrag) {
                groupStartPositions = new Map();
                this.selectedIds.forEach(id => {
                    const memberEl = this.mountEl.querySelector(`.desktop-icon[data-app-id="${id}"]`);
                    if (memberEl) groupStartPositions.set(id, { el: memberEl, pos: { ...this.positions[id] } });
                });
            }

            dragging = true;
            moved = false;
            downAt = Date.now();
            const rect = el.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        el.addEventListener('mouseenter', () => { if (AudioController.hover) AudioController.hover(); });

        el.addEventListener('dblclick', () => {
            if (AudioController.launch) AudioController.launch();
            else if (AudioController.click) AudioController.click();
            this.onLaunch(app.id);
        });

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.onLaunch(app.id);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                this._focusInDirection(el, e.key);
            }
        });

        el.addEventListener('focus', () => this._selectIcon(app.id));

        return el;
    }

        _focusInDirection(currentEl, arrowKey) {
        const DIRS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
        const [dx, dy] = DIRS[arrowKey];
        const icons = Array.from(this.mountEl.querySelectorAll('.desktop-icon'));
        const curRect = currentEl.getBoundingClientRect();
        const cx = curRect.left + curRect.width / 2;
        const cy = curRect.top + curRect.height / 2;

        let best = null, bestScore = Infinity;
        icons.forEach(el => {
            if (el === currentEl) return;
            const r = el.getBoundingClientRect();
            const ex = r.left + r.width / 2;
            const ey = r.top + r.height / 2;
            const vx = ex - cx, vy = ey - cy;
            const primary = dx !== 0 ? vx * dx : vy * dy;
            if (primary <= 0) return; 
            const cross = dx !== 0 ? vy : vx;
            const score = primary + Math.abs(cross) * 3;
            if (score < bestScore) { bestScore = score; best = el; }
        });

        if (best) best.focus();
    }

    _selectIcon(id) {
        this.selectedId = id;
        this.selectedIds = new Set([id]);
        this.mountEl.querySelectorAll('.desktop-icon.is-selected').forEach(n => n.classList.remove('is-selected'));
        const target = this.mountEl.querySelector(`.desktop-icon[data-app-id="${id}"]`);
        if (target) target.classList.add('is-selected');
    }

        _bindMarquee() {
        let startX = 0, startY = 0, active = false;
        const marquee = document.createElement('div');
        marquee.className = 'desktop-marquee hidden';
        this.mountEl.appendChild(marquee);
        this._marqueeEl = marquee;

        const onMove = (e) => {
            if (!active) return;
            const rect = this.mountEl.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;
            const left = Math.min(startX, curX), top = Math.min(startY, curY);
            const w = Math.abs(curX - startX), h = Math.abs(curY - startY);
            marquee.style.left = `${left}px`;
            marquee.style.top = `${top}px`;
            marquee.style.width = `${w}px`;
            marquee.style.height = `${h}px`;
            marquee.classList.remove('hidden');

            const marqueeRect = { left, top, right: left + w, bottom: top + h };
            this.mountEl.querySelectorAll('.desktop-icon').forEach(iconEl => {
                const l = parseFloat(iconEl.style.left), t = parseFloat(iconEl.style.top);
                const overlaps = l < marqueeRect.right && l + 84 > marqueeRect.left && t < marqueeRect.bottom && t + 92 > marqueeRect.top;
                iconEl.classList.toggle('is-selected', overlaps);
            });
        };

        const onUp = () => {
            active = false;
            marquee.classList.add('hidden');
            this.selectedIds = new Set(
                Array.from(this.mountEl.querySelectorAll('.desktop-icon.is-selected')).map(n => n.dataset.appId)
            );
            this.selectedId = this.selectedIds.size === 1 ? Array.from(this.selectedIds)[0] : null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        this.mountEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || e.target !== this.mountEl) return;
            active = true;
            const rect = this.mountEl.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            this.mountEl.querySelectorAll('.desktop-icon.is-selected').forEach(n => n.classList.remove('is-selected'));
            this.selectedIds = new Set();
            this.selectedId = null;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    _bindDesktopClick() {

        this.mountEl.parentElement && this.mountEl.parentElement.addEventListener('mousedown', (e) => {
            if (e.target === this.mountEl || e.target.id === 'workspace') {
                this.selectedId = null;
                this.mountEl.querySelectorAll('.desktop-icon.is-selected').forEach(n => n.classList.remove('is-selected'));
            }
        });
    }

    setBadge(appId, visible) {
        const badge = this.mountEl.querySelector(`.notification-badge[data-badge-for="${appId}"]`);
        if (badge) badge.classList.toggle('hidden', !visible);
    }

    applyWallpaper(id) {
        if (!this.wallpaperEl) return;
        const wp = WALLPAPERS.find(w => w.id === id) || WALLPAPERS[0];
        const primary = `${WALLPAPER_DIR}${wp.file}`;

        this.wallpaperEl.style.backgroundImage = `url("${primary}")`;
        // Plain static servers (no vite) serve these under `public/…` — swap
        // to the prefixed path only if the primary one fails to load.
        if (!primary.startsWith('public/')) {
            const probe = new Image();
            probe.onerror = () => {
                if (this.wallpaperEl) {
                    this.wallpaperEl.style.backgroundImage = `url("public/${primary}")`;
                }
            };
            probe.src = primary;
        }
        stateManager.set('wallpaper', wp.id);
    }

    applyGridVisibility(show) {
        if (!this.mountEl) return;
        this.mountEl.classList.toggle('grid-visible', !!show);
        stateManager.set('desktop_grid', !!show);
    }

    sortIcons() {
        const apps = this._visibleApps();
        this.positions = {};
        apps.forEach((app, i) => {
            this.positions[app.id] = { col: Math.floor(i / 8), row: i % 8 };
        });
        this.render();
    }

    _bindContextMenu() {
        const menu = this.contextMenuEl;
        if (!menu) return;

        const container = this.mountEl.parentElement || this.mountEl;
        container.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.os-window')) return; 
            e.preventDefault();
            this._openContextMenu(e.clientX, e.clientY);
        });

        document.addEventListener('mousedown', (e) => {
            if (menu && !menu.contains(e.target)) this._closeContextMenu();
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this._closeContextMenu(); });

        menu.querySelectorAll('[data-action]').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this._closeContextMenu();
                this._handleContextAction(action);
            });
        });
    }

    _openContextMenu(x, y) {
        const menu = this.contextMenuEl;
        if (!menu) return;
        menu.classList.remove('hidden');
        const { innerWidth, innerHeight } = window;
        const maxX = innerWidth - menu.offsetWidth - 8;
        const maxY = innerHeight - menu.offsetHeight - 8;
        menu.style.left = `${Math.min(x, maxX)}px`;
        menu.style.top = `${Math.min(y, maxY)}px`;
        if (AudioController.hover) AudioController.hover();
    }

    _closeContextMenu() {
        if (this.contextMenuEl) this.contextMenuEl.classList.add('hidden');
    }

    _handleContextAction(action) {
        switch (action) {
            case 'refresh':
                this.mountEl.classList.add('is-refreshing');
                setTimeout(() => this.mountEl.classList.remove('is-refreshing'), 300);
                this.render();
                break;
            case 'sort':
            case 'arrange':
                this.sortIcons();
                break;
            case 'wallpaper':
            case 'appearance':
            case 'settings':

                document.dispatchEvent(new CustomEvent('LAUNCH_APP', { detail: 'settings' }));
                eventBus.emit('OPEN_SETTINGS_TAB', action === 'wallpaper' ? 'appearance' : action);
                break;
        }
        if (AudioController.click) AudioController.click();
    }
}
