// Ethereum provider type definitions for wallet interactions

export interface RequestArguments {
  method: string
  params?: unknown[] | object
}

export interface ProviderRpcError extends Error {
  code: number
  data?: unknown
}

export interface ProviderConnectInfo {
  chainId: string
  networkVersion?: string
}

export interface ProviderMessage {
  type: string
  data: unknown
}

export interface EthereumProvider {
  // Connection methods
  request(args: RequestArguments): Promise<unknown>
  isConnected(): boolean
  
  // Event handling
  on(event: string, callback: (...args: any[]) => void): void
  removeListener(event: string, callback: (...args: any[]) => void): void
  removeAllListeners(event?: string): void
  
  // Provider identification
  isMetaMask?: boolean
  isCoinbaseWallet?: boolean
  isWalletConnect?: boolean
  
  // Network info
  chainId?: string
  networkVersion?: string
  selectedAddress?: string | null
  
  // Legacy methods (for older providers)
  enable?(): Promise<string[]>
  send?(method: string, params?: unknown[]): Promise<unknown>
  sendAsync?(
    request: { method: string; params?: unknown[] },
    callback: (error: Error | null, response: unknown) => void
  ): void
}

// Extend global Window interface
declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

// Common RPC method types
export interface EthRequestAccountsResponse extends Array<string> {}

export interface EthChainIdResponse extends string {}

export interface AddEthereumChainParameter {
  chainId: string
  blockExplorerUrls?: string[]
  chainName?: string
  iconUrls?: string[]
  nativeCurrency?: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls?: string[]
}

export interface SwitchEthereumChainParameter {
  chainId: string
}

export interface WatchAssetParameters {
  type: 'ERC20'
  options: {
    address: string
    symbol: string
    decimals: number
    image?: string
  }
}

// Transaction types
export interface TransactionRequest {
  to?: string
  from?: string
  value?: string
  data?: string
  gas?: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  nonce?: string
  type?: string
}

export interface TransactionResponse {
  hash: string
  blockHash?: string
  blockNumber?: string
  transactionIndex?: string
  from: string
  to?: string
  value: string
  gas: string
  gasPrice: string
  input: string
  nonce: string
  type?: string
  accessList?: unknown[]
  chainId?: string
  v?: string
  r?: string
  s?: string
}

// Personal sign types
export interface PersonalSignParams {
  message: string
  address: string
}

// Provider events
export type EthereumEventMap = {
  accountsChanged: (accounts: string[]) => void
  chainChanged: (chainId: string) => void
  connect: (connectInfo: ProviderConnectInfo) => void
  disconnect: (error: ProviderRpcError) => void
  message: (message: ProviderMessage) => void
}

// Wallet detection helpers
export const detectWalletProvider = (): EthereumProvider | null => {
  if (typeof window === 'undefined') return null
  return window.ethereum || null
}

export const isMetaMaskAvailable = (): boolean => {
  const provider = detectWalletProvider()
  return provider?.isMetaMask === true
}

export const isCoinbaseWalletAvailable = (): boolean => {
  const provider = detectWalletProvider()
  return provider?.isCoinbaseWallet === true
}

// Common error codes
export const ERROR_CODES = {
  USER_REJECTED_REQUEST: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PARSE_ERROR: -32700
} as const

// Type guards
export const isProviderRpcError = (error: unknown): error is ProviderRpcError => {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as any).code === 'number'
  )
}

export const isEthereumProvider = (provider: unknown): provider is EthereumProvider => {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'request' in provider &&
    typeof (provider as any).request === 'function'
  )
}

// Export for module usage
export default EthereumProvider
