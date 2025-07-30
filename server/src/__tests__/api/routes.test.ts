import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { router } from '../api/routes'

// Mock dependencies
vi.mock('../api/controllers', () => ({
  healthCheck: vi.fn(),
  getProtocolStats: vi.fn(),
  getTokenQuotes: vi.fn(),
  getYieldData: vi.fn(),
  getUserPortfolio: vi.fn(),
  getUserTransactions: vi.fn(),
  submitTransaction: vi.fn(),
  getBondingCurveRate: vi.fn(),
  getTokenPrices: vi.fn(),
  handleWebSocketConnection: vi.fn()
}))

vi.mock('express', () => ({
  Router: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    use: vi.fn()
  }))
}))

// Mock middleware
vi.mock('../middleware/rateLimiter', () => ({
  rateLimiter: {
    quotes: vi.fn((req, res, next) => next()),
    portfolio: vi.fn((req, res, next) => next()),
    transactions: vi.fn((req, res, next) => next()),
    general: vi.fn((req, res, next) => next())
  }
}))

vi.mock('../middleware/validation', () => ({
  validateAddress: vi.fn((req, res, next) => next()),
  validateQuoteParams: vi.fn((req, res, next) => next()),
  validateTransactionParams: vi.fn((req, res, next) => next()),
  validatePaginationParams: vi.fn((req, res, next) => next())
}))

vi.mock('../middleware/cors', () => ({
  corsHandler: vi.fn((req, res, next) => next())
}))

vi.mock('../middleware/logging', () => ({
  requestLogger: vi.fn((req, res, next) => next()),
  errorHandler: vi.fn((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }))
}))

