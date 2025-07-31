/**
 * transactions.ts
 *
 * PURPOSE:
 * Pinia store for managing user transaction history, pending transactions,
 * and transaction status monitoring across the application.
 *
 * STATE:
 * - transactions: Transaction[] - User's transaction history
 * - pendingTransactions: PendingTransaction[] - Transactions awaiting confirmation
 * - isLoading: boolean - Transaction data loading state
 * - filters: TransactionFilters - Active transaction filters
 * - pagination: PaginationState - Pagination for large transaction sets
 * - realTimeUpdates: boolean - Real-time update toggle
 * - lastSyncTime: Date | null - Last synchronization timestamp
 *
 * ACTIONS:
 * - fetchTransactionHistory(address: string): Promise<void> - Load user transactions
 * - addPendingTransaction(tx: PendingTransaction): void - Add pending transaction
 * - updateTransactionStatus(txHash: string, status: string): void - Update transaction status
 * - removePendingTransaction(txHash: string): void - Remove confirmed transaction
 * - filterTransactions(filters: TransactionFilters): void - Apply transaction filters
 * - loadMoreTransactions(): Promise<void> - Load additional transactions (pagination)
 * - exportTransactions(format: 'csv' | 'json'): Promise<void> - Export transaction data
 * - clearTransactionHistory(): void - Clear all transaction data
 *
 * GETTERS:
 * - filteredTransactions: Transaction[] - Transactions matching current filters
 * - pendingCount: number - Number of pending transactions
 * - totalTransactionValue: string - Sum of all transaction values
 * - recentTransactions: Transaction[] - Most recent transactions (last 10)
 * - transactionsByType: Record<string, Transaction[]> - Transactions grouped by type
 *
 * REQUIREMENTS:
 * - Must monitor pending transactions for confirmation
 * - Must provide real-time updates for new transactions
 * - Must support filtering and searching
 * - Must handle large transaction histories efficiently
 * - Must provide export functionality
 *
 * CONNECTED SYSTEM COMPONENTS:
 * - TransactionHistory.vue - Primary consumer of transaction data
 * - DepositForm.vue - Adds deposit transactions
 * - XMBLPortfolio.vue - Adds yield claim transactions
 * - blockchainMonitor.ts (server) - Source of transaction data
 * - web3Service.ts - Monitors transaction confirmations
 * - apiService.ts - Fetches historical transaction data
 *
 * TRANSACTION TYPES:
 * - deposit - Token deposits to vault
 * - withdraw - XMBL token withdrawals
 * - yield_claim - Dividend yield claims
 * - swap - Token swaps via 1inch
 * - approval - Token approvals
 *
 * REAL-TIME MONITORING:
 * - WebSocket connection for live updates
 * - Blockchain event monitoring
 * - Transaction confirmation tracking
 * - Status change notifications
 *
 * FILTERS SUPPORTED:
 * - Transaction type (deposit, withdraw, yield, swap)
 * - Date range (last 7 days, 30 days, custom)
 * - Amount range (min/max values)
 * - Status (pending, confirmed, failed)
 * - Token type (ETH, USDC, WBTC, etc.)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '../services/apiService'
import type { TransactionHistory } from '../services/apiService'
import web3Service from '../services/web3Service'

// Transaction and filter interfaces
interface Transaction {
  id: string
  hash: string
  type: 'deposit' | 'withdraw' | 'yield_claim' | 'swap' | 'approval'
  amount: string
  token: string
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: Date
  gasUsed?: string
  gasPrice?: string
  from: string
  to?: string
  blockNumber?: number
  confirmations?: number
}

interface PendingTransaction {
  hash: string
  type: Transaction['type']
  amount: string
  token: string
  timestamp: Date
  estimatedConfirmTime?: Date
}

interface TransactionFilters {
  type?: Transaction['type'] | 'all'
  status?: Transaction['status'] | 'all'
  dateRange?: {
    start: Date
    end: Date
  } | 'last7days' | 'last30days' | 'all'
  minAmount?: string
  maxAmount?: string
  token?: string
}

interface PaginationState {
  currentPage: number
  pageSize: number
  totalPages: number
  totalItems: number
  hasMore: boolean
}

export const useTransactionsStore = defineStore('transactions', () => {
  // === STATE ===
  const transactions = ref<Transaction[]>([])
  const pendingTransactions = ref<PendingTransaction[]>([])
  const isLoading = ref<boolean>(false)
  const filters = ref<TransactionFilters>({
    type: 'all',
    status: 'all',
    dateRange: 'all'
  })
  const pagination = ref<PaginationState>({
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
    hasMore: false
  })
  const realTimeUpdates = ref<boolean>(true)
  const lastSyncTime = ref<Date | null>(null)
  const error = ref<string | null>(null)

  // === GETTERS ===
  const filteredTransactions = computed(() => {
    let filtered = [...transactions.value]

    // Filter by type
    if (filters.value.type && filters.value.type !== 'all') {
      filtered = filtered.filter(tx => tx.type === filters.value.type)
    }

    // Filter by status
    if (filters.value.status && filters.value.status !== 'all') {
      filtered = filtered.filter(tx => tx.status === filters.value.status)
    }

    // Filter by date range
    if (filters.value.dateRange && filters.value.dateRange !== 'all') {
      const now = new Date()
      let startDate: Date

      if (filters.value.dateRange === 'last7days') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else if (filters.value.dateRange === 'last30days') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      } else if (typeof filters.value.dateRange === 'object') {
        startDate = filters.value.dateRange.start
        const endDate = filters.value.dateRange.end
        filtered = filtered.filter(tx =>
          tx.timestamp >= startDate && tx.timestamp <= endDate
        )
      }

      if (typeof filters.value.dateRange === 'string') {
        filtered = filtered.filter(tx => tx.timestamp >= startDate!)
      }
    }

    // Filter by amount range
    if (filters.value.minAmount) {
      const minAmount = parseFloat(filters.value.minAmount)
      filtered = filtered.filter(tx => parseFloat(tx.amount) >= minAmount)
    }

    if (filters.value.maxAmount) {
      const maxAmount = parseFloat(filters.value.maxAmount)
      filtered = filtered.filter(tx => parseFloat(tx.amount) <= maxAmount)
    }

    // Filter by token
    if (filters.value.token) {
      filtered = filtered.filter(tx => tx.token === filters.value.token)
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  })

  const pendingCount = computed(() => pendingTransactions.value.length)

  const totalTransactionValue = computed(() => {
    const total = filteredTransactions.value.reduce((sum, tx) => {
      if (tx.type === 'deposit' || tx.type === 'yield_claim') {
        return sum + parseFloat(tx.amount)
      }
      return sum
    }, 0)
    return total.toFixed(4)
  })

  const recentTransactions = computed(() => {
    return filteredTransactions.value.slice(0, 10)
  })

  const transactionsByType = computed(() => {
    const grouped: Record<string, Transaction[]> = {}
    filteredTransactions.value.forEach(tx => {
      if (!grouped[tx.type]) {
        grouped[tx.type] = []
      }
      grouped[tx.type].push(tx)
    })
    return grouped
  })

  // === ACTIONS ===

  /**
   * Fetch transaction history for user
   */
  const fetchTransactionHistory = async (address: string): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      const history = await apiService.getTransactionHistory(address)

      // Transform API data to our Transaction format
      transactions.value = history.map((tx: TransactionHistory) => ({
        id: tx.id,
        hash: tx.hash,
        type: tx.type as Transaction['type'],
        amount: tx.amount,
        token: 'ETH', // Default to ETH, could be extracted from tx data
        status: tx.status as Transaction['status'],
        timestamp: new Date(tx.timestamp),
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        from: address, // Assume user is sender
        to: undefined // Would need to be extracted from tx data
      }))

      lastSyncTime.value = new Date()
      updatePagination()

    } catch (err: any) {
      error.value = err.message || 'Failed to fetch transaction history'
      console.error('Failed to fetch transaction history:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Add pending transaction
   */
  const addPendingTransaction = (tx: PendingTransaction): void => {
    // Check if already exists
    const exists = pendingTransactions.value.find(p => p.hash === tx.hash)
    if (!exists) {
      pendingTransactions.value.push(tx)

      // Start monitoring for confirmation
      monitorTransaction(tx.hash)
    }
  }

  /**
   * Update transaction status
   */
  const updateTransactionStatus = (txHash: string, status: Transaction['status']): void => {
    // Update in transactions list
    const tx = transactions.value.find(t => t.hash === txHash)
    if (tx) {
      tx.status = status
    }

    // Remove from pending if confirmed or failed
    if (status === 'confirmed' || status === 'failed') {
      removePendingTransaction(txHash)
    }
  }

  /**
   * Remove pending transaction
   */
  const removePendingTransaction = (txHash: string): void => {
    const index = pendingTransactions.value.findIndex(tx => tx.hash === txHash)
    if (index > -1) {
      pendingTransactions.value.splice(index, 1)
    }
  }

  /**
   * Apply transaction filters
   */
  const filterTransactions = (newFilters: Partial<TransactionFilters>): void => {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.currentPage = 1 // Reset to first page
  }

  /**
   * Load more transactions (pagination)
   */
  const loadMoreTransactions = async (): Promise<void> => {
    if (!pagination.value.hasMore || isLoading.value) return

    pagination.value.currentPage++
    // In a real implementation, this would fetch the next page from the API
    // For now, we'll just mark as no more data
    pagination.value.hasMore = false
  }

  /**
   * Export transactions
   */
  const exportTransactions = async (format: 'csv' | 'json'): Promise<void> => {
    try {
      const data = filteredTransactions.value

      if (format === 'csv') {
        const csv = convertToCSV(data)
        downloadFile(csv, 'transactions.csv', 'text/csv')
      } else if (format === 'json') {
        const json = JSON.stringify(data, null, 2)
        downloadFile(json, 'transactions.json', 'application/json')
      }

    } catch (err: any) {
      console.error('Failed to export transactions:', err)
      throw err
    }
  }

  /**
   * Clear all transaction data
   */
  const clearTransactionHistory = (): void => {
    transactions.value = []
    pendingTransactions.value = []
    lastSyncTime.value = null
    error.value = null
    pagination.value = {
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      totalItems: 0,
      hasMore: false
    }
  }

  /**
   * Subscribe to real-time updates
   */
  const subscribeToUpdates = (): void => {
    if (realTimeUpdates.value) {
      // WebSocket implementation would go here
      // For now, we'll use polling for pending transactions
      setInterval(() => {
        checkPendingTransactions()
      }, 30000) // Check every 30 seconds
    }
  }

  /**
   * Unsubscribe from updates
   */
  const unsubscribeFromUpdates = (): void => {
    realTimeUpdates.value = false
  }

  // === HELPER METHODS ===

  /**
   * Monitor transaction for confirmation
   */
  const monitorTransaction = async (txHash: string): Promise<void> => {
    try {
      // Poll for transaction receipt
      const checkStatus = async () => {
        try {
          // This would be implemented in web3Service
          // const receipt = await web3Service.getTransactionReceipt(txHash)
          // if (receipt) {
          //   updateTransactionStatus(txHash, receipt.status === 1 ? 'confirmed' : 'failed')
          // }

          // For now, simulate confirmation after 2 minutes
          setTimeout(() => {
            updateTransactionStatus(txHash, 'confirmed')
          }, 2 * 60 * 1000)

        } catch (err) {
          console.error(`Error checking transaction ${txHash}:`, err)
        }
      }

      checkStatus()
    } catch (err) {
      console.error(`Failed to monitor transaction ${txHash}:`, err)
    }
  }

  /**
   * Check status of all pending transactions
   */
  const checkPendingTransactions = async (): Promise<void> => {
    for (const tx of pendingTransactions.value) {
      await monitorTransaction(tx.hash)
    }
  }

  /**
   * Update pagination state
   */
  const updatePagination = (): void => {
    const totalItems = transactions.value.length
    const totalPages = Math.ceil(totalItems / pagination.value.pageSize)

    pagination.value.totalItems = totalItems
    pagination.value.totalPages = totalPages
    pagination.value.hasMore = pagination.value.currentPage < totalPages
  }

  /**
   * Convert transactions to CSV
   */
  const convertToCSV = (data: Transaction[]): string => {
    const headers = ['Date', 'Type', 'Amount', 'Token', 'Status', 'Hash', 'Gas Used']
    const rows = data.map(tx => [
      tx.timestamp.toISOString(),
      tx.type,
      tx.amount,
      tx.token,
      tx.status,
      tx.hash,
      tx.gasUsed || ''
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  /**
   * Download file
   */
  const downloadFile = (content: string, filename: string, mimeType: string): void => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return {
    // State
    transactions,
    pendingTransactions,
    isLoading,
    filters,
    pagination,
    realTimeUpdates,
    lastSyncTime,
    error,

    // Getters
    filteredTransactions,
    pendingCount,
    totalTransactionValue,
    recentTransactions,
    transactionsByType,

    // Actions
    fetchTransactionHistory,
    addPendingTransaction,
    updateTransactionStatus,
    removePendingTransaction,
    filterTransactions,
    loadMoreTransactions,
    exportTransactions,
    clearTransactionHistory,
    subscribeToUpdates,
    unsubscribeFromUpdates
  }
})
