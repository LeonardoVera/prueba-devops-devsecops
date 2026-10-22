const path = require('node:path');

const ALLOWED_EXTENSIONS = new Set(['.html', '.css', '.js']);

/**
 * Resuelve una URL de petición a un archivo dentro de baseDir.
 * Devuelve { filePath } si es válida o { status } con el código HTTP de rechazo.
 */
function resolveStaticPath(baseDir, rawUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return { status: 400 };
  }

  if (pathname.includes('\0') || pathname.includes('\\')) {
    return { status: 400 };
  }

  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(baseDir, '.' + requested);

  if (!filePath.startsWith(path.resolve(baseDir) + path.sep)) {
    return { status: 403 };
  }

  if (!ALLOWED_EXTENSIONS.has(path.extname(filePath))) {
    return { status: 404 };
  }

  return { filePath };
}

module.exports = { resolveStaticPath, ALLOWED_EXTENSIONS };
