# FinCube Backend System - Project Context

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Core Subsystems](#core-subsystems)
4. [Zero-Knowledge Proof System](#zero-knowledge-proof-system)
5. [B2B Membership Service](#b2b-membership-service)
6. [Smart Contracts](#smart-contracts)
7. [Database Architecture](#database-architecture)
8. [Message Queue Integration](#message-queue-integration)
9. [API Architecture](#api-architecture)
10. [Security & Privacy](#security--privacy)
11. [Deployment & Scalability](#deployment--scalability)
12. [Development Workflow](#development-workflow)

---

## Overview

The FinCube Backend System is a comprehensive, privacy-preserving financial infrastructure that enables secure B2B transfers using Zero-Knowledge Proofs (ZKP) and blockchain technology. The system is designed to be **EVM-agnostic**, working seamlessly with any EVM-compatible blockchain without code modifications.

### Key Capabilities

-   **Privacy-Preserving Transfers**: Zero-knowledge proofs enable membership verification without revealing sensitive information
-   **Dual Transfer Modes**: Optimized paths for same-organization (fast) and cross-organization (secure) transfers
-   **EVM Compatibility**: Plug-and-play support for any EVM-compatible blockchain (Ethereum, Polygon, Arbitrum, Celo, etc.)
-   **Stablecoin Support**: Currently uses USDC with support for any ERC20 token
-   **Scalable Architecture**: Batch-based polynomial system supports unlimited users
-   **Event-Driven Design**: RabbitMQ integration for audit trails and analytics
-   **Cryptographic Security**: BN254 curve, Poseidon2 hashing, Honk proof system

### Technology Stack

**Core Runtime**:

-   Node.js 18+
-   Express.js (REST API)
-   MongoDB + Mongoose (Data persistence)
-   RabbitMQ (Event streaming)

**Blockchain**:

-   Ethers.js (EVM interaction)
-   Any EVM-compatible RPC provider (Alchemy, Infura, public RPCs)
-   Solidity smart contracts (FinCube, HonkVerifier)

**Cryptography**:

-   Noir (ZKP circuit language)
-   Barretenberg (Proving backend)
-   Poseidon2 (Hash function)
-   BN254 elliptic curve

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Applications                          │
│                    (Web, Mobile, API Consumers)                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS/REST
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Express.js API Gateway (Port 7000)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Transfer   │  │     Proof    │  │    Query     │             │
│  │  Controller  │  │  Controller  │  │  Controller  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   MongoDB    │    │  EVM Chain   │    │   RabbitMQ   │
│              │    │  (Any EVM)   │    │              │
│ - Users      │    │              │    │ - Tx Events  │
│ - Orgs       │    │ - FinCube    │    │ - Audit      │
│ - Batches    │    │ - Verifier   │    │ - Analytics  │
│ - Events     │    │ - ERC20      │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
        │                    │                    │
        └────────────────────┴────────────────────┘
                             │
                             ▼
                    ┌──────────────┐
                    │  ZKP System  │
                    │              │
                    │ - Noir       │
                    │ - Barretenberg│
                    │ - Poseidon2  │
                    └──────────────┘
```

### Component Interaction Flow

1. **Client** → API Gateway (HTTP/JSON requests)
2. **API Gateway** → MongoDB (User/Organization/Batch data)
3. **API Gateway** → ZKP System (Proof generation)
4. **API Gateway** → EVM Chain (Smart contract calls)
5. **API Gateway** → RabbitMQ (Event publishing)
6. **RabbitMQ** → External Services (Audit, analytics, compliance)

---

## Core Subsystems

### 1. B2B Membership Service (`backend/b2b-membership/`)

The main application service that orchestrates transfers, manages users, and coordinates with blockchain.

**Key Responsibilities**:

-   Transfer execution (same-org and cross-org)
-   User and organization management
-   Proof generation coordination
-   Blockchain transaction execution
-   Event publishing to RabbitMQ
-   Database operations

**Location**: `backend/b2b-membership/`

**Entry Point**: `index.js`

**Port**: 7000 (configurable via `PORT` env var)

### 2. ZKP Base System (`backend/base/`)

The cryptographic foundation providing zero-knowledge proof capabilities.

**Key Responsibilities**:

-   Noir circuit definition
-   Polynomial generation and evaluation
-   Secret derivation (SHA-256 + BN254 field reduction)
-   Proof generation (Barretenberg)
-   Verification key management
-   Test data generation

**Location**: `backend/base/`

**Circuit**: `backend/base/circuit/src/main.nr`

**Max Polynomial Degree**: 128 (supports 128 users per batch)

### 3. Smart Contracts (`web3/contracts/`)

Solidity contracts deployed on EVM-compatible chains.

**Contracts**:

-   **FinCubeDao**: DAO contract to manage memberships
-   **FinCube**: Main transfer contract with ZKP verification
-   **HonkVerifier**: On-chain proof verification

**Location**: `web3/contracts/`

**Deployment**: Any EVM-compatible blockchain

---

## Zero-Knowledge Proof System

### Architecture Overview

The ZKP system enables privacy-preserving membership verification using polynomial-based proofs.

### Core Concept

**Polynomial Membership Proof**:

1. Organization creates a polynomial where member secrets are roots
2. User proves they know a secret that evaluates to zero on the polynomial
3. Proof reveals nothing about the user's identity or other members

### Cryptographic Components

#### 1. Secret Generation

```
User Secret = SHA-256(zkp_key || org_salt) mod BN254_FIELD_PRIME
```

**Parameters**:

-   `zkp_key`: User's unique identifier (email-derived)
-   `org_salt`: Organization's unique salt (64-char hex)
-   `BN254_FIELD_PRIME`: 21888242871839275222246405745257275088548364400416034343698204186575808495617

#### 2. Polynomial Structure

```
P(x) = c₀ + c₁x + c₂x² + ... + c₁₂₈x¹²⁸
```

**Properties**:

-   Maximum degree: 128 (supports 128 members per batch)
-   Coefficients: BigInt strings stored in MongoDB
-   Evaluation: P(secret) = 0 for valid members

#### 3. Nullifier Generation

```
Nullifier = Poseidon2(secret, verifier_key)
```

**Purpose**:

-   Prevents double-verification
-   Enables verification caching
-   Unique per (user, verifier) pair

#### 4. Polynomial Hash

```
Polynomial_Hash = Poseidon2(c₀, c₁, c₂, ..., c₁₂₈)
```

**Purpose**:

-   On-chain commitment to member set
-   Integrity verification
-   Prevents polynomial tampering

### Proof Generation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Data Retrieval                                           │
│    - Fetch user's batch polynomial from MongoDB            │
│    - Fetch organization salt                                │
│    - Fetch verifier key (wallet address)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Secret Derivation                                        │
│    secret = SHA-256(zkp_key + org_salt) mod BN254_FP       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Nullifier Generation                                     │
│    nullifier = Poseidon2(secret, verifier_key)             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Polynomial Hash Computation                              │
│    poly_hash = Poseidon2(coefficients)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Circuit Compilation (Noir)                               │
│    nargo compile → bytecode                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Witness Generation                                       │
│    nargo execute → witness.gz                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Proof Generation (Barretenberg)                          │
│    bb prove → proof + public_inputs                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Verification (Optional)                                  │
│    - Local: bb verify                                       │
│    - On-chain: HonkVerifier.verify()                       │
└─────────────────────────────────────────────────────────────┘
```

### Circuit Constraints

The Noir circuit (`backend/base/circuit/src/main.nr`) enforces:

1. **Polynomial Integrity**: `computed_hash == polynomial_hash`
2. **Membership Proof**: `P(secret) == 0`
3. **KYC Compliance**: `isKYCed == true`
4. **Nullifier Correctness**: `computed_nullifier == nullifier`

### Public Inputs

Exposed to verifier (on-chain):

-   `polynomial_hash`: Commitment to member set
-   `nullifier`: Verification cache identifier
-   `verifier_key`: Organization's wallet address

### Private Inputs

Hidden from verifier:

-   `secret`: User's derived secret
-   `polynomial`: Full polynomial coefficients
-   `isKYCed`: KYC status (enforced cryptographically)

### Scalability: Batch System

**Challenge**: Polynomial degree limited to 128

**Solution**: Multiple independent batches

```
Organization
├── Batch 1 (Polynomial P₁) → Users 1-128
├── Batch 2 (Polynomial P₂) → Users 129-256
├── Batch 3 (Polynomial P₃) → Users 257-384
└── Batch N (Polynomial Pₙ) → Users ...
```

**Benefits**:

-   **Unlimited Scalability**: Add batches as needed
-   **Proof Efficiency**: Each proof only uses one batch's polynomial
-   **Parallel Processing**: Independent batch operations
-   **Storage Optimization**: Only load relevant batch data

**Automatic Management**: System automatically assigns users to batches and creates new batches when capacity is reached.

---

## B2B Membership Service

### Transfer Modes

#### 1. Same-Organization Transfer

**When**: Sender and receiver belong to the same organization

**Flow**:

```
1. Validate inputs
2. Retrieve user data
3. Check organization match ✓
4. Update database balances (atomic)
5. Return success
```

**Characteristics**:

-   ⚡ Fast (~100ms)
-   💰 No gas costs
-   🔒 Database-only
-   ✅ Atomic transactions

**Response**:

```json
{
    "success": true,
    "transferType": "SAME_ORGANIZATION",
    "database": {
        "fromUserId": 2001,
        "toUserId": 2002,
        "amount": 100,
        "senderPreviousBalance": 1000,
        "senderNewBalance": 900,
        "receiverPreviousBalance": 500,
        "receiverNewBalance": 600
    }
}
```

#### 2. Cross-Organization Transfer

**When**: Sender and receiver belong to different organizations

**Flow**:

```
1. [STEP 1/7] Validate inputs
2. [STEP 2/7] Retrieve user data
3. [STEP 3/7] Generate ZKP proof (receiver)
4. [STEP 4/7] Generate nullifier
5. [STEP 5/7] Create memo
6. [STEP 6/7] Execute blockchain transfer
7. [STEP 7/7] Publish to RabbitMQ
8. [STEP 8/7] Update database balances
```

**Characteristics**:

-   🔐 Cryptographically secure
-   ⛓️ On-chain verification
-   📝 Complete audit trail
-   🐌 Slower (~5-10s)
-   💸 Gas costs apply

**Response**:

```json
{
    "success": true,
    "blockchain": {
        "transactionHash": "0x...",
        "blockNumber": 12345,
        "gasUsed": "150000",
        "senderWalletAddress": "0x...",
        "receiverWalletAddress": "0x...",
        "nullifier": "0x...",
        "memo": "{...}"
    },
    "database": {
        "fromUserId": 2001,
        "toUserId": 3002,
        "amount": 100,
        "senderPreviousBalance": 900,
        "senderNewBalance": 800,
        "receiverPreviousBalance": 0,
        "receiverNewBalance": 100
    }
}
```

### Controllers

#### Transfer Controller

**File**: `backend/b2b-membership/controllers/transfer-controller.js`

**Responsibilities**:

-   Input validation
-   Organization matching logic
-   Proof generation coordination
-   Blockchain transaction execution
-   RabbitMQ event publishing
-   Database balance updates
-   Error handling and logging

**Key Methods**:

-   `executeTransfer(req, res)`: Main transfer orchestration
-   `_validateTransferInputs()`: Input validation
-   `_retrieveUserData()`: Fetch sender/receiver/organizations
-   `_generateProof()`: ZKP proof generation
-   `_generateNullifier()`: Unique transaction ID
-   `_createMemo()`: Transfer metadata
-   `_validateMemoLength()`: Memo size check

#### Proof Controller

**File**: `backend/b2b-membership/controllers/proof-controller.js`

**Responsibilities**:

-   Test data generation
-   Circuit compilation
-   Witness generation
-   Proof generation
-   On-chain verification

**Key Methods**:

-   `generateProofService()`: End-to-end proof generation
-   `verifyProofOnChain()`: Smart contract verification

#### Query Controller

**File**: `backend/b2b-membership/controllers/query-controller.js`

**Responsibilities**:

-   User data retrieval
-   Organization data retrieval
-   Batch information queries

**Key Methods**:

-   `getUserById()`: Get user with populated batch and organization
-   `getOrganizationById()`: Get organization with all users

### Services

#### Transfer Service

**File**: `backend/b2b-membership/services/transfer-service.js`

**Responsibilities**:

-   Database balance updates (optimistic locking)
-   Blockchain transfer execution
-   Token balance checking
-   Allowance verification
-   Dynamic decimal handling

**Key Methods**:

-   `transfer()`: Database balance update
-   `blockchainTransfer()`: On-chain transfer execution

#### User Management Service

**File**: `backend/b2b-membership/services/user-management-service.js`

**Responsibilities**:

-   User CRUD operations
-   Organization lookup
-   Reference number parsing
-   Batch management

**Key Methods**:

-   `generateReferenceNumber()`: Create unique user reference
-   `getOrganizationByReferenceNumber()`: Extract org from reference
-   `assignToBatch()`: Batch assignment logic

---

## Smart Contracts

### FinCube Contract

**Purpose**: Main transfer contract with ZKP verification

**Current Deployment**: `0x3688ed8BBf990Ea42Eb55aC0b133a03d5D8827e1` (Example: Celo Sepolia)

**EVM Compatibility**: Deploy to any EVM-compatible blockchain

**Key Function**:

```solidity
function safeTransfer(
    address to,
    uint256 amount,
    string calldata memo,
    bytes32 nullifier,
    bytes32 sender_reference_number,
    bytes32 receiver_reference_number,
    bytes calldata receiver_proof,
    bytes32[] calldata receiver_publicInputs
) external
```

**Features**:

-   ✅ Verifies receiver's ZKP proof via HonkVerifier
-   ✅ Checks nullifier uniqueness (prevents double-spending)
-   ✅ Transfers ERC20 tokens (USDC or any approved token)
-   ✅ Emits transfer events for audit trail
-   ✅ Supports memo for transaction metadata

### HonkVerifier Contract

**Purpose**: On-chain ZKP proof verification

**Current Deployment**: `0x4f6d3955E842Ee88B44f87c9A043baCecf24c097` (Example: Celo Sepolia)

**EVM Compatibility**: Deploy to any EVM-compatible blockchain

**Key Function**:

```solidity
function verify(
    bytes calldata proof,
    bytes32[] calldata publicInputs
) external view returns (bool)
```

**Features**:

-   ✅ Verifies Honk ZKP proofs
-   ✅ View function (no gas for calls)
-   ✅ Returns boolean verification result
-   ✅ Modular verification libraries for gas optimization

### Modular Verifier Components

**Location**: `web3/contracts/verifier/`

**Components**:

-   `BaseZKHonkVerifier.sol`: Core verification logic
-   `CommitmentSchemeLib.sol`: Commitment scheme operations
-   `ECOperations.sol`: Elliptic curve operations
-   `FrLib.sol`: Field arithmetic
-   `HonkTypes.sol`: Type definitions
-   `HonkVerificationKey.sol`: Verification key management
-   `RelationsLib.sol`: Constraint relations
-   `ZKTranscriptLib.sol`: Fiat-Shamir transcript

**Benefits**:

-   Gas optimization through library reuse
-   Modular testing and upgrades
-   Clear separation of concerns

### ERC20 Token Integration

**Current Token**: USDC (USD Coin)

**Why Stablecoins?**

-   💵 Price stability (~$1 USD)
-   📊 Predictable accounting
-   🌍 Cross-border transfers
-   🏢 Ideal for B2B transactions

**Supported Tokens**: Any ERC20 token approved by FinCube contract

**Automatic Decimal Handling**: System detects and handles token decimals automatically

**Recommended Stablecoins**:

-   USDC (USD Coin) - Current implementation
-   USDT (Tether)
-   DAI (Dai Stablecoin)
-   cUSD (Celo Dollar)
-   Network-specific stablecoins

---

## Database Architecture

### MongoDB Collections

#### users

```javascript
{
  _id: ObjectId,
  user_id: Number (unique, required),
  batch_id: ObjectId (ref: Batch),
  balance: Number (default: 0, min: 0),
  reference_number: String (unique, sparse),
  zkp_key: String (unique, required),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:

-   `user_id` (unique)
-   `zkp_key` (unique)
-   `reference_number` (unique, sparse)
-   `batch_id`

#### organizations

```javascript
{
  _id: ObjectId,
  org_id: Number (unique, required),
  wallet_address: String (unique, required),
  org_salt: String (unique, auto-generated),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:

-   `org_id` (unique)
-   `wallet_address` (unique)
-   `org_salt` (unique)

#### batches

```javascript
{
  _id: ObjectId,
  equation: [String] (polynomial coefficients as BigInt strings),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:

-   `_id` (primary key)

### Relationships

```
Organization (1) ←→ (N) User
     ↓
  org_salt used in user.reference_number

Batch (1) ←→ (N) User
     ↓
  batch_id (Foreign Key)

User.reference_number format:
  <wallet_address>_<uuid>
  Example: 0x1234...5678_550e8400-e29b-41d4-a716-446655440000
```

### Data Integrity

**Optimistic Locking**: Balance updates use version checking to prevent race conditions

**Atomic Operations**: MongoDB transactions ensure consistency

**Constraints**:

-   Balance cannot be negative
-   User IDs must be unique
-   Reference numbers must be unique
-   Organization salts must be unique

---

## Message Queue Integration

### RabbitMQ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RabbitMQ Broker                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  exchange.transaction-receipt.fanout           │    │
│  │  (Fanout Exchange)                             │    │
│  └────────────┬───────────────────────────────────┘    │
│               │                                          │
│               ├─→ audit-trail-queue                     │
│               ├─→ analytics-queue                       │
│               └─→ compliance-queue                      │
└─────────────────────────────────────────────────────────┘
```

### Transaction Receipt Event

Published after every successful cross-organization blockchain transfer:

```json
{
    "onChainData": {
        "transactionHash": "0x...",
        "signedBy": "0x...",
        "chainId": "44787",
        "context": {
            "fromUserId": 2001,
            "toUserId": 2002,
            "amount": 0.01,
            "senderWalletAddress": "0x...",
            "receiverWalletAddress": "0x...",
            "blockNumber": 12345,
            "gasUsed": "150000",
            "memo": "{...}",
            "nullifier": "0x..."
        }
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Event Consumers

External services can consume events for:

-   **Audit Trail**: Permanent transaction logging
-   **Analytics**: Transaction pattern analysis
-   **Compliance**: Regulatory reporting
-   **Monitoring**: Real-time alerts
-   **Fraud Detection**: Anomaly detection

### Configuration

-   **Exchange**: `exchange.transaction-receipt.fanout` (configurable)
-   **Type**: Fanout (broadcasts to all queues)
-   **Durable**: Yes (survives broker restarts)
-   **Non-Blocking**: Publishing failures don't affect transactions

### RabbitMQ Consumer

**Purpose**: Consumes user events from User Management Service (UMS)

**Exchange**: `exchange.ums.events` (topic exchange)

**Routing Keys**:

-   `user.created`
-   `user.updated`
-   `user.deleted`

**Event Handlers**: Process user lifecycle events for synchronization

---

## API Architecture

### REST Endpoints

#### Transfer API

**POST /api/transfer**

```json
Request:
{
  "receiver_reference_number": "0x1234...5678_550e8400-...",
  "amount": 100,
  "sender_user_id": 2001
}

Response (Same-Org):
{
  "success": true,
  "transferType": "SAME_ORGANIZATION",
  "database": { /* balance updates */ }
}

Response (Cross-Org):
{
  "success": true,
  "blockchain": { /* transaction details */ },
  "database": { /* balance updates */ }
}
```

#### Query API

**GET /api/query/user/:user_id**

```json
Response:
{
  "success": true,
  "user": {
    "user_id": 2001,
    "balance": 1000,
    "reference_number": "0x...",
    "batch": { /* batch details */ },
    "organization": { /* org details */ }
  }
}
```

**GET /api/query/organization/:org_id**

```json
Response:
{
  "success": true,
  "organization": {
    "org_id": 1001,
    "wallet_address": "0x...",
    "users": [ /* all users */ ]
  }
}
```

#### Proof API

**POST /api/proof/generate**

```json
Request:
{
  "testConfig": {
    "roots": ["123", "456", "789"],
    "userEmail": "test@example.com",
    "salt": "test_salt",
    "verifierKey": "key",
    "isKYCed": true
  }
}

Response:
{
  "success": true,
  "proof": "0x...",
  "publicInputs": ["0x...", "0x...", "0x..."]
}
```

**POST /api/proof/verify**

```json
Request:
{
  "proof": "0x...",
  "publicInputs": ["0x...", "0x...", "0x..."]
}

Response:
{
  "success": true,
  "verified": true
}
```

#### Health Check

**GET /health**

```json
Response:
{
  "status": "ok",
  "service": "zkp-proof-controller",
  "database": "connected",
  "rabbitmq": {
    "consumer": "connected",
    "publisher": "connected"
  }
}
```

### Error Responses

**Standard Error Format**:

```json
{
    "success": false,
    "error": {
        "type": "ERROR_TYPE_CONSTANT",
        "message": "Human-readable error message",
        "details": {
            /* Context-specific error details */
        }
    }
}
```

**Error Types**:

-   `INVALID_INPUT`: Invalid request parameters
-   `USER_NOT_FOUND`: User doesn't exist
-   `ORGANIZATION_NOT_FOUND`: Organization doesn't exist
-   `INSUFFICIENT_BALANCE`: Not enough balance for transfer
-   `PROOF_GENERATION_FAILED`: ZKP proof generation error
-   `BLOCKCHAIN_TRANSFER_FAILED`: On-chain transaction error
-   `DATABASE_ERROR`: Database operation error
-   `INTERNAL_ERROR`: Unexpected server error

---

## Security & Privacy

### Privacy Guarantees

**Zero-Knowledge Proofs**:

-   ✅ No membership information revealed
-   ✅ Proofs cannot be linked to specific users
-   ✅ Organization structure remains private
-   ✅ Forward secrecy (past proofs valid after member removal)

**Cryptographic Security**:

-   ✅ BN254 elliptic curve (128-bit security)
-   ✅ Poseidon2 hash function (zk-SNARK optimized)
-   ✅ Honk proof system (efficient verification)
-   ✅ Nullifiers prevent double-spending

### Attack Resistance

**Verification Caching**:

-   Nullifiers prevent redundant verification overhead
-   Cached verifications reduce on-chain costs
-   Unique per (user, verifier) pair

**Polynomial Integrity**:

-   Hash commitments ensure data authenticity
-   On-chain verification of polynomial hash
-   Prevents polynomial tampering

**KYC Bypass Prevention**:

-   Cryptographic enforcement of compliance
-   Cannot generate valid proof without KYC status
-   Circuit-level constraint enforcement

**Replay Attack Prevention**:

-   Nullifiers stored on-chain
-   Duplicate nullifiers rejected
-   Transaction uniqueness guaranteed

### Security Best Practices

**Private Key Management**:

-   Never commit private keys to version control
-   Use environment variables for sensitive data
-   Consider hardware wallets for production
-   Implement key rotation policies

**Smart Contract Security**:

-   Audited verifier contracts
-   Reentrancy guards
-   Access control mechanisms
-   Emergency pause functionality

**API Security**:

-   Input validation on all endpoints
-   Rate limiting to prevent abuse
-   HTTPS/TLS for all communications
-   Authentication and authorization (future enhancement)

---

## Deployment & Scalability

### EVM Chain Deployment

**FinCube is EVM-Agnostic**: Deploy to any EVM-compatible blockchain without code modifications.

**Supported Networks** (Examples):

-   Ethereum (Mainnet, Sepolia, Goerli)
-   Polygon (Mainnet, Mumbai)
-   Arbitrum (One, Goerli)
-   Optimism (Mainnet, Goerli)
-   Avalanche (C-Chain, Fuji)
-   BSC (Mainnet, Testnet)
-   Celo (Mainnet, Alfajores, Sepolia)
-   Base (Mainnet, Goerli)
-   Any EVM-compatible chain

**Deployment Steps**:

1. **Choose Network**: Select any EVM-compatible blockchain

2. **Deploy Contracts**: Deploy FinCube and HonkVerifier contracts

3. **Configure RPC**: Update `.env` with network RPC endpoint

    ```env
    ALCHEMY_URL=https://your-network-rpc-endpoint
    CHAIN_ID=your_chain_id
    ```

4. **Update Addresses**: Set deployed contract addresses

    ```env
    FINCUBE_CONTRACT_ADDRESS=0x...
    HONK_VERIFIER_CONTRACT_ADDRESS=0x...
    ```

5. **Configure Token**: Set ERC20 token address

6. **Start Application**: System auto-detects network parameters

### Scalability Architecture

**Horizontal Scaling**:

-   Stateless API servers (can run multiple instances)
-   Load balancer distribution
-   MongoDB replica sets
-   RabbitMQ clustering

**Vertical Scaling**:

-   Increase server resources for proof generation
-   Optimize database queries with indexes
-   Cache frequently accessed data

**Batch System Scaling**:

-   Automatic batch creation when capacity reached
-   Independent polynomial operations
-   Parallel proof generation
-   Linear scalability with user growth

### Performance Optimization

**Database**:

-   Indexes on all unique fields
-   Connection pooling
-   Query optimization
-   Aggregation pipelines for complex queries

**Blockchain**:

-   Gas optimization in smart contracts
-   Batch transactions where possible
-   Efficient proof verification
-   Modular verifier libraries

**Proof Generation**:

-   Proof caching (future enhancement)
-   Parallel batch processing
-   Optimized polynomial evaluation
-   Circuit compilation caching

### Monitoring & Observability

**Logging**:

-   Structured logging with Winston
-   Log levels: INFO, WARN, ERROR, DEBUG
-   Request/response logging
-   Performance metrics (duration tracking)

**Metrics to Track**:

-   Transfer request rate
-   Transfer success/failure rate
-   Average transfer latency
-   Proof generation latency
-   Blockchain transaction latency
-   Database query performance
-   RabbitMQ queue depths
-   Error rates by type

**Alerting**:

-   Database connection failures
-   RabbitMQ connection issues
-   Blockchain transaction failures
-   High error rates
-   Performance degradation

### Production Considerations

**High Availability**:

-   Multiple API server instances
-   MongoDB replica sets
-   RabbitMQ clustering
-   Load balancer health checks

**Disaster Recovery**:

-   Regular MongoDB backups
-   Smart contract address documentation
-   Private key backup (secure storage)
-   RabbitMQ configuration backup

**Security Hardening**:

-   Secrets management (AWS Secrets Manager, HashiCorp Vault)
-   Network isolation
-   Firewall rules
-   DDoS protection
-   Rate limiting

---

## Development Workflow

### Environment Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd backend

# 2. Install dependencies
cd b2b-membership
npm install

cd ../base
npm install

# 3. Configure environment
cd ../b2b-membership
cp .env.example .env
# Edit .env with your configuration

# 4. Start MongoDB
docker-compose up -d mongodb

# 5. Start RabbitMQ
docker-compose up -d rabbitmq

# 6. Start application
npm start
```

### Configuration

**Environment Variables** (`.env`):

```env
# RPC Provider (Any EVM-compatible endpoint)
ALCHEMY_URL=https://your-network-rpc-endpoint
CHAIN_ID=1  # Auto-detected if not specified

# Smart Contracts
HONK_VERIFIER_CONTRACT_ADDRESS=0x...
FINCUBE_CONTRACT_ADDRESS=0x...

# Wallet
WALLET_PRIVATE_KEY=your_private_key

# Server
PORT=7000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/b2b-membership

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_EXCHANGE=exchange.ums.events
RABBITMQ_TRANSACTION_RECEIPT_EXCHANGE=exchange.transaction-receipt.fanout
```

### Testing

**Test Files**:

-   `test-models.js` - Database model validation
-   `test-database-connection.js` - MongoDB connection
-   `test-app-startup.js` - Application lifecycle
-   `test-query-api.js` - Query endpoints
-   `test-transfer-controller-basic.js` - Transfer controller
-   `test-transfer-service.js` - Transfer service
-   `test-same-org-transfer.js` - Same-org transfers
-   `test-api-with-config.js` - Proof generation
-   `test-verify-api.js` - Proof verification
-   `test-rabbitmq-publisher.js` - RabbitMQ publishing
-   `test-blockchain-integration.js` - Blockchain integration

**Run Tests**:

```bash
# Run all tests
node run-all-tests.js

# Run specific test
node test-transfer-controller-basic.js
node test-same-org-transfer.js
```

### Development Tools

**Blockchain Interaction**:

```bash
# Check token balance
node check-token-balance.js

# Approve FinCube contract
node approve-fincube.js 1000

# Check contract configuration
node check-contract.js
```

**Database Management**:

```bash
# Check indexes
node check-indexes.js

# Fix indexes
node fix-indexes.js

# Verify setup
node verify-setup.js
```

**MongoDB Access**:

-   **Web UI**: http://localhost:8081 (Mongo Express)
    -   Username: admin
    -   Password: admin123
-   **CLI**: `mongo mongodb://localhost:27017/b2b-membership`

**RabbitMQ Management**:

-   **Web UI**: http://localhost:15672
    -   Username: guest
    -   Password: guest

### Debugging

**Check Logs**:

```bash
# Application logs
tail -f logs/app.log

# Docker logs
docker-compose logs -f
```

**Common Issues**:

1. **Insufficient Balance**: Check token balance and approve contract
2. **RabbitMQ Connection**: Verify RabbitMQ is running on correct network
3. **MongoDB Connection**: Check connection string and credentials
4. **Blockchain Errors**: Verify contract addresses and network config
5. **Proof Generation**: Check circuit compilation and Noir installation

---

## Documentation

### Core Documentation

**B2B Membership Service**:

-   `backend/b2b-membership/PROJECT_CONTEXT.md` - Service-specific context
-   `backend/b2b-membership/API_USAGE.md` - API reference
-   `backend/b2b-membership/RABBITMQ_TRANSACTION_EVENTS.md` - Event integration
-   `backend/b2b-membership/BLOCKCHAIN_INTEGRATION_COMPLETE.md` - Blockchain details
-   `backend/b2b-membership/README.md` - Quick start guide

**ZKP Base System**:

-   `backend/base/README.md` - ZKP system overview
-   `backend/base/POLYNOMIAL_DEGREE_UPDATE.md` - Degree configuration
-   `backend/base/REDEPLOY_VERIFIER.md` - Verifier deployment

**Smart Contracts**:

-   `web3/contracts/MODULARIZATION_GUIDE.md` - Contract architecture
-   `web3/contracts/verifier/README.md` - Verifier components
-   `web3/contracts/verifier/VERIFICATION_REPORT.md` - Verification details

### Additional Resources

**Guides**:

-   `QUICK_START.md` - Getting started
-   `SCHEMA_MIGRATION_GUIDE.md` - Database migrations
-   `TROUBLESHOOTING.md` - Common issues

**Session Notes**:

-   `SESSION_SUMMARY.md` - Development sessions
-   `TEST_RESULTS.md` - Test execution results
-   `IMPLEMENTATION_COMPLETE.md` - Implementation milestones

---

## Architecture Decisions

### Why Dual Transfer Modes?

**Same-Organization**:

-   Optimized for speed and cost
-   No blockchain overhead
-   Suitable for internal transfers
-   Database-only operation

**Cross-Organization**:

-   Prioritizes security and auditability
-   Blockchain + ZKP verification
-   Complete audit trail
-   Regulatory compliance

### Why Zero-Knowledge Proofs?

-   **Privacy**: Proves membership without revealing identity
-   **Security**: Cryptographically secure verification
-   **Compliance**: KYC enforcement without data exposure
-   **Scalability**: Batch system supports unlimited users

### Why RabbitMQ?

-   **Decoupling**: Separates transaction execution from audit logging
-   **Flexibility**: Multiple consumers (audit, analytics, compliance)
-   **Reliability**: Guaranteed message delivery
-   **Scalability**: Event-driven architecture

### Why MongoDB?

-   **Flexibility**: Schema evolution without migrations
-   **Performance**: Optimized for read-heavy workloads
-   **Scalability**: Horizontal scaling with sharding
-   **Developer Experience**: Native JavaScript integration

### Why Stablecoins?

-   **Price Stability**: Maintains consistent value
-   **Predictable Accounting**: Simplifies financial reporting
-   **User Experience**: No price fluctuation concerns
-   **B2B Suitability**: Ideal for business transactions

---

## Future Enhancements

### Planned Features

**Multi-Token Support**:

-   Support multiple stablecoins simultaneously
-   Dynamic token selection per transfer
-   Automatic exchange rate handling

**Batch Transfers**:

-   Execute multiple transfers in single transaction
-   Reduced gas costs
-   Improved efficiency

**Advanced Features**:

-   Transaction history storage
-   Webhook notifications
-   GraphQL API
-   Mobile SDK
-   Fiat on/off ramps

**Security Enhancements**:

-   Multi-signature wallets
-   Time-locked transfers
-   Fraud detection integration
-   Advanced rate limiting

**Performance Optimizations**:

-   Proof caching
-   Database query optimization
-   Connection pooling improvements
-   CDN integration

### Roadmap

**Phase 1** (Current):

-   ✅ Core transfer functionality
-   ✅ ZKP proof generation
-   ✅ Blockchain integration
-   ✅ RabbitMQ events
-   ✅ Same-org optimization

**Phase 2** (Next):

-   Multi-token support
-   Batch transfers
-   Transaction history
-   Enhanced monitoring

**Phase 3** (Future):

-   GraphQL API
-   Mobile SDK
-   Advanced analytics
-   Fraud detection

---

## Support & Maintenance

### Getting Help

1. **Documentation**: Review relevant documentation files
2. **Test Files**: Check test files for usage examples
3. **Logs**: Examine application logs for error details
4. **Health Check**: Use `/health` endpoint to verify service status

### Common Troubleshooting

**Issue**: Transfer fails with "Insufficient balance"
**Solution**: Check sender's token balance and ensure sufficient funds

**Issue**: Transfer fails with "Insufficient allowance"
**Solution**: Approve FinCube contract to spend tokens: `node approve-fincube.js <amount>`

**Issue**: RabbitMQ connection error
**Solution**: Verify RabbitMQ is running and accessible on configured network

**Issue**: MongoDB connection error
**Solution**: Check MongoDB URI and ensure database is running

**Issue**: Blockchain transaction fails
**Solution**: Verify contract addresses, network configuration, and wallet has gas

### Maintenance Tasks

**Regular**:

-   Monitor application logs
-   Check RabbitMQ queue depths
-   Review blockchain transaction status
-   Verify database performance

**Periodic**:

-   Update dependencies
-   Review and rotate secrets
-   Backup MongoDB data
-   Audit smart contract interactions

**As Needed**:

-   Scale infrastructure
-   Optimize database indexes
-   Update smart contracts
-   Migrate to new networks

---

## License

MIT

## Contact & Support

For technical support, questions, or contributions:

-   **Repository**: [GitHub Repository URL]
-   **Documentation**: Review files in `backend/` directory
-   **Issues**: Open an issue in the repository
-   **Email**: [Contact Email]

---

**Last Updated**: 2024-01-21

**Maintained By**: FinCube Development Team

---

**Built with ❤️ for privacy-preserving B2B financial infrastructure**
