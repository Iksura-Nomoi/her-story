# HER STORY

**An investigation game played entirely inside a simulated desktop OS.**

Authenticate as an operator. Boot your machine. Work real case files, terminal tools, surveillance feeds, forensic suites, and evidence archives — and close ten interconnected cases from inside your own desktop environment.

---

## What is HER STORY?

HER STORY isn't a game with a UI bolted on top — the desktop *is* the game. You log in, your OS boots, and every case is investigated the same way you'd investigate anything on a real machine: opening apps, reading files, cross-referencing evidence, running terminal commands, analyzing forensics, and building a case for submission.

There's no separate "game view." Case Files, Forensics, the Network Observer, CCTV playback, GPS tracking, a system terminal, analyst notes, an evidence locker — they're all real, interactive windows on a simulated desktop OS, built to make the fiction feel authentic.

## Key Game Features

- **Simulated Desktop Environment** — Draggable, resizable windows, taskbar application management, desktop shortcuts, context menus, customizable wallpapers, and persistent window geometry.
- **17 In-Universe Applications** — Includes an OSINT Suspects Database, Forensics Lab (AFIS biometrics, hash comparison, spectrogram analysis, signal reconstruction), System Terminal, Network Topology Observer, CCTV Viewer, GPS Tracker, and Intercepted Messages.
- **10 Interconnected Cases** — A 10-case investigative campaign where every case builds upon the narrative, characters, and organizations uncovered in previous cases.
- **Comprehensive Case Submission** — Build your indictment by selecting suspects and supporting evidence to close cases.
- **Post-Game Campaign Archive** — Replay completed cases or review past records without affecting active progress.
- **Local Progress & Data Management** — Automatic progress saving via `localStorage` with built-in Save Export and Import capabilities in OS Settings.

## Story & Campaign Architecture

*(No spoilers)*

You operate an investigation workstation within HER STORY. Each case begins with an incident briefing, presenting initial leads and evidence. As an operator, you must work the evidence — cross-referencing documents, media, communications, and forensic artifacts — until you can establish culpability and submit a final report. 

As you progress through the ten cases, isolated events coalesce into a larger, multi-national web involving corporate entities, private security contractors, and covert infrastructure.

## Applications Suite

| App | Purpose & Features |
|---|---|
| **Case Files** | Primary case document reader and evidence discovery interface |
| **Forensics Lab** | AFIS fingerprint matching, payload hash comparison, spectrogram audio analysis, and signal reconstruction |
| **System Terminal** | Command-line interface for running network queries, tracing references, and decrypting files |
| **Network Observer** | Topology map inspecting node traffic, compromised accounts, and malicious entities |
| **Investigation Map** | Interactive GPS map for tracking location leads and persons of interest |
| **CCTV Viewer** | Multi-camera surveillance video feed playback |
| **Media Viewer** | Evidence image inspection with pan, zoom, brightness/contrast controls, and EXIF metadata analysis |
| **Messages** | Intercepted communication threads and handler updates |
| **Suspects** | Suspect dossiers, background profiles, and OSINT search |
| **Timeline Analysis** | Chronological reconstruction of campaign events, filterable by date and source |
| **Evidence Locker** | Searchable evidence vault, filterable by document, media, intercept, or physical trace |
| **Analyst Notes** | Autosaved operator scratchpad for recording theories and leads |
| **Submit Report** | Final case submission interface — target a suspect and attach supporting evidence |
| **Case Archive** | Campaign archive allowing post-game replay of any completed case |
| **Archive** | Searchable repository of solved case files and historical commentary |
| **OS Settings** | Display preferences, scanline overlays, desktop grid snapping, and Save Data Export/Import |
| **Guide & Reference** | In-app investigation guide and operational cheatsheet |

## Controls & Keyboard Shortcuts

- **Escape** — Close the currently active window (when not typing in a text field)
- **Enter / Space** — Launch a selected desktop icon
- **Arrow Keys** — Navigate focus between desktop icons
- **Double-Click Title Bar** — Maximize or restore window dimensions

## Technical Stack & Architecture

- **Vanilla JavaScript (ES Modules)** with Vite for development and production bundling.
- **Modular Component Architecture** — Every application extends `BaseApp`, owning shared window chrome (drag, resize, minimize, maximize, geometry persistence).
- **Template & Style Service** — HTML templates and CSS styles loaded and cached synchronously at runtime via `TemplateLoader`.
- **Event-Driven Bus** — Centralized `EventBus` and `StateManager` decouple application modules.

## Folder Structure

```
her-story/
├── index.html            Landing page, boot sequence, and OS shell markup
├── 404.html              Custom 404 fallback page
├── developer-notes.html  Developer notes and design history
├── privacy.html          Privacy policy and data retention disclosures
├── src/                  Application source code
│   ├── main.js           OS bootstrap and desktop initialization
│   ├── core/             Core managers (state, save, windowing, audio, desktop, boot)
│   ├── apps/             17 application classes extending BaseApp
│   ├── landing/          Pre-boot landing effects
│   └── services/         Shared runtime infrastructure (TemplateLoader)
├── templates/            HTML view templates per application
├── styles/               Modular CSS stylesheets (globals, layout, components, apps)
├── data/cases/           JSON case data (evidence, suspects, story beats)
└── assets/               Icons, wallpapers, case imagery, and media
```

## Quick Start

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build
```

## Privacy & Data Retention

HER STORY runs entirely client-side. Progress is stored locally in your browser via `localStorage`. Optional Firebase Analytics tracks progression events (cases loaded and solved) without collecting personal data. See [privacy.html](privacy.html) for details.

## Contributing

HER STORY is open to contributions — bug reports, feature ideas, new cases, and code improvements alike. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, coding standards, and PR process, and open an issue using the provided templates before taking on significant work. All participation is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Credits

- Created by **Mihsan Alam**

## 📜 License & Intellectual Property

The **source code** and underlying engine of HER STORY are licensed under the [MIT License](LICENSE). You are free to use, modify, and learn from the code structure.

However, all **game assets, storylines, case files, character profiles, dialogue, documents, and artwork** are proprietary and remain the exclusive intellectual property of Mihsan Alam. You may not reuse, redistribute, or monetize the story, creative writing, or universe of HER STORY without explicit written permission.
