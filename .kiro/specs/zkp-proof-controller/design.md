# Design Document

## Overview

The ZKP Proof Controller is a Node.js backend service that orchestrates zero-knowledge proof generation and on-chain verification for B2B membership credentials. The system integrates three key components: a Noir circuit that defines the membership proof logic, a local prover backend using Nargo and Barretenberg tools, and an Ethereum smart contract verifier using the Honk proving system.

The controller exposes REST API endpoints that allow clients to generate proofs from test data and verify them against the deployed Honk Verifier contract on Ethereum (via Alchemy). This enables privacy-preserving membership verification where users can prove they belong to a set without revealing their identity.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Application                       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ZKP Proof Controller (Express)                  │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │  Proof Generation    │    │  Proof Verification      │  │
│  │     Endpoint         │    │      Endpoint            │  │
│  └──────────┬───────────┘    └──────────┬───────────────┘  │
└─────────────┼──────────────────────────┼───────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────┐    ┌──────────────────────────┐
│   Prover Backend        │    │   Blockchain Layer       │
│  ┌──────────────────┐   │    │  ┌────────────────────┐  │
│  │ Test Data Gen    │   │    │  │  Honk Verifier     │  │
│  │ (Node.js)        │   │    │  │  Smart Contract    │  │
│  └──────────────────┘   │    │  └────────────────────┘  │
│  ┌──────────────────┐   │    │         ▲                │
│  │ Nargo Compiler   │   │    │         │                │
│  │ (Noir → Bytecode)│   │    │    Alchemy Provider      │
│  └──────────────────┘   │    └─────────────────────────┘
│  ┌──────────────────┐   │
│  │ Barretenberg     │   │
│  │ (Proof Gen/VK)   │   │
│  └──────────────────┘   │
└─────────────────────────┘
```

### Component Interaction Flow

**Proof Generation Flow:**

1. Client sends POST request to `/api/proof/generate`
2. Controller navigates to circuit directory
3. Test data generator creates Prover.toml with valid inputs
4. Nargo compiles circuit to bytecode
5. Nargo executes circuit to generate witness
6. Barretenberg generates proof from bytecode and witness
7. Controller reads proof artifacts and returns to client

**Proof Verification Flow:**

1. Client sends POST request to `/api/proof/verify` with proof data
2. Controller initializes Web3 connection via Alchemy
3. Controller loads Honk Verifier contract ABI and address
4. Controller formats proof and public inputs for Solidity
5. Controller calls `verify(bytes proof, bytes32[] publicInputs)` on contract
6. Contract returns boolean verification result
7. Controller returns result to client

## Components and Interfaces

### 1. Proof Controller (`proof-controller.js`)

The main controller that orchestrates proof generation and verification workflows.

**Responsibilities:**

-   Handle HTTP requests for proof operations
-   Execute shell commands for Nargo and Barretenberg
-   Manage file system operations for proof artifacts
-   Coordinate between prover backend and blockchain verifier

**Key Methods:**

```javascript
class ProofController {
  // Generate proof from test data
  async generateProof(req, res)

  // Verify proof against on-chain contract
  async verifyProof(req, res)

  // Execute proof generation workflow
  async executeProofWorkflow()

  // Read proof artifacts from file system
  async readProofArtifacts()

  // Format proof data for contract submission
  formatProofForContract(proofData, publicInputs)
}
```

**API Endpoints:**

-   `POST /api/proof/generate` - Generate a new proof
    -   Request: `{ testConfig?: object }`
    -   Response: `{ success: boolean, proof: string, publicInputs: string[], artifacts: object }`
-   `POST /api/proof/verify` - Verify a proof on-chain
    -   Request: `{ proof: string, publicInputs: string[] }`
    -   Response: `{ success: boolean, verified: boolean, transactionHash?: string }`

### 2. Honk Verifier Model (`honk-verifier.js`)

Encapsulates the smart contract interface for the Honk Verifier.

**Responsibilities:**

-   Load contract ABI and address
-   Provide contract instance for verification calls
-   Manage wallet signing configuration

**Interface:**

```javascript
class HonkVerifier {
  address: string          // Contract address from deployment config
  abi: object             // Contract ABI from artifacts
  signer: string          // Wallet private key for signing

  // Get contract instance with provider
  getContract(provider)

