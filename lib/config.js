// Shared server config. Testnet-first; every value can be overridden with env vars.
const env = process.env;
module.exports = {
  networkId: env.NEAR_NETWORK || 'testnet',
  nodeUrl: env.NEAR_RPC_URL || 'https://rpc.testnet.near.org',
  explorer: env.NEAR_EXPLORER || 'https://testnet.nearblocks.io',
  // Native NEAR only (24 decimals, amounts in yoctoNEAR on-chain). No fungible tokens.
  token: { contract: null, symbol: 'NEAR', decimals: 24 },
  relayer: {
    accountId: env.RELAYER_ACCOUNT_ID || '',
    privateKey: env.RELAYER_PRIVATE_KEY || '', // ed25519:... — server-side only, never shipped to clients
  },
  requestTtlMs: Number(env.REQUEST_TTL_MS || 5 * 60 * 1000),
  maxAmount: Number(env.MAX_AMOUNT || 100), // prototype cap in NEAR
  nearAuth: { url: env.NEAR_AUTH_URL || '', clientId: env.NEAR_AUTH_CLIENT_ID || '' },
  // Real settlement needs BOTH a relayer key and a NEAR Auth client (so senders can sign delegates).
  // When either is missing is configured the API settles requests in a clearly-labelled simulation mode.
  get demoMode() { return env.TAPPAY_DEMO_MODE === '1' || !this.relayer.accountId || !this.relayer.privateKey
    || !this.nearAuth.url || !this.nearAuth.clientId; },
};
