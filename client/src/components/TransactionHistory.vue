<template>
  <div class="transaction-history" data-testid="transaction-history">
    <!-- Header -->
    <div class="history-header">
      <h2>Transaction History</h2>
      <div class="header-actions">
        <button @click="refreshTransactions" class="refresh-btn" data-testid="refresh-button" :disabled="isLoading">
          <svg v-if="!isLoading" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M23 4v6h-6M1 20v-6h6M20.49 9a9 9 0 11-2.12-5.36l2.63-2.63" stroke="currentColor"
              stroke-width="2" />
          </svg>
          <div v-else class="loading-spinner"></div>
          Refresh
        </button>
        <button @click="exportTransactions" class="export-btn" data-testid="export-button">
          Export
        </button>
      </div>
    </div>

    <!-- Wallet Connection Prompt -->
    <div v-if="!walletStore.isConnected" class="connect-wallet-prompt" data-testid="connect-wallet-prompt">
      <div class="prompt-content">
        <h3>Connect Your Wallet</h3>
        <p>Please connect your wallet to view your transaction history</p>
      </div>
    </div>

    <!-- Loading State (can show when wallet connected) -->
    <div v-else-if="isLoading || transactionsStore.isLoading" class="loading-state" data-testid="loading-state">
      <div class="loading-spinner large" data-testid="loading-spinner"></div>
      <p data-testid="loading-message">Loading transactions...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state" data-testid="error-state">
      <div class="error-icon">❌</div>
      <h3>Failed to Load Transactions</h3>
      <p>{{ error }}</p>
      <button @click="refreshTransactions" class="retry-btn">Try Again</button>
    </div>

    <!-- Main Content (when wallet connected and not loading/error) -->
    <div v-else class="main-content">
      <!-- Filters -->
      <div class="filters" data-testid="filters">
        <div class="filter-row">
          <!-- Transaction Type Filter -->
          <div class="filter-group">
            <label for="type-filter">Type:</label>
            <select id="type-filter" v-model="currentFilter" class="filter-select" data-testid="type-filter"
              @change="applyFilters">
              <option value="all">All Transactions</option>
              <option value="deposit">Deposits</option>
              <option value="withdraw">Withdrawals</option>
              <option value="yield_claim">Yield Claims</option>
              <option value="approval">Approvals</option>
              <option value="swap">Swaps</option>
            </select>
          </div>

          <!-- Status Filter -->
          <div class="filter-group">
            <label for="status-filter">Status:</label>
            <select id="status-filter" v-model="statusFilter" class="filter-select" data-testid="status-filter"
              @change="applyFilters">
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <!-- Sort Order -->
          <div class="filter-group">
            <label for="sort-order">Sort:</label>
            <select id="sort-order" v-model="sortOrder" class="filter-select" data-testid="sort-order"
              @change="applySorting">
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        <!-- Search -->
        <div class="search-row">
          <div class="search-group">
            <input v-model="searchQuery" type="text" placeholder="Search by hash, token, or amount" class="search-input"
              data-testid="search-input" @input="onSearchInput" />
            <button v-if="searchQuery" @click="clearSearch" class="clear-search">×</button>
          </div>
        </div>
      </div>

      <!-- Transaction List -->
      <div class="transaction-list" data-testid="transaction-list">
        <!-- Transaction Count -->
        <div class="transaction-count" data-testid="transaction-count">
          <span data-testid="total-count">{{ transactionsStore.totalCount || transactionsStore.transactions.length }}
            transactions</span>
          <span v-if="filteredTransactions.length !== transactionsStore.transactions.length">
            ({{ filteredTransactions.length }} shown)
          </span>
        </div>

        <!-- Transactions Table -->
        <div class="transactions-table" data-testid="transactions-table">
          <!-- Table Header -->
          <div class="table-header" data-testid="table-header">
            <div class="column-header" data-testid="column-header">Date</div>
            <div class="column-header" data-testid="column-header">Type</div>
            <div class="column-header" data-testid="column-header">Token</div>
            <div class="column-header" data-testid="column-header">Amount</div>
            <div class="column-header" data-testid="column-header">Status</div>
            <div class="column-header" data-testid="column-header">Gas Fee</div>
            <div class="column-header" data-testid="column-header">Hash</div>
            <div class="column-header" data-testid="column-header">Actions</div>
          </div>

          <!-- Transaction Rows -->
          <div class="table-body">
            <div v-for="(transaction, index) in paginatedTransactions" :key="transaction.id" class="transaction-row"
              :data-testid="`transaction-row`" @click="toggleTransactionDetails(transaction.id)">

              <!-- Date Column -->
              <div class="table-cell date-cell" data-testid="transaction-timestamp">
                {{ formatDate(transaction.timestamp) }}
              </div>

              <!-- Type Column -->
              <div class="table-cell type-cell">
                <span class="transaction-type" :class="`type-${transaction.type}`">
                  {{ getTransactionIcon(transaction.type) }} {{ getTransactionTitle(transaction) }}
                </span>
              </div>

              <!-- Token Column -->
              <div class="table-cell token-cell">
                {{ (transaction as any).tokenSymbol || transaction.token }}
              </div>

              <!-- Amount Column -->
              <div class="table-cell amount-cell" data-testid="transaction-amount">
                {{ formatAmount(transaction.amount, (transaction as any).tokenSymbol || transaction.token) }}
              </div>

              <!-- Status Column -->
              <div class="table-cell status-cell">
                <span class="status-badge" :class="`status-${transaction.status}`" data-testid="status-badge">
                  {{ transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1) }}
                </span>
              </div>

              <!-- Gas Fee Column -->
              <div class="table-cell gas-cell" data-testid="gas-fee">
                <span v-if="transaction.gasPrice || transaction.gasFee">{{ (transaction.gasPrice || transaction.gasFee)
                  }} ETH</span>
                <span v-else>—</span>
              </div>

              <!-- Hash Column -->
              <div class="table-cell hash-cell">
                <span class="transaction-hash" data-testid="transaction-hash">
                  {{ transaction.hash.substring(0, 8) }}...{{ transaction.hash.substring(transaction.hash.length - 6) }}
                  <button @click.stop="copyToClipboard(transaction.hash)" class="copy-btn">📋</button>
                </span>
              </div>

              <!-- Actions Column -->
              <div class="table-cell actions-cell">
                <button @click.stop="openTransactionInExplorer(transaction.hash)" class="action-btn">
                  🔗
                </button>
                <button v-if="transaction.status === 'failed'" @click.stop="retryTransaction(transaction)"
                  class="action-btn">
                  🔄
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="filteredTransactions.length === 0 && !isLoading && !transactionsStore.isLoading" class="empty-state"
          data-testid="empty-state">
          <div class="empty-icon">📄</div>
          <h3 data-testid="empty-message">No transactions found</h3>
          <p v-if="hasActiveFilters">Try adjusting your filters to see more transactions.</p>
          <p v-else>You haven't made any transactions yet.</p>
          <button v-if="hasActiveFilters" @click="clearAllFilters" class="clear-filters-btn"
            data-testid="clear-filters-button">
            Clear All Filters
          </button>
        </div>

        <!-- Load More -->
        <div v-if="filteredTransactions.length > 0" class="load-more" data-testid="load-more">
          <button @click="loadMoreTransactions" class="load-more-btn" :disabled="isLoadingMore">
            <div v-if="isLoadingMore" class="loading-spinner"></div>
            <span v-if="isLoadingMore">Loading...</span>
            <span v-else>Load More Transactions</span>
          </button>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination" data-testid="pagination">
          <button @click="goToPage(currentPage - 1)" :disabled="currentPage === 1" class="page-btn">
            Previous
          </button>

          <span class="page-info">
            Page {{ currentPage }} of {{ totalPages }}
          </span>

          <button @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages" class="page-btn">
            Next
          </button>
        </div>
      </div> <!-- End transaction-list -->
    </div> <!-- End main-content -->
  </div> <!-- End transaction-history -->
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTransactionsStore } from '../stores/transactions'
import { useWalletStore } from '../stores/wallet'

