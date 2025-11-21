/**
 * Test script for polynomial operations wrapper
 * Verifies that the JavaScript wrapper functions correctly
 */

const {
    bn_254_fp,
    MAX_POLY_DEGREE,
    initial_polynomial,
    addRoot,
    removeRoot,
    verifyPolynomial,
    interpolatePolynomial,
    stringsToBigInts,
    bigIntsToStrings,
} = require("./utils/polynomial-operations.js")

console.log("=== Testing Polynomial Operations Wrapper ===\n")

// Test 1: Constants
console.log("1️⃣ Testing Constants:")
console.log("bn_254_fp:", bn_254_fp)
console.log("MAX_POLY_DEGREE:", MAX_POLY_DEGREE)
console.log("initial_polynomial:", initial_polynomial)
console.log("✅ Constants exported correctly\n")

// Test 2: String/BigInt conversion
console.log("2️⃣ Testing String/BigInt Conversion:")
const testStrings = ["1", "2", "3"]
const testBigInts = stringsToBigInts(testStrings)
console.log("Strings to BigInts:", testStrings, "->", testBigInts)
const backToStrings = bigIntsToStrings(testBigInts)
console.log("BigInts to Strings:", testBigInts, "->", backToStrings)
const conversionCorrect = testStrings.every((s, i) => s === backToStrings[i])
console.log(`Conversion round-trip: ${conversionCorrect ? "✅" : "❌"}\n`)

// Test 3: Add root to initial polynomial
console.log("3️⃣ Testing addRoot:")
const root1 = 5n
const poly1 = addRoot(initial_polynomial, root1)
console.log(`Adding root ${root1} to initial polynomial [1]`)
console.log("Result:", poly1)
const isRoot1Valid = verifyPolynomial(poly1, root1)
console.log(`Root ${root1} is valid: ${isRoot1Valid ? "✅" : "❌"}`)

// Add another root
const root2 = 10n
const poly2 = addRoot(poly1, root2)
console.log(`\nAdding root ${root2} to polynomial`)
console.log("Result:", poly2)
const isRoot1StillValid = verifyPolynomial(poly2, root1)
const isRoot2Valid = verifyPolynomial(poly2, root2)
console.log(`Root ${root1} still valid: ${isRoot1StillValid ? "✅" : "❌"}`)
console.log(`Root ${root2} is valid: ${isRoot2Valid ? "✅" : "❌"}\n`)

// Test 4: Verify non-root
console.log("4️⃣ Testing verifyPolynomial with non-root:")
const nonRoot = 99n
const isNonRootValid = verifyPolynomial(poly2, nonRoot)
console.log(
    `Non-root ${nonRoot} is valid: ${isNonRootValid ? "❌ PROBLEM" : "✅"}\n`
)

// Test 5: Remove root
console.log("5️⃣ Testing removeRoot:")
const poly3 = removeRoot(poly2, root1)
if (poly3 === null) {
    console.log("❌ Failed to remove valid root")
} else {
    console.log(`Removed root ${root1}`)
    console.log("Result:", poly3)
    const isRoot1Gone = verifyPolynomial(poly3, root1)
    const isRoot2StillValid2 = verifyPolynomial(poly3, root2)
    console.log(
        `Root ${root1} still valid: ${isRoot1Gone ? "❌ PROBLEM" : "✅"}`
    )
    console.log(
        `Root ${root2} still valid: ${isRoot2StillValid2 ? "✅" : "❌"}`
    )
}

// Test 6: Remove invalid root
console.log("\n6️⃣ Testing removeRoot with invalid root:")
const invalidRemoval = removeRoot(poly2, 999n)
console.log(
    `Removing invalid root: ${
        invalidRemoval === null
            ? "✅ Correctly rejected"
            : "❌ Should have failed"
    }\n`
)

// Test 7: Interpolate polynomial
console.log("7️⃣ Testing interpolatePolynomial:")
const roots = [1n, 2n, 3n]
const interpolated = interpolatePolynomial(roots)
console.log("Roots:", roots)
console.log("Interpolated polynomial:", interpolated)
const allRootsValid = roots.every((r) => verifyPolynomial(interpolated, r))
console.log(`All roots valid: ${allRootsValid ? "✅" : "❌"}\n`)

// Test 8: Round-trip (add then remove)
console.log("8️⃣ Testing round-trip (add then remove):")
const testRoot = 42n
const polyBefore = ["1", "2", "3"]
const polyAfterAdd = addRoot(polyBefore, testRoot)
const polyAfterRemove = removeRoot(polyAfterAdd, testRoot)
if (polyAfterRemove === null) {
    console.log("❌ Round-trip failed")
} else {
    const roundTripCorrect =
        polyBefore.length === polyAfterRemove.length &&
        polyBefore.every((s, i) => s === polyAfterRemove[i])
    console.log(`Round-trip successful: ${roundTripCorrect ? "✅" : "❌"}`)
    if (!roundTripCorrect) {
        console.log("Before:", polyBefore)
        console.log("After:", polyAfterRemove)
    }
}

console.log("\n" + "=".repeat(50))
console.log("🎉 All polynomial wrapper tests completed!")
