#!/usr/bin/env python3
# ddd-serve v5
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
#   写口还有一道跨站门(Sec-Fetch-Site / Origin)+ mark 认死 application/json:信任边界是
#   「连得到这个端口的人都能写」,但别人网页上的一行 fetch 不该算在这个边界里(见 README)。
#
# v0.17.1 判定即勾选:verdict 枚举多一个 "none"(撤回判定)—— 撤回不是删行,是再追加一条,
#   两条都留着。账只增不删这条口径没变,别的校验、跨站门、截图规则一个字没动。
#
# v0.17.6 名册与口令(只在 acceptanceFeedback 写成 {"pin": "1111"} 时存在):
#   谁能在验收账上出现,应该有人点头。名册是 acceptance-roster.json(进 git),往里加人要那 4 位口令:
#   第三个写口 /api/acceptance/who 收 {name, pin} —— 口令对就把归一后的名字并进名册并回整份名册,
#   不对就 sleep 1s 再 403(不锁、不计数:信任边界仍在网络层,这一秒只防手滑连点)。
#   配了口令之后,mark 与 shot 只收名册里的名字(否则 403),名册那一份 GET 也改由服务端答(文件还
#   没建时答空名册,否则页面以为这块板没有名册这回事,不问口令就署名,却在 mark 那儿被 403 卡死);
#   没配口令(acceptanceFeedback: true)时 who 这条路压根不存在(501,与 v3 同一句),mark/shot 照 v3
#   收任何名字,名册那份 GET 照旧当静态文件发 —— 老宿主逐响应零差异。
#
# v0.17.9 名册那条写口两处对齐(所以戳升 v5:同一个请求,v4 与 v5 的答复可能不一样):
#   下限 —— 名字至少 2 个码点,与页面上 save() 那把尺同一个数(原来 1 个字也收,页面收不下的
#   东西却进得了名册);去重 —— 名册里的条目也各过一遍 norm_who 再比,与 mark/shot 那道名册门
#   同一把尺(原来拿归一后的名字比未归一的名册,手写进 git 的「甲乙 」会被再加一行)。
#   acceptanceFeedback: true(没配口令)的板上这条路仍然不存在,逐响应与 v4 零差异。

import functools
import gzip
import http.server
import json
import os
import re
import socketserver
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8898
ROOT = os.path.dirname(os.path.abspath(__file__))

# 按请求压缩的文本类扩展名(每请求整读整压,不缓存压缩体——no-store 语义下本就每次重传)
# .jsonl 在列:验收 tab 开着时每 20 秒重拉一遍整份账,而它只增不删 —— 唯一高频轮询的文本
# 文件不压,gzip 当初为弱链路加的那一刀就正好绕开了它。
COMPRESSIBLE = {".html", ".htm", ".css", ".js", ".json", ".jsonl", ".svg", ".md", ".txt"}

# ---- 验收反馈共享(opt-in)----
FEEDBACK_FILE = os.path.join(ROOT, "acceptance-feedback.jsonl")
ROSTER_FILE = os.path.join(ROOT, "acceptance-roster.json")
ROSTER_ROUTE = "/acceptance-roster.json"
SHOTS_DIR = os.path.join(ROOT, "shots")
MARK_ROUTE = "/api/acceptance/mark"
SHOT_ROUTE = "/api/acceptance/shot"
WHO_ROUTE = "/api/acceptance/who"
# \Z 不是 $:Python 的 $ 还认「末尾那个换行之前」,"1111\n" 会被当成合法口令,而页面那把同样的尺
# (gen 的 /^[0-9]{4}$/)不认 —— 两边对同一份 config 判得不一样,是迟早要还的账
PIN_RE = re.compile(r"^[0-9]{4}\Z")
MAX_SHOT = 2 * 1024 * 1024  # 客户端已按长边 1280 / JPEG 0.8 压过,2 MB 是兜底不是目标
MAX_MARK = 64 * 1024
# 超限的请求体也照读照扔(至多这么多):不读完就答,客户端还在发,它看到的是断管不是那句 400
DRAIN_MAX = 8 * 1024 * 1024
# 名字两头的尺:上限 20、下限 2,都按**码点**数(不是字节,也不是 UTF-16 格)——
# 页面上那只 save() 的下限就是 `Array.from(v).length < 2`,i.maxLength 那 40 格换算过来也是 20 码点。
# 两处写死同一个数:名字在页面上过得去、到了写口却被退,人只会以为服务坏了。
WHO_MIN = 2
WHO_MAX = 20
NOTE_MAX = 2000
# Content-Type → (魔数, 扩展名):两者对不上就是 400,不看客户端说什么
IMAGE_TYPES = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
}


