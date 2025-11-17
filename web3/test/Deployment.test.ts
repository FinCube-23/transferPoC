import { expect } from "chai";
import { ethers } from "hardhat";

describe("Deployment and Initialization", function () {
  let finCubeDAO: any;
  let mockERC20: any;
  let finCube: any;
  let owner: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

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

  it("Should deploy FinCubeDAO contract", async function () {
    expect(await finCubeDAO.getAddress()).to.be.properAddress;
  });

  it("Should deploy MockERC20 token contract", async function () {
    expect(await mockERC20.getAddress()).to.be.properAddress;
  });

  it("Should deploy FinCube contract", async function () {
    expect(await finCube.getAddress()).to.be.properAddress;
  });

  it("Should initialize FinCube with DAO and token addresses", async function () {
    const daoAddress = await finCube.dao();
    const tokenAddress = await finCube.approvedERC20();

    expect(daoAddress).to.equal(await finCubeDAO.getAddress());
    expect(tokenAddress).to.equal(await mockERC20.getAddress());
  });

  it("Should verify initialization can only happen once", async function () {
    await expect(
      finCubeDAO.initialize("Test DAO URI 2", "Owner URI 2")
    ).to.be.revertedWithCustomError(finCubeDAO, "InvalidInitialization");

    await expect(
      finCube.initialize(
        await finCubeDAO.getAddress(),
        await mockERC20.getAddress()
      )
    ).to.be.revertedWithCustomError(finCube, "InvalidInitialization");
  });

  it("Should initialize with owner as first member", async function () {
    const isOwnerApproved = await finCubeDAO.checkIsMemberApproved(
      owner.address
    );
    expect(isOwnerApproved).to.equal(true);
  });
});
