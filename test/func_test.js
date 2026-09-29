/* Pikachu Mermaid — 功能级回归
 * 用法: node test/func_test.js
 *
 * 与 check.js 的分工：check.js 负责静态一致性，本文件负责**行为**。
 * 关键原则：所有被测函数都从 index.html 里**真实提取**后执行，不在测试里
 * 重新实现一遍——否则改坏了实现，测试照样全绿（这是本文件上一版的真实缺陷）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const norm = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label); }
}
// 按函数体边界提取，避免 [\s\S]*? 跨越到后面的同名符号
function fnBody(name) {
  const m = norm.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n'));
  if (!m) { console.log('  ✗ 未能提取函数 ' + name); fail++; return ''; }
  return m[0];
}
function srcConst(name) {
  const m = norm.match(new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\]);'));
  if (!m) throw new Error('未找到常量 ' + name);
  return new Function('return ' + m[1])();
}

/* ────────────────────────────────────────────────────────────
 * 1. highlight（真实实现 + 真实 escapeHtml / HL_KEYWORDS / ARROWS）
 * ──────────────────────────────────────────────────────────── */
console.log('== 1. highlight 错误行标注 ==');
const escapeHtml = new Function('return (' + fnBody('escapeHtml') + ')')();
const highlight = new Function('escapeHtml', 'HL_KEYWORDS', 'ARROWS',
  'return (' + fnBody('highlight') + ')'
)(escapeHtml, srcConst('HL_KEYWORDS'), srcConst('ARROWS'));

const code = 'graph TD\n  A --> B\n  B --> C';
ok('无错误行不加标记', !highlight(code, null).includes('tok-err'));
ok('第3行标记正确', highlight(code, 3).includes('tok-err') &&
  /tok-err[\s\S]*?C[\s\S]*?<\/span>/.test(highlight(code, 3)));
ok('越界行不加标记', !highlight(code, 99).includes('tok-err'));
ok('中文行不破坏结构', /tok-err[\s\S]*?开始[\s\S]*?<\/span>/.test(highlight('graph TD\n  A[开始] --> B[结束]', 2)));
ok('escapeHtml 真的转义 < > &',
  escapeHtml('<a href="x">&amp;</a>') === '&lt;a href="x"&gt;&amp;amp;&lt;/a&gt;');
ok('关键字被着色', highlight('graph TD', null).includes('tok-kw') &&
  highlight('graph TD', null).includes('>graph<'));
ok('注释被着色', highlight('%% hello\ngraph TD', null).includes('tok-comment'));
ok('箭头被着色', highlight('graph TD\n  A --> B', null).includes('tok-arrow'));

// 跨行字符串：跨越的换行必须计入行号，否则后续所有行的错误波浪线都会偏移
const spanning = 'graph TD\n  A["第一行开始\n  第二行结束"] --> B\n  C --> D';
const out4 = highlight(spanning, 4).split('\n');
ok('跨行字符串后仍能定位第4行', out4[out4.length - 1].includes('tok-err') &&
  out4[out4.length - 1].includes('C'));
const out3 = highlight(spanning, 3).split('\n');
ok('第3行标记不含第4行内容', !out3[out3.length - 1].includes('tok-err'));

/* ────────────────────────────────────────────────────────────
 * 2. renderOutline（真实实现 + DOM stub）
 * ──────────────────────────────────────────────────────────── */
console.log('== 2. renderOutline 解析（真实函数 + DOM stub）==');
function makeEl() {
  return {
    className: '', textContent: '', title: '', hidden: false, innerHTML: '', style: {},
    children: [], listeners: [],
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { this.listeners.push([t, f]); },
  };
}
function runOutline(code) {
  const panel = makeEl(), list = makeEl();
  const $ = (id) => (id === 'outlinePanel' ? panel : id === 'outlineList' ? list : makeEl());
  const document = { createElement: makeEl };
  const jumpToLine = () => {};
  const fn = new Function('$', 'document', 'jumpToLine',
    'return (' + fnBody('renderOutline') + ')')($, document, jumpToLine);
  fn(code);
  return {
    hidden: panel.hidden,
    items: list.children.map(c => ({
      text: c.children[1] ? c.children[1].textContent : '',
      indent: c.className,
      line: c.title,
    })),
  };
}

const flow = runOutline('graph TD\n  subgraph A[处理A]\n    X --> Y\n  end\n  subgraph B[处理B]\n    Y --> Z\n  end');
ok('flowchart 识别 2 个 subgraph', flow.items.length === 2);
ok('subgraph 标题解析', flow.items[0].text === '处理A' && flow.items[0].line.includes('2 行'));
ok('有条目时面板展开', flow.hidden === false);

const gantt = runOutline('gantt\n  title 计划\n  section 需求\n  任务1: a1, 2024-01-01, 3d\n  section 开发\n  任务2: b1, after a1, 5d');
ok('gantt 识别 2 个 section', gantt.items.length === 2);
ok('section 标题解析', gantt.items[0].text === '需求');

const seq = runOutline('sequenceDiagram\n  participant A as 客户端\n  participant B as 服务器\n  A->>B: hi');
ok('sequence 识别 2 个 participant', seq.items.length === 2);
ok('participant 显示名解析', seq.items[0].text === '客户端');

const none = runOutline('graph TD\n  A --> B');
ok('无结构时面板隐藏', none.hidden === true && none.items.length === 0);

const nested = runOutline('graph TD\n  subgraph R[根]\n    subgraph S[子]\n      A --> B\n    end\n  end');
ok('嵌套 subgraph 缩进分级', nested.items.length === 2 &&
  nested.items[1].indent.includes('indent-2'));

console.log('');
console.log(fail ? 'FAILED (' + fail + ')' : 'ALL FUNCTIONAL TESTS PASSED (' + pass + ')');
process.exit(fail ? 1 : 0);
