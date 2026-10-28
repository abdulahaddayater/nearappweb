// The TapPay payment request: the ONLY thing carried by an NFC tap or QR code.
// { v, id (one-time), to (receiver NEAR account), amount (decimal string), token (FT contract) }
const cfg = require('./config');

function toUnits(amount, decimals = cfg.token.decimals) {
  const [w, f = ''] = String(amount).split('.');
  if (!/^\d+$/.test(w) || !/^\d*$/.test(f) || f.length > decimals) throw new Error('bad amount');
  return (BigInt(w) * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || 0)).toString();
}
function validateAccountId(a) {
  return typeof a === 'string' && a.length >= 2 && a.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a);
}
// Compact wire format used on NFC (NDEF URI record) and in QR codes: an https link that opens the sender flow.
function encodeUri(base, req) {
  const q = new URLSearchParams({ id: req.id, to: req.to, amt: req.amount, tok: req.token });
  return `${base.replace(/\/$/, '')}/app/#pay?${q}`;
}
module.exports = { toUnits, validateAccountId, encodeUri };
