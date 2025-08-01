import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock all external dependencies with vi.mock at the top level
vi.mock('ethers', () => ({
  ethers: {
    Contract: vi.fn().mockImplementation(() => ({
      supply: vi.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: vi.fn() }),
      withdraw: vi.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: vi.fn() }),
      claimRewards: vi.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: vi.fn() }),
      paused: vi.fn().mockResolvedValue(false)
    })),
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      getFeeData: vi.fn().mockResolvedValue({ gasPrice: 20000000000n })
    })),
    parseEther: vi.fn().mockImplementation((amount) => `${amount}000000000000000000`),
    formatEther: vi.fn().mockImplementation((wei) => (parseFloat(wei) / 1e18).toString()),
    parseUnits: vi.fn().mockImplementation((value, units) => BigInt(value) * BigInt(10 ** 18))
  }
}))

vi.mock('../../utils/database', () => ({
  database: {
    query: vi.fn(),
    insert: vi.fn().mockResolvedValue({ id: 123 }),
    update: vi.fn().mockResolvedValue(1),
    delete: vi.fn().mockResolvedValue(1)
  }
}))

vi.mock('../../api/controllers', () => ({
  priceService: {
    getBTCPrice: vi.fn().mockResolvedValue(50000),
    getYieldRates: vi.fn().mockResolvedValue({
      compound: { apy: 8.5, capacity: 100, risk: 'low' },
      aave: { apy: 7.8, capacity: 200, risk: 'low' },
      yearn: { apy: 12.2, capacity: 50, risk: 'medium' }
    })
  }
}))

import { yieldManagementService } from '../../services/yieldManagementService'
import { database } from '../../utils/database'
import { priceService } from '../../api/controllers'

