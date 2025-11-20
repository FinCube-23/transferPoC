# Database Schema Changes Summary

## Date

November 20, 2025

## Overview

Updated the database schema for the b2b-membership backend to support blockchain integration with wallet addresses and zero-knowledge proof keys.

## Changes Made

### 1. Organization Model (`models/organization.js`)

#### Removed

-   ❌ `reference_key` (String, unique, auto-generated via UUID v4)

#### Added

-   ✅ `org_id` (Number, unique, required, **not auto-generated**)
-   ✅ `wallet_address` (String, unique, required, **not auto-generated**)

#### Modified

-   Removed UUID v4 dependency (no longer needed)
-   Removed auto-generation logic for reference_key
-   Kept org_salt auto-generation unchanged

### 2. User Model (`models/user.js`)

#### Added

-   ✅ `user_id` (Number, unique, required, **not auto-generated**)
-   ✅ `zkp_key` (String, unique, required)

#### Unchanged

-   All existing fields remain the same
-   Validation rules unchanged

## Files Updated

### Model Files

1. ✅ `backend/b2b-membership/models/organization.js`
2. ✅ `backend/b2b-membership/models/user.js`

### Test Files

3. ✅ `backend/b2b-membership/test-models.js`
    - Updated all Organization creation to include org_id and wallet_address
    - Updated all User creation to include user_id and zkp_key
    - Added tests for user_id uniqueness (Test 10)
    - Added tests for zkp_key uniqueness (Test 11)
    - Added tests for org_id uniqueness (Test 12)
    - Added tests for wallet_address uniqueness (Test 13)

### Utility Files

4. ✅ `backend/b2b-membership/fix-indexes.js`

    - Added Organization model import
    - Added index fixing for Organization collection
    - Now handles both User and Organization indexes

5. ✅ `backend/b2b-membership/check-indexes.js`
    - Added checking for organizations collection
    - Now displays indexes for both collections

### Documentation Files

6. ✅ `backend/b2b-membership/TEST_RESULTS.md`

    - Updated requirements coverage
    - Updated model descriptions
    - Updated notes section

7. ✅ `backend/b2b-membership/SCHEMA_MIGRATION_GUIDE.md` (NEW)

    - Complete migration guide
    - Sample migration script
    - Rollback procedures

8. ✅ `backend/b2b-membership/SCHEMA_CHANGES_SUMMARY.md` (NEW)
    - This file

## Breaking Changes

### ⚠️ Organization Creation

**Before:**

```javascript
const org = new Organization({})
// reference_key was auto-generated
```

**After:**

```javascript
const org = new Organization({
    org_id: 1001,
    wallet_address: "0x1234567890123456789012345678901234567890",
})
```

### ⚠️ User Creation

**Before:**

```javascript
const user = new User({
    batch_id: batchId,
    balance: 100,
})
```

**After:**

```javascript
const user = new User({
    user_id: 2001,
    batch_id: batchId,
    balance: 100,
    zkp_key: "zkp_key_001",
})
```

## Database Indexes

### Organization Collection

-   `_id` (default MongoDB index)
-   `org_id` (unique)
-   `wallet_address` (unique)
-   `org_salt` (unique)

### User Collection

-   `_id` (default MongoDB index)
-   `user_id` (unique)
-   `zkp_key` (unique)
-   `reference_number` (unique, sparse)

## Migration Required

⚠️ **IMPORTANT**: Existing databases will need migration to add the new required fields.

See `SCHEMA_MIGRATION_GUIDE.md` for detailed migration instructions.

## Testing

All tests have been updated and pass successfully:

-   ✅ Organization creation with required fields
-   ✅ User creation with required fields
-   ✅ Uniqueness constraints for all new fields
-   ✅ Auto-generation still works for org_salt
-   ✅ All existing validations still work

Run tests with:

```bash
node test-models.js
```

## Validation Rules

### Organization

-   `org_id`: Required, must be unique, Number type
-   `wallet_address`: Required, must be unique, String type
-   `org_salt`: Auto-generated if not provided, must be unique

### User

-   `user_id`: Required, must be unique, Number type
-   `zkp_key`: Required, must be unique, String type
-   `balance`: Must be non-negative (existing rule)
-   `reference_number`: Must be unique when not null (existing rule)

## Next Steps

1. Review the changes in this summary
2. Read the migration guide (`SCHEMA_MIGRATION_GUIDE.md`)
3. Backup your database before migration
4. Run the migration script or start fresh
5. Run tests to verify everything works
6. Update any application code that creates Organizations or Users

## Questions or Issues?

If you encounter any problems:

1. Check that all required fields are provided
2. Verify unique constraints are not violated
3. Run `node check-indexes.js` to verify indexes
4. Run `node fix-indexes.js` to recreate indexes if needed
5. Review test files for correct usage examples
