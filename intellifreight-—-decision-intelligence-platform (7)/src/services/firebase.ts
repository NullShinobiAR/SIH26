import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  User,
  AuthError,
} from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

// Initialize Firebase once
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Ensure session persistence across browser reopens
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Failed to set browser local persistence for Firebase Auth:', err);
});

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Sign in using Google OAuth via Firebase Popup
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const authError = error as AuthError;
    console.error('Google Sign-In Error:', authError.code, authError.message);
    throw authError;
  }
}

/**
 * Sign out of current Firebase session
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign Out Error:', error);
    throw error;
  }
}

/**
 * User-friendly mapping for Firebase Authentication errors
 */
export function getAuthErrorMessage(error: any): { title: string; message: string; actionGuide?: string } {
  const code = error?.code || '';

  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return {
        title: 'Google Sign-In Not Enabled in Firebase Console',
        message: 'The Google Sign-In authentication provider has not yet been enabled in your Firebase project.',
        actionGuide:
          'To enable it: Open Firebase Console -> Authentication -> Sign-in method -> Add new provider -> Select Google -> Toggle Enable -> Set Project Support Email -> Save.',
      };
    case 'auth/unauthorized-domain':
      return {
        title: 'Unauthorized Domain for Authentication',
        message: 'The current web domain is not on the authorized domains list for this Firebase project.',
        actionGuide:
          'Open Firebase Console -> Authentication -> Settings -> Authorized domains -> Add the current application hostname.',
      };
    case 'auth/popup-closed-by-user':
      return {
        title: 'Sign-In Cancelled',
        message: 'The Google sign-in window was closed before completing authentication. Please click Continue with Google to try again.',
      };
    case 'auth/cancelled-popup-request':
      return {
        title: 'Sign-In Request In Progress',
        message: 'Another sign-in window is already open. Please complete authentication there.',
      };
    case 'auth/popup-blocked':
      return {
        title: 'Popup Blocked by Browser',
        message: 'Your browser prevented the Google Sign-In popup from opening.',
        actionGuide: 'Please allow popups for this site in your browser address bar and try again.',
      };
    case 'auth/network-request-failed':
      return {
        title: 'Network Connection Issue',
        message: 'Could not connect to Firebase Authentication servers. Please verify your internet connection.',
      };
    default:
      return {
        title: 'Authentication Failed',
        message: error?.message || 'An unexpected error occurred during Google Sign-In. Please try again.',
      };
  }
}
