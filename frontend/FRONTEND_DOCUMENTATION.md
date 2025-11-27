# FinCube Frontend Documentation

## Overview

FinCube Frontend is a React-based web application for managing blockchain-based stablecoin transfers with zero-knowledge proof (ZKP) privacy features.

### Key Features

- User authentication with JWT tokens and organization management
- Privacy-preserving token transfers with ZKP verification
- Transaction history via The Graph subgraph
- Real-time fraud detection and trust scoring
- Transfer progress visualization with 7-step modal
- Custom notification system

### Technology Stack

- **Framework**: React 18.2.0 with TypeScript
- **Build Tool**: Vite 7.1.2
- **State Management**: Zustand 5.0.8
- **Blockchain**: Ethers.js 5.7.2
- **Routing**: React Router DOM 6.22.3

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- Yarn or npm
- MetaMask or compatible Web3 wallet
- Backend services running (User Management, ZKP Query, Fraud Detection)

### Installation

```bash
cd frontend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development
npm run dev

# Build for production
npm run build
```

### Environment Variables

```env
# API URLs
VITE_USER_MANAGEMENT_URL=http://localhost:3001
VITE_ZKP_API_URL=http://localhost:7000

# Smart Contract Addresses
VITE_FINCUBE_CONTRACT=0x3688ed8BBf990Ea42Eb55aC0b133a03d5D8827e1
VITE_FINCUBE_DAO_CONTRACT=0x693d028E72DE49D8D4188e1D9F098bd04a2f49a3
```

---

## Project Structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── App.tsx                    # Root component
│   │   ├── Header.tsx                 # Navigation header
│   │   ├── Dashboard.tsx              # Main dashboard
│   │   ├── AuthModal.tsx              # Login/registration
│   │   ├── OrganizationModal.tsx      # Organization selection
│   │   ├── TransferProgressModal.tsx  # Transfer progress
│   │   ├── NotificationModal.tsx      # Custom notifications
│   │   └── SignInLanding.tsx          # Landing page
│   │
│   ├── services/
│   │   ├── authService.ts             # Authentication API
│   │   ├── organizationService.ts     # Organization API
│   │   ├── graphService.ts            # The Graph queries
│   │   ├── fraudDetectionService.ts   # Fraud detection
│   │   ├── contractService.ts         # Smart contracts
│   │   └── web3Service.ts             # Web3 connection
│   │
│   ├── stores/
│   │   └── authStore.ts               # Zustand auth state
│   │
│   ├── hooks/
│   │   ├── useTransactions.ts
│   │   └── useStoreInitialization.ts
│   │
│   └── main.tsx
│
├── .env                               # Environment config
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Core Features

### 1. Authentication & Authorization

**Login Flow:**

- Email/password authentication with JWT tokens
- Fetches user profile and ZKP data
- Stores tokens in localStorage
- Auto-refresh for expired tokens

**Registration Flow:**

- User creates account
- Auto-login after registration
- Organization selection modal appears
- User joins organization
- Complete authentication with ZKP data

**Organization Management:**

- Post-registration organization selection
- Dropdown with organization details
- Filters specific organizations (e.g., "Brain Station 23")
- Error message parsing from Django ErrorDetail format

### 2. Token Transfers

**Transfer Types:**

- **Same-Organization**: Database-only (no blockchain gas fees)
- **Cross-Organization**: Blockchain-based with ZKP privacy

**Transfer Progress Modal:**
Visualizes 7 steps with animations:

1. Validate Input
2. Retrieve User Data
3. Generate ZKP Proof
4. Generate Nullifier
5. Create Memo
6. Execute Blockchain Transfer
7. Update Database

Shows success/error states with detailed feedback.

**Validation:**

- Reference number format
- Amount validation (positive decimal)
- Balance check
- User approval status

### 3. Transaction History

- Fetches from The Graph subgraph via GraphQL
- Filters by user's reference number
- Pagination (10 per page)
- Displays: sender, recipient, amount, purpose, timestamp, tx hash
- Clickable transaction hashes (Etherscan links)

### 4. Fraud Detection

- Real-time analysis of sender addresses
- Risk scoring with probability and confidence
- Color-coded indicators (green/yellow/red)
- Trust score display in user profile
- Parallel processing for visible transactions

### 5. Notification System

Custom modals replacing browser alerts:

- **Success**: Green with checkmark
- **Error**: Red with alert icon
- **Warning**: Amber with triangle
- **Info**: Blue with info icon

Features: dark theme, slide-in animation, non-blocking, click-outside to close.

---

## State Management

### Auth Store (`authStore.ts`)

Zustand-based global state for authentication.

**State:**

```typescript
interface AuthState {
  isSignedIn: boolean;
  loading: boolean;
  loadingText: string;
  userProfile: UserProfile | null;
  zkpUser: ZKPUser | null;
}
```

**Actions:**

- `signIn(userProfile, zkpUser)` - Set authenticated user
- `signOut()` - Clear all data
- `setLoading(loading, text)` - Update loading state
- `initialize()` - Restore from localStorage

**LocalStorage Keys:**

- `fincube_auth`
- `fincube_access_token`
- `fincube_refresh_token`
- `fincube_user_profile`
- `fincube_zkp_user`

---

## Services

### Authentication Service

```typescript
// Full login with ZKP data
async login(email: string, password: string): Promise<AuthResponse>

// Registration-only login (skips ZKP until org joined)
async loginForRegistration(credentials: LoginCredentials): Promise<AuthResponse>

// Register new user
async register(data: RegisterData): Promise<AuthResponse>

// Fetch user profile
async fetchUserProfile(accessToken: string): Promise<UserProfile>

// Fetch ZKP user data
async fetchZKPUser(userId: number, accessToken: string): Promise<ZKPUser>

// Refresh access token
async refreshAccessToken(): Promise<string | null>
```

