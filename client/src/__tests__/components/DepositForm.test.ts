import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DepositForm from '../../components/DepositForm.vue'
import { useWalletStore } from '../../stores/wallet'
import { useProtocolStore } from '../../stores/protocol'

// Mock web3Service
vi.mock('../../services/web3Service', () => ({
  web3Service: {
    depositToVault: vi.fn(),
    approveToken: vi.fn(),
    estimateGas: vi.fn().mockResolvedValue('21000'),
    getBalance: vi.fn(),
    connectWallet: vi.fn(),
    getCurrentAccount: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Mock apiService to prevent real API calls
vi.mock('../../services/apiService', () => ({
  apiService: {
    getBondingCurveRate: vi.fn().mockResolvedValue('1.5'),
    getSupportedTokens: vi.fn().mockResolvedValue([]),
    estimateXMBLOutput: vi.fn().mockResolvedValue('150.0')
  }
}))

describe('DepositForm', () => {
  let wrapper: any
  let walletStore: any
  let protocolStore: any
  let pinia: any

  beforeEach(() => {
    // Create fresh Pinia instance
    pinia = createPinia()
    setActivePinia(pinia)

    // Get store instances
    walletStore = useWalletStore()
    protocolStore = useProtocolStore()

    // Mock wallet store properties that can be set
    walletStore.isConnected = true
    walletStore.address = '0x123...abc'
    walletStore.balance = '5.0'
    walletStore.chainId = 1

    // Mock wallet store methods
    walletStore.connectWallet = vi.fn()
    walletStore.switchNetwork = vi.fn()

    // Mock protocol store
    protocolStore.isMaintenanceMode = false
    protocolStore.supportedTokens = [
      {
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        name: 'Ethereum',
        minDeposit: '0.01',
        maxDeposit: '100',
        isActive: true,
        priceUSD: 2500
      }
    ]
    protocolStore.bondingCurveRate = '1.5'
    protocolStore.estimateXMBLOutput = vi.fn().mockResolvedValue('150.0')
    protocolStore.fetchSupportedTokens = vi.fn()
    protocolStore.fetchBondingCurveRate = vi.fn()

    // Clear all mocks
    vi.clearAllMocks()

    // Mount component
    wrapper = mount(DepositForm, {
      global: {
        plugins: [pinia]
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render deposit form', () => {
    expect(wrapper.find('[data-testid="deposit-form"]').exists()).toBe(true)
  })

  it('should show wallet balance', () => {
    const balanceElement = wrapper.find('[data-testid="wallet-balance"]')
    expect(balanceElement.exists()).toBe(true)
    expect(balanceElement.text()).toContain('Balance')
  })

  it('should show maintenance message when in maintenance mode', async () => {
    // Update the existing store instead of creating new wrapper
    protocolStore.isMaintenanceMode = true
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="maintenance-message"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="maintenance-message"]').text()).toContain('Maintenance Mode')
  })

  it('should show USD value preview', async () => {
    const amountInput = wrapper.find('[data-testid="amount-input"]')
    expect(amountInput.exists()).toBe(true)

    await amountInput.setValue('1.0')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="usd-value"]').exists()).toBe(true)
  })

  it('should show network switch prompt for wrong network', async () => {
    walletStore.chainId = 137 // Polygon
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="network-switch-prompt"]').exists()).toBe(true)
  })

  it('should show token selector', () => {
    expect(wrapper.find('[data-testid="token-selector"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="selected-token"]').text()).toContain('ETH')
  })

  it('should show amount input', () => {
    expect(wrapper.find('[data-testid="amount-input"]').exists()).toBe(true)
  })

  it('should show deposit button', () => {
    expect(wrapper.find('[data-testid="deposit-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deposit-button"]').text()).toContain('Deposit & Create XMBL NFT')
  })

  it('should show deposit limits', () => {
    expect(wrapper.find('[data-testid="deposit-limits"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deposit-limits"]').text()).toContain('Min: 0.01 ETH')
    expect(wrapper.find('[data-testid="deposit-limits"]').text()).toContain('Max: 100 ETH')
  })

  it('should validate amount input', async () => {
    const amountInput = wrapper.find('[data-testid="amount-input"]')

    // Test invalid amount
    await amountInput.setValue('invalid')
    await amountInput.trigger('blur')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="validation-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="validation-error"]').text()).toContain('Please enter a valid amount')
  })

  it('should show validation error for amount below minimum', async () => {
    const amountInput = wrapper.find('[data-testid="amount-input"]')
    await amountInput.setValue('0.005')
    await amountInput.trigger('blur')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="validation-error"]').text()).toContain('Minimum deposit is 0.01 ETH')
  })

  it('should show validation error for amount above maximum', async () => {
    const amountInput = wrapper.find('[data-testid="amount-input"]')
    await amountInput.setValue('101')
    await amountInput.trigger('blur')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="validation-error"]').text()).toContain('Maximum deposit is 100 ETH')
  })

  it('should show validation error for insufficient balance', async () => {
    const amountInput = wrapper.find('[data-testid="amount-input"]')
    await amountInput.setValue('10.0') // More than the 5.0 balance
    await amountInput.trigger('blur')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="validation-error"]').text()).toContain('Insufficient balance')
  })

  it('should set max amount when MAX button clicked', async () => {
    const maxButton = wrapper.find('[data-testid="max-button"]')
    expect(maxButton.exists()).toBe(true)

    await maxButton.trigger('click')
    const amountInput = wrapper.find('[data-testid="amount-input"]')
    expect(amountInput.element.value).toBe('5.0')
  })

  it('should show XMBL preview section', () => {
    expect(wrapper.find('[data-testid="xmbl-preview"]').exists()).toBe(true)
  })

  it('should call estimateXMBLOutput when amount changes', async () => {
    const amountInput = wrapper.find('[data-testid="amount-input"]')
    await amountInput.setValue('1.0')

    // Wait for debounced function to execute (300ms in component)
    await new Promise(resolve => setTimeout(resolve, 350))
    await wrapper.vm.$nextTick()

    expect(protocolStore.estimateXMBLOutput).toHaveBeenCalledWith('ETH', '1.0')
  })
})
