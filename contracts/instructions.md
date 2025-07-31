# Smart Contracts Development Instructions

## Overview
This section contains comprehensive unit tests and detailed comment specifications. Development follows Test-Driven Development (TDD) where **all tests already exist** and need implementations to make them pass. The contract files exist with detailed specifications but need actual implementations.

## Development Order (7 Steps)

### Step 1: Create Mock Contracts for Testing
**Objective**: Get test environment running with basic mock implementations
- [ ] Verify Hardhat setup works: `npx hardhat compile`
- [ ] Create mock contracts needed by tests:
  - [ ] `contracts/mocks/MockERC20.sol` (used extensively in tests)
  - [ ] `contracts/mocks/MockOneInchRouter.sol` (for OneInchHelper tests)  
  - [ ] `contracts/mocks/MockDeFiProtocol.sol` (for integration tests)
  - [ ] `contracts/mocks/MockERC6551Registry.sol` (ERC-6551 registry)
  - [ ] `contracts/mocks/TBAImplementation.sol` (Token Bound Account)
- [ ] Run test suite to verify mocks work: `npm test`
- [ ] **Progress Update**: Mark "Mock contracts created and tests running" in progress.md

### Step 2: Implement XMBLToken.sol (ERC-721 + ERC-6551)
**Objective**: Make XMBLToken.test.js tests pass
- [ ] Replace stub file with full ERC-721 implementation (name, symbol, minting)
- [ ] Add ERC-6551 integration (TBA creation on mint with `mintWithTBA()`)
- [ ] Implement access controls (MINTER_ROLE, admin functions)
- [ ] Add dividend distribution mechanisms from test requirements
- [ ] Add batch minting functionality (`batchMintWithTBA`)
- [ ] Add portfolio view functions (`getUserPortfolio`)
- [ ] Run `npx hardhat test test/unit/XMBLToken.test.js`
- [ ] **Progress Update**: Mark "XMBLToken implementation completed" in progress.md

### Step 3: Implement YieldManager.sol
**Objective**: Create yield generation system for vault operations
- [ ] Replace stub file with yield management logic
- [ ] Implement Compound/Aave integration stubs (basic interface compliance)
- [ ] Add yield calculation and distribution logic
- [ ] Implement security controls and pause mechanisms
- [ ] Add vault permission system for yield operations
- [ ] Run `npx hardhat test test/unit/YieldManager.test.js`
- [ ] **Progress Update**: Mark "YieldManager implementation completed" in progress.md

### Step 4: Implement XMBLVault.sol (Main Protocol Contract)
**Objective**: Make XMBLVault.test.js tests pass (main contract - 686 lines of tests)
- [ ] Replace stub file with complete vault implementation:
  - [ ] `deposit()` function for ETH and ERC-20 tokens
  - [ ] NFT minting with TBA creation on deposits
  - [ ] `withdraw()` function with TBA asset consolidation
  - [ ] Bonding curve calculations for XMBL pricing
  - [ ] `claimYields()` for dividend distribution
  - [ ] `executeTBATransaction()` for TBA operations
  - [ ] 1inch swap integration stubs
  - [ ] Emergency pause and admin controls
- [ ] Run `npx hardhat test test/unit/XMBLVault.test.js`
- [ ] **Progress Update**: Mark "XMBLVault implementation completed" in progress.md

### Step 5: Implement Cross-Chain and Integration Contracts
**Objective**: Complete remaining protocol contracts
- [ ] Implement `EthereumHTLC.sol` for Bitcoin bridging
- [ ] Implement `OneInchHelper.sol` library for swap utilities
- [ ] Create interface implementations:
  - [ ] `I1inchFusion.sol` interface contract
  - [ ] `ILimitOrderProtocol.sol` interface contract
  - [ ] `IWormholeBridge.sol` interface contract
- [ ] Run respective test files:
  - [ ] `npx hardhat test test/unit/EthereumHTLC.test.js`
  - [ ] `npx hardhat test test/unit/OneInchHelper.test.js`
  - [ ] `npx hardhat test test/unit/I1inchFusion.test.js`
  - [ ] `npx hardhat test test/unit/ILimitOrderProtocol.test.js`
  - [ ] `npx hardhat test test/unit/IWormholeBridge.test.js`
- [ ] **Progress Update**: Mark "Cross-chain and integration contracts completed" in progress.md

### Step 6: Implement Deployment Scripts
**Objective**: Create deployment infrastructure
- [ ] Replace stub `scripts/deploy.js` with actual deployment logic
- [ ] Create deployment sequence for all contracts
- [ ] Add network configuration and verification
- [ ] Create contract address export for frontend/backend
- [ ] Test deployment on local hardhat network
- [ ] **Progress Update**: Mark "Deployment scripts completed" in progress.md

### Step 7: Integration Testing and Production Preparation
**Objective**: Ensure all tests pass and contracts are deployment-ready
- [ ] Run complete test suite: `npm test`
- [ ] Fix any remaining test failures
- [ ] Optimize gas usage in contracts
- [ ] Add natspec documentation
- [ ] Prepare testnet deployment configuration
- [ ] Generate ABI files for frontend integration
- [ ] **Final Progress Update**: Mark "Smart contracts fully implemented and tested" in progress.md

## Key Implementation Notes
- **All contract files exist** with detailed comment specifications - replace stub implementations
- **All test files exist** with comprehensive test cases - make them pass
- **Mock contracts needed** for testing dependencies (ERC-6551, 1inch, etc.)
- **Focus on test-driven approach** - implement minimal code to pass each test

## Testing Strategy
- **Red-Green-Refactor**: Tests are written (Red), implement to pass (Green), then optimize (Refactor)
- **Test File Priorities**: XMBLVault.test.js (main protocol), XMBLToken.test.js (core NFT)
- **Coverage Target**: 100% test passage since all tests are pre-written

## Success Criteria  
- [ ] All 9 test files passing: `npm test` shows 100% success
- [ ] Contracts deploy successfully on local network
- [ ] Gas optimization completed
- [ ] Ready for testnet deployment and frontend integration