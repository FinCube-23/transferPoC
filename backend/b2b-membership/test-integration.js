/**
 * Integration Tests for End-to-End Workflows
 *
 * Tests complete user creation flows with batch assignment,
 * batch capacity management, polynomial verification, and error handling.
 *
 * Requirements: All (comprehensive integration testing)
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const Organization = require("./models/organization")
const User = require("./models/user")
const Batch = require("./models/batch")
const userManagementService = require("./services/user-management-service")
const {
    verifyPolynomial,
    MAX_POLY_DEGREE,
} = require("./utils/polynomial-operations")
const { generateUserSecret } = require("./utils/secret-generator")

// Test counters
let testsPassed = 0
let testsFailed = 0

/**
 * Helper function to log test results
 */
function logTest(testName, passed, details = "") {
    if (passed) {
        console.log(`✓ ${testName}`)
        if (details) console.log(`  ${details}`)
        testsPassed++
    } else {
        console.log(`✗ ${testName}`)
        if (details) console.log(`  ${details}`)
        testsFailed++
    }
}

/**
 * Test 1: Complete user creation with batch assignment
 *
 * Verifies the full end-to-end flow:
 * - User is created successfully
 * - User is assigned to a batch
 * - Batch polynomial is updated
 * - User secret is a valid root of the polynomial
 */
async function testCompleteUserCreation() {
    console.log(
        "\n=== Test 1: Complete User Creation with Batch Assignment ==="
    )

    try {
        // Create test organization
        const testOrg = new Organization({
            org_id: 1001,
            wallet_address: "0x1234567890123456789012345678901234567890",
        })
        await testOrg.save()

        // Create user with batch assignment
        const userData = {
            email: "test1@example.com",
            user_id: 1001,
            balance: 100,
            orgWalletAddress: testOrg.wallet_address,
        }

        const result = await userManagementService.createUserWithBatch(userData)

        // Verify success
        logTest(
            "User creation returns success",
            result.success === true,
            `success: ${result.success}`
        )

        // Verify user has required fields
        logTest(
            "User has user_id",
            result.user && result.user.user_id === 1001,
            `user_id: ${result.user?.user_id}`
        )

        logTest(
            "User has batch_id",
            result.user && result.user.batch_id !== null,
            `batch_id: ${result.user?.batch_id}`
        )

        logTest(
            "User has balance",
            result.user && result.user.balance === 100,
            `balance: ${result.user?.balance}`
        )

        logTest(
            "User has zkp_key",
            result.user && result.user.zkp_key !== null,
            `zkp_key: ${result.user?.zkp_key}`
        )

        // Verify batch information
        logTest(
            "Batch information is returned",
            result.batch && result.batch._id !== null,
            `batch_id: ${result.batch?._id}`
        )

        logTest(
            "Batch has equation",
            result.batch && Array.isArray(result.batch.equation),
            `equation length: ${result.batch?.equation?.length}`
        )

        // Verify polynomial contains user secret as root
        const userSecret = generateUserSecret(userData.email, testOrg.org_salt)
        const isValidRoot = verifyPolynomial(result.batch.equation, userSecret)

        logTest(
            "User secret is valid root of batch polynomial",
            isValidRoot === true,
            `verifyPolynomial: ${isValidRoot}`
        )

        // Verify user record in database
        const dbUser = await User.findOne({ user_id: 1001 })
        logTest(
            "User persisted in database",
            dbUser !== null,
            `found user: ${dbUser?.user_id}`
        )

        logTest(
            "User batch_id matches returned batch",
            dbUser &&
                result.batch &&
                dbUser.batch_id.toString() === result.batch._id.toString(),
            `db batch_id: ${dbUser?.batch_id}, returned: ${result.batch?._id}`
        )

        // Verify batch record in database
        const dbBatch = await Batch.findById(result.batch._id)
        logTest(
            "Batch persisted in database",
            dbBatch !== null,
            `found batch: ${dbBatch?._id}`
        )

        logTest(
            "Batch equation matches",
            dbBatch &&
                result.batch &&
                JSON.stringify(dbBatch.equation) ===
                    JSON.stringify(result.batch.equation),
            `equations match: ${
                dbBatch && result.batch
                    ? JSON.stringify(dbBatch.equation) ===
                      JSON.stringify(result.batch.equation)
                    : false
            }`
        )
    } catch (error) {
        logTest("Complete user creation test", false, `Error: ${error.message}`)
        console.error(error.stack)
    }
}

