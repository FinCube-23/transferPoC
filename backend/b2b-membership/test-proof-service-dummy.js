/**
 * Test script for generateProofService with dummy data
 *
 * This script creates dummy organization, batch, and user data,
 * then tests the proof generation service.
 */

const mongoose = require("mongoose")
const ProofController = require("./controllers/proof-controller")
const Organization = require("./models/organization")
const Batch = require("./models/batch")
const User = require("./models/user")
const { initial_polynomial } = require("./utils/polynomial-operations")
require("dotenv").config()

// MongoDB connection string
const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/b2b_membership"

/**
 * Setup dummy data in database
 */
async function setupDummyData() {
    console.log("🔧 Setting up dummy data...\n")

    try {
        // Clean up existing test data
        await Organization.deleteMany({ org_id: 999 })
        await User.deleteMany({ user_id: 999 })
        await Batch.deleteMany({ _id: { $exists: true } })

        // Create dummy organization
        const organization = new Organization({
            org_id: 999,
            wallet_address: "0x1234567890123456789012345678901234567890",
            // org_salt will be auto-generated
        })
        await organization.save()
        console.log("✅ Created dummy organization:")
        console.log(`   - org_id: ${organization.org_id}`)
        console.log(`   - wallet_address: ${organization.wallet_address}`)
        console.log(`   - org_salt: ${organization.org_salt}`)

        // Create dummy batch with initial polynomial
        const batch = new Batch({
            equation: initial_polynomial, // ["1"]
        })
        await batch.save()
        console.log("\n✅ Created dummy batch:")
        console.log(`   - batch_id: ${batch._id}`)
        console.log(`   - equation: ${batch.equation}`)

        // Create dummy user
        const user = new User({
            user_id: 999,
            batch_id: batch._id,
            balance: 1000,
            zkp_key: "test@example.com", // This is the email
        })
        await user.save()
        console.log("\n✅ Created dummy user:")
        console.log(`   - user_id: ${user.user_id}`)
        console.log(`   - batch_id: ${user.batch_id}`)
        console.log(`   - zkp_key: ${user.zkp_key}`)
        console.log(`   - balance: ${user.balance}`)

        return {
            organization,
            batch,
            user,
        }
    } catch (error) {
        console.error("❌ Error setting up dummy data:", error.message)
        throw error
    }
}

/**
 * Test generateProofService
 */
async function testGenerateProofService() {
    console.log("\n" + "=".repeat(60))
    console.log("🧪 Testing generateProofService")
    console.log("=".repeat(60) + "\n")

    try {
        // Setup dummy data
        const { organization, batch, user } = await setupDummyData()

        // Create ProofController instance
        const proofController = new ProofController()

        // Test parameters
        const user_id = user.user_id
        const org_id = organization.org_id
        const isKYCed = true

        console.log("\n📤 Calling generateProofService with:")
        console.log(`   - user_id: ${user_id}`)
        console.log(`   - org_id: ${org_id}`)
        console.log(`   - isKYCed: ${isKYCed}`)

        console.log("\n⏳ Generating proof (this may take a few minutes)...\n")

        const startTime = Date.now()

        // Call the service
        const result = await proofController.generateProofService(
            user_id,
            org_id,
            isKYCed
        )

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)

        console.log("\n" + "=".repeat(60))
        console.log("📊 Test Results")
        console.log("=".repeat(60) + "\n")

        if (result.success) {
            console.log("✅ Proof generation SUCCESSFUL!")
            console.log(`\n⏱️  Total time: ${duration}s`)
            console.log("\n📋 Result details:")
            console.log(`   - Success: ${result.success}`)
            console.log(
                `   - Proof length: ${result.proof?.length || 0} characters`
            )
            console.log(
                `   - Public inputs count: ${result.publicInputs?.length || 0}`
            )

            if (result.publicInputs && result.publicInputs.length > 0) {
                console.log("\n🔢 Public Inputs:")
                result.publicInputs.forEach((input, index) => {
                    console.log(`   [${index}]: ${input}`)
                })
            }

            if (result.proof) {
                console.log("\n🔐 Proof (first 100 chars):")
                console.log(`   ${result.proof.substring(0, 100)}...`)
            }

            console.log("\n✅ All tests passed!")
            return true
        } else {
            console.log("❌ Proof generation FAILED!")
            console.log(`\n⏱️  Time before failure: ${duration}s`)
            console.log("\n❌ Error details:")
            console.log(`   - Type: ${result.error?.type}`)
            console.log(`   - Message: ${result.error?.message}`)

            if (result.error?.details) {
                console.log("\n📋 Error details:")
                console.log(JSON.stringify(result.error.details, null, 2))
            }

            return false
        }
    } catch (error) {
        console.log("\n❌ Test failed with exception:")
        console.error(error)
        return false
    }
}

/**
 * Cleanup dummy data
 */
async function cleanupDummyData() {
    console.log("\n🧹 Cleaning up dummy data...")

    try {
        await Organization.deleteMany({ org_id: 999 })
        await User.deleteMany({ user_id: 999 })
        // Note: We don't delete the batch as it might be referenced by other users

        console.log("✅ Cleanup completed")
    } catch (error) {
        console.error("❌ Error during cleanup:", error.message)
    }
}

/**
 * Main execution
 */
async function main() {
    console.log("🚀 Starting Proof Service Test with Dummy Data\n")
    console.log("=".repeat(60))

    let connection = null

    try {
        // Connect to MongoDB
        console.log("📡 Connecting to MongoDB...")
        console.log(`   URI: ${MONGODB_URI}\n`)

        connection = await mongoose.connect(MONGODB_URI)
        console.log("✅ Connected to MongoDB\n")

        // Run the test
        const success = await testGenerateProofService()

        // Cleanup
        await cleanupDummyData()

        console.log("\n" + "=".repeat(60))
        if (success) {
            console.log("✅ TEST SUITE PASSED")
        } else {
            console.log("❌ TEST SUITE FAILED")
        }
        console.log("=".repeat(60) + "\n")

        process.exit(success ? 0 : 1)
    } catch (error) {
        console.error("\n❌ Fatal error:", error.message)
        console.error(error.stack)

        // Attempt cleanup even on error
        try {
            await cleanupDummyData()
        } catch (cleanupError) {
            console.error("❌ Cleanup failed:", cleanupError.message)
        }

        process.exit(1)
    } finally {
        // Close MongoDB connection
        if (connection) {
            await mongoose.connection.close()
            console.log("📡 MongoDB connection closed")
        }
    }
}

// Run if executed directly
if (require.main === module) {
    main()
}

module.exports = {
    setupDummyData,
    testGenerateProofService,
    cleanupDummyData,
}
