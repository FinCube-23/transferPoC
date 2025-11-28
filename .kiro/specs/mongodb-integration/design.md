# Design Document

## Overview

This design document describes the integration of MongoDB with Mongoose ORM into the b2b-membership backend service. The system will provide persistent storage for users, organizations, and batches with proper data validation, relationships, and connection management. The design follows a modular approach with separate concerns for database connection, model definitions, and configuration.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────┐
│         Express Application             │
│  (index.js)                             │
└───────────────┬─────────────────────────┘
                │
                ├──> Database Connection
                │    (utils/database.js)
                │         │
                │         ▼
                │    ┌─────────────┐
                │    │  MongoDB    │
                │    └─────────────┘
                │
                └──> Models
                     ├─ User (models/user.js)
                     ├─ Organization (models/organization.js)
                     └─ Batch (models/batch.js)
```

### Technology Stack

-   **Database**: MongoDB
-   **ORM**: Mongoose 8.x
-   **Runtime**: Node.js with Express
-   **Validation**: Mongoose built-in validators

## Components and Interfaces

### 1. Database Connection Module (`utils/database.js`)

**Purpose**: Manages MongoDB connection lifecycle

**Exports**:

-   `connectDatabase()`: Establishes connection to MongoDB
-   `disconnectDatabase()`: Closes MongoDB connection gracefully

**Configuration**:

-   Reads `MONGODB_URI` from environment variables
-   Default: `mongodb://localhost:27017/b2b-membership`
-   Connection options: useNewUrlParser, useUnifiedTopology

### 2. User Model (`models/user.js`)

**Schema Definition**:

```javascript
{
  _id: ObjectId (auto-generated),
  batch_id: ObjectId (ref: 'Batch'),
  balance: Number (default: 0, min: 0),
  reference_number: String (unique, sparse, nullable)
}
```

**Indexes**:

-   `reference_number`: unique, sparse (allows multiple null values)

**Validation**:

-   Balance: Must be >= 0
-   Fraud score: Must be between 0 and 1 inclusive

### 3. Organization Model (`models/organization.js`)

**Schema Definition**:

```javascript
{
  _id: ObjectId (auto-generated),
  reference_key: String (unique, auto-generated),
  org_salt: String (unique, auto-generated)
}
```

**Auto-generation Strategy**:

-   `reference_key`: UUID v4 format
-   `org_salt`: Cryptographically secure random hex string (32 bytes)

**Pre-save Hook**:

-   Generates reference_key and org_salt before document creation if not provided

### 4. Batch Model (`models/batch.js`)

**Schema Definition**:

```javascript
{
  _id: ObjectId (auto-generated),
  equation: [String] (array of string representations of BigInt values)
}
```

**Note**: JavaScript BigInt values are stored as strings to preserve precision in MongoDB

### 5. Configuration Module Updates (`config/config.js`)

**New Configuration Section**:

```javascript
database: {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/b2b-membership',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
}
```

## Data Models

### Entity Relationship Diagram

```
┌─────────────────┐
│  Organization   │
│  ─────────────  │
│  _id (PK)       │
│  reference_key  │
│  org_salt       │
└─────────────────┘

┌─────────────────┐
│     Batch       │
│  ─────────────  │
│  _id (PK)       │
│  equation[]     │
└────────┬────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────┐
│      User       │
│  ─────────────  │
│  _id (PK)       │
│  batch_id (FK)  │
│  balance        │
│  reference_num  │
└─────────────────┘
```

### Data Constraints

1. **User.balance**: Non-negative number
2. **User.reference_number**: Unique when not null (sparse index)
3. **Organization.reference_key**: Unique, auto-generated
4. **Organization.org_salt**: Unique, auto-generated
5. **Batch.equation**: Array of string-encoded numbers

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Database connection lifecycle

_For any_ application startup sequence, when the database connection is established, subsequent database operations should succeed, and when the application shuts down, the connection should close without errors.
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: User balance non-negativity

_For any_ User document, the balance field should always be greater than or equal to zero.
**Validates: Requirements 2.4**

### Property 3: Reference number uniqueness

_For any_ two User documents with non-null reference_number values, the reference_number values should be different.
**Validates: Requirements 2.5, 2.6**

### Property 4: Organization reference_key uniqueness

_For any_ two Organization documents, the reference_key values should be different.
**Validates: Requirements 3.3, 3.6**