/**
 * Test 2: Multiple users added to same batch
 *
 * Verifies that:
 * - Multiple users can be added to the same batch
 * - Each user's secret is a valid root
 * - Polynomial degree increases with each user
 * - All users share the same batch_id
 */
async function testMultipleUsersInSameBatch() {
    console.log("\n=== Test 2: Multiple Users Added to Same Batch ===")

    try {
        // Create a new organization for this test to ensure isolation
        const testOrg = new Organization({
            org_id: 2000,
            wallet_address: "0x2222222222222222222222222222222222222222",
        })
        await testOrg.save()

        // Create first user
        const user1Data = {
            email: "user1@example.com",
            user_id: 2001,
            balance: 50,
            orgWalletAddress: testOrg.wallet_address,
        }

        const result1 = await userManagementService.createUserWithBatch(
            user1Data
        )
        logTest(
            "First user created successfully",
            result1.success === true,
            `user_id: ${result1.user?.user_id}`
        )

        const batch1Id = result1.batch._id
        const equation1Length = result1.batch.equation.length

        // Create second user (should use same batch)
        const user2Data = {
            email: "user2@example.com",
            user_id: 2002,
            balance: 75,
            orgWalletAddress: testOrg.wallet_address,
        }

        const result2 = await userManagementService.createUserWithBatch(
            user2Data
        )
        logTest(
            "Second user created successfully",
            result2.success === true,
            `user_id: ${result2.user?.user_id}`
        )

        // Verify both users share the same batch
        logTest(
            "Both users assigned to same batch",
            result2.batch._id.toString() === batch1Id.toString(),
            `batch1: ${batch1Id}, batch2: ${result2.batch._id}`
        )

        // Verify polynomial degree increased
        const equation2Length = result2.batch.equation.length
        logTest(
            "Polynomial degree increased",
            equation2Length === equation1Length + 1,
            `before: ${equation1Length}, after: ${equation2Length}`
        )

        // Verify both secrets are valid roots
        const secret1 = generateUserSecret(user1Data.email, testOrg.org_salt)
        const secret2 = generateUserSecret(user2Data.email, testOrg.org_salt)

        const isRoot1Valid = verifyPolynomial(result2.batch.equation, secret1)
        const isRoot2Valid = verifyPolynomial(result2.batch.equation, secret2)

        logTest(
            "First user secret is valid root",
            isRoot1Valid === true,
            `verifyPolynomial: ${isRoot1Valid}`
        )

        logTest(
            "Second user secret is valid root",
            isRoot2Valid === true,
            `verifyPolynomial: ${isRoot2Valid}`
        )

        // Create third user
        const user3Data = {
            email: "user3@example.com",
            user_id: 2003,
            balance: 125,
            orgWalletAddress: testOrg.wallet_address,
        }

        const result3 = await userManagementService.createUserWithBatch(
            user3Data
        )
        logTest(
            "Third user created successfully",
            result3.success === true,
            `user_id: ${result3.user?.user_id}`
        )

        // Verify all three secrets are valid roots
        const secret3 = generateUserSecret(user3Data.email, testOrg.org_salt)
        const allRootsValid =
            verifyPolynomial(result3.batch.equation, secret1) &&
            verifyPolynomial(result3.batch.equation, secret2) &&
            verifyPolynomial(result3.batch.equation, secret3)

        logTest(
            "All three user secrets are valid roots",
            allRootsValid === true,
            `all valid: ${allRootsValid}`
        )

        // Verify user count in database for this test's organization
        const usersFromThisTest = await User.countDocuments({
            batch_id: batch1Id,
            user_id: { $in: [2001, 2002, 2003] },
        })
        logTest(
            "Correct number of users from this test in batch",
            usersFromThisTest === 3,
            `expected: 3, actual: ${usersFromThisTest}`
        )
    } catch (error) {
        logTest(
            "Multiple users in same batch test",
            false,
            `Error: ${error.message}`
        )
        console.error(error.stack)
    }
}

