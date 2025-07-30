import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Dashboard from '@/views/Dashboard.vue'
import { useWalletStore } from '@/stores/wallet'
import { usePortfolioStore } from '@/stores/portfolio'
import { useTransactionStore } from '@/stores/transactions'

// Mock the stores
vi.mock('@/stores/wallet')
vi.mock('@/stores/portfolio')
vi.mock('@/stores/transactions')

// Mock router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn()
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => ({
    name: 'Dashboard',
    path: '/dashboard',
    params: {},
    query: {}
  })
}))

describe('Dashboard', () => {
  let wrapper: any
  let walletStore: any
  let portfolioStore: any
  let transactionStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock wallet store
    walletStore = {
      isConnected: true,
      address: '0x123...abc',
      balance: '1.5',
      network: 'ethereum',
      connect: vi.fn(),
      disconnect: vi.fn()
    }

    // Mock portfolio store
    portfolioStore = {
      portfolio: {
        xmblBalance: '100.5',
        wbtcBalance: '2.5',
        totalValue: '1500.75',
        apy: '12.5',
        totalEarnings: '45.25'
      },
      isLoading: false,
      error: null,
      fetchPortfolio: vi.fn()
    }

    // Mock transaction store
    transactionStore = {
      transactions: [
        {
          id: '1',
          type: 'deposit',
          amount: '1.0',
          token: 'WBTC',
          status: 'completed',
          timestamp: new Date().toISOString()
        },
        {
          id: '2',
          type: 'withdraw',
          amount: '0.5',
          token: 'XMBL',
          status: 'pending',
          timestamp: new Date().toISOString()
        }
      ],
      isLoading: false,
      fetchTransactions: vi.fn()
    }

    vi.mocked(useWalletStore).mockReturnValue(walletStore)
    vi.mocked(usePortfolioStore).mockReturnValue(portfolioStore)
    vi.mocked(useTransactionStore).mockReturnValue(transactionStore)

    wrapper = mount(Dashboard)
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('Component Rendering', () => {
    it('should render dashboard component', () => {
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="dashboard"]').exists()).toBe(true)
    })

    it('should display page title', () => {
      expect(wrapper.find('h1').text()).toContain('Dashboard')
    })

    it('should render main sections', () => {
      expect(wrapper.find('[data-testid="portfolio-overview"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="recent-transactions"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="yield-positions"]').exists()).toBe(true)
    })
  })

  describe('Wallet Connection State', () => {
    it('should show connected wallet info', () => {
      expect(wrapper.text()).toContain('0x123...abc')
      expect(wrapper.text()).toContain('1.5 ETH')
    })

    it('should handle disconnected wallet', async () => {
      walletStore.isConnected = false
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="connect-wallet-prompt"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Connect your wallet')
    })

    it('should show connect button when disconnected', async () => {
      walletStore.isConnected = false
      await wrapper.vm.$nextTick()

      const connectButton = wrapper.find('[data-testid="connect-button"]')
      expect(connectButton.exists()).toBe(true)

      await connectButton.trigger('click')
      expect(walletStore.connect).toHaveBeenCalled()
    })
  })

  describe('Portfolio Overview', () => {
    it('should display portfolio metrics', () => {
      expect(wrapper.text()).toContain('100.5')
      expect(wrapper.text()).toContain('2.5')
      expect(wrapper.text()).toContain('1500.75')
      expect(wrapper.text()).toContain('12.5%')
    })

    it('should show loading state for portfolio', async () => {
      portfolioStore.isLoading = true
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="portfolio-loading"]').exists()).toBe(true)
    })

    it('should handle portfolio errors', async () => {
      portfolioStore.error = 'Failed to load portfolio'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="portfolio-error"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Failed to load portfolio')
    })
  })

  describe('Transaction History', () => {
    it('should display recent transactions', () => {
      const transactions = wrapper.findAll('[data-testid="transaction-item"]')
      expect(transactions).toHaveLength(2)
    })

    it('should show transaction details', () => {
      expect(wrapper.text()).toContain('deposit')
      expect(wrapper.text()).toContain('withdraw')
      expect(wrapper.text()).toContain('1.0')
      expect(wrapper.text()).toContain('0.5')
    })

    it('should display transaction status', () => {
      expect(wrapper.text()).toContain('completed')
      expect(wrapper.text()).toContain('pending')
    })

    it('should link to full transaction history', () => {
      const viewAllLink = wrapper.find('[data-testid="view-all-transactions"]')
      expect(viewAllLink.exists()).toBe(true)
    })
  })

  describe('Quick Actions', () => {
    it('should show deposit action', () => {
      const depositButton = wrapper.find('[data-testid="deposit-button"]')
      expect(depositButton.exists()).toBe(true)
    })

    it('should show withdraw action', () => {
      const withdrawButton = wrapper.find('[data-testid="withdraw-button"]')
      expect(withdrawButton.exists()).toBe(true)
    })

    it('should navigate to deposit page', async () => {
      const depositButton = wrapper.find('[data-testid="deposit-button"]')
      await depositButton.trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/deposit')
    })

    it('should navigate to withdraw page', async () => {
      const withdrawButton = wrapper.find('[data-testid="withdraw-button"]')
      await withdrawButton.trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/withdraw')
    })
  })

  describe('Yield Information', () => {
    it('should display current APY', () => {
      expect(wrapper.text()).toContain('12.5%')
    })

    it('should show total earnings', () => {
      expect(wrapper.text()).toContain('45.25')
    })

    it('should link to detailed yield view', () => {
      const yieldLink = wrapper.find('[data-testid="yield-details-link"]')
      expect(yieldLink.exists()).toBe(true)
    })
  })

  describe('Data Refresh', () => {
    it('should fetch data on mount', () => {
      expect(portfolioStore.fetchPortfolio).toHaveBeenCalled()
      expect(transactionStore.fetchTransactions).toHaveBeenCalled()
    })

    it('should have refresh button', () => {
      const refreshButton = wrapper.find('[data-testid="refresh-button"]')
      expect(refreshButton.exists()).toBe(true)
    })

    it('should refresh data when button clicked', async () => {
      const refreshButton = wrapper.find('[data-testid="refresh-button"]')
      await refreshButton.trigger('click')

      expect(portfolioStore.fetchPortfolio).toHaveBeenCalled()
      expect(transactionStore.fetchTransactions).toHaveBeenCalled()
    })
  })

  describe('Responsive Layout', () => {
    it('should adapt to mobile viewport', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="mobile-dashboard"]').exists()).toBe(true)
    })

    it('should show desktop layout on large screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="desktop-dashboard"]').exists()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      portfolioStore.error = 'Network error'
      transactionStore.error = 'Failed to fetch transactions'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(true)
    })

    it('should show retry options', async () => {
      portfolioStore.error = 'Connection failed'
      await wrapper.vm.$nextTick()

      const retryButton = wrapper.find('[data-testid="retry-button"]')
      expect(retryButton.exists()).toBe(true)
    })
  })

  describe('Security Features', () => {
    it('should mask sensitive wallet information', () => {
      expect(wrapper.text()).toContain('0x123...abc')
      expect(wrapper.text()).not.toContain('0x123456789abcdef')
    })

    it('should handle wallet disconnection securely', async () => {
      const disconnectButton = wrapper.find('[data-testid="disconnect-button"]')
      await disconnectButton.trigger('click')

      expect(walletStore.disconnect).toHaveBeenCalled()
    })
  })

  describe('Performance Metrics', () => {
    it('should display performance indicators', () => {
      const performanceSection = wrapper.find('[data-testid="performance-metrics"]')
      expect(performanceSection.exists()).toBe(true)
    })

    it('should show yield comparison', () => {
      expect(wrapper.text()).toContain('vs DeFi average')
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      expect(wrapper.find('h1').exists()).toBe(true)
      expect(wrapper.find('h2').exists()).toBe(true)
    })

    it('should have aria labels for interactive elements', () => {
      expect(wrapper.find('[aria-label="Refresh dashboard data"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Connect wallet"]').exists()).toBe(true)
    })

    it('should support keyboard navigation', async () => {
      const firstButton = wrapper.find('button')
      await firstButton.trigger('keydown.tab')

      expect(wrapper.vm.focusedElement).toBeDefined()
    })
  })

  describe('Analytics Tracking', () => {
    it('should track page view', () => {
      expect(wrapper.vm.trackPageView).toHaveBeenCalledWith('Dashboard')
    })

    it('should track user interactions', async () => {
      const depositButton = wrapper.find('[data-testid="deposit-button"]')
      await depositButton.trigger('click')

      expect(wrapper.vm.trackEvent).toHaveBeenCalledWith('dashboard_deposit_clicked')
    })
  })
})
