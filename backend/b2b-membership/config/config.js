/**
 * Configuration Module
 *
 * Centralizes access to environment variables and configuration settings
 */

require("dotenv").config()

const config = {
    // Server configuration
    port: process.env.PORT || 8000,

    // Alchemy configuration
    alchemy: {
        apiKey: process.env.ALCHEMY_API_KEY,
        network: process.env.ALCHEMY_NETWORK || "sepolia",
    },

    // Smart contract configuration
    contract: {
        honkVerifierAddress: process.env.HONK_VERIFIER_CONTRACT_ADDRESS,
    },

    // Wallet configuration
    wallet: {
        privateKey: process.env.WALLET_PRIVATE_KEY,
    },

    // Circuit paths
    paths: {
        circuitDir: "../base/circuit",
        targetDir: "../base/circuit/target",
        testDataGenerator: "../base/utils/test_data_generator.js",
    },

    // Database configuration
    database: {
        uri:
            process.env.MONGODB_URI ||
            "mongodb://localhost:27017/b2b-membership",
        options: {},
    },

    // RabbitMQ configuration
    rabbitmq: {
        host: process.env.RABBITMQ_HOST || "localhost",
        port: parseInt(process.env.RABBITMQ_PORT) || 5672,
        username: process.env.RABBITMQ_USERNAME || "guest",
        password: process.env.RABBITMQ_PASSWORD || "guest",
        exchange: process.env.RABBITMQ_EXCHANGE || "exchange.ums.events",
        exchangeType: process.env.RABBITMQ_EXCHANGE_TYPE || "topic",
        routingKeys: [
            "organization.created",
            "organization.user.created",
            "ums.sync",
        ],
        prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH_COUNT) || 10,
        handlerTimeout: parseInt(process.env.RABBITMQ_HANDLER_TIMEOUT) || 30000,
        reconnect: {
            maxAttempts:
                parseInt(process.env.RABBITMQ_RECONNECT_MAX_ATTEMPTS) || 10,
            initialDelay:
                parseInt(process.env.RABBITMQ_RECONNECT_INITIAL_DELAY) || 1000,
            maxDelay:
                parseInt(process.env.RABBITMQ_RECONNECT_MAX_DELAY) || 60000,
        },
    },
}

/**
 * Validate required configuration
 */
function validateConfig() {
    const errors = []

    if (!config.alchemy.apiKey) {
        errors.push("ALCHEMY_API_KEY is not configured")
    }

    if (!config.contract.honkVerifierAddress) {
        errors.push("HONK_VERIFIER_CONTRACT_ADDRESS is not configured")
    }

    if (!config.wallet.privateKey) {
        errors.push("WALLET_PRIVATE_KEY is not configured")
    }

    return {
        isValid: errors.length === 0,
        errors,
    }
}

module.exports = {
    config,
    validateConfig,
}
