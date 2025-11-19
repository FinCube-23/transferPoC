/**
 * Database Connection Module
 *
 * Manages MongoDB connection lifecycle using Mongoose
 */

const mongoose = require("mongoose")
const { config } = require("../config/config")
const { Logger } = require("./logger")

const logger = new Logger("Database")

/**
 * Establishes connection to MongoDB
 * @returns {Promise<void>}
 */
async function connectDatabase() {
    try {
        // Register connection event listeners BEFORE connecting
        mongoose.connection.on("connected", () => {
            logger.info("MongoDB connection established successfully!")
        })

        mongoose.connection.on("error", (err) => {
            logger.error("MongoDB connection error:", err)
        })

        mongoose.connection.on("disconnected", () => {
            logger.info("MongoDB connection disconnected")
        })

        logger.info("Connecting to MongoDB...")
        await mongoose.connect(config.database.uri, config.database.options)
        logger.info("MongoDB connection successful!")
    } catch (error) {
        logger.error("Failed to connect to MongoDB:", error)
        throw error
    }
}

/**
 * Closes MongoDB connection gracefully
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
    try {
        await mongoose.connection.close()
        logger.info("MongoDB connection closed gracefully")
    } catch (error) {
        logger.error("Error closing MongoDB connection:", error)
        throw error
    }
}

module.exports = {
    connectDatabase,
    disconnectDatabase,
}
