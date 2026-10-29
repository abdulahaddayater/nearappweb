// POST /api/relay { id, sender, signedDelegate (base64 borsh SignedDelegate) }
// Gasless settlement (NEP-366 meta-transaction): the sender signs a DelegateAction with a single native
// NEAR Transfer to the receiver; the TapPay relayer wraps it in a transaction and pays the gas.
// The sender only needs the NEAR being paid — no extra NEAR for gas.
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

// Only relay a delegate that pays exactly this request: one native NEAR Transfer to the receiver for the amount.
// (The one-time request ID is enforced server-side: a request can only be relayed once.)
function checkDelegate(sd, r, sender, blockHeight) {
  const da = sd.delegateAction;
  if (!sender || typeof sender !== 'string') throw new Error('sender required');
  if (da.senderId === r.to) throw new Error('cannot pay yourself');
  if (blockHeight != null && BigInt(da.maxBlockHeight.toString()) <= BigInt(blockHeight)) throw new Error('delegate expired (maxBlockHeight)');
  if (da.senderId !== sender) throw new Error('sender mismatch');
  if (da.receiverId !== r.to) throw new Error('wrong receiver');
  if (da.actions.length !== 1 || !da.actions[0].transfer) throw new Error('only a single NEAR transfer is allowed');
  if (da.actions[0].transfer.deposit.toString() !== r.units) throw new Error('amount mismatch');
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

    const { transactions } = require('near-api-js');
    if (!signedDelegate || typeof signedDelegate !== 'string') throw new Error('signedDelegate (base64) required — sign in with NEAR Auth');
    const sd = decodeSignedDelegate(signedDelegate);
    const relayer = await relayerAccount();
    const head = await relayer.connection.provider.block({ finality: 'final' });
    checkDelegate(sd, r, sender, head.header.height);
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
