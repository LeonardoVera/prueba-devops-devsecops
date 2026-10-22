const { test } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');

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

test('GET /health responde ok', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: 'ok' });
  }));

test('GET / sirve el index.html', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.strictEqual(res.status, 200);
    assert.match(await res.text(), /<title>/);
  }));

test('GET inexistente devuelve 404', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/nope.html`);
    assert.strictEqual(res.status, 404);
  }));
