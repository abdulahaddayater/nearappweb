// End-to-end demo-mode check: receiver creates request -> sender relays -> both see Paid; replay rejected.
process.env.TAPPAY_DEMO_MODE = '1';
const http = require('http');
const port = 8099; process.env.PORT = port; require('./dev-server');
const call = (m, p, b) => new Promise((ok, no) => { const r = http.request({ port, path: p, method: m, headers: { 'content-type': 'application/json' } }, (res) => { let s = ''; res.on('data', (c) => s += c); res.on('end', () => ok({ code: res.statusCode, j: JSON.parse(s) })); }); r.on('error', no); if (b) r.write(JSON.stringify(b)); r.end(); });
(async () => {
  await new Promise((r) => setTimeout(r, 300));
  const c = await call('POST', '/api/requests', { to: 'alice.testnet', amount: '2.50' });
  if (c.code !== 201 || c.j.units !== '2500000000000000000000000' || c.j.symbol !== 'NEAR' || c.j.uri.includes('tok=') || !c.j.uri.includes('#pay?')) throw new Error('create failed ' + JSON.stringify(c));
  const p = await call('POST', '/api/relay', { id: c.j.id, sender: 'bob.testnet', signedDelegate: null });
  if (p.j.status !== 'paid') throw new Error('relay failed ' + JSON.stringify(p));
  const g = await call('GET', `/api/requests?id=${c.j.id}`);
  if (g.j.status !== 'paid') throw new Error('status not paid');
  const replay = await call('POST', '/api/relay', { id: c.j.id, sender: 'bob.testnet' });
  if (replay.code !== 409) throw new Error('replay not rejected');
  const bad = await call('POST', '/api/requests', { to: 'Bad Account', amount: '1' });
  if (bad.code !== 400) throw new Error('validation missing');
  // Real-path guards (no network): delegate validation + demo-mode switch.
  const { checkDelegate } = require('../api/relay');
  const r0 = { to: 'alice.testnet', units: '2500000000000000000000000' };
  const sd = (o = {}) => ({ delegateAction: { senderId: 'bob.testnet', receiverId: 'alice.testnet', maxBlockHeight: 200n,
    actions: [{ transfer: { deposit: BigInt(r0.units) } }], ...o } });
  checkDelegate(sd(), r0, 'bob.testnet', 100);
  for (const [bad, h] of [[sd({ receiverId: 'eve.testnet' }), 100], [sd({ actions: [{ transfer: { deposit: 1n } }] }), 100],
    [sd({ maxBlockHeight: 50n }), 100], [sd({ actions: [] }), 100]]) {
    let threw = false; try { checkDelegate(bad, r0, 'bob.testnet', h); } catch (_) { threw = true; }
    if (!threw) throw new Error('bad delegate accepted');
  }
  const cfg = require('../lib/config'); const env = process.env; delete env.TAPPAY_DEMO_MODE;
  Object.assign(cfg.relayer, { accountId: 'relayer.testnet', privateKey: 'ed25519:x' });
  if (!cfg.demoMode) throw new Error('should stay demo without NEAR Auth');
  Object.assign(cfg.nearAuth, { url: 'https://auth.example', clientId: 'c' });
  if (cfg.demoMode) throw new Error('should be real with relayer + NEAR Auth');
  console.log('smoke test OK'); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
