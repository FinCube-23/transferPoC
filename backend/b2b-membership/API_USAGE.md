# ZKP Proof Controller API Usage Guide

## Overview

The ZKP Proof Controller provides REST API endpoints for generating and verifying zero-knowledge proofs. This guide explains how to use the API with custom test configurations.

## API Endpoints

### 1. Query User by ID

**Endpoint:** `GET /api/query/user/:user_id`

**Description:** Retrieves a user by their user_id with populated batch and organization data.

#### Request Format

```
GET /api/query/user/2001
```

#### Response Format

**Success Response:**

```json
{
    "success": true,
    "user": {
        "_id": "...",
        "user_id": 2001,
        "balance": 100,
        "reference_number": "REF-ORG-001-USER-001",
        "zkp_key": "0x1234...",
        "batch_id": {
            "_id": "...",
            "equation": ["123", "456", "789"],
            "createdAt": "...",
            "updatedAt": "..."
        },
        "organization": {
            "_id": "...",
            "org_id": 1001,
            "wallet_address": "0xabc...",
            "org_salt": "...",
            "createdAt": "...",
            "updatedAt": "..."
        },
        "createdAt": "...",
        "updatedAt": "..."
    }
}
```

**Error Response:**

```json
{
    "success": false,
    "error": {
        "type": "USER_NOT_FOUND",
        "message": "User not found with user_id: 2001"
    }
}
```

### 2. Query Organization by ID

**Endpoint:** `GET /api/query/organization/:org_id`

**Description:** Retrieves an organization by org_id with all associated users (populated with batch data).

#### Request Format

```
GET /api/query/organization/1001
```

#### Response Format

**Success Response:**

```json
{
    "success": true,
    "organization": {
        "_id": "...",
        "org_id": 1001,
        "wallet_address": "0xabc...",
        "org_salt": "...",
        "createdAt": "...",
        "updatedAt": "...",
        "users": [
            {
                "_id": "...",
                "user_id": 2001,
                "balance": 100,
                "reference_number": "REF-ORG-001-USER-001",
                "zkp_key": "0x1234...",
                "batch_id": {
                    "_id": "...",
                    "equation": ["123", "456", "789"],
                    "createdAt": "...",
                    "updatedAt": "..."
                },
                "createdAt": "...",
                "updatedAt": "..."
            }
        ]
    }
}
```

**Error Response:**

```json
{
    "success": false,
    "error": {
        "type": "ORGANIZATION_NOT_FOUND",
        "message": "Organization not found with org_id: 1001"
    }
}
```

### 3. Execute ZKP-Enabled Transfer

**Endpoint:** `POST /api/transfer`

**Description:** Executes a complete ZKP-enabled transfer from sender to receiver, including proof generation, blockchain transaction, RabbitMQ event publishing, and database balance updates.

#### Transfer Types

The system supports two types of transfers:

1. **Same-Organization Transfer** - When sender and receiver belong to the same organization:
   - Skips blockchain transaction and ZKP proof generation
   - Only updates database balances
   - Faster and more cost-effective

2. **Cross-Organization Transfer** - When sender and receiver belong to different organizations:
   - Generates ZKP proof for receiver verification
   - Executes blockchain transaction via FinCube contract
   - Publishes transaction receipt to RabbitMQ
   - Updates database balances

#### Workflow Steps (Cross-Organization Transfer)

The transfer endpoint orchestrates a 7-step workflow:

1. **[STEP 1/7] Input Validation** - Validates request parameters
2. **[STEP 2/7] User Data Retrieval** - Fetches sender, receiver, and organization information
3. **[STEP 3/7] ZKP Proof Generation** - Generates zero-knowledge proof for receiver verification
4. **[STEP 4/7] Nullifier Generation** - Creates unique 32-byte transaction identifier
5. **[STEP 5/7] Memo Creation** - Builds JSON memo with transfer metadata
6. **[STEP 6/7] Blockchain Transfer** - Executes on-chain transfer via FinCube contract
7. **[STEP 7/7] Publish Transaction Receipt** - Emits event to RabbitMQ for audit trail
8. **[STEP 8/7] Database Update** - Updates sender and receiver balances in MongoDB

