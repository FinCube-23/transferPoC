/**
 * Test script for Event Store utility functions
 *
 * This script verifies that the storeEvent and updateEventStatus functions
 * work correctly with error handling and logging.
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const { storeEvent, updateEventStatus } = require("./utils/event-store")
const Event = require("./models/event")

async function testEventStore() {
    console.log("Testing Event Store functions...\n")

    try {
        // Connect to database
        console.log("Connecting to database...")
        await connectDatabase()
        console.log("✓ Connected\n")

        // Clean up any existing test data
        console.log("Cleaning up any existing test data...")
        await Event.deleteMany({})
        console.log("✓ Cleaned up\n")

        // Test 1: Store event with valid data
        console.log("Test 1: Storing event with valid data...")
        const event1 = await storeEvent("organization.created", {
            eventType: "organization.created",
            timestamp: new Date().toISOString(),
            data: {
                org_id: 1001,
                wallet_address: "0x1234567890123456789012345678901234567890",
            },
        })
        console.log("✓ Event stored successfully")
        console.log("  - Event ID:", event1._id.toString())
        console.log("  - Routing Key:", event1.routingKey)
        console.log("  - Status:", event1.status)
        console.log("  - Received At:", event1.receivedAt)

        // Verify default status is 'received'
        if (event1.status !== "received") {
            throw new Error('Default status should be "received"')
        }
        console.log("✓ Default status verified")

        // Test 2: Store event with different routing key
        console.log("\nTest 2: Storing event with different routing key...")
        const event2 = await storeEvent("organization.user.created", {
            eventType: "organization.user.created",
            data: { user_id: 2001 },
        })
        console.log("✓ Event stored successfully")
        console.log("  - Event ID:", event2._id.toString())
        console.log("  - Routing Key:", event2.routingKey)

        // Test 3: Update event status to 'processing'
        console.log('\nTest 3: Updating event status to "processing"...')
        const updated1 = await updateEventStatus(
            event1._id.toString(),
            "processing"
        )
        console.log("✓ Event status updated")
        console.log("  - Status:", updated1.status)
        console.log("  - Processed At:", updated1.processedAt)

        // Verify processedAt is not set for 'processing' status
        if (updated1.processedAt) {
            throw new Error(
                'processedAt should not be set for "processing" status'
            )
        }
        console.log('✓ processedAt correctly not set for "processing" status')

        // Test 4: Update event status to 'completed'
        console.log('\nTest 4: Updating event status to "completed"...')
        const updated2 = await updateEventStatus(
            event1._id.toString(),
            "completed"
        )
        console.log("✓ Event status updated")
        console.log("  - Status:", updated2.status)
        console.log("  - Processed At:", updated2.processedAt)

        // Verify processedAt is set for 'completed' status
        if (!updated2.processedAt) {
            throw new Error('processedAt should be set for "completed" status')
        }
        console.log('✓ processedAt correctly set for "completed" status')

        // Test 5: Update event status to 'failed' with error message
        console.log(
            '\nTest 5: Updating event status to "failed" with error message...'
        )
        const updated3 = await updateEventStatus(
            event2._id.toString(),
            "failed",
            "Database connection timeout"
        )
        console.log("✓ Event status updated")
        console.log("  - Status:", updated3.status)
        console.log("  - Error:", updated3.error)
        console.log("  - Processed At:", updated3.processedAt)

        // Verify error message is stored
        if (updated3.error !== "Database connection timeout") {
            throw new Error("Error message not stored correctly")
        }
        console.log("✓ Error message stored correctly")

        // Verify processedAt is set for 'failed' status
        if (!updated3.processedAt) {
            throw new Error('processedAt should be set for "failed" status')
        }
        console.log('✓ processedAt correctly set for "failed" status')

        // Test 6: Store event with complex payload
        console.log("\nTest 6: Storing event with complex nested payload...")
        const event3 = await storeEvent("ums.sync", {
            eventType: "ums.sync",
            timestamp: new Date().toISOString(),
            data: {
                organizations: [
                    { org_id: 1001, name: "Org 1" },
                    { org_id: 1002, name: "Org 2" },
                ],
                users: [
                    { user_id: 2001, org_id: 1001 },
                    { user_id: 2002, org_id: 1002 },
                ],
                metadata: {
                    sync_type: "full",
                    total_records: 4,
                },
            },
        })
        console.log("✓ Event with complex payload stored successfully")
        console.log("  - Event ID:", event3._id.toString())

        // Test 7: Attempt to update non-existent event
        console.log("\nTest 7: Attempting to update non-existent event...")
        try {
            await updateEventStatus("507f1f77bcf86cd799439011", "completed")
            console.log("✗ Should have thrown error for non-existent event")
            process.exit(1)
        } catch (error) {
            if (error.message.includes("Event not found")) {
                console.log("✓ Correctly threw error for non-existent event")
            } else {
                throw error
            }
        }

        // Test 8: Verify events can be queried
        console.log("\nTest 8: Querying stored events...")
        const allEvents = await Event.find({})
        console.log("✓ Found", allEvents.length, "event(s) in database")

        if (allEvents.length !== 3) {
            throw new Error(`Expected 3 events, found ${allEvents.length}`)
        }
        console.log("✓ Event count verified")

        // Test 9: Query events by routing key
        console.log("\nTest 9: Querying events by routing key...")
        const orgEvents = await Event.find({
            routingKey: "organization.created",
        })
        console.log(
            "✓ Found",
            orgEvents.length,
            'event(s) with routing key "organization.created"'
        )

        if (orgEvents.length !== 1) {
            throw new Error(`Expected 1 event, found ${orgEvents.length}`)
        }
        console.log("✓ Routing key query verified")

        // Test 10: Query events by status
        console.log("\nTest 10: Querying events by status...")
        const failedEvents = await Event.find({ status: "failed" })
        console.log(
            "✓ Found",
            failedEvents.length,
            'event(s) with status "failed"'
        )

        if (failedEvents.length !== 1) {
            throw new Error(
                `Expected 1 failed event, found ${failedEvents.length}`
            )
        }
        console.log("✓ Status query verified")

        // Clean up test data
        console.log("\nCleaning up test data...")
        await Event.deleteMany({})
        console.log("✓ Test data cleaned up")

        // Disconnect from database
        console.log("\nDisconnecting from database...")
        await disconnectDatabase()
        console.log("✓ Disconnected\n")

        console.log("=================================")
        console.log("All Event Store tests passed! ✓")
        console.log("=================================")
        process.exit(0)
    } catch (error) {
        console.error("\n✗ Test failed:", error.message)
        console.error("Stack:", error.stack)
        await disconnectDatabase()
        process.exit(1)
    }
}

testEventStore()
