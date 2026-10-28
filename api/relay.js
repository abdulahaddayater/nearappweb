// POST /api/relay { id, sender, signedDelegate (base64 borsh SignedDelegate) }
// Gasless settlement (NEP-366 meta-transaction): the sender signs a DelegateAction that calls
// ft_transfer on the USDC contract; the TapPay relayer wraps it in a transaction and pays the gas.
// Neither phone needs NEAR tokens.
const cfg = require('../lib/config');
const store = require('../lib/store');
const { send, body } = require('../lib/http');

let _relayer;
async function relayerAccount() {
  if (_relayer) return _relayer;
  const { connect, keyStores, KeyPair } = require('near-api-js');
  const ks = new keyStores.InMemoryKeyStore();
  await ks.setKey(cfg.networkId, cfg.relayer.accountId, KeyPair.fromString(cfg.relayer.privateKey));
  const near = await connect({ networkId: cfg.networkId, nodeUrl: cfg.nodeUrl, keyStore: ks });
  return (_relayer = await near.account(cfg.relayer.accountId));
}

// Only relay a delegate that pays exactly this request: one ft_transfer to the receiver for the amount, memo = id.
function checkDelegate(sd, r, sender) {
  const da = sd.delegateAction;
  if (da.senderId !== sender) throw new Error('sender mismatch');
  if (da.receiverId !== r.token) throw new Error('wrong token contract');
  if (da.actions.length !== 1 || !da.actions[0].functionCall) throw new Error('unexpected actions');
  const fc = da.actions[0].functionCall;
  if (fc.methodName !== 'ft_transfer') throw new Error('unexpected method');
  if (BigInt(fc.deposit.toString()) !== 1n) throw new Error('ft_transfer needs 1 yocto deposit');
  const args = JSON.parse(Buffer.from(fc.args).toString());
  if (args.receiver_id !== r.to || args.amount !== r.units || args.memo !== `tappay:${r.id}`) throw new Error('request mismatch');
}

function decodeSignedDelegate(b64) {
  const { SCHEMA } = require('@near-js/transactions');
  const { deserialize } = require('borsh');
  return deserialize(SCHEMA.SignedDelegate, Buffer.from(b64, 'base64'));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  let r;
  try {
    const { id, sender, signedDelegate } = await body(req);
    r = id && await store.get(id);
    if (!r) return send(res, 404, { error: 'request not found' });
    if (r.status !== 'pending') return send(res, 409, { error: `request is ${r.status}` }); // one-time ID: no replay
    if (Date.now() > r.expiresAt) { r.status = 'expired'; await store.put(r); return send(res, 410, { error: 'expired' }); }
    r.status = 'settling'; r.sender = sender; await store.put(r);

    if (cfg.demoMode) {
      // Simulation: no relayer key configured. Clearly flagged to clients as demoMode.
      await new Promise((ok) => setTimeout(ok, 1200));
      Object.assign(r, { status: 'paid', paidAt: Date.now(), txHash: null, simulated: true });
      await store.put(r);
      return send(res, 200, r);
    }

    const { transactions, utils } = require('near-api-js');
    const sd = decodeSignedDelegate(signedDelegate);
    checkDelegate(sd, r, sender);
    const relayer = await relayerAccount();
    // Relayer also covers the receiver's FT storage registration if needed (idempotent, relayer pays).
    try {
      await relayer.functionCall({ contractId: r.token, methodName: 'storage_deposit',
        args: { account_id: r.to, registration_only: true }, gas: 30_000_000_000_000n, attachedDeposit: utils.format.parseNearAmount('0.00125') });
    } catch (_) { /* already registered */ }
    const out = await relayer.signAndSendTransaction({ receiverId: sd.delegateAction.senderId, actions: [transactions.signedDelegate(sd)] });
    const failed = [out.status, ...out.receipts_outcome.map((o) => o.outcome.status)].some((s) => s && s.Failure);
    Object.assign(r, { status: failed ? 'failed' : 'paid', paidAt: Date.now(), txHash: out.transaction.hash });
    await store.put(r);
    send(res, failed ? 502 : 200, r);
  } catch (e) {
    if (r && r.status === 'settling') { r.status = 'pending'; await store.put(r).catch(() => {}); }
    send(res, 400, { error: e.message });
  }
};
module.exports.checkDelegate = checkDelegate;
module.exports.decodeSignedDelegate = decodeSignedDelegate;
