import React, { useEffect, useState } from "react";
import { useTransactions } from "../hooks/useTransactions";
import { fraudDetectionService } from "../services/fraudDetectionService";
import type { ParsedTransfer } from "../services/graphService";
import { useAuthStore } from "../stores/authStore";

const Dashboard: React.FC = () => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const zkpUser = useAuthStore((state) => state.zkpUser);

  const {
    transactions,
    currentPage,
    totalPages,
    loadTransactions,
    addTransaction,
    nextPage,
    prevPage,
  } = useTransactions();

  const [transferForm, setTransferForm] = useState({
    referenceNumber: "",
    amount: "",
    purpose: "",
  });

  const [isTransferring, setIsTransferring] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Trust score state for the current user
  const [trustScore, setTrustScore] = useState<{
    score: number;
    last_result: string;
    loading: boolean;
    error: boolean;
  }>({
    score: 0,
    last_result: "",
    loading: false,
    error: false,
  });

  // Fetch trust score for the current user using GET endpoint
  useEffect(() => {
    console.log("Trust score useEffect triggered");
    console.log("zkpUser:", zkpUser);
    console.log("zkpUser?.reference_number:", zkpUser?.reference_number);
    
    if (!zkpUser?.reference_number) {
      console.log("No reference number, skipping trust score fetch");
      return;
    }

    const fetchTrustScore = async () => {
      console.log("Fetching trust score for:", zkpUser.reference_number);
      setTrustScore((prev) => ({ ...prev, loading: true }));

      try {
        const data = await fraudDetectionService.getFraudScoreByRefNumber(
          zkpUser.reference_number
        );

        console.log("Trust score received:", data);
        setTrustScore({
          score: data.score,
          last_result: data.last_result,
          loading: false,
          error: false,
        });
      } catch (error: any) {
        console.error("Trust score fetch error:", error);
        setTrustScore({
          score: 0,
          last_result: "",
          loading: false,
          error: true,
        });
      }
    };

    fetchTrustScore();
  }, [zkpUser]);

  // Load transactions when user data is available
  useEffect(() => {
    if (zkpUser?.reference_number) {
      loadTransactions(zkpUser.reference_number);
    }
  }, [zkpUser?.reference_number, loadTransactions]);

  // Refresh transactions
  const refreshTransactions = async () => {
    if (zkpUser?.reference_number) {
      setIsRefreshing(true);
      await loadTransactions(zkpUser.reference_number);
      // Keep spinning for at least 500ms for visual feedback
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      },
      (err) => {
        console.error("Failed to copy:", err);
        alert("Failed to copy to clipboard");
      }
    );
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
      {/* Two Column Layout */}
      <div
        style={{
          maxWidth: "1200px",
          width: "100%",
          margin: "1.5rem auto 0",
          padding: "0 1rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "2rem",
          alignItems: "start",
        }}
      >
        {/* Left Column - Transfer Form */}
        <div style={{ width: "100%" }}>
          <h2
            style={{
              margin: "0 0 1.5rem 0",
              fontSize: "1.5rem",
              fontWeight: 800,
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            Send Transfer
          </h2>

          {/* Transfer Form */}
          <form
            id="transfer-form"
            onSubmit={async (e) => {
              e.preventDefault();

              if (!userProfile || !zkpUser) {
                alert("User information not loaded. Please refresh the page.");
                return;
              }

              try {
                setIsTransferring(true);

                const referenceNumber = transferForm.referenceNumber.trim();
                const amount = transferForm.amount.trim();
                const purpose = transferForm.purpose.trim();

                // Basic validation
                if (!referenceNumber) {
                  throw new Error("Please enter a recipient reference number");
                }

                // Validate reference number format (wallet_address_uuid)
                const refParts = referenceNumber.split("_");
                if (refParts.length < 2 || !refParts[0].startsWith("0x")) {
                  throw new Error(
                    "Invalid reference number format. Expected: {wallet_address}_{uuid}"
                  );
                }

                const normalized = amount.replace(/,/g, "");
                if (!/^\d*\.?\d+$/.test(normalized)) {
                  throw new Error("Please enter a valid decimal amount");
                }

                const amountNum = parseFloat(normalized);
                if (amountNum <= 0) {
                  throw new Error("Amount must be greater than 0");
                }

                if (amountNum > zkpUser.balance) {
                  throw new Error(
                    `Insufficient balance. Available: ${zkpUser.balance} USDC`
                  );
                }

                // Validate fraud scores before transfer
                console.log("Validating fraud scores...");
                const fraudValidation = await fraudDetectionService.validateTransfer(
                  zkpUser.reference_number,
                  referenceNumber,
                  0.8 // threshold (score range: 0-1, ≥0.8 = untrusted)
                );

                if (!fraudValidation.isValid) {
                  throw new Error(fraudValidation.error || "Transfer blocked");
                }

                console.log("Fraud validation passed");

                // Call transfer API
                console.log("Sending transfer request:", {
                  receiver_reference_number: referenceNumber,
                  amount: amountNum,
                  sender_user_id: userProfile.id,
                });

                const response = await fetch(
                  "http://localhost:7000/api/transfer",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      receiver_reference_number: referenceNumber,
                      amount: amountNum,
                      sender_user_id: userProfile.id,
                    }),
                  }
                );

                console.log("Transfer response status:", response.status);

                const data = await response.json();
                console.log("Transfer response data:", data);

                if (!response.ok || !data.success) {
                  // Extract detailed error message
                  let errorMessage = "Transfer failed";

                  if (data.error) {
                    if (typeof data.error === "string") {
                      errorMessage = data.error;
                    } else if (data.error.message) {
                      errorMessage = data.error.message;
                    } else if (data.error.type) {
                      errorMessage = `${data.error.type}: ${JSON.stringify(
                        data.error.details || {}
                      )}`;
                    }
                  } else if (data.message) {
                    errorMessage = data.message;
                  }

                  console.error("Transfer failed:", errorMessage, data);

                  throw new Error(errorMessage);
                }

                // Check if this is a same-organization transfer or cross-organization transfer
                const isSameOrg =
                  data.transferType === "SAME_ORGANIZATION" || !data.blockchain;

                // Show success message
                if (isSameOrg) {
                  alert(
                    `Transfer successful!\n\n` +
                      `Type: Same Organization (Database Only)\n` +
                      `Amount: ${amountNum} USDC\n` +
                      `New Balance: ${data.database.senderNewBalance} USDC`
                  );
                } else {
                  alert(
                    `Transfer successful!\n\n` +
                      `Type: Cross Organization (Blockchain)\n` +
                      `Amount: ${amountNum} USDC\n` +
                      `Transaction Hash: ${data.blockchain.transactionHash}\n` +
                      `New Balance: ${data.database.senderNewBalance} USDC`
                  );
                }

                // Add transaction to list
                const newTx: ParsedTransfer = {
                  sender:
                    data.blockchain?.senderWalletAddress ||
                    userProfile.wallet_address ||
                    "Unknown",
                  recipient:
                    data.blockchain?.receiverWalletAddress ||
                    referenceNumber.split("_")[0] ||
                    "Unknown",
                  amount: `${amountNum} USDC`,
                  purpose: purpose || "Transfer",
                  nullifier:
                    data.blockchain?.nullifier || `same-org-${Date.now()}`,
                  timestamp: new Date(
                    data.database.timestamp ||
                      data.blockchain?.timestamp ||
                      Date.now()
                  ).getTime(),
                  txHash: data.blockchain?.transactionHash,
                };

                addTransaction(newTx);

                // Update user balance in store
                if (zkpUser) {
                  zkpUser.balance = data.database.senderNewBalance;
                  localStorage.setItem(
                    "fincube_zkp_user",
                    JSON.stringify(zkpUser)
                  );
                }

                // Trigger fraud score analysis for both sender and receiver (POST)
                // This updates the fraud scores in the backend
                console.log("Triggering fraud score analysis after transfer...");
                Promise.all([
                  fraudDetectionService.getFraudScore(zkpUser.reference_number),
                  fraudDetectionService.getFraudScore(referenceNumber)
                ]).then(() => {
                  console.log("Fraud score analysis triggered for both parties");
                }).catch((err) => {
                  console.error("Fraud score analysis failed:", err);
                  // Don't block the UI if fraud analysis fails
                });

                // Clear form
                setTransferForm({
                  referenceNumber: "",
                  amount: "",
                  purpose: "",
                });
              } catch (error: any) {
                console.error("Transfer error:", error);

                let userMessage =
                  error.message || "Transfer failed. Please try again.";

                // Provide more helpful error messages for common issues
                if (error.message?.includes("execution reverted")) {
                  userMessage =
                    "Smart contract transaction failed. Possible reasons:\n\n" +
                    "1. Insufficient blockchain wallet balance (need ETH for gas)\n" +
                    "2. Invalid ZKP proof verification\n" +
                    "3. Duplicate transaction (nullifier already used)\n" +
                    "4. Contract state issue\n\n" +
                    "Please check the backend logs for detailed error information.";
                } else if (
                  error.message?.includes("BLOCKCHAIN_TRANSFER_FAILED")
                ) {
                  userMessage =
                    "Blockchain transfer failed.\n\n" +
                    "This is usually due to:\n" +
                    "- Insufficient ETH for gas fees in sender's wallet\n" +
                    "- Invalid proof data\n" +
                    "- Contract validation failure\n\n" +
                    "Check backend logs for details.";
                }

                alert(userMessage);
              } finally {
                setIsTransferring(false);
              }
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.8rem",
              width: "100%",
            }}
          >
            <div style={{ position: "relative" }}>
              <input
                type="text"
                name="referenceNumber"
                value={transferForm.referenceNumber}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    referenceNumber: e.target.value,
                  })
                }
                placeholder="Recipient Reference Number (e.g., 0x123...abc_uuid)"
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
                  <path
                    d="M12 2l6 9-6 3-6-3 6-9z"
                    fill="#94a3b8"
                    opacity="0.95"
                  />
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
                placeholder="Purpose (Optional - e.g., Salary, Invoice, Refund)"
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
              disabled={isTransferring}
              style={{
                width: "100%",
                padding: "1rem 1.5rem",
                background: isTransferring
                  ? "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)"
                  : "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "0.75rem",
                fontWeight: 700,
                fontSize: "1.1rem",
                cursor: isTransferring ? "not-allowed" : "pointer",
                boxShadow: "0 8px 20px rgba(16, 185, 129, 0.4)",
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                opacity: isTransferring ? 0.7 : 1,
              }}
            >
              {isTransferring ? (
                <>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      position: "relative",
                      zIndex: 1,
                      animation: "spin 1s linear infinite",
                    }}
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="60"
                      strokeDashoffset="15"
                      fill="none"
                    />
                  </svg>
                  <span style={{ position: "relative", zIndex: 1 }}>
                    Processing...
                  </span>
                </>
              ) : (
                <>
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
                  <span style={{ position: "relative", zIndex: 1 }}>
                    Transfer
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column - User Info */}
        <div style={{ width: "100%" }}>
          <h2
            style={{
              margin: "0 0 1.5rem 0",
              fontSize: "1.5rem",
              fontWeight: 800,
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            Your Account
          </h2>

          {/* User Profile Card */}
          {userProfile && zkpUser && (
            <div
              style={{
                padding: "1.5rem",
                background:
                  "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)",
                backdropFilter: "blur(20px) saturate(180%)",
                borderRadius: "1rem",
                border: "2px solid rgba(16, 185, 129, 0.25)",
                boxShadow:
                  "0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                marginBottom: "1.5rem",
              }}
            >
              <h3
                style={{
                  margin: "0 0 1rem 0",
                  background: "rgba(16, 185, 129, 0.3)",
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "#10b981",
                  textShadow: "0 0 10px rgba(16, 185, 129, 0.3)",
                }}
              >
                {userProfile.first_name} {userProfile.last_name}
              </h3>
              <div style={{ fontSize: "0.9rem", lineHeight: 1.8 }}>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#10b981", fontWeight: 600 }}>
                    Balance:
                  </strong>{" "}
                  <span
                    style={{
                      color: "#10b981",
                      fontSize: "1.3rem",
                      fontWeight: 700,
                      textShadow: "0 0 10px rgba(16, 185, 129, 0.4)",
                    }}
                  >
                    {zkpUser.balance} USDC
                  </span>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#06b6d4", fontWeight: 600 }}>
                    Email:
                  </strong>{" "}
                  <span style={{ color: "#cbd5e1" }}>{userProfile.email}</span>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#06b6d4", fontWeight: 600 }}>
                    Status:
                  </strong>{" "}
                  <span
                    style={{
                      color: "#10b981",
                      background: "rgba(16, 185, 129, 0.15)",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "0.4rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      textTransform: "capitalize",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    {userProfile.status}
                  </span>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#06b6d4", fontWeight: 600 }}>
                    Trust Score:
                  </strong>{" "}
                  {trustScore.loading ? (
                    <span style={{ color: "#94a3b8" }}>Loading...</span>
                  ) : trustScore.error ? (
                    <span style={{ color: "#ef4444" }}>Unavailable</span>
                  ) : (
                    <span
                      style={{
                        color: trustScore.score < 0.3 ? "#10b981" : trustScore.score < 0.6 ? "#3b82f6" : trustScore.score < 0.8 ? "#f59e0b" : "#ef4444",
                        background: trustScore.score < 0.3 ? "rgba(16, 185, 129, 0.15)" : trustScore.score < 0.6 ? "rgba(59, 130, 246, 0.15)" : trustScore.score < 0.8 ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "0.4rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        border: trustScore.score < 0.3 ? "1px solid rgba(16, 185, 129, 0.3)" : trustScore.score < 0.6 ? "1px solid rgba(59, 130, 246, 0.3)" : trustScore.score < 0.8 ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                      }}
                      title={`Last Result: ${trustScore.last_result}`}
                    >
                      {trustScore.score < 0.3 ? "✅ Low Risk" : trustScore.score < 0.6 ? "ℹ️ Moderate Risk" : trustScore.score < 0.8 ? "⚠️ High Risk" : "🚨 User Untrusted"} ({(trustScore.score * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reference Number Card */}
          {zkpUser && (
            <div
              style={{
                padding: "1.5rem",
                background:
                  "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)",
                backdropFilter: "blur(20px) saturate(180%)",
                borderRadius: "1rem",
                border: "2px solid rgba(6, 182, 212, 0.25)",
                boxShadow:
                  "0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 1rem 0",
                  background: "rgba(6, 182, 212, 0.3)",
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "#06b6d4",
                  textShadow: "0 0 10px rgba(6, 182, 212, 0.3)",
                }}
              >
                Your Reference Number
              </h3>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#94a3b8",
                  marginBottom: "0.75rem",
                }}
              >
                Share this with others to receive transfers
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    color: "#06b6d4",
                    background: "rgba(6, 182, 212, 0.1)",
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid rgba(6, 182, 212, 0.2)",
                    wordBreak: "break-all",
                    lineHeight: 1.4,
                  }}
                >
                  {zkpUser.reference_number}
                </div>
                <button
                  onClick={() => copyToClipboard(zkpUser.reference_number)}
                  style={{
                    padding: "0.75rem",
                    background: isCopied
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(6, 182, 212, 0.2)",
                    border: isCopied
                      ? "1px solid rgba(16, 185, 129, 0.3)"
                      : "1px solid rgba(6, 182, 212, 0.3)",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (!isCopied) {
                      e.currentTarget.style.background =
                        "rgba(6, 182, 212, 0.3)";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCopied) {
                      e.currentTarget.style.background =
                        "rgba(6, 182, 212, 0.2)";
                      e.currentTarget.style.transform = "scale(1)";
                    }
                  }}
                  title={isCopied ? "Copied!" : "Copy to clipboard"}
                >
                  {isCopied ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Blockchain Transfers */}
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
            Recent Blockchain Transfers
          </h3>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <button
              type="button"
              onClick={refreshTransactions}
              title="Refresh transactions"
              disabled={isRefreshing}
              style={{
                background: "rgba(16, 185, 129, 0.2)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "0.5rem",
                borderRadius: "0.5rem",
                cursor: isRefreshing ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                opacity: isRefreshing ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.background = "rgba(16, 185, 129, 0.3)";
                  e.currentTarget.style.transform = "scale(1.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.background = "rgba(16, 185, 129, 0.2)";
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: isRefreshing ? "spin 1s linear infinite" : "none",
                }}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                const FINCUBE_ADDRESS =
                  "0x8a263DcEfee44B9Abe968C1B18e370f6A0A5F878";
                window.open(
                  `https://celo-sepolia.blockscout.com/address/${FINCUBE_ADDRESS}`,
                  "_blank",
                  "noopener"
                );
              }}
              title="View latest transaction on Blockscout (Celo Sepolia)"
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

    // Shorten reference number for display (show first 10 and last 10 characters)
    const shortenRefNumber = (refNum: string): string => {
      if (refNum.length > 25) {
        return `${refNum.slice(0, 10)}...${refNum.slice(-10)}`;
      }
      return refNum;
    };

    const blockExplorerIcon =
      '<svg width="14" height="14" viewBox="0 0 293.775 293.667" xmlns="http://www.w3.org/2000/svg"><g fill="#21325b"><path d="M146.8 0C65.777 0 0 65.777 0 146.834 0 227.86 65.777 293.667 146.8 293.667c81.056 0 146.833-65.808 146.833-146.833C293.633 65.777 227.856 0 146.8 0zm-3.177 238.832c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm58.63-82.585c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm-117.26 0c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124z"/></g></svg>';

    return page.map((tx, index) => {
      const FINCUBE_ADDRESS = "0x8a263DcEfee44B9Abe968C1B18e370f6A0A5F878";

      const rawCandidate = tx.txHash || "";
      const match = String(rawCandidate).match(/0x[a-fA-F0-9]{64}/);
      const txHashForUrl = match ? match[0] : undefined;
      const txUrl = txHashForUrl
        ? `https://celo-sepolia.blockscout.com/tx/${txHashForUrl}?tab=index`
        : `https://celo-sepolia.blockscout.com/address/${FINCUBE_ADDRESS}`;

      // Parse memo to display essential info
      let senderWallet = "N/A";
      let receiverWallet = "N/A";
      let memoTimestamp = "N/A";
      
      if (tx.memo) {
        try {
          // Convert hex to string if needed
          let memoString = tx.memo;
          if (memoString.startsWith("0x")) {
            try {
              const bytes = [];
              for (let i = 2; i < memoString.length; i += 2) {
                bytes.push(parseInt(memoString.substr(i, 2), 16));
              }
              memoString = new TextDecoder().decode(new Uint8Array(bytes));
            } catch (e) {
              console.log("Hex conversion failed, using raw memo");
            }
          }
          
          // Parse JSON memo
          const memoData = JSON.parse(memoString);
          senderWallet = memoData?.sender_wallet_address || "N/A";
          receiverWallet = memoData?.receiver_wallet_address || "N/A";
          
          // Format timestamp
          if (memoData?.timestamp) {
            const date = new Date(memoData.timestamp);
            memoTimestamp = date.toLocaleString();
          }
        } catch (e) {
          console.log("Failed to parse memo:", e);
        }
      }

      // Shorten wallet addresses for display
      const shortenWallet = (addr: string): string => {
        if (addr === "N/A" || addr.length < 10) return addr;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      };

      return (
        <div key={`${tx.txHash || ""}-${index}`} className="transaction-row">
          <div className="tx-address" title={tx.sender}>{shortenRefNumber(tx.sender)}</div>
          <div className="tx-address" title={tx.recipient}>{shortenRefNumber(tx.recipient)}</div>
          <div className="tx-amount">{tx.amount}</div>
          <div className="tx-memo">
            <div
              style={{ 
                fontSize: "0.75em", 
                lineHeight: 1.4, 
                color: "#6b7280"
              }}
            >
              <div>
                <span style={{ color: "#10b981", fontWeight: 600 }}>From:</span>{" "}
                <span title={senderWallet}>{shortenWallet(senderWallet)}</span>
              </div>
              <div>
                <span style={{ color: "#10b981", fontWeight: 600 }}>To:</span>{" "}
                <span title={receiverWallet}>{shortenWallet(receiverWallet)}</span>
              </div>
              <div>
                <span style={{ color: "#10b981", fontWeight: 600 }}>Time:</span>{" "}
                {memoTimestamp}
              </div>
            </div>
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
              title="View on Blockscout (Celo Sepolia)"
              dangerouslySetInnerHTML={{ __html: blockExplorerIcon }}
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
