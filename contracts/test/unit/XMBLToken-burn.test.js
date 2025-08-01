const { expect } = require("chai");
const { parseEther, keccak256, ZeroAddress, MaxUint256, ZeroHash } = require("ethers");
const { ethers } = require("hardhat");

describe("XMBLToken - Burn Functionality", function () {
  let xmblToken;
  let registry;
  let tbaImplementation;
  let owner, minter, user1;

  beforeEach(async function () {
    [owner, minter, user1] = await ethers.getSigners();
    
    // Deploy ERC-6551 Registry
    const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
    registry = await ERC6551Registry.deploy();
    await registry.waitForDeployment();
    
    // Deploy Token Bound Account implementation
    const TBAImplementation = await ethers.getContractFactory("TBAImplementation");
    tbaImplementation = await TBAImplementation.deploy();
    await tbaImplementation.waitForDeployment();
    
    // Deploy XMBLToken
    const XMBLToken = await ethers.getContractFactory("XMBLToken");
    xmblToken = await XMBLToken.deploy(
      "XMBL Liquid Token", 
      "XMBL",
      await registry.getAddress(),
      await tbaImplementation.getAddress()
    );
    await xmblToken.waitForDeployment();
    
    // Grant minter role
    const MINTER_ROLE = await xmblToken.MINTER_ROLE();
    await xmblToken.grantRole(MINTER_ROLE, await minter.getAddress());
  });

  it("Should allow NFT burning by authorized accounts", async function () {
    // Mint NFT first
    await xmblToken.connect(minter).mintWithTBA(
      user1.address,
      ethers.parseEther("1.0"),
      ethers.ZeroAddress
    );
    
    expect(await xmblToken.ownerOf(1)).to.equal(user1.address);
    
    // Burn NFT
    const tx = await xmblToken.connect(minter).burn(1);
    
    await expect(tx)
      .to.emit(xmblToken, "TokenBurned")
      .withArgs(1, user1.address);
    
    // Verify NFT is burned
    await expect(xmblToken.ownerOf(1)).to.be.reverted;
    expect(await xmblToken.balanceOf(user1.address)).to.equal(0);
  });

  it("Should clean up data when burning NFT", async function () {
    await xmblToken.connect(minter).mintWithTBA(
      user1.address,
      ethers.parseEther("1.0"),
      ethers.ZeroAddress
    );
    
    await xmblToken.connect(minter).burn(1);
    
    // Verify data is cleaned up
    await expect(xmblToken.getNFTData(1)).to.be.revertedWith("Token does not exist");
    await expect(xmblToken.getTokenBoundAccount(1)).to.be.revertedWith("Token does not exist");
  });

  it("Should only allow authorized burning", async function () {
    await xmblToken.connect(minter).mintWithTBA(
      user1.address,
      ethers.parseEther("1.0"),
      ethers.ZeroAddress
    );
    
    await expect(
      xmblToken.connect(user1).burn(1)
    ).to.be.reverted;
  });

  it("Should handle burning non-existent tokens", async function () {
    await expect(
      xmblToken.connect(minter).burn(999)
    ).to.be.revertedWith("ERC721: invalid token ID");
  });
});
