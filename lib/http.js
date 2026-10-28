module.exports.send = (res, code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };
module.exports.body = async (req) => { if (req.body && typeof req.body === 'object') return req.body; let s = ''; for await (const c of req) s += c; return s ? JSON.parse(s) : {}; };
