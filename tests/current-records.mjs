#!/usr/bin/env node
// 合成卡与临时板:不读取用户看板,不联系 harness 或共享服务。
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { currentRecordDependents, isContentUpdatedAt, resolveCurrentRecords } from '../scripts/current-records.mjs'
import { journeySummaryFields } from '../scripts/journey-summary.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let checks = 0
const check = (name, fn) => { fn(); checks++; console.log(`  ✓ ${name}`) }
const j = { decision: 'Chosen direction', progress: 'Business integration pending', recent: 'Controls clarified', current: { title: 'Current design', href: 'demos/current.html', links: [{ title: 'Specification', href: 'refs/spec.html' }] }, history: [], development: [] }
const source = { id: 'D1', code: 'D1', title: 'Authoritative decision', status: 'decided', contentUpdatedAt: '2026-11-10T10:00:00.000Z', journey: j }
const ref = { id: 'BL-1', title: 'Implementation', status: 'ready', note: 'Original notes', detail: 'Original detail', links: [{ title: 'Old demo', href: 'demos/old.html' }], shots: [{ file: 'original.png' }], journey: { currentFrom: 'D1', history: [{ title: 'Local historical direction', href: 'demos/old.html' }], development: [{ title: 'Local evidence', summary: '30 tests passed' }] } }
const chain = { id: 'D2', code: 'D2', title: 'Follow-up', status: 'deciding', journey: { currentFrom: 'BL-1', history: [], development: [] } }

check('same-order pure resolution preserves local and original records', () => {
  const input = [ref, source, chain], before = JSON.stringify(input)
  const out = resolveCurrentRecords(input, 'en')
  assert.equal(out[1], source)
  assert.notEqual(out[0], ref)
  assert.equal(JSON.stringify(input), before)
  for (const field of ['decision', 'progress', 'recent', 'current']) assert.deepEqual(out[0].journey[field], j[field])
  for (const field of ['note', 'detail', 'links', 'shots']) assert.deepEqual(out[0][field], ref[field])
  for (const field of ['history', 'development']) assert.equal(out[0].journey[field], ref.journey[field])
  assert.deepEqual(out[0].journey.currentSource, { id: 'D1', via: 'D1', contentUpdatedAt: source.contentUpdatedAt })
  assert.deepEqual(out[2].journey.currentSource, { id: 'D1', via: 'BL-1', contentUpdatedAt: source.contentUpdatedAt })
  assert.equal(out[0].contentUpdatedAt, undefined)
  assert.deepEqual(currentRecordDependents(input, 'D1'), ['BL-1', 'D2'])
})
check('source edits propagate through chains without rewriting reference cards', () => {
  const changed = { ...source, contentUpdatedAt: '2026-11-11T12:00:00+08:00', journey: { ...j, decision: 'New explicit direction' } }
  const out = resolveCurrentRecords([ref, changed, chain], 'en')
  assert.equal(out[2].journey.decision, changed.journey.decision)
  assert.equal(out[2].journey.currentSource.contentUpdatedAt, changed.contentUpdatedAt)
  assert.equal(ref.journey.decision, undefined)
  assert.equal(chain.journey.decision, undefined)
})
check('persisted display metadata cannot replace the explicit source identity', () => {
  const poisoned = { ...source, journey: { ...j, currentSource: { id: 'D999', contentUpdatedAt: '2000-01-01T00:00:00Z' } } }
  assert.equal(resolveCurrentRecords([ref, poisoned], 'en')[0].journey.currentSource.id, 'D1')
})
for (const lang of ['zh', 'en']) {
  const invalid = [
    [[ref], /不存在|missing/],
    [[{ ...ref, journey: { ...ref.journey, currentFrom: 'BL-1' } }], /自身|itself/],
    [[ref, { ...source, journey: undefined }], /没有 journey|has no journey/],
    [[ref, { ...source, journey: { ...j, currentFrom: 'BL-1', decision: undefined, progress: undefined, recent: undefined, current: undefined } }], /同时声明|cannot also declare/],
    [[source, { ...ref, journey: { ...ref.journey, decision: 'Stale duplicate' } }], /同时声明|cannot also declare/],
    [[source, { ...ref, journey: { currentFrom: 'D1', development: [] } }], /history/],
    [[source, { ...ref, journey: { ...ref.journey, currentFrom: 1 } }], /currentFrom/],
    [[source, { ...ref, journey: { ...ref.journey, currentFrom: ' D1 ' } }], /currentFrom/],
    [[source, { ...ref, journey: { ...ref.journey, history: [{ title: 'Bad URL', href: 'javascript:alert(1)' }] } }], /history/],
    [[{ ...source, journey: { currentFrom: 'D2', history: [], development: [] } }, { ...chain, journey: { currentFrom: 'D3', history: [], development: [] } }, { id: 'D3', journey: { currentFrom: 'D1', history: [], development: [] } }], /循环|cycle/],
    [[ref, { ...source, journey: { ...j, progress: '' } }], /progress/],
    [[{ ...source, contentUpdatedAt: '2026-02-30T10:00:00Z' }], /contentUpdatedAt/],
  ]
  for (const [i, [cards, expected]] of invalid.entries()) check(`${lang}: rejects invalid source graph ${i + 1}`, () => assert.throws(() => resolveCurrentRecords(cards, lang), expected))
}
check('strict timestamps require a real calendar date and explicit timezone', () => {
  for (const at of ['2026-11-10T12:30:00.123Z', '2024-02-29T12:30+08:00', '2000-02-29T00:00:00-05:30']) assert.ok(isContentUpdatedAt(at), at)
  for (const at of ['2026-02-29T12:30:00Z', '2026-02-30T12:30:00Z', '1900-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-00-10T12:30:00Z', '2026-11-00T12:30:00Z', '2026-11-10T25:30:00Z', '2026-11-10T12:61:00Z', '2026-11-10T12:30:61Z', '2026-11-10T12:30:00+24:00', '2026-11-10T12:30:00+08:60', '2026-11-10T12:30:00', 'today', null]) assert.equal(isContentUpdatedAt(at), false, String(at))
})
check('shared summaries produce one writing hint on the authoritative card', () => {
  const out = resolveCurrentRecords([ref, { ...source, journey: { ...j, progress: '30 tests passed' } }], 'en')
  assert.deepEqual(journeySummaryFields(out[0]), [])
  assert.deepEqual(journeySummaryFields(out[1]), ['progress'])
})

