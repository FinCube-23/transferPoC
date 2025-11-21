# Design Document

## Overview

This design extends the User Management Service to integrate batch management with polynomial equation operations for zero-knowledge proof systems. The service will automatically assign users to batches (maximum 128 users per batch), generate cryptographic user secrets from email and organization salt, and maintain polynomial equations where each user's secret is a root.

The design leverages existing polynomial utility functions from `backend/base/utils/polynomial_equation.ts` and integrates them with the MongoDB-based batch and user models. The implementation ensures atomic operations, proper error handling, and maintains cryptographic correctness using the BN254 field modulus.

## Architecture

### High-Level Component Interaction

```
User Creation Request
        ↓
UserManagementService
        ↓
    ┌───┴───┐
    ↓       ↓
BatchManager  SecretGenerator
    ↓           ↓
    ↓       (email + org_salt) → SHA-256 → BigInt
    ↓           ↓
    ↓       user_secret
    ↓           ↓
    └─────→ PolynomialOperations
                ↓
            addRoot(polynomial, secret)
                ↓
            Updated Polynomial
                ↓
            Database (Batch + User)
```

### Layer Responsibilities

1. **Service Layer** (UserManagementService): Orchestrates user creation, batch assignment, and polynomial updates
2. **Utility Layer** (PolynomialOperations): Provides cryptographic polynomial operations
3. **Data Layer** (Models): Persists batch equations and user records

## Components and Interfaces

### 1. PolynomialOperations Module

A JavaScript wrapper around the TypeScript polynomial utilities that handles BigInt conversions and provides a clean interface for the service layer.

```javascript
// Location: backend/b2b-membership/utils/polynomial-operations.js

class PolynomialOperations {
  /**
   * Add a root to an existing polynomial
   * @param {string[]} polynomialStrings - Array of coefficient strings
   * @param {bigint} root - The root to add
   * @returns {string[]} Updated polynomial as string array
   */
  addRoot(polynomialStrings, root)

  /**
   * Remove a root from an existing polynomial
   * @param {string[]} polynomialStrings - Array of coefficient strings
   * @param {bigint} root - The root to remove
   * @returns {string[] | null} Updated polynomial or null if root invalid
   */
  removeRoot(polynomialStrings, root)

  /**
   * Verify a root is valid for a polynomial
   * @param {string[]} polynomialStrings - Array of coefficient strings
   * @param {bigint} root - The root to verify
   * @returns {boolean} True if root is valid
   */
  verifyRoot(polynomialStrings, root)
}
```

### 2. SecretGenerator Module

Generates cryptographic user secrets from email and organization salt.

```javascript
// Location: backend/b2b-membership/utils/secret-generator.js

class SecretGenerator {
  /**
   * Generate user secret from email and organization salt
   * @param {string} email - User email address
   * @param {string} orgSalt - Organization salt (hex string)
   * @returns {bigint} User secret as BigInt
   * @throws {Error} If parameters are invalid
   */
  generateUserSecret(email, orgSalt)

  /**
   * Hash a string using SHA-256
   * @param {string} input - Input string
   * @returns {string} Hex hash string
   */
  hashString(input)

  /**
   * Convert hex hash to BigInt with field modulus reduction
   * @param {string} hexHash - Hex hash string
   * @returns {bigint} BigInt value reduced modulo bn_254_fp
   */
  hexToBigInt(hexHash)
}
```

### 3. BatchManager Module

Manages batch lifecycle, capacity checking, and assignment logic.

```javascript
// Location: backend/b2b-membership/utils/batch-manager.js

class BatchManager {
  /**
   * Find an available batch with capacity
   * @param {number} organizationId - Organization ID for filtering
   * @returns {Promise<Batch | null>} Available batch or null
   */
  async findAvailableBatch(organizationId)

  /**
   * Create a new batch with initial polynomial
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Batch>} Newly created batch
   */
  async createBatch(organizationId)

  /**
   * Check if batch has available capacity
   * @param {ObjectId} batchId - Batch ID
   * @returns {Promise<boolean>} True if batch has capacity
   */
  async hasCapacity(batchId)

  /**
   * Get user count for a batch
   * @param {ObjectId} batchId - Batch ID
   * @returns {Promise<number>} Number of users in batch
   */
  async getUserCount(batchId)

  /**
   * Update batch polynomial equation
   * @param {ObjectId} batchId - Batch ID
   * @param {string[]} newEquation - Updated polynomial coefficients
   * @returns {Promise<Batch>} Updated batch
   */
  async updateBatchEquation(batchId, newEquation)
}
```