class BadConfig(Exception):
    """config 里的 acceptanceFeedback 写坏了 → 500 + 一句说清(悄悄当没配 = 谁都能署名)。"""


def feedback_cfg():
    """每次请求现读 config —— 开关拨一下不必重启服务;读不到 = 关。

    两种写法(与 plugin scripts/accfb.mjs 同一套规则,那边是 JS 这边是 Python):
      true              → (True, "")     不要口令,v0.17.0 起的行为
      {"pin": "1111"}   → (True, "1111") 新名字进名册要这 4 位
    写成对象但 pin 不是 4 位数字串 → BadConfig(不猜、不退化成「没口令」)。
    """
    try:
        with open(os.path.join(ROOT, "kanban.config.json"), "rb") as f:
            v = json.load(f).get("acceptanceFeedback")
    except (OSError, ValueError):
        return (False, "")
    if v is True:
        return (True, "")
    if isinstance(v, dict):
        pin = v.get("pin")
        if not isinstance(pin, str) or not PIN_RE.match(pin):
            raise BadConfig(
                "kanban.config.json 的 acceptanceFeedback.pin 必须是 4 位数字字符串(如 \"1111\"),"
                "现在是 %s —— 两种写法只有两种:true(不要口令)或 { \"pin\": \"1111\" }" % json.dumps(pin, ensure_ascii=False))
        return (True, pin)
    return (False, "")


def norm_who(v):
    """名字归一:清控制字符、去首尾空白、按码点切 20(与页面上那只 fbWhoNorm 同一套)。"""
    s = "" if v is None else str(v)
    s = "".join(c for c in s if not (ord(c) < 32 or ord(c) == 127))
    return s.strip()[:WHO_MAX]  # Python 的 str 本来就按码点索引,切不出半个 emoji


def roster_names():
    """名册里的名字(缺席 / 坏 JSON = 空名册)。"""
    try:
        with open(ROSTER_FILE, "rb") as f:
            o = json.load(f)
    except (OSError, ValueError):
        return []
    names = o.get("names") if isinstance(o, dict) else None
    return [n for n in names if isinstance(n, str)] if isinstance(names, list) else []


def roster_write(names):
    """整份重写(名册是一份 JSON,不像账那样只追加):先写临时文件再 rename —— 半截名册不会露出来。

    临时文件名带线程号:这台服务是线程化的,两个人同一秒加名字就是两个线程。共用一个 .tmp 的话,
    后到那个 O_TRUNC 把前一个正在写的截了,长的写在前、短的写在后,rename 出去的是「短的 + 长的尾巴」
    —— 名册从此不是合法 JSON,roster_names() 读成空,全板的人在 mark 那儿一律 403,得有人手工修文件。
    (实测 40 轮并发两写里第 16 轮就撞出来过。)

    ponytail:读—改—写之间仍没有锁,两个人同一秒加名字会掉一个(后写的那份没有前一个的名字)。
    掉一个只要再输一次口令就补回来,不像撕坏那样要人动手;加名字是一辈子一次的动作,现在按这个
    量级不值得上锁。真要上,给 ROSTER_FILE 配一把 O_EXCL 的锁文件即可。
    """
    body = (json.dumps({"names": names}, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    tmp = "%s.%d.tmp" % (ROSTER_FILE, threading.get_ident())
    write_fd(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644), body)
    os.replace(tmp, ROSTER_FILE)


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


def write_fd(fd, data):
    """写完再 fsync 再关 —— 两个写口共用:写完才算数,写不进去就让 OSError 冒上去。

    os.write 不保证一次写完(盘满时 write(2) 可以只写一部分而不抛 ENOSPC,信号打断同理)。
    丢掉它的返回值 = jsonl 落半行、截图落半张,而两条写口照样答 200:半行随后被读的人当坏行
    跳过,那条反馈在人眼里「已记下」,实际永久没了。所以写到写完为止。
    """
    try:
        n = 0
        while n < len(data):
            w = os.write(fd, data[n:])
            if w <= 0:  # 写不动又不抛:别在这儿转圈,当写失败报上去
                raise OSError("os.write 写了 0 字节(盘满?)")
            n += w
        os.fsync(fd)
    finally:
        os.close(fd)


def append_line(path, line):
    """O_APPEND + 单次 write:并发两笔各自成行,谁也插不进谁中间。"""
    write_fd(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644), line)


class Rejected(Exception):
    """校验失败 → 400 + 一句原因(不吞错,页面上直接显示这句)。"""


