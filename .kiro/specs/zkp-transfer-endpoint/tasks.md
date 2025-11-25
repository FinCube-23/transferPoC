# Implementation Plan: ZKP-Enabled Transfer Endpoint

## Overview

This implementation plan creates a new transfer endpoint that orchestrates ZKP proof generation, blockchain transactions, and database updates. The endpoint will integrate with existing services (UserManagementService, ProofController, TransferService) to execute secure, privacy-preserving transfers.

## Tasks

-   [x] 1. Create transfer controller with core orchestration logic

    -   Create `backend/b2b-membership/controllers/transfer-controller.js`
    -   Implement `TransferController` class with `executeTransfer` method
    -   Add input validation for receiver_reference_number, amount, and sender_user_id
    -   Implement error handling for all error types (INVALID_INPUT, USER_NOT_FOUND, etc.)
    -   Add comprehensive logging for each step with duration tracking
    -   _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

-   [x] 1.1 Implement user data retrieval logic

    -   Call `userManagementService.getOrganizationByReferenceNumber()` to get receiver organization
    -   Query User model to find receiver by reference_number with populated batch_id
    -   Query User model to find sender by user_id with populated batch_id
    -   Validate both users exist and return appropriate errors if not found
    -   _Requirements: 1.2, 1.3, 1.4, 1.5, 7.2_

-   [x] 1.2 Implement ZKP proof generation integration

    -   Instantiate ProofController and call `generateProofService()` with receiver data
    -   Pass receiver user_id, receiver org_id, and isKYCed status (default true)
    -   Validate proof format (hex string starting with 0x)
    -   Validate publicInputs format (array of hex strings starting with 0x)
    -   Handle proof generation failures and return appropriate errors
    -   _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

-   [ ]\* 1.3 Write property test for proof format validation

    -   **Property 2: Proof format validation**
    -   **Validates: Requirements 2.5**
    -   Generate random proof-like data and validate format constraints
    -   Test that proof is hex string with 0x prefix
    -   Test that publicInputs is array of hex strings with 0x prefix

-   [x] 1.4 Implement nullifier generation

    -   Create `_generateNullifier()` private method
    -   Use `crypto.randomBytes(32)` for cryptographically secure random generation
    -   Convert to hex string with 0x prefix
    -   Validate format matches /^0x[0-9a-fA-F]{64}$/
    -   _Requirements: 3.1, 3.2, 3.3_

-   [ ]\* 1.5 Write property tests for nullifier generation

    -   **Property 3: Nullifier format validation**
    -   **Validates: Requirements 3.2, 3.3**
    -   **Property 4: Nullifier uniqueness**
    -   **Validates: Requirements 3.4**
    -   Test nullifier format matches 32-byte hex pattern
    -   Test consecutive nullifier generations produce different values

-   [x] 1.6 Implement memo creation and validation

    -   Create `_createMemo()` private method
    -   Build JSON memo with sender ref, receiver ref, wallet addresses, amount, timestamp
    -   Handle missing reference numbers by using empty strings
    -   Create `_validateMemoLength()` private method
    -   Enforce 1024 byte maximum length (UTF-8 encoded)
    -   Reject transfers with MEMO_TOO_LONG error if exceeded
    -   _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

-   [ ]\* 1.7 Write property tests for memo generation

    -   **Property 5: Memo contains all required fields**
    -   **Validates: Requirements 4.1**
    -   **Property 5a: Memo handles missing reference numbers**
    -   **Validates: Requirements 4.3**
    -   **Property 6: Memo is valid JSON**
    -   **Validates: Requirements 4.2**
    -   **Property 7: Memo is valid UTF-8**
    -   **Validates: Requirements 4.4**
    -   **Property 7a: Memo length validation**
    -   **Validates: Requirements 4.5**
    -   Test memo structure with various input combinations
    -   Test memo with missing reference numbers uses empty strings
    -   Test memo parsing and UTF-8 encoding
    -   Test memo length validation and rejection

-   [x] 1.8 Implement blockchain transfer integration

    -   Call `transferService.blockchainTransfer()` with all required parameters
    -   Pass sender_user_id, receiver_user_id, amount, memo, nullifier, proof, publicInputs
    -   Handle blockchain transaction failures with appropriate error responses
    -   Extract transaction hash, block number, and gas used from successful response
    -   _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

-   [x] 1.9 Implement database balance update integration

    -   Call `transferService.transfer()` after successful blockchain transfer
    -   Handle database update failures with partial success response
    -   Return success: true with warning field when blockchain succeeds but database fails
    -   Include both blockchain and database transaction details in response
    -   _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

-   [ ]\* 1.10 Write property tests for response structure

    -   **Property 8: Success response contains required blockchain fields**
    -   **Validates: Requirements 9.2**
    -   **Property 9: Success response contains required database fields**
    -   **Validates: Requirements 9.3**
    -   **Property 10: Error response contains required fields**
    -   **Validates: Requirements 9.5**
    -   **Property 11: Partial success response structure**
    -   **Validates: Requirements 6.3**
    -   Test success response includes all blockchain fields
    -   Test success response includes all database fields
    -   Test error response structure
    -   Test partial success response when blockchain succeeds but database fails

-   [x] 2. Create transfer API route

    -   Create `backend/b2b-membership/routes/transfer-routes.js`
    -   Define POST /api/transfer endpoint
    -   Wire up TransferController.executeTransfer method
    -   Add route to main application in `index.js`
    -   _Requirements: 1.1, 9.1, 9.4_

-   [ ]\* 2.1 Write unit tests for transfer controller

    -   Test input validation with various invalid inputs
    -   Test user not found scenarios
    -   Test proof generation failure handling
    -   Test blockchain transfer failure handling
    -   Test database update failure handling
    -   Test successful transfer flow
    -   _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

-   [ ]\* 2.2 Write property test for input validation

    -   **Property 1: Input validation rejects invalid parameters**
    -   **Validates: Requirements 1.1, 7.1**
    -   Generate random invalid inputs (null, undefined, wrong types, negative values)
    -   Test that all invalid inputs are rejected with 400 status
    -   Test that no transfer proceeds with invalid inputs

-   [x] 3. Checkpoint - Ensure all tests pass

    -   Run all unit tests and property tests
    -   Verify transfer endpoint works end-to-end with mock data
    -   Ensure all tests pass, ask the user if questions arise

-   [ ]\* 3.1 Write integration tests for transfer endpoint

    -   Test end-to-end transfer flow with real database and mock blockchain
    -   Test integration with UserManagementService
    -   Test integration with ProofController
    -   Test integration with TransferService
    -   Test error handling across service boundaries
    -   _Requirements: 1.1, 2.1, 5.1, 6.1_

-   [ ]\* 3.2 Write property test for step duration logging
    -   **Property 12: Step duration logging**
    -   **Validates: Requirements 8.2**
    -   Test that each major step logs execution duration
    -   Verify duration is logged in milliseconds
    -   Test logging for data retrieval, proof generation, blockchain transfer, database update
