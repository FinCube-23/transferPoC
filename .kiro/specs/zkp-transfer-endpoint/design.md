# Design Document: ZKP-Enabled Transfer Endpoint

## Overview

The ZKP-enabled transfer endpoint provides a secure, privacy-preserving mechanism for transferring funds between users. The endpoint orchestrates a complex workflow that includes:

1. User and organization data retrieval using reference numbers
2. Zero-knowledge proof generation for receiver verification
3. Unique nullifier generation for transaction uniqueness
4. Comprehensive memo creation for audit trails
5. On-chain transfer execution via FinCube smart contract
6. Off-chain database balance updates

The design ensures atomicity, security, and privacy while maintaining a complete audit trail. The endpoint serves as the orchestration layer that coordinates between multiple services (User Management, Proof Generation, Transfer Service) to execute a complete transfer operation.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Application                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ POST /api/transfer
                             │ { receiver_reference_number, amount, sender_user_id }
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Transfer Controller                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Validate inputs                                       │  │
│  │  2. Retrieve sender & receiver data                       │  │
│  │  3. Generate ZKP proof for receiver                       │  │
│  │  4. Generate unique nullifier                             │  │
│  │  5. Create transfer memo                                  │  │
│  │  6. Execute blockchain transfer                           │  │
│  │  7. Update database balances                              │  │
│  │  8. Return response                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ User Management  │  │ Proof Controller │  │ Transfer Service │
│    Service       │  │                  │  │                  │
│                  │  │                  │  │                  │
│ - Get org by ref │  │ - Generate proof │  │ - Blockchain tx  │
│ - Get user data  │  │ - Generate       │  │ - Database update│
│                  │  │   public inputs  │  │                  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         ▼                     ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   MongoDB        │  │  Noir Circuit    │  │  FinCube Smart   │
│   Database       │  │  (ZKP)           │  │  Contract        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Request Flow

1. **Input Validation**: Validate receiver_reference_number, amount, and sender_user_id
2. **Data Retrieval**:
    - Extract receiver organization from reference number
    - Query receiver user by reference number
    - Query sender user by user_id with populated batch_id
3. **Proof Generation**:
    - Call ProofController.generateProofService() with receiver data
    - Receive proof bytes and public inputs array
4. **Nullifier Generation**: Generate unique 32-byte random nullifier
5. **Memo Creation**: Create JSON memo with transfer metadata
6. **Blockchain Transfer**: Call TransferService.blockchainTransfer()
7. **Database Update**: Call TransferService.transfer() to update balances
8. **Response**: Return success/error response with transaction details

## Components and Interfaces

### Transfer Controller

**File**: `backend/b2b-membership/controllers/transfer-controller.js`

**Responsibilities**:

-   Validate incoming transfer requests
-   Orchestrate the transfer workflow
-   Handle errors and return appropriate responses
-   Log transfer operations

**Key Methods**:

```javascript
class TransferController {
    /**
     * Execute transfer from sender to receiver
     * POST /api/transfer
     *
     * @param {object} req - Express request object
     * @param {object} req.body - Request body
     * @param {string} req.body.receiver_reference_number - Receiver's reference number
     * @param {number} req.body.amount - Transfer amount
     * @param {number} req.body.sender_user_id - Sender's user ID
     * @param {object} res - Express response object
     * @returns {Promise<void>}
     */
    async executeTransfer(req, res)

    /**
     * Validate transfer request inputs
     * @private
     */
    _validateTransferInputs(receiver_reference_number, amount, sender_user_id)

    /**
     * Generate unique nullifier for transfer
     * @private
     */
    _generateNullifier()

    /**
     * Create transfer memo with metadata
     * Handles missing reference numbers by using empty strings
     * Validates memo length and truncates/rejects if needed
     * @private
     */
    _createMemo(senderRefNumber, receiverRefNumber, senderWallet, receiverWallet, amount)

    /**
     * Validate memo length against maximum allowed
     * @private
     */
    _validateMemoLength(memo)
}
```

### User Management Service Integration

**File**: `backend/b2b-membership/services/user-management-service.js`

**Used Methods**:

```javascript
// Get organization from reference number
const orgResult = await userManagementService.getOrganizationByReferenceNumber(
    receiver_reference_number
)

// Returns: { success: boolean, organization?: object, error?: object }
```

### Proof Controller Integration

**File**: `backend/b2b-membership/controllers/proof-controller.js`

**Used Methods**:

```javascript
const proofController = new ProofController()

// Generate proof for receiver
const proofResult = await proofController.generateProofService(
    receiver_user_id,
    receiver_org_id,
    true // isKYCed
)

// Returns: {
//   success: boolean,
//   proof?: string,           // Hex-encoded proof bytes
//   publicInputs?: string[],  // Array of bytes32 hex strings
//   error?: object
// }
```

### Transfer Service Integration

**File**: `backend/b2b-membership/services/transfer-service.js`

**Used Methods**:

```javascript
// Execute blockchain transfer
const blockchainResult = await transferService.blockchainTransfer(
    sender_user_id,
    receiver_user_id,
    amount,
    memo,
    nullifier,
    proof,
    publicInputs
)

// Update database balances
const dbResult = await transferService.transfer(
    sender_user_id,
    receiver_user_id,
    amount
)
```

## Data Models

### Request Body Schema

```javascript
{
    receiver_reference_number: string,  // Format: {wallet_address}_{uuid}
    amount: number,                     // Positive number
    sender_user_id: number              // Positive integer
}
```

### Memo Constraints

**Maximum Length**: 1024 bytes (UTF-8 encoded)

**Rationale**: This limit ensures compatibility with blockchain storage constraints and prevents excessive gas costs. The memo structure is designed to stay well under this limit under normal circumstances, but validation is performed to handle edge cases (e.g., unusually long wallet addresses or reference numbers).

### Response Schema (Success)

```javascript
{
    success: true,
    blockchain: {
        transactionHash: string,
        blockNumber: number,
        gasUsed: string,
        senderWalletAddress: string,
        receiverWalletAddress: string,
        senderReferenceNumber: string,
        receiverReferenceNumber: string,
        nullifier: string,
        memo: string,
        timestamp: Date
    },
    database: {
        fromUserId: number,
        toUserId: number,
        amount: number,
        senderPreviousBalance: number,
        senderNewBalance: number,
        receiverPreviousBalance: number,
        receiverNewBalance: number,
        timestamp: Date
    }
}
```

### Response Schema (Partial Success - Blockchain Succeeded, Database Failed)

```javascript
{
    success: true,
    warning: "BLOCKCHAIN_SUCCEEDED_DATABASE_FAILED",
    blockchain: {
        transactionHash: string,
        blockNumber: number,
        gasUsed: string,
        senderWalletAddress: string,
        receiverWalletAddress: string,
        senderReferenceNumber: string,
        receiverReferenceNumber: string,
        nullifier: string,
        memo: string,
        timestamp: Date
    },
    database: {
        error: string,
        details: object
    }
}
```

**Design Decision - Partial Success Handling**: When the blockchain transfer succeeds but the database update fails, the system returns `success: true` with a warning field. This design choice reflects that the authoritative transaction has been recorded on-chain, and the database inconsistency can be resolved through reconciliation processes. Returning an error would be misleading since the transfer actually occurred on the blockchain.

### Response Schema (Error)

```javascript
{
    success: false,
    error: {
        type: string,        // Error type constant
        message: string,     // Human-readable error message
        details: object      // Additional error context
    }
}
```

### Memo Format

```javascript
{
    sender_reference_number: string,    // Empty string if user has no reference number
    receiver_reference_number: string,  // Empty string if user has no reference number
    sender_wallet_address: string,
    receiver_wallet_address: string,
    amount: number,
    timestamp: string
}
```

