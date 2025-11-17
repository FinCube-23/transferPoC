import { expect } from "chai";
import { ethers } from "hardhat";

describe("Stablecoin Transfer", function () {
  let finCubeDAO: any;
  let mockERC20: any;
  let finCube: any;
  let owner: any;
  let member1: any;
  let member2: any;

  beforeEach(async function () {
    [owner, member1, member2] = await ethers.getSigners();

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

  it("Should mint ERC20 tokens and test stablecoin transfer flow", async function () {
    const mintAmount = ethers.parseEther("1000");
    await mockERC20.mint(member1.address, mintAmount);

    await finCubeDAO
      .connect(member1)
      .registerMember(member1.address, "Member 1 URI");
    await finCubeDAO
      .connect(member2)
      .registerMember(member2.address, "Member 2 URI");

    await finCubeDAO.newMemberApprovalProposal(
      member1.address,
      "Approve Member 1"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await finCubeDAO.castVote(0, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    await finCubeDAO.executeProposal(0);

    await finCubeDAO.newMemberApprovalProposal(
      member2.address,
      "Approve Member 2"
    );

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await finCubeDAO.castVote(1, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);
    await finCubeDAO.executeProposal(1);

    const member1Approved = await finCubeDAO.checkIsMemberApproved(
      member1.address
    );
    const member2Approved = await finCubeDAO.checkIsMemberApproved(
      member2.address
    );

    expect(member1Approved).to.be.true;
    expect(member2Approved).to.be.true;

    const transferAmount = ethers.parseEther("100");
    await mockERC20
      .connect(member1)
      .approve(await finCube.getAddress(), transferAmount);

    const nullifier =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    await expect(
      finCube
        .connect(member1)
        .safeTransfer(
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
        "Test transfer memo",
        "Test transfer memo",
        transferAmount,
        nullifier
      );

    const member1Balance = await mockERC20.balanceOf(member1.address);
    const member2Balance = await mockERC20.balanceOf(member2.address);

    expect(member1Balance).to.equal(mintAmount - transferAmount);
    expect(member2Balance).to.equal(transferAmount);
  });
});
