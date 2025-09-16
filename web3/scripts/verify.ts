import hre, { network } from "hardhat"
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify"

async function main() {
    console.log(
        "🔍 Starting verification on network:",
        (await hre.network.connect()).networkName
    )

    // Fill these with your real deployed addresses and initialization data
    const finCubeDAOImplAddress = "0xcAe35772f0A1f8936c22EF4477Ae776BB93d5153"
    const finCubeImplAddress = "0x9F8E553172D95b6465A668e3FaA92D64576eDD2d"
    const finCubeDAOProxyAddress = "0xe857cBCfA7714C22e22DDfF7777A0455AeA39145"
    const finCubeProxyAddress = "0xE992A526e8e51120F9C0Bf05c26f301e576D45E0"
    const mockERC20Address = "0x01205E30606F8Ca83c03690e33a9c7C8Eb64BF62"

    // Also the calldata (init data) you used when deploying proxies, encoded
    // For example: the bytes from encodeFunctionData for initialize(...)
    const { encodeFunctionData, getAddress } = await import("viem")
    const { viem } = await network.connect()
    const [deployer] = await viem.getWalletClients()

    console.log("Verifying contracts deployed by:", deployer.account.address)

    // DAO URI following EIP-4824
    const _daoURI = {
        "@context": "https://github.com/FinCube-23/DAO-Proposal-Governance",
        type: "DAO",
        name: "FinCube-23",
        description:
            "FinCube is a DAO for Mobile Financial Services. The DAO allows MFS entities to set policies to enable global currency transfer.",
        membersURI: "",
        proposalsURI: "",
        activityLogURI: "",
        governanceURI: "",
        contractsURI: "",
    }

    // Owner URI following EIP-4824
    const _ownerURI = {
        "@context": "https://www.bkash.com/",
        type: "Organization",
        name: "bKash",
        members: [{ type: "EthereumAddress", id: getAddress(deployer.account.address) }],
    }

    const daoInitCalldata = encodeFunctionData({
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
            JSON.stringify(_daoURI),
            JSON.stringify(_ownerURI),
        ],
    })

    const finCubeInitCalldata = encodeFunctionData({
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
        args: [finCubeDAOProxyAddress, mockERC20Address],
    })

    // Verify the implementation contracts (they usually have no constructor args if using initialize pattern)
    await verifyContract(
        {
            address: finCubeDAOImplAddress,
            constructorArgs: [], // typically empty
            provider: "etherscan",
        },
        hre
    )
    console.log("✅ FinCubeDAO Implementation verified")

    await verifyContract(
        {
            address: finCubeImplAddress,
            constructorArgs: [],
            provider: "etherscan",
        },
        hre
    )
    console.log("✅ FinCube Implementation verified")

    // Then verify proxy contracts
    // Proxy contracts’ constructor args must match what was used: logic address + init data bytes
    await verifyContract(
        {
            address: finCubeDAOProxyAddress,
            constructorArgs: [finCubeDAOImplAddress, daoInitCalldata],
            provider: "etherscan",
        },
        hre
    )
    console.log("✅ FinCubeDAO Proxy verified")

    await verifyContract(
        {
            address: finCubeProxyAddress,
            constructorArgs: [finCubeImplAddress, finCubeInitCalldata],
            provider: "etherscan",
        },
        hre
    )
    console.log("✅ FinCube Proxy verified")

    await verifyContract(
        {
            address: mockERC20Address,
            constructorArgs: ["FinCube Test Token", "FCT", 18],
            provider: "etherscan",
        },
        hre
    )
    console.log("✅ MockERC20 verified")

    console.log("🎉 Verification done")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Verification error:", error)
        process.exit(1)
    })
