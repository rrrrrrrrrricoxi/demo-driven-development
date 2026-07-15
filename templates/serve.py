#!/usr/bin/env python3
# 看板静态服(零依赖,no-cache)。
#
#   用法:  python3 app/kanban/serve.py [PORT]
#   默认端口 8898,绑 0.0.0.0,以**本脚本所在目录**(app/kanban)为根(与 cwd 无关)。
#
# 为什么不用裸 `python -m http.server`:后者不发缓存头,浏览器会缓存坏响应
# (改完看不到更新、旧 404 卡住)。这里对每个响应发 Cache-Control: no-store。
# 看板是纯静态(index.html + refs/*.html 都已提交进 git),无构建步。
# refs/ 里是 gen.mjs 渲染好的开发文档,卡片链接指向它们,不会逃出本根目录。

import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8898
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with socketserver.TCPServer(("0.0.0.0", PORT), handler) as httpd:
        print(f"看板 → http://0.0.0.0:{PORT}/  (root={ROOT}, no-cache)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
