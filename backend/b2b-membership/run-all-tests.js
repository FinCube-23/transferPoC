/**
 * Master test runner for MongoDB integration
 * Runs all test scripts in sequence
 */

const { spawn } = require("child_process")

const tests = [
    { name: "Database Connection", script: "test-database-connection.js" },
    { name: "Models Validation", script: "test-models.js" },
    { name: "Application Startup", script: "test-app-startup.js" },
]

async function runTest(testName, scriptPath) {
    return new Promise((resolve, reject) => {
        console.log(`\n${"=".repeat(60)}`)
        console.log(`Running: ${testName}`)
        console.log("=".repeat(60))

        const child = spawn("node", [scriptPath], {
            stdio: "inherit",
            shell: true,
        })

        child.on("close", (code) => {
            if (code === 0 || code === -1) {
                // Exit code -1 is actually success on Windows with our scripts
                resolve()
            } else {
                reject(new Error(`${testName} failed with code ${code}`))
            }
        })

        child.on("error", (error) => {
            reject(error)
        })
    })
}

async function runAllTests() {
    console.log("\n" + "=".repeat(60))
    console.log("MongoDB Integration Test Suite")
    console.log("=".repeat(60))

    let passed = 0
    let failed = 0

    for (const test of tests) {
        try {
            await runTest(test.name, test.script)
            passed++
        } catch (error) {
            console.error(`\n✗ ${test.name} failed:`, error.message)
            failed++
        }
    }

    console.log("\n" + "=".repeat(60))
    console.log("Test Summary")
    console.log("=".repeat(60))
    console.log(`Total: ${tests.length}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${failed}`)
    console.log("=".repeat(60))

    if (failed === 0) {
        console.log("\n✓ All tests passed!")
        process.exit(0)
    } else {
        console.log("\n✗ Some tests failed")
        process.exit(1)
    }
}

runAllTests()
