// DevTools Password Authentication Endpoint
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getDb() {
    if (getApps().length === 0) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        // Vercel env vars store literal "\n" in multiline values; the SDK
        // needs real newlines.
        const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
        if (!projectId || !clientEmail || !privateKey) {
            throw new Error('Firebase Admin credentials are not configured (missing env vars).');
        }
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    return getFirestore();
}

function sha256Hex(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const password = req.body?.password;
    if (typeof password !== 'string' || password.length === 0 || password.length > 500) {
        return res.status(400).json({ ok: false, error: 'Password required.' });
    }

    let db;
    try {
        db = getDb();
    } catch (err) {
        console.error('[check-devtools-password] config error:', err.message);
        return res.status(503).json({ ok: false, error: 'Not configured yet.' });
    }

    // Rate limit per caller IP
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    const attemptsRef = db.collection('_config').doc('devtools_attempts').collection('ips').doc(ip);
    const now = Date.now();

    try {
        const allowed = await db.runTransaction(async (tx) => {
            const snap = await tx.get(attemptsRef);
            const data = snap.exists ? snap.data() : null;
            if (data && now - data.windowStart < WINDOW_MS && data.count >= MAX_ATTEMPTS) {
                return false;
            }
            if (!data || now - data.windowStart >= WINDOW_MS) {
                tx.set(attemptsRef, { windowStart: now, count: 1, updatedAt: FieldValue.serverTimestamp() });
            } else {
                tx.update(attemptsRef, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
            }
            return true;
        });

        if (!allowed) {
            return res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });
        }

        const configSnap = await db.collection('_config').doc('devtools').get();
        if (!configSnap.exists || typeof configSnap.data()?.hash !== 'string') {
            // No password configured yet — fail closed, same response
            // shape as "wrong password" so nothing is leaked either way.
            return res.status(200).json({ ok: false });
        }

        const storedHash = configSnap.data().hash;
        const ok = sha256Hex(password) === storedHash;

        if (ok) {
            await attemptsRef.delete().catch(() => {});
        }

        return res.status(200).json({ ok });
    } catch (err) {
        console.error('[check-devtools-password] error:', err);
        return res.status(500).json({ ok: false, error: 'Internal error.' });
    }
}
