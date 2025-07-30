import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BitcoinService } from '../../services/bitcoinService'
import type { HTLC, BitcoinTransaction, UTXOSet } from '../../services/bitcoinService'

// Mock bitcoinjs-lib
vi.mock('bitcoinjs-lib', () => ({
  payments: {
    p2sh: vi.fn(),
    p2wpkh: vi.fn(),
  },
  Transaction: vi.fn(),
  crypto: {
    sha256: vi.fn(),
    hash160: vi.fn(),
  },
  script: {
    compile: vi.fn(),
    decompile: vi.fn(),
  },
  networks: {
    bitcoin: {},
    testnet: {},
  },
  ECPair: {
    fromPrivateKey: vi.fn(),
  },
}))

// Mock node-fetch for Bitcoin RPC calls
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

describe('BitcoinService', () => {
  let bitcoinService: BitcoinService
  const mockRpcUrl = 'https://bitcoin-rpc.test'
  const mockRpcUser = 'test-user'
  const mockRpcPassword = 'test-password'

  beforeEach(() => {
    bitcoinService = new BitcoinService({
      rpcUrl: mockRpcUrl,
      rpcUser: mockRpcUser,
      rpcPassword: mockRpcPassword,
      network: 'testnet'
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Service Initialization', () => {
    it('should initialize with RPC configuration', () => {
      expect(bitcoinService).toBeInstanceOf(BitcoinService)
      expect(bitcoinService.rpcUrl).toBe(mockRpcUrl)
      expect(bitcoinService.network).toBe('testnet')
    })

    it('should throw error without RPC URL', () => {
      expect(() => new BitcoinService({
        rpcUrl: '',
        rpcUser: mockRpcUser,
        rpcPassword: mockRpcPassword
      })).toThrow('Bitcoin RPC URL is required')
    })

    it('should throw error without credentials', () => {
      expect(() => new BitcoinService({
        rpcUrl: mockRpcUrl,
        rpcUser: '',
        rpcPassword: mockRpcPassword
      })).toThrow('Bitcoin RPC credentials are required')
    })

    it('should default to mainnet if network not specified', () => {
      const service = new BitcoinService({
        rpcUrl: mockRpcUrl,
        rpcUser: mockRpcUser,
        rpcPassword: mockRpcPassword
      })
      expect(service.network).toBe('mainnet')
    })
  })

  describe('HTLC Operations', () => {
    const mockHTLCData = {
      amount: '0.01',
      secretHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      timelock: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    }

    it('should create HTLC successfully', async () => {
      const mockTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      
      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: { txid: mockTxId }
        }),
      } as any)

      const txId = await bitcoinService.createHTLC(
        mockHTLCData.amount,
        mockHTLCData.secretHash,
        mockHTLCData.recipientAddress,
        mockHTLCData.timelock
      )

      expect(txId).toBe(mockTxId)
      expect(fetch.default).toHaveBeenCalledWith(
        mockRpcUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('sendrawtransaction'),
        })
      )
    })

    it('should validate HTLC parameters', async () => {
      await expect(bitcoinService.createHTLC('0', mockHTLCData.secretHash, mockHTLCData.recipientAddress, mockHTLCData.timelock))
        .rejects.toThrow('Amount must be greater than 0')

      await expect(bitcoinService.createHTLC(mockHTLCData.amount, 'invalid-hash', mockHTLCData.recipientAddress, mockHTLCData.timelock))
        .rejects.toThrow('Invalid secret hash format')

      await expect(bitcoinService.createHTLC(mockHTLCData.amount, mockHTLCData.secretHash, 'invalid-address', mockHTLCData.timelock))
        .rejects.toThrow('Invalid recipient address')

      await expect(bitcoinService.createHTLC(mockHTLCData.amount, mockHTLCData.secretHash, mockHTLCData.recipientAddress, Date.now() / 1000 - 3600))
        .rejects.toThrow('Timelock must be in the future')
    })

    it('should claim HTLC with valid secret', async () => {
      const mockHTLCTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const mockSecret = '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234'
      const mockClaimTxId = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321'

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: { txid: mockClaimTxId }
        }),
      } as any)

      const claimTxId = await bitcoinService.claimHTLC(mockHTLCTxId, mockSecret)

      expect(claimTxId).toBe(mockClaimTxId)
    })

    it('should handle HTLC claim failures', async () => {
      const mockHTLCTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const mockSecret = '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234'

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Transaction rejected' }
        }),
      } as any)

      await expect(bitcoinService.claimHTLC(mockHTLCTxId, mockSecret))
        .rejects.toThrow('Transaction rejected')
    })

    it('should refund expired HTLC', async () => {
      const mockHTLCTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const mockRefundTxId = '0x9999999999999999999999999999999999999999999999999999999999999999'

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: { txid: mockRefundTxId }
        }),
      } as any)

      const refundTxId = await bitcoinService.refundHTLC(mockHTLCTxId)

      expect(refundTxId).toBe(mockRefundTxId)
    })

    it('should prevent early HTLC refund', async () => {
      const mockHTLCTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

      // Mock HTLC that hasn't expired yet
      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            locktime: Math.floor(Date.now() / 1000) + 3600 // 1 hour in future
          }
        }),
      } as any)

      await expect(bitcoinService.refundHTLC(mockHTLCTxId))
        .rejects.toThrow('HTLC has not expired yet')
    })
  })

  describe('Secret Management', () => {
    it('should generate cryptographic secret', () => {
      const secret = bitcoinService.generateSecret()

      expect(typeof secret).toBe('string')
      expect(secret).toMatch(/^0x[a-fA-F0-9]{64}$/) // 32 bytes in hex
    })

    it('should generate unique secrets', () => {
      const secret1 = bitcoinService.generateSecret()
      const secret2 = bitcoinService.generateSecret()

      expect(secret1).not.toBe(secret2)
    })

    it('should hash secret correctly', () => {
      const secret = '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234'
      const expectedHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      const bitcoin = require('bitcoinjs-lib')
      vi.mocked(bitcoin.crypto.sha256).mockReturnValue(Buffer.from(expectedHash.slice(2), 'hex'))

      const hash = bitcoinService.hashSecret(secret)

      expect(hash).toBe(expectedHash)
      expect(bitcoin.crypto.sha256).toHaveBeenCalledWith(Buffer.from(secret.slice(2), 'hex'))
    })

    it('should validate secret format before hashing', () => {
      expect(() => bitcoinService.hashSecret('invalid-secret'))
        .toThrow('Invalid secret format')

      expect(() => bitcoinService.hashSecret('0x123')) // Too short
        .toThrow('Secret must be 32 bytes')
    })
  })

  describe('Transaction Broadcasting', () => {
    it('should broadcast signed transaction', async () => {
      const mockSignedTx = '0102000000010189abcdefabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabba0000000000ffffffff0280969800000000001976a914389ffce9cd9ae88dcc0631e88a821ffdbe9bfe2615488ac80969800000000001976a9147480a33f950689af511e6e84c138dbbd3c3ee41588ac0000000000'
      const mockTxId = '0x7654321076543210765432107654321076543210765432107654321076543210'

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: mockTxId
        }),
      } as any)

      const txId = await bitcoinService.broadcastTransaction(mockSignedTx)

      expect(txId).toBe(mockTxId)
      expect(fetch.default).toHaveBeenCalledWith(
        mockRpcUrl,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('sendrawtransaction'),
        })
      )
    })

    it('should handle broadcast failures', async () => {
      const mockSignedTx = 'invalid-transaction-hex'

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Invalid transaction format' }
        }),
      } as any)

      await expect(bitcoinService.broadcastTransaction(mockSignedTx))
        .rejects.toThrow('Invalid transaction format')
    })

    it('should validate transaction format before broadcasting', async () => {
      await expect(bitcoinService.broadcastTransaction(''))
        .rejects.toThrow('Transaction data is required')

      await expect(bitcoinService.broadcastTransaction('invalid-hex'))
        .rejects.toThrow('Invalid transaction hex format')
    })
  })

  describe('UTXO Management', () => {
    it('should get UTXOs for address', async () => {
      const mockAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
      const mockUTXOs: UTXOSet = {
        address: mockAddress,
        utxos: [
          {
            txid: '0x1111111111111111111111111111111111111111111111111111111111111111',
            vout: 0,
            amount: '0.01',
            confirmations: 6,
            scriptPubKey: '0014751e76c3dce3b8f1a2e4b4e1e8ccd6e7b5c5a3d4'
          },
          {
            txid: '0x2222222222222222222222222222222222222222222222222222222222222222',
            vout: 1,
            amount: '0.005',
            confirmations: 12,
            scriptPubKey: '0014751e76c3dce3b8f1a2e4b4e1e8ccd6e7b5c5a3d4'
          }
        ],
        totalAmount: '0.015'
      }

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: mockUTXOs.utxos
        }),
      } as any)

      const utxos = await bitcoinService.getUTXOs(mockAddress)

      expect(utxos).toEqual(mockUTXOs)
      expect(utxos.utxos).toHaveLength(2)
      expect(parseFloat(utxos.totalAmount)).toBe(0.015)
    })

    it('should handle empty UTXO set', async () => {
      const mockAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: []
        }),
      } as any)

      const utxos = await bitcoinService.getUTXOs(mockAddress)

      expect(utxos.utxos).toHaveLength(0)
      expect(utxos.totalAmount).toBe('0')
    })

    it('should filter UTXOs by minimum confirmations', async () => {
      const mockAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
      const minConfirmations = 6

      const mockUTXOs = [
        { txid: '0x1111', vout: 0, amount: '0.01', confirmations: 10 },
        { txid: '0x2222', vout: 1, amount: '0.005', confirmations: 3 }, // Below threshold
        { txid: '0x3333', vout: 0, amount: '0.02', confirmations: 8 }
      ]

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: mockUTXOs
        }),
      } as any)

      const utxos = await bitcoinService.getUTXOs(mockAddress, minConfirmations)

      expect(utxos.utxos).toHaveLength(2) // Only confirmed UTXOs
      expect(utxos.utxos.every(utxo => utxo.confirmations >= minConfirmations)).toBe(true)
    })
  })

  describe('Transaction Building', () => {
    it('should build raw transaction', async () => {
      const mockInputs = [
        {
          txid: '0x1111111111111111111111111111111111111111111111111111111111111111',
          vout: 0,
          amount: '0.01'
        }
      ]

      const mockOutputs = [
        {
          address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
          amount: '0.009' // 0.001 BTC fee
        }
      ]

      const mockRawTx = '0102000000010111111111111111111111111111111111111111111111111111111111111111110000000000ffffffff01c0d40100000000001600140123456789abcdef0123456789abcdef01234567000000000'

      const bitcoin = require('bitcoinjs-lib')
      const mockTxBuilder = {
        addInput: vi.fn(),
        addOutput: vi.fn(),
        build: vi.fn().mockReturnValue({
          toHex: () => mockRawTx
        })
      }
      bitcoin.Transaction.mockReturnValue(mockTxBuilder)

      const rawTx = await bitcoinService.buildTransaction(mockInputs, mockOutputs)

      expect(rawTx).toBe(mockRawTx)
      expect(mockTxBuilder.addInput).toHaveBeenCalledWith(mockInputs[0].txid, mockInputs[0].vout)
      expect(mockTxBuilder.addOutput).toHaveBeenCalledWith(mockOutputs[0].address, expect.any(Number))
    })

    it('should calculate appropriate transaction fees', () => {
      const inputCount = 2
      const outputCount = 1
      const feeRate = 10 // sat/vB

      const estimatedFee = bitcoinService.estimateFee(inputCount, outputCount, feeRate)

      // Typical transaction: (inputCount * 148 + outputCount * 34 + 10) * feeRate
      const expectedSize = inputCount * 148 + outputCount * 34 + 10
      const expectedFee = expectedSize * feeRate

      expect(estimatedFee).toBe(expectedFee)
    })

    it('should validate transaction inputs and outputs', async () => {
      const invalidInputs = [] // Empty inputs
      const validOutputs = [{ address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', amount: '0.01' }]

      await expect(bitcoinService.buildTransaction(invalidInputs, validOutputs))
        .rejects.toThrow('At least one input is required')

      const validInputs = [{ txid: '0x1111', vout: 0, amount: '0.01' }]
      const invalidOutputs = [] // Empty outputs

      await expect(bitcoinService.buildTransaction(validInputs, invalidOutputs))
        .rejects.toThrow('At least one output is required')
    })
  })

  describe('Address Validation', () => {
    it('should validate Bitcoin addresses', () => {
      // Valid addresses
      expect(bitcoinService.isValidAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true) // P2PKH
      expect(bitcoinService.isValidAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true) // P2SH
      expect(bitcoinService.isValidAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true) // Bech32

      // Invalid addresses
      expect(bitcoinService.isValidAddress('invalid-address')).toBe(false)
      expect(bitcoinService.isValidAddress('')).toBe(false)
      expect(bitcoinService.isValidAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfN')).toBe(false) // Invalid checksum
    })

    it('should validate testnet addresses', () => {
      const testnetService = new BitcoinService({
        rpcUrl: mockRpcUrl,
        rpcUser: mockRpcUser,
        rpcPassword: mockRpcPassword,
        network: 'testnet'
      })

      expect(testnetService.isValidAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(true)
      expect(testnetService.isValidAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false) // Mainnet address
    })
  })

  describe('RPC Connection', () => {
    it('should test RPC connection', async () => {
      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: { version: 220000, blocks: 700000 }
        }),
      } as any)

      const isConnected = await bitcoinService.testConnection()

      expect(isConnected).toBe(true)
      expect(fetch.default).toHaveBeenCalledWith(
        mockRpcUrl,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('getblockchaininfo'),
        })
      )
    })

    it('should handle RPC connection failures', async () => {
      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockRejectedValue(new Error('Connection refused'))

      const isConnected = await bitcoinService.testConnection()

      expect(isConnected).toBe(false)
    })

    it('should retry failed RPC calls with exponential backoff', async () => {
      let callCount = 0
      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: 'success' }),
        } as any)
      })

      const result = await bitcoinService.rpcCall('getbestblockhash', [])

      expect(callCount).toBe(3)
      expect(result).toBe('success')
    })
  })

  describe('Monitoring and Events', () => {
    it('should monitor HTLC transactions', async () => {
      const mockHTLCTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const mockCallback = vi.fn()

      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            confirmations: 6,
            blockhash: '0x0000000000000000000000000000000000000000000000000000000000000000'
          }
        }),
      } as any)

      await bitcoinService.monitorTransaction(mockHTLCTxId, 6, mockCallback)

      expect(mockCallback).toHaveBeenCalledWith({
        txid: mockHTLCTxId,
        confirmations: 6,
        confirmed: true
      })
    })

    it('should emit events for transaction status changes', async () => {
      const mockHTLCTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const eventHandler = vi.fn()

      bitcoinService.on('transaction:confirmed', eventHandler)

      // Simulate transaction confirmation
      bitcoinService.emit('transaction:confirmed', {
        txid: mockHTLCTxId,
        confirmations: 6
      })

      expect(eventHandler).toHaveBeenCalledWith({
        txid: mockHTLCTxId,
        confirmations: 6
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle network connectivity issues', async () => {
      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(bitcoinService.testConnection())
        .resolves.toBe(false) // Should not throw, just return false
    })

    it('should handle invalid RPC responses', async () => {
      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: { message: 'Method not found' } }),
      } as any)

      await expect(bitcoinService.rpcCall('invalidmethod', []))
        .rejects.toThrow('Method not found')
    })

    it('should validate transaction parameters', async () => {
      await expect(bitcoinService.createHTLC('-1', 'hash', 'address', 123))
        .rejects.toThrow('Amount must be greater than 0')

      await expect(bitcoinService.claimHTLC('invalid-txid', 'secret'))
        .rejects.toThrow('Invalid transaction ID format')
    })
  })

  describe('Security', () => {
    it('should securely store and handle private keys', () => {
      const privateKey = bitcoinService.generatePrivateKey()

      expect(typeof privateKey).toBe('string')
      expect(privateKey).toMatch(/^[a-fA-F0-9]{64}$/) // 32 bytes in hex
    })

    it('should validate secret hash against revealed secret', () => {
      const secret = bitcoinService.generateSecret()
      const hash = bitcoinService.hashSecret(secret)

      expect(bitcoinService.verifySecret(secret, hash)).toBe(true)
      expect(bitcoinService.verifySecret('0x' + '1'.repeat(64), hash)).toBe(false)
    })

    it('should prevent double spending in HTLC claims', async () => {
      const mockHTLCTxId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const mockSecret = '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234'

      // Mock first claim success
      const fetch = await import('node-fetch')
      vi.mocked(fetch.default).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { txid: '0xabc123' } }),
      } as any)

      await bitcoinService.claimHTLC(mockHTLCTxId, mockSecret)

      // Mock second claim failure (already spent)
      vi.mocked(fetch.default).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Transaction already spent' } }),
      } as any)

      await expect(bitcoinService.claimHTLC(mockHTLCTxId, mockSecret))
        .rejects.toThrow('Transaction already spent')
    })
  })
})
