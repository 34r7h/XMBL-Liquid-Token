# Client Development Instructions

## Overview
This section contains comprehensive unit tests and detailed component specifications. Development follows Test-Driven Development (TDD) where **all tests already exist** and need implementations to make them pass. All Vue.js components and services exist with detailed comments but need actual implementations.

## Development Order (7 Steps)

### Step 1: Implement Core Service Layer
**Objective**: Make service tests pass - foundation for all other components
- [ ] Replace stub `src/services/web3Service.ts` with full blockchain interaction implementation:
  - [ ] `connectWallet()`, `disconnectWallet()` - Wallet connection management
  - [ ] Smart contract interactions (XMBLVault, XMBLToken calls)
  - [ ] ERC-6551 Token Bound Account operations (`getTBAAddress()`, `executeTBATransaction()`)
  - [ ] Network switching and error handling (`switchNetwork()`)
  - [ ] Gas estimation and transaction signing (`estimateGas()`)
  - [ ] Event listening and real-time updates
- [ ] Replace stub `src/services/apiService.ts` with HTTP client implementation:
  - [ ] RESTful API interactions with server (`getPortfolioData()`, `getTransactionHistory()`)
  - [ ] Authentication and token management
  - [ ] Request/response interceptors and caching
  - [ ] Error handling and retry logic
- [ ] Run service tests:
  - [ ] `bun test src/__tests__/services/web3Service.test.ts`
  - [ ] `bun test src/__tests__/services/apiService.test.ts`
- [ ] **Progress Update**: Mark "Core services implementation completed" in progress.md

### Step 2: Implement Pinia Store Layer  
**Objective**: Make store tests pass - state management foundation
- [ ] Replace stub `src/stores/wallet.ts` with full wallet state management:
  - [ ] Connection state tracking (`isConnected`, `account`, `chainId`)
  - [ ] Balance management and NFT loading (`loadXMBLNFTs()`)
  - [ ] Network detection and switching
  - [ ] Transaction status tracking
- [ ] Replace stub `src/stores/protocol.ts` with protocol state implementation:
  - [ ] Bonding curve calculations (`estimateXMBLOutput()`)
  - [ ] Token price updates and supported tokens list
  - [ ] Protocol statistics tracking (`fetchProtocolStats()`)
  - [ ] WebSocket real-time data and emergency pause functionality
- [ ] Replace stub `src/stores/portfolio.ts` with portfolio management:
  - [ ] NFT portfolio tracking (`fetchPortfolioData()`)
  - [ ] Value calculations and analytics
  - [ ] Yield earnings and claiming (`claimYields()`)
- [ ] Replace stub `src/stores/transactions.ts` with transaction management:
  - [ ] Transaction tracking and history (`loadTransactionHistory()`)
  - [ ] Real-time transaction updates and filtering
- [ ] Run store tests:
  - [ ] `bun test src/__tests__/stores/wallet.test.ts`
  - [ ] `bun test src/__tests__/stores/protocol.test.ts`
  - [ ] `bun test src/__tests__/stores/portfolio.test.ts`
  - [ ] `bun test src/__tests__/stores/transactions.test.ts`
- [ ] **Progress Update**: Mark "Pinia stores implementation completed" in progress.md

### Step 3: Implement WalletConnect Component
**Objective**: Make WalletConnect.test.ts tests pass (wallet integration foundation)
- [ ] Replace stub `src/components/WalletConnect.vue` with full component:
  - [ ] Multiple wallet provider support (MetaMask, WalletConnect, etc.)
  - [ ] Connection state management UI
  - [ ] Network switching interface
  - [ ] Account change handling and security warnings
  - [ ] Mobile wallet integration and QR code connections
- [ ] Add responsive design and accessibility features
- [ ] Implement proper error handling and user feedback
- [ ] Run `bun test src/__tests__/components/WalletConnect.test.ts`
- [ ] **Progress Update**: Mark "WalletConnect component completed" in progress.md

