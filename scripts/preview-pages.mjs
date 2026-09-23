// Serves the assembled site/ directory locally, mimicking GitHub Pages:
// static files, directory index.html (301 to add the trailing slash),
// extensionless .html lookup, and the root 404.html served with status 404
// for anything missing, which is what makes deep links into the
// history-routed demos work (the injected redirect script runs from 404.html).
//
// Usage: node scripts/preview-pages.mjs
//   PAGES_BASE: mount path, must match the base site/ was built with
//               (defaults to /, i.e. `PAGES_BASE=/ npm run build:pages`)
//   PORT:       listen port (defaults to 4321)
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = fileURLToPath(new URL('../site', import.meta.url));

const rawBase = process.env.PAGES_BASE !== undefined ? process.env.PAGES_BASE : '/';
const base = rawBase.endsWith('/') ? rawBase : rawBase + '/';
const port = process.env.PORT !== undefined ? Number(process.env.PORT) : 4321;

if (!existsSync(join(siteDir, 'index.html'))) {
  console.error('site/ has not been assembled yet. Run this first:');
  console.error(`  PAGES_BASE=${base} npm run build:pages`);
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json'
};

function sendFile(res, filePath, status) {
  const contentType = mimeTypes[extname(filePath).toLowerCase()];
  res.writeHead(status, {
    'content-type': contentType !== undefined ? contentType : 'application/octet-stream',
    'cache-control': 'no-store'
  });
  createReadStream(filePath).pipe(res);
}

function sendNotFound(res) {
  const notFoundPath = join(siteDir, '404.html');
  if (existsSync(notFoundPath)) {
    sendFile(res, notFoundPath, 404);
  }
  else {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  }
  catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (base !== '/' && (urlPath === '/' || urlPath + '/' === base)) {
    res.writeHead(302, { location: base });
    res.end();
    return;
  }
  if (!urlPath.startsWith(base)) {
    sendNotFound(res);
    return;
  }

  const filePath = resolve(siteDir, urlPath.slice(base.length));
  if (filePath !== siteDir && !filePath.startsWith(siteDir + sep)) {
    sendNotFound(res);
    return;
  }

  const stats = existsSync(filePath) ? statSync(filePath) : null;
  if (stats !== null && stats.isFile()) {
    sendFile(res, filePath, 200);
  }
  else if (stats !== null && stats.isDirectory()) {
    if (!urlPath.endsWith('/')) {
      res.writeHead(301, { location: urlPath + '/' });
      res.end();
    }
    else if (existsSync(join(filePath, 'index.html'))) {
      sendFile(res, join(filePath, 'index.html'), 200);
    }
    else {
      sendNotFound(res);
    }
  }
  else if (existsSync(filePath + '.html')) {
    sendFile(res, filePath + '.html', 200);
  }
  else {
    sendNotFound(res);
  }
});

server.listen(port, () => {
  console.log(`previewing site/ at http://localhost:${port}${base}`);
  if (base !== '/') {
    console.log(`(mounted at ${base}, so make sure site/ was built with PAGES_BASE=${base})`);
  }
});