**Note:** Steps 3-7 are skipped for same-organization transfers.

#### Request Format

```json
{
    "receiver_reference_number": "0x1234567890123456789012345678901234567890_uuid-here",
    "amount": 0.01,
    "sender_user_id": 2001
}
```

#### Field Descriptions

-   **receiver_reference_number** (required): String - Receiver's unique reference number (format: `{wallet_address}_{uuid}`)
-   **amount** (required): Number - Transfer amount in tokens (must be positive)
-   **sender_user_id** (required): Number - Sender's user ID (positive integer)

#### Response Format

**Success Response (Same-Organization Transfer):**

```json
{
    "success": true,
    "transferType": "SAME_ORGANIZATION",
    "database": {
        "fromUserId": 2001,
        "toUserId": 2002,
        "amount": 0.01,
        "senderPreviousBalance": 100,
        "senderNewBalance": 99.99,
        "receiverPreviousBalance": 50,
        "receiverNewBalance": 50.01,
        "timestamp": "2024-01-01T00:00:00.000Z",
        "transactionMode": "optimistic_locking"
    }
}
```

**Success Response (Cross-Organization Transfer - Both Blockchain and Database Succeeded):**

```json
{
    "success": true,
    "blockchain": {
        "fromUserId": 2001,
        "toUserId": 2002,
        "amount": 0.01,
        "memo": "{\"sender_reference_number\":\"...\",\"receiver_reference_number\":\"...\",\"sender_wallet_address\":\"0x...\",\"receiver_wallet_address\":\"0x...\",\"amount\":0.01,\"timestamp\":\"2024-01-01T00:00:00.000Z\"}",
        "nullifier": "0x1234567890abcdef...",
        "senderWalletAddress": "0xabc...",
        "receiverWalletAddress": "0xdef...",
        "senderReferenceNumber": "0x...",
        "receiverReferenceNumber": "0x...",
        "transactionHash": "0x123abc...",
        "blockNumber": 12345,
        "gasUsed": "150000",
        "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "database": {
        "fromUserId": 2001,
        "toUserId": 2002,
        "amount": 0.01,
        "senderPreviousBalance": 100,
        "senderNewBalance": 99.99,
        "receiverPreviousBalance": 50,
        "receiverNewBalance": 50.01,
        "timestamp": "2024-01-01T00:00:00.000Z",
        "transactionMode": "optimistic_locking"
    }
}
```

**Note:** For cross-organization transfers, a transaction receipt event is automatically published to RabbitMQ exchange `exchange.transaction-receipt.fanout` for audit trail purposes. See `RABBITMQ_TRANSACTION_EVENTS.md` for details.

**Partial Success Response (Blockchain Succeeded, Database Failed):**

```json
{
    "success": true,
    "warning": "BLOCKCHAIN_SUCCEEDED_DATABASE_FAILED",
    "blockchain": {
        "transactionHash": "0x123abc...",
        "blockNumber": 12345,
        "gasUsed": "150000",
        ...
    },
    "database": {
        "error": "Failed to update receiver balance - balance was modified by another operation",
        "details": {
            "fromUserId": 2001,
            "toUserId": 2002,
            "amount": 0.01
        }
    }
}
```

**Error Response:**

```json
{
    "success": false,
    "error": {
        "type": "INSUFFICIENT_BALANCE",
        "message": "Insufficient token balance. Available: 0.000000000001 tokens, Required: 0.01 tokens",
        "details": {
            "fromUserId": 2001,
            "toUserId": 2002,
            "amount": 0.01
        }
    }
}
```

#### Common Error Types

