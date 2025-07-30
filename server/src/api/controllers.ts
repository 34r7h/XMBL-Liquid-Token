/**
 * controllers.ts
 * 
 * PURPOSE:
 * HTTP request handlers that implement business logic for API endpoints,
 * coordinating between services and providing responses to frontend clients.
 * 
 * EXPECTED CONTROLLER FUNCTIONS:
 * - healthCheck(req, res): Response - System health status
 * - getProtocolStats(req, res): Response - TVL, users, APY statistics
 * - getTokenQuotes(req, res): Response - 1inch swap quotes
 * - getYieldData(req, res): Response - Current yield information
 * - getUserPortfolio(req, res): Response - User portfolio data
 * - getUserTransactions(req, res): Response - User transaction history
 * - submitTransaction(req, res): Response - Process transaction submission
 * - getBondingCurveRate(req, res): Response - Current bonding curve rate
 * - getTokenPrices(req, res): Response - Current token prices
 * - handleWebSocketConnection(ws, req): void - WebSocket connection handler
 * 
 * REQUEST VALIDATION:
 * - Parameter validation using schema validation library
 * - Ethereum address validation for user-specific endpoints
 * - Token address validation for swap quotes
 * - Amount validation for numeric inputs
 * - Pagination validation for transaction history
 * 
 * RESPONSE FORMATS:
 * - Success: { success: true, data: T, message?: string }
 * - Error: { success: false, error: string, code?: number }
 * - Consistent JSON structure across all endpoints
 * - Proper HTTP status codes
 * 
 * REQUIREMENTS:
 * - Must handle all possible error cases gracefully
 * - Must validate all inputs before processing
 * - Must implement proper pagination for large datasets
 * - Must provide meaningful error messages
 * - Must log all errors for debugging
 * - Must implement caching for frequently requested data
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - routes.ts - Route definitions that call these controllers
 * - oneInchService.ts - For token swap quote endpoints
 * - yieldManagementService.ts - For yield data endpoints
 * - blockchainMonitor.ts - For transaction history endpoints
 * - profitDistributionService.ts - For portfolio data endpoints
 * - bitcoinService.ts - For Bitcoin-related data endpoints
 * - client/src/services/apiService.ts - Frontend API consumer
 * 
 * SERVICE INTEGRATIONS:
 * - oneInchService.getQuote() - For /quotes endpoint
 * - yieldManagementService.getCurrentYield() - For /yield endpoint
 * - blockchainMonitor.getTransactionHistory() - For /transactions endpoint
 * - profitDistributionService.getUserPortfolio() - For /portfolio endpoint
 * 
 * ERROR HANDLING:
 * - Try-catch blocks around all service calls
 * - Specific error types for different failure modes
 * - External service timeout handling
 * - Database connection error handling
 * - Validation error formatting
 * 
 * CACHING STRATEGY:
 * - Protocol stats: Cache for 5 minutes
 * - Token prices: Cache for 1 minute
 * - Yield data: Cache for 10 minutes
 * - User portfolio: Cache for 30 seconds
 * - User transactions: Cache for 1 minute
 * 
 * WEBSOCKET EVENTS:
 * - portfolio_update - When user portfolio changes
 * - transaction_confirmed - When user transaction confirms
 * - yield_distributed - When yields are distributed
 * - protocol_stats_updated - When protocol stats change
 */
