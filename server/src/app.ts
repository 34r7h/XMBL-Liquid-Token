/**
 * app.ts
 * 
 * PURPOSE:
 * Main entry point for the Bun backend application that orchestrates all services,
 * sets up API routes, and manages the off-chain logic for the XMBL protocol.
 * 
 * EXPECTED FUNCTIONALITY:
 * - HTTP server setup with Express-like routing
 * - Service initialization and dependency injection
 * - WebSocket connections for real-time updates
 * - Background task scheduling for yield management
 * - Error handling and logging middleware
 * - CORS configuration for frontend connections
 * 
 * EXPECTED FUNCTIONS:
 * - initializeApp(): Promise<void> - Sets up application and dependencies
 * - setupRoutes(): void - Configures API route handlers
 * - setupMiddleware(): void - Configures express middleware
 * - startBackgroundServices(): Promise<void> - Starts monitoring and yield services
 * - setupWebSocket(): void - Configures WebSocket for real-time updates
 * - gracefulShutdown(signal: string): Promise<void> - Handles app shutdown
 * 
 * SERVICES INITIALIZED:
 * - oneInchService - 1inch API integration for swaps
 * - bitcoinService - Bitcoin network interactions
 * - yieldManagementService - Automated yield generation
 * - blockchainMonitor - Event listening and indexing
 * - profitDistributionService - Dividend calculations and distribution
 * 
 * REQUIREMENTS:
 * - Must initialize all protocol services on startup
 * - Must handle environment variable validation
 * - Must provide health check endpoints
 * - Must implement rate limiting for API endpoints
 * - Must log all critical operations and errors
 * - Must support graceful shutdown with cleanup
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - routes.ts - API route definitions
 * - controllers.ts - HTTP request handlers
 * - oneInchService.ts - 1inch integration service
 * - bitcoinService.ts - Bitcoin network service
 * - yieldManagementService.ts - Yield management automation
 * - blockchainMonitor.ts - Blockchain event monitoring
 * - profitDistributionService.ts - Profit distribution logic
 * - client/src/services/apiService.ts - Frontend API client
 * 
 * API ENDPOINTS SERVED:
 * - GET /api/health - Health check
 * - GET /api/stats - Protocol statistics
 * - GET /api/quotes - Token swap quotes
 * - GET /api/yield - Yield data
 * - GET /api/portfolio/:address - User portfolio
 * - GET /api/transactions/:address - Transaction history
 * - POST /api/transactions - Submit transaction
 * - WebSocket /ws - Real-time updates
 * 
 * BACKGROUND SERVICES:
 * - Blockchain event monitoring (continuous)
 * - Yield harvesting (scheduled intervals)
 * - Profit distribution (weekly/monthly)
 * - 1inch order status monitoring
 * - Bitcoin transaction confirmation monitoring
 * 
 * ENVIRONMENT DEPENDENCIES:
 * - PORT - Server port (default 3000)
 * - NODE_ENV - Environment (development/production)
 * - DATABASE_URL - Database connection (if used)
 * - All service-specific environment variables
 */
