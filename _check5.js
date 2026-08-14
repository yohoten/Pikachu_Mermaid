const fs = require('fs');
const h = fs.readFileSync('index.html', 'utf8');
let errors = [];

const links = [...h.matchAll(/<link[^>]*href="([^"]+\.ico)"[^>]*>/g)].map(m => m[1]);
console.log('[icon] links:', JSON.stringify(links));
for (const f of links) {
  console.log('[icon]', f, fs.existsSync(f) ? 'EXISTS' : 'MISSING');
  if (!fs.existsSync(f)) errors.push('missing icon file: ' + f);
}

const inline = h.match(/<script>([\s\S]*?)<\/script>/)[1];
try { new Function(inline); console.log('[JS] syntax OK'); }
catch (e) { errors.push('JS: ' + e.message); console.log('[JS] FAIL ' + e.message); }

console.log('[meta] theme-color:', h.includes('theme-color'));
console.log(errors.length ? 'FAILED: ' + errors.join('; ') : 'ALL OK');
process.exit(errors.length ? 1 : 0);
