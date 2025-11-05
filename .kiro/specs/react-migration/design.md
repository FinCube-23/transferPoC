# Design Document

## Overview

This design outlines the complete migration of the FinCube frontend from a hybrid vanilla JavaScript/React setup to a fully React-based application. The current codebase has React components but still relies heavily on vanilla JS DOM manipulation in `main.ts`. The migration will convert all DOM manipulation, event handling, and state management to React patterns while preserving 100% identical functionality and appearance.

## Architecture

### Current State Analysis
- **React Entry Point**: `main.tsx` with React 18 setup
- **React Components**: Basic components exist but are incomplete
- **Legacy Code**: `main.ts` contains all business logic with direct DOM manipulation
- **Services**: `web3Service` and `graphService` are well-structured and will remain unchanged

### Target Architecture
- **Pure React Application**: All UI logic converted to React components and hooks
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Context API**: Manage global state (auth, wallet connection)
- **Service Layer**: Keep existing services unchanged
- **Component Hierarchy**: Maintain existing component structure but enhance functionality

## Components and Interfaces

### 1. App Component (Enhanced)
**Current**: Basic shell with auth state
**Target**: Complete application orchestrator with all state management

```typescript
interface AppState {
  isSignedIn: boolean;
  authLoading: boolean;
  authLoadingText: string;
  showAuthModal: boolean;
}
```

### 2. Dashboard Component (Complete Rewrite)
**Current**: Static JSX with DOM manipulation hooks
**Target**: Fully functional React component with all wallet and transfer logic

```typescript
interface DashboardProps {
  // No props needed - will use context
}

interface DashboardState {
  walletConnected: boolean;
  currentAccount: string | null;
  balances: {
    usd: string;
    eth: string;
    usdc: string;
  };
  transactions: ParsedTransfer[];
  currentPage: number;
  transferForm: {
    address: string;
    amount: string;
    purpose: string;
  };
}
```

### 3. WalletConnection Component (New)
**Purpose**: Handle all wallet connection logic and UI

```typescript
interface WalletConnectionProps {
  onConnectionChange: (connected: boolean, account?: string) => void;
}
```

### 4. TransferForm Component (New)
**Purpose**: Handle token transfer form and submission

```typescript
interface TransferFormProps {
  onTransferSuccess: () => void;
}
```

### 5. TransactionHistory Component (New)
**Purpose**: Display transaction history with pagination

```typescript
interface TransactionHistoryProps {
  transactions: ParsedTransfer[];
  currentPage: number;
  onPageChange: (page: number) => void;
}
```

### 6. Custom Hooks

#### useWallet Hook
```typescript
interface UseWalletReturn {
  isConnected: boolean;
  currentAccount: string | null;
  balances: {
    usd: string;
    eth: string;
    usdc: string;
  };
  connect: () => Promise<void>;
  disconnect: () => void;
  updateBalances: () => Promise<void>;
}
```

#### useTransactions Hook
```typescript
interface UseTransactionsReturn {
  transactions: ParsedTransfer[];
  currentPage: number;
  totalPages: number;
  loading: boolean;
  loadTransactions: (account: string) => Promise<void>;
  addTransaction: (tx: ParsedTransfer) => void;
  setPage: (page: number) => void;
}
```

#### useAuth Hook
```typescript
interface UseAuthReturn {
  isSignedIn: boolean;
  loading: boolean;
  loadingText: string;
  signIn: () => void;
  signOut: () => void;
  setLoading: (loading: boolean, text?: string) => void;
}
```

## Data Models

### Wallet State
```typescript
interface WalletState {
  isConnected: boolean;
  currentAccount: string | null;
  balances: {
    usd: string;
    eth: string;
    usdc: string;
  };
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}
```

### Transfer Form State
```typescript
interface TransferFormData {
  address: string;
  amount: string;
  purpose: string;
}

interface TransferFormErrors {
  address?: string;
  amount?: string;
  purpose?: string;
}
```

### Transaction Pagination
```typescript
interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}
```

## Error Handling

### Error Boundaries
- Implement React Error Boundary for graceful error handling
- Preserve existing error messages and user feedback patterns

### Wallet Errors
- Maintain existing MetaMask error handling
- Convert alert() calls to React-based notifications
- Preserve all existing error messages exactly

### Transfer Errors
- Keep identical validation logic and error messages
- Convert form validation to React patterns
- Maintain existing success/failure feedback

## Testing Strategy

### Component Testing
- Unit tests for all new React components
- Test custom hooks in isolation
- Verify state management logic

### Integration Testing
- Test wallet connection flows
- Test transfer form submission
- Test transaction history pagination

### Visual Regression Testing
- Ensure UI remains pixel-perfect identical
- Test responsive behavior
- Verify all animations and transitions

## Migration Strategy

### Phase 1: State Management Migration
1. Create custom hooks for wallet, auth, and transactions
2. Implement React Context for global state
3. Remove global variables from main.ts

### Phase 2: Component Enhancement
1. Convert Dashboard to fully functional React component
2. Create new components for wallet, transfers, and transactions
3. Implement all event handlers as React functions

### Phase 3: DOM Manipulation Removal
1. Remove all direct DOM manipulation from main.ts
2. Convert all addEventListener calls to React event handlers
3. Replace getElementById calls with React refs where needed

### Phase 4: Cleanup and Optimization
1. Remove main.ts file entirely
2. Optimize React rendering with useMemo and useCallback
3. Ensure no memory leaks or performance regressions

## Implementation Details

### LocalStorage Integration
- Maintain exact same localStorage keys and values
- Use useEffect hooks for persistence
- Preserve all existing auth and wallet state logic

### MetaMask Integration
- Keep identical MetaMask event listeners
- Convert to useEffect hooks with proper cleanup
- Maintain exact same user experience

### Form Handling
- Use controlled components for all form inputs
- Maintain identical validation logic
- Preserve exact same error messages and UX

### Pagination Logic
- Convert pagination functions to React state management
- Maintain identical UI and behavior
- Use React state for page tracking

### Etherscan Integration
- Preserve exact same link generation logic
- Maintain identical button styling and behavior
- Keep same transaction hash normalization

## Performance Considerations

### React Optimization
- Use React.memo for expensive components
- Implement useCallback for event handlers
- Use useMemo for computed values

### State Updates
- Batch related state updates
- Avoid unnecessary re-renders
- Optimize transaction list rendering

### Memory Management
- Proper cleanup of event listeners in useEffect
- Avoid memory leaks in async operations
- Clean up timers and intervals

## Backward Compatibility

### Service Layer
- Keep web3Service and graphService unchanged
- Maintain identical API interfaces
- Preserve all existing functionality

### Styling
- Keep all existing CSS classes and styles
- Maintain identical visual appearance
- Preserve all animations and transitions

### User Experience
- Identical loading states and feedback
- Same error messages and success notifications
- Preserve all existing keyboard and mouse interactions