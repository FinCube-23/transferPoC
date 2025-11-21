# Proof Service Implementation Summary

## What Was Added

A new proof generation service that generates zero-knowledge proofs for specific users based on their `user_id` and `org_id`.

## Files Modified

### 1. `controllers/proof-controller.js`

**Added:**

-   `generateProofService(user_id, org_id, isKYCed)` - Main service function
-   `generateUserProof(req, res)` - API endpoint handler
-   Updated `generateTestData()` to handle complete test configs

**Key Features:**

-   Retrieves user, batch, and organization data
-   Generates user secret from zkp_key (email) and org_salt
-   Computes polynomial hash using Poseidon2
-   Generates nullifier from secret and wallet address
-   Executes complete proof workflow

### 2. `services/user-management-service.js`

**Added:**

-   `getUserProofData(user_id, org_id)` - Retrieves all necessary data for proof generation

**Returns:**

-   User record with zkp_key and batch_id
-   Batch record with polynomial equation
-   Organization record with org_salt and wallet_address

### 3. `routes/proof-routes.js`

**Added:**

-   `POST /api/proof/generate-user` endpoint

**Request:**

```json
{
    "user_id": 1,
    "org_id": 1,
    "isKYCed": true
}
```

**Response:**

```json
{
  "success": true,
  "proof": "0x...",
  "publicInputs": ["0x...", "0x..."],
  "artifacts": {...}
}
```

## Files Created

### 1. `test-generate-user-proof.js`

Test script demonstrating how to use the new endpoint.

**Usage:**

```bash
node test-generate-user-proof.js
```

### 2. `USER_PROOF_GENERATION.md`

Comprehensive documentation covering:

-   API endpoint details
-   Implementation flow
-   Service function details
-   Error handling
-   Security considerations
-   Integration examples

## Proof Generation Flow

```
1. API Request (user_id, org_id, isKYCed)
   ↓
2. getUserProofData() - Retrieve user, batch, org data
   ↓
3. Prepare polynomial equation (pad to 128 coefficients)
   ↓
4. Hash polynomial using Poseidon2
   ↓
5. Generate user secret: SHA256(email + org_salt) mod FIELD_PRIME
   ↓
6. Generate verifier key: SHA256(wallet_address) mod FIELD_PRIME
   ↓
7. Generate nullifier: Poseidon2([secret, verifier_key])
   ↓
8. Create test config with all computed values
   ↓
9. Execute proof workflow:
   - Generate Prover.toml
   - Compile circuit (nargo compile)
   - Generate witness (nargo execute)
   - Generate proof (bb prove)
   - Format for contract verification
   ↓
10. Return proof and public inputs
```

## Key Design Decisions

### 1. Secret Generation

-   Secrets are **never stored** in the database
-   Computed on-demand from zkp_key (email) and org_salt
-   Uses SHA-256 hash with field modulus reduction

### 2. Verifier Key

-   Derived from organization's wallet_address
-   Ensures proofs are organization-specific
-   Prevents cross-organization proof reuse

### 3. Nullifier

-   Computed using Poseidon2 hash of [secret, verifier_key]
-   Prevents double-spending
-   Links proof to specific user-verifier pair

### 4. Polynomial Handling

-   Retrieved from user's batch
-   Padded to MAX_POLY_DEGREE (128)
-   Normalized to canonical form (0 <= x < FIELD_PRIME)
-   Hashed using Poseidon2 for commitment

### 5. Complete Config Support

-   `generateTestData()` now supports complete pre-computed configs
-   Avoids redundant computation when all values are known
-   Maintains backward compatibility with partial configs

## Security Features

1. **No Secret Storage**: User secrets are ephemeral and computed on-demand
2. **Organization Isolation**: Secrets are org-specific via org_salt
3. **Nullifier Uniqueness**: Prevents proof reuse
4. **Polynomial Privacy**: Individual secrets remain hidden in batch polynomial
5. **Verifier Binding**: Proofs are bound to specific verifier (wallet address)

## Testing

### Prerequisites

-   MongoDB running with test data
-   User and organization records exist
-   User assigned to batch
-   Nargo and Barretenberg installed

### Run Tests

```bash
# Test user proof generation
node test-generate-user-proof.js

# Test with custom data
node test-generate-user-proof.js --user-id 2 --org-id 1
```

## API Usage Example

```javascript
const axios = require("axios")

async function generateProof() {
    const response = await axios.post(
        "http://localhost:3000/api/proof/generate-user",
        {
            user_id: 1,
            org_id: 1,
            isKYCed: true,
        }
    )

    console.log("Proof:", response.data.proof)
    console.log("Public Inputs:", response.data.publicInputs)
}
```

## Error Handling

The service provides detailed error responses for:

-   Invalid parameters
-   User not found
-   Organization not found
-   Batch not found
-   Proof generation failures
-   Database errors

All errors follow the format:

```json
{
  "success": false,
  "error": {
    "type": "ERROR_TYPE",
    "message": "Human-readable message",
    "details": {...}
  }
}
```

## Next Steps

1. **Add Authentication**: Secure the endpoint with JWT or API keys
2. **Rate Limiting**: Prevent abuse of proof generation
3. **Caching**: Cache proofs for repeated requests
4. **Batch Processing**: Support generating proofs for multiple users
5. **Monitoring**: Add metrics for proof generation performance
6. **Validation**: Add input validation middleware

## Dependencies

-   `@zkpassport/poseidon2` - Poseidon2 hash function
-   `ethers` - Ethereum utilities
-   `mongoose` - MongoDB ODM
-   `crypto` - Node.js crypto module

## Related Documentation

-   `USER_PROOF_GENERATION.md` - Detailed API documentation
-   `API_USAGE.md` - General API usage guide
-   `BLOCKCHAIN_INTEGRATION_COMPLETE.md` - Blockchain integration details
