#!/usr/bin/env node
// 守卫/生成器对抗测试床(npm test 入口;零依赖,Node 18+)。560 条断言:
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
// 链接顺手写 pr / export 与拆分前的 manifest 深比较相等 / 只读目录下原文件零改动)等。
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
const runStop = (scriptsDir, root) =>
  spawnSync(process.execPath, [join(scriptsDir, 'stop-hook.mjs')], { encoding: 'utf8', input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: root } })
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
  // 两个 tab 同开:验收列长出 n/N 与「验收中」标
  cfg.acceptanceTab = true
  wr(cfgP, cfg)
  writeFileSync(accP, JSON.stringify({ current: 230, lists: [ACC_LIST] }))
  const r2 = runGen(NEW_SCRIPTS, fx31.kb)
  ok(r2.status === 0, '两个 tab 同开 gen exit 0', r2.stderr)
  const both = readFileSync(idxP, 'utf8')
  ok(both.includes('<a class="acclink" href="#acc-230"><span data-acc="230">0/4</span></a>'), '验收列 = n/N 链到清单锚(分母烤入,分子运行期)')
  ok(/id="pr-230"[\s\S]{0,400}?<span class="relnow">验收中<\/span>/.test(both), 'current 那行打「验收中」标')
  { // 整壳 <script> 编译级断言:发布进度运行时与验收运行时在同一块里
    const sc = both.match(/<script>([\s\S]*?)<\/script>/g).map((s) => s.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    let compiled = true
    for (const body of sc) { try { new Function(body) } catch (e) { compiled = false } }
    ok(compiled, 'ON 壳内联 JS 可编译(new Function 不抛)')
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
  ok(on.includes('<div class="lite lpre">') && on.includes('<div class="lite lfull" hidden>') &&
    /class="litemore" data-rest="\d+">展开 · 还有 \d+ 字</.test(on), '超 400 字的字段烤成预览 + 全文两份 + 展开钮')
  ok(count(on, '<div class="lite lpre">') === 1 && on.includes('<div class="lite"><p>' + 'x'.repeat(700)),
    '首段自己就超 400 的字段不烤预览:整篇一份,交给高度折叠 —— 与「整篇一段」同一种处置')
  ok(on.includes('<div class="notes">') && !on.includes('<p class="notes">'), 'notes 容器换成 <div>(<p> 里塞不进 <p>/<ul>,解析器会当场闭合)')
  ok(on.includes('dd.demonote, div.notes') && on.includes("if (el.querySelector('.lfull'))"), 'clampScan 认 div.notes,并给拆过两份的字段让路(两套折叠不叠加)')
  ok(on.includes('<dd class="lsrc"><span class="bbadge src"><p>用户 <b>口述</b></p></span></dd>'), '决策卡 source 补渲染成同款小徽章(0.12.0 前是死数据)')
  ok(on.includes('<dd class="decided"><div class="lite"><p>✓ 就这么定</p></div></dd>'), '结论行的 ✓ 落进第一段,不自成一行')
  ok(on.includes('<span class="bbadge src">s</span>'), 'backlog 自己的 source 芯片仍是纯 esc(它是一枚短标签,不是正文)')
  ok(on.includes('.lite ol.circ') && on.includes('.litemore {') && on.includes('.detail > summary'), 'CSS 片段挂上尾链')
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
  ok(g1.status === 0 && /BL-1 的 approach 有 900 字/.test(g1.stdout), '超 800 字且无 detail → 一条非阻断 notice,点名到字段', `${g1.status} ${g1.stdout.slice(0, 260)}`)
  bl.items[0].detail = '证据都在这儿'
  wr(blP, bl)
  runGen(NEW_SCRIPTS, fx35.kb)
  touch(idxP)
  const g2 = runStop(NEW_SCRIPTS, fx35.root)
  ok(g2.status === 0 && !/approach 有 900 字/.test(g2.stdout), '卡上有了 detail 就不再点名')
  delete bl.items[0].detail
  wr(blP, bl)
  cfg.richText = false
  wr(cfgP, cfg)
  runGen(NEW_SCRIPTS, fx35.kb)
  touch(idxP)
  const g3 = runStop(NEW_SCRIPTS, fx35.root)
  ok(g3.status === 0 && !/approach 有 900 字/.test(g3.stdout), 'richText 关着时不做正文长度审计(detail 本就不渲染,催也白催)')

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
  ok(on.includes("Date.parse(el.getAttribute('data-dorm')") && on.includes('沉睡 ') && on.includes('d <= 30'),
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
  const { relAxis, relTicks, relBar, relPack, relGrid, relBandH } = await import(join(NEW_SCRIPTS, 'relgeom.mjs'))
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
}
{ // gen 侧:带的烤入 / 视图钮 / 几何内联 / 关档冻结
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
  ok(on.includes('data-relwin="60">近 60 天') && on.includes('data-relwin="all">全部'), '窗口芯片沿用近 60 天 / 全部')
  ok(!on.includes('reltlsvg') && !on.includes('rect.relb') && !on.includes('id="reltip"'),
    '旧时间线的 SVG 与浮层一个不留(死代码不留在产物里)')
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
  ok(cardOf('BL-H').includes('<span class="rspchip rsp-hold" title="这一轮 PR 只落了 &lt;接口&gt; &amp; &quot;壳&quot;">暂不收账</span>'),
    'backlog 卡:灰芯片「暂不收账」,理由 esc 进 title', (cardOf('BL-H').match(/rsp-hold[^>]*>[^<]*/) || [''])[0])
  ok(!cardOf('BL-H').includes('rsp-settle'), 'hold 卡不再出「PR 已合 · 待收账」')
  ok(cardOf('BL-S').includes('rsp-settle'), '同一个 PR 上没写 settleHold 的卡照旧催')
  ok(cardOf('BL-RH').includes('rsp-hold') && !cardOf('BL-RH').includes('rsp-reopen'), '反向提示同样被 settleHold 按下')
  ok(cardOf('BL-R').includes('rsp-reopen'), '没写字段的反向卡照旧提示')
  ok(cardOf('D-H').includes('rsp-hold') && !cardOf('D-H').includes('rsp-settle'), '决策卡:同一枚灰芯片')
  ok(cardOf('T-H').includes('rsp-hold') && !cardOf('T-H').includes('rsp-settle'), '进度 task 卡:同一枚灰芯片')
  ok(on.includes('.rsp-part, .rsp-hold {'), '灰芯片与「2/3 已合」同一套安静配色,不引新强调色')
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
    const { cfgP } = seed(kb)
    const cfg = rd(cfgP)
    cfg.wip = { soft: 0, hard: 0 }
    wr(cfgP, cfg)
    const r = runCli(kb, ['card', 'new', 'backlog', '--title', '又一张'])
    ok(r.status === 0 && /config\.wip\.hard = 0/.test(r.stderr), 'card new 之后 ready 超 hard:stderr 上一句与守卫同款的提醒')
    ok(!/config\.wip\.hard/.test(r.stdout), '提醒走 stderr,不脏 --json 的管道')
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
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  ok(idx.includes(`data-doc="c.html" data-line="" data-updated="${todayStr}"`), '没提交过的文档退回文件 mtime(降级链没断)')
  const shots = readFileSync(join(kb, 'shots.html'), 'utf8')
  ok(shots.includes('>d1-one.png</span><span class="dt">2026-03-01<'), '截图取自己那次提交日')
  ok(shots.includes('>d1-two.png</span><span class="dt">2026-04-02<'), '同一批里另一张截图各归各的日期')
  writeFileSync(join(kb, 'shots', 'd1-three.png'), 'z') // untracked
  runGen(NEW_SCRIPTS, kb)
  ok(readFileSync(join(kb, 'shots.html'), 'utf8').includes(`>d1-three.png</span><span class="dt">${todayStr}<`), '没提交过的截图退回文件 mtime')
}

console.log(`\n===== 结果:${pass} pass / ${fail} fail =====`)
if (fail) { console.error(`现场保留:${WORK}`); process.exit(1) }
rmSync(WORK, { recursive: true, force: true })
