/**
 * Test script for MongoDB models
 *
 * This script verifies that all models work correctly with validation
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const User = require("./models/user")
const Batch = require("./models/batch")
const Organization = require("./models/organization")

async function testModels() {
    console.log("Testing MongoDB models...\n")

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

        // Test 1: Create and validate Batch model
        console.log("Test 1: Creating Batch with equation array...")
        const batch = new Batch({
            equation: ["123456789", "987654321", "111222333"],
        })
        await batch.save()
        console.log("✓ Batch created successfully with ID:", batch._id)

        // Test 2: Create and validate Organization model
        console.log("\nTest 2: Creating Organization with required fields...")
        const org = new Organization({
            org_id: 1001,
            wallet_address: "0x1234567890123456789012345678901234567890",
        })
        await org.save()
        console.log("✓ Organization created successfully")
        console.log("  - org_id:", org.org_id)
        console.log("  - wallet_address:", org.wallet_address)
        console.log("  - org_salt:", org.org_salt)

        // Test 3: Create and validate User model
        console.log("\nTest 3: Creating User with valid data...")
        const user = new User({
            user_id: 2001,
            batch_id: batch._id,
            balance: 100,
            reference_number: "REF-001",
            zkp_key: "zkp_key_001",
        })
        await user.save()
        console.log("✓ User created successfully with ID:", user._id)

        // Test 4: Validate User balance non-negativity
        console.log(
            "\nTest 4: Testing User balance validation (negative balance)..."
        )
        try {
            const invalidUser = new User({
                user_id: 2002,
                batch_id: batch._id,
                balance: -10,
                zkp_key: "zkp_key_002",
            })
            await invalidUser.save()
            console.log("✗ Should have rejected negative balance")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected negative balance")
        }

        // Test 5: Validate reference_number uniqueness
        console.log("\nTest 5: Testing reference_number uniqueness...")
        try {
            const duplicateUser = new User({
                user_id: 2003,
                batch_id: batch._id,
                balance: 50,
                reference_number: "REF-001", // Same as user above
                zkp_key: "zkp_key_003",
            })
            await duplicateUser.save()
            console.log("✗ Should have rejected duplicate reference_number")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected duplicate reference_number")
        }

        // Test 6: Allow undefined reference_number
        console.log(
            "\nTest 6: Testing undefined reference_number (should be allowed)..."
        )
        const userWithNullRef = new User({
            user_id: 2004,
            batch_id: batch._id,
            balance: 75,
            zkp_key: "zkp_key_004",
            // reference_number is omitted (undefined)
        })
        await userWithNullRef.save()
        console.log(
            "✓ User with undefined reference_number created successfully"
        )

        // Test 7: Allow multiple undefined reference_numbers (sparse index)
        console.log("\nTest 7: Testing multiple undefined reference_numbers...")
        const anotherUserWithNullRef = new User({
            user_id: 2005,
            batch_id: batch._id,
            balance: 25,
            zkp_key: "zkp_key_005",
            // reference_number is omitted (undefined)
        })
        await anotherUserWithNullRef.save()
        console.log("✓ Multiple users with undefined reference_number allowed")

        // Test 8: Validate Organization uniqueness
        console.log(
            "\nTest 8: Testing Organization wallet_address and org_id uniqueness..."
        )
        const org2 = new Organization({
            org_id: 1002,
            wallet_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        })
        await org2.save()
        console.log("✓ Second organization created with unique keys")
        console.log("  - Org1 org_id:", org.org_id)
        console.log("  - Org1 wallet_address:", org.wallet_address)
        console.log("  - Org2 org_id:", org2.org_id)
        console.log("  - Org2 wallet_address:", org2.wallet_address)
        console.log("  - IDs are different:", org.org_id !== org2.org_id)
        console.log(
            "  - Wallet addresses are different:",
            org.wallet_address !== org2.wallet_address
        )

        // Test 9: Validate Batch equation is array
        console.log("\nTest 9: Testing Batch equation array validation...")
        const batch2 = new Batch({
            equation: ["999", "888", "777"],
        })
        await batch2.save()
        console.log("✓ Batch equation array validated correctly")

        // Test 10: Validate user_id uniqueness
        console.log("\nTest 10: Testing user_id uniqueness...")
        try {
            const duplicateUserId = new User({
                user_id: 2001, // Same as user above
                batch_id: batch._id,
                balance: 50,
                zkp_key: "zkp_key_unique_10",
            })
            await duplicateUserId.save()
            console.log("✗ Should have rejected duplicate user_id")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected duplicate user_id")
        }

        // Test 11: Validate zkp_key uniqueness
        console.log("\nTest 11: Testing zkp_key uniqueness...")
        try {
            const duplicateZkpKey = new User({
                user_id: 2006,
                batch_id: batch._id,
                balance: 50,
                zkp_key: "zkp_key_001", // Same as user above
            })
            await duplicateZkpKey.save()
            console.log("✗ Should have rejected duplicate zkp_key")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected duplicate zkp_key")
        }

        // Test 12: Validate org_id uniqueness
        console.log("\nTest 12: Testing org_id uniqueness...")
        try {
            const duplicateOrgId = new Organization({
                org_id: 1001, // Same as org above
                wallet_address: "0xdifferentaddress1234567890123456789012",
            })
            await duplicateOrgId.save()
            console.log("✗ Should have rejected duplicate org_id")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected duplicate org_id")
        }

        // Test 13: Validate wallet_address uniqueness
        console.log("\nTest 13: Testing wallet_address uniqueness...")
        try {
            const duplicateWallet = new Organization({
                org_id: 1003,
                wallet_address: "0x1234567890123456789012345678901234567890", // Same as org above
            })
            await duplicateWallet.save()
            console.log("✗ Should have rejected duplicate wallet_address")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected duplicate wallet_address")
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
        console.log("✓ Disconnected\n")

        console.log("=================================")
        console.log("All model tests passed! ✓")
        console.log("=================================")
        process.exit(0)
    } catch (error) {
        console.error("\n✗ Test failed:", error.message)
        console.error("Stack:", error.stack)
        await disconnectDatabase()
        process.exit(1)
    }
}

testModels()
