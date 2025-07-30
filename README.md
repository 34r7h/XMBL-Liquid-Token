# XMBL Liquid Token

This is a defi protocol that ties in with the upcoming XMBL platform for rapid app generation, p2p web services, and yield generation from staking BTC.

Users deposit value into the system via BTC or any supported tokens. Supported tokens are converted to BTC and sent to the XMBL liquidity pool. When funds are sent to the pool, XMBL tokens are minted (priced according to an algorithmic bonding curve) and sent to the depositor. 

Funds from the liquidity pool are rented out to earn basis points which are distributed as dividend yields to XMBL token holders. 

We are utilizing One-Inch APIs, contracts, and workflows to enable swaps and provision liquidity for yield generation.

## Project Structure

Based on your project description for "XMBL-Liquid-Token" and drawing from the provided sources, here's a comprehensive folder and file scaffold structure, organized into your requested top-level directories: `client` (Vue.js), `server` (Bun), and `contracts` (EVM / one-inch). This structure integrates the core functionalities of depositing tokens, converting to BTC, minting XMBL tokens, managing a liquidity pool for yield generation, and distributing profits, all while leveraging 1inch's infrastructure.

### 1. `client/` (Vue.js / Vite Frontend)

This folder will house the user interface, enabling users to interact with your DeFi protocol. While the sources primarily reference React/Next.js for frontend components, the functionalities described can be effectively implemented using Vue.js.

*   **`public/`**
    *   `index.html`: The main HTML file for your Vue.js application.
*   **`src/`**
    *   **`assets/`**: Contains static assets like images, global CSS, and fonts.
    *   **`components/`**: Reusable Vue components for various UI elements.
        *   `WalletConnect.vue`: Handles connecting to EVM-compatible wallets (e.g., MetaMask).
        *   `DepositForm.vue`: A form for users to **select and deposit supported tokens or BTC**, previewing the amount of XMBL tokens they will receive based on your algorithmic bonding curve.
        *   `XMBLPortfolio.vue`: Displays the user's current **XMBL token balance**, deposited value, and accrued dividend yields.
        *   `TransactionHistory.vue`: Shows a record of user deposits, swaps, and yield distributions.
    *   **`services/`**: Modules for interacting with smart contracts and potentially your Bun backend.
        *   `web3Service.js`: Encapsulates logic for interacting with EVM smart contracts (e.g., using `ethers.js` or a Vue-specific Web3 library) to call functions like `deposit` on your `XMBLVault.sol` contract.
        *   `apiService.js`: (Optional) If your Bun server exposes specific APIs for frontend data or actions not directly on-chain.
    *   **`views/`** (or `pages/`): Top-level components representing different application views.
        *   `Home.vue`: The landing page, potentially showcasing the protocol's value proposition.
        *   `Dashboard.vue`: The main user dashboard where they can deposit, view their portfolio, and claim yields.
    *   `App.vue`: The root component of your Vue application.
    *   `main.js`: The entry point for your Vue application.
*   **`package.json`**: Lists frontend dependencies (e.g., `vue`, `ethers`, UI libraries).
*   **`vue.config.js`**: Vue CLI configuration file.
*   **`.env`**: Environment variables for public API keys (e.g., 1inch API key if directly used for quotes on client-side), contract addresses, etc..

***

### 2. `server/` (Bun Backend)

This folder will contain your off-chain logic, automations, and APIs that interact with blockchain networks and external services like 1inch. The sources provide examples using Node.js/TypeScript, which are fully adaptable to Bun.

*   **`src/`**
    *   **`api/`**: (Optional) If you decide to build REST APIs for your frontend or other services.
        *   `routes.ts`
        *   `controllers.ts`
    *   **`services/`**: Core business logic and external integrations.
        *   `oneInchService.ts`: Integrates with the **1inch Fusion SDK** and **1inch APIs**. This service will be crucial for:
            *   **Fetching quotes** for token swaps (e.g., converting any supported token to WBTC).
            *   **Creating and submitting orders** via 1inch Fusion+.
        *   `bitcoinService.ts`: Manages interactions with the Bitcoin network. If you utilize Hashed Timelock Contracts (HTLCs) for **atomic cross-chain swaps to native Bitcoin**, this service would use libraries like `bitcoinjs-lib` to construct and broadcast Bitcoin transactions.
        *   `yieldManagementService.ts`: Contains the logic for the "rental" aspect. This service would **automate transferring BTC from your liquidity pool to yield-generating DeFi protocols** (e.g., Compound, Aave as mentioned in BitVault Protocol) and harvesting the earned yield.
        *   `blockchainMonitor.ts`: Uses `ethers.js` (or a Bun-compatible equivalent) to **listen for specific events** emitted from your `XMBLVault.sol` contract on Ethereum (or L2s). This is vital for tracking deposits, swap completions, and triggering subsequent actions (like BTC bridging or yield deployment).
        *   `profitDistributionService.ts`: Handles the calculation and distribution of dividend yields to XMBL token holders.
    *   **`utils/`**: Helper functions and utilities.
        *   `secretGenerator.ts`: Generates and manages cryptographic secrets for HTLC-based swaps if implemented.
    *   `app.ts`: The main entry point for your Bun backend application.
