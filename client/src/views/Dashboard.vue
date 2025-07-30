<!--
  Dashboard.vue

  PURPOSE:
  Main user dashboard where authenticated users can deposit tokens, view their portfolio,
  monitor yields, and manage their XMBL protocol interactions.

  EXPECTED MARKUP:
  - Dashboard header with wallet connection status
  - Main content area split into sections:
    - Left side: DepositForm and XMBLPortfolio components
    - Right side: TransactionHistory component
  - Navigation tabs/links to other dashboard sections
  - Real-time data refresh indicators
  - Mobile-responsive layout that stacks vertically

  EXPECTED FUNCTIONS:
  - initializeDashboard(): Promise<void> - Sets up dashboard data on mount
  - refreshAllData(): Promise<void> - Refreshes all dashboard components
  - handleWalletConnection(address: string): void - Responds to wallet connection events
  - handleWalletDisconnection(): void - Responds to wallet disconnection
  - navigateToSection(section: string): void - Internal dashboard navigation
  - exportPortfolioData(): void - Exports user's portfolio data

  REQUIREMENTS:
  - Must require wallet connection to display user data
  - Must refresh data automatically when wallet connects/disconnects
  - Must handle loading states for all data sections
  - Must be responsive for mobile and desktop layouts
  - Must show appropriate error states when data fails to load
  - Must persist user preferences (refresh intervals, display settings)

  CONNECTED SYSTEM COMPONENTS:
  - WalletConnect.vue - Embedded for wallet management
  - DepositForm.vue - Embedded for token deposits
  - XMBLPortfolio.vue - Embedded for portfolio display
  - TransactionHistory.vue - Embedded for transaction display
  - web3Service.ts - For wallet state management
  - apiService.ts - For fetching dashboard data
  - XMBLVault.sol - Primary contract for user interactions
  - XMBLToken.sol - For XMBL token balance display

  CHILD COMPONENTS:
  - WalletConnect - Top-right header position
  - DepositForm - Main left section
  - XMBLPortfolio - Main left section below deposits
  - TransactionHistory - Right sidebar section

  ROUTE GUARDS:
  - Requires /dashboard path
  - Should redirect to home if wallet not connected (optional)

  EVENT HANDLING:
  - @wallet-connected - Updates dashboard state and loads user data
  - @wallet-disconnected - Clears user data and shows connection prompt
  - @deposit-completed - Refreshes portfolio and transaction history
  - @yield-claimed - Refreshes portfolio data

  RESPONSIVE BREAKPOINTS:
  - Desktop: 2-column layout (main content + sidebar)
  - Tablet: 2-column layout with adjusted spacing
  - Mobile: Single column stacked layout
-->
