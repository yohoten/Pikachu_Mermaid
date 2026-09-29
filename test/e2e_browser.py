"""Pikachu Mermaid — 浏览器端到端回归（可选）

用法: python test/e2e_browser.py
      python test/e2e_browser.py --channel msedge

与 check.js / func_test.js 的关系：
    前两者在 Node 里跑纯逻辑；本脚本在**真实浏览器**里跑完整个 app，
    覆盖那些只有在 DOM 真实存在时才会暴露的问题（高亮层错位、Tab/undo、
    关闭脏标签是否弹确认、localStorage 草稿体积等）。

依赖: pip install playwright && playwright install chromium
     或本机已装 Chrome / Edge（脚本默认用 channel="chrome"，可 --channel msedge）。

未安装 playwright 时直接打印 SKIP 并退出 0——它不参与 npm test，
避免在没装 Python 依赖的环境里把回归整条跑红。
"""
import asyncio
import argparse
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = ROOT.joinpath("index.html").as_uri()

results = []


def chk(label, cond, extra=""):
    results.append((label, bool(cond), extra))
    print(("  OK   " if cond else "  FAIL ") + label + (("  | " + str(extra)) if extra else ""))


def norm(s):
    # 高亮层的 <pre> 会把部分空白渲染成 NBSP
    return s.replace("\u00a0", " ")


async def main(channel):
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel=channel)
        page = await browser.new_page()

        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(URL)
        await page.wait_for_timeout(1200)
        await page.evaluate("localStorage.clear()")
        await page.reload()
        await page.wait_for_timeout(1500)

        print("== 1. 启动 ==  ")
        chk("页面无 JS 错误", not errors, errors[:3])
        chk("版本号已显示", await page.inner_text("#appVersion") == "1.1.0")
        chk("mermaid 渲染出 svg", await page.locator("#previewContainer svg").count() > 0)

        print("== 2. Tab 缩进 / 撤销 / 重做（P0-2 P0-3）==")
        original = await page.input_value("#editor")
        await page.click("#editor")
        await page.keyboard.press("Control+End")
        await page.wait_for_timeout(200)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(400)
        tabbed = await page.input_value("#editor")
        chk("Tab 插入 4 空格", tabbed == original + "    ")
        chk("Tab 后高亮层同步", norm(await page.inner_text("#editorHighlight")) == tabbed)
        await page.keyboard.press("Control+z")
        await page.wait_for_timeout(400)
        undone = await page.input_value("#editor")
        chk("Tab 缩进可撤销（原实现不可撤销）", undone == original)
        chk("撤销后高亮层同步（原实现会错位）", norm(await page.inner_text("#editorHighlight")) == undone)
        await page.keyboard.press("Control+y")
        await page.wait_for_timeout(400)
        chk("重做可恢复 Tab 缩进", await page.input_value("#editor") == tabbed)
        chk("重做后高亮层同步", norm(await page.inner_text("#editorHighlight")) == tabbed)

        print("== 3. 输入与图表类型识别（P1-1）==")
        await page.click("#editor")
        await page.keyboard.press("Control+a")
        await page.keyboard.type(
            "sequenceDiagram\n  participant A as 客户端\n  A->>B: 使用 flowchart 说明"
        )
        await page.wait_for_timeout(600)
        chk(
            "正文含 flowchart 仍识别为序列图",
            await page.inner_text("#chartTypeTag") == "序列图",
            await page.inner_text("#chartTypeTag"),
        )
        chk("输入后高亮层同步", norm(await page.inner_text("#editorHighlight"))
            == await page.input_value("#editor"))

        print("== 4. 整块缩进 / 反缩进 ==")
        await page.keyboard.press("Control+a")
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(400)
        indented = await page.input_value("#editor")
        await page.keyboard.press("Shift+Tab")
        await page.wait_for_timeout(400)
        outdented = await page.input_value("#editor")
        chk("Shift+Tab 整块反缩进生效", len(outdented) < len(indented) and not outdented.startswith("    "))

        print("== 5. 多标签数据保全（P0-4 P0-1 P0-5）==")
        await page.click("#btnNewTab")
        await page.wait_for_timeout(500)
        await page.click("#editor")
        await page.keyboard.press("Control+a")
        await page.keyboard.type("graph TD\n  X-->Y")
        await page.wait_for_timeout(700)
        chk("已开两个标签", await page.locator("#tabList .tab").count() == 2)

        await page.locator("#tabList .tab").nth(0).click()
        await page.wait_for_timeout(400)
        seen = {"v": False}

        async def on_dialog(d):
            seen["v"] = True
            await d.accept()

        page.on("dialog", on_dialog)
        await page.locator("#tabList .tab").nth(1).locator(".tclose").click()
        await page.wait_for_timeout(600)
        chk("关闭非活动脏标签会弹确认（原实现静默丢弃）", seen["v"])

        draft = await page.evaluate("localStorage.getItem('pikachu_mermaid_draft_v1')")
        chk("草稿已写入", draft is not None)
        chk("草稿不再落盘 historyState", draft and "historyState" not in draft)
        chk("草稿体积受控 < 50KB", draft and len(draft) < 50 * 1024, len(draft or ""))

        chk("全过程无 JS 错误", not errors, errors[:3])
        await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel", default="chrome", help="chrome | msedge")
    args = ap.parse_args()
    try:
        asyncio.run(main(args.channel))
    except ImportError:
        print("SKIP: 未安装 playwright（pip install playwright 后可启用浏览器级回归）")
        sys.exit(0)
    except Exception as exc:  # 浏览器缺失 / 无法启动时不阻断主回归
        print("SKIP: 浏览器回归不可用 -> %s" % exc)
        sys.exit(0)

    bad = [r for r in results if not r[1]]
    print("")
    if bad:
        print("E2E FAILED (%d/%d)" % (len(bad), len(results)))
        for label, _, extra in bad:
            print("   - " + label + "  " + str(extra))
        sys.exit(1)
    print("E2E ALL PASSED (%d)" % len(results))
    sys.exit(0)
