# Implementation Plan

- [ ] 1. Install Zustand and setup project structure
  - Install zustand package via npm
  - Create `frontend/src/stores` directory for store files
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement Auth Store






  - [x] 2.1 Create authStore.ts with complete implementation

    - Define `AuthState` interface with state properties (isSignedIn, loading, loadingText)
    - Implement `signIn` action with localStorage persistence
    - Implement `signOut` action with 600ms delay and cleanup
    - Implement `setLoading` action for loading state updates
    - Implement `initialize` action to restore state from localStorage
    - Add `window.authSetSignedIn` for backward compatibility
    - Call `initialize()` during store creation
    - _Requirements: 1.1, 1.3, 1.4, 4.1, 4.2, 4.3, 4.5, 6.1, 6.2_

- [x] 3. Implement Wallet Store




  - [x] 3.1 Create walletStore.ts with complete implementation


    - Define `WalletBalances` and `WalletState` interfaces
    - Implement `connect` action with MetaMask integration and localStorage persistence
    - Implement `disconnect` action with confirmation dialog
    - Implement `updateBalances` action with ETH, USDC, and USD fetching
    - Implement `setAccount`, `setConnected`, `setBalances` helper actions
    - Implement `initialize` action to restore connection from localStorage
    - Implement `setupEventListeners` action for MetaMask events (accountsChanged, chainChanged)
    - Return cleanup function from setupEventListeners
    - _Requirements: 1.2, 1.3, 1.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2_

- [x] 4. Create store initialization hook





  - Create `frontend/src/hooks/useStoreInitialization.ts`
  - Call auth store initialize method
  - Call wallet store initialize method
  - Setup wallet event listeners with cleanup
  - _Requirements: 4.3, 5.5_

- [x] 5. Refactor App.tsx component





  - Remove AuthProvider and WalletProvider wrapper components
  - Add useStoreInitialization hook call in App component
  - Replace useAuthContext with useAuthStore in AppContent
  - Use selective subscriptions for isSignedIn, loading, loadingText
  - Use selective subscriptions for signIn and signOut actions
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.1, 7.2_

- [x] 6. Refactor Header.tsx component





  - Replace useWalletContext with useWalletStore
  - Use selective subscription for isConnected and currentAccount
  - Use selective subscription for connect and disconnect actions
  - _Requirements: 2.1, 2.2, 2.4, 2.5, 7.4_

- [x] 7. Refactor Dashboard.tsx component





  - Replace useWalletContext with useWalletStore
  - Use selective subscription for isConnected and currentAccount
  - Use selective subscription for balances
  - Use selective subscription for updateBalances action
  - _Requirements: 2.1, 2.2, 2.4, 2.5, 7.1_

- [x] 8. Remove legacy Context code





  - Delete `frontend/src/contexts/AuthContext.tsx`
  - Delete `frontend/src/contexts/WalletContext.tsx`
  - Delete or update `frontend/src/contexts/index.ts`
  - Delete `frontend/src/hooks/useAuth.ts`
  - Delete `frontend/src/hooks/useWallet.ts`
  - Update `frontend/src/hooks/index.ts` to remove deleted exports
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Verify and test the migration






  - Run TypeScript compiler to check for type errors
  - Start development server and verify application loads
  - Test sign in flow and verify Dashboard renders
  - Test sign out flow and verify SignInLanding renders
  - Test wallet connect flow and verify address displays
  - Test wallet disconnect flow and verify state clears
  - Test balance updates after wallet connection
  - Test MetaMask account change handling
  - Verify localStorage persistence on page refresh
  - Check browser console for errors
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 7.1, 7.2, 7.3, 7.4, 7.5_
