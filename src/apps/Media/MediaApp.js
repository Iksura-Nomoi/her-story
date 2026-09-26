import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const MEDIA_SHELL_TEMPLATE_PATH = 'src/apps/Media/MediaApp.html';
export class MediaApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeMedia = null;
        const caseData = stateManager.get('caseData');
        this.mediaFiles = caseData?.media || [];
        this.revealedFlagIds = new Set();
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex');
            const initialMessage = this.mediaFiles.length ? 'AWAITING MEDIA SELECTION' : 'NO MEDIA MOUNTED';
            const template = TemplateLoader.getSync(MEDIA_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{initialMessage}}', initialMessage);
            this._renderList();
            this._bindAppEvents();
        }
        return this.element;
    }
    _renderList() {
        const listEl = this.element.querySelector(`#media-list-${this.id}`);
        if (!listEl) return;
        listEl.innerHTML = '';
        this.mediaFiles.forEach(file => {
            const item = document.createElement('div');
            const isActive = this.activeMedia && this.activeMedia.id === file.id;
            item.style.cssText = `padding: 12px; margin-bottom: 5px; border-left: 3px solid ${isActive ? 'var(--accent-blue)' : 'transparent'}; cursor: pointer; background: ${isActive ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)'}; transition: all 0.2s;`;
            item.innerHTML = `<div style="color: ${isActive ? 'var(--accent-blue)' : 'var(--text-primary)'}; font-weight: 500; font-size: 13px; word-break: break-all;">${file.name}</div><div style="font-size: 10px; color: var(--text-secondary); margin-top: 6px; text-transform: uppercase; border: 1px solid var(--border-subtle); display: inline-block; padding: 2px 4px; border-radius: 2px;">${file.type}</div>`;
            item.addEventListener('mouseenter', () => { if (!isActive) item.style.borderLeft = '3px solid var(--border-subtle)'; });
            item.addEventListener('mouseleave', () => { if (!isActive) item.style.borderLeft = '3px solid transparent'; });
            item.addEventListener('click', () => {
                if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
                this._loadMedia(file);
                this._renderList(); 
            });
            listEl.appendChild(item);
        });
    }
    _loadMedia(file) {
        this.activeMedia = file;
        const stage = this.element.querySelector(`#media-stage-${this.id}`);
        const content = this.element.querySelector(`#media-content-${this.id}`);
        const exifPanel = this.element.querySelector(`#media-exif-${this.id}`);
        const exifData = this.element.querySelector(`#media-exif-data-${this.id}`);
        const revealPanel = this.element.querySelector(`#media-reveal-${this.id}`);
        Array.from(stage.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE || (node.tagName === 'SPAN' && node.textContent.includes('AWAITING'))) node.remove();
        });
        const controls = ['zoom', 'bright', 'contrast'].map(id => this.element.querySelector(`#media-${id}-${this.id}`));
        controls.forEach(ctrl => { ctrl.disabled = false; ctrl.value = 1; });
        this.element.querySelector(`#media-reset-${this.id}`).disabled = false;
        content.innerHTML = file.content;
        if (revealPanel) { revealPanel.style.display = 'none'; revealPanel.innerHTML = ''; }
        this._updateFilters(1, 1, 1);
        let metaHtml = '';
        if (file.metadata) {
            for (const [key, value] of Object.entries(file.metadata)) {
                metaHtml += `<div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">${key}:</span> <span style="text-align: right; margin-left: 10px;">${value}</span></div>`;
            }
        } else {
            metaHtml = '<div style="color: var(--text-muted);">NO METADATA RECOVERED</div>';
        }
        exifData.innerHTML = metaHtml;
        exifPanel.style.display = 'block';
    }
    _updateFilters(zoom, bright, contrast) {
        const content = this.element.querySelector(`#media-content-${this.id}`);
        if (content) {
            content.style.transform = `scale(${zoom})`;
            content.style.filter = `brightness(${bright}) contrast(${contrast})`;
        }
        this._checkReveal(zoom, bright, contrast);
    }
    _checkReveal(zoom, bright, contrast) {
        const file = this.activeMedia;
        const reveal = file?.reveal;
        const revealPanel = this.element.querySelector(`#media-reveal-${this.id}`);
        if (!reveal || !revealPanel) return;
        const values = { zoom, brightness: bright, contrast };
        const current = parseFloat(values[reveal.property]);
        const threshold = parseFloat(reveal.threshold);
        if (Number.isNaN(current) || Number.isNaN(threshold)) return;
        const crossed = reveal.direction === 'below' ? current < threshold : current > threshold;
        if (crossed && reveal.revealText) {
            revealPanel.style.display = 'block';
            revealPanel.innerHTML = reveal.revealText;
            const flagKey = `${file.id}:${reveal.resultingFlag}`;
            if (reveal.resultingFlag && !this.revealedFlagIds.has(flagKey)) {
                this.revealedFlagIds.add(flagKey);
                stateManager.unlockFlag(reveal.resultingFlag);
            }
        } else {
            revealPanel.style.display = 'none';
        }
    }
    _bindAppEvents() {
        const zoomCtrl = this.element.querySelector(`#media-zoom-${this.id}`);
        const brightCtrl = this.element.querySelector(`#media-bright-${this.id}`);
        const contrastCtrl = this.element.querySelector(`#media-contrast-${this.id}`);
        const resetBtn = this.element.querySelector(`#media-reset-${this.id}`);
        const apply = () => { this._updateFilters(zoomCtrl.value, brightCtrl.value, contrastCtrl.value); };
        if (zoomCtrl) zoomCtrl.addEventListener('input', apply);
        if (brightCtrl) brightCtrl.addEventListener('input', apply);
        if (contrastCtrl) contrastCtrl.addEventListener('input', apply);
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (typeof AudioController !== 'undefined' && AudioController.hover) AudioController.hover();
                zoomCtrl.value = 1; brightCtrl.value = 1; contrastCtrl.value = 1;
                apply();
            });
        }
    }
}
