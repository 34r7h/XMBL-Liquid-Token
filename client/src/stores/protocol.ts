/**
 * protocol.ts
 *
 * PURPOSE:
 * Pinia store for managing protocol-wide statistics, supported tokens,
 * bonding curve data, and global application state.
 *
 * STATE:
 * - totalValueLocked: string - Protocol TVL
 * - currentAPY: number - Protocol-wide APY
 * - totalUsers: number - Number of unique users
 * - totalYieldDistributed: string - Cumulative yield distributed
 * - supportedTokens: TokenConfig[] - List of supported deposit tokens
 * - bondingCurveRate: number - Current XMBL bonding curve rate
 * - protocolStats: ProtocolStats - General protocol statistics
 * - isMaintenanceMode: boolean - Protocol maintenance status
 * - lastStatsUpdate: Date | null - Last statistics refresh
 *
 * ACTIONS:
 * - fetchProtocolStats(): Promise<void> - Load protocol statistics
 * - fetchBondingCurveRate(): Promise<void> - Get current bonding curve
 * - fetchSupportedTokens(): Promise<void> - Load supported token list
 * - refreshAllData(): Promise<void> - Refresh all protocol data
 * - estimateXMBLOutput(token: string, amount: string): Promise<string> - Calculate XMBL output
 * - getTokenPrice(symbol: string): Promise<number> - Get current token price
 * - subscribeToUpdates(): void - Subscribe to real-time updates
 * - unsubscribeFromUpdates(): void - Unsubscribe from updates
 *
 * GETTERS:
 * - formattedTVL: string - Formatted TVL for display
 * - formattedAPY: string - Formatted APY percentage
 * - getSupportedToken: (symbol: string) => TokenConfig - Get token config
 * - isTokenSupported: (address: string) => boolean - Check token support
 * - protocolHealth: string - Overall protocol health status
 *
 * REQUIREMENTS:
 * - Must provide real-time protocol statistics
 * - Must cache data with appropriate TTL
 * - Must handle API failures gracefully
 * - Must support offline mode with cached data
 * - Must validate all incoming data
 *
 * CONNECTED SYSTEM COMPONENTS:
 * - Home.vue - Displays protocol statistics
 * - DepositForm.vue - Uses supported tokens and bonding curve
 * - Dashboard.vue - Shows protocol health and stats
 * - apiService.ts - Fetches protocol data from backend
 * - contracts.ts - Validates against supported tokens
 *
 * DATA REFRESH INTERVALS:
 * - Protocol stats: Every 5 minutes
 * - Bonding curve rate: Every 1 minute
 * - Token prices: Every 30 seconds
 * - Supported tokens: Every hour
 *
 * WEBSOCKET EVENTS:
 * - protocol_stats_updated - Real-time protocol statistics
 * - bonding_curve_updated - Bonding curve rate changes
 * - maintenance_mode_changed - Maintenance status changes
 *
 * CACHING STRATEGY:
 * - In-memory cache with TTL
 * - localStorage for offline support
 * - Stale-while-revalidate pattern
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '../services/apiService'
import type { ProtocolStats } from '../services/apiService'

// Token configuration interface
interface TokenConfig {
  symbol: string
  address: string
  decimals: number
  name: string
  icon?: string
  isActive: boolean
}

export const useProtocolStore = defineStore('protocol', () => {
  // === STATE ===
  const totalValueLocked = ref<string>('0')
  const currentAPY = ref<number>(0)
  const totalUsers = ref<number>(0)
  const totalYieldDistributed = ref<string>('0')
  const supportedTokens = ref<TokenConfig[]>([])
  const bondingCurveRate = ref<number>(0)
  const protocolStats = ref<ProtocolStats | null>(null)
  const isMaintenanceMode = ref<boolean>(false)
  const lastStatsUpdate = ref<Date | null>(null)
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // Cache timestamps
  const statsCache = ref<number>(0)
  const bondingCurveCache = ref<number>(0)
  const tokensCache = ref<number>(0)

  // Cache TTL in milliseconds
  const STATS_TTL = 5 * 60 * 1000 // 5 minutes
  const BONDING_CURVE_TTL = 1 * 60 * 1000 // 1 minute
  const TOKENS_TTL = 60 * 60 * 1000 // 1 hour

  // === GETTERS ===
  const formattedTVL = computed(() => {
    const tvl = parseFloat(totalValueLocked.value) || 0
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(2)}K`
    return `$${tvl.toFixed(2)}`
  })

  const formattedAPY = computed(() => {
    return `${currentAPY.value.toFixed(2)}%`
  })

  const getSupportedToken = computed(() => {
    return (symbol: string): TokenConfig | undefined => {
      return supportedTokens.value.find(token => token.symbol === symbol)
    }
  })

  const isTokenSupported = computed(() => {
    return (address: string): boolean => {
      return supportedTokens.value.some(token =>
        token.address.toLowerCase() === address.toLowerCase() && token.isActive
      )
    }
  })

  const protocolHealth = computed(() => {
    if (isMaintenanceMode.value) return 'maintenance'
    if (!lastStatsUpdate.value) return 'unknown'

    const timeSinceUpdate = Date.now() - lastStatsUpdate.value.getTime()
    if (timeSinceUpdate > 10 * 60 * 1000) return 'stale' // 10 minutes

    return 'healthy'
  })

  // === ACTIONS ===

  /**
   * Fetch protocol statistics
   */
  const validateStats = (stats: any): stats is ProtocolStats => {
    return (
      typeof stats.totalValueLocked === 'string' &&
      typeof stats.averageAPY === 'number' &&
      typeof stats.totalUsers === 'number' &&
      typeof stats.totalYieldDistributed === 'string' &&
      typeof stats.totalDeposits === 'string' &&
      typeof stats.averageDepositSize === 'string' &&
      typeof stats.volume24h === 'string' &&
      typeof stats.activeNFTs === 'number'
    )
  }

  const fetchProtocolStats = async (): Promise<void> => {
    // Check cache first
    if (Date.now() - statsCache.value < STATS_TTL && protocolStats.value) {
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const stats = await apiService.getProtocolStats()
      if (!validateStats(stats)) {
        throw new Error('Invalid data format')
      }
      protocolStats.value = stats
      totalValueLocked.value = stats.totalDeposits
      totalUsers.value = stats.totalUsers
      currentAPY.value = stats.averageAPY
      totalYieldDistributed.value = stats.volume24h
      lastStatsUpdate.value = new Date()
      statsCache.value = Date.now()

      // Cache to localStorage
      localStorage.setItem('protocolStats', JSON.stringify({
        data: stats,
        timestamp: Date.now()
      }))

    } catch (err: any) {
      error.value = err.message || 'Failed to fetch protocol stats'
      console.error('Failed to fetch protocol stats:', err)

      // Try to load from cache
      loadStatsFromCache()
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch bonding curve rate
   */
  const fetchBondingCurveRate = async (): Promise<void> => {
    // Check cache first
    if (Date.now() - bondingCurveCache.value < BONDING_CURVE_TTL && bondingCurveRate.value > 0) {
      return
    }

    try {
      const rate = await apiService.getBondingCurveRate()
      bondingCurveRate.value = rate
      bondingCurveCache.value = Date.now()

      localStorage.setItem('bondingCurveRate', JSON.stringify({
        rate,
        timestamp: Date.now()
      }))

    } catch (err: any) {
      console.error('Failed to fetch bonding curve rate:', err)
      loadBondingCurveFromCache()
      throw err
    }
  }

  /**
   * Fetch supported tokens
   */
  const fetchSupportedTokens = async (): Promise<void> => {
    // Check cache first
    if (Date.now() - tokensCache.value < TOKENS_TTL && supportedTokens.value.length > 0) {
      return
    }

    try {
      // Mock supported tokens for now - would come from API
      const tokens: TokenConfig[] = [
        {
          symbol: 'ETH',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          name: 'Ethereum',
          isActive: true
        },
        {
          symbol: 'USDC',
          address: '0xA0b86a33E6417aAb8C23EA0b2e0a8f90EA41a98e',
          decimals: 6,
          name: 'USD Coin',
          isActive: true
        },
        {
          symbol: 'USDT',
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
          name: 'Tether USD',
          isActive: true
        }
      ]

      supportedTokens.value = tokens
      tokensCache.value = Date.now()

      localStorage.setItem('supportedTokens', JSON.stringify({
        tokens,
        timestamp: Date.now()
      }))

    } catch (err: any) {
      console.error('Failed to fetch supported tokens:', err)
      loadTokensFromCache()
      throw err
    }
  }

  /**
   * Refresh all protocol data
   */
  const refreshAllData = async (): Promise<void> => {
    try {
      await Promise.all([
        fetchProtocolStats(),
        fetchBondingCurveRate(),
        fetchSupportedTokens()
      ])
    } catch (err: any) {
      console.error('Failed to refresh all protocol data:', err)
      error.value = 'Failed to refresh protocol data'
    }
  }

  /**
   * Estimate XMBL output for given input
   */
  const estimateXMBLOutput = async (token: string, amount: string): Promise<string> => {
    try {
      // For now, use simple calculation based on bonding curve rate
      await fetchBondingCurveRate()

      const inputAmount = parseFloat(amount)
      const rate = bondingCurveRate.value

      if (rate === 0) {
        throw new Error('Bonding curve rate not available')
      }

      const output = inputAmount * rate
      return output.toString()

    } catch (err: any) {
      console.error('Failed to estimate XMBL output:', err)
      throw err
    }
  }

  /**
   * Get current token price
   */
  const getTokenPrice = async (symbol: string): Promise<number> => {
    try {
      const prices = await apiService.getTokenPrices([symbol])
      return prices[0]?.price || 0
    } catch (err: any) {
      console.error(`Failed to get price for ${symbol}:`, err)
      throw err
    }
  }

  /**
   * Subscribe to real-time updates
   */
  let ws: WebSocket | null = null
  const subscribeToUpdates = (): void => {
    // WebSocket implementation for real-time updates
    if (ws) return
    ws = new WebSocket('wss://example.com/protocol')
    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'protocol_stats_updated') {
          if (validateStats(msg.data)) {
            protocolStats.value = msg.data
            totalValueLocked.value = msg.data.totalValueLocked
            totalUsers.value = msg.data.totalUsers
            currentAPY.value = msg.data.averageAPY
            totalYieldDistributed.value = msg.data.totalYieldDistributed
            lastStatsUpdate.value = new Date()
          }
        } else if (msg.type === 'bonding_curve_updated') {
          bondingCurveRate.value = msg.data.rate
        } else if (msg.type === 'maintenance_mode_changed') {
          isMaintenanceMode.value = msg.data.isMaintenanceMode
        }
      } catch (err) {
        console.error('WebSocket message error:', err)
      }
    })
    ws.addEventListener('error', (err) => {
      console.error('WebSocket error:', err)
    })
  }

  /**
   * Unsubscribe from updates
   */
  const unsubscribeFromUpdates = (): void => {
    if (ws) {
      ws.close()
      ws = null
    }
  }

  // === HELPER METHODS ===

  /**
   * Load stats from localStorage cache
   */
  const loadStatsFromCache = (): void => {
    try {
      const cached = localStorage.getItem('protocolStats')
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < STATS_TTL * 2 && validateStats(data)) {
          protocolStats.value = data
          totalValueLocked.value = data.totalDeposits
          totalUsers.value = data.totalUsers
          currentAPY.value = data.averageAPY
          totalYieldDistributed.value = data.volume24h
        }
      }
    } catch (err) {
      console.error('Failed to load stats from cache:', err)
    }
  }

  /**
   * Load bonding curve from localStorage cache
   */
  const loadBondingCurveFromCache = (): void => {
    try {
      const cached = localStorage.getItem('bondingCurveRate')
      if (cached) {
        const { rate, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < BONDING_CURVE_TTL * 2) {
          bondingCurveRate.value = rate
        }
      }
    } catch (err) {
      console.error('Failed to load bonding curve from cache:', err)
    }
  }

  /**
   * Load tokens from localStorage cache
   */
  const loadTokensFromCache = (): void => {
    try {
      const cached = localStorage.getItem('supportedTokens')
      if (cached) {
        const { tokens, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < TOKENS_TTL * 2) {
          supportedTokens.value = tokens
        }
      }
    } catch (err) {
      console.error('Failed to load tokens from cache:', err)
    }
  }

  return {
    // State
    totalValueLocked,
    currentAPY,
    totalUsers,
    totalYieldDistributed,
    supportedTokens,
    bondingCurveRate,
    protocolStats,
    isMaintenanceMode,
    lastStatsUpdate,
    isLoading,
    error,

    // Getters
    formattedTVL,
    formattedAPY,
    getSupportedToken,
    isTokenSupported,
    protocolHealth,

    // Actions
    fetchProtocolStats,
    fetchBondingCurveRate,
    fetchSupportedTokens,
    refreshAllData,
    estimateXMBLOutput,
    getTokenPrice,
    subscribeToUpdates,
    unsubscribeFromUpdates
  }
})
