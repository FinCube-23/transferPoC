# Requirements Document

## Introduction

This document specifies the requirements for a ZKP-enabled transfer endpoint that allows users to transfer funds between accounts with zero-knowledge proof verification. The endpoint orchestrates proof generation for the receiver, blockchain transaction execution via the FinCube smart contract, and database balance updates. The system ensures atomicity, security, and privacy through cryptographic proofs while maintaining a complete audit trail.

## Glossary

-   **Transfer_Endpoint**: The API endpoint that handles transfer requests from clients
-   **Sender**: The user initiating the transfer (identified by user_id)
-   **Receiver**: The user receiving the transfer (identified by receiver_reference_number)
-   **Reference_Number**: A unique identifier in format {wallet*address}*{uuid} that identifies a user
-   **ZKP_Proof**: Zero-knowledge proof that validates receiver membership without revealing sensitive information
-   **Nullifier**: A unique cryptographic value that prevents double-spending and ensures transaction uniqueness
-   **Memo**: A string containing transfer metadata (sender ref, receiver ref, wallet addresses, amount)
-   **FinCube_Contract**: The smart contract that executes on-chain transfers with ZKP verification
-   **User_Management_Service**: Service providing user lookup and proof data retrieval operations
-   **Proof_Controller**: Controller that orchestrates ZKP proof generation workflow
-   **Transfer_Service**: Service that handles database balance updates and blockchain transactions
-   **Public_Inputs**: Array of public parameters used in ZKP verification (polynomial hash, nullifier, isKYCed)
-   **Blockchain_Transaction**: On-chain transaction executed via the FinCube smart contract
-   **Database_Transaction**: Off-chain balance update in MongoDB

## Requirements

### Requirement 1

**User Story:** As a sender, I want to transfer funds to a receiver using their reference number, so that I can send payments without knowing their internal user_id.

#### Acceptance Criteria

1. WHEN a client sends a POST request to the Transfer_Endpoint with receiver_reference_number, amount, and sender user_id THEN the Transfer_Endpoint SHALL validate all input parameters
2. WHEN the Transfer_Endpoint receives a receiver_reference_number THEN the Transfer_Endpoint SHALL call User_Management_Service getOrganizationByReferenceNumber to extract receiver organization
3. WHEN the receiver organization is retrieved THEN the Transfer_Endpoint SHALL query the User model to find the receiver user by reference_number
4. WHEN the Transfer_Endpoint receives a sender user_id THEN the Transfer_Endpoint SHALL query the User model to find the sender user and populate batch_id
5. WHEN both sender and receiver data are retrieved THEN the Transfer_Endpoint SHALL verify that both users exist in the database

### Requirement 2

**User Story:** As a system, I want to generate a valid ZKP proof for the receiver, so that the blockchain contract can verify receiver membership without exposing sensitive data.

#### Acceptance Criteria

1. WHEN the Transfer_Endpoint needs to generate a proof THEN the Transfer_Endpoint SHALL instantiate Proof_Controller and call generateProofService method with receiver user_id, receiver org_id, and isKYCed status (default true)
2. WHEN the Proof_Controller generateProofService is called THEN the Proof_Controller SHALL retrieve user proof data, generate polynomial hash, create nullifier, and execute proof workflow
3. WHEN the Proof_Controller generates a proof THEN the Proof_Controller SHALL return success: true with proof bytes string and publicInputs array
4. WHEN proof generation fails THEN the Transfer_Endpoint SHALL return an error response without proceeding to blockchain transfer
5. WHEN the proof is generated THEN the Transfer_Endpoint SHALL validate that the proof format is a hex string starting with 0x and publicInputs is an array of hex strings

### Requirement 3

**User Story:** As a system, I want to generate a unique nullifier for each transfer, so that the blockchain can prevent double-spending and ensure transaction uniqueness.

#### Acceptance Criteria

1. WHEN the Transfer_Endpoint prepares a transfer THEN the Transfer_Endpoint SHALL generate a cryptographically unique nullifier using crypto.randomBytes
2. WHEN generating a nullifier THEN the Transfer_Endpoint SHALL create 32 bytes of random data and convert to hex string with 0x prefix
3. WHEN a nullifier is generated THEN the Transfer_Endpoint SHALL format it as a 32-byte hex string matching pattern /^0x[0-9a-fA-F]{64}$/
4. WHEN the same transfer is attempted THEN the Transfer_Endpoint SHALL generate a different nullifier each time due to randomness
5. WHEN the blockchain receives a nullifier THEN the FinCube_Contract SHALL verify it has not been used in previous transactions

### Requirement 4

