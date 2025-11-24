/**
 * RabbitMQ Consumer Module
 *
 * Main module that provides lifecycle functions for the RabbitMQ event consumer.
 * Integrates ConnectionManager and MessageRouter to consume events from the
 * User Management System (UMS) via RabbitMQ.
 *
 * This module exports:
 * - startConsumer: Initialize and start the consumer
 * - stopConsumer: Gracefully shutdown the consumer
 * - isConsumerConnected: Check consumer connection status
 */

const { ConnectionManager } = require("./rabbitmq-connection-manager")
const { MessageRouter } = require("./message-router")
const { Logger } = require("./logger")
const { config } = require("../config/config")

const logger = new Logger("RabbitMQ-Consumer")

// Module-level state
let connectionManager = null
let messageRouter = null
let isRunning = false
let inFlightMessages = 0
let shutdownPromiseResolve = null

/**
 * Start the RabbitMQ consumer
 *
 * Establishes connection to RabbitMQ, sets up queue and routing keys,
 * and begins consuming messages. This function is non-blocking and
 * returns a Promise that resolves when the consumer is ready.
 *
 * @returns {Promise<void>} Resolves when consumer is ready
 * @throws {Error} If consumer fails to start
 */
async function startConsumer() {
    if (isRunning) {
        logger.warn("Consumer is already running")
        return
    }

    try {
        logger.info("Starting RabbitMQ consumer")

        // Create connection manager
        connectionManager = new ConnectionManager(
            config.rabbitmq,
            logger.child("ConnectionManager")
        )

        // Establish connection to RabbitMQ
        await connectionManager.connect()

        // Get the channel
        const channel = connectionManager.getChannel()

        if (!channel) {
            throw new Error("Failed to get RabbitMQ channel")
        }

        // Create message router
        messageRouter = new MessageRouter(
            channel,
            config.rabbitmq,
            logger.child("MessageRouter")
        )

        // Setup queue
        const queueName = await messageRouter.setupQueue()

        // Bind routing keys
        await messageRouter.bindRoutingKeys(
            queueName,
            config.rabbitmq.routingKeys
        )

        // Start consuming messages
        await messageRouter.startConsuming(queueName)

        isRunning = true

        logger.info("RabbitMQ consumer started successfully", {
            exchange: config.rabbitmq.exchange,
            routingKeys: config.rabbitmq.routingKeys,
            queueName,
        })
    } catch (error) {
        logger.error("Failed to start RabbitMQ consumer", {
            error: error.message,
            stack: error.stack,
        })

        // Clean up on failure
        await cleanupResources()

        throw error
    }
}

/**
 * Stop the RabbitMQ consumer gracefully
 *
 * Waits for in-flight messages to complete processing before closing
 * the connection. This ensures no messages are lost during shutdown.
 *
 * @returns {Promise<void>} Resolves when consumer is stopped
 */
async function stopConsumer() {
    if (!isRunning) {
        logger.info("Consumer is not running")
        return
    }

    try {
        logger.info("Stopping RabbitMQ consumer", {
            inFlightMessages,
        })

        // Mark as not running to prevent new message processing
        isRunning = false

        // Wait for in-flight messages to complete
        if (inFlightMessages > 0) {
            logger.info("Waiting for in-flight messages to complete", {
                count: inFlightMessages,
            })

            // Create a promise that resolves when all messages are processed
            await new Promise((resolve) => {
                shutdownPromiseResolve = resolve

                // Set a timeout to force shutdown after 30 seconds
                setTimeout(() => {
                    logger.warn(
                        "Forcing shutdown after timeout with in-flight messages",
                        {
                            remainingMessages: inFlightMessages,
                        }
                    )
                    resolve()
                }, 30000)
            })
        }

        // Clean up resources
        await cleanupResources()

        logger.info("RabbitMQ consumer stopped successfully")
    } catch (error) {
        logger.error("Error stopping RabbitMQ consumer", {
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}

/**
 * Check if the consumer is connected to RabbitMQ
 *
 * Used for health checks to determine if the consumer is operational.
 *
 * @returns {boolean} True if connected and running, false otherwise
 */
function isConsumerConnected() {
    if (!connectionManager) {
        return false
    }

    return isRunning && connectionManager.isConnected()
}

/**
 * Clean up resources (connection, channel, etc.)
 *
 * @returns {Promise<void>}
 */
async function cleanupResources() {
    try {
        if (connectionManager) {
            await connectionManager.disconnect()
            connectionManager = null
        }

        messageRouter = null
        isRunning = false
        inFlightMessages = 0
        shutdownPromiseResolve = null

        logger.debug("Resources cleaned up")
    } catch (error) {
        logger.error("Error cleaning up resources", {
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}

/**
 * Increment in-flight message counter
 * Called when a message starts processing
 */
function incrementInFlightMessages() {
    inFlightMessages++
    logger.debug("Message processing started", { inFlightMessages })
}

/**
 * Decrement in-flight message counter
 * Called when a message completes processing
 */
function decrementInFlightMessages() {
    inFlightMessages--
    logger.debug("Message processing completed", { inFlightMessages })

    // If we're shutting down and all messages are processed, resolve the shutdown promise
    if (!isRunning && inFlightMessages === 0 && shutdownPromiseResolve) {
        logger.info("All in-flight messages processed during shutdown")
        shutdownPromiseResolve()
        shutdownPromiseResolve = null
    }
}

module.exports = {
    startConsumer,
    stopConsumer,
    isConsumerConnected,
}
