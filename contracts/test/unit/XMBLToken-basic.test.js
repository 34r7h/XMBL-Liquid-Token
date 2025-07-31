const { expect } = require("chai");
const { parseEther, keccak256, ZeroAddress, MaxUint256, ZeroHash } = require("ethers");
const { ethers } = require("hardhat");

describe("XMBLToken - Basic Functionality", function () {
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

  describe("Basic NFT Operations", function () {
    it("Should mint NFT with TBA creation", async function () {
      const depositValue = ethers.parseEther("1.0");
      const tokenAddress = ethers.ZeroAddress; // ETH
      
      const tx = await xmblToken.connect(minter).mintWithTBA(
        user1.address,
        depositValue,
        tokenAddress
      );
      
      // Verify NFT was minted
      expect(await xmblToken.ownerOf(1)).to.equal(user1.address);
      expect(await xmblToken.balanceOf(user1.address)).to.equal(1);
      
      // Verify TBA was created
      const tbaAddress = await xmblToken.getTokenBoundAccount(1);
      expect(tbaAddress).to.not.equal(ethers.ZeroAddress);
      
      // Verify NFT data
      const nftData = await xmblToken.getNFTData(1);
      expect(nftData.depositValue).to.equal(depositValue);
      expect(nftData.tokenAddress).to.equal(tokenAddress);
      expect(nftData.tbaAddress).to.equal(tbaAddress);
    });

    it("Should get user portfolio", async function () {
      // Mint two NFTs for user1
      await xmblToken.connect(minter).mintWithTBA(
        user1.address,
        ethers.parseEther("1.0"),
        ethers.ZeroAddress
      );
      await xmblToken.connect(minter).mintWithTBA(
        user1.address,
        ethers.parseEther("2.0"),
        ethers.ZeroAddress
      );
      
      const portfolio = await xmblToken.getUserPortfolio(user1.address);
      
      expect(portfolio.tokenIds).to.have.lengthOf(2);
      expect(portfolio.nftData).to.have.lengthOf(2);
      expect(portfolio.totalDepositValue).to.equal(ethers.parseEther("3.0"));
    });

    it("Should batch mint NFTs", async function () {
      const recipients = [user1.address, user1.address];
      const depositValues = [ethers.parseEther("1.0"), ethers.parseEther("2.0")];
      const tokenAddresses = [ethers.ZeroAddress, ethers.ZeroAddress];
      
      const tokenIds = await xmblToken.connect(minter).batchMintWithTBA(
        recipients,
        depositValues,
        tokenAddresses
      );
      
      expect(await xmblToken.balanceOf(user1.address)).to.equal(2);
      expect(await xmblToken.ownerOf(1)).to.equal(user1.address);
      expect(await xmblToken.ownerOf(2)).to.equal(user1.address);
    });

    it("Should enforce access control", async function () {
      await expect(
        xmblToken.connect(user1).mintWithTBA(
          user1.address,
          ethers.parseEther("1.0"),
          ethers.ZeroAddress
        )
      ).to.be.reverted;
    });

    it("Should create unique TBAs", async function () {
      await xmblToken.connect(minter).mintWithTBA(
        user1.address,
        ethers.parseEther("1.0"),
        ethers.ZeroAddress
      );
      await xmblToken.connect(minter).mintWithTBA(
        user1.address,
        ethers.parseEther("2.0"),
        ethers.ZeroAddress
      );
      
      const tba1 = await xmblToken.getTokenBoundAccount(1);
      const tba2 = await xmblToken.getTokenBoundAccount(2);
      
      expect(tba1).to.not.equal(tba2);
      expect(tba1).to.not.equal(ethers.ZeroAddress);
      expect(tba2).to.not.equal(ethers.ZeroAddress);
    });

    it("Should verify TBA ownership", async function () {
      await xmblToken.connect(minter).mintWithTBA(
        user1.address,
        ethers.parseEther("1.0"),
        ethers.ZeroAddress
      );
      
      expect(await xmblToken.isValidTBAOwner(1, user1.address)).to.be.true;
      expect(await xmblToken.isValidTBAOwner(1, await minter.getAddress())).to.be.false;
    });
  });
});
