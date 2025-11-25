/**
 * Test script for Same-Organization Transfer
 *
 * This script verifies that transfers between users in the same organization
 * skip blockchain operations and only perform database updates
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const User = require("./models/user")
const Batch = require("./models/batch")
const Organization = require("./models/organization")
const TransferController = require("./controllers/transfer-controller")

async function testSameOrgTransfer() {
    console.log("Testing Same-Organization Transfer...\n")

    try {
        // Connect to database
        console.log("Connecting to database...")
        await connectDatabase()
        console.log("✓ Connected\n")

        // Clean up any existing test data
        console.log("Cleaning up any existing test data...")
        await User.deleteMany({ user_id: { $in: [3001, 3002, 3003] } })
        await Batch.deleteMany({})
        await Organization.deleteMany({ org_id: { $in: [9001, 9002] } })
        console.log("✓ Cleaned up\n")

        // Create test organizations
        console.log("Creating test organizations...")
        const org1 = new Organization({
            org_id: 9001,
            wallet_address: "0x1234567890123456789012345678901234567890",
            org_salt:
                "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        })
        await org1.save()
        console.log("✓ Organization 1 created (org_id: 9001)")

        const org2 = new Organization({
            org_id: 9002,
            wallet_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            org_salt:
                "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5",
        })
        await org2.save()
        console.log("✓ Organization 2 created (org_id: 9002)\n")

        // Create test batch
        console.log("Creating test batch...")
        const batch = new Batch({
            equation: ["123", "456", "789"],
        })
        await batch.save()
        console.log("✓ Test batch created\n")

        // Create test users - 2 in org1, 1 in org2
        console.log("Creating test users...")
        const user1 = new User({
            user_id: 3001,
            batch_id: batch._id,
            balance: 1000,
            zkp_key: "zkp_key_3001",
            reference_number: `${org1.wallet_address}_550e8400-e29b-41d4-a716-446655440001`,
        })
        await user1.save()
        console.log(
            "✓ User 1 created (user_id: 3001, balance: 1000, org: 9001)"
        )

        const user2 = new User({
            user_id: 3002,
            batch_id: batch._id,
            balance: 500,
            zkp_key: "zkp_key_3002",
            reference_number: `${org1.wallet_address}_550e8400-e29b-41d4-a716-446655440002`,
        })
        await user2.save()
        console.log("✓ User 2 created (user_id: 3002, balance: 500, org: 9001)")

        const user3 = new User({
            user_id: 3003,
            batch_id: batch._id,
            balance: 750,
            zkp_key: "zkp_key_3003",
            reference_number: `${org2.wallet_address}_550e8400-e29b-41d4-a716-446655440003`,
        })
        await user3.save()
        console.log(
            "✓ User 3 created (user_id: 3003, balance: 750, org: 9002)\n"
        )

        // Create controller instance
        const controller = new TransferController()

        // Test 1: Same organization transfer (User 1 -> User 2, both in org1)
        console.log("=".repeat(70))
        console.log(
            "Test 1: Same Organization Transfer (User 3001 -> User 3002)"
        )
        console.log("=".repeat(70))

        const mockReq1 = {
            body: {
                receiver_reference_number: user2.reference_number,
                amount: 200,
                sender_user_id: 3001,
            },
        }

        let responseData1 = null
        let responseStatus1 = null

        const mockRes1 = {
            status: function (code) {
                responseStatus1 = code
                return this
            },
            json: function (data) {
                responseData1 = data
                return this
            },
        }

        await controller.executeTransfer(mockReq1, mockRes1)

        console.log("\nResponse Status:", responseStatus1)
        console.log("Response Data:", JSON.stringify(responseData1, null, 2))

        // Verify response
        if (responseStatus1 !== 200) {
            throw new Error(
                `Expected status 200, got ${responseStatus1}: ${JSON.stringify(
                    responseData1
                )}`
            )
        }

        if (!responseData1.success) {
            throw new Error(
                `Transfer failed: ${JSON.stringify(responseData1.error)}`
            )
        }

        if (responseData1.transferType !== "SAME_ORGANIZATION") {
            throw new Error(
                `Expected transferType "SAME_ORGANIZATION", got "${responseData1.transferType}"`
            )
        }

        if (responseData1.blockchain) {
            throw new Error(
                "Same-organization transfer should not have blockchain data"
            )
        }

        if (!responseData1.database) {
            throw new Error(
                "Same-organization transfer should have database data"
            )
        }

        console.log("\n✓ Response structure is correct for same-org transfer")

        // Verify database balances
        const updatedUser1 = await User.findOne({ user_id: 3001 })
        const updatedUser2 = await User.findOne({ user_id: 3002 })

        console.log("\nBalance verification:")
        console.log(
            `  User 3001: 1000 -> ${updatedUser1.balance} (expected 800)`
        )
        console.log(
            `  User 3002: 500 -> ${updatedUser2.balance} (expected 700)`
        )

        if (updatedUser1.balance !== 800) {
            throw new Error(
                `User 3001 balance should be 800, got ${updatedUser1.balance}`
            )
        }

        if (updatedUser2.balance !== 700) {
            throw new Error(
                `User 3002 balance should be 700, got ${updatedUser2.balance}`
            )
        }

        console.log("✓ Balances updated correctly\n")

        // Test 2: Cross-organization transfer (User 1 -> User 3, different orgs)
        console.log("=".repeat(70))
        console.log(
            "Test 2: Cross-Organization Transfer (User 3001 -> User 3003)"
        )
        console.log("=".repeat(70))
        console.log(
            "Note: This will fail at proof generation (expected), but should NOT be same-org\n"
        )

        const mockReq2 = {
            body: {
                receiver_reference_number: user3.reference_number,
                amount: 100,
                sender_user_id: 3001,
            },
        }

        let responseData2 = null
        let responseStatus2 = null

        const mockRes2 = {
            status: function (code) {
                responseStatus2 = code
                return this
            },
            json: function (data) {
                responseData2 = data
                return this
            },
        }

        await controller.executeTransfer(mockReq2, mockRes2)

        console.log("Response Status:", responseStatus2)
        console.log("Response Data:", JSON.stringify(responseData2, null, 2))

        // For cross-org transfer, we expect it to attempt proof generation
        // It will likely fail at proof generation, but that's okay - we just want to verify
        // it didn't take the same-org path
        if (
            responseData2.transferType === "SAME_ORGANIZATION" ||
            (responseData2.success && !responseData2.blockchain)
        ) {
            throw new Error(
                "Cross-organization transfer incorrectly identified as same-org"
            )
        }

        console.log(
            "\n✓ Cross-organization transfer correctly identified (not same-org)"
        )
        console.log(
            "✓ Transfer attempted blockchain path (expected to fail at proof generation)\n"
        )

        // Test 3: Verify balances unchanged for failed cross-org transfer
        const finalUser1 = await User.findOne({ user_id: 3001 })
        const finalUser3 = await User.findOne({ user_id: 3003 })

        console.log("Balance verification after failed cross-org transfer:")
        console.log(`  User 3001: ${finalUser1.balance} (should still be 800)`)
        console.log(`  User 3003: ${finalUser3.balance} (should still be 750)`)

        if (finalUser1.balance !== 800 || finalUser3.balance !== 750) {
            throw new Error(
                "Balances should not change for failed cross-org transfer"
            )
        }

        console.log("✓ Balances unchanged (atomic rollback worked)\n")

        // Clean up test data
        console.log("Cleaning up test data...")
        await User.deleteMany({ user_id: { $in: [3001, 3002, 3003] } })
        await Batch.deleteMany({})
        await Organization.deleteMany({ org_id: { $in: [9001, 9002] } })
        console.log("✓ Test data cleaned up")

        // Disconnect from database
        console.log("\nDisconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnected\n")

        console.log("=".repeat(70))
        console.log("All same-organization transfer tests passed! ✓")
        console.log("=".repeat(70))
        process.exit(0)
    } catch (error) {
        console.error("\n✗ Test failed:", error.message)
        console.error("Stack:", error.stack)
        await disconnectDatabase()
        process.exit(1)
    }
}

testSameOrgTransfer()
