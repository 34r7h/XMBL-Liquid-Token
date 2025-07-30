import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTransactionsStore } from '../../stores/transactions'

// Mock API service
vi.mock('../../services/apiService', () => ({
  apiService: {
    getTransactionHistory: vi.fn(),
    exportTransactions: vi.fn(),
    getTransactionDetails: vi.fn()
  }
}))

// Mock web3Service
vi.mock('../../services/web3Service', () => ({
  web3Service: {
    watchTransaction: vi.fn(),
    getTransactionReceipt: vi.fn(),
    estimateConfirmationTime: vi.fn()
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

describe('Transactions Store', () => {
  let store: ReturnType<typeof useTransactionsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTransactionsStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      expect(store.transactions).toEqual([])
      expect(store.pendingTransactions).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.filters).toEqual({
        type: 'all',
        status: 'all',
        dateRange: { from: null, to: null },
        amountRange: { min: null, max: null },
        tokenType: 'all',
        searchTerm: ''
      })
      expect(store.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false
      })
      expect(store.realTimeUpdates).toBe(true)
      expect(store.lastSyncTime).toBeNull()
    })

    it('should initialize with empty transaction arrays', () => {
      expect(Array.isArray(store.transactions)).toBe(true)
      expect(Array.isArray(store.pendingTransactions)).toBe(true)
      expect(store.transactions.length).toBe(0)
      expect(store.pendingTransactions.length).toBe(0)
    })
  })

  describe('Transaction History Fetching', () => {
    it('should fetch transaction history successfully', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890'
      const mockTransactions = {
        transactions: [
          {
            id: '1',
            hash: '0xabc123...',
            type: 'deposit',
            tokenSymbol: 'ETH',
            amount: '1.0',
            timestamp: new Date('2024-01-15T10:30:00Z'),
            status: 'confirmed',
            blockNumber: 18500000,
            gasUsed: '150000',
            gasFee: '0.003',
            fromAddress: mockAddress,
            toAddress: '0xvault...'
          },
          {
            id: '2',
            hash: '0xdef456...',
            type: 'yield_claim',
            tokenSymbol: 'USDC',
            amount: '150.75',
            timestamp: new Date('2024-01-14T15:45:00Z'),
            status: 'pending',
            blockNumber: null,
            gasUsed: null,
            gasFee: '0.0025',
            fromAddress: '0xvault...',
            toAddress: mockAddress
          }
        ],
        total: 25,
        hasMore: true
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTransactionHistory).mockResolvedValue(mockTransactions)

      await store.fetchTransactionHistory(mockAddress)

      expect(store.transactions).toEqual(mockTransactions.transactions)
      expect(store.pagination.total).toBe(25)
      expect(store.pagination.hasMore).toBe(true)
      expect(store.lastSyncTime).toBeInstanceOf(Date)
      expect(store.isLoading).toBe(false)
    })

    it('should handle transaction history fetch failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTransactionHistory).mockRejectedValue(new Error('API Error'))

      await expect(store.fetchTransactionHistory('0x123')).rejects.toThrow('API Error')
      expect(store.isLoading).toBe(false)
      expect(store.lastSyncTime).toBeNull()
    })

    it('should set loading state during fetch', async () => {
      let resolveTransactions: (value: any) => void
      const transactionsPromise = new Promise(resolve => { resolveTransactions = resolve })

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTransactionHistory).mockReturnValue(transactionsPromise)

      const fetchPromise = store.fetchTransactionHistory('0x123')

      expect(store.isLoading).toBe(true)

      resolveTransactions!({
        transactions: [],
        total: 0,
        hasMore: false
      })

      await fetchPromise

      expect(store.isLoading).toBe(false)
    })

    it('should clear transaction history', () => {
      store.transactions = [{ id: '1', hash: '0xabc', type: 'deposit' }]
      store.pendingTransactions = [{ hash: '0xpending', type: 'withdraw' }]
      store.pagination.total = 10

      store.clearTransactionHistory()

      expect(store.transactions).toEqual([])
      expect(store.pendingTransactions).toEqual([])
      expect(store.pagination.total).toBe(0)
      expect(store.pagination.page).toBe(1)
      expect(store.lastSyncTime).toBeNull()
    })
  })

  describe('Pending Transaction Management', () => {
    it('should add pending transaction', () => {
      const pendingTx = {
        hash: '0xpending123...',
        type: 'deposit',
        tokenSymbol: 'ETH',
        amount: '2.5',
        timestamp: new Date(),
        status: 'pending',
        estimatedConfirmationTime: 180, // 3 minutes
        gasPrice: '20000000000',
        nonce: 42
      }

      store.addPendingTransaction(pendingTx)

      expect(store.pendingTransactions).toContain(pendingTx)
      expect(store.pendingTransactions.length).toBe(1)
    })

    it('should update transaction status', () => {
      const txHash = '0xpending123...'
      store.pendingTransactions = [
        {
          hash: txHash,
          type: 'deposit',
          status: 'pending',
          confirmations: 0
        }
      ]

      store.updateTransactionStatus(txHash, 'confirmed', {
        blockNumber: 18500001,
        gasUsed: '150000',
        confirmations: 12
      })

      const updatedTx = store.pendingTransactions.find(tx => tx.hash === txHash)
      expect(updatedTx?.status).toBe('confirmed')
      expect(updatedTx?.blockNumber).toBe(18500001)
      expect(updatedTx?.gasUsed).toBe('150000')
      expect(updatedTx?.confirmations).toBe(12)
    })

    it('should remove confirmed transaction from pending list', () => {
      const txHash = '0xconfirmed123...'
      store.pendingTransactions = [
        { hash: txHash, type: 'deposit', status: 'pending' },
        { hash: '0xother...', type: 'withdraw', status: 'pending' }
      ]

      store.removePendingTransaction(txHash)

      expect(store.pendingTransactions).toHaveLength(1)
      expect(store.pendingTransactions[0].hash).toBe('0xother...')
    })

    it('should move confirmed pending transaction to main list', () => {
      const confirmedTx = {
        hash: '0xconfirmed123...',
        type: 'deposit',
        status: 'confirmed',
        blockNumber: 18500001,
        timestamp: new Date(),
        tokenSymbol: 'ETH',
        amount: '1.5'
      }

      store.pendingTransactions = [confirmedTx]

      store.confirmPendingTransaction(confirmedTx.hash, {
        blockNumber: 18500001,
        gasUsed: '150000',
        confirmations: 12
      })

      expect(store.pendingTransactions).toHaveLength(0)
      expect(store.transactions).toHaveLength(1)
      expect(store.transactions[0].hash).toBe('0xconfirmed123...')
      expect(store.transactions[0].status).toBe('confirmed')
    })

    it('should handle failed transactions', () => {
      const txHash = '0xfailed123...'
      store.pendingTransactions = [
        { hash: txHash, type: 'deposit', status: 'pending' }
      ]

      store.updateTransactionStatus(txHash, 'failed', {
        error: 'Insufficient gas',
        blockNumber: 18500001
      })

      const failedTx = store.pendingTransactions.find(tx => tx.hash === txHash)
      expect(failedTx?.status).toBe('failed')
      expect(failedTx?.error).toBe('Insufficient gas')
    })
  })

  describe('Transaction Filtering', () => {
    beforeEach(() => {
      store.transactions = [
        {
          id: '1',
          hash: '0xabc123...',
          type: 'deposit',
          tokenSymbol: 'ETH',
          amount: '1.0',
          status: 'confirmed',
          timestamp: new Date('2024-01-15T10:30:00Z')
        },
        {
          id: '2',
          hash: '0xdef456...',
          type: 'withdraw',
          tokenSymbol: 'USDC',
          amount: '500',
          status: 'pending',
          timestamp: new Date('2024-01-14T15:45:00Z')
        },
        {
          id: '3',
          hash: '0x789abc...',
          type: 'yield_claim',
          tokenSymbol: 'ETH',
          amount: '0.05',
          status: 'confirmed',
          timestamp: new Date('2024-01-13T09:15:00Z')
        }
      ]
    })

    it('should filter transactions by type', () => {
      const filters = { type: 'deposit', status: 'all', searchTerm: '' }
      store.filterTransactions(filters)

      expect(store.filters.type).toBe('deposit')
      const filtered = store.filteredTransactions
      expect(filtered).toHaveLength(1)
      expect(filtered[0].type).toBe('deposit')
    })

    it('should filter transactions by status', () => {
      const filters = { type: 'all', status: 'confirmed', searchTerm: '' }
      store.filterTransactions(filters)

      expect(store.filters.status).toBe('confirmed')
      const filtered = store.filteredTransactions
      expect(filtered).toHaveLength(2)
      filtered.forEach(tx => expect(tx.status).toBe('confirmed'))
    })

    it('should filter transactions by token type', () => {
      const filters = { type: 'all', status: 'all', tokenType: 'ETH', searchTerm: '' }
      store.filterTransactions(filters)

      expect(store.filters.tokenType).toBe('ETH')
      const filtered = store.filteredTransactions
      expect(filtered).toHaveLength(2)
      filtered.forEach(tx => expect(tx.tokenSymbol).toBe('ETH'))
    })

    it('should filter transactions by search term', () => {
      const filters = { type: 'all', status: 'all', searchTerm: '0xabc123' }
      store.filterTransactions(filters)

      expect(store.filters.searchTerm).toBe('0xabc123')
      const filtered = store.filteredTransactions
      expect(filtered).toHaveLength(1)
      expect(filtered[0].hash).toContain('0xabc123')
    })

    it('should filter transactions by date range', () => {
      const filters = {
        type: 'all',
        status: 'all',
        dateRange: {
          from: new Date('2024-01-14T00:00:00Z'),
          to: new Date('2024-01-15T23:59:59Z')
        },
        searchTerm: ''
      }
      store.filterTransactions(filters)

      const filtered = store.filteredTransactions
      expect(filtered).toHaveLength(2) // Transactions from Jan 14-15
    })

    it('should filter transactions by amount range', () => {
      const filters = {
        type: 'all',
        status: 'all',
        amountRange: { min: 0.1, max: 100 },
        searchTerm: ''
      }
      store.filterTransactions(filters)

      const filtered = store.filteredTransactions
      expect(filtered).toHaveLength(2) // 1.0 ETH and 0.05 ETH
    })

    it('should combine multiple filters', () => {
      const filters = {
        type: 'all',
        status: 'confirmed',
        tokenType: 'ETH',
        searchTerm: ''
      }
      store.filterTransactions(filters)

      const filtered = store.filteredTransactions
      expect(filtered).toHaveLength(2) // Confirmed ETH transactions
      filtered.forEach(tx => {
        expect(tx.status).toBe('confirmed')
        expect(tx.tokenSymbol).toBe('ETH')
      })
    })

    it('should clear all filters', () => {
      store.filters = {
        type: 'deposit',
        status: 'confirmed',
        tokenType: 'ETH',
        searchTerm: 'test'
      }

      store.clearFilters()

      expect(store.filters.type).toBe('all')
      expect(store.filters.status).toBe('all')
      expect(store.filters.tokenType).toBe('all')
      expect(store.filters.searchTerm).toBe('')
    })
  })

  describe('Pagination', () => {
    beforeEach(() => {
      // Setup initial transactions
      store.transactions = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        hash: `0x${i}...`,
        type: 'deposit',
        amount: '1.0',
        timestamp: new Date()
      }))
      store.pagination = { page: 1, limit: 10, total: 25, hasMore: true }
    })

    it('should load more transactions', async () => {
      const additionalTransactions = {
        transactions: Array.from({ length: 10 }, (_, i) => ({
          id: `${i + 16}`,
          hash: `0x${i + 16}...`,
          type: 'withdraw',
          amount: '0.5',
          timestamp: new Date()
        })),
        total: 25,
        hasMore: false
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTransactionHistory).mockResolvedValue(additionalTransactions)

      await store.loadMoreTransactions()

      expect(store.transactions).toHaveLength(25) // 15 + 10
      expect(store.pagination.page).toBe(2)
      expect(store.pagination.hasMore).toBe(false)
    })

    it('should handle load more failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTransactionHistory).mockRejectedValue(new Error('Load failed'))

      await expect(store.loadMoreTransactions()).rejects.toThrow('Load failed')
      expect(store.pagination.page).toBe(1) // Should not increment on failure
    })

    it('should not load more when no more available', async () => {
      store.pagination.hasMore = false

      await store.loadMoreTransactions()

      expect(store.pagination.page).toBe(1) // Should not change
    })

    it('should reset pagination on new search', () => {
      store.pagination = { page: 3, limit: 10, total: 50, hasMore: true }

      store.filterTransactions({ type: 'deposit', searchTerm: 'new search' })

      expect(store.pagination.page).toBe(1)
    })
  })

  describe('Transaction Export', () => {
    beforeEach(() => {
      store.transactions = [
        {
          id: '1',
          hash: '0xabc123...',
          type: 'deposit',
          tokenSymbol: 'ETH',
          amount: '1.0',
          timestamp: new Date('2024-01-15T10:30:00Z'),
          status: 'confirmed',
          gasFee: '0.003'
        },
        {
          id: '2',
          hash: '0xdef456...',
          type: 'withdraw',
          tokenSymbol: 'USDC',
          amount: '500',
          timestamp: new Date('2024-01-14T15:45:00Z'),
          status: 'confirmed',
          gasFee: '0.0025'
        }
      ]
    })

    it('should export transactions as CSV', async () => {
      const mockCSVData = 'Date,Type,Token,Amount,Status,Gas Fee,Hash\n2024-01-15,deposit,ETH,1.0,confirmed,0.003,0xabc123...'

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.exportTransactions).mockResolvedValue(mockCSVData)

      await store.exportTransactions('csv')

      expect(apiService.exportTransactions).toHaveBeenCalledWith(store.transactions, 'csv')
    })

    it('should export transactions as JSON', async () => {
      const mockJSONData = JSON.stringify(store.transactions, null, 2)

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.exportTransactions).mockResolvedValue(mockJSONData)

      await store.exportTransactions('json')

      expect(apiService.exportTransactions).toHaveBeenCalledWith(store.transactions, 'json')
    })

    it('should handle export failures', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.exportTransactions).mockRejectedValue(new Error('Export failed'))

      await expect(store.exportTransactions('csv')).rejects.toThrow('Export failed')
    })

    it('should export filtered transactions only', async () => {
      store.filterTransactions({ type: 'deposit', status: 'all', searchTerm: '' })

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.exportTransactions).mockResolvedValue('csv-data')

      await store.exportTransactions('csv')

      expect(apiService.exportTransactions).toHaveBeenCalledWith(
        store.filteredTransactions,
        'csv'
      )
    })

    it('should trigger file download after export', async () => {
      const mockBlob = new Blob(['csv-data'], { type: 'text/csv' })
      const mockURL = 'blob:mock-url'

      global.URL.createObjectURL = vi.fn().mockReturnValue(mockURL)
      global.URL.revokeObjectURL = vi.fn()

      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      }
      document.createElement = vi.fn().mockReturnValue(mockLink)

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.exportTransactions).mockResolvedValue('csv-data')

      await store.exportTransactions('csv')

      expect(mockLink.href).toBe(mockURL)
      expect(mockLink.download).toContain('.csv')
      expect(mockLink.click).toHaveBeenCalled()
    })
  })

  describe('Real-time Transaction Monitoring', () => {
    beforeEach(() => {
      store.pendingTransactions = [
        {
          hash: '0xpending123...',
          type: 'deposit',
          status: 'pending',
          confirmations: 0
        }
      ]
    })

    it('should subscribe to real-time updates', () => {
      store.subscribeToUpdates()

      expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('ws'))
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should handle transaction confirmed events', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'transaction_confirmed',
          data: {
            hash: '0xpending123...',
            blockNumber: 18500001,
            gasUsed: '150000',
            confirmations: 12,
            status: 'confirmed'
          }
        })
      }

      messageHandler?.(mockEvent)

      const updatedTx = store.pendingTransactions.find(tx => tx.hash === '0xpending123...')
      expect(updatedTx?.status).toBe('confirmed')
      expect(updatedTx?.blockNumber).toBe(18500001)
      expect(updatedTx?.confirmations).toBe(12)
    })

    it('should handle new transaction events', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'new_transaction',
          data: {
            hash: '0xnew123...',
            type: 'yield_claim',
            tokenSymbol: 'USDC',
            amount: '75.5',
            timestamp: new Date().toISOString(),
            status: 'pending'
          }
        })
      }

      messageHandler?.(mockEvent)

      expect(store.pendingTransactions).toHaveLength(2)
      expect(store.pendingTransactions[1].hash).toBe('0xnew123...')
    })

    it('should handle transaction failed events', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'transaction_failed',
          data: {
            hash: '0xpending123...',
            error: 'Out of gas',
            status: 'failed'
          }
        })
      }

      messageHandler?.(mockEvent)

      const failedTx = store.pendingTransactions.find(tx => tx.hash === '0xpending123...')
      expect(failedTx?.status).toBe('failed')
      expect(failedTx?.error).toBe('Out of gas')
    })

    it('should update confirmation counts', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockEvent = {
        data: JSON.stringify({
          type: 'confirmation_update',
          data: {
            hash: '0xpending123...',
            confirmations: 5,
            estimatedTimeToConfirm: 90 // seconds
          }
        })
      }

      messageHandler?.(mockEvent)

      const updatedTx = store.pendingTransactions.find(tx => tx.hash === '0xpending123...')
      expect(updatedTx?.confirmations).toBe(5)
      expect(updatedTx?.estimatedTimeToConfirm).toBe(90)
    })

    it('should unsubscribe from updates', () => {
      store.subscribeToUpdates()
      store.unsubscribeFromUpdates()

      expect(mockWebSocket.close).toHaveBeenCalled()
      expect(store.realTimeUpdates).toBe(false)
    })

    it('should handle WebSocket connection errors', () => {
      store.subscribeToUpdates()

      const errorHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]

      errorHandler?.(new Error('Connection failed'))

      expect(store.wsConnectionStatus).toBe('failed')
    })

    it('should reconnect on WebSocket disconnect', () => {
      vi.useFakeTimers()

      store.subscribeToUpdates()

      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )?.[1]

      closeHandler?.()

      // Should attempt reconnect after delay
      vi.advanceTimersByTime(5000)

      expect(WebSocket).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })

  describe('Getters', () => {
    beforeEach(() => {
      store.transactions = [
        {
          id: '1',
          type: 'deposit',
          tokenSymbol: 'ETH',
          amount: '1.0',
          status: 'confirmed',
          usdValue: 2500
        },
        {
          id: '2',
          type: 'withdraw',
          tokenSymbol: 'USDC',
          amount: '500',
          status: 'confirmed',
          usdValue: 500
        },
        {
          id: '3',
          type: 'yield_claim',
          tokenSymbol: 'ETH',
          amount: '0.05',
          status: 'pending',
          usdValue: 125
        }
      ]
      store.pendingTransactions = [
        { hash: '0xpending1', type: 'deposit', status: 'pending' },
        { hash: '0xpending2', type: 'withdraw', status: 'pending' }
      ]
    })

    it('should filter transactions correctly', () => {
      store.filters.type = 'deposit'

      const filtered = store.filteredTransactions
      expect(filtered).toHaveLength(1)
      expect(filtered[0].type).toBe('deposit')
    })

    it('should count pending transactions', () => {
      expect(store.pendingCount).toBe(2)
    })

    it('should calculate total transaction value', () => {
      expect(store.totalTransactionValue).toBe(3125) // 2500 + 500 + 125
    })

    it('should get recent transactions', () => {
      const recent = store.recentTransactions
      expect(recent).toHaveLength(3) // All transactions since we have < 10
    })

    it('should group transactions by type', () => {
      const grouped = store.transactionsByType

      expect(grouped.deposit).toHaveLength(1)
      expect(grouped.withdraw).toHaveLength(1)
      expect(grouped.yield_claim).toHaveLength(1)
    })

    it('should handle empty transaction arrays', () => {
      store.transactions = []
      store.pendingTransactions = []

      expect(store.pendingCount).toBe(0)
      expect(store.totalTransactionValue).toBe(0)
      expect(store.recentTransactions).toEqual([])
      expect(Object.keys(store.transactionsByType)).toHaveLength(0)
    })
  })

  describe('Performance and Caching', () => {
    it('should cache transaction data in localStorage', () => {
      const transactions = [
        { id: '1', hash: '0xabc', type: 'deposit', amount: '1.0' }
      ]

      store.transactions = transactions

      const cached = JSON.parse(localStorage.getItem('transactions_cache') || '{}')
      expect(cached.data).toEqual(transactions)
      expect(cached.timestamp).toBeTruthy()
    })

    it('should load cached transactions on initialization', () => {
      const cachedData = {
        data: [{ id: '1', hash: '0xabc', type: 'deposit' }],
        timestamp: Date.now(),
        expiry: Date.now() + 300000 // 5 minutes
      }

      localStorage.setItem('transactions_cache', JSON.stringify(cachedData))

      store.loadCachedTransactions()

      expect(store.transactions).toEqual(cachedData.data)
    })

    it('should not load expired cached data', () => {
      const expiredCache = {
        data: [{ id: '1', hash: '0xabc' }],
        timestamp: Date.now() - 3600000, // 1 hour ago
        expiry: Date.now() - 1000 // Expired
      }

      localStorage.setItem('transactions_cache', JSON.stringify(expiredCache))

      store.loadCachedTransactions()

      expect(store.transactions).toEqual([])
    })

    it('should implement debounced filtering', () => {
      vi.useFakeTimers()

      const filterSpy = vi.spyOn(store, 'applyFilters')

      // Rapid filter changes
      store.filterTransactions({ type: 'deposit', searchTerm: 'a' })
      store.filterTransactions({ type: 'deposit', searchTerm: 'ab' })
      store.filterTransactions({ type: 'deposit', searchTerm: 'abc' })

      // Should only apply filters once after debounce
      vi.advanceTimersByTime(300)

      expect(filterSpy).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('should paginate large transaction sets efficiently', () => {
      const largeTransactionSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i + 1}`,
        hash: `0x${i}...`,
        type: 'deposit',
        amount: '1.0'
      }))

      store.transactions = largeTransactionSet
      store.pagination.limit = 20

      const paginatedTransactions = store.paginatedTransactions
      expect(paginatedTransactions).toHaveLength(20)
      expect(paginatedTransactions[0].id).toBe('1')
    })
  })

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTransactionHistory).mockRejectedValue(new Error('Network error'))

      await expect(store.fetchTransactionHistory('0x123')).rejects.toThrow('Network error')

      // Should maintain previous state on error
      expect(store.isLoading).toBe(false)
    })

    it('should validate incoming transaction data', async () => {
      const invalidData = {
        transactions: [
          { id: null, hash: 'invalid' } // Invalid data
        ],
        total: 'not-a-number'
      }

      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTransactionHistory).mockResolvedValue(invalidData)

      await expect(store.fetchTransactionHistory('0x123')).rejects.toThrow('Invalid data format')
    })

    it('should handle WebSocket message parsing errors', () => {
      store.subscribeToUpdates()

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const invalidEvent = {
        data: 'invalid-json'
      }

      // Should not throw error, just log and continue
      expect(() => messageHandler?.(invalidEvent)).not.toThrow()
    })

    it('should implement retry logic for failed requests', async () => {
      const { apiService } = await import('../../services/apiService')
      vi.mocked(apiService.getTransactionHistory)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          transactions: [],
          total: 0,
          hasMore: false
        })

      await store.fetchTransactionHistoryWithRetry('0x123')

      expect(apiService.getTransactionHistory).toHaveBeenCalledTimes(3)
    })
  })
})
