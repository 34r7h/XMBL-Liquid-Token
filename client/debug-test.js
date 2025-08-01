import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import TransactionHistory from './src/components/TransactionHistory.vue'

// Mock the stores
vi.mock('./src/stores/transactions', () => ({
  useTransactionsStore: () => ({
    transactions: [],
    filteredTransactions: [],
    isLoading: false,
    hasMore: true,
    fetchTransactionHistory: vi.fn(),
    filterTransactions: vi.fn(),
  }),
}))

vi.mock('./src/stores/wallet', () => ({
  useWalletStore: () => ({
    isConnected: true,
    account: '0x123',
  }),
}))

setActivePinia(createPinia())

const wrapper = mount(TransactionHistory, {
  global: {
    plugins: [createPinia()],
  },
})

console.log('HTML:', wrapper.html())
console.log(
  'Find transaction-history:',
  wrapper.find('[data-testid="transaction-history"]').exists(),
)
console.log('Find transactions-table:', wrapper.find('[data-testid="transactions-table"]').exists())
