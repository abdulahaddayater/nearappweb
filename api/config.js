// GET /api/config -> public, non-secret client config
const cfg = require('../lib/config');
const { send } = require('../lib/http');
module.exports = (req, res) => send(res, 200, {
  network: cfg.networkId, explorer: cfg.explorer, nodeUrl: cfg.nodeUrl, token: cfg.token, demoMode: cfg.demoMode,
  relayer: cfg.relayer.accountId || null,
  nearAuth: { clientId: process.env.NEAR_AUTH_CLIENT_ID || null, url: process.env.NEAR_AUTH_URL || null },
});
