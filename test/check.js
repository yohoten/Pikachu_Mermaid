/* Pikachu Mermaid — 回归测试脚本
 * 用法: node test/check.js
 * 校验：JS 语法、HTML 标签平衡、ID 唯一与引用完整、关键功能存在性、模板加载顺序
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const htmlPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
let errors = [];
let pass = 0;

function ok(label, cond) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { errors.push(label); console.log('  ✗ ' + label); }
}

console.log('== 1. JS 语法 ==');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
try { new Function(inline); ok('内联 JS 语法', true); }
catch (e) { ok('内联 JS 语法', false); console.log('     ' + e.message); }

console.log('== 2. HTML 标签平衡（跳过 void 元素）==');
const VOID = ['input', 'br', 'img', 'hr', 'meta', 'link'];
for (const tag of ['div', 'span', 'select', 'button', 'label', 'textarea', 'h3', 'optgroup']) {
  const open = (html.match(new RegExp('<' + tag + '(\\s|>)', 'g')) || []).length;
  const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  ok('<' + tag + '> ' + open + '/' + close, open === close);
}

console.log('== 3. ID 唯一 + 引用完整 ==');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const unique = new Set(ids);
const used = new Set([...html.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]));
const missing = [...used].filter(u => !unique.has(u));
const dups = ids.filter((v, i) => ids.indexOf(v) !== i);
ok('ID 无重复', dups.length === 0);
if (dups.length) console.log('     重复: ' + JSON.stringify(dups));
ok('JS 引用无缺失', missing.length === 0);
if (missing.length) console.log('     缺失: ' + JSON.stringify(missing));

console.log('== 4. 关键功能存在性 ==');
ok('实时预览 renderPreview', html.includes('async function renderPreview'));
ok('语法高亮 highlight', /function highlight\(code,\s*errorLine\)/.test(html));
ok('错误波浪线 tok-err', html.includes('.tok-err'));
ok('撤销/重做 HistoryManager', html.includes('class HistoryManager'));
ok('模板管理 localStorage', html.includes('TEMPLATES_KEY'));
ok('模板按类型分组 optgroup', html.includes('document.createElement("optgroup")'));
ok('多标签页 docs 管理', html.includes('let docs = []'));
ok('大纲导航 renderOutline', html.includes('function renderOutline'));
ok('导出 PDF', html.includes('btnExportPdf') && html.includes('window.print()'));
ok('导出 Markdown', html.includes('btnExportMd'));
ok('全屏预览', html.includes('toggleFullscreen') && html.includes('btnFullscreen'));
ok('Ctrl+滚轮缩放', html.includes('previewScroll.addEventListener("wheel"'));
ok('PWA manifest 链接', html.includes('rel="manifest"'));
ok('SW 注册', html.includes('navigator.serviceWorker.register'));
ok('草稿自动保存 scheduleDraft', html.includes('function scheduleDraft'));
ok('GBK 兼容打开', html.includes('TextDecoder("gbk")'));
ok('未保存提示 beforeunload', html.includes('beforeunload'));
ok('应用图标', html.includes('Pikachu_Mermaid.ico'));

console.log('== 5. 引用一致性 ==');
ok('无残留 TEMPLATES[ 引用', [...html.matchAll(/[^A-Z_]TEMPLATES\[/g)].length === 0);
const loadIdx = html.indexOf('let templates = loadTemplates()');
const refreshIdx = html.indexOf('refreshTemplateSelect()');
ok('模板加载先于下拉渲染', loadIdx !== -1 && refreshIdx !== -1 && loadIdx < refreshIdx);

// 本地资源存在性
for (const f of ['mermaid.min.js', 'Pikachu_Mermaid.ico', 'manifest.webmanifest', 'sw.js']) {
  ok('资源存在: ' + f, fs.existsSync(path.join(ROOT, f)));
}

console.log('');
if (errors.length) {
  console.log('FAILED (' + errors.length + '): ' + errors.join('; '));
  process.exit(1);
}
console.log('ALL CHECKS PASSED (' + pass + ')');
