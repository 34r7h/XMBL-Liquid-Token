<template>
  <div class="xmbl-portfolio" data-testid="xmbl-portfolio">
    <!-- Portfolio Header -->
    <div class="portfolio-header">
      <h2>XMBL Portfolio</h2>
      <button @click="refreshPortfolioData" class="refresh-btn" data-testid="refresh-button" :disabled="isLoading">
        <svg v-if="!isLoading" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M23 4v6h-6M1 20v-6h6M20.49 9a9 9 0 11-2.12-5.36l2.63-2.63" stroke="currentColor" stroke-width="2" />
        </svg>
        <div v-else class="loading-spinner"></div>
        Refresh
      </button>
    </div>

    <!-- Wallet Connection Prompt -->
    <div v-if="!walletStore.isConnected" class="connect-wallet-prompt" data-testid="connect-wallet-prompt">
      <div class="prompt-content">
        <h3>Connect Your Wallet</h3>
        <p>Please connect your wallet to view your XMBL portfolio</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="isLoading" class="loading-state" data-testid="loading-state">
      <div class="loading-spinner large"></div>
      <p>Loading portfolio...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state" data-testid="error-state">
      <div class="error-icon">❌</div>
      <h3>Failed to Load Portfolio</h3>
      <p>{{ error }}</p>
      <button @click="refreshPortfolioData" class="retry-btn">Try Again</button>
    </div>

    <!-- Portfolio Content -->
    <div v-else class="portfolio-content">
      <!-- Portfolio Summary -->
      <div class="portfolio-summary" data-testid="portfolio-summary">
        <div class="summary-card">
          <h3>Total NFTs</h3>
          <div class="value" data-testid="total-nfts">{{ portfolioStore.totalNFTCount }}</div>
        </div>
        <div class="summary-card">
          <h3>Total Value</h3>
          <div class="value" data-testid="total-value">${{ formatNumber(portfolioStore.totalPortfolioValue) }}</div>
        </div>
        <div class="summary-card">
          <h3>Total Yields</h3>
          <div class="value" data-testid="total-yields">${{ portfolioStore.formattedTotalYields }}</div>
        </div>
        <div class="summary-card">
          <h3>Average APY</h3>
          <div class="value" data-testid="average-apy">{{ formatPercent(12.5) }}%</div>
        </div>
      </div>

      <!-- Yield Actions -->
      <div class="yield-actions" data-testid="yield-actions">
        <button @click="claimAllYields" class="claim-all-btn" data-testid="claim-all-button"
          :disabled="!hasClaimableYields || isProcessing">
          <div v-if="isProcessing" class="loading-spinner"></div>
          <span v-if="isProcessing">Processing...</span>
          <span v-else>Claim All Yields ({{ totalClaimableYields }})</span>
        </button>
      </div>

      <!-- NFT Grid -->
      <div class="nft-grid" data-testid="nft-grid">
        <div v-for="nft in portfolioStore.xmblNFTs" :key="nft.tokenId" class="nft-card"
          :class="{ selected: selectedNFT?.tokenId === nft.tokenId }" :data-testid="`nft-card-${nft.tokenId}`"
          @click="selectNFT(nft.tokenId)">
          <!-- NFT Header -->
          <div class="nft-header">
            <div class="nft-id">XMBL #{{ nft.tokenId }}</div>
            <div class="nft-status active">active</div>
          </div>

          <!-- NFT Image -->
          <div class="nft-image">
            <img v-if="nft.metadata?.image" :src="nft.metadata.image" :alt="`XMBL NFT #${nft.tokenId}`" />
            <div v-else class="placeholder-image">
              <span>NFT #{{ nft.tokenId }}</span>
            </div>
          </div>

          <!-- NFT Info -->
          <div class="nft-info">
            <div class="info-row">
              <span class="label">Deposit Value:</span>
              <span class="value" data-testid="nft-deposit-value">${{ formatNumber(nft.depositedAmount || '0') }}</span>
            </div>
            <div class="info-row">
              <span class="label">TBA Balance:</span>
              <span class="value" data-testid="nft-tba-balance">${{ formatNumber(nft.balance) }}</span>
            </div>
            <div class="info-row">
              <span class="label">Yield Earned:</span>
              <span class="value" data-testid="nft-yield-earned">${{ formatNumber(nft.yieldEarned) }}</span>
            </div>
            <div class="info-row">
              <span class="label">Current APY:</span>
              <span class="value" data-testid="nft-apy">{{ formatPercent(nft.apy || 0) }}%</span>
            </div>
          </div>

          <!-- NFT Actions -->
          <div class="nft-actions">
            <button @click.stop="claimYields(nft.tokenId)" class="claim-btn"
              :data-testid="`claim-button-${nft.tokenId}`"
              :disabled="parseFloat(nft.yieldEarned || '0') <= 0 || isProcessingNFT === nft.tokenId">
              <div v-if="isProcessingNFT === nft.tokenId" class="loading-spinner small"></div>
              <span v-else>Claim ({{ formatNumber(nft.yieldEarned || '0') }})</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="portfolioStore.xmblNFTs.length === 0" class="empty-state" data-testid="empty-state">
        <div class="empty-icon">📄</div>
        <h3>No XMBL NFTs Found</h3>
        <p>You don't have any XMBL NFTs yet. Start by making a deposit to create your first NFT.</p>
      </div>

      <!-- Selected NFT Details -->
      <div v-if="selectedNFT" class="nft-details" data-testid="nft-details">
        <div class="details-header">
          <h3>XMBL NFT #{{ selectedNFT.tokenId }} Details</h3>
          <button @click="clearSelection" class="close-btn" data-testid="close-details">×</button>
        </div>

        <div class="details-content">
          <!-- TBA Information -->
          <div class="tba-section">
            <h4>Token Bound Account</h4>
            <div class="tba-address" data-testid="tba-address">
              <span class="label">TBA Address:</span>
              <span class="address">{{ selectedNFT.tbaAddress }}</span>
              <button @click="copyToClipboard(selectedNFT.tbaAddress)" class="copy-btn">📋</button>
            </div>
            <div class="tba-balance-breakdown" data-testid="tba-balance-breakdown">
              <h5>TBA Balance:</h5>
              <div class="asset-row">
                <span class="asset-symbol">Total</span>
                <span class="asset-balance">{{ formatNumber(selectedNFT.balance) }}</span>
                <span class="asset-value">${{ formatNumber(selectedNFT.usdValue || 0) }}</span>
              </div>
            </div>
          </div>

          <!-- Yield Information -->
          <div class="yield-section">
            <h4>Yield Information</h4>
            <div class="yield-sources" data-testid="yield-sources">
              <div class="source-row">
                <span class="protocol">Current Yield</span>
                <span class="allocation">100%</span>
                <span class="apy">{{ formatPercent(selectedNFT.apy || 0) }}% APY</span>
              </div>
            </div>
          </div>

          <!-- Performance Chart -->
          <div class="performance-section">
            <h4>Performance History</h4>
            <div class="chart-container" data-testid="performance-chart">
              <!-- Simple performance indicator -->
              <div class="performance-summary">
                <div class="perf-item">
                  <span class="label">Total Deposited:</span>
                  <span class="value">${{ formatNumber(selectedNFT.depositedAmount || '0') }}</span>
                </div>
                <div class="perf-item">
                  <span class="label">Current Value:</span>
                  <span class="value">${{ formatNumber(selectedNFT.usdValue || 0) }}</span>
                </div>
                <div class="perf-item">
                  <span class="label">Total Yield:</span>
                  <span class="value positive">${{ formatNumber(selectedNFT.yieldEarned) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Transaction Status -->
    <div v-if="transactionStatus" class="transaction-status" data-testid="transaction-status">
      <div v-if="transactionStatus.type === 'success'" class="success-message" data-testid="success-message">
        <div class="success-icon">✅</div>
        <div>
          <h4>Yield Claimed Successfully!</h4>
          <p>{{ transactionStatus.message }}</p>
          <div class="transaction-hash" data-testid="transaction-hash">
            Transaction: {{ transactionStatus.transactionHash }}
          </div>
        </div>
      </div>

      <div v-else-if="transactionStatus.type === 'error'" class="error-message" data-testid="error-message">
        <div class="error-icon">❌</div>
        <div>
          <h4>Transaction Failed</h4>
          <p>{{ transactionStatus.message }}</p>
          <button @click="retryTransaction" class="retry-button" data-testid="retry-button">
            Try Again
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { useWalletStore } from '../stores/wallet'
import { web3Service } from '../services/web3Service'

// Interfaces - using the actual store interface
interface NFTPortfolioData {
  tokenId: number
  tbaAddress: string
  balance: string
  depositedAmount?: string
  yieldEarned: string
  metadata?: {
    name: string
    image: string
  }
  lastYieldClaim?: Date
  apy?: number
  usdValue?: number
}

// Emits
const emit = defineEmits<{
  'yield-claimed': [amount: string, txHash: string]
  'yield-claim-failed': [error: string]
  'portfolio-updated': [newBalance: string]
}>()

// Stores
const portfolioStore = usePortfolioStore()
const walletStore = useWalletStore()

// Reactive state
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedNFT = ref<NFTPortfolioData | null>(null)
const isProcessing = ref(false)
const isProcessingNFT = ref<number | null>(null)
const transactionStatus = ref<{
  type: 'success' | 'error'
  message: string
  transactionHash?: string
} | null>(null)

// Auto-refresh timer
let refreshTimer: NodeJS.Timeout | null = null

// Computed properties
const hasClaimableYields = computed(() => {
  return portfolioStore.xmblNFTs.some((nft: any) => parseFloat(nft.yieldEarned || '0') > 0)
})

const totalClaimableYields = computed(() => {
  const total = portfolioStore.xmblNFTs.reduce((sum: number, nft: any) => {
    return sum + parseFloat(nft.yieldEarned || '0')
  }, 0)
  return formatNumber(total.toString())
})

// Methods
const formatNumber = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'

  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K'
  } else {
    return num.toLocaleString()
  }
}

