# Contributing to HER STORY

Thanks for your interest in HER STORY. This project is source-available (see [LICENSE](LICENSE)) — contributions are welcome, but please read the license before opening a pull request, since it governs how your contribution can be used.

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md); by participating, you agree to uphold it.

**Ways to help:**
- Report bugs or suggest features — use the [issue templates](https://github.com/mihsanalam/Her-Story/issues/new/choose); they ask for exactly the info needed to act on your report.
- Improve docs, translations, or accessibility.
- Fix something on the issue tracker tagged `good first issue`.
- Build something new — apps, cases, quality-of-life improvements (open an issue first so we can align on the approach).

## Before You Start

Please open an issue before starting significant work, so we can discuss the approach first. Small fixes (typos, obvious bugs) can go straight to a pull request.

## Development Setup

```bash
git clone https://github.com/mihsanalam/Her-Story.git
cd Her-Story
npm install
npm run dev
```

HER STORY uses Vite for development. Edit a file, and the browser will instantly update via native ES module HMR.

## Folder Organization

See the [README's Folder Structure section](README.md#folder-structure) for the full layout. In short:

- `src/apps/` — one file per application, extending `BaseApp`
- `src/core/` — shared managers (state, save, desktop, events, etc.)
- `templates/` — one HTML file per app's static markup
- `styles/` — split by `globals`, `layout`, `components`, `apps`
- `data/cases/` — per-case JSON content

## Coding Standards

- Plain ES modules — no framework. We use Vite for bundling production builds, but keep runtime logic simple.
- An app's static markup belongs in its `templates/apps/*.html` file, not as an inline JS template string. Small, genuinely dynamic fragments (a handful of lines, rebuilt per item) are fine to keep in JS.
- Follow the existing `BaseApp` pattern: window chrome lives in the base class, apps supply template + styling + behavior.
- Comments should explain **why**, not **what**. If the code needs a comment to explain what it does, consider making the code clearer instead.
- Match the naming conventions already in use in the file/folder you're editing (see below).

## Naming Conventions

- Classes: `PascalCase` (e.g. `ForensicsApp`, `TemplateLoader`)
- Files: match their default export's class name (e.g. `ForensicsApp.js`)
- Private/internal methods: prefixed with `_` (e.g. `_bindEvents`, `_renderList`)
- CSS classes: `kebab-case`, scoped by feature prefix (e.g. `forensics-mod-btn`, `locker-filter-btn`)
- Event names on the shared event bus: `SCREAMING_SNAKE_CASE` (e.g. `CASE_LOADED`, `FIREBASE_STATUS_CHANGED`)

## Commit Messages

Keep them short and specific: `<area>: <what changed>`, e.g. `forensics: fix hash comparison false positive`. Avoid vague messages like "fixes" or "update."

## Branch Naming

`type/short-description`, e.g. `fix/forensics-hash-bug`, `feature/new-case-011`, `docs/readme-update`.

## Pull Request Process

1. One logical change per PR — don't bundle unrelated fixes.
2. Describe what changed and why, not just what.
3. Manually click through the app(s) your change touches — window open/close, drag/resize, and any interaction you modified — before submitting.
4. Be ready for review feedback; this is a small project maintained carefully.

## Testing

This repository doesn't include an automated test suite. Verification is manual:

- If you're fixing a bug, describe in the PR how you confirmed the fix (steps to reproduce the original issue, and confirmation it no longer occurs).
- If your change touches an app's rendering or interaction, manually click through the affected app before submitting — open it, exercise every control you changed, and confirm nothing else regressed.
- New applications should be manually run through their full open → interact → close lifecycle before submitting.

## Documentation Standards

- Update the README's Applications Overview table if you add or remove an app.
- Keep code comments proportional — a two-line helper doesn't need a paragraph; a non-obvious workaround does.

## Adding a New Application

1. Create `src/apps/YourApp.js` extending `BaseApp`.
2. Create `templates/apps/your-app-shell.html` for its static markup.
3. Follow the existing `TemplateLoader` pattern used by other apps: a path constant, a synchronous fallback string kept in sync with the template file, and a `TemplateLoader.getSync(...)` call in `render()` — `render()` must stay synchronous.
4. Add app-specific styling to `styles/apps/apps.css`, or a new file under `styles/apps/` if it's substantial.
5. Register the app's launch entry in `src/main.js` and its taskbar/desktop icon per the existing pattern.
6. Preload its template path in `src/main.js`'s boot sequence.

## Adding a New Investigation Case

1. Add a new case JSON file under `data/cases/`, following the shape of an existing case.
2. Register the case ID wherever the existing case list is defined (see `ALL_CASE_IDS` in `src/core/DevTools.js` for one reference point).
3. Make sure the case is reachable from Case Files, Locker, Suspects, etc. — i.e. that its evidence actually surfaces in the apps that read `caseData`.
4. Playtest it end-to-end, including submission.

## Behaviour Preservation Rules

These should never change without explicit discussion first, since they affect existing players and save compatibility:

- The shape of saved data in `localStorage` (`SaveManager`'s `SAVE_KEY` format) — changing this without a migration path breaks existing players' progress.
- Any existing case's puzzle logic or evidence gating, once published.
- The `BaseApp` window-chrome contract (drag, resize, minimize, maximize, focus, Escape-to-close) — apps rely on this being consistent.

## Review Expectations

Reviews prioritize: does it work exactly as intended, is it readable, does it fit the existing patterns, and does it avoid introducing unnecessary abstraction or dependencies. Small, focused PRs get reviewed faster than large ones.
