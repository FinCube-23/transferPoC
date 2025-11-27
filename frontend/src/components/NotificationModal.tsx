import React from "react";

interface NotificationModalProps {
  isVisible: boolean;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  onClose: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  isVisible,
  type,
  title,
  message,
  onClose,
}) => {
  if (!isVisible) return null;

  const getColors = () => {
    switch (type) {
      case "success":
        return {
          bg: "rgba(16, 185, 129, 0.1)",
          border: "rgba(16, 185, 129, 0.3)",
          icon: "#10b981",
          gradient: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
        };
      case "error":
        return {
          bg: "rgba(239, 68, 68, 0.1)",
          border: "rgba(239, 68, 68, 0.3)",
          icon: "#ef4444",
          gradient: "linear-gradient(135deg, #ef4444 0%, #f87171 100%)",
        };
      case "warning":
        return {
          bg: "rgba(245, 158, 11, 0.1)",
          border: "rgba(245, 158, 11, 0.3)",
          icon: "#f59e0b",
          gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        };
      case "info":
        return {
          bg: "rgba(59, 130, 246, 0.1)",
          border: "rgba(59, 130, 246, 0.3)",
          icon: "#3b82f6",
          gradient: "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
        };
    }
  };

  const colors = getColors();

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.icon}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case "error":
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.icon}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      case "warning":
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.icon}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case "info":
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.icon}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "400px",
          background:
            "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderRadius: "0.75rem",
          border: `2px solid ${colors.border}`,
          boxShadow:
            "0 20px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          padding: "1.5rem",
          animation: "slideIn 0.2s ease-out",
        }}
      >
        {/* Icon and Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: colors.bg,
              border: `2px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {getIcon()}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 700,
              background: colors.gradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {title}
          </h3>
        </div>

        {/* Message */}
        <p
          style={{
            margin: "0 0 1.25rem 0",
            fontSize: "0.9rem",
            color: "#cbd5e1",
            lineHeight: 1.6,
            whiteSpace: "pre-line",
          }}
        >
          {message}
        </p>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "0.7rem 1rem",
            background: colors.gradient,
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: `0 4px 12px ${colors.border}`,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 6px 16px ${colors.border}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = `0 4px 12px ${colors.border}`;
          }}
        >
          OK
        </button>
      </div>

      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};

export default NotificationModal;
