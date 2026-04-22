import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const PORT = 3000;
const ROOT = fileURLToPath(new URL('.', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
};

createServer(async (req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath    = join(ROOT, urlPath);
  const ext         = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const isVideo     = ['.mp4', '.webm', '.mov'].includes(ext);

  try {
    const stats = await stat(filePath);
    const total = stats.size;

    if (isVideo && req.headers.range) {
      // Parse Range header — e.g. "bytes=0-"
      const range  = req.headers.range;
      const parts  = range.replace(/bytes=/, '').split('-');
      const start  = parseInt(parts[0], 10);
      const end    = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${total}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize,
        'Content-Type':   contentType,
      });

      createReadStream(filePath, { start, end }).pipe(res);
    } else if (isVideo) {
      // First request — tell browser we support ranges
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type':   contentType,
        'Accept-Ranges':  'bytes',
      });
      createReadStream(filePath).pipe(res);
    } else {
      // Non-video: read into memory as before
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  } catch {
    try {
      const data = await readFile(filePath + '.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
    }
  }
}).listen(PORT, () => {
  console.log(`Renegade Reach running at http://localhost:${PORT}`);
});
