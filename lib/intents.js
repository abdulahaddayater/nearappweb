// STRETCH (not shipped): cross-chain payout via NEAR Intents.
// The receiver would pick a payout chain (Base, Arbitrum, Solana…) when creating the request; after the USDC
// lands on NEAR, the relayer would publish an intent (via the Intents solver relay / 1Click API) swapping/bridging
// to the receiver's address on that chain. Confidential Intents would make the payout private (Track 03).
// Blocked for the demo: NEAR Intents has no testnet, and this prototype is testnet-only.
const SUPPORTED = ['near', 'base', 'arbitrum', 'solana'];
async function quotePayout(/* { chain, address, amountUnits } */) {
  throw new Error('NEAR Intents payout not implemented (mainnet-only; stretch goal)');
}
module.exports = { SUPPORTED, quotePayout, enabled: false };
