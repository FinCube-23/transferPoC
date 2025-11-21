/**
 * Polynomial Operations Wrapper
 *
 * This module provides JavaScript wrappers around polynomial operations
 * for zero-knowledge proof systems using the BN254 field.
 *
 * Based on: backend/base/utils/polynomial_equation.ts
 */

// BN254 field prime modulus
const bn_254_fp =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n

// Maximum polynomial degree (must match circuit constraints)
const MAX_POLY_DEGREE = 128

// Initial polynomial representing P(x) = 1
const initial_polynomial = ["1"]

/**
 * Modular arithmetic helper
 * Ensures result is in range [0, modulus)
 * @param {bigint} x - Value to reduce
 * @param {bigint} modulus - Field modulus (default: bn_254_fp)
 * @returns {bigint} Reduced value
 */
function mod(x, modulus = bn_254_fp) {
    const result = x % modulus
    return result >= 0n ? result : result + modulus
}

/**
 * Convert string array to BigInt array
 * @param {string[]} stringArray - Array of string representations of BigInt values
 * @returns {bigint[]} Array of BigInt values
 */
function stringsToBigInts(stringArray) {
    return stringArray.map((s) => BigInt(s))
}

/**
 * Convert BigInt array to string array
 * @param {bigint[]} bigIntArray - Array of BigInt values
 * @returns {string[]} Array of string representations
 */
function bigIntsToStrings(bigIntArray) {
    return bigIntArray.map((b) => b.toString())
}

/**
 * Add a root to an existing polynomial
 *
 * Given polynomial P(x) and root r, computes P(x) * (x - r)
 * This creates a new polynomial where P(r) = 0
 *
 * @param {string[]} polynomialStrings - Array of coefficient strings (lowest degree first)
 * @param {bigint} root - The root to add
 * @returns {string[]} Updated polynomial as string array
 */
function addRoot(polynomialStrings, root) {
    const oldPoly = stringsToBigInts(polynomialStrings)
    const newPoly = new Array(oldPoly.length + 1).fill(0n)

    for (let i = 0; i < oldPoly.length; i++) {
        // x term: coefficient stays same, degree increases
        newPoly[i + 1] = mod(newPoly[i + 1] + oldPoly[i])

        // constant term: multiply by -root
        newPoly[i] = mod(newPoly[i] - mod(oldPoly[i] * root))
    }

    return bigIntsToStrings(newPoly)
}

/**
 * Remove a root from an existing polynomial
 *
 * Given polynomial P(x) and root r where P(r) = 0,
 * computes P(x) / (x - r) using synthetic division
 *
 * @param {string[]} polynomialStrings - Array of coefficient strings (lowest degree first)
 * @param {bigint} root - The root to remove
 * @returns {string[] | null} Updated polynomial or null if root is invalid
 */
function removeRoot(polynomialStrings, root) {
    const oldPoly = stringsToBigInts(polynomialStrings)
    const n = oldPoly.length - 1

    if (n <= 0) {
        throw new Error("Polynomial degree too low")
    }

    const newPoly = new Array(n).fill(0n)

    // Synthetic division: divide oldPoly by (x - root)
    let carry = 0n
    for (let i = n; i >= 0; i--) {
        const coeff = mod(oldPoly[i] + carry)
        if (i > 0) {
            newPoly[i - 1] = coeff
            carry = mod(coeff * root)
        } else {
            // remainder should be 0 if root is valid
            if (coeff !== 0n) {
                return null // root not valid
            }
        }
    }

    return bigIntsToStrings(newPoly)
}

/**
 * Verify that a value is a root of the polynomial
 *
 * Evaluates P(root) and checks if result equals 0
 *
 * @param {string[]} polynomialStrings - Array of coefficient strings (lowest degree first)
 * @param {bigint} root - The root to verify
 * @returns {boolean} True if root is valid (P(root) = 0)
 */
function verifyPolynomial(polynomialStrings, root) {
    const coefficients = stringsToBigInts(polynomialStrings)
    let result = 0n
    let rootPower = 1n

    for (const coeff of coefficients) {
        result = mod(result + mod(coeff * rootPower))
        rootPower = mod(rootPower * root)
    }

    return result === 0n
}

/**
 * Interpolate a polynomial from a set of roots
 *
 * Given roots [r1, r2, ..., rn], computes polynomial P(x) where
 * P(ri) = 0 for all i
 *
 * @param {bigint[]} roots - Array of roots
 * @returns {string[]} Polynomial coefficients as string array
 */
function interpolatePolynomial(roots) {
    // Start with polynomial 1
    let polynomial = [1n]

    for (const root of roots) {
        const newPolynomial = new Array(polynomial.length + 1).fill(0n)

        // Multiply by (x - root)
        for (let i = 0; i < polynomial.length; i++) {
            // x term: coefficient stays same, degree increases
            newPolynomial[i + 1] = mod(newPolynomial[i + 1] + polynomial[i])

            // constant term: multiply by -root
            newPolynomial[i] = mod(newPolynomial[i] - mod(polynomial[i] * root))
        }

        polynomial = newPolynomial
    }

    return bigIntsToStrings(polynomial)
}

module.exports = {
    // Constants
    bn_254_fp,
    MAX_POLY_DEGREE,
    initial_polynomial,

    // Core functions
    addRoot,
    removeRoot,
    verifyPolynomial,
    interpolatePolynomial,

    // Utility functions
    stringsToBigInts,
    bigIntsToStrings,
    mod,
}
