/**
 * InvestigationMapApp — investigation mapping application
 */

export class InvestigationMapApp {
    constructor() {
        this.name = 'Investigation Map';
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

export default { InvestigationMapApp };
