// SPDX-License-Identifier: MIT
// Local-only static server; no transpiler, install, or build is needed.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game/', import.meta.url)));
const flag = process.argv.indexOf('--port'), port = flag < 0 ? 8080 : Number(process.argv[flag + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain',
};
createServer((request, response) => {
  let path: string;
  try { path = decodeURIComponent(new URL(request.url || '/', 'http://local').pathname); }
  catch { response.writeHead(400).end('Invalid path'); return; }
  if (path.includes('\0')) { response.writeHead(400).end('Invalid path'); return; }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(root, '.' + path);
  if (!file.startsWith(root + sep)) { response.writeHead(403).end('Forbidden'); return; }
  try {
    const stat = statSync(file); if (!stat.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Length': stat.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => process.stdout.write(`Sunset Syndicate: http://127.0.0.1:${port}\n`));
