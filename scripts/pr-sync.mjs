#!/usr/bin/env node
// PR / 版本同步(v0.12.0)。gh → release-manifest.json,给「发布进度」tab 与卡头芯片后缀供数。
//
//   node scripts/pr-sync.mjs [--dir <kanbanDir>] [--dry-run] [--settle [--write] [--only <id>[,<id>…]]]
//
// 为什么是独立脚本而不是 hook:gen 必须零网络零时间(测试床里没有 gh、没有 remote),
// 「现在几点、GitHub 上是什么状态」只能由一个人/工作流显式触发的脚本落进数据里。
// 开/合 PR 之后、发版打完 tag 之后各跑一次即可(ddd-workflow ③⑤)。
//
// 写什么、不写什么:
//   prs[]     全量重写(gh 是真源),number 降序;cards 由 prlink.prsOfCard 反查三份 manifest
//   releases[] 只追加 gh 上有、文件里没有的 tag;已有条目的 note / 人手写的 prs 一律保留
//   syncedAt  当前 ISO(脚本可以用时间,gen 不行)
//   stages / $comment 原样不动 —— 那是人写的口径
// gh 缺席 / 未登录 / 网络不通 → stderr 一条文案 + exit 1,文件一个字节都不动。
//
// --settle(v0.13.0,定稿 §2.2-4):同步之后列出「关联 PR 都合了、卡还没收到终态」的卡与建议 status。
// 默认只打印;--write 才改 —— 「PR 合了」≠「卡可以收」(一张卡跨三个 PR、一个 PR 只落一半都常见),
// 所以机器判断 + 提示 + 一键收账,不做静默改写。--write 只动两个字段:
//   status → 终态(backlog / 进度卡 done,决策卡 live)
//   时间线字段(items 的 note、tasks 的 notes)末尾追加一行「【日期 收账】PR#N 已合(自动)」
//     决策卡没有时间线字段(gen 不渲染 note),不硬塞一个没人读的字段进去,只改 status。
// 改写前先验一遍「原文 === JSON.stringify(解析结果, null, 2) + 换行」:对不上就整份跳过,
// 免得一次收账把别人手写的排版整份重排(那种 diff 没人敢看)。落盘走 tmp + rename。
//
// --only <id>[,<id>…](v0.13.1):清单上的卡逐张挑着收。实证:0.13.0 上板第一次跑 --settle 抓到三张,
// 人一核只有一张真该收 —— 另两张的 PR 只落了一半 / 只落了接口。全收或全不收都不是这里的正确答案。
// 点名了清单外的 id 就整个拒绝(不写任何文件):那多半是卡号敲错,静默少收一张比报错难查得多。
// 长期挂账的卡不必每次都写 --only,在卡上写一句 settleHold 理由,它就从清单里挪进「已 hold」一行。
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveKanbanDir } from './kanban-dir.mjs'
import { loadStrings } from './strings.mjs'
import { prsOfCard } from './prlink.mjs'
import { cmpAt } from './relstage.mjs'
import { KIND_TERMINAL, settleHold, settleOf } from './settle.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const KANBAN = resolveKanbanDir()
const S = loadStrings(KANBAN).prSync
const ARGV = process.argv.slice(2)
const DRY = ARGV.includes('--dry-run')
const SETTLE = ARGV.includes('--settle')
const WROTE_ASKED = ARGV.includes('--write') && SETTLE // --write 是 --settle 的修饰,单独给不作数
// --only 同样是 --settle 的修饰。两种写法都收:`--only a,b` 与 `--only=a,b`。
const ONLY = (() => {
  if (!SETTLE) return null
  const i = ARGV.findIndex((a) => a === '--only' || a.startsWith('--only='))
  if (i < 0) return null
  const raw = ARGV[i].startsWith('--only=') ? ARGV[i].slice('--only='.length) : ARGV[i + 1]
  return String(raw || '').split(',').map((x) => x.trim()).filter(Boolean)
})()
const OUT = join(KANBAN, 'release-manifest.json')
const die = (msg) => { console.error(msg); process.exit(1) }

