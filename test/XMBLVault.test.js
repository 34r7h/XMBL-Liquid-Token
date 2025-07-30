const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XMBLVault", function () {
    let xmblVault, xmblToken, owner, user1;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        const XMBLToken = await ethers.getContractFactory("XMBLToken");
        xmblToken = await XMBLToken.deploy();
        await xmblToken.deployed();

        const XMBLVault = await ethers.getContractFactory("XMBLVault");
        xmblVault = await XMBLVault.deploy(xmblToken.address);
        await xmblVault.deployed();

        // Transfer ownership of the XMBLToken to the XMBLVault
        await xmblToken.transferOwnership(xmblVault.address);
    });

    it("Should allow a user to deposit tokens", async function () {
        // For this test, we'll use a mock ERC20 token
        const MockERC20 = await ethers.getContractFactory("XMBLToken");
        const mockToken = await MockERC20.deploy();
        await mockToken.deployed();

        // Mint some mock tokens to the user
        await mockToken.mint(user1.address, ethers.utils.parseEther("1000"));

        // Approve the vault to spend the user's tokens
        await mockToken.connect(user1).approve(xmblVault.address, ethers.utils.parseEther("100"));

        // Deposit the tokens
        await xmblVault.connect(user1).depositAndSwap(mockToken.address, ethers.utils.parseEther("100"), 0);

        // Check the user's deposited balance
        const depositedBalance = await xmblVault.deposited(user1.address);
        expect(depositedBalance).to.equal(ethers.utils.parseEther("100"));
    });
});
