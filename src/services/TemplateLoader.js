export class TemplateLoader {
    static _cache = new Map();
    static _pending = new Map();

        static async load(path) {
        if (this._cache.has(path)) return this._cache.get(path);
        if (this._pending.has(path)) return this._pending.get(path);

        // Plain static servers (no vite) don't map `public/` to `/`, so a
        // `templates/x` or `assets/x` fetch 404s there. Retry once with the
        // `public/` prefix before giving up. Cached under the original path
        // so callers never care which layout served the file.
        const fetchText = (url) =>
            fetch(url).then((res) => (res.ok ? res.text() : null)).catch(() => null);

        const promise = fetchText(path)
            .then((text) => {
                if (text !== null) return text;
                if (/^(public\/|https?:|data:|blob:)/.test(path)) return null;
                return fetchText(`public/${path}`);
            })
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
