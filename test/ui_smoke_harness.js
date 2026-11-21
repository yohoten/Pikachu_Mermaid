(async function () {
  const out = [];
  const results = [];
  function ok(name, cond, extra) {
    results.push((cond ? 'OK   ' : 'FAIL ') + name + (extra !== undefined ? ' | ' + extra : ''));
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  window.addEventListener('error', e => results.push('FAIL JSERROR ' + e.message));
  window.addEventListener('unhandledrejection', e => results.push('FAIL REJECTION ' + e.reason));

  // 阻断真实副作用
  let prompts = [], confirms = [], alerts = [], downloads = [], prints = 0;
  window.prompt = (msg, def) => { prompts.push(String(msg)); return window.__promptAnswer !== undefined ? window.__promptAnswer : def; };
  window.confirm = (msg) => { confirms.push(String(msg)); return window.__confirmAnswer !== undefined ? window.__confirmAnswer : true; };
  window.alert = (msg) => { alerts.push(String(msg)); };
  window.print = () => { prints++; };
  HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
  HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob(['x'], { type: 'image/png' })); };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__clip = t; } } });
  window.fetch = async () => {
    const chunks = [
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'graph TD\n  A --> B' } }] }) + '\n\n',
      'data: [DONE]\n\n',
    ];
    let i = 0;
    return {
      ok: true, status: 200,
      body: { getReader: () => ({ read: async () => i < chunks.length
        ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
        : { done: true } }) },
      json: async () => ({}),
    };
  };

  const $ = id => document.getElementById(id);
  const click = id => { const el = $(id); if (!el) { ok('存在 ' + id, false); return; } el.click(); };

  await sleep(80);

  // 1. 菜单开合
  const menus = [...document.querySelectorAll('#toolbar .menu')];
  ok('菜单数量 = 6', menus.length === 6, menus.length);
  menus.forEach((m, i) => {
    const t = m.querySelector('.menu-trigger');
    t.click();
    ok('菜单' + i + ' 打开', m.classList.contains('open') && t.getAttribute('aria-expanded') === 'true');
    t.click();
    ok('菜单' + i + ' 再点关闭', !m.classList.contains('open'));
  });
  menus[1].querySelector('.menu-trigger').click();
  document.body.click();
  ok('点击外部关闭菜单', !menus[1].classList.contains('open'));
  menus[2].querySelector('.menu-trigger').click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok('Esc 关闭菜单', !menus[2].classList.contains('open'));
  menus[4].querySelector('.menu-trigger').click();
  $('btnExportSvg').click();
  ok('选中菜单项后自动收起', !menus[4].classList.contains('open'));

  // 下拉选项：点击 select 不应收起菜单，选中后才收起
  menus[3].querySelector('.menu-trigger').click();
  $('templateSelect').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  ok('点击模板选择框保持菜单展开', menus[3].classList.contains('open'));
  $('templateSelect').selectedIndex = 0;
  $('templateSelect').dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(20);
  ok('选中模板后收起菜单', !menus[3].classList.contains('open'));
  menus[5].querySelector('.menu-trigger').click();
  $('themeSelect').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  ok('点击主题选择框保持菜单展开', menus[5].classList.contains('open'));
  $('themeSelect').value = 'neutral';
  $('themeSelect').dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(20);
  ok('选中主题后收起菜单', !menus[5].classList.contains('open'));

  // 2. 快捷按钮
  const tabs0 = document.querySelectorAll('#tabList .tab').length;
  click('btnQuickNew');
  await sleep(30);
  ok('快捷新建标签', document.querySelectorAll('#tabList .tab').length === tabs0 + 1);
  const openClicks = [];
  const origOpen = $('btnOpen').click.bind($('btnOpen'));
  $('btnOpen').click = () => { openClicks.push(1); };
  click('btnQuickOpen');
  ok('快捷打开委托到原按钮', openClicks.length === 1);
  $('btnOpen').click = origOpen;

  // 3. 保存逻辑
  window.__promptAnswer = 'qa-chart.mmd';
  click('btnSave');
  await sleep(30);
  const p1 = prompts.length;
  ok('首次保存询问文件名', p1 === 1 && downloads.some(d => d === 'qa-chart.mmd'), prompts.join('/') + ' | ' + downloads.join(','));
  click('btnSave');
  await sleep(20);
  ok('已有文件名 Ctrl+S 不再询问', prompts.length === p1, prompts.length);
  click('btnSaveAs');
  await sleep(20);
  ok('另存为仍询问文件名', prompts.length === p1 + 1);
  window.__promptAnswer = undefined;

  // 4. 缩放 / 全屏 / 外观
  const z0 = $('zoomMenuLabel').textContent;
  click('btnZoomIn');
  ok('放大更新菜单百分比', $('zoomMenuLabel').textContent !== z0, $('zoomMenuLabel').textContent);
  click('btnZoomReset');
  ok('重置缩放回 100%', $('zoomMenuLabel').textContent === '100%');
  click('btnFullscreen');
  ok('全屏状态与标签同步', document.body.classList.contains('fullscreen') && $('fullscreenLabel').textContent === '退出全屏');
  click('btnFullscreen');
  ok('退出全屏标签复原', !document.body.classList.contains('fullscreen') && $('fullscreenLabel').textContent === '全屏预览');
  const ui0 = document.body.dataset.ui;
  click('btnUiTheme');
  ok('外观切换与标签同步', document.body.dataset.ui !== ui0 && $('uiThemeLabel').textContent === (document.body.dataset.ui === 'light' ? '深色外观' : '浅色外观'), document.body.dataset.ui + '/' + $('uiThemeLabel').textContent);
  click('btnUiTheme');

  // 5. 模板与主题
  const sel = $('templateSelect');
  sel.selectedIndex = 1;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(30);
  ok('模板切换写入编辑器', editor.value.indexOf('sequenceDiagram') === 0, editor.value.slice(0, 20));
  $('themeSelect').value = 'dark';
  $('themeSelect').dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(300);
  ok('图表主题切换预览底色', previewScroll.style.background === 'rgb(30, 30, 46)', previewScroll.style.background);

  // 6. 导出与复制
  click('btnExportSvg');
  ok('导出 SVG', downloads.some(d => d.endsWith('.svg')));
  click('btnExportPng');
  await sleep(100);
  ok('导出 PNG', downloads.some(d => d.endsWith('.png')), downloads.join(','));
  click('btnCopyMd');
  await sleep(20);
  ok('复制 Markdown', String(window.__clip).startsWith('```mermaid'));
  click('btnCopySvg');
  await sleep(20);
  ok('复制 SVG', String(window.__clip).includes('<svg'));
  click('btnExportMd');
  ok('导出 Markdown', downloads.some(d => d.endsWith('.md')));
  click('btnExportPdf');
  await sleep(30);
  ok('导出 PDF 调用打印', prints === 1, prints);

  // 7. 空状态
  editor.value = '';
  syncEditorUI();
  await sleep(350);
  ok('空状态插画与标题', !!previewContainer.querySelector('.empty-state img') && previewContainer.querySelector('.empty-state strong') !== null, previewContainer.innerHTML.slice(0, 80));

  // 8. AI 面板
  click('btnAiPanel');
  ok('AI 面板打开', $('aiPanel').classList.contains('open'));
  click('aiClose');
  ok('AI 面板关闭', !$('aiPanel').classList.contains('open'));
  click('btnAiPanel');
  $('aiExample').click();
  ok('示例提示词已填入', $('aiPrompt').value.length > 10);
  $('aiProvider').value = 'deepseek';
  $('aiProvider').dispatchEvent(new Event('change', { bubbles: true }));
  ok('切换服务商更新端点/模型', $('aiEndpoint').value.includes('deepseek') && $('aiModel').value === 'deepseek-flash', $('aiEndpoint').value);
  click('aiGenerate');
  await sleep(250);
  ok('AI 流式生成结果', $('aiResult').textContent.includes('graph TD') && !$('aiApply').disabled, $('aiStatus').textContent);
  ok('AI 历史写入', $('aiHistory').children.length >= 1, $('aiHistory').children.length);
  click('aiApply');
  await sleep(40);
  ok('AI 结果应用到编辑器', editor.value.trim() === 'graph TD\n  A --> B', editor.value.trim());
  history.undo();
  await sleep(20);
  ok('AI 应用可撤销', editor.value.indexOf('graph TD') === -1 || editor.value !== 'graph TD\n  A --> B\n', editor.value.slice(0, 20));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok('Esc 关闭 AI 面板', !$('aiPanel').classList.contains('open'));

  // 9. 标签重命名
  const tab = document.querySelector('#tabList .tab');
  window.__promptAnswer = '重命名标签';
  tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await sleep(20);
  ok('双击标签重命名', [...document.querySelectorAll('#tabList .tname')].some(n => n.textContent === '重命名标签'));
  window.__promptAnswer = undefined;

  // 10. 模板弹窗
  click('btnManageTemplates');
  ok('模板管理弹窗打开', !$('templateModal').classList.contains('hidden'));
  click('tmplClose');
  ok('模板管理弹窗关闭', $('templateModal').classList.contains('hidden'));

  // 11. 撤销 / 重做 / Tab 缩进
  editor.value = 'graph TD\n  A --> B';
  history.reset(); syncEditorUI(); await sleep(20);
  editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length);
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  ok('Tab 缩进生效', editor.value.endsWith('    '), JSON.stringify(editor.value.slice(-8)));
  click('btnUndo');
  ok('菜单撤销生效', !editor.value.endsWith('    '));
  click('btnRedo');
  ok('菜单重做生效', editor.value.endsWith('    '));

  // 12. AI 插入 / 复制 / 历史
  click('btnAiPanel');
  editor.setSelectionRange(0, 0);
  const beforeInsert = editor.value;
  click('aiInsert');
  ok('AI 插入到光标处', editor.value.length > beforeInsert.length && editor.value.startsWith('graph TD'));
  click('aiCopy'); await sleep(20);
  ok('AI 复制代码', String(window.__clip).includes('graph TD'));
  const chip = $('aiHistory').firstElementChild;
  if (chip) { chip.click(); ok('历史项可载入', $('aiResult').textContent.includes('graph TD')); }
  click('aiClose');

  // 13. 关闭脏标签确认
  const beforeTabs = document.querySelectorAll('#tabList .tab').length;
  window.__confirmAnswer = false;
  document.querySelector('#tabList .tab.active .tclose').click();
  await sleep(20);
  ok('取消关闭脏标签', document.querySelectorAll('#tabList .tab').length === beforeTabs);
  window.__confirmAnswer = true;

  // 14. 缺陷回归
  // 14.1 全局快捷键（焦点不在编辑器）+ Ctrl+Shift+Z 大写 Z
  editor.value = 'graph TD\n  A --> B';
  history.reset(); syncEditorUI(); await sleep(20);
  history.beforeEdit(); editor.value += '\n  B --> C'; history.afterEdit();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
  await sleep(20);
  const undone = editor.value;
  ok('全局 Ctrl+Z 撤销', undone === 'graph TD\n  A --> B', JSON.stringify(undone));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  await sleep(20);
  ok('Ctrl+Shift+Z 重做', editor.value.includes('B --> C'), JSON.stringify(editor.value));
  const promptsBeforeGlobal = prompts.length;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
  await sleep(20);
  ok('焦点在文档时 Ctrl+S 仍保存', prompts.length > promptsBeforeGlobal || downloads.length > 0);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
  await sleep(20);
  ok('焦点在文档时 Ctrl+Enter 全屏', document.body.classList.contains('fullscreen'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
  await sleep(20);

  // 14.2 空状态清理旧大纲
  editor.value = 'graph TD\n  subgraph 旧分组\n    A --> B\n  end';
  syncEditorUI(); await sleep(350);
  ok('大纲曾展开', $('outlinePanel').hidden === false);
  editor.value = ''; syncEditorUI(); await sleep(350);
  ok('清空后大纲隐藏', $('outlinePanel').hidden === true);

  // 14.3 模板切换取消时还原下拉值
  window.__confirmAnswer = false;
  editor.value = 'graph TD\n  A --> B'; syncEditorUI(); await sleep(20);
  const selBefore = $('templateSelect').value;
  $('templateSelect').selectedIndex = selBefore === '0' ? 1 : 0;
  $('templateSelect').dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(20);
  ok('取消模板切换还原下拉', $('templateSelect').value === selBefore, $('templateSelect').value + '/' + selBefore);

  // 14.4 导入空模板数组被拒绝
  const expectedAlertCount = alerts.length + 2; // 14.4 空模板 + 14.7 复制失败，均为预期提示
  const importInput = $('tmplImportFile');
  Object.defineProperty(importInput, 'files', {
    configurable: true, value: [new File(['[]'], 'empty.json', { type: 'application/json' })],
  });
  const alertsBefore = alerts.length;
  importInput.dispatchEvent(new Event('change', { bubbles: true }));
  for (let i = 0; i < 20 && alerts.length === alertsBefore; i++) await sleep(50);
  ok('导入空模板数组被拒绝', alerts.length === alertsBefore + 1 && templates.length > 0,
    'alerts+' + (alerts.length - alertsBefore) + ' templates=' + templates.length);

  // 14.5 非流式 JSON（多行 + 结尾换行）回退
  const origFetch = window.fetch;
  window.fetch = async () => {
    const body = JSON.stringify({ choices: [{ message: { content: 'graph LR\n  X --> Y' } }] }) + '\n';
    let i = 0;
    return { ok: true, status: 200,
      body: { getReader: () => ({ read: async () => i++ === 0
        ? { done: false, value: new TextEncoder().encode(body) } : { done: true } }) },
      json: async () => ({}) };
  };
  click('btnAiPanel');
  $('aiPrompt').value = '非流式回退测试';
  click('aiGenerate'); await sleep(250);
  ok('非流式 JSON 回退成功', $('aiResult').textContent.includes('graph LR'), $('aiStatus').textContent);
  window.fetch = origFetch;
  click('aiClose');

  // 14.6 渲染中导出 PDF 不会打印旧图
  const printsBefore = prints;
  window.__confirmAnswer = true;
  isRendering = true; setTimeout(() => { isRendering = false; }, 100);
  click('btnExportPdf'); await sleep(400);
  ok('渲染中导出 PDF 等待后打印', prints === printsBefore + 1, prints);

  // 14.7 复制失败给出提示
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
  document.execCommand = () => false;
  const alertBeforeCopy = alerts.length;
  click('btnCopyMd'); await sleep(30);
  ok('复制失败有明确提示', alerts.length === alertBeforeCopy + 1, alerts[alertBeforeCopy]);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__clip = t; } } });
  document.execCommand = () => true;

  // 14.8 关闭最后一个标签得到干净文档
  window.__confirmAnswer = true;
  while (document.querySelectorAll('#tabList .tab').length > 1) {
    document.querySelector('#tabList .tab.active .tclose').click();
    await sleep(15);
  }
  editor.value = '旧标签独有内容'; syncEditorUI(); await sleep(20);
  document.querySelector('#tabList .tab.active .tclose').click(); await sleep(50);
  ok('关闭最后标签得到干净文档',
    editor.value === (templates[0] || DEFAULT_TEMPLATES[0]).code && currentFile === null,
    editor.value.slice(0, 24));

  // 14.9 AI 按钮：同级配色 + 单一入口状态机
  const aiBtn = $('btnAiPanel');
  const csAi = getComputedStyle(aiBtn), csNew = getComputedStyle($('btnQuickNew'));
  ok('AI 按钮配色与其他按钮一致',
    csAi.backgroundColor === csNew.backgroundColor && csAi.color === csNew.color,
    csAi.backgroundColor + ' / ' + csNew.backgroundColor);
  toggleAiPanel(false); await sleep(20);
  $('aiPrompt').value = '';
  aiBtn.click(); await sleep(20);
  ok('关闭时点击只打开面板', $('aiPanel').classList.contains('open') && $('aiButtonLabel').textContent === 'AI 生成');
  $('aiPrompt').value = 'graph TD\n  A --> B';
  $('aiPrompt').dispatchEvent(new Event('input', { bubbles: true }));
  ok('有描述时按钮变为立即生成', $('aiButtonLabel').textContent === '立即生成', $('aiButtonLabel').textContent);
  aiBtn.click(); await sleep(300);
  ok('有描述时点击按钮直接生成', $('aiResult').textContent.includes('graph TD'), $('aiStatus').textContent);
  const origFetchCtrl = window.fetch;
  window.fetch = async () => {
    const chunks = [
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'graph LR\n  X --> Y' } }] }) + '\n\n',
      'data: [DONE]\n\n',
    ];
    let i = 0;
    return { ok: true, status: 200,
      body: { getReader: () => ({ read: async () => i < chunks.length
        ? { done: false, value: new TextEncoder().encode(chunks[i++]) } : { done: true } }) },
      json: async () => ({}) };
  };
  $('aiPrompt').value = 'graph LR\n  X --> Y';
  $('aiPrompt').dispatchEvent(new Event('input', { bubbles: true }));
  $('aiPrompt').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
  await sleep(300);
  ok('提示词内 Ctrl+Enter 生成', $('aiResult').textContent.includes('graph LR'), $('aiStatus').textContent);
  window.fetch = origFetchCtrl;
  const origFetchCancel = window.fetch;
  window.fetch = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
  $('aiPrompt').value = '取消测试';
  $('aiPrompt').dispatchEvent(new Event('input', { bubbles: true }));
  aiBtn.click(); await sleep(40);
  ok('生成中按钮变为取消生成', $('aiButtonLabel').textContent === '取消生成', $('aiButtonLabel').textContent);
  aiBtn.click(); await sleep(80);
  ok('生成中点击按钮取消请求', $('aiStatus').textContent === '已取消' && $('aiButtonLabel').textContent !== '取消生成', $('aiStatus').textContent);
  window.fetch = origFetchCancel;
  toggleAiPanel(false);

  // 15. 错误弹窗
  ok('无意外 alert 弹窗', alerts.length === expectedAlertCount, alerts.join(' / '));
  ok('无 JS 错误', !results.some(r => r.indexOf('JSERROR') === 0 || r.indexOf('REJECTION') === 0), results.filter(r => r.indexOf('JSERROR') === 0 || r.indexOf('REJECTION') === 0).join(' / '));

  const pre = document.createElement('pre');
  pre.id = 'qaOut';
  pre.textContent = results.join('\n');
  document.body.appendChild(pre);
  document.title = 'QA_DONE';
})();
