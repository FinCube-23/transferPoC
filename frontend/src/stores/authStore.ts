import { create } from 'zustand';

interface AuthState {
  // State
  isSignedIn: boolean;
  loading: boolean;
  loadingText: string;

  // Actions
  signIn: () => void;
  signOut: () => void;
  setLoading: (loading: boolean, text?: string) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const store: AuthState = {
    // Initial state
    isSignedIn: false,
    loading: false,
    loadingText: '',

    // Sign in action with localStorage persistence
    signIn: () => {
      try {
        localStorage.setItem('fincube_auth', 'true');
        set({ isSignedIn: true });
      } catch (error) {
        console.error('Error during sign in:', error);
      }
    },

    // Sign out action with 600ms delay and cleanup
    signOut: () => {
      try {
        // Set loading state
        set({ loading: true, loadingText: 'Signing out...' });

        // Delay for 600ms before cleanup
        setTimeout(() => {
          try {
            // Remove auth data from localStorage
            localStorage.removeItem('fincube_auth');
            localStorage.removeItem('fincube_address');
            localStorage.setItem('fincube_user_disconnected', 'true');

            // Disconnect wallet by triggering wallet store disconnect (skip confirmation)
            const walletStore = (window as any).__walletStore;
            if (walletStore && typeof walletStore.getState === 'function') {
              const disconnect = walletStore.getState().disconnect;
              if (typeof disconnect === 'function') {
                disconnect(true); // Pass true to skip confirmation dialog
              }
            }

            // Update state
            set({
              isSignedIn: false,
              loading: false,
              loadingText: ''
            });
          } catch (error) {
            console.error('Error during sign out cleanup:', error);
            // Reset loading state even if cleanup fails
            set({ loading: false, loadingText: '' });
          }
        }, 600);
      } catch (error) {
        console.error('Error during sign out:', error);
        set({ loading: false, loadingText: '' });
      }
    },

    // Set loading state action
    setLoading: (loading: boolean, text: string = '') => {
      set({ loading, loadingText: text });
    },

    // Initialize action to restore state from localStorage
    initialize: () => {
      try {
        const authExists = localStorage.getItem('fincube_auth');
        if (authExists) {
          set({ isSignedIn: true });
        }

        // Add window.authSetSignedIn for backward compatibility
        if (typeof window !== 'undefined') {
          (window as any).authSetSignedIn = (signedIn: boolean) => {
            set({ isSignedIn: signedIn });
          };
        }
      } catch (error) {
        console.error('Error during auth initialization:', error);
      }
    }
  };

  return store;
});
