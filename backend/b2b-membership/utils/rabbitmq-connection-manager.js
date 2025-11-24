/**
 * RabbitMQ Connection Manager
 *
 * Manages RabbitMQ connection lifecycle with resilience features including
 * exponential backoff retry logic and graceful shutdown.
 */

const amqp = require("amqplib")
const { Logger } = require("./logger")

class ConnectionManager {
    /**
     * Create a ConnectionManager instance
     * @param {object} config - RabbitMQ configuration
     * @param {Logger} logger - Logger instance
     */
    constructor(config, logger) {
        this.config = config
        this.logger = logger || new Logger("RabbitMQ-ConnectionManager")
        this.connection = null
        this.channel = null
        this.reconnectAttempts = 0
        this.isConnecting = false
        this.shouldReconnect = true
    }

    /**
     * Establish connection to RabbitMQ
     * @returns {Promise<Connection>} RabbitMQ connection
     */
    async connect() {
        if (this.isConnecting) {
            this.logger.warn("Connection attempt already in progress")
            throw new Error("Connection attempt already in progress")
        }

        if (this.connection) {
            this.logger.warn("Connection already established")
            return this.connection
        }

        this.isConnecting = true

        try {
            const connectionUrl = `amqp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}`

            this.logger.info("Connecting to RabbitMQ", {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
            })

            this.connection = await amqp.connect(connectionUrl)
            this.channel = await this.connection.createChannel()

            // Reset reconnect attempts on successful connection
            this.reconnectAttempts = 0

            this.logger.info("Successfully connected to RabbitMQ", {
                host: this.config.host,
                port: this.config.port,
            })

            // Set up connection event handlers
            this.connection.on("error", (err) => {
                this.logger.error("RabbitMQ connection error", {
                    error: err.message,
                    stack: err.stack,
                })
            })

            this.connection.on("close", () => {
                this.logger.warn("RabbitMQ connection closed")
                this.connection = null
                this.channel = null

                // Attempt reconnection if enabled
                if (this.shouldReconnect) {
                    this.reconnect().catch((err) => {
                        this.logger.error("Reconnection failed", {
                            error: err.message,
                            stack: err.stack,
                        })
                    })
                }
            })

            return this.connection
        } catch (error) {
            this.logger.error("Failed to connect to RabbitMQ", {
                error: error.message,
                stack: error.stack,
                host: this.config.host,
                port: this.config.port,
            })
            throw error
        } finally {
            this.isConnecting = false
        }
    }

    /**
     * Disconnect from RabbitMQ
     * @returns {Promise<void>}
     */
    async disconnect() {
        this.shouldReconnect = false

        if (!this.connection) {
            this.logger.info("No active connection to disconnect")
            return
        }

        try {
            this.logger.info("Disconnecting from RabbitMQ")

            if (this.channel) {
                await this.channel.close()
                this.channel = null
            }

            await this.connection.close()
            this.connection = null

            this.logger.info("Successfully disconnected from RabbitMQ")
        } catch (error) {
            this.logger.error("Error during disconnect", {
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }

    /**
     * Reconnect to RabbitMQ with exponential backoff
     * @returns {Promise<Connection>} RabbitMQ connection
     */
    async reconnect() {
        const maxAttempts = this.config.reconnect.maxAttempts

        if (this.reconnectAttempts >= maxAttempts) {
            const error = new Error(
                `Maximum reconnection attempts (${maxAttempts}) reached`
            )
            this.logger.error("Reconnection failed - max attempts reached", {
                attempts: this.reconnectAttempts,
                maxAttempts,
            })
            throw error
        }

        this.reconnectAttempts++

        // Calculate exponential backoff delay
        const delay = this.calculateBackoffDelay(this.reconnectAttempts)

        this.logger.info("Attempting to reconnect to RabbitMQ", {
            attempt: this.reconnectAttempts,
            maxAttempts,
            delayMs: delay,
        })

        // Wait for the calculated delay
        await this.sleep(delay)

        try {
            return await this.connect()
        } catch (error) {
            this.logger.error("Reconnection attempt failed", {
                attempt: this.reconnectAttempts,
                error: error.message,
            })

            // Recursively try again if we haven't hit max attempts
            if (this.reconnectAttempts < maxAttempts) {
                return await this.reconnect()
            }

            throw error
        }
    }

    /**
     * Calculate exponential backoff delay
     * @param {number} attempt - Current attempt number (1-indexed)
     * @returns {number} Delay in milliseconds
     */
    calculateBackoffDelay(attempt) {
        const initialDelay = this.config.reconnect.initialDelay
        const maxDelay = this.config.reconnect.maxDelay

        // Formula: delay = min(initialDelay * (2 ^ (attempt - 1)), maxDelay)
        const delay = initialDelay * Math.pow(2, attempt - 1)
        return Math.min(delay, maxDelay)
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Check if connection is established
     * @returns {boolean} True if connected, false otherwise
     */
    isConnected() {
        return this.connection !== null && this.channel !== null
    }

    /**
     * Get the current channel
     * @returns {Channel|null} RabbitMQ channel or null
     */
    getChannel() {
        return this.channel
    }
}

module.exports = { ConnectionManager }
