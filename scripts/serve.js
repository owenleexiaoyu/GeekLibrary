const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.pdf': 'application/pdf'
};
function createPreviewServer(directory) {
  const root = fs.realpathSync(directory);
  return http.createServer(async (req, res) => {
    const finish = (status, message) => { res.writeHead(status); res.end(message); };
    if (!['GET', 'HEAD'].includes(req.method)) return finish(405, 'Method not allowed');
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      let file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep) && file !== root) return finish(403, 'Forbidden');
      file = await fs.promises.realpath(file);
      if (!file.startsWith(root + path.sep) && file !== root) return finish(403, 'Forbidden');
      let stat = await fs.promises.stat(file);
      if (stat.isDirectory()) {
        if (!url.pathname.endsWith('/')) {
          res.writeHead(308, { Location: url.pathname + '/' + url.search });
          return res.end();
        }
        file = await fs.promises.realpath(path.join(file, 'index.html'));
        if (!file.startsWith(root + path.sep)) return finish(403, 'Forbidden');
        stat = await fs.promises.stat(file);
      }
      if (!stat.isFile()) return finish(404, 'Not found');
      let start = 0, end = stat.size - 1, status = 200;
      const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
      if (req.headers.range) {
        const match = req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
        if (match && (match[1] || match[2])) {
          if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
          else start = Math.max(0, stat.size - Number(match[2]));
          if (start > end || start >= stat.size) {
            res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
            return res.end();
          }
          status = 206;
          headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
        }
      }
      headers['Content-Length'] = Math.max(0, end - start + 1);
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || !stat.size) return res.end();
      const stream = fs.createReadStream(file, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      finish(error instanceof URIError ? 400 : 404, 'Not found');
    }
  });
}
if (require.main === module) {
  const server = createPreviewServer(path.resolve(__dirname, '../dist'));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
}
module.exports = { createPreviewServer };
