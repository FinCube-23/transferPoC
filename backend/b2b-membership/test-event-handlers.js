/**
 * Test Event Handlers
 *
 * Basic tests to verify event handler functions work correctly
 */

const mongoose = require("mongoose")
const {
    handleOrganizationCreated,
    handleOrganizationUserCreated,
    handleSyncAllData,
} = require("./utils/event-handlers")
const Event = require("./models/event")
const { config } = require("./config/config")

async function testEventHandlers() {
    console.log("Starting event handlers test...")

    try {
        // Connect to MongoDB
        console.log("Connecting to MongoDB...")
        await mongoose.connect(config.database.uri)
        console.log("Connected to MongoDB")

        // Clean up any existing test events
        await Event.deleteMany({
            "payload.test": true,
        })

        // Test 1: handleOrganizationCreated
        console.log("\n--- Test 1: handleOrganizationCreated ---")
        const orgPayload = {
            test: true,
            organizationId: "test-org-123",
            name: "Test Organization",
            createdAt: new Date().toISOString(),
        }

        await handleOrganizationCreated("organization.created", orgPayload)
        console.log("✓ handleOrganizationCreated completed successfully")

        // Verify event was stored
        const orgEvent = await Event.findOne({
            routingKey: "organization.created",
            "payload.organizationId": "test-org-123",
        })
        console.log("✓ Event stored in database:", {
            id: orgEvent._id.toString(),
            status: orgEvent.status,
            routingKey: orgEvent.routingKey,
        })

        // Test 2: handleOrganizationUserCreated
        console.log("\n--- Test 2: handleOrganizationUserCreated ---")
        const userPayload = {
            test: true,
            userId: "test-user-456",
            organizationId: "test-org-123",
            email: "test@example.com",
            createdAt: new Date().toISOString(),
        }

        await handleOrganizationUserCreated(
            "organization.user.created",
            userPayload
        )
        console.log("✓ handleOrganizationUserCreated completed successfully")

        // Verify event was stored
        const userEvent = await Event.findOne({
            routingKey: "organization.user.created",
            "payload.userId": "test-user-456",
        })
        console.log("✓ Event stored in database:", {
            id: userEvent._id.toString(),
            status: userEvent.status,
            routingKey: userEvent.routingKey,
        })

        // Test 3: handleSyncAllData
        console.log("\n--- Test 3: handleSyncAllData ---")
        const syncPayload = {
            test: true,
            syncType: "full",
            requestedAt: new Date().toISOString(),
        }

        await handleSyncAllData("ums.sync", syncPayload)
        console.log("✓ handleSyncAllData completed successfully")

        // Verify event was stored
        const syncEvent = await Event.findOne({
            routingKey: "ums.sync",
            "payload.syncType": "full",
        })
        console.log("✓ Event stored in database:", {
            id: syncEvent._id.toString(),
            status: syncEvent.status,
            routingKey: syncEvent.routingKey,
        })

        // Test 4: Error handling
        console.log("\n--- Test 4: Error handling ---")
        try {
            // Force an error by passing invalid data to event store
            // This will test the error handling path
            const invalidPayload = null
            await handleOrganizationCreated(
                "organization.created",
                invalidPayload
            )
            console.log("✗ Should have thrown an error")
        } catch (error) {
            console.log("✓ Error handling works correctly:", error.message)
        }

        // Clean up test events
        console.log("\n--- Cleaning up test data ---")
        const deleteResult = await Event.deleteMany({
            "payload.test": true,
        })
        console.log(`✓ Deleted ${deleteResult.deletedCount} test events`)

        console.log("\n✓ All tests passed!")
    } catch (error) {
        console.error("✗ Test failed:", error.message)
        console.error(error.stack)
        process.exit(1)
    } finally {
        await mongoose.disconnect()
        console.log("Disconnected from MongoDB")
    }
}

// Run tests
testEventHandlers()
