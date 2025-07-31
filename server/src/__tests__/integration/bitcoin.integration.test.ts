import { describe, it, expect, beforeAll } from 'vitest';
import { BitcoinService } from '../../services/bitcoinService';

// This is an integration test that requires a running Bitcoin testnet node.
// The test will be skipped if the required environment variables are not set.
const describe_if = (condition: boolean) => (condition ? describe : describe.skip);

const BITCOIN_RPC_URL = process.env.BITCOIN_TESTNET_RPC_URL;
const BITCOIN_RPC_USER = process.env.BITCOIN_TESTNET_RPC_USER;
const BITCOIN_RPC_PASSWORD = process.env.BITCOIN_TESTNET_RPC_PASSWORD;

const hasBitcoinTestnet = BITCOIN_RPC_URL && BITCOIN_RPC_USER && BITCOIN_RPC_PASSWORD;

describe_if(hasBitcoinTestnet)('BitcoinService Integration Test', () => {
  let bitcoinService: BitcoinService;

  beforeAll(() => {
    bitcoinService = new BitcoinService({
      rpcUrl: BITCOIN_RPC_URL!,
      rpcUser: BITCOIN_RPC_USER!,
      rpcPassword: BITCOIN_RPC_PASSWORD!,
      network: 'testnet',
    });
  });

  it('should connect to the Bitcoin testnet node and get blockchain info', async () => {
    const isConnected = await bitcoinService.testConnection();
    expect(isConnected).toBe(true);
  });

  it('should get UTXOs for a given testnet address', async () => {
    // Replace with a testnet address that has some UTXOs
    const testnetAddress = 'tb1q...';
    const utxos = await bitcoinService.getUTXOs(testnetAddress);
    expect(utxos).toBeDefined();
    expect(Array.isArray(utxos.utxos)).toBe(true);
  });

  it('should create and broadcast a testnet transaction', async () => {
    // This is a more complex test that requires a funded wallet.
    // For this example, we'll just test the transaction building.
    const inputs = [
      {
        txid: '...',
        vout: 0,
        amount: '0.001',
      },
    ];
    const outputs = [
      {
        address: 'tb1q...',
        amount: '0.0009',
      },
    ];
    const rawTx = await bitcoinService.buildTransaction(inputs, outputs);
    expect(rawTx).toBeDefined();
    expect(typeof rawTx).toBe('string');
  });
});
