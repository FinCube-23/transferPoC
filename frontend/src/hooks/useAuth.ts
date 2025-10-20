import { useState, useEffect, useCallback } from 'react';

interface UseAuthReturn {
  isSignedIn: boolean;
  loading: boolean;
  loadingText: string;
  signIn: () => void;
  signOut: () => void;
  setLoading: (loading: boolean, text?: string) => void;
}

export const useAuth = (): UseAuthReturn => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loading, setLoadingState] = useState(false);
  const [loadingText, setLoadingText] = useState('Authenticating...');

  const setLoading = useCallback((loading: boolean, text: string = 'Authenticating...') => {
    setLoadingState(loading);
    setLoadingText(text);
  }, []);

  const signIn = useCallback(() => {
    try {
      localStorage.setItem('fincube_auth', 'true');
      setIsSignedIn(true);
    } catch (e) {
      console.error('Failed to sign in:', e);
    }
  }, []);

  const signOut = useCallback(() => {
    setLoadingText('Signing out...');
    setLoadingState(true);

    setTimeout(() => {
      try {
        localStorage.removeItem('fincube_auth');
        localStorage.removeItem('fincube_address');
        localStorage.setItem('fincube_user_disconnected', '1');
        setIsSignedIn(false);
      } catch (e) {
        console.error('Error during sign-out:', e);
      } finally {
        setLoadingState(false);
        setLoadingText('Authenticating...');
      }
    }, 600);
  }, []);

  // Check for existing auth on mount
  useEffect(() => {
    try {
      if (localStorage.getItem('fincube_auth')) {
        setIsSignedIn(true);
      }
    } catch (e) {
      // ignore localStorage errors
    }

    // Expose auth setter for backwards compatibility with inline scripts
    (window as any).authSetSignedIn = (value: boolean) => {
      setIsSignedIn(value);
    };
  }, []);

  return {
    isSignedIn,
    loading,
    loadingText,
    signIn,
    signOut,
    setLoading,
  };
};
