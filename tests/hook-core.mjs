// Neutral hook boundary: synthetic boards and fake installs only.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runHook } from '../scripts/hook-core.mjs'
import { encodeHookResult, normalizeHook } from '../scripts/hook-protocol.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const work = realpathSync(mkdtempSync(join(tmpdir(), 'ddd-hook-core-')))
const version = JSON.parse(readFileSync(join(repo, 'plugin.json'), 'utf8')).version
const env = { ...process.env, CLAUDE_CONFIG_DIR: join(work, 'no-installs') }
for (const key of ['DDD_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'DDD_RUNTIME', 'DDD_HOOK_FORWARDED']) delete env[key]
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] })
const commit = (root) => {
  git(root, 'add', '.')
  git(root, '-c', 'user.name=DDD fixture', '-c', 'user.email=ddd-fixture@example.invalid', 'commit', '-qm', 'fixture')
}
const fill = (text) => text.replaceAll('{{BRAND}}', 'Core test').replaceAll('{{GH_REPO}}', '')
  .replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '').replaceAll('{{DEMO_BASE}}', '')
function fixture(name) {
  const root = join(work, name), kb = join(root, 'app', 'kanban')
  mkdirSync(join(kb, 'demos'), { recursive: true })
  mkdirSync(join(kb, 'shots'), { recursive: true })
  const config = JSON.parse(fill(readFileSync(join(repo, 'templates/kanban.config.json'), 'utf8')))
  config.lang = 'en'
  writeFileSync(join(kb, 'kanban.config.json'), JSON.stringify(config))
  for (const file of readdirSync(join(repo, 'templates/manifests'))) {
    writeFileSync(join(kb, file), fill(readFileSync(join(repo, 'templates/manifests', file), 'utf8')))
  }
  git(root, 'init', '-q', '-b', 'main'); commit(root)
  return { root, kb }
}
function snapshot(root) {
  const files = {}
  const visit = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix + entry.name, path = join(dir, entry.name)
      if (entry.isDirectory()) { files[rel + '/'] = null; visit(path, rel + '/') }
      else files[rel] = readFileSync(path).toString('base64')
    }
  }
  visit(root); return files
}
const request = (root, event = 'settle', tool = {}) => ({ event, cwd: root, tool: { kind: 'other', ...tool }, repeatedStop: false })
// Core calls must return diagnostics rather than print them, even on failure.
function core(req, options) {
  const stdout = process.stdout.write, stderr = process.stderr.write
  let emitted = ''
  process.stdout.write = process.stderr.write = function (chunk) { emitted += String(chunk); return true }
  let result
  try { result = runHook(req, options) } finally { process.stdout.write = stdout; process.stderr.write = stderr }
  assert.equal(emitted, '', 'core emitted process output')
  return result
}
function cli(script, payload, options = {}) {
  return spawnSync(process.execPath, [join(repo, 'scripts', script)], {
    cwd: work, env, encoding: 'utf8', input: typeof payload === 'string' ? payload : JSON.stringify(payload), ...options,
  })
}
let checks = 0
function check(name, fn) { fn(); checks++; console.log(`✓ ${name}`) }
try {
  check('importing the core does not read stdin, emit output, exit, or mutate a board', () => {
    const f = fixture('import'), before = snapshot(f.kb)
    const source = `
      import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module';
      const read = fs.readFileSync; let violations = 0;
      fs.readFileSync = function(path, ...args) { if (path === 0) { violations++; throw new Error('stdin read') } return read.call(this, path, ...args) };
      syncBuiltinESMExports();
      Object.defineProperty(process, 'stdin', { get() { violations++; throw new Error('stdin access') } });
      process.exit = () => { violations++; throw new Error('process exit') };
      const output = process.stdout.write;
      process.stdout.write = process.stderr.write = () => { violations++; throw new Error('import output') };
      await import(${JSON.stringify(pathToFileURL(join(repo, 'scripts/hook-core.mjs')).href)});
      output.call(process.stdout, 'imported:'+violations);
    `
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd: f.root, env: { ...env, DDD_PROJECT_DIR: f.root, CLAUDE_PROJECT_DIR: f.root }, input: 'not JSON', encoding: 'utf8',
    })
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, 'imported:0'); assert.equal(r.stderr, '')
    assert.deepEqual(snapshot(f.kb), before)
  })
  check('settlement defaults to read-only on first-run, current, stale, and orphan boards', () => {
    const f = fixture('read only'), req = request(f.root)
    let before = snapshot(f.kb)
    assert.equal(core(req).kind, 'none'); assert.deepEqual(snapshot(f.kb), before)
    writeFileSync(join(f.kb, 'index.html'), `<!doctype html>\n<!-- ddd-gen v${version} -->\nCURRENT`)
    const future = new Date(Date.now() + 60000); utimesSync(join(f.kb, 'index.html'), future, future)
    before = snapshot(f.kb)
    assert.equal(core(req).kind, 'none'); assert.deepEqual(snapshot(f.kb), before)
    writeFileSync(join(f.kb, 'index.html'), '<!doctype html>\n<!-- ddd-gen v0.0.0 -->\nSTALE')
    before = snapshot(f.kb)
    assert.equal(core(req).kind, 'none'); assert.deepEqual(snapshot(f.kb), before)
    writeFileSync(join(f.kb, 'demos/orphan.html'), '<!doctype html><html><body>orphan</body></html>')
    before = snapshot(f.kb)
    const blocked = core(req)
    assert.equal(blocked.kind, 'block-stop'); assert.match(blocked.reason, /orphan\.html/)
    assert.deepEqual(snapshot(f.kb), before)
    const repeated = core({ ...req, repeatedStop: true })
    assert.equal(repeated.kind, 'none'); assert.match(repeated.notice, /orphan\.html/)
    assert.deepEqual(snapshot(f.kb), before)
  })
  check('repeated direct calls use each request cwd despite stale harness environment', () => {
    const a = fixture('project a'), b = fixture('project b'), empty = join(work, 'non DDD')
    mkdirSync(empty)
    writeFileSync(join(a.kb, 'demos/a-orphan.html'), '<html><body>orphan</body></html>')
    const saved = Object.fromEntries(['DDD_PROJECT_DIR', 'CLAUDE_PROJECT_DIR'].map((key) => [key, process.env[key]]))
    try {
      process.env.DDD_PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR = a.root
      assert.equal(core(request(a.root)).kind, 'block-stop')
      assert.equal(core(request(b.root)).kind, 'none')
      assert.deepEqual(core(request(empty)), { kind: 'none' })
      assert.equal(core(request(b.root, 'before-tool', { kind: 'read', path: join(a.kb, 'index.html') })).kind, 'none')
      assert.equal(core(request(b.root, 'before-tool', { kind: 'read', path: 'app/kanban/index.html' })).kind, 'deny-tool')
      assert.equal(core(request(a.root)).kind, 'block-stop')
      assert.equal(existsSync(join(b.kb, 'index.html')), false)
    } finally {
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    }
  })
  check('shared read-only settlement and PR guidance make no host generation promise in either language', () => {
    for (const lang of ['en', 'zh']) {
      const f = fixture('guidance ' + lang), req = request(f.root)
      const config = join(f.kb, 'kanban.config.json')
      writeFileSync(config, JSON.stringify({ ...JSON.parse(readFileSync(config, 'utf8')), lang }))
      writeFileSync(join(f.kb, 'demos/orphan.html'), '<html><body>orphan</body></html>')
      const before = snapshot(f.kb)
      const blocked = core(req)
      assert.equal(blocked.kind, 'block-stop')
      assert.match(blocked.reason, /orphan\.html/)
      const reminder = core(request(f.root, 'after-tool', { kind: 'shell', command: 'gh pr create' }))
      assert.match(reminder.additionalContext, /card link/)
      assert.doesNotMatch(blocked.reason + reminder.additionalContext, /regenerates automatically|自动重生成|Stop/)
      assert.deepEqual(snapshot(f.kb), before)
      const repeated = core({ ...req, repeatedStop: true })
      assert.match(repeated.notice, /:\n\s*- app\/kanban\/demos\/orphan\.html/, 'core must preserve the audit list layout')
      const wire = JSON.parse(encodeHookResult(repeated).stdout)
      assert.match(wire.systemMessage, / · - app\/kanban\/demos\/orphan\.html/)
      assert.equal(wire.systemMessage.includes('\n'), false, 'legacy output keeps one audit per line')
    }
  })
  check('legacy encoding compacts independent notices and failures but preserves block reasons and diagnostics', () => {
    const noticeParts = ['First notice:\n  - one\n\n  - two', 'Second notice:\n  detail']
    const notice = noticeParts.join('\n\n')
    const compact = 'First notice: · - one · - two\nSecond notice: · detail'
    for (const kind of ['none', 'block-stop']) {
      const reason = 'Fix these:\n  - one\n  - two'
      const encoded = encodeHookResult({ kind, notice, noticeParts, reason, stderr: 'diagnostic\n' })
      const payload = JSON.parse(encoded.stdout)
      assert.equal(payload.systemMessage, compact)
      if (kind === 'block-stop') assert.equal(payload.reason, reason)
      assert.equal(encoded.stderr, 'diagnostic\n'); assert.equal(encoded.exitCode, 0)
    }
    assert.deepEqual(encodeHookResult({ kind: 'failure', reason: notice, reasonParts: noticeParts, stderr: 'diagnostic\n' }), {
      stdout: '', stderr: 'diagnostic\n' + compact, exitCode: 2,
    })
    assert.equal(JSON.parse(encodeHookResult({ kind: 'none', notice }).stdout).systemMessage, notice,
      'unstructured host results keep their existing line breaks')
  })
  check('read-only branch and newer-output notices make no automatic-rebuild promise in either language', () => {
    for (const lang of ['en', 'zh']) {
      const f = fixture('branch guidance ' + lang), req = request(f.root)
      const config = join(f.kb, 'kanban.config.json'), index = join(f.kb, 'index.html')
      writeFileSync(config, JSON.stringify({ ...JSON.parse(readFileSync(config, 'utf8')), lang }))
      assert.equal(core(req, { regenerate: true }).kind, 'none')
      commit(f.root); git(f.root, 'checkout', '-qb', 'feature')
      writeFileSync(index, readFileSync(index, 'utf8') + '\n<!-- dirty -->\n')
      let before = snapshot(f.kb)
      const branch = core(req)
      assert.match(branch.notice, /git checkout main/)
      assert.doesNotMatch(branch.notice, /guard rebuilds|自会重渲/)
      assert.deepEqual(snapshot(f.kb), before)
      writeFileSync(index, '<!doctype html>\n<!-- ddd-gen v999.99.99 -->\nKEEP')
      before = snapshot(f.kb)
      const newer = core(req)
      assert.match(newer.notice, /999\.99\.99/)
      assert.doesNotMatch(newer.notice, /recovers once|自动恢复/)
      assert.deepEqual(snapshot(f.kb), before)
    }
  })
  check('generation requires opt-in and keeps existing off-main and detached guards', () => {
    const f = fixture('generation'), req = request(f.root)
    assert.equal(core(req, { regenerate: true }).kind, 'none')
    assert.match(readFileSync(join(f.kb, 'index.html'), 'utf8').slice(0, 100), /ddd-gen v/)
    commit(f.root); git(f.root, 'checkout', '-qb', 'feature')
    const manifest = join(f.kb, 'manifest.json')
    writeFileSync(manifest, readFileSync(manifest, 'utf8') + '\n'); commit(f.root)
    const future = new Date(Date.now() + 60000); utimesSync(manifest, future, future)
    const before = snapshot(f.kb)
    assert.ok(core(req, { regenerate: true }).notice); assert.deepEqual(snapshot(f.kb), before)
    git(f.root, 'checkout', '--detach', '-q')
    assert.ok(core(req, { regenerate: true }).notice); assert.deepEqual(snapshot(f.kb), before)
  })
  check('generation follows the selected board despite stale project environment and preserves parent env', () => {
    const keys = ['DDD_PROJECT_DIR', 'CLAUDE_PROJECT_DIR']
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    const failures = []
    try {
      for (const key of keys) for (const adapter of ['core', 'codex']) {
        const a = fixture(`stale ${key} ${adapter} a`), b = fixture(`stale ${key} ${adapter} b`)
        const beforeA = snapshot(a.kb)
        for (const candidate of keys) delete process.env[candidate]
        process.env[key] = a.root
        const beforeEnv = Object.fromEntries(keys.map((candidate) => [candidate, process.env[candidate]]))
        if (adapter === 'core') {
          assert.equal(core(request(b.root), { regenerate: true }).kind, 'none')
        } else {
          const r = spawnSync(process.execPath, [join(repo, 'scripts/codex-hook.mjs'), 'stop'], {
            cwd: work, env: { ...env, [key]: a.root }, encoding: 'utf8', input: JSON.stringify({ cwd: b.root }),
          })
          assert.equal(r.status, 0, r.stderr)
        }
        assert.deepEqual(Object.fromEntries(keys.map((candidate) => [candidate, process.env[candidate]])), beforeEnv)
        const selectedGenerated = existsSync(join(b.kb, 'index.html'))
        const staleUnchanged = JSON.stringify(snapshot(a.kb)) === JSON.stringify(beforeA)
        if (!selectedGenerated || !staleUnchanged) failures.push({ adapter, key, selectedGenerated, staleUnchanged })
      }
    } finally {
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    }
    assert.deepEqual(failures, [], 'generation must target request.cwd rather than inherited harness context')
  })
  check('neutral denial and blocking encode as legacy exit-zero JSON decisions', () => {
    const f = fixture('decisions'), tool = { kind: 'read', path: 'app/kanban/index.html' }
    const denied = core(request(f.root, 'before-tool', tool)), encoded = encodeHookResult(denied)
    assert.equal(denied.kind, 'deny-tool'); assert.equal(encoded.exitCode, 0)
    assert.equal(JSON.parse(encoded.stdout).hookSpecificOutput.permissionDecision, 'deny')
    const direct = cli('read-gate.mjs', { cwd: f.root, tool_name: 'Read', tool_input: { file_path: tool.path } })
    assert.equal(direct.status, 0, direct.stderr); assert.equal(direct.stdout, encoded.stdout)
    writeFileSync(join(f.kb, 'demos/orphan.html'), '<html><body>orphan</body></html>')
    const blocked = encodeHookResult(core(request(f.root)))
    assert.equal(blocked.exitCode, 0); assert.equal(JSON.parse(blocked.stdout).decision, 'block')
    assert.equal(encodeHookResult({ kind: 'none' }).stdout, '', 'no decision must not emit allow')
  })
  check('generator failure returns a semantic failure and repeated Stop returns a notice', () => {
    const f = fixture('failure'), req = request(f.root)
    writeFileSync(join(f.kb, 'manifest.json'), '{')
    const failed = core(req, { regenerate: true })
    assert.equal(failed.kind, 'failure'); assert.ok(failed.reason)
    const wire = encodeHookResult(failed)
    assert.equal(wire.exitCode, 2); assert.equal(wire.stdout, ''); assert.ok(wire.stderr)
    const repeated = core({ ...req, repeatedStop: true }, { regenerate: true })
    assert.equal(repeated.kind, 'none'); assert.ok(repeated.notice)
    assert.equal(encodeHookResult(repeated).exitCode, 0)
  })
  check('generated-read denial stops dispatch before any merge lookup', () => {
    const f = fixture('short circuit'), bin = join(work, 'bin'), marker = join(work, 'gh-called')
    git(f.root, 'checkout', '-qb', 'feature')
    const manifest = join(f.kb, 'manifest.json')
    writeFileSync(manifest, readFileSync(manifest, 'utf8') + '\n'); commit(f.root)
    mkdirSync(bin)
    writeFileSync(join(bin, 'gh'), `#!/bin/sh\nprintf called > '${marker}'\nprintf '{"headRefName":"feature"}'\n`)
    chmodSync(join(bin, 'gh'), 0o755)
    const path = process.env.PATH
    try {
      process.env.PATH = bin + ':' + path
      assert.equal(core(request(f.root, 'before-tool', { kind: 'shell', command: 'gh pr merge 12' })).kind, 'deny-tool')
      assert.equal(existsSync(marker), true, 'stub must be reachable without a read denial')
      rmSync(marker)
      const out = core(request(f.root, 'before-tool', { kind: 'shell', command: 'gh pr merge 12 ; cat app/kanban/index.html' }))
      assert.equal(out.kind, 'deny-tool'); assert.match(out.reason, /index\.html/)
      assert.equal(existsSync(marker), false)
    } finally { if (path === undefined) delete process.env.PATH; else process.env.PATH = path }
  })
  check('legacy command-only wrappers keep their current matching behavior', () => {
    const f = fixture('legacy commands')
    const reminder = cli('ghpr-remind.mjs', { cwd: f.root, tool_name: 'Read', tool_input: { command: 'gh pr merge' } })
    assert.equal(reminder.status, 0, reminder.stderr)
    assert.ok(JSON.parse(reminder.stdout).hookSpecificOutput.additionalContext)
    for (const script of ['ghpr-remind.mjs', 'merge-gate.mjs']) {
      const r = cli(script, { cwd: f.root, tool_name: 'Bash', tool_input: { cmd: 'gh pr merge 12' } })
      assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, '')
    }
  })
  check('Claude forwarding preserves raw payload, process cwd, streams, and status only for Claude', () => {
    const f = fixture('forwarding'), install = join(work, 'fake install'), config = join(work, 'fake config')
    mkdirSync(join(install, 'scripts'), { recursive: true }); mkdirSync(join(config, 'plugins'), { recursive: true })
    writeFileSync(join(f.kb, 'index.html'), '<!doctype html>\n<!-- ddd-gen v999.99.99 -->\nKEEP')
    writeFileSync(join(install, 'scripts/stop-hook.mjs'), `import { readFileSync } from 'node:fs';\nconst raw=readFileSync(0,'utf8');\nprocess.stdout.write(JSON.stringify({raw,cwd:process.cwd(),forwarded:process.env.DDD_HOOK_FORWARDED})+'\\nRAW TAIL\\n');\nprocess.stderr.write('raw stderr\\n');\nprocess.exitCode=7;\n`)
    const name = JSON.parse(readFileSync(join(repo, '.claude-plugin/plugin.json'), 'utf8')).name
    writeFileSync(join(config, 'plugins/installed_plugins.json'), JSON.stringify({ plugins: {
      [name + '@test']: [{ projectPath: f.root, installPath: install, version: '999.99.99' }],
    } }))
    const raw = '{\n "cwd": ' + JSON.stringify(f.root) + ', "future_unknown": { "keep": [1, 2] }\n}\n'
    const expected = JSON.stringify({ raw, cwd: work, forwarded: '999.99.99' }) + '\nRAW TAIL\n'
    const before = snapshot(f.kb)
    for (const runtime of [undefined, 'claude', 'codex', 'pi', 'unknown-runtime']) {
      const selected = { ...env, CLAUDE_CONFIG_DIR: config }
      if (runtime !== undefined) selected.DDD_RUNTIME = runtime
      const r = cli('stop-hook.mjs', raw, { env: selected })
      if (runtime === undefined || runtime === 'claude') {
        assert.equal(r.status, 7); assert.equal(r.stdout, expected); assert.equal(r.stderr, 'raw stderr\n')
      } else {
        assert.equal(r.status, 0, r.stderr); assert.doesNotMatch(r.stdout + r.stderr, /RAW TAIL|raw stderr|future_unknown/)
        assert.ok(JSON.parse(r.stdout).systemMessage)
      }
      assert.deepEqual(snapshot(f.kb), before)
    }
    const previousConfig = process.env.CLAUDE_CONFIG_DIR
    try {
      process.env.CLAUDE_CONFIG_DIR = config
      const neutral = core(request(f.root))
      assert.equal(neutral.kind, 'none'); assert.ok(neutral.notice)
    } finally {
      if (previousConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR
      else process.env.CLAUDE_CONFIG_DIR = previousConfig
    }
    assert.deepEqual(snapshot(f.kb), before)
  })
  check('normalization keeps Claude context precedence and Codex tool cwd explicit', () => {
    const a = join(work, 'a'), b = join(work, 'b'), c = join(work, 'c')
    const payload = { cwd: a, tool_name: 'exec_command', tool_input: { cmd: 'echo ok', workdir: '../b' } }
    assert.equal(normalizeHook(payload, { event: 'pre-tool', runtime: 'codex', cwd: c, env: { DDD_PROJECT_DIR: c } }).cwd, b)
    const legacy = normalizeHook(payload, { event: 'PreToolUse', runtime: 'claude', cwd: c, env: { DDD_PROJECT_DIR: c } })
    assert.equal(legacy.cwd, c); assert.equal(legacy.tool.kind, 'other')
    assert.equal(normalizeHook(payload, { event: 'stop', runtime: 'codex', cwd: c, env: {} }).cwd, a)
  })
  console.log(`Hook core: ${checks} checks passed`)
} finally { rmSync(work, { recursive: true, force: true }) }