### 4. Enhanced UserManagementService

Extended service with batch-aware user creation methods.

```javascript
// Location: backend/b2b-membership/services/user-management-service.js

class UserManagementService {
  // Existing methods...
  generateReferenceNumber(orgWalletAddress)
  async getOrganizationByReferenceNumber(referenceNumber)

  // New methods for batch management

  /**
   * Create a user with automatic batch assignment
   * @param {Object} userData - User creation data
   * @param {string} userData.email - User email
   * @param {number} userData.user_id - Unique user ID
   * @param {number} userData.balance - Initial balance
   * @param {string} userData.orgWalletAddress - Organization wallet address
   * @param {string} [userData.reference_number] - Optional reference number
   * @returns {Promise<{success: boolean, user?: object, batch?: object, error?: object}>}
   */
  async createUserWithBatch(userData)

  /**
   * Generate user secret from email and organization
   * @param {string} email - User email
   * @param {string} orgWalletAddress - Organization wallet address
   * @returns {Promise<{success: boolean, secret?: bigint, error?: object}>}
   */
  async generateUserSecret(email, orgWalletAddress)

  /**
   * Assign user to batch and update polynomial
   * @param {bigint} userSecret - User secret (root to add)
   * @param {number} organizationId - Organization ID
   * @returns {Promise<{success: boolean, batch?: object, error?: object}>}
   */
  async assignToBatch(userSecret, organizationId)
}
```

## Data Models

### Batch Model (Existing - No Changes Required)

```javascript
{
  _id: ObjectId,              // Auto-generated
  equation: [String],         // Array of BigInt strings
  createdAt: Date,           // Auto-generated
  updatedAt: Date            // Auto-generated
}
```

### User Model (Existing - No Changes Required)

```javascript
{
  _id: ObjectId,              // Auto-generated
  user_id: Number,            // Unique, required
  batch_id: ObjectId,         // Reference to Batch, required
  balance: Number,            // Default 0, min 0
  reference_number: String,   // Optional, unique (sparse index)
  zkp_key: String,            // Required, unique
  createdAt: Date,           // Auto-generated
  updatedAt: Date            // Auto-generated
}
```

### Organization Model (Existing - No Changes Required)

