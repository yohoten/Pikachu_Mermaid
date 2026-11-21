#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pikachu Mermaid — UI 按钮与操作巡检（真实 Chrome/Edge，零依赖）。

原理：把 test/ui_smoke_harness.js 注入 index.html 的临时副本，用浏览器
无头模式真实点击所有菜单/按钮、模拟 AI 流式响应，再把断言结果写回 DOM，
由本脚本解析并在出现 FAIL 时以退出码 1 失败。

用法：
    python test/ui_smoke.py
    python test/ui_smoke.py --browser msedge
    python test/ui_smoke.py --browser /path/to/chrome
"""

import argparse
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
HARNESS = pathlib.Path(__file__).with_name("ui_smoke_harness.js")

BROWSER_CANDIDATES = {
    "chrome": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ],
    "msedge": [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "/usr/bin/microsoft-edge",
    ],
}


def find_browser(choice):
    if choice in BROWSER_CANDIDATES:
        for path in BROWSER_CANDIDATES[choice]:
            if pathlib.Path(path).is_file():
                return path
        found = shutil.which(choice)
        if found:
            return found
        return None
    return choice if pathlib.Path(choice).is_file() else None


def main():
    ap = argparse.ArgumentParser(description="Pikachu Mermaid UI 巡检")
    ap.add_argument("--browser", default="chrome", help="chrome | msedge | 浏览器可执行文件的绝对路径")
    ap.add_argument("--timeout", type=int, default=90, help="子进程超时秒数，默认 90")
    args = ap.parse_args()

    browser = find_browser(args.browser)
    if not browser:
        print("SKIP: 未找到浏览器（可用 --browser 指定路径）")
        return 0

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    harness = HARNESS.read_text(encoding="utf-8")
    if "</body>" not in html:
        print("FAIL: index.html 中找不到 </body>")
        return 1

    tmp = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", suffix=".html", prefix="__ui_smoke_",
        dir=ROOT, delete=False,
    )
    try:
        tmp.write(html.replace("</body>", "<script>\n" + harness + "\n</script>\n</body>"))
        tmp.close()
        proc = subprocess.run(
            [
                browser, "--headless=new", "--disable-gpu", "--no-first-run",
                "--virtual-time-budget=20000", "--dump-dom", pathlib.Path(tmp.name).as_uri(),
            ],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=args.timeout,
        )
        match = re.search(r"<pre id=\"qaOut\">([\s\S]*?)</pre>", proc.stdout)
        if not match:
            print("FAIL: 浏览器未返回巡检结果（页面可能初始化失败）")
            if proc.stderr:
                print(proc.stderr[-1500:])
            return 1
        import html as html_mod
        lines = html_mod.unescape(match.group(1)).splitlines()
        for line in lines:
            print("  " + line)
        failed = [line for line in lines if line.startswith("FAIL")]
        print("")
        if failed:
            print("UI SMOKE FAILED (%d/%d)" % (len(failed), len(lines)))
            return 1
        print("UI SMOKE ALL PASSED (%d)" % len(lines))
        return 0
    except subprocess.TimeoutExpired:
        print("FAIL: 浏览器巡检超时")
        return 1
    finally:
        pathlib.Path(tmp.name).unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
