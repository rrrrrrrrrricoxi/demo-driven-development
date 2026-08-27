#!/usr/bin/env node
// 看板写操作 CLI(v0.14.0,零依赖)。会话不再手搓 JSON —— 建卡 / 改字段 / 记进展 / 挂链接 /
// 读卡 / 导出全从这一个入口走,校验与形制由脚本保证。
//
//   node scripts/ddd.mjs card new backlog|decision [--line C --session dev --title "…"] [--from f.json]
//   node scripts/ddd.mjs card set <id> <field> <value> [--json]     (--json:值按 JSON 解析,给数组/对象用)
//   node scripts/ddd.mjs card status <id> <status> [--no-note]
//   node scripts/ddd.mjs card note <id> "<text>"
//   node scripts/ddd.mjs card link <id> "<title>" <href>
//   node scripts/ddd.mjs card show <id> [--json]
//   node scripts/ddd.mjs card list [--status s --line X --session Y --since YYYY-MM-DD] [--json]
//   node scripts/ddd.mjs card history <id>
//   node scripts/ddd.mjs export [--out f.json]
//   node scripts/ddd.mjs pr-sync […]
//
// 为什么值得有:手搓 JSON 每次都要小心末尾换行、键序、转义,而错了要么 gen 硬失败、要么静默
// 渲染成别的样子;更要命的是 id 分配 —— 各会话自己算「最大号 +1」,同一晚两条线撞号只是时间
// 问题。这里建卡用 openSync(path,'wx') 独占创建预留号:抢输的那个自己退到下一号,不是覆盖。
//
// 两种形制都认(与 pr-sync 同一范式):配了 config.cardsDir = 逐卡文件读写(单张卡一次原子写,
// 不碰别人的卡);没配 = 从头文件的数组读、整文件重写(竞态照旧,这是未拆板的既有代价)。
//
// 不做:交互式 TUI、批量编辑、自动 commit —— commit 仍由会话按纪律做。
import { closeSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveKanbanDir } from './kanban-dir.mjs'
import { loadStrings, pickStrings } from './strings.mjs'
import { CARD_KINDS, cardsDirOf, cardText, scanCardDir, sortCards, stripOrder } from './cards.mjs'
import { atomicWrite, jsonText } from './cards-lib.mjs'
import { parsePr } from './prlink.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ARGV = process.argv.slice(2)

// pr-sync 是别名:原样转调,连参数带退出码。别在这里复述它的旗子 —— 它加一个,这里就旧一个。
if (ARGV[0] === 'pr-sync') {
  const r = spawnSync(process.execPath, [join(HERE, 'pr-sync.mjs'), ...ARGV.slice(1)], { stdio: 'inherit' })
  process.exit(r.status === null ? 1 : r.status)
}

// ---- 旗子 ----------------------------------------------------------------
const VALUE_FLAGS = new Set(['dir', 'out', 'from', 'line', 'session', 'title', 'status', 'since'])
const BOOL_FLAGS = new Set(['json', 'help', 'no-note'])
const die = (msg) => { console.error(msg); process.exit(1) }

function parseArgv(argv) {
  const flags = Object.create(null)
  const pos = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') { pos.push(...argv.slice(i + 1)); break }
    if (!a.startsWith('--')) { pos.push(a); continue }
    const eq = a.indexOf('=')
    const name = eq < 0 ? a.slice(2) : a.slice(2, eq)
    if (BOOL_FLAGS.has(name)) { flags[name] = true; continue }
    if (!VALUE_FLAGS.has(name)) return { bad: a }
    const v = eq < 0 ? argv[++i] : a.slice(eq + 1)
    if (v === undefined) return { needsValue: name }
    flags[name] = v
  }
  return { flags, pos }
}

const parsed = parseArgv(ARGV)

