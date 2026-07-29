#!/usr/bin/env node
/**
 * A static file server for local development.
 *
 * Pocketbook has no build step, but ES modules and service workers both need a
 * real origin — opening index.html from the filesystem will not work. Node's
 * standard library is enough for this, so there is nothing to install.
 *
 *   node tools/serve.js [port]
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.pdf': 'application/pdf',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';

  const target = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(target);
    if (info.isDirectory()) { res.writeHead(301, { Location: `${path}/` }).end(); return; }

    res.writeHead(200, {
      'Content-Type': TYPES[extname(target)] || 'application/octet-stream',
      'Content-Length': info.size,
      // The service worker caches deliberately; a stale disk cache during
      // development only causes confusion.
      'Cache-Control': 'no-cache',
      // Not required today, but keeps the door open for threaded OCR builds.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Pocketbook is running at http://localhost:${PORT}`);
  console.log('Open it on a phone on the same network using this machine\'s LAN address.');
});