*   **`package.json`**: Lists Bun-compatible dependencies (e.g., `@1inch/fusion-sdk`, `ethers`, `dotenv`, `bitcoinjs-lib` if used).
*   **`.env`**: Stores sensitive information like private keys, 1inch API keys (`ONE_INCH_API_KEY`), and RPC URLs for your blockchain nodes.

***

### 3. `contracts/` (EVM / One-Inch Smart Contracts)

This folder will contain all your Solidity smart contracts and their associated development tools and configurations, primarily built for EVM-compatible chains and designed to integrate with 1inch protocols.

*   **`contracts/`**
    *   **`XMBLVault.sol`**: This is your **primary protocol contract**. It will manage:
        *   **Receiving user deposits** (BTC or other tokens).
        *   **Initiating 1inch swaps** to convert deposited tokens to WBTC (Wrapped Bitcoin) using the 1inch Fusion+ protocol or Limit Order Protocol interfaces.
        *   Interacting with a bridge (like Wormhole mentioned in BagFi Protocol) to send **WBTC to native BTC** on the Bitcoin network for the liquidity pool.
        *   Minting `XMBLToken.sol` to depositors based on your **algorithmic bonding curve** logic.
        *   Managing the "liquidity pool" and interacting with your `YieldManager.sol` or similar for yield generation.
        *   Functions for **profit distribution** or enabling the `server` to trigger it.
    *   **`XMBLToken.sol`**: An **ERC-20 token contract** that represents users' shares in the XMBL liquid token system. This token will be minted by the `XMBLVault.sol` contract.
    *   **`EthereumHTLC.sol`**: (Optional, if implementing direct HTLCs for BTC swaps, similar to FusionVault) Manages the EVM side of atomic swaps by locking assets and enabling claims or refunds based on secrets and timelocks.
    *   **`YieldManager.sol`**: (Optional, if yield management is handled on-chain) A contract responsible for **deploying WBTC to yield protocols** (e.g., Compound V3) and harvesting yield.
    *   **`interfaces/`**: Solidity interfaces for external protocols you interact with.
        *   `I1inchFusion.sol`: Interface for 1inch Fusion+ smart contract interactions.
        *   `ILimitOrderProtocol.sol`: If your on-chain logic directly interacts with the 1inch Limit Order Protocol contract.
        *   `IWormholeBridge.sol`: If using Wormhole for bridging WBTC to native BTC.
    *   **`libraries/`**: Any reusable Solidity libraries.
        *   `OneInchHelper.sol`: (Optional) Helper functions for 1inch-related calculations or order creation.
*   **`scripts/`**: Hardhat scripts for common development tasks.
    *   `deploy.js`: Script to **deploy all your smart contracts** to a testnet (e.g., Sepolia) or mainnet.
*   **`test/`**: Hardhat tests for your smart contracts.
    *   `XMBLVault.test.js`: Comprehensive tests for your `XMBLVault.sol`'s functionality, including deposits, 1inch swap calls, XMBL token minting, and profit distribution logic.
    *   `XMBLToken.test.js`: Tests for the ERC-20 token.
*   **`hardhat.config.js`**: Hardhat configuration file, defining networks (e.g., `sepolia`, `mainnet`), Solidity compiler settings, and external contract addresses.
*   **`package.json`**: Lists development dependencies (e.g., `hardhat`, `@openzeppelin/contracts`, `@1inch/limit-order-protocol-contract` if used in contracts, `ethers`, `chai`).
*   **`.env`**: Stores sensitive information for contract deployment and testing (e.g., `PRIVATE_KEY`, `SEPOLIA_RPC_URL`).
*   **`README.md`**: A detailed project `README` (as suggested by sources for hackathon submissions) outlining setup instructions, architecture, and demo steps for your DeFi protocol.


