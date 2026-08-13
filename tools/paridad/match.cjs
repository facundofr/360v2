// Cruza endpoints llamados por cada frontend contra las rutas reales del backend
const fs = require('fs');
const path = require('path');
const ROOTP = path.resolve(__dirname, '../../..');

const backend = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend-routes.json'), 'utf8'));

// normaliza: quita /api inicial, convierte :param -> :p, minusculas
function canon(p) {
  let s = p.replace(/^\/api(?=\/|$)/, '');
  s = s.replace(/:[A-Za-z0-9_]+/g, ':p');
  s = s.replace(/\/+/g, '/').replace(/\/$/, '');
  return s || '/';
}

const backendSet = new Map(); // canonPath -> Set(methods)
for (const r of backend) {
  const c = canon(r.path);
  if (!backendSet.has(c)) backendSet.set(c, new Set());
  backendSet.get(c).add(r.method);
}

// --- extraer llamadas frontend (reusa logica) ---
function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
function norm(raw) {
  let s = raw;
  s = s.replace(/\$\{[^}]*ENDPOINTS\.AUTH[^}]*\}/g, '/api/auth');
  s = s.replace(/\$\{[^}]*ENDPOINTS\.ADMIN[^}]*\}/g, '/api/admin');
  s = s.replace(/\$\{[^}]*ENDPOINTS\.PROSPECTOS[^}]*\}/g, '/api/prospectos');
  s = s.replace(/\$\{[^}]*ENDPOINTS\.TIPOS_AFILIACION[^}]*\}/g, '/api/tipos_afiliacion');
  s = s.replace(/\$\{[^}]*ENDPOINTS\.POLIZAS[^}]*\}/g, '/api/polizas');
  s = s.replace(/\$\{[^}]*ENDPOINTS\.LEAD[^}]*\}/g, '/api/lead');
  s = s.replace(/\$\{[^}]*ENDPOINTS\.PERFORMANCE[^}]*\}/g, '/performance');
  s = s.replace(/\$\{[^}]*ENDPOINTS\.BASE_URL[^}]*\}/g, '');
  s = s.replace(/\$\{[^}]*API_URL[^}]*\}/g, '/api');
  s = s.replace(/\$\{[^}]*BASE[^}]*\}/g, '');
  s = s.replace(/\$\{[^}]+\}/g, ':p');
  s = s.replace(/https?:\/\/[^/]+/g, '');
  s = s.split('?')[0].replace(/\/+/g, '/').replace(/\/$/, '');
  return s;
}
const CALL = /(?:axios|api)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*")|fetch\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
function extract(root, exts) {
  const map = new Map();
  for (const f of walk(root, exts)) {
    const src = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = CALL.exec(src)) !== null) {
      const method = m[1] ? m[1].toUpperCase() : 'GET?';
      const lit = (m[2] || m[3]).slice(1, -1);
      let p = norm(lit);
      if (!p.startsWith('/')) continue;
      // el frontend v2 usa api.get('/admin/..') con baseURL=/api  -> ya canonico
      const c = canon(p);
      const key = c;
      if (!map.has(key)) map.set(key, { methods: new Set(), files: new Set() });
      map.get(key).methods.add(method);
      map.get(key).files.add(path.relative(ROOTP, f).replace(/\\/g, '/'));
    }
  }
  return map;
}

const prod = extract(path.join(ROOTP, 'frontend/src'), ['.jsx', '.js']);
const v2 = extract(path.join(ROOTP, 'frontend-v2/src'), ['.tsx', '.ts']);

function report(name, map) {
  const bad = [];
  for (const [p, info] of map) {
    if (!backendSet.has(p)) bad.push([p, [...info.files]]);
  }
  console.log(`\n===== ${name}: ${map.size} endpoints, ${bad.length} SIN ruta backend =====`);
  bad.sort().forEach(([p, f]) => console.log('  ' + p.padEnd(60) + ' <- ' + f.join(', ')));
}
report('frontend (PRODUCCION)', prod);
report('frontend-v2', v2);

// gap funcional
const missing = [...prod.keys()].filter((p) => !v2.has(p) && backendSet.has(p)).sort();
console.log(`\n===== GAP REAL: endpoints backend usados en PROD y NO en V2 (${missing.length}) =====`);
for (const p of missing) console.log('  ' + p.padEnd(60) + ' <- ' + [...prod.get(p).files].join(', '));
