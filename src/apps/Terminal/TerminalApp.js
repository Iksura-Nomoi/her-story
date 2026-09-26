import { BaseApp } from '../BaseApp.js';
import { AudioController } from '../../core/AudioController.js';
import { stateManager } from '../../core/StateManager.js';
import { dataLoader } from '../../core/DataLoader.js';
import { eventBus } from '../../core/EventBus.js';
import { TemplateLoader } from '../../services/TemplateLoader.js';

const TERMINAL_SHELL_TEMPLATE_PATH = 'src/apps/Terminal/TerminalApp.html';

const COMMAND_HELP = {
    help: { usage: 'help [command]', desc: 'List every available command, or show detailed usage for one command.', category: 'Shell' },
    ls: { usage: 'ls', desc: 'List files in the current case directory, with lock status.', category: 'Shell' },
    clear: { usage: 'clear', desc: 'Clear the terminal output.', category: 'Shell' },
    scan: { usage: 'scan [target]', desc: 'Scan an IP, MAC address, or entity identifier for metadata.', category: 'Shell' },
    unzip: { usage: 'unzip [file]', desc: 'Extract a compressed archive found via ls.', category: 'Shell' },
    decrypt: { usage: 'decrypt [file] [password]', desc: 'Decrypt a locked file listed by ls. The password is recovered from case evidence.', category: 'Investigation' },
    trace: { usage: 'trace [reference-id]', desc: 'Trace a wire transfer, macro registration, or relay back to its origin. The reference id turns up in case evidence.', category: 'Investigation' },
    netstat: { usage: 'netstat [flag]', desc: 'Inspect active network connections and external routing state.', category: 'Investigation' },
    archive: { usage: 'archive query --manifest [id]', desc: 'Query the records archive for a manifest by id.', category: 'Investigation' },
    mapresolve: { usage: 'mapresolve [code]', desc: 'Resolve a route or location code against mapping data.', category: 'Investigation' }
};

export class TerminalApp extends BaseApp {
    constructor(id, title, width, height, windowManager) {
        super(id, title, width, height, windowManager);
        const caseData = stateManager.get('caseData');
        this.fileSystem = caseData?.terminalFiles || {};
        this.scanData = caseData?.terminalScans || {};
        this.outputHistory = [
            "KestrelOS SECURE KERNEL v4.1.0",
            "Establishing encrypted handshake... SUCCESS.",
            "Type 'help' for a list of available commands."
        ];

        const operatorName = stateManager.get('operator_name');
        const slug = operatorName
            ? operatorName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'operator'
            : 'operator';

        this.promptLabel = `${slug}@her-story:~$`;
    }

    render() {
        if (this.element) return this.element;
        super.render(); 

        const contentArea = this.element.querySelector('.window-content');
        if (contentArea) {
            contentArea.classList.add('app-content-area--flex');
            const template = TemplateLoader.getSync(TERMINAL_SHELL_TEMPLATE_PATH);
            contentArea.innerHTML = template
                .replaceAll('{{id}}', this.id)
                .replace('{{promptLabel}}', this.promptLabel);

            this._renderOutput();
            this._bindAppEvents();
        }
        return this.element;
    }

    _renderOutput() {
        const outputEl = this.element.querySelector(`#term-output-${this.id}`);
        if (!outputEl) return;
        outputEl.innerHTML = this.outputHistory.map(entry => this._renderLine(entry)).join('');
        outputEl.scrollTop = outputEl.scrollHeight;
    }

    // Escape HTML entities
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Render single output line
    _renderLine(entry) {
        if (entry && typeof entry === 'object') {
            switch (entry.type) {
                case 'header':
                    return `<div style="color: var(--term-blue); font-weight: 600; letter-spacing: 0.5px; line-height: 1.4; margin-top: 4px;">${entry.text}</div>`;
                case 'muted':
                    return `<div style="color: var(--term-muted); line-height: 1.4;">${entry.text}</div>`;
                case 'cmd':
                    return `<div style="line-height: 1.4;"><span style="color: var(--term-cyan);">${entry.cmd}</span>${entry.desc ? `<span style="color: var(--term-fg);"> — ${entry.desc}</span>` : ''}</div>`;
                default:
                    return `<div style="color: var(--term-fg); line-height: 1.4;">${entry.text || ''}</div>`;
            }
        }

        const line = String(entry);
        let color = "var(--term-fg)";
        if (line.includes("SUCCESS") || line.includes("EXTRACTED") || line.includes("DECRYPTED")) color = "var(--term-green-bright)";
        if (line.includes("ERR") || line.includes("DENIED") || line.includes("ACCESS")) color = "var(--term-red)";
        if (line.startsWith(this.promptLabel)) color = "var(--term-green)";

        // Player-typed commands (echoed lines, "Command not recognized: '<cmd>'",
        // scan target names, etc.) flow into this branch as plain strings, so
        // the text must be HTML-escaped before it reaches innerHTML — color
        // classification above runs on the raw string, but what's rendered
        // is always the escaped version.
        return `<div style="color: ${color}; line-height: 1.4;">${this._escapeHtml(line)}</div>`;
    }

    _bindAppEvents() {
        const inputEl = this.element.querySelector(`#term-input-${this.id}`);
        if (!inputEl) return;

        inputEl.focus();

        inputEl.addEventListener('input', () => {
            if (stateManager.get('os_settings')?.keypressClick !== false) AudioController.keyPress();
        });

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = inputEl.value.trim();
                if (command) {
                    this.outputHistory.push(`${this.promptLabel} ${command}`);
                    this._executeCommand(command);
                    inputEl.value = '';
                    this._renderOutput();
                    // bootKey() is tuned for the boot sequence's rapid,
                    // near-silent per-character typing texture (12ms blip
                    // at very low volume) — reusing it here for command
                    // submission made the terminal seem silent. click() is
                    // the same audible cue every other discrete action uses.
                    AudioController.click();
                }
            }
        });
    }

    _executeCommand(rawCmd) {
        const matchedPuzzle = dataLoader.checkTerminalCommand(rawCmd);
        if (matchedPuzzle) {
            this._resolvePuzzle(matchedPuzzle);
            return;
        }

        const args = rawCmd.split(' ').filter(Boolean);
        const cmd = args[0].toLowerCase();

        switch (cmd) {
            case 'help':
                if (args[1]) {
                    this._showCommandHelp(args[1].toLowerCase());
                } else {
                    this._showAllCommands();
                }
                break;
            case 'clear':
                this.outputHistory = [];
                break;
            case 'ls':
                const files = Object.keys(this.fileSystem);
                if (files.length === 0) {
                    this.outputHistory.push("Directory is empty.");
                } else {
                    files.forEach(f => {
                        const fileObj = this.fileSystem[f];
                        const isLocked = fileObj.locked;
                        const status = isLocked ? "[ENCRYPTED]" : "[UNLOCKED]";
                        this.outputHistory.push(`${f.padEnd(20)} ${status}`);
                    });
                }
                break;
            case 'scan':
                const target = args[1];
                if (!target) {
                    this.outputHistory.push("Usage: scan [target-ip-or-id]");
                } else if (this.scanData[target]) {
                    this.outputHistory.push(`Scanning ${target}...`);
                    this.outputHistory.push(this.scanData[target]);
                } else {
                    this.outputHistory.push(`Scanning ${target}... No actionable telemetry found.`);
                }
                break;
            default:
                this.outputHistory.push(`Command not recognized: '${cmd}'. Type 'help' for available commands.`);
                break;
        }
    }

    _showAllCommands() {
        this.outputHistory.push({ type: 'header', text: 'AVAILABLE COMMANDS' });
        this.outputHistory.push({ type: 'muted', text: 'Type "help <command>" for detailed usage and examples.' });
        Object.entries(COMMAND_HELP).forEach(([cmd, meta]) => {
            this.outputHistory.push({ type: 'cmd', cmd: meta.usage.padEnd(24), desc: meta.desc });
        });
    }

    _showCommandHelp(cmdName) {
        const meta = COMMAND_HELP[cmdName];
        if (!meta) {
            this.outputHistory.push(`No detailed help for '${cmdName}'. Type 'help' to list commands.`);
            return;
        }
        this.outputHistory.push({ type: 'header', text: `HELP: ${cmdName.toUpperCase()}` });
        this.outputHistory.push({ type: 'cmd', cmd: `Usage: ${meta.usage}` });
        this.outputHistory.push({ type: 'muted', text: meta.desc });
    }

    _resolvePuzzle(puzzle) {
        // Case puzzle data only ever sets `resultingFlag` (see every
        // case JSON + Forensics/Media/Help's handling of the same field).
        // unlocksDocument/unlocksThread/unlocksApp referenced non-existent
        // StateManager methods and no case data has ever set them.
        if (puzzle.resultingFlag) stateManager.unlockFlag(puzzle.resultingFlag);

        if (puzzle.successOutput) {
            this.outputHistory.push(puzzle.successOutput);
        } else {
            this.outputHistory.push("Command accepted. Decrypting payload... Done.");
        }
        eventBus.emit('TERMINAL_DECRYPT_SUCCESS', { puzzleId: puzzle.id });
    }
}