// ---- 仓与主线:三份 manifest 各存一份 instance(现状),取第一个非空 ----
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }
const MANIFESTS = [
  ['manifest.json', 'tasks'],
  ['backlog-manifest.json', 'items'],
  ['decisions-manifest.json', 'entries'],
].map(([f, key]) => ({ f, key, data: readJson(join(KANBAN, f)) })).filter((x) => x.data)
const inst = (k) => { for (const x of MANIFESTS) { const v = (x.data.instance || {})[k]; if (v) return String(v) } return '' }
const REPO = inst('ghRepo')
if (!REPO) die(S.noRepo())

// ---- gh ----
const gh = (args, what) => {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.error && r.error.code === 'ENOENT') die(S.ghMissing())
  if (r.status !== 0) die(S.ghFailed(what, (r.stderr || r.error?.message || `exit ${r.status}`).trim()))
  try { return JSON.parse(r.stdout) }
  catch (e) { die(S.ghBadJson(what, e.message)) }
}
const ghPrs = gh(['pr', 'list', '--repo', REPO, '--state', 'all', '--limit', '500',
  '--json', 'number,title,state,isDraft,baseRefName,headRefName,url,createdAt,mergedAt,closedAt'], `gh pr list --repo ${REPO}`)
const ghRels = gh(['release', 'list', '--repo', REPO, '--limit', '100', '--json', 'tagName,publishedAt'], `gh release list --repo ${REPO}`)

// ---- 现有文件(缺则从模板起;坏 JSON 拒绝覆盖:人手写的 note/prs 可能就在里面)----
let out
if (existsSync(OUT)) {
  try { out = JSON.parse(readFileSync(OUT, 'utf8')) }
  catch (e) { die(S.manifestBad(e.message)) }
} else {
  out = JSON.parse(readFileSync(join(HERE, '..', 'templates', 'manifests', 'release-manifest.json'), 'utf8'))
}
if (!Array.isArray(out.releases)) out.releases = []

// ---- releases:追加新 tag,保留已有条目的一切(note / 人手写的 prs)----
const have = new Set(out.releases.map((r) => String((r || {}).tag)))
let added = 0
for (const r of ghRels) {
  if (!r || !r.tagName || have.has(String(r.tagName))) continue
  out.releases.push({ tag: String(r.tagName), at: String(r.publishedAt || ''), note: '' })
  added++
}
// at 升序(区间归属靠它;gh 给的顺序不保证)。比时刻不比字面:人手写的 at 常带 +08:00,gh 给的是 Z。
out.releases.sort((a, b) => cmpAt((a || {}).at, (b || {}).at))

// ---- prs:全量重写(gh 是真源)----
const MAIN = inst('branch')
const CARDS = MANIFESTS.flatMap((x) => x.data[x.key] || []).filter(Boolean)
const cardsOfPr = new Map()
for (const c of CARDS) for (const p of prsOfCard(c, REPO)) {
  if (p.repo !== REPO || !c.id) continue
  if (!cardsOfPr.has(p.num)) cardsOfPr.set(p.num, [])
  const list = cardsOfPr.get(p.num)
  if (!list.includes(String(c.id))) list.push(String(c.id))
}
out.prs = ghPrs
  .filter((p) => p && p.number != null)
  .map((p) => ({
    number: Number(p.number),
    title: String(p.title || ''),
    state: String(p.state || '').toLowerCase(), // gh 给的是 OPEN / MERGED / CLOSED
    draft: Boolean(p.isDraft),
    base: String(p.baseRefName || ''),
    branch: String(p.headRefName || ''),
    url: String(p.url || `https://github.com/${REPO}/pull/${p.number}`),
    createdAt: String(p.createdAt || ''),
    mergedAt: p.mergedAt ? String(p.mergedAt) : null,
    closedAt: p.closedAt ? String(p.closedAt) : null,
    cards: cardsOfPr.get(Number(p.number)) || [],
  }))
  .sort((a, b) => b.number - a.number)

// ---- 版本区间自动填 prs:人手写过的不覆盖(显式列表是人的裁量,机器不该抹掉)----
// 归属 = mergedAt 在上一版打 tag 时刻(不含)与本版打 tag 时刻(含)之间,且 base 是主线。
let prev = ''
for (const r of out.releases) {
  const at = String(r.at || '')
  if (!Array.isArray(r.prs)) {
    r.prs = out.prs
      .filter((p) => p.state === 'merged' && p.mergedAt && cmpAt(p.mergedAt, at) <= 0 && cmpAt(p.mergedAt, prev) > 0 && (!MAIN || !p.base || p.base === MAIN))
      .map((p) => p.number)
      .sort((a, b) => a - b)
  }
  prev = at
}

