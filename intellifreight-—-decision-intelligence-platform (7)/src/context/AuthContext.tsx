import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser, getAuthErrorMessage } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isSigningIn: boolean;
  error: { title: string; message: string; actionGuide?: string } | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [error, setError] = useState<{ title: string; message: string; actionGuide?: string } | null>(null);

  useEffect(() => {
    // Listen to Firebase authentication state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
        setLoading(false);
      },
      (err) => {
        console.error('Firebase Auth state error:', err);
        setError(getAuthErrorMessage(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
      // onAuthStateChanged will automatically set currentUser and transition view
    } catch (err: any) {
      const formatted = getAuthErrorMessage(err);
      setError(formatted);
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await signOutUser();
      setCurrentUser(null);
    } catch (err: any) {
      const formatted = getAuthErrorMessage(err);
      setError(formatted);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isSigningIn,
        error,
        loginWithGoogle,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
