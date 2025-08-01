/**
 * secretGenerator.ts
 * 
 * PURPOSE:
 * Generates and manages cryptographic secrets for HTLC-based atomic swaps,
 * providing secure random secrets and hash functions for cross-chain operations.
 * 
 * EXPECTED FUNCTIONS:
 * - generateSecret(): string - Generate cryptographically secure random secret
 * - hashSecret(secret: string): string - Create SHA256 hash of secret
 * - verifySecret(secret: string, hash: string): boolean - Verify secret matches hash
 * - generateSecretPair(): SecretPair - Generate secret and hash pair
 * - encodeSecret(secret: string): string - Base64 encode secret for transmission
 * - decodeSecret(encodedSecret: string): string - Decode base64 secret
 * - isValidSecret(secret: string): boolean - Validate secret format and length
 * - createTimelock(hours: number): number - Generate timelock timestamp
 * 
 * SECRET SPECIFICATIONS:
 * - Length: 32 bytes (256 bits) for security
 * - Format: Hexadecimal string representation
 * - Entropy: Cryptographically secure random source
 * - Hash: SHA256 for HTLC compatibility
 * 
 * REQUIREMENTS:
 * - Must use cryptographically secure random number generation
 * - Must generate unique secrets for each HTLC
 * - Must provide deterministic hashing
 * - Must validate secret formats
 * - Must be compatible with Bitcoin and Ethereum HTLC implementations
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - bitcoinService.ts - Uses secrets for Bitcoin HTLC creation
 * - EthereumHTLC.sol - Uses secret hashes for Ethereum HTLC
 * - XMBLVault.sol - May use for cross-chain swap verification
 * - blockchainMonitor.ts - Monitors secret revelation events
 * 
 * HTLC FLOW:
 * 1. Generate secret for new cross-chain swap
 * 2. Create hash of secret for HTLC creation
 * 3. Lock funds on both chains using secret hash
 * 4. Reveal secret to claim funds on first chain
 * 5. Secret automatically reveals on second chain for completion
 * 
 * SECURITY CONSIDERATIONS:
 * - Secrets must be cryptographically random
 * - Secrets should not be logged or stored persistently
 * - Hash functions must be deterministic and collision-resistant
 * - Timelock periods must be sufficient for cross-chain operations
 * 
 * CRYPTO LIBRARIES:
 * - Node.js crypto module for secure random generation
 * - SHA256 hashing for HTLC compatibility
 * - Base64 encoding for network transmission
 * 
 * ERROR HANDLING:
 * - Invalid secret length
 * - Hash mismatch verification
 * - Encoding/decoding failures
 * - Insufficient entropy sources
 */

import { createHash, randomBytes } from 'crypto';

export interface SecretPair {
  secret: string;
  hash: string;
}

export class SecretGenerator {
  private readonly SECRET_LENGTH = 32; // 32 bytes = 256 bits

  /**
   * Generate a cryptographically secure random secret
   */
  generateSecret(): string {
    const secret = randomBytes(this.SECRET_LENGTH);
    return secret.toString('hex');
  }

  /**
   * Create SHA256 hash of secret for HTLC
   */
  hashSecret(secret: string): string {
    if (!this.isValidSecret(secret)) {
      throw new Error('Invalid secret format');
    }
    
    const hash = createHash('sha256');
    hash.update(Buffer.from(secret, 'hex'));
    return hash.digest('hex');
  }

  /**
   * Verify that a secret matches its hash
   */
  verifySecret(secret: string, hash: string): boolean {
    try {
      const computedHash = this.hashSecret(secret);
      return computedHash === hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate secret and hash pair for HTLC
   */
  generateSecretPair(): SecretPair {
    const secret = this.generateSecret();
    const hash = this.hashSecret(secret);
    return { secret, hash };
  }

  /**
   * Base64 encode secret for transmission
   */
  encodeSecret(secret: string): string {
    if (!this.isValidSecret(secret)) {
      throw new Error('Invalid secret format');
    }
    
    const buffer = Buffer.from(secret, 'hex');
    return buffer.toString('base64');
  }

  /**
   * Decode base64 secret
   */
  decodeSecret(encodedSecret: string): string {
    try {
      const buffer = Buffer.from(encodedSecret, 'base64');
      const secret = buffer.toString('hex');
      
      if (!this.isValidSecret(secret)) {
        throw new Error('Decoded secret is invalid');
      }
      
      return secret;
    } catch (error) {
      throw new Error('Failed to decode secret');
    }
  }

  /**
   * Validate secret format and length
   */
  isValidSecret(secret: string): boolean {
    // Check if it's a valid hex string of correct length
    const hexPattern = /^[a-fA-F0-9]+$/;
    return (
      typeof secret === 'string' &&
      secret.length === this.SECRET_LENGTH * 2 && // hex string is 2x length
      hexPattern.test(secret)
    );
  }

  /**
   * Create timelock timestamp (current time + hours)
   */
  createTimelock(hours: number): number {
    if (hours <= 0) {
      throw new Error('Timelock hours must be positive');
    }
    
    const now = Math.floor(Date.now() / 1000); // Unix timestamp
    const hoursInSeconds = hours * 60 * 60;
    return now + hoursInSeconds;
  }

  /**
   * Check if timelock has expired
   */
  isTimelockExpired(timelock: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= timelock;
  }

  /**
   * Get remaining time until timelock expires
   */
  getTimelockRemaining(timelock: number): number {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, timelock - now);
  }
}

// Export singleton instance
export const secretGenerator = new SecretGenerator();
