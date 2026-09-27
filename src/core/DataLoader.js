export class DataLoader {
    constructor() {
        this.currentCaseData = null;
    }
    async loadCase(caseId) {
        const candidates = [`./data/cases/${caseId}.json`, `./public/data/cases/${caseId}.json`];
        for (const url of candidates) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                this.currentCaseData = await response.json();
                return this.currentCaseData;
            } catch (error) {
                continue;
            }
        }
        console.error(`Could not load case data: ${caseId} (tried ${candidates.join(', ')})`);
        return null;
    }
    getEvidence() {
        return this.currentCaseData ? this.currentCaseData.evidence : [];
    }
    getMessages() {
        return this.currentCaseData && this.currentCaseData.messages ? this.currentCaseData.messages : [];
    }
    getPuzzles() {
        return this.currentCaseData && this.currentCaseData.puzzles ? this.currentCaseData.puzzles : [];
    }
    getSuspects() {
        return this.currentCaseData && this.currentCaseData.suspects ? this.currentCaseData.suspects : [];
    }
    getSolution() {
        return this.currentCaseData && this.currentCaseData.solution ? this.currentCaseData.solution : null;
    }
    getNarrativeBeats() {
        return this.currentCaseData && this.currentCaseData.narrativeBeats ? this.currentCaseData.narrativeBeats : {};
    }
    getSpectroData(id) {
        if (!this.currentCaseData || !this.currentCaseData.spectroData) return null;
        return this.currentCaseData.spectroData.find(s => s.id === id) || null;
    }
    // Matches a raw terminal command line against the current case's
    // puzzles by triggerCommand. Case/whitespace-insensitive so
    // "Decrypt File.enc PASS" still matches "decrypt file.enc pass".
    checkTerminalCommand(rawCmd) {
        if (!this.currentCaseData || !this.currentCaseData.puzzles) return null;
        const normalized = String(rawCmd).trim().toLowerCase().replace(/\s+/g, ' ');
        return this.currentCaseData.puzzles.find(p =>
            p.triggerCommand && p.triggerCommand.trim().toLowerCase().replace(/\s+/g, ' ') === normalized
        ) || null;
    }
}
export const dataLoader = new DataLoader();
