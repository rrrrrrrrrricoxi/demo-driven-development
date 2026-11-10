#!/usr/bin/env node
// 隔离项目与安装路径(含空格/引号),验 init 配置保留、双运行时和暂存区边界。
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = mkdtempSync(join(tmpdir(), 'ddd-codex-init-'))
const PLUGIN = join(WORK, "portable plugin's path $literal")
const HOME = join(WORK, 'isolated home')
mkdirSync(HOME)
for (const dir of ['scripts', 'templates', '.claude-plugin', '.codex-plugin']) {
  if (existsSync(join(REPO, dir))) cpSync(join(REPO, dir), join(PLUGIN, dir), { recursive: true })
}
const env = { ...process.env, HOME, CODEX_HOME: join(HOME, '.codex'), CLAUDE_PROJECT_DIR: '' }
let checks = 0
const check = (fn) => { fn(); checks++ }
const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
function write(root, rel, text) {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), text)
}
function fixture(name) {
  const root = join(WORK, name)
  mkdirSync(root)
  return root
}
function init(root, args = [], success = true, plugin = PLUGIN) {
  const result = spawnSync(process.execPath, [join(plugin, 'scripts/init.mjs'), ...args, '--dir', root, '--lang', 'en', '--port', '19876'], { env, encoding: 'utf8' })
  assert.equal(result.status === 0, success, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
  return result.stdout + result.stderr
}
function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}
function repository(root) {
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.name', 'DDD fixture')
  git(root, 'config', 'user.email', 'ddd-fixture@example.invalid')
  write(root, 'README.md', 'fixture\n')
  git(root, 'add', '--', 'README.md')
  git(root, 'commit', '-qm', 'fixture')
}
function snapshot(root) {
  const found = {}
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue
      const rel = prefix + entry.name
      if (entry.isDirectory()) walk(join(dir, entry.name), rel + '/')
      else found[rel] = read(root, rel)
    }
  }
  walk(root)
  return found
}

