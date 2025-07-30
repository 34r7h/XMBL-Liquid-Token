import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProtocolStore } from '../../stores/protocol'

// Mock API service
vi.mock('../../services/apiService', () => ({
  apiService: {
    getProtocolStats: vi.fn(),
    getBondingCurveRate: vi.fn(),
    getSupportedTokens: vi.fn(),
    getTokenPrice: vi.fn(),
  }
}))

// Mock WebSocket
const mockWebSocket = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
}
global.WebSocket = vi.fn(() => mockWebSocket) as any

describe('Protocol Store', () => {
  let store: ReturnType<typeof useProtocolStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useProtocolStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      expect(store.totalValueLocked).toBe('0')
      expect(store.currentAPY).toBe(0)
      expect(store.totalUsers).toBe(0)
      expect(store.totalYieldDistributed).toBe('0')
      expect(store.supportedTokens).toEqual([])
      expect(store.bondingCurveRate).toBe(0)
      expect(store.protocolStats).toBeNull()
      expect(store.isMaintenanceMode).toBe(false)
      expect(store.lastStatsUpdate).toBeNull()
    })

    it('should initialize with empty supported tokens array', () => {
      expect(Array.isArray(store.supportedTokens)).toBe(true)
      expect(store.supportedTokens.length).toBe(0)
    })
  })

  describe('Protocol Statistics', () => {
    it('should fetch protocol stats successfully', async () => {
      const mockStats = {
        totalValueLocked: '1000000',
        currentAPY: 12.5,
        totalUsers: 150,
        totalYieldDistributed: '50000',
        totalDeposits: 500,
        averageDepositSize: '2000'
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getProtocolStats).mockResolvedValue(mockStats)

      await store.fetchProtocolStats()

      expect(store.totalValueLocked).toBe('1000000')
      expect(store.currentAPY).toBe(12.5)
      expect(store.totalUsers).toBe(150)
      expect(store.totalYieldDistributed).toBe('50000')
      expect(store.lastStatsUpdate).toBeInstanceOf(Date)
    })

    it('should handle protocol stats fetch failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getProtocolStats).mockRejectedValue(new Error('API Error'))

      await expect(store.fetchProtocolStats()).rejects.toThrow('API Error')
      expect(store.lastStatsUpdate).toBeNull()
    })

    it('should cache protocol stats with TTL', async () => {
      const mockStats = {
        totalValueLocked: '1000000',
        currentAPY: 12.5,
        totalUsers: 150,
        totalYieldDistributed: '50000'
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getProtocolStats).mockResolvedValue(mockStats)

      await store.fetchProtocolStats()
      await store.fetchProtocolStats() // Second call should use cache

      expect(apiService.getProtocolStats).toHaveBeenCalledTimes(1)
    })
  })

  describe('Bonding Curve', () => {
    it('should fetch bonding curve rate successfully', async () => {
      const mockRate = 1.25

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getBondingCurveRate).mockResolvedValue(mockRate)

      await store.fetchBondingCurveRate()

      expect(store.bondingCurveRate).toBe(1.25)
    })

    it('should handle bonding curve fetch failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getBondingCurveRate).mockRejectedValue(new Error('Network Error'))

      await expect(store.fetchBondingCurveRate()).rejects.toThrow('Network Error')
      expect(store.bondingCurveRate).toBe(0)
    })

    it('should estimate XMBL output correctly', async () => {
      store.bondingCurveRate = 1.5

      const output = await store.estimateXMBLOutput('USDC', '1000')

      expect(typeof output).toBe('string')
      expect(parseFloat(output)).toBeGreaterThan(0)
    })

    it('should handle invalid estimation inputs', async () => {
      await expect(store.estimateXMBLOutput('INVALID', '0'))
        .rejects.toThrow('Invalid token or amount')
    })
  })

  describe('Supported Tokens', () => {
    it('should fetch supported tokens successfully', async () => {
      const mockTokens = [
        {
          symbol: 'ETH',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          minDeposit: '0.01',
          maxDeposit: '100',
          isActive: true
        },
        {
          symbol: 'USDC',
          address: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
          decimals: 6,
          minDeposit: '10',
          maxDeposit: '100000',
          isActive: true
        }
      ]

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getSupportedTokens).mockResolvedValue(mockTokens)

      await store.fetchSupportedTokens()

      expect(store.supportedTokens).toEqual(mockTokens)
      expect(store.supportedTokens.length).toBe(2)
    })

    it('should handle supported tokens fetch failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getSupportedTokens).mockRejectedValue(new Error('Server Error'))

      await expect(store.fetchSupportedTokens()).rejects.toThrow('Server Error')
      expect(store.supportedTokens).toEqual([])
    })

    it('should filter active tokens only', async () => {
      const mockTokens = [
        { symbol: 'ETH', address: '0x1', decimals: 18, isActive: true },
        { symbol: 'DAI', address: '0x2', decimals: 18, isActive: false },
        { symbol: 'USDC', address: '0x3', decimals: 6, isActive: true }
      ]

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getSupportedTokens).mockResolvedValue(mockTokens)

      await store.fetchSupportedTokens()

      const activeTokens = store.supportedTokens.filter(token => token.isActive)
      expect(activeTokens.length).toBe(2)
    })
  })

  describe('Token Prices', () => {
    it('should get token price successfully', async () => {
      const mockPrice = 2500.75

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTokenPrice).mockResolvedValue(mockPrice)

      const price = await store.getTokenPrice('ETH')

      expect(price).toBe(2500.75)
      expect(apiService.getTokenPrice).toHaveBeenCalledWith('ETH')
    })

    it('should handle token price fetch failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTokenPrice).mockRejectedValue(new Error('Price not available'))

      await expect(store.getTokenPrice('INVALID')).rejects.toThrow('Price not available')
    })

    it('should cache token prices', async () => {
      const mockPrice = 2500.75

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTokenPrice).mockResolvedValue(mockPrice)

      await store.getTokenPrice('ETH')
      await store.getTokenPrice('ETH') // Should use cache

      expect(apiService.getTokenPrice).toHaveBeenCalledTimes(1)
    })
  })

  describe('Data Refresh', () => {
    it('should refresh all protocol data', async () => {
      const mockStats = { totalValueLocked: '1000000' }
      const mockRate = 1.25
      const mockTokens = [{ symbol: 'ETH', address: '0x1' }]

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getProtocolStats).mockResolvedValue(mockStats)
      vi.mocked(apiService.getBondingCurveRate).mockResolvedValue(mockRate)
      vi.mocked(apiService.getSupportedTokens).mockResolvedValue(mockTokens)

      await store.refreshAllData()

      expect(apiService.getProtocolStats).toHaveBeenCalled()
      expect(apiService.getBondingCurveRate).toHaveBeenCalled()
      expect(apiService.getSupportedTokens).toHaveBeenCalled()
    })

    it('should handle partial refresh failures', async () => {
      const mockStats = { totalValueLocked: '1000000' }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getProtocolStats).mockResolvedValue(mockStats)
      vi.mocked(apiService.getBondingCurveRate).mockRejectedValue(new Error('Bonding curve error'))
      vi.mocked(apiService.getSupportedTokens).mockResolvedValue([])

      await store.refreshAllData()

      expect(store.totalValueLocked).toBe('1000000')
      expect(store.bondingCurveRate).toBe(0) // Should remain default on error
    })
  })

  describe('WebSocket Updates', () => {
    it('should subscribe to real-time updates', () => {
      store.subscribeToUpdates()

      expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('ws'))
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should handle protocol stats WebSocket updates', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'protocol_stats_updated',
          data: { totalValueLocked: '2000000', currentAPY: 15 }
        })
      }

      messageHandler?.(mockEvent)

      expect(store.totalValueLocked).toBe('2000000')
      expect(store.currentAPY).toBe(15)
    })

    it('should handle bonding curve WebSocket updates', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'bonding_curve_updated',
          data: { rate: 1.75 }
        })
      }

      messageHandler?.(mockEvent)

      expect(store.bondingCurveRate).toBe(1.75)
    })

    it('should handle maintenance mode WebSocket updates', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'maintenance_mode_changed',
          data: { isMaintenanceMode: true }
        })
      }

      messageHandler?.(mockEvent)

      expect(store.isMaintenanceMode).toBe(true)
    })

    it('should unsubscribe from updates', () => {
      store.subscribeToUpdates()
      store.unsubscribeFromUpdates()

      expect(mockWebSocket.close).toHaveBeenCalled()
    })
  })

  describe('Getters', () => {
    it('should format TVL correctly', () => {
      store.totalValueLocked = '1234567.89'

      expect(store.formattedTVL).toBe('$1.23M')
    })

    it('should format APY correctly', () => {
      store.currentAPY = 12.456

      expect(store.formattedAPY).toBe('12.46%')
    })

    it('should get supported token by symbol', () => {
      store.supportedTokens = [
        { symbol: 'ETH', address: '0x1', decimals: 18, isActive: true },
        { symbol: 'USDC', address: '0x2', decimals: 6, isActive: true }
      ]

      const ethToken = store.getSupportedToken('ETH')
      expect(ethToken?.address).toBe('0x1')

      const invalidToken = store.getSupportedToken('INVALID')
      expect(invalidToken).toBeUndefined()
    })

    it('should check if token is supported by address', () => {
      store.supportedTokens = [
        { symbol: 'ETH', address: '0x1', decimals: 18, isActive: true },
        { symbol: 'USDC', address: '0x2', decimals: 6, isActive: true }
      ]

      expect(store.isTokenSupported('0x1')).toBe(true)
      expect(store.isTokenSupported('0x999')).toBe(false)
    })

    it('should determine protocol health status', () => {
      // Healthy protocol
      store.totalValueLocked = '1000000'
      store.currentAPY = 12
      store.isMaintenanceMode = false

      expect(store.protocolHealth).toBe('Healthy')

      // Maintenance mode
      store.isMaintenanceMode = true
      expect(store.protocolHealth).toBe('Maintenance')

      // Low TVL
      store.isMaintenanceMode = false
      store.totalValueLocked = '1000'
      expect(store.protocolHealth).toBe('Warning')
    })
  })

  describe('Caching and Offline Support', () => {
    it('should support offline mode with cached data', () => {
      // Mock localStorage
      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

      const cachedData = {
        totalValueLocked: '500000',
        currentAPY: 10,
        timestamp: Date.now()
      }

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cachedData))

      store.loadCachedData()

      expect(store.totalValueLocked).toBe('500000')
      expect(store.currentAPY).toBe(10)
    })

    it('should implement stale-while-revalidate pattern', async () => {
      const cachedData = {
        totalValueLocked: '500000',
        timestamp: Date.now() - 60000 // 1 minute old
      }

      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(JSON.stringify(cachedData)),
        setItem: vi.fn()
      }
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getProtocolStats).mockResolvedValue({ totalValueLocked: '600000' })

      await store.fetchProtocolStats()

      // Should load from cache first, then update with fresh data
      expect(store.totalValueLocked).toBe('600000')
    })

    it('should validate cached data before using', () => {
      const invalidCachedData = JSON.stringify({ invalid: 'data' })

      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(invalidCachedData),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

      store.loadCachedData()

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('protocol_cache')
    })
  })

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getProtocolStats).mockRejectedValue(new Error('Network error'))

      await expect(store.fetchProtocolStats()).rejects.toThrow('Network error')

      // Should maintain previous state on error
      expect(store.totalValueLocked).toBe('0')
    })

    it('should validate incoming data', async () => {
      const invalidStats = {
        totalValueLocked: 'invalid',
        currentAPY: 'not-a-number'
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getProtocolStats).mockResolvedValue(invalidStats)

      await expect(store.fetchProtocolStats()).rejects.toThrow('Invalid data format')
    })

    it('should handle WebSocket connection failures', () => {
      const mockFailingWebSocket = {
        addEventListener: vi.fn(),
        onerror: null
      }
      global.WebSocket = vi.fn(() => mockFailingWebSocket) as any

      store.subscribeToUpdates()

      // Simulate WebSocket error
      mockFailingWebSocket.onerror?.(new Error('Connection failed'))

      expect(store.wsConnectionStatus).toBe('failed')
    })
  })
})
