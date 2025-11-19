/**
 * Script to fix database indexes
 * Drops existing indexes and recreates them with correct configuration
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const User = require("./models/user")

async function fixIndexes() {
    console.log("Fixing database indexes...\n")

    try {
        await connectDatabase()

        // Drop all indexes on User collection
        console.log("Dropping existing indexes on User collection...")
        await User.collection.dropIndexes()
        console.log("✓ Indexes dropped\n")

        // Recreate indexes from schema
        console.log("Recreating indexes from schema...")
        await User.syncIndexes()
        console.log("✓ Indexes recreated\n")

        // List current indexes
        console.log("Current indexes on User collection:")
        const indexes = await User.collection.getIndexes()
        console.log(JSON.stringify(indexes, null, 2))

        await disconnectDatabase()
        console.log("\n✓ Index fix complete")
        process.exit(0)
    } catch (error) {
        console.error("✗ Error:", error.message)
        await disconnectDatabase()
        process.exit(1)
    }
}

fixIndexes()
