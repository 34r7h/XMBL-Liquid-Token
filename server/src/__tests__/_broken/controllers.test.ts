import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  healthCheck,
  getProtocolStats,
  getTokenQuotes,
  getYieldData,
  getUserPortfolio,
  getUserTransactions,
  submitTransaction,
  getBondingCurveRate,
  getTokenPrices,
  handleWebSocketConnection
} from '../api/controllers'

// Mock dependencies
vi.mock('../services/oneInchService', () => ({
  oneInchService: {
    getQuote: vi.fn(),
    executeSwap: vi.fn(),
    getTokenList: vi.fn()
  }
}))

vi.mock('../services/yieldManagementService', () => ({
  yieldManagementService: {
    getCurrentYield: vi.fn(),
    getActivePositions: vi.fn(),
    getPerformanceMetrics: vi.fn()
  }
}))

vi.mock('../services/blockchainMonitor', () => ({
  blockchainMonitor: {
    getTransactionHistory: vi.fn(),
    getHealthStatus: vi.fn()
  }
}))

vi.mock('../services/profitDistributionService', () => ({
  profitDistributionService: {
    getUserPortfolio: vi.fn(),
    getDistributionHistory: vi.fn()
  }
}))

vi.mock('../services/bitcoinService', () => ({
  bitcoinService: {
    getBTCPrice: vi.fn(),
    getNetworkStats: vi.fn()
  }
}))

vi.mock('../utils/database', () => ({
  database: {
    query: vi.fn(),
    insert: vi.fn(),
    healthCheck: vi.fn()
  }
}))