class Denied(Exception):
    """这一笔本身合格,但这个人没这个份 → 403(口令不对 / 名字未在名册)。"""


def check_wellformed(s, label):
    """人写的那两段字(who / note)编不编得成 UTF-8。

    落单的代理对(\\ud83d 这种,JSON 里合法)要到 json.dumps(...).encode("utf-8") 那一步才炸,
    而 UnicodeEncodeError 是 ValueError 不是 OSError —— 漏出 do_POST 就是掐连接:客户端连
    那句 400 都收不到,页面上还会把它误报成「你的 serve.py 太旧」。在这儿就说清楚。
    """
    try:
        s.encode("utf-8")
    except UnicodeError:
        raise Rejected("%s 含非法字符(落单的代理对)" % label)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        # 配了口令的板:名册这一份由服务端答,不当静态文件发 —— 文件还没建(第一个人还没署过名)
        # 时也要答一份空名册。答 404 的话页面读成「这块板没有名册这回事」,于是不问口令就署名,
        # 而 mark 那头正按名册卡着 403:人被告知「先在署名那格输一次口令」,而那格永远不会出现。
        # 名册读坏了同理按空名册答(下一次 who 会把它整份重写回来)。没配口令时一个字节都不动。
        if urlsplit(self.path).path == ROSTER_ROUTE:
            try:
                _on, pin = feedback_cfg()
            except BadConfig:
                pin = ""  # config 坏了:照旧当静态文件发,报错归写口与 gen 那两处
            if pin:
                return self.reply_json(200, {"names": roster_names()})
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

    # ---- 验收反馈共享:三个写口(acceptanceFeedback 关着时不存在;who 还要配了口令才存在)----
    def do_POST(self):
        route = urlsplit(self.path).path
        if route not in (MARK_ROUTE, SHOT_ROUTE, WHO_ROUTE):
            return self.send_error(501, "Unsupported method ('POST')")  # 与没有 do_POST 时同一句
        try:
            on, pin = feedback_cfg()
        except BadConfig as e:
            return self.reply_json(500, {"error": str(e)})
        # 没配口令 = 没有名册这套机制,这条路压根不存在:答得跟 0.17.5(它根本没有这条路)一个字不差,
        # 这句要在下面那两道门之前 —— acceptanceFeedback 写 true 或关着的板上,这一路的每个回应都得冻住
        if route == WHO_ROUTE and not pin:
            return self.send_error(501, "Unsupported method ('POST')")
        if not on:
            return self.reply_json(404, {"error": "acceptanceFeedback 未开(kanban.config.json)"})
        bad = self.cross_site()
        if bad:
            return self.reply_json(403, {"error": bad})
        try:
            if route == WHO_ROUTE:
                body = self.post_who(pin)
            else:
                body = self.post_mark(pin) if route == MARK_ROUTE else self.post_shot(pin)
        except Rejected as e:
            return self.reply_json(400, {"error": str(e)})
        except Denied as e:
            return self.reply_json(403, {"error": str(e)})
        except (OSError, UnicodeError) as e:  # 落盘失败 / 编不出字节:都不吞,页面上要看得见
            return self.reply_json(500, {"error": "写入失败:%s" % e})
        self.reply_json(200, body)

    def cross_site(self):
        """跨站就回一句 why;同源(或压根不是浏览器发的)回空串。

        浏览器给每个请求盖 Sec-Fetch-Site,跨站的写请求还带 Origin;本机的 curl / 脚本两者都不发,
        所以这道门只挡「别人的网页替你的浏览器来写」,不挡你自己的命令行。
        """
        site = (self.headers.get("Sec-Fetch-Site") or "").strip().lower()
        if site and site != "same-origin":
            return "跨站请求不受理(Sec-Fetch-Site: %s)" % site
        origin = self.headers.get("Origin")
        if origin and origin.split("//", 1)[-1] != (self.headers.get("Host") or ""):
            return "跨站请求不受理(Origin: %s)" % origin
        return ""

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
    def check_target(pr, item, who, pin):
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
        check_wellformed(who, "who")
        # 配了口令的板:账上只认名册里的名字。名字进名册走 /api/acceptance/who(要口令)。
        # 两边都过同一只 norm_who 再比:who 写口收下的是归一后的串,而名册也可能是人手写进 git 的
        # (首宿主就是这么起的账),差一个尾空格就成了一道人看不见的门 —— 「甲 」入了册,「甲」被拒,
        # 而页面上这两个名字长得一模一样。归一后的那个串也是记进账里的那个,同一个人不会因为多打
        # 一个空格在账上变成两个人。
        if pin:
            who = norm_who(who)
            if who not in [norm_who(n) for n in roster_names()]:
                raise Denied("「%s」未在名册 —— 先在署名那格输一次口令,把名字加进 acceptance-roster.json" % who)
        return pr, item, who, rev

    def post_who(self, pin):
        """名字进名册(v0.17.6):口令对才收,收下即回整份名册。名册只加不删 —— 删名改文件再提交。"""
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":  # 与 mark 同一条理由:simple type 不走预检,跨站一行 fetch 就能加人
            raise Rejected("Content-Type 只收 application/json")
        try:
            data = json.loads(self.read_body(MAX_MARK).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise Rejected("请求体不是合法 JSON")
        if not isinstance(data, dict):
            raise Rejected("请求体不是 JSON 对象")
        name = norm_who(data.get("name"))
        # 下限与页面那只 save() 同一个数:len() 数的是码点,一个 emoji 算一个字(占两格是 UTF-16 的事,
        # 与人看到的「几个字」无关)。页面收得下、写口退回去,人只会以为服务坏了。
        if len(name) < WHO_MIN:
            raise Rejected("名字至少 %d 个字" % WHO_MIN)
        if len(name) > WHO_MAX:  # norm_who 已按码点切到 WHO_MAX;这一条是「哪天尺换了没换全」的兜底
            raise Rejected("name 至多 %d 字" % WHO_MAX)
        check_wellformed(name, "name")
        got = data.get("pin")
        if not isinstance(got, str) or got != pin:
            time.sleep(1)  # 不锁、不计数、不记账:这一秒只防手滑连点(见文件头 v0.17.6 那段)
            raise Denied("口令不对")
        names = roster_names()
        # 去重与 check_target 那道门用同一把尺:名册里的条目也各过一遍 norm_who 再比。名册可能是人
        # 手写进 git 的,「甲 」入了册、「甲」再来投,拿未归一的串比就又加一行 —— 页面上这两个名字
        # 长得一模一样,而账上从此是两个人。写回时旧条目一个字不动(名册只加不删,手写那份留着给人看),
        # 新加的一律是归一后的名字。
        if name not in [norm_who(n) for n in names]:
            names.append(name)
            roster_write(names)
        return {"names": names}

    def post_mark(self, pin):
        # 认死 application/json:text/plain 那几个是 CORS simple type,浏览器发它们不走预检,
        # 跨站的一行 fetch 就能落一条署他人名的验收结论。要 application/json 就得先过预检,
        # 而这台服务对 OPTIONS 答 501 —— 跨站那条路到此为止(shot 口本来就靠 image/* 走这条理)。
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            raise Rejected("Content-Type 只收 application/json")
        try:
            data = json.loads(self.read_body(MAX_MARK).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise Rejected("请求体不是合法 JSON")
        if not isinstance(data, dict):
            raise Rejected("请求体不是 JSON 对象")
        pr, item, who, rev = self.check_target(data.get("pr"), data.get("item"), data.get("who"), pin)
        verdict = data.get("verdict")
        if verdict is None:
            verdict = ""
        # "none" = 撤回判定(v0.17.1):不是删除,是再追加一条「我不再判它」。它本身就是一条内容,
        # 所以下面那道「verdict / note / shot 至少要有一样」对它放行 —— 靠的就是它是个非空串。
        if verdict not in ("", "ok", "bad", "none"):
            raise Rejected("verdict 只能是 ok / bad / none(或省略)")
        note = data.get("note")
        note = "" if note is None else note
        if not isinstance(note, str):
            raise Rejected("note 不是字符串")
        if len(note) > NOTE_MAX:
            raise Rejected("note 超过 %d 字" % NOTE_MAX)
        if note:
            check_wellformed(note, "note")
        shot = data.get("shot") or ""
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

    def post_shot(self, pin):
        q = parse_qs(urlsplit(self.path).query)
        pick = lambda k: (q.get(k) or [None])[0]
        pr, item, _who, _rev = self.check_target(pick("pr"), pick("item"), pick("who"), pin)
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
            write_fd(fd, raw)
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
        warn = ""
        try:
            on, pin = feedback_cfg()
            fb = (",反馈写口" + ("+口令" if pin else "")) if on else ""
        except BadConfig as e:  # 起得来、板照看,但写口会一路 500 —— 把原因先说在这儿
            fb, warn = "", f"⚠ {e}"
        print(f"看板 → http://0.0.0.0:{port}/  (root={ROOT}, no-cache, gzip, threaded{fb})", flush=True)
        if warn:
            print(warn, flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
