<template>
  <div class="wallet-connect">
    <!-- Wallet Connection Modal -->
    <div v-if="!walletStore.isConnected" class="wallet-connect-modal" data-testid="wallet-connect-modal" role="dialog"
      aria-label="Connect your wallet">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Connect Wallet</h2>
          <button class="close-button" data-testid="close-modal" @click="$emit('close')" aria-label="Close modal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>
        </div>

        <!-- Security Warning -->
        <div class="security-warning" data-testid="security-warning">
          <div class="warning-icon">⚠️</div>
          <div data-testid="phishing-warning">
            Always verify you are on the correct website before connecting your wallet
          </div>
        </div>

        <!-- Connection Error Display -->
        <div v-if="walletStore.error" class="connection-error" data-testid="connection-error">
          <div v-if="walletStore.error.includes('rejected')" class="user-rejected" data-testid="user-rejected">
            <div data-testid="rejection-message">Connection was cancelled</div>
          </div>
          <div v-else-if="walletStore.error.includes('Network')" class="network-error" data-testid="network-error">
            <div data-testid="network-error-message">Network connection issue</div>
          </div>
          <div v-else>
            <div data-testid="error-message">{{ walletStore.error }}</div>
          </div>
          <button class="retry-button" data-testid="retry-connection" @click="retryConnection">
            Try Again
          </button>
        </div>

        <!-- Connecting State -->
        <div v-if="walletStore.isConnecting" class="connecting-state" data-testid="connecting-spinner">
          <div class="spinner"></div>
          <div data-testid="connecting-message">
            {{ connectingMessage }}
          </div>
        </div>

        <!-- Wallet Selection -->
        <div v-else class="wallet-selection" data-testid="wallet-selection">
          <div class="wallet-grid" :class="{ mobile: isMobile }" data-testid="wallet-grid">
            <div v-for="wallet in supportedWallets" :key="wallet.id" class="wallet-option" :class="{
              disabled: !wallet.available,
              'not-installed': !wallet.installed
            }" :data-testid="`wallet-option-${wallet.id}`" :disabled="!wallet.available" tabindex="0"
              @click="connectToWallet(wallet.id)" @keydown.enter="connectToWallet(wallet.id)">
              <img :src="wallet.icon" :alt="`${wallet.name} icon`" class="wallet-icon" />
              <div class="wallet-info">
                <div class="wallet-name" data-testid="wallet-name">
                  {{ wallet.name }}
                </div>
                <div v-if="wallet.installed" class="installed-badge" data-testid="installed-badge">
                  Installed
                </div>
                <div v-else class="install-prompt" data-testid="install-prompt">
                  <a :href="getInstallLink(wallet.id)" target="_blank" rel="noopener noreferrer"
                    data-testid="install-link" @click.stop>
                    Install {{ wallet.name }}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Screen Reader Announcements -->
        <div class="sr-only" data-testid="sr-announcement" aria-live="assertive">
          {{ screenReaderMessage }}
        </div>
      </div>
    </div>

    <!-- Connected Wallet Display -->
    <div v-else class="connected-wallet" data-testid="connected-wallet">
      <div class="wallet-info-bar">
        <!-- Wallet Avatar and Address -->
        <div class="wallet-identity">
          <div class="wallet-avatar" data-testid="wallet-avatar">
            <div class="avatar-circle">
              {{ walletStore.shortAddress.slice(0, 2) }}
            </div>
          </div>
          <div class="wallet-details">
            <div class="wallet-address" data-testid="wallet-address">
              {{ walletStore.shortAddress }}
              <button class="copy-button" data-testid="copy-address" @click="copyAddress"
                :title="copySuccess ? 'Copied!' : 'Copy address'">
                <svg v-if="!copySuccess" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
                    stroke="currentColor" stroke-width="2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" stroke-width="2" />
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="2" />
                </svg>
              </button>
              <div v-if="copySuccess" class="copy-success" data-testid="copy-success">
                Copied!
              </div>
            </div>
            <div class="wallet-balance" data-testid="wallet-balance">
              {{ walletStore.formattedBalance }}
            </div>
          </div>
        </div>

        <!-- Network Indicator -->
        <div class="network-section">
          <div v-if="walletStore.isValidNetwork" class="network-indicator" data-testid="network-indicator">
            <div class="network-status connected">●</div>
            <div class="network-name" data-testid="network-name">
              {{ walletStore.networkName }}
            </div>
          </div>
          <div v-else class="unsupported-network" data-testid="unsupported-network">
            <div class="network-warning" data-testid="network-warning">
              Unsupported network
            </div>
            <button class="switch-network-button" data-testid="switch-network" @click="switchToMainnet">
              Switch to Ethereum
            </button>
          </div>
        </div>

        <!-- Wallet Menu -->
        <div class="wallet-menu-container">
          <button class="wallet-menu-button" data-testid="wallet-menu" @click="toggleWalletMenu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="1" stroke="currentColor" stroke-width="2" />
              <circle cx="19" cy="12" r="1" stroke="currentColor" stroke-width="2" />
              <circle cx="5" cy="12" r="1" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>

          <div v-if="showWalletMenu" class="wallet-dropdown" data-testid="wallet-dropdown">
            <button class="dropdown-item" data-testid="view-on-explorer" @click="viewOnExplorer">
              View on Explorer
            </button>
            <button class="dropdown-item" data-testid="add-token" @click="addXMBLToken">
              Add XMBL Token
            </button>
            <button class="dropdown-item" data-testid="manage-permissions" @click="showPermissionsModal = true">
              Manage Permissions
            </button>
            <hr class="dropdown-divider" />
            <button class="dropdown-item disconnect" data-testid="disconnect-wallet" @click="disconnect">
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <!-- Network Switching Loading -->
      <div v-if="isSwitchingNetwork" class="switching-network" data-testid="switching-network">
        <div class="spinner small"></div>
        <div data-testid="switching-message">Switching network...</div>
      </div>

      <!-- Connection Security Info -->
      <div class="connection-security" data-testid="connection-security">
        <div class="security-indicator">🔒</div>
        <div>Secure connection established</div>
      </div>

      <!-- Permissions Indicator -->
      <div v-if="permissions.length > 0" class="permissions-indicator" data-testid="permissions-indicator">
        <div class="permissions-list" data-testid="permissions-list">
          Account access
        </div>
      </div>
    </div>

    <!-- Network Dropdown -->
    <div v-if="showNetworkDropdown" class="network-dropdown" data-testid="network-dropdown">
      <div class="network-option" data-testid="network-ethereum" @click="switchToNetwork(1)">
        <div class="network-icon">Ξ</div>
        <div>Ethereum Mainnet</div>
      </div>
      <div class="network-option" data-testid="network-polygon" @click="switchToNetwork(137)">
        <div class="network-icon">⬟</div>
        <div>Polygon</div>
      </div>
      <div class="network-option" data-testid="network-arbitrum" @click="switchToNetwork(42161)">
        <div class="network-icon">🔹</div>
        <div>Arbitrum</div>
      </div>
    </div>

    <!-- QR Code Modal for WalletConnect -->
    <div v-if="showQRModal" class="qr-modal" data-testid="qr-code-modal">
      <div class="qr-content">
        <h3>Scan with WalletConnect</h3>
        <div class="qr-code" data-testid="qr-code">
          <!-- QR code would be generated here -->
          <div class="qr-placeholder">QR Code</div>
        </div>
        <button @click="showQRModal = false">Close</button>
      </div>
    </div>

    <!-- Permissions Modal -->
    <div v-if="showPermissionsModal" class="permissions-modal" data-testid="permissions-modal">
      <div class="modal-content">
        <h3>Wallet Permissions</h3>
        <div class="permissions-list">
          <div v-for="permission in permissions" :key="permission">
            {{ permission }}
          </div>
        </div>
        <button @click="showPermissionsModal = false">Close</button>
      </div>
    </div>

    <!-- Connection Status for Screen Readers -->
    <div class="sr-only" data-testid="connection-status" aria-live="polite">
      {{ connectionStatusMessage }}
    </div>

    <!-- Mobile Wallet Connect Container -->
    <div v-if="isMobile && !walletStore.isConnected" class="mobile-wallet-connect" data-testid="mobile-wallet-connect">
      <!-- Mobile-specific layout -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useWalletStore } from '../stores/wallet'

