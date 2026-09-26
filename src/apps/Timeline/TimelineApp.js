import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
const TIMELINE_SHELL_TEMPLATE_PATH = 'src/apps/Timeline/TimelineApp.html';
export class TimelineApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.filterCategory = 'all';
        this.filterStart = '00:00';
        this.filterEnd = '23:59';
        this.filterDateStart = '';
        this.filterDateEnd = '';
        const caseData = stateManager.get('caseData');
        this.events = caseData?.timeline || [];
        this.hasDates = this.events.some(e => !!e.date);
        if (this.hasDates) {
            const dates = this.events.filter(e => e.date).map(e => e.date).sort();
            this.filterDateStart = dates[0];
            this.filterDateEnd = dates[dates.length - 1];
        }
    }
    render() {
        if (this.element) return this.element;
        super.render(); 
        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex');
            const dateRangeSection = this.hasDates ? `
                <div style="padding: 15px; border-bottom: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 8px;">DATE RANGE</div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="date" id="timeline-date-start-${this.id}" value="${this.filterDateStart}" style="width: 100%; background: var(--bg-void); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 5px; font-family: var(--font-mono); outline: none;">
                        <span style="color: var(--text-muted);">TO</span>
                        <input type="date" id="timeline-date-end-${this.id}" value="${this.filterDateEnd}" style="width: 100%; background: var(--bg-void); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 5px; font-family: var(--font-mono); outline: none;">
                    </div>
                </div>
                ` : '';
            const filterButtons = [
                this._createFilterBtn('all', 'All Events'),
                this._createFilterBtn('message', 'Comms & Messages'),
                this._createFilterBtn('cctv', 'CCTV Logs'),
                this._createFilterBtn('access', 'Door / Access Logs'),
                this._createFilterBtn('gps', 'GPS & Location')
            ].join('\n                            ');
            const template = TemplateLoader.getSync(TIMELINE_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{dateRangeSection}}', dateRangeSection)
                .replace('{{filterButtons}}', filterButtons);
            this._bindAppEvents();
            this._renderTimeline();
        }
        return this.element;
    }
    _createFilterBtn(type, label) {
        return this._createSidebarBtn('timeline-filter-btn', 'type', type, label, '8px 10px');
    }
    _timeToMinutes(timeStr) {
        if(!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 60) + minutes;
    }
    _renderTimeline() {
        const feedEl = this.element.querySelector(`#timeline-feed-${this.id}`);
        const countEl = this.element.querySelector(`#timeline-count-${this.id}`);
        const filterBtns = this.element.querySelectorAll('.timeline-filter-btn');
        if (!feedEl || !countEl) return;
        filterBtns.forEach(btn => {
            if (btn.getAttribute('data-type') === this.filterCategory) {
                btn.style.borderLeft = '3px solid var(--accent-blue)';
                btn.style.background = 'rgba(0,0,0,0.4)';
                btn.style.color = 'var(--accent-blue)';
            } else {
                btn.style.borderLeft = '3px solid transparent';
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-primary)';
            }
        });
        const startMins = this._timeToMinutes(this.filterStart);
        const endMins = this._timeToMinutes(this.filterEnd);
        const filteredEvents = this.events.filter(event => {
            const categoryMatch = this.filterCategory === 'all' || event.category === this.filterCategory;
            if (!categoryMatch) return false;
            if (this.hasDates) {
                const eventDate = event.date || this.filterDateStart;
                const dateInRange = eventDate >= this.filterDateStart && eventDate <= this.filterDateEnd;
                if (!dateInRange) return false;
            }
            const eventMins = this._timeToMinutes(event.time);
            return eventMins >= startMins && eventMins <= endMins;
        });
        countEl.textContent = `${filteredEvents.length} EVENTS MATCHING CRITERIA`;
        feedEl.innerHTML = '';
        if (filteredEvents.length === 0) {
            feedEl.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 40px; font-style: italic;">No events found in this timeframe.</div>`;
            return;
        }
        filteredEvents.forEach(event => {
            const item = document.createElement('div');
            let dotColor = "var(--text-secondary)";
            if (event.category === 'system' || event.category === 'cctv') dotColor = "var(--status-error)";
            if (event.category === 'access') dotColor = "var(--status-warning)";
            if (event.category === 'message') dotColor = "var(--status-success)";
            item.style.cssText = `display: flex; gap: 20px; animation: fadeIn 0.3s ease-out;`;
            item.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; width: 80px; flex-shrink: 0;">
                    ${event.date ? `<div style="color: var(--text-muted); font-size: 10px; margin-bottom: 2px;">${event.date}</div>` : ''}
                    <div style="color: ${dotColor}; font-weight: bold; font-size: 15px;">${event.time}</div>
                    <div style="width: 2px; flex: 1; background: var(--border-subtle); margin-top: 10px;"></div>
                </div>
                <div style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 15px; border-radius: 4px; border-left: 3px solid ${dotColor}; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <span style="color: var(--text-primary); font-weight: bold; font-size: 14px;">${event.title}</span>
                        <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; border: 1px solid var(--border-subtle); padding: 2px 4px; border-radius: 2px;">${event.category}</span>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 13px; line-height: 1.5;">${event.text}</div>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-subtle); font-size: 10px; color: var(--text-muted);">SOURCE: ${event.source}</div>
                </div>
            `;
            feedEl.appendChild(item);
        });
    }
    _bindAppEvents() {
        const startInput = this.element.querySelector(`#timeline-start-${this.id}`);
        const endInput = this.element.querySelector(`#timeline-end-${this.id}`);
        const dateStartInput = this.element.querySelector(`#timeline-date-start-${this.id}`);
        const dateEndInput = this.element.querySelector(`#timeline-date-end-${this.id}`);
        const applyBtn = this.element.querySelector(`#timeline-apply-${this.id}`);
        const filterBtns = this.element.querySelectorAll('.timeline-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (typeof AudioController !== 'undefined' && AudioController.hover) AudioController.hover();
                this.filterCategory = e.target.getAttribute('data-type');
                this._renderTimeline();
            });
        });
        if (applyBtn && startInput && endInput) {
            applyBtn.addEventListener('click', () => {
                if (typeof AudioController !== 'undefined' && AudioController.click) AudioController.click();
                applyBtn.style.background = 'var(--accent-blue)';
                applyBtn.style.color = '#000';
                setTimeout(() => {
                    applyBtn.style.background = 'rgba(0, 195, 255, 0.1)';
                    applyBtn.style.color = 'var(--accent-blue)';
                }, 150);
                this.filterStart = startInput.value || '00:00';
                this.filterEnd = endInput.value || '23:59';
                if (this.hasDates && dateStartInput && dateEndInput) {
                    this.filterDateStart = dateStartInput.value || this.filterDateStart;
                    this.filterDateEnd = dateEndInput.value || this.filterDateEnd;
                }
                this._renderTimeline();
            });
        }
    }
}
