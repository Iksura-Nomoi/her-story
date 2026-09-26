/**
 * EvidenceBoardApp — evidence board application
 */

export class EvidenceBoardApp {
    constructor() {
        this.name = 'Evidence Board';
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

export default { EvidenceBoardApp };
