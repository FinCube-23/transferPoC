import { expect } from "chai";
import { ethers } from "hardhat";

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

describe("UUPS Upgrades", function () {
  let finCubeDAO: any;
  let mockERC20: any;
  let finCube: any;
  let owner: any;
  let nonOwner: any;

  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18);
    await mockERC20.waitForDeployment();

    const FinCube = await ethers.getContractFactory("FinCube");
    finCube = await FinCube.deploy();
    await finCube.waitForDeployment();

    await finCubeDAO.initialize("Test DAO URI", "Owner URI");
    await finCube.initialize(
      await finCubeDAO.getAddress(),
      await mockERC20.getAddress()
    );
  });

  it("Should verify FinCube contract is upgradeable (UUPS)", async function () {
    const FinCube = await ethers.getContractFactory("FinCube");
    const finCubeV2 = await FinCube.deploy();
    await finCubeV2.waitForDeployment();

    await expect(
      finCube
        .connect(owner)
        .upgradeToAndCall(await finCubeV2.getAddress(), "0x")
    ).to.be.revertedWithCustomError(finCube, "UUPSUnauthorizedCallContext");

    const daoAddress = await finCube.dao();
    expect(daoAddress).to.equal(await finCubeDAO.getAddress());
  });

  it("Should verify FinCubeDAO contract is upgradeable (UUPS)", async function () {
    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAOV2 = await FinCubeDAO.deploy();
    await finCubeDAOV2.waitForDeployment();

    await expect(
      finCubeDAO
        .connect(nonOwner)
        .upgradeToAndCall(await finCubeDAOV2.getAddress(), "0x")
    ).to.be.revertedWithCustomError(finCubeDAO, "UUPSUnauthorizedCallContext");

    const owner_address = await finCubeDAO.owner();
    expect(owner_address).to.equal(owner.address);
  });

  it("Should successfully upgrade FinCube contract through DAO proposal and verify upgrade", async function () {
    const [owner, member1] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAOImpl = await FinCubeDAO.deploy();

    const FinCube = await ethers.getContractFactory("FinCube");
    const finCubeImpl = await FinCube.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18);

    const daoInitData = finCubeDAOImpl.interface.encodeFunctionData(
      "initialize",
      ["Test DAO URI", "Owner URI"]
    );

    const TestERC1967Proxy = await ethers.getContractFactory(
      "TestERC1967Proxy"
    );
    const finCubeDAOProxy = await TestERC1967Proxy.deploy(
      await finCubeDAOImpl.getAddress(),
      daoInitData
    );

    const finCubeInitData = finCubeImpl.interface.encodeFunctionData(
      "initialize",
      [await finCubeDAOProxy.getAddress(), await mockERC20.getAddress()]
    );

    const finCubeProxy = await TestERC1967Proxy.deploy(
      await finCubeImpl.getAddress(),
      finCubeInitData
    );

    const finCubeDAO = await ethers.getContractAt(
      "FinCubeDAO",
      await finCubeDAOProxy.getAddress()
    );
    const finCube = await ethers.getContractAt(
      "FinCube",
      await finCubeProxy.getAddress()
    );

    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(3);

    await finCubeDAO
      .connect(member1)
      .registerMember(member1.address, "Member 1 URI");

    await finCubeDAO.newMemberApprovalProposal(
      member1.address,
      "Approve Member 1"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.castVote(0, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.executeProposal(0);

    const originalDAO = await finCube.dao();
    const originalToken = await finCube.approvedERC20();

    const finCubeV2 = await FinCube.deploy();

    const implementationSlot =
      "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const originalImplementation = await ethers.provider.getStorage(
      await finCube.getAddress(),
      implementationSlot
    );

    const upgradeCalldata = finCube.interface.encodeFunctionData(
      "upgradeToAndCall",
      [await finCubeV2.getAddress(), "0x"]
    );

    await finCubeDAO.propose(
      [await finCube.getAddress()],
      [0],
      [upgradeCalldata],
      "Upgrade FinCube to V2"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.castVote(1, true);
    await finCubeDAO.connect(member1).castVote(1, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");

    await finCubeDAO.executeProposal(1);

    const newImplementation = await ethers.provider.getStorage(
      await finCube.getAddress(),
      implementationSlot
    );

    expect(originalImplementation).to.not.equal(newImplementation);

    const expectedImplementation =
      "0x" +
      "0".repeat(24) +
      (await finCubeV2.getAddress()).slice(2).toLowerCase();
    expect(newImplementation.toLowerCase()).to.equal(expectedImplementation);

    const daoAfterUpgrade = await finCube.dao();
    const tokenAfterUpgrade = await finCube.approvedERC20();

    expect(daoAfterUpgrade.toLowerCase()).to.equal(originalDAO.toLowerCase());
    expect(tokenAfterUpgrade.toLowerCase()).to.equal(
      originalToken.toLowerCase()
    );

    const daoStillAccessible = await finCube.dao();
    const tokenStillAccessible = await finCube.approvedERC20();

    expect(daoStillAccessible).to.not.equal(ethers.ZeroAddress);
    expect(tokenStillAccessible).to.not.equal(ethers.ZeroAddress);

    const finCubeV3 = await FinCube.deploy();
    await expect(
      finCube
        .connect(owner)
        .upgradeToAndCall(await finCubeV3.getAddress(), "0x")
    ).to.be.revertedWith("Only DAO");
  });

  it("Should successfully upgrade FinCubeDAO contract and verify upgrade", async function () {
    const [owner, nonOwner] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAOImpl = await FinCubeDAO.deploy();

    const daoInitData = finCubeDAOImpl.interface.encodeFunctionData(
      "initialize",
      ["Test DAO URI", "Owner URI"]
    );

    const TestERC1967Proxy = await ethers.getContractFactory(
      "TestERC1967Proxy"
    );
    const finCubeDAOProxy = await TestERC1967Proxy.deploy(
      await finCubeDAOImpl.getAddress(),
      daoInitData
    );

    const finCubeDAO = await ethers.getContractAt(
      "FinCubeDAO",
      await finCubeDAOProxy.getAddress()
    );

    const originalOwner = await finCubeDAO.owner();

    await finCubeDAO.setVotingDelay(5);
    await finCubeDAO.setVotingPeriod(10);

    const stateBeforeUpgrade = {
      owner: await finCubeDAO.owner(),
      votingDelay: await finCubeDAO.votingDelay(),
      votingPeriod: await finCubeDAO.votingPeriod(),
    };

    const finCubeDAOV2 = await FinCubeDAO.deploy();

    const implementationSlot =
      "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const originalImplementation = await ethers.provider.getStorage(
      await finCubeDAO.getAddress(),
      implementationSlot
    );

    await finCubeDAO
      .connect(owner)
      .upgradeToAndCall(await finCubeDAOV2.getAddress(), "0x");

    const newImplementation = await ethers.provider.getStorage(
      await finCubeDAO.getAddress(),
      implementationSlot
    );

    expect(originalImplementation).to.not.equal(newImplementation);

    const expectedImplementation =
      "0x" +
      "0".repeat(24) +
      (await finCubeDAOV2.getAddress()).slice(2).toLowerCase();
    expect(newImplementation.toLowerCase()).to.equal(expectedImplementation);

    const stateAfterUpgrade = {
      owner: await finCubeDAO.owner(),
      votingDelay: await finCubeDAO.votingDelay(),
      votingPeriod: await finCubeDAO.votingPeriod(),
    };

    expect(stateAfterUpgrade.owner.toLowerCase()).to.equal(
      stateBeforeUpgrade.owner.toLowerCase()
    );
    expect(stateAfterUpgrade.votingDelay).to.equal(
      stateBeforeUpgrade.votingDelay
    );
    expect(stateAfterUpgrade.votingPeriod).to.equal(
      stateBeforeUpgrade.votingPeriod
    );

    await finCubeDAO.connect(owner).setVotingDelay(7);
    const newVotingDelay = await finCubeDAO.votingDelay();
    expect(newVotingDelay).to.equal(7n);

    const finCubeDAOV3 = await FinCubeDAO.deploy();
    await expect(
      finCubeDAO
        .connect(nonOwner)
        .upgradeToAndCall(await finCubeDAOV3.getAddress(), "0x")
    ).to.be.revertedWithCustomError(finCubeDAO, "OwnableUnauthorizedAccount");
  });
});
