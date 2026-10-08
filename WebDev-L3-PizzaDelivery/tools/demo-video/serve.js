// Serves the BUILT client (client/dist) and forwards /api to the API, so the demo runs against a stable build on its own
// ports and never collides with the developer's own `npm run dev` servers. Usage: node serve.js [clientPort] [apiPort]
const http = require('http');
const fs = require('fs');
const path = require('path');

const CLIENT_PORT = Number(process.argv[2]) || 5273;
const API_PORT = Number(process.argv[3]) || 5100;
const DIST = path.resolve(__dirname, '../../client/dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    if (req.url.startsWith('/api')) {
      const upstream = http.request(
        { host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers: req.headers },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        }
      );
      upstream.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'API is not reachable.' }));
      });
      req.pipe(upstream);
      return;
    }
    const clean = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, clean);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(CLIENT_PORT, () => console.log(`demo client on http://localhost:${CLIENT_PORT} -> API ${API_PORT}`));
