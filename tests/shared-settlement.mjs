// 只在临时合成看板中模拟并行会话;不借 session 标签推断文件归属。
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localDate } from '../scripts/cards.mjs'
import { runHook } from '../scripts/hook-core.mjs'
import { runSettlementGeneration } from '../scripts/hook-settle.mjs'
import { GENERATION_DEFERRED } from '../scripts/gen-deferral.mjs'
import { lockRoot } from '../scripts/gen-concurrent.mjs'
import { hostname } from 'node:os'
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
// 每个 gen 子进程都写独立事件;源变化发生在 renderer 读入之后,不依赖调度时序。
const preload = join(work, 'mutate-generation.cjs')
writeFileSync(preload, `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const { join } = require('node:path');
const read = fs.readFileSync;
const isGen = process.argv[1]?.endsWith('/gen.mjs');
let entered = false;
if (isGen) {
  fs.appendFileSync(process.env.TEST_ATTEMPTS, 'attempt\\n');
  if (process.env.TEST_CHANGE === 'lock-timeout') {
    const now = Date.now; let tick = 0; Date.now = () => now() + (++tick * 40001);
  }
}
fs.readFileSync = function(path, ...args) {
  const result = read.call(this, path, ...args);
  const caller = new Error().stack.split('\\n')[2] || '';
  if (isGen && !entered && String(path).endsWith('/manifest.json') && /scripts\\/gen.mjs:/.test(caller)) {
    entered = true;
    const attempts = read(process.env.TEST_ATTEMPTS, 'utf8').trim().split('\\n').length;
    if (process.env.TEST_CHANGE === 'always' || (process.env.TEST_CHANGE === 'once' && attempts === 1)) {
      const data = JSON.parse(result); data.instance.name = 'EDIT-' + attempts;
      fs.writeFileSync(path, JSON.stringify(data));
    }
    if (process.env.TEST_CHANGE === 'permission') throw Object.assign(new Error('TEST EACCES generation'), { code: 'EACCES' });
  }
  return result;
};
syncBuiltinESMExports();
`)
const hookWithMutation = (f, adapter, mutation, attempts) => spawnSync(process.execPath,
  [join(repo, 'scripts', adapter), ...(adapter === 'codex-hook.mjs' ? ['stop'] : [])], {
    cwd: f.root, encoding: 'utf8', input: JSON.stringify({ cwd: f.root }),
    env: { ...env, NODE_OPTIONS: `--require="${preload}"`, TEST_CHANGE: mutation, TEST_ATTEMPTS: attempts },
  })
const attemptsOf = (path) => readFileSync(path, 'utf8').trim().split('\n').length
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
  await check('Claude and Codex Stop retry one source change and defer after exactly two changes', () => {
    for (const adapter of ['codex-hook.mjs', 'stop-hook.mjs']) for (const lang of ['en', 'zh']) for (const mutation of ['once', 'always']) {
      const f = fixture(`${adapter} ${lang} ${mutation}`, { lang }), attempts = join(f.root, 'attempts')
      const out = hookWithMutation(f, adapter, mutation, attempts)
      assert.equal(out.status, 0, out.stderr)
      assert.equal(attemptsOf(attempts), 2)
      const payload = out.stdout ? JSON.parse(out.stdout) : {}
      assert.equal(payload.decision, undefined)
      assert.doesNotMatch(out.stdout + out.stderr, /\n\s+at |Error:|node:internal/)
      assert.equal(readdirSync(lockRoot(f.kb)).length, 0)
      if (mutation === 'once') {
        assert.equal(existsSync(join(f.kb, '.ddd-gen-stale')), false)
        assert.ok(existsSync(join(f.kb, 'index.html')))
        assert.doesNotMatch(out.stdout, /generation deferred|生成暂缓|generation failed|生成失败/)
      } else {
        assert.ok(existsSync(join(f.kb, '.ddd-gen-stale')))
        assert.ok(out.stdout.includes(loadStrings(f.kb).concurrentGenDeferred))
        const recovery = script(f.root, 'gen.mjs', ['--dir', f.kb])
        assert.equal(recovery.status, 0, recovery.stderr)
        assert.equal(existsSync(join(f.kb, '.ddd-gen-stale')), false)
      }
    }
  })
  await check('lock timeout and permission failures run once and remain distinct', () => {
    for (const mutation of ['lock-timeout', 'permission', 'syntax']) {
      const f = fixture(mutation), attempts = join(f.root, 'attempts')
      if (mutation === 'syntax') writeFileSync(join(f.kb, 'backlog-manifest.json'), '{')
      let owner
      if (mutation === 'lock-timeout') {
        owner = join(lockRoot(f.kb), `${Buffer.from(hostname()).toString('base64url')}.${process.pid}.live`)
        mkdirSync(owner, { recursive: true }); writeFileSync(join(owner, 'ticket'), '1')
      }
      const out = hookWithMutation(f, 'codex-hook.mjs', mutation, attempts)
      assert.equal(out.status, 0, out.stderr)
      assert.equal(attemptsOf(attempts), 1)
      if (owner) {
        assert.ok(out.stdout.includes(loadStrings(f.kb).concurrentGenDeferred))
        assert.equal(readdirSync(lockRoot(f.kb)).length, 1)
        rmSync(owner, { recursive: true })
      } else {
        assert.match(out.stdout, mutation === 'permission' ? /TEST EACCES generation/ : /SyntaxError/)
        assert.doesNotMatch(out.stdout, /generation deferred/)
        assert.equal(readdirSync(lockRoot(f.kb)).length, 0)
      }
    }
  })
  await check('generation retries share the remaining budget and never retry other failures', () => {
    const source = GENERATION_DEFERRED['sources-changed']
    for (const [statuses, concurrent, expected] of [
      [[source, 0], true, 2], [[source, source], true, 2], [[source, 0], false, 1],
      [[GENERATION_DEFERRED['lock-timeout'], 0], true, 1],
      [[GENERATION_DEFERRED['startup-config-race'], 0], true, 1], [[1, 0], true, 1],
    ]) {
      let clock = 0; const calls = []
      runSettlementGeneration('gen', 'board', { concurrent, deadline: 55000, now: () => clock,
        run: (_, __, options) => { calls.push(options); clock += 1000; return { status: statuses[calls.length - 1] } },
      })
      assert.equal(calls.length, expected)
      assert.equal(calls[0].timeout, 55000)
      if (expected === 2) assert.equal(calls[1].timeout, 54000)
      assert.ok(calls.every((call) => call.killSignal === 'SIGKILL'))
    }
    let clock = 0, calls = 0
    runSettlementGeneration('gen', 'board', { concurrent: true, deadline: 55000, now: () => clock,
      run: () => { calls++; clock = 54000; return { status: source } },
    })
    assert.equal(calls, 1, 'insufficient remaining budget defers without a second process')
  })
  console.log(`Shared settlement: ${checks} checks passed`)
} finally { rmSync(work, { recursive: true, force: true }) }
