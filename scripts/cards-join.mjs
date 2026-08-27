#!/usr/bin/env node
// 一卡一文件 → 单文件 manifest(v0.14.0)。cards-split.mjs 的反向,退路用。
//
//   node scripts/cards-join.mjs [--dir <kanbanDir>] [--dry-run]
//
// 卡按 order(拆分写入的原数组下标)再按 id 排回数组,order 字段随即删掉 —— 合回去的
// 两份 manifest 与拆分前逐字段相同。卡文件与两个子目录删除,kanban.config.json 去掉 cardsDir。
// 合完自动跑一遍 gen 与合并前的产物逐字节比,不同就把改动前的一切原样写回 + exit 1。
import { join } from 'node:path'
import { resolveKanbanDir } from './kanban-dir.mjs'
import { loadStrings } from './strings.mjs'
import { CARD_KINDS, cardsDirOf, scanCardDir, sortCards, stripOrder } from './cards.mjs'
import { atomicWrite, jsonText, makeUndo, readJson, runGen, snapDiff, snapshot } from './cards-lib.mjs'

const KANBAN = resolveKanbanDir()
const S = loadStrings(KANBAN).cards
const DRY = process.argv.slice(2).includes('--dry-run')
const die = (msg) => { console.error(msg); process.exit(1) }

const cfgPath = join(KANBAN, 'kanban.config.json')
const cfg = readJson(cfgPath)
const CARDS_DIR = cardsDirOf(cfg)
if (!CARDS_DIR) die(S.notSplit())

const plan = []
for (const kind of CARD_KINDS) {
  const path = join(KANBAN, kind.manifest)
  const head = readJson(path)
  if (head[kind.key] !== undefined) die(S.headHasArray(kind.manifest, kind.key))
  const rel = `${CARDS_DIR}/${kind.sub}`
  const dir = join(KANBAN, CARDS_DIR, kind.sub)
  const scan = scanCardDir(dir)
  if (scan.missing) die(S.dirMissing(rel))
  for (const bad of scan.bad) die(bad.kind === 'parse' ? S.parseBad(`${rel}/${bad.file}`, bad.message) : S.idMismatch(`${rel}/${bad.file}`, bad.id))
  plan.push({ kind, path, head, rel, dir, files: scan.files, cards: stripOrder(sortCards(scan.cards.map((x) => x.card))) })
}

const total = plan.reduce((n, p) => n + p.cards.length, 0)
if (DRY) {
  console.log(S.dryRunJoin(plan.map((p) => ({ rel: p.rel, n: p.cards.length, file: p.kind.manifest, key: p.kind.key })), total))
  process.exit(0)
}

{
  const r = runGen(KANBAN)
  if (!r.ok) die(S.baselineFailed(r.err))
}
const before = snapshot(KANBAN)

const undo = makeUndo()
for (const p of plan) {
  undo.keep(p.path)
  p.head[p.kind.key] = p.cards
  atomicWrite(p.path, jsonText(p.head))
  for (const f of p.files) undo.drop(join(p.dir, f))
  undo.dropDir(p.dir)
}
// 卡目录本身:两个子目录都空了才删得掉(里面若还有别的东西,留着)
undo.dropDir(join(KANBAN, CARDS_DIR))
undo.keep(cfgPath)
{
  const next = { ...cfg }
  delete next.cardsDir
  atomicWrite(cfgPath, jsonText(next))
}

{
  const r = runGen(KANBAN)
  if (!r.ok) { undo.rollback(); runGen(KANBAN); die(S.genFailed(r.err)) }
}
const diff = snapDiff(before, snapshot(KANBAN))
if (diff.length) { undo.rollback(); runGen(KANBAN); die(S.diffFoundJoin(diff.join(' '))) }

console.log(S.joinDone(total, plan.map((p) => p.kind.manifest).join(' / ')))
