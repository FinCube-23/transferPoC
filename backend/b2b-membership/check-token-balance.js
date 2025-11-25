/**
 * Check Token Balance and Mint Script
 * 
 * This script helps you:
 * 1. Check the token decimals
 * 2. Check your wallet's token balance
 * 3. Check allowance for FinCube contract
 * 4. Approve FinCube contract to spend tokens
 */

const { ethers } = require("ethers")
require("dotenv").config()

// ERC20 ABI
const ERC20_ABI = [
    "function decimals() external view returns (uint8)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)",
]

// FinCube ABI
const FINCUBE_ABI = [
    "function approvedERC20() external view returns (address)",
]

async function main() {
    try {
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

        // Get token contract
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            provider
        )

        // Get token info
        const [decimals, symbol, name] = await Promise.all([
            tokenContract.decimals(),
            tokenContract.symbol(),
            tokenContract.name(),
        ])

        console.log("\nToken Information:")
        console.log("  Name:", name)
        console.log("  Symbol:", symbol)
        console.log("  Decimals:", decimals)

        // Get balance
        const balance = await tokenContract.balanceOf(wallet.address)
        const balanceFormatted = ethers.formatUnits(balance, decimals)

        console.log("\nToken Balance:")
        console.log("  Raw units:", balance.toString())
        console.log("  Formatted:", balanceFormatted, symbol)

        // Get allowance
        const allowance = await tokenContract.allowance(
            wallet.address,
            finCubeAddress
        )
        const allowanceFormatted = ethers.formatUnits(allowance, decimals)

        console.log("\nAllowance for FinCube:")
        console.log("  Raw units:", allowance.toString())
        console.log("  Formatted:", allowanceFormatted, symbol)

        // Check if balance is sufficient for a 0.01 token transfer
        const testAmount = ethers.parseUnits("0.01", decimals)
        console.log("\n" + "=".repeat(60))
        console.log("Test Transfer Amount: 0.01", symbol)
        console.log("  Required units:", testAmount.toString())
        
        if (balance >= testAmount) {
            console.log("  ✅ Sufficient balance for 0.01 token transfer")
        } else {
            console.log("  ❌ Insufficient balance for 0.01 token transfer")
            console.log("  You need to mint/acquire more tokens")
            const needed = testAmount - balance
            console.log("  Additional needed:", ethers.formatUnits(needed, decimals), symbol)
        }

        if (allowance >= testAmount) {
            console.log("  ✅ Sufficient allowance for FinCube contract")
        } else {
            console.log("  ⚠️  Insufficient allowance for FinCube contract")
            console.log("\nTo approve FinCube contract, run:")
            console.log(`  node approve-fincube.js <amount>`)
            console.log(`  Example: node approve-fincube.js 1000`)
        }
        console.log("=".repeat(60))

    } catch (error) {
        console.error("\n❌ Error:", error.message)
        if (error.code) {
            console.error("Error code:", error.code)
        }
    }
}

main()
