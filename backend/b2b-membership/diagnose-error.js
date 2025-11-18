/**
 * Diagnostic script to identify proof generation issues
 *
 * This script checks:
 * 1. Environment configuration
 * 2. Required tools (nargo, bb)
 * 3. Circuit files
 * 4. Test data generator
 */

require("dotenv").config()
const { exec } = require("child_process")
const { promisify } = require("util")
const fs = require("fs").promises
const path = require("path")

const execAsync = promisify(exec)

console.log("========================================")
console.log("ZKP Proof Controller Diagnostics")
console.log("========================================\n")

async function checkEnvironment() {
    console.log("1. Environment Configuration")
    console.log("----------------------------------------")

    const requiredVars = [
        "ALCHEMY_API_KEY",
        "ALCHEMY_NETWORK",
        "HONK_VERIFIER_CONTRACT_ADDRESS",
        "WALLET_PRIVATE_KEY",
    ]

    let allPresent = true
    for (const varName of requiredVars) {
        const value = process.env[varName]
        if (value) {
            console.log(`✓ ${varName}: ${value.substring(0, 10)}...`)
        } else {
            console.log(`✗ ${varName}: NOT SET`)
            allPresent = false
        }
    }

    return allPresent
}

async function checkTools() {
    console.log("\n2. Required Tools")
    console.log("----------------------------------------")

    // Check nargo
    try {
        const { stdout } = await execAsync("nargo --version")
        console.log(`✓ nargo: ${stdout.trim()}`)
    } catch (error) {
        console.log("✗ nargo: NOT FOUND")
        console.log("  Install from: https://noir-lang.org/")
        return false
    }

    // Check bb (Barretenberg)
    try {
        const { stdout } = await execAsync("bb --version")
        console.log(`✓ bb (Barretenberg): ${stdout.trim()}`)
    } catch (error) {
        console.log("✗ bb (Barretenberg): NOT FOUND")
        console.log(
            "  Install from: https://github.com/AztecProtocol/aztec-packages"
        )
        return false
    }

    return true
}

async function checkCircuitFiles() {
    console.log("\n3. Circuit Files")
    console.log("----------------------------------------")

    const basePath = path.join(__dirname, "../../base")
    const circuitPath = path.join(basePath, "circuit")

    const requiredFiles = [
        { path: path.join(circuitPath, "Nargo.toml"), name: "Nargo.toml" },
        { path: path.join(circuitPath, "src/main.nr"), name: "src/main.nr" },
        {
            path: path.join(basePath, "utils/test_data_generator.js"),
            name: "test_data_generator.js",
        },
    ]

    let allPresent = true
    for (const file of requiredFiles) {
        try {
            await fs.access(file.path)
            console.log(`✓ ${file.name}`)
        } catch (error) {
            console.log(`✗ ${file.name}: NOT FOUND`)
            console.log(`  Expected at: ${file.path}`)
            allPresent = false
        }
    }

    return allPresent
}

async function checkTargetDirectory() {
    console.log("\n4. Target Directory")
    console.log("----------------------------------------")

    const targetPath = path.join(__dirname, "../../base/circuit/target")

    try {
        const files = await fs.readdir(targetPath)
        console.log(`✓ Target directory exists`)
        console.log(`  Files: ${files.length}`)
        if (files.length > 0) {
            console.log(`  Contents: ${files.join(", ")}`)
        }
    } catch (error) {
        console.log("✗ Target directory not found")
        console.log(`  Expected at: ${targetPath}`)
        console.log("  This is normal if you haven't generated a proof yet")
    }
}

async function testDataGenerator() {
    console.log("\n5. Test Data Generator")
    console.log("----------------------------------------")

    const basePath = path.join(__dirname, "../../base")
    const generatorPath = path.join(basePath, "utils/test_data_generator.js")

    try {
        console.log("Testing data generator...")
        const { stdout, stderr } = await execAsync(`node ${generatorPath}`, {
            cwd: basePath,
            timeout: 10000,
        })

        console.log("✓ Test data generator executed successfully")
        if (stdout) {
            console.log("  Output:", stdout.trim().substring(0, 100))
        }

        // Check if Prover.toml was created
        const proverTomlPath = path.join(basePath, "circuit/Prover.toml")
        try {
            const contents = await fs.readFile(proverTomlPath, "utf-8")
            console.log("✓ Prover.toml created")
            console.log("  Preview:", contents.substring(0, 200) + "...")
        } catch (error) {
            console.log("✗ Prover.toml not created")
        }

        return true
    } catch (error) {
        console.log("✗ Test data generator failed")
        console.log("  Error:", error.message)
        if (error.stdout) console.log("  Stdout:", error.stdout)
        if (error.stderr) console.log("  Stderr:", error.stderr)
        return false
    }
}

async function runDiagnostics() {
    const envOk = await checkEnvironment()
    const toolsOk = await checkTools()
    const filesOk = await checkCircuitFiles()
    await checkTargetDirectory()
    const generatorOk = await testDataGenerator()

    console.log("\n========================================")
    console.log("Diagnostic Summary")
    console.log("========================================")
    console.log(`Environment: ${envOk ? "✓" : "✗"}`)
    console.log(`Tools: ${toolsOk ? "✓" : "✗"}`)
    console.log(`Circuit Files: ${filesOk ? "✓" : "✗"}`)
    console.log(`Data Generator: ${generatorOk ? "✓" : "✗"}`)

    if (envOk && toolsOk && filesOk && generatorOk) {
        console.log(
            "\n✅ All checks passed! System is ready for proof generation."
        )
    } else {
        console.log("\n❌ Some checks failed. Please fix the issues above.")
    }
}

runDiagnostics().catch((error) => {
    console.error("\nFatal error during diagnostics:", error)
    process.exit(1)
})
