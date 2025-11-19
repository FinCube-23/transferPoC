# Redeploy Verifier Contract Guide

## Problem
The deployed HonkVerifier contract was compiled with the old circuit (LOG_N = 12, N = 4096), but you've changed the circuit to use `MAX_POLY_DEGREE = 128`, which results in a different circuit size.

Error: `ProofLengthWrongWithLogN(uint256,uint256,uint256)`

## Current Deployed Contract
- **Address**: `0x214BF1B713475Fcdb7D13202eB4ac35189dbdc15`
- **Network**: Celo Sepolia
- **Circuit Size (N)**: 4096
- **LOG_N**: 12

## Solution Steps

### Step 1: Generate New Proof with Updated Circuit
```bash
cd backend/base

# Regenerate test data with new polynomial degree (128)
node utils/test_data_generator.js

# Run the full circuit test
./test_circuit.sh
```

This will:
- Generate Prover.toml with 129 coefficients (128 + 1)
- Compile the circuit
- Generate witness
- Generate verification key
- Generate proof
- **Generate new Verifier.sol** at `circuit/target/Verifier.sol`

### Step 2: Check the New Verifier Contract
After running `test_circuit.sh`, check the new verifier:

```bash
cd backend/base/circuit/target
head -20 Verifier.sol
```

Look for:
```solidity
uint256 constant N = <new_value>;
uint256 constant LOG_N = <new_value>;
```

### Step 3: Deploy the New Verifier Contract

You have several options:

#### Option A: Using Hardhat/Foundry (Recommended)
If you have a deployment script:

```bash
cd web3  # or wherever your deployment scripts are
# Deploy to Celo Sepolia
npx hardhat run scripts/deploy-verifier.js --network celo-sepolia
```

#### Option B: Using Remix
1. Copy the contents of `backend/base/circuit/target/Verifier.sol`
2. Go to https://remix.ethereum.org
3. Create a new file and paste the Verifier.sol code
4. Compile it
5. Deploy to Celo Sepolia using MetaMask
6. Copy the deployed contract address

#### Option C: Manual Deployment Script
Create a deployment script:

```javascript
// deploy-verifier.js
const { ethers } = require("ethers");
const fs = require("fs");

async function deployVerifier() {
    // Read the Verifier.sol and compile it
    const verifierSource = fs.readFileSync(
        "./backend/base/circuit/target/Verifier.sol",
        "utf8"
    );
    
    // You'll need to compile this with solc
    // Then deploy using ethers.js
    
    const provider = new ethers.JsonRpcProvider(
        "https://celo-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
    );
    
    const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
    
    // Deploy contract
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    
    console.log("Verifier deployed to:", await contract.getAddress());
}

deployVerifier();
```

### Step 4: Update Contract Address

After deployment, update the contract address in:

**File**: `json-log/honk_verifier.json`
```json
{
  "HonkVerifier": "0xNEW_CONTRACT_ADDRESS_HERE"
}
```

### Step 5: Update ABI (if needed)

If the ABI changed, update:

**File**: `backend/b2b-membership/artifacts/contracts/HonkVerifier.json`

Copy the ABI from the compiled Verifier.sol.

### Step 6: Test the New Contract

```bash
# Check contract exists
cd backend/b2b-membership
node check-contract.js

# Test contract call
node test-contract-call.js

# Test full verification
curl -X POST http://localhost:5000/api/proof/verify
```

## Expected Circuit Sizes

Based on `MAX_POLY_DEGREE = 128`:

The circuit size depends on the actual circuit complexity, not just the polynomial degree. The circuit size (N) is determined by:
- Number of gates in the circuit
- Constraints
- Public inputs

Typical values:
- Small circuit: N = 512, LOG_N = 9
- Medium circuit: N = 2048, LOG_N = 11
- Large circuit: N = 4096, LOG_N = 12
- Very large: N = 8192, LOG_N = 13

Your circuit with MAX_POLY_DEGREE = 128 will likely have:
- **N**: Between 512 and 2048 (depends on circuit complexity)
- **LOG_N**: Between 9 and 11

## Verification

After redeployment, verify:

1. ✅ Contract deployed successfully
2. ✅ Contract address updated in `honk_verifier.json`
3. ✅ Proof generation works with new circuit
4. ✅ Proof verification works with new contract

## Alternative: Keep Old Contract

If you want to keep using the old contract, you need to:
1. Change `MAX_POLY_DEGREE` back to match the deployed contract
2. Or deploy a circuit that matches the current contract's LOG_N

## Notes

- The proof length is calculated based on LOG_N
- Each change to the circuit requires redeploying the verifier
- The verifier contract is specific to the circuit it was generated from
- You cannot verify proofs from a different circuit version

## Quick Reference

```bash
# Full workflow
cd backend/base
node utils/test_data_generator.js
./test_circuit.sh

# Deploy new verifier (your deployment method)
# ...

# Update address in json-log/honk_verifier.json

# Test
cd backend/b2b-membership
node check-contract.js
curl -X POST http://localhost:5000/api/proof/verify
```
