const { ethers } = require("ethers")
const path = require("path")
require("dotenv").config()

// Load correct HonkVerifier ABI from artifacts
const abi = require("../artifacts/contracts/HonkVerifier.json")

// Load contract address from deployment configuration
const deploymentConfig = require("../../../json-log/honk_verifier.json")

class HonkVerifier {
    constructor() {
        this.address = deploymentConfig.HonkVerifier
        this.abi = abi
        this.walletPrivateKey = process.env.WALLET_PRIVATE_KEY
    }

    /**
     * Get contract instance with provider
     * @param {object} provider - Ethers provider instance
     * @returns {object} Contract instance
     */
    getContract(provider) {
        if (!provider) {
            throw new Error("Provider is required to get contract instance")
        }

        if (!this.address) {
            throw new Error("Contract address not configured")
        }

        if (!this.abi) {
            throw new Error("Contract ABI not loaded")
        }

        // Create contract instance with provider (for read-only operations)
        const contract = new ethers.Contract(this.address, this.abi, provider)
        return contract
    }

    /**
     * Get contract instance with signer for transactions
     * @param {object} wallet - Ethers wallet instance with signer
     * @returns {object} Contract instance with signer
     */
    getContractWithSigner(wallet) {
        if (!wallet) {
            throw new Error("Wallet is required to get contract with signer")
        }

        if (!this.address) {
            throw new Error("Contract address not configured")
        }

        if (!this.abi) {
            throw new Error("Contract ABI not loaded")
        }

        // Create contract instance with signer (for write operations)
        const contract = new ethers.Contract(this.address, this.abi, wallet)
        return contract
    }

    /**
     * Verify proof using the contract
     * @param {object} provider - Ethers provider instance
     * @param {string} proof - Hex-encoded proof bytes
     * @param {string[]} publicInputs - Array of bytes32 public inputs
     * @returns {Promise<{success: boolean, verified?: boolean, error?: object}>}
     */
    async verify(provider, proof, publicInputs) {
        try {
            console.log("\n=== Calling HonkVerifier Contract ===")
            console.log(`[INFO] Contract address: ${this.address}`)
            console.log(`[INFO] Proof length: ${proof.length} chars`)
            console.log(`[INFO] Public inputs count: ${publicInputs.length}`)

            // Get contract instance
            const contract = this.getContract(provider)

            // Call verify function (view function, no gas required)
            console.log("[INFO] Calling verify function...")
            const verified = await contract.verify(proof, publicInputs)

            console.log(`[SUCCESS] Verification result: ${verified}`)

            return {
                success: true,
                verified: verified,
            }
        } catch (error) {
            console.error(
                "[ERROR] Contract verification failed:",
                error.message
            )
            return {
                success: false,
                error: {
                    type: "VERIFICATION_FAILED",
                    message: "Contract verification call failed",
                    details: {
                        error: error.message,
                        code: error.code,
                    },
                },
            }
        }
    }
}

module.exports = { HonkVerifier }
