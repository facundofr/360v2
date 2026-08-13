// Segunda pasada sobre el GAP: descarta falsos positivos.
//
// match.cjs no resuelve endpoints armados con variables
// (`${API_URL}/admin/${endpoint}/${id}`) ni concatenaciones con `+`,
// así que reporta como faltantes rutas que sí están implementadas.
//
// Acá verificamos cada ruta contra el fuente de v2 con criterio ESTRICTO:
// el fragmento buscado debe tener al menos 2 segmentos de path y aparecer
// precedido por `/`, para no matchear palabras sueltas como "estadisticas".
//
// Uso:  node match.cjs > salida.txt  &&  node verify-gap.cjs salida.txt
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const V2 = path.join(REPO, 'frontend-v2/src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const sources = walk(V2).map((f) => ({
  file: path.relative(V2, f).replace(/\\/g, '/'),
  src: fs.readFileSync(f, 'utf8'),
}));

// ─── Leer el GAP desde la salida de match.cjs ────────────────────────────────
const input = fs.readFileSync(process.argv[2], 'utf8');
const gapSection = input.split('GAP REAL')[1] ?? '';
const GAP = [...gapSection.matchAll(/^\s{2}(\/\S+)/gm)].map((m) => m[1]);

if (GAP.length === 0) {
  console.log('No hay endpoints en el GAP. 🎉');
  process.exit(0);
}

/**
 * Candidatos literales de la ruta, de más específico a menos.
 * Sólo colas de >= 2 segmentos: un segmento suelto ("estadisticas",
 * "prospectos") aparece en decenas de lugares y da falsos "ya implementado".
 */
function fragments(route) {
  const segs = route.split('/').filter(Boolean);
  const out = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const tail = segs.slice(i);
    // los :p son comodines: cortamos el fragmento en el primero que aparezca
    const upto = tail.indexOf(':p');
    const piece = (upto === -1 ? tail : tail.slice(0, upto));
    if (piece.length >= 2) out.push('/' + piece.join('/'));
  }
  return [...new Set(out)].sort((a, b) => b.length - a.length);
}

const real = [];
const falsos = [];

for (const route of GAP) {
  const frags = fragments(route);
  if (frags.length === 0) { real.push([route, '(ruta demasiado corta para verificar)']); continue; }
  let hit = null;
  for (const f of frags) {
    hit = sources.find((s) => s.src.includes(f))
    if (hit) { hit = { ...hit, frag: f }; break }
  }
  if (hit) falsos.push([route, hit.file, hit.frag]);
  else real.push([route, '']);
}

console.log(`\n### GAP REAL confirmado — falta implementar (${real.length})`);
real.forEach(([r, n]) => console.log('  ✗ ' + r + (n ? '  ' + n : '')));
console.log(`\n### Falsos positivos de match.cjs — ya implementados (${falsos.length})`);
falsos.forEach(([r, f, frag]) =>
  console.log('  ✓ ' + r.padEnd(52) + ' → ' + f + '  [' + frag + ']')
);
console.log(`\nTotal analizado: ${GAP.length}`);
