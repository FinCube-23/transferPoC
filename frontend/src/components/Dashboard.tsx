import React, { useEffect, useState } from "react";
import { useTransactions } from "../hooks/useTransactions";
import { fraudDetectionService } from "../services/fraudDetectionService";
import { ethers } from "ethers";
import type { ParsedTransfer } from "../services/graphService";
import UserInfo from "./UserInfo";

const Dashboard: React.FC = () => {
  const {
    transactions,
    currentPage,
    totalPages,
    loadTransactions,
    addTransaction,
    nextPage,
    prevPage,
    clearTransactions,
  } = useTransactions();

  const [transferForm, setTransferForm] = useState({
    address: "",
    amount: "",
    purpose: "",
  });

  const [fraudResults, setFraudResults] = useState<
    Record<
      string,
      {
        result: string;
        probability: number;
        confidence: number;
        loading: boolean;
        error: boolean;
      }
    >
  >({});

  // Fetch fraud detection for an address using the service
  const fetchFraudDetection = async (address: string, fromAddress?: string) => {
    // Set loading state
    setFraudResults((prev) => ({
      ...prev,
      [address]: {
        result: "",
        probability: 0,
        confidence: 0,
        loading: true,
        error: false,
      },
    }));

    try {
      const data = await fraudDetectionService.getFraudScore(
        address,
        fromAddress
      );

      setFraudResults((prev) => ({
        ...prev,
        [address]: {
          result: data.result,
          probability: data.fraud_probability,
          confidence: data.confidence,
          loading: false,
          error: false,
        },
      }));
    } catch (error: any) {
      console.error("Fraud detection error:", error);

      setFraudResults((prev) => ({
        ...prev,
        [address]: {
          result: "",
          probability: 0,
          confidence: 0,
          loading: false,
          error: true,
        },
      }));
    }
  };

  // Fetch fraud detection for all visible transactions in parallel
  useEffect(() => {
    if (transactions.length === 0) return;

    const ITEMS_PER_PAGE = 10;
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    const start = currentPage * ITEMS_PER_PAGE;
    const page = sorted.slice(start, start + ITEMS_PER_PAGE);

    // Fetch fraud detection for each transaction with from address
    // Skip if already loading or has valid result (not error)
    const fetchPromises = page
      .filter((tx) => {
        const existing = fraudResults[tx.sender];
        // Refetch if error or doesn't exist
        return tx.sender && (!existing || existing.error);
      })
      .map((tx) => {
        console.log("Fetching fraud detection for:", tx.sender);
        return fetchFraudDetection(tx.sender, tx.sender);
      });

    console.log(
      `Fetching fraud detection for ${fetchPromises.length} addresses`
    );

    // Fetch all in parallel for faster loading
    if (fetchPromises.length > 0) {
      Promise.all(fetchPromises);
    }
  }, [transactions, currentPage]);

  // Load transactions on mount
  useEffect(() => {
    // Load transactions for demo purposes
    // In production, this would be based on authenticated user
    const demoAccount = "0x0000000000000000000000000000000000000000";
    loadTransactions(demoAccount);
  }, [loadTransactions]);

  return (
    <>
      {/* User Info */}
      <UserInfo />

      {/* Transfer Form */}
      <form
        id="transfer-form"
        onSubmit={async (e) => {
          e.preventDefault();

          try {
            const toInput = transferForm.address.trim().replace(/\s+/g, "");
            const amount = transferForm.amount;
            const purpose = transferForm.purpose;

            // Basic validation
            let checksumTo: string;
            try {
              checksumTo = ethers.utils.getAddress(toInput);
            } catch {
              throw new Error("Please enter a valid recipient address");
            }

            const normalized = amount.trim().replace(/,/g, "");
            if (!/^\d*\.?\d+$/.test(normalized)) {
              throw new Error("Please enter a valid decimal amount");
            }

            if (!purpose.trim()) {
              throw new Error("Please enter a purpose for this transfer");
            }

            // For demo purposes, just show success message
            // In production, this would call backend API to process transfer
            alert("Transfer functionality requires backend integration");

            // Add demo transaction to list
            const newTx: ParsedTransfer = {
              sender: "0x0000000000000000000000000000000000000000",
              recipient: toInput,
              amount: `${amount} USDC`,
              purpose: purpose.trim(),
              nullifier: ethers.utils.id(`demo_${Date.now()}`),
              timestamp: Date.now(),
              txHash: undefined,
            };

            addTransaction(newTx);

            // Clear form
            setTransferForm({
              address: "",
              amount: "",
              purpose: "",
            });
          } catch (error: any) {
            console.error(error.message);
            alert(error.message);
          }
        }}
        style={{
          display: "flex",
          marginTop: "2.5rem",
          marginLeft: "auto",
          marginRight: "auto",
          flexDirection: "column",
          gap: "0.8rem",
          width: "100%",
          maxWidth: "420px",
        }}
      >
        <div style={{ position: "relative" }}>
          <input
            type="text"
            name="address"
            value={transferForm.address}
            onChange={(e) =>
              setTransferForm({ ...transferForm, address: e.target.value })
            }
            placeholder="Recipient Address"
            required
            style={{
              width: "100%",
              padding: "1rem 1.2rem",
              border: "2px solid #e2e8f0",
              borderRadius: "0.75rem",
              fontSize: "1rem",
              fontWeight: 500,
              outline: "none",
              background: "rgba(255, 255, 255, 0.9)",
              transition: "all 0.2s ease",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: "1rem",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
              <circle
                cx="12"
                cy="10"
                r="3"
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            name="amount"
            value={transferForm.amount}
            onChange={(e) =>
              setTransferForm({ ...transferForm, amount: e.target.value })
            }
            placeholder="Amount"
            inputMode="decimal"
            required
            style={{
              width: "100%",
              padding: "1rem 1.2rem",
              border: "2px solid #e2e8f0",
              borderRadius: "0.75rem",
              fontSize: "1rem",
              fontWeight: 500,
              outline: "none",
              background: "rgba(255, 255, 255, 0.9)",
              transition: "all 0.2s ease",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: "1rem",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-label="ETH"
            >
              <path d="M12 2l6 9-6 3-6-3 6-9z" fill="#94a3b8" opacity="0.95" />
              <path
                d="M12 14l6-3-6 11-6-11 6 3z"
                fill="#94a3b8"
                opacity="0.7"
              />
            </svg>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            name="purpose"
            value={transferForm.purpose}
            onChange={(e) =>
              setTransferForm({ ...transferForm, purpose: e.target.value })
            }
            placeholder="Purpose (e.g., Salary, Invoice, Refund)"
            required
            style={{
              width: "100%",
              padding: "1rem 1.2rem",
              border: "2px solid #e2e8f0",
              borderRadius: "0.75rem",
              fontSize: "1rem",
              fontWeight: 500,
              outline: "none",
              background: "rgba(255, 255, 255, 0.9)",
              transition: "all 0.2s ease",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: "1rem",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16M7 12h10M8 17h8"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "1rem 1.5rem",
            background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "0.75rem",
            fontWeight: 700,
            fontSize: "1.1rem",
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(16, 185, 129, 0.4)",
            transition: "all 0.3s ease",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            style={{ position: "relative", zIndex: 1 }}
          >
            <path
              d="M3 12h18m-9-9l9 9-9 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ position: "relative", zIndex: 1 }}>Transfer</span>
        </button>
      </form>

      {/* Recent Transactions */}
      <section
        id="recent-transactions"
        style={{
          maxWidth: "1400px",
          width: "calc(100% - 2rem)",
          padding: "1rem 1.5rem",
          boxSizing: "border-box",
          margin: "2rem auto 0",
        }}
      >
        <div
          className="transactions-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 className="transactions-title" style={{ margin: 0 }}>
            Recent Transactions
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={() => {
                const FINCUBE_ADDRESS =
                  "0x8a263DcEfee44B9Abe968C1B18e370f6A0A5F878";
                window.open(
                  `https://sepolia.etherscan.io/address/${FINCUBE_ADDRESS}`,
                  "_blank",
                  "noopener"
                );
              }}
              title="View latest transaction on Etherscan (Sepolia)"
              style={{
                background: "transparent",
                color: "#21325b",
                border: "none",
                padding: "2px",
                marginRight: "4px",
                cursor: "pointer",
                borderRadius: "4px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 293.775 293.667"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g fill="#21325b">
                  <path d="M146.8 0C65.777 0 0 65.777 0 146.834 0 227.86 65.777 293.667 146.8 293.667c81.056 0 146.833-65.808 146.833-146.833C293.633 65.777 227.856 0 146.8 0zm-3.177 238.832c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm58.63-82.585c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm-117.26 0c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124z" />
                </g>
              </svg>
            </button>
            <div
              className="transactions-subtitle"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              Latest 10
            </div>
          </div>
        </div>
        <div className="transactions-table">
          <div className="transactions-table-header">
            <div>Sender</div>
            <div>Recipient</div>
            <div style={{ textAlign: "right" }}>Amount</div>
            <div>Memo</div>
            <div style={{ textAlign: "center" }}>Fraud Detection</div>
            <div style={{ textAlign: "right" }}>Date</div>
            <div style={{ textAlign: "right" }}></div>
          </div>
          <div id="tx-rows" className="transactions-rows">
            {renderTransactions()}
          </div>
        </div>
        {renderPagination()}
      </section>
    </>
  );

  function renderTransactions() {
    const ITEMS_PER_PAGE = 10;
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    const start = currentPage * ITEMS_PER_PAGE;
    const page = sorted.slice(start, start + ITEMS_PER_PAGE);

    const shorten = (addr: string): string => {
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const etherscanIcon =
      '<svg width="14" height="14" viewBox="0 0 293.775 293.667" xmlns="http://www.w3.org/2000/svg"><g fill="#21325b"><path d="M146.8 0C65.777 0 0 65.777 0 146.834 0 227.86 65.777 293.667 146.8 293.667c81.056 0 146.833-65.808 146.833-146.833C293.633 65.777 227.856 0 146.8 0zm-3.177 238.832c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm58.63-82.585c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm-117.26 0c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124z"/></g></svg>';

    return page.map((tx, index) => {
      const displayedPurpose =
        tx.purpose && tx.purpose.trim() ? tx.purpose.trim() : "Refund";
      const FINCUBE_ADDRESS = "0x8a263DcEfee44B9Abe968C1B18e370f6A0A5F878";

      const rawCandidate = tx.txHash || "";
      const match = String(rawCandidate).match(/0x[a-fA-F0-9]{64}/);
      const txHashForUrl = match ? match[0] : undefined;
      const txUrl = txHashForUrl
        ? `https://sepolia.etherscan.io/tx/${txHashForUrl}`
        : `https://sepolia.etherscan.io/address/${FINCUBE_ADDRESS}#events`;

      const fraudData = fraudResults[tx.sender];

      return (
        <div key={`${tx.txHash || ""}-${index}`} className="transaction-row">
          <div className="tx-address">{shorten(tx.sender)}</div>
          <div className="tx-address">{shorten(tx.recipient)}</div>
          <div className="tx-amount">{tx.amount}</div>
          <div className="tx-memo">
            <div
              style={{ fontSize: "0.75em", lineHeight: 1.2, color: "#6b7280" }}
            >
              <div>
                <span className="label-green" style={{ color: "#10b981" }}>
                  Reference
                </span>
                : {shorten(FINCUBE_ADDRESS)}
              </div>
              <div>
                <span className="label-green" style={{ color: "#10b981" }}>
                  Purpose
                </span>
                : {displayedPurpose}
              </div>
              <div>
                <span className="label-green" style={{ color: "#10b981" }}>
                  Description
                </span>
                : Transferred
              </div>
            </div>
          </div>
          <div
            className={`tx-fraud ${
              fraudData?.loading
                ? "loading"
                : fraudData?.error
                ? "error"
                : fraudData?.result === "Fraud"
                ? "fraud"
                : fraudData?.result === "Not_Fraud"
                ? "not-fraud"
                : fraudData?.result === "Undecided"
                ? "undecided"
                : fraudData?.result === "Service Unavailable"
                ? "error"
                : "loading"
            }`}
          >
            {fraudData?.loading ? (
              <span>🔍 Analyzing...</span>
            ) : fraudData?.error ||
              fraudData?.result === "Service Unavailable" ? (
              <div
                title="Fraud detection service is offline or slow. Please check the service."
                style={{ cursor: "help" }}
              >
                <div>⚠️ Offline</div>
                <div style={{ fontSize: "0.7em", opacity: 0.8 }}>
                  Service Down
                </div>
              </div>
            ) : fraudData?.result ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    justifyContent: "center",
                  }}
                >
                  {fraudData.result === "Fraud" && "🚨"}
                  {fraudData.result === "Not_Fraud" && "✅"}
                  {fraudData.result === "Undecided" && "⚠️"}
                  <span>{fraudData.result.replace("_", " ")}</span>
                </div>
                <div className="fraud-probability">
                  {Math.round(fraudData.probability * 100)}%
                </div>
                <div className="fraud-confidence">
                  Confidence: {Math.round(fraudData.confidence * 100)}%
                </div>
              </>
            ) : (
              <span>🔍 Analyzing...</span>
            )}
          </div>
          <div className="tx-date">
            {new Date(tx.timestamp).toLocaleString()}
          </div>
          <div className="tx-etherscan">
            <a
              className="etherscan-link"
              href={txUrl}
              target="_blank"
              rel="noopener"
              title="View on Etherscan"
              dangerouslySetInnerHTML={{ __html: etherscanIcon }}
            />
          </div>
        </div>
      );
    });
  }

  function renderPagination() {
    const hasPrevious = currentPage > 0;
    const hasNext = currentPage < totalPages - 1;

    if (totalPages <= 1) return null;

    return (
      <div
        id="pagination-controls"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "4rem",
          padding: "1rem 0",
          marginTop: "1rem",
        }}
      >
        <button
          onClick={prevPage}
          disabled={!hasPrevious}
          className="pagination-arrow"
          aria-label="Previous page"
          style={{
            background: "transparent",
            color: hasPrevious ? "#0f172a" : "#9aa3b2",
            border: "none",
            padding: "4px 8px",
            fontSize: "1.05rem",
            fontWeight: 700,
            cursor: hasPrevious ? "pointer" : "not-allowed",
            transition: "color 0.12s ease, transform 0.12s ease",
            borderRadius: "4px",
            boxShadow: "none",
          }}
          onMouseEnter={(e) =>
            hasPrevious &&
            (e.currentTarget.style.transform = "translateY(-1px)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "translateY(0)")
          }
        >
          ←
        </button>
        <span
          style={{
            color: "#64748b",
            fontWeight: 500,
            fontSize: "0.9rem",
            margin: "0 0.5rem",
          }}
        >
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={!hasNext}
          className="pagination-arrow"
          aria-label="Next page"
          style={{
            background: "transparent",
            color: hasNext ? "#0f172a" : "#9aa3b2",
            border: "none",
            padding: "4px 8px",
            fontSize: "1.05rem",
            fontWeight: 700,
            cursor: hasNext ? "pointer" : "not-allowed",
            transition: "color 0.12s ease, transform 0.12s ease",
            borderRadius: "4px",
            boxShadow: "none",
          }}
          onMouseEnter={(e) =>
            hasNext && (e.currentTarget.style.transform = "translateY(-1px)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "translateY(0)")
          }
        >
          →
        </button>
      </div>
    );
  }
};

export default Dashboard;
