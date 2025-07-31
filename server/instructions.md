# Server Development Instructions

## Overview
This section contains comprehensive unit tests and detailed service specifications. Development follows Test-Driven Development (TDD) where **all tests already exist** and need implementations to make them pass. All service files exist with detailed comments but need actual implementations.

## Development Order (7 Steps)

### Step 1: Implement Core Application Structure
**Objective**: Make app.test.ts tests pass - basic server setup and initialization
- [ ] Replace stub `src/app.ts` with full Bun server implementation
- [ ] Add service initialization order (database → services → monitoring)
- [ ] Setup error handling middleware and global handlers
- [ ] Configure API route mounting and WebSocket setup
- [ ] Add graceful shutdown mechanisms
- [ ] Run `bun test src/__tests__/app.test.ts`
- [ ] **Progress Update**: Mark "Core app structure completed" in progress.md

### Step 2: Implement Bitcoin Service
**Objective**: Make bitcoinService.test.ts tests pass (634 lines of tests)
- [ ] Replace stub `src/services/bitcoinService.ts` with full implementation
- [ ] Add Bitcoin RPC client functionality and connection management
- [ ] Implement HTLC (Hash Time Locked Contract) operations:
  - [ ] `createHTLC()` - Create new time-locked contracts
  - [ ] `claimHTLC()` - Claim with secret reveal
  - [ ] `refundHTLC()` - Handle timelock expiration
- [ ] Add UTXO management and selection algorithms
- [ ] Implement transaction building and broadcasting
- [ ] Add fee estimation with multiple priority levels
- [ ] Implement address validation and format conversion
- [ ] Run `bun test src/__tests__/services/bitcoinService.test.ts`
- [ ] **Progress Update**: Mark "Bitcoin service implementation completed" in progress.md

### Step 3: Implement 1inch Service Integration
**Objective**: Make oneInchService.test.ts tests pass
- [ ] Replace stub `src/services/oneInchService.ts` with full implementation
- [ ] Add 1inch API client with authentication and rate limiting
- [ ] Implement Fusion+ order management:
  - [ ] `createFusionOrder()` - Create gasless orders
  - [ ] `getOrderStatus()` - Track order state
  - [ ] `cancelOrder()` - Order cancellation
- [ ] Add token swap quote generation (`getQuote()`)
- [ ] Implement fallback protocol handling (if 1inch unavailable)
- [ ] Add slippage protection mechanisms
- [ ] Add token allowance management (`getAllowance()`, `getTokenBalance()`)
- [ ] Run `bun test src/__tests__/services/oneInchService.test.ts`
- [ ] **Progress Update**: Mark "1inch service implementation completed" in progress.md

### Step 4: Implement Yield Management Service  
**Objective**: Make yieldManagementService.test.ts tests pass
- [ ] Replace stub `src/services/yieldManagementService.ts` with full implementation
- [ ] Add DeFi protocol integrations (Compound, Aave)
- [ ] Implement yield calculation algorithms and optimization
- [ ] Add automated yield distribution logic
- [ ] Implement yield optimization strategies (protocol selection)
- [ ] Add risk management and exposure limits
- [ ] Implement emergency withdrawal mechanisms
- [ ] Add performance tracking and reporting
- [ ] Run `bun test src/__tests__/services/yieldManagementService.test.ts`
- [ ] **Progress Update**: Mark "Yield management service completed" in progress.md

### Step 5: Implement Blockchain Monitor and Profit Distribution
**Objective**: Complete core services
- [ ] Replace stub `src/services/blockchainMonitor.ts` with WebSocket monitoring
- [ ] Add real-time event filtering and parsing for vault/NFT events
- [ ] Implement connection resilience and reconnection logic
- [ ] Replace stub `src/services/profitDistributionService.ts` with distribution logic
- [ ] Add fair profit distribution algorithms to NFT holders
- [ ] Implement gas-optimized batch distribution mechanisms
- [ ] Run respective tests:
  - [ ] `bun test src/__tests__/services/blockchainMonitor.test.ts`
  - [ ] `bun test src/__tests__/services/profitDistributionService.test.ts`
- [ ] **Progress Update**: Mark "Monitoring and distribution services completed" in progress.md

### Step 6: Implement API Controllers and Routes
**Objective**: Make controllers.test.ts and routes.test.ts tests pass
- [ ] Replace stub `src/api/controllers.ts` with full controller implementations:
  - [ ] Portfolio data endpoints (`/api/portfolio/:address`)
  - [ ] Transaction history endpoints (`/api/transactions/:address`)
  - [ ] Protocol statistics endpoints (`/api/stats`)
  - [ ] Bitcoin HTLC endpoints
  - [ ] Yield and profit endpoints (`/api/yield`)
  - [ ] Token quote endpoints (`/api/quotes`)
- [ ] Replace stub `src/api/routes.ts` with proper routing and middleware
- [ ] Add authentication, rate limiting, and security headers
- [ ] Implement request validation and error handling
- [ ] Run API-specific tests:
  - [ ] `bun test src/__tests__/api/controllers.test.ts`
  - [ ] `bun test src/__tests__/api/routes.test.ts`
- [ ] **Progress Update**: Mark "API layer implementation completed" in progress.md

### Step 7: Utilities and Production Readiness
**Objective**: Complete remaining implementations and ensure production readiness
- [ ] Implement `src/utils/secretGenerator.ts` for HTLC secrets
- [ ] Add any additional utility modules required by tests
- [ ] Complete any remaining service implementations
- [ ] Run complete test suite: `bun test`
- [ ] Fix any remaining test failures
- [ ] Add health check endpoints and monitoring
- [ ] Setup environment configurations (dev/staging/prod)
- [ ] **Final Progress Update**: Mark "Server fully implemented and production-ready" in progress.md

## Key Implementation Notes
- **All service files exist** with detailed comment specifications - replace TODO implementations
- **All test files exist** with comprehensive test cases - make them pass
- **Focus on service dependencies**: Bitcoin → 1inch → Yield Management → API layer
- **Service stubs have detailed interfaces** - follow the exact function signatures expected by tests

## Testing Strategy
- **Service-by-Service**: Implement and test each service independently using existing mocks
- **Mock External APIs**: Tests have mocks for Bitcoin RPC, 1inch API, etc.
- **Integration After Individual**: Test service interactions after individual implementation
- **Coverage Target**: All tests should pass since they're pre-written

## Success Criteria
- [ ] All service tests passing: `bun test` shows 100% success
- [ ] Server starts successfully with all services initialized
- [ ] All API endpoints functional and tested
- [ ] Production configurations verified
- [ ] Ready for frontend integration and deployment