/**
 * Structure validation test for blockchain integration
 *
 * This script validates the code structure without requiring network access
 */

require("dotenv").config()
const ProofController = require("./controllers/proof-controller")
const { HonkVerifier } = require("./models/honk-verifier")

function testBlockchainStructure() {
    console.log("========================================")
    console.log("Testing Blockchain Integration Structure")
    console.log("========================================\n")

    let passed = 0
    let failed = 0

    try {
        // Test 1: ProofController has required methods
        console.log("Test 1: ProofController Methods")
        console.log("----------------------------------------")
        const controller = new ProofController()

        const requiredMethods = [
            "initializeProvider",
            "callContractVerification",
            "verifyProof",
            "generateProof",
        ]

        for (const method of requiredMethods) {
            if (typeof controller[method] === "function") {
                console.log(`✅ ${method} method exists`)
                passed++
            } else {
                console.log(`❌ ${method} method missing`)
                failed++
            }
        }

        // Test 2: ProofController has blockchain configuration
        console.log("\nTest 2: ProofController Configuration")
        console.log("----------------------------------------")

        if (controller.alchemyApiKey) {
            console.log(`✅ Alchemy API key configured`)
            passed++
        } else {
            console.log(`❌ Alchemy API key not configured`)
            failed++
        }

        if (controller.alchemyNetwork) {
            console.log(
                `✅ Alchemy network configured: ${controller.alchemyNetwork}`
            )
            passed++
        } else {
            console.log(`❌ Alchemy network not configured`)
            failed++
        }

        if (controller.walletPrivateKey) {
            console.log(`✅ Wallet private key configured`)
            passed++
        } else {
            console.log(`❌ Wallet private key not configured`)
            failed++
        }

        // Test 3: HonkVerifier model structure
        console.log("\nTest 3: HonkVerifier Model")
        console.log("----------------------------------------")
        const verifier = new HonkVerifier()

        if (verifier.address) {
            console.log(`✅ Contract address configured: ${verifier.address}`)
            passed++
        } else {
            console.log(`❌ Contract address not configured`)
            failed++
        }

        if (verifier.abi && Array.isArray(verifier.abi)) {
            console.log(
                `✅ Contract ABI loaded (${verifier.abi.length} entries)`
            )
            passed++
        } else {
            console.log(`❌ Contract ABI not loaded`)
            failed++
        }

        const verifierMethods = [
            "getContract",
            "getContractWithSigner",
            "verify",
        ]
        for (const method of verifierMethods) {
            if (typeof verifier[method] === "function") {
                console.log(`✅ ${method} method exists`)
                passed++
            } else {
                console.log(`❌ ${method} method missing`)
                failed++
            }
        }

        // Test 4: Verify function signature in ABI
        console.log("\nTest 4: Contract ABI Verification")
        console.log("----------------------------------------")

        const verifyFunction = verifier.abi.find(
            (item) => item.type === "function" && item.name === "verify"
        )

        if (verifyFunction) {
            console.log(`✅ verify function found in ABI`)
            passed++

            // Check inputs
            if (verifyFunction.inputs && verifyFunction.inputs.length === 2) {
                const proofInput = verifyFunction.inputs[0]
                const publicInputsInput = verifyFunction.inputs[1]

                if (
                    proofInput.type === "bytes" &&
                    proofInput.name === "proof"
                ) {
                    console.log(
                        `✅ verify function has correct proof parameter (bytes)`
                    )
                    passed++
                } else {
                    console.log(`❌ verify function proof parameter incorrect`)
                    failed++
                }

                if (
                    publicInputsInput.type === "bytes32[]" &&
                    publicInputsInput.name === "publicInputs"
                ) {
                    console.log(
                        `✅ verify function has correct publicInputs parameter (bytes32[])`
                    )
                    passed++
                } else {
                    console.log(
                        `❌ verify function publicInputs parameter incorrect`
                    )
                    failed++
                }
            } else {
                console.log(`❌ verify function has incorrect number of inputs`)
                failed++
            }

            // Check outputs
            if (verifyFunction.outputs && verifyFunction.outputs.length === 1) {
                const output = verifyFunction.outputs[0]
                if (output.type === "bool") {
                    console.log(`✅ verify function returns bool`)
                    passed++
                } else {
                    console.log(`❌ verify function return type incorrect`)
                    failed++
                }
            } else {
                console.log(
                    `❌ verify function has incorrect number of outputs`
                )
                failed++
            }
        } else {
            console.log(`❌ verify function not found in ABI`)
            failed += 4
        }

        // Test 5: Error types in ABI
        console.log("\nTest 5: Contract Error Types")
        console.log("----------------------------------------")

        const expectedErrors = [
            "ConsistencyCheckFailed",
            "ProofLengthWrong",
            "PublicInputsLengthWrong",
            "SumcheckFailed",
            "ShpleminiFailed",
        ]

        for (const errorName of expectedErrors) {
            const errorDef = verifier.abi.find(
                (item) => item.type === "error" && item.name === errorName
            )
            if (errorDef) {
                console.log(`✅ ${errorName} error defined in ABI`)
                passed++
            } else {
                console.log(`❌ ${errorName} error not found in ABI`)
                failed++
            }
        }

        // Summary
        console.log("\n========================================")
        console.log("Test Summary")
        console.log("========================================")
        console.log(`✅ Passed: ${passed}`)
        console.log(`❌ Failed: ${failed}`)
        console.log(`Total: ${passed + failed}`)

        if (failed === 0) {
            console.log("\n✅ All structure tests passed!")
            console.log("Blockchain integration is correctly implemented.")
            return true
        } else {
            console.log("\n❌ Some tests failed")
            return false
        }
    } catch (error) {
        console.error("\n❌ Test failed with error:", error.message)
        console.error(error.stack)
        return false
    }
}

// Run tests
const success = testBlockchainStructure()
process.exit(success ? 0 : 1)
