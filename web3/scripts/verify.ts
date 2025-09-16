// web3/scripts/03_verify_contracts.ts
import { run } from "hardhat"

// Load deployed addresses
const mockERC20Address = require("../../json-log/mockERC20_contract_address.json")
const daoAddresses = require("../../json-log/fincubeDAO_contract_address.json")
const finCubeAddresses = require("../../json-log/finCube_contract_address.json")
const daoImplementation = require("../../json-log/fincubeDAO_implementation_address.json")
const finCubeImplementation = require("../../json-log/finCube_implementation_address.json")

async function main() {
    console.log("Starting contract verification...")

    try {
        // 1. Verify MockERC20
        console.log("\n=== Verifying MockERC20 ===")
        await run("verify:verify", {
            address: mockERC20Address.MockERC20Contract,
            constructorArguments: [
                "FinCube USDC",
                "fUSDC",
                "1000000000000", // 1M tokens with 6 decimals
            ],
        })
        console.log("MockERC20 verified successfully")

        // 2. Verify FinCubeDAO Implementation
        console.log("\n=== Verifying FinCubeDAO Implementation ===")
        await run("verify:verify", {
            address: daoImplementation.FinCubeDAOImplementationAddress,
            constructorArguments: [],
        })
        console.log("FinCubeDAO Implementation verified successfully")

        // 3. Verify FinCube Implementation
        console.log("\n=== Verifying FinCube Implementation ===")
        await run("verify:verify", {
            address: finCubeImplementation.FinCubeImplementationAddress,
            constructorArguments: [],
        })
        console.log("FinCube Implementation verified successfully")

        console.log("\n=== All contracts verified successfully ===")
        console.log("MockERC20:", mockERC20Address.MockERC20Contract)
        console.log("FinCubeDAO Proxy:", daoAddresses.FinCubeDAOContract)
        console.log(
            "FinCubeDAO Implementation:",
            daoImplementation.FinCubeDAOImplementationAddress
        )
        console.log("FinCube Proxy:", finCubeAddresses.FinCubeContract)
        console.log(
            "FinCube Implementation:",
            finCubeImplementation.FinCubeImplementationAddress
        )
    } catch (error) {
        console.error("Verification failed:", error)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

// command: npx hardhat run scripts/03_verify_contracts.ts --network sepolia
