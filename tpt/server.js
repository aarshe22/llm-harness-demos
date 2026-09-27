import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const PORT = process.env.PORT || 8765;

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const candidates = [path.join(ROOT, path.normalize(urlPath))];
  const stripped = urlPath.replace(/^\/[^/]+(?=\/|$)/, '');
  if (stripped !== urlPath) candidates.push(path.join(ROOT, path.normalize(stripped === '' ? '/index.html' : stripped)));
  if (stripped === '/' || stripped === '') candidates.push(path.join(ROOT, 'index.html'));
  const tryFile = (i) => {
    if (i >= candidates.length) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const filePath = candidates[i];
    if (!filePath.startsWith(ROOT)) return tryFile(i + 1);
    fs.readFile(filePath, (err, data) => {
      if (err) return tryFile(i + 1);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  };
  tryFile(0);
}).listen(PORT, () => {
  console.log(`LSL running at http://localhost:${PORT}`);
});
