import { expect } from "chai";
import { ethers } from "hardhat";

describe("DAO Proposals and Voting", function () {
  it("Should create and execute stablecoin address change proposal", async function () {
    const [owner, member1] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const oldToken = await MockERC20.deploy("Old Token", "OLD", 18);
    await oldToken.waitForDeployment();

    const newToken = await MockERC20.deploy("New Token", "NEW", 18);
    await newToken.waitForDeployment();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const testFinCubeDAO = await FinCubeDAO.deploy();
    await testFinCubeDAO.waitForDeployment();

    const FinCube = await ethers.getContractFactory("FinCube");
    const testFinCube = await FinCube.deploy();
    await testFinCube.waitForDeployment();

    await testFinCubeDAO.initialize("Test DAO URI", "Owner URI");
    await testFinCube.initialize(
      await testFinCubeDAO.getAddress(),
      await oldToken.getAddress()
    );

    await testFinCubeDAO
      .connect(member1)
      .registerMember(member1.address, "Member 1 URI");
    await testFinCubeDAO.setVotingDelay(1);
    await testFinCubeDAO.setVotingPeriod(3);

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

    const finCubeInterface = testFinCube.interface;
    const functionSelector = finCubeInterface.encodeFunctionData(
      "setApprovedERC20",
      [await newToken.getAddress()]
    );

    await testFinCubeDAO.propose(
      [await testFinCube.getAddress()],
      [0],
      [functionSelector],
      "Change approved ERC20 token"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);

    await testFinCubeDAO.castVote(1, true);
    await testFinCubeDAO.connect(member1).castVote(1, true);

    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);

    await testFinCubeDAO.executeProposal(1);

    const currentToken = await testFinCube.approvedERC20();
    expect(currentToken).to.equal(await newToken.getAddress());

    const filter = testFinCube.filters.ApprovedERC20Updated();
    const events = await testFinCube.queryFilter(filter);

    expect(events.length).to.be.greaterThan(0);
    const lastEvent = events[events.length - 1];
    expect(lastEvent.args[0]).to.equal(await newToken.getAddress());
  });

  it("Should handle complete workflow: deploy, initialize, create proposal, vote, execute, and change token", async function () {
    const [owner, member1, member2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const initialToken = await MockERC20.deploy("Initial Token", "INIT", 18);
    await initialToken.waitForDeployment();

    const newToken = await MockERC20.deploy("New Token", "NEW", 18);
    await newToken.waitForDeployment();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const testFinCubeDAO = await FinCubeDAO.deploy();
    await testFinCubeDAO.waitForDeployment();

    const FinCube = await ethers.getContractFactory("FinCube");
    const testFinCube = await FinCube.deploy();
    await testFinCube.waitForDeployment();

    await testFinCubeDAO.initialize("DAO URI", "Owner URI");
    await testFinCube.initialize(
      await testFinCubeDAO.getAddress(),
      await initialToken.getAddress()
    );

    const mintAmount = ethers.parseEther("1000");
    await initialToken.mint(member1.address, mintAmount);
    await newToken.mint(member2.address, mintAmount);

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
    await testFinCubeDAO.connect(member1).castVote(1, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.executeProposal(1);

    const finCubeInterface = testFinCube.interface;
    const setTokenCalldata = finCubeInterface.encodeFunctionData(
      "setApprovedERC20",
      [await newToken.getAddress()]
    );

    await testFinCubeDAO.propose(
      [await testFinCube.getAddress()],
      [0],
      [setTokenCalldata],
      "Change approved ERC20 token"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.castVote(2, true);
    await testFinCubeDAO.connect(member1).castVote(2, true);

    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    await testFinCubeDAO.executeProposal(2);

    const finalTokenAddress = await testFinCube.approvedERC20();
    expect(finalTokenAddress).to.equal(await newToken.getAddress());

    await newToken
      .connect(member2)
      .approve(await testFinCube.getAddress(), ethers.parseEther("100"));

    const nullifier2 =
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    await expect(
      testFinCube
        .connect(member2)
        .safeTransfer(
          member1.address,
          ethers.parseEther("50"),
          "Final test transfer",
          nullifier2
        )
    )
      .to.emit(testFinCube, "StablecoinTransfer")
      .withArgs(
        member2.address,
        member1.address,
        "Final test transfer",
        "Final test transfer",
        ethers.parseEther("50"),
        nullifier2
      );

    const member1FinalBalance = await newToken.balanceOf(member1.address);
    const member2FinalBalance = await newToken.balanceOf(member2.address);

    expect(member1FinalBalance).to.equal(ethers.parseEther("50"));
    expect(member2FinalBalance).to.equal(mintAmount - ethers.parseEther("50"));
  });

  it("Should reject execution without majority votes", async function () {
    const [owner, member1] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAO = await FinCubeDAO.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18);

    const FinCube = await ethers.getContractFactory("FinCube");
    const finCube = await FinCube.deploy();

    await finCubeDAO.initialize("Test DAO URI", "Owner URI");
    await finCube.initialize(
      await finCubeDAO.getAddress(),
      await mockERC20.getAddress()
    );

    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(120);

    await finCubeDAO
      .connect(member1)
      .registerMember(member1.address, "Member 1 URI");

    await finCubeDAO.newMemberApprovalProposal(
      member1.address,
      "Test proposal"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");

    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine");

    await expect(finCubeDAO.executeProposal(0)).to.be.revertedWith(
      "Proposal doesn't have majority vote"
    );
  });

  it("Should allow anyone to register new member", async function () {
    const [owner, newMember] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.initialize("Test DAO URI", "Owner URI");
    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(3);

    const tx = await finCubeDAO
      .connect(newMember)
      .registerMember(newMember.address, "member://uri");

    await expect(
      finCubeDAO
        .connect(newMember)
        .registerMember(newMember.address, "member://uri")
    ).to.be.revertedWith("Already a member");
  });

  it("Should only allow members to create approval proposals", async function () {
    const [owner, newMember, nonMember] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.initialize("Test DAO URI", "Owner URI");

    await finCubeDAO
      .connect(newMember)
      .registerMember(newMember.address, "member://uri");

    await expect(
      finCubeDAO
        .connect(nonMember)
        .newMemberApprovalProposal(nonMember.address, "Test proposal")
    ).to.be.revertedWith("Not a member");

    await finCubeDAO.connect(owner).setVotingDelay(1);
    await finCubeDAO.connect(owner).setVotingPeriod(5);

    await finCubeDAO
      .connect(owner)
      .newMemberApprovalProposal(newMember.address, "Test proposal");
  });

  it("Should enforce voting delay before execution", async function () {
    const [owner, newMember] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.initialize("Test DAO URI", "Owner URI");

    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(3);

    await finCubeDAO
      .connect(newMember)
      .registerMember(newMember.address, "member://uri");
    await finCubeDAO.newMemberApprovalProposal(
      newMember.address,
      "Test proposal"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");

    await finCubeDAO.castVote(0, true);

    await expect(finCubeDAO.executeProposal(0)).to.be.revertedWith(
      "Voting still going on"
    );

    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");

    await finCubeDAO.executeProposal(0);

    const isApproved = await finCubeDAO.checkIsMemberApproved(
      newMember.address
    );
    expect(isApproved).to.equal(true);
  });

  it("Should complete full member approval flow", async function () {
    const [owner, newMember] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.initialize("Test DAO URI", "Owner URI");

    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(3);

    await finCubeDAO
      .connect(newMember)
      .registerMember(newMember.address, "member://uri");

    await finCubeDAO.newMemberApprovalProposal(
      newMember.address,
      "Approve new member"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.castVote(0, true);

    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");

    await finCubeDAO.executeProposal(0);

    const isApproved = await finCubeDAO.checkIsMemberApproved(
      newMember.address
    );
    expect(isApproved).to.equal(true);
  });

  it("Should not allow voting after voting period ends", async function () {
    const [owner, newMember] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.initialize("Test DAO URI", "Owner URI");

    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(3);

    await finCubeDAO
      .connect(newMember)
      .registerMember(newMember.address, "member://uri");
    await finCubeDAO.newMemberApprovalProposal(
      newMember.address,
      "Test proposal"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");

    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");

    await expect(finCubeDAO.castVote(0, true)).to.be.revertedWith(
      "Voting is not allowed at this time"
    );
  });

  it("Should not allow executing proposal before voting period ends", async function () {
    const [owner, newMember] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.initialize("Test DAO URI", "Owner URI");

    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(3);

    await finCubeDAO
      .connect(newMember)
      .registerMember(newMember.address, "member://uri");
    await finCubeDAO.newMemberApprovalProposal(
      newMember.address,
      "Test proposal"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");

    await finCubeDAO.castVote(0, true);

    await expect(finCubeDAO.executeProposal(0)).to.be.revertedWith(
      "Voting still going on"
    );
  });

  it("Should not allow voting twice on the same proposal", async function () {
    const [owner, newMember] = await ethers.getSigners();

    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    const finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.initialize("Test DAO URI", "Owner URI");

    await finCubeDAO.setVotingDelay(1);
    await finCubeDAO.setVotingPeriod(3);

    await finCubeDAO
      .connect(newMember)
      .registerMember(newMember.address, "member://uri");
    await finCubeDAO.newMemberApprovalProposal(
      newMember.address,
      "Test proposal"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");

    await finCubeDAO.castVote(0, true);

    await expect(finCubeDAO.castVote(0, false)).to.be.revertedWith(
      "Already voted for this proposal"
    );
  });
});
