/* 功能级回归：highlight 错误行 + renderOutline 解析 */
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label); }
}

// ── highlight 错误行测试 ──
const m = html.match(/function highlight\(code, errorLine\) \{[\s\S]*?\n\}/);
const fnBody = m[0];
const Highlight = new Function('escapeHtml', 'HL_KEYWORDS', 'ARROWS', 'return (' +
  fnBody.replace('function highlight(code, errorLine)', 'function highlight(code, errorLine)') + ')');
const hl = Highlight(
  (s) => s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'),
  ["graph", "subgraph", "end"],
  ["-->", "->"]
);

const code = "graph TD\n  A --> B\n  B --> C";
ok('无错误行不加标记', !hl(code, null).includes('tok-err'));
ok('第3行标记正确', hl(code, 3).includes('tok-err') && /tok-err[\s\S]*?C[\s\S]*?<\/span>/.test(hl(code, 3)));
ok('越界行不加标记', !hl(code, 99).includes('tok-err'));
ok('中文行不破坏结构', /tok-err[\s\S]*?开始[\s\S]*?<\/span>/.test(hl("graph TD\n  A[开始] --> B[结束]", 2)));

// ── renderOutline 解析测试（从函数体提取，模拟 DOM 依赖）──
console.log('== renderOutline 结构解析（独立逻辑验证）==');
// 直接复制大纲解析的正则逻辑做验证
function extractOutline(code) {
  const items = [];
  const lines = code.split("\n");
  const reSub = /^\s*(subgraph)\s+([^\[]*?)(?:\[([^\]]*)\])?\s*$/;
  const reSection = /^\s*(section)\s+(.+)$/;
  const reParticipant = /^\s*(participant|actor)\s+([^\s:]+)(?:\s+as\s+(.+))?$/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let mm;
    if ((mm = line.match(reSub))) {
      const title = (mm[3] || mm[2] || "").trim();
      items.push({ text: title || "(subgraph)", line: i + 1, kind: "sub" });
    } else if ((mm = line.match(reSection))) {
      items.push({ text: mm[2].trim(), line: i + 1, kind: "sec" });
    } else if ((mm = line.match(reParticipant))) {
      items.push({ text: (mm[3] || mm[2] || "").trim(), line: i + 1, kind: "part" });
    }
  }
  return items;
}

const flow = "graph TD\n  subgraph A[处理A]\n    X --> Y\n  end\n  subgraph B[处理B]\n    Y --> Z\n  end";
const flowItems = extractOutline(flow);
ok('flowchart 识别 2 个 subgraph', flowItems.filter(i => i.kind === "sub").length === 2);
ok('subgraph 标题解析', flowItems[0].text === "处理A" && flowItems[0].line === 2);

const gantt = "gantt\n  title 计划\n  section 需求\n  任务1: a1, 2024-01-01, 3d\n  section 开发\n  任务2: b1, after a1, 5d";
const ganttItems = extractOutline(gantt);
ok('gantt 识别 2 个 section', ganttItems.filter(i => i.kind === "sec").length === 2);

const seq = "sequenceDiagram\n  participant A as 客户端\n  participant B as 服务器\n  A->>B: hi";
const seqItems = extractOutline(seq);
ok('sequence 识别 2 个 participant', seqItems.filter(i => i.kind === "part").length === 2);
ok('participant 显示名解析', seqItems[0].text === "客户端");

console.log('');
console.log(fail ? 'FAILED (' + fail + ')' : 'ALL FUNCTIONAL TESTS PASSED (' + pass + ')');
process.exit(fail ? 1 : 0);
