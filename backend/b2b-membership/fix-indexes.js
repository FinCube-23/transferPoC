/**
 * Script to fix database indexes
 * Drops existing indexes and recreates them with correct configuration
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const User = require("./models/user")
const Organization = require("./models/organization")

async function fixIndexes() {
    console.log("Fixing database indexes...\n")

    try {
        await connectDatabase()

        // Drop all indexes on User collection
        console.log("Dropping existing indexes on User collection...")
        await User.collection.dropIndexes()
        console.log("✓ User indexes dropped\n")

        // Recreate indexes from schema
        console.log("Recreating User indexes from schema...")
        await User.syncIndexes()
        console.log("✓ User indexes recreated\n")

        // List current indexes
        console.log("Current indexes on User collection:")
        const userIndexes = await User.collection.getIndexes()
        console.log(JSON.stringify(userIndexes, null, 2))

        // Drop all indexes on Organization collection
        console.log("\nDropping existing indexes on Organization collection...")
        await Organization.collection.dropIndexes()
        console.log("✓ Organization indexes dropped\n")

        // Recreate indexes from schema
        console.log("Recreating Organization indexes from schema...")
        await Organization.syncIndexes()
        console.log("✓ Organization indexes recreated\n")

        // List current indexes
        console.log("Current indexes on Organization collection:")
        const orgIndexes = await Organization.collection.getIndexes()
        console.log(JSON.stringify(orgIndexes, null, 2))

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
