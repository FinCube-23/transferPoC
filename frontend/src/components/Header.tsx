import React from "react";

interface HeaderProps {
  isSignedIn: boolean;
  onSignInClick: () => void;
  onSignOutClick: () => void;
}

const Header: React.FC<HeaderProps> = ({
  isSignedIn,
  onSignInClick,
  onSignOutClick,
}) => {
  return (
    <header
      className={`app-header ${!isSignedIn ? "signin-hide" : ""}`}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        padding: "0.5rem 1.5rem",
        boxSizing: "border-box",
        marginBottom: "0.25rem",
        borderBottom: "none",
      }}
    >
      {/* Left: FinCube Logo and Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div
          className="app-title"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <div
            className="app-logo"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <div
              className="app-logo-icon"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2.2rem",
                height: "2.2rem",
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                borderRadius: "50%",
                padding: "0.5rem",
                boxShadow: "0 8px 20px rgba(16, 185, 129, 0.25)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <h1
              className="gradient-text"
              style={{
                fontSize: "1.8rem",
                margin: 0,
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              FinCube
            </h1>
          </div>
        </div>
      </div>

      {/* Right: Sign In / Sign Out Button */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        {!isSignedIn ? (
          <button
            id="sign-in-top"
            onClick={onSignInClick}
            style={{
              padding: "0.6rem 1.2rem",
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "0.6rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
            }}
          >
            Sign In
          </button>
        ) : (
          <button
            id="sign-out"
            onClick={onSignOutClick}
            style={{
              padding: "0.5rem 1rem",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#dc2626";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ef4444";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
