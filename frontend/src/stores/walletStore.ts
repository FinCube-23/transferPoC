import { create } from 'zustand';
import { ethers } from 'ethers';
import { web3Service } from '../services/web3Service';

interface WalletBalances {
  usd: string;
  eth: string;
  usdc: string;
}

interface WalletState {
  // State
  isConnected: boolean;
  currentAccount: string | null;
  balances: WalletBalances;

  // Actions
  connect: () => Promise<void>;
  disconnect: (skipConfirmation?: boolean) => void;
  updateBalances: () => Promise<void>;
  setAccount: (account: string | null) => void;
  setConnected: (connected: boolean) => void;
  setBalances: (balances: WalletBalances) => void;
  initialize: () => Promise<void>;
  setupEventListeners: () => () => void;
}

export const useWalletStore = create<WalletState>((set, get) => {
  const store = {
  // Initial state
  isConnected: false,
  currentAccount: null,
  balances: {
    usd: '0.00',
    eth: '0.00000',
    usdc: '0.0000',
  },

  // Connect action with MetaMask integration and localStorage persistence
  connect: async () => {
    try {
      await web3Service.connect();
      const accounts = await web3Service.getAccounts();

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      set({
        currentAccount: address,
        isConnected: true,
      });

      try {
        localStorage.setItem('fincube_address', address);
        localStorage.removeItem('fincube_user_disconnected');
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      alert(error.message);
      throw error;
    }
  },

  // Disconnect action with optional confirmation dialog
  disconnect: (skipConfirmation: boolean = false) => {
    if (!skipConfirmation) {
      const confirmDisconnect = confirm(
        'Do you want to disconnect your wallet from this site?'
      );

      if (!confirmDisconnect) return;
    }

    web3Service.disconnect();
    set({
      isConnected: false,
      currentAccount: null,
      balances: {
        usd: '0.00',
        eth: '0.00000',
        usdc: '0.0000',
      },
    });

    try {
      localStorage.removeItem('fincube_address');
      localStorage.setItem('fincube_user_disconnected', '1');
    } catch (e) {
      console.error('Error updating localStorage:', e);
    }
  },

  // Update balances action with ETH, USDC, and USD fetching
  updateBalances: async () => {
    const { currentAccount } = get();
    if (!currentAccount) return;

    try {
      // Set USD to a random demo value between 100 and 1000
      const randomUsd = (Math.random() * (1000 - 100) + 100).toFixed(2);

      // Update ETH balance from connected wallet with 5 decimal places
      const ethWei = await web3Service.getEthBalance(currentAccount);
      const ethFormatted = parseFloat(ethers.utils.formatEther(ethWei)).toFixed(5);

      // USDC balance from contract with 4 decimal places
      let usdcFormatted = '0.0000';
      try {
        const usdcBalance = await web3Service.getUsdcBalance(currentAccount);
        usdcFormatted = parseFloat(usdcBalance).toFixed(4);
      } catch (error) {
        console.error('USDC Balance Error:', error);
      }

      set({
        balances: {
          usd: randomUsd,
          eth: ethFormatted,
          usdc: usdcFormatted,
        },
      });
    } catch (error: any) {
      console.error('Failed to update balances:', error);
    }
  },

  // Helper action to set account
  setAccount: (account: string | null) => {
    set({ currentAccount: account });
  },

  // Helper action to set connected status
  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
  },

  // Helper action to set balances
  setBalances: (balances: WalletBalances) => {
    set({ balances });
  },

  // Initialize action to restore connection from localStorage
  initialize: async () => {
    try {
      const explicitlyDisconnected = localStorage.getItem('fincube_user_disconnected') === '1';
      if (explicitlyDisconnected) return;

      await web3Service.restoreConnection();
      const acct = web3Service.getCurrentAccount();

      if (acct) {
        set({
          currentAccount: acct,
          isConnected: true,
        });

        // Auto-update balances after connection is restored
        await get().updateBalances();
      }
    } catch (err) {
      console.warn('Silent connection restore failed', err);
    }
  },

  // Setup event listeners for MetaMask events (accountsChanged, chainChanged)
  setupEventListeners: () => {
    if (typeof window.ethereum === 'undefined') {
      return () => {}; // Return empty cleanup function
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length > 0) {
        const addr = accounts[0];
        set({ currentAccount: addr, isConnected:true });
        
        try {
          localStorage.setItem('fincube_address', addr);
          localStorage.removeItem('fincube_user_disconnected');
        } catch (e) {
          console.error('Error saving account to localStorage:', e);
        }

        // Auto-update balances when account changes
        await get().updateBalances();
      } else {
        web3Service.disconnect();
        set({
          isConnected: false,
          currentAccount: null,
          balances: {
            usd: '0.00',
            eth: '0.00000',
            usdc: '0.0000',
          },
        });

        try {
          localStorage.removeItem('fincube_address');
          localStorage.setItem('fincube_user_disconnected', '1');
        } catch (e) {
          console.error('Error updating localStorage:', e);
        }
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Return cleanup function
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  },
  };

  // Expose store globally for cross-store access
  if (typeof window !== 'undefined') {
    (window as any).__walletStore = { getState: () => store };
  }

  return store;
});
