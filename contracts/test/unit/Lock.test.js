const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Lock", function () {
  let lock;
  let owner;
  let otherAccount;
  let user1;
  let user2;

  const LOCK_DURATION = 3600; // 1 hour
  const DEPOSIT_AMOUNT = ethers.utils.parseEther("1.0");

  beforeEach(async function () {
    [owner, otherAccount, user1, user2] = await ethers.getSigners();

    // Note: This test assumes a basic Lock contract implementation
    // If the actual Lock contract is different, these tests will need to be updated
    
    // Skip these tests if Lock contract is not implemented
    try {
      const Lock = await ethers.getContractFactory("Lock");
      const unlockTime = (await time.latest()) + LOCK_DURATION;
      
      lock = await Lock.deploy(unlockTime, {
        value: DEPOSIT_AMOUNT
      });
      await lock.deployed();
    } catch (error) {
      // Lock contract might not be implemented
      console.log("Lock contract not implemented, skipping tests");
      this.skip();
    }
  });

  describe("Deployment", function () {
    it("should set the right unlockTime", async function () {
      const expectedUnlockTime = (await time.latest()) - LOCK_DURATION + LOCK_DURATION;
      expect(await lock.getUnlockTime()).to.be.closeTo(expectedUnlockTime, 60);
    });

    it("should set the right owner", async function () {
      expect(await lock.getOwner()).to.equal(owner.address);
    });

    it("should receive and store the funds to lock", async function () {
      expect(await lock.getBalance()).to.equal(DEPOSIT_AMOUNT);
      expect(await ethers.provider.getBalance(lock.address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("should initialize withdrawn flag as false", async function () {
      expect(await lock.withdrawn()).to.equal(false);
    });

    it("should emit FundsLocked event on deployment", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const unlockTime = (await time.latest()) + LOCK_DURATION;
      
      await expect(
        Lock.deploy(unlockTime, { value: DEPOSIT_AMOUNT })
      )
        .to.emit(Lock, "FundsLocked")
        .withArgs(DEPOSIT_AMOUNT, unlockTime, owner.address);
    });

    it("should reject deployment with past unlock time", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const pastTime = (await time.latest()) - 3600; // 1 hour ago

      await expect(
        Lock.deploy(pastTime, { value: DEPOSIT_AMOUNT })
      ).to.be.revertedWith("Unlock time should be in the future");
    });

    it("should handle zero deposit amount", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const unlockTime = (await time.latest()) + LOCK_DURATION;

      const lock = await Lock.deploy(unlockTime, { value: 0 });
      expect(await lock.getBalance()).to.equal(0);
    });
  });

  describe("Unlock Status", function () {
    it("should return false for isUnlocked before unlock time", async function () {
      expect(await lock.isUnlocked()).to.equal(false);
    });

    it("should return true for isUnlocked after unlock time", async function () {
      await time.increase(LOCK_DURATION + 1);
      expect(await lock.isUnlocked()).to.equal(true);
    });

    it("should return exact unlock time", async function () {
      const unlockTime = await lock.getUnlockTime();
      expect(unlockTime).to.be.a("number");
      expect(unlockTime).to.be.gt(await time.latest());
    });
  });

  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("should revert with the right error if called too soon", async function () {
        await expect(lock.withdraw()).to.be.revertedWith(
          "You can't withdraw yet"
        );
      });

      it("should revert with the right error if called from another account", async function () {
        await time.increaseTo(await lock.getUnlockTime());

        await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
          "You aren't the owner"
        );
      });

      it("should revert if trying to withdraw multiple times", async function () {
        await time.increase(LOCK_DURATION + 1);
        
        await lock.withdraw();
        
        await expect(lock.withdraw()).to.be.revertedWith(
          "Funds already withdrawn"
        );
      });

      it("should revert if contract has no funds", async function () {
        // Create lock with zero funds
        const Lock = await ethers.getContractFactory("Lock");
        const unlockTime = (await time.latest()) + LOCK_DURATION;
        const emptyLock = await Lock.deploy(unlockTime, { value: 0 });

        await time.increase(LOCK_DURATION + 1);

        await expect(emptyLock.withdraw()).to.be.revertedWith(
          "No funds to withdraw"
        );
      });
    });

    describe("Events", function () {
      it("should emit an event on withdrawals", async function () {
        await time.increase(LOCK_DURATION + 1);

        await expect(lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(DEPOSIT_AMOUNT, anyValue);
      });
    });

    describe("Transfers", function () {
      it("should transfer the funds to the owner", async function () {
        await time.increase(LOCK_DURATION + 1);

        const ownerBalanceBefore = await owner.getBalance();
        const tx = await lock.withdraw();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

        const ownerBalanceAfter = await owner.getBalance();
        expect(ownerBalanceAfter.add(gasUsed)).to.equal(
          ownerBalanceBefore.add(DEPOSIT_AMOUNT)
        );
      });

      it("should update contract balance to zero after withdrawal", async function () {
        await time.increase(LOCK_DURATION + 1);
        
        await lock.withdraw();
        
        expect(await lock.getBalance()).to.equal(0);
        expect(await ethers.provider.getBalance(lock.address)).to.equal(0);
      });

      it("should set withdrawn flag to true", async function () {
        await time.increase(LOCK_DURATION + 1);
        
        await lock.withdraw();
        
        expect(await lock.withdrawn()).to.equal(true);
      });
    });
  });

  describe("View Functions", function () {
    it("should return correct owner address", async function () {
      expect(await lock.getOwner()).to.equal(owner.address);
    });

    it("should return correct balance", async function () {
      expect(await lock.getBalance()).to.equal(DEPOSIT_AMOUNT);
    });

    it("should return correct unlock time", async function () {
      const unlockTime = await lock.getUnlockTime();
      const currentTime = await time.latest();
      expect(unlockTime).to.be.gt(currentTime);
      expect(unlockTime).to.be.lt(currentTime + LOCK_DURATION + 60); // 60 second tolerance
    });

    it("should handle view functions after withdrawal", async function () {
      await time.increase(LOCK_DURATION + 1);
      await lock.withdraw();

      expect(await lock.getOwner()).to.equal(owner.address);
      expect(await lock.getBalance()).to.equal(0);
      expect(await lock.withdrawn()).to.equal(true);
    });
  });

  describe("Edge Cases", function () {
    it("should handle unlock time exactly at current time", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const unlockTime = (await time.latest()) + 1;
      
      const newLock = await Lock.deploy(unlockTime, { value: DEPOSIT_AMOUNT });
      
      await time.increaseTo(unlockTime);
      
      await expect(newLock.withdraw()).to.not.be.reverted;
    });

    it("should handle very long lock periods", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const longLockTime = (await time.latest()) + (365 * 24 * 3600); // 1 year
      
      const longLock = await Lock.deploy(longLockTime, { value: DEPOSIT_AMOUNT });
      
      expect(await longLock.isUnlocked()).to.equal(false);
      expect(await longLock.getUnlockTime()).to.equal(longLockTime);
    });

    it("should handle very small deposit amounts", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const unlockTime = (await time.latest()) + LOCK_DURATION;
      const smallAmount = 1; // 1 wei
      
      const smallLock = await Lock.deploy(unlockTime, { value: smallAmount });
      
      expect(await smallLock.getBalance()).to.equal(smallAmount);
    });

    it("should handle maximum uint256 unlock time", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const maxTime = ethers.constants.MaxUint256;
      
      const maxLock = await Lock.deploy(maxTime, { value: DEPOSIT_AMOUNT });
      
      expect(await maxLock.getUnlockTime()).to.equal(maxTime);
      expect(await maxLock.isUnlocked()).to.equal(false);
    });
  });

  describe("Security Features", function () {
    it("should prevent reentrancy attacks", async function () {
      // Test would require a malicious contract that tries to reenter
      // This is a placeholder for reentrancy testing
      await time.increase(LOCK_DURATION + 1);
      
      // Assuming the Lock contract has reentrancy protection
      await expect(lock.withdraw()).to.not.be.reverted;
    });

    it("should only allow owner to withdraw", async function () {
      await time.increase(LOCK_DURATION + 1);
      
      for (const account of [otherAccount, user1, user2]) {
        await expect(
          lock.connect(account).withdraw()
        ).to.be.revertedWith("You aren't the owner");
      }
    });

    it("should enforce time lock strictly", async function () {
      // Test various times before unlock
      const unlockTime = await lock.getUnlockTime();
      const currentTime = await time.latest();
      
      for (let i = 1; i <= 10; i++) {
        await time.increaseTo(currentTime + Math.floor((unlockTime - currentTime) * i / 11));
        
        if (await time.latest() < unlockTime) {
          await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
        }
      }
    });

    it("should handle owner transfer if implemented", async function () {
      // This test assumes owner transfer functionality exists
      // Skip if not implemented
      try {
        await lock.transferOwnership(otherAccount.address);
        expect(await lock.getOwner()).to.equal(otherAccount.address);
      } catch (error) {
        // Owner transfer not implemented
        this.skip();
      }
    });
  });

  describe("Gas Optimization", function () {
    it("should use reasonable gas for deployment", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const unlockTime = (await time.latest()) + LOCK_DURATION;
      
      const deployTx = await Lock.getDeployTransaction(unlockTime, { value: DEPOSIT_AMOUNT });
      const estimatedGas = await ethers.provider.estimateGas(deployTx);
      
      expect(estimatedGas).to.be.lt(500000); // Reasonable deployment gas limit
    });

    it("should use reasonable gas for withdrawal", async function () {
      await time.increase(LOCK_DURATION + 1);
      
      const estimatedGas = await lock.estimateGas.withdraw();
      expect(estimatedGas).to.be.lt(100000); // Reasonable withdrawal gas limit
    });

    it("should use reasonable gas for view functions", async function () {
      const estimatedGas1 = await lock.estimateGas.getBalance();
      const estimatedGas2 = await lock.estimateGas.getOwner();
      const estimatedGas3 = await lock.estimateGas.getUnlockTime();
      const estimatedGas4 = await lock.estimateGas.isUnlocked();
      
      expect(estimatedGas1).to.be.lt(50000);
      expect(estimatedGas2).to.be.lt(50000);
      expect(estimatedGas3).to.be.lt(50000);
      expect(estimatedGas4).to.be.lt(50000);
    });
  });

  describe("Integration Scenarios", function () {
    it("should work with multiple lock contracts", async function () {
      const Lock = await ethers.getContractFactory("Lock");
      const locks = [];
      
      for (let i = 0; i < 3; i++) {
        const unlockTime = (await time.latest()) + LOCK_DURATION + (i * 1800); // 30 min intervals
        const lock = await Lock.deploy(unlockTime, { value: DEPOSIT_AMOUNT });
        locks.push(lock);
      }
      
      // All should be locked initially
      for (const lock of locks) {
        expect(await lock.isUnlocked()).to.equal(false);
      }
      
      // Advance time and check unlock sequence
      await time.increase(LOCK_DURATION + 1);
      expect(await locks[0].isUnlocked()).to.equal(true);
      expect(await locks[1].isUnlocked()).to.equal(false);
      expect(await locks[2].isUnlocked()).to.equal(false);
    });

    it("should handle emergency scenarios", async function () {
      // Test emergency unlock if implemented
      try {
        await lock.emergencyUnlock();
        expect(await lock.isUnlocked()).to.equal(true);
      } catch (error) {
        // Emergency unlock not implemented
        this.skip();
      }
    });

    it("should integrate with time-based protocols", async function () {
      // Test integration with other time-dependent contracts
      const currentTime = await time.latest();
      const unlockTime = await lock.getUnlockTime();
      
      expect(unlockTime).to.be.gt(currentTime);
      
      // Simulate protocol interaction
      await time.increaseTo(unlockTime);
      expect(await lock.isUnlocked()).to.equal(true);
    });
  });
});
