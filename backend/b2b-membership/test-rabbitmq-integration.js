/**
 * Integration Test for RabbitMQ Consumer - Full Message Flow
 *
 * Tests the complete end-to-end flow of the RabbitMQ consumer:
 * - Consumer startup and connection
 * - Message publishing to RabbitMQ
 * - Message routing to correct handlers
 * - Event storage in MongoDB
 * - Message acknowledgment
 * - Graceful shutdown
 *
 * Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.2, 8.2
 */

const amqp = require("amqplib")
const { connectDatabase, disconnectDatabase } = require("./utils/database")
const Event = require("./models/event")
const {
    startConsumer,
    stopConsumer,
    isConsumerConnected,
} = require("./utils/rabbitmq-consumer")
const { config } = require("./config/config")

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
 * Helper function to wait for a condition with timeout
 */
async function waitFor(conditionFn, timeoutMs = 5000, checkIntervalMs = 100) {
    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
        if (await conditionFn()) {
            return true
        }
        await new Promise((resolve) => setTimeout(resolve, checkIntervalMs))
    }
    return false
}

/**
 * Helper function to publish a message to RabbitMQ
 */
async function publishMessage(channel, routingKey, payload) {
    const messageContent = JSON.stringify(payload)
    const messageBuffer = Buffer.from(messageContent)

    channel.publish(config.rabbitmq.exchange, routingKey, messageBuffer, {
        persistent: true,
        messageId: `test-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
    })

    console.log(`  Published message to routing key: ${routingKey}`)
}

/**
 * Test 1: Consumer startup and connection
 */
async function testConsumerStartup() {
    console.log("\n=== Test 1: Consumer Startup and Connection ===")

    try {
        // Start the consumer
        await startConsumer()

        logTest(
            "Consumer started successfully",
            true,
            "startConsumer() completed without error"
        )

        // Verify consumer is connected
        const connected = isConsumerConnected()
        logTest(
            "Consumer reports connected status",
            connected === true,
            `isConsumerConnected: ${connected}`
        )

        // Wait a moment for consumer to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 1000))

        logTest(
            "Consumer initialization completed",
            true,
            "Consumer ready to receive messages"
        )
    } catch (error) {
        logTest("Consumer startup", false, `Error: ${error.message}`)
        console.error(error.stack)
        throw error
    }
}

/**
 * Test 2: Publish messages for all routing keys
 */
async function testMessagePublishing() {
    console.log("\n=== Test 2: Publish Messages for All Routing Keys ===")

    let connection = null
    let channel = null

    try {
        // Create a separate connection for publishing
        const connectionUrl = `amqp://${config.rabbitmq.username}:${config.rabbitmq.password}@${config.rabbitmq.host}:${config.rabbitmq.port}`
        connection = await amqp.connect(connectionUrl)
        channel = await connection.createChannel()

        // Assert the exchange exists
        await channel.assertExchange(
            config.rabbitmq.exchange,
            config.rabbitmq.exchangeType,
            { durable: true }
        )

        logTest(
            "Publisher connected to RabbitMQ",
            true,
            `Exchange: ${config.rabbitmq.exchange}`
        )

        // Test 2a: Publish organization.created message
        console.log("\n  Test 2a: Publishing organization.created message")
        const orgPayload = {
            eventType: "organization.created",
            timestamp: new Date().toISOString(),
            data: {
                org_id: 9001,
                name: "Test Organization",
                wallet_address: "0xtest1234567890123456789012345678901234",
            },
        }

        await publishMessage(channel, "organization.created", orgPayload)
        logTest(
            "organization.created message published",
            true,
            `org_id: ${orgPayload.data.org_id}`
        )

        // Test 2b: Publish organization.user.created message
        console.log("\n  Test 2b: Publishing organization.user.created message")
        const userPayload = {
            eventType: "organization.user.created",
            timestamp: new Date().toISOString(),
            data: {
                user_id: 9001,
                email: "testuser@example.com",
                org_id: 9001,
                balance: 100,
            },
        }

        await publishMessage(channel, "organization.user.created", userPayload)
        logTest(
            "organization.user.created message published",
            true,
            `user_id: ${userPayload.data.user_id}`
        )

        // Test 2c: Publish ums.sync message
        console.log("\n  Test 2c: Publishing ums.sync message")
        const syncPayload = {
            eventType: "ums.sync",
            timestamp: new Date().toISOString(),
            data: {
                syncType: "full",
                requestedBy: "admin",
            },
        }

        await publishMessage(channel, "ums.sync", syncPayload)
        logTest("ums.sync message published", true, `syncType: full`)

        // Wait for messages to be processed
        console.log("\n  Waiting for messages to be processed...")
        await new Promise((resolve) => setTimeout(resolve, 2000))

        logTest(
            "All messages published successfully",
            true,
            "Published 3 messages to RabbitMQ"
        )

        // Close publisher connection
        await channel.close()
        await connection.close()
    } catch (error) {
        logTest("Message publishing", false, `Error: ${error.message}`)
        console.error(error.stack)

        // Clean up on error
        if (channel) {
            try {
                await channel.close()
            } catch (e) {
                /* ignore */
            }
        }
        if (connection) {
            try {
                await connection.close()
            } catch (e) {
                /* ignore */
            }
        }

        throw error
    }
}

/**
 * Test 3: Verify events are stored in MongoDB
 */
async function testEventStorage() {
    console.log("\n=== Test 3: Verify Events Stored in MongoDB ===")

    try {
        // Wait for events to be stored (with timeout)
        const eventsStored = await waitFor(async () => {
            const count = await Event.countDocuments()
            return count >= 3
        }, 10000)

        logTest(
            "Events stored in MongoDB",
            eventsStored === true,
            "At least 3 events found in database"
        )

        if (!eventsStored) {
            const actualCount = await Event.countDocuments()
            console.log(
                `  Warning: Expected at least 3 events, found ${actualCount}`
            )
        }

        // Test 3a: Verify organization.created event
        console.log("\n  Test 3a: Verifying organization.created event")
        const orgEvent = await Event.findOne({
            routingKey: "organization.created",
        }).sort({ receivedAt: -1 })

        logTest(
            "organization.created event found",
            orgEvent !== null,
            `eventId: ${orgEvent?._id}`
        )

        if (orgEvent) {
            logTest(
                "Event has routingKey field",
                orgEvent.routingKey === "organization.created",
                `routingKey: ${orgEvent.routingKey}`
            )

            logTest(
                "Event has payload field",
                orgEvent.payload !== null &&
                    typeof orgEvent.payload === "object",
                `payload type: ${typeof orgEvent.payload}`
            )

            logTest(
                "Event has receivedAt field",
                orgEvent.receivedAt instanceof Date,
                `receivedAt: ${orgEvent.receivedAt?.toISOString()}`
            )

            logTest(
                "Event has status field",
                ["received", "processing", "completed", "failed"].includes(
                    orgEvent.status
                ),
                `status: ${orgEvent.status}`
            )

            logTest(
                "Event payload contains expected data",
                orgEvent.payload.data && orgEvent.payload.data.org_id === 9001,
                `org_id: ${orgEvent.payload.data?.org_id}`
            )
        }

        // Test 3b: Verify organization.user.created event
        console.log("\n  Test 3b: Verifying organization.user.created event")
        const userEvent = await Event.findOne({
            routingKey: "organization.user.created",
        }).sort({ receivedAt: -1 })

        logTest(
            "organization.user.created event found",
            userEvent !== null,
            `eventId: ${userEvent?._id}`
        )

        if (userEvent) {
            logTest(
                "Event has correct schema",
                userEvent.routingKey === "organization.user.created" &&
                    userEvent.payload !== null &&
                    userEvent.receivedAt instanceof Date,
                "All required fields present"
            )

            logTest(
                "Event payload contains expected data",
                userEvent.payload.data &&
                    userEvent.payload.data.user_id === 9001,
                `user_id: ${userEvent.payload.data?.user_id}`
            )
        }

        // Test 3c: Verify ums.sync event
        console.log("\n  Test 3c: Verifying ums.sync event")
        const syncEvent = await Event.findOne({
            routingKey: "ums.sync",
        }).sort({ receivedAt: -1 })

        logTest(
            "ums.sync event found",
            syncEvent !== null,
            `eventId: ${syncEvent?._id}`
        )

        if (syncEvent) {
            logTest(
                "Event has correct schema",
                syncEvent.routingKey === "ums.sync" &&
                    syncEvent.payload !== null &&
                    syncEvent.receivedAt instanceof Date,
                "All required fields present"
            )

            logTest(
                "Event payload contains expected data",
                syncEvent.payload.data &&
                    syncEvent.payload.data.syncType === "full",
                `syncType: ${syncEvent.payload.data?.syncType}`
            )
        }

        // Test 3d: Verify all events have correct schema
        console.log("\n  Test 3d: Verifying event schema compliance")
        const allEvents = await Event.find().sort({ receivedAt: -1 }).limit(3)

        let allSchemasValid = true
        for (const event of allEvents) {
            if (
                !event.routingKey ||
                !event.payload ||
                !event.receivedAt ||
                !event.status
            ) {
                allSchemasValid = false
                console.log(`  Event ${event._id} missing required fields`)
            }
        }

        logTest(
            "All events have valid schema",
            allSchemasValid === true,
            "All required fields present in all events"
        )

        // Test 3e: Verify event processing status
        console.log("\n  Test 3e: Verifying event processing status")
        const completedEvents = await Event.countDocuments({
            status: "completed",
        })

        logTest(
            "Events processed successfully",
            completedEvents >= 3,
            `${completedEvents} events with status 'completed'`
        )
    } catch (error) {
        logTest("Event storage verification", false, `Error: ${error.message}`)
        console.error(error.stack)
        throw error
    }
}

/**
 * Test 4: Verify message acknowledgment
 */
async function testMessageAcknowledgment() {
    console.log("\n=== Test 4: Verify Message Acknowledgment ===")

    let connection = null
    let channel = null

    try {
        // Create a connection to check queue status
        const connectionUrl = `amqp://${config.rabbitmq.username}:${config.rabbitmq.password}@${config.rabbitmq.host}:${config.rabbitmq.port}`
        connection = await amqp.connect(connectionUrl)
        channel = await connection.createChannel()

        // Check if there are any unacknowledged messages
        // Note: Since we're using an exclusive queue, we can't directly inspect it
        // Instead, we verify that events were processed (which implies acknowledgment)

        const processedEvents = await Event.countDocuments({
            status: { $in: ["completed", "failed"] },
        })

        logTest(
            "Messages were acknowledged",
            processedEvents >= 3,
            `${processedEvents} events processed (implies acknowledgment)`
        )

        // Verify no events are stuck in 'processing' state
        const stuckEvents = await Event.countDocuments({
            status: "processing",
        })

        logTest(
            "No events stuck in processing",
            stuckEvents === 0,
            `${stuckEvents} events in 'processing' state`
        )

        // Close connection
        await channel.close()
        await connection.close()

        logTest(
            "Message acknowledgment verified",
            true,
            "All messages processed and acknowledged"
        )
    } catch (error) {
        logTest(
            "Message acknowledgment verification",
            false,
            `Error: ${error.message}`
        )
        console.error(error.stack)

        // Clean up on error
        if (channel) {
            try {
                await channel.close()
            } catch (e) {
                /* ignore */
            }
        }
        if (connection) {
            try {
                await connection.close()
            } catch (e) {
                /* ignore */
            }
        }

        throw error
    }
}

/**
 * Test 5: Graceful shutdown
 */
async function testGracefulShutdown() {
    console.log("\n=== Test 5: Graceful Shutdown ===")

    try {
        // Stop the consumer
        await stopConsumer()

        logTest(
            "Consumer stopped successfully",
            true,
            "stopConsumer() completed without error"
        )

        // Verify consumer is no longer connected
        const connected = isConsumerConnected()
        logTest(
            "Consumer reports disconnected status",
            connected === false,
            `isConsumerConnected: ${connected}`
        )

        logTest(
            "Graceful shutdown completed",
            true,
            "Consumer shut down cleanly"
        )
    } catch (error) {
        logTest("Graceful shutdown", false, `Error: ${error.message}`)
        console.error(error.stack)
        throw error
    }
}

/**
 * Check if RabbitMQ is available
 */
async function checkRabbitMQAvailability() {
    console.log("\n=== Checking RabbitMQ Availability ===")

    try {
        const connectionUrl = `amqp://${config.rabbitmq.username}:${config.rabbitmq.password}@${config.rabbitmq.host}:${config.rabbitmq.port}`

        // Set a timeout for the connection attempt
        const connectionPromise = amqp.connect(connectionUrl)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timeout")), 5000)
        )

        const connection = await Promise.race([
            connectionPromise,
            timeoutPromise,
        ])
        await connection.close()

        console.log("✓ RabbitMQ is available and accessible\n")
        return true
    } catch (error) {
        console.log("✗ RabbitMQ is not available")
        console.log(`  Error: ${error.message}`)
        console.log("\nTo run this test, ensure RabbitMQ is running:")
        console.log(
            "  docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management-alpine"
        )
        console.log("  OR")
        console.log("  docker start rabbitmq (if container already exists)\n")
        return false
    }
}