const formatPercent = (value: number): string => {
  return value.toFixed(2)
}

const selectNFT = (tokenId: number) => {
  const nft = portfolioStore.xmblNFTs.find((n: any) => n.tokenId === tokenId)
  if (nft) {
    selectedNFT.value = nft as NFTPortfolioData
  }
}

const clearSelection = () => {
  selectedNFT.value = null
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // Could show a toast notification here
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const refreshPortfolioData = async () => {
  if (!walletStore.isConnected) return

  isLoading.value = true
  error.value = null

  try {
    await portfolioStore.fetchPortfolioData(walletStore.account || '')
    emit('portfolio-updated', portfolioStore.totalPortfolioValue)
  } catch (err: any) {
    console.error('Failed to refresh portfolio:', err)
    error.value = err.message || 'Failed to load portfolio data'
  } finally {
    isLoading.value = false
  }
}

const claimYields = async (tokenId: number) => {
  if (isProcessingNFT.value || !walletStore.isConnected) return

  isProcessingNFT.value = tokenId
  transactionStatus.value = null

  try {
    const nft = portfolioStore.xmblNFTs.find((n: any) => n.tokenId === tokenId)
    if (!nft) throw new Error('NFT not found')

    const result = await portfolioStore.claimYields(tokenId)

    transactionStatus.value = {
      type: 'success',
      message: `Successfully claimed ${formatNumber(nft.yieldEarned)} in yields for NFT #${tokenId}`,
      transactionHash: result
    }

    emit('yield-claimed', nft.yieldEarned, result)

    // Refresh portfolio data
    await refreshPortfolioData()

  } catch (err: any) {
    console.error('Yield claim failed:', err)
    transactionStatus.value = {
      type: 'error',
      message: err.message || 'Failed to claim yields'
    }
    emit('yield-claim-failed', err.message)
  } finally {
    isProcessingNFT.value = null
  }
}

const claimAllYields = async () => {
  if (isProcessing.value || !walletStore.isConnected || !hasClaimableYields.value) return

  isProcessing.value = true
  transactionStatus.value = null

  try {
    const claimableNFTs = portfolioStore.xmblNFTs.filter((nft: any) => parseFloat(nft.yieldEarned || '0') > 0)
    const results = await portfolioStore.claimAllYields()

    const totalClaimed = claimableNFTs.reduce((sum: number, nft: any) => {
      return sum + parseFloat(nft.yieldEarned || '0')
    }, 0)

    transactionStatus.value = {
      type: 'success',
      message: `Successfully claimed ${formatNumber(totalClaimed.toString())} in yields across ${claimableNFTs.length} NFTs`,
      transactionHash: results[0] || ''
    }

    emit('yield-claimed', totalClaimed.toString(), results[0] || '')

    // Refresh portfolio data
    await refreshPortfolioData()

  } catch (err: any) {
    console.error('Batch yield claim failed:', err)
    transactionStatus.value = {
      type: 'error',
      message: err.message || 'Failed to claim yields'
    }
    emit('yield-claim-failed', err.message)
  } finally {
    isProcessing.value = false
  }
}

const retryTransaction = () => {
  transactionStatus.value = null
  if (selectedNFT.value) {
    claimYields(selectedNFT.value.tokenId)
  }
}

const startAutoRefresh = () => {
  refreshTimer = setInterval(() => {
    if (walletStore.isConnected && !isLoading.value) {
      refreshPortfolioData()
    }
  }, 30000) // Refresh every 30 seconds
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// Lifecycle
onMounted(async () => {
  if (walletStore.isConnected) {
    await refreshPortfolioData()
  }
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.xmbl-portfolio {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

/* Portfolio Header */
.portfolio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.portfolio-header h2 {
  margin: 0;
  color: #2d3748;
  font-size: 28px;
  font-weight: 700;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #3182ce;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #2c5aa0;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Connect Wallet Prompt */
.connect-wallet-prompt {
  text-align: center;
  padding: 48px 24px;
  background: #f0f8ff;
  border: 1px solid #3182ce;
  border-radius: 12px;
  margin-bottom: 24px;
}

.prompt-content h3 {
  margin: 0 0 12px 0;
  color: #2d3748;
}

/* Loading and Error States */
.loading-state,
.error-state {
  text-align: center;
  padding: 48px 24px;
}

.loading-state {
  background: #f7fafc;
  border-radius: 12px;
}

.error-state {
  background: #fff5f5;
  border: 1px solid #fc8181;
  border-radius: 12px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.retry-btn {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 16px;
}

/* Portfolio Summary */
.portfolio-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.summary-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.summary-card h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-card .value {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
}

/* Yield Actions */
.yield-actions {
  margin-bottom: 32px;
  text-align: center;
}

.claim-all-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.claim-all-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.claim-all-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* NFT Grid */
.nft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.nft-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.nft-card:hover {
  border-color: #3182ce;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.nft-card.selected {
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
}

.nft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.nft-id {
  font-weight: 700;
  font-size: 18px;
  color: #2d3748;
}

.nft-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.nft-status.active {
  background: #c6f6d5;
  color: #22543d;
}

.nft-image {
  margin-bottom: 16px;
  text-align: center;
}

.nft-image img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
}

.placeholder-image {
  width: 100%;
  height: 150px;
  background: #f7fafc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #718096;
  font-weight: 600;
}

.nft-info {
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.info-row .label {
  font-size: 14px;
  color: #718096;
}

.info-row .value {
  font-weight: 600;
  color: #2d3748;
}

.nft-actions {
  text-align: center;
}

.claim-btn {
  width: 100%;
  background: #48bb78;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.claim-btn:hover:not(:disabled) {
  background: #38a169;
}

.claim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: #f7fafc;
  border-radius: 12px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* NFT Details */
.nft-details {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.details-header h3 {
  margin: 0;
  color: #2d3748;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #718096;
  padding: 4px;
}

.details-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.tba-section,
.yield-section,
.performance-section {
  background: #f7fafc;
  border-radius: 12px;
  padding: 20px;
}

.tba-section h4,
.yield-section h4,
.performance-section h4 {
  margin: 0 0 16px 0;
  color: #2d3748;
}

.tba-address {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.tba-address .address {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  background: #edf2f7;
  padding: 4px 8px;
  border-radius: 4px;
  flex: 1;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
}

.asset-row,
.source-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 8px;
  background: white;
  border-radius: 6px;
}

.performance-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.perf-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: white;
  border-radius: 6px;
}

.perf-item .value.positive {
  color: #38a169;
}

.perf-item .value.negative {
  color: #e53e3e;
}

/* Transaction Status */
.transaction-status {
  border-radius: 12px;
  padding: 16px;
  margin-top: 24px;
}

.success-message {
  background: #f0fff4;
  border: 1px solid #9ae6b4;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-message {
  background: #fff5f5;
  border: 1px solid #fc8181;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.success-icon,
.error-icon {
  font-size: 20px;
  margin-top: 2px;
}

.transaction-hash {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #718096;
  margin-top: 8px;
  word-break: break-all;
}

.retry-button {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 12px;
}

/* Loading Spinner */
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.large {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.loading-spinner.small {
  width: 12px;
  height: 12px;
  border-width: 1px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .xmbl-portfolio {
    padding: 16px;
  }

  .portfolio-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .portfolio-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .nft-grid {
    grid-template-columns: 1fr;
  }

  .details-content {
    grid-template-columns: 1fr;
  }
}
</style>
