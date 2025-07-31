import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePortfolioStore } from '../../stores/portfolio'

// Create mock services that work with vi.fn()
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

// Mock localStorage for tests
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

// Setup global mocks
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage })
Object.defineProperty(global, 'WebSocket', { value: vi.fn() })

describe('Portfolio Store', () => {
  let store: ReturnType<typeof usePortfolioStore>
  let mockApiService: ReturnType<typeof createMockApiService>
  let mockWeb3Service: ReturnType<typeof createMockWeb3Service>

  beforeEach(async () => {
    setActivePinia(createPinia())

    // Create fresh mocks
    mockApiService = createMockApiService()
    mockWeb3Service = createMockWeb3Service()

    // Mock the service modules by replacing their methods
    const apiModule = await import('../../services/apiService')
    const web3Module = await import('../../services/web3Service')

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

  it('should select NFT successfully', () => {
    store.xmblNFTs = [
      { tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50' } as any,
      { tokenId: 2, tbaAddress: '0x2...', balance: '2000', yieldEarned: '100' } as any
    ]

    store.selectNFT(1)
    expect(store.selectedNFTId).toBe(1)
    expect(store.selectedNFTData?.tokenId).toBe(1)
  })

  it('should clear NFT selection', () => {
    store.xmblNFTs = [
      { tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50' } as any
    ]

    store.selectNFT(1)
    store.selectNFT(null)
    expect(store.selectedNFTId).toBeNull()
    expect(store.selectedNFTData).toBeNull()
  })

  it('should handle invalid NFT selection', () => {
    store.xmblNFTs = []
    expect(() => store.selectNFT(999)).toThrow('NFT not found')
  })

  it('should calculate total NFT count', () => {
    store.xmblNFTs = [
      { tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50', apy: 10, usdValue: 500 } as any,
      { tokenId: 2, tbaAddress: '0x2...', balance: '2000', yieldEarned: '100', apy: 20, usdValue: 1000 } as any
    ]

    expect(store.totalNFTCount).toBe(2)
  })

  it('should format total yields', () => {
    store.totalAccruedYields = '150'
    expect(store.formattedTotalYields).toBe('$150.00')
  })

  it('should calculate average NFT value', () => {
    store.xmblNFTs = [
      { tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50', apy: 10, usdValue: 500 } as any,
      { tokenId: 2, tbaAddress: '0x2...', balance: '2000', yieldEarned: '100', apy: 20, usdValue: 1000 } as any
    ]

    expect(store.averageNFTValue).toBe('750.00')
  })

  it('should find top performing NFT', () => {
    store.xmblNFTs = [
      { tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50', apy: 10, usdValue: 500 } as any,
      { tokenId: 2, tbaAddress: '0x2...', balance: '2000', yieldEarned: '100', apy: 20, usdValue: 1000 } as any
    ]

    expect(store.topPerformingNFT?.tokenId).toBe(2)
    expect(store.topPerformingNFT?.apy).toBe(20)
  })

  it('should find highest TBA balance', () => {
    store.xmblNFTs = [
      { tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50', apy: 10, usdValue: 500 } as any,
      { tokenId: 2, tbaAddress: '0x2...', balance: '2000', yieldEarned: '100', apy: 20, usdValue: 1000 } as any
    ]

    expect(store.highestTBABalance).toBe('2000')
  })

  it('should detect stale data', () => {
    expect(store.isDataStale).toBe(true) // No lastUpdated set

    store.lastUpdated = new Date()
    expect(store.isDataStale).toBe(false)

    store.lastUpdated = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
    expect(store.isDataStale).toBe(true)
  })

  it('should start auto-refresh', () => {
    store.startAutoRefresh()
    expect(store.autoRefresh).toBe(true)
    expect(store.refreshInterval).toBeTruthy()
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
