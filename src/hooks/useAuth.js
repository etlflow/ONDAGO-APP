import { useEffect, useState, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  setPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { auth } from '../services/firebase';
import useTripStore from './useTripStore';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.includes('192.168.')
);

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef(null);

  // Clear idle timer
  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
  };

  // Reset idle timer
  const resetIdleTimer = () => {
    clearIdleTimer();
    if (user && !isIdle) {
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, IDLE_TIMEOUT_MS);
    }
  };

  // Handle user activity listeners for idle timeout
  useEffect(() => {
    const handleActivity = () => resetIdleTimer();

    if (user) {
      resetIdleTimer();
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keypress', handleActivity);
      window.addEventListener('scroll', handleActivity);
      window.addEventListener('click', handleActivity);
    } else {
      clearIdleTimer();
      setIsIdle(false);
    }

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearIdleTimer();
    };
  }, [user, isIdle]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sign In with optional "Remember Me"
  const signIn = async (email, password, rememberMe = false) => {
    // Choose IndexedDB for Remember Me, otherwise Session Persistence (cleared on tab close)
    const persistenceMode = rememberMe ? indexedDBLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceMode);
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Revoke refresh token and Sign Out
  const signOut = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser && !isLocal) {
        // Fetch current token to authenticate Cloud Function call
        const token = await currentUser.getIdToken();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        // Revoke tokens on server side (we will support /api/signout or trigger a revoker call)
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/signout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }).catch(err => console.warn('Server-side token revocation failed:', err));
        clearTimeout(timeoutId);
      }
    } catch (e) {
      console.warn('Failed token revocation request:', e);
    }

    await fbSignOut(auth);
    // Wipe Zustand state and AI companion context cache
    useTripStore.getState().clearStore();
    setIsIdle(false);
  };

  // Re-authenticate when idle locked
  const reauthenticate = async (password) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) return;

    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
    setIsIdle(false);
    resetIdleTimer();
  };

  return {
    user,
    loading,
    isIdle,
    signIn,
    signOut,
    reauthenticate
  };
}

export default useAuth;
