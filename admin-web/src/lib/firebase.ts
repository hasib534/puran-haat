import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY ?? '';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID ?? '';

/**
 * True when the deployment has enough configuration to talk to Firebase.
 * Every screen checks this so a missing `.env` shows an explanation instead of
 * a white page.
 */
export const isConfigured = Boolean(apiKey && projectId);

export const firebaseApp = isConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp({
        apiKey,
        authDomain,
        projectId,
        ...(storageBucket ? { storageBucket } : {}),
        ...(appId ? { appId } : {}),
      })
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;

export const projectIdForConsole = projectId;