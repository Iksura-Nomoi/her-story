
import { AudioController } from '../core/AudioController.js';
import { eventBus } from '../core/EventBus.js';
import { TemplateLoader } from '../services/TemplateLoader.js';
const BASE_APP_TEMPLATE_PATH = 'templates/base-app.html';
export class BaseApp {
    constructor(id, title, width = 800, height = 500, windowManager) {
        this.id = id;
        this.title = title;
        this.width = width;
        this.height = height;
        this.windowManager = windowManager;
        this.element = null;
        this.isOpen = false;
        this.isMinimized = false;
        this.isMaximized = false;
        this.minWidth = 360;
        this.minHeight = 280;
        this._isDragging = false;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
        this._isResizing = false;
        this._resizeDir = null;
        this._resizeStart = null;
        this._closeTimer = null;
    }
    render() {
        if (this.element) return this.element;
        this.element = document.createElement('div');
        this.element.className = 'os-window';
        this.element.id = `window-${this.id}`;
        const saved = this.windowManager.geometry && this.windowManager.geometry.get(this.id);
        let startX, startY, startW, startH;
        if (saved) {
            startX = saved.left; startY = saved.top; startW = saved.width; startH = saved.height;
        } else {
            startW = this.width;
            startH = this.height;
            startX = (window.innerWidth - 64 - this.width) / 2 + 64; 
            startY = (window.innerHeight - this.height) / 2;
        }
        this.element.style.width = `${startW}px`;
        this.element.style.height = `${startH}px`;
        this.element.style.left = `${startX}px`;
        this.element.style.top = `${startY}px`;
        this.element.style.minWidth = `${this.minWidth}px`;
        this.element.style.minHeight = `${this.minHeight}px`;
        const template = TemplateLoader.getSync(BASE_APP_TEMPLATE_PATH);
        this.element.innerHTML = template.replaceAll('{{title}}', this.title);
        this.element.setAttribute('tabindex', '-1');
        this._bindEvents();
        return this.element;
    }
    _bindEvents() {
        const header = this.element.querySelector('.window-header');
        const closeBtn = this.element.querySelector('.win-btn.close');
        const minimizeBtn = this.element.querySelector('.win-btn.minimize');
        const maximizeBtn = this.element.querySelector('.win-btn.maximize');
        // If the window template failed to load (offline / wrong server root),
        // degrade gracefully instead of throwing on null controls.
        if (!header) {
            console.warn(`[Her-Story] window template missing for "${this.id}" — controls disabled.`);
            return;
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimize();
            });
        }
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMaximize();
            });
        }
        this.element.addEventListener('mousedown', () => {
            this.windowManager.bringToFront(this.id);
        });
        this.element.addEventListener('focusin', () => {
            this.windowManager.bringToFront(this.id);
        });
        this.element.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const active = document.activeElement;
            const isComposing = active && (active.tagName === 'TEXTAREA' || active.isContentEditable);
            if (isComposing) return;
            e.stopPropagation();
            this.close();
        });
        header.addEventListener('mousedown', (e) => {
            if (this.isMaximized) return; 
            if (e.target.closest('.win-btn')) return;
            this._isDragging = true;
            this.windowManager.bringToFront(this.id);
            const rect = this.element.getBoundingClientRect();
            this._dragOffsetX = e.clientX - rect.left;
            this._dragOffsetY = e.clientY - rect.top;
            document.addEventListener('mousemove', this._handleDrag);
            document.addEventListener('mouseup', this._handleDragEnd);
        });
        header.addEventListener('dblclick', (e) => {
            if (e.target.closest('.win-btn')) return;
            this.toggleMaximize();
        });
        const handles = this.element.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                if (this.isMaximized) return; 
                e.stopPropagation();
                e.preventDefault();
                this._isResizing = true;
                this._resizeDir = handle.dataset.dir;
                this.windowManager.bringToFront(this.id);
                const rect = this.element.getBoundingClientRect();
                this._resizeStart = {
                    mouseX: e.clientX,
                    mouseY: e.clientY,
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                };
                document.addEventListener('mousemove', this._handleResize);
                document.addEventListener('mouseup', this._handleResizeEnd);
            });
        });
    }
    _handleDrag = (e) => {
        if (!this._isDragging) return;
        let newX = e.clientX - this._dragOffsetX;
        let newY = e.clientY - this._dragOffsetY;
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 36;
        if (newX < 64) newX = 64; 
        if (newY < 0) newY = 0;   
        if (newX > maxX) newX = maxX;
        if (newY > maxY) newY = maxY;
        this.element.style.left = `${newX}px`;
        this.element.style.top = `${newY}px`;
    };
    _handleDragEnd = () => {
        this._isDragging = false;
        document.removeEventListener('mousemove', this._handleDrag);
        document.removeEventListener('mouseup', this._handleDragEnd);
        this._saveGeometry();
    };
    _handleResize = (e) => {
        if (!this._isResizing) return;
        const dir = this._resizeDir;
        const start = this._resizeStart;
        const dx = e.clientX - start.mouseX;
        const dy = e.clientY - start.mouseY;
        let newLeft = start.left;
        let newTop = start.top;
        let newWidth = start.width;
        let newHeight = start.height;
        const minLeft = 64; 
        const minTop = 0;
        const maxRight = window.innerWidth;
        const maxBottom = window.innerHeight;
        if (dir.includes('e')) {
            newWidth = Math.max(this.minWidth, start.width + dx);
            newWidth = Math.min(newWidth, maxRight - start.left);
        }
        if (dir.includes('s')) {
            newHeight = Math.max(this.minHeight, start.height + dy);
            newHeight = Math.min(newHeight, maxBottom - start.top);
        }
        if (dir.includes('w')) {
            let proposedLeft = start.left + dx;
            let proposedWidth = start.width - dx;
            if (proposedLeft < minLeft) {
                proposedWidth -= (minLeft - proposedLeft);
                proposedLeft = minLeft;
            }
            if (proposedWidth < this.minWidth) {
                proposedLeft -= (this.minWidth - proposedWidth);
                proposedWidth = this.minWidth;
            }
            newLeft = proposedLeft;
            newWidth = proposedWidth;
        }
        if (dir.includes('n')) {
            let proposedTop = start.top + dy;
            let proposedHeight = start.height - dy;
            if (proposedTop < minTop) {
                proposedHeight -= (minTop - proposedTop);
                proposedTop = minTop;
            }
            if (proposedHeight < this.minHeight) {
                proposedTop -= (this.minHeight - proposedHeight);
                proposedHeight = this.minHeight;
            }
            newTop = proposedTop;
            newHeight = proposedHeight;
        }
        this.element.style.left = `${newLeft}px`;
        this.element.style.top = `${newTop}px`;
        this.element.style.width = `${newWidth}px`;
        this.element.style.height = `${newHeight}px`;
        this._onResize();
    };
    _handleResizeEnd = () => {
        this._isResizing = false;
        this._resizeDir = null;
        this._resizeStart = null;
        document.removeEventListener('mousemove', this._handleResize);
        document.removeEventListener('mouseup', this._handleResizeEnd);
        this._saveGeometry();
    };
    _onResize() {}
    toggleMaximize() {
        if (this.isMaximized) {
            this.isMaximized = false;
            const restore = this._preMaximizeGeometry;
            if (restore) {
                this.element.style.left = `${restore.left}px`;
                this.element.style.top = `${restore.top}px`;
                this.element.style.width = `${restore.width}px`;
                this.element.style.height = `${restore.height}px`;
            }
            this.element.classList.remove('is-maximized');
        } else {
            const rect = this.element.getBoundingClientRect();
            this._preMaximizeGeometry = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
            this.isMaximized = true;
            this.element.classList.add('is-maximized');
            this.element.style.left = '64px'; 
            this.element.style.top = '0px';
            this.element.style.width = `${window.innerWidth - 64}px`;
            this.element.style.height = `${window.innerHeight}px`;
        }
        if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
        this._onResize();
        this._saveGeometry();
    }
    _saveGeometry() {
        if (!this.element || !this.windowManager.geometry) return;
        if (this.isMaximized) return;
        const rect = this.element.getBoundingClientRect();
        this.windowManager.geometry.set(this.id, {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
    }
    _onOpen() {}
    _focusOnOpen() {
        requestAnimationFrame(() => {
            if (!this.element || !this.isOpen || this.isMinimized) return;
            const focusable = this.element.querySelector(
                '.window-content [tabindex]:not([tabindex="-1"]), .window-content button, .window-content input, .window-content textarea, .window-content select, .window-content a[href]'
            );
            (focusable || this.element).focus({ preventScroll: true });
        });
    }
    open() {
        if (this.isOpen) {
            if (this._closeTimer) {
                clearTimeout(this._closeTimer);
                this._closeTimer = null;
                this.element.classList.add('is-open');
            }
            if (this.isMinimized) {
                AudioController.click();
                this.element.classList.remove('is-minimized');
                this.isMinimized = false;
            }
            this.windowManager.bringToFront(this.id);
            eventBus.emit('APP_STATE_CHANGED', { appId: this.id, isOpen: true, isMinimized: this.isMinimized });
            this._onOpen();
            this._focusOnOpen();
            return;
        }
        const workspace = document.getElementById('workspace');
        workspace.appendChild(this.render());
        void this.element.offsetWidth;
        AudioController.windowOpen ? AudioController.windowOpen() : AudioController.click();
        this.element.classList.add('is-open');
        this.isOpen = true;
        this.windowManager.bringToFront(this.id);
        eventBus.emit('APP_STATE_CHANGED', { appId: this.id, isOpen: true, isMinimized: false });
        this._onOpen();
        this._focusOnOpen();
    }
    minimize() {
        if (!this.isOpen || this.isMinimized) return;
        AudioController.click();
        this.element.classList.add('is-minimized');
        this.isMinimized = true;
        eventBus.emit('APP_STATE_CHANGED', { appId: this.id, isOpen: true, isMinimized: true });
    }
    _renderListItem({ active, locked = false, borderColor = 'var(--accent-blue)', innerHtml, onClick }) {
        const item = document.createElement('div');
        item.style.cssText = `padding: 12px; margin-bottom: 5px; border-left: 3px solid ${active ? borderColor : 'transparent'}; cursor: ${locked ? 'not-allowed' : 'pointer'}; background: ${active ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)'}; opacity: ${locked ? '0.5' : '1'}; transition: all 0.2s;`;
        item.innerHTML = innerHtml;
        if (!locked) {
            item.addEventListener('mouseenter', () => { if (!active) item.style.borderLeft = '3px solid var(--border-subtle)'; });
            item.addEventListener('mouseleave', () => { if (!active) item.style.borderLeft = '3px solid transparent'; });
            if (onClick) {
                item.addEventListener('click', () => {
                    if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
                    onClick();
                });
            }
        }
        return item;
    }
    _createSidebarBtn(cssClass, dataAttr, dataValue, label, padding = '12px 15px') {
        return `<div class="${cssClass}" data-${dataAttr}="${dataValue}" style="padding: ${padding}; cursor: pointer; border-left: 3px solid transparent; color: var(--text-primary); font-size: 12px; transition: all 0.2s;">${label}</div>`;
    }
    _onClose() {}
    close() {
        if (!this.isOpen || this._closeTimer) return;
        this._onClose();
        this._isDragging = false;
        this._isResizing = false;
        this._resizeDir = null;
        this._resizeStart = null;
        document.removeEventListener('mousemove', this._handleDrag);
        document.removeEventListener('mouseup', this._handleDragEnd);
        document.removeEventListener('mousemove', this._handleResize);
        document.removeEventListener('mouseup', this._handleResizeEnd);
        this._saveGeometry();
        AudioController.windowClose ? AudioController.windowClose() : AudioController.click();
        this.element.classList.remove('is-open');
        this._closeTimer = setTimeout(() => {
            this._closeTimer = null;
            if (!this.element) return; 
            this.element.remove();
            this.element = null; 
            this.isOpen = false;
            this.isMinimized = false;
            this.windowManager.unregisterApp(this.id);
            eventBus.emit('APP_STATE_CHANGED', { appId: this.id, isOpen: false, isMinimized: false });
        }, 150); 
    }
}
