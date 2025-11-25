/**
 * Test Query API
 *
 * Tests the query endpoints for retrieving users and organizations
 */

const axios = require("axios")

const BASE_URL = "http://localhost:7000"

// ANSI color codes for terminal output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
}

function log(message, color = "reset") {
    console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
    console.log("\n" + "=".repeat(60))
    log(title, "cyan")
    console.log("=".repeat(60))
}

async function testGetUserById(userId) {
    logSection(`Test: Get User by ID (${userId})`)

    try {
        const response = await axios.get(`${BASE_URL}/api/query/user/${userId}`)

        log("✅ Success", "green")
        console.log("\nResponse:")
        console.log(JSON.stringify(response.data, null, 2))

        if (response.data.success && response.data.user) {
            const user = response.data.user
            log("\nUser Details:", "blue")
            console.log(`  User ID: ${user.user_id}`)
            console.log(`  Balance: ${user.balance}`)
            console.log(`  Reference Number: ${user.reference_number || "N/A"}`)
            console.log(`  ZKP Key: ${user.zkp_key}`)

            if (user.batch_id) {
                log("\n  Batch Details:", "blue")
                console.log(`    Batch ID: ${user.batch_id._id}`)
                console.log(
                    `    Equation: [${user.batch_id.equation.slice(0, 3).join(", ")}...]`
                )
            }

            if (user.organization) {
                log("\n  Organization Details:", "blue")
                console.log(`    Org ID: ${user.organization.org_id}`)
                console.log(
                    `    Wallet Address: ${user.organization.wallet_address}`
                )
                console.log(`    Org Salt: ${user.organization.org_salt}`)
            } else {
                log("\n  Organization: Not associated", "yellow")
            }
        }

        return response.data
    } catch (error) {
        log("❌ Error", "red")
        if (error.response) {
            console.log("\nError Response:")
            console.log(JSON.stringify(error.response.data, null, 2))
        } else {
            console.log("\nError:", error.message)
        }
        return null
    }
}

async function testGetOrganizationById(orgId) {
    logSection(`Test: Get Organization by ID (${orgId})`)

    try {
        const response = await axios.get(
            `${BASE_URL}/api/query/organization/${orgId}`
        )

        log("✅ Success", "green")
        console.log("\nResponse:")
        console.log(JSON.stringify(response.data, null, 2))

        if (response.data.success && response.data.organization) {
            const org = response.data.organization
            log("\nOrganization Details:", "blue")
            console.log(`  Org ID: ${org.org_id}`)
            console.log(`  Wallet Address: ${org.wallet_address}`)
            console.log(`  Org Salt: ${org.org_salt}`)

            if (org.users && org.users.length > 0) {
                log(`\n  Associated Users (${org.users.length}):`, "blue")
                org.users.forEach((user, index) => {
                    console.log(`\n  User ${index + 1}:`)
                    console.log(`    User ID: ${user.user_id}`)
                    console.log(`    Balance: ${user.balance}`)
                    console.log(
                        `    Reference Number: ${user.reference_number || "N/A"}`
                    )
                    console.log(`    ZKP Key: ${user.zkp_key}`)
                    if (user.batch_id) {
                        console.log(`    Batch ID: ${user.batch_id._id}`)
                    }
                })
            } else {
                log("\n  Associated Users: None", "yellow")
            }
        }

        return response.data
    } catch (error) {
        log("❌ Error", "red")
        if (error.response) {
            console.log("\nError Response:")
            console.log(JSON.stringify(error.response.data, null, 2))
        } else {
            console.log("\nError:", error.message)
        }
        return null
    }
}

async function testInvalidInputs() {
    logSection("Test: Invalid Inputs")

    // Test invalid user_id
    log("\n1. Testing invalid user_id (string):", "yellow")
    try {
        await axios.get(`${BASE_URL}/api/query/user/invalid`)
    } catch (error) {
        if (error.response && error.response.status === 400) {
            log("✅ Correctly rejected invalid user_id", "green")
            console.log(JSON.stringify(error.response.data, null, 2))
        }
    }

    // Test non-existent user
    log("\n2. Testing non-existent user_id (99999):", "yellow")
    try {
        await axios.get(`${BASE_URL}/api/query/user/99999`)
    } catch (error) {
        if (error.response && error.response.status === 404) {
            log("✅ Correctly returned 404 for non-existent user", "green")
            console.log(JSON.stringify(error.response.data, null, 2))
        }
    }

    // Test invalid org_id
    log("\n3. Testing invalid org_id (negative):", "yellow")
    try {
        await axios.get(`${BASE_URL}/api/query/organization/-1`)
    } catch (error) {
        if (error.response && error.response.status === 400) {
            log("✅ Correctly rejected invalid org_id", "green")
            console.log(JSON.stringify(error.response.data, null, 2))
        }
    }

    // Test non-existent organization
    log("\n4. Testing non-existent org_id (99999):", "yellow")
    try {
        await axios.get(`${BASE_URL}/api/query/organization/99999`)
    } catch (error) {
        if (error.response && error.response.status === 404) {
            log(
                "✅ Correctly returned 404 for non-existent organization",
                "green"
            )
            console.log(JSON.stringify(error.response.data, null, 2))
        }
    }
}

async function runAllTests() {
    logSection("Query API Test Suite")
    log("Testing query endpoints for users and organizations\n", "cyan")

    // Get test IDs from command line or use defaults
    const userId = process.argv[2] || 2001
    const orgId = process.argv[3] || 1001

    // Test 1: Get user by ID
    await testGetUserById(userId)

    // Test 2: Get organization by ID
    await testGetOrganizationById(orgId)

    // Test 3: Invalid inputs
    await testInvalidInputs()

    logSection("Test Suite Complete")
    log(
        "\nUsage: node test-query-api.js [user_id] [org_id]",
        "cyan"
    )
    log("Example: node test-query-api.js 2001 1001\n", "cyan")
}

// Run tests
runAllTests().catch((error) => {
    log("\n❌ Test suite failed:", "red")
    console.error(error)
    process.exit(1)
})
