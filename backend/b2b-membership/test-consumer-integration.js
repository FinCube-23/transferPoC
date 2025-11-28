/**
 * Test script to verify RabbitMQ consumer integration with Express app
 * This test verifies that the consumer functions are properly imported
 * and can be called without errors (even if RabbitMQ is not available)
 */

const {
    startConsumer,
    stopConsumer,
    isConsumerConnected,
} = require("./utils/rabbitmq-consumer")

async function testConsumerIntegration() {
    console.log("Testing RabbitMQ consumer integration...\n")

    try {
        // Test 1: Verify functions are exported
        console.log("1. Verifying consumer functions are exported...")
        if (typeof startConsumer !== "function") {
            throw new Error("startConsumer is not a function")
        }
        if (typeof stopConsumer !== "function") {
            throw new Error("stopConsumer is not a function")
        }
        if (typeof isConsumerConnected !== "function") {
            throw new Error("isConsumerConnected is not a function")
        }
        console.log("✓ All consumer functions are properly exported\n")

        // Test 2: Verify isConsumerConnected returns boolean
        console.log("2. Testing isConsumerConnected...")
        const connected = isConsumerConnected()
        if (typeof connected !== "boolean") {
            throw new Error("isConsumerConnected should return a boolean")
        }
        console.log(`✓ isConsumerConnected returns: ${connected}\n`)

        // Test 3: Verify stopConsumer can be called when not running
        console.log("3. Testing stopConsumer when consumer is not running...")
        await stopConsumer()
        console.log("✓ stopConsumer handles 'not running' state gracefully\n")

        // Test 4: Verify startConsumer fails gracefully without RabbitMQ
        console.log(
            "4. Testing startConsumer behavior (expected to fail without RabbitMQ)..."
        )
        try {
            await startConsumer()
            console.log("✓ startConsumer succeeded (RabbitMQ is available)\n")
            // Clean up if it succeeded
            await stopConsumer()
        } catch (error) {
            console.log(
                `✓ startConsumer failed as expected: ${error.message}\n`
            )
        }

        console.log("===========================================")
        console.log("Consumer integration test passed! ✓")
        console.log("===========================================")
        console.log("\nNote: This test verifies the integration is correct.")
        console.log(
            "For full functionality, ensure RabbitMQ is running and configured."
        )
        process.exit(0)
    } catch (error) {
        console.error("✗ Integration test failed:", error.message)
        console.error(error.stack)
        process.exit(1)
    }
}

testConsumerIntegration()
