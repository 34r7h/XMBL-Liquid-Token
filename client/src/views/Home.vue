<template>
  <div class="home" data-testid="home">
    <!-- Hero Section -->
    <section class="hero-section" data-testid="hero-section">
      <div class="container">
        <div class="hero-content">
          <h1 class="hero-title">XMBL Liquid Token</h1>
          <p class="hero-subtitle">Maximize your Bitcoin yield with DeFi liquidity</p>
          <p class="hero-description">
            Deposit Bitcoin, ETH, or stablecoins and receive liquid XMBL tokens while earning up to 15% APY through our innovative yield strategies.
          </p>
          <button @click="navigateToDashboard" class="cta-button" data-testid="cta-button">
            Get Started
          </button>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section" data-testid="features-section">
      <div class="container">
        <h2>Why Choose XMBL?</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon" data-testid="yield-icon">💰</div>
            <h3>High Yield</h3>
            <p>Earn up to 15% APY on your crypto deposits through our optimized yield strategies.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-testid="security-icon">🔒</div>
            <h3>Secure</h3>
            <p>Audited smart contracts and institutional-grade security protocols protect your assets.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-testid="liquidity-icon">🌊</div>
            <h3>Liquid</h3>
            <p>Trade anytime with our liquid XMBL tokens - no lock-up periods or penalties.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🌐</div>
            <h3>Cross-Chain</h3>
            <p>Support for Bitcoin and Ethereum assets with seamless cross-chain functionality.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Statistics Section -->
    <section class="stats-section" data-testid="stats-section">
      <div class="container">
        <h2>Protocol Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card" data-testid="tvl-stat">
            <div class="stat-value" data-testid="tvl-value">{{ formatCurrency(stats.tvl) }}</div>
            <div class="stat-label">Total Value Locked</div>
          </div>
          <div class="stat-card" data-testid="apy-stat">
            <div class="stat-value" data-testid="apy-value">{{ stats.apy }}%</div>
            <div class="stat-label">Current APY</div>
          </div>
          <div class="stat-card" data-testid="users-stat">
            <div class="stat-value" data-testid="users-value">{{ formatNumber(stats.totalUsers) }}</div>
            <div class="stat-label">Total Users</div>
          </div>
          <div class="stat-card" data-testid="yield-stat">
            <div class="stat-value" data-testid="yield-value">{{ formatCurrency(stats.totalYield) }}</div>
            <div class="stat-label">Yield Distributed</div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section class="how-it-works" data-testid="how-it-works">
      <div class="container">
        <h2>How It Works</h2>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">1</div>
            <h3>Connect Wallet</h3>
            <p>Connect your MetaMask or other Web3 wallet to get started.</p>
          </div>
          <div class="step-card">
            <div class="step-number">2</div>
            <h3>Deposit Assets</h3>
            <p>Deposit Bitcoin, ETH, WBTC, USDC, or USDT into the XMBL vault.</p>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <h3>Receive XMBL</h3>
            <p>Get liquid XMBL tokens representing your share in the yield-generating vault.</p>
          </div>
          <div class="step-card">
            <div class="step-number">4</div>
            <h3>Earn Yield</h3>
            <p>Watch your XMBL tokens appreciate as the vault generates yield from DeFi strategies.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="faq-section" data-testid="faq-section">
      <div class="container">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-list">
          <div v-for="faq in faqs" :key="faq.id" class="faq-item" data-testid="faq-item">
            <button @click="toggleFaq(faq.id)" class="faq-question">
              {{ faq.question }}
              <span class="faq-toggle">{{ expandedFaq === faq.id ? '−' : '+' }}</span>
            </button>
            <div v-if="expandedFaq === faq.id" class="faq-answer">
              {{ faq.answer }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer" data-testid="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-section">
            <h4>XMBL Protocol</h4>
            <p>Maximizing Bitcoin yield through DeFi innovation.</p>
          </div>
          <div class="footer-section">
            <h4>Links</h4>
            <ul>
              <li><a href="/dashboard">Dashboard</a></li>
              <li><a href="/docs">Documentation</a></li>
              <li><a href="/audit">Security Audit</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Community</h4>
            <ul>
              <li><a href="#" target="_blank">Twitter</a></li>
              <li><a href="#" target="_blank">Discord</a></li>
              <li><a href="#" target="_blank">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; 2024 XMBL Protocol. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

interface ProtocolStats {
  tvl: number
  apy: number
  totalUsers: number
  totalYield: number
}

interface FAQ {
  id: number
  question: string
  answer: string
}

const router = useRouter()

// Reactive state
const stats = ref<ProtocolStats>({
  tvl: 0,
  apy: 0,
  totalUsers: 0,
  totalYield: 0
})

const faqs = ref<FAQ[]>([
  {
    id: 1,
    question: 'What is XMBL?',
    answer: 'XMBL is a liquid token that represents your share in our yield-generating vault. You can trade it anytime while still earning yield.'
  },
  {
    id: 2,
    question: 'How does the yield generation work?',
    answer: 'We use a combination of DeFi strategies including lending, liquidity provision, and yield farming to generate returns on deposited assets.'
  },
  {
    id: 3,
    question: 'Is it safe?',
    answer: 'Yes, our smart contracts are audited by leading security firms, and we use institutional-grade security practices.'
  },
  {
    id: 4,
    question: 'Can I withdraw anytime?',
    answer: 'Yes, XMBL tokens are liquid and can be withdrawn or traded at any time without lock-up periods.'
  }
])

const expandedFaq = ref<number | null>(null)
const isLoading = ref(true)

// Methods
const navigateToDashboard = () => {
  router.push('/dashboard')
}

const getProtocolStats = async (): Promise<ProtocolStats> => {
  try {
    // Mock data for now - replace with actual API call
    return {
      tvl: 12500000,
      apy: 12.5,
      totalUsers: 1250,
      totalYield: 1875000
    }
  } catch (error) {
    console.error('Failed to fetch protocol stats:', error)
    return {
      tvl: 0,
      apy: 0,
      totalUsers: 0,
      totalYield: 0
    }
  }
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`
  }
  return `$${amount.toLocaleString()}`
}

const formatNumber = (value: number): string => {
  return value.toLocaleString()
}

const toggleFaq = (id: number) => {
  expandedFaq.value = expandedFaq.value === id ? null : id
}

const loadFAQData = async (): Promise<FAQ[]> => {
  // For now return static data, but this could fetch from API
  return faqs.value
}

// Lifecycle
onMounted(async () => {
  try {
    stats.value = await getProtocolStats()
  } catch (error) {
    console.error('Failed to load protocol stats:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.home {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Hero Section */
.hero-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 120px 0;
  text-align: center;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 1.5rem;
  margin-bottom: 24px;
  opacity: 0.9;
}

.hero-description {
  font-size: 1.125rem;
  margin-bottom: 48px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
  opacity: 0.8;
}

.cta-button {
  background: white;
  color: #667eea;
  border: none;
  padding: 16px 32px;
  font-size: 1.125rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

/* Features Section */
.features-section {
  padding: 120px 0;
  background: #f8fafc;
}

.features-section h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 80px;
  color: #2d3748;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 40px;
}

.feature-card {
  background: white;
  padding: 40px 32px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 24px;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 16px;
  color: #2d3748;
}

.feature-card p {
  color: #718096;
  line-height: 1.6;
}

/* Statistics Section */
.stats-section {
  padding: 120px 0;
  background: white;
}

.stats-section h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 80px;
  color: #2d3748;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 40px;
}

.stat-card {
  text-align: center;
  padding: 40px 20px;
}

.stat-value {
  font-size: 3rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 12px;
}

.stat-label {
  font-size: 1.125rem;
  color: #718096;
  font-weight: 500;
}

/* How It Works */
.how-it-works {
  padding: 120px 0;
  background: #f8fafc;
}

.how-it-works h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 80px;
  color: #2d3748;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 40px;
}

.step-card {
  background: white;
  padding: 40px 32px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.step-number {
  width: 60px;
  height: 60px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 auto 24px;
}

.step-card h3 {
  font-size: 1.25rem;
  margin-bottom: 16px;
  color: #2d3748;
}

.step-card p {
  color: #718096;
  line-height: 1.6;
}

/* FAQ Section */
.faq-section {
  padding: 120px 0;
  background: white;
}

.faq-section h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 80px;
  color: #2d3748;
}

.faq-list {
  max-width: 800px;
  margin: 0 auto;
}

.faq-item {
  border-bottom: 1px solid #e2e8f0;
}

.faq-question {
  width: 100%;
  padding: 24px 0;
  background: none;
  border: none;
  text-align: left;
  font-size: 1.125rem;
  font-weight: 600;
  color: #2d3748;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.faq-toggle {
  font-size: 1.5rem;
  color: #667eea;
}

.faq-answer {
  padding-bottom: 24px;
  color: #718096;
  line-height: 1.6;
}

/* Footer */
.footer {
  background: #2d3748;
  color: white;
  padding: 80px 0 40px;
}

.footer-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 40px;
  margin-bottom: 40px;
}

.footer-section h4 {
  font-size: 1.25rem;
  margin-bottom: 20px;
  color: white;
}

.footer-section ul {
  list-style: none;
  padding: 0;
}

.footer-section li {
  margin-bottom: 12px;
}

.footer-section a {
  color: #cbd5e0;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-section a:hover {
  color: white;
}

.footer-bottom {
  border-top: 1px solid #4a5568;
  padding-top: 40px;
  text-align: center;
  color: #cbd5e0;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }
  
  .hero-subtitle {
    font-size: 1.25rem;
  }
  
  .features-section h2,
  .stats-section h2,
  .how-it-works h2,
  .faq-section h2 {
    font-size: 2rem;
  }
  
  .features-grid,
  .stats-grid,
  .steps-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  
  .container {
    padding: 0 16px;
  }
}
</style>
