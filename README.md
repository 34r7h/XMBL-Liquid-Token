# XMBL Liquid Token

This is a defi protocol that ties in with the upcoming XMBL platform for rapid app generation, p2p web services, and yield generation from staking BTC.

Users deposit value into the system via BTC or any supported tokens. Supported tokens are converted to BTC and sent to the XMBL liquidity pool. When funds are sent to the pool, XMBL NFTs are minted with Token Bound Accounts (ERC-6551) based on an algorithmic bonding curve and sent to the depositor. Each deposit creates a unique NFT with its own smart contract account that can hold assets, execute transactions, and manage DeFi positions independently.

Funds from the liquidity pool are rented out to earn basis points which are distributed as dividend yields to individual XMBL NFT holders via their Token Bound Accounts. Each NFT's TBA receives yields proportional to its deposit value, enabling sophisticated per-position portfolio management.

We are utilizing One-Inch APIs, contracts, and workflows to enable swaps and provision liquidity for yield generation, combined with ERC-6551 Token Bound Accounts for advanced DeFi position management.

## Project Structure

Based on your project description for "XMBL-Liquid-Token" and drawing from the provided sources, here's a comprehensive folder and file scaffold structure, organized into your requested top-level directories: `client` (Vue.js), `server` (Bun), and `contracts` (EVM / one-inch). This structure integrates the core functionalities of depositing tokens, converting to BTC, minting XMBL NFTs with Token Bound Accounts (ERC-6551), managing a liquidity pool for yield generation, and distributing profits to individual TBAs, all while leveraging 1inch's infrastructure.

### 1. `client/` (Vue.js / Vite Frontend)

This folder will house the user interface, enabling users to interact with your DeFi protocol and manage their XMBL NFT collection with Token Bound Accounts. The frontend provides sophisticated portfolio management capabilities for individual NFT positions.

*   **`public/`**
    *   `index.html`: The main HTML file for your Vue.js application.
*   **`src/`**
    *   **`assets/`**: Contains static assets like images, global CSS, and fonts.
    *   **`components/`**: Reusable Vue components for various UI elements.
        *   `WalletConnect.vue`: Handles connecting to EVM-compatible wallets (e.g., MetaMask).
        *   `DepositForm.vue`: A form for users to **select and deposit supported tokens or BTC**, creating new XMBL NFTs with Token Bound Accounts based on your algorithmic bonding curve.
        *   `XMBLPortfolio.vue`: Displays the user's **XMBL NFT collection**, individual TBA balances, deposited values, and accrued dividend yields per NFT.
        *   `TransactionHistory.vue`: Shows a record of user deposits, NFT creations, swaps, and yield distributions to TBAs.
    *   **`services/`**: Modules for interacting with smart contracts and potentially your Bun backend.
        *   `web3Service.ts`: Encapsulates logic for interacting with EVM smart contracts, ERC-6551 registries, and Token Bound Accounts (using `ethers.js`) to call functions like `deposit` on your `XMBLVault.sol` contract and manage NFT operations.
        *   `apiService.ts`: (Optional) If your Bun server exposes specific APIs for frontend data or actions not directly on-chain.
    *   **`stores/`**: Pinia stores for state management.
        *   `wallet.ts`: Manages wallet connection and XMBL NFT collection data.
        *   `portfolio.ts`: Manages NFT portfolio data, TBA balances, and yield information.
        *   `protocol.ts`: Manages protocol-wide data and statistics.
        *   `transactions.ts`: Manages transaction history and status.
    *   **`views/`** (or `pages/`): Top-level components representing different application views.
        *   `Home.vue`: The landing page, potentially showcasing the protocol's value proposition.
        *   `Dashboard.vue`: The main user dashboard where they can deposit, view their NFT portfolio, and claim yields from individual TBAs.
    *   `App.vue`: The root component of your Vue application.
    *   `main.ts`: The entry point for your Vue application.
*   **`package.json`**: Lists frontend dependencies (e.g., `vue`, `ethers`, UI libraries, `@wagmi/core` for ERC-6551 support).
*   **`vite.config.ts`**: Vite configuration file.
*   **`.env`**: Environment variables for public API keys (e.g., 1inch API key if directly used for quotes on client-side), contract addresses, etc.

***

### 2. `server/` (Bun Backend)

This folder will contain your off-chain logic, automations, and APIs that interact with blockchain networks, ERC-6551 Token Bound Accounts, and external services like 1inch. The server manages NFT portfolio data, TBA interactions, and yield distribution to individual Token Bound Accounts.

*   **`src/`**
    *   **`api/`**: (Optional) If you decide to build REST APIs for your frontend or other services.
        *   `routes.ts`
        *   `controllers.ts`
    *   **`services/`**: Core business logic and external integrations.
        *   `oneInchService.ts`: Integrates with the **1inch Fusion SDK** and **1inch APIs**. This service will be crucial for:
            *   **Fetching quotes** for token swaps (e.g., converting any supported token to WBTC).
            *   **Creating and submitting orders** via 1inch Fusion+.
        *   `bitcoinService.ts`: Manages interactions with the Bitcoin network. If you utilize Hashed Timelock Contracts (HTLCs) for **atomic cross-chain swaps to native Bitcoin**, this service would use libraries like `bitcoinjs-lib` to construct and broadcast Bitcoin transactions.
        *   `yieldManagementService.ts`: Contains the logic for the "rental" aspect. This service would **automate transferring BTC from your liquidity pool to yield-generating DeFi protocols** (e.g., Compound, Aave) and harvesting the earned yield.
        *   `blockchainMonitor.ts`: Uses `ethers.js` to **listen for specific events** emitted from your `XMBLVault.sol` contract on Ethereum (or L2s). This is vital for tracking NFT deposits, TBA creations, swap completions, and triggering subsequent actions (like BTC bridging or yield deployment).
        *   `profitDistributionService.ts`: Handles the calculation and distribution of dividend yields to individual XMBL NFT holders via their Token Bound Accounts based on deposit values.
    *   **`utils/`**: Helper functions and utilities.
        *   `secretGenerator.ts`: Generates and manages cryptographic secrets for HTLC-based swaps if implemented.
    *   `app.ts`: The main entry point for your Bun backend application.
