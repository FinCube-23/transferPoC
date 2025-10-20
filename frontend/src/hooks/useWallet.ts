import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { web3Service } from '../services/web3Service';

interface WalletBalances {
  usd: string;
  eth: string;
  usdc: string;
}

interface UseWalletReturn {
  isConnected: boolean;
  currentAccount: string | null;
  balances: WalletBalances;
  connect: () => Promise<void>;
  disconnect: () => void;
  updateBalances: () => Promise<void>;
}

export const useWallet = (): UseWalletReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [balances, setBalances] = useState<WalletBalances>({
    usd: '0.00',
    eth: '0.00000',
    usdc: '0.0000',
  });

  const updateBalances = useCallback(async () => {
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

      setBalances({
        usd: randomUsd,
        eth: ethFormatted,
        usdc: usdcFormatted,
      });
    } catch (error: any) {
      console.error('Failed to update balances:', error);
    }
  }, [currentAccount]);

  const connect = useCallback(async () => {
    try {
      await web3Service.connect();
      const accounts = await web3Service.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      setCurrentAccount(address);
      setIsConnected(true);

      try {
        localStorage.setItem('fincube_address', address);
        localStorage.removeItem('fincube_user_disconnected');
      } catch (e) {
        // ignore localStorage errors
      }
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      alert(error.message);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    const confirmDisconnect = confirm(
      'Do you want to disconnect your wallet from this site?'
    );
    
    if (!confirmDisconnect) return;

    web3Service.disconnect();
    setIsConnected(false);
    setCurrentAccount(null);
    setBalances({
      usd: '0.00',
      eth: '0.00000',
      usdc: '0.0000',
    });

    try {
      localStorage.removeItem('fincube_address');
      localStorage.setItem('fincube_user_disconnected', '1');
    } catch (e) {
      // ignore localStorage errors
    }
  }, []);

  // Setup MetaMask event listeners
  useEffect(() => {
    if (!isConnected || typeof window.ethereum === 'undefined') return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length > 0) {
        const addr = accounts[0];
        setCurrentAccount(addr);
        try {
          localStorage.setItem('fincube_address', addr);
        } catch (e) {
          // ignore
        }
      } else {
        web3Service.disconnect();
        setIsConnected(false);
        setCurrentAccount(null);
        setBalances({
          usd: '0.00',
          eth: '0.00000',
          usdc: '0.0000',
        });
        try {
          localStorage.removeItem('fincube_address');
          localStorage.setItem('fincube_user_disconnected', '1');
        } catch (e) {
          // ignore
        }
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isConnected]);

  // Auto-update balances when account changes
  useEffect(() => {
    if (currentAccount && isConnected) {
      updateBalances();
    }
  }, [currentAccount, isConnected, updateBalances]);

  // Restore connection on mount
  useEffect(() => {
    const restoreConnection = async () => {
      try {
        const explicitlyDisconnected = localStorage.getItem('fincube_user_disconnected') === '1';
        if (explicitlyDisconnected) return;

        await web3Service.restoreConnection();
        const acct = web3Service.getCurrentAccount();
        
        if (acct) {
          setCurrentAccount(acct);
          setIsConnected(true);
        }
      } catch (err) {
        console.warn('Silent refresh check failed', err);
      }
    };

    restoreConnection();
  }, []);

  return {
    isConnected,
    currentAccount,
    balances,
    connect,
    disconnect,
    updateBalances,
  };
};
