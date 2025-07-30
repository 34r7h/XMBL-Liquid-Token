/**
 * apiService.ts
 *
 * PURPOSE:
 * Provides HTTP client for communicating with the Bun backend server,
 * fetching data that's not directly available on-chain such as yield calculations,
 * historical data, and aggregated protocol statistics.
 *
 * EXPECTED CLASSES/INTERFACES:
 * - ApiService class - Main HTTP client service
 * - ApiResponse<T> interface - Standardized API response wrapper
 * - TokenQuote interface - 1inch swap quote data
 * - YieldData interface - Protocol yield information
 * - PortfolioData interface - User portfolio aggregated data
 * - TransactionHistory interface - Historical transaction data
 *
 * EXPECTED FUNCTIONS:
 * - getTokenQuote(fromToken: string, toToken: string, amount: string): Promise<TokenQuote> - Gets 1inch swap quotes
 * - getYieldData(): Promise<YieldData> - Gets current protocol yield information
 * - getUserPortfolio(address: string): Promise<PortfolioData> - Gets user's aggregated portfolio data
 * - getTransactionHistory(address: string): Promise<TransactionHistory[]> - Gets user's transaction history
 * - getProtocolStats(): Promise<ProtocolStats> - Gets overall protocol statistics
 * - getBondingCurveRate(): Promise<number> - Gets current XMBL bonding curve rate
 * - submitTransaction(txData: TransactionData): Promise<string> - Submits transaction for server processing
 * - getTokenPrices(tokens: string[]): Promise<TokenPrice[]> - Gets current token prices
 *
 * REQUIREMENTS:
 * - Must handle authentication if required
 * - Must provide proper error handling and retry logic
 * - Must cache frequently requested data
 * - Must support request timeouts and cancellation
 * - Must validate response data structure
 * - Must handle rate limiting from external APIs
 *
 * CONNECTED SYSTEM COMPONENTS:
 * - server/src/api/routes.ts - Calls backend API endpoints
 * - server/src/api/controllers.ts - Backend handlers for API requests
 * - DepositForm.vue - Uses for token quotes and bonding curve rates
 * - XMBLPortfolio.vue - Uses for yield data and portfolio information
 * - TransactionHistory.vue - Uses for historical transaction data
 * - Home.vue - Uses for protocol statistics display
 * - oneInchService.ts (server) - Backend service for swap quotes
 * - yieldManagementService.ts (server) - Backend service for yield data
 * - blockchainMonitor.ts (server) - Backend service for transaction indexing
 *
 * API ENDPOINTS CALLED:
 * - GET /api/quotes - Token swap quotes from 1inch
 * - GET /api/yield - Current yield data and APY
 * - GET /api/portfolio/:address - User portfolio data
 * - GET /api/transactions/:address - User transaction history
 * - GET /api/stats - Protocol statistics
 * - GET /api/bonding-curve - Current bonding curve rate
 * - POST /api/transactions - Submit transaction data
 * - GET /api/prices - Token price data
 *
 * EXTERNAL DEPENDENCIES:
 * - axios - For HTTP requests
 * - Backend Bun server - Source of API data
 */
