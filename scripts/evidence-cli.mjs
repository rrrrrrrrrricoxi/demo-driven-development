// 证据命令独立解析旗子；卡写入仍使用既有的原子写与 JSON 形制。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveKanbanDir } from './kanban-dir.mjs'
import { loadStrings, pickStrings } from './strings.mjs'
import { atomicWrite, jsonText } from './cards-lib.mjs'
import { cardText } from './cards.mjs'
import { listEvidence, loadEvidenceBoard, maintainEvidence, promoteScreenshot, registerScreenshot, resolvePolicy, validatePolicy } from './evidence-retention.mjs'

const fail = (code) => { const e = new Error(code); e.code = code; throw e }
export function evidenceError(S, error) {
  const code = Object.hasOwn(S.errors, error.code) ? error.code : 'EVIDENCE_IO'
  return S.error(code, S.errors[code])
}

// 主操作已落盘后，维护失败只能明确告警，不能假报卡写入失败。
export function maintainAfterWrite(kanbanDir) {
  const S = loadStrings(kanbanDir).evidence
  try {
    const before = new Set(listEvidence(kanbanDir).entries.filter(e => e.state !== 'deleted').map(e => e.id))
    const result = maintainEvidence(kanbanDir)
    const removed = result.actions.filter(a => a.action === 'deleted' && before.has(a.id)).length
    if (removed) console.error(S.cleaned(removed))
    if (result.actions.some(a => a.reason === 'unsafe-or-missing' || a.reason === 'changed')) {
      console.error(S.warning(evidenceError(S, { code: 'EVIDENCE_CLEANUP' })))
    }
    return result
  } catch (e) {
    console.error(S.warning(evidenceError(S, e)))
    return null
  }
}