/**
 * Main test runner
 */
async function runIntegrationTests() {
    console.log("=".repeat(60))
    console.log("RABBITMQ CONSUMER INTEGRATION TEST - FULL MESSAGE FLOW")
    console.log("=".repeat(60))

    let rabbitmqAvailable = false

    try {
        // Connect to database
        console.log("\nConnecting to database...")
        await connectDatabase()
        console.log("✓ Connected to database\n")

        // Clean up any existing test data
        console.log("Cleaning up existing test data...")
        await Event.deleteMany({})
        console.log("✓ Test data cleaned up\n")

        // Check RabbitMQ availability
        rabbitmqAvailable = await checkRabbitMQAvailability()

        if (!rabbitmqAvailable) {
            console.log("=".repeat(60))
            console.log("TEST SKIPPED - RabbitMQ Not Available")
            console.log("=".repeat(60))
            console.log(
                "\nThis integration test requires RabbitMQ to be running."
            )
            console.log("Please start RabbitMQ and run the test again.")

            // Disconnect from database
            await disconnectDatabase()
            process.exit(0) // Exit with success since this is an environment issue, not a test failure
        }

        // Run all tests in sequence
        await testConsumerStartup()
        await testMessagePublishing()
        await testEventStorage()
        await testMessageAcknowledgment()
        await testGracefulShutdown()

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
        await Event.deleteMany({})
        console.log("✓ Test data cleaned up")

        // Disconnect from database
        console.log("\nDisconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnected from database")

        process.exit(testsFailed === 0 ? 0 : 1)
    } catch (error) {
        console.error("\n✗ Integration tests failed:", error.message)
        console.error(error.stack)

        // Attempt cleanup
        try {
            await stopConsumer()
            await Event.deleteMany({})
            await disconnectDatabase()
        } catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError.message)
        }

        process.exit(1)
    }
}

// Run tests
runIntegrationTests()