// 看板目录先定位:文案表挂在它上面(lang 由 kanban.config.json 决定)。定位不到也得先能出话 ——
// `ddd --help` 在任何目录下都该管用,那正是「我该怎么找到这块板」的人来问的时候。
let KANBAN = null
let dirErr = null
try { KANBAN = resolveKanbanDir(parsed.flags && parsed.flags.dir ? ['--dir', parsed.flags.dir] : []) }
catch (e) { dirErr = e }
const S = (KANBAN ? loadStrings(KANBAN) : pickStrings()).cli

if (parsed.flags && parsed.flags.help) { console.log(S.usage()); process.exit(0) }
if (parsed.bad) die(S.unknownFlag(parsed.bad))
if (parsed.needsValue) die(S.flagNeedsValue(parsed.needsValue))
if (dirErr) die(dirErr.message)
const { flags, pos } = parsed
if (!pos.length) die(S.usage())

// ---- 今天(脚本层可以读时钟;gen 不行)----
const NOW = new Date()
const TODAY = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}`

// ---- 看板数据 ------------------------------------------------------------
const readJsonAt = (p, what) => {
  try { return JSON.parse(readFileSync(p, 'utf8')) }
  catch (e) { die(S.readFailed(what, e.message)) }
}
const CFG = readJsonAt(join(KANBAN, 'kanban.config.json'), 'kanban.config.json')
const CARDS_DIR = cardsDirOf(CFG)
const KIND_OF = { backlog: CARD_KINDS[0], decision: CARD_KINDS[1], decisions: CARD_KINDS[1] }
const KIND_NAME = { items: 'backlog', entries: 'decision' }

/** 一类卡的读写现场(两种形制统一成同一张表 —— pr-sync 的 CARD_ROWS 范式) */
function loadKind(k) {
  const headPath = join(KANBAN, k.manifest)
  const head = readJsonAt(headPath, k.manifest)
  if (!CARDS_DIR) {
    const list = head[k.key]
    if (!Array.isArray(list)) die(S.headNoArray(k.manifest, k.key))
    return { k, headPath, head, split: false, rows: list.map((card, i) => ({ card, i, keys: Object.keys(card || {}), where: k.manifest })) }
  }
  if (head[k.key] !== undefined) die(S.headHasArray(k.manifest, k.key, CARDS_DIR))
  const rel = `${CARDS_DIR}/${k.sub}`
  const dir = join(KANBAN, rel)
  const scan = scanCardDir(dir)
  if (scan.missing) die(S.dirMissing(rel))
  // gen 遇到这些直接硬失败,CLI 也不装看不见 —— 在一块 gen 跑不动的板上写卡毫无意义。
  for (const bad of scan.bad) die(bad.kind === 'parse' ? S.cardParseBad(`${rel}/${bad.file}`, bad.message) : S.cardIdMismatch(`${rel}/${bad.file}`, bad.id))
  return {
    k, headPath, head, split: true, dir, rel,
    rows: scan.cards.map((x) => ({ card: x.card, file: join(dir, x.file), keys: Object.keys(x.card), where: `${rel}/${x.file}` })),
  }
}

const kindStores = new Map()
const storeOf = (k) => { if (!kindStores.has(k.key)) kindStores.set(k.key, loadKind(k)); return kindStores.get(k.key) }

function findCard(id) {
  for (const k of CARD_KINDS) {
    const store = storeOf(k)
    const row = store.rows.find((r) => String(r.card.id) === id)
    if (row) return { store, row }
  }
  return die(S.cardNotFound(id))
}

// ---- 键序规范化 ----------------------------------------------------------
// 已有键的相对顺序原样保留(改一个字段不该把整张卡的字节重排,那种 diff 没人敢看);
// 新键按规范插到自己那一档:id/code/title 在前,长文居中偏后,links/shots/pr 收尾。
const K_FRONT = ['id', 'code', 'title']
const K_LONG = ['question', 'decision', 'problem', 'approach', 'note', 'notes', 'demoNote', 'detail']
const K_TAIL = ['links', 'shots', 'pr']
const K_FLAT = [
  ...K_FRONT,
  'status', 'tier', 'area', 'priority', 'line', 'session', 'date', 'blockedOn', 'source',
  'demo', 'route', 'routeLive', 'designDoc', 'repro', 'settleHold', 'order',
  ...K_LONG, ...K_TAIL,
]
const bandOf = (k) => (K_FRONT.includes(k) ? 0 : K_TAIL.includes(k) ? 3 : K_LONG.includes(k) ? 2 : 1)
const canonOf = (k) => { const i = K_FLAT.indexOf(k); return i < 0 ? K_FLAT.length : i }

function normalizeCard(card, origKeys) {
  const have = Object.keys(card)
  const out = origKeys.filter((k) => have.includes(k))
  const fresh = have.filter((k) => !out.includes(k)).sort((a, z) => canonOf(a) - canonOf(z))
  for (const key of fresh) {
    let at = out.findIndex((x) => bandOf(x) > bandOf(key))
    if (at < 0) at = out.length
    out.splice(at, 0, key)
  }
  return Object.fromEntries(out.map((k) => [k, card[k]]))
}

/** 落盘:拆分模式写那一张卡文件,未拆模式整文件重写(与 PR-E 的 join 同形制) */
function writeCard(store, row, card) {
  const next = normalizeCard(card, row.keys)
  try {
    if (store.split) atomicWrite(row.file, cardText(next))
    else { store.head[store.k.key][row.i] = next; atomicWrite(store.headPath, jsonText(store.head)) }
  } catch (e) { die(S.writeFailed(row.where, e.message)) }
  return next
}

// ---- 取值与校验 ----------------------------------------------------------
const laneIds = () => (CFG.lanes && Array.isArray(CFG.lanes.ids) ? CFG.lanes.ids.map(String) : null)
/**
 * 建卡时 --line 缺席取哪一档:配了 lanes 就取 config.lanes.default(它不在 ids 里就取 ids[0])。
 * 写 line:"" 的卡在配了 lanes 的板上默认视图里根本不出现 —— 建了张自己看不见的卡,比不建更糟。
 * 没配 lanes 时恒空:那种板本来就没有线别这回事。
 */
function defaultLine() {
  const ids = laneIds()
  if (!ids || !ids.length) return ''
  const d = String((CFG.lanes && CFG.lanes.default) ?? '')
  return ids.includes(d) ? d : ids[0]
}
const sessionIds = () => {
  const t = CFG.sessionTags
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null
  const ids = Object.keys(t)
  return ids.length ? ids : null
}
const repoOf = () => {
  for (const k of CARD_KINDS) { const v = ((storeOf(k).head.instance || {}).ghRepo || '').trim(); if (v) return v }
  const m = readJsonAt(join(KANBAN, 'manifest.json'), 'manifest.json')
  return String((m.instance || {}).ghRepo || '').trim()
}
const statusIds = (head) => Object.keys(head.statuses || {})
/** 建卡默认状态:statuses 的第一个,且它得在 groups 里(gen 两处都硬校验) */
function firstStatus(head) {
  const groups = new Set((head.groups || []).map((g) => String(g && g.id)))
  const all = statusIds(head)
  return all.find((s) => groups.has(s)) || all[0] || ''
}
/** 空格分隔的多值字段(line = "B C"、session = "dev release")按 token 逐个校验 */
function checkTokens(value, allowed, bad) {
  if (!allowed) return
  for (const tok of String(value).split(/\s+/).filter(Boolean)) if (!allowed.includes(tok)) die(bad(tok, allowed))
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function checkPr(value) {
  const repo = repoOf() || 'owner/repo' // 没配仓也能验形制:数字 / "#N" / "owner/repo#N"
  for (const v of Array.isArray(value) ? value : [value]) if (!parsePr(v, repo)) die(S.prBad(JSON.stringify(v)))
}

const FIELDS_COMMON = ['id', 'title', 'status', 'line', 'session', 'date', 'source', 'links', 'shots', 'pr', 'detail', 'settleHold', 'demo', 'repro', 'walkthroughs', 'order']
const KNOWN_FIELDS = {
  items: [...FIELDS_COMMON, 'tier', 'area', 'priority', 'blockedOn', 'problem', 'approach', 'note', 'code', 'initKind'],
  entries: [...FIELDS_COMMON, 'code', 'question', 'decision', 'notes', 'designDoc', 'designSec', 'route', 'routeLive', 'demoNote', 'demoOrigin', 'iters', 'refines', 'closedKind'],
}
/** 时间线字段:backlog 的 note、决策的 notes(manifest.json 的 tasks 用 notes,同一族) */
const NOTE_FIELD = { items: 'note', entries: 'notes' }
/** 形制上就是数组的字段:塞个标量进去,gen 会在 .map 上当场 TypeError,整块板生成不出来 */
const ARRAY_FIELDS = ['links', 'shots', 'walkthroughs', 'iters', 'refines']

/** 一处校验,set / status / new 共用 —— 三条路写同一批字段,校验分三份迟早对不上 */
function checkField(store, field, value) {
  if (field === 'order') die(S.orderLocked())
  // id 是文件名(拆分模式)/ 全板唯一键(未拆),改它就是把卡的身份改掉:gen 下一跑就硬失败,
  // 而 loadKind 见到坏卡即 die,连用来改回来的这条命令也一起锁死。所以这里一个字节都不写。
  if (field === 'id') die(S.idLocked())
  if (ARRAY_FIELDS.includes(field) && !Array.isArray(value)) die(S.arrayField(field))
  if (field === 'status') { const all = statusIds(store.head); if (!all.includes(String(value))) die(S.statusBad(String(value), all)) }
  if (field === 'date' && !DATE_RE.test(String(value))) die(S.dateBad(String(value)))
  if (field === 'line') checkTokens(value, laneIds(), S.lineBad)
  if (field === 'session') checkTokens(value, sessionIds(), S.sessionBad)
  if (field === 'pr') checkPr(value)
}

// ---- 命令 ----------------------------------------------------------------
const say = (obj, human) => { console.log(flags.json ? JSON.stringify(obj, null, 2) : human) }
/** 占位注释(`<…>`)按空处理:往它后面追时间线只会读成一句废话 */
const isPlaceholder = (s) => /^<[^>]*>$/.test(String(s).trim())
const appendTimeline = (cur, line) => (!cur || isPlaceholder(cur) ? line : `${cur}\n\n${line}`)

function cmdNew() {
  const name = pos[2]
  const k = KIND_OF[name]
  if (!k) die(S.kindBad(String(name ?? '')))
  const store = storeOf(k)
  const head = store.head
  const ids = store.rows.map((r) => String(r.card.id))

  let extra = {}
  if (flags.from) {
    const raw = readJsonAt(resolve(flags.from), flags.from)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) die(S.fromNotObject(flags.from))
    extra = raw
  }
  const base = k.key === 'items' ? backlogTemplate(head) : decisionTemplate(head)
  const card = { ...base, ...extra }
  delete card.order // order 是拆分记的原下标,手工新卡不写(gen 排完即删,缺席就按 id 排在最后)
  for (const [f, v] of Object.entries(card)) { if (f !== 'id') checkField(store, f, v) }

  const prefix = k.key === 'entries' ? 'D' : dominantPrefix(ids)
  let n = maxNumber(ids, prefix) + 1
  let made = null
  for (let tries = 0; tries < 1000 && !made; tries++, n++) {
    const id = `${prefix}${n}`
    if (!store.split) {
      if (ids.includes(id)) continue
      const next = normalizeCard(withId(card, id), [])
      head[k.key].push(next)
      try { atomicWrite(store.headPath, jsonText(head)) } catch (e) { die(S.writeFailed(k.manifest, e.message)) }
      made = { id, file: k.manifest, card: next }
      break
    }
    // 独占创建:抢输的那个拿到 EEXIST,自己退到下一号 —— 号是「预留」出来的,不是「算」出来的。
    // 内容先备好再开文件,写不成就把预留收走:'wx' 与写入之间留下的 0 字节文件,gen 读到就是
    // 「不是合法 JSON」硬失败、守卫跟着阻断收工,而人根本不知道该去哪找这个文件。
    const path = join(store.dir, `${id}.json`)
    const next = normalizeCard(withId(card, id), [])
    const text = cardText(next)
    let fd
    try { fd = openSync(path, 'wx') }
    catch (e) { if (e.code === 'EEXIST') continue; return die(S.writeFailed(`${store.rel}/${id}.json`, e.message)) }
    try { writeFileSync(fd, text) }
    catch (e) {
      try { closeSync(fd) } catch {}
      try { rmSync(path) } catch {} // 预留的空文件不留在卡目录里
      die(S.writeFailed(`${store.rel}/${id}.json`, e.message))
    }
    closeSync(fd)
    made = { id, file: `${store.rel}/${id}.json`, card: next }
  }
  if (!made) die(S.newExhausted(prefix))
  say({ ok: true, id: made.id, kind: KIND_NAME[k.key], file: made.file, card: made.card }, S.newDone(made.id, made.file))
  // --from 显式给了空 line 时模板的缺省档补不上 —— 那张卡只在「全部」档出现,说一句
  if (laneIds() && !String(made.card.line || '').trim()) console.error(S.newNoLine())
  warnWip(k, made.card)
}

/** 手工新卡的 code 默认取 id:决策卡的锚点用它,缺了 gen 硬失败 */
const withId = (card, id) => (Object.prototype.hasOwnProperty.call(card, 'code') ? { ...card, id, code: card.code || id } : { ...card, id })

function backlogTemplate(head) {
  const tiers = Object.keys(head.tiers || {})
  if (!tiers.length) die(S.noTiers())
  const pri = Object.keys(head.priorities || {})
  return {
    id: '',
    title: flags.title || S.tplTitle(),
    status: firstStatus(head),
    tier: tiers[0],
    priority: pri[Math.floor(pri.length / 2)] || pri[0] || '', // 三档时正中那档;默认高优先级是给自己挖坑
    line: flags.line || defaultLine(),
    session: flags.session || '',
    date: TODAY,
    problem: S.tplProblem(),
    approach: S.tplApproach(),
    note: S.tplNote(),
    links: [],
  }
}

function decisionTemplate(head) {
  return {
    id: '',
    code: '',
    title: flags.title || S.tplTitle(),
    status: firstStatus(head),
    line: flags.line || defaultLine(),
    session: flags.session || '',
    date: TODAY,
    question: S.tplQuestion(),
    decision: S.tplDecision(),
    links: [],
  }
}

/** 主流前缀:板上现有 id 的多数派(melon 是 BL-C,不是更早的 BL-);同票取号码更大的那个 */
function dominantPrefix(ids) {
  const tally = new Map()
  for (const id of ids) {
    const m = String(id).match(/^(.*?)(\d+)$/)
    if (!m) continue
    const cur = tally.get(m[1]) || { n: 0, max: 0 }
    tally.set(m[1], { n: cur.n + 1, max: Math.max(cur.max, Number(m[2])) })
  }
  let best = null
  for (const [prefix, x] of tally) {
    if (!best || x.n > best.x.n || (x.n === best.x.n && x.max > best.x.max)) best = { prefix, x }
  }
  return best ? best.prefix : 'BL-'
}

function maxNumber(ids, prefix) {
  let max = 0
  for (const id of ids) {
    const s = String(id)
    if (!s.startsWith(prefix)) continue
    const rest = s.slice(prefix.length)
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest))
  }
  return max
}

/**
 * 建卡之后照守卫的口径数一遍 ready(只数 backlog:blocked 等外部、deferred 搁置都不占额度),
 * 超 hard 就当场说一句 —— 别等收工才知道又往堆里加了一张。文案与守卫同一句,免得两处走样。
 */
function warnWip(kind, fresh) {
  const wip = CFG.wip
  if (!wip || typeof wip !== 'object' || Array.isArray(wip)) return
  const hard = Number.isFinite(wip.hard) ? wip.hard : 20
  const store = storeOf(CARD_KINDS[0])
  const own = kind.key === 'items' && fresh && fresh.status === 'ready' ? 1 : 0 // 刚写的那张还不在缓存里
  const n = store.rows.filter((r) => r.card && r.card.status === 'ready').length + own
  if (n > hard) console.error(loadStrings(KANBAN).wipOver(n, hard))
}

function cmdSet() {
  const [id, field, ...rest] = pos.slice(2)
  if (!id || !field || !rest.length) die(S.setUsage())
  const { store, row } = findCard(id)
  let value = rest.join(' ')
  if (flags.json) { try { value = JSON.parse(value) } catch (e) { die(S.valueNotJson(e.message)) } }
  else if (field === 'pr' && /^\d+$/.test(value)) value = Number(value)
  checkField(store, field, value)
  if (!KNOWN_FIELDS[store.k.key].includes(field)) console.error(S.unknownField(field, KIND_NAME[store.k.key]))
  const card = writeCard(store, row, { ...row.card, [field]: value })
  say({ ok: true, id, field, value, file: row.where, card }, S.setDone(id, field, typeof value === 'string' ? value : JSON.stringify(value), row.where))
}

function cmdStatus() {
  const [id, next] = pos.slice(2)
  if (!id || !next) die(S.statusUsage())
  const { store, row } = findCard(id)
  checkField(store, 'status', next)
  const from = String(row.card.status || '')
  const card = { ...row.card, status: next }
  const nf = NOTE_FIELD[store.k.key]
  const noted = !flags['no-note']
  if (noted) card[nf] = appendTimeline(card[nf], `【${TODAY}】status → ${next}`)
  const written = writeCard(store, row, card)
  say({ ok: true, id, from, to: next, note: noted ? nf : null, file: row.where, card: written }, S.statusDone(id, from, next, noted ? nf : ''))
}

function cmdNote() {
  const [id, ...rest] = pos.slice(2)
  if (!id || !rest.length) die(S.noteUsage())
  const { store, row } = findCard(id)
  const nf = NOTE_FIELD[store.k.key]
  const line = `【${TODAY}】${rest.join(' ')}`
  const card = writeCard(store, row, { ...row.card, [nf]: appendTimeline(row.card[nf], line) })
  say({ ok: true, id, field: nf, line, file: row.where, card }, S.noteDone(id, nf, line))
}

function cmdLink() {
  const [id, title, href] = pos.slice(2)
  if (!id || !title || !href) die(S.linkUsage())
  const { store, row } = findCard(id)
  const links = Array.isArray(row.card.links) ? [...row.card.links] : []
  const dup = links.some((l) => l && String(l.href) === href)
  if (dup) { say({ ok: true, id, added: false, file: row.where }, S.linkDup(id, href)); return }
  links.push({ title, href })
  const card = { ...row.card, links }
  // 指向本仓 PR 的链接顺手写进 pr 字段(0.12.0 的规矩):芯片只认显式 pr,链接不进芯片
  const repo = repoOf()
  let prAdded = null
  if (repo) {
    const hit = href.match(new RegExp(`^https?://(?:www\\.)?github\\.com/${repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/pull/(\\d+)(?:[/?#]|$)`, 'i'))
    if (hit) {
      const num = Number(hit[1])
      const cur = card.pr === undefined || card.pr === null ? [] : Array.isArray(card.pr) ? card.pr : [card.pr]
      const has = cur.some((v) => { const p = parsePr(v, repo); return p && p.repo === repo && p.num === num })
      // 已经写过这个号就一个字节都不动;新写的独苗写成标量,别为形制统一给别的卡制造 diff
      if (!has) { card.pr = cur.length ? [...cur, num] : num; prAdded = num }
    }
  }
  const written = writeCard(store, row, card)
  say({ ok: true, id, added: true, title, href, pr: prAdded, file: row.where, card: written }, S.linkDone(id, href, prAdded))
}

