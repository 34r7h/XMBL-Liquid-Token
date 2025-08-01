// Contract configuration for XMBL protocol
export interface ContractAddresses {
  XMBLVault: string
  XMBLToken: string
  OneInchAggregator?: string
  WormholeBridge?: string
  YieldManager?: string
}

export interface TokenConfig {
  symbol: string
  name: string
  address: string
  decimals: number
  icon?: string
  isNative?: boolean
}

export interface NetworkConfig {
  name: string
  chainId: number
  rpcUrls: string[]
  blockExplorerUrls: string[]
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

// Contract addresses by network
export const CONTRACT_ADDRESSES: Record<string, ContractAddresses> = {
  // Ethereum Mainnet
  '1': {
    XMBLVault: '0x1234567890123456789012345678901234567890', // Placeholder
    XMBLToken: '0x0987654321098765432109876543210987654321', // Placeholder
    OneInchAggregator: '0x1111455e65ac4fc2f58baaa4f95e122d00b6b5', // 1inch v5 aggregator
  },
  // Sepolia Testnet
  '11155111': {
    XMBLVault: '0x5678901234567890123456789012345678901234', // Placeholder testnet
    XMBLToken: '0x4321098765432109876543210987654321098765', // Placeholder testnet
  }
}

// Supported tokens configuration
export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000', // Native ETH
    decimals: 18,
    isNative: true,
    icon: '⟠'
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // Mainnet WBTC
    decimals: 8,
    icon: '₿'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xA0b86a33E6327c4c71bDBAB4b3FbF3c1f7Bc0c12', // Mainnet USDC
    decimals: 6,
    icon: '$'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Mainnet USDT
    decimals: 6,
    icon: '$'
  },
  XMBL: {
    symbol: 'XMBL',
    name: 'XMBL Liquid Token',
    address: '', // Will be set from CONTRACT_ADDRESSES
    decimals: 18,
    icon: '🌊'
  }
}

// Network configurations
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  '1': {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrls: ['https://mainnet.infura.io/v3/YOUR_PROJECT_ID'],
    blockExplorerUrls: ['https://etherscan.io'],
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  '11155111': {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrls: ['https://sepolia.infura.io/v3/YOUR_PROJECT_ID'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'SepoliaETH',
      decimals: 18
    }
  }
}

// Contract ABIs (simplified for demo)
export const ABI_REGISTRY: Record<string, any[]> = {
  XMBLVault: [
    {
      "inputs": [
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "deposit",
      "outputs": [{"internalType": "uint256", "name": "xmblAmount", "type": "uint256"}],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "xmblAmount", "type": "uint256"}],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getTotalValueLocked",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
      "name": "getUserPosition",
      "outputs": [
        {"internalType": "uint256", "name": "xmblBalance", "type": "uint256"},
        {"internalType": "uint256", "name": "underlyingValue", "type": "uint256"}
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  XMBLToken: [
    {
      "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalSupply",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  ERC20: [
    {
      "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "spender", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "approve",
      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "owner", "type": "address"},
        {"internalType": "address", "name": "spender", "type": "address"}
      ],
      "name": "allowance",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    }
  ]
}

// Helper functions
export const getContractAddress = (chainId: string | number, contractName: keyof ContractAddresses): string => {
  const chainIdStr = chainId.toString()
  const addresses = CONTRACT_ADDRESSES[chainIdStr]
  if (!addresses) {
    throw new Error(`Unsupported network: ${chainId}`)
  }
  const address = addresses[contractName]
  if (!address) {
    throw new Error(`Contract ${contractName} not deployed on network ${chainId}`)
  }
  return address
}

export const getTokenConfig = (symbol: string): TokenConfig => {
  const token = SUPPORTED_TOKENS[symbol.toUpperCase()]
  if (!token) {
    throw new Error(`Unsupported token: ${symbol}`)
  }
  return token
}

export const getNetworkConfig = (chainId: string | number): NetworkConfig => {
  const chainIdStr = chainId.toString()
  const config = NETWORK_CONFIGS[chainIdStr]
  if (!config) {
    throw new Error(`Unsupported network: ${chainId}`)
  }
  return config
}

export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export const getSupportedChainIds = (): number[] => {
  return Object.keys(CONTRACT_ADDRESSES).map(id => parseInt(id))
}

export const getSupportedTokenSymbols = (): string[] => {
  return Object.keys(SUPPORTED_TOKENS)
}

// Update XMBL token addresses based on network
Object.keys(CONTRACT_ADDRESSES).forEach(chainId => {
  const xmblAddress = CONTRACT_ADDRESSES[chainId].XMBLToken
  if (xmblAddress) {
    SUPPORTED_TOKENS.XMBL.address = xmblAddress
  }
})

export default {
  CONTRACT_ADDRESSES,
  SUPPORTED_TOKENS,
  NETWORK_CONFIGS,
  ABI_REGISTRY,
  getContractAddress,
  getTokenConfig,
  getNetworkConfig,
  isValidAddress,
  getSupportedChainIds,
  getSupportedTokenSymbols
}
