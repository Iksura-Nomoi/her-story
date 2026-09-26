import { stateManager } from './StateManager.js';
import { AudioController } from './AudioController.js';
import { FirebaseSync } from './FirebaseSync.js';

const CREDITS_AUTO_ADVANCE_MS = 13000;

export class EndingSequence {
    constructor() {
        this.rootEl = document.getElementById('campaign-ending');
        this.epilogueEl = document.getElementById('ending-epilogue');
        this.reviewEl = document.getElementById('ending-review');
        this.creditsEl = document.getElementById('ending-credits');
        this.selectedStars = 0;
        this._creditsTimer = null;
    }

        start({ epilogueText, onComplete } = {}) {
        this.onComplete = onComplete;

        this.epilogueText = epilogueText || 'Operation complete. Thank you, Operator.';
        this.rootEl.classList.remove('hidden');
        this.rootEl.classList.add('fade-in');
        this._showEpilogue(this.epilogueText);
    }

    _showEpilogue(text) {
        this._showOnly(this.epilogueEl);

        const linesEl = document.getElementById('epilogue-lines');
        const continueBtn = document.getElementById('btn-epilogue-continue');
        linesEl.innerHTML = '';
        continueBtn.classList.add('hidden');
        continueBtn.classList.remove('is-visible');

        const paragraphs = String(text).split(/\n\s*\n/).filter(Boolean);
        paragraphs.forEach((p, i) => {
            const line = document.createElement('p');
            line.textContent = p.trim();
            line.style.animationDelay = `${0.3 + i * 0.9}s`;
            linesEl.appendChild(line);
        });

        const revealDelay = 600 + paragraphs.length * 900;
        setTimeout(() => {
            continueBtn.classList.remove('hidden');
            continueBtn.classList.add('is-visible');
        }, revealDelay);

        continueBtn.onclick = () => {
            if (AudioController.click) AudioController.click();
            this._showReview();
        };
    }

    _showReview() {
        this._showOnly(this.reviewEl);
        this.selectedStars = 0;

        const starsEl = document.getElementById('ending-stars');
        const buttons = Array.from(starsEl.querySelectorAll('.star-btn'));
        const textEl = document.getElementById('ending-review-text');
        const feedbackEl = document.getElementById('ending-review-feedback');
        textEl.value = '';
        feedbackEl.value = '';

        const paint = (value) => {
            buttons.forEach(btn => {
                btn.classList.toggle('is-active', Number(btn.dataset.value) <= value);
            });
        };
        paint(0);

        buttons.forEach(btn => {
            btn.onclick = () => {
                this.selectedStars = Number(btn.dataset.value);
                if (AudioController.click) AudioController.click();
                paint(this.selectedStars);
            };
            btn.onmouseenter = () => paint(Number(btn.dataset.value));
            btn.onmouseleave = () => paint(this.selectedStars);
        });

        starsEl.onkeydown = (e) => {
            const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
            if (!dir) return;
            e.preventDefault();
            const next = Math.min(5, Math.max(1, (this.selectedStars || 0) + dir));
            this.selectedStars = next;
            if (AudioController.click) AudioController.click();
            paint(next);
            buttons[next - 1].focus();
        };

        const finishReview = () => {
            const review = {
                operatorName: stateManager.get('operator_name') || null,
                stars: this.selectedStars,
                review: textEl.value.trim(),
                feedback: feedbackEl.value.trim(),
                timestamp: new Date().toISOString()
            };
            stateManager.set('campaign_review', review);

            FirebaseSync.push('reviews', review);
            this._showCredits();
        };

        document.getElementById('btn-review-skip').onclick = () => {
            if (AudioController.click) AudioController.click();
            finishReview();
        };

        document.getElementById('btn-review-submit').onclick = () => {
            if (AudioController.click) AudioController.click();
            finishReview();
        };

        document.getElementById('btn-review-skip').onclick = () => {
            if (AudioController.click) AudioController.click();
            this.selectedStars = 0;
            textEl.value = '';
            feedbackEl.value = '';
            finishReview();
        };
    }

    _showCredits() {
        this._showOnly(this.creditsEl);

        clearTimeout(this._creditsTimer);
        this._creditsTimer = setTimeout(() => this._finish(), CREDITS_AUTO_ADVANCE_MS);
    }

    _finish() {
        this.rootEl.classList.add('fade-out');
        setTimeout(() => {
            this.rootEl.classList.add('hidden');
            this.rootEl.classList.remove('fade-out', 'fade-in');
            this._showOnly(null);
            if (this.onComplete) this.onComplete();
        }, 800);
    }

    _showOnly(targetEl) {
        [this.epilogueEl, this.reviewEl, this.creditsEl].forEach(el => {
            const isTarget = el === targetEl;
            el.classList.toggle('hidden', !isTarget);
            el.classList.toggle('fade-in', isTarget);
        });
    }
}
