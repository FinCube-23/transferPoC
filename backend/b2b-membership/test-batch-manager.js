/**
 * Test script for BatchManager utility
 *
 * This script tests the basic functionality of the BatchManager class.
 */

const mongoose = require("mongoose")
const BatchManager = require("./utils/batch-manager")
const Batch = require("./models/batch")
const User = require("./models/user")
require("dotenv").config()

async function testBatchManager() {
    try {
        // Connect to database
        console.log("Connecting to database...")
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("Connected to database")

        const batchManager = new BatchManager()

        // Test 1: Create a new batch
        console.log("\n=== Test 1: Create new batch ===")
        const newBatch = await batchManager.createBatch()
        console.log("Created batch:", {
            id: newBatch._id,
            equation: newBatch.equation,
        })

        // Test 2: Check batch capacity (should be true - no users yet)
        console.log("\n=== Test 2: Check batch capacity ===")
        const hasCapacity = await batchManager.hasCapacity(newBatch._id)
        console.log("Batch has capacity:", hasCapacity)

        // Test 3: Get user count (should be 0)
        console.log("\n=== Test 3: Get user count ===")
        const userCount = await batchManager.getUserCount(newBatch._id)
        console.log("User count:", userCount)

        // Test 4: Update batch equation
        console.log("\n=== Test 4: Update batch equation ===")
        const newEquation = ["1", "2", "3"]
        const updatedBatch = await batchManager.updateBatchEquation(
            newBatch._id,
            newEquation
        )
        console.log("Updated batch equation:", updatedBatch.equation)

        // Test 5: Find available batch
        console.log("\n=== Test 5: Find available batch ===")
        const availableBatch = await batchManager.findAvailableBatch()
        console.log(
            "Found available batch:",
            availableBatch ? availableBatch._id : "none"
        )

        // Cleanup
        console.log("\n=== Cleanup ===")
        await Batch.findByIdAndDelete(newBatch._id)
        console.log("Deleted test batch")

        console.log("\n✅ All tests passed!")
    } catch (error) {
        console.error("❌ Test failed:", error.message)
        console.error(error.stack)
    } finally {
        await mongoose.connection.close()
        console.log("\nDatabase connection closed")
    }
}

testBatchManager()
