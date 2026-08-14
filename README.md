# Pikachu Mermaid

零依赖的 Mermaid 图表编辑器 —— **纯 Web 单文件方案**，双击即可运行，无需 Python / PyQt / 任何安装。

## ✨ 特性

| 功能 | 说明 |
|------|------|
| 实时预览 | 编辑即渲染，200ms 防抖，图表类型自动识别，预览背景随主题自适应 |
| 语法高亮 | 关键词（蓝）、箭头（红）、注释（绿）、字符串/数字（彩色），零依赖实现 |
| 撤销 / 重做 | 自建历史栈（200 步上限），连续输入合并，`beforeinput` 统一记录（覆盖粘贴 / 中文输入法），`Ctrl+Z` / `Ctrl+Y` |
| 图表模板 | 默认 9 种（流程图/序列图/甘特图/类图/状态图/饼图/思维导图/象限图/雷达图），可增删改、导入导出 JSON，localStorage 持久化 |
| 错误波浪线 | 渲染失败时在编辑器对应行标注红色波浪线，点击预览错误提示可跳转定位 |
| 主题切换 | default / neutral / dark / forest 四种 mermaid 主题 |
| 缩放 | 预览区放大 / 缩小 / 重置 |
| 导出 PNG / SVG / PDF | PNG 2x 超采样（背景可选主题/白色/透明）、SVG 序列化、PDF 走系统打印对话框（选"另存为 PDF"），仅打印预览区 |
| 复制 Markdown / SVG | 一键复制 ```` ```mermaid ```` 代码块或 SVG 源码到剪贴板，方便粘贴到 Typora / 语雀 / Notion |
| 打开 / 保存 | 支持 `.mmd` / `.mermaid` / `.txt`，UTF-8 优先、GBK 自动兼容 |
| 草稿自动恢复 | 编辑内容每 0.5s 自动存入 localStorage，下次启动可恢复未保存内容 |
| 错误定位 | 渲染失败时解析错误行号，点击提示即可跳转到对应行 |
| 未保存提示 | 关闭 / 刷新页面时浏览器原生提示 |

## 🚀 使用方法

```
方式一：直接双击 index.html（推荐，file:// 协议即可运行）
方式二：或起本地服务后访问
        python -m http.server 8000
        浏览器打开 http://localhost:8000
```

**快捷键**

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+S` | 保存 |
| `Ctrl+O` | 打开 |
| `Ctrl+N` | 新建 |
| `Tab` | 缩进（插入 4 空格） |

## 📁 项目结构
```
Pikachu_Mermaid/
├── index.html          # 单文件应用（UI + 逻辑 + 模板全部内嵌）
├── mermaid.min.js      # 本地 mermaid v11（离线可用，支持全部图表）
├── Pikachu_Mermaid.ico # 应用图标（浏览器标签页 / 快捷键 / PWA）
└── README.md
```
```

总大小约 **3.7 MB**（mermaid.min.js 3.4MB + index.html 约 0.3MB），无任何运行时依赖。

## 🧱 架构说明

mermaid 本质是 JS 图表库。旧版用「Python + PyQt5 + QWebEngineView（内嵌 Chromium）」这套重方案去跑它，导致：

- 打包体积 300MB+，`build/` 里全是 Qt DLL
- 死代码：`ai_service.py`（493 行）+ `ai_worker.py`（572 行）从未被引用
- 撤销/重做失效、CDN 版本与模板不兼容、grab() 导出空白等 12 项问题

**重构决策**：既然 mermaid 是纯 Web 技术，直接用「HTML + 本地 mermaid.min.js」是最自然、体积最小的方案——上述问题在 Web 方案中天然不存在：

- 撤销/重做 → 自建 HistoryManager（快照 + 连续输入合并）
- 语法高亮 → 透明 textarea 叠加高亮层，零第三方库
- PNG 导出 → SVG 序列化 → Canvas 绘制 → Blob 下载
- 打开/保存 → File API + Blob 下载，TextDecoder 自动回退 GBK
- 未保存确认 → `beforeunload` 原生提示
- 图表版本 → 本地 mermaid v11，全部 9 种模板离线可用

## 🔗 与旧版对比

| 维度 | 旧版（PyQt5） | 新版（纯 Web） |
|------|--------------|----------------|
| 运行时依赖 | Python + PyQt5 + PyQtWebEngine + svgwrite | 浏览器（系统自带） |
| 体积 | 300MB+ 打包 | ~3.7MB |
| 撤销/重做 | 完全失效 | 正常（200 步） |
| 图表模板 | 思维导图等 3 种无法渲染（CDN v9.3） | 全部 9 种可用（v11） |
| PNG 导出 | 常导出空白 | 可靠导出 |
| 安装 | pip install + 打包 | 双击即用 |

## 📄 License

MIT
