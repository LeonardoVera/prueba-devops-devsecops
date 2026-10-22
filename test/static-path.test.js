const { test } = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const path = require('node:path');
const { resolveStaticPath } = require('../src/static-path');
const { createServer } = require('../src/server');

const BASE = path.resolve('/srv/public');

test('resuelve / a index.html', () => {
  assert.deepStrictEqual(resolveStaticPath(BASE, '/'), { filePath: path.join(BASE, 'index.html') });
});

test('resuelve archivos permitidos y descarta la query string', () => {
  assert.deepStrictEqual(resolveStaticPath(BASE, '/styles.css?v=1'), {
    filePath: path.join(BASE, 'styles.css'),
  });
});

test('rechaza con 403 las variantes de path traversal', () => {
  for (const url of ['/..%2fpackage.json', '/%2e%2e%2f%2e%2e%2fetc/passwd', '/..%2fsrc/server.js']) {
    assert.deepStrictEqual(resolveStaticPath(BASE, url), { status: 403 }, url);
  }
});

test('los segmentos %2e%2e se neutralizan y nunca salen del directorio base', () => {
  // El parser de URL los normaliza antes de resolver la ruta.
  assert.deepStrictEqual(resolveStaticPath(BASE, '/%2e%2e/package.json'), { status: 404 });
  assert.deepStrictEqual(resolveStaticPath(BASE, '/a/%2e%2e/%2e%2e/x.js'), {
    filePath: path.join(BASE, 'x.js'),
  });
});

test('rechaza con 400 bytes nulos, barras invertidas y codificación inválida', () => {
  for (const url of ['/index.html%00.css', '/..%5cpackage.json', '/%E0%A4%A']) {
    assert.deepStrictEqual(resolveStaticPath(BASE, url), { status: 400 }, url);
  }
});

test('rechaza con 404 extensiones no permitidas', () => {
  for (const url of ['/package.json', '/archivo.txt', '/sin-extension', '/.env']) {
    assert.deepStrictEqual(resolveStaticPath(BASE, url), { status: 404 }, url);
  }
});

// fetch normaliza la URL, así que se envía la petición cruda por un socket.
function rawRequest(port, requestPath) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, 'localhost', () => {
      socket.write(`GET ${requestPath} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    socket.on('data', (chunk) => (data += chunk));
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

test('el servidor bloquea traversal en peticiones crudas', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const { port } = server.address();
    const cases = {
      '/%2e%2e/package.json': 404,
      '/..%2fpackage.json': 403,
      '/..%2fsrc/server.js': 403,
      '/index.html%00.css': 400,
      '/package.json': 404,
    };
    for (const [url, status] of Object.entries(cases)) {
      const response = await rawRequest(port, url);
      assert.match(response, new RegExp(`^HTTP/1.1 ${status} `), url);
      assert.doesNotMatch(response, /"name": "prueba-devops/, url);
    }
  } finally {
    server.close();
  }
});
