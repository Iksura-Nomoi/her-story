const SESSION_KEY = 'offset_devtools_authed';
const CHECK_ENDPOINT = '/api/check-devtools-password';

export class DevToolsAuth {
        static isSessionAuthed() {
        try {
            return sessionStorage.getItem(SESSION_KEY) === '1';
        } catch {
            return false;
        }
    }

        static async promptAndVerify() {
        if (this.isSessionAuthed()) return true;

        const attempt = prompt('Dev Tools password:');
        if (attempt === null) return false; 

        try {
            const res = await fetch(CHECK_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: attempt }),
            });

            if (res.status === 429) {
                alert('Too many attempts. Try again later.');
                return false;
            }

            const result = await res.json().catch(() => null);
            if (result && result.ok) {
                try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {  }
                return true;
            }
            if (!res.ok) {
                alert('Dev Tools is not available right now (server check failed or not configured yet). See DEVTOOLS_SETUP.md.');
                return false;
            }
            alert('Incorrect password.');
            return false;
        } catch (err) {
            alert('Dev Tools is not available right now (could not reach the server). See DEVTOOLS_SETUP.md.');
            return false;
        }
    }
}
