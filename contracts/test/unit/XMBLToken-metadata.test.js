const { expect } = require("chai");
const { parseEther, keccak256, ZeroAddress, MaxUint256, ZeroHash } = require("ethers");
const { ethers } = require("hardhat");

describe("XMBLToken - Metadata", function () {
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

  it("Should generate proper token URI with metadata", async function () {
    await xmblToken.connect(minter).mintWithTBA(
      user1.address,
      ethers.parseEther("1.0"),
      ethers.ZeroAddress
    );
    
    const tokenURI = await xmblToken.tokenURI(1);
    
    expect(tokenURI).to.include("data:application/json;base64,");
    
    // Decode and verify metadata
    const base64Data = tokenURI.split(",")[1];
    const metadata = JSON.parse(Buffer.from(base64Data, 'base64').toString());
    
    expect(metadata.name).to.include("XMBL Liquid Token #1");
    expect(metadata.description).to.include("XMBL protocol");
    expect(metadata.attributes).to.be.an('array');
    
    // Check for required attributes
    const attributes = metadata.attributes;
    const depositValueAttr = attributes.find(attr => attr.trait_type === "Deposit Value");
    const tokenAddressAttr = attributes.find(attr => attr.trait_type === "Token Address");
    const tbaAddressAttr = attributes.find(attr => attr.trait_type === "TBA Address");
    
    expect(depositValueAttr).to.exist;
    expect(tokenAddressAttr).to.exist;
    expect(tbaAddressAttr).to.exist;
  });

  it("Should handle token URI for non-existent tokens", async function () {
    await expect(
      xmblToken.tokenURI(999)
    ).to.be.revertedWith("Token does not exist");
  });
});