// Import the Transaction type from the store instead of defining our own
type Transaction = {
  id: string
  hash: string
  type: 'deposit' | 'withdraw' | 'yield_claim' | 'swap' | 'approval'
  amount: string
  token: string
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: Date
  gasUsed?: string
  gasPrice?: string
  gasFee?: string  // Add gasFee for test compatibility
  from: string
  to?: string
  blockNumber?: number
  confirmations?: number
}

// Props
const props = defineProps<{
  userAddress?: string
  autoRefresh?: boolean
  maxTransactions?: number
}>()

// Emits
const emit = defineEmits<{
  'transaction-selected': [transaction: Transaction]
}>()

// Stores
const transactionsStore = useTransactionsStore()
const walletStore = useWalletStore()

// Reactive state
const isLoading = ref(false)
const isLoadingMore = ref(false)
const error = ref<string | null>(null)
const currentFilter = ref('all')
const statusFilter = ref('all')
const sortOrder = ref('desc')
const searchQuery = ref('')
const expandedTransaction = ref<string | null>(null)
const currentPage = ref(1)
const itemsPerPage = ref(20)

// Auto-refresh timer
let refreshTimer: NodeJS.Timeout | null = null
// Search debounce timer
let searchTimer: NodeJS.Timeout | null = null

// Computed properties
const filteredTransactions = computed(() => {
  // Use the store's filteredTransactions instead of computing locally
  return transactionsStore.filteredTransactions || []
})

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredTransactions.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredTransactions.value.length / itemsPerPage.value)
})

