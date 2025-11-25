/**
 * Test RabbitMQ Publisher
 *
 * Tests the transaction receipt publishing functionality
 */

require("dotenv").config()

const {
    initializePublisher,
    publishTransactionReceipt,
    closePublisher,
    isPublisherConnected,
} = require("./utils/rabbitmq-publisher")

async function testPublisher() {
    console.log("=".repeat(60))
    console.log("Testing RabbitMQ Publisher")
    console.log("=".repeat(60))
    console.log(
        `Exchange: ${process.env.RABBITMQ_TRANSACTION_RECEIPT_EXCHANGE || "exchange.transaction-receipt.fanout"}`
    )
    console.log("=".repeat(60))

    try {
        // Test 1: Initialize publisher
        console.log("\n1. Initializing publisher...")
        await initializePublisher()
        console.log("✅ Publisher initialized")

        // Test 2: Check connection status
        console.log("\n2. Checking connection status...")
        const connected = isPublisherConnected()
        console.log(`Connection status: ${connected ? "✅ Connected" : "❌ Disconnected"}`)

        if (!connected) {
            throw new Error("Publisher not connected")
        }

        // Test 3: Publish a test transaction receipt
        console.log("\n3. Publishing test transaction receipt...")
        const testTransaction = {
            transactionHash:
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            signedBy: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            chainId: "44787", // Celo Alfajores testnet
            context: {
                fromUserId: 2001,
                toUserId: 2002,
                amount: 50,
                senderWalletAddress: "0x1111111111111111111111111111111111111111",
                receiverWalletAddress:
                    "0x2222222222222222222222222222222222222222",
                blockNumber: 12345678,
                gasUsed: "150000",
                memo: '{"test":"transaction"}',
                nullifier:
                    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
        }

        const published = await publishTransactionReceipt(testTransaction)

        if (published) {
            console.log("✅ Transaction receipt published successfully")
            console.log("\nPublished data:")
            console.log(JSON.stringify(testTransaction, null, 2))
        } else {
            console.log("⚠️  Transaction receipt not published (buffer full)")
        }

        // Test 4: Publish multiple receipts
        console.log("\n4. Publishing multiple transaction receipts...")
        for (let i = 0; i < 3; i++) {
            const multiTestTx = {
                transactionHash: `0x${i.toString().padStart(64, "0")}`,
                signedBy: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                chainId: "44787",
                context: {
                    fromUserId: 2001 + i,
                    toUserId: 2002 + i,
                    amount: 10 * (i + 1),
                    senderWalletAddress: `0x${(i + 1).toString().padStart(40, "1")}`,
                    receiverWalletAddress: `0x${(i + 2).toString().padStart(40, "2")}`,
                    blockNumber: 12345678 + i,
                    gasUsed: "150000",
                },
            }

            await publishTransactionReceipt(multiTestTx)
            console.log(`  ✅ Published transaction ${i + 1}/3`)
        }

        console.log("\n✅ All tests passed!")
    } catch (error) {
        console.error("\n❌ Test failed:", error.message)
        console.error("Stack:", error.stack)
        process.exit(1)
    } finally {
        // Clean up
        console.log("\n5. Closing publisher connection...")
        await closePublisher()
        console.log("✅ Publisher connection closed")

        console.log("\n" + "=".repeat(60))
        console.log("Test complete")
        console.log("=".repeat(60))
    }
}

// Run tests
testPublisher().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
})