// Emits
const emit = defineEmits<{
  'wallet-connected': [address: string]
  'wallet-disconnected': []
  'network-changed': [chainId: number]
  'close': []
}>()

// Store
const walletStore = useWalletStore()

// Reactive state
const showWalletMenu = ref(false)
const showNetworkDropdown = ref(false)
const showQRModal = ref(false)
const showPermissionsModal = ref(false)
const copySuccess = ref(false)
const isSwitchingNetwork = ref(false)
const connectingWallet = ref<string | null>(null)
const permissions = ref<string[]>(['eth_accounts', 'personal_sign'])

// Mobile detection
const isMobile = ref(false)

// Supported wallets configuration
const supportedWallets = ref([
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '/metamask-icon.png',
    available: true,
    installed: true
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: '/walletconnect-icon.png',
    available: true,
    installed: false
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '/coinbase-icon.png',
    available: true,
    installed: false
  }
])

// Computed properties
const connectingMessage = computed(() => {
  if (connectingWallet.value) {
    const wallet = supportedWallets.value.find(w => w.id === connectingWallet.value)
    return `Connecting to ${wallet?.name}...`
  }
  return 'Connecting to wallet...'
})

const screenReaderMessage = computed(() => {
  if (walletStore.isConnecting) {
    return 'Connecting to wallet'
  }
  if (walletStore.error) {
    return `Connection error: ${walletStore.error}`
  }
  return ''
})

