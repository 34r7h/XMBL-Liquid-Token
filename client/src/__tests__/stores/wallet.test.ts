import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWalletStore } from '../../stores/wallet'

// Mock web3Service
vi.mock('../../services/web3Service', () => ({
  web3Service: {
    connectWallet: vi.fn(),
    disconnectWallet: vi.fn(),
    getProvider: vi.fn(),
    switchNetwork: vi.fn(),
    getBalance: vi.fn(),
    watchAccountChanges: vi.fn(),
    watchChainChanges: vi.fn(),
    getUserNFTs: vi.fn(),
    getTBAAddress: vi.fn(),
    getTBABalance: vi.fn(),
    isValidNetwork: vi.fn()
  }
}))

// Mock ethereum provider
const mockProvider = {
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  isMetaMask: true,
  selectedAddress: null,
  chainId: '0x1',
  networkVersion: '1'
}

global.ethereum = mockProvider

describe('Wallet Store', () => {
  let store: ReturnType<typeof useWalletStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWalletStore()
    vi.clearAllMocks()

    // Reset localStorage
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      expect(store.isConnected).toBe(false)
      expect(store.account).toBeNull()
      expect(store.chainId).toBeNull()
      expect(store.balance).toBe('0')
      expect(store.provider).toBeNull()
      expect(store.isConnecting).toBe(false)
      expect(store.error).toBeNull()
      expect(store.xmblNFTs).toEqual([])
      expect(store.selectedNFT).toBeNull()
    })

    it('should initialize from localStorage if available', () => {
      const mockData = {
        account: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        isConnected: true
      }
      localStorage.setItem('wallet_connection', JSON.stringify(mockData))

      store = useWalletStore()

      expect(store.account).toBe(mockData.account)
      expect(store.chainId).toBe(mockData.chainId)
      expect(store.isConnected).toBe(mockData.isConnected)
    })

    it('should handle invalid localStorage data gracefully', () => {
      localStorage.setItem('wallet_connection', 'invalid-json')

      store = useWalletStore()

      expect(store.isConnected).toBe(false)
      expect(store.account).toBeNull()
    })
  })

  describe('Wallet Connection', () => {
    it('should connect wallet successfully', async () => {
      const mockAccount = '0x1234567890123456789012345678901234567890'
      const mockChainId = 1
      const mockBalance = '5.25'

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockResolvedValue({
        account: mockAccount,
        chainId: mockChainId,
        provider: mockProvider
      })
      vi.mocked(web3Service.getBalance).mockResolvedValue(mockBalance)

      await store.connectWallet()

      expect(store.isConnected).toBe(true)
      expect(store.account).toBe(mockAccount)
      expect(store.chainId).toBe(mockChainId)
      expect(store.balance).toBe(mockBalance)
      expect(store.provider).toBe(mockProvider)
      expect(store.error).toBeNull()
    })

    it('should handle connection rejection', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockRejectedValue(new Error('User rejected request'))

      await expect(store.connectWallet()).rejects.toThrow('User rejected request')

      expect(store.isConnected).toBe(false)
      expect(store.error).toBe('User rejected request')
      expect(store.isConnecting).toBe(false)
    })

    it('should set connecting state during connection', async () => {
      let resolveConnection: (value: any) => void
      const connectionPromise = new Promise(resolve => { resolveConnection = resolve })

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockReturnValue(connectionPromise)

      const connectPromise = store.connectWallet()

      expect(store.isConnecting).toBe(true)

      resolveConnection!({
        account: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        provider: mockProvider
      })

      await connectPromise

      expect(store.isConnecting).toBe(false)
    })

    it('should persist connection data to localStorage', async () => {
      const mockAccount = '0x1234567890123456789012345678901234567890'
      const mockChainId = 1

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockResolvedValue({
        account: mockAccount,
        chainId: mockChainId,
        provider: mockProvider
      })
      vi.mocked(web3Service.getBalance).mockResolvedValue('5.25')

      await store.connectWallet()

      const storedData = JSON.parse(localStorage.getItem('wallet_connection') || '{}')
      expect(storedData.account).toBe(mockAccount)
      expect(storedData.chainId).toBe(mockChainId)
      expect(storedData.isConnected).toBe(true)
    })

    it('should load XMBL NFTs after successful connection', async () => {
      const mockNFTs = [
        {
          tokenId: 1,
          tbaAddress: '0xabc123...',
          balance: '1000',
          metadata: { name: 'XMBL #1' }
        },
        {
          tokenId: 2,
          tbaAddress: '0xdef456...',
          balance: '2000',
          metadata: { name: 'XMBL #2' }
        }
      ]

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockResolvedValue({
        account: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        provider: mockProvider
      })
      vi.mocked(web3Service.getBalance).mockResolvedValue('5.25')
      vi.mocked(web3Service.getUserNFTs).mockResolvedValue(mockNFTs)

      await store.connectWallet()

      expect(store.xmblNFTs).toEqual(mockNFTs)
      expect(web3Service.getUserNFTs).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890')
    })
  })

  describe('Wallet Disconnection', () => {
    beforeEach(async () => {
      // Setup connected state
      store.isConnected = true
      store.account = '0x1234567890123456789012345678901234567890'
      store.chainId = 1
      store.balance = '5.25'
      store.provider = mockProvider
      store.xmblNFTs = [{ tokenId: 1, tbaAddress: '0xabc', balance: '1000' }]
      store.selectedNFT = { tokenId: 1, tbaAddress: '0xabc', balance: '1000' }
    })

    it('should disconnect wallet and clear state', () => {
      const { web3Service } = vi.mocked(import('../../services/web3Service'))

      store.disconnectWallet()

      expect(store.isConnected).toBe(false)
      expect(store.account).toBeNull()
      expect(store.chainId).toBeNull()
      expect(store.balance).toBe('0')
      expect(store.provider).toBeNull()
      expect(store.error).toBeNull()
      expect(store.xmblNFTs).toEqual([])
      expect(store.selectedNFT).toBeNull()
    })

    it('should clear localStorage on disconnect', () => {
      localStorage.setItem('wallet_connection', JSON.stringify({ account: 'test' }))

      store.disconnectWallet()

      expect(localStorage.getItem('wallet_connection')).toBeNull()
    })

    it('should call web3Service disconnect', () => {
      const { web3Service } = vi.mocked(import('../../services/web3Service'))

      store.disconnectWallet()

      expect(web3Service.disconnectWallet).toHaveBeenCalled()
    })
  })

  describe('Network Management', () => {
    beforeEach(() => {
      store.isConnected = true
      store.account = '0x1234567890123456789012345678901234567890'
      store.provider = mockProvider
    })

    it('should switch network successfully', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.switchNetwork).mockResolvedValue(undefined)

      await store.switchNetwork(137) // Polygon

      expect(web3Service.switchNetwork).toHaveBeenCalledWith(137)
      expect(store.chainId).toBe(137)
    })

    it('should handle network switch failures', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.switchNetwork).mockRejectedValue(new Error('User rejected'))

      await expect(store.switchNetwork(137)).rejects.toThrow('User rejected')
      expect(store.error).toBe('User rejected')
    })

    it('should update balance after network switch', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.switchNetwork).mockResolvedValue(undefined)
      vi.mocked(web3Service.getBalance).mockResolvedValue('3.75')

      await store.switchNetwork(137)

      expect(store.balance).toBe('3.75')
    })

    it('should reload NFTs after network switch', async () => {
      const mockNFTs = [{ tokenId: 3, tbaAddress: '0xpolygon', balance: '500' }]

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.switchNetwork).mockResolvedValue(undefined)
      vi.mocked(web3Service.getBalance).mockResolvedValue('3.75')
      vi.mocked(web3Service.getUserNFTs).mockResolvedValue(mockNFTs)

      await store.switchNetwork(137)

      expect(store.xmblNFTs).toEqual(mockNFTs)
    })
  })

  describe('Balance Management', () => {
    beforeEach(() => {
      store.isConnected = true
      store.account = '0x1234567890123456789012345678901234567890'
      store.provider = mockProvider
    })

    it('should update balance successfully', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getBalance).mockResolvedValue('7.89')

      await store.updateBalance()

      expect(store.balance).toBe('7.89')
    })

    it('should handle balance update failures', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getBalance).mockRejectedValue(new Error('Network error'))

      await expect(store.updateBalance()).rejects.toThrow('Network error')
    })

    it('should not update balance when disconnected', async () => {
      store.isConnected = false

      await expect(store.updateBalance()).rejects.toThrow('Wallet not connected')
    })
  })

  describe('XMBL NFT Management', () => {
    beforeEach(() => {
      store.isConnected = true
      store.account = '0x1234567890123456789012345678901234567890'
      store.provider = mockProvider
    })

    it('should load XMBL NFTs successfully', async () => {
      const mockNFTs = [
        {
          tokenId: 1,
          tbaAddress: '0xabc123...',
          balance: '1000',
          metadata: { name: 'XMBL #1', image: 'ipfs://...' },
          depositedAmount: '500',
          yieldEarned: '50'
        },
        {
          tokenId: 2,
          tbaAddress: '0xdef456...',
          balance: '2000',
          metadata: { name: 'XMBL #2', image: 'ipfs://...' },
          depositedAmount: '1000',
          yieldEarned: '100'
        }
      ]

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getUserNFTs).mockResolvedValue(mockNFTs)

      await store.loadXMBLNFTs()

      expect(store.xmblNFTs).toEqual(mockNFTs)
    })

    it('should handle NFT loading failures', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getUserNFTs).mockRejectedValue(new Error('Contract error'))

      await expect(store.loadXMBLNFTs()).rejects.toThrow('Contract error')
    })

    it('should select NFT for operations', () => {
      store.xmblNFTs = [
        { tokenId: 1, tbaAddress: '0xabc', balance: '1000' },
        { tokenId: 2, tbaAddress: '0xdef', balance: '2000' }
      ]

      store.selectNFT(2)

      expect(store.selectedNFT).toEqual({
        tokenId: 2,
        tbaAddress: '0xdef',
        balance: '2000'
      })
    })

    it('should handle invalid NFT selection', () => {
      store.xmblNFTs = [{ tokenId: 1, tbaAddress: '0xabc', balance: '1000' }]

      expect(() => store.selectNFT(999)).toThrow('NFT not found')
    })

    it('should get TBA address for NFT', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getTBAAddress).mockResolvedValue('0xTBA123...')

      const tbaAddress = await store.getTBAAddress(1)

      expect(tbaAddress).toBe('0xTBA123...')
      expect(web3Service.getTBAAddress).toHaveBeenCalledWith(1)
    })

    it('should handle TBA address failures', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getTBAAddress).mockRejectedValue(new Error('TBA not created'))

      await expect(store.getTBAAddress(1)).rejects.toThrow('TBA not created')
    })

    it('should cache NFT data for performance', async () => {
      const mockNFTs = [{ tokenId: 1, tbaAddress: '0xabc', balance: '1000' }]

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getUserNFTs).mockResolvedValue(mockNFTs)

      await store.loadXMBLNFTs()
      await store.loadXMBLNFTs() // Second call should use cache

      expect(web3Service.getUserNFTs).toHaveBeenCalledTimes(1)
    })
  })

  describe('Account and Chain Watching', () => {
    beforeEach(() => {
      store.isConnected = true
      store.account = '0x1234567890123456789012345678901234567890'
      store.provider = mockProvider
    })

    it('should watch for account changes', () => {
      const { web3Service } = vi.mocked(import('../../services/web3Service'))

      store.watchAccountChanges()

      expect(web3Service.watchAccountChanges).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    it('should handle account change events', async () => {
      const newAccount = '0x9876543210987654321098765432109876543210'
      const mockNFTs = [{ tokenId: 3, tbaAddress: '0xnew', balance: '500' }]

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getBalance).mockResolvedValue('2.5')
      vi.mocked(web3Service.getUserNFTs).mockResolvedValue(mockNFTs)

      // Simulate account change callback
      let accountChangeCallback: (accounts: string[]) => void
      vi.mocked(web3Service.watchAccountChanges).mockImplementation((callback) => {
        accountChangeCallback = callback
      })

      store.watchAccountChanges()
      accountChangeCallback!([newAccount])

      await new Promise(resolve => setTimeout(resolve, 0)) // Wait for async operations

      expect(store.account).toBe(newAccount)
      expect(store.balance).toBe('2.5')
      expect(store.xmblNFTs).toEqual(mockNFTs)
    })

    it('should disconnect when no accounts provided', () => {
      let accountChangeCallback: (accounts: string[]) => void
      const { web3Service } = vi.mocked(import('../../services/web3Service'))
      vi.mocked(web3Service.watchAccountChanges).mockImplementation((callback) => {
        accountChangeCallback = callback
      })

      store.watchAccountChanges()
      accountChangeCallback!([])

      expect(store.isConnected).toBe(false)
      expect(store.account).toBeNull()
    })

    it('should watch for chain changes', () => {
      const { web3Service } = vi.mocked(import('../../services/web3Service'))

      store.watchChainChanges()

      expect(web3Service.watchChainChanges).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    it('should handle chain change events', async () => {
      const newChainId = 137 // Polygon
      const mockNFTs = [{ tokenId: 4, tbaAddress: '0xpoly', balance: '750' }]

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getBalance).mockResolvedValue('1.5')
      vi.mocked(web3Service.getUserNFTs).mockResolvedValue(mockNFTs)

      // Simulate chain change callback
      let chainChangeCallback: (chainId: number) => void
      vi.mocked(web3Service.watchChainChanges).mockImplementation((callback) => {
        chainChangeCallback = callback
      })

      store.watchChainChanges()
      chainChangeCallback!(newChainId)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(store.chainId).toBe(newChainId)
      expect(store.balance).toBe('1.5')
      expect(store.xmblNFTs).toEqual(mockNFTs)
    })
  })

  describe('Getters', () => {
    beforeEach(() => {
      store.account = '0x1234567890123456789012345678901234567890'
      store.balance = '5.123456789'
      store.chainId = 1
    })

    it('should validate network correctly', () => {
      const { web3Service } = vi.mocked(import('../../services/web3Service'))
      vi.mocked(web3Service.isValidNetwork).mockReturnValue(true)

      expect(store.isValidNetwork).toBe(true)
    })

    it('should format short address', () => {
      expect(store.shortAddress).toBe('0x1234...7890')
    })

    it('should handle null address in shortAddress', () => {
      store.account = null
      expect(store.shortAddress).toBe('')
    })

    it('should format balance correctly', () => {
      expect(store.formattedBalance).toBe('5.12 ETH')
    })

    it('should get network name', () => {
      expect(store.networkName).toBe('Ethereum Mainnet')

      store.chainId = 137
      expect(store.networkName).toBe('Polygon')

      store.chainId = 42161
      expect(store.networkName).toBe('Arbitrum One')

      store.chainId = 999
      expect(store.networkName).toBe('Unknown Network')
    })

    it('should calculate total NFT value', () => {
      store.xmblNFTs = [
        { tokenId: 1, balance: '1000', usdValue: 2500 },
        { tokenId: 2, balance: '2000', usdValue: 5000 }
      ]

      expect(store.totalNFTValue).toBe(7500)
    })

    it('should count active NFTs', () => {
      store.xmblNFTs = [
        { tokenId: 1, balance: '1000' },
        { tokenId: 2, balance: '2000' },
        { tokenId: 3, balance: '500' }
      ]

      expect(store.activeNFTCount).toBe(3)
    })

    it('should handle empty NFT array', () => {
      store.xmblNFTs = []

      expect(store.totalNFTValue).toBe(0)
      expect(store.activeNFTCount).toBe(0)
    })
  })

  describe('Persistence', () => {
    it('should save state to localStorage on connection', async () => {
      const mockData = {
        account: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        isConnected: true
      }

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockResolvedValue({
        account: mockData.account,
        chainId: mockData.chainId,
        provider: mockProvider
      })
      vi.mocked(web3Service.getBalance).mockResolvedValue('5.0')

      await store.connectWallet()

      const stored = JSON.parse(localStorage.getItem('wallet_connection') || '{}')
      expect(stored.account).toBe(mockData.account)
      expect(stored.chainId).toBe(mockData.chainId)
      expect(stored.isConnected).toBe(mockData.isConnected)
    })

    it('should cache NFT data with expiry', () => {
      const mockNFTs = [{ tokenId: 1, tbaAddress: '0xabc', balance: '1000' }]

      store.$patch({ xmblNFTs: mockNFTs })

      const cached = JSON.parse(localStorage.getItem('xmbl_nfts_cache') || '{}')
      expect(cached.data).toEqual(mockNFTs)
      expect(cached.timestamp).toBeTruthy()
      expect(cached.expiry).toBeTruthy()
    })

    it('should validate cached NFT data expiry', () => {
      const expiredCache = {
        data: [{ tokenId: 1 }],
        timestamp: Date.now() - 3600000, // 1 hour ago
        expiry: Date.now() - 1000 // Expired
      }

      localStorage.setItem('xmbl_nfts_cache', JSON.stringify(expiredCache))

      store.loadCachedNFTs()

      expect(store.xmblNFTs).toEqual([]) // Should not load expired data
    })

    it('should load valid cached NFT data', () => {
      const validCache = {
        data: [{ tokenId: 1, tbaAddress: '0xabc', balance: '1000' }],
        timestamp: Date.now(),
        expiry: Date.now() + 300000 // 5 minutes from now
      }

      localStorage.setItem('xmbl_nfts_cache', JSON.stringify(validCache))

      store.loadCachedNFTs()

      expect(store.xmblNFTs).toEqual(validCache.data)
    })
  })

  describe('Error Handling', () => {
    it('should handle provider initialization failures', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockRejectedValue(new Error('No provider found'))

      await expect(store.connectWallet()).rejects.toThrow('No provider found')
      expect(store.error).toBe('No provider found')
      expect(store.isConnected).toBe(false)
    })

    it('should handle network validation errors', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.isValidNetwork).mockReturnValue(false)

      store.chainId = 56 // BSC (unsupported)

      expect(store.isValidNetwork).toBe(false)
    })

    it('should clear error on successful operations', async () => {
      store.error = 'Previous error'

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockResolvedValue({
        account: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        provider: mockProvider
      })
      vi.mocked(web3Service.getBalance).mockResolvedValue('5.0')

      await store.connectWallet()

      expect(store.error).toBeNull()
    })

    it('should handle concurrent connection attempts', async () => {
      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.connectWallet).mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100))
      })

      const promise1 = store.connectWallet()
      const promise2 = store.connectWallet()

      // Second call should be ignored while first is pending
      expect(store.isConnecting).toBe(true)

      await Promise.all([promise1, promise2])

      expect(web3Service.connectWallet).toHaveBeenCalledTimes(1)
    })
  })

  describe('Auto-Refresh and Real-time Updates', () => {
    beforeEach(() => {
      store.isConnected = true
      store.account = '0x1234567890123456789012345678901234567890'
    })

    it('should start auto-refresh when connected', () => {
      vi.useFakeTimers()

      store.startAutoRefresh()

      expect(store.autoRefreshInterval).toBeTruthy()

      vi.useRealTimers()
    })

    it('should stop auto-refresh on disconnect', () => {
      vi.useFakeTimers()

      store.startAutoRefresh()
      const intervalId = store.autoRefreshInterval

      store.disconnectWallet()

      expect(clearInterval).toHaveBeenCalledWith(intervalId)

      vi.useRealTimers()
    })

    it('should refresh balance and NFTs periodically', async () => {
      vi.useFakeTimers()

      const { web3Service } = await import('../../services/web3Service')
      vi.mocked(web3Service.getBalance).mockResolvedValue('6.0')
      vi.mocked(web3Service.getUserNFTs).mockResolvedValue([])

      store.startAutoRefresh()

      vi.advanceTimersByTime(30000) // 30 seconds

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(web3Service.getBalance).toHaveBeenCalled()
      expect(web3Service.getUserNFTs).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should pause refresh when tab becomes inactive', () => {
      vi.useFakeTimers()

      store.startAutoRefresh()

      // Simulate tab becoming inactive
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true
      })

      document.dispatchEvent(new Event('visibilitychange'))

      expect(store.isRefreshPaused).toBe(true)

      vi.useRealTimers()
    })

    it('should resume refresh when tab becomes active', () => {
      vi.useFakeTimers()

      store.isRefreshPaused = true

      // Simulate tab becoming active
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      })

      document.dispatchEvent(new Event('visibilitychange'))

      expect(store.isRefreshPaused).toBe(false)

      vi.useRealTimers()
    })
  })
})