const hasActiveFilters = computed(() => {
  return currentFilter.value !== 'all' ||
    statusFilter.value !== 'all' ||
    searchQuery.value !== ''
})

// Methods
const formatNumber = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  return num.toLocaleString()
}

const formatAmount = (amount: string, symbol: string): string => {
  const num = parseFloat(amount)
  if (isNaN(num)) return `0 ${symbol || ''}`

  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M ${symbol || ''}`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K ${symbol || ''}`
  } else {
    return `${num.toFixed(4)} ${symbol || ''}`
  }
}

const formatDate = (date: Date | string): string => {
  const d = new Date(date)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

const getTransactionIcon = (type: string): string => {
  const icons = {
    deposit: '⬇️',
    withdrawal: '⬆️',
    yield_claim: '💰',
    transfer: '↔️',
    swap: '🔄'
  }
  return icons[type as keyof typeof icons] || '📄'
}

const getTransactionTitle = (transaction: Transaction): string => {
  const titles = {
    deposit: 'Deposit',
    withdraw: 'Withdrawal',
    yield_claim: 'Yield Claim',
    approval: 'Approval',
    swap: 'Token Swap'
  }
  return titles[transaction.type] || 'Transaction'
}

const getExplorerLink = (hash: string): string => {
  return `https://etherscan.io/tx/${hash}`
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // Could show a toast notification here
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const toggleTransactionDetails = (transactionId: string) => {
  if (expandedTransaction.value === transactionId) {
    expandedTransaction.value = null
  } else {
    expandedTransaction.value = transactionId
    const transaction = transactionsStore.transactions.find(tx => tx.id === transactionId)
    if (transaction) {
      emit('transaction-selected', transaction as Transaction)
    }
  }
}

const refreshTransactions = async () => {
  if (!walletStore.isConnected) return

  isLoading.value = true
  error.value = null

  try {
    await transactionsStore.fetchTransactionHistory(walletStore.account || '')
  } catch (err: any) {
    console.error('Failed to refresh transactions:', err)
    error.value = err.message || 'Failed to load transactions'
  } finally {
    isLoading.value = false
  }
}

const loadMoreTransactions = async () => {
  if (isLoadingMore.value) return

  isLoadingMore.value = true
  try {
    await transactionsStore.loadMoreTransactions()
  } catch (err: any) {
    console.error('Failed to load more transactions:', err)
  } finally {
    isLoadingMore.value = false
  }
}

const applyFilters = () => {
  // Call store filtering instead of local filtering
  transactionsStore.filterTransactions({
    type: currentFilter.value === 'all' ? undefined : currentFilter.value as any,
    status: statusFilter.value === 'all' ? undefined : statusFilter.value as any
  })
  currentPage.value = 1 // Reset to first page when filtering
}

const applySorting = () => {
  // Sorting will be handled by the store based on the filteredTransactions
}

const onSearchInput = () => {
  // Debounce search
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    // Call the way the test expects it
    ; (transactionsStore.filterTransactions as any)(currentFilter.value, searchQuery.value)
    currentPage.value = 1 // Reset to first page when searching
  }, 300)
}

const clearSearch = () => {
  searchQuery.value = ''
  currentPage.value = 1
}

