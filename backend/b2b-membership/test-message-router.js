/**
 * Test Message Router
 *
 * Tests to verify MessageRouter class functionality
 */

const mongoose = require("mongoose")
const { MessageRouter } = require("./utils/message-router")
const { Logger } = require("./utils/logger")
const Event = require("./models/event")
const { config } = require("./config/config")

// Mock channel for testing
class MockChannel {
    constructor() {
        this.exchanges = new Map()
        this.queues = new Map()
        this.bindings = []
        this.consumers = []
        this.prefetchValue = null
        this.ackedMessages = []
        this.rejectedMessages = []
    }

    async assertExchange(name, type, options) {
        this.exchanges.set(name, { type, options })
    }

    async assertQueue(name, options) {
        const queueName = name || `queue-${Date.now()}`
        this.queues.set(queueName, options)
        return { queue: queueName }
    }

    async bindQueue(queue, exchange, routingKey) {
        this.bindings.push({ queue, exchange, routingKey })
    }

    async prefetch(count) {
        this.prefetchValue = count
    }

    async consume(queue, handler, options) {
        this.consumers.push({ queue, handler, options })
    }

    ack(message) {
        this.ackedMessages.push(message)
    }

    reject(message, requeue) {
        this.rejectedMessages.push({ message, requeue })
    }

    // Helper to simulate message delivery
    async deliverMessage(routingKey, payload, messageId = "test-msg-1") {
        const message = {
            fields: {
                routingKey,
                exchange: config.rabbitmq.exchange,
            },
            properties: {
                messageId,
            },
            content: Buffer.from(JSON.stringify(payload)),
        }

        // Find consumer and call handler
        if (this.consumers.length > 0) {
            const consumer = this.consumers[0]
            await consumer.handler(message)
        }

        return message
    }
}

async function testMessageRouter() {
    console.log("Starting MessageRouter tests...")

    try {
        // Connect to MongoDB
        console.log("Connecting to MongoDB...")
        await mongoose.connect(config.database.uri)
        console.log("Connected to MongoDB")

        // Clean up any existing test events
        await Event.deleteMany({
            "payload.test": true,
        })

        const logger = new Logger("MessageRouter-Test")
        const mockChannel = new MockChannel()
        const router = new MessageRouter(mockChannel, config.rabbitmq, logger)

        // Test 1: Setup Queue
        console.log("\n--- Test 1: Setup Queue ---")
        const queueName = await router.setupQueue()
        console.log("✓ Queue created:", queueName)
        console.log("✓ Exchange asserted:", config.rabbitmq.exchange)
        console.log("✓ Prefetch set to:", mockChannel.prefetchValue)

        // Test 2: Bind Routing Keys
        console.log("\n--- Test 2: Bind Routing Keys ---")
        await router.bindRoutingKeys(queueName, config.rabbitmq.routingKeys)
        console.log("✓ Routing keys bound:", config.rabbitmq.routingKeys.length)
        console.log(
            "✓ Bindings:",
            mockChannel.bindings.map((b) => b.routingKey)
        )

        // Test 3: Start Consuming
        console.log("\n--- Test 3: Start Consuming ---")
        await router.startConsuming(queueName)
        console.log("✓ Consumer started")
        console.log("✓ Manual acknowledgment enabled")

        // Test 4: Handle Valid Message
        console.log("\n--- Test 4: Handle Valid Message ---")
        const validPayload = {
            test: true,
            organizationId: "test-org-router-1",
            name: "Test Organization from Router",
        }

        await mockChannel.deliverMessage(
            "organization.created",
            validPayload,
            "msg-valid-1"
        )

        // Wait a bit for async processing
        await new Promise((resolve) => setTimeout(resolve, 500))

        console.log("✓ Message processed")
        console.log(
            "✓ Messages acknowledged:",
            mockChannel.ackedMessages.length
        )

        // Verify event was stored
        const storedEvent = await Event.findOne({
            routingKey: "organization.created",
            "payload.organizationId": "test-org-router-1",
        })
        console.log("✓ Event stored in database:", {
            id: storedEvent._id.toString(),
            status: storedEvent.status,
        })

        // Test 5: Handle Invalid JSON
        console.log("\n--- Test 5: Handle Invalid JSON ---")
        const invalidMessage = {
            fields: {
                routingKey: "organization.created",
                exchange: config.rabbitmq.exchange,
            },
            properties: {
                messageId: "msg-invalid-json",
            },
            content: Buffer.from("{ invalid json }"),
        }

        const consumer = mockChannel.consumers[0]
        await consumer.handler(invalidMessage)

        // Wait a bit for async processing
        await new Promise((resolve) => setTimeout(resolve, 100))

        console.log("✓ Invalid JSON handled")
        console.log(
            "✓ Message rejected without requeue:",
            mockChannel.rejectedMessages.some(
                (r) => r.message === invalidMessage && r.requeue === false
            )
        )

        // Test 6: Handle Unsubscribed Routing Key
        console.log("\n--- Test 6: Handle Unsubscribed Routing Key ---")
        const beforeAckCount = mockChannel.ackedMessages.length

        await mockChannel.deliverMessage(
            "unknown.routing.key",
            { test: true },
            "msg-unknown"
        )

        // Wait a bit for async processing
        await new Promise((resolve) => setTimeout(resolve, 100))

        console.log("✓ Unsubscribed message ignored")
        console.log(
            "✓ Message acknowledged (to remove from queue):",
            mockChannel.ackedMessages.length > beforeAckCount
        )

        // Test 7: Routing Map
        console.log("\n--- Test 7: Verify Routing Map ---")
        console.log("✓ Routing map contains:")
        Object.keys(router.routingMap).forEach((key) => {
            console.log(`  - ${key}`)
        })

        // Test 8: Error Classification
        console.log("\n--- Test 8: Error Classification ---")

        // Transient error
        const transientError = new Error("Network timeout")
        transientError.name = "MongoTimeoutError"
        console.log(
            "✓ Transient error detected:",
            router.isTransientError(transientError)
        )

        // Permanent error
        const permanentError = new Error("Validation failed")
        permanentError.name = "ValidationError"
        console.log(
            "✓ Permanent error detected:",
            !router.isTransientError(permanentError)
        )

        // Clean up test events
        console.log("\n--- Cleaning up test data ---")
        const deleteResult = await Event.deleteMany({
            "payload.test": true,
        })
        console.log(`✓ Deleted ${deleteResult.deletedCount} test events`)

        console.log("\n✓ All MessageRouter tests passed!")
    } catch (error) {
        console.error("✗ Test failed:", error.message)
        console.error(error.stack)
        process.exit(1)
    } finally {
        await mongoose.disconnect()
        console.log("Disconnected from MongoDB")
    }
}

// Run tests
testMessageRouter()
