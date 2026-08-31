// Minimal static file server for the repo root - the app itself has no
// build step (see the repo root package.json's own description) and loads
// its ES modules via plain `<script type="module">`/import-map tags, which
// browsers refuse to fetch under `file://` (module CORS restrictions). The
// headless pipeline needs a real `http://` origin to navigate Puppeteer to,
// so this exists purely for that - it's dev/pipeline tooling, never part of
// the deployed GitHub Pages site.
//
// Serves the *entire* repo root (two levels up from this file), not just
// the app's own pages, so `tools/reel-pipeline/patterns/*.json` and
// `tools/reel-pipeline/recipes/*.json` are reachable over HTTP too - a
// recipe's `pattern` field is fetched by the browser page itself (see
// ReelTimeline#load), not read off disk by Node.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Starts the server on `port` (default 5510 - arbitrary, just unlikely to
 * collide with anything else already running). Resolves once listening.
 * @param {number} [port]
 * @returns {Promise<import('node:http').Server>}
 */
export function startStaticServer(port = 5510) {
  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);
    // Reject any path that escapes REPO_ROOT after resolving `..` segments -
    // the request URL is untrusted input, and this server has no auth.
    const resolved = path.resolve(REPO_ROOT, '.' + requestPath);
    if (!resolved.startsWith(REPO_ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const filePath = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
      ? path.join(resolved, 'index.html')
      : resolved;

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const contentType = CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

// Allow `npm run serve` to start this standalone (e.g. to open /3d in a
// normal browser for a manual smoke test), in addition to `render.js`
// importing `startStaticServer` directly for the headless pipeline.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2]) || 5510;
  startStaticServer(port).then(() => {
    console.log(`Serving ${REPO_ROOT} at http://localhost:${port}/`);
  });
}
