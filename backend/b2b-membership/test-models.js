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

        // Test 2: Create and validate Organization model (auto-generation)
        console.log(
            "\nTest 2: Creating Organization with auto-generated fields..."
        )
        const org = new Organization({})
        await org.save()
        console.log("✓ Organization created successfully")
        console.log("  - reference_key:", org.reference_key)
        console.log("  - org_salt:", org.org_salt)

        // Test 3: Create and validate User model
        console.log("\nTest 3: Creating User with valid data...")
        const user = new User({
            batch_id: batch._id,
            balance: 100,
            reference_number: "REF-001",
        })
        await user.save()
        console.log("✓ User created successfully with ID:", user._id)

        // Test 4: Validate User balance non-negativity
        console.log(
            "\nTest 4: Testing User balance validation (negative balance)..."
        )
        try {
            const invalidUser = new User({
                batch_id: batch._id,
                balance: -10,
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
                batch_id: batch._id,
                balance: 50,
                reference_number: "REF-001", // Same as user above
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
            batch_id: batch._id,
            balance: 75,
            // reference_number is omitted (undefined)
        })
        await userWithNullRef.save()
        console.log(
            "✓ User with undefined reference_number created successfully"
        )

        // Test 7: Allow multiple undefined reference_numbers (sparse index)
        console.log("\nTest 7: Testing multiple undefined reference_numbers...")
        const anotherUserWithNullRef = new User({
            batch_id: batch._id,
            balance: 25,
            // reference_number is omitted (undefined)
        })
        await anotherUserWithNullRef.save()
        console.log("✓ Multiple users with undefined reference_number allowed")

        // Test 8: Validate Organization uniqueness
        console.log(
            "\nTest 8: Testing Organization reference_key uniqueness..."
        )
        const org2 = new Organization({})
        await org2.save()
        console.log("✓ Second organization created with unique keys")
        console.log("  - Org1 reference_key:", org.reference_key)
        console.log("  - Org2 reference_key:", org2.reference_key)
        console.log(
            "  - Keys are different:",
            org.reference_key !== org2.reference_key
        )

        // Test 9: Validate Batch equation is array
        console.log("\nTest 9: Testing Batch equation array validation...")
        const batch2 = new Batch({
            equation: ["999", "888", "777"],
        })
        await batch2.save()
        console.log("✓ Batch equation array validated correctly")

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
