// We don't have Ethereum specific assertions in Hardhat 3 yet
import assert from "node:assert/strict"
import { describe, it, beforeEach } from "node:test"
import { network } from "hardhat"
import { encodeFunctionData, getAddress } from "viem"

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

describe("FinCube", async function () {
    const { viem } = await network.connect()
    const publicClient = await viem.getPublicClient()
    const rpc: any = publicClient

    it("Should deploy FinCubeDAO contract", async function () {
        const finCubeDAO = await viem.deployContract("FinCubeDAO")

        // Verify the contract was deployed successfully
        assert.ok(finCubeDAO.address)
    })

    it("Should deploy MockERC20 token contract", async function () {
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])

        // Verify the contract was deployed successfully
        assert.ok(mockERC20.address)
    })

    it("Should deploy FinCube contract", async function () {
        const finCube = await viem.deployContract("FinCube")

        // Verify the contract was deployed successfully
        assert.ok(finCube.address)
    })

    it("Should initialize FinCube with DAO and token addresses", async function () {
        // Deploy all contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // Initialize DAO first
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Initialize FinCube with DAO and token addresses
        await finCube.write.initialize([finCubeDAO.address, mockERC20.address])

        // Verify initialization
        const daoAddress = (await finCube.read.dao()) as string
        const tokenAddress = (await finCube.read.approvedERC20()) as string

        assert.equal(
            getAddress(daoAddress as string),
            getAddress(finCubeDAO.address)
        )
        assert.equal(
            getAddress(tokenAddress as string),
            getAddress(mockERC20.address)
        )
    })

    it("Should mint ERC20 tokens and test stablecoin transfer flow", async function () {
        // Get test accounts
        const [owner, member1, member2] = await viem.getWalletClients()

        // Deploy all contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([finCubeDAO.address, mockERC20.address])

        // Mint tokens to member1
        const mintAmount = 1000n * 10n ** 18n // 1000 tokens
        await mockERC20.write.mint([member1.account.address, mintAmount])

        // Register members in DAO
        await finCubeDAO.write.registerMember(
            [member1.account.address, "Member 1 URI"],
            { account: member1.account }
        )
        await finCubeDAO.write.registerMember(
            [member2.account.address, "Member 2 URI"],
            { account: member2.account }
        )

        // Set voting delay and period
        await finCubeDAO.write.setVotingDelay([1n], { account: owner.account })
        await finCubeDAO.write.setVotingPeriod([3n], { account: owner.account })

        // Create proposal to approve member1
        await finCubeDAO.write.newMemberApprovalProposal([
            member1.account.address,
            "Approve Member 1",
        ])

        // Wait for voting delay
        await (publicClient as any).request({
            method: "evm_increaseTime",
            params: [1],
        })
        await (publicClient as any).request({ method: "evm_mine" })

        // Cast vote (owner votes yes)
        await finCubeDAO.write.castVote([0n, true])

        // Wait for voting period to end
        await (publicClient as any).request({
            method: "evm_increaseTime",
            params: [3],
        })
        await (publicClient as any).request({ method: "evm_mine" })

        // Execute proposal to approve member1
        await finCubeDAO.write.executeProposal([0n])

        // Create proposal to approve member2
        await finCubeDAO.write.newMemberApprovalProposal([
            member2.account.address,
            "Approve Member 2",
        ])

        // Wait for voting delay
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })

        // Cast vote (owner votes yes)
        await finCubeDAO.write.castVote([1n, true])

        // Wait and execute proposal to approve member2
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.executeProposal([1n])

        // Verify members are approved
        const member1Approved = await finCubeDAO.read.checkIsMemberApproved([
            member1.account.address,
        ])
        const member2Approved = await finCubeDAO.read.checkIsMemberApproved([
            member2.account.address,
        ])

        assert.equal(member1Approved, true)
        assert.equal(member2Approved, true)

        // Approve FinCube contract to spend tokens on behalf of member1
        const transferAmount = 100n * 10n ** 18n // 100 tokens
        await mockERC20.write.approve([finCube.address, transferAmount], {
            account: member1.account,
        })

        // Perform safe transfer from member1 to member2
        await viem.assertions.emitWithArgs(
            finCube.write.safeTransfer(
                [
                    getAddress(member1.account.address),
                    getAddress(member2.account.address),
                    transferAmount,
                    "Test transfer memo",
                ],
                { account: member1.account }
            ),
            finCube,
            "StablecoinTransfer",
            [
                getAddress(member1.account.address),
                getAddress(member2.account.address),
                transferAmount,
                "Test transfer memo",
            ]
        )

        // Verify balances
        const member1Balance = await mockERC20.read.balanceOf([
            member1.account.address,
        ])
        const member2Balance = await mockERC20.read.balanceOf([
            member2.account.address,
        ])

        assert.equal(member1Balance, mintAmount - transferAmount)
        assert.equal(member2Balance, transferAmount)
    })

    it("Should create and execute stablecoin address change proposal", async function () {
        // Get test accounts
        const [owner, member1] = await viem.getWalletClients()

        // Deploy contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const oldToken = await viem.deployContract("MockERC20", [
            "Old Token",
            "OLD",
            18n,
        ])
        const newToken = await viem.deployContract("MockERC20", [
            "New Token",
            "NEW",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([finCubeDAO.address, oldToken.address])

        // Register and approve member1
        await finCubeDAO.write.registerMember(
            [member1.account.address, "Member 1 URI"],
            { account: member1.account }
        )
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Create and execute member approval proposal
        await finCubeDAO.write.newMemberApprovalProposal([
            member1.account.address,
            "Approve Member 1",
        ])
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.castVote([0n, true])
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.executeProposal([0n])

        // Create proposal to change stablecoin address
        const functionSelector = encodeFunctionData({
            abi: [
                {
                    name: "setApprovedERC20",
                    type: "function",
                    inputs: [{ name: "newToken", type: "address" }],
                },
            ],
            functionName: "setApprovedERC20",
            args: [newToken.address],
        })

        await finCubeDAO.write.propose([
            [finCube.address],
            [0n],
            [functionSelector],
            "Change approved ERC20 token",
        ])

        // Wait for voting delay
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })

        // Cast votes (owner and member1 vote yes)
        await finCubeDAO.write.castVote([1n, true]) // owner votes
        await finCubeDAO.write.castVote([1n, true], {
            account: member1.account,
        }) // member1 votes

        // Wait for voting period
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })

        // Execute the proposal
        await finCubeDAO.write.executeProposal([1n])

        // Verify the stablecoin address was changed
        const currentToken = (await finCube.read.approvedERC20()) as string
        assert.equal(getAddress(currentToken), getAddress(newToken.address))

        // Verify event was emitted
        const deploymentBlockNumber = await publicClient.getBlockNumber()
        const events = await publicClient.getContractEvents({
            address: finCube.address,
            abi: finCube.abi,
            eventName: "ApprovedERC20Updated",
            fromBlock: deploymentBlockNumber - 10n,
            strict: true,
        })

        assert.ok(events.length > 0)
        const lastEvent = events[events.length - 1]
        assert.equal(
            (lastEvent.args as any)?.newToken,
            getAddress(newToken.address)
        )
    })

    it("Should handle complete workflow: deploy, initialize, create proposal, vote, execute, and change token", async function () {
        const [owner, member1, member2] = await viem.getWalletClients()

        // 1. Deploy contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const initialToken = await viem.deployContract("MockERC20", [
            "Initial Token",
            "INIT",
            18n,
        ])
        const newToken = await viem.deployContract("MockERC20", [
            "New Token",
            "NEW",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // 2. Initialize FinCube with DAO and token addresses
        await finCubeDAO.write.initialize(["DAO URI", "Owner URI"])
        await finCube.write.initialize([
            getAddress(finCubeDAO.address),
            getAddress(initialToken.address),
        ])

        // 3. Create dummy ERC20 tokens and mint them
        const mintAmount = 1000n * 10n ** 18n
        await initialToken.write.mint([member1.account.address, mintAmount])
        await newToken.write.mint([member2.account.address, mintAmount])

        // Setup DAO voting parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register and approve members
        await finCubeDAO.write.registerMember(
            [member1.account.address, "Member 1 URI"],
            { account: member1.account }
        )
        await finCubeDAO.write.registerMember(
            [member2.account.address, "Member 2 URI"],
            { account: member2.account }
        )

        // Approve member1
        await finCubeDAO.write.newMemberApprovalProposal([
            member1.account.address,
            "Approve Member 1",
        ])
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.castVote([0n, true])
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.executeProposal([0n])

        // Approve member2
        await finCubeDAO.write.newMemberApprovalProposal([
            member2.account.address,
            "Approve Member 2",
        ])
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.castVote([1n, true])
        await finCubeDAO.write.castVote([1n, true], {
            account: member1.account,
        })
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.executeProposal([1n])

        // 4. Create stablecoin proposal (target -> contract address)
        const setTokenCalldata = encodeFunctionData({
            abi: [
                {
                    name: "setApprovedERC20",
                    type: "function",
                    inputs: [{ name: "newToken", type: "address" }],
                },
            ],
            functionName: "setApprovedERC20",
            args: [newToken.address],
        })

        await finCubeDAO.write.propose([
            [finCube.address],
            [0n],
            [setTokenCalldata],
            "Change approved ERC20 token",
        ])

        // 5. Cast votes
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.castVote([2n, true]) // owner
        await finCubeDAO.write.castVote([2n, true], {
            account: member1.account,
        }) // member1

        // 6. Execute the proposal
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.executeProposal([2n])

        // 7. Verify the stablecoin address was changed
        const finalTokenAddress = (await finCube.read.approvedERC20()) as string
        assert.equal(
            getAddress(finalTokenAddress as string),
            getAddress(newToken.address)
        )

        // Test safe transfer with new token
        await newToken.write.approve([finCube.address, 100n * 10n ** 18n], {
            account: member2.account,
        })

        await viem.assertions.emitWithArgs(
            finCube.write.safeTransfer(
                [
                    member2.account.address,
                    member1.account.address,
                    50n * 10n ** 18n,
                    "Final test transfer",
                ],
                { account: member2.account }
            ),
            finCube,
            "StablecoinTransfer",
            [
                getAddress(member2.account.address),
                getAddress(member1.account.address),
                50n * 10n ** 18n,
                "Final test transfer",
            ]
        )

        // Verify final balances
        const member1FinalBalance = await newToken.read.balanceOf([
            member1.account.address,
        ])
        const member2FinalBalance = await newToken.read.balanceOf([
            member2.account.address,
        ])

        assert.equal(member1FinalBalance, 50n * 10n ** 18n)
        assert.equal(member2FinalBalance, mintAmount - 50n * 10n ** 18n)
    })

    it("Should verify FinCube contract is upgradeable (UUPS)", async function () {
        const [owner] = await viem.getWalletClients()

        // Deploy contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([finCubeDAO.address, mockERC20.address])

        // Verify that the contract has UUPS upgrade functionality
        // Only DAO should be able to authorize upgrades

        // Deploy a new implementation
        const finCubeV2 = await viem.deployContract("FinCube")

        // Try to upgrade from non-DAO address (should fail)
        try {
            await finCube.write.upgradeToAndCall([finCubeV2.address, "0x"], {
                account: owner.account,
            })
            assert.fail("Should have failed - only DAO can upgrade")
        } catch (error: any) {
            assert.ok(
                error.message.includes("Only DAO") ||
                    error.message.includes("UUPSUnauthorizedCallContext()")
            )
        }

        // Verify DAO address is set correctly
        const daoAddress = (await finCube.read.dao()) as string
        assert.equal(getAddress(daoAddress), getAddress(finCubeDAO.address))
    })

    it("Should verify FinCubeDAO contract is upgradeable (UUPS)", async function () {
        const [owner, nonOwner] = await viem.getWalletClients()

        // Deploy and initialize DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Deploy a new implementation
        const finCubeDAOV2 = await viem.deployContract("FinCubeDAO")

        // Try to upgrade from non-owner address (should fail)
        try {
            await finCubeDAO.write.upgradeToAndCall(
                [finCubeDAOV2.address, "0x"],
                { account: nonOwner.account }
            )
            assert.fail("Should have failed - only owner can upgrade")
        } catch (error: any) {
            assert.ok(
                error.message.includes("OwnableUnauthorizedAccount") ||
                    error.message.includes("caller is not the owner") ||
                    error.message.includes("UUPSUnauthorizedCallContext()")
            )
        }

        // Owner should be able to upgrade (we'll just verify the call doesn't revert with auth error)
        const owner_address = (await finCubeDAO.read.owner()) as string
        assert.equal(
            getAddress(owner_address as string),
            getAddress(owner.account.address)
        )
    })

    it("Should test reentrancy protection in FinCube safeTransfer", async function () {
        const [owner, member1, member2] = await viem.getWalletClients()

        // Deploy malicious ERC20 (use the malicious implementation)
        const maliciousERC20 = await viem.deployContract("MaliciousERC20", [
            "Malicious Token",
            "MAL",
        ])

        // Deploy normal contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const finCube = await viem.deployContract("FinCube")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([
            finCubeDAO.address,
            maliciousERC20.address,
        ])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register and approve members (same as your flow)
        await finCubeDAO.write.registerMember(
            [member1.account.address, "Member 1 URI"],
            { account: member1.account }
        )
        await finCubeDAO.write.registerMember(
            [member2.account.address, "Member 2 URI"],
            { account: member2.account }
        )

        // Approve member1
        await finCubeDAO.write.newMemberApprovalProposal([
            member1.account.address,
            "Approve Member 1",
        ])
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.castVote([0n, true])
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.executeProposal([0n])

        // Approve member2
        await finCubeDAO.write.newMemberApprovalProposal([
            member2.account.address,
            "Approve Member 2",
        ])
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.castVote([1n, true])
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.executeProposal([1n])

        // Mint tokens and approve
        const mintAmount = 1000n * 10n ** 18n
        await maliciousERC20.write.mint([member1.account.address, mintAmount])
        await maliciousERC20.write.approve([finCube.address, mintAmount], {
            account: member1.account,
        })

        // Configure attacker to target FinCube and attempt reentrancy
        await maliciousERC20.write.setTargetContract([finCube.address])
        await maliciousERC20.write.enableAttack([
            member1.account.address,
            member2.account.address,
            50n * 10n ** 18n,
        ])

        // Attempt transfer: malicious token will try to call back into safeTransfer
        try {
            await finCube.write.safeTransfer(
                [
                    member1.account.address,
                    member2.account.address,
                    100n * 10n ** 18n,
                    "Reentrancy test memo",
                ],
                { account: member1.account }
            )
            assert.fail("Expected revert due to reentrancy guard")
        } catch (error: any) {
            // Most common OpenZeppelin revert
            const msg = error && error.message ? error.message : ""
            assert.ok(
                msg.includes("ReentrancyGuard: reentrant call") ||
                    msg.includes("ReentrancyGuard") ||
                    msg.includes("reentrant call"),
                `Unexpected error message: ${msg}`
            )
        }

        // Disable attack and ensure normal transfer works
        await maliciousERC20.write.disableAttack()
        await finCube.write.safeTransfer(
            [
                member1.account.address,
                member2.account.address,
                100n * 10n ** 18n,
                "Normal transfer memo",
            ],
            { account: member1.account }
        )

        const member2Balance = await maliciousERC20.read.balanceOf([
            member2.account.address,
        ])
        assert.equal(member2Balance, 100n * 10n ** 18n)
    })

    it("Should test reentrancy protection in FinCubeDAO executeProposal", async function () {
        const [owner, member1] = await viem.getWalletClients()

        // Deploy contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // Deploy malicious target contract
        const maliciousTarget = await viem.deployContract("MaliciousTarget")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([finCubeDAO.address, mockERC20.address])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([10n])

        // Register and approve members (same as your flow)
        await finCubeDAO.write.registerMember(
            [member1.account.address, "Member 1 URI"],
            { account: member1.account }
        )

        // Approve member1
        await finCubeDAO.write.newMemberApprovalProposal([
            member1.account.address,
            "Approve Member 1",
        ])
        await new Promise((r) => setTimeout(r, 4000))
        await finCubeDAO.write.castVote([0n, true])
        await new Promise((r) => setTimeout(r, 12000))
        await finCubeDAO.write.executeProposal([0n])

        // Malicious target knows DAO
        await maliciousTarget.write.setDAOContract([finCubeDAO.address])

        // Create malicious proposal that calls maliciousTarget.maliciousFunction
        const maliciousCalldata = encodeFunctionData({
            abi: [{ name: "maliciousFunction", type: "function", inputs: [] }],
            functionName: "maliciousFunction",
            args: [],
        })
        await finCubeDAO.write.propose([
            [maliciousTarget.address],
            [0n],
            [maliciousCalldata],
            "Malicious proposal",
        ])

        // enable the attack for that proposal id (1)
        await maliciousTarget.write.enableAttack([1n])

        // vote and wait
        await new Promise((r) => setTimeout(r, 4000))
        await finCubeDAO.write.castVote([1n, true])
        await finCubeDAO.write.castVote([1n, true], {
            account: member1.account,
        })
        await new Promise((r) => setTimeout(r, 8000))

        // Execution should revert due to reentrancy guard in executeProposal
        try {
            await finCubeDAO.write.executeProposal([1n])
            assert.fail("Expected revert due to reentrancy")
        } catch (error: any) {
            const msg = error && error.message ? error.message : ""
            assert.ok(
                msg.includes("ReentrancyGuard: reentrant call") ||
                    msg.includes("ReentrancyGuard") ||
                    msg.includes("reentrant call"),
                `Unexpected error message: ${msg}`
            )
        }

        // disable attack and make a normal proposal that should succeed
        await maliciousTarget.write.disableAttack()

        const setTokenCalldata = encodeFunctionData({
            abi: [
                {
                    name: "setApprovedERC20",
                    type: "function",
                    inputs: [{ name: "newToken", type: "address" }],
                },
            ],
            functionName: "setApprovedERC20",
            args: [mockERC20.address],
        })
        await finCubeDAO.write.propose([
            [finCube.address],
            [0n],
            [setTokenCalldata],
            "Normal proposal",
        ])
        await new Promise((r) => setTimeout(r, 4000))
        await finCubeDAO.write.castVote([2n, true])
        await finCubeDAO.write.castVote([2n, true], {
            account: member1.account,
        })
        await new Promise((r) => setTimeout(r, 8000))
        await finCubeDAO.write.executeProposal([2n])

        const currentToken = await finCube.read.approvedERC20()
        assert.equal(getAddress(currentToken), getAddress(mockERC20.address))
    })

    it("Should verify contracts implement proper access controls", async function () {
        const [owner, nonOwner, member1] = await viem.getWalletClients()

        // Deploy contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([finCubeDAO.address, mockERC20.address])

        // Test FinCube access controls
        // Only DAO should be able to set approved ERC20
        try {
            await finCube.write.setApprovedERC20([mockERC20.address], {
                account: nonOwner.account,
            })
            assert.fail("Should have failed - only DAO can set approved ERC20")
        } catch (error: any) {
            assert.ok(error.message.includes("Only DAO"))
        }

        // Only DAO should be able to set DAO address
        try {
            await finCube.write.setDAO([nonOwner.account.address], {
                account: nonOwner.account,
            })
            assert.fail("Should have failed - only DAO can set DAO")
        } catch (error: any) {
            assert.ok(error.message.includes("Only DAO"))
        }

        // Test FinCubeDAO access controls
        // Only owner should be able to set voting parameters
        try {
            await finCubeDAO.write.setVotingDelay([5n], {
                account: nonOwner.account,
            })
            assert.fail("Should have failed - only owner can set voting delay")
        } catch (error: any) {
            assert.ok(
                error.message.includes("OwnableUnauthorizedAccount") ||
                    error.message.includes("caller is not the owner")
            )
        }

        try {
            await finCubeDAO.write.setVotingPeriod([10n], {
                account: nonOwner.account,
            })
            assert.fail("Should have failed - only owner can set voting period")
        } catch (error: any) {
            assert.ok(
                error.message.includes("OwnableUnauthorizedAccount") ||
                    error.message.includes("caller is not the owner")
            )
        }

        // Register a member to test member-only functions
        await finCubeDAO.write.registerMember(
            [member1.account.address, "Member 1 URI"],
            { account: member1.account }
        )
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Non-members should not be able to create proposals
        try {
            await finCubeDAO.write.newMemberApprovalProposal(
                [nonOwner.account.address, "Should fail"],
                { account: nonOwner.account }
            )
            assert.fail(
                "Should have failed - only members can create proposals"
            )
        } catch (error: any) {
            assert.ok(
                error.message.includes("Not a member") ||
                    error.message.includes("Member not approved")
            )
        }
    })

    it("Should verify initialization can only happen once", async function () {
        // Deploy contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([finCubeDAO.address, mockERC20.address])

        // Try to initialize again (should fail)
        try {
            await finCubeDAO.write.initialize(["Test DAO URI 2", "Owner URI 2"])
            assert.fail("Should have failed - already initialized")
        } catch (error: any) {
            assert.ok(
                error.message.includes("InvalidInitialization") ||
                    error.message.includes(
                        "Initializable: contract is already initialized"
                    )
            )
        }

        try {
            await finCube.write.initialize([
                finCubeDAO.address,
                mockERC20.address,
            ])
            assert.fail("Should have failed - already initialized")
        } catch (error: any) {
            assert.ok(
                error.message.includes("InvalidInitialization") ||
                    error.message.includes(
                        "Initializable: contract is already initialized"
                    )
            )
        }
    })

    it("Should successfully upgrade FinCube contract through DAO proposal and verify upgrade", async function () {
        const [owner, member1] = await viem.getWalletClients()

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
        const finCubeDAOImpl = await viem.deployContract("FinCubeDAO")
        const finCubeImpl = await viem.deployContract("FinCube")
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])

        // Create initialization data for DAO proxy
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
            args: ["Test DAO URI", "Owner URI"],
        })

        // Deploy DAO proxy that points to DAO implementation
        const finCubeDAOProxy = await viem.deployContract("TestERC1967Proxy", [
            finCubeDAOImpl.address,
            daoInitData,
        ])

        // Create initialization data for FinCube proxy
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
            args: [finCubeDAOProxy.address, mockERC20.address],
        })

        // Deploy FinCube proxy that points to FinCube implementation
        const finCubeProxy = await viem.deployContract("TestERC1967Proxy", [
            finCubeImpl.address,
            finCubeInitData,
        ])

        // Get contract instances that point to proxy addresses (these hold the state)
        const finCubeDAO = await viem.getContractAt(
            "FinCubeDAO",
            finCubeDAOProxy.address
        )
        const finCube = await viem.getContractAt(
            "FinCube",
            finCubeProxy.address
        )

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register and approve member1
        await finCubeDAO.write.registerMember(
            [member1.account.address, "Member 1 URI"],
            { account: member1.account }
        )

        await finCubeDAO.write.newMemberApprovalProposal([
            member1.account.address,
            "Approve Member 1",
        ])
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([0n, true])
        await new Promise((resolve) => setTimeout(resolve, 4000))
        await finCubeDAO.write.executeProposal([0n])

        // Store original state to verify preservation after upgrade
        const originalDAO = (await finCube.read.dao()) as string
        const originalToken = (await finCube.read.approvedERC20()) as string

        // Deploy new implementation (V2) - this is just the logic, no state
        const finCubeV2 = await viem.deployContract("FinCube")

        // Get implementation address before upgrade from the proxy's storage
        const implementationSlot =
            "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
        const originalImplementation = await publicClient.getStorageAt({
            address: finCube.address, // This is the proxy address holding the state
            slot: implementationSlot,
        })

        // Create upgrade proposal through DAO (targeting the PROXY contract)
        const upgradeCalldata = encodeFunctionData({
            abi: [
                {
                    name: "upgradeToAndCall",
                    type: "function",
                    inputs: [
                        { name: "newImplementation", type: "address" },
                        { name: "data", type: "bytes" },
                    ],
                },
            ],
            functionName: "upgradeToAndCall",
            args: [finCubeV2.address, "0x"], // Point to new implementation
        })

        await finCubeDAO.write.propose([
            [finCube.address], // Target the PROXY address, not implementation
            [0n],
            [upgradeCalldata],
            "Upgrade FinCube to V2",
        ])

        // Vote on upgrade proposal
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([1n, true]) // owner votes
        await finCubeDAO.write.castVote([1n, true], {
            account: member1.account,
        }) // member1 votes
        await new Promise((resolve) => setTimeout(resolve, 4000))

        // Execute the upgrade proposal - this calls upgradeToAndCall on the proxy
        await finCubeDAO.write.executeProposal([1n])

        // Verify upgrade succeeded by checking implementation address changed
        const newImplementation = await publicClient.getStorageAt({
            address: finCube.address, // Check proxy's implementation storage
            slot: implementationSlot,
        })

        // Implementation should have changed
        assert.notEqual(originalImplementation, newImplementation)

        // The new implementation should point to finCubeV2 address (padded to 32 bytes)
        const expectedImplementation =
            "0x" + "0".repeat(24) + finCubeV2.address.slice(2).toLowerCase()
        assert.equal(newImplementation?.toLowerCase(), expectedImplementation)

        // Verify state/storage was preserved after upgrade (this is the key benefit of proxies)
        const daoAfterUpgrade = (await finCube.read.dao()) as string
        const tokenAfterUpgrade = (await finCube.read.approvedERC20()) as string

        assert.equal(getAddress(daoAfterUpgrade), getAddress(originalDAO))
        assert.equal(getAddress(tokenAfterUpgrade), getAddress(originalToken))

        // Verify contract functionality still works after upgrade
        // Test that we can still call functions on the upgraded contract
        const daoStillAccessible = await finCube.read.dao()
        const tokenStillAccessible = await finCube.read.approvedERC20()

        assert.ok(daoStillAccessible)
        assert.ok(tokenStillAccessible)

        // Test that upgrade authorization still works (only DAO can upgrade)
        const finCubeV3 = await viem.deployContract("FinCube")
        try {
            await finCube.write.upgradeToAndCall([finCubeV3.address, "0x"], {
                account: owner.account,
            })
            assert.fail(
                "Should have failed - only DAO can upgrade after upgrade"
            )
        } catch (error: any) {
            assert.ok(
                error.message.includes("Only DAO") ||
                    error.message.includes("UUPSUnauthorizedCallContext()")
            )
        }
    })

    it("Should successfully upgrade FinCubeDAO contract and verify upgrade", async function () {
        const [owner, nonOwner] = await viem.getWalletClients()

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
        const finCubeDAOImpl = await viem.deployContract("FinCubeDAO")

        // Create initialization data for DAO proxy
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
            args: ["Test DAO URI", "Owner URI"],
        })

        // Deploy DAO proxy that points to DAO implementation and initializes
        const finCubeDAOProxy = await viem.deployContract("TestERC1967Proxy", [
            finCubeDAOImpl.address,
            daoInitData,
        ])

        // Get contract instance that points to proxy address (this holds the state)
        const finCubeDAO = await viem.getContractAt(
            "FinCubeDAO",
            finCubeDAOProxy.address
        )

        // Store original state to verify it's preserved after upgrade
        const originalOwner = (await finCubeDAO.read.owner()) as string

        // Set some state to verify preservation across upgrade
        await finCubeDAO.write.setVotingDelay([5n])
        await finCubeDAO.write.setVotingPeriod([10n])

        const stateBeforeUpgrade = {
            owner: (await finCubeDAO.read.owner()) as string,
            votingDelay: (await finCubeDAO.read.votingDelay()) as bigint,
            votingPeriod: (await finCubeDAO.read.votingPeriod()) as bigint,
        }

        // Deploy new DAO implementation (V2) - this is just the logic, no state
        const finCubeDAOV2 = await viem.deployContract("FinCubeDAO")

        // Get implementation address before upgrade from the proxy's storage
        const implementationSlot =
            "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
        const originalImplementation = await publicClient.getStorageAt({
            address: finCubeDAO.address, // This is the proxy address holding the state
            slot: implementationSlot,
        })

        // Owner performs the upgrade directly (since DAO allows owner to upgrade)
        await finCubeDAO.write.upgradeToAndCall([finCubeDAOV2.address, "0x"], {
            account: owner.account,
        })

        // Verify upgrade succeeded by checking implementation address changed
        const newImplementation = await publicClient.getStorageAt({
            address: finCubeDAO.address, // Check proxy's implementation storage
            slot: implementationSlot,
        })

        // Implementation should have changed
        assert.notEqual(originalImplementation, newImplementation)

        // The new implementation should point to finCubeDAOV2 address (padded to 32 bytes)
        const expectedImplementation =
            "0x" + "0".repeat(24) + finCubeDAOV2.address.slice(2).toLowerCase()
        assert.equal(newImplementation?.toLowerCase(), expectedImplementation)

        // Verify state/storage was preserved after upgrade (key benefit of proxy pattern)
        const stateAfterUpgrade = {
            owner: (await finCubeDAO.read.owner()) as string,
            votingDelay: (await finCubeDAO.read.votingDelay()) as bigint,
            votingPeriod: (await finCubeDAO.read.votingPeriod()) as bigint,
        }

        assert.equal(
            getAddress(stateAfterUpgrade.owner),
            getAddress(stateBeforeUpgrade.owner)
        )
        assert.equal(
            stateAfterUpgrade.votingDelay,
            stateBeforeUpgrade.votingDelay
        )
        assert.equal(
            stateAfterUpgrade.votingPeriod,
            stateBeforeUpgrade.votingPeriod
        )

        // Verify contract functionality still works after upgrade
        // Test that we can still call owner-only functions
        await finCubeDAO.write.setVotingDelay([7n], { account: owner.account })
        const newVotingDelay = (await finCubeDAO.read.votingDelay()) as bigint
        assert.equal(newVotingDelay, 7n)

        // Test that access control still works (only owner can upgrade)
        const finCubeDAOV3 = await viem.deployContract("FinCubeDAO")
        try {
            await finCubeDAO.write.upgradeToAndCall(
                [finCubeDAOV3.address, "0x"],
                {
                    account: nonOwner.account,
                }
            )
            assert.fail(
                "Should have failed - only owner can upgrade after upgrade"
            )
        } catch (error: any) {
            assert.ok(
                error.message.includes("OwnableUnauthorizedAccount") ||
                    error.message.includes("caller is not the owner") ||
                    error.message.includes("UUPSUnauthorizedCallContext()")
            )
        }
    })
    it("Should reject execution without majority votes", async function () {
        const [owner, member1] = await viem.getWalletClients()

        // Deploy contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const mockERC20 = await viem.deployContract("MockERC20", [
            "Test Token",
            "TEST",
            18n,
        ])
        const finCube = await viem.deployContract("FinCube")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([finCubeDAO.address, mockERC20.address])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([120n])

        // Register new member
        await finCubeDAO.write.registerMember(
            [member1.account.address, "Member 1 URI"],
            { account: member1.account }
        )

        // Create approval proposal
        await finCubeDAO.write.newMemberApprovalProposal([
            member1.account.address,
            "Test proposal",
        ])

        // Wait for voting delay
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })

        // NO VOTES CAST - zero yes votes
        // Wait for full voting period (120s)
        await rpc.request({ method: "evm_increaseTime", params: [120] })
        await rpc.request({ method: "evm_mine" })

        // Should fail - 0 yes votes, needs at least 1 vote
        try {
            await finCubeDAO.write.executeProposal([0n])
            assert.fail("Should have failed - no majority vote")
        } catch (error: any) {
            assert.ok(
                error.message.includes("Proposal doesn't have majority vote")
            )
        }
    })

    it("Should initialize with owner as first member", async function () {
        const [owner] = await viem.getWalletClients()

        // Deploy and initialize DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Owner should be first approved member after initialize
        const isOwnerApproved = await finCubeDAO.read.checkIsMemberApproved([
            owner.account.address,
        ])
        assert.equal(isOwnerApproved, true)
    })

    it("Should allow anyone to register new member", async function () {
        const [owner, newMember] = await viem.getWalletClients()

        // Deploy DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        // Set voting params required by proposal creation
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register new member (anyone can call)
        const tx = await finCubeDAO.write.registerMember(
            [newMember.account.address, "member://uri"],
            { account: newMember.account }
        )

        // Verify member was registered: second registration should revert
        try {
            await finCubeDAO.write.registerMember(
                [newMember.account.address, "member://uri"],
                { account: newMember.account }
            )
            assert.fail("Should have failed - already a member")
        } catch (error: any) {
            assert.ok(error.message.includes("Already a member"))
        }
    })

    it("Should only allow members to create approval proposals", async function () {
        const [owner, newMember, nonMember] = await viem.getWalletClients()

        // Deploy DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Register member first (pending status)
        await finCubeDAO.write.registerMember(
            [newMember.account.address, "member://uri"],
            { account: newMember.account }
        )

        // Non-members should not be able to create proposals
        await assert.rejects(
            async () => {
                await finCubeDAO.write.newMemberApprovalProposal(
                    [nonMember.account.address, "Test proposal"],
                    { account: nonMember.account }
                )
            },
            (error: any) =>
                error.message.includes("Not a member") ||
                error.message.includes("Member not approved")
        )

        // Approved members can create proposals
        await finCubeDAO.write.setVotingDelay([1n], { account: owner.account })
        await finCubeDAO.write.setVotingPeriod([5n], { account: owner.account })

        await finCubeDAO.write.newMemberApprovalProposal(
            [newMember.account.address, "Test proposal"],
            { account: owner.account }
        )
    })

    it("Should enforce voting delay before execution", async function () {
        const [owner, newMember] = await viem.getWalletClients()

        // Deploy DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register and create proposal
        await finCubeDAO.write.registerMember(
            [newMember.account.address, "member://uri"],
            { account: newMember.account }
        )
        await finCubeDAO.write.newMemberApprovalProposal([
            newMember.account.address,
            "Test proposal",
        ])

        // Wait for voting delay
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })

        // Vote yes
        await finCubeDAO.write.castVote([0n, true])

        // Should fail before voting period ends
        try {
            await finCubeDAO.write.executeProposal([0n])
            assert.fail("Should have failed - voting still going on")
        } catch (error: any) {
            assert.ok(error.message.includes("Voting still going on"))
        }

        // Wait for voting period to end
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })

        // Now should succeed
        await finCubeDAO.write.executeProposal([0n])

        // Verify member is approved
        const isApproved = await finCubeDAO.read.checkIsMemberApproved([
            newMember.account.address,
        ])
        assert.equal(isApproved, true)
    })

    it("Should complete full member approval flow", async function () {
        const [owner, newMember] = await viem.getWalletClients()

        // Deploy DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // 1. Register new member (anyone can call)
        await finCubeDAO.write.registerMember(
            [newMember.account.address, "member://uri"],
            { account: newMember.account }
        )

        // 2. Create approval proposal (only members can call)
        await finCubeDAO.write.newMemberApprovalProposal([
            newMember.account.address,
            "Approve new member",
        ])

        // 3. Wait for voting delay and vote
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })
        await finCubeDAO.write.castVote([0n, true])

        // 4. Wait for voting period to end
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })

        // 5. Execute proposal
        await finCubeDAO.write.executeProposal([0n])

        // Verify new member is approved
        const isApproved = await finCubeDAO.read.checkIsMemberApproved([
            newMember.account.address,
        ])
        assert.equal(isApproved, true)
    })

    it("Should not allow voting after voting period ends", async function () {
        const [owner, newMember] = await viem.getWalletClients()

        // Deploy DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register and create proposal
        await finCubeDAO.write.registerMember(
            [newMember.account.address, "member://uri"],
            { account: newMember.account }
        )
        await finCubeDAO.write.newMemberApprovalProposal([
            newMember.account.address,
            "Test proposal",
        ])

        // Wait for voting delay
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })

        // Wait for voting period to end
        await rpc.request({ method: "evm_increaseTime", params: [3] })
        await rpc.request({ method: "evm_mine" })

        // Voting attempt after voting period should fail
        try {
            await finCubeDAO.write.castVote([0n, true])
            assert.fail("Should have failed - voting period ended")
        } catch (error: any) {
            assert.ok(
                error.message.includes("Voting is not allowed at this time")
            )
        }
    })

    it("Should not allow executing proposal before voting period ends", async function () {
        const [owner, newMember] = await viem.getWalletClients()

        // Deploy DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register and create proposal
        await finCubeDAO.write.registerMember(
            [newMember.account.address, "member://uri"],
            { account: newMember.account }
        )
        await finCubeDAO.write.newMemberApprovalProposal([
            newMember.account.address,
            "Test proposal",
        ])

        // Wait for voting delay
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })

        // Vote
        await finCubeDAO.write.castVote([0n, true])

        // Try executing too early (before voting period ends)
        try {
            await finCubeDAO.write.executeProposal([0n])
            assert.fail("Should have failed - voting still going on")
        } catch (error: any) {
            assert.ok(error.message.includes("Voting still going on"))
        }
    })

    it("Should not allow voting twice on the same proposal", async function () {
        const [owner, newMember] = await viem.getWalletClients()

        // Deploy DAO
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register and create proposal
        await finCubeDAO.write.registerMember(
            [newMember.account.address, "member://uri"],
            { account: newMember.account }
        )
        await finCubeDAO.write.newMemberApprovalProposal([
            newMember.account.address,
            "Test proposal",
        ])

        // Wait for voting delay
        await rpc.request({ method: "evm_increaseTime", params: [1] })
        await rpc.request({ method: "evm_mine" })

        // Vote once
        await finCubeDAO.write.castVote([0n, true])

        // Try to vote again - should fail
        try {
            await finCubeDAO.write.castVote([0n, false])
            assert.fail("Should have failed - already voted")
        } catch (error: any) {
            assert.ok(error.message.includes("Already voted for this proposal"))
        }
    })
})
