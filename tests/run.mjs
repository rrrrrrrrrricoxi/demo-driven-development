#!/usr/bin/env node
// 守卫/生成器对抗测试床(npm test 入口;零依赖,Node 18+)。1246 条断言:
// 时光机(合成旧 gen 盖板 → 新守卫自愈)、拒降级、版本文法、backnav 剥离/回捞、retire 注册守卫、
// byte-freeze 归一化、<pre> 误伤、全新项目首跑、lanes/报错语言、pr 字段/验收 tab/验收守卫、
// 段判定穷举/发布进度 tab/芯片状态后缀/pr-sync(PATH 里放假 gh,不碰网络)、状态药丸 nowrap、
// 卡正文轻 markdown(lite 规则逐条 + XSS + 折叠预览 + detail 字段 + 正文长度守卫)、
// 进度响应(settle/reopen/stale-link/dormant 穷举 + 芯片 + 待收账段 + 守卫 + pr-sync --settle)、
// done 卡归档(独立 pane + lazy 第三个 part + 深链映射)、积压提醒 wip(三档 + 守卫)、
// 发布进度时间线几何(轴按繁忙度加宽 / 刻度不压字 / 泳道封顶 / 带高有上界)、
// 暂不收账 settleHold(三种卡的灰芯片 + 待收账段/守卫闭嘴 + pr-sync --settle --only 挑着收)、
// tab 条 nowrap(中文/· 断行点回归锚 + 横向滚动)、
// 一卡一文件 cardsDir(拆分等价四拍 / 五种硬报错 / 顺序与文件系统无关 / 守卫 / 每卡更新日期降级链)、
// 写操作 CLI(建卡的号靠 openSync 'wx' 预留 —— 真起两个进程并发验 / 六种校验拒绝 / 时间线 /
// 链接顺手写 pr / export 与拆分前的 manifest 深比较相等 / 只读目录下原文件零改动)、
// 线别分段熬得过懒注入(委托监听 + 每次现查 + onPaneInjected 同步高亮)、
// 左侧竖向 tab 导航 tabRail(四拍冻结 / 清单与 tab 条同一份 / show 与徽章两处同步 / 显隐三道门 /
// 点了落到 tab 条而不是 pane 顶 + 键盘获焦不被收走 + 与 sticky 顶栏的交接空档:rootMargin 压到
// hubbar 下沿、判定量 bottom、scroll 兜底、resize 重建观察器)、
// 总览落地页 overviewTab(四拍冻结 × lazy 开关 / 各行随数据源出没 / 迭代史折叠含原任务表 / 深链先展开折叠)、
// 决策路径入文档库 pathTab:"docs"(四拍冻结 / refs 文档页 + Hub 条目 / 相对链接各退一级 / #path 改落文档库 / out 撞名硬报错)、
// 验收/发布进度也进 parts(壳里零烤入数据 / 数据块随 part 走 / init 幂等 / 跨 part 取分子 /
// #acc-*、#pr-* 深链映射 / LAZY_BYTES 五项对账 / 守卫缺件自愈 / 单独关一个 tab 只清一份)、
// 时间线 hover peek(四拍冻结 / 原生 title 撤干净 / 条与段都可聚焦 / 内容现取不烤第二份 /
// 150ms 防抖与捕获委托 / 触摸两下 / z-index 压得住 tabrail / 不引新色 / part 里一个字不多)、
// tab 条吸顶 stickyTabs(四拍冻结 / position: sticky 落点跟 --ddd-hubh / 底色不透 / 横向滚动没动 /
// z 层与 hubbar·懒加载进度线不打架 / 深链锚点补偿代入实高盖得过两条吸顶栏 / 文档库导航与 scrollspy
// 一并让开 / 与 tabRail 同开时 rail 让位)、
// Backlog 排序分段 backlogSort(四拍冻结 / 分段替掉 Backlog 那只下拉而决策的原样留着 / 四档次序 /
// data-udate·data-ord 两枚派生属性 / 比较器从壳里抠出来穷举:「最近立卡」= 按 data-ord 原样还原
// (烤入顺序本就是建卡日新→旧,不占两颗钮)、更新新→旧、同日退编号、空日期沉底 /
// 记忆键 <brand>_bl_sort 与 0.15.12 旧值 'cdate-desc' 的落回 / 拆卡后更新日与建卡日各说各的 /
// cards-split 的等价门认得 data-udate)、
// 看板只在主线上改(board-branch-check:干净分支与主线一言不发 / 分类与 items 隐患 / --strict 给 CI /
//   守卫那条非阻断 notice 零命中不出声)、
// 归版按打 tag 时刻(annotated 的 tagger.date / lightweight 退 commit / 取不到退 publishedAt 并出声 /
//   打完 tag 到点发布之间合的 PR 不算进这一版 / 已落盘的 at 不回填)、
// settleHold 有寿命(CLI 记起算日与续期 / 清空一并收走 / 13 天不出声满 14 天出一行 / 最多 5 张 /
//   老卡退卡文件最后提交日 / 守卫只读不写 / 拆分等价门认得 data-hold)、
// 时间线左栏(四拍冻结 / 整格 role=button+aria-expanded 而非只有文字那颗钮 / 点击与 Enter·Space
// 共用一个 toggleBand 且重画后交还焦点 / 左栏宽只有一处字面值,轴行与带行读同一个 --relgut
// 并画同样的右边框 / TL.lbl 与 --relgut 同一个数)等。
// 卡片前置依赖 after(0.16.0:四种 ref 的清除判据穷举 / 未知卡号与环的硬报错 / 两枚芯片与 +N 折叠 /
//   WIP 改口「可立即做 N(另 M 等前置)」并与 setLine 重算对齐 / 守卫 7 天窗口 / CLI 追加去重 --rm --json /
//   撤掉 after 回冻结基线 / 拆分等价门认得芯片里的日期)、
// 长正文审计分两档(0.16.2:已提交的老卡照旧一行提醒 / 没进 HEAD 或 date 是今天的新卡阻断 /
//   git add 过也算新 / 终态与 detail 各自放行 / stop_hook_active 降级 / richText 关着不跑 /
//   提交进去当场转成老卡 / 与孤儿 demo 同时命中合成一条 reason)、
// 守卫转发到更新的安装(0.16.2:假 installed_plugins.json + 假 cache / stdin·env·cwd 原样交过去 /
//   转发那行说清去了哪一版 / DDD_HOOK_FORWARDED 刹得住真递归 / 装的比产物旧·version 非数字·
//   projectPath 不是这个项目·读不到安装表 各自退回今天的拒降级 / 产物不比我新时根本不查表)、
// 「旧 gen 盖板」用合成的过期块(ddd-backnav v2 = 当前 marker 的旧版本)就地复现,不依赖外部标本。
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const HERE_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE_DIR, '..')
const NEW_SCRIPTS = join(REPO, 'scripts')
const WORK = mkdtempSync(join(tmpdir(), 'ddd-tests-'))
const MY_VER = JSON.parse(readFileSync(join(REPO, '.claude-plugin/plugin.json'), 'utf8')).version

let pass = 0, fail = 0
const ok = (cond, name, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ FAIL ${name}${detail ? ` —— ${detail}` : ''}`) }
}
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const count = (s, sub) => s.split(sub).length - 1

// ---- 过期默认块(ddd-backnav v2 = 当前 marker 的旧版本;strip regex 认得,应被自愈升到 v3)----
const STALE_BLOCK = `<!-- ddd-backnav v2 -->
<style id="ddd-backnav-style">
 body{padding-top:44px}
 #ddd-backnav{position:fixed;top:0;left:0;right:0;height:44px;z-index:9999;display:flex;align-items:center;gap:10px;padding:0 16px;background:#f6f5f2;border-bottom:1px solid #e3e2e0}
 #ddd-backnav a{text-decoration:none;font-weight:600;color:#2383e2}
 #ddd-backnav .ctx{color:#6f6e6b;font-size:12px}
</style>
<nav id="ddd-backnav"><a href="../index.html#decisions">← 返回看板</a><span class="ctx">HTEST Demo · mock 数据</span></nav>`
// 合成「旧 gen 盖板」:剥掉 index 戳 + 每个 demo 在 <body> 后叠一个过期块(不识别当前块,直接叠加)
const mkOldCache = (verDir) => { // retire 用的最小假旧缓存:两个待 shim 的脚本文件
  mkdirSync(join(verDir, 'scripts'), { recursive: true })
  writeFileSync(join(verDir, 'scripts', 'gen.mjs'), '#!/usr/bin/env node\nconsole.log("stale gen")\n')
  writeFileSync(join(verDir, 'scripts', 'stop-hook.mjs'), '#!/usr/bin/env node\nprocess.exit(0)\n')
}
const demoHtml = (title, extra = '') => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body>
<h1>${title}</h1>${extra}
</body></html>
`

function mkFixture(name, demos) {
  const root = join(WORK, name)
  const kb = join(root, 'app', 'kanban')
  mkdirSync(join(kb, 'demos'), { recursive: true })
  mkdirSync(join(kb, 'shots'), { recursive: true })
  const fill = (s) => s.replaceAll('{{BRAND}}', 'HTEST').replaceAll('{{GH_REPO}}', '').replaceAll('{{BRANCH}}', '').replaceAll('{{APP_BASE}}', '')
  writeFileSync(join(kb, 'kanban.config.json'), fill(readFileSync(join(REPO, 'templates/kanban.config.json'), 'utf8')))
  for (const m of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json'])
    writeFileSync(join(kb, m), fill(readFileSync(join(REPO, 'templates/manifests', m), 'utf8')))
  for (const [f, html] of Object.entries(demos)) writeFileSync(join(kb, 'demos', f), html)
  writeFileSync(join(kb, 'demos', '.no-card-ok'), Object.keys(demos).join('\n') + '\n')
  execFileSync('git', ['init', '-q'], { cwd: root })
  return { root, kb }
}
const runGen = (scriptsDir, kb, extra = []) =>
  spawnSync(process.execPath, [join(scriptsDir, 'gen.mjs'), '--dir', kb, ...extra], { encoding: 'utf8' })
// 空的 CLAUDE_CONFIG_DIR 是默认档:0.16.2 起守卫会读 <config>/plugins/installed_plugins.json 找
// 「本机装的更新版本」并转发过去 —— 不隔离的话,整套「拒降级」断言的成败要看跑测试这台机上装了
// 哪一版 plugin。要测转发的那几条自己把 CLAUDE_CONFIG_DIR 指到假安装表(T72)。
const NO_INSTALLS = join(WORK, 'no-installs')
mkdirSync(NO_INSTALLS, { recursive: true })
const runStop = (scriptsDir, root, { input = '{}', env = {} } = {}) =>
  spawnSync(process.execPath, [join(scriptsDir, 'stop-hook.mjs')],
    { encoding: 'utf8', input, env: { ...process.env, CLAUDE_CONFIG_DIR: NO_INSTALLS, CLAUDE_PROJECT_DIR: root, ...env } })
// ---- serve.py 冒烟用:随机端口起一台,同一个测试负责收尸(进程退出时再兜一刀)----
// 端口写死 0 = 内核分配:测试机上常驻的 8898/5175 那几台一根汗毛都不许碰。
const HAS_PY3 = (() => { const p = spawnSync('python3', ['-c', 'pass'], { encoding: 'utf8' }); return !p.error && p.status === 0 })()
const SERVERS = []
process.on('exit', () => { for (const p of SERVERS) { try { p.kill('SIGKILL') } catch {} } })
const startServe = (dir) => new Promise((res, rej) => {
  // stderr 丢掉:http.server 每个请求都往那儿写一行,没人读就会把管道塞满、服务卡死
  const proc = spawn('python3', [join(dir, 'serve.py'), '0'], { stdio: ['ignore', 'pipe', 'ignore'] })
  SERVERS.push(proc)
  let buf = ''
  const to = setTimeout(() => rej(new Error(`serve.py 10s 没打出 banner:${buf}`)), 10000)
  proc.stdout.on('data', (d) => {
    buf += String(d)
    const m = /:(\d+)\//.exec(buf)
    if (!m) return
    clearTimeout(to)
    res({ proc, port: Number(m[1]), base: `http://127.0.0.1:${m[1]}` })
  })
  proc.on('error', (e) => { clearTimeout(to); rej(e) })
  proc.on('exit', (c) => { clearTimeout(to); rej(new Error(`serve.py 起不来(exit ${c}):${buf}`)) })
})
const req = async (base, path, opt) => {
  const r = await fetch(base + path, opt)
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: r.status, text, json, headers: r.headers }
}
const touch = (p) => { const t = new Date(Date.now() + 5); utimesSync(p, t, t) }
const readDemo = (kb, f) => readFileSync(join(kb, 'demos', f), 'utf8')

// ============ T4 cmpVer 矩阵(先测地基) ============
console.log('T4 cmpVer 矩阵')
{
  const { cmpVer } = await import(join(NEW_SCRIPTS, 'lib-version.mjs'))
  ok(cmpVer('0.9.0', '0.10.0') < 0, '0.9.0 < 0.10.0(非字符串比较)')
  ok(cmpVer('0.10.0', '0.9.0') > 0, '0.10.0 > 0.9.0')
  ok(cmpVer('0.6.0', '0.6.0') === 0, '相等')
  ok(cmpVer('0.6', '0.6.0') === 0, '长度补零 0.6 == 0.6.0')
  // 两位数补丁号(0.15.10 起):字符串比较在这里是反的 —— 全体版本比较必须走这一个 cmpVer
  ok('0.15.10' < '0.15.9', '字符串比较下 0.15.10 反而「小于」0.15.9(这条断言存在的理由)')
  ok(cmpVer('0.15.10', '0.15.9') > 0, '0.15.10 > 0.15.9(两位数补丁号)')
  ok(cmpVer('0.15.9', '0.15.10') < 0, '0.15.9 < 0.15.10')
  ok(cmpVer('0.16.0', '0.15.10') > 0, '0.16.0 > 0.15.10')
  ok(cmpVer('0.15.10', '0.15.10') === 0, '0.15.10 与自己相等')
  ok(Number.isNaN(cmpVer('0.6.0-rc1', '0.6.0')), '预发布后缀 → NaN(按戳损坏处理)')
  ok(!(Number.isNaN(cmpVer('0.6.0-rc1', '0.6.0')) && cmpVer('0.6.0-rc1', '0.6.0') > 0), 'NaN 不触发拒降级分支')
}

// ============ T-A 基本生成 + T9 戳位置 ============
console.log('T-A/T9 基本生成与戳位置')
const fx1 = mkFixture('fx1', {
  'd1.html': demoHtml('d1'),
  'd2.html': demoHtml('d2'),
  'd3.html': demoHtml('d3'),
})
{
  const r = runGen(NEW_SCRIPTS, fx1.kb)
  ok(r.status === 0, '新 gen exit 0', r.stderr)
  const idx = readFileSync(join(fx1.kb, 'index.html'), 'utf8')
  const lines = idx.split('\n')
  ok(lines[0] === '<!doctype html>', '首行仍是 <!doctype html>(不破首字节嗅探)')
  ok(lines[1] === `<!-- ddd-gen v${MY_VER} -->`, `第二行是版本戳 v${MY_VER}`, lines[1])
  ok(count(idx, '<!-- ddd-gen v') === 1, '戳恰一枚')
  for (const f of ['d1.html', 'd2.html', 'd3.html'])
    ok(count(readDemo(fx1.kb, f), '<!-- ddd-backnav v3 -->') === 1 && !readDemo(fx1.kb, f).includes('ddd-backnav v2'), `${f} 恰一个 v3 块`)
  const r2 = runGen(NEW_SCRIPTS, fx1.kb)
  ok(r2.status === 0 && r2.stdout.includes('(3 已是当前版)'), '重跑幂等:3 demo 全 skip', r2.stdout)
}

// ============ T1/T12 时光机:合成旧 gen 盖板 → 新守卫自愈 ============
console.log('T1/T12 时光机:合成旧 gen 盖板 → 新守卫自愈')
{
  // 给 d2 做手工件:自定义回跳锚 + 真数据注记(改注入后的 v3 块)
  let d2 = readDemo(fx1.kb, 'd2.html')
  d2 = d2.replace('href="../index.html#decisions"', 'href="../index.html#UXC47"')
         .replace(/<span class="ctx">[\s\S]*?<\/span>/, '<span class="ctx">真实台账数据 · 台账镜像</span>')
  writeFileSync(join(fx1.kb, 'demos/d2.html'), d2)
  // 合成旧 gen 盖板:剥掉 index 戳(无戳=旧 gen 产物)+ 每个 demo 在 <body> 后叠一个过期块(叠在当前块之上)
  const idxP = join(fx1.kb, 'index.html')
  writeFileSync(idxP, readFileSync(idxP, 'utf8').replace(`\n<!-- ddd-gen v${MY_VER} -->`, ''))
  for (const f of ['d1.html', 'd2.html', 'd3.html']) {
    const p = join(fx1.kb, 'demos', f)
    writeFileSync(p, readFileSync(p, 'utf8').replace(/(<body[^>]*>)/, `$1\n${STALE_BLOCK}`))
  }
  ok(!readFileSync(idxP, 'utf8').includes('<!-- ddd-gen v'), 'bug 复现:旧 gen 盖板,戳消失')
  const d1Clobbered = readDemo(fx1.kb, 'd1.html')
  ok(count(d1Clobbered, '<!-- ddd-backnav v2 -->') === 1 && count(d1Clobbered, '<!-- ddd-backnav v3 -->') === 1, 'bug 复现:d1 双块(过期 v2 叠当前 v3)')
  // 新守卫自愈:index 无戳 → 判过期重生成
  const rNew = runStop(NEW_SCRIPTS, fx1.root)
  ok(rNew.status === 0, '新 stop-hook exit 0', rNew.stderr)
  const idxHealed = readFileSync(idxP, 'utf8')
  ok(idxHealed.includes(`<!-- ddd-gen v${MY_VER} -->`), '自愈:戳回来了(无戳 = 旧 gen 产物 → 重生成)')
  for (const f of ['d1.html', 'd2.html', 'd3.html']) {
    const c = readDemo(fx1.kb, f)
    ok(!c.includes('ddd-backnav v2'), `自愈:${f} 零过期块残留`)
    ok(count(c, '<!-- ddd-backnav v3 -->') === 1, `自愈:${f} 恰一个 v3 块`)
  }
  const d2Healed = readDemo(fx1.kb, 'd2.html')
  ok(d2Healed.includes('#UXC47') && d2Healed.includes('真实台账数据 · 台账镜像'), '自愈:d2 手工件存活(锚+真数据注记,未被过期默认块顶掉)')
}

// ============ T2 回捞顺序双向 ============
console.log('T2 手工件回捞:两种块序都存活')
{
  const blk3 = readDemo(fx1.kb, 'd2.html').match(/<!-- ddd-backnav v3 -->[\s\S]*?<\/nav>/)[0]
  const mk = (order) => demoHtml('dx').replace('<body>', order === 'staleFirst' ? `<body>\n${STALE_BLOCK}\n${blk3}` : `<body>\n${blk3}\n${STALE_BLOCK}`)
  const fx2 = mkFixture('fx2', { 'a.html': mk('staleFirst'), 'b.html': mk('v3first') })
  const r = runGen(NEW_SCRIPTS, fx2.kb)
  ok(r.status === 0, 'gen exit 0', r.stderr)
  for (const f of ['a.html', 'b.html']) {
    const c = readDemo(fx2.kb, f)
    ok(!c.includes('ddd-backnav v2') && count(c, '<!-- ddd-backnav v3 -->') === 1, `${f} 归一为一个 v3 块`)
    ok(c.includes('#UXC47') && c.includes('真实台账数据 · 台账镜像'), `${f} 自定义件存活(顺序=${f === 'a.html' ? '过期块在上' : 'v3 在上'})`)
  }
}

// ============ T3 /g 剥净 + 同版双块 ============
console.log('T3 多块剥净')
{
  const blk3def = readDemo(fx1.kb, 'd1.html').match(/<!-- ddd-backnav v3 -->[\s\S]*?<\/nav>/)[0]
  const fx3 = mkFixture('fx3', {
    'c.html': demoHtml('c').replace('<body>', `<body>\n${STALE_BLOCK}\n${STALE_BLOCK}\n${blk3def}`),
    'd.html': demoHtml('d').replace('<body>', `<body>\n${blk3def}\n${blk3def}`),
  })
  const r = runGen(NEW_SCRIPTS, fx3.kb)
  ok(r.status === 0, 'gen exit 0', r.stderr)
  const c = readDemo(fx3.kb, 'c.html'), d = readDemo(fx3.kb, 'd.html')
  ok(!c.includes('ddd-backnav v2') && count(c, '<!-- ddd-backnav v3 -->') === 1, 'c.html [v2,v2,v3] → 恰一个 v3')
  ok(count(d, '<!-- ddd-backnav v3 -->') === 1, 'd.html 同版双块 [v3,v3] → 归一为一个')
}

// ============ T5 拒降级(戳 > 本版) ============
console.log('T5 拒降级')
{
  const fx5 = mkFixture('fx5', { 'e.html': demoHtml('e') })
  runGen(NEW_SCRIPTS, fx5.kb)
  const idxP = join(fx5.kb, 'index.html')
  writeFileSync(idxP, readFileSync(idxP, 'utf8').replace(`<!-- ddd-gen v${MY_VER} -->`, '<!-- ddd-gen v9.9.9 -->'))
  touch(join(fx5.kb, 'manifest.json')) // 让 mtime 也判过期,验证戳一票否决
  const h0 = sha(idxP)
  for (let i = 1; i <= 3; i++) {
    const r = runStop(NEW_SCRIPTS, fx5.root)
    ok(r.status === 0, `stop-hook 第 ${i} 次 exit 0(绝不阻断循环)`, `${r.status} ${r.stderr}`)
    ok(r.stdout.includes('systemMessage') && r.stdout.includes('9.9.9'), `第 ${i} 次输出 systemMessage 警告`)
  }
  ok(sha(idxP) === h0, 'index.html 字节不变(mtime 过期被戳一票否决)')
  const rg = runGen(NEW_SCRIPTS, fx5.kb)
  ok(rg.status !== 0 && rg.stderr.includes('拒绝用旧版覆盖新产物'), '直接跑 gen 拒跑')
  ok(!rg.stderr.includes('--force-downgrade'), '报错文案不给 agent 递越过旗')
  const rf = runGen(NEW_SCRIPTS, fx5.kb, ['--force-downgrade=9.9.9'])
  ok(rf.status === 0 && readFileSync(idxP, 'utf8').includes(`<!-- ddd-gen v${MY_VER} -->`), 'human-only 越过旗生效并回烙当前戳')
}

// ============ T6 gen 脱离 plugin 目录 → 硬失败(无戳永动刹车) ============
console.log('T6 无戳永动刹车')
{
  const det = join(WORK, 'detached')
  mkdirSync(det, { recursive: true })
  cpSync(NEW_SCRIPTS, join(det, 'scripts'), { recursive: true }) // 不带 ../.claude-plugin
  const r = runGen(join(det, 'scripts'), fx1.kb)
  ok(r.status !== 0 && r.stderr.includes('plugin.json'), '读不到 plugin.json → 硬失败(保证跑过必留戳)')
}

// ============ T7 全新项目 ============
console.log('T7 全新项目首跑')
{
  const fx7 = mkFixture('fx7', { 'f.html': demoHtml('f') })
  const r1 = runStop(NEW_SCRIPTS, fx7.root)
  const idxP = join(fx7.kb, 'index.html')
  ok(r1.status === 0 && existsSync(idxP), '首次 stop-hook 生成 index(无「文件不存在」误报)', r1.stderr)
  ok(!r1.stdout.includes('systemMessage'), '首跑无警告噪音')
  const h = sha(idxP), t = statSync(idxP).mtimeMs
  const r2 = runStop(NEW_SCRIPTS, fx7.root)
  ok(r2.status === 0 && sha(idxP) === h && statSync(idxP).mtimeMs === t, '第二次 no-op(无永动)')
}

// ============ T8 byte-freeze:升版后戳行是唯一 diff ============
console.log('T8 byte-freeze 归一化')
{
  const pcopy = join(WORK, 'plugin-copy')
  mkdirSync(pcopy, { recursive: true })
  cpSync(NEW_SCRIPTS, join(pcopy, 'scripts'), { recursive: true })
  cpSync(join(REPO, '.claude-plugin'), join(pcopy, '.claude-plugin'), { recursive: true })
  const fx8 = mkFixture('fx8', { 'g.html': demoHtml('g') })
  runGen(join(pcopy, 'scripts'), fx8.kb)
  const A = readFileSync(join(fx8.kb, 'index.html'), 'utf8')
  const pj = join(pcopy, '.claude-plugin/plugin.json')
  writeFileSync(pj, readFileSync(pj, 'utf8').replace(`"version": "${MY_VER}"`, '"version": "99.0.0"'))
  const r = runGen(join(pcopy, 'scripts'), fx8.kb)
  ok(r.status === 0, '升版重生成 exit 0', r.stderr)
  const B = readFileSync(join(fx8.kb, 'index.html'), 'utf8')
  const la = A.split('\n'), lb = B.split('\n')
  const diffLines = la.filter((l, i) => l !== lb[i])
  ok(la.length === lb.length && diffLines.length === 1 && diffLines[0].includes('ddd-gen'), `升版后行数相等且 diff 恰一行戳行(实际 ${diffLines.length} 行)`)
  const norm = (s) => s.split('\n').filter((l) => !l.includes('<!-- ddd-gen v')).join('\n')
  ok(norm(A) === norm(B), '归一化戳行后逐字节相等')
}

// ============ T10 marker 误伤(<pre> 原文示例) ============
console.log('T10 <pre> 原文示例不被误剥')
{
  const sample = `\n<pre>原文示例:<!-- ddd-backnav v2 --> 这里是讲 backnav 机制的样例文本</pre>\n<nav class="site">站内导航(demo 自己的 nav)</nav>`
  const fx10 = mkFixture('fx10', { 'h.html': demoHtml('h', sample) })
  const r = runGen(NEW_SCRIPTS, fx10.kb)
  ok(r.status === 0, 'gen exit 0', r.stderr)
  const c = readDemo(fx10.kb, 'h.html')
  ok(c.includes('这里是讲 backnav 机制的样例文本') && c.includes('站内导航(demo 自己的 nav)'), '<pre> 样例与站内 nav 都完好(结构锚生效)')
  ok(count(c, '<!-- ddd-backnav v3 -->') === 1, '真 v3 块正常注入一份')
  const before = sha(join(fx10.kb, 'demos/h.html'))
  const r2 = runGen(NEW_SCRIPTS, fx10.kb)
  ok(r2.status === 0 && sha(join(fx10.kb, 'demos/h.html')) === before && r2.stdout.includes('(1 已是当前版)'), '再跑字节幂等(样例不搅 skip 判定)', r2.stdout)
}

// ============ T13 版本文法闭环(rc 后缀不得造成永动) ============
console.log('T13 版本文法闭环')
{
  const prc = join(WORK, 'plugin-rc')
  mkdirSync(prc, { recursive: true })
  cpSync(NEW_SCRIPTS, join(prc, 'scripts'), { recursive: true })
  cpSync(join(REPO, '.claude-plugin'), join(prc, '.claude-plugin'), { recursive: true })
  const pj = join(prc, '.claude-plugin/plugin.json')
  writeFileSync(pj, readFileSync(pj, 'utf8').replace(`"version": "${MY_VER}"`, '"version": "0.7.0-rc1"'))
  const fx13 = mkFixture('fx13', { 'k.html': demoHtml('k') })
  const rg = spawnSync(process.execPath, [join(prc, 'scripts/gen.mjs'), '--dir', fx13.kb], { encoding: 'utf8' })
  ok(rg.status !== 0 && rg.stderr.includes('纯数字点分'), 'rc 版本 → gen 硬失败(不烙不可读回的戳)')
  // stop-hook(rc 版本 = myVer null):不 spawn 注定失败的 gen,不 exit 2
  const rs1 = spawnSync(process.execPath, [join(prc, 'scripts/stop-hook.mjs')], { encoding: 'utf8', input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: fx13.root } })
  ok(rs1.status === 0 && rs1.stdout.includes('安装异常'), 'rc 版本 stop-hook:exit 0 + 安装异常提示(无 exit-2 死循环)', `${rs1.status} ${rs1.stderr.slice(0, 120)}`)
  ok(!existsSync(join(fx13.kb, 'index.html')), 'rc 版本 stop-hook 未产出半截产物')
}

// ============ T14 带属性 nav 的手工块不再造成双栏 ============
console.log('T14 nav 带附加属性')
{
  const blk3 = readDemo(fx1.kb, 'd1.html').match(/<!-- ddd-backnav v3 -->[\s\S]*?<\/nav>/)[0]
    .replace('<nav id="ddd-backnav">', '<nav class="wide" id="ddd-backnav">')
  const fx14 = mkFixture('fx14', { 'm.html': demoHtml('m').replace('<body>', `<body>\n${blk3}`) })
  const r = runGen(NEW_SCRIPTS, fx14.kb)
  const c = readDemo(fx14.kb, 'm.html')
  ok(r.status === 0 && count(c, '<!-- ddd-backnav v3 -->') === 1 && count(c, '<nav') === 1, '带属性 nav 被认作结构块,单栏(无双栏回归)', `navs=${count(c, '<nav')}`)
  const before = sha(join(fx14.kb, 'demos/m.html'))
  runGen(NEW_SCRIPTS, fx14.kb)
  ok(sha(join(fx14.kb, 'demos/m.html')) === before, '再跑字节幂等')
}

// ============ T15 veto(戳>本版)不再关孤儿审计 ============
console.log('T15 veto 态孤儿审计照跑')
{
  const fx15 = mkFixture('fx15', { 'n.html': demoHtml('n') })
  runGen(NEW_SCRIPTS, fx15.kb)
  // 造一个孤儿(不进 .no-card-ok、不在 manifest)+ 植入更高戳
  writeFileSync(join(fx15.kb, 'demos/orphan.html'), demoHtml('orphan'))
  const idxP = join(fx15.kb, 'index.html')
  writeFileSync(idxP, readFileSync(idxP, 'utf8').replace(`<!-- ddd-gen v${MY_VER} -->`, '<!-- ddd-gen v9.9.9 -->'))
  const h0 = sha(idxP)
  const r = runStop(NEW_SCRIPTS, fx15.root)
  ok(r.status === 0, 'exit 0(审计经 JSON decision 阻断,不走 exit 2)')
  ok(r.stdout.includes('"decision":"block"') && r.stdout.includes('orphan.html'), '孤儿审计照跑并阻断(不再被 veto 短路)')
  ok(r.stdout.includes('9.9.9') && r.stdout.trim().split('\n').length === 1, 'stampNewer 并入同一条 JSON(单行输出)')
  ok(sha(idxP) === h0, '重生成仍被 veto(index 字节不变)')
}

// ============ T16 同版双块:手工件优先于默认块 ============
console.log('T16 同版双块手工件优先')
{
  const blk3def = readDemo(fx1.kb, 'd1.html').match(/<!-- ddd-backnav v3 -->[\s\S]*?<\/nav>/)[0]
  const blk3cus = readDemo(fx1.kb, 'd2.html').match(/<!-- ddd-backnav v3 -->[\s\S]*?<\/nav>/)[0]
  const fx16 = mkFixture('fx16', { 'q.html': demoHtml('q').replace('<body>', `<body>\n${blk3def}\n${blk3cus}`) })
  const r = runGen(NEW_SCRIPTS, fx16.kb)
  const c = readDemo(fx16.kb, 'q.html')
  ok(r.status === 0 && count(c, '<!-- ddd-backnav v3 -->') === 1, '同版双块归一')
  ok(c.includes('#UXC47') && c.includes('真实台账数据 · 台账镜像'), '默认块在上时手工件仍存活(优先级前置)')
}

// ============ T17 retire 注册守卫 + .in_use 展示 ============
console.log('T17 retire 注册守卫')
{
  const plugroot = join(WORK, 'plugroot')
  const cache2 = join(plugroot, 'cache')
  const pdir2 = join(cache2, 'mp1', 'demo-driven-development')
  mkOldCache(join(pdir2, '0.2.1'))
  mkOldCache(join(pdir2, '0.3.0'))
  writeFileSync(join(plugroot, 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: { 'demo-driven-development@demo-driven-development': [{ scope: 'project', projectPath: '/tmp/other-proj', installPath: join(pdir2, '0.3.0'), version: '0.3.0' }] },
  }))
  mkdirSync(join(pdir2, '0.2.1', '.in_use'), { recursive: true })
  writeFileSync(join(pdir2, '0.2.1', '.in_use', '99999999'), '{"pid":99999999}')
  const retire = join(NEW_SCRIPTS, 'retire-stale-caches.mjs')
  const dry = spawnSync(process.execPath, [retire, '--cache-root', cache2], { encoding: 'utf8' })
  ok(dry.status === 0 && dry.stdout.includes('跳过 v0.3.0') && dry.stdout.includes('/tmp/other-proj'), '注册在用的 0.3.0 被跳过并点名项目', dry.stdout.slice(0, 300))
  ok(count(dry.stdout, '将 shim') === 2 && dry.stdout.includes('0.2.1'), '未注册的 0.2.1 正常列入')
  ok(dry.stdout.includes('99999999') && dry.stdout.includes('已死'), 'dry-run 展示 .in_use PID 与存活态')
  const yes = spawnSync(process.execPath, [retire, '--cache-root', cache2, '--include-registered', '--yes'], { encoding: 'utf8' })
  ok(yes.status === 0 && count(yes.stdout, '✂') === 4, '--include-registered 连注册版本一起退役(4 文件)', yes.stdout)
  const shimmed = readFileSync(join(pdir2, '0.3.0/scripts/stop-hook.mjs'), 'utf8')
  ok(shimmed.includes('ddd-retired-shim') && !existsSync(join(pdir2, '0.3.0/scripts/stop-hook.mjs.tmp')), '原子写落定,无 tmp 残留')
  const rs = spawnSync(process.execPath, [join(pdir2, '0.3.0/scripts/stop-hook.mjs')], { encoding: 'utf8', input: '{}' })
  ok(rs.status === 0 && rs.stdout.includes('systemMessage'), 'shim 是合法 JS 且行为正确')
}

// ============ T11 扑灭存量(假 cache 根,永不碰真家目录) ============
console.log('T11 扑灭存量')
{
  const fakeCache = join(WORK, 'cache')
  const pdir = join(fakeCache, 'mp1', 'demo-driven-development')
  mkOldCache(join(pdir, '0.2.1'))
  mkdirSync(join(pdir, MY_VER, 'scripts'), { recursive: true })
  writeFileSync(join(pdir, MY_VER, 'scripts/gen.mjs'), '// current, must stay\n')
  writeFileSync(join(pdir, MY_VER, 'scripts/stop-hook.mjs'), '// current, must stay\n')
  mkdirSync(join(pdir, '9.9.9', 'scripts'), { recursive: true })
  writeFileSync(join(pdir, '9.9.9', 'scripts/gen.mjs'), '// newer, must stay\n')
  const retire = join(NEW_SCRIPTS, 'retire-stale-caches.mjs')
  const dry = spawnSync(process.execPath, [retire, '--cache-root', fakeCache], { encoding: 'utf8' })
  ok(dry.status === 0 && count(dry.stdout, '将 shim') === 2 && dry.stdout.includes('0.2.1') && !dry.stdout.includes('9.9.9'), 'dry-run 恰列 0.2.1 两个文件,不碰同版/更新', dry.stdout)
  ok(!readFileSync(join(pdir, '0.2.1/scripts/gen.mjs'), 'utf8').includes('ddd-retired-shim'), 'dry-run 不动盘')
  const yes = spawnSync(process.execPath, [retire, '--cache-root', fakeCache, '--yes'], { encoding: 'utf8' })
  ok(yes.status === 0 && count(yes.stdout, '✂') === 2, '--yes 落盘 2 个 shim', yes.stdout)
  const again = spawnSync(process.execPath, [retire, '--cache-root', fakeCache, '--yes'], { encoding: 'utf8' })
  ok(again.stdout.includes('没有需要退役'), '幂等:重跑零动作')
  ok(readFileSync(join(pdir, MY_VER, 'scripts/gen.mjs'), 'utf8') === '// current, must stay\n', '同版目录未被碰')
  ok(readFileSync(join(pdir, '9.9.9/scripts/gen.mjs'), 'utf8') === '// newer, must stay\n', '更新目录未被碰')
  // shim 行为:stop-hook exit 0 + systemMessage;gen exit 1;且真的不再改产物
  touch(join(fx1.kb, 'manifest.json'))
  const hIdx = sha(join(fx1.kb, 'index.html'))
  const rs = runStop(join(pdir, '0.2.1/scripts'), fx1.root)
  ok(rs.status === 0 && rs.stdout.includes('systemMessage') && rs.stdout.includes('已退役'), 'shim 后旧 stop-hook:exit 0 + 重启提示')
  ok(sha(join(fx1.kb, 'index.html')) === hIdx, 'shim 后旧 stop-hook 不再盖板(乒乓终止)')
  const rg = spawnSync(process.execPath, [join(pdir, '0.2.1/scripts/gen.mjs'), '--dir', fx1.kb], { encoding: 'utf8' })
  ok(rg.status === 1 && rg.stderr.includes('已退役'), 'shim 后旧 gen:exit 1')
  // 收尾:上面 touch 过 manifest,跑一次新守卫恢复新鲜
  runStop(NEW_SCRIPTS, fx1.root)
}

// ============ T18 gen 报错语言随 config.lang ============
console.log('T18 gen 报错语言随 config.lang')
{
  const fx18 = mkFixture('fx18', { 'p.html': demoHtml('p') })
  const cfgP = join(fx18.kb, 'kanban.config.json')
  const cfg0 = JSON.parse(readFileSync(cfgP, 'utf8'))
  writeFileSync(cfgP, JSON.stringify({ ...cfg0, lanes: 'bogus' }))
  const rZh = runGen(NEW_SCRIPTS, fx18.kb)
  ok(rZh.status !== 0 && rZh.stderr.includes('非法'), 'zh 项目(缺省):中文报错', rZh.stderr.slice(0, 120))
  writeFileSync(cfgP, JSON.stringify({ ...cfg0, lang: 'en', lanes: 'bogus' }))
  const rEn = runGen(NEW_SCRIPTS, fx18.kb)
  ok(rEn.status !== 0 && rEn.stderr.includes('lanes is invalid') && !rEn.stderr.includes('非法'), 'en 项目:英文报错(不混中文)', rEn.stderr.slice(0, 120))
}

// ============ T19 工具条两行治理(D54-B)只在 sessionTags 配置时生效 ============
console.log('T19 工具条两行治理(D54-B)')
{
  const fx19 = mkFixture('fx19', { 'r.html': demoHtml('r') })
  runGen(NEW_SCRIPTS, fx19.kb)
  const plain = readFileSync(join(fx19.kb, 'index.html'), 'utf8')
  ok(!plain.includes('tbrow-act'), '未配 sessionTags:无动作行(冻结面无新结构)')
  const cfgP = join(fx19.kb, 'kanban.config.json')
  const c = JSON.parse(readFileSync(cfgP, 'utf8'))
  c.sessionTags = { dev: { label: 'dev' }, release: { label: 'release' } }
  writeFileSync(cfgP, JSON.stringify(c))
  const r = runGen(NEW_SCRIPTS, fx19.kb)
  ok(r.status === 0, '配 sessionTags 后 gen exit 0', r.stderr)
  const sess = readFileSync(join(fx19.kb, 'index.html'), 'utf8')
  ok(count(sess, 'tbrow-act') >= 3, '决策+Backlog 双 pane 都有动作行(HTML×2 + CSS×2)', `count=${count(sess, 'tbrow-act')}`)
  ok(sess.includes('sesschips'), 'session chips 在场(拆行前提成立)')
  ok(count(sess, 'id="decsort"') === 1 && count(sess, 'id="decsearch"') === 1, '排序/搜索控件 id 唯一(JS 接线不受拆行影响)')
}

// ============ T20 lanes 通用化(config 驱动 + 未配时无 UI + 零 lamos)============
console.log('T20 lanes config 驱动')
{
  const fx20 = mkFixture('fx20', { 's.html': demoHtml('s') })
  const cfgP = join(fx20.kb, 'kanban.config.json')
  const decP = join(fx20.kb, 'decisions-manifest.json')
  runGen(NEW_SCRIPTS, fx20.kb)
  const off = readFileSync(join(fx20.kb, 'index.html'), 'utf8')
  ok(!off.includes('declineseg'), '未配 lanes:无线别筛选段')
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.lanes = { ids: ['A', 'B'], default: 'A', titles: { A: '甲档', B: '乙档' } }
  writeFileSync(cfgP, JSON.stringify(cfg))
  const dec = JSON.parse(readFileSync(decP, 'utf8'))
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: 't', line: 'A' }]
  writeFileSync(decP, JSON.stringify(dec))
  const r = runGen(NEW_SCRIPTS, fx20.kb)
  ok(r.status === 0, '配 lanes 对象 gen exit 0', r.stderr)
  const on = readFileSync(join(fx20.kb, 'index.html'), 'utf8')
  ok(on.includes('declineseg') && on.includes('甲档'), 'lanes 对象:线别分段渲染 + config titles 生效')
  ok(on.includes('id="D1" data-line="A"'), '卡片按显式 line 归属(D1 → A)')
  ok(!on.includes('lamos'), 'lanes 开启也零 lamos')
  // 弃用别名仍可用(带警告),不硬崩
  cfg.lanes = 'lamos-legacy'
  writeFileSync(cfgP, JSON.stringify(cfg))
  const ra = runGen(NEW_SCRIPTS, fx20.kb)
  ok(ra.status === 0 && ra.stderr.includes('已弃用'), '弃用字符串别名:接受 + 警告(不崩)', ra.stderr.slice(0, 80))
}

// ============ T21 darkMode(opt-in light-dark() + 切换钮;未配/显式 false = 字节冻结)============
console.log('T21 darkMode opt-in')
{
  const fx21 = mkFixture('fx21', { 's.html': demoHtml('s') })
  const cfgP = join(fx21.kb, 'kanban.config.json')
  const idxP = join(fx21.kb, 'index.html')
  runGen(NEW_SCRIPTS, fx21.kb)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('light-dark(') && !off.includes('themetoggle'), '未配 darkMode:零 light-dark / 零切换钮')
  const offSha = sha(idxP)
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.darkMode = false
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx21.kb)
  ok(sha(idxP) === offSha, 'darkMode:false 与未配逐字节相同(冻结)')
  cfg.darkMode = true
  writeFileSync(cfgP, JSON.stringify(cfg))
  const decP = join(fx21.kb, 'decisions-manifest.json')
  const dec = JSON.parse(readFileSync(decP, 'utf8'))
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: 't' }] // 模板零卡,注一张走 escC 内联路径
  writeFileSync(decP, JSON.stringify(dec))
  const r = runGen(NEW_SCRIPTS, fx21.kb)
  ok(r.status === 0, 'darkMode:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('--c:light-dark(') && count(on, 'light-dark(') > 50, '样式与逐卡内联 --c 均包 light-dark()')
  ok(on.includes('color-scheme: light dark') && on.includes(':root[data-theme="dark"]'), 'color-scheme 基态 + data-theme 手动覆盖规则齐')
  ok(on.includes('id="themetoggle"') && on.includes(';(function'), '切换钮渲染 + IIFE 带防御分号(ASI 回归锚)')
  ok(on.includes('light-dark(#f6f5f2,#242220)'), 'pastel 锚点命中(bg → #242220)')
  const shots = readFileSync(join(fx21.kb, 'shots.html'), 'utf8')
  ok(shots.includes('themetoggle') && shots.includes('light-dark('), 'shots.html 同步暗夜(钮 + light-dark)')
  { // v0.11.1 防主题闪错:手选恢复脚本必须前置于首个 <style>(否则大文件弱链路下闪错主题几秒)
    const BOOT = "_theme')"
    ok(on.indexOf(BOOT) > -1 && on.indexOf(BOOT) < on.indexOf('<style>'), 'index 主题引导脚本前置于样式')
    ok(shots.indexOf(BOOT) > -1 && shots.indexOf(BOOT) < shots.indexOf('<style>'), 'shots 主题引导脚本前置于样式')
  }
}

// ============ T26 卡片现场截图 + bug 复现流程(可选字段;缺省逐字节冻结)============
console.log('T26 shots / repro 字段')
{
  const fx26 = mkFixture('fx26', { 's.html': demoHtml('s') })
  const decP = join(fx26.kb, 'decisions-manifest.json'), blP = join(fx26.kb, 'backlog-manifest.json')
  const dec = JSON.parse(readFileSync(decP, 'utf8'))
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: 't' }]
  writeFileSync(decP, JSON.stringify(dec))
  const bl = JSON.parse(readFileSync(blP, 'utf8'))
  bl.tiers = { 1: '核心' }
  bl.items = [{ id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: 'bug 卡', problem: 'p', approach: 'a', area: 'x', source: 's' }]
  writeFileSync(blP, JSON.stringify(bl))
  runGen(NEW_SCRIPTS, fx26.kb)
  const idxP = join(fx26.kb, 'index.html')
  const baseSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('<dt>复现</dt>') && !off.includes('<dt>现场</dt>'), '未配 shots/repro:两块都不渲染')
  // 开:决策卡挂字符串式截图,backlog 卡挂对象式截图 + 步骤数组复现
  dec.entries[0].shots = ['d1-before.png']
  writeFileSync(decP, JSON.stringify(dec))
  bl.items[0].shots = [{ file: 'bl-1-jump.png', caption: '点 chip 后整页横移' }]
  bl.items[0].repro = ['打开看板', '点任一 chip', '整页横向弹动(不应弹)']
  writeFileSync(blP, JSON.stringify(bl))
  const r = runGen(NEW_SCRIPTS, fx26.kb)
  ok(r.status === 0, '配了 shots/repro gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('href="shots/d1-before.png"') && on.includes('href="shots/bl-1-jump.png"'), '纯文件名自动落 shots/ 下,两种卡都渲染')
  ok(on.includes('点 chip 后整页横移'), '对象式 caption 渲染进 alt/说明')
  ok(on.includes('class="wtshots"'), '复用既有缩略图样式(零新增 CSS)')
  ok(on.includes('<dt>复现</dt>') && on.includes('1. 打开看板<br>2. 点任一 chip<br>3. 整页横向弹动(不应弹)'), '复现步骤数组渲染成编号行')
  // 带路径的截图原样用;字符串式 repro 单行渲染
  bl.items[0].shots = ['demos/inline.png']
  bl.items[0].repro = '打开 X 点 Y 就复现'
  writeFileSync(blP, JSON.stringify(bl))
  runGen(NEW_SCRIPTS, fx26.kb)
  const on2 = readFileSync(idxP, 'utf8')
  ok(on2.includes('href="demos/inline.png"') && !on2.includes('shots/demos/'), '带路径的截图原样用,不再加 shots/ 前缀')
  ok(on2.includes('<dd class="x">打开 X 点 Y 就复现</dd>'), '字符串式 repro 单行渲染')
  // 撤回字段 → 回到冻结基线
  delete dec.entries[0].shots; writeFileSync(decP, JSON.stringify(dec))
  delete bl.items[0].shots; delete bl.items[0].repro; writeFileSync(blP, JSON.stringify(bl))
  runGen(NEW_SCRIPTS, fx26.kb)
  ok(sha(idxP) === baseSha, '撤回字段后与冻结基线逐字节相同')
}

// ============ T25 文稿必挂文档库(纪律入 SKILL,字面可查)============
console.log('T25 文稿必挂文档库纪律')
{
  const wf = readFileSync(join(REPO, 'skills/ddd-workflow/SKILL.md'), 'utf8')
  const init = readFileSync(join(REPO, 'skills/kanban-init/SKILL.md'), 'utf8')
  ok(wf.includes('文稿必挂文档库') && wf.includes('config.docs[]'), 'ddd-workflow 第 1 步载明「文稿必挂文档库」')
  ok(/同一次提交/.test(wf), '写明「同一次提交」的时机口径(别攒着批量补)')
  ok(wf.includes('过期或与现状冲突的先修再挂'), '写明「先修再挂」的质量闸(挂错比不挂更伤信任)')
  ok(init.includes('存续纪律') && init.includes('config.docs[]'), 'kanban-init 也载明存续纪律(init 后新文稿照挂)')
}

// ============ T24 滚动条槽位常驻(筛选致横向弹动的回归锚)============
console.log('T24 scrollbar-gutter')
{
  const fx24 = mkFixture('fx24', { 's.html': demoHtml('s') })
  runGen(NEW_SCRIPTS, fx24.kb)
  const idx = readFileSync(join(fx24.kb, 'index.html'), 'utf8')
  const shots = readFileSync(join(fx24.kb, 'shots.html'), 'utf8')
  ok(/html\s*{[^}]*scrollbar-gutter:\s*stable/.test(idx), '主看板 html 预留滚动条槽位')
  ok(/html\s*{[^}]*scrollbar-gutter:\s*stable/.test(shots), '截图廊(REF_CSS 同源,含文档页)同款')
  ok(idx.includes('.wrap { max-width: 1060px; margin: 0 auto'), '居中容器仍在(槽位是为它而留,一起钉住)')
}

// ============ T34 状态药丸不逐字竖排(长标题行卡的回归锚)============
// .rhead 是 flex 行,除 .badge 外的兄弟全 flex:none;.badge 一旦可收缩,就与 .rtitle 按比例分摊挤压,
// 而中文逐字都是断行点 → min-content 只有一个字宽 → 药丸竖成一条,把 min-height:38px 的行撑到 88px。
console.log('T34 状态药丸 nowrap')
{
  const fx34 = mkFixture('fx34', { 's.html': demoHtml('s') })
  runGen(NEW_SCRIPTS, fx34.kb)
  const idx = readFileSync(join(fx34.kb, 'index.html'), 'utf8')
  const badgeRule = (idx.match(/\.badge\s*\{[^}]*\}/) || [''])[0]
  ok(/white-space:\s*nowrap/.test(badgeRule), '.badge 钉了 white-space: nowrap(逐字可断 → min-content 一字宽)', badgeRule.slice(0, 80))
  ok(/flex:\s*none/.test(badgeRule), '.badge 钉了 flex: none(行卡里只有 .rtitle 该被压)', badgeRule.slice(0, 80))
  ok(/\.rtitle\s*\{[^}]*min-width:\s*0/.test(idx), '.rtitle 仍是那个唯一该收缩的(min-width: 0 + 省略号)')
}

// ============ T22 合订引用豁免(v0.10.0:被挂卡 demo iframe 内嵌的子页不算孤儿)============
console.log('T22 合订引用豁免')
{
  const fx22 = mkFixture('fx22', { 's.html': demoHtml('s') })
  // 合订页 bind(挂卡)→ 子页 child-a(data-src 双引号,自身再合订 grandchild)/ child-b(src 单引号带 ./)
  writeFileSync(join(fx22.kb, 'demos/bind.html'), demoHtml('bind', `<iframe data-src="child-a.html"></iframe><iframe src='./child-b.html'></iframe>`))
  writeFileSync(join(fx22.kb, 'demos/child-a.html'), demoHtml('a', `<iframe data-src="grandchild.html"></iframe>`))
  writeFileSync(join(fx22.kb, 'demos/child-b.html'), demoHtml('b'))
  writeFileSync(join(fx22.kb, 'demos/grandchild.html'), demoHtml('g'))
  writeFileSync(join(fx22.kb, 'demos/stray.html'), demoHtml('stray'))
  const decP = join(fx22.kb, 'decisions-manifest.json')
  const dec = JSON.parse(readFileSync(decP, 'utf8'))
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: 't', demo: 'demos/bind.html' }]
  writeFileSync(decP, JSON.stringify(dec))
  const r = runStop(NEW_SCRIPTS, fx22.root)
  ok(r.stdout.includes('"decision":"block"') && r.stdout.includes('stray.html'), '真孤儿(无卡无引用)仍阻断')
  ok(!r.stdout.includes('child-a.html') && !r.stdout.includes('child-b.html') && !r.stdout.includes('grandchild.html'), '合订子页豁免(data-src/src·单双引号·嵌套逐层传递)')
  // 引用断裂:合订页不再嵌 child-b → 它回归孤儿
  writeFileSync(join(fx22.kb, 'demos/bind.html'), demoHtml('bind', `<iframe data-src="child-a.html"></iframe>`))
  const r2 = runStop(NEW_SCRIPTS, fx22.root)
  ok(r2.stdout.includes('child-b.html') && !r2.stdout.includes('child-a.html'), '引用断裂即回归孤儿,未断的照旧豁免')
}

// ============ T23 lazyTabs 懒加载拆页(opt-in;未配/false = 字节冻结,开 = 正文外提 + 壳骨架)============
console.log('T23 lazyTabs 拆页')
{
  const fx23 = mkFixture('fx23', { 's.html': demoHtml('s') })
  const cfgP = join(fx23.kb, 'kanban.config.json')
  const idxP = join(fx23.kb, 'index.html')
  // 造一张决策卡 + 一张 backlog 卡,拆页时应双双外提
  const decP = join(fx23.kb, 'decisions-manifest.json')
  const dec = JSON.parse(readFileSync(decP, 'utf8'))
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策甲' }]
  writeFileSync(decP, JSON.stringify(dec))
  const blP = join(fx23.kb, 'backlog-manifest.json')
  const bl = JSON.parse(readFileSync(blP, 'utf8'))
  bl.tiers = { 1: '核心' } // 模板词表为空,补一档供卡引用
  bl.items = [{ id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: '待办乙' }]
  writeFileSync(blP, JSON.stringify(bl))
  runGen(NEW_SCRIPTS, fx23.kb)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('lazyskel') && !off.includes('lazybar') && !existsSync(join(fx23.kb, 'parts')), '未配 lazyTabs:无骨架/进度条/parts 目录')
  const offSha = sha(idxP)
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.lazyTabs = false
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx23.kb)
  ok(sha(idxP) === offSha, 'lazyTabs:false 与未配逐字节相同(冻结)')
  cfg.lazyTabs = true
  writeFileSync(cfgP, JSON.stringify(cfg))
  const r = runGen(NEW_SCRIPTS, fx23.kb)
  ok(r.status === 0, 'lazyTabs:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  const partD = readFileSync(join(fx23.kb, 'parts/decisions.html'), 'utf8')
  const partB = readFileSync(join(fx23.kb, 'parts/backlog.html'), 'utf8')
  ok(partD.includes('id="D1"') && partB.includes('id="BL-1"'), 'parts/ 两 chunk 落盘且含卡正文')
  ok(!on.includes('id="D1"') && !on.includes('id="BL-1"'), '壳 index 不再含两大 pane 卡正文')
  ok(on.includes('lazyskel') && on.includes('id="lazybar"') && on.includes('LAZY_PANE_OF'), '骨架 + 进度条 + 卡号→pane 映射入壳')
  ok(on.includes('"D1":"decisions"') && on.includes('"BL-1":"backlog"'), '深链映射含两卡')
  ok(on.includes('决策/Demo · 1') && on.includes('Backlog · 1'), 'tab 徽章计数仍烤入壳')
  { // 整壳 <script> 编译级断言:任何把整板 JS 打死的语法级回归在此现形(子串断言挡不住)
    const sc = on.match(/<script>([\s\S]*?)<\/script>/)
    let compiled = true
    try { new Function(sc[1]) } catch (e) { compiled = false }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  { // 真进度分母 = parts 实际未压缩字节,烤入值与落盘文件对账
    const bd = on.match(/decisions: (\d+), backlog: (\d+)/)
    const { Buffer } = await import('node:buffer')
    ok(bd && Number(bd[1]) === Buffer.byteLength(partD, 'utf8') && Number(bd[2]) === Buffer.byteLength(partB, 'utf8'), 'LAZY_BYTES 分母与 parts 字节一致')
  }
  ok(on.includes('if (lazyDone[lzp]) routeHash()'), '深链重试护栏在壳内(成功翻转才重入,防无限风暴)')
  // 关回:parts 陈迹清理
  cfg.lazyTabs = false
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx23.kb)
  ok(!existsSync(join(fx23.kb, 'parts')), '关回后 parts/ 目录清除,index 复原单文件')
  ok(sha(idxP) === offSha, '关回后 index 与冻结基线逐字节相同')
}

// ============ T27 pr 字段(卡上显式 pr → 芯片;links 兼容只做反查不长芯片;缺省逐字节冻结)============
console.log('T27 pr 字段')
{
  const fx27 = mkFixture('fx27', { 's.html': demoHtml('s') })
  const idxP = join(fx27.kb, 'index.html')
  const mP = join(fx27.kb, 'manifest.json'), decP = join(fx27.kb, 'decisions-manifest.json'), blP = join(fx27.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) x.instance.ghRepo = 'o/r' // 三份一致,免 gen 提醒
  mm.iterations = [{ id: 'I1', title: '迭代甲', detail: '' }]
  mm.tasks = [{ id: 'T1', iteration: 'I1', status: 'active', title: '任务甲', approach: 'a' }]
  dec.entries = [
    { id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策甲' },
    { id: 'D2', code: 'D2', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策乙', links: [{ title: '实现 PR', href: 'https://github.com/o/r/pull/91' }] },
    { id: 'D3', code: 'D3', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策丙', links: [{ title: '旧仓 PR', href: 'https://github.com/old/repo/pull/91' }] },
  ]
  bl.tiers = { 1: '核心' }
  bl.items = [{ id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: '待办甲', problem: 'p', approach: 'a', area: 'x', source: 's' }]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  runGen(NEW_SCRIPTS, fx27.kb)
  const baseSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('prchip'), '未写 pr 字段:零芯片(links 里的 /pull/N 不自作主张长芯片)')
  // 开:决策卡单号、backlog 卡数组、进度 task 跨仓
  dec.entries[0].pr = 230
  bl.items[0].pr = [227, 230]
  mm.tasks[0].pr = 'owner2/repo2#4'
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  const r = runGen(NEW_SCRIPTS, fx27.kb)
  ok(r.status === 0, '写了 pr 字段 gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('<a class="prchip" href="https://github.com/o/r/pull/230" target="_blank" rel="noopener">PR #230</a>'), '本仓芯片 href/文案正确')
  ok(count(on, 'href="https://github.com/o/r/pull/227"') === 1 && count(on, 'href="https://github.com/o/r/pull/230"') === 2, '数组 pr 出两枚芯片(决策 230 + backlog 227/230)')
  ok(on.includes('<a class="prchip" href="https://github.com/owner2/repo2/pull/4" target="_blank" rel="noopener">repo2#4</a>'), '跨仓芯片走短仓名文案 repo2#4')
  ok(/id="T1"[\s\S]{0,900}?prchip/.test(on), '进度 task 卡是第三处渲染点')
  // links 里的 PR 链接照常渲染成普通卡片链接,但绝不长芯片 —— 芯片总数恰 4 枚(D1 一 + BL-1 两 + T1 一)
  ok(count(on, 'class="prchip"') === 4 && !on.includes('prchip" href="https://github.com/o/r/pull/91"') && !on.includes('prchip" href="https://github.com/old/repo/pull/91"'),
    'links 兼容不渲染芯片(旧仓链接更不该命中)', `prchip=${count(on, 'class="prchip"')}`)
  // 撤回字段 → 回冻结基线
  delete dec.entries[0].pr; delete bl.items[0].pr; delete mm.tasks[0].pr
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  runGen(NEW_SCRIPTS, fx27.kb)
  ok(sha(idxP) === baseSha, '撤回 pr 字段后与冻结基线逐字节相同')
}

// ============ T28 验收 tab(opt-in;未配/false = 字节冻结,开 = 清单渲染 + 勾选运行期)============
console.log('T28 验收 tab')
const ACC_LIST = {
  pr: [230, 232],
  title: '两 PR 合用一份清单',
  revision: 2,
  env: { url: 'http://127.0.0.1:5175', backend: '8001', branch: 'feature/x', commit: 'abcdef1234', accounts: '录入用**试验员甲**', notes: ['dev 库随便造'] },
  rounds: [{ id: 'r1', label: '第一轮', date: '2026-08-20' }, { id: 'r2', label: '第二轮', date: '2026-08-25' }],
  groups: [{ id: 'K', title: 'K 组', tip: 'K 组说明' }, { id: 'L', title: 'L 组', tip: '' }],
  items: [
    { id: 'A1', group: 'K', pr: 230, round: 'r2', key: true, title: '条目甲', do: '粘下面这段', data: ['d1'], exp: '**一张表**', bad: '还是三段文字', why: '为什么' },
    { id: 'A2', group: 'K', pr: 230, round: 'r1', title: '条目乙', do: '再点一次', exp: '行数不变' },
    { id: 'A3', group: 'L', pr: 232, round: 'r2', title: '条目丙', do: '切管理员', exp: '菜单里有删除' },
    { id: 'A4', group: 'L', pr: 232, round: 'r2', title: '条目丁', do: '点删除', exp: '列表里没它了' },
  ],
  data: { d1: { title: '两行同批号', rows: [['品名', '批号'], ['白尿素', 'CS-01']] } },
  result: { checked: ['A1'], at: '2026-08-26' },
  cards: [],
}
{
  const fx28 = mkFixture('fx28', { 's.html': demoHtml('s') })
  const cfgP = join(fx28.kb, 'kanban.config.json'), idxP = join(fx28.kb, 'index.html')
  const accP = join(fx28.kb, 'acceptance-manifest.json')
  const blP = join(fx28.kb, 'backlog-manifest.json'), decP = join(fx28.kb, 'decisions-manifest.json'), mP = join(fx28.kb, 'manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) x.instance.ghRepo = 'o/r'
  bl.tiers = { 1: '核心' }
  bl.items = [
    // 只有 links 里的 /pull/230,没写 pr 字段 —— 反查(关联卡)要认它
    { id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: '待办甲', problem: 'p', approach: 'a', area: 'x', source: 's', links: [{ title: 'PR', href: 'https://github.com/o/r/pull/230' }] },
    // 写了 pr 但没清单 —— 该出现在「没有验收清单的 PR」里
    { id: 'BL-2', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: '待办乙', problem: 'p', approach: 'a', area: 'x', source: 's', pr: 999 },
  ]
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策甲', pr: 230 }]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  runGen(NEW_SCRIPTS, fx28.kb)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('pane-acceptance') && !off.includes('acclist'), '未配 acceptanceTab:无 tab / 无 pane')
  const offSha = sha(idxP)
  const cfg = rd(cfgP)
  cfg.acceptanceTab = false
  wr(cfgP, cfg)
  writeFileSync(accP, JSON.stringify({ current: 230, lists: [ACC_LIST] })) // false 时文件在也不读
  runGen(NEW_SCRIPTS, fx28.kb)
  ok(sha(idxP) === offSha, 'acceptanceTab:false 与未配逐字节相同(文件在场也不读)')
  cfg.acceptanceTab = true
  wr(cfgP, cfg)
  rmSync(accP)
  const rMiss = runGen(NEW_SCRIPTS, fx28.kb)
  ok(rMiss.status !== 0 && rMiss.stderr.includes('acceptanceTab') && rMiss.stderr.includes('acceptance-manifest.json'), '开了 tab 却没清单文件 → 硬报错点名两者', rMiss.stderr.slice(0, 120))
  writeFileSync(accP, JSON.stringify({ current: 230, lists: [ACC_LIST] }))
  const r = runGen(NEW_SCRIPTS, fx28.kb)
  ok(r.status === 0, 'acceptanceTab:true + 清单 gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('data-pane="acceptance">验收 · 4') && on.includes('id="pane-acceptance"'), 'tab 按钮(徽章=current 清单条目数)与 pane 都在')
  ok(on.includes('id="acc-230-232"') && on.includes('id="acc-230"') && on.includes('id="acc-232"'), '清单锚 + 每个成员 PR 各一个空锚(#acc-230 深链找得到)')
  ok(count(on, 'class="accitem"') === 4, `条目 4 条(实际 ${count(on, 'class="accitem"')})`)
  ok(on.includes('"品名\\t批号\\n白尿素\\tCS-01"'), 'TSV 按 rows 拼好烤入(制表符 + 换行)')
  ok(on.includes('"pre":["A1"]'), 'result.checked 烤成预勾选初值')
  ok(on.includes('_acc_') && on.includes("'_r' + l.rev") && on.includes('"rev":2'), 'localStorage 键含 pr 串与 revision(改版即作废旧勾选)')
  ok(count(on, 'data-accf="round"') === 1 && count(on, 'data-accf="pr"') === 1, '两个维度都在 → 轮次 + PR 两组筛选芯片')
  ok(on.includes('<a class="acccard" href="#BL-1"'), 'links 兼容反查命中:只挂了 /pull/230 链接的卡进了关联卡')
  ok(on.includes('accnolist') && on.includes('>#999</a>'), '「没有验收清单的 PR」列出 999(卡上写了 pr 却没清单)')
  ok(on.includes('<a class="acclink" href="#acc-230">清单</a>') && on.includes('<span data-acc="230">0/4</span>'), '卡头长出「清单」链与「验收中 · n/N」(分母烤入,分子运行期)')
  ok(on.includes('<div class="accexp"><b>一张表</b></div>') && !on.includes('**一张表**'), '正文 **粗体** 转 <b>,原文标记不残留(esc 先于 bold)')
  { // 整壳 <script> 编译级断言:验收运行时也在同一块里,语法级回归当场现形
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((s) => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  { // 条目 id 里带引号:HTML 侧 esc 过了,运行期也不许再拿 id 拼选择器(拼出来非法 → 抛 → 同一块脚本里的发布进度跟着死)
    writeFileSync(accP, JSON.stringify({ current: 230, lists: [{ ...ACC_LIST, revision: 3, result: undefined, items: [{ id: 'A"1', group: 'K', pr: 230, title: '带引号的 id', do: 'x', exp: 'y' }] }] }))
    const rq = runGen(NEW_SCRIPTS, fx28.kb)
    const q = readFileSync(idxP, 'utf8')
    ok(rq.status === 0 && q.includes('data-accid="A&quot;1"'), '带引号的条目 id:gen 不炸,属性值照样 esc', rq.stderr.slice(0, 120))
    ok(!q.includes('[data-accid="\' +'), '运行期不拿 id 拼选择器(改成按 id 索引行)')
    const sc = q.match(/<script>([\s\S]*?)<\/script>/g).map((s) => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, '带引号的条目 id:壳内联 JS 仍可编译')
    writeFileSync(accP, JSON.stringify({ current: 230, lists: [ACC_LIST] }))
    runGen(NEW_SCRIPTS, fx28.kb)
  }
  { // 懒加载 + 验收同开:pane 是 fetch 之后才到的,show() 那次同步跑在注入之前 —— 注入完必须再补一次
    cfg.lazyTabs = true
    wr(cfgP, cfg)
    runGen(NEW_SCRIPTS, fx28.kb)
    const inj = (readFileSync(idxP, 'utf8').match(/function onPaneInjected\(name\) \{[\s\S]*?\n {2}\}/) || [''])[0]
    ok(/accSync\(\)/.test(inj), 'lazyTabs + acceptanceTab 同开:onPaneInjected 里补一次 accSync(否则注入的卡头芯片停在 0/N)', inj.slice(-160))
    delete cfg.lazyTabs
    wr(cfgP, cfg)
    runGen(NEW_SCRIPTS, fx28.kb)
  }
  cfg.acceptanceTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx28.kb)
  ok(sha(idxP) === offSha, '关回 false 后与冻结基线逐字节相同')
}

// ============ T29 验收守卫(三条 notice,全不阻断)============
console.log('T29 验收守卫')
{
  const fx29 = mkFixture('fx29', { 's.html': demoHtml('s') })
  const cfgP = join(fx29.kb, 'kanban.config.json'), accP = join(fx29.kb, 'acceptance-manifest.json')
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.acceptanceTab = true
  writeFileSync(cfgP, JSON.stringify(cfg))
  const bad = {
    current: 999, // 没有任何清单含它
    lists: [
      { pr: [230, 232], title: '甲', items: [{ id: 'A1', title: 'x' }, { id: 'A1', title: 'y' }], cards: ['NOPE'] },
      { pr: 230, title: '乙', items: [{ id: 'B1', title: 'z' }] }, // 230 撞进第二份清单
    ],
  }
  writeFileSync(accP, JSON.stringify(bad))
  const r = runStop(NEW_SCRIPTS, fx29.root)
  ok(r.status === 0, '验收审计全非阻断(exit 0)', `${r.status} ${r.stderr.slice(0, 200)}`)
  const out = r.stdout
  ok(out.includes('current = 999'), 'current 指向的 PR 没清单 → 一条 notice')
  ok(out.includes('PR #230 同时出现在两份验收清单'), '同一 PR 落进两份清单 → 一条 notice')
  ok(out.includes('条目 id「A1」重复'), '条目 id 重复 → 一条 notice')
  ok(out.includes('不存在的卡号「NOPE」'), 'cards 引用不存在的卡号 → 一条 notice')
  // JSON 坏掉:产物已新鲜(gen 不重跑)时,守卫只报一条解析失败,不崩
  writeFileSync(accP, '{ 坏掉的 JSON')
  touch(join(fx29.kb, 'index.html'))
  const r2 = runStop(NEW_SCRIPTS, fx29.root)
  ok(r2.status === 0 && r2.stdout.includes('无法解析'), '清单 JSON 坏 → 一条解析失败 notice,不崩不拦', `${r2.status} ${r2.stdout.slice(0, 200)}`)
}


// ============ T30 段判定 stageOf(纯函数穷举:三段 / 两段宿主 / 非主线 / draft / closed / 显式归版)============
console.log('T30 段判定 stageOf')
{
  const { relIndex, stageOf } = await import(join(NEW_SCRIPTS, 'relstage.mjs'))
  const RELS = [{ tag: 'v1', at: '2026-07-14T06:00:00Z' }, { tag: 'v2', at: '2026-07-20T09:00:00Z' }]
  const THREE = ['dev', 'test', 'prod'], TWO = ['dev', 'prod'] // 两段宿主 = 合了即发
  const idx = relIndex(RELS)
  const st = (pr, ids = THREE, main = 'main') => stageOf(pr, idx, main, ids)
  ok(st({ number: 1, state: 'open', base: 'main' }).id === 'dev', 'open + 主线 → dev')
  ok(st({ number: 2, state: 'open', draft: true, base: 'main' }).id === 'dev', 'draft 仍是 dev(草稿是显示标记,不是第四段)')
  ok(st({ number: 3, state: 'closed', base: 'main' }).id === 'closed', 'closed → 不入三段')
  ok(st({ number: 4, state: 'open', base: 'feature/x' }).id === 'offline', 'base 非主线 → offline')
  ok(st({ number: 5, state: 'merged', base: 'feature/x', mergedAt: '2026-07-15T00:00:00Z' }).id === 'offline',
    '非主线优先于归版:合进别人分支不算进主线')
  ok(st({ number: 4, state: 'open', base: 'feature/x' }, THREE, '').id === 'dev', '宿主没声明主线分支 → 不猜「非主线」')
  const p6 = st({ number: 6, state: 'merged', base: 'main', mergedAt: '2026-07-10T00:00:00Z' })
  ok(p6.id === 'prod' && p6.tag === 'v1', 'merged 落进 at ≥ mergedAt 的最早 release')
  const p7 = st({ number: 7, state: 'merged', base: 'main', mergedAt: '2026-07-20T09:00:00Z' })
  ok(p7.id === 'prod' && p7.tag === 'v2', '刚好等于打 tag 时刻 → 算进这一版(边界取等)')
  const p8 = st({ number: 8, state: 'merged', base: 'main', mergedAt: '2026-07-20T09:00:01Z' })
  ok(p8.id === 'test' && p8.tag === '', '打完 tag 一秒后才合 → test(不是同一天就算发出去了)')
  const p8b = st({ number: 8, state: 'merged', base: 'main', mergedAt: '2026-07-20T09:00:01Z' }, TWO)
  ok(p8b.id === 'prod' && p8b.tag === '', '两段宿主(无 test):merged 未归版直接算 prod 且不带版本号')
  const idx2 = relIndex([RELS[0], { ...RELS[1], prs: [8] }])
  const p8c = stageOf({ number: 8, state: 'merged', base: 'main', mergedAt: '2026-07-20T09:00:01Z' }, idx2, 'main', THREE)
  ok(p8c.id === 'prod' && p8c.tag === 'v2', '显式 releases[].prs 覆盖区间判定')
  ok(st({ number: 9, state: 'merged', base: 'main', mergedAt: null }).id === 'test', 'merged 但没 mergedAt → 不编造归版')
  { // 人手写的 at 常带 +08:00,gh 给的 mergedAt 是 Z —— 混在一起按字面比就把 tag 之后合的算成已发
    const tz = relIndex([{ tag: 'v9', at: '2026-08-26T10:00:00+08:00' }]) // = 02:00Z
    const late = stageOf({ number: 20, state: 'merged', base: 'main', mergedAt: '2026-08-26T05:00:00Z' }, tz, 'main', THREE)
    ok(late.id === 'test' && late.tag === '', 'at 与 mergedAt 比时刻不比字面:tag 之后三小时才合 → test', JSON.stringify(late))
    const early = stageOf({ number: 21, state: 'merged', base: 'main', mergedAt: '2026-08-26T01:00:00Z' }, tz, 'main', THREE)
    ok(early.id === 'prod' && early.tag === 'v9', '同一个带偏移的 at:tag 之前合的仍归这一版', JSON.stringify(early))
  }
}

// ============ T31 发布进度 tab(opt-in;未配/false = 字节冻结,开 = 表格烤入 + 分组折叠)============
console.log('T31 发布进度 tab')
const REL_MANIFEST = {
  stages: [
    { id: 'dev', label: 'dev', hint: '开着的 PR' },
    { id: 'test', label: 'test', hint: '已合主线,未随版本发出' },
    { id: 'prod', label: 'prod', hint: '已随版本发出' },
  ],
  releases: [{ tag: 'v0.0.1', at: '2026-08-20T09:00:00Z', note: '首版' }],
  prs: [
    { number: 232, title: '开着的乙', state: 'open', draft: false, base: 'main', branch: 'feat/b', url: 'https://github.com/o/r/pull/232', createdAt: '2026-08-24T01:00:00Z', mergedAt: null, closedAt: null, cards: [] },
    { number: 230, title: '开着的甲', state: 'open', draft: false, base: 'main', branch: 'feat/a', url: 'https://github.com/o/r/pull/230', createdAt: '2026-08-23T01:00:00Z', mergedAt: null, closedAt: null, cards: [] },
    { number: 228, title: '草稿丙', state: 'open', draft: true, base: 'main', branch: 'feat/c', url: 'https://github.com/o/r/pull/228', createdAt: '2026-08-22T01:00:00Z', mergedAt: null, closedAt: null, cards: [] },
    { number: 227, title: '已发的丁', state: 'merged', draft: false, base: 'main', branch: 'feat/d', url: 'https://github.com/o/r/pull/227', createdAt: '2026-08-18T01:00:00Z', mergedAt: '2026-08-19T01:00:00Z', closedAt: '2026-08-19T01:00:00Z', cards: [] },
    { number: 226, title: '已合未发的戊', state: 'merged', draft: false, base: 'main', branch: 'feat/e', url: 'https://github.com/o/r/pull/226', createdAt: '2026-08-21T01:00:00Z', mergedAt: '2026-08-22T01:00:00Z', closedAt: '2026-08-22T01:00:00Z', cards: [] },
    { number: 225, title: '关掉未合的己', state: 'closed', draft: false, base: 'main', branch: 'feat/f', url: 'https://github.com/o/r/pull/225', createdAt: '2026-08-10T01:00:00Z', mergedAt: null, closedAt: '2026-08-11T01:00:00Z', cards: [] },
    { number: 224, title: '叠在别人分支上的庚', state: 'open', draft: false, base: 'feat/a', branch: 'feat/g', url: 'https://github.com/o/r/pull/224', createdAt: '2026-08-23T02:00:00Z', mergedAt: null, closedAt: null, cards: [] },
  ],
  syncedAt: '2026-08-26T02:00:00Z',
}
{
  const fx31 = mkFixture('fx31', { 's.html': demoHtml('s') })
  const cfgP = join(fx31.kb, 'kanban.config.json'), idxP = join(fx31.kb, 'index.html')
  const relP = join(fx31.kb, 'release-manifest.json'), accP = join(fx31.kb, 'acceptance-manifest.json')
  const mP = join(fx31.kb, 'manifest.json'), decP = join(fx31.kb, 'decisions-manifest.json'), blP = join(fx31.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  bl.tiers = { 1: '核心' }
  // 只挂 links 里的 /pull/230,不写 pr 字段 —— 表格的「关联卡」列要靠反查认它
  bl.items = [{ id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: '待办甲', problem: 'p', approach: 'a', area: 'x', source: 's', links: [{ title: 'PR', href: 'https://github.com/o/r/pull/230' }] }]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  runGen(NEW_SCRIPTS, fx31.kb)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('pane-release') && !off.includes('class="relr"'), '未配 releaseTab:无 tab / 无 pane')
  const offSha = sha(idxP)
  const cfg = rd(cfgP)
  cfg.releaseTab = false
  wr(cfgP, cfg)
  wr(relP, REL_MANIFEST) // false 时文件在场也不进 tab(芯片后缀 / 链接状态另说,见 T33 / T36)
  runGen(NEW_SCRIPTS, fx31.kb)
  const relOff = readFileSync(idxP, 'utf8')
  ok(!relOff.includes('pane-release') && !relOff.includes('class="relr"'), 'releaseTab:false 时文件在场也不渲染 pane')
  ok(relOff.includes('<span class="prst">开着</span>'),
    'PR 链接的状态后缀不随 tab 走:release-manifest 在场就生效(与卡头芯片后缀同一道门,见 T33)')
  cfg.releaseTab = true
  wr(cfgP, cfg)
  rmSync(relP)
  const rMiss = runGen(NEW_SCRIPTS, fx31.kb)
  ok(rMiss.status !== 0 && rMiss.stderr.includes('releaseTab') && rMiss.stderr.includes('release-manifest.json'), '开了 tab 却没文件 → 硬报错点名两者', rMiss.stderr.slice(0, 120))
  wr(relP, { ...REL_MANIFEST, stages: [{ id: 'test', label: 'test' }, { id: 'prod', label: 'prod' }] })
  const rNoDev = runGen(NEW_SCRIPTS, fx31.kb)
  ok(rNoDev.status !== 0 && rNoDev.stderr.includes('dev'), 'stages 缺 dev → 硬报错(可以只列两段,但不能省掉 dev)', rNoDev.stderr.slice(0, 120))
  wr(relP, REL_MANIFEST)
  const r = runGen(NEW_SCRIPTS, fx31.kb)
  ok(r.status === 0, 'releaseTab:true + release-manifest gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('data-pane="release">发布进度 · 3') && on.includes('id="pane-release"'), 'tab 按钮(徽章 = dev 段计数 230/232/228)与 pane 都在',
    (on.match(/data-pane="release">[^<]*/) || [])[0])
  ok([232, 230, 228, 227, 226, 225, 224].every((n) => on.includes(`id="pr-${n}"`)), '每行一个 id="pr-N" 锚(深链在静态 HTML 里就找得到)')
  ok(on.includes('<span class="relsg s-dev">dev</span>') && on.includes('<span class="relsg s-test">test</span>')
    && on.includes('<span class="relsg s-prod">prod v0.0.1</span>') && on.includes('<span class="relsg s-closed">已关闭</span>')
    && on.includes('<span class="relsg s-offline">非主线</span>'), '五种段芯片各就各位(prod 带版本号,非主线/已关闭不入三段)')
  ok(on.includes('开着 · 08-23') && on.includes('草稿 · 08-22') && on.includes('已合 · 08-22') && on.includes('已发 v0.0.1 · 08-19') && on.includes('已关闭 · 08-11'),
    '状态 · 日期五种写法齐全')
  ok(on.includes('<tr class="relgh" data-relgh="v0.0.1" data-relopen="1">'), '已发按版本分组,最新版默认展开')
  { // 默认序 = 段优先:开着的三条在最上面,已发那块整个沉在下面(227 的 mergedAt 比 226 早也不许上浮)
    const seq = [...on.matchAll(/class="relgh" data-relgh="([^"]+)"|class="relr" id="pr-(\d+)"/g)]
      .map((x) => x[1] ? `[${x[1]}]` : x[2]).join(' ')
    ok(seq === '232 230 228 226 [v0.0.1] 227 224 225', '默认序:dev → test → prod 版本块 → 其它,段内日期降序', seq)
  }
  { // 人手追加一版、只写 prs 忘了写 at(pr-sync 见过这个 tag 就不再补):分组头只能出一次,同版的行还得连着
    wr(relP, { ...REL_MANIFEST, releases: [...REL_MANIFEST.releases, { tag: 'v0.0.2', prs: [226, 227], note: '手写' }] })
    const rNoAt = runGen(NEW_SCRIPTS, fx31.kb)
    const noAt = readFileSync(idxP, 'utf8')
    ok(rNoAt.status === 0 && rNoAt.stderr.includes('没写 at'), 'releases[] 缺 at → gen 出声提醒(不阻断)', rNoAt.stderr.slice(0, 160))
    ok(count(noAt, 'data-relgh="v0.0.2"') === 1, `缺 at 的版本也只出一个分组头(实际 ${count(noAt, 'data-relgh="v0.0.2"')} 个)`)
    const seq = (noAt.match(/data-relgh="v0\.0\.2"|id="pr-22[67]"/g) || []).join('|')
    ok(seq === 'data-relgh="v0.0.2"|id="pr-226"|id="pr-227"', '同版的行紧跟在那一个分组头之后(缺 at 不让它散开)', seq)
    wr(relP, REL_MANIFEST)
    runGen(NEW_SCRIPTS, fx31.kb)
  }
  ok(on.includes('data-relsync="2026-08-26T02:00:00Z"') && !/new Date\(\)/.test(on.split('<script>')[0]), 'syncedAt 烤成 ISO 原文(换算成本地时间是浏览器的事)')
  ok(on.includes('<a class="relcard" href="#BL-1"'), 'links 兼容反查命中:只挂了 /pull/230 链接的卡进了关联卡列')
  ok(on.includes('<span class="relnil">—</span>'), '没有关联卡 / 没有验收清单的格子是一条破折号,不是空白')
  const relOnlySha = sha(idxP) // 只开发布进度、没有验收清单的那一份:下面加完验收再撤掉,要退回到它
  // 两个 tab 同开:验收列长出 n/N 与「验收中」标
  cfg.acceptanceTab = true
  wr(cfgP, cfg)
  writeFileSync(accP, JSON.stringify({ current: 230, lists: [ACC_LIST] }))
  const r2 = runGen(NEW_SCRIPTS, fx31.kb)
  ok(r2.status === 0, '两个 tab 同开 gen exit 0', r2.stderr)
  const both = readFileSync(idxP, 'utf8')
  ok(both.includes('<a class="acclink" href="#acc-230"><span data-acc="230">0/4</span></a>'), '验收列 = n/N 链到清单锚(分母烤入,分子运行期)')
  ok(/id="pr-230"[\s\S]{0,400}?<span class="relnow">验收中<\/span>/.test(both), 'current 那行打「验收中」标')
  // ———— 时间线也认这一条(v0.17.1):从前只有表格打标,图里几条 PR 长得一模一样 ————
  const D230 = (() => {
    const D0 = JSON.parse(both.match(/\n {4}var D = (\[[\s\S]*?\])\n/)[1])
    const withCur = D0.filter((x) => 'cur' in x)
    ok(withCur.length === 1 && withCur[0].n === 230 && withCur[0].cur === 1,
      '两视图共用的 D 里,只有 current 那一行带 cur: 1', JSON.stringify(withCur))
    ok(D0.filter((x) => x.n !== 230).every((x) => !('cur' in x)),
      '其余行连这个键都不写(不是 cur: 0)—— 没有验收清单的板因此一个字节都不多')
    return withCur[0]
  })()
  { // 三档字形共用同一个 relcur:把壳里那几只画字形的函数原样抠出来跑,不是对着源码猜
    const { relCaps } = await import(join(NEW_SCRIPTS, 'relgeom.mjs'))
    const b0 = both.indexOf('function curCls(d)')
    const b1 = both.indexOf('// 放不下的收进一枚 +N', b0)
    ok(b0 > 0 && b1 > b0, '壳里有 curCls / curTxt / tlBar / tlA / tlSq / tlCap / tlChip 这一段')
    const mk = new Function('xe', 'href', 'pass', 'relCaps', 'TL', both.slice(b0, b1)
      + '\nreturn { curCls: curCls, curTxt: curTxt, tlBar: tlBar, tlSq: tlSq, tlCap: tlCap, tlChip: tlChip }')
    const F = mk((s) => String(s), () => '', () => true, relCaps, { row: 13 })
    const G1 = { sg: 'dev', q: 4, g: 'dev', nm: 'dev' }
    const OTH = { n: 232, t: '同带的乙', s: 'merged' } // 同一条带里的另一条 PR:它不许长出描边
    const bar = (d) => ({ item: { d, s: '2026-08-20' }, x: 40, w: 200, lane: 0 })
    ok(F.curCls(D230) === ' relcur' && F.curCls(OTH) === '' && F.curCls(null) === '',
      'curCls 只认 D 上那个 cur 键(没有 D 行也不抛)')
    const t0 = F.tlBar(bar(D230), G1, 30, false, true)
    ok(/class="relpb relc s-dev q4 open relcur"/.test(t0) && !/class="[^"]*relcur/.test(F.tlBar(bar(OTH), G1, 30, false, true)),
      '方块档(< 40px/天):验收中那条挂 relcur,同带的别条不挂', (t0.match(/class="[^"]*"/) || [])[0])
    const t1 = F.tlSq({ item: { d: D230 }, x: 40, lane: 0 }, G1, 30, false, 24, 20)
    ok(/class="relpb relc s-dev q4 open relcur"/.test(t1) && /width:20px;height:20px/.test(t1),
      'A 档的方块:relcur 挂上了,边长照旧由 relSqSize 那一档给', (t1.match(/class="[^"]*"/) || [])[0])
    const t1c = F.tlCap(bar(D230), G1, 30, false, 16, false)
    ok(/class="relpb relcb relc s-dev q4 open relcur"/.test(t1c) && t1c.includes('class="relcp"'),
      'A 档的两端端帽横杠:壳上挂 relcur(CSS 把圈画在帽上,不圈住中间那截虚长的轨)', (t1c.match(/class="[^"]*"/) || [])[0])
    const t2 = F.tlChip({ d: D230 }, G1, 40, 30, false, 42)
    ok(/class="relpb relchip relc s-dev q4 open relcur"/.test(t2) && t2.endsWith('>#230</a>'),
      'B 档日格芯片:relcur 挂上了,号原样留着(42px 写不下「验收中」,就只留描边)', t2.slice(-24))
    const t2w = F.tlChip({ d: D230 }, G1, 40, 30, false, 96)
    ok(t2w.endsWith('>#230 验收中</a>'), '宽到同时放得下号与标注才并排写,号在前', t2w.slice(-28))
    ok(F.curTxt(D230, 42) === '#230' && F.curTxt(D230, 96) === '#230 验收中' && F.curTxt(OTH, 96) === '#232',
      '号是数据、「验收中」是标注:标注永远不许把号顶掉,放不下就只写号')
  }
  { // 副行:那条 PR 画得出来才说,画不出来一个字都不说
    const g0 = both.indexOf('var body = [], gut = [')
    const tail = "'</span></span></span>']"
    const g1 = both.indexOf(tail, g0)
    ok(g0 > 0 && g1 > g0, '壳里有带头那一段')
    const mkGut = new Function('g', 'op', 'H', 'q', 'hit', 'inwin', 'curN', 'xe', 'md',
      both.slice(g0, g1 + tail.length) + '\nreturn gut[0]')
    const G1 = { g: 'dev', nm: 'dev', sf: '', n: 5, lo: '2026-09-01', hi: '2026-09-09' }
    const xe0 = (s) => String(s), md0 = (s) => String(s).slice(5, 10)
    const yes = mkGut(G1, true, 60, false, 0, 5, 230, xe0, md0)
    const no = mkGut(G1, true, 60, false, 0, 5, 0, xe0, md0)
    ok(yes.includes('<span class="relbi">5 PR · 09-01→09-09</span><b class="relbw"> · 验收中 #230</b>'),
      '画得出来:那条泳道的副行补一句「· 验收中 #230」', (yes.match(/<span class="relbm">[\s\S]*?<\/span><\/span>/) || [])[0])
    ok(no.includes('<span class="relbi">5 PR · 09-01→09-09</span></span>') && !no.includes('relbw') && !no.includes('验收中'),
      '窗口/筛选把它切掉了:副行原样,一个字都不加(不谎称)', (no.match(/<span class="relbm">[\s\S]*?<\/span>/) || [])[0])
    const long = mkGut(G1, true, 60, true, 3, 2, 230, xe0, md0)
    ok(/<span class="relbi">3 \/ 5 PR · 09-01→09-09 · 窗口内 2<\/span><b class="relbw"> · 验收中 #230<\/b>/.test(long),
      '搜索命中数 + 窗口内 N 把前半截撑长时,验收标仍在 .relbw 里(flex: none,先被省略号吃掉的是日期范围)',
      (long.match(/<span class="relbm">[\s\S]*?<\/span><\/span>/) || [])[0])
  }
  { // 描边不占位:box-shadow,不是 border / outline-offset —— 一占位就把同格的邻居挤走了
    const rule = (both.match(/\.relpb\.relcur \{[^}]*\}/) || [])[0] || ''
    ok(/box-shadow:/.test(rule) && rule.includes('var(--accent)') && !/border|padding|outline|width/.test(rule),
      '.relpb.relcur 只用 box-shadow + 既有的 --accent,不碰任何占位属性', rule)
    ok(both.includes('.relpb.relcb.relcur { box-shadow: none; }')
      && /\.relpb\.relcb\.relcur \.relcp \{ box-shadow:[^}]*var\(--accent\)/.test(both),
      'A 档的横杠:圈改画在两端帽上(壳本身是透明的,圈在壳上等于圈住一条几乎空的轨)')
    ok(/\.relbw \{ flex: none;[^}]*var\(--accent\)/.test(both) && /\.relbi \{ min-width: 0; \}/.test(both),
      '副行那半句也用同一个 --accent,且 flex: none 不许被挤掉')
  }
  { // 整壳 <script> 编译级断言:发布进度运行时与验收运行时在同一块里
    const sc = both.match(/<script>([\s\S]*?)<\/script>/g).map((s) => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  { // 撤掉验收清单、发布进度照旧开着:产物退回加清单之前那一份 —— cur 键与「验收中 #N」都没漏出去
    delete cfg.acceptanceTab
    wr(cfgP, cfg)
    rmSync(accP)
    runGen(NEW_SCRIPTS, fx31.kb)
    ok(sha(idxP) === relOnlySha, '没有验收清单的板:releaseTab 照旧开着,产物与加清单之前逐字节相同')
    const noAcc = readFileSync(idxP, 'utf8')
    const D1 = JSON.parse(noAcc.match(/\n {4}var D = (\[[\s\S]*?\])\n/)[1])
    ok(D1.length === 7 && D1.every((x) => !('cur' in x)), '时间线的每一行都不带 cur 键(没有 current 可认)', JSON.stringify(D1.map((x) => x.n)))
    cfg.acceptanceTab = true // 还原,把收尾那一步交回给下面那段
    wr(cfgP, cfg)
    writeFileSync(accP, JSON.stringify({ current: 230, lists: [ACC_LIST] }))
    runGen(NEW_SCRIPTS, fx31.kb)
  }
  delete cfg.acceptanceTab
  cfg.releaseTab = false
  wr(cfgP, cfg)
  rmSync(accP); rmSync(relP)
  runGen(NEW_SCRIPTS, fx31.kb)
  ok(sha(idxP) === offSha, '两个 tab 关回 + 撤掉两份 manifest 后与冻结基线逐字节相同')
}

// ============ T33 卡头 PR 芯片的状态后缀(release-manifest 在场即生效,与 releaseTab 无关)============
console.log('T33 芯片状态后缀')
{
  const fx33 = mkFixture('fx33', { 's.html': demoHtml('s') })
  const idxP = join(fx33.kb, 'index.html'), relP = join(fx33.kb, 'release-manifest.json')
  const decP = join(fx33.kb, 'decisions-manifest.json'), mP = join(fx33.kb, 'manifest.json'), blP = join(fx33.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  dec.entries = [230, 228, 227, 226, 225, 223].map((n, i) => ({ id: `D${i + 1}`, code: `D${i + 1}`, status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: `决策 ${n}`, pr: n }))
  // 223 = 叠在别人分支上、又合进去了的 PR:mergedAt 落在 v0.0.1 之前,按区间本会被算成「已发 v0.0.1」
  const stacked = { number: 223, title: '叠 PR', state: 'merged', draft: false, base: 'feat/a', branch: 'feat/g2', url: 'https://github.com/o/r/pull/223', createdAt: '2026-08-17T01:00:00Z', mergedAt: '2026-08-19T02:00:00Z', closedAt: '2026-08-19T02:00:00Z', cards: [] }
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  runGen(NEW_SCRIPTS, fx33.kb)
  const noFile = readFileSync(idxP, 'utf8')
  const baseSha = sha(idxP)
  ok(noFile.includes('class="prchip"') && !noFile.includes('class="prst"'), '没有 release-manifest:有芯片、无后缀(PR-A 留的口在此闭合)')
  wr(relP, { ...REL_MANIFEST, prs: [...REL_MANIFEST.prs, stacked] }) // releaseTab 没开,芯片后缀照样有 —— 状态是数据,不是 tab 的附属品
  const r = runGen(NEW_SCRIPTS, fx33.kb)
  ok(r.status === 0, 'release-manifest 在场 gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('<span class="prst">开着</span>'), '芯片后缀「开着」')
  ok(on.includes('<span class="prst">草稿</span>'), '芯片后缀「草稿」')
  ok(on.includes('<span class="prst">已发 v0.0.1</span>'), '芯片后缀「已发 v0.0.1」')
  ok(on.includes('<span class="prst">已合 08-22</span>'), '芯片后缀「已合 MM-DD」')
  ok(on.includes('<span class="prst">已关闭</span>'), '芯片后缀「已关闭」')
  ok(/pull\/223[\s\S]{0,140}?<span class="prst">非主线<\/span>/.test(on),
    '芯片后缀「非主线」:叠 PR 合了也不说「已发」,与发布进度表格同一个口径', (on.match(/pull\/223[\s\S]{0,140}/) || [''])[0].slice(0, 160))
  rmSync(relP)
  runGen(NEW_SCRIPTS, fx33.kb)
  ok(sha(idxP) === baseSha, '撤掉 release-manifest 后与无文件基线逐字节相同')
}

// ============ T32 pr-sync(PATH 里放假 gh 跑通;拿掉假 gh 则 exit 1 且文件一字不动)============
console.log('T32 pr-sync')
{
  const fx32 = mkFixture('fx32', { 's.html': demoHtml('s') })
  const relP = join(fx32.kb, 'release-manifest.json')
  const mP = join(fx32.kb, 'manifest.json'), decP = join(fx32.kb, 'decisions-manifest.json'), blP = join(fx32.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  bl.tiers = { 1: '核心' }
  bl.items = [{ id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: '待办甲', problem: 'p', approach: 'a', area: 'x', source: 's', links: [{ title: 'PR', href: 'https://github.com/o/r/pull/12' }] }]
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策甲', pr: 11 }]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  // 人手写在先:v0.0.1 的 note 与 prs 都不该被机器抹掉;v0.0.1-hot 的 at 是人手写的 +08:00(= 00:00Z)
  wr(relP, {
    stages: REL_MANIFEST.stages,
    releases: [
      { tag: 'v0.0.1', at: '2026-07-14T06:00:00Z', note: '首版', prs: [999] },
      { tag: 'v0.0.1-hot', at: '2026-07-19T08:00:00+08:00', note: '本地打的补丁版' },
    ],
    prs: [], syncedAt: null,
  })
  // 假 gh:两个子命令各吐一份固定 JSON(PR 故意不按号排,验证脚本自己排)
  const ghDir = join(WORK, 'fakegh'), noGhDir = join(WORK, 'nogh')
  mkdirSync(ghDir, { recursive: true }); mkdirSync(noGhDir, { recursive: true })
  // echo 是 shell 内建:PATH 里只放这一个目录也跑得动,测试全程够不着机器上真的 gh
  writeFileSync(join(ghDir, 'gh'), `#!/bin/sh
case "$1 $2" in
"pr list") echo '[{"number":10,"title":"丙","state":"MERGED","isDraft":false,"baseRefName":"main","headRefName":"feat/c","url":"https://github.com/o/r/pull/10","createdAt":"2026-07-10T01:00:00Z","mergedAt":"2026-07-12T01:00:00Z","closedAt":"2026-07-12T01:00:00Z"},
 {"number":12,"title":"甲","state":"OPEN","isDraft":false,"baseRefName":"main","headRefName":"feat/a","url":"https://github.com/o/r/pull/12","createdAt":"2026-08-20T01:00:00Z","mergedAt":null,"closedAt":null},
 {"number":9,"title":"丁","state":"CLOSED","isDraft":true,"baseRefName":"main","headRefName":"feat/d","url":"https://github.com/o/r/pull/9","createdAt":"2026-07-05T01:00:00Z","mergedAt":null,"closedAt":"2026-07-06T01:00:00Z"},
 {"number":11,"title":"乙","state":"MERGED","isDraft":false,"baseRefName":"main","headRefName":"feat/b","url":"https://github.com/o/r/pull/11","createdAt":"2026-07-18T01:00:00Z","mergedAt":"2026-07-19T01:00:00Z","closedAt":"2026-07-19T01:00:00Z"}]' ;;
"release list") echo '[{"tagName":"v0.0.2","publishedAt":"2026-07-20T09:00:00Z"},{"tagName":"v0.0.1","publishedAt":"2026-07-14T06:00:00Z"}]' ;;
esac
`)
  chmodSync(join(ghDir, 'gh'), 0o755)
  // PATH 只给这一个目录(不拼 process.env.PATH):否则「没有 gh」那一跑会摸到机器/CI 上真的 gh,
  // 走的就成了「gh 报错」分支,还顺手发一个网络请求 —— 测试床对 gh / 网络零依赖是硬要求。
  const runSync = (dir, extra = []) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'pr-sync.mjs'), '--dir', fx32.kb, ...extra],
    { encoding: 'utf8', env: { ...process.env, PATH: dir } })
  const beforeDry = sha(relP)
  const rDry = runSync(ghDir, ['--dry-run'])
  ok(rDry.status === 0 && sha(relP) === beforeDry && /4/.test(rDry.stdout), '--dry-run 打摘要不写文件', `${rDry.status} ${rDry.stdout}${rDry.stderr}`)
  const rs = runSync(ghDir)
  ok(rs.status === 0, 'pr-sync exit 0', `${rs.stdout}${rs.stderr}`)
  const out = rd(relP)
  ok(out.prs.map((p) => p.number).join(',') === '12,11,10,9', 'prs 按号降序重写(gh 给的顺序不作数)', out.prs.map((p) => p.number).join(','))
  ok(out.prs.every((p) => ['open', 'merged', 'closed'].includes(p.state)) && out.prs[0].state === 'open',
    'gh 的 OPEN/MERGED/CLOSED 落成小写', JSON.stringify(out.prs.map((p) => p.state)))
  ok(out.prs[3].draft === true && out.prs[3].branch === 'feat/d' && out.prs[3].base === 'main', 'draft / 分支 / base 三个字段都落了')
  ok(out.releases.map((r) => r.tag).join(',') === 'v0.0.1,v0.0.1-hot,v0.0.2', '新 tag 追加,按 at 升序', JSON.stringify(out.releases.map((r) => r.tag)))
  ok(out.releases[0].note === '首版' && JSON.stringify(out.releases[0].prs) === '[999]', '已有条目的 note 与人手写的 prs 一律不覆盖')
  ok(JSON.stringify(out.releases[2].prs) === '[11]', '新版本的 prs 按 at 区间自动填(上一版之后、本版当刻之前合的)', JSON.stringify(out.releases[2].prs))
  ok(JSON.stringify(out.releases[1].prs) === '[]', '人手写的 +08:00 at 按时刻算区间:00:00Z 打的 tag,01:00Z 才合的 #11 不算进来', JSON.stringify(out.releases[1].prs))
  ok(JSON.stringify(out.prs[0].cards) === '["BL-1"]', 'cards 反查含 links 兼容(卡只挂了 /pull/12 链接)', JSON.stringify(out.prs[0].cards))
  ok(JSON.stringify(out.prs[1].cards) === '["D1"]', 'cards 反查认显式 pr 字段')
  ok(typeof out.syncedAt === 'string' && !isNaN(Date.parse(out.syncedAt)), 'syncedAt 是合法 ISO(脚本可以用时间,gen 不行)')
  ok(JSON.stringify(out.stages) === JSON.stringify(REL_MANIFEST.stages) && readFileSync(relP, 'utf8').endsWith('}\n'), 'stages 原样不动;2 空格缩进 + 末尾换行')
  const afterSha = sha(relP)
  const rNo = runSync(noGhDir)
  ok(rNo.status === 1 && sha(relP) === afterSha, 'PATH 里没有 gh → exit 1 且文件一个字节都没动', `${rNo.status} ${rNo.stderr.slice(0, 120)}`)
  ok(/找不到 gh 命令|gh command was not found/.test(rNo.stderr), 'stderr 是「找不到 gh」那条(不是 gh 跑起来又失败那条)', rNo.stderr.slice(0, 120))

  { // --limit:gh 只有「要多少个」没有「全部」;拿满了要说一句,而且这趟没返回的老 PR 不许从表上抹掉
    const limDir = join(WORK, 'fakegh-limit')
    mkdirSync(limDir, { recursive: true })
    writeFileSync(join(limDir, 'gh'), `#!${process.execPath}
const a = process.argv.slice(2)
if (a[0] === 'release') { console.log('[]'); process.exit(0) }
const lim = Number(a[a.indexOf('--limit') + 1])
const prs = [12, 11, 10, 9].map((n) => ({ number: n, title: 'gh-' + n, state: 'OPEN', isDraft: false, baseRefName: 'main', headRefName: 'f' + n, url: 'https://github.com/o/r/pull/' + n, createdAt: '2026-08-20T01:00:00Z', mergedAt: null, closedAt: null }))
console.log(JSON.stringify(prs.slice(0, lim)))
`)
    chmodSync(join(limDir, 'gh'), 0o755)
    const rBad = runSync(limDir, ['--limit', 'x'])
    ok(rBad.status === 1 && /正整数|positive integer/.test(rBad.stderr), '--limit 要正整数,给别的就拒跑')
    const rLim = runSync(limDir, ['--limit', '2'])
    const o2 = rd(relP)
    ok(rLim.status === 0, 'pr-sync --limit 2 exit 0', rLim.stderr)
    ok(o2.prs.map((p) => p.number).join(',') === '12,11,10,9', 'gh 只给了两个,另两个老 PR 原样留在表上(不是被删掉)', o2.prs.map((p) => p.number).join(','))
    ok(o2.prs[0].title === 'gh-12' && o2.prs[3].title === '丁', 'gh 返回的那两个照它重写,没返回的两个保持原样')
    ok(/给满了|as many as it was asked for/.test(rLim.stderr), '拿满 limit 时 stderr 明说这趟截断了,并指出该加 --limit')
    const rFull = runSync(limDir, ['--limit', '10'])
    ok(!/给满了|as many as it was asked for/.test(rFull.stderr), '没拿满就不吵')
  }
}

// ============ T35 richText 卡正文轻 markdown + 折叠 + detail(opt-in;关档逐字节冻结)============
console.log('T35 richText 轻 markdown / 折叠 / detail')
{
  const Z = String.fromCharCode(0)
  const { lite, litePreview } = await import(join(NEW_SCRIPTS, 'lite.mjs'))

  // ---- 规则逐条(定稿 §3.1;与 C 档 demo 的内联自测同题)----
  ok(lite('**要紧**') === '<p><b>要紧</b></p>', '**粗体** → <b>')
  ok(lite('看 `models.py:37` 这行') === '<p>看 <code>models.py:37</code> 这行</p>', '反引号 → <code>')
  ok(lite('甲\n乙') === '<p>甲<br>乙</p>', '单换行 → <br>')
  ok(lite('甲\n\n乙') === '<p>甲</p><p>乙</p>', '空行 → 段落')
  ok(lite('- 甲\n* 乙') === '<ul><li>甲</li><li>乙</li></ul>', '行首 - / * → 无序列表')
  ok(lite('3. 甲\n4) 乙') === '<ol><li value="3">甲</li><li value="4">乙</li></ol>', '行首数字 → 有序列表(保原编号)')
  ok(lite('① 机制\n② 链路') === '<ol class="circ"><li><span class="mk">①</span>机制</li><li><span class="mk">②</span>链路</li></ol>',
    '行首 ①…⑩ → ol.circ,圈号留作标号')
  ok(lite('【2026-08-26 定稿】按 C 档来') === '<div class="tsec"><p>【2026-08-26 定稿】按 C 档来</p></div>',
    '【…】开头的段包进 .tsec(段前一条细线)')
  ok(lite('`**不是粗体**`') === '<p><code>**不是粗体**</code></p>', '反引号里的 ** 不当粗体(代码优先)')
  ok(lite('# 标题') === '<p># 标题</p>' && lite('[名](url)') === '<p>[名](url)</p>' && lite('| 甲 | 乙 |') === '<p>| 甲 | 乙 |</p>',
    '标题 / 链接 / 表格一律不认(定稿:只认列出的那几条)')
  ok(lite('') === '' && lite(null) === '' && lite(undefined) === '' && lite('   \n\n  ') === '', '空 / null / undefined / 纯空白 → 空串')

  // ---- XSS:先 esc 再认标记,三个方向都堵死 ----
  ok(lite('**<img src=x onerror=alert(1)>**') === '<p><b>&lt;img src=x onerror=alert(1)&gt;</b></p>', 'XSS:粗体里的 <img> 只剩转义文本')
  const xs = lite('`</' + 'script><script>alert(1)</' + 'script>`')
  ok(!/<\/?script/i.test(xs) && xs.includes('&lt;/script&gt;'), 'XSS:代码片段里的 </script> 逃不出 <script> 壳', xs)
  ok(lite('【<b>注入</b>】正文').includes('&lt;b&gt;注入&lt;/b&gt;'), 'XSS:小节标题里的 HTML 不认')
  ok(lite('**$&$\'$`**') === '<p><b>$&amp;$\'$`</b></p>', '$& / $\' / $` 不被 replace 的替换模式二次展开')
  ok(lite('看 ' + Z + '0' + Z + ' 与 `真代码`') === '<p>看 0 与 <code>真代码</code></p>', '正文里伪造的 NUL 占位符先被剔掉,顶不掉真代码片段')

  // ---- 折叠预览:按段落边界截 ----
  const pv = litePreview('a'.repeat(100) + '\n\n' + 'b'.repeat(500), 400)
  ok(pv.head === 'a'.repeat(100) && pv.rest === 502, '预览按段落边界截:只取第一段;rest = 原文字符数 − 预览字符数', JSON.stringify(pv))
  ok(litePreview('c'.repeat(3000), 400).rest === 0, '单段巨长文没有段落边界可切 → 不拆,留给高度折叠')
  ok(litePreview('a'.repeat(794) + '\n\n' + 'b'.repeat(81), 400).rest === 0,
    '首段自己就超 n:同样没有 ≤ n 的段落边界可切 → 不拆(否则预览到 2n 字,还把高度折叠一并让掉)')
  ok(litePreview('a'.repeat(400) + '\n\n' + 'b'.repeat(81), 400).rest === 83, '首段正好 n 字仍然切得动')
  ok(litePreview('短', 400).rest === 0 && litePreview('', 400).rest === 0, '短文本 / 空文本不折叠')

  // ---- gen 四拍:未配 → false 比 sha → true 验行为 → 关回比 sha ----
  const fx35 = mkFixture('fx35', { 's.html': demoHtml('s') })
  const cfgP = join(fx35.kb, 'kanban.config.json'), idxP = join(fx35.kb, 'index.html')
  const blP = join(fx35.kb, 'backlog-manifest.json'), decP = join(fx35.kb, 'decisions-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const LONG = '① 机制 **要紧**:看 `models.py:37`\n② 链路\n\n' + '正文'.repeat(200) + '\n\n【2026-08-26 更新】收口'
  const dec = rd(decP)
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: 't', question: 'q', decision: '就这么定', source: '用户 **口述**' }]
  wr(decP, dec)
  const bl = rd(blP)
  bl.tiers = { 1: '核心' }
  const LONGHEAD = 'x'.repeat(700) + '\n\n尾段' // 首段自己就超 400:没有 ≤ 400 的段落边界可切
  bl.items = [{ id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: 'c',
    problem: 'p', approach: LONG, note: '【2026-01-01】一行', area: 'x', source: 's' },
  { id: 'BL-2', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', title: 'd',
    problem: 'p', approach: LONGHEAD, area: 'x', source: 's' }]
  wr(blP, bl)
  runGen(NEW_SCRIPTS, fx35.kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(off.includes('<dd class="x">① 机制 **要紧**') && !off.includes('class="lite"'), '未配 richText:正文原样 esc,零 lite 标记')
  ok(off.includes('<p class="notes">') && !off.includes('class="detail"') && !off.includes('class="lsrc"'), '未配 richText:notes 仍是 <p>,无 detail / source 块')
  const cfg = rd(cfgP)
  cfg.richText = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx35.kb)
  ok(sha(idxP) === offSha, 'richText:false 与未配逐字节相同(冻结)')

  cfg.richText = true
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, fx35.kb)
  ok(r.status === 0, 'richText:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('<ol class="circ"><li><span class="mk">①</span>'), '圈号段渲染成 ol.circ')
  ok(on.includes('<b>要紧</b>') && on.includes('<code>models.py:37</code>'), '粗体与行内代码进了卡')
  ok(on.includes('<div class="tsec"><p>【2026-01-01】一行</p></div>'), '【日期】段包进 .tsec')
  ok(on.includes('<div class="lite lpre lclamp">') && on.includes('<div class="lite lfull" hidden>') &&
    /class="litemore" data-all="\d+">展开全文 · \d+ 字</.test(on), '超 400 字的字段烤成预览 + 全文两份 + 展开钮')
  ok(on.includes(`data-all="${LONG.length}">展开全文 · ${LONG.length} 字`) && !on.includes('data-rest'),
    '钮上的 N = 字段全长(预览被高度收掉之后,「还有 N 字」不再是真话)')
  ok(count(on, '<div class="lite lpre') === count(on, '<div class="lite lpre lclamp">'),
    '每个预览段都带 .lclamp —— 没有一份预览是不收高的')
  ok(on.includes('.lpre.lclamp { max-height: 3.3em; overflow: hidden; }') &&
    on.includes('.lcard .clamp { position: relative; max-height: 3.3em;'),
    '预览段与 clampScan 收到同一个 3.3em:两条折叠路径默认高度一致')
  ok(on.includes('<div class="notes"><div class="lite"><div class="tsec">'),
    '没超 400 字的字段照旧一份到底、不带 lclamp —— 收高交给 clampScan(两套折叠不叠加)')
  ok(on.includes("var pre = box.querySelector('.lpre'), full = box.querySelector('.lfull')") &&
    on.includes("btn.textContent = open ? '收起' : '展开全文 · ' + btn.getAttribute('data-all') + ' 字'"),
    '展开钮照旧换 hidden 两份,文案与 data-all 对齐')
  ok(count(on, '<div class="lite lpre lclamp">') === 1 && on.includes('<div class="lite"><p>' + 'x'.repeat(700)),
    '首段自己就超 400 的字段不烤预览:整篇一份,交给高度折叠 —— 与「整篇一段」同一种处置')
  ok(on.includes('<div class="notes">') && !on.includes('<p class="notes">'), 'notes 容器换成 <div>(<p> 里塞不进 <p>/<ul>,解析器会当场闭合)')
  ok(on.includes('dd.demonote, div.notes') && on.includes("if (el.querySelector('.lfull'))"), 'clampScan 认 div.notes,并给拆过两份的字段让路(两套折叠不叠加)')
  ok(on.includes('<dd class="lsrc"><span class="bbadge src"><p>用户 <b>口述</b></p></span></dd>'), '决策卡 source 补渲染成同款小徽章(0.12.0 前是死数据)')
  ok(on.includes('<dd class="decided"><div class="lite"><p>✓ 就这么定</p></div></dd>'), '结论行的 ✓ 落进第一段,不自成一行')
  ok(on.includes('<span class="bbadge src">s</span>'), 'backlog 自己的 source 芯片仍是纯 esc(它是一枚短标签,不是正文)')
  ok(on.includes('.lite ol.circ') && on.includes('.litemore {') && on.includes('.lpre.lclamp {') && on.includes('.detail > summary'), 'CSS 片段挂上尾链')
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((s) => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  const richSha = sha(idxP)

  // ---- detail 字段:加 → 撤回,回 richText:true 的基线(T26 模式)----
  bl.items[0].detail = '逐文件证据:`a.py:1`\n\n【2026-01-02】补'
  wr(blP, bl)
  runGen(NEW_SCRIPTS, fx35.kb)
  const withD = readFileSync(idxP, 'utf8')
  ok(/<details class="detail"><summary>查证细节<span class="n"> · \d+ 字<\/span><\/summary>/.test(withD), 'detail 渲染成默认折叠块,标题带字数')
  ok(withD.includes('<div class="dbody lite"><p>逐文件证据:<code>a.py:1</code></p>'), 'detail 正文也走 lite')
  delete bl.items[0].detail
  wr(blP, bl)
  runGen(NEW_SCRIPTS, fx35.kb)
  ok(sha(idxP) === richSha, '撤回 detail 字段后回到 richText:true 的基线')

  // ---- 守卫:>800 字且无 detail → 非阻断点名;有 detail / 关档都不吵 ----
  bl.items[0].approach = '正'.repeat(900)
  wr(blP, bl)
  runGen(NEW_SCRIPTS, fx35.kb)
  touch(idxP)
  const g1 = runStop(NEW_SCRIPTS, fx35.root)
  ok(g1.status === 0 && /最长:BL-1 的 approach/.test(g1.stdout), '超 800 字且无 detail → 一条非阻断 notice,指到最长的那张的字段', `${g1.status} ${g1.stdout.slice(0, 260)}`)
  ok(/1 张卡的正文字段超过 800 字/.test(g1.stdout), '总数只数点得着的卡', g1.stdout.slice(0, 260))
  ok(!/有 900 字/.test(g1.stdout) && !/- BL-1 的 approach/.test(g1.stdout),
    '一行到底:不报字数,也不铺逐卡清单(v0.15.7)', g1.stdout.slice(0, 260))
  ok(/⚠ 看板守卫:1 张卡的正文字段超过 800 字/.test(g1.stdout),
    '非阻断通知带 ⚠ 前缀(与其它 notice 同一形制;阻断的那几条才不带)', g1.stdout.slice(0, 260))

  // ---- 终态卡不点名(v0.15.6,TERMINAL 与 settle.mjs 同一份口径)----
  bl.items.push({ id: 'BL-9', status: 'done', priority: Object.keys(bl.priorities)[0], tier: '1', title: 'e',
    problem: 'p', approach: '收'.repeat(900), area: 'x', source: 's' })
  dec.entries.push({ id: 'D9', code: 'D9', status: 'live', date: '2026-01-01', title: 'u', question: '问'.repeat(1200), decision: '已落地' })
  wr(blP, bl)
  wr(decP, dec)
  runGen(NEW_SCRIPTS, fx35.kb)
  touch(idxP)
  const g1t = runStop(NEW_SCRIPTS, fx35.root)
  ok(g1t.status === 0 && !/BL-9/.test(g1t.stdout) && !/D9/.test(g1t.stdout),
    '终态卡(backlog done / 决策 live)超长而无 detail 也不点名 —— 收了的卡不会再改写', g1t.stdout.slice(0, 300))
  ok(/最长:BL-1 的 approach/.test(g1t.stdout), '同一轮里非终态的长正文卡照点不误 —— 最长指针落在它身上,而不是更长的那张终态卡')
  ok(/1 张卡的正文字段超过 800 字/.test(g1t.stdout), '总数也跟着跳过:两张终态卡不计入', g1t.stdout.slice(0, 300))
  dec.entries[1].status = 'closed'
  wr(decP, dec)
  runGen(NEW_SCRIPTS, fx35.kb)
  touch(idxP)
  const g1c = runStop(NEW_SCRIPTS, fx35.root)
  ok(!/D9/.test(g1c.stdout) && /1 张卡的正文字段超过 800 字/.test(g1c.stdout), 'closed 与 live 同样跳过(终态三值都认)', g1c.stdout.slice(0, 300))
  dec.entries[1].status = Object.keys(dec.statuses)[0] // 同一张卡改成非终态 → 立刻点得到名,证明跳过只由 status 决定
  wr(decP, dec)
  runGen(NEW_SCRIPTS, fx35.kb)
  touch(idxP)
  const g1n = runStop(NEW_SCRIPTS, fx35.root)
  ok(/最长:D9 的 question/.test(g1n.stdout) && /2 张卡的正文字段超过 800 字/.test(g1n.stdout),
    '把它改回非终态,同一张卡当场夺回最长指针,总数也涨回 2', g1n.stdout.slice(0, 300))
  bl.items.pop()
  dec.entries.pop()
  wr(blP, bl)
  wr(decP, dec)
  runGen(NEW_SCRIPTS, fx35.kb)

  bl.items[0].detail = '证据都在这儿'
  wr(blP, bl)
  runGen(NEW_SCRIPTS, fx35.kb)
  touch(idxP)
  const g2 = runStop(NEW_SCRIPTS, fx35.root)
  ok(g2.status === 0 && !/正文字段超过 800 字/.test(g2.stdout), '卡上有了 detail 就不再点名')
  delete bl.items[0].detail
  wr(blP, bl)
  cfg.richText = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx35.kb)
  touch(idxP)
  const g3 = runStop(NEW_SCRIPTS, fx35.root)
  ok(g3.status === 0 && !/正文字段超过 800 字/.test(g3.stdout), 'richText 关着时不做正文长度审计(detail 本就不渲染,催也白催)')

  // ---- 关回 + 撤字段:逐字节回到冻结基线 ----
  bl.items[0].approach = LONG
  wr(blP, bl)
  delete cfg.richText
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx35.kb)
  ok(sha(idxP) === offSha, 'richText 关回后与冻结基线逐字节相同')
}

// ============ T36 进度响应判定(纯函数穷举:settleOf / staleLink / dormantDate)============
console.log('T36 进度响应判定')
{
  const { KIND_TERMINAL, settleOf, staleLink, dormantDate } = await import(join(NEW_SCRIPTS, 'settle.mjs'))
  const REPO = 'o/r'
  const rel = new Map([
    [10, { number: 10, state: 'merged', mergedAt: '2026-08-19T01:00:00Z' }],
    [11, { number: 11, state: 'merged', mergedAt: '2026-08-22T01:00:00Z' }],
    [12, { number: 12, state: 'open', draft: false }],
    [13, { number: 13, state: 'open', draft: true }],
    [14, { number: 14, state: 'closed' }],
  ])
  const refs = (...ns) => ns.map((n) => ({ repo: REPO, num: n }))
  const kind = (status, ...ns) => settleOf({ status }, refs(...ns), rel, REPO)

  ok(kind('ready', 10).kind === 'settle', 'settle:唯一的 PR 合了,卡还 ready')
  ok(kind('ready', 10, 11).kind === 'settle', 'settle:两个 PR 都合了')
  ok(kind('done', 10, 11).kind === null, '都合了且卡已 done = 一致,不出芯片')
  ok(kind('live', 10).kind === null && kind('closed', 10).kind === null, '决策卡的终态 live / closed 同样算收过账')
  const part = kind('ready', 10, 12)
  ok(part.kind === null && part.merged === 1 && part.total === 2, '部分合并不算 settle(渲染层另出「1/2 已合」)', JSON.stringify(part))
  ok(kind('ready', 14).kind === null, '关掉未合的 PR 不是「已合」,不催收账')
  ok(kind('done', 12).kind === 'reopen', 'reopen:卡已 done,PR 还开着')
  ok(kind('done', 13).kind === 'reopen', 'reopen:草稿也算开着')
  ok(kind('live', 10, 12).kind === 'reopen', 'reopen:终态卡里只要有一个开着就算(哪怕别的合了)')
  ok(kind('ready', 12).kind === null, 'ready + PR 开着 = 正常的验收中,不是不一致')
  ok(kind('done', 14).kind === null, '终态 + 关掉未合 = 没什么可说的')
  ok(kind('ready').kind === null && kind('ready', 99).kind === null,
    '没挂 PR / 号没同步过 → 判不动就不判(缺数据不当「还开着」用)')
  ok(settleOf({ status: 'ready' }, [{ repo: 'x/y', num: 10 }], rel, REPO).kind === null, '跨仓 PR 的状态不在本仓 manifest 里,不参与判定')
  ok(KIND_TERMINAL.items === 'done' && KIND_TERMINAL.tasks === 'done' && KIND_TERMINAL.entries === 'live',
    '收账目标:backlog / 进度卡 done,决策卡 live(不是 closed)')

  // ---- stale-link:手写状态词 × 实际状态穷举 ----
  const L = (title, n, repo = REPO) => ({ title, href: `https://github.com/${repo}/pull/${n}` })
  ok(staleLink(L('PR#10(开而不合)', 10), rel, REPO).word === '开而不合', '「开而不合」遇上已合 → 过时')
  ok(staleLink(L('PR#10(待合)', 10), rel, REPO).real === 'merged', '「待合」遇上已合 → 过时,real 报实际')
  ok(staleLink(L('PR#12(已合并)', 12), rel, REPO).word === '已合并', '「已合并」遇上还开着 → 过时(长词先命中,不剩一个「并」字)')
  ok(staleLink(L('PR#14(已合)', 14), rel, REPO).real === 'closed', '「已合」遇上关掉未合 → 过时')
  ok(staleLink(L('PR#14(待合)', 14), rel, REPO) !== null, '「待合」遇上关掉未合 → 也过时(它再也合不了了)')
  ok(staleLink(L('PR#10(已合并)', 10), rel, REPO) === null, '说得对的不划:「已合并」+ 已合')
  ok(staleLink(L('PR#12(开而不合)', 12), rel, REPO) === null, '说得对的不划:「开而不合」+ 开着')
  ok(staleLink(L('PR#13(待合)', 13), rel, REPO) === null, '草稿算开着,「待合」没说错')
  ok(staleLink(L('PR#10 阶段二', 10), rel, REPO) === null, '标题里没有状态词 → 无所谓过不过时')
  ok(staleLink(L('PR#10(开而不合)', 10, 'x/y'), rel, REPO) === null, '外仓链接一律不认(号会撞)')
  ok(staleLink(L('PR#99(已合)', 99), rel, REPO) === null, '没同步过的号:不知道就不说')
  ok(staleLink({ title: '设计文档(已合)', href: 'refs/design.html' }, rel, REPO) === null, '不是 PR 链接的一概不碰')

  // ---- dormant:天数不在这儿算,只判「够不够格烤日期」 ----
  ok(dormantDate({ status: 'ready', date: '2026-01-02' }) === '2026-01-02', 'ready + 正经日期 → 烤这个日期')
  ok(dormantDate({ status: 'done', date: '2026-01-02' }) === '', '只有 ready 才谈沉睡')
  ok(dormantDate({ status: 'ready' }) === '' && dormantDate({ status: 'ready', date: '2026-01' }) === '', '没日期 / 日期写残 → 不判')
}

// ============ T37 进度响应渲染(芯片 / 链接状态后缀 / 沉睡 / 待收账段 / 守卫;缺 manifest 零差异)============
console.log('T37 进度响应渲染')
{
  const fx37 = mkFixture('fx37', { 's.html': demoHtml('s') })
  const cfgP = join(fx37.kb, 'kanban.config.json'), idxP = join(fx37.kb, 'index.html')
  const relP = join(fx37.kb, 'release-manifest.json')
  const mP = join(fx37.kb, 'manifest.json'), decP = join(fx37.kb, 'decisions-manifest.json'), blP = join(fx37.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  bl.tiers = { 1: '核心' }
  const item = (o) => ({ status: 'ready', priority: 'high', tier: '1', title: 't', problem: 'p', approach: 'a', area: 'x', source: 's', ...o })
  bl.items = [
    item({ id: 'BL-S', pr: 227 }), // 合了,卡还 ready → 待收账
    item({ id: 'BL-R', status: 'done', pr: 232 }), // 收了,PR 还开着 → 反向
    item({ id: 'BL-P', pr: [227, 226, 232] }), // 3 个里合了 2 个 → 2/3
    item({ id: 'BL-D', date: '2026-01-02' }), // ready、有日期、一个 PR 都没挂 → 烤沉睡日期
    item({ id: 'BL-N', date: '2026-01-02', pr: 232 }), // 挂了 PR 就不算沉睡(有人在推)
    item({ id: 'BL-L', pr: 999, links: [
      { title: 'PR#227 阶段二(开而不合)', href: 'https://github.com/o/r/pull/227' },
      { title: 'PR#226(已合并)', href: 'https://github.com/o/r/pull/226' },
      { title: 'PR#232(待合)', href: 'https://github.com/o/r/pull/232' },
      { title: '外仓 PR#227(开而不合)', href: 'https://github.com/x/y/pull/227' },
    ] }),
  ]
  dec.entries = [
    { id: 'D1', code: 'D1', status: 'decided', date: '2026-01-01', title: '决策甲', question: 'q', pr: 226 },
    { id: 'D2', code: 'D2', status: 'live', date: '2026-01-01', title: '决策乙', question: 'q', pr: 230 },
  ]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  runGen(NEW_SCRIPTS, fx37.kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('rspchip') && !off.includes('rspdorm') && !off.includes('class="stale"'), '没有 release-manifest:零芯片、零沉睡、零划线')

  wr(relP, REL_MANIFEST)
  const r = runGen(NEW_SCRIPTS, fx37.kb)
  ok(r.status === 0, 'release-manifest 在场 gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  const cardOf = (id) => { const i = on.indexOf(`id="${id}"`); return i < 0 ? '' : on.slice(i, on.indexOf('</article>', i)) }
  ok(cardOf('BL-S').includes('<span class="rspchip rsp-settle"') && cardOf('BL-S').includes('PR 已合 · 待收账'), 'settle 卡挂琥珀芯片「PR 已合 · 待收账」')
  ok(cardOf('BL-R').includes('<span class="rspchip rsp-reopen"') && cardOf('BL-R').includes('已收账但 PR 未合'), 'reopen 卡挂芯片「已收账但 PR 未合」')
  ok(/<span class="rspchip rsp-part"[^>]*>2\/3 已合<\/span>/.test(cardOf('BL-P')), '部分合并:「2/3 已合」,不算 settle', cardOf('BL-P').slice(0, 200))
  ok(!cardOf('BL-S').includes('rsp-part') && !cardOf('BL-R').includes('rsp-part'), 'settle / reopen 的卡不再叠一枚计数芯片')
  ok(cardOf('D1').includes('rsp-settle'), '决策卡 decided + PR 已合 → 同样待收账')
  ok(cardOf('D2').includes('rsp-reopen'), '决策卡 live + PR 开着 → 反向提示')
  ok(cardOf('BL-D').includes('<span class="rspdorm" data-dorm="2026-01-02" hidden></span>'), '沉睡:gen 只烤日期,天数留给浏览器')
  ok(!cardOf('BL-N').includes('rspdorm'), '挂了 PR 的 ready 卡不算沉睡')
  ok(on.includes("dayDiff(el.getAttribute('data-dorm'))") && on.includes('沉睡 ') && on.includes('d > 30'),
    '沉睡天数在浏览器算(阈值 30 天),gen 侧无 new Date()')
  ok(!/new Date\(\)/.test(on.split('<script>')[0]), 'gen 零时间:静态部分不含 new Date()')
  ok(cardOf('BL-L').includes('↗ PR#227 阶段二(<s class="stale">开而不合</s>)<span class="prst">已发 v0.0.1</span>'),
    '过时的手写状态词划掉 + 补真实状态', (cardOf('BL-L').match(/↗ PR#227[^<]*(<[^>]*>[^<]*){0,3}/) || [''])[0])
  ok(cardOf('BL-L').includes('↗ PR#226(已合并)<span class="prst">已合 08-22</span>')
    && cardOf('BL-L').includes('↗ PR#232(待合)<span class="prst">开着</span>'), '说得对的手写词不划,状态后缀照补')
  ok(cardOf('BL-L').includes('↗ 外仓 PR#227(开而不合)</a>'), '外仓链接原样不动(号会撞,不敢认)')

  // ---- 发布进度 tab 的「待收账」段 ----
  const cfg = rd(cfgP)
  cfg.releaseTab = true
  wr(cfgP, cfg)
  const r2 = runGen(NEW_SCRIPTS, fx37.kb)
  ok(r2.status === 0, 'releaseTab + 进度响应 gen exit 0', r2.stderr)
  const rel = readFileSync(idxP, 'utf8')
  ok(rel.includes('<p class="rspsh">待收账 · 2 张卡'), '待收账段:按卡去重计数(BL-S 与 D1)', (rel.match(/class="rspsh">[^<]*/) || [])[0])
  {
    const seg = rel.slice(rel.indexOf('class="rspsettle"'), rel.indexOf('class="relview"'))
    ok(seg.includes('>PR #227</a>') && seg.includes('href="#BL-S"'), '待收账按 PR 分组,组下挂卡')
    ok(seg.includes('>PR #226</a>') && seg.includes('href="#D1"'), '决策卡也进这一段')
    ok(!seg.includes('#BL-P') && !seg.includes('#BL-R'), '部分合并 / 反向的卡不进待收账')
  }
  { // 整壳编译:进度响应运行时与懒加载/暗夜/发布进度在同一块里
    const sc = rel.match(/<script>([\s\S]*?)<\/script>/g).map((s) => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  { // 一张 settle 都没有 → 整段不渲染(空段比没有更吵)
    const bl2 = rd(blP)
    for (const it of bl2.items) if (it.status === 'ready') it.status = 'done'
    wr(blP, bl2)
    const dec2 = rd(decP)
    dec2.entries[0].status = 'live'
    wr(decP, dec2)
    runGen(NEW_SCRIPTS, fx37.kb)
    ok(!readFileSync(idxP, 'utf8').includes('<div class="rspsettle">'), '没有待收账的卡 → 整段不渲染(CSS 片段还在,那是门控注入片的常态)')
    wr(blP, bl); wr(decP, dec)
  }

  // ---- 守卫:两条非阻断 notice ----
  delete cfg.releaseTab
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx37.kb)
  touch(idxP)
  const g = runStop(NEW_SCRIPTS, fx37.root)
  ok(g.status === 0 && /2 张卡的关联 PR 都已合并/.test(g.stdout) && /BL-S/.test(g.stdout) && /D1/.test(g.stdout),
    '守卫:待收账的卡号 + 总数(非阻断)', `${g.status} ${g.stdout.slice(0, 300)}`)
  ok(/2 张卡已收到终态,却还有关联 PR 开着/.test(g.stdout) && /BL-R/.test(g.stdout) && /D2/.test(g.stdout), '守卫:反向那条也点名')
  ok(!/"decision":\s*"block"/.test(g.stdout), '两条都不阻断收工')

  // ---- 撤掉 release-manifest:逐字节回到基线 ----
  rmSync(relP)
  runGen(NEW_SCRIPTS, fx37.kb)
  ok(sha(idxP) === offSha, '撤掉 release-manifest 后与无文件基线逐字节相同')
  touch(idxP)
  const g2 = runStop(NEW_SCRIPTS, fx37.root)
  ok(g2.status === 0 && !/待收账/.test(g2.stdout), '没有 release-manifest 时守卫这一段整个不跑')
}

// ============ T38 pr-sync --settle(假 gh;默认只打印,--write 只动两个字段)============
console.log('T38 pr-sync --settle')
{
  const fx38 = mkFixture('fx38', { 's.html': demoHtml('s') })
  const relP = join(fx38.kb, 'release-manifest.json')
  const mP = join(fx38.kb, 'manifest.json'), decP = join(fx38.kb, 'decisions-manifest.json'), blP = join(fx38.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr2 = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n') // 人手写的形制:2 空格 + 末尾换行
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  bl.tiers = { 1: '核心' }
  bl.items = [
    { id: 'BL-1', status: 'ready', priority: 'high', tier: '1', title: '甲', problem: 'p', approach: 'a', area: 'x', source: 's', note: '【2026-07-01】立卡', pr: 11 },
    { id: 'BL-2', status: 'done', priority: 'high', tier: '1', title: '乙', problem: 'p', approach: 'a', area: 'x', source: 's', pr: 12 },
    { id: 'BL-3', status: 'ready', priority: 'high', tier: '1', title: '丙', problem: 'p', approach: 'a', area: 'x', source: 's', pr: 10 },
  ]
  dec.entries = [{ id: 'D1', code: 'D1', status: 'decided', date: '2026-01-01', title: '决策甲', question: 'q', pr: 10 }]
  wr2(mP, mm); wr2(decP, dec); wr2(blP, bl)
  wr2(relP, { stages: REL_MANIFEST.stages, releases: [], prs: [], syncedAt: null })
  const ghDir = join(WORK, 'fakegh38')
  mkdirSync(ghDir, { recursive: true })
  writeFileSync(join(ghDir, 'gh'), `#!/bin/sh
case "$1 $2" in
"pr list") echo '[{"number":10,"title":"丙","state":"MERGED","isDraft":false,"baseRefName":"main","headRefName":"feat/c","url":"https://github.com/o/r/pull/10","createdAt":"2026-07-10T01:00:00Z","mergedAt":"2026-07-12T01:00:00Z","closedAt":"2026-07-12T01:00:00Z"},
 {"number":11,"title":"甲","state":"MERGED","isDraft":false,"baseRefName":"main","headRefName":"feat/a","url":"https://github.com/o/r/pull/11","createdAt":"2026-07-18T01:00:00Z","mergedAt":"2026-07-19T01:00:00Z","closedAt":"2026-07-19T01:00:00Z"},
 {"number":12,"title":"乙","state":"OPEN","isDraft":false,"baseRefName":"main","headRefName":"feat/b","url":"https://github.com/o/r/pull/12","createdAt":"2026-08-20T01:00:00Z","mergedAt":null,"closedAt":null}]' ;;
"release list") echo '[]' ;;
esac
`)
  chmodSync(join(ghDir, 'gh'), 0o755)
  const runSync = (extra) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'pr-sync.mjs'), '--dir', fx38.kb, ...extra],
    { encoding: 'utf8', env: { ...process.env, PATH: ghDir } })
  const blBefore = sha(blP), decBefore = sha(decP), relBefore = sha(relP)

  const rDry = runSync(['--settle', '--dry-run'])
  ok(rDry.status === 0 && sha(blP) === blBefore && sha(decP) === decBefore && sha(relP) === relBefore,
    '--settle --dry-run:一个文件都不写(连 release-manifest 也不写)', `${rDry.status} ${rDry.stderr.slice(0, 160)}`)
  ok(/BL-1\s+ready → done\s+PR #11/.test(rDry.stdout) && /D1\s+decided → live\s+PR #10/.test(rDry.stdout),
    '清单列出卡 → 建议 status(决策卡收到 live)', rDry.stdout)
  ok(/BL-3\s+ready → done\s+PR #10/.test(rDry.stdout) && !/BL-2/.test(rDry.stdout),
    '同一个 PR 可以带出几张卡;PR 还开着的卡不进清单')

  const rList = runSync(['--settle'])
  ok(rList.status === 0 && sha(blP) === blBefore && sha(decP) === decBefore && sha(relP) !== relBefore,
    '--settle 不加 --write:同步照写 release-manifest,卡的 manifest 一字不动')
  ok(/--write/.test(rList.stdout), '干跑输出里点明「加 --write 才收账」')
  const rNoSettle = runSync(['--write'])
  ok(rNoSettle.status === 0 && sha(blP) === blBefore && !/收账|settle/.test(rNoSettle.stdout),
    '单给 --write 不作数(它是 --settle 的修饰)')

  const blText = readFileSync(blP, 'utf8'), decText = readFileSync(decP, 'utf8')
  const rW = runSync(['--settle', '--write'])
  ok(rW.status === 0, '--settle --write exit 0', `${rW.stdout}${rW.stderr}`)
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const want = JSON.parse(blText)
  want.items[0].status = 'done'
  want.items[0].note = `【2026-07-01】立卡\n\n【${today} 收账】PR#11 已合(自动)`
  want.items[2].status = 'done'
  want.items[2].note = `【${today} 收账】PR#10 已合(自动)`
  ok(readFileSync(blP, 'utf8') === JSON.stringify(want, null, 2) + '\n',
    '--write 只改目标卡的 status 与 note 尾行,其它字节不动、末尾换行不变')
  const decWant = JSON.parse(decText)
  decWant.entries[0].status = 'live'
  ok(readFileSync(decP, 'utf8') === JSON.stringify(decWant, null, 2) + '\n',
    '决策卡只改 status:gen 不渲染决策卡的 note,不硬塞一个没人读的字段')
  ok(rd(blP).items[1].status === 'done' && !rd(blP).items[1].note, 'PR 还开着的卡没被碰')
  const rAgain = runSync(['--settle'])
  ok(/没有待收账|nothing to settle/.test(rAgain.stdout), '收完账再跑:清单空了')

  // ---- 排版不是标准 2 空格 → 整份跳过(重排会动到别人手写的字节)----
  const odd = JSON.stringify(JSON.parse(readFileSync(blP, 'utf8')), null, 4) + '\n'
  writeFileSync(blP, odd)
  const b2 = rd(blP)
  b2.items[0].status = 'ready'
  writeFileSync(blP, JSON.stringify(b2, null, 4) + '\n')
  const oddSha = sha(blP)
  const rOdd = runSync(['--settle', '--write'])
  ok(rOdd.status === 0 && sha(blP) === oddSha && /排版|formatted/.test(rOdd.stderr),
    '非标准排版的 manifest 拒绝改写,原文一字不动', `${rOdd.status} ${rOdd.stderr.slice(0, 160)}`)
}

// ============ T39 done 卡归档(opt-in;未配/false = 字节冻结,开 = 独立 pane + lazy 第三个 part)============
console.log('T39 done 卡归档')
{
  const fx39 = mkFixture('fx39', { 's.html': demoHtml('s') })
  const cfgP = join(fx39.kb, 'kanban.config.json')
  const idxP = join(fx39.kb, 'index.html')
  const blP = join(fx39.kb, 'backlog-manifest.json')
  const bl = JSON.parse(readFileSync(blP, 'utf8'))
  bl.tiers = { 1: '核心' } // 模板词表为空,补一档供卡引用
  bl.items = [
    { id: 'BL-1', status: 'ready', priority: 'high', tier: '1', date: '2026-02-01', title: '待办甲' },
    { id: 'BL-2', status: 'deferred', priority: 'med', tier: '1', date: '2026-02-02', title: '推后乙' },
    { id: 'BL-3', status: 'done', priority: 'low', tier: '1', date: '2026-01-03', title: '旧账丙' },
    { id: 'BL-4', status: 'done', priority: 'low', tier: '1', date: '2026-01-04', title: '旧账丁' },
  ]
  writeFileSync(blP, JSON.stringify(bl))
  // pane 切片:pane 里嵌着 <section class="group">,不能按 </section> 切;按下一个 pane 的锚点切
  const slice = (html, from, to) => {
    const i = html.indexOf(`id="pane-${from}"`)
    const j = to ? html.indexOf(`id="pane-${to}"`) : html.length
    return i < 0 ? '' : html.slice(i, j > i ? j : html.length)
  }
  runGen(NEW_SCRIPTS, fx39.kb)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('pane-archive') && off.includes('Backlog · 4'), '未配 backlogArchive:无归档 pane,Backlog 徽章 = 全部卡')
  ok(slice(off, 'backlog', 'docs').includes('id="BL-3"'), '未配时 done 卡照旧住在 Backlog')
  const offSha = sha(idxP)
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.backlogArchive = false
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx39.kb)
  ok(sha(idxP) === offSha, 'backlogArchive:false 与未配逐字节相同(冻结)')
  cfg.backlogArchive = true
  writeFileSync(cfgP, JSON.stringify(cfg))
  const r = runGen(NEW_SCRIPTS, fx39.kb)
  ok(r.status === 0, 'backlogArchive:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('data-pane="archive"') && on.includes('归档 · 2'), '归档 tab 在场,徽章 = done 卡数')
  ok(on.indexOf('data-pane="archive"') > on.indexOf('data-pane="docs"'), '归档 tab 排在文档库之后(tab 条最末)')
  ok(on.includes('Backlog · 2'), 'Backlog 徽章 = 非 done 数')
  const blPane = slice(on, 'backlog', 'docs'), arPane = slice(on, 'archive')
  ok(blPane.includes('id="BL-1"') && blPane.includes('id="BL-2"'), 'Backlog 留下 ready 与 deferred(搁置不是完成)')
  ok(!blPane.includes('id="BL-3"') && !blPane.includes('id="BL-4"'), 'Backlog 不再列 done 卡')
  ok(arPane.includes('id="BL-3"') && arPane.includes('id="BL-4"'), '归档 pane 收下两张 done 卡')
  ok(arPane.indexOf('id="BL-4"') < arPane.indexOf('id="BL-3"'), '归档顺序仍是日期新→旧(与 Backlog 同一把尺)')
  {
    const arH1 = arPane.match(/<h1>([\s\S]*?)<\/h1>/)
    ok(!!arH1 && !arH1[1].includes('Backlog') && arH1[1].includes('归档'), '归档 h1 不含 Backlog:归档了的卡就不叫 Backlog 了')
  }
  ok(!blPane.includes('data-k="done"'), 'Backlog 状态筛选芯片去掉 done')
  ok(on.includes(", 'archive'])") && on.includes('#pane-archive .lcard'), '归档进 PANES(深链 #archive)+ 时间筛选选择器')
  ok(on.includes("pane.id === 'pane-archive'"), '线别筛空归档时组头一并收起')
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/)
    let compiled = true
    try { new Function(sc[1]) } catch (e) { compiled = false }
    ok(compiled, 'ON 整壳内联 JS 可编译(new Function 不抛)')
  }
  // ---- lazyTabs 同开:归档 = 第三个 part ----
  cfg.lazyTabs = true
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx39.kb)
  const lz = readFileSync(idxP, 'utf8')
  const partA = readFileSync(join(fx39.kb, 'parts/archive.html'), 'utf8')
  ok(partA.includes('id="BL-3"') && partA.includes('id="BL-4"'), 'parts/archive.html 落盘且含归档卡正文')
  ok(!lz.includes('id="BL-3"') && !lz.includes('id="BL-4"'), '壳 index 不再含归档卡正文')
  ok(lz.includes('"BL-3":"archive"') && lz.includes('"BL-1":"backlog"'), 'LAZY_PANE_OF:归档卡改判到 archive part(深链跨 part)')
  {
    const bd = lz.match(/archive: (\d+)/)
    ok(bd && Number(bd[1]) === Buffer.byteLength(partA, 'utf8'), 'LAZY_BYTES.archive 与 parts 实际字节一致')
  }
  {
    const sc = lz.match(/<script>([\s\S]*?)<\/script>/)
    let compiled = true
    try { new Function(sc[1]) } catch (e) { compiled = false }
    ok(compiled, 'lazy + 归档同开的壳 JS 可编译')
  }
  // ---- 守卫的缺件自愈认第三个 part:archive.html 被删掉也要重跑 ----
  // 深链 #BL-3(已归档)与「归档」tab 都只活在这个 part 里;index 是新的,守卫不重跑就永远补不回来。
  for (const part of ['decisions.html', 'backlog.html', 'archive.html']) {
    const pp = join(fx39.kb, 'parts', part)
    touch(idxP) // index 是最新的 —— 只有「缺件」这一条能触发重跑,新鲜度那条不许帮忙
    rmSync(pp)
    const rs = runStop(NEW_SCRIPTS, fx39.root)
    ok(rs.status === 0 && existsSync(pp), `守卫发现 parts/${part} 缺件 → 重跑 gen 补回(exit ${rs.status})`, rs.stderr)
  }
  // ---- 只关归档、lazy 还开着:第三个 part 的陈迹清掉(壳里已无入口)----
  cfg.backlogArchive = false
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx39.kb)
  ok(!existsSync(join(fx39.kb, 'parts/archive.html')) && existsSync(join(fx39.kb, 'parts/backlog.html')),
    '关掉归档:parts/archive.html 清除,另两个 part 不受影响')
  // ---- 全关回:parts 目录连同归档一起清干净,index 回基线 ----
  cfg.lazyTabs = false
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx39.kb)
  ok(!existsSync(join(fx39.kb, 'parts')), '关回后 parts/ 目录清除(清理白名单认得 archive.html)')
  ok(sha(idxP) === offSha, '关回后 index 与冻结基线逐字节相同')
}

// ============ T40 积压提醒 wip(对象即开;三档文案 + 守卫 notice;未配 = 字节冻结)============
console.log('T40 积压提醒 wip')
{
  const fx40 = mkFixture('fx40', { 's.html': demoHtml('s') })
  const cfgP = join(fx40.kb, 'kanban.config.json')
  const idxP = join(fx40.kb, 'index.html')
  const blP = join(fx40.kb, 'backlog-manifest.json')
  const bl = JSON.parse(readFileSync(blP, 'utf8'))
  bl.tiers = { 1: '核心' }
  bl.items = [
    { id: 'BL-1', status: 'ready', priority: 'high', tier: '1', date: '2026-02-01', title: '甲' },
    { id: 'BL-2', status: 'ready', priority: 'high', tier: '1', date: '2026-02-02', title: '乙' },
    { id: 'BL-3', status: 'ready', priority: 'high', tier: '1', date: '2026-02-03', title: '丙' },
    { id: 'BL-4', status: 'blocked', priority: 'low', tier: '1', date: '2026-02-04', title: '丁' },
    { id: 'BL-5', status: 'deferred', priority: 'low', tier: '1', date: '2026-02-05', title: '戊' },
  ]
  writeFileSync(blP, JSON.stringify(bl))
  runGen(NEW_SCRIPTS, fx40.kb)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('wipbar') && !off.includes('wip-soft'), '未配 wip:无横幅、无琥珀点')
  const offSha = sha(idxP)
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  const gen = (wip) => { cfg.wip = wip; writeFileSync(cfgP, JSON.stringify(cfg)); const rr = runGen(NEW_SCRIPTS, fx40.kb); return { rr, html: readFileSync(idxP, 'utf8') } }
  { // 空对象即开,阈值走缺省 10 / 20 —— 3 张 ready 谁也没超
    const { rr, html } = gen({})
    ok(rr.status === 0 && html.includes('id="wipbar"') && html.includes('id="wipbar" hidden'), '空对象即开;缺省 10/20 下 3 张 ready 不出横幅', rr.stderr)
    ok(!html.includes('class="tab wip-'), '未超 soft:Backlog tab 不带点')
    ok(html.includes('wipN > 20 ?') && html.includes('wipN > 10 ?'), '缺省阈值 10/20 烤进运行期重算')
  }
  { // 超 soft:灰条 + 琥珀点
    const { html } = gen({ soft: 2, hard: 10 })
    ok(html.includes('可做的卡 3 张 · 已超 2'), '超 soft:灰条文案')
    ok(html.includes('<div class="wipbar wip-soft" id="wipbar">'), '超 soft:横幅带 wip-soft 且不 hidden')
    ok(html.includes('class="tab wip-soft" data-pane="backlog"'), '超 soft:Backlog tab 带琥珀点')
  }
  { // 超 hard:红横幅 + 红点
    const { html } = gen({ soft: 1, hard: 2 })
    ok(html.includes('可做的卡 3 张 · 超过 2 —— 先清一些再立新卡'), '超 hard:红横幅文案')
    ok(html.includes('class="tab wip-hard" data-pane="backlog"'), '超 hard:Backlog tab 带红点')
    ok(html.includes('.wipbar.wip-hard'), '红档 CSS 随开关注入')
    const sc = html.match(/<script>([\s\S]*?)<\/script>/)
    let compiled = true
    try { new Function(sc[1]) } catch (e) { compiled = false }
    ok(compiled, 'wip 开档整壳内联 JS 可编译')
    // 守卫:总 ready 超 hard → 一条非阻断 notice
    const r = runStop(NEW_SCRIPTS, fx40.root)
    ok(r.status === 0, '积压审计不阻断收工(exit 0)', `${r.status} ${r.stderr.slice(0, 200)}`)
    ok(r.stdout.includes('ready)的卡有 3 张') && r.stdout.includes('config.wip.hard = 2'), '守卫点名 ready 数与 hard 阈值')
  }
  { // 线别/时间筛选下横幅要给两个数:当前筛选可见数 + 全板数(守卫那条 notice 用的正是全板数)
    const { html } = gen({ soft: 1, hard: 9 })
    const lines = html.split('\n')
    const at = lines.findIndex((l) => l.includes('const wipAll = wipN ==='))
    ok(at > 0, '横幅重算里烤进了全板数那一句')
    const run = new Function('wipN', 'wipLv', 'wipEl', lines.slice(at, at + 3).join('\n') + '\nreturn wipEl.textContent')
    ok(run(3, 'soft', {}) === '可做的卡 3 张 · 已超 1', '没筛掉任何卡:文案与从前一字不差')
    ok(run(2, 'soft', {}) === '可做的卡 2 张(全板 3) · 已超 1', '筛掉一部分:可见数之外补一段全板数')
    ok(run(2, 'hard', {}) === '可做的卡 2 张(全板 3) · 超过 9 —— 先清一些再立新卡', '红档同样两个数')
    ok(run(3, '', {}) === '', '没超阈值仍是空串(横幅自己 hidden)')
  }
  { // 没超 hard 就不该有 notice
    gen({ soft: 1, hard: 9 })
    touch(join(fx40.kb, 'index.html'))
    const r = runStop(NEW_SCRIPTS, fx40.root)
    ok(!r.stdout.includes('config.wip.hard'), '没超 hard:守卫一声不吭')
  }
  // 撤掉 wip → 回冻结基线
  delete cfg.wip
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx40.kb)
  ok(sha(idxP) === offSha, '撤掉 wip 后与未配基线逐字节相同')
}

// ============ T41 时间线重做:几何纯函数穷举 + 带的烤入 + 视图切换 ============
console.log('T41 时间线重做')
{
  const { relAxis, relTicks, relBar, relPack, relGrid, relBandH, relWindow,
    relRegime, relSqSize, relChipW, relGridBig, relGridChip, relPackChip, relCaps, relChipPitch, CHIP_GAP } = await import(join(NEW_SCRIPTS, 'relgeom.mjs'))
  const O = { lbl: 200, base: 14, slot: 12, quiet: 5, lanes: 6, row: 13, head: 30, sub: 14, pad: 6, min: 10, gap: 3 }
  const mkDays = (from, n) => {
    const out = [], t = Date.parse(from + 'T00:00:00Z')
    for (let i = 0; i < n; i++) out.push(new Date(t + i * 864e5).toISOString().slice(0, 10))
    return out
  }
  { // 轴:安静日 quiet,有 PR 的日至少 base,挤不下按 ceil(n / lanes) 格加宽
    const days = mkDays('2026-08-01', 5)
    const ax = relAxis(days, { '2026-08-02': 1, '2026-08-03': 6, '2026-08-04': 7, '2026-08-05': 41 }, O)
    ok(ax.w['2026-08-01'] === 5, '安静日 = quiet 5px')
    ok(ax.w['2026-08-02'] === 14 && ax.w['2026-08-03'] === 14, '1~6 个 PR 的日子 = base 14px(ceil(6/6)*12 撑不过 base)')
    ok(ax.w['2026-08-04'] === 24, '7 个 PR → ceil(7/6)*12 = 24px')
    ok(ax.w['2026-08-05'] === 84, '41 个 PR → ceil(41/6)*12 = 84px(横向撑开,不再往下堆)')
    ok(ax.x['2026-08-01'] === 200 && ax.x['2026-08-02'] === 205 && ax.x['2026-08-03'] === 219, 'x 是宽度的前缀和,从左栏宽起算')
    ok(ax.W === 200 + 5 + 14 + 14 + 24 + 84 && ax.t0 === days[0] && ax.t1 === days[4], '总宽 = 左栏 + 各日宽之和')
    ok(relAxis(days, {}, O).W === 200 + 25, '一个 PR 都没有:全是安静日')
  }
  { // 轴按这一格的实宽拉满(v0.15.10):短窗口 = 放大,不是把轴截短
    const at = (d) => new Date(d + 'T10:00:00')
    const now = at('2026-09-01') // 周二 → 本周 = 2 天
    const los = [Date.parse('2026-07-01T00:00:00Z')]
    const counts = { '2026-08-28': 7, '2026-08-31': 41, '2026-09-01': 1 }
    const FIT = 1680 // 容器 1880 − 左栏 200
    const tot = (ax, days) => days.reduce((a, d) => a + ax.w[d], 0)
    for (const k of ['30', '14', 'week', '1']) {
      const days = relWindow(k, now, los)
      const ax = relAxis(days, counts, O, FIT)
      const last = days[days.length - 1]
      ok(tot(ax, days) === FIT && ax.W === O.lbl + FIT, `「${k}」窗:各日宽之和正好 = 轨道宽 ${FIT}(轴填满整格,不再只画左边一截)`, '和=' + tot(ax, days))
      ok(days.every((d) => ax.w[d] > 0 && Number.isFinite(ax.x[d])), `「${k}」窗:没有零宽 / NaN 的日子`)
      ok(days.every((d, i) => i === 0 || ax.x[d] === ax.x[days[i - 1]] + ax.w[days[i - 1]]),
        `「${k}」窗:x 仍是宽度的前缀和(刻度 / 条 / 方块 / 竖线全从这一份取,没有留在旧刻度上的)`)
      ok(ax.x[days[0]] === O.lbl && ax.x[last] + ax.w[last] === O.lbl + FIT, `「${k}」窗:首日贴左栏、末日贴右沿`)
      ok(relTicks(days, ax, {}, 48).every((t) => Number.isFinite(t.x) && t.x >= O.lbl && t.x <= O.lbl + FIT), `「${k}」窗:刻度也在放大后的轴上`)
    }
    { // 缩放不是重排:忙 / 安静的相对宽窄一比一保住
      const days = relWindow('30', now, los)
      const nat = relAxis(days, counts, O), fit = relAxis(days, counts, O, FIT)
      const ratio = (ax) => ax.w['2026-08-31'] / ax.w['2026-08-28']
      ok(Math.abs(ratio(fit) - ratio(nat)) < 0.02, `忙日 : 次忙日 的宽度比缩放前后一致(${ratio(nat).toFixed(2)} → ${ratio(fit).toFixed(2)})`)
      ok(fit.w['2026-08-31'] > fit.w['2026-08-28'] && fit.w['2026-08-28'] > fit.w['2026-08-30'],
        '放大后最忙的还是最宽、安静的还是最窄(84 : 24 : 5 这三档的次序不变)')
      ok(fit.w['2026-08-30'] > nat.w['2026-08-30'] && nat.W < O.lbl + FIT, '安静日也跟着放大(自然宽本来只有轨道的一小截)')
    }
    { // 自然宽已经超过这一格:一个像素都不动 —— 由外层 overflow-x 横向滚(全时段在窄屏上照旧)
      const days = relWindow('all', now, [Date.parse('2026-01-05T00:00:00Z')])
      const nat = relAxis(days, counts, O), narrow = relAxis(days, counts, O, 300)
      ok(narrow.W === nat.W && days.every((d) => narrow.w[d] === nat.w[d]), '装不下就照旧交出自然宽(压缩会把安静日压成 0 宽)', 'W=' + narrow.W)
      ok(narrow.W > 300 + O.lbl, '轴比这一格宽 → 横向滚,这条没变', narrow.W + ' > ' + (300 + O.lbl))
      ok(relAxis(days, counts, O, nat.W - O.lbl).W === nat.W, '不多不少正好装下:也不动')
    }
    { // 量不到就退回自然宽:pane 藏着时 clientWidth = 0(fit 为负),不许塌成 0 宽或 NaN
      const days = relWindow('14', now, los)
      const w0 = JSON.stringify(relAxis(days, counts, O).w)
      ok(JSON.stringify(relAxis(days, counts, O, 0 - O.lbl).w) === w0, 'pane 还藏着量出 0:退回自然宽')
      ok(JSON.stringify(relAxis(days, counts, O, NaN).w) === w0, 'fit 是 NaN:退回自然宽(不是满轴 NaN)')
      ok(JSON.stringify(relAxis(days, counts, O, undefined).w) === w0, '不传 fit:与 0.15.9 逐格相同(老调用点不受影响)')
    }
    { // 当日那档:一天就是整条轨道,方块照旧按号横排在这一天的格子里
      const days = relWindow('1', now, los)
      const ax = relAxis(days, { '2026-09-01': 13 }, O, FIT)
      ok(days.length === 1 && ax.x[days[0]] === O.lbl && ax.w[days[0]] === FIT, '当日:这一天占满整条轨道')
      const arr = []
      for (let i = 1; i <= 13; i++) arr.push({ n: i })
      const g = relGrid({ '2026-09-01': arr }, ax, O)
      ok(g.bars.length === 13 && g.used === 6, '13 个方块一个不丢,泳道仍封顶 6 条')
      ok(g.bars.every((b) => Number.isFinite(b.x) && b.w > 0 && b.x >= O.lbl && b.x + b.w <= O.lbl + FIT), '方块全落在轨道内,x / w 都是有限正数')
      ok(g.bars.filter((b) => b.n === 7)[0].x === O.lbl + O.slot, '第 7 个换到第二列:方块按号横排的间距仍是 slot,不随轴一起拉长')
      const b = relBar(ax, days[0], days[0], O.min)
      ok(b.x0 === O.lbl && b.w === FIT - 1, '落在这一天的跨天条 = 整条轨道宽(不是 0 宽,也不是负宽)')
    }
  }
  { // 刻度:非线性轴上不许压字 —— 相邻两个「写了字」的标签必须 ≥ min px
    const days = mkDays('2026-06-29', 40) // 06-29 是周一
    const counts = {}
    for (const d of days) counts[d] = 0
    counts['2026-07-14'] = 41 // 制造一段很宽的忙日
    const ax = relAxis(days, counts, O)
    const ticks = relTicks(days, ax, { '2026-07-01': 'mo', '2026-07-14': 'tag' }, 48)
    const lab = ticks.filter((t) => t.txt)
    let minGap = Infinity
    for (let i = 1; i < lab.length; i++) minGap = Math.min(minGap, lab[i].x - lab[i - 1].x)
    ok(ticks.length === 8, `候选 = 6 个周一 + 月初 + tag(实际 ${ticks.length})`)
    ok(minGap >= 48, `相邻标签最小间距 ${minGap}px ≥ 48px(0.12.0 的等间隔取样正是栽在这里)`)
    ok(ticks.every((t) => t.k !== 'wk' || t.d === '2026-06-29' || new Date(t.d + 'T00:00:00Z').getUTCDay() === 1), '普通候选只取周一')
    ok(lab.some((t) => t.d === '2026-07-01') && lab.some((t) => t.d === '2026-07-14'), '月初与 tag 日一定写得上字')
    ok(ticks.some((t) => !t.txt), '挤不下的候选退成短刻度,不是不画')
    { // tag 挤掉前一个普通标签:06-29 与 06-30(tag)只差 5px,写字的只能是 tag 那个
      const d2 = mkDays('2026-06-29', 3)
      const t2 = relTicks(d2, relAxis(d2, {}, O), { '2026-06-30': 'tag' }, 48)
      ok(t2.length === 2 && !t2[0].txt && t2[1].txt, 'tag 把挡路的周一标签挤掉(自己写字)')
    }
    { // 两个优先刻度贴得太近:也不许压字,后一个退成短刻度
      const d3 = mkDays('2026-07-01', 3)
      const t3 = relTicks(d3, relAxis(d3, {}, O), { '2026-07-01': 'mo', '2026-07-02': 'tag' }, 48)
      ok(t3[0].txt && !t3[1].txt, '两个优先刻度贴太近也不压字(48px 这条线不破)')
    }
  }
  { // 条的几何 + 泳道打包:打包与绘制共用同一份 relBar
    const days = mkDays('2026-08-01', 10)
    const ax = relAxis(days, {}, O)
    ok(relBar(ax, '2026-07-01', '2026-07-20', 10) === null, '整段落在窗口左边:不画')
    ok(relBar(ax, '2026-08-01', '2026-08-01', 10).w === 10, '当天开当天合:退到 min 宽')
    ok(relBar(ax, '2026-08-01', '2026-08-03', 10).x0 === 200 && relBar(ax, '2026-08-01', '2026-08-03', 10).w === 14, '跨三天 = 3×5 − 1')
    ok(relBar(ax, '2026-07-20', '2026-08-02', 10).x0 === 200, '左边越界的截到窗口左沿')
    // 表头那句「窗口内 N」数的必须是「画不画得出来」,而不是锚点日落没落在窗口里 —— 判据只此一条
    for (const [s0, e0] of [['2026-07-01', '2026-07-20'], ['2026-07-20', '2026-08-02'], ['2026-08-01', '2026-08-03'],
      ['2026-08-10', '2026-08-10'], ['2026-08-11', '2026-08-20'], ['2026-07-01', '2026-08-20']]) {
      ok((relBar(ax, s0, e0, 10) !== null) === (e0 >= ax.t0 && s0 <= ax.t1),
        `画得出来 ⇔ 跨度与窗口有交集(${s0}→${e0})`, `${relBar(ax, s0, e0, 10) !== null} vs ${e0 >= ax.t0 && s0 <= ax.t1}`)
    }
    const items = [
      { n: 1, s: '2026-08-01', e: '2026-08-02' },
      { n: 2, s: '2026-08-01', e: '2026-08-05' },
      { n: 3, s: '2026-08-06', e: '2026-08-08' }, // 与 1 不重叠 → 回到第 0 条
    ]
    const p = relPack(items, ax, O)
    ok(p.used === 2, `不重叠的排回同一条泳道(用了 ${p.used} 条)`)
    ok(p.bars.filter((b) => b.n === 3)[0].lane === 0, '3 号回到第 0 条')
    ok(p.bars.every((b) => b.x === relBar(ax, items.filter((i) => i.n === b.n)[0].s, items.filter((i) => i.n === b.n)[0].e, O.min).x0),
      '打包用的 x 与画条用的 x 是同一份(estimate/real 两套是上一版撞车的根)')
    { // 泳道封顶:20 条全重叠的 PR 也只占 6 条泳道 —— 展开后的高度与 PR 数无关
      const many = []
      for (let i = 1; i <= 20; i++) many.push({ n: i, s: '2026-08-01', e: '2026-08-09' })
      const pm = relPack(many, ax, O)
      ok(pm.used === O.lanes && pm.bars.length === 20, `20 条全重叠 → 封顶 ${pm.used} 条泳道,一条都没丢`)
      ok(pm.bars.every((b) => b.lane < O.lanes), '没有一条越过泳道上限')
    }
  }
  { // 当天开当天合:按号横排,不再竖着堆
    const days = mkDays('2026-08-01', 3)
    const ax = relAxis(days, { '2026-08-02': 13 }, O) // 13 个 → 宽 ceil(13/6)*12 = 36 → 3 列
    const arr = []
    for (let i = 1; i <= 13; i++) arr.push({ n: i })
    const g = relGrid({ '2026-08-02': arr, '2026-07-01': [{ n: 99 }] }, ax, O)
    ok(g.bars.length === 13, '窗口外的那天整天跳过')
    ok(g.used === 6, '一天最多 6 条泳道')
    ok(g.bars.filter((b) => b.n === 7)[0].lane === 0 && g.bars.filter((b) => b.n === 7)[0].x === ax.x['2026-08-02'] + 12,
      '第 7 个换到第二列、回到第 0 条泳道(横向用起来)')
    ok(g.bars.every((b) => b.x + b.w <= ax.x['2026-08-02'] + ax.w['2026-08-02'] + 12), '列数由轴宽给足,不会溢出当天的格子')
  }
  { // 带高:折叠只有带头;展开有上界
    ok(relBandH(0, 0, O, false) === 30 && relBandH(6, 6, O, false) === 30, '折叠 = 带头 30px,与 PR 数无关')
    ok(relBandH(0, 0, O, true) === 36, '展开但两组都空:带头 + 底衬')
    ok(relBandH(6, 6, O, true) === 224, '展开的上界 = 30 + 2×(14 + 6×13 + 2) + 6 = 224px')
    ok(relBandH(6, 6, O, true) * 1 + 5 * 30 + 26 < 600, '六条带里展开最深的一条,总高仍 < 600px')
    ok(6 * 30 + 26 < 220, '六条带全折叠 + 轴 = 206px < 220px')
  }
  { // 放大之后的 PR 字形(v0.15.11):三档由同一个「一天多少 px」驱动,窄窗口一个像素都不动
    ok(relRegime(39.99, 1) === 0 && relRegime(40, 1) === 1 && relRegime(119.99, 1) === 1 && relRegime(120, 1) === 2,
      '档位线钉死:< 40 = 现状 / [40, 120) = 字形缩放 / ≥ 120 = 日格芯片(边界归上一档)',
      [39.99, 40, 119.99, 120].map((x) => x + '→' + relRegime(x, 1)).join(' '))
    ok(relRegime(1680, 60) === 0 && relRegime(1680, 30) === 1 && relRegime(1680, 14) === 2 && relRegime(1680, 1) === 2,
      '1680px 轨道上:60 天(28px/天)不动、30 天(56)走 A、近 2 周(120)与当日走 B',
      [60, 30, 14, 1].map((d) => d + '天=' + relRegime(1680, d)).join(' '))
    ok(relRegime(0, 0) === 0 && relRegime(NaN, 5) === 0 && relRegime(1680, 0) === 0,
      '量不到 / 零天:退回现状档,不是 NaN 档(pane 还藏着时轴本来就退自然宽)')
    ok(relSqSize(1680, 30) === 28 && relSqSize(400, 10) === 24 && relSqSize(100, 10) === 12 && relSqSize(1680, 60) === 17,
      '方块边长 = clamp(日宽 × 0.6, 12, 28):40px/天 正好 24(还点得中的下限),再宽封到 28',
      [relSqSize(1680, 30), relSqSize(400, 10), relSqSize(100, 10), relSqSize(1680, 60)].join(','))
    ok(relChipW(248) === 42 && relChipW(9) === 27 && relChipW(12345) === 57 && relChipW(0) === 27,
      '芯片宽按全图最大的号算:三位数 42px(与 demo 逐格相同),每多一位加 8px —— 四五位数的仓库不切号',
      [relChipW(248), relChipW(9), relChipW(12345)].join(','))
    { // 字形缩放档的方块:先横后竖,行数仍封顶
      const days = mkDays('2026-08-30', 3)
      const ax = relAxis(days, {}, O, 600) // 三天各 200px
      const arr = []
      for (let i = 1; i <= 13; i++) arr.push({ n: i })
      const g = relGridBig({ '2026-08-31': arr }, ax, 28, O) // 间距 32 → 6 列
      ok(g.bars.length === 13 && g.used === 3, '13 枚 28px 方块 → 6 列 3 行,一枚不丢', g.bars.length + ' / ' + g.used)
      ok(g.bars[0].lane === 0 && g.bars[5].lane === 0 && g.bars[6].lane === 1 && g.bars[6].x === ax.x['2026-08-31'] + 2,
        '先横后竖:第 7 枚换行回到第一列(0.15.10 的先竖后横在 28px 的方块上会撞行)')
      ok(g.bars.every((b) => b.w === 28 && b.x >= ax.x['2026-08-31'] && b.x + b.w <= ax.x['2026-08-31'] + ax.w['2026-08-31']),
        '方块不越出当天的格子')
      const nar = { x: { '2026-09-01': 200 }, w: { '2026-09-01': 40 }, W: 240, t0: '2026-09-01', t1: '2026-09-01' }
      const many = []
      for (let i = 1; i <= 20; i++) many.push({ n: i })
      ok(relGridBig({ '2026-09-01': many }, nar, 28, O).used === O.lanes,
        '窄格子里 20 枚也只占 6 行:放大不许把「展开高度有上界」这一条撑破')
      ok(relGridBig({ '2026-07-01': [{ n: 1 }] }, ax, 28, O).bars.length === 0, '窗口外的那天整天跳过')
    }
    { // 芯片档的当日 PR:一格一行,放不下的收进一枚 +N
      const days = mkDays('2026-09-01', 1)
      const ax = relAxis(days, {}, O, 200) // 这一天 200px
      const six = [], four = []
      for (let i = 1; i <= 6; i++) six.push({ n: 240 + i })
      for (let i = 1; i <= 4; i++) four.push({ n: 240 + i })
      const g = relGridChip({ '2026-09-01': six }, ax, 42) // 间距 48 → 4 列
      ok(g.used === 1 && g.bars.length === 4, '一格一行:4 列 → 画 3 枚 + 一枚 +N', g.bars.length + ' 枚')
      ok(g.bars.filter((b) => b.more).length === 1 && g.bars.filter((b) => b.more)[0].more === 3,
        '省略的那几个收进一枚 +3(3 枚画出来 + 3 枚收起来 = 6)',
        JSON.stringify(g.bars.map((b) => b.more || b.n)))
      ok(g.bars.filter((b) => b.more)[0].d === '2026-09-01', '+N 记着自己是哪一天的(悬停出的卡上写这个日子)')
      ok(g.bars.filter((b) => b.more)[0].fold.join(',') === '244,245,246',
        '+N 还记着被收起来的是哪几个号:悬停列的就是它们,不是那一整天',
        JSON.stringify(g.bars.filter((b) => b.more)[0].fold))
      ok(g.bars.every((b, i) => i === 0 || b.x === g.bars[i - 1].x + relChipPitch(42)), '按号横排,间距 = 芯片宽 + 一道固定间距')
      ok(CHIP_GAP === 6 && relChipPitch(42) === 48, '步距一处定:relChipPitch = 芯片宽 + CHIP_GAP', `${CHIP_GAP} ${relChipPitch(42)}`)
      ok(g.bars.every((b) => b.x >= ax.x['2026-09-01'] && b.x + b.w <= ax.x['2026-09-01'] + ax.w['2026-09-01']),
        '连 +N 在内都不越出当天的格子')
      const g4 = relGridChip({ '2026-09-01': four }, ax, 42)
      ok(g4.bars.length === 4 && !g4.bars.some((b) => b.more), '不多不少正好 4 枚:不为此挂一枚空的 +0')
      ok(relGridChip({}, ax, 42).used === 0, '一个都没有的带:used = 0(不塌成负高)')
    }
    { // 芯片档的跨天 PR:按(开 → 合 → 开着没)分组,一组一行一条 whisker
      const days = mkDays('2026-08-30', 3)
      const ax = relAxis(days, {}, O, 600) // 三天各 200px,x = 200 / 400 / 600
      const multi = [
        { n: 2, s: '2026-08-30', e: '2026-09-01' },
        { n: 1, s: '2026-08-30', e: '2026-09-01' },
        { n: 3, s: '2026-08-31', e: '2026-09-01' },
        { n: 4, s: '2026-08-30', e: '2026-09-01', open: true },
      ]
      const p = relPackChip(multi, ax, 42, O)
      ok(p.used === 3, '同开同合的并作一行(1 与 2),开着的不与合了的并 → 3 行', p.used + ' 行')
      ok(p.rows[0].list.map((x) => x.n).join(',') === '1,2', '一行里按号排,不按传进来的次序')
      ok(p.rows.map((r) => r.lane).join(',') === '0,1,2', '横向都压着今天那一格 → 三组挤不进同一行,各占一行')
      { // 横向不打架的两组并作一行:一组只在头两天,另一组只在末两天
        const wide = mkDays('2026-08-25', 8)
        const ax2 = relAxis(wide, {}, O, 1600) // 八天各 200px
        const two = relPackChip([{ n: 1, s: '2026-08-25', e: '2026-08-26' }, { n: 2, s: '2026-08-30', e: '2026-09-01' }], ax2, 42, O)
        ok(two.used === 1 && two.rows.every((r) => r.lane === 0), '左右分得开的两组并作一行(带高因此比一组一行更省)', two.used + ' 行')
      }
      { // 行数封顶:一堆各不相同、还都压着最后一天的跨度也只占 6 行(展开高度有上界不因芯片而破)
        const wide = mkDays('2026-08-25', 8)
        const ax2 = relAxis(wide, {}, O, 1600)
        const mm = []
        for (let i = 0; i < 7; i++) mm.push({ n: 100 + i, s: wide[i], e: wide[7] })
        for (let i = 0; i < 7; i++) mm.push({ n: 200 + i, s: wide[i], e: wide[7], open: true })
        const mp = relPackChip(mm, ax2, 42, O)
        ok(mp.rows.length === 14 && mp.used === O.lanes, '14 组各占一份,但行数封顶 6 —— 再挤也不让一条带长到看不完',
          mp.rows.length + ' 组 / ' + mp.used + ' 行')
        ok(mp.rows.every((r) => r.lane < O.lanes), '没有一组越过行数上限')
      }
      ok(p.rows[0].cx === 604 && p.rows[0].x1 === 604 && p.rows[0].x0 === 205,
        '合了的:芯片落在合并日那一格,细线从开 PR 那天牵到芯片',
        [p.rows[0].x0, p.rows[0].x1, p.rows[0].cx].join('/'))
      const op = p.rows.filter((r) => r.open)[0]
      ok(op.cx === 204 && op.x1 === 796 && op.x0 === 246,
        '还开着的:芯片落在开 PR 那天(与轴宽的锚点日口径同一条),细线从芯片往右牵到今天',
        [op.x0, op.x1, op.cx].join('/'))
      ok(p.rows.every((r) => r.an === (r.open ? '2026-08-30' : '2026-09-01')), '每行记着自己的锚点日(+N 的悬停清单要用)')
      const clipped = relPackChip([{ n: 9, s: '2026-08-01', e: '2026-09-01' }], ax, 42, O)
      ok(clipped.rows[0].clip === true && clipped.rows[0].x0 === O.lbl + 11,
        '开始日被窗口左缘裁掉:细线从左沿起,留一个 ‹ 的位置')
      ok(relPackChip([{ n: 9, s: '2026-07-01', e: '2026-07-20' }], ax, 42, O).used === 0, '整段落在窗口外:一行都不画')
      const wide = relPackChip([{ n: 5, s: '2026-08-30', e: '2026-09-01' }, { n: 6, s: '2026-08-30', e: '2026-09-01' },
        { n: 7, s: '2026-08-30', e: '2026-09-01' }, { n: 8, s: '2026-08-30', e: '2026-09-01' },
        { n: 9, s: '2026-08-30', e: '2026-09-01' }], ax, 42, O)
      ok(wide.used === 1 && wide.rows[0].show === 3 && wide.rows[0].list.length === 5,
        '一行也放不下 5 枚:画 3 枚,余下 2 枚交给 +N(与当日那组同一条省略规则)',
        wide.rows[0].show + ' / ' + wide.rows[0].list.length)
    }
    { // 横杠退成两端实心 + 细线
      const c = relCaps(200, 100, 28, false)
      ok(c.solid === false && c.a === 200 && c.aw === 28 && c.b === 272 && c.bw === 28 && c.lx === 228 && c.lw === 44,
        '两端各一顶 28px 的帽,中间一条细线严丝合缝地连上', JSON.stringify(c))
      ok(c.lx + c.lw === c.b && c.a + c.aw === c.lx, '细线两端正好咬住两顶帽(不留缝也不压帽)')
      const cl = relCaps(200, 100, 28, true)
      ok(cl.aw === 0 && cl.lx === 210 && cl.lx + cl.lw === cl.b, '左端被裁:不画起点帽,给 ‹ 让出 10px,细线照旧咬住右帽')
      ok(relCaps(200, 60, 28, false).solid === true && relCaps(200, 61, 28, false).solid === false,
        '短到两顶帽要碰上(≤ 2×28 + 4)就退回一整条 —— 那时它本来就没虚长')
    }
    { // 带高:放大档的行距更高,带高必须跟着长
      ok(relBandH(2, 1, O, true) === relBandH(2, 1, O, true, O.row, O.row), '不传行距 = 老口径(0.15.10 的调用点不受影响)')
      ok(relBandH(2, 1, O, true, 13, 32) === 126, '字形缩放档:方块那组按 28 + 4 的行距算高', String(relBandH(2, 1, O, true, 13, 32)))
      ok(relBandH(2, 1, O, true, 22, 22) === 134, '芯片档:两组都按 18 + 4 的行距算高', String(relBandH(2, 1, O, true, 22, 22)))
      ok(relBandH(6, 6, O, true, 22, 22) === 332 && relBandH(0, 0, O, true, 22, 22) === 36,
        '放大档展开的上界仍有限(6 + 6 行芯片 = 332px),窗口内 0 个 PR 也不塌成负高',
        String(relBandH(6, 6, O, true, 22, 22)))
    }
  }
  { // 五档时间窗(v0.15.9):全在浏览器按本地时钟算,gen 侧照旧零时间
    const at = (d) => new Date(d + 'T10:00:00') // 本地时刻:窗口口径认的是本地日与本地星期
    const wed = at('2026-09-02') // 周三
    const far = [Date.parse('2026-01-05T00:00:00Z')] // 一条带的最早锚点日,远在 60 天之外
    const near = [Date.parse('2026-08-31T00:00:00Z')]
    const w = (k, now = wed, los = near) => relWindow(k, now, los)
    ok(w('30').length === 30 && w('14').length === 14 && w('1').length === 1, '近 30 天 / 近 2 周 / 当日 = 30 / 14 / 1 天(含今天)',
      [w('30').length, w('14').length, w('1').length].join(','))
    ok(w('30')[0] === '2026-08-04' && w('30')[29] === '2026-09-02', '窗口右端永远是今天,左端 = 今天往回数 N−1 天', w('30')[0] + '→' + w('30')[29])
    ok(w('14')[0] === '2026-08-20' && w('1')[0] === '2026-09-02', '近 2 周 / 当日 的左端', w('14')[0] + ' / ' + w('1')[0])
    ok(['30', '14', 'week', '1', 'all'].every((k) => {
      const d = w(k)
      return d.every((x, i) => i === 0 || Date.parse(x + 'T00:00:00Z') - Date.parse(d[i - 1] + 'T00:00:00Z') === 864e5)
    }), '五档都是一天一格、升序、无洞无重(轴不会因此撞刻度)')
    // 本周:周一起算,所以周一 1 天、周日 7 天 —— 一周里逐天走一遍
    const wk = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'] // 周一 → 周日
    ok(wk.every((d, i) => relWindow('week', at(d), near).length === i + 1), '本周:周一 1 天 … 周日 7 天',
      wk.map((d) => relWindow('week', at(d), near).length).join(','))
    ok(wk.every((d) => relWindow('week', at(d), near)[0] === '2026-08-31'), '本周的左端一周不动 = 那个周一')
    ok(relWindow('week', at('2026-08-31'), near).length === 1 && relWindow('1', at('2026-08-31'), near).length === 1,
      '周一当天:本周与当日重合成同一个 1 天窗(合法,不是退化)')
    ok(w('all').length === 60 && w('all', wed, near)[0] === '2026-07-05', '全时段:带都在 60 天内时仍给 60 天底(与从前的「全部」同一口径)', w('all').length + ' 天')
    ok(w('all', wed, far)[0] === '2026-01-05' && w('all', wed, far).length === 241, '全时段:够到最早的一条带', w('all', wed, far)[0])
    ok(relWindow('all', wed, [Date.parse('2027-01-01T00:00:00Z')]).length === 60, '带的日子比今天还新(时钟 / 时区):窗口不倒着长,60 天底还在')
    // 1–2 天的极窄窗:轴 / 刻度 / 条 / 带高一个都不能出 NaN 或负数
    for (const k of ['1', 'week']) {
      const days = relWindow(k, at('2026-08-31'), near) // 周一 → 两档都是 1 天
      const ax = relAxis(days, {}, O)
      const tk = relTicks(days, ax, {}, 48)
      ok(days.length === 1 && ax.W === O.lbl + O.quiet && ax.t0 === ax.t1, `「${k}」1 天窗:轴宽 = 左栏 + 一个安静日,首尾同日`, 'W=' + ax.W)
      ok(tk.length === 1 && tk[0].k === 'wk' && tk[0].txt === true, '1 天窗恰好是周一:一个刻度,写字,不重复', JSON.stringify(tk.map((t) => t.d)))
      ok(relBar(ax, '2026-07-01', '2026-07-20', O.min) === null, '整条带落在窗口外:不画(不是画成负宽)')
      ok(relPack([{ n: 1, s: '2026-07-01', e: '2026-07-20' }], ax, O).bars.length === 0, '窗口外的 PR 打包不进泳道')
      ok(relGrid({ '2026-07-01': [{ n: 1 }] }, ax, O).bars.length === 0, '窗口外的当日方块也不画')
      const b = relBar(ax, days[0], days[0], O.min)
      ok(b && Number.isFinite(b.x0) && b.w === O.min && b.x0 === O.lbl, '落在这一天的条:x / w 都是有限正数', JSON.stringify(b))
      ok(relBandH(0, 0, O, true) === 36 && relBandH(0, 0, O, false) === 30, '窗口内 0 个 PR 的带:折叠 30、展开 36,不塌成负高')
    }
  }
}
{ // gen 侧:带的烤入 / 视图钮 / 窗口芯片 / 几何内联 / 关档冻结
  const { relAxis, relTicks, relBar, relWindow } = await import(join(NEW_SCRIPTS, 'relgeom.mjs'))
  const fx41 = mkFixture('fx41', { 's.html': demoHtml('s') })
  const cfgP = join(fx41.kb, 'kanban.config.json'), idxP = join(fx41.kb, 'index.html')
  const relP = join(fx41.kb, 'release-manifest.json')
  const mP = join(fx41.kb, 'manifest.json'), decP = join(fx41.kb, 'decisions-manifest.json'), blP = join(fx41.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  runGen(NEW_SCRIPTS, fx41.kb)
  const offSha = sha(idxP)
  const cfg = rd(cfgP)
  cfg.releaseTab = true
  wr(cfgP, cfg)
  // 两个版本 + 一条 dev + 一条 test + 一条非主线,日子刻意跨月
  wr(relP, {
    stages: REL_MANIFEST.stages,
    releases: [{ tag: 'v0.0.1', at: '2026-07-14T06:00:00Z' }, { tag: 'v0.0.2', at: '2026-08-20T09:00:00Z' }],
    prs: [
      { number: 40, title: '开着的', state: 'open', draft: false, base: 'main', branch: 'f/a', url: 'https://github.com/o/r/pull/40', createdAt: '2026-08-24T01:00:00Z', mergedAt: null, closedAt: null, cards: [] },
      { number: 39, title: '已合未发', state: 'merged', draft: false, base: 'main', branch: 'f/b', url: 'https://github.com/o/r/pull/39', createdAt: '2026-08-21T01:00:00Z', mergedAt: '2026-08-22T01:00:00Z', closedAt: null, cards: [] },
      { number: 38, title: '二版的甲', state: 'merged', draft: false, base: 'main', branch: 'f/c', url: 'https://github.com/o/r/pull/38', createdAt: '2026-08-18T01:00:00Z', mergedAt: '2026-08-19T01:00:00Z', closedAt: null, cards: [] },
      { number: 37, title: '二版的乙', state: 'merged', draft: false, base: 'main', branch: 'f/d', url: 'https://github.com/o/r/pull/37', createdAt: '2026-08-19T01:00:00Z', mergedAt: '2026-08-19T02:00:00Z', closedAt: null, cards: [] },
      { number: 36, title: '一版的', state: 'merged', draft: false, base: 'main', branch: 'f/e', url: 'https://github.com/o/r/pull/36', createdAt: '2026-07-10T01:00:00Z', mergedAt: '2026-07-12T01:00:00Z', closedAt: null, cards: [] },
      { number: 35, title: '叠 PR', state: 'open', draft: false, base: 'f/a', branch: 'f/g', url: 'https://github.com/o/r/pull/35', createdAt: '2026-08-23T01:00:00Z', mergedAt: null, closedAt: null, cards: [] },
    ],
    syncedAt: '2026-08-26T02:00:00Z',
  })
  const r = runGen(NEW_SCRIPTS, fx41.kb)
  ok(r.status === 0, 'releaseTab:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('data-relv="timeline">时间线') && on.includes('class="on" data-relv="table">表格'),
    '视图钮文案「时间线 | 表格」,默认表格(密度那版没上)')
  { // 窗口芯片:五档,次序与默认都锁死(v0.15.9)
    const chips = [...on.matchAll(/data-relwin="([^"]+)">([^<]+)</g)].map((m) => m[1] + '=' + m[2])
    ok(chips.join(' ') === '30=近 30 天 14=近 2 周 week=本周 1=当日 all=全时段', '五档窗口芯片,次序与文案', chips.join(' '))
    ok(on.includes('class="on" data-relwin="30">近 30 天'), '默认档 = 近 30 天(唯一带 .on 的那个)')
    ok(!on.includes('近 60 天') && !on.includes('data-relwin="60"'), '旧的近 60 天一个字不留')
    ok(on.includes("view = 'table', win = '30'"), '运行期初值与高亮的那一档是同一个')
    ok(!on.includes('_rel_win'), '窗口档不进 localStorage(与视图不同,它不记 —— 每次开板都从近 30 天起)')
  }
  { // 轴宽由这一格的实宽定(v0.15.10):壳里真的量了横滚容器,量到的数真的交给了 relAxis
    const mline = on.split('\n').find((l) => l.includes('var sc = host.parentNode'))
    const axline = on.split('\n').find((l) => l.includes('var ax = relAxis('))
    ok(!!mline && /clientWidth/.test(mline) && /- TL\.lbl/.test(mline), '壳里量的是横滚容器的可视宽,减掉左栏 = 轴能用的轨道宽', mline && mline.trim())
    ok(/relAxis\(days, DAYC, TL, fit\)/.test(axline || ''), '量到的 fit 交给 relAxis(不是量了不用)', axline && axline.trim())
    const fitOf = new Function('host', 'TL', mline + '\nreturn fit')
    ok(fitOf({ parentNode: { clientWidth: 1880 } }, { lbl: 200 }) === 1680, '容器 1880px → 轨道 1680px')
    ok(fitOf({ parentNode: { clientWidth: 0 } }, { lbl: 200 }) === -200, 'pane 还藏着(clientWidth = 0):fit 为负 → relAxis 退回自然宽,切进 tab 那次 relSync 会带真宽重画')
    ok(fitOf({ parentNode: null }, { lbl: 200 }) === -200, '容器还没挂上也不抛')
    ok(on.includes("if (name === 'release' && window.relSync) relSync()"), 'show(release) 会 relSync → render → drawTl:pane 一露面就按真宽重画(轴宽因此不必再单挂 resize 监听)')
    ok(on.includes('.reltlsc { overflow-x: auto'), '装不下时照旧由这一层横向滚(全时段在窄屏上不变)')
  }
  { // 放大之后的字形(v0.15.11):档位一屏只挑一次,挑的依据是那根已经拉满的轴
    const rl = on.split('\n').find((l) => l.includes('var reg = relRegime('))
    ok(/relRegime\(ax\.W - TL\.lbl, days\.length\)/.test(rl || ''),
      '档位由「拉满后的轨道宽 ÷ 窗口天数」定,一屏只算一次(不是逐条 PR 各挑各的)', rl && rl.trim())
    ok(on.includes('function relRegime') && on.includes('function relPackChip') && on.includes('function relGridChip')
      && on.includes('function relGridBig') && on.includes('function relCaps'),
      '三档的几何全内联进页面(测试 import 的与页面跑的还是同一份源码)')
    ok(on.includes('reg === 2 ? relPackChip(multi, ax, cw, TL) : relPack(multi, ax, TL)')
      && on.includes('reg === 1 ? relGridBig(byDay, ax, size, TL) : relGrid(byDay, ax, TL)'),
      '现状档照旧走 relPack / relGrid,一个字都没绕道(< 40px/天 的产物因此逐字节不动)')
    ok(on.includes('relBandH(mp.used, sg2.used, TL, op, rowM, rowS)'), '带高按这一档的行距算(字形长大了,行距不跟就压在一起)')
    ok(on.includes('chip: 18 }') && on.includes('.relpb.relchip { height: 18px'),
      '芯片高只写一处:运行期的 TL.chip 与 CSS 是同一个数(分成两处写就是 v0.15.4 那个对不上的老坑)')
    ok(on.includes('--rellane: var(--accent)') && on.includes('.relwk { position: absolute; height: 1px'),
      '泳道色顺手落一份 --rellane:细线要 background、‹ 与虚边芯片要 color,同一个色不新造')
    ok(on.includes('放大') || on.includes('带号芯片'), '图例里说了这件事(不然那句「方块 = 当天开当天合」在放大档下就是假的)')
  }
  { // 字幕:五档都由 relWindow 现算,当日那档塌成单日形制。取的是壳里那一行真代码
    const line = on.split('\n').find((l) => l.includes('dnr.textContent ='))
    ok(!!line, '壳里有字幕那一行')
    const cap = new Function('dnr', 'days', 'span', 'md', line + '\nreturn dnr.textContent')
    const md = (s2) => String(s2).slice(5, 10)
    const say = (k, now) => { const d = relWindow(k, now, [Date.parse('2026-07-01T00:00:00Z')]); return cap({}, d, d.length, md) }
    const tue = new Date('2026-09-01T10:00:00')
    ok(say('30', tue) === '08-03 → 09-01 · 30 天', '近 30 天的字幕', say('30', tue))
    ok(say('14', tue) === '08-19 → 09-01 · 14 天', '近 2 周的字幕', say('14', tue))
    ok(say('week', tue) === '08-31 → 09-01 · 2 天', '本周的字幕(周二 = 2 天)', say('week', tue))
    ok(say('1', tue) === '09-01 · 1 天', '当日:首尾同一天,字幕塌成单日形制(不写 09-01 → 09-01)', say('1', tue))
    ok(say('week', new Date('2026-08-31T10:00:00')) === '08-31 · 1 天', '周一的本周也走单日形制')
    ok(/^07-01 → 09-01 · 63 天$/.test(say('all', tue)), '全时段:够到最早的一条带', say('all', tue))
  }
  { // 空窗口(今天落在所有 PR 活动之外):每条带都干干净净地退成「不画」,不出 NaN / 负宽
    const G0 = JSON.parse(on.match(/\n {4}var G = (\[[\s\S]*?\])\n/)[1])
    const O2 = { lbl: 200, base: 14, slot: 12, quiet: 5, lanes: 6, row: 13, head: 30, sub: 14, pad: 6, min: 10, gap: 3 }
    const far = new Date('2030-01-02T10:00:00') // 离所有 PR 都很远的一天
    for (const k of ['30', '14', 'week', '1']) {
      const days = relWindow(k, far, G0.map((g) => Date.parse(g.lo + 'T00:00:00Z')))
      const ax = relAxis(days, {}, O2)
      const bars = G0.map((g) => relBar(ax, g.lo < ax.t0 ? ax.t0 : g.lo, g.hi > ax.t1 ? ax.t1 : g.hi, 4))
      ok(days.length >= 1 && Number.isFinite(ax.W) && ax.W > 0, `空窗「${k}」:轴还在,宽是有限正数`, 'W=' + ax.W)
      ok(bars.every((b) => b === null), `空窗「${k}」:每条带都退成不画(不是 NaN / 负宽)`, JSON.stringify(bars))
      ok(G0.every((g) => Object.keys(g.d).every((d2) => ax.x[d2] === undefined)), `空窗「${k}」:窗口内计数为 0,带头写「窗口内 0」`)
      ok(relTicks(days, ax, {}, 48).every((t) => Number.isFinite(t.x)), `空窗「${k}」:刻度 x 有限`)
    }
  }
  ok(!on.includes('reltlsvg') && !on.includes('rect.relb') && !on.includes('id="reltip"'),
    '旧时间线的 SVG 与浮层一个不留(死代码不留在产物里)')
  ok(on.includes('if (e0 >= ax.t0 && s0 <= ax.t1) { inwin++'),
    '带头那句「窗口内 N」数的是「画不画得出来」(与 relBar 同一个判据),不是锚点日落没落在窗口里 —— 窗口之前建的、还开着的 PR 会画出来,锚点却在窗口外')
  ok(/if \(e0 >= ax\.t0 && s0 <= ax\.t1\) \{ inwin\+\+; if \(d\.cur\) curN = d\.n \}/.test(on),
    '带头那句「验收中 #N」与「窗口内 N」同一个判据同一处算:窗口画不出它,就一个字都不说(v0.17.1)')
  ok(count(on, 'function relChipPitch') === 1 && !on.includes('cw + 6'),
    '芯片步距在产物里只有一处定义:tlWhisk 与 packer 都调 relChipPitch,不再各写一个 6(改一处漏一处,芯片就探出预留块)',
    `relChipPitch×${count(on, 'function relChipPitch')} / cw+6×${count(on, 'cw + 6')}`)
  ok(!on.includes('function iso(') && count(on, 'function dstr(') === 1,
    '发布进度的运行期里没有从没被调用过的 iso()(与 dstr 逐字节相同,0.13.1 加进来就一直没有调用者)')
  const G = JSON.parse(on.match(/\n {4}var G = (\[[\s\S]*?\])\n/)[1])
  ok(G.map((g) => g.g).join(',') === 'dev,test,v0.0.2,v0.0.1,other',
    `带序 = dev → test → 版本(at 降序)→ 其它(实际 ${G.map((g) => g.g).join(',')})`)
  ok(G.map((g) => g.n).join(',') === '1,1,2,1,1', `每带计数(实际 ${G.map((g) => g.n).join(',')})`)
  ok(JSON.stringify(G[2].d) === JSON.stringify({ '2026-08-19': 2 }), '日桶按锚点日算:两条都合在 08-19,同一天两个')
  ok(G[0].d['2026-08-24'] === 1 && !G[0].lo.startsWith('2026-08-19'), '开着的按 createdAt 落桶,不按合并日')
  ok(G[3].lo === '2026-07-12' && G[3].hi === '2026-07-12', '带的日期跨度也按锚点日')
  ok(G[2].q === 4 && G[3].q === 3 && G[0].q === 4, '版本带按新旧分档透明度(最新最实),三段自己满档')
  ok(on.includes('function relAxis') && on.includes('function relPack') && on.includes('function relBandH'),
    '几何源码原样内联进页面(测试 import 的与页面跑的是同一份)')
  ok(!/export function/.test(on.split('</head>')[1] || on), '内联时剥掉了 export(壳里不是模块)')
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((s) => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, '整壳内联 JS 可编译(new Function 不抛)')
  }
  cfg.releaseTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx41.kb)
  const off = readFileSync(idxP, 'utf8')
  // 关档但 manifest 还在:tab 与时间线一个字都不出(芯片状态后缀另有一道门,见 T33)
  ok(!off.includes('pane-release') && !off.includes('data-relpane="timeline"') && !off.includes('function relAxis'),
    'releaseTab 关回:pane / 时间线 / 几何源码全不渲染')
  rmSync(relP)
  runGen(NEW_SCRIPTS, fx41.kb)
  ok(sha(idxP) === offSha, '撤掉 manifest 后与冻结基线逐字节相同')
}

// ============ T45 settleHold「暂不收账」(三种卡的芯片 / 待收账段 / 守卫;字段撤回回基线)============
console.log('T45 settleHold 暂不收账')
{
  const fx45 = mkFixture('fx45', { 's.html': demoHtml('s') })
  const cfgP = join(fx45.kb, 'kanban.config.json'), idxP = join(fx45.kb, 'index.html')
  const relP = join(fx45.kb, 'release-manifest.json')
  const mP = join(fx45.kb, 'manifest.json'), decP = join(fx45.kb, 'decisions-manifest.json'), blP = join(fx45.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  bl.tiers = { 1: '核心' }
  const item = (o) => ({ status: 'ready', priority: 'high', tier: '1', title: 't', problem: 'p', approach: 'a', area: 'x', source: 's', ...o })
  bl.items = [
    item({ id: 'BL-S', pr: 227 }), // 合了、卡还 ready → 待收账
    item({ id: 'BL-H', pr: 227 }), // 同上;下面给它写 settleHold
    item({ id: 'BL-R', status: 'done', pr: 232 }), // 收了、PR 还开着 → 反向
    item({ id: 'BL-RH', status: 'done', pr: 232 }), // 同上;下面给它写 settleHold
  ]
  dec.entries = [{ id: 'D-H', code: 'D-H', status: 'decided', date: '2026-01-01', title: '决策甲', question: 'q', pr: 226 }]
  mm.iterations = [{ id: 'I1', title: '迭代甲', detail: '' }]
  mm.tasks = [{ id: 'T-H', iteration: 'I1', status: 'active', title: '任务甲', approach: 'a', pr: 226 }]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  wr(relP, REL_MANIFEST)
  const cfg = rd(cfgP)
  cfg.releaseTab = true
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx45.kb)
  const offSha = sha(idxP) // 一张卡都没写 settleHold 的基线
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('rspchip rsp-hold') && !off.includes('暂不收账'), '没有一张卡写 settleHold:零灰芯片(CSS 片段照旧在,那是门控注入片的常态)')
  ok(off.includes('<p class="rspsh">待收账 · 4 张卡'), '基线:四张 settle 卡都在待收账段', (off.match(/class="rspsh">[^<]*/) || [])[0])

  // ---- 挂上 settleHold ----
  const REASON = '这一轮 PR 只落了 <接口> & "壳"'
  const hold = rd(blP)
  hold.items[1].settleHold = REASON
  hold.items[3].settleHold = '卡跨两轮,下一轮才收'
  wr(blP, hold)
  const dec2 = rd(decP); dec2.entries[0].settleHold = '决策落地了一半'; wr(decP, dec2)
  const mm2 = rd(mP); mm2.tasks[0].settleHold = '任务卡同理'; wr(mP, mm2)
  const r = runGen(NEW_SCRIPTS, fx45.kb)
  ok(r.status === 0, 'settleHold 在场 gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  const cardOf = (id) => { const i = on.indexOf(`id="${id}"`); return i < 0 ? '' : on.slice(i, on.indexOf('</article>', i)) }
  ok(cardOf('BL-H').includes('<span class="rspchip rsp-hold" data-hold="" title="这一轮 PR 只落了 &lt;接口&gt; &amp; &quot;壳&quot;">暂不收账</span>'),
    'backlog 卡:灰芯片「暂不收账」,理由 esc 进 title', (cardOf('BL-H').match(/rsp-hold[^>]*>[^<]*/) || [''])[0])
  ok(!cardOf('BL-H').includes('rsp-settle'), 'hold 卡不再出「PR 已合 · 待收账」')
  ok(cardOf('BL-S').includes('rsp-settle'), '同一个 PR 上没写 settleHold 的卡照旧催')
  ok(cardOf('BL-RH').includes('rsp-hold') && !cardOf('BL-RH').includes('rsp-reopen'), '反向提示同样被 settleHold 按下')
  ok(cardOf('BL-R').includes('rsp-reopen'), '没写字段的反向卡照旧提示')
  ok(cardOf('D-H').includes('rsp-hold') && !cardOf('D-H').includes('rsp-settle'), '决策卡:同一枚灰芯片')
  ok(cardOf('T-H').includes('rsp-hold') && !cardOf('T-H').includes('rsp-settle'), '进度 task 卡:同一枚灰芯片')
  ok(/\.rsp-part, \.rsp-hold[^{]*\{ font-weight: 400; color: var\(--mut\)/.test(on), '灰芯片与「2/3 已合」同一套安静配色,不引新强调色')
  ok(on.includes('<p class="rspsh">待收账 · 1 张卡'), '待收账段:hold 的三张卡不占位(4 → 1)', (on.match(/class="rspsh">[^<]*/) || [])[0])
  {
    const seg = on.slice(on.indexOf('class="rspsettle"'), on.indexOf('class="relview"'))
    ok(!seg.includes('#BL-H') && !seg.includes('#D-H') && !seg.includes('#T-H'), 'hold 的三张卡都不进待收账段')
    ok(seg.includes('href="#BL-S"'), '没 hold 的卡还在段里')
  }
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch { compiled = false } }
    ok(compiled, 'settleHold 开档整壳内联 JS 可编译')
  }
  { // 空串 / 只有空白 = 没写(否则「清空理由」会变成一枚没话说的芯片)
    const blank = rd(blP)
    blank.items[1].settleHold = '   '
    wr(blP, blank)
    runGen(NEW_SCRIPTS, fx45.kb)
    const b = readFileSync(idxP, 'utf8')
    ok(b.slice(b.indexOf('id="BL-H"')).includes('rsp-settle'), '空白理由不算 hold,照旧催收账')
    wr(blP, hold)
    runGen(NEW_SCRIPTS, fx45.kb)
  }

  // ---- 守卫:hold 的卡不点名 ----
  touch(idxP)
  const g = runStop(NEW_SCRIPTS, fx45.root)
  ok(g.status === 0 && /BL-S/.test(g.stdout) && !/BL-H/.test(g.stdout), '守卫:待收账那条不点 hold 的卡', `${g.status} ${g.stdout.slice(0, 400)}`)
  ok(/BL-R\b/.test(g.stdout) && !/BL-RH/.test(g.stdout), '守卫:反向那条同样不点 hold 的卡')
  ok(/settleHold/.test(g.stdout), '守卫顺带说明这个字段怎么用')
  ok(!/"decision":\s*"block"/.test(g.stdout), 'settleHold 相关提示一律不阻断')

  // ---- 撤回字段:逐字节回到基线(T26 模式)----
  const back = rd(blP); delete back.items[1].settleHold; delete back.items[3].settleHold; wr(blP, back)
  const decB = rd(decP); delete decB.entries[0].settleHold; wr(decP, decB)
  const mmB = rd(mP); delete mmB.tasks[0].settleHold; wr(mP, mmB)
  runGen(NEW_SCRIPTS, fx45.kb)
  ok(sha(idxP) === offSha, '撤掉 settleHold 后与无字段基线逐字节相同')
}

// ============ T46 pr-sync --settle --only / settleHold(挑着收;点错卡号一个字节都不写)============
console.log('T46 pr-sync --settle --only')
{
  const fx46 = mkFixture('fx46', { 's.html': demoHtml('s') })
  const relP = join(fx46.kb, 'release-manifest.json')
  const mP = join(fx46.kb, 'manifest.json'), decP = join(fx46.kb, 'decisions-manifest.json'), blP = join(fx46.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr2 = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  bl.tiers = { 1: '核心' }
  const item = (o) => ({ status: 'ready', priority: 'high', tier: '1', title: 't', problem: 'p', approach: 'a', area: 'x', source: 's', ...o })
  bl.items = [
    item({ id: 'BL-1', pr: 11 }), // 该收
    item({ id: 'BL-2', pr: 10 }), // 这一轮不收,靠 --only 跳过
    item({ id: 'BL-3', pr: 10, settleHold: '只落了接口' }), // 长期挂账
  ]
  dec.entries = [{ id: 'D1', code: 'D1', status: 'decided', date: '2026-01-01', title: '决策甲', question: 'q', pr: 11, settleHold: '正主在下一轮' }]
  wr2(mP, mm); wr2(decP, dec); wr2(blP, bl)
  wr2(relP, { stages: REL_MANIFEST.stages, releases: [], prs: [], syncedAt: null })
  const ghDir = join(WORK, 'fakegh46')
  mkdirSync(ghDir, { recursive: true })
  writeFileSync(join(ghDir, 'gh'), `#!/bin/sh
case "$1 $2" in
"pr list") echo '[{"number":10,"title":"乙","state":"MERGED","isDraft":false,"baseRefName":"main","headRefName":"feat/b","url":"https://github.com/o/r/pull/10","createdAt":"2026-07-10T01:00:00Z","mergedAt":"2026-07-12T01:00:00Z","closedAt":"2026-07-12T01:00:00Z"},
 {"number":11,"title":"甲","state":"MERGED","isDraft":false,"baseRefName":"main","headRefName":"feat/a","url":"https://github.com/o/r/pull/11","createdAt":"2026-07-18T01:00:00Z","mergedAt":"2026-07-19T01:00:00Z","closedAt":"2026-07-19T01:00:00Z"}]' ;;
"release list") echo '[]' ;;
esac
`)
  chmodSync(join(ghDir, 'gh'), 0o755)
  const runSync = (extra) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'pr-sync.mjs'), '--dir', fx46.kb, ...extra],
    { encoding: 'utf8', env: { ...process.env, PATH: ghDir } })
  const blBefore = sha(blP), decBefore = sha(decP)

  const rList = runSync(['--settle'])
  ok(rList.status === 0 && /BL-1\s+ready → done/.test(rList.stdout) && /BL-2\s+ready → done/.test(rList.stdout),
    '清单列出两张该判的卡', `${rList.status} ${rList.stdout}`)
  ok(!/^\s*BL-3\s/m.test(rList.stdout) && !/^\s*D1\s/m.test(rList.stdout), '写了 settleHold 的卡不进清单行')
  ok(/已 hold\(2\)/.test(rList.stdout) && /BL-3/.test(rList.stdout) && /D1/.test(rList.stdout),
    '它们单列成「已 hold(N)」一行', rList.stdout)
  ok(/--only/.test(rList.stdout), '干跑输出末尾点明可以 --only 挑着收')
  ok(sha(blP) === blBefore && sha(decP) === decBefore, '干跑不动卡的 manifest')

  const rBad = runSync(['--settle', '--write', '--only', 'BL-3'])
  ok(rBad.status === 1 && sha(blP) === blBefore && sha(decP) === decBefore,
    '--only 点名一张已 hold 的卡 → exit 1,一个字节都不写', `${rBad.status} ${rBad.stderr.slice(0, 200)}`)
  ok(/BL-3/.test(rBad.stderr) && /settleHold/.test(rBad.stderr), '报错点名那个 id 并说明 hold 的卡本就不在清单里')
  const rBad2 = runSync(['--settle', '--write', '--only', 'BL-1,BL-9'])
  ok(rBad2.status === 1 && sha(blP) === blBefore, '清单里混一个不存在的卡号 → 整次拒绝(不做部分收账)', rBad2.stderr.slice(0, 200))
  const rEmpty = runSync(['--settle', '--write', '--only'])
  ok(rEmpty.status === 1 && sha(blP) === blBefore, '--only 后面没给卡号 → 报错不写')

  const blText = readFileSync(blP, 'utf8')
  const rOnly = runSync(['--settle', '--write', '--only', 'BL-1'])
  ok(rOnly.status === 0, '--settle --write --only BL-1 exit 0', `${rOnly.stdout}${rOnly.stderr}`)
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const want = JSON.parse(blText)
  want.items[0].status = 'done'
  want.items[0].note = `【${today} 收账】PR#11 已合(自动)`
  ok(readFileSync(blP, 'utf8') === JSON.stringify(want, null, 2) + '\n',
    '只有点名的那张卡被改,BL-2 / BL-3 一个字节都没动')
  ok(sha(decP) === decBefore, '决策卡整份没被碰(它那张也 hold 着)')
  ok(/1 张卡|settled 1 card/.test(rOnly.stdout), '收账条数报的是被点名的张数')

  const rRest = runSync(['--settle'])
  ok(/BL-2\s+ready → done/.test(rRest.stdout) && !/BL-1\s+ready/.test(rRest.stdout), '收完 BL-1 后清单只剩 BL-2')
  const rOnlyEq = runSync(['--settle', '--write', '--only=BL-2'])
  ok(rOnlyEq.status === 0 && rd(blP).items[1].status === 'done', '--only=<id> 等号写法同样认')
  const rDone = runSync(['--settle'])
  ok(/没有待收账|nothing to settle/.test(rDone.stdout) && /已 hold\(2\)/.test(rDone.stdout),
    '清单空了也照报「已 hold」—— 挂起的账不能就此消失在视野里', rDone.stdout)
}

// ============ T47 tab 条不折行(BL-C91 同根:中文/「·」都是合法断行点)============
// .tabbar 是 flex 行,.tab 一旦可换行,中等宽度下「进度看板」「决策·Demo · 112」这类长标签
// 就在中文字间或 · 处断成两行,整条 tabbar 被撑成两倍高。钉 nowrap + flex: none,并让
// tabbar 本身横向可滚动(溢出时滚动而不是折行)。
console.log('T47 tab 条不折行')
{
  const fx47 = mkFixture('fx47', { 's.html': demoHtml('s') })
  runGen(NEW_SCRIPTS, fx47.kb)
  const idx = readFileSync(join(fx47.kb, 'index.html'), 'utf8')
  const tabRule = (idx.match(/\.tab\s*\{[^}]*\}/) || [''])[0]
  const tabbarRule = (idx.match(/\.tabbar\s*\{[^}]*\}/) || [''])[0]
  ok(/white-space:\s*nowrap/.test(tabRule), '.tab 钉了 white-space: nowrap(中文/· 都可断行 → 逐字竖排)', tabRule.slice(0, 120))
  ok(/flex:\s*none/.test(tabRule), '.tab 钉了 flex: none(不跟着挤压收缩)', tabRule.slice(0, 120))
  ok(/overflow-x:\s*auto/.test(tabbarRule), '.tabbar 窄视口下横向滚动而不是折行', tabbarRule.slice(0, 160))
  ok(idx.includes('class="tab tab-shots"'), '截图出站 tab 仍带 .tab 类(同吃 nowrap/flex:none)')
}

// ============ T48 一卡一文件 cardsDir(拆分等价 / 硬报错 / 顺序 / 守卫 / 每卡更新日期)============
console.log('T48 一卡一文件 cardsDir')
const runScript = (name, kb, extra = []) =>
  spawnSync(process.execPath, [join(NEW_SCRIPTS, name), '--dir', kb, ...extra], { encoding: 'utf8' })
const { stripCardUpdated } = await import(join(NEW_SCRIPTS, 'cards.mjs'))
{ // 四拍:未配 = 基线 → split 后逐字节相同(除新增的更新时间戳)→ 开着验行为 → join 回来比 sha
  const fx48 = mkFixture('fx48', { 'c1.html': demoHtml('c1') })
  const kb = fx48.kb
  const cfgP = join(kb, 'kanban.config.json'), idxP = join(kb, 'index.html')
  const blP = join(kb, 'backlog-manifest.json'), decP = join(kb, 'decisions-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const bl = rd(blP), dec = rd(decP)
  bl.tiers = { 1: '核心' }
  const st = Object.keys(bl.statuses)[0], pri = Object.keys(bl.priorities)[0]
  const item = (id, date, title) => ({ id, status: st, priority: pri, tier: '1', date, title, problem: 'p', approach: 'a', area: 'x', source: 's' })
  // BL-7 与 BL-C7 的 numOf 都是 7、日期又相同 —— byDateDesc 是稳定排序,这一对的先后就是数组顺序
  bl.items = [item('BL-7', '2026-02-02', '甲'), item('BL-C7', '2026-02-02', '乙'), item('BL-3', '2026-01-01', '丙')]
  const dst = Object.keys(dec.statuses)[0]
  dec.entries = [
    { id: 'D9', code: 'D9', status: dst, date: '2026-03-03', title: '决策九', demo: 'demos/c1.html' },
    { id: 'D2', code: 'D2', status: dst, date: '2026-03-03', title: '决策二' },
  ]
  wr(blP, bl); wr(decP, dec)
  const cfg = rd(cfgP)
  cfg.lazyTabs = true // parts/*.html 也进对比面(深链表 LAZY_PANE_OF 的键序正是「数组顺序即显示顺序」的活证据)
  wr(cfgP, cfg)
  const r0 = runGen(NEW_SCRIPTS, kb)
  ok(r0.status === 0, '拍 1 未配 cardsDir:gen exit 0', r0.stderr)
  const baseSha = sha(idxP)
  const baseIdx = readFileSync(idxP, 'utf8')
  const basePart = readFileSync(join(kb, 'parts', 'backlog.html'), 'utf8')
  ok(!baseIdx.includes('class="udate"') && !baseIdx.includes('.udate {'), '未配 cardsDir:更新时间戳与它那条 CSS 一个字都不出')

  const dry = runScript('cards-split.mjs', kb, ['--dry-run'])
  ok(dry.status === 0 && /5/.test(dry.stdout), `--dry-run 报出将生成 5 个卡文件(实际输出:${dry.stdout.trim().split('\n')[0]})`)
  ok(!existsSync(join(kb, 'cards')) && sha(idxP) === baseSha, '--dry-run 一个字节都没写')

  const sp = runScript('cards-split.mjs', kb)
  ok(sp.status === 0, `cards-split exit 0(${(sp.stderr || '').trim()})`)
  ok(existsSync(join(kb, 'cards', 'backlog', 'BL-C7.json')) && existsSync(join(kb, 'cards', 'decisions', 'D9.json')),
    '卡按 id 落成文件')
  ok(rd(blP).items === undefined && rd(decP).entries === undefined, '头文件不再含 items / entries(一个真源)')
  ok(rd(blP).statuses && rd(blP).groups && rd(decP).statuses && rd(decP).instance, '头文件保留 $comment/instance/statuses/priorities/tiers/groups')
  ok(rd(cfgP).cardsDir === 'cards', 'kanban.config.json 写入了 cardsDir')
  ok(rd(join(kb, 'cards', 'backlog', 'BL-7.json')).order === 0 && rd(join(kb, 'cards', 'backlog', 'BL-C7.json')).order === 1,
    'order = 原数组下标(数组顺序是显示顺序,不记下来还原不回去)')

  const splitIdx = readFileSync(idxP, 'utf8')
  const splitPart = readFileSync(join(kb, 'parts', 'backlog.html'), 'utf8')
  ok(stripCardUpdated(splitIdx) === stripCardUpdated(baseIdx), '拍 2 拆分后 index.html 逐字节相同(唯一新增 = 每卡更新时间戳)')
  ok(stripCardUpdated(splitPart) === basePart, '拍 2 拆分后 parts/backlog.html 也逐字节相同')
  ok(splitIdx.includes('.udate {'), '拍 3 开着:index.html 里多了 .udate 那条 CSS')
  ok(count(splitPart, 'class="udate"') === 3 && count(readFileSync(join(kb, 'parts', 'decisions.html'), 'utf8'), 'class="udate"') === 2,
    '拍 3 开着:5 张卡各一枚「更新」灰字(懒加载时卡正文在 parts 里)')
  ok(/<span class="udate" title="卡文件最后改动 \d{4}-\d{2}-\d{2}">更新 \d{2}-\d{2}<\/span>/.test(splitPart), '灰字是「更新 MM-DD」,title 里带完整日期')

  const jn = runScript('cards-join.mjs', kb)
  ok(jn.status === 0, `cards-join exit 0(${(jn.stderr || '').trim()})`)
  ok(sha(idxP) === baseSha, '拍 4 合回单文件:与基线逐字节相同')
  ok(!existsSync(join(kb, 'cards')) && rd(cfgP).cardsDir === undefined, '卡目录与 cardsDir 都清干净了')
  ok(JSON.stringify(rd(blP).items) === JSON.stringify(bl.items) && JSON.stringify(rd(decP).entries) === JSON.stringify(dec.entries),
    '合回来的两个数组与拆分前逐字段相同(order 已删)')
}
{ // 硬报错四种 + 顺序与文件系统无关
  const fx48b = mkFixture('fx48b', { 'c1.html': demoHtml('c1') })
  const kb = fx48b.kb
  const cfgP = join(kb, 'kanban.config.json'), blP = join(kb, 'backlog-manifest.json'), decP = join(kb, 'decisions-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const bl = rd(blP), dec = rd(decP)
  bl.tiers = { 1: '核心' }
  const st = Object.keys(bl.statuses)[0], pri = Object.keys(bl.priorities)[0]
  bl.items = ['BL-1', 'BL-2', 'BL-3'].map((id, i) => ({ id, status: st, priority: pri, tier: '1', date: `2026-01-0${i + 1}`, title: id }))
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: 'd' }]
  wr(blP, bl); wr(decP, dec)
  const cfg0 = rd(cfgP)
  cfg0.lazyTabs = true
  wr(cfgP, cfg0)
  runGen(NEW_SCRIPTS, kb)
  runScript('cards-split.mjs', kb)
  const idxP = join(kb, 'index.html')
  const boardSha = (dir) => { // index + 两个 part 一起摁指纹(懒加载时卡正文在 part 里)
    const h = createHash('sha256')
    for (const rel of [['index.html'], ['parts', 'decisions.html'], ['parts', 'backlog.html']]) h.update(readFileSync(join(dir, ...rel)))
    return h.digest('hex')
  }
  const splitSha = boardSha(kb)
  const blDir = join(kb, 'cards', 'backlog')
  const idmap = () => Object.keys(JSON.parse(readFileSync(idxP, 'utf8').match(/const LAZY_PANE_OF = (\{[^\n]*?\})\n/)[1])).join(',')

  { // 乱序写入:把卡文件全删了按反序重写,输出一模一样(gen readdir 后按名排序)
    const files = readdirSync(blDir).sort()
    const texts = files.map((f) => readFileSync(join(blDir, f), 'utf8'))
    for (const f of files) rmSync(join(blDir, f))
    for (let i = files.length - 1; i >= 0; i--) writeFileSync(join(blDir, files[i]), texts[i])
    runGen(NEW_SCRIPTS, kb)
    ok(boardSha(kb) === splitSha, '卡文件的写入顺序不影响输出(按文件名读,不按文件系统给的顺序)')
  }
  { // order 才是显示顺序:把两张卡的 order 对调,深链表的键序跟着换
    const before = idmap()
    const a = rd(join(blDir, 'BL-1.json')), z = rd(join(blDir, 'BL-3.json'))
    wr(join(blDir, 'BL-1.json'), { ...a, order: z.order })
    wr(join(blDir, 'BL-3.json'), { ...z, order: a.order })
    runGen(NEW_SCRIPTS, kb)
    ok(before !== idmap(), `order 一换,深链表的键序跟着换(${before} → ${idmap()})`)
    wr(join(blDir, 'BL-1.json'), a); wr(join(blDir, 'BL-3.json'), z)
    runGen(NEW_SCRIPTS, kb)
    ok(boardSha(kb) === splitSha, 'order 换回来:输出回到基线')
  }
  { // ① 头文件残留数组
    const head = rd(blP)
    head.items = []
    wr(blP, head)
    const r = runGen(NEW_SCRIPTS, kb)
    ok(r.status !== 0 && /items/.test(r.stderr), '硬报错:头文件里还留着 items')
    delete head.items
    wr(blP, head)
  }
  { // ② 文件名与 id 不符
    const c = rd(join(blDir, 'BL-2.json'))
    rmSync(join(blDir, 'BL-2.json'))
    wr(join(blDir, 'BL-9.json'), c)
    const r = runGen(NEW_SCRIPTS, kb)
    ok(r.status !== 0 && /BL-9\.json/.test(r.stderr) && /BL-2/.test(r.stderr), '硬报错:文件名与卡里的 id 对不上(点名文件)')
    const stop = runStop(NEW_SCRIPTS, fx48b.root)
    ok(/BL-9\.json/.test(stop.stderr + stop.stdout), '守卫 notice:点名文件名与 id 不符的卡文件')
    rmSync(join(blDir, 'BL-9.json'))
    wr(join(blDir, 'BL-2.json'), c)
  }
  { // ③ 同一个 id 出现两次(两个子目录各一张,文件名都对得上,只有 id 撞)
    const decDir = join(kb, 'cards', 'decisions')
    wr(join(decDir, 'BL-1.json'), { id: 'BL-1', code: 'X', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '撞号' })
    const r = runGen(NEW_SCRIPTS, kb)
    ok(r.status !== 0 && /BL-1/.test(r.stderr), '硬报错:同一个 id 出现两次')
    rmSync(join(decDir, 'BL-1.json'))
  }
  { // ④ 目录不存在
    const cfg = rd(cfgP)
    wr(cfgP, { ...cfg, cardsDir: 'nope' })
    const r = runGen(NEW_SCRIPTS, kb)
    ok(r.status !== 0 && /nope/.test(r.stderr), '硬报错:cardsDir 指的目录不在')
    const stop = runStop(NEW_SCRIPTS, fx48b.root)
    ok(/nope/.test(stop.stderr + stop.stdout), '守卫 notice:卡目录不在')
    wr(cfgP, cfg)
  }
  { // ⑤ 卡文件不是合法 JSON
    writeFileSync(join(blDir, 'BL-4.json'), '{ 这不是 JSON')
    const r = runGen(NEW_SCRIPTS, kb)
    ok(r.status !== 0 && /BL-4\.json/.test(r.stderr), '硬报错:卡文件解析失败(点名文件)')
    const stop = runStop(NEW_SCRIPTS, fx48b.root)
    ok(/BL-4\.json/.test(stop.stderr + stop.stdout), '守卫 notice:点名解析失败的卡文件')
    rmSync(join(blDir, 'BL-4.json'))
    runGen(NEW_SCRIPTS, kb)
  }
}
{ // ⑥ 卡目录逃出看板目录 + 落盘中途失败要整块回滚
  const fx48d = mkFixture('fx48d', { 'c1.html': demoHtml('c1') })
  const kb = fx48d.kb
  const cfgP = join(kb, 'kanban.config.json'), blP = join(kb, 'backlog-manifest.json'), decP = join(kb, 'decisions-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const bl = rd(blP), dec = rd(decP)
  bl.tiers = { 1: '核心' }
  const st = Object.keys(bl.statuses)[0], pri = Object.keys(bl.priorities)[0]
  bl.items = [{ id: 'BL-1', status: st, priority: pri, tier: '1', date: '2026-01-01', title: '甲' }]
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策一' }]
  wr(blP, bl); wr(decP, dec)
  runGen(NEW_SCRIPTS, kb)
  const beforeBoard = sha(join(kb, 'index.html'))
  const beforeBl = readFileSync(blP, 'utf8'), beforeDec = readFileSync(decP, 'utf8'), beforeCfg = readFileSync(cfgP, 'utf8')

  { // --cards-dir 带路径:整批卡会落到看板目录外,而拆分自带的字节校验照样过(gen 读同一个路径)
    for (const v of ['../../OUTSIDE', 'a/b', '..', '.']) {
      const r = runScript('cards-split.mjs', kb, ['--cards-dir', v])
      ok(r.status === 1 && /纯目录名|plain directory name/.test(r.stderr), `cards-split 拒绝 --cards-dir ${v}`)
    }
    ok(!existsSync(join(kb, '..', '..', 'OUTSIDE')) && readFileSync(blP, 'utf8') === beforeBl, '拒绝之后看板目录外没长出东西,头文件一个字节都没变')
  }
  { // 配里写死的逃逸值:gen 硬报错点名它,守卫不因此崩掉
    wr(cfgP, { ...rd(cfgP), cardsDir: '../../OUTSIDE' })
    const r = runGen(NEW_SCRIPTS, kb)
    ok(r.status !== 0 && /OUTSIDE/.test(r.stderr), '硬报错:kanban.config.json 里的 cardsDir 逃出看板目录')
    const stop = runStop(NEW_SCRIPTS, fx48d.root)
    ok(stop.status !== null && /OUTSIDE/.test(stop.stderr + stop.stdout), '守卫把 gen 的这句原样喂回去,自己不崩', String(stop.status))
    writeFileSync(cfgP, beforeCfg)
    runGen(NEW_SCRIPTS, kb)
  }
  { // 落盘中途 EACCES:先建一个只读的 cards/decisions(空目录,过得了「必须是空的」那一关)
    const decDir = join(kb, 'cards', 'decisions')
    mkdirSync(decDir, { recursive: true })
    chmodSync(decDir, 0o555)
    const r = runScript('cards-split.mjs', kb)
    chmodSync(decDir, 0o755)
    ok(r.status === 1 && /回滚|rolled back/.test(r.stderr), `落盘失败时报的是「已回滚」,不是 Node 堆栈(${(r.stderr || '').split('\n')[0].slice(0, 60)})`)
    ok(readFileSync(blP, 'utf8') === beforeBl && readFileSync(decP, 'utf8') === beforeDec && readFileSync(cfgP, 'utf8') === beforeCfg,
      '两份头文件与 config 原样写回(items / entries / cardsDir 都在原位)')
    ok(!existsSync(join(kb, 'cards', 'backlog')), '已经写下去的那半批卡文件也收走了')
    ok(runGen(NEW_SCRIPTS, kb).status === 0 && sha(join(kb, 'index.html')) === beforeBoard, '回滚后 gen 照跑,产物与动手前逐字节相同')
    rmSync(join(kb, 'cards'), { recursive: true, force: true })
  }
}

{ // 守卫:新鲜度盯卡文件 + 孤儿语料纳入卡文件正文 + 积压/正文审计不因拆分失明
  const fx48c = mkFixture('fx48c', { 'c1.html': demoHtml('c1') })
  const kb = fx48c.kb
  const cfgP = join(kb, 'kanban.config.json'), blP = join(kb, 'backlog-manifest.json'), decP = join(kb, 'decisions-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const bl = rd(blP), dec = rd(decP)
  bl.tiers = { 1: '核心' }
  const st = Object.keys(bl.statuses)[0], pri = Object.keys(bl.priorities)[0]
  bl.items = [{ id: 'BL-1', status: 'ready', priority: pri, tier: '1', date: '2026-01-01', title: '甲', note: '短' }]
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: 'd', demo: 'demos/lone.html' }]
  wr(blP, bl); wr(decP, dec)
  writeFileSync(join(kb, 'demos', 'lone.html'), demoHtml('lone')) // 只被卡引用,不在 .no-card-ok 里
  const cfg = rd(cfgP)
  cfg.wip = { soft: 0, hard: 0 }
  cfg.richText = true
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  runScript('cards-split.mjs', kb)
  const idxP = join(kb, 'index.html')
  const s1 = runStop(NEW_SCRIPTS, fx48c.root)
  const out1 = JSON.parse(s1.stdout || '{}')
  ok(s1.status === 0 && !/lone\.html/.test(s1.stdout), '孤儿语料纳入卡文件:只写在卡里的 demo 不算孤儿')
  ok(/ready/.test(out1.systemMessage || '') || /1/.test(out1.systemMessage || ''), '积压审计仍数得到卡(拆分后从卡目录读)')
  // 新鲜度:只动一张卡文件,守卫应重跑 gen
  const cardP = join(kb, 'cards', 'backlog', 'BL-1.json')
  const c = rd(cardP)
  c.title = '甲改'
  wr(cardP, c)
  touch(cardP)
  runStop(NEW_SCRIPTS, fx48c.root)
  ok(readFileSync(idxP, 'utf8').includes('甲改'), '新鲜度盯住卡文件:改一张卡,守卫自动重跑 gen')
  // 正文长度审计:超长 note 而无 detail
  c.note = '长'.repeat(900)
  wr(cardP, c)
  touch(cardP)
  const s2 = runStop(NEW_SCRIPTS, fx48c.root)
  ok(/BL-1/.test(s2.stdout) && /800/.test(s2.stdout), '正文长度审计仍点得到名(拆分后从卡目录读)')
}
{ // 每卡更新日期:git 提交日优先,未提交的退文件 mtime
  const fx48d = mkFixture('fx48d', { 'c1.html': demoHtml('c1') })
  const kb = fx48d.kb, root = fx48d.root
  const blP = join(kb, 'backlog-manifest.json'), decP = join(kb, 'decisions-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const bl = rd(blP), dec = rd(decP)
  bl.tiers = { 1: '核心' }
  const st = Object.keys(bl.statuses)[0], pri = Object.keys(bl.priorities)[0]
  bl.items = [{ id: 'BL-1', status: 'ready', priority: pri, tier: '1', date: '2020-01-01', title: '甲' }]
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2020-01-01', title: 'd' }]
  wr(blP, bl); wr(decP, dec)
  writeFileSync(join(kb, 'release-manifest.json'), JSON.stringify(REL_MANIFEST, null, 2) + '\n') // 在场即开「沉睡」判定
  const idxP = join(kb, 'index.html')
  runGen(NEW_SCRIPTS, kb)
  ok(readFileSync(idxP, 'utf8').includes('data-dorm="2020-01-01"'), '未拆分时沉睡天数从建卡 date 起算(0.13.0 口径不变)')
  runScript('cards-split.mjs', kb)
  const today = new Date().toISOString().slice(0, 10)
  ok(readFileSync(idxP, 'utf8').includes(`title="卡文件最后改动 ${today}"`), '没提交过的卡:退回文件 mtime(降级链第二档)')
  ok(readFileSync(idxP, 'utf8').includes(`data-dorm="${today}"`), '拆分后沉睡天数改从卡文件最后改动日起算(1 月立的卡昨天动过,不算沉睡)')
  const gitEnv = { ...process.env, GIT_AUTHOR_DATE: '2020-05-06T00:00:00Z', GIT_COMMITTER_DATE: '2020-05-06T00:00:00Z' }
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: root })
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'cards'], { cwd: root, env: gitEnv })
  runGen(NEW_SCRIPTS, kb)
  const committed = readFileSync(idxP, 'utf8')
  ok(count(committed, 'title="卡文件最后改动 2020-05-06"') === 2, '提交过的卡:取 git 最后提交日(一条 git log 批量取,不是一卡一条)')
  ok(committed.includes('>更新 05-06<'), '卡头灰字是「更新 MM-DD」')
  ok(committed.includes('data-dorm="2020-05-06"'), '沉睡日期跟着走 git 提交日')
  // 只改一张卡(未提交)→ 它退 mtime,另一张仍是提交日
  const cardP = join(kb, 'cards', 'backlog', 'BL-1.json')
  const c = rd(cardP)
  c.title = '甲二'
  wr(cardP, c)
  runGen(NEW_SCRIPTS, kb)
  const mixed = readFileSync(idxP, 'utf8')
  ok(count(mixed, 'title="卡文件最后改动 2020-05-06"') === 2 && !mixed.includes(`title="卡文件最后改动 ${today}"`),
    '改了没提交:git 记的仍是最后一次提交日(gen 只认已提交的事实,不猜工作区)')
}

// ============ T49 拆分后 pr-sync 照常工作:PR→卡 反查 + --settle --write 写单张卡文件 ============
console.log('T49 拆分后的 pr-sync')
{
  const fx49 = mkFixture('fx49', { 's.html': demoHtml('s') })
  const kb = fx49.kb
  const relP = join(kb, 'release-manifest.json')
  const mP = join(kb, 'manifest.json'), decP = join(kb, 'decisions-manifest.json'), blP = join(kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  bl.tiers = { 1: '核心' }
  bl.items = [{ id: 'BL-1', status: 'ready', priority: 'high', tier: '1', title: '甲', note: '【2026-07-01】立卡', pr: 11 }]
  dec.entries = [{ id: 'D1', code: 'D1', status: 'decided', date: '2026-01-01', title: '决策甲', question: 'q', pr: 11 }]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  wr(relP, { stages: REL_MANIFEST.stages, releases: [], prs: [], syncedAt: null })
  runGen(NEW_SCRIPTS, kb)
  const sp = runScript('cards-split.mjs', kb)
  ok(sp.status === 0, `T49 拆分 exit 0(${(sp.stderr || '').trim()})`)
  const ghDir = join(WORK, 'fakegh49')
  mkdirSync(ghDir, { recursive: true })
  writeFileSync(join(ghDir, 'gh'), `#!/bin/sh
case "$1 $2" in
"pr list") echo '[{"number":11,"title":"甲","state":"MERGED","isDraft":false,"baseRefName":"main","headRefName":"feat/a","url":"https://github.com/o/r/pull/11","createdAt":"2026-07-18T01:00:00Z","mergedAt":"2026-07-19T01:00:00Z","closedAt":"2026-07-19T01:00:00Z"}]' ;;
"release list") echo '[]' ;;
esac
`)
  chmodSync(join(ghDir, 'gh'), 0o755)
  const runSync = (extra) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'pr-sync.mjs'), '--dir', kb, ...extra],
    { encoding: 'utf8', env: { ...process.env, PATH: ghDir } })
  const rs = runSync([])
  ok(rs.status === 0 && JSON.stringify(rd(relP).prs[0].cards.sort()) === JSON.stringify(['BL-1', 'D1']),
    'PR → 卡 反查从卡目录读得到(拆分后 prs[].cards 不会变空)', `${rs.stdout}${rs.stderr}`)
  const blCard = join(kb, 'cards', 'backlog', 'BL-1.json'), decCard = join(kb, 'cards', 'decisions', 'D1.json')
  const blText = readFileSync(blCard, 'utf8')
  const rw = runSync(['--settle', '--write'])
  ok(rw.status === 0, `--settle --write exit 0(${rw.stderr.slice(0, 200)})`)
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const want = JSON.parse(blText)
  want.status = 'done'
  want.note = `【2026-07-01】立卡\n\n【${today} 收账】PR#11 已合(自动)`
  ok(readFileSync(blCard, 'utf8') === JSON.stringify(want, null, 2) + '\n', '收账写的是那一张卡文件本身,形制不变(order 也还在)')
  ok(rd(decCard).status === 'live' && rd(decCard).order !== undefined, '决策卡同样按文件收账,order 字段没被 pr-sync 吃掉')
  const after = runGen(NEW_SCRIPTS, kb)
  ok(after.status === 0, `收账后 gen 仍 exit 0(${after.stderr.slice(0, 200)})`)
}

// ============ T50 写操作 CLI(建卡独占预留 / 校验 / 时间线 / 链接写 pr / export 同形 / 原子写)============
console.log('T50 写操作 CLI ddd.mjs')
{
  const { localDate } = await import(join(NEW_SCRIPTS, 'cards.mjs')) // 「今天」与 CLI 同一个源(本地日历)
  const runCli = (kb, args) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'ddd.mjs'), ...args, '--dir', kb], { encoding: 'utf8' })
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  /** 三张 backlog(BL- 一张、BL-C 两张:主流前缀是 BL-C)+ 一张决策 */
  const seed = (kb) => {
    const blP = join(kb, 'backlog-manifest.json'), decP = join(kb, 'decisions-manifest.json'), cfgP = join(kb, 'kanban.config.json')
    const bl = rd(blP), dec = rd(decP), cfg = rd(cfgP)
    bl.tiers = { 1: '核心', 2: '次要' }
    const item = (id, date, title, status) => ({ id, title, tier: '1', priority: 'med', status, line: 'C', session: 'dev', date, problem: 'p', approach: 'a', note: '【2026-01-01】立卡', links: [] })
    bl.items = [item('BL-1', '2026-01-01', '甲', 'ready'), item('BL-C7', '2026-02-01', '乙', 'ready'), item('BL-C9', '2026-03-01', '丙', 'blocked')]
    dec.entries = [{ id: 'D3', code: 'D3', status: 'deciding', line: 'C', session: 'dev', date: '2026-01-01', title: '决策三', question: 'q', decision: 'd', links: [] }]
    for (const x of [bl, dec]) x.instance.ghRepo = 'o/r'
    cfg.sessionTags = { dev: { label: 'dev' }, release: { label: 'release' } }
    cfg.lanes = { ids: ['B', 'C'], default: 'C', titles: { B: 'B', C: 'C' } }
    wr(blP, bl); wr(decP, dec); wr(cfgP, cfg)
    return { blP, decP, cfgP }
  }

  { // ---- 未拆模式:整文件重写也走同一套校验与形制 ----
    const fx = mkFixture('fx50a', { 'c1.html': demoHtml('c1') })
    const kb = fx.kb
    const { blP, decP, cfgP } = seed(kb)
    const preBl = rd(blP), preDec = rd(decP) // export 的比对基线(拆分前的原 manifest)

    const rn = runCli(kb, ['card', 'new', 'backlog', '--title', '甲二', '--line', 'C', '--session', 'release'])
    ok(rn.status === 0 && /BL-C10/.test(rn.stdout), `未拆模式建卡取主流前缀的最大号 +1 = BL-C10(${rn.stdout.trim().split('\n')[0]}${rn.stderr})`)
    const made = rd(blP).items.find((x) => x.id === 'BL-C10')
    ok(made && made.status === 'ready' && made.tier === '1' && made.priority === 'med' && made.date && /^\d{4}-\d{2}-\d{2}$/.test(made.date),
      '新卡落进 items 数组,status 取 statuses 第一个、日期是今天')
    ok(/^<.*>$/.test(made.problem) && /^<.*>$/.test(made.approach), '正文字段是 <…> 占位,等着人填')
    ok(Object.keys(made).join(',') === 'id,title,status,tier,priority,line,session,date,problem,approach,note,links',
      `键序规范:id/title 在前、长文居中、links 收尾(实得 ${Object.keys(made).join(',')})`)
    ok(readFileSync(blP, 'utf8') === JSON.stringify(rd(blP), null, 2) + '\n', '未拆模式整文件重写仍是 2 空格 + 末尾换行')
    ok(runGen(NEW_SCRIPTS, kb).status === 0, 'CLI 建的卡 gen 认(tier / priority / status 都在合法集里)')

    const rd2 = runCli(kb, ['card', 'new', 'decision', '--title', '决策四'])
    const dec4 = rd(decP).entries.find((x) => x.id === 'D4')
    ok(rd2.status === 0 && dec4 && dec4.code === 'D4', '决策卡号固定 D 前缀,code 默认取 id(缺 code 会让 gen 硬失败)')
    // --line 缺席时取 config.lanes.default:写 line:"" 的卡在配了 lanes 的板上默认视图里看不见
    ok(rd(blP).items.find((x) => x.id === 'BL-C10').line === 'C', '--line 缺席的 backlog 卡落在 lanes.default(C)上')
    ok(dec4.line === 'C', '--line 缺席的决策卡同样落在 lanes.default 上')
    ok(!/没有 line|no line/.test(rd2.stderr), '取到缺省档就不必再提醒')
    { // lanes.default 不在 ids 里 → 退 ids[0];--from 显式给空 line → 出一句提醒
      const cfgNow = rd(cfgP)
      cfgNow.lanes = { ids: ['B', 'C'], default: 'Z', titles: { B: 'B', C: 'C' } }
      wr(cfgP, cfgNow)
      const rf = runCli(kb, ['card', 'new', 'backlog', '--title', '缺省档兜底'])
      ok(rf.status === 0 && rd(blP).items.find((x) => x.id === 'BL-C11').line === 'B', 'lanes.default 不在 ids 里时退回 ids[0]')
      const fromP = join(kb, 'from-noline.json')
      writeFileSync(fromP, JSON.stringify({ line: '' }))
      const rg = runCli(kb, ['card', 'new', 'backlog', '--title', '显式无档', '--from', fromP])
      ok(rg.status === 0 && /没有 line|no line/.test(rg.stderr), '--from 显式给空 line:照写,但 stderr 说一句它只在「全部」档出现')
      cfgNow.lanes = { ids: ['B', 'C'], default: 'C', titles: { B: 'B', C: 'C' } }
      wr(cfgP, cfgNow)
    }

    const before = readFileSync(blP, 'utf8')
    const bad = [
      [['card', 'set', 'BL-C10', 'status', 'nope'], /statuses/],
      [['card', 'set', 'BL-C10', 'date', '2026-8-1'], /YYYY-MM-DD/],
      [['card', 'set', 'BL-C10', 'pr', 'xyz'], /owner\/repo#12/],
      [['card', 'set', 'BL-C10', 'line', 'Z'], /lanes\.ids/],
      [['card', 'set', 'BL-C10', 'session', 'nobody'], /sessionTags/],
      [['card', 'set', 'BL-C10', 'order', '3'], /order/],
      // id 改了 = 卡的身份没了:拆分后文件名与 id 对不上,gen 硬失败,CLI 也跟着拒跑
      [['card', 'set', 'BL-C10', 'id', 'BL-C900'], /card new|新建|建新卡/],
      [['card', 'set', 'BL-C10', 'id', 'BL-C9'], /card new|新建|建新卡/],
      // 数组字段给标量:gen 会在 .map 上 TypeError
      [['card', 'set', 'BL-C10', 'links', 'foo'], /--json/],
      [['card', 'set', 'BL-C10', 'shots', 'a.png'], /--json/],
      [['card', 'set', 'BL-C10', 'walkthroughs', 'x'], /--json/],
      [['card', 'set', 'BL-C10', 'links', '--json', '"foo"'], /--json/],
    ]
    for (const [args, re] of bad) {
      const r = runCli(kb, args)
      ok(r.status === 1 && re.test(r.stderr), `card set 拒绝:${args[3]} = ${args.slice(4).join(' ')}`)
    }
    ok(readFileSync(blP, 'utf8') === before, `${bad.length} 次拒绝之后 manifest 一个字节都没变`)
    { // 数组给数组照收
      const rok = runCli(kb, ['card', 'set', 'BL-C10', 'shots', '--json', '["a.png"]'])
      ok(rok.status === 0 && Array.isArray(rd(blP).items.find((x) => x.id === 'BL-C10').shots), 'shots 给数组照收')
    }

    const ru = runCli(kb, ['card', 'set', 'BL-C10', 'wombat', '42'])
    ok(ru.status === 0 && /wombat/.test(ru.stderr) && rd(blP).items.find((x) => x.id === 'BL-C10').wombat === '42',
      '不认识的字段只警告不拒(板上不渲染它,但人可能正打算加)')

    const rh = runCli(kb, ['card', 'history', 'BL-C10'])
    ok(rh.status === 1 && /cards-split/.test(rh.stderr), '未拆模式 card history 明说不可用,并指出该怎么办')

    // export 与拆分前的原 manifest 同形:先在未拆模式取一份,拆完再取一份,两份都要对得上
    const exp0 = JSON.parse(runCli(kb, ['export']).stdout)
    ok(JSON.stringify(exp0.backlog.items) === JSON.stringify(rd(blP).items) && JSON.stringify(exp0.decisions.entries) === JSON.stringify(rd(decP).entries),
      'export --json 在未拆模式下等于两份 manifest 的数组本身')
    ok(JSON.stringify(preBl.instance) === JSON.stringify(exp0.backlog.instance) && Object.keys(exp0.backlog).slice(-1)[0] === 'items',
      'export 的头与原 manifest 同形,数组仍在最后')

    { // --tier 缺席时默认取板上非 done 卡里最多的那档;显式给了就照给的值落,不管多数
      const rMaj = runCli(kb, ['card', 'new', 'backlog', '--title', '默认档'])
      const idMaj = rMaj.stdout.match(/BL-C\d+/)[0]
      ok(rMaj.status === 0 && rd(blP).items.find((x) => x.id === idMaj).tier === '1',
        '--tier 缺席:板上非 done 卡多数是 tier "1",新卡也落在 "1" 上')
      const rTier = runCli(kb, ['card', 'new', 'backlog', '--title', '指定档', '--tier', '2'])
      const idTier = rTier.stdout.match(/BL-C\d+/)[0]
      ok(rTier.status === 0 && rd(blP).items.find((x) => x.id === idTier).tier === '2',
        '--tier 2 显式给了就照给的值落,不管板上多数是哪档')
    }
  }

  { // ---- 拆分模式:一张卡一次原子写,号靠 openSync('wx') 预留 ----
    const fx = mkFixture('fx50b', { 'c1.html': demoHtml('c1') })
    const kb = fx.kb
    const { blP, decP, cfgP } = seed(kb)
    const preBl = rd(blP), preDec = rd(decP)
    runGen(NEW_SCRIPTS, kb)
    ok(runScript('cards-split.mjs', kb).status === 0, 'T50 拆分 exit 0')
    const blDir = join(kb, 'cards', 'backlog')

    const a = runCli(kb, ['card', 'new', 'backlog', '--title', '拆后一'])
    const b = runCli(kb, ['card', 'new', 'backlog', '--title', '拆后二'])
    ok(/BL-C10/.test(a.stdout) && /BL-C11/.test(b.stdout), `连着两次 new 拿到不同号(${a.stdout.trim().split('\n')[0]} / ${b.stdout.trim().split('\n')[0]})`)
    ok(existsSync(join(blDir, 'BL-C10.json')) && existsSync(join(blDir, 'BL-C11.json')), '两张卡各落成一个文件')
    ok(rd(join(blDir, 'BL-C10.json')).order === undefined, '手工新卡不写 order(gen 排完即删,缺席就按 id 排在最后)')

    writeFileSync(join(blDir, 'BL-C12.json'), JSON.stringify({ id: 'BL-C12', title: '占位', status: 'ready', tier: '1', priority: 'med', links: [] }, null, 2) + '\n')
    const c = runCli(kb, ['card', 'new', 'backlog', '--title', '跳号'])
    ok(/BL-C13/.test(c.stdout), `目标号已被占 → 跳到下一号(${c.stdout.trim().split('\n')[0]})`)

    // 真并发:两个进程同时算出同一个号,'wx' 让抢输的那个退到下一号而不是覆盖
    const spawnCli = (args) => new Promise((res) => {
      let out = ''
      const p = spawn(process.execPath, [join(NEW_SCRIPTS, 'ddd.mjs'), ...args, '--dir', kb, '--json'])
      p.stdout.on('data', (d) => { out += d })
      p.on('close', () => res(out))
    })
    const [p1, p2] = await Promise.all([spawnCli(['card', 'new', 'backlog']), spawnCli(['card', 'new', 'backlog'])])
    const id1 = JSON.parse(p1).id, id2 = JSON.parse(p2).id
    ok(id1 !== id2 && existsSync(join(blDir, `${id1}.json`)) && existsSync(join(blDir, `${id2}.json`)),
      `并发两次 new 拿到不同号,两张卡都在(${id1} / ${id2})—— 号是 'wx' 预留出来的,不是算出来的`)

    // 时间线:status 默认附一行,--no-note 关掉;拆分卡的 order 不被写路径吃掉
    const one = join(blDir, 'BL-1.json')
    const orderBefore = rd(one).order
    const rs = runCli(kb, ['card', 'status', 'BL-1', 'done'])
    const afterStatus = rd(one)
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    ok(rs.status === 0 && afterStatus.status === 'done' && afterStatus.note === `【2026-01-01】立卡\n\n【${today}】status → done`,
      'card status 改状态并在 note 末尾追一行时间线')
    ok(afterStatus.order === orderBefore, 'order 原样留着(它是显示顺序,写路径不许动它)')
    ok(readFileSync(one, 'utf8') === JSON.stringify(afterStatus, null, 2) + '\n', '卡文件仍是 2 空格 + 末尾换行')
    runCli(kb, ['card', 'status', 'BL-1', 'ready', '--no-note'])
    ok(rd(one).status === 'ready' && rd(one).note === afterStatus.note, '--no-note:只改 status,时间线一行都不加')
    const rnote = runCli(kb, ['card', 'note', 'BL-1', '上游 PR 开了'])
    ok(rnote.status === 0 && rd(one).note.endsWith(`【${today}】上游 PR 开了`), 'card note 追一行带日期的进展')
    { // 决策卡没有时间线字段:gen 的 decCard 不渲染 note/notes,往那儿写就是写给谁也看不见的地方
      const decCard = join(kb, 'cards', 'decisions', 'D3.json')
      const beforeDec = readFileSync(decCard, 'utf8')
      const rdn = runCli(kb, ['card', 'note', 'D3', 'ZZ 一句进展'])
      ok(rdn.status === 1 && /没有时间线字段|no timeline field/.test(rdn.stderr), 'card note 在决策卡上拒写,并说该写 detail')
      ok(readFileSync(decCard, 'utf8') === beforeDec, '拒写之后决策卡一个字节都没变')
      const rds = runCli(kb, ['card', 'status', 'D3', 'live'])
      const after = rd(decCard)
      ok(rds.status === 0 && after.status === 'live', 'card status 照改决策卡的状态')
      ok(after.notes === undefined && after.note === undefined, '不顺手塞一个 gen 不渲染的时间线字段进去')
      ok(/没有时间线字段|no timeline field/.test(rds.stdout), '回执说明白了为什么没有时间线那一行(不是谎称 --no-note)')
      const rdset = runCli(kb, ['card', 'set', 'D3', 'notes', '硬写'])
      ok(rdset.status === 0 && /notes/.test(rdset.stderr), '真要硬写 notes 也拦不住,但会警告板上不渲染它')
      writeFileSync(decCard, beforeDec) // 这张卡后面还要与拆分前的 manifest 深比较,原样放回去
    }
    ok(rd(join(kb, 'cards', 'backlog', 'BL-C7.json')).note === '【2026-01-01】立卡', '写一张卡不碰别的卡(一卡一文件的整个理由)')

    // 链接:去重 + 本仓 PR 链接顺手写 pr
    const rl = runCli(kb, ['card', 'link', 'BL-1', 'PR #7', 'https://github.com/o/r/pull/7'])
    ok(rl.status === 0 && rd(one).pr === 7 && rd(one).links.some((l) => l.href.endsWith('/pull/7')),
      'card link 挂链接,并把本仓 PR 号写进 pr 字段(卡头芯片只认这一档)')
    const rl2 = runCli(kb, ['card', 'link', 'BL-1', '重复', 'https://github.com/o/r/pull/7'])
    ok(rl2.status === 0 && rd(one).links.filter((l) => l.href.endsWith('/pull/7')).length === 1, '同一个 href 不重复挂')
    runCli(kb, ['card', 'link', 'BL-1', 'PR #9', 'https://github.com/o/r/pull/9'])
    ok(JSON.stringify(rd(one).pr) === '[7,9]', '第二个 PR 号并进数组,不顶掉第一个')
    runCli(kb, ['card', 'link', 'BL-1', '上游', 'https://github.com/other/repo/pull/3'])
    ok(JSON.stringify(rd(one).pr) === '[7,9]', '别的仓的 PR 链接不写进 pr(板上有旧仓链接,号会撞)')

    // 原子写:目标目录只读 → 报错退出,原文件一个字节不变
    const shaBefore = sha(one)
    chmodSync(blDir, 0o500)
    const rw = runCli(kb, ['card', 'note', 'BL-1', '写不进去'])
    chmodSync(blDir, 0o700)
    ok(rw.status === 1 && /EACCES|EPERM/.test(rw.stderr) && sha(one) === shaBefore,
      '写不进去时原文件一个字节都没变(临时文件 + rename,半截文件落不到卡的位置上)')
    { // 建卡也一样:预留不成就什么都不留 —— 留下的 0 字节文件会让 gen 当场硬失败、守卫阻断收工
      const before = readdirSync(blDir).sort().join(' ')
      chmodSync(blDir, 0o500)
      const rn2 = runCli(kb, ['card', 'new', 'backlog', '--title', '建不出来'])
      chmodSync(blDir, 0o700)
      ok(rn2.status === 1 && readdirSync(blDir).sort().join(' ') === before, '建卡失败时卡目录里不多一个文件(空占位不留下)')
    }

    // git 历史:一卡一文件之后每张卡有自己的 log
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: fx.root })
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'cards'], { cwd: fx.root })
    const rh = runCli(kb, ['card', 'history', 'BL-1'])
    ok(rh.status === 0 && /cards\/backlog\/BL-1\.json/.test(rh.stdout) && /cards$/m.test(rh.stdout.trim()), 'card history 列出这张卡文件的提交')

    // export:拆分后合出来的一坨,与拆分前的 manifest 深比较相等
    const exp = JSON.parse(runCli(kb, ['export']).stdout)
    const strip = (list) => list.map((x) => { const y = { ...x }; delete y.order; return y })
    ok(JSON.stringify(exp.decisions.entries) === JSON.stringify(preDec.entries),
      'export 出来的决策数组与拆分前逐字段、逐顺序相同(order 已去掉)')
    ok(JSON.stringify(Object.keys(exp.backlog)) === JSON.stringify(Object.keys(preBl)),
      'export 出来的 backlog 头与拆分前同形(items 仍在最后)')
    ok(JSON.stringify(strip(exp.backlog.items).slice(0, 3).map((x) => x.id)) === JSON.stringify(preBl.items.map((x) => x.id)),
      'export 的顺序是 order 再 id —— 原来的三张卡还是原来的先后')
    const outP = join(kb, 'exported.json')
    runCli(kb, ['export', '--out', outP])
    ok(readFileSync(outP, 'utf8') === JSON.stringify(exp, null, 2) + '\n', '--out 落盘的与 stdout 的逐字节相同(2 空格 + 末尾换行)')
    rmSync(outP)

    ok(runGen(NEW_SCRIPTS, kb).status === 0, 'CLI 折腾一轮之后 gen 仍 exit 0')
  }

  { // ---- wip 联动:建卡之后照守卫的口径数一遍 ready ----
    const fx = mkFixture('fx50c', { 'c1.html': demoHtml('c1') })
    const kb = fx.kb
    const { blP, cfgP } = seed(kb)
    const cfg = rd(cfgP)
    cfg.wip = { soft: 0, hard: 0 }
    wr(cfgP, cfg)
    const r = runCli(kb, ['card', 'new', 'backlog', '--title', '又一张'])
    ok(r.status === 0 && /config\.wip\.hard = 0/.test(r.stderr), 'card new 之后 ready 超 hard:stderr 上一句与守卫同款的提醒')
    ok(!/config\.wip\.hard/.test(r.stdout), '提醒走 stderr,不脏 --json 的管道')
    // v0.16.0 的口径(等前置的不占额度)在横幅与守卫都有用例,CLI 这句原来没有 —— 种子里一条
    // after 都没有,waiting 结构上恒 0,把 `ready.length - waiting + own` 改回 `ready.length + own`
    // 全套仍绿,而 CLI 会用一个和横幅、守卫都对不上的数喊「超过 hard」。
    const blW = rd(blP); blW.items.find((i) => i.id === 'BL-1').after = ['#230']; wr(blP, blW)
    writeFileSync(join(kb, 'release-manifest.json'), JSON.stringify(REL_MANIFEST, null, 2) + '\n')
    const r2 = runCli(kb, ['card', 'new', 'backlog', '--title', '再一张'])
    ok(/另有 1 张 ready 还等着前置/.test(r2.stderr), 'CLI 与横幅、守卫同一口径:等前置的另计', (r2.stderr.match(/可立即做[^,]*,[^,]*/) || [''])[0])
    ok(/可立即做\(ready 且前置已清\)的卡有 3 张/.test(r2.stderr), '并且额度只按扣掉它之后的数算(板上 3 张 ready + 刚建的 1 张 − 1 张等前置)', r2.stderr.slice(0, 200))
  }

  { // ---- --from 带进来的 settleHold 同样记起算日(card set 那条路早有用例,建卡这条路没有)----
    const fx = mkFixture('fx50e', { 'c1.html': demoHtml('c1') })
    const kb = fx.kb
    seed(kb)
    const fromP = join(kb, 'from.json')
    writeFileSync(fromP, JSON.stringify({ title: '从模板建的', status: 'ready', tier: '1', priority: 'med', problem: 'p', approach: 'a', settleHold: '只落了一半' }, null, 2))
    const r = runCli(kb, ['card', 'new', 'backlog', '--from', fromP, '--json'])
    const made = JSON.parse(r.stdout)
    ok(r.status === 0 && made.card.settleHoldAt === localDate(), '--from 带进来一个 settleHold:起算日照记(不然那 14 天的钟从卡文件最后改动日起算,甚至根本不起算)',
      `${r.status} ${made.card && made.card.settleHoldAt}`)
    rmSync(fromP)
  }

  { // ---- pr-sync 别名:原样转调,连退出码 ----
    const fx = mkFixture('fx50d', { 'c1.html': demoHtml('c1') })
    const r = spawnSync(process.execPath, [join(NEW_SCRIPTS, 'ddd.mjs'), 'pr-sync', '--dir', fx.kb], { encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' } })
    ok(r.status === 1 && /pr-sync/.test(r.stdout + r.stderr), 'ddd pr-sync 转调 pr-sync.mjs(参数与退出码原样)')
  }
}

// ============ T51 截图文件名不进 shell(gen 每次收工由守卫自动跑,文件名是外来输入)============
console.log('T51 截图文件名不进 shell')
{
  const fx = mkFixture('fx51', { 'c1.html': demoHtml('c1') })
  const marker = join(fx.kb, 'PWNED_MARKER')
  const evil = 'a";touch PWNED_MARKER;".png'
  writeFileSync(join(fx.kb, 'shots', evil), 'not-a-real-png')
  const r = runGen(NEW_SCRIPTS, fx.kb)
  ok(r.status === 0, 'gen 照常跑完(带引号/分号的截图文件名不是错误,只是个文件名)')
  ok(!existsSync(marker), '文件名里的 `;touch …;` 没有被当成命令执行')
  ok(readFileSync(join(fx.kb, 'shots.html'), 'utf8').includes('&quot;'), '文件名原样转义后进了截图廊')
}

// ============ T52 href 只认 http/https/mailto 与相对路径(esc 挡逃逸,挡不住 scheme)============
console.log('T52 链接协议白名单')
{
  const fx = mkFixture('fx52', { 'c1.html': demoHtml('c1') })
  const kb = fx.kb
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const blP = join(kb, 'backlog-manifest.json'), cfgP = join(kb, 'kanban.config.json')
  const bl = rd(blP)
  bl.tiers = { 1: '核心' }
  bl.instance.ghRepo = 'o/r'
  bl.items = [{
    id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1',
    date: '2026-01-01', title: '甲',
    links: [
      { title: '坏的', href: 'javascript:alert(9)//"><img src=y onerror=alert(2)>' },
      { title: '也坏', href: 'data:text/html,<script>alert(1)</script>' },
      { title: '好的', href: 'https://example.com/x' },
      { title: '相对', href: 'demos/c1.html' },
      { title: '锚点', href: '#BL-1' },
      { title: '邮件', href: 'mailto:a@b.c' },
    ],
  }]
  wr(blP, bl)
  const r = runGen(NEW_SCRIPTS, kb)
  ok(r.status === 0, 'gen 照常跑完(坏链接不是硬失败,是渲染成不可点)', r.stderr)
  ok(/协议不在白名单|not allowed/.test(r.stderr), 'stderr 点名说了哪个链接被拦下')
  const idx = readFileSync(join(kb, 'index.html'), 'utf8')
  ok(!idx.includes('href="javascript:') && !idx.includes('href="data:'), 'javascript: / data: 都没落进 href')
  ok(idx.includes('href="https://example.com/x"') && idx.includes('href="demos/c1.html"') && idx.includes('href="#BL-1"') && idx.includes('href="mailto:a@b.c"'),
    'http(s) / 相对路径 / 锚点 / mailto 原样放行')

  // 发布进度表的 PR url 同样过白名单
  const cfg = rd(cfgP)
  cfg.releaseTab = true
  wr(cfgP, cfg)
  for (const f of ['manifest.json', 'decisions-manifest.json', 'backlog-manifest.json']) {
    const o = rd(join(kb, f))
    o.instance.ghRepo = 'o/r'; o.instance.branch = 'main'
    wr(join(kb, f), o)
  }
  wr(join(kb, 'release-manifest.json'), {
    instance: { ghRepo: 'o/r', branch: 'main' },
    stages: [{ id: 'dev', label: 'dev' }, { id: 'test', label: 'test' }, { id: 'prod', label: 'prod' }],
    releases: [],
    prs: [{ number: 7, title: 't', state: 'open', draft: false, base: 'main', branch: 'b', url: 'javascript:alert(7)', createdAt: '2026-01-01T00:00:00Z', mergedAt: null, closedAt: null, cards: [] }],
  })
  const r2 = runGen(NEW_SCRIPTS, kb)
  const idx2 = r2.status === 0 ? readFileSync(join(kb, 'index.html'), 'utf8') : ''
  ok(r2.status === 0 && !idx2.includes('href="javascript:alert(7)"'), 'release-manifest 里手写的 PR url 也过同一条白名单', r2.stderr.slice(0, 160))

  // CLI 在坏值进卡文件之前就拦下
  const rc = spawnSync(process.execPath, [join(NEW_SCRIPTS, 'ddd.mjs'), 'card', 'link', 'BL-1', '坏的', 'javascript:alert(1)', '--dir', kb], { encoding: 'utf8' })
  ok(rc.status === 1 && /白名单|not allowed/.test(rc.stderr), 'ddd card link 拒绝 javascript: 链接')
  ok(!readFileSync(blP, 'utf8').includes('javascript:alert(1)'), '拒绝之后卡文件里没有这条链接')
}

// ============ T53 文档 / 截图的更新日期批量取(一条 git log,不是一篇一条命令)============
console.log('T53 更新日期批量取')
{
  const fx = mkFixture('fx53', { 'c1.html': demoHtml('c1') })
  const kb = fx.kb, root = fx.root
  const git = (args, when) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd: root,
    env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
  })
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(join(root, 'docs', 'a.md'), '# 甲\n\n一段。\n')
  writeFileSync(join(root, 'docs', 'b.md'), '# 乙\n\n一段。\n')
  writeFileSync(join(kb, 'shots', 'd1-one.png'), 'x')
  writeFileSync(join(kb, 'shots', 'd1-two.png'), 'y')
  const cfgP = join(kb, 'kanban.config.json')
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.docs = [
    { path: 'docs/a.md', out: 'a.html', baseDir: 'docs', title: '甲', category: '设计与决策' },
    { path: 'docs/b.md', out: 'b.html', baseDir: 'docs', title: '乙', category: '设计与决策' },
    { path: 'docs/c.md', out: 'c.html', baseDir: 'docs', title: '丙(未提交)', category: '设计与决策' },
  ]
  writeFileSync(cfgP, JSON.stringify(cfg))
  git(['add', 'docs/a.md', 'app/kanban/shots/d1-one.png'], '2026-03-01T10:00:00+00:00')
  git(['commit', '-q', '-m', '甲'], '2026-03-01T10:00:00+00:00')
  git(['add', 'docs/b.md', 'app/kanban/shots/d1-two.png'], '2026-04-02T10:00:00+00:00')
  git(['commit', '-q', '-m', '乙'], '2026-04-02T10:00:00+00:00')
  writeFileSync(join(root, 'docs', 'a.md'), '# 甲\n\n改过。\n') // 再改一次:取的是最后一次,不是第一次
  git(['add', 'docs/a.md'], '2026-05-03T10:00:00+00:00')
  git(['commit', '-q', '-m', '甲二'], '2026-05-03T10:00:00+00:00')
  writeFileSync(join(root, 'docs', 'c.md'), '# 丙\n\n还没提交。\n') // untracked → 退 mtime

  const r = runGen(NEW_SCRIPTS, kb)
  ok(r.status === 0, 'gen exit 0', r.stderr)
  const idx = readFileSync(join(kb, 'index.html'), 'utf8')
  ok(idx.includes('data-doc="a.html" data-line="" data-updated="2026-05-03"'), '文档取的是最后一次提交日,不是第一次')
  ok(idx.includes('data-doc="b.html" data-line="" data-updated="2026-04-02"'), '同一批 git log 里另一篇文档各归各的日期')
  // 期望值与产品同源:gen 的 mtime 降级档一律 statSync(...).mtime.toISOString().slice(0, 10)(UTC),
  // 本地时区格式化会让 UTC+N 的机器在「本地已跨日、UTC 还没跨」的那几个钟头里假红。
  const mtimeDay = (p) => statSync(p).mtime.toISOString().slice(0, 10)
  ok(idx.includes(`data-doc="c.html" data-line="" data-updated="${mtimeDay(join(root, 'docs', 'c.md'))}"`), '没提交过的文档退回文件 mtime(降级链没断)')
  const shots = readFileSync(join(kb, 'shots.html'), 'utf8')
  ok(shots.includes('>d1-one.png</span><span class="dt">2026-03-01<'), '截图取自己那次提交日')
  ok(shots.includes('>d1-two.png</span><span class="dt">2026-04-02<'), '同一批里另一张截图各归各的日期')
  writeFileSync(join(kb, 'shots', 'd1-three.png'), 'z') // untracked
  runGen(NEW_SCRIPTS, kb)
  ok(readFileSync(join(kb, 'shots.html'), 'utf8').includes(`>d1-three.png</span><span class="dt">${mtimeDay(join(kb, 'shots', 'd1-three.png'))}<`), '没提交过的截图退回文件 mtime')
}

// ============ T54 线别分段熬得过懒注入(事件委托 + 每次现查;静态 NodeList 是 BL-C105 的根)============
console.log('T54 线别分段 × 懒注入')
{
  const fx54 = mkFixture('fx54', { 's.html': demoHtml('s') })
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const cfgP = join(fx54.kb, 'kanban.config.json')
  const idxP = join(fx54.kb, 'index.html')
  const blP = join(fx54.kb, 'backlog-manifest.json')
  const bl = JSON.parse(readFileSync(blP, 'utf8'))
  bl.tiers = { 1: '核心' }
  bl.items = [{ id: 'BL-1', status: Object.keys(bl.statuses)[0], priority: Object.keys(bl.priorities)[0], tier: '1', line: 'C', title: '待办乙' }]
  wr(blP, bl)
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.lanes = { ids: ['B', 'C'], default: 'C', titles: { B: '乙档', C: '丙档' } }
  cfg.lazyTabs = true
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, fx54.kb)
  ok(r.status === 0, 'lanes + lazyTabs 同开 gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  const partB = readFileSync(join(fx54.kb, 'parts/backlog.html'), 'utf8')
  // 物证:分段整个住在 part 里,且模板给「全部」硬写了 class="on" —— 壳初始化时它压根不在 DOM
  ok(partB.includes('id="bllineseg"') && /data-line="all" class="on"/.test(partB) && !on.includes('id="bllineseg"'),
    '线别分段随 parts/backlog.html 才到,壳里没有(模板给「全部」硬写 on)')
  ok(!/lineBtns/.test(on), '壳内 0 处 lineBtns:不再缓存初始化时的静态 NodeList,也没有逐按钮 addEventListener')
  ok(/document\.addEventListener\('click', \(ev\) => \{\s*const lb = ev\.target\.closest\(LINE_BTN_SEL\)\s*if \(lb\) setLine\(lb\.dataset\.line\)/.test(on),
    '线别改事件委托挂在 document 上:懒注入之后进来的分段照样点得动')
  ok(/function syncLineBtns\(line\) \{\s*document\.querySelectorAll\(LINE_BTN_SEL\)/.test(on) && /\n {4}syncLineBtns\(line\)\n/.test(on),
    'setLine 的 .on 高亮每次现查(几十个节点),不吃陈旧快照')
  const inj = (on.match(/function onPaneInjected\(name\) \{[\s\S]*?\n {2}\}/) || [''])[0]
  ok(/syncLineBtns\(curLine\)/.test(inj), 'onPaneInjected 补一次线别同步:注入进来的分段立即反映当前线别,不让「全部」亮着说谎', inj.slice(0, 160))
  { // 整壳编译级锚:委托改写不许把整板 JS 打死
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'lanes + lazyTabs 壳内联 JS 可编译')
  }
  { // 非懒模式共用同一份 JS:委托同样在,行为不变
    cfg.lazyTabs = false
    wr(cfgP, cfg)
    runGen(NEW_SCRIPTS, fx54.kb)
    const off = readFileSync(idxP, 'utf8')
    ok(off.includes('id="bllineseg"') && off.includes('ev.target.closest(LINE_BTN_SEL)') && !/lineBtns/.test(off),
      '非懒模式:分段就在壳里,同样走委托(一份实现两种形态)')
  }

  { // ---- line 是外来输入(卡文件手写):进 data-line= 前要过 esc,不然一个引号能把 <article> 拆开 ----
    const hostile = JSON.parse(readFileSync(blP, 'utf8'))
    hostile.items = [{ ...hostile.items[0], id: 'BL-9', line: 'C" onmouseover=alert(77) x="' }]
    wr(blP, hostile)
    const r = runGen(NEW_SCRIPTS, fx54.kb)
    const h = readFileSync(idxP, 'utf8')
    ok(r.status === 0 && h.includes('id="BL-9" data-line="C&quot; onmouseover=alert(77) x=&quot;"'),
      'data-line 里的引号转义掉 —— 同一个标签上别的属性本来就都过了 esc,漏这一个就是活的事件处理器',
      (h.match(/id="BL-9"[^>]{0,120}/) || [''])[0])
    ok(!h.includes('" onmouseover='), '标签没被拆开:全文没有一处真引号后面跟着 onmouseover=(转义前那是个活的事件处理器)')
    ok(/line 值不在 config\.lanes\.ids/.test(r.stderr), 'gen 顺带出声:这个 line 不在 ids 里,这张卡在任何一档下都不会出现(CLI 早就拦,手写的卡拦不住)', r.stderr.slice(0, 200))
    wr(blP, bl)
    runGen(NEW_SCRIPTS, fx54.kb)
  }
}

// ============ T55 左侧竖向 tab 导航 tabRail(opt-in;关档逐字节冻结;清单与 tab 条同一份)============
console.log('T55 左侧竖向 tab 导航 tabRail')
{
  const fx55 = mkFixture('fx55', { 's.html': demoHtml('s') })
  const cfgP = join(fx55.kb, 'kanban.config.json'), idxP = join(fx55.kb, 'index.html')
  const blP = join(fx55.kb, 'backlog-manifest.json')
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const bl = JSON.parse(readFileSync(blP, 'utf8'))
  bl.tiers = { 1: '核心' }
  bl.items = [
    { id: 'BL-1', status: 'ready', priority: 'high', tier: '1', date: '2026-02-01', title: '待办甲' },
    { id: 'BL-2', status: 'done', priority: 'low', tier: '1', date: '2026-01-03', title: '旧账乙' },
  ]
  wr(blP, bl)
  // ---- 四拍:未配 → false 比 sha → true 验行为 → 关回比 sha ----
  runGen(NEW_SCRIPTS, fx55.kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('tabrail') && !off.includes('railitem'), '未配 tabRail:壳里零 rail 痕迹')
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.tabRail = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx55.kb)
  ok(sha(idxP) === offSha, 'tabRail:false 与未配逐字节相同(冻结)')

  cfg.tabRail = true
  cfg.backlogArchive = true // 顺手证明可选 tab(归档)也自动进 rail —— 清单是解析出来的,不是抄的
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, fx55.kb)
  ok(r.status === 0, 'tabRail:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  const nav = (on.match(/<nav class="tabrail"[\s\S]*?<\/nav>/) || [''])[0]
  const tabbar = (on.match(/<div class="tabbar">[\s\S]*?<\/div>/) || [''])[0]
  ok(count(on, 'class="tabrail"') === 1 && /^<nav class="tabrail" hidden aria-label="/.test(nav),
    'rail 恰一条,初始 hidden 且有 aria-label', nav.slice(0, 80))
  const nTab = (tabbar.match(/class="tab[ "]/g) || []).length // [ "] 挡开外层容器的 class="tabbar"
  ok(count(nav, 'class="railitem') === nTab && nTab > 3,
    'rail 项数 = tab 条项数(含截图那个出站链接)', `${count(nav, 'class="railitem')} vs ${nTab}`)
  const panesOf = (s) => [...s.matchAll(/data-pane="([^"]+)"/g)].map((m) => m[1]).join(',')
  ok(panesOf(nav) === panesOf(tabbar) && panesOf(nav).includes('archive'),
    'data-pane 集合与顺序同 tab 条一致(归档这类可选 tab 一并在内)', `${panesOf(nav)} vs ${panesOf(tabbar)}`)
  ok(count(nav, 'class="railitem on"') === 1 && /class="railitem on" data-pane="progress"/.test(nav),
    '初始高亮恰一项,且是 tab 条上 tab-active 的那一个')
  ok(/<a class="railitem" href="shots\.html">/.test(nav) && !/<a class="railitem"[^>]*data-pane/.test(nav),
    '截图那项烤成无 data-pane 的出站链接(点它照旧跳走,不当 tab 切)')
  ok(/tabs\.forEach\(\(t\) => t\.classList\.toggle\('tab-active'[^\n]*\n\s*document\.querySelectorAll\('\.railitem\[data-pane\]'\)\.forEach\(\(r\) => r\.classList\.toggle\('on'/.test(on),
    "show() 里跟着一句 rail 高亮同步(幂等,深链/懒加载都走同一条路)")
  ok(/setLine[\s\S]{0,4000}?\.railitem\[data-pane\][\s\S]{0,200}?r\.textContent = t\.textContent/.test(on),
    'setLine 重算 tab 徽章后,rail 文案直接抄 tab 按钮的现值(一份口径)')
  ok(on.includes("typeof IntersectionObserver !== 'function'") && on.includes("matchMedia('(min-width: 1200px)')") &&
    !on.includes('e.boundingClientRect.top < 0'),
    'IO 缺席则静默不显示;窄屏永不显示;旧的「只认向上滑出」条件已撤(0.15.3)')
  // rail 的 CSS 是样式表最后一段(TABRAIL_CSS 挂在尾链末端),从它的段头切到 </style> 即整段
  const railCss = on.slice(on.indexOf('/* ============ 左侧竖向 tab 导航'), on.indexOf('</style>'))
  ok(railCss.includes('.tabrail { display: none; }') && railCss.includes('@media (min-width: 1200px)') &&
    railCss.includes('.tabrail:not([hidden])') && railCss.includes('top: calc(var(--hubh, 41px) + 8px)'),
    'CSS:默认不显示,显示规则整个包在宽屏媒体查询里,top 跟 --hubh(hubbar 实高)走')
  ok(!/#[0-9a-fA-F]{3}/.test(railCss) && railCss.length > 200,
    'rail CSS 零硬编码色值:只用既有 var(),暗档跟着同一条 light-dark 链走', railCss.length + ' 字符')
  // ---- 0.15.1:点 rail 项落到 tab 条,不再落 pane 顶(落 pane 顶 = tab 条被顶出视口,rail 又只在那时才在) ----
  {
    const railStart = on.indexOf("var rail = document.querySelector('.tabrail')")
    const railJs = on.slice(railStart, on.indexOf('})()', railStart) + 4)
    const railClick = railJs.slice(railJs.indexOf("rail.addEventListener('click'"))
    ok(/window\.scrollTo\(\{ top: Math\.max\(0, bar\.getBoundingClientRect\(\)\.top \+ window\.scrollY - hubH - 8\) \}\)/.test(railClick),
      '点 rail 项:落点算式量的是 tab 条(bar),贴 hubbar 下沿停住', railClick.slice(-140))
    ok(!/pane-'\s*\+\s*name/.test(railClick) && !/pane\.getBoundingClientRect/.test(railClick),
      '点 rail 项:不再滚到 pane 顶(那会把 tab 条顶出视口,rail 也跟着隐,两头都看不见)')
    ok(/rootMargin: '-' \+ hubH \+ 'px 0px 0px 0px', threshold: 0 \}\)/.test(railJs) && /io\.observe\(bar\)/.test(railJs),
      'IO 的 root 顶边压到 hubbar 实高(rootMargin 引用 hubH),阈值仍显式 0', railJs.slice(railJs.indexOf('rootMargin'), railJs.indexOf('rootMargin') + 90))
    ok(/var held = false/.test(railJs) && /rail\.hidden = !\(held \|\| \(gone && wide\.matches\)\)/.test(railJs) &&
      railJs.includes("matches(':focus-visible')") && railJs.includes("rail.addEventListener('focusout'"),
      '键盘焦点还落在 rail 里就先不收走(只认 :focus-visible,鼠标点不算)')
    ok(railCss.includes('.railitem:hover, .railitem:focus-visible'),
      'rail 项键盘获焦有可见样式(与 hover 同一档)')
    // ---- 0.15.3:sticky hubbar 与 IO 视口之间的交接空档 ----
    ok(/var gone = bar\.getBoundingClientRect\(\)\.bottom <= hubH \+ 1/.test(railJs),
      '显隐判定量的是 tab 条底边(bottom ≤ hubH):钻进 sticky 顶栏底下就算离场,不再要求 top < 0')
    const railCode = railJs.replace(/\/\/[^\n]*/g, '') // 注释里在讲旧判定的坏处,别把它当代码抓
    ok(!/boundingClientRect\.top/.test(railCode) && !/isIntersecting/.test(railCode),
      '不再读 IO entry 的 top/isIntersecting —— 谁触发都回到同一句实测判定,也不管滚动方向')
    ok(/window\.addEventListener\('scroll', function \(\) \{[\s\S]{0,200}?requestAnimationFrame\([\s\S]{0,80}?apply\(\)/.test(railJs) &&
      railJs.includes("{ passive: true }"),
      '有 scroll 兜底且 rAF 节流(IO 只在边界翻转时回调,抖动靠这一路补齐)')
    ok(/window\.addEventListener\('resize', function \(\) \{ cancelAnimationFrame\(rearm\); rearm = requestAnimationFrame\(arm\) \}\)/.test(railJs),
      'resize 重建观察器:rootMargin 建时定死,hubbar 换行改高得重来')
    ok(railCss.includes('animation: railin .12s ease-out') && railCss.includes('@keyframes railin') &&
      /translateX\(-8px\)/.test(railCss) && railCss.includes('@media (prefers-reduced-motion: reduce)'),
      'rail 浮出走 120ms 从左 8px 淡入(display:none 起步只能用 animation),reduced-motion 下关掉')
  }
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  cfg.tabRail = false
  cfg.backlogArchive = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx55.kb)
  ok(sha(idxP) === offSha, '关回后与冻结基线逐字节相同')
}

// ============ T56 总览落地页 overviewTab(opt-in;未配/false = 字节冻结,开 = 叙事流 + 迭代史折叠)============
console.log('T56 总览落地页 overviewTab')
{
  const fx56 = mkFixture('fx56', { 's.html': demoHtml('s') })
  const kb = fx56.kb
  const cfgP = join(kb, 'kanban.config.json'), idxP = join(kb, 'index.html')
  const mP = join(kb, 'manifest.json'), blP = join(kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), bl = rd(blP)
  mm.instance.planDoc = ''
  mm.iterations = [{ id: 'I1', title: '迭代甲', detail: '收完了' }, { id: 'I2', title: '迭代乙', detail: '在做' }]
  mm.tasks = [
    { id: 'T1', iteration: 'I1', status: 'done', title: '任务甲', approach: 'a' },
    { id: 'T2', iteration: 'I2', status: 'active', title: '任务乙', approach: 'a' },
    { id: 'T3', iteration: 'I2', status: 'planned', title: '任务丙', approach: 'a' },
  ]
  bl.tiers = { 1: '核心' }
  const item = (id, date, title) => ({ id, status: 'ready', priority: 'high', tier: '1', date, title, problem: 'p', approach: 'a', area: 'x', source: 's' })
  bl.items = [item('BL-1', '2026-01-01', '待办甲'), item('BL-2', '2026-02-02', '待办乙'), { ...item('BL-3', '2026-03-03', '旧账丙'), status: 'done' }]
  wr(mP, mm); wr(blP, bl)
  const cfg = rd(cfgP)
  cfg.wip = { soft: 1, hard: 5 } // 2 张 ready → 软档,验「可做」那行的琥珀色跟 wip 同一套阈值
  wr(cfgP, cfg)

  // ---- 四拍:未配 → false 比 sha → true 验行为 → 关回比 sha ----
  runGen(NEW_SCRIPTS, kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(off.includes('data-pane="progress">进度看板<') && !off.includes('ovflow') && !off.includes('iterhist'),
    '未配 overviewTab:第一个 tab 还是「进度看板」,壳里零总览痕迹')
  cfg.overviewTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === offSha, 'overviewTab:false 与未配逐字节相同(冻结)')

  cfg.overviewTab = true
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, kb)
  ok(r.status === 0, 'overviewTab:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(on.includes('data-pane="progress">总览<') && !on.includes('>进度看板<'), 'tab 文案改「总览」,pane id 仍是 progress(hash 不变)')
  const pane = on.slice(on.indexOf('id="pane-progress"'), on.indexOf('id="pane-decisions"'))
  const rows = [...pane.matchAll(/data-ovrow="([a-z]+)"/g)].map((x) => x[1])
  ok(rows.join(',') === 'iter,ready', '数据源缺席的行整行不渲染:只出「迭代」与「可做」两行', rows.join(','))
  ok(/data-ovrow="iter"[\s\S]*?<b>I2<\/b> · 迭代甲?乙/.test(pane) && pane.includes('href="#T2"'),
    '迭代行 = manifest 里 active 的那个迭代 + 它进行中的任务', (pane.match(/data-ovrow="iter"[\s\S]{0,220}/) || [''])[0].slice(0, 220))
  ok(pane.includes('<b><span id="ovreadyn">2</span></b> 张 ready') && pane.includes('href="#backlog"'),
    '可做行 = backlog ready 数(done 不算)+ 链 #backlog')
  ok(/class="ovrow ov-soft" data-ovrow="ready"/.test(pane), '可做行按 wip 阈值挂琥珀档(soft)')
  const hist = pane.slice(pane.indexOf('<details class="iterhist">'))
  ok(hist.includes('迭代史 · 2 个迭代 · 3 个任务'), '迭代史摘要 = 迭代数 · 任务数', (hist.match(/<summary>[^<]*/) || [''])[0])
  ok(hist.includes('class="pathmap"') && hist.includes('id="T1"') && hist.includes('id="T3"'),
    '原「进度看板」整块折进迭代史,任务卡一条没删')
  ok(on.includes("for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true"),
    '深链命中折叠内元素时先把沿途 details 打开(否则跳到 display:none 元素毫无反应)')
  ok(on.includes('const ovN = document.getElementById(\'ovreadyn\')') && on.includes("nVis(ovBl, '.bl-ready')"),
    '可做数随线别/筛选重算,与积压提醒同一个可见谓词')
  { // 「不引新色」的真检法:总览段里出现的每个色值,样式表前面都已经在用(令牌 tk()/BRAND_TK 未换装时是字面量)
    const styleAll = on.slice(on.indexOf('<style>'), on.indexOf('</style>'))
    const cut = styleAll.indexOf('/* ============ 总览(v0.15.0')
    const ovCss = styleAll.slice(cut), before = styleAll.slice(0, cut)
    const hexes = [...new Set(ovCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [])]
    ok(ovCss.length > 500 && hexes.length > 0 && hexes.every((h) => before.includes(h)),
      '总览 CSS 不引新色:每个色值样式表前面都已在用(暗档自然跟着同一条 light-dark 链)',
      hexes.filter((h) => !before.includes(h)).join(' ') || ovCss.length + ' 字符')
  }
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  cfg.overviewTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === offSha, '关回后与冻结基线逐字节相同')

  // ---- 同一套四拍在 lazyTabs 开着时再走一遍(总览住在壳里,不进 parts)----
  cfg.lazyTabs = true
  delete cfg.overviewTab
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  const lzSha = sha(idxP)
  cfg.overviewTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === lzSha, 'lazy 开着时 overviewTab:false 也与未配逐字节相同')
  cfg.overviewTab = true
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  const lzOn = readFileSync(idxP, 'utf8')
  ok(lzOn.includes('class="ovflow"') && lzOn.includes('id="T2"') && !existsSync(join(kb, 'parts', 'progress.html')),
    'lazy 开着时总览连同迭代史都留在壳里(第一屏不该等 fetch)')
  cfg.overviewTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === lzSha, 'lazy 档下关回后同样逐字节回基线')
}

// ============ T57 总览各行按数据源在场与否出没(逐个撤掉数据源,行跟着消失)============
console.log('T57 总览各行随数据源出没')
{
  const fx57 = mkFixture('fx57', { 's.html': demoHtml('s') })
  const kb = fx57.kb
  const cfgP = join(kb, 'kanban.config.json'), idxP = join(kb, 'index.html')
  const mP = join(kb, 'manifest.json'), blP = join(kb, 'backlog-manifest.json'), decP = join(kb, 'decisions-manifest.json')
  const relP = join(kb, 'release-manifest.json'), accP = join(kb, 'acceptance-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), bl = rd(blP), dec = rd(decP)
  for (const x of [mm, bl, dec]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  mm.iterations = [{ id: 'I1', title: '迭代甲', detail: '在做' }]
  mm.tasks = [{ id: 'T1', iteration: 'I1', status: 'active', title: '任务甲', approach: 'a' }]
  bl.tiers = { 1: '核心' }
  bl.items = [
    { id: 'BL-1', status: 'ready', priority: 'high', tier: '1', date: '2020-01-01', title: '睡了很久的甲', problem: 'p', approach: 'a', area: 'x', source: 's' },
    { id: 'BL-2', status: 'ready', priority: 'high', tier: '1', date: '2026-02-02', title: '待收账的乙', problem: 'p', approach: 'a', area: 'x', source: 's', pr: 227 },
    { id: 'BL-3', status: 'ready', priority: 'high', tier: '1', date: '2026-02-03', title: '挂起的丙', problem: 'p', approach: 'a', area: 'x', source: 's', pr: 227, settleHold: '这一轮只落了一半' },
  ]
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策甲', pr: 230 }]
  wr(mP, mm); wr(blP, bl); wr(decP, dec)
  wr(relP, REL_MANIFEST)
  wr(accP, { current: 230, lists: [ACC_LIST] })
  const cfg = rd(cfgP)
  cfg.overviewTab = true
  cfg.acceptanceTab = true
  cfg.releaseTab = true
  wr(cfgP, cfg)
  const sp = runScript('cards-split.mjs', kb) // 它自己往 config 写 cardsDir(反向 cards-join 再删掉)
  ok(sp.status === 0, 'T57 一卡一文件拆分 exit 0', sp.stderr)
  const r = runGen(NEW_SCRIPTS, kb)
  ok(r.status === 0, '七行齐活时 gen exit 0', r.stderr)
  const rowsOf = () => {
    const s = readFileSync(idxP, 'utf8')
    const pane = s.slice(s.indexOf('id="pane-progress"'), s.indexOf('id="pane-decisions"'))
    return [...pane.matchAll(/data-ovrow="([a-z]+)"/g)].map((x) => x[1]).join(',')
  }
  ok(rowsOf() === 'iter,acc,ready,settle,dorm,recent,rel', '数据源齐全:七行按叙事顺序全在', rowsOf())
  {
    const s = readFileSync(idxP, 'utf8')
    const pane = s.slice(s.indexOf('id="pane-progress"'), s.indexOf('id="pane-decisions"'))
    ok(pane.includes('<span data-acc="230">0/4</span>') && pane.includes('href="#acc-230"'),
      '在验收行:分母烤入、分子留给 accSync(与卡头芯片同一把钥匙)', (pane.match(/data-acc="230">[^<]*/) || [''])[0])
    ok(pane.includes('class="ovbar"'), '在验收行带迷你进度条')
    ok(/data-ovrow="settle"[\s\S]*?<b>1<\/b> 张 · 挂起 <b>1<\/b> 张/.test(pane),
      '待收账行:settle 与 settleHold 分开数(挂起的不并进待收账)', (pane.match(/data-ovrow="settle"[\s\S]{0,180}/) || [''])[0].slice(0, 180))
    ok(pane.includes('data-dorm="2020-01-01"') || /data-dorm="\d{4}-\d{2}-\d{2}"/.test(pane),
      '沉睡行只烤日期,天数留给浏览器算(gen 零时间)')
    ok(/class="ovline ovrecrow" data-upd="\d{4}-\d{2}-\d{2}" hidden/.test(pane) && /data-ovrest="[^"]*"/.test(pane),
      '近 7 天行:每张只烤日期、默认藏起来,超出上限的卡烤成「日期:张数」游程(不逐张进壳)',
      (pane.match(/data-ovrest="[^"]*"/) || [''])[0])
    ok(/data-ovrow="rel"[\s\S]*?dev <b>3<\/b> \/ test <b>1<\/b> \/ prod <b>1<\/b>/.test(pane),
      '发布行:三段计数与发布进度 tab 同一份 stageOf 口径', (pane.match(/data-ovrow="rel"[\s\S]{0,200}/) || [''])[0].slice(0, 200))
  }
  // ---- 逐个撤掉数据源 ----
  const cfgA = rd(cfgP)
  cfgA.acceptanceTab = false
  wr(cfgP, cfgA)
  runGen(NEW_SCRIPTS, kb)
  ok(rowsOf() === 'iter,ready,settle,dorm,recent,rel', '关掉验收:在验收行整行消失,其余不动', rowsOf())
  const jn = runScript('cards-join.mjs', kb) // 合回单文件,顺手把 config 的 cardsDir 删掉
  ok(jn.status === 0, 'T57 卡合回头 manifest exit 0', jn.stderr)
  runGen(NEW_SCRIPTS, kb)
  ok(rowsOf() === 'iter,ready,settle,dorm,rel', '关掉 cardsDir:近 7 天那行消失(没有卡文件就没有更新日这个事实)', rowsOf())
  const cfg2 = rd(cfgP)
  cfg2.releaseTab = false
  wr(cfgP, cfg2)
  rmSync(relP)
  runGen(NEW_SCRIPTS, kb)
  ok(rowsOf() === 'iter,ready', '撤掉 release-manifest:待收账 / 沉睡 / 发布 三行一起消失', rowsOf())
  const mm3 = rd(mP)
  mm3.tasks[0].status = 'done'
  wr(mP, mm3)
  runGen(NEW_SCRIPTS, kb)
  ok(rowsOf() === 'ready', '没有 active 迭代:迭代行也不硬撑', rowsOf())
}

// ============ T58 决策路径入文档库 pathTab:"docs"(未配 = 字节冻结,开 = 一篇 refs 文档 + hub 条目 + #path 路由)============
console.log('T58 决策路径入文档库 pathTab')
const PATH_MANIFEST = {
  demoBase: 'http://127.0.0.1:8890/',
  demoBrief: '', demoHandover: '',
  pivot: '当时为什么拐这个弯',
  principles: ['原则甲', '原则乙'],
  epochs: [
    { line: 'A', period: '2026-01 – 02', name: '纪元甲', axis: '主轴甲', how: '先做对比 demo 再拍板', tally: '7 项决策', see: '决策卡 AD1' },
    { line: 'C', period: '2026-03 –', name: '纪元丙', axis: '主轴丙', how: 'demo 成熟', tally: '9 项决策', see: '决策卡 D1' },
  ],
  rounds: [{ n: '1', title: '第一轮', gist: '要点甲' }],
  demos: [{ id: 'demo-1', name: 'demo 甲', file: 'demo-1.html', bet: '赌注甲', role: '角色甲', flagship: true }],
  aDemos: [{ id: 'AD1', name: 'A demo 甲', file: 'a1.html', gist: '对比要点' }],
  pinboard: [{ id: 'P1', no: '第一条', title: '拍板甲', becameD: 'D1', demoDefault: '默认甲', landed: '落地甲' }],
}
{
  const fx58 = mkFixture('fx58', { 's.html': demoHtml('s') })
  const kb = fx58.kb
  const cfgP = join(kb, 'kanban.config.json'), idxP = join(kb, 'index.html')
  const decP = join(kb, 'decisions-manifest.json'), pathP = join(kb, 'path-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const dec = rd(decP)
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策甲' }]
  wr(decP, dec)
  wr(pathP, PATH_MANIFEST)

  runGen(NEW_SCRIPTS, kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(off.includes('data-pane="path">决策路径<') && off.includes('id="pane-path"'), '未配 pathTab:「决策路径」tab 与 pane 照旧在')
  ok(!existsSync(join(kb, 'refs', 'design-path.html')), '未配 pathTab:不写 refs/design-path.html')
  const cfg = rd(cfgP)
  cfg.pathTab = false // 非 "docs" 的值一律按未配处理(只出一条 warn)
  wr(cfgP, cfg)
  const rf = runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === offSha, 'pathTab 非 "docs" 与未配逐字节相同(冻结)')
  ok(/未知 pathTab/.test(rf.stderr), '非法值出一条 warn,不静默', (rf.stderr || '').slice(0, 90))

  cfg.pathTab = 'docs'
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, kb)
  ok(r.status === 0, 'pathTab:"docs" gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(!on.includes('data-pane="path"') && !on.includes('id="pane-path"'), 'tab 与 pane 都不再渲染')
  ok(/const PANES = new Set\(\['progress', 'decisions'/.test(on), 'PANES 集合跟着少一项', (on.match(/const PANES = new Set\([^)]*\)/) || [''])[0])
  ok(on.includes('文档库 · 1'), '文档库计数把这一篇算进去(config.docs 是空的,这篇就是唯一一篇)')
  ok(on.includes('href="refs/design-path.html" data-doc="design-path.html"') && on.includes('<h3>设计路径(A→B→C)</h3>'),
    'Hub 里长出这条目')
  ok(/<span class="dcat">交接与接手<\/span>/.test(on), '默认落在「交接与接手」类(docSegments 把它归到「流程」段)')
  ok(on.includes("if (id === 'path') { // 决策路径已搬进文档库") && on.includes("document.querySelector('.doccard[data-doc=\"design-path.html\"]')"),
    '老的 #path 深链改落到文档库那条目(历史链接不死)')
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  const docp = join(kb, 'refs', 'design-path.html')
  ok(existsSync(docp), 'refs/design-path.html 已生成')
  const doc = readFileSync(docp, 'utf8')
  ok(doc.includes('<nav id="refnav"><a class="back" href="../index.html">← 决策看板</a>') && doc.includes('app/kanban/path-manifest.json'),
    '套 refs 页壳:返回栏 + 源文件名')
  ok(doc.includes('<h1>设计路径(A→B→C)</h1>') && doc.includes('<title>设计路径(A→B→C) · HTEST 看板</title>'), '标题两处一致')
  ok(doc.includes('原则甲') && doc.includes('原则乙') && doc.includes('纪元甲') && doc.includes('纪元丙') && doc.includes('当时为什么拐这个弯'),
    '内容 = pathPane 的主体:原则、纪元、转折点一样不少(数据一条没删)')
  ok(doc.includes('href="../index.html#D1"'), '跳决策卡的 #锚 改指回 index.html(在文档页里没有落点)')
  ok(doc.includes('href="../demos/a1.html"'), 'demos/ 相对链接退一级')
  ok(doc.includes('href="http://127.0.0.1:8890/demo-1.html"'), '站外绝对地址原样不动')
  ok(doc.includes('/* ============ 决策路径 pane ============ */') && doc.includes('.pathdoc{--ink:var(--text)'),
    '样式与看板 pane 同一份规则,靠 .pathdoc 上一层变量别名接住 refs 页的变量名族')
  ok(!on.includes('id="pane-path"') && on.includes('/* ============ 决策路径 pane ============ */'),
    '同一份 CSS 常量插值回 index 原位(所以关档能逐字节冻结)')

  // ---- out 撞名:人家的 docs 条目已经占了 design-path.html → 硬报错,不闷声覆盖 ----
  writeFileSync(join(fx58.root, 'X.md'), '# X\n')
  const cfg2 = rd(cfgP)
  cfg2.docs = [{ path: 'X.md', out: 'design-path.html', title: 'X', baseDir: '', category: '其他' }]
  wr(cfgP, cfg2)
  const rx = runGen(NEW_SCRIPTS, kb)
  ok(rx.status !== 0 && /已有条目占了这个 out/.test(rx.stderr), 'out 撞名 → 硬报错', (rx.stderr || '').split('\n')[0].slice(0, 110))

  // ---- 关回:字节回基线,陈迹文件清掉 ----
  const cfg3 = rd(cfgP)
  delete cfg3.pathTab
  cfg3.docs = []
  wr(cfgP, cfg3)
  runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === offSha, '关回后与冻结基线逐字节相同')
  ok(!existsSync(docp), '关回后 refs/design-path.html 陈迹自动清理(照 parts/ 的规矩)')
}

// ============ T60 验收 / 发布进度也进 parts(lazyTabs 开时;数据随 part 走,注入时初始化)============
console.log('T60 验收/发布进度进 parts')
{
  const fx60 = mkFixture('fx60', { 's.html': demoHtml('s') })
  const cfgP = join(fx60.kb, 'kanban.config.json'), idxP = join(fx60.kb, 'index.html')
  const accP = join(fx60.kb, 'acceptance-manifest.json'), relP = join(fx60.kb, 'release-manifest.json')
  const mP = join(fx60.kb, 'manifest.json'), decP = join(fx60.kb, 'decisions-manifest.json'), blP = join(fx60.kb, 'backlog-manifest.json')
  const part = (f) => join(fx60.kb, 'parts', f)
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) x.instance.ghRepo = 'o/r'
  bl.tiers = { 1: '核心' }
  bl.items = [
    { id: 'BL-1', status: 'ready', priority: 'high', tier: '1', title: '待办甲', pr: 230 }, // 卡头长出 [data-acc]
    { id: 'BL-2', status: 'done', priority: 'low', tier: '1', title: '旧账乙' }, // 归档那份 part 得有内容
  ]
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: '决策甲' }]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  wr(accP, { current: 230, lists: [ACC_LIST] })
  wr(relP, REL_MANIFEST)
  const cfg = rd(cfgP)
  cfg.acceptanceTab = true
  cfg.releaseTab = true
  cfg.backlogArchive = true
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx60.kb)
  const flatSha = sha(idxP) // 两 tab 开着、lazy 关着的单文件基线
  const flat = readFileSync(idxP, 'utf8')
  ok(flat.includes('class="acclist"') && flat.includes('class="relr"') && !existsSync(join(fx60.kb, 'parts')),
    '未开 lazyTabs:两 pane 正文照旧在壳里,没有 parts 目录')

  cfg.lazyTabs = true
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, fx60.kb)
  ok(r.status === 0, 'lazyTabs + 两 tab 同开 gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  const pAcc = readFileSync(part('acceptance.html'), 'utf8'), pRel = readFileSync(part('release.html'), 'utf8')
  ok(pAcc.includes('id="acc-230-232"') && pRel.includes('id="pr-232"'), 'parts/acceptance.html 与 parts/release.html 落盘且含 pane 正文')
  ok(!on.includes('class="acclist"') && !on.includes('class="relr"') &&
    /id="pane-acceptance" data-lazy-pending/.test(on) && /id="pane-release" data-lazy-pending/.test(on),
    '壳里两 pane 只剩骨架(正文不在壳内)')
  { // 数据也搬了家:壳里不再有烤入的表,part 里是一块 application/json
    const accData = (pAcc.match(/<script type="application\/json" id="acc-data">([\s\S]*?)<\/script>/) || [])[1]
    const relData = (pRel.match(/<script type="application\/json" id="rel-data">([\s\S]*?)<\/script>/) || [])[1]
    ok(!!accData && !!relData, '两 part 各带一块 application/json 数据')
    let parsed = null
    try { parsed = [JSON.parse(accData), JSON.parse(relData)] } catch (e) { parsed = null }
    ok(parsed && Object.keys(parsed[0]).join(',') === 'LISTS,TSV,OF_PR' && Object.keys(parsed[1]).join(',') === 'D,G,RELS,ATOF',
      '数据块是合法 JSON,键与运行期取用的四份表对得上')
    ok(!accData.includes('<') && !relData.includes('<'),
      '数据块里 `<` 一律 \\u003c(拼不出 </script,注入后原样读得回来)')
    ok(!/var LISTS = \[/.test(on) && !/var TSV = \{/.test(on) && !/var D = \[/.test(on) && !/var RELS = \[/.test(on),
      '壳里零烤入数据(LISTS / TSV / D / RELS 都跟着 part 走了)')
    ok(on.includes('var LISTS = __ad.LISTS') && on.includes('var D = __rd.D'),
      '壳里剩的是从 part 数据块解出来的那两行')
  }
  ok(/function initAcceptance\(root\) \{\s*\n\s*if \(accReady \|\| !root\) return/.test(on) &&
    /function initRelease\(root\) \{\s*\n\s*if \(relReady \|\| !root\) return/.test(on),
    '两个 IIFE 改成 init 函数,各带幂等守卫(预取与点 tab 都到,只跑第一次)')
  {
    const inj = (on.match(/function onPaneInjected\(name\) \{[\s\S]*?\n {2}\}/) || [''])[0]
    ok(inj.includes("if (name === 'acceptance') initAcceptance(") && inj.includes("if (name === 'release') initRelease("),
      '注入完当场初始化对应 pane', inj.slice(-260))
    ok(/else if \(!lazyDone\.acceptance && document\.querySelector\('\[data-acc\]'\)\) ensurePane\('acceptance'\)/.test(inj),
      '跨 part 依赖:注进来的 pane 里有 [data-acc](卡头芯片 / 发布表格那一列)就先把验收数据取回来')
  }
  { // 深链表:清单锚(整份 + 每个成员 PR)与 PR 行都得知道去取哪一份
    const map = JSON.parse((on.match(/const LAZY_PANE_OF = (\{[\s\S]*?\})\n/) || [, '{}'])[1].replace(/\\u003c/g, '<'))
    ok(map['acc-230-232'] === 'acceptance' && map['acc-230'] === 'acceptance' && map['acc-232'] === 'acceptance',
      '#acc-<清单串> 与 #acc-<成员 PR> 都指向验收那份 part')
    ok(map['pr-232'] === 'release' && map['pr-227'] === 'release', '#pr-<号> 指向发布那份 part')
    ok(map['BL-1'] === 'backlog' && map['D1'] === 'decisions', '卡号照旧各归各的 part(派生锚不抢卡号)')
  }
  { // 真进度分母对账:五份都要对得上落盘字节
    const bd = (on.match(/const LAZY_BYTES = \{([^}]*)\}/) || [, ''])[1]
    const num = (k) => Number((bd.match(new RegExp(k + ': (\\d+)')) || [])[1])
    const { Buffer } = await import('node:buffer')
    ok(num('acceptance') === Buffer.byteLength(pAcc, 'utf8') && num('release') === Buffer.byteLength(pRel, 'utf8'),
      'LAZY_BYTES 的验收 / 发布两项与 part 落盘字节一致')
    ok(['decisions', 'backlog', 'archive', 'acceptance', 'release'].every((k) => num(k) > 0), 'LAZY_BYTES 五项齐活')
  }
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  // ---- 守卫的缺件自愈认得新来的两个 part:删掉也要重跑补回(否则 #acc-* / #pr-* 深链静默落空)----
  for (const f of ['acceptance.html', 'release.html']) {
    const pp = part(f)
    touch(idxP) // index 是最新的 —— 只有「缺件」这一条能触发重跑
    rmSync(pp)
    const rs = runStop(NEW_SCRIPTS, fx60.root)
    ok(rs.status === 0 && existsSync(pp), `守卫发现 parts/${f} 缺件 → 重跑 gen 补回(exit ${rs.status})`, rs.stderr)
  }
  { // 单独关掉验收 tab:只清它那一份,别人不受影响(照归档那条的规矩)
    cfg.acceptanceTab = false
    wr(cfgP, cfg)
    runGen(NEW_SCRIPTS, fx60.kb)
    ok(!existsSync(part('acceptance.html')) && existsSync(part('release.html')) && existsSync(part('backlog.html')),
      '关掉验收 tab:parts/acceptance.html 清除,另几个 part 不受影响')
    cfg.acceptanceTab = true
    wr(cfgP, cfg)
    runGen(NEW_SCRIPTS, fx60.kb)
  }
  cfg.lazyTabs = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx60.kb)
  ok(!existsSync(join(fx60.kb, 'parts')), '关回 lazyTabs:五个 part 全清,目录一并清除')
  ok(sha(idxP) === flatSha, '关回后 index 与单文件基线逐字节相同')
}

// ============ T61 时间线 hover peek(自绘卡顶掉原生 title;releaseTab 关档照旧四拍冻结)============
console.log('T61 时间线 hover peek')
{
  const fx61 = mkFixture('fx61', { 's.html': demoHtml('s') })
  const cfgP = join(fx61.kb, 'kanban.config.json'), idxP = join(fx61.kb, 'index.html')
  const relP = join(fx61.kb, 'release-manifest.json')
  const mP = join(fx61.kb, 'manifest.json'), decP = join(fx61.kb, 'decisions-manifest.json'), blP = join(fx61.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  bl.tiers = { 1: '核心' }
  bl.items = [{ id: 'BL-1', status: 'ready', priority: 'high', tier: '1', title: '待办甲', pr: 230 }]
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  wr(relP, REL_MANIFEST)
  const cfg = rd(cfgP)
  cfg.tabRail = true // peek 得压得住左侧竖导航,z-index 那条断言才有对手
  wr(cfgP, cfg)

  // ---- 四拍:未配 → false 比 sha → true 验行为 → 关回比 sha ----
  runGen(NEW_SCRIPTS, fx61.kb)
  const offSha = sha(idxP)
  ok(!readFileSync(idxP, 'utf8').includes('relpeek'), '未配 releaseTab:壳里零 peek 痕迹')
  cfg.releaseTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx61.kb)
  ok(sha(idxP) === offSha, 'releaseTab:false 与未配逐字节相同(冻结)')

  cfg.releaseTab = true
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, fx61.kb)
  ok(r.status === 0, 'releaseTab:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(count(on, "pk.className = 'relpeek'") === 1 && count(on, 'document.body.appendChild(pk)') === 1,
    'peek 容器只建一份、挂在 body 上(时间线自己在横向滚动容器里,卡跟着滚就贴不住锚点)')
  {
    const tlb = on.slice(on.indexOf('function tlBar('), on.indexOf('// ———— hover peek'))
    ok(tlb.length > 200 && !tlb.includes('title=') && tlb.includes('tabindex="0"') && tlb.includes("data-relpk=") ,
      '条/方块不再写原生 title(截断、要等、还与自绘卡叠成两层),改挂 data-relpk + 显式 tabindex', tlb.slice(-180))
  }
  ok(/class="relsp relc s-' \+ g\.sg \+ ' q' \+ g\.q \+ '" tabindex="0"'/.test(on) &&
    on.includes("data-relpkg=") && on.includes("data-relpkd="),
    '折叠带上的一段(= 那条带的那一天)同样可聚焦,并挂上带 / 日两个钩子')
  ok(on.includes("pkCell(n, '.rc-d')") && on.includes("pkCell(n, '.rc-b')") &&
    on.includes(".rc-a [data-acc]") && on.includes('var d = byN[n]'),
    'peek 内容全从已烤入的 D 与表格那一行现取(状态·日期 / 分支 / 验收分子),不烤第二份')
  ok(/pkT = setTimeout\(function \(\) \{ pkT = 0; if \(pkFor === el\) pkShow\(el\) \}, 150\)/.test(on) &&
    on.includes('if (el) pkOver(el, false) })'),
    '鼠标停够 150ms 才浮出(扫过一排不该抖出一串),键盘获焦不等')
  ok(on.includes("host.addEventListener('mouseenter', function (ev) { var el = pkAt(ev); if (el) pkOver(el, true) }, true)") &&
    on.includes("host.addEventListener('mouseleave', function (ev) { if (pkAt(ev)) pkSoon() }, true)"),
    'mouseenter / mouseleave 走捕获委托 —— 两者都不冒泡,而 drawTl 每次整块换 innerHTML')
  ok(on.includes("if (ev.pointerType !== 'touch') return") &&
    /if \(!el \|\| \(el === pkFor && !pk\.hidden\)\) return\n\s*ev\.preventDefault\(\)/.test(on),
    '触摸屏没有 hover:第一下只出卡,第二下才放行链接')
  ok(on.includes("if (ev.key === 'Escape') pkHide()") && on.includes("pksc.addEventListener('scroll', pkHide)"),
    'Esc 收起;时间线一横滚锚点就跑了,与其错位不如收起')
  {
    const railZ = Number((on.match(/\.tabrail:not\(\[hidden\]\)[^}]*z-index: (\d+)/) || [, '0'])[1])
    const pkZ = Number((on.match(/\.relpeek \{[^}]*z-index: (\d+)/) || [, '0'])[1])
    ok(railZ > 0 && pkZ > railZ, `peek 的 z-index ${pkZ} 压在 tabrail ${railZ} 之上`)
  }
  { // 卡宽跟着内容走(v0.15.15):死墙没了,长标题不再从右沿探出去
    const pkRule = (on.match(/\.relpeek \{[^}]*\}/) || [''])[0]
    ok(pkRule.includes('width: max-content') && !/(?:^|[^-])width: \d+px/.test(pkRule),
      'peek 卡不再钉死一个像素宽,宽度由内容定', pkRule.slice(0, 160))
    ok(/max-width: min\(720px, calc\(100vw - 16px\)\)/.test(pkRule),
      '仍封一个上限:720px 与「视口再留 8px 边」谁小取谁(读一眼的量,且贴着右沿也不越出屏幕)', pkRule.slice(0, 160))
    ok(/\.relpkr > span \{[^}]*white-space: normal[^}]*overflow-wrap: anywhere/.test(on) &&
      !/\.relpkr > span \{[^}]*text-overflow: ellipsis/.test(on),
      '清单行的标题改成换行(原来 nowrap + 截断,长中文标题会探到卡外)')
    ok(/\.relpkr b \{[^}]*white-space: nowrap/.test(on), '#NNN 那格照旧不换行(号断成两行就读不成一个号)')
  }
  { // +N 的卡只列被收起来的那几个(v0.15.15):号烤在 data-relfold 上,pkDay 按号挑
    ok(/function tlOvf\(ns, g, dy, x, y, w\)/.test(on) && on.includes("data-relfold=\"' + ns.join(',')") &&
      on.includes("'px;width:' + w + 'px\">+' + ns.length + '</span>'"),
      '+N 把被收起来的号一并烤上 data-relfold,+N 的 N 就是这串号的个数(两处对不上就没得对)')
    ok(on.includes('pkDay(el.dataset.relpkg, el.dataset.relpkd, el.dataset.relfold)'),
      '锚点带 data-relfold 时,这一串号跟着传进 pkDay')
    // 把 pkDay 从生成物里切出来现跑:喂一份假的带 / PR,看它到底列了谁
    const cut = on.indexOf('function pkDay(gid, dy, fold)')
    const src = on.slice(cut, on.indexOf('\n    }\n', cut) + 6)
    const rowsOf = (ns) => ns.map((n) => ({ n, t: '第 ' + n + ' 号的标题' }))
    const pkDay = new Function('byG', 'G', 'anc', 'md', 'xe', src + '\nreturn pkDay')(
      { b1: rowsOf([251, 252, 255, 256, 257, 258, 259, 260]) },
      [{ g: 'b1', nm: 'test · 4173 (main)' }],
      () => '2026-09-01', (s) => String(s).slice(5, 10), (s) => String(s),
    )
    const fold = pkDay('b1', '2026-09-01', '257,259,260')
    const nums = (h) => (h.match(/<b>#(\d+)<\/b>/g) || []).map((x) => x.replace(/\D/g, ''))
    ok(nums(fold).join(',') === '257,259,260',
      '+N 的卡只列折起来的那三个,画出来的几枚不再重列一遍', nums(fold).join(','))
    ok(fold.includes('09-01 · 放不下的 3 个 PR') && fold.includes('test · 4173 (main)'),
      '卡头说的是「放不下的 3 个 PR」,不是那一整天的总数;也不说「未展开」—— 看得见 +N 的时候带一定是开着的', fold.slice(0, 120))
    const all = pkDay('b1', '2026-09-01', undefined)
    ok(nums(all).length === 8 && all.includes('09-01 · 8 个 PR') && !all.includes('放不下的'),
      '不带 data-relfold 的锚点(方块 / 芯片 / 条 / 折叠带那一段)照旧列一整天', nums(all).length + ' 条')
    ok(pkDay('b1', '2026-09-01', '888').includes('· 放不下的 0 个 PR'),
      '按号挑不按天挑:跨天那组的锚点日被窗口裁掉时,天对不上而号永远对得上')
  }
  { // 「不引新色」的真检法:peek 那几条里出现的色值,样式表里别处已经在用(与总览那条同一把尺)
    const styleAll = on.slice(on.indexOf('<style>'), on.indexOf('</style>'))
    const cut = styleAll.indexOf('/* hover peek(v0.15.2)')
    const end = styleAll.indexOf('@media (max-width: 820px)', cut)
    const pkCss = styleAll.slice(cut, end)
    const rest = styleAll.slice(0, cut) + styleAll.slice(end)
    const cols = [...new Set([...(pkCss.match(/#[0-9a-fA-F]{3,8}\b/g) || []), ...(pkCss.match(/rgba?\([^)]*\)/g) || [])])]
    ok(pkCss.length > 300 && cols.every((c) => rest.includes(c)),
      'peek CSS 不引新色:每个色值样式表别处已在用(暗档自然跟着同一条 light-dark 链)',
      cols.filter((c) => !rest.includes(c)).join(' ') || pkCss.length + ' 字符')
  }
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  { // lazy 档:时间线本来就是运行期画的,peek 整套都是壳里的代码,part 里一个字都不多
    cfg.lazyTabs = true
    wr(cfgP, cfg)
    runGen(NEW_SCRIPTS, fx61.kb)
    const lzOn = readFileSync(idxP, 'utf8')
    const pRel = readFileSync(join(fx61.kb, 'parts', 'release.html'), 'utf8')
    ok(lzOn.includes("pk.className = 'relpeek'") && lzOn.includes('.relpeek {') && !pRel.includes('relpeek'),
      'lazy 档:peek 的容器、样式与代码都在壳里,parts/release.html 一个字不多')
    cfg.lazyTabs = false
    wr(cfgP, cfg)
  }
  cfg.releaseTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx61.kb)
  ok(sha(idxP) === offSha, '关回后与冻结基线逐字节相同')
}

// ============ T62 tab 条吸顶 stickyTabs(opt-in;关档逐字节冻结;吸顶层加高后各处补偿跟着加)============
console.log('T62 tab 条吸顶 stickyTabs')
{
  const fx62 = mkFixture('fx62', { 's.html': demoHtml('s') })
  const cfgP = join(fx62.kb, 'kanban.config.json'), idxP = join(fx62.kb, 'index.html')
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  // ---- 四拍:未配 → false 比 sha → true 验行为 → 关回比 sha ----
  runGen(NEW_SCRIPTS, fx62.kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('--ddd-hubh') && !off.includes('--ddd-tabh') && !off.includes('stickyTabs'),
    '未配 stickyTabs:壳里零吸顶痕迹')
  ok(off.includes('[id] { scroll-margin-top: 58px; }'), '未配时锚点补偿仍是老的定值 58px(旧板不动)')
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  cfg.stickyTabs = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx62.kb)
  ok(sha(idxP) === offSha, 'stickyTabs:false 与未配逐字节相同(冻结)')

  cfg.stickyTabs = true
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, fx62.kb)
  ok(r.status === 0, 'stickyTabs:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')
  ok(/\.tabbar \{ position: sticky; top: var\(--ddd-hubh, 56px\); z-index: 50;/.test(on),
    'CSS:tab 条 position: sticky,落点跟 --ddd-hubh(hubbar 实高)走,z 层 50')
  ok(/\.tabbar \{ position: sticky[\s\S]{0,200}?background: var\(--bg\); box-shadow: 0 14px 0 var\(--bg\)/.test(on),
    '吸顶条底色 = hubbar 同一枚 --bg(不透明),下沿 14px margin 用同色投影盖住,不动布局')
  ok(!/\.tabbar \{ position: sticky[\s\S]{0,200}?#[0-9a-fA-F]{3}/.test(on),
    '吸顶条零硬编码色值:暗档跟着同一条 light-dark 链走')
  ok(on.includes('overflow-x: auto; scrollbar-width: none;') && on.includes('white-space: nowrap; flex: none;'),
    'tab 条原有的横向滚动 / nowrap 一条没动(sticky 与元素自身的 overflow-x 不冲突)')
  // z 层不打架:hubbar 60 > 吸顶 tab 条 50;懒加载进度线 70 与发布 peek 65 都在 tab 条之上
  ok(on.includes('.hubbar { position: sticky; top: 0; z-index: 60;'), 'hubbar 仍在 tab 条之上(60 > 50)')
  {
    const c2 = JSON.parse(readFileSync(cfgP, 'utf8'))
    c2.lazyTabs = true
    wr(cfgP, c2)
    const rl = runGen(NEW_SCRIPTS, fx62.kb)
    const onl = readFileSync(idxP, 'utf8')
    ok(rl.status === 0 && /#lazybar \{ position: fixed; top: 0;[^}]*z-index: 70;/.test(onl),
      'lazyTabs 同开:顶部进度线 z 70,压得住吸顶的 tab 条(50),不打架')
    c2.lazyTabs = false
    wr(cfgP, c2)
    runGen(NEW_SCRIPTS, fx62.kb)
  }
  // ---- 深链落点:吸顶层从「只有 hubbar」变成「hubbar + tab 条」,补偿算式必须把 tab 条高度也减掉 ----
  {
    const px = (s) => [...s.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]))
    const grabAnchor = (s) => ((s.match(/\n  \[id\] \{ scroll-margin-top: ([^;]+);/) || [])[1] || '') // 通配那条,不是 .dseg[id]
    const anchorOn = grabAnchor(on), anchorOff = grabAnchor(off)
    ok(anchorOn.includes('var(--ddd-hubh, 56px)') && anchorOn.includes('var(--ddd-tabh, 44px)'),
      '深链锚点补偿 = hubbar 高 + tab 条高 + 呼吸(不再是写死的 58px)', anchorOn)
    // 拿兜底值当实测值代进算式:补偿必须盖过两条吸顶栏之和,否则卡头被 tab 条压住
    const sumOn = px(anchorOn).reduce((a, b) => a + b, 0)
    const stack = 56 + 44 // hubbar + tab 条
    ok(sumOn >= stack && sumOn > px(anchorOff)[0],
      `代入实高后补偿(${sumOn}px)盖得过 hubbar+tab 条(${stack}px),且比老的 ${px(anchorOff)[0]}px 大`)
    ok(/rs\.setProperty\('--ddd-hubh', hubH \+ 'px'\)/.test(on) &&
      /rs\.setProperty\('--ddd-tabh', tabH \+ 'px'\)/.test(on) &&
      /if \(tabbarEl && tabbarEl\.offsetHeight\) tabH = tabbarEl\.offsetHeight/.test(on) &&
      /const tabbarEl = document\.querySelector\('\.tabbar'\)/.test(on),
      '两个高度都是现量的(tab 条取 offsetHeight),不是猜的常数')
    ok(/window\.addEventListener\('load', docsNavSync\)/.test(on) &&
      /window\.addEventListener\('resize', \(\) => \{ cancelAnimationFrame\(navRaf\); navRaf = requestAnimationFrame\(docsNavSync\) \}\)/.test(on),
      '量高挂在 load 与 resize(rAF 节流)上 —— hubbar flex-wrap 换行改高时落点跟着改')
    // 文档库那条自己也吸顶的导航切片,以及它的锚点/scrollspy 边界,一并让开 tab 条
    ok(/\.docsnav \{ position: sticky; top: calc\(var\(--hubh, 41px\) \+ var\(--ddd-tabh, 44px\)\);/.test(on),
      '文档库导航切片吸顶落点让开 tab 条(否则两条吸顶栏叠在一处)')
    ok(/\.dseg\[id\] \{ scroll-margin-top: calc\(var\(--hubh, 41px\) \+ var\(--dnavh, 0px\) \+ var\(--ddd-tabh, 44px\) \+ 12px\); \}/.test(on),
      '文档库段锚点补偿也加上 tab 条高度')
    ok(/rootMargin: '-' \+ \(hubH \+ dnavH \+ 10 \+ tabH\) \+ 'px 0px -62% 0px'/.test(on),
      '文档库 scrollspy 的判定边界跟着下移一个 tab 条')
  }
  // ---- tabRail 同开:rail 让位(tab 条根本不走,再浮一条就是多余) ----
  {
    const c3 = JSON.parse(readFileSync(cfgP, 'utf8'))
    c3.tabRail = true
    wr(cfgP, c3)
    const rr = runGen(NEW_SCRIPTS, fx62.kb)
    const both = readFileSync(idxP, 'utf8')
    ok(rr.status === 0 && count(both, 'class="tabrail"') === 0 && !both.includes('railitem'),
      'stickyTabs 与 tabRail 同开:rail 一点不渲染', `exit ${rr.status}`)
    ok(both.includes('.tabbar { position: sticky'), '同开时吸顶那条照旧在(让位的是 rail,不是吸顶)')
    c3.tabRail = false
    wr(cfgP, c3)
    runGen(NEW_SCRIPTS, fx62.kb)
  }
  {
    const sc = readFileSync(idxP, 'utf8').match(/<script>([\s\S]*?)<\/script>/g)
      .map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  cfg.stickyTabs = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx62.kb)
  ok(sha(idxP) === offSha, '关回后与冻结基线逐字节相同')
}

// ============ T63 时间线左栏:整格可点 + 与轴行同一套栅格(releaseTab 关档照旧四拍冻结)============
console.log('T63 时间线左栏整格可点 / 轴行对齐')
{
  const fx63 = mkFixture('fx63', { 's.html': demoHtml('s') })
  const cfgP = join(fx63.kb, 'kanban.config.json'), idxP = join(fx63.kb, 'index.html')
  const relP = join(fx63.kb, 'release-manifest.json')
  const mP = join(fx63.kb, 'manifest.json'), decP = join(fx63.kb, 'decisions-manifest.json'), blP = join(fx63.kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  const mm = rd(mP), dec = rd(decP), bl = rd(blP)
  for (const x of [mm, dec, bl]) { x.instance.ghRepo = 'o/r'; x.instance.branch = 'main' }
  wr(mP, mm); wr(decP, dec); wr(blP, bl)
  wr(relP, REL_MANIFEST)
  const cfg = rd(cfgP)

  // ---- 四拍:未配 → false 比 sha → true 验行为 → 关回比 sha ----
  runGen(NEW_SCRIPTS, fx63.kb)
  const offSha = sha(idxP)
  ok(!readFileSync(idxP, 'utf8').includes('relgut'), '未配 releaseTab:壳里零时间线左栏痕迹')
  cfg.releaseTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx63.kb)
  ok(sha(idxP) === offSha, 'releaseTab:false 与未配逐字节相同(冻结)')

  cfg.releaseTab = true
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, fx63.kb)
  ok(r.status === 0, 'releaseTab:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')

  // ---- ① 整格是触发面:role / tabindex / aria-expanded / title 都在 .relgut 那一层 ----
  ok(/<div class="relgut" role="button" tabindex="0" aria-expanded="' \+ \(op \? 'true' : 'false'\)/.test(on),
    '左栏整格就是触发面:role=button + tabindex,aria-expanded 跟着展开态走')
  ok(on.includes(`+ '" data-relbd="' + xe(g.g) + '" title="' + xe(g.sf || '') + '" style="height:' + H + 'px">'`),
    'data-relbd 与 title 一并搬上整格(提示原样不变),格高仍是整条带的高')
  {
    const draw = on.slice(on.indexOf('function drawTl()'), on.indexOf('function toggleBand('))
    ok(draw.length > 500 && draw.includes(`'<span class="relbh">'`) && draw.includes('</span></span></span>') && !draw.includes('<button'),
      '带头那两行退成 <span>:交互语义只留在整格那一层,不再往里嵌一颗按钮', draw.length + ' 字符')
  }
  ok(on.includes(`var bh = t.closest('.relgut')`) && !on.includes(`t.closest('.relbh')`),
    '点击委托认整格(.relgut),不再只认文字那颗钮 —— 展开后那片底色也点得动')
  ok(/if \(ev\.key !== 'Enter' && ev\.key !== ' ' && ev\.key !== 'Spacebar'\) return/.test(on) &&
    on.includes(`ev.target.closest('.relgut')`) && /ev\.preventDefault\(\) \/\/ 空格的默认动作是翻页/.test(on),
    'role=button 自己认 Enter / Space(那一手原生 <button> 才白送),空格拦下翻页')
  ok(/function toggleBand\(id, keep\) \{/.test(on) && count(on, 'toggleBand(') === 3 &&
    on.includes(`gs[k].dataset.relbd === id) { gs[k].focus(); return }`),
    '点击与键盘共用同一个 toggleBand;键盘那次重画后把焦点还回同一条带的格子(drawTl 整片换 DOM)')
  ok(/\.relgut \{[^}]*cursor: pointer/.test(on) && /\.relgut:hover::after \{ opacity: \.05; \}/.test(on) &&
    /\.relgut:focus-visible \{ outline:/.test(on),
    '整格 cursor: pointer + hover 整格轻微高亮 + 键盘可见焦点圈')

  // ---- ② 左栏宽只定义一处;轴行与带行读同一个变量、画同样的右边框 ----
  {
    const styleAll = on.slice(on.indexOf('<style>'), on.indexOf('</style>'))
    const cut = styleAll.indexOf('/* 时间线(v0.13.1 重做)')
    const end = styleAll.indexOf('@media (max-width: 820px)', cut)
    const tlCss = styleAll.slice(cut, end)
    ok(cut > 0 && count(tlCss, '--relgut:') === 1 && count(tlCss, '200px') === 1,
      `左栏宽只在一处落成字面值(--relgut: 200px),别处一律读变量`, `${count(tlCss, '--relgut:')} 处定义 / ${count(tlCss, '200px')} 处字面`)
    ok(count(tlCss, 'width: var(--relgut)') === 3,
      '轴行左栏 / 带左栏 / 带内小标题三处都读同一个变量', count(tlCss, 'width: var(--relgut)') + ' 处')
    const same = (cls) => new RegExp('\\.' + cls + ' \\{[^}]*position: sticky; left: 0;[^}]*border-right: 1px solid var\\(--line\\)').test(tlCss)
    ok(same('reltlag') && same('relgut'),
      '轴行左栏与带左栏同一套:同 sticky、同右边框 —— 同一个滚动容器,横滚时两条分隔线咬在一起')
  }
  ok(on.includes(`'<div class="reltlax" style="width:' + ax.W + 'px"><div class="reltlag"></div>'`),
    '轴行开头真的落了一格 .reltlag(v0.15.4 那一截是空的,日期会滑到带名底下)')
  {
    const cssW = Number((on.match(/--relgut: (\d+)px/) || [, '0'])[1])
    const jsW = Number((on.match(/var TL = \{ lbl: (\d+),/) || [, '0'])[1])
    ok(cssW > 0 && cssW === jsW, `轴的起点偏移 TL.lbl(${jsW})与左栏宽 --relgut(${cssW}px)是同一个数`)
  }
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }
  { // lazy 档:时间线是运行期画的,左栏这套全在壳里
    cfg.lazyTabs = true
    wr(cfgP, cfg)
    runGen(NEW_SCRIPTS, fx63.kb)
    const lzOn = readFileSync(idxP, 'utf8')
    const pRel = readFileSync(join(fx63.kb, 'parts', 'release.html'), 'utf8')
    ok(lzOn.includes('.relgut {') && lzOn.includes('class="relgut"') && !pRel.includes('relgut') && !pRel.includes('reltlag'),
      'lazy 档:左栏的样式与绘制都在壳里,parts/release.html 一个字不多')
    cfg.lazyTabs = false
    wr(cfgP, cfg)
  }
  cfg.releaseTab = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx63.kb)
  ok(sha(idxP) === offSha, '关回后与冻结基线逐字节相同')
}

// ============ T64 Backlog 排序分段 backlogSort(opt-in;关档逐字节冻结;默认档 = 烤入顺序)============
console.log('T64 Backlog 排序分段 backlogSort')
{
  const fx64 = mkFixture('fx64', { 's.html': demoHtml('s') })
  const kb = fx64.kb
  const cfgP = join(kb, 'kanban.config.json'), idxP = join(kb, 'index.html'), blP = join(kb, 'backlog-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const bl = rd(blP)
  bl.tiers = { 1: '核心' }
  const st = Object.keys(bl.statuses)[0], pri = Object.keys(bl.priorities)[0]
  const item = (id, date, title) => ({ id, status: st, priority: pri, tier: '1', date, title, problem: 'p', approach: 'a', area: 'x', source: 's' })
  // 同日期一对(BL-2 / BL-11):烤入顺序同日按编号大→小,「最近立卡」照搬这个顺序(它就是烤入顺序)
  bl.items = [item('BL-2', '2026-03-03', '甲'), item('BL-11', '2026-03-03', '乙'), item('BL-7', '2026-01-01', '丙'), item('BL-4', '', '丁')]
  wr(blP, bl)

  // ---- 四拍:未配 → false 比 sha → true 验行为 → 关回比 sha ----
  runGen(NEW_SCRIPTS, kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('blsortseg') && !off.includes('data-udate=') && !off.includes('data-ord=') && !off.includes('BLS_KEY'),
    '未配 backlogSort:分段、两枚派生属性、记忆键一个字都不出')
  ok(off.includes('<select id="blsort" aria-label="排序">') && off.includes('<select id="decsort" aria-label="排序">'),
    '未配时两个 pane 都还是原来那只排序下拉')
  const cfg = rd(cfgP)
  cfg.backlogSort = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === offSha, 'backlogSort:false 与未配逐字节相同(冻结)')

  cfg.backlogSort = true
  wr(cfgP, cfg)
  const r = runGen(NEW_SCRIPTS, kb)
  ok(r.status === 0, 'backlogSort:true gen exit 0', r.stderr)
  const on = readFileSync(idxP, 'utf8')

  // ---- 控件:分段替掉 Backlog 那只下拉,决策那只一个字没动 ----
  ok(!on.includes('<select id="blsort"') && on.includes('<select id="decsort" aria-label="排序">'),
    'Backlog 那只排序下拉换成了分段;决策 pane 的下拉原样留着')
  const segHtml = (on.match(/<div class="lseg" id="blsortseg"[\s\S]*?<\/div>/) || [''])[0]
  ok(/<span class="tlab">排序<\/span>\s*<div class="lseg" id="blsortseg"/.test(on),
    '分段前面是一枚安静的「排序」小灰字(与「线别」那组同款 .tlab + .lseg,零新增 CSS)')
  ok([...segHtml.matchAll(/data-sort="([^"]+)"[^>]*>([^<]+)</g)].map((m) => m[1] + '=' + m[2]).join(' ') ===
    'ord=最近立卡 udate-desc=最近更新 date-asc=最早立卡 id=按编号',
    '四档次序:最近立卡 / 最近更新 / 最早立卡 / 按编号 —— 后两档是原下拉里那两项,换控件不丢功能',
    segHtml)
  ok(!segHtml.includes('>默认<') && !segHtml.includes('cdate-desc'),
    '没有单独的「默认」钮:烤入顺序本就是建卡日新→旧,两颗点着没区别的钮读起来像坏的')
  ok(/data-sort="ord" class="on"/.test(segHtml) && count(segHtml, 'class="on"') === 1,
    '「最近立卡」预先亮着,它就是默认档(装了这个开关的板,不点就跟以前一模一样)')
  ok(!on.includes('.blsortseg {') && !on.includes('.sortseg'), '没有为它新写一条 CSS(借的是线别分段那套)')

  // ---- 派生属性 ----
  const cards = [...on.matchAll(/<article class="blcard[^>]*id="(BL-[^"]+)"[^>]*data-date="([^"]*)"[^>]*data-udate="([^"]*)" data-ord="(\d+)"/g)]
    .map((m) => ({ id: m[1], date: m[2], udate: m[3], ord: Number(m[4]) }))
  ok(cards.length === 4, '四张卡都烤上了 data-udate / data-ord', String(cards.length))
  ok(cards.every((c) => c.udate === c.date), '没拆卡的板:更新日期 = 建卡日期(两把尺量出同一个数,不是漏了)')
  // 烤入顺序 = blByStatus 的 byDateDesc(同日按编号大→小),data-ord 记的正是它渲染出来的位次
  ok(cards.map((c) => c.id + ':' + c.ord).join(' ') === 'BL-11:0 BL-2:1 BL-7:2 BL-4:3',
    'data-ord = 分区内烤入位次 0..n-1(「最近立卡」靠它原样还原)', cards.map((c) => c.id + ':' + c.ord).join(' '))
  ok(cards.map((c) => c.date).join(' ') === '2026-03-03 2026-03-03 2026-01-01 ',
    '烤入位次本身就是建卡日新→旧 —— 所以「最近立卡」== 原样还原,不是两回事',
    cards.map((c) => c.date).join(' '))

  // ---- 运行期比较器:从壳里原样抠出来跑 ----
  {
    const s = on.indexOf('\n  const tbNum = ')
    const e = on.indexOf('\n  const toolbars = []')
    const src = on.slice(s, e)
    ok(src.includes('BLS_KEY') && src.includes('tbUdCmp'), '抠得到那段(比较器与记忆键都在壳里)')
    const F = new Function(src + '\n  return { tbOrdCmp, tbUdCmp, tbIdAsc, BLS_KEY, BLS_OK, TB_SORT_LABEL }')()
    ok(F.BLS_KEY === 'htest_bl_sort', '记忆键走 LS_PREFIX 老规矩:<brand>_bl_sort', F.BLS_KEY)
    ok(F.BLS_OK.join(' ') === 'ord udate-desc date-asc id', 'BLS_OK 就是分段那四档(存了别的值一律不认)')
    ok(count(on, 'tbNum(a.id) - tbNum(b.id)') === 1,
      '编号比较器在产物里只有一份:「按编号」那颗钮与 tbUdCmp 的同日退让走同一把尺(两份迟早给出两种顺序)',
      String(count(on, 'tbNum(a.id) - tbNum(b.id)')))
    ok(F.BLS_OK.indexOf('cdate-desc') < 0,
      '0.15.12 存下的 cdate-desc 不在白名单里 —— 接线那句会把它落回默认档「最近立卡」,而不是卡住')
    ok(F.TB_SORT_LABEL['ord'] === '最近立卡' && F.TB_SORT_LABEL['udate-desc'] === '最近更新'
      && F.TB_SORT_LABEL['cdate-desc'] === undefined,
      'meta 行回声钮面:分段那两档在同一屏上不说两套话(旧那一档的名字也不再留着)', JSON.stringify(F.TB_SORT_LABEL))
    ok(F.TB_SORT_LABEL['date-asc'] === '日期旧→新',
      '与决策那只下拉共用的两个键不动 —— 在这儿改会把决策工具条的 meta 也一起改掉', F.TB_SORT_LABEL['date-asc'])
    const el = (id, udate, date, ord) => ({ id, dataset: { udate, date, ord: String(ord) } })
    // 烤入顺序:同日按编号大→小(BL-11 在 BL-2 前);无日期沉底
    const deck = [el('BL-11', '2026-05-05', '2026-03-03', 0), el('BL-2', '2026-01-09', '2026-03-03', 1),
      el('BL-7', '2026-09-09', '2026-01-01', 2), el('BL-4', '', '', 3)]
    const order = (cmp) => deck.slice().sort(cmp).map((x) => x.id).join(' ')
    ok(order(F.tbOrdCmp) === 'BL-11 BL-2 BL-7 BL-4',
      '最近立卡:按 data-ord 还原成烤入顺序(建卡日新→旧,同日编号大→小,无日期沉底)', order(F.tbOrdCmp))
    ok(order(F.tbUdCmp) === 'BL-7 BL-11 BL-2 BL-4', '最近更新:更新日新→旧,没日期的沉底', order(F.tbUdCmp))
    ok(order(F.tbUdCmp) !== order(F.tbOrdCmp),
      '两把尺量出的确实是两个序 —— 「最近更新」不是「最近立卡」的换皮')
    ok(order(F.tbIdAsc) === 'BL-2 BL-4 BL-7 BL-11', '按编号:前缀字母序 + 数字小→大(11 排在 7 之后,不是字符串序)', order(F.tbIdAsc))
    // 稳定性:全同日 + 全同 udate 时退回编号,不会随机
    const tie = [el('A-3', '2026-01-01', '2026-01-01', 0), el('A-1', '2026-01-01', '2026-01-01', 1)]
    ok(tie.slice().sort(F.tbUdCmp).map((x) => x.id).join(' ') === 'A-1 A-3', '全打平时退到编号,结果是定的')
  }
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((x) => x.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }

  // ---- 拆卡之后:更新日期真的与建卡日期分开了 ----
  {
    // 拆分自带的等价门:data-udate 是拆分之后才有的新事实,得与 .udate / data-dorm 同样归一,
    // 否则 backlogSort 一开,cards-split 会判自己「把看板拆坏了」并回滚(0.15.12 就在这里被逮到过)
    const sp = spawnSync(process.execPath, [join(NEW_SCRIPTS, 'cards-split.mjs'), '--dir', kb], { encoding: 'utf8' })
    ok(sp.status === 0, 'backlogSort 开着也拆得动:cards-split exit 0(等价门认得 data-udate)', (sp.stdout || '') + (sp.stderr || ''))
    const cd = join(kb, 'cards', 'backlog')
    const t = new Date('2026-06-06T12:00:00Z')
    utimesSync(join(cd, 'BL-7.json'), t, t) // git 里还没这文件 → 退 mtime,正是那条既有降级链
    runGen(NEW_SCRIPTS, kb)
    const split = readFileSync(idxP, 'utf8')
    const m7 = split.match(/id="BL-7"[^>]*data-date="([^"]*)"[^>]*data-udate="([^"]*)"/)
    ok(m7 && m7[1] === '2026-01-01' && m7[2] === '2026-06-06',
      '拆卡后 data-udate 走的是 0.14.0 那条卡文件更新日(含 mtime 兜底),与建卡日各说各的', m7 ? m7.join(' / ') : 'no match')
    ok(split.includes('class="udate"'), '卡头上那枚「更新」灰字照旧在(排序这把尺,人眼也看得见)')
    spawnSync(process.execPath, [join(NEW_SCRIPTS, 'cards-join.mjs'), '--dir', kb], { encoding: 'utf8' })
  }
  // ---- 归档 pane:这一版不给它控件,但同一张 blCard 的属性它也带着(将来要加就是接一根线) ----
  {
    const c2 = rd(cfgP)
    c2.backlogArchive = true
    wr(cfgP, c2)
    const ra = runGen(NEW_SCRIPTS, kb)
    const arch = readFileSync(idxP, 'utf8')
    ok(ra.status === 0 && arch.includes('id="pane-archive"') && count(arch, '<div class="lseg" id="blsortseg"') === 1,
      '归档 pane 没有第二排排序分段(这一版只动 Backlog)', `exit ${ra.status}`)
    c2.backlogArchive = false
    wr(cfgP, c2)
    runGen(NEW_SCRIPTS, kb)
  }
  cfg.backlogSort = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === offSha, '关回后与冻结基线逐字节相同')
}

// ============ T65 看板只在主线上改(BL-C112 §1:board-branch-check + 守卫那条非阻断 notice)============
console.log('T65 看板改动落在哪条分支上 board-branch-check')
{
  const runChk = (kb, extra = []) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'board-branch-check.mjs'), '--dir', kb, ...extra], { encoding: 'utf8' })
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')

  { // ---- 未拆板:分支上动了 backlog-manifest / 卡目录 → 点名;干净分支与主线上一言不发 ----
    const fx = mkFixture('fx65a', { 's.html': demoHtml('s') })
    const kb = fx.kb, root = fx.root
    const g = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' })
    g('config', 'user.email', 't@example.com'); g('config', 'user.name', 'T')
    g('checkout', '-q', '-B', 'main')
    const blP = join(kb, 'backlog-manifest.json')
    const bl = rd(blP)
    bl.tiers = { 1: '核心' }
    bl.instance.branch = 'main'
    bl.items = [{ id: 'BL-1', status: 'ready', priority: 'high', tier: '1', title: '甲', problem: 'p', approach: 'a', area: 'x', source: 's' }]
    wr(blP, bl)
    g('add', '-A'); g('commit', '-qm', 'init')

    const onMain = runChk(kb)
    ok(onMain.status === 0 && /当前就在 main 上/.test(onMain.stdout), '当前就在主线上:没有分支要比,一句说明,exit 0', `${onMain.status} ${onMain.stdout}${onMain.stderr}`)

    g('checkout', '-q', '-b', 'feat/clean')
    writeFileSync(join(root, 'README.md'), 'x\n')
    g('add', '-A'); g('commit', '-qm', 'no board change')
    const clean = runChk(kb)
    ok(clean.status === 0 && /干净/.test(clean.stdout) && !/⚠/.test(clean.stdout), '分支上没动看板:一个 ⚠ 都不出', clean.stdout)
    const cleanStop = runStop(NEW_SCRIPTS, root)
    ok(!/带着看板改动/.test(cleanStop.stdout), '守卫在干净分支上完全不出声(零命中不说话)', cleanStop.stdout.slice(0, 200))

    g('checkout', '-q', '-b', 'feat/dirty')
    const bl2 = rd(blP)
    bl2.items.push({ id: 'BL-2', status: 'ready', priority: 'high', tier: '1', title: '乙', problem: 'p', approach: 'a', area: 'x', source: 's' })
    wr(blP, bl2)
    g('add', 'app/kanban/backlog-manifest.json'); g('commit', '-qm', 'board change on a branch')
    const dirty = runChk(kb)
    ok(dirty.status === 0 && /⚠/.test(dirty.stdout) && /feat\/dirty/.test(dirty.stdout) && /backlog-manifest\.json/.test(dirty.stdout),
      '分支上动了看板数据:点名分支与文件', dirty.stdout.slice(0, 300))
    ok(/数据 1 /.test(dirty.stdout), '分了类:manifest 算「数据」', (dirty.stdout.match(/数据 \d+[^\n]*/) || [''])[0])
    ok(/只在 main 上改/.test(dirty.stdout), '末尾把规矩与补救动作说清(checkout main -- 看板目录,再在 main 上重放)')
    ok(runChk(kb, ['--strict']).status === 1 && runChk(kb).status === 0, '默认恒 exit 0(提醒不是闸),--strict 才给 CI 当门用')
    const j = runChk(kb, ['--json'])
    const jd = JSON.parse(j.stdout)
    ok(jd.hits.length === 1 && jd.hits[0].data.length === 1 && jd.hits[0].hazard.length === 0, '--json 给结构化结果(没配 cardsDir 时没有 items 隐患)', j.stdout.slice(0, 200))

    const stop = runStop(NEW_SCRIPTS, root)
    ok(/带着看板改动/.test(stop.stdout) && /feat\/dirty/.test(stop.stdout), '守卫在带看板改动的分支上出一条 notice', stop.stdout.slice(0, 300))
    ok(!/"decision":\s*"block"/.test(stop.stdout), '这条永远不阻断收工')

    const named = runChk(kb, ['--branch', 'feat/clean'])
    ok(/干净/.test(named.stdout), '--branch 可以点名比别的分支', named.stdout)
    const all = runChk(kb, ['--all'])
    ok(/feat\/dirty/.test(all.stdout) && !/feat\/clean/.test(all.stdout), '--all 扫全部分支,只列真命中的那条', all.stdout.slice(0, 300))

    // 三个桶都装上东西:只提交一个数据文件时 gen[]/other[] 恒空,分类那一行等于没测过
    mkdirSync(join(kb, 'refs'), { recursive: true })
    writeFileSync(join(kb, 'index.html'), '<!doctype html>\n<!-- ddd-gen v0.0.0 -->\n')
    writeFileSync(join(kb, 'refs', 'x.html'), '<p>x</p>\n')
    writeFileSync(join(kb, 'demos', 'later.html'), demoHtml('later'))
    const cfg65 = rd(join(kb, 'kanban.config.json')); cfg65.port = 8123; wr(join(kb, 'kanban.config.json'), cfg65)
    // 只提交这四个:gen 会改写 demo 与 index(注入返回块 / 重生成),-A 会把它们一并带进来,桶数就不定了
    g('add', 'app/kanban/index.html', 'app/kanban/refs/x.html', 'app/kanban/kanban.config.json', 'app/kanban/demos/later.html')
    g('commit', '-qm', 'gen + config + demo on the branch')
    const buckets = runChk(kb)
    ok(/数据 2 · 产物 2 · 其它 1/.test(buckets.stdout), '三个桶各按各的正则分:kanban.config.json 算数据,index.html 与 refs/ 算产物,demo 算其它',
      (buckets.stdout.match(/数据 \d+[^\n]*/) || [''])[0])
    const jb = JSON.parse(runChk(kb, ['--json']).stdout)
    ok(jb.hits[0].gen.some((f) => /refs\//.test(f)) && jb.hits[0].gen.some((f) => /index\.html$/.test(f)), 'refs/ 与 index.html 都进「产物」桶', JSON.stringify(jb.hits[0].gen))
    ok(jb.hits[0].data.some((f) => /kanban\.config\.json$/.test(f)), 'kanban.config.json 进「数据」桶 —— 开关 tab、改 wip 阈值正是最该拦的那一类', JSON.stringify(jb.hits[0].data))
    ok(jb.hits[0].other.some((f) => /demos\//.test(f)), 'demo 进「其它」桶', JSON.stringify(jb.hits[0].other))

    // 未提交的看板改动:补救那条 checkout 会连它们一起盖掉,清单不说就是安静地丢内容(SEC-2)
    const blDirty = rd(blP); blDirty.items[0].title = '甲(改了还没提交)'; wr(blP, blDirty)
    const withDirty = runChk(kb)
    ok(/没提交的看板改动/.test(withDirty.stdout) && /backlog-manifest\.json/.test(withDirty.stdout.split('没提交的看板改动')[1] || ''),
      '工作区里没提交的看板改动单列一段,点名到文件 —— 那条 checkout 会连它们一起盖掉', withDirty.stdout.slice(-400))
    const dirtyJson = JSON.parse(runChk(kb, ['--json']).stdout)
    ok(dirtyJson.dirty.some((f) => /backlog-manifest\.json$/.test(f)), '--json 里也给 dirty', JSON.stringify(dirtyJson.dirty))
    const dirtyStop = runStop(NEW_SCRIPTS, root)
    ok(/没提交的看板改动/.test(dirtyStop.stdout), '守卫那条也带上这句警告(它给的正是同一条命令)', dirtyStop.stdout.slice(0, 600))
    g('checkout', '-q', '--', '.')
    ok(JSON.parse(runChk(kb, ['--json']).stdout).dirty.length === 0, '工作区干净时 dirty 为空 —— 文案与 0.15.x 一字不差')

    // 游离 HEAD(rebase / bisect / CI 的 actions/checkout):同一棵树、同一份改动,不许改口
    g('checkout', '-q', '--detach', 'HEAD')
    const det = runChk(kb)
    ok(/⚠/.test(det.stdout) && /数据 2/.test(det.stdout), '游离 HEAD 上照样点名(0.15.14 在这里会说「当前就在 main 上」)', det.stdout.slice(0, 300))
    ok(/游离/.test(det.stdout) && !/当前就在 main 上/.test(det.stdout), '并且说清按什么比的 —— 不冒充「你在主线上」', (det.stdout.match(/[^\n]*游离[^\n]*/) || [''])[0])
    ok(runChk(kb, ['--strict']).status === 1, '--strict 在游离 HEAD 上照样是门(CI 的 checkout 默认就是游离的)')
    const detJson = JSON.parse(runChk(kb, ['--json']).stdout)
    ok(detJson.scanned === 1 && detJson.hits.length === 1 && detJson.detached === true, '--json:游离位置当一条 ref 扫,不是 scanned 0', JSON.stringify({ s: detJson.scanned, d: detJson.detached }))
    const detStop = runStop(NEW_SCRIPTS, root)
    ok(/带着看板改动/.test(detStop.stdout), '守卫在游离 HEAD 上也出声', detStop.stdout.slice(0, 200))
    ok(/当前就在 main 上/.test(runChk(kb, ['--branch', 'main']).stdout), '显式点名主线仍是「没有要比的分支」')
    g('checkout', '-q', 'main') // 收摊:别把这块板留在分支上影响后面的用例

    // 本地没有主线分支(worktree / 只 fetch 过远端的 CI 克隆)→ 退到 origin/<main>,不是整体变哑
    const mainSha = (g('rev-parse', 'main').stdout || '').trim()
    g('update-ref', 'refs/remotes/origin/main', mainSha)
    g('checkout', '-q', '-B', 'tmp-work', mainSha)
    g('update-ref', '-d', 'refs/heads/main')
    const fb = JSON.parse(runChk(kb, ['--branch', 'feat/dirty', '--json']).stdout)
    ok(fb.main === 'origin/main' && (fb.hits || []).length === 1, '本地没 main 时基准退到 origin/main,照常比得出来 —— 少了这条回退,worktree 与只 fetch 过远端的 CI 克隆整体变哑', JSON.stringify(fb))
    g('update-ref', 'refs/heads/main', mainSha)
    g('checkout', '-q', 'main')
  }

  { // ---- 两条 skip:不在 git 仓里 / 找不到主线 —— 都是「本次不做判断」,不是「干净」 ----
    const fx = mkFixture('fx65c', { 's.html': demoHtml('s') })
    rmSync(join(fx.root, '.git'), { recursive: true, force: true })
    const noGit = runChk(fx.kb)
    ok(noGit.status === 0 && /不在 git 仓里/.test(noGit.stdout) && !/干净/.test(noGit.stdout),
      '板不在 git 仓里:说明白「本次不做判断」,不冒充干净', noGit.stdout)

    const fx2 = mkFixture('fx65d', { 's.html': demoHtml('s') })
    const g2 = (...a) => spawnSync('git', a, { cwd: fx2.root, encoding: 'utf8' })
    g2('config', 'user.email', 't@example.com'); g2('config', 'user.name', 'T')
    g2('checkout', '-q', '-B', 'trunk')
    const bl2P = join(fx2.kb, 'backlog-manifest.json')
    const bl2 = rd(bl2P); bl2.instance.branch = 'no-such-branch'; wr(bl2P, bl2)
    g2('add', '-A'); g2('commit', '-qm', 'init')
    const noMain = runChk(fx2.kb)
    ok(noMain.status === 0 && /找不到主线分支 no-such-branch/.test(noMain.stdout) && !/干净/.test(noMain.stdout),
      '找不到主线分支:同样是「本次不做判断」', noMain.stdout)
  }

  { // ---- 拆过卡的板:分支把 items 数组带回头文件 = gen 会硬报错的那一类,合并前就点出来 ----
    const fx = mkFixture('fx65b', { 's.html': demoHtml('s') })
    const kb = fx.kb, root = fx.root
    const g = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' })
    g('config', 'user.email', 't@example.com'); g('config', 'user.name', 'T')
    g('checkout', '-q', '-B', 'main')
    const blP = join(kb, 'backlog-manifest.json'), cfgP = join(kb, 'kanban.config.json')
    const bl = rd(blP)
    bl.tiers = { 1: '核心' }
    const card = { id: 'BL-1', status: 'ready', priority: 'high', tier: '1', title: '甲', problem: 'p', approach: 'a', area: 'x', source: 's' }
    delete bl.items
    wr(blP, bl)
    const cfg = rd(cfgP); cfg.cardsDir = 'cards'; wr(cfgP, cfg)
    mkdirSync(join(kb, 'cards', 'backlog'), { recursive: true })
    mkdirSync(join(kb, 'cards', 'decisions'), { recursive: true })
    wr(join(kb, 'cards', 'backlog', 'BL-1.json'), card)
    const dec = rd(join(kb, 'decisions-manifest.json')); delete dec.entries; wr(join(kb, 'decisions-manifest.json'), dec)
    g('add', '-A'); g('commit', '-qm', 'split')

    g('checkout', '-q', '-b', 'feat/pre-split')
    const back = rd(blP); back.items = [card, { ...card, id: 'BL-9' }]; wr(blP, back) // 拆分之前的旧快照原样合回来
    g('add', '-A'); g('commit', '-qm', 'stale items array')
    const r = runChk(kb)
    ok(/⛔/.test(r.stdout) && /items 数组/.test(r.stdout) && /2 条/.test(r.stdout),
      'items 隐患单列一行,写清条数与后果', (r.stdout.match(/⛔[^\n]*/) || [''])[0].slice(0, 160))
    const jd = JSON.parse(runChk(kb, ['--json']).stdout)
    ok(jd.hits[0].hazard.length === 1 && jd.hits[0].hazard[0].key === 'items' && jd.hits[0].hazard[0].n === 2,
      '隐患认的是「头文件里有 items 且这块板已拆卡」,条数如实报', JSON.stringify(jd.hits[0].hazard))
    ok(jd.hits[0].data.some((f) => /cards\//.test(f)) === false && jd.hits[0].data.length === 1, 'cards/ 下没动的话数据只算头文件那一个', JSON.stringify(jd.hits[0].data))
    g('checkout', '-q', 'main')
  }
}

// ============ T66 归版按打 tag 时刻(BL-C112 §2:tag 时刻 ≠ publishedAt 时,窗口内的 PR 归上一版)============
console.log('T66 归版按 tag 时刻')
{
  const fx = mkFixture('fx66', { 's.html': demoHtml('s') })
  const relP = join(fx.kb, 'release-manifest.json')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o))
  for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
    const x = rd(join(fx.kb, f)); x.instance.ghRepo = 'o/r'; x.instance.branch = 'main'; wr(join(fx.kb, f), x)
  }
  // v0.0.1 是历史:at 是 0.15.13 落盘的 publishedAt,prs 是人核过的 —— 这一趟一个字节都不许动它
  wr(relP, {
    stages: REL_MANIFEST.stages,
    releases: [{ tag: 'v0.0.1', at: '2026-08-01T00:00:00Z', note: '首版', prs: [1] }],
    prs: [], syncedAt: null,
  })
  // 假 gh:v0.0.3 的 tag 时刻比 publishedAt 早 26 分钟(demo 里那条真事实),窗口里卡着一个 PR
  const mkGh = (dir, body) => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'gh'), `#!${process.execPath}\n${body}`)
    chmodSync(join(dir, 'gh'), 0o755)
    return dir
  }
  const PRS = JSON.stringify([
    { number: 2, title: '窗口里合的', state: 'MERGED', isDraft: false, baseRefName: 'main', headRefName: 'f2', url: 'https://github.com/o/r/pull/2', createdAt: '2026-08-25T01:00:00Z', mergedAt: '2026-08-26T06:50:00Z', closedAt: '2026-08-26T06:50:00Z' },
    { number: 3, title: 'tag 之前合的', state: 'MERGED', isDraft: false, baseRefName: 'main', headRefName: 'f3', url: 'https://github.com/o/r/pull/3', createdAt: '2026-08-25T01:00:00Z', mergedAt: '2026-08-26T06:00:00Z', closedAt: '2026-08-26T06:00:00Z' },
  ])
  const RELS = JSON.stringify([{ tagName: 'v0.0.3', publishedAt: '2026-08-26T07:06:18Z' }])
  const annotated = mkGh(join(WORK, 'fakegh-tag-a'), `
const a = process.argv.slice(2)
if (a[0] === 'pr') { console.log(${JSON.stringify(PRS)}); process.exit(0) }
if (a[0] === 'release') { console.log(${JSON.stringify(RELS)}); process.exit(0) }
if (a[0] === 'api' && /git\\/ref\\/tags\\/v0\\.0\\.3$/.test(a[1])) { console.log(JSON.stringify({ object: { sha: 'TAGSHA', type: 'tag' } })); process.exit(0) }
if (a[0] === 'api' && /git\\/tags\\/TAGSHA$/.test(a[1])) { console.log(JSON.stringify({ tagger: { date: '2026-08-26T06:40:11Z' } })); process.exit(0) }
process.exit(1)
`)
  const runSync = (dir) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'pr-sync.mjs'), '--dir', fx.kb],
    { encoding: 'utf8', env: { ...process.env, PATH: dir } })
  const r = runSync(annotated)
  ok(r.status === 0, 'pr-sync exit 0(annotated tag)', `${r.stdout}${r.stderr}`)
  const out = rd(relP)
  const v3 = out.releases.find((x) => x.tag === 'v0.0.3')
  ok(v3.at === '2026-08-26T06:40:11Z', 'at 落的是 tagger.date,不是 release publishedAt', v3.at)
  ok(JSON.stringify(v3.prs) === '[3]', '打完 tag 到点发布之间合的 #2 不算进这一版(按 publishedAt 会把它算进来)', JSON.stringify(v3.prs))
  const v1 = out.releases.find((x) => x.tag === 'v0.0.1')
  ok(v1.at === '2026-08-01T00:00:00Z' && JSON.stringify(v1.prs) === '[1]' && v1.note === '首版',
    '已落盘的老条目一个字节都不回填(历史归属不静默重算)', JSON.stringify(v1))
  ok(!/publishedAt|退回/.test(r.stderr), '取得到 tag 时刻就不吵', r.stderr.slice(0, 160))

  { // lightweight tag:没有 tag 对象,退到它指的 commit 的 committer.date
    const fx2 = mkFixture('fx66b', { 's.html': demoHtml('s') })
    for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
      const x = rd(join(fx2.kb, f)); x.instance.ghRepo = 'o/r'; x.instance.branch = 'main'; wr(join(fx2.kb, f), x)
    }
    const light = mkGh(join(WORK, 'fakegh-tag-b'), `
const a = process.argv.slice(2)
if (a[0] === 'pr') { console.log(${JSON.stringify(PRS)}); process.exit(0) }
if (a[0] === 'release') { console.log(${JSON.stringify(RELS)}); process.exit(0) }
if (a[0] === 'api' && /git\\/ref\\/tags\\//.test(a[1])) { console.log(JSON.stringify({ object: { sha: 'C1', type: 'commit' } })); process.exit(0) }
if (a[0] === 'api' && /git\\/commits\\/C1$/.test(a[1])) { console.log(JSON.stringify({ committer: { date: '2026-08-26T06:41:00Z' } })); process.exit(0) }
process.exit(1)
`)
    const r2 = spawnSync(process.execPath, [join(NEW_SCRIPTS, 'pr-sync.mjs'), '--dir', fx2.kb], { encoding: 'utf8', env: { ...process.env, PATH: light } })
    const o2 = rd(join(fx2.kb, 'release-manifest.json'))
    ok(r2.status === 0 && o2.releases[0].at === '2026-08-26T06:41:00Z', 'lightweight tag 退到 commit 的 committer.date', `${r2.status} ${o2.releases[0] && o2.releases[0].at}`)
  }

  { // 取不到 tag 时刻(权限 / 网络 / tag 已被删):退回 publishedAt,但要说一声
    const fx3 = mkFixture('fx66c', { 's.html': demoHtml('s') })
    for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
      const x = rd(join(fx3.kb, f)); x.instance.ghRepo = 'o/r'; x.instance.branch = 'main'; wr(join(fx3.kb, f), x)
    }
    const blind = mkGh(join(WORK, 'fakegh-tag-c'), `
const a = process.argv.slice(2)
if (a[0] === 'pr') { console.log(${JSON.stringify(PRS)}); process.exit(0) }
if (a[0] === 'release') { console.log(${JSON.stringify(RELS)}); process.exit(0) }
process.exit(1)
`)
    const r3 = spawnSync(process.execPath, [join(NEW_SCRIPTS, 'pr-sync.mjs'), '--dir', fx3.kb], { encoding: 'utf8', env: { ...process.env, PATH: blind } })
    const o3 = rd(join(fx3.kb, 'release-manifest.json'))
    ok(r3.status === 0 && o3.releases[0].at === '2026-08-26T07:06:18Z', '取不到就退回 publishedAt,同步照样落盘(不为一个时刻废掉整趟)', `${r3.status} ${o3.releases[0] && o3.releases[0].at}`)
    ok(/v0\.0\.3/.test(r3.stderr) && /publishedAt/.test(r3.stderr), 'stderr 点名是哪几版退了口径 —— 别让人以为拿到的是 tag 时刻', r3.stderr.slice(0, 200))
  }
}

// ============ T67 settleHold 有寿命(BL-C112 §3:CLI 记起算日 / 守卫满 14 天说一行 / 老卡退卡文件日)============
console.log('T67 settleHold 14 天到期提醒')
{
  // "今天"与 ddd.mjs 的 TODAY 同一个源(localDate,本地日历 getFullYear/Month/Date),不是
  // toISOString().slice(0, 10)(UTC)—— CLI 按本地日期戳 settleHoldAt,UTC 之东的机器在本地刚
  // 跨日、UTC 还没跨的那几个钟头,UTC 版本会晚一天,浮出这条测试(与 0.15.7 的 mtimeDay 同一类
  // 坑,那条是特意退回 UTC 跟 gen 的 mtime 兜底口径对齐;这条相反,是要跟本地口径对齐)。
  const { localDate } = await import(join(NEW_SCRIPTS, 'cards.mjs'))
  // 固定时钟断言(不依赖跑测试这一刻是不是正好落在 00:00-08:00 那几个钟头):本地 03:00 用
  // toISOString() 会因时区跨日折回前一天,localDate 不会 —— 三个字段都是本地取的,不落 UTC。
  ok(localDate(new Date(2026, 0, 1, 3, 0, 0)) === '2026-01-01', 'localDate 按本地日历取日期(2026-01-01 本地 03:00),不落到 UTC')
  const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d) }
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const runCli = (kb, args) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'ddd.mjs'), ...args, '--dir', kb], { encoding: 'utf8' })

  { // ---- CLI:写 settleHold 顺手记起算日;重设 = 续期;撤回 = 连日期一起收走 ----
    const fx = mkFixture('fx67a', { 's.html': demoHtml('s') })
    const blP = join(fx.kb, 'backlog-manifest.json')
    const bl = rd(blP)
    bl.tiers = { 1: '核心' }
    bl.instance.ghRepo = 'o/r'
    bl.items = [{ id: 'BL-1', status: 'ready', priority: 'high', tier: '1', title: '甲', problem: 'p', approach: 'a', area: 'x', source: 's' }]
    wr(blP, bl)
    const r1 = runCli(fx.kb, ['card', 'set', 'BL-1', 'settleHold', '这一轮只落了接口'])
    const c1 = rd(blP).items[0]
    ok(r1.status === 0 && c1.settleHoldAt === dayAgo(0), 'card set settleHold 顺手写下起算日(今天)', `${r1.status} ${c1.settleHoldAt}${r1.stderr}`)
    ok(Object.keys(c1).join(',').includes('settleHold,settleHoldAt'), '新键落在 settleHold 紧后面(键序规范里排好的位置)', Object.keys(c1).join(','))
    // 续期:先把日期改老,再重设一次 —— 日期该跟着归零
    const aged = rd(blP); aged.items[0].settleHoldAt = '2026-01-01'; wr(blP, aged)
    runCli(fx.kb, ['card', 'set', 'BL-1', 'settleHold', '还是那半截,下一轮收'])
    ok(rd(blP).items[0].settleHoldAt === dayAgo(0), '重设 settleHold = 续期,起算日归零')
    // 撤回:空理由不算 hold,那个日期也不该留着(留着下次挂账就带一个陈年起算日)
    runCli(fx.kb, ['card', 'set', 'BL-1', 'settleHold', ''])
    ok(rd(blP).items[0].settleHoldAt === undefined, '把 settleHold 清空的同时把起算日一起收走')
    const rBad = runCli(fx.kb, ['card', 'set', 'BL-1', 'settleHoldAt', '昨天'])
    ok(rBad.status === 1 && rd(blP).items[0].settleHoldAt === undefined, '手工写 settleHoldAt 也要过日期形制这道门', `${rBad.status} ${rBad.stderr.slice(0, 80)}`)
    ok(!/不认识的字段|unknown field/.test(runCli(fx.kb, ['card', 'set', 'BL-1', 'settleHoldAt', '2026-01-01']).stderr), 'settleHoldAt 是已知字段,手工回填不报「不认识」')
  }

  { // ---- 天数是日历日:换个有夏令时的时区跑一遍(本机时区没有切换,不换就看不出这一格)----
    const probe = join(WORK, 'daysbetween-probe.mjs')
    writeFileSync(probe, `import { daysBetween } from ${JSON.stringify(join(NEW_SCRIPTS, 'cards.mjs'))}\n` +
      `console.log(JSON.stringify([daysBetween('2026-03-01', '2026-03-15'), daysBetween('2026-10-25', '2026-11-08'), daysBetween('2026-09-01', '2026-09-01'), daysBetween('x', '2026-09-01')]))\n`)
    const r = spawnSync(process.execPath, [probe], { encoding: 'utf8', env: { ...process.env, TZ: 'America/Los_Angeles' } })
    ok(r.stdout.trim() === '[14,14,0,null]',
      'daysBetween 跨春/秋两次切换都是 14 天,同日是 0,坏日期是 NaN —— 两端折成 UTC 那一天再减,不受时区摆布',
      `${r.stdout.trim()}${r.stderr.slice(0, 200)}`)
  }

  { // ---- 守卫:13 天不出声,满 14 天出一行;芯片把起算日烤进 data-hold ----
    const fx = mkFixture('fx67b', { 's.html': demoHtml('s') })
    const kb = fx.kb, idxP = join(kb, 'index.html')
    const blP = join(kb, 'backlog-manifest.json'), relP = join(kb, 'release-manifest.json'), cfgP = join(kb, 'kanban.config.json')
    for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
      const x = rd(join(kb, f)); x.instance.ghRepo = 'o/r'; x.instance.branch = 'main'; wr(join(kb, f), x)
    }
    const bl = rd(blP)
    bl.tiers = { 1: '核心' }
    bl.items = [{ id: 'BL-H', status: 'ready', priority: 'high', tier: '1', title: '挂起的甲', problem: 'p', approach: 'a', area: 'x', source: 's', pr: 227, settleHold: '只落了一半', settleHoldAt: dayAgo(13) }]
    wr(blP, bl)
    wr(relP, REL_MANIFEST)
    const cfg = rd(cfgP); cfg.releaseTab = true; wr(cfgP, cfg)
    runGen(NEW_SCRIPTS, kb)
    const on = readFileSync(idxP, 'utf8')
    ok(on.includes(`data-hold="${dayAgo(13)}"`), '芯片把起算日烤进 data-hold(天数照旧在浏览器算,gen 零时间)', (on.match(/data-hold="[^"]*"/) || [''])[0])
    ok(on.includes('.rsp-hold.holdold {') && on.includes('function respHold()'), '有挂账卡时才注入那段琥珀 CSS 与算天数的 JS')
    { // ---- 把这两只运行期函数抠出来真跑一遍(只断言「在场」的话:类名改一个字母、少一行 hidden、
      //      floor 换 ceil,四个变异一个都不会红 —— 而它们是这两枚徽章的全部实现)----
      const holdCls = (on.match(/\.rsp-hold\.(\w+) \{/) || [])[1]
      const srcH = (on.match(/ {4}function respHold\(\) \{[\s\S]*?\n {4}\}/) || [''])[0]
      const srcD = (on.match(/ {4}function respDorm\(\) \{[\s\S]*?\n {4}\}/) || [''])[0]
      const srcDD = (on.match(/ {4}function dayDiff\(s\) \{[\s\S]*?\n {4}\}/) || [''])[0]
      ok(Boolean(holdCls) && srcH.includes('data-hold') && srcD.includes('data-dorm') && srcDD.includes('Date.UTC'),
        '抠得到样式表里那个类名与三只函数本体', `${holdCls} ${srcH.length}/${srcD.length}/${srcDD.length}`)
      const DAY = '2026-09-01'
      const mkEl = () => { const e = { textContent: '暂不收账', hidden: true, cls: [], getAttribute: () => DAY }; e.classList = { add: (c) => e.cls.push(c) }; return e }
      // 「现在」按本地日历推出来:与 DAY 之间正好差 days 个日历日,跟机器在哪个时区无关
      const run = (src, fn, sel, days) => {
        const el = mkEl()
        const doc = { querySelectorAll: (s) => (s.includes(sel) ? [el] : []) }
        const RealDate = Date
        const at = new RealDate(2026, 8, 1 + days, 3, 0, 0).getTime()
        const D = function () { return new RealDate(at) }
        D.UTC = RealDate.UTC; D.parse = RealDate.parse; D.now = () => at
        new Function('document', 'Date', `${srcDD}\n${src}\n; return ${fn}`)(doc, D)()
        return el
      }
      const h13 = run(srcH, 'respHold', 'rsp-hold', 13)
      ok(h13.textContent === '暂不收账' && h13.cls.length === 0, '挂满 13 天:字面不动、也不转琥珀', `${h13.textContent} ${h13.cls}`)
      const h14 = run(srcH, 'respHold', 'rsp-hold', 14)
      ok(h14.textContent === '暂不收账 · 已 14 天', '满 14 天:改字面,天数是整天数(floor,不四舍五入)', h14.textContent)
      ok(h14.cls.join(',') === holdCls, '加的类名与样式表里那条 .rsp-hold.X 是同一个 —— 改一处漏一处就是一条死规则', `${h14.cls} vs ${holdCls}`)
      ok(run(srcH, 'respHold', 'rsp-hold', 41).textContent === '暂不收账 · 已 41 天', '天数照实报')
      const d30 = run(srcD, 'respDorm', 'rspdorm', 30)
      ok(d30.hidden === true && d30.textContent === '暂不收账', '沉睡 30 天:还在窗口内,徽章不出(hidden 不动)')
      const d31 = run(srcD, 'respDorm', 'rspdorm', 31)
      ok(d31.hidden === false && d31.textContent === '沉睡 31 天', '超 30 天:显示出来并写清天数', `${d31.hidden} ${d31.textContent}`)

      // 跨夏令时:天数是日历日,不是 24h 的商。2026-03-08 那次春季切换让 03-01 → 03-15 只有
      // 14×24h − 1h,旧写法(本地午夜 + floor)在那一格给 13 —— 满 14 天的卡整整晚一天才转琥珀。
      const probe = join(WORK, 'dst-probe.mjs')
      writeFileSync(probe, `${srcDD}\n${srcH}\n` +
        `const el = { textContent: '暂不收账', cls: [], getAttribute: () => '2026-03-01', classList: { add(c) { el.cls.push(c) } } }\n` +
        `globalThis.document = { querySelectorAll: () => [el] }\n` +
        `const RealDate = Date\nconst at = new RealDate(2026, 2, 15, 0, 30).getTime()\n` +
        `const D = function () { return new RealDate(at) }\nD.UTC = RealDate.UTC; D.parse = RealDate.parse; D.now = () => at\n` +
        `globalThis.Date = D\nrespHold()\nconsole.log(el.textContent)\n`)
      const dst = spawnSync(process.execPath, [probe], { encoding: 'utf8', env: { ...process.env, TZ: 'America/Los_Angeles' } })
      ok(dst.stdout.trim() === '暂不收账 · 已 14 天',
        '跨夏令时那一格照旧是 14 天(TZ=America/Los_Angeles,03-01 → 03-15)', `${dst.stdout.trim()}${dst.stderr.slice(0, 200)}`)
    }
    touch(idxP)
    const g13 = runStop(NEW_SCRIPTS, fx.root)
    ok(!/暂不收账已/.test(g13.stdout), '13 天:守卫一个字都不说', g13.stdout.slice(0, 200))
    const bl14 = rd(blP); bl14.items[0].settleHoldAt = dayAgo(14); wr(blP, bl14)
    const g14 = runStop(NEW_SCRIPTS, fx.root)
    ok(/暂不收账最久已 14 天/.test(g14.stdout) && /BL-H/.test(g14.stdout), '满 14 天:一行,写清天数与卡号(天数说明白是最久那张的 —— 一句话安在几张卡头上就是假的)', (g14.stdout.match(/暂不收账[^"\\]*/) || [''])[0].slice(0, 160))
    ok(/重设|settleHold/.test(g14.stdout), '这一行顺带说清「续」与「收」各怎么做')
    ok(!/"decision":\s*"block"/.test(g14.stdout), '到期提醒永不阻断')
    // 提醒不解除静音:这张卡照旧不进待收账那条,也照旧不出「PR 已合 · 待收账」芯片
    ok(!/待收账\)?:.*BL-H/.test(g14.stdout), '到期了也还是 hold —— 待收账那条不点它')
    const after = readFileSync(blP, 'utf8')
    ok(JSON.parse(after).items[0].settleHoldAt === dayAgo(14), '守卫只读不写:卡上的字段一个都没被改')
    // 6 张一起过期:只点 5 个 + 总数
    const many = rd(blP)
    for (let i = 2; i <= 6; i++) many.items.push({ ...many.items[0], id: `BL-H${i}`, settleHoldAt: dayAgo(20 + i) })
    wr(blP, many)
    const gN = runStop(NEW_SCRIPTS, fx.root)
    ok(/…等 6 张/.test(gN.stdout) && (gN.stdout.match(/BL-H\d/g) || []).length === 5, '最多点名 5 张 + 总数(最久的排前面)', (gN.stdout.match(/暂不收账[^"\\]*/) || [''])[0].slice(0, 200))
    // 几张卡挂了不同的天数:句子里只有一个数(最久那张的),措辞得说清是谁的 —— 否则「已 41 天:
    // BL-H BL-H2 …」把最久那张的天数安在了每张卡头上,人会先去动其实没那么急的那几张。
    const lineN = (gN.stdout.match(/暂不收账[^"\\]*/) || [''])[0]
    ok(/最久已 26 天/.test(lineN) && /BL-H6/.test(lineN) && /BL-H2/.test(lineN),
      '一句话里只有一个天数:说明白它是最久那张的(BL-H6 挂了 26 天,同一行里的 BL-H2 只有 22 天)', lineN.slice(0, 200))
  }

  { // ---- 老卡(0.15.14 之前挂上的,没有 settleHoldAt):退到卡文件最后提交日 ----
    const fx = mkFixture('fx67c', { 's.html': demoHtml('s') })
    const kb = fx.kb, root = fx.root
    const blP = join(kb, 'backlog-manifest.json'), cfgP = join(kb, 'kanban.config.json')
    for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
      const x = rd(join(kb, f)); x.instance.ghRepo = 'o/r'; x.instance.branch = 'main'; wr(join(kb, f), x)
    }
    const bl = rd(blP); bl.tiers = { 1: '核心' }; delete bl.items; wr(blP, bl)
    const dec = rd(join(kb, 'decisions-manifest.json')); delete dec.entries; wr(join(kb, 'decisions-manifest.json'), dec)
    const cfg = rd(cfgP); cfg.cardsDir = 'cards'; cfg.releaseTab = true; wr(cfgP, cfg)
    mkdirSync(join(kb, 'cards', 'backlog'), { recursive: true })
    mkdirSync(join(kb, 'cards', 'decisions'), { recursive: true })
    wr(join(kb, 'cards', 'backlog', 'BL-OLD.json'), { id: 'BL-OLD', status: 'ready', priority: 'high', tier: '1', title: '老挂起', problem: 'p', approach: 'a', area: 'x', source: 's', pr: 227, settleHold: '0.15.14 之前挂上的' })
    wr(join(kb, 'release-manifest.json'), REL_MANIFEST)
    const g = (env, ...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } })
    g({}, 'config', 'user.email', 't@example.com'); g({}, 'config', 'user.name', 'T')
    g({}, 'add', '-A')
    const when = `${dayAgo(30)}T12:00:00`
    g({ GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when }, 'commit', '-qm', '30 天前挂上的')
    runGen(NEW_SCRIPTS, kb)
    ok(readFileSync(join(kb, 'index.html'), 'utf8').includes(`data-hold="${dayAgo(30)}"`),
      '没有 settleHoldAt 的老卡:起算日退到卡文件最后提交日(与 .udate 同源)', (readFileSync(join(kb, 'index.html'), 'utf8').match(/data-hold="[^"]*"/) || [''])[0])
    touch(join(kb, 'index.html'))
    const gs = runStop(NEW_SCRIPTS, root)
    ok(/暂不收账最久已 30 天/.test(gs.stdout) && /BL-OLD/.test(gs.stdout), '守卫读同一份卡文件日期,老卡照样催得动', (gs.stdout.match(/暂不收账[^"\\]*/) || [''])[0].slice(0, 160))
    ok(!readFileSync(join(kb, 'cards', 'backlog', 'BL-OLD.json'), 'utf8').includes('settleHoldAt'),
      '守卫不往卡上补写起算日(收工时改板会跟并行会话抢写)')
  }

  { // 拆分等价门:data-hold 与 .udate / data-dorm 同类 —— 拆卡之后才有的新事实,归一了再比
    const { stripCardUpdated } = await import(join(NEW_SCRIPTS, 'cards.mjs'))
    ok(stripCardUpdated('<span data-hold="2026-01-01">x</span>') === stripCardUpdated('<span data-hold="">x</span>'),
      'cards-split / cards-join 的逐字节等价门认得 data-hold(否则带挂账卡的板一拆就判「搬坏了」)')
  }
}

// ============ T68 行卡展开的那一下补量长文折叠(0.15.18)============
// 三类卡的正文都在 .rbody 里,收着时 display:none —— 卡是收着进 DOM 的,pane 级的那几趟
// clampScan 全部撞在 offsetParent === null 上,一个正文块都量不到。于是 .clamp 这套按高度折叠
// 自 rcard 形制落地以来对行卡是空转的:一张 1200 字单段的决策卡,展开就是满高十几行。
console.log('T68 行卡展开时补量折叠')
{
  const fx68 = mkFixture('fx68', { 's.html': demoHtml('s') })
  const cfgP = join(fx68.kb, 'kanban.config.json'), idxP = join(fx68.kb, 'index.html')
  const decP = join(fx68.kb, 'decisions-manifest.json')
  const cfg = JSON.parse(readFileSync(cfgP, 'utf8'))
  const dec = JSON.parse(readFileSync(decP, 'utf8'))
  const LONG1 = '问'.repeat(1200) // 1200 字、无空行 —— litePreview 切不动,只能靠高度折叠
  dec.entries = [{ id: 'D1', code: 'D1', status: Object.keys(dec.statuses)[0], date: '2026-01-01', title: 't',
    question: LONG1, decision: '就这么定', demoNote: '看 demo', source: '来'.repeat(223) }]
  writeFileSync(decP, JSON.stringify(dec))
  cfg.richText = true
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx68.kb)
  const on = readFileSync(idxP, 'utf8')

  ok(on.includes(`<dd class="x"><div class="lite"><p>${'问'.repeat(1200)}`),
    '1200 字单段的 question 烤成一整份(没有段落边界可切,预览路径不接手)')
  ok(on.includes("if (head) { const rc = head.parentElement; clampScan(rc.classList.toggle('open') ? rc : null); return }"),
    '点 .rhead 展开的那一下补量一趟(收起时传 null,clampScan 自己走人)')
  ok(on.includes("if (el.classList.contains('rcard')) { el.classList.add('open'); clampScan(el) }"),
    '深链自动展开的卡也补量')
  ok(on.includes("pane.querySelectorAll('.rcard').forEach((c) => c.classList.toggle('open', allOpen)); if (allOpen) clampScan(pane)"),
    '「展开全部」之后补量一趟(「收起全部」不必量:全都 display:none)')
  ok(on.includes("pane.querySelectorAll('dd.x, dd.decided, dd.demonote, div.notes, dd.lsrc')"),
    'richText 开着时 source 徽章(dd.lsrc)也进扫描名单')

  // ---- 把生成物里那只 clampScan 抠出来真跑一遍(手搭最小 DOM:只实现它用到的那几面)----
  const src = (on.match(/ {2}function clampScan\(pane\) \{[\s\S]*?\n {2}\}/) || [''])[0]
  ok(src.includes('scrollHeight') && src.includes('offsetParent'), '抠得到 clampScan 本体', src.slice(0, 60))
  // 顺带记下读/写的先后:量(offsetParent / lineHeight / scrollHeight)与写(data-cl / .clamp)
  // 一旦交替,浏览器每写一次就得为下一次读强制同步重排一整块 pane —— 这是 0.15.18 埋下的那笔。
  const io68 = []
  const mkEl = (sel, chars, o = {}) => ({
    sel, dataset: new Proxy({}, { set: (t, k, v) => { io68.push('write'); t[k] = v; return true } }), cls: new Set(),
    get offsetParent() { io68.push('read'); return o.hidden ? null : {} },
    querySelector: (s) => (o.full && s === '.lfull' ? {} : null),
    get scrollHeight() { io68.push('read'); return Math.ceil(chars / 40) * 21 }, // 40 字/行 × 21px 行高
    classList: { add(c) { io68.push('write'); this.own.cls.add(c) } },
  })
  const els = [mkEl('dd.x', 1200), mkEl('dd.decided', 40), mkEl('dd.lsrc', 223), mkEl('div.notes', 900, { full: true }), mkEl('dd.x', 1200, { hidden: true })]
  els.forEach((e) => { e.classList.own = e })
  const pane = { querySelectorAll: (sel) => els.filter((e) => sel.split(', ').includes(e.sel)) }
  const scan = new Function('getComputedStyle', src + '\n; return clampScan')((el) => { io68.push('read'); return { lineHeight: '21px' } })
  scan(pane)
  ok(io68.includes('write') && io68.lastIndexOf('read') < io68.indexOf('write'),
    '量完再写:一趟只读、一趟只写 —— 中间不夹写,浏览器就不必为每个元素强制重排一次整块 pane',
    io68.join(','))
  ok(els[0].cls.has('clamp'), '1200 字的 question:量到超 3.3 行 → 打 .clamp(点开有「展开 ▾」)')
  ok(!els[1].cls.has('clamp') && els[1].dataset.cl === '1', '40 字的结论:量过了,不折')
  ok(els[2].cls.has('clamp'), '223 字的 source 徽章同样收得住')
  ok(!els[3].cls.has('clamp') && els[3].dataset.cl === '1', '烤了预览/全文两份的字段照旧让路(不叠加)')
  ok(!els[4].cls.has('clamp') && els[4].dataset.cl === undefined,
    '还收着的卡(offsetParent === null)不打标 —— 展开后那一趟才量得到,这正是本次修的那个洞')
  scan(pane)
  ok(els[4].dataset.cl === undefined, '重复扫描不会把没量过的当量过')

  // ---- richText 关着:dd.lsrc 不进选择器(它本就不渲染),其余照旧 ----
  cfg.richText = false
  writeFileSync(cfgP, JSON.stringify(cfg))
  runGen(NEW_SCRIPTS, fx68.kb)
  const off = readFileSync(idxP, 'utf8')
  ok(off.includes("pane.querySelectorAll('dd.x, dd.decided, dd.demonote, p.notes')") && !off.includes('dd.lsrc'),
    'richText 关着:选择器里没有 dd.lsrc(那一行本就不渲染)')
  ok(off.includes("clampScan(rc.classList.toggle('open') ? rc : null)"),
    '补量这三处是核心行为,不随 richText 开关(关着的板同样收得住长正文)')
}

// ============ T69 卡片前置依赖 after(0.16.0:四种 ref / 两枚芯片 / WIP 口径 / 守卫一行 / CLI)============
// 「等 X 清掉才能动」以前只能写成散文,守卫核不动、WIP 照数不误。四种 ref 的清除判据都取自
// 已提交的事实(卡 status / PR mergedAt / 版本 at),所以 gen 照旧一个时钟都不读 —— 7 天窗口
// 只住在守卫里,用 localDate(本地日历,0.15.16 那条 UTC 坑的教训)。
console.log('T69 前置依赖 after')
{
  const D = await import(join(NEW_SCRIPTS, 'deps.mjs'))
  const { boardRepo, localDate, stripCardUpdated } = await import(join(NEW_SCRIPTS, 'cards.mjs'))
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const runCli = (kb, args) => spawnSync(process.execPath, [join(NEW_SCRIPTS, 'ddd.mjs'), ...args, '--dir', kb], { encoding: 'utf8' })
  const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d) }

  { // ---- ① ref 形制:三种写法靠语法分,不靠「板上查得到就算卡号」----
    const k = (s) => { const p = D.parseAfterRef(s); return p ? `${p.kind}:${p.ref}` : 'null' }
    ok(k('#266') === 'pr:#266' && k('266') === 'pr:#266', '#266 与 266 是同一个 PR(语法同 pr 字段)')
    ok(k('owner/repo#12') === 'pr:owner/repo#12', '跨仓 PR 认得')
    ok(k('v0.0.5') === 'tag:v0.0.5' && k('v9') === 'tag:v9', 'v 开头紧跟数字 = 版本 tag')
    ok(k('BL-C74') === 'card:BL-C74' && k('D89') === 'card:D89' && k('UXC34') === 'card:UXC34', '其余是卡号')
    ok(k('video-tab') === 'card:video-tab', 'v 后面不是数字的照旧是卡号(不抢 vXxx 这类卡号)')
    ok(k('') === 'null' && k('  ') === 'null' && k('BL C74') === 'null' && k('a/b') === 'null' && k('#0') === 'null',
      '空 / 带空白 / 带路径分隔符 / 0 号都不是合法 ref')
    ok(D.afterOf({ after: ['BL-1', 'BL-1', ' BL-2 ', '', null] }).join(',') === 'BL-1,BL-2', 'afterOf 去重去空、保留书写顺序')
    ok(D.afterOf({ after: ['266', '#266', 'v1.0', 'v1.0'] }).join(',') === '266,v1.0',
      '去重按归一键:266 与 #266 是同一个 PR,按原文比会各占一项,芯片就会说「等 2 项」而其实只有一个')
    ok(D.afterKey('266') === '#266' && D.afterKey('#266') === '#266' && D.afterKey('BL-1') === 'BL-1', '归一键就是 parseAfterRef 的 ref')
    ok(D.afterOf({ after: 'BL-1' }).length === 0 && D.afterOf({}).length === 0, '不是数组 = 没写(硬报错在 gen 那道门)')
  }

  { // ---- ② 四种 ref 的清除判据各一(纯函数,固定日期)----
    const ctx = {
      repo: 'o/r',
      cardById: new Map([
        ['BL-1', { id: 'BL-1', status: 'done', date: '2026-08-01', note: '【2026-08-05】开工\n\n【2026-09-02】status → done' }],
        ['BL-2', { id: 'BL-2', status: 'ready' }],
        ['D1', { id: 'D1', status: 'live' }], ['D2', { id: 'D2', status: 'closed', date: '2026-07-07' }], ['D3', { id: 'D3', status: 'draft' }],
      ]),
      relPr: new Map([
        [227, { number: 227, state: 'merged', mergedAt: '2026-08-19T01:00:00Z' }],
        [230, { number: 230, state: 'open', mergedAt: null }],
        [225, { number: 225, state: 'closed', mergedAt: null }],
      ]),
      relTag: new Map([['v0.0.1', '2026-08-20T09:00:00Z']]),
    }
    const r = (s) => D.resolveAfter(s, ctx)
    ok(r('BL-1').cleared && r('BL-1').at === '2026-09-02', 'backlog 卡 done = 已清,清除日 = 时间线里那条终态转移的日期')
    ok(r('D2').at === '2026-07-07', '没有时间线的卡(决策卡就没有这个字段)退到卡上的 date')
    ok(r('D1').at === '', 'date 也没有 → 空串:不知道就不说,不硬编一个假日期')
    ok(!r('BL-2').cleared, 'backlog 卡 ready = 没清')
    ok(r('D1').cleared && r('D2').cleared && !r('D3').cleared, '决策卡 live / closed = 已清,其余没清(TERMINAL 一个并集就够)')
    ok(r('#227').cleared && r('#227').at === '2026-08-19', 'PR 合了 = 已清,清除日 = mergedAt')
    ok(!r('#230').cleared && !r('#225').cleared, '开着的与关掉未合的 PR 都没清')
    ok(r('v0.0.1').cleared && r('v0.0.1').at === '2026-08-20', '版本 tag 在 releases[] 里 = 已发,清除日 = 打 tag 时刻')
    ok(!r('v9.9.9').cleared && !r('v9.9.9').unknown, '还没发的版本是「没清」,不是错')
    ok(!r('#999').cleared && !r('#999').unknown, '没同步过的 PR 号同上 —— 它本来就是「还没发生」')
    // 号要用 fixture 里真有的那个,判据才压在「仓」上:拿一个板上根本没有的号,走不走跨仓分支都是没清
    ok(r('#227').cleared && !r('other/repo#227').cleared,
      '同一个号:本仓的算清了,跨仓的保守算没清 —— 判据是仓不是号(号在两仓之间撞车很常见)')
    ok(r('o/r#227').cleared, '显式写本仓 owner/repo#N 与 #N 等价')
    ok(r('BL-404').unknown === true, '板上没有的卡号:标出来给上层硬报错')
    ok(D.depItemText(r('BL-1')) === '✓ BL-1 已收 09-02' && D.depItemText(r('#230')) === '#230 开着'  // 09-02 = 那条终态转移
      && D.depItemText(r('v9.9.9')) === 'v9.9.9 未发', '逐项长形照定稿 §2.1 那三个样子')
    ok(D.depItemShort(r('#227')) === '#227 已合', '守卫那行的短形不带勾也不带日期')
    const mixed = [r('BL-1'), r('#227'), r('v0.0.1')]
    ok(D.openCount(mixed) === 0 && D.clearedAt(mixed) === '2026-09-02', '全清:清除日取各项里最大的那个')
    ok(D.clearedAt([r('BL-2'), r('#227')]) === '2026-08-19' && D.openCount([r('BL-2'), r('#227')]) === 1, '部分清:只数没清的')
    ok(D.clearedAt([r('D1')]) === '', '取不到日期时是空串,不硬编一个假日期')
    // 收到终态那天:三条取值链 + 「最后一条为准」
    const tAt = D.terminalAt
    ok(tAt({ status: 'done', note: '【2026-09-01】status → wip\n\n【2026-09-03】status → done' }) === '2026-09-03',
      '认 ddd card status 写的那行')
    ok(tAt({ notes: '【2026-09-04 收账】PR#266 已合(自动)' }) === '2026-09-04', '也认 pr-sync --settle 写的那行')
    ok(tAt({ note: '【2026-09-01】status → done\n\n【2026-09-02】status → ready\n\n【2026-09-05】status → done' }) === '2026-09-05',
      '重开又收的卡按最近那次算(取最后一条,不是第一条)')
    ok(tAt({ note: '【2026-09-01】status → ready', date: '2026-08-08' }) === '2026-08-08',
      '时间线里只有非终态的转移 → 退到 date(不拿一个「变成 ready 那天」冒充清除日)')
    ok(tAt({ note: '随手记了两句,没有时间戳', date: '2026-08-08' }) === '2026-08-08', '没有时间线格式的正文不误判')
    ok(tAt({ date: 'yesterday' }) === '' && tAt({}) === '', 'date 不是日期形制 / 什么都没有 → 空串')
    ok(tAt({ status: 'done', note: '【2026-09-03】status → done' }) === tAt({ status: 'done', note: '【2026-09-03】status → done' }),
      '同一张卡拆不拆都是同一个值 —— 清除日不再随「卡文件最后改动日」跑')
  }

  { // ---- ③ 未知卡号 / 自指 / 环(纯函数;gen 与 CLI 共用这一份)----
    const A = (cards) => D.auditAfter(cards)
    ok(A([{ id: 'a', after: ['zz'] }]).unknown[0].ref === 'zz', '未知卡号点得出是哪张卡的哪一条')
    ok(A([{ id: 'a', after: ['#9', 'v1.0'] }]).unknown.length === 0, 'PR / 版本从不算「未知」')
    ok(A([{ id: 'a', after: ['a'] }]).cycle.join('→') === 'a→a', '自指就是长度 1 的环')
    ok(A([{ id: 'a', after: ['b'] }, { id: 'b', after: ['a'] }]).cycle.join('→') === 'a→b→a', '两张卡互等')
    ok(A([{ id: 'a', after: ['b'] }, { id: 'b', after: ['c'] }, { id: 'c', after: ['a'] }]).cycle.join('→') === 'a→b→c→a', '三张卡绕一圈')
    ok(A([{ id: 'a', after: ['b'] }, { id: 'b', after: ['c'] }, { id: 'c', after: [] }]).cycle === null, '链不是环')
    ok(A([{ id: 'a', after: ['c'] }, { id: 'b', after: ['c'] }, { id: 'c', after: [] }]).cycle === null, '两张卡等同一张也不是环')
    const rev = D.reverseAfter([{ id: 'a', after: ['c'] }, { id: 'b', after: ['c', 'c'] }, { id: 'c', after: [] }])
    ok(rev.get('c').join(',') === 'a,b' && !rev.has('a'), '反查按卡序、去重;没人指的卡不进表')
  }

  // ---- ④ 渲染:两枚芯片 / data-after-open / WIP 口径 / 字段驱动零差异 ----
  const fx = mkFixture('fx69', { 's.html': demoHtml('s') })
  const kb = fx.kb, idxP = join(kb, 'index.html')
  const blP = join(kb, 'backlog-manifest.json'), cfgP = join(kb, 'kanban.config.json')
  for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
    const x = rd(join(kb, f)); x.instance.ghRepo = 'o/r'; x.instance.branch = 'main'; wr(join(kb, f), x)
  }
  const base = { priority: 'high', tier: '1', area: 'x', source: 's', problem: 'p', approach: 'a' }
  const mkItems = (extra = {}) => [
    { id: 'BL-1', status: 'ready', date: '2026-09-01', title: '等三样', ...base, ...(extra['BL-1'] || {}) },
    { id: 'BL-2', status: 'ready', date: '2026-09-02', title: '全清了', ...base, ...(extra['BL-2'] || {}) },
    { id: 'BL-3', status: 'ready', date: '2026-09-03', title: '没前置', ...base },
    { id: 'BL-4', status: 'ready', date: '2026-09-04', title: '被依赖的', ...base },
    { id: 'BL-5', status: 'done', date: '2026-08-01', title: '已收的', ...base },
  ]
  const bl0 = rd(blP); bl0.tiers = { 1: '核心' }; bl0.items = mkItems(); wr(blP, bl0)
  const dec0 = rd(join(kb, 'decisions-manifest.json')); dec0.entries = []; wr(join(kb, 'decisions-manifest.json'), dec0)
  wr(join(kb, 'release-manifest.json'), REL_MANIFEST)
  const cfg0 = rd(cfgP); cfg0.releaseTab = true; cfg0.wip = { soft: 2, hard: 9 }; wr(cfgP, cfg0)
  runGen(NEW_SCRIPTS, kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('depchip') && !off.includes('data-after-open') && off.includes('可做的卡 4 张 · 已超 2'),
    '板上一条 after 都没有:一枚芯片都没有,横幅照旧「可做的卡 N 张」')

  const withAfter = rd(blP)
  withAfter.items = mkItems({
    'BL-1': { after: ['BL-5', '#230', 'v9.9.9'] },   // 一清两没清
    'BL-2': { after: ['BL-5', '#227', 'v0.0.1'] },   // 三样全清
  })
  for (const id of ['BL-6', 'BL-7', 'BL-8', 'BL-9']) withAfter.items.push({ id, status: 'ready', date: '2026-09-05', title: '等 BL-4', ...base, after: ['BL-4'] })
  wr(blP, withAfter)
  const rGen = runGen(NEW_SCRIPTS, kb)
  const on = readFileSync(idxP, 'utf8')
  ok(rGen.status === 0, 'gen 跑得过', rGen.stderr.slice(0, 200))
  ok(on.includes('<span class="depchip dep-wait" title="✓ BL-5 已收 08-01 · #230 开着 · v9.9.9 未发">等 2 项</span>'),
    '未全清:灰芯片「等 N 项」数的是还没清的,逐项状态挂 title')
  ok(on.includes('<span class="depchip dep-clear" title="✓ BL-5 已收 08-01 · ✓ #227 已合 08-19 · ✓ v0.0.1 已发 08-20">前置已清 · 08-20</span>'),
    '全清:安静芯片「前置已清 · MM-DD」,日期取各项清除日的最大值')
  ok(on.includes('<span class="depchip dep-unlock" title="这些卡的前置里有它:BL-6 · BL-7 · BL-8 · BL-9">被 <a href="#BL-6">BL-6</a> · <a href="#BL-7">BL-7</a> · <a href="#BL-8">BL-8</a><i class="depmore">+1</i> 等着</span>'),
    '反向芯片:陈述「谁的前置里有它」,面上最多 3 个 + 折一枚 +N,title 列全,每个号点得动')
  ok(!/解锁/.test(on), '不说「清掉这张卡就解锁 X」—— 对方往往还等着别的,那是句常常不成立的承诺')
  ok(count(on, 'class="depchip dep-unlock"') === 1, '被指的 BL-5 已 done(终态)—— 终态卡不出反向芯片')
  ok(count(on, 'data-after-open="1"') === 5, '烤入 data-after-open 的正是那 5 张还等着前置的 ready 卡', String(count(on, 'data-after-open="1"')))
  ok(!/id="BL-2"[^>]*data-after-open/.test(on), '全清的卡不带 data-after-open(它今天动得了手)')
  ok(on.includes('可立即做 3(另 5 等前置) · 已超 2'),
    '横幅改口:「可立即做 N(另 M 等前置)」,软硬阈按可立即做那个数算')
  ok(on.includes(".bl-ready[data-after-open]") && on.includes("'可立即做 ' + wipN + wipAll"),
    'setLine 的运行期重算数得到 data-after-open,并用同一套措辞(头词与量词是 gen 期常量,一句话只留一处)')
  ok(on.includes('.depchip {') && on.includes('.dep-unlock a {'), '有 after 的板才注入那段 CSS')
  ok(!on.includes('#7c3aed') || off.includes('#7c3aed'), '不引新色(芯片只用既有令牌)')
  { // 运行期重算的算术:把那段抠出来真跑一遍(与烤入的文案对齐)
    const lines = on.split('\n')
    const at = lines.findIndex((l) => l.includes("const wipPane = document.getElementById('pane-backlog')"))
    ok(at > 0 && lines[at + 2].includes(".bl-ready[data-after-open]"), '抠得到那段重算')
    const src = lines.slice(at, at + 23).join('\n')
    const run = (vis, wait) => {
      const el = { hidden: false, classList: { toggle() {} }, textContent: '' }
      const doc = { getElementById: (id) => (id === 'pane-backlog' ? { dataset: {} } : id === 'wipbar' ? el : null), querySelector: () => null }
      new Function('document', 'nVis', src)(doc, (root, sel) => (sel.includes('data-after-open') ? wait : vis))
      return el.textContent
    }
    ok(run(8, 5) === '可立即做 3(另 5 等前置) · 已超 2', '无筛选:重算与烤入的一字不差', run(8, 5))
    ok(run(7, 3) === '可立即做 4(全板 3 · 另 3 等前置) · 已超 2', '筛掉一部分:全板数与等前置数并排在同一个括号里', run(7, 3))
    ok(run(8, 0) === '可立即做 8(全板 3) · 已超 2', '当前筛选下没有等前置的卡:括号里不提它', run(8, 0))
  }

  { // 门是「终态」不是「ready」:deferred 只是搁置,前置清没清仍是它身上的事实;done 之后两枚都收声
    const x = rd(blP)
    x.items.find((i) => i.id === 'BL-2').status = 'deferred'
    x.items.find((i) => i.id === 'BL-1').status = 'deferred'
    wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
    const hDef = readFileSync(idxP, 'utf8')
    ok(hDef.includes('class="depchip dep-clear"') && hDef.includes('等 2 项'),
      'deferred(非终态):两枚芯片照旧 —— 它们说的是事实,不是催促')

    x.items.find((i) => i.id === 'BL-2').status = 'done'
    x.items.find((i) => i.id === 'BL-1').status = 'done'
    wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
    const hDone = readFileSync(idxP, 'utf8')
    ok(!hDone.includes('class="depchip dep-clear"'), '收到终态:「前置已清」是句废话,不再渲染')
    ok(!hDone.includes('等 2 项'), '收到终态:「等 N 项」读起来像出错了,同样不再渲染')

    x.items.find((i) => i.id === 'BL-2').status = 'ready'
    x.items.find((i) => i.id === 'BL-1').status = 'ready'
    wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
  }

  { // 总览「可做」那行:面上的字与口径一致(数的是可立即做,不是 ready 张数)
    const cfgOv = rd(cfgP); cfgOv.overviewTab = true; wr(cfgP, cfgOv)
    runGen(NEW_SCRIPTS, kb)
    const hOv = readFileSync(idxP, 'utf8')
    ok(hOv.includes('<span id="ovreadyn">3</span></b> 张可立即做<span id="ovreadyw">(另 5 张等前置)</span>'),
      '总览:「3 张可立即做(另 5 张等前置)」—— 与横幅同一个数、同一句交代,不再写「N 张 ready」',
      (hOv.match(/ovreadyn[\s\S]{0,90}/) || [''])[0])
    ok(hOv.includes("const ovWEl = document.getElementById('ovreadyw')"), '随线别/筛选重算时括号那半句也跟着改')

    const xOv = rd(blP); xOv.items = mkItems(); wr(blP, xOv)
    runGen(NEW_SCRIPTS, kb)
    ok(/<span id="ovreadyn">4<\/span><\/b> 张 ready/.test(readFileSync(idxP, 'utf8')),
      '板上一条 after 都没有:仍是「N 张 ready」,逐字节冻结')
    wr(blP, withAfter)
    cfgOv.overviewTab = false; wr(cfgP, cfgOv)
    runGen(NEW_SCRIPTS, kb)
  }

  { // 反向名单只列还没终态的那几张:做完的卡不该出现在「谁在等它」里
    const x = rd(blP)
    for (const id of ['BL-6', 'BL-7']) x.items.find((i) => i.id === id).status = 'done'
    wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
    const h = readFileSync(idxP, 'utf8')
    ok(/dep-unlock" title="这些卡的前置里有它:BL-8 · BL-9">被 <a href="#BL-8">BL-8<\/a> · <a href="#BL-9">BL-9<\/a> 等着/.test(h),
      '两张依赖卡收掉之后:名单只剩没终态的两张,面上正好列得下,不长 +N', (h.match(/dep-unlock[^<]*<[^>]*>[^<]*/) || [''])[0])
    for (const id of ['BL-6', 'BL-7', 'BL-8'] ) x.items.find((i) => i.id === id).status = 'done'
    wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
    const h2 = readFileSync(idxP, 'utf8')
    ok(/dep-unlock" title="这些卡的前置里有它:BL-9">被 <a href="#BL-9">BL-9<\/a> 等着/.test(h2) && !/<i class="depmore"/.test(h2),
      '只剩一张:面上就一个号')
    for (const id of ['BL-6', 'BL-7', 'BL-8', 'BL-9']) x.items.find((i) => i.id === id).status = 'done'
    wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
    ok(!readFileSync(idxP, 'utf8').includes('class="depchip dep-unlock"'),
      '等它的卡全收完了:整枚芯片不出 —— 而不是留一枚「被(已经做完的那几张)等着」')
    wr(blP, withAfter)
    runGen(NEW_SCRIPTS, kb)
  }

  { // 正好 DEPS_UNLOCK_SHOW 张:三个号全列在面上,不长一枚写着 +0 的折叠标
    const x = rd(blP)
    x.items = x.items.filter((i) => i.id !== 'BL-9')
    wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
    const h = readFileSync(idxP, 'utf8')
    ok(/被 <a href="#BL-6">BL-6<\/a> · <a href="#BL-7">BL-7<\/a> · <a href="#BL-8">BL-8<\/a> 等着/.test(h) && !/<i class="depmore"/.test(h),
      '正好 3 张:全列在面上,不长 +N(> 写成 >= 就会出「+0」)')
    wr(blP, withAfter)
    runGen(NEW_SCRIPTS, kb)
  }

  { // 撤掉全部 after → 回到冻结基线(字段驱动,不加 config 键)
    const x = rd(blP); x.items = mkItems(); wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
    ok(sha(idxP) === offSha, '撤掉所有 after 后与未写 after 的基线逐字节相同')
    wr(blP, withAfter)
    runGen(NEW_SCRIPTS, kb)
  }

  { // ---- ⑤ gen 硬报错三种 ----
    const x = rd(blP)
    const bad = (mut) => { const y = rd(blP); mut(y); wr(blP, y); const r = runGen(NEW_SCRIPTS, kb); wr(blP, x); return r }
    const r1 = bad((y) => { y.items[2].after = ['BL-404'] })
    ok(r1.status !== 0 && /BL-404/.test(r1.stderr) && /BL-3/.test(r1.stderr), '未知卡号:硬报错并点名是哪张卡的哪一条', r1.stderr.slice(0, 160))
    const r2 = bad((y) => { y.items[2].after = ['BL-3'] })
    ok(r2.status !== 0 && /BL-3 → BL-3/.test(r2.stderr), '自指:硬报错并把环画出来', r2.stderr.slice(0, 160))
    const r3 = bad((y) => { y.items[2].after = ['BL-4']; y.items[3].after = ['BL-3'] })
    ok(r3.status !== 0 && /BL-3 → BL-4 → BL-3/.test(r3.stderr), '两张卡互等:点名环上的卡', r3.stderr.slice(0, 160))
    const r4 = bad((y) => { y.items[2].after = 'BL-4' })
    ok(r4.status !== 0 && /不是数组|not an array/.test(r4.stderr), 'after 不是数组也硬报错(悄悄当没写会骗人)', r4.stderr.slice(0, 160))
    runGen(NEW_SCRIPTS, kb)
  }

  { // ---- ⑥ 守卫:7 天窗口(固定日期)、只报仍 ready 的、最多 5 张、最近清的先、永不阻断 ----
    const rel = JSON.parse(JSON.stringify(REL_MANIFEST))
    const mergedOn = (n) => `${dayAgo(n)}T01:00:00Z`
    rel.prs.find((p) => p.number === 227).mergedAt = mergedOn(7)
    rel.prs.find((p) => p.number === 226).mergedAt = mergedOn(1)
    rel.releases[0].at = `${dayAgo(30)}T09:00:00Z`
    wr(join(kb, 'release-manifest.json'), rel)
    const x = rd(blP)
    x.items = mkItems()
    x.items.push({ id: 'BL-A', status: 'ready', date: '2026-09-01', title: '刚清 7 天', ...base, after: ['#227'] })
    x.items.push({ id: 'BL-B', status: 'ready', date: '2026-09-01', title: '昨天清的', ...base, after: ['#226'] })
    x.items.push({ id: 'BL-C', status: 'ready', date: '2026-09-01', title: '30 天前发的版', ...base, after: ['v0.0.1'] })
    x.items.push({ id: 'BL-D', status: 'done', date: '2026-09-01', title: '清了但卡已收', ...base, after: ['#226'] })
    x.items.push({ id: 'BL-E', status: 'ready', date: '2026-09-01', title: '还等着', ...base, after: ['#230'] })
    rel.prs.find((p) => p.number === 232).state = 'merged'
    rel.prs.find((p) => p.number === 232).mergedAt = mergedOn(8) // 天数写死:跟着 DEPS_FRESH_DAYS 算的话,改常数会把用例一起搬走
    wr(join(kb, 'release-manifest.json'), rel)
    x.items.push({ id: 'BL-F', status: 'ready', date: '2026-09-01', title: '刚过窗口一天', ...base, after: ['#232'] })
    wr(blP, x)
    runGen(NEW_SCRIPTS, kb)
    touch(idxP)
    const g = runStop(NEW_SCRIPTS, fx.root)
    const line = (g.stdout.match(/前置已清:[^"\\]*/) || [''])[0]
    ok(g.status === 0 && !/"decision":\s*"block"/.test(g.stdout), '这条通知永不阻断收工')
    ok(/BL-B/.test(line) && /BL-A/.test(line), '7 天内清掉的卡都点到(边界那天算在内)', line)
    ok(line.indexOf('BL-B') < line.indexOf('BL-A'), '最近清的排前面')
    ok(!/BL-C/.test(line), '30 天前清的:过了 7 天窗口,不再说')
    ok(!/BL-F/.test(line), '刚过窗口一天(8 天)就不说了 —— 这条线两侧都钉住,不然窗口悄悄放宽没人知道', line)
    ok(!/BL-D/.test(line), '卡已经收了(不再 ready)的不点 —— 它不需要「可以开工了」')
    ok(!/BL-E/.test(line), '还等着前置的当然不点')
    ok(/BL-B\(#226 已合\)/.test(line), '括号里逐项列清掉的是什么', line)
    // 六张一起解锁:只点 5 个 + 总数
    const many = rd(blP)
    for (let i = 1; i <= 5; i++) many.items.push({ id: `BL-M${i}`, status: 'ready', date: '2026-09-01', title: `批量 ${i}`, ...base, after: ['#226'] })
    wr(blP, many)
    runGen(NEW_SCRIPTS, kb)
    touch(idxP)
    const gN = runStop(NEW_SCRIPTS, fx.root)
    const lineN = (gN.stdout.match(/前置已清:[^"\\]*/) || [''])[0]
    ok(/…等 7 张/.test(lineN) && (lineN.match(/BL-[MAB]/g) || []).length === 5, '最多点名 5 张 + 总数', lineN)
    // 积压那条也换了口径:等前置的不占额度
    const wipCfg = rd(cfgP); wipCfg.wip = { soft: 1, hard: 2 }; wr(cfgP, wipCfg)
    runGen(NEW_SCRIPTS, kb)
    touch(idxP)
    const gW = runStop(NEW_SCRIPTS, fx.root)
    ok(/可立即做\(ready 且前置已清\)的卡有 \d+ 张,另有 1 张 ready 还等着前置/.test(gW.stdout),
      '守卫的积压那条同一口径:等前置的另计,不顶阈值', (gW.stdout.match(/可立即做[^,]*,[^,]*/) || [''])[0])
    wipCfg.wip = { soft: 2, hard: 9 }; wr(cfgP, wipCfg)
    wr(blP, withAfter)
    wr(join(kb, 'release-manifest.json'), REL_MANIFEST)
    runGen(NEW_SCRIPTS, kb)
  }

  { // ---- ⑦ CLI:追加去重 / --rm / --json 覆盖 / 三种拒绝 / card show 的「前置」行 ----
    const fx2 = mkFixture('fx69cli', { 's.html': demoHtml('s') })
    const kb2 = fx2.kb, bl2 = join(kb2, 'backlog-manifest.json')
    for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
      const y = rd(join(kb2, f)); y.instance.ghRepo = 'o/r'; wr(join(kb2, f), y)
    }
    const y = rd(bl2); y.tiers = { 1: '核心' }
    y.items = [
      { id: 'BL-1', status: 'ready', title: '甲', ...base },
      { id: 'BL-2', status: 'done', title: '乙', ...base },
      { id: 'BL-3', status: 'ready', title: '丙', ...base },
    ]
    wr(bl2, y)
    wr(join(kb2, 'release-manifest.json'), REL_MANIFEST)
    const afterOfCard = (id) => (rd(bl2).items.find((i) => i.id === id).after || [])

    const a1 = runCli(kb2, ['card', 'after', 'BL-1', 'BL-2', '#230'])
    ok(a1.status === 0 && afterOfCard('BL-1').join(',') === 'BL-2,#230', 'card after 追加,顺序即书写顺序', a1.stderr)
    // 同一个号的两种写法是同一项:按原文比会各占一项,卡头就会说「等 2 项」而其实只有一个 PR
    const a1b = runCli(kb2, ['card', 'after', 'BL-1', '230'])
    ok(a1b.status === 0 && afterOfCard('BL-1').join(',') === 'BL-2,#230', '换个写法追加同一个号:一个字节都不加', afterOfCard('BL-1').join(','))
    const a1c = runCli(kb2, ['card', 'after', 'BL-1', '--rm', '230'])
    ok(a1c.status === 0 && afterOfCard('BL-1').join(',') === 'BL-2', '--rm 也按归一键找:写 230 删得掉 #230')
    runCli(kb2, ['card', 'after', 'BL-1', '#230'])
    const a2 = runCli(kb2, ['card', 'after', 'BL-1', 'BL-2', 'v0.0.1'])
    ok(a2.status === 0 && afterOfCard('BL-1').join(',') === 'BL-2,#230,v0.0.1', '再追加:已有的去重,新的落到末尾')
    ok(Object.keys(rd(bl2).items.find((i) => i.id === 'BL-1')).join(',').includes('source,after,problem'),
      'after 插在扁平档末尾 —— 第一个长文字段之前(normalizeCard 按 band 插,不按 K_FLAT 的邻居)',
      Object.keys(rd(bl2).items.find((i) => i.id === 'BL-1')).join(','))
    const a3 = runCli(kb2, ['card', 'after', 'BL-1', '--rm', '#230'])
    ok(a3.status === 0 && afterOfCard('BL-1').join(',') === 'BL-2,v0.0.1', '--rm 只去掉那一项')
    const a4 = runCli(kb2, ['card', 'after', 'BL-1', '--rm', '#999'])
    ok(a4.status === 1 && afterOfCard('BL-1').join(',') === 'BL-2,v0.0.1', '--rm 一个不在的项:拒绝,一个字节都不写', a4.stderr.slice(0, 80))
    const a5 = runCli(kb2, ['card', 'set', 'BL-1', 'after', '--json', '["#227"]'])
    ok(a5.status === 0 && afterOfCard('BL-1').join(',') === '#227', 'card set … after --json 整体覆盖')
    const a6 = runCli(kb2, ['card', 'set', 'BL-1', 'after', 'BL-2'])
    ok(a6.status === 1 && /数组|array/.test(a6.stderr), '不给 --json 的标量值被形制那道门挡下')
    const a7 = runCli(kb2, ['card', 'after', 'BL-1', 'BL-404'])
    ok(a7.status === 1 && /BL-404/.test(a7.stderr) && afterOfCard('BL-1').join(',') === '#227', '未知卡号:CLI 拒写')
    const a8 = runCli(kb2, ['card', 'after', 'BL-1', 'BL-1'])
    ok(a8.status === 1 && /自己|itself|its own/.test(a8.stderr), '自指:CLI 拒写')
    runCli(kb2, ['card', 'after', 'BL-3', 'BL-1'])
    const a9 = runCli(kb2, ['card', 'after', 'BL-1', 'BL-3'])
    ok(a9.status === 1 && /BL-1 → BL-3 → BL-1|BL-3 → BL-1 → BL-3/.test(a9.stderr) && afterOfCard('BL-1').join(',') === '#227',
      '成环:CLI 拒写并把环画出来', a9.stderr.slice(0, 120))
    const a10 = runCli(kb2, ['card', 'after', 'BL-1', 'BL C4'])
    ok(a10.status === 1 && /形制|not a valid ref/.test(a10.stderr), '形制不合法的 ref 也拒')
    const a11 = runCli(kb2, ['card', 'after', 'BL-1', '--rm', '#227', 'BL-2'])
    ok(a11.status === 1, '--rm 后面再跟 ref:拒(一次只移除一项)')
    runCli(kb2, ['card', 'set', 'BL-1', 'after', '--json', '["BL-2","#230","v0.0.1"]'])
    const show = runCli(kb2, ['card', 'show', 'BL-1'])
    ok(show.status === 0 && /after\(前置\): ✓ BL-2 已收 · #230 开着 · ✓ v0\.0\.1 已发/.test(show.stdout),
      'card show 多一行「after(前置)」,逐项带当前状态(与 gen 同一份函数)', (show.stdout.match(/after\(前置\).*/) || [''])[0])
    { // 这一行紧跟在 after 字段本身后面:中间隔着长正文的话,「关联的放一起」就断了
      const lines = show.stdout.split('\n')
      const at = lines.findIndex((l) => /^  after: /.test(l))
      ok(at > 0 && /^  after\(前置\): /.test(lines[at + 1] || ''), '解析行紧贴着字段本身那一行', lines.slice(at, at + 2).join(' | '))
    }
    ok(runCli(kb2, ['card', 'show', 'BL-3']).stdout.includes('after(前置): BL-1 未收'), '指向还没收的卡:说「未收」')
    ok(!/不认识的字段|unknown field/.test(runCli(kb2, ['card', 'set', 'BL-2', 'after', '--json', '[]']).stderr), 'after 是已知字段')
    ok(/card after/.test(runCli(kb2, ['--help']).stdout), '--help 里有它')
  }

  { // ---- ⑧b 三处同一个「板上有哪些卡」:进度卡也是合法前置,CLI 不该拒写 gen 照渲的东西 ----
    const fx3 = mkFixture('fx69uni', { 's.html': demoHtml('s') })
    const kb3 = fx3.kb
    const mP = join(kb3, 'manifest.json'), bl3 = join(kb3, 'backlog-manifest.json')
    for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
      const z = rd(join(kb3, f)); z.instance.ghRepo = 'o/r'; wr(join(kb3, f), z)
    }
    const mm = rd(mP)
    mm.iterations = [{ id: 'I1', title: '迭代甲', detail: '' }]
    mm.tasks = [
      { id: 'T1', iteration: 'I1', status: 'done', title: '做完的进度卡', approach: 'a' },
      { id: 'T2', iteration: 'I1', status: 'active', title: '在做的进度卡', approach: 'a' },
    ]
    wr(mP, mm)
    const b3 = rd(bl3); b3.tiers = { 1: '核心' }
    b3.items = [
      { id: 'BL-1', status: 'ready', date: '2026-09-01', title: '甲', ...base },
      { id: 'BL-2', status: 'ready', date: '2026-09-01', title: '乙', ...base, after: ['T2'] },
    ]
    wr(bl3, b3)
    const dec3 = rd(join(kb3, 'decisions-manifest.json')); dec3.entries = []; wr(join(kb3, 'decisions-manifest.json'), dec3)

    const t1 = runCli(kb3, ['card', 'after', 'BL-1', 'T1'])
    ok(t1.status === 0, '进度卡当前置:CLI 写得进去(0.16.0 会说「板上没有卡号 T1」,而 gen 一直认它)', t1.stderr.slice(0, 160))
    const rg3 = runGen(NEW_SCRIPTS, kb3)
    const h3 = rg3.status === 0 ? readFileSync(join(kb3, 'index.html'), 'utf8') : ''
    ok(rg3.status === 0 && /id="BL-1"[\s\S]{0,600}?depchip dep-clear/.test(h3),
      '同一条 after,gen 渲染成「前置已清」—— CLI 放过去的 gen 也放得过去', rg3.stderr.slice(0, 160))
    ok(/id="T2"[\s\S]{0,900}?depchip dep-unlock/.test(h3), '进度卡也长反向芯片(BL-2 在等 T2)')
    ok(count(h3, 'depchip dep-unlock') === 1 && /dep-unlock" title="[^"]*BL-2/.test(h3),
      '全板只有 T2 那一枚反向芯片 —— 已终态的 T1 被 BL-1 指着也不出', String(count(h3, 'depchip dep-unlock')))
    ok(runCli(kb3, ['card', 'show', 'BL-1']).stdout.includes('after(前置): ✓ T1 已收'), 'card show 也解析得出进度卡的状态')
    ok(runCli(kb3, ['card', 'after', 'BL-1', '--rm', 'T1']).status === 0, '写得进去也删得掉(整条 after 会被重校验一遍)')
    ok(runCli(kb3, ['card', 'after', 'BL-1', 'T404']).status === 1, '真不存在的号照旧拒写')

    // instance.ghRepo 的取法一处定:manifest.json 优先,空了才退另两份
    const C = { instance: { ghRepo: 'm/main' } }, B = { instance: { ghRepo: 'b/back' } }
    ok(boardRepo(C, B) === 'm/main' && boardRepo({}, B) === 'b/back' && boardRepo({}, {}) === '' && boardRepo(null) === '',
      'boardRepo:manifest.json 优先、空了退下一份、都空是空串')
    ok(boardRepo({ instance: { ghRepo: ' o/r ' } }) === 'o/r', '顺手去掉首尾空白')
    const ddSrc = readFileSync(join(NEW_SCRIPTS, 'ddd.mjs'), 'utf8')
    ok(ddSrc.includes('if (DEP_CTX) return DEP_CTX'), 'CLI 的 depCtx 建一次存下来 —— warnWip 在 ready 卡的 filter 里逐张调它')
    ok(!/for \(const x of allCards\(\)\) cardById\.set/.test(ddSrc) && ddSrc.includes('depCtxFrom('),
      '三处都走 deps.mjs 的 depCtxFrom,不再各拼一遍 cardById / relPr / relTag')
  }

  { // ---- ⑧ 拆分等价门:前置芯片整枚原样比(0.16.1 起清除日与拆不拆无关,不必再归一)----
    const a = '<span class="depchip dep-clear" title="✓ BL-5 已收 09-02">前置已清 · 09-02</span>'
    ok(stripCardUpdated(a) === a, '前置芯片原样进等价门 —— 清除日取自卡里的时间线 / date,拆不拆都一样')
    const w1 = '<span class="depchip dep-wait" title="✓ BL-5 已收 09-02 · #230 开着">等 1 项</span>'
    ok(stripCardUpdated(w1) !== stripCardUpdated(w1.replace('等 1 项', '等 2 项')),
      '项数变了判得出来 —— 0.16.0 那条规则把整枚芯片抹平,这类真差异会被这道门放过去')
    ok(stripCardUpdated(w1) !== stripCardUpdated(w1.replace('#230', '#231')), 'title 里换个 ref 同样判得出来')
    const u = '<span class="depchip dep-unlock" title="x"><a href="#BL-6">BL-6</a></span>'
    ok(stripCardUpdated(u) === u, '反向芯片原样不动')
  }
}

// ============ T71 长正文审计分两档(v0.16.2):刚立的卡阻断,已提交的老卡照旧一行提醒 ============
// 分档的依据是时机:新卡的正文刚写出来还在手边,当场拆最省事;老卡是历史,拦下来只会逼人去改一份
// 别人也在读的卡。判据 = 卡文件进没进 HEAD(未拆卡的板问不出,退卡上的 date == 今天)。
console.log('T71 长正文:新卡阻断 / 老卡提醒')
const { localDate } = await import(join(NEW_SCRIPTS, 'cards.mjs'))
{
  const fx71 = mkFixture('fx71', { 'c1.html': demoHtml('c1') })
  const kb = fx71.kb, root = fx71.root
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const blP = join(kb, 'backlog-manifest.json'), cfgP = join(kb, 'kanban.config.json')
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: root, stdio: 'ignore' })
  const item = (id, extra = {}) => ({ id, status: 'ready', priority: 'high', tier: '1', date: '2020-01-01', title: id, problem: 'p', approach: 'a', area: 'x', source: 's', ...extra })
  const bl = rd(blP)
  bl.tiers = { 1: '核心' }
  bl.items = [item('BL-1'), item('BL-2')]
  wr(blP, bl)
  const cfg = rd(cfgP)
  cfg.richText = true
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  runScript('cards-split.mjs', kb)
  git('add', '-A')
  git('commit', '-q', '-m', 'board')

  const cardP = (id) => join(kb, 'cards', 'backlog', `${id}.json`)
  const out = (r) => { try { return JSON.parse(r.stdout || '{}') } catch { return { BAD: r.stdout } } }

  // ---- 老卡(已经在 HEAD 里):正文改长也只出那一行提醒,形制一字不动 ----
  const c1 = rd(cardP('BL-1'))
  c1.approach = '正'.repeat(900)
  wr(cardP('BL-1'), c1)
  const g1 = out(runStop(NEW_SCRIPTS, root))
  ok(!g1.decision && /1 张卡的正文字段超过 800 字/.test(g1.systemMessage || '') && /最长:BL-1 的 approach/.test(g1.systemMessage || ''),
    '已提交的老卡:改长也只出一行非阻断提醒(0.15.7 的形制不动)', JSON.stringify(g1).slice(0, 300))

  // ---- 新卡(卡文件还没进 HEAD):同样的长度 → 阻断 ----
  wr(cardP('BL-9'), item('BL-9', { problem: '证'.repeat(900) }))
  const g2 = out(runStop(NEW_SCRIPTS, root))
  ok(g2.decision === 'block', '没提交过的卡文件 = 新卡:长正文当场阻断', JSON.stringify(g2).slice(0, 300))
  ok((g2.reason || '').includes('BL-9 的 problem(900 字)'), '阻断消息点名卡号 + 字段 + 字数', (g2.reason || '').slice(0, 200))
  ok(/ddd\.mjs card set <卡号> detail/.test(g2.reason || '') && /≤2 句/.test(g2.reason || '') &&
     /结论先行/.test(g2.reason || '') && /时间线/.test(g2.reason || ''),
    '给的是确切补救:card set <id> detail,外加 question ≤2 句 / approach 结论先行 / note 时间线', (g2.reason || '').slice(0, 400))
  ok(!/BL-9/.test(g2.systemMessage || '') && /1 张卡的正文字段超过 800 字/.test(g2.systemMessage || ''),
    '两档不混:新卡进 reason,老卡那一行仍只数老卡', JSON.stringify(g2).slice(0, 300))

  // ---- git add 过但还没 commit:判据是「进没进 HEAD」,不是「工作区干不干净」----
  git('add', 'app/kanban/cards/backlog/BL-9.json')
  ok(out(runStop(NEW_SCRIPTS, root)).decision === 'block', 'git add 过、还没提交 → 照样算新卡')

  // ---- 终态的新卡不点名(与 0.15.6 的老卡口径同一份 TERMINAL)----
  wr(cardP('BL-9'), item('BL-9', { status: 'done', problem: '证'.repeat(900) }))
  const g4 = out(runStop(NEW_SCRIPTS, root))
  ok(!g4.decision && !/BL-9/.test(JSON.stringify(g4)), '终态(done)的新卡:既不拦也不点名', JSON.stringify(g4).slice(0, 300))

  // ---- 写了 detail 就放行(阻断的是「长而无处安放」,不是「长」)----
  wr(cardP('BL-9'), item('BL-9', { problem: '证'.repeat(900), detail: '证据都在这儿' }))
  ok(!out(runStop(NEW_SCRIPTS, root)).decision, '新卡写了 detail 就放行')

  // ---- 防死循环:同一次收工已拦过 → 降级成一行警告放行 ----
  wr(cardP('BL-9'), item('BL-9', { problem: '证'.repeat(900) }))
  const g6 = out(runStop(NEW_SCRIPTS, root, { input: '{"stop_hook_active":true}' }))
  ok(!g6.decision && (g6.systemMessage || '').includes('本次放行') && (g6.systemMessage || '').includes('BL-9 的 problem(900 字)'),
    'stop_hook_active:不二次阻断,降级成一行警告(与孤儿 demo 同一套)', JSON.stringify(g6).slice(0, 300))

  // ---- richText 关着:这一档整个不跑(detail 本就不渲染,拦了也没处放)----
  const cfgOff = rd(cfgP)
  cfgOff.richText = false
  wr(cfgP, cfgOff)
  const g7 = out(runStop(NEW_SCRIPTS, root))
  ok(!g7.decision && !/800/.test(JSON.stringify(g7)), 'richText 关着:不阻断也不提醒')
  cfgOff.richText = true
  wr(cfgP, cfgOff)

  // ---- 提交进去,同一张卡当场转成老卡 ----
  git('add', '-A')
  git('commit', '-q', '-m', 'BL-9')
  const g8 = out(runStop(NEW_SCRIPTS, root))
  ok(!g8.decision && /2 张卡的正文字段超过 800 字/.test(g8.systemMessage || ''),
    '提交进 HEAD 之后不再拦,只并进老卡那一行的张数', JSON.stringify(g8).slice(0, 300))

  // ---- 两条阻断规则同时命中:合成一条 reason,孤儿 demo 在前 ----
  wr(cardP('BL-8'), item('BL-8', { problem: '证'.repeat(900) }))
  rmSync(join(kb, 'demos', '.no-card-ok'))
  const g9 = out(runStop(NEW_SCRIPTS, root))
  ok(g9.decision === 'block' && /未挂任何看板卡/.test(g9.reason || '') && /BL-8 的 problem/.test(g9.reason || '') &&
     g9.reason.indexOf('未挂任何看板卡') < g9.reason.indexOf('BL-8'),
    '孤儿 demo 与新卡长正文同时命中 → 一条 reason 报全(孤儿在前),不再一次只报得出一个', (g9.reason || '').slice(0, 160))
}
{ // ---- 未拆卡的板:git 问不出「提交了没」,退卡上的 date == 今天 ----
  const fx71b = mkFixture('fx71b', { 'c1.html': demoHtml('c1') })
  const kb = fx71b.kb, root = fx71b.root
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const blP = join(kb, 'backlog-manifest.json'), cfgP = join(kb, 'kanban.config.json')
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localDate(d) })()
  const bl = rd(blP)
  bl.tiers = { 1: '核心' }
  bl.items = [{ id: 'BL-1', status: 'ready', priority: 'high', tier: '1', date: localDate(), title: '今天立的', problem: '证'.repeat(900), approach: 'a', area: 'x', source: 's' }]
  wr(blP, bl)
  const cfg = rd(cfgP)
  cfg.richText = true
  wr(cfgP, cfg)
  const out = (r) => { try { return JSON.parse(r.stdout || '{}') } catch { return { BAD: r.stdout } } }
  const a = out(runStop(NEW_SCRIPTS, root))
  ok(a.decision === 'block' && (a.reason || '').includes('BL-1 的 problem(900 字)'),
    '未拆卡的板:date == 今天即算新卡,照样阻断', JSON.stringify(a).slice(0, 300))
  bl.items[0].date = yesterday
  wr(blP, bl)
  const b = out(runStop(NEW_SCRIPTS, root))
  ok(!b.decision && /1 张卡的正文字段超过 800 字/.test(b.systemMessage || ''),
    '同一张卡日期改成昨天 → 退回一行提醒(判据只有日期这一条,没有别的暗门)', JSON.stringify(b).slice(0, 300))
}

// ============ T72 版本转发(v0.16.2):产物比我新、本机装着不比产物旧的版本 → 整个 hook 交给它 ============
// 背景:hook 进程绑在起 session 那一版上;升级 plugin 后不重启 session,守卫一直是旧的,而旧 gen 不
// 许盖新板 —— 看板在这个 session 里彻底停更,只能靠人重启。装了新版的机器上没必要停。
console.log('T72 守卫转发到更新的安装')
{
  const fx72 = mkFixture('fx72', { 'c1.html': demoHtml('c1') })
  const kb = fx72.kb, root = fx72.root
  const idxP = join(kb, 'index.html')
  runGen(NEW_SCRIPTS, kb)
  const stampTo = (v) => writeFileSync(idxP, readFileSync(idxP, 'utf8').replace(/<!-- ddd-gen v[0-9.]+ -->/, `<!-- ddd-gen v${v} -->`))
  stampTo('99.9.9') // 本 session 的守卫从此比产物旧

  const cfgHome = join(WORK, 'fake-home-72')
  const mkInstall = (dir, body) => {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, 'scripts', 'stop-hook.mjs'), body)
    return dir
  }
  const writeDb = (entries) => {
    mkdirSync(join(cfgHome, 'plugins'), { recursive: true })
    writeFileSync(join(cfgHome, 'plugins', 'installed_plugins.json'),
      JSON.stringify({ version: 2, plugins: { 'demo-driven-development@demo-driven-development': entries } }, null, 2))
  }
  const fwd = (env) => runStop(NEW_SCRIPTS, root, { env: { CLAUDE_CONFIG_DIR: cfgHome, ...env } })
  const REFUSE = /由更新的 ddd-gen v99\.9\.9 生成/ // 今天的行为:拒降级 + 重启提示

  const MARK = mkInstall(join(WORK, 'cache-72', '99.9.9'),
    "import { readFileSync } from 'node:fs'\nlet raw = ''\ntry { raw = readFileSync(0, 'utf8') } catch {}\n" +
    "console.log(JSON.stringify({ systemMessage: 'MARKER-99 fwd=' + process.env.DDD_HOOK_FORWARDED + ' stdin=' + raw + ' cwd=' + process.cwd() }))\n")
  writeDb([{ scope: 'project', projectPath: root, installPath: MARK, version: '99.9.9' }])
  const r1 = fwd()
  const m1 = (() => { try { return JSON.parse(r1.stdout || '{}').systemMessage || '' } catch { return 'NOT-JSON:' + r1.stdout } })()
  ok(r1.status === 0 && /MARKER-99/.test(m1), '产物 99.9.9 + 本机装着 99.9.9 → 整个 hook 转发过去,新版的 stdout 原样带回',
    `${r1.status} ${(r1.stdout || '').slice(0, 300)}`)
  ok(m1.startsWith('看板守卫已转发到已安装的 v99.9.9'), '输出里说了一行「已转发到已安装的 v99.9.9」——不说,人只会以为守卫串了味', m1.slice(0, 120))
  ok(/fwd=99\.9\.9/.test(m1), '子进程拿到 DDD_HOOK_FORWARDED(它再遇到同样的局面就不会二次转发)', m1.slice(0, 200))
  ok(/stdin=\{\}/.test(m1), 'stdin 原样交过去(不重新序列化,免得丢掉本版不认识的字段)', m1.slice(0, 200))
  ok(m1.includes(`cwd=${process.cwd()}`), 'cwd 也照原样(转发的是整个 hook,不是只把 gen 换个版本跑)', m1.slice(0, 200))
  ok(!REFUSE.test(r1.stdout), '转发成功那一轮不再出「拒降级 + 请重启」')
  ok(readFileSync(idxP, 'utf8').includes('<!-- ddd-gen v99.9.9 -->'), '本版一个字节也没盖板(gen 自己那条拒绝没被绕过)')

  // 循环护栏:环境里已经带着 DDD_HOOK_FORWARDED → 不再往外转
  const r2 = fwd({ DDD_HOOK_FORWARDED: '99.9.9' })
  ok(!/MARKER-99/.test(r2.stdout) && REFUSE.test(r2.stdout), '已是转发来的那一轮:不再往外转,退回拒降级', (r2.stdout || '').slice(0, 200))

  // 真递归:被转到的那一版又把 hook 交回本版 —— 护栏得刹得住,而不是靠巧合
  const LOOP = mkInstall(join(WORK, 'cache-72', 'loop'),
    "import { spawnSync } from 'node:child_process'\nimport { readFileSync } from 'node:fs'\nlet raw = ''\ntry { raw = readFileSync(0, 'utf8') } catch {}\n" +
    `const r = spawnSync(process.execPath, [${JSON.stringify(join(NEW_SCRIPTS, 'stop-hook.mjs'))}], { input: raw, encoding: 'utf8', env: process.env })\n` +
    "console.log(JSON.stringify({ systemMessage: 'NESTED ' + (r.stdout || '').slice(0, 400) }))\n")
  writeDb([{ scope: 'project', projectPath: root, installPath: LOOP, version: '99.9.9' }])
  const r3 = fwd()
  ok(/NESTED/.test(r3.stdout) && !/NESTED[\s\S]*NESTED/.test(r3.stdout) && REFUSE.test(r3.stdout),
    '转发只发生一次:被转到的那版再调回本版,本版看见环境变量就停手并退回拒降级', (r3.stdout || '').slice(0, 300))

  // 装着的比我新、却比产物旧 → 不转发(它照样盖不了这块板)
  writeDb([{ scope: 'project', projectPath: root, installPath: MARK, version: '1.0.0' }])
  ok(!/MARKER-99/.test(fwd().stdout) && REFUSE.test(fwd().stdout), '装的那版比产物旧 → 不转发,退回拒降级')

  // 版本不是纯数字点分("unknown")→ cmpVer 全程 NaN,自然出局
  writeDb([{ scope: 'project', projectPath: root, installPath: MARK, version: 'unknown' }])
  ok(REFUSE.test(fwd().stdout), 'version 是 "unknown" 的安装项不参与比较(cmpVer 给 NaN,比较恒 false)')

  // 安装项属于别的项目 → 不认;user 档(没写 projectPath)才对所有项目生效
  writeDb([{ scope: 'project', projectPath: join(WORK, 'someone-else'), installPath: MARK, version: '99.9.9' }])
  ok(REFUSE.test(fwd().stdout), 'projectPath 指着别的项目 → 不是这块板的安装,不认')
  writeDb([{ scope: 'user', installPath: MARK, version: '99.9.9' }])
  ok(/MARKER-99/.test(fwd().stdout), 'user 档安装(没有 projectPath)对所有项目生效,同样转发得出去')

  // 读不到安装表(没接市场 / 文件不在)→ 什么都不做
  rmSync(join(cfgHome, 'plugins', 'installed_plugins.json'))
  ok(REFUSE.test(fwd().stdout), '读不到 installed_plugins.json → 退回今天的行为,不猜')

  // 常态路径:产物不比我新时根本不查安装表
  writeDb([{ scope: 'project', projectPath: root, installPath: MARK, version: '99.9.9' }])
  stampTo(MY_VER) // 戳回到本版(不能靠重跑 gen —— gen 自己也拒绝盖更新的产物,那条正是本条要绕开的)
  const r9 = fwd()
  ok(!/MARKER-99/.test(r9.stdout) && r9.status === 0, '产物不比我新 → 根本不转发:这是版本冲突的补救,不是常态路径', (r9.stdout || '').slice(0, 200))
}

// ============ T73 验收反馈共享 acceptanceFeedback(opt-in;关档逐字节冻结;写口在 serve.py)============
console.log('T73 验收反馈共享 acceptanceFeedback')
{
  const fx73 = mkFixture('fx73', { 's.html': demoHtml('s') })
  const kb = fx73.kb
  const cfgP = join(kb, 'kanban.config.json'), idxP = join(kb, 'index.html'), accP = join(kb, 'acceptance-manifest.json')
  const relP = join(kb, 'release-manifest.json'), jsonlP = join(kb, 'acceptance-feedback.jsonl')
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const LIST = {
    pr: 277, revision: 2, title: '通扫收口',
    groups: [{ id: 'J', title: 'J 组', tip: '' }],
    items: [
      { id: 'JJ3', group: 'J', title: '条目甲', do: '点一下', exp: '有反应' },
      { id: 'A"1', group: 'J', title: '带引号的 id', do: '点一下', exp: '有反应' },
    ],
    result: { checked: ['A"1'], at: '2026-09-01' }, // 既往已收的那次:v0.17.1 渲成只读的「已收」灰标
  }
  wr(accP, { current: 277, lists: [LIST] })
  const cfg = rd(cfgP)
  cfg.acceptanceTab = true
  wr(cfgP, cfg)

  // ---- 四拍:未配 → false 比 sha → true 验行为 → 关回比 sha ----
  runGen(NEW_SCRIPTS, kb)
  const offSha = sha(idxP)
  const off = readFileSync(idxP, 'utf8')
  ok(!off.includes('accfb') && !off.includes('data-accme') && !off.includes('accFbMerge')
    && !off.includes('acceptance-feedback.jsonl') && !off.includes('api/acceptance/'),
    '未配 acceptanceFeedback:入口 / 身份芯片 / 运行时 / jsonl 与写口路径,一个字都不出')
  cfg.acceptanceFeedback = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, kb)
  ok(sha(idxP) === offSha, 'acceptanceFeedback:false 与未配逐字节相同(冻结)')
  cfg.acceptanceFeedback = true
  wr(cfgP, cfg)
  const rOn = runGen(NEW_SCRIPTS, kb)
  ok(rOn.status === 0, 'acceptanceFeedback:true gen exit 0', rOn.stderr)
  const on = readFileSync(idxP, 'utf8')

  // ---- 左栏判定 / 行末入口 / 身份芯片(v0.17.1 判定即勾选)----
  ok(count(on, 'data-accv="ok"') === 2 && count(on, 'data-accv="bad"') === 2 && !on.includes('data-accck='),
    '左栏换成 ✓ / ✕ 两枚钮(2 条 = 各 2 枚),勾选框一个不剩',
    `${count(on, 'data-accv="ok"')} / ${count(on, 'data-accv="bad"')}`)
  ok(count(on, 'aria-pressed="false"') === 4 && count(on, '<button type="button" class="accv') === 4,
    '两枚钮是真 <button>(可 Tab、Enter/Space 原生触发)且 aria-pressed 跟随', String(count(on, 'aria-pressed="false"')))
  ok(count(on, 'data-accadd=') === 2 && on.includes('>＋ 备注 / 图</button>'),
    '每行右下角常驻「＋ 备注 / 图」—— 不做悬停才现(桌面上藏在悬停里等于不存在)')
  ok(count(on, 'data-accfb=') === 2 && on.includes('<span class="accfbt"></span>') && on.includes('aria-expanded="false" hidden>'),
    '行末摘要 chip 烤成 hidden:没人说过话时那儿什么都没有(不再每行挂一枚「反馈 ▸」)')
  ok(on.includes('data-accid="A&quot;1"') && on.includes('data-accfb="A&quot;1"'),
    '带引号的条目 id 照旧 esc(入口的 data 属性也走同一把尺)')
  ok(count(on, 'data-accrev="2"') === 2, '每行带上清单 revision(旧反馈标灰「清单已改」靠它)', String(count(on, 'data-accrev="2"')))
  ok(on.includes('<span class="accme" data-accme hidden>') && on.includes('data-accwho'),
    'tab 顶部一枚身份芯片(名字运行期填,gen 期一个字都不知道)')
  ok(on.includes('.accfbx {') && on.includes('.accv.ok[aria-pressed="true"]') && on.includes('.accv.bad[aria-pressed="true"]'),
    '样式随开关进来(展开区 + 两枚钮判过之后的实心)')
  ok(on.includes('.accitem.bad { border-left: 2px solid #d44c47; padding-left: 11px; }') && on.includes('.accitem.done { background: var(--bg); opacity: .66; }'),
    '✓ 沿用 .accitem.done 的变淡;✕ 不变淡、左缘 2px 红边并补 1px 内缩(正文不横移)')
  ok(on.includes('.accfbzoom { position: fixed; inset: 0;') && on.includes('rgba(0, 0, 0, .62)')
    && on.includes('max-width: 92vw; max-height: 88vh'),
    '缩略图就地放大:铺满视口的遮罩 + 居中原图(92vw / 88vh)')
  ok(on.includes('.accfbnw:focus-within .accfbhint { opacity: 1; }') && on.includes("fbEl('span', 'accfbhint', '⌘V 贴图')"),
    '贴图提示只在输入框聚焦时出现在框内右缘(不常驻)')
  ok(on.includes("'htest_acc_who'"), '身份存 <brand>_acc_who(与勾选那把 LS_PREFIX 同一处)')
  ok(on.includes("fetch('acceptance-feedback.jsonl', { cache: 'no-store' })"), 'jsonl 每次现拉,不吃缓存')
  ok(on.includes("setInterval(fbTick, 20000)") && on.includes("document.addEventListener('visibilitychange'")
    && on.includes("window.addEventListener('focus', fbTick)"),
    '三条刷新路径:可见期间 20s 一轮 / 回到前台 / 窗口获焦')
  ok(on.includes("if (window.accFbPoll) accFbPoll()"), '切进验收 tab 那一下也拉一次(show 里补一句)')
  ok(on.includes('1280 / Math.max(w, h)') && on.includes("'image/jpeg', 0.8"),
    '上传前 canvas 压缩:长边 ≤ 1280、JPEG 0.8')
  ok(on.includes("fetch('api/acceptance/mark'") && on.includes("'api/acceptance/shot?pr='"),
    '两个写口都从页面这边接上了')
  {
    const fbjs = on.slice(on.indexOf('/* ======== 验收反馈共享'), on.indexOf('function accRoute()'))
    ok(fbjs.length > 2000 && !/innerHTML\s*=/.test(fbjs) && !fbjs.includes('insertAdjacentHTML'),
      '反馈这段一次 innerHTML 都没写 —— 备注/名字是别人写的正文,只走 textContent', String(fbjs.length))
  }
  {
    const sc = on.match(/<script>([\s\S]*?)<\/script>/g).map((s) => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
  }

  // ---- 纯函数:从产物里原样抠出来跑(下面几段共用这一份,冒烟那段验坏行也用它)----
  const fbSrc = on.slice(on.indexOf('/* ---- 纯函数区'), on.indexOf('/* ---- 运行期 ---- */'))
  ok(fbSrc.includes('accFbMerge') && fbSrc.includes('accFbShotOk'), '抠得到那段(纯函数都在壳里)')
  const F = new Function(fbSrc + '\nreturn { accFbSlug, accFbShotOk, accFbParse, accFbMerge, accFbLive, accFbChip, accFbChipText, accFbTime, accFbPasteFile, fbHttpMsg, accFbMineAt, accFbPick, accFbMine, accFbAct, accFbSendable, accFbNoWrite, accFbNetErr, accFbFresh, accFbChain, accFbBadTail }')()
  const NUL = String.fromCharCode(0)
  const merge1 = (lines) => F.accFbMerge(F.accFbParse(lines.join('\n')).rows)['277' + NUL + 'JJ3']
  {
    // 写口答了非 2xx 时页面说什么。最可能的首跑状态是宿主那份 serve.py 还没有 do_POST
    // (种子文件,init 从不覆盖):BaseHTTPRequestHandler 兜底答 501 + 一页 text/html,
    // JSON 解不出来,原来就落成一个只有开发者看得懂的「写入失败(501)」。
    ok(F.fbHttpMsg(501, '<html><body>Error 501</body></html>').includes('serve.py')
      && F.fbHttpMsg(501, '').includes('v0.17.0'),
      '501:说清是这台的 serve.py 老了、怎么换(不是一个裸状态码)', F.fbHttpMsg(501, ''))
    ok(F.fbHttpMsg(400, '{"error":"note 超过 2000 字"}') === 'note 超过 2000 字',
      '服务端说得出话就用它的原话,一个字不改(魔数 / 尺寸那类 400 照旧)')
    ok(F.fbHttpMsg(403, '{"error":"跨站请求不受理(Origin: https://evil.example)"}').includes('跨站'),
      '跨站门那句 403 也原样透出来')
    ok(F.fbHttpMsg(500, 'boom') === '写不进去(500)', '既说不出话又不是 501:退到「写不进去(码)」', F.fbHttpMsg(500, 'boom'))
    {
      // 宿主的 serve.py 是种入件(init 从不覆盖),所以升到 0.17.1 之后「写口在、但还是 ddd-serve v2」
      // 是默认态 —— 判定 / 互换 / 备注 / 贴图全好使,唯独撤回每次 400,而服务端那句原话说的是枚举:
      // 读的人只会以为自己点错了,改点另一枚,在共享账上留下一条自己并不想要的判定
      const v2 = '{"error":"verdict 只能是 ok / bad(或省略)"}'
      ok(F.fbHttpMsg(400, v2, 'none').includes('verdict 只能是 ok / bad(或省略)')
        && F.fbHttpMsg(400, v2, 'none').includes('ddd-serve v3') && F.fbHttpMsg(400, v2, 'none').includes('templates/serve.py'),
        '撤回被 v2 的枚举挡下:服务端原话照留,后面接一句指到真正的修法(换 serve.py)', F.fbHttpMsg(400, v2, 'none'))
      ok(F.fbHttpMsg(400, v2, 'ok') === 'verdict 只能是 ok / bad(或省略)',
        '不是撤回的那一笔:一个字不加(那才真是这一笔不合格)', F.fbHttpMsg(400, v2, 'ok'))
      ok(F.fbHttpMsg(400, '{"error":"PR #999 不在清单里"}', 'none') === 'PR #999 不在清单里',
        '撤回撞上别的 400(pr / item / who 不合格):照旧原话透传,不乱指 serve.py',
        F.fbHttpMsg(400, '{"error":"PR #999 不在清单里"}', 'none'))
    }
  }
  ok(count(on, 'fbHttpMsg(r.status, t, body.verdict)') === 1 && count(on, 'fbHttpMsg(r.status, t)') === 1,
    '两个写口共用这一只:记下那处把 verdict 递进去(撤回撞 400 要认得出来),上传那处没有 verdict',
    `${count(on, 'fbHttpMsg(r.status, t, body.verdict)')} / ${count(on, 'fbHttpMsg(r.status, t)')}`)
  {
    // 贴图接不接得住:剪贴板同时带文字与图是常态(Excel / 预览 / 多数截图工具),
    // 人在备注框里粘的是文字 —— 抢过来就成了「备注永远粘不进去,倒是每次传一张图」
    const cd = (types) => ({ types, items: types.map((ty) => ({ type: ty, getAsFile: () => (ty.indexOf('image/') === 0 ? { name: ty } : null) })) })
    ok(F.accFbPasteFile(cd(['image/png']), false), '只有图:接住')
    ok(F.accFbPasteFile(cd(['text/plain', 'image/png']), false), '图文混合、人不在输入框里:仍接住(截图工具常带一份文件名文本)')
    ok(!F.accFbPasteFile(cd(['text/plain', 'image/png']), true), '图文混合、光标在备注框里:不抢,让文字粘进去')
    ok(!F.accFbPasteFile(cd(['text/plain']), false) && !F.accFbPasteFile(null, false), '只有文字 / 没有剪贴板:接不住也不报错')
    ok(F.accFbPasteFile(cd(['image/png']), true), '只有图、就算光标在输入框里:接住(那儿本来也没有文字可粘)')
  }
  ok(on.includes('else if (fbPasteRow === row) fbPasteRow = null') && on.includes('if (!pbox || pbox.hidden) return'),
    '展开区一收起,贴图的指针就交回去;听到 ⌘V 也先看那个框还开着没有')
  ok(on.includes("var inBox = t.closest('.accfbx')"), '多个展开区同开:以最后碰过的那个为准')
  ok(on.includes("Array.from(String(v)") && on.includes(".slice(0, 20).join('')"),
    '署名按码点切,不按 UTF-16 格(第 20 格落在 emoji 中间时别切出半个字)')
  {
    // jsonl 只增不删、跨天跨周挂在同一页上:光一个 12:03 分不出「十分钟前」还是「上周三」
    const t0 = new Date(2026, 8, 10, 12, 3) // 本地时间 2026-09-10 12:03
    ok(F.accFbTime(t0.toISOString(), t0) === '12:03', '今天的:只报时分', F.accFbTime(t0.toISOString(), t0))
    const t1 = new Date(2026, 8, 7, 9, 5)
    ok(F.accFbTime(t1.toISOString(), t0) === '09-07 09:05', '不是今天的:把日子说出来', F.accFbTime(t1.toISOString(), t0))
    const t2 = new Date(2025, 11, 31, 23, 59)
    ok(F.accFbTime(t2.toISOString(), t0) === '12-31 23:59', '跨年也是同一句(不写年,月日够分辨)', F.accFbTime(t2.toISOString(), t0))
    ok(F.accFbTime('这不是时间', t0) === '' && F.accFbTime(null, t0) === '', '认不出的时刻:一个字都不写')
  }
  ok(on.includes("'后来改成 ' + (latest[r.who] === 'ok' ? '✓' : '✕')"),
    '同一人前后两个 verdict:被顶掉的那条自己说「后来改成 ✓ / ✕」(chip 与列表不再自相矛盾)')
  {
    const lines = [
      '{"ts":"2026-09-10T12:03:41Z","pr":277,"item":"JJ3","who":"tester-a","verdict":"bad","note":"空态那句没换"}',
      '这行不是 JSON',
      '',
      '{"ts":"2026-09-10T12:09:00Z","pr":277,"item":"JJ3","who":"tester-a","verdict":"ok"}',
      '{"ts":"2026-09-10T12:10:00Z","pr":277,"item":"JJ3","who":"tester-b","verdict":"bad","shot":"acc-277-JJ3-20260910T121000.jpg"}',
      '{"pr":277,"item":"JJ3"}',
    ].join('\n')
    const p = F.accFbParse(lines)
    ok(p.rows.length === 3 && p.bad === 2, '坏行跳过并计数(非法 JSON 一条 + 缺 who 一条)', `${p.rows.length} / ${p.bad}`)
    const e = F.accFbMerge(p.rows)['277' + NUL + 'JJ3']
    const v = F.accFbLive(e, 2)
    ok(v.verdicts['tester-a'] === 'ok' && v.verdicts['tester-b'] === 'bad',
      '同一 (who, item):后写的 verdict 覆盖前一条(tester-a 由 bad 改成 ok)', JSON.stringify(v.verdicts))
    ok(v.order.join(' ') === 'tester-a tester-b', '出场顺序按第一次表态排,改主意不插队', v.order.join(' '))
    ok(v.notes === 1 && v.shots === 1, '备注与图是累积的,不被后一条顶掉')
    ok(F.accFbChip(e, 2, '') === 'tester-a ✓ · tester-b ✕ · 1 备注 · 1 图', '行末摘要文案', F.accFbChip(e, 2, ''))
    ok(F.accFbChip(e, 2, 'tester-a') === 'tester-b ✕ · 1 备注 · 1 图',
      '我自己的判定不进摘要 —— 左栏那两枚钮已经写着了(v0.17.1)', F.accFbChip(e, 2, 'tester-a'))
    ok(F.accFbChip(null, 2, '') === '' && F.accFbChip(F.accFbMerge([])['x'], 2, '') === '',
      '没有反馈 = 空串(那枚 chip 干脆不出现)')
    {
      // 清单改版:本地勾按 rev 清零、展开区里旧行标灰,入口那枚 chip 从前不认 rev —— 它照旧写着
      // 「✓ tester-a」,与一条刚在新版清单上通过的行长得一模一样。扫一列 chip 的人读到的是「已通过」。
      const mixed = F.accFbMerge(F.accFbParse([
        '{"ts":"2026-09-10T12:00:00Z","pr":277,"item":"JJ3","who":"tester-a","rev":1,"verdict":"ok"}',
        '{"ts":"2026-09-10T12:01:00Z","pr":277,"item":"JJ3","who":"tester-b","rev":1,"note":"改版前的备注"}',
        '{"ts":"2026-09-10T12:30:00Z","pr":277,"item":"JJ3","who":"tester-b","rev":2,"verdict":"bad"}',
      ].join('\n')).rows)['277' + NUL + 'JJ3']
      ok(F.accFbChip(mixed, 2, '') === 'tester-b ✕ · 旧清单 2', '改版后:只算当版的行,旧账另起一段陈述', F.accFbChip(mixed, 2, ''))
      ok(F.accFbChip(mixed, 1, '') === 'tester-a ✓ · 1 备注 · 旧清单 1', 'rev 1 那边同一把尺(反过来看也对)', F.accFbChip(mixed, 1, ''))
      ok(F.accFbChip(mixed, 0, '') === 'tester-a ✓ · tester-b ✕ · 1 备注', '取不到 rev(老板子 / 没盖 rev 的行):全算,与 0.17.0 之前一致', F.accFbChip(mixed, 0, ''))
    }
    {
      // who 是测试人自己敲的字,拿它当普通对象的键 = 名字叫 __proto__ 时 chip 一行说两遍、
      // 记的是 ✓ 显示成 ✕(赋值命中 Object.prototype 的 setter,静默 no-op)
      const proto = F.accFbMerge(F.accFbParse([
        '{"ts":"2026-09-10T12:00:00Z","pr":277,"item":"JJ3","who":"__proto__","verdict":"bad"}',
        '{"ts":"2026-09-10T12:01:00Z","pr":277,"item":"JJ3","who":"__proto__","verdict":"ok"}',
      ].join('\n')).rows)['277' + NUL + 'JJ3']
      ok(F.accFbChip(proto, 2, '') === '__proto__ ✓', 'who 叫 __proto__:也只是一个普通名字(不重复、不显示成 ✕)', F.accFbChip(proto, 2, ''))
    }
    ok(F.accFbShotOk('acc-277-JJ3-20260910T120341.jpg', 277, 'JJ3'), '服务端拼得出的名字:认')
    ok(!F.accFbShotOk('../../etc/passwd', 277, 'JJ3') && !F.accFbShotOk('acc-277-JJ3-20260910T120341.jpg/../x.jpg', 277, 'JJ3'),
      '路径注入:不认(名字直接进 img src,这条是硬门)')
    ok(!F.accFbShotOk('acc-277-JJ3-20260910T120341.jpg', 277, 'ZZ9'), '别的条目的图:不认(挂错行也是错)')
    ok(!F.accFbShotOk('acc-277-JJ3-20260910T120341.gif', 277, 'JJ3') && !F.accFbShotOk('acc-277-JJ3-nope.jpg', 277, 'JJ3'),
      '扩展名 / 时刻不对:不认')
    ok(F.accFbShotOk('acc-277-A_1-20260910T120341-2.png', '277', 'A"1'),
      '引号 id 落成 A_1、同秒第二张的 -2、png 上传:都认(与 serve.py 同一把尺)')
    ok(!F.accFbShotOk('acc-277-aXb-20260910T120341.jpg', 277, 'a.b'),
      'slug 里的「.」不当通配符用(a.b 只配 a.b)')
    ok(F.accFbSlug('../x') === '.._x' && F.accFbSlug('') === '_', 'slug:路径分隔符与空串都落到安全字符')
  }

  // ---- v0.17.1 判定即勾选:撤回 / 合并 / 我的判定 / 防误触 / 降级判据(纯函数,从产物里抠出来跑)----
  {
    const R = (ts, who, extra) => JSON.stringify(Object.assign({ ts, pr: 277, item: 'JJ3', who, rev: 2 }, extra))
    {
      const e = merge1([R('2026-09-11T10:00:00Z', 'tester-a', { verdict: 'ok' }),
        R('2026-09-11T10:01:00Z', 'tester-b', { verdict: 'bad' }),
        R('2026-09-11T10:02:00Z', 'tester-a', { verdict: 'none' })])
      const v = F.accFbLive(e, 2)
      ok(!('tester-a' in v.verdicts) && v.order.join(' ') === 'tester-b',
        '撤回清除判定:那个人回到未判,名字也从摘要里退场(不是删行,行还在)', JSON.stringify(v.verdicts))
      ok(F.accFbMineAt(e, 2, 'tester-a').v === '' && F.accFbMineAt(e, 2, 'tester-a').ts === '2026-09-11T10:02:00Z',
        '我自己的最后一次表态 = 撤回:v 是空串,时刻仍取撤回那一条(要与本机那条比新旧)',
        JSON.stringify(F.accFbMineAt(e, 2, 'tester-a')))
      ok(F.accFbChip(e, 2, 'tester-b') === '', '撤回之后那条目一句话都不剩 = 摘要 chip 消失', F.accFbChip(e, 2, 'tester-b'))
    }
    {
      const e = merge1([R('2026-09-11T10:00:00Z', 'tester-a', { verdict: 'ok' }),
        R('2026-09-11T10:02:00Z', 'tester-a', { verdict: 'none' }),
        R('2026-09-11T10:05:00Z', 'tester-a', { verdict: 'bad' })])
      ok(F.accFbMineAt(e, 2, 'tester-a').v === 'bad' && F.accFbLive(e, 2).verdicts['tester-a'] === 'bad',
        '撤回后再判:最后那条说了算(三行都还在账上)', JSON.stringify(F.accFbMineAt(e, 2, 'tester-a')))
    }
    {
      const e = merge1([R('2026-09-11T10:00:00Z', 'tester-a', { note: '只有备注' }),
        R('2026-09-11T10:01:00Z', 'tester-b', { shot: 'acc-277-JJ3-20260911T100100.jpg' })])
      const v = F.accFbLive(e, 2)
      ok(v.notes === 1 && v.shots === 1 && v.order.length === 0 && F.accFbMineAt(e, 2, 'tester-a').v === '',
        'note-only / shot-only 的记录照旧:计进备注与图数,谁都没因此被算成判过', JSON.stringify(v.order))
      ok(F.accFbChip(e, 2, 'tester-a') === '1 备注 · 1 图', '摘要里那两个数不看是谁留的(证据就是证据)', F.accFbChip(e, 2, 'tester-a'))
    }
    {
      // 无写口时判定落本机,而账上可能还躺着我上一次(经写口)留下的那条 —— 哪条作数?
      // 两个时刻出自两只钟(本机 fbNowTs 用浏览器的,账上那条用服务端的),比大小会判错,
      // 所以比的是「我按本机那条时,账上我的最后一条是哪一条」(base)
      const e = merge1([R('2026-09-11T10:00:00Z', 'tester-a', { verdict: 'ok' })])
      const mine = F.accFbMineAt(e, 2, 'tester-a')
      const loc = (v, ts, base) => ({ who: 'tester-a', v, ts, base })
      ok(F.accFbPick(mine, null) === 'ok', '只有账上那条:听账上的')
      ok(F.accFbPick(mine, loc('bad', '2026-09-11T10:03:00Z', '2026-09-11T10:00:00Z')) === 'bad',
        '本机那条是盖着账上这一条按的:听本机的(无写口那条路)')
      ok(F.accFbPick(mine, loc('bad', '2026-09-11T09:00:00Z', '')) === 'ok',
        '本机那条盖的是更早的账(换了台有写口的机器之后):还是听账上的')
      ok(F.accFbPick(mine, loc('', '2026-09-11T10:03:00Z', '2026-09-11T10:00:00Z')) === '' && F.accFbPick(null, null) === '',
        '本机那条是撤回 / 两边都没有:都落到未判')
      ok(F.accFbPick(null, loc('bad', '2026-09-11T10:03:00Z', '')) === 'bad',
        '账上我一条都没有:本机那条说了算(base 与它对得上,都是空)')
      // 手机 / 没跑 NTP 的机器上,浏览器的钟与服务端差几分钟是常事
      ok(F.accFbPick(mine, loc('bad', '2026-09-11T09:55:00Z', '2026-09-11T10:00:00Z')) === 'bad',
        '浏览器钟慢五分钟:刚按下的那条仍然作数(按时刻比就当场失效了)',
        F.accFbPick(mine, loc('bad', '2026-09-11T09:55:00Z', '2026-09-11T10:00:00Z')))
      {
        const e2 = merge1([R('2026-09-11T10:00:00Z', 'tester-a', { verdict: 'ok' }),
          R('2026-09-11T10:01:00Z', 'tester-a', { verdict: 'bad' })])
        ok(F.accFbPick(F.accFbMineAt(e2, 2, 'tester-a'), loc('ok', '2026-09-11T10:05:00Z', '2026-09-11T10:00:00Z')) === 'bad',
          '浏览器钟快五分钟、账上我后来又判过:听账上那条新的(按时刻比会把它顶回旧判定)',
          F.accFbPick(F.accFbMineAt(e2, 2, 'tester-a'), loc('ok', '2026-09-11T10:05:00Z', '2026-09-11T10:00:00Z')))
      }
      // 本机那条的键里没有 who(<brand>_acc_v_<pr>_r<rev>,换个人验不换键)—— 值里不记就成了替人署名
      ok(F.accFbMine({ who: '甲', v: 'bad', ts: 'x' }, '甲').v === 'bad', '本机那条是我按的:认')
      ok(F.accFbMine({ who: '甲', v: 'bad', ts: 'x' }, '乙') === null,
        '点了「换人」之后:甲在这台留下的判定不算乙的(不上色、不进乙的进度、不进「复制结果」的 bad[])')
      ok(F.accFbMine({ v: 'bad', ts: 'x' }, '甲') === null && F.accFbMine(null, '甲') === null,
        '没记 who 的老记录 / 根本没有:都当没有(0.17.1 未发版,不欠迁移)')
      ok(F.accFbPick(F.accFbMineAt(e, 2, '乙'), F.accFbMine({ who: '甲', v: 'bad', ts: '2026-09-11T10:09:00Z' }, '乙')) === '',
        '换人之后整条链落到未判:accFbPick 那条「账上没有我 = 本机那条就是我的」不再替甲署乙的名')
    }
    ok(F.accFbAct('', 'ok', 9e9) === 'ok' && F.accFbAct('ok', 'bad', 9e9) === 'bad' && F.accFbAct('bad', 'ok', 10) === 'ok',
      '未判 → 判;✓ ↔ ✕ 直接互换(不经撤回,也不受 400ms 约束)')
    ok(F.accFbAct('ok', 'ok', 9e9) === 'none', '点已选的那枚 = 撤回(POST verdict:none)')
    ok(F.accFbAct('ok', 'ok', 399) === '' && F.accFbAct('ok', 'ok', 400) === 'none',
      '400ms 内的第二下不算数(防误触双击),满 400ms 才当撤回')
    ok(F.accFbSendable(false, false) === true && F.accFbSendable(false, true) === true,
      '有写口:照发')
    ok(F.accFbSendable(true, true) === false && F.accFbSendable(true, false) === true,
      '认过没写口:这一页里不再发请求;但每次开页留一次试探,写口回来了自己接上')
    ok(F.accFbNoWrite(404) && F.accFbNoWrite(501) && F.accFbNoWrite(405) && !F.accFbNoWrite(400) && !F.accFbNoWrite(403) && !F.accFbNoWrite(500),
      '「这儿没有写口」只认 404 / 405 / 501 —— 400 / 403 / 500 是这一笔不合格,该回滚该说原话')
    ok(F.accFbBadTail(0) === '' && F.accFbBadTail(3) === ' · 其中 3 条不对',
      '进度那句的后半截:一条不对都没有时一个字不说')
  }

  // ---- v0.17.1 收口:两人同时验 + 弱链路上的那几处时序与降级(0.17.1 评审查出来的)----
  {
    const R = (ts, who, extra) => JSON.stringify(Object.assign({ ts, pr: 277, item: 'JJ3', who, rev: 2 }, extra))
    // ① 20s 轮询那一发在路上飘几百毫秒是常态,而它读到的是发出那一刻的文件(jsonl 走 gzip 分支,
    //    服务端整读整压成 body,随后 POST 追加的字节进不了这一发)。回来晚了整包盖掉刚写成功的那行,
    //    人看完「已记下」微闪判定就退回未判,再点一下不是撤回而是又追一条 ok
    ok(F.accFbFresh(100, 200) === false, '比最后一次写成功还早出发的那发 GET:整发丢掉(它读的是写之前的文件)')
    ok(F.accFbFresh(200, 200) === true && F.accFbFresh(300, 200) === true && F.accFbFresh(0, 0) === true,
      '写成功之后才出发的(以及一次都没写过时的):照常采信')
    ok(on.includes('var at = Date.now()') && on.includes('if (!accFbFresh(at, FB_WROTE)) return')
      && on.includes('FB_WROTE = Date.now()'),
      'fbFetch 记下出发时刻、拿它与最后一次写成功比;写成功那下盖时刻')
    // ② fetch 自己挂了 ≠ 这台没有写口。serve.py 重启那两秒 / Tailscale 抖一下按下的那一枚,
    //    原来会把整页闩死在本机模式:解闩那句长在写成功分支里,而三条写路都先过 fbSendable() 这道门
    ok(F.accFbNetErr('file:').nowrite === true && F.accFbNetErr('file:').msg.includes('serve.py'),
      'file:// 打开的板:那才是真没有写口(§6 的主用例,拿不到任何状态码)', F.accFbNetErr('file:').msg)
    ok(F.accFbNetErr('http:').nowrite === false && F.accFbNetErr('https:').nowrite === false
      && F.accFbNetErr('http:').msg.includes('再点一次'),
      'http(s) 下连不上:是这一下没送出去,不是这台没有写口 —— 回滚 + 说原话,下一下照发',
      F.accFbNetErr('http:').msg)
    {
      const mk = on.slice(on.indexOf('function fbMark(row, body)'), on.indexOf('function fbSaved(row)'))
      ok(mk.indexOf('FB_PROBED = true') > mk.indexOf("fetch('api/acceptance/mark'"),
        'FB_PROBED 在收到回应之后才置位(发出去就置位 = 一次断网把整页闩在本机模式,而那一闩没有解锁的路)')
      ok(mk.includes('accFbNetErr(location.protocol)') && !mk.includes("', true)"),
        'fetch 层 reject 走 accFbNetErr 分档,不再无条件当「没有写口」')
    }
    // ③ 同一条目连点 ✕→✓:两发裸 fetch 各走一条连接(serve.py 无 keep-alive + 每连接一线程),
    //    第一发在路上卡一下就反序落盘,账上最后一行成了 ✕ —— 20s 后轮询把它涂回红的
    {
      const seen = []
      const slow = () => new Promise((r) => setTimeout(() => { seen.push('bad'); r() }, 25))
      const fast = () => { seen.push('ok'); return Promise.resolve() }
      let q = F.accFbChain(null, slow)
      q = F.accFbChain(q, fast)
      await q
      ok(seen.join('>') === 'bad>ok', '同一条目的两发写排成一列:后点的那下等前一发落定(落盘次序 = 点击次序)', seen.join('>'))
      const seen2 = []
      let q2 = F.accFbChain(null, () => Promise.reject(new Error('第一发失败')))
      q2 = F.accFbChain(q2, () => { seen2.push('第二发照发'); return Promise.resolve() })
      await q2
      ok(seen2.join('') === '第二发照发', '前一发失败不把这条队列堵死(失败也是落定)')
    }
    ok(on.includes('FB_Q[k] = accFbChain(FB_Q[k], function () {'), '判定那条路真排了队(每条目一条)')
    // ④ chip 是时间线唯一的开关:它一消失,摊开着的时间线就再没有控件能收起来(只能刷新)
    {
      const one = merge1([R('2026-09-11T10:00:00Z', 'tester-a', { verdict: 'ok' })])
      ok(F.accFbChipText(one, 2, 'tester-a') === '',
        '只有我自己、只有一条:chip 仍然不出现(每行都挂一枚就是 0.17.0 那排「反馈 ▸」)', F.accFbChipText(one, 2, 'tester-a'))
      const mineTwo = merge1([R('2026-09-11T10:00:00Z', 'tester-a', { verdict: 'ok' }),
        R('2026-09-11T10:02:00Z', 'tester-a', { verdict: 'none' })])
      ok(F.accFbChipText(mineTwo, 2, 'tester-a') === '记录 2 条',
        '只有我自己、但有来龙去脉(判了又撤):点得开 —— §3 的时间线「含我自己的」才够得着',
        F.accFbChipText(mineTwo, 2, 'tester-a'))
      const gone = merge1([R('2026-09-11T10:00:00Z', 'tester-b', { verdict: 'bad' }),
        R('2026-09-11T10:05:00Z', 'tester-b', { verdict: 'none' })])
      ok(F.accFbChip(gone, 2, 'tester-a') === '' && F.accFbChipText(gone, 2, 'tester-a') === '记录 2 条',
        '别人撤回之后:摘要没话可说,但 chip 不消失(账只增不删,那两条还在时间线里)',
        F.accFbChipText(gone, 2, 'tester-a'))
      ok(F.accFbChipText(null, 2, '') === '', '一条记录都没有:那儿还是什么都不出现')
      ok(on.includes("t.textContent = txt || (open ? '收起' : '')") && on.includes('t.parentElement.hidden = !txt && !open'),
        '兜底:时间线正开着时那枚 chip 一定留着(它是唯一的收起口)')
    }
  }

  // ---- v0.17.1 收口:降级与展开区的几处(备注不被吞 / 自动聚焦真落地 / 遮罩不漏焦点)----
  {
    const save = on.slice(on.indexOf('function fbNoteSave(row)'), on.indexOf('function fbShrink(file)'))
    ok(save.indexOf('if (!fbSendable())') < save.indexOf("n.value = ''"),
      '无写口时不吞人打的那句话:清空排在「真要发」之后(原来先清后拒,那句话既不在账上也不在框里)')
    ok(save.includes("n.value = note // 没写进去,把那句话还给人,别让它凭空消失"),
      'HTTP 失败那条路照旧把话还回来(两条路对同一件事给同一个待遇)')
    const ed = on.slice(on.indexOf('function fbEdit(row, open, ph)'), on.indexOf('function fbTimeline(row, open)'))
    ok(ed.indexOf('fbOpen(row)') < ed.indexOf('n.focus()'),
      '先把展开区放开再聚焦:display:none 的子树里 focus() 不作数 —— §2 那两条「自动展开并聚焦」原来首开必失败')
    ok(on.includes('.accfbed[hidden] { display: none; }'),
      '作者样式的 display 压得过 UA 的 [hidden]:补一条,否则 ed.hidden 收不走那一行备注框')
    ok(on.includes('.accitem input.accfbn { flex: 1 1 auto; width: auto; height: auto; margin: 0; }'),
      '备注框把尺寸从 .accitem input(0.17.0 那只勾选框的 15×15)手里要回来 —— 否则可写宽是 0 像素')
    ok(on.indexOf('.accitem input {') < on.indexOf('.accitem input.accfbn {'),
      '这条压制规则排在被压的那条后面(同表内顺序也对得上,不只靠特指度)')
    const zoom = on.slice(on.indexOf('function fbZoom(name, opener)'), on.indexOf('function fbBox(row)'))
    ok(zoom.includes("ov.setAttribute('role', 'dialog')") && zoom.includes("ov.setAttribute('aria-modal', 'true')")
      && zoom.includes("if (ev.key === 'Tab') { ev.preventDefault(); x.focus() }"),
      '放大遮罩是个真模态:Tab 出不去 —— 出去就落在被遮住的 ✓ / ✕ 上,一个回车往共享账里写一条看不见的判定')
    ok(zoom.includes('fbBackTo(back, name)') && on.includes('function fbBackTo(row, name)'),
      '关遮罩时按名字在该行里重新找那枚缩略图:时间线每轮询一次就整片重建,手里那枚早成了游离节点')
    ok(on.includes("var back = opener && opener.closest ? opener.closest('.accitem') : null"),
      '趁缩略图还在 DOM 上把它那一行记下来(重建之后 closest 就回不去了)')
  }

  // ---- v0.17.1 收口:本机判定不替人署名、进账后不留影子、满格条不点绿 ----
  {
    ok(on.includes('m[id] = { who: FB_WHO, v: vd || \'\', ts: fbNowTs(), base: base || \'\' }'),
      '本机那条记下 who 与 base:键里没有 who(换人不换键),值里不记就把甲的判定算到乙头上')
    ok(on.includes('accFbPick(accFbMineAt(FB[k], l.rev, FB_WHO), accFbMine(fbLocal(l)[id], FB_WHO))'),
      '取判定时先过 who 这道筛(左栏颜色、进度、分组、「复制结果」共用这一只)')
    ok(on.includes("ln.appendChild(fbEl('span', 'accfbav', Array.from(String(loc.who || '我'))[0]))"),
      '时间线里本机那条的名字圆点取记录里的 who,不取当下署的名(§6:不伪造别人的反馈)')
    ok(on.includes('if (was !== v) window.accSync()'),
      '点「换人」当场重画:左栏 / 进度 / 分组全按「我的判定」算,而「我」刚刚变了(不重画就有 20 秒看着前一个人的判定)')
    ok(on.includes('function fbLocalClear(l, id)') && on.includes('fbLocalClear(l, row.dataset.accid)'),
      '判定写进账了就把本机那条影子删掉(留着会在时间线末尾多一行已被顶掉的判定,又拿两只钟去顶账上的新判定)')
    ok(on.includes('.accbar i.bad { background: #d44c47; }') && on.includes("classList.toggle('bad', vb > 0)"),
      '这一屏里有判「不对」的:页顶那根条也不点绿(与分组计数同一把尺,免得「6 / 6」读成「全过了」)')
    ok(!off.includes('.accbar i.bad') && !off.includes("classList.toggle('bad', vb > 0)"),
      '关着的那档:进度条一个字节没动(0.17.0 之前没有「不对」这个概念)')
    ok(on.includes('.accitem.done { opacity: 1; }') && on.includes('.accitem.done > .accib, .accitem.done > .accno { opacity: .66; }')
      && on.includes('color: var(--mut); cursor: pointer; white-space: nowrap; }'),
      '「变淡」只落在条目正文上:整行 .66 之后右下角那枚常驻入口只剩 2.05:1,与 §2 明令不做的「悬停才现」一个量级')
    ok(off.includes('.accitem.done { background: var(--bg); opacity: .66; }') && !off.includes('.accitem.done { opacity: 1; }'),
      '关着的那档:.accitem.done 还是 0.16.2 那条(补丁只写在 acceptanceFeedback 那段里)')
  }

  // ---- 计数与文案改口(进度 / 分组 / 复制结果)----
  ok(on.includes('已判 <b class="accdone">0</b>') && on.includes('<span class="accbadt"></span>')
    && on.includes("p.querySelector('.accbadt').textContent = accFbBadTail(vb)"),
    '进度改口「已判 N / M · 其中 K 条不对」(K 由运行期按我的判定算)')
  ok(on.includes("v = fbVdOf(l, it.id, it.pr), on = v === 'ok', bd = v === 'bad', jd = on || bd")
    && on.includes('if (jd) vd++; if (bd) vb++') && on.includes('if (jd) gc[it.g].d++')
    && on.includes("a.classList.toggle('bad', c.b > 0)"),
    '进度与分组计数全按我的判定算(判过就算已判,不对的另计一档)')
  ok(on.includes('>复制结果<') && !on.includes('复制勾选结果')
    && on.includes('JSON.stringify({ checked: checked, bad: bad, at: at })'),
    '「复制勾选结果」改名「复制结果」,输出 {checked, bad, at} —— checked 键保持原形')
  ok(on.includes("if (v === 'ok') checked.push(it.id)") && on.includes("else if (v === 'bad') bad.push(it.id)"),
    '复制出来的两个数组读的是我的判定(不是本机勾选)')
  ok(on.includes('<span class="accgot"') && on.includes('>已收</span>') && count(on, 'class="accgot"') === 1,
    'manifest result.checked 里的条目:行上一枚只读的「已收」灰标(这块板上只有一条)', String(count(on, 'class="accgot"')))
  ok(!on.includes("'htest_acc_' + l.k + '_r'") && !on.includes('function load(l)') && !on.includes('l.pre.forEach'),
    '旧勾选键 <brand>_acc_<pr>_r<rev>:不读、不写、不迁移(那是私有痕迹,转成判定等于替人署名)')
  ok(on.includes("function fbVdKey(l) { return 'htest_acc_v_' + l.k + '_r' + l.rev }"),
    '无写口时判定存 <brand>_acc_v_<pr>_r<rev>(与旧勾选键各走各的)')
  ok(off.includes("'htest_acc_' + l.k + '_r'") && off.includes('function load(l)'),
    '关着的那档:旧勾选那套一个字节没动(冻结基线里它还在)')

  // ---- 降级(无写口):控件形状不变,判定落本机,tab 顶一行灰字 ----
  ok(on.includes('<p class="accdeg" data-accdeg hidden>') && on.includes('这台看板没有写口,判定只存在这台浏览器里'),
    '无写口那行灰字烤成 hidden,降级时才亮(gen 期不知道有没有写口)')
  ok(on.includes('if (!fbSendable()) { fbKeepLocal(l, row, k, vd); return }')
    && on.includes("if (!fbSendable()) { fbSay(row, '这台看板没有写口,备注存不下来 —— 判定还在这台浏览器里'); return }"),
    '降级路径不发请求:判定直接落本机,备注当场说清存不下来')
  ok(on.includes("localStorage.setItem(FB_NOWRITE_KEY, '1')") && on.includes('localStorage.removeItem(FB_NOWRITE_KEY)'),
    '「这台没有写口」记在浏览器里;写口回来了(换了新 serve.py)那个记号自己收走')

  // ---- 时间线 / 缩略图 ----
  ok(on.includes("fbEl('span', 'accfbvd none', '撤回判定')") && on.includes("var line = fbEl('div', 'accfbr' + (stale || beaten || none ? ' stale' : ''))"),
    '时间线列全部记录,撤回那条用淡色渲染(不抹,只是淡)')
  ok(!on.includes("fbEl('p', 'accfbe', '还没有反馈')") && !on.includes("'accfbe', '还没有反馈'"),
    '空态不再占一行(「还没有反馈」那句删掉了)')
  ok(on.includes("var av = fbEl('span', 'accfbav', Array.from(String(r.who))[0] || '?')"),
    '一行一条:姓名首字圆点 · ✓/✕ · 时间 · 备注 · 缩略图')
  ok(on.includes("function fbZoom(name, opener)") && on.includes("if (b && document.body.contains(b)) b.focus()")
    && on.includes("if (ev.key === 'Escape')") && !on.includes("a.href = 'shots/' + name"),
    '缩略图点开就地放大:Esc / 点空白 / 关闭钮都能关,关后焦点回缩略图;不再新开标签页')

  // ---- acceptanceFeedback 开着但 acceptanceTab 关着:一行警告,产物照旧冻结 ----
  {
    const c2 = rd(cfgP)
    c2.acceptanceTab = false
    c2.acceptanceFeedback = false
    wr(cfgP, c2)
    runGen(NEW_SCRIPTS, kb)
    const noTabSha = sha(idxP)
    c2.acceptanceFeedback = true
    wr(cfgP, c2)
    const rw = runGen(NEW_SCRIPTS, kb)
    ok(rw.status === 0 && /acceptanceFeedback/.test(rw.stderr) && /acceptanceTab/.test(rw.stderr),
      '开了反馈却没开验收 tab:一行警告点名两个键(不硬报错)', rw.stderr.slice(0, 140))
    ok(sha(idxP) === noTabSha, '那种配置下产物逐字节不变(反馈没地方挂 = 按关处理)')
  }

  // ---- 截图廊忽略 acc-* ----
  {
    writeFileSync(join(kb, 'shots', 'd1-normal.png'), 'x')
    writeFileSync(join(kb, 'shots', 'acc-277-JJ3-20260910T120341.png'), 'x')
    // 卡的截图是人手命名的 <卡号>-<说明>.png:光按 acc- 前缀过滤,这张(在一块正好在做验收 tab
    // 的板上,是个再自然不过的名字)会连人带「截图 · N」徽章一起消失,而且不看开关开没开
    writeFileSync(join(kb, 'shots', 'acc-tab-empty.png'), 'x')
    const c3 = rd(cfgP)
    c3.acceptanceTab = true
    c3.acceptanceFeedback = true
    wr(cfgP, c3)
    runGen(NEW_SCRIPTS, kb)
    const gal = readFileSync(join(kb, 'shots.html'), 'utf8')
    ok(gal.includes('d1-normal.png') && !gal.includes('acc-277-JJ3'),
      '截图廊只收常规截图,反馈截图不进廊(它们按条目挂在验收 tab 里)')
    ok(gal.includes('acc-tab-empty.png') && readFileSync(idxP, 'utf8').includes('截图 · 2'),
      '手命名的 acc-tab-empty.png 是卡的证据,不是反馈图:照进廊、也照数进徽章')
    rmSync(join(kb, 'shots', 'acc-277-JJ3-20260910T120341.png'))
    rmSync(join(kb, 'shots', 'acc-tab-empty.png'))
    rmSync(join(kb, 'shots', 'd1-normal.png'))
    runGen(NEW_SCRIPTS, kb)
  }

  // ---- serve.py:两个写口的校验矩阵 + 端到端冒烟(随机端口,同一个测试负责收尸)----
  if (!HAS_PY3) {
    ok(true, '本机没有 python3,serve.py 那组跳过(CI 的 ubuntu 上有)')
  } else {
    cpSync(join(REPO, 'templates', 'serve.py'), join(kb, 'serve.py'))
    // 短写:os.write 不保证一次写完(盘满时可以只写一部分而不抛,信号打断同理)。丢掉它的返回值
    // = jsonl 落半行 / 截图落半张,而写口照样答 200,半行随后被读的人当坏行跳过 —— 人以为记下了。
    // 这里把 os.write 换成「一次只写一个字节」的版本,直接验 write_fd 是写到写完才收工。
    {
      const probe = join(kb, 'probe-shortwrite.py')
      writeFileSync(probe, [
        'import importlib.util, os, sys, tempfile',
        'serve_py = sys.argv[1]',
        'sys.argv = [sys.argv[0]]  # serve.py 顶上拿 argv[1] 当端口号',
        'spec = importlib.util.spec_from_file_location("srv", serve_py)',
        'm = importlib.util.module_from_spec(spec)',
        'spec.loader.exec_module(m)',
        'fd, path = tempfile.mkstemp()  # 先摆好再打补丁:mkstemp 自己也写一笔试温',
        'os.close(fd)',
        'real, calls = os.write, []',
        'def short(fd, data):',
        '    n = real(fd, data[:1])',
        '    calls.append(n)',
        '    return n',
        'os.write = short',
        'try:',
        '    m.append_line(path, b\'{"a":1}\\n\')',
        'finally:',
        '    os.write = real',
        'with open(path, encoding="utf-8") as f:',
        '    print(f.read() == \'{"a":1}\\n\', len(calls))',
        'os.unlink(path)',
        '',
      ].join('\n'))
      const r = spawnSync('python3', [probe, join(kb, 'serve.py')], { encoding: 'utf8' })
      ok(r.status === 0 && r.stdout.trim() === 'True 8',
        'os.write 每次只写一个字节时,write_fd 照样把整行写完(短写不截断)',
        `${r.status} ${r.stdout.trim()} ${r.stderr.slice(0, 160)}`)
      rmSync(probe)
    }
    const c4 = rd(cfgP)
    c4.acceptanceFeedback = false // 先关着起服:开关是每请求现读的,不必重启
    wr(cfgP, c4)
    const srv = await startServe(kb)
    try {
      const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)])
      const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)])
      const mark = (body) => req(srv.base, '/api/acceptance/mark',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const shot = (q, buf, type = 'image/jpeg') => req(srv.base, '/api/acceptance/shot?' + q,
        { method: 'POST', headers: { 'Content-Type': type }, body: buf })

      // 关着:两条写口 404,别的 POST 路径照旧 501,GET 一个字节没变
      ok((await mark({ pr: 277, item: 'JJ3', who: 'tester-a', verdict: 'ok' })).status === 404
        && (await shot('pr=277&item=JJ3&who=tester-a', JPG)).status === 404,
        'acceptanceFeedback 关着:两条写口都 404')
      ok((await req(srv.base, '/api/nope', { method: 'POST', body: '{}' })).status === 501,
        '别的 POST 路径照旧 501(与没有这段代码时同一句)')
      {
        const g = await req(srv.base, '/index.html')
        ok(g.status === 200 && g.text === readFileSync(idxP, 'utf8'), 'GET 照旧原样发(逐字节)')
      }
      c4.acceptanceFeedback = true
      wr(cfgP, c4)
      ok((await mark({ pr: 277, item: 'JJ3', who: 'tester-a', verdict: 'ok' })).status === 200,
        '开关拨到 true:不重启服务,下一个请求就认(每请求现读 config)')

      // 校验矩阵
      // 名字门那三条要的是「名字不对」这句原话:光断言错误串里有 'shot',
      // 「文件不在 shots/」那句兜底也含这两个字 —— 把服务端唯一那道名字门整段删掉,
      // 断言照样绿。所以下面两笔都挑「文件真在盘上」的名字打:少了名字门,它们会被收下。
      writeFileSync(join(kb, 'shots', 'acc-277-A_1-20260101T000000.jpg'), 'x') // 名字合法,但属于另一条目
      const NAMEGATE = '不是本服务为这条目生成的文件名'
      const cases = [
        ['pr 不在清单里', await mark({ pr: 999, item: 'JJ3', who: 'R', verdict: 'ok' }), 'PR #999'],
        ['item 不属于这份清单', await mark({ pr: 277, item: 'NOPE', who: 'R', verdict: 'ok' }), 'NOPE'],
        ['who 超长(21 字)', await mark({ pr: 277, item: 'JJ3', who: 'x'.repeat(21), verdict: 'ok' }), 'who'],
        ['who 空', await mark({ pr: 277, item: 'JJ3', who: '', verdict: 'ok' }), 'who'],
        ['who 带控制字符', await mark({ pr: 277, item: 'JJ3', who: 'ab', verdict: 'ok' }), 'who'],
        ['verdict 不在枚举里', await mark({ pr: 277, item: 'JJ3', who: 'R', verdict: 'maybe' }), 'verdict'],
        ['note 超 2000 字', await mark({ pr: 277, item: 'JJ3', who: 'R', note: 'x'.repeat(2001) }), 'note'],
        // 落单的代理对:JSON 里合法,UTF-8 里编不出来。页面那头 prompt 的名字曾按 UTF-16 格切,
        // 第 20 格正好落在 emoji 中间就会切出这么一个 —— 原来会一路炸到掐连接,连 400 都收不到
        ['who 里有落单的代理对', await mark({ pr: 277, item: 'JJ3', who: 'abcdefghijklmnopqrs\ud83d', verdict: 'ok' }), 'who'],
        ['note 里有落单的代理对', await mark({ pr: 277, item: 'JJ3', who: 'R', note: '半个 emoji \ud83d' }), 'note'],
        ['三样都没有', await mark({ pr: 277, item: 'JJ3', who: 'R' }), 'verdict'],
        ['shot 文件名注入', await mark({ pr: 277, item: 'JJ3', who: 'R', shot: '../../etc/passwd' }), NAMEGATE],
        ['shot 指向盘上真有的板内文件', await mark({ pr: 277, item: 'JJ3', who: 'R', shot: '../index.html' }), NAMEGATE],
        ['shot 是另一条目的图(文件真在)', await mark({ pr: 277, item: 'JJ3', who: 'R', shot: 'acc-277-A_1-20260101T000000.jpg' }), NAMEGATE],
        ['shot 名字对但文件不在', await mark({ pr: 277, item: 'JJ3', who: 'R', shot: 'acc-277-JJ3-20260910T120341.jpg' }), 'shots/'],
        ['请求体不是 JSON', await req(srv.base, '/api/acceptance/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), 'JSON'],
        // text/plain 是 CORS simple type(发它不走预检)—— 认死 application/json,跨站那条路才断得干净
        ['mark 的 Content-Type 是 text/plain', await req(srv.base, '/api/acceptance/mark',
          { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ pr: 277, item: 'JJ3', who: 'R', verdict: 'ok' }) }), 'Content-Type'],
        ['图的 Content-Type 不收', await shot('pr=277&item=JJ3&who=R', JPG, 'image/gif'), 'Content-Type'],
        ['魔数与 Content-Type 对不上', await shot('pr=277&item=JJ3&who=R', Buffer.from('GIF89a......'), 'image/jpeg'), '魔数'],
        ['图超 2 MB', await shot('pr=277&item=JJ3&who=R', Buffer.concat([JPG, Buffer.alloc(2 * 1024 * 1024)]), 'image/jpeg'), '上限'],
        ['图的 pr 不在清单里', await shot('pr=999&item=JJ3&who=R', JPG), 'PR #999'],
      ]
      for (const [name, res, needle] of cases) {
        ok(res.status === 400 && res.json && String(res.json.error).includes(needle),
          `校验:${name} → 400 + 一句原因`, `${res.status} ${res.text.slice(0, 90)}`)
      }
      ok(!existsSync(join(kb, 'shots', 'passwd')) && !existsSync(join(kb, '..', '..', 'passwd')),
        '被拒的那几笔一个文件都没落盘')

      // 端到端:两笔 mark + 一张图 + GET jsonl
      const m1 = await mark({ pr: 277, item: 'JJ3', who: 'tester-a', verdict: 'bad', note: '空态那句<b>没换</b>' })
      const m2 = await mark({ pr: 277, item: 'A"1', who: 'tester-b', verdict: 'ok' })
      ok(m1.status === 200 && m1.json.pr === 277 && m1.json.who === 'tester-a' && m1.json.rev === 2,
        'mark 写成功:回的就是写进去的那一行(rev 由服务端按清单盖,不信客户端)', m1.text.slice(0, 120))
      ok(m1.json.note === '空态那句<b>没换</b>', '备注原样存(转义是渲染那头的事,存的时候不改人写的字)')
      ok(m2.status === 200 && m2.json.item === 'A"1', '带引号的条目 id 也写得进去')
      const up = await shot('pr=277&item=' + encodeURIComponent('A"1') + '&who=tester-b', PNG, 'image/png')
      ok(up.status === 200 && /^acc-277-A_1-\d{8}T\d{6}\.png$/.test(up.json.shot),
        '图落盘:文件名只由服务端拼(pr + slug 过的条目 id + UTC 时刻)', up.text.slice(0, 120))
      ok(existsSync(join(kb, 'shots', up.json.shot)), '图确实在 shots/ 里')
      const m3 = await mark({ pr: 277, item: 'A"1', who: 'tester-b', shot: up.json.shot })
      ok(m3.status === 200 && m3.json.shot === up.json.shot, '刚上传的那张挂得到条目上')
      {
        const g = await req(srv.base, '/acceptance-feedback.jsonl')
        ok(g.status === 200 && String(g.headers.get('cache-control')).includes('no-store'),
          'jsonl 的 GET 带 no-store(轮询要新鲜)', String(g.headers.get('cache-control')))
        ok(String(g.headers.get('content-encoding') || '').includes('gzip'),
          'jsonl 也压(唯一每 20 秒重拉、又只增不删的那份文本,不该是唯一漏掉 gzip 的)',
          String(g.headers.get('content-encoding')))
        const rows = g.text.trim().split('\n').map((l) => JSON.parse(l))
        ok(rows.length === 4 && rows[0].who === 'tester-a' && rows[3].shot === up.json.shot,
          '追加式:先写的在前,后写的在后(含开关刚打开时那笔)', String(rows.length))
      }
      // 并发:六笔同时打,六行俱全、行行合法(O_APPEND 单次 write)
      {
        const before = readFileSync(jsonlP, 'utf8').split('\n').filter(Boolean).length
        await Promise.all([...Array(6)].map((_, i) =>
          mark({ pr: 277, item: 'JJ3', who: 'w' + i, verdict: i % 2 ? 'ok' : 'bad', note: '并发 ' + i })))
        const lines = readFileSync(jsonlP, 'utf8').split('\n').filter(Boolean)
        ok(lines.length === before + 6, '并发六笔 = 六行,一行不少', `${before} → ${lines.length}`)
        let allJson = true
        for (const l of lines) { try { JSON.parse(l) } catch { allJson = false } }
        ok(allJson, '并发之下每一行仍是完整 JSON(没有半行叠半行)')
      }
      // 坏行混进来:读的人跳过它,不阻断
      {
        writeFileSync(jsonlP, readFileSync(jsonlP, 'utf8') + '半行 {"pr":277\n')
        const g = await req(srv.base, '/acceptance-feedback.jsonl')
        const p = F.accFbParse(g.text)
        ok(p.bad === 1 && p.rows.length === 10, '坏行只被跳过并计数,前面的账一条不丢', `${p.rows.length} / ${p.bad}`)
      }
      // v0.17.1 撤回:判 → 撤回 → 再判,三条记录俱在,合并结果是最后那一次
      {
        const before = F.accFbParse(readFileSync(jsonlP, 'utf8')).rows.length // 上一段那条坏行不算
        const v1 = await mark({ pr: 277, item: 'JJ3', who: 'tester-c', verdict: 'ok' })
        const v2 = await mark({ pr: 277, item: 'JJ3', who: 'tester-c', verdict: 'none' })
        const v3 = await mark({ pr: 277, item: 'JJ3', who: 'tester-c', verdict: 'bad' })
        ok(v2.status === 200 && v2.json.verdict === 'none',
          'verdict:"none" 单独成一条就被收下(撤回本身就是内容,不必再搭一句备注)', `${v2.status} ${v2.text.slice(0, 120)}`)
        ok((await mark({ pr: 277, item: 'JJ3', who: 'tester-c' })).status === 400,
          '空 payload 照旧被拒(verdict / note / shot 至少要有一样 —— 这条门没被 none 放宽)')
        const g = await req(srv.base, '/acceptance-feedback.jsonl')
        const p = F.accFbParse(g.text)
        ok(p.rows.length === before + 3 && v1.status === 200 && v3.status === 200,
          '三条记录俱在:撤回是追加,不是抹(两个人同时验时看得见对方刚才判过)', `${before} → ${p.rows.length}`)
        const e = F.accFbMerge(p.rows)['277' + NUL + 'JJ3']
        ok(F.accFbLive(e, 2).verdicts['tester-c'] === 'bad' && F.accFbMineAt(e, 2, 'tester-c').v === 'bad',
          '合并取最新:撤回之后再判,读回来就是最后那一次', JSON.stringify(F.accFbLive(e, 2).verdicts))
        const only = await mark({ pr: 277, item: 'A"1', who: 'tester-c', verdict: 'none' })
        ok(only.status === 200 && F.accFbLive(F.accFbMerge(F.accFbParse(only.text).rows)['277' + NUL + 'A"1'], 2).verdicts['tester-c'] === undefined,
          '没判过就撤回:也收得下(账上多一条「我不再判它」),合并出来仍是未判', `${only.status} ${only.text.slice(0, 120)}`)
      }
      // 跨站门:别人的网页替你的浏览器来写,一行都不许落。
      // (排在最后:这一段自己也真写一行,不打扰上面那几条按行数点数的断言)
      {
        const before = readFileSync(jsonlP, 'utf8')
        const forge = (extra) => req(srv.base, '/api/acceptance/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...extra },
          body: JSON.stringify({ pr: 277, item: 'JJ3', who: 'tester-a', verdict: 'ok', note: '别人网页替我写的' }),
        })
        const f1 = await forge({ Origin: 'https://evil.example' })
        ok(f1.status === 403 && String(f1.json && f1.json.error).includes('Origin'),
          '跨站 Origin:403 —— 攻击者读不到回应,但那一票也不该落进账', `${f1.status} ${f1.text.slice(0, 90)}`)
        const f2 = await forge({ 'Sec-Fetch-Site': 'cross-site' })
        ok(f2.status === 403 && String(f2.json && f2.json.error).includes('Sec-Fetch-Site'),
          '浏览器盖的跨站戳:403(现代浏览器都发这个头)', `${f2.status} ${f2.text.slice(0, 90)}`)
        const f3 = await req(srv.base, '/api/acceptance/shot?pr=277&item=JJ3&who=tester-a',
          { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'Sec-Fetch-Site': 'same-site' }, body: JPG })
        ok(f3.status === 403, '图那条口同一道门(same-site 也不算同源)', `${f3.status} ${f3.text.slice(0, 90)}`)
        ok(readFileSync(jsonlP, 'utf8') === before, '被跨站门挡下的三笔:jsonl 一个字节没长')
        ok(readdirSync(join(kb, 'shots')).every((f) => !f.startsWith('acc-277-JJ3-')), '被挡下的那张图也没落盘')
        const good = await forge({ Origin: srv.base, 'Sec-Fetch-Site': 'same-origin' })
        ok(good.status === 200 && readFileSync(jsonlP, 'utf8').length > before.length,
          '同源浏览器那副戳(Origin 就是本服务 + same-origin):照旧写得进', `${good.status} ${good.text.slice(0, 90)}`)
      }
    } finally {
      srv.proc.kill('SIGKILL')
    }
  }

  // ---- 守卫:未提交的新增行 / 可清的截图 ----
  {
    const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: fx73.root, encoding: 'utf8' })
    writeFileSync(jsonlP, [
      '{"ts":"2026-09-10T12:00:00Z","pr":277,"item":"JJ3","who":"tester-a","rev":2,"verdict":"bad"}',
      '{"ts":"2026-09-10T12:01:00Z","pr":277,"item":"JJ3","who":"tester-a","rev":2,"note":"再一条"}',
      '{"ts":"2026-09-10T12:02:00Z","pr":277,"item":"JJ3","who":"tester-b","rev":2,"verdict":"ok"}',
      '',
    ].join('\n'))
    const s1 = runStop(NEW_SCRIPTS, fx73.root)
    const msg1 = (JSON.parse(s1.stdout || '{}').systemMessage) || ''
    ok(msg1.includes('#277 新增 3 条未提交') && msg1.includes('tester-a 2') && msg1.includes('tester-b 1'),
      '还没提交的 jsonl:守卫一行说清哪个 PR、几条、谁写的', msg1.slice(0, 200))
    git('add', '-A'); git('commit', '-q', '-m', 'feedback')
    const s2 = runStop(NEW_SCRIPTS, fx73.root)
    ok(!((JSON.parse(s2.stdout || '{}').systemMessage) || '').includes('验收反馈:'), '提交完就不再说(账已经进 git)')
    writeFileSync(jsonlP, readFileSync(jsonlP, 'utf8') +
      '{"ts":"2026-09-10T13:00:00Z","pr":277,"item":"JJ3","who":"tester-a","rev":2,"verdict":"ok"}\n')
    const s3 = runStop(NEW_SCRIPTS, fx73.root)
    ok(((JSON.parse(s3.stdout || '{}').systemMessage) || '').includes('#277 新增 1 条未提交'),
      '已跟踪文件后来又添的行,照样数得出来(git diff 认增行)')
    {
      const c5 = rd(cfgP)
      c5.acceptanceFeedback = false
      wr(cfgP, c5)
      const s4 = runStop(NEW_SCRIPTS, fx73.root)
      ok(!((JSON.parse(s4.stdout || '{}').systemMessage) || '').includes('验收反馈:'),
        '开关关着:这条通知一个字都不出(零命中不出声)')
      c5.acceptanceFeedback = true
      wr(cfgP, c5)
    }
    // 没有 git 的板:spec §4 写的是「无 git 时不报」,而 mkFixture 每个 fixture 都 git init 过 ——
    // tracked.error / rev-parse --is-inside-work-tree 那条回退路原来一条断言都没有,
    // 重构掉也不会有人红脸。这里连正对照一起摆:同一块板 git init 之后立刻就报得出来。
    {
      const ng = mkFixture('fx73ng', { 's.html': demoHtml('s') })
      rmSync(join(ng.root, '.git'), { recursive: true, force: true })
      const ngCfg = JSON.parse(readFileSync(join(ng.kb, 'kanban.config.json'), 'utf8'))
      ngCfg.acceptanceFeedback = true // 只开这一个:守卫那两条提醒只看它,清单不必在场
      writeFileSync(join(ng.kb, 'kanban.config.json'), JSON.stringify(ngCfg, null, 2) + '\n')
      writeFileSync(join(ng.kb, 'acceptance-feedback.jsonl'), [
        '{"ts":"2026-09-10T12:00:00Z","pr":277,"item":"JJ3","who":"tester-a","rev":2,"verdict":"bad"}',
        '{"ts":"2026-09-10T12:01:00Z","pr":277,"item":"JJ3","who":"tester-a","rev":2,"note":"再一条"}',
        '{"ts":"2026-09-10T12:02:00Z","pr":277,"item":"JJ3","who":"tester-b","rev":2,"verdict":"ok"}',
        '',
      ].join('\n'))
      const n1 = runStop(NEW_SCRIPTS, ng.root)
      ok(n1.status === 0 && !((JSON.parse(n1.stdout || '{}').systemMessage) || '').includes('验收反馈:'),
        '没有 git 的板:问不出「提交了没」,就一个字都不说(也不崩)', `${n1.status} ${n1.stdout.slice(0, 160)}`)
      execFileSync('git', ['init', '-q'], { cwd: ng.root })
      const n2 = runStop(NEW_SCRIPTS, ng.root)
      ok(((JSON.parse(n2.stdout || '{}').systemMessage) || '').includes('#277 新增 3 条未提交'),
        '同一块板 git init 之后立刻报得出来 —— 上面那句沉默是「问不出」,不是这盘摆坏了',
        (JSON.parse(n2.stdout || '{}').systemMessage || '').slice(0, 160))
    }
  }

  // ---- 可清的反馈截图:守卫报数,prune 脚本才动手 ----
  {
    // 30 天那条硬边界用固定日期单验(spec §5 要的就是固定日期):今天与合并日都写死,
    // 与本机时区、与跑测试的钟点都无关。下面摆盘那几张则离边界远远的 —— 守卫按本地日历日
    // 算龄,fixture 若也拿「今天」贴着 30 天摆,UTC 与本地差一天的那几个钟头里整套测试就是红的。
    const { prunable } = await import(join(NEW_SCRIPTS, 'acc-feedback-prune.mjs'))
    {
      const rlm = { prs: [{ number: 277, state: 'merged', mergedAt: '2026-08-11T00:00:00Z' },
        { number: 278, state: 'merged', mergedAt: '2026-08-12T00:00:00Z' },
        { number: 279, state: 'open', mergedAt: null }] }
      const files = ['acc-277-JJ3-20260910T120000.jpg', 'acc-278-JJ3-20260910T120000.jpg',
        'acc-279-JJ3-20260910T120000.jpg', 'd1-keep.png']
      const got = prunable(files, rlm, 30, '2026-09-10').map((r) => r.file)
      ok(got.length === 1 && got[0] === 'acc-277-JJ3-20260910T120000.jpg',
        '固定日期:合并满 30 天的可清,29 天的不可清,PR 还开着的不可清,非 acc- 的不入表', got.join(' '))
      ok(prunable(files, rlm, 29, '2026-09-10').length === 2, '窗口收到 29 天:第二张也进表(边界是 >=)')
    }
    const today = localDate() // 与守卫、与 prune 脚本同一把尺(本地日历日,不是 UTC)
    const daysAgo = (n) => new Date(Date.parse(today + 'T12:00:00Z') - n * 86400000).toISOString()
    wr(relP, {
      stages: [{ id: 'dev', label: 'dev', hint: '' }, { id: 'prod', label: 'prod', hint: '' }],
      releases: [],
      prs: [
        { number: 277, state: 'merged', mergedAt: daysAgo(40), title: 'a' },
        { number: 278, state: 'merged', mergedAt: daysAgo(20), title: 'b' },
        { number: 279, state: 'open', mergedAt: null, title: 'c' },
      ],
      syncedAt: null,
    })
    const shotsDir = join(kb, 'shots')
    for (const f of readdirSync(shotsDir)) rmSync(join(shotsDir, f)) // 冒烟那几张先清掉,这一段自己摆盘
    for (let i = 0; i < 10; i++) writeFileSync(join(shotsDir, `acc-277-JJ3-2026091${i}T120000.jpg`), 'x'.repeat(100))
    writeFileSync(join(shotsDir, 'acc-278-JJ3-20260910T120000.jpg'), 'x')
    writeFileSync(join(shotsDir, 'acc-279-JJ3-20260910T120000.jpg'), 'x')
    writeFileSync(join(shotsDir, 'd1-keep.png'), 'x')
    const s5 = runStop(NEW_SCRIPTS, fx73.root)
    const msg5 = (JSON.parse(s5.stdout || '{}').systemMessage) || ''
    ok(msg5.includes('10 张') && msg5.includes('acc-feedback-prune.mjs'),
      '攒够 10 张可清的:守卫一行报数 + 那条命令(绝不自动删)', msg5.slice(0, 200))
    const jsonlBefore = readFileSync(jsonlP, 'utf8')
    const dry = spawnSync(process.execPath, [join(NEW_SCRIPTS, 'acc-feedback-prune.mjs'), '--dir', kb, '--dry-run'], { encoding: 'utf8' })
    ok(dry.status === 0 && count(dry.stdout, '将删 shots/acc-277') === 10 && dry.stdout.includes('一个字节没动'),
      'dry-run 列出 10 张、盘上什么都没动', dry.stdout.slice(0, 200))
    ok(existsSync(join(shotsDir, 'acc-277-JJ3-20260910T120000.jpg')), 'dry-run 之后图还在')
    const run = spawnSync(process.execPath, [join(NEW_SCRIPTS, 'acc-feedback-prune.mjs'), '--dir', kb], { encoding: 'utf8' })
    ok(run.status === 0 && !existsSync(join(shotsDir, 'acc-277-JJ3-20260910T120000.jpg')),
      '不加 --dry-run 才真删(判据:PR 已合并满 30 天)', run.stdout.slice(0, 200))
    ok(existsSync(join(shotsDir, 'acc-278-JJ3-20260910T120000.jpg')), '合并才 20 天的:留着(边界本身在上面用固定日期验)')
    ok(existsSync(join(shotsDir, 'acc-279-JJ3-20260910T120000.jpg')), 'PR 还开着的:留着')
    ok(existsSync(join(shotsDir, 'd1-keep.png')), '非 acc- 的截图一张不碰(那些是进 git 的证据)')
    ok(readFileSync(jsonlP, 'utf8') === jsonlBefore, 'jsonl 一行没删 —— 图没了,那几行「谁说了什么」照旧在')
    const again = spawnSync(process.execPath, [join(NEW_SCRIPTS, 'acc-feedback-prune.mjs'), '--dir', kb, '--days', '60'], { encoding: 'utf8' })
    ok(again.status === 0 && again.stdout.includes('没有可清'), '换成 60 天窗口:一张都不该清', again.stdout.slice(0, 160))
  }

  // ---- 关回 false:与冻结基线逐字节相同 ----
  {
    const c6 = rd(cfgP)
    c6.acceptanceTab = true
    c6.acceptanceFeedback = false
    wr(cfgP, c6)
    rmSync(relP)
    for (const f of readdirSync(join(kb, 'shots'))) rmSync(join(kb, 'shots', f)) // 截图数会烤进 tab 徽章,清干净再比
    runGen(NEW_SCRIPTS, kb)
    ok(sha(idxP) === offSha, '关回 false 后与冻结基线逐字节相同')
  }
}

// ============ T70 英文串表(loadStrings 不做逐键回落:少一个键 = 守卫在收工那一刻 TypeError)============
// 整套测试里只有 T18 用过 lang:'en',而它测的是 gen 的另一张硬报错表 —— 守卫那几十个键一个都没被
// 调用过。strings.mjs 的 loadStrings 直接返回 tables[lang],不与 zh 合并;stop-hook 又没有顶层
// try/catch,所以 en 表少一个键 = 守卫以非零码崩在收工那一刻,而全套测试仍是绿的。
console.log('T70 英文串表')
{
  const { pickStrings } = await import(join(NEW_SCRIPTS, 'strings.mjs'))
  const zhT = pickStrings('zh'), enT = pickStrings('en')
  const miss = [], typ = [], ari = []
  const walk = (a, b, path) => {
    for (const k of Object.keys(a)) {
      const at = path ? `${path}.${k}` : k
      if (!(k in b)) { miss.push(at); continue }
      if (typeof a[k] !== typeof b[k]) { typ.push(`${at}:${typeof a[k]}≠${typeof b[k]}`); continue }
      if (typeof a[k] === 'function') { if (a[k].length !== b[k].length) ari.push(`${at}(${a[k].length}≠${b[k].length})`); continue }
      if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) walk(a[k], b[k], at)
    }
  }
  walk(zhT, enT, '')
  ok(miss.length === 0, 'en 表一个键都不缺(缺了就是 S.<key>(…) 打在 undefined 上)', miss.join(' '))
  ok(typ.length === 0 && ari.length === 0, '同名键的类型与函数入参个数也对得上', [...typ, ...ari].join(' '))

  // 真跑一趟 en 板的守卫:上面比的是键名,这里是把这一批新键实际调用一遍
  const fx = mkFixture('fx70', { 's.html': demoHtml('s') })
  const kb = fx.kb
  const rd = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const wr = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')
  const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  for (const f of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) {
    const x = rd(join(kb, f)); x.instance.ghRepo = 'o/r'; x.instance.branch = 'main'; wr(join(kb, f), x)
  }
  const rel = JSON.parse(JSON.stringify(REL_MANIFEST))
  rel.prs.find((p) => p.number === 227).mergedAt = `${dayAgo(1)}T01:00:00Z`
  wr(join(kb, 'release-manifest.json'), rel)
  const bl = rd(join(kb, 'backlog-manifest.json'))
  bl.tiers = { 1: 'core' }
  const b70 = { tier: '1', priority: 'high', area: 'x', source: 's', approach: 'a' }
  bl.items = [
    { id: 'BL-1', status: 'ready', title: 'long prose', ...b70, problem: 'x'.repeat(900) },       // richLongText
    { id: 'BL-2', status: 'ready', title: 'unsettled', ...b70, problem: 'p', pr: 226 },            // respSettle
    { id: 'BL-3', status: 'ready', title: 'held', ...b70, problem: 'p', pr: 227, settleHold: 'half landed', settleHoldAt: dayAgo(20) }, // respHoldOld
    { id: 'BL-4', status: 'ready', title: 'just unblocked', ...b70, problem: 'p', after: ['#227'] }, // depsUnlocked
  ]
  wr(join(kb, 'backlog-manifest.json'), bl)
  const cfg = rd(join(kb, 'kanban.config.json'))
  cfg.lang = 'en'; cfg.releaseTab = true; cfg.richText = true; cfg.wip = { soft: 0, hard: 0 }
  wr(join(kb, 'kanban.config.json'), cfg)
  runGen(NEW_SCRIPTS, kb)
  touch(join(kb, 'index.html'))
  const g = runStop(NEW_SCRIPTS, fx.root)
  ok(g.status === 0, 'lang:en 的板上,守卫跑得完(0.16.0 的 en 表少一个键就会在这里 TypeError)', g.stderr.slice(0, 300))
  let msg = ''
  try { msg = JSON.parse(g.stdout || '{}').systemMessage || '' } catch { msg = 'NOT-JSON: ' + g.stdout.slice(0, 200) }
  ok(!msg.startsWith('NOT-JSON'), 'stdout 是合法 JSON', msg.slice(0, 200))
  ok(/Kanban guard/.test(msg) && /Prerequisites cleared/.test(msg) && /On settle hold/.test(msg) && /prose field over 800/.test(msg),
    '这一批 0.15.x/0.16.x 新键真被调用了一遍(前置已清 / 挂账到期 / 长正文 / 积压)', msg.slice(0, 400))
  ok(!/[\u4e00-\u9fff]/.test(msg), 'en 板上的守卫通知里一个中文字都不该有', (msg.match(/[\u4e00-\u9fff][^\n]{0,60}/) || [''])[0])
}

console.log(`\n===== 结果:${pass} pass / ${fail} fail =====`)
if (fail) { console.error(`现场保留:${WORK}`); process.exit(1) }
rmSync(WORK, { recursive: true, force: true })
