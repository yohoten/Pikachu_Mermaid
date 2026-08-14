# Pikachu Mermaid

零依赖的 Mermaid 图表编辑器 —— **纯 Web 单文件方案**，浏览器打开即可用，无需 Python / PyQt / 任何安装，支持 PWA 安装为桌面应用并离线使用。

![](https://i.imgs.ovh/2026/08/15/19799f6e94b57f266af71b8b6c2a4b23.jpg)

## ✨ 特性

| 功能 | 说明 |
|------|------|
| 实时预览 | 编辑即渲染，200ms 防抖，图表类型自动识别，预览背景随主题自适应 |
| 语法高亮 | 关键词（蓝）、箭头（红）、注释（绿）、字符串/数字（彩色），零依赖实现 |
| 撤销 / 重做 | 自建历史栈（200 步上限），连续输入合并，`beforeinput` 统一记录（覆盖粘贴 / 中文输入法），`Ctrl+Z` / `Ctrl+Y` |
| 图表模板 | 默认 9 种（流程图/序列图/甘特图/类图/状态图/饼图/思维导图/象限图/雷达图），可按类型分组显示，可增删改、导入导出 JSON，localStorage 持久化 |
| 错误波浪线 | 渲染失败时在编辑器对应行标注红色波浪线，点击预览错误提示可跳转定位 |
| 主题切换 | default / neutral / dark / forest 四种 mermaid 主题 |
| 缩放 | 预览区放大 / 缩小 / 重置，`Ctrl+滚轮` 快速缩放 |
| 多文件标签页 | 多文档并行编辑，每标签独立撤销历史，草稿按标签整体恢复 |
| 大纲导航 | 自动解析 subgraph / section / participant 生成可点击目录，跳转对应代码行 |
| 全屏预览 | `Ctrl+Enter` 一键进入全屏演示模式 |
| 导出 PNG / SVG / PDF / MD | PNG 2x 超采样（背景可选主题/白色/透明）、SVG 序列化、PDF 走系统打印对话框（选"另存为 PDF"）、Markdown 导出含 mermaid 代码块 |
| 复制 Markdown / SVG | 一键复制 ```` ```mermaid ```` 代码块或 SVG 源码到剪贴板，方便粘贴到 Typora / 语雀 / Notion |
| 打开 / 保存 | 支持 `.mmd` / `.mermaid` / `.txt`，UTF-8 优先、GBK 自动兼容 |
| 草稿自动恢复 | 编辑内容每 0.5s 自动存入 localStorage，下次启动可恢复未保存内容（多标签整体恢复） |
| 错误定位 | 渲染失败时解析错误行号，点击提示即可跳转到对应行 |
| PWA 离线支持 | 提供 manifest + Service Worker，通过 http 服务访问时可"安装为应用"并离线使用 |
| 未保存提示 | 关闭 / 刷新页面时浏览器原生提示 |

## 🚀 使用方法

**在线使用（推荐）**

打开 👉 **https://yohoten.github.io/Pikachu_Mermaid/** （GitHub Pages 托管，无需安装任何东西，打开即用）

**本地方式（任选其一）**

| 方式 | 操作 | 说明 |
|------|------|------|
| 直接打开 | 双击 `index.html` | file:// 协议即可运行，无需服务器；PWA 安装不可用 |
| 本地服务 | `python -m http.server 8000` → 访问 `http://localhost:8000` | 可启用 PWA 安装与离线功能 |

**PWA 安装为应用（桌面化，可选）**

通过在线地址或本地服务访问后（须为 http/https，不能是 file://）：

1. Chrome / Edge 打开后，地址栏右侧会出现 **安装图标**（显示器+箭头），点击。（**关闭浏览器后执行该步骤，保证无其他标签页**）
2. 或点右上角 **⋮ 菜单 → 安装 Pikachu Mermaid**
3. 确认后即以**独立窗口**运行，桌面/开始菜单生成快捷方式
4. 安装后**完全离线可用**（Service Worker 已缓存全部资源），不再需要服务器，每次打开不再重复下载

**快捷键**

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+S` | 保存 |
| `Ctrl+O` | 打开 |
| `Ctrl+N` | 新建标签页 |
| `Ctrl+Enter` | 全屏预览 / 退出全屏 |
| `Ctrl+滚轮` | 缩放预览 |
| `Tab` | 缩进（插入 4 空格） |

## 🚀 部署到 GitHub Pages（在线访问）

本项目已托管于 **https://yohoten.github.io/Pikachu_Mermaid/**。若需更新线上版本：

```
1. git init && git add . && git commit -m "update"
2. 关联远程仓库：
   git remote add origin https://github.com/yohoten/Pikachu_Mermaid.git
   git branch -M main
   git push -u origin main
3. GitHub → 仓库 Settings → Pages
   - Source 选 "Deploy from a branch"
   - Branch 选 main / (root)
   - 保存后等待 1-2 分钟，即可访问 https://yohoten.github.io/Pikachu_Mermaid/
```

**PWA 在 GitHub Pages 的说明**
- GitHub Pages 提供 https，因此 Service Worker 可正常注册，**安装为应用 + 离线功能完全可用**
- manifest 与 sw.js 均使用相对路径，在 `/Pikachu_Mermaid/` 子路径下正常工作
- 更新代码后若线上仍显示旧版：浏览器 `Ctrl+F5` 强刷，或应用内会随 SW 更新自动刷新

## 📁 项目结构
```
Pikachu_Mermaid/
├── index.html             # 单文件应用（UI + 逻辑 + 模板全部内嵌）
├── mermaid.min.js         # 本地 mermaid v11（离线可用，支持全部图表）
├── Pikachu_Mermaid.ico    # 应用图标（浏览器标签页 / 快捷键 / PWA）
├── icon-192x192.png       # PWA 图标（192px，安装必需）
├── icon-512x512.png       # PWA 图标（512px，安装必需）
├── manifest.webmanifest   # PWA 清单（安装为应用 / 离线）
├── sw.js                  # Service Worker（离线缓存）
├── test/
│   ├── check.js           # 回归测试：JS 语法/HTML/ID/功能存在性
│   └── func_test.js       # 功能测试：高亮错误行/大纲解析
└── README.md
```

总大小约 **3.7 MB**（mermaid.min.js 3.4MB + index.html 约 0.3MB），无任何运行时依赖。运行 `node test/check.js` 可一键回归。

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
