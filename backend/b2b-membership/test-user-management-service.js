/**
 * Test script for User Management Service
 *
 * This script verifies the user management service methods work correctly
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const Organization = require("./models/organization")
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

        // Clean up test data
        console.log("\nCleaning up test data...")
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