function cmdShow() {
  const id = pos[2]
  if (!id) die(S.showUsage())
  const { store, row } = findCard(id)
  if (flags.json) { console.log(JSON.stringify(row.card, null, 2)); return }
  console.log(S.showHead(String(row.card.id), KIND_NAME[store.k.key], row.where))
  for (const [key, value] of Object.entries(row.card)) {
    if (key === 'id') continue
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    console.log(`  ${key}: ${String(text).replace(/\n/g, '\n    ')}`)
  }
}

function allCards() {
  const out = []
  for (const k of CARD_KINDS) {
    const store = storeOf(k)
    const cards = store.rows.map((r) => r.card)
    for (const card of store.split ? sortCards(cards) : cards) out.push({ kind: KIND_NAME[k.key], card })
  }
  return out
}

function cmdList() {
  const hasTok = (v, want) => String(v || '').split(/\s+/).filter(Boolean).includes(want)
  let rows = allCards()
  if (flags.status) rows = rows.filter((r) => String(r.card.status || '') === flags.status)
  if (flags.line) rows = rows.filter((r) => hasTok(r.card.line, flags.line))
  if (flags.session) rows = rows.filter((r) => hasTok(r.card.session, flags.session))
  if (flags.since) {
    if (!DATE_RE.test(flags.since)) die(S.dateBad(flags.since))
    rows = rows.filter((r) => DATE_RE.test(String(r.card.date || '')) && String(r.card.date) >= flags.since)
  }
  if (flags.json) { console.log(JSON.stringify(rows.map((r) => r.card), null, 2)); return }
  if (!rows.length) { console.log(S.listEmpty()); return }
  const cell = (v, w) => String(v ?? '').padEnd(w)
  console.log(S.listHead())
  for (const r of rows) {
    const c = r.card
    console.log(`${cell(c.id, 12)}${cell(c.status, 10)}${cell(c.line, 6)}${cell(c.session, 10)}${cell(c.date, 12)}${String(c.title ?? '')}`)
  }
  console.log(S.listCount(rows.length))
}