/**
 * Test 3: Batch creation when all batches are full
 *
 * Verifies that:
 * - When a batch reaches capacity, a new batch is created
 * - New users are assigned to the new batch
 * - Old batch remains unchanged
 */
async function testBatchCreationWhenFull() {
    console.log("\n=== Test 3: Batch Creation When All Batches Are Full ===")

    try {
        // Create a new organization for this test
        const testOrg2 = new Organization({
            org_id: 3001,
            wallet_address: "0xabcdef1234567890123456789012345678901234",
        })
        await testOrg2.save()

        // Create a batch and fill it to capacity
        console.log(
            `  Creating batch with ${MAX_POLY_DEGREE} users (this may take a moment)...`
        )

        let firstBatchId = null
        const userIds = []

        // Create MAX_POLY_DEGREE users to fill the batch
        for (let i = 0; i < MAX_POLY_DEGREE; i++) {
            const userData = {
                email: `fullbatch${i}@example.com`,
                user_id: 3000 + i,
                balance: 10,
                orgWalletAddress: testOrg2.wallet_address,
            }

            const result = await userManagementService.createUserWithBatch(
                userData
            )

            if (!result.success) {
                logTest(
                    `Create user ${i + 1}/${MAX_POLY_DEGREE}`,
                    false,
                    `Error: ${result.error?.message}`
                )
                return
            }

            if (i === 0) {
                firstBatchId = result.batch._id
            }

            userIds.push(result.user.user_id)

            // Log progress every 20 users
            if ((i + 1) % 20 === 0) {
                console.log(
                    `  Progress: ${i + 1}/${MAX_POLY_DEGREE} users created`
                )
            }
        }

        logTest(
            `Created ${MAX_POLY_DEGREE} users`,
            userIds.length === MAX_POLY_DEGREE,
            `count: ${userIds.length}`
        )

        // Verify all users are in the same batch
        const usersInFirstBatch = await User.countDocuments({
            batch_id: firstBatchId,
        })
        logTest(
            "All users assigned to first batch",
            usersInFirstBatch === MAX_POLY_DEGREE,
            `expected: ${MAX_POLY_DEGREE}, actual: ${usersInFirstBatch}`
        )

        // Create one more user - should trigger new batch creation
        console.log("  Creating user that should trigger new batch...")
        const overflowUserData = {
            email: "overflow@example.com",
            user_id: 3000 + MAX_POLY_DEGREE,
            balance: 999,
            orgWalletAddress: testOrg2.wallet_address,
        }

        const overflowResult = await userManagementService.createUserWithBatch(
            overflowUserData
        )

        logTest(
            "Overflow user created successfully",
            overflowResult.success === true,
            `user_id: ${overflowResult.user?.user_id}`
        )

        // Verify new batch was created
        const secondBatchId = overflowResult.batch._id
        logTest(
            "New batch created for overflow user",
            secondBatchId.toString() !== firstBatchId.toString(),
            `first batch: ${firstBatchId}, second batch: ${secondBatchId}`
        )

        // Verify overflow user is in new batch
        logTest(
            "Overflow user assigned to new batch",
            overflowResult.user.batch_id.toString() ===
                secondBatchId.toString(),
            `user batch: ${overflowResult.user.batch_id}, new batch: ${secondBatchId}`
        )

        // Verify first batch still has MAX_POLY_DEGREE users
        const finalCountFirstBatch = await User.countDocuments({
            batch_id: firstBatchId,
        })
        logTest(
            "First batch unchanged",
            finalCountFirstBatch === MAX_POLY_DEGREE,
            `count: ${finalCountFirstBatch}`
        )

        // Verify second batch has the overflow user
        const overflowUserInBatch = await User.findOne({
            user_id: 3000 + MAX_POLY_DEGREE,
            batch_id: secondBatchId,
        })
        logTest(
            "Overflow user is in second batch",
            overflowUserInBatch !== null,
            `user found: ${overflowUserInBatch !== null}`
        )

        // Verify total batch count
        const totalBatches = await Batch.countDocuments()
        logTest(
            "Two batches exist in database",
            totalBatches >= 2,
            `total batches: ${totalBatches}`
        )
    } catch (error) {
        logTest(
            "Batch creation when full test",
            false,
            `Error: ${error.message}`
        )
        console.error(error.stack)
    }
}

