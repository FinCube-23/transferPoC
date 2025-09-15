import { network } from "hardhat"
import { encodeFunctionData, getAddress } from "viem"

async function main() {
    console.log("🚀 Starting deployment to Sepolia...")
    const { viem } = await network.connect()

    const [deployer] = await viem.getWalletClients()
    const publicClient = await viem.getPublicClient()

    console.log("Deploying with account:", deployer.account.address)

    // Get balance
    const balance = await publicClient.getBalance({
        address: deployer.account.address,
    })
    console.log("Account balance:", balance.toString(), "wei")

    // 1. Deploy FinCubeDAO Implementation
    console.log("\n📋 Deploying FinCubeDAO implementation...")
    const finCubeDAOImpl = await viem.deployContract("FinCubeDAO")
    console.log(
        "✅ FinCubeDAO implementation deployed at:",
        finCubeDAOImpl.address
    )

    // 2. Deploy FinCube Implementation
    console.log("\n📋 Deploying FinCube implementation...")
    const finCubeImpl = await viem.deployContract("FinCube")
    console.log("✅ FinCube implementation deployed at:", finCubeImpl.address)

    // 3. Deploy MockERC20 for testing (optional)
    console.log("\n📋 Deploying MockERC20 token...")
    const mockERC20 = await viem.deployContract("MockERC20", [
        "FinCube Test Token",
        "FCT",
        18n,
    ])
    console.log("✅ MockERC20 deployed at:", mockERC20.address)

    // 4. Prepare FinCubeDAO initialization data
    const daoInitData = encodeFunctionData({
        abi: [
            {
                name: "initialize",
                type: "function",
                inputs: [
                    { name: "_daoURI", type: "string" },
                    { name: "_ownerURI", type: "string" },
                ],
            },
        ],
        functionName: "initialize",
        args: [
            "https://fincube-dao.com/metadata", // DAO URI
            "https://fincube-dao.com/owner", // Owner URI
        ],
    })

    // 5. Deploy FinCubeDAO Proxy - FIXED LINE
    console.log("\n📋 Deploying FinCubeDAO proxy...")
    const finCubeDAOProxy = await viem.deployContract("TestERC1967Proxy", [
        finCubeDAOImpl.address,
        daoInitData,
    ])
    console.log("✅ FinCubeDAO proxy deployed at:", finCubeDAOProxy.address)

    // 6. Prepare FinCube initialization data
    const finCubeInitData = encodeFunctionData({
        abi: [
            {
                name: "initialize",
                type: "function",
                inputs: [
                    { name: "_dao", type: "address" },
                    { name: "_token", type: "address" },
                ],
            },
        ],
        functionName: "initialize",
        args: [
            finCubeDAOProxy.address, // DAO proxy address
            mockERC20.address, // Initial token (can be changed via governance)
        ],
    })

    // 7. Deploy FinCube Proxy - FIXED LINE
    console.log("\n📋 Deploying FinCube proxy...")
    const finCubeProxy = await viem.deployContract("TestERC1967Proxy", [
        finCubeImpl.address,
        finCubeInitData,
    ])
    console.log("✅ FinCube proxy deployed at:", finCubeProxy.address)

    // 8. Verify deployment by checking proxy initialization
    console.log("\n🔍 Verifying proxy initialization...")

    // Get contract instances pointing to proxies
    const finCubeDAO = await viem.getContractAt(
        "FinCubeDAO",
        finCubeDAOProxy.address
    )
    const finCube = await viem.getContractAt("FinCube", finCubeProxy.address)

    // Verify FinCubeDAO initialization
    const owner = await finCubeDAO.read.owner()
    const daoURI = await finCubeDAO.read.daoURI()
    const memberCount = await finCubeDAO.read.memberCount()

    console.log("FinCubeDAO Owner:", owner)
    console.log("FinCubeDAO URI:", daoURI)
    console.log("Initial Member Count:", memberCount.toString())

    // Verify FinCube initialization
    const daoAddress = await finCube.read.dao()
    const tokenAddress = await finCube.read.approvedERC20()

    console.log("FinCube DAO Address:", daoAddress)
    console.log("FinCube Token Address:", tokenAddress)

    // 9. Set up basic governance parameters
    console.log("\n⚙️  Setting up governance parameters...")
    await finCubeDAO.write.setVotingDelay([300n]) // 5 minutes
    await finCubeDAO.write.setVotingPeriod([7200n]) // 2 hours

    console.log("✅ Voting delay set to 300 seconds")
    console.log("✅ Voting period set to 7200 seconds")

    // 10. Print summary
    console.log("\n🎉 DEPLOYMENT SUMMARY")
    console.log("=".repeat(50))
    console.log("📍 Network: Sepolia")
    console.log("👤 Deployer:", deployer.account.address)
    console.log()
    console.log("📋 IMPLEMENTATION CONTRACTS:")
    console.log("   FinCubeDAO Impl:", finCubeDAOImpl.address)
    console.log("   FinCube Impl:   ", finCubeImpl.address)
    console.log()
    console.log("🔗 PROXY CONTRACTS (USE THESE):")
    console.log("   FinCubeDAO Proxy:", finCubeDAOProxy.address)
    console.log("   FinCube Proxy:   ", finCubeProxy.address)
    console.log()
    console.log("🪙 TEST TOKEN:")
    console.log("   MockERC20:      ", mockERC20.address)
    console.log()
    console.log("🔍 Etherscan Links:")
    console.log(
        `   DAO: https://sepolia.etherscan.io/address/${finCubeDAOProxy.address}`
    )
    console.log(
        `   FinCube: https://sepolia.etherscan.io/address/${finCubeProxy.address}`
    )
    console.log(
        `   Token: https://sepolia.etherscan.io/address/${mockERC20.address}`
    )

    // Return addresses for potential verification script
    return {
        implementations: {
            finCubeDAO: finCubeDAOImpl.address,
            finCube: finCubeImpl.address,
        },
        proxies: {
            finCubeDAO: finCubeDAOProxy.address,
            finCube: finCubeProxy.address,
        },
        token: mockERC20.address,
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error)
        process.exit(1)
    })
