#!/usr/bin/env node
// 单文件 manifest → 一卡一文件(v0.14.0)。一次性迁移,反向退路见 cards-join.mjs。
//
//   node scripts/cards-split.mjs [--dir <kanbanDir>] [--cards-dir cards] [--dry-run]
//
// 做四件事:
//   backlog-manifest.json 的 items[]    → <cardsDir>/backlog/<id>.json    (2 空格 + 末尾换行)
//   decisions-manifest.json 的 entries[] → <cardsDir>/decisions/<id>.json
//   两份头文件去掉数组(一个真源:两处都能写的字段迟早对不上)
//   kanban.config.json 写入 cardsDir
//
// 每张卡带一个 order = 原数组下标:数组顺序在 gen 里就是显示顺序(截图廊组序、深链表键序、
// 同日同号时的先后),不记下来就还原不回去。gen 读回时按 order 排完即把它删掉。
//
// 拆完自动跑一遍 gen 与拆分前的产物逐字节比;不同就把改动前的文件原样写回 + exit 1 ——
// 一卡一文件是纯搬运,产物变了就是搬运有 bug,不该把一块搬坏的板留在人家仓库里。
//
// 迁移顺序(重要):①所有会话先升到本版(旧 gen 读不到卡,只会生成空板)→ ②主树 git status
// 干净、通知各会话暂停写卡 → ③跑本脚本 → ④一个 commit(message 写明是 rename 性质)→ ⑤恢复。
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolveKanbanDir } from './kanban-dir.mjs'
import { loadStrings } from './strings.mjs'
import { CARD_KINDS, cardsDirOf, cardsDirUnsafe, cardText } from './cards.mjs'
import { atomicWrite, jsonText, makeUndo, readJson, runGen, snapDiff, snapshot } from './cards-lib.mjs'

const KANBAN = resolveKanbanDir()
const S = loadStrings(KANBAN).cards
const ARGV = process.argv.slice(2)
const DRY = ARGV.includes('--dry-run')
const argAt = ARGV.indexOf('--cards-dir')
const CARDS_DIR = argAt >= 0 && ARGV[argAt + 1] ? ARGV[argAt + 1].replace(/^\/+|\/+$/g, '') : 'cards'
const die = (msg) => { console.error(msg); process.exit(1) }
// 目录名先验:--cards-dir ../../X 会把整批卡写到看板目录外,而拆分自带的逐字节校验照样通过
// (gen 读的是同一个逃出去的路径),于是工具报「迁移成功」,提交进 git 的板却一张卡都没有。
if (cardsDirUnsafe(CARDS_DIR)) die(S.cardsDirUnsafe(CARDS_DIR))

const cfgPath = join(KANBAN, 'kanban.config.json')
const cfg = readJson(cfgPath)
let already
try { already = cardsDirOf(cfg) } catch (e) { die(e.message) }
if (already) die(S.alreadySplit(already))

// ---- 读两份头文件,校验 id 能当文件名、不重复 ----
const plan = []
const seen = new Set()
for (const kind of CARD_KINDS) {
  const path = join(KANBAN, kind.manifest)
  const head = readJson(path)
  const list = head[kind.key]
  if (!Array.isArray(list)) die(S.headNoArray(kind.manifest, kind.key))
  const rel = `${CARDS_DIR}/${kind.sub}`
  const cards = list.map((card, i) => {
    const id = String((card && card.id) ?? '')
    if (!id) die(S.idBad(id, S.idEmpty()))
    if (id !== id.trim() || /[/\\]/.test(id) || id === '.' || id === '..') die(S.idBad(id, S.idUnsafe()))
    if (seen.has(id)) die(S.idDup(id))
    if (card.order !== undefined) die(S.orderTaken(id))
    seen.add(id)
    return { id, text: cardText({ ...card, order: i }) }
  })
  plan.push({ kind, path, head, rel, dir: join(KANBAN, CARDS_DIR, kind.sub), cards })
}

const total = plan.reduce((n, p) => n + p.cards.length, 0)
if (DRY) {
  console.log(S.dryRun(plan.map((p) => ({ rel: p.rel, n: p.cards.length })), total))
  process.exit(0)
}

// ---- 目录必须是空的(或不存在):往有东西的目录里拆等于赌哪个文件先被盖 ----
for (const p of plan) {
  if (!existsSync(p.dir)) continue
  let names = []
  try { names = readdirSync(p.dir) } catch {}
  if (names.length) die(S.dirNotEmpty(p.rel))
}

// ---- 改动前的基准产物(先跑一遍 gen:板上的 index 可能是别的版本留下的)----
{
  const r = runGen(KANBAN)
  if (!r.ok) die(S.baselineFailed(r.err))
}
const before = snapshot(KANBAN)

// ---- 落盘 ----
// 整段包住:落盘中途任何一个 I/O 错(目录只读、盘满、被别人占着)都会把这块板留在半迁移态 ——
// 头文件的数组已经删了、卡还没搬完、config 也还没写 —— gen 从此 `b.items is not iterable`,
// 人拿到的是一段 Node 堆栈。undo 本来就记着回去的路,这里用上它。
const undo = makeUndo()
try {
  for (const p of plan) {
    undo.mkdir(p.dir)
    for (const c of p.cards) undo.write(join(p.dir, `${c.id}.json`), c.text)
    undo.keep(p.path)
    delete p.head[p.kind.key]
    atomicWrite(p.path, jsonText(p.head))
  }
  undo.keep(cfgPath)
  atomicWrite(cfgPath, jsonText({ ...cfg, cardsDir: CARDS_DIR }))
} catch (e) {
  undo.rollback()
  runGen(KANBAN)
  die(S.writeFailed(e.message))
}

// ---- 验:再跑一遍 gen,产物必须逐字节相同(除新增的每卡「更新」时间戳)----
{
  const r = runGen(KANBAN)
  if (!r.ok) { undo.rollback(); runGen(KANBAN); die(S.genFailed(r.err)) }
}
const diff = snapDiff(before, snapshot(KANBAN))
if (diff.length) { undo.rollback(); runGen(KANBAN); die(S.diffFound(diff.join(' '))) }

console.log(S.splitDone(total, plan.map((p) => ({ rel: p.rel, n: p.cards.length })), CARDS_DIR))