-   **INVALID_INPUT**: Invalid request parameters
-   **USER_NOT_FOUND**: Sender or receiver not found
-   **ORGANIZATION_NOT_FOUND**: Organization not found for reference number
-   **PROOF_GENERATION_FAILED**: ZKP proof generation failed
-   **MEMO_TOO_LONG**: Transfer memo exceeds 1024 bytes
-   **INSUFFICIENT_BALANCE**: Insufficient token balance for transfer
-   **INSUFFICIENT_ALLOWANCE**: FinCube contract not approved to spend tokens
-   **NULLIFIER_ALREADY_USED**: Nullifier has been used in a previous transaction
-   **BLOCKCHAIN_TRANSFER_FAILED**: On-chain transaction failed
-   **DATABASE_ERROR**: Database operation failed

### 4. Generate Proof

**Endpoint:** `POST /api/proof/generate`

**Description:** Generates a ZKP proof using either custom test configuration or default values.

#### Request Format

```json
{
    "testConfig": {
        "roots": ["123", "456", "789"],
        "userEmail": "test@example.com",
        "salt": "test_salt_123",
        "verifierKey": "verifier_key_456",
        "isKYCed": true
    }
}
```

**Note:** The `testConfig` object is **optional**. If not provided, the system uses default values from `test_data_generator.js`.

#### Field Descriptions

-   **roots** (optional): Array of strings representing BigInt values. These are the roots of the polynomial.
-   **userEmail** (optional): String - User's email address used in secret generation.
-   **salt** (optional): String - Salt value for secret generation.
-   **verifierKey** (optional): String - Verifier key identifier.
-   **isKYCed** (optional): Boolean - KYC status flag.

#### Response Format

**Success Response:**

```json
{
    "success": true,
    "proof": "0x1234...",
    "publicInputs": ["0xabcd...", "0xef01..."],
    "artifacts": {
        "bytecode": "...",
        "verificationKey": "..."
    }
}
```

**Error Response:**

```json
{
    "success": false,
    "error": {
        "type": "TEST_DATA_GENERATION_FAILED",
        "message": "Failed to generate test data",
        "step": "test_data_generation",
        "details": {
            "exitCode": 1,
            "stdout": "...",
            "stderr": "..."
        }
    }
}
```

### 5. Verify Proof

**Endpoint:** `POST /api/proof/verify`

**Description:** Verifies a proof against the on-chain Honk Verifier contract.

#### Request Format

```json
{
    "proof": "0x1234...",
    "publicInputs": [
        "0x0000000000000000000000000000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000000000000000000000000000002"
    ]
}
```

#### Response Format

**Success Response:**

```json
{
    "success": true,
    "verified": true
}
```

**Error Response:**

```json
{
    "success": false,
    "error": {
        "type": "VERIFICATION_FAILED",
        "message": "Contract verification failed",
        "revertReason": "Proof consistency validation failed"
    }
}
```

## Usage Examples

### Using cURL

#### Query User by ID

```bash
curl http://localhost:7000/api/query/user/2001
```

#### Query Organization by ID

```bash
curl http://localhost:7000/api/query/organization/1001
```

#### Execute Transfer

```bash
curl -X POST http://localhost:7000/api/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_reference_number": "0x1234567890123456789012345678901234567890_uuid-here",
    "amount": 0.01,
    "sender_user_id": 2001
  }'
```

#### Generate Proof with Custom Config

```bash
curl -X POST http://localhost:8000/api/proof/generate \
  -H "Content-Type: application/json" \
  -d '{
    "testConfig": {
      "roots": ["123", "456", "789"],
      "userEmail": "test@example.com",
      "salt": "test_salt_123",
      "verifierKey": "verifier_key_456",
      "isKYCed": true
    }
  }'
```

#### Generate Proof with Default Config

```bash
curl -X POST http://localhost:8000/api/proof/generate \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Verify Proof

```bash
curl -X POST http://localhost:8000/api/proof/verify \
  -H "Content-Type: application/json" \
  -d '{
    "proof": "0x1234...",
    "publicInputs": ["0x0000...0001", "0x0000...0002"]
  }'
```

### Using Node.js

#### Query User by ID

```javascript
const axios = require("axios")

const response = await axios.get("http://localhost:7000/api/query/user/2001")
console.log(response.data)
```

#### Query Organization by ID

```javascript
const axios = require("axios")

