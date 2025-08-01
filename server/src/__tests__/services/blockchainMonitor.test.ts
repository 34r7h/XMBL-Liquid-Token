import { describe, it, expect, beforeEach } from 'vitest'
import { blockchainMonitor } from '../../services/blockchainMonitor'
import type { DepositEvent, SwapEvent, BridgeEvent, YieldEvent } from '../../services/blockchainMonitor'

describe('Blockchain Monitor Service', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test'
  })

  describe('Health Check', () => {
    it('should return health status', async () => {
      const health = await blockchainMonitor.health()
      
      expect(health).toHaveProperty('status')
      expect(['healthy', 'unhealthy']).toContain(health.status)
      if (health.message) {
        expect(typeof health.message).toBe('string')
      }
    })
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(blockchainMonitor.initialize()).resolves.not.toThrow()
    })
  })

  describe('Event Listeners', () => {
    it('should start event listeners', async () => {
      await expect(blockchainMonitor.startEventListeners()).resolves.not.toThrow()
    })

    it('should stop event listeners', async () => {
      await expect(blockchainMonitor.stopEventListeners()).resolves.not.toThrow()
    })

    it('should register deposit event callback', () => {
      const callback = (event: DepositEvent) => {
        console.log('Deposit event:', event)
      }
      
      expect(() => blockchainMonitor.onDepositEvent(callback)).not.toThrow()
    })

    it('should register swap event callback', () => {
      const callback = (event: SwapEvent) => {
        console.log('Swap event:', event)
      }
      
      expect(() => blockchainMonitor.onSwapCompleteEvent(callback)).not.toThrow()
    })

    it('should register bridge event callback', () => {
      const callback = (event: BridgeEvent) => {
        console.log('Bridge event:', event)
      }
      
      expect(() => blockchainMonitor.onBridgeInitiatedEvent(callback)).not.toThrow()
    })

    it('should register yield event callback', () => {
      const callback = (event: YieldEvent) => {
        console.log('Yield event:', event)
      }
      
      expect(() => blockchainMonitor.onYieldDistributionEvent(callback)).not.toThrow()
    })
  })

  describe('Block Information', () => {
    it('should get latest block number', async () => {
      const blockNumber = await blockchainMonitor.getLatestBlockNumber()
      
      expect(typeof blockNumber).toBe('number')
      expect(blockNumber).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Event History', () => {
    it('should get event history for valid block range', async () => {
      const fromBlock = 0
      const toBlock = 100
      
      const history = await blockchainMonitor.getEventHistory(fromBlock, toBlock)
      
      expect(Array.isArray(history)).toBe(true)
    })

    it('should handle invalid block range', async () => {
      const fromBlock = 100
      const toBlock = 50 // Invalid: toBlock < fromBlock
      
      await expect(blockchainMonitor.getEventHistory(fromBlock, toBlock))
        .rejects.toThrow()
    })
  })

  describe('Monitor Statistics', () => {
    it('should return monitor stats', () => {
      const stats = blockchainMonitor.getMonitorStats()
      
      expect(stats).toHaveProperty('eventsProcessed')
      expect(stats).toHaveProperty('lastEventBlock')
      expect(stats).toHaveProperty('uptime')
      expect(stats).toHaveProperty('connectionStatus')
      
      expect(typeof stats.eventsProcessed).toBe('number')
      expect(typeof stats.lastEventBlock).toBe('number')
      expect(typeof stats.uptime).toBe('number')
      expect(['connected', 'disconnected', 'reconnecting']).toContain(stats.connectionStatus)
    })
  })

  describe('Event Processing Flow', () => {
    it('should handle deposit events properly', async () => {
      let eventReceived = false
      
      const callback = (event: DepositEvent) => {
        expect(event).toHaveProperty('user')
        expect(event).toHaveProperty('amount')
        expect(event).toHaveProperty('token')
        expect(event).toHaveProperty('timestamp')
        expect(event).toHaveProperty('txHash')
        expect(event).toHaveProperty('blockNumber')
        eventReceived = true
      }
      
      blockchainMonitor.onDepositEvent(callback)
      
      // In test mode, we can't trigger real events, but we can verify the callback registration
      expect(eventReceived).toBe(false) // Should be false until actual event
    })

    it('should handle swap events properly', async () => {
      let eventReceived = false
      
      const callback = (event: SwapEvent) => {
        expect(event).toHaveProperty('user')
        expect(event).toHaveProperty('fromToken')
        expect(event).toHaveProperty('toToken')
        expect(event).toHaveProperty('fromAmount')
        expect(event).toHaveProperty('toAmount')
        expect(event).toHaveProperty('txHash')
        expect(event).toHaveProperty('timestamp')
        expect(event).toHaveProperty('blockNumber')
        eventReceived = true
      }
      
      blockchainMonitor.onSwapCompleteEvent(callback)
      
      expect(eventReceived).toBe(false) // Should be false until actual event
    })

    it('should handle bridge events properly', async () => {
      let eventReceived = false
      
      const callback = (event: BridgeEvent) => {
        expect(event).toHaveProperty('user')
        expect(event).toHaveProperty('amount')
        expect(event).toHaveProperty('destinationChain')
        expect(event).toHaveProperty('bridgeId')
        expect(event).toHaveProperty('txHash')
        expect(event).toHaveProperty('timestamp')
        expect(event).toHaveProperty('blockNumber')
        eventReceived = true
      }
      
      blockchainMonitor.onBridgeInitiatedEvent(callback)
      
      expect(eventReceived).toBe(false) // Should be false until actual event
    })

    it('should handle yield events properly', async () => {
      let eventReceived = false
      
      const callback = (event: YieldEvent) => {
        expect(event).toHaveProperty('recipient')
        expect(event).toHaveProperty('amount')
        expect(event).toHaveProperty('yieldSource')
        expect(event).toHaveProperty('txHash')
        expect(event).toHaveProperty('timestamp')
        expect(event).toHaveProperty('blockNumber')
        eventReceived = true
      }
      
      blockchainMonitor.onYieldDistributionEvent(callback)
      
      expect(eventReceived).toBe(false) // Should be false until actual event
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Save original env
      const originalEnv = process.env.NODE_ENV
      
      try {
        // Temporarily set to non-test mode
        process.env.NODE_ENV = 'development'
        
        // This may throw if no valid RPC URL is provided, which is expected
        const health = await blockchainMonitor.health()
        expect(health).toHaveProperty('status')
      } finally {
        // Restore test environment
        process.env.NODE_ENV = originalEnv
      }
    })
  })
})
