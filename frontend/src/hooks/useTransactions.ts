import { useState, useCallback } from "react";
import {
  fetchTransfersFromGraph,
  type ParsedTransfer,
} from "../services/graphService";

const ITEMS_PER_PAGE = 10;

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

export const useTransactions = (): UseTransactionsReturn => {
  const [transactions, setTransactions] = useState<ParsedTransfer[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);

  const loadTransactions = useCallback(async (referenceNumber: string) => {
    setLoading(true);
    try {
      const transfers = await fetchTransfersFromGraph(referenceNumber);
      setTransactions(transfers);
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
