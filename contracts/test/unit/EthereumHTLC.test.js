const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EthereumHTLC", function () {
  let htlc;
  let owner;
  let initiator;
  let recipient;
  let user1;
  let user2;
  let mockToken;

  const SECRET = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const HASHLOCK = ethers.utils.keccak256(SECRET);
  const TIMELOCK_DURATION = 3600; // 1 hour
  const SWAP_AMOUNT = ethers.utils.parseEther("1.0");

  beforeEach(async function () {
    [owner, initiator, recipient, user1, user2] = await ethers.getSigners();

    // Deploy mock ERC-20 token for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Test Token", "TEST", 18);
    await mockToken.deployed();

    // Deploy EthereumHTLC contract
    const EthereumHTLC = await ethers.getContractFactory("EthereumHTLC");
    htlc = await EthereumHTLC.deploy();
    await htlc.deployed();

    // Mint tokens for testing
    await mockToken.mint(initiator.address, ethers.utils.parseEther("10"));
    await mockToken.connect(initiator).approve(htlc.address, ethers.utils.parseEther("10"));
  });

  describe("Contract Deployment", function () {
    it("should deploy with correct initial values", async function () {
      expect(await htlc.minimumTimelock()).to.equal(3600); // 1 hour
      expect(await htlc.maximumTimelock()).to.equal(2592000); // 30 days
      expect(await htlc.totalLockedValue()).to.equal(0);
      expect(await htlc.completedSwaps()).to.equal(0);
      expect(await htlc.refundedSwaps()).to.equal(0);
      expect(await htlc.contractPaused()).to.equal(false);
    });

    it("should set owner correctly", async function () {
      expect(await htlc.owner()).to.equal(owner.address);
    });

    it("should have correct contract interface", async function () {
      expect(await htlc.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC165
    });
  });

  describe("Funds Locking", function () {
    it("should lock ETH funds successfully", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock,
          recipient.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      )
        .to.emit(htlc, "FundsLocked")
        .withArgs(HASHLOCK, initiator.address, recipient.address, SWAP_AMOUNT, timelock);

      const swap = await htlc.swaps(HASHLOCK);
      expect(swap.initiator).to.equal(initiator.address);
      expect(swap.recipient).to.equal(recipient.address);
      expect(swap.amount).to.equal(SWAP_AMOUNT);
      expect(swap.token).to.equal(ethers.constants.AddressZero); // ETH
      expect(swap.timelock).to.equal(timelock);
      expect(swap.claimed).to.equal(false);
      expect(swap.refunded).to.equal(false);
    });

    it("should lock ERC-20 tokens successfully", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await expect(
        htlc.connect(initiator).lockERC20Funds(
          HASHLOCK,
          timelock,
          recipient.address,
          SWAP_AMOUNT,
          mockToken.address
        )
      )
        .to.emit(htlc, "FundsLocked")
        .withArgs(HASHLOCK, initiator.address, recipient.address, SWAP_AMOUNT, timelock);

      const swap = await htlc.swaps(HASHLOCK);
      expect(swap.token).to.equal(mockToken.address);
      expect(await mockToken.balanceOf(htlc.address)).to.equal(SWAP_AMOUNT);
    });

    it("should reject invalid timelock durations", async function () {
      const shortTimelock = (await time.latest()) + 1800; // 30 minutes (too short)
      const longTimelock = (await time.latest()) + 3000000; // Too long

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          shortTimelock,
          recipient.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      ).to.be.revertedWith("Timelock duration invalid");

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          longTimelock,
          recipient.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      ).to.be.revertedWith("Timelock duration invalid");
    });

    it("should reject duplicate hashlocks", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock + 1000,
          recipient.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      ).to.be.revertedWith("Hashlock already exists");
    });

    it("should reject zero amount", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock,
          recipient.address,
          0,
          { value: 0 }
        )
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("should update user active swaps counter", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      expect(await htlc.userActiveSwaps(initiator.address)).to.equal(0);

      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      expect(await htlc.userActiveSwaps(initiator.address)).to.equal(1);
    });

    it("should update total locked value", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      expect(await htlc.totalLockedValue()).to.equal(0);

      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      expect(await htlc.totalLockedValue()).to.equal(SWAP_AMOUNT);
    });
  });

  describe("Funds Claiming", function () {
    beforeEach(async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );
    });

    it("should allow recipient to claim with correct secret", async function () {
      const initialBalance = await recipient.getBalance();

      await expect(htlc.connect(recipient).claimFunds(SECRET))
        .to.emit(htlc, "FundsClaimed")
        .withArgs(HASHLOCK, recipient.address, SECRET);

      const finalBalance = await recipient.getBalance();
      expect(finalBalance.sub(initialBalance)).to.be.closeTo(SWAP_AMOUNT, ethers.utils.parseEther("0.01"));

      const swap = await htlc.swaps(HASHLOCK);
      expect(swap.claimed).to.equal(true);
      expect(swap.secret).to.equal(SECRET);
    });

    it("should allow initiator to claim with correct secret", async function () {
      const initialBalance = await initiator.getBalance();

      await expect(htlc.connect(initiator).claimFunds(SECRET))
        .to.emit(htlc, "FundsClaimed")
        .withArgs(HASHLOCK, initiator.address, SECRET);

      // Initiator can claim their own locked funds
      expect(await htlc.completedSwaps()).to.equal(1);
    });

    it("should reject invalid secret", async function () {
      const wrongSecret = "0xwrongsecret1234567890abcdef1234567890abcdef1234567890abcdef123456";

      await expect(
        htlc.connect(recipient).claimFunds(wrongSecret)
      ).to.be.revertedWith("Invalid secret");
    });

    it("should reject claim after timelock expiry", async function () {
      await time.increase(TIMELOCK_DURATION + 1);

      await expect(
        htlc.connect(recipient).claimFunds(SECRET)
      ).to.be.revertedWith("Timelock expired");
    });

    it("should reject double claiming", async function () {
      await htlc.connect(recipient).claimFunds(SECRET);

      await expect(
        htlc.connect(recipient).claimFunds(SECRET)
      ).to.be.revertedWith("Already claimed or refunded");
    });

    it("should update counters after claim", async function () {
      await htlc.connect(recipient).claimFunds(SECRET);

      expect(await htlc.completedSwaps()).to.equal(1);
      expect(await htlc.userActiveSwaps(initiator.address)).to.equal(0);
      expect(await htlc.totalLockedValue()).to.equal(0);
    });

    it("should handle ERC-20 token claims", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      const hashlock2 = ethers.utils.keccak256("0xsecret2");

      await htlc.connect(initiator).lockERC20Funds(
        hashlock2,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        mockToken.address
      );

      const initialBalance = await mockToken.balanceOf(recipient.address);

      await htlc.connect(recipient).claimFunds("0xsecret2");

      const finalBalance = await mockToken.balanceOf(recipient.address);
      expect(finalBalance.sub(initialBalance)).to.equal(SWAP_AMOUNT);
    });
  });

  describe("Funds Refunding", function () {
    beforeEach(async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );
    });

    it("should allow refund after timelock expiry", async function () {
      await time.increase(TIMELOCK_DURATION + 1);

      const initialBalance = await initiator.getBalance();

      await expect(htlc.connect(initiator).refundFunds(HASHLOCK))
        .to.emit(htlc, "FundsRefunded")
        .withArgs(HASHLOCK, initiator.address, SWAP_AMOUNT);

      const swap = await htlc.swaps(HASHLOCK);
      expect(swap.refunded).to.equal(true);
    });

    it("should reject refund before timelock expiry", async function () {
      await expect(
        htlc.connect(initiator).refundFunds(HASHLOCK)
      ).to.be.revertedWith("Timelock not expired");
    });

    it("should reject refund by non-initiator", async function () {
      await time.increase(TIMELOCK_DURATION + 1);

      await expect(
        htlc.connect(user1).refundFunds(HASHLOCK)
      ).to.be.revertedWith("Only initiator can refund");
    });

    it("should reject refund if already claimed", async function () {
      await htlc.connect(recipient).claimFunds(SECRET);
      await time.increase(TIMELOCK_DURATION + 1);

      await expect(
        htlc.connect(initiator).refundFunds(HASHLOCK)
      ).to.be.revertedWith("Already claimed or refunded");
    });

    it("should update counters after refund", async function () {
      await time.increase(TIMELOCK_DURATION + 1);
      await htlc.connect(initiator).refundFunds(HASHLOCK);

      expect(await htlc.refundedSwaps()).to.equal(1);
      expect(await htlc.userActiveSwaps(initiator.address)).to.equal(0);
      expect(await htlc.totalLockedValue()).to.equal(0);
    });
  });

  describe("Swap Management", function () {
    it("should get swap details correctly", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      const swap = await htlc.getSwapDetails(HASHLOCK);
      expect(swap.initiator).to.equal(initiator.address);
      expect(swap.recipient).to.equal(recipient.address);
      expect(swap.amount).to.equal(SWAP_AMOUNT);
      expect(swap.timelock).to.equal(timelock);
    });

    it("should check swap active status correctly", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      
      expect(await htlc.isSwapActive(HASHLOCK)).to.equal(false);

      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      expect(await htlc.isSwapActive(HASHLOCK)).to.equal(true);

      await htlc.connect(recipient).claimFunds(SECRET);
      expect(await htlc.isSwapActive(HASHLOCK)).to.equal(false);
    });

    it("should calculate hashlock correctly", async function () {
      const calculatedHashlock = await htlc.calculateHashlock(SECRET);
      expect(calculatedHashlock).to.equal(HASHLOCK);
    });

    it("should extend timelock when authorized", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      const extension = 1800; // 30 minutes
      const newTimelock = timelock + extension;

      await expect(
        htlc.connect(initiator).extendTimelock(HASHLOCK, extension)
      )
        .to.emit(htlc, "TimelockExtended")
        .withArgs(HASHLOCK, newTimelock);

      const swap = await htlc.swaps(HASHLOCK);
      expect(swap.timelock).to.equal(newTimelock);
    });

    it("should reject timelock extension by unauthorized user", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      await expect(
        htlc.connect(user1).extendTimelock(HASHLOCK, 1800)
      ).to.be.revertedWith("Not authorized to extend");
    });

    it("should cancel swap by initiator before claim", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      await expect(htlc.connect(initiator).cancelSwap(HASHLOCK))
        .to.emit(htlc, "SwapCancelled")
        .withArgs(HASHLOCK, initiator.address);

      const swap = await htlc.swaps(HASHLOCK);
      expect(swap.refunded).to.equal(true);
    });

    it("should reject cancellation after claim", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      await htlc.connect(recipient).claimFunds(SECRET);

      await expect(
        htlc.connect(initiator).cancelSwap(HASHLOCK)
      ).to.be.revertedWith("Cannot cancel claimed swap");
    });
  });

  describe("Batch Operations", function () {
    it("should handle multiple swaps per user", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      const hashlock2 = ethers.utils.keccak256("0xsecret2");
      const hashlock3 = ethers.utils.keccak256("0xsecret3");

      await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      await htlc.connect(initiator).lockFunds(
        hashlock2,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      expect(await htlc.userActiveSwaps(initiator.address)).to.equal(2);
      expect(await htlc.totalLockedValue()).to.equal(SWAP_AMOUNT.mul(2));
    });

    it("should handle batch claims efficiently", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      const hashlocks = [];
      const secrets = [];

      for (let i = 0; i < 3; i++) {
        const secret = ethers.utils.keccak256(`0xsecret${i}`);
        const hashlock = ethers.utils.keccak256(secret);
        
        secrets.push(secret);
        hashlocks.push(hashlock);

        await htlc.connect(initiator).lockFunds(
          hashlock,
          timelock,
          recipient.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        );
      }

      for (let i = 0; i < 3; i++) {
        await htlc.connect(recipient).claimFunds(secrets[i]);
      }

      expect(await htlc.completedSwaps()).to.equal(3);
      expect(await htlc.userActiveSwaps(initiator.address)).to.equal(0);
    });
  });

  describe("Emergency Controls", function () {
    it("should pause contract when called by owner", async function () {
      await expect(htlc.connect(owner).pauseContract())
        .to.emit(htlc, "ContractPaused")
        .withArgs(true);

      expect(await htlc.contractPaused()).to.equal(true);
    });

    it("should reject operations when paused", async function () {
      await htlc.connect(owner).pauseContract();

      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock,
          recipient.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      ).to.be.revertedWith("Contract is paused");
    });

    it("should resume operations after unpause", async function () {
      await htlc.connect(owner).pauseContract();
      await htlc.connect(owner).unpauseContract();

      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock,
          recipient.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      ).to.not.be.reverted;
    });

    it("should reject pause by non-owner", async function () {
      await expect(
        htlc.connect(user1).pauseContract()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Security Features", function () {
    it("should prevent reentrancy attacks", async function () {
      // Test with malicious contract that tries to reenter
      const MaliciousContract = await ethers.getContractFactory("MaliciousReentrancy");
      const malicious = await MaliciousContract.deploy(htlc.address);
      await malicious.deployed();

      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await expect(
        malicious.attemptReentrancy(HASHLOCK, timelock, { value: SWAP_AMOUNT })
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });

    it("should validate hashlock format", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      const invalidHashlock = "0x1234"; // Too short

      await expect(
        htlc.connect(initiator).lockFunds(
          invalidHashlock,
          timelock,
          recipient.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      ).to.be.revertedWith("Invalid hashlock format");
    });

    it("should prevent griefing attacks with reasonable limits", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      // Try to create too many swaps
      for (let i = 0; i < 100; i++) {
        const hashlock = ethers.utils.keccak256(`0xhash${i}`);
        
        if (i < 50) {
          await htlc.connect(initiator).lockFunds(
            hashlock,
            timelock,
            recipient.address,
            ethers.utils.parseEther("0.01"),
            { value: ethers.utils.parseEther("0.01") }
          );
        } else {
          await expect(
            htlc.connect(initiator).lockFunds(
              hashlock,
              timelock,
              recipient.address,
              ethers.utils.parseEther("0.01"),
              { value: ethers.utils.parseEther("0.01") }
            )
          ).to.be.revertedWith("Too many active swaps");
          break;
        }
      }
    });
  });

  describe("Gas Optimization", function () {
    it("should optimize gas for common operations", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      const tx = await htlc.connect(initiator).lockFunds(
        HASHLOCK,
        timelock,
        recipient.address,
        SWAP_AMOUNT,
        { value: SWAP_AMOUNT }
      );

      const receipt = await tx.wait();
      expect(receipt.gasUsed).to.be.lt(150000); // Reasonable gas limit
    });

    it("should optimize gas for batch operations", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      const gasUsed = [];

      for (let i = 0; i < 5; i++) {
        const hashlock = ethers.utils.keccak256(`0xhash${i}`);
        const tx = await htlc.connect(initiator).lockFunds(
          hashlock,
          timelock,
          recipient.address,
          ethers.utils.parseEther("0.1"),
          { value: ethers.utils.parseEther("0.1") }
        );
        
        const receipt = await tx.wait();
        gasUsed.push(receipt.gasUsed);
      }

      // Gas usage should not increase significantly with more operations
      expect(gasUsed[4]).to.be.lt(gasUsed[0].mul(2));
    });
  });

  describe("Cross-Chain Compatibility", function () {
    it("should generate Bitcoin-compatible hashlocks", async function () {
      const secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const hashlock = await htlc.calculateHashlock(secret);

      // Should be 32 bytes (64 hex chars + 0x prefix)
      expect(hashlock.length).to.equal(66);
      expect(hashlock).to.match(/^0x[0-9a-fA-F]{64}$/);
    });

    it("should handle standard timelock periods", async function () {
      // Test various timelock periods used in cross-chain protocols
      const timelocks = [
        3600,   // 1 hour
        7200,   // 2 hours
        14400,  // 4 hours
        28800,  // 8 hours
        86400   // 24 hours
      ];

      for (const duration of timelocks) {
        const timelock = (await time.latest()) + duration;
        const hashlock = ethers.utils.keccak256(`0xtest${duration}`);

        await expect(
          htlc.connect(initiator).lockFunds(
            hashlock,
            timelock,
            recipient.address,
            ethers.utils.parseEther("0.1"),
            { value: ethers.utils.parseEther("0.1") }
          )
        ).to.not.be.reverted;
      }
    });
  });

  describe("Edge Cases", function () {
    it("should handle very small amounts", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      const smallAmount = 1; // 1 wei

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock,
          recipient.address,
          smallAmount,
          { value: smallAmount }
        )
      ).to.not.be.reverted;
    });

    it("should handle very large amounts", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;
      const largeAmount = ethers.utils.parseEther("1000");

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock,
          recipient.address,
          largeAmount,
          { value: largeAmount }
        )
      ).to.not.be.reverted;
    });

    it("should handle zero address recipient gracefully", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock,
          ethers.constants.AddressZero,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      ).to.be.revertedWith("Invalid recipient address");
    });

    it("should handle contract self-interaction", async function () {
      const timelock = (await time.latest()) + TIMELOCK_DURATION;

      await expect(
        htlc.connect(initiator).lockFunds(
          HASHLOCK,
          timelock,
          htlc.address,
          SWAP_AMOUNT,
          { value: SWAP_AMOUNT }
        )
      ).to.be.revertedWith("Cannot send to contract");
    });
  });
});
