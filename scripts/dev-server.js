// Minimal local server: serves static files and the /api/* functions (same handlers Vercel runs).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), port = process.env.PORT || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p.startsWith('/api/')) {
    const f = path.join(root, 'api', path.basename(p) + '.js');
    if (fs.existsSync(f)) return require(f)(req, res);
    res.statusCode = 404; return res.end('{}');
  }
  let f = path.join(root, path.normalize(p));
  if (!f.startsWith(root)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`TapPay dev server on http://localhost:${port} (demoMode=${require('../lib/config').demoMode})`));
