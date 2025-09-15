import hre from "hardhat"
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify"

async function main() {
    console.log(
        "🔍 Starting verification on network:",
        (await hre.network.connect()).networkName
    )

    // Fill these with your real deployed addresses and initialization data
    const finCubeDAOImplAddress = "0x37211c898060a1e4c55e73ea4e2ff24215787bc2"
    const finCubeImplAddress = "0xf76e85a3e349282341ebb538df9f46fd2aa984fa"
    const finCubeDAOProxyAddress = "0xd07a07501d7a03768504403cc7bab95357cf254b"
    const finCubeProxyAddress = "0xbd1a23dcf907762bb7b772b25a80e05b8fb531e4"
    const mockERC20Address = "0x347668c8dc9186c762715dd85f8db5a13eef1118"

    // Also the calldata (init data) you used when deploying proxies, encoded
    // For example: the bytes from encodeFunctionData for initialize(...)
    const { encodeFunctionData } = await import("viem")

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
            "https://fincube-dao.com/metadata",
            "https://fincube-dao.com/owner",
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
