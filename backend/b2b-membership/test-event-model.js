/**
 * Test script for Event model
 *
 * This script verifies that the Event model works correctly with validation
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const Event = require("./models/event")

async function testEventModel() {
    console.log("Testing Event model...\n")

    try {
        // Connect to database
        console.log("Connecting to database...")
        await connectDatabase()
        console.log("✓ Connected\n")

        // Clean up any existing test data
        console.log("Cleaning up any existing test data...")
        await Event.deleteMany({})
        console.log("✓ Cleaned up\n")

        // Test 1: Create event with all required fields
        console.log("Test 1: Creating Event with required fields...")
        const event1 = new Event({
            routingKey: "organization.created",
            payload: {
                eventType: "organization.created",
                timestamp: new Date().toISOString(),
                data: {
                    org_id: 1001,
                    wallet_address:
                        "0x1234567890123456789012345678901234567890",
                },
            },
        })
        await event1.save()
        console.log("✓ Event created successfully with ID:", event1._id)
        console.log("  - routingKey:", event1.routingKey)
        console.log("  - status:", event1.status)
        console.log("  - receivedAt:", event1.receivedAt)

        // Test 2: Verify default values
        console.log("\nTest 2: Verifying default values...")
        if (event1.status !== "received") {
            throw new Error("Default status should be 'received'")
        }
        if (!event1.receivedAt) {
            throw new Error("receivedAt should be auto-generated")
        }
        console.log("✓ Default values set correctly")

        // Test 3: Create event with all fields
        console.log("\nTest 3: Creating Event with all fields...")
        const event2 = new Event({
            routingKey: "organization.user.created",
            payload: {
                eventType: "organization.user.created",
                data: { user_id: 2001 },
            },
            receivedAt: new Date("2024-01-01"),
            processedAt: new Date("2024-01-01T00:00:05"),
            status: "completed",
        })
        await event2.save()
        console.log("✓ Event with all fields created successfully")

        // Test 4: Create event with error status
        console.log("\nTest 4: Creating Event with error status...")
        const event3 = new Event({
            routingKey: "ums.sync",
            payload: { data: "test" },
            status: "failed",
            error: "Database connection timeout",
        })
        await event3.save()
        console.log("✓ Event with error status created successfully")
        console.log("  - status:", event3.status)
        console.log("  - error:", event3.error)

        // Test 5: Validate status enum
        console.log("\nTest 5: Testing status enum validation...")
        try {
            const invalidEvent = new Event({
                routingKey: "test.event",
                payload: { data: "test" },
                status: "invalid_status",
            })
            await invalidEvent.save()
            console.log("✗ Should have rejected invalid status")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected invalid status")
        }

        // Test 6: Validate required fields
        console.log("\nTest 6: Testing required field validation...")
        try {
            const missingFieldEvent = new Event({
                payload: { data: "test" },
                // routingKey is missing
            })
            await missingFieldEvent.save()
            console.log("✗ Should have rejected missing routingKey")
            process.exit(1)
        } catch (error) {
            console.log("✓ Correctly rejected missing routingKey")
        }

        // Test 7: Verify indexes exist
        console.log("\nTest 7: Verifying indexes...")
        const indexes = await Event.collection.getIndexes()
        console.log("✓ Indexes found:")
        Object.keys(indexes).forEach((indexName) => {
            console.log(`  - ${indexName}:`, indexes[indexName])
        })

        // Verify routingKey index exists
        const hasRoutingKeyIndex = Object.values(indexes).some(
            (index) => index.routingKey === 1
        )
        if (!hasRoutingKeyIndex) {
            throw new Error("routingKey index not found")
        }
        console.log("✓ routingKey index verified")

        // Verify receivedAt index exists
        const hasReceivedAtIndex = Object.values(indexes).some(
            (index) => index.receivedAt === 1
        )
        if (!hasReceivedAtIndex) {
            throw new Error("receivedAt index not found")
        }
        console.log("✓ receivedAt index verified")

        // Test 8: Query by routingKey (test index usage)
        console.log("\nTest 8: Testing query by routingKey...")
        const orgEvents = await Event.find({
            routingKey: "organization.created",
        })
        console.log("✓ Found", orgEvents.length, "event(s) with routingKey")

        // Test 9: Query by receivedAt (test index usage)
        console.log("\nTest 9: Testing query by receivedAt...")
        const recentEvents = await Event.find({
            receivedAt: { $gte: new Date("2024-01-01") },
        })
        console.log("✓ Found", recentEvents.length, "event(s) by date range")

        // Clean up test data
        console.log("\nCleaning up test data...")
        await Event.deleteMany({})
        console.log("✓ Test data cleaned up")

        // Disconnect from database
        console.log("\nDisconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnected\n")

        console.log("=================================")
        console.log("All Event model tests passed! ✓")
        console.log("=================================")
        process.exit(0)
    } catch (error) {
        console.error("\n✗ Test failed:", error.message)
        console.error("Stack:", error.stack)
        await disconnectDatabase()
        process.exit(1)
    }
}

testEventModel()
