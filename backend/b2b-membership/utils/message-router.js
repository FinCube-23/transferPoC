/**
 * RabbitMQ Message Router
 *
 * Routes incoming messages from RabbitMQ to appropriate handler functions
 * based on routing keys. Handles JSON parsing, message acknowledgment,
 * and error handling.
 */

const { Logger } = require("./logger")
const {
    handleOrganizationCreated,
    handleOrganizationUserCreated,
    handleSyncAllData,
} = require("./event-handlers")

class MessageRouter {
    /**
     * Create a MessageRouter instance
     * @param {Channel} channel - RabbitMQ channel
     * @param {object} config - RabbitMQ configuration
     * @param {Logger} logger - Logger instance
     */
    constructor(channel, config, logger) {
        this.channel = channel
        this.config = config
        this.logger = logger || new Logger("MessageRouter")
        this.queueName = null

        // Routing map: maps routing keys to handler functions
        this.routingMap = {
            "organization.created": handleOrganizationCreated,
            "organization.user.created": handleOrganizationUserCreated,
            "ums.sync": handleSyncAllData,
        }
    }

    /**
     * Set up a queue for consuming messages
     * Creates an exclusive queue that will be deleted when the connection closes
     *
     * @returns {Promise<string>} The queue name
     */
    async setupQueue() {
        try {
            this.logger.info("Setting up queue")

            // Assert the exchange exists
            await this.channel.assertExchange(
                this.config.exchange,
                this.config.exchangeType,
                {
                    durable: true,
                }
            )

            // Create an exclusive queue (auto-delete when connection closes)
            const queueResult = await this.channel.assertQueue("", {
                exclusive: true,
            })

            this.queueName = queueResult.queue

            // Set prefetch count for manual acknowledgment
            await this.channel.prefetch(this.config.prefetchCount)

            this.logger.info("Queue setup completed", {
                queueName: this.queueName,
                exchange: this.config.exchange,
                exchangeType: this.config.exchangeType,
                prefetchCount: this.config.prefetchCount,
            })

            return this.queueName
        } catch (error) {
            this.logger.error("Failed to setup queue", {
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }

    /**
     * Bind routing keys to the queue
     *
     * @param {string} queueName - The queue name to bind to
     * @param {string[]} routingKeys - Array of routing keys to subscribe to
     * @returns {Promise<void>}
     */
    async bindRoutingKeys(queueName, routingKeys) {
        try {
            this.logger.info("Binding routing keys to queue", {
                queueName,
                routingKeys,
            })

            // Bind each routing key to the queue
            for (const routingKey of routingKeys) {
                await this.channel.bindQueue(
                    queueName,
                    this.config.exchange,
                    routingKey
                )

                this.logger.debug("Routing key bound", {
                    queueName,
                    routingKey,
                    exchange: this.config.exchange,
                })
            }

            this.logger.info("All routing keys bound successfully", {
                queueName,
                count: routingKeys.length,
            })
        } catch (error) {
            this.logger.error("Failed to bind routing keys", {
                queueName,
                routingKeys,
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }

    /**
     * Start consuming messages from the queue
     *
     * @param {string} queueName - The queue name to consume from
     * @returns {Promise<void>}
     */
    async startConsuming(queueName) {
        try {
            this.logger.info("Starting message consumption", { queueName })

            // Start consuming with manual acknowledgment
            await this.channel.consume(
                queueName,
                (message) => {
                    if (message) {
                        this.handleMessage(message).catch((error) => {
                            this.logger.error(
                                "Unhandled error in message handler",
                                {
                                    error: error.message,
                                    stack: error.stack,
                                }
                            )
                        })
                    }
                },
                {
                    noAck: false, // Manual acknowledgment mode
                }
            )

            this.logger.info("Message consumption started", { queueName })
        } catch (error) {
            this.logger.error("Failed to start consuming messages", {
                queueName,
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }

    /**
     * Handle an individual message
     * Parses JSON, routes to handler, and manages acknowledgment
     *
     * @param {object} message - RabbitMQ message object
     * @returns {Promise<void>}
     */
    async handleMessage(message) {
        const routingKey = message.fields.routingKey
        const messageId = message.properties.messageId || "unknown"

        // Log message receipt (Property 9: All received messages are logged)
        this.logger.info("Message received", {
            routingKey,
            messageId,
            exchange: message.fields.exchange,
        })

        try {
            // Check if routing key is subscribed (Property 3: Unsubscribed messages are ignored)
            if (!this.routingMap[routingKey]) {
                this.logger.warn(
                    "Message with unsubscribed routing key ignored",
                    {
                        routingKey,
                        messageId,
                    }
                )
                // Acknowledge the message to remove it from the queue
                this.channel.ack(message)
                return
            }

            // Parse JSON message body (Property 5: Valid JSON messages are parsed)
            let payload
            try {
                const messageContent = message.content.toString()
                payload = JSON.parse(messageContent)
            } catch (parseError) {
                // Property 8: Invalid JSON triggers error handling
                this.logger.error("Failed to parse message JSON", {
                    routingKey,
                    messageId,
                    error: parseError.message,
                    rawContent: message.content.toString(),
                })

                // Reject without requeue for permanent parsing errors
                this.channel.reject(message, false)
                return
            }

            // Route to appropriate handler (Property 2: Messages route to correct handlers)
            const handler = this.routingMap[routingKey]

            // Execute handler with timeout
            await this.executeHandlerWithTimeout(
                handler,
                routingKey,
                payload,
                this.config.handlerTimeout
            )

            // Property 4: Successful processing triggers acknowledgment
            this.channel.ack(message)
            this.logger.debug("Message acknowledged", {
                routingKey,
                messageId,
            })
        } catch (error) {
            // Property 12: Handler errors don't terminate consumer
            this.logger.error("Error processing message", {
                routingKey,
                messageId,
                error: error.message,
                stack: error.stack,
            })

            // Classify error and determine requeue strategy
            const shouldRequeue = this.isTransientError(error)

            if (shouldRequeue) {
                // Property 16: Transient errors trigger requeue
                this.logger.info(
                    "Rejecting message with requeue (transient error)",
                    {
                        routingKey,
                        messageId,
                        errorType: error.name,
                    }
                )
                this.channel.reject(message, true)
            } else {
                // Permanent error - reject without requeue
                this.logger.info(
                    "Rejecting message without requeue (permanent error)",
                    {
                        routingKey,
                        messageId,
                        errorType: error.name,
                    }
                )
                this.channel.reject(message, false)
            }
        }
    }

    /**
     * Execute handler function with timeout
     *
     * @param {Function} handler - Handler function to execute
     * @param {string} routingKey - Routing key for the message
     * @param {object} payload - Parsed message payload
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    async executeHandlerWithTimeout(handler, routingKey, payload, timeout) {
        return new Promise((resolve, reject) => {
            // Create timeout promise
            const timeoutPromise = new Promise((_, timeoutReject) => {
                setTimeout(() => {
                    const timeoutError = new Error(
                        `Handler timeout after ${timeout}ms`
                    )
                    timeoutError.name = "HandlerTimeoutError"
                    timeoutError.isTransient = true
                    timeoutReject(timeoutError)
                }, timeout)
            })

            // Race between handler execution and timeout
            Promise.race([handler(routingKey, payload), timeoutPromise])
                .then(resolve)
                .catch(reject)
        })
    }

    /**
     * Determine if an error is transient (should requeue) or permanent
     *
     * @param {Error} error - Error object
     * @returns {boolean} True if error is transient, false if permanent
     */
    isTransientError(error) {
        // Transient error indicators
        const transientErrorNames = [
            "MongoNetworkError",
            "MongoTimeoutError",
            "HandlerTimeoutError",
            "ECONNREFUSED",
            "ETIMEDOUT",
            "ENOTFOUND",
        ]

        const transientErrorMessages = [
            "network",
            "timeout",
            "connection",
            "ECONNRESET",
            "EPIPE",
        ]

        // Check if error is explicitly marked as transient
        if (error.isTransient === true) {
            return true
        }

        // Check error name
        if (transientErrorNames.includes(error.name)) {
            return true
        }

        // Check error message for transient indicators
        const errorMessage = error.message.toLowerCase()
        if (
            transientErrorMessages.some((indicator) =>
                errorMessage.includes(indicator)
            )
        ) {
            return true
        }

        // Default to permanent error (no requeue)
        return false
    }
}

module.exports = { MessageRouter }
