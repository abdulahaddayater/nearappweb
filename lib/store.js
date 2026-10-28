// Payment-request store. Uses Upstash/Vercel KV REST if configured, else in-memory (single instance / local dev).
const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL, TOKEN = process.env.KV_REST_API_TOKEN;
const mem = globalThis.__tappayMem || (globalThis.__tappayMem = new Map());

async function kv(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
async function get(id) {
  if (URL_ && TOKEN) { const v = await kv(['GET', `req:${id}`]); return v ? JSON.parse(v) : null; }
  return mem.get(id) || null;
}
async function put(req) {
  if (URL_ && TOKEN) { await kv(['SET', `req:${req.id}`, JSON.stringify(req), 'PX', 24 * 3600 * 1000]); return req; }
  mem.set(req.id, req); return req;
}
const newId = () => crypto.randomBytes(12).toString('base64url');
module.exports = { get, put, newId };
