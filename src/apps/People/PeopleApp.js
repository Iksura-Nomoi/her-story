/**
 * PeopleApp — people/suspects management application
 */

export class PeopleApp {
    constructor() {
        this.name = 'People';
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

export default { PeopleApp };
