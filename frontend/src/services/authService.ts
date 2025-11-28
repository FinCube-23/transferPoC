/**
 * Authentication Service
 * Handles authentication with the Docker backend API
 */

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  first_name: string;
  last_name: string;
  contact_number: string;
  password: string;
  password_confirm: string;
}

interface AuthTokens {
  refresh: string;
  access: string;
}

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  contact_number: string;
  wallet_address: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_verified_email: boolean;
  is_verified_contact_number: boolean;
  status: string;
  date_joined: string;
  updated_at: string;
  organizations: string[];
}

interface ZKPUser {
  _id: string;
  user_id: number;
  batch_id: {
    _id: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
  };
  balance: number;
  reference_number: string;
  zkp_key: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
  organization: {
    _id: string;
    org_id: number;
    wallet_address: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
  };
}

interface AuthResponse {
  success: boolean;
  tokens?: AuthTokens;
  userProfile?: UserProfile;
  zkpUser?: ZKPUser;
  message?: string;
}

class AuthService {
  private userManagementUrl: string;
  private zkpApiUrl: string;

  constructor() {
    // User management service (port 3000)
    this.userManagementUrl =
      import.meta.env.VITE_USER_MANAGEMENT_URL || "http://localhost:3001";
    // ZKP query service (port 7000)
    this.zkpApiUrl =
      import.meta.env.VITE_ZKP_API_URL || "http://localhost:7000";
  }

  /**
   * Login with email and password (for registration flow - skips ZKP)
   * Only fetches tokens and profile, not ZKP data
   */
  async loginForRegistration(
    credentials: LoginCredentials
  ): Promise<AuthResponse> {
    try {
      // Step 1: Login and get tokens
      const loginResponse = await fetch(
        `${this.userManagementUrl}/api/users/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        }
      );

      const loginData = await loginResponse.json();

      if (!loginResponse.ok || loginData.status !== "success") {
        throw new Error(loginData.message || "Login failed");
      }

      const tokens = loginData.tokens;

      // Store tokens
      localStorage.setItem("fincube_access_token", tokens.access);
      localStorage.setItem("fincube_refresh_token", tokens.refresh);

      // Step 2: Fetch user profile using access token
      const profileResponse = await fetch(
        `${this.userManagementUrl}/api/users/profile`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const userProfile: UserProfile = await profileResponse.json();

      // Store user profile
      localStorage.setItem("fincube_user_profile", JSON.stringify(userProfile));

      // Return without ZKP data (will be fetched after org selection)
      return {
        success: true,
        tokens,
        userProfile,
        message: "Login successful",
      };
    } catch (error: any) {
      console.error("Login error:", error);

      // Clean up any partial data
      this.clearStoredData();

      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error(
          "Cannot connect to authentication service. Please ensure the services are running."
        );
      }

      throw new Error(error.message || "Failed to authenticate");
    }
  }

  /**
   * Login with email and password
   * Endpoint: POST /user-management-service/api/users/login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Step 1: Login and get tokens
      const loginResponse = await fetch(
        `${this.userManagementUrl}/api/users/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        }
      );

      const loginData = await loginResponse.json();

      if (!loginResponse.ok || loginData.status !== "success") {
        throw new Error(loginData.message || "Login failed");
      }

      const tokens = loginData.tokens;

      // Store tokens
      localStorage.setItem("fincube_access_token", tokens.access);
      localStorage.setItem("fincube_refresh_token", tokens.refresh);

      // Step 2: Fetch user profile using access token
      const profileResponse = await fetch(
        `${this.userManagementUrl}/api/users/profile`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const userProfile: UserProfile = await profileResponse.json();

      // Step 3: Fetch ZKP user data using user ID
      const zkpResponse = await fetch(
        `${this.zkpApiUrl}/api/query/user/${userProfile.id}`,
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

      const zkpUser: ZKPUser = zkpData.user;

      // Store user data
      localStorage.setItem("fincube_user_profile", JSON.stringify(userProfile));
      localStorage.setItem("fincube_zkp_user", JSON.stringify(zkpUser));

      return {
        success: true,
        tokens,
        userProfile,
        zkpUser,
        message: "Login successful",
      };
    } catch (error: any) {
      console.error("Login error:", error);

      // Clean up any partial data
      this.clearStoredData();

      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error(
          "Cannot connect to authentication service. Please ensure the services are running."
        );
      }

      throw new Error(error.message || "Failed to authenticate");
    }
  }

  /**
   * Register a new user
   * Endpoint: POST /user-management-service/api/users/registration
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(
        `${this.userManagementUrl}/api/users/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
            contact_number: data.contact_number,
            password: data.password,
            password_confirm: data.password_confirm,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        // Extract clean error message from the response
        let errorMessage = "Registration failed";

        if (result.message) {
          // Parse error message like: "{'contact_number': [ErrorDetail(string='User with this Phone Number already exists.', code='unique')]}"
          const messageStr = result.message;

          // Try to extract the string value from ErrorDetail
          const stringMatch = messageStr.match(/string='([^']+)'/);
          if (stringMatch && stringMatch[1]) {
            errorMessage = stringMatch[1];
          } else {
            // If no ErrorDetail format, try to extract from simple dict format
            const simpleMatch = messageStr.match(/:\s*\[['"]([^'"]+)['"]\]/);
            if (simpleMatch && simpleMatch[1]) {
              errorMessage = simpleMatch[1];
            } else {
              // Fallback to the raw message
              errorMessage = messageStr;
            }
          }
        } else if (result.error) {
          errorMessage = result.error;
        }

        throw new Error(errorMessage);
      }

      return {
        success: true,
        message: result.message || "Registration successful",
      };
    } catch (error: any) {
      console.error("Registration error:", error);

      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error(
          "Cannot connect to authentication service. Please ensure the service is running."
        );
      }

      throw new Error(error.message || "Failed to register");
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = localStorage.getItem("fincube_refresh_token");
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(
        `${this.userManagementUrl}/user-management-service/api/users/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh: refreshToken,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      const newAccessToken = data.access;

      localStorage.setItem("fincube_access_token", newAccessToken);
      return newAccessToken;
    } catch (error) {
      console.error("Token refresh error:", error);
      this.logout();
      return null;
    }
  }

  /**
   * Logout and clear stored credentials
   */
  logout(): void {
    this.clearStoredData();
    localStorage.removeItem("fincube_auth");
  }

  /**
   * Clear all stored authentication data
   */
  private clearStoredData(): void {
    localStorage.removeItem("fincube_access_token");
    localStorage.removeItem("fincube_refresh_token");
    localStorage.removeItem("fincube_user_profile");
    localStorage.removeItem("fincube_zkp_user");
  }

  /**
   * Get stored access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem("fincube_access_token");
  }

  /**
   * Get stored refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem("fincube_refresh_token");
  }

  /**
   * Get stored user profile
   */
  getUserProfile(): UserProfile | null {
    const profile = localStorage.getItem("fincube_user_profile");
    return profile ? JSON.parse(profile) : null;
  }

  /**
   * Get stored ZKP user data
   */
  getZKPUser(): ZKPUser | null {
    const zkpUser = localStorage.getItem("fincube_zkp_user");
    return zkpUser ? JSON.parse(zkpUser) : null;
  }

  /**
   * Check if user has valid tokens
   */
  hasValidTokens(): boolean {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  }
}

export const authService = new AuthService();
export type { UserProfile, ZKPUser, AuthTokens };
