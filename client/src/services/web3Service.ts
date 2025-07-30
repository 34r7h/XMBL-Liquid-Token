/**
 * web3Service.ts
 *
 * PURPOSE:
 * Encapsulates logic for interacting with EVM smart contracts using ethers.js,
 * providing a clean interface for wallet connections, ERC-6551 NFT interactions,
 * Token Bound Account management, and blockchain operations specific to the XMBL protocol.
 *
 * EXPECTED CLASSES/INTERFACES:
 * - Web3Service class - Main service class
 * - ContractConfig interface - Contract address and ABI configuration
 * - TransactionReceipt interface - Transaction result data
 * - WalletProvider interface - Wallet connection details
 * - NFTData interface - XMBL NFT data with TBA information
 * - TBAAccount interface - Token Bound Account details
 *
 * EXPECTED FUNCTIONS:
 * - connectWallet(): Promise<string> - Connects to user's wallet
 * - disconnectWallet(): void - Disconnects wallet
 * - getAccount(): Promise<string | null> - Gets connected wallet address
 * - getBalance(address: string): Promise<string> - Gets ETH balance
 * - initContract(name: string, config: ContractConfig): void - Initializes contract instance
 * - getContract(name: string): Contract - Gets initialized contract
 * - depositToVault(tokenAddress: string, amount: string): Promise<DepositResult> - Creates new NFT with TBA
 * - getXMBLNFTs(userAddress: string): Promise<NFTData[]> - Gets user's XMBL NFT collection
 * - getNFTValue(tokenId: number): Promise<string> - Gets individual NFT deposit value
 * - getTBAAddress(tokenId: number): Promise<string> - Gets Token Bound Account address for NFT
 * - getTBABalance(tbaAddress: string): Promise<string> - Gets TBA balance
 * - claimYields(tokenId: number): Promise<TransactionReceipt> - Claims yields for specific NFT
 * - claimAllYields(tokenIds: number[]): Promise<TransactionReceipt[]> - Claims yields for multiple NFTs
 * - approveToken(tokenAddress: string, spenderAddress: string, amount: string): Promise<TransactionReceipt> - Approves token spending
 * - estimateGas(contractMethod: any, args: any[]): Promise<string> - Estimates gas for transaction
 * - switchNetwork(chainId: number): Promise<void> - Switches wallet network
 * - createTBA(tokenId: number): Promise<string> - Creates Token Bound Account for NFT
 * - executeTBATransaction(tbaAddress: string, to: string, value: string, data: string): Promise<TransactionReceipt> - Execute transaction from TBA
 *
 * REQUIREMENTS:
 * - Must support MetaMask, WalletConnect, and Coinbase Wallet providers
 * - Must handle ERC-721 (NFT) operations for XMBL tokens
 * - Must integrate with ERC-6551 Token Bound Accounts
 * - Must support individual and batch NFT operations
 * - Must handle contract ABI loading and validation
 * - Must provide error handling for failed transactions
 * - Must emit events for transaction status updates
 * - Must cache contract instances for performance
 * - Must validate network compatibility (Ethereum mainnet/Sepolia)
 * - Must support TBA proxy contract interactions
 * - Must handle NFT ownership verification for TBA operations
 *
 * CONNECTED SYSTEM COMPONENTS:
 * - contracts/contracts.ts - Uses contract addresses and ABIs
 * - WalletConnect.vue - Uses for wallet connection functionality
 * - DepositForm.vue - Uses for deposit transactions creating NFTs with TBAs
 * - XMBLPortfolio.vue - Uses for reading NFT collection and claiming yields
 * - XMBLVault.sol - Primary contract for deposits and NFT creation
 * - XMBLToken.sol - ERC-721 contract for XMBL NFT operations
 * - ERC-6551 Registry - For creating and managing Token Bound Accounts
 * - Token Bound Account Implementation - For TBA interactions
 * - ethereum.d.ts - Uses TypeScript definitions for window.ethereum
 *
 * ERC-6551 INTEGRATION:
 * - NFT enumeration and metadata retrieval
 * - Token Bound Account address calculation
 * - TBA balance and transaction monitoring
 * - Cross-contract interactions via TBAs
 * - Advanced DeFi operations per NFT position
 *
 * EVENTS LISTENED TO:
 * - Contract events from XMBLVault (Deposit, YieldClaim, SwapCompleted)
 * - Contract events from XMBLToken (Transfer, Approval)
 * - Wallet events (accountsChanged, chainChanged, disconnect)
 *
 * EXTERNAL DEPENDENCIES:
 * - ethers.js - For blockchain interactions
 * - @wagmi/core - For wallet connection management
 * - viem - For typed contract interactions
 */
