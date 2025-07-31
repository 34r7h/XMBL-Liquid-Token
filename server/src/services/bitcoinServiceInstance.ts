// Export a singleton instance for test compatibility
import { BitcoinService } from './bitcoinService';

// You may want to load config from env or test config here
const bitcoinService = new BitcoinService({
  rpcUrl: process.env.BTC_RPC_URL || 'http://localhost:8332',
  rpcUser: process.env.BTC_RPC_USER || 'user',
  rpcPassword: process.env.BTC_RPC_PASS || 'pass',
  network: process.env.BTC_NETWORK || 'testnet',
  privateKey: process.env.BTC_PRIVATE_KEY || undefined
});

export { bitcoinService };
