import { expect } from "chai";
import { ethers } from "hardhat";

describe("Reference Number Generation", function () {
  let finCubeDAO: any;
  let mockERC20: any;
  let finCube: any;
  let owner: any;
  let nonDAO: any;
  let daoAddress: string;

  // Helper function to call generateReferenceNumber as DAO
  async function callAsDAO(emailHash: string, orgReferenceKey: string) {
    await ethers.provider.send("hardhat_impersonateAccount", [daoAddress]);
    await ethers.provider.send("hardhat_setBalance", [
      daoAddress,
      ethers.toBeHex(ethers.parseEther("1.0")),
    ]);
    const daoSigner = await ethers.getSigner(daoAddress);
    const tx = await finCube
      .connect(daoSigner)
      .generateReferenceNumber(emailHash, orgReferenceKey);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [
      daoAddress,
    ]);
    return tx;
  }

  beforeEach(async function () {
    // Get test accounts
    [owner, nonDAO] = await ethers.getSigners();

    // Deploy contracts
    const FinCubeDAO = await ethers.getContractFactory("FinCubeDAO");
    finCubeDAO = await FinCubeDAO.deploy();
    await finCubeDAO.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18);
    await mockERC20.waitForDeployment();

    const FinCube = await ethers.getContractFactory("FinCube");
    finCube = await FinCube.deploy();
    await finCube.waitForDeployment();

    // Initialize contracts
    await finCubeDAO.initialize("Test DAO URI", "Owner URI");
    await finCube.initialize(
      await finCubeDAO.getAddress(),
      await mockERC20.getAddress()
    );

    daoAddress = await finCubeDAO.getAddress();
  });

  it("Should generate reference number successfully when called by DAO", async function () {
    const emailHash = ethers.keccak256(ethers.toUtf8Bytes("user@example.com"));
    const orgReferenceKey = ethers.keccak256(ethers.toUtf8Bytes("org-key-123"));

    const tx = await callAsDAO(emailHash, orgReferenceKey);
    const receipt = await tx.wait();

    // Verify ReferenceNumberIssued event was emitted
    const events = await finCube.queryFilter(
      finCube.filters.ReferenceNumberIssued(),
      receipt.blockNumber
    );
    expect(events.length).to.equal(1);
    expect(events[0].args.orgWalletAddress).to.equal(daoAddress);
    expect(events[0].args.referenceNumber).to.not.equal(ethers.ZeroHash);
  });

  it("Should emit ReferenceNumberIssued event with correct parameters", async function () {
    const emailHash = ethers.keccak256(ethers.toUtf8Bytes("test@example.com"));
    const orgReferenceKey = ethers.keccak256(ethers.toUtf8Bytes("org-ref-456"));

    await ethers.provider.send("hardhat_impersonateAccount", [daoAddress]);
    await ethers.provider.send("hardhat_setBalance", [
      daoAddress,
      ethers.toBeHex(ethers.parseEther("1.0")),
    ]);
    const daoSigner = await ethers.getSigner(daoAddress);

    await expect(
      finCube
        .connect(daoSigner)
        .generateReferenceNumber(emailHash, orgReferenceKey)
    ).to.emit(finCube, "ReferenceNumberIssued");

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [
      daoAddress,
    ]);
  });

  it("Should prevent duplicate reference number generation", async function () {
    const emailHash = ethers.keccak256(
      ethers.toUtf8Bytes("duplicate@example.com")
    );
    const orgReferenceKey = ethers.keccak256(ethers.toUtf8Bytes("org-key-789"));

    // First generation should succeed
    await callAsDAO(emailHash, orgReferenceKey);

    // Second generation with same parameters should fail
    await ethers.provider.send("hardhat_impersonateAccount", [daoAddress]);
    await ethers.provider.send("hardhat_setBalance", [
      daoAddress,
      ethers.toBeHex(ethers.parseEther("1.0")),
    ]);
    const daoSigner = await ethers.getSigner(daoAddress);

    await expect(
      finCube
        .connect(daoSigner)
        .generateReferenceNumber(emailHash, orgReferenceKey)
    ).to.be.revertedWith("Reference number already issued");

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [
      daoAddress,
    ]);
  });

  it("Should generate different reference numbers for different inputs", async function () {
    const emailHash1 = ethers.keccak256(
      ethers.toUtf8Bytes("user1@example.com")
    );
    const emailHash2 = ethers.keccak256(
      ethers.toUtf8Bytes("user2@example.com")
    );
    const orgReferenceKey = ethers.keccak256(
      ethers.toUtf8Bytes("org-key-common")
    );

    const tx1 = await callAsDAO(emailHash1, orgReferenceKey);
    const receipt1 = await tx1.wait();
    const events1 = await finCube.queryFilter(
      finCube.filters.ReferenceNumberIssued(),
      receipt1.blockNumber
    );

    const tx2 = await callAsDAO(emailHash2, orgReferenceKey);
    const receipt2 = await tx2.wait();
    const events2 = await finCube.queryFilter(
      finCube.filters.ReferenceNumberIssued(),
      receipt2.blockNumber
    );

    // Verify different reference numbers
    expect(events1[0].args.referenceNumber).to.not.equal(
      events2[0].args.referenceNumber
    );
  });

  it("Should reject invalid email hash (zero bytes)", async function () {
    const emailHash = ethers.ZeroHash;
    const orgReferenceKey = ethers.keccak256(ethers.toUtf8Bytes("org-key-123"));

    await ethers.provider.send("hardhat_impersonateAccount", [daoAddress]);
    await ethers.provider.send("hardhat_setBalance", [
      daoAddress,
      ethers.toBeHex(ethers.parseEther("1.0")),
    ]);
    const daoSigner = await ethers.getSigner(daoAddress);

    await expect(
      finCube
        .connect(daoSigner)
        .generateReferenceNumber(emailHash, orgReferenceKey)
    ).to.be.revertedWith("Invalid email hash");

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [
      daoAddress,
    ]);
  });

  it("Should reject invalid org reference key (zero bytes)", async function () {
    const emailHash = ethers.keccak256(ethers.toUtf8Bytes("user@example.com"));
    const orgReferenceKey = ethers.ZeroHash;

    await ethers.provider.send("hardhat_impersonateAccount", [daoAddress]);
    await ethers.provider.send("hardhat_setBalance", [
      daoAddress,
      ethers.toBeHex(ethers.parseEther("1.0")),
    ]);
    const daoSigner = await ethers.getSigner(daoAddress);

    await expect(
      finCube
        .connect(daoSigner)
        .generateReferenceNumber(emailHash, orgReferenceKey)
    ).to.be.revertedWith("Invalid org reference key");

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [
      daoAddress,
    ]);
  });

  it("Should only allow DAO to generate reference numbers", async function () {
    const emailHash = ethers.keccak256(ethers.toUtf8Bytes("user@example.com"));
    const orgReferenceKey = ethers.keccak256(ethers.toUtf8Bytes("org-key-123"));

    // Try to call directly from non-DAO address
    await expect(
      finCube
        .connect(nonDAO)
        .generateReferenceNumber(emailHash, orgReferenceKey)
    ).to.be.revertedWith("Only DAO");
  });

  it("Should compute reference number deterministically", async function () {
    const emailHash = ethers.keccak256(
      ethers.toUtf8Bytes("consistent@example.com")
    );
    const orgReferenceKey = ethers.keccak256(
      ethers.toUtf8Bytes("org-key-consistent")
    );

    // Compute expected reference number
    const REFERENCE_SALT = ethers.keccak256(
      ethers.toUtf8Bytes("FINCUBE_REFERENCE_SALT_V1")
    );
    const expectedRefNumber = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes32"],
        [emailHash, orgReferenceKey, REFERENCE_SALT]
      )
    );

    const tx = await callAsDAO(emailHash, orgReferenceKey);
    const receipt = await tx.wait();
    const events = await finCube.queryFilter(
      finCube.filters.ReferenceNumberIssued(),
      receipt.blockNumber
    );

    expect(events[0].args.referenceNumber).to.equal(expectedRefNumber);
  });

  it("Should generate consistent reference numbers across different contract instances", async function () {
    // Deploy second FinCube instance
    const FinCube = await ethers.getContractFactory("FinCube");
    const finCube2 = await FinCube.deploy();
    await finCube2.waitForDeployment();
    await finCube2.initialize(daoAddress, await mockERC20.getAddress());

    const emailHash = ethers.keccak256(
      ethers.toUtf8Bytes("consistent@example.com")
    );
    const orgReferenceKey = ethers.keccak256(
      ethers.toUtf8Bytes("org-key-consistent")
    );

    // Generate from first contract
    const tx1 = await callAsDAO(emailHash, orgReferenceKey);
    const receipt1 = await tx1.wait();
    const events1 = await finCube.queryFilter(
      finCube.filters.ReferenceNumberIssued(),
      receipt1.blockNumber
    );

    // Generate from second contract
    await ethers.provider.send("hardhat_impersonateAccount", [daoAddress]);
    await ethers.provider.send("hardhat_setBalance", [
      daoAddress,
      ethers.toBeHex(ethers.parseEther("1.0")),
    ]);
    const daoSigner = await ethers.getSigner(daoAddress);
    const tx2 = await finCube2
      .connect(daoSigner)
      .generateReferenceNumber(emailHash, orgReferenceKey);
    const receipt2 = await tx2.wait();
    const events2 = await finCube2.queryFilter(
      finCube2.filters.ReferenceNumberIssued(),
      receipt2?.blockNumber
    );
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [
      daoAddress,
    ]);

    // Same inputs should produce same reference number
    expect(events1[0].args.referenceNumber).to.equal(
      events2[0].args.referenceNumber
    );
  });
});
