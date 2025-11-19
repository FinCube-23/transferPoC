/**
 * Check if the HonkVerifier contract exists at the deployed address
 */

const { ethers } = require("ethers")
require("dotenv").config()

async function checkContract() {
    try {
        // Initialize provider
        const alchemyApiKey = process.env.ALCHEMY_API_KEY
        const alchemyNetwork = process.env.ALCHEMY_NETWORK || "celo-sepolia"
        const networkName = alchemyNetwork.replace(/_/g, "-")
        const alchemyUrl = `https://${networkName}.g.alchemy.com/v2/${alchemyApiKey}`

        console.log(`Connecting to: ${alchemyUrl}`)
        const provider = new ethers.JsonRpcProvider(alchemyUrl)

        // Get network info
        const network = await provider.getNetwork()
        console.log(`\nConnected to network: ${network.name} (chainId: ${network.chainId})`)

        // Contract address
        const contractAddress = "0x214BF1B713475Fcdb7D13202eB4ac35189dbdc15"
        console.log(`\nChecking contract at: ${contractAddress}`)

        // Check if contract exists
        const code = await provider.getCode(contractAddress)
        console.log(`\nContract code length: ${code.length} characters`)
        console.log(`Contract exists: ${code !== "0x"}`)

        if (code === "0x") {
            console.log("\n❌ ERROR: No contract found at this address!")
            console.log("This means the contract was not deployed to this network, or the address is wrong.")
            console.log("\nPossible solutions:")
            console.log("1. Deploy the HonkVerifier contract to Celo Sepolia")
            console.log("2. Update the contract address in json-log/honk_verifier.json")
            console.log("3. Check if you're connecting to the correct network")
        } else {
            console.log("\n✅ Contract exists at this address")
            console.log(`Code preview: ${code.substring(0, 100)}...`)
        }

    } catch (error) {
        console.error("\n❌ Error:", error.message)
    }
}

checkContract()
