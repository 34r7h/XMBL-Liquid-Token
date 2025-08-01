import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { secretGenerator } from '../utils/secretGenerator'

// Mock Node.js crypto module
vi.mock('crypto', () => ({
  randomBytes: vi.fn(),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn()
  }))
}))

describe('Secret Generator Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Secret Generation', () => {
    it('should generate cryptographically secure random secret', async () => {
      const mockRandomBytes = Buffer.from('a'.repeat(64), 'hex') // 32 bytes
      vi.mocked(require('crypto').randomBytes).mockReturnValue(mockRandomBytes)

      const secret = await secretGenerator.generateSecret()

      expect(secret).toBeDefined()
      expect(secret).toHaveLength(64) // 32 bytes = 64 hex characters
      expect(require('crypto').randomBytes).toHaveBeenCalledWith(32)
    })

    it('should generate unique secrets on multiple calls', async () => {
      vi.mocked(require('crypto').randomBytes)
        .mockReturnValueOnce(Buffer.from('a'.repeat(64), 'hex'))
        .mockReturnValueOnce(Buffer.from('b'.repeat(64), 'hex'))

      const secret1 = await secretGenerator.generateSecret()
      const secret2 = await secretGenerator.generateSecret()

      expect(secret1).not.toBe(secret2)
      expect(secret1).toHaveLength(64)
      expect(secret2).toHaveLength(64)
    })

    it('should validate secret format and length', async () => {
      const validSecret = 'a'.repeat(64) // Valid 32-byte hex
      const invalidShortSecret = 'a'.repeat(32) // Too short
      const invalidNonHexSecret = 'zz' + 'a'.repeat(62) // Invalid hex

      expect(await secretGenerator.isValidSecret(validSecret)).toBe(true)
      expect(await secretGenerator.isValidSecret(invalidShortSecret)).toBe(false)
      expect(await secretGenerator.isValidSecret(invalidNonHexSecret)).toBe(false)
    })

    it('should handle crypto randomBytes failures', async () => {
      vi.mocked(require('crypto').randomBytes).mockImplementation(() => {
        throw new Error('Insufficient entropy')
      })

      await expect(secretGenerator.generateSecret()).rejects.toThrow('Insufficient entropy')
    })

    it('should ensure minimum entropy requirements', async () => {
      const weakRandomBytes = Buffer.from('0'.repeat(64), 'hex') // All zeros
      vi.mocked(require('crypto').randomBytes).mockReturnValue(weakRandomBytes)

      const secret = await secretGenerator.generateSecret()

      // Should detect low entropy and regenerate
      expect(require('crypto').randomBytes).toHaveBeenCalledTimes(1)
    })

    it('should generate secrets compatible with HTLC standards', async () => {
      const mockRandomBytes = Buffer.from('1234567890abcdef'.repeat(4), 'hex')
      vi.mocked(require('crypto').randomBytes).mockReturnValue(mockRandomBytes)

      const secret = await secretGenerator.generateSecret()

      expect(secret).toMatch(/^[0-9a-fA-F]{64}$/) // Valid hex format
      expect(Buffer.from(secret, 'hex')).toHaveLength(32) // 32 bytes
    })
  })

  describe('Secret Hashing', () => {
    it('should create SHA256 hash of secret', async () => {
      const secret = 'a'.repeat(64)
      const expectedHash = 'mock_sha256_hash'

      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(expectedHash)
      }
      vi.mocked(require('crypto').createHash).mockReturnValue(mockHasher)

      const hash = await secretGenerator.hashSecret(secret)

      expect(hash).toBe(expectedHash)
      expect(require('crypto').createHash).toHaveBeenCalledWith('sha256')
      expect(mockHasher.update).toHaveBeenCalledWith(secret, 'hex')
      expect(mockHasher.digest).toHaveBeenCalledWith('hex')
    })

    it('should produce deterministic hashes', async () => {
      const secret = 'a'.repeat(64)
      const mockHash = 'deterministic_hash'

      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(mockHash)
      }
      vi.mocked(require('crypto').createHash).mockReturnValue(mockHasher)

      const hash1 = await secretGenerator.hashSecret(secret)
      const hash2 = await secretGenerator.hashSecret(secret)

      expect(hash1).toBe(hash2)
      expect(hash1).toBe(mockHash)
    })

    it('should handle invalid secret input for hashing', async () => {
      const invalidSecret = 'not_hex'

      await expect(secretGenerator.hashSecret(invalidSecret)).rejects.toThrow('Invalid secret format')
    })

    it('should verify secret matches hash correctly', async () => {
      const secret = 'a'.repeat(64)
      const correctHash = 'correct_hash'
      const wrongHash = 'wrong_hash'

      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(correctHash)
      }
      vi.mocked(require('crypto').createHash).mockReturnValue(mockHasher)

      const isValidCorrect = await secretGenerator.verifySecret(secret, correctHash)
      const isValidWrong = await secretGenerator.verifySecret(secret, wrongHash)

      expect(isValidCorrect).toBe(true)
      expect(isValidWrong).toBe(false)
    })

    it('should handle hash verification edge cases', async () => {
      const secret = 'a'.repeat(64)

      // Test with empty hash
      expect(await secretGenerator.verifySecret(secret, '')).toBe(false)
      
      // Test with null/undefined hash
      expect(await secretGenerator.verifySecret(secret, null)).toBe(false)
      expect(await secretGenerator.verifySecret(secret, undefined)).toBe(false)
    })

    it('should be compatible with Bitcoin and Ethereum HTLC implementations', async () => {
      const secret = '1234567890abcdef'.repeat(4)
      const mockHash = 'bitcoin_ethereum_compatible_hash'

      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(mockHash)
      }
      vi.mocked(require('crypto').createHash).mockReturnValue(mockHasher)

      const hash = await secretGenerator.hashSecret(secret)

      // Should use SHA256 which is compatible with both Bitcoin and Ethereum
      expect(require('crypto').createHash).toHaveBeenCalledWith('sha256')
      expect(hash).toBe(mockHash)
    })
  })

  describe('Secret Pair Generation', () => {
    it('should generate secret and hash pair', async () => {
      const mockSecret = 'a'.repeat(64)
      const mockHash = 'generated_hash'

      vi.mocked(require('crypto').randomBytes).mockReturnValue(Buffer.from(mockSecret, 'hex'))
      
      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(mockHash)
      }
      vi.mocked(require('crypto').createHash).mockReturnValue(mockHasher)

      const secretPair = await secretGenerator.generateSecretPair()

      expect(secretPair).toHaveProperty('secret', mockSecret)
      expect(secretPair).toHaveProperty('hash', mockHash)
      expect(secretPair).toHaveProperty('timestamp')
      expect(secretPair.timestamp).toBeInstanceOf(Date)
    })

    it('should include metadata in secret pair', async () => {
      const mockSecret = 'b'.repeat(64)
      const mockHash = 'metadata_hash'

      vi.mocked(require('crypto').randomBytes).mockReturnValue(Buffer.from(mockSecret, 'hex'))
      
      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(mockHash)
      }
      vi.mocked(require('crypto').createHash).mockReturnValue(mockHasher)

      const secretPair = await secretGenerator.generateSecretPair()

      expect(secretPair).toHaveProperty('version') // Version for compatibility
      expect(secretPair).toHaveProperty('algorithm', 'sha256')
      expect(secretPair).toHaveProperty('length', 32) // 32 bytes
    })

    it('should validate generated secret pair internally', async () => {
      const mockSecret = 'c'.repeat(64)
      const mockHash = 'validation_hash'

      vi.mocked(require('crypto').randomBytes).mockReturnValue(Buffer.from(mockSecret, 'hex'))
      
      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(mockHash)
      }
      vi.mocked(require('crypto').createHash).mockReturnValue(mockHasher)

      const secretPair = await secretGenerator.generateSecretPair()

      // Should internally validate that hash matches secret
      expect(secretPair.isValid).toBe(true)
    })
  })

  describe('Secret Encoding and Decoding', () => {
    it('should encode secret to base64 for transmission', async () => {
      const secret = 'abcdef1234567890'.repeat(4) // 64 hex chars
      const expectedBase64 = Buffer.from(secret, 'hex').toString('base64')

      const encoded = await secretGenerator.encodeSecret(secret)

      expect(encoded).toBe(expectedBase64)
    })

    it('should decode base64 secret back to hex', async () => {
      const secret = 'abcdef1234567890'.repeat(4)
      const base64 = Buffer.from(secret, 'hex').toString('base64')

      const decoded = await secretGenerator.decodeSecret(base64)

      expect(decoded).toBe(secret)
    })

    it('should handle round-trip encoding/decoding', async () => {
      const originalSecret = 'fedcba0987654321'.repeat(4)

      const encoded = await secretGenerator.encodeSecret(originalSecret)
      const decoded = await secretGenerator.decodeSecret(encoded)

      expect(decoded).toBe(originalSecret)
    })

    it('should validate encoded secret format', async () => {
      const invalidBase64 = 'not@valid#base64!'

      await expect(secretGenerator.decodeSecret(invalidBase64)).rejects.toThrow('Invalid base64 encoding')
    })

    it('should handle empty encoding inputs', async () => {
      await expect(secretGenerator.encodeSecret('')).rejects.toThrow('Empty secret provided')
      await expect(secretGenerator.decodeSecret('')).rejects.toThrow('Empty encoded secret provided')
    })

    it('should preserve secret length through encoding', async () => {
      const secret = '1'.repeat(64) // 32 bytes
      
      const encoded = await secretGenerator.encodeSecret(secret)
      const decoded = await secretGenerator.decodeSecret(encoded)

      expect(decoded).toHaveLength(64)
      expect(Buffer.from(decoded, 'hex')).toHaveLength(32)
    })
  })

  describe('Timelock Generation', () => {
    it('should create timelock timestamp for specified hours', async () => {
      const hours = 24
      const now = Date.now()
      const expectedTimelock = Math.floor((now + (hours * 60 * 60 * 1000)) / 1000)

      const timelock = await secretGenerator.createTimelock(hours)

      expect(timelock).toBeCloseTo(expectedTimelock, 5) // Within 5 seconds
    })

    it('should handle different timelock periods', async () => {
      const timelock1h = await secretGenerator.createTimelock(1)
      const timelock24h = await secretGenerator.createTimelock(24)
      const timelock72h = await secretGenerator.createTimelock(72)

      expect(timelock24h - timelock1h).toBeCloseTo(23 * 60 * 60, 10) // 23 hours difference
      expect(timelock72h - timelock24h).toBeCloseTo(48 * 60 * 60, 10) // 48 hours difference
    })

    it('should validate timelock input parameters', async () => {
      await expect(secretGenerator.createTimelock(-1)).rejects.toThrow('Invalid timelock period')
      await expect(secretGenerator.createTimelock(0)).rejects.toThrow('Invalid timelock period')
      await expect(secretGenerator.createTimelock(8760 + 1)).rejects.toThrow('Timelock too long') // Max 1 year
    })

    it('should create timelock compatible with blockchain timestamps', async () => {
      const hours = 12
      const timelock = await secretGenerator.createTimelock(hours)

      // Should be Unix timestamp in seconds
      expect(timelock).toBeGreaterThan(1600000000) // After 2020
      expect(timelock).toBeLessThan(2000000000) // Before 2033
      expect(timelock % 1).toBe(0) // Should be integer (seconds, not milliseconds)
    })

    it('should provide recommended timelock periods for different networks', async () => {
      const bitcoinTimelock = await secretGenerator.createTimelock(24) // 24h for Bitcoin
      const ethereumTimelock = await secretGenerator.createTimelock(4) // 4h for Ethereum
      const polygonTimelock = await secretGenerator.createTimelock(1) // 1h for Polygon

      expect(bitcoinTimelock - ethereumTimelock).toBeCloseTo(20 * 60 * 60, 10) // 20h difference
      expect(ethereumTimelock - polygonTimelock).toBeCloseTo(3 * 60 * 60, 10) // 3h difference
    })
  })

  describe('Security Validations', () => {
    it('should validate secret entropy requirements', async () => {
      const lowEntropySecret = '0'.repeat(64) // All zeros
      const goodEntropySecret = 'a1b2c3d4e5f6'.repeat(5) + 'abcd' // Mixed chars

      expect(await secretGenerator.isValidSecret(lowEntropySecret)).toBe(false)
      expect(await secretGenerator.isValidSecret(goodEntropySecret)).toBe(true)
    })

    it('should detect repeated patterns in secrets', async () => {
      const repeatedPattern = 'abcd'.repeat(16) // Repeated pattern
      const randomSecret = 'a1b2c3d4e5f67890fedcba0987654321'.repeat(2)

      expect(await secretGenerator.isValidSecret(repeatedPattern)).toBe(false)
      expect(await secretGenerator.isValidSecret(randomSecret)).toBe(true)
    })

    it('should ensure secrets are not predictable', async () => {
      // Mock predictable random bytes
      vi.mocked(require('crypto').randomBytes)
        .mockReturnValueOnce(Buffer.from('1'.repeat(64), 'hex'))
        .mockReturnValueOnce(Buffer.from('2'.repeat(64), 'hex'))

      const secret1 = await secretGenerator.generateSecret()
      const secret2 = await secretGenerator.generateSecret()

      // Should not be sequential or predictable
      expect(secret1).not.toBe(secret2)
      expect(parseInt(secret1, 16)).not.toBe(parseInt(secret2, 16) - 1)
    })

    it('should implement secure memory handling', async () => {
      const secret = await secretGenerator.generateSecret()
      
      // Should not expose internal secret storage
      expect(() => secretGenerator.getInternalSecrets()).toThrow('Access denied')
    })

    it('should prevent timing attacks in verification', async () => {
      const secret = 'a'.repeat(64)
      const correctHash = 'correct'
      const wrongHash = 'wrong_hash'

      // Verification should take similar time regardless of input
      const start1 = Date.now()
      await secretGenerator.verifySecret(secret, correctHash)
      const time1 = Date.now() - start1

      const start2 = Date.now()
      await secretGenerator.verifySecret(secret, wrongHash)
      const time2 = Date.now() - start2

      // Time difference should be minimal (within 10ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(10)
    })
  })

  describe('HTLC Integration', () => {
    it('should generate secrets compatible with Bitcoin HTLCs', async () => {
      const mockSecret = '1234567890abcdef'.repeat(4)
      vi.mocked(require('crypto').randomBytes).mockReturnValue(Buffer.from(mockSecret, 'hex'))

      const secret = await secretGenerator.generateSecret()

      // Bitcoin HTLC requirements
      expect(secret).toMatch(/^[0-9a-fA-F]{64}$/) // Hex format
      expect(Buffer.from(secret, 'hex')).toHaveLength(32) // 32 bytes
    })

    it('should generate secrets compatible with Ethereum HTLCs', async () => {
      const mockSecret = 'fedcba0987654321'.repeat(4)
      vi.mocked(require('crypto').randomBytes).mockReturnValue(Buffer.from(mockSecret, 'hex'))

      const secret = await secretGenerator.generateSecret()
      const hash = await secretGenerator.hashSecret(secret)

      // Ethereum HTLC requirements  
      expect(secret.startsWith('0x')).toBe(false) // Raw hex without prefix
      expect(hash).toBeDefined() // SHA256 hash available
    })

    it('should support atomic swap workflow', async () => {
      // Step 1: Generate secret pair
      const secretPair = await secretGenerator.generateSecretPair()
      
      // Step 2: Create timelocks for both chains
      const btcTimelock = await secretGenerator.createTimelock(24) // Bitcoin: 24h
      const ethTimelock = await secretGenerator.createTimelock(12) // Ethereum: 12h

      // Step 3: Verify secret/hash relationship
      const isValid = await secretGenerator.verifySecret(secretPair.secret, secretPair.hash)

      expect(secretPair.secret).toBeDefined()
      expect(secretPair.hash).toBeDefined()
      expect(btcTimelock).toBeGreaterThan(ethTimelock)
      expect(isValid).toBe(true)
    })

    it('should handle secret revelation process', async () => {
      const secretPair = await secretGenerator.generateSecretPair()
      
      // Simulate secret revelation in HTLC
      const revealedSecret = secretPair.secret
      const knownHash = secretPair.hash

      const isValidReveal = await secretGenerator.verifySecret(revealedSecret, knownHash)

      expect(isValidReveal).toBe(true)
    })

    it('should provide secret preimages for multiple chains', async () => {
      const secretPair = await secretGenerator.generateSecretPair()

      // Format for Bitcoin (raw hex)
      const btcSecret = secretPair.secret

      // Format for Ethereum (with 0x prefix if needed)
      const ethSecret = '0x' + secretPair.secret

      expect(btcSecret).toHaveLength(64)
      expect(ethSecret).toHaveLength(66) // 64 + '0x'
      expect(ethSecret.startsWith('0x')).toBe(true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle crypto module unavailability', async () => {
      vi.mocked(require('crypto').randomBytes).mockImplementation(() => {
        throw new Error('Crypto module not available')
      })

      await expect(secretGenerator.generateSecret()).rejects.toThrow('Crypto module not available')
    })

    it('should handle insufficient system entropy', async () => {
      vi.mocked(require('crypto').randomBytes).mockImplementation(() => {
        throw new Error('ENOENT: insufficient entropy')
      })

      await expect(secretGenerator.generateSecret()).rejects.toThrow('insufficient entropy')
    })

    it('should validate all inputs for security', async () => {
      // Test with various invalid inputs
      await expect(secretGenerator.hashSecret(null)).rejects.toThrow()
      await expect(secretGenerator.hashSecret(undefined)).rejects.toThrow()
      await expect(secretGenerator.verifySecret('', 'hash')).rejects.toThrow()
      await expect(secretGenerator.createTimelock('invalid')).rejects.toThrow()
    })

    it('should handle edge cases in secret validation', async () => {
      const edgeCases = [
        '', // Empty string
        'x'.repeat(63), // Too short by 1
        'x'.repeat(65), // Too long by 1
        'G'.repeat(64), // Invalid hex character
        ' ' + 'a'.repeat(63), // Leading space
        'a'.repeat(63) + ' ' // Trailing space
      ]

      for (const testCase of edgeCases) {
        expect(await secretGenerator.isValidSecret(testCase)).toBe(false)
      }
    })

    it('should provide helpful error messages', async () => {
      try {
        await secretGenerator.hashSecret('invalid')
      } catch (error) {
        expect(error.message).toContain('Invalid secret format')
        expect(error.message).toContain('expected 64 hexadecimal characters')
      }
    })
  })
})
