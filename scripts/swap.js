require('dotenv').config();
const { ethers } = require('ethers');
const { FusionSDK } = require('@1inch/fusion-sdk');
const { Wormhole } = require('@wormhole-foundation/sdk');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

async function main() {
    // Set up the provider and signer
    const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const signer = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

    // Compile the contracts
    const vaultContractName = 'XMBLVault';
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
    const vaultAbi = vaultArtifact.abi;
    const vaultBytecode = vaultArtifact.evm.bytecode.object;

    // Initialize the 1inch Fusion SDK
    const fusionSDK = new FusionSDK({
        url: 'https://fusion.1inch.io',
        network: 11155111, // Sepolia testnet
        signer,
    });

    // Initialize the Wormhole SDK
    const wormhole = new Wormhole('Testnet', ['ethereum', 'bitcoin']);

    // TODO: Deploy the contracts and get the addresses
    const xmblVaultAddress = "0x..."; // Replace with actual address after deployment
    const xmblVault = new ethers.Contract(xmblVaultAddress, vaultAbi, signer);

    console.log('Off-chain resolver bot started...');
    console.log('Listening for Deposited events...');

    xmblVault.on('Deposited', async (user, fromToken, amount) => {
        console.log('Deposited event detected:');
        console.log(`  User: ${user}`);
        console.log(`  From Token: ${fromToken}`);
        console.log(`  Amount: ${amount}`);

        // Initiate 1inch swap
        const toToken = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'; // WBTC on Sepolia
        const fromTokenAddress = fromToken;
        const amountIn = amount.toString();

        const params = {
            fromTokenAddress,
            toTokenAddress: toToken,
            amount: amountIn,
            walletAddress: signer.address,
            // TODO: Figure out how to get the permit
            // permit: '',
            enableEstimate: true,
        };

        try {
            const quote = await fusionSDK.getQuote(params);
            console.log('Quote:', quote);

            // TODO: Place the order
            // const order = await fusionSDK.placeOrder(quote);
            // console.log('Order:', order);
        } catch (error) {
            console.error('Error getting quote:', error);
        }
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
