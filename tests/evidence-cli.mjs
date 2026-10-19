import assert from 'node:assert/strict'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url)), CLI = join(HERE, '../scripts/ddd.mjs')
const WORK = realpathSync(mkdtempSync(join(tmpdir(), 'ddd-evidence-cli-'))), DAY = 86400000
const read = p => JSON.parse(readFileSync(p, 'utf8'))
const write = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
let checks = 0
function check(name, run) { run(); checks++; console.log(`ok ${name}`) }
function fixture(name, split = false) {
  const root = join(WORK, name); mkdirSync(root)
  const config = { lang: 'en', ...(split ? { cardsDir: 'cards' } : {}) }
  const statuses = { ready: 'Ready', done: 'Done', live: 'Live', closed: 'Closed' }
  const common = { statuses, groups: Object.keys(statuses).map(id => ({ id })), instance: { ghRepo: 'fixture/repo', branch: 'main' } }
  const card = { id: 'B1', title: 'Fixture', status: 'ready', tier: '1', priority: 'med', note: '', shots: ['existing.png', { file: 'old.png', caption: 'keep' }] }
  write(join(root, 'kanban.config.json'), config)
  write(join(root, 'manifest.json'), { ...common, tasks: [{ id: 'T1', title: 'Task', status: 'ready' }] })
  write(join(root, 'backlog-manifest.json'), { ...common, tiers: { 1: 'Core' }, priorities: { med: 'Medium' }, ...(!split ? { items: [card] } : {}) })
  write(join(root, 'decisions-manifest.json'), { ...common, ...(!split ? { entries: [{ id: 'D1', code: 'D1', status: 'ready' }] } : {}) })
  if (split) {
    mkdirSync(join(root, 'cards/backlog'), { recursive: true }); mkdirSync(join(root, 'cards/decisions'))
    write(join(root, 'cards/backlog/B1.json'), card)
    write(join(root, 'cards/decisions/D1.json'), { id: 'D1', code: 'D1', status: 'ready' })
  }
  const source = join(root, 'source.png'); writeFileSync(source, 'fixture png bytes')
  const cardPath = split ? join(root, 'cards/backlog/B1.json') : join(root, 'backlog-manifest.json')
  const getCard = () => split ? read(cardPath) : read(cardPath).items[0]
  const saveCard = c => { if (split) write(cardPath, c); else { const doc = read(cardPath); doc.items[0] = c; write(cardPath, doc) } }
  const run = (args, options = {}) => spawnSync(process.execPath, [CLI, ...args, '--dir', root], { encoding: 'utf8', ...options })
  const json = args => { const r = run([...args, '--json']); assert.equal(r.status, 0, r.stderr || r.stdout); return JSON.parse(r.stdout) }
  const add = () => json(['evidence', 'add', 'B1', source])
  const registry = join(root, '.ddd-evidence/registry.json')
  return { root, source, run, json, add, registry, getCard, saveCard }
}
function tree(root) {
  const rows = []
  function visit(dir) { for (const n of readdirSync(dir).sort()) { const p = join(dir, n), st = lstatSync(p); rows.push([p, st.mtimeMs, st.isFile() ? readFileSync(p).toString('hex') : 'dir']); if (st.isDirectory()) visit(p) } }
  visit(root); return rows
}
try {
  check('help works outside a board and evidence flags remain scoped', () => {
    const r = spawnSync(process.execPath, [CLI, 'evidence', '--help'], { cwd: WORK, encoding: 'utf8', env: { ...process.env, DDD_PROJECT_DIR: '', CLAUDE_PROJECT_DIR: '' } })
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /promote/)
    const f = fixture('flags'), before = tree(f.root)
    for (const args of [ ['evidence', 'config', '--enabled', 'yes'], ['evidence', 'config', '--grace-days', '-1'], ['evidence', 'config', '--grace-days', '1.5'], ['evidence', 'config', '--grace-days', '36501'], ['evidence', 'config', '--inherit'], ['evidence', 'config', '--card', 'B1', '--inherit', '--enabled', 'true'], ['evidence', 'add', 'B1', f.source, '--apply'], ['evidence', 'prune', '--apply', '--dry-run'], ['evidence', 'prune', '--delete-root', WORK], ['evidence', 'config', '--enabled'], ['card', 'set', 'B1', 'note', 'x', '--enabled', 'true'] ]) {
      const bad = f.run(args); assert.equal(bad.status, 1, args.join(' ')); assert.ok(bad.stderr.length)
    }
    assert.deepEqual(tree(f.root), before)
    const invalid = f.run(['card', 'set', 'B1', 'screenshotRetention', '{"enabled":1}', '--json'])
    assert.equal(invalid.status, 1); assert.match(invalid.stderr, /EVIDENCE_POLICY/)
    assert.deepEqual(tree(f.root), before)
  })
  for (const split of [false, true]) {
    const shape = split ? 'split' : 'inline'
    check(`${shape}: absent registry leaves ordinary card output and evidence storage unchanged`, () => {
      const f = fixture('none-' + shape, split)
      const r = f.json(['card', 'set', 'B1', 'note', '"still works"'])
      assert.equal(r.card.note, 'still works'); assert.equal(existsSync(join(f.root, '.ddd-evidence')), false)
      assert.deepEqual(f.json(['evidence', 'list']).entries, [])
    })
    check(`${shape}: partial project and card policy updates preserve inheritance`, () => {
      const f = fixture('policy-' + shape, split)
      assert.deepEqual(f.json(['evidence', 'config']).policy, { enabled: false, graceDays: 14 })
      f.json(['evidence', 'config', '--enabled=true', '--grace-days=8'])
      f.json(['evidence', 'config', '--grace-days', '5'])
      assert.deepEqual(read(join(f.root, 'kanban.config.json')).screenshotRetention, { enabled: true, graceDays: 5 })
      const p = f.json(['evidence', 'config', '--card', 'B1', '--enabled', 'false'])
      assert.deepEqual(p.override, { enabled: false }); assert.deepEqual(p.policy, { enabled: false, graceDays: 5 })
      f.json(['evidence', 'config', '--card', 'B1', '--grace-days', '2'])
      assert.deepEqual(f.getCard().screenshotRetention, { enabled: false, graceDays: 2 })
      f.json(['evidence', 'config', '--card', 'B1', '--inherit'])
      assert.equal(f.getCard().screenshotRetention, undefined)
      assert.deepEqual(f.json(['evidence', 'config', '--card', 'B1']).policy, { enabled: true, graceDays: 5 })
    })
    check(`${shape}: add and repeated promotion preserve existing shots and protect durable refs`, () => {
      const f = fixture('promote-' + shape, split), added = f.add()
      assert.ok(existsSync(added.path)); assert.ok(existsSync(f.source))
      const promoted = f.json(['evidence', 'promote', added.entry.id])
      assert.equal(readFileSync(promoted.path, 'utf8'), 'fixture png bytes')
      const shots = ['existing.png', { file: 'old.png', caption: 'keep' }, promoted.entry.durablePath]
      assert.deepEqual(f.getCard().shots, shots)
      f.json(['evidence', 'promote', added.entry.id]); assert.deepEqual(f.getCard().shots, shots)
      f.json(['card', 'status', 'B1', 'done']); assert.ok(existsSync(promoted.path)); assert.ok(existsSync(added.path))
    })
    for (const method of ['status', 'set']) check(`${shape}: ${method} terminal transition deletes only registered unlinked image`, () => {
      const f = fixture(`close-${shape}-${method}`, split), a = f.add()
      const legacy = join(f.root, '.ddd-evidence/tmp/unregistered.png'); writeFileSync(legacy, 'legacy')
      f.json(method === 'set' ? ['card', 'set', 'B1', 'status', '"closed"'] : ['card', 'status', 'B1', 'done'])
      assert.equal(existsSync(a.path), false); assert.ok(existsSync(f.source)); assert.ok(existsSync(legacy))
      assert.equal(read(f.registry).entries[0].reason, 'retention-off')
    })
    check(`${shape}: reopen clears closure and read-only operations preserve expired images`, () => {
      const f = fixture('reopen-' + shape, split)
      f.json(['evidence', 'config', '--enabled', 'true'])
      const a = f.add(); f.json(['card', 'status', 'B1', 'done'])
      const registry = read(f.registry); registry.cards.B1.closedAt = Date.now() - 20 * DAY; write(f.registry, registry)
      const before = tree(f.root)
      f.json(['card', 'show', 'B1']); f.json(['card', 'list']); f.json(['export']); f.json(['evidence', 'list']); f.json(['evidence', 'config', '--card', 'B1'])
      const preview = f.json(['evidence', 'prune']); assert.equal(preview.actions[0].action, 'would-delete')
      f.json(['evidence', 'prune', '--dry-run']); assert.deepEqual(tree(f.root), before); assert.ok(existsSync(a.path))
      f.json(['card', 'status', 'B1', 'ready']); assert.equal(read(f.registry).cards.B1.closedAt, null); assert.ok(existsSync(a.path))
      f.json(['card', 'status', 'B1', 'done']); assert.ok(read(f.registry).cards.B1.closedAt > Date.now() - DAY)
      const old = read(f.registry); old.cards.B1.closedAt -= 20 * DAY; write(f.registry, old)
      f.json(['card', 'note', 'B1', 'next mutation sweeps expired screenshots']); assert.equal(existsSync(a.path), false)
    })
    check(`${shape}: explicit prune apply cleans expired evidence`, () => {
      const f = fixture('prune-' + shape, split), a = f.add()
      f.saveCard({ ...f.getCard(), status: 'done' })
      const r = f.json(['evidence', 'prune', '--apply']); assert.equal(r.dryRun, false); assert.equal(existsSync(a.path), false)
    })
  }
  check('closed-card registration reports actual state and deletion counts do not repeat', () => {
    const f = fixture('closed-add')
    f.saveCard({ ...f.getCard(), status: 'done' })
    const r = f.run(['evidence', 'add', 'B1', f.source, '--json'])
    assert.equal(r.status, 0, r.stderr)
    const added = JSON.parse(r.stdout)
    assert.equal(added.entry.state, 'deleted'); assert.equal(existsSync(added.path), false)
    assert.equal(added.maintenance.actions[0].action, 'deleted'); assert.match(r.stderr, /removed 1/)
    const next = f.run(['card', 'note', 'B1', 'preserve tombstone'])
    assert.equal(next.status, 0, next.stderr); assert.doesNotMatch(next.stderr, /removed/)
  })
  check('new, link and after card mutations sweep evidence', () => {
    for (const [name, args] of [['new', ['card', 'new', 'backlog']], ['link', ['card', 'link', 'B1', 'Fixture', 'https://example.invalid/fixture']], ['after', ['card', 'after', 'B1', 'D1']]]) {
      const f = fixture('sweep-' + name), a = f.add()
      f.saveCard({ ...f.getCard(), status: 'done' })
      f.json(args); assert.equal(existsSync(a.path), false)
    }
  })
  check('runtime errors select the board language and JSON errors stay machine-readable', () => {
    const f = fixture('languages')
    write(join(f.root, 'kanban.config.json'), { lang: 'zh' })
    const r = f.run(['evidence', 'config', '--enabled', 'yes', '--json'])
    assert.equal(r.status, 1); const error = JSON.parse(r.stdout)
    assert.equal(error.code, 'EVIDENCE_POLICY'); assert.match(error.message, /截图保留/)
    const bad = f.run(['evidence', 'list', '--unknown', '--json'])
    assert.equal(bad.status, 1); assert.equal(JSON.parse(bad.stdout).code, 'EVIDENCE_ARGS')
  })
  check('task-card promotion and policy use the supported inline card shape', () => {
    const f = fixture('tasks'), added = f.json(['evidence', 'add', 'T1', f.source])
    f.json(['evidence', 'config', '--card', 'T1', '--enabled', 'true'])
    const r = f.json(['evidence', 'promote', added.entry.id])
    assert.deepEqual(read(join(f.root, 'manifest.json')).tasks[0].shots, [r.entry.durablePath])
  })
  check('cleanup failure warns after a successful card write without changing exit status', () => {
    const f = fixture('warning'); f.add()
    writeFileSync(f.registry, 'invalid registry')
    const r = f.run(['card', 'set', 'B1', 'note', '"written"', '--json'])
    assert.equal(r.status, 0); assert.equal(f.getCard().note, 'written'); assert.match(r.stderr, /main write succeeded/); assert.match(r.stderr, /EVIDENCE_REGISTRY/)
  })
  check('acceptance read-only list does not sweep but precheck and rotation do', () => {
    const f = fixture('acceptance')
    write(join(f.root, 'acceptance-manifest.json'), { lists: [{ pr: 1, title: 'Fixture', items: [{ id: 'A1', shots: ['existing.png'] }] }] })
    const a = f.add(); f.saveCard({ ...f.getCard(), status: 'done' })
    const before = tree(f.root); f.json(['acc', 'precheck', '1', '--list']); assert.deepEqual(tree(f.root), before)
    f.json(['acc', 'precheck', '1', 'A1', '--result', 'ok', '--note', 'checked']); assert.equal(existsSync(a.path), false)
    f.saveCard({ ...f.getCard(), status: 'ready' }); const b = f.add(); f.saveCard({ ...f.getCard(), status: 'done' })
    f.json(['acc', 'shots', 'rotate', '1', 'A1']); assert.equal(existsSync(b.path), false)
  })
  check('acceptance rotation still sweeps with an irrelevant --list flag', () => {
    const f = fixture('rotation-list')
    write(join(f.root, 'acceptance-manifest.json'), { lists: [{ pr: 1, title: 'Fixture', items: [{ id: 'A1', shots: ['existing.png'] }] }] })
    const a = f.add(); f.saveCard({ ...f.getCard(), status: 'done' })
    f.json(['acc', 'shots', 'rotate', '1', 'A1', '--list'])
    assert.equal(existsSync(a.path), false)
    assert.equal(read(join(f.root, 'acceptance-manifest.json')).lists[0].items[0].shotsHistory.length, 1)
  })
  check('pr-sync only sweeps with --settle --write, using a local gh fixture', () => {
    const f = fixture('pr-sync'), bin = join(f.root, 'bin'); mkdirSync(bin)
    const gh = join(bin, 'gh')
    writeFileSync(gh, `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv[2] === 'pr' ? [{number:1,title:'fixture',state:'MERGED',baseRefName:'main',mergedAt:'2026-01-01T00:00:00Z'}] : []))\n`); chmodSync(gh, 0o755)
    f.saveCard({ ...f.getCard(), pr: 1 })
    const a = f.add(), env = { ...process.env, PATH: bin }
    for (const args of [[], ['--settle'], ['--settle', '--write', '--dry-run']]) {
      const r = f.run(['pr-sync', ...args], { env }); assert.equal(r.status, 0, r.stderr); assert.ok(existsSync(a.path)); assert.equal(f.getCard().status, 'ready')
    }
    const r = f.run(['pr-sync', '--settle', '--write'], { env }); assert.equal(r.status, 0, r.stderr); assert.equal(f.getCard().status, 'done'); assert.equal(existsSync(a.path), false)
    f.saveCard({ ...f.getCard(), status: 'ready' }); const b = f.add(); f.saveCard({ ...f.getCard(), status: 'done' })
    for (const args of [[], ['--settle'], ['--settle', '--write', '--dry-run']]) {
      const readonly = f.run(['pr-sync', ...args], { env }); assert.equal(readonly.status, 0, readonly.stderr); assert.ok(existsSync(b.path))
    }
    const noCandidates = f.run(['pr-sync', '--settle', '--write'], { env }); assert.equal(noCandidates.status, 0, noCandidates.stderr); assert.equal(existsSync(b.path), false)
  })
  console.log(`${checks} evidence CLI checks passed`)
} finally { rmSync(WORK, { recursive: true, force: true }) }
