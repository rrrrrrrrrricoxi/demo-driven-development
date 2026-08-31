#!/usr/bin/env node
// 看板守卫(Claude Code Stop hook,零依赖)。CC 每次收工前自动运行,做两件事:
//
//   1. 新鲜度:manifest / demos/*.html / theme.css(v0.4.0 换装,可缺席)/ gen.mjs
//      任一比 index.html 新 → 自动重跑 gen.mjs,看板即刻最新,无需人发「更新看板」prompt。
//      (plugin 期:gen.mjs 与本脚本同目录;尚未落地时跳过本段,只做审计。)
//      v0.6.0 起叠加版本戳维度(防旧版盖板):mtime 分不出「谁写的」——旧版 session 的旧 gen 盖完板
//      产物反而最新。戳缺失/低于本 plugin 版 = 旧 gen 产物 → 视为过期重跑(自愈,与 mtime OR);
//      戳高于本 plugin 版 = 本 session 才是旧的 → 一票否决重生成(含 mtime 判过期),出警告但
//      绝不 exit 2——「重启我自己」是 Claude 修不了的状态,阻断只会造死循环。审计(只读)照做。
//   2. 审计:demos/*.html 凡未被任何 *.json manifest 引用、且不在 demos/.no-card-ok
//      豁免名单(一行一个文件名)的,即「孤儿 demo」→ 阻断收工,要求当场补卡。
//      v0.10.0 起认「合订引用」:被已豁免 demo 用 iframe(data-src/src)内嵌的同目录子页
//      不算孤儿,逐层传递——合订页挂卡即可,子页不必挂占位链接(见 docs/demo-binding.md)。
//      防死循环:同一次收工最多拦一次(stop_hook_active 时只警告并放行)。
//   3. 验收审计(v0.12.0,只在 config.acceptanceTab 开且 acceptance-manifest.json 在场时):
//      current 指向的 PR 没清单 / 同一 PR 落进两份清单 / 条目 id 重复 / cards 引用不存在的卡号,
//      各出一条非阻断 notice;清单 JSON 坏了也只报一条,不崩、不拦。
//   4. 正文长度审计(v0.13.0,只在 config.richText 开时):某长文本字段 > 800 字且卡无 detail
//      字段 → 一条非阻断 notice(摘要与细节分家的写法规矩见 ddd-workflow)。
//      v0.15.6 起跳过终态卡(TERMINAL,与 settle.mjs 同一份口径):已 done / live / closed 的卡
//      不会再改写,点名它们只会让这条通知永远缩不掉。
//      v0.15.7 起这条通知只一行:张数 + 最长的那张(卡号 + 字段),不铺逐卡清单、不报字数。
//   5. 进度响应审计(v0.13.0,只在 release-manifest.json 在场时):关联 PR 全合了却没收账的卡、
//      已收账却还有 PR 开着的卡,各出一条非阻断 notice(各最多点名 5 张 + 总数)。收账动作在
//      pr-sync.mjs --settle,守卫只提示 —— 静默改 manifest 会跟并行会话抢写。
//   6. 卡文件审计(v0.14.0,只在 config.cardsDir 开时):文件名与卡里的 id 不符 / JSON 解析失败
//      → 点名文件(各最多 5 个 + 总数)。这几种 gen 会硬失败,但一次只报得出第一个。
//      同一个键还让新鲜度盯住 <cardsDir>/**/*.json(卡也是 gen 输入)、让孤儿语料纳入卡文件正文。
//
// plugin 化改造(设计 §6):
//   - 反向探测:detect() 找不到 kanban.config.json → 静默 exit 0(非 DDD 项目零打扰)。
//   - 看板目录有 .init-lock(kanban-init --apply 进行中)→ 放行本轮。
//   - 消息文案走 strings.mjs(zh/en,按 config.lang 选)。
//
// 手测:echo '{}' | node scripts/stop-hook.mjs
// 接线:hooks/hooks.json → Stop
// ponytail: 新鲜度只盯 manifest/demos/gen.mjs 自身,不追 gen 引用的全仓 docs/*.md;
// 纯文档改动导致的 refs/ 过期仍需人跑 gen——要堵再解析 REF_DOCS。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { cmpVer, readPluginVersion, readStamp } from './lib-version.mjs'
import { loadStrings } from './strings.mjs'
import { prsOfCard } from './prlink.mjs'
import { TERMINAL, settleHold, settleOf } from './settle.mjs'
import { CARD_KINDS, cardsDirOf, scanCardDir } from './cards.mjs'

