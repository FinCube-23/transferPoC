/**
 * Simple verification script for Event model structure
 * This doesn't require database connection
 */

const Event = require("./models/event")

console.log("Verifying Event model structure...\n")

// Check if model is exported correctly
if (!Event) {
    console.error("✗ Event model not exported")
    process.exit(1)
}
console.log("✓ Event model exported successfully")

// Check schema structure
const schema = Event.schema
console.log("\n✓ Schema structure:")
console.log("  - routingKey:", schema.paths.routingKey)
console.log("  - payload:", schema.paths.payload)
console.log("  - receivedAt:", schema.paths.receivedAt)
console.log("  - processedAt:", schema.paths.processedAt)
console.log("  - status:", schema.paths.status)
console.log("  - error:", schema.paths.error)

// Check required fields
console.log("\n✓ Required fields:")
console.log("  - routingKey required:", schema.paths.routingKey.isRequired)
console.log("  - payload required:", schema.paths.payload.isRequired)

// Check indexes
console.log("\n✓ Indexes defined:")
const indexes = schema.indexes()
indexes.forEach((index, i) => {
    console.log(`  - Index ${i + 1}:`, JSON.stringify(index))
})

// Verify routingKey index
const hasRoutingKeyIndex = indexes.some((index) => index[0].routingKey)
if (!hasRoutingKeyIndex) {
    console.error("✗ routingKey index not found")
    process.exit(1)
}
console.log("✓ routingKey index verified")

// Verify receivedAt index
const hasReceivedAtIndex = indexes.some((index) => index[0].receivedAt)
if (!hasReceivedAtIndex) {
    console.error("✗ receivedAt index not found")
    process.exit(1)
}
console.log("✓ receivedAt index verified")

// Check status enum
console.log("\n✓ Status enum values:")
const statusEnum = schema.paths.status.enumValues
console.log("  - Values:", statusEnum)
if (
    !statusEnum.includes("received") ||
    !statusEnum.includes("processing") ||
    !statusEnum.includes("completed") ||
    !statusEnum.includes("failed")
) {
    console.error("✗ Status enum values incorrect")
    process.exit(1)
}
console.log("✓ Status enum verified")

// Check default values
console.log("\n✓ Default values:")
console.log("  - status default:", schema.paths.status.defaultValue)
console.log(
    "  - receivedAt default:",
    schema.paths.receivedAt.defaultValue ? "Date.now" : "none"
)

// Check timestamps option
console.log("\n✓ Timestamps option:", schema.options.timestamps)

console.log("\n=================================")
console.log("Event model structure verified! ✓")
console.log("=================================")
