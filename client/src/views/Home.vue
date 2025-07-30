<!--
  Home.vue

  PURPOSE:
  Landing page component that showcases the XMBL protocol's value proposition,
  displays key statistics, and guides users to start using the platform.

  EXPECTED MARKUP:
  - Hero section with protocol description and call-to-action
  - Feature showcase (4 key features: Deposit, Convert, Yield, Dividends)
  - Protocol statistics section (TVL, APY, Users, Yield Distributed)
  - How it works section with step-by-step flow
  - Security and audit information
  - FAQ section
  - Footer with links and social media

  EXPECTED FUNCTIONS:
  - getProtocolStats(): Promise<ProtocolStats> - Fetches live protocol statistics
  - navigateToDashboard(): void - Routes user to dashboard
  - subscribeToNewsletter(email: string): Promise<void> - Newsletter signup
  - loadFAQData(): Promise<FAQ[]> - Loads frequently asked questions
  - formatCurrency(amount: number): string - Formats currency displays
  - animateCounters(): void - Animates statistic counters on scroll

  REQUIREMENTS:
  - Must be responsive for mobile and desktop
  - Must load protocol statistics from live data
  - Must provide clear explanation of protocol mechanics
  - Must guide users to connect wallet and start depositing
  - Must display real-time TVL, APY, and other key metrics
  - Must be SEO optimized for search engines

  CONNECTED SYSTEM COMPONENTS:
  - apiService.ts - For fetching protocol statistics and data
  - Dashboard.vue - Navigation target from CTA buttons
  - server/src/api/controllers.ts - Backend source for statistics
  - XMBLVault.sol - Source of TVL and deposit statistics
  - yieldManagementService.ts (server) - Source of APY and yield data
  - Vue Router - For navigation to dashboard and other pages

  PROPS:
  - None (standalone page component)

  DATA DISPLAYED:
  - Total Value Locked (TVL) - From XMBLVault.sol
  - Current APY - From yield management calculations
  - Total Users - From transaction history analysis
  - Total Yield Distributed - From profit distribution records
  - Supported tokens - ETH, WBTC, USDC, USDT, BTC

  ROUTES:
  - / (root path) - This component
  - Links to /dashboard for authenticated users
-->
