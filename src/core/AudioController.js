import { stateManager } from './StateManager.js';

export class AudioController {
    static ctx = null;
    static ambientOsc = null;
    static ambientGain = null;

    static init() {
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {}
        }
    }

    static ensureUnlockOnGesture() {
        if (this._unlockAttached) return;
        this._unlockAttached = true;
        this.init();
        const unlock = () => {
            this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
        };
        document.addEventListener('pointerdown', unlock, { once: true, capture: true });
        document.addEventListener('keydown', unlock, { once: true, capture: true });
        document.addEventListener('touchstart', unlock, { once: true, capture: true });
    }

    static _isSoundEnabled() {
        const settings = stateManager.get('os_settings');
        if (settings && settings.soundEnabled === false) {
            return false;
        }
        return true;
    }

    static _getVolumeMult() {
        const settings = stateManager.get('os_settings');
        const vol = settings && typeof settings.soundVolume === 'number' ? settings.soundVolume : 0.8;
        return Math.max(0, Math.min(1, vol));
    }

    static _playTone(freq, type, duration, volume) {
        if (!this._isSoundEnabled()) return;
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

        const scaledVol = volume * this._getVolumeMult();
        if (scaledVol <= 0) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(scaledVol, this.ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    static click() { 
        this._playTone(400, 'sine', 0.05, 0.2); 
    }
    static hover() { 
        this._playTone(800, 'sine', 0.02, 0.06); 
    }
    static error() { 
        this._playTone(150, 'sawtooth', 0.3, 0.15); 
    }
    static success() {
        this._playTone(600, 'sine', 0.1, 0.15); 
        setTimeout(() => this._playTone(900, 'sine', 0.2, 0.15), 100); 
    }
    static windowOpen() {
        this._playTone(340, 'sine', 0.07, 0.16);
        setTimeout(() => this._playTone(520, 'sine', 0.08, 0.12), 40);
    }
    static windowClose() {
        this._playTone(420, 'sine', 0.06, 0.12);
        setTimeout(() => this._playTone(260, 'sine', 0.08, 0.1), 30);
    }
    static windowMinimize() {
        this._playTone(320, 'sine', 0.05, 0.12);
        setTimeout(() => this._playTone(200, 'sine', 0.06, 0.1), 30);
    }
    static windowRestore() {
        this._playTone(220, 'sine', 0.05, 0.12);
        setTimeout(() => this._playTone(380, 'sine', 0.06, 0.14), 30);
    }
    static launch() {
        this._playTone(500, 'triangle', 0.05, 0.14);
        setTimeout(() => this._playTone(700, 'triangle', 0.08, 0.12), 60);
    }
    static bookmark() {
        this._playTone(700, 'sine', 0.05, 0.14);
        setTimeout(() => this._playTone(1000, 'sine', 0.06, 0.12), 50);
    }
    static caseComplete() {
        [523, 659, 784, 1046].forEach((freq, i) => {
            setTimeout(() => this._playTone(freq, 'sine', 0.22, 0.14), i * 90);
        });
    }
    static notify() {
        this._playTone(880, 'sine', 0.04, 0.08);
    }
    static bootHum() {
        this._playTone(90, 'sine', 0.6, 0.05);
        setTimeout(() => this._playTone(140, 'sine', 0.4, 0.03), 80);
    }
    static bootKey() {
        this._playTone(1200 + Math.random() * 400, 'square', 0.012, 0.02);
    }
    static keyPress() {
        this._playTone(800 + Math.random() * 300, 'sine', 0.015, 0.015);
    }
    static bootReady() {
        this._playTone(660, 'sine', 0.12, 0.1);
        setTimeout(() => this._playTone(990, 'sine', 0.18, 0.1), 90);
    }

    static toggleAmbient(enable) {
        if (!enable || !this._isSoundEnabled()) {
            if (this.ambientOsc) {
                try { this.ambientOsc.stop(); } catch(e) {}
                this.ambientOsc = null;
                this.ambientGain = null;
            }
            return;
        }
        if (this.ambientOsc) return;
        this.init();
        if (!this.ctx) return;

        try {
            this.ambientOsc = this.ctx.createOscillator();
            this.ambientGain = this.ctx.createGain();
            this.ambientOsc.type = 'sine';
            this.ambientOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low 55Hz workstation hum
            this.ambientGain.gain.setValueAtTime(0.008 * this._getVolumeMult(), this.ctx.currentTime);
            this.ambientOsc.connect(this.ambientGain);
            this.ambientGain.connect(this.ctx.destination);
            this.ambientOsc.start();
        } catch (e) {}
    }
}