const response = await axios.get(
    "http://localhost:7000/api/query/organization/1001"
)
console.log(response.data)
```

#### Execute Transfer

```javascript
const axios = require("axios")

const response = await axios.post("http://localhost:7000/api/transfer", {
    receiver_reference_number:
        "0x1234567890123456789012345678901234567890_uuid-here",
    amount: 0.01,
    sender_user_id: 2001,
})

console.log(response.data)

// Check if transfer succeeded
if (response.data.success) {
    console.log("Transfer completed!")
    console.log("Transaction Hash:", response.data.blockchain.transactionHash)
    console.log(
        "New Sender Balance:",
        response.data.database.senderNewBalance
    )
    console.log(
        "New Receiver Balance:",
        response.data.database.receiverNewBalance
    )
}
```

#### Generate Proof with Custom Config

```javascript
const response = await fetch("http://localhost:8000/api/proof/generate", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        testConfig: {
            roots: ["123", "456", "789"],
            userEmail: "test@example.com",
            salt: "test_salt_123",
            verifierKey: "verifier_key_456",
            isKYCed: true,
        },
    }),
})

const result = await response.json()
console.log(result)
```

#### Using Test Scripts

We provide test scripts for easy testing:

**Test query endpoints:**

```bash
node test-query-api.js [user_id] [org_id]
# Example: node test-query-api.js 2001 1001
```

**Test transfer endpoint:**

```bash
# First, ensure you have sufficient token balance and allowance
node check-token-balance.js
node approve-fincube.js 1000

# Then test the transfer
# (Use your actual test script or create one)
```

**Test proof generation with custom config:**

```bash
node test-api-with-config.js
```

**Test proof generation with default config:**

```bash
node test-api-default.js
```

### Using Postman or Thunder Client

#### Transfer Request

1. **Method:** POST
2. **URL:** `http://localhost:7000/api/transfer`
3. **Headers:**
    - `Content-Type: application/json`
4. **Body (raw JSON):**
    ```json
    {
        "receiver_reference_number": "0x1234567890123456789012345678901234567890_uuid-here",
        "amount": 0.01,
        "sender_user_id": 2001
    }
    ```

#### Proof Generation Request

1. **Method:** POST
2. **URL:** `http://localhost:7000/api/proof/generate`
3. **Headers:**
    - `Content-Type: application/json`
4. **Body (raw JSON):**
    ```json
    {
        "testConfig": {
            "roots": ["123", "456", "789"],
            "userEmail": "test@example.com",
            "salt": "test_salt_123",
            "verifierKey": "verifier_key_456",
            "isKYCed": true
        }
    }
    ```

## Transfer Prerequisites

Before executing transfers, ensure the following:

### 1. Token Balance

The sender's wallet must have sufficient ERC20 tokens for the transfer amount.

**Check token balance:**

```bash
node check-token-balance.js
```

This will show:
- Token decimals
- Current balance (raw units and formatted)
- Allowance for FinCube contract
- Whether you have enough for a test transfer

### 2. Token Allowance

The FinCube contract must be approved to spend tokens from the sender's wallet.

**Approve FinCube contract:**

```bash
node approve-fincube.js 1000
```

This approves the FinCube contract to spend up to 1000 tokens.

### 3. User Setup

- Both sender and receiver must exist in the database
- Sender must have a valid `reference_number`
- Receiver must have a valid `reference_number`
- Both users must be associated with organizations
- Both users must have populated `batch_id` (for ZKP proof generation)

### 4. Smart Contract Configuration

Ensure your `.env` file has the correct contract addresses:

```env
FINCUBE_CONTRACT_ADDRESS=0x...
HONK_VERIFIER_CONTRACT_ADDRESS=0x...
```

## Important Notes

### BigInt Handling

JavaScript's `BigInt` type (e.g., `123n`) cannot be serialized to JSON directly. When sending requests:

-   ❌ **Wrong:** `{"roots": [123n, 456n, 789n]}`
-   ✅ **Correct:** `{"roots": ["123", "456", "789"]}`

