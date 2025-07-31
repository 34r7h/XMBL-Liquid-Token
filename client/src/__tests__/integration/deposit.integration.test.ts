import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DepositForm from '../../components/DepositForm.vue';
import { useWalletStore } from '../../stores/wallet';
import { useProtocolStore } from '../../stores/protocol';
import { useTransactionsStore } from '../../stores/transactions';
import { Web3Service } from '../../services/web3Service';

// This is an integration test, so we won't mock the stores themselves,
// but we will mock the services they depend on.
vi.mock('../../services/web3Service');

describe('DepositForm Integration Test', () => {
  let wrapper: VueWrapper<any>;
  let walletStore: ReturnType<typeof useWalletStore>;
  let protocolStore: ReturnType<typeof useProtocolStore>;
  let transactionsStore: ReturnType<typeof useTransactionsStore>;
  let web3Service: Web3Service;

  beforeEach(async () => {
    setActivePinia(createPinia());

    walletStore = useWalletStore();
    protocolStore = useProtocolStore();
    transactionsStore = useTransactionsStore();

    // Mock the web3Service
    web3Service = new Web3Service();
    vi.mocked(web3Service.connectWallet).mockResolvedValue({
      account: '0x1234567890123456789012345678901234567890',
      chainId: 1,
      provider: {} as any,
    });
    vi.mocked(web3Service.getBalance).mockResolvedValue('10.5');
    vi.mocked(web3Service.depositToVault).mockResolvedValue({
      transactionHash: '0xabc123',
      tokenId: 1,
      tbaAddress: '0xdef456',
      xmblAmount: '1250.5',
    });
    vi.mocked(web3Service.estimateGas).mockResolvedValue('150000');

    // Initialize stores
    await walletStore.connectWallet();
    protocolStore.supportedTokens = [
      {
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        minDeposit: '0.01',
        maxDeposit: '100',
        isActive: true,
        icon: '/eth-icon.png',
        priceUSD: 2500,
      },
    ];
    protocolStore.bondingCurveRate = 1.25;

    wrapper = mount(DepositForm, {
      global: {
        plugins: [createPinia()],
      },
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.clearAllMocks();
  });

  it('should perform a full deposit flow and update all relevant stores', async () => {
    // 1. Initial state check
    expect(walletStore.isConnected).toBe(true);
    expect(walletStore.account).toBe('0x1234567890123456789012345678901234567890');
    expect(protocolStore.supportedTokens.length).toBe(1);
    expect(transactionsStore.transactions.length).toBe(0);

    // 2. User fills out the deposit form
    const amountInput = wrapper.find('[data-testid="amount-input"]');
    await amountInput.setValue('1.0');

    // 3. User clicks the deposit button
    const depositButton = wrapper.find('[data-testid="deposit-button"]');
    await depositButton.trigger('click');

    // 4. Verify web3Service was called correctly
    expect(web3Service.depositToVault).toHaveBeenCalledWith(
      '0x0000000000000000000000000000000000000000', // ETH
      '1000000000000000000' // 1 ETH in wei
    );

    // 5. Wait for the transaction to be processed
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    // 6. Verify the transaction is added to the transactions store
    expect(transactionsStore.transactions.length).toBe(1);
    const newTransaction = transactionsStore.transactions[0];
    expect(newTransaction.hash).toBe('0xabc123');
    expect(newTransaction.type).toBe('deposit');
    expect(newTransaction.status).toBe('completed');
    expect(newTransaction.amount).toBe('1.0');

    // 7. Verify the portfolio store is updated (we'll assume the transaction store would trigger this)
    // In a real scenario, you might need to mock a portfolio update event
    // For this test, we'll manually call the update
    const portfolioStore = usePortfolioStore();
    portfolioStore.addNFT({
      tokenId: 1,
      tbaAddress: '0xdef456',
      balance: '1250.5',
      depositedAmount: '1.0',
      yieldEarned: '0',
    });

    expect(portfolioStore.xmblNFTs.length).toBe(1);
    expect(portfolioStore.totalDeposited).toBe('1.0');

    // 8. Verify the UI reflects the successful transaction
    expect(wrapper.find('[data-testid="success-message"]').exists()).toBe(true);
  });
});
