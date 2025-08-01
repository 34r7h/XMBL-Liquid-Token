import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { blockchainMonitor } from '../../services/blockchainMonitor'

// Mock dependencies
vi.mock('ethers', () => ({
  ethers: {
    Contract: vi.fn(),
    WebSocketProvider: vi.fn(),
    JsonRpcProvider: vi.fn(),
    parseEther: vi.fn(),
    formatEther: vi.fn()
  }
}))

vi.mock('../../utils/database', () => ({
  database: {
    query: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

describe('Blockchain Monitor Service', () => {
  let mockProvider: any
  let mockContract: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment for test mode
    process.env.NODE_ENV = 'test'
    
    mockProvider = {
      on: vi.fn(),
      off: vi.fn(),
      getBlockNumber: vi.fn().mockResolvedValue(1000),
      getNetwork: vi.fn().mockResolvedValue({ chainId: 1 }),
      removeAllListeners: vi.fn()
    }

    mockContract = {
      on: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
      filters: {
        Deposit: vi.fn(),
        SwapCompleted: vi.fn(),
        BridgeInitiated: vi.fn(),
        YieldDistributed: vi.fn()
      },
      queryFilter: vi.fn().mockResolvedValue([])
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Event Listener Initialization', () => {
    it('should start all event listeners successfully', async () => {
      await blockchainMonitor.startEventListeners()

      expect(mockProvider.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockProvider.on).toHaveBeenCalledWith('block', expect.any(Function))
      expect(mockContract.on).toHaveBeenCalledTimes(4) // 4 event types
    })

    it('should handle provider connection errors', async () => {
      mockProvider.getNetwork.mockRejectedValue(new Error('Connection failed'))

      await expect(blockchainMonitor.startEventListeners()).rejects.toThrow('Connection failed')
    })

    it('should set up automatic reconnection on network issues', async () => {
      await blockchainMonitor.startEventListeners()

      // Simulate network error
      const errorHandler = mockProvider.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]

      expect(errorHandler).toBeDefined()
      
      if (errorHandler) {
        await errorHandler(new Error('Network error'))
        // Should attempt reconnection
        expect(mockProvider.on).toHaveBeenCalledWith('error', expect.any(Function))
      }
    })

    it('should support multiple networks simultaneously', async () => {
      const networkConfigs = ['ethereum', 'polygon']
      
      await blockchainMonitor.startEventListeners(networkConfigs)

      expect(require('ethers').ethers.providers.WebSocketProvider).toHaveBeenCalledTimes(2)
      expect(require('ethers').ethers.Contract).toHaveBeenCalledTimes(2)
    })

    it('should implement rate limiting for RPC calls', async () => {
      const rateLimitConfig = { maxRequestsPerSecond: 10 }
      
      await blockchainMonitor.startEventListeners(['ethereum'], rateLimitConfig)

      // Should track and limit RPC calls
      expect(blockchainMonitor.getRateLimit()).toBeDefined()
    })

    it('should validate contract addresses and ABIs', async () => {
      const invalidConfig = { contractAddress: '0xinvalid' }

      await expect(
        blockchainMonitor.startEventListeners(['ethereum'], invalidConfig)
      ).rejects.toThrow('Invalid contract configuration')
    })
  })

  describe('Deposit Event Monitoring', () => {
    it('should register and handle deposit events', async () => {
      const depositCallback = vi.fn()
      const mockDepositEvent = {
        args: {
          user: '0xuser123...',
          amount: '1000000000000000000', // 1 ETH in wei
          timestamp: 1234567890
        },
        blockNumber: 12345,
        transactionHash: '0xtx123...'
      }

      await blockchainMonitor.onDepositEvent(depositCallback)
      await blockchainMonitor.startEventListeners()

      // Simulate deposit event
      const depositHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'Deposit'
      )?.[1]

      if (depositHandler) {
        await depositHandler(...Object.values(mockDepositEvent.args), mockDepositEvent)
      }

      expect(depositCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          user: '0xuser123...',
          amount: '1000000000000000000',
          blockNumber: 12345,
          transactionHash: '0xtx123...'
        })
      )
    })

    it('should persist deposit events to database', async () => {
      const mockDepositEvent = {
        args: { user: '0xuser123...', amount: '1000000000000000000' },
        blockNumber: 12345,
        transactionHash: '0xtx123...'
      }

      const { database } = await import('../utils/database')
      vi.mocked(database.insert).mockResolvedValue({ id: 1 })

      await blockchainMonitor.onDepositEvent(async (event) => {
        await blockchainMonitor.persistEvent('deposit', event)
      })
      
      await blockchainMonitor.startEventListeners()

      const depositHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'Deposit'
      )?.[1]

      if (depositHandler) {
        await depositHandler(...Object.values(mockDepositEvent.args), mockDepositEvent)
      }

      expect(database.insert).toHaveBeenCalledWith('blockchain_events', {
        event_type: 'deposit',
        user_address: '0xuser123...',
        amount: '1000000000000000000',
        block_number: 12345,
        transaction_hash: '0xtx123...',
        processed: false,
        created_at: expect.any(Date)
      })
    })

    it('should handle duplicate deposit events', async () => {
      const mockDepositEvent = {
        args: { user: '0xuser123...', amount: '1000000000000000000' },
        transactionHash: '0xtx123...'
      }

      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue([{ id: 1 }]) // Event already exists

      const duplicateResult = await blockchainMonitor.handleDepositEvent(mockDepositEvent)

      expect(duplicateResult.isDuplicate).toBe(true)
      expect(database.insert).not.toHaveBeenCalled()
    })

    it('should validate deposit event data', async () => {
      const invalidDepositEvent = {
        args: { user: 'invalid_address', amount: '-1' },
        blockNumber: 12345
      }

      await expect(
        blockchainMonitor.handleDepositEvent(invalidDepositEvent)
      ).rejects.toThrow('Invalid deposit event data')
    })

    it('should trigger downstream processing for deposit events', async () => {
      const mockDepositEvent = {
        args: { user: '0xuser123...', amount: '1000000000000000000' },
        transactionHash: '0xtx123...'
      }

      const triggerCallback = vi.fn()
      await blockchainMonitor.onDepositEvent(triggerCallback)

      await blockchainMonitor.handleDepositEvent(mockDepositEvent)

      expect(triggerCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deposit_received',
          shouldTriggerSwap: true,
          shouldUpdatePortfolio: true
        })
      )
    })
  })

  describe('Swap Complete Event Monitoring', () => {
    it('should handle swap completion events', async () => {
      const swapCallback = vi.fn()
      const mockSwapEvent = {
        args: {
          user: '0xuser123...',
          inputToken: '0xETH...',
          outputToken: '0xBTC...',
          inputAmount: '1000000000000000000',
          outputAmount: '2500000', // 0.025 BTC
          swapProvider: '1inch'
        },
        blockNumber: 12346,
        transactionHash: '0xswap123...'
      }

      await blockchainMonitor.onSwapCompleteEvent(swapCallback)
      await blockchainMonitor.startEventListeners()

      const swapHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'SwapComplete'
      )?.[1]

      if (swapHandler) {
        await swapHandler(...Object.values(mockSwapEvent.args), mockSwapEvent)
      }

      expect(swapCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          user: '0xuser123...',
          inputAmount: '1000000000000000000',
          outputAmount: '2500000',
          swapProvider: '1inch'
        })
      )
    })

    it('should calculate swap rates and slippage', async () => {
      const mockSwapEvent = {
        args: {
          inputAmount: '1000000000000000000', // 1 ETH
          outputAmount: '2500000', // 0.025 BTC
          expectedOutput: '2600000' // Expected 0.026 BTC
        }
      }

      const swapAnalysis = await blockchainMonitor.analyzeSwapEvent(mockSwapEvent)

      expect(swapAnalysis).toHaveProperty('actualRate')
      expect(swapAnalysis).toHaveProperty('expectedRate')
      expect(swapAnalysis).toHaveProperty('slippage')
      expect(swapAnalysis.slippage).toBeCloseTo(3.85, 2) // ~3.85% slippage
    })

    it('should detect unusual swap patterns', async () => {
      const suspiciousSwapEvent = {
        args: {
          inputAmount: '100000000000000000000', // 100 ETH (large amount)
          outputAmount: '1000000', // 0.01 BTC (very low output)
          slippage: 50 // 50% slippage
        }
      }

      const alertTriggered = await blockchainMonitor.checkSwapAlert(suspiciousSwapEvent)

      expect(alertTriggered).toBe(true)
      expect(alertTriggered.reasons).toContain('high_slippage')
      expect(alertTriggered.reasons).toContain('unusual_amount')
    })

    it('should trigger bridge initiation after successful swap', async () => {
      const mockSwapEvent = {
        args: {
          user: '0xuser123...',
          outputAmount: '2500000' // 0.025 BTC
        }
      }

      const bridgeService = { initiateBridge: vi.fn() }
      await blockchainMonitor.onSwapCompleteEvent(async (event) => {
        if (event.outputAmount > 1000000) { // > 0.01 BTC
          await bridgeService.initiateBridge(event)
        }
      })

      await blockchainMonitor.handleSwapCompleteEvent(mockSwapEvent)

      expect(bridgeService.initiateBridge).toHaveBeenCalledWith(
        expect.objectContaining({
          outputAmount: '2500000'
        })
      )
    })
  })

  describe('Bridge Event Monitoring', () => {
    it('should monitor bridge initiation events', async () => {
      const bridgeCallback = vi.fn()
      const mockBridgeEvent = {
        args: {
          user: '0xuser123...',
          btcAmount: '2500000',
          htlcHash: '0xhtlc123...',
          timelock: 1234567890 + 86400, // 24 hours from now
          bridgeProvider: 'wormhole'
        },
        blockNumber: 12347,
        transactionHash: '0xbridge123...'
      }

      await blockchainMonitor.onBridgeInitiatedEvent(bridgeCallback)
      await blockchainMonitor.startEventListeners()

      const bridgeHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'BridgeInitiated'
      )?.[1]

      if (bridgeHandler) {
        await bridgeHandler(...Object.values(mockBridgeEvent.args), mockBridgeEvent)
      }

      expect(bridgeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          user: '0xuser123...',
          btcAmount: '2500000',
          htlcHash: '0xhtlc123...',
          bridgeProvider: 'wormhole'
        })
      )
    })

    it('should track bridge completion status', async () => {
      const mockHTLCHash = '0xhtlc123...'
      
      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue([
        { id: 1, htlc_hash: mockHTLCHash, status: 'pending' }
      ])
      vi.mocked(database.update).mockResolvedValue({ affected: 1 })

      await blockchainMonitor.updateBridgeStatus(mockHTLCHash, 'completed')

      expect(database.update).toHaveBeenCalledWith(
        'bridge_transactions',
        { htlc_hash: mockHTLCHash },
        { status: 'completed', completed_at: expect.any(Date) }
      )
    })

    it('should handle bridge timeout scenarios', async () => {
      const expiredHTLC = {
        htlcHash: '0xhtlc123...',
        timelock: Date.now() - 86400000 // Expired 24 hours ago
      }

      const timeoutResult = await blockchainMonitor.checkBridgeTimeout(expiredHTLC)

      expect(timeoutResult.isExpired).toBe(true)
      expect(timeoutResult.action).toBe('refund_user')
    })

    it('should monitor cross-chain confirmations', async () => {
      const mockBridgeEvent = {
        htlcHash: '0xhtlc123...',
        targetChain: 'bitcoin'
      }

      const confirmationTracker = vi.fn()
      await blockchainMonitor.trackCrossChainConfirmations(mockBridgeEvent, confirmationTracker)

      expect(confirmationTracker).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmations: expect.any(Number),
          required: expect.any(Number),
          isConfirmed: expect.any(Boolean)
        })
      )
    })
  })

  describe('Yield Distribution Event Monitoring', () => {
    it('should handle yield distribution events', async () => {
      const yieldCallback = vi.fn()
      const mockYieldEvent = {
        args: {
          totalYield: '5000000', // 0.05 BTC
          recipients: ['0xuser1...', '0xuser2...'],
          amounts: ['2500000', '2500000'],
          distributionRound: 123
        },
        blockNumber: 12348,
        transactionHash: '0xyield123...'
      }

      await blockchainMonitor.onYieldDistributionEvent(yieldCallback)
      await blockchainMonitor.startEventListeners()

      const yieldHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'YieldDistribution'
      )?.[1]

      if (yieldHandler) {
        await yieldHandler(...Object.values(mockYieldEvent.args), mockYieldEvent)
      }

      expect(yieldCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalYield: '5000000',
          recipients: ['0xuser1...', '0xuser2...'],
          distributionRound: 123
        })
      )
    })

    it('should update user balances after yield distribution', async () => {
      const mockYieldEvent = {
        args: {
          recipients: ['0xuser1...', '0xuser2...'],
          amounts: ['2500000', '2500000']
        }
      }

      const { database } = await import('../utils/database')
      vi.mocked(database.update).mockResolvedValue({ affected: 2 })

      await blockchainMonitor.processYieldDistribution(mockYieldEvent)

      expect(database.update).toHaveBeenCalledTimes(2)
      expect(database.update).toHaveBeenCalledWith(
        'user_balances',
        { address: '0xuser1...' },
        expect.objectContaining({
          yield_earned: expect.any(String)
        })
      )
    })

    it('should calculate yield distribution accuracy', async () => {
      const mockYieldEvent = {
        totalYield: '5000000',
        recipients: ['0xuser1...', '0xuser2...'],
        amounts: ['2500000', '2500000']
      }

      const accuracy = await blockchainMonitor.validateYieldDistribution(mockYieldEvent)

      expect(accuracy.isAccurate).toBe(true)
      expect(accuracy.totalDistributed).toBe('5000000')
      expect(accuracy.discrepancy).toBe(0)
    })

    it('should detect yield distribution anomalies', async () => {
      const anomalousYieldEvent = {
        totalYield: '5000000',
        recipients: ['0xuser1...'],
        amounts: ['10000000'] // Amount exceeds total
      }

      const anomaly = await blockchainMonitor.detectYieldAnomaly(anomalousYieldEvent)

      expect(anomaly.hasAnomaly).toBe(true)
      expect(anomaly.type).toBe('amount_mismatch')
    })
  })

  describe('Block and Network Management', () => {
    it('should get latest block number', async () => {
      mockProvider.getBlockNumber.mockResolvedValue(12349)

      const blockNumber = await blockchainMonitor.getLatestBlockNumber()

      expect(blockNumber).toBe(12349)
      expect(mockProvider.getBlockNumber).toHaveBeenCalled()
    })

    it('should handle network disconnection gracefully', async () => {
      mockProvider.getBlockNumber.mockRejectedValue(new Error('Network disconnected'))

      await expect(blockchainMonitor.getLatestBlockNumber()).rejects.toThrow('Network disconnected')
      
      // Should trigger reconnection attempt
      expect(blockchainMonitor.getConnectionStatus()).toBe('reconnecting')
    })

    it('should resync events from specific block', async () => {
      const fromBlock = 12000
      const mockEvents = [
        { blockNumber: 12001, event: 'Deposit' },
        { blockNumber: 12002, event: 'SwapComplete' }
      ]

      mockContract.queryFilter.mockResolvedValue(mockEvents)

      await blockchainMonitor.resyncFromBlock(fromBlock)

      expect(mockContract.queryFilter).toHaveBeenCalledWith(
        expect.any(Object), // Event filter
        fromBlock,
        'latest'
      )
    })

    it('should batch process historical events efficiently', async () => {
      const batchSize = 1000
      const totalBlocks = 5000
      
      for (let i = 0; i < totalBlocks / batchSize; i++) {
        mockContract.queryFilter.mockResolvedValueOnce([])
      }

      await blockchainMonitor.resyncFromBlock(10000, { batchSize })

      expect(mockContract.queryFilter).toHaveBeenCalledTimes(5) // 5 batches
    })

    it('should handle resync failures and retry', async () => {
      mockContract.queryFilter
        .mockRejectedValueOnce(new Error('RPC error'))
        .mockResolvedValueOnce([])

      await blockchainMonitor.resyncFromBlock(12000, { retryAttempts: 2 })

      expect(mockContract.queryFilter).toHaveBeenCalledTimes(2)
    })

    it('should track sync progress and status', async () => {
      await blockchainMonitor.resyncFromBlock(10000)

      const syncStatus = await blockchainMonitor.getSyncStatus()

      expect(syncStatus).toHaveProperty('currentBlock')
      expect(syncStatus).toHaveProperty('targetBlock')
      expect(syncStatus).toHaveProperty('progress')
      expect(syncStatus).toHaveProperty('isSyncing')
    })
  })

  describe('Event Filtering and Batching', () => {
    it('should filter events by user address', async () => {
      const userAddress = '0xuser123...'
      const userFilter = await blockchainMonitor.createUserFilter(userAddress)

      expect(userFilter).toHaveProperty('topics')
      expect(userFilter.topics).toContain(userAddress)
    })

    it('should batch multiple events for efficient processing', async () => {
      const events = Array(100).fill(null).map((_, i) => ({
        type: 'deposit',
        blockNumber: 12000 + i,
        data: { amount: '1000000000000000000' }
      }))

      const batchProcessor = vi.fn()
      await blockchainMonitor.processBatchEvents(events, batchProcessor, { batchSize: 25 })

      expect(batchProcessor).toHaveBeenCalledTimes(4) // 100 events / 25 batch size
    })

    it('should implement event deduplication', async () => {
      const duplicateEvents = [
        { transactionHash: '0xtx123...', logIndex: 0 },
        { transactionHash: '0xtx123...', logIndex: 0 }, // Duplicate
        { transactionHash: '0xtx456...', logIndex: 0 }
      ]

      const uniqueEvents = await blockchainMonitor.deduplicateEvents(duplicateEvents)

      expect(uniqueEvents).toHaveLength(2)
    })

    it('should prioritize critical events', async () => {
      const mixedEvents = [
        { type: 'deposit', priority: 'normal' },
        { type: 'yield_distribution', priority: 'high' },
        { type: 'bridge_timeout', priority: 'critical' }
      ]

      const prioritizedEvents = await blockchainMonitor.prioritizeEvents(mixedEvents)

      expect(prioritizedEvents[0].priority).toBe('critical')
      expect(prioritizedEvents[1].priority).toBe('high')
      expect(prioritizedEvents[2].priority).toBe('normal')
    })
  })

  describe('Health Monitoring and Alerting', () => {
    it('should monitor event listener health', async () => {
      await blockchainMonitor.startEventListeners()
      
      const healthStatus = await blockchainMonitor.getHealthStatus()

      expect(healthStatus).toHaveProperty('isHealthy')
      expect(healthStatus).toHaveProperty('activeListeners')
      expect(healthStatus).toHaveProperty('lastEventTime')
      expect(healthStatus).toHaveProperty('connectionStatus')
    })

    it('should detect and alert on missed events', async () => {
      const expectedBlockGap = 100
      const actualBlockGap = 500 // Missed blocks

      const missedEventAlert = await blockchainMonitor.checkForMissedEvents(
        expectedBlockGap,
        actualBlockGap
      )

      expect(missedEventAlert.hasMissedEvents).toBe(true)
      expect(missedEventAlert.estimatedMissedEvents).toBeGreaterThan(0)
    })

    it('should implement heartbeat monitoring', async () => {
      const heartbeatInterval = 30000 // 30 seconds
      
      await blockchainMonitor.startHeartbeat(heartbeatInterval)
      
      // Wait for heartbeat
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const heartbeatStatus = await blockchainMonitor.getHeartbeatStatus()
      
      expect(heartbeatStatus.isActive).toBe(true)
      expect(heartbeatStatus.lastHeartbeat).toBeDefined()
    })

    it('should alert on high error rates', async () => {
      const errorCount = 10
      const timeWindow = 60000 // 1 minute

      for (let i = 0; i < errorCount; i++) {
        await blockchainMonitor.recordError(new Error(`Error ${i}`))
      }

      const alertTriggered = await blockchainMonitor.checkErrorRate(timeWindow)

      expect(alertTriggered).toBe(true)
    })
  })

  describe('Cleanup and Shutdown', () => {
    it('should stop all event listeners', async () => {
      await blockchainMonitor.startEventListeners()
      await blockchainMonitor.stopEventListeners()

      expect(mockProvider.removeAllListeners).toHaveBeenCalled()
      expect(mockContract.removeAllListeners).toHaveBeenCalled()
    })

    it('should handle graceful shutdown', async () => {
      await blockchainMonitor.startEventListeners()
      
      const shutdownPromise = blockchainMonitor.gracefulShutdown(5000) // 5 second timeout

      expect(shutdownPromise).resolves.toBe(true)
    })

    it('should persist pending events before shutdown', async () => {
      const pendingEvents = [
        { type: 'deposit', status: 'pending' },
        { type: 'swap', status: 'pending' }
      ]

      await blockchainMonitor.setPendingEvents(pendingEvents)
      await blockchainMonitor.gracefulShutdown()

      const { database } = await import('../utils/database')
      expect(database.insert).toHaveBeenCalledWith(
        'pending_events',
        expect.objectContaining({
          events: JSON.stringify(pendingEvents)
        })
      )
    })

    it('should restore state on restart', async () => {
      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue([
        { events: JSON.stringify([{ type: 'deposit', status: 'pending' }]) }
      ])

      await blockchainMonitor.restoreState()

      const restoredEvents = await blockchainMonitor.getPendingEvents()
      expect(restoredEvents).toHaveLength(1)
      expect(restoredEvents[0].type).toBe('deposit')
    })
  })
})
