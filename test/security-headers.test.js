const { test } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');
const { SECURITY_HEADERS, applySecurityHeaders } = require('../src/security-headers');

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const server = createServer().listen(0, async () => {
      try {
        await fn(`http://localhost:${server.address().port}`);
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

function assertSecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.strictEqual(res.headers.get(name), value, `falta o es incorrecta la cabecera ${name}`);
  }
}

test('applySecurityHeaders establece todas las cabeceras', () => {
  const set = {};
  applySecurityHeaders({ setHeader: (k, v) => (set[k] = v) });
  assert.deepStrictEqual(set, SECURITY_HEADERS);
});

test('la CSP no permite unsafe-inline ni unsafe-eval', () => {
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('GET / incluye las cabeceras de seguridad', () =>
  withServer(async (base) => {
    assertSecurityHeaders(await fetch(`${base}/`));
  }));

test('archivos estáticos incluyen las cabeceras de seguridad', () =>
  withServer(async (base) => {
    for (const file of ['styles.css', 'app.js']) {
      assertSecurityHeaders(await fetch(`${base}/${file}`));
    }
  }));

test('/health incluye las cabeceras de seguridad', () =>
  withServer(async (base) => {
    assertSecurityHeaders(await fetch(`${base}/health`));
  }));

test('las respuestas 404 incluyen las cabeceras de seguridad', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/no-existe.html`);
    assert.strictEqual(res.status, 404);
    assertSecurityHeaders(res);
  }));

test('no se expone X-Powered-By', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.strictEqual(res.headers.get('x-powered-by'), null);
  }));
