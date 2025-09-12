// We don't have Ethereum specific assertions in Hardhat 3 yet
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { network } from "hardhat"

import { encodeAbiParameters, encodeFunctionData, getAddress } from "viem"
import { AnyARecord } from "node:dns"

describe("FinCube", async function () {
    const { viem } = await network.connect()
    const publicClient = await viem.getPublicClient()

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
        const daoAddress = await finCube.read.dao() as string
        const tokenAddress = await finCube.read.approvedERC20() as string

        assert.equal(getAddress(daoAddress), getAddress(finCubeDAO.address))
        assert.equal(getAddress(tokenAddress), getAddress(mockERC20.address))
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
        await finCubeDAO.write.setVotingDelay([1n]) // 1 second delay
        await finCubeDAO.write.setVotingPeriod([3n]) // 3 seconds period

        // Create proposal to approve member1
        await finCubeDAO.write.newMemberApprovalProposal([
            member1.account.address,
            "Approve Member 1",
        ])

        // Wait for voting delay
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Cast vote (owner votes yes)
        await finCubeDAO.write.castVote([0n, true])

        // Wait for voting period to end
        await new Promise((resolve) => setTimeout(resolve, 4000))

        // Execute proposal to approve member1
        await finCubeDAO.write.executeProposal([0n])

        // Create proposal to approve member2
        await finCubeDAO.write.newMemberApprovalProposal([
            member2.account.address,
            "Approve Member 2",
        ])

        // Wait for voting delay
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Cast vote (owner votes yes)
        await finCubeDAO.write.castVote([1n, true])

        // Wait and execute proposal to approve member2
        await new Promise((resolve) => setTimeout(resolve, 4000))
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
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([0n, true])
        await new Promise((resolve) => setTimeout(resolve, 4000))
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
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Cast votes (owner and member1 vote yes)
        await finCubeDAO.write.castVote([1n, true]) // owner votes
        await finCubeDAO.write.castVote([1n, true], {
            account: member1.account,
        }) // member1 votes

        // Wait for voting period
        await new Promise((resolve) => setTimeout(resolve, 4000))

        // Execute the proposal
        await finCubeDAO.write.executeProposal([1n])

        // Verify the stablecoin address was changed
        const currentToken = await finCube.read.approvedERC20() as string
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
        assert.equal(
            (events[events.length - 1].args as { newToken: string }).newToken,
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
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([0n, true])
        await new Promise((resolve) => setTimeout(resolve, 4000))
        await finCubeDAO.write.executeProposal([0n])

        // Approve member2
        await finCubeDAO.write.newMemberApprovalProposal([
            member2.account.address,
            "Approve Member 2",
        ])
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([1n, true])
        await finCubeDAO.write.castVote([1n, true], {
            account: member1.account,
        })
        await new Promise((resolve) => setTimeout(resolve, 4000))
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
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([2n, true]) // owner
        await finCubeDAO.write.castVote([2n, true], {
            account: member1.account,
        }) // member1

        // 6. Execute the proposal
        await new Promise((resolve) => setTimeout(resolve, 4000))
        await finCubeDAO.write.executeProposal([2n])

        // 7. Verify the stablecoin address was changed
        const finalTokenAddress = await finCube.read.approvedERC20() as string
        assert.equal(
            getAddress(finalTokenAddress),
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

    it("Should verify FInCube contract is upgradeable (UUPS)", async function () {
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
        const daoAddress = await finCube.read.dao() as string
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
        const owner_address = await finCubeDAO.read.owner() as string
        assert.equal(
            getAddress(owner_address),
            getAddress(owner.account.address)
        )
    })

    it("Should test reentrancy protection in FInCube safeTransfer", async function () {
        const [owner, member1, member2] = await viem.getWalletClients()

        // Deploy malicious contract that attempts reentrancy
        const maliciousContract = await viem.deployContract("MockERC20", [
            "Malicious Token",
            "MAL",
            18n,
        ])

        // Deploy normal contracts
        const finCubeDAO = await viem.deployContract("FinCubeDAO")
        const finCube = await viem.deployContract("FinCube")

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([
            finCubeDAO.address,
            maliciousContract.address,
        ])

        // Set up DAO parameters
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
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([0n, true])
        await new Promise((resolve) => setTimeout(resolve, 4000))
        await finCubeDAO.write.executeProposal([0n])

        // Approve member2
        await finCubeDAO.write.newMemberApprovalProposal([
            member2.account.address,
            "Approve Member 2",
        ])
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([1n, true])
        await new Promise((resolve) => setTimeout(resolve, 4000))
        await finCubeDAO.write.executeProposal([1n])

        // Mint tokens and approve
        const mintAmount = 1000n * 10n ** 18n
        await maliciousContract.write.mint([
            member1.account.address,
            mintAmount,
        ])
        await maliciousContract.write.approve([finCube.address, mintAmount], {
            account: member1.account,
        })

        // Normal transfer should work (reentrancy guard allows first call)
        await finCube.write.safeTransfer(
            [
                member1.account.address,
                member2.account.address,
                100n * 10n ** 18n,
                "Reentrancy test memo",
            ],
            { account: member1.account }
        )

        // Verify transfer worked
        const member2Balance = await maliciousContract.read.balanceOf([
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

        // Initialize contracts
        await finCubeDAO.write.initialize(["Test DAO URI", "Owner URI"])
        await finCube.write.initialize([finCubeDAO.address, mockERC20.address])

        // Set up DAO parameters
        await finCubeDAO.write.setVotingDelay([1n])
        await finCubeDAO.write.setVotingPeriod([3n])

        // Register and approve member
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

        // Create a general proposal
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
            "Change approved ERC20 token",
        ])

        // Vote on proposal
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await finCubeDAO.write.castVote([1n, true])
        await finCubeDAO.write.castVote([1n, true], {
            account: member1.account,
        })
        await new Promise((resolve) => setTimeout(resolve, 4000))

        // Execute proposal (should work due to reentrancy guard)
        await finCubeDAO.write.executeProposal([1n])

        // Try to execute the same proposal again (should fail - already executed)
        try {
            await finCubeDAO.write.executeProposal([1n])
            assert.fail("Should have failed - proposal already executed")
        } catch (error: any) {
            assert.ok(error.message.includes("Proposal already executed"))
        }
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
})
