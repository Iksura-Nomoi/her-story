/**
 * CaseManagerApp — case management application
 */

export class CaseManagerApp {
    constructor() {
        this.name = 'Case Manager';
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

export default { CaseManagerApp };
