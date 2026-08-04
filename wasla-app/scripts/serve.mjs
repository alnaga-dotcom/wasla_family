import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT || 8081;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const DEFAULT_API_BASE = process.env.WASLA_API_BASE || 'http://127.0.0.1:4000';

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/config.json') {
    const cfgPath = join(ROOT, 'config.json');
    const data = existsSync(cfgPath)
      ? readFileSync(cfgPath)
      : Buffer.from(JSON.stringify({ apiBase: DEFAULT_API_BASE }, null, 2));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(data);
    return;
  }

  let filePath = join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!existsSync(filePath) || (existsSync(filePath) && filePath.endsWith('/'))) {
    filePath = join(ROOT, 'index.html');
  }
  const ext = extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Service-Worker-Allowed': '/',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Wasla app served at http://127.0.0.1:${PORT}`);
});
