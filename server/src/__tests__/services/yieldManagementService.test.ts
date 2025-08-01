import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { yieldManagementService } from '../../services/yieldManagementService'

// Mock dependencies
vi.mock('ethers', () => ({
  ethers: {
    Contract: vi.fn(),
    JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
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

vi.mock('../../api/controllers', () => ({
  priceService: {
    getBTCPrice: vi.fn(),
    getYieldRates: vi.fn()
  }
}))

describe('Yield Management Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Protocol Deployment', () => {
    it('should deploy BTC to yield protocol successfully', async () => {
      const mockTxHash = '0xdeployment123...'
      const btcAmount = 0.5
      const protocol = 'compound'

      // Mock successful deployment
      const mockContract = {
        supply: vi.fn().mockResolvedValue({ hash: mockTxHash, wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const result = await yieldManagementService.deployToYieldProtocol(btcAmount, protocol)

      expect(result).toBe(mockTxHash)
      expect(mockContract.supply).toHaveBeenCalledWith(
        expect.any(String), // BTC amount in wei
        expect.any(Object)   // Transaction options
      )
    })

    it('should handle deployment failures', async () => {
      const mockContract = {
        supply: vi.fn().mockRejectedValue(new Error('Deployment failed'))
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      await expect(
        yieldManagementService.deployToYieldProtocol(0.5, 'compound')
      ).rejects.toThrow('Deployment failed')
    })

    it('should validate deployment parameters', async () => {
      await expect(
        yieldManagementService.deployToYieldProtocol(-1, 'compound')
      ).rejects.toThrow('Invalid BTC amount')

      await expect(
        yieldManagementService.deployToYieldProtocol(0.5, 'invalid_protocol')
      ).rejects.toThrow('Unsupported protocol')
    })

    it('should check protocol availability before deployment', async () => {
      const mockContract = {
        paused: vi.fn().mockResolvedValue(true)
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      await expect(
        yieldManagementService.deployToYieldProtocol(0.5, 'compound')
      ).rejects.toThrow('Protocol is paused')
    })

    it('should support multiple yield protocols', async () => {
      const protocols = ['compound', 'aave', 'yearn']
      const deploymentPromises = protocols.map(protocol => {
        const mockContract = {
          supply: vi.fn().mockResolvedValue({ hash: `0x${protocol}123`, wait: vi.fn() })
        }
        vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)
        
        return yieldManagementService.deployToYieldProtocol(0.1, protocol)
      })

      const results = await Promise.all(deploymentPromises)

      expect(results).toHaveLength(3)
      results.forEach((result, index) => {
        expect(result).toContain(protocols[index])
      })
    })

    it('should track deployment in database', async () => {
      const mockTxHash = '0xdeployment123...'
      const mockContract = {
        supply: vi.fn().mockResolvedValue({ hash: mockTxHash, wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const { database } = await import('../../utils/database')
      vi.mocked(database.insert).mockResolvedValue({ id: 1 })

      await yieldManagementService.deployToYieldProtocol(0.5, 'compound')

      expect(database.insert).toHaveBeenCalledWith('yield_positions', {
        protocol: 'compound',
        amount: 0.5,
        transaction_hash: mockTxHash,
        status: 'active',
        deployment_time: expect.any(Date)
      })
    })
  })

  describe('Yield Harvesting', () => {
    it('should harvest yield from all active positions', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, yield_earned: 0.025 },
        { id: 2, protocol: 'aave', amount: 0.3, yield_earned: 0.018 }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const mockContract = {
        claimRewards: vi.fn().mockResolvedValue({ hash: '0xharvest123', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const totalYield = await yieldManagementService.harvestYield()

      expect(totalYield).toBe(0.043) // 0.025 + 0.018
      expect(mockContract.claimRewards).toHaveBeenCalledTimes(2)
    })

    it('should handle harvest failures gracefully', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, yield_earned: 0.025 }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const mockContract = {
        claimRewards: vi.fn().mockRejectedValue(new Error('Harvest failed'))
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      await expect(yieldManagementService.harvestYield()).rejects.toThrow('Harvest failed')
    })

    it('should update position records after harvest', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, yield_earned: 0.025 }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)
      vi.mocked(database.update).mockResolvedValue({ affected: 1 })

      const mockContract = {
        claimRewards: vi.fn().mockResolvedValue({ hash: '0xharvest123', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      await yieldManagementService.harvestYield()

      expect(database.update).toHaveBeenCalledWith(
        'yield_positions',
        { id: 1 },
        {
          yield_earned: 0,
          last_harvest: expect.any(Date),
          total_harvested: expect.any(Number)
        }
      )
    })

    it('should handle empty active positions', async () => {
      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue([])

      const totalYield = await yieldManagementService.harvestYield()

      expect(totalYield).toBe(0)
    })

    it('should calculate compound interest for long-term positions', async () => {
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      const mockPositions = [
        {
          id: 1,
          protocol: 'compound',
          amount: 1.0,
          apy: 8.5,
          deployment_time: oneYearAgo,
          yield_earned: 0.085
        }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const mockContract = {
        claimRewards: vi.fn().mockResolvedValue({ hash: '0xharvest123', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const totalYield = await yieldManagementService.harvestYield()

      expect(totalYield).toBeCloseTo(0.085, 3)
    })
  })

  describe('Position Management', () => {
    it('should retrieve all active positions', async () => {
      const mockPositions = [
        {
          id: 1,
          protocol: 'compound',
          amount: 0.5,
          apy: 8.5,
          deployment_time: new Date(),
          yield_earned: 0.025,
          status: 'active'
        },
        {
          id: 2,
          protocol: 'aave',
          amount: 0.3,
          apy: 7.2,
          deployment_time: new Date(),
          yield_earned: 0.018,
          status: 'active'
        }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const positions = await yieldManagementService.getActivePositions()

      expect(positions).toEqual(mockPositions)
      expect(database.query).toHaveBeenCalledWith(
        'SELECT * FROM yield_positions WHERE status = ? ORDER BY deployment_time DESC',
        ['active']
      )
    })

    it('should handle database query failures', async () => {
      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockRejectedValue(new Error('Database error'))

      await expect(yieldManagementService.getActivePositions()).rejects.toThrow('Database error')
    })

    it('should filter positions by protocol', async () => {
      const compoundPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, apy: 8.5 }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(compoundPositions)

      const positions = await yieldManagementService.getActivePositions('compound')

      expect(positions).toEqual(compoundPositions)
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('protocol = ?'),
        ['active', 'compound']
      )
    })

    it('should calculate position performance metrics', async () => {
      const mockPositions = [
        {
          id: 1,
          protocol: 'compound',
          amount: 1.0,
          apy: 8.5,
          deployment_time: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          yield_earned: 0.07
        }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const positions = await yieldManagementService.getActivePositions()
      const enrichedPositions = await yieldManagementService.enrichPositionData(positions)

      expect(enrichedPositions[0]).toHaveProperty('actualAPY')
      expect(enrichedPositions[0]).toHaveProperty('daysActive')
      expect(enrichedPositions[0]).toHaveProperty('projectedYearly')
    })
  })

  describe('Optimal Allocation Strategy', () => {
    it('should calculate optimal allocation across protocols', async () => {
      const availableBTC = 1.0
      const mockRates = {
        compound: { apy: 8.5, capacity: 10.0, risk: 'low' },
        aave: { apy: 7.8, capacity: 15.0, risk: 'low' },
        yearn: { apy: 12.2, capacity: 5.0, risk: 'medium' }
      }

      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getYieldRates).mockResolvedValue(mockRates)

      const allocation = await yieldManagementService.calculateOptimalAllocation(availableBTC)

      expect(allocation).toHaveProperty('allocations')
      expect(allocation).toHaveProperty('expectedAPY')
      expect(allocation).toHaveProperty('riskScore')
      expect(allocation.allocations).toBeInstanceOf(Array)
      
      // Should prioritize higher yields within risk tolerance
      const totalAllocated = allocation.allocations.reduce((sum, alloc) => sum + alloc.amount, 0)
      expect(totalAllocated).toBeCloseTo(availableBTC, 6)
    })

    it('should respect risk tolerance settings', async () => {
      const mockRates = {
        compound: { apy: 8.5, capacity: 10.0, risk: 'low' },
        yearn: { apy: 15.0, capacity: 5.0, risk: 'high' }
      }

      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getYieldRates).mockResolvedValue(mockRates)

      const conservativeAllocation = await yieldManagementService.calculateOptimalAllocation(
        1.0, 
        { riskTolerance: 'conservative' }
      )

      // Should favor low-risk protocols
      const lowRiskAllocations = conservativeAllocation.allocations.filter(
        alloc => mockRates[alloc.protocol].risk === 'low'
      )
      const totalLowRisk = lowRiskAllocations.reduce((sum, alloc) => sum + alloc.amount, 0)
      
      expect(totalLowRisk).toBeGreaterThan(0.8) // At least 80% in low risk
    })

    it('should consider protocol capacity limits', async () => {
      const availableBTC = 20.0 // Large amount
      const mockRates = {
        compound: { apy: 8.5, capacity: 5.0, risk: 'low' }, // Limited capacity
        aave: { apy: 7.8, capacity: 100.0, risk: 'low' }
      }

      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getYieldRates).mockResolvedValue(mockRates)

      const allocation = await yieldManagementService.calculateOptimalAllocation(availableBTC)

      const compoundAllocation = allocation.allocations.find(alloc => alloc.protocol === 'compound')
      expect(compoundAllocation?.amount).toBeLessThanOrEqual(5.0)
    })

    it('should handle insufficient capacity scenarios', async () => {
      const availableBTC = 100.0
      const mockRates = {
        compound: { apy: 8.5, capacity: 1.0, risk: 'low' }
      }

      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getYieldRates).mockResolvedValue(mockRates)

      const allocation = await yieldManagementService.calculateOptimalAllocation(availableBTC)

      expect(allocation.unallocated).toBeGreaterThan(0)
      expect(allocation.warning).toContain('Insufficient protocol capacity')
    })

    it('should update allocation based on market conditions', async () => {
      const mockRates = {
        compound: { apy: 8.5, tvl: 1000000, utilizationRate: 0.85 },
        aave: { apy: 7.8, tvl: 2000000, utilizationRate: 0.65 }
      }

      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getYieldRates).mockResolvedValue(mockRates)

      const allocation = await yieldManagementService.calculateOptimalAllocation(1.0)

      // Should consider utilization rates for stability
      expect(allocation.allocations).toBeDefined()
      expect(allocation.marketConditions).toBeDefined()
    })
  })

  describe('Position Rebalancing', () => {
    it('should rebalance positions when yield differentials exceed threshold', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, apy: 6.0 },
        { id: 2, protocol: 'aave', amount: 0.3, apy: 9.5 }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const mockCurrentRates = {
        compound: { apy: 6.0 },
        aave: { apy: 12.0 }, // Significant improvement
        yearn: { apy: 15.0 }  // New attractive option
      }

      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getYieldRates).mockResolvedValue(mockCurrentRates)

      const mockContract = {
        withdraw: vi.fn().mockResolvedValue({ hash: '0xwithdraw123', wait: vi.fn() }),
        supply: vi.fn().mockResolvedValue({ hash: '0xsupply123', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      await yieldManagementService.rebalancePositions()

      // Should trigger rebalancing
      expect(mockContract.withdraw).toHaveBeenCalled()
      expect(mockContract.supply).toHaveBeenCalled()
    })

    it('should not rebalance when yield differences are minimal', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, apy: 8.0 },
        { id: 2, protocol: 'aave', amount: 0.3, apy: 8.2 }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const mockCurrentRates = {
        compound: { apy: 8.1 },
        aave: { apy: 8.3 }
      }

      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getYieldRates).mockResolvedValue(mockCurrentRates)

      const rebalanceResult = await yieldManagementService.rebalancePositions()

      expect(rebalanceResult.rebalanced).toBe(false)
      expect(rebalanceResult.reason).toContain('yield differential below threshold')
    })

    it('should consider gas costs in rebalancing decisions', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.01, apy: 6.0 } // Small position
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const mockCurrentRates = {
        compound: { apy: 6.0 },
        yearn: { apy: 15.0 } // Much higher yield
      }

      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getYieldRates).mockResolvedValue(mockCurrentRates)

      // Mock high gas prices
      const mockGasEstimate = {
        withdrawGas: 150000,
        supplyGas: 120000,
        gasPrice: 100000000000 // 100 gwei
      }

      const rebalanceResult = await yieldManagementService.rebalancePositions({
        gasEstimate: mockGasEstimate
      })

      // Should not rebalance small positions when gas costs are high
      expect(rebalanceResult.rebalanced).toBe(false)
      expect(rebalanceResult.reason).toContain('gas cost exceeds benefit')
    })

    it('should handle rebalancing failures gracefully', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.5, apy: 5.0 }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const mockContract = {
        withdraw: vi.fn().mockRejectedValue(new Error('Withdrawal failed'))
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      await expect(yieldManagementService.rebalancePositions()).rejects.toThrow('Withdrawal failed')
    })

    it('should respect minimum position sizes', async () => {
      const mockPositions = [
        { id: 1, protocol: 'compound', amount: 0.05, apy: 6.0 }
      ]

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockPositions)

      const rebalanceResult = await yieldManagementService.rebalancePositions({
        minimumPositionSize: 0.1
      })

      expect(rebalanceResult.rebalanced).toBe(false)
      expect(rebalanceResult.reason).toContain('position below minimum size')
    })
  })

  describe('Withdrawal Management', () => {
    it('should withdraw from specific protocol successfully', async () => {
      const protocol = 'compound'
      const amount = 0.25
      const mockTxHash = '0xwithdraw123...'

      const mockContract = {
        withdraw: vi.fn().mockResolvedValue({ hash: mockTxHash, wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue([
        { id: 1, protocol, amount: 0.5, status: 'active' }
      ])
      vi.mocked(database.update).mockResolvedValue({ affected: 1 })

      const result = await yieldManagementService.withdrawFromProtocol(protocol, amount)

      expect(result).toBe(mockTxHash)
      expect(mockContract.withdraw).toHaveBeenCalledWith(
        expect.any(String), // Amount in wei
        expect.any(Object)   // Transaction options
      )
    })

    it('should handle withdrawal amount validation', async () => {
      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue([
        { id: 1, protocol: 'compound', amount: 0.5 }
      ])

      await expect(
        yieldManagementService.withdrawFromProtocol('compound', 1.0) // More than available
      ).rejects.toThrow('Insufficient balance in protocol')
    })

    it('should update position records after withdrawal', async () => {
      const mockContract = {
        withdraw: vi.fn().mockResolvedValue({ hash: '0xwithdraw123', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue([
        { id: 1, protocol: 'compound', amount: 0.5 }
      ])
      vi.mocked(database.update).mockResolvedValue({ affected: 1 })

      await yieldManagementService.withdrawFromProtocol('compound', 0.25)

      expect(database.update).toHaveBeenCalledWith(
        'yield_positions',
        { id: 1 },
        {
          amount: 0.25, // Reduced amount
          last_updated: expect.any(Date)
        }
      )
    })

    it('should handle emergency withdrawals', async () => {
      const mockContract = {
        emergencyWithdraw: vi.fn().mockResolvedValue({ hash: '0xemergency123', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const result = await yieldManagementService.emergencyWithdraw('compound')

      expect(result).toBeTruthy()
      expect(mockContract.emergencyWithdraw).toHaveBeenCalled()
    })

    it('should calculate withdrawal fees', async () => {
      const { database } = await import('../../utils/database')
      vi.mocked(database.query).mockResolvedValue([
        { 
          id: 1, 
          protocol: 'compound', 
          amount: 0.5,
          deployment_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        }
      ])

      const withdrawalQuote = await yieldManagementService.getWithdrawalQuote('compound', 0.25)

      expect(withdrawalQuote).toHaveProperty('amount')
      expect(withdrawalQuote).toHaveProperty('fee')
      expect(withdrawalQuote).toHaveProperty('netAmount')
      expect(withdrawalQuote).toHaveProperty('feeReason')
    })
  })

  describe('Risk Management', () => {
    it('should monitor protocol health and risk metrics', async () => {
      const healthChecks = await yieldManagementService.performHealthChecks()

      expect(healthChecks).toHaveProperty('protocols')
      expect(healthChecks).toHaveProperty('overallRisk')
      expect(healthChecks).toHaveProperty('recommendations')

      // Should check each protocol
      expect(healthChecks.protocols).toBeInstanceOf(Array)
    })

    it('should trigger risk alerts for unhealthy protocols', async () => {
      const mockUnhealthyProtocol = {
        name: 'compound',
        healthScore: 0.3, // Low health
        issues: ['low_liquidity', 'high_utilization']
      }

      const riskAlert = await yieldManagementService.checkProtocolRisk(mockUnhealthyProtocol)

      expect(riskAlert.severity).toBe('high')
      expect(riskAlert.action).toBe('withdraw_immediately')
    })

    it('should implement position size limits', async () => {
      const maxPositionSize = 5.0 // BTC
      const attemptedDeployment = 10.0 // Exceeds limit

      await expect(
        yieldManagementService.deployToYieldProtocol(attemptedDeployment, 'compound', {
          maxPositionSize
        })
      ).rejects.toThrow('Position size exceeds limit')
    })

    it('should diversify across protocols automatically', async () => {
      const allocation = await yieldManagementService.calculateOptimalAllocation(10.0, {
        maxProtocolConcentration: 0.4 // Max 40% per protocol
      })

      allocation.allocations.forEach(alloc => {
        expect(alloc.amount / 10.0).toBeLessThanOrEqual(0.4)
      })
    })

    it('should handle protocol blacklisting', async () => {
      const blacklistedProtocols = ['risky_protocol']

      await expect(
        yieldManagementService.deployToYieldProtocol(1.0, 'risky_protocol', {
          blacklist: blacklistedProtocols
        })
      ).rejects.toThrow('Protocol is blacklisted')
    })
  })

  describe('Performance Monitoring', () => {
    it('should track yield performance over time', async () => {
      const performanceMetrics = await yieldManagementService.getPerformanceMetrics({
        timeframe: '30d'
      })

      expect(performanceMetrics).toHaveProperty('totalYieldEarned')
      expect(performanceMetrics).toHaveProperty('averageAPY')
      expect(performanceMetrics).toHaveProperty('bestPerformingProtocol')
      expect(performanceMetrics).toHaveProperty('worstPerformingProtocol')
      expect(performanceMetrics).toHaveProperty('protocolBreakdown')
    })

    it('should compare actual vs projected yields', async () => {
      const comparison = await yieldManagementService.compareProjectedVsActual()

      expect(comparison).toHaveProperty('projectedYield')
      expect(comparison).toHaveProperty('actualYield')
      expect(comparison).toHaveProperty('variance')
      expect(comparison).toHaveProperty('accuracy')
    })

    it('should generate yield reports', async () => {
      const report = await yieldManagementService.generateYieldReport({
        period: 'monthly',
        format: 'detailed'
      })

      expect(report).toHaveProperty('period')
      expect(report).toHaveProperty('totalDeployed')
      expect(report).toHaveProperty('totalHarvested')
      expect(report).toHaveProperty('protocolPerformance')
      expect(report).toHaveProperty('recommendations')
    })

    it('should calculate compound annual growth rate (CAGR)', async () => {
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      const initialInvestment = 10.0
      const currentValue = 11.5

      const cagr = await yieldManagementService.calculateCAGR(
        initialInvestment,
        currentValue,
        oneYearAgo,
        new Date()
      )

      expect(cagr).toBeCloseTo(15.0, 1) // 15% CAGR
    })
  })

  describe('Integration with External Services', () => {
    it('should integrate with price oracles for accurate valuations', async () => {
      const { priceService } = await import('../../api/controllers')
      vi.mocked(priceService.getBTCPrice).mockResolvedValue(45000)

      const portfolioValue = await yieldManagementService.getPortfolioValue()

      expect(portfolioValue).toHaveProperty('btcValue')
      expect(portfolioValue).toHaveProperty('usdValue')
      expect(priceService.getBTCPrice).toHaveBeenCalled()
    })

    it('should monitor blockchain events for position updates', async () => {
      const eventListener = vi.fn()
      
      await yieldManagementService.startEventMonitoring(eventListener)

      // Should set up event listeners for relevant protocols
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'position_update',
          protocol: expect.any(String)
        })
      )
    })

    it('should integrate with notification service for alerts', async () => {
      const mockAlert = {
        type: 'protocol_risk',
        severity: 'high',
        message: 'Compound protocol showing signs of distress'
      }

      const notificationSent = await yieldManagementService.sendAlert(mockAlert)

      expect(notificationSent).toBe(true)
    })
  })

  describe('Automated Strategies', () => {
    it('should implement dollar-cost averaging for deployments', async () => {
      const dcaStrategy = {
        totalAmount: 5.0,
        frequency: 'weekly',
        duration: '1month'
      }

      const schedule = await yieldManagementService.setupDCAStrategy(dcaStrategy)

      expect(schedule).toHaveProperty('deployments')
      expect(schedule.deployments).toHaveLength(4) // 4 weeks
      
      schedule.deployments.forEach(deployment => {
        expect(deployment.amount).toBe(1.25) // 5.0 / 4
        expect(deployment).toHaveProperty('scheduledDate')
      })
    })

    it('should implement yield compounding strategies', async () => {
      const compoundingResult = await yieldManagementService.autoCompound({
        minHarvestAmount: 0.01,
        reinvestmentProtocol: 'auto'
      })

      expect(compoundingResult).toHaveProperty('harvested')
      expect(compoundingResult).toHaveProperty('reinvested')
      expect(compoundingResult).toHaveProperty('newPositions')
    })

    it('should implement stop-loss mechanisms', async () => {
      const stopLossConfig = {
        protocol: 'compound',
        triggerLoss: -10, // 10% loss
        action: 'withdraw_all'
      }

      const stopLoss = await yieldManagementService.setupStopLoss(stopLossConfig)

      expect(stopLoss).toHaveProperty('active')
      expect(stopLoss).toHaveProperty('triggerId')
      expect(stopLoss.active).toBe(true)
    })

    it('should optimize gas usage for transactions', async () => {
      const gasOptimization = await yieldManagementService.optimizeGasUsage()

      expect(gasOptimization).toHaveProperty('batchedTransactions')
      expect(gasOptimization).toHaveProperty('estimatedSavings')
      expect(gasOptimization).toHaveProperty('recommendedGasPrice')
    })
  })
})
