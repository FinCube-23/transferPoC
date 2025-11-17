# Verifier Contract Modularization Guide

## Overview

The `Verifier.sol` contract (~2000+ lines) has been partially modularized to reduce deployment size and improve maintainability. This document outlines what has been completed and what remains.

## Completed Work

### 1. Created Modular Components

The following files have been extracted into `web3/contracts/verifier/`:

-   **FrLib.sol** (150 lines)

    -   Field arithmetic operations
    -   Type definitions for Fr
    -   Math operations (add, mul, sub, invert, pow, etc.)

-   **HonkTypes.sol** (80 lines)

    -   All struct definitions (G1Point, VerificationKey, Proof, ZKProof, etc.)
    -   Enums (WIRE)
    -   Constants (CONST_PROOF_SIZE_LOG_N, NUMBER_OF_ENTITIES, etc.)
    -   IVerifier interface

-   **HonkVerificationKey.sol** (120 lines)

    -   Verification key loading function
    -   All G1 point constants for the circuit

-   **ECOperations.sol** (140 lines)

    -   Elliptic curve operations (ecMul, ecAdd, pairing)
    -   Point validation
    -   Conversion utilities
    -   Recursion separator generation

-   **CommitmentSchemeLib.sol** (50 lines)
    -   Shplemini intermediates
    -   Compute squares and fold evaluations

## Remaining Work

### 2. Components Still in Original Verifier.sol

The following large components need to be extracted:

#### ZKTranscriptLib.sol (~400 lines)

-   `generateTranscript()`
-   `generateEtaChallenge()`
-   `generateBetaAndGammaChallenges()`
-   `generateAlphaChallenges()`
-   `generateGateChallenges()`
-   `generateLibraChallenge()`
-   `generateSumcheckChallenges()`
-   `generateRhoChallenge()`
-   `generateGeminiRChallenge()`
-   `generateShplonkNuChallenge()`
-   `generateShplonkZChallenge()`
-   `loadProof()`

#### RelationsLib.sol (~800 lines)

-   `accumulateArithmeticRelation()`
-   `accumulatePermutationRelation()`
-   `accumulateLogDerivativeLookupRelation()`
-   `accumulateDeltaRangeRelation()`
-   `accumulateEllipticRelation()`
-   `accumulateMemoryRelation()`
-   `accumulateNnfRelation()`
-   `accumulatePoseidonExternalRelation()`
-   `accumulatePoseidonInternalRelation()`
-   `scaleAndBatchSubrelations()`

#### BaseZKHonkVerifier.sol (~400 lines)

-   `verify()` main function
-   `verifySumcheck()`
-   `verifyShplemini()`
-   `computePublicInputDelta()`
-   `computeNextTargetSum()`
-   `checkEvalsConsistency()`
-   `batchMul()`

## Next Steps

### Option 1: Complete Manual Extraction

Continue extracting the remaining components into separate files following the pattern established.

### Option 2: Use Original Verifier

Keep using the original `Verifier.sol` until deployment size becomes an issue.

### Option 3: Optimize Original Contract

Instead of modularizing, optimize the original contract:

-   Remove unused code
-   Optimize storage
-   Use libraries for repeated logic
-   Enable optimizer with higher runs

## Usage

### Current State

-   Original `Verifier.sol` - Still functional, use this for now
-   Modular components in `verifier/` - Foundation laid, not yet complete
-   `HonkVerifier.sol` - Placeholder that will use modular components when complete

### When Modularization is Complete

```solidity
import "./HonkVerifier.sol";

contract MyContract {
    HonkVerifier verifier = new HonkVerifier();

    function verifyProof(bytes calldata proof, bytes32[] calldata publicInputs) external {
        require(verifier.verify(proof, publicInputs), "Invalid proof");
    }
}
```

## Benefits of Modularization

1. **Reduced Contract Size** - Each module can be deployed separately
2. **Better Testing** - Test individual components in isolation
3. **Reusability** - Use components across different verifiers
4. **Maintainability** - Easier to understand and modify
5. **Gas Optimization** - Libraries can be deployed once and reused

## Deployment Size Comparison

-   Original Verifier.sol: ~24KB (approaching 24.576KB limit)
-   Modularized approach: Each component < 10KB
-   Total deployed size: Similar, but more flexible

## Recommendations

1. **Short term**: Continue using original `Verifier.sol`
2. **Medium term**: Complete the modularization if deployment size becomes an issue
3. **Long term**: Consider using a verifier aggregation pattern for multiple proofs
