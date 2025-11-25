import { create } from "zustand";
import type { UserProfile, ZKPUser } from "../services/authService";

interface AuthState {
  // State
  isSignedIn: boolean;
  loading: boolean;
  loadingText: string;
  userProfile: UserProfile | null;
  zkpUser: ZKPUser | null;

  // Actions
  signIn: (userProfile: UserProfile, zkpUser: ZKPUser) => void;
  signOut: () => void;
  setLoading: (loading: boolean, text?: string) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const store: AuthState = {
    // Initial state
    isSignedIn: false,
    loading: false,
    loadingText: "",
    userProfile: null,
    zkpUser: null,

    // Sign in action with user data
    signIn: (userProfile: UserProfile, zkpUser: ZKPUser) => {
      try {
        localStorage.setItem("fincube_auth", "true");
        set({
          isSignedIn: true,
          userProfile,
          zkpUser,
        });
      } catch (error) {
        console.error("Error during sign in:", error);
      }
    },

    // Sign out action with cleanup
    signOut: () => {
      try {
        // Set loading state
        set({ loading: true, loadingText: "Signing out..." });

        // Delay for 600ms before cleanup
        setTimeout(() => {
          try {
            // Remove auth data from localStorage
            localStorage.removeItem("fincube_auth");
            localStorage.removeItem("fincube_access_token");
            localStorage.removeItem("fincube_refresh_token");
            localStorage.removeItem("fincube_user_profile");
            localStorage.removeItem("fincube_zkp_user");

            // Update state
            set({
              isSignedIn: false,
              loading: false,
              loadingText: "",
              userProfile: null,
              zkpUser: null,
            });
          } catch (error) {
            console.error("Error during sign out cleanup:", error);
            // Reset loading state even if cleanup fails
            set({ loading: false, loadingText: "" });
          }
        }, 600);
      } catch (error) {
        console.error("Error during sign out:", error);
        set({ loading: false, loadingText: "" });
      }
    },

    // Set loading state action
    setLoading: (loading: boolean, text: string = "") => {
      set({ loading, loadingText: text });
    },

    // Initialize action to restore state from localStorage
    initialize: () => {
      try {
        const authExists = localStorage.getItem("fincube_auth");
        const userProfileStr = localStorage.getItem("fincube_user_profile");
        const zkpUserStr = localStorage.getItem("fincube_zkp_user");

        if (authExists && userProfileStr && zkpUserStr) {
          const userProfile = JSON.parse(userProfileStr);
          const zkpUser = JSON.parse(zkpUserStr);

          set({
            isSignedIn: true,
            userProfile,
            zkpUser,
          });
        }
      } catch (error) {
        console.error("Error during auth initialization:", error);
      }
    },
  };

  return store;
});