**User Story:** As a system, I want to create a comprehensive memo for each transfer, so that all transfer details are recorded on-chain for audit purposes.

#### Acceptance Criteria

1. WHEN the Transfer_Endpoint prepares a transfer THEN the Transfer_Endpoint SHALL create a memo containing sender reference number, receiver reference number, sender wallet address, receiver wallet address, and amount
2. WHEN creating a memo THEN the Transfer_Endpoint SHALL format it as a JSON string
3. WHEN a user has no reference number THEN the Transfer_Endpoint SHALL use an empty string or default value in the memo
4. WHEN the memo is created THEN the Transfer_Endpoint SHALL ensure it is a valid UTF-8 string
5. WHEN the memo exceeds maximum length THEN the Transfer_Endpoint SHALL truncate or reject the transfer

### Requirement 5

**User Story:** As a system, I want to execute the blockchain transfer via the FinCube smart contract, so that the transfer is recorded on-chain with ZKP verification.

#### Acceptance Criteria

1. WHEN all transfer prerequisites are met THEN the Transfer_Endpoint SHALL call the Transfer_Service blockchainTransfer method
2. WHEN calling blockchainTransfer THEN the Transfer_Endpoint SHALL pass sender user_id, receiver user_id, amount, memo, nullifier, proof, and public inputs
3. WHEN the blockchain transaction is submitted THEN the Transfer_Service SHALL wait for transaction confirmation
4. WHEN the blockchain transaction fails THEN the Transfer_Endpoint SHALL return an error response with transaction details
5. WHEN the blockchain transaction succeeds THEN the Transfer_Endpoint SHALL receive a transaction hash and block number

### Requirement 6

**User Story:** As a system, I want to update database balances after successful blockchain transfer, so that off-chain records match on-chain state.

#### Acceptance Criteria

1. WHEN the blockchain transfer succeeds THEN the Transfer_Endpoint SHALL call the Transfer_Service transfer method to update database balances
2. WHEN updating balances THEN the Transfer_Service SHALL use atomic operations to ensure consistency
3. WHEN the database update fails THEN the Transfer_Endpoint SHALL log the error and return a warning that blockchain succeeded but database failed
4. WHEN the database update succeeds THEN the Transfer_Endpoint SHALL return both blockchain and database transaction details
5. WHEN both operations succeed THEN the Transfer_Endpoint SHALL return a success response with complete transaction information

### Requirement 7

**User Story:** As a developer, I want comprehensive error handling throughout the transfer process, so that failures are properly reported and the system remains in a consistent state.

#### Acceptance Criteria

1. WHEN any validation fails THEN the Transfer_Endpoint SHALL return a 400 status code with error details
2. WHEN a user is not found THEN the Transfer_Endpoint SHALL return a USER_NOT_FOUND error type
3. WHEN proof generation fails THEN the Transfer_Endpoint SHALL return a PROOF_GENERATION_FAILED error type
4. WHEN the blockchain transaction fails THEN the Transfer_Endpoint SHALL return a BLOCKCHAIN_TRANSFER_FAILED error type
5. WHEN an unexpected error occurs THEN the Transfer_Endpoint SHALL return a 500 status code with error message

### Requirement 8

**User Story:** As a system administrator, I want detailed logging throughout the transfer process, so that I can debug issues and audit transactions.

#### Acceptance Criteria

1. WHEN the Transfer_Endpoint receives a request THEN the Transfer_Endpoint SHALL log the request parameters
2. WHEN each major step completes THEN the Transfer_Endpoint SHALL log the step name and duration
3. WHEN an error occurs THEN the Transfer_Endpoint SHALL log the error type, message, and stack trace
4. WHEN the transfer completes THEN the Transfer_Endpoint SHALL log the final transaction details
5. WHEN logging sensitive data THEN the Transfer_Endpoint SHALL redact or hash sensitive values like secrets

### Requirement 9

**User Story:** As a client application, I want a well-structured API response, so that I can easily parse and display transfer results to users.

#### Acceptance Criteria

1. WHEN the transfer succeeds THEN the Transfer_Endpoint SHALL return a JSON response with success: true
2. WHEN the transfer succeeds THEN the Transfer_Endpoint SHALL include blockchain transaction hash, block number, and gas used
3. WHEN the transfer succeeds THEN the Transfer_Endpoint SHALL include database transaction details with old and new balances
4. WHEN the transfer fails THEN the Transfer_Endpoint SHALL return a JSON response with success: false and error object
5. WHEN the transfer fails THEN the Transfer_Endpoint SHALL include error type, message, and relevant details in the response
