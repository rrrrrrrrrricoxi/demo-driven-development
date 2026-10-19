// 临时截图只由登记表管理；不认领旧文件，不删原图，不改卡或验收账。
import { constants, closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { cardsDirOf, CARD_KINDS } from './cards.mjs'
import { TERMINAL } from './settle.mjs'
import { shotHref } from './accpre.mjs'

const HOME = '.ddd-evidence', DAY = 86400000
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const EXT = /^\.(png|jpe?g|webp|gif)$/
const object = v => !!v && typeof v === 'object' && !Array.isArray(v)
const fail = (code) => { const e = new Error(code); e.code = code; throw e }
const clock = n => { if (!Number.isFinite(n) || n < 0) fail('EVIDENCE_TIME'); return n }
const hash = b => createHash('sha256').update(b).digest('hex')
const json = x => JSON.stringify(x, null, 2) + '\n'

export function validatePolicy(value) {
  if (value === undefined) return {}
  if (!object(value) || Object.keys(value).some(k => !['enabled', 'graceDays'].includes(k))) fail('EVIDENCE_POLICY')
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') fail('EVIDENCE_POLICY')
  if (value.graceDays !== undefined && (!Number.isInteger(value.graceDays) || value.graceDays < 0 || value.graceDays > 36500)) fail('EVIDENCE_POLICY')
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))
}
export function resolvePolicy(project, card) {
  return { enabled: false, graceDays: 14, ...validatePolicy(project), ...validatePolicy(card) }
}

// 每层都拒绝软链接。硬链接只可读；受管图片在复制、提升和删除前另查 nlink。
function safePath(root, path, { optional = false, file = false } = {}) {
  const base = resolve(root), abs = resolve(path), rel = relative(base, abs)
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) fail('EVIDENCE_PATH')
  let cur = base
  for (const bit of ['', ...rel.split(sep).filter(Boolean)]) {
    if (bit) cur = join(cur, bit)
    let st
    try { st = lstatSync(cur) } catch (e) { if (optional && e.code === 'ENOENT') return abs; fail('EVIDENCE_PATH') }
    if (st.isSymbolicLink()) fail('EVIDENCE_PATH')
    if (cur !== abs && !st.isDirectory()) fail('EVIDENCE_PATH')
    if (cur === abs && file && !st.isFile()) fail('EVIDENCE_PATH')
  }
  return abs
}
function readJson(root, path) {
  safePath(root, path, { file: true })
  try { const v = JSON.parse(readFileSync(path, 'utf8')); if (!object(v)) fail('EVIDENCE_BOARD'); return v }
  catch { fail('EVIDENCE_BOARD') }
}
export function loadEvidenceBoard(kanbanDir) {
  const root = resolve(kanbanDir), config = readJson(root, join(root, 'kanban.config.json'))
  validatePolicy(config.screenshotRetention)
  let split
  try { split = cardsDirOf(config) } catch { fail('EVIDENCE_BOARD') }
  const cards = [], sources = [config], ids = new Set()
  function add(card, kind, file, key, index, statuses) {
    if (!object(card) || typeof card.id !== 'string' || !card.id || ids.has(card.id)) fail('EVIDENCE_BOARD')
    ids.add(card.id); validatePolicy(card.screenshotRetention)
    cards.push({ card, kind, file, knownStatus: typeof card.status === 'string' && object(statuses) && Object.hasOwn(statuses, card.status), ...(key ? { key, index } : {}) }); sources.push(card)
  }
  const mainFile = join(root, 'manifest.json'), main = readJson(root, mainFile)
  if (!Array.isArray(main.tasks)) fail('EVIDENCE_BOARD')
  sources.push(main); main.tasks.forEach((c, i) => add(c, 'tasks', mainFile, 'tasks', i, main.statuses))
  for (const k of CARD_KINDS) {
    const file = join(root, k.manifest), head = readJson(root, file)
    sources.push(head)
    if (!split) {
      if (!Array.isArray(head[k.key])) fail('EVIDENCE_BOARD')
      head[k.key].forEach((c, i) => add(c, k.key, file, k.key, i, head.statuses))
    } else {
      if (head[k.key] !== undefined) fail('EVIDENCE_BOARD')
      const dir = safePath(root, join(root, split, k.sub))
      for (const name of readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
        const p = join(dir, name), card = readJson(root, p)
        if (card.id !== name.slice(0, -5)) fail('EVIDENCE_BOARD')
        add(card, k.key, p, undefined, undefined, head.statuses)
      }
    }
  }
  for (const name of ['acceptance-manifest.json', 'path-manifest.json', 'release-manifest.json']) {
    const p = join(root, name)
    safePath(root, p, { optional: true })
    if (existsSync(p)) {
      const data = readJson(root, p)
      if (name === 'acceptance-manifest.json' && (!Array.isArray(data.lists) || data.lists.some(l => !object(l) || !Array.isArray(l.items)))) fail('EVIDENCE_BOARD')
      sources.push(data)
    } else if (name === 'acceptance-manifest.json' && (config.acceptanceTab === true || config.acceptanceFeedback)) fail('EVIDENCE_BOARD')
  }
  const feedback = join(root, 'acceptance-feedback.jsonl')
  safePath(root, feedback, { optional: true })
  if (existsSync(feedback)) {
    safePath(root, feedback, { file: true })
    try { for (const line of readFileSync(feedback, 'utf8').split(/\r?\n/).filter(l => l.trim())) { const row = JSON.parse(line); if (!object(row)) fail('EVIDENCE_BOARD'); sources.push(row) } }
    catch { fail('EVIDENCE_BOARD') }
  }
  return { config, cards, sources }
}

