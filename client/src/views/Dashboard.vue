<template>
  <div class="dashboard" data-testid="dashboard">
    <!-- Dashboard Header -->
    <header class="dashboard-header" data-testid="dashboard-header">
      <div class="container">
        <div class="header-content">
          <h1 class="dashboard-title">XMBL Dashboard</h1>
          <div class="header-actions">
            <button @click="refreshAllData" class="refresh-btn" data-testid="refresh-all-button" :disabled="isRefreshing">
              <div v-if="isRefreshing" class="loading-spinner"></div>
              <span v-else>🔄</span>
              Refresh All
            </button>
            <WalletConnect @wallet-connected="handleWalletConnection" @wallet-disconnected="handleWalletDisconnection" />
          </div>
        </div>
      </div>
    </header>

    <!-- Main Dashboard Content -->
    <main class="dashboard-main" data-testid="dashboard-main">
      <div class="container">
        <!-- Wallet Connection Prompt -->
        <div v-if="!walletStore.isConnected" class="connection-prompt" data-testid="connection-prompt">
          <div class="prompt-content">
            <h2>Connect Your Wallet</h2>
            <p>Please connect your wallet to access your XMBL dashboard and start managing your investments.</p>
            <WalletConnect />
          </div>
        </div>

        <!-- Dashboard Content (when wallet connected) -->
        <div v-else class="dashboard-content" data-testid="dashboard-content">
          <!-- User Info Bar -->
          <div class="user-info-bar" data-testid="user-info-bar">
            <div class="user-address">
              <span class="label">Connected:</span>
              <span class="address" data-testid="user-address">{{ formatAddress(walletStore.account) }}</span>
            </div>
            <div class="network-info">
              <span class="label">Network:</span>
              <span class="network" data-testid="network-name">{{ (walletStore as any).network || 'Unknown' }}</span>
            </div>
            <div class="balance-info">
              <span class="label">ETH Balance:</span>
              <span class="balance" data-testid="eth-balance">{{ formatBalance(walletStore.balance) }} ETH</span>
            </div>
          </div>

          <!-- Main Layout -->
          <div class="main-layout">
            <!-- Left Column -->
            <div class="left-column">
              <!-- Deposit Section -->
              <section class="dashboard-section" data-testid="deposit-section">
                <h2 class="section-title">Deposit Tokens</h2>
                <DepositForm 
                  @deposit-completed="handleDepositCompleted"
                  @deposit-failed="handleDepositFailed" 
                />
              </section>

              <!-- Portfolio Section -->
              <section class="dashboard-section" data-testid="portfolio-section">
                <h2 class="section-title">Your Portfolio</h2>
                <XMBLPortfolio 
                  @yield-claimed="handleYieldClaimed"
                  @portfolio-updated="handlePortfolioUpdated"
                />
              </section>
            </div>

            <!-- Right Column -->
            <div class="right-column">
              <!-- Transaction History Section -->
              <section class="dashboard-section" data-testid="transactions-section">
                <h2 class="section-title">Transaction History</h2>
                <TransactionHistory 
                  :user-address="walletStore.account || undefined"
                  :auto-refresh="true"
                  @transaction-selected="handleTransactionSelected"
                />
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Loading Overlay -->
    <div v-if="isInitializing" class="loading-overlay" data-testid="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner large"></div>
        <p>Initializing dashboard...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-state" data-testid="error-state">
      <div class="error-content">
        <h3>Dashboard Error</h3>
        <p>{{ error }}</p>
        <button @click="retryInitialization" class="retry-btn">Try Again</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '../stores/wallet'
import { usePortfolioStore } from '../stores/portfolio'
import { useTransactionsStore } from '../stores/transactions'
import WalletConnect from '../components/WalletConnect.vue'
import DepositForm from '../components/DepositForm.vue'
import XMBLPortfolio from '../components/XMBLPortfolio.vue'
import TransactionHistory from '../components/TransactionHistory.vue'

interface Transaction {
  id: string
  hash: string
  type: string
  amount: string
  token: string
  status: string
  timestamp: Date
}

const router = useRouter()

// Stores
const walletStore = useWalletStore()
const portfolioStore = usePortfolioStore()
const transactionsStore = useTransactionsStore()

// Reactive state
const isInitializing = ref(false)
const isRefreshing = ref(false)
const error = ref<string | null>(null)
const lastRefresh = ref<Date | null>(null)

// Auto-refresh timer
let refreshTimer: NodeJS.Timeout | null = null

// Computed properties
const isWalletConnected = computed(() => walletStore.isConnected)

