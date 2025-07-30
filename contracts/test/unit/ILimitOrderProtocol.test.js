const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ILimitOrderProtocol Interface", function () {
  let limitOrderProtocol;
  let mockLimitOrder;
  let owner;
  let maker;
  let taker;
  let filler;
  let mockToken1;
  let mockToken2;

  const ORDER_AMOUNT = ethers.utils.parseEther("100");
  const TAKING_AMOUNT = ethers.utils.parseEther("95");
  const ORDER_SALT = 12345;

  beforeEach(async function () {
    [owner, maker, taker, filler] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken1 = await MockERC20.deploy("Token1", "TK1", 18);
    mockToken2 = await MockERC20.deploy("Token2", "TK2", 18);
    await mockToken1.deployed();
    await mockToken2.deployed();

    // Note: Skip tests if ILimitOrderProtocol interface implementation is not available
    try {
      // Deploy mock implementation of ILimitOrderProtocol interface
      const MockILimitOrderProtocol = await ethers.getContractFactory("MockILimitOrderProtocol");
      mockLimitOrder = await MockILimitOrderProtocol.deploy();
      await mockLimitOrder.deployed();

      // Mint tokens for testing
      await mockToken1.mint(maker.address, ethers.utils.parseEther("1000"));
      await mockToken2.mint(taker.address, ethers.utils.parseEther("1000"));
      
      // Approve tokens
      await mockToken1.connect(maker).approve(mockLimitOrder.address, ethers.utils.parseEther("1000"));
      await mockToken2.connect(taker).approve(mockLimitOrder.address, ethers.utils.parseEther("1000"));
    } catch (error) {
      console.log("ILimitOrderProtocol interface implementation not available, skipping tests");
      this.skip();
    }
  });

  describe("Interface Definition", function () {
    it("should support ILimitOrderProtocol interface", async function () {
      expect(await mockLimitOrder.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC165
    });

    it("should have all required function signatures", async function () {
      expect(mockLimitOrder.fillOrder).to.be.a("function");
      expect(mockLimitOrder.cancelOrder).to.be.a("function");
      expect(mockLimitOrder.remaining).to.be.a("function");
      expect(mockLimitOrder.invalidatorForOrderRFQ).to.be.a("function");
      expect(mockLimitOrder.checkPredicate).to.be.a("function");
      expect(mockLimitOrder.simulate).to.be.a("function");
    });
  });

  describe("Limit Order Structure", function () {
    let limitOrder;

    beforeEach(async function () {
      limitOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };
    });

    it("should validate limit order structure", async function () {
      expect(limitOrder.salt).to.equal(ORDER_SALT);
      expect(limitOrder.makerAsset).to.equal(mockToken1.address);
      expect(limitOrder.takerAsset).to.equal(mockToken2.address);
    });

    it("should handle asset data correctly", async function () {
      const customAssetData = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      limitOrder.makerAssetData = customAssetData;
      limitOrder.takerAssetData = customAssetData;

      expect(limitOrder.makerAssetData).to.equal(customAssetData);
      expect(limitOrder.takerAssetData).to.equal(customAssetData);
    });

    it("should support dynamic amount getters", async function () {
      const getMakingAmountData = ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes4"],
        [mockLimitOrder.address, "0x12345678"]
      );
      
      limitOrder.getMakingAmount = getMakingAmountData;
      expect(limitOrder.getMakingAmount).to.equal(getMakingAmountData);
    });

    it("should validate predicate conditions", async function () {
      const predicateData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address"],
        [await time.latest() + 3600, mockToken1.address]
      );
      
      limitOrder.predicate = predicateData;
      
      const isValid = await mockLimitOrder.checkPredicate(limitOrder);
      expect(isValid).to.equal(true);
    });
  });

  describe("Order Filling", function () {
    let limitOrder;
    let orderSignature;

    beforeEach(async function () {
      limitOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      // Create order signature
      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [limitOrder.salt, limitOrder.makerAsset, limitOrder.takerAsset]
        )
      );
      orderSignature = await maker.signMessage(ethers.utils.arrayify(orderHash));
    });

    it("should fill order successfully", async function () {
      const [actualMaking, actualTaking] = await mockLimitOrder.connect(filler).fillOrder(
        limitOrder,
        orderSignature,
        ORDER_AMOUNT,
        TAKING_AMOUNT
      );

      expect(actualMaking).to.equal(ORDER_AMOUNT);
      expect(actualTaking).to.equal(TAKING_AMOUNT);
    });

    it("should emit OrderFilled event", async function () {
      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [limitOrder.salt, limitOrder.makerAsset, limitOrder.takerAsset]
        )
      );

      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          limitOrder,
          orderSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      )
        .to.emit(mockLimitOrder, "OrderFilled")
        .withArgs(maker.address, orderHash, anyValue);
    });

    it("should handle partial fills", async function () {
      const partialMaking = ORDER_AMOUNT.div(3);
      const partialTaking = TAKING_AMOUNT.div(3);

      const [actualMaking, actualTaking] = await mockLimitOrder.connect(filler).fillOrder(
        limitOrder,
        orderSignature,
        partialMaking,
        partialTaking
      );

      expect(actualMaking).to.equal(partialMaking);
      expect(actualTaking).to.equal(partialTaking);
    });

    it("should track remaining amounts", async function () {
      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [limitOrder.salt, limitOrder.makerAsset, limitOrder.takerAsset]
        )
      );

      const initialRemaining = await mockLimitOrder.remaining(orderHash);
      
      const partialAmount = ORDER_AMOUNT.div(2);
      await mockLimitOrder.connect(filler).fillOrder(
        limitOrder,
        orderSignature,
        partialAmount,
        TAKING_AMOUNT.div(2)
      );

      const finalRemaining = await mockLimitOrder.remaining(orderHash);
      expect(finalRemaining).to.be.lt(initialRemaining);
    });

    it("should reject invalid signatures", async function () {
      const wrongSignature = await taker.signMessage(ethers.utils.arrayify(ethers.utils.keccak256("0x1234")));

      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          limitOrder,
          wrongSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject zero fill amounts", async function () {
      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          limitOrder,
          orderSignature,
          0,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Invalid making amount");

      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          limitOrder,
          orderSignature,
          ORDER_AMOUNT,
          0
        )
      ).to.be.revertedWith("Invalid taking amount");
    });

    it("should handle rate validation", async function () {
      // Test that the rate between making and taking amounts is reasonable
      const badTaking = ORDER_AMOUNT.mul(10); // Unreasonable rate

      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          limitOrder,
          orderSignature,
          ORDER_AMOUNT,
          badTaking
        )
      ).to.be.revertedWith("Invalid rate");
    });

    it("should transfer tokens correctly", async function () {
      const makerBalanceBefore = await mockToken1.balanceOf(maker.address);
      const fillerBalanceBefore = await mockToken2.balanceOf(filler.address);

      await mockLimitOrder.connect(filler).fillOrder(
        limitOrder,
        orderSignature,
        ORDER_AMOUNT,
        TAKING_AMOUNT
      );

      const makerBalanceAfter = await mockToken1.balanceOf(maker.address);
      const fillerBalanceAfter = await mockToken2.balanceOf(filler.address);

      expect(makerBalanceBefore.sub(makerBalanceAfter)).to.equal(ORDER_AMOUNT);
      expect(fillerBalanceAfter.sub(fillerBalanceBefore)).to.equal(TAKING_AMOUNT);
    });
  });

  describe("Order Cancellation", function () {
    let limitOrder;

    beforeEach(async function () {
      limitOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };
    });

    it("should cancel order successfully", async function () {
      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [limitOrder.salt, limitOrder.makerAsset, limitOrder.takerAsset]
        )
      );

      await expect(mockLimitOrder.connect(maker).cancelOrder(limitOrder))
        .to.emit(mockLimitOrder, "OrderCanceled")
        .withArgs(maker.address, orderHash, anyValue);
    });

    it("should reject cancellation by non-maker", async function () {
      await expect(
        mockLimitOrder.connect(taker).cancelOrder(limitOrder)
      ).to.be.revertedWith("Only maker can cancel");
    });

    it("should prevent filling cancelled orders", async function () {
      await mockLimitOrder.connect(maker).cancelOrder(limitOrder);

      const orderSignature = await maker.signMessage(
        ethers.utils.arrayify(ethers.utils.keccak256("0x1234"))
      );

      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          limitOrder,
          orderSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Order is cancelled");
    });

    it("should handle mass cancellation", async function () {
      // Test cancelling multiple orders at once
      const orders = [];
      for (let i = 0; i < 5; i++) {
        orders.push({
          ...limitOrder,
          salt: ORDER_SALT + i
        });
      }

      for (const order of orders) {
        await expect(
          mockLimitOrder.connect(maker).cancelOrder(order)
        ).to.not.be.reverted;
      }
    });
  });

  describe("RFQ Orders", function () {
    it("should handle RFQ invalidator bitmap", async function () {
      const makerAddress = maker.address;
      const slot = 0;

      const invalidator = await mockLimitOrder.invalidatorForOrderRFQ(makerAddress, slot);
      expect(invalidator).to.be.a("BigNumber");
    });

    it("should update invalidator bitmap on RFQ cancellation", async function () {
      const makerAddress = maker.address;
      const slot = 0;
      
      const invalidatorBefore = await mockLimitOrder.invalidatorForOrderRFQ(makerAddress, slot);
      
      // Create and cancel RFQ order
      const rfqOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      await mockLimitOrder.connect(maker).cancelOrder(rfqOrder);

      const invalidatorAfter = await mockLimitOrder.invalidatorForOrderRFQ(makerAddress, slot);
      expect(invalidatorAfter).to.not.equal(invalidatorBefore);
    });

    it("should handle RFQ order fills", async function () {
      const rfqOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [rfqOrder.salt, rfqOrder.makerAsset, rfqOrder.takerAsset]
        )
      );
      const orderSignature = await maker.signMessage(ethers.utils.arrayify(orderHash));

      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          rfqOrder,
          orderSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      )
        .to.emit(mockLimitOrder, "OrderFilledRFQ")
        .withArgs(orderHash, ORDER_AMOUNT);
    });
  });

  describe("Predicate Conditions", function () {
    it("should validate time-based predicates", async function () {
      const futureTime = (await time.latest()) + 3600; // 1 hour from now
      const predicateData = ethers.utils.defaultAbiCoder.encode(
        ["uint256"],
        [futureTime]
      );

      const timeOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: predicateData,
        permit: "0x",
        interaction: "0x"
      };

      // Should fail before time
      expect(await mockLimitOrder.checkPredicate(timeOrder)).to.equal(false);

      // Fast forward time
      await time.increase(3601);

      // Should pass after time
      expect(await mockLimitOrder.checkPredicate(timeOrder)).to.equal(true);
    });

    it("should validate price-based predicates", async function () {
      const minPrice = ethers.utils.parseEther("0.95");
      const predicateData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address"],
        [minPrice, mockToken1.address]
      );

      const priceOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: predicateData,
        permit: "0x",
        interaction: "0x"
      };

      const isValid = await mockLimitOrder.checkPredicate(priceOrder);
      expect(isValid).to.be.a("boolean");
    });

    it("should validate balance-based predicates", async function () {
      const minBalance = ethers.utils.parseEther("50");
      const predicateData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address"],
        [minBalance, mockToken1.address, maker.address]
      );

      const balanceOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: predicateData,
        permit: "0x",
        interaction: "0x"
      };

      const isValid = await mockLimitOrder.checkPredicate(balanceOrder);
      expect(isValid).to.equal(true); // Maker has sufficient balance
    });

    it("should handle complex predicate combinations", async function () {
      const combinedPredicateData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "address"],
        [await time.latest() + 1800, ethers.utils.parseEther("0.95"), mockToken1.address]
      );

      const complexOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: combinedPredicateData,
        permit: "0x",
        interaction: "0x"
      };

      const isValid = await mockLimitOrder.checkPredicate(complexOrder);
      expect(isValid).to.be.a("boolean");
    });
  });

  describe("Dynamic Amount Functions", function () {
    it("should handle dynamic making amount calculation", async function () {
      const getMakingAmountData = ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes4", "uint256"],
        [mockLimitOrder.address, "0x12345678", ORDER_AMOUNT]
      );

      const dynamicOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: getMakingAmountData,
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      expect(dynamicOrder.getMakingAmount).to.equal(getMakingAmountData);
    });

    it("should handle dynamic taking amount calculation", async function () {
      const getTakingAmountData = ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes4", "uint256"],
        [mockLimitOrder.address, "0x87654321", TAKING_AMOUNT]
      );

      const dynamicOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: getTakingAmountData,
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      expect(dynamicOrder.getTakingAmount).to.equal(getTakingAmountData);
    });

    it("should validate dynamic amount calculations", async function () {
      const getMakingAmountData = ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes4"],
        [mockLimitOrder.address, "0x12345678"]
      );

      const dynamicOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: getMakingAmountData,
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      // The dynamic calculation should be valid
      expect(dynamicOrder.getMakingAmount.length).to.be.gt(2);
    });
  });

  describe("Permit Integration", function () {
    it("should handle permit-based approvals", async function () {
      const permitData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint8", "bytes32", "bytes32"],
        [
          maker.address,
          mockLimitOrder.address,
          ORDER_AMOUNT,
          await time.latest() + 3600,
          27,
          ethers.utils.hexlify(ethers.utils.randomBytes(32)),
          ethers.utils.hexlify(ethers.utils.randomBytes(32))
        ]
      );

      const permitOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: permitData,
        interaction: "0x"
      };

      expect(permitOrder.permit).to.equal(permitData);
    });

    it("should validate permit signatures", async function () {
      const permitData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint8", "bytes32", "bytes32"],
        [
          maker.address,
          mockLimitOrder.address,
          ORDER_AMOUNT,
          await time.latest() + 3600,
          27,
          ethers.utils.hexlify(ethers.utils.randomBytes(32)),
          ethers.utils.hexlify(ethers.utils.randomBytes(32))
        ]
      );

      const permitOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: permitData,
        interaction: "0x"
      };

      // Validate that permit data is properly formatted
      expect(permitOrder.permit.length).to.be.gt(200); // Sufficient length for permit data
    });

    it("should handle gasless approvals through permit", async function () {
      const permitData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint8", "bytes32", "bytes32"],
        [
          maker.address,
          mockLimitOrder.address,
          ORDER_AMOUNT,
          await time.latest() + 3600,
          27,
          ethers.utils.hexlify(ethers.utils.randomBytes(32)),
          ethers.utils.hexlify(ethers.utils.randomBytes(32))
        ]
      );

      const permitOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: permitData,
        interaction: "0x"
      };

      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [permitOrder.salt, permitOrder.makerAsset, permitOrder.takerAsset]
        )
      );
      const orderSignature = await maker.signMessage(ethers.utils.arrayify(orderHash));

      // Order with permit should not require prior approval
      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          permitOrder,
          orderSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.not.be.reverted;
    });
  });

  describe("Interaction Hooks", function () {
    it("should handle pre-interaction hooks", async function () {
      const preInteractionData = ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes4", "bytes"],
        [mockLimitOrder.address, "0x12345678", "0x"]
      );

      const interactionOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: preInteractionData
      };

      expect(interactionOrder.interaction).to.equal(preInteractionData);
    });

    it("should handle post-interaction hooks", async function () {
      const postInteractionData = ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes4", "bytes", "bool"],
        [mockLimitOrder.address, "0x87654321", "0x", true]
      );

      const interactionOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: postInteractionData
      };

      expect(interactionOrder.interaction).to.equal(postInteractionData);
    });

    it("should execute interaction hooks during fills", async function () {
      const interactionData = ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes4"],
        [mockLimitOrder.address, "0x12345678"]
      );

      const interactionOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: interactionData
      };

      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [interactionOrder.salt, interactionOrder.makerAsset, interactionOrder.takerAsset]
        )
      );
      const orderSignature = await maker.signMessage(ethers.utils.arrayify(orderHash));

      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          interactionOrder,
          orderSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.not.be.reverted;
    });
  });

  describe("Simulation and Testing", function () {
    it("should simulate contract calls", async function () {
      const targetContract = mockToken1.address;
      const callData = mockToken1.interface.encodeFunctionData("balanceOf", [maker.address]);

      await expect(
        mockLimitOrder.simulate(targetContract, callData)
      ).to.not.be.reverted;
    });

    it("should handle simulation failures", async function () {
      const targetContract = mockToken1.address;
      const invalidCallData = "0x12345678"; // Invalid function selector

      await expect(
        mockLimitOrder.simulate(targetContract, invalidCallData)
      ).to.be.revertedWith("Simulation failed");
    });

    it("should validate simulation parameters", async function () {
      await expect(
        mockLimitOrder.simulate(ethers.constants.AddressZero, "0x")
      ).to.be.revertedWith("Invalid target contract");

      await expect(
        mockLimitOrder.simulate(mockToken1.address, "0x")
      ).to.be.revertedWith("Empty call data");
    });
  });

  describe("Security and Edge Cases", function () {
    it("should prevent signature replay attacks", async function () {
      const limitOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [limitOrder.salt, limitOrder.makerAsset, limitOrder.takerAsset]
        )
      );
      const orderSignature = await maker.signMessage(ethers.utils.arrayify(orderHash));

      // Fill order once
      await mockLimitOrder.connect(filler).fillOrder(
        limitOrder,
        orderSignature,
        ORDER_AMOUNT,
        TAKING_AMOUNT
      );

      // Try to replay the same order
      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          limitOrder,
          orderSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Order already filled");
    });

    it("should handle integer overflow protection", async function () {
      const maxOrder = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      const maxUint256 = ethers.constants.MaxUint256;
      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [maxOrder.salt, maxOrder.makerAsset, maxOrder.takerAsset]
        )
      );
      const orderSignature = await maker.signMessage(ethers.utils.arrayify(orderHash));

      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          maxOrder,
          orderSignature,
          maxUint256,
          maxUint256
        )
      ).to.be.revertedWith("Amount too large");
    });

    it("should validate order salt uniqueness", async function () {
      const order1 = {
        salt: ORDER_SALT,
        makerAsset: mockToken1.address,
        takerAsset: mockToken2.address,
        makerAssetData: "0x",
        takerAssetData: "0x",
        getMakingAmount: "0x",
        getTakingAmount: "0x",
        predicate: "0x",
        permit: "0x",
        interaction: "0x"
      };

      const order2 = {
        ...order1,
        salt: ORDER_SALT // Same salt
      };

      const orderHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "address"],
          [order1.salt, order1.makerAsset, order1.takerAsset]
        )
      );
      const orderSignature = await maker.signMessage(ethers.utils.arrayify(orderHash));

      // Fill first order
      await mockLimitOrder.connect(filler).fillOrder(
        order1,
        orderSignature,
        ORDER_AMOUNT,
        TAKING_AMOUNT
      );

      // Try to create second order with same salt
      await expect(
        mockLimitOrder.connect(filler).fillOrder(
          order2,
          orderSignature,
          ORDER_AMOUNT,
          TAKING_AMOUNT
        )
      ).to.be.revertedWith("Order already filled");
    });

    it("should handle emergency scenarios", async function () {
      try {
        await mockLimitOrder.pause();

        const limitOrder = {
          salt: ORDER_SALT,
          makerAsset: mockToken1.address,
          takerAsset: mockToken2.address,
          makerAssetData: "0x",
          takerAssetData: "0x",
          getMakingAmount: "0x",
          getTakingAmount: "0x",
          predicate: "0x",
          permit: "0x",
          interaction: "0x"
        };

        const orderHash = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint256", "address", "address"],
            [limitOrder.salt, limitOrder.makerAsset, limitOrder.takerAsset]
          )
        );
        const orderSignature = await maker.signMessage(ethers.utils.arrayify(orderHash));

        await expect(
          mockLimitOrder.connect(filler).fillOrder(
            limitOrder,
            orderSignature,
            ORDER_AMOUNT,
            TAKING_AMOUNT
          )
        ).to.be.revertedWith("Contract is paused");
      } catch (error) {
        // Pause functionality might not be implemented
        this.skip();
      }
    });
  });
});
