import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePortfolioStore } from '../../stores/portfolio'

// Ensure localStorage is available for testing
const localStorageData: Record<string, string> = {}
const localStorageMock = {
    getItem: vi.fn((key: string) => localStorageData[key] || null),
    setItem: vi.fn((key: string, value: string) => {
        localStorageData[key] = value
    }),
    removeItem: vi.fn((key: string) => {
        delete localStorageData[key]
    }),
    clear: vi.fn(() => {
        Object.keys(localStorageData).forEach(key => delete localStorageData[key])
    })
}

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true
})

describe('Portfolio Store Complete Tests', () => {
    let store: ReturnType<typeof usePortfolioStore>

    beforeEach(() => {
        setActivePinia(createPinia())
        store = usePortfolioStore()
    })

    // Test 1: Store Initialization
    it('should initialize with correct default state', () => {
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
        expect(store.refreshInterval).toBeNull()
        expect(store.ws).toBeNull()
        expect(store.wsConnectionStatus).toBe('idle')
        expect(store.isRefreshPaused).toBe(false)
    })

    // Test 2: Computed Properties
    describe('Computed Properties', () => {
        beforeEach(() => {
            // Manually set NFT data for computed property tests
            store.xmblNFTs = [
                {
                    tokenId: 1,
                    tbaAddress: '0x1...',
                    balance: '1000',
                    yieldEarned: '50',
                    apy: 10,
                    usdValue: 500
                } as any,
                {
                    tokenId: 2,
                    tbaAddress: '0x2...',
                    balance: '2000',
                    yieldEarned: '100',
                    apy: 20,
                    usdValue: 1000
                } as any
            ]
            store.totalAccruedYields = '150'
        })

        it('should calculate totalNFTCount correctly', () => {
            expect(store.totalNFTCount).toBe(2)
        })

        it('should format total yields correctly', () => {
            expect(store.formattedTotalYields).toBe('$150.00')
        })

        it('should calculate average NFT value correctly', () => {
            expect(store.averageNFTValue).toBe('750.00')
        })

        it('should find top performing NFT correctly', () => {
            expect(store.topPerformingNFT?.tokenId).toBe(2)
            expect(store.topPerformingNFT?.apy).toBe(20)
        })

        it('should calculate yield APY breakdown correctly', () => {
            // Weighted average: (500/1500 * 10) + (1000/1500 * 20) = 16.67%
            expect(store.yieldAPYBreakdown).toBe('16.67%')
        })

        it('should find highest TBA balance correctly', () => {
            expect(store.highestTBABalance).toBe('2000')
        })

        it('should detect stale data correctly', () => {
            expect(store.isDataStale).toBe(true) // No lastUpdated set

            store.lastUpdated = new Date()
            expect(store.isDataStale).toBe(false)

            store.lastUpdated = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
            expect(store.isDataStale).toBe(true)
        })
    })

    // Test 3: Selected NFT Data
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

        it('should return null when no NFT is selected', () => {
            expect(store.selectedNFTData).toBeNull()
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

    // Test 4: Data Management
    describe('Data Management', () => {
        it('should clear all portfolio data', () => {
            // Set up some data first
            store.xmblNFTs = [{ tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50' } as any]
            store.totalPortfolioValue = '1000'
            store.selectedNFTId = 1
            store.currentAPY = 15
            store.autoRefresh = true

            store.clearPortfolioData()

            expect(store.xmblNFTs).toEqual([])
            expect(store.totalPortfolioValue).toBe('0')
            expect(store.totalDeposited).toBe('0')
            expect(store.totalAccruedYields).toBe('0')
            expect(store.currentAPY).toBe(0)
            expect(store.yieldSources).toEqual([])
            expect(store.selectedNFTId).toBeNull()
            expect(store.lastUpdated).toBeNull()
            expect(store.autoRefresh).toBe(false)
        })
    })

    // Test 5: Auto-refresh functionality
    describe('Auto-refresh', () => {
        it('should start auto-refresh correctly', () => {
            // Skip timer testing due to vi.useFakeTimers unavailability
            store.startAutoRefresh()

            expect(store.autoRefresh).toBe(true)
            expect(store.refreshInterval).toBeTruthy()

            // Clean up
            store.stopAutoRefresh()
        })

        it('should stop auto-refresh correctly', () => {
            store.startAutoRefresh()
            store.stopAutoRefresh()

            expect(store.autoRefresh).toBe(false)
            expect(store.refreshInterval).toBeNull()
        })

        it('should toggle auto-refresh correctly', () => {
            expect(store.autoRefresh).toBe(false)

            store.toggleAutoRefresh()
            expect(store.autoRefresh).toBe(true)

            store.toggleAutoRefresh()
            expect(store.autoRefresh).toBe(false)
        })
    })

    // Test 6: WebSocket functionality
    describe('WebSocket Management', () => {
        it('should handle WebSocket subscription', () => {
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

        it('should handle WebSocket unsubscription', () => {
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

    // Test 7: Caching functionality
    describe('Caching', () => {
        it('should load cached data when available and not expired', () => {
            const cachedData = {
                data: {
                    xmblNFTs: [{ tokenId: 1, balance: '1000', yieldEarned: '50' }],
                    totalPortfolioValue: '1000',
                    currentAPY: 5
                },
                timestamp: Date.now(),
                expiry: Date.now() + 300000 // 5 minutes from now
            }

            localStorage.setItem('portfolio_cache', JSON.stringify(cachedData))

            store.loadCachedData()

            // Compare just the structure that gets loaded
            expect(store.xmblNFTs).toHaveLength(1)
            expect(store.xmblNFTs[0].tokenId).toBe(1)
            expect(store.xmblNFTs[0].balance).toBe('1000')
            expect(store.xmblNFTs[0].yieldEarned).toBe('50')
            expect(store.totalPortfolioValue).toBe('1000')
            expect(store.currentAPY).toBe(5)
        })

        it('should not load expired cached data', () => {
            const expiredCache = {
                data: { xmblNFTs: [{ tokenId: 1 }] },
                timestamp: Date.now() - 400000,
                expiry: Date.now() - 100000 // Expired
            }

            localStorage.setItem('portfolio_cache', JSON.stringify(expiredCache))

            store.loadCachedData()

            expect(store.xmblNFTs).toEqual([]) // Should remain empty
        })

        it('should handle invalid cached data gracefully', () => {
            localStorage.setItem('portfolio_cache', 'invalid-json')

            expect(() => store.loadCachedData()).not.toThrow()
            expect(store.xmblNFTs).toEqual([])
        })
    })

    // Test 8: Edge cases and error handling
    describe('Edge Cases', () => {
        it('should handle empty NFT arrays in computed properties', () => {
            store.xmblNFTs = []

            expect(store.totalNFTCount).toBe(0)
            expect(store.averageNFTValue).toBe('0')
            expect(store.topPerformingNFT).toBeNull()
            expect(store.yieldAPYBreakdown).toBe('0%')
            expect(store.highestTBABalance).toBe('0')
        })

        it('should handle zero values in calculations', () => {
            store.xmblNFTs = [
                { tokenId: 1, balance: '0', yieldEarned: '0', apy: 0, usdValue: 0 } as any
            ]

            expect(store.averageNFTValue).toBe('0.00')
            expect(store.yieldAPYBreakdown).toBe('0%')
            expect(store.highestTBABalance).toBe('0')
        })

        it('should handle missing optional properties', () => {
            store.xmblNFTs = [
                { tokenId: 1, tbaAddress: '0x1...', balance: '1000', yieldEarned: '50' } as any
            ]

            expect(store.averageNFTValue).toBe('0.00') // usdValue is undefined
            expect(store.topPerformingNFT?.apy).toBeUndefined()
        })
    })
})