describe('Yield Management Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Core Protocol Operations', () => {
    it('should deploy BTC to yield protocol', async () => {
      const result = await yieldManagementService.deployToYieldProtocol(0.5, 'compound')
      expect(result).toBe('0xmocktxhash123')
      expect(database.insert).toHaveBeenCalledWith('yield_positions', expect.any(Object))
    })

    it('should validate deployment parameters', async () => {
      await expect(yieldManagementService.deployToYieldProtocol(-1, 'compound'))
        .rejects.toThrow('Invalid BTC amount')
      
      await expect(yieldManagementService.deployToYieldProtocol(0.5, 'invalid'))
        .rejects.toThrow('Unsupported protocol')
    })

    it('should harvest yield from active positions', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([
        { id: 1, protocol: 'compound', amount: 0.5, yield_earned: 0.01, deployment_time: new Date() }
      ])

      const result = await yieldManagementService.harvestYield()
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
    })

    it('should withdraw from protocol', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([
        { id: 1, protocol: 'compound', amount: 1.0, apy: 8.5, deployment_time: new Date() }
      ])

      const result = await yieldManagementService.withdrawFromProtocol('compound', 0.5)
      expect(result).toBe('0xmocktxhash456')
      expect(database.update).toHaveBeenCalled()
    })

    it('should validate withdrawal amount', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([
        { id: 1, protocol: 'compound', amount: 0.1, apy: 8.5 }
      ])

      await expect(yieldManagementService.withdrawFromProtocol('compound', 1.0))
        .rejects.toThrow('Insufficient balance in protocol')
    })
  })

  describe('Position Management', () => {
    it('should get active positions', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, apy: 8.5, deployment_time: new Date(), status: 'active' }
      ]
      vi.mocked(database.query).mockResolvedValueOnce(mockPositions)

      const positions = await yieldManagementService.getActivePositions()
      expect(Array.isArray(positions)).toBe(true)
      expect(positions[0]).toHaveProperty('actualAPY')
      expect(positions[0]).toHaveProperty('current_apy')
    })

    it('should filter positions by protocol', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, apy: 8.5, deployment_time: new Date() }
      ]
      vi.mocked(database.query).mockResolvedValueOnce(mockPositions)

      await yieldManagementService.getActivePositions('compound')
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('protocol = ?'),
        ['active', 'compound']
      )
    })
  })

  describe('Allocation Strategy', () => {
    it('should calculate optimal allocation', async () => {
      const allocation = await yieldManagementService.calculateOptimalAllocation(10)
      
      expect(allocation).toHaveProperty('allocations')
      expect(allocation).toHaveProperty('expectedAPY')
      expect(allocation).toHaveProperty('riskScore')
      expect(Array.isArray(allocation.allocations)).toBe(true)
    })

    it('should respect risk tolerance', async () => {
      const conservative = await yieldManagementService.calculateOptimalAllocation(10, { riskTolerance: 'conservative' })
      const aggressive = await yieldManagementService.calculateOptimalAllocation(10, { riskTolerance: 'aggressive' })
      
      expect(conservative.riskScore).toBeLessThanOrEqual(aggressive.riskScore)
    })
  })

  describe('Rebalancing', () => {
    it('should rebalance positions when needed', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([
        { id: 1, protocol: 'compound', amount: 0.5, apy: 5.0, deployment_time: new Date(), status: 'active' }
      ])

      const result = await yieldManagementService.rebalancePositions()
      expect(result).toHaveProperty('rebalanced')
      expect(typeof result.rebalanced).toBe('boolean')
    })

    it('should consider gas costs', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([
        { id: 1, protocol: 'compound', amount: 0.5, apy: 5.0, deployment_time: new Date(), status: 'active' }
      ])
      
      const gasEstimate = { withdrawGas: 150000, supplyGas: 200000, gasPrice: 50000000000 }
      const result = await yieldManagementService.rebalancePositions({ gasEstimate })
      
      expect(result).toHaveProperty('rebalanced')
      expect(result).toHaveProperty('reason')
    })
  })

  describe('Advanced Features', () => {
    it('should get withdrawal quote', async () => {
      const quote = await yieldManagementService.getWithdrawalQuote('compound', 1.0)
      
      expect(quote).toHaveProperty('amount')
      expect(quote).toHaveProperty('fee')
      expect(quote).toHaveProperty('gas')
      expect(typeof quote.amount).toBe('number')
    })

    it('should perform health checks', async () => {
      const healthChecks = await yieldManagementService.performHealthChecks()
      
      expect(healthChecks).toHaveProperty('compound')
      expect(healthChecks.compound).toHaveProperty('healthy')
      expect(healthChecks.compound).toHaveProperty('apy')
      expect(healthChecks.compound).toHaveProperty('tvl')
    })

    it('should check protocol risk', async () => {
      const riskCheck = await yieldManagementService.checkProtocolRisk('compound')
      
      expect(riskCheck).toHaveProperty('riskLevel')
      expect(riskCheck).toHaveProperty('riskScore')
      expect(riskCheck).toHaveProperty('factors')
      expect(['low', 'medium', 'high']).toContain(riskCheck.riskLevel)
    })

    it('should get performance metrics', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([
        { id: 1, protocol: 'compound', amount: 0.5, apy: 8.5, yield_earned: 0.01 }
      ])

      const metrics = await yieldManagementService.getPerformanceMetrics('month')
      
      expect(metrics).toHaveProperty('totalYield')
      expect(metrics).toHaveProperty('averageAPY')
      expect(metrics).toHaveProperty('bestPerformer')
      expect(metrics).toHaveProperty('worstPerformer')
    })

    it('should compare projected vs actual yields', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([{
        id: 1,
        amount: 1.0,
        apy: 8.5,
        yield_earned: 0.08,
        deployment_time: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      }])

      const comparison = await yieldManagementService.compareProjectedVsActual(1)
      
      expect(comparison).toHaveProperty('projectedYield')
      expect(comparison).toHaveProperty('actualYield')
      expect(comparison).toHaveProperty('variance')
      expect(comparison).toHaveProperty('performance')
    })

    it('should generate yield report', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')
      
      vi.mocked(database.query).mockResolvedValueOnce([
        { protocol: 'compound', amount: 1.0, yield_earned: 0.08 },
        { protocol: 'aave', amount: 0.5, yield_earned: 0.04 }
      ])

      const report = await yieldManagementService.generateYieldReport(startDate, endDate)
      
      expect(report).toHaveProperty('totalDeployed')
      expect(report).toHaveProperty('totalYield')
      expect(report).toHaveProperty('roi')
      expect(report).toHaveProperty('protocolBreakdown')
    })

    it('should calculate CAGR', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([{
        id: 1,
        amount: 1.0,
        yield_earned: 0.1,
        deployment_time: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      }])

      const cagr = await yieldManagementService.calculateCAGR(1)
      expect(typeof cagr).toBe('number')
      expect(cagr).toBeGreaterThanOrEqual(0)
    })

    it('should get portfolio value', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([
        { protocol: 'compound', amount: 0.5, yield_earned: 0.01, status: 'active', deployment_time: new Date() }
      ])

      const portfolio = await yieldManagementService.getPortfolioValue()
      
      expect(portfolio).toHaveProperty('totalValue')
      expect(portfolio).toHaveProperty('breakdown')
      expect(typeof portfolio.totalValue).toBe('number')
    })
  })

  describe('Automation Features', () => {
    it('should start event monitoring', async () => {
      await expect(yieldManagementService.startEventMonitoring()).resolves.not.toThrow()
    })

    it('should send alerts', async () => {
      await expect(yieldManagementService.sendAlert('warning', 'Test alert')).resolves.not.toThrow()
    })

    it('should setup DCA strategy', async () => {
      const strategyId = await yieldManagementService.setupDCAStrategy(0.1, 'weekly')
      expect(typeof strategyId).toBe('string')
      expect(strategyId).toContain('dca_')
      expect(database.insert).toHaveBeenCalledWith('dca_strategies', expect.any(Object))
    })

    it('should auto compound position', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([{
        id: 1,
        protocol: 'compound',
        amount: 1.0,
        yield_earned: 0.1
      }])

      const txHash = await yieldManagementService.autoCompound(1)
      expect(txHash).toBe('0xmocktxhash123')
      expect(database.update).toHaveBeenCalled()
    })

    it('should setup stop loss', async () => {
      await expect(yieldManagementService.setupStopLoss(1, 0.1)).resolves.not.toThrow()
      expect(database.insert).toHaveBeenCalledWith('stop_loss_orders', expect.any(Object))
    })

    it('should optimize gas usage', async () => {
      const optimization = await yieldManagementService.optimizeGasUsage()
      
      expect(optimization).toHaveProperty('recommendation')
      expect(optimization).toHaveProperty('potentialSavings')
      expect(typeof optimization.recommendation).toBe('string')
      expect(typeof optimization.potentialSavings).toBe('number')
    })
  })

  describe('Service Health', () => {
    it('should check service health', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([{ result: 1 }])

      const health = await yieldManagementService.health()
      expect(health.status).toBe('healthy')
      expect(health.message).toContain('All protocols accessible')
    })

    it('should initialize service', async () => {
      await expect(yieldManagementService.initialize()).resolves.not.toThrow()
    })

    it('should start automation', async () => {
      await expect(yieldManagementService.startAutomation()).resolves.not.toThrow()
    })

    it('should stop service', async () => {
      await expect(yieldManagementService.stop()).resolves.not.toThrow()
    })
  })
})
