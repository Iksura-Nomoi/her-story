const getEnvVar = (key) => {
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
            return import.meta.env[key];
        }
    } catch (e) {}
    try {
        if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
            return process.env[key];
        }
    } catch (e) {}
    return '';
};

export const firebaseConfig = {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvVar('VITE_FIREBASE_APP_ID'),
    measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID'),
};

export const isFirebaseConfigured = () =>
    !!(firebaseConfig.apiKey && firebaseConfig.projectId);
