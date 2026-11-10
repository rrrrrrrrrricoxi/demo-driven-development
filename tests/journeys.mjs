#!/usr/bin/env node
// 独立合成板验证:不读用户生成物,不接触共享服务。
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { journeyError, journeyHref, isJourneyDemo, renderJourney } from '../scripts/journey.mjs'
import { generatedReads } from '../scripts/hook-tool-rules.mjs'
import { GEN_RE } from '../scripts/board-branch-check.mjs'
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = mkdtempSync(join(tmpdir(), 'ddd-journeys-'))
const board = join(root, 'app/kanban'); mkdirSync(join(board, 'demos'), { recursive: true })
const write = (name, value) => writeFileSync(join(board, name), JSON.stringify(value))
const fill = (s) => s.replaceAll('{{BRAND}}', 'JOURNEY').replaceAll('{{GH_REPO}}', 'owner/repo').replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '')
const cfg = JSON.parse(fill(readFileSync(join(repo, 'templates/kanban.config.json'), 'utf8')))
cfg.concurrentSessions = true; cfg.lazyTabs = true; cfg.richText = true; cfg.acceptanceTab = true
write('kanban.config.json', cfg)
for (const name of ['manifest', 'backlog-manifest', 'decisions-manifest']) writeFileSync(join(board, name + '.json'), fill(readFileSync(join(repo, 'templates/manifests', name + '.json'), 'utf8')))
const dm = JSON.parse(readFileSync(join(board, 'decisions-manifest.json')))
const card = { id: 'D1', code: 'D1', title: '<Navigation>', status: 'decided', question: 'Original question', decision: 'Original decision', demoNote: 'Original demo note', detail: 'Original detail', note: 'Original development note', source: 'Original source', repro: ['Open original page', 'Click original action'], demo: 'demos/old.html', pr: [12], links: [{title: 'Historical link', href: 'demos/old.html'}], shots: [{file: 'd1.png', caption: 'Original shot'}] }
const j = { decision: '<chosen>', progress: 'Building', recent: 'Changed', current: {title: 'Overall B', href: 'demos/current.html?statistics=left#chart', summary: 'B summary', links: [{title: 'Legend D', href: 'demos/legend.html'}, {title: 'Current specification', href: 'refs/spec.html'}]}, history: [{date: '2026-11-10', title: 'Round 1', href: 'demos/old.html', summary: 'Old direction'}], development: [{title: 'Acceptance', href: 'index.html#acc-12'}] }
card.journey = j; dm.entries = [card]; write('decisions-manifest.json', dm)
write('acceptance-manifest.json', {current: 12, lists: [{pr: [12, 13], title: 'Shared acceptance', cards: ['D1'], items: []}]})
for (const name of ['old', 'current', 'legend']) writeFileSync(join(board, 'demos', name + '.html'), '<html><body>' + name + '</body></html>')
const run = (script, args = []) => spawnSync(process.execPath, [join(repo, 'scripts', script), '--dir', board, ...args], {encoding: 'utf8'})
let checks = 0
const check = (condition, name) => { assert.ok(condition, name); checks++; console.log('  ✓ ' + name) }
check(!journeyError(card), 'valid contract')
for (const bad of [null, [], {}, {...j, history: {}}, {...j, current: {...j.current, href: 'javascript:alert(1)'}}, {...j, current: {...j.current, href: ' data:text/html,a'}}, {...j, current: {...j.current, href: '//evil.test'}}, {...j, current: {...j.current, links: ['bad']}}, {...j, history: [{title: 'bad date', date: 'today'}]}]) check(Boolean(journeyError({...card, journey: bad}, 'en')), 'reject malformed or unsafe journey')
check(journeyError({...card, id: '../escape'}, 'en').includes('invalid'), 'reject output path traversal')
check(journeyHref('#acc-12') === '../index.html#acc-12' && journeyHref('refs/doc.html#s') === '../refs/doc.html#s', 'relative and hash links rebase')
check(journeyHref('https://example.test/x') === 'https://example.test/x' && journeyHref('javascript:bad') === '#', 'safe URL fallback')
check(isJourneyDemo(j.current.href) && isJourneyDemo('./demos/legend.html') && !['refs/spec.html', 'https://example.test/demos/current.html', 'index.html#D1', 'demos/../index.html', 'demos/%2e%2e/index.html'].some(isJourneyDemo), 'only local demo HTML is embedded')
const result = run('gen.mjs'); assert.equal(result.status, 0, result.stderr)
const html = readFileSync(join(board, 'journeys/D1.html'), 'utf8')
const part = readFileSync(join(board, 'parts/decisions.html'), 'utf8')
check(part.includes('现行决定') && part.includes('开发进度') && part.includes('最近变化') && part.includes('&lt;chosen&gt;'), 'three escaped summaries on decision card')
check(part.includes('journeys/D1.html') && !part.includes('Original detail') && !part.includes('Historical link'), 'stable card entry replaces flat original content')
check(part.includes('href="refs/spec.html"') && part.includes('Current specification') && part.includes('查看现行方案') && !part.includes('▶ 打开 demo'), 'current documents stay directly accessible and entry label names the destination')
check(part.includes('<dl class="journey-summary">') && (part.match(/class="journey-summary-row"/g) || []).length === 3, 'each card summary has one label/value row')
check(html.includes('src="../demos/current.html?statistics=left#chart"') && html.includes('loading="eager"') && html.includes('title="Overall B"'), 'current demo is interactive immediately with query and fragment preserved')
check(html.includes('<details class="demo-option"><summary>Legend D</summary><iframe') && html.includes('src="../demos/legend.html"') && html.includes('loading="lazy"') && !html.includes('src="../refs/spec.html"'), 'local refinement opens inline while specifications remain documents')
check(html.includes('class="wrap journey-nav"') && html.includes('hashchange') && html.includes('s.hidden = s.id !== id') && html.includes('--bg:#f6f5f2') && html.includes('font: 15px/1.6'), 'board-aligned navigation switches current, history, and development views')
check(html.includes('<details class="journey-status"><summary>决定与进度</summary>') && !html.includes('根据卡片 journey 生成'), 'compact header leaves the current demo visible and avoids implementation copy')
check(html.includes("querySelectorAll('#ddd-backnav a')") && html.includes("a.href = document.querySelector('.backbar a').href") && html.includes("a.target = '_top'") && html.includes("frame.addEventListener('load', wireBacknav)"), 'embedded demo return links target their board card at runtime without rewriting old sources')
check(html.includes('../demos/current.html') && html.includes('../demos/legend.html') && html.includes('../demos/old.html'), 'both current demos and historical URLs retained')
check(html.includes('href="../index.html#acc-12"') && !html.includes('href="#acc-12"'), 'acceptance hash returns to board including grouped PR checklist')
check(!html.includes('<details open') && html.includes('阶段历史 · 1'), 'history starts collapsed')
check(['Original detail', 'Original development note', 'Original decision', 'Original demo note', 'Original source'].every((s) => html.includes(s)), 'all original development and decision records retained')
check(html.includes('Open original page\nClick original action'), 'original reproduction steps retained as separate lines')
check(html.includes('src="../shots/d1.png"') && html.includes('href="../shots/d1.png"') && html.includes('.wtshots a'), 'standalone screenshot has visible layout and original link')
check(readFileSync(join(board, 'demos/old.html'), 'utf8') === '<html><body>old</body></html>', 'old demo source untouched in concurrent mode')
check(GEN_RE.test('app/kanban/journeys/D1.html'), 'generated branch protection includes journey')
check(generatedReads({cwd: root, tool: {kind: 'read', path: join(board, 'journeys/D1.html')}}, board).length === 1, 'generated read protection includes journey')
const invalidSet = run('ddd.mjs', ['card', 'set', 'D1', 'journey', '--json', JSON.stringify({...j, current: {...j.current, href: 'javascript:bad'}})])
check(invalidSet.status !== 0 && JSON.parse(readFileSync(join(board, 'decisions-manifest.json'))).entries[0].journey.current.href === j.current.href, 'CLI rejects unsafe contract before writing')
const validSet = run('ddd.mjs', ['card', 'set', 'D1', 'journey', '--json', JSON.stringify(j)])
check(validSet.status === 0 && !validSet.stderr.includes('不认'), 'CLI recognizes journey field')
const audit = run('ddd.mjs', ['audit', '--json']); assert.equal(audit.status, 0, audit.stderr); const audited = JSON.parse(audit.stdout); check(Array.isArray(audited.block) && !audited.block.some((finding) => finding.key === 'orphan'), 'current-only and linked journey demos do not create orphan audit findings')
// 比较父提交原版:去掉版本戳后的产物字节应相同,涵盖并发/lazy/验收。
const base = join(root, 'base-plugin'); mkdirSync(base)
const archive = spawnSync('git', ['archive', 'c9f9ecd5e50809aa45fdaa027fb1d933cc90ba63'], {cwd: repo, encoding: null, maxBuffer: 64 * 1024 * 1024}); assert.equal(archive.status, 0)
const unpack = spawnSync('tar', ['-x', '-C', base], {input: archive.stdout}); assert.equal(unpack.status, 0)
delete card.journey; dm.entries = [card]; write('decisions-manifest.json', dm)
// 非空backlog是空白冻结的关键:解法字段前的换行也必须保持。
const backlog = JSON.parse(readFileSync(join(board, 'backlog-manifest.json')))
backlog.tiers = { '1': 'Feature' }
backlog.items = ['ready', 'done'].map((status, i) => ({id: 'BL-' + (i + 1), title: 'Backlog ' + status, status, tier: 1, priority: 'high', problem: 'Original backlog problem', approach: 'Original backlog approach', note: 'Original backlog note', detail: 'Original backlog detail', shots: ['d1.png']}))
write('backlog-manifest.json', backlog)
dm.entries.push({...card, id: 'D2', code: 'D2', status: 'live'}); write('decisions-manifest.json', dm)
for (const lazy of [false, true]) for (const archive of [false, true]) for (const decisionArchive of [undefined, false, true]) {
  cfg.lazyTabs = lazy; cfg.backlogArchive = archive
  if (decisionArchive === undefined) delete cfg.decisionArchive; else cfg.decisionArchive = decisionArchive
  write('kanban.config.json', cfg)
  const fresh = run('gen.mjs'); assert.equal(fresh.status, 0, fresh.stderr)
  const files = ['index.html', 'shots.html', 'parts/decisions.html', 'parts/backlog.html', 'parts/acceptance.html', 'parts/archive.html']
  const normalize = (name) => existsSync(join(board, name)) ? readFileSync(join(board, name), 'utf8').replace(/<!-- ddd-gen v[^>]+ -->/g, '') : null
  const before = new Map(files.map((name) => [name, normalize(name)]))
  const old = spawnSync(process.execPath, [join(base, 'scripts/gen.mjs'), '--dir', board, '--force-downgrade=' + JSON.parse(readFileSync(join(repo, 'plugin.json'))).version], {encoding: 'utf8'}); assert.equal(old.status, 0, old.stderr)
  check(files.every((name) => normalize(name) === before.get(name)), `nonempty backlog/decision byte freeze: lazy=${lazy} archive=${archive} decisionArchive=${decisionArchive}`)
}
// 留下可检查的合成板,同时覆盖 backlog 行与实际主题注入。
card.journey = j; dm.entries = [card]; write('decisions-manifest.json', dm)
backlog.items[0].journey = j; write('backlog-manifest.json', backlog)
cfg.darkMode = true; write('kanban.config.json', cfg)
writeFileSync(join(board, 'theme.css'), ':root { --accent: #135790; --font-ui: Georgia, serif; }')
const themed = run('gen.mjs'); assert.equal(themed.status, 0, themed.stderr)
const themedEntry = readFileSync(join(board, 'journeys/D1.html'), 'utf8')
const backlogPart = readFileSync(join(board, 'parts/backlog.html'), 'utf8')
check(backlogPart.includes('<dl class="journey-summary">') && backlogPart.includes('Current specification') && backlogPart.includes('href="refs/spec.html"'), 'backlog uses paired summary rows and direct current documents too')
check(themedEntry.includes('--font-ui: Georgia, serif') && themedEntry.includes('font: 15px/1.6 var(--font-ui)') && themedEntry.includes('light-dark(') && themedEntry.includes('journey_theme') && themedEntry.includes('id="themetoggle"'), 'journey uses the configured board theme and shared dark-mode preference')
console.log(`${checks} journey checks passed; fixture ${board}`)