const connectionStatusMessage = computed(() => {
  if (walletStore.isConnected) {
    return 'Wallet connected successfully'
  }
  return ''
})

// Methods
const detectMobile = () => {
  isMobile.value = window.innerWidth <= 768 || /Mobile|Android/i.test(navigator.userAgent)
}

const connectToWallet = async (walletId: string) => {
  if (walletStore.isConnecting) return

  const wallet = supportedWallets.value.find(w => w.id === walletId)
  if (!wallet?.available) return

  walletStore.error = null
  connectingWallet.value = walletId

  try {
    if (walletId === 'walletconnect' && !isMobile.value) {
      showQRModal.value = true
    }

    const address = await walletStore.connectWallet()

    emit('wallet-connected', address)
    showQRModal.value = false
  } catch (error: any) {
    console.error('Connection failed:', error)
    walletStore.error = error.message
  } finally {
    connectingWallet.value = null
  }
}

const retryConnection = () => {
  walletStore.error = null
  if (connectingWallet.value) {
    connectToWallet(connectingWallet.value)
  }
}

const disconnect = () => {
  walletStore.disconnectWallet()
  showWalletMenu.value = false
  emit('wallet-disconnected')
}

const copyAddress = async () => {
  if (!walletStore.account) return

  try {
    await navigator.clipboard.writeText(walletStore.account)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy address:', error)
  }
}

const toggleWalletMenu = () => {
  showWalletMenu.value = !showWalletMenu.value
}

const switchToMainnet = async () => {
  await switchToNetwork(1)
}

const switchToNetwork = async (chainId: number) => {
  isSwitchingNetwork.value = true
  try {
    await walletStore.switchNetwork(chainId)
    emit('network-changed', chainId)
    showNetworkDropdown.value = false
  } catch (error) {
    console.error('Network switch failed:', error)
  } finally {
    isSwitchingNetwork.value = false
  }
}

const viewOnExplorer = () => {
  if (!walletStore.account) return

  const baseUrl = walletStore.chainId === 1
    ? 'https://etherscan.io'
    : 'https://goerli.etherscan.io'

  window.open(`${baseUrl}/address/${walletStore.account}`, '_blank')
  showWalletMenu.value = false
}

const addXMBLToken = async () => {
  try {
    // This would need to be implemented in the wallet store
    // For now, just show a message or use web3 directly
    console.log('Add XMBL token functionality would be implemented here')
    showWalletMenu.value = false
  } catch (error) {
    console.error('Failed to add token:', error)
  }
}

const getInstallLink = (walletId: string) => {
  const links = {
    metamask: 'https://metamask.io/download/',
    walletconnect: 'https://walletconnect.com/',
    coinbase: 'https://www.coinbase.com/wallet'
  }
  return links[walletId as keyof typeof links] || '#'
}

// Event listeners
const handleAccountsChanged = (event: Event) => {
  const customEvent = event as CustomEvent<string[]>
  const accounts = customEvent.detail
  if (accounts.length === 0) {
    disconnect()
  } else if (accounts[0] !== walletStore.account) {
    emit('wallet-connected', accounts[0])
  }
}

const handleChainChanged = (event: Event) => {
  const customEvent = event as CustomEvent<string>
  const chainId = parseInt(customEvent.detail, 16)
  emit('network-changed', chainId)
}

const handleClickOutside = (event: Event) => {
  const target = event.target as Element
  if (!target.closest('.wallet-menu-container')) {
    showWalletMenu.value = false
  }
  if (!target.closest('.network-dropdown')) {
    showNetworkDropdown.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    showWalletMenu.value = false
    showNetworkDropdown.value = false
    showQRModal.value = false
    showPermissionsModal.value = false
  }
}

