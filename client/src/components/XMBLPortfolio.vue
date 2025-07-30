<!--
  XMBLPortfolio.vue

  PURPOSE:  - Must calculate USD values using current token prices per NFT
  - Must show breakdown of yield sources and allocations
  - Must handle individual and batch yield claiming transactions
  - Must update data automatically when new yields are distributed to TBAs
  - Must show historical performance data per NFT
  - Must support NFT selection and detailed TBA management
  - Must display Token Bound Account capabilities and balances
  - Must show NFT collection overview and statistics

  CONNECTED SYSTEM COMPONENTS:
  - web3Service.ts - For reading XMBL NFT collection and TBA interactions
  - apiService.ts - For fetching yield data, APY, and price information per NFT
  - XMBLToken.sol - Reads user's XMBL NFT collection and TBA addresses
  - XMBLVault.sol - Calls claimYields(tokenId) function for individual dividend claims
  - ERC-6551 Registry - For Token Bound Account address resolution
  - Token Bound Account contracts - For TBA balance and interaction data
  - profitDistributionService.ts (server) - Calculates yield distributions per NFT
  - yieldManagementService.ts (server) - Provides yield source data
  - WalletConnect.vue - Requires wallet connection for NFT and yield operations
  - TransactionHistory.vue - Updates with NFT and yield claim transactions
  - portfolio.ts store - Manages NFT portfolio state and TBA data

  ERC-6551 FEATURES:
  - NFT collection display with individual metadata
  - Token Bound Account balance monitoring
  - Per-NFT yield tracking and claiming
  - TBA transaction history and capabilities
  - Advanced DeFi operations per NFT position
  - Cross-NFT portfolio analytics and management user's XMBL NFT collection with Token Bound Accounts, individual NFT values,
  accrued dividend yields per NFT, and provides functionality to manage and claim yields
  from specific NFTs or perform batch operations.

  EXPECTED MARKUP:
  - NFT grid view with each XMBL NFT and its metadata
  - Individual NFT cards showing deposit value, TBA balance, yield earned
  - Selected NFT detail view with TBA transaction history
  - Total portfolio summary (total NFTs, combined value, total yields)
  - Current APY display per NFT and portfolio average
  - Yield source breakdown (BTC lending, DeFi protocols, liquidity mining)
  - Individual NFT yield claim buttons
  - Batch claim all yields button
  - NFT portfolio performance chart
  - TBA interaction panel for advanced operations

  EXPECTED FUNCTIONS:
  - getXMBLNFTs(): Promise<NFTData[]> - Fetches user's XMBL NFT collection
  - getNFTValue(tokenId: number): Promise<string> - Gets individual NFT deposit value
  - getTBABalance(tokenId: number): Promise<string> - Gets Token Bound Account balance
  - getAccruedYields(tokenId: number): Promise<string> - Gets claimable yield for specific NFT
  - claimYields(tokenId: number): Promise<TransactionReceipt> - Claims yields for specific NFT
  - claimAllYields(): Promise<TransactionReceipt[]> - Claims yields for all NFTs
  - getCurrentAPY(tokenId: number): Promise<number> - Gets APY for specific NFT
  - getYieldSources(): Promise<YieldSource[]> - Gets yield allocation breakdown
  - getTotalPortfolioValue(): Promise<string> - Calculates total portfolio value
  - refreshPortfolioData(): Promise<void> - Refreshes all NFT and TBA data
  - selectNFT(tokenId: number): void - Selects NFT for detailed operations
  - getTBATransactionHistory(tokenId: number): Promise<Transaction[]> - Gets TBA transaction history

  REQUIREMENTS:
  - Must display real-time NFT collection from blockchain
  - Must show individual TBA balances and capabilities
  - Must show breakdown of yield sources and allocations
  - Must handle yield claiming transactions
  - Must update data automatically when new yields are distributed
  - Must show historical performance data

  CONNECTED SYSTEM COMPONENTS:
  - web3Service.ts - For reading XMBL token balance and claiming yields
  - apiService.ts - For fetching yield data, APY, and price information
  - XMBLToken.sol - Reads user's XMBL token balance
  - XMBLVault.sol - Calls claimYields() function for dividend claims
  - profitDistributionService.ts (server) - Calculates yield distributions
  - yieldManagementService.ts (server) - Provides yield source data
  - WalletConnect.vue - Requires wallet connection for yield claims
  - TransactionHistory.vue - Updates with yield claim transactions

  EVENTS EMITTED:
  - @yield-claimed(amount: string, txHash: string) - When yields are successfully claimed
  - @yield-claim-failed(error: string) - When yield claim transaction fails
  - @portfolio-updated(newBalance: string) - When portfolio data refreshes
-->
