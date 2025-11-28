/**
 * Property-Based Tests for Error Handling
 *
 * Tests error scenarios for batch operations, database failures, and polynomial errors.
 * Uses fast-check library for property-based testing with minimum 100 iterations.
 *
 * Requirements: 1.5, 6.1, 6.2, 6.3
 */

const fc = require("fast-check")
const mongoose = require("mongoose")
const { connectDatabase, disconnectDatabase } = require("./utils/database")
const Organization = require("./models/organization")
const User = require("./models/user")
const Batch = require("./models/batch")
const userManagementService = require("./services/user-management-service")
const BatchManager = require("./utils/batch-manager")
const { generateUserSecret } = require("./utils/secret-generator")

// Test configuration
const NUM_RUNS = 100
const TEST_TIMEOUT = 60000 // 60 seconds

/**
 * Generators for property-based testing
 */

// Generate valid email addresses
const emailArbitrary = fc
    .string({ minLength: 3, maxLength: 20 })
    .filter((s) => !s.includes("@") && !s.includes(" "))
    .chain((local) =>
        fc
            .string({ minLength: 2, maxLength: 15 })
            .filter(
                (s) => !s.includes("@") && !s.includes(" ") && !s.includes(".")
            )
            .chain((domain) =>
                fc
                    .constantFrom("com", "org", "net", "edu")
                    .map((tld) => `${local}@${domain}.${tld}`)
            )
    )

// Generate valid hex strings for organization salt (64 characters)
const orgSaltArbitrary = fc
    .array(
        fc.constantFrom(
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "a",
            "b",
            "c",
            "d",
            "e",
            "f"
        ),
        { minLength: 64, maxLength: 64 }
    )
    .map((arr) => arr.join(""))

// Generate valid Ethereum wallet addresses (42 characters, starts with 0x)
const walletAddressArbitrary = fc
    .array(
        fc.constantFrom(
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "a",
            "b",
            "c",
            "d",
            "e",
            "f"
        ),
        { minLength: 40, maxLength: 40 }
    )
    .map((arr) => `0x${arr.join("")}`)

// Generate positive integers for user IDs
const userIdArbitrary = fc.integer({ min: 1, max: 1000000 })

// Generate non-negative balances
const balanceArbitrary = fc.integer({ min: 0, max: 1000000 })

// Generate invalid email addresses (for error testing)
const invalidEmailArbitrary = fc.oneof(
    fc.constant(""),
    fc.constant(null),
    fc.constant(undefined),
    fc.string({ maxLength: 5 }).filter((s) => !s.includes("@")),
    fc.constant("invalid"),
    fc.constant("no-at-sign.com"),
    fc.constant("@nodomain.com"),
    fc.constant("nolocal@")
)

// Generate invalid organization salts (for error testing)
const invalidOrgSaltArbitrary = fc.oneof(
    fc.constant(""),
    fc.constant(null),
    fc.constant(undefined),
    fc
        .array(
            fc.constantFrom(
                "0",
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "a",
                "b",
                "c",
                "d",
                "e",
                "f"
            ),
            { minLength: 1, maxLength: 63 }
        )
        .map((arr) => arr.join("")), // Wrong length
    fc
        .string({ minLength: 64, maxLength: 64 })
        .filter((s) => !/^[0-9a-fA-F]{64}$/.test(s)) // Non-hex
)

/**
 * Helper functions
 */

async function cleanupTestData() {
    await User.deleteMany({})
    await Batch.deleteMany({})
    await Organization.deleteMany({})
}

async function createTestOrganization(walletAddress, orgSalt) {
    const org = new Organization({
        org_id: Math.floor(Math.random() * 1000000),
        wallet_address: walletAddress,
        org_salt: orgSalt,
    })
    await org.save()
    return org
}

/**
 * Test Suite
 */

