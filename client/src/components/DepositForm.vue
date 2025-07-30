<!--
  DepositForm.vue

  PURPOSE:
  A form component allowing users to select and deposit supported tokens (ETH, WBTC, USDC, USDT, BTC)
  into the XMBL protocol, with real-time preview of XMBL NFT value and Token Bound Account creation.

  EXPECTED MARKUP:
  - Token selection dropdown (ETH, WBTC, USDC, USDT, BTC)
  - Amount input field with decimal validation
  - Token balance display for selected token
  - NFT value preview calculation display
  - Exchange rate information and TBA creation notice
  - Deposit confirmation button (creates new XMBL NFT)
  - Transaction status indicator
  - Slippage tolerance settings
  - NFT metadata preview (token ID, TBA address)

  EXPECTED FUNCTIONS:
  - handleDeposit(token: string, amount: string): Promise<DepositResult> - Initiates deposit and NFT creation
  - calculateNFTValue(tokenAmount: string, tokenSymbol: string): Promise<string> - Calculates NFT deposit value
  - getTokenBalance(tokenAddress: string): Promise<string> - Fetches user's token balance
  - validateDepositAmount(amount: string): boolean - Validates input amount
  - getBondingCurveRate(): Promise<number> - Gets current bonding curve rate
  - estimateGasFees(): Promise<string> - Estimates transaction gas costs including NFT minting
  - previewNFTCreation(): Promise<NFTPreview> - Shows preview of NFT and TBA to be created

  REQUIREMENTS:
  - Must integrate with 1inch for token swap quotes
  - Must calculate NFT value based on algorithmic bonding curve
  - Must validate user has sufficient token balance
  - Must handle ERC-20 token approvals before deposit
  - Must create new XMBL NFT with Token Bound Account
  - Must display NFT creation preview and TBA capabilities
  - Must display real-time exchange rates
  - Must show transaction confirmations and status
  - Must provide NFT metadata and TBA information upon creation

  CONNECTED SYSTEM COMPONENTS:
  - web3Service.ts - For blockchain interactions and wallet state
  - apiService.ts - For fetching 1inch quotes and bonding curve data
  - XMBLVault.sol - Calls deposit() function to create NFT with TBA
  - XMBLToken.sol - XMBL NFT minted to user with Token Bound Account
  - ERC-6551 Registry - Creates Token Bound Account for new NFT
  - oneInchService.ts (server) - For swap quotes and order creation
  - WalletConnect.vue - Requires wallet connection for transactions
  - TransactionHistory.vue - Updates with new deposit and NFT creation transactions
  - portfolio.ts store - Updates with new NFT data after deposit

  ERC-6551 INTEGRATION:
  - Creates unique NFT for each deposit
  - Automatically generates Token Bound Account
  - Displays TBA address and capabilities
  - Shows NFT metadata and deposit value
  - Enables future TBA interactions and management

  EVENTS EMITTED:
  - @deposit-initiated(txHash: string, token: string, amount: string, tokenId: number) - When deposit starts
  - @nft-created(tokenId: number, tbaAddress: string, depositValue: string) - When NFT is minted
  - @deposit-completed(txHash: string, xmblMinted: string) - When deposit confirms
  - @deposit-failed(error: string) - When deposit transaction fails
-->
