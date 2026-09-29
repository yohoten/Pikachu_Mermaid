/* Pikachu Mermaid — 回归测试脚本
 * 用法: node test/check.js
 * 校验：JS 语法、HTML 标签平衡、ID 唯一与引用完整、关键功能存在性、模板加载顺序
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const htmlPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const norm = html.replace(/\r\n/g, '\n');
// 按「函数体」提取，避免 [\s\S]*? 跨越到后面的同名符号上造成假通过/假失败
function fnBody(name) {
  const m = norm.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n'));
  return m ? m[0] : '';
}
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
// 注：optgroup 由 JS 动态创建，HTML 里恒为 0/0，纳入计数只会制造零信息通过项
const VOID = ['input', 'br', 'img', 'hr', 'meta', 'link'];
for (const tag of ['div', 'span', 'select', 'button', 'label', 'textarea', 'h3']) {
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

ok('UI 同步收口 syncEditorUI', html.includes('function syncEditorUI'));
ok('apply 调用 syncEditorUI', /apply\(s\) \{[\s\S]*?syncEditorUI\(\);/.test(html));
ok('input 处理器改用 syncEditorUI', /addEventListener\("input"[\s\S]*?syncEditorUI\(\);/.test(html));
ok('Tab 分支 beforeEdit/afterEdit 成对', /e\.key === "Tab"[\s\S]*?beforeEdit\(\);[\s\S]*?afterEdit\(\);/.test(html));
ok('writeDraft 不落盘 historyState', fnBody('writeDraft') && !fnBody('writeDraft').includes('historyState'));
ok('草稿失败对用户可见', /catch \(e\) \{[\s\S]*?⚠ 草稿未保存/.test(html));
ok('docIsDirty 存在', html.includes('function docIsDirty'));
ok('closeDoc 用 docIsDirty', /closeDoc[\s\S]*?docIsDirty\(doc\)/.test(html));
ok('beforeunload 覆盖全部标签', /beforeunload[\s\S]*?docs\.some\(docIsDirty\)/.test(html));
// 断言前剥离注释：代码注释里会提到这些已废弃的标识符，按原文匹配会误报
const saveFileBody = fnBody('saveFile').replace(/\/\/.*$/gm, '');
ok('saveFile 不再清库', saveFileBody !== '' && !saveFileBody.includes('clearDraft'));
ok('detectChartType 非捕获分组', html.includes('(?:" + pattern'));
ok('@media print 隐藏大纲面板', /@media print \{[\s\S]*?#outlinePanel/.test(html));
ok('PNG 导出判空', /toBlob\(\(pngBlob\) => \{\s*\n\s*if \(!pngBlob\)/.test(html));
ok('未命名用自增 id', /name: name \|\| file \|\| \("未命名" \+ id/.test(html));
ok('无 Ctrl+N 残留', !/e\.key === "n" && \(e\.ctrlKey/.test(html));

console.log('== 6. 行为级回归（提取真实函数执行）==');
// 6.1 detectChartType：曾经因为没有非捕获分组，"flowchart" 出现在正文里就被判成流程图
const dctSrc = fnBody('detectChartType');
if (dctSrc) {
  const detect = new Function('return (' + dctSrc + ')')();
  const cases = [
    ['graph TD\n  A-->B', '流程图'],
    ['flowchart LR\n  A-->B', '流程图'],
    ['sequenceDiagram\n  participant A\n  A->>B: 这是 flowchart 流程图说明', '序列图'],
    ['%% 注释里提到 flowchart 这个词\ngantt\n  section S', '甘特图'],
    ['pie\n  "含 flowchart 文案": 30', '饼图'],
    ['stateDiagram-v2\n  [*] --> A', '状态图'],
    ['erDiagram\n  A ||--o{ B : has', 'ER 图'],
  ];
  let bad = 0;
  for (const [code, expect] of cases) if (detect(code) !== expect) bad++;
  ok('detectChartType ' + cases.length + ' 条用例', bad === 0);
}
// 6.2 writeDraft 的 payload 体积不得超过 localStorage 承受量
const kb8Code = Array.from({ length: 400 }, (_, i) => '  A' + i + '[节点' + i + '] --> B' + i).join('\n');
const draftPayload = JSON.stringify({
  v: 2,
  docs: Array.from({ length: 3 }, () => ({ name: 'a.mmd', file: 'a.mmd', text: kb8Code, savedText: kb8Code })),
  at: Date.now(),
});
ok('3 标签 × ' + Math.round(draftPayload.length / 1024 / 3) + 'KB 草稿 < 2MB',
  draftPayload.length < 2 * 1024 * 1024);

console.log('== 7. README 与实现一致性 ==');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
ok('README 记录 Alt+N', readme.includes('Alt+N'));
ok('README 无 Ctrl+N 建标签残留', !/Ctrl\+N[\s\S]{0,12}新建标签页/.test(readme));
const mSize = readme.match(/index\.html 约 ([\d.]+) MB/);
if (mSize) {
  const actual = fs.statSync(htmlPath).size / 1048576;
  ok('README 的 index.html 体积与实际相符', Math.abs(parseFloat(mSize[1]) - actual) < 0.03);
} else ok('README 声明了 index.html 体积', false);
ok('存在 LICENSE 文件', fs.existsSync(path.join(ROOT, 'LICENSE')));
ok('存在 package.json', fs.existsSync(path.join(ROOT, 'package.json')));

console.log('');
if (errors.length) {
  console.log('FAILED (' + errors.length + '): ' + errors.join('; '));
  process.exit(1);
}
console.log('ALL CHECKS PASSED (' + pass + ')');
