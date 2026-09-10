#!/usr/bin/env python3
# ddd-serve v2
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
#
# v0.17.0 验收反馈共享(kanban.config.json 的 acceptanceFeedback === true 才开):
#   两个只追加的 POST 口 —— /api/acceptance/mark 写一行 jsonl,/api/acceptance/shot 落一张截图。
#   关着(缺省)时这两条路 404,其余 POST 路径照旧 501,GET 一个字节都不变。
#   校验全做(清单里有没有这个 PR / 条目、who 长度与控制字符、verdict 枚举、note 长度、
#   图 ≤ 2 MB + 魔数 + Content-Type 相符),文件名只由服务端拼(不接受客户端文件名);
#   写盘走 O_APPEND 单次 write + fsync —— 两个人同时点也不会把对方的行截断。

import functools
import gzip
import http.server
import json
import os
import re
import socketserver
import sys
import time
from urllib.parse import parse_qs, urlsplit

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8898
ROOT = os.path.dirname(os.path.abspath(__file__))

# 按请求压缩的文本类扩展名(每请求整读整压,不缓存压缩体——no-store 语义下本就每次重传)
COMPRESSIBLE = {".html", ".htm", ".css", ".js", ".json", ".svg", ".md", ".txt"}

# ---- 验收反馈共享(opt-in)----
FEEDBACK_FILE = os.path.join(ROOT, "acceptance-feedback.jsonl")
SHOTS_DIR = os.path.join(ROOT, "shots")
MARK_ROUTE = "/api/acceptance/mark"
SHOT_ROUTE = "/api/acceptance/shot"
MAX_SHOT = 2 * 1024 * 1024  # 客户端已按长边 1280 / JPEG 0.8 压过,2 MB 是兜底不是目标
MAX_MARK = 64 * 1024
# 超限的请求体也照读照扔(至多这么多):不读完就答,客户端还在发,它看到的是断管不是那句 400
DRAIN_MAX = 8 * 1024 * 1024
WHO_MAX = 20
NOTE_MAX = 2000
# Content-Type → (魔数, 扩展名):两者对不上就是 400,不看客户端说什么
IMAGE_TYPES = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
}


def feedback_on():
    """每次请求现读 config —— 开关拨一下不必重启服务;读不到 = 关。"""
    try:
        with open(os.path.join(ROOT, "kanban.config.json"), "rb") as f:
            return json.load(f).get("acceptanceFeedback") is True
    except (OSError, ValueError):
        return False


def acc_lists():
    """PR 号 → (条目 id 集合, revision)。清单缺席/坏 JSON = 空表,于是一切写入 400。"""
    out = {}
    try:
        with open(os.path.join(ROOT, "acceptance-manifest.json"), "rb") as f:
            acm = json.load(f)
    except (OSError, ValueError):
        return out
    for lst in acm.get("lists") or []:
        if not isinstance(lst, dict):
            continue
        pr = lst.get("pr")
        nums = pr if isinstance(pr, list) else [pr]
        rev = lst.get("revision")
        rev = rev if isinstance(rev, int) else 1
        ids = set()
        for it in lst.get("items") or []:
            if isinstance(it, dict) and it.get("id") is not None:
                ids.add(str(it["id"]))
        for n in nums:
            try:
                n = int(n)
            except (TypeError, ValueError):
                continue
            out.setdefault(n, (ids, rev))  # 同号落两份清单:第一份为准(gen 那边会出警告)
    return out


def slug(s):
    """条目 id 是人写在清单里的正文,进文件名前只留这几类字符(路径分隔符/引号一律换成 _)。"""
    return re.sub(r"[^A-Za-z0-9_.-]", "_", s)[:40] or "_"


def shot_name_ok(name, pr, item):
    """截图名只认服务端自己拼得出来的那一种 —— 客户端拿别的名字来挂,一律不认。"""
    return bool(re.fullmatch(r"acc-%d-%s-\d{8}T\d{6}(?:-\d+)?\.(?:jpg|png)"
                             % (pr, re.escape(slug(item))), name))


def append_line(path, line):
    """O_APPEND + 单次 write:并发两笔各自成行,谁也插不进谁中间;fsync 才算写进去了。"""
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    try:
        os.write(fd, line)
        os.fsync(fd)
    finally:
        os.close(fd)


