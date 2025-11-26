# FinCube Frontend Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Installation](#setup--installation)
4. [Project Structure](#project-structure)
5. [Core Features](#core-features)
6. [State Management](#state-management)
7. [Services](#services)
8. [Components](#components)
9. [Authentication Flow](#authentication-flow)
10. [Transaction Management](#transaction-management)
11. [API Integration](#api-integration)
12. [Environment Configuration](#environment-configuration)
13. [Development Guide](#development-guide)

---

## Overview

FinCube Frontend is a React-based web application for managing blockchain-based stablecoin transfers with zero-knowledge proof (ZKP) privacy features. The application provides a user-friendly interface for:

- User authentication and profile management
- Secure token transfers with ZKP privacy
- Transaction history with fraud detection
- Real-time balance tracking
- GraphQL-based transaction queries

### Technology Stack

- **Framework**: React 18.2.0 with TypeScript
- **Build Tool**: Vite 7.1.2
- **State Management**: Zustand 5.0.8
- **Blockchain**: Ethers.js 5.7.2
- **Routing**: React Router DOM 6.22.3
- **Styling**: Inline styles with CSS-in-JS approach

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Components  │  │    Stores    │  │   Services   │      │
│  │              │  │              │  │              │      │
│  │  - Header    │  │  - authStore │  │  - authSvc   │      │
│  │  - Dashboard │  │              │  │  - graphSvc  │      │
│  │  - AuthModal │  │              │  │  - fraudSvc  │      │
│  │  - UserInfo  │  │              │  │  - web3Svc   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ User Mgmt    │  │  ZKP Query   │  │  The Graph   │
│  Service     │  │   Service    │  │   Subgraph   │
│ (Port 3000)  │  │ (Port 7000)  │  │   (GraphQL)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Data Flow

1. **Authentication**: User → AuthModal → authService → User Management API → authStore
2. **Profile Loading**: authService → User Management API + ZKP Query API → authStore
3. **Transfers**: Dashboard → Transfer API → Blockchain/Database → Transaction History
4. **Transaction History**: Dashboard → graphService → The Graph → Display
5. **Fraud Detection**: Dashboard → fraudDetectionService → Fraud API → Display

---

## Setup & Installation

### Prerequisites

- Node.js 18+ or compatible runtime
- Yarn package manager
- MetaMask or compatible Web3 wallet
- Access to backend services (User Management, ZKP Query, Fraud Detection)

### Installation Steps

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
yarn install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
yarn dev
```

### Build for Production

```bash
# Build optimized production bundle
yarn build

# Preview production build
yarn preview
```

---

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── App.tsx         # Root application component
│   │   ├── Header.tsx      # Navigation header
│   │   ├── Dashboard.tsx   # Main dashboard interface
│   │   ├── AuthModal.tsx   # Login/registration modal
│   │   └── UserInfo.tsx    # User profile display
│   │
│   ├── services/           # API and business logic
│   │   ├── authService.ts          # Authentication API
│   │   ├── graphService.ts         # GraphQL queries
│   │   ├── fraudDetectionService.ts # Fraud detection API
│   │   ├── contractService.ts      # Smart contract interactions
│   │   └── web3Service.ts          # Web3 connection
│   │
│   ├── stores/             # Zustand state stores
│   │   └── authStore.ts    # Authentication state
│   │
│   ├── hooks/              # Custom React hooks
│   │   ├── useTransactions.ts      # Transaction management
│   │   └── useStoreInitialization.ts # Store initialization
│   │
│   ├── types/              # TypeScript type definitions
│   │   └── contracts.ts    # Contract interfaces
│   │
│   └── main.tsx           # Application entry point
│
├── public/                # Static assets
├── .env                   # Environment variables
├── .env.example          # Environment template
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite build configuration
├── index.html            # HTML entry point
├── AUTH_FLOW.md          # Authentication documentation
├── DOCKER_AUTH_INTEGRATION.md # Docker setup guide
└── README.md             # Basic setup instructions
```

---

## Core Features

### 1. User Authentication

- **Login**: Email/password authentication with JWT tokens
- **Registration**: New user account creation
- **Session Management**: Automatic token refresh and persistence
- **Profile Loading**: Fetches user profile and ZKP data on login

### 2. Token Transfers

- **Privacy-Preserving Transfers**: Blockchain-based transfers with ZKP verification
- **Reference Number System**: Unique identifiers for sender/receiver
- **Real-time Balance Updates**: Immediate balance reflection after transfers
- **On-Chain Verification**: All transfers verified via smart contracts

### 3. Transaction History

- **GraphQL Integration**: Fetches transactions from The Graph subgraph
- **Filtering**: Shows only transactions for logged-in user's reference number
- **Pagination**: 10 transactions per page
- **Transaction Details**: Sender, recipient, amount, purpose, timestamp, tx hash

### 4. Fraud Detection

- **Real-time Analysis**: Checks sender addresses for fraud indicators
- **Risk Scoring**: Displays fraud probability and confidence levels
- **Visual Indicators**: Color-coded risk levels (green/yellow/red)
- **Parallel Processing**: Fetches fraud data for all visible transactions

### 5. User Profile Display

- **Account Information**: Name, email, status
- **Balance Display**: Current USDC balance with visual emphasis
- **Reference Number**: Copyable reference number for receiving transfers
- **Dark Theme**: Consistent dark mode styling

---

## State Management

### Auth Store (`authStore.ts`)

Zustand-based global state management for authentication.

#### State Properties

```typescript
interface AuthState {
  isSignedIn: boolean; // Authentication status
  loading: boolean; // Loading state
  loadingText: string; // Loading message
  userProfile: UserProfile | null; // User profile data
  zkpUser: ZKPUser | null; // ZKP user data
}
```

#### Actions

```typescript
// Sign in with user data
signIn(userProfile: UserProfile, zkpUser: ZKPUser): void

// Sign out and clear all data
signOut(): void

// Set loading state
setLoading(loading: boolean, text?: string): void

// Initialize from localStorage
initialize(): void
```

#### LocalStorage Keys

- `fincube_auth`: Authentication flag
- `fincube_access_token`: JWT access token
- `fincube_refresh_token`: JWT refresh token
- `fincube_user_profile`: Serialized user profile
- `fincube_zkp_user`: Serialized ZKP user data

---

## Services

### 1. Authentication Service (`authService.ts`)

Handles all authentication-related API calls.

#### Key Methods

```typescript
// Login user
async login(email: string, password: string): Promise<{
  tokens: { access: string; refresh: string };
  userProfile: UserProfile;
  zkpUser: ZKPUser;
}>

// Register new user
async register(userData: RegisterData): Promise<void>

// Fetch user profile
async fetchUserProfile(accessToken: string): Promise<UserProfile>

// Fetch ZKP user data
async fetchZKPUser(userId: number, accessToken: string): Promise<ZKPUser>

// Refresh access token
async refreshAccessToken(): Promise<string>
```

#### API Endpoints

- **Login**: `POST /user-management-service/api/users/login`
- **Registration**: `POST /user-management-service/api/users/registration`
- **Profile**: `GET /user-management-service/api/users/profile`
- **ZKP User**: `GET /zkp-query-service/api/users/{userId}`

### 2. Graph Service (`graphService.ts`)

Fetches transaction data from The Graph subgraph.

#### Key Methods

```typescript
// Fetch transfers filtered by sender reference number
async fetchTransfersFromGraph(
  referenceNumber: string
): Promise<ParsedTransfer[]>
```

#### GraphQL Query

```graphql
query {
  stablecoinTransfers(first: 100, orderBy: blockNumber, orderDirection: desc) {
    id
    from
    to
    amount
    memo
    memoHash
    nullifier
    sender_reference_number
    receiver_reference_number
    transactionHash
    blockNumber
    blockTimestamp
  }
}
```

#### Data Processing

1. Fetches all recent transfers (up to 100)
2. Filters by sender reference number from memo field
3. Parses memo JSON to extract purpose and metadata
4. Converts amounts from raw units to USDC
5. Normalizes transaction hashes
6. Returns parsed transfer objects

### 3. Fraud Detection Service (`fraudDetectionService.ts`)

Analyzes addresses for fraud risk.

#### Key Methods

```typescript
// Get fraud score for an address
async getFraudScore(
  address: string,
  fromAddress?: string
): Promise<FraudScore>
```

#### Response Format

```typescript
interface FraudScore {
  result: string; // "Fraud" | "Not Fraud"
  fraud_probability: number; // 0-1 probability
  confidence: number; // 0-1 confidence level
}
```

### 4. Contract Service (`contractService.ts`)

Interacts with FinCube smart contracts.

#### Key Methods

```typescript
// Execute safe transfer with ZKP
async safeTransfer(
  to: string,
  amount: BigNumber,
  memo: string,
  nullifier: string
): Promise<ContractTransaction>

// Get approved ERC20 token address
async getApprovedERC20(): Promise<string>
```

### 5. Web3 Service (`web3Service.ts`)

Manages Web3 wallet connections.

---

## Components

### 1. App Component (`App.tsx`)

Root component that sets up routing and global state initialization.

**Features**:

- Initializes auth store from localStorage
- Provides routing structure
- Manages global app state

### 2. Header Component (`Header.tsx`)

Navigation header with authentication controls.

**Features**:

- FinCube branding and logo
- Sign In/Sign Out button
- Responsive design
- Loading state display

### 3. Dashboard Component (`Dashboard.tsx`)

Main application interface after login.

**Layout**:

```
┌─────────────────────────────────────────────┐
│  Send Transfer  │  Your Account             │
│  ┌───────────┐  │  ┌─────────────────────┐ │
│  │ Ref #     │  │  │ User Profile        │ │
│  │ Amount    │  │  │ - Name              │ │
│  │ Purpose   │  │  │ - Balance           │ │
│  │ [Transfer]│  │  │ - Email             │ │
│  └───────────┘  │  └─────────────────────┘ │
│                 │  ┌─────────────────────┐ │
│                 │  │ Reference Number    │ │
│                 │  │ [Copy Button]       │ │
│                 │  └─────────────────────┘ │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  Recent Transactions                        │
│  [Refresh] [Etherscan]                      │
│  ┌───────────────────────────────────────┐ │
│  │ Sender | Recipient | Amount | Fraud   │ │
│  │ ...    | ...       | ...    | ...     │ │
│  └───────────────────────────────────────┘ │
│  [< Previous] [Next >]                      │
└─────────────────────────────────────────────┘
```

**Features**:

- Two-column responsive layout
- Transfer form with validation
- User profile display
- Reference number with copy functionality
- Transaction history with pagination
- Fraud detection integration
- Refresh button with rotation animation
- Etherscan link for contract viewing

**Transfer Form Validation**:

- Reference number format validation
- Amount validation (decimal, positive)
- Balance check before transfer
- Error handling with detailed messages

**Transaction Display**:

- 10 transactions per page
- Sorted by timestamp (newest first)
- Fraud risk indicators
- Clickable transaction hashes (Etherscan)
- Loading states for fraud detection

### 4. AuthModal Component (`AuthModal.tsx`)

Login and registration modal dialog.

**Features**:

- Tab-based interface (Login/Register)
- Form validation
- Password confirmation for registration
- Error message display
- Loading states
- Responsive design

**Login Form**:

- Email input
- Password input
- Submit button

**Registration Form**:

- First name
- Last name
- Email
- Contact number
- Password
- Confirm password
- Submit button

### 5. UserInfo Component (`UserInfo.tsx`)

Displays user profile information (if still in use).

---

## Authentication Flow

### Complete Authentication Sequence

```
1. User enters credentials
   ↓
2. AuthModal calls authService.login()
   ↓
3. POST /api/users/login
   ← Returns: { tokens: { access, refresh } }
   ↓
4. Store tokens in localStorage
   ↓
5. GET /api/users/profile (with access token)
   ← Returns: UserProfile
   ↓
6. GET /api/users/{userId} (ZKP service)
   ← Returns: ZKPUser (with balance, reference_number)
   ↓
7. authStore.signIn(userProfile, zkpUser)
   ↓
8. Store data in localStorage
   ↓
9. Update UI (show Dashboard)
```

### Token Management

**Access Token**:

- Short-lived JWT token
- Included in Authorization header
- Used for authenticated API requests

**Refresh Token**:

- Long-lived token
- Used to obtain new access tokens
- Stored securely in localStorage

**Token Refresh Flow**:

```typescript
// When access token expires
const newAccessToken = await authService.refreshAccessToken();
// Update localStorage
localStorage.setItem("fincube_access_token", newAccessToken);
```

### Sign Out Flow

```
1. User clicks Sign Out
   ↓
2. authStore.signOut()
   ↓
3. Set loading state (600ms delay)
   ↓
4. Clear localStorage:
   - fincube_auth
   - fincube_access_token
   - fincube_refresh_token
   - fincube_user_profile
   - fincube_zkp_user
   ↓
5. Reset store state
   ↓
6. Redirect to home/login
```

---

## Transaction Management

### Transfer Execution

FinCube executes privacy-preserving transfers with the following characteristics:

- **Blockchain transaction**: Uses FinCube smart contract
- **ZKP privacy**: Zero-knowledge proof for membership verification
- **On-chain verification**: HonkVerifier validates proofs
- **Gas fees**: Requires native tokens for gas (ETH, MATIC, etc.)
- **Response**: Transaction hash and blockchain details
- **Audit trail**: Events published to RabbitMQ

### Transfer Flow

```
1. User fills transfer form
   ↓
2. Validate inputs:
   - Reference number format
   - Amount (positive, decimal)
   - Balance check
   ↓
3. POST /api/transfer
   Body: {
     receiver_reference_number,
     amount,
     sender_user_id
   }
   ↓
4. Backend processes transfer:
   - Generate ZKP proof
   - Create nullifier
   - Call smart contract
   - Publish to RabbitMQ
   - Update database
   ↓
5. Return blockchain transaction:
   - Transaction hash
   - Block number
   - Gas used
   ↓
6. Update UI:
   - Show success message
   - Add to transaction list
   - Update balance
   - Clear form
```

### Transaction History

**Data Source**: The Graph subgraph

**Filtering**: By sender reference number

**Query Process**:

```
1. Dashboard loads
   ↓
2. Get zkpUser.reference_number
   ↓
3. fetchTransfersFromGraph(reference_number)
   ↓
4. GraphQL query to The Graph
   ↓
5. Filter by sender_reference_number in memo
   ↓
6. Parse memo JSON for metadata
   ↓
7. Display transactions with pagination
```

**Pagination**:

- 10 transactions per page
- Client-side pagination
- Previous/Next navigation
- Page indicator

**Refresh**:

- Manual refresh button
- Rotation animation during refresh
- Minimum 500ms animation duration
- Disabled state during refresh

---

## API Integration

### User Management Service

**Base URL**: `http://localhost:3000`

**Endpoints**:

| Method | Endpoint                                           | Description          |
| ------ | -------------------------------------------------- | -------------------- |
| POST   | `/user-management-service/api/users/login`         | User login           |
| POST   | `/user-management-service/api/users/registration`  | User registration    |
| GET    | `/user-management-service/api/users/profile`       | Get user profile     |
| POST   | `/user-management-service/api/users/token/refresh` | Refresh access token |

### ZKP Query Service

**Base URL**: `http://localhost:7000`

**Endpoints**:

| Method | Endpoint                                | Description       |
| ------ | --------------------------------------- | ----------------- |
| GET    | `/zkp-query-service/api/users/{userId}` | Get ZKP user data |
| POST   | `/api/transfer`                         | Execute transfer  |

### The Graph Subgraph

**Endpoint**: `https://api.studio.thegraph.com/query/93678/fincube-subgraph/v0.0.2`

**Query**: `stablecoinTransfers`

### Fraud Detection Service

**Endpoint**: Configured in `fraudDetectionService.ts`

**Method**: `POST /fraud-detection`

---

## Environment Configuration

### Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
# User Management Service
VITE_USER_MANAGEMENT_URL=http://localhost:3000

# ZKP Query Service
VITE_ZKP_API_URL=http://localhost:7000

# Authentication API (Docker)
VITE_AUTH_API_URL=http://localhost:3001

# Smart Contract Addresses
VITE_FINCUBE_CONTRACT=0x3688ed8BBf990Ea42Eb55aC0b133a03d5D8827e1
VITE_FINCUBE_DAO_CONTRACT=0x693d028E72DE49D8D4188e1D9F098bd04a2f49a3

# Optional: Mock ERC20 for testing
# VITE_MOCK_ERC20_CONTRACT=0x9776569af3c83246a7a57a546942edc2672676f3
```

### Vite Proxy Configuration

For development, Vite proxies API requests to avoid CORS issues:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

---

## Development Guide

### Running the Application

```bash
# Start development server
yarn dev

# Access at http://localhost:5173
```

### Code Style

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **Styling**: Inline styles with CSS-in-JS
- **State**: Zustand for global state, useState for local state

### Adding a New Component

1. Create component file in `src/components/`
2. Define TypeScript interfaces for props
3. Implement functional component
4. Export component
5. Import and use in parent component

### Adding a New Service

1. Create service file in `src/services/`
2. Define service class or functions
3. Add TypeScript interfaces for data types
4. Implement API calls with error handling
5. Export service
6. Import and use in components

### Adding a New Store

1. Create store file in `src/stores/`
2. Define state interface
3. Create Zustand store with actions
4. Add localStorage persistence if needed
5. Export store hook
6. Use in components with `useStore()`

### Testing Locally

1. **Start Backend Services**:

   ```bash
   # User Management Service (port 3000)
   # ZKP Query Service (port 7000)
   # Fraud Detection Service
   ```

2. **Start Frontend**:

   ```bash
   cd frontend
   yarn dev
   ```

3. **Test Authentication**:

   - Click "Sign In"
   - Enter credentials
   - Verify profile loads

4. **Test Transfers**:

   - Enter recipient reference number
   - Enter amount
   - Submit transfer
   - Verify transaction appears in history

5. **Test Fraud Detection**:
   - View transaction history
   - Check fraud indicators appear
   - Verify color coding

### Common Issues

#### CORS Errors

**Solution**: Ensure Vite proxy is configured correctly in `vite.config.ts`

#### Authentication Fails

**Checklist**:

- Backend services running?
- Correct API URLs in `.env`?
- Valid credentials?
- Check browser console for errors

#### Transactions Not Showing

**Checklist**:

- The Graph subgraph synced?
- Correct reference number?
- GraphQL endpoint accessible?
- Check console logs for filtering

#### Balance Not Updating

**Checklist**:

- Transfer successful?
- localStorage updated?
- Page refreshed?
- Check ZKP service response

### Building for Production

```bash
# Build optimized bundle
yarn build

# Output in dist/ directory
# Deploy dist/ to web server
```

### Performance Optimization

- **Code Splitting**: Vite automatically splits code
- **Lazy Loading**: Use React.lazy() for large components
- **Memoization**: Use React.memo() for expensive renders
- **Debouncing**: Debounce API calls in search/filter
- **Pagination**: Limit displayed data (10 items per page)

---

## Security Considerations

### Token Storage

- Tokens stored in localStorage (consider httpOnly cookies for production)
- Clear tokens on sign out
- Implement token refresh before expiry

### Input Validation

- Validate all form inputs client-side
- Server-side validation is primary defense
- Sanitize user inputs before display

### API Security

- Always use HTTPS in production
- Include CSRF tokens if needed
- Validate JWT tokens on backend
- Implement rate limiting

### Smart Contract Interactions

- Validate addresses before transactions
- Check balances before transfers
- Handle transaction failures gracefully
- Display gas estimates to users

---

## Future Enhancements

### Planned Features

1. **Multi-language Support**: i18n integration
2. **Dark/Light Theme Toggle**: User preference
3. **Transaction Export**: CSV/PDF export
4. **Advanced Filtering**: Date range, amount range
5. **Notifications**: Real-time transaction alerts
6. **Mobile App**: React Native version
7. **Batch Transfers**: Multiple recipients
8. **Scheduled Transfers**: Future-dated transfers

### Technical Improvements

1. **Testing**: Unit tests with Jest, E2E with Playwright
2. **Error Boundary**: React error boundaries
3. **Logging**: Structured logging service
4. **Analytics**: User behavior tracking
5. **Performance Monitoring**: Real-time metrics
6. **Accessibility**: WCAG 2.1 AA compliance
7. **PWA**: Progressive Web App features
8. **Offline Support**: Service worker caching

---

## Support & Resources

### Documentation

- [AUTH_FLOW.md](./AUTH_FLOW.md) - Authentication flow details
- [DOCKER_AUTH_INTEGRATION.md](./DOCKER_AUTH_INTEGRATION.md) - Docker setup
- [README.md](./README.md) - Quick start guide

### External Resources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [The Graph Documentation](https://thegraph.com/docs/)

### Contact

For issues or questions, contact the development team or create an issue in the project repository.

---

**Last Updated**: November 26, 2025
**Version**: 1.0.0
