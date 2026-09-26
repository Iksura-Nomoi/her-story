import { FaultyTerminal } from '../landing/FaultyTerminal.js';

export class LandingPageManager {
        constructor({ root, bgHost, playBtn, quitBtn, continueBtn, continueCaptionEl, onPlay, onContinue }) {
        this.root = root;
        this.playBtn = playBtn;
        this.quitBtn = quitBtn;
        this.continueBtn = continueBtn;
        this.continueCaptionEl = continueCaptionEl;
        this.onPlay = onPlay;
        this.onContinue = onContinue;
        this._resumable = false;
        this._mounted = false;

        this.background = new FaultyTerminal(bgHost, {
            scale: 1.5,
            gridMul: [2, 1],
            digitSize: 1.2,
            timeScale: 1,
            scanlineIntensity: 1,
            glitchAmount: 1,
            flickerAmount: 1,
            noiseAmp: 1,
            chromaticAberration: 0,
            dither: 0,
            curvature: 0,
            tint: '#A7EF9E',
            mouseReact: true,
            mouseStrength: 0.35,
            pageLoadAnimation: true,
            brightness: 0.65,
        });

        this._handlePlay = this._handlePlay.bind(this);
        this._handleContinue = this._handleContinue.bind(this);
        this._handleQuit = this._handleQuit.bind(this);
        this.playBtn.addEventListener('click', this._handlePlay);
        if (this.quitBtn) this.quitBtn.addEventListener('click', this._handleQuit);
        if (this.continueBtn) this.continueBtn.addEventListener('click', this._handleContinue);
        this._bindArrowNav();
    }

        _bindArrowNav() {
        const container = this.root.querySelector('.landing-buttons');
        if (!container) return;
        container.addEventListener('keydown', (e) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            const focusable = Array.from(container.querySelectorAll('button')).filter(
                b => !b.classList.contains('hidden') && !b.disabled
            );
            if (focusable.length === 0) return;
            e.preventDefault();
            const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
            const idx = focusable.indexOf(document.activeElement);
            const next = idx === -1 ? 0 : (idx + dir + focusable.length) % focusable.length;
            focusable[next].focus();
        });
    }

        setResumable(hasSave, operatorName) {
        this._resumable = hasSave;
        if (this.continueBtn) this.continueBtn.classList.toggle('hidden', !hasSave);
        if (this.continueCaptionEl) {
            this.continueCaptionEl.classList.toggle('hidden', !hasSave);
            this.continueCaptionEl.textContent = hasSave && operatorName ? `Resume as ${operatorName}` : '';
        }
        this.playBtn.textContent = hasSave ? 'NEW GAME' : 'PLAY';
        this.playBtn.setAttribute('aria-label', hasSave ? 'New Game' : 'Play');
        this.playBtn.classList.toggle('landing-btn-secondary', hasSave);
    }

        mount() {
        if (this._mounted) return;
        this._mounted = true;
        this.background.start();
    }

        showAgain() {
        this.root.classList.remove('hidden', 'fade-out');
        this.root.classList.add('fade-in');
        this.playBtn.disabled = false;
        if (this.continueBtn) this.continueBtn.disabled = false;
        if (!this._mounted) this.mount();
    }

        async _fadeOutAndRequestFullscreen() {
        this.root.classList.remove('fade-in');
        this.root.classList.add('fade-out');

        try {
            const target = document.documentElement;
            if (target.requestFullscreen) {
                await Promise.race([
                    target.requestFullscreen(),
                    new Promise((resolve) => setTimeout(resolve, 600)),
                ]);
            }
        } catch (err) {

            console.warn('[HER STORY] Fullscreen request was blocked; continuing windowed.', err);
        }
    }

    async _handlePlay() {
        if (this.playBtn.disabled) return;

        if (this._resumable) {
            const ok = window.confirm('Start a new investigation? Your current progress will be permanently overwritten.');
            if (!ok) return;
        }
        this.playBtn.disabled = true;
        if (this.continueBtn) this.continueBtn.disabled = true;
        await this._fadeOutAndRequestFullscreen();
        setTimeout(() => {
            this.root.classList.add('hidden');
            this.root.classList.remove('fade-out');
            if (this.onPlay) this.onPlay({ isNewGame: this._resumable });
        }, 700);
    }

    async _handleContinue() {
        if (!this.continueBtn || this.continueBtn.disabled) return;
        this.continueBtn.disabled = true;
        this.playBtn.disabled = true;
        await this._fadeOutAndRequestFullscreen();
        setTimeout(() => {
            this.root.classList.add('hidden');
            this.root.classList.remove('fade-out');
            if (this.onContinue) this.onContinue();
        }, 700);
    }

    _handleQuit() {
        window.close();

        setTimeout(() => {
            if (this.root.querySelector('.landing-quit-note')) return;
            const buttons = this.root.querySelector('.landing-buttons');
            const note = document.createElement('p');
            note.className = 'landing-quit-note';
            note.textContent = 'You can close this tab now.';
            (buttons || this.root).appendChild(note);
            this.quitBtn.disabled = true;
        }, 150);
    }
}

export default LandingPageManager;
