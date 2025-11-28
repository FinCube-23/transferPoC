/**
 * Test script for database connection utility
 *
 * This script verifies that the database connection module works correctly
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")

async function testDatabaseConnection() {
    console.log("Testing database connection utility...\n")

    try {
        // Test 1: Connect to database
        console.log("Test 1: Connecting to database...")
        await connectDatabase()
        console.log("✓ Connection successful\n")

        // Wait a moment to ensure connection is stable
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Test 2: Disconnect from database
        console.log("Test 2: Disconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnection successful\n")

        console.log("All tests passed!")
        process.exit(0)
    } catch (error) {
        console.error("✗ Test failed:", error.message)
        process.exit(1)
    }
}

testDatabaseConnection()
