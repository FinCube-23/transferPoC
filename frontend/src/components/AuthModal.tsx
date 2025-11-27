import React, { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { authService } from "../services/authService";
import OrganizationModal from "./OrganizationModal";

interface AuthModalProps {
  onClose: () => void;
  onAuthSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { setLoading, signIn } = useAuthStore();
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<{
    userId: number;
    accessToken: string;
  } | null>(null);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("login-email") as HTMLInputElement)
      .value;
    const password = (
      form.elements.namedItem("login-password") as HTMLInputElement
    ).value;

    // Show loading overlay
    setLoading(true, "Authenticating...");

    try {
      // Step 1: Login and get tokens
      setLoading(true, "Logging in...");
      const response = await authService.login({ email, password });

      if (response.success && response.userProfile && response.zkpUser) {
        // Step 2: Fetch user profile
        setLoading(true, "Loading profile...");

        // Step 3: Fetch ZKP user data
        setLoading(true, "Loading account data...");

        // Store user data in auth store
        signIn(response.userProfile, response.zkpUser);

        // Clear loading state before calling onAuthSuccess
        setLoading(false);

        // Show success message with user info
        console.log("Login successful:", {
          profile: response.userProfile,
          zkp: response.zkpUser,
        });

        onAuthSuccess();
      } else {
        alert(response.message || "Login failed");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Login failed", err);
      alert(
        err.message || "Authentication failed. Please check your credentials."
      );
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const firstName = (
      form.elements.namedItem("register-firstname") as HTMLInputElement
    ).value;
    const lastName = (
      form.elements.namedItem("register-lastname") as HTMLInputElement
    ).value;
    const email = (
      form.elements.namedItem("register-email") as HTMLInputElement
    ).value;
    const contactNumber = (
      form.elements.namedItem("register-contact") as HTMLInputElement
    ).value;
    const password = (
      form.elements.namedItem("register-password") as HTMLInputElement
    ).value;
    const passwordConfirm = (
      form.elements.namedItem("register-password-confirm") as HTMLInputElement
    ).value;

    // Validate passwords match
    if (password !== passwordConfirm) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true, "Creating account...");

    try {
      // Step 1: Register the user
      const registerResponse = await authService.register({
        email,
        first_name: firstName,
        last_name: lastName,
        contact_number: contactNumber,
        password,
        password_confirm: passwordConfirm,
      });

      if (registerResponse.success) {
        // Step 2: Auto-login after successful registration (without ZKP)
        setLoading(true, "Logging in...");

        const loginResponse = await authService.loginForRegistration({
          email,
          password,
        });

        if (
          loginResponse.success &&
          loginResponse.userProfile &&
          loginResponse.tokens
        ) {
          setLoading(false);

          // Store pending auth data for organization selection
          setPendingAuth({
            userId: loginResponse.userProfile.id,
            accessToken: loginResponse.tokens.access,
          });

          // Show organization selection modal
          setShowOrgModal(true);
        } else {
          alert("Registration successful but auto-login failed. Please login.");
          setActiveTab("login");
          setLoading(false);
        }
      } else {
        alert(registerResponse.message || "Registration failed");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Registration failed", err);
      alert(err.message || "Registration failed. Please try again.");
      setLoading(false);
    }
  };

  const handleOrganizationJoined = async () => {
    if (!pendingAuth) return;

    try {
      setLoading(true, "Loading account data...");

      // Fetch user profile again to get updated organization data
      const userManagementUrl =
        import.meta.env.VITE_USER_MANAGEMENT_URL || "http://localhost:3001";
      const profileResponse = await fetch(
        `${userManagementUrl}/api/users/profile`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${pendingAuth.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch updated profile");
      }

      const userProfile = await profileResponse.json();

      // Fetch ZKP user data
      const zkpApiUrl =
        import.meta.env.VITE_ZKP_API_URL || "http://localhost:7000";
      const zkpResponse = await fetch(
        `${zkpApiUrl}/api/query/user/${userProfile.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!zkpResponse.ok) {
        throw new Error("Failed to fetch ZKP user data");
      }

      const zkpData = await zkpResponse.json();

      if (!zkpData.success) {
        throw new Error("ZKP user data fetch unsuccessful");
      }

      const zkpUser = zkpData.user;

      // Store updated user data in localStorage
      localStorage.setItem("fincube_user_profile", JSON.stringify(userProfile));
      localStorage.setItem("fincube_zkp_user", JSON.stringify(zkpUser));
      localStorage.setItem("fincube_auth", "true");

      // Store user data in auth store
      signIn(userProfile, zkpUser);

      // Clear loading and modal states
      setLoading(false);
      setShowOrgModal(false);
      setPendingAuth(null);

      // Call success callback to close modal and show dashboard
      onAuthSuccess();
    } catch (err: any) {
      console.error("Failed to complete setup:", err);
      alert(err.message || "Failed to complete account setup");
      setLoading(false);
    }
  };

  return (
    <>
      {showOrgModal && pendingAuth ? (
        <OrganizationModal
          userId={pendingAuth.userId}
          accessToken={pendingAuth.accessToken}
          onSuccess={handleOrganizationJoined}
        />
      ) : (
        <div
          id="auth-modal"
          onClick={handleBackdropClick}
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
              maxWidth: "420px",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "0.9rem",
              boxShadow: "0 24px 60px rgba(2, 6, 23, 0.35)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Tabs */}
            <div
              style={{
                padding: "0.8rem 1rem 0.5rem",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                gap: "0.4rem",
              }}
            >
              <button
                onClick={() => setActiveTab("login")}
                style={{
                  flex: 1,
                  padding: "0.6rem",
                  border: "none",
                  background: activeTab === "login" ? "#ecfdf5" : "transparent",
                  color: activeTab === "login" ? "#10b981" : "#334155",
                  borderRadius: "0.6rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Login
              </button>
              <button
                onClick={() => setActiveTab("register")}
                style={{
                  flex: 1,
                  padding: "0.6rem",
                  border: "none",
                  background:
                    activeTab === "register" ? "#ecfdf5" : "transparent",
                  color: activeTab === "register" ? "#10b981" : "#334155",
                  borderRadius: "0.6rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Register
              </button>
            </div>

            <div style={{ padding: "0.8rem 1rem" }}>
              {/* Login Form */}
              {activeTab === "login" && (
                <form
                  onSubmit={handleLogin}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                    }}
                  >
                    <label
                      htmlFor="login-email"
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    >
                      Email
                    </label>
                    <input
                      id="login-email"
                      name="login-email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      style={{
                        width: "100%",
                        padding: "0.8rem 0.9rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "0.7rem",
                        fontSize: "1rem",
                        background: "#fff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                    }}
                  >
                    <label
                      htmlFor="login-password"
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    >
                      Password
                    </label>
                    <input
                      id="login-password"
                      name="login-password"
                      type="password"
                      placeholder="Your password"
                      required
                      minLength={6}
                      style={{
                        width: "100%",
                        padding: "0.8rem 0.9rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "0.7rem",
                        fontSize: "1rem",
                        background: "#fff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      marginTop: "0.2rem",
                      padding: "0.8rem 1rem",
                      background:
                        "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.7rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 10px 22px rgba(16, 185, 129, 0.35)",
                    }}
                  >
                    Sign In
                  </button>
                </form>
              )}

              {/* Register Form */}
              {activeTab === "register" && (
                <form
                  onSubmit={handleRegister}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.2rem",
                      }}
                    >
                      <label
                        style={{
                          fontWeight: 700,
                          color: "#0f172a",
                          fontSize: "0.95rem",
                        }}
                      >
                        First name
                      </label>
                      <input
                        name="register-firstname"
                        type="text"
                        placeholder="John"
                        required
                        style={{
                          width: "100%",
                          padding: "0.8rem 0.9rem",
                          border: "2px solid #e2e8f0",
                          borderRadius: "0.7rem",
                          fontSize: "1rem",
                          background: "#fff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.35rem",
                      }}
                    >
                      <label
                        style={{
                          fontWeight: 700,
                          color: "#0f172a",
                          fontSize: "0.95rem",
                        }}
                      >
                        Last name
                      </label>
                      <input
                        name="register-lastname"
                        type="text"
                        placeholder="Doe"
                        required
                        style={{
                          width: "100%",
                          padding: "0.9rem 1rem",
                          border: "2px solid #e2e8f0",
                          borderRadius: "0.7rem",
                          fontSize: "1rem",
                          background: "#fff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                    }}
                  >
                    <label
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    >
                      Email
                    </label>
                    <input
                      name="register-email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      style={{
                        width: "100%",
                        padding: "0.8rem 0.9rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "0.7rem",
                        fontSize: "1rem",
                        background: "#fff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                    }}
                  >
                    <label
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    >
                      Contact Number
                    </label>
                    <input
                      name="register-contact"
                      type="tel"
                      placeholder="+1234567890"
                      required
                      style={{
                        width: "100%",
                        padding: "0.8rem 0.9rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "0.7rem",
                        fontSize: "1rem",
                        background: "#fff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                    }}
                  >
                    <label
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    >
                      Password
                    </label>
                    <input
                      name="register-password"
                      type="password"
                      placeholder="Create a password"
                      required
                      minLength={6}
                      style={{
                        width: "100%",
                        padding: "0.8rem 0.9rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "0.7rem",
                        fontSize: "1rem",
                        background: "#fff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                    }}
                  >
                    <label
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    >
                      Confirm Password
                    </label>
                    <input
                      name="register-password-confirm"
                      type="password"
                      placeholder="Confirm your password"
                      required
                      minLength={6}
                      style={{
                        width: "100%",
                        padding: "0.8rem 0.9rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "0.7rem",
                        fontSize: "1rem",
                        background: "#fff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      marginTop: "0.2rem",
                      padding: "0.8rem 1rem",
                      background:
                        "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.7rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 10px 22px rgba(16, 185, 129, 0.35)",
                    }}
                  >
                    Sign Up
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuthModal;
