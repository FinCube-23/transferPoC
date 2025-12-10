/**
 * Test script for proof verification API
 * Demonstrates both usage patterns:
 * 1. Using default files from target directory
 * 2. Uploading custom proof files
 */

const axios = require("axios")
const FormData = require("form-data")
const fs = require("fs")
const path = require("path")

const API_BASE_URL = "http://localhost:2000"

/**
 * Test 1: Verify proof using default files from target directory
 */
async function testVerifyWithDefaultFiles() {
    console.log("\n========================================")
    console.log("Test 1: Verify with Default Files")
    console.log("========================================\n")

    try {
        const response = await axios.post(`${API_BASE_URL}/api/proof/verify`, {
            // Empty body - will use default target directory files
        })

        console.log("✅ Verification successful!")
        console.log("Response:", JSON.stringify(response.data, null, 2))
    } catch (error) {
        console.error("❌ Verification failed!")
        if (error.response) {
            console.error("Status:", error.response.status)
            console.error("Error:", JSON.stringify(error.response.data, null, 2))
        } else {
            console.error("Error:", error.message)
        }
    }
}

/**
 * Test 2: Verify proof by uploading custom files
 */
async function testVerifyWithUploadedFiles() {
    console.log("\n========================================")
    console.log("Test 2: Verify with Uploaded Files")
    console.log("========================================\n")

    try {
        // Paths to proof files
        const proofPath = path.join(
            __dirname,
            "../base/circuit/target/proof"
        )
        const publicInputsPath = path.join(
            __dirname,
            "../base/circuit/target/public_inputs"
        )

        // Check if files exist
        if (!fs.existsSync(proofPath)) {
            console.error(`❌ Proof file not found: ${proofPath}`)
            return
        }

        if (!fs.existsSync(publicInputsPath)) {
            console.error(
                `❌ Public inputs file not found: ${publicInputsPath}`
            )
            return
        }

        // Create form data with file uploads
        const formData = new FormData()
        formData.append("proof", fs.createReadStream(proofPath))
        formData.append(
            "public_inputs",
            fs.createReadStream(publicInputsPath)
        )

        console.log("Uploading files:")
        console.log(`  - Proof: ${proofPath}`)
        console.log(`  - Public Inputs: ${publicInputsPath}`)

        const response = await axios.post(
            `${API_BASE_URL}/api/proof/verify`,
            formData,
            {
                headers: formData.getHeaders(),
            }
        )

        console.log("\n✅ Verification successful!")
        console.log("Response:", JSON.stringify(response.data, null, 2))
    } catch (error) {
        console.error("❌ Verification failed!")
        if (error.response) {
            console.error("Status:", error.response.status)
            console.error("Error:", JSON.stringify(error.response.data, null, 2))
        } else {
            console.error("Error:", error.message)
        }
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log("Starting Proof Verification API Tests")
    console.log(`API Base URL: ${API_BASE_URL}`)

    // Test 1: Default files
    await testVerifyWithDefaultFiles()

    // Wait a bit between tests
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Test 2: Uploaded files
    await testVerifyWithUploadedFiles()

    console.log("\n========================================")
    console.log("All tests completed!")
    console.log("========================================\n")
}

// Run tests if executed directly
if (require.main === module) {
    runTests().catch((error) => {
        console.error("Fatal error:", error)
        process.exit(1)
    })
}

module.exports = { testVerifyWithDefaultFiles, testVerifyWithUploadedFiles }
