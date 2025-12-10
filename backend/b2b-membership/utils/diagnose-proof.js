/**
 * Diagnostic script to check proof generation and verification
 */

const fs = require("fs")
const path = require("path")

console.log("🔍 Diagnosing Proof Generation and Verification\n")

// Check if proof artifacts exist
const circuitPath = path.join(__dirname, "../base/circuit")
const targetPath = path.join(circuitPath, "target")

console.log("📁 Checking circuit artifacts...")
console.log(`Circuit path: ${circuitPath}`)
console.log(`Target path: ${targetPath}\n`)

try {
    const files = fs.readdirSync(targetPath)
    console.log("Files in target directory:")
    files.forEach((file) => {
        const stats = fs.statSync(path.join(targetPath, file))
        console.log(`  - ${file} (${stats.size} bytes)`)
    })

    // Check for required files
    const requiredFiles = ["proof", "vk", "public_inputs"]
    const jsonFiles = files.filter((f) => f.endsWith(".json"))
    const gzFiles = files.filter((f) => f.endsWith(".gz"))

    console.log("\n✅ Required artifacts:")
    console.log(
        `  - Bytecode (.json): ${jsonFiles.length > 0 ? "✓" : "✗"} ${
            jsonFiles[0] || "missing"
        }`
    )
    console.log(
        `  - Witness (.gz): ${gzFiles.length > 0 ? "✓" : "✗"} ${
            gzFiles[0] || "missing"
        }`
    )
    requiredFiles.forEach((file) => {
        const exists = files.includes(file)
        console.log(`  - ${file}: ${exists ? "✓" : "✗"}`)
    })

    // Read and display proof info
    if (files.includes("proof")) {
        const proofPath = path.join(targetPath, "proof")
        const proofData = fs.readFileSync(proofPath)
        console.log(`\n📊 Proof information:`)
        console.log(`  Size: ${proofData.length} bytes`)
        console.log(
            `  First 32 bytes (hex): ${proofData.slice(0, 32).toString("hex")}`
        )
    }

    // Read and display public inputs
    if (files.includes("public_inputs")) {
        const publicInputsPath = path.join(targetPath, "public_inputs")
        const publicInputsData = fs.readFileSync(publicInputsPath)
        const numInputs = publicInputsData.length / 32
        console.log(`\n📊 Public inputs information:`)
        console.log(`  Size: ${publicInputsData.length} bytes`)
        console.log(`  Number of inputs: ${numInputs}`)

        // Display each input
        for (let i = 0; i < Math.min(numInputs, 5); i++) {
            const input = publicInputsData.slice(i * 32, (i + 1) * 32)
            console.log(`  Input ${i}: 0x${input.toString("hex")}`)
        }
        if (numInputs > 5) {
            console.log(`  ... and ${numInputs - 5} more`)
        }
    }

    // Read Prover.toml to see what inputs were used
    const proverTomlPath = path.join(circuitPath, "Prover.toml")
    if (fs.existsSync(proverTomlPath)) {
        console.log(`\n📄 Prover.toml contents (first 500 chars):`)
        const proverToml = fs.readFileSync(proverTomlPath, "utf-8")
        console.log(proverToml.substring(0, 500))
        if (proverToml.length > 500) {
            console.log("...(truncated)")
        }
    }

    console.log("\n💡 Recommendations:")
    console.log(
        "1. Ensure the circuit was compiled with the same parameters as the deployed contract"
    )
    console.log(
        "2. Verify the verification key matches between local and deployed contract"
    )
    console.log("3. Check that the test data satisfies all circuit constraints")
    console.log(
        "4. Try generating a proof with the exact same data used during contract deployment"
    )
} catch (error) {
    console.error("❌ Error:", error.message)
    console.log("\n💡 Make sure you have generated a proof first:")
    console.log(
        "   curl -X POST http://localhost:8000/api/proof/generate -H \"Content-Type: application/json\" -d '{}'"
    )
}
