#!/usr/bin/env node
// 临时文件与合成板验证迁移保护和日期口径;不读取用户看板。
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { cardCommittedMap, cardUpdatedMap } from '../scripts/cards.mjs'
import { jsonText, snapshot, snapDiff } from '../scripts/cards-lib.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = mkdtempSync(join(tmpdir(), 'ddd-cards-integrity-'))
let checks = 0
const check = (name, fn) => { fn(); checks++; console.log(`  ✓ ${name}`) }
const run = (cwd, command, args, env = {}) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result
}
const script = (board, name, env) => run(root, process.execPath, [join(repo, 'scripts', name), '--dir', board], env)
const writeJson = (path, value) => writeFileSync(path, jsonText(value))

try {
  const products = join(root, 'products')
  mkdirSync(join(products, 'journeys'), { recursive: true })
  writeFileSync(join(products, 'index.html'), 'board')
  const journeyPath = join(products, 'journeys/D1.html')
  const original = '<a href="../demos/old.html">Local history</a>'
  writeFileSync(journeyPath, original)
  const before = snapshot(products)
  check('migration snapshot detects changed journey history and links', () => {
    writeFileSync(journeyPath, original.replace('old.html', 'other.html'))
    assert.deepEqual(snapDiff(before, snapshot(products)), ['journeys/D1.html'])
    writeFileSync(journeyPath, original)
  })
  check('migration snapshot detects added journey pages', () => {
    writeFileSync(join(products, 'journeys/D2.html'), original)
    assert.deepEqual(snapDiff(before, snapshot(products)), ['journeys/D2.html'])
    rmSync(join(products, 'journeys/D2.html'))
  })
  check('migration snapshot detects deleted journey pages', () => {
    rmSync(journeyPath)
    assert.deepEqual(snapDiff(before, snapshot(products)), ['journeys/D1.html'])
  })

  const dates = join(root, 'dates')
  mkdirSync(join(dates, 'cards/decisions'), { recursive: true })
  const tracked = join(dates, 'cards/decisions/D1.json')
  const untracked = join(dates, 'cards/decisions/D2.json')
  const src = new Map([['D1', 'cards/decisions/D1.json'], ['D2', 'cards/decisions/D2.json'], ['D3', 'cards/decisions/D3.json']])
  writeJson(tracked, { id: 'D1' }); writeJson(untracked, { id: 'D2' })
  const mtime = new Date('2030-02-03T12:00:00Z')
  utimesSync(tracked, mtime, mtime); utimesSync(untracked, mtime, mtime)
  check('without Git, committed dates stay absent and update dates use UTC mtime', () => {
    assert.deepEqual([...cardCommittedMap(dates, 'cards', src)], [])
    assert.deepEqual([...cardUpdatedMap(dates, 'cards', src)], [['D1', '2030-02-03'], ['D2', '2030-02-03'], ['D3', '']])
  })
  run(dates, 'git', ['init', '-q', '-b', 'main'])
  run(dates, 'git', ['add', 'cards/decisions/D1.json'])
  const commit = (day) => run(dates, 'git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Fixture'], { GIT_AUTHOR_DATE: `${day}T12:00:00Z`, GIT_COMMITTER_DATE: `${day}T12:00:00Z` })
  commit('2026-01-02')
  writeJson(tracked, { id: 'D1', title: 'Latest commit' })
  run(dates, 'git', ['add', 'cards/decisions/D1.json']); commit('2026-01-04')
  utimesSync(tracked, mtime, mtime)
  check('committed and untracked cards retain distinct date semantics', () => {
    const committed = cardCommittedMap(dates, 'cards', src)
    assert.deepEqual([...committed], [['D1', '2026-01-04']])
    assert.deepEqual([...cardUpdatedMap(dates, 'cards', src, committed)], [['D1', '2026-01-04'], ['D2', '2030-02-03'], ['D3', '']])
    assert.deepEqual([...committed], [['D1', '2026-01-04']], 'mtime fallback must not mutate committed dates')
  })

  // CLI 与审计只读源数据;不应随 HTML 渲染器缺席而失效。
  const cliPackage = join(root, 'cli-package')
  cpSync(join(repo, 'scripts'), join(cliPackage, 'scripts'), { recursive: true })
  cpSync(join(repo, 'package.json'), join(cliPackage, 'package.json'))
  rmSync(join(cliPackage, 'scripts/journey.mjs'))
  rmSync(join(cliPackage, 'scripts/current-render-strings.mjs'))

  for (const lang of ['zh', 'en']) {
    const board = join(root, lang, 'app/kanban')
    mkdirSync(join(board, 'demos'), { recursive: true })
    run(board, 'git', ['init', '-q', '-b', 'main'])
    const fill = (s) => s.replaceAll('{{BRAND}}', 'INTEGRITY').replaceAll('{{GH_REPO}}', 'owner/repo').replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '')
    const template = (name) => JSON.parse(fill(readFileSync(join(repo, 'templates', name), 'utf8')))
    const config = { ...template('kanban.config.json'), lang, lazyTabs: true }
    writeJson(join(board, 'kanban.config.json'), config)
    const source = { id: 'D1', code: 'D1', title: 'Authority', status: 'decided', contentUpdatedAt: '2026-01-03T12:00:00Z', journey: {
      decision: 'Current direction', progress: 'Current progress', recent: 'Current update',
      current: { title: 'Current demo', href: 'demos/current.html', links: [{ title: 'Specification', href: 'https://example.test/spec?q=1#details', role: 'document' }] },
      history: [{ title: 'Source history', href: 'demos/source-old.html' }], development: [],
    } }
    const reference = { id: 'BL-1', title: 'Implementation', status: 'ready', tier: '1', priority: 'med', contentUpdatedAt: '2026-01-02T12:00:00Z', note: 'Original notes', links: [{ title: 'Original link', href: 'demos/local-old.html' }], journey: {
      currentFrom: 'D1', history: [{ title: 'Local history', href: 'demos/local-old.html' }], development: [{ title: 'Local evidence', summary: 'Preserved development record', href: 'https://example.test/evidence' }],
    } }
    writeJson(join(board, 'manifest.json'), template('manifests/manifest.json'))
    const backlog = { ...template('manifests/backlog-manifest.json'), tiers: { '1': 'Feature' }, items: [reference] }
    const decisions = { ...template('manifests/decisions-manifest.json'), entries: [source] }
    writeJson(join(board, 'backlog-manifest.json'), backlog)
    writeJson(join(board, 'decisions-manifest.json'), decisions)
    for (const name of ['current', 'source-old', 'local-old']) writeFileSync(join(board, 'demos', `${name}.html`), `<html><body>${name}</body></html>`)
    script(board, 'gen.mjs')
    const initial = snapshot(board)
    const pages = new Map(['D1', 'BL-1'].map((id) => [id, readFileSync(join(board, 'journeys', `${id}.html`), 'utf8')]))
    check(`${lang}: split and join preserve resolved current resources and local historical pages`, () => {
      script(board, 'cards-split.mjs')
      assert.deepEqual(snapDiff(initial, snapshot(board)), [])
      const trace = join(root, `${lang}-git.trace`)
      script(board, 'gen.mjs', { GIT_TRACE: trace })
      const logs = readFileSync(trace, 'utf8').split('\n').filter((line) => /built-in: git log '?--format=%cs'? --name-only -- cards$/.test(line))
      assert.equal(logs.length, 1, `generation must query card commit dates once: ${readFileSync(trace, 'utf8')}`)
      for (const [id, html] of pages) assert.equal(readFileSync(join(board, 'journeys', `${id}.html`), 'utf8'), html)
      script(board, 'cards-join.mjs')
      assert.deepEqual(snapDiff(initial, snapshot(board)), [])
      assert.deepEqual(JSON.parse(readFileSync(join(board, 'backlog-manifest.json'), 'utf8')), backlog)
      assert.deepEqual(JSON.parse(readFileSync(join(board, 'decisions-manifest.json'), 'utf8')), decisions)
      for (const [id, html] of pages) assert.equal(readFileSync(join(board, 'journeys', `${id}.html`), 'utf8'), html)
    })
    check(`${lang}: CLI resolved reads and audits work without journey rendering modules`, () => {
      const invoke = (...args) => run(root, process.execPath, [join(cliPackage, 'scripts/ddd.mjs'), '--dir', board, ...args])
      const resolved = JSON.parse(invoke('card', 'show', 'BL-1', '--resolved', '--json').stdout)
      assert.equal(resolved.journey.current.href, source.journey.current.href)
      assert.deepEqual(resolved.journey.history, reference.journey.history)
      const findings = JSON.parse(invoke('audit', '--json').stdout)
      assert.ok(Array.isArray(findings.broken))
      assert.ok(!findings.broken.some((entry) => entry.key === 'journeyInvalid'))
      assert.deepEqual(snapDiff(initial, snapshot(board)), [])
    })
  }
} finally { rmSync(root, { recursive: true, force: true }) }
console.log(`\n${checks} card-integrity checks passed`)
