# Polynomial Degree Update

## Summary
Updated `MAX_POLY_DEGREE` from `2048` to `256` across all files to match the circuit definition in `main.nr`.

## Changes Made

### 1. Circuit Definition (Reference)
**File**: `backend/base/circuit/src/main.nr`
```noir
global MAX_POLY_DEGREE: u32 = 256;
```
✅ Already set to 256 (no change needed)

### 2. Test Data Generator
**File**: `backend/base/utils/test_data_generator.js`

**Before**:
```javascript
const MAX_POLY_DEGREE = 2048
```

**After**:
```javascript
// Pad polynomial to MAX_POLY_DEGREE (must match main.nr)
const MAX_POLY_DEGREE = 256
```

### 3. Polynomial Equation Utilities
**File**: `backend/base/utils/polynomial_equation.ts`

**Added**:
```typescript
// Maximum polynomial degree (must match main.nr)
export const MAX_POLY_DEGREE = 256
```

### 4. Proof Controller
**File**: `backend/b2b-membership/controllers/proof-controller.js`

**Before**:
```javascript
const MAX_POLY_DEGREE = 2048
```

**After**:
```javascript
// Pad polynomial to MAX_POLY_DEGREE (must match main.nr)
const MAX_POLY_DEGREE = 256
```

## Why This Matters

The polynomial degree must be consistent across:
1. **Circuit** (`main.nr`) - Defines the array size for the polynomial
2. **Test Data Generator** - Creates test data with correct padding
3. **Proof Controller** - Generates proofs with correct polynomial size

### Impact of Mismatch

If the degrees don't match:
- ❌ Circuit compilation may fail
- ❌ Proof generation will fail
- ❌ Witness generation will fail with array size errors
- ❌ Contract verification will fail

### Benefits of 256 vs 2048

**Smaller degree (256)**:
- ✅ Faster proof generation
- ✅ Lower gas costs for verification
- ✅ Smaller proof size
- ✅ Faster circuit compilation

**Trade-off**:
- Can store fewer roots (256 vs 2048 members)
- For most use cases, 256 members is sufficient

## Verification

To verify the changes work correctly:

### 1. Regenerate Test Data
```bash
cd backend/base
node utils/test_data_generator.js
```

Expected output:
```
Polynomial degree: 4
✓ All coefficients in field: ✅
```

### 2. Test Circuit
```bash
cd backend/base
./test_circuit.sh
```

Expected: All steps should pass ✅

### 3. Generate Proof via API
```bash
curl -X POST http://localhost:5000/api/proof/generate
```

Expected: Proof generated successfully with 256-degree polynomial

## Files Modified

1. ✅ `backend/base/utils/test_data_generator.js` - Updated MAX_POLY_DEGREE to 256
2. ✅ `backend/base/utils/polynomial_equation.ts` - Added MAX_POLY_DEGREE constant
3. ✅ `backend/b2b-membership/controllers/proof-controller.js` - Updated MAX_POLY_DEGREE to 256

## Consistency Check

All files now use `MAX_POLY_DEGREE = 256`:
- ✅ `main.nr` - 256
- ✅ `test_data_generator.js` - 256
- ✅ `polynomial_equation.ts` - 256
- ✅ `proof-controller.js` - 256

## Next Steps

1. **Test the changes**:
   ```bash
   cd backend/base
   ./test_circuit.sh
   ```

2. **Regenerate proofs**:
   ```bash
   curl -X POST http://localhost:5000/api/proof/generate
   ```

3. **Verify proofs**:
   ```bash
   curl -X POST http://localhost:5000/api/proof/verify
   ```

## Notes

- The polynomial degree determines the maximum number of members that can be included
- With degree 256, you can have up to 256 roots (members) in the polynomial
- The actual polynomial used in tests has degree 4 (3 test roots + 1 secret)
- The remaining coefficients (up to 256) are padded with zeros