The API will convert string values to BigInt internally.

### Path with Spaces

The implementation handles file paths with spaces correctly by quoting paths when executing shell commands.

### Test Data Generation Logic

The API now intelligently handles test data generation:

1. **If `testConfig` is provided:** Uses the provided values to generate `Prover.toml` directly without calling the external script.
2. **If `testConfig` is NOT provided:** Calls the `test_data_generator.js` script to use default values.

This approach:

-   ✅ Avoids path issues with spaces
-   ✅ Allows custom test configurations via API
-   ✅ Maintains backward compatibility with default behavior
-   ✅ Improves performance by avoiding unnecessary script execution

## Error Handling

The API provides detailed error responses for debugging:

### Transfer Error Types

-   **INVALID_INPUT**: Invalid request parameters (missing fields, wrong types, negative amounts)
-   **USER_NOT_FOUND**: Sender or receiver not found in database
-   **ORGANIZATION_NOT_FOUND**: Organization not found for reference number
-   **DATABASE_ERROR**: Failed to retrieve user data from MongoDB
-   **PROOF_GENERATION_FAILED**: ZKP proof generation failed for receiver
-   **MEMO_TOO_LONG**: Transfer memo exceeds 1024 bytes limit
-   **INSUFFICIENT_BALANCE**: Sender doesn't have enough tokens
-   **INSUFFICIENT_ALLOWANCE**: FinCube contract not approved to spend tokens
-   **NULLIFIER_ALREADY_USED**: Nullifier has been used in a previous transaction
-   **BLOCKCHAIN_TRANSFER_FAILED**: On-chain transaction failed
-   **CONCURRENT_MODIFICATION**: Database balance was modified by another operation
-   **INTERNAL_ERROR**: Unexpected error during transfer workflow

### Proof Generation Error Types

-   **TEST_DATA_GENERATION_FAILED**: Failed to generate or write test data
-   **COMPILATION_FAILED**: Circuit compilation error
-   **WITNESS_GENERATION_FAILED**: Witness generation error
-   **PROOF_GENERATION_FAILED**: Proof generation error
-   **VERIFICATION_FAILED**: On-chain verification failed
-   **INVALID_INPUT**: Request validation failed

Each error includes:

-   `type`: Error category
-   `message`: Human-readable description
-   `step`: Which workflow step failed (for proof generation)
-   `details`: Additional debugging information

## Workflow Steps

### Transfer Workflow

#### Same-Organization Transfer

When sender and receiver belong to the same organization:

1. **Input Validation** - Validates request parameters
2. **User Data Retrieval** - Fetches sender, receiver, and organization data
3. **Organization Check** - Detects same organization (skips steps 4-7)
4. **Database Update** - Updates user balances in MongoDB

This is faster and more cost-effective as it skips blockchain operations.

#### Cross-Organization Transfer

When sender and receiver belong to different organizations:

1. **[STEP 1/7] Input Validation** - Validates request parameters
2. **[STEP 2/7] User Data Retrieval** - Fetches sender, receiver, and organization data
3. **[STEP 3/7] ZKP Proof Generation** - Generates zero-knowledge proof for receiver verification
4. **[STEP 4/7] Nullifier Generation** - Creates unique 32-byte transaction identifier
5. **[STEP 5/7] Memo Creation** - Builds JSON memo with transfer metadata
6. **[STEP 6/7] Blockchain Transfer** - Executes on-chain transfer via FinCube contract
7. **[STEP 7/7] Publish Transaction Receipt** - Emits event to RabbitMQ (exchange: `exchange.transaction-receipt.fanout`)
8. **[STEP 8/7] Database Update** - Updates sender and receiver balances in MongoDB

**Error Handling:**
- If any step fails before blockchain transfer, the workflow halts and returns an error
- If blockchain succeeds but database fails, a partial success response is returned with a warning
- If RabbitMQ publishing fails, the error is logged but the transaction is still considered successful

