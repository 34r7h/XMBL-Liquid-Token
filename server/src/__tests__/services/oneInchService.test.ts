import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OneInchService } from '../../services/oneInchService'
import type { SwapQuote, SwapOrder, OrderStatus } from '../../services/oneInchService'

// Mock 1inch SDK
vi.mock('@1inch/fusion-sdk', () => ({
  FusionSDK: vi.fn().mockImplementation(() => ({
    createOrder: vi.fn(),
    getOrderStatus: vi.fn(),
    cancelOrder: vi.fn(),
  })),
}))

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: vi.fn(),
    Contract: vi.fn(),
    formatUnits: vi.fn(),
    parseUnits: vi.fn(),
  },
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('OneInchService', () => {
  let oneInchService: OneInchService
  const mockApiKey = 'test-api-key'
  const mockRpcUrl = 'https://eth-mainnet.rpc.url'

  beforeEach(() => {
    oneInchService = new OneInchService(mockApiKey, mockRpcUrl)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
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

    it('should validate API key format', () => {
      expect(() => new OneInchService('invalid-key', mockRpcUrl))
        .toThrow('Invalid API key format')
    })
  })

  describe('Swap Quotes', () => {
    it('should get swap quotes successfully', async () => {
      const mockQuote: SwapQuote = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', // USDC
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
        fromAmount: '1000000000', // 1000 USDC
        toAmount: '3500000', // 0.035 WBTC
        estimatedGas: '150000',
        protocols: [['UNISWAP_V3', 'CURVE']],
        slippage: 0.5,
        price: '0.000035'
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQuote),
      } as Response)

      const quote = await oneInchService.getQuote(
        '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        '1000000000'
      )

      expect(quote).toEqual(mockQuote)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v5.0/1/quote'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
          }),
        })
      )
    })

    it('should handle quote API failures', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      await expect(
        oneInchService.getQuote(
          '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
          '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          '1000000000'
        )
      ).rejects.toThrow('Failed to get quote: 500 Internal Server Error')
    })

    it('should validate token addresses in quote request', async () => {
      await expect(
        oneInchService.getQuote('invalid', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '1000')
      ).rejects.toThrow('Invalid fromToken address')

      await expect(
        oneInchService.getQuote('0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', 'invalid', '1000')
      ).rejects.toThrow('Invalid toToken address')
    })

    it('should validate amount in quote request', async () => {
      await expect(
        oneInchService.getQuote(
          '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
          '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          '0'
        )
      ).rejects.toThrow('Amount must be greater than 0')
    })

    it('should handle insufficient liquidity errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Insufficient liquidity' }),
      } as Response)

      await expect(
        oneInchService.getQuote(
          '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
          '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          '999999999999999999'
        )
      ).rejects.toThrow('Insufficient liquidity')
    })
  })

  describe('Fusion+ Orders', () => {
    it('should create Fusion+ order successfully', async () => {
      const mockOrder: SwapOrder = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '1000000000',
        minReturnAmount: '3500000',
        receiver: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        nonce: 1,
        preset: 'fast'
      }

      const mockOrderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      const mockFusionSDK = {
        createOrder: vi.fn().mockResolvedValue({ orderHash: mockOrderHash })
      }

      vi.mocked(require('@1inch/fusion-sdk').FusionSDK).mockReturnValue(mockFusionSDK)

      const orderHash = await oneInchService.createSwapOrder(mockOrder)

      expect(orderHash).toBe(mockOrderHash)
      expect(mockFusionSDK.createOrder).toHaveBeenCalledWith(mockOrder)
    })

    it('should handle order creation failures', async () => {
      const mockOrder: SwapOrder = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '1000000000',
        minReturnAmount: '3500000',
        receiver: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1
      }

      const mockFusionSDK = {
        createOrder: vi.fn().mockRejectedValue(new Error('Order creation failed'))
      }

      vi.mocked(require('@1inch/fusion-sdk').FusionSDK).mockReturnValue(mockFusionSDK)

      await expect(oneInchService.createSwapOrder(mockOrder))
        .rejects.toThrow('Order creation failed')
    })

    it('should validate order parameters', async () => {
      const invalidOrder = {
        fromToken: 'invalid',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '0',
        minReturnAmount: '3500000',
        receiver: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) - 3600, // Past deadline
        nonce: 1
      }

      await expect(oneInchService.createSwapOrder(invalidOrder as SwapOrder))
        .rejects.toThrow('Invalid order parameters')
    })
  })

  describe('Order Status', () => {
    it('should get order status successfully', async () => {
      const mockOrderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const mockStatus: OrderStatus = {
        orderHash: mockOrderHash,
        status: 'executed',
        executedAmount: '3500000',
        executionPrice: '0.000035',
        executionTxHash: '0x9876543210987654321098765432109876543210987654321098765432109876',
        timestamp: new Date().toISOString(),
        fills: [
          {
            amount: '3500000',
            price: '0.000035',
            txHash: '0x9876543210987654321098765432109876543210987654321098765432109876',
            timestamp: new Date().toISOString()
          }
        ]
      }

      const mockFusionSDK = {
        getOrderStatus: vi.fn().mockResolvedValue(mockStatus)
      }

      vi.mocked(require('@1inch/fusion-sdk').FusionSDK).mockReturnValue(mockFusionSDK)

      const status = await oneInchService.getOrderStatus(mockOrderHash)

      expect(status).toEqual(mockStatus)
      expect(mockFusionSDK.getOrderStatus).toHaveBeenCalledWith(mockOrderHash)
    })

    it('should handle order not found', async () => {
      const mockOrderHash = '0xnonexistent123456789012345678901234567890123456789012345678901234'

      const mockFusionSDK = {
        getOrderStatus: vi.fn().mockRejectedValue(new Error('Order not found'))
      }

      vi.mocked(require('@1inch/fusion-sdk').FusionSDK).mockReturnValue(mockFusionSDK)

      await expect(oneInchService.getOrderStatus(mockOrderHash))
        .rejects.toThrow('Order not found')
    })

    it('should validate order hash format', async () => {
      await expect(oneInchService.getOrderStatus('invalid-hash'))
        .rejects.toThrow('Invalid order hash format')
    })
  })

  describe('Token Operations', () => {
    it('should get token allowance', async () => {
      const mockAllowance = '1000000000000000000000' // 1000 tokens

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ allowance: mockAllowance }),
      } as Response)

      const allowance = await oneInchService.getAllowance(
        '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        '0x1234567890123456789012345678901234567890',
        '0x1111111254eeb25477b68fb85ed929f73a960582'
      )

      expect(allowance).toBe(mockAllowance)
    })

    it('should get token balance', async () => {
      const mockBalance = '5000000000' // 5000 USDC

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ balance: mockBalance }),
      } as Response)

      const balance = await oneInchService.getTokenBalance(
        '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        '0x1234567890123456789012345678901234567890'
      )

      expect(balance).toBe(mockBalance)
    })

    it('should handle balance fetch failures', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response)

      await expect(
        oneInchService.getTokenBalance(
          '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
          '0x1234567890123456789012345678901234567890'
        )
      ).rejects.toThrow('Failed to get token balance')
    })
  })

  describe('Gas Estimation', () => {
    it('should estimate swap gas accurately', async () => {
      const mockGasEstimate = '180000'

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ gas: mockGasEstimate }),
      } as Response)

      const swapData = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '1000000000',
        from: '0x1234567890123456789012345678901234567890'
      }

      const gasEstimate = await oneInchService.estimateSwapGas(swapData)

      expect(gasEstimate).toBe(mockGasEstimate)
    })

    it('should handle gas estimation failures', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      const swapData = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '1000000000',
        from: '0x1234567890123456789012345678901234567890'
      }

      await expect(oneInchService.estimateSwapGas(swapData))
        .rejects.toThrow('Failed to estimate gas')
    })

    it('should provide fallback gas estimate', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const swapData = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '1000000000',
        from: '0x1234567890123456789012345678901234567890'
      }

      const gasEstimate = await oneInchService.estimateSwapGas(swapData)

      expect(gasEstimate).toBe('200000') // Fallback gas limit
    })
  })

  describe('Swap History', () => {
    it('should get user swap history', async () => {
      const mockHistory = [
        {
          txHash: '0x1111',
          fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
          toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          fromAmount: '1000000000',
          toAmount: '3500000',
          timestamp: new Date().toISOString(),
          status: 'completed'
        },
        {
          txHash: '0x2222',
          fromToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          fromAmount: '1000000000000000000',
          toAmount: '45000000',
          timestamp: new Date().toISOString(),
          status: 'completed'
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ history: mockHistory }),
      } as Response)

      const history = await oneInchService.getSwapHistory('0x1234567890123456789012345678901234567890')

      expect(history).toEqual(mockHistory)
      expect(history).toHaveLength(2)
    })

    it('should handle empty swap history', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ history: [] }),
      } as Response)

      const history = await oneInchService.getSwapHistory('0x1234567890123456789012345678901234567890')

      expect(history).toEqual([])
    })
  })

  describe('Rate Limiting', () => {
    it('should handle API rate limit errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '60' }),
      } as Response)

      await expect(
        oneInchService.getQuote(
          '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
          '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          '1000000000'
        )
      ).rejects.toThrow('Rate limit exceeded. Retry after 60 seconds')
    })

    it('should implement retry mechanism with exponential backoff', async () => {
      let callCount = 0
      vi.mocked(fetch).mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ fromAmount: '1000', toAmount: '3500' }),
        } as Response)
      })

      const quote = await oneInchService.getQuote(
        '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        '1000000000'
      )

      expect(callCount).toBe(3)
      expect(quote).toBeDefined()
    })
  })

  describe('Fallback to Limit Order Protocol', () => {
    it('should fallback to Limit Order Protocol when Fusion+ unavailable', async () => {
      const mockOrder: SwapOrder = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '1000000000',
        minReturnAmount: '3500000',
        receiver: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1
      }

      // Mock Fusion+ failure
      const mockFusionSDK = {
        createOrder: vi.fn().mockRejectedValue(new Error('Fusion+ unavailable'))
      }

      vi.mocked(require('@1inch/fusion-sdk').FusionSDK).mockReturnValue(mockFusionSDK)

      // Mock Limit Order Protocol success
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ orderHash: '0xfallback123' }),
      } as Response)

      const orderHash = await oneInchService.createSwapOrder(mockOrder)

      expect(orderHash).toBe('0xfallback123')
    })

    it('should handle both Fusion+ and Limit Order Protocol failures', async () => {
      const mockOrder: SwapOrder = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: '1000000000',
        minReturnAmount: '3500000',
        receiver: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1
      }

      // Mock both failures
      const mockFusionSDK = {
        createOrder: vi.fn().mockRejectedValue(new Error('Fusion+ unavailable'))
      }

      vi.mocked(require('@1inch/fusion-sdk').FusionSDK).mockReturnValue(mockFusionSDK)
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      await expect(oneInchService.createSwapOrder(mockOrder))
        .rejects.toThrow('All swap protocols unavailable')
    })
  })

  describe('Slippage Protection', () => {
    it('should calculate minimum return amount with slippage', () => {
      const expectedAmount = '3500000'
      const slippage = 0.5 // 0.5%

      const minAmount = oneInchService.calculateMinReturnAmount(expectedAmount, slippage)

      expect(minAmount).toBe('3482500') // 3500000 * (1 - 0.005)
    })

    it('should validate slippage parameters', () => {
      expect(() => oneInchService.calculateMinReturnAmount('3500000', -1))
        .toThrow('Slippage must be between 0 and 100')

      expect(() => oneInchService.calculateMinReturnAmount('3500000', 101))
        .toThrow('Slippage must be between 0 and 100')
    })

    it('should handle zero slippage', () => {
      const expectedAmount = '3500000'
      const slippage = 0

      const minAmount = oneInchService.calculateMinReturnAmount(expectedAmount, slippage)

      expect(minAmount).toBe(expectedAmount)
    })
  })

  describe('Error Recovery', () => {
    it('should implement circuit breaker pattern', async () => {
      // Mock repeated failures
      vi.mocked(fetch).mockRejectedValue(new Error('Service unavailable'))

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await oneInchService.getQuote('0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '1000')
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      await expect(
        oneInchService.getQuote('0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '1000')
      ).rejects.toThrow('Service temporarily unavailable')
    })

    it('should provide cached responses during outages', async () => {
      const cachedQuote = {
        fromToken: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        toToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        fromAmount: '1000000000',
        toAmount: '3500000'
      }

      // First successful request to populate cache
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(cachedQuote),
      } as Response)

      await oneInchService.getQuote('0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '1000000000')

      // Second request fails, should return cached data
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const quote = await oneInchService.getQuote('0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '1000000000')

      expect(quote.fromAmount).toBe(cachedQuote.fromAmount)
      expect(quote.isStale).toBe(true)
    })
  })
})
