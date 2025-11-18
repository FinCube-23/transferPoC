# ZKP Proof Controller API Usage Guide

## Overview

The ZKP Proof Controller provides REST API endpoints for generating and verifying zero-knowledge proofs. This guide explains how to use the API with custom test configurations.

## API Endpoints

### 1. Generate Proof

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

### 2. Verify Proof

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

**Test with custom config:**

```bash
node test-api-with-config.js
```

**Test with default config:**

```bash
node test-api-default.js
```

### Using Postman or Thunder Client

1. **Method:** POST
2. **URL:** `http://localhost:8000/api/proof/generate`
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

### Common Error Types

-   **TEST_DATA_GENERATION_FAILED**: Failed to generate or write test data
-   **COMPILATION_FAILED**: Circuit compilation error
-   **WITNESS_GENERATION_FAILED**: Witness generation error
-   **PROOF_GENERATION_FAILED**: Proof generation error
-   **VERIFICATION_FAILED**: On-chain verification failed
-   **INVALID_INPUT**: Request validation failed

Each error includes:

-   `type`: Error category
-   `message`: Human-readable description
-   `step`: Which workflow step failed
-   `details`: Additional debugging information

## Workflow Steps

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

# Smart Contract Configuration
HONK_VERIFIER_CONTRACT_ADDRESS=0x...

# Wallet Configuration
WALLET_PRIVATE_KEY=your_private_key_here

# Server Configuration
PORT=8000
```

## Starting the Server

```bash
cd backend/b2b-membership
npm start
```

The server will start on `http://localhost:8000` (or the port specified in `.env`).

## Health Check

Verify the server is running:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
    "status": "ok",
    "service": "zkp-proof-controller"
}
```
