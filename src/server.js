const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { applySecurityHeaders } = require('./security-headers');
const { resolveStaticPath } = require('./static-path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const STATUS_MESSAGES = { 400: 'Bad request', 403: 'Forbidden', 404: 'Not found' };

function createServer() {
  return http.createServer((req, res) => {
    applySecurityHeaders(res);

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok' }));
    }

    const { filePath, status } = resolveStaticPath(PUBLIC_DIR, req.url);
    if (status) {
      res.writeHead(status);
      return res.end(STATUS_MESSAGES[status]);
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end(STATUS_MESSAGES[404]);
      }
      res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] });
      res.end(data);
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
}

module.exports = { createServer };
