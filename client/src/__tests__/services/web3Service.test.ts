import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { Web3Service } from '../../services/web3Service'
import type { ContractConfig, TransactionReceipt, WalletProvider, NFTData, TBAAccount } from '../../services/web3Service'

// Mock ethers.js
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn(),
    Contract: vi.fn(),
    formatEther: vi.fn(),
    parseEther: vi.fn(),
    parseUnits: vi.fn(),
    formatUnits: vi.fn(),
  },
}))

// Mock window.ethereum
const mockEthereum = {
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  isConnected: vi.fn(),
}

Object.defineProperty(window, 'ethereum', {
  value: mockEthereum,
  writable: true,
})

describe('Web3Service', () => {
  let web3Service: Web3Service

  beforeEach(() => {
    web3Service = new Web3Service()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Wallet Connection', () => {
    it('should connect to MetaMask wallet successfully', async () => {
      // Test connecting to user's wallet
      mockEthereum.request.mockResolvedValue(['0x1234567890123456789012345678901234567890'])

      const address = await web3Service.connectWallet()

      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'eth_requestAccounts'
      })
      expect(address).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should handle wallet connection rejection', async () => {
      mockEthereum.request.mockRejectedValue(new Error('User rejected request'))

      await expect(web3Service.connectWallet()).rejects.toThrow('User rejected request')
    })

    it('should disconnect wallet properly', () => {
      web3Service.disconnectWallet()

      expect(mockEthereum.removeListener).toHaveBeenCalledWith('accountsChanged', expect.any(Function))
      expect(mockEthereum.removeListener).toHaveBeenCalledWith('chainChanged', expect.any(Function))
    })

    it('should get connected wallet address', async () => {
      mockEthereum.request.mockResolvedValue(['0x1234567890123456789012345678901234567890'])

      const account = await web3Service.getAccount()

      expect(account).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should return null when no wallet connected', async () => {
      mockEthereum.request.mockResolvedValue([])

      const account = await web3Service.getAccount()

      expect(account).toBeNull()
    })
  })

  describe('Balance Operations', () => {
    it('should get ETH balance for address', async () => {
      const mockBalance = '1.5'
      mockEthereum.request.mockResolvedValue('0x14d1120d7b160000') // 1.5 ETH in wei

      const balance = await web3Service.getBalance('0x1234567890123456789012345678901234567890')

      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'eth_getBalance',
        params: ['0x1234567890123456789012345678901234567890', 'latest']
      })
    })

    it('should handle balance fetch errors', async () => {
      mockEthereum.request.mockRejectedValue(new Error('Network error'))

      await expect(web3Service.getBalance('0x1234567890123456789012345678901234567890'))
        .rejects.toThrow('Network error')
    })
  })

  describe('Contract Management', () => {
    it('should initialize contract instance with valid config', () => {
      const config: ContractConfig = {
        address: '0x1234567890123456789012345678901234567890',
        abi: [{ name: 'test', type: 'function' }]
      }

      web3Service.initContract('XMBLVault', config)

      const contract = web3Service.getContract('XMBLVault')
      expect(contract).toBeDefined()
    })

    it('should throw error for invalid contract name', () => {
      expect(() => web3Service.getContract('NonExistent'))
        .toThrow('Contract NonExistent not initialized')
    })

    it('should validate contract address format', () => {
      const invalidConfig: ContractConfig = {
        address: 'invalid-address',
        abi: []
      }

      expect(() => web3Service.initContract('Test', invalidConfig))
        .toThrow('Invalid contract address')
    })
  })

  describe('XMBL Vault Operations', () => {
    beforeEach(() => {
      const vaultConfig: ContractConfig = {
        address: '0x1234567890123456789012345678901234567890',
        abi: [
          { name: 'deposit', type: 'function', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }] },
          { name: 'withdraw', type: 'function', inputs: [{ name: 'tokenId', type: 'uint256' }] }
        ]
      }
      web3Service.initContract('XMBLVault', vaultConfig)
    })

    it('should deposit tokens and create NFT with TBA', async () => {
      const depositResult = {
        transactionHash: '0xabcd',
        tokenId: 1,
        tbaAddress: '0x5678',
        xmblAmount: '1000'
      }

      const result = await web3Service.depositToVault('0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', '1000000000000000000')

      expect(result).toMatchObject({
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
        tokenId: expect.any(Number),
        tbaAddress: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
        xmblAmount: expect.any(String)
      })
    })

    it('should handle deposit failures', async () => {
      await expect(web3Service.depositToVault('invalid-address', '1000'))
        .rejects.toThrow('Invalid token address')
    })

    it('should validate deposit amount', async () => {
      await expect(web3Service.depositToVault('0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', '0'))
        .rejects.toThrow('Invalid deposit amount')
    })
  })

  describe('NFT Operations', () => {
    it('should get user\'s XMBL NFT collection', async () => {
      const expectedNFTs: NFTData[] = [
        {
          tokenId: 1,
          depositValue: '1000',
          tbaAddress: '0x5678',
          accruedYields: '50',
          createdAt: new Date(),
          tokenAddress: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e'
        }
      ]

      const nfts = await web3Service.getXMBLNFTs('0x1234567890123456789012345678901234567890')

      expect(Array.isArray(nfts)).toBe(true)
      expect(nfts).toEqual(expectedNFTs)
    })

    it('should get individual NFT deposit value', async () => {
      const value = await web3Service.getNFTValue(1)

      expect(value).toBe('1000')
    })

    it('should handle invalid NFT ID', async () => {
      await expect(web3Service.getNFTValue(999))
        .rejects.toThrow('NFT not found')
    })
  })

  describe('Token Bound Account (TBA) Operations', () => {
    it('should get TBA address for NFT', async () => {
      const tbaAddress = await web3Service.getTBAAddress(1)

      expect(tbaAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should get TBA balance', async () => {
      const balance = await web3Service.getTBABalance('0x5678901234567890123456789012345678901234')

      expect(typeof balance).toBe('string')
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0)
    })

    it('should create TBA for NFT', async () => {
      const tbaAddress = await web3Service.createTBA(1)

      expect(tbaAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should execute transaction from TBA', async () => {
      const receipt = await web3Service.executeTBATransaction(
        '0x5678901234567890123456789012345678901234',
        '0x1234567890123456789012345678901234567890',
        '1000000000000000000',
        '0x'
      )

      expect(receipt).toMatchObject({
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
        status: 1,
        gasUsed: expect.any(String)
      })
    })

    it('should validate TBA ownership before execution', async () => {
      await expect(web3Service.executeTBATransaction(
        '0x9999999999999999999999999999999999999999',
        '0x1234567890123456789012345678901234567890',
        '1000000000000000000',
        '0x'
      )).rejects.toThrow('Not authorized to execute TBA transaction')
    })
  })

  describe('Yield Operations', () => {
    it('should claim yields for specific NFT', async () => {
      const receipt = await web3Service.claimYields(1)

      expect(receipt).toMatchObject({
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
        status: 1
      })
    })

    it('should claim yields for multiple NFTs', async () => {
      const receipts = await web3Service.claimAllYields([1, 2, 3])

      expect(Array.isArray(receipts)).toBe(true)
      expect(receipts).toHaveLength(3)
      receipts.forEach(receipt => {
        expect(receipt).toMatchObject({
          transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
          status: 1
        })
      })
    })

    it('should handle claim failures for non-existent NFT', async () => {
      await expect(web3Service.claimYields(999))
        .rejects.toThrow('NFT not found or no yields available')
    })
  })

  describe('Token Operations', () => {
    it('should approve token spending', async () => {
      const receipt = await web3Service.approveToken(
        '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
        '0x1234567890123456789012345678901234567890',
        '1000000000000000000'
      )

      expect(receipt).toMatchObject({
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
        status: 1
      })
    })

    it('should validate token approval parameters', async () => {
      await expect(web3Service.approveToken('invalid', 'invalid', '0'))
        .rejects.toThrow('Invalid parameters for token approval')
    })
  })

  describe('Gas Estimation', () => {
    it('should estimate gas for contract method', async () => {
      const gasEstimate = await web3Service.estimateGas(
        vi.fn(),
        ['0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e', '1000000000000000000']
      )

      expect(typeof gasEstimate).toBe('string')
      expect(parseInt(gasEstimate)).toBeGreaterThan(0)
    })

    it('should handle gas estimation failures', async () => {
      await expect(web3Service.estimateGas(vi.fn(), []))
        .rejects.toThrow('Gas estimation failed')
    })
  })

  describe('Network Operations', () => {
    it('should switch to different network', async () => {
      await web3Service.switchNetwork(1) // Ethereum mainnet

      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }]
      })
    })

    it('should handle unsupported network switch', async () => {
      mockEthereum.request.mockRejectedValue({ code: 4902 })

      await expect(web3Service.switchNetwork(999))
        .rejects.toThrow('Network not supported')
    })
  })

  describe('Event Handling', () => {
    it('should handle wallet account changes', () => {
      const mockHandler = vi.fn()
      web3Service.on('accountChanged', mockHandler)

      // Simulate account change
      const accountChangeHandler = mockEthereum.on.mock.calls.find(
        call => call[0] === 'accountsChanged'
      )?.[1]

      accountChangeHandler?.(['0x9999999999999999999999999999999999999999'])

      expect(mockHandler).toHaveBeenCalledWith('0x9999999999999999999999999999999999999999')
    })

    it('should handle network changes', () => {
      const mockHandler = vi.fn()
      web3Service.on('chainChanged', mockHandler)

      // Simulate chain change
      const chainChangeHandler = mockEthereum.on.mock.calls.find(
        call => call[0] === 'chainChanged'
      )?.[1]

      chainChangeHandler?.('0x1')

      expect(mockHandler).toHaveBeenCalledWith('0x1')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockEthereum.request.mockRejectedValue(new Error('Network unreachable'))

      await expect(web3Service.connectWallet())
        .rejects.toThrow('Network unreachable')
    })

    it('should handle contract interaction errors', async () => {
      await expect(web3Service.depositToVault('0x0000000000000000000000000000000000000000', '1000'))
        .rejects.toThrow('Transaction failed')
    })

    it('should validate wallet provider compatibility', () => {
      // Test with unsupported provider
      Object.defineProperty(window, 'ethereum', { value: undefined })

      expect(() => new Web3Service())
        .toThrow('Ethereum provider not found')
    })
  })

  describe('Caching', () => {
    it('should cache contract instances for performance', () => {
      const config: ContractConfig = {
        address: '0x1234567890123456789012345678901234567890',
        abi: []
      }

      web3Service.initContract('Test', config)
      const contract1 = web3Service.getContract('Test')
      const contract2 = web3Service.getContract('Test')

      expect(contract1).toBe(contract2) // Should be same instance
    })

    it('should invalidate cache on network change', async () => {
      const config: ContractConfig = {
        address: '0x1234567890123456789012345678901234567890',
        abi: []
      }

      web3Service.initContract('Test', config)
      const contract1 = web3Service.getContract('Test')

      await web3Service.switchNetwork(5) // Switch to Goerli

      web3Service.initContract('Test', config)
      const contract2 = web3Service.getContract('Test')

      expect(contract1).not.toBe(contract2) // Should be different instances
    })
  })
})
