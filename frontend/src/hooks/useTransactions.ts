import { useState, useCallback, useEffect } from "react";
import {
  fetchTransfersFromGraph,
  type ParsedTransfer,
} from "../services/graphService";

const ITEMS_PER_PAGE = 10;
const STORAGE_KEY = "fincube_transactions";

interface UseTransactionsReturn {
  transactions: ParsedTransfer[];
  currentPage: number;
  totalPages: number;
  loading: boolean;
  loadTransactions: (account: string) => Promise<void>;
  addTransaction: (tx: ParsedTransfer) => void;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  clearTransactions: () => void;
}

// Load transactions from localStorage
const loadFromStorage = (): ParsedTransfer[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load transactions from localStorage:", error);
  }
  return [];
};

// Save transactions to localStorage
const saveToStorage = (transactions: ParsedTransfer[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error("Failed to save transactions to localStorage:", error);
  }
};

export const useTransactions = (): UseTransactionsReturn => {
  const [transactions, setTransactions] =
    useState<ParsedTransfer[]>(loadFromStorage);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // Save to localStorage whenever transactions change
  useEffect(() => {
    saveToStorage(transactions);
  }, [transactions]);

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);

  const loadTransactions = useCallback(async (account: string) => {
    setLoading(true);
    try {
      const transfers = await fetchTransfersFromGraph(account);
      // Merge with existing transactions, avoiding duplicates
      setTransactions((prev) => {
        const existingHashes = new Set(
          prev.map((tx) => tx.txHash).filter(Boolean)
        );
        const newTransfers = transfers.filter(
          (tx) => !tx.txHash || !existingHashes.has(tx.txHash)
        );
        return [...prev, ...newTransfers];
      });
      setCurrentPage(0);
    } catch (e) {
      console.error("Failed to load transfers from Graph", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const addTransaction = useCallback((tx: ParsedTransfer) => {
    setTransactions((prev) => [tx, ...prev]);
    setCurrentPage(0);
  }, []);

  const setPage = useCallback(
    (page: number) => {
      const maxPage = Math.ceil(transactions.length / ITEMS_PER_PAGE) - 1;
      if (page >= 0 && page <= maxPage) {
        setCurrentPage(page);
      }
    },
    [transactions.length]
  );

  const nextPage = useCallback(() => {
    setPage(currentPage + 1);
  }, [currentPage, setPage]);

  const prevPage = useCallback(() => {
    setPage(currentPage - 1);
  }, [currentPage, setPage]);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
    setCurrentPage(0);
  }, []);

  return {
    transactions,
    currentPage,
    totalPages,
    loading,
    loadTransactions,
    addTransaction,
    setPage,
    nextPage,
    prevPage,
    clearTransactions,
  };
};