  // Call verify function on contract
  async verify(proof, publicInputs)
}
```

### 3. Proof Workflow Executor

Executes the shell-based proof generation workflow following the test_circuit.sh pattern.

**Workflow Steps:**

1. Navigate to `backend/base/circuit` directory
2. Generate test data: `node ../utils/test_data_generator.js`
3. Compile circuit: `nargo compile`
4. Generate witness: `nargo execute`
5. Generate proof: `bb prove -b ./target/b2b_membership.json -w ./target/b2b_membership.gz -o ./target --oracle_hash keccak`
6. Generate verification key: `bb write_vk -b ./target/b2b_membership.json -o ./target --oracle_hash keccak`

**Error Handling:**

-   Check exit codes after each command
-   Log stdout/stderr for debugging
-   Validate artifact files exist before proceeding
-   Return detailed error context on failure

### 4. Blockchain Integration Service

Manages Web3 connections and contract interactions.

**Responsibilities:**

-   Initialize Alchemy provider
-   Create contract instances with ethers.js
-   Format data for Solidity types
-   Handle transaction errors and reverts

**Key Functions:**

```javascript
// Initialize Web3 provider
function initializeProvider()

// Get contract instance
function getVerifierContract()

// Format proof bytes for Solidity
function formatProofBytes(proofHex)

// Format public inputs as bytes32[]
function formatPublicInputs(inputsArray)

// Call verify function
async function callVerify(proof, publicInputs)
```

## Data Models

### Proof Artifact

Represents the complete set of files generated during proof creation.

```javascript
{
  bytecode: string,           // Path: ./target/b2b_membership.json
  witness: string,            // Path: ./target/b2b_membership.gz
  verificationKey: string,    // Path: ./target/vk
  proof: string,              // Path: ./target/proof (hex-encoded bytes)
  publicInputs: string[]      // Path: ./target/public_inputs (array of field elements)
}
```

### Proof Generation Request

```javascript
{
  testConfig?: {
    roots?: bigint[],
    userEmail?: string,
    salt?: string,
    verifierKey?: string,
    isKYCed?: boolean
  }
}
```

### Proof Verification Request

```javascript
{
  proof: string,              // Hex-encoded proof bytes
  publicInputs: string[]      // Array of hex-encoded bytes32 values
}
```

### Proof Generation Response

```javascript
{
  success: boolean,
  proof: string,
  publicInputs: string[],
  artifacts: {
    bytecode: string,
    witness: string,
    verificationKey: string
  },
  error?: string
}
```

### Proof Verification Response

```javascript
{
  success: boolean,
  verified: boolean,
  transactionHash?: string,
  gasUsed?: string,
  error?: {
    type: string,
    message: string,
    revertReason?: string
  }
}
```

### Circuit Input Data (Prover.toml format)

```toml
isKYCed = true
nullifier = "12345..."
polynomial = ["123", "456", ...]
polynomial_hash = "789..."
secret = "111..."
verifier_key = "222..."
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Proof workflow execution order

_For any_ proof generation request, the system should execute steps in the correct sequence: test data generation, then circuit compilation, then witness generation, then proof generation, with each step completing before the next begins.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 6.1**

### Property 2: Artifact completeness after successful generation

_For any_ successfully completed proof workflow, all required artifacts should exist in the target directory: bytecode file, witness file, verification key file, proof file, and public inputs file.

**Validates: Requirements 6.5**

### Property 3: Error propagation halts execution

_For any_ workflow step that fails, the system should capture the error, halt further execution, and not proceed to subsequent steps.

**Validates: Requirements 3.1**

### Property 4: Verification result type consistency

_For any_ completed verification call to the smart contract, the system should return a boolean value indicating verification success or failure.

**Validates: Requirements 2.4**

### Property 5: Contract connection uses correct configuration

_For any_ contract interaction, the system should use the contract address from the deployment configuration and the ABI from the artifacts directory.

**Validates: Requirements 5.1, 5.2**

### Property 6: Proof data format compatibility

_For any_ proof data prepared for contract submission, the proof should be encoded as Solidity bytes type and public inputs should be encoded as bytes32[] array matching the verify function signature.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 7: Input validation precedes execution

_For any_ API request, the system should validate input parameters before executing any proof generation or verification operations.

**Validates: Requirements 4.4**

### Property 8: Structured response format

_For any_ completed API operation (success or failure), the system should return a structured JSON response containing status and result data.

**Validates: Requirements 4.5**

### Property 9: Error logging completeness

_For any_ error that occurs during workflow execution, the system should log the error message, context, and relevant file contents or diagnostic information.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 8.3**

### Property 10: Workflow step logging

_For any_ workflow step execution, the system should log when the step begins and when it completes successfully, with relevant details.

**Validates: Requirements 8.1, 8.2**

### Property 11: Directory navigation for Nargo commands