const KANBAN = detect()
if (!KANBAN) process.exit(0)
if (existsSync(join(KANBAN, '.init-lock'))) process.exit(0)

const S = loadStrings(KANBAN)
const DEMOS = join(KANBAN, 'demos')
const GEN = join(dirname(fileURLToPath(import.meta.url)), 'gen.mjs')

let hook = {}
if (!process.stdin.isTTY) {
  try { hook = JSON.parse(readFileSync(0, 'utf8')) } catch {}
}

const mtime = (p) => { try { return statSync(p).mtimeMs } catch { return 0 } }
const manifests = readdirSync(KANBAN).filter((f) => f.endsWith('.json'))
let demos = []
try { demos = readdirSync(DEMOS).filter((f) => f.endsWith('.html')) } catch {}

// 非阻断通知(戳警告 / 安装异常 / 自愈提示),最终与审计结果合并成单条 JSON 输出
const notices = []

// ---- 一卡一文件(v0.14.0,config.cardsDir):扫一遍卡目录,新鲜度/孤儿语料/下面几段审计共用 ----
// 未配 cardsDir = 全为空,一切照旧。
let CARDS_DIR = ''
try { CARDS_DIR = cardsDirOf(JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8'))) } catch {}
const cardScan = {} // sub → scanCardDir 的结果
const cardWatch = [] // 新鲜度要盯的路径:两个子目录本身(增删改名会动目录 mtime)+ 每个卡文件
if (CARDS_DIR) {
  for (const k of CARD_KINDS) {
    const dir = join(KANBAN, CARDS_DIR, k.sub)
    const s = scanCardDir(dir)
    cardScan[k.sub] = s
    if (s.missing) continue
    cardWatch.push(dir, ...s.files.map((f) => join(dir, f)))
  }
}
/** 卡的读法一处定:cardsDir 开 = 逐文件,关 = 头文件里的数组(下面几段审计共用) */
const cardsOf = (file, key, sub) => {
  if (CARDS_DIR && sub) {
    const s = cardScan[sub]
    return s && !s.missing ? s.cards.map((x) => x.card) : []
  }
  try { return JSON.parse(readFileSync(join(KANBAN, file), 'utf8'))[key] || [] } catch { return [] }
}
const CARD_SOURCES = [['manifest.json', 'tasks', null], ['backlog-manifest.json', 'items', 'backlog'], ['decisions-manifest.json', 'entries', 'decisions']]

// 卡文件审计:gen 遇到这些直接 throw,但一次只报得出第一个;这里一次列全,少来回几趟。
// 排在新鲜度之前 —— 正是这些错会让下面那趟 gen 失败,消息得赶在那之前备好。
{
  const idBad = [], parseBad = []
  for (const k of CARD_KINDS) {
    const s = cardScan[k.sub]
    if (!s) continue
    const rel = `${CARDS_DIR}/${k.sub}`
    if (s.missing) { notices.push(S.cardsDirMissing(rel)); continue }
    for (const x of s.bad) {
      if (x.kind === 'parse') parseBad.push({ file: `${rel}/${x.file}`, message: x.message })
      else idBad.push({ file: `${rel}/${x.file}`, id: x.id })
    }
  }
  if (idBad.length) notices.push(S.cardIdBad(idBad.slice(0, 5), idBad.length))
  if (parseBad.length) notices.push(S.cardParseBad(parseBad.slice(0, 5), parseBad.length))
}

// ---- ① 新鲜度 → 自动重跑 gen(gen.mjs 未随 plugin 落地时跳过) ----
if (existsSync(GEN)) {
  const indexPath = join(KANBAN, 'index.html')
  const indexAt = mtime(indexPath)
  const newest = Math.max(
    mtime(GEN),
    mtime(join(KANBAN, 'theme.css')), // v0.4.0 换装:theme 是 gen 输入;缺席时 mtime=0,零影响
    ...manifests.map((f) => mtime(join(KANBAN, f))),
    ...demos.map((f) => mtime(join(DEMOS, f))),
    ...cardWatch.map(mtime), // v0.14.0 一卡一文件:卡也是 gen 输入;未配 cardsDir 时为空,零影响
  )
  // v0.11.0:lazyTabs 板若 parts/ 缺件(手删/半拷贝),index 再新也是残废态 → 视同过期重跑自愈
  // v0.14.0:归档是 0.13.0 起的第三个 part —— 漏掉它,深链到已归档的卡就静默落空,而 index 是
  // 新的,守卫永远不会重跑。门控照 gen:backlogArchive 开着才有 archive.html。
  let lazyBroken = false
  try {
    const c = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8'))
    // v0.15.0:验收与发布进度也进了 parts,门控照 gen(各自的 tab 开着才有那一份)
    const parts = ['decisions.html', 'backlog.html', ...(c.backlogArchive === true ? ['archive.html'] : []),
      ...(c.acceptanceTab === true ? ['acceptance.html'] : []), ...(c.releaseTab === true ? ['release.html'] : [])]
    lazyBroken = c.lazyTabs === true && !parts.every((f) => existsSync(join(KANBAN, 'parts', f)))
  } catch {}
  const myVer = readPluginVersion() // null = 安装异常(plugin.json 缺失/损坏/非纯数字版本)
  const stamp = readStamp(indexPath) // 版本串 | null(有产物无戳=旧 gen 产物)| undefined(无产物,首跑)
  const stampNewer = Boolean(myVer && stamp && cmpVer(stamp, myVer) > 0)
  const stampStale = Boolean(myVer && stamp !== undefined && (stamp === null || cmpVer(stamp, myVer) < 0))
  if (stampNewer) {
    notices.push(S.stampNewer(stamp, myVer)) // 只否决重生成;审计(只读)在下面照做
  } else if (!myVer) {
    // gen 读不到自身版本必硬失败——别 spawn 一个注定 exit 2 的 gen 造不可自修的阻断循环
    if (newest > indexAt) notices.push(S.noSelfVersion())
  } else if (newest > indexAt || stampStale || lazyBroken) {
    const r = spawnSync(process.execPath, [GEN], { cwd: KANBAN, stdio: ['ignore', 'ignore', 'pipe'] })
    const err = (r.stderr || r.error?.message || '').toString()
    if (r.status !== 0) {
      // gen 只报得出第一个坏卡,已攒下的 notice(坏卡清单等)一并喂回去,免得一个一个试
      const why = S.genFail(err.slice(0, 800)) + (notices.length ? '\n' + notices.join('\n') : '')
      if (hook.stop_hook_active) { // 防死循环:同一次收工已拦过 → 降级警告放行
        console.log(JSON.stringify({ systemMessage: why }))
        process.exit(0)
      }
      process.stderr.write(why)
      process.exit(2) // 阻断:stderr 喂回给 Claude 自修(manifest 语法错等可修项)
    }
    // gen 成功但带警告(themeColors 未知色组/键、sessionTags 灰章、空 theme.css、指南过大、md 退化…)→ 原样透传,别吞
    if (err.trim()) process.stderr.write(err)
    // 自愈自「无戳产物」= 刚被旧 gen 盖过板(或 0.6.0 前存量)的签名 → 现场指向断火源解药
    if (stampStale && stamp === null) notices.push(S.healedUnstamped())
  }
}

// ---- ② 孤儿 demo 审计 ----
// 语料 = 三份 manifest + 卡文件(cardsDir 开着时 demo 链接就写在卡里,不纳入即全员误报孤儿)
const corpus = manifests
  .map((f) => { try { return readFileSync(join(KANBAN, f), 'utf8') } catch { return '' } })
  .concat(cardWatch.map((p) => { try { return readFileSync(p, 'utf8') } catch { return '' } }))
  .join('\n')
let allow = []
try {
  allow = readFileSync(join(DEMOS, '.no-card-ok'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
} catch {}
// 合订引用(v0.10.0):被已豁免 demo 用 iframe 内嵌的同目录子页随之豁免,逐层传递(合订页可再被合订)。
// 只认同目录裸文件名引用(同源内嵌是合订术前提;带路径/锚/查询串的不认),引用断了照常报孤儿。
const IFRAME_REF_RE = /<iframe\b[^>]*?\b(?:data-src|src)\s*=\s*(?:"([^"#?]+)"|'([^'#?]+)')/gi
const refsOf = new Map()
for (const f of demos) {
  let html = ''
  try { html = readFileSync(join(DEMOS, f), 'utf8') } catch { continue }
  const set = new Set()
  for (const m of html.matchAll(IFRAME_REF_RE)) {
    const t = (m[1] ?? m[2]).trim().replace(/^\.\//, '')
    if (t && !t.includes('/') && t.endsWith('.html') && t !== f) set.add(t)
  }
  if (set.size) refsOf.set(f, set)
}
const covered = new Set(demos.filter((f) => corpus.includes(f) || allow.includes(f)))
for (let grew = true; grew;) {
  grew = false
  for (const [f, set] of refsOf) {
    if (!covered.has(f)) continue
    for (const t of set) if (!covered.has(t) && demos.includes(t)) { covered.add(t); grew = true }
  }
}
const orphans = demos.filter((f) => !covered.has(f))

// ---- ③ 验收审计(v0.12.0):acceptanceTab 开 + 清单在场才跑,全部非阻断 notice ----
// 清单是人写的正文,坏一条不该拦收工;这里只负责「让人看见」,gen 侧另有同款 console.warn。
{
  let accOn = false
  try { accOn = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8')).acceptanceTab === true } catch {}
  const accPath = join(KANBAN, 'acceptance-manifest.json')
  if (accOn && existsSync(accPath)) {
    let acm = null
    try { acm = JSON.parse(readFileSync(accPath, 'utf8')) }
    catch (e) { notices.push(S.accParseFail(e.message)) }
    if (acm) {
      const lists = (acm.lists || []).map((l) => {
        const nums = (Array.isArray(l.pr) ? l.pr : [l.pr]).map(Number).filter((n) => Number.isFinite(n) && n > 0)
        return { ...l, nums, key: nums.join('-') }
      })
      const cur = acm.current == null ? null : Number(acm.current)
      if (cur !== null && !lists.some((l) => l.nums.includes(cur))) notices.push(S.accCurrentNoList(cur))
      const owner = new Map()
      for (const l of lists) for (const n of l.nums) {
        if (owner.has(n)) notices.push(S.accDupPr(n, owner.get(n), l.key))
        else owner.set(n, l.key)
      }
      // 卡号全集:三份 manifest 的 tasks / items / entries(cardsDir 开着时后两者来自卡目录)
      const ids = new Set()
      for (const [f, k, sub] of CARD_SOURCES) {
        for (const c of cardsOf(f, k, sub)) if (c && c.id) ids.add(String(c.id))
      }
      for (const l of lists) {
        const seen = new Set()
        for (const it of l.items || []) {
          const id = String((it || {}).id ?? '')
          if (seen.has(id)) notices.push(S.accDupItem(l.key, id))
          seen.add(id)
        }
        for (const c of l.cards || []) if (!ids.has(String(c))) notices.push(S.accUnknownCard(l.key, c))
      }
    }
  }
}

// ---- ④ 正文长度审计(v0.13.0,只在 config.richText 开时跑):超长字段而无 detail 的卡记数 ----
// detail 字段本身受 richText 门控,没开的板催也白催。全部非阻断 —— 正文长短是写法问题,不是错误。
// 通知只一行(v0.15.7):张数 + 最长的那张,逐卡清单与字数在终端里是噪音,写法规矩在 skills 里。
{
  let richOn = false
  try { richOn = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8')).richText === true } catch {}
  if (richOn) {
    const LONG = 800
    let total = 0, worst = null // 一行通知只需要这两样:张数,与最长的那张(卡号 + 字段)
    for (const [f, k, sub, fields] of [
      ['manifest.json', 'tasks', null, ['problem', 'approach', 'notes']],
      ['backlog-manifest.json', 'items', 'backlog', ['problem', 'approach', 'note']],
      ['decisions-manifest.json', 'entries', 'decisions', ['question', 'decision', 'demoNote', 'source']],
    ]) {
      for (const c of cardsOf(f, k, sub)) {
        if (!c || c.detail) continue
        if (TERMINAL.has(String(c.status || ''))) continue // 终态卡(done / live / closed)不会再改写,点名只会让这条通知永远缩不掉
        let hit = null // 一张卡只算一次,取最长的那个字段
        for (const key of fields) {
          const n = typeof c[key] === 'string' ? c[key].length : 0
          if (n > LONG && (!hit || n > hit.n)) hit = { key, n }
        }
        if (!hit) continue
        total++
        if (!worst || hit.n > worst.n) worst = { id: String(c.id ?? '?'), key: hit.key, n: hit.n }
      }
    }
    if (total) notices.push(S.richLongText(worst, total))
  }
}

// ---- ⑤ 进度响应审计(v0.13.0,只在 release-manifest.json 在场时跑):待收账 / 已收账但 PR 未合 ----
// 与卡上的芯片同一口径(settle.mjs),两边都只提示 —— 「PR 合了」≠「卡可以收」,静默改 manifest
// 会跟并行会话抢写。收账走 pr-sync.mjs --settle(默认还只打印)。
{
  const relPath = join(KANBAN, 'release-manifest.json')
  if (existsSync(relPath)) {
    let rlm = null
    try { rlm = JSON.parse(readFileSync(relPath, 'utf8')) } catch {} // 坏 JSON:gen 已经出过声,守卫不重复吵
    const relPr = new Map()
    for (const p of (rlm && rlm.prs) || []) if (p && p.number != null) relPr.set(Number(p.number), p)
    const settle = [], reopen = []
    if (relPr.size) {
      for (const [f, k, sub] of CARD_SOURCES) {
        let data = null
        try { data = JSON.parse(readFileSync(join(KANBAN, f), 'utf8')) } catch { continue }
        const repo = String((data.instance || {}).ghRepo || '') // instance 始终在头文件里,与卡拆不拆无关
        if (!repo) continue
        for (const c of cardsOf(f, k, sub)) {
          if (!c || !c.id || settleHold(c)) continue // settleHold = 人看过了,别再催
          const s = settleOf(c, prsOfCard(c, repo), relPr, repo)
          if (s.kind === 'settle') settle.push(String(c.id))
          else if (s.kind === 'reopen') reopen.push(String(c.id))
        }
      }
    }
    if (settle.length) notices.push(S.respSettle(settle.slice(0, 5), settle.length))
    if (reopen.length) notices.push(S.respReopen(reopen.slice(0, 5), reopen.length))
  }
}

// ---- ⑥ 积压审计(v0.13.0,只在 config.wip 配了对象时跑):ready 超 hard 就说一声 ----
// 与卡上的横幅同一口径(只数 ready),但守卫看的是全线别的总数 —— 分线别的账在页面上看。
{
  let wip = null
  try {
    const c = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8'))
    if (c.wip && typeof c.wip === 'object' && !Array.isArray(c.wip)) wip = c.wip
  } catch {}
  if (wip) {
    const hard = Number.isFinite(wip.hard) ? wip.hard : 20
    const n = cardsOf('backlog-manifest.json', 'items', 'backlog').filter((it) => it && it.status === 'ready').length
    if (n > hard) notices.push(S.wipOver(n, hard))
  }
}

if (orphans.length === 0) {
  if (notices.length) console.log(JSON.stringify({ systemMessage: notices.join('\n') }))
  process.exit(0)
}

const list = orphans.map((f) => `  - app/kanban/demos/${f}`).join('\n')
if (hook.stop_hook_active) {
  console.log(JSON.stringify({ systemMessage: [S.orphanWarn(orphans.length, list), ...notices].join('\n') }))
  process.exit(0)
}
console.log(JSON.stringify({
  decision: 'block',
  reason: S.orphanBlock(orphans.length, list),
  ...(notices.length ? { systemMessage: notices.join('\n') } : {}),
}))
