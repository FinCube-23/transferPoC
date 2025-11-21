/**
 * Test script for user-specific proof generation
 *
 * This script demonstrates how to generate a proof for a specific user
 * using their user_id and org_id.
 */

const axios = require("axios")

const API_BASE_URL = "http://localhost:3000/api/proof"

/**
 * Test user proof generation
 */
async function testGenerateUserProof() {
    console.log("🧪 Testing User Proof Generation\n")

    try {
        // Test data - replace with actual user_id and org_id from your database
        const requestData = {
            user_id: 1, // Replace with actual user_id
            org_id: 1, // Replace with actual org_id
            isKYCed: true,
        }

        console.log("📤 Sending request to /api/proof/generate-user")
        console.log("Request data:", JSON.stringify(requestData, null, 2))

        const response = await axios.post(
            `${API_BASE_URL}/generate-user`,
            requestData,
            {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 300000, // 5 minutes timeout for proof generation
            }
        )

        console.log("\n✅ Proof generation successful!")
        console.log("\nResponse:")
        console.log("- Success:", response.data.success)
        console.log("- Proof length:", response.data.proof?.length || 0)
        console.log(
            "- Public inputs count:",
            response.data.publicInputs?.length || 0
        )

        if (response.data.publicInputs) {
            console.log("\nPublic Inputs:")
            response.data.publicInputs.forEach((input, index) => {
                console.log(`  [${index}]: ${input}`)
            })
        }

        console.log("\n📊 Full response:")
        console.log(JSON.stringify(response.data, null, 2))

        return response.data
    } catch (error) {
        console.error("\n❌ Error generating user proof:")

        if (error.response) {
            console.error("Status:", error.response.status)
            console.error(
                "Error data:",
                JSON.stringify(error.response.data, null, 2)
            )
        } else if (error.request) {
            console.error("No response received from server")
            console.error("Error:", error.message)
        } else {
            console.error("Error:", error.message)
        }

        throw error
    }
}

/**
 * Main execution
 */
async function main() {
    console.log("🚀 Starting User Proof Generation Test\n")
    console.log("=".repeat(60))

    try {
        await testGenerateUserProof()

        console.log("\n" + "=".repeat(60))
        console.log("✅ All tests completed successfully!")
    } catch (error) {
        console.log("\n" + "=".repeat(60))
        console.error("❌ Test failed!")
        process.exit(1)
    }
}

// Run if executed directly
if (require.main === module) {
    main()
}

module.exports = { testGenerateUserProof }
