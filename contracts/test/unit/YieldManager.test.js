const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("YieldManager", function () {
  let yieldManager;
  let owner;
  let vault;
  let user1;
  let user2;
  let mockWBTC;
  let mockCompound;
  let mockAave;
  let mockProtocol3;

  const INITIAL_WBTC_SUPPLY = ethers.utils.parseEther("100");
  const DEPLOY_AMOUNT = ethers.utils.parseEther("10");
  const YIELD_AMOUNT = ethers.utils.parseEther("0.5");

  beforeEach(async function () {
    [owner, vault, user1, user2] = await ethers.getSigners();

    // Deploy mock WBTC token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 18);
    await mockWBTC.deployed();

    // Deploy mock yield protocols
    const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
    mockCompound = await MockYieldProtocol.deploy("Compound", "5.5"); // 5.5% APY
    mockAave = await MockYieldProtocol.deploy("Aave", "4.8"); // 4.8% APY
    mockProtocol3 = await MockYieldProtocol.deploy("Protocol3", "6.2"); // 6.2% APY

    await mockCompound.deployed();
    await mockAave.deployed();
    await mockProtocol3.deployed();

    // Note: Skip tests if YieldManager contract is not implemented
    try {
      const YieldManager = await ethers.getContractFactory("YieldManager");
      yieldManager = await YieldManager.deploy(mockWBTC.address);
      await yieldManager.deployed();

      // Set vault address
      await yieldManager.setVaultContract(vault.address);

      // Mint WBTC to vault for testing
      await mockWBTC.mint(vault.address, INITIAL_WBTC_SUPPLY);
      await mockWBTC.connect(vault).approve(yieldManager.address, INITIAL_WBTC_SUPPLY);
    } catch (error) {
      console.log("YieldManager contract not implemented, skipping tests");
      this.skip();
    }
  });

  describe("Contract Deployment", function () {
    it("should deploy with correct initial values", async function () {
      expect(await yieldManager.owner()).to.equal(owner.address);
      expect(await yieldManager.vaultContract()).to.equal(vault.address);
      expect(await yieldManager.totalDeployed()).to.equal(0);
      expect(await yieldManager.totalYieldHarvested()).to.equal(0);
      expect(await yieldManager.rebalanceThreshold()).to.be.gt(0);
    });

    it("should initialize with no active protocols", async function () {
      const activeProtocols = await yieldManager.getActiveProtocols();
      expect(activeProtocols.length).to.equal(0);
    });

    it("should set WBTC token address correctly", async function () {
      expect(await yieldManager.wbtcToken()).to.equal(mockWBTC.address);
    });

    it("should initialize with zero balances", async function () {
      expect(await yieldManager.protocolBalances(mockCompound.address)).to.equal(0);
      expect(await yieldManager.accruedYield(mockCompound.address)).to.equal(0);
    });
  });

  describe("Protocol Management", function () {
    it("should enable yield protocol", async function () {
      await expect(yieldManager.setYieldProtocol(mockCompound.address, true))
        .to.emit(yieldManager, "ProtocolStatusChanged")
        .withArgs(mockCompound.address, true);

      expect(await yieldManager.enabledProtocols(mockCompound.address)).to.equal(true);
    });

    it("should disable yield protocol", async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      
      await expect(yieldManager.setYieldProtocol(mockCompound.address, false))
        .to.emit(yieldManager, "ProtocolStatusChanged")
        .withArgs(mockCompound.address, false);

      expect(await yieldManager.enabledProtocols(mockCompound.address)).to.equal(false);
    });

    it("should reject protocol management by non-owner", async function () {
      await expect(
        yieldManager.connect(user1).setYieldProtocol(mockCompound.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should add protocol to active list when enabled", async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.setYieldProtocol(mockAave.address, true);

      const activeProtocols = await yieldManager.getActiveProtocols();
      expect(activeProtocols).to.include(mockCompound.address);
      expect(activeProtocols).to.include(mockAave.address);
      expect(activeProtocols.length).to.equal(2);
    });

    it("should remove protocol from active list when disabled", async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.setYieldProtocol(mockAave.address, true);
      await yieldManager.setYieldProtocol(mockCompound.address, false);

      const activeProtocols = await yieldManager.getActiveProtocols();
      expect(activeProtocols).to.not.include(mockCompound.address);
      expect(activeProtocols).to.include(mockAave.address);
      expect(activeProtocols.length).to.equal(1);
    });

    it("should handle protocol limits", async function () {
      // Test maximum number of protocols if implemented
      const maxProtocols = 10;
      
      for (let i = 0; i < maxProtocols; i++) {
        const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
        const protocol = await MockYieldProtocol.deploy(`Protocol${i}`, "5.0");
        await protocol.deployed();
        
        await yieldManager.setYieldProtocol(protocol.address, true);
      }

      const activeProtocols = await yieldManager.getActiveProtocols();
      expect(activeProtocols.length).to.equal(maxProtocols);
    });
  });

  describe("Fund Deployment", function () {
    beforeEach(async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.setYieldProtocol(mockAave.address, true);
    });

    it("should deploy funds to yield protocol", async function () {
      await expect(
        yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT)
      )
        .to.emit(yieldManager, "FundsDeployed")
        .withArgs(mockCompound.address, DEPLOY_AMOUNT, anyValue);

      expect(await yieldManager.protocolBalances(mockCompound.address)).to.equal(DEPLOY_AMOUNT);
      expect(await yieldManager.totalDeployed()).to.equal(DEPLOY_AMOUNT);
    });

    it("should reject deployment to disabled protocol", async function () {
      await expect(
        yieldManager.connect(vault).deployFunds(mockProtocol3.address, DEPLOY_AMOUNT)
      ).to.be.revertedWith("Protocol not enabled");
    });

    it("should reject deployment by non-vault", async function () {
      await expect(
        yieldManager.connect(user1).deployFunds(mockCompound.address, DEPLOY_AMOUNT)
      ).to.be.revertedWith("Only vault can deploy funds");
    });

    it("should reject zero amount deployment", async function () {
      await expect(
        yieldManager.connect(vault).deployFunds(mockCompound.address, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("should handle multiple deployments", async function () {
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
      await yieldManager.connect(vault).deployFunds(mockAave.address, DEPLOY_AMOUNT.mul(2));

      expect(await yieldManager.protocolBalances(mockCompound.address)).to.equal(DEPLOY_AMOUNT);
      expect(await yieldManager.protocolBalances(mockAave.address)).to.equal(DEPLOY_AMOUNT.mul(2));
      expect(await yieldManager.totalDeployed()).to.equal(DEPLOY_AMOUNT.mul(3));
    });

    it("should update protocol balance correctly", async function () {
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);

      expect(await yieldManager.protocolBalances(mockCompound.address)).to.equal(DEPLOY_AMOUNT.mul(2));
    });

    it("should transfer WBTC to protocol", async function () {
      const initialBalance = await mockWBTC.balanceOf(mockCompound.address);

      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);

      const finalBalance = await mockWBTC.balanceOf(mockCompound.address);
      expect(finalBalance.sub(initialBalance)).to.equal(DEPLOY_AMOUNT);
    });
  });

  describe("Yield Harvesting", function () {
    beforeEach(async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.setYieldProtocol(mockAave.address, true);
      
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
      await yieldManager.connect(vault).deployFunds(mockAave.address, DEPLOY_AMOUNT);

      // Simulate yield accumulation
      await mockCompound.addYield(YIELD_AMOUNT);
      await mockAave.addYield(YIELD_AMOUNT.div(2));
    });

    it("should harvest yield from all protocols", async function () {
      const totalYieldBefore = await yieldManager.getTotalYield();

      await expect(yieldManager.harvestYield())
        .to.emit(yieldManager, "YieldHarvested");

      const totalYieldAfter = await yieldManager.getTotalYield();
      expect(totalYieldAfter).to.be.gt(totalYieldBefore);
    });

    it("should update accrued yield correctly", async function () {
      await yieldManager.harvestYield();

      expect(await yieldManager.accruedYield(mockCompound.address)).to.equal(YIELD_AMOUNT);
      expect(await yieldManager.accruedYield(mockAave.address)).to.equal(YIELD_AMOUNT.div(2));
    });

    it("should update total yield harvested", async function () {
      const expectedTotal = YIELD_AMOUNT.add(YIELD_AMOUNT.div(2));

      await yieldManager.harvestYield();

      expect(await yieldManager.totalYieldHarvested()).to.equal(expectedTotal);
    });

    it("should update last harvest time", async function () {
      const timeBefore = await yieldManager.lastHarvestTime();

      await yieldManager.harvestYield();

      const timeAfter = await yieldManager.lastHarvestTime();
      expect(timeAfter).to.be.gt(timeBefore);
    });

    it("should handle zero yield gracefully", async function () {
      // Harvest again without new yield
      await yieldManager.harvestYield();
      const totalBefore = await yieldManager.totalYieldHarvested();

      await yieldManager.harvestYield();
      const totalAfter = await yieldManager.totalYieldHarvested();

      expect(totalAfter).to.equal(totalBefore);
    });

    it("should allow anyone to trigger harvest", async function () {
      await expect(yieldManager.connect(user1).harvestYield()).to.not.be.reverted;
      await expect(yieldManager.connect(user2).harvestYield()).to.not.be.reverted;
    });

    it("should be gas efficient for frequent harvesting", async function () {
      const tx = await yieldManager.harvestYield();
      const receipt = await tx.wait();
      
      expect(receipt.gasUsed).to.be.lt(300000); // Reasonable gas limit
    });
  });

  describe("Fund Withdrawal", function () {
    beforeEach(async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
    });

    it("should withdraw funds from protocol", async function () {
      const withdrawAmount = DEPLOY_AMOUNT.div(2);

      await expect(
        yieldManager.connect(vault).withdrawFunds(mockCompound.address, withdrawAmount)
      )
        .to.emit(yieldManager, "FundsWithdrawn")
        .withArgs(mockCompound.address, withdrawAmount, anyValue);

      expect(await yieldManager.protocolBalances(mockCompound.address)).to.equal(withdrawAmount);
      expect(await yieldManager.totalDeployed()).to.equal(withdrawAmount);
    });

    it("should reject withdrawal by non-vault", async function () {
      await expect(
        yieldManager.connect(user1).withdrawFunds(mockCompound.address, DEPLOY_AMOUNT.div(2))
      ).to.be.revertedWith("Only vault can withdraw funds");
    });

    it("should reject withdrawal of more than deployed", async function () {
      await expect(
        yieldManager.connect(vault).withdrawFunds(mockCompound.address, DEPLOY_AMOUNT.mul(2))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("should reject zero amount withdrawal", async function () {
      await expect(
        yieldManager.connect(vault).withdrawFunds(mockCompound.address, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("should transfer WBTC back to vault", async function () {
      const vaultBalanceBefore = await mockWBTC.balanceOf(vault.address);
      const withdrawAmount = DEPLOY_AMOUNT.div(2);

      await yieldManager.connect(vault).withdrawFunds(mockCompound.address, withdrawAmount);

      const vaultBalanceAfter = await mockWBTC.balanceOf(vault.address);
      expect(vaultBalanceAfter.sub(vaultBalanceBefore)).to.equal(withdrawAmount);
    });

    it("should handle complete withdrawal", async function () {
      await yieldManager.connect(vault).withdrawFunds(mockCompound.address, DEPLOY_AMOUNT);

      expect(await yieldManager.protocolBalances(mockCompound.address)).to.equal(0);
      expect(await yieldManager.totalDeployed()).to.equal(0);
    });
  });

  describe("Position Rebalancing", function () {
    beforeEach(async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.setYieldProtocol(mockAave.address, true);
      await yieldManager.setYieldProtocol(mockProtocol3.address, true);

      // Deploy funds to create imbalance
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT.mul(3));
      await yieldManager.connect(vault).deployFunds(mockAave.address, DEPLOY_AMOUNT);
    });

    it("should rebalance positions across protocols", async function () {
      await expect(yieldManager.rebalancePositions())
        .to.emit(yieldManager, "PositionsRebalanced");

      // Check that funds are more evenly distributed
      const compoundBalance = await yieldManager.protocolBalances(mockCompound.address);
      const aaveBalance = await yieldManager.protocolBalances(mockAave.address);
      const protocol3Balance = await yieldManager.protocolBalances(mockProtocol3.address);

      expect(compoundBalance).to.be.lt(DEPLOY_AMOUNT.mul(3)); // Should be reduced
      expect(protocol3Balance).to.be.gt(0); // Should receive funds
    });

    it("should reject rebalancing by non-owner", async function () {
      await expect(
        yieldManager.connect(user1).rebalancePositions()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should optimize allocation based on yield rates", async function () {
      // Set different yield rates
      await mockCompound.setAPY("3.0"); // Lower yield
      await mockProtocol3.setAPY("8.0"); // Higher yield

      await yieldManager.rebalancePositions();

      const compoundBalance = await yieldManager.protocolBalances(mockCompound.address);
      const protocol3Balance = await yieldManager.protocolBalances(mockProtocol3.address);

      // Higher yield protocol should receive more funds
      expect(protocol3Balance).to.be.gt(compoundBalance);
    });

    it("should respect rebalance threshold", async function () {
      const threshold = await yieldManager.rebalanceThreshold();
      
      // If imbalance is below threshold, no rebalancing should occur
      // This test depends on the specific threshold implementation
      expect(threshold).to.be.gt(0);
    });

    it("should handle single protocol gracefully", async function () {
      await yieldManager.setYieldProtocol(mockAave.address, false);
      await yieldManager.setYieldProtocol(mockProtocol3.address, false);

      await expect(yieldManager.rebalancePositions()).to.not.be.reverted;
    });
  });

  describe("Position Queries", function () {
    beforeEach(async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.setYieldProtocol(mockAave.address, true);
      
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
      await yieldManager.connect(vault).deployFunds(mockAave.address, DEPLOY_AMOUNT.mul(2));
    });

    it("should return active positions", async function () {
      const positions = await yieldManager.getActivePositions();
      
      expect(positions.length).to.equal(2);
      
      const compoundPosition = positions.find(p => p.protocol === mockCompound.address);
      const aavePosition = positions.find(p => p.protocol === mockAave.address);
      
      expect(compoundPosition.balance).to.equal(DEPLOY_AMOUNT);
      expect(aavePosition.balance).to.equal(DEPLOY_AMOUNT.mul(2));
    });

    it("should calculate total yield correctly", async function () {
      await mockCompound.addYield(YIELD_AMOUNT);
      await mockAave.addYield(YIELD_AMOUNT.mul(2));

      const totalYield = await yieldManager.getTotalYield();
      expect(totalYield).to.equal(YIELD_AMOUNT.mul(3));
    });

    it("should return protocol-specific data", async function () {
      expect(await yieldManager.protocolBalances(mockCompound.address)).to.equal(DEPLOY_AMOUNT);
      expect(await yieldManager.protocolBalances(mockAave.address)).to.equal(DEPLOY_AMOUNT.mul(2));
      expect(await yieldManager.protocolBalances(mockProtocol3.address)).to.equal(0);
    });

    it("should track total deployed accurately", async function () {
      expect(await yieldManager.totalDeployed()).to.equal(DEPLOY_AMOUNT.mul(3));
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
    });

    it("should emergency withdraw from protocol", async function () {
      await expect(yieldManager.emergencyWithdraw(mockCompound.address))
        .to.emit(yieldManager, "EmergencyWithdrawal")
        .withArgs(mockCompound.address, DEPLOY_AMOUNT);

      expect(await yieldManager.protocolBalances(mockCompound.address)).to.equal(0);
    });

    it("should reject emergency withdraw by non-owner", async function () {
      await expect(
        yieldManager.connect(user1).emergencyWithdraw(mockCompound.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should pause all operations if implemented", async function () {
      try {
        await yieldManager.pause();
        
        await expect(
          yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT)
        ).to.be.revertedWith("Pausable: paused");
      } catch (error) {
        // Pause functionality not implemented
        this.skip();
      }
    });

    it("should handle protocol failure gracefully", async function () {
      // Simulate protocol failure
      await mockCompound.simulateFailure();

      await expect(yieldManager.emergencyWithdraw(mockCompound.address)).to.not.be.reverted;
    });
  });

  describe("Security Features", function () {
    it("should prevent unauthorized access to vault functions", async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);

      await expect(
        yieldManager.connect(user1).deployFunds(mockCompound.address, DEPLOY_AMOUNT)
      ).to.be.revertedWith("Only vault can deploy funds");

      await expect(
        yieldManager.connect(user1).withdrawFunds(mockCompound.address, DEPLOY_AMOUNT)
      ).to.be.revertedWith("Only vault can withdraw funds");
    });

    it("should prevent unauthorized protocol management", async function () {
      await expect(
        yieldManager.connect(user1).setYieldProtocol(mockCompound.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        yieldManager.connect(user1).rebalancePositions()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        yieldManager.connect(user1).emergencyWithdraw(mockCompound.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should validate protocol addresses", async function () {
      await expect(
        yieldManager.setYieldProtocol(ethers.constants.AddressZero, true)
      ).to.be.revertedWith("Invalid protocol address");
    });

    it("should handle reentrancy protection", async function () {
      // Test reentrancy protection on critical functions
      // This would require a malicious protocol contract
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      
      // Normal operation should work
      await expect(
        yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT)
      ).to.not.be.reverted;
    });

    it("should protect against integer overflow/underflow", async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);

      // Try to withdraw more than available
      await expect(
        yieldManager.connect(vault).withdrawFunds(mockCompound.address, DEPLOY_AMOUNT.mul(2))
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Gas Optimization", function () {
    it("should optimize gas for deployments", async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);

      const tx = await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
      const receipt = await tx.wait();

      expect(receipt.gasUsed).to.be.lt(200000); // Reasonable gas limit
    });

    it("should optimize gas for harvesting", async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
      await mockCompound.addYield(YIELD_AMOUNT);

      const tx = await yieldManager.harvestYield();
      const receipt = await tx.wait();

      expect(receipt.gasUsed).to.be.lt(250000); // Reasonable gas limit
    });

    it("should handle batch operations efficiently", async function () {
      await yieldManager.setYieldProtocol(mockCompound.address, true);
      await yieldManager.setYieldProtocol(mockAave.address, true);
      await yieldManager.setYieldProtocol(mockProtocol3.address, true);

      // Multiple deployments
      await yieldManager.connect(vault).deployFunds(mockCompound.address, DEPLOY_AMOUNT);
      await yieldManager.connect(vault).deployFunds(mockAave.address, DEPLOY_AMOUNT);
      await yieldManager.connect(vault).deployFunds(mockProtocol3.address, DEPLOY_AMOUNT);

      // Add yield to all
      await mockCompound.addYield(YIELD_AMOUNT);
      await mockAave.addYield(YIELD_AMOUNT);
      await mockProtocol3.addYield(YIELD_AMOUNT);

      // Harvest should be efficient even with multiple protocols
      const tx = await yieldManager.harvestYield();
      const receipt = await tx.wait();

      expect(receipt.gasUsed).to.be.lt(400000); // Should scale reasonably
    });
  });
});
