/**
 * Test script for proof generation API with default testConfig
 *
 * This demonstrates calling the /api/proof/generate endpoint
 * without providing testConfig (uses defaults from test_data_generator.js)
 */

const http = require("http")

// Empty payload (will use default test data)
const payload = JSON.stringify({})

// HTTP request options
const options = {
    hostname: "localhost",
    port: 8000,
    path: "/api/proof/generate",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
    },
}

console.log("🚀 Testing proof generation API with default testConfig...\n")
console.log("📤 Sending request to: http://localhost:8000/api/proof/generate")
console.log("📦 Payload: {} (using defaults)")
console.log("\n⏳ Waiting for response...\n")

// Make the request
const req = http.request(options, (res) => {
    let data = ""

    res.on("data", (chunk) => {
        data += chunk
    })

    res.on("end", () => {
        console.log(`📊 Response Status: ${res.statusCode}`)
        console.log("📥 Response Body:\n")

        try {
            const response = JSON.parse(data)
            console.log(JSON.stringify(response, null, 2))

            if (response.success) {
                console.log("\n✅ Proof generation successful!")
                console.log(
                    `   Proof length: ${
                        response.proof ? response.proof.length : 0
                    } chars`
                )
                console.log(
                    `   Public inputs: ${
                        response.publicInputs ? response.publicInputs.length : 0
                    } items`
                )
            } else {
                console.log("\n❌ Proof generation failed!")
                console.log(`   Error type: ${response.error?.type}`)
                console.log(`   Error message: ${response.error?.message}`)
            }
        } catch (error) {
            console.error("Failed to parse response:", error.message)
            console.log("Raw response:", data)
        }
    })
})

req.on("error", (error) => {
    console.error("❌ Request failed:", error.message)
    console.log("\n💡 Make sure the server is running:")
    console.log("   cd backend/b2b-membership")
    console.log("   npm start")
})

// Send the request
req.write(payload)
req.end()