function cmdHistory() {
  const id = pos[2]
  if (!id) die(S.historyUsage())
  const { store, row } = findCard(id)
  if (!store.split) die(S.historyUnsplit())
  const r = spawnSync('git', ['log', '--format=%cs %h %s', '--', row.where], { cwd: KANBAN, encoding: 'utf8' })
  if (r.error || r.status !== 0) die(S.historyFailed((r.stderr || (r.error && r.error.message) || `exit ${r.status}`).toString().trim()))
  const lines = r.stdout.split('\n').filter(Boolean)
  if (flags.json) { console.log(JSON.stringify(lines, null, 2)); return }
  if (!lines.length) { console.log(S.historyEmpty(id, row.where)); return }
  console.log(S.historyHead(id, row.where))
  for (const l of lines) console.log(`  ${l}`)
}

/** 与今天的 manifest 同形的一坨:头 + 数组,顺序照 gen(order 再 id),order 排完即删 */
function cmdExport() {
  const out = {}
  for (const k of CARD_KINDS) {
    const store = storeOf(k)
    const head = { ...store.head }
    const cards = store.rows.map((r) => r.card)
    head[k.key] = store.split ? stripOrder(sortCards(cards)) : cards
    out[k.sub] = head
  }
  const text = jsonText(out)
  if (!flags.out) { process.stdout.write(text); return }
  try { atomicWrite(resolve(flags.out), text) } catch (e) { die(S.writeFailed(flags.out, e.message)) }
  console.error(S.exportWrote(flags.out))
}

// ---- 分派 ----------------------------------------------------------------
const CARD_CMDS = { new: cmdNew, set: cmdSet, status: cmdStatus, note: cmdNote, link: cmdLink, show: cmdShow, list: cmdList, history: cmdHistory }
if (pos[0] === 'card') {
  const run = CARD_CMDS[pos[1]]
  if (!run) die(S.unknownCardCmd(String(pos[1] ?? ''), Object.keys(CARD_CMDS)))
  run()
} else if (pos[0] === 'export') {
  cmdExport()
} else {
  die(S.unknownCmd(pos[0]))
}
