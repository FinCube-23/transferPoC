/**
 * Setup Verification Script
 *
 * Verifies that all required dependencies and configuration are in place
 */

const fs = require("fs")
const path = require("path")

console.log("🔍 Verifying ZKP Proof Controller Setup...\n")

let allChecksPass = true

// Check 1: Required files exist
console.log("📁 Checking required files...")
const requiredFiles = [
    "index.js",
    "package.json",
    ".env",
    ".env.example",
    "config/config.js",
    "controllers/proof-controller.js",
    "routes/proof-routes.js",
    "models/honk-verifier.js",
]

requiredFiles.forEach((file) => {
    const exists = fs.existsSync(path.join(__dirname, file))
    console.log(`  ${exists ? "✓" : "✗"} ${file}`)
    if (!exists) allChecksPass = false
})

// Check 2: Required dependencies
console.log("\n📦 Checking required dependencies...")
const packageJson = require("./package.json")
const requiredDeps = ["express", "cors", "ethers", "dotenv"]

requiredDeps.forEach((dep) => {
    const installed = packageJson.dependencies && packageJson.dependencies[dep]
    console.log(
        `  ${installed ? "✓" : "✗"} ${dep} ${installed ? `(${installed})` : ""}`
    )
    if (!installed) allChecksPass = false
})

// Check 3: Environment variables
console.log("\n🔐 Checking environment configuration...")
require("dotenv").config()

const requiredEnvVars = [
    "ALCHEMY_API_KEY",
    "HONK_VERIFIER_CONTRACT_ADDRESS",
    "WALLET_PRIVATE_KEY",
]

requiredEnvVars.forEach((envVar) => {
    const configured = process.env[envVar] && process.env[envVar].length > 0
    console.log(
        `  ${configured ? "✓" : "⚠"} ${envVar} ${
            configured ? "(configured)" : "(not configured)"
        }`
    )
    // Don't fail on env vars as they may not be set yet
})

// Check 4: Syntax validation
console.log("\n✨ Checking syntax...")
try {
    require("./controllers/proof-controller.js")
    require("./routes/proof-routes.js")
    require("./config/config.js")
    console.log("  ✓ All modules load successfully")
} catch (error) {
    console.log(`  ✗ Syntax error: ${error.message}`)
    allChecksPass = false
}

// Summary
console.log("\n" + "=".repeat(50))
if (allChecksPass) {
    console.log("✅ Setup verification PASSED")
    console.log("\nNext steps:")
    console.log("1. Configure environment variables in .env")
    console.log("2. Run: npm start")
    console.log("3. Test: curl http://localhost:8000/health")
} else {
    console.log("❌ Setup verification FAILED")
    console.log("\nPlease fix the issues above before proceeding.")
    process.exit(1)
}