### Step 4: Implement DepositForm Component
**Objective**: Make DepositForm.test.ts tests pass (main user interaction - 637 lines of tests)
- [ ] Replace stub `src/components/DepositForm.vue` with full implementation:
  - [ ] Form validation and user input handling
  - [ ] Token selection dropdown with supported tokens
  - [ ] Amount validation (min/max limits) and balance checking
  - [ ] XMBL output estimation with bonding curve (`calculateNFTValue()`)
  - [ ] Transaction submission and status tracking
  - [ ] Gas fee calculation and display
  - [ ] Network compatibility checks and accessibility features
- [ ] Add loading states, transaction progress indicators, and confirmation modals
- [ ] Run `bun test src/__tests__/components/DepositForm.test.ts`
- [ ] **Progress Update**: Mark "DepositForm component completed" in progress.md

### Step 5: Implement Portfolio and Transaction Components
**Objective**: Complete data display components
- [ ] Replace stub `src/components/XMBLPortfolio.vue` with portfolio visualization:
  - [ ] NFT portfolio display and management
  - [ ] Individual NFT details and Token Bound Account assets
  - [ ] Value tracking, performance analytics, and yield earnings
  - [ ] Portfolio performance charts and asset allocation
- [ ] Replace stub `src/components/TransactionHistory.vue` with transaction management:
  - [ ] Transaction display, filtering, and search functionality
  - [ ] Sorting, pagination, and real-time updates
  - [ ] Export functionality (CSV/JSON) and mobile responsive design
- [ ] Run component tests:
  - [ ] `bun test src/__tests__/components/XMBLPortfolio.test.ts`
  - [ ] `bun test src/__tests__/components/TransactionHistory.test.ts`
- [ ] **Progress Update**: Mark "Portfolio and transaction components completed" in progress.md

### Step 6: Implement Application Views
**Objective**: Make view tests pass - main application screens
- [ ] Replace stub `src/views/Home.vue` with landing page:
  - [ ] Hero section with protocol introduction
  - [ ] Feature explanations, protocol statistics, and security features
  - [ ] FAQ section with expandable items and footer
- [ ] Replace stub `src/views/Dashboard.vue` with main app interface:
  - [ ] Component composition and layout
  - [ ] Real-time data updates and responsive grid layout
  - [ ] Navigation, routing, and loading states
- [ ] Complete routing setup in `src/router/index.ts`
- [ ] Run view tests:
  - [ ] `bun test src/__tests__/views/Home.test.ts`
  - [ ] `bun test src/__tests__/views/Dashboard.test.ts`
- [ ] **Progress Update**: Mark "Application views completed" in progress.md

### Step 7: Configuration and Production Build
**Objective**: Complete infrastructure and ensure production readiness
- [ ] Complete `src/config/contracts.ts` with contract addresses and ABIs
- [ ] Complete `src/types/ethereum.d.ts` with proper TypeScript definitions
- [ ] Run complete test suite: `bun test`
- [ ] Fix any remaining test failures
- [ ] Verify production build: `bun run build`
- [ ] Test production build locally: `bun run preview`
- [ ] Add SEO optimization and error tracking
- [ ] **Final Progress Update**: Mark "Frontend fully implemented and production-ready" in progress.md

## Key Implementation Notes
- **All component files exist** with detailed comment specifications - replace stub implementations
- **All test files exist** with comprehensive test cases - make them pass
- **All store files exist** with detailed interfaces - implement the exact functions expected by tests
- **Service layer must be implemented first** - components depend on services and stores

## Component Dependencies
1. **Services Layer** ← Foundation (web3Service.ts, apiService.ts)
2. **Pinia Stores** ← State management (wallet.ts, protocol.ts, portfolio.ts, transactions.ts)
3. **WalletConnect** ← Required by all other components
4. **DepositForm** ← Main user interaction (637 lines of tests)
5. **Portfolio & History** ← Data display components
6. **Views** ← Layout components that compose others

## Testing Strategy
- **Service-First**: Implement services before components that depend on them
- **Store-Second**: Implement state management before UI components  
- **Component-by-Component**: Build and test components independently
- **Mock Strategy**: Use existing test mocks for blockchain and API interactions

## Success Criteria
- [ ] All component tests passing: `bun test` shows 100% success
- [ ] Application builds successfully for production
- [ ] All user flows work end-to-end in browser
- [ ] Responsive design functional on mobile and desktop
- [ ] Ready for integration with backend services and smart contracts