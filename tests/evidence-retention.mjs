import assert from 'node:assert/strict'
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { loadEvidenceBoard, maintainEvidence, promoteScreenshot, registerScreenshot, resolvePolicy, validatePolicy, listEvidence } from '../scripts/evidence-retention.mjs'

const WORK = realpathSync(mkdtempSync(join(tmpdir(), 'ddd-evidence-'))), DAY = 86400000, NOW = 1800000000000
const write = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
const statuses = { ready: 'open', done: 'done', live: 'live', closed: 'closed' }
let checks = 0
function check(name, fn) { fn(); checks++; console.log(`ok ${name}`) }
function fixture(name, policy) {
  const root = join(WORK, name); mkdirSync(root)
  const config = { screenshotRetention: policy }, card = { id: 'B1', status: 'ready' }
  write(join(root, 'kanban.config.json'), config)
  write(join(root, 'manifest.json'), { tasks: [], statuses })
  write(join(root, 'backlog-manifest.json'), { items: [card], statuses })
  write(join(root, 'decisions-manifest.json'), { entries: [], statuses })
  const source = join(root, 'original.png'); writeFileSync(source, 'source png fixture bytes')
  const saveCard = c => write(join(root, 'backlog-manifest.json'), { items: [c], statuses })
  const add = () => registerScreenshot(root, { cardId: 'B1', source, now: NOW })
  return { root, config, card, source, saveCard, add }
}
function tree(root) {
  const rows = []
  function visit(dir) { for (const n of readdirSync(dir).sort()) { const p = join(dir, n), st = lstatSync(p); rows.push([p, st.mtimeMs, st.isFile() ? readFileSync(p).toString('hex') : 'dir']); if (st.isDirectory()) visit(p) } }
  visit(root); return rows
}
try {
  check('policy defaults, partial inheritance and strict invalid values', () => {
    assert.deepEqual(resolvePolicy(), { enabled: false, graceDays: 14 })
    assert.deepEqual(resolvePolicy({ enabled: true }, { graceDays: undefined }), { enabled: true, graceDays: 14 })
    assert.deepEqual(resolvePolicy({ enabled: true, graceDays: 9 }, { enabled: false }), { enabled: false, graceDays: 9 })
    for (const v of [null, [], true, { enabled: 1 }, { graceDays: -1 }, { graceDays: 1.1 }, { graceDays: 36501 }, { unknown: true }]) assert.throws(() => validatePolicy(v), { code: 'EVIDENCE_POLICY' })
  })
  check('no registry is a byte and mtime no-op', () => {
    const f = fixture('none'); const before = tree(f.root)
    assert.deepEqual(maintainEvidence(f.root), { entries: [], actions: [], dryRun: false })
    assert.deepEqual(tree(f.root), before)
  })
  check('default off deletes only registered copy when closed and keeps tombstone', () => {
    const f = fixture('off'), { entry, path } = f.add()
    const legacy = join(f.root, '.ddd-evidence/tmp/legacy.png'); writeFileSync(legacy, 'legacy')
    f.card.status = 'done'; f.saveCard(f.card)
    const r = maintainEvidence(f.root, { now: NOW })
    assert.equal(r.actions[0].reason, 'retention-off'); assert.equal(existsSync(path), false)
    assert.equal(existsSync(f.source), true); assert.equal(existsSync(legacy), true)
    assert.equal(r.entries[0].id, entry.id); assert.equal(r.entries[0].state, 'deleted')
  })
  check('14 days, reopen resets timer, alternate terminal status and expiry', () => {
    const f = fixture('reopen', { enabled: true }), { path } = f.add()
    f.card.status = 'closed'; f.saveCard(f.card); maintainEvidence(f.root, { now: NOW })
    assert.equal(maintainEvidence(f.root, { now: NOW + 13 * DAY }).actions[0].reason, 'grace')
    f.card.status = 'ready'; f.saveCard(f.card); maintainEvidence(f.root, { now: NOW + 13 * DAY })
    f.card.status = 'live'; f.saveCard(f.card); maintainEvidence(f.root, { now: NOW + 14 * DAY })
    assert.equal(maintainEvidence(f.root, { now: NOW + 27 * DAY }).actions[0].reason, 'grace')
    assert.equal(existsSync(path), true)
    assert.equal(maintainEvidence(f.root, { now: NOW + 28 * DAY }).actions[0].reason, 'grace-expired')
    assert.equal(existsSync(path), false)
  })
  check('card overrides enable, duration and disable project retention', () => {
    for (const [name, project, override, delay] of [ ['override-on', {}, { enabled: true, graceDays: 2 }, 2], ['override-off', { enabled: true }, { enabled: false }, 0], ['override-days', { enabled: true }, { graceDays: 0 }, 0] ]) {
      const f = fixture(name, project), { path } = f.add(); f.card.status = 'done'; f.card.screenshotRetention = override; f.saveCard(f.card)
      maintainEvidence(f.root, { now: NOW }); assert.equal(existsSync(path), delay > 0)
      maintainEvidence(f.root, { now: NOW + delay * DAY }); assert.equal(existsSync(path), false)
    }
  })
  check('card history, shared links, walkthrough and acceptance history protect direct refs', () => {
    for (const kind of ['shots', 'history', 'shared', 'walkthrough', 'acceptance', 'feedback']) {
      const f = fixture('protect-' + kind), { entry, path } = f.add()
      f.card.status = 'done'
      if (kind === 'shots') f.card.shots = [{ file: entry.path }]
      if (kind === 'history') f.card.iters = [{ shotsHistory: [{ shots: [entry.path] }] }]
      if (kind === 'walkthrough') f.card.walkthroughs = [{ shots: [{ file: './' + entry.path }] }]
      if (kind === 'shared') write(join(f.root, 'decisions-manifest.json'), { entries: [{ id: 'D2', status: 'live', links: [{ href: entry.path + '?v=1#shot' }] }] })
      if (kind === 'acceptance') write(join(f.root, 'acceptance-manifest.json'), { lists: [{ items: [{ shotsHistory: [{ shots: [entry.path] }] }] }] })
      if (kind === 'feedback') writeFileSync(join(f.root, 'acceptance-feedback.jsonl'), JSON.stringify({ shots: [entry.path] }) + '\n')
      f.saveCard(f.card)
      assert.equal(maintainEvidence(f.root, { now: NOW }).actions[0].reason, 'linked'); assert.equal(existsSync(path), true)
    }
  })
  check('browser URL whitespace normalization protects clickable card links', () => {
    const hrefs = [ p => ` ${p} `, p => `\u001f \t${p}?v=1#shot\r\n `, p => p.replace('/tmp/', '/t\tm\np/\r') + '?v=1#shot', p => p.replaceAll('/', '\\') ]
    for (let i = 0; i < hrefs.length; i++) {
      const f = fixture('url-space-' + i), { entry, path } = f.add(), href = hrefs[i](entry.path)
      assert.equal(new URL(href, 'https://board.invalid/').pathname, '/' + entry.path)
      f.card.status = 'done'; f.card.links = [{ title: 'shot', href }]; f.saveCard(f.card)
      assert.equal(maintainEvidence(f.root, { now: NOW }).actions[0].reason, 'linked')
      assert.equal(existsSync(path), true)
    }
  })
  check('case aliases, symlink refs and local file URLs protect by file identity', () => {
    for (const kind of ['case', 'symlink', 'file-url']) {
      const f = fixture('identity-ref-' + kind), { entry, path } = f.add()
      let href
      if (kind === 'case') {
        href = entry.path.replace('.png', '.PNG')
        if (!existsSync(join(f.root, href))) symlinkSync(path, join(f.root, href))
      } else if (kind === 'symlink') {
        href = 'reference.png'; symlinkSync(path, join(f.root, href))
      } else href = pathToFileURL(path).href
      f.card.status = 'done'; f.card.links = [{ href }]; f.saveCard(f.card)
      assert.equal(maintainEvidence(f.root, { now: NOW }).actions[0].reason, 'linked')
      assert.equal(existsSync(path), true)
    }
  })
  check('inaccessible reference aliases fail closed while absent or long text paths are safe', () => {
    const f = fixture('inaccessible-ref'), { path } = f.add(), privateDir = join(f.root, 'private')
    mkdirSync(privateDir); symlinkSync(path, join(privateDir, 'linked.png'))
    f.card.status = 'done'; f.card.links = [{ href: 'private/linked.png' }]; f.saveCard(f.card)
    chmodSync(privateDir, 0)
    try {
      if (process.getuid?.() !== 0) assert.throws(() => maintainEvidence(f.root, { now: NOW }), { code: 'EVIDENCE_BOARD' })
      assert.equal(existsSync(path), true)
    } finally { chmodSync(privateDir, 0o700) }
    f.card.links = [{ href: 'missing/linked.png' }]; f.card.note = 'long text '.repeat(1000); f.saveCard(f.card)
    assert.equal(maintainEvidence(f.root, { now: NOW }).actions[0].reason, 'retention-off')
  })
  check('remote URLs cannot protect a similarly named local temporary file', () => {
    const f = fixture('remote-ref'), { entry, path } = f.add()
    f.card.status = 'done'; f.card.links = [{ href: ` https://remote.invalid/${entry.path} ` }]; f.saveCard(f.card)
    assert.equal(maintainEvidence(f.root, { now: NOW }).actions[0].reason, 'retention-off')
    assert.equal(existsSync(path), false)
  })
  check('promotion copies durable image, preserves metadata and remains protected after unlink', () => {
    const f = fixture('promote'), temp = f.add(), promoted = promoteScreenshot(f.root, { id: temp.entry.id, now: NOW })
    assert.equal(readFileSync(promoted.path, 'utf8'), readFileSync(f.source, 'utf8'))
    assert.equal(promoted.entry.createdAt, NOW); assert.match(promoted.entry.durablePath, /^shots\/B1-evidence-/)
    f.card.status = 'done'; f.saveCard(f.card)
    assert.equal(maintainEvidence(f.root, { now: NOW + 30 * DAY }).actions[0].reason, 'promoted')
    assert.equal(existsSync(promoted.path), true); assert.equal(existsSync(temp.path), true)
  })
  check('dry-run changes no bytes or timestamps and predicts deletion', () => {
    const f = fixture('dry'), { path } = f.add(); f.card.status = 'done'; f.saveCard(f.card)
    const before = tree(f.root); assert.equal(listEvidence(f.root).entries.length, 1); const r = maintainEvidence(f.root, { now: NOW, dryRun: true })
    assert.equal(r.actions[0].action, 'would-delete'); assert.equal(existsSync(path), true); assert.deepEqual(tree(f.root), before)
  })
  check('changed bytes, symlinks, hardlinks, missing owner and exclusive lock preserve files', () => {
    for (const kind of ['changed', 'replaced', 'symlink', 'hardlink', 'owner', 'unknown', 'missing-status', 'lock']) {
      const f = fixture('safety-' + kind), { path } = f.add(); f.card.status = 'done'; f.saveCard(f.card)
      if (kind === 'changed') writeFileSync(path, 'changed')
      if (kind === 'replaced') { const bytes = readFileSync(path); unlinkSync(path); writeFileSync(path, bytes) }
      if (kind === 'unknown') { f.card.status = 'not-defined'; f.saveCard(f.card) }
      if (kind === 'missing-status') { delete f.card.status; f.saveCard(f.card) }
      if (kind === 'symlink') { unlinkSync(path); symlinkSync(f.source, path) }
      if (kind === 'hardlink') { unlinkSync(path); linkSync(f.source, path) }
      if (kind === 'owner') write(join(f.root, 'backlog-manifest.json'), { items: [] })
      if (kind === 'lock') { writeFileSync(join(f.root, '.ddd-evidence/.lock'), 'busy'); assert.throws(() => maintainEvidence(f.root), { code: 'EVIDENCE_LOCK' }); continue }
      assert.equal(maintainEvidence(f.root, { now: NOW }).actions[0].action, 'preserved'); assert.equal(existsSync(path), true)
      assert.equal(readFileSync(f.source, 'utf8'), 'source png fixture bytes')
    }
  })
  check('registry escapes and corrupt expected board data fail closed', () => {
    for (const kind of ['registry', 'escape', 'missing', 'acceptance', 'feedback']) {
      const f = fixture('bad-' + kind), { path } = f.add(); f.card.status = 'done'; f.saveCard(f.card)
      const reg = join(f.root, '.ddd-evidence/registry.json')
      if (kind === 'registry') writeFileSync(reg, '{bad')
      if (kind === 'escape') { const d = JSON.parse(readFileSync(reg)); d.entries[0].path = '../original.png'; write(reg, d) }
      if (kind === 'missing') unlinkSync(join(f.root, 'manifest.json'))
      if (kind === 'acceptance') { write(join(f.root, 'kanban.config.json'), { acceptanceTab: true }) }
      if (kind === 'feedback') writeFileSync(join(f.root, 'acceptance-feedback.jsonl'), '{bad')
      assert.throws(() => maintainEvidence(f.root, { now: NOW })); assert.equal(existsSync(path), true)
    }
  })
  check('first historic closure observation starts the full grace period', () => {
    const f = fixture('historic', { enabled: true }), { path } = f.add()
    f.card.status = 'done'; f.saveCard(f.card)
    assert.equal(maintainEvidence(f.root, { now: NOW + 99 * DAY }).actions[0].reason, 'grace')
    assert.equal(existsSync(path), true)
  })
  check('broken optional source symlinks and symlinked owned directories fail closed', () => {
    for (const kind of ['optional', 'tmp']) {
      const f = fixture('links-' + kind), { path } = f.add(); f.card.status = 'done'; f.saveCard(f.card)
      if (kind === 'optional') symlinkSync(join(f.root, 'missing'), join(f.root, 'acceptance-manifest.json'))
      else { const dir = join(f.root, '.ddd-evidence/tmp'); const moved = join(f.root, 'moved'); renameSync(dir, moved); symlinkSync(moved, dir) }
      if (kind === 'optional') assert.throws(() => maintainEvidence(f.root, { now: NOW }), { code: 'EVIDENCE_PATH' })
      else assert.equal(maintainEvidence(f.root, { now: NOW }).actions[0].action, 'preserved')
      assert.equal(existsSync(path), true)
    }
  })
  check('split cards plus progress cards load with identities and policy', () => {
    const f = fixture('split'); mkdirSync(join(f.root, 'cards/backlog'), { recursive: true }); mkdirSync(join(f.root, 'cards/decisions'))
    write(join(f.root, 'kanban.config.json'), { cardsDir: 'cards' }); write(join(f.root, 'backlog-manifest.json'), { statuses }); write(join(f.root, 'decisions-manifest.json'), { statuses })
    write(join(f.root, 'cards/backlog/B1.json'), f.card); write(join(f.root, 'manifest.json'), { tasks: [{ id: 'T1', status: 'done' }], statuses })
    const board = loadEvidenceBoard(f.root); assert.deepEqual(board.cards.map(r => r.kind), ['tasks', 'items']); assert.equal(board.cards[1].key, undefined)
    const { path } = f.add(); f.card.status = 'done'; write(join(f.root, 'cards/backlog/B1.json'), f.card)
    maintainEvidence(f.root, { now: NOW }); assert.equal(existsSync(path), false)
  })
  console.log(`${checks} evidence retention checks passed`)
} finally { rmSync(WORK, { recursive: true, force: true }) }