### Property 5: Organization org_salt uniqueness

_For any_ two Organization documents, the org_salt values should be different.
**Validates: Requirements 3.5, 3.7**

### Property 6: Auto-generation on creation

_For any_ newly created Organization document without explicit reference_key or org_salt values, both fields should be automatically populated with unique values.
**Validates: Requirements 3.3, 3.5**

### Property 7: Batch equation array structure

_For any_ Batch document, the equation field should be an array.
**Validates: Requirements 4.4**

### Property 8: User-Batch relationship integrity

_For any_ User document with a batch_id, there should exist a corresponding Batch document with that \_id.
**Validates: Requirements 2.2**

## Error Handling

### Connection Errors

1. **Connection Failure**: Log error, allow application to continue with degraded functionality
2. **Connection Timeout**: Retry with exponential backoff (3 attempts)
3. **Authentication Error**: Log error with clear message, exit application

### Validation Errors

1. **Negative Balance**: Throw ValidationError with message "Balance cannot be negative"
2. **Invalid Fraud Score**: Throw ValidationError with message "Fraud score must be between 0 and 1"
3. **Duplicate Reference Number**: Throw MongoError with code 11000
4. **Duplicate Reference Key**: Throw MongoError with code 11000
5. **Duplicate Org Salt**: Throw MongoError with code 11000

### Model Operation Errors

1. **Invalid ObjectId**: Throw CastError
2. **Missing Required Field**: Throw ValidationError
3. **Type Mismatch**: Throw ValidationError

## Testing Strategy

### Unit Tests

Unit tests will verify specific model behaviors and edge cases:

1. **User Model**:

    - Creating a user with valid data succeeds
    - Creating a user with negative balance fails
    - Creating users with duplicate reference_numbers fails
    - Creating users with null reference_numbers succeeds

2. **Organization Model**:

    - Creating an organization auto-generates reference_key
    - Creating an organization auto-generates org_salt
    - Generated reference_key is a valid UUID
    - Generated org_salt is a valid hex string

3. **Batch Model**:

    - Creating a batch with equation array succeeds
    - Equation values are stored as strings

4. **Database Connection**:
    - Connection succeeds with valid URI
    - Connection handles invalid URI gracefully

### Property-Based Tests

Property-based tests will use **fast-check** (JavaScript property testing library) to verify universal properties across many randomly generated inputs. Each test will run a minimum of 100 iterations.

1. **Property 2: User balance non-negativity**

    - Generate random user data with various balance values
    - Verify that only non-negative balances are accepted

2. **Property 3: Reference number uniqueness**

    - Generate multiple users with reference numbers
    - Verify that duplicate reference numbers are rejected

3. **Property 4 & 5: Organization uniqueness**

    - Generate multiple organizations
    - Verify that reference_key and org_salt are unique across all instances

4. **Property 7: Batch equation array structure**
    - Generate random batch data
    - Verify that equation field is always an array

**Test Annotations**: Each property-based test will include a comment in the format:
`// Feature: mongodb-integration, Property X: [property description]`

### Integration Tests

Integration tests will verify end-to-end database operations:

1. Connect to test database, create documents, verify persistence
2. Test foreign key relationships (User -> Batch)
3. Test index enforcement (uniqueness constraints)
4. Test connection lifecycle (connect, operate, disconnect)

## Implementation Notes

### Dependencies

Add to `package.json`:

```json
{
    "dependencies": {
        "mongoose": "^8.0.0"
    },
    "devDependencies": {
        "fast-check": "^3.15.0"
    }
}
```

### Environment Variables

Add to `.env.example`:

```
MONGODB_URI=mongodb://localhost:27017/b2b-membership
```

### Integration Points

1. **Application Startup** (`index.js`): Call `connectDatabase()` before starting Express server
2. **Application Shutdown**: Add graceful shutdown handler to call `disconnectDatabase()`
3. **Configuration**: Extend existing `config/config.js` with database section
4. **Models**: Create new model files in `models/` directory

### BigInt Handling

JavaScript BigInt values cannot be directly serialized to JSON or stored in MongoDB. The design uses string representation for equation values:

```javascript
// Storing
const equation = [BigInt(123), BigInt(456)]
batch.equation = equation.map((n) => n.toString())

// Retrieving
const equation = batch.equation.map((s) => BigInt(s))
```
