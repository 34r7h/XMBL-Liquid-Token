/**
 * deploy.js
 * PURPOSE: Script to deploy all XMBL protocol smart contracts to testnet or mainnet
 * 
 * DEPLOYMENT SEQUENCE:
 * 1. Deploy XMBLToken contract first (needed for vault initialization)
 * 2. Deploy YieldManager contract
 * 3. Deploy XMBLVault contract with references to token and yield manager
 * 4. Deploy EthereumHTLC contract (if using atomic swaps)
 * 5. Set proper permissions and initialize contracts
 * 6. Verify contracts on block explorer
 * 
 * EXPECTED FUNCTIONS:
 * - deployXMBLToken(): Promise<Contract> - Deploy XMBL ERC-20 token
 * - deployYieldManager(): Promise<Contract> - Deploy yield management contract
 * - deployXMBLVault(tokenAddress, yieldManagerAddress): Promise<Contract> - Deploy main vault
 * - deployEthereumHTLC(): Promise<Contract> - Deploy HTLC contract
 * - initializeContracts(contracts): Promise<void> - Initialize and link contracts
 * - verifyContracts(contracts): Promise<void> - Verify contracts on Etherscan
 * - setPermissions(contracts): Promise<void> - Set proper access controls
 * 
 * CONFIGURATION PARAMETERS:
 * - Network selection (sepolia, mainnet, polygon, etc.)
 * - Gas price and gas limit settings
 * - Contract constructor parameters
 * - Initial token supply and distribution
 * - Yield protocol addresses and configurations
 * - 1inch router and protocol addresses
 * 
 * ENVIRONMENT VARIABLES:
 * - PRIVATE_KEY - Deployer wallet private key
 * - INFURA_API_KEY - Ethereum node provider key
 * - ETHERSCAN_API_KEY - For contract verification
 * - NETWORK - Target deployment network
 * - GAS_PRICE - Custom gas price (optional)
 * 
 * CONTRACT ADDRESSES TO SET:
 * - WBTC_ADDRESS - Wrapped Bitcoin token address
 * - ONE_INCH_ROUTER - 1inch aggregation router
 * - ONE_INCH_FUSION - 1inch Fusion protocol
 * - LIMIT_ORDER_PROTOCOL - 1inch Limit Order Protocol
 * - YIELD_PROTOCOLS - Array of supported yield protocol addresses
 * 
 * INITIALIZATION STEPS:
 * 1. Set XMBLVault as minter for XMBLToken
 * 2. Set YieldManager permissions in vault
 * 3. Configure yield protocols in YieldManager
 * 4. Set initial bonding curve parameters
 * 5. Configure emergency pause controls
 * 6. Transfer ownership to multisig (if applicable)
 * 
 * VERIFICATION REQUIREMENTS:
 * - Verify all contracts on block explorer
 * - Publish source code for transparency
 * - Document contract addresses for integration
 * - Test contract interactions post-deployment
 * 
 * DEPLOYMENT CHECKLIST:
 * - [ ] All environment variables set
 * - [ ] Network configuration correct
 * - [ ] Gas settings appropriate
 * - [ ] Constructor parameters validated
 * - [ ] Deployer wallet funded
 * - [ ] Contract verification keys ready
 * 
 * MAINNET DEPLOYMENT CONSIDERATIONS:
 * - Use multisig for contract ownership
 * - Implement timelock for critical functions
 * - Set conservative initial parameters
 * - Plan for gradual feature rollout
 * - Prepare emergency pause procedures
 * 
 * POST-DEPLOYMENT TASKS:
 * - Update frontend contract addresses
 * - Update server service configurations
 * - Document deployment in README
 * - Notify monitoring services
 * - Test end-to-end functionality
 * 
 * ERROR HANDLING:
 * - Handle deployment failures gracefully
 * - Implement retry logic for network issues
 * - Validate deployment success before proceeding
 * - Save deployment artifacts and addresses
 * 
 * EXAMPLE USAGE:
 * npx hardhat run scripts/deploy.js --network sepolia
 * npx hardhat run scripts/deploy.js --network mainnet
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting XMBL protocol deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📋 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Step 1: Deploy XMBLToken contract
  console.log("\n📦 Step 1: Deploying XMBLToken...");
  const XMBLToken = await ethers.getContractFactory("XMBLToken");
  
  // Deploy ERC6551 registry and TBA implementation first
  const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
  const erc6551Registry = await ERC6551Registry.deploy();
  await erc6551Registry.waitForDeployment();
  const erc6551RegistryAddress = await erc6551Registry.getAddress();
  console.log("✅ ERC6551Registry deployed to:", erc6551RegistryAddress);
  
  const TBAImplementation = await ethers.getContractFactory("TBAImplementation");
  const tbaImplementation = await TBAImplementation.deploy();
  await tbaImplementation.waitForDeployment();
  const tbaImplementationAddress = await tbaImplementation.getAddress();
  console.log("✅ TBAImplementation deployed to:", tbaImplementationAddress);
  
  // Deploy XMBLToken with required parameters
  const xmblToken = await XMBLToken.deploy(
    "XMBL Liquid Token",
    "XMBL",
    erc6551RegistryAddress,
    tbaImplementationAddress
  );
  await xmblToken.waitForDeployment();
  const xmblTokenAddress = await xmblToken.getAddress();
  console.log("✅ XMBLToken deployed to:", xmblTokenAddress);

  // Step 2: Deploy YieldManager contract
  console.log("\n📦 Step 2: Deploying YieldManager...");
  
  // Deploy mock WBTC token first
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
  await mockWBTC.waitForDeployment();
  const mockWBTCAddress = await mockWBTC.getAddress();
  console.log("✅ MockWBTC deployed to:", mockWBTCAddress);
  
  const YieldManager = await ethers.getContractFactory("YieldManager");
  const yieldManager = await YieldManager.deploy(mockWBTCAddress);
  await yieldManager.waitForDeployment();
  const yieldManagerAddress = await yieldManager.getAddress();
  console.log("✅ YieldManager deployed to:", yieldManagerAddress);

  // Step 3: Deploy XMBLVault contract
  console.log("\n📦 Step 3: Deploying XMBLVault...");
  
  // Deploy mock 1inch price oracle
  const MockOneInchPriceOracle = await ethers.getContractFactory("MockOneInchPriceOracle");
  const mockPriceOracle = await MockOneInchPriceOracle.deploy();
  await mockPriceOracle.waitForDeployment();
  const mockPriceOracleAddress = await mockPriceOracle.getAddress();
  console.log("✅ MockOneInchPriceOracle deployed to:", mockPriceOracleAddress);
  
  const XMBLVault = await ethers.getContractFactory("XMBLVault");
  const xmblVault = await XMBLVault.deploy(
    xmblTokenAddress,
    mockWBTCAddress,
    erc6551RegistryAddress,
    tbaImplementationAddress,
    yieldManagerAddress,
    mockPriceOracleAddress
  );
  await xmblVault.waitForDeployment();
  const xmblVaultAddress = await xmblVault.getAddress();
  console.log("✅ XMBLVault deployed to:", xmblVaultAddress);

  // Step 4: Deploy EthereumHTLC contract
  console.log("\n📦 Step 4: Deploying EthereumHTLC...");
  const EthereumHTLC = await ethers.getContractFactory("EthereumHTLC");
  const ethereumHTLC = await EthereumHTLC.deploy();
  await ethereumHTLC.waitForDeployment();
  const ethereumHTLCAddress = await ethereumHTLC.getAddress();
  console.log("✅ EthereumHTLC deployed to:", ethereumHTLCAddress);

  // Step 5: Initialize contracts and set permissions
  console.log("\n🔧 Step 5: Initializing contracts and setting permissions...");
  
  // Set XMBLVault as minter for XMBLToken
  const minterRole = await xmblToken.MINTER_ROLE();
  await xmblToken.grantRole(minterRole, xmblVaultAddress);
  console.log("✅ Set XMBLVault as minter for XMBLToken");

  // Set vault in YieldManager
  await yieldManager.setVault(xmblVaultAddress);
  console.log("✅ Set vault address in YieldManager");

  // Configure initial bonding curve rate in vault
  const initialBondingCurveRate = ethers.parseEther("1.0"); // 1 ETH per token (within valid range)
  await xmblVault.updateBondingCurve(initialBondingCurveRate);
  console.log("✅ Set initial bonding curve rate");

  // Step 6: Verify deployment
  console.log("\n🔍 Step 6: Verifying deployment...");
  
  // Verify XMBLToken
  const tokenName = await xmblToken.name();
  const tokenSymbol = await xmblToken.symbol();
  console.log(`✅ XMBLToken verified: ${tokenName} (${tokenSymbol})`);

  // Verify YieldManager
  const vaultAddress = await yieldManager.vaultContract();
  console.log(`✅ YieldManager verified: vault address = ${vaultAddress}`);

  // Verify XMBLVault
  const vaultToken = await xmblVault.xmblToken();
  const vaultYieldManager = await xmblVault.yieldManager();
  console.log(`✅ XMBLVault verified: token = ${vaultToken}, yieldManager = ${vaultYieldManager}`);

  // Verify EthereumHTLC
  const htlcOwner = await ethereumHTLC.owner();
  console.log(`✅ EthereumHTLC verified: owner = ${htlcOwner}`);

  // Step 7: Export contract addresses
  console.log("\n📋 Step 7: Deployment Summary");
  console.log("=" * 50);
  console.log("Contract Addresses:");
  console.log(`ERC6551Registry: ${erc6551RegistryAddress}`);
  console.log(`TBAImplementation: ${tbaImplementationAddress}`);
  console.log(`MockWBTC: ${mockWBTCAddress}`);
  console.log(`MockOneInchPriceOracle: ${mockPriceOracleAddress}`);
  console.log(`XMBLToken: ${xmblTokenAddress}`);
  console.log(`YieldManager: ${yieldManagerAddress}`);
  console.log(`XMBLVault: ${xmblVaultAddress}`);
  console.log(`EthereumHTLC: ${ethereumHTLCAddress}`);
  console.log("=" * 50);

  // Save deployment info to file
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      ERC6551Registry: erc6551RegistryAddress,
      TBAImplementation: tbaImplementationAddress,
      MockWBTC: mockWBTCAddress,
      MockOneInchPriceOracle: mockPriceOracleAddress,
      XMBLToken: xmblTokenAddress,
      YieldManager: yieldManagerAddress,
      XMBLVault: xmblVaultAddress,
      EthereumHTLC: ethereumHTLCAddress
    },
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };

  const fs = require("fs");
  const deploymentPath = `deployments/${hre.network.name}.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Deployment info saved to: ${deploymentPath}`);

  console.log("\n🎉 XMBL protocol deployment completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Update frontend contract addresses");
  console.log("3. Test contract interactions");
  console.log("4. Deploy to mainnet when ready");
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
