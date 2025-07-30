<!--
  WalletConnect.vue

  PURPOSE:
  Handles connecting to EVM-compatible wallets (MetaMask, WalletConnect, Coinbase Wallet)
  for user authentication and transaction signing in the XMBL DeFi protocol.

  EXPECTED MARKUP:
  - Connect wallet button when disconnected
  - Wallet status display with address when connected
  - Disconnect button when connected
  - Network selection dropdown
  - Balance display for connected wallet

  EXPECTED FUNCTIONS:
  - connectWallet(): Promise<string> - Initiates wallet connection flow
  - disconnectWallet(): void - Clears wallet connection
  - switchNetwork(chainId: number): Promise<void> - Switches to required network
  - getBalance(): Promise<string> - Fetches ETH balance of connected wallet
  - isConnected(): boolean - Returns connection status
  - getAccount(): string | null - Returns connected wallet address

  REQUIREMENTS:
  - Must support MetaMask, WalletConnect, and Coinbase Wallet
  - Must validate network (Ethereum mainnet/Sepolia testnet)
  - Must handle connection errors gracefully
  - Must persist connection state across page reloads
  - Must emit wallet connection events to parent components

  CONNECTED SYSTEM COMPONENTS:
  - web3Service.ts - Uses for wallet connection logic
  - Dashboard.vue - Embedded in main dashboard
  - XMBLVault.sol - Requires wallet for deposit transactions
  - XMBLToken.sol - Requires wallet for token interactions
  - All transaction-based components depend on wallet connection

  EVENTS EMITTED:
  - @wallet-connected(address: string) - When wallet connects
  - @wallet-disconnected() - When wallet disconnects
  - @network-changed(chainId: number) - When network switches
-->
