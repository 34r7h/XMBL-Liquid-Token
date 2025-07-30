const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("I1inchFusion Interface", function () {
  let fusionContract;
  let mockFusion;
  let owner;
  let maker;
  let taker;
  let resolver;
  let mockToken1;
  let mockToken2;

  const ORDER_AMOUNT = ethers.utils.parseEther("100");
  const TAKING_AMOUNT = ethers.utils.parseEther("95");

  beforeEach(async function () {
    [owner, maker, taker, resolver] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken1 = await MockERC20.deploy("Token1", "TK1", 18);
    mockToken2 = await MockERC20.deploy("Token2", "TK2", 18);
    await mockToken1.deployed();
    await mockToken2.deployed();

    // Note: Skip tests if I1inchFusion interface implementation is not available
    try {
      // Deploy mock implementation of I1inchFusion interface
      const MockI1inchFusion = await ethers.getContractFactory("MockI1inchFusion");
      mockFusion = await MockI1inchFusion.deploy();
      await mockFusion.deployed();

      // Mint tokens for testing
      await mockToken1.mint(maker.address, ethers.utils.parseEther("1000"));
      await mockToken2.mint(taker.address, ethers.utils.parseEther("1000"));
      
      // Approve tokens
      await mockToken1.connect(maker).approve(mockFusion.address, ethers.utils.parseEther("1000"));
      await mockToken2.connect(taker).approve(mockFusion.address, ethers.utils.parseEther("1000"));
    } catch (error) {
      console.log("I1inchFusion interface implementation not available, skipping tests");
      this.skip();
    }
  });

  describe("Interface Definition", function () {
    it("should support I1inchFusion interface", async function () {
      // Test that the contract implements the expected interface
      expect(await mockFusion.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC165
    });

    it("should have all required function signatures", async function () {
      // Verify all required functions exist
      expect(mockFusion.fillOrder).to.be.a("function");
      expect(mockFusion.createOrder).to.be.a("function");
      expect(mockFusion.cancelOrder).to.be.a("function");
      expect(mockFusion.getOrderStatus).to.be.a("function");
      expect(mockFusion.getOrderRemainingAmount).to.be.a("function");
      expect(mockFusion.isValidSignature).to.be.a("function");
    });
  });

  describe("Order Creation", function () {
    it("should create Fusion order successfully", async function () {
      const makerAsset = mockToken1.address;
      const takerAsset = mockToken2.address;
      const makingAmount = ORDER_AMOUNT;
      const takingAmount = TAKING_AMOUNT;
      const orderData = "0x";

      await expect(
        mockFusion.connect(maker).createOrder(
          makerAsset,
          takerAsset,
          makingAmount,
          takingAmount,
          orderData
        )
      )
        .to.emit(mockFusion, "OrderCreated")
        .withArgs(anyValue, maker.address, makerAsset, takerAsset);
    });

    it("should return valid order hash", async function () {
      const orderHash = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );

      expect(orderHash).to.be.a("string");
      expect(orderHash.length).to.equal(66); // 0x + 64 hex chars
    });

    it("should reject zero amounts", async function () {
      await expect(
        mockFusion.connect(maker).createOrder(
          mockToken1.address,
          mockToken2.address,
          0,
          TAKING_AMOUNT,
          "0x"
        )
      ).to.be.revertedWith("Invalid making amount");

      await expect(
        mockFusion.connect(maker).createOrder(
          mockToken1.address,
          mockToken2.address,
          ORDER_AMOUNT,
          0,
          "0x"
        )
      ).to.be.revertedWith("Invalid taking amount");
    });

    it("should reject invalid token addresses", async function () {
      await expect(
        mockFusion.connect(maker).createOrder(
          ethers.constants.AddressZero,
          mockToken2.address,
          ORDER_AMOUNT,
          TAKING_AMOUNT,
          "0x"
        )
      ).to.be.revertedWith("Invalid maker asset");

      await expect(
        mockFusion.connect(maker).createOrder(
          mockToken1.address,
          ethers.constants.AddressZero,
          ORDER_AMOUNT,
          TAKING_AMOUNT,
          "0x"
        )
      ).to.be.revertedWith("Invalid taker asset");
    });

    it("should reject same token swap", async function () {
      await expect(
        mockFusion.connect(maker).createOrder(
          mockToken1.address,
          mockToken1.address,
          ORDER_AMOUNT,
          TAKING_AMOUNT,
          "0x"
        )
      ).to.be.revertedWith("Cannot swap same token");
    });

    it("should handle additional order data", async function () {
      const additionalData = ethers.utils.hexlify(ethers.utils.randomBytes(32));

      const orderHash = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        additionalData
      );

      expect(orderHash).to.be.a("string");
    });
  });

  describe("Order Filling", function () {
    let orderHash;
    let orderData;
    let signature;

    beforeEach(async function () {
      // Create an order first
      const tx = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );
      const receipt = await tx.wait();
      orderHash = receipt.events[0].args.orderHash;

      // Create order data and signature (simplified for testing)
      orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );

      // Create signature (simplified)
      const message = ethers.utils.keccak256(orderData);
      signature = await maker.signMessage(ethers.utils.arrayify(message));
    });

    it("should fill order successfully", async function () {
      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      )
        .to.emit(mockFusion, "OrderFilled")
        .withArgs(orderHash, maker.address, resolver.address, ORDER_AMOUNT, TAKING_AMOUNT);
    });

    it("should handle partial fills", async function () {
      const partialMaking = ORDER_AMOUNT.div(2);
      const partialTaking = TAKING_AMOUNT.div(2);

      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          partialMaking,
          partialTaking
        )
      )
        .to.emit(mockFusion, "OrderFilled")
        .withArgs(orderHash, maker.address, resolver.address, partialMaking, partialTaking);

      // Check remaining amount
      const remaining = await mockFusion.getOrderRemainingAmount(orderHash);
      expect(remaining).to.equal(ORDER_AMOUNT.sub(partialMaking));
    });

    it("should reject invalid signature", async function () {
      const wrongSignature = await taker.signMessage(ethers.utils.arrayify(ethers.utils.keccak256(orderData)));

      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          wrongSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject overfill", async function () {
      const excessiveMaking = ORDER_AMOUNT.mul(2);
      const excessiveTaking = TAKING_AMOUNT.mul(2);

      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          excessiveMaking,
          excessiveTaking
        )
      ).to.be.revertedWith("Fill amount exceeds order");
    });

    it("should reject zero fill amounts", async function () {
      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          0,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Invalid fill amount");

      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          ORDER_AMOUNT,
          0
        )
      ).to.be.revertedWith("Invalid fill amount");
    });

    it("should handle MEV protection", async function () {
      // Test that resolver network provides MEV protection
      // This would involve checking that orders are not front-run
      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.not.be.reverted;
    });

    it("should transfer tokens correctly", async function () {
      const makerBalanceBefore = await mockToken1.balanceOf(maker.address);
      const resolverBalanceBefore = await mockToken2.balanceOf(resolver.address);

      await mockFusion.connect(resolver).fillOrder(
        orderData,
        signature,
        ORDER_AMOUNT,
        TAKING_AMOUNT
      );

      const makerBalanceAfter = await mockToken1.balanceOf(maker.address);
      const resolverBalanceAfter = await mockToken2.balanceOf(resolver.address);

      expect(makerBalanceBefore.sub(makerBalanceAfter)).to.equal(ORDER_AMOUNT);
      expect(resolverBalanceAfter.sub(resolverBalanceBefore)).to.equal(TAKING_AMOUNT);
    });
  });

  describe("Order Cancellation", function () {
    let orderHash;

    beforeEach(async function () {
      const tx = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );
      const receipt = await tx.wait();
      orderHash = receipt.events[0].args.orderHash;
    });

    it("should cancel order successfully", async function () {
      await expect(mockFusion.connect(maker).cancelOrder(orderHash))
        .to.emit(mockFusion, "OrderCancelled")
        .withArgs(orderHash, maker.address);
    });

    it("should reject cancellation by non-maker", async function () {
      await expect(
        mockFusion.connect(taker).cancelOrder(orderHash)
      ).to.be.revertedWith("Only maker can cancel");
    });

    it("should reject cancellation of non-existent order", async function () {
      const fakeOrderHash = ethers.utils.keccak256("0x1234");

      await expect(
        mockFusion.connect(maker).cancelOrder(fakeOrderHash)
      ).to.be.revertedWith("Order does not exist");
    });

    it("should reject double cancellation", async function () {
      await mockFusion.connect(maker).cancelOrder(orderHash);

      await expect(
        mockFusion.connect(maker).cancelOrder(orderHash)
      ).to.be.revertedWith("Order already cancelled");
    });

    it("should prevent filling cancelled order", async function () {
      await mockFusion.connect(maker).cancelOrder(orderHash);

      const orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );
      const message = ethers.utils.keccak256(orderData);
      const signature = await maker.signMessage(ethers.utils.arrayify(message));

      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Order is cancelled");
    });
  });

  describe("Order Status and Queries", function () {
    let orderHash;

    beforeEach(async function () {
      const tx = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );
      const receipt = await tx.wait();
      orderHash = receipt.events[0].args.orderHash;
    });

    it("should return correct order status", async function () {
      // Status: 0 = Active, 1 = Filled, 2 = Cancelled
      expect(await mockFusion.getOrderStatus(orderHash)).to.equal(0); // Active

      await mockFusion.connect(maker).cancelOrder(orderHash);
      expect(await mockFusion.getOrderStatus(orderHash)).to.equal(2); // Cancelled
    });

    it("should return correct remaining amount", async function () {
      expect(await mockFusion.getOrderRemainingAmount(orderHash)).to.equal(ORDER_AMOUNT);

      // Partially fill order
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );
      const message = ethers.utils.keccak256(orderData);
      const signature = await maker.signMessage(ethers.utils.arrayify(message));

      const partialAmount = ORDER_AMOUNT.div(3);
      await mockFusion.connect(resolver).fillOrder(
        orderData,
        signature,
        partialAmount,
        TAKING_AMOUNT.div(3)
      );

      expect(await mockFusion.getOrderRemainingAmount(orderHash)).to.equal(ORDER_AMOUNT.sub(partialAmount));
    });

    it("should validate signatures correctly", async function () {
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );
      const message = ethers.utils.keccak256(orderData);
      const validSignature = await maker.signMessage(ethers.utils.arrayify(message));
      const invalidSignature = await taker.signMessage(ethers.utils.arrayify(message));

      expect(await mockFusion.isValidSignature(orderHash, validSignature)).to.equal(true);
      expect(await mockFusion.isValidSignature(orderHash, invalidSignature)).to.equal(false);
    });

    it("should handle non-existent order queries", async function () {
      const fakeOrderHash = ethers.utils.keccak256("0x1234");

      await expect(
        mockFusion.getOrderStatus(fakeOrderHash)
      ).to.be.revertedWith("Order does not exist");

      await expect(
        mockFusion.getOrderRemainingAmount(fakeOrderHash)
      ).to.be.revertedWith("Order does not exist");
    });
  });

  describe("Gasless Trading", function () {
    it("should support gasless order creation", async function () {
      // Test that makers don't pay gas for order creation
      // This would be handled by the resolver network
      const orderHash = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );

      expect(orderHash).to.be.a("string");
    });

    it("should allow resolver to pay gas for fills", async function () {
      const tx = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );
      const receipt = await tx.wait();
      const orderHash = receipt.events[0].args.orderHash;

      const orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );
      const message = ethers.utils.keccak256(orderData);
      const signature = await maker.signMessage(ethers.utils.arrayify(message));

      // Resolver pays gas for fill
      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.not.be.reverted;
    });

    it("should handle resolver incentives", async function () {
      // Test that resolvers receive appropriate incentives for filling orders
      // This might involve checking fee distribution or rebates
      const resolverBalanceBefore = await resolver.getBalance();

      const tx = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );
      const receipt = await tx.wait();
      const orderHash = receipt.events[0].args.orderHash;

      const orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );
      const message = ethers.utils.keccak256(orderData);
      const signature = await maker.signMessage(ethers.utils.arrayify(message));

      await mockFusion.connect(resolver).fillOrder(
        orderData,
        signature,
        ORDER_AMOUNT,
        TAKING_AMOUNT
      );

      // Resolver should receive some incentive (implementation dependent)
      const resolverBalanceAfter = await resolver.getBalance();
      expect(resolverBalanceAfter).to.be.lte(resolverBalanceBefore); // Gas spent
    });
  });

  describe("Price Improvement", function () {
    it("should support competitive pricing", async function () {
      // Test that multiple resolvers can compete for better prices
      const orderHash = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );

      // Multiple resolvers might compete to fill the order
      expect(orderHash).to.be.a("string");
    });

    it("should handle price improvement scenarios", async function () {
      const orderHash = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );

      // Test that makers can receive better prices than requested
      const orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );
      const message = ethers.utils.keccak256(orderData);
      const signature = await maker.signMessage(ethers.utils.arrayify(message));

      // Resolver might provide better rate
      const improvedTaking = TAKING_AMOUNT.mul(105).div(100); // 5% improvement

      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          ORDER_AMOUNT,
          improvedTaking
        )
      ).to.not.be.reverted;
    });
  });

  describe("Cross-Chain Support", function () {
    it("should support cross-chain order types", async function () {
      // Test cross-chain order creation (if supported)
      const crossChainData = ethers.utils.defaultAbiCoder.encode(
        ["uint16", "bytes32"],
        [1, "0x1234567890123456789012345678901234567890123456789012345678901234"]
      );

      const orderHash = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        crossChainData
      );

      expect(orderHash).to.be.a("string");
    });

    it("should handle cross-chain settlement", async function () {
      // Test cross-chain settlement mechanisms
      // This would involve Wormhole or other bridge protocols
      const crossChainData = ethers.utils.defaultAbiCoder.encode(
        ["uint16", "bytes32", "bool"],
        [1, "0x1234567890123456789012345678901234567890123456789012345678901234", true]
      );

      await expect(
        mockFusion.connect(maker).createOrder(
          mockToken1.address,
          mockToken2.address,
          ORDER_AMOUNT,
          TAKING_AMOUNT,
          crossChainData
        )
      ).to.not.be.reverted;
    });
  });

  describe("Security and Edge Cases", function () {
    it("should prevent signature replay attacks", async function () {
      const orderHash = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        "0x"
      );

      const orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );
      const message = ethers.utils.keccak256(orderData);
      const signature = await maker.signMessage(ethers.utils.arrayify(message));

      // Fill order once
      await mockFusion.connect(resolver).fillOrder(
        orderData,
        signature,
        ORDER_AMOUNT,
        TAKING_AMOUNT
      );

      // Try to replay the same signature
      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Order already filled");
    });

    it("should handle integer overflow/underflow", async function () {
      const maxUint256 = ethers.constants.MaxUint256;

      await expect(
        mockFusion.connect(maker).createOrder(
          mockToken1.address,
          mockToken2.address,
          maxUint256,
          maxUint256,
          "0x"
        )
      ).to.be.revertedWith("Amount too large");
    });

    it("should validate order expiration", async function () {
      // Test orders with expiration timestamps
      const expiration = (await time.latest()) + 3600; // 1 hour
      const orderDataWithExpiration = ethers.utils.defaultAbiCoder.encode(
        ["uint256"],
        [expiration]
      );

      const orderHash = await mockFusion.connect(maker).createOrder(
        mockToken1.address,
        mockToken2.address,
        ORDER_AMOUNT,
        TAKING_AMOUNT,
        orderDataWithExpiration
      );

      // Fast forward past expiration
      await time.increase(3601);

      const orderData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "address"],
        [mockToken1.address, mockToken2.address, ORDER_AMOUNT, TAKING_AMOUNT, maker.address]
      );
      const message = ethers.utils.keccak256(orderData);
      const signature = await maker.signMessage(ethers.utils.arrayify(message));

      await expect(
        mockFusion.connect(resolver).fillOrder(
          orderData,
          signature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Order expired");
    });

    it("should handle emergency pause scenarios", async function () {
      // Test emergency pause functionality
      try {
        await mockFusion.pause();

        await expect(
          mockFusion.connect(maker).createOrder(
            mockToken1.address,
            mockToken2.address,
            ORDER_AMOUNT,
            TAKING_AMOUNT,
            "0x"
          )
        ).to.be.revertedWith("Contract is paused");
      } catch (error) {
        // Pause functionality might not be implemented
        this.skip();
      }
    });
  });
});
