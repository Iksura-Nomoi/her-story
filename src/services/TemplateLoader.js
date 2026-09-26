export class TemplateLoader {
    static _cache = new Map();
    static _pending = new Map();

        static async load(path) {
        if (this._cache.has(path)) return this._cache.get(path);
        if (this._pending.has(path)) return this._pending.get(path);

        const promise = fetch(path)
            .then(res => (res.ok ? res.text() : null))
            .catch(() => null)
            .then(text => {
                this._pending.delete(path);
                if (text !== null) this._cache.set(path, text);
                return text;
            });

        this._pending.set(path, promise);
        return promise;
    }

        static async preload(paths) {
        await Promise.all(paths.map(p => this.load(p)));
    }

        static getSync(path, fallback = '') {
        return this._cache.has(path) ? this._cache.get(path) : fallback;
    }

    static isCached(path) {
        return this._cache.has(path);
    }
}