/**
 * Test 4: Polynomial verification after user additions
 *
 * Verifies that:
 * - After adding multiple users, all their secrets are valid roots
 * - Non-user secrets are not valid roots
 * - Polynomial evaluation works correctly
 */
async function testPolynomialVerification() {
    console.log(
        "\n=== Test 4: Polynomial Verification After User Additions ==="
    )

    try {
        // Create test organization
        const testOrg3 = new Organization({
            org_id: 4001,
            wallet_address: "0x9876543210987654321098765432109876543210",
        })
        await testOrg3.save()

        // Create multiple users
        const userEmails = [
            "poly1@example.com",
            "poly2@example.com",
            "poly3@example.com",
            "poly4@example.com",
            "poly5@example.com",
        ]

        const userSecrets = []
        let finalBatch = null

        for (let i = 0; i < userEmails.length; i++) {
            const userData = {
                email: userEmails[i],
                user_id: 4000 + i,
                balance: 50 + i * 10,
                orgWalletAddress: testOrg3.wallet_address,
            }

            const result = await userManagementService.createUserWithBatch(
                userData
            )

            if (!result.success) {
                logTest(
                    `Create user ${i + 1}`,
                    false,
                    `Error: ${result.error?.message}`
                )
                return
            }

            const secret = generateUserSecret(userEmails[i], testOrg3.org_salt)
            userSecrets.push(secret)
            finalBatch = result.batch
        }

        logTest(
            "All users created successfully",
            userSecrets.length === userEmails.length,
            `count: ${userSecrets.length}`
        )

        // Verify all user secrets are valid roots
        let allValid = true
        for (let i = 0; i < userSecrets.length; i++) {
            const isValid = verifyPolynomial(
                finalBatch.equation,
                userSecrets[i]
            )
            if (!isValid) {
                allValid = false
                console.log(`  User ${i + 1} secret is not a valid root`)
            }
        }

        logTest(
            "All user secrets are valid roots",
            allValid === true,
            `all valid: ${allValid}`
        )

        // Test with non-user secret (should not be valid)
        const nonUserSecret = generateUserSecret(
            "nonuser@example.com",
            testOrg3.org_salt
        )
        const nonUserIsValid = verifyPolynomial(
            finalBatch.equation,
            nonUserSecret
        )

        logTest(
            "Non-user secret is not a valid root",
            nonUserIsValid === false,
            `is valid: ${nonUserIsValid}`
        )

        // Verify polynomial degree is at least the user count
        // (may be higher if batch is shared with other tests)
        const minExpectedDegree = userEmails.length
        const actualDegree = finalBatch.equation.length - 1

        logTest(
            "Polynomial degree is at least user count",
            actualDegree >= minExpectedDegree,
            `min expected: ${minExpectedDegree}, actual: ${actualDegree}`
        )

        // Verify polynomial coefficients are valid BigInt strings
        let allCoefficientsValid = true
        for (const coeff of finalBatch.equation) {
            try {
                BigInt(coeff)
            } catch (e) {
                allCoefficientsValid = false
                console.log(`  Invalid coefficient: ${coeff}`)
            }
        }

        logTest(
            "All polynomial coefficients are valid BigInt strings",
            allCoefficientsValid === true,
            `all valid: ${allCoefficientsValid}`
        )
    } catch (error) {
        logTest(
            "Polynomial verification test",
            false,
            `Error: ${error.message}`
        )
        console.error(error.stack)
    }
}

