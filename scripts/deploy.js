async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const XMBLToken = await ethers.getContractFactory("XMBLToken");
    const xmblToken = await XMBLToken.deploy();
    await xmblToken.deployed();

    console.log("XMBLToken deployed to:", xmblToken.address);

    const XMBLVault = await ethers.getContractFactory("XMBLVault");
    const xmblVault = await XMBLVault.deploy(xmblToken.address);
    await xmblVault.deployed();

    console.log("XMBLVault deployed to:", xmblVault.address);

    // Transfer ownership of the XMBLToken to the XMBLVault
    await xmblToken.transferOwnership(xmblVault.address);
    console.log("XMBLToken ownership transferred to XMBLVault");

    const YieldManager = await ethers.getContractFactory("YieldManager");
    const yieldManager = await YieldManager.deploy();
    await yieldManager.deployed();

    console.log("YieldManager deployed to:", yieldManager.address);

    const EthereumHTLC = await ethers.getContractFactory("EthereumHTLC");
    const ethereumHTLC = await EthereumHTLC.deploy();
    await ethereumHTLC.deployed();

    console.log("EthereumHTLC deployed to:", ethereumHTLC.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