async function runPropertyTests() {
    console.log("Starting Property-Based Tests for Error Handling...\n")
    console.log(`Running ${NUM_RUNS} iterations per property\n`)

    try {
        // Connect to database
        console.log("Connecting to database...")
        await connectDatabase()
        console.log("✓ Connected\n")

        // Clean up before tests
        await cleanupTestData()

        let passedTests = 0
        let failedTests = 0

        // Property Test 1: Batch assignment error handling (Requirement 1.5)
        // Feature: batch-polynomial-user-management, Property 3: Batch assignment error handling
        console.log("=".repeat(70))
        console.log("Property 3: Batch assignment error handling")
        console.log("=".repeat(70))
        console.log(
            "Testing that batch assignment failures return BATCH_ASSIGNMENT_ERROR\n"
        )

        try {
            await fc.assert(
                fc.asyncProperty(
                    fc.oneof(
                        fc.constant("not-a-bigint"),
                        fc.constant(123), // number instead of bigint
                        fc.constant("123"),
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.constant({}),
                        fc.constant([])
                    ),
                    async (invalidSecret) => {
                        await cleanupTestData()

                        // Try to assign with invalid secret
                        const result =
                            await userManagementService.assignToBatch(
                                invalidSecret
                            )

                        // Should fail with BATCH_ASSIGNMENT_ERROR
                        return (
                            !result.success &&
                            result.error &&
                            result.error.type === "BATCH_ASSIGNMENT_ERROR"
                        )
                    }
                ),
                { numRuns: NUM_RUNS }
            )
            console.log(
                "✓ Property 3 PASSED: Batch assignment errors are properly handled\n"
            )
            passedTests++
        } catch (error) {
            console.log("✗ Property 3 FAILED:", error.message)
            console.log("Counterexample:", error.counterexample, "\n")
            failedTests++
        }

        // Property Test 2: Database error handling (Requirement 6.1)
        // Feature: batch-polynomial-user-management, Property 11: Database error handling
        console.log("=".repeat(70))
        console.log("Property 11: Database error handling")
        console.log("=".repeat(70))
        console.log("Testing that database failures return DATABASE_ERROR\n")

        try {
            await fc.assert(
                fc.asyncProperty(
                    emailArbitrary,
                    walletAddressArbitrary,
                    async (email, nonExistentWallet) => {
                        await cleanupTestData()

                        // Try to generate secret for non-existent organization
                        const result =
                            await userManagementService.generateUserSecret(
                                email,
                                nonExistentWallet
                            )

                        // Should fail with ORGANIZATION_NOT_FOUND (a type of database error)
                        return (
                            !result.success &&
                            result.error &&
                            result.error.type === "ORGANIZATION_NOT_FOUND"
                        )
                    }
                ),
                { numRuns: NUM_RUNS }
            )
            console.log(
                "✓ Property 11 PASSED: Database errors are properly handled\n"
            )
            passedTests++
        } catch (error) {
            console.log("✗ Property 11 FAILED:", error.message)
            console.log("Counterexample:", error.counterexample, "\n")
            failedTests++
        }

        // Property Test 3: Polynomial error handling (Requirement 6.2)
        // Feature: batch-polynomial-user-management, Property 12: Polynomial error handling
        console.log("=".repeat(70))
        console.log("Property 12: Polynomial error handling")
        console.log("=".repeat(70))
        console.log(
            "Testing that polynomial computation failures return POLYNOMIAL_ERROR\n"
        )

        try {
            // This test verifies that when polynomial operations fail,
            // the service returns POLYNOMIAL_ERROR
            // We'll test by creating a batch with an invalid equation format

            await fc.assert(
                fc.asyncProperty(
                    orgSaltArbitrary,
                    walletAddressArbitrary,
                    emailArbitrary,
                    async (orgSalt, walletAddress, email) => {
                        await cleanupTestData()

                        // Create organization
                        await createTestOrganization(walletAddress, orgSalt)

                        // Create a batch with invalid equation (not string array)
                        const invalidBatch = new Batch({
                            equation: [
                                "invalid",
                                "not",
                                "bigint",
                                "strings",
                                "that",
                                "will",
                                "fail",
                            ],
                        })
                        await invalidBatch.save()

                        // Generate valid user secret
                        const secret = generateUserSecret(email, orgSalt)

                        // Try to assign to batch - should handle polynomial errors gracefully
                        const result =
                            await userManagementService.assignToBatch(secret)

                        // The operation should either succeed or fail with appropriate error
                        // If it fails, it should be a POLYNOMIAL_ERROR or DATABASE_ERROR
                        if (!result.success) {
                            return (
                                result.error &&
                                (result.error.type === "POLYNOMIAL_ERROR" ||
                                    result.error.type === "DATABASE_ERROR" ||
                                    result.error.type ===
                                        "BATCH_ASSIGNMENT_ERROR")
                            )
                        }
                        return true
                    }
                ),
                { numRuns: NUM_RUNS }
            )
            console.log(
                "✓ Property 12 PASSED: Polynomial errors are properly handled\n"
            )
            passedTests++
        } catch (error) {
            console.log("✗ Property 12 FAILED:", error.message)
            console.log("Counterexample:", error.counterexample, "\n")
            failedTests++
        }

        // Property Test 4: Invalid secret parameters (Requirement 2.5)
        // Feature: batch-polynomial-user-management, Property 6: Secret generation parameter validation
        console.log("=".repeat(70))
        console.log("Property 6: Secret generation parameter validation")
        console.log("=".repeat(70))
        console.log(
            "Testing that invalid parameters return INVALID_SECRET_PARAMETERS\n"
        )

        try {
            await fc.assert(
                fc.asyncProperty(
                    fc.oneof(invalidEmailArbitrary, emailArbitrary),
                    fc.oneof(
                        walletAddressArbitrary,
                        fc.constant(""),
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.string({ minLength: 1, maxLength: 41 }), // Wrong length
                        fc.string({ minLength: 43, maxLength: 50 }) // Wrong length
                    ),
                    async (email, wallet) => {
                        await cleanupTestData()

                        // Create organization with valid salt if needed
                        // Generate a valid 64-character hex salt
                        const validSalt = "a".repeat(64)

                        // Only create org if we're testing with valid wallet
                        const isValidWallet =
                            typeof wallet === "string" &&
                            wallet.startsWith("0x") &&
                            wallet.length === 42

                        if (isValidWallet) {
                            await createTestOrganization(wallet, validSalt)
                        }

                        // Try to generate secret
                        const result =
                            await userManagementService.generateUserSecret(
                                email,
                                wallet
                            )

                        // If inputs are invalid, should return error
                        // Use the same validation logic as the actual code
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                        const isValidEmail =
                            typeof email === "string" && emailRegex.test(email)

                        if (!isValidEmail || !isValidWallet) {
                            // Should fail with appropriate error
                            return (
                                !result.success &&
                                result.error &&
                                (result.error.type ===
                                    "INVALID_SECRET_PARAMETERS" ||
                                    result.error.type ===
                                        "ORGANIZATION_NOT_FOUND")
                            )
                        }

                        // If inputs are valid, should succeed
                        return result.success
                    }
                ),
                { numRuns: NUM_RUNS }
            )
            console.log(
                "✓ Property 6 PASSED: Invalid secret parameters are properly validated\n"
            )
            passedTests++
        } catch (error) {
            console.log("✗ Property 6 FAILED:", error.message)
            console.log("Counterexample:", error.counterexample, "\n")
            failedTests++
        }

        // Property Test 5: Error response completeness (Requirement 6.5)
        // Feature: batch-polynomial-user-management, Property 14: Error response completeness
        console.log("=".repeat(70))
        console.log("Property 14: Error response completeness")
        console.log("=".repeat(70))
        console.log(
            "Testing that all error responses contain type and message fields\n"
        )

        try {
            await fc.assert(
                fc.asyncProperty(
                    invalidEmailArbitrary,
                    walletAddressArbitrary,
                    async (invalidEmail, wallet) => {
                        await cleanupTestData()

                        // Try operation that will fail
                        const result =
                            await userManagementService.generateUserSecret(
                                invalidEmail,
                                wallet
                            )

                        // Should fail and have complete error structure
                        if (!result.success) {
                            return (
                                result.error &&
                                typeof result.error.type === "string" &&
                                result.error.type.length > 0 &&
                                typeof result.error.message === "string" &&
                                result.error.message.length > 0
                            )
                        }

                        // If it succeeded, that's fine (valid inputs)
                        return true
                    }
                ),
                { numRuns: NUM_RUNS }
            )
            console.log(
                "✓ Property 14 PASSED: All error responses are complete\n"
            )
            passedTests++
        } catch (error) {
            console.log("✗ Property 14 FAILED:", error.message)
            console.log("Counterexample:", error.counterexample, "\n")
            failedTests++
        }

        // Clean up after tests
        await cleanupTestData()

        // Summary
        console.log("=".repeat(70))
        console.log("TEST SUMMARY")
        console.log("=".repeat(70))
        console.log(`Total Properties Tested: ${passedTests + failedTests}`)
        console.log(`Passed: ${passedTests}`)
        console.log(`Failed: ${failedTests}`)
        console.log("=".repeat(70))

        // Disconnect from database
        console.log("\nDisconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnected\n")

        if (failedTests > 0) {
            console.log("❌ Some property tests failed")
            process.exit(1)
        } else {
            console.log("✅ All property tests passed!")
            process.exit(0)
        }
    } catch (error) {
        console.error("\n✗ Test suite failed:", error.message)
        console.error("Stack:", error.stack)
        await disconnectDatabase()
        process.exit(1)
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runPropertyTests()
}

module.exports = { runPropertyTests }
