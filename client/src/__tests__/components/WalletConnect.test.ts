import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WalletConnect from '../../components/WalletConnect.vue'
import { useWalletStore } from '../../stores/wallet'

// Mock wallet store and web3 service
vi.mock('../../stores/wallet')
vi.mock('../../services/web3Service')

describe('WalletConnect.vue', () => {
  let wrapper: VueWrapper<any>
  let walletStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    walletStore = {
      isConnected: false,
      address: null,
      balance: '0',
      networkId: null,
      networkName: '',
      isConnecting: false,
      error: null,
      supportedWallets: [
        {
          id: 'metamask',
          name: 'MetaMask',
          icon: '/metamask-icon.png',
          available: true,
          installed: true
        },
        {
          id: 'walletconnect',
          name: 'WalletConnect',
          icon: '/walletconnect-icon.png',
          available: true,
          installed: false
        },
        {
          id: 'coinbase',
          name: 'Coinbase Wallet',
          icon: '/coinbase-icon.png',
          available: true,
          installed: false
        }
      ],
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
      switchNetwork: vi.fn(),
      addToken: vi.fn(),
      watchAsset: vi.fn()
    }

    vi.mocked(useWalletStore).mockReturnValue(walletStore)

    wrapper = mount(WalletConnect, {
      global: {
        plugins: [createPinia()]
      }
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.clearAllMocks()
  })

  describe('Wallet Selection Display', () => {
    it('should render wallet connection modal when not connected', () => {
      expect(wrapper.find('[data-testid="wallet-connect-modal"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="wallet-selection"]').exists()).toBe(true)
    })

    it('should display available wallet options', () => {
      const walletOptions = wrapper.findAll('[data-testid="wallet-option"]')
      expect(walletOptions).toHaveLength(3)

      expect(walletOptions[0].text()).toContain('MetaMask')
      expect(walletOptions[1].text()).toContain('WalletConnect')
      expect(walletOptions[2].text()).toContain('Coinbase Wallet')
    })

    it('should show wallet icons and names', () => {
      const metamaskOption = wrapper.find('[data-testid="wallet-option-metamask"]')
      expect(metamaskOption.find('img').attributes('src')).toBe('/metamask-icon.png')
      expect(metamaskOption.find('[data-testid="wallet-name"]').text()).toBe('MetaMask')
    })

    it('should indicate installed vs uninstalled wallets', () => {
      const metamaskOption = wrapper.find('[data-testid="wallet-option-metamask"]')
      const walletConnectOption = wrapper.find('[data-testid="wallet-option-walletconnect"]')

      expect(metamaskOption.find('[data-testid="installed-badge"]').exists()).toBe(true)
      expect(walletConnectOption.find('[data-testid="install-prompt"]').exists()).toBe(true)
    })

    it('should show installation links for uninstalled wallets', () => {
      const walletConnectOption = wrapper.find('[data-testid="wallet-option-walletconnect"]')
      const installLink = walletConnectOption.find('[data-testid="install-link"]')

      expect(installLink.exists()).toBe(true)
      expect(installLink.attributes('href')).toContain('walletconnect.com')
    })

    it('should disable unavailable wallet options', () => {
      walletStore.supportedWallets[1].available = false
      wrapper = mount(WalletConnect, {
        global: { plugins: [createPinia()] }
      })

      const walletConnectOption = wrapper.find('[data-testid="wallet-option-walletconnect"]')
      expect(walletConnectOption.attributes('disabled')).toBe('')
      expect(walletConnectOption.classes()).toContain('disabled')
    })
  })

  describe('Wallet Connection Process', () => {
    it('should connect to MetaMask when option is clicked', async () => {
      const metamaskOption = wrapper.find('[data-testid="wallet-option-metamask"]')
      await metamaskOption.trigger('click')

      expect(walletStore.connectWallet).toHaveBeenCalledWith('metamask')
    })

    it('should show connecting state during connection attempt', async () => {
      walletStore.isConnecting = true
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="connecting-spinner"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="connecting-message"]').text())
        .toContain('Connecting to wallet...')
    })

    it('should display specific connecting message for each wallet', async () => {
      walletStore.isConnecting = true
      walletStore.connectingWallet = 'metamask'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="connecting-message"]').text())
        .toContain('Connecting to MetaMask...')
    })

    it('should handle connection success', async () => {
      walletStore.isConnected = true
      walletStore.address = '0x1234567890123456789012345678901234567890'
      walletStore.balance = '5.25'
      walletStore.networkId = 1
      walletStore.networkName = 'Ethereum Mainnet'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="wallet-connected"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="wallet-address"]').text())
        .toContain('0x1234...7890')
      expect(wrapper.find('[data-testid="wallet-balance"]').text())
        .toContain('5.25 ETH')
    })

    it('should show connection error messages', async () => {
      walletStore.error = 'User rejected the request'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="connection-error"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="error-message"]').text())
        .toContain('User rejected the request')
    })

    it('should provide retry option on connection failure', async () => {
      walletStore.error = 'Connection failed'
      await wrapper.vm.$nextTick()

      const retryButton = wrapper.find('[data-testid="retry-connection"]')
      expect(retryButton.exists()).toBe(true)

      await retryButton.trigger('click')
      expect(walletStore.connectWallet).toHaveBeenCalled()
    })

    it('should clear errors when attempting new connection', async () => {
      walletStore.error = 'Previous error'
      await wrapper.vm.$nextTick()

      const metamaskOption = wrapper.find('[data-testid="wallet-option-metamask"]')
      await metamaskOption.trigger('click')

      expect(walletStore.error).toBe(null)
    })
  })

  describe('Connected Wallet Management', () => {
    beforeEach(() => {
      walletStore.isConnected = true
      walletStore.address = '0x1234567890123456789012345678901234567890'
      walletStore.balance = '5.25'
      walletStore.networkId = 1
      walletStore.networkName = 'Ethereum Mainnet'
    })

    it('should display connected wallet information', async () => {
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="connected-wallet"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="wallet-avatar"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="wallet-address"]').text())
        .toContain('0x1234...7890')
      expect(wrapper.find('[data-testid="wallet-network"]').text())
        .toContain('Ethereum Mainnet')
    })

    it('should show wallet balance with token symbol', async () => {
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="wallet-balance"]').text())
        .toContain('5.25 ETH')
    })

    it('should provide copy address functionality', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      })

      await wrapper.vm.$nextTick()

      const copyButton = wrapper.find('[data-testid="copy-address"]')
      await copyButton.trigger('click')

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890'
      )
      expect(wrapper.find('[data-testid="copy-success"]').exists()).toBe(true)
    })

    it('should show disconnect button', async () => {
      await wrapper.vm.$nextTick()

      const disconnectButton = wrapper.find('[data-testid="disconnect-wallet"]')
      expect(disconnectButton.exists()).toBe(true)
      expect(disconnectButton.text()).toContain('Disconnect')
    })

    it('should disconnect wallet when disconnect button is clicked', async () => {
      await wrapper.vm.$nextTick()

      const disconnectButton = wrapper.find('[data-testid="disconnect-wallet"]')
      await disconnectButton.trigger('click')

      expect(walletStore.disconnectWallet).toHaveBeenCalled()
    })

    it('should show wallet dropdown menu', async () => {
      await wrapper.vm.$nextTick()

      const walletMenu = wrapper.find('[data-testid="wallet-menu"]')
      await walletMenu.trigger('click')

      expect(wrapper.find('[data-testid="wallet-dropdown"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="view-on-explorer"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="add-token"]').exists()).toBe(true)
    })

    it('should open address in block explorer', async () => {
      window.open = vi.fn()
      await wrapper.vm.$nextTick()

      const walletMenu = wrapper.find('[data-testid="wallet-menu"]')
      await walletMenu.trigger('click')

      const explorerLink = wrapper.find('[data-testid="view-on-explorer"]')
      await explorerLink.trigger('click')

      expect(window.open).toHaveBeenCalledWith(
        'https://etherscan.io/address/0x1234567890123456789012345678901234567890',
        '_blank'
      )
    })

    it('should add XMBL token to wallet', async () => {
      await wrapper.vm.$nextTick()

      const walletMenu = wrapper.find('[data-testid="wallet-menu"]')
      await walletMenu.trigger('click')

      const addTokenButton = wrapper.find('[data-testid="add-token"]')
      await addTokenButton.trigger('click')

      expect(walletStore.addToken).toHaveBeenCalledWith({
        address: expect.any(String),
        symbol: 'XMBL',
        decimals: 18,
        image: expect.any(String)
      })
    })
  })

  describe('Network Management', () => {
    beforeEach(() => {
      walletStore.isConnected = true
      walletStore.address = '0x1234567890123456789012345678901234567890'
    })

    it('should show network indicator', async () => {
      walletStore.networkId = 1
      walletStore.networkName = 'Ethereum Mainnet'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="network-indicator"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="network-name"]').text())
        .toContain('Ethereum Mainnet')
    })

    it('should indicate unsupported networks', async () => {
      walletStore.networkId = 56 // BSC
      walletStore.networkName = 'Binance Smart Chain'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="unsupported-network"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="network-warning"]').text())
        .toContain('Unsupported network')
    })

    it('should provide network switching', async () => {
      walletStore.networkId = 56 // BSC
      await wrapper.vm.$nextTick()

      const switchButton = wrapper.find('[data-testid="switch-network"]')
      await switchButton.trigger('click')

      expect(walletStore.switchNetwork).toHaveBeenCalledWith(1) // Ethereum
    })

    it('should show supported networks list', async () => {
      const networkDropdown = wrapper.find('[data-testid="network-dropdown"]')
      await networkDropdown.trigger('click')

      expect(wrapper.find('[data-testid="network-ethereum"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="network-polygon"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="network-arbitrum"]').exists()).toBe(true)
    })

    it('should switch to selected network', async () => {
      const networkDropdown = wrapper.find('[data-testid="network-dropdown"]')
      await networkDropdown.trigger('click')

      const polygonOption = wrapper.find('[data-testid="network-polygon"]')
      await polygonOption.trigger('click')

      expect(walletStore.switchNetwork).toHaveBeenCalledWith(137) // Polygon
    })

    it('should show network switching loading state', async () => {
      walletStore.isSwitchingNetwork = true
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="switching-network"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="switching-message"]').text())
        .toContain('Switching network...')
    })
  })

  describe('Account Changes', () => {
    it('should handle account changes', async () => {
      walletStore.isConnected = true
      walletStore.address = '0x1234567890123456789012345678901234567890'
      await wrapper.vm.$nextTick()

      // Simulate account change
      walletStore.address = '0x9876543210987654321098765432109876543210'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="wallet-address"]').text())
        .toContain('0x9876...3210')
    })

    it('should refresh balance on account change', async () => {
      walletStore.isConnected = true
      await wrapper.vm.$nextTick()

      // Simulate account change
      window.dispatchEvent(new CustomEvent('accountsChanged', {
        detail: ['0x9876543210987654321098765432109876543210']
      }))

      await wrapper.vm.$nextTick()

      expect(walletStore.connectWallet).toHaveBeenCalled()
    })

    it('should handle disconnection when accounts are cleared', async () => {
      walletStore.isConnected = true
      await wrapper.vm.$nextTick()

      // Simulate account disconnection
      window.dispatchEvent(new CustomEvent('accountsChanged', {
        detail: []
      }))

      await wrapper.vm.$nextTick()

      expect(walletStore.disconnectWallet).toHaveBeenCalled()
    })

    it('should handle chain changes', async () => {
      walletStore.isConnected = true
      walletStore.networkId = 1
      await wrapper.vm.$nextTick()

      // Simulate chain change
      window.dispatchEvent(new CustomEvent('chainChanged', {
        detail: '0x89' // Polygon
      }))

      await wrapper.vm.$nextTick()

      expect(walletStore.networkId).toBe(137)
    })
  })

  describe('Error Handling', () => {
    it('should handle MetaMask not installed', async () => {
      walletStore.supportedWallets[0].installed = false
      walletStore.supportedWallets[0].available = false
      await wrapper.vm.$nextTick()

      const metamaskOption = wrapper.find('[data-testid="wallet-option-metamask"]')
      expect(metamaskOption.classes()).toContain('not-installed')
      expect(metamaskOption.find('[data-testid="install-prompt"]').exists()).toBe(true)
    })

    it('should handle connection timeout', async () => {
      walletStore.connectWallet.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        })
      })

      const metamaskOption = wrapper.find('[data-testid="wallet-option-metamask"]')
      await metamaskOption.trigger('click')

      await new Promise(resolve => setTimeout(resolve, 150))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="connection-error"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="error-message"]').text())
        .toContain('Connection timeout')
    })

    it('should handle user rejection', async () => {
      walletStore.error = 'User rejected the request'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="user-rejected"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="rejection-message"]').text())
        .toContain('Connection was cancelled')
    })

    it('should handle network errors gracefully', async () => {
      walletStore.error = 'Network error: Unable to connect to Ethereum network'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="network-error"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="network-error-message"]').text())
        .toContain('Network connection issue')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      expect(wrapper.find('[data-testid="wallet-connect-modal"]').attributes('role'))
        .toBe('dialog')
      expect(wrapper.find('[data-testid="wallet-connect-modal"]').attributes('aria-label'))
        .toBe('Connect your wallet')
    })

    it('should support keyboard navigation', async () => {
      const firstWallet = wrapper.find('[data-testid="wallet-option"]:first-child')
      await firstWallet.trigger('keydown.enter')

      expect(walletStore.connectWallet).toHaveBeenCalled()
    })

    it('should trap focus within modal', async () => {
      const modal = wrapper.find('[data-testid="wallet-connect-modal"]')
      const firstFocusable = modal.find('[data-testid="wallet-option"]:first-child')
      const lastFocusable = modal.find('[data-testid="close-modal"]')

      // Tab from last element should focus first
      await lastFocusable.trigger('keydown.tab')
      expect(document.activeElement).toBe(firstFocusable.element)

      // Shift+Tab from first element should focus last
      await firstFocusable.trigger('keydown.tab', { shiftKey: true })
      expect(document.activeElement).toBe(lastFocusable.element)
    })

    it('should announce connection status changes', async () => {
      const statusRegion = wrapper.find('[data-testid="connection-status"]')
      expect(statusRegion.attributes('aria-live')).toBe('polite')

      walletStore.isConnected = true
      await wrapper.vm.$nextTick()

      expect(statusRegion.text()).toContain('Wallet connected successfully')
    })

    it('should support screen reader announcements', async () => {
      walletStore.isConnecting = true
      await wrapper.vm.$nextTick()

      const announcement = wrapper.find('[data-testid="sr-announcement"]')
      expect(announcement.attributes('aria-live')).toBe('assertive')
      expect(announcement.text()).toContain('Connecting to wallet')
    })
  })

  describe('Mobile Experience', () => {
    it('should adapt layout for mobile devices', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })
      window.dispatchEvent(new Event('resize'))

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="mobile-wallet-connect"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="wallet-grid"]').classes()).toContain('mobile')
    })

    it('should provide deep linking for mobile wallets', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mobile Safari',
        writable: true
      })

      const walletConnectOption = wrapper.find('[data-testid="wallet-option-walletconnect"]')
      await walletConnectOption.trigger('click')

      expect(walletStore.connectWallet).toHaveBeenCalledWith('walletconnect', {
        mobile: true,
        deepLink: true
      })
    })

    it('should show QR code for desktop WalletConnect', async () => {
      const walletConnectOption = wrapper.find('[data-testid="wallet-option-walletconnect"]')
      await walletConnectOption.trigger('click')

      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="qr-code-modal"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="qr-code"]').exists()).toBe(true)
    })
  })

  describe('Security Features', () => {
    it('should warn about phishing sites', () => {
      expect(wrapper.find('[data-testid="security-warning"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="phishing-warning"]').text())
        .toContain('Always verify you are on the correct website')
    })

    it('should show connection security information', async () => {
      walletStore.isConnected = true
      await wrapper.vm.$nextTick()

      const securityInfo = wrapper.find('[data-testid="connection-security"]')
      expect(securityInfo.exists()).toBe(true)
      expect(securityInfo.text()).toContain('Secure connection established')
    })

    it('should validate wallet permissions', async () => {
      walletStore.isConnected = true
      walletStore.permissions = ['eth_accounts', 'personal_sign']
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="permissions-indicator"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="permissions-list"]').text())
        .toContain('Account access')
    })

    it('should provide permission management', async () => {
      walletStore.isConnected = true
      await wrapper.vm.$nextTick()

      const permissionsButton = wrapper.find('[data-testid="manage-permissions"]')
      await permissionsButton.trigger('click')

      expect(wrapper.find('[data-testid="permissions-modal"]').exists()).toBe(true)
    })
  })
})