function parse(argv) {
  const flags = {}, pos = []
  const values = new Set(['dir', 'enabled', 'grace-days', 'card'])
  const bools = new Set(['json', 'help', 'apply', 'dry-run', 'inherit'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') { pos.push(...argv.slice(i + 1)); break }
    if (!a.startsWith('--')) { pos.push(a); continue }
    const eq = a.indexOf('='), name = a.slice(2, eq < 0 ? undefined : eq)
    if (Object.hasOwn(flags, name)) fail('EVIDENCE_ARGS')
    if (bools.has(name)) {
      if (eq >= 0) fail('EVIDENCE_ARGS')
      flags[name] = true
    } else if (values.has(name)) {
      const value = eq < 0 ? argv[++i] : a.slice(eq + 1)
      if (value === undefined || value.startsWith('--') || !value.length) fail('EVIDENCE_ARGS')
      flags[name] = value
    } else fail('EVIDENCE_ARGS')
  }
  return { flags, pos }
}

function allowed(flags, names) {
  if (Object.keys(flags).some(k => !['dir', 'json', 'help', ...names].includes(k))) fail('EVIDENCE_ARGS')
}
function owner(board, id) {
  const row = board.cards.find(r => r.card.id === id)
  if (!row) fail('EVIDENCE_CARD')
  return row
}

// 核心载入器已校验文件路径和卡号；每次再读新盘，避免使用命令启动时的旧行。
function writeOwner(kanbanDir, id, update) {
  const row = owner(loadEvidenceBoard(kanbanDir), id)
  const next = update({ ...row.card })
  if (row.key) {
    const doc = JSON.parse(readFileSync(row.file, 'utf8'))
    if (doc[row.key]?.[row.index]?.id !== id) fail('EVIDENCE_BOARD')
    doc[row.key][row.index] = next
    atomicWrite(row.file, jsonText(doc))
  } else atomicWrite(row.file, cardText(next))
  return next
}

export function runEvidenceCli(argv) {
  let S = pickStrings().evidence, flags = { json: argv.includes('--json') }, kanbanDir
  // 错误也尽量使用看板语言；解析失败时仍只读定位目录。
  try {
    const dirArg = argv.find(a => a.startsWith('--dir='))
    const at = argv.indexOf('--dir')
    const dir = dirArg ? dirArg.slice(6) : at >= 0 ? argv[at + 1] : undefined
    try { kanbanDir = resolveKanbanDir(dir ? ['--dir', dir] : []); S = loadStrings(kanbanDir).evidence } catch {}
    const parsed = parse(argv)
    flags = parsed.flags
    const [command, ...args] = parsed.pos
    if (flags.help) { console.log(S.usage()); return 0 }
    if (!kanbanDir) fail('EVIDENCE_BOARD')
    let result, mutation = false
    if (command === 'add') {
      allowed(flags, [])
      if (args.length !== 2) fail('EVIDENCE_ARGS')
      result = registerScreenshot(kanbanDir, { cardId: args[0], source: args[1] })
      mutation = true
    } else if (command === 'promote') {
      allowed(flags, [])
      if (args.length !== 1) fail('EVIDENCE_ARGS')
      // 先确认所属卡仍在，复制与挂卡失败可安全重试，已提升的图不会被维护删除。
      const entry = listEvidence(kanbanDir).entries.find(e => e.id === args[0])
      if (!entry || entry.state === 'deleted') fail('EVIDENCE_NOT_FOUND')
      owner(loadEvidenceBoard(kanbanDir), entry.cardId)
      result = promoteScreenshot(kanbanDir, { id: args[0] })
      const card = writeOwner(kanbanDir, entry.cardId, c => {
        if (c.shots !== undefined && !Array.isArray(c.shots)) fail('EVIDENCE_BOARD')
        const shots = [...(c.shots || [])]
        if (!shots.some(s => (typeof s === 'string' ? s : s?.file) === result.entry.durablePath)) shots.push(result.entry.durablePath)
        return { ...c, shots }
      })
      result = { ...result, card }
      mutation = true
    } else if (command === 'list') {
      allowed(flags, [])
      if (args.length) fail('EVIDENCE_ARGS')
      result = listEvidence(kanbanDir)
    } else if (command === 'prune') {
      allowed(flags, ['dry-run', 'apply'])
      if (args.length || (flags.apply && flags['dry-run'])) fail('EVIDENCE_ARGS')
      result = maintainEvidence(kanbanDir, { dryRun: !flags.apply })
    } else if (command === 'config') {
      allowed(flags, ['enabled', 'grace-days', 'card', 'inherit'])
      if (args.length || (flags.inherit && (!flags.card || flags.enabled !== undefined || flags['grace-days'] !== undefined))) fail('EVIDENCE_ARGS')
      const board = loadEvidenceBoard(kanbanDir)
      const row = flags.card ? owner(board, flags.card) : null
      const patch = {}
      if (flags.enabled !== undefined) {
        if (!['true', 'false'].includes(flags.enabled)) fail('EVIDENCE_POLICY')
        patch.enabled = flags.enabled === 'true'
      }
      if (flags['grace-days'] !== undefined) {
        if (!/^\d+$/.test(flags['grace-days'])) fail('EVIDENCE_POLICY')
        patch.graceDays = Number(flags['grace-days'])
      }
      validatePolicy(patch)
      let policy = (row ? row.card : board.config).screenshotRetention
      if (flags.inherit) {
        writeOwner(kanbanDir, flags.card, c => { delete c.screenshotRetention; return c })
        policy = undefined
        mutation = true
      } else if (Object.keys(patch).length) {
        policy = { ...validatePolicy(policy), ...patch }
        if (row) writeOwner(kanbanDir, flags.card, c => ({ ...c, screenshotRetention: policy }))
        else {
          // 无异步间隙；只改指定配置，保留所有宿主字段。
          atomicWrite(join(kanbanDir, 'kanban.config.json'), jsonText({ ...board.config, screenshotRetention: policy }))
        }
        mutation = true
      }
      result = { cardId: flags.card || null, override: policy || null, policy: row ? resolvePolicy(board.config.screenshotRetention, policy) : resolvePolicy(policy) }
    } else fail('EVIDENCE_ARGS')
    if (mutation) {
      const maintenance = maintainAfterWrite(kanbanDir)
      result = { ...result, ...(result.entry && maintenance ? { entry: maintenance.entries.find(e => e.id === result.entry.id) || result.entry } : {}), maintenance }
    }
    console.log(flags.json ? JSON.stringify({ ok: true, ...result }, null, 2) : `${S.done(command)}\n${JSON.stringify(result, null, 2)}`)
    return 0
  } catch (e) {
    const message = evidenceError(S, e)
    if (flags.json) console.log(JSON.stringify({ ok: false, code: Object.hasOwn(S.errors, e.code) ? e.code : 'EVIDENCE_IO', message }, null, 2))
    else console.error(message)
    return 1
  }
}
