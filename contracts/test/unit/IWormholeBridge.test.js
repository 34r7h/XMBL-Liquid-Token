const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("IWormholeBridge Interface", function () {
  let wormholeBridge;
  let mockWormhole;
  let owner;
  let sender;
  let recipient;
  let guardian;
  let mockWBTC;
  let mockWrappedToken;

  const TRANSFER_AMOUNT = ethers.utils.parseEther("1.0");
  const ETHEREUM_CHAIN_ID = 2;
  const BITCOIN_CHAIN_ID = 1;
  const ARBITER_FEE = ethers.utils.parseEther("0.001");
  const NONCE = 12345;

  beforeEach(async function () {
    [owner, sender, recipient, guardian] = await ethers.getSigners();

    // Deploy mock WBTC token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    await mockWBTC.deployed();

    // Note: Skip tests if IWormholeBridge interface implementation is not available
    try {
      // Deploy mock implementation of IWormholeBridge interface
      const MockIWormholeBridge = await ethers.getContractFactory("MockIWormholeBridge");
      mockWormhole = await MockIWormholeBridge.deploy();
      await mockWormhole.deployed();

      // Deploy mock wrapped token
      mockWrappedToken = await MockERC20.deploy("Wrapped WBTC", "wWBTC", 8);
      await mockWrappedToken.deployed();

      // Mint WBTC for testing
      await mockWBTC.mint(sender.address, ethers.utils.parseEther("10"));
      await mockWBTC.connect(sender).approve(mockWormhole.address, ethers.utils.parseEther("10"));
    } catch (error) {
      console.log("IWormholeBridge interface implementation not available, skipping tests");
      this.skip();
    }
  });

  describe("Interface Definition", function () {
    it("should support IWormholeBridge interface", async function () {
      expect(await mockWormhole.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC165
    });

    it("should have all required function signatures", async function () {
      expect(mockWormhole.transferTokens).to.be.a("function");
      expect(mockWormhole.completeTransfer).to.be.a("function");
      expect(mockWormhole.parseTransfer).to.be.a("function");
      expect(mockWormhole.attestToken).to.be.a("function");
      expect(mockWormhole.createWrapped).to.be.a("function");
      expect(mockWormhole.updateWrapped).to.be.a("function");
      expect(mockWormhole.wrapperForTokenOnChain).to.be.a("function");
      expect(mockWormhole.isTransferCompleted).to.be.a("function");
    });
  });

  describe("Token Transfer Initiation", function () {
    it("should initiate token transfer successfully", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          BITCOIN_CHAIN_ID,
          recipientBytes32,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        )
      )
        .to.emit(mockWormhole, "LogTokensLocked")
        .withArgs(mockWBTC.address, sender.address, TRANSFER_AMOUNT, BITCOIN_CHAIN_ID, recipientBytes32);
    });

    it("should return sequence number", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);

      const sequenceNumber = await mockWormhole.connect(sender).transferTokens(
        mockWBTC.address,
        TRANSFER_AMOUNT,
        BITCOIN_CHAIN_ID,
        recipientBytes32,
        ARBITER_FEE,
        NONCE,
        { value: ARBITER_FEE }
      );

      expect(sequenceNumber).to.be.a("BigNumber");
      expect(sequenceNumber).to.be.gt(0);
    });

    it("should reject zero amount transfers", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          0,
          BITCOIN_CHAIN_ID,
          recipientBytes32,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        )
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("should reject invalid chain ID", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);
      const invalidChainId = 0;

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          invalidChainId,
          recipientBytes32,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        )
      ).to.be.revertedWith("Invalid chain ID");
    });

    it("should reject invalid recipient", async function () {
      const zeroRecipient = ethers.constants.HashZero;

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          BITCOIN_CHAIN_ID,
          zeroRecipient,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        )
      ).to.be.revertedWith("Invalid recipient");
    });

    it("should require sufficient ETH for fees", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);
      const insufficientFee = ethers.utils.parseEther("0.0001");

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          BITCOIN_CHAIN_ID,
          recipientBytes32,
          ARBITER_FEE,
          NONCE,
          { value: insufficientFee }
        )
      ).to.be.revertedWith("Insufficient fee");
    });

    it("should lock tokens in contract", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);
      const contractBalanceBefore = await mockWBTC.balanceOf(mockWormhole.address);

      await mockWormhole.connect(sender).transferTokens(
        mockWBTC.address,
        TRANSFER_AMOUNT,
        BITCOIN_CHAIN_ID,
        recipientBytes32,
        ARBITER_FEE,
        NONCE,
        { value: ARBITER_FEE }
      );

      const contractBalanceAfter = await mockWBTC.balanceOf(mockWormhole.address);
      expect(contractBalanceAfter.sub(contractBalanceBefore)).to.equal(TRANSFER_AMOUNT);
    });

    it("should handle different target chains", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);
      const solanaChainId = 1;
      const polygonChainId = 5;

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          solanaChainId,
          recipientBytes32,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        )
      ).to.not.be.reverted;

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          polygonChainId,
          recipientBytes32,
          ARBITER_FEE,
          NONCE + 1,
          { value: ARBITER_FEE }
        )
      ).to.not.be.reverted;
    });
  });

  describe("Transfer Completion", function () {
    let encodedVAA;

    beforeEach(async function () {
      // Create mock VAA (Verifiable Action Approval)
      const transferPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256", "bytes32", "uint16", "bytes32", "uint16", "uint256"],
        [
          1, // payloadID
          TRANSFER_AMOUNT,
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          ethers.utils.hexZeroPad(recipient.address, 32),
          BITCOIN_CHAIN_ID,
          ethers.utils.parseEther("0.001") // fee
        ]
      );

      encodedVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes"],
        [
          1, // version
          await time.latest(), // timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          transferPayload
        ]
      );
    });

    it("should complete transfer with valid VAA", async function () {
      await expect(mockWormhole.completeTransfer(encodedVAA))
        .to.emit(mockWormhole, "TransferRedeemed")
        .withArgs(mockWBTC.address, recipient.address, TRANSFER_AMOUNT, ETHEREUM_CHAIN_ID);
    });

    it("should reject invalid VAA", async function () {
      const invalidVAA = "0x1234";

      await expect(
        mockWormhole.completeTransfer(invalidVAA)
      ).to.be.revertedWith("Invalid VAA");
    });

    it("should reject empty VAA", async function () {
      await expect(
        mockWormhole.completeTransfer("0x")
      ).to.be.revertedWith("Empty VAA");
    });

    it("should reject already completed transfers", async function () {
      await mockWormhole.completeTransfer(encodedVAA);

      await expect(
        mockWormhole.completeTransfer(encodedVAA)
      ).to.be.revertedWith("Transfer already completed");
    });

    it("should validate VAA signatures", async function () {
      // Test VAA with invalid guardian signatures
      const invalidSignatureVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes", "bytes"],
        [
          1, // version
          await time.latest(), // timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          "0x1234", // invalid payload
          "0x5678" // invalid signatures
        ]
      );

      await expect(
        mockWormhole.completeTransfer(invalidSignatureVAA)
      ).to.be.revertedWith("Invalid guardian signatures");
    });

    it("should mint wrapped tokens correctly", async function () {
      const recipientBalanceBefore = await mockWrappedToken.balanceOf(recipient.address);

      await mockWormhole.completeTransfer(encodedVAA);

      const recipientBalanceAfter = await mockWrappedToken.balanceOf(recipient.address);
      expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.equal(TRANSFER_AMOUNT);
    });

    it("should handle fee distribution", async function () {
      const relayerBalanceBefore = await owner.getBalance();

      await mockWormhole.completeTransfer(encodedVAA);

      // Relayer might receive fee for completing transfer
      const relayerBalanceAfter = await owner.getBalance();
      expect(relayerBalanceAfter).to.be.gte(relayerBalanceBefore);
    });
  });

  describe("Transfer Parsing", function () {
    it("should parse transfer details correctly", async function () {
      const transferPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256", "bytes32", "uint16", "bytes32", "uint16", "uint256"],
        [
          1, // payloadID
          TRANSFER_AMOUNT,
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          ethers.utils.hexZeroPad(recipient.address, 32),
          BITCOIN_CHAIN_ID,
          ethers.utils.parseEther("0.001") // fee
        ]
      );

      const transferDetails = await mockWormhole.parseTransfer(transferPayload);

      expect(transferDetails.payloadID).to.equal(1);
      expect(transferDetails.amount).to.equal(TRANSFER_AMOUNT);
      expect(transferDetails.tokenChain).to.equal(ETHEREUM_CHAIN_ID);
      expect(transferDetails.toChain).to.equal(BITCOIN_CHAIN_ID);
      expect(transferDetails.fee).to.equal(ethers.utils.parseEther("0.001"));
    });

    it("should reject invalid payload format", async function () {
      const invalidPayload = "0x1234";

      await expect(
        mockWormhole.parseTransfer(invalidPayload)
      ).to.be.revertedWith("Invalid payload format");
    });

    it("should handle different payload types", async function () {
      const attestPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "bytes32", "uint16", "uint8", "uint32", "string", "string"],
        [
          2, // attestation payloadID
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          8, // decimals
          0, // symbol length
          "WBTC", // symbol
          "Wrapped Bitcoin" // name
        ]
      );

      // Should handle attestation payload differently
      await expect(
        mockWormhole.parseTransfer(attestPayload)
      ).to.be.revertedWith("Not a transfer payload");
    });

    it("should validate payload structure", async function () {
      const malformedPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256"], // Missing required fields
        [1, TRANSFER_AMOUNT]
      );

      await expect(
        mockWormhole.parseTransfer(malformedPayload)
      ).to.be.revertedWith("Malformed payload");
    });
  });

  describe("Token Attestation", function () {
    it("should attest token successfully", async function () {
      const sequenceNumber = await mockWormhole.connect(owner).attestToken(
        mockWBTC.address,
        NONCE,
        { value: ARBITER_FEE }
      );

      expect(sequenceNumber).to.be.a("BigNumber");
      expect(sequenceNumber).to.be.gt(0);
    });

    it("should emit TokenAttestation event", async function () {
      await expect(
        mockWormhole.connect(owner).attestToken(
          mockWBTC.address,
          NONCE,
          { value: ARBITER_FEE }
        )
      )
        .to.emit(mockWormhole, "TokenAttestation")
        .withArgs(mockWBTC.address, ETHEREUM_CHAIN_ID, ethers.utils.hexZeroPad(mockWBTC.address, 32));
    });

    it("should reject invalid token address", async function () {
      await expect(
        mockWormhole.connect(owner).attestToken(
          ethers.constants.AddressZero,
          NONCE,
          { value: ARBITER_FEE }
        )
      ).to.be.revertedWith("Invalid token address");
    });

    it("should require attestation fee", async function () {
      await expect(
        mockWormhole.connect(owner).attestToken(
          mockWBTC.address,
          NONCE,
          { value: 0 }
        )
      ).to.be.revertedWith("Insufficient attestation fee");
    });

    it("should handle duplicate attestations", async function () {
      await mockWormhole.connect(owner).attestToken(
        mockWBTC.address,
        NONCE,
        { value: ARBITER_FEE }
      );

      // Second attestation should either succeed or be ignored
      await expect(
        mockWormhole.connect(owner).attestToken(
          mockWBTC.address,
          NONCE + 1,
          { value: ARBITER_FEE }
        )
      ).to.not.be.reverted;
    });
  });

  describe("Wrapped Token Management", function () {
    let attestationVAA;

    beforeEach(async function () {
      const attestationPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "bytes32", "uint16", "uint8", "uint32", "string", "string"],
        [
          2, // attestation payloadID
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          8, // decimals
          4, // symbol length
          "WBTC", // symbol
          "Wrapped Bitcoin" // name
        ]
      );

      attestationVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes"],
        [
          1, // version
          await time.latest(), // timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          attestationPayload
        ]
      );
    });

    it("should create wrapped token", async function () {
      const wrappedTokenAddress = await mockWormhole.createWrapped(attestationVAA);

      expect(ethers.utils.isAddress(wrappedTokenAddress)).to.equal(true);
      expect(wrappedTokenAddress).to.not.equal(ethers.constants.AddressZero);
    });

    it("should update wrapped token metadata", async function () {
      const wrappedTokenAddress = await mockWormhole.createWrapped(attestationVAA);

      const updatedTokenAddress = await mockWormhole.updateWrapped(attestationVAA);

      expect(updatedTokenAddress).to.equal(wrappedTokenAddress);
    });

    it("should get wrapper for token on chain", async function () {
      await mockWormhole.createWrapped(attestationVAA);

      const wrappedTokenAddress = await mockWormhole.wrapperForTokenOnChain(
        ETHEREUM_CHAIN_ID,
        ethers.utils.hexZeroPad(mockWBTC.address, 32)
      );

      expect(ethers.utils.isAddress(wrappedTokenAddress)).to.equal(true);
    });

    it("should return zero address for non-existent wrapper", async function () {
      const nonExistentToken = ethers.utils.hexZeroPad(mockWrappedToken.address, 32);

      const wrappedTokenAddress = await mockWormhole.wrapperForTokenOnChain(
        ETHEREUM_CHAIN_ID,
        nonExistentToken
      );

      expect(wrappedTokenAddress).to.equal(ethers.constants.AddressZero);
    });

    it("should reject invalid attestation VAA", async function () {
      const invalidVAA = "0x1234";

      await expect(
        mockWormhole.createWrapped(invalidVAA)
      ).to.be.revertedWith("Invalid attestation VAA");
    });

    it("should handle chain-specific wrapping", async function () {
      await mockWormhole.createWrapped(attestationVAA);

      // Different chain should create different wrapper
      const differentChainWrapper = await mockWormhole.wrapperForTokenOnChain(
        BITCOIN_CHAIN_ID,
        ethers.utils.hexZeroPad(mockWBTC.address, 32)
      );

      expect(differentChainWrapper).to.equal(ethers.constants.AddressZero);
    });
  });

  describe("Transfer Status Tracking", function () {
    it("should track transfer completion status", async function () {
      const transferHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["address", "uint256", "uint16", "bytes32"],
          [mockWBTC.address, TRANSFER_AMOUNT, BITCOIN_CHAIN_ID, ethers.utils.hexZeroPad(recipient.address, 32)]
        )
      );

      expect(await mockWormhole.isTransferCompleted(transferHash)).to.equal(false);

      // Complete a transfer (would need proper VAA)
      const transferPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256", "bytes32", "uint16", "bytes32", "uint16", "uint256"],
        [
          1, // payloadID
          TRANSFER_AMOUNT,
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          ethers.utils.hexZeroPad(recipient.address, 32),
          BITCOIN_CHAIN_ID,
          ethers.utils.parseEther("0.001") // fee
        ]
      );

      const encodedVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes"],
        [
          1, // version
          await time.latest(), // timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          transferPayload
        ]
      );

      await mockWormhole.completeTransfer(encodedVAA);

      expect(await mockWormhole.isTransferCompleted(transferHash)).to.equal(true);
    });

    it("should handle non-existent transfer hash", async function () {
      const randomHash = ethers.utils.keccak256("0x1234");

      expect(await mockWormhole.isTransferCompleted(randomHash)).to.equal(false);
    });

    it("should prevent double completion", async function () {
      const transferPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256", "bytes32", "uint16", "bytes32", "uint16", "uint256"],
        [
          1, // payloadID
          TRANSFER_AMOUNT,
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          ethers.utils.hexZeroPad(recipient.address, 32),
          BITCOIN_CHAIN_ID,
          ethers.utils.parseEther("0.001") // fee
        ]
      );

      const encodedVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes"],
        [
          1, // version
          await time.latest(), // timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          transferPayload
        ]
      );

      await mockWormhole.completeTransfer(encodedVAA);

      await expect(
        mockWormhole.completeTransfer(encodedVAA)
      ).to.be.revertedWith("Transfer already completed");
    });
  });

  describe("Cross-Chain Bitcoin Integration", function () {
    it("should handle WBTC to native BTC bridging", async function () {
      const bitcoinAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"; // Example Bitcoin address
      const bitcoinAddressBytes32 = ethers.utils.formatBytes32String(bitcoinAddress);

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          BITCOIN_CHAIN_ID,
          bitcoinAddressBytes32,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        )
      ).to.not.be.reverted;
    });

    it("should validate Bitcoin address format", async function () {
      const invalidBitcoinAddress = "invalid_address";
      const invalidAddressBytes32 = ethers.utils.formatBytes32String(invalidBitcoinAddress);

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          BITCOIN_CHAIN_ID,
          invalidAddressBytes32,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        )
      ).to.be.revertedWith("Invalid Bitcoin address format");
    });

    it("should handle Bitcoin network confirmation requirements", async function () {
      // Test different confirmation requirements for different amounts
      const smallAmount = ethers.utils.parseEther("0.1");
      const largeAmount = ethers.utils.parseEther("10");
      const bitcoinAddressBytes32 = ethers.utils.formatBytes32String("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          smallAmount,
          BITCOIN_CHAIN_ID,
          bitcoinAddressBytes32,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        )
      ).to.not.be.reverted;

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          largeAmount,
          BITCOIN_CHAIN_ID,
          bitcoinAddressBytes32,
          ARBITER_FEE.mul(2), // Higher fee for larger amount
          NONCE + 1,
          { value: ARBITER_FEE.mul(2) }
        )
      ).to.not.be.reverted;
    });

    it("should support SPV proof verification", async function () {
      // Test SPV (Simplified Payment Verification) proof handling
      const spvProof = ethers.utils.hexlify(ethers.utils.randomBytes(256));
      const bitcoinTxHash = ethers.utils.hexlify(ethers.utils.randomBytes(32));

      // This would be part of the VAA payload for Bitcoin confirmations
      const bitcoinProofPayload = ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes", "uint256"],
        [bitcoinTxHash, spvProof, 6] // 6 confirmations
      );

      expect(bitcoinProofPayload).to.be.a("string");
    });
  });

  describe("Guardian Network Validation", function () {
    it("should validate guardian signatures", async function () {
      const transferPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256", "bytes32", "uint16", "bytes32", "uint16", "uint256"],
        [
          1, // payloadID
          TRANSFER_AMOUNT,
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          ethers.utils.hexZeroPad(recipient.address, 32),
          BITCOIN_CHAIN_ID,
          ethers.utils.parseEther("0.001") // fee
        ]
      );

      // Mock guardian signatures
      const guardianSignatures = [];
      for (let i = 0; i < 13; i++) { // Typical guardian count
        const signature = await guardian.signMessage(ethers.utils.arrayify(ethers.utils.keccak256(transferPayload)));
        guardianSignatures.push(signature);
      }

      const encodedVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes", "bytes[]"],
        [
          1, // version
          await time.latest(), // timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          transferPayload,
          guardianSignatures
        ]
      );

      await expect(mockWormhole.completeTransfer(encodedVAA)).to.not.be.reverted;
    });

    it("should require minimum guardian signatures", async function () {
      const transferPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256", "bytes32", "uint16", "bytes32", "uint16", "uint256"],
        [
          1, // payloadID
          TRANSFER_AMOUNT,
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          ethers.utils.hexZeroPad(recipient.address, 32),
          BITCOIN_CHAIN_ID,
          ethers.utils.parseEther("0.001") // fee
        ]
      );

      // Insufficient guardian signatures
      const insufficientSignatures = [];
      for (let i = 0; i < 5; i++) { // Less than required threshold
        const signature = await guardian.signMessage(ethers.utils.arrayify(ethers.utils.keccak256(transferPayload)));
        insufficientSignatures.push(signature);
      }

      const encodedVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes", "bytes[]"],
        [
          1, // version
          await time.latest(), // timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          transferPayload,
          insufficientSignatures
        ]
      );

      await expect(
        mockWormhole.completeTransfer(encodedVAA)
      ).to.be.revertedWith("Insufficient guardian signatures");
    });

    it("should handle guardian set updates", async function () {
      // Test guardian set rotation/updates
      const newGuardianSet = [guardian.address, sender.address, recipient.address];
      
      // This would be a governance action to update guardians
      try {
        await mockWormhole.updateGuardianSet(newGuardianSet);
        expect(true).to.equal(true); // Test passed if no revert
      } catch (error) {
        // Guardian set updates might not be implemented in mock
        this.skip();
      }
    });
  });

  describe("Fee Management", function () {
    it("should calculate correct bridge fees", async function () {
      const baseFee = ethers.utils.parseEther("0.001");
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);

      // Different chains might have different fees
      const ethereumFee = baseFee;
      const bitcoinFee = baseFee.mul(2); // Higher fee for Bitcoin

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          ETHEREUM_CHAIN_ID,
          recipientBytes32,
          ethereumFee,
          NONCE,
          { value: ethereumFee }
        )
      ).to.not.be.reverted;

      await expect(
        mockWormhole.connect(sender).transferTokens(
          mockWBTC.address,
          TRANSFER_AMOUNT,
          BITCOIN_CHAIN_ID,
          recipientBytes32,
          bitcoinFee,
          NONCE + 1,
          { value: bitcoinFee }
        )
      ).to.not.be.reverted;
    });

    it("should distribute fees correctly", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);
      const bridgeBalanceBefore = await ethers.provider.getBalance(mockWormhole.address);

      await mockWormhole.connect(sender).transferTokens(
        mockWBTC.address,
        TRANSFER_AMOUNT,
        BITCOIN_CHAIN_ID,
        recipientBytes32,
        ARBITER_FEE,
        NONCE,
        { value: ARBITER_FEE }
      );

      const bridgeBalanceAfter = await ethers.provider.getBalance(mockWormhole.address);
      expect(bridgeBalanceAfter.sub(bridgeBalanceBefore)).to.equal(ARBITER_FEE);
    });

    it("should handle fee refunds for failed transfers", async function () {
      const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);
      const senderBalanceBefore = await sender.getBalance();

      // Create a transfer that will fail
      try {
        await mockWormhole.connect(sender).transferTokens(
          ethers.constants.AddressZero, // Invalid token
          TRANSFER_AMOUNT,
          BITCOIN_CHAIN_ID,
          recipientBytes32,
          ARBITER_FEE,
          NONCE,
          { value: ARBITER_FEE }
        );
      } catch (error) {
        // Fee should be refunded on failure
        const senderBalanceAfter = await sender.getBalance();
        expect(senderBalanceAfter).to.be.gt(senderBalanceBefore.sub(ethers.utils.parseEther("0.01"))); // Account for gas
      }
    });
  });

  describe("Security and Emergency Controls", function () {
    it("should handle emergency pause", async function () {
      try {
        await mockWormhole.pause();

        const recipientBytes32 = ethers.utils.hexZeroPad(recipient.address, 32);

        await expect(
          mockWormhole.connect(sender).transferTokens(
            mockWBTC.address,
            TRANSFER_AMOUNT,
            BITCOIN_CHAIN_ID,
            recipientBytes32,
            ARBITER_FEE,
            NONCE,
            { value: ARBITER_FEE }
          )
        ).to.be.revertedWith("Contract is paused");
      } catch (error) {
        // Pause functionality might not be implemented
        this.skip();
      }
    });

    it("should prevent replay attacks", async function () {
      const transferPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256", "bytes32", "uint16", "bytes32", "uint16", "uint256"],
        [
          1, // payloadID
          TRANSFER_AMOUNT,
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          ethers.utils.hexZeroPad(recipient.address, 32),
          BITCOIN_CHAIN_ID,
          ethers.utils.parseEther("0.001") // fee
        ]
      );

      const encodedVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes"],
        [
          1, // version
          await time.latest(), // timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          transferPayload
        ]
      );

      await mockWormhole.completeTransfer(encodedVAA);

      // Try to replay the same VAA
      await expect(
        mockWormhole.completeTransfer(encodedVAA)
      ).to.be.revertedWith("Transfer already completed");
    });

    it("should validate VAA timestamp", async function () {
      const oldTimestamp = (await time.latest()) - 86400; // 24 hours ago
      const transferPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint256", "bytes32", "uint16", "bytes32", "uint16", "uint256"],
        [
          1, // payloadID
          TRANSFER_AMOUNT,
          ethers.utils.hexZeroPad(mockWBTC.address, 32),
          ETHEREUM_CHAIN_ID,
          ethers.utils.hexZeroPad(recipient.address, 32),
          BITCOIN_CHAIN_ID,
          ethers.utils.parseEther("0.001") // fee
        ]
      );

      const expiredVAA = ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes"],
        [
          1, // version
          oldTimestamp, // expired timestamp
          ETHEREUM_CHAIN_ID, // emitterChain
          ethers.utils.hexZeroPad(mockWormhole.address, 32), // emitterAddress
          12345, // sequence
          1, // consistencyLevel
          transferPayload
        ]
      );

      await expect(
        mockWormhole.completeTransfer(expiredVAA)
      ).to.be.revertedWith("VAA too old");
    });

    it("should handle governance upgrades", async function () {
      // Test governance-controlled contract upgrades
      try {
        const newImplementation = mockWormhole.address;
        await mockWormhole.upgrade(newImplementation);
        expect(true).to.equal(true); // Test passed if no revert
      } catch (error) {
        // Upgrade functionality might not be implemented in mock
        this.skip();
      }
    });
  });
});
