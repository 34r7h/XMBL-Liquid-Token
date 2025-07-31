# Development Environment and Parallel Development Plan

This plan outlines the steps to set up the development environment and enable parallel development for the XMBL Liquid Token project.

## 1. Environment Setup

This section describes how to set up the development environment for each part of the system.

### 1.1. Client (Vue.js)

-   **Prerequisites**:
    -   [Node.js](https://nodejs.org/) (v18 or higher)
    -   [Bun](https://bun.sh/) (v1.0 or higher)
-   **Setup**:
    1.  Navigate to the `client` directory: `cd client`
    2.  Install dependencies: `bun install`
    3.  Create a `.env` file based on `.env.example` and configure the environment variables.
    4.  Run the development server: `bun dev`

### 1.2. Contracts (Solidity)

-   **Prerequisites**:
    -   [Node.js](https://nodejs.org/) (v18 or higher)
    -   [Hardhat](https://hardhat.org/)
-   **Setup**:
    1.  Navigate to the `contracts` directory: `cd contracts`
    2.  Install dependencies: `npm install`
    3.  Create a `.env` file based on `.env.example` and configure the environment variables (e.g., `PRIVATE_KEY`, `SEPOLIA_RPC_URL`).
    4.  Compile the contracts: `npx hardhat compile`
    5.  Run the tests: `npx hardhat test`

### 1.3. Server (Bun)

-   **Prerequisites**:
    -   [Bun](https://bun.sh/) (v1.0 or higher)
-   **Setup**:
    1.  Navigate to the `server` directory: `cd server`
    2.  Install dependencies: `bun install`
    3.  Create a `.env` file based on `.env.example` and configure the environment variables (e.g., `DATABASE_URL`, `ONE_INCH_API_KEY`).
    4.  Run the development server: `bun run dev`

## 2. Parallel Development Plan

This section outlines how multiple agents can work on different parts of the system in parallel.

### 2.1. Frontend Development (Client)

-   **Agent 1: UI/UX Development**
    -   **Task**: Implement and style the UI components based on the design mockups.
    -   **Files**: `client/src/components/*.vue`, `client/src/views/*.vue`, `client/src/assets/*.css`
    -   **Checklist**:
        -   [ ] Implement `WalletConnect.vue`
        -   [ ] Implement `DepositForm.vue`
        -   [ ] Implement `XMBLPortfolio.vue`
        -   [ ] Implement `TransactionHistory.vue`
        -   [ ] Implement `Home.vue`
        -   [ ] Implement `Dashboard.vue`
-   **Agent 2: Frontend Logic and State Management**
    -   **Task**: Implement the frontend logic, state management, and interactions with the backend and smart contracts.
    -   **Files**: `client/src/stores/*.ts`, `client/src/services/*.ts`, `client/src/router/index.ts`
    -   **Checklist**:
        -   [ ] Implement `wallet.ts` store
        -   [ ] Implement `portfolio.ts` store
        -   [ ] Implement `protocol.ts` store
        -   [ ] Implement `transactions.ts` store
        -   [ ] Implement `web3Service.ts` for smart contract interactions
        -   [ ] Implement `apiService.ts` for backend interactions
        -   [ ] Configure the router in `router/index.ts`

### 2.2. Smart Contract Development (Contracts)

-   **Agent 3: Core Protocol Contracts**
    -   **Task**: Develop and test the core smart contracts of the protocol.
    -   **Files**: `contracts/contracts/XMBLVault.sol`, `contracts/contracts/XMBLToken.sol`
    -   **Checklist**:
        -   [ ] Implement `XMBLVault.sol` with deposit, withdrawal, and yield distribution logic.
        -   [ ] Implement `XMBLToken.sol` as an ERC-721 token with ERC-6551 support.
        -   [ ] Write comprehensive unit tests for `XMBLVault.sol` and `XMBLToken.sol`.
-   **Agent 4: Yield and Integration Contracts**
    -   **Task**: Develop and test the contracts for yield generation and integration with external protocols.
    -   **Files**: `contracts/contracts/YieldManager.sol`, `contracts/contracts/interfaces/*.sol`, `contracts/contracts/libraries/*.sol`
    -   **Checklist**:
        -   [ ] Implement `YieldManager.sol` for deploying funds to yield protocols.
        -   [ ] Implement interfaces for 1inch, Wormhole, and other external protocols.
        -   [ ] Implement helper libraries for interacting with external protocols.
        -   [ ] Write unit tests for `YieldManager.sol` and other integration contracts.

### 2.3. Backend Development (Server)

-   **Agent 5: API and Core Services**
    -   **Task**: Develop the backend API and core services for the protocol.
    -   **Files**: `server/src/api/*.ts`, `server/src/services/*.ts`
    -   **Checklist**:
        -   [ ] Implement the API routes and controllers.
        -   [ ] Implement `oneInchService.ts` for interacting with the 1inch API.
        -   [ ] Implement `bitcoinService.ts` for interacting with the Bitcoin network.
        -   [ ] Implement `yieldManagementService.ts` for managing yield strategies.
-   **Agent 6: Blockchain Monitoring and Data Processing**
    -   **Task**: Develop the services for monitoring the blockchain and processing events.
    -   **Files**: `server/src/services/blockchainMonitor.ts`, `server/src/services/profitDistributionService.ts`
    -   **Checklist**:
        -   [ ] Implement `blockchainMonitor.ts` to listen for on-chain events.
        -   [ ] Implement `profitDistributionService.ts` to calculate and distribute yields.
        -   [ ] Implement database schemas and utilities for storing and retrieving data.

## 3. Integration and Testing

-   **Task**: Once the individual components are developed, they need to be integrated and tested together.
-   **Checklist**:
    -   [ ] Deploy the smart contracts to a testnet.
    -   [ ] Configure the client and server to use the testnet contracts.
    -   [ ] Perform end-to-end testing of the entire system.
    -   [ ] Write integration tests for the smart contracts.
    -   [ ] Write integration tests for the client and server.

This plan allows for parallel development of the different parts of the system, while ensuring that the components can be integrated and tested together at the end. The use of checklists helps to track the progress of each agent and ensure that all the required functionalities are implemented.
