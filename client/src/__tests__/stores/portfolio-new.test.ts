import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePortfolioStore } from '../../stores/portfolio'

// Create proper stubs for services that will work
const createMockApiService = () => ({
  getUserPortfolio: vi.fn(),
  getYieldData: vi.fn(),
  getNFTBalances: vi.fn(),
  claimYields: vi.fn(),
  getTBABalance: vi.fn()
})

const createMockWeb3Service = () => ({
  getTBABalance: vi.fn(),
  claimYields: vi.fn(),
  batchClaimYields: vi.fn()
})

describe('Portfolio Store - Complete', () => {
  let store: ReturnType<typeof usePortfolioStore>
  let mockApiService: ReturnType<typeof createMockApiService>
  let mockWeb3Service: ReturnType<typeof createMockWeb3Service>

  beforeEach(async () => {
    setActivePinia(createPinia())

    // Create fresh mocks
    mockApiService = createMockApiService()
    mockWeb3Service = createMockWeb3Service()

    // Mock at the global level since vi.mock doesn't work
    const apiModule = await import('../../services/apiService')
    const web3Module = await import('../../services/web3Service')

    // Replace the methods directly
    Object.assign(apiModule.default, mockApiService)
    Object.assign(web3Module.web3Service, mockWeb3Service)

    store = usePortfolioStore()
    vi.clearAllMocks()

    // Set up default mock responses
    mockApiService.getUserPortfolio.mockResolvedValue({
      nfts: [
        {
          tokenId: 1,
          tbaAddress: '0x1...',
          balance: '100',
          yieldEarned: '10',
          metadata: { name: 'NFT 1', image: 'img1' },
          apy: 15,
          usdValue: 500
        }
      ],
      totalValue: '500',
      accruedYields: '10'
    })

    mockApiService.getYieldData.mockResolvedValue({ currentAPY: 5 })
    mockApiService.getNFTBalances.mockImplementation(async (tokenIds) =>
      tokenIds.map((id: number) => ({ tokenId: id, balance: '200', tbaAddress: `0x${id}...` }))
    )
    mockWeb3Service.getTBABalance.mockResolvedValue('300')
    mockWeb3Service.claimYields.mockImplementation(async (tokenId: number) => `0xtx${tokenId}...`)
    mockWeb3Service.batchClaimYields.mockImplementation(async (tokenIds: number[]) =>
      tokenIds.map(id => `0xtx${id}...`)
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with empty state', () => {
    expect(store.xmblNFTs).toEqual([])
    expect(store.totalPortfolioValue).toBe('0')
    expect(store.totalAccruedYields).toBe('0')
    expect(store.currentAPY).toBe(0)
    expect(store.selectedNFTId).toBeNull()
    expect(store.isLoading).toBe(false)
  })

  it('should fetch portfolio data successfully', async () => {
    await store.fetchPortfolioData('0x123')

    expect(store.xmblNFTs).toHaveLength(1)
    expect(store.xmblNFTs[0].tokenId).toBe(1)
    expect(store.totalPortfolioValue).toBe('500')
    expect(store.totalAccruedYields).toBe('10')
    expect(store.currentAPY).toBe(5)
    expect(store.lastUpdated).toBeInstanceOf(Date)
    expect(store.isLoading).toBe(false)
  })

  it('should handle portfolio data fetch failures', async () => {
    mockApiService.getUserPortfolio.mockRejectedValue(new Error('API Error'))

    await expect(store.fetchPortfolioData('0x123')).rejects.toThrow('API Error')
    expect(store.isLoading).toBe(false)
  })

  it('should clear portfolio data', () => {
    // Set up some data first
    store.xmblNFTs = [{
      tokenId: 1,
      tbaAddress: '0x1...',
      balance: '1000',
      yieldEarned: '50'
    } as any]
    store.selectedNFTId = 1

    store.clearPortfolioData()

    expect(store.xmblNFTs).toEqual([])
    expect(store.totalPortfolioValue).toBe('0')
    expect(store.totalAccruedYields).toBe('0')
    expect(store.selectedNFTId).toBeNull()
  })

  describe('NFT Balance Management', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        {
          tokenId: 1,
          tbaAddress: '0xabc123...',
          balance: '1000',
          yieldEarned: '50'
        } as any,
        {
          tokenId: 2,
          tbaAddress: '0xdef456...',
          balance: '2000',
          yieldEarned: '100'
        } as any
      ]
    })

    it('should refresh NFT balances successfully', async () => {
      const updatedBalances = [
        { tokenId: 1, balance: '1100', tbaAddress: '0xabc123...' },
        { tokenId: 2, balance: '2200', tbaAddress: '0xdef456...' }
      ]

      mockApiService.getNFTBalances.mockResolvedValue(updatedBalances)

      await store.refreshNFTBalances()

      expect(store.xmblNFTs[0].balance).toBe('1100')
      expect(store.xmblNFTs[1].balance).toBe('2200')
    })

    it('should handle NFT balance refresh failures', async () => {
      mockApiService.getNFTBalances.mockRejectedValue(new Error('Balance fetch failed'))

      await expect(store.refreshNFTBalances()).rejects.toThrow('Balance fetch failed')
    })

    it('should get TBA balance for specific NFT', async () => {
      mockWeb3Service.getTBABalance.mockResolvedValue('1500')

      const balance = await store.getTBABalance(1)

      expect(balance).toBe('1500')
      expect(mockWeb3Service.getTBABalance).toHaveBeenCalledWith('0xabc123...')
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
        } as any,
        {
          tokenId: 2,
          tbaAddress: '0xdef456...',
          balance: '2000',
          yieldEarned: '100',
          lastYieldClaim: new Date('2024-01-05')
        } as any
      ]
    })

    it('should refresh yield data successfully', async () => {
      await store.refreshYieldData()

      expect(store.currentAPY).toBe(5)
      expect(store.totalAccruedYields).toBe('150') // 50 + 100
    })

    it('should claim yields for specific NFT', async () => {
      const txHash = await store.claimYields(1)

      expect(txHash).toBe('0xtx1...')
      expect(store.xmblNFTs[0].yieldEarned).toBe('0')
      expect(store.xmblNFTs[0].lastYieldClaim).toBeInstanceOf(Date)
    })

    it('should claim yields for all NFTs', async () => {
      const txHashes = await store.claimAllYields()

      expect(txHashes).toEqual(['0xtx1...', '0xtx2...'])
      expect(store.xmblNFTs[0].yieldEarned).toBe('0')
      expect(store.xmblNFTs[1].yieldEarned).toBe('0')
    })
  })

  describe('NFT Selection', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        { tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50' } as any,
        { tokenId: 2, tbaAddress: '0x2...', balance: '2000', yieldEarned: '100' } as any
      ]
    })

    it('should select NFT successfully', () => {
      store.selectNFT(1)
      expect(store.selectedNFTId).toBe(1)
      expect(store.selectedNFTData?.tokenId).toBe(1)
    })

    it('should clear NFT selection', () => {
      store.selectNFT(1)
      store.selectNFT(null)
      expect(store.selectedNFTId).toBeNull()
      expect(store.selectedNFTData).toBeNull()
    })

    it('should handle invalid NFT selection', () => {
      expect(() => store.selectNFT(999)).toThrow('NFT not found')
    })
  })

  describe('Computed Properties', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        { tokenId: 1, balance: '1000', yieldEarned: '50', apy: 10, usdValue: 500 } as any,
        { tokenId: 2, balance: '2000', yieldEarned: '100', apy: 20, usdValue: 1000 } as any
      ]
      store.totalAccruedYields = '150'
    })

    it('should calculate total NFT count', () => {
      expect(store.totalNFTCount).toBe(2)
    })

    it('should format total yields', () => {
      expect(store.formattedTotalYields).toBe('$150.00')
    })

    it('should calculate average NFT value', () => {
      expect(store.averageNFTValue).toBe('750.00')
    })

    it('should find top performing NFT', () => {
      expect(store.topPerformingNFT?.tokenId).toBe(2)
      expect(store.topPerformingNFT?.apy).toBe(20)
    })

    it('should calculate yield APY breakdown', () => {
      // Weighted average: (500/1500 * 10) + (1000/1500 * 20) = 3.33 + 13.33 = 16.67%
      expect(store.yieldAPYBreakdown).toBe('16.67%')
    })

    it('should find highest TBA balance', () => {
      expect(store.highestTBABalance).toBe('2000')
    })

    it('should detect stale data', () => {
      expect(store.isDataStale).toBe(true) // No lastUpdated set

      store.lastUpdated = new Date()
      expect(store.isDataStale).toBe(false)

      store.lastUpdated = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
      expect(store.isDataStale).toBe(true)
    })
  })

  describe('Auto-refresh', () => {
    it('should start auto-refresh', () => {
      vi.useFakeTimers()

      store.startAutoRefresh()

      expect(store.autoRefresh).toBe(true)
      expect(store.refreshInterval).toBeTruthy()

      vi.useRealTimers()
    })

    it('should stop auto-refresh', () => {
      store.startAutoRefresh()
      store.stopAutoRefresh()

      expect(store.autoRefresh).toBe(false)
      expect(store.refreshInterval).toBeNull()
    })

    it('should toggle auto-refresh', () => {
      expect(store.autoRefresh).toBe(false)

      store.toggleAutoRefresh()
      expect(store.autoRefresh).toBe(true)

      store.toggleAutoRefresh()
      expect(store.autoRefresh).toBe(false)
    })
  })

  describe('WebSocket Updates', () => {
    beforeEach(() => {
      store.xmblNFTs = [
        { tokenId: 1, balance: '1000', yieldEarned: '50' } as any,
        { tokenId: 2, balance: '2000', yieldEarned: '100' } as any
      ]
    })

    it('should subscribe to updates', () => {
      // Mock WebSocket
      const mockWS = {
        addEventListener: vi.fn(),
        close: vi.fn()
      }
      global.WebSocket = vi.fn(() => mockWS) as any

      store.subscribeToUpdates()

      expect(global.WebSocket).toHaveBeenCalled()
      expect(mockWS.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
      expect(store.wsConnectionStatus).toBe('connected')
    })

    it('should unsubscribe from updates', () => {
      const mockWS = {
        addEventListener: vi.fn(),
        close: vi.fn()
      }
      store.ws = mockWS as any

      store.unsubscribeFromUpdates()

      expect(mockWS.close).toHaveBeenCalled()
      expect(store.ws).toBeNull()
    })
  })

  describe('Caching', () => {
    it('should load cached data', () => {
      const cachedData = {
        data: {
          xmblNFTs: [{ tokenId: 1, balance: '1000', yieldEarned: '50' }],
          totalPortfolioValue: '1000',
          currentAPY: 5
        },
        timestamp: Date.now(),
        expiry: Date.now() + 300000 // 5 minutes
      }

      localStorage.setItem('portfolio_cache', JSON.stringify(cachedData))

      store.loadCachedData()

      expect(store.xmblNFTs).toEqual(cachedData.data.xmblNFTs)
      expect(store.totalPortfolioValue).toBe('1000')
      expect(store.currentAPY).toBe(5)
    })

    it('should not load expired cached data', () => {
      const expiredCache = {
        data: { xmblNFTs: [{ tokenId: 1 }] },
        timestamp: Date.now() - 400000, // 6.67 minutes ago
        expiry: Date.now() - 100000 // Expired 1.67 minutes ago
      }

      localStorage.setItem('portfolio_cache', JSON.stringify(expiredCache))

      store.loadCachedData()

      expect(store.xmblNFTs).toEqual([]) // Should remain empty
    })
  })
})
