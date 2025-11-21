# Implementation Plan

-   [x] 1. Set up polynomial operations JavaScript wrapper

    -   Create `backend/b2b-membership/utils/polynomial-operations.js`
    -   Implement BigInt string conversion utilities
    -   Wrap TypeScript polynomial functions (addRoot, removeRoot, verifyPolynomial)
    -   Export constants (bn_254_fp, MAX_POLY_DEGREE, initial_polynomial)
    -   _Requirements: 7.1, 7.2, 7.3, 7.4_

-   [ ]\* 1.1 Write property test for BigInt interop

    -   **Property 15: BigInt interop correctness**
    -   **Validates: Requirements 7.4**

-   [x] 2. Implement secret generator utility

    -   Create `backend/b2b-membership/utils/secret-generator.js`
    -   Implement SHA-256 hashing function
    -   Implement hex to BigInt conversion with modular reduction
    -   Implement generateUserSecret method combining email and org salt
    -   Add input validation for email and org salt
    -   _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

-   [ ]\* 2.1 Write property test for secret generation determinism

    -   **Property 4: Secret generation determinism**
    -   **Validates: Requirements 2.1, 2.2, 2.3**

-   [ ]\* 2.2 Write property test for field modulus reduction

    -   **Property 5: Field modulus reduction**
    -   **Validates: Requirements 2.4**

-   [ ]\* 2.3 Write property test for secret parameter validation

    -   **Property 6: Secret generation parameter validation**
    -   **Validates: Requirements 2.5**

-   [x] 3. Implement batch manager utility

    -   Create `backend/b2b-membership/utils/batch-manager.js`
    -   Implement findAvailableBatch method with capacity checking
    -   Implement createBatch method with initial polynomial [1]
    -   Implement hasCapacity method checking user count against MAX_POLY_DEGREE
    -   Implement getUserCount method querying User model
    -   Implement updateBatchEquation method
    -   _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3_

-   [ ]\* 3.1 Write property test for initial batch polynomial

    -   **Property 2: Initial batch polynomial correctness**
    -   **Validates: Requirements 1.3**

-   [ ]\* 3.2 Write property test for batch capacity enforcement

    -   **Property 8: Batch capacity enforcement**
    -   **Validates: Requirements 4.1, 4.3**

-   [ ]\* 3.3 Write property test for polynomial storage format

    -   **Property 10: Polynomial storage format**
    -   **Validates: Requirements 5.4**

-   [x] 4. Extend user management service with batch operations

    -   Add generateUserSecret method to UserManagementService
    -   Add assignToBatch method handling batch selection and polynomial update
    -   Add createUserWithBatch method orchestrating full user creation flow
    -   Implement atomic transaction logic for user creation
    -   Add comprehensive error handling with proper error types
    -   _Requirements: 1.1, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4_

-   [ ]\* 4.1 Write property test for user batch assignment

    -   **Property 1: User batch assignment completeness**
    -   **Validates: Requirements 1.1**

-   [ ]\* 4.2 Write property test for polynomial round-trip

    -   **Property 7: Polynomial update round-trip correctness**
    -   **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

-   [ ]\* 4.3 Write property test for string-BigInt conversion

    -   **Property 9: String-BigInt conversion preservation**
    -   **Validates: Requirements 5.3**

-   [ ]\* 4.4 Write property test for transaction atomicity

    -   **Property 13: Transaction atomicity**
    -   **Validates: Requirements 6.4, 8.3, 8.5**

-   [ ]\* 4.5 Write property test for error response completeness

    -   **Property 14: Error response completeness**
    -   **Validates: Requirements 6.5**

-   [ ]\* 4.6 Write property test for user creation ordering

    -   **Property 16: User creation ordering**
    -   **Validates: Requirements 8.1, 8.2**

-   [ ]\* 4.7 Write property test for user creation response

    -   **Property 17: User creation response completeness**
    -   **Validates: Requirements 8.4**

-   [x] 5. Add error handling property tests

    -   Set up test infrastructure for error scenarios
    -   _Requirements: 1.5, 6.1, 6.2, 6.3_

-   [ ]\* 5.1 Write property test for batch assignment errors

    -   **Property 3: Batch assignment error handling**
    -   **Validates: Requirements 1.5**

-   [ ]\* 5.2 Write property test for database errors

    -   **Property 11: Database error handling**
    -   **Validates: Requirements 6.1**

-   [ ]\* 5.3 Write property test for polynomial errors

    -   **Property 12: Polynomial error handling**
    -   **Validates: Requirements 6.2**

-   [x] 6. Create integration tests for end-to-end workflows

    -   Test complete user creation with batch assignment
    -   Test batch creation when all batches are full
    -   Test multiple users added to same batch
    -   Test polynomial verification after user additions
    -   Test rollback scenarios on failures
    -   _Requirements: All_

-   [x] 7. Checkpoint - Ensure all tests pass
    -   Ensure all tests pass, ask the user if questions arise.
