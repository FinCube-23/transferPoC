/**
 * Test script for User Management Service
 *
 * This script verifies the user management service methods work correctly
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const Organization = require("./models/organization")
const User = require("./models/user")
const Batch = require("./models/batch")
const userManagementService = require("./services/user-management-service")

async function testUserManagementService() {
    console.log("Testing User Management Service...\n")

    try {
        // Connect to database
        console.log("Connecting to database...")
        await connectDatabase()
        console.log("✓ Connected\n")

        // Clean up any existing test data
        console.log("Cleaning up any existing test data...")
        await User.deleteMany({})
        await Batch.deleteMany({})
        await Organization.deleteMany({})
        console.log("✓ Cleaned up\n")

        // Test 1: Generate reference number with valid wallet address
        console.log(
            "Test 1: Generating reference number with valid wallet address..."
        )
        const walletAddress = "0x1234567890123456789012345678901234567890"
        const refNumber =
            userManagementService.generateReferenceNumber(walletAddress)

        console.log("✓ Reference number generated:", refNumber)
        console.log(
            "  - Format check:",
            refNumber.startsWith(walletAddress + "_")
        )
        console.log("  - Contains UUID:", refNumber.split("_").length === 2)

        // Test 2: Generate multiple reference numbers (should be unique)
        console.log("\nTest 2: Generating multiple reference numbers...")
        const refNumber2 =
            userManagementService.generateReferenceNumber(walletAddress)
        console.log("✓ Second reference number generated:", refNumber2)
        console.log(
            "  - Reference numbers are different:",
            refNumber !== refNumber2
        )

        // Test 3: Generate reference number with invalid input
        console.log(
            "\nTest 3: Testing invalid wallet address (empty string)..."
        )
        try {
            userManagementService.generateReferenceNumber("")
            console.log("✗ Should have rejected empty wallet address")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected empty wallet address")
        }

        // Test 4: Generate reference number with null input
        console.log("\nTest 4: Testing invalid wallet address (null)...")
        try {
            userManagementService.generateReferenceNumber(null)
            console.log("✗ Should have rejected null wallet address")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected null wallet address")
        }

        // Test 5: Create test organization
        console.log("\nTest 5: Creating test organization...")
        const testOrg = new Organization({
            org_id: 1001,
            wallet_address: walletAddress,
        })
        await testOrg.save()
        console.log("✓ Test organization created")
        console.log("  - org_id:", testOrg.org_id)
        console.log("  - wallet_address:", testOrg.wallet_address)

        // Test 6: Get organization by reference number
        console.log("\nTest 6: Getting organization by reference number...")
        const result =
            await userManagementService.getOrganizationByReferenceNumber(
                refNumber
            )

        if (!result.success) {
            console.log("✗ Failed to get organization:", result.error)
            process.exit(1)
        }

        console.log("✓ Organization retrieved successfully")
        console.log("  - org_id:", result.organization.org_id)
        console.log("  - wallet_address:", result.organization.wallet_address)
        console.log(
            "  - Match:",
            result.organization.wallet_address === walletAddress
        )

        // Test 7: Get organization with non-existent wallet address
        console.log("\nTest 7: Testing with non-existent wallet address...")
        const nonExistentRef =
            "0xnonexistent1234567890123456789012345678_550e8400-e29b-41d4-a716-446655440000"
        const result2 =
            await userManagementService.getOrganizationByReferenceNumber(
                nonExistentRef
            )

        if (result2.success) {
            console.log("✗ Should not have found organization")
            process.exit(1)
        }

        console.log("✓ Correctly returned not found error")
        console.log("  - Error type:", result2.error.type)

        // Test 8: Get organization with invalid reference number format
        console.log("\nTest 8: Testing with invalid reference number format...")
        const invalidRef = "invalid_format_without_proper_structure"
        const result3 =
            await userManagementService.getOrganizationByReferenceNumber(
                invalidRef
            )

        if (result3.success) {
            console.log("✗ Should have rejected invalid format")
            process.exit(1)
        }

        console.log("✓ Correctly rejected invalid format")
        console.log("  - Error type:", result3.error.type)

        // Test 9: Get organization with empty reference number
        console.log("\nTest 9: Testing with empty reference number...")
        const result4 =
            await userManagementService.getOrganizationByReferenceNumber("")

        if (result4.success) {
            console.log("✗ Should have rejected empty reference number")
            process.exit(1)
        }

        console.log("✓ Correctly rejected empty reference number")
        console.log("  - Error type:", result4.error.type)

        // Test 10: Get organization with reference number without underscore
        console.log(
            "\nTest 10: Testing with reference number without underscore..."
        )
        const noUnderscoreRef = "0x1234567890123456789012345678901234567890"
        const result5 =
            await userManagementService.getOrganizationByReferenceNumber(
                noUnderscoreRef
            )

        if (result5.success) {
            console.log(
                "✗ Should have rejected reference number without underscore"
            )
            process.exit(1)
        }

        console.log("✓ Correctly rejected reference number without underscore")
        console.log("  - Error type:", result5.error.type)

        // Test 11: Generate user secret
        console.log("\nTest 11: Generating user secret...")
        const testEmail = "test@example.com"
        const secretResult = await userManagementService.generateUserSecret(
            testEmail,
            walletAddress
        )

        if (!secretResult.success) {
            console.log("✗ Failed to generate user secret:", secretResult.error)
            process.exit(1)
        }

        console.log("✓ User secret generated successfully")
        console.log("  - Secret type:", typeof secretResult.secret)
        console.log(
            "  - Secret is BigInt:",
            typeof secretResult.secret === "bigint"
        )

        // Test 12: Generate user secret with invalid email
        console.log("\nTest 12: Testing user secret with invalid email...")
        const invalidSecretResult =
            await userManagementService.generateUserSecret("", walletAddress)

        if (invalidSecretResult.success) {
            console.log("✗ Should have rejected invalid email")
            process.exit(1)
        }

        console.log("✓ Correctly rejected invalid email")
        console.log("  - Error type:", invalidSecretResult.error.type)

        // Test 13: Generate user secret with non-existent organization
        console.log(
            "\nTest 13: Testing user secret with non-existent organization..."
        )
        const nonExistentOrgResult =
            await userManagementService.generateUserSecret(
                testEmail,
                "0xnonexistent1234567890123456789012345678"
            )

        if (nonExistentOrgResult.success) {
            console.log("✗ Should have rejected non-existent organization")
            process.exit(1)
        }

        console.log("✓ Correctly rejected non-existent organization")
        console.log("  - Error type:", nonExistentOrgResult.error.type)

        // Test 14: Assign user to batch
        console.log("\nTest 14: Assigning user to batch...")
        const batchResult = await userManagementService.assignToBatch(
            secretResult.secret,
            testOrg.org_id
        )

        if (!batchResult.success) {
            console.log("✗ Failed to assign to batch:", batchResult.error)
            process.exit(1)
        }

        console.log("✓ User assigned to batch successfully")
        console.log("  - Batch ID:", batchResult.batch._id)
        console.log("  - Equation length:", batchResult.batch.equation.length)
        console.log("  - Equation:", batchResult.batch.equation)

        // Test 15: Create user with batch
        console.log("\nTest 15: Creating user with batch assignment...")
        const userData = {
            email: "newuser@example.com",
            user_id: 2001,
            balance: 100,
            orgWalletAddress: walletAddress,
        }

        const createResult = await userManagementService.createUserWithBatch(
            userData
        )

        if (!createResult.success) {
            console.log(
                "✗ Failed to create user with batch:",
                createResult.error
            )
            process.exit(1)
        }

        console.log("✓ User created with batch successfully")
        console.log("  - User ID:", createResult.user.user_id)
        console.log("  - Batch ID:", createResult.user.batch_id)
        console.log("  - Balance:", createResult.user.balance)
        console.log("  - ZKP Key:", createResult.user.zkp_key)
        console.log(
            "  - Batch equation length:",
            createResult.batch.equation.length
        )

        // Test 16: Verify user has batch_id
        console.log("\nTest 16: Verifying user has batch_id...")
        const createdUser = await User.findOne({ user_id: 2001 })

        if (!createdUser || !createdUser.batch_id) {
            console.log("✗ User does not have batch_id")
            process.exit(1)
        }

        console.log("✓ User has batch_id")
        console.log("  - Batch ID:", createdUser.batch_id)

        // Test 17: Create another user in the same batch
        console.log(
            "\nTest 17: Creating another user (should use same batch)..."
        )
        const userData2 = {
            email: "anotheruser@example.com",
            user_id: 2002,
            balance: 200,
            orgWalletAddress: walletAddress,
        }

        const createResult2 = await userManagementService.createUserWithBatch(
            userData2
        )

        if (!createResult2.success) {
            console.log("✗ Failed to create second user:", createResult2.error)
            process.exit(1)
        }

        console.log("✓ Second user created successfully")
        console.log("  - User ID:", createResult2.user.user_id)
        console.log("  - Batch ID:", createResult2.user.batch_id)
        console.log(
            "  - Batch equation length:",
            createResult2.batch.equation.length
        )

        // Test 18: Create user with missing required fields
        console.log("\nTest 18: Testing user creation with missing fields...")
        const incompleteData = {
            email: "incomplete@example.com",
            user_id: 2003,
            // Missing balance and orgWalletAddress
        }

        const incompleteResult =
            await userManagementService.createUserWithBatch(incompleteData)

        if (incompleteResult.success) {
            console.log("✗ Should have rejected incomplete data")
            process.exit(1)
        }

        console.log("✓ Correctly rejected incomplete data")
        console.log("  - Error type:", incompleteResult.error.type)

        // Test 19: Create user with duplicate user_id
        console.log(
            "\nTest 19: Testing user creation with duplicate user_id..."
        )
        const duplicateData = {
            email: "duplicate@example.com",
            user_id: 2001, // Same as first user
            balance: 50,
            orgWalletAddress: walletAddress,
        }

        const duplicateResult = await userManagementService.createUserWithBatch(
            duplicateData
        )

        if (duplicateResult.success) {
            console.log("✗ Should have rejected duplicate user_id")
            process.exit(1)
        }

        console.log("✓ Correctly rejected duplicate user_id")
        console.log("  - Error type:", duplicateResult.error.type)

        // Clean up test data
        console.log("\nCleaning up test data...")
        await User.deleteMany({})
        await Batch.deleteMany({})
        await Organization.deleteMany({})
        console.log("✓ Test data cleaned up")

        // Disconnect from database
        console.log("\nDisconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnected\n")

        console.log("=================================")
        console.log("All service tests passed! ✓")
        console.log("=================================")
        process.exit(0)
    } catch (error) {
        console.error("\n✗ Test failed:", error.message)
        console.error("Stack:", error.stack)
        await disconnectDatabase()
        process.exit(1)
    }
}

testUserManagementService()
