import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePortfolioStore } from '../../stores/portfolio'

// Mock API service
vi.mock('../../services/apiService', () => ({
  apiService: {
    getPortfolioData: vi.fn(),
    getNFTBalances: vi.fn(),
    getYieldData: vi.fn(),
    claimYields: vi.fn(),
    getTBABalance: vi.fn()
  }
}))

// Mock web3Service
vi.mock('../../services/web3Service', () => ({
  web3Service: {
    getUserNFTs: vi.fn(),
    getTBABalance: vi.fn(),
    claimYields: vi.fn(),
    batchClaimYields: vi.fn()
  }
}))

// Mock WebSocket
const mockWebSocket = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  send: vi.fn()
}
global.WebSocket = vi.fn(() => mockWebSocket) as any

describe('Portfolio Store', () => {
  let store: ReturnType<typeof usePortfolioStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = usePortfolioStore()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      expect(store.xmblNFTs).toEqual([])
      expect(store.totalPortfolioValue).toBe('0')
      expect(store.totalDeposited).toBe('0')
      expect(store.totalAccruedYields).toBe('0')
      expect(store.currentAPY).toBe(0)
      expect(store.yieldSources).toEqual([])
      expect(store.selectedNFTId).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.lastUpdated).toBeNull()
      expect(store.autoRefresh).toBe(false)
    })

    it('should initialize with empty portfolio data', () => {
      expect(Array.isArray(store.xmblNFTs)).toBe(true)
      expect(store.xmblNFTs.length).toBe(0)
      expect(store.yieldSources.length).toBe(0)
    })
  })

  describe('Portfolio Data Fetching', () => {
    it('should fetch portfolio data successfully', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890'
      const mockPortfolioData = {
        nfts: [
          {
            tokenId: 1,
            tbaAddress: '0xabc123...',
            balance: '1000',
            depositedAmount: '500',
            yieldEarned: '50',
            metadata: { name: 'XMBL #1', image: 'ipfs://...' },
            lastYieldClaim: new Date('2024-01-01'),
            apy: 15.5
          },
          {
            tokenId: 2,
            tbaAddress: '0xdef456...',
            balance: '2000',
            depositedAmount: '1000',
            yieldEarned: '100',
            metadata: { name: 'XMBL #2', image: 'ipfs://...' },
            lastYieldClaim: new Date('2024-01-05'),
            apy: 18.2
          }
        ],
        totalPortfolioValue: '7500',
        totalDeposited: '1500',
        totalAccruedYields: '150',
        currentAPY: 16.85,
        yieldSources: [
          { source: '1inch Trading', amount: '75', percentage: 50 },
          { source: 'Bitcoin Mining', amount: '75', percentage: 50 }
        ]
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getPortfolioData).mockResolvedValue(mockPortfolioData)

      await store.fetchPortfolioData(mockAddress)

      expect(store.xmblNFTs).toEqual(mockPortfolioData.nfts)
      expect(store.totalPortfolioValue).toBe('7500')
      expect(store.totalDeposited).toBe('1500')
      expect(store.totalAccruedYields).toBe('150')
      expect(store.currentAPY).toBe(16.85)
      expect(store.yieldSources).toEqual(mockPortfolioData.yieldSources)
      expect(store.lastUpdated).toBeInstanceOf(Date)
      expect(store.isLoading).toBe(false)
    })

    it('should handle portfolio data fetch failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getPortfolioData).mockRejectedValue(new Error('API Error'))

      await expect(store.fetchPortfolioData('0x123')).rejects.toThrow('API Error')
      expect(store.isLoading).toBe(false)
      expect(store.lastUpdated).toBeNull()
    })

    it('should set loading state during fetch', async () => {
      let resolvePortfolio: (value: any) => void
      const portfolioPromise = new Promise(resolve => { resolvePortfolio = resolve })

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getPortfolioData).mockReturnValue(portfolioPromise)

      const fetchPromise = store.fetchPortfolioData('0x123')

      expect(store.isLoading).toBe(true)

      resolvePortfolio!({
        nfts: [],
        totalPortfolioValue: '0',
        totalDeposited: '0',
        totalAccruedYields: '0',
        currentAPY: 0,
        yieldSources: []
      })

      await fetchPromise

      expect(store.isLoading).toBe(false)
    })

    it('should clear portfolio data on clear', () => {
      store.xmblNFTs = [{ tokenId: 1, balance: '1000' }]
      store.totalPortfolioValue = '5000'
      store.selectedNFTId = 1

      store.clearPortfolioData()

      expect(store.xmblNFTs).toEqual([])
      expect(store.totalPortfolioValue).toBe('0')
      expect(store.totalDeposited).toBe('0')
      expect(store.totalAccruedYields).toBe('0')
      expect(store.selectedNFTId).toBeNull()
      expect(store.lastUpdated).toBeNull()
    })
  })

  describe('NFT Balance Management', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        {
          tokenId: 1,
          tbaAddress: '0xabc123...',
          balance: '1000',
          depositedAmount: '500',
          yieldEarned: '50'
        },
        {
          tokenId: 2,
          tbaAddress: '0xdef456...',
          balance: '2000',
          depositedAmount: '1000',
          yieldEarned: '100'
        }
      ]
    })

    it('should refresh NFT balances successfully', async () => {
      const updatedBalances = [
        { tokenId: 1, balance: '1100', tbaAddress: '0xabc123...' },
        { tokenId: 2, balance: '2200', tbaAddress: '0xdef456...' }
      ]

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getNFTBalances).mockResolvedValue(updatedBalances)

      await store.refreshNFTBalances()

      expect(store.xmblNFTs[0].balance).toBe('1100')
      expect(store.xmblNFTs[1].balance).toBe('2200')
    })

    it('should handle NFT balance refresh failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getNFTBalances).mockRejectedValue(new Error('Balance fetch failed'))

      await expect(store.refreshNFTBalances()).rejects.toThrow('Balance fetch failed')
    })

    it('should get TBA balance for specific NFT', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getTBABalance).mockResolvedValue('1500')

      const balance = await store.getTBABalance(1)

      expect(balance).toBe('1500')
      expect(web3Service.getTBABalance).toHaveBeenCalledWith('0xabc123...')
    })

    it('should handle invalid NFT ID for TBA balance', async () => {
      await expect(store.getTBABalance(999)).rejects.toThrow('NFT not found')
    })
  })

  describe('Yield Management', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        {
          tokenId: 1,
          tbaAddress: '0xabc123...',
          balance: '1000',
          yieldEarned: '50',
          lastYieldClaim: new Date('2024-01-01')
        },
        {
          tokenId: 2,
          tbaAddress: '0xdef456...',
          balance: '2000',
          yieldEarned: '100',
          lastYieldClaim: new Date('2024-01-05')
        }
      ]
    })

    it('should refresh yield data successfully', async () => {
      const updatedYieldData = {
        nfts: [
          { tokenId: 1, yieldEarned: '75', apy: 16.5 },
          { tokenId: 2, yieldEarned: '125', apy: 19.2 }
        ],
        totalAccruedYields: '200',
        currentAPY: 17.85,
        yieldSources: [
          { source: 'Trading', amount: '120', percentage: 60 },
          { source: 'Mining', amount: '80', percentage: 40 }
        ]
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getYieldData).mockResolvedValue(updatedYieldData)

      await store.refreshYieldData()

      expect(store.xmblNFTs[0].yieldEarned).toBe('75')
      expect(store.xmblNFTs[1].yieldEarned).toBe('125')
      expect(store.totalAccruedYields).toBe('200')
      expect(store.currentAPY).toBe(17.85)
      expect(store.yieldSources).toEqual(updatedYieldData.yieldSources)
    })

    it('should handle yield data refresh failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getYieldData).mockRejectedValue(new Error('Yield fetch failed'))

      await expect(store.refreshYieldData()).rejects.toThrow('Yield fetch failed')
    })

    it('should claim yields for specific NFT', async () => {
      const mockTxHash = '0xclaimtx123...'

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.claimYields).mockResolvedValue(mockTxHash)

      const txHash = await store.claimYields(1)

      expect(txHash).toBe(mockTxHash)
      expect(web3Service.claimYields).toHaveBeenCalledWith(1)
    })

    it('should handle yield claim failures', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.claimYields).mockRejectedValue(new Error('Claim failed'))

      await expect(store.claimYields(1)).rejects.toThrow('Claim failed')
    })

    it('should claim yields for all NFTs', async () => {
      const mockTxHashes = ['0xtx1...', '0xtx2...']

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.batchClaimYields).mockResolvedValue(mockTxHashes)

      const txHashes = await store.claimAllYields()

      expect(txHashes).toEqual(mockTxHashes)
      expect(web3Service.batchClaimYields).toHaveBeenCalledWith([1, 2])
    })

    it('should handle batch yield claim failures', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.batchClaimYields).mockRejectedValue(new Error('Batch claim failed'))

      await expect(store.claimAllYields()).rejects.toThrow('Batch claim failed')
    })

    it('should update NFT yield data after successful claim', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.claimYields).mockResolvedValue('0xtx123...')

      await store.claimYields(1)

      // Should update yield claimed timestamp
      expect(store.xmblNFTs[0].lastYieldClaim).toBeInstanceOf(Date)
      expect(store.xmblNFTs[0].yieldEarned).toBe('0') // Reset after claim
    })
  })

  describe('NFT Selection', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        { tokenId: 1, balance: '1000', yieldEarned: '50' },
        { tokenId: 2, balance: '2000', yieldEarned: '100' }
      ]
    })

    it('should select NFT for operations', () => {
      store.selectNFT(2)

      expect(store.selectedNFTId).toBe(2)
    })

    it('should handle invalid NFT selection', () => {
      expect(() => store.selectNFT(999)).toThrow('NFT not found')
      expect(store.selectedNFTId).toBeNull()
    })

    it('should clear selection', () => {
      store.selectedNFTId = 1

      store.selectNFT(null)

      expect(store.selectedNFTId).toBeNull()
    })
  })

  describe('Auto-Refresh Management', () => {
    beforeEach(() => {
      store.xmblNFTs = [{ tokenId: 1, balance: '1000' }]
    })

    it('should toggle auto-refresh', () => {
      expect(store.autoRefresh).toBe(false)

      store.toggleAutoRefresh()

      expect(store.autoRefresh).toBe(true)

      store.toggleAutoRefresh()

      expect(store.autoRefresh).toBe(false)
    })

    it('should start auto-refresh', () => {
      store.startAutoRefresh()

      expect(store.autoRefresh).toBe(true)
      expect(store.refreshInterval).toBeTruthy()
    })

    it('should stop auto-refresh', () => {
      store.startAutoRefresh()
      const intervalId = store.refreshInterval

      store.stopAutoRefresh()

      expect(store.autoRefresh).toBe(false)
      expect(clearInterval).toHaveBeenCalledWith(intervalId)
    })

    it('should refresh data automatically at intervals', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getNFTBalances).mockResolvedValue([])
      vi.mocked(apiService.getYieldData).mockResolvedValue({
        nfts: [],
        totalAccruedYields: '0',
        currentAPY: 0,
        yieldSources: []
      })

      store.startAutoRefresh()

      vi.advanceTimersByTime(30000) // 30 seconds

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(apiService.getNFTBalances).toHaveBeenCalled()
      expect(apiService.getYieldData).toHaveBeenCalled()
    })

    it('should pause auto-refresh when tab becomes inactive', () => {
      store.startAutoRefresh()

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true
      })
      document.dispatchEvent(new Event('visibilitychange'))

      expect(store.isRefreshPaused).toBe(true)
    })

    it('should resume auto-refresh when tab becomes active', () => {
      store.isRefreshPaused = true

      // Simulate tab becoming visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      })
      document.dispatchEvent(new Event('visibilitychange'))

      expect(store.isRefreshPaused).toBe(false)
    })

    it('should stop auto-refresh when portfolio is cleared', () => {
      store.startAutoRefresh()

      store.clearPortfolioData()

      expect(store.autoRefresh).toBe(false)
    })
  })

  describe('Getters', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        {
          tokenId: 1,
          balance: '1000',
          depositedAmount: '500',
          yieldEarned: '50',
          usdValue: 2500,
          apy: 15.5
        },
        {
          tokenId: 2,
          balance: '2000',
          depositedAmount: '1000',
          yieldEarned: '100',
          usdValue: 5000,
          apy: 18.2
        }
      ]
      store.selectedNFTId = 1
      store.totalAccruedYields = '150'
    })

    it('should count total NFTs', () => {
      expect(store.totalNFTCount).toBe(2)
    })

    it('should get selected NFT data', () => {
      const selectedNFT = store.selectedNFTData

      expect(selectedNFT).toEqual(store.xmblNFTs[0])
      expect(selectedNFT?.tokenId).toBe(1)
    })

    it('should return null for no selection', () => {
      store.selectedNFTId = null

      expect(store.selectedNFTData).toBeNull()
    })

    it('should format total yields', () => {
      expect(store.formattedTotalYields).toBe('$150.00')
    })

    it('should calculate average NFT value', () => {
      expect(store.averageNFTValue).toBe('3750.00') // (2500 + 5000) / 2
    })

    it('should identify top performing NFT', () => {
      const topNFT = store.topPerformingNFT

      expect(topNFT?.tokenId).toBe(2)
      expect(topNFT?.apy).toBe(18.2)
    })

    it('should calculate yield APY breakdown', () => {
      expect(store.yieldAPYBreakdown).toBe('16.85%') // Weighted average
    })

    it('should check if data is stale', () => {
      store.lastUpdated = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago

      expect(store.isDataStale).toBe(true)

      store.lastUpdated = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago

      expect(store.isDataStale).toBe(false)
    })

    it('should find highest TBA balance', () => {
      expect(store.highestTBABalance).toBe('2000')
    })

    it('should handle empty NFT array in getters', () => {
      store.xmblNFTs = []

      expect(store.totalNFTCount).toBe(0)
      expect(store.averageNFTValue).toBe('0')
      expect(store.topPerformingNFT).toBeNull()
      expect(store.highestTBABalance).toBe('0')
    })
  })

  describe('WebSocket Real-time Updates', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        { tokenId: 1, balance: '1000', yieldEarned: '50' },
        { tokenId: 2, balance: '2000', yieldEarned: '100' }
      ]
    })

    it('should subscribe to portfolio updates', () => {
      store.subscribeToUpdates()

      expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('ws'))
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should handle NFT portfolio update events', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'nft_portfolio_updated',
          data: {
            tokenId: 1,
            balance: '1200',
            yieldEarned: '60'
          }
        })
      }

      messageHandler?.(mockEvent)

      expect(store.xmblNFTs[0].balance).toBe('1200')
      expect(store.xmblNFTs[0].yieldEarned).toBe('60')
    })

    it('should handle yield distribution events', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'yield_distributed',
          data: {
            totalYieldDistributed: '25',
            nftUpdates: [
              { tokenId: 1, yieldEarned: '62.5' },
              { tokenId: 2, yieldEarned: '112.5' }
            ]
          }
        })
      }

      messageHandler?.(mockEvent)

      expect(store.xmblNFTs[0].yieldEarned).toBe('62.5')
      expect(store.xmblNFTs[1].yieldEarned).toBe('112.5')
      expect(store.totalAccruedYields).toBe('175')
    })

    it('should handle TBA balance change events', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'tba_balance_changed',
          data: {
            tokenId: 2,
            newBalance: '2500',
            tbaAddress: '0xdef456...'
          }
        })
      }

      messageHandler?.(mockEvent)

      expect(store.xmblNFTs[1].balance).toBe('2500')
    })

    it('should handle NFT transaction confirmed events', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'nft_transaction_confirmed',
          data: {
            tokenId: 1,
            transactionType: 'yield_claim',
            yieldAmount: '50',
            newYieldBalance: '0'
          }
        })
      }

      messageHandler?.(mockEvent)

      expect(store.xmblNFTs[0].yieldEarned).toBe('0')
      expect(store.xmblNFTs[0].lastYieldClaim).toBeInstanceOf(Date)
    })

    it('should unsubscribe from updates', () => {
      store.subscribeToUpdates()
      store.unsubscribeFromUpdates()

      expect(mockWebSocket.close).toHaveBeenCalled()
    })

    it('should handle WebSocket connection errors', () => {
      store.subscribeToUpdates()

      const errorHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]

      errorHandler?.(new Error('Connection failed'))

      expect(store.wsConnectionStatus).toBe('failed')
    })

    it('should reconnect on WebSocket close', () => {
      store.subscribeToUpdates()

      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )?.[1]

      closeHandler?.()

      // Should attempt reconnect after delay
      vi.advanceTimersByTime(5000)

      expect(WebSocket).toHaveBeenCalledTimes(2)
    })
  })

  describe('Caching and Performance', () => {
    it('should cache portfolio data in localStorage', () => {
      const portfolioData = {
        xmblNFTs: [{ tokenId: 1, balance: '1000' }],
        totalPortfolioValue: '2500',
        lastUpdated: new Date()
      }

      store.$patch(portfolioData)

      const cached = JSON.parse(localStorage.getItem('portfolio_cache') || '{}')
      expect(cached.data).toBeTruthy()
      expect(cached.timestamp).toBeTruthy()
    })

    it('should load cached data on initialization', () => {
      const cachedData = {
        data: {
          xmblNFTs: [{ tokenId: 1, balance: '1000' }],
          totalPortfolioValue: '2500'
        },
        timestamp: Date.now(),
        expiry: Date.now() + 300000 // 5 minutes
      }

      localStorage.setItem('portfolio_cache', JSON.stringify(cachedData))

      store.loadCachedData()

      expect(store.xmblNFTs).toEqual(cachedData.data.xmblNFTs)
      expect(store.totalPortfolioValue).toBe('2500')
    })

    it('should not load expired cached data', () => {
      const expiredCache = {
        data: { xmblNFTs: [{ tokenId: 1 }] },
        timestamp: Date.now() - 3600000, // 1 hour ago
        expiry: Date.now() - 1000 // Expired
      }

      localStorage.setItem('portfolio_cache', JSON.stringify(expiredCache))

      store.loadCachedData()

      expect(store.xmblNFTs).toEqual([])
    })

    it('should implement data deduplication', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getPortfolioData).mockResolvedValue({
        nfts: [],
        totalPortfolioValue: '0',
        totalDeposited: '0',
        totalAccruedYields: '0',
        currentAPY: 0,
        yieldSources: []
      })

      // Multiple rapid calls should only result in one API call
      await Promise.all([
        store.fetchPortfolioData('0x123'),
        store.fetchPortfolioData('0x123'),
        store.fetchPortfolioData('0x123')
      ])

      expect(apiService.getPortfolioData).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle partial data update failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getNFTBalances).mockResolvedValue([])
      vi.mocked(apiService.getYieldData).mockRejectedValue(new Error('Yield service down'))

      // Should not fail completely if one service is down
      await store.refreshNFTBalances()

      expect(store.xmblNFTs).toEqual([]) // Balance update succeeded
    })

    it('should validate incoming data integrity', async () => {
      const invalidData = {
        nfts: [
          { tokenId: 'invalid', balance: null } // Invalid data
        ],
        totalPortfolioValue: 'not-a-number'
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getPortfolioData).mockResolvedValue(invalidData)

      await expect(store.fetchPortfolioData('0x123')).rejects.toThrow('Invalid data format')
    })

    it('should implement exponential backoff for failed requests', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getPortfolioData)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          nfts: [],
          totalPortfolioValue: '0',
          totalDeposited: '0',
          totalAccruedYields: '0',
          currentAPY: 0,
          yieldSources: []
        })

      await store.fetchPortfolioDataWithRetry('0x123')

      expect(apiService.getPortfolioData).toHaveBeenCalledTimes(3)
    })

    it('should maintain data consistency during updates', async () => {
      const initialData = [{ tokenId: 1, balance: '1000', yieldEarned: '50' }]
      store.xmblNFTs = [...initialData]

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getNFTBalances).mockRejectedValue(new Error('Update failed'))

      try {
        await store.refreshNFTBalances()
      } catch (error) {
        // Data should remain unchanged on failure
        expect(store.xmblNFTs).toEqual(initialData)
      }
    })
  })
})
