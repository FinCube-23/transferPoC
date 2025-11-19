/**
 * Test script to verify application startup with database integration
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")

async function testAppStartup() {
    console.log("Testing application startup with database integration...\n")

    try {
        // Simulate application startup
        console.log("1. Connecting to database...")
        await connectDatabase()
        console.log("✓ Database connected\n")

        // Wait a moment to simulate app running
        console.log("2. Application running (simulated)...")
        await new Promise((resolve) => setTimeout(resolve, 2000))
        console.log("✓ Application operational\n")

        // Simulate graceful shutdown
        console.log("3. Shutting down gracefully...")
        await disconnectDatabase()
        console.log("✓ Database disconnected\n")

        console.log("=================================")
        console.log("Application startup test passed! ✓")
        console.log("=================================")
        process.exit(0)
    } catch (error) {
        console.error("✗ Startup test failed:", error.message)
        process.exit(1)
    }
}

testAppStartup()
