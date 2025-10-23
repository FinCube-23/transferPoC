# Design Document

## Overview

This document outlines the technical design for migrating the FinCube application from React Context API to Zustand for global state management. The migration will replace two Context providers (AuthContext and WalletContext) with two Zustand stores (authStore and walletStore), refactor all consuming components to use Zustand hooks with selective subscriptions, and remove all legacy Context code.

The design prioritizes performance optimization through selective state subscriptions, maintains backward compatibility with existing functionality, and ensures type safety throughout the migration.

## Architecture

### Current Architecture

```
App (Root)
├── AuthProvider (Context)
│   └── WalletProvider (Context)
│       └── AppContent
│           ├── Header (consumes WalletContext)
│           ├── SignInLanding
│           ├── AuthModal
│           ├── Dashboard (consumes WalletContext)
│           └── AuthLoadingOverlay
```

**Current State Flow:**
- `useAuth` hook manages auth state with React useState
- `useWallet` hook manages wallet state with React useState
- Context providers wrap state and pass down via Context
- Components consume via `useAuthContext()` and `useWalletContext()`
- Any state change triggers re-render of all Context consumers

### Target Architecture

```
App (Root)
└── AppContent
    ├── Header (subscribes to walletStore)
    ├── SignInLanding
    ├── AuthModal
    ├── Dashboard (subscribes to walletStore)
    └── AuthLoadingOverlay

Zustand Stores (Global):
├── authStore (authentication state)
└── walletStore (wallet connection state)
```

**Target State Flow:**
- Zustand stores manage state globally outside React tree
- Components subscribe directly to stores using `useAuthStore()` and `useWalletStore()`
- Components use selectors to subscribe only to needed state slices
- State changes trigger re-renders only in components subscribed to changed slices

## Components and Interfaces

### 1. Auth Store (`stores/authStore.ts`)

**State Interface:**
```typescript
interface AuthState {
  // State
  isSignedIn: boolean;
  loading: boolean;
  loadingText: string;
  
  // Actions
  signIn: () => void;
  signOut: () => void;
  setLoading: (loading: boolean, text?: string) => void;
  initialize: () => void;
}
```

**Implementation Details:**
- Use `create` from Zustand to create the store
- Implement `signIn` action:
  - Set `fincube_auth` in localStorage
  - Update `isSignedIn` to true
- Implement `signOut` action:
  - Set loading state with "Signing out..." text
  - After 600ms delay:
    - Remove `fincube_auth` from localStorage
    - Remove `fincube_address` from localStorage
    - Set `fincube_user_disconnected` flag
    - Update `isSignedIn` to false
    - Reset loading state
- Implement `setLoading` action:
  - Update `loading` and `loadingText` state
- Implement `initialize` action:
  - Check localStorage for `fincube_auth`
  - Set `isSignedIn` if auth exists
  - Expose `window.authSetSignedIn` for backward compatibility
- Call `initialize()` during store creation

**Selector Examples:**
```typescript
// Subscribe to sign-in status only
const isSignedIn = useAuthStore((state) => state.isSignedIn);

// Subscribe to loading state only
const { loading, loadingText } = useAuthStore((state) => ({
  loading: state.loading,
  loadingText: state.loadingText
}));

// Subscribe to actions only (no re-renders on state changes)
const { signIn, signOut } = useAuthStore((state) => ({
  signIn: state.signIn,
  signOut: state.signOut
}));
```

### 2. Wallet Store (`stores/walletStore.ts`)

**State Interface:**
```typescript
interface WalletBalances {
  usd: string;
  eth: string;
  usdc: string;
}

interface WalletState {
  // State
  isConnected: boolean;
  currentAccount: string | null;
  balances: WalletBalances;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  updateBalances: () => Promise<void>;
  setAccount: (account: string | null) => void;
  setConnected: (connected: boolean) => void;
  setBalances: (balances: WalletBalances) => void;
  initialize: () => Promise<void>;
  setupEventListeners: () => () => void;
}
```

**Implementation Details:**
- Use `create` from Zustand to create the store
- Implement `connect` action:
  - Call `web3Service.connect()`
  - Get accounts from `web3Service.getAccounts()`
  - Update `currentAccount` and `isConnected`
  - Save address to localStorage
  - Remove `fincube_user_disconnected` flag
  - Setup MetaMask event listeners
- Implement `disconnect` action:
  - Show confirmation dialog
  - Call `web3Service.disconnect()`
  - Reset `isConnected`, `currentAccount`, and `balances`
  - Update localStorage flags
- Implement `updateBalances` action:
  - Generate random USD value (100-1000)
  - Fetch ETH balance via `web3Service.getEthBalance()`
  - Fetch USDC balance via `web3Service.getUsdcBalance()`
  - Update `balances` state
