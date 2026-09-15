// Demo gallery server — zero dependencies.
// Auto-scans top-level subfolders for an entry HTML page + a demo.json metadata
// file, and serves everything statically. Open http://localhost:4173 after
// running: node server.js
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '127.0.0.1';
// Passenger (used by Plesk's Node.js support) sets env vars prefixed
// PASSENGER_ / PX_ and provides the socket via a hook on net.Server.listen.
const ON_PASSENGER = Object.keys(process.env).some(
  (k) => k.startsWith('PASSENGER_') || k.startsWith('PX_')
);

// demo.json is the per-folder metadata file (see AGENT.md). First entry wins.
const META_FILES = ['demo.json', 'DEMO.json', 'demo.meta.json', '.demo.json'];

// Content hash (mtime/size change with git checkouts, so hash the bytes).
function shortHash(buf) {
  return 'sha1:' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
}

function hashFile(fileAbs, cap = 0) {
  try {
    const buf = fs.readFileSync(fileAbs);
    return { size: buf.length, hash: shortHash(cap ? buf.subarray(0, cap) : buf) };
  } catch {
    return { size: 0, hash: '' };
  }
}

const num = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
};
const str = (v) => {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
};

function normalizeMeta(raw) {
  return {
    modelName: str(raw.modelName ?? raw.model ?? raw.Model ?? raw.model_name ?? raw.modelName) ?? null,
    harness: str(raw.harness ?? raw.Harness ?? raw.harnessName) ?? null,
    maxContextWindow: num(raw.maxContextWindow ?? raw.max_context_window ?? raw.maxContext ?? raw.MaxContextWindow ?? raw.maxCtx ?? raw.contextWindow) ?? null,
    totalTokens: num(raw.totalTokens ?? raw.total_tokens ?? raw.totalToken ?? raw.TotalTokens ?? raw.tokens ?? raw.tokenUsage) ?? null,
    updated: str(raw.updated ?? raw.updatedAt ?? raw.updated_at ?? raw.date) ?? null,
    notes: str(raw.notes ?? raw.note ?? raw.description) ?? null,
    // raw so a client can surface unknown keys verbatim
    raw,
  };
}

const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '.vscode', '.idea', '.cache']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
};

const prettify = (name) =>
  name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

function findEntrySync(dirAbs) {
  let items;
  try {
    items = fs.readdirSync(dirAbs);
  } catch {
    return null;
  }
  const htmls = items.filter((f) => /\.html?$/i.test(f));
  if (!htmls.length) return null;
  const lower = htmls.map((h) => h.toLowerCase());
  let pick = htmls[lower.indexOf('index.html')] || htmls[lower.indexOf('index.htm')];
  if (!pick) {
    const base = path.basename(dirAbs).toLowerCase();
    pick = htmls[lower.indexOf(base + '.html')] || htmls[lower.indexOf(base + '.htm')] || [...htmls].sort()[0];
  }
  return pick;
}

function readTitle(fileAbs, fallback) {
  try {
    const fd = fs.openSync(fileAbs, 'r');
    const buf = Buffer.alloc(65536);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const head = buf.toString('utf8', 0, bytes);
    const m = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m && m[1].trim()) return m[1].trim();
  } catch {
    /* ignore */
  }
  return fallback;
}

function readMeta(dirAbs) {
  for (const name of META_FILES) {
    const p = path.join(dirAbs, name);
    let buf;
    try {
      buf = fs.readFileSync(p);
    } catch {
      continue; // not this filename, try next
    }
    const text = buf.toString('utf8');
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return {
          meta: normalizeMeta(parsed),
          metaFile: name,
          metaHash: shortHash(buf),
          error: null,
        };
      }
    } catch (err) {
      return { meta: null, metaFile: name, metaHash: shortHash(buf), error: String(err && err.message) };
    }
  }
  return { meta: null, metaFile: null, metaHash: '', error: null };
}

function scanDemos() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  const demos = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const dirAbs = path.join(ROOT, e.name);
    const entry = findEntrySync(dirAbs);
    if (!entry) continue; // presence check: folder + an html entry
    const entryAbs = path.join(dirAbs, entry);
    const { meta, metaFile, metaHash, error } = readMeta(dirAbs);
    demos.push({
      folder: e.name,
      entry,
      title: readTitle(entryAbs, prettify(e.name)),
      url: '/' + encodeURIComponent(e.name) + '/' + encodeURIComponent(entry),
      entryHash: hashFile(entryAbs).hash,
      meta,
      metaFile,
      metaHash,
      metaError: error,
    });
  }
  demos.sort((a, b) => a.title.localeCompare(b.title));
  return demos;
}

function resolveSafe(pathname) {
  const rel = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const abs = path.resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null; // blocked traversal
  return abs;
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

function serveFile(res, abs) {
  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(abs);
  stream.on('error', () => send(res, 500, 'Internal Server Error'));
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }

  if (pathname === '/health' || pathname === '/healthz') {
    return send(res, 200, JSON.stringify({
      ok: true,
      mode: ON_PASSENGER ? 'passenger' : 'direct',
      root: ROOT,
      node: process.version,
    }), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  }

  if (pathname === '/api/demos') {
    try {
      const demos = scanDemos();
      return send(res, 200, JSON.stringify(demos), {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
    } catch (err) {
      return send(res, 500, JSON.stringify({ error: String(err && err.message) }), {
        'Content-Type': 'application/json; charset=utf-8',
      });
    }
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const abs = resolveSafe(pathname);
  if (!abs) return send(res, 403, 'Forbidden');

  fs.stat(abs, (err, stat) => {
    if (err) return send(res, 404, 'Not Found');
    if (stat.isDirectory()) {
      const entry = findEntrySync(abs);
      if (!entry) return send(res, 404, 'Not Found');
      return serveFile(res, path.join(abs, entry));
    }
    serveFile(res, abs);
  });
});

function banner(addr) {
  let count = 0, folders = '';
  try {
    const demos = scanDemos();
    count = demos.length;
    folders = demos.map((d) => d.folder).join(', ') || '(none yet)';
  } catch (err) {
    console.error('[demo-gallery] scan error:', err && err.message);
  }
  console.log(
    `[demo-gallery] listening · mode=${ON_PASSENGER ? 'passenger' : 'direct'} · ` +
    `addr=${JSON.stringify(addr)} · root=${ROOT} · ${count} demo(s): ${folders}`
  );
}

server.on('clientError', (err, socket) => {
  if (socket && !socket.destroyed) socket.destroy();
});

server.on('error', (err) => {
  console.error('[demo-gallery] server error:', err && err.message);
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[demo-gallery] port ${PORT} busy; set PORT env to change it.`);
  }
});

// Under Passenger (Plesk), the socket is provided by a hook on net.Server.listen —
// calling listen() with no host/port lets Passenger wire it correctly.
if (ON_PASSENGER) {
  server.listen(() => banner(server.address()));
} else {
  server.listen(PORT, HOST, () => banner(server.address()));
}