_For any_ Nargo command execution (compile or execute), the system should first navigate to the base/circuit directory.

**Validates: Requirements 6.2**

### Property 12: Barretenberg configuration consistency

_For any_ verification key generation or proof generation using Barretenberg, the system should use the keccak oracle hash configuration.

**Validates: Requirements 6.3**

## Error Handling

### Error Categories

**1. Proof Generation Errors**

-   Test data generation failure
-   Circuit compilation failure
-   Witness generation failure
-   Proof generation failure
-   Missing or corrupted artifact files

**2. Verification Errors**

-   Contract connection failure
-   Invalid proof format
-   Invalid public inputs format
-   Contract call revert
-   Network/provider errors

**3. System Errors**

-   File system access errors
-   Directory navigation errors
-   Shell command execution errors
-   Configuration loading errors

### Error Handling Strategy

**Fail-Fast Approach:**

-   Each workflow step checks for errors before proceeding
-   Exit codes from shell commands are validated
-   File existence is verified before reading
-   Execution halts immediately on first error

**Error Context:**

-   Log the failing step name and description
-   Include stdout/stderr from failed commands
-   Log relevant file contents (e.g., Prover.toml on witness failure)
-   List directory contents when artifacts are missing
-   Include stack traces for JavaScript errors

**Error Response Format:**

```javascript
{
  success: false,
  error: {
    type: "COMPILATION_FAILED" | "WITNESS_GENERATION_FAILED" | "PROOF_GENERATION_FAILED" | "VERIFICATION_FAILED" | "INVALID_INPUT",
    message: "Human-readable error description",
    step: "test_data_generation" | "compilation" | "witness_generation" | "proof_generation" | "verification",
    details: {
      exitCode?: number,
      stdout?: string,
      stderr?: string,
      missingFiles?: string[],
      revertReason?: string
    }
  }
}
```

### Contract Error Handling

The Honk Verifier contract defines specific error types:

-   `ConsistencyCheckFailed` - Proof consistency validation failed
-   `GeminiChallengeInSubgroup` - Invalid Gemini challenge
-   `ProofLengthWrong` - Proof data has incorrect length
-   `PublicInputsLengthWrong` - Public inputs array has incorrect length
-   `ShpleminiFailed` - Shplemini verification failed
-   `SumcheckFailed` - Sumcheck protocol failed

The controller should:

1. Catch contract revert errors
2. Parse the error type from revert data
3. Map to human-readable messages
4. Include in error response

### Retry Strategy

**No automatic retries for:**