function registry(root) {
  const p = join(root, HOME, 'registry.json')
  safePath(root, p, { optional: true })
  if (!existsSync(p)) return null
  let data
  try { data = JSON.parse(readFileSync(p, 'utf8')) } catch { fail('EVIDENCE_REGISTRY') }
  if (lstatSync(p).nlink !== 1) fail('EVIDENCE_REGISTRY')
  if (!object(data) || Object.keys(data).some(k => !['version', 'entries', 'cards'].includes(k)) || data.version !== 1 || !Array.isArray(data.entries) || !object(data.cards)) fail('EVIDENCE_REGISTRY')
  const ids = new Set()
  for (const e of data.entries) {
    if (!object(e) || Object.keys(e).some(k => !['id', 'cardId', 'ext', 'path', 'sha256', 'createdAt', 'state', 'dev', 'ino', 'durablePath', 'promotedAt', 'deletedAt', 'reason'].includes(k)) || !Number.isSafeInteger(e.dev) || !Number.isSafeInteger(e.ino) || !ID.test(e.id) || ids.has(e.id) || typeof e.cardId !== 'string' || !e.cardId || !EXT.test(e.ext) || e.path !== `${HOME}/tmp/${e.id}${e.ext}` || !/^[0-9a-f]{64}$/.test(e.sha256) || !Number.isFinite(e.createdAt) || e.createdAt < 0 || !['temporary', 'promoted', 'deleted'].includes(e.state)) fail('EVIDENCE_REGISTRY')
    if (e.state === 'promoted' && (!Number.isFinite(e.promotedAt) || e.promotedAt < 0 || typeof e.durablePath !== 'string' || !/^shots\/[A-Za-z0-9_-]+-evidence-[0-9a-f-]+\.(png|jpe?g|webp|gif)$/.test(e.durablePath))) fail('EVIDENCE_REGISTRY')
    if (e.state === 'deleted' && (!Number.isFinite(e.deletedAt) || !['grace-expired', 'retention-off'].includes(e.reason))) fail('EVIDENCE_REGISTRY')
    ids.add(e.id)
  }
  for (const v of Object.values(data.cards)) if (!object(v) || Object.keys(v).some(k => !['terminal', 'closedAt'].includes(k)) || typeof v.terminal !== 'boolean' || (v.closedAt !== null && (!Number.isFinite(v.closedAt) || v.closedAt < 0)) || (v.terminal !== (v.closedAt !== null))) fail('EVIDENCE_REGISTRY')
  return data
}
function withLock(root, init, fn) {
  safePath(root, join(root, HOME), { optional: true })
  if (init) {
    mkdirSync(join(root, HOME, 'tmp'), { recursive: true })
    safePath(root, join(root, HOME, 'tmp'))
    const ignore = join(root, HOME, '.gitignore')
    if (!existsSync(ignore)) writeFileSync(ignore, '*\n!.gitignore\n', { flag: 'wx' })
  }
  const p = join(root, HOME, '.lock')
  let fd
  try { fd = openSync(p, 'wx', 0o600) } catch { fail('EVIDENCE_LOCK') }
  try { return fn() } finally { closeSync(fd); unlinkSync(p) }
}
function save(root, data) {
  const p = join(root, HOME, 'registry.json'), tmp = `${p}.tmp-${randomUUID()}`
  writeFileSync(tmp, json(data), { flag: 'wx', mode: 0o600 })
  renameSync(tmp, p)
}
function image(root, e) {
  const path = safePath(root, join(root, e.path), { file: true }), fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const st = fstatSync(fd)
    if (!st.isFile() || st.nlink !== 1 || st.dev !== e.dev || st.ino !== e.ino) fail('EVIDENCE_PATH')
    const bytes = readFileSync(fd)
    if (hash(bytes) !== e.sha256) fail('EVIDENCE_CHANGED')
    return { path, bytes, ino: st.ino, dev: st.dev }
  } finally { closeSync(fd) }
}

