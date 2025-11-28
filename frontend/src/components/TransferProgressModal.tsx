import React from "react";

interface TransferProgressModalProps {
  currentStep: number;
  isVisible: boolean;
  status: "processing" | "success" | "error";
  errorMessage?: string;
  successMessage?: string;
  onClose?: () => void;
}

const STEPS = [
  "Validate Input",
  "Retrieve User Data",
  "Generate ZKP Proof (receiver membership)",
  "Generate Nullifier (unique tx ID)",
  "Create Memo (transfer metadata)",
  "Execute Blockchain Transfer",
  "Update Database",
];

const TransferProgressModal: React.FC<TransferProgressModalProps> = ({
  currentStep,
  isVisible,
  status,
  errorMessage,
  successMessage,
  onClose,
}) => {
  if (!isVisible) return null;

  const isProcessing = status === "processing";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
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
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "1rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "480px",
            background:
              "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
            backdropFilter: "blur(20px) saturate(180%)",
            borderRadius: "1rem",
            border: "2px solid rgba(16, 185, 129, 0.3)",
            boxShadow:
              "0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            padding: "1.5rem",
          }}
        >
          {/* Header */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "1.25rem",
            }}
          >
            {isProcessing && (
              <div
                style={{
                  display: "inline-block",
                  width: "48px",
                  height: "48px",
                  border: "3px solid rgba(16, 185, 129, 0.2)",
                  borderTopColor: "#10b981",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  marginBottom: "0.75rem",
                }}
              />
            )}
            {isSuccess && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "3px solid #10b981",
                  marginBottom: "0.75rem",
                  margin: "0 auto 0.75rem",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
            {isError && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "3px solid #ef4444",
                  marginBottom: "0.75rem",
                  margin: "0 auto 0.75rem",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            )}
            <h2
              style={{
                borderRadius: "0.75rem",
                margin: "0 0 0.35rem 0",
                fontSize: "1.25rem",
                fontWeight: 800,
                background: isError
                  ? "linear-gradient(135deg, #ef4444 0%, #f87171 100%)"
                  : "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                letterSpacing: "-0.02em",
              }}
            >
              {isProcessing && "Processing Transfer"}
              {isSuccess && "Transfer Successful"}
              {isError && "Transfer Failed"}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "#94a3b8",
              }}
            >
              {isProcessing && "Please wait while we process your transaction"}
              {isSuccess &&
                (successMessage ||
                  "Your transfer has been completed successfully")}
              {isError &&
                (errorMessage || "An error occurred during the transfer")}
            </p>
          </div>

          {/* Progress Steps - Only show during processing */}
          {isProcessing && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {STEPS.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = stepNumber < currentStep;
                const isCurrent = stepNumber === currentStep;

                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.6rem 0.85rem",
                      background: isCurrent
                        ? "rgba(16, 185, 129, 0.1)"
                        : isCompleted
                        ? "rgba(6, 182, 212, 0.05)"
                        : "rgba(30, 41, 59, 0.5)",
                      border: isCurrent
                        ? "1px solid rgba(16, 185, 129, 0.3)"
                        : isCompleted
                        ? "1px solid rgba(6, 182, 212, 0.2)"
                        : "1px solid rgba(71, 85, 105, 0.3)",
                      borderRadius: "0.5rem",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {/* Step Icon */}
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        background: isCompleted
                          ? "rgba(16, 185, 129, 0.2)"
                          : isCurrent
                          ? "rgba(16, 185, 129, 0.3)"
                          : "rgba(71, 85, 105, 0.3)",
                        border: isCompleted
                          ? "2px solid #10b981"
                          : isCurrent
                          ? "2px solid #10b981"
                          : "2px solid #475569",
                      }}
                    >
                      {isCompleted ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : isCurrent ? (
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "#10b981",
                            animation: "pulse 1.5s ease-in-out infinite",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "#64748b",
                          }}
                        >
                          {stepNumber}
                        </span>
                      )}
                    </div>

                    {/* Step Text */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color: isCompleted
                            ? "#10b981"
                            : isCurrent
                            ? "#06b6d4"
                            : "#94a3b8",
                          marginBottom: "0.1rem",
                        }}
                      >
                        STEP {stepNumber}/{STEPS.length}
                      </div>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: isCompleted
                            ? "#cbd5e1"
                            : isCurrent
                            ? "#e2e8f0"
                            : "#64748b",
                        }}
                      >
                        {step}
                      </div>
                    </div>

                    {/* Status Indicator */}
                    {isCurrent && (
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          border: "2px solid rgba(16, 185, 129, 0.3)",
                          borderTopColor: "#10b981",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                    )}
                  </div>
                );
              })}

              {/* Progress Bar */}
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0 0.5rem",
                }}
              >
                <div
                  style={{
                    height: "5px",
                    background: "rgba(71, 85, 105, 0.3)",
                    borderRadius: "2.5px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background:
                        "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                      borderRadius: "2.5px",
                      width: `${(currentStep / STEPS.length) * 100}%`,
                      transition: "width 0.3s ease",
                      boxShadow: "0 0 10px rgba(16, 185, 129, 0.5)",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: "0.4rem",
                    textAlign: "center",
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                  }}
                >
                  {Math.round((currentStep / STEPS.length) * 100)}% Complete
                </div>
              </div>
            </div>
          )}

          {/* Close Button for Success/Error */}
          {(isSuccess || isError) && onClose && (
            <button
              onClick={onClose}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                background: isSuccess
                  ? "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)"
                  : "linear-gradient(135deg, #ef4444 0%, #f87171 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                boxShadow: isSuccess
                  ? "0 4px 12px rgba(16, 185, 129, 0.4)"
                  : "0 4px 12px rgba(239, 68, 68, 0.4)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = isSuccess
                  ? "0 6px 16px rgba(16, 185, 129, 0.5)"
                  : "0 6px 16px rgba(239, 68, 68, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = isSuccess
                  ? "0 4px 12px rgba(16, 185, 129, 0.4)"
                  : "0 4px 12px rgba(239, 68, 68, 0.4)";
              }}
            >
              {isSuccess ? "Continue" : "Close"}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default TransferProgressModal;
