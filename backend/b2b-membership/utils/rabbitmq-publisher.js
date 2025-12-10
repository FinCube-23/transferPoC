/**
 * RabbitMQ Publisher Module
 *
 * Provides functionality to publish events to RabbitMQ exchanges
 */

const { ConnectionManager } = require("./rabbitmq-connection-manager")
const { Logger } = require("./logger")
const { config } = require("../config/config")
const { v4: uuidv4 } = require("uuid")

const logger = new Logger("RabbitMQ-Publisher")

// Module-level state
let connectionManager = null
let publisherChannel = null
let replyQueue = null
let pendingRequests = new Map() // Store pending RPC requests


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

        // Set up reply queue for RPC pattern (used for authentication)
        const replyQueueName = process.env.AUTH_REPLY_QUEUE || "auth.reply.queue"
        const queueResult = await publisherChannel.assertQueue(replyQueueName, {
            durable: false,
            exclusive: false,
            autoDelete: true,
        })
        replyQueue = queueResult.queue

        // Consume from reply queue
        await publisherChannel.consume(
            replyQueue,
            (msg) => {
                if (msg) {
                    const correlationId = msg.properties.correlationId
                    const pendingRequest = pendingRequests.get(correlationId)

                    if (pendingRequest) {
                        try {
                            const response = JSON.parse(msg.content.toString())
                            pendingRequest.resolve(response)
                        } catch (error) {
                            pendingRequest.reject(new Error("Failed to parse auth response"))
                        }
                        pendingRequests.delete(correlationId)
                    }

                    publisherChannel.ack(msg)
                }
            },
            { noAck: false }
        )

        logger.info("RabbitMQ publisher initialized successfully", {
            replyQueue,
        })
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
 * Send a message and wait for a reply (RPC pattern)
 * Used for authentication validation
 *
 * @param {string} pattern - Message pattern (e.g., "validate-authorization")
 * @param {object} data - Data to send
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<object>} Response from the service
 */
async function sendAndReceive(pattern, data, timeout = 5000) {
    try {
        // Ensure publisher is initialized
        if (!publisherChannel || !replyQueue) {
            await initializePublisher()
        }

        const correlationId = uuidv4()
        const message = Buffer.from(JSON.stringify(data))

        // Create promise that will be resolved when reply is received
        const responsePromise = new Promise((resolve, reject) => {
            // Set timeout
            const timeoutId = setTimeout(() => {
                pendingRequests.delete(correlationId)
                reject(new Error(`Request timeout after ${timeout}ms`))
            }, timeout)

            // Store request with timeout cleanup
            pendingRequests.set(correlationId, {
                resolve: (response) => {
                    clearTimeout(timeoutId)
                    resolve(response)
                },
                reject: (error) => {
                    clearTimeout(timeoutId)
                    reject(error)
                },
            })
        })

        // Map pattern to actual queue name
        // @mskits/validate-auth uses "validate-authorization" pattern but UMS expects "authorization" queue
        const queueName = pattern === "validate-authorization" 
            ? (process.env.AUTH_QUEUE_NAME || "authorization")
            : pattern;

        // Send message to the queue
        publisherChannel.sendToQueue(queueName, message, {
            correlationId,
            replyTo: replyQueue,
            contentType: "application/json",
        })

        logger.debug("RPC request sent", {
            pattern,
            correlationId,
        })

        return await responsePromise
    } catch (error) {
        logger.error("Error in RPC request", {
            error: error.message,
            pattern,
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
            
            // Clear pending requests
            pendingRequests.forEach((request, correlationId) => {
                request.reject(new Error("Publisher is shutting down"))
            })
            pendingRequests.clear()
            
            await connectionManager.disconnect()
            connectionManager = null
            publisherChannel = null
            replyQueue = null
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
    sendAndReceive,
    closePublisher,
    isPublisherConnected,
}
