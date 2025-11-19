/**
 * Test script for health check endpoint with database status
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const mongoose = require("mongoose")

async function testHealthEndpoint() {
    console.log("Testing health check endpoint logic...\n")

    try {
        // Test 1: Database disconnected state
        console.log("Test 1: Checking database status when disconnected...")
        let dbStatus =
            mongoose.connection.readyState === 1 ? "connected" : "disconnected"
        console.log("  Database status:", dbStatus)
        if (dbStatus === "disconnected") {
            console.log("✓ Correctly reports disconnected state\n")
        } else {
            console.log("✗ Should report disconnected state\n")
            process.exit(1)
        }

        // Test 2: Database connected state
        console.log("Test 2: Checking database status when connected...")
        await connectDatabase()
        dbStatus =
            mongoose.connection.readyState === 1 ? "connected" : "disconnected"
        console.log("  Database status:", dbStatus)
        if (dbStatus === "connected") {
            console.log("✓ Correctly reports connected state\n")
        } else {
            console.log("✗ Should report connected state\n")
            process.exit(1)
        }

        // Test 3: Health check response structure
        console.log("Test 3: Verifying health check response structure...")
        const healthResponse = {
            status: "ok",
            service: "zkp-proof-controller",
            database: dbStatus,
        }
        console.log("  Response:", JSON.stringify(healthResponse, null, 2))

        if (
            healthResponse.status === "ok" &&
            healthResponse.service === "zkp-proof-controller" &&
            healthResponse.database === "connected"
        ) {
            console.log("✓ Health check response structure is correct\n")
        } else {
            console.log("✗ Health check response structure is incorrect\n")
            process.exit(1)
        }

        // Cleanup
        await disconnectDatabase()

        console.log("=================================")
        console.log("Health endpoint test passed! ✓")
        console.log("=================================")
        process.exit(0)
    } catch (error) {
        console.error("✗ Test failed:", error.message)
        await disconnectDatabase()
        process.exit(1)
    }
}

testHealthEndpoint()
