// Codex 适配契约:真进程 + 临时 Git 仓,不读写用户 home 或任何宿主项目。
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from '../scripts/lib-detect.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const work = mkdtempSync(join(tmpdir(), 'ddd-codex-hooks-'))
const env = { ...process.env, CLAUDE_CONFIG_DIR: join(work, 'no-installs') }
delete env.CLAUDE_PROJECT_DIR
delete env.DDD_PROJECT_DIR
delete env.DDD_RUNTIME
delete env.DDD_HOOK_FORWARDED
const run = (script, args = [], input = {}, options = {}) => spawnSync(process.execPath, [join(repo, 'scripts', script), ...args], {
  cwd: work, env, encoding: 'utf8', input: typeof input === 'string' ? input : JSON.stringify(input), ...options,
})
const hook = (event, payload, options = {}) => run('codex-hook.mjs', [event], payload, options)
const json = (r) => { assert.equal(r.status, 0, r.stderr); return r.stdout ? JSON.parse(r.stdout) : {} }
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env,
  stdio: ['ignore', 'pipe', 'pipe'] })
const fill = (text) => text.replaceAll('{{BRAND}}', 'Hook test').replaceAll('{{GH_REPO}}', '')
  .replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '').replaceAll('{{DEMO_BASE}}', '')
