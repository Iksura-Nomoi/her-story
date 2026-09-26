/**
 * ReportsApp — reports application
 */

export class ReportsApp {
    constructor() {
        this.name = 'Reports';
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

export default { ReportsApp };