**Design Decision - Memo Length Handling**: The system enforces a maximum memo length to comply with blockchain constraints. If a memo exceeds the maximum length (typically 1024 bytes for UTF-8 encoded strings), the transfer will be rejected with a MEMO_TOO_LONG error rather than truncating, as truncation could lead to data loss and audit trail inconsistencies. This ensures data integrity and prevents silent failures.

**Design Decision - Missing Reference Numbers**: When a user lacks a reference number (edge case for legacy users or system accounts), the memo will use an empty string ("") rather than null or undefined. This ensures the memo remains valid JSON and prevents parsing errors on the blockchain or in client applications.

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Input validation rejects invalid parameters

_For any_ transfer request, if any input parameter (receiver_reference_number, amount, sender_user_id) is invalid (null, undefined, wrong type, negative, etc.), then the endpoint should return a 400 status code with an error response and not proceed with the transfer.
**Validates: Requirements 1.1, 7.1**

### Property 2: Proof format validation

_For any_ generated proof and public inputs, the proof should be a hex string starting with "0x" and publicInputs should be an array where each element is a hex string starting with "0x".
**Validates: Requirements 2.5**

### Property 3: Nullifier format validation

_For any_ generated nullifier, it should match the pattern /^0x[0-9a-fA-F]{64}$/ (32-byte hex string with 0x prefix).
**Validates: Requirements 3.2, 3.3**

### Property 4: Nullifier uniqueness

_For any_ two consecutive calls to nullifier generation, the generated nullifiers should be different.
**Validates: Requirements 3.4**

### Property 5: Memo contains all required fields

_For any_ transfer, the generated memo should contain sender_reference_number, receiver_reference_number, sender_wallet_address, receiver_wallet_address, and amount fields.
**Validates: Requirements 4.1**

### Property 5a: Memo handles missing reference numbers

_For any_ user without a reference number, the memo should use an empty string ("") for that user's reference_number field rather than null or undefined.
**Validates: Requirements 4.3**

### Property 6: Memo is valid JSON

_For any_ generated memo string, parsing it with JSON.parse() should succeed and return an object.
**Validates: Requirements 4.2**

### Property 7: Memo is valid UTF-8

_For any_ generated memo, encoding it as UTF-8 and decoding it should produce the same string.
**Validates: Requirements 4.4**

### Property 7a: Memo length validation

_For any_ generated memo, if its UTF-8 encoded byte length exceeds 1024 bytes, the system should reject the transfer with a MEMO_TOO_LONG error.
**Validates: Requirements 4.5**

### Property 8: Success response contains required blockchain fields

_For any_ successful transfer, the response should include blockchain.transactionHash, blockchain.blockNumber, and blockchain.gasUsed fields.
**Validates: Requirements 9.2**

### Property 9: Success response contains required database fields

_For any_ successful transfer, the response should include database.senderPreviousBalance, database.senderNewBalance, database.receiverPreviousBalance, and database.receiverNewBalance fields.
**Validates: Requirements 9.3**

### Property 10: Error response contains required fields

_For any_ failed transfer, the response should include error.type, error.message, and error.details fields.
**Validates: Requirements 9.5**

### Property 11: Partial success response structure

_For any_ transfer where blockchain succeeds but database fails, the response should have success: true, a warning field with value "BLOCKCHAIN_SUCCEEDED_DATABASE_FAILED", blockchain transaction details, and database error information.
**Validates: Requirements 6.3**

### Property 12: Step duration logging

_For any_ major step in the transfer process (data retrieval, proof generation, blockchain transfer, database update), the system should log the step name along with its execution duration in milliseconds.
**Validates: Requirements 8.2**

## Error Handling

### Error Types