function fixture(name) {
  const root = join(work, name), kb = join(root, 'app', 'kanban')
  mkdirSync(join(kb, 'demos'), { recursive: true })
  mkdirSync(join(kb, 'shots'), { recursive: true })
  mkdirSync(join(root, 'src', 'nested'), { recursive: true })
  writeFileSync(join(kb, 'kanban.config.json'), fill(readFileSync(join(repo, 'templates', 'kanban.config.json'), 'utf8')))
  for (const file of readdirSync(join(repo, 'templates', 'manifests'))) {
    writeFileSync(join(kb, file), fill(readFileSync(join(repo, 'templates', 'manifests', file), 'utf8')))
  }
  git(root, 'init', '-q', '-b', 'main')
  return { root, kb }
}
function commit(root) {
  git(root, 'add', '.')
  git(root, '-c', 'user.name=DDD fixture', '-c', 'user.email=ddd-fixture@example.invalid', 'commit', '-qm', 'fixture')
}
let checks = 0
const check = (name, fn) => { fn(); checks++; console.log(`✓ ${name}`) }
try {
  const f = fixture('project with spaces')
  check('CLI discovers project root, nested cwd, and board cwd without Claude environment', () => {
    for (const cwd of [f.root, join(f.root, 'src', 'nested'), f.kb]) {
      const r = run('ddd.mjs', ['card', 'list', '--json'], {}, { cwd })
      assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), [])
    }
    assert.equal(run('ddd.mjs', ['card', 'list', '--json', '--dir', f.kb]).status, 0)
  })
  check('hook event cwd discovers a project independently of hook process cwd', () => {
    const r = hook('stop', { cwd: join(f.root, 'src', 'nested') })
    assert.equal(r.status, 0, r.stderr)
    assert.match(readFileSync(join(f.kb, 'index.html'), 'utf8').slice(0, 100), /ddd-gen v/)
  })
  const empty = join(work, 'non DDD'); mkdirSync(empty)
  check('non-DDD stays silent, even with stale Claude environment pointing at a board', () => {
    for (const event of ['stop', 'pre-tool', 'post-tool']) {
      const r = hook(event, { cwd: empty, tool_name: 'Bash', tool_input: { command: 'gh pr merge' } },
        { env: { ...env, CLAUDE_PROJECT_DIR: f.root } })
      assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, ''); assert.equal(r.stderr, '')
    }
    for (const input of ['not JSON', 'null', '[]']) assert.equal(hook('stop', input).status, 0)
  })
  check('DDD explicit project context takes precedence in shared discovery', () => {
    const previous = process.env.DDD_PROJECT_DIR
    try { process.env.DDD_PROJECT_DIR = f.root; assert.equal(detect({ cwd: empty }), f.kb) }
    finally { if (previous === undefined) delete process.env.DDD_PROJECT_DIR; else process.env.DDD_PROJECT_DIR = previous }
  })
  check('PR context matches Claude for canonical Bash and raw cmd aliases', () => {
    const payload = { cwd: f.root, tool_name: 'Bash', tool_input: { command: 'gh pr merge' } }
    const direct = json(run('ghpr-remind.mjs', [], payload))
    assert.match(direct.hookSpecificOutput.additionalContext, /settle/)
    assert.deepEqual(json(hook('post-tool', payload)), direct)
    assert.deepEqual(json(hook('PostToolUse', { ...payload, tool_name: 'exec_command', tool_input: { cmd: 'gh pr merge' } })), direct)
  })
  check('orphan block and repeated Stop warning preserve shared audit behavior', () => {
    writeFileSync(join(f.kb, 'demos', 'orphan.html'), '<!doctype html><html><body>orphan</body></html>')
    const payload = { cwd: f.root }
    const direct = json(run('stop-hook.mjs', [], payload))
    assert.equal(direct.decision, 'block'); assert.match(direct.reason, /orphan\.html/)
    assert.deepEqual(json(hook('Stop', payload)), direct)
    const repeated = json(hook('stop', { ...payload, stop_hook_active: true }))
    assert.equal(repeated.decision, undefined); assert.match(repeated.systemMessage, /orphan\.html/)
    rmSync(join(f.kb, 'demos', 'orphan.html'))
  })
  check('generator failure continues once and repeated Stop downgrades to a warning', () => {
    const path = join(f.kb, 'manifest.json'), original = readFileSync(path)
    try {
      writeFileSync(path, '{')
      const later = new Date(Date.now() + 5000); utimesSync(path, later, later)
      const first = hook('stop', { cwd: f.root })
      assert.equal(first.status, 2); assert.ok(first.stderr.length)
      const repeated = json(hook('stop', { cwd: f.root, stop_hook_active: true }))
      assert.equal(repeated.decision, undefined); assert.ok(repeated.systemMessage.length)
    } finally { writeFileSync(path, original) }
    assert.equal(hook('stop', { cwd: f.root }).status, 0)
  })
  check('init lock leaves outputs untouched', () => {
    const path = join(f.kb, 'index.html'), original = readFileSync(path)
    writeFileSync(join(f.kb, '.init-lock'), 'fixture')
    try { assert.equal(hook('stop', { cwd: f.root }).stdout, ''); assert.deepEqual(readFileSync(path), original) }
    finally { rmSync(join(f.kb, '.init-lock')) }
  })
  commit(f.root)
  check('linked worktree resolves its own board from a nested cwd', () => {
    const tree = join(work, 'linked worktree')
    git(f.root, 'worktree', 'add', '-qb', 'linked', tree, 'main')
    mkdirSync(join(tree, 'nested'))
    const r = run('ddd.mjs', ['card', 'list', '--json'], {}, { cwd: join(tree, 'nested') })
    assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), [])
    git(f.root, 'worktree', 'remove', '--force', tree)
  })
  check('feature branch and detached HEAD skip automatic generation; merge is denied', () => {
    git(f.root, 'checkout', '-qb', 'feature')
    const path = join(f.kb, 'manifest.json')
    writeFileSync(path, `${readFileSync(path, 'utf8')}\n`); commit(f.root)
    const later = new Date(Date.now() + 5000); utimesSync(path, later, later)
    const index = readFileSync(join(f.kb, 'index.html'))
    assert.ok(json(hook('stop', { cwd: f.root })).systemMessage)
    assert.deepEqual(readFileSync(join(f.kb, 'index.html')), index)
    const denied = json(hook('pre-tool', { cwd: f.root, tool_name: 'exec_command', tool_input: { cmd: 'gh pr merge' } }))
    assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny')
    assert.equal(json(hook('pre-tool', { cwd: f.root, tool_name: 'Bash', tool_input: { command: 'git status' } })).hookSpecificOutput, undefined)
    git(f.root, 'checkout', '--detach', '-q')
    assert.ok(json(hook('stop', { cwd: f.root })).systemMessage)
    assert.deepEqual(readFileSync(join(f.kb, 'index.html')), index)
    git(f.root, 'checkout', '-q', 'main')
  })
  check('literal generated reads deny; targeted search, scripts, writes, and source reads pass', () => {
    for (const command of ["cat 'app/kanban/index.html'", 'head app/kanban/shots.html', "sed -n '1,20p' app/kanban/refs/test.html", 'cat app/kanban/parts/*.html', `cat '${join(f.kb, 'index.html')}'`]) {
      const out = json(hook('pre-tool', { cwd: f.root, tool_name: 'Bash', tool_input: { command } }))
      assert.equal(out.hookSpecificOutput.permissionDecision, 'deny', command)
      assert.ok(out.hookSpecificOutput.permissionDecisionReason)
    }
    const structured = json(hook('pre-tool', { cwd: f.root, tool_name: 'Read', tool_input: { file_path: join(f.kb, 'index.html') } }))
    assert.equal(structured.hookSpecificOutput.permissionDecision, 'deny')
    for (const command of ['rg -n marker app/kanban/index.html', 'node scripts/gen.mjs', 'cat app/kanban/manifest.json', 'cat > app/kanban/index.html', 'echo cat app/kanban/index.html']) {
      const r = hook('pre-tool', { cwd: f.root, tool_name: 'Bash', tool_input: { command } })
      assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, '', command)
    }
  })
  check('tool working-directory overrides protect the executed project, not the session project', () => {
    for (const key of ['workdir', 'cwd']) {
      const denied = json(hook('pre-tool', { cwd: empty, tool_name: 'exec_command',
        tool_input: { cmd: 'cat app/kanban/index.html', [key]: f.root } }))
      assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny')
      const unrelated = hook('pre-tool', { cwd: f.root, tool_name: 'Bash',
        tool_input: { command: 'cat app/kanban/index.html', [key]: empty } })
      assert.equal(unrelated.stdout, '', 'do not apply one project\'s board rules to another directory')
    }
    const relative = json(hook('pre-tool', { cwd: empty, tool_name: 'Bash',
      tool_input: { command: 'cat app/kanban/index.html', workdir: '../project with spaces' } }))
    assert.equal(relative.hookSpecificOutput.permissionDecision, 'deny')
    const reminder = json(hook('post-tool', { cwd: empty, tool_name: 'Bash',
      tool_input: { command: 'gh pr merge', workdir: f.root } }))
    assert.match(reminder.hookSpecificOutput.additionalContext, /settle/)
    const stop = hook('stop', { cwd: empty, tool_input: { workdir: f.root } })
    assert.equal(stop.stdout, '', 'Stop always observes the session project')
  })
  check('merge denial follows a linked feature worktree selected by workdir', () => {
    const target = fixture('merge override project')
    assert.equal(hook('stop', { cwd: target.root }).status, 0)
    commit(target.root)
    git(target.root, 'checkout', '-qb', 'feature')
    writeFileSync(join(target.kb, 'manifest.json'), readFileSync(join(target.kb, 'manifest.json'), 'utf8') + '\n')
    commit(target.root)
    const mainView = join(work, 'merge main view')
    git(target.root, 'worktree', 'add', '-q', mainView, 'main')
    for (const cwd of [empty, mainView]) {
      const denied = json(hook('pre-tool', { cwd, tool_name: 'Bash',
        tool_input: { command: 'gh pr merge', workdir: target.root } }))
      assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny')
    }
  })
  check('Codex newer-output veto never forwards to a Claude installation', () => {
    const fake = join(work, 'fake Claude'), cfg = join(work, 'fake config')
    mkdirSync(join(fake, 'scripts'), { recursive: true }); mkdirSync(join(cfg, 'plugins'), { recursive: true })
    writeFileSync(join(fake, 'scripts', 'stop-hook.mjs'), 'console.log(JSON.stringify({systemMessage:"CLAUDE FORWARDED"}))')
    writeFileSync(join(cfg, 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: {
      'demo-driven-development@test': [{ projectPath: f.root, installPath: fake, version: '999.99.99' }],
    } }))
    const path = join(f.kb, 'index.html')
    writeFileSync(path, '<!doctype html>\n<!-- ddd-gen v999.99.99 -->\nKEEP')
    const before = readFileSync(path)
    const out = json(hook('stop', { cwd: f.root }, { env: { ...env, CLAUDE_CONFIG_DIR: cfg } }))
    assert.ok(out.systemMessage); assert.doesNotMatch(out.systemMessage, /CLAUDE FORWARDED/)
    assert.deepEqual(readFileSync(path), before)
  })
  console.log(`Codex hooks: ${checks} checks passed`)
} finally { rmSync(work, { recursive: true, force: true }) }
