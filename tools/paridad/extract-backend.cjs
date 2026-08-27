// Extrae el arbol real de rutas del backend Express
const fs = require('fs');
const path = require('path');
// raiz del repo = tres niveles arriba de tools/paridad
const REPO = path.resolve(__dirname, '../../..');
const ROOT = path.join(REPO, 'backend');

// quita comentarios para no contar rutas deshabilitadas
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}
function read(p) { try { return stripComments(fs.readFileSync(p, 'utf8')); } catch { return null; } }

function resolveReq(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  let base = path.resolve(path.dirname(fromFile), spec);
  for (const c of [base, base + '.js', path.join(base, 'index.js')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const visited = new Set();
const routes = [];

function scan(file, prefix) {
  const key = file + '|' + prefix;
  if (visited.has(key)) return;
  visited.add(key);
  const src = read(file);
  if (!src) return;

  // mapa de variable -> archivo requerido
  const reqs = {};
  const reqRe = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = reqRe.exec(src))) {
    const r = resolveReq(file, m[2]);
    if (r) reqs[m[1]] = r;
  }
  // destructuring requires
  const reqRe2 = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reqRe2.exec(src))) {
    const r = resolveReq(file, m[2]);
    if (!r) continue;
    for (const n of m[1].split(',')) {
      const nm = n.split(':').pop().trim();
      if (nm) reqs[nm] = r;
    }
  }

  // app.use / router.use con montaje
  const useRe = /(?:app|router)\.use\(\s*['"]([^'"]+)['"]\s*,\s*([\w.]+)/g;
  while ((m = useRe.exec(src))) {
    const mount = m[1];
    const varName = m[2].split('.')[0];
    if (reqs[varName]) scan(reqs[varName], (prefix + mount).replace(/\/+/g, '/'));
  }

  // app.use('/path', require('./x')) -- require inline
  const useInline = /(?:app|router)\.use\(\s*['"]([^'"]+)['"]\s*,\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = useInline.exec(src))) {
    const r = resolveReq(file, m[2]);
    if (r) scan(r, (prefix + m[1]).replace(/\/+/g, '/'));
  }

  // metodos HTTP
  const mRe = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g;
  while ((m = mRe.exec(src))) {
    let p = (prefix + '/' + m[2]).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    routes.push({ method: m[1].toUpperCase(), path: p, file: path.relative(ROOT, file).replace(/\\/g, '/') });
  }
  const aRe = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g;
  while ((m = aRe.exec(src))) {
    let p = (prefix + '/' + m[2]).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    routes.push({ method: m[1].toUpperCase(), path: p, file: path.relative(ROOT, file).replace(/\\/g, '/') });
  }
}

const entry = fs.existsSync(path.join(ROOT, 'index.js')) ? path.join(ROOT, 'index.js')
  : fs.existsSync(path.join(ROOT, 'app.js')) ? path.join(ROOT, 'app.js')
  : path.join(ROOT, 'server.js');
console.log('# entry:', entry);
scan(entry, '');

routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
console.log('# total rutas:', routes.length);
fs.writeFileSync(path.join(__dirname, 'backend-routes.json'), JSON.stringify(routes, null, 1));
for (const r of routes) console.log(r.method.padEnd(6), r.path, '   [' + r.file + ']');