out.syncedAt = new Date().toISOString()

if (DRY) console.log(S.dry(out.prs.length, out.releases.length, added))
else {
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(S.done(out.prs.length, out.releases.length, added, OUT))
}

// ---- --settle:待收账清单(默认只打印)----
if (!SETTLE) process.exit(0)

const relPr = new Map(out.prs.map((p) => [p.number, p]))
const NOTE_FIELD = { tasks: 'notes', items: 'note', entries: '' } // 决策卡没有时间线字段,只改 status
const all = []
const held = [] // 写了 settleHold 的 settle 卡:单列一行,--write 不碰
for (const x of MANIFESTS) {
  const to = KIND_TERMINAL[x.key]
  if (!to) continue
  for (const c of x.data[x.key] || []) {
    if (!c || !c.id) continue
    const prs = prsOfCard(c, REPO)
    if (settleOf(c, prs, relPr, REPO).kind !== 'settle') continue
    if (settleHold(c)) { held.push(String(c.id)); continue }
    all.push({
      f: x.f, key: x.key, id: String(c.id), from: String(c.status || ''), to,
      nums: prs.filter((p) => p.repo === REPO && relPr.has(p.num)).map((p) => p.num).sort((a, b) => a - b),
    })
  }
}
const sayHeld = () => { if (held.length) console.log(S.settleHeld(held, held.length)) }
if (!all.length) {
  console.log(S.settleNone())
  sayHeld()
  process.exit(0)
}
// 清单永远整份打印(哪怕 --only 只挑一张):人得看得见自己没挑的那些还在那儿。
console.log(S.settleHead(all.length))
for (const r of all) console.log(S.settleRow(r.id, r.from, r.to, 'PR #' + r.nums.join(' #')))
sayHeld()

// --only:先验再动。清单外的 id(敲错的卡号、已经 hold 的卡)一律拒绝整次写入 —— 静默少收一张
// 比一行报错难查得多,而部分收账已经落盘之后再报错,就成了「写了一半」。
let rows = all
if (ONLY) {
  if (!ONLY.length) die(S.settleOnlyEmpty())
  const known = new Set(all.map((r) => r.id))
  const bad = ONLY.filter((id) => !known.has(id))
  if (bad.length) die(S.settleOnlyBad(bad))
  rows = all.filter((r) => ONLY.includes(r.id))
}
if (!WROTE_ASKED || DRY) {
  console.log(WROTE_ASKED && DRY ? S.settleDryWins() : S.settleDry(all.slice(0, 2).map((r) => r.id).join(',')))
  process.exit(0)
}

// ---- --settle --write:只改这两个字段,其它字节不动 ----
const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const atomicWrite = (p, text) => { // 同目录 tmp + rename:半截文件永远不会出现在 manifest 的位置上
  const tmp = `${p}.tmp-${process.pid}`
  writeFileSync(tmp, text)
  renameSync(tmp, p)
}
let settled = 0
const touched = []
for (const f of [...new Set(rows.map((r) => r.f))]) {
  const path = join(KANBAN, f)
  const text = readFileSync(path, 'utf8')
  const data = JSON.parse(text)
  if (JSON.stringify(data, null, 2) + '\n' !== text) { console.error(S.settleReformat(f)); continue }
  for (const r of rows.filter((x) => x.f === f)) {
    const card = (data[r.key] || []).find((c) => c && String(c.id) === r.id)
    if (!card) continue
    card.status = r.to
    const nf = NOTE_FIELD[r.key]
    if (nf) {
      const line = `【${today} 收账】PR#${r.nums.join(' #')} 已合(自动)`
      const cur = String(card[nf] || '')
      card[nf] = cur ? `${cur}\n\n${line}` : line
    }
    settled++
  }
  atomicWrite(path, JSON.stringify(data, null, 2) + '\n')
  touched.push(f)
}
console.log(S.settleWrote(settled, touched.join(', ')))