/**
 * Test 5: Rollback scenarios on failures
 *
 * Verifies that:
 * - Failed user creation does not persist partial state
 * - Database remains consistent after errors
 * - Error responses are properly formatted
 */
async function testRollbackScenarios() {
    console.log("\n=== Test 5: Rollback Scenarios on Failures ===")

    try {
        const testOrg = await Organization.findOne({ org_id: 1001 })

        // Test 5a: Missing required fields
        console.log("\n  Test 5a: Missing required fields")
        const incompleteData = {
            email: "incomplete@example.com",
            user_id: 5001,
            // Missing balance and orgWalletAddress
        }

        const result1 = await userManagementService.createUserWithBatch(
            incompleteData
        )

        logTest(
            "Incomplete data rejected",
            result1.success === false,
            `success: ${result1.success}`
        )

        logTest(
            "Error type is INVALID_SECRET_PARAMETERS",
            result1.error && result1.error.type === "INVALID_SECRET_PARAMETERS",
            `error type: ${result1.error?.type}`
        )

        // Verify no user was created
        const user1 = await User.findOne({ user_id: 5001 })
        logTest(
            "No user persisted for incomplete data",
            user1 === null,
            `user found: ${user1 !== null}`
        )

        // Test 5b: Duplicate user_id
        console.log("\n  Test 5b: Duplicate user_id")
        const duplicateData = {
            email: "duplicate@example.com",
            user_id: 1001, // Already exists from Test 1
            balance: 50,
            orgWalletAddress: testOrg.wallet_address,
        }

        const result2 = await userManagementService.createUserWithBatch(
            duplicateData
        )

        logTest(
            "Duplicate user_id rejected",
            result2.success === false,
            `success: ${result2.success}`
        )

        logTest(
            "Error type is DATABASE_ERROR",
            result2.error && result2.error.type === "DATABASE_ERROR",
            `error type: ${result2.error?.type}`
        )

        // Verify original user unchanged
        const originalUser = await User.findOne({ user_id: 1001 })
        logTest(
            "Original user unchanged",
            originalUser && originalUser.zkp_key === "test1@example.com",
            `zkp_key: ${originalUser?.zkp_key}`
        )

        // Test 5c: Non-existent organization
        console.log("\n  Test 5c: Non-existent organization")
        const invalidOrgData = {
            email: "invalidorg@example.com",
            user_id: 5002,
            balance: 100,
            orgWalletAddress: "0xnonexistent1234567890123456789012345678",
        }

        const result3 = await userManagementService.createUserWithBatch(
            invalidOrgData
        )

        logTest(
            "Non-existent organization rejected",
            result3.success === false,
            `success: ${result3.success}`
        )

        logTest(
            "Error type is ORGANIZATION_NOT_FOUND",
            result3.error && result3.error.type === "ORGANIZATION_NOT_FOUND",
            `error type: ${result3.error?.type}`
        )

        // Verify no user was created
        const user3 = await User.findOne({ user_id: 5002 })
        logTest(
            "No user persisted for invalid organization",
            user3 === null,
            `user found: ${user3 !== null}`
        )

        // Test 5d: Invalid email
        console.log("\n  Test 5d: Invalid email")
        const invalidEmailData = {
            email: "",
            user_id: 5003,
            balance: 100,
            orgWalletAddress: testOrg.wallet_address,
        }

        const result4 = await userManagementService.createUserWithBatch(
            invalidEmailData
        )

        logTest(
            "Invalid email rejected",
            result4.success === false,
            `success: ${result4.success}`
        )

        logTest(
            "Error response has type field",
            result4.error && result4.error.type !== undefined,
            `error type: ${result4.error?.type}`
        )

        logTest(
            "Error response has message field",
            result4.error && result4.error.message !== undefined,
            `has message: ${result4.error?.message !== undefined}`
        )

        // Verify no user was created
        const user4 = await User.findOne({ user_id: 5003 })
        logTest(
            "No user persisted for invalid email",
            user4 === null,
            `user found: ${user4 !== null}`
        )

        // Test 5e: Verify database consistency
        console.log("\n  Test 5e: Database consistency check")
        const allUsers = await User.find()
        const allBatches = await Batch.find()

        // Verify all users have valid batch_id references
        let allReferencesValid = true
        for (const user of allUsers) {
            const batch = await Batch.findById(user.batch_id)
            if (!batch) {
                allReferencesValid = false
                console.log(`  User ${user.user_id} has invalid batch_id`)
            }
        }

        logTest(
            "All user batch_id references are valid",
            allReferencesValid === true,
            `all valid: ${allReferencesValid}`
        )

        // Verify all batches have valid equations
        let allEquationsValid = true
        for (const batch of allBatches) {
            if (!Array.isArray(batch.equation) || batch.equation.length === 0) {
                allEquationsValid = false
                console.log(`  Batch ${batch._id} has invalid equation`)
            }
        }

        logTest(
            "All batch equations are valid",
            allEquationsValid === true,
            `all valid: ${allEquationsValid}`
        )
    } catch (error) {
        logTest("Rollback scenarios test", false, `Error: ${error.message}`)
        console.error(error.stack)
    }
}

