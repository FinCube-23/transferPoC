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
