# Quick Start Guide

## Problem Solved

**Issue:** The original implementation always called `test_data_generator.js` script, which:

1. Failed when the path contained spaces (e.g., `C:\Users\BS01493\Projects\SBU Europe\...`)
2. Ignored the `testConfig` parameter passed via API

**Solution:** The API now:

1. Uses provided `testConfig` to generate `Prover.toml` directly (no script execution)
2. Only calls the script when no `testConfig` is provided
3. Properly quotes paths to handle spaces

## Quick Test

### 1. Start the Server

```bash
cd backend/b2b-membership
npm start
```

### 2. Test with Custom Config

```bash
node test-api-with-config.js
```

This sends:

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

### 3. Test with Default Config

```bash
node test-api-default.js
```

This sends an empty payload `{}` and uses defaults from `test_data_generator.js`.

## Using cURL

### Custom Config

```bash
curl -X POST http://localhost:8000/api/proof/generate \
  -H "Content-Type: application/json" \
  -d '{"testConfig":{"roots":["123","456","789"],"userEmail":"test@example.com","salt":"test_salt_123","verifierKey":"verifier_key_456","isKYCed":true}}'
```

### Default Config

```bash
curl -X POST http://localhost:8000/api/proof/generate \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Key Points

✅ **BigInt values must be strings in JSON:**

-   Wrong: `{"roots": [123n, 456n, 789n]}`
-   Right: `{"roots": ["123", "456", "789"]}`

✅ **testConfig is optional:**

-   Provide it to use custom values
-   Omit it to use defaults

✅ **All testConfig fields are optional:**

```json
{
    "testConfig": {
        "roots": ["123"], // optional
        "userEmail": "test@x.com", // optional
        "salt": "salt123", // optional
        "verifierKey": "key456", // optional
        "isKYCed": true // optional
    }
}
```

## Expected Response

**Success:**

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

**Error:**

```json
{
  "success": false,
  "error": {
    "type": "TEST_DATA_GENERATION_FAILED",
    "message": "...",
    "step": "test_data_generation",
    "details": {...}
  }
}
```

## Troubleshooting

### Server not starting?

Check `.env` file has all required variables:

-   `ALCHEMY_API_KEY`
-   `ALCHEMY_NETWORK`
-   `HONK_VERIFIER_CONTRACT_ADDRESS`
-   `WALLET_PRIVATE_KEY`

### Path errors?

The implementation now handles paths with spaces correctly.

### Module not found?

Make sure you're in the correct directory:

```bash
cd backend/b2b-membership
npm install
```

## Next Steps

See `API_USAGE.md` for comprehensive documentation.