### Organization Service

```typescript
// Fetch all organizations
async getOrganizations(accessToken: string): Promise<OrganizationsResponse>

// Join an organization
async joinOrganization(
  payload: JoinOrganizationPayload,
  accessToken: string
): Promise<{ success: boolean; message?: string }>

// Parse Django ErrorDetail format to clean messages
function parseErrorMessage(message: string): string
```

### Graph Service

Fetches transaction data from The Graph subgraph.

```typescript
async fetchTransfersFromGraph(
  referenceNumber: string
): Promise<ParsedTransfer[]>
```

**GraphQL Query:**

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

### Fraud Detection Service

```typescript
async getFraudScore(
  address: string,
  fromAddress?: string
): Promise<FraudScore>

interface FraudScore {
  result: string;              // "Fraud" | "Not Fraud"
  fraud_probability: number;   // 0-1
  confidence: number;          // 0-1
}
```

### Contract Service

```typescript
// Execute safe transfer with ZKP
async safeTransfer(
  to: string,
  amount: BigNumber,
  memo: string,
  nullifier: string
): Promise<ContractTransaction>

// Get approved ERC20 token
async getApprovedERC20(): Promise<string>
```

---

## API Endpoints

### User Management Service (`http://localhost:3001`)

| Method | Endpoint                                           | Description       |
| ------ | -------------------------------------------------- | ----------------- |
| POST   | `/user-management-service/api/users/login`         | User login        |
| POST   | `/user-management-service/api/users/registration`  | User registration |
| GET    | `/user-management-service/api/users/profile`       | Get user profile  |
| POST   | `/user-management-service/api/users/token/refresh` | Refresh token     |
| GET    | `/api/organizations`                               | Get organizations |
| POST   | `/api/organizations/users`                         | Join organization |

### ZKP Query Service (`http://localhost:7000`)

| Method | Endpoint                                | Description       |
| ------ | --------------------------------------- | ----------------- |
| GET    | `/zkp-query-service/api/users/{userId}` | Get ZKP user data |
| POST   | `/api/transfer`                         | Execute transfer  |

### The Graph Subgraph

**Endpoint:** `https://api.studio.thegraph.com/query/93678/fincube-subgraph/v0.0.2`

---

## Authentication Flows

### Login Flow

```text
1. User enters credentials
2. POST /api/users/login → { tokens, userProfile }
3. Store tokens in localStorage
4. GET /api/users/profile
5. GET /api/users/{userId} (ZKP data)
6. authStore.signIn(userProfile, zkpUser)
7. Show Dashboard
```

### Registration Flow

```text
1. User completes registration form
2. POST /api/users/register
3. Auto-login (loginForRegistration - skips ZKP)
4. Show OrganizationModal
5. GET /api/organizations
6. User selects and joins organization
7. POST /api/organizations/users
8. Fetch updated profile + ZKP data
9. authStore.signIn(userProfile, zkpUser)
10. Show Dashboard
```

### Sign Out Flow

```text
1. User clicks Sign Out
2. authStore.signOut()
3. Clear localStorage (all fincube_* keys)
4. Reset store state
5. Redirect to landing page
```

---

## Transfer Flow

```text
1. User fills transfer form (ref #, amount, purpose)
2. Click Transfer button
3. 2-second delay
4. TransferProgressModal appears
5. Steps 1-5: Client-side validation and preparation
6. Step 6: POST /api/transfer (blockchain execution)
7. Step 7: Database update
8. Show success/error state
9. User clicks Continue
10. Modal closes, UI updates (balance, transaction list)
```

---

## Development Guide

### Running Locally

```bash
# Start backend services first
# User Management (3001), ZKP Query (7000), Fraud Detection

# Start frontend
cd frontend
npm run dev
# Access at http://localhost:5173
```

### Code Style

- TypeScript strict mode
- Functional components with hooks
- Zustand for global state, useState for local state
- Inline styles with CSS-in-JS

### Adding Components

1. Create in `src/components/`
2. Define TypeScript interfaces
3. Implement functional component
4. Export and import where needed

### Adding Services

1. Create in `src/services/`
2. Define interfaces for data types
3. Implement API calls with error handling
4. Export service functions/class

### Common Issues

**CORS Errors:**

- Check Vite proxy in `vite.config.ts`
- Ensure backend allows origin

**Authentication Fails:**

- Verify backend services running
- Check API URLs in `.env`
- Inspect browser console

**Transactions Not Showing:**

- Verify The Graph subgraph is synced
- Check reference number format
- Inspect GraphQL response

**Balance Not Updating:**

- Verify transfer success
- Check localStorage data
- Refresh page if needed

---

## Security Considerations

- **Tokens**: Stored in localStorage (consider httpOnly cookies for production)
- **Input Validation**: Client-side validation + server-side enforcement
- **API Security**: Use HTTPS in production, implement rate limiting
- **Smart Contracts**: Validate addresses, check balances, handle failures gracefully

---

## Documentation

- [AUTH_FLOW.md](./AUTH_FLOW.md) - Detailed authentication flow
- [ORGANIZATION_FLOW.md](./ORGANIZATION_FLOW.md) - Organization selection flow
- [DOCKER_AUTH_INTEGRATION.md](./DOCKER_AUTH_INTEGRATION.md) - Docker setup
- [README.md](./README.md) - Quick start guide

---

**Last Updated**: November 27, 2025  
**Version**: 1.1.0
