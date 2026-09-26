import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const CCTV_SHELL_TEMPLATE_PATH = 'src/apps/CCTV/CCTVApp.html';
export class CCTVApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeCam = null;
        const caseData = stateManager.get('caseData');
        this.cameras = caseData?.cctv || [];
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex-layered');
            const initialMessage = this.cameras.length ? 'SELECT A CAMERA TO INITIATE PLAYBACK' : 'NO FEEDS AVAILABLE';
            const template = TemplateLoader.getSync(CCTV_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{initialMessage}}', initialMessage);
            this._renderList();
            this._bindAppEvents();
        }
        return this.element;
    }
    _renderList() {
        const listEl = this.element.querySelector(`#cctv-list-${this.id}`);
        if (!listEl) return;
        listEl.innerHTML = '';
        this.cameras.forEach(cam => {
            const item = document.createElement('div');
            const isActive = this.activeCam && this.activeCam.id === cam.id;
            item.style.cssText = `padding: 12px 15px; border-left: 3px solid ${isActive ? 'var(--accent-blue)' : 'transparent'}; border-bottom: 1px solid var(--border-subtle); cursor: pointer; transition: all 0.2s; color: var(--text-primary); font-size: 13px; background: ${isActive ? 'rgba(0,0,0,0.4)' : 'transparent'};`;
            item.innerHTML = `<strong style="color: ${isActive ? 'var(--accent-blue)' : 'inherit'};">${cam.id}</strong><br><span style="color: var(--text-secondary); font-size: 11px;">${cam.name}</span>`;
            item.addEventListener('mouseenter', () => { if (!isActive) item.style.borderLeft = '3px solid var(--border-subtle)'; });
            item.addEventListener('mouseleave', () => { if (!isActive) item.style.borderLeft = '3px solid transparent'; });
            item.addEventListener('click', () => {
                if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
                this._loadCamera(cam);
                this._renderList();
            });
            listEl.appendChild(item);
        });
    }
    _loadCamera(cam) {
        this.activeCam = cam;
        const nameOverlay = this.element.querySelector(`#cctv-overlay-name-${this.id}`);
        const scrubber = this.element.querySelector(`#cctv-scrubber-${this.id}`);
        nameOverlay.textContent = `${cam.id} - ${cam.name}`;
        scrubber.disabled = false;
        scrubber.max = cam.duration;
        scrubber.value = 0;
        this._updateFrame(0);
    }
    _updateFrame(currentTime) {
        if (!this.activeCam) return;
        const timestampEl = this.element.querySelector(`#cctv-timestamp-${this.id}`);
        const feedTextEl = this.element.querySelector(`#cctv-feed-text-${this.id}`);
        const screenEl = this.element.querySelector(`#cctv-screen-${this.id}`);
        const hrs = Math.floor(currentTime / 3600).toString().padStart(2, '0');
        const mins = Math.floor((currentTime % 3600) / 60).toString().padStart(2, '0');
        const secs = (currentTime % 60).toString().padStart(2, '0');
        timestampEl.textContent = `${hrs}:${mins}:${secs}`;
        if (currentTime >= this.activeCam.clueStart && currentTime <= this.activeCam.clueEnd) {
            feedTextEl.innerHTML = this.activeCam.clueText;
            screenEl.style.boxShadow = "inset 0 0 50px rgba(255,0,0,0.2)";
        } else {
            feedTextEl.innerHTML = this.activeCam.normalText || "NO SIGNIFICANT ACTIVITY.";
            screenEl.style.boxShadow = "none";
        }
    }
    _bindAppEvents() {
        const scrubber = this.element.querySelector(`#cctv-scrubber-${this.id}`);
        if (scrubber) {
            scrubber.addEventListener('input', (e) => {
                this._updateFrame(parseInt(e.target.value, 10));
            });
        }
    }
}
