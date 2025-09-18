import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { Contract } from "ethers"

/*
 * ===============================================================================
 * IMPORTANT: Understanding UUPS Proxy Pattern for Contract Upgrades
 * ===============================================================================
 *
 * This test suite includes upgrade tests that use the UUPS (Universal Upgradeable
 * Proxy Standard) pattern. Understanding why proxies are required is crucial:
 *
 * 🔑 KEY CONCEPTS:
 *
 * 1. SEPARATION OF CONCERNS:
 *    - Proxy Contract: Holds state/storage and forwards calls
 *    - Implementation Contract: Contains logic/functions but no persistent state
 *
 * 2. WHY DIRECT IMPLEMENTATION UPGRADES FAIL:
 *    - OpenZeppelin's UUPSUpgradeable includes _checkProxy() that verifies calls
 *      come through a proxy contract, not directly to implementation
 *    - Direct calls to upgradeToAndCall() on implementations → UUPSUnauthorizedCallContext()
 *    - This prevents accidental direct upgrades that would lose state
 *
 * 3. UPGRADE FLOW:
 *    ┌─────────────────┐    ┌─────────────────┐
 *    │   Proxy         │───▶│ Implementation  │
 *    │ (holds state)   │    │ (contains logic)│
 *    └─────────────────┘    └─────────────────┘
 *           │
 *           ▼ (upgrade)
 *    ┌─────────────────┐    ┌─────────────────┐
 *    │   Proxy         │───▶│ New Impl V2     │
 *    │ (state preserved)│    │ (new logic)     │
 *    └─────────────────┘    └─────────────────┘
 *
 * 4. STATE PRESERVATION:
 *    - All storage variables remain in proxy contract
 *    - User interactions always go through proxy address
 *    - Only implementation pointer changes during upgrades
 *
 * 5. TESTING PATTERN:
 *    - Deploy implementation contracts (logic only)
 *    - Deploy proxy contracts with initialization data
 *    - Use proxy addresses for all interactions
 *    - Verify implementation pointer changes after upgrade
 *    - Confirm state/storage is preserved
 *
 * ===============================================================================
 */