try {
  const root = fixture("codex project's path")
  const agents = '# Existing project rules\n\nPreserve `literal` text and private rules.\n'
  const claude = '# Existing Claude rules\n'
  const legacy = JSON.stringify({ custom: 7, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node claude-stop-hook.mjs' }] }] } }, null, 4)
  const config = '# keep comments\nmodel = "example"\nnotes = """\n[hooks]\n[features]\nhooks = false\n"""\n[features] # keep this\nexperimental = true\n[other]\nliteral = "features.hooks"\n'
  const userHooks = { description: 'Keep description', custom: { a: [1, 2] }, hooks: { Stop: [{ customGroup: true, hooks: [{ type: 'command', command: 'echo user-hook', customHandler: 3 }] }] } }
  write(root, 'AGENTS.md', agents)
  write(root, 'CLAUDE.md', claude)
  write(root, '.claude/settings.json', legacy)
  write(root, '.codex/config.toml', config)
  write(root, '.codex/hooks.json', JSON.stringify(userHooks))
  write(root, '.codex/metadata/demo.html', '<html><title>metadata</title></html>')
  write(root, '.agents/cache/demo.html', '<html><title>metadata</title></html>')
  const scan = init(root, ['scan', '--runtime', 'codex'])
  check(() => assert.match(scan, /"runtime": "codex"/))
  check(() => assert.match(scan, /"scenario": "greenfield"/))
  const beforePlan = snapshot(root)
  const plan = init(root, ['plan', '--runtime', 'codex', '--brand', 'TEST'])
  check(() => assert.deepEqual(snapshot(root), beforePlan))
  check(() => assert.match(plan, /add 3 DDD handler/))
  check(() => assert.doesNotMatch(plan, /CLAUDE.md:|settings.json:/))
  const applied = init(root, ['apply', '--runtime', 'codex', '--brand', 'TEST', '--yes'])
  check(() => assert.match(applied, /\/hooks to review and trust/))
  check(() => assert.equal(read(root, 'CLAUDE.md'), claude))
  check(() => assert.equal(read(root, '.claude/settings.json'), legacy))
  check(() => assert.ok(read(root, 'AGENTS.md').startsWith(agents)))
  check(() => assert.equal(read(root, '.codex/config.toml').replace('hooks = true\n', ''), config))
  const hooks = JSON.parse(read(root, '.codex/hooks.json'))
  check(() => assert.deepEqual(hooks.hooks.Stop[0], userHooks.hooks.Stop[0]))
  check(() => assert.deepEqual(hooks.custom, userHooks.custom))
  check(() => assert.equal(hooks.description, userHooks.description))
  check(() => assert.equal(hooks.hooks.Stop.length, 2))
  check(() => assert.equal(hooks.hooks.PreToolUse[0].matcher, '^(Bash|Read)$'))
  check(() => assert.equal(hooks.hooks.PostToolUse[0].matcher, '^Bash$'))
  // 真实 shell 执行生成的命令,同时检验安装路径的引号与 $ 没被展开。
  for (const event of ['Stop', 'PreToolUse', 'PostToolUse']) {
    const group = hooks.hooks[event].at(-1)
    const result = spawnSync('/bin/sh', ['-c', group.hooks[0].command], {
      cwd: root, env, encoding: 'utf8', input: JSON.stringify({ cwd: root, hook_event_name: event, tool_name: 'Bash', tool_input: { command: 'true' } }),
    })
    check(() => assert.equal(result.status, 0, `${event}: ${result.stderr}`))
  }
  const once = snapshot(root)
  init(root, ['apply', '--runtime', 'codex', '--yes'])
  check(() => assert.deepEqual(snapshot(root), once))

  const movedPlugin = join(WORK, "updated portable plugin's path")
  cpSync(PLUGIN, movedPlugin, { recursive: true })
  const reEnroll = init(root, ['apply', '--runtime', 'codex', '--yes'], true, movedPlugin)
  check(() => assert.match(reEnroll, /replaced 3 old-install handler/))
  const movedHooks = JSON.parse(read(root, '.codex/hooks.json'))
  check(() => assert.equal(movedHooks.hooks.Stop.length, 2))
  check(() => assert.deepEqual(movedHooks.hooks.Stop[0], userHooks.hooks.Stop[0]))
  for (const event of ['Stop', 'PreToolUse', 'PostToolUse']) {
    check(() => assert.equal(movedHooks.hooks[event].at(-1).hooks.length, 1))
    check(() => assert.ok(movedHooks.hooks[event].at(-1).hooks[0].command.includes('updated portable plugin')))
  }
  const movedOnce = snapshot(root)
  init(root, ['apply', '--runtime', 'codex', '--yes'], true, movedPlugin)
  check(() => assert.deepEqual(snapshot(root), movedOnce))

  // 项目接入改为原生 plugin:只去掉 init 自己的组,用户 hooks 与 TOML 一字不动。
  write(root, '.codex/config.toml', read(root, '.codex/config.toml') + '\n[hooks]\ncustom = "preserve inline TOML during plugin transition"\n')
  const transitionConfig = read(root, '.codex/config.toml')
  const transition = init(root, ['apply', '--runtime', 'codex', '--codex-hooks', 'plugin', '--yes'], true, movedPlugin)
  check(() => assert.match(transition, /remove 3 init-generated project handler/))
  const pluginHooks = JSON.parse(read(root, '.codex/hooks.json'))
  check(() => assert.deepEqual(pluginHooks.hooks.Stop, userHooks.hooks.Stop))
  check(() => assert.deepEqual(pluginHooks.hooks.PreToolUse, []))
  check(() => assert.deepEqual(pluginHooks.hooks.PostToolUse, []))
  check(() => assert.deepEqual(pluginHooks.custom, userHooks.custom))
  check(() => assert.equal(read(root, '.codex/config.toml'), transitionConfig))
  const transitionOnce = snapshot(root)
  init(root, ['apply', '--runtime', 'codex', '--codex-hooks', 'plugin', '--yes'], true, movedPlugin)
  check(() => assert.deepEqual(snapshot(root), transitionOnce))

  const both = fixture('both runtimes')
  repository(both)
  init(both, ['apply', '--runtime', 'both', '--brand', 'BOTH', '--yes'])
  check(() => assert.ok(existsSync(join(both, 'CLAUDE.md')) && existsSync(join(both, 'AGENTS.md'))))
  check(() => assert.ok(JSON.parse(read(both, '.claude/settings.json')).permissions.deny.length === 4))
  check(() => assert.ok(existsSync(join(both, '.codex/hooks.json'))))
  check(() => assert.equal(git(both, 'rev-list', '--count', 'HEAD').trim(), '1'))
  check(() => assert.equal(git(both, 'diff', '--cached'), ''))

  const native = fixture('native plugin')
  const inline = 'model = "preserve"\n[hooks]\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "echo existing"\n'
  write(native, '.codex/config.toml', inline)
  init(native, ['apply', '--runtime', 'codex', '--codex-hooks', 'plugin', '--brand', 'NATIVE', '--yes'])
  check(() => assert.equal(read(native, '.codex/config.toml'), inline))
  check(() => assert.equal(existsSync(join(native, '.codex/hooks.json')), false))
  check(() => assert.ok(existsSync(join(native, 'AGENTS.md'))))

  for (const [name, content, message] of [
    ['inline conflict', inline, /already defines inline hooks/],
    ['inline features', 'features = { experimental = true }\n', /Cannot safely add/],
    ['dotted features', 'features.experimental = true\n', /Cannot safely add/],
    ['features hooks table', '[features.hooks]\ncustom = true\n', /Cannot safely add/],
    ['features array', '[[features]]\ncustom = true\n', /Cannot safely add/],
  ]) {
    const conflict = fixture(name)
    write(conflict, '.codex/config.toml', content)
    const before = snapshot(conflict)
    const failed = init(conflict, ['apply', '--runtime', 'codex', '--brand', 'FAIL', '--yes'], false)
    check(() => assert.match(failed, message))
    check(() => assert.deepEqual(snapshot(conflict), before))
  }
  for (const content of ['{"hooks":{"Stop":{}}}', '{broken', '[]', '{"hooks":[]}']) {
    const bad = fixture(`bad hooks ${checks}`)
    write(bad, '.codex/hooks.json', content)
    const before = snapshot(bad)
    init(bad, ['apply', '--runtime', 'codex', '--brand', 'FAIL', '--yes'], false)
    check(() => assert.deepEqual(snapshot(bad), before))
  }
  for (const config of ['[features]\nhooks = false # preserve\n', 'features.hooks = false\nmodel = "preserve"\n', '["features"]\n"hooks" = true\n', '[features]\ncodex_hooks = true\nhooks = false\n']) {
    const disabled = fixture(`feature switch ${checks}`)
    write(disabled, '.codex/config.toml', config)
    const output = init(disabled, ['apply', '--runtime', 'codex', '--brand', 'FLAG', '--yes'])
    check(() => assert.equal(read(disabled, '.codex/config.toml'), config))
    if (config.includes('false')) check(() => assert.match(output, /Preserved hooks = false/))
  }

  const clean = fixture('claude compatibility')
  repository(clean)
  init(clean, ['apply', '--brand', 'CLAUDE', '--yes'])
  check(() => assert.equal(git(clean, 'rev-list', '--count', 'HEAD').trim(), '2'))
  check(() => assert.equal(existsSync(join(clean, 'AGENTS.md')), false))
  check(() => assert.equal(existsSync(join(clean, '.codex')), false))
  const cleanOnce = snapshot(clean)
  init(clean, ['apply', '--yes'])
  check(() => assert.deepEqual(snapshot(clean), cleanOnce))
  check(() => assert.equal(git(clean, 'rev-list', '--count', 'HEAD').trim(), '2'))

  const noCommit = fixture('claude no commit')
  repository(noCommit)
  init(noCommit, ['apply', '--brand', 'NOCOMMIT', '--no-commit', '--yes'])
  check(() => assert.equal(git(noCommit, 'rev-list', '--count', 'HEAD').trim(), '1'))
  check(() => assert.equal(git(noCommit, 'diff', '--cached'), ''))

  const dirty = fixture('dirty instructions and settings')
  repository(dirty)
  write(dirty, 'CLAUDE.md', '# tracked guidance\n')
  write(dirty, '.claude/settings.json', JSON.stringify({ model: 'keep', permissions: { allow: ['custom'] } }))
  git(dirty, 'add', '--', 'CLAUDE.md', '.claude/settings.json')
  git(dirty, 'commit', '-qm', 'existing instructions')
  write(dirty, 'CLAUDE.md', '# tracked guidance\nUser staged edit.\n')
  git(dirty, 'add', '--', 'CLAUDE.md')
  write(dirty, 'CLAUDE.md', read(dirty, 'CLAUDE.md') + 'User unstaged edit.\n')
  write(dirty, '.claude/settings.json', JSON.stringify({ model: 'user dirty model', permissions: { allow: ['custom'] }, user: 'preserve' }))
  const index = git(dirty, 'diff', '--cached')
  const dirtyOutput = init(dirty, ['apply', '--brand', 'DIRTY', '--yes'])
  check(() => assert.match(dirtyOutput, /Target already had changes/))
  check(() => assert.equal(git(dirty, 'diff', '--cached'), index))
  check(() => assert.equal(git(dirty, 'rev-list', '--count', 'HEAD').trim(), '2'))
  check(() => assert.ok(read(dirty, 'CLAUDE.md').startsWith('# tracked guidance\nUser staged edit.\nUser unstaged edit.\n')))
  check(() => assert.equal(JSON.parse(read(dirty, '.claude/settings.json')).model, 'user dirty model'))
  check(() => assert.deepEqual(JSON.parse(read(dirty, '.claude/settings.json')).permissions.allow, ['custom']))

  const merge = fixture('unstaged tracked demo merge')
  repository(merge)
  init(merge, ['apply', '--brand', 'MERGE', '--runtime', 'codex', '--yes'])
  write(merge, 'draft/demo.html', '<html><title>portable demo</title><body>demo</body></html>')
  git(merge, 'add', '-A')
  git(merge, 'commit', '-qm', 'board and tracked demo')
  write(merge, 'README.md', 'staged unrelated edit\n')
  git(merge, 'add', '--', 'README.md')
  const mergeIndex = git(merge, 'diff', '--cached')
  init(merge, ['apply', '--runtime', 'codex', '--yes'])
  check(() => assert.equal(git(merge, 'diff', '--cached'), mergeIndex))
  check(() => assert.equal(existsSync(join(merge, 'draft/demo.html')), false))
  check(() => assert.equal(existsSync(join(merge, 'app/kanban/demos/demo.html')), true))

  const legacyCodex = fixture('codex legacy untouched')
  write(legacyCodex, 'app/kanban/gen.mjs', '// legacy generator: preserve\n')
  write(legacyCodex, 'CLAUDE.md', claude)
  write(legacyCodex, '.claude/settings.json', legacy)
  init(legacyCodex, ['apply', '--runtime', 'codex', '--brand', 'LEGACY', '--yes'])
  check(() => assert.equal(read(legacyCodex, 'CLAUDE.md'), claude))
  check(() => assert.equal(read(legacyCodex, '.claude/settings.json'), legacy))
  check(() => assert.equal(read(legacyCodex, 'app/kanban/gen.mjs'), '// legacy generator: preserve\n'))
  const ignoredInvalidClaude = fixture('codex ignores invalid Claude JSON')
  write(ignoredInvalidClaude, '.claude/settings.json', '{invalid JSON')
  init(ignoredInvalidClaude, ['apply', '--runtime', 'codex', '--brand', 'IGNORE', '--yes'])
  check(() => assert.equal(read(ignoredInvalidClaude, '.claude/settings.json'), '{invalid JSON'))

  init(root, ['scan', '--runtime', 'invalid'], false)
  init(root, ['plan', '--runtime', 'codex', '--codex-hooks', 'invalid'], false)
  console.log(`codex-init: ${checks} checks passed (isolated fixtures; no runtime installation or trust changes)`)
} finally {
  rmSync(WORK, { recursive: true, force: true })
}
