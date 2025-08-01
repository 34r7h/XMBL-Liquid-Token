<template>
  <div class="deposit-form" data-testid="deposit-form" :class="{ disabled: isFormDisabled }">
    <!-- Wallet Connection Prompt -->
    <div v-if="!walletStore.isConnected" class="connect-wallet-prompt" data-testid="connect-wallet-prompt">
      <div class="prompt-content">
        <h3>Connect Your Wallet</h3>
        <p>Please connect your wallet to start depositing tokens</p>
        <button @click="connectWallet" class="connect-button">Connect Wallet</button>
      </div>
    </div>

    <!-- Maintenance Mode Message -->
    <div v-if="protocolStore.isMaintenanceMode" class="maintenance-message" data-testid="maintenance-message">
      <div class="warning-icon">🚧</div>
      <div>
        <h4>Maintenance Mode</h4>
        <p>The protocol is currently under maintenance. Please try again later.</p>
      </div>
    </div>

    <!-- Network Switch Prompt -->
    <div v-if="showNetworkSwitchPrompt" class="network-switch-prompt" data-testid="network-switch-prompt">
      <div class="warning-icon">⚠️</div>
      <div>
        <h4>Unsupported Network</h4>
        <p>Please switch to Ethereum Mainnet to use this feature.</p>
        <button @click="switchToEthereum" class="switch-network-button" data-testid="switch-network-button">
          Switch to Ethereum
        </button>
      </div>
    </div>

    <!-- Wallet Disconnected Error -->
    <div v-if="showWalletDisconnectedError" class="wallet-disconnected-error" data-testid="wallet-disconnected-error">
      <div class="error-icon">❌</div>
      <div>
        <h4>Wallet Disconnected</h4>
        <p>Your wallet was disconnected during the transaction. Please reconnect.</p>
      </div>
    </div>

    <!-- Network Changed Error -->
    <div v-if="showNetworkChangedError" class="network-changed-error" data-testid="network-changed-error">
      <div class="error-icon">🔄</div>
      <div>
        <h4>Network Changed</h4>
        <p>The network was changed during the transaction. Please try again.</p>
      </div>
    </div>

    <!-- Main Form -->
    <div v-if="walletStore.isConnected && !protocolStore.isMaintenanceMode && !showNetworkSwitchPrompt"
      class="form-content">
      <!-- Token Selection -->
      <div class="form-section">
        <label for="token-selector" class="form-label">Select Token</label>
        <div class="token-selector-container">
          <button id="token-selector" class="token-selector" data-testid="token-selector"
            aria-label="Select token to deposit" @click="toggleTokenDropdown" @keydown.enter="toggleTokenDropdown"
            @keydown.escape="closeTokenDropdown">
            <div class="selected-token" data-testid="selected-token">
              <img v-if="selectedToken.icon" :src="selectedToken.icon" :alt="`${selectedToken.symbol} icon`"
                class="token-icon" />
              <span class="token-symbol">{{ selectedToken.symbol }}</span>
              <span class="token-price">${{ formatNumber(selectedToken.priceUSD || 0) }}</span>
            </div>
            <svg class="dropdown-arrow" :class="{ rotated: showTokenDropdown }" width="16" height="16"
              viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>

          <div v-if="showTokenDropdown" class="token-dropdown" data-testid="token-dropdown"
            :class="{ open: showTokenDropdown }">
            <div v-for="token in availableTokens" :key="token.symbol" class="token-option"
              :data-testid="`token-option-${token.symbol}`" @click="selectToken(token)"
              @keydown.enter="selectToken(token)" tabindex="0">
              <img v-if="token.icon" :src="token.icon" :alt="`${token.symbol} icon`" class="token-icon" />
              <div class="token-info">
                <span class="token-name" data-testid="wallet-name">{{ token.symbol }}</span>
                <span class="token-price">${{ formatNumber(token.priceUSD || 0) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Amount Input -->
      <div class="form-section">
        <label for="amount-input" class="form-label">Amount</label>
        <div class="amount-input-container">
          <input id="amount-input" v-model="depositAmount" type="text" class="amount-input" data-testid="amount-input"
            aria-label="Deposit amount" placeholder="0.0" @input="onAmountChange" @blur="validateAmount" />
          <div class="input-suffix">
            <span class="token-symbol">{{ selectedToken.symbol }}</span>
            <button v-if="walletStore.balance" @click="setMaxAmount" class="max-button" data-testid="max-button">
              MAX
            </button>
          </div>
        </div>

        <!-- Validation Error -->
        <div v-if="validationError" class="validation-error" data-testid="validation-error" role="alert"
          aria-live="polite">
          {{ validationError }}
        </div>

        <!-- Wallet Balance -->
        <div class="wallet-balance" data-testid="wallet-balance">
          Balance: {{ walletStore.formattedBalance }}
        </div>

        <!-- Deposit Limits -->
        <div class="deposit-limits" data-testid="deposit-limits">
          Min: {{ selectedToken.minDeposit }} {{ selectedToken.symbol }} •
          Max: {{ selectedToken.maxDeposit }} {{ selectedToken.symbol }}
        </div>

        <!-- USD Value -->
        <div v-if="depositAmount && !isNaN(parseFloat(depositAmount))" class="usd-value" data-testid="usd-value">
          ≈ ${{ formattedUSDValue }}
        </div>

        <!-- Quick Amount Buttons -->
        <div class="quick-amounts">
          <button @click="setQuickAmount(0.25)" class="quick-amount-btn">25%</button>
          <button @click="setQuickAmount(0.5)" class="quick-amount-btn">50%</button>
          <button @click="setQuickAmount(0.75)" class="quick-amount-btn">75%</button>
        </div>
      </div>

      <!-- XMBL Output Preview -->
      <div class="xmbl-preview" data-testid="xmbl-preview">
        <h4>XMBL Output Estimation</h4>

        <div v-if="isEstimating" class="estimating">
          <div class="spinner small"></div>
          <span>Calculating...</span>
        </div>

        <div v-else-if="estimationError" class="estimation-error" data-testid="estimation-error">
          <span class="error-icon">⚠️</span>
          <span>{{ estimationError }}</span>
        </div>

        <div v-else-if="xmblOutput" class="xmbl-output" data-testid="xmbl-output">
          <div class="output-amount">{{ formatNumber(xmblOutput) }} XMBL</div>
          <div class="bonding-curve-rate" data-testid="bonding-curve-rate">
            Current Rate: {{ protocolStore.bondingCurveRate }}x
          </div>
        </div>

        <div v-else class="no-estimate">
          Enter an amount to see XMBL output
        </div>
      </div>

      <!-- Gas Estimation -->
      <div class="gas-estimation">
        <h4>Transaction Fees</h4>

        <div v-if="gasEstimate">
          <div class="gas-estimate" data-testid="gas-estimate">
            Estimated Gas: {{ formatNumber(gasEstimate) }} gas
          </div>
          <div class="gas-fee-eth" data-testid="gas-fee-eth">
            Fee: {{ gasFeesETH }} ETH
          </div>
          <div class="gas-fee-usd" data-testid="gas-fee-usd">
            ≈ ${{ gasFeesUSD }}
          </div>
        </div>

        <div v-else-if="gasEstimationError" class="gas-estimation-error" data-testid="gas-estimation-error">
          {{ gasEstimationError }}
        </div>
      </div>

      <!-- Deposit Button -->
      <button class="deposit-button" data-testid="deposit-button" aria-label="Submit deposit transaction"
        :disabled="!isDepositValid || isProcessing" @click="handleDeposit">
        <div v-if="isProcessing" class="loading-spinner" data-testid="loading-spinner"></div>
        <span v-if="isProcessing">{{ processingMessage }}</span>
        <span v-else>Deposit & Create XMBL NFT</span>
      </button>

      <!-- Transaction Status -->
      <div v-if="transactionStatus" class="transaction-status" data-testid="transaction-status" tabindex="0">
        <!-- Success Message -->
        <div v-if="transactionStatus.type === 'success'" class="success-message" data-testid="success-message">
          <div class="success-icon">✅</div>
          <div>
            <h4>XMBL NFT #{{ transactionStatus.tokenId }} Created!</h4>
            <p>Your deposit was successful and a new NFT with Token Bound Account has been created.</p>
            <div class="transaction-hash" data-testid="transaction-hash">
              Transaction: {{ transactionStatus.transactionHash }}
            </div>
          </div>
        </div>

        <!-- Error Message -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useWalletStore } from '../stores/wallet'
import { useProtocolStore } from '../stores/protocol'
import { web3Service } from '../services/web3Service'
import type { DepositResult } from '../services/web3Service'

// Extended token config interface for deposit form
interface ExtendedTokenConfig {
  symbol: string
  address: string
  decimals: number
  name: string
  icon?: string
  isActive: boolean
  minDeposit?: string
  maxDeposit?: string
  priceUSD?: number
  networkId?: number
}

// Emits
const emit = defineEmits<{
  'deposit-initiated': [txHash: string, token: string, amount: string, tokenId: number]
  'nft-created': [tokenId: number, tbaAddress: string, depositValue: string]
  'deposit-completed': [txHash: string, xmblMinted: string]
  'deposit-failed': [error: string]
}>()

// Stores
const walletStore = useWalletStore()
const protocolStore = useProtocolStore()

// Reactive state
const depositAmount = ref<string>('')
const selectedToken = ref<ExtendedTokenConfig>({
  symbol: 'ETH',
  address: '0x0000000000000000000000000000000000000000',
  decimals: 18,
  name: 'Ethereum',
  minDeposit: '0.01',
  maxDeposit: '100',
  isActive: true,
  icon: '/eth-icon.png',
  priceUSD: 2500
})
const showTokenDropdown = ref(false)
const validationError = ref<string | null>(null)
const xmblOutput = ref<string | null>(null)
const isEstimating = ref(false)
const estimationError = ref<string | null>(null)
const gasEstimate = ref<string | null>(null)
const gasPrice = ref<string>('20000000000') // 20 gwei default
const gasEstimationError = ref<string | null>(null)
const isProcessing = ref(false)
const processingMessage = ref('Processing...')
const transactionStatus = ref<{
  type: 'success' | 'error'
  message?: string
  transactionHash?: string
  tokenId?: number
} | null>(null)

// Debounce timer for expensive operations
let estimateTimer: NodeJS.Timeout | null = null

// Computed properties
const availableTokens = computed(() => {
  return protocolStore.supportedTokens.filter((token: any) =>
    token.isActive && (!token.networkId || token.networkId === walletStore.chainId)
  ).map((token: any) => ({
    ...token,
    minDeposit: token.minDeposit || '0.01',
    maxDeposit: token.maxDeposit || '1000',
    priceUSD: token.priceUSD || 0
  })) as ExtendedTokenConfig[]
})

const isFormDisabled = computed(() => {
  return protocolStore.isMaintenanceMode || !walletStore.isConnected || showNetworkSwitchPrompt.value
})

const showNetworkSwitchPrompt = computed(() => {
  return walletStore.isConnected && walletStore.chainId && walletStore.chainId !== 1
})

const showWalletDisconnectedError = computed(() => {
  return !walletStore.isConnected && isProcessing.value
})

const showNetworkChangedError = computed(() => {
  const initialChainId = 1 // Could be tracked from when transaction started
  return walletStore.isConnected && walletStore.chainId !== initialChainId && isProcessing.value
})

const minDeposit = computed(() => selectedToken.value?.minDeposit || '0')
const maxDeposit = computed(() => selectedToken.value?.maxDeposit || '0')

const formattedAmount = computed(() => {
  if (!depositAmount.value) return ''
  const decimals = selectedToken.value?.decimals || 18
  // Format to appropriate decimal places
  return parseFloat(depositAmount.value).toFixed(Math.min(8, decimals))
})

const formattedUSDValue = computed(() => {
  if (!depositAmount.value || !selectedToken.value?.priceUSD) return '0.00'
  const usdValue = parseFloat(depositAmount.value) * selectedToken.value.priceUSD
  return formatNumber(usdValue.toFixed(2))
})

const gasFeesETH = computed(() => {
  if (!gasEstimate.value || !gasPrice.value) return '0'
  const gasInWei = BigInt(gasEstimate.value) * BigInt(gasPrice.value)
  const gasInEth = Number(gasInWei) / 1e18
  return gasInEth.toFixed(6)
})

const gasFeesUSD = computed(() => {
  if (!gasFeesETH.value) return '0.00'
  const ethPrice = (protocolStore.supportedTokens.find((t: any) => t.symbol === 'ETH') as any)?.priceUSD || 2500
  const usdValue = parseFloat(gasFeesETH.value) * ethPrice
  return usdValue.toFixed(2)
})

const isDepositValid = computed(() => {
  return (
    walletStore.isConnected &&
    !protocolStore.isMaintenanceMode &&
    !showNetworkSwitchPrompt.value &&
    depositAmount.value &&
    !validationError.value &&
    parseFloat(depositAmount.value) > 0
  )
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

const toggleTokenDropdown = () => {
  showTokenDropdown.value = !showTokenDropdown.value
}

const closeTokenDropdown = () => {
  showTokenDropdown.value = false
}

const selectToken = (token: any) => {
  selectedToken.value = token
  showTokenDropdown.value = false
  validateAmount()
  estimateXMBLOutput()
}

const setMaxAmount = () => {
  if (walletStore.balance) {
    depositAmount.value = walletStore.balance
    validateAmount()
  }
}

const setQuickAmount = (percentage: number) => {
  if (walletStore.balance) {
    const maxAmount = parseFloat(walletStore.balance)
    depositAmount.value = (maxAmount * percentage).toString()
    validateAmount()
  }
}

const onAmountChange = () => {
  validationError.value = null

  // Debounce expensive operations
  if (estimateTimer) {
    clearTimeout(estimateTimer)
  }

  estimateTimer = setTimeout(() => {
    validateAmount()
    estimateXMBLOutput()
    estimateGas()
  }, 300)
}

const validateAmount = () => {
  if (!depositAmount.value) {
    validationError.value = null
    return true
  }

  const amount = parseFloat(depositAmount.value)
  const minAmount = parseFloat(minDeposit.value)
  const maxAmount = parseFloat(maxDeposit.value)
  const walletBalance = parseFloat(walletStore.balance || '0')

  if (isNaN(amount) || amount <= 0) {
    validationError.value = 'Please enter a valid amount'
    return false
  }

  if (amount < minAmount) {
    validationError.value = `Minimum deposit is ${minDeposit.value} ${selectedToken.value.symbol}`
    return false
  }

  if (amount > maxAmount) {
    validationError.value = `Maximum deposit is ${maxDeposit.value} ${selectedToken.value.symbol}`
    return false
  }

  if (amount > walletBalance) {
    validationError.value = 'Insufficient balance'
    return false
  }

  validationError.value = null
  return true
}

const estimateXMBLOutput = async () => {
  if (!depositAmount.value || !validateAmount()) {
    xmblOutput.value = null
    return
  }

  isEstimating.value = true
  estimationError.value = null

  try {
    const output = await protocolStore.estimateXMBLOutput(selectedToken.value.symbol, depositAmount.value)
    xmblOutput.value = output
  } catch (error: any) {
    console.error('XMBL estimation failed:', error)
    estimationError.value = 'Unable to estimate XMBL output'
  } finally {
    isEstimating.value = false
  }
}

const estimateGas = async () => {
  if (!depositAmount.value || !validateAmount()) {
    gasEstimate.value = null
    return
  }

  try {
    gasEstimationError.value = null
    const estimate = await web3Service.estimateGas(
      selectedToken.value.address,
      depositAmount.value
    )
    gasEstimate.value = estimate
  } catch (error: any) {
    console.error('Gas estimation failed:', error)
    gasEstimationError.value = 'Unable to estimate gas'
  }
}

const connectWallet = async () => {
  try {
    await walletStore.connectWallet()
  } catch (error) {
    console.error('Wallet connection failed:', error)
  }
}

const switchToEthereum = async () => {
  try {
    await walletStore.switchNetwork(1)
  } catch (error) {
    console.error('Network switch failed:', error)
  }
}

const handleDeposit = async () => {
  if (!isDepositValid.value || isProcessing.value) return

  isProcessing.value = true
  processingMessage.value = 'Preparing transaction...'
  transactionStatus.value = null

  try {
    // Handle ERC-20 token approvals if needed
    if (selectedToken.value.address !== '0x0000000000000000000000000000000000000000') {
      processingMessage.value = 'Approving token...'

      await web3Service.approveToken(
        selectedToken.value.address,
        '0xVaultAddress', // Would come from contracts config
        (parseFloat(depositAmount.value) * Math.pow(10, selectedToken.value.decimals)).toString()
      )
    }

    processingMessage.value = 'Processing deposit...'

    // Convert amount to wei/proper decimals
    const amountInWei = (parseFloat(depositAmount.value) * Math.pow(10, selectedToken.value.decimals)).toString()

    const result: DepositResult = await web3Service.depositToVault(
      selectedToken.value.address,
      amountInWei
    )

    // Emit events
    emit('deposit-initiated', result.transactionHash, selectedToken.value.symbol, depositAmount.value, result.tokenId)
    emit('nft-created', result.tokenId, result.tbaAddress, result.xmblAmount)
    emit('deposit-completed', result.transactionHash, result.xmblAmount)

    // Show success
    transactionStatus.value = {
      type: 'success',
      transactionHash: result.transactionHash,
      tokenId: result.tokenId
    }

    // Reset form
    depositAmount.value = ''
    xmblOutput.value = null
    gasEstimate.value = null

    // Focus on status message for accessibility
    await nextTick()
    const statusElement = document.querySelector('[data-testid="transaction-status"]') as HTMLElement
    if (statusElement) {
      statusElement.focus()
    }

  } catch (error: any) {
    console.error('Deposit failed:', error)

    transactionStatus.value = {
      type: 'error',
      message: error.message || 'Transaction failed'
    }

    emit('deposit-failed', error.message)
  } finally {
    isProcessing.value = false
    processingMessage.value = 'Processing...'
  }
}

const retryTransaction = () => {
  transactionStatus.value = null
  handleDeposit()
}

// Watchers
watch(() => selectedToken.value, () => {
  validateAmount()
  estimateXMBLOutput()
  estimateGas()
})

watch(() => walletStore.isConnected, (isConnected) => {
  if (!isConnected) {
    depositAmount.value = ''
    transactionStatus.value = null
  }
})

watch(() => walletStore.chainId, () => {
  validateAmount()
  estimateXMBLOutput()
  estimateGas()
})

// Lifecycle
onMounted(() => {
  // Set default token if available
  if (availableTokens.value.length > 0) {
    selectedToken.value = availableTokens.value[0]
  }

  // Load protocol data
  protocolStore.fetchSupportedTokens()
  protocolStore.fetchBondingCurveRate()
})

onUnmounted(() => {
  if (estimateTimer) {
    clearTimeout(estimateTimer)
  }
})
</script>

<style scoped>
.deposit-form {
  max-width: 480px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.deposit-form.disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* Prompts and Messages */
.connect-wallet-prompt,
.maintenance-message,
.network-switch-prompt,
.wallet-disconnected-error,
.network-changed-error {
  text-align: center;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.connect-wallet-prompt {
  background: #f0f8ff;
  border: 1px solid #3182ce;
}

.maintenance-message {
  background: #fff5f5;
  border: 1px solid #fc8181;
}

.network-switch-prompt,
.wallet-disconnected-error,
.network-changed-error {
  background: #fffbeb;
  border: 1px solid #f59e0b;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.warning-icon,
.error-icon {
  font-size: 24px;
}

.connect-button,
.switch-network-button {
  background: #3182ce;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  margin-top: 12px;
}

/* Form Sections */
.form-section {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #2d3748;
}

/* Token Selector */
.token-selector-container {
  position: relative;
}

.token-selector {
  width: 100%;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: border-color 0.2s;
}

.token-selector:hover,
.token-selector:focus {
  border-color: #3182ce;
}

.selected-token {
  display: flex;
  align-items: center;
  gap: 12px;
}

.token-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.token-symbol {
  font-weight: 600;
}

.token-price {
  color: #718096;
  font-size: 14px;
}

.dropdown-arrow {
  transition: transform 0.2s;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.token-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 10;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.token-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.token-option:hover,
.token-option:focus {
  background: #f7fafc;
}

.token-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Amount Input */
.amount-input-container {
  position: relative;
}

.amount-input {
  width: 100%;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  padding-right: 120px;
  font-size: 18px;
  font-weight: 600;
  transition: border-color 0.2s;
}

.amount-input:focus {
  border-color: #3182ce;
  outline: none;
}

.input-suffix {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
}

.max-button {
  background: #edf2f7;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #3182ce;
}

/* Validation and Info */
.validation-error {
  color: #e53e3e;
  font-size: 14px;
  margin-top: 8px;
}

.wallet-balance,
.deposit-limits {
  font-size: 14px;
  color: #718096;
  margin-top: 8px;
}

.usd-value {
  font-size: 16px;
  color: #4a5568;
  margin-top: 8px;
  font-weight: 500;
}

.quick-amounts {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.quick-amount-btn {
  background: #edf2f7;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.quick-amount-btn:hover {
  background: #e2e8f0;
}

/* XMBL Preview */
.xmbl-preview {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.xmbl-preview h4 {
  margin: 0 0 12px 0;
  color: #2d3748;
}

.estimating {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #718096;
}

.estimation-error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e53e3e;
}

.xmbl-output {
  text-align: center;
}

.output-amount {
  font-size: 24px;
  font-weight: 700;
  color: #3182ce;
  margin-bottom: 8px;
}

.bonding-curve-rate {
  font-size: 14px;
  color: #718096;
}

.no-estimate {
  color: #718096;
  font-style: italic;
}

/* Gas Estimation */
.gas-estimation {
  background: #f0f8ff;
  border: 1px solid #bee3f8;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  font-size: 14px;
}

.gas-estimation h4 {
  margin: 0 0 8px 0;
  color: #2d3748;
}

.gas-estimation-error {
  color: #e53e3e;
}

/* Deposit Button */
.deposit-button {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}

.deposit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.deposit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Loading Spinner */
.spinner,
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner.small {
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

/* Transaction Status */
.transaction-status {
  border-radius: 12px;
  padding: 16px;
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

/* Mobile Responsive */
@media (max-width: 768px) {
  .deposit-form {
    margin: 16px;
    padding: 16px;
  }

  .amount-input {
    padding-right: 100px;
  }

  .output-amount {
    font-size: 20px;
  }
}
</style>