export function registerScreenshot(kanbanDir, { cardId, source, now = Date.now() }) {
  const root = resolve(kanbanDir); clock(now)
  const board = loadEvidenceBoard(root)
  if (!board.cards.some(r => r.card.id === cardId)) fail('EVIDENCE_CARD')
  let src
  try { src = realpathSync(resolve(source)) } catch { fail('EVIDENCE_SOURCE') }
  const ext = extname(src).toLowerCase()
  if (!EXT.test(ext)) fail('EVIDENCE_SOURCE')
  // 先解析 /tmp 等系统别名；复制后的原图完全不归本机制管理。
  safePath(resolve(sep), src, { file: true })
  const fd = openSync(src, constants.O_RDONLY | constants.O_NOFOLLOW)
  let bytes
  try { if (!fstatSync(fd).isFile() || fstatSync(fd).nlink !== 1) fail('EVIDENCE_SOURCE'); bytes = readFileSync(fd) } finally { closeSync(fd) }
  return withLock(root, true, () => {
    const data = registry(root) || { version: 1, entries: [], cards: {} }
    const id = randomUUID(), entry = { id, cardId, ext, path: `${HOME}/tmp/${id}${ext}`, sha256: hash(bytes), createdAt: now, state: 'temporary' }
    const path = safePath(root, join(root, entry.path), { optional: true })
    writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 })
    const identity = lstatSync(path); entry.dev = identity.dev; entry.ino = identity.ino
    data.entries.push(entry); save(root, data)
    return { entry, path }
  })
}
export function promoteScreenshot(kanbanDir, { id, now = Date.now() }) {
  const root = resolve(kanbanDir); clock(now)
  if (!registry(root)) fail('EVIDENCE_NOT_FOUND')
  return withLock(root, false, () => {
    const data = registry(root), entry = data.entries.find(e => e.id === id)
    if (!entry || entry.state === 'deleted') fail('EVIDENCE_NOT_FOUND')
    if (entry.state === 'promoted') return { entry, path: join(root, entry.durablePath) }
    const img = image(root, entry)
    const prefix = entry.cardId.replace(/[^A-Za-z0-9_-]/g, '_') || 'card'
    const durablePath = `shots/${prefix}-evidence-${entry.id}${entry.ext}`
    safePath(root, join(root, 'shots'), { optional: true }); mkdirSync(join(root, 'shots'), { recursive: true })
    const path = safePath(root, join(root, durablePath), { optional: true })
    writeFileSync(path, img.bytes, { flag: 'wx' })
    entry.state = 'promoted'; entry.promotedAt = now; entry.durablePath = durablePath
    save(root, data)
    // 保留临时副本，避免提升时打断已有的直接引用；promoted 记录永久受保护。
    return { entry, path }
  })
}

