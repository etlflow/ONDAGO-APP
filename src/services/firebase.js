import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.includes('192.168.')
);

const firebaseConfig = {
  apiKey: "AIzaSyC7gyV-JALb0MsVRDMIIsDLSWNpL1U_we0",
  authDomain: isLocal ? "flybabyfly.firebaseapp.com" : "ondago-f973b.firebaseapp.com",
  projectId: isLocal ? "flybabyfly" : "ondago-f973b",
  storageBucket: isLocal ? "flybabyfly.appspot.com" : "ondago-f973b.appspot.com",
  messagingSenderId: "1087050835751",
  appId: "1:1087050835751:web:ondago_web_app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable App Check with support for Local Emulator Debugging
if (typeof window !== 'undefined') {
  if (isLocal) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    
    // Connect to Firebase Emulators
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
      console.log('Connected to Firebase Emulators (Auth: 9099, Firestore: 8080, Storage: 9199)');
    } catch (error) {
      console.error('Failed to connect to Firebase Emulators:', error);
    }
  }

  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (!isLocal && recaptchaSiteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    } catch (error) {
      console.warn('App Check failed to initialize, running without token validation:', error.message);
    }
  } else if (!isLocal) {
    console.warn('App Check skipped because VITE_RECAPTCHA_SITE_KEY is not configured.');
  }
}

export { app, auth, db, storage };
export default app;
