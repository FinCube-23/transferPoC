/**
 * Script to check index details
 */

const { connectDatabase, disconnectDatabase } = require("./utils/database")
const mongoose = require("mongoose")

async function checkIndexes() {
    try {
        await connectDatabase()

        const db = mongoose.connection.db
        const collection = db.collection("users")

        console.log("Checking indexes on users collection:\n")
        const indexes = await collection.indexes()

        indexes.forEach((index, i) => {
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
