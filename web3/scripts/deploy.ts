// web3/scripts/01_deploy_dao_uup_v1.ts
import { ethers, upgrades } from "hardhat"
import { trackDataSaver } from "./trackDataSaver"

/**
 * Deploy FinCubeDAO (UUPS Proxy), FinCube (UUPS Proxy), and MockERC20
 * The Universal Upgradeable Proxies
 * Ref: https://eips.ethereum.org/EIPS/eip-1822
 * JS Package: https://www.npmjs.com/package/@openzeppelin/hardhat-upgrades
 */
async function main() {
    const [deployer] = await ethers.getSigners()
    console.log("Deploying contracts with the account:", deployer.address)
    console.log(
        "Account balance:",
        (await deployer.provider.getBalance(deployer.address)).toString()
    )

    // 1. Deploy MockERC20 first (not upgradeable)
    console.log("\n=== Deploying MockERC20 ===")
    const MockERC20 = await ethers.getContractFactory("MockERC20")
    const mockERC20 = await MockERC20.deploy(
        "FinCube USDC",
        "fUSDC",
        ethers.parseUnits("1000000", 6) // 1M tokens with 6 decimals
    )
    await mockERC20.waitForDeployment()
    const mockERC20Address = await mockERC20.getAddress()
    console.log("MockERC20 deployed to:", mockERC20Address)

    // Store MockERC20 address
    await trackDataSaver(
        "mockERC20_contract_address",
        "MockERC20Contract",
        mockERC20Address
    )

    // 2. Deploy FinCubeDAO (UUPS Proxy)
    console.log("\n=== Deploying FinCubeDAO ===")

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
        type: "MFS",
        name: "bKash",
        members: [{ type: "EthereumAddress", id: deployer.address }],
    }

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
    const finCubeDAO = await upgrades.deployProxy(
        FinCubeDAO,
        [JSON.stringify(_daoURI), JSON.stringify(_ownerURI)],
        {
            kind: "uups",
            initializer: "initialize",
        }
    )
    await finCubeDAO.waitForDeployment()
    const finCubeDAOAddress = await finCubeDAO.getAddress()
    console.log("FinCubeDAO proxy deployed to:", finCubeDAOAddress)

    // Get implementation address for FinCubeDAO
    const daoImplementationAddress =
        await upgrades.erc1967.getImplementationAddress(finCubeDAOAddress)
    console.log("FinCubeDAO implementation address:", daoImplementationAddress)

    // Store FinCubeDAO addresses
    await trackDataSaver(
        "fincubeDAO_contract_address",
        "FinCubeDAOContract",
        finCubeDAOAddress
    )
    await trackDataSaver(
        "fincubeDAO_implementation_address",
        "FinCubeDAOImplementationAddress",
        daoImplementationAddress
    )

    // 3. Deploy FinCube (UUPS Proxy) - depends on FinCubeDAO
    console.log("\n=== Deploying FinCube ===")

    const FinCube = await ethers.getContractFactory("FinCube")
    const finCube = await upgrades.deployProxy(
        FinCube,
        [finCubeDAOAddress, mockERC20Address], // DAO address and approved ERC20
        {
            kind: "uups",
            initializer: "initialize",
        }
    )
    await finCube.waitForDeployment()
    const finCubeAddress = await finCube.getAddress()
    console.log("FinCube proxy deployed to:", finCubeAddress)

    // Get implementation address for FinCube
    const finCubeImplementationAddress =
        await upgrades.erc1967.getImplementationAddress(finCubeAddress)
    console.log("FinCube implementation address:", finCubeImplementationAddress)

    // Store FinCube addresses
    await trackDataSaver(
        "finCube_contract_address",
        "FinCubeContract",
        finCubeAddress
    )
    await trackDataSaver(
        "finCube_implementation_address",
        "FinCubeImplementationAddress",
        finCubeImplementationAddress
    )

    // 4. Initialize FinCubeDAO with proper voting parameters
    console.log("\n=== Setting FinCubeDAO Parameters ===")
    await finCubeDAO.setVotingDelay(300) // 5 minutes delay
    await finCubeDAO.setVotingPeriod(86400) // 24 hours voting period
    console.log("Voting delay set to 300 seconds (5 minutes)")
    console.log("Voting period set to 86400 seconds (24 hours)")

    // 5. Mint some test tokens to deployer
    console.log("\n=== Minting Test Tokens ===")
    await mockERC20.mint(deployer.address, ethers.parseUnits("10000", 6)) // 10K additional tokens
    console.log("Minted 10,000 fUSDC to deployer address")

    console.log("\n=== Deployment Summary ===")
    console.log("MockERC20 Address:", mockERC20Address)
    console.log("FinCubeDAO Proxy Address:", finCubeDAOAddress)
    console.log("FinCubeDAO Implementation Address:", daoImplementationAddress)
    console.log("FinCube Proxy Address:", finCubeAddress)
    console.log("FinCube Implementation Address:", finCubeImplementationAddress)
    console.log("Deployer Address:", deployer.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

// command: npx hardhat run scripts/01_deploy_dao_uup_v1.ts --network sepolia
// verify commands will be shown after deployment
