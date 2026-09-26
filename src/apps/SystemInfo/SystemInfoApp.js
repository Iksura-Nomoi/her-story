/**
 * SystemInfoApp — system information application
 */

export class SystemInfoApp {
    constructor() {
        this.name = 'System Information';
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

export default { SystemInfoApp };
