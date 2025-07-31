const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("XMBL Protocol Integration Test", function () {
  async function deployXMBLFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const wbtc = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);

    // Deploy ERC-6551 Registry
    const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
    const registry = await ERC6551Registry.deploy();

    // Deploy Token Bound Account implementation
    const TBAImplementation = await ethers.getContractFactory("TBAImplementation");
    const tbaImplementation = await TBAImplementation.deploy();

    // Deploy XMBLToken
    const XMBLToken = await ethers.getContractFactory("XMBLToken");
    const xmblToken = await XMBLToken.deploy(
      "XMBL Liquid Token",
      "XMBL",
      registry.address,
      tbaImplementation.address
    );

    // Deploy YieldManager
    const YieldManager = await ethers.getContractFactory("YieldManager");
    const yieldManager = await YieldManager.deploy(wbtc.address);

    // Deploy XMBLVault
    const XMBLVault = await ethers.getContractFactory("XMBLVault");
    const vault = await XMBLVault.deploy(
      xmblToken.address,
      wbtc.address,
      registry.address,
      tbaImplementation.address,
      yieldManager.address
    );

    // Setup permissions
    await xmblToken.grantRole(await xmblToken.MINTER_ROLE(), vault.address);
    await yieldManager.setVault(vault.address);

    // Mint tokens to users for testing
    await usdc.mint(user1.address, ethers.utils.parseUnits("10000", 6));
    await usdc.mint(user2.address, ethers.utils.parseUnits("5000", 6));
    await wbtc.mint(vault.address, ethers.utils.parseUnits("10", 8));

    return {
      vault,
      xmblToken,
      usdc,
      wbtc,
      yieldManager,
      owner,
      user1,
      user2,
    };
  }

  it("Should handle the full user flow: deposit, yield distribution, and withdrawal", async function () {
    const { vault, xmblToken, usdc, wbtc, yieldManager, user1 } =
      await loadFixture(deployXMBLFixture);

    // 1. User deposits USDC
    const depositAmount = ethers.utils.parseUnits("1000", 6);
    await usdc.connect(user1).approve(vault.address, depositAmount);
    await vault.connect(user1).deposit(usdc.address, depositAmount);

    // Verify NFT was minted and TBA created
    const user1NFTs = await xmblToken.getUserTokens(user1.address);
    expect(user1NFTs.length).to.equal(1);
    const tokenId = user1NFTs[0];
    const tbaAddress = await xmblToken.getTokenBoundAccount(tokenId);
    expect(tbaAddress).to.not.equal(ethers.constants.AddressZero);

    // 2. Vault swaps USDC for WBTC (mocked) and deploys to YieldManager
    // For this test, we'll manually add WBTC to the vault and deploy it
    const wbtcAmount = ethers.utils.parseUnits("0.035", 8); // Approx. 1000 USDC
    await wbtc.mint(vault.address, wbtcAmount);
    await vault.deployToYieldManager(wbtc.address, wbtcAmount);

    // Verify funds are in YieldManager
    expect(await wbtc.balanceOf(yieldManager.address)).to.equal(wbtcAmount);

    // 3. Yield is generated and distributed
    const yieldAmount = ethers.utils.parseUnits("0.001", 8);
    await wbtc.mint(yieldManager.address, yieldAmount); // Simulate yield
    await yieldManager.harvestYield();
    await vault.distributeYields();

    // Verify yield is accrued to the TBA
    const accruedYield = await vault.accruedYields(tokenId);
    expect(accruedYield).to.be.gt(0);

    // 4. User claims yield
    await vault.connect(user1).claimYields(tokenId);

    // 5. User withdraws funds
    await vault.connect(user1).withdraw(tokenId);

    // Verify user received their funds back
    expect(await usdc.balanceOf(user1.address)).to.be.gt(
      ethers.utils.parseUnits("9000", 6)
    );
  });
});