// 保守识别所有数据源字符串：宁可多保护，不因字段换名或历史轮次删证据。
function references(root, sources) {
  const paths = new Set(), identities = new Set()
  function remember(s) {
    let path
    if (/^file:/i.test(s)) {
      try { path = fileURLToPath(s) } catch { return }
    } else {
      if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return
      s = s.split(/[?#]/)[0]
      try { s = decodeURIComponent(s) } catch {}
      path = resolve(root, s)
    }
    paths.add(path)
    // 大小写别名、符号链接和其它本地引用按文件身份保护；这里只读 stat，不读图片。
    try { const st = statSync(path); if (st.isFile()) identities.add(`${st.dev}:${st.ino}`) }
    catch (err) { if (!['ENOENT', 'ENOTDIR', 'ENAMETOOLONG', 'ERR_INVALID_ARG_VALUE'].includes(err.code)) fail('EVIDENCE_BOARD') }
  }
  function visit(v) {
    if (typeof v === 'string') {
      // 浏览器删去首尾 C0/空格和中间 TAB/LF/CR；同时保留原文，避免漏掉歧义文件名。
      const normalized = v.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '').replace(/[\t\n\r]/g, '')
      for (const candidate of new Set([v, normalized, normalized.replace(/\\/g, '/')])) {
        remember(candidate)
        remember(shotHref(candidate))
      }
    } else if (Array.isArray(v)) v.forEach(visit)
    else if (object(v)) Object.values(v).forEach(visit)
  }
  sources.forEach(visit); return { paths, identities }
}
export function listEvidence(kanbanDir) {
  const data = registry(resolve(kanbanDir))
  return { entries: data?.entries || [], cards: data?.cards || {} }
}
export function maintainEvidence(kanbanDir, { now = Date.now(), dryRun = false } = {}) {
  const root = resolve(kanbanDir); clock(now)
  if (!registry(root)) return { entries: [], actions: [], dryRun }
  function run() {
    const data = registry(root), board = loadEvidenceBoard(root), refs = references(root, board.sources), actions = []
    const byId = new Map(board.cards.map(r => [r.card.id, r.card])), known = new Set(board.cards.filter(r => r.knownStatus).map(r => r.card.id))
    for (const id of new Set(data.entries.map(e => e.cardId))) {
      const c = byId.get(id)
      if (!c || !known.has(id)) { delete data.cards[id]; continue }
      const terminal = TERMINAL.has(c.status), prev = data.cards[id]
      Object.defineProperty(data.cards, id, { value: { terminal, closedAt: terminal ? (prev?.terminal ? prev.closedAt : now) : null }, enumerable: true, writable: true, configurable: true })
    }
    for (const e of data.entries) {
      const report = (action, reason) => actions.push({ id: e.id, action, reason })
      if (e.state === 'deleted') { report('deleted', e.reason); continue }
      if (e.state === 'promoted') { report('protected', 'promoted'); continue }
      const c = byId.get(e.cardId)
      if (!c) { report('preserved', 'owner-missing'); continue }
      if (!known.has(e.cardId)) { report('preserved', 'status-unknown'); continue }
      if (refs.paths.has(resolve(root, e.path)) || refs.identities.has(`${e.dev}:${e.ino}`)) { report('protected', 'linked'); continue }
      const state = data.cards[e.cardId]
      if (!state.terminal) { report('preserved', 'card-open'); continue }
      const policy = resolvePolicy(board.config.screenshotRetention, c.screenshotRetention)
      if (policy.enabled && now - state.closedAt < policy.graceDays * DAY) { report('preserved', 'grace'); continue }
      try {
        const img = image(root, e), st = lstatSync(img.path)
        if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.ino !== img.ino || st.dev !== img.dev) fail('EVIDENCE_CHANGED')
        if (!dryRun) unlinkSync(img.path)
        e.state = 'deleted'; e.deletedAt = now; e.reason = policy.enabled ? 'grace-expired' : 'retention-off'
        report(dryRun ? 'would-delete' : 'deleted', e.reason)
      } catch (err) { report('preserved', err.code === 'EVIDENCE_CHANGED' ? 'changed' : 'unsafe-or-missing') }
    }
    if (!dryRun) save(root, data)
    return { entries: data.entries, actions, dryRun }
  }
  return dryRun ? run() : withLock(root, false, run)
}