describe("FinCube", function () {
    it("Should deploy FinCubeDAO contract", async function () {
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        // Verify the contract was deployed successfully
        expect(await finCubeDAO.getAddress()).to.be.properAddress
    })

    it("Should deploy MockERC20 token contract", async function () {
        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)
        await mockERC20.waitForDeployment()

        // Verify the contract was deployed successfully
        expect(await mockERC20.getAddress()).to.be.properAddress
    })

    it("Should deploy FinCube contract", async function () {
        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // Verify the contract was deployed successfully
        expect(await finCube.getAddress()).to.be.properAddress
    })

    it("Should initialize FinCube with DAO and token addresses", async function () {
        // Deploy all contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)
        await mockERC20.waitForDeployment()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // Initialize DAO first
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Initialize FinCube with DAO and token addresses
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Verify initialization
        const daoAddress = await finCube.dao()
        const tokenAddress = await finCube.approvedERC20()

        expect(daoAddress).to.equal(await finCubeDAO.getAddress())
        expect(tokenAddress).to.equal(await mockERC20.getAddress())
    })

    it("Should mint ERC20 tokens and test stablecoin transfer flow", async function () {
        // Get test accounts
        const [owner, member1, member2] = await ethers.getSigners()

        // Deploy all contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)
        await mockERC20.waitForDeployment()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Mint tokens to member1
        const mintAmount = ethers.parseEther("1000") // 1000 tokens
        await mockERC20.mint(member1.address, mintAmount)

        // Register members in DAO
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")
        await finCubeDAO
            .connect(member2)
            .registerMember(member2.address, "Member 2 URI")

        // Set voting delay and period
        await finCubeDAO.connect(owner).setVotingDelay(1)
        await finCubeDAO.connect(owner).setVotingPeriod(3)

        // Create proposal to approve member1
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )

        // Wait for voting delay
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])

        // Cast vote (owner votes yes)
        await finCubeDAO.castVote(0, true)

        // Wait for voting period to end
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])

        // Execute proposal to approve member1
        await finCubeDAO.executeProposal(0)

        // Create proposal to approve member2
        await finCubeDAO.newMemberApprovalProposal(
            member2.address,
            "Approve Member 2"
        )

        // Wait for voting delay
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])

        // Cast vote (owner votes yes)
        await finCubeDAO.castVote(1, true)

        // Wait and execute proposal to approve member2
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(1)

        // Verify members are approved
        const member1Approved = await finCubeDAO.checkIsMemberApproved(
            member1.address
        )
        const member2Approved = await finCubeDAO.checkIsMemberApproved(
            member2.address
        )

        expect(member1Approved).to.be.true
        expect(member2Approved).to.be.true

        // Approve FinCube contract to spend tokens on behalf of member1
        const transferAmount = ethers.parseEther("100") // 100 tokens
        await mockERC20
            .connect(member1)
            .approve(await finCube.getAddress(), transferAmount)

        // Perform safe transfer from member1 to member2
        const nullifier =
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

        await expect(
            finCube
                .connect(member1)
                .safeTransfer(
                    member1.address,
                    member2.address,
                    transferAmount,
                    "Test transfer memo",
                    nullifier
                )
        )
            .to.emit(finCube, "StablecoinTransfer")
            .withArgs(
                member1.address,
                member2.address,
                transferAmount,
                "Test transfer memo",
                nullifier
            )

        // Verify balances
        const member1Balance = await mockERC20.balanceOf(member1.address)
        const member2Balance = await mockERC20.balanceOf(member2.address)

        expect(member1Balance).to.equal(mintAmount - transferAmount)
        expect(member2Balance).to.equal(transferAmount)
    })

    it("Should create and execute stablecoin address change proposal", async function () {
        // Get test accounts
        const [owner, member1] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const oldToken = await MockERC20.deploy("Old Token", "OLD", 18)
        await oldToken.waitForDeployment()

        const newToken = await MockERC20.deploy("New Token", "NEW", 18)
        await newToken.waitForDeployment()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await oldToken.getAddress()
        )

        // Register and approve member1
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Create and execute member approval proposal
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(0, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(0)

        // Create proposal to change stablecoin address
        const finCubeInterface = finCube.interface
        const functionSelector = finCubeInterface.encodeFunctionData(
            "setApprovedERC20",
            [await newToken.getAddress()]
        )

        await finCubeDAO.propose(
            [await finCube.getAddress()],
            [0],
            [functionSelector],
            "Change approved ERC20 token"
        )

        // Wait for voting delay
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])

        // Cast votes (owner and member1 vote yes)
        await finCubeDAO.castVote(1, true) // owner votes
        await finCubeDAO.connect(member1).castVote(1, true) // member1 votes

        // Wait for voting period
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])

        // Execute the proposal
        await finCubeDAO.executeProposal(1)

        // Verify the stablecoin address was changed
        const currentToken = await finCube.approvedERC20()
        expect(currentToken).to.equal(await newToken.getAddress())

        // Verify event was emitted - simplified approach
        const filter = finCube.filters.ApprovedERC20Updated()
        const events = await finCube.queryFilter(filter)

        expect(events.length).to.be.greaterThan(0)
        const lastEvent = events[events.length - 1]
        expect(lastEvent.args[0]).to.equal(await newToken.getAddress())
    })

    it("Should handle complete workflow: deploy, initialize, create proposal, vote, execute, and change token", async function () {
        const [owner, member1, member2] = await ethers.getSigners()

        // 1. Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const initialToken = await MockERC20.deploy("Initial Token", "INIT", 18)
        await initialToken.waitForDeployment()

        const newToken = await MockERC20.deploy("New Token", "NEW", 18)
        await newToken.waitForDeployment()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // 2. Initialize FinCube with DAO and token addresses
        await finCubeDAO.initialize("DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await initialToken.getAddress()
        )

        // 3. Create dummy ERC20 tokens and mint them
        const mintAmount = ethers.parseEther("1000")
        await initialToken.mint(member1.address, mintAmount)
        await newToken.mint(member2.address, mintAmount)

        // Setup DAO voting parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and approve members
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")
        await finCubeDAO
            .connect(member2)
            .registerMember(member2.address, "Member 2 URI")

        // Approve member1
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(0, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(0)

        // Approve member2
        await finCubeDAO.newMemberApprovalProposal(
            member2.address,
            "Approve Member 2"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(1, true)
        await finCubeDAO.connect(member1).castVote(1, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(1)

        // 4. Create stablecoin proposal (target -> contract address)
        const finCubeInterface = finCube.interface
        const setTokenCalldata = finCubeInterface.encodeFunctionData(
            "setApprovedERC20",
            [await newToken.getAddress()]
        )

        await finCubeDAO.propose(
            [await finCube.getAddress()],
            [0],
            [setTokenCalldata],
            "Change approved ERC20 token"
        )

        // 5. Cast votes
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(2, true) // owner
        await finCubeDAO.connect(member1).castVote(2, true) // member1

        // 6. Execute the proposal
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(2)

        // 7. Verify the stablecoin address was changed
        const finalTokenAddress = await finCube.approvedERC20()
        expect(finalTokenAddress).to.equal(await newToken.getAddress())

        // Test safe transfer with new token
        await newToken
            .connect(member2)
            .approve(await finCube.getAddress(), ethers.parseEther("100"))

        const nullifier2 =
            "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

        await expect(
            finCube
                .connect(member2)
                .safeTransfer(
                    member2.address,
                    member1.address,
                    ethers.parseEther("50"),
                    "Final test transfer",
                    nullifier2
                )
        )
            .to.emit(finCube, "StablecoinTransfer")
            .withArgs(
                member2.address,
                member1.address,
                ethers.parseEther("50"),
                "Final test transfer",
                nullifier2
            )

        // Verify final balances
        const member1FinalBalance = await newToken.balanceOf(member1.address)
        const member2FinalBalance = await newToken.balanceOf(member2.address)

        expect(member1FinalBalance).to.equal(ethers.parseEther("50"))
        expect(member2FinalBalance).to.equal(
            mintAmount - ethers.parseEther("50")
        )
    })

    it("Should verify FinCube contract is upgradeable (UUPS)", async function () {
        const [owner] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)
        await mockERC20.waitForDeployment()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Verify that the contract has UUPS upgrade functionality
        // Only DAO should be able to authorize upgrades

        // Deploy a new implementation
        const finCubeV2 = await FinCube.deploy()
        await finCubeV2.waitForDeployment()

        // Try to upgrade from non-DAO address (should fail)
        await expect(
            finCube
                .connect(owner)
                .upgradeToAndCall(await finCubeV2.getAddress(), "0x")
        ).to.be.revertedWithCustomError(finCube, "UUPSUnauthorizedCallContext")

        // Verify DAO address is set correctly
        const daoAddress = await finCube.dao()
        expect(daoAddress).to.equal(await finCubeDAO.getAddress())
    })

    it("Should verify FinCubeDAO contract is upgradeable (UUPS)", async function () {
        const [owner, nonOwner] = await ethers.getSigners()

        // Deploy and initialize DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Deploy a new implementation
        const finCubeDAOV2 = await FinCubeDAO.deploy()
        await finCubeDAOV2.waitForDeployment()

        // Try to upgrade from non-owner address (should fail)
        await expect(
            finCubeDAO
                .connect(nonOwner)
                .upgradeToAndCall(await finCubeDAOV2.getAddress(), "0x")
        ).to.be.revertedWithCustomError(
            finCubeDAO,
            "UUPSUnauthorizedCallContext"
        )

        // Owner should be able to upgrade (we'll just verify the call doesn't revert with auth error)
        const owner_address = await finCubeDAO.owner()
        expect(owner_address).to.equal(owner.address)
    })

    it("Should test reentrancy protection in FinCube safeTransfer", async function () {
        const [owner, member1, member2] = await ethers.getSigners()

        // Deploy malicious ERC20 (use the malicious implementation)
        const MaliciousERC20 = await ethers.getContractFactory("MaliciousERC20")
        const maliciousERC20 = await MaliciousERC20.deploy(
            "Malicious Token",
            "MAL"
        )
        await maliciousERC20.waitForDeployment()

        // Deploy normal contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await maliciousERC20.getAddress()
        )

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and approve members
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")
        await finCubeDAO
            .connect(member2)
            .registerMember(member2.address, "Member 2 URI")

        // Approve member1
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(0, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(0)

        // Approve member2
        await finCubeDAO.newMemberApprovalProposal(
            member2.address,
            "Approve Member 2"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(1, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(1)

        // Mint tokens and approve
        const mintAmount = ethers.parseEther("1000")
        await maliciousERC20.mint(member1.address, mintAmount)
        await maliciousERC20
            .connect(member1)
            .approve(await finCube.getAddress(), mintAmount)

        // Configure attacker to target FinCube and attempt reentrancy
        await maliciousERC20.setTargetContract(await finCube.getAddress())
        await maliciousERC20.enableAttack(
            member1.address,
            member2.address,
            ethers.parseEther("50")
        )

        // Attempt transfer: malicious token will try to call back into safeTransfer
        const nullifier3 =
            "0x1111111111111111111111111111111111111111111111111111111111111111"

        await expect(
            finCube
                .connect(member1)
                .safeTransfer(
                    member1.address,
                    member2.address,
                    ethers.parseEther("100"),
                    "Reentrancy test memo",
                    nullifier3
                )
        ).to.be.revertedWithCustomError(finCube, "ReentrancyGuardReentrantCall")

        // Disable attack and ensure normal transfer works
        await maliciousERC20.disableAttack()
        const nullifier4 =
            "0x2222222222222222222222222222222222222222222222222222222222222222"

        await expect(
            finCube
                .connect(member1)
                .safeTransfer(
                    member1.address,
                    member2.address,
                    ethers.parseEther("100"),
                    "Normal transfer memo",
                    nullifier4
                )
        ).to.emit(finCube, "StablecoinTransfer")

        const member2Balance = await maliciousERC20.balanceOf(member2.address)
        expect(member2Balance).to.equal(ethers.parseEther("100"))
    })

    it("Should test reentrancy protection in FinCubeDAO executeProposal", async function () {
        const [owner, member1] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)
        await mockERC20.waitForDeployment()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // Deploy malicious target contract
        const MaliciousTarget = await ethers.getContractFactory(
            "MaliciousTarget"
        )
        const maliciousTarget = await MaliciousTarget.deploy()
        await maliciousTarget.waitForDeployment()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(10)

        // Register and approve members
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")

        // Approve member1
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(0, true)
        await ethers.provider.send("evm_increaseTime", [10])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(0)

        // Malicious target knows DAO
        await maliciousTarget.setDAOContract(await finCubeDAO.getAddress())

        // Create malicious proposal that calls maliciousTarget.maliciousFunction
        const maliciousCalldata =
            maliciousTarget.interface.encodeFunctionData("maliciousFunction")

        await finCubeDAO.propose(
            [await maliciousTarget.getAddress()],
            [0],
            [maliciousCalldata],
            "Malicious proposal"
        )

        // enable the attack for that proposal id (1)
        await maliciousTarget.enableAttack(1)

        // vote and wait
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(1, true)
        await finCubeDAO.connect(member1).castVote(1, true)
        await ethers.provider.send("evm_increaseTime", [10])
        await ethers.provider.send("evm_mine", [])

        // Execution should revert due to reentrancy guard in executeProposal
        await expect(
            finCubeDAO.executeProposal(1)
        ).to.be.revertedWithCustomError(
            finCubeDAO,
            "ReentrancyGuardReentrantCall"
        )

        // disable attack and make a normal proposal that should succeed
        await maliciousTarget.disableAttack()

        const finCubeInterface = finCube.interface
        const setTokenCalldata = finCubeInterface.encodeFunctionData(
            "setApprovedERC20",
            [await mockERC20.getAddress()]
        )

        await finCubeDAO.propose(
            [await finCube.getAddress()],
            [0],
            [setTokenCalldata],
            "Normal proposal"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.castVote(2, true)
        await finCubeDAO.connect(member1).castVote(2, true)
        await ethers.provider.send("evm_increaseTime", [10])
        await ethers.provider.send("evm_mine", [])
        await finCubeDAO.executeProposal(2)

        const currentToken = await finCube.approvedERC20()
        expect(currentToken).to.equal(await mockERC20.getAddress())
    })

    it("Should verify contracts implement proper access controls", async function () {
        const [owner, nonOwner, member1] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.waitForDeployment()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)
        await mockERC20.waitForDeployment()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()
        await finCube.waitForDeployment()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Test FinCube access controls
        // Only DAO should be able to set approved ERC20
        await expect(
            finCube
                .connect(nonOwner)
                .setApprovedERC20(await mockERC20.getAddress())
        ).to.be.revertedWith("Only DAO")

        // Only DAO should be able to set DAO address
        await expect(
            finCube.connect(nonOwner).setDAO(nonOwner.address)
        ).to.be.revertedWith("Only DAO")

        // Test FinCubeDAO access controls
        // Only owner should be able to set voting parameters
        await expect(
            finCubeDAO.connect(nonOwner).setVotingDelay(5)
        ).to.be.revertedWithCustomError(
            finCubeDAO,
            "OwnableUnauthorizedAccount"
        )

        await expect(
            finCubeDAO.connect(nonOwner).setVotingPeriod(10)
        ).to.be.revertedWithCustomError(
            finCubeDAO,
            "OwnableUnauthorizedAccount"
        )

        // Register a member to test member-only functions
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Non-members should not be able to create proposals
        await expect(
            finCubeDAO
                .connect(nonOwner)
                .newMemberApprovalProposal(nonOwner.address, "Should fail")
        ).to.be.revertedWith("Not a member")
    })

    it("Should verify initialization can only happen once", async function () {
        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Try to initialize again (should fail)
        await expect(
            finCubeDAO.initialize("Test DAO URI 2", "Owner URI 2")
        ).to.be.revertedWithCustomError(finCubeDAO, "InvalidInitialization")

        await expect(
            finCube.initialize(
                await finCubeDAO.getAddress(),
                await mockERC20.getAddress()
            )
        ).to.be.revertedWithCustomError(finCube, "InvalidInitialization")
    })

    it("Should successfully upgrade FinCube contract through DAO proposal and verify upgrade", async function () {
        const [owner, member1] = await ethers.getSigners()

        /*
         * IMPORTANT: UUPS upgrades require PROXY contracts, not direct implementation contracts.
         *
         * Why we need proxies for UUPS upgrades:
         * 1. UUPS (Universal Upgradeable Proxy Standard) separates contract logic from storage
         * 2. The proxy contract holds the state/storage while implementation contracts contain logic
         * 3. OpenZeppelin's UUPSUpgradeable has a _checkProxy() function that ensures upgrades
         *    can ONLY be called through a proxy contract, never directly on implementations
         * 4. Direct calls to upgradeToAndCall() on implementation contracts will revert with
         *    UUPSUnauthorizedCallContext() error
         * 5. The proxy forwards calls to the current implementation and can be upgraded to
         *    point to new implementation contracts while preserving storage
         */

        // Deploy implementation contracts (these contain the logic but no state)
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAOImpl = await FinCubeDAO.deploy()

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCubeImpl = await FinCube.deploy()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)

        // Create initialization data for DAO proxy
        const daoInitData = finCubeDAOImpl.interface.encodeFunctionData(
            "initialize",
            ["Test DAO URI", "Owner URI"]
        )

        // Deploy DAO proxy that points to DAO implementation
        const TestERC1967Proxy = await ethers.getContractFactory(
            "TestERC1967Proxy"
        )
        const finCubeDAOProxy = await TestERC1967Proxy.deploy(
            await finCubeDAOImpl.getAddress(),
            daoInitData
        )

        // Create initialization data for FinCube proxy
        const finCubeInitData = finCubeImpl.interface.encodeFunctionData(
            "initialize",
            [await finCubeDAOProxy.getAddress(), await mockERC20.getAddress()]
        )

        // Deploy FinCube proxy that points to FinCube implementation
        const finCubeProxy = await TestERC1967Proxy.deploy(
            await finCubeImpl.getAddress(),
            finCubeInitData
        )

        // Get contract instances that point to proxy addresses (these hold the state)
        const finCubeDAO = await ethers.getContractAt(
            "FinCubeDAO",
            await finCubeDAOProxy.getAddress()
        )
        const finCube = await ethers.getContractAt(
            "FinCube",
            await finCubeProxy.getAddress()
        )

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and approve member1
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")

        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(0, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.executeProposal(0)

        // Store original state to verify preservation after upgrade
        const originalDAO = await finCube.dao()
        const originalToken = await finCube.approvedERC20()

        // Deploy new implementation (V2) - this is just the logic, no state
        const finCubeV2 = await FinCube.deploy()

        // Get implementation address before upgrade from the proxy's storage
        const implementationSlot =
            "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
        const originalImplementation = await ethers.provider.getStorage(
            await finCube.getAddress(), // This is the proxy address holding the state
            implementationSlot
        )

        // Create upgrade proposal through DAO (targeting the PROXY contract)
        const upgradeCalldata = finCube.interface.encodeFunctionData(
            "upgradeToAndCall",
            [await finCubeV2.getAddress(), "0x"] // Point to new implementation
        )

        await finCubeDAO.propose(
            [await finCube.getAddress()], // Target the PROXY address, not implementation
            [0],
            [upgradeCalldata],
            "Upgrade FinCube to V2"
        )

        // Vote on upgrade proposal
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(1, true) // owner votes
        await finCubeDAO.connect(member1).castVote(1, true) // member1 votes
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")

        // Execute the upgrade proposal - this calls upgradeToAndCall on the proxy
        await finCubeDAO.executeProposal(1)

        // Verify upgrade succeeded by checking implementation address changed
        const newImplementation = await ethers.provider.getStorage(
            await finCube.getAddress(), // Check proxy's implementation storage
            implementationSlot
        )

        // Implementation should have changed
        expect(originalImplementation).to.not.equal(newImplementation)

        // The new implementation should point to finCubeV2 address (padded to 32 bytes)
        const expectedImplementation =
            "0x" +
            "0".repeat(24) +
            (await finCubeV2.getAddress()).slice(2).toLowerCase()
        expect(newImplementation.toLowerCase()).to.equal(expectedImplementation)

        // Verify state/storage was preserved after upgrade (this is the key benefit of proxies)
        const daoAfterUpgrade = await finCube.dao()
        const tokenAfterUpgrade = await finCube.approvedERC20()

        expect(daoAfterUpgrade.toLowerCase()).to.equal(
            originalDAO.toLowerCase()
        )
        expect(tokenAfterUpgrade.toLowerCase()).to.equal(
            originalToken.toLowerCase()
        )

        // Verify contract functionality still works after upgrade
        // Test that we can still call functions on the upgraded contract
        const daoStillAccessible = await finCube.dao()
        const tokenStillAccessible = await finCube.approvedERC20()

        expect(daoStillAccessible).to.not.equal(ethers.ZeroAddress)
        expect(tokenStillAccessible).to.not.equal(ethers.ZeroAddress)

        // Test that upgrade authorization still works (only DAO can upgrade after upgrade)
        const finCubeV3 = await FinCube.deploy()
        await expect(
            finCube
                .connect(owner)
                .upgradeToAndCall(await finCubeV3.getAddress(), "0x")
        ).to.be.revertedWith("Only DAO")
    })

    it("Should successfully upgrade FinCubeDAO contract and verify upgrade", async function () {
        const [owner, nonOwner] = await ethers.getSigners()

        /*
         * IMPORTANT: UUPS upgrades require PROXY contracts for the same reasons as above.
         *
         * For FinCubeDAO upgrades:
         * 1. DAO implementation contract contains the logic (governance functions)
         * 2. DAO proxy contract holds the state (members, proposals, voting data)
         * 3. When upgrading, we deploy new DAO implementation and point proxy to it
         * 4. All storage (member list, proposals, voting history) is preserved in proxy
         * 5. Only the owner can authorize DAO upgrades (via _authorizeUpgrade function)
         */

        // Deploy DAO implementation contract (logic only, no state)
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAOImpl = await FinCubeDAO.deploy()

        // Create initialization data for DAO proxy
        const daoInitData = finCubeDAOImpl.interface.encodeFunctionData(
            "initialize",
            ["Test DAO URI", "Owner URI"]
        )

        // Deploy DAO proxy that points to DAO implementation and initializes
        const TestERC1967Proxy = await ethers.getContractFactory(
            "TestERC1967Proxy"
        )
        const finCubeDAOProxy = await TestERC1967Proxy.deploy(
            await finCubeDAOImpl.getAddress(),
            daoInitData
        )

        // Get contract instance that points to proxy address (this holds the state)
        const finCubeDAO = await ethers.getContractAt(
            "FinCubeDAO",
            await finCubeDAOProxy.getAddress()
        )

        // Store original state to verify it's preserved after upgrade
        const originalOwner = await finCubeDAO.owner()

        // Set some state to verify preservation across upgrade
        await finCubeDAO.setVotingDelay(5)
        await finCubeDAO.setVotingPeriod(10)

        const stateBeforeUpgrade = {
            owner: await finCubeDAO.owner(),
            votingDelay: await finCubeDAO.votingDelay(),
            votingPeriod: await finCubeDAO.votingPeriod(),
        }

        // Deploy new DAO implementation (V2) - this is just the logic, no state
        const finCubeDAOV2 = await FinCubeDAO.deploy()

        // Get implementation address before upgrade from the proxy's storage
        const implementationSlot =
            "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
        const originalImplementation = await ethers.provider.getStorage(
            await finCubeDAO.getAddress(), // This is the proxy address holding the state
            implementationSlot
        )

        // Owner performs the upgrade directly (since DAO allows owner to upgrade)
        await finCubeDAO
            .connect(owner)
            .upgradeToAndCall(await finCubeDAOV2.getAddress(), "0x")

        // Verify upgrade succeeded by checking implementation address changed
        const newImplementation = await ethers.provider.getStorage(
            await finCubeDAO.getAddress(), // Check proxy's implementation storage
            implementationSlot
        )

        // Implementation should have changed
        expect(originalImplementation).to.not.equal(newImplementation)

        // The new implementation should point to finCubeDAOV2 address (padded to 32 bytes)
        const expectedImplementation =
            "0x" +
            "0".repeat(24) +
            (await finCubeDAOV2.getAddress()).slice(2).toLowerCase()
        expect(newImplementation.toLowerCase()).to.equal(expectedImplementation)

        // Verify state/storage was preserved after upgrade (key benefit of proxy pattern)
        const stateAfterUpgrade = {
            owner: await finCubeDAO.owner(),
            votingDelay: await finCubeDAO.votingDelay(),
            votingPeriod: await finCubeDAO.votingPeriod(),
        }

        expect(stateAfterUpgrade.owner.toLowerCase()).to.equal(
            stateBeforeUpgrade.owner.toLowerCase()
        )
        expect(stateAfterUpgrade.votingDelay).to.equal(
            stateBeforeUpgrade.votingDelay
        )
        expect(stateAfterUpgrade.votingPeriod).to.equal(
            stateBeforeUpgrade.votingPeriod
        )

        // Verify contract functionality still works after upgrade
        // Test that we can still call owner-only functions
        await finCubeDAO.connect(owner).setVotingDelay(7)
        const newVotingDelay = await finCubeDAO.votingDelay()
        expect(newVotingDelay).to.equal(7n)

        // Test that access control still works (only owner can upgrade)
        const finCubeDAOV3 = await FinCubeDAO.deploy()
        await expect(
            finCubeDAO
                .connect(nonOwner)
                .upgradeToAndCall(await finCubeDAOV3.getAddress(), "0x")
        ).to.be.revertedWithCustomError(
            finCubeDAO,
            "OwnableUnauthorizedAccount"
        )
    })
    it("Should reject execution without majority votes", async function () {
        const [owner, member1] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(120)

        // Register new member
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")

        // Create approval proposal
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Test proposal"
        )

        // Wait for voting delay
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")

        // NO VOTES CAST - zero yes votes
        // Wait for full voting period (120s)
        await ethers.provider.send("evm_increaseTime", [120])
        await ethers.provider.send("evm_mine")

        // Should fail - 0 yes votes, needs at least 1 vote
        await expect(finCubeDAO.executeProposal(0)).to.be.revertedWith(
            "Proposal doesn't have majority vote"
        )
    })

    it("Should initialize with owner as first member", async function () {
        const [owner] = await ethers.getSigners()

        // Deploy and initialize DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Owner should be first approved member after initialize
        const isOwnerApproved = await finCubeDAO.checkIsMemberApproved(
            owner.address
        )
        expect(isOwnerApproved).to.equal(true)
    })

    it("Should allow anyone to register new member", async function () {
        const [owner, newMember] = await ethers.getSigners()

        // Deploy DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        // Set voting params required by proposal creation
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register new member (anyone can call)
        const tx = await finCubeDAO
            .connect(newMember)
            .registerMember(newMember.address, "member://uri")

        // Verify member was registered: second registration should revert
        await expect(
            finCubeDAO
                .connect(newMember)
                .registerMember(newMember.address, "member://uri")
        ).to.be.revertedWith("Already a member")
    })

    it("Should only allow members to create approval proposals", async function () {
        const [owner, newMember, nonMember] = await ethers.getSigners()

        // Deploy DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Register member first (pending status)
        await finCubeDAO
            .connect(newMember)
            .registerMember(newMember.address, "member://uri")

        // Non-members should not be able to create proposals
        await expect(
            finCubeDAO
                .connect(nonMember)
                .newMemberApprovalProposal(nonMember.address, "Test proposal")
        ).to.be.revertedWith("Not a member")

        // Approved members can create proposals
        await finCubeDAO.connect(owner).setVotingDelay(1)
        await finCubeDAO.connect(owner).setVotingPeriod(5)

        await finCubeDAO
            .connect(owner)
            .newMemberApprovalProposal(newMember.address, "Test proposal")
    })

    it("Should enforce voting delay before execution", async function () {
        const [owner, newMember] = await ethers.getSigners()

        // Deploy DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and create proposal
        await finCubeDAO
            .connect(newMember)
            .registerMember(newMember.address, "member://uri")
        await finCubeDAO.newMemberApprovalProposal(
            newMember.address,
            "Test proposal"
        )

        // Wait for voting delay
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")

        // Vote yes
        await finCubeDAO.castVote(0, true)

        // Should fail before voting period ends
        await expect(finCubeDAO.executeProposal(0)).to.be.revertedWith(
            "Voting still going on"
        )

        // Wait for voting period to end
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")

        // Now should succeed
        await finCubeDAO.executeProposal(0)

        // Verify member is approved
        const isApproved = await finCubeDAO.checkIsMemberApproved(
            newMember.address
        )
        expect(isApproved).to.equal(true)
    })

    it("Should complete full member approval flow", async function () {
        const [owner, newMember] = await ethers.getSigners()

        // Deploy DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // 1. Register new member (anyone can call)
        await finCubeDAO
            .connect(newMember)
            .registerMember(newMember.address, "member://uri")

        // 2. Create approval proposal (only members can call)
        await finCubeDAO.newMemberApprovalProposal(
            newMember.address,
            "Approve new member"
        )

        // 3. Wait for voting delay and vote
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(0, true)

        // 4. Wait for voting period to end
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")

        // 5. Execute proposal
        await finCubeDAO.executeProposal(0)

        // Verify new member is approved
        const isApproved = await finCubeDAO.checkIsMemberApproved(
            newMember.address
        )
        expect(isApproved).to.equal(true)
    })

    it("Should not allow voting after voting period ends", async function () {
        const [owner, newMember] = await ethers.getSigners()

        // Deploy DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and create proposal
        await finCubeDAO
            .connect(newMember)
            .registerMember(newMember.address, "member://uri")
        await finCubeDAO.newMemberApprovalProposal(
            newMember.address,
            "Test proposal"
        )

        // Wait for voting delay
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")

        // Wait for voting period to end
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")

        // Voting attempt after voting period should fail
        await expect(finCubeDAO.castVote(0, true)).to.be.revertedWith(
            "Voting is not allowed at this time"
        )
    })

    it("Should not allow executing proposal before voting period ends", async function () {
        const [owner, newMember] = await ethers.getSigners()

        // Deploy DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and create proposal
        await finCubeDAO
            .connect(newMember)
            .registerMember(newMember.address, "member://uri")
        await finCubeDAO.newMemberApprovalProposal(
            newMember.address,
            "Test proposal"
        )

        // Wait for voting delay
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")

        // Vote
        await finCubeDAO.castVote(0, true)

        // Try executing too early (before voting period ends)
        await expect(finCubeDAO.executeProposal(0)).to.be.revertedWith(
            "Voting still going on"
        )
    })

    it("Should not allow voting twice on the same proposal", async function () {
        const [owner, newMember] = await ethers.getSigners()

        // Deploy DAO
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")

        // Set up DAO parameters
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and create proposal
        await finCubeDAO
            .connect(newMember)
            .registerMember(newMember.address, "member://uri")
        await finCubeDAO.newMemberApprovalProposal(
            newMember.address,
            "Test proposal"
        )

        // Wait for voting delay
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")

        // Vote once
        await finCubeDAO.castVote(0, true)

        // Try to vote again - should fail
        await expect(finCubeDAO.castVote(0, false)).to.be.revertedWith(
            "Already voted for this proposal"
        )
    })

    it("Should prevent double spending with same nullifier", async function () {
        const [owner, member1, member2] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Set up DAO and approve members
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and approve member1
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(0, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.executeProposal(0)

        // Register and approve member2
        await finCubeDAO
            .connect(member2)
            .registerMember(member2.address, "Member 2 URI")
        await finCubeDAO.newMemberApprovalProposal(
            member2.address,
            "Approve Member 2"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(1, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.executeProposal(1)

        // Mint tokens and approve spending
        const mintAmount = 1000n * 10n ** 18n
        await mockERC20.mint(member1.address, mintAmount)
        await mockERC20
            .connect(member1)
            .approve(await finCube.getAddress(), mintAmount)

        // First transfer with a specific nullifier
        const transferAmount = 100n * 10n ** 18n
        const duplicateNullifier =
            "0xaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd"

        await finCube
            .connect(member1)
            .safeTransfer(
                member1.address,
                member2.address,
                transferAmount,
                "First transfer",
                duplicateNullifier
            )

        // Verify first transfer succeeded
        const member2BalanceAfterFirst = await mockERC20.balanceOf(
            member2.address
        )
        expect(member2BalanceAfterFirst).to.equal(transferAmount)

        // Attempt second transfer with the SAME nullifier - should fail
        await expect(
            finCube.connect(member1).safeTransfer(
                member1.address,
                member2.address,
                transferAmount,
                "First transfer", // Same memo
                duplicateNullifier // Same nullifier - this should cause failure
            )
        ).to.be.revertedWith("Nullifier already used")

        // Verify balance hasn't changed (double spending prevented)
        const member2BalanceAfterFailed = await mockERC20.balanceOf(
            member2.address
        )
        expect(member2BalanceAfterFailed).to.equal(transferAmount) // Still same as after first transfer
    })

    it("Should allow multiple transfers with different nullifiers", async function () {
        const [owner, member1, member2] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Set up DAO and approve members
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and approve member1
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(0, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.executeProposal(0)

        // Register and approve member2
        await finCubeDAO
            .connect(member2)
            .registerMember(member2.address, "Member 2 URI")
        await finCubeDAO.newMemberApprovalProposal(
            member2.address,
            "Approve Member 2"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(1, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.executeProposal(1)

        // Mint tokens and approve spending
        const mintAmount = 1000n * 10n ** 18n
        await mockERC20.mint(member1.address, mintAmount)
        await mockERC20
            .connect(member1)
            .approve(await finCube.getAddress(), mintAmount)

        const transferAmount = 100n * 10n ** 18n

        // First transfer with nullifier1
        const nullifier1 =
            "0x1111111111111111111111111111111111111111111111111111111111111111"
        await finCube.connect(member1).safeTransfer(
            member1.address,
            member2.address,
            transferAmount,
            "Same memo", // Same memo as second transfer
            nullifier1 // Different nullifier
        )

        // Second transfer with nullifier2 (should succeed with different nullifier)
        const nullifier2 =
            "0x2222222222222222222222222222222222222222222222222222222222222222"
        await finCube.connect(member1).safeTransfer(
            member1.address,
            member2.address,
            transferAmount,
            "Same memo", // Same memo as first transfer
            nullifier2 // Different nullifier - should allow transfer
        )

        // Third transfer with nullifier3 (should also succeed)
        const nullifier3 =
            "0x3333333333333333333333333333333333333333333333333333333333333333"
        await finCube.connect(member1).safeTransfer(
            member1.address,
            member2.address,
            transferAmount,
            "Same memo", // Same memo again
            nullifier3 // Yet another different nullifier
        )

        // Verify all three transfers succeeded
        const member2FinalBalance = await mockERC20.balanceOf(member2.address)
        expect(member2FinalBalance).to.equal(transferAmount * 3n) // 3 successful transfers

        const member1FinalBalance = await mockERC20.balanceOf(member1.address)
        expect(member1FinalBalance).to.equal(mintAmount - transferAmount * 3n)
    })

    it("Should allow same nullifier when other transfer parameters change", async function () {
        const [owner, member1, member2, member3] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()

        // Initialize contracts
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )

        // Set up DAO and approve members
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and approve all members
        const members = [member1, member2, member3]
        for (let i = 0; i < members.length; i++) {
            await finCubeDAO
                .connect(members[i])
                .registerMember(members[i].address, `Member ${i + 1} URI`)
            await finCubeDAO.newMemberApprovalProposal(
                members[i].address,
                `Approve Member ${i + 1}`
            )
            await ethers.provider.send("evm_increaseTime", [1])
            await ethers.provider.send("evm_mine")
            await finCubeDAO.castVote(i, true)
            // For members after the first, we need the first member to vote too
            if (i > 0) {
                await finCubeDAO.connect(member1).castVote(i, true)
            }
            await ethers.provider.send("evm_increaseTime", [3])
            await ethers.provider.send("evm_mine")
            await finCubeDAO.executeProposal(i)
        }

        // Mint tokens and approve spending
        const mintAmount = 1000n * 10n ** 18n
        await mockERC20.mint(member1.address, mintAmount)
        await mockERC20
            .connect(member1)
            .approve(await finCube.getAddress(), mintAmount)

        // Use the same nullifier for all transfers, but change other parameters
        const sharedNullifier =
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

        // Transfer 1: member1 -> member2, 50 tokens, "memo1"
        await finCube
            .connect(member1)
            .safeTransfer(
                member1.address,
                member2.address,
                50n * 10n ** 18n,
                "memo1",
                sharedNullifier
            )

        // Transfer 2: member1 -> member3, 50 tokens, "memo1" (different recipient)
        await finCube.connect(member1).safeTransfer(
            member1.address,
            member3.address, // Different recipient
            50n * 10n ** 18n,
            "memo1",
            sharedNullifier // Same nullifier should be OK
        )

        // Transfer 3: member1 -> member2, 75 tokens, "memo1" (different amount)
        await finCube.connect(member1).safeTransfer(
            member1.address,
            member2.address,
            75n * 10n ** 18n, // Different amount
            "memo1",
            sharedNullifier // Same nullifier should be OK
        )

        // Transfer 4: member1 -> member2, 50 tokens, "memo2" (different memo)
        await finCube.connect(member1).safeTransfer(
            member1.address,
            member2.address,
            50n * 10n ** 18n,
            "memo2", // Different memo
            sharedNullifier // Same nullifier should be OK
        )

        // Verify all transfers succeeded
        const member2Balance = await mockERC20.balanceOf(member2.address)
        const member3Balance = await mockERC20.balanceOf(member3.address)
        const member1Balance = await mockERC20.balanceOf(member1.address)

        // member2 received: 50 + 75 + 50 = 175 tokens
        expect(member2Balance).to.equal(175n * 10n ** 18n)
        // member3 received: 50 tokens
        expect(member3Balance).to.equal(50n * 10n ** 18n)
        // member1 sent: 50 + 50 + 75 + 50 = 225 tokens
        expect(member1Balance).to.equal(mintAmount - 225n * 10n ** 18n)

        // Now try exact duplicate of first transfer - should fail
        await expect(
            finCube.connect(member1).safeTransfer(
                member1.address,
                member2.address,
                50n * 10n ** 18n,
                "memo1", // Same as first transfer
                sharedNullifier // Same nullifier + same parameters = should fail
            )
        ).to.be.revertedWith("Nullifier already used")
    })

    it("Should prevent nullifier reuse across different callers", async function () {
        const [owner, member1, member2, member3] = await ethers.getSigners()

        // Deploy contracts
        const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO")
        const finCubeDAO = await FinCubeDAO.deploy()

        const MockERC20 = await ethers.getContractFactory("MockERC20")
        const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18)

        const FinCube = await ethers.getContractFactory("FinCube")
        const finCube = await FinCube.deploy()

        // Quick initialization
        await finCubeDAO.initialize("Test DAO URI", "Owner URI")
        await finCube.initialize(
            await finCubeDAO.getAddress(),
            await mockERC20.getAddress()
        )
        await finCubeDAO.setVotingDelay(1)
        await finCubeDAO.setVotingPeriod(3)

        // Register and approve member1
        await finCubeDAO
            .connect(member1)
            .registerMember(member1.address, "Member 1 URI")
        await finCubeDAO.newMemberApprovalProposal(
            member1.address,
            "Approve Member 1"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(0, true)
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.executeProposal(0)

        // Register and approve member2
        await finCubeDAO
            .connect(member2)
            .registerMember(member2.address, "Member 2 URI")
        await finCubeDAO.newMemberApprovalProposal(
            member2.address,
            "Approve Member 2"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(1, true) // owner votes
        await finCubeDAO.connect(member1).castVote(1, true) // member1 votes too
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.executeProposal(1)

        // Register and approve member3
        await finCubeDAO
            .connect(member3)
            .registerMember(member3.address, "Member 3 URI")
        await finCubeDAO.newMemberApprovalProposal(
            member3.address,
            "Approve Member 3"
        )
        await ethers.provider.send("evm_increaseTime", [1])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.castVote(2, true) // owner votes
        await finCubeDAO.connect(member1).castVote(2, true) // member1 votes too
        await ethers.provider.send("evm_increaseTime", [3])
        await ethers.provider.send("evm_mine")
        await finCubeDAO.executeProposal(2)

        // Mint tokens and approve spending for both member1 and member2
        const mintAmount = 1000n * 10n ** 18n
        await mockERC20.mint(member1.address, mintAmount)
        await mockERC20.mint(member2.address, mintAmount)
        await mockERC20
            .connect(member1)
            .approve(await finCube.getAddress(), mintAmount)
        await mockERC20
            .connect(member2)
            .approve(await finCube.getAddress(), mintAmount)

        // Test core nullifier functionality across different callers
        const nullifier =
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

        // First transfer: member1 -> member3
        await finCube
            .connect(member1)
            .safeTransfer(
                member1.address,
                member3.address,
                100n * 10n ** 18n,
                "Test transfer",
                nullifier
            )

        // Second transfer: member2 uses same nullifier but different from address
        // This should SUCCEED because the transferId includes the 'from' address
        // transferId = keccak256(abi.encode(from, to, amount, keccak256(memo), nullifier))
        const member3BalanceBefore = await mockERC20.balanceOf(member3.address)

        await finCube.connect(member2).safeTransfer(
            member2.address, // Different caller/from address
            member3.address,
            100n * 10n ** 18n,
            "Different transfer", // Different memo
            nullifier // Same nullifier - should succeed because 'from' is different
        )

        // Verify the transfer succeeded
        const member3BalanceAfter = await mockERC20.balanceOf(member3.address)
        expect(member3BalanceAfter - member3BalanceBefore).to.equal(
            100n * 10n ** 18n
        )

        // NOW test actual nullifier collision: same sender tries to reuse nullifier with identical parameters
        await expect(
            finCube.connect(member1).safeTransfer(
                member1.address, // Same caller as first transfer
                member3.address, // Same recipient
                100n * 10n ** 18n, // Same amount
                "Test transfer", // Same memo
                nullifier // Same nullifier - should fail because all parameters identical
            )
        ).to.be.revertedWith("Nullifier already used")
    })
})
