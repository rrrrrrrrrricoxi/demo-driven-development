// 只在临时合成看板中模拟并行会话;不借 session 标签推断文件归属。
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localDate } from '../scripts/cards.mjs'
import { runHook } from '../scripts/hook-core.mjs'
import { loadStrings } from '../scripts/strings.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const work = realpathSync(mkdtempSync(join(tmpdir(), 'ddd-shared-settlement-')))
const env = { ...process.env, CLAUDE_CONFIG_DIR: join(work, 'no-installs') }
for (const key of ['DDD_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'DDD_RUNTIME', 'DDD_HOOK_FORWARDED']) delete env[key]
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] })
const commit = (root) => {
  git(root, 'add', '.')
  git(root, '-c', 'user.name=DDD fixture', '-c', 'user.email=ddd-fixture@example.invalid', 'commit', '-qm', 'fixture')
}
const fill = (text) => text.replaceAll('{{BRAND}}', 'Shared test').replaceAll('{{GH_REPO}}', '')
  .replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '').replaceAll('{{DEMO_BASE}}', '')
function fixture(name, extra = {}) {
  const root = join(work, name), kb = join(root, 'app/kanban')
  mkdirSync(join(kb, 'demos'), { recursive: true }); mkdirSync(join(kb, 'shots'))
  const config = JSON.parse(fill(readFileSync(join(repo, 'templates/kanban.config.json'), 'utf8')))
  writeFileSync(join(kb, 'kanban.config.json'), JSON.stringify({ ...config, lang: 'en', concurrentSessions: true, richText: true, ...extra }))
  for (const file of readdirSync(join(repo, 'templates/manifests'))) {
    writeFileSync(join(kb, file), fill(readFileSync(join(repo, 'templates/manifests', file), 'utf8')))
  }
  git(root, 'init', '-q', '-b', 'main'); commit(root)
  return { root, kb }
}
function addFindings(f) {
  writeFileSync(join(f.kb, 'demos/other-session.html'), '<!doctype html><html><body>pending card</body></html>')
  const manifest = join(f.kb, 'manifest.json'), data = JSON.parse(readFileSync(manifest, 'utf8'))
  data.tasks.push({ id: 'OTHER-LONG', title: 'Other session draft', status: 'active', session: 'other-session', date: localDate(), problem: 'x'.repeat(801) })
  writeFileSync(manifest, JSON.stringify(data))
}
const settle = (root, options) => runHook({ event: 'settle', cwd: root, repeatedStop: false, tool: { kind: 'other' } }, options)
const script = (root, name, args = []) => spawnSync(process.execPath, [join(repo, 'scripts', name), ...args], { cwd: root, env, encoding: 'utf8' })
function stop(root, session) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(repo, 'scripts/codex-hook.mjs'), 'stop'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk }); child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject); child.on('close', (status) => resolve({ status, stdout, stderr }))
    child.stdin.end(JSON.stringify({ cwd: root, session_id: session }))
  })
}
let checks = 0
async function check(name, fn) { await fn(); checks++; console.log(`✓ ${name}`) }
try {
  await check('two simultaneous Stop calls allow board-wide orphan and new long-card findings', async () => {
    const f = fixture('two sessions'); addFindings(f)
    const outcomes = await Promise.all([stop(f.root, 'session-a'), stop(f.root, 'session-b')])
    for (const out of outcomes) {
      assert.equal(out.status, 0, out.stderr)
      const payload = JSON.parse(out.stdout)
      assert.equal(payload.decision, undefined)
      assert.match(payload.systemMessage, /other-session\.html/)
      assert.match(payload.systemMessage, /OTHER-LONG/)
      assert.ok(payload.systemMessage.includes(loadStrings(f.kb).concurrentStopNotice))
    }
  })
  await check('unconfigured Stop still blocks the same board-wide findings', () => {
    const f = fixture('default', { concurrentSessions: undefined }); addFindings(f)
    const out = settle(f.root)
    assert.equal(out.kind, 'block-stop'); assert.match(out.reason, /other-session\.html/); assert.match(out.reason, /OTHER-LONG/)
  })
  await check('explicit audit retains block severity for both shared-board findings', () => {
    const f = fixture('explicit audit'); addFindings(f)
    const out = script(f.root, 'ddd.mjs', ['audit', '--dir', f.kb, '--json'])
    assert.equal(out.status, 0, out.stderr)
    assert.deepEqual(JSON.parse(out.stdout).block.map((entry) => entry.key).sort(), ['orphan', 'richLongNew'])
  })
  await check('shared generator failure is advisory while explicit generation still fails', () => {
    for (const lang of ['en', 'zh']) for (const withFindings of [false, true]) {
      const f = fixture(`generator failure ${lang} ${withFindings}`, { lang })
      if (withFindings) addFindings(f)
      writeFileSync(join(f.kb, 'backlog-manifest.json'), '{')
      const out = settle(f.root, { regenerate: true })
      assert.equal(out.kind, 'none'); assert.equal(out.reason, undefined)
      if (withFindings) { assert.match(out.notice, /other-session\.html/); assert.match(out.notice, /OTHER-LONG/) }
      assert.ok(out.notice.includes(loadStrings(f.kb).concurrentStopNotice)); assert.match(out.notice, /gen/)
      assert.equal(existsSync(join(f.kb, 'index.html')), false)
      const explicit = script(f.root, 'gen.mjs', ['--dir', f.kb])
      assert.notEqual(explicit.status, 0); assert.ok(explicit.stderr)
    }
  })
  await check('shared Stop resolves each worktree board independently', () => {
    const f = fixture('worktree main'), other = join(work, 'worktree feature')
    git(f.root, 'worktree', 'add', '-qb', 'feature', other)
    addFindings(f)
    assert.match(settle(f.root).notice, /other-session\.html/)
    const isolated = settle(other)
    assert.equal(isolated.kind, 'none'); assert.doesNotMatch(isolated.notice || '', /other-session\.html|OTHER-LONG/)
    assert.equal(existsSync(join(other, 'app/kanban/demos/other-session.html')), false)
  })
  await check('shared mode keeps generated reads and merge violations denied', () => {
    const f = fixture('tool safeguards')
    for (const tool of [{ kind: 'read', path: 'app/kanban/index.html' }, { kind: 'shell', command: 'cat app/kanban/parts/backlog.html' }]) {
      assert.equal(runHook({ event: 'before-tool', cwd: f.root, tool }).kind, 'deny-tool')
    }
    git(f.root, 'checkout', '-qb', 'feature')
    writeFileSync(join(f.kb, 'manifest.json'), readFileSync(join(f.kb, 'manifest.json'), 'utf8') + '\n'); commit(f.root)
    assert.equal(runHook({ event: 'before-tool', cwd: f.root, tool: { kind: 'shell', command: 'gh pr merge' } }).kind, 'deny-tool')
  })
  await check('shared mode keeps mainline and newer-output safeguards', () => {
    const f = fixture('generation safeguards')
    git(f.root, 'checkout', '-qb', 'feature')
    const branch = settle(f.root, { regenerate: true })
    assert.equal(branch.kind, 'none'); assert.match(branch.notice, /main/)
    assert.equal(existsSync(join(f.kb, 'index.html')), false)
    git(f.root, 'checkout', '-q', 'main')
    const index = join(f.kb, 'index.html'), newer = '<!doctype html>\n<!-- ddd-gen v999.99.99 -->\nKEEP'
    writeFileSync(index, newer)
    const out = settle(f.root, { regenerate: true })
    assert.equal(out.kind, 'none'); assert.match(out.notice, /999\.99\.99/)
    assert.equal(readFileSync(index, 'utf8'), newer)
  })
  await check('a stale-input marker requests regeneration despite a newer output timestamp', () => {
    const f = fixture('stale generation marker'), index = join(f.kb, 'index.html')
    const version = JSON.parse(readFileSync(join(repo, 'plugin.json'), 'utf8')).version
    writeFileSync(index, `<!doctype html>\n<!-- ddd-gen v${version} -->\nSTALE-MARKER-FIXTURE`)
    const future = new Date(Date.now() + 60000); utimesSync(index, future, future)
    writeFileSync(join(f.kb, '.ddd-gen-stale'), '')
    assert.equal(settle(f.root, { regenerate: true }).kind, 'none')
    assert.doesNotMatch(readFileSync(index, 'utf8'), /STALE-MARKER-FIXTURE/)
  })
  await check('disabling concurrent mode makes a leftover marker irrelevant to freshness', () => {
    const f = fixture('disabled with stale marker', { concurrentSessions: false }), index = join(f.kb, 'index.html')
    const version = JSON.parse(readFileSync(join(repo, 'plugin.json'), 'utf8')).version
    const current = `<!doctype html>\n<!-- ddd-gen v${version} -->\nCURRENT-DISABLED-FIXTURE`
    writeFileSync(index, current)
    const future = new Date(Date.now() + 60000); utimesSync(index, future, future)
    const marker = join(f.kb, '.ddd-gen-stale'); writeFileSync(marker, 'retry when concurrent mode resumes\n')
    assert.equal(settle(f.root, { regenerate: true }).kind, 'none')
    assert.equal(readFileSync(index, 'utf8'), current)
    assert.equal(readFileSync(marker, 'utf8'), 'retry when concurrent mode resumes\n')
  })
  console.log(`Shared settlement: ${checks} checks passed`)
} finally { rmSync(work, { recursive: true, force: true }) }
