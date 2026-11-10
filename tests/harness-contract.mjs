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
function piHost(root) {
  const handlers = new Map(), listeners = new Map()
  piAdapter({ on: (name, fn) => handlers.set(name, fn), events: { on: (name, fn) => listeners.set(name, fn), emit: (name, value) => listeners.get(name)?.(value) }, sendMessage() {} })
  const ctx = { cwd: root, sessionManager: { getSessionId: () => 'fixture' } }
  return (name, value = {}) => handlers.get(name)?.({ type: name, ...value }, ctx)
}
let checks = 0
async function check(name, fn) { await fn(); checks++; console.log(`✓ ${name}`) }
try {
  for (const lang of ['en', 'zh']) {
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
