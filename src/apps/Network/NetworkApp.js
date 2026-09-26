import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const NETWORK_SHELL_TEMPLATE_PATH = 'src/apps/Network/NetworkApp.html';
export class NetworkApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.activeNode = null;
        const caseData = stateManager.get('caseData');
        this.nodes = caseData?.network || [];
        this.connections = caseData?.networkConnections || null;
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--reset');
            const stageBoxStyle = this.connections ? 'height: 100%; box-sizing: border-box; display: flex; flex-direction: column;' : '';
            const graphSection = this.connections ? `
                <div id="net-graph-${this.id}" style="position: relative; flex: 1; min-height: 300px; background-image: linear-gradient(rgba(0, 195, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 195, 255, 0.05) 1px, transparent 1px); background-size: 40px 40px;"></div>
                ` : '';
            const inspectorMarginStyle = this.connections ? 'margin-top: 20px;' : '';
            const inspectorInitialMessage = this.nodes.length ? 'SELECT A NETWORK NODE FROM THE SIDEBAR TO INSPECT TRAFFIC.' : 'NO LOCAL TRAFFIC DETECTED.';
            const template = TemplateLoader.getSync(NETWORK_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{stageBoxStyle}}', stageBoxStyle)
                .replace('{{graphSection}}', graphSection)
                .replace('{{inspectorMarginStyle}}', inspectorMarginStyle)
                .replace('{{inspectorInitialMessage}}', inspectorInitialMessage);
            this._renderList();
            if (this.connections) this._drawGraph();
        }
        return this.element;
    }
    _drawGraph() {
        const canvas = this.element.querySelector(`#net-graph-${this.id}`);
        if (!canvas) return;
        canvas.innerHTML = '';
        
        let svgLines = `<svg width="100%" height="100%" style="position: absolute; top: 0; left: 0; pointer-events: none;">`;
        this.connections.forEach(conn => {
            const from = this.nodes.find(n => n.id === conn.from);
            const to = this.nodes.find(n => n.id === conn.to);
            if (!from || !to || from.x == null || to.x == null) return;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            svgLines += `<line x1="${from.x}%" y1="${from.y}%" x2="${to.x}%" y2="${to.y}%" stroke="var(--accent-blue)" stroke-width="2" stroke-dasharray="4" style="opacity: 0.5; animation: dash 20s linear infinite;" />`;
            if (conn.label) {
                svgLines += `<text x="${midX}%" y="${midY}%" fill="var(--text-secondary)" font-size="10" font-family="var(--font-mono)" text-anchor="middle">${conn.label}</text>`;
            }
        });
        svgLines += `</svg>`;
        canvas.innerHTML = svgLines;
        this.nodes.forEach(node => {
            if (node.x == null || node.y == null) return;
            let statusColor = "var(--status-success)";
            if (node.status === 'Compromised' || node.status === 'Malicious') statusColor = "var(--status-error)";
            if (node.status === 'Encrypted') statusColor = "var(--status-warning)";
            const point = document.createElement('div');
            point.style.cssText = `position: absolute; left: ${node.x}%; top: ${node.y}%; width: 12px; height: 12px; background: ${statusColor}; border-radius: 50%; transform: translate(-50%, -50%); z-index: 10; cursor: pointer;`;
            const label = document.createElement('div');
            label.style.cssText = `position: absolute; top: -20px; left: 15px; background: rgba(0,0,0,0.8); border: 1px solid ${statusColor}; color: #fff; font-size: 10px; padding: 2px 6px; white-space: nowrap; pointer-events: none;`;
            label.innerText = node.id;
            point.appendChild(label);
            point.addEventListener('click', () => {
                this._inspectNode(node, statusColor);
                this._renderList();
            });
            canvas.appendChild(point);
        });
    }
    _renderList() {
        const listEl = this.element.querySelector(`#net-node-list-${this.id}`);
        if (!listEl) return;
        listEl.innerHTML = '';
        this.nodes.forEach(node => {
            const isActive = this.activeNode && this.activeNode.id === node.id;
            let statusColor = "var(--status-success)";
            if (node.status === 'Compromised' || node.status === 'Malicious') statusColor = "var(--status-error)";
            if (node.status === 'Encrypted') statusColor = "var(--status-warning)";
            const item = this._renderListItem({
                active: isActive,
                innerHtml: `<div style="color: ${isActive ? 'var(--accent-blue)' : 'var(--text-primary)'}; font-weight: bold; font-size: 13px;">${node.id}</div><div style="font-size: 10px; color: ${statusColor}; margin-top: 4px;">${node.type} // ${node.status}</div>`,
                onClick: () => {
                    this._inspectNode(node, statusColor);
                    this._renderList();
                }
            });
            listEl.appendChild(item);
        });
    }
    _inspectNode(node, statusColor) {
        this.activeNode = node;
        const inspector = this.element.querySelector(`#net-inspector-${this.id}`);
        if (!inspector) return;
        inspector.innerHTML = `
            <div style="animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 20px;">
                <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 20px; display: flex; flex-direction: column; gap: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--accent-blue); font-size: 18px; font-weight: bold;">${node.name}</span>
                        <span style="color: ${statusColor}; font-size: 11px; border: 1px solid ${statusColor}; padding: 2px 6px; border-radius: 2px;">${node.status.toUpperCase()}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">IP ADDRESS: <span style="color: #fff;">${node.ip}</span></div>
                    <div style="font-size: 12px; color: var(--text-secondary);">THROUGHPUT: <span style="color: var(--accent-blue);">${node.traffic}</span></div>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 20px; font-size: 13px; line-height: 1.6;">
                    <span style="color: var(--text-secondary); display: block; margin-bottom: 8px;">NODE TELEMETRY DESCRIPTION:</span>
                    ${node.desc}
                </div>
            </div>
        `;
    }
}
