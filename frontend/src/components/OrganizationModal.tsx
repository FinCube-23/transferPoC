import React, { useState, useEffect } from "react";
import {
  organizationService,
  type Organization,
} from "../services/organizationService";

interface OrganizationModalProps {
  userId: number;
  accessToken: string;
  onSuccess: () => void;
}

const OrganizationModal: React.FC<OrganizationModalProps> = ({
  userId,
  accessToken,
  onSuccess,
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await organizationService.getOrganizations(accessToken);
      setOrganizations(response.organizations);

      // Auto-select first organization if available
      if (response.organizations.length > 0) {
        setSelectedOrgId(response.organizations[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load organizations:", err);
      setError(err.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrganization = async () => {
    if (!selectedOrgId) {
      alert("Please select an organization");
      return;
    }

    try {
      setJoining(true);
      await organizationService.joinOrganization(
        {
          user_id: userId,
          organization_id: selectedOrgId,
        },
        accessToken
      );

      alert("Successfully joined organization!");
      onSuccess();
    } catch (err: any) {
      console.error("Failed to join organization:", err);
      alert(err.message || "Failed to join organization");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "550px",
          background:
            "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderRadius: "1rem",
          border: "2px solid rgba(16, 185, 129, 0.3)",
          boxShadow:
            "0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "2px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 800,
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            Select Organization
          </h2>
          <p
            style={{
              margin: "0.5rem 0 0 0",
              fontSize: "0.9rem",
              color: "#94a3b8",
            }}
          >
            Choose an organization to join
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem" }}>
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "2rem",
                color: "#cbd5e1",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  width: "40px",
                  height: "40px",
                  border: "4px solid rgba(16, 185, 129, 0.2)",
                  borderTopColor: "#10b981",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p style={{ marginTop: "1rem", color: "#94a3b8" }}>
                Loading organizations...
              </p>
            </div>
          ) : error ? (
            <div
              style={{
                padding: "1rem",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "0.7rem",
                color: "#fca5a5",
              }}
            >
              <p style={{ margin: 0 }}>{error}</p>
              <button
                onClick={loadOrganizations}
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 1rem",
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#fca5a5",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                }}
              >
                Retry
              </button>
            </div>
          ) : organizations.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "2rem",
                color: "#94a3b8",
              }}
            >
              <p>No organizations available</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 700,
                    color: "#06b6d4",
                    fontSize: "0.95rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  Organization
                </label>
                <select
                  value={selectedOrgId || ""}
                  onChange={(e) => setSelectedOrgId(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "0.8rem 0.9rem",
                    border: "2px solid rgba(6, 182, 212, 0.3)",
                    borderRadius: "0.7rem",
                    fontSize: "1rem",
                    background: "rgba(15, 23, 42, 0.5)",
                    color: "#cbd5e1",
                    outline: "none",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                >
                  {organizations.map((org) => (
                    <option
                      key={org.id}
                      value={org.id}
                      style={{
                        background: "#1e293b",
                        color: "#cbd5e1",
                      }}
                    >
                      {org.name} - {org.type.toUpperCase()} ({org.address})
                    </option>
                  ))}
                </select>
              </div>

              {/* Organization Details */}
              {selectedOrgId && (
                <div
                  style={{
                    padding: "1.25rem",
                    background: "rgba(6, 182, 212, 0.1)",
                    border: "1px solid rgba(6, 182, 212, 0.2)",
                    borderRadius: "0.7rem",
                    marginBottom: "1rem",
                  }}
                >
                  {(() => {
                    const selectedOrg = organizations.find(
                      (org) => org.id === selectedOrgId
                    );
                    if (!selectedOrg) return null;

                    return (
                      <>
                        <h3
                          style={{
                            margin: "0 0 0.75rem 0",
                            background: "rgba(6, 182, 212, 0.3)",
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            color: "#06b6d4",
                            textShadow: "0 0 10px rgba(6, 182, 212, 0.3)",
                          }}
                        >
                          {selectedOrg.name}
                        </h3>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#cbd5e1",
                            lineHeight: 1.6,
                          }}
                        >
                          <p style={{ margin: "0.25rem 0" }}>
                            <strong style={{ color: "#94a3b8" }}>Email:</strong>{" "}
                            {selectedOrg.email}
                          </p>
                          <p style={{ margin: "0.25rem 0" }}>
                            <strong style={{ color: "#94a3b8" }}>Type:</strong>{" "}
                            {selectedOrg.type.toUpperCase()}
                          </p>
                          <p style={{ margin: "0.25rem 0" }}>
                            <strong style={{ color: "#94a3b8" }}>
                              Address:
                            </strong>{" "}
                            {selectedOrg.address}
                          </p>
                          <p style={{ margin: "0.25rem 0" }}>
                            <strong style={{ color: "#94a3b8" }}>
                              Status:
                            </strong>{" "}
                            <span
                              style={{
                                color:
                                  selectedOrg.offchain_status === "approved"
                                    ? "#10b981"
                                    : "#f59e0b",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                background:
                                  selectedOrg.offchain_status === "approved"
                                    ? "rgba(16, 185, 129, 0.15)"
                                    : "rgba(245, 158, 11, 0.15)",
                                padding: "0.15rem 0.5rem",
                                borderRadius: "0.4rem",
                                border:
                                  selectedOrg.offchain_status === "approved"
                                    ? "1px solid rgba(16, 185, 129, 0.3)"
                                    : "1px solid rgba(245, 158, 11, 0.3)",
                              }}
                            >
                              {selectedOrg.offchain_status}
                            </span>
                          </p>
                          <p style={{ margin: "0.25rem 0" }}>
                            <strong style={{ color: "#94a3b8" }}>
                              Members:
                            </strong>{" "}
                            {selectedOrg.members.length}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <button
                onClick={handleJoinOrganization}
                disabled={joining || !selectedOrgId}
                style={{
                  width: "100%",
                  padding: "1rem 1.5rem",
                  background:
                    joining || !selectedOrgId
                      ? "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)"
                      : "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.75rem",
                  fontWeight: 800,
                  fontSize: "1.05rem",
                  cursor: joining || !selectedOrgId ? "not-allowed" : "pointer",
                  boxShadow:
                    joining || !selectedOrgId
                      ? "none"
                      : "0 8px 20px rgba(16, 185, 129, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  transition: "all 0.3s ease",
                  opacity: joining || !selectedOrgId ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!joining && selectedOrgId) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 28px rgba(16, 185, 129, 0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!joining && selectedOrgId) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(16, 185, 129, 0.4)";
                  }
                }}
              >
                {joining ? (
                  <>
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        border: "3px solid #fff",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    Joining...
                  </>
                ) : (
                  <>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    Join Organization
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default OrganizationModal;
