/**
 * Test script for proof generation endpoint
 *
 * This script tests the /api/proof/generate endpoint with various configurations
 */

require("dotenv").config()
const http = require("http")

const PORT = process.env.PORT || 8000
const HOST = "localhost"

/**
 * Make HTTP POST request
 */
function makeRequest(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data)

        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
            },
        }

        const req = http.request(options, (res) => {
            let responseData = ""

            res.on("data", (chunk) => {
                responseData += chunk
            })

            res.on("end", () => {
                try {
                    const parsed = JSON.parse(responseData)
                    resolve({
                        statusCode: res.statusCode,
                        data: parsed,
                    })
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData,
                    })
                }
            })
        })

        req.on("error", (error) => {
            reject(error)
        })

        req.write(postData)
        req.end()
    })
}

/**
 * Test proof generation with custom config
 */
async function testProofGeneration() {
    console.log("========================================")
    console.log("Testing Proof Generation Endpoint")
    console.log("========================================\n")

    try {
        // Test 1: Generate proof with custom test config
        console.log("Test 1: Generate proof with custom test config")
        console.log("----------------------------------------")

        const testConfig = {
            roots: ["123", "456", "789"],
            userEmail: "test@example.com",
            salt: "test_salt_123",
            verifierKey: "verifier_key_456",
            isKYCed: true,
        }

        console.log("Sending request with config:")
        console.log(JSON.stringify({ testConfig }, null, 2))
        console.log("\nWaiting for response...\n")

        const response = await makeRequest("/api/proof/generate", {
            testConfig,
        })

        console.log(`Status Code: ${response.statusCode}`)
        console.log("Response:")
        console.log(JSON.stringify(response.data, null, 2))

        if (response.data.success) {
            console.log("\n✅ Proof generation successful!")
            console.log(
                `Proof length: ${
                    response.data.proof ? response.data.proof.length : 0
                } chars`
            )
            console.log(
                `Public inputs count: ${
                    response.data.publicInputs
                        ? response.data.publicInputs.length
                        : 0
                }`
            )
        } else {
            console.log("\n❌ Proof generation failed")
            if (response.data.error) {
                console.log(`Error type: ${response.data.error.type}`)
                console.log(`Error message: ${response.data.error.message}`)
                if (response.data.error.details) {
                    console.log("Error details:")
                    console.log(
                        JSON.stringify(response.data.error.details, null, 2)
                    )
                }
            }
        }

        console.log("\n========================================")
        console.log("Test completed")
        console.log("========================================")
    } catch (error) {
        console.error("\n❌ Test failed with error:", error.message)
        console.error("Make sure the server is running on port", PORT)
        console.error("Start the server with: npm start")
        process.exit(1)
    }
}

// Test 2: Generate proof without config (default)
async function testDefaultProofGeneration() {
    console.log("\n\n========================================")
    console.log("Testing Default Proof Generation")
    console.log("========================================\n")

    try {
        console.log("Sending request without testConfig...\n")

        const response = await makeRequest("/api/proof/generate", {})

        console.log(`Status Code: ${response.statusCode}`)
        console.log("Response:")
        console.log(JSON.stringify(response.data, null, 2))

        if (response.data.success) {
            console.log("\n✅ Default proof generation successful!")
        } else {
            console.log("\n❌ Default proof generation failed")
            if (response.data.error) {
                console.log(`Error: ${response.data.error.message}`)
            }
        }
    } catch (error) {
        console.error("\n❌ Test failed:", error.message)
    }
}

// Run tests
async function runTests() {
    console.log("Starting proof generation tests...\n")
    console.log(`Target: http://${HOST}:${PORT}/api/proof/generate\n`)

    await testProofGeneration()
    // Uncomment to test default generation:
    // await testDefaultProofGeneration();

    console.log("\n\nAll tests completed")
    process.exit(0)
}

runTests().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
})
