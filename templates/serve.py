#!/usr/bin/env python3
# 看板静态服(零依赖,no-cache,线程化 + gzip)。
#
#   用法:  python3 app/kanban/serve.py [PORT]
#   默认端口 8898,绑 0.0.0.0,以**本脚本所在目录**(app/kanban)为根(与 cwd 无关)。
#
# 为什么不用裸 `python -m http.server`:后者不发缓存头,浏览器会缓存坏响应
# (改完看不到更新、旧 404 卡住)。这里对每个响应发 Cache-Control: no-store。
# 看板是纯静态(index.html + refs/*.html 都已提交进 git),无构建步。
# refs/ 里是 gen.mjs 渲染好的开发文档,卡片链接指向它们,不会逃出本根目录。
#
# v0.11.0 自宿主实战回流两刀(弱链路痛点):
#   线程化 —— 单线程下一个慢客户端(远程隧道/睡着的 tab)会饿死其他请求(队头阻塞);
#   gzip  —— 看板单页可达数百 KB,文本类按请求压缩(level 6),弱链路传输量降 ~75%。

import functools
import gzip
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8898
ROOT = os.path.dirname(os.path.abspath(__file__))

# 按请求压缩的文本类扩展名(每请求整读整压,不缓存压缩体——no-store 语义下本就每次重传)
COMPRESSIBLE = {".html", ".htm", ".css", ".js", ".json", ".svg", ".md", ".txt"}


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        path = self.translate_path(self.path)
        # 目录且无尾斜杠:让基类走 301 重定向(直接回 index.html 会坏掉页内相对链接)
        if os.path.isdir(path) and not self.path.split("?", 1)[0].endswith("/"):
            return super().do_GET()
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        ext = os.path.splitext(path)[1].lower()
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "")
        if ext in COMPRESSIBLE and os.path.isfile(path) and accepts_gzip:
            try:
                with open(path, "rb") as f:
                    body = gzip.compress(f.read(), 6)
                self.send_response(200)
                self.send_header("Content-Type", self.guess_type(path))
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Vary", "Accept-Encoding")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            except OSError:
                pass  # 读失败退回基类路径(404/权限等由它处理)
        super().do_GET()


class ThreadingServer(socketserver.ThreadingTCPServer):
    daemon_threads = True  # Ctrl-C 即退,不等慢连接
    allow_reuse_address = True


def main():
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with ThreadingServer(("0.0.0.0", PORT), handler) as httpd:
        print(f"看板 → http://0.0.0.0:{PORT}/  (root={ROOT}, no-cache, gzip, threaded)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
