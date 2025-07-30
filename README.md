# XMBL Liquid Token

XMBL Liquid Token is a decentralized application (DApp) for the 1inch hackathon. This DApp acts as a BTC yield aggregation and cross-chain token management protocol.

The core goal of "XMBL Liquid Token" is to enable users to deposit any EVM token, seamlessly convert it to native Bitcoin, leverage this Bitcoin for yield generation in DeFi protocols, and distribute the accumulated profits back to the initial token depositors.

## Architecture

The project consists of three main components:

1.  **EVM Smart Contracts:** A set of Solidity smart contracts that form the core logic of the protocol.
2.  **Off-Chain Resolver Bot:** A Node.js script that listens for events from the smart contracts and interacts with the 1inch and Wormhole APIs.
3.  **Frontend:** A React-based user interface for interacting with the DApp.

### Smart Contracts

*   `XMBLToken.sol`: A standard ERC-20 token that is minted to users when they deposit tokens.
*   `XMBLVault.sol`: The main protocol contract that handles user deposits, swaps, and bridging.
*   `YieldManager.sol`: A contract that manages the yield-generating strategies.
*   `EthereumHTLC.sol`: A contract that manages the EVM side of atomic swaps.
*   `OneInchHelper.sol`: A library that provides helper functions for interacting with the 1inch API.

### Off-Chain Resolver Bot

The off-chain resolver bot is a Node.js script that performs the following tasks:

*   Listens for `Deposited` events from the `XMBLVault` contract.
*   Initiates a 1inch swap to convert the deposited tokens to WBTC.
*   Initiates a Wormhole bridge transfer to move the WBTC to the Bitcoin testnet.
*   Constructs and broadcasts a Bitcoin transaction to lock the BTC in an HTLC.
*   Monitors the Bitcoin blockchain for the user's claim transaction.
*   Claims the funds on the Ethereum network.

### Frontend

The frontend is a React-based application that allows users to:

*   Connect their wallets.
*   Deposit ERC-20 tokens.
*   View their `XMBL` token balance.
*   Claim their profits.

## Setup

1.  Clone the repository.
2.  Install the dependencies: `npm install`
3.  Create a `.env` file and populate it with the required environment variables (see `.env.example`).
4.  Compile the smart contracts: `npx hardhat compile`
5.  Run the tests: `npx hardhat test`
6.  Deploy the contracts: `npx hardhat run scripts/deploy.js --network sepolia`
7.  Start the off-chain resolver: `node scripts/swap.js`
8.  Start the frontend: `cd frontend && npm start`

**Note:** There are currently some issues with the Node.js environment that are preventing the `npm` and `npx` commands from working correctly. This is a known issue and is being investigated. In the meantime, you can use the `scripts/compile.js` and `scripts/deploy-ethers.js` scripts to compile and deploy the contracts.

## Demo

To run the demo, you will need to have a wallet with some Sepolia ETH and some ERC-20 tokens.

1.  Start the frontend and connect your wallet.
2.  Deposit some ERC-20 tokens into the `XMBLVault`.
3.  The off-chain resolver will automatically detect the deposit and initiate the swap and bridge process.
4.  Once the BTC is confirmed on the Bitcoin testnet, you will be able to see your `XMBL` token balance in the frontend.
5.  You can then claim your profits from the `XMBLVault`.