const handleResize = () => {
  detectMobile()
}

// Lifecycle
onMounted(() => {
  detectMobile()
  window.addEventListener('resize', handleResize)
  window.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', handleKeydown)

  // Set up wallet event listeners for custom events
  window.addEventListener('accountsChanged', handleAccountsChanged)
  window.addEventListener('chainChanged', handleChainChanged)

  // Initialize wallet if previously connected
  walletStore.initializeProvider()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('accountsChanged', handleAccountsChanged)
  window.removeEventListener('chainChanged', handleChainChanged)
})

// Watch for connection state changes
watch(() => walletStore.isConnected, (isConnected) => {
  if (isConnected && walletStore.account) {
    emit('wallet-connected', walletStore.account)
  }
})

watch(() => walletStore.chainId, (chainId) => {
  if (chainId) {
    emit('network-changed', chainId)
  }
})
</script>

<style scoped>
.wallet-connect {
  position: relative;
}

/* Modal Styles */
.wallet-connect-modal {
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

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: #f5f5f5;
}

/* Security Warning */
.security-warning {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 14px;
}

.warning-icon {
  font-size: 20px;
}

/* Error States */
.connection-error {
  padding: 16px;
  background: #fff5f5;
  border: 1px solid #fc8181;
  border-radius: 8px;
  margin-bottom: 24px;
}

.retry-button {
  background: #3182ce;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 12px;
}

/* Connecting State */
.connecting-state {
  text-align: center;
  padding: 32px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3182ce;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

.spinner.small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* Wallet Selection */
.wallet-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.wallet-grid.mobile {
  grid-template-columns: 1fr;
}

.wallet-option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.wallet-option:hover:not(.disabled) {
  border-color: #3182ce;
  background: #f7fafc;
}

.wallet-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wallet-option.not-installed {
  border-style: dashed;
}

.wallet-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.wallet-info {
  flex: 1;
}

.wallet-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.installed-badge {
  color: #38a169;
  font-size: 12px;
  font-weight: 500;
}

.install-prompt {
  font-size: 12px;
}

.install-prompt a {
  color: #3182ce;
  text-decoration: none;
}

/* Connected Wallet Display */
.connected-wallet {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.wallet-info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.wallet-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wallet-avatar {
  position: relative;
}

.avatar-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.wallet-details {
  min-width: 0;
}

.wallet-address {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-weight: 600;
  margin-bottom: 4px;
}

.copy-button {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  color: #718096;
  transition: color 0.2s;
}

.copy-button:hover {
  color: #3182ce;
}

.copy-success {
  color: #38a169;
  font-size: 12px;
  margin-left: 8px;
}

.wallet-balance {
  color: #718096;
  font-size: 14px;
}

/* Network Section */
.network-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.network-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f0fff4;
  border: 1px solid #9ae6b4;
  border-radius: 20px;
  font-size: 14px;
}

.network-status.connected {
  color: #38a169;
}

.unsupported-network {
  display: flex;
  align-items: center;
  gap: 8px;
}

.network-warning {
  color: #e53e3e;
  font-size: 14px;
}

.switch-network-button {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

/* Wallet Menu */
.wallet-menu-container {
  position: relative;
}

.wallet-menu-button {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 6px;
  color: #718096;
  transition: background-color 0.2s;
}

.wallet-menu-button:hover {
  background: #f7fafc;
}

.wallet-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  min-width: 200px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background: #f7fafc;
}

.dropdown-item.disconnect {
  color: #e53e3e;
}

.dropdown-divider {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 8px 0;
}

/* Network Dropdown */
.network-dropdown {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.network-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.network-option:hover {
  background: #f7fafc;
}

.network-icon {
  font-size: 20px;
  width: 24px;
  text-align: center;
}

/* Other States */
.switching-network {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 14px;
  color: #718096;
}

.connection-security {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: #718096;
}

.permissions-indicator {
  margin-top: 8px;
  font-size: 12px;
  color: #718096;
}

/* QR Modal */
.qr-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.qr-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
}

.qr-placeholder {
  width: 200px;
  height: 200px;
  background: #f7fafc;
  border: 2px dashed #cbd5e0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px auto;
  border-radius: 8px;
}

/* Permissions Modal */
.permissions-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

/* Accessibility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .modal-content {
    margin: 16px;
    width: calc(100% - 32px);
  }

  .wallet-info-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .wallet-identity {
    justify-content: center;
  }

  .network-section {
    justify-content: center;
  }
}
</style>
