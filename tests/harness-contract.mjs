// 同一份合成源验证共享规则与现有适配器;不安装宿主、不加载用户配置。
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runHook } from '../scripts/hook-core.mjs'
import piAdapter from '../pi/hooks.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const work = realpathSync(mkdtempSync(join(tmpdir(), 'ddd-harness-contract-')))
const env = { ...process.env, CLAUDE_CONFIG_DIR: join(work, 'no-installs') }
for (const key of ['DDD_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'DDD_RUNTIME', 'DDD_HOOK_FORWARDED']) delete env[key]
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
function fixture(name, lang) {
  const root = join(work, name), board = join(root, 'app/kanban')
  mkdirSync(join(board, 'demos'), { recursive: true })
  const fill = text => text.replaceAll('{{BRAND}}', 'Contract fixture').replaceAll('{{GH_REPO}}', '').replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '').replaceAll('{{DEMO_BASE}}', '')
  const cfg = JSON.parse(fill(readFileSync(join(repo, 'templates/kanban.config.json'), 'utf8')))
  write(join(board, 'kanban.config.json'), { ...cfg, lang, richText: true })
  for (const file of readdirSync(join(repo, 'templates/manifests'))) writeFileSync(join(board, file), fill(readFileSync(join(repo, 'templates/manifests', file), 'utf8')))
  const journey = { decision: 'The current design is ready for review; approval is pending.', progress: '12 checks passed', recent: 'Added a candidate design.', current: { title: 'Current candidate', href: 'demos/current.html' }, history: [], development: [{ title: 'Original verification', summary: '12 checks passed' }] }
  const decision = JSON.parse(readFileSync(join(board, 'decisions-manifest.json'), 'utf8'))
  decision.entries = [{ id: 'D-SUMMARY', code: 'D-SUMMARY', title: 'Synthetic summary', status: 'decided', question: 'Which candidate should be reviewed?', journey, detail: 'Original evidence; product acceptance is pending.', links: [{ title: 'Original candidate', href: 'demos/current.html' }], shots: ['original.png'] }]
  write(join(board, 'decisions-manifest.json'), decision)
  const backlog = JSON.parse(readFileSync(join(board, 'backlog-manifest.json'), 'utf8'))
  backlog.tiers = { '1': 'Feature' }
  backlog.items = [{ id: 'BL-HISTORY', title: 'Synthetic iteration history', status: 'ready', tier: 1, priority: 'med', note: Array.from({ length: 3 }, (_, i) => `[2020-01-0${i + 1} update]\nCandidate ${i + 1} remains pending review. ${'Original development evidence. '.repeat(12)}`).join('\n\n'), links: [{ title: 'Previous candidate', href: 'demos/previous.html' }], shots: ['original.png'] }]
  write(join(board, 'backlog-manifest.json'), backlog)
  for (const name of ['current', 'previous']) writeFileSync(join(board, 'demos', name + '.html'), '<!doctype html><html><body>Synthetic candidate</body></html>')
  const git = args => execFileSync('git', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  git(['init', '-q', '-b', 'main']); git(['add', '.'])
  git(['-c', 'user.name=DDD fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'])
  return { root, board }
}
function snapshot(dir) {
  return Object.fromEntries(readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map(entry => [entry.name, entry.isDirectory() ? snapshot(join(dir, entry.name)) : readFileSync(join(dir, entry.name)).toString('base64')]))
}
function sources(board) {
  return Object.fromEntries(readdirSync(board).filter(name => name.endsWith('.json')).map(name => [name, readFileSync(join(board, name), 'utf8')]))
}
function cli(f, name, args = [], input) {
  const result = spawnSync(process.execPath, [join(repo, 'scripts', name), ...args], { cwd: f.root, env, encoding: 'utf8', input: input === undefined ? undefined : JSON.stringify(input) })
  assert.equal(result.status, 0, result.stderr)
  return result
}
function hints(text) {
  assert.match(text, /D-SUMMARY journey\.progress/)
  assert.match(text, /BL-HISTORY note/)
  assert.match(text, /journey\.development\/detail/)
}
// 仅驱动现有 Pi 适配器注册的回调;不是安装运行时或伪造一个受支持的宿主。
function piHost(root, messages = []) {
  const handlers = new Map(), listeners = new Map()
  piAdapter({ on: (name, fn) => handlers.set(name, fn), events: { on: (name, fn) => listeners.set(name, fn), emit: (name, value) => listeners.get(name)?.(value) }, sendMessage(message, options) { messages.push({ message, options }) } })
  const ctx = { cwd: root, sessionManager: { getSessionId: () => 'fixture' } }
  return (name, value = {}) => handlers.get(name)?.({ type: name, ...value }, ctx)
}
let checks = 0
async function check(name, fn) { await fn(); checks++; console.log(`✓ ${name}`) }
try {
  for (const lang of ['en', 'zh']) {
    await check(`${lang}: writes assign only the target card to the model; reads stay quiet`, () => {
      const f = fixture(`closeout-${lang}`, lang), before = snapshot(f.board)
      const command = `node '${join(repo, 'scripts/ddd.mjs')}' card set BL-HISTORY title 'Updated title'`
      const request = { event: 'after-tool', cwd: f.root, tool: { kind: 'shell', command } }
      for (const repeatedStop of [false, true]) {
        const result = runHook({ ...request, repeatedStop })
        assert.equal(result.kind, 'none')
        assert.match(result.additionalContext, /BL-HISTORY note/)
        assert.doesNotMatch(result.additionalContext, /D-SUMMARY/)
        assert.match(result.additionalContext, /card show 'BL-HISTORY'/)
        assert.match(result.additionalContext, /audit --dir/)
        assert.equal(result.continue, undefined)
      }
      for (const args of ['card show BL-HISTORY', 'card list', 'card history BL-HISTORY', 'card set UNKNOWN title x', 'card new backlog', 'card set BL-HISTORY title x --help', 'card set BL-HISTORY title x --help=yes', 'card set BL-HISTORY title x --help=false']) {
        assert.deepEqual(runHook({ ...request, tool: { kind: 'shell', command: `node '${join(repo, 'scripts/ddd.mjs')}' ${args}` } }), { kind: 'none' })
      }
      for (const command of ['echo "node ddd.mjs card set BL-HISTORY title x"', 'cd elsewhere && node ddd.mjs card set BL-HISTORY title x', 'node "$PLUGIN/ddd.mjs" card set BL-HISTORY title x']) {
        assert.deepEqual(runHook({ ...request, tool: { kind: 'shell', command } }), { kind: 'none' })
      }
      const other = fixture(`closeout-other-${lang}`, lang)
      const commented = `${command} # --dir '${other.board}'`
      assert.deepEqual(runHook({ ...request, tool: { kind: 'shell', command: commented } }), { kind: 'none' }, 'shell comments cannot redirect card ownership to another board')
      const quoted = `node '${join(repo, 'scripts/ddd.mjs')}' card set BL-HISTORY title '# --dir ${other.board}'`
      const quotedResult = runHook({ ...request, tool: { kind: 'shell', command: quoted } })
      assert.match(quotedResult.additionalContext, new RegExp(f.board))
      assert.doesNotMatch(quotedResult.additionalContext, new RegExp(other.board))
      assert.deepEqual(snapshot(f.board), before, 'after-tool follow-up is read-only')
      const portable = cli(f, 'ddd.mjs', ['card', 'set', 'BL-HISTORY', 'title', JSON.stringify('Updated title'), '--json'])
      assert.equal(JSON.parse(portable.stdout).ok, true, 'portable JSON stdout remains parseable')
      assert.match(portable.stderr, /BL-HISTORY note/)
      assert.match(portable.stderr, /audit --dir/)
      assert.doesNotMatch(portable.stderr, /D-SUMMARY/)
      assert.equal(cli(f, 'ddd.mjs', ['card', 'show', 'BL-HISTORY', '--json']).stderr, '')
      assert.equal(cli(f, 'ddd.mjs', ['card', 'list']).stderr, '')
      for (const adapter of ['claude', 'codex']) {
        const input = { cwd: f.root, tool_name: 'Bash', tool_input: { command } }
        const hooked = adapter === 'claude' ? cli(f, 'ghpr-remind.mjs', [], input) : cli(f, 'codex-hook.mjs', ['post-tool'], input)
        const payload = JSON.parse(hooked.stdout)
        assert.equal(payload.hookSpecificOutput.hookEventName, 'PostToolUse')
        assert.match(payload.hookSpecificOutput.additionalContext, /BL-HISTORY note/)
        assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /D-SUMMARY/)
      }
      const messages = [], emit = piHost(f.root, messages)
      const event = { toolName: 'bash', toolCallId: 'card-write', input: { command }, isError: false }
      emit('tool_result', event); emit('tool_execution_end', event)
      assert.equal(messages.length, 1)
      assert.match(messages[0].message.content, /BL-HISTORY note/)
      assert.deepEqual(messages[0].options, { triggerTurn: false })
      emit('tool_result', event); emit('tool_execution_end', event)
      assert.equal(messages.length, 1, 'Pi deduplicates without another turn')
    })
    await check(`${lang}: long prose and portable new cards receive work; fixes become quiet`, () => {
      const f = fixture(`closeout-prose-${lang}`, lang)
      const path = join(f.board, 'backlog-manifest.json'), manifest = JSON.parse(readFileSync(path, 'utf8'))
      const card = { id: 'BL-PROSE', title: 'Long prose', status: 'ready', tier: 1, priority: 'med', problem: 'Original evidence. '.repeat(60) }
      manifest.items.push(card, { ...card, id: 'BL-CLEAN', problem: 'Brief problem.' })
      write(path, manifest)
      const req = id => ({ event: 'after-tool', cwd: f.root, tool: { kind: 'shell', command: `node scripts/ddd.mjs card set ${id} title updated` } })
      const result = runHook(req('BL-PROSE'))
      assert.match(result.additionalContext, /BL-PROSE/)
      assert.match(result.additionalContext, /card set 'BL-PROSE' detail/)
      assert.doesNotMatch(result.additionalContext, /BL-HISTORY|D-SUMMARY/)
      assert.deepEqual(runHook(req('BL-CLEAN')), { kind: 'none' })
      assert.equal(cli(f, 'ddd.mjs', ['card', 'set', 'BL-CLEAN', 'title', 'Updated clean card']).stderr, '')
      cli(f, 'ddd.mjs', ['card', 'set', 'BL-PROSE', 'detail', card.problem])
      const fixed = cli(f, 'ddd.mjs', ['card', 'set', 'BL-PROSE', 'problem', 'Brief summary.'])
      assert.equal(fixed.stderr, '')
      assert.deepEqual(runHook(req('BL-PROSE')), { kind: 'none' })
      const from = join(f.root, 'new-card.json'); write(from, { ...card, id: undefined })
      const created = cli(f, 'ddd.mjs', ['card', 'new', 'backlog', '--from', from, '--json'])
      const made = JSON.parse(created.stdout)
      assert.match(created.stderr, new RegExp(made.id))
      assert.match(created.stderr, /card show/)
      assert.doesNotMatch(created.stderr, /BL-HISTORY|D-SUMMARY/)
    })
    await check(`${lang}: suggested mutations work outside the project and diagnostics preserve successful writes`, () => {
      const f = fixture(`outside ' quote-${lang}`, lang)
      const path = join(f.board, 'backlog-manifest.json'), manifest = JSON.parse(readFileSync(path, 'utf8'))
      manifest.items.push({ id: 'BL-PROSE', title: 'Long prose', status: 'ready', tier: 1, priority: 'med', problem: 'Original evidence. '.repeat(60) })
      write(path, manifest)
      const outside = spawnSync(process.execPath, [join(repo, 'scripts/ddd.mjs'), 'card', 'set', 'BL-PROSE', 'title', 'Updated outside', '--dir', f.board], { cwd: work, env, encoding: 'utf8' })
      assert.equal(outside.status, 0, outside.stderr)
      const mutations = [...outside.stderr.matchAll(/`([^`]+card set 'BL-PROSE' (?:detail|journey) [^`]+)`/g)].map(match => match[1].split(' <')[0])
      assert.equal(mutations.length, 2)
      const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'"
      const journey = JSON.parse(readFileSync(join(f.board, 'decisions-manifest.json'), 'utf8')).entries[0].journey
      for (const command of mutations) {
        const value = command.includes(' detail ') ? 'Complete original evidence.' : JSON.stringify(journey)
        const result = spawnSync('/bin/sh', ['-c', command + ' ' + quote(value)], { cwd: work, env, encoding: 'utf8' })
        assert.equal(result.status, 0, result.stderr)
      }
      const updated = JSON.parse(cli(f, 'ddd.mjs', ['card', 'show', 'BL-PROSE', '--json']).stdout)
      assert.equal(updated.detail, 'Complete original evidence.')
      assert.deepEqual(updated.journey, journey)
      // 非数组的其它 manifest 能让审计 collector 抛错;附加收尾不能推翻已完成的新卡写入。
      write(join(f.board, 'manifest.json'), { tasks: {} })
      const made = cli(f, 'ddd.mjs', ['card', 'new', 'backlog', '--title', 'Successful despite unrelated source damage', '--json'])
      assert.equal(JSON.parse(made.stdout).ok, true)
      assert.match(made.stderr, lang === 'zh' ? /收尾核对未完成/ : /could not be checked/)
      assert.match(made.stderr, /audit --dir/)
    })
    await check(`${lang}: feedback findings describe Git persistence and preserve human verdicts`, () => {
      const f = fixture(`closeout-feedback-${lang}`, lang)
      const path = join(f.board, 'kanban.config.json'), cfg = JSON.parse(readFileSync(path, 'utf8'))
      write(path, { ...cfg, acceptanceFeedback: true })
      const feedback = JSON.stringify({ ts: '2020-01-01T00:00:00Z', pr: 17, item: 'AC1', who: 'human', rev: 1, verdict: 'bad' }) + '\n'
      const file = join(f.board, 'acceptance-feedback.jsonl'); writeFileSync(file, feedback)
      const audit = JSON.parse(cli(f, 'ddd.mjs', ['audit', '--json']).stdout)
      const finding = audit.chore.find(entry => entry.key === 'accFbUncommitted')
      assert.equal(finding.n, 1)
      assert.match(finding.text, /Git/)
      assert.match(finding.text, /git diff HEAD/)
      assert.match(finding.text, lang === 'zh' ? /不表示验收未判或未通过/ : /not a claim that acceptance is unjudged or failed/)
      assert.equal(readFileSync(file, 'utf8'), feedback)
    })
    await check(`${lang}: CLI exposes both shared advisories without rewriting evidence`, () => {
      const f = fixture(`audit-${lang}`, lang), before = snapshot(f.board)
      const audit = JSON.parse(cli(f, 'ddd.mjs', ['audit', '--json']).stdout)
      assert.deepEqual(audit.block, [])
      assert.deepEqual(audit.chore.map(entry => entry.key).sort(), ['journeySuggested', 'journeySummary'])
      hints(audit.summary)
      assert.deepEqual(snapshot(f.board), before)
    })
    await check(`${lang}: direct core settlement is read-only and does not block either advisory`, () => {
      const f = fixture(`core-${lang}`, lang), before = snapshot(f.board)
      for (const repeatedStop of [false, true]) {
        const result = runHook({ event: 'settle', cwd: f.root, repeatedStop })
        assert.equal(result.kind, 'none'); hints(result.notice)
      }
      assert.equal(runHook({ event: 'before-tool', cwd: f.root, tool: { kind: 'read', path: 'app/kanban/journeys/D-SUMMARY.html' } }).kind, 'deny-tool')
      assert.equal(runHook({ event: 'before-tool', cwd: f.root, tool: { kind: 'other', path: 'app/kanban/journeys/D-SUMMARY.html' } }).kind, 'none')
      assert.deepEqual(snapshot(f.board), before)
    })
    for (const adapter of ['claude', 'codex']) await check(`${lang}: ${adapter} carries shared hints and preserves card sources`, () => {
      const f = fixture(`${adapter}-${lang}`, lang), before = sources(f.board)
      const stopped = adapter === 'claude' ? cli(f, 'stop-hook.mjs', [], { cwd: f.root }) : cli(f, 'codex-hook.mjs', ['settle'], { cwd: f.root })
      const payload = JSON.parse(stopped.stdout)
      assert.equal(payload.decision, undefined); hints(payload.systemMessage)
      assert.deepEqual(sources(f.board), before)
      assert.equal(existsSync(join(f.board, 'journeys/D-SUMMARY.html')), true, 'existing Stop adapters retain generation')
      const input = { cwd: f.root, tool_name: 'Read', tool_input: { file_path: 'app/kanban/journeys/D-SUMMARY.html' } }
      const denied = adapter === 'claude' ? cli(f, 'read-gate.mjs', [], input) : cli(f, 'codex-hook.mjs', ['pre-tool'], input)
      assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny')
    })
    await check(`${lang}: Pi carries shared hints without continuation or generation`, async () => {
      const f = fixture(`pi-${lang}`, lang), before = snapshot(f.board), emit = piHost(f.root)
      const prior = { type: 'custom', customType: 'other', data: 'preserve' }
      const result = await emit('agent_before_settle', { outcome: 'completed', entries: [prior], context: { canContinue: false } })
      assert.notEqual(result.continue, true); assert.deepEqual(result.entries[0], prior)
      hints(result.entries[1].content)
      assert.equal(await emit('agent_before_settle', { outcome: 'aborted', entries: [] }), undefined)
      assert.equal((await emit('tool_call', { toolName: 'read', input: { path: 'app/kanban/journeys/D-SUMMARY.html' } })).block, true)
      assert.equal(await emit('tool_call', { toolName: 'custom', input: { path: 'app/kanban/journeys/D-SUMMARY.html' } }), undefined)
      assert.deepEqual(snapshot(f.board), before)
    })
  }
  console.log(`Harness contract: ${checks} groups passed`)
} finally { rmSync(work, { recursive: true, force: true }) }
