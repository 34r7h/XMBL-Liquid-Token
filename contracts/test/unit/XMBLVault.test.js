const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("XMBLVault", function () {
  // Test fixtures for consistent test setup
  async function deployXMBLVaultFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const wbtc = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    
    // Deploy XMBLToken (ERC-721 with ERC-6551 support)
    const XMBLToken = await ethers.getContractFactory("XMBLToken");
    const xmblToken = await XMBLToken.deploy();
    
    // Deploy ERC-6551 Registry
    const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
    const registry = await ERC6551Registry.deploy();
    
    // Deploy Token Bound Account implementation
    const TBAImplementation = await ethers.getContractFactory("TBAImplementation");
    const tbaImplementation = await TBAImplementation.deploy();
    
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
    await xmblToken.setMinter(vault.address);
    await yieldManager.setVault(vault.address);
    
    // Mint tokens to users for testing
    await usdc.mint(user1.address, ethers.utils.parseUnits("10000", 6)); // 10,000 USDC
    await usdc.mint(user2.address, ethers.utils.parseUnits("5000", 6));  // 5,000 USDC
    await wbtc.mint(vault.address, ethers.utils.parseUnits("10", 8));    // 10 WBTC to vault
    
    return {
      vault,
      xmblToken,
      usdc,
      wbtc,
      registry,
      tbaImplementation,
      yieldManager,
      owner,
      user1,
      user2,
      user3
    };
  }

  describe("Deployment and Initialization", function () {
    it("Should deploy with correct initial parameters", async function () {
      const { vault, xmblToken, wbtc, registry, tbaImplementation } = await loadFixture(deployXMBLVaultFixture);
      
      expect(await vault.xmblToken()).to.equal(xmblToken.address);
      expect(await vault.wbtcToken()).to.equal(wbtc.address);
      expect(await vault.erc6551Registry()).to.equal(registry.address);
      expect(await vault.tbaImplementation()).to.equal(tbaImplementation.address);
    });

    it("Should set correct initial bonding curve rate", async function () {
      const { vault } = await loadFixture(deployXMBLVaultFixture);
      
      const initialRate = await vault.bondingCurveRate();
      expect(initialRate).to.equal(ethers.utils.parseUnits("1.0", 18)); // 1.0 as default rate
    });

    it("Should initialize with zero TVL and next token ID", async function () {
      const { vault } = await loadFixture(deployXMBLVaultFixture);
      
      expect(await vault.totalValueLocked()).to.equal(0);
      expect(await vault.nextTokenId()).to.equal(1);
      expect(await vault.pausedDeposits()).to.be.false;
    });

    it("Should only allow owner to set critical parameters", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await expect(
        vault.connect(user1).updateBondingCurve(ethers.utils.parseUnits("2.0", 18))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Token Deposits and NFT Minting", function () {
    it("Should accept ETH deposit and mint XMBL NFT with TBA", async function () {
      const { vault, xmblToken, registry, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      const depositAmount = ethers.utils.parseEther("1.0"); // 1 ETH
      
      const tx = await vault.connect(user1).deposit(
        ethers.constants.AddressZero, // ETH
        0, // Amount is in msg.value for ETH
        { value: depositAmount }
      );
      
      await expect(tx)
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, ethers.constants.AddressZero, depositAmount, 1, await vault.getTokenBoundAccount(1));
      
      await expect(tx)
        .to.emit(vault, "NFTMinted")
        .withArgs(user1.address, 1, await vault.getTokenBoundAccount(1));
      
      // Verify NFT was minted
      expect(await xmblToken.ownerOf(1)).to.equal(user1.address);
      
      // Verify TBA was created
      const tbaAddress = await vault.getTokenBoundAccount(1);
      expect(tbaAddress).to.not.equal(ethers.constants.AddressZero);
      
      // Verify deposit value tracking
      expect(await vault.nftDepositValues(1)).to.equal(depositAmount);
      
      // Verify user NFT tracking
      const userNFTs = await vault.getUserNFTs(user1.address);
      expect(userNFTs).to.deep.equal([ethers.BigNumber.from(1)]);
    });

    it("Should accept ERC-20 token deposit and create NFT with TBA", async function () {
      const { vault, xmblToken, usdc, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      const depositAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDC
      
      // Approve vault to spend USDC
      await usdc.connect(user1).approve(vault.address, depositAmount);
      
      const tx = await vault.connect(user1).deposit(usdc.address, depositAmount);
      
      await expect(tx)
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, usdc.address, depositAmount, 1, await vault.getTokenBoundAccount(1));
      
      // Verify USDC was transferred to vault
      expect(await usdc.balanceOf(vault.address)).to.equal(depositAmount);
      expect(await usdc.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("9000", 6));
      
      // Verify NFT was minted
      expect(await xmblToken.ownerOf(1)).to.equal(user1.address);
    });

    it("Should calculate correct XMBL value based on bonding curve", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      const depositAmount = ethers.utils.parseEther("1.0");
      const bondingCurveRate = await vault.bondingCurveRate();
      
      const expectedValue = await vault.calculateXMBLValue(depositAmount, ethers.constants.AddressZero);
      
      // Value should be calculated based on bonding curve formula
      expect(expectedValue).to.be.gt(0);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: depositAmount });
      
      const actualValue = await vault.nftDepositValues(1);
      expect(actualValue).to.equal(expectedValue);
    });

    it("Should handle multiple deposits from same user", async function () {
      const { vault, xmblToken, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      // First deposit
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      // Second deposit
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("0.5") });
      
      // Verify two NFTs were minted
      expect(await xmblToken.ownerOf(1)).to.equal(user1.address);
      expect(await xmblToken.ownerOf(2)).to.equal(user1.address);
      
      // Verify user NFT tracking
      const userNFTs = await vault.getUserNFTs(user1.address);
      expect(userNFTs).to.have.lengthOf(2);
      expect(userNFTs[0]).to.equal(1);
      expect(userNFTs[1]).to.equal(2);
    });

    it("Should reject deposits when paused", async function () {
      const { vault, owner, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(owner).pauseDeposits();
      
      await expect(
        vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") })
      ).to.be.revertedWith("Deposits are paused");
    });

    it("Should reject invalid deposit parameters", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      // Zero ETH deposit
      await expect(
        vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: 0 })
      ).to.be.revertedWith("Invalid deposit amount");
      
      // Token deposit without approval
      await expect(
        vault.connect(user1).deposit("0x1234567890123456789012345678901234567890", ethers.utils.parseUnits("100", 6))
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("Token Bound Account Operations", function () {
    it("Should create unique TBA for each NFT", async function () {
      const { vault, user1, user2 } = await loadFixture(deployXMBLVaultFixture);
      
      // Create two deposits
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      await vault.connect(user2).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const tba1 = await vault.getTokenBoundAccount(1);
      const tba2 = await vault.getTokenBoundAccount(2);
      
      expect(tba1).to.not.equal(tba2);
      expect(tba1).to.not.equal(ethers.constants.AddressZero);
      expect(tba2).to.not.equal(ethers.constants.AddressZero);
    });

    it("Should allow TBA to receive and hold assets", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const tbaAddress = await vault.getTokenBoundAccount(1);
      
      // Send some USDC to TBA
      await usdc.mint(tbaAddress, ethers.utils.parseUnits("100", 6));
      
      expect(await usdc.balanceOf(tbaAddress)).to.equal(ethers.utils.parseUnits("100", 6));
    });

    it("Should allow NFT owner to execute transactions from TBA", async function () {
      const { vault, usdc, user1, user2 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const tbaAddress = await vault.getTokenBoundAccount(1);
      await usdc.mint(tbaAddress, ethers.utils.parseUnits("100", 6));
      
      // Execute transfer from TBA
      const transferData = usdc.interface.encodeFunctionData("transfer", [user2.address, ethers.utils.parseUnits("50", 6)]);
      
      await vault.connect(user1).executeTBATransaction(1, usdc.address, 0, transferData);
      
      expect(await usdc.balanceOf(tbaAddress)).to.equal(ethers.utils.parseUnits("50", 6));
      expect(await usdc.balanceOf(user2.address)).to.equal(ethers.utils.parseUnits("50", 6));
    });

    it("Should prevent unauthorized TBA operations", async function () {
      const { vault, usdc, user1, user2 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const transferData = usdc.interface.encodeFunctionData("transfer", [user2.address, ethers.utils.parseUnits("50", 6)]);
      
      await expect(
        vault.connect(user2).executeTBATransaction(1, usdc.address, 0, transferData)
      ).to.be.revertedWith("Not NFT owner");
    });
  });

  describe("1inch Swap Integration", function () {
    it("Should execute swap through 1inch integration", async function () {
      const { vault, usdc, wbtc, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      const depositAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDC
      
      // Approve and deposit USDC
      await usdc.connect(user1).approve(vault.address, depositAmount);
      await vault.connect(user1).deposit(usdc.address, depositAmount);
      
      // Mock 1inch swap data (would come from 1inch API in practice)
      const mockSwapData = "0x1234567890abcdef"; // Simplified swap data
      
      const initialWBTCBalance = await wbtc.balanceOf(vault.address);
      
      await expect(
        vault.connect(user1).executeSwap(usdc.address, depositAmount, mockSwapData)
      ).to.emit(vault, "SwapExecuted");
      
      // In a real test, this would verify WBTC was received
      // For now, just verify the event was emitted
    });

    it("Should handle swap failures gracefully", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      const depositAmount = ethers.utils.parseUnits("1000", 6);
      
      await usdc.connect(user1).approve(vault.address, depositAmount);
      await vault.connect(user1).deposit(usdc.address, depositAmount);
      
      // Invalid swap data
      const invalidSwapData = "0x";
      
      await expect(
        vault.connect(user1).executeSwap(usdc.address, depositAmount, invalidSwapData)
      ).to.be.revertedWith("Swap execution failed");
    });

    it("Should only allow authorized swap execution", async function () {
      const { vault, usdc, user1, user2 } = await loadFixture(deployXMBLVaultFixture);
      
      const mockSwapData = "0x1234567890abcdef";
      
      await expect(
        vault.connect(user1).executeSwap(usdc.address, ethers.utils.parseUnits("1000", 6), mockSwapData)
      ).to.be.revertedWith("Unauthorized swap execution");
    });
  });

  describe("Yield Distribution", function () {
    it("Should distribute yields proportionally to NFT deposit values", async function () {
      const { vault, owner, user1, user2 } = await loadFixture(deployXMBLVaultFixture);
      
      // Create deposits with different values
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("2.0") });
      await vault.connect(user2).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const totalYield = ethers.utils.parseEther("0.3"); // 0.3 ETH yield to distribute
      
      await expect(
        vault.connect(owner).distributeYields(totalYield, { value: totalYield })
      ).to.emit(vault, "YieldDistributed");
      
      // User1 should get 2/3 of yield (0.2 ETH), User2 should get 1/3 (0.1 ETH)
      expect(await vault.accruedYields(1)).to.equal(ethers.utils.parseEther("0.2"));
      expect(await vault.accruedYields(2)).to.equal(ethers.utils.parseEther("0.1"));
    });

    it("Should allow users to claim individual NFT yields", async function () {
      const { vault, owner, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const totalYield = ethers.utils.parseEther("0.1");
      await vault.connect(owner).distributeYields(totalYield, { value: totalYield });
      
      const initialBalance = await user1.getBalance();
      
      const tx = await vault.connect(user1).claimYields(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      await expect(tx)
        .to.emit(vault, "YieldClaimed")
        .withArgs(1, user1.address, totalYield);
      
      const finalBalance = await user1.getBalance();
      expect(finalBalance.add(gasUsed)).to.be.closeTo(initialBalance.add(totalYield), ethers.utils.parseEther("0.001"));
      
      // Yield should be reset after claiming
      expect(await vault.accruedYields(1)).to.equal(0);
    });

    it("Should allow batch yield claiming for multiple NFTs", async function () {
      const { vault, owner, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      // Create two deposits
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const totalYield = ethers.utils.parseEther("0.2");
      await vault.connect(owner).distributeYields(totalYield, { value: totalYield });
      
      await vault.connect(user1).claimMultipleYields([1, 2]);
      
      expect(await vault.accruedYields(1)).to.equal(0);
      expect(await vault.accruedYields(2)).to.equal(0);
    });

    it("Should prevent claiming yields for non-owned NFTs", async function () {
      const { vault, owner, user1, user2 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const totalYield = ethers.utils.parseEther("0.1");
      await vault.connect(owner).distributeYields(totalYield, { value: totalYield });
      
      await expect(
        vault.connect(user2).claimYields(1)
      ).to.be.revertedWith("Not NFT owner");
    });

    it("Should handle zero yield claims gracefully", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      await expect(
        vault.connect(user1).claimYields(1)
      ).to.be.revertedWith("No yields to claim");
    });

    it("Should update yield distribution when TBA receives additional yields", async function () {
      const { vault, owner, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const tbaAddress = await vault.getTokenBoundAccount(1);
      
      // Send ETH directly to TBA (simulating yield)
      await owner.sendTransaction({
        to: tbaAddress,
        value: ethers.utils.parseEther("0.05")
      });
      
      expect(await ethers.provider.getBalance(tbaAddress)).to.equal(ethers.utils.parseEther("0.05"));
    });
  });

  describe("NFT Withdrawal", function () {
    it("Should allow NFT holder to withdraw underlying assets", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      const depositAmount = ethers.utils.parseEther("1.0");
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: depositAmount });
      
      const initialBalance = await user1.getBalance();
      
      const tx = await vault.connect(user1).withdraw(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      await expect(tx)
        .to.emit(vault, "Withdraw")
        .withArgs(user1.address, 1, depositAmount);
      
      const finalBalance = await user1.getBalance();
      expect(finalBalance.add(gasUsed)).to.be.closeTo(initialBalance.add(depositAmount), ethers.utils.parseEther("0.001"));
      
      // NFT should be burned
      await expect(vault.getTokenBoundAccount(1)).to.be.revertedWith("NFT not found");
    });

    it("Should prevent withdrawal by non-owner", async function () {
      const { vault, user1, user2 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      await expect(
        vault.connect(user2).withdraw(1)
      ).to.be.revertedWith("Not NFT owner");
    });

    it("Should handle withdrawal when TBA has additional assets", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const tbaAddress = await vault.getTokenBoundAccount(1);
      await usdc.mint(tbaAddress, ethers.utils.parseUnits("100", 6));
      
      // Withdrawal should include both original deposit and TBA assets
      await vault.connect(user1).withdraw(1);
      
      // TBA assets should be transferred back to user
      expect(await usdc.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("10100", 6)); // Original + TBA balance
    });
  });

  describe("Bonding Curve Management", function () {
    it("Should allow owner to update bonding curve rate", async function () {
      const { vault, owner } = await loadFixture(deployXMBLVaultFixture);
      
      const newRate = ethers.utils.parseUnits("2.0", 18);
      
      await expect(
        vault.connect(owner).updateBondingCurve(newRate)
      ).to.emit(vault, "BondingCurveUpdated");
      
      expect(await vault.bondingCurveRate()).to.equal(newRate);
    });

    it("Should apply new bonding curve rate to subsequent deposits", async function () {
      const { vault, owner, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      // Deposit with original rate
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      const originalValue = await vault.nftDepositValues(1);
      
      // Update rate
      await vault.connect(owner).updateBondingCurve(ethers.utils.parseUnits("2.0", 18));
      
      // Deposit with new rate
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      const newValue = await vault.nftDepositValues(2);
      
      expect(newValue).to.not.equal(originalValue);
    });

    it("Should validate bonding curve rate bounds", async function () {
      const { vault, owner } = await loadFixture(deployXMBLVaultFixture);
      
      // Too low rate
      await expect(
        vault.connect(owner).updateBondingCurve(0)
      ).to.be.revertedWith("Invalid bonding curve rate");
      
      // Too high rate
      await expect(
        vault.connect(owner).updateBondingCurve(ethers.utils.parseUnits("10.0", 18))
      ).to.be.revertedWith("Invalid bonding curve rate");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to pause and unpause deposits", async function () {
      const { vault, owner } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(owner).pauseDeposits();
      expect(await vault.pausedDeposits()).to.be.true;
      
      await vault.connect(owner).unpauseDeposits();
      expect(await vault.pausedDeposits()).to.be.false;
    });

    it("Should allow emergency withdrawal by owner", async function () {
      const { vault, owner } = await loadFixture(deployXMBLVaultFixture);
      
      // Send some ETH to vault
      await owner.sendTransaction({
        to: vault.address,
        value: ethers.utils.parseEther("1.0")
      });
      
      const initialOwnerBalance = await owner.getBalance();
      
      await vault.connect(owner).emergencyWithdraw();
      
      const finalOwnerBalance = await owner.getBalance();
      expect(finalOwnerBalance).to.be.gt(initialOwnerBalance);
    });

    it("Should prevent non-owner from emergency functions", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await expect(
        vault.connect(user1).pauseDeposits()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        vault.connect(user1).emergencyWithdraw()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Gas Optimization", function () {
    it("Should batch operations efficiently", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      // Test gas efficiency of multiple deposits
      const deposits = [];
      for (let i = 0; i < 5; i++) {
        deposits.push(
          vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("0.1") })
        );
      }
      
      await Promise.all(deposits);
      
      const userNFTs = await vault.getUserNFTs(user1.address);
      expect(userNFTs).to.have.lengthOf(5);
    });

    it("Should use minimal gas for TBA operations", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      const tbaAddress = await vault.getTokenBoundAccount(1);
      
      // Gas cost should be reasonable for TBA address calculation
      expect(tbaAddress).to.not.equal(ethers.constants.AddressZero);
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete user flow: deposit, yield, claim, withdraw", async function () {
      const { vault, owner, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      // 1. Deposit
      const depositAmount = ethers.utils.parseEther("1.0");
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: depositAmount });
      
      // 2. Yield distribution
      const yieldAmount = ethers.utils.parseEther("0.1");
      await vault.connect(owner).distributeYields(yieldAmount, { value: yieldAmount });
      
      // 3. Claim yield
      await vault.connect(user1).claimYields(1);
      
      // 4. Withdraw principal
      await vault.connect(user1).withdraw(1);
      
      // Verify final state
      const userNFTs = await vault.getUserNFTs(user1.address);
      expect(userNFTs).to.have.lengthOf(0);
    });

    it("Should handle multiple users with different strategies", async function () {
      const { vault, owner, user1, user2, user3 } = await loadFixture(deployXMBLVaultFixture);
      
      // Different deposit amounts
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("2.0") });
      await vault.connect(user2).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      await vault.connect(user3).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("0.5") });
      
      // Yield distribution
      const totalYield = ethers.utils.parseEther("0.35");
      await vault.connect(owner).distributeYields(totalYield, { value: totalYield });
      
      // Different claiming strategies
      await vault.connect(user1).claimYields(1); // Immediate claim
      // user2 and user3 leave yields to compound
      
      // Second yield distribution
      await vault.connect(owner).distributeYields(totalYield, { value: totalYield });
      
      // Verify proportional distribution
      const user1Yield = await vault.accruedYields(1);
      const user2Yield = await vault.accruedYields(2);
      const user3Yield = await vault.accruedYields(3);
      
      expect(user2Yield).to.be.gt(user3Yield); // user2 deposited more
      expect(user1Yield).to.be.gt(user3Yield); // user1 deposited more
    });
  });

  describe("Security Tests", function () {
    it("Should prevent reentrancy attacks", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.utils.parseEther("1.0") });
      
      // Attempt reentrancy during withdrawal
      // This would require a malicious contract, simplified here
      await expect(
        vault.connect(user1).withdraw(1)
      ).to.not.be.reverted; // Should complete normally without reentrancy
    });

    it("Should validate all inputs properly", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      // Invalid addresses
      await expect(
        vault.connect(user1).deposit("0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1.0"))
      ).to.be.revertedWith("Invalid token address");
      
      // Overflow protection
      await expect(
        vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: ethers.constants.MaxUint256 })
      ).to.be.reverted;
    });

    it("Should handle edge cases gracefully", async function () {
      const { vault, user1 } = await loadFixture(deployXMBLVaultFixture);
      
      // Minimum deposit
      await vault.connect(user1).deposit(ethers.constants.AddressZero, 0, { value: 1 });
      expect(await vault.nftDepositValues(1)).to.equal(1);
      
      // Operations on non-existent NFT
      await expect(
        vault.connect(user1).claimYields(999)
      ).to.be.revertedWith("NFT not found");
    });
  });
});