const root = mkdtempSync(join(tmpdir(), 'ddd-current-records-'))
try {
  for (const split of [false, true]) for (const lang of ['zh', 'en']) {
    const board = join(root, `${split ? 'split' : 'manifest'}-${lang}`)
    mkdirSync(board, { recursive: true })
    const write = (name, value) => writeFileSync(join(board, name), JSON.stringify(value, null, 2) + '\n')
    const read = (name) => JSON.parse(readFileSync(join(board, name), 'utf8'))
    const fill = (s) => s.replaceAll('{{BRAND}}', 'TEST').replaceAll('{{GH_REPO}}', 'owner/repo').replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '')
    const cfg = JSON.parse(fill(readFileSync(join(repo, 'templates/kanban.config.json'), 'utf8')))
    cfg.lang = lang; cfg.cardsDir = split ? 'cards' : null
    write('kanban.config.json', cfg)
    for (const name of ['manifest', 'backlog-manifest', 'decisions-manifest']) write(name + '.json', JSON.parse(fill(readFileSync(join(repo, 'templates/manifests', name + '.json'), 'utf8'))))
    const backlog = read('backlog-manifest.json'), decisions = read('decisions-manifest.json')
    backlog.tiers = { '1': 'Feature' }
    if (split) {
      delete backlog.items; delete decisions.entries
      mkdirSync(join(board, 'cards/backlog'), { recursive: true }); mkdirSync(join(board, 'cards/decisions'), { recursive: true })
      write('cards/backlog/BL-1.json', ref); write('cards/decisions/D1.json', source); write('cards/decisions/D2.json', chain)
    } else { backlog.items = [ref]; decisions.entries = [source, chain] }
    write('backlog-manifest.json', backlog); write('decisions-manifest.json', decisions)
    const readCard = (id) => split ? read(`cards/${id.startsWith('BL') ? 'backlog' : 'decisions'}/${id}.json`) : read(id.startsWith('BL') ? 'backlog-manifest.json' : 'decisions-manifest.json')[id.startsWith('BL') ? 'items' : 'entries'].find((c) => c.id === id)
    const writeCard = (card) => {
      if (split) write(`cards/${card.id.startsWith('BL') ? 'backlog' : 'decisions'}/${card.id}.json`, card)
      else {
        const file = card.id.startsWith('BL') ? 'backlog-manifest.json' : 'decisions-manifest.json', key = card.id.startsWith('BL') ? 'items' : 'entries'
        const head = read(file); head[key] = head[key].map((c) => c.id === card.id ? card : c); write(file, head)
      }
    }
    const run = (...args) => spawnSync(process.execPath, [join(repo, 'scripts/ddd.mjs'), '--dir', board, ...args], { encoding: 'utf8' })
    const good = (...args) => { const result = run(...args); assert.equal(result.status, 0, result.stderr); return result }
    const snapshot = () => Object.fromEntries(['BL-1', 'D1', 'D2'].map((id) => [id, readCard(id)]))
    const label = `${split ? 'split' : 'manifest'} ${lang}`
    check(`${label}: CLI help describes explicit resolved reads`, () => {
      const help = good('--help').stdout
      assert.match(help, /card show <id> \[--resolved\] \[--json\]/)
      assert.ok(help.includes(lang === 'en' ? 'Show the stored card by default' : '默认保留卡片原始字段'))
    })
    check(`${label}: raw show hints and resolved show inherits without writing`, () => {
      const before = snapshot(), shown = good('card', 'show', 'BL-1', '--json')
      assert.deepEqual(JSON.parse(shown.stdout), ref)
      assert.match(shown.stderr, /--resolved/)
      const resolved = JSON.parse(good('card', 'show', 'BL-1', '--resolved', '--json').stdout)
      assert.equal(resolved.journey.progress, j.progress)
      assert.deepEqual(resolved.journey.history, ref.journey.history)
      assert.deepEqual(snapshot(), before)
    })
    check(`${label}: journey writes validate the whole graph before writing`, () => {
      const before = snapshot()
      for (const value of [{ ...ref.journey, currentFrom: 'missing' }, { ...ref.journey, currentFrom: 'BL-1' }, { ...ref.journey, decision: 'Duplicate' }]) {
        const result = run('card', 'set', 'BL-1', 'journey', JSON.stringify(value), '--json')
        assert.notEqual(result.status, 0); assert.deepEqual(snapshot(), before)
      }
      const invalid = { ...chain, journey: { ...chain.journey, currentFrom: 'missing' } }
      writeCard(invalid)
      const brokenBefore = snapshot()
      assert.notEqual(run('card', 'set', 'D1', 'journey', JSON.stringify(j), '--json').status, 0)
      assert.deepEqual(snapshot(), brokenBefore)
      const audit = JSON.parse(good('audit', '--json').stdout)
      assert.ok(audit.broken.some((finding) => /currentFrom/.test(finding.text)))
      assert.deepEqual(snapshot(), brokenBefore)
      writeCard(chain)
    })
    check(`${label}: real source changes stamp only that card and propagate on read`, () => {
      const beforeRef = readCard('BL-1'), beforeChain = readCard('D2')
      const beforeBytes = split ? readFileSync(join(board, 'cards/backlog/BL-1.json'), 'utf8') : null
      const result = good('card', 'set', 'D1', 'journey', JSON.stringify({ ...j, recent: 'New source update' }), '--json')
      assert.ok(isContentUpdatedAt(readCard('D1').contentUpdatedAt))
      assert.notEqual(readCard('D1').contentUpdatedAt, source.contentUpdatedAt)
      assert.match(result.stderr, /BL-1/); assert.match(result.stderr, /D2/)
      assert.deepEqual(readCard('BL-1'), beforeRef); assert.deepEqual(readCard('D2'), beforeChain)
      if (split) assert.equal(readFileSync(join(board, 'cards/backlog/BL-1.json'), 'utf8'), beforeBytes)
      assert.equal(JSON.parse(good('card', 'show', 'D2', '--resolved', '--json').stdout).journey.recent, 'New source update')
    })
    check(`${label}: no-op set/status/after/link preserve bytes and content time`, () => {
      const file = split ? 'cards/backlog/BL-1.json' : 'backlog-manifest.json'
      const before = readFileSync(join(board, file), 'utf8'), mtime = statSync(join(board, file)).mtimeMs
      good('card', 'set', 'BL-1', 'title', ref.title)
      good('card', 'status', 'BL-1', 'ready')
      good('card', 'link', 'BL-1', 'Duplicate', 'demos/old.html')
      assert.equal(readFileSync(join(board, file), 'utf8'), before)
      assert.equal(statSync(join(board, file)).mtimeMs, mtime)
      good('card', 'after', 'BL-1', 'D1')
      const afterBytes = readFileSync(join(board, file), 'utf8')
      good('card', 'after', 'BL-1', 'D1')
      assert.equal(readFileSync(join(board, file), 'utf8'), afterBytes)
    })
    check(`${label}: note/status/link/after/set all record real card changes`, () => {
      const resetAt = '2000-01-01T00:00:00.000Z'
      for (const args of [['note', 'BL-1', 'Recorded local evidence'], ['status', 'BL-1', 'blocked'], ['link', 'BL-1', 'Evidence', 'refs/new.html'], ['after', 'BL-1', 'D2'], ['set', 'BL-1', 'title', 'Changed title']]) {
        good('card', 'set', 'BL-1', 'contentUpdatedAt', resetAt)
        good('card', ...args)
        assert.ok(isContentUpdatedAt(readCard('BL-1').contentUpdatedAt))
        assert.notEqual(readCard('BL-1').contentUpdatedAt, resetAt)
      }
    })
    check(`${label}: explicit migration time is preserved and impossible dates are rejected`, () => {
      const migrated = '2024-02-29T12:30:00+08:00'
      good('card', 'set', 'BL-1', 'contentUpdatedAt', migrated)
      assert.equal(readCard('BL-1').contentUpdatedAt, migrated)
      const before = snapshot()
      for (const at of ['2026-02-30T00:00:00Z', '2026-11-10T00:00:00']) assert.notEqual(run('card', 'set', 'BL-1', 'contentUpdatedAt', at).status, 0)
      assert.deepEqual(snapshot(), before)
      writeCard({ ...readCard('D2'), contentUpdatedAt: '2026-02-30T00:00:00Z' })
      const invalid = snapshot()
      const audit = JSON.parse(good('audit', '--json').stdout)
      assert.ok(audit.broken.some((finding) => finding.key === 'contentUpdatedAtInvalid'))
      assert.deepEqual(snapshot(), invalid)
      assert.notEqual(run('card', 'set', 'D2', 'title', 'Should not write').status, 0)
      assert.deepEqual(snapshot(), invalid)
      writeCard(chain)
    })
    check(`${label}: new cards receive content timestamps and allow explicit migration times`, () => {
      const fresh = JSON.parse(good('card', 'new', 'decision', '--title', 'New decision', '--json').stdout)
      assert.ok(isContentUpdatedAt(fresh.card.contentUpdatedAt))
      const from = join(board, 'from.json'), migrated = '2025-01-02T03:04:05Z'
      writeFileSync(from, JSON.stringify({ title: 'Migrated decision', contentUpdatedAt: migrated, journey: { currentFrom: 'D1', history: [], development: [] } }))
      const imported = JSON.parse(good('card', 'new', 'decision', '--from', from, '--json').stdout)
      assert.equal(imported.card.contentUpdatedAt, migrated)
      assert.equal(imported.card.journey.currentFrom, 'D1')
    })
    check(`${label}: pr-sync alias stamps real settlements and preserves unselected cards`, () => {
      const ghDir = join(board, 'fake-gh'); mkdirSync(ghDir)
      const prs = [{ number: 11, title: 'Merged implementation', state: 'MERGED', isDraft: false, baseRefName: 'main', headRefName: 'feature', url: 'https://github.com/owner/repo/pull/11', createdAt: '2026-01-01T00:00:00Z', mergedAt: '2026-01-02T00:00:00Z', closedAt: '2026-01-02T00:00:00Z' }]
      const ghPath = join(ghDir, 'gh')
      writeFileSync(ghPath, `#!/bin/sh\ncase "$1 $2" in\n"pr list") echo '${JSON.stringify(prs)}' ;;\n"release list") echo '[]' ;;\nesac\n`)
      chmodSync(ghPath, 0o755)
      const sync = (...args) => spawnSync(process.execPath, [join(repo, 'scripts/ddd.mjs'), 'pr-sync', '--dir', board, ...args], { encoding: 'utf8', env: { ...process.env, PATH: ghDir } })
      const syncGood = (...args) => { const result = sync(...args); assert.equal(result.status, 0, result.stderr); return result }
      const legacyAt = '2000-01-01T00:00:00Z'
      writeCard({ ...readCard('D1'), pr: 11, contentUpdatedAt: legacyAt })
      writeCard({ ...readCard('BL-1'), pr: 11, status: 'ready', contentUpdatedAt: legacyAt })
      writeCard({ ...readCard('D2'), pr: 11, settleHold: 'Pending human acceptance' })
      const main = read('manifest.json')
      main.tasks = [{ id: 'T1', title: 'Iteration', status: 'active', notes: 'Original task record', pr: 11 }]
      write('manifest.json', main)
      write('release-manifest.json', { prs: [], releases: [], stages: [], syncedAt: legacyAt })
      const invalid = { ...readCard('D1'), contentUpdatedAt: '2026-02-30T00:00:00Z' }
      writeCard(invalid)
      const invalidBefore = snapshot(), releaseBefore = readFileSync(join(board, 'release-manifest.json'), 'utf8')
      const refused = sync('--settle', '--write', '--only', 'D1')
      assert.notEqual(refused.status, 0); assert.match(refused.stderr, /contentUpdatedAt/)
      assert.deepEqual(snapshot(), invalidBefore)
      assert.equal(readFileSync(join(board, 'release-manifest.json'), 'utf8'), releaseBefore)
      writeCard({ ...invalid, contentUpdatedAt: legacyAt })
      const before = snapshot()
      syncGood('--settle', '--dry-run')
      assert.deepEqual(snapshot(), before)
      assert.equal(readFileSync(join(board, 'release-manifest.json'), 'utf8'), releaseBefore)
      syncGood('--settle', '--write', '--only', 'D1')
      const settled = readCard('D1')
      assert.equal(settled.status, 'live')
      assert.ok(isContentUpdatedAt(settled.contentUpdatedAt))
      assert.notEqual(settled.contentUpdatedAt, legacyAt)
      assert.deepEqual(settled.journey, before.D1.journey)
      assert.deepEqual(readCard('BL-1'), before['BL-1'])
      assert.deepEqual(readCard('D2'), before.D2)
      assert.deepEqual(read('manifest.json'), main)
      const settledSource = readCard('D1')
      syncGood('--settle', '--write')
      assert.equal(readCard('BL-1').status, 'done')
      assert.ok(isContentUpdatedAt(readCard('BL-1').contentUpdatedAt))
      assert.notEqual(readCard('BL-1').contentUpdatedAt, legacyAt)
      assert.deepEqual(readCard('D1'), settledSource)
      assert.deepEqual(readCard('D2'), before.D2)
      const task = read('manifest.json').tasks[0]
      assert.equal(task.status, 'done')
      assert.ok(task.notes.startsWith('Original task record'))
      assert.equal(task.contentUpdatedAt, readCard('BL-1').contentUpdatedAt)
      const paths = split ? ['cards/backlog/BL-1.json', 'cards/decisions/D1.json', 'cards/decisions/D2.json', 'manifest.json'] : ['backlog-manifest.json', 'decisions-manifest.json', 'manifest.json']
      const bytes = paths.map((path) => [path, readFileSync(join(board, path), 'utf8'), statSync(join(board, path)).mtimeMs])
      syncGood('--settle', '--write')
      for (const [path, text, mtime] of bytes) {
        assert.equal(readFileSync(join(board, path), 'utf8'), text)
        assert.equal(statSync(join(board, path)).mtimeMs, mtime)
      }
    })
  }
} finally { rmSync(root, { recursive: true, force: true }) }
console.log(`\n${checks} current-record checks passed`)
