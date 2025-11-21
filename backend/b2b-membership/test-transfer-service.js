/**
 * Test script for Transfer Service
 *
 * This script verifies the transfer service methods work correctly
 * including atomic operations and error handling
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const User = require("./models/user")
const Batch = require("./models/batch")
const transferService = require("./services/transfer-service")

async function testTransferService() {
    console.log("Testing Transfer Service...\n")

    try {
        // Connect to database
        console.log("Connecting to database...")
        await connectDatabase()
        console.log("✓ Connected\n")

        // Clean up any existing test data
        console.log("Cleaning up any existing test data...")
        await User.deleteMany({})
        await Batch.deleteMany({})
        console.log("✓ Cleaned up\n")

        // Create test batch
        console.log("Creating test batch...")
        const batch = new Batch({
            equation: ["123", "456", "789"],
        })
        await batch.save()
        console.log("✓ Test batch created\n")

        // Create test users
        console.log("Creating test users...")
        const user1 = new User({
            user_id: 2001,
            batch_id: batch._id,
            balance: 1000,
            zkp_key: "zkp_key_001",
        })
        await user1.save()
        console.log("✓ User 1 created (user_id: 2001, balance: 1000)")

        const user2 = new User({
            user_id: 2002,
            batch_id: batch._id,
            balance: 500,
            zkp_key: "zkp_key_002",
        })
        await user2.save()
        console.log("✓ User 2 created (user_id: 2002, balance: 500)")

        const user3 = new User({
            user_id: 2003,
            batch_id: batch._id,
            balance: 0,
            zkp_key: "zkp_key_003",
        })
        await user3.save()
        console.log("✓ User 3 created (user_id: 2003, balance: 0)\n")

        // Test 1: Valid transfer
        console.log("Test 1: Valid transfer (2001 -> 2002, amount: 100)...")
        const result1 = await transferService.transfer(2001, 2002, 100)

        if (!result1.success) {
            console.log("✗ Transfer failed:", result1.error)
            process.exit(1)
        }

        console.log("✓ Transfer completed successfully")
        console.log("  - From user:", result1.transaction.fromUserId)
        console.log("  - To user:", result1.transaction.toUserId)
        console.log("  - Amount:", result1.transaction.amount)
        console.log(
            "  - Sender balance:",
            result1.transaction.senderPreviousBalance,
            "->",
            result1.transaction.senderNewBalance
        )
        console.log(
            "  - Receiver balance:",
            result1.transaction.receiverPreviousBalance,
            "->",
            result1.transaction.receiverNewBalance
        )

        // Verify balances in database
        const updatedUser1 = await User.findOne({ user_id: 2001 })
        const updatedUser2 = await User.findOne({ user_id: 2002 })
        console.log("  - Verified sender balance:", updatedUser1.balance)
        console.log("  - Verified receiver balance:", updatedUser2.balance)

        if (updatedUser1.balance !== 900 || updatedUser2.balance !== 600) {
            console.log("✗ Balance verification failed")
            process.exit(1)
        }

        // Test 2: Transfer with insufficient balance
        console.log(
            "\nTest 2: Transfer with insufficient balance (2001 -> 2002, amount: 10000)..."
        )
        const result2 = await transferService.transfer(2001, 2002, 10000)

        if (result2.success) {
            console.log(
                "✗ Should have rejected transfer with insufficient balance"
            )
            process.exit(1)
        }

        console.log("✓ Correctly rejected transfer with insufficient balance")
        console.log("  - Error type:", result2.error.type)
        console.log("  - Error message:", result2.error.message)

        // Verify balances unchanged
        const unchangedUser1 = await User.findOne({ user_id: 2001 })
        const unchangedUser2 = await User.findOne({ user_id: 2002 })
        if (unchangedUser1.balance !== 900 || unchangedUser2.balance !== 600) {
            console.log("✗ Balances should not have changed")
            process.exit(1)
        }
        console.log("  - Balances unchanged (atomic rollback worked)")

        // Test 3: Transfer to non-existent user
        console.log(
            "\nTest 3: Transfer to non-existent user (2001 -> 9999, amount: 50)..."
        )
        const result3 = await transferService.transfer(2001, 9999, 50)

        if (result3.success) {
            console.log("✗ Should have rejected transfer to non-existent user")
            process.exit(1)
        }

        console.log("✓ Correctly rejected transfer to non-existent user")
        console.log("  - Error type:", result3.error.type)

        // Test 4: Transfer from non-existent user
        console.log(
            "\nTest 4: Transfer from non-existent user (9999 -> 2002, amount: 50)..."
        )
        const result4 = await transferService.transfer(9999, 2002, 50)

        if (result4.success) {
            console.log(
                "✗ Should have rejected transfer from non-existent user"
            )
            process.exit(1)
        }

        console.log("✓ Correctly rejected transfer from non-existent user")
        console.log("  - Error type:", result4.error.type)

        // Test 5: Transfer with negative amount
        console.log(
            "\nTest 5: Transfer with negative amount (2001 -> 2002, amount: -50)..."
        )
        const result5 = await transferService.transfer(2001, 2002, -50)

        if (result5.success) {
            console.log("✗ Should have rejected transfer with negative amount")
            process.exit(1)
        }

        console.log("✓ Correctly rejected transfer with negative amount")
        console.log("  - Error type:", result5.error.type)

        // Test 6: Transfer with zero amount
        console.log(
            "\nTest 6: Transfer with zero amount (2001 -> 2002, amount: 0)..."
        )
        const result6 = await transferService.transfer(2001, 2002, 0)

        if (result6.success) {
            console.log("✗ Should have rejected transfer with zero amount")
            process.exit(1)
        }

        console.log("✓ Correctly rejected transfer with zero amount")
        console.log("  - Error type:", result6.error.type)

        // Test 7: Transfer to same user
        console.log(
            "\nTest 7: Transfer to same user (2001 -> 2001, amount: 50)..."
        )
        const result7 = await transferService.transfer(2001, 2001, 50)

        if (result7.success) {
            console.log("✗ Should have rejected transfer to same user")
            process.exit(1)
        }

        console.log("✓ Correctly rejected transfer to same user")
        console.log("  - Error type:", result7.error.type)

        // Test 8: Transfer with invalid user_id type (string)
        console.log("\nTest 8: Transfer with invalid user_id type (string)...")
        const result8 = await transferService.transfer("2001", 2002, 50)

        if (result8.success) {
            console.log(
                "✗ Should have rejected transfer with invalid user_id type"
            )
            process.exit(1)
        }

        console.log("✓ Correctly rejected transfer with invalid user_id type")
        console.log("  - Error type:", result8.error.type)

        // Test 9: Transfer entire balance
        console.log(
            "\nTest 9: Transfer entire balance (2001 -> 2003, amount: 900)..."
        )
        const result9 = await transferService.transfer(2001, 2003, 900)

        if (!result9.success) {
            console.log("✗ Transfer failed:", result9.error)
            process.exit(1)
        }

        console.log("✓ Transfer completed successfully")
        console.log(
            "  - Sender new balance:",
            result9.transaction.senderNewBalance
        )
        console.log(
            "  - Receiver new balance:",
            result9.transaction.receiverNewBalance
        )

        // Verify balances
        const finalUser1 = await User.findOne({ user_id: 2001 })
        const finalUser3 = await User.findOne({ user_id: 2003 })
        if (finalUser1.balance !== 0 || finalUser3.balance !== 900) {
            console.log("✗ Balance verification failed")
            process.exit(1)
        }
        console.log(
            "  - Verified: Sender balance is 0, receiver balance is 900"
        )

        // Test 10: Multiple sequential transfers
        console.log("\nTest 10: Multiple sequential transfers...")
        const transfer1 = await transferService.transfer(2002, 2001, 100)
        const transfer2 = await transferService.transfer(2003, 2002, 200)
        const transfer3 = await transferService.transfer(2001, 2003, 50)

        if (!transfer1.success || !transfer2.success || !transfer3.success) {
            console.log("✗ One or more transfers failed")
            process.exit(1)
        }

        console.log("✓ All sequential transfers completed")

        // Verify final balances
        const final1 = await User.findOne({ user_id: 2001 })
        const final2 = await User.findOne({ user_id: 2002 })
        const final3 = await User.findOne({ user_id: 2003 })

        console.log("  - User 2001 final balance:", final1.balance)
        console.log("  - User 2002 final balance:", final2.balance)
        console.log("  - User 2003 final balance:", final3.balance)

        // Verify total balance is conserved
        const totalBalance = final1.balance + final2.balance + final3.balance
        const expectedTotal = 1000 + 500 + 0 // Initial balances
        if (totalBalance !== expectedTotal) {
            console.log(
                "✗ Total balance not conserved:",
                totalBalance,
                "vs",
                expectedTotal
            )
            process.exit(1)
        }
        console.log("  - Total balance conserved:", totalBalance)

        // Clean up test data
        console.log("\nCleaning up test data...")
        await User.deleteMany({})
        await Batch.deleteMany({})
        console.log("✓ Test data cleaned up")

        // Disconnect from database
        console.log("\nDisconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnected\n")

        console.log("=================================")
        console.log("All transfer service tests passed! ✓")
        console.log("=================================")
        process.exit(0)
    } catch (error) {
        console.error("\n✗ Test failed:", error.message)
        console.error("Stack:", error.stack)
        await disconnectDatabase()
        process.exit(1)
    }
}

testTransferService()