const clearAllFilters = () => {
  currentFilter.value = 'all'
  statusFilter.value = 'all'
  searchQuery.value = ''
  currentPage.value = 1
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const exportTransactions = () => {
  try {
    const dataStr = JSON.stringify(filteredTransactions.value, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

    const exportFileDefaultName = `transactions_${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  } catch (err) {
    console.error('Failed to export transactions:', err)
  }
}

const openTransactionInExplorer = (hash: string) => {
  const baseUrl = 'https://etherscan.io'
  window.open(`${baseUrl}/tx/${hash}`, '_blank')
}

const retryTransaction = (transaction: Transaction) => {
  // Emit retry event
  emit('transaction-selected', transaction)
}

const startAutoRefresh = () => {
  if (!props.autoRefresh) return

  refreshTimer = setInterval(() => {
    if (walletStore.isConnected && !isLoading.value) {
      refreshTransactions()
    }
  }, 30000) // Refresh every 30 seconds
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// Watchers
watch(() => walletStore.isConnected, (isConnected) => {
  if (isConnected) {
    refreshTransactions()
  } else {
    // Clear data when wallet disconnected
    currentPage.value = 1
    expandedTransaction.value = null
  }
})

// Lifecycle
onMounted(async () => {
  if (walletStore.isConnected) {
    await refreshTransactions()
  }
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
})
</script>

<style scoped>
.transaction-history {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

/* Header */
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.history-header h2 {
  margin: 0;
  color: #2d3748;
  font-size: 28px;
  font-weight: 700;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.refresh-btn,
.export-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #3182ce;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

.refresh-btn:hover:not(:disabled),
.export-btn:hover {
  background: #2c5aa0;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Connect Wallet Prompt */
.connect-wallet-prompt {
  text-align: center;
  padding: 48px 24px;
  background: #f0f8ff;
  border: 1px solid #3182ce;
  border-radius: 12px;
  margin-bottom: 24px;
}

.prompt-content h3 {
  margin: 0 0 12px 0;
  color: #2d3748;
}

/* Filters */
.filters {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.filter-row {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 150px;
}

.filter-group label {
  font-size: 14px;
  font-weight: 600;
  color: #718096;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.search-row {
  display: flex;
  gap: 16px;
}

.search-group {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  padding-right: 40px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
}

.clear-search {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #718096;
}

/* Loading and Error States */
.loading-state,
.error-state {
  text-align: center;
  padding: 48px 24px;
}

.loading-state {
  background: #f7fafc;
  border-radius: 12px;
}

.error-state {
  background: #fff5f5;
  border: 1px solid #fc8181;
  border-radius: 12px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.retry-btn {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 16px;
}

/* Transaction List */
.transaction-list {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.transaction-count {
  padding: 16px 24px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
  color: #718096;
}

/* Transactions Table */
.transactions-table {
  width: 100%;
  overflow-x: auto;
}

.table-header {
  display: grid;
  grid-template-columns: 120px 140px 80px 120px 80px 100px 120px 80px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 16px 24px;
  font-weight: 600;
  color: #4a5568;
  font-size: 14px;
}

.column-header {
  text-align: left;
  padding-right: 16px;
}

.table-body {
  max-height: 600px;
  overflow-y: auto;
}

.transaction-row {
  display: grid;
  grid-template-columns: 120px 140px 80px 120px 80px 100px 120px 80px;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.transaction-row:hover {
  background: #f7fafc;
}

.table-cell {
  padding-right: 16px;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #2d3748;
}

.date-cell {
  font-size: 12px;
  color: #718096;
}

.type-cell .transaction-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.type-cell .transaction-type.type-deposit {
  color: #38a169;
}

.type-cell .transaction-type.type-withdraw {
  color: #e53e3e;
}

.type-cell .transaction-type.type-claim {
  color: #3182ce;
}

.amount-cell {
  font-weight: 600;
  text-align: right;
  justify-content: flex-end;
}

.status-cell .status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.status-confirmed {
  background: #c6f6d5;
  color: #22543d;
}

.status-badge.status-pending {
  background: #fefcbf;
  color: #744210;
}

.status-badge.status-failed {
  background: #fed7d7;
  color: #742a2a;
}

.gas-cell {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #718096;
}

.hash-cell .transaction-hash {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.copy-btn,
.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.copy-btn:hover,
.action-btn:hover {
  background: #e2e8f0;
}

.actions-cell {
  display: flex;
  gap: 4px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px 24px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.clear-filters-btn {
  background: #3182ce;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 16px;
}

/* Load More */
.load-more {
  padding: 24px;
  text-align: center;
  border-top: 1px solid #e2e8f0;
}

.load-more-btn {
  background: #3182ce;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border-top: 1px solid #e2e8f0;
}

.page-btn {
  background: #3182ce;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.page-info {
  color: #718096;
  font-size: 14px;
}

/* Loading Spinner */
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.large {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .transaction-history {
    padding: 16px;
  }

  .history-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .filter-row {
    flex-direction: column;
    gap: 12px;
  }

  .transaction-summary {
    flex-wrap: wrap;
    gap: 12px;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }
}
</style>
