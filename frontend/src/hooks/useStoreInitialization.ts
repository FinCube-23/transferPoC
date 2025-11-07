import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';

/**
 * Hook to initialize Zustand stores on application mount
 * - Initializes auth store from localStorage
 * - Initializes wallet store and restores connection if applicable
 * - Sets up MetaMask event listeners with cleanup
 */
export const useStoreInitialization = () => {
  useEffect(() => {
    // Initialize auth store (restore sign-in state from localStorage)
    useAuthStore.getState().initialize();

    // Initialize wallet store (restore connection from localStorage)
    useWalletStore.getState().initialize();

    // Setup wallet event listeners for MetaMask events
    // This is done once on app mount and cleaned up on unmount
    const cleanup = useWalletStore.getState().setupEventListeners();

    // Return cleanup function to remove event listeners on unmount
    return cleanup;
  }, []);
};
