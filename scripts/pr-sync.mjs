#!/usr/bin/env node
// PR / 版本同步(v0.12.0)。gh → release-manifest.json,给「发布进度」tab 与卡头芯片后缀供数。
//
//   node scripts/pr-sync.mjs [--dir <kanbanDir>] [--dry-run]
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
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveKanbanDir } from './kanban-dir.mjs'
import { loadStrings } from './strings.mjs'
import { prsOfCard } from './prlink.mjs'
import { cmpAt } from './relstage.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const KANBAN = resolveKanbanDir()
const S = loadStrings(KANBAN).prSync
const DRY = process.argv.slice(2).includes('--dry-run')
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

if (DRY) {
  console.log(S.dry(out.prs.length, out.releases.length, added))
  process.exit(0)
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(S.done(out.prs.length, out.releases.length, added, OUT))