```javascript
{
  _id: ObjectId,              // Auto-generated
  org_id: Number,             // Unique, required
  wallet_address: String,     // Unique, required
  org_salt: String,           // Unique, auto-generated (32 bytes hex)
  createdAt: Date,           // Auto-generated
  updatedAt: Date            // Auto-generated
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: User batch assignment completeness

_For any_ user creation operation with valid parameters, the created user record should have a non-null batch_id that references an existing batch.
**Validates: Requirements 1.1**

### Property 2: Initial batch polynomial correctness

_For any_ newly created batch, the equation field should contain exactly one string element with value "1".
**Validates: Requirements 1.3**

### Property 3: Batch assignment error handling

_For any_ user creation operation where batch assignment fails, the service should return an error response with error.type equal to "BATCH_ASSIGNMENT_ERROR".
**Validates: Requirements 1.5**

### Property 4: Secret generation determinism

_For any_ email and organization salt pair, calling generateUserSecret multiple times should produce the same BigInt secret value.
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: Field modulus reduction

_For any_ generated user secret, the BigInt value should be less than bn_254_fp (21888242871839275222246405745257275088548364400416034343698204186575808495617n).
**Validates: Requirements 2.4**

### Property 6: Secret generation parameter validation

_For any_ call to generateUserSecret with missing email or organization salt, the service should return an error response with error.type equal to "INVALID_SECRET_PARAMETERS".
**Validates: Requirements 2.5**

### Property 7: Polynomial update round-trip correctness

_For any_ user added to a batch, retrieving the batch's polynomial equation and evaluating it with the user's secret as input should yield zero (verifyPolynomial returns true).
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 8: Batch capacity enforcement

_For any_ batch search operation, the returned available batch should have fewer than 128 users assigned to it.
**Validates: Requirements 4.1, 4.3**

### Property 9: String-BigInt conversion preservation

_For any_ BigInt coefficient value, converting it to string and back to BigInt should produce an equal value.
**Validates: Requirements 5.3**

### Property 10: Polynomial storage format

_For any_ batch in the database, all elements in the equation array should be valid string representations of BigInt values (parseable by BigInt constructor).
**Validates: Requirements 5.4**

### Property 11: Database error handling

_For any_ operation that encounters a database failure, the service should return an error response with error.type equal to "DATABASE_ERROR".
**Validates: Requirements 6.1**

### Property 12: Polynomial error handling

_For any_ operation where polynomial computation fails, the service should return an error response with error.type equal to "POLYNOMIAL_ERROR".
**Validates: Requirements 6.2**

### Property 13: Transaction atomicity

_For any_ user creation operation that fails at any step, querying the database should show no new user record and no modified batch equations.
**Validates: Requirements 6.4, 8.3, 8.5**

### Property 14: Error response completeness

_For any_ error response returned by the service, the error object should contain both a "type" field and a "message" field.
**Validates: Requirements 6.5**

### Property 15: BigInt interop correctness

_For any_ BigInt value passed to polynomial utility functions, the functions should accept and process the value without type errors.
**Validates: Requirements 7.4**

### Property 16: User creation ordering

_For any_ successful user creation, the batch_id should be determined and the batch polynomial should be updated before the user record is persisted.
**Validates: Requirements 8.1, 8.2**

### Property 17: User creation response completeness

_For any_ successful user creation, the response should include both user details (with user_id, batch_id, balance, zkp_key) and batch information (with \_id, equation).
**Validates: Requirements 8.4**

## Error Handling

### Error Types

The service will return structured error responses with the following types:

1. **INVALID_SECRET_PARAMETERS**: Missing or invalid email/organization salt
2. **BATCH_ASSIGNMENT_ERROR**: Failed to assign user to batch
3. **BATCH_CAPACITY_EXCEEDED**: Attempted to add user to full batch
4. **POLYNOMIAL_ERROR**: Polynomial computation failed
5. **DATABASE_ERROR**: Database operation failed
6. **ORGANIZATION_NOT_FOUND**: Organization lookup failed
7. **INVALID_REFERENCE_NUMBER**: Reference number validation failed

### Error Response Format

```javascript
{
  success: false,
  error: {
    type: "ERROR_TYPE",
    message: "Human-readable error description",
    details: {
      // Context-specific error details
    }
  }
}
```

### Error Handling Strategy

1. **Input Validation**: Validate all inputs before processing
2. **Early Returns**: Return errors immediately when detected
3. **Transaction Safety**: Use database transactions for atomic operations
4. **Rollback on Failure**: Ensure no partial state persists on error
5. **Detailed Logging**: Log errors with full context for debugging
6. **Graceful Degradation**: Return meaningful errors rather than throwing exceptions

## Testing Strategy

### Unit Testing

Unit tests will verify individual functions and methods:

-   Secret generation with various email/salt combinations
-   Polynomial string/BigInt conversions
-   Batch capacity checking logic
-   Error response formatting
-   Input validation functions

### Property-Based Testing

Property-based tests will verify universal correctness properties using **fast-check** library for JavaScript. Each test will run a minimum of 100 iterations with randomly generated inputs.

**Configuration:**

-   Library: fast-check (npm package)
-   Minimum iterations: 100 per property
-   Test location: `backend/b2b-membership/tests/user-management.property.test.js`

**Property Test Requirements:**

-   Each property-based test MUST include a comment tag referencing the design document property
-   Tag format: `// Feature: batch-polynomial-user-management, Property X: [property description]`
-   Each correctness property MUST be implemented by exactly ONE property-based test
-   Tests MUST use real database operations (no mocking) where feasible

**Generators:**

-   Email addresses: valid format strings
-   Organization salts: 64-character hex strings
-   User IDs: positive integers
-   Wallet addresses: 42-character hex strings (Ethereum format)
-   Batch equations: arrays of BigInt string representations

### Integration Testing

Integration tests will verify end-to-end workflows:

-   Complete user creation flow with batch assignment
-   Batch creation when all batches are full
-   Polynomial verification after multiple user additions
-   Error handling across service boundaries
-   Database transaction rollback scenarios

### Test Data Management

-   Use MongoDB in-memory server for isolated testing
-   Generate cryptographically valid test data
-   Clean up test data after each test
-   Use deterministic random seeds for reproducibility
