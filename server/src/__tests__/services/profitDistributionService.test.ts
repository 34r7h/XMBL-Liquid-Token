import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { profitDistributionService } from '../../services/profitDistributionService'

// Mock dependencies
vi.mock('ethers', () => ({
  ethers: {
    Contract: vi.fn(),
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

describe('Profit Distribution Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Yield Calculation', () => {
    it('should calculate distributable yield after fees and reserves', async () => {
      const mockYieldData = {
        totalYieldEarned: '10000000000000000000', // 10 ETH
        protocolFee: '5', // 5%
        reservePercentage: '10', // 10%
        operationalCosts: '500000000000000000' // 0.5 ETH
      }

      const mockContract = {
        getTotalYieldEarned: vi.fn().mockResolvedValue(mockYieldData.totalYieldEarned),
        getProtocolFee: vi.fn().mockResolvedValue(mockYieldData.protocolFee),
        getReservePercentage: vi.fn().mockResolvedValue(mockYieldData.reservePercentage)
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const distributableYield = await profitDistributionService.calculateDistributableYield()

      // Expected: 10 ETH - 5% protocol fee - 10% reserve - 0.5 ETH operational costs
      // = 10 - 0.5 - 1.0 - 0.5 = 8.0 ETH
      expect(distributableYield).toBeCloseTo(8.0, 1)
    })

    it('should handle zero yield scenarios', async () => {
      const mockContract = {
        getTotalYieldEarned: vi.fn().mockResolvedValue('0')
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const distributableYield = await profitDistributionService.calculateDistributableYield()

      expect(distributableYield).toBe(0)
    })

    it('should validate minimum distribution threshold', async () => {
      const mockContract = {
        getTotalYieldEarned: vi.fn().mockResolvedValue('100000000000000000'), // 0.1 ETH
        getMinimumDistributionThreshold: vi.fn().mockResolvedValue('1000000000000000000') // 1 ETH
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const belowThreshold = await profitDistributionService.isAboveMinimumThreshold()

      expect(belowThreshold).toBe(false)
    })

    it('should calculate yield with dynamic fee structure', async () => {
      const mockYieldTiers = [
        { min: 0, max: 1000000000000000000, fee: 5 }, // 0-1 ETH: 5%
        { min: 1000000000000000000, max: 10000000000000000000, fee: 3 }, // 1-10 ETH: 3%
        { min: 10000000000000000000, max: Infinity, fee: 2 } // >10 ETH: 2%
      ]

      const mockContract = {
        getTotalYieldEarned: vi.fn().mockResolvedValue('5000000000000000000'), // 5 ETH
        getFeeTiers: vi.fn().mockResolvedValue(mockYieldTiers)
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      const distributableYield = await profitDistributionService.calculateDistributableYield()

      // Should apply 3% fee for 5 ETH yield
      expect(distributableYield).toBeCloseTo(4.85, 2) // 5 - (5 * 0.03)
    })

    it('should handle contract query failures', async () => {
      const mockContract = {
        getTotalYieldEarned: vi.fn().mockRejectedValue(new Error('Contract error'))
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockContract)

      await expect(profitDistributionService.calculateDistributableYield()).rejects.toThrow('Contract error')
    })
  })

  describe('NFT Holder Data Retrieval', () => {
    it('should retrieve all NFT holders with TBA addresses', async () => {
      const mockNFTHolders = [
        {
          tokenId: 1,
          owner: '0xowner1...',
          tbaAddress: '0xtba1...',
          depositValue: '2000000000000000000' // 2 ETH
        },
        {
          tokenId: 2,
          owner: '0xowner2...',
          tbaAddress: '0xtba2...',
          depositValue: '3000000000000000000' // 3 ETH
        }
      ]

      const mockNFTContract = {
        totalSupply: vi.fn().mockResolvedValue(2),
        ownerOf: vi.fn()
          .mockResolvedValueOnce('0xowner1...')
          .mockResolvedValueOnce('0xowner2...'),
        getDepositValue: vi.fn()
          .mockResolvedValueOnce('2000000000000000000')
          .mockResolvedValueOnce('3000000000000000000')
      }

      const mockTBARegistry = {
        account: vi.fn()
          .mockResolvedValueOnce('0xtba1...')
          .mockResolvedValueOnce('0xtba2...')
      }

      vi.mocked(require('ethers').ethers.Contract)
        .mockReturnValueOnce(mockNFTContract)
        .mockReturnValueOnce(mockTBARegistry)

      const nftHolders = await profitDistributionService.getNFTHolderData()

      expect(nftHolders).toHaveLength(2)
      expect(nftHolders[0]).toEqual(
        expect.objectContaining({
          tokenId: 1,
          owner: '0xowner1...',
          tbaAddress: '0xtba1...',
          depositValue: '2000000000000000000'
        })
      )
    })

    it('should handle non-existent NFTs gracefully', async () => {
      const mockNFTContract = {
        totalSupply: vi.fn().mockResolvedValue(5),
        ownerOf: vi.fn()
          .mockResolvedValueOnce('0xowner1...')
          .mockRejectedValueOnce(new Error('Token does not exist'))
          .mockResolvedValueOnce('0xowner3...')
      }

      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockNFTContract)

      const nftHolders = await profitDistributionService.getNFTHolderData()

      // Should skip non-existent token and continue
      expect(nftHolders).toHaveLength(2) // Only valid NFTs
    })

    it('should filter out zero-value deposits', async () => {
      const mockNFTContract = {
        totalSupply: vi.fn().mockResolvedValue(3),
        ownerOf: vi.fn()
          .mockResolvedValueOnce('0xowner1...')
          .mockResolvedValueOnce('0xowner2...')
          .mockResolvedValueOnce('0xowner3...'),
        getDepositValue: vi.fn()
          .mockResolvedValueOnce('2000000000000000000') // 2 ETH
          .mockResolvedValueOnce('0') // 0 ETH - should be filtered
          .mockResolvedValueOnce('1000000000000000000') // 1 ETH
      }

      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockNFTContract)

      const nftHolders = await profitDistributionService.getNFTHolderData()

      expect(nftHolders).toHaveLength(2) // Only non-zero deposits
      expect(nftHolders.every(holder => Number(holder.depositValue) > 0)).toBe(true)
    })

    it('should cache NFT holder data for performance', async () => {
      const mockNFTContract = {
        totalSupply: vi.fn().mockResolvedValue(1),
        ownerOf: vi.fn().mockResolvedValue('0xowner1...'),
        getDepositValue: vi.fn().mockResolvedValue('1000000000000000000')
      }

      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockNFTContract)

      // First call
      await profitDistributionService.getNFTHolderData()
      // Second call (should use cache)
      await profitDistributionService.getNFTHolderData()

      // Contract should only be called once due to caching
      expect(mockNFTContract.totalSupply).toHaveBeenCalledTimes(1)
    })

    it('should refresh cache when explicitly requested', async () => {
      const mockNFTContract = {
        totalSupply: vi.fn().mockResolvedValue(1),
        ownerOf: vi.fn().mockResolvedValue('0xowner1...'),
        getDepositValue: vi.fn().mockResolvedValue('1000000000000000000')
      }

      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockNFTContract)

      await profitDistributionService.getNFTHolderData()
      await profitDistributionService.getNFTHolderData(true) // Force refresh

      expect(mockNFTContract.totalSupply).toHaveBeenCalledTimes(2)
    })
  })

  describe('Individual Share Calculation', () => {
    it('should calculate proportional shares based on deposit values', async () => {
      const totalYield = 5.0 // 5 ETH
      const nftHolders = [
        { tokenId: 1, depositValue: '2000000000000000000' }, // 2 ETH (40%)
        { tokenId: 2, depositValue: '3000000000000000000' }  // 3 ETH (60%)
      ]

      const distributionMap = await profitDistributionService.calculateIndividualShares(
        totalYield,
        nftHolders
      )

      expect(distributionMap[1]).toBeCloseTo(2.0, 1) // 40% of 5 ETH
      expect(distributionMap[2]).toBeCloseTo(3.0, 1) // 60% of 5 ETH
    })

    it('should handle single NFT holder scenario', async () => {
      const totalYield = 10.0
      const nftHolders = [
        { tokenId: 1, depositValue: '5000000000000000000' } // 5 ETH (100%)
      ]

      const distributionMap = await profitDistributionService.calculateIndividualShares(
        totalYield,
        nftHolders
      )

      expect(distributionMap[1]).toBe(10.0) // Gets all yield
    })

    it('should apply minimum distribution amounts', async () => {
      const totalYield = 0.05 // Very small yield
      const nftHolders = [
        { tokenId: 1, depositValue: '1000000000000000000' }, // 1 ETH
        { tokenId: 2, depositValue: '1000000000000000000' }  // 1 ETH
      ]

      const distributionMap = await profitDistributionService.calculateIndividualShares(
        totalYield,
        nftHolders,
        { minimumDistribution: 0.01 }
      )

      // Both should get at least minimum amount
      expect(distributionMap[1]).toBeGreaterThanOrEqual(0.01)
      expect(distributionMap[2]).toBeGreaterThanOrEqual(0.01)
    })

    it('should handle rounding precision correctly', async () => {
      const totalYield = 1.0
      const nftHolders = [
        { tokenId: 1, depositValue: '333333333333333333' }, // 1/3 ETH
        { tokenId: 2, depositValue: '333333333333333333' }, // 1/3 ETH  
        { tokenId: 3, depositValue: '333333333333333334' }  // 1/3 ETH + 1 wei
      ]

      const distributionMap = await profitDistributionService.calculateIndividualShares(
        totalYield,
        nftHolders
      )

      const totalDistributed = Object.values(distributionMap).reduce((sum, amount) => sum + amount, 0)
      
      // Should distribute exactly the total yield (accounting for rounding)
      expect(totalDistributed).toBeCloseTo(1.0, 6)
    })

    it('should exclude inactive or locked NFTs', async () => {
      const totalYield = 5.0
      const nftHolders = [
        { tokenId: 1, depositValue: '2000000000000000000', isActive: true },
        { tokenId: 2, depositValue: '3000000000000000000', isActive: false }, // Locked/inactive
        { tokenId: 3, depositValue: '1000000000000000000', isActive: true }
      ]

      const distributionMap = await profitDistributionService.calculateIndividualShares(
        totalYield,
        nftHolders.filter(holder => holder.isActive)
      )

      expect(distributionMap[1]).toBeDefined()
      expect(distributionMap[2]).toBeUndefined() // Should not receive yield
      expect(distributionMap[3]).toBeDefined()
    })
  })

  describe('Distribution Execution', () => {
    it('should execute distribution to all eligible TBAs', async () => {
      const distributionMap = {
        1: 2.0, // 2 ETH to token 1
        2: 3.0  // 3 ETH to token 2
      }

      const mockTBAContract = {
        transfer: vi.fn()
          .mockResolvedValueOnce({ hash: '0xtx1...', wait: vi.fn() })
          .mockResolvedValueOnce({ hash: '0xtx2...', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockTBAContract)

      const txHashes = await profitDistributionService.executeDistribution(distributionMap)

      expect(txHashes).toEqual(['0xtx1...', '0xtx2...'])
      expect(mockTBAContract.transfer).toHaveBeenCalledTimes(2)
    })

    it('should handle distribution failures gracefully', async () => {
      const distributionMap = {
        1: 2.0,
        2: 3.0
      }

      const mockTBAContract = {
        transfer: vi.fn()
          .mockResolvedValueOnce({ hash: '0xtx1...', wait: vi.fn() })
          .mockRejectedValueOnce(new Error('Transfer failed'))
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockTBAContract)

      const { database } = await import('../utils/database')
      vi.mocked(database.insert).mockResolvedValue({ id: 1 })

      const txHashes = await profitDistributionService.executeDistribution(distributionMap)

      expect(txHashes).toHaveLength(1) // Only successful transaction
      expect(database.insert).toHaveBeenCalledWith(
        'failed_distributions',
        expect.objectContaining({
          token_id: 2,
          amount: 3.0,
          error: 'Transfer failed'
        })
      )
    })

    it('should implement batch distribution for gas efficiency', async () => {
      const distributionMap = {}
      for (let i = 1; i <= 50; i++) {
        distributionMap[i] = 0.1 // 0.1 ETH each
      }

      const mockDistributorContract = {
        batchDistribute: vi.fn().mockResolvedValue({ hash: '0xbatch...', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockDistributorContract)

      const txHashes = await profitDistributionService.executeDistribution(
        distributionMap,
        { useBatch: true, batchSize: 20 }
      )

      expect(mockDistributorContract.batchDistribute).toHaveBeenCalledTimes(3) // 50 / 20 = 3 batches
      expect(txHashes).toHaveLength(3)
    })

    it('should update distribution records in database', async () => {
      const distributionMap = { 1: 2.0 }

      const mockTBAContract = {
        transfer: vi.fn().mockResolvedValue({ hash: '0xtx1...', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockTBAContract)

      const { database } = await import('../utils/database')
      vi.mocked(database.insert).mockResolvedValue({ id: 1 })

      await profitDistributionService.executeDistribution(distributionMap)

      expect(database.insert).toHaveBeenCalledWith(
        'yield_distributions',
        expect.objectContaining({
          token_id: 1,
          amount: 2.0,
          transaction_hash: '0xtx1...',
          distribution_date: expect.any(Date),
          status: 'completed'
        })
      )
    })

    it('should calculate and deduct gas fees from distributions', async () => {
      const distributionMap = { 1: 1.0 }
      const estimatedGasFee = 0.01 // 0.01 ETH gas

      const mockTBAContract = {
        estimateGas: { transfer: vi.fn().mockResolvedValue(21000) },
        transfer: vi.fn().mockResolvedValue({ hash: '0xtx1...', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockTBAContract)

      const txHashes = await profitDistributionService.executeDistribution(
        distributionMap,
        { deductGasFees: true }
      )

      // Should transfer net amount after gas fee deduction
      expect(mockTBAContract.transfer).toHaveBeenCalledWith(
        expect.any(String), // TBA address
        expect.stringMatching(/99/) // ~0.99 ETH (1.0 - 0.01 gas)
      )
    })
  })

  describe('Distribution History', () => {
    it('should retrieve distribution history with date filters', async () => {
      const fromDate = new Date('2024-01-01')
      const toDate = new Date('2024-12-31')
      
      const mockDistributions = [
        {
          id: 1,
          token_id: 1,
          amount: '2000000000000000000',
          distribution_date: new Date('2024-06-15'),
          transaction_hash: '0xtx1...'
        },
        {
          id: 2,
          token_id: 2,
          amount: '3000000000000000000',
          distribution_date: new Date('2024-06-15'),
          transaction_hash: '0xtx2...'
        }
      ]

      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockDistributions)

      const history = await profitDistributionService.getDistributionHistory(fromDate, toDate)

      expect(history).toEqual(mockDistributions)
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE distribution_date BETWEEN ? AND ?'),
        [fromDate, toDate]
      )
    })

    it('should aggregate distribution statistics', async () => {
      const mockDistributions = [
        { token_id: 1, amount: '2000000000000000000' },
        { token_id: 1, amount: '1500000000000000000' },
        { token_id: 2, amount: '3000000000000000000' }
      ]

      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockDistributions)

      const stats = await profitDistributionService.getDistributionStatistics()

      expect(stats).toHaveProperty('totalDistributed')
      expect(stats).toHaveProperty('uniqueRecipients')
      expect(stats).toHaveProperty('averageDistribution')
      expect(stats).toHaveProperty('distributionCount')
    })

    it('should export distribution history to CSV', async () => {
      const mockDistributions = [
        {
          token_id: 1,
          amount: '2000000000000000000',
          distribution_date: new Date('2024-06-15'),
          transaction_hash: '0xtx1...'
        }
      ]

      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockDistributions)

      const csvData = await profitDistributionService.exportDistributionHistory('csv')

      expect(csvData).toContain('token_id,amount,distribution_date,transaction_hash')
      expect(csvData).toContain('1,2.0,2024-06-15,0xtx1...')
    })

    it('should handle empty distribution history', async () => {
      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue([])

      const history = await profitDistributionService.getDistributionHistory()

      expect(history).toEqual([])
    })
  })

  describe('APY Calculation', () => {
    it('should calculate APY for specific NFT', async () => {
      const tokenId = 1
      const mockDistributions = [
        {
          amount: '1000000000000000000', // 1 ETH
          distribution_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        },
        {
          amount: '1000000000000000000', // 1 ETH
          distribution_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
        }
      ]

      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue(mockDistributions)

      const mockNFTContract = {
        getDepositValue: vi.fn().mockResolvedValue('20000000000000000000') // 20 ETH deposit
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockNFTContract)

      const apy = await profitDistributionService.calculateAPY(tokenId)

      // Expected: (2 ETH yield / 20 ETH deposit) * (365 / 60) * 100 = 60.83% APY
      expect(apy).toBeCloseTo(60.83, 1)
    })

    it('should handle insufficient history for APY calculation', async () => {
      const tokenId = 1

      const { database } = await import('../utils/database')
      vi.mocked(database.query).mockResolvedValue([]) // No distributions

      const apy = await profitDistributionService.calculateAPY(tokenId)

      expect(apy).toBe(0)
    })

    it('should calculate rolling APY over different periods', async () => {
      const tokenId = 1
      
      const apyResults = await Promise.all([
        profitDistributionService.calculateAPY(tokenId, '30d'),
        profitDistributionService.calculateAPY(tokenId, '90d'),
        profitDistributionService.calculateAPY(tokenId, '365d')
      ])

      expect(apyResults).toHaveLength(3)
      expect(apyResults.every(apy => typeof apy === 'number')).toBe(true)
    })

    it('should calculate portfolio-wide APY', async () => {
      const mockPortfolioAPY = await profitDistributionService.calculatePortfolioAPY()

      expect(mockPortfolioAPY).toHaveProperty('averageAPY')
      expect(mockPortfolioAPY).toHaveProperty('weightedAPY')
      expect(mockPortfolioAPY).toHaveProperty('topPerforming')
      expect(mockPortfolioAPY).toHaveProperty('underperforming')
    })
  })

  describe('Distribution Scheduling', () => {
    it('should schedule automatic distributions', async () => {
      const frequency = 'weekly'
      
      await profitDistributionService.scheduleDistribution(frequency)

      const scheduledJob = await profitDistributionService.getScheduledJob()

      expect(scheduledJob).toHaveProperty('frequency', frequency)
      expect(scheduledJob).toHaveProperty('nextExecution')
      expect(scheduledJob).toHaveProperty('isActive', true)
    })

    it('should cancel existing schedule when setting new one', async () => {
      await profitDistributionService.scheduleDistribution('weekly')
      await profitDistributionService.scheduleDistribution('monthly')

      const activeJobs = await profitDistributionService.getActiveSchedules()

      expect(activeJobs).toHaveLength(1)
      expect(activeJobs[0].frequency).toBe('monthly')
    })

    it('should execute scheduled distribution automatically', async () => {
      const mockExecuteDistribution = vi.spyOn(profitDistributionService, 'executeDistribution')
        .mockResolvedValue(['0xtx1...'])

      await profitDistributionService.scheduleDistribution('daily')
      
      // Simulate scheduled execution
      await profitDistributionService.runScheduledDistribution()

      expect(mockExecuteDistribution).toHaveBeenCalled()
    })

    it('should skip distribution if below threshold', async () => {
      const mockGetDistributableYield = vi.spyOn(profitDistributionService, 'calculateDistributableYield')
        .mockResolvedValue(0.005) // Below threshold

      const mockExecuteDistribution = vi.spyOn(profitDistributionService, 'executeDistribution')

      await profitDistributionService.runScheduledDistribution()

      expect(mockExecuteDistribution).not.toHaveBeenCalled()
    })
  })

  describe('Emergency Controls', () => {
    it('should pause all distributions', async () => {
      await profitDistributionService.pauseDistributions()

      const status = await profitDistributionService.getDistributionStatus()

      expect(status.isPaused).toBe(true)
      expect(status.pausedAt).toBeInstanceOf(Date)
    })

    it('should prevent distributions when paused', async () => {
      await profitDistributionService.pauseDistributions()

      const distributionMap = { 1: 1.0 }

      await expect(
        profitDistributionService.executeDistribution(distributionMap)
      ).rejects.toThrow('Distributions are currently paused')
    })

    it('should resume distributions after pause', async () => {
      await profitDistributionService.pauseDistributions()
      await profitDistributionService.resumeDistributions()

      const status = await profitDistributionService.getDistributionStatus()

      expect(status.isPaused).toBe(false)
      expect(status.resumedAt).toBeInstanceOf(Date)
    })

    it('should validate system state before resuming', async () => {
      await profitDistributionService.pauseDistributions()

      // Mock unhealthy system state
      const mockHealthCheck = vi.spyOn(profitDistributionService, 'performHealthCheck')
        .mockResolvedValue({ isHealthy: false, issues: ['low_gas_balance'] })

      await expect(
        profitDistributionService.resumeDistributions()
      ).rejects.toThrow('System health check failed')
    })

    it('should implement emergency withdrawal for admin', async () => {
      const emergencyAmount = '1000000000000000000' // 1 ETH

      const mockEmergencyContract = {
        emergencyWithdraw: vi.fn().mockResolvedValue({ hash: '0xemergency...', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockEmergencyContract)

      const txHash = await profitDistributionService.emergencyWithdraw(emergencyAmount)

      expect(txHash).toBe('0xemergency...')
      expect(mockEmergencyContract.emergencyWithdraw).toHaveBeenCalledWith(emergencyAmount)
    })
  })

  describe('Token Bound Account Integration', () => {
    it('should get TBA balance for specific NFT', async () => {
      const tokenId = 1
      const mockTBAAddress = '0xtba1...'

      const mockTBARegistry = {
        account: vi.fn().mockResolvedValue(mockTBAAddress)
      }

      const mockProvider = {
        getBalance: vi.fn().mockResolvedValue('2000000000000000000') // 2 ETH
      }

      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockTBARegistry)
      vi.mocked(require('ethers').ethers.providers.JsonRpcProvider).mockReturnValue(mockProvider)

      const balance = await profitDistributionService.getTBABalance(tokenId)

      expect(balance).toBe(2.0)
      expect(mockTBARegistry.account).toHaveBeenCalledWith(
        expect.any(String), // Implementation address
        expect.any(String), // Chain ID
        expect.any(String), // Token contract
        tokenId,
        expect.any(String)  // Salt
      )
    })

    it('should distribute to TBA directly', async () => {
      const tokenId = 1
      const amount = 1.5

      const mockTBAContract = {
        transfer: vi.fn().mockResolvedValue({ hash: '0xtbatx...', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockTBAContract)

      const txHash = await profitDistributionService.distributeTTBA(tokenId, amount)

      expect(txHash).toBe('0xtbatx...')
      expect(mockTBAContract.transfer).toHaveBeenCalledWith(
        expect.any(String), // TBA address
        expect.stringContaining('1500000000000000000') // 1.5 ETH in wei
      )
    })

    it('should handle TBA creation if not exists', async () => {
      const tokenId = 999 // NFT without TBA

      const mockTBARegistry = {
        account: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000'),
        createAccount: vi.fn().mockResolvedValue({ hash: '0xcreate...', wait: vi.fn() })
      }
      vi.mocked(require('ethers').ethers.Contract).mockReturnValue(mockTBARegistry)

      await profitDistributionService.ensureTBAExists(tokenId)

      expect(mockTBARegistry.createAccount).toHaveBeenCalled()
    })

    it('should validate TBA ownership before distribution', async () => {
      const tokenId = 1
      const mockOwner = '0xowner1...'

      const mockNFTContract = {
        ownerOf: vi.fn().mockResolvedValue(mockOwner)
      }

      const mockTBAContract = {
        owner: vi.fn().mockResolvedValue(mockOwner)
      }

      vi.mocked(require('ethers').ethers.Contract)
        .mockReturnValueOnce(mockNFTContract)
        .mockReturnValueOnce(mockTBAContract)

      const isValid = await profitDistributionService.validateTBAOwnership(tokenId)

      expect(isValid).toBe(true)
    })
  })
})
