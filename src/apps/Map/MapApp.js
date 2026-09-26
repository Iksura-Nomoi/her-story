import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const MAP_SHELL_TEMPLATE_PATH = 'src/apps/Map/MapApp.html';
export class MapApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeTarget = null;
        const caseData = stateManager.get('caseData');
        this.trackingData = caseData?.map || [];
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--reset');
            const template = TemplateLoader.getSync(MAP_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template.replaceAll('{{id}}', this.id);
            this._renderList();
        }
        return this.element;
    }
    _renderList() {
        const listEl = this.element.querySelector(`#map-target-list-${this.id}`);
        if (!listEl) return;
        listEl.innerHTML = '';
        this.trackingData.forEach(target => {
            const isActive = this.activeTarget && this.activeTarget.id === target.id;
            const item = this._renderListItem({
                active: isActive,
                borderColor: target.color,
                innerHtml: `<div style="color: ${isActive ? target.color : 'var(--text-primary)'}; font-weight: bold; font-size: 13px;">${target.name}</div><div style="font-size: 10px; color: var(--text-secondary); margin-top: 6px;">ID: ${target.id} // STATUS: ${target.status}</div>`,
                onClick: () => {
                    this._loadTarget(target);
                    this._renderList();
                }
            });
            listEl.appendChild(item);
        });
    }
    _loadTarget(target) {
        this.activeTarget = target;
        const detailsEl = this.element.querySelector(`#map-target-details-${this.id}`);
        let pingsList = target.pings.map(p => `<div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;"><span style="color: var(--text-secondary);">${p.time}</span><span style="color: ${target.color};">${p.loc}</span></div>`).join('');
        detailsEl.innerHTML = `<div style="color: var(--text-primary); font-size: 12px; margin-bottom: 10px;">${target.name}</div><div style="margin-bottom: 15px;">${pingsList}</div><div style="font-size: 10px; color: var(--text-muted); border-top: 1px dashed var(--border-subtle); padding-top: 8px;"><span style="color: var(--text-secondary);">NOTES:</span><br>${target.notes || 'None'}</div>`;
        this._drawRoute(target);
    }
    _drawRoute(target) {
        const canvas = this.element.querySelector(`#map-canvas-${this.id}`);
        if (!canvas) return;
        canvas.innerHTML = ''; 
        let svgLines = `<svg width="100%" height="100%" style="position: absolute; top: 0; left: 0; pointer-events: none;">`;
        for (let i = 0; i < target.pings.length - 1; i++) {
            let start = target.pings[i];
            let end = target.pings[i+1];
            svgLines += `<line x1="${start.x}%" y1="${start.y}%" x2="${end.x}%" y2="${end.y}%" stroke="${target.color}" stroke-width="2" stroke-dasharray="4" style="opacity: 0.5; animation: dash 20s linear infinite;" />`;
        }
        svgLines += `</svg>`;
        if (!document.getElementById('map-anim-style')) {
            const style = document.createElement('style');
            style.id = 'map-anim-style';
            style.innerHTML = `@keyframes pulse-point { 0% { box-shadow: 0 0 0 0 ${target.color}; } 70% { box-shadow: 0 0 0 10px rgba(0,0,0,0); } 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); } }`;
            document.head.appendChild(style);
        }
        canvas.innerHTML += svgLines;
        target.pings.forEach((ping, index) => {
            const point = document.createElement('div');
            const isLast = index === target.pings.length - 1;
            point.style.cssText = `position: absolute; left: ${ping.x}%; top: ${ping.y}%; width: 10px; height: 10px; background: ${target.color}; border-radius: 50%; transform: translate(-50%, -50%); animation: ${isLast ? 'pulse-point 2s infinite' : 'none'}; z-index: 10;`;
            const label = document.createElement('div');
            label.style.cssText = `position: absolute; top: -20px; left: 15px; background: rgba(0,0,0,0.8); border: 1px solid ${target.color}; color: #fff; font-size: 10px; padding: 2px 6px; white-space: nowrap; pointer-events: none;`;
            label.innerText = `${ping.time} - ${ping.loc}`;
            point.appendChild(label);
            canvas.appendChild(point);
        });
    }
}
