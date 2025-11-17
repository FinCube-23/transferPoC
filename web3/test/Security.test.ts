import { expect } from "chai";
import { ethers } from "hardhat";

describe("Security and Access Control", function () {
  let finCubeDAO: any;
  let mockERC20: any;
  let finCube: any;
  let owner: any;
  let member1: any;
  let member2: any;
  let nonOwner: any;

  beforeEach(async function () {
    [owner, member1, member2, nonOwner] = await ethers.getSigners();

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

    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(3);
  });

  it("Should test reentrancy protection in FinCube safeTransfer", async function () {
    const MaliciousERC20 = await ethers.getContractFactory("MaliciousERC20");
    const maliciousERC20 = await MaliciousERC20.deploy(
      "Malicious Token",
      "MAL"
    );
    await maliciousERC20.waitForDeployment();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const testFinCubeDAO = await FinCubeDAO.deploy();
    await testFinCubeDAO.waitForDeployment();

    const FinCube = await ethers.getContractFactory("FinCube");
    const testFinCube = await FinCube.deploy();
    await testFinCube.waitForDeployment();

    await testFinCubeDAO.initialize("Test DAO URI", "Owner URI");
    await testFinCube.initialize(
      await testFinCubeDAO.getAddress(),
      await maliciousERC20.getAddress()
    );

    await testFinCubeDAO.setVotingDelay(1);
    await testFinCubeDAO.setVotingPeriod(3);

    await testFinCubeDAO
      .connect(member1)
      .registerMember(member1.address, "Member 1 URI");
    await testFinCubeDAO
      .connect(member2)
      .registerMember(member2.address, "Member 2 URI");

    await testFinCubeDAO.newMemberApprovalProposal(
      member1.address,
      "Approve Member 1"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.castVote(0, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.executeProposal(0);

    await testFinCubeDAO.newMemberApprovalProposal(
      member2.address,
      "Approve Member 2"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.castVote(1, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.executeProposal(1);

    const mintAmount = ethers.parseEther("1000");
    await maliciousERC20.mint(member1.address, mintAmount);
    await maliciousERC20
      .connect(member1)
      .approve(await testFinCube.getAddress(), mintAmount);

    await maliciousERC20.setTargetContract(await testFinCube.getAddress());
    await maliciousERC20.enableAttack(
      member1.address,
      member2.address,
      ethers.parseEther("50")
    );

    const nullifier3 =
      "0x1111111111111111111111111111111111111111111111111111111111111111";

    await expect(
      testFinCube
        .connect(member1)
        .safeTransfer(
          member2.address,
          ethers.parseEther("100"),
          "Reentrancy test memo",
          nullifier3
        )
    ).to.be.revertedWithCustomError(
      testFinCube,
      "ReentrancyGuardReentrantCall"
    );

    await maliciousERC20.disableAttack();
    const nullifier4 =
      "0x2222222222222222222222222222222222222222222222222222222222222222";

    await expect(
      testFinCube
        .connect(member1)
        .safeTransfer(
          member2.address,
          ethers.parseEther("100"),
          "Normal transfer memo",
          nullifier4
        )
    ).to.emit(testFinCube, "StablecoinTransfer");

    const member2Balance = await maliciousERC20.balanceOf(member2.address);
    expect(member2Balance).to.equal(ethers.parseEther("100"));
  });

  it("Should test reentrancy protection in FinCubeDAO executeProposal", async function () {
    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const testFinCubeDAO = await FinCubeDAO.deploy();
    await testFinCubeDAO.waitForDeployment();

    const FinCube = await ethers.getContractFactory("FinCube");
    const testFinCube = await FinCube.deploy();
    await testFinCube.waitForDeployment();

    const MaliciousTarget = await ethers.getContractFactory("MaliciousTarget");
    const maliciousTarget = await MaliciousTarget.deploy();
    await maliciousTarget.waitForDeployment();

    await testFinCubeDAO.initialize("Test DAO URI", "Owner URI");
    await testFinCube.initialize(
      await testFinCubeDAO.getAddress(),
      await mockERC20.getAddress()
    );

    await testFinCubeDAO.setVotingDelay(1);
    await testFinCubeDAO.setVotingPeriod(10);

    await testFinCubeDAO
      .connect(member1)
      .registerMember(member1.address, "Member 1 URI");

    await testFinCubeDAO.newMemberApprovalProposal(
      member1.address,
      "Approve Member 1"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.castVote(0, true);
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.executeProposal(0);

    await maliciousTarget.setDAOContract(await testFinCubeDAO.getAddress());

    const maliciousCalldata =
      maliciousTarget.interface.encodeFunctionData("maliciousFunction");

    await testFinCubeDAO.propose(
      [await maliciousTarget.getAddress()],
      [0],
      [maliciousCalldata],
      "Malicious proposal"
    );

    await maliciousTarget.enableAttack(1);

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.castVote(1, true);
    await testFinCubeDAO.connect(member1).castVote(1, true);
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      testFinCubeDAO.executeProposal(1)
    ).to.be.revertedWithCustomError(
      testFinCubeDAO,
      "ReentrancyGuardReentrantCall"
    );

    await maliciousTarget.disableAttack();

    const finCubeInterface = testFinCube.interface;
    const setTokenCalldata = finCubeInterface.encodeFunctionData(
      "setApprovedERC20",
      [await mockERC20.getAddress()]
    );

    await testFinCubeDAO.propose(
      [await testFinCube.getAddress()],
      [0],
      [setTokenCalldata],
      "Normal proposal"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.castVote(2, true);
    await testFinCubeDAO.connect(member1).castVote(2, true);
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.executeProposal(2);

    const currentToken = await testFinCube.approvedERC20();
    expect(currentToken).to.equal(await mockERC20.getAddress());
  });

  it("Should verify contracts implement proper access controls", async function () {
    await expect(
      finCube.connect(nonOwner).setApprovedERC20(await mockERC20.getAddress())
    ).to.be.revertedWith("Only DAO");

    await expect(
      finCube.connect(nonOwner).setDAO(nonOwner.address)
    ).to.be.revertedWith("Only DAO");

    await expect(
      finCubeDAO.connect(nonOwner).setVotingDelay(5)
    ).to.be.revertedWithCustomError(finCubeDAO, "OwnableUnauthorizedAccount");

    await expect(
      finCubeDAO.connect(nonOwner).setVotingPeriod(10)
    ).to.be.revertedWithCustomError(finCubeDAO, "OwnableUnauthorizedAccount");

    await finCubeDAO
      .connect(member1)
      .registerMember(member1.address, "Member 1 URI");

    await expect(
      finCubeDAO
        .connect(nonOwner)
        .newMemberApprovalProposal(nonOwner.address, "Should fail")
    ).to.be.revertedWith("Not a member");
  });
});
