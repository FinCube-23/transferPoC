/**
 * Manual test script for blockchain integration
 *
 * This script tests:
 * 1. Alchemy provider initialization
 * 2. HonkVerifier model functionality
 * 3. Contract verification caller
 */

require("dotenv").config()
const ProofController = require("./controllers/proof-controller")
const { HonkVerifier } = require("./models/honk-verifier")

async function testBlockchainIntegration() {
    console.log("========================================")
    console.log("Testing Blockchain Integration")
    console.log("========================================\n")

    try {
        // Test 1: Initialize provider
        console.log("Test 1: Alchemy Provider Initialization")
        console.log("----------------------------------------")
        const controller = new ProofController()
        const initResult = await controller.initializeProvider()

        if (!initResult.success) {
            console.error(
                "❌ Provider initialization failed:",
                initResult.error
            )
            return
        }
        console.log("✅ Provider initialization successful\n")

        // Test 2: HonkVerifier model
        console.log("Test 2: HonkVerifier Model")
        console.log("----------------------------------------")
        const verifier = new HonkVerifier()
        console.log(`Contract address: ${verifier.address}`)
        console.log(`ABI loaded: ${verifier.abi ? "Yes" : "No"}`)

        try {
            const contract = verifier.getContract(controller.provider)
            console.log("✅ Contract instance created successfully")
            console.log(
                `Contract address from instance: ${await contract.getAddress()}\n`
            )
        } catch (error) {
            console.error(
                "❌ Failed to create contract instance:",
                error.message
            )
            return
        }

        // Test 3: Contract verification with dummy data (expected to fail)
        console.log("Test 3: Contract Verification Call")
        console.log("----------------------------------------")
        console.log(
            "Note: Using dummy data, verification expected to fail gracefully\n"
        )

        // Create dummy proof and public inputs
        const dummyProof = "0x" + "00".repeat(100) // 100 bytes of zeros
        const dummyPublicInputs = [
            "0x" + "00".repeat(32), // 32 bytes of zeros
        ]

        const verifyResult = await controller.callContractVerification(
            dummyProof,
            dummyPublicInputs
        )

        if (verifyResult.success) {
            console.log(`✅ Contract call successful`)
            console.log(`Verification result: ${verifyResult.verified}`)
        } else {
            console.log(`✅ Contract call handled error gracefully`)
            console.log(`Error type: ${verifyResult.error.type}`)
            console.log(`Error message: ${verifyResult.error.message}`)
            if (verifyResult.error.revertReason) {
                console.log(`Revert reason: ${verifyResult.error.revertReason}`)
            }
        }

        console.log("\n========================================")
        console.log("✅ All blockchain integration tests completed")
        console.log("========================================")
    } catch (error) {
        console.error("\n❌ Test failed with error:", error.message)
        console.error(error.stack)
    }
}

// Run tests
testBlockchainIntegration()
    .then(() => {
        console.log("\nTest script completed")
        process.exit(0)
    })
    .catch((error) => {
        console.error("\nTest script failed:", error)
        process.exit(1)
    })
