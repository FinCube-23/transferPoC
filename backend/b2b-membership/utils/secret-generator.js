/**
 * Secret Generator Utility
 *
 * Generates cryptographic user secrets from email and organization salt
 * for zero-knowledge proof systems using the BN254 field.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

const crypto = require("crypto")
const { bn_254_fp } = require("./polynomial-operations")

/**
 * Hash a string using SHA-256
 * @param {string} input - Input string to hash
 * @returns {string} Hex hash string (64 characters)
 */
function hashString(input) {
    return crypto.createHash("sha256").update(input).digest("hex")
}

/**
 * Convert hex hash to BigInt with field modulus reduction
 * @param {string} hexHash - Hex hash string
 * @returns {bigint} BigInt value reduced modulo bn_254_fp
 */
function hexToBigInt(hexHash) {
    // Convert hex string to BigInt (add '0x' prefix for hex interpretation)
    const bigIntValue = BigInt("0x" + hexHash)

    // Apply modular reduction to ensure value is within field
    const reduced = bigIntValue % bn_254_fp

    // Ensure positive result (handle negative modulo in JavaScript)
    return reduced >= 0n ? reduced : reduced + bn_254_fp
}

/**
 * Validate email format (basic validation)
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email appears valid
 */
function isValidEmail(email) {
    if (!email || typeof email !== "string") {
        return false
    }

    // Basic email validation: contains @ and has characters before and after
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Validate organization salt format
 * @param {string} orgSalt - Organization salt to validate
 * @returns {boolean} True if salt appears valid
 */
function isValidOrgSalt(orgSalt) {
    if (!orgSalt || typeof orgSalt !== "string") {
        return false
    }

    // Organization salt should be a 64-character hex string (32 bytes)
    const hexRegex = /^[0-9a-fA-F]{64}$/
    return hexRegex.test(orgSalt)
}

/**
 * Generate user secret from email and organization salt
 *
 * Process:
 * 1. Concatenate email with organization salt
 * 2. Hash the concatenated string using SHA-256
 * 3. Convert hash to BigInt
 * 4. Apply modular reduction with bn_254_fp
 *
 * @param {string} email - User email address
 * @param {string} orgSalt - Organization salt (64-character hex string)
 * @returns {bigint} User secret as BigInt (reduced modulo bn_254_fp)
 * @throws {Error} If parameters are invalid
 */
function generateUserSecret(email, orgSalt) {
    // Validate email parameter (Requirement 2.5)
    if (!isValidEmail(email)) {
        throw new Error(
            "INVALID_SECRET_PARAMETERS: Invalid or missing email address"
        )
    }

    // Validate organization salt parameter (Requirement 2.5)
    if (!isValidOrgSalt(orgSalt)) {
        throw new Error(
            "INVALID_SECRET_PARAMETERS: Invalid or missing organization salt"
        )
    }

    // Concatenate email with organization salt (Requirement 2.1)
    const concatenated = email + orgSalt

    // Hash the concatenated string using SHA-256 (Requirement 2.2)
    const hash = hashString(concatenated)

    // Convert hash to BigInt and apply modular reduction (Requirements 2.3, 2.4)
    const secret = hexToBigInt(hash)

    return secret
}

module.exports = {
    generateUserSecret,
    hashString,
    hexToBigInt,
    isValidEmail,
    isValidOrgSalt,
}
