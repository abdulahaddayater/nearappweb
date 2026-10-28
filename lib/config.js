// Shared server config. Testnet-first; every value can be overridden with env vars.
const env = process.env;
module.exports = {
  networkId: env.NEAR_NETWORK || 'testnet',
  nodeUrl: env.NEAR_RPC_URL || 'https://rpc.testnet.near.org',
  explorer: env.NEAR_EXPLORER || 'https://testnet.nearblocks.io',
  // USDC (test) — the testnet "fake USDC" FT contract, 6 decimals.
  token: { contract: env.USDC_CONTRACT || 'usdc.fakes.testnet', symbol: 'USDC', decimals: 6 },
  relayer: {
    accountId: env.RELAYER_ACCOUNT_ID || '',
    privateKey: env.RELAYER_PRIVATE_KEY || '', // ed25519:... — server-side only, never shipped to clients
  },
  requestTtlMs: Number(env.REQUEST_TTL_MS || 5 * 60 * 1000),
  maxAmount: Number(env.MAX_AMOUNT || 1000), // prototype cap in USDC
  // When no relayer is configured the API settles requests in a clearly-labelled simulation mode.
  get demoMode() { return env.TAPPAY_DEMO_MODE === '1' || !this.relayer.accountId || !this.relayer.privateKey; },
};
