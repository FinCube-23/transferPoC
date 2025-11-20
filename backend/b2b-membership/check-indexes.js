/**
 * Script to check index details
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const mongoose = require("mongoose")

async function checkIndexes() {
    try {
        await connectDatabase()

        const db = mongoose.connection.db

        // Check users collection
        const usersCollection = db.collection("users")
        console.log("Checking indexes on users collection:\n")
        const userIndexes = await usersCollection.indexes()

        userIndexes.forEach((index, i) => {
            console.log(`Index ${i + 1}:`)
            console.log("  Name:", index.name)
            console.log("  Key:", JSON.stringify(index.key))
            console.log("  Unique:", index.unique || false)
            console.log("  Sparse:", index.sparse || false)
            console.log("")
        })

        // Check organizations collection
        const orgsCollection = db.collection("organizations")
        console.log("\nChecking indexes on organizations collection:\n")
        const orgIndexes = await orgsCollection.indexes()

        orgIndexes.forEach((index, i) => {
            console.log(`Index ${i + 1}:`)
            console.log("  Name:", index.name)
            console.log("  Key:", JSON.stringify(index.key))
            console.log("  Unique:", index.unique || false)
            console.log("  Sparse:", index.sparse || false)
            console.log("")
        })

        await disconnectDatabase()
        process.exit(0)
    } catch (error) {
        console.error("Error:", error.message)
        await disconnectDatabase()
        process.exit(1)
    }
}

checkIndexes()
