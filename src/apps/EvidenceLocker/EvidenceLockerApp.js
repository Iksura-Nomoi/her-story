/**
 * EvidenceLockerApp — evidence management application
 */

export class EvidenceLockerApp {
    constructor() {
        this.name = 'Evidence Locker';
        this.isOpen = false;
    }

    async launch() {
        this.isOpen = true;
    }

    async close() {
        this.isOpen = false;
    }

    render() {
        return document.createElement('div');
    }
}

export default { EvidenceLockerApp };
