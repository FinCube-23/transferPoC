import React, { useState } from "react";
import QRCode from "react-qr-code";

interface QRCodeModalProps {
  isVisible: boolean;
  referenceNumber: string;
  onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isVisible,
  referenceNumber,
  onClose,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referenceNumber).then(
      () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      },
      (err) => {
        console.error("Failed to copy:", err);
      }
    );
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
          borderRadius: "1rem",
          padding: "2rem",
          maxWidth: "400px",
          width: "100%",
          border: "2px solid rgba(6, 182, 212, 0.3)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h3
            style={{
              background:"rgba(6, 182, 212, 0.2)",              
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#06b6d4",
            }}
          >
            Your Reference QR Code
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#cbd5e1")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "1.5rem",
            borderRadius: "0.75rem",
            display: "flex",
            justifyContent: "center",
            marginBottom: "1rem",
          }}
        >
          <QRCode
            value={referenceNumber}
            size={256}
            level="H"
            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          />
        </div>

        <p
          style={{
            margin: "0 0 1rem 0",
            fontSize: "0.875rem",
            color: "#94a3b8",
            textAlign: "center",
          }}
        >
          Scan this QR code to get your reference number
        </p>

        <div
          onClick={handleCopy}
          title={isCopied ? "Copied!" : "Click to copy"}
          style={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            color: "#06b6d4",
            background: isCopied ? "rgba(16, 185, 129, 0.1)" : "rgba(6, 182, 212, 0.1)",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: isCopied ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(6, 182, 212, 0.2)",
            wordBreak: "break-all",
            lineHeight: 1.4,
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
          }}
          onMouseEnter={(e) => {
            if (!isCopied) {
              e.currentTarget.style.background = "rgba(6, 182, 212, 0.2)";
              e.currentTarget.style.transform = "scale(1.02)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isCopied) {
              e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)";
              e.currentTarget.style.transform = "scale(1)";
            }
          }}
        >
          {isCopied ? "✓ Copied!" : referenceNumber}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