- Implement `setAccount`, `setConnected`, `setBalances` helper actions
- Implement `initialize` action:
  - Check if user explicitly disconnected
  - Call `web3Service.restoreConnection()`
  - Update state if connection restored
- Implement `setupEventListeners` action:
  - Listen to MetaMask `accountsChanged` event
  - Listen to MetaMask `chainChanged` event
  - Return cleanup function
  - Auto-update balances when account changes

**Selector Examples:**
```typescript
// Subscribe to connection status only
const isConnected = useWalletStore((state) => state.isConnected);

// Subscribe to account and connection
const { isConnected, currentAccount } = useWalletStore((state) => ({
  isConnected: state.isConnected,
  currentAccount: state.currentAccount
}));

// Subscribe to balances only
const balances = useWalletStore((state) => state.balances);

// Subscribe to actions only
const { connect, disconnect } = useWalletStore((state) => ({
  connect: state.connect,
  disconnect: state.disconnect
}));
```

### 3. Store Initialization Hook (`hooks/useStoreInitialization.ts`)

**Purpose:** Centralize store initialization and event listener setup

**Implementation:**
```typescript
export const useStoreInitialization = () => {
  useEffect(() => {
    // Initialize auth store
    useAuthStore.getState().initialize();
    
    // Initialize wallet store
    useWalletStore.getState().initialize();
    
    // Setup wallet event listeners
    const cleanup = useWalletStore.getState().setupEventListeners();
    
    return cleanup;
  }, []);
};
```

### 4. Component Refactoring

**App.tsx:**
- Remove `AuthProvider` and `WalletProvider` wrappers
- Call `useStoreInitialization()` hook in App component
- Update `AppContent` to use `useAuthStore` instead of `useAuthContext`
- Use selective subscriptions for state

**Header.tsx:**
- Replace `useWalletContext()` with `useWalletStore()`
- Use selectors to subscribe only to needed state:
  - `isConnected`, `currentAccount` for display
  - `connect`, `disconnect` actions
- No changes to UI logic

**Dashboard.tsx:**
- Replace `useWalletContext()` with `useWalletStore()`
- Use selectors to subscribe only to needed state:
  - `isConnected`, `currentAccount` for conditional rendering
  - `balances` for display
  - `updateBalances` action for refresh
- No changes to UI logic

**AuthLoadingOverlay.tsx:**
- If it consumes auth context, replace with `useAuthStore()`
- Use selectors for `loading` and `loadingText`

## Data Models

### Auth Store State Shape

```typescript
{
  isSignedIn: boolean;        // User authentication status
  loading: boolean;           // Loading indicator state
  loadingText: string;        // Loading message text
  signIn: () => void;         // Sign in action
  signOut: () => void;        // Sign out action
  setLoading: (loading: boolean, text?: string) => void;  // Update loading state
  initialize: () => void;     // Initialize store from localStorage
}
```

### Wallet Store State Shape

```typescript
{
  isConnected: boolean;                    // Wallet connection status
  currentAccount: string | null;           // Connected wallet address
  balances: {                              // Token balances
    usd: string;                           // USD balance (demo)
    eth: string;                           // ETH balance
    usdc: string;                          // USDC balance
  };
  connect: () => Promise<void>;            // Connect wallet action
  disconnect: () => void;                  // Disconnect wallet action
  updateBalances: () => Promise<void>;     // Refresh balances action
  setAccount: (account: string | null) => void;  // Update account
  setConnected: (connected: boolean) => void;    // Update connection status
  setBalances: (balances: WalletBalances) => void;  // Update balances
  initialize: () => Promise<void>;         // Initialize from localStorage
  setupEventListeners: () => () => void;   // Setup MetaMask listeners
}
```

## Error Handling

### Store-Level Error Handling

**Auth Store:**
- Wrap localStorage operations in try-catch blocks
- Log errors to console without throwing
- Gracefully degrade if localStorage is unavailable
- Maintain `window.authSetSignedIn` for backward compatibility

**Wallet Store:**
- Catch connection errors and show user-friendly alerts
- Log balance fetch errors without breaking UI
- Handle MetaMask not installed scenario
- Validate account addresses before state updates
- Handle network change by reloading page

### Component-Level Error Handling

- Components should handle async action errors (connect, updateBalances)
- Display error messages via alerts or UI notifications
- Maintain existing error handling patterns from Context implementation

## Testing Strategy

### Unit Testing Approach

**Store Tests:**
- Test auth store actions (signIn, signOut, setLoading)
- Test wallet store actions (connect, disconnect, updateBalances)
- Mock localStorage for auth persistence tests
- Mock web3Service for wallet operation tests
- Verify state updates after actions
- Test selector behavior and re-render optimization

**Component Tests:**
- Test that components render correctly with store state
- Test that components call store actions on user interactions
- Verify selective subscriptions prevent unnecessary re-renders
- Test initialization logic

