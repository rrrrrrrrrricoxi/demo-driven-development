// 从临时提交真实导出原生包,再验证无宿主元数据的共享运行时;不安装、不读取真实用户配置。
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkCodexPackage, packageCodex } from '../scripts/package-codex.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = mkdtempSync(join(realpathSync(tmpdir()), 'ddd-native-portable-'))
const SOURCE = join(WORK, 'source'), HOME = join(WORK, 'isolated-home')
const env = { ...process.env, HOME, CODEX_HOME: join(HOME, '.codex'), CLAUDE_CONFIG_DIR: join(HOME, '.claude') }
for (const key of ['DDD_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'DDD_RUNTIME', 'DDD_HOOK_FORWARDED']) delete env[key]
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
const git = (cwd, args) => {
  const result = spawnSync('git', ['-c', 'user.name=DDD fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
function snapshot(root) {
  const files = {}
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue
      const rel = prefix + entry.name
      if (entry.isDirectory()) walk(join(dir, entry.name), rel + '/')
      else files[rel] = readFileSync(join(root, rel))
    }
  }
  walk(root)
  return files
}
function run(runtime, project, script, args, success = true) {
  const result = spawnSync(process.execPath, [join(runtime, 'scripts', script), ...args], { cwd: project, env, encoding: 'utf8' })
  assert.equal(result.status === 0, success, `${script} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
  return result.stdout + result.stderr
}
async function portable(runtime, name) {
  const project = join(WORK, name), board = join(project, 'app/kanban')
  mkdirSync(project)
  git(project, ['init', '-q', '-b', 'main'])
  writeFileSync(join(project, 'README.md'), 'Isolated portable package fixture\n')
  git(project, ['add', '.']); git(project, ['commit', '-qm', 'fixture'])
  const init = (command, extra = [], success = true) => run(runtime, project, 'init.mjs', [command, '--dir', project, '--lang', 'en', ...extra], success)
  const before = snapshot(project)
  assert.match(init('scan'), /"runtime": "portable"/)
  assert.match(init('plan', ['--brand', 'PORTABLE']), /skip host hooks\/skills\/config/)
  assert.deepEqual(snapshot(project), before)
  assert.match(init('apply', ['--brand', 'PORTABLE', '--yes']), /shared audit smoke passed/)
  const cli = (...args) => run(runtime, project, 'ddd.mjs', [...args, '--dir', board])
  const made = JSON.parse(cli('card', 'new', 'decision', '--title', 'Packaged card', '--json'))
  cli('card', 'set', made.id, 'title', 'Updated packaged card')
  assert.equal(JSON.parse(cli('card', 'show', made.id, '--json')).title, 'Updated packaged card')
  run(runtime, project, 'gen.mjs', ['--dir', board])
  const version = json(join(runtime, 'package.json')).version
  const { readStamp, readPluginVersion } = await import(pathToFileURL(join(runtime, 'scripts/lib-version.mjs')).href)
  const { runHook } = await import(pathToFileURL(join(runtime, 'scripts/hook-core.mjs')).href)
  assert.equal(readPluginVersion(), version)
  assert.equal(readStamp(join(board, 'index.html')), version)
  assert.match(readFileSync(join(board, 'index.html'), 'utf8'), /Updated packaged card/)
  const generated = snapshot(project)
  assert.deepEqual(JSON.parse(cli('audit', '--json')).block, [])
  assert.equal(runHook({ event: 'settle', cwd: project }).kind, 'none')
  assert.deepEqual(snapshot(project), generated, 'audit must remain read-only')
  init('apply', ['--runtime', 'portable', '--yes'])
  assert.deepEqual(snapshot(project), generated, 'portable init must be idempotent')
  for (const path of ['CLAUDE.md', 'AGENTS.md', '.claude', '.codex', '.agents']) assert.equal(existsSync(join(project, path)), false, path)
  assert.equal(git(project, ['rev-list', '--count', 'HEAD']), '1')
  assert.equal(git(project, ['diff', '--cached']), '')
  // 更新的产物必须同时挡住直接生成与 init;失败不得改写板或留下锁。
  const index = join(board, 'index.html')
  writeFileSync(index, readFileSync(index, 'utf8').replace(`<!-- ddd-gen v${version} -->`, '<!-- ddd-gen v9999.0.0 -->'))
  assert.equal(readStamp(index), '9999.0.0')
  const newer = snapshot(project)
  const settlement = runHook({ event: 'settle', cwd: project }, { regenerate: true })
  assert.equal(settlement.kind, 'none')
  assert.match(settlement.notice, /9999\.0\.0/)
  assert.deepEqual(snapshot(project), newer, 'shared settlement must preserve newer output even with explicit regeneration')
  assert.match(run(runtime, project, 'gen.mjs', ['--dir', board], false), /refusing to overwrite newer output/)
  assert.deepEqual(snapshot(project), newer)
  assert.match(init('apply', ['--yes'], false), /newer|更新/)
  assert.deepEqual(snapshot(project), newer)
  console.log(`  ✓ ${name}: portable init, card mutation, generation, read-only audit, version stamp and downgrade protection`)
}

try {
  mkdirSync(SOURCE); mkdirSync(HOME)
  for (const path of ['plugin.json', 'package.json', '.claude-plugin', '.codex-plugin', '.agents', 'hooks', 'skills', 'scripts', 'templates', 'pi']) cpSync(join(ROOT, path), join(SOURCE, path), { recursive: true })
  git(SOURCE, ['init', '-q', '-b', 'main']); git(SOURCE, ['add', '.']); git(SOURCE, ['commit', '-qm', 'runtime snapshot'])
  const commit = git(SOURCE, ['rev-parse', 'HEAD']), native = join(WORK, 'native')
  packageCodex({ source: SOURCE, ref: commit, out: native })
  checkCodexPackage({ source: SOURCE, dir: native, expectCommit: commit })
  for (const path of ['plugin.json', '.claude-plugin']) assert.equal(existsSync(join(native, path)), false, path)
  const artifact = snapshot(native)
  await portable(native, 'exported-native-package')
  assert.deepEqual(snapshot(native), artifact, 'runtime operations must preserve exported package bytes')
  checkCodexPackage({ source: SOURCE, dir: native, expectCommit: commit })

  const core = join(WORK, 'core')
  cpSync(SOURCE, core, { recursive: true })
  for (const path of ['.git', 'plugin.json', '.claude-plugin', '.codex-plugin', '.claude', '.codex', '.agents', 'hooks', 'pi', 'skills']) rmSync(join(core, path), { recursive: true, force: true })
  for (const path of ['stop-hook.mjs', 'codex-hook.mjs', 'claude-forward.mjs']) rmSync(join(core, 'scripts', path))
  const coreBefore = snapshot(core)
  await portable(core, 'host-stripped-core')
  assert.deepEqual(snapshot(core), coreBefore)
  assert.deepEqual(readdirSync(HOME), [], 'no user configuration or installs')
  console.log('Native portable runtime: 2 isolated runtime variants passed')
} finally { rmSync(WORK, { recursive: true, force: true }) }
