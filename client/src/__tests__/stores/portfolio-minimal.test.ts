import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePortfolioStore } from '../../stores/portfolio'

describe('Portfolio Store - Minimal', () => {
    let store: ReturnType<typeof usePortfolioStore>

    beforeEach(() => {
        setActivePinia(createPinia())
        store = usePortfolioStore()
    })

    it('should initialize with empty state', () => {
        expect(store.xmblNFTs).toEqual([])
        expect(store.totalPortfolioValue).toBe('0')
        expect(store.totalAccruedYields).toBe('0')
        expect(store.currentAPY).toBe(0)
        expect(store.selectedNFTId).toBeNull()
        expect(store.isLoading).toBe(false)
    })

    it('should calculate total NFT count correctly', () => {
        // Manually set data to test computed properties
        store.xmblNFTs = [
            { tokenId: 1, balance: '1000', yieldEarned: '50', apy: 10, usdValue: 500 } as any,
            { tokenId: 2, balance: '2000', yieldEarned: '100', apy: 20, usdValue: 1000 } as any
        ]

        expect(store.totalNFTCount).toBe(2)
    })

    it('should format total yields correctly', () => {
        store.totalAccruedYields = '150'
        expect(store.formattedTotalYields).toBe('$150.00')
    })

    it('should calculate average NFT value', () => {
        store.xmblNFTs = [
            { tokenId: 1, balance: '1000', yieldEarned: '50', apy: 10, usdValue: 500 } as any,
            { tokenId: 2, balance: '2000', yieldEarned: '100', apy: 20, usdValue: 1000 } as any
        ]

        expect(store.averageNFTValue).toBe('750.00')
    })

    it('should find top performing NFT', () => {
        store.xmblNFTs = [
            { tokenId: 1, balance: '1000', yieldEarned: '50', apy: 10, usdValue: 500 } as any,
            { tokenId: 2, balance: '2000', yieldEarned: '100', apy: 20, usdValue: 1000 } as any
        ]

        expect(store.topPerformingNFT?.tokenId).toBe(2)
        expect(store.topPerformingNFT?.apy).toBe(20)
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

    it('should detect stale data', () => {
        expect(store.isDataStale).toBe(true) // No lastUpdated set

        store.lastUpdated = new Date()
        expect(store.isDataStale).toBe(false)

        store.lastUpdated = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
        expect(store.isDataStale).toBe(true)
    })
})