class Rejected(Exception):
    """校验失败 → 400 + 一句原因(不吞错,页面上直接显示这句)。"""


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
            try:  # try 只包「读 + 压」:发头之前失败才可安全落回基类;写体异常照常向上抛,绝不在同一连接答第二次
                with open(path, "rb") as f:
                    body = gzip.compress(f.read(), 6)
            except OSError:
                return super().do_GET()
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    # ---- 验收反馈共享:两个只追加的写口(acceptanceFeedback 关着时不存在)----
    def do_POST(self):
        route = urlsplit(self.path).path
        if route not in (MARK_ROUTE, SHOT_ROUTE):
            return self.send_error(501, "Unsupported method ('POST')")  # 与没有 do_POST 时同一句
        if not feedback_on():
            return self.reply_json(404, {"error": "acceptanceFeedback 未开(kanban.config.json)"})
        try:
            body = self.post_mark() if route == MARK_ROUTE else self.post_shot()
        except Rejected as e:
            return self.reply_json(400, {"error": str(e)})
        except OSError as e:  # 落盘失败不吞:页面上要看得见
            return self.reply_json(500, {"error": "写入失败:%s" % e})
        self.reply_json(200, body)

    def reply_json(self, code, obj):
        body = obj if isinstance(obj, bytes) else json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self, cap):
        raw = self.headers.get("Content-Length")
        try:
            n = int(raw)
        except (TypeError, ValueError):
            raise Rejected("缺 Content-Length")
        if n < 0:
            raise Rejected("Content-Length 非法")
        if n > cap:
            left = n if n <= DRAIN_MAX else 0  # 太大就不陪读了:那种请求本来也不该发出来
            while left > 0:
                chunk = self.rfile.read(min(left, 65536))
                if not chunk:  # 客户端半路撒手:读到 EOF 就别等了
                    break
                left -= len(chunk)
            raise Rejected("请求体 %d 字节,超过上限 %d" % (n, cap))
        return self.rfile.read(n)

    @staticmethod
    def check_who(pr, item, who):
        """三个必填字段的校验;返回规整后的 (pr, item, who, 清单 revision)。"""
        lists = acc_lists()
        try:
            pr = int(pr)
        except (TypeError, ValueError):
            raise Rejected("pr 不是数字")
        if pr not in lists:
            raise Rejected("PR #%d 不在 acceptance-manifest 的任何清单里" % pr)
        ids, rev = lists[pr]
        item = "" if item is None else str(item)
        if item not in ids:
            raise Rejected("条目「%s」不属于 PR #%d 的清单" % (item, pr))
        who = "" if who is None else str(who)
        if not 1 <= len(who) <= WHO_MAX:
            raise Rejected("who 需 1–%d 字" % WHO_MAX)
        if any(ord(c) < 32 or ord(c) == 127 for c in who):
            raise Rejected("who 含控制字符")
        return pr, item, who, rev

    def post_mark(self):
        try:
            data = json.loads(self.read_body(MAX_MARK).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise Rejected("请求体不是合法 JSON")
        if not isinstance(data, dict):
            raise Rejected("请求体不是 JSON 对象")
        pr, item, who, rev = self.check_who(data.get("pr"), data.get("item"), data.get("who"))
        verdict = data.get("verdict")
        if verdict is None or verdict == "":
            verdict = ""
        elif verdict not in ("ok", "bad"):
            raise Rejected("verdict 只能是 ok / bad(或省略)")
        note = data.get("note")
        note = "" if note is None else note
        if not isinstance(note, str):
            raise Rejected("note 不是字符串")
        if len(note) > NOTE_MAX:
            raise Rejected("note 超过 %d 字" % NOTE_MAX)
        shot = data.get("shot")
        shot = "" if shot is None else shot
        if shot:
            if not isinstance(shot, str) or not shot_name_ok(shot, pr, item):
                raise Rejected("shot 不是本服务为这条目生成的文件名")
            if not os.path.isfile(os.path.join(SHOTS_DIR, shot)):
                raise Rejected("shot 文件不在 shots/")
        if not verdict and not note and not shot:
            raise Rejected("verdict / note / shot 至少要有一样")
        rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
               "pr": pr, "item": item, "who": who, "rev": rev}
        if verdict:
            rec["verdict"] = verdict
        if note:
            rec["note"] = note
        if shot:
            rec["shot"] = shot
        line = (json.dumps(rec, ensure_ascii=False) + "\n").encode("utf-8")
        append_line(FEEDBACK_FILE, line)
        return line  # 返回写入的那一行,页面直接并进本地视图

    def post_shot(self):
        q = parse_qs(urlsplit(self.path).query)
        pick = lambda k: (q.get(k) or [None])[0]
        pr, item, _who, _rev = self.check_who(pick("pr"), pick("item"), pick("who"))
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype not in IMAGE_TYPES:
            raise Rejected("Content-Type 只收 image/jpeg 与 image/png")
        raw = self.read_body(MAX_SHOT)
        magic, ext = IMAGE_TYPES[ctype]
        if not raw.startswith(magic):
            raise Rejected("图片魔数与 Content-Type 对不上")
        os.makedirs(SHOTS_DIR, exist_ok=True)
        base = "acc-%d-%s-%s" % (pr, slug(item), time.strftime("%Y%m%dT%H%M%S", time.gmtime()))
        for i in range(20):  # 同一秒同一条目连贴:加 -1 -2 …,绝不覆盖已有文件
            name = base + ("" if i == 0 else "-%d" % i) + ext
            try:
                fd = os.open(os.path.join(SHOTS_DIR, name), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
            except FileExistsError:
                continue
            try:
                os.write(fd, raw)
                os.fsync(fd)
            finally:
                os.close(fd)
            return {"shot": name}
        raise Rejected("同一秒里这条目的截图太多,过一秒再贴")


class ThreadingServer(socketserver.ThreadingTCPServer):
    daemon_threads = True  # Ctrl-C 即退,不等慢连接
    allow_reuse_address = True


def main():
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with ThreadingServer(("0.0.0.0", PORT), handler) as httpd:
        # 端口取真正绑上的那个:传 0 时由内核分配,横竖要打印得出来才连得上
        port = httpd.server_address[1]
        fb = ",反馈写口" if feedback_on() else ""
        print(f"看板 → http://0.0.0.0:{port}/  (root={ROOT}, no-cache, gzip, threaded{fb})", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
