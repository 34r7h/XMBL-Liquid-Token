/**
 * contracts.ts
 *
 * PURPOSE:
 * Centralized configuration for smart contract addresses, ABIs, and supported tokens
 * across different networks (mainnet, testnets) for the XMBL protocol.
 *
 * EXPECTED EXPORTS:
 * - CONTRACT_ADDRESSES: Record<string, ContractAddresses> - Contract addresses by network
 * - SUPPORTED_TOKENS: Record<string, TokenConfig> - Supported token configurations
 * - NETWORK_CONFIGS: Record<string, NetworkConfig> - Network-specific configurations
 * - ABI_REGISTRY: Record<string, any[]> - Contract ABIs
 *
 * EXPECTED INTERFACES:
 * - ContractAddresses - All contract addresses for a network
 * - TokenConfig - Token metadata (symbol, name, decimals, address)
 * - NetworkConfig - Network metadata (name, rpc, explorer, chainId)
 *
 * CONTRACT ADDRESSES INCLUDED:
 * - XMBLVault - Primary protocol vault contract
 * - XMBLToken - ERC-20 XMBL token contract
 * - OneInchAggregator - 1inch aggregation router
 * - WormholeBridge - Cross-chain bridge (if used)
 * - YieldManager - Yield management contract (if on-chain)
 *
 * SUPPORTED TOKENS:
 * - ETH - Ethereum native token
 * - WBTC - Wrapped Bitcoin
 * - USDC - USD Coin
 * - USDT - Tether USD
 * - BTC - Bitcoin (for cross-chain support)
 *
 * NETWORKS SUPPORTED:
 * - Ethereum Mainnet (chainId: 1)
 * - Sepolia Testnet (chainId: 11155111)
 * - Future L2s (Arbitrum, Optimism, Polygon)
 *
 * REQUIREMENTS:
 * - Must support multiple networks with different contract addresses
 * - Must include token metadata for UI display and calculations
 * - Must validate contract addresses are valid checksummed addresses
 * - Must be easily extensible for new tokens and networks
 * - Must include fallback/default configurations
 *
 * CONNECTED SYSTEM COMPONENTS:
 * - web3Service.ts - Uses contract addresses and ABIs for interactions
 * - DepositForm.vue - Uses supported token configurations
 * - WalletConnect.vue - Uses network configurations for validation
 * - XMBLVault.sol - Deployed addresses stored here
 * - XMBLToken.sol - Deployed addresses stored here
 * - Deploy scripts - Updates addresses after deployment
 *
 * USAGE EXAMPLES:
 * - CONTRACT_ADDRESSES[chainId].XMBLVault - Get vault address for network
 * - SUPPORTED_TOKENS.WBTC.decimals - Get token decimals
 * - NETWORK_CONFIGS[chainId].explorer - Get block explorer URL
 *
 * ENVIRONMENT VARIABLES:
 * - VITE_CONTRACT_XMBL_VAULT - Override vault address
 * - VITE_CONTRACT_XMBL_TOKEN - Override token address
 * - VITE_NETWORK_RPC_URL - Override RPC URL
 */