// Methods
const initializeDashboard = async (): Promise<void> => {
  if (!walletStore.isConnected) return

  isInitializing.value = true
  error.value = null

  try {
    // Initialize all stores with user data
    await Promise.all([
      portfolioStore.fetchPortfolioData(walletStore.account || ''),
      transactionsStore.fetchTransactionHistory(walletStore.account || '')
    ])
  } catch (err: any) {
    console.error('Failed to initialize dashboard:', err)
    error.value = err.message || 'Failed to load dashboard data'
  } finally {
    isInitializing.value = false
  }
}

const refreshAllData = async (): Promise<void> => {
  if (!walletStore.isConnected || isRefreshing.value) return

  isRefreshing.value = true
  error.value = null

  try {
    await Promise.all([
      (walletStore as any).refreshBalance?.() || Promise.resolve(),
      portfolioStore.fetchPortfolioData(walletStore.account || ''),
      transactionsStore.fetchTransactionHistory(walletStore.account || '')
    ])
    lastRefresh.value = new Date()
  } catch (err: any) {
    console.error('Failed to refresh dashboard data:', err)
    error.value = err.message || 'Failed to refresh data'
  } finally {
    isRefreshing.value = false
  }
}

const handleWalletConnection = async (address: string) => {
  console.log('Wallet connected:', address)
  await initializeDashboard()
  startAutoRefresh()
}

const handleWalletDisconnection = () => {
  console.log('Wallet disconnected')
  // Clear all user data
  portfolioStore.$reset()
  transactionsStore.$reset()
  stopAutoRefresh()
  error.value = null
}

const handleDepositCompleted = async (depositData: any) => {
  console.log('Deposit completed:', depositData)
  // Refresh portfolio and transaction data
  await Promise.all([
    portfolioStore.fetchPortfolioData(walletStore.account || ''),
    transactionsStore.fetchTransactionHistory(walletStore.account || '')
  ])
}

const handleDepositFailed = (error: any) => {
  console.error('Deposit failed:', error)
  // Could show a toast notification here
}

const handleYieldClaimed = async (yieldData: any) => {
  console.log('Yield claimed:', yieldData)
  // Refresh portfolio data
  await portfolioStore.fetchPortfolioData(walletStore.account || '')
}

const handlePortfolioUpdated = (portfolioData: any) => {
  console.log('Portfolio updated:', portfolioData)
}

const handleTransactionSelected = (transaction: Transaction) => {
  console.log('Transaction selected:', transaction)
  // Could show transaction details modal or navigate to details view
}

const retryInitialization = async () => {
  await initializeDashboard()
}

const formatAddress = (address: string | null): string => {
  if (!address) return ''
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

const formatBalance = (balance: string | null): string => {
  if (!balance) return '0.0000'
  const num = parseFloat(balance)
  return num.toFixed(4)
}

const startAutoRefresh = () => {
  // Refresh data every 30 seconds
  refreshTimer = setInterval(async () => {
    if (walletStore.isConnected && !isRefreshing.value) {
      await refreshAllData()
    }
  }, 30000)
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
    await initializeDashboard()
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Header */
.dashboard-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 20px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #3182ce;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #2c5aa0;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Main Content */
.dashboard-main {
  padding: 32px 0;
}

/* Connection Prompt */
.connection-prompt {
  text-align: center;
  padding: 80px 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  margin: 0 auto;
}

.prompt-content h2 {
  font-size: 2rem;
  margin-bottom: 16px;
  color: #2d3748;
}

.prompt-content p {
  font-size: 1.125rem;
  color: #718096;
  margin-bottom: 32px;
  line-height: 1.6;
}

/* User Info Bar */
.user-info-bar {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px 24px;
  margin-bottom: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.user-info-bar .label {
  font-size: 14px;
  color: #718096;
  margin-right: 8px;
}

.user-info-bar .address,
.user-info-bar .network,
.user-info-bar .balance {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 14px;
  color: #2d3748;
  font-weight: 600;
}

/* Main Layout */
.main-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 32px;
  align-items: start;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Dashboard Sections */
.dashboard-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 24px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

/* Loading States */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  background: white;
  padding: 48px;
  border-radius: 12px;
  text-align: center;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top: 2px solid #3182ce;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
}

.loading-spinner.large {
  width: 40px;
  height: 40px;
  border-width: 3px;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Error State */
.error-state {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #fed7d7;
  border: 1px solid #fc8181;
  border-radius: 8px;
  padding: 16px;
  max-width: 400px;
  z-index: 1000;
}

.error-content h3 {
  color: #742a2a;
  margin: 0 0 8px 0;
  font-size: 1rem;
}

.error-content p {
  color: #742a2a;
  margin: 0 0 16px 0;
  font-size: 14px;
}

.retry-btn {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

/* Mobile Responsive */
@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  
  .user-info-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .container {
    padding: 0 16px;
  }
  
  .dashboard-main {
    padding: 24px 0;
  }
  
  .dashboard-section {
    padding: 16px;
  }
  
  .user-info-bar {
    padding: 16px;
  }
}
</style>