| Error Type                 | HTTP Status | Description                     | Trigger Condition                                                       |
| -------------------------- | ----------- | ------------------------------- | ----------------------------------------------------------------------- |
| INVALID_INPUT              | 400         | Invalid request parameters      | Missing or invalid receiver_reference_number, amount, or sender_user_id |
| INVALID_REFERENCE_NUMBER   | 400         | Invalid reference number format | Reference number doesn't match {wallet*address}*{uuid} format           |
| MEMO_TOO_LONG              | 400         | Memo exceeds maximum length     | Generated memo exceeds 1024 bytes when UTF-8 encoded                    |
| USER_NOT_FOUND             | 404         | User not found in database      | Sender or receiver user_id doesn't exist                                |
| ORGANIZATION_NOT_FOUND     | 404         | Organization not found          | Organization extracted from reference number doesn't exist              |
| PROOF_GENERATION_FAILED    | 500         | ZKP proof generation failed     | Proof controller returns error                                          |
| BLOCKCHAIN_TRANSFER_FAILED | 500         | Blockchain transaction failed   | Smart contract call reverts or fails                                    |
| DATABASE_UPDATE_FAILED     | 500         | Database balance update failed  | MongoDB update operation fails                                          |
| INTERNAL_ERROR             | 500         | Unexpected error                | Unhandled exception                                                     |

### Error Handling Strategy

1. **Input Validation Errors**: Return immediately with 400 status
2. **Memo Length Validation**: Check memo length before blockchain submission; reject with 400 status if too long
3. **User/Organization Not Found**: Return 404 status with details
4. **Proof Generation Errors**: Return 500 status, do not proceed to blockchain
5. **Blockchain Errors**: Return 500 status with transaction details
6. **Database Errors After Blockchain Success**: Return 200 status with warning field indicating blockchain succeeded but database failed
7. **Unexpected Errors**: Catch all exceptions, log stack trace, return 500 status

**Design Rationale - Database Failure After Blockchain Success**: This scenario requires special handling because the blockchain transaction is irreversible. Returning an error would be misleading since the transfer actually occurred. The system returns success with a warning, allowing the client to inform the user that the transfer succeeded while alerting administrators to the database inconsistency for manual reconciliation.

### Error Response Format

