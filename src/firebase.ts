import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
};

const app = initializeApp(firebaseConfig);

// Use explicit database URL so we always hit the correct Realtime DB
// (e.g. asia-southeast1). Without this, getDatabase(app) may use a different default.
const databaseURL = firebaseConfig.databaseURL || undefined;
export const auth = getAuth(app);
export const db = databaseURL ? getDatabase(app, databaseURL) : getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export const ACCESS_CONFIG_PATH = 'accessConfig';
