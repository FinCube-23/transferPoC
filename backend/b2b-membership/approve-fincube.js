/**
 * Approve FinCube Contract Script
 * 
 * This script approves the FinCube contract to spend your ERC20 tokens
 * 
 * Usage: node approve-fincube.js <amount>
 * Example: node approve-fincube.js 1000
 */

const { ethers } = require("ethers")
require("dotenv").config()

// ERC20 ABI
const ERC20_ABI = [
    "function decimals() external view returns (uint8)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function symbol() external view returns (string)",
]

// FinCube ABI
const FINCUBE_ABI = [
    "function approvedERC20() external view returns (address)",
]

async function main() {
    try {
        // Get amount from command line
        const amount = process.argv[2]
        if (!amount) {
            console.error("❌ Please provide an amount to approve")
            console.log("Usage: node approve-fincube.js <amount>")
            console.log("Example: node approve-fincube.js 1000")
            process.exit(1)
        }

        // Get environment variables
        const alchemyUrl = process.env.ALCHEMY_URL
        const privateKey = process.env.WALLET_PRIVATE_KEY
        const finCubeAddress = process.env.FINCUBE_CONTRACT_ADDRESS

        if (!alchemyUrl || !privateKey || !finCubeAddress) {
            throw new Error("Missing required environment variables")
        }

        // Setup provider and wallet
        const provider = new ethers.JsonRpcProvider(alchemyUrl)
        const wallet = new ethers.Wallet(privateKey, provider)
        
        console.log("=".repeat(60))
        console.log("Wallet Address:", wallet.address)
        console.log("FinCube Contract:", finCubeAddress)
        console.log("=".repeat(60))

        // Get FinCube contract
        const finCubeContract = new ethers.Contract(
            finCubeAddress,
            FINCUBE_ABI,
            provider
        )

        // Get approved ERC20 token address
        const tokenAddress = await finCubeContract.approvedERC20()
        console.log("\nApproved ERC20 Token:", tokenAddress)

        // Get token contract with signer
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            wallet
        )

        // Get token info
        const [decimals, symbol] = await Promise.all([
            tokenContract.decimals(),
            tokenContract.symbol(),
        ])

        console.log("Token Symbol:", symbol)
        console.log("Token Decimals:", decimals)

        // Convert amount to token units
        const amountInUnits = ethers.parseUnits(amount, decimals)
        
        console.log("\n" + "=".repeat(60))
        console.log("Approving FinCube Contract...")
        console.log("  Amount:", amount, symbol)
        console.log("  Units:", amountInUnits.toString())
        console.log("=".repeat(60))

        // Approve
        const tx = await tokenContract.approve(finCubeAddress, amountInUnits)
        console.log("\n⏳ Transaction sent:", tx.hash)
        console.log("Waiting for confirmation...")

        const receipt = await tx.wait()
        
        console.log("\n✅ Approval successful!")
        console.log("  Block number:", receipt.blockNumber)
        console.log("  Gas used:", receipt.gasUsed.toString())
        console.log("\nFinCube contract can now spend up to", amount, symbol, "from your wallet")
        console.log("=".repeat(60))

    } catch (error) {
        console.error("\n❌ Error:", error.message)
        if (error.code) {
            console.error("Error code:", error.code)
        }
        if (error.reason) {
            console.error("Reason:", error.reason)
        }
    }
}

main()
