import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TransactionHistory from '../../components/TransactionHistory.vue'
import { useTransactionsStore } from '../../stores/transactions'
import { useWalletStore } from '../../stores/wallet'

// Mock stores
vi.mock('../../stores/transactions')
vi.mock('../../stores/wallet')

describe('TransactionHistory.vue', () => {
  let wrapper: VueWrapper<any>
  let transactionsStore: any
  let walletStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock transaction data
    const mockTransactions = [
      {
        id: '1',
        hash: '0xabc123...',
        type: 'deposit',
        tokenSymbol: 'ETH',
        amount: '1.0',
        xmblAmount: '1250.5',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        status: 'confirmed',
        blockNumber: 18500000,
        gasUsed: '150000',
        gasFee: '0.003',
        tokenId: 1,
        tbaAddress: '0xdef456...',
        fromAddress: '0x1234567890123456789012345678901234567890',
        toAddress: '0xvault...',
        confirmations: 15
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
        tokenId: 2,
        tbaAddress: '0xabc789...',
        fromAddress: '0xvault...',
        toAddress: '0x1234567890123456789012345678901234567890',
        confirmations: 0
      },
      {
        id: '3',
        hash: '0x789abc...',
        type: 'withdrawal',
        tokenSymbol: 'ETH',
        amount: '0.5',
        xmblAmount: '625.25',
        timestamp: new Date('2024-01-13T09:15:00Z'),
        status: 'failed',
        blockNumber: 18499500,
        gasUsed: '75000',
        gasFee: '0.002',
        tokenId: 1,
        error: 'Insufficient balance',
        fromAddress: '0x1234567890123456789012345678901234567890',
        toAddress: '0xvault...',
        confirmations: 0
      }
    ]

    transactionsStore = {
      transactions: mockTransactions,
      filteredTransactions: mockTransactions,
      isLoading: false,
      hasMore: true,
      currentFilter: 'all',
      sortBy: 'timestamp',
      sortOrder: 'desc',
      totalCount: 25,
      fetchTransactions: vi.fn(),
      fetchTransactionHistory: vi.fn().mockResolvedValue(undefined),
      loadMoreTransactions: vi.fn(),
      filterTransactions: vi.fn(),
      sortTransactions: vi.fn(),
      refreshTransactions: vi.fn(),
      getTransactionsByType: vi.fn(),
      getTransactionsByStatus: vi.fn(),
      exportTransactions: vi.fn()
    }

    walletStore = {
      isConnected: true,
      account: '0x1234567890123456789012345678901234567890',
      address: '0x1234567890123456789012345678901234567890',
      networkId: 1
    }

    vi.mocked(useTransactionsStore).mockReturnValue(transactionsStore)
    vi.mocked(useWalletStore).mockReturnValue(walletStore)

    wrapper = mount(TransactionHistory, {
      global: {
        plugins: [createPinia()]
      }
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render transaction history table', () => {
      expect(wrapper.find('[data-testid="transaction-history"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="transactions-table"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="table-header"]').exists()).toBe(true)
    })

    it('should display all transaction columns', () => {
      const headers = wrapper.findAll('[data-testid="column-header"]')
      expect(headers).toHaveLength(8) // timestamp, type, token, amount, status, gas, hash, actions

      expect(headers[0].text()).toContain('Date')
      expect(headers[1].text()).toContain('Type')
      expect(headers[2].text()).toContain('Token')
      expect(headers[3].text()).toContain('Amount')
      expect(headers[4].text()).toContain('Status')
      expect(headers[5].text()).toContain('Gas Fee')
      expect(headers[6].text()).toContain('Hash')
      expect(headers[7].text()).toContain('Actions')
    })

    it('should show empty state when no transactions', async () => {
      transactionsStore.transactions = []
      transactionsStore.filteredTransactions = []
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="empty-message"]').text())
        .toContain('No transactions found')
    })

    it('should show loading state while fetching', async () => {
      transactionsStore.isLoading = true
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="loading-message"]').text())
        .toContain('Loading transactions...')
    })

    it('should display total transaction count', () => {
      expect(wrapper.find('[data-testid="total-count"]').text())
        .toContain('25 transactions')
    })
  })

  describe('Transaction Display', () => {
    it('should display transaction rows correctly', () => {
      const rows = wrapper.findAll('[data-testid="transaction-row"]')
      expect(rows).toHaveLength(3)
    })

    it('should format timestamps correctly', () => {
      const firstRow = wrapper.find('[data-testid="transaction-row"]:first-child')
      expect(firstRow.find('[data-testid="timestamp"]').text())
        .toContain('Jan 15, 2024')
      expect(firstRow.find('[data-testid="timestamp"]').text())
        .toContain('10:30')
    })

    it('should display transaction types with icons', () => {
      const rows = wrapper.findAll('[data-testid="transaction-row"]')

      expect(rows[0].find('[data-testid="type-badge"]').text()).toContain('Deposit')
      expect(rows[0].find('[data-testid="type-icon"]').classes()).toContain('deposit')

      expect(rows[1].find('[data-testid="type-badge"]').text()).toContain('Yield Claim')
      expect(rows[1].find('[data-testid="type-icon"]').classes()).toContain('yield')

      expect(rows[2].find('[data-testid="type-badge"]').text()).toContain('Withdrawal')
      expect(rows[2].find('[data-testid="type-icon"]').classes()).toContain('withdrawal')
    })

    it('should show token symbols and amounts', () => {
      const firstRow = wrapper.find('[data-testid="transaction-row"]:first-child')
      expect(firstRow.find('[data-testid="token-symbol"]').text()).toBe('ETH')
      expect(firstRow.find('[data-testid="amount"]').text()).toContain('1.0')
      expect(firstRow.find('[data-testid="xmbl-amount"]').text()).toContain('1,250.5 XMBL')
    })

    it('should display status badges with appropriate styling', () => {
      const rows = wrapper.findAll('[data-testid="transaction-row"]')

      const confirmedBadge = rows[0].find('[data-testid="status-badge"]')
      expect(confirmedBadge.text()).toBe('Confirmed')
      expect(confirmedBadge.classes()).toContain('status-confirmed')

      const pendingBadge = rows[1].find('[data-testid="status-badge"]')
      expect(pendingBadge.text()).toBe('Pending')
      expect(pendingBadge.classes()).toContain('status-pending')

      const failedBadge = rows[2].find('[data-testid="status-badge"]')
      expect(failedBadge.text()).toBe('Failed')
      expect(failedBadge.classes()).toContain('status-failed')
    })

    it('should show gas fees formatted correctly', () => {
      const firstRow = wrapper.find('[data-testid="transaction-row"]:first-child')
      expect(firstRow.find('[data-testid="gas-fee"]').text()).toContain('0.003 ETH')
    })

    it('should display truncated transaction hashes with copy functionality', () => {
      const firstRow = wrapper.find('[data-testid="transaction-row"]:first-child')
      const hashElement = firstRow.find('[data-testid="transaction-hash"]')

      expect(hashElement.text()).toContain('0xabc123...')
      expect(hashElement.find('[data-testid="copy-hash-button"]').exists()).toBe(true)
    })

    it('should show confirmation count for pending transactions', () => {
      const secondRow = wrapper.findAll('[data-testid="transaction-row"]')[1]
      expect(secondRow.find('[data-testid="confirmations"]').text())
        .toContain('0/12 confirmations')
    })

    it('should display error messages for failed transactions', () => {
      const failedRow = wrapper.findAll('[data-testid="transaction-row"]')[2]
      expect(failedRow.find('[data-testid="error-message"]').text())
        .toContain('Insufficient balance')
    })
  })

  describe('Filtering and Search', () => {
    it('should render filter dropdown', () => {
      expect(wrapper.find('[data-testid="filter-dropdown"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="filter-all"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="filter-deposits"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="filter-withdrawals"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="filter-yields"]').exists()).toBe(true)
    })

    it('should filter transactions by type', async () => {
      const depositFilter = wrapper.find('[data-testid="filter-deposits"]')
      await depositFilter.trigger('click')

      expect(transactionsStore.filterTransactions).toHaveBeenCalledWith('deposit')
    })

    it('should show search input', () => {
      expect(wrapper.find('[data-testid="search-input"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="search-input"]').attributes('placeholder'))
        .toContain('Search by hash, token, or amount')
    })

    it('should search transactions', async () => {
      const searchInput = wrapper.find('[data-testid="search-input"]')
      await searchInput.setValue('0xabc123')

      expect(transactionsStore.filterTransactions).toHaveBeenCalledWith('all', '0xabc123')
    })

    it('should show status filter options', () => {
      expect(wrapper.find('[data-testid="status-filter"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-all"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-confirmed"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-pending"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-failed"]').exists()).toBe(true)
    })

    it('should filter by date range', () => {
      expect(wrapper.find('[data-testid="date-range-picker"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="date-from"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="date-to"]').exists()).toBe(true)
    })

    it('should clear all filters', async () => {
      const clearButton = wrapper.find('[data-testid="clear-filters"]')
      await clearButton.trigger('click')

      expect(transactionsStore.filterTransactions).toHaveBeenCalledWith('all', '')
    })
  })

  describe('Sorting', () => {
    it('should show sortable column headers', () => {
      const headers = wrapper.findAll('[data-testid="sortable-header"]')
      expect(headers.length).toBeGreaterThan(0)

      headers.forEach(header => {
        expect(header.find('[data-testid="sort-indicator"]').exists()).toBe(true)
      })
    })

    it('should sort by timestamp when header is clicked', async () => {
      const timestampHeader = wrapper.find('[data-testid="sort-timestamp"]')
      await timestampHeader.trigger('click')

      expect(transactionsStore.sortTransactions).toHaveBeenCalledWith('timestamp', 'asc')
    })

    it('should toggle sort order on repeated clicks', async () => {
      const amountHeader = wrapper.find('[data-testid="sort-amount"]')

      await amountHeader.trigger('click')
      expect(transactionsStore.sortTransactions).toHaveBeenCalledWith('amount', 'desc')

      await amountHeader.trigger('click')
      expect(transactionsStore.sortTransactions).toHaveBeenCalledWith('amount', 'asc')
    })

    it('should show current sort indicator', () => {
      transactionsStore.sortBy = 'timestamp'
      transactionsStore.sortOrder = 'desc'

      const timestampHeader = wrapper.find('[data-testid="sort-timestamp"]')
      expect(timestampHeader.find('[data-testid="sort-desc"]').exists()).toBe(true)
    })
  })

  describe('Pagination and Loading', () => {
    it('should show load more button when hasMore is true', () => {
      expect(wrapper.find('[data-testid="load-more-button"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="load-more-button"]').text())
        .toContain('Load More')
    })

    it('should hide load more button when no more transactions', async () => {
      transactionsStore.hasMore = false
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="load-more-button"]').exists()).toBe(false)
    })

    it('should load more transactions when button is clicked', async () => {
      const loadMoreButton = wrapper.find('[data-testid="load-more-button"]')
      await loadMoreButton.trigger('click')

      expect(transactionsStore.loadMoreTransactions).toHaveBeenCalled()
    })

    it('should show loading indicator while loading more', async () => {
      transactionsStore.isLoading = true
      await wrapper.vm.$nextTick()

      const loadMoreButton = wrapper.find('[data-testid="load-more-button"]')
      expect(loadMoreButton.attributes('disabled')).toBe('')
      expect(loadMoreButton.text()).toContain('Loading...')
    })

    it('should implement infinite scroll', async () => {
      const scrollContainer = wrapper.find('[data-testid="scroll-container"]')

      // Mock scroll to bottom
      Object.defineProperty(scrollContainer.element, 'scrollTop', { value: 1000, writable: true })
      Object.defineProperty(scrollContainer.element, 'scrollHeight', { value: 1100, writable: true })
      Object.defineProperty(scrollContainer.element, 'clientHeight', { value: 400, writable: true })

      await scrollContainer.trigger('scroll')

      expect(transactionsStore.loadMoreTransactions).toHaveBeenCalled()
    })
  })

  describe('Transaction Actions', () => {
    it('should show action menu for each transaction', () => {
      const rows = wrapper.findAll('[data-testid="transaction-row"]')
      rows.forEach(row => {
        expect(row.find('[data-testid="action-menu"]').exists()).toBe(true)
      })
    })

    it('should copy transaction hash to clipboard', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      })

      const copyButton = wrapper.find('[data-testid="copy-hash-button"]')
      await copyButton.trigger('click')

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0xabc123...')
      expect(wrapper.find('[data-testid="copy-success"]').exists()).toBe(true)
    })

    it('should open transaction in explorer', async () => {
      // Mock window.open
      window.open = vi.fn()

      const explorerButton = wrapper.find('[data-testid="view-in-explorer"]')
      await explorerButton.trigger('click')

      expect(window.open).toHaveBeenCalledWith(
        'https://etherscan.io/tx/0xabc123...',
        '_blank'
      )
    })

    it('should show NFT details for deposit transactions', async () => {
      const firstRow = wrapper.find('[data-testid="transaction-row"]:first-child')
      const nftButton = firstRow.find('[data-testid="view-nft"]')

      expect(nftButton.exists()).toBe(true)
      await nftButton.trigger('click')

      expect(wrapper.find('[data-testid="nft-modal"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="nft-id"]').text()).toContain('#1')
    })

    it('should retry failed transactions', async () => {
      const failedRow = wrapper.findAll('[data-testid="transaction-row"]')[2]
      const retryButton = failedRow.find('[data-testid="retry-transaction"]')

      expect(retryButton.exists()).toBe(true)
      await retryButton.trigger('click')

      // Should emit retry event
      expect(wrapper.emitted('retry-transaction')).toBeTruthy()
    })

    it('should show transaction details modal', async () => {
      const firstRow = wrapper.find('[data-testid="transaction-row"]:first-child')
      await firstRow.trigger('click')

      expect(wrapper.find('[data-testid="transaction-details-modal"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="modal-hash"]').text()).toContain('0xabc123...')
    })
  })

  describe('Export Functionality', () => {
    it('should show export button', () => {
      expect(wrapper.find('[data-testid="export-button"]').exists()).toBe(true)
    })

    it('should export transactions as CSV', async () => {
      const exportButton = wrapper.find('[data-testid="export-button"]')
      await exportButton.trigger('click')

      const csvOption = wrapper.find('[data-testid="export-csv"]')
      await csvOption.trigger('click')

      expect(transactionsStore.exportTransactions).toHaveBeenCalledWith('csv')
    })

    it('should export transactions as JSON', async () => {
      const exportButton = wrapper.find('[data-testid="export-button"]')
      await exportButton.trigger('click')

      const jsonOption = wrapper.find('[data-testid="export-json"]')
      await jsonOption.trigger('click')

      expect(transactionsStore.exportTransactions).toHaveBeenCalledWith('json')
    })

    it('should show export progress', async () => {
      transactionsStore.exportTransactions.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 1000))
      })

      const exportButton = wrapper.find('[data-testid="export-button"]')
      await exportButton.trigger('click')

      const csvOption = wrapper.find('[data-testid="export-csv"]')
      await csvOption.trigger('click')

      expect(wrapper.find('[data-testid="export-progress"]').exists()).toBe(true)
    })
  })

  describe('Real-time Updates', () => {
    it('should refresh transactions periodically', () => {
      vi.useFakeTimers()

      wrapper = mount(TransactionHistory, {
        global: { plugins: [createPinia()] }
      })

      vi.advanceTimersByTime(30000) // 30 seconds

      expect(transactionsStore.refreshTransactions).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should update transaction status when new block is mined', async () => {
      // Simulate new block event
      window.dispatchEvent(new CustomEvent('newBlock', {
        detail: { blockNumber: 18500001 }
      }))

      await wrapper.vm.$nextTick()

      expect(transactionsStore.refreshTransactions).toHaveBeenCalled()
    })

    it('should show notification for new transactions', async () => {
      // Simulate new transaction
      window.dispatchEvent(new CustomEvent('newTransaction', {
        detail: {
          hash: '0xnew123...',
          type: 'deposit',
          amount: '2.0'
        }
      }))

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="new-transaction-notification"]').exists()).toBe(true)
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should stack columns on mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })
      window.dispatchEvent(new Event('resize'))

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="mobile-view"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="desktop-table"]').exists()).toBe(false)
    })

    it('should show compact transaction cards on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })
      window.dispatchEvent(new Event('resize'))

      await wrapper.vm.$nextTick()

      const cards = wrapper.findAll('[data-testid="transaction-card"]')
      expect(cards).toHaveLength(3)

      cards.forEach(card => {
        expect(card.find('[data-testid="card-type"]').exists()).toBe(true)
        expect(card.find('[data-testid="card-amount"]').exists()).toBe(true)
        expect(card.find('[data-testid="card-status"]').exists()).toBe(true)
      })
    })

    it('should use swipe gestures for card actions on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })
      window.dispatchEvent(new Event('resize'))

      await wrapper.vm.$nextTick()

      const firstCard = wrapper.find('[data-testid="transaction-card"]:first-child')

      // Simulate swipe left
      await firstCard.trigger('touchstart', { touches: [{ clientX: 200 }] })
      await firstCard.trigger('touchend', { changedTouches: [{ clientX: 100 }] })

      expect(wrapper.find('[data-testid="swipe-actions"]').exists()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle failed transaction fetching', async () => {
      transactionsStore.fetchTransactions.mockRejectedValue(new Error('Network error'))

      wrapper = mount(TransactionHistory, {
        global: { plugins: [createPinia()] }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="error-message"]').text())
        .toContain('Failed to load transactions')
    })

    it('should show retry button on error', async () => {
      transactionsStore.fetchTransactions.mockRejectedValue(new Error('Network error'))

      wrapper = mount(TransactionHistory, {
        global: { plugins: [createPinia()] }
      })

      await wrapper.vm.$nextTick()

      const retryButton = wrapper.find('[data-testid="retry-fetch"]')
      expect(retryButton.exists()).toBe(true)

      await retryButton.trigger('click')
      expect(transactionsStore.fetchTransactions).toHaveBeenCalledTimes(2)
    })

    it('should handle wallet disconnection gracefully', async () => {
      walletStore.isConnected = false
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="wallet-required"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="transactions-table"]').exists()).toBe(false)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      expect(wrapper.find('[data-testid="transactions-table"]').attributes('aria-label'))
        .toBe('Transaction history table')
      expect(wrapper.find('[data-testid="search-input"]').attributes('aria-label'))
        .toBe('Search transactions')
    })

    it('should support keyboard navigation', async () => {
      const firstRow = wrapper.find('[data-testid="transaction-row"]:first-child')

      await firstRow.trigger('keydown.enter')
      expect(wrapper.find('[data-testid="transaction-details-modal"]').exists()).toBe(true)

      await wrapper.find('[data-testid="modal-close"]').trigger('keydown.escape')
      expect(wrapper.find('[data-testid="transaction-details-modal"]').exists()).toBe(false)
    })

    it('should announce status changes to screen readers', async () => {
      const statusRegion = wrapper.find('[data-testid="status-region"]')
      expect(statusRegion.attributes('aria-live')).toBe('polite')
      expect(statusRegion.attributes('aria-atomic')).toBe('true')
    })

    it('should provide focus management', async () => {
      const loadMoreButton = wrapper.find('[data-testid="load-more-button"]')
      await loadMoreButton.trigger('click')

      // Focus should move to first new transaction
      await wrapper.vm.$nextTick()
      expect(document.activeElement).toBe(
        wrapper.find('[data-testid="transaction-row"]:nth-child(4)').element
      )
    })
  })
})
