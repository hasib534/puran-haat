import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  authErrorMessage,
  isFirebaseConfigured,
  refreshCurrentUser,
  resendVerificationEmail,
  sendPasswordReset,
  signIn as fbSignIn,
  signInWithGoogleIdToken,
  signInWithGooglePopup as fbSignInWithGooglePopup,
  signOut as fbSignOut,
  signUp as fbSignUp,
  subscribeToAuth,
  type FirebaseUser,
} from '../lib/firebase';

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithGooglePopup: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  resendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const userRef = useRef<FirebaseUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Firebase is the source of truth for the session. onAuthStateChanged also
  // restores persisted sessions on app launch.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return subscribeToAuth((next) => {
      setUser(next);
      setLoading(false);
      if (next) {
        // Pull a fresh ID token on launch/sign-in. This makes an email that was
        // verified outside the app (or a new custom claim) effective for
        // Firestore rules immediately.
        refreshCurrentUser()
          .then((refreshed) => {
            if (refreshed) setUser(refreshed);
          })
          .catch(() => {
            // Offline launches keep the cached session; the next focus retries.
          });
      }
    });
  }, []);

  // When the user returns from their email app after verifying, refresh the
  // Firebase user so `emailVerified` flips without a full reload.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !userRef.current) return;
      refreshCurrentUser()
        .then((next) => {
          if (next) setUser(next);
        })
        .catch(() => {
          // Ignore transient refresh failures; the next app focus retries.
        });
    });
    return () => subscription.remove();
  }, []);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    try {
      const next = await fbSignIn(email, password);
      setUser(next);
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const handleSignUp = useCallback(async (email: string, password: string) => {
    try {
      const next = await fbSignUp(email, password);
      setUser(next);
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const handleSignInWithGoogle = useCallback(async (idToken: string) => {
    try {
      const next = await signInWithGoogleIdToken(idToken);
      setUser(next);
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const handleSignInWithGooglePopup = useCallback(async () => {
    try {
      const next = await fbSignInWithGooglePopup();
      setUser(next);
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await fbSignOut();
    setUser(null);
  }, []);

  const handleRefreshUser = useCallback(async () => {
    const next = await refreshCurrentUser();
    if (next) setUser(next);
  }, []);

  const handleResendVerification = useCallback(async () => {
    try {
      await resendVerificationEmail();
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const handleResetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordReset(email);
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured: isFirebaseConfigured,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signInWithGoogle: handleSignInWithGoogle,
        signInWithGooglePopup: handleSignInWithGooglePopup,
        signOut: handleSignOut,
        refreshUser: handleRefreshUser,
        resendVerification: handleResendVerification,
        resetPassword: handleResetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
