import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 4173);
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/replay.json', ['replay.json', 'application/json; charset=utf-8']],
  ['/media/agent-arena-x-card.png', ['media/agent-arena-x-card.png', 'image/png']],
]);

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/agent-arena/promo') {
    res.writeHead(302, { location: '/agent-arena/promo/' });
    res.end();
    return;
  }
  const localPath = pathname.startsWith('/agent-arena/promo/')
    ? pathname.slice('/agent-arena/promo'.length)
    : pathname;
  const item = req.method === 'GET' ? files.get(localPath) : null;
  if (!item) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const content = await readFile(fileURLToPath(new URL(`./${item[0]}`, import.meta.url)));
    res.writeHead(200, { 'content-type': item[1], 'x-content-type-options': 'nosniff' });
    res.end(content);
  } catch {
    res.writeHead(500); res.end('File unavailable');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Promo preview: http://127.0.0.1:${port}/`);
});
