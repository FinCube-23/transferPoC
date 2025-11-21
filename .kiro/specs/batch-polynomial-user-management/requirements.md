# Requirements Document

## Introduction

This feature extends the user management service to integrate batch management with polynomial equation operations. When users are added to the system, they must be assigned to batches that maintain polynomial equations representing user secrets. Each batch has a maximum capacity of 128 users, and the polynomial equation is dynamically updated as users are added or removed using cryptographic operations based on user email hashes and organization salts.

## Glossary

-   **Batch**: A collection of up to 128 users with an associated polynomial equation
-   **Polynomial Equation**: An array of BigInt coefficients representing a polynomial where each user's secret is a root
-   **User Secret**: A cryptographic hash derived from a user's email and their organization's salt
-   **Root**: A value that, when substituted into the polynomial equation, evaluates to zero
-   **Organization Salt**: A unique cryptographic salt value associated with each organization
-   **Reference Number**: A unique identifier in the format {wallet*address}*{uuid}
-   **User Management Service**: The service responsible for user lifecycle operations including batch assignment
-   **MAX_POLY_DEGREE**: The maximum polynomial degree constant set to 128

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want users to be automatically assigned to batches when created, so that the system maintains proper batch organization and polynomial equations.

#### Acceptance Criteria

1. WHEN a user is created THEN the User Management Service SHALL assign the user to an available batch
2. WHEN no batch has available capacity THEN the User Management Service SHALL create a new batch with initial polynomial equation [1]
3. WHEN a batch is created THEN the User Management Service SHALL initialize the polynomial equation as an array containing the single BigInt value 1
4. WHEN a user is assigned to a batch THEN the User Management Service SHALL store the batch_id reference in the user record
5. WHEN batch assignment fails THEN the User Management Service SHALL return an error response with type BATCH_ASSIGNMENT_ERROR

### Requirement 2

**User Story:** As a system administrator, I want user secrets to be generated from email and organization salt, so that each user has a unique cryptographic identifier.

#### Acceptance Criteria

1. WHEN generating a user secret THEN the User Management Service SHALL concatenate the user email with the organization salt
2. WHEN the concatenated string is created THEN the User Management Service SHALL hash the string using SHA-256
3. WHEN the hash is computed THEN the User Management Service SHALL convert the hash to a BigInt value
4. WHEN the BigInt value exceeds the bn_254_fp field modulus THEN the User Management Service SHALL apply modular reduction
5. WHEN email or organization salt is missing THEN the User Management Service SHALL return an error with type INVALID_SECRET_PARAMETERS

### Requirement 3

**User Story:** As a system administrator, I want the batch polynomial equation to be updated when users are added, so that the equation correctly represents all user secrets as roots.

#### Acceptance Criteria

1. WHEN a user is added to a batch THEN the User Management Service SHALL retrieve the current polynomial equation from the batch
2. WHEN the polynomial equation is retrieved THEN the User Management Service SHALL convert string coefficients to BigInt values
3. WHEN the user secret is generated THEN the User Management Service SHALL call the addRoot function with the current polynomial and user secret
4. WHEN the addRoot function returns THEN the User Management Service SHALL convert the resulting BigInt coefficients to strings
5. WHEN the new polynomial is computed THEN the User Management Service SHALL update the batch equation field in the database

### Requirement 4

**User Story:** As a system administrator, I want batches to enforce a maximum capacity of 128 users, so that polynomial operations remain computationally feasible.

#### Acceptance Criteria

1. WHEN checking batch capacity THEN the User Management Service SHALL count the number of users with the batch_id
2. WHEN the user count equals or exceeds MAX_POLY_DEGREE THEN the User Management Service SHALL mark the batch as full
3. WHEN searching for available batches THEN the User Management Service SHALL exclude batches with 128 or more users
4. WHEN all existing batches are full THEN the User Management Service SHALL create a new batch
5. WHEN a batch reaches capacity THEN the User Management Service SHALL not assign additional users to that batch

### Requirement 5

**User Story:** As a system administrator, I want polynomial operations to use the correct field modulus, so that cryptographic operations are mathematically sound.

#### Acceptance Criteria

1. WHEN performing polynomial operations THEN the User Management Service SHALL use the bn_254_fp field modulus value 21888242871839275222246405745257275088548364400416034343698204186575808495617n
2. WHEN computing modular arithmetic THEN the User Management Service SHALL ensure all intermediate results are reduced modulo bn_254_fp
3. WHEN converting between string and BigInt THEN the User Management Service SHALL preserve the full precision of coefficient values
4. WHEN storing polynomial coefficients THEN the User Management Service SHALL store them as string representations of BigInt values
5. WHEN retrieving polynomial coefficients THEN the User Management Service SHALL convert string values back to BigInt for computation

### Requirement 6

**User Story:** As a system administrator, I want comprehensive error handling for batch operations, so that failures are properly reported and the system remains in a consistent state.

#### Acceptance Criteria

1. WHEN a database operation fails THEN the User Management Service SHALL return an error response with type DATABASE_ERROR
2. WHEN polynomial computation fails THEN the User Management Service SHALL return an error response with type POLYNOMIAL_ERROR
3. WHEN batch capacity is exceeded THEN the User Management Service SHALL return an error response with type BATCH_CAPACITY_EXCEEDED
4. WHEN an error occurs during user creation THEN the User Management Service SHALL not persist partial state changes
5. WHEN error responses are returned THEN the User Management Service SHALL include descriptive error messages and relevant context details

### Requirement 7

**User Story:** As a developer, I want the polynomial utility functions to be accessible from JavaScript, so that the User Management Service can perform polynomial operations.

#### Acceptance Criteria

1. WHEN the User Management Service needs polynomial operations THEN the system SHALL provide access to the addRoot function from polynomial_equation.ts
2. WHEN the User Management Service needs polynomial operations THEN the system SHALL provide access to the removeRoot function from polynomial_equation.ts
3. WHEN the User Management Service needs polynomial operations THEN the system SHALL provide access to the verifyPolynomial function from polynomial_equation.ts
4. WHEN calling TypeScript functions from JavaScript THEN the system SHALL handle BigInt values correctly across the language boundary
5. WHEN importing polynomial utilities THEN the system SHALL use a compiled JavaScript version or appropriate interop mechanism

### Requirement 8

**User Story:** As a system administrator, I want user creation to be atomic with batch assignment, so that users are never created without proper batch membership.

#### Acceptance Criteria

1. WHEN creating a user THEN the User Management Service SHALL determine batch assignment before persisting the user record
2. WHEN batch assignment succeeds THEN the User Management Service SHALL update the batch equation before completing user creation
3. WHEN polynomial update fails THEN the User Management Service SHALL rollback the user creation
4. WHEN user creation completes THEN the User Management Service SHALL return both user details and batch information
5. WHEN any step in the creation process fails THEN the User Management Service SHALL ensure no partial records are persisted
