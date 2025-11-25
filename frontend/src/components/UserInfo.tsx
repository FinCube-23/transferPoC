import React from "react";
import { useAuthStore } from "../stores/authStore";

const UserInfo: React.FC = () => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const zkpUser = useAuthStore((state) => state.zkpUser);

  if (!userProfile || !zkpUser) {
    return null;
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        width: "100%",
        margin: "1.5rem auto 0",
        padding: "1.75rem",
        background:
          "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderRadius: "1.2rem",
        border: "2px solid rgba(16, 185, 129, 0.3)",
        boxShadow:
          "0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)",
          pointerEvents: "none",
          borderRadius: "1.2rem",
        }}
      />

      <h2
        style={{
          margin: "0 0 1.5rem 0",
          fontSize: "1.75rem",
          fontWeight: 800,
          background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          letterSpacing: "-0.02em",
          position: "relative",
          textShadow: "0 0 30px rgba(16, 185, 129, 0.3)",
        }}
      >
        Welcome, {userProfile.first_name} {userProfile.last_name}!
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
          position: "relative",
        }}
      >
        {/* User Profile Info */}
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
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-5px) scale(1.02)";
            e.currentTarget.style.boxShadow =
              "0 15px 40px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow =
              "0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
          }}
        >
          {/* Card gradient overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, transparent 100%)",
              pointerEvents: "none",
              borderRadius: "1rem",
            }}
          />

          <h3
            style={{
              margin: "0 0 1rem 0",
              fontSize: "1.15rem",
              fontWeight: 700,
              color: "#f0fdf4",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              position: "relative",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="#10b981" strokeWidth="2" />
              <path
                d="M4 20c0-4 3.5-7 8-7s8 3 8 7"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Profile Information
          </h3>
          <div
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.8,
              position: "relative",
            }}
          >
            <div style={{ marginBottom: "0.5rem" }}>
              <strong style={{ color: "#10b981", fontWeight: 600 }}>
                Email:
              </strong>{" "}
              <span style={{ color: "#cbd5e1" }}>{userProfile.email}</span>
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong style={{ color: "#10b981", fontWeight: 600 }}>
                Contact:
              </strong>{" "}
              <span style={{ color: "#cbd5e1" }}>
                {userProfile.contact_number}
              </span>
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong style={{ color: "#10b981", fontWeight: 600 }}>
                User ID:
              </strong>{" "}
              <span style={{ color: "#cbd5e1", fontFamily: "monospace" }}>
                {userProfile.id}
              </span>
            </div>
            <div>
              <strong style={{ color: "#10b981", fontWeight: 600 }}>
                Status:
              </strong>{" "}
              <span
                style={{
                  color: "#10b981",
                  background: "rgba(16, 185, 129, 0.15)",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  boxShadow: "0 0 10px rgba(16, 185, 129, 0.2)",
                }}
              >
                {userProfile.status}
              </span>
            </div>
          </div>
        </div>

        {/* ZKP Account Info */}
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
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-5px) scale(1.02)";
            e.currentTarget.style.boxShadow =
              "0 15px 40px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow =
              "0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
          }}
        >
          {/* Card gradient overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, transparent 100%)",
              pointerEvents: "none",
              borderRadius: "1rem",
            }}
          />

          <h3
            style={{
              margin: "0 0 1rem 0",
              fontSize: "1.15rem",
              fontWeight: 700,
              color: "#f0fdf4",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              position: "relative",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="6"
                width="18"
                height="12"
                rx="2"
                stroke="#06b6d4"
                strokeWidth="2"
              />
              <path d="M3 10h18" stroke="#06b6d4" strokeWidth="2" />
              <circle cx="7" cy="14" r="1" fill="#06b6d4" />
            </svg>
            Account Details
          </h3>
          <div
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.8,
              position: "relative",
            }}
          >
            <div style={{ marginBottom: "0.5rem" }}>
              <strong style={{ color: "#06b6d4", fontWeight: 600 }}>
                Balance:
              </strong>{" "}
              <span
                style={{
                  color: "#10b981",
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  textShadow: "0 0 10px rgba(16, 185, 129, 0.4)",
                }}
              >
                {zkpUser.balance} USDC
              </span>
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong style={{ color: "#06b6d4", fontWeight: 600 }}>
                ZKP Key:
              </strong>{" "}
              <span style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>
                {zkpUser.zkp_key}
              </span>
            </div>
            <div>
              <strong style={{ color: "#06b6d4", fontWeight: 600 }}>
                Wallet:
              </strong>{" "}
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  color: "#cbd5e1",
                  background: "rgba(6, 182, 212, 0.1)",
                  padding: "0.4rem 0.6rem",
                  borderRadius: "0.5rem",
                  display: "inline-block",
                  marginTop: "0.25rem",
                  border: "1px solid rgba(6, 182, 212, 0.2)",
                  boxShadow: "0 0 10px rgba(6, 182, 212, 0.15)",
                }}
              >
                {zkpUser.organization.wallet_address.slice(0, 10)}...
                {zkpUser.organization.wallet_address.slice(-8)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;
