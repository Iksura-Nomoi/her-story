
export class WindowManager {
    constructor() {
        this.activeApps = new Map();
        this.baseZIndex = 100;
        this.currentZIndex = this.baseZIndex;
        this.geometry = new Map();
    }
    bringToFront(appId) {
        const app = this.activeApps.get(appId);
        if (app && app.element) {
            this.currentZIndex++;
            app.element.style.zIndex = this.currentZIndex;
        }
    }
    unregisterApp(appId) {
        this.activeApps.delete(appId);
    }
}