```javascript
{
    success: false,
    error: {
        type: "ERROR_TYPE_CONSTANT",
        message: "Human-readable error message",
        details: {
            // Context-specific error details
            receiver_reference_number: "...",
            sender_user_id: 123,
            // etc.
        }
    }
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify:

-   Input validation logic for all parameter types
-   Nullifier generation format and uniqueness
-   Memo creation with various input combinations (including missing reference numbers)
-   Memo length validation and rejection logic
-   Error response formatting for all error types
-   Partial success response formatting (blockchain success, database failure)
-   Logging behavior including step duration tracking
-   Edge cases (missing reference numbers, null values, oversized memos, etc.)

### Property-Based Testing

Property-based tests will use **fast-check** (JavaScript property testing library) to verify:

-   Input validation rejects all invalid parameter combinations (Property 1)
-   Proof format validation (Property 2)
-   Nullifier format and uniqueness (Properties 3, 4)
-   Memo structure, format, and constraints (Properties 5, 5a, 6, 7, 7a)
-   Response structure for success, partial success, and error cases (Properties 8, 9, 10, 11)
-   Logging behavior for step durations (Property 12)

**Configuration**: Each property-based test will run a minimum of 100 iterations.

**Tagging**: Each property-based test will include a comment with the format:

```javascript
// **Feature: zkp-transfer-endpoint, Property 1: Input validation rejects invalid parameters**
```

### Integration Testing

Integration tests will verify:

-   End-to-end transfer flow with real database and mock blockchain
-   Integration with UserManagementService.getOrganizationByReferenceNumber()
-   Integration with ProofController.generateProofService()
-   Integration with TransferService.blockchainTransfer() and transfer()
-   Error handling across service boundaries

### Test Data

Test data will include:

-   Valid reference numbers in format {wallet*address}*{uuid}
-   Invalid reference numbers (missing underscore, empty, null)
-   Valid and invalid user IDs
-   Valid and invalid amounts (positive, negative, zero, non-numeric)
-   Mock proof data matching expected format
-   Mock blockchain responses (success and failure)

## Security Considerations

### Input Validation

-   Validate all inputs before processing
-   Sanitize reference numbers to prevent injection attacks
-   Validate amount is positive and within reasonable bounds
-   Validate user_id is a positive integer
-   Validate memo length to prevent resource exhaustion attacks

### Sensitive Data Handling

-   Never log user secrets or private keys
-   Redact sensitive fields in logs (use hash or truncation)
-   Ensure memo doesn't contain sensitive information beyond what's required

### Transaction Security

-   Generate cryptographically secure random nullifiers using `crypto.randomBytes(32)`
-   Verify proof format before sending to blockchain
-   Ensure nullifier uniqueness to prevent replay attacks
-   Use atomic operations for database updates to maintain consistency

**Design Decision - Atomic Database Operations**: The Transfer Service uses MongoDB atomic operations (transactions or findOneAndUpdate with session) to ensure that balance updates are consistent even under concurrent access. This prevents race conditions where multiple transfers could corrupt balance data. The atomicity requirement (Requirement 6.2) is critical for financial accuracy.

### Error Information Disclosure

-   Don't expose internal system details in error messages
-   Provide enough information for debugging without security risks
-   Log full error details server-side, return sanitized errors to client

## Performance Considerations

### Expected Latency

-   Input validation: < 10ms
-   Database queries: 50-100ms per query
-   Proof generation: 5-10 seconds (circuit compilation and proving)
-   Blockchain transaction: 15-30 seconds (transaction confirmation)
-   Database update: 50-100ms
-   **Total expected latency**: 20-40 seconds

### Optimization Strategies

1. **Parallel Operations**: Where possible, execute independent operations in parallel
2. **Caching**: Cache organization data if reference numbers are reused
3. **Connection Pooling**: Use MongoDB connection pooling for database operations
4. **Async/Await**: Use proper async patterns to avoid blocking
5. **Timeout Handling**: Implement timeouts for long-running operations

### Scalability

-   Endpoint is stateless and can be horizontally scaled
-   Database operations use atomic updates for consistency
-   Proof generation is CPU-intensive; consider dedicated proof generation service
-   Blockchain operations are rate-limited by network; implement queuing if needed

## Logging and Monitoring

### Log Levels

-   **INFO**: Request received, major steps completed, transfer success
-   **WARN**: Blockchain succeeded but database failed, retryable errors
-   **ERROR**: Transfer failures, validation errors, unexpected exceptions
-   **DEBUG**: Detailed parameter values, intermediate results

### Logged Events

1. Transfer request received (with sanitized parameters)
2. User and organization data retrieved (with duration)
3. Proof generation started/completed (with duration)
4. Nullifier generated
5. Memo created and validated (with length check)
6. Blockchain transfer initiated/completed (with duration)
7. Database update initiated/completed (with duration)
8. Transfer response sent (with total duration)
9. Any errors encountered (with type, message, and stack trace)

**Design Decision - Step Duration Logging**: Each major step logs its execution duration to enable performance monitoring and bottleneck identification. This is critical for a multi-step process involving external services (database, blockchain) where latency can vary significantly.

### Metrics to Track

-   Transfer request rate
-   Transfer success/failure rate
-   Average transfer latency
-   Proof generation latency
-   Blockchain transaction latency
-   Database update latency
-   Error rates by type

## Deployment Considerations

### Environment Variables

Required environment variables:

-   `ALCHEMY_URL`: Alchemy RPC endpoint for blockchain
-   `WALLET_PRIVATE_KEY`: Private key for signing transactions
-   `FINCUBE_CONTRACT_ADDRESS`: FinCube smart contract address
-   `MONGODB_URI`: MongoDB connection string

### Dependencies

-   `express`: Web framework
-   `mongoose`: MongoDB ODM
-   `ethers`: Ethereum library for blockchain interaction
-   `crypto`: Node.js crypto module for nullifier generation
-   `@zkpassport/poseidon2`: Poseidon hash function for ZKP

### API Route Registration

```javascript
const express = require("express")
const router = express.Router()
const TransferController = require("../controllers/transfer-controller")

const transferController = new TransferController()

router.post("/transfer", (req, res) =>
    transferController.executeTransfer(req, res)
)

module.exports = router
```
