<!--
  TransactionHistory.vue

  PURPOSE:
  Shows a comprehensive record of user's protocol interactions including deposits, token swaps,
  yield distributions, and XMBL token minting with filtering and search capabilities.

  EXPECTED MARKUP:
  - Transaction type filter (All, Deposits, Swaps, Yields, Minting)
  - Search/filter by transaction hash, date range
  - Transaction list with icons, amounts, timestamps, status
  - Transaction detail modal/expandable rows
  - Pagination for large transaction sets
  - Export functionality for transaction data
  - Loading states and error handling

  EXPECTED FUNCTIONS:
  - getTransactionHistory(address: string): Promise<Transaction[]> - Fetches user's transaction history
  - filterTransactions(type: string, dateRange?: DateRange): Transaction[] - Filters transaction list
  - exportTransactions(format: 'csv' | 'json'): void - Exports transaction data
  - refreshHistory(): Promise<void> - Refreshes transaction data
  - getTransactionDetails(txHash: string): Promise<TransactionDetail> - Gets detailed transaction info
  - formatTransactionAmount(amount: string, decimals: number): string - Formats display amounts

  REQUIREMENTS:
  - Must display all protocol-related transactions for connected wallet
  - Must show transaction status (pending, confirmed, failed)
  - Must include transaction hashes with blockchain explorer links
  - Must show USD values at time of transaction
  - Must update in real-time when new transactions occur
  - Must handle large transaction histories efficiently

  CONNECTED SYSTEM COMPONENTS:
  - web3Service.ts - For fetching on-chain transaction data
  - apiService.ts - For getting transaction history from server
  - blockchainMonitor.ts (server) - Indexes and stores transaction data
  - XMBLVault.sol - Source of deposit and yield claim transactions
  - XMBLToken.sol - Source of token transfer transactions
  - oneInchService.ts (server) - Source of swap transaction data
  - WalletConnect.vue - Requires wallet connection to show user's transactions
  - DepositForm.vue - Adds new transactions when deposits are made
  - XMBLPortfolio.vue - Adds new transactions when yields are claimed

  PROPS:
  - userAddress: string - Wallet address to show transactions for
  - autoRefresh: boolean - Whether to auto-refresh transaction data
  - maxTransactions: number - Maximum number of transactions to display

  EVENTS EMITTED:
  - @transaction-selected(transaction: Transaction) - When user selects a transaction
  - @history-refreshed(count: number) - When transaction history is refreshed
-->