**RabbitMQ Event:**
After a successful blockchain transfer, a transaction receipt event is published to RabbitMQ for audit trail services. The event includes:
- Transaction hash
- Sender and receiver wallet addresses
- Chain ID
- Block number and gas used
- Transfer amount and memo
- Nullifier

See `RABBITMQ_TRANSACTION_EVENTS.md` for complete event structure and consumer implementation.

### Proof Generation Workflow

The proof generation workflow executes these steps in order:

1. **Test Data Generation** - Creates `Prover.toml` with circuit inputs
2. **Circuit Compilation** - Compiles Noir circuit to bytecode
3. **Witness Generation** - Generates witness from inputs
4. **Proof Generation** - Creates ZKP proof using Barretenberg

If any step fails, the workflow halts and returns an error with details about the failure.

## Server Configuration

Ensure your `.env` file is properly configured:

```env
# Alchemy Configuration
ALCHEMY_API_KEY=your_api_key_here
ALCHEMY_NETWORK=celo-sepolia
ALCHEMY_URL=https://celo-sepolia.g.alchemy.com/v2/your_api_key_here

# Smart Contract Configuration
HONK_VERIFIER_CONTRACT_ADDRESS=0x...
FINCUBE_CONTRACT_ADDRESS=0x...

# Wallet Configuration
WALLET_PRIVATE_KEY=your_private_key_here

# Server Configuration
PORT=7000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/b2b-membership
MONGODB_DB_NAME=b2b-membership

# RabbitMQ Configuration
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_TRANSACTION_RECEIPT_EXCHANGE=exchange.transaction-receipt.fanout

# Chain ID (used in transaction receipt events)
# Celo Alfajores: 44787, Celo Mainnet: 42220, Ethereum Sepolia: 11155111
CHAIN_ID=44787
```

## Starting the Server

```bash
cd backend/b2b-membership
npm start
```

The server will start on `http://localhost:7000` (or the port specified in `.env`).

## Health Check

Verify the server is running:

```bash
curl http://localhost:7000/health
```

Expected response:

```json
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

## RabbitMQ Integration

### Transaction Receipt Events

After every successful cross-organization blockchain transfer, the system automatically publishes a transaction receipt event to RabbitMQ. This enables:

- **Audit Trail** - Track all blockchain transactions
- **Monitoring** - Real-time transaction monitoring
- **Analytics** - Transaction data analysis
- **Compliance** - Regulatory reporting

#### Event Structure

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

#### Configuration

- **Exchange**: `exchange.transaction-receipt.fanout` (configurable via `RABBITMQ_TRANSACTION_RECEIPT_EXCHANGE`)
- **Exchange Type**: Fanout (broadcasts to all bound queues)
- **Durable**: Yes
- **Non-Blocking**: Publishing failures don't affect transaction success

#### Consumer Example

See `RABBITMQ_TRANSACTION_EVENTS.md` for:
- Complete event structure
- Consumer implementation examples (NestJS)
- Testing procedures
- Troubleshooting guide

#### Testing RabbitMQ Publisher

```bash
# Test the publisher
node test-rabbitmq-publisher.js

# Check publisher status
curl http://localhost:7000/health
```

## Quick Start Guide

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Start Services

```bash
# Start MongoDB and Mongo Express using Docker Compose
docker-compose up -d

# Verify services are running
docker ps

# Access Mongo Express (MongoDB GUI)
# URL: http://localhost:8081
# Username: admin
# Password: admin123
```

**Note:** Ensure RabbitMQ is running on the `fincube23_network` for transaction receipt publishing.

### 3. Start Server

```bash
npm start
```

### 4. Check Token Balance and Approve

```bash
# Check your token balance
node check-token-balance.js

# Approve FinCube contract (if needed)
node approve-fincube.js 1000
```

### 5. Test APIs

```bash
# Test query endpoints
node test-query-api.js 2001 1001

# Test proof generation
node test-api-with-config.js

# Execute a transfer (via API call)
curl -X POST http://localhost:7000/api/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_reference_number": "your_receiver_ref",
    "amount": 0.01,
    "sender_user_id": 2001
  }'
```
