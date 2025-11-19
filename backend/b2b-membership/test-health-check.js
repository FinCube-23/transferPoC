/**
 * Test script for health check endpoint with database status
 *
 * This script verifies that the health check endpoint includes database status
 */

const http = require("http")

async function testHealthCheck() {
    console.log("Testing health check endpoint...\n")

    return new Promise((resolve, reject) => {
        const options = {
            hostname: "localhost",
            port: process.env.PORT || 5000,
            path: "/health",
            method: "GET",
        }

        const req = http.request(options, (res) => {
            let data = ""

            res.on("data", (chunk) => {
                data += chunk
            })

            res.on("end", () => {
                try {
                    const response = JSON.parse(data)
                    console.log("Health check response:", response)

                    // Verify response structure
                    if (!response.status) {
                        throw new Error("Missing 'status' field")
                    }

                    if (!response.service) {
                        throw new Error("Missing 'service' field")
                    }

                    if (!response.database) {
                        throw new Error("Missing 'database' field")
                    }

                    console.log(
                        "\n✓ Health check endpoint includes database status"
                    )
                    console.log(`✓ Database status: ${response.database}\n`)
                    console.log("All tests passed!")
                    resolve()
                } catch (error) {
                    console.error("✗ Test failed:", error.message)
                    reject(error)
                }
            })
        })

        req.on("error", (error) => {
            console.error("✗ Failed to connect to server:", error.message)
            console.log(
                "\nNote: Make sure the server is running before running this test."
            )
            reject(error)
        })

        req.end()
    })
}

testHealthCheck()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