-   Proof generation (deterministic, retry won't help)
-   Circuit compilation (deterministic)
-   Witness generation (deterministic)

**Possible retries for:**

-   Network calls to Alchemy (transient failures)
-   File system operations (transient locks)

Retry configuration:

-   Max retries: 3
-   Backoff: Exponential (1s, 2s, 4s)
-   Only for transient errors

## Testing Strategy

### Unit Testing

Unit tests will verify individual components and functions in isolation:

**Test Coverage:**

-   Proof artifact file reading and parsing
-   Proof data formatting for Solidity types
-   Public inputs formatting as bytes32[]
-   Error response formatting
-   Configuration loading (ABI, contract address)
-   Input validation functions
-   Directory path resolution

**Example Unit Tests:**

```javascript
describe("ProofController", () => {
    test("formatProofForContract converts hex to bytes", () => {
        const proofHex = "0x1234..."
        const formatted = formatProofForContract(proofHex)
        expect(formatted).toBeInstanceOf(Uint8Array)
    })

    test("formatPublicInputs creates bytes32 array", () => {
        const inputs = ["123", "456"]
        const formatted = formatPublicInputs(inputs)
        expect(formatted).toHaveLength(2)
        expect(formatted[0]).toMatch(/^0x[0-9a-f]{64}$/)
    })

    test("readProofArtifacts throws when files missing", async () => {
        await expect(readProofArtifacts("/invalid/path")).rejects.toThrow(
            "Proof artifacts not found"
        )
    })
})
```

**Testing Framework:** Jest or Mocha with Chai

### Property-Based Testing

Property-based tests will verify universal properties across many randomly generated inputs using fast-check library.

**Property Test Configuration:**

-   Minimum iterations: 100 per property
-   Use fast-check for JavaScript property testing
-   Each test explicitly references the design document property

**Property Tests:**

**Test 1: Workflow execution order property**

```javascript
// Feature: zkp-proof-controller, Property 1: Proof workflow execution order
test("workflow steps execute in correct order", async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.record({
                userEmail: fc.emailAddress(),
                salt: fc.string(),
                isKYCed: fc.boolean(),
            }),
            async (testConfig) => {
                const executionOrder = []
                const mockController = createMockController({
                    onStep: (step) => executionOrder.push(step),
                })

                await mockController.generateProof(testConfig)

                expect(executionOrder).toEqual([
                    "test_data_generation",
                    "compilation",
                    "witness_generation",
                    "proof_generation",
                ])
            }
        ),
        { numRuns: 100 }
    )
})
```

**Test 2: Artifact completeness property**

```javascript
// Feature: zkp-proof-controller, Property 2: Artifact completeness after successful generation
test("successful workflow creates all required artifacts", async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.record({
                userEmail: fc.emailAddress(),
                salt: fc.string(),
            }),
            async (testConfig) => {
                const result = await controller.generateProof(testConfig)

                if (result.success) {
                    expect(result.artifacts).toHaveProperty("bytecode")
                    expect(result.artifacts).toHaveProperty("witness")
                    expect(result.artifacts).toHaveProperty("verificationKey")
                    expect(result.artifacts).toHaveProperty("proof")
                    expect(result.artifacts).toHaveProperty("publicInputs")
                }
            }
        ),
        { numRuns: 100 }
    )
})
```

**Test 3: Error propagation property**

```javascript
// Feature: zkp-proof-controller, Property 3: Error propagation halts execution
test("workflow halts on first error", async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.constantFrom("test_data", "compilation", "witness", "proof"),
            async (failingStep) => {
                const executedSteps = []
                const mockController = createMockController({
                    failAt: failingStep,
                    onStep: (step) => executedSteps.push(step),
                })

                const result = await mockController.generateProof({})

                expect(result.success).toBe(false)
                expect(executedSteps).not.toContain(getStepAfter(failingStep))
            }
        ),
        { numRuns: 100 }
    )
})
```

**Test 4: Proof format compatibility property**

```javascript
// Feature: zkp-proof-controller, Property 6: Proof data format compatibility
test("formatted proof data matches Solidity types", async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.hexaString({ minLength: 100, maxLength: 1000 }),
            fc.array(fc.bigInt({ min: 0n, max: 2n ** 256n - 1n }), {
                minLength: 1,
                maxLength: 10,
            }),
            (proofHex, publicInputsBigInt) => {
                const formatted = formatProofForContract(
                    proofHex,
                    publicInputsBigInt
                )

                // Proof should be bytes
                expect(formatted.proof).toBeInstanceOf(Uint8Array)

                // Public inputs should be bytes32[]
                expect(Array.isArray(formatted.publicInputs)).toBe(true)
                formatted.publicInputs.forEach((input) => {
                    expect(input).toMatch(/^0x[0-9a-f]{64}$/)
                })
            }
        ),
        { numRuns: 100 }
    )
})
```

**Test 5: Input validation precedes execution property**

```javascript
// Feature: zkp-proof-controller, Property 7: Input validation precedes execution
test("invalid inputs are rejected before workflow execution", async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.record({
                proof: fc.option(fc.string(), { nil: null }),
                publicInputs: fc.option(fc.array(fc.string()), { nil: null }),
            }),
            async (invalidInput) => {
                const workflowStarted = jest.fn()
                const mockController = createMockController({
                    onWorkflowStart: workflowStarted,
                })

                const result = await mockController.verifyProof(invalidInput)

                if (!isValidInput(invalidInput)) {
                    expect(result.success).toBe(false)
                    expect(result.error.type).toBe("INVALID_INPUT")
                    expect(workflowStarted).not.toHaveBeenCalled()
                }
            }
        ),
        { numRuns: 100 }
    )
})
```

### Integration Testing

Integration tests will verify the complete system working together:

**Test Scenarios:**

1. End-to-end proof generation and verification
2. Contract interaction via Alchemy
3. File system operations with real directories
4. Shell command execution with real Nargo/Barretenberg

**Test Environment:**

-   Local Ethereum node (Hardhat) with deployed Honk Verifier
-   Real circuit files in test directory
-   Mock Alchemy provider for network isolation

### Manual Testing Checklist

-   [ ] Generate proof with valid test data
-   [ ] Verify proof on-chain successfully
-   [ ] Test with invalid proof data (should fail verification)
-   [ ] Test with missing circuit files (should error gracefully)
-   [ ] Test with invalid Prover.toml (should error with diagnostics)
-   [ ] Test network failure scenarios
-   [ ] Verify all error types are handled correctly
-   [ ] Check logs contain sufficient debugging information
