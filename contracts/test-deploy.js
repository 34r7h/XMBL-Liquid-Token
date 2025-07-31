async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy ERC6551Registry
  console.log("Deploying ERC6551Registry...");
  const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
  const registry = await ERC6551Registry.deploy();
  await registry.waitForDeployment();
  console.log("ERC6551Registry deployed to:", await registry.getAddress());

  // Deploy TBAImplementation
  console.log("Deploying TBAImplementation...");
  const TBAImplementation = await ethers.getContractFactory("TBAImplementation");
  const tbaImplementation = await TBAImplementation.deploy();
  await tbaImplementation.waitForDeployment();
  console.log("TBAImplementation deployed to:", await tbaImplementation.getAddress());

  // Deploy XMBLToken
  console.log("Deploying XMBLToken...");
  const XMBLToken = await ethers.getContractFactory("XMBLToken");
  const xmblToken = await XMBLToken.deploy(
    "XMBL Liquid Token",
    "XMBL",
    await registry.getAddress(),
    await tbaImplementation.getAddress()
  );
  await xmblToken.waitForDeployment();
  console.log("XMBLToken deployed to:", await xmblToken.getAddress());

  console.log("All deployments successful!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
