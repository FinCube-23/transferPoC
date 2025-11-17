import { expect } from "chai";
import { ethers } from "hardhat";

describe("Nullifier and Double-Spending Prevention", function () {
  it("Should prevent double spending with same nullifier", async function () {
    const [owner, member1, member2] = await ethers.getSigners();

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

    await finCubeDAO
      .connect(member2)
      .registerMember(member2.address, "Member 2 URI");
    await finCubeDAO.newMemberApprovalProposal(
      member2.address,
      "Approve Member 2"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.castVote(1, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.executeProposal(1);

    const mintAmount = 1000n * 10n ** 18n;
    await mockERC20.mint(member1.address, mintAmount);
    await mockERC20
      .connect(member1)
      .approve(await finCube.getAddress(), mintAmount);

    const transferAmount = 100n * 10n ** 18n;
    const duplicateNullifier =
      "0xaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd";

    await finCube
      .connect(member1)
      .safeTransfer(
        member2.address,
        transferAmount,
        "First transfer",
        duplicateNullifier
      );

    const member2BalanceAfterFirst = await mockERC20.balanceOf(member2.address);
    expect(member2BalanceAfterFirst).to.equal(transferAmount);

    await expect(
      finCube
        .connect(member1)
        .safeTransfer(
          member2.address,
          transferAmount,
          "First transfer",
          duplicateNullifier
        )
    ).to.be.revertedWith("Nullifier already used");

    const member2BalanceAfterFailed = await mockERC20.balanceOf(
      member2.address
    );
    expect(member2BalanceAfterFailed).to.equal(transferAmount);
  });

  it("Should allow multiple transfers with different nullifiers", async function () {
    const [owner, member1, member2] = await ethers.getSigners();

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

    await finCubeDAO
      .connect(member2)
      .registerMember(member2.address, "Member 2 URI");
    await finCubeDAO.newMemberApprovalProposal(
      member2.address,
      "Approve Member 2"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.castVote(1, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.executeProposal(1);

    const mintAmount = 1000n * 10n ** 18n;
    await mockERC20.mint(member1.address, mintAmount);
    await mockERC20
      .connect(member1)
      .approve(await finCube.getAddress(), mintAmount);

    const transferAmount = 100n * 10n ** 18n;

    const nullifier1 =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    await finCube
      .connect(member1)
      .safeTransfer(member2.address, transferAmount, "Same memo", nullifier1);

    const nullifier2 =
      "0x2222222222222222222222222222222222222222222222222222222222222222";
    await finCube
      .connect(member1)
      .safeTransfer(member2.address, transferAmount, "Same memo", nullifier2);

    const nullifier3 =
      "0x3333333333333333333333333333333333333333333333333333333333333333";
    await finCube
      .connect(member1)
      .safeTransfer(member2.address, transferAmount, "Same memo", nullifier3);

    const member2FinalBalance = await mockERC20.balanceOf(member2.address);
    expect(member2FinalBalance).to.equal(transferAmount * 3n);

    const member1FinalBalance = await mockERC20.balanceOf(member1.address);
    expect(member1FinalBalance).to.equal(mintAmount - transferAmount * 3n);
  });

  it("Should allow same nullifier when other transfer parameters change", async function () {
    const [owner, member1, member2, member3] = await ethers.getSigners();

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
    await finCubeDAO.setVotingPeriod(3);

    const members = [member1, member2, member3];
    for (let i = 0; i < members.length; i++) {
      await finCubeDAO
        .connect(members[i])
        .registerMember(members[i].address, `Member ${i + 1} URI`);
      await finCubeDAO.newMemberApprovalProposal(
        members[i].address,
        `Approve Member ${i + 1}`
      );
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine");
      await finCubeDAO.castVote(i, true);
      if (i > 0) {
        await finCubeDAO.connect(member1).castVote(i, true);
      }
      await ethers.provider.send("evm_increaseTime", [3]);
      await ethers.provider.send("evm_mine");
      await finCubeDAO.executeProposal(i);
    }

    const mintAmount = 1000n * 10n ** 18n;
    await mockERC20.mint(member1.address, mintAmount);
    await mockERC20
      .connect(member1)
      .approve(await finCube.getAddress(), mintAmount);

    const sharedNullifier =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    await finCube
      .connect(member1)
      .safeTransfer(
        member2.address,
        50n * 10n ** 18n,
        "memo1",
        sharedNullifier
      );

    await finCube
      .connect(member1)
      .safeTransfer(
        member3.address,
        50n * 10n ** 18n,
        "memo1",
        sharedNullifier
      );

    await finCube
      .connect(member1)
      .safeTransfer(
        member2.address,
        75n * 10n ** 18n,
        "memo1",
        sharedNullifier
      );

    await finCube
      .connect(member1)
      .safeTransfer(
        member2.address,
        50n * 10n ** 18n,
        "memo2",
        sharedNullifier
      );

    const member2Balance = await mockERC20.balanceOf(member2.address);
    const member3Balance = await mockERC20.balanceOf(member3.address);
    const member1Balance = await mockERC20.balanceOf(member1.address);

    expect(member2Balance).to.equal(175n * 10n ** 18n);
    expect(member3Balance).to.equal(50n * 10n ** 18n);
    expect(member1Balance).to.equal(mintAmount - 225n * 10n ** 18n);

    await expect(
      finCube
        .connect(member1)
        .safeTransfer(
          member2.address,
          50n * 10n ** 18n,
          "memo1",
          sharedNullifier
        )
    ).to.be.revertedWith("Nullifier already used");
  });

  it("Should prevent nullifier reuse across different callers", async function () {
    const [owner, member1, member2, member3] = await ethers.getSigners();

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

    await finCubeDAO
      .connect(member2)
      .registerMember(member2.address, "Member 2 URI");
    await finCubeDAO.newMemberApprovalProposal(
      member2.address,
      "Approve Member 2"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.castVote(1, true);
    await finCubeDAO.connect(member1).castVote(1, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.executeProposal(1);

    await finCubeDAO
      .connect(member3)
      .registerMember(member3.address, "Member 3 URI");
    await finCubeDAO.newMemberApprovalProposal(
      member3.address,
      "Approve Member 3"
    );
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.castVote(2, true);
    await finCubeDAO.connect(member1).castVote(2, true);
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");
    await finCubeDAO.executeProposal(2);

    const mintAmount = 1000n * 10n ** 18n;
    await mockERC20.mint(member1.address, mintAmount);
    await mockERC20.mint(member2.address, mintAmount);
    await mockERC20
      .connect(member1)
      .approve(await finCube.getAddress(), mintAmount);
    await mockERC20
      .connect(member2)
      .approve(await finCube.getAddress(), mintAmount);

    const nullifier =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    await finCube
      .connect(member1)
      .safeTransfer(
        member3.address,
        100n * 10n ** 18n,
        "Test transfer",
        nullifier
      );

    const member3BalanceBefore = await mockERC20.balanceOf(member3.address);

    await finCube
      .connect(member2)
      .safeTransfer(
        member3.address,
        100n * 10n ** 18n,
        "Different transfer",
        nullifier
      );

    const member3BalanceAfter = await mockERC20.balanceOf(member3.address);
    expect(member3BalanceAfter - member3BalanceBefore).to.equal(
      100n * 10n ** 18n
    );

    await expect(
      finCube
        .connect(member1)
        .safeTransfer(
          member3.address,
          100n * 10n ** 18n,
          "Test transfer",
          nullifier
        )
    ).to.be.revertedWith("Nullifier already used");
  });
});
