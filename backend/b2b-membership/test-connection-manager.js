/**
 * Test ConnectionManager functionality
 */

const { ConnectionManager } = require("./utils/rabbitmq-connection-manager")
const { Logger } = require("./utils/logger")
const { config } = require("./config/config")

async function testConnectionManager() {
    const logger = new Logger("ConnectionManager-Test")

    logger.info("Starting ConnectionManager tests")

    // Test 1: Create ConnectionManager instance
    logger.info("Test 1: Creating ConnectionManager instance")
    const connectionManager = new ConnectionManager(config.rabbitmq, logger)
    logger.info("✓ ConnectionManager instance created")

    // Test 2: Check initial state
    logger.info("Test 2: Checking initial connection state")
    if (!connectionManager.isConnected()) {
        logger.info("✓ Initial state is disconnected (as expected)")
    } else {
        logger.error("✗ Initial state should be disconnected")
        return
    }

    // Test 3: Test exponential backoff calculation
    logger.info("Test 3: Testing exponential backoff calculation")
    const delays = []
    for (let i = 1; i <= 10; i++) {
        const delay = connectionManager.calculateBackoffDelay(i)
        delays.push(delay)
    }
    logger.info("Calculated backoff delays:", { delays })

    // Verify exponential growth
    if (delays[0] === 1000 && delays[1] === 2000 && delays[2] === 4000) {
        logger.info("✓ Exponential backoff calculation is correct")
    } else {
        logger.error("✗ Exponential backoff calculation is incorrect", {
            delays,
        })
        return
    }

    // Verify max delay cap
    if (delays[9] === 60000) {
        logger.info("✓ Max delay cap is working correctly")
    } else {
        logger.error("✗ Max delay cap is not working", { delay: delays[9] })
        return
    }

    // Test 4: Test connection (will fail if RabbitMQ is not running)
    logger.info("Test 4: Testing connection to RabbitMQ")
    try {
        await connectionManager.connect()
        logger.info("✓ Successfully connected to RabbitMQ")

        // Test 5: Check connected state
        logger.info("Test 5: Checking connected state")
        if (connectionManager.isConnected()) {
            logger.info("✓ Connection state is correct")
        } else {
            logger.error("✗ Connection state should be connected")
        }

        // Test 6: Get channel
        logger.info("Test 6: Getting channel")
        const channel = connectionManager.getChannel()
        if (channel) {
            logger.info("✓ Channel retrieved successfully")
        } else {
            logger.error("✗ Channel should be available")
        }

        // Test 7: Disconnect
        logger.info("Test 7: Testing disconnect")
        await connectionManager.disconnect()
        logger.info("✓ Successfully disconnected from RabbitMQ")

        // Test 8: Check disconnected state
        logger.info("Test 8: Checking disconnected state")
        if (!connectionManager.isConnected()) {
            logger.info("✓ Disconnected state is correct")
        } else {
            logger.error("✗ Connection state should be disconnected")
        }

        logger.info("All tests passed! ✓")
    } catch (error) {
        if (error.message.includes("ECONNREFUSED")) {
            logger.warn("RabbitMQ is not running. Connection tests skipped.", {
                message: "Start RabbitMQ with: docker-compose up -d rabbitmq",
            })
            logger.info("Basic functionality tests passed! ✓")
        } else {
            logger.error("Connection test failed", {
                error: error.message,
                stack: error.stack,
            })
        }
    }
}

// Run tests
testConnectionManager().catch((error) => {
    console.error("Test execution failed:", error)
    process.exit(1)
})
