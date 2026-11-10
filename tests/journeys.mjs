#!/usr/bin/env node
// 独立合成板验证:不读用户生成物,不接触共享服务。
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Script } from 'node:vm'
import { journeyError, journeyHref, isJourneyDemo, renderJourney } from '../scripts/journey.mjs'
import { generatedReads } from '../scripts/hook-tool-rules.mjs'
import { GEN_RE } from '../scripts/board-branch-check.mjs'
import { localDate } from '../scripts/cards.mjs'
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
// Current URLs also enter the runtime's JSON list; HTML escaping alone cannot protect a script element.
const scriptedUrl = renderJourney({...card, journey: {...j, current: {...j.current, href: 'demos/current.html?q=</script><script>alert(1)</script>'}}}, {lang: 'en', version: 'test', resolveLink: (s) => s})
const scripts = [...scriptedUrl.matchAll(/<script>([\s\S]*?)<\/script>/g)]
check(scripts.length === 1 && scripts.every(([, body]) => new Script(body)), 'URL characters cannot close the runtime script and rendered runtime compiles')
const result = run('gen.mjs'); assert.equal(result.status, 0, result.stderr)
const html = readFileSync(join(board, 'journeys/D1.html'), 'utf8')
const part = readFileSync(join(board, 'parts/decisions.html'), 'utf8')
check(part.includes('现行决定') && part.includes('开发进度') && part.includes('最近变化') && part.includes('&lt;chosen&gt;'), 'three escaped summaries on decision card')
check(part.includes('journeys/D1.html') && !part.includes('Original detail') && !part.includes('Historical link'), 'stable card entry replaces flat original content')
check(part.includes('href="refs/spec.html"') && part.includes('Current specification') && part.includes('▶ 打开 demo') && !part.includes('查看现行方案'), 'current documents stay directly accessible and the original demo label stays unchanged')
check(part.includes('<dl class="journey-summary">') && (part.match(/class="journey-summary-row"/g) || []).length === 3, 'each card summary has one label/value row')
check(html.includes('src="../demos/current.html?statistics=left#chart"') && html.includes('loading="eager"') && html.includes('title="Overall B"'), 'current demo is interactive immediately with query and fragment preserved')
check(html.includes('href="#current-1">Legend D</a>') && html.includes('id="current-1" class="current-design" hidden') && html.includes('src="../demos/legend.html"') && html.includes('loading="lazy"') && !html.includes('src="../refs/spec.html"'), 'local refinement uses the full current viewport on demand while specifications remain documents')
check(html.includes('class="journey-nav"') && html.includes('hashchange') && html.includes('s.hidden = s.id !== id') && html.includes('--bg:#f6f5f2') && html.includes('font: 15px/1.6'), 'compact navigation switches current, history, and development views')
check(html.includes('<details class="journey-status"><summary>决定与进度</summary>') && !html.includes('根据卡片 journey 生成'), 'compact header leaves the current demo visible and avoids implementation copy')
check(html.includes('main { position: fixed; inset: 44px 0 0; }') && html.includes('width: 100%; height: 100%;') && !html.includes('max-width: 1060px') && !html.includes('height: 720px') && !html.includes('resource-link'), 'current demo fills the viewport below the original 44px bar without a new centered shell or button style')
check(html.includes('class="acts journey-tools"') && html.includes('font-size: 12.5px; padding: 4px 10px; border: 1px solid var(--line-strong); border-radius: 7px;') && html.includes('class="record-nav"'), 'controls and record navigation reuse established demo tokens')
check(html.includes("querySelectorAll('#ddd-backnav,nav')") && html.includes("frame.style.setProperty('--demo-backnav'") && html.includes("a.href = board.href; a.target = '_top'") && html.includes("frame.addEventListener('load', wireBacknav)") && html.includes("frame.addEventListener('ddd-show', wireBacknav)"), 'same-origin return bars are clipped with viewport height preserved and return links keep the top-level board card target')
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
// Observe the audit/CLI/Stop contracts, including product language that must stay quiet.
const report = '浏览器30项检查通过，桌面与390px手机无脚本错误或横向溢出'
const summaryCases = [
  [true, report],
  [true, '业务表单已接入；浏览器30项检查通过。'],
  [true, '30 tests passed.'],
  [true, 'Playwright: 30 checks passed'],
  [true, '浏览器检查:无控制台错误和横向溢出'],
  [true, 'Browser check: no console errors or horizontal overflow'],
  [false, '支持390px手机填写施肥方案'],
  [false, '已修横向溢出，窄屏可查看完整产品名'],
  [false, '桌面与390px手机的图表均可读'],
  [false, '自动化产品测试功能已可用，用户可按产品创建测试'],
  [false, '测试工具可显示 30 tests passed'],
  [false, '用户看到30项通过时可打开对应结果'],
  [false, '30项测试通过后自动生成产品试验报告'],
  [false, 'Show 30 tests passed in the product testing dashboard'],
  [false, '30 tests passed is a supported result label'],
  [false, '演示已可操作，业务功能未接入；尚未做人工验收'],
  [false, 'Demo checks passed; human acceptance is pending'],
  [false, '无横向溢出；无脚本错误'],
]
for (const lang of ['zh', 'en']) {
  cfg.lang = lang; cfg.concurrentSessions = false; write('kanban.config.json', cfg)
  const cases = summaryCases.map(([warn, text], index) => ({...card, id: `D${102 + index}`, code: `D${102 + index}`, session: index === 0 ? 'summary-owner' : 'other', journey: {...j, progress: text}, expectedHint: warn}))
  dm.entries = cases.map(({expectedHint, ...entry}) => entry); write('decisions-manifest.json', dm)
  const before = readFileSync(join(board, 'decisions-manifest.json'), 'utf8')
  const observed = run('ddd.mjs', ['audit', '--json']); assert.equal(observed.status, 0, observed.stderr)
  const finding = JSON.parse(observed.stdout).chore.find((entry) => entry.key === 'journeySummary')
  check(finding?.n === summaryCases.filter(([warn]) => warn).length, `${lang}: audit counts only explicit verification reports`)
  for (const entry of cases) check(finding.text.includes(`${entry.id} journey.progress`) === entry.expectedHint, `${lang}: audit ${entry.expectedHint ? 'hints' : 'preserves'} ${entry.journey.progress}`)
  check(readFileSync(join(board, 'decisions-manifest.json'), 'utf8') === before, `${lang}: summary audit leaves source bytes intact`)
  const filtered = run('ddd.mjs', ['audit', '--session', 'summary-owner', '--json']); assert.equal(filtered.status, 0, filtered.stderr)
  check(JSON.parse(filtered.stdout).chore.find((entry) => entry.key === 'journeySummary')?.n === 1, `${lang}: summary chores respect the existing session filter`)
  dm.entries = [{...card, id: 'D102', code: 'D102'}]; write('decisions-manifest.json', dm)
  const evidence = {decision: j.decision, progress: report, recent: j.recent}
  for (const field of ['decision', 'progress', 'recent']) {
    const value = {...j, [field]: report}
    const saved = run('ddd.mjs', ['card', 'set', 'D102', 'journey', '--json', JSON.stringify(value)])
    check(saved.status === 0 && JSON.parse(saved.stdout).ok && saved.stderr.includes(`D102 journey.${field}`) && saved.stderr.includes('journey.development') && saved.stderr.includes('detail'), `${lang}: CLI saves ${field} and emits a targeted advisory on stderr`)
    check(saved.stderr.startsWith(lang === 'en' ? 'Summary review hint:' : '摘要复核提示:'), `${lang}: CLI advisory follows the board language`)
    check(JSON.parse(readFileSync(join(board, 'decisions-manifest.json'))).entries[0].journey[field] === report, `${lang}: CLI preserves ${field} verbatim`)
  }
  const saved = run('ddd.mjs', ['card', 'set', 'D102', 'journey', '--json', JSON.stringify({...j, ...evidence})]); assert.equal(saved.status, 0, saved.stderr)
  const beforeStop = readFileSync(join(board, 'decisions-manifest.json'), 'utf8')
  const stopped = spawnSync(process.execPath, [join(repo, 'scripts/codex-hook.mjs'), 'settle'], {cwd: root, input: JSON.stringify({cwd: root}), encoding: 'utf8'})
  assert.equal(stopped.status, 0, stopped.stderr)
  const stopPayload = JSON.parse(stopped.stdout)
  check(!stopPayload.decision && stopPayload.systemMessage.includes('D102 journey.progress') && stopPayload.systemMessage.includes('journey.development/detail'), `${lang}: existing Stop adapter reports the advisory without blocking`)
  check(readFileSync(join(board, 'decisions-manifest.json'), 'utf8') === beforeStop, `${lang}: Stop leaves card evidence intact`)
  const clean = run('ddd.mjs', ['card', 'set', 'D102', 'journey', '--json', JSON.stringify(j)])
  check(clean.status === 0 && clean.stderr === '', `${lang}: valid product summary writes stay silent`)
  dm.entries = [{...card, id: 'D102', code: 'D102', detail: report, journey: {...j, development: [{title: 'Verification', summary: report}]}}]; write('decisions-manifest.json', dm)
  const evidenceOnly = run('ddd.mjs', ['audit', '--json']); assert.equal(evidenceOnly.status, 0, evidenceOnly.stderr)
  check(!JSON.parse(evidenceOnly.stdout).chore.some((entry) => entry.key === 'journeySummary'), `${lang}: verification evidence in development/detail stays silent`)
}
// Synthetic BL-C63 shape: long dated rounds, many links/shots, no journey.
// No real project prose or screenshots are copied into this fixture.
const originalBacklog = readFileSync(join(board, 'backlog-manifest.json'), 'utf8')
const timelineBacklog = JSON.parse(originalBacklog); timelineBacklog.tiers = {'1': 'Feature'}
const dated = (count, length = 10787, english = false) => Array.from({length: count}, (_, i) => `${english ? '[2026-11-10 update]' : '【2026-11-10 更新】'}Round ${i + 1}: confirmed one design; remaining business question is pending.`).join('\n\n').padEnd(length, 'Synthetic development record. ')
const legacy = {id: 'BL-C63', title: 'Synthetic data overview iterations', status: 'ready', tier: 1, priority: 'med', problem: 'The current design is hard to find.', approach: 'Keep the current design and old evidence accessible.', note: dated(3), links: Array.from({length: 13}, (_, i) => ({title: `Demo round ${i + 1}`, href: 'demos/current.html#round-' + i})), shots: Array.from({length: 28}, (_, i) => `bl-c63-${i}.png`)}
const suggestions = [
  [true, legacy],
  [true, {...legacy, id: 'BL-NOTES', note: '', notes: dated(3, 801, true)}],
  [true, {...legacy, id: 'BL-DETAIL', detail: 'Original investigation details'}],
  [true, {...legacy, id: 'BL-HOSTED', links: [], demo: 'https://example.test/interactive-demo'}],
  [false, {...legacy, id: 'BL-SPEC', note: '', approach: 'A long product specification. '.repeat(50)}],
  [false, {...legacy, id: 'BL-UNDATED', note: 'Specification without dated rounds. '.repeat(50)}],
  [false, {...legacy, id: 'BL-TWO', note: dated(2)}],
  [false, {...legacy, id: 'BL-INLINE', note: 'Previous checks on 【2026-09-01】 and 【2026-09-02】 and 【2026-09-03】. '.repeat(20)}],
  [false, {...legacy, id: 'BL-SHORT', note: dated(3, 800)}],
  [false, {...legacy, id: 'BL-NODEMO', links: []}],
  [false, {...legacy, id: 'BL-DOC', links: [{title: 'Specification', href: 'refs/spec.html'}]}],
  [false, {...legacy, id: 'BL-ADOPTED', journey: j}],
  [false, {...legacy, id: 'BL-DONE', status: 'done'}],
]
for (const lang of ['zh', 'en']) {
  cfg.lang = lang; cfg.concurrentSessions = false; write('kanban.config.json', cfg)
  dm.entries = [{...card, id: 'D-HISTORY', code: 'D-HISTORY', journey: undefined, detail: undefined, decision: dated(3)}]; write('decisions-manifest.json', dm)
  timelineBacklog.items = suggestions.map(([, entry]) => entry); write('backlog-manifest.json', timelineBacklog)
  const readAudit = (args = []) => { const out = run('ddd.mjs', ['audit', '--json', ...args]); assert.equal(out.status, 0, out.stderr); return JSON.parse(out.stdout) }
  const observed = readAudit(), finding = observed.chore.find((entry) => entry.key === 'journeySuggested')
  check(finding?.n === 5 && finding.text.includes('D-HISTORY decision'), `${lang}: decision and backlog histories share the suggestion audit`)
  for (const [expected, entry] of suggestions) check(finding.text.includes(`${entry.id} `) === expected, `${lang}: dated-history suggestion ${expected ? 'includes' : 'excludes'} ${entry.id}`)
  check(observed.chore.find((entry) => entry.key === 'longText')?.n === 6, `${lang}: old long prose remains checked without duplicate journey actions`)
  // Restore the quiet linked decision; only the reported backlog card needs action.
  dm.entries = [card]; write('decisions-manifest.json', dm)
  timelineBacklog.items = [legacy]; write('backlog-manifest.json', timelineBacklog)
  const beforeAudit = readFileSync(join(board, 'backlog-manifest.json'), 'utf8')
  const only = readAudit()
  check(only.block.length === 0 && only.chore.length === 1 && only.chore[0].key === 'journeySuggested' && readFileSync(join(board, 'backlog-manifest.json'), 'utf8') === beforeAudit, `${lang}: BL-C63-shaped history gets one read-only actionable hint`)
  const stop = spawnSync(process.execPath, [join(repo, 'scripts/codex-hook.mjs'), 'settle'], {cwd: root, input: JSON.stringify({cwd: root}), encoding: 'utf8'})
  assert.equal(stop.status, 0, stop.stderr)
  const payload = JSON.parse(stop.stdout)
  check(!payload.decision && payload.systemMessage.includes('BL-C63 note') && payload.systemMessage.includes('journey') && readFileSync(join(board, 'backlog-manifest.json'), 'utf8') === beforeAudit, `${lang}: existing Stop suggests a journey without editing the legacy card`)
  timelineBacklog.items = [{...legacy, note: dated(2)}]; write('backlog-manifest.json', timelineBacklog)
  const note = run('ddd.mjs', ['card', 'note', 'BL-C63', 'Current business question remains pending', '--json']); assert.equal(note.status, 0, note.stderr)
  const saved = JSON.parse(note.stdout)
  check(saved.ok && note.stderr.includes('BL-C63 note') && note.stderr.startsWith(lang === 'en' ? 'Iteration history hint:' : '多轮记录整理提示:'), `${lang}: CLI note saves a third dated update and asks the writing session to organize it`)
  check(saved.card.note === dated(2) + '\n\n' + saved.line && saved.card.journey === undefined && JSON.stringify(saved.card.links) === JSON.stringify(legacy.links) && JSON.stringify(saved.card.shots) === JSON.stringify(legacy.shots), `${lang}: note preserves earlier rounds, links, screenshots, and pending questions`)
  const setNote = run('ddd.mjs', ['card', 'set', 'BL-C63', 'note', JSON.stringify(dated(3)), '--json']); assert.equal(setNote.status, 0, setNote.stderr)
  check(setNote.stderr.includes('BL-C63 note') && JSON.parse(setNote.stdout).card.note === dated(3), `${lang}: CLI set note uses the same nonblocking suggestion`)
  timelineBacklog.items = [{...legacy, links: []}]; write('backlog-manifest.json', timelineBacklog)
  const setDemo = run('ddd.mjs', ['card', 'set', 'BL-C63', 'demo', JSON.stringify('demos/current.html'), '--json']); assert.equal(setDemo.status, 0, setDemo.stderr)
  check(setDemo.stderr.includes('BL-C63 note'), `${lang}: adding a demo to a dated history also suggests a journey`)
  const adopted = run('ddd.mjs', ['card', 'set', 'BL-C63', 'journey', '--json', JSON.stringify(j)]); assert.equal(adopted.status, 0, adopted.stderr)
  check(!readAudit().chore.some((entry) => ['journeySuggested', 'longText'].includes(entry.key)) && JSON.parse(adopted.stdout).card.note === dated(3), `${lang}: adopting a journey silences old-history reminders while keeping original prose`)
  // Force existing fresh-card semantics without relying on an untracked card directory.
  timelineBacklog.items = [{...legacy, date: localDate()}]
  write('backlog-manifest.json', timelineBacklog)
  check(readAudit().block.some((entry) => entry.key === 'richLongNew'), `${lang}: journey suggestion preserves the existing fresh-card long-text block`)
}
writeFileSync(join(board, 'backlog-manifest.json'), originalBacklog)
cfg.lang = 'zh'; cfg.concurrentSessions = true; write('kanban.config.json', cfg)
dm.entries = [card]; write('decisions-manifest.json', dm)
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
