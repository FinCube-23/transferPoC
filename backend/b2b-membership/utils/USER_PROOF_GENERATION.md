# User-Specific Proof Generation

This document explains how to generate zero-knowledge proofs for specific users in the B2B membership system.

## Overview

The `generateProofService` function orchestrates the complete proof generation workflow for a specific user by:

1. Retrieving user data (including batch assignment and zkp_key)
2. Retrieving organization data (including org_salt and wallet_address)
3. Preparing the polynomial equation from the user's batch
4. Generating the user's secret from their zkp_key (email) and org_salt
5. Computing the polynomial hash and nullifier
6. Generating the ZKP proof and public inputs

## API Endpoint

### POST `/api/proof/generate-user`

Generate a zero-knowledge proof for a specific user.

**Request Body:**

```json
{
    "user_id": 1,
    "org_id": 1,
    "isKYCed": true
}
```

**Parameters:**

-   `user_id` (number, required): The unique user ID
-   `org_id` (number, required): The organization ID
-   `isKYCed` (boolean, required): KYC verification status

**Response (Success):**

```json
{
    "success": true,
    "proof": "0x...",
    "publicInputs": ["0x...", "0x..."],
    "artifacts": {
        "bytecode": "...",
        "verificationKey": "..."
    }
}
```

**Response (Error):**

```json
{
    "success": false,
    "error": {
        "type": "USER_NOT_FOUND",
        "message": "No user found with user_id: 1",
        "details": {
            "user_id": 1
        }
    }
}
```

## Implementation Details

### Service Function Flow

The `generateProofService` function in `ProofController` follows these steps:

#### 1. Get User, Batch, and Organization Data

```javascript
const dataResult = await userManagementService.getUserProofData(user_id, org_id)
const { user, batch, organization } = dataResult.data
```

This retrieves:

-   User record with `zkp_key` (email) and `batch_id`
-   Batch record with polynomial `equation`
-   Organization record with `org_salt` and `wallet_address`

#### 2. Prepare Polynomial Equation

```javascript
const equationStrings = batch.equation
let polynomial = stringsToBigInts(equationStrings)

// Pad to MAX_POLY_DEGREE (128)
while (polynomial.length <= MAX_POLY_DEGREE) {
    polynomial.push(0n)
}

// Ensure canonical form (0 <= x < FIELD_PRIME)
polynomial = polynomial.map((coeff) => {
    const r = coeff % FIELD_PRIME
    return r >= 0n ? r : r + FIELD_PRIME
})
```

#### 3. Hash the Polynomial

```javascript
const polynomialHash = realPoseidon2Hash(polynomial)
```

Uses Poseidon2 hash function to create a commitment to the polynomial.

#### 4. Generate User Secret

```javascript
const zkp_key = user.zkp_key // This is the email
const secret = generateUserSecret(zkp_key, organization.org_salt)
```

The secret is computed as:

```
secret = SHA256(email + org_salt) mod FIELD_PRIME
```

#### 5. Generate Verifier Key and Nullifier

```javascript
// Hash wallet address to create verifier key
const verifierKeyHash = crypto
    .createHash("sha256")
    .update(organization.wallet_address)
    .digest("hex")
const verifierKey = BigInt("0x" + verifierKeyHash) % FIELD_PRIME

// Generate nullifier using Poseidon2
const nullifier = realPoseidon2Hash([secret, verifierKey])
```

The nullifier prevents double-spending and links the proof to a specific verifier.

#### 6. Generate Proof

```javascript
const testConfig = {
    isKYCed,
    nullifier,
    polynomial,
    polynomialHash,
    secret,
    verifierKey,
}

const proofResult = await this.executeProofWorkflow(testConfig)
```

This executes the complete proof generation workflow:

-   Creates `Prover.toml` with the test configuration
-   Compiles the circuit using `nargo compile`
-   Generates witness using `nargo execute`
-   Generates proof using Barretenberg (`bb prove`)
-   Formats proof and public inputs for contract verification

## User Management Service

The `UserManagementService` provides a helper function to retrieve all necessary data:

### `getUserProofData(user_id, org_id)`

**Purpose:** Retrieve user, batch, and organization data in a single query.

**Returns:**

```javascript
{
  success: true,
  data: {
    user: {
      user_id: 1,
      batch_id: ObjectId("..."),
      zkp_key: "user@example.com",
      balance: 1000,
      ...
    },
    batch: {
      _id: ObjectId("..."),
      equation: ["1", "123", "456", ...],
      ...
    },
    organization: {
      org_id: 1,
      wallet_address: "0x...",
      org_salt: "abc123...",
      ...
    }
  }
}
```

## Testing

Use the provided test script to verify the functionality:

```bash
node test-generate-user-proof.js
```

**Prerequisites:**

1. MongoDB must be running with test data
2. User with `user_id: 1` must exist
3. Organization with `org_id: 1` must exist
4. User must be assigned to a batch
5. Nargo and Barretenberg must be installed

## Error Handling

The service handles various error scenarios:

### User Not Found

```json
{
    "success": false,
    "error": {
        "type": "USER_NOT_FOUND",
        "message": "No user found with user_id: 1"
    }
}
```

### Organization Not Found

```json
{
    "success": false,
    "error": {
        "type": "ORGANIZATION_NOT_FOUND",
        "message": "No organization found with org_id: 1"
    }
}
```

### Batch Not Found

```json
{
    "success": false,
    "error": {
        "type": "BATCH_NOT_FOUND",
        "message": "User 1 has no associated batch"
    }
}
```

### Proof Generation Failed

```json
{
    "success": false,
    "error": {
        "type": "PROOF_GENERATION_FAILED",
        "message": "Barretenberg proof generation failed",
        "step": "proof_generation"
    }
}
```

## Security Considerations

1. **Secret Storage**: The user's secret is never stored in the database. Only the `zkp_key` (email) is stored, and the secret is computed on-demand.

2. **Nullifier**: The nullifier is unique per user-verifier pair, preventing proof reuse across different verifiers.

3. **Polynomial Privacy**: The polynomial equation is stored in the batch, but individual user secrets remain private.

4. **Organization Salt**: Each organization has a unique salt, ensuring secrets are organization-specific.

## Integration Example

```javascript
const axios = require("axios")

async function generateProofForUser(userId, orgId, isKYCed) {
    try {
        const response = await axios.post(
            "http://localhost:3000/api/proof/generate-user",
            {
                user_id: userId,
                org_id: orgId,
                isKYCed: isKYCed,
            }
        )

        if (response.data.success) {
            console.log("Proof generated successfully!")
            console.log("Proof:", response.data.proof)
            console.log("Public Inputs:", response.data.publicInputs)

            // Now you can verify the proof on-chain
            return response.data
        }
    } catch (error) {
        console.error("Failed to generate proof:", error.response?.data)
        throw error
    }
}

// Usage
generateProofForUser(1, 1, true)
```

## Related Files

-   `backend/b2b-membership/controllers/proof-controller.js` - Main proof controller
-   `backend/b2b-membership/services/user-management-service.js` - User data retrieval
-   `backend/b2b-membership/utils/secret-generator.js` - Secret generation logic
-   `backend/b2b-membership/utils/polynomial-operations.js` - Polynomial utilities
-   `backend/b2b-membership/routes/proof-routes.js` - API route definitions
-   `backend/base/utils/test_data_generator.js` - Poseidon2 hash utilities
