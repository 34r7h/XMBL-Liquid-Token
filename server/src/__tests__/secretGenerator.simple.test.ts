import { describe, it, expect } from 'vitest'
import { secretGenerator, SecretGenerator } from '../utils/secretGenerator'

describe('Secret Generator Utility', () => {
  describe('Secret Generation', () => {
    it('should generate cryptographically secure random secret', () => {
      const secret = secretGenerator.generateSecret()

      expect(secret).toBeDefined()
      expect(secret).toHaveLength(64) // 32 bytes = 64 hex characters
      expect(/^[a-fA-F0-9]+$/.test(secret)).toBe(true)
    })

    it('should generate unique secrets on multiple calls', () => {
      const secret1 = secretGenerator.generateSecret()
      const secret2 = secretGenerator.generateSecret()

      expect(secret1).not.toBe(secret2)
      expect(secret1).toHaveLength(64)
      expect(secret2).toHaveLength(64)
    })

    it('should validate secret format and length', () => {
      const validSecret = 'a'.repeat(64) // Valid 32-byte hex
      const invalidShortSecret = 'a'.repeat(32) // Too short
      const invalidNonHexSecret = 'zz' + 'a'.repeat(62) // Invalid hex

      expect(secretGenerator.isValidSecret(validSecret)).toBe(true)
      expect(secretGenerator.isValidSecret(invalidShortSecret)).toBe(false)
      expect(secretGenerator.isValidSecret(invalidNonHexSecret)).toBe(false)
      expect(secretGenerator.isValidSecret('')).toBe(false)
    })
  })

  describe('Secret Hashing', () => {
    it('should create SHA256 hash of secret', () => {
      const secret = 'a'.repeat(64)
      const hash = secretGenerator.hashSecret(secret)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64) // SHA256 = 64 hex characters
      expect(/^[a-fA-F0-9]+$/.test(hash)).toBe(true)
    })

    it('should create consistent hashes for same secret', () => {
      const secret = 'a'.repeat(64)
      const hash1 = secretGenerator.hashSecret(secret)
      const hash2 = secretGenerator.hashSecret(secret)

      expect(hash1).toBe(hash2)
    })

    it('should create different hashes for different secrets', () => {
      const secret1 = 'a'.repeat(64)
      const secret2 = 'b'.repeat(64)
      const hash1 = secretGenerator.hashSecret(secret1)
      const hash2 = secretGenerator.hashSecret(secret2)

      expect(hash1).not.toBe(hash2)
    })

    it('should throw error for invalid secret format', () => {
      const invalidSecret = 'invalid'

      expect(() => secretGenerator.hashSecret(invalidSecret)).toThrow('Invalid secret format')
    })
  })

  describe('Secret Verification', () => {
    it('should verify valid secret-hash pairs', () => {
      const secret = secretGenerator.generateSecret()
      const hash = secretGenerator.hashSecret(secret)

      expect(secretGenerator.verifySecret(secret, hash)).toBe(true)
    })

    it('should reject invalid secret-hash pairs', () => {
      const secret1 = 'a'.repeat(64)
      const secret2 = 'b'.repeat(64)
      const hash1 = secretGenerator.hashSecret(secret1)

      expect(secretGenerator.verifySecret(secret2, hash1)).toBe(false)
    })

    it('should handle invalid secret format gracefully', () => {
      const invalidSecret = 'invalid'
      const validHash = 'a'.repeat(64)

      expect(secretGenerator.verifySecret(invalidSecret, validHash)).toBe(false)
    })
  })

  describe('Secret Pair Generation', () => {
    it('should generate valid secret-hash pairs', () => {
      const pair = secretGenerator.generateSecretPair()

      expect(pair).toHaveProperty('secret')
      expect(pair).toHaveProperty('hash')
      expect(secretGenerator.isValidSecret(pair.secret)).toBe(true)
      expect(secretGenerator.verifySecret(pair.secret, pair.hash)).toBe(true)
    })

    it('should generate unique pairs on multiple calls', () => {
      const pair1 = secretGenerator.generateSecretPair()
      const pair2 = secretGenerator.generateSecretPair()

      expect(pair1.secret).not.toBe(pair2.secret)
      expect(pair1.hash).not.toBe(pair2.hash)
    })
  })

  describe('Secret Encoding/Decoding', () => {
    it('should encode secret to base64', () => {
      const secret = 'a'.repeat(64)
      const encoded = secretGenerator.encodeSecret(secret)

      expect(encoded).toBeDefined()
      expect(typeof encoded).toBe('string')
      expect(encoded).not.toBe(secret)
    })

    it('should decode base64 secret', () => {
      const secret = 'a'.repeat(64)
      const encoded = secretGenerator.encodeSecret(secret)
      const decoded = secretGenerator.decodeSecret(encoded)

      expect(decoded).toBe(secret)
    })

    it('should throw error for invalid secret format in encoding', () => {
      const invalidSecret = 'invalid'

      expect(() => secretGenerator.encodeSecret(invalidSecret)).toThrow('Invalid secret format')
    })

    it('should throw error for invalid base64 in decoding', () => {
      const invalidBase64 = 'invalid-base64!'

      expect(() => secretGenerator.decodeSecret(invalidBase64)).toThrow('Failed to decode secret')
    })
  })

  describe('Timelock Management', () => {
    it('should create timelock timestamp', () => {
      const hours = 24
      const timelock = secretGenerator.createTimelock(hours)
      const now = Math.floor(Date.now() / 1000)

      expect(timelock).toBeGreaterThan(now)
      expect(timelock).toBeLessThanOrEqual(now + (hours * 60 * 60) + 1) // Allow 1 second tolerance
    })

    it('should throw error for invalid timelock hours', () => {
      expect(() => secretGenerator.createTimelock(0)).toThrow('Timelock hours must be positive')
      expect(() => secretGenerator.createTimelock(-1)).toThrow('Timelock hours must be positive')
    })

    it('should check if timelock has expired', () => {
      const pastTimelock = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      const futureTimelock = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now

      expect(secretGenerator.isTimelockExpired(pastTimelock)).toBe(true)
      expect(secretGenerator.isTimelockExpired(futureTimelock)).toBe(false)
    })

    it('should calculate remaining timelock time', () => {
      const futureTimelock = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const pastTimelock = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago

      const remainingFuture = secretGenerator.getTimelockRemaining(futureTimelock)
      const remainingPast = secretGenerator.getTimelockRemaining(pastTimelock)

      expect(remainingFuture).toBeGreaterThan(3500) // Should be close to 3600
      expect(remainingFuture).toBeLessThanOrEqual(3600)
      expect(remainingPast).toBe(0)
    })
  })

  describe('Class Instantiation', () => {
    it('should create new SecretGenerator instance', () => {
      const generator = new SecretGenerator()

      expect(generator).toBeInstanceOf(SecretGenerator)
      expect(generator.generateSecret).toBeDefined()
      expect(generator.hashSecret).toBeDefined()
      expect(generator.verifySecret).toBeDefined()
    })

    it('should have consistent behavior across instances', () => {
      const generator1 = new SecretGenerator()
      const generator2 = new SecretGenerator()
      const secret = 'a'.repeat(64)

      const hash1 = generator1.hashSecret(secret)
      const hash2 = generator2.hashSecret(secret)

      expect(hash1).toBe(hash2)
    })
  })

  describe('Error Handling', () => {
    it('should handle all error scenarios gracefully', () => {
      // Invalid secret length
      expect(() => secretGenerator.hashSecret('short')).toThrow()

      // Invalid secret format (non-hex)
      expect(() => secretGenerator.hashSecret('g'.repeat(64))).toThrow()

      // Invalid encoding input
      expect(() => secretGenerator.encodeSecret('invalid')).toThrow()

      // Invalid timelock
      expect(() => secretGenerator.createTimelock(-5)).toThrow()
    })
  })
})
