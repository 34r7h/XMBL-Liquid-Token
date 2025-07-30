require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

async function main() {
    // Set up the provider and signer
    const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const signer = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

    // Compile the contracts
    const vaultContractName = 'XMBLVault';
    const tokenContractName = 'XMBLToken';
    const yieldManagerContractName = 'YieldManager';
    const htlcContractName = 'EthereumHTLC';

    const vaultSource = fs.readFileSync(path.join(__dirname, '../contracts', 'XMBLVault.sol'), 'utf8');
    const tokenSource = fs.readFileSync(path.join(__dirname, '../contracts', 'XMBLToken.sol'), 'utf8');
    const helperSource = fs.readFileSync(path.join(__dirname, '../contracts', 'OneInchHelper.sol'), 'utf8');
    const htlcSource = fs.readFileSync(path.join(__dirname, '../contracts', 'EthereumHTLC.sol'), 'utf8');
    const yieldSource = fs.readFileSync(path.join(__dirname, '../contracts', 'YieldManager.sol'), 'utf8');

    const input = {
        language: 'Solidity',
        sources: {
            'XMBLVault.sol': { content: vaultSource },
            'XMBLToken.sol': { content: tokenSource },
            'OneInchHelper.sol': { content: helperSource },
            'EthereumHTLC.sol': { content: htlcSource },
            'YieldManager.sol': { content: yieldSource },
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    const vaultArtifact = output.contracts['XMBLVault.sol'][vaultContractName];
    const tokenArtifact = output.contracts['XMBLToken.sol'][tokenContractName];
    const yieldManagerArtifact = output.contracts['YieldManager.sol'][yieldManagerContractName];
    const htlcArtifact = output.contracts['EthereumHTLC.sol'][htlcContractName];

    // Deploy the contracts
    const XMBLToken = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.evm.bytecode.object, signer);
    const xmblToken = await XMBLToken.deploy();
    await xmblToken.deployed();
    console.log("XMBLToken deployed to:", xmblToken.address);

    const XMBLVault = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.evm.bytecode.object, signer);
    const xmblVault = await XMBLVault.deploy(xmblToken.address);
    await xmblVault.deployed();
    console.log("XMBLVault deployed to:", xmblVault.address);

    // Transfer ownership of the XMBLToken to the XMBLVault
    await xmblToken.transferOwnership(xmblVault.address);
    console.log("XMBLToken ownership transferred to XMBLVault");

    const YieldManager = new ethers.ContractFactory(yieldManagerArtifact.abi, yieldManagerArtifact.evm.bytecode.object, signer);
    const yieldManager = await YieldManager.deploy();
    await yieldManager.deployed();
    console.log("YieldManager deployed to:", yieldManager.address);

    const EthereumHTLC = new ethers.ContractFactory(htlcArtifact.abi, htlcArtifact.evm.bytecode.object, signer);
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