describe('API Controllers', () => {
  let mockReq: any
  let mockRes: any
  let mockWs: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockReq = {
      params: {},
      query: {},
      body: {},
      headers: {}
    }

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    }

    mockWs = {
      send: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
      readyState: 1 // OPEN
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Health Check Controller', () => {
    it('should return healthy status when all services are operational', async () => {
      const { database } = await import('../utils/database')
      const { blockchainMonitor } = await import('../services/blockchainMonitor')
      
      vi.mocked(database.healthCheck).mockResolvedValue({ status: 'healthy' })
      vi.mocked(blockchainMonitor.getHealthStatus).mockResolvedValue({ isHealthy: true })

      await healthCheck(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'healthy',
          timestamp: expect.any(String),
          services: {
            database: 'healthy',
            blockchain: 'healthy',
            external_apis: expect.any(String)
          },
          uptime: expect.any(Number)
        }
      })
    })

    it('should return unhealthy status when services fail', async () => {
      const { database } = await import('../utils/database')
      vi.mocked(database.healthCheck).mockRejectedValue(new Error('Database connection failed'))

      await healthCheck(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(503)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Service unavailable',
        data: {
          status: 'unhealthy',
          issues: expect.arrayContaining(['database'])
        }
      })
    })

    it('should include system metrics in health check', async () => {
      const { database } = await import('../utils/database')
      vi.mocked(database.healthCheck).mockResolvedValue({ status: 'healthy' })

      await healthCheck(mockReq, mockRes)

      const responseCall = mockRes.json.mock.calls[0][0]
      expect(responseCall.data).toHaveProperty('uptime')
      expect(responseCall.data).toHaveProperty('memory')
      expect(responseCall.data).toHaveProperty('cpu')
    })

    it('should handle health check timeouts', async () => {
      const { database } = await import('../utils/database')
      vi.mocked(database.healthCheck).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000)) // 10 second timeout
      )

      await healthCheck(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(503)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('timeout')
        })
      )
    })
  })

  describe('Protocol Stats Controller', () => {
    it('should return protocol statistics', async () => {
      const mockStats = {
        tvl: '10000000000000000000', // 10 ETH
        totalUsers: 150,
        totalTransactions: 1250,
        averageAPY: 8.5,
        totalYieldDistributed: '500000000000000000' // 0.5 ETH
      }

      const { yieldManagementService } = await import('../services/yieldManagementService')
      vi.mocked(yieldManagementService.getPerformanceMetrics).mockResolvedValue(mockStats)

      await getProtocolStats(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
        cached: false,
        timestamp: expect.any(String)
      })
    })

    it('should implement caching for protocol stats', async () => {
      const mockStats = { tvl: '1000000000000000000' }

      const { yieldManagementService } = await import('../services/yieldManagementService')
      vi.mocked(yieldManagementService.getPerformanceMetrics).mockResolvedValue(mockStats)

      // First call
      await getProtocolStats(mockReq, mockRes)
      // Second call (should use cache)
      await getProtocolStats(mockReq, mockRes)

      expect(yieldManagementService.getPerformanceMetrics).toHaveBeenCalledTimes(1)
      
      const secondCallResponse = mockRes.json.mock.calls[1][0]
      expect(secondCallResponse.cached).toBe(true)
    })

    it('should handle stats calculation failures', async () => {
      const { yieldManagementService } = await import('../services/yieldManagementService')
      vi.mocked(yieldManagementService.getPerformanceMetrics).mockRejectedValue(
        new Error('Failed to calculate stats')
      )

      await getProtocolStats(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve protocol statistics',
        code: 'STATS_ERROR'
      })
    })

    it('should include breakdown by protocol', async () => {
      const mockStats = {
        tvl: '10000000000000000000',
        protocolBreakdown: {
          compound: { tvl: '4000000000000000000', apy: 8.2 },
          aave: { tvl: '3500000000000000000', apy: 7.8 },
          yearn: { tvl: '2500000000000000000', apy: 9.1 }
        }
      }

      const { yieldManagementService } = await import('../services/yieldManagementService')
      vi.mocked(yieldManagementService.getPerformanceMetrics).mockResolvedValue(mockStats)

      await getProtocolStats(mockReq, mockRes)

      const responseCall = mockRes.json.mock.calls[0][0]
      expect(responseCall.data.protocolBreakdown).toBeDefined()
      expect(Object.keys(responseCall.data.protocolBreakdown)).toContain('compound')
    })
  })

  describe('Token Quotes Controller', () => {
    it('should return 1inch swap quotes', async () => {
      mockReq.query = {
        fromToken: '0xETH...',
        toToken: '0xBTC...',
        amount: '1000000000000000000' // 1 ETH
      }

      const mockQuote = {
        fromTokenAmount: '1000000000000000000',
        toTokenAmount: '2500000', // 0.025 BTC
        protocols: [['1inch', 100]],
        estimatedGas: 180000,
        slippage: 0.5
      }

      const { oneInchService } = await import('../services/oneInchService')
      vi.mocked(oneInchService.getQuote).mockResolvedValue(mockQuote)

      await getTokenQuotes(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockQuote,
        timestamp: expect.any(String)
      })
    })

    it('should validate token quote parameters', async () => {
      mockReq.query = {
        fromToken: 'invalid_address',
        toToken: '0xBTC...',
        amount: '1000000000000000000'
      }

      await getTokenQuotes(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token address format',
        code: 'VALIDATION_ERROR'
      })
    })

    it('should handle 1inch API failures', async () => {
      mockReq.query = {
        fromToken: '0xETH...',
        toToken: '0xBTC...',
        amount: '1000000000000000000'
      }

      const { oneInchService } = await import('../services/oneInchService')
      vi.mocked(oneInchService.getQuote).mockRejectedValue(new Error('1inch API unavailable'))

      await getTokenQuotes(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(503)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'External service unavailable',
        code: 'EXTERNAL_API_ERROR'
      })
    })

    it('should implement quote caching', async () => {
      mockReq.query = {
        fromToken: '0xETH...',
        toToken: '0xBTC...',
        amount: '1000000000000000000'
      }

      const mockQuote = { toTokenAmount: '2500000' }

      const { oneInchService } = await import('../services/oneInchService')
      vi.mocked(oneInchService.getQuote).mockResolvedValue(mockQuote)

      // First call
      await getTokenQuotes(mockReq, mockRes)
      // Second call (should use cache)
      await getTokenQuotes(mockReq, mockRes)

      expect(oneInchService.getQuote).toHaveBeenCalledTimes(1)
    })

    it('should handle slippage tolerance parameter', async () => {
      mockReq.query = {
        fromToken: '0xETH...',
        toToken: '0xBTC...',
        amount: '1000000000000000000',
        slippage: '1.5' // 1.5%
      }

      const { oneInchService } = await import('../services/oneInchService')
      vi.mocked(oneInchService.getQuote).mockResolvedValue({ toTokenAmount: '2475000' })

      await getTokenQuotes(mockReq, mockRes)

      expect(oneInchService.getQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          slippage: 1.5
        })
      )
    })
  })

  describe('Yield Data Controller', () => {
    it('should return current yield information', async () => {
      const mockYieldData = {
        currentAPY: 8.5,
        totalYieldEarned: '2000000000000000000', // 2 ETH
        activePositions: 5,
        nextDistribution: new Date(Date.now() + 86400000), // Tomorrow
        protocolYields: {
          compound: 8.2,
          aave: 7.8,
          yearn: 9.1
        }
      }

      const { yieldManagementService } = await import('../services/yieldManagementService')
      vi.mocked(yieldManagementService.getCurrentYield).mockResolvedValue(mockYieldData)

      await getYieldData(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockYieldData,
        timestamp: expect.any(String)
      })
    })

    it('should handle yield calculation failures', async () => {
      const { yieldManagementService } = await import('../services/yieldManagementService')
      vi.mocked(yieldManagementService.getCurrentYield).mockRejectedValue(
        new Error('Yield calculation failed')
      )

      await getYieldData(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve yield data',
        code: 'YIELD_ERROR'
      })
    })

    it('should implement yield data caching', async () => {
      const mockYieldData = { currentAPY: 8.5 }

      const { yieldManagementService } = await import('../services/yieldManagementService')
      vi.mocked(yieldManagementService.getCurrentYield).mockResolvedValue(mockYieldData)

      // Cache should last 10 minutes
      await getYieldData(mockReq, mockRes)
      await getYieldData(mockReq, mockRes)

      expect(yieldManagementService.getCurrentYield).toHaveBeenCalledTimes(1)
    })

    it('should include historical yield trends', async () => {
      const mockYieldData = {
        currentAPY: 8.5,
        historical: {
          '7d': 8.2,
          '30d': 7.9,
          '90d': 8.1
        }
      }

      const { yieldManagementService } = await import('../services/yieldManagementService')
      vi.mocked(yieldManagementService.getCurrentYield).mockResolvedValue(mockYieldData)

      await getYieldData(mockReq, mockRes)

      const responseCall = mockRes.json.mock.calls[0][0]
      expect(responseCall.data.historical).toBeDefined()
      expect(responseCall.data.historical['7d']).toBe(8.2)
    })
  })

  describe('User Portfolio Controller', () => {
    it('should return user portfolio data', async () => {
      mockReq.params.address = '0xuser123...'

      const mockPortfolio = {
        totalValue: '5000000000000000000', // 5 ETH
        nftTokens: [
          { tokenId: 1, depositValue: '2000000000000000000', currentValue: '2100000000000000000' },
          { tokenId: 2, depositValue: '3000000000000000000', currentValue: '3200000000000000000' }
        ],
        totalYieldEarned: '300000000000000000', // 0.3 ETH
        apy: 8.5
      }

      const { profitDistributionService } = await import('../services/profitDistributionService')
      vi.mocked(profitDistributionService.getUserPortfolio).mockResolvedValue(mockPortfolio)

      await getUserPortfolio(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPortfolio,
        timestamp: expect.any(String)
      })
    })

    it('should validate user address parameter', async () => {
      mockReq.params.address = 'invalid_address'

      await getUserPortfolio(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid Ethereum address',
        code: 'VALIDATION_ERROR'
      })
    })

    it('should handle user with no portfolio', async () => {
      mockReq.params.address = '0xnewuser...'

      const { profitDistributionService } = await import('../services/profitDistributionService')
      vi.mocked(profitDistributionService.getUserPortfolio).mockResolvedValue(null)

      await getUserPortfolio(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalValue: '0',
          nftTokens: [],
          totalYieldEarned: '0',
          apy: 0
        }
      })
    })

    it('should implement portfolio caching per user', async () => {
      mockReq.params.address = '0xuser123...'
      const mockPortfolio = { totalValue: '5000000000000000000' }

      const { profitDistributionService } = await import('../services/profitDistributionService')
      vi.mocked(profitDistributionService.getUserPortfolio).mockResolvedValue(mockPortfolio)

      // First call
      await getUserPortfolio(mockReq, mockRes)
      // Second call (should use cache)
      await getUserPortfolio(mockReq, mockRes)

      expect(profitDistributionService.getUserPortfolio).toHaveBeenCalledTimes(1)
    })

    it('should include TBA balances in portfolio', async () => {
      mockReq.params.address = '0xuser123...'

      const mockPortfolio = {
        totalValue: '5000000000000000000',
        nftTokens: [
          {
            tokenId: 1,
            depositValue: '2000000000000000000',
            tbaAddress: '0xtba1...',
            tbaBalance: '100000000000000000' // 0.1 ETH in TBA
          }
        ]
      }

      const { profitDistributionService } = await import('../services/profitDistributionService')
      vi.mocked(profitDistributionService.getUserPortfolio).mockResolvedValue(mockPortfolio)

      await getUserPortfolio(mockReq, mockRes)

      const responseCall = mockRes.json.mock.calls[0][0]
      expect(responseCall.data.nftTokens[0]).toHaveProperty('tbaBalance')
    })
  })

  describe('User Transactions Controller', () => {
    it('should return user transaction history with pagination', async () => {
      mockReq.params.address = '0xuser123...'
      mockReq.query = { page: '1', limit: '10' }

      const mockTransactions = {
        transactions: [
          {
            id: 1,
            hash: '0xtx1...',
            type: 'deposit',
            amount: '1000000000000000000',
            timestamp: new Date(),
            status: 'confirmed'
          }
        ],
        totalCount: 1,
        currentPage: 1,
        totalPages: 1
      }

      const { blockchainMonitor } = await import('../services/blockchainMonitor')
      vi.mocked(blockchainMonitor.getTransactionHistory).mockResolvedValue(mockTransactions)

      await getUserTransactions(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTransactions,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 1,
          hasNext: false,
          hasPrevious: false
        }
      })
    })

    it('should validate pagination parameters', async () => {
      mockReq.params.address = '0xuser123...'
      mockReq.query = { page: '-1', limit: '1000' } // Invalid parameters

      await getUserTransactions(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid pagination parameters',
        code: 'VALIDATION_ERROR'
      })
    })

    it('should filter transactions by type', async () => {
      mockReq.params.address = '0xuser123...'
      mockReq.query = { type: 'deposit' }

      const { blockchainMonitor } = await import('../services/blockchainMonitor')
      vi.mocked(blockchainMonitor.getTransactionHistory).mockResolvedValue({
        transactions: [],
        totalCount: 0
      })

      await getUserTransactions(mockReq, mockRes)

      expect(blockchainMonitor.getTransactionHistory).toHaveBeenCalledWith(
        '0xuser123...',
        expect.objectContaining({
          type: 'deposit'
        })
      )
    })

    it('should handle transaction history caching', async () => {
      mockReq.params.address = '0xuser123...'
      mockReq.query = { page: '1', limit: '10' }

      const mockTransactions = { transactions: [], totalCount: 0 }

      const { blockchainMonitor } = await import('../services/blockchainMonitor')
      vi.mocked(blockchainMonitor.getTransactionHistory).mockResolvedValue(mockTransactions)

      // Cache should last 1 minute
      await getUserTransactions(mockReq, mockRes)
      await getUserTransactions(mockReq, mockRes)

      expect(blockchainMonitor.getTransactionHistory).toHaveBeenCalledTimes(1)
    })
  })

  describe('Submit Transaction Controller', () => {
    it('should process transaction submission', async () => {
      mockReq.body = {
        type: 'deposit',
        amount: '1000000000000000000',
        userAddress: '0xuser123...',
        signature: '0xsignature...'
      }

      const mockTxHash = '0xsubmitted...'

      const { database } = await import('../utils/database')
      vi.mocked(database.insert).mockResolvedValue({ id: 1, hash: mockTxHash })

      await submitTransaction(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          transactionHash: mockTxHash,
          status: 'pending',
          estimatedConfirmation: expect.any(String)
        }
      })
    })

    it('should validate transaction parameters', async () => {
      mockReq.body = {
        type: 'invalid_type',
        amount: 'invalid_amount'
      }

      await submitTransaction(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid transaction parameters',
        code: 'VALIDATION_ERROR'
      })
    })

    it('should handle transaction submission failures', async () => {
      mockReq.body = {
        type: 'deposit',
        amount: '1000000000000000000',
        userAddress: '0xuser123...'
      }

      const { database } = await import('../utils/database')
      vi.mocked(database.insert).mockRejectedValue(new Error('Database error'))

      await submitTransaction(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Transaction submission failed',
        code: 'SUBMISSION_ERROR'
      })
    })
  })

  describe('Bonding Curve Rate Controller', () => {
    it('should return current bonding curve rate', async () => {
      const mockRate = {
        currentRate: '1500000000000000', // 0.0015 ETH per token
        totalSupply: 1000,
        priceImpact: 0.02, // 2%
        nextRate: '1505000000000000'
      }

      // Mock bonding curve calculation
      global.calculateBondingCurveRate = vi.fn().mockReturnValue(mockRate)

      await getBondingCurveRate(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockRate,
        timestamp: expect.any(String)
      })
    })

    it('should handle bonding curve calculation errors', async () => {
      global.calculateBondingCurveRate = vi.fn().mockImplementation(() => {
        throw new Error('Calculation error')
      })

      await getBondingCurveRate(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to calculate bonding curve rate',
        code: 'CALCULATION_ERROR'
      })
    })
  })

  describe('WebSocket Connection Handler', () => {
    it('should handle WebSocket connection setup', async () => {
      await handleWebSocketConnection(mockWs, mockReq)

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function))
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function))
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should handle WebSocket subscription requests', async () => {
      const messageHandler = vi.fn()
      mockWs.on.mockImplementation((event, handler) => {
        if (event === 'message') messageHandler.mockImplementation(handler)
      })

      await handleWebSocketConnection(mockWs, mockReq)

      // Simulate subscription message
      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        channels: ['portfolio_updates', 'yield_distributions']
      })

      messageHandler(subscribeMessage)

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscription_confirmed',
          channels: ['portfolio_updates', 'yield_distributions']
        })
      )
    })

    it('should handle WebSocket disconnection', async () => {
      const closeHandler = vi.fn()
      mockWs.on.mockImplementation((event, handler) => {
        if (event === 'close') closeHandler.mockImplementation(handler)
      })

      await handleWebSocketConnection(mockWs, mockReq)

      // Simulate disconnect
      closeHandler()

      // Should clean up subscriptions
      expect(global.wsConnections?.size).toBe(0)
    })

    it('should handle WebSocket errors gracefully', async () => {
      const errorHandler = vi.fn()
      mockWs.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler.mockImplementation(handler)
      })

      await handleWebSocketConnection(mockWs, mockReq)

      // Simulate error
      const error = new Error('WebSocket error')
      errorHandler(error)

      expect(mockWs.close).toHaveBeenCalled()
    })

    it('should broadcast updates to subscribed clients', async () => {
      const mockUpdate = {
        type: 'portfolio_update',
        data: { userAddress: '0xuser123...', newBalance: '5000000000000000000' }
      }

      await handleWebSocketConnection(mockWs, mockReq)

      // Mock subscription
      global.wsSubscriptions?.set(mockWs, ['portfolio_updates'])

      // Broadcast update
      await global.broadcastUpdate(mockUpdate)

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(mockUpdate))
    })
  })
})
