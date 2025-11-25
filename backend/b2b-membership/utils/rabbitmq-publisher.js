/**
 * RabbitMQ Publisher Module
 *
 * Provides functionality to publish events to RabbitMQ exchanges
 */

const { ConnectionManager } = require("./rabbitmq-connection-manager")
const { Logger } = require("./logger")
const { config } = require("../config/config")

const logger = new Logger("RabbitMQ-Publisher")

// Module-level state
let connectionManager = null
let publisherChannel = null

/**
 * Initialize the publisher connection
 * @returns {Promise<void>}
 */
async function initializePublisher() {
    if (publisherChannel) {
        logger.debug("Publisher already initialized")
        return
    }

    try {
        logger.info("Initializing RabbitMQ publisher")

        // Create connection manager
        connectionManager = new ConnectionManager(
            config.rabbitmq,
            logger.child("PublisherConnectionManager")
        )

        // Establish connection
        await connectionManager.connect()

        // Get channel
        publisherChannel = connectionManager.getChannel()

        if (!publisherChannel) {
            throw new Error("Failed to get RabbitMQ channel for publisher")
        }

        logger.info("RabbitMQ publisher initialized successfully")
    } catch (error) {
        logger.error("Failed to initialize RabbitMQ publisher", {
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}

/**
 * Publish a transaction receipt event to RabbitMQ
 *
 * @param {object} transactionData - Transaction data to publish
 * @param {string} transactionData.transactionHash - Transaction hash
 * @param {string} transactionData.signedBy - Wallet address that signed the transaction
 * @param {number} transactionData.chainId - Chain ID
 * @param {object} transactionData.context - Additional transaction context
 * @returns {Promise<boolean>} True if published successfully
 */
async function publishTransactionReceipt(transactionData) {
    try {
        // Ensure publisher is initialized
        if (!publisherChannel) {
            await initializePublisher()
        }

        const exchange =
            process.env.RABBITMQ_TRANSACTION_RECEIPT_EXCHANGE ||
            "exchange.transaction-receipt.fanout"
        const routingKey = "" // Fanout exchange doesn't use routing keys

        // Ensure exchange exists
        await publisherChannel.assertExchange(exchange, "fanout", {
            durable: true,
        })

        // Create event payload matching TransactionReceiptEventDto structure
        const event = {
            onChainData: {
                transactionHash: transactionData.transactionHash,
                signedBy: transactionData.signedBy,
                chainId: transactionData.chainId,
                context: transactionData.context,
            },
            timestamp: new Date().toISOString(),
        }

        // Convert to buffer
        const message = Buffer.from(JSON.stringify(event))

        // Publish to exchange
        const published = publisherChannel.publish(
            exchange,
            routingKey,
            message,
            {
                persistent: true,
                contentType: "application/json",
            }
        )

        if (published) {
            logger.info("Transaction receipt published to RabbitMQ", {
                exchange,
                transactionHash: transactionData.transactionHash,
                chainId: transactionData.chainId,
            })
        } else {
            logger.warn("Failed to publish transaction receipt - buffer full", {
                transactionHash: transactionData.transactionHash,
            })
        }

        return published
    } catch (error) {
        logger.error("Error publishing transaction receipt", {
            error: error.message,
            stack: error.stack,
            transactionHash: transactionData.transactionHash,
        })
        throw error
    }
}

/**
 * Close the publisher connection
 * @returns {Promise<void>}
 */
async function closePublisher() {
    try {
        if (connectionManager) {
            logger.info("Closing RabbitMQ publisher connection")
            await connectionManager.disconnect()
            connectionManager = null
            publisherChannel = null
            logger.info("RabbitMQ publisher connection closed")
        }
    } catch (error) {
        logger.error("Error closing RabbitMQ publisher", {
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}

/**
 * Check if publisher is connected
 * @returns {boolean}
 */
function isPublisherConnected() {
    return publisherChannel !== null && connectionManager?.isConnected()
}

module.exports = {
    initializePublisher,
    publishTransactionReceipt,
    closePublisher,
    isPublisherConnected,
}