*   **`package.json`**: Lists Bun-compatible dependencies (e.g., `@1inch/fusion-sdk`, `ethers`, `dotenv`, `bitcoinjs-lib` if used).
*   **`.env`**: Stores sensitive information like private keys, 1inch API keys (`ONE_INCH_API_KEY`), and RPC URLs for your blockchain nodes.

***

### 3. `contracts/` (EVM / One-Inch Smart Contracts with ERC-6551 Integration)

This folder will contain all your Solidity smart contracts and their associated development tools and configurations, primarily built for EVM-compatible chains and designed to integrate with 1inch protocols and ERC-6551 Token Bound Accounts.

*   **`contracts/`**
    *   **`XMBLVault.sol`**: This is your **primary protocol contract**. It will manage:
        *   **Receiving user deposits** (BTC or other tokens).
        *   **Creating XMBL NFTs with Token Bound Accounts** for each deposit based on your **algorithmic bonding curve** logic.
        *   **Initiating 1inch swaps** to convert deposited tokens to WBTC (Wrapped Bitcoin) using the 1inch Fusion+ protocol or Limit Order Protocol interfaces.
        *   Interacting with a bridge (like Wormhole) to send **WBTC to native BTC** on the Bitcoin network for the liquidity pool.
        *   Managing the "liquidity pool" and interacting with your `YieldManager.sol` for yield generation.
        *   Functions for **profit distribution** to individual NFT Token Bound Accounts or enabling the `server` to trigger it.
    *   **`XMBLToken.sol`**: An **ERC-6551 compatible NFT contract** that represents users' individual positions in the XMBL liquid token system. Each NFT has an associated Token Bound Account that can hold assets, execute transactions, and manage DeFi positions independently. This NFT will be minted by the `XMBLVault.sol` contract.
    *   **`EthereumHTLC.sol`**: (Optional, if implementing direct HTLCs for BTC swaps) Manages the EVM side of atomic swaps by locking assets and enabling claims or refunds based on secrets and timelocks.
    *   **`YieldManager.sol`**: (Optional, if yield management is handled on-chain) A contract responsible for **deploying WBTC to yield protocols** (e.g., Compound V3) and harvesting yield for distribution to individual NFT Token Bound Accounts.
    *   **`interfaces/`**: Solidity interfaces for external protocols you interact with.
        *   `I1inchFusion.sol`: Interface for 1inch Fusion+ smart contract interactions.
        *   `ILimitOrderProtocol.sol`: If your on-chain logic directly interacts with the 1inch Limit Order Protocol contract.
        *   `IWormholeBridge.sol`: If using Wormhole for bridging WBTC to native BTC.
    *   **`libraries/`**: Any reusable Solidity libraries.
        *   `OneInchHelper.sol`: (Optional) Helper functions for 1inch-related calculations or order creation.
*   **`scripts/`**: Hardhat scripts for common development tasks.
    *   `deploy.js`: Script to **deploy all your smart contracts** to a testnet (e.g., Sepolia) or mainnet, including ERC-6551 registry and TBA implementation contracts.
*   **`test/`**: Hardhat tests for your smart contracts.
    *   `XMBLVault.test.js`: Comprehensive tests for your `XMBLVault.sol`'s functionality, including deposits, NFT creation with TBAs, 1inch swap calls, and profit distribution logic to individual Token Bound Accounts.
    *   `XMBLToken.test.js`: Tests for the ERC-6551 NFT contract, including TBA creation, management, and yield distribution.
*   **`hardhat.config.js`**: Hardhat configuration file, defining networks (e.g., `sepolia`, `mainnet`), Solidity compiler settings, and external contract addresses including ERC-6551 registry.
*   **`package.json`**: Lists development dependencies (e.g., `hardhat`, `@openzeppelin/contracts`, `@1inch/limit-order-protocol-contract`, `ethers`, `chai`).
*   **`.env`**: Stores sensitive information for contract deployment and testing (e.g., `PRIVATE_KEY`, `SEPOLIA_RPC_URL`).

## ERC-6551 Token Bound Accounts Integration

This protocol leverages ERC-6551 Token Bound Accounts to provide each XMBL NFT with its own smart contract account, enabling:

- **Individual Asset Management**: Each NFT's TBA can hold ETH, tokens, and other NFTs independently
- **Autonomous DeFi Operations**: TBAs can interact with other DeFi protocols, execute complex strategies, and compound yields automatically
- **Granular Yield Distribution**: Yields are distributed directly to each NFT's TBA based on deposit value
- **Advanced Portfolio Management**: Users can manage multiple sophisticated positions through different NFTs
- **Cross-Position Interactions**: TBAs can interact with each other for complex arbitrage and yield optimization strategies
- **Programmable Positions**: Each NFT position can be programmed with custom logic and automation

This creates a new paradigm where each deposit becomes a programmable, autonomous agent in the DeFi ecosystem, capable of managing its own assets and executing sophisticated strategies while maintaining proportional yield rights in the overall protocol.


