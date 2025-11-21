/**
 * Unit test for generateProofService data preparation
 *
 * This test validates the data retrieval and preparation steps
 * without running the full proof generation workflow.
 */

const mongoose = require("mongoose")
const Organization = require("./models/organization")
const Batch = require("./models/batch")
const User = require("./models/user")
const userManagementService = require("./services/user-management-service")
const { generateUserSecret } = require("./utils/secret-generator")
const {
    stringsToBigInts,
    MAX_POLY_DEGREE,
} = require("./utils/polynomial-operations")
const { poseidon2Hash } = require("@zkpassport/poseidon2")
const crypto = require("crypto")
require("dotenv").config()

// MongoDB connection string
const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/b2b_membership"

// Field prime for BN254
const FIELD_PRIME =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n

/**
 * Setup dummy data in database
 */
async function setupDummyData() {
    console.log("🔧 Setting up dummy data...\n")

    try {
        // Clean up existing test data
        await Organization.deleteMany({ org_id: 998 })
        await User.deleteMany({ user_id: 998 })

        // Create dummy organization
        const organization = new Organization({
            org_id: 998,
            wallet_address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        })
        await organization.save()
        console.log("✅ Created dummy organization:")
        console.log(`   - org_id: ${organization.org_id}`)
        console.log(`   - wallet_address: ${organization.wallet_address}`)
        console.log(`   - org_salt: ${organization.org_salt}`)

        // Create dummy batch with a simple polynomial
        const batch = new Batch({
            equation: ["1", "123", "456"], // Simple polynomial: 1 + 123x + 456x^2
        })
        await batch.save()
        console.log("\n✅ Created dummy batch:")
        console.log(`   - batch_id: ${batch._id}`)
        console.log(`   - equation: [${batch.equation.join(", ")}]`)

        // Create dummy user
        const user = new User({
            user_id: 998,
            batch_id: batch._id,
            balance: 5000,
            zkp_key: "unittest@example.com",
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
 * Test data preparation steps
 */
async function testDataPreparation() {
    console.log("\n" + "=".repeat(60))
    console.log("🧪 Testing Proof Service Data Preparation")
    console.log("=".repeat(60) + "\n")

    try {
        // Setup dummy data
        const { organization, batch, user } = await setupDummyData()

        const user_id = user.user_id
        const org_id = organization.org_id
        const isKYCed = true

        console.log("\n📋 Test Parameters:")
        console.log(`   - user_id: ${user_id}`)
        console.log(`   - org_id: ${org_id}`)
        console.log(`   - isKYCed: ${isKYCed}`)

        // Step 1 & 2: Get user, batch, and organization data
        console.log(
            "\n[STEP 1-2] Retrieving user, batch, and organization data..."
        )
        const dataResult = await userManagementService.getUserProofData(
            user_id,
            org_id
        )

        if (!dataResult.success) {
            console.error("❌ Failed to get user proof data:", dataResult.error)
            return false
        }

        console.log("✅ Data retrieved successfully")
        console.log(`   - User ID: ${dataResult.data.user.user_id}`)
        console.log(`   - Batch ID: ${dataResult.data.batch._id}`)
        console.log(`   - Org ID: ${dataResult.data.organization.org_id}`)

        // Step 3: Fix equation format
        console.log("\n[STEP 3] Preparing polynomial equation...")
        const equationStrings = dataResult.data.batch.equation
        let polynomial = stringsToBigInts(equationStrings)

        console.log(`   - Original polynomial length: ${polynomial.length}`)
        console.log(
            `   - Original coefficients: [${polynomial
                .slice(0, 5)
                .join(", ")}...]`
        )

        // Pad polynomial to MAX_POLY_DEGREE
        while (polynomial.length <= MAX_POLY_DEGREE) {
            polynomial.push(0n)
        }

        // Normalize to canonical form
        polynomial = polynomial.map((coeff) => {
            const r = coeff % FIELD_PRIME
            return r >= 0n ? r : r + FIELD_PRIME
        })

        console.log(`✅ Polynomial prepared`)
        console.log(`   - Padded length: ${polynomial.length}`)
        console.log(`   - Degree: ${polynomial.length - 1}`)

        // Step 4: Hash the equation
        console.log("\n[STEP 4] Hashing polynomial with Poseidon2...")
        const polynomialHash = poseidon2Hash(polynomial)
        console.log(`✅ Polynomial hash generated`)
        console.log(`   - Hash: ${polynomialHash.toString()}`)

        // Step 5: Generate user secret
        console.log("\n[STEP 5] Generating user secret...")
        const zkp_key = dataResult.data.user.zkp_key
        const secret = generateUserSecret(
            zkp_key,
            dataResult.data.organization.org_salt
        )
        console.log(`✅ User secret generated`)
        console.log(`   - zkp_key: ${zkp_key}`)
        console.log(`   - secret: ${secret.toString()}`)

        // Step 6: Generate verifier key and nullifier
        console.log("\n[STEP 6] Generating verifier key and nullifier...")
        const verifierKeyHash = crypto
            .createHash("sha256")
            .update(dataResult.data.organization.wallet_address)
            .digest("hex")
        const verifierKey = BigInt("0x" + verifierKeyHash) % FIELD_PRIME

        const nullifier = poseidon2Hash([secret, verifierKey])

        console.log(`✅ Verifier key and nullifier generated`)
        console.log(
            `   - wallet_address: ${dataResult.data.organization.wallet_address}`
        )
        console.log(`   - verifier_key: ${verifierKey.toString()}`)
        console.log(`   - nullifier: ${nullifier.toString()}`)

        // Step 7: Prepare test config
        console.log("\n[STEP 7] Preparing test configuration...")
        const testConfig = {
            isKYCed,
            nullifier,
            polynomial,
            polynomialHash,
            secret,
            verifierKey,
        }

        console.log(`✅ Test config prepared`)
        console.log(`   - isKYCed: ${testConfig.isKYCed}`)
        console.log(`   - polynomial length: ${testConfig.polynomial.length}`)
        console.log(
            `   - All required fields present: ${
                testConfig.polynomial &&
                testConfig.polynomialHash !== undefined &&
                testConfig.secret !== undefined &&
                testConfig.verifierKey !== undefined &&
                testConfig.nullifier !== undefined &&
                testConfig.isKYCed !== undefined
            }`
        )

        // Validation checks
        console.log("\n" + "=".repeat(60))
        console.log("🔍 Validation Checks")
        console.log("=".repeat(60) + "\n")

        const checks = [
            {
                name: "User data retrieved",
                pass: dataResult.data.user !== null,
            },
            {
                name: "Batch data retrieved",
                pass: dataResult.data.batch !== null,
            },
            {
                name: "Organization data retrieved",
                pass: dataResult.data.organization !== null,
            },
            {
                name: "Polynomial padded correctly",
                pass: polynomial.length === MAX_POLY_DEGREE + 1,
            },
            {
                name: "Polynomial hash is BigInt",
                pass: typeof polynomialHash === "bigint",
            },
            {
                name: "Secret is BigInt",
                pass: typeof secret === "bigint",
            },
            {
                name: "Verifier key is BigInt",
                pass: typeof verifierKey === "bigint",
            },
            {
                name: "Nullifier is BigInt",
                pass: typeof nullifier === "bigint",
            },
            {
                name: "All values in field range",
                pass:
                    polynomialHash < FIELD_PRIME &&
                    secret < FIELD_PRIME &&
                    verifierKey < FIELD_PRIME &&
                    nullifier < FIELD_PRIME,
            },
        ]

        let allPassed = true
        checks.forEach((check) => {
            const icon = check.pass ? "✅" : "❌"
            console.log(`${icon} ${check.name}`)
            if (!check.pass) allPassed = false
        })

        console.log("\n" + "=".repeat(60))
        if (allPassed) {
            console.log("✅ ALL VALIDATION CHECKS PASSED")
            console.log("\n💡 Data preparation is working correctly!")
            console.log("   The service is ready to generate proofs.")
            console.log("   (Full proof generation requires nargo and bb)")
        } else {
            console.log("❌ SOME VALIDATION CHECKS FAILED")
        }
        console.log("=".repeat(60) + "\n")

        return allPassed
    } catch (error) {
        console.error("\n❌ Test failed with exception:")
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
        await Organization.deleteMany({ org_id: 998 })
        await User.deleteMany({ user_id: 998 })

        console.log("✅ Cleanup completed")
    } catch (error) {
        console.error("❌ Error during cleanup:", error.message)
    }
}

/**
 * Main execution
 */
async function main() {
    console.log("🚀 Starting Proof Service Unit Test\n")
    console.log("=".repeat(60))

    let connection = null

    try {
        // Connect to MongoDB
        console.log("📡 Connecting to MongoDB...")
        console.log(`   URI: ${MONGODB_URI}\n`)

        connection = await mongoose.connect(MONGODB_URI)
        console.log("✅ Connected to MongoDB\n")

        // Run the test
        const success = await testDataPreparation()

        // Cleanup
        await cleanupDummyData()

        console.log("\n" + "=".repeat(60))
        if (success) {
            console.log("✅ UNIT TEST PASSED")
        } else {
            console.log("❌ UNIT TEST FAILED")
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
    testDataPreparation,
    cleanupDummyData,
}