### Integration Testing Approach

**End-to-End Scenarios:**
- Sign in flow: Click sign in → Auth modal → Sign in success → Dashboard renders
- Sign out flow: Click sign out → Loading overlay → Signed out → Landing page
- Wallet connect flow: Click connect → MetaMask prompt → Connected state → Balances display
- Wallet disconnect flow: Click disconnect → Confirmation → Disconnected state
- Account change: Change account in MetaMask → UI updates with new account
- Network change: Change network in MetaMask → Page reloads
- Persistence: Refresh page → Auth and wallet state restored

### Manual Testing Checklist

- [ ] Sign in and verify Dashboard appears
- [ ] Sign out and verify SignInLanding appears
- [ ] Connect wallet and verify address displays in Header
- [ ] Disconnect wallet and verify state clears
- [ ] Change MetaMask account and verify UI updates
- [ ] Change MetaMask network and verify page reloads
- [ ] Refresh page while signed in and verify state persists
- [ ] Refresh page with wallet connected and verify reconnection
- [ ] Transfer tokens and verify balances update
- [ ] Verify no console errors during normal operations
- [ ] Verify loading states display correctly
- [ ] Test with MetaMask not installed

## Migration Strategy

### Phase 1: Setup Zustand

1. Install Zustand: `npm install zustand`
2. Create `frontend/src/stores` directory
3. Create `authStore.ts` with full implementation
4. Create `walletStore.ts` with full implementation
5. Create `useStoreInitialization.ts` hook

### Phase 2: Refactor Components

1. Update `App.tsx`:
   - Remove Context providers
   - Add store initialization hook
   - Replace `useAuthContext` with `useAuthStore`
2. Update `Header.tsx`:
   - Replace `useWalletContext` with `useWalletStore`
   - Add selective subscriptions
3. Update `Dashboard.tsx`:
   - Replace `useWalletContext` with `useWalletStore`
   - Add selective subscriptions
4. Update any other components consuming Context

### Phase 3: Remove Legacy Code

1. Delete `frontend/src/contexts/AuthContext.tsx`
2. Delete `frontend/src/contexts/WalletContext.tsx`
3. Update or delete `frontend/src/contexts/index.ts`
4. Delete `frontend/src/hooks/useAuth.ts`
5. Delete `frontend/src/hooks/useWallet.ts`
6. Update `frontend/src/hooks/index.ts` to remove exports

### Phase 4: Verification

1. Run application and test all functionality
2. Verify no TypeScript errors
3. Verify no runtime errors
4. Test all user flows manually
5. Verify performance improvements (reduced re-renders)

## Performance Considerations

### Re-render Optimization

**Problem with Context:**
- Any state change in Context triggers re-render of ALL consumers
- Example: Updating `loadingText` re-renders Header, Dashboard, etc.

**Solution with Zustand:**
- Components subscribe only to state slices they use
- Example: Header subscribes to `isConnected` and `currentAccount` only
- Updating `balances` won't re-render Header

**Selector Best Practices:**
```typescript
// ❌ Bad: Subscribes to entire store
const store = useWalletStore();

// ✅ Good: Subscribes to specific slices
const isConnected = useWalletStore((state) => state.isConnected);

// ✅ Good: Subscribes to multiple related slices
const { isConnected, currentAccount } = useWalletStore((state) => ({
  isConnected: state.isConnected,
  currentAccount: state.currentAccount
}));

// ✅ Best: Actions don't cause re-renders
const connect = useWalletStore((state) => state.connect);
```

### Memory Management

- Zustand stores persist for application lifetime
- Event listeners cleaned up on component unmount
- No memory leaks from Context provider nesting

### Bundle Size

- Zustand is lightweight (~1KB gzipped)
- Removes Context boilerplate code
- Net reduction in bundle size

## Type Safety

### Store Type Definitions

All stores will have explicit TypeScript interfaces:
- State shape interfaces
- Action method signatures
- Return types for all functions

### Component Type Safety

- Store hooks return properly typed state and actions
- Selectors maintain type inference
- No `any` types in store or component code

### Type Compatibility

- Maintain compatibility with existing prop types
- Ensure `WalletBalances` interface matches current usage
- Preserve function signatures for actions

## Backward Compatibility

### Preserved Functionality

- `window.authSetSignedIn` function for inline scripts
- localStorage keys remain unchanged
- MetaMask event listener behavior unchanged
- All user-facing functionality identical

### Breaking Changes

None. This is an internal refactoring with no API changes.

## Dependencies

### New Dependencies

- `zustand` (^4.5.0 or latest stable)

### Existing Dependencies

- `react` (^18.2.0)
- `ethers` (^5.7.2)
- `typescript` (~5.8.3)

No changes to existing dependencies required.
