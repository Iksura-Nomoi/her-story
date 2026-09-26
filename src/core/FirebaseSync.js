import { eventBus } from './EventBus.js';
import { stateManager } from './StateManager.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const FIREBASE_SDK_VERSION = '10.14.1';
const APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
const FIRESTORE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`;
const ANALYTICS_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-analytics.js`;

export class FirebaseSync {
    static _status = {

        initState: 'not_configured',
        authenticated: false,
        dbConnected: false,
        latencyMs: null,
        operator: null,
        errors: [],
    };

    static _db = null;
    static _fs = null; 
    static _app = null;
    static _initPromise = null;

        static init() {
        if (this._initDone) return;
        this._initDone = true;

        const update = () => {
            eventBus.emit('FIREBASE_STATUS_CHANGED', this.getStatus());
        };
        window.addEventListener('online', update);
        window.addEventListener('offline', update);

        let debounceTimer = null;
        eventBus.on('STATE_UPDATED', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this._syncPlayerStats(), 5000);
        });

        if (isFirebaseConfigured()) {
            this._connect();
        } else {
            this._status.initState = 'not_configured';
        }
    }

        static async _connect() {
        if (this._initPromise) return this._initPromise;
        this._status.initState = 'connecting';
        eventBus.emit('FIREBASE_STATUS_CHANGED', this.getStatus());

        this._initPromise = (async () => {
            try {
                const t0 = performance.now();
                const [{ initializeApp }, fs] = await Promise.all([
                    import(/* @vite-ignore */ APP_URL),
                    import(/* @vite-ignore */ FIRESTORE_URL),
                ]);
                const app = initializeApp(firebaseConfig);
                this._app = app;
                this._fs = fs;
                this._db = fs.getFirestore(app);

                if (firebaseConfig.measurementId) {
                    try {
                        const analyticsModule = await import(/* @vite-ignore */ ANALYTICS_URL);
                        this._analytics = analyticsModule.getAnalytics(app);
                        this._logEventFn = analyticsModule.logEvent;
                    } catch (e) {
                        console.warn("[FirebaseSync] Analytics failed to load:", e);
                    }
                }
                this._status.latencyMs = Math.round(performance.now() - t0);
                this._status.dbConnected = true;
                this._status.authenticated = true; 
                this._status.initState = navigator.onLine ? 'online' : 'offline';
            } catch (err) {
                this._recordError(err);
                this._status.dbConnected = false;
                this._status.initState = 'offline';
            }
            eventBus.emit('FIREBASE_STATUS_CHANGED', this.getStatus());
        })();

        return this._initPromise;
    }

    static logEvent(eventName, params = {}) {
        if (!this._analytics || !this._logEventFn) return;
        try {
            this._logEventFn(this._analytics, eventName, params);
        } catch (e) {
            this._recordError(e);
        }
    }

    static _syncPlayerStats() {
        const operatorName = stateManager.get('operator_name');
        if (!operatorName) return; 
        this.push('player_stats', {
            operatorName,
            firstLaunch: stateManager.get('first_launch') || null,
            playTimeSeconds: stateManager.get('play_time_seconds') || 0,
            currentCase: stateManager.get('currentCase') || null,
            completedCaseCount: (stateManager.get('completed_cases') || []).length,
            updatedAt: new Date().toISOString(),
        }, operatorName);
    }

        static getStatus() {
        return { ...this._status, errors: this._status.errors.slice(-20) };
    }

    static _recordError(err) {
        this._status.errors.push({ time: Date.now(), message: String(err && err.message || err) });
        if (this._status.errors.length > 20) this._status.errors.shift();
        eventBus.emit('FIREBASE_STATUS_CHANGED', this.getStatus());
    }

        static async push(collectionName, payload, docId) {
        try {
            if (collectionName === 'operators' && payload && payload.name) {
                this._status.operator = payload.name;
            }
            if (!isFirebaseConfigured()) {
                console.debug(`[FirebaseSync] (offline stub — no config) would write to "${collectionName}"`, docId ? { docId, payload } : payload);
                return null;
            }
            await this._connect();
            if (!this._db || !this._fs) return null; 

            const { doc, setDoc, collection, addDoc } = this._fs;
            if (docId) {
                await setDoc(doc(this._db, collectionName, this._sanitizeId(docId)), payload, { merge: true });
            } else {
                await addDoc(collection(this._db, collectionName), payload);
            }
            return true;
        } catch (err) {

            this._recordError(err);
            return null;
        }
    }

        static async getDoc(collectionName, docId) {
        try {
            if (!isFirebaseConfigured()) return null;
            await this._connect();
            if (!this._db || !this._fs) return null;
            const { doc, getDoc } = this._fs;
            const snap = await getDoc(doc(this._db, collectionName, this._sanitizeId(docId)));
            return snap.exists() ? snap.data() : null;
        } catch (err) {
            this._recordError(err);
            return null;
        }
    }

        static _sanitizeId(id) {
        return String(id).replace(/[/]/g, '_').slice(0, 300);
    }
}
