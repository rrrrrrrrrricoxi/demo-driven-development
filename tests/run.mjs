#!/usr/bin/env node
// 守卫/生成器对抗测试床(npm test 入口;零依赖,Node 18+)。
// 源自 0.6.0 发版前的对抗验证(旧版盖板事故的攻击者 testPlan 可执行版),88 条断言:
// 时光机(真实 v0.2.1 标本盖板 → 新守卫自愈)、拒降级、版本文法、backnav 剥离/回捞、
// retire 注册守卫、byte-freeze 归一化、<pre> 误伤、全新项目首跑等。
// 时光机标本 = tests/fixtures/legacy-0.2.1(字节级取自 v0.2.1 tag,出处见其 README)。
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const HERE_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE_DIR, '..')
const NEW_SCRIPTS = join(REPO, 'scripts')
const OLD_DIR = join(HERE_DIR, 'fixtures', 'legacy-0.2.1')
const WORK = mkdtempSync(join(tmpdir(), 'ddd-tests-'))
const MY_VER = JSON.parse(readFileSync(join(REPO, '.claude-plugin/plugin.json'), 'utf8')).version

let pass = 0, fail = 0
const ok = (cond, name, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ FAIL ${name}${detail ? ` —— ${detail}` : ''}`) }
}
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const count = (s, sub) => s.split(sub).length - 1

// ---- v2 默认块(逐字节抄 v0.2.1 gen 源)与 demo 素材 ----
const V2_BLOCK = `<!-- lamos-b-backnav v2 -->
<style id="lamos-b-backnav-style">
 body{padding-top:44px}
 #lamos-b-backnav{position:fixed;top:0;left:0;right:0;height:44px;z-index:9999;display:flex;align-items:center;gap:10px;padding:0 16px;background:#f6f5f2;border-bottom:1px solid #e3e2e0;font:13px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
 #lamos-b-backnav a{display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:600;color:#2383e2;border:1px solid #e3e2e0;border-radius:8px;padding:5px 11px;background:#fff}
 #lamos-b-backnav a:hover{border-color:#2383e2}
 #lamos-b-backnav .ctx{color:#6f6e6b;font-size:12px}
</style>
<nav id="lamos-b-backnav"><a href="../index.html#decisions">← 返回看板</a><span class="ctx">LAMOS Demo · mock 数据</span></nav>`
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
    ok(count(readDemo(fx1.kb, f), '<!-- ddd-backnav v3 -->') === 1 && !readDemo(fx1.kb, f).includes('lamos-b'), `${f} 恰一个 v3 块`)
  const r2 = runGen(NEW_SCRIPTS, fx1.kb)
  ok(r2.status === 0 && r2.stdout.includes('(3 已是当前版)'), '重跑幂等:3 demo 全 skip', r2.stdout)
}

// ============ T1/T12 时光机复现 + 自愈 + 乒乓终止 ============
console.log('T1/T12 时光机:旧 gen 盖板 → 新守卫自愈 → shim 断火')
{
  // 给 d2 做手工件:自定义回跳锚 + 真数据注记(改注入后的 v3 块)
  let d2 = readDemo(fx1.kb, 'd2.html')
  d2 = d2.replace('href="../index.html#decisions"', 'href="../index.html#UXC47"')
         .replace(/<span class="ctx">[\s\S]*?<\/span>/, '<span class="ctx">真实台账数据 · 台账镜像</span>')
  writeFileSync(join(fx1.kb, 'demos/d2.html'), d2)
  // 旧 session 记账:touch manifest → 旧 stop-hook(v0.2.1 标本)重跑旧 gen
  touch(join(fx1.kb, 'manifest.json'))
  const rOld = runStop(join(OLD_DIR, 'scripts'), fx1.root)
  ok(rOld.status === 0, '旧 0.2.1 stop-hook 跑通(exit 0)', `${rOld.status} ${rOld.stderr}`)
  const idxAfterOld = readFileSync(join(fx1.kb, 'index.html'), 'utf8')
  ok(!idxAfterOld.includes('<!-- ddd-gen v'), 'bug 复现:旧 gen 盖板,戳消失')
  const d1AfterOld = readDemo(fx1.kb, 'd1.html')
  ok(d1AfterOld.includes('lamos-b-backnav v2') && d1AfterOld.includes('ddd-backnav v3'), 'bug 复现:d1 双块(v2 叠 v3)')
  // 新守卫自愈:mtime 全新鲜,只有戳能触发
  const rNew = runStop(NEW_SCRIPTS, fx1.root)
  ok(rNew.status === 0, '新 stop-hook exit 0', rNew.stderr)
  const idxHealed = readFileSync(join(fx1.kb, 'index.html'), 'utf8')
  ok(idxHealed.includes(`<!-- ddd-gen v${MY_VER} -->`), '自愈:戳回来了(纯靠戳判过期,mtime 是新鲜的)')
  for (const f of ['d1.html', 'd2.html', 'd3.html']) {
    const c = readDemo(fx1.kb, f)
    ok(!c.includes('lamos-b-backnav'), `自愈:${f} 零 v2 残留`)
    ok(count(c, '<!-- ddd-backnav v3 -->') === 1, `自愈:${f} 恰一个 v3 块`)
  }
  const d2Healed = readDemo(fx1.kb, 'd2.html')
  ok(d2Healed.includes('#UXC47') && d2Healed.includes('真实台账数据 · 台账镜像'), '自愈:d2 手工件存活(锚+真数据注记,未被 v2 默认块顶掉)')
}

// ============ T2 回捞顺序双向 ============
console.log('T2 手工件回捞:两种块序都存活')
{
  const blk3 = readDemo(fx1.kb, 'd2.html').match(/<!-- ddd-backnav v3 -->[\s\S]*?<\/nav>/)[0]
  const mk = (order) => demoHtml('dx').replace('<body>', order === 'v2first' ? `<body>\n${V2_BLOCK}\n${blk3}` : `<body>\n${blk3}\n${V2_BLOCK}`)
  const fx2 = mkFixture('fx2', { 'a.html': mk('v2first'), 'b.html': mk('v3first') })
  const r = runGen(NEW_SCRIPTS, fx2.kb)
  ok(r.status === 0, 'gen exit 0', r.stderr)
  for (const f of ['a.html', 'b.html']) {
    const c = readDemo(fx2.kb, f)
    ok(!c.includes('lamos-b-backnav') && count(c, '<!-- ddd-backnav v3 -->') === 1, `${f} 归一为一个 v3 块`)
    ok(c.includes('#UXC47') && c.includes('真实台账数据 · 台账镜像'), `${f} 自定义件存活(顺序=${f === 'a.html' ? 'v2 在上' : 'v3 在上'})`)
  }
}

// ============ T3 /g 剥净 + 同版双块 ============
console.log('T3 多块剥净')
{
  const blk3def = readDemo(fx1.kb, 'd1.html').match(/<!-- ddd-backnav v3 -->[\s\S]*?<\/nav>/)[0]
  const fx3 = mkFixture('fx3', {
    'c.html': demoHtml('c').replace('<body>', `<body>\n${V2_BLOCK}\n${V2_BLOCK}\n${blk3def}`),
    'd.html': demoHtml('d').replace('<body>', `<body>\n${blk3def}\n${blk3def}`),
  })
  const r = runGen(NEW_SCRIPTS, fx3.kb)
  ok(r.status === 0, 'gen exit 0', r.stderr)
  const c = readDemo(fx3.kb, 'c.html'), d = readDemo(fx3.kb, 'd.html')
  ok(!c.includes('lamos-b-backnav') && count(c, '<!-- ddd-backnav v3 -->') === 1, 'c.html [v2,v2,v3] → 恰一个 v3')
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
  cpSync(OLD_DIR, join(pdir2, '0.2.1'), { recursive: true })
  cpSync(OLD_DIR, join(pdir2, '0.3.0'), { recursive: true })
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
  cpSync(OLD_DIR, join(pdir, '0.2.1'), { recursive: true })
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

console.log(`\n===== 结果:${pass} pass / ${fail} fail =====`)
if (fail) { console.error(`现场保留:${WORK}`); process.exit(1) }
rmSync(WORK, { recursive: true, force: true })
