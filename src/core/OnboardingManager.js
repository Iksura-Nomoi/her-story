import { stateManager } from './StateManager.js';
import { AudioController } from './AudioController.js';
import { FirebaseSync } from './FirebaseSync.js';

const BRIEFING_PAGES = [
    {
        title: 'Welcome, Operator',
        body: `
            <p>You have been granted access to <strong>HER STORY</strong>, a
            classified digital investigation environment used to process,
            cross-reference, and resolve field cases from inside a single
            secured workstation.</p>
            <p>Every tool you need lives on this desktop. Nothing here is
            decorative — every application is part of an active
            investigation pipeline.</p>
        `
    },
    {
        title: 'Investigations & Evidence',
        body: `
            <p>Each assignment is a self-contained <strong>case file</strong>:
            messages, media, testimony, and physical evidence, all loaded
            into your workspace when the case begins.</p>
            <ul>
                <li>Review material inside each application at your own pace.</li>
                <li>Bookmark anything relevant directly into the <strong>Locker</strong>
                    for quick reference later.</li>
                <li>Evidence and leads compound — details from early in a
                    case often matter later.</li>
            </ul>
        `
    },
    {
        title: 'Your Applications',
        body: `
            <p>Every case opens with the same starting toolkit:</p>
            <ul>
                <li><strong>Case Files</strong> — the official record for
                    the assignment, and where most evidence is read.</li>
                <li><strong>Messages</strong> — message threads between
                    people connected to the case.</li>
                <li><strong>Media Viewer</strong> — photos and other media
                    pulled from the case.</li>
                <li><strong>Locker</strong> — evidence you've bookmarked,
                    logged automatically as you find it.</li>
                <li><strong>Terminal</strong> — a real shell; run
                    diagnostic and decryption commands. Type
                    <strong>help</strong> inside it any time.</li>
            </ul>
            <p>Suspects, CCTV, Timeline, Investigation Map, Forensics,
            Network Observer, Notes, and Archive unlock automatically as
            you make progress — a new icon appears on the desktop with a
            notification the moment each one becomes available.</p>
        `
    },
    {
        title: 'Submitting a Case',
        body: `
            <p>When you believe you've identified the responsible party and
            the evidence that proves it, open <strong>Submit Report</strong>
            and file your conclusion.</p>
            <p>A correct submission closes the case, unlocks any tools it
            grants, and clears you for the next assignment. An incorrect
            submission simply lets you keep investigating — there is no
            penalty for a wrong guess.</p>
        `
    },
    {
        title: 'If You Get Stuck',
        body: `
            <p>Every case can be solved with what's already in your
            workspace. If you're stuck, open the <strong>Help System</strong>
            from the system corner — it offers tiered hints, from a gentle
            nudge to a direct pointer, without spoiling the full solution
            unless you ask for it.</p>
            <p>You're clear to begin. Good hunting, Operator.</p>
        `
    }
];

export class OnboardingManager {
    constructor() {
        this.registrationEl = document.getElementById('operator-registration');
        this.briefingEl = document.getElementById('mission-briefing');
        this.nameInput = document.getElementById('operator-name-input');
        this.nameError = document.getElementById('operator-name-error');
        this.continueBtn = document.getElementById('btn-operator-continue');

        this.pageTitleEl = document.getElementById('briefing-page-title');
        this.pageBodyEl = document.getElementById('briefing-page-body');
        this.dotsEl = document.getElementById('briefing-dots');
        this.prevBtn = document.getElementById('btn-briefing-prev');
        this.nextBtn = document.getElementById('btn-briefing-next');
        this.skipBtn = document.getElementById('btn-briefing-skip');

        this._pageIndex = 0;
    }

        showRegistration(onDone) {
        this.registrationEl.classList.remove('hidden');
        this.registrationEl.classList.add('fade-in');

        this.nameInput.value = stateManager.get('operator_name') || '';
        this.nameError.classList.add('hidden');
        this.nameInput.focus();

        const submit = () => {
            const name = this.nameInput.value.trim();
            if (!name) {
                this.nameError.classList.remove('hidden');
                this.nameInput.focus();
                return;
            }
            if (AudioController.click) AudioController.click();
            stateManager.set('operator_name', name);

            FirebaseSync.push('operators', { name, registeredAt: new Date().toISOString() });
            this._hide(this.registrationEl, onDone);
        };

        this.continueBtn.onclick = submit;
        this.nameInput.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    }

        showBriefing(onDone) {
        this.briefingEl.classList.remove('hidden');
        this.briefingEl.classList.add('fade-in');
        this._pageIndex = 0;
        this._renderPage();

        this.prevBtn.onclick = () => {
            if (this._pageIndex === 0) return;
            if (AudioController.click) AudioController.click();
            this._pageIndex -= 1;
            this._renderPage();
        };
        this.nextBtn.onclick = () => {
            if (AudioController.click) AudioController.click();
            if (this._pageIndex >= BRIEFING_PAGES.length - 1) {
                this._hide(this.briefingEl, onDone);
                return;
            }
            this._pageIndex += 1;
            this._renderPage();
        };
        this.skipBtn.onclick = () => {
            if (AudioController.click) AudioController.click();
            this._hide(this.briefingEl, onDone);
        };
    }

    _renderPage() {
        const page = BRIEFING_PAGES[this._pageIndex];
        this.pageTitleEl.textContent = page.title;
        this.pageBodyEl.innerHTML = page.body;

        this.prevBtn.disabled = this._pageIndex === 0;
        if (this._pageIndex === 0) {
            this.prevBtn.classList.add('onboarding-secondary');
        } else {
            this.prevBtn.classList.remove('onboarding-secondary');
        }

        this.nextBtn.textContent = this._pageIndex === BRIEFING_PAGES.length - 1
            ? 'Begin Investigation' : 'Next';

        this.dotsEl.innerHTML = BRIEFING_PAGES
            .map((_, i) => `<span class="dot${i === this._pageIndex ? ' is-active' : ''}"></span>`)
            .join('');
    }

    _hide(el, onDone) {
        el.classList.add('fade-out');
        setTimeout(() => {
            el.classList.add('hidden');
            el.classList.remove('fade-out', 'fade-in');
            if (onDone) onDone();
        }, 700);
    }
}
