/**
 * ethereum.d.ts
 *
 * PURPOSE:
 * TypeScript type definitions for Ethereum wallet providers (MetaMask, WalletConnect, etc.)
 * and window.ethereum global object to enable type-safe wallet interactions.
 *
 * EXPECTED INTERFACES:
 * - EthereumProvider - Main provider interface for wallet interactions
 * - ProviderRpcError - Error object structure for RPC errors
 * - ProviderConnectInfo - Connection info when provider connects
 * - ProviderMessage - Message object for provider events
 * - RequestArguments - Structure for provider.request() calls
 *
 * PROVIDER METHODS DEFINED:
 * - request(args: RequestArguments): Promise<any> - Main RPC method
 * - on(event: string, callback: Function): void - Event listener registration
 * - removeListener(event: string, callback: Function): void - Event listener removal
 * - isConnected(): boolean - Connection status check
 * - isMetaMask?: boolean - MetaMask provider identification
 * - isCoinbaseWallet?: boolean - Coinbase wallet identification
 *
 * ETHEREUM EVENTS SUPPORTED:
 * - accountsChanged - When user switches accounts
 * - chainChanged - When user switches networks
 * - connect - When provider connects
 * - disconnect - When provider disconnects
 * - message - For arbitrary messages
 *
 * RPC METHODS COVERED:
 * - eth_requestAccounts - Request wallet connection
 * - eth_accounts - Get connected accounts
 * - eth_chainId - Get current chain ID
 * - wallet_switchEthereumChain - Switch networks
 * - wallet_addEthereumChain - Add new network
 * - eth_sendTransaction - Send transactions
 * - eth_sign - Sign messages
 *
 * REQUIREMENTS:
 * - Must extend global Window interface with ethereum property
 * - Must provide comprehensive typing for all wallet interactions
 * - Must handle multiple wallet providers (MetaMask, WalletConnect, Coinbase)
 * - Must include error types for proper error handling
 * - Must be compatible with ethers.js BrowserProvider
 *
 * CONNECTED SYSTEM COMPONENTS:
 * - web3Service.ts - Uses these types for wallet provider interactions
 * - WalletConnect.vue - Uses for type-safe wallet connection logic
 * - All components that interact with window.ethereum
 * - ethers.js - Compatible with BrowserProvider constructor
 * - @wagmi/core - Compatible with wagmi provider types
 *
 * GLOBAL AUGMENTATION:
 * - Extends Window interface to include ethereum property
 * - Provides optional chaining support for window.ethereum
 * - Ensures TypeScript compilation without errors
 *
 * COMPATIBILITY:
 * - EIP-1193 Provider Standard compliant
 * - MetaMask provider interface
 * - WalletConnect v2 provider interface
 * - Coinbase Wallet provider interface
 */
