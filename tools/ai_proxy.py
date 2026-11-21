#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pikachu Mermaid — 零依赖本地 AI 代理。

作用：
  1. 同源托管本目录的静态页面（打开 http://127.0.0.1:8787 即是完整应用）；
  2. 把 POST /api/chat 转发到任意 OpenAI 兼容的 Chat Completions 端点，
     并原样回传 SSE 流；API Key 只存在于本机环境变量 / 命令行参数，
     不会出现在浏览器代码或 localStorage 中。

用法：
  # 方式 A：环境变量（推荐，密钥不进命令行历史）
  DEEPSEEK_API_KEY=sk-xxx python tools/ai_proxy.py --preset deepseek

  # 方式 B：命令行指定任意 OpenAI 兼容端点
  python tools/ai_proxy.py \
      --upstream https://api.deepseek.com/chat/completions \
      --model deepseek-flash --key sk-xxx --port 8787

  # 方式 C：只托管静态页面，不使用 AI（前端可继续直连预设接口）
  python tools/ai_proxy.py --no-ai

打开后：浏览器访问 http://127.0.0.1:8787 ，在 AI 面板选择「本地代理」。
按 Ctrl+C 退出。
"""

import argparse
import json
import mimetypes
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
PRESETS = {
    "deepseek": ("https://api.deepseek.com/chat/completions", "deepseek-flash", "DEEPSEEK_API_KEY"),
    "qwen": ("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", "qwen-plus", "DASHSCOPE_API_KEY"),
    "glm": ("https://open.bigmodel.cn/api/paas/v4/chat/completions", "glm-4.5-flash", "GLM_API_KEY"),
    "kimi": ("https://api.moonshot.cn/v1/chat/completions", "kimi-k3", "MOONSHOT_API_KEY"),
    "openai": ("https://api.openai.com/v1/chat/completions", "gpt-5.4-mini", "OPENAI_API_KEY"),
}
MAX_BODY = 2 * 1024 * 1024  # 2MB，足够一份很长的提示词 + 历史

UPSTREAM = ""
MODEL = ""
API_KEY = ""
ENABLE_AI = True


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "PikachuProxy/1.0"

    # 不打印请求体 / 查询串，避免把密钥或用户提示词写进终端历史
    def log_message(self, fmt, *args):
        sys.stderr.write("[proxy] %s %s\n" % (self.command, self.path.split("?", 1)[0]))

    # ── 响应辅助 ────────────────────────────────────────────────
    def _origin_allowed(self, origin):
        """只允许本服务自己托管的页面调用，避免任意第三方网页盗用本机密钥。"""
        parsed = urllib.parse.urlparse(origin)
        if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost"):
            return False
        return parsed.port == self.server.server_port

    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin and self._origin_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self._cors()
        self.end_headers()

    # ── 静态资源 ────────────────────────────────────────────────
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        rel = urllib.parse.unquote(parsed.path).lstrip("/") or "index.html"
        target = (ROOT / rel).resolve()
        # 目录穿越防护：解析后的真实路径必须位于项目根目录内
        if target != ROOT and ROOT not in target.parents:
            self._json(403, {"error": "forbidden"})
            return
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            self._json(404, {"error": "not found"})
            return
        content = target.read_bytes()
        ctype, _ = mimetypes.guess_type(str(target))
        if target.suffix.lower() in (".js", ".mjs"):
            ctype = "text/javascript; charset=utf-8"
        elif target.suffix.lower() == ".webmanifest":
            ctype = "application/manifest+json; charset=utf-8"
        elif target.suffix.lower() in (".html", ".htm"):
            ctype = "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self._cors()
        self.end_headers()
        self.wfile.write(content)

    # ── AI 转发 ─────────────────────────────────────────────────
    def do_POST(self):
        if parsed_path(self.path) != "/api/chat":
            self._json(404, {"error": "not found"})
            return
        origin = self.headers.get("Origin", "")
        # 浏览器会为跨站 POST 附带 Origin；第三方页面不得借用本机代理消耗的密钥额度
        if origin and not self._origin_allowed(origin):
            self._json(403, {"error": "origin not allowed"})
            return
        if not ENABLE_AI or not UPSTREAM:
            self._json(503, {"error": "AI 代理未配置。请用 --upstream 或 --preset 指定上游服务。"})
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            self._json(400, {"error": "invalid Content-Length"})
            return
        if length <= 0 or length > MAX_BODY:
            self._json(413, {"error": "请求体为空或过大"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as exc:
            self._json(400, {"error": "JSON 解析失败: %s" % exc})
            return
        if not isinstance(body, dict) or not isinstance(body.get("messages"), list):
            self._json(400, {"error": "缺少 messages 数组"})
            return
        body["model"] = body.get("model") or MODEL
        body.setdefault("stream", True)

        headers = {"Content-Type": "application/json"}
        if API_KEY:
            headers["Authorization"] = "Bearer " + API_KEY
        req = urllib.request.Request(
            UPSTREAM, data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers=headers, method="POST",
        )
        try:
            resp = urllib.request.urlopen(req, timeout=180)
        except urllib.error.HTTPError as exc:
            detail = exc.read(4096).decode("utf-8", "replace")
            self._json(exc.code, {"error": "上游返回 HTTP %d" % exc.code, "detail": detail})
            return
        except urllib.error.URLError as exc:
            self._json(502, {"error": "无法连接上游服务", "detail": str(exc.reason)})
            return

        ctype = resp.headers.get("Content-Type") or "text/event-stream; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self._cors()
        # 流式响应没有 Content-Length：显式关闭连接，避免客户端一直等待结束
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()
        try:
            while True:
                chunk = resp.read(4096)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass  # 用户点了「取消」，上游费用已产生但连接断开属预期行为
        finally:
            resp.close()


def parsed_path(path):
    return urllib.parse.urlparse(path).path


def main():
    ap = argparse.ArgumentParser(description="Pikachu Mermaid 零依赖本地 AI 代理")
    ap.add_argument("--preset", choices=sorted(PRESETS), help="使用内置服务商预设")
    ap.add_argument("--upstream", default=os.environ.get("AI_UPSTREAM", ""), help="OpenAI 兼容 chat/completions 完整地址")
    ap.add_argument("--model", default=os.environ.get("AI_MODEL", ""), help="默认模型名（前端可覆盖）")
    ap.add_argument("--key", default=os.environ.get("AI_KEY", ""), help="API Key；建议改用环境变量")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8787")), help="监听端口，默认 8787")
    ap.add_argument("--no-ai", action="store_true", help="只托管静态页面，不启用 /api/chat")
    args = ap.parse_args()

    global UPSTREAM, MODEL, API_KEY, ENABLE_AI
    if args.preset:
        upstream, model, key_env = PRESETS[args.preset]
        UPSTREAM = args.upstream or upstream
        MODEL = args.model or model
        API_KEY = args.key or os.environ.get(key_env, "")
    else:
        UPSTREAM = args.upstream
        MODEL = args.model
        API_KEY = args.key
    ENABLE_AI = not args.no_ai

    server = ThreadingHTTPServer(("127.0.0.1", args.port), ProxyHandler)
    print("Pikachu Mermaid 已启动： http://127.0.0.1:%d" % args.port)
    if ENABLE_AI:
        print("AI 上游： %s" % (UPSTREAM or "（未配置）"))
        print("默认模型： %s" % (MODEL or "（由前端指定）"))
        print("API Key： %s" % ("已载入，不会发送到浏览器" if API_KEY else "未设置（直连上游可能返回 401）"))
    else:
        print("AI 转发：已禁用（--no-ai）")
    print("按 Ctrl+C 退出。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