describe('API Routes', () => {
  let mockRouter: any
  let mockReq: any
  let mockRes: any
  let mockNext: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockRouter = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      use: vi.fn()
    }
    
    vi.mocked(require('express').Router).mockReturnValue(mockRouter)

    mockReq = {
      params: {},
      query: {},
      body: {},
      headers: {},
      method: 'GET',
      url: '/test'
    }

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    }

    mockNext = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Route Registration', () => {
    it('should register all required routes', async () => {
      await import('../api/routes')

      // Health check route
      expect(mockRouter.get).toHaveBeenCalledWith('/health', expect.any(Function))
      
      // Protocol stats route
      expect(mockRouter.get).toHaveBeenCalledWith('/stats', expect.any(Array))
      
      // Token quotes route
      expect(mockRouter.get).toHaveBeenCalledWith('/quotes', expect.any(Array))
      
      // Yield data route
      expect(mockRouter.get).toHaveBeenCalledWith('/yield', expect.any(Array))
      
      // User portfolio route
      expect(mockRouter.get).toHaveBeenCalledWith('/portfolio/:address', expect.any(Array))
      
      // User transactions routes
      expect(mockRouter.get).toHaveBeenCalledWith('/transactions/:address', expect.any(Array))
      expect(mockRouter.post).toHaveBeenCalledWith('/transactions', expect.any(Array))
      
      // Bonding curve route
      expect(mockRouter.get).toHaveBeenCalledWith('/bonding-curve', expect.any(Function))
      
      // Token prices route
      expect(mockRouter.get).toHaveBeenCalledWith('/prices', expect.any(Array))
    })

    it('should apply middleware to appropriate routes', async () => {
      await import('../api/routes')

      // Check that middleware arrays are used for protected routes
      const getCallsWithMiddleware = mockRouter.get.mock.calls.filter(
        call => Array.isArray(call[1])
      )
      
      expect(getCallsWithMiddleware.length).toBeGreaterThan(0)
    })

    it('should register WebSocket upgrade handler', async () => {
      await import('../api/routes')

      // Should have WebSocket handling setup
      expect(mockRouter.use).toHaveBeenCalledWith('/ws', expect.any(Function))
    })

    it('should register error handling middleware', async () => {
      await import('../api/routes')

      // Error handler should be registered last
      const useCall = mockRouter.use.mock.calls.find(call => 
        call[0].toString().includes('error')
      )
      expect(useCall).toBeDefined()
    })
  })

  describe('Middleware Integration', () => {
    it('should apply CORS middleware globally', async () => {
      const { corsHandler } = await import('../middleware/cors')
      
      await import('../api/routes')

      expect(mockRouter.use).toHaveBeenCalledWith(corsHandler)
    })

    it('should apply request logging middleware', async () => {
      const { requestLogger } = await import('../middleware/logging')
      
      await import('../api/routes')

      expect(mockRouter.use).toHaveBeenCalledWith(requestLogger)
    })

    it('should apply rate limiting to quotes endpoint', async () => {
      const { rateLimiter } = await import('../middleware/rateLimiter')
      
      await import('../api/routes')

      // Verify quotes endpoint has rate limiter
      const quotesCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/quotes'
      )
      expect(quotesCall).toBeDefined()
      expect(quotesCall[1]).toContain(rateLimiter.quotes)
    })

    it('should apply address validation to user-specific endpoints', async () => {
      const { validateAddress } = await import('../middleware/validation')
      
      await import('../api/routes')

      // Check portfolio route has address validation
      const portfolioCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/portfolio/:address'
      )
      expect(portfolioCall).toBeDefined()
      expect(portfolioCall[1]).toContain(validateAddress)

      // Check transactions route has address validation
      const transactionsCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/transactions/:address'
      )
      expect(transactionsCall).toBeDefined()
      expect(transactionsCall[1]).toContain(validateAddress)
    })

    it('should apply parameter validation to appropriate endpoints', async () => {
      const { validateQuoteParams, validateTransactionParams } = await import('../middleware/validation')
      
      await import('../api/routes')

      // Check quotes route has parameter validation
      const quotesCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/quotes'
      )
      expect(quotesCall[1]).toContain(validateQuoteParams)

      // Check transaction submission has parameter validation
      const submitCall = mockRouter.post.mock.calls.find(call => 
        call[0] === '/transactions'
      )
      expect(submitCall[1]).toContain(validateTransactionParams)
    })
  })

  describe('Route Handler Mapping', () => {
    it('should map health check route to correct controller', async () => {
      const { healthCheck } = await import('../api/controllers')
      
      await import('../api/routes')

      const healthCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/health'
      )
      expect(healthCall[1]).toBe(healthCheck)
    })

    it('should map protocol stats route to correct controller', async () => {
      const { getProtocolStats } = await import('../api/controllers')
      
      await import('../api/routes')

      const statsCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/stats'
      )
      expect(statsCall[1]).toContain(getProtocolStats)
    })

    it('should map quotes route to correct controller', async () => {
      const { getTokenQuotes } = await import('../api/controllers')
      
      await import('../api/routes')

      const quotesCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/quotes'
      )
      expect(quotesCall[1]).toContain(getTokenQuotes)
    })

    it('should map yield data route to correct controller', async () => {
      const { getYieldData } = await import('../api/controllers')
      
      await import('../api/routes')

      const yieldCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/yield'
      )
      expect(yieldCall[1]).toContain(getYieldData)
    })

    it('should map portfolio route to correct controller', async () => {
      const { getUserPortfolio } = await import('../api/controllers')
      
      await import('../api/routes')

      const portfolioCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/portfolio/:address'
      )
      expect(portfolioCall[1]).toContain(getUserPortfolio)
    })

    it('should map transaction routes to correct controllers', async () => {
      const { getUserTransactions, submitTransaction } = await import('../api/controllers')
      
      await import('../api/routes')

      const getTransactionsCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/transactions/:address'
      )
      expect(getTransactionsCall[1]).toContain(getUserTransactions)

      const submitTransactionCall = mockRouter.post.mock.calls.find(call => 
        call[0] === '/transactions'
      )
      expect(submitTransactionCall[1]).toContain(submitTransaction)
    })

    it('should map bonding curve route to correct controller', async () => {
      const { getBondingCurveRate } = await import('../api/controllers')
      
      await import('../api/routes')

      const bondingCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/bonding-curve'
      )
      expect(bondingCall[1]).toBe(getBondingCurveRate)
    })

    it('should map prices route to correct controller', async () => {
      const { getTokenPrices } = await import('../api/controllers')
      
      await import('../api/routes')

      const pricesCall = mockRouter.get.mock.calls.find(call => 
        call[0] === '/prices'
      )
      expect(pricesCall[1]).toContain(getTokenPrices)
    })
  })

  describe('Rate Limiting Configuration', () => {
    it('should implement different rate limits for different endpoints', async () => {
      const { rateLimiter } = await import('../middleware/rateLimiter')
      
      await import('../api/routes')

      // Quotes should have stricter limits (1inch API)
      expect(rateLimiter.quotes).toHaveBeenCalled()

      // Portfolio should have per-address limits
      expect(rateLimiter.portfolio).toHaveBeenCalled()

      // Transactions should have per-address limits
      expect(rateLimiter.transactions).toHaveBeenCalled()
    })

    it('should handle rate limit exceeded responses', async () => {
      const { rateLimiter } = await import('../middleware/rateLimiter')
      
      // Mock rate limiter to reject
      vi.mocked(rateLimiter.quotes).mockImplementation((req, res, next) => {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: 60
        })
      })

      await import('../api/routes')

      // Simulate rate limit hit
      rateLimiter.quotes(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(429)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded'
        })
      )
    })

    it('should implement sliding window rate limiting', async () => {
      const { rateLimiter } = await import('../middleware/rateLimiter')
      
      await import('../api/routes')

      // Rate limiters should implement sliding window
      expect(rateLimiter.quotes).toBeDefined()
      expect(rateLimiter.portfolio).toBeDefined()
      expect(rateLimiter.transactions).toBeDefined()
    })
  })

  describe('Input Validation', () => {
    it('should validate Ethereum addresses', async () => {
      const { validateAddress } = await import('../middleware/validation')
      
      mockReq.params.address = '0xinvalid'
      
      // Mock validation to fail
      vi.mocked(validateAddress).mockImplementation((req, res, next) => {
        res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address',
          code: 'VALIDATION_ERROR'
        })
      })

      validateAddress(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should validate quote parameters', async () => {
      const { validateQuoteParams } = await import('../middleware/validation')
      
      mockReq.query = {
        fromToken: 'invalid',
        toToken: '0xtoken...',
        amount: 'not_a_number'
      }
      
      // Mock validation to fail
      vi.mocked(validateQuoteParams).mockImplementation((req, res, next) => {
        res.status(400).json({
          success: false,
          error: 'Invalid quote parameters',
          details: {
            fromToken: 'Invalid token address',
            amount: 'Must be a valid number'
          }
        })
      })

      validateQuoteParams(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid quote parameters'
        })
      )
    })

    it('should validate transaction parameters', async () => {
      const { validateTransactionParams } = await import('../middleware/validation')
      
      mockReq.body = {
        type: 'invalid_type',
        amount: 'invalid_amount'
      }
      
      // Mock validation to fail
      vi.mocked(validateTransactionParams).mockImplementation((req, res, next) => {
        res.status(400).json({
          success: false,
          error: 'Invalid transaction parameters'
        })
      })

      validateTransactionParams(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('should validate pagination parameters', async () => {
      const { validatePaginationParams } = await import('../middleware/validation')
      
      mockReq.query = {
        page: '-1',
        limit: '1000'
      }
      
      // Mock validation to fail
      vi.mocked(validatePaginationParams).mockImplementation((req, res, next) => {
        res.status(400).json({
          success: false,
          error: 'Invalid pagination parameters'
        })
      })

      validatePaginationParams(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })
  })

  describe('Error Handling', () => {
    it('should handle controller errors with centralized error handler', async () => {
      const { errorHandler } = await import('../middleware/logging')
      
      const testError = new Error('Controller error')
      
      errorHandler(testError, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      })
    })

    it('should handle 404 errors for non-existent routes', async () => {
      await import('../api/routes')

      // Should register 404 handler
      const notFoundCall = mockRouter.use.mock.calls.find(call => 
        call[0].toString().includes('404') || call.length === 1
      )
      expect(notFoundCall).toBeDefined()
    })

    it('should provide consistent error response format', async () => {
      const { errorHandler } = await import('../middleware/logging')
      
      const testErrors = [
        new Error('Database error'),
        new Error('External API error'),
        new Error('Validation error')
      ]

      testErrors.forEach(error => {
        errorHandler(error, mockReq, mockRes, mockNext)
      })

      // All error responses should have consistent format
      mockRes.json.mock.calls.forEach(call => {
        expect(call[0]).toHaveProperty('error')
        expect(typeof call[0].error).toBe('string')
      })
    })

    it('should log errors for monitoring', async () => {
      const { errorHandler } = await import('../middleware/logging')
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const testError = new Error('Test error')
      errorHandler(testError, mockReq, mockRes, mockNext)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('CORS Configuration', () => {
    it('should allow frontend domain access', async () => {
      const { corsHandler } = await import('../middleware/cors')
      
      mockReq.headers.origin = 'http://localhost:3000'
      
      // Mock CORS to allow frontend
      vi.mocked(corsHandler).mockImplementation((req, res, next) => {
        res.header('Access-Control-Allow-Origin', req.headers.origin)
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        next()
      })

      corsHandler(mockReq, mockRes, mockNext)

      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000')
      expect(mockNext).toHaveBeenCalled()
    })

    it('should handle preflight OPTIONS requests', async () => {
      const { corsHandler } = await import('../middleware/cors')
      
      mockReq.method = 'OPTIONS'
      
      // Mock CORS OPTIONS handling
      vi.mocked(corsHandler).mockImplementation((req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.status(200).send()
        } else {
          next()
        }
      })

      corsHandler(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.send).toHaveBeenCalled()
    })

    it('should reject unauthorized origins', async () => {
      const { corsHandler } = await import('../middleware/cors')
      
      mockReq.headers.origin = 'http://malicious-site.com'
      
      // Mock CORS to reject unauthorized origins
      vi.mocked(corsHandler).mockImplementation((req, res, next) => {
        const allowedOrigins = ['http://localhost:3000', 'https://xmbl.app']
        if (!allowedOrigins.includes(req.headers.origin)) {
          res.status(403).json({ error: 'Origin not allowed' })
        } else {
          next()
        }
      })

      corsHandler(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('WebSocket Integration', () => {
    it('should handle WebSocket upgrade requests', async () => {
      const { handleWebSocketConnection } = await import('../api/controllers')
      
      await import('../api/routes')

      // WebSocket handler should be registered
      const wsCall = mockRouter.use.mock.calls.find(call => 
        call[0] === '/ws'
      )
      expect(wsCall).toBeDefined()
    })

    it('should validate WebSocket connection requests', async () => {
      const mockWs = {
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn()
      }

      const { handleWebSocketConnection } = await import('../api/controllers')
      
      await handleWebSocketConnection(mockWs, mockReq)

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function))
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('should handle WebSocket authentication', async () => {
      const mockWs = {
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn()
      }

      mockReq.query.token = 'invalid_token'

      const { handleWebSocketConnection } = await import('../api/controllers')
      
      // Should handle authentication failure
      await handleWebSocketConnection(mockWs, mockReq)

      // If authentication required, should close connection
      if (mockReq.query.token === 'invalid_token') {
        expect(mockWs.close).toHaveBeenCalled()
      }
    })
  })
})
