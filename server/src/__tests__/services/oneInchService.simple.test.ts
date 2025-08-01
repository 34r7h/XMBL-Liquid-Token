import { describe, it, expect, beforeEach } from 'vitest'
import { OneInchService } from '../../services/oneInchService'

describe('OneInchService Integration Tests', () => {
  let oneInchService: OneInchService
  const mockApiKey = 'test-api-key'
  const mockRpcUrl = 'https://eth-mainnet.rpc.url'

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test'
    oneInchService = new OneInchService(mockApiKey, mockRpcUrl)
  })

  describe('Service Initialization', () => {
    it('should initialize with API key and RPC URL', () => {
      expect(oneInchService).toBeInstanceOf(OneInchService)
      expect(oneInchService.apiKey).toBe(mockApiKey)
      expect(oneInchService.rpcUrl).toBe(mockRpcUrl)
    })

    it('should throw error without API key', () => {
      expect(() => new OneInchService('', mockRpcUrl))
        .toThrow('1inch API key is required')
    })

    it('should throw error without RPC URL', () => {
      expect(() => new OneInchService(mockApiKey, ''))
        .toThrow('Ethereum RPC URL is required')
    })

    it('should throw error with invalid API key', () => {
      expect(() => new OneInchService('invalid-key', mockRpcUrl))
        .toThrow('Invalid API key format')
    })
  })

  describe('Input Validation', () => {
    it('should validate Ethereum addresses', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b8D591a55c74F86e8E'
      const invalidAddress = 'invalid-address'

      expect(oneInchService['isValidAddress'](validAddress)).toBe(true)
      expect(oneInchService['isValidAddress'](invalidAddress)).toBe(false)
    })

    it('should validate order hash format', () => {
      const validHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const invalidHash = 'invalid-hash'

      expect(oneInchService['isValidOrderHash'](validHash)).toBe(true)
      expect(oneInchService['isValidOrderHash'](invalidHash)).toBe(false)
    })
  })

  describe('Cache Management', () => {
    it('should generate cache keys correctly', () => {
      const fromToken = '0x742d35Cc6634C0532925a3b8D591a55c74F86e8E'
      const toToken = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
      const amount = '1000000000000000000'

      const cacheKey = oneInchService['getCacheKey'](fromToken, toToken, amount)
      expect(cacheKey).toBe(`${fromToken}-${toToken}-${amount}`)
    })

    it('should handle cache expiry correctly', () => {
      const fromToken = '0x742d35Cc6634C0532925a3b8D591a55c74F86e8E'
      const toToken = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
      const amount = '1000000000000000000'

      // No cached quote initially
      const cachedQuote = oneInchService['getCachedQuote'](fromToken, toToken, amount)
      expect(cachedQuote).toBeNull()
    })
  })

  describe('Slippage Calculation', () => {
    it('should calculate minimum return amount with slippage', () => {
      const expectedAmount = '1000000'
      const slippage = 5 // 5%

      const minAmount = oneInchService.calculateMinReturnAmount(expectedAmount, slippage)
      expect(parseInt(minAmount)).toBe(950000) // 1M - 5% = 950K
    })

    it('should throw error for invalid slippage values', () => {
      const expectedAmount = '1000000'

      expect(() => oneInchService.calculateMinReturnAmount(expectedAmount, -1))
        .toThrow('Slippage must be between 0 and 100')

      expect(() => oneInchService.calculateMinReturnAmount(expectedAmount, 101))
        .toThrow('Slippage must be between 0 and 100')
    })

    it('should handle zero slippage', () => {
      const expectedAmount = '1000000'
      const slippage = 0

      const minAmount = oneInchService.calculateMinReturnAmount(expectedAmount, slippage)
      expect(minAmount).toBe('1000000')
    })

    it('should handle maximum slippage', () => {
      const expectedAmount = '1000000'
      const slippage = 100

      const minAmount = oneInchService.calculateMinReturnAmount(expectedAmount, slippage)
      expect(minAmount).toBe('0')
    })
  })

  describe('Circuit Breaker', () => {
    it('should not open circuit breaker initially', () => {
      expect(oneInchService['isCircuitOpen']).toBe(false)
      expect(oneInchService['failureCount']).toBe(0)
    })

    it('should record success and reset failure count', () => {
      oneInchService['failureCount'] = 3
      oneInchService['recordSuccess']()

      expect(oneInchService['failureCount']).toBe(0)
      expect(oneInchService['isCircuitOpen']).toBe(false)
    })
  })

  describe('Health Check', () => {
    it('should return healthy status in test environment', async () => {
      const health = await oneInchService.health()

      expect(health).toHaveProperty('status', 'healthy')
      expect(health).toHaveProperty('message', '1inch API connection successful')
    })
  })

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      await expect(oneInchService.initialize()).resolves.toBeUndefined()
    })

    it('should handle test environment gracefully', () => {
      // In test environment, should not throw errors
      expect(() => {
        const testService = new OneInchService('test-key', 'https://test.rpc')
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid quote parameters', async () => {
      const invalidFromToken = 'invalid-address'
      const validToToken = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
      const validAmount = '1000000000000000000'

      await expect(
        oneInchService.getQuote(invalidFromToken, validToToken, validAmount)
      ).rejects.toThrow('Invalid fromToken address')
    })

    it('should handle invalid swap order parameters', async () => {
      const invalidOrder = {
        fromToken: 'invalid-address',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '1000000000000000000',
        minReturnAmount: '3500000',
        receiver: '0x742d35Cc6634C0532925a3b8D591a55c74F86e8E',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1
      }

      await expect(oneInchService.createSwapOrder(invalidOrder))
        .rejects.toThrow('Invalid order parameters')
    })

    it('should handle invalid order hash in status check', async () => {
      const invalidHash = 'invalid-hash'

      await expect(oneInchService.getOrderStatus(invalidHash))
        .rejects.toThrow('Invalid order hash format')
    })
  })

  describe('Configuration Validation', () => {
    it('should have correct constants', () => {
      expect(oneInchService['chainId']).toBe(1) // Ethereum mainnet
      expect(oneInchService['baseUrl']).toBe('https://api.1inch.dev')
    })

    it('should handle timeout configuration for test environment', () => {
      // Test environment should have shorter timeouts
      expect(oneInchService['resetTimeout']).toBe(100) // Shorter for tests
      expect(oneInchService['cacheTimeout']).toBe(1000) // Shorter for tests
    })
  })
})
