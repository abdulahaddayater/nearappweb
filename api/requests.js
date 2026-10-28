// POST /api/requests  {to, amount}           -> receiver creates a one-time payment request
// GET  /api/requests?id=...                   -> both phones poll status: pending | paid | expired | failed
const cfg = require('../lib/config');
const store = require('../lib/store');
const { toUnits, validateAccountId, encodeUri } = require('../lib/request');
const { send, body } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const { to, amount } = await body(req);
      if (!validateAccountId(to)) return send(res, 400, { error: 'invalid receiver account' });
      const n = Number(amount);
      if (!(n > 0) || n > cfg.maxAmount) return send(res, 400, { error: `amount must be between 0 and ${cfg.maxAmount}` });
      const r = { v: 1, id: store.newId(), to, amount: String(amount), units: toUnits(amount), token: cfg.token.contract,
        symbol: cfg.token.symbol, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + cfg.requestTtlMs };
      await store.put(r);
      const base = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
      return send(res, 201, { ...r, uri: encodeUri(base, r), network: cfg.networkId, demoMode: cfg.demoMode });
    }
    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      const r = id && await store.get(id);
      if (!r) return send(res, 404, { error: 'not found' });
      if (r.status === 'pending' && Date.now() > r.expiresAt) { r.status = 'expired'; await store.put(r); }
      return send(res, 200, { ...r, network: cfg.networkId, demoMode: cfg.demoMode, explorer: cfg.explorer });
    }
    send(res, 405, { error: 'method not allowed' });
  } catch (e) { send(res, 500, { error: e.message }); }
};