/**
 * Main test runner
 */
async function runIntegrationTests() {
    console.log("=".repeat(60))
    console.log("INTEGRATION TESTS - END-TO-END WORKFLOWS")
    console.log("=".repeat(60))

    try {
        // Connect to database
        console.log("\nConnecting to database...")
        await connectDatabase()
        console.log("✓ Connected to database\n")

        // Clean up any existing test data
        console.log("Cleaning up existing test data...")
        await User.deleteMany({})
        await Batch.deleteMany({})
        await Organization.deleteMany({})
        console.log("✓ Test data cleaned up\n")

        // Run all tests
        await testCompleteUserCreation()
        await testMultipleUsersInSameBatch()
        await testBatchCreationWhenFull()
        await testPolynomialVerification()
        await testRollbackScenarios()

        // Print summary
        console.log("\n" + "=".repeat(60))
        console.log("TEST SUMMARY")
        console.log("=".repeat(60))
        console.log(`Tests Passed: ${testsPassed}`)
        console.log(`Tests Failed: ${testsFailed}`)
        console.log(`Total Tests: ${testsPassed + testsFailed}`)

        if (testsFailed === 0) {
            console.log("\n🎉 All integration tests passed!")
        } else {
            console.log(`\n⚠️  ${testsFailed} test(s) failed`)
        }

        // Clean up test data
        console.log("\nCleaning up test data...")
        await User.deleteMany({})
        await Batch.deleteMany({})
        await Organization.deleteMany({})
        console.log("✓ Test data cleaned up")

        // Disconnect from database
        console.log("\nDisconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnected from database")

        process.exit(testsFailed === 0 ? 0 : 1)
    } catch (error) {
        console.error("\n✗ Integration tests failed:", error.message)
        console.error(error.stack)
        await disconnectDatabase()
        process.exit(1)
    }
}

// Run tests
runIntegrationTests()
