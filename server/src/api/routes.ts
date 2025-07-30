/**
 * routes.ts
 * 
 * PURPOSE:
 * Defines HTTP API route structure and mappings to controller functions
 * for the XMBL protocol backend services.
 * 
 * EXPECTED ROUTE STRUCTURE:
 * - Express Router or Bun-compatible routing
 * - RESTful API design principles
 * - Middleware integration for authentication, validation, rate limiting
 * - Error handling middleware
 * 
 * API ROUTES DEFINED:
 * - GET /health - Health check endpoint
 * - GET /stats - Protocol statistics (TVL, users, APY)
 * - GET /quotes - Token swap quotes from 1inch
 *   Query params: fromToken, toToken, amount
 * - GET /yield - Current yield data and APY information
 * - GET /portfolio/:address - User portfolio aggregated data
 * - GET /transactions/:address - User transaction history
 * - POST /transactions - Submit transaction for processing
 * - GET /bonding-curve - Current XMBL bonding curve rate
 * - GET /prices - Token price data
 * - WebSocket /ws - Real-time updates
 * 
 * MIDDLEWARE APPLIED:
 * - CORS - Cross-origin resource sharing
 * - Rate limiting - Prevent API abuse
 * - Request validation - Schema validation for inputs
 * - Authentication - JWT or signature-based (if required)
 * - Logging - Request/response logging
 * - Error handling - Centralized error responses
 * 
 * REQUIREMENTS:
 * - Must implement proper HTTP status codes
 * - Must validate all input parameters
 * - Must implement rate limiting per endpoint
 * - Must provide consistent error response format
 * - Must support CORS for frontend access
 * - Must log all API requests for monitoring
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - controllers.ts - Route handler implementations
 * - app.ts - Router registration and middleware setup
 * - client/src/services/apiService.ts - Frontend consumer
 * - oneInchService.ts - 1inch quote endpoints
 * - yieldManagementService.ts - Yield data endpoints
 * - blockchainMonitor.ts - Transaction history endpoints
 * - profitDistributionService.ts - Portfolio data endpoints
 * 
 * AUTHENTICATION:
 * - Public endpoints: /health, /stats, /quotes, /yield, /prices
 * - Address-specific endpoints: Validate address ownership (optional)
 * - Admin endpoints: Require admin authentication (if any)
 * 
 * RATE LIMITING:
 * - /quotes: 60 requests per minute (1inch API limits)
 * - /portfolio/:address: 30 requests per minute per address
 * - /transactions/:address: 20 requests per minute per address
 * - General: 100 requests per minute per IP
 * 
 * ERROR RESPONSES:
 * - 400 Bad Request - Invalid parameters
 * - 404 Not Found - Resource not found
 * - 429 Too Many Requests - Rate limit exceeded
 * - 500 Internal Server Error - Server errors
 * - 503 Service Unavailable - External service errors
 */
