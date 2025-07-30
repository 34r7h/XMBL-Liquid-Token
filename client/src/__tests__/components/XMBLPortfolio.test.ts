import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import XMBLPortfolio from '@/components/XMBLPortfolio.vue'
import { usePortfolioStore } from '@/stores/portfolio'
import { useWalletStore } from '@/stores/wallet'

// Mock the stores
vi.mock('@/stores/portfolio')
vi.mock('@/stores/wallet')

describe('XMBLPortfolio', () => {
  let wrapper: any
  let portfolioStore: any
  let walletStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock portfolio store
    portfolioStore = {
      portfolio: {
        xmblBalance: '100.5',
        wbtcBalance: '2.5',
        totalValue: '1500.75',
        apy: '12.5',
        totalEarnings: '45.25',
        positions: [
          {
            protocol: 'Compound',
            amount: '1.2',
            apy: '8.5',
            value: '750.00'
          },
          {
            protocol: 'Aave',
            amount: '1.3',
            apy: '9.2',
            value: '750.75'
          }
        ]
      },
      isLoading: false,
      error: null,
      fetchPortfolio: vi.fn(),
      refreshPortfolio: vi.fn()
    }

    // Mock wallet store
    walletStore = {
      isConnected: true,
      address: '0x123...abc',
      network: 'ethereum'
    }

    vi.mocked(usePortfolioStore).mockReturnValue(portfolioStore)
    vi.mocked(useWalletStore).mockReturnValue(walletStore)

    wrapper = mount(XMBLPortfolio)
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('Component Rendering', () => {
    it('should render portfolio component', () => {
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="xmbl-portfolio"]').exists()).toBe(true)
    })

    it('should display portfolio balances', () => {
      expect(wrapper.text()).toContain('100.5')
      expect(wrapper.text()).toContain('2.5')
      expect(wrapper.text()).toContain('1500.75')
    })

    it('should display APY information', () => {
      expect(wrapper.text()).toContain('12.5%')
      expect(wrapper.text()).toContain('45.25')
    })

    it('should render yield positions', () => {
      expect(wrapper.text()).toContain('Compound')
      expect(wrapper.text()).toContain('Aave')
      expect(wrapper.text()).toContain('8.5%')
      expect(wrapper.text()).toContain('9.2%')
    })
  })

  describe('Loading States', () => {
    it('should show loading state', async () => {
      portfolioStore.isLoading = true
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
    })

    it('should hide content when loading', async () => {
      portfolioStore.isLoading = true
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="portfolio-content"]').isVisible()).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should display error message', async () => {
      portfolioStore.error = 'Failed to fetch portfolio data'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Failed to fetch portfolio data')
    })

    it('should show retry button on error', async () => {
      portfolioStore.error = 'Network error'
      await wrapper.vm.$nextTick()

      const retryButton = wrapper.find('[data-testid="retry-button"]')
      expect(retryButton.exists()).toBe(true)
    })

    it('should call refresh on retry', async () => {
      portfolioStore.error = 'Network error'
      await wrapper.vm.$nextTick()

      const retryButton = wrapper.find('[data-testid="retry-button"]')
      await retryButton.trigger('click')

      expect(portfolioStore.refreshPortfolio).toHaveBeenCalled()
    })
  })

  describe('Data Formatting', () => {
    it('should format currency values', () => {
      const formattedValue = wrapper.vm.formatCurrency('1234.567')
      expect(formattedValue).toBe('$1,234.57')
    })

    it('should format percentage values', () => {
      const formattedPercent = wrapper.vm.formatPercentage('12.345')
      expect(formattedPercent).toBe('12.35%')
    })

    it('should format token amounts', () => {
      const formattedAmount = wrapper.vm.formatTokenAmount('123.456789', 4)
      expect(formattedAmount).toBe('123.4568')
    })

    it('should handle zero values', () => {
      expect(wrapper.vm.formatCurrency('0')).toBe('$0.00')
      expect(wrapper.vm.formatPercentage('0')).toBe('0.00%')
      expect(wrapper.vm.formatTokenAmount('0')).toBe('0.0000')
    })
  })

  describe('Portfolio Stats', () => {
    it('should calculate total portfolio value', () => {
      expect(wrapper.vm.totalPortfolioValue).toBe('1500.75')
    })

    it('should calculate weighted average APY', () => {
      const weightedAPY = wrapper.vm.calculateWeightedAPY()
      expect(weightedAPY).toBeCloseTo(8.85, 2)
    })

    it('should show portfolio distribution', () => {
      const distribution = wrapper.vm.getPortfolioDistribution()
      expect(distribution).toHaveLength(2)
      expect(distribution[0].percentage).toBeCloseTo(50, 1)
      expect(distribution[1].percentage).toBeCloseTo(50, 1)
    })
  })

  describe('Yield Position Management', () => {
    it('should display all active positions', () => {
      const positions = wrapper.findAll('[data-testid="yield-position"]')
      expect(positions).toHaveLength(2)
    })

    it('should show position details', () => {
      const firstPosition = wrapper.find('[data-testid="yield-position"]:first-child')
      expect(firstPosition.text()).toContain('Compound')
      expect(firstPosition.text()).toContain('1.2')
      expect(firstPosition.text()).toContain('8.5%')
    })

    it('should handle empty positions', async () => {
      portfolioStore.portfolio.positions = []
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="no-positions"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('No active positions')
    })
  })

  describe('Real-time Updates', () => {
    it('should auto-refresh portfolio data', () => {
      vi.useFakeTimers()

      // Mount component to start auto-refresh
      wrapper = mount(XMBLPortfolio)

      vi.advanceTimersByTime(30000) // 30 seconds

      expect(portfolioStore.fetchPortfolio).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should stop auto-refresh on unmount', () => {
      vi.useFakeTimers()

      wrapper.unmount()

      vi.advanceTimersByTime(30000)

      // Should not fetch after unmount
      expect(portfolioStore.fetchPortfolio).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('User Interactions', () => {
    it('should handle refresh button click', async () => {
      const refreshButton = wrapper.find('[data-testid="refresh-button"]')
      await refreshButton.trigger('click')

      expect(portfolioStore.refreshPortfolio).toHaveBeenCalled()
    })

    it('should navigate to position details', async () => {
      const mockRouter = {
        push: vi.fn()
      }
      wrapper.vm.$router = mockRouter

      const positionCard = wrapper.find('[data-testid="position-card"]')
      await positionCard.trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/position/compound')
    })

    it('should toggle view modes', async () => {
      const viewToggle = wrapper.find('[data-testid="view-toggle"]')
      await viewToggle.trigger('click')

      expect(wrapper.vm.viewMode).toBe('list')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="mobile-layout"]').exists()).toBe(true)
    })

    it('should show desktop layout on large screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="desktop-layout"]').exists()).toBe(true)
    })
  })

  describe('Performance Tracking', () => {
    it('should track performance metrics', () => {
      const performance = wrapper.vm.getPerformanceMetrics()

      expect(performance).toHaveProperty('totalReturn')
      expect(performance).toHaveProperty('annualizedReturn')
      expect(performance).toHaveProperty('sharpeRatio')
    })

    it('should calculate returns correctly', () => {
      const returns = wrapper.vm.calculateReturns()
      expect(returns.total).toBeGreaterThan(0)
      expect(returns.percentage).toBeCloseTo(3.11, 2)
    })
  })

  describe('Wallet Integration', () => {
    it('should show connect wallet message when disconnected', async () => {
      walletStore.isConnected = false
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="connect-wallet"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Connect your wallet')
    })

    it('should fetch portfolio data when wallet connects', async () => {
      walletStore.isConnected = false
      await wrapper.vm.$nextTick()

      walletStore.isConnected = true
      await wrapper.vm.$nextTick()

      expect(portfolioStore.fetchPortfolio).toHaveBeenCalled()
    })

    it('should handle network changes', async () => {
      walletStore.network = 'polygon'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="network-warning"]').exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      expect(wrapper.find('[aria-label="Portfolio overview"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Yield positions"]').exists()).toBe(true)
    })

    it('should support keyboard navigation', async () => {
      const firstPosition = wrapper.find('[data-testid="position-card"]')
      await firstPosition.trigger('keydown.enter')

      expect(wrapper.emitted('position-selected')).toBeTruthy()
    })

    it('should have proper heading hierarchy', () => {
      expect(wrapper.find('h1').exists()).toBe(true)
      expect(wrapper.find('h2').exists()).toBe(true)
    })
  })
})
