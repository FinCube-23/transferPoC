# ZKP Proof Controller

Backend service for orchestrating zero-knowledge proof generation and on-chain verification for B2B membership credentials.

## Setup

### 1. Install Dependencies

```bash
npm install
```

All required dependencies are already listed in `package.json`:

-   `express` - Web server framework
-   `cors` - Cross-origin resource sharing middleware
-   `ethers` - Ethereum library for blockchain interactions
-   `dotenv` - Environment variable management
-   `alchemy-sdk` - Alchemy provider for Ethereum access

### 2. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

-   `ALCHEMY_API_KEY` - Your Alchemy API key for Ethereum access
-   `ALCHEMY_NETWORK` - Network to use (default: sepolia)
-   `HONK_VERIFIER_CONTRACT_ADDRESS` - Deployed Honk Verifier contract address
-   `WALLET_PRIVATE_KEY` - Private key for signing transactions
-   `PORT` - Server port (default: 8000)

### 3. Start the Server

Development mode (with auto-reload):

```bash
npm start
```

Production mode:

```bash
node index.js
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### Generate Proof

```
POST /api/proof/generate
```

Generate a ZKP proof from test data.

**Request Body:**

```json
{
    "testConfig": {
        "userEmail": "user@example.com",
        "salt": "random_salt",
        "isKYCed": true
    }
}
```

**Response:**

```json
{
    "success": true,
    "proof": "0x...",
    "publicInputs": ["0x..."],
    "artifacts": {
        "bytecode": "...",
        "witness": "...",
        "verificationKey": "..."
    }
}
```

### Verify Proof

```
POST /api/proof/verify
```

Verify a proof against the on-chain Honk Verifier contract.

**Request Body:**

```json
{
    "proof": "0x...",
    "publicInputs": ["0x..."]
}
```

**Response:**

```json
{
    "success": true,
    "verified": true,
    "transactionHash": "0x..."
}
```

## Project Structure

```
backend/b2b-membership/
├── config/
│   └── config.js           # Configuration management
├── controllers/
│   └── proof-controller.js # Proof generation and verification logic
├── routes/
│   └── proof-routes.js     # API route definitions
├── models/
│   └── honk-verifier.js    # Smart contract interface
├── artifacts/
│   └── contracts/          # Contract ABIs
├── index.js                # Express server entry point
├── package.json            # Dependencies
├── .env                    # Environment variables (not in git)
└── .env.example            # Environment template
```

## Requirements

-   Node.js >= 16.x
-   npm >= 8.x
-   Nargo (for circuit compilation)
-   Barretenberg (for proof generation)

## Next Steps

The following functionality will be implemented in subsequent tasks:

-   Proof workflow execution (test data generation, compilation, witness generation, proof generation)
-   Proof artifact handling (reading and formatting proof data)
-   Blockchain integration (contract interaction via Alchemy)
-   Comprehensive logging
