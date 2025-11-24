/**
 * Test RabbitMQ Exchange Connectivity
 * Verifies that we can connect to the existing RabbitMQ instance
 * and access the exchange.ums.events exchange
 */

const { ConnectionManager } = require("./utils/rabbitmq-connection-manager")
const { Logger } = require("./utils/logger")
const { config } = require("./config/config")

async function testExchangeConnectivity() {
    const logger = new Logger("Exchange-Test")

    logger.info("Testing connection to existing RabbitMQ instance")

    const connectionManager = new ConnectionManager(config.rabbitmq, logger)

    try {
        // Connect to RabbitMQ
        await connectionManager.connect()
        logger.info("✓ Connected to existing RabbitMQ instance")

        const channel = connectionManager.getChannel()

        // Verify the exchange exists by asserting it
        // This will succeed if the exchange exists, or create it if it doesn't
        await channel.assertExchange(
            config.rabbitmq.exchange,
            config.rabbitmq.exchangeType,
            { durable: true }
        )

        logger.info("✓ Exchange verified/created", {
            exchange: config.rabbitmq.exchange,
            type: config.rabbitmq.exchangeType,
        })

        // Create a temporary queue to test binding
        const queueResult = await channel.assertQueue("", { exclusive: true })
        logger.info("✓ Temporary queue created", {
            queue: queueResult.queue,
        })

        // Test binding to routing keys
        for (const routingKey of config.rabbitmq.routingKeys) {
            await channel.bindQueue(
                queueResult.queue,
                config.rabbitmq.exchange,
                routingKey
            )
            logger.info("✓ Successfully bound to routing key", {
                routingKey,
                exchange: config.rabbitmq.exchange,
            })
        }

        logger.info("✓ All routing keys bound successfully")
        logger.info("✓ Ready to receive events from UMS!")

        // Clean up
        await connectionManager.disconnect()
        logger.info("✓ Test completed successfully")
    } catch (error) {
        logger.error("Test failed", {
            error: error.message,
            stack: error.stack,
        })
        process.exit(1)
    }
}

// Run test
testExchangeConnectivity().catch((error) => {
    console.error("Test execution failed:", error)
    process.exit(1)
})
