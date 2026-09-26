import { BaseApp } from '../BaseApp.js';
import { stateManager } from '../../core/StateManager.js';
import { eventBus } from '../../core/EventBus.js';
import { AudioController } from '../../core/AudioController.js';
import { WALLPAPERS } from '../../core/DesktopManager.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';
import { ACHIEVEMENTS, AchievementManager } from '../../core/AchievementManager.js';

const SETTINGS_SHELL_TEMPLATE_PATH = 'src/apps/Settings/SettingsApp.html';

export class SettingsApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        this.settings = stateManager.get('os_settings') || {
            soundEnabled: true, soundVolume: 0.8, ambientHum: false, keypressClick: true,
            crtMode: false, crtOpacity: 0.6, crtCurvature: false,
            theme: 'default', fontScale: 100, animations: true, autosave: true
        };
        this.activeTab = 'preferences';
        this._applySettingsToOS();

        this._tabRequestHandler = (tab) => {
            // 'wallpaper' and the retired 'data' tab both now live under Appearance.
            this.activeTab = (tab === 'wallpaper' || tab === 'data') ? 'appearance' : tab;
            if (this.isOpen) this._renderBody();
        };
        eventBus.on('OPEN_SETTINGS_TAB', this._tabRequestHandler);
    }

    render() {
        if (this.element) return this.element;
        super.render();

        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex');
            const template = TemplateLoader.getSync(SETTINGS_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template;
            this.element.querySelectorAll('.settings-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.activeTab = btn.dataset.tab;
                    this._renderBody();
                });
            });
            this._renderBody();
        }
        return this.element;
    }

    _renderBody() {
        const body = this.element.querySelector('.settings-scroll');
        if (!body) return;
        this.element.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === this.activeTab));
        if (this.activeTab === 'appearance') body.innerHTML = this._appearanceHtml();
        else if (this.activeTab === 'badges') body.innerHTML = this._badgesHtml();
        else body.innerHTML = this._preferencesHtml();
        this._bindAppEvents();
    }

    _row(title, desc, inputHtml) {
        return `<div class="settings-row">
            <div>
                <div class="settings-row-title">${title}</div>
                <div class="settings-row-desc">${desc}</div>
            </div>
            ${inputHtml}
        </div>`;
    }

    _dataManagementHtml() {
        return `
            ${this._row('EXPORT SAVE DATA', 'Download a backup of your current campaign progress.',
                '<button id="btn-export-save" class="sys-button">Export .json</button>')}
            ${this._row('IMPORT SAVE DATA', 'Restore your campaign progress from a backup file. This will restart the OS.',
                '<div><input type="file" id="import-save-file" accept=".json" style="display:none;"><button id="btn-import-save" class="sys-button">Import .json</button></div>')}
        `;
    }

    _preferencesHtml() {
        const volPercent = Math.round((this.settings.soundVolume ?? 0.8) * 100);
        return `
            ${this._row('AUDIO SYNTHESIS', 'Enable or mute interface click and alert audio cues.',
                `<input type="checkbox" id="set-sound-${this.id}" ${this.settings.soundEnabled ? 'checked' : ''} class="settings-check">`)}
            ${this._row('SYNTHESIS VOLUME', 'Adjust master audio volume for all OS sound effects.',
                `<input type="range" id="set-vol-${this.id}" min="0" max="100" value="${volPercent}" style="width: 100px;">`)}
            ${this._row('AMBIENT WORKSTATION HUM', 'Procedural low-frequency 55Hz workstation audio hum.',
                `<input type="checkbox" id="set-ambient-${this.id}" ${this.settings.ambientHum ? 'checked' : ''} class="settings-check">`)}
            ${this._row('KEYBOARD CLICK AUDIO', 'Tactile audio clicks when typing in Terminal or Notes.',
                `<input type="checkbox" id="set-keyclick-${this.id}" ${this.settings.keypressClick !== false ? 'checked' : ''} class="settings-check">`)}
            ${this._row('CRT SCANLINE OVERLAY', 'Apply hardware-accurate scanline visual filter to the desktop.',
                `<input type="checkbox" id="set-crt-${this.id}" ${this.settings.crtMode ? 'checked' : ''} class="settings-check">`)}
            ${this._row('CRT SCREEN CURVATURE', 'Simulate vintage phosphor CRT monitor glass distortion.',
                `<input type="checkbox" id="set-curvature-${this.id}" ${this.settings.crtCurvature ? 'checked' : ''} class="settings-check">`)}
            ${this._row('WINDOW ANIMATIONS', 'Enable window transition fades and glowing environmental highlights.',
                `<input type="checkbox" id="set-anim-${this.id}" ${this.settings.animations ? 'checked' : ''} class="settings-check">`)}
        `;
    }

    _appearanceHtml() {
        const currentWallpaper = stateManager.get('wallpaper') || 'blueprint';
        const gridOn = stateManager.get('desktop_grid') !== false;
        const currentTheme = this.settings.theme || 'default';
        const currentFontScale = this.settings.fontScale || 100;

        const swatches = WALLPAPERS.map(w => `
            <button class="wallpaper-swatch ${w.id === currentWallpaper ? 'is-active' : ''}" data-wallpaper="${w.id}" title="${w.name}" style="background-image: url('assets/wallpapers/${w.file}');">
                <span>${w.name}</span>
            </button>
        `).join('');

        return `
            <div class="settings-row-title" style="margin-bottom: 4px;">WALLPAPER</div>
            <div class="wallpaper-grid" id="wallpaper-grid-${this.id}">${swatches}</div>
            ${this._row('DESKTOP GRID', 'Toggle icon grid-snapping on the desktop.',
                `<input type="checkbox" id="set-grid-${this.id}" ${gridOn ? 'checked' : ''} class="settings-check">`)}
            ${this._row('OS COLOR PALETTE', 'Select visual theme for OS window chrome and terminal accents.',
                `<select id="set-theme-${this.id}" class="sys-button" style="padding: 4px 8px;">
                    <option value="default" ${currentTheme === 'default' ? 'selected' : ''}>Default Dark Blue</option>
                    <option value="amber-crt" ${currentTheme === 'amber-crt' ? 'selected' : ''}>Amber CRT Phosphor</option>
                    <option value="matrix-green" ${currentTheme === 'matrix-green' ? 'selected' : ''}>Matrix Green Phosphor</option>
                    <option value="cyberpunk" ${currentTheme === 'cyberpunk' ? 'selected' : ''}>Cyberpunk Neon</option>
                    <option value="slate" ${currentTheme === 'slate' ? 'selected' : ''}>Slate Minimal</option>
                </select>`)}
            ${this._row('INTERFACE FONT SCALE', 'Scale font size across Case Files, Notes, and OS text.',
                `<select id="set-fontscale-${this.id}" class="sys-button" style="padding: 4px 8px;">
                    <option value="100" ${currentFontScale == 100 ? 'selected' : ''}>100% (Standard)</option>
                    <option value="115" ${currentFontScale == 115 ? 'selected' : ''}>115% (Medium)</option>
                    <option value="130" ${currentFontScale == 130 ? 'selected' : ''}>130% (Large)</option>
                </select>`)}
            <div class="settings-row-title" style="margin-top: 15px; margin-bottom: 4px;">DATA MANAGEMENT</div>
            ${this._dataManagementHtml()}
        `;
    }

    _badgesHtml() {
        const unlocked = AchievementManager.getUnlocked();
        const badgeCards = ACHIEVEMENTS.map(b => {
            const isUnlocked = unlocked.includes(b.id);
            return `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid ${isUnlocked ? 'var(--accent-blue)' : 'var(--border-subtle)'}; padding: 12px; border-radius: 4px; display: flex; align-items: center; gap: 12px; opacity: ${isUnlocked ? '1' : '0.45'};">
                    <div style="font-size: 24px;">${b.icon}</div>
                    <div>
                        <div style="font-weight: bold; color: ${isUnlocked ? 'var(--accent-blue)' : 'var(--text-primary)'}; font-size: 13px;">${b.title} ${isUnlocked ? '✓' : '🔒'}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${b.desc}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="margin-bottom: 12px; font-weight: bold; color: var(--accent-blue); letter-spacing: 1px;">OPERATOR ACCOMPLISHMENTS (${unlocked.length} / ${ACHIEVEMENTS.length})</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${badgeCards}
            </div>
        `;
    }

    _bindAppEvents() {
        const soundChk = this.element.querySelector(`#set-sound-${this.id}`);
        const volSlider = this.element.querySelector(`#set-vol-${this.id}`);
        const ambientChk = this.element.querySelector(`#set-ambient-${this.id}`);
        const keyclickChk = this.element.querySelector(`#set-keyclick-${this.id}`);
        const crtChk = this.element.querySelector(`#set-crt-${this.id}`);
        const curvatureChk = this.element.querySelector(`#set-curvature-${this.id}`);
        const animChk = this.element.querySelector(`#set-anim-${this.id}`);
        const gridChk = this.element.querySelector(`#set-grid-${this.id}`);
        const themeSel = this.element.querySelector(`#set-theme-${this.id}`);
        const fontscaleSel = this.element.querySelector(`#set-fontscale-${this.id}`);
        const btnExport = this.element.querySelector('#btn-export-save');
        const btnImport = this.element.querySelector('#btn-import-save');
        const fileImport = this.element.querySelector('#import-save-file');

        if (btnExport) {
            btnExport.addEventListener('click', () => {
                const data = localStorage.getItem('offset_save_data');
                if (!data) return alert('No save data found!');
                const blob = new Blob([data], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'her-story-save.json';
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        if (btnImport && fileImport) {
            btnImport.addEventListener('click', () => fileImport.click());
            fileImport.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const parsed = JSON.parse(e.target.result);
                        if (!parsed || typeof parsed !== 'object') throw new Error();
                        localStorage.setItem('offset_save_data', e.target.result);
                        alert('Save data restored successfully. The OS will now reboot.');
                        location.reload();
                    } catch (err) {
                        alert('Invalid save file format.');
                        fileImport.value = '';
                    }
                };
                reader.readAsText(file);
            });
        }

        if (soundChk) soundChk.addEventListener('change', (e) => { this.settings.soundEnabled = e.target.checked; this._saveAndApply(); });
        if (volSlider) volSlider.addEventListener('input', (e) => { this.settings.soundVolume = parseFloat(e.target.value) / 100; this._saveAndApply(); });
        if (ambientChk) ambientChk.addEventListener('change', (e) => { this.settings.ambientHum = e.target.checked; this._saveAndApply(); });
        if (keyclickChk) keyclickChk.addEventListener('change', (e) => { this.settings.keypressClick = e.target.checked; this._saveAndApply(); });
        if (crtChk) crtChk.addEventListener('change', (e) => { this.settings.crtMode = e.target.checked; this._saveAndApply(); });
        if (curvatureChk) curvatureChk.addEventListener('change', (e) => { this.settings.crtCurvature = e.target.checked; this._saveAndApply(); });
        if (animChk) animChk.addEventListener('change', (e) => { this.settings.animations = e.target.checked; this._saveAndApply(); });
        if (themeSel) themeSel.addEventListener('change', (e) => { this.settings.theme = e.target.value; this._saveAndApply(); });
        if (fontscaleSel) fontscaleSel.addEventListener('change', (e) => { this.settings.fontScale = parseInt(e.target.value, 10); this._saveAndApply(); });

        if (gridChk) {
            gridChk.addEventListener('change', (e) => {
                eventBus.emit('DESKTOP_GRID_TOGGLE', e.target.checked);
                stateManager.set('desktop_grid', e.target.checked);
            });
        }

        this.element.querySelectorAll('.wallpaper-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                eventBus.emit('WALLPAPER_CHANGE', sw.dataset.wallpaper);
                stateManager.set('wallpaper', sw.dataset.wallpaper);
                this.element.querySelectorAll('.wallpaper-swatch').forEach(n => n.classList.remove('is-active'));
                sw.classList.add('is-active');
            });
        });
    }

    _saveAndApply() {
        stateManager.set('os_settings', this.settings);
        this._applySettingsToOS();
    }

    _applySettingsToOS() {
        if (this.settings.crtMode) document.body.classList.add('crt-scanlines');
        else document.body.classList.remove('crt-scanlines');

        if (this.settings.crtCurvature) document.body.classList.add('crt-curvature');
        else document.body.classList.remove('crt-curvature');

        if (this.settings.animations) document.body.classList.remove('disable-animations');
        else document.body.classList.add('disable-animations');

        if (this.settings.theme && this.settings.theme !== 'default') {
            document.documentElement.setAttribute('data-theme', this.settings.theme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        if (this.settings.fontScale && this.settings.fontScale != 100) {
            document.documentElement.setAttribute('data-font-scale', String(this.settings.fontScale));
        } else {
            document.documentElement.removeAttribute('data-font-scale');
        }

        AudioController.toggleAmbient(Boolean(this.settings.ambientHum));
    }

    _onClose() {
        eventBus.off('OPEN_SETTINGS_TAB', this._tabRequestHandler);
    }
}
