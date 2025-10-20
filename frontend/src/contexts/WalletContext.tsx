import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useWallet } from '../hooks/useWallet';

interface WalletBalances {
  usd: string;
  eth: string;
  usdc: string;
}

interface WalletContextType {
  isConnected: boolean;
  currentAccount: string | null;
  balances: WalletBalances;
  connect: () => Promise<void>;
  disconnect: () => void;
  updateBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const wallet = useWallet();

  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWalletContext = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
};
