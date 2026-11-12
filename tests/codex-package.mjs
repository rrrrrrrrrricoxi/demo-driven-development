// 跨宿主包与发版门的实测:不改真实安装,不联网发版。Codex CLI 若在场,用独立配置与 commit 导出包验发现。
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackage, releasePlan } from '../scripts/release.mjs'
import { readPluginVersion } from '../scripts/lib-version.mjs'
import { packageCodex } from '../scripts/package-codex.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = mkdtempSync(join(realpathSync(tmpdir()), 'ddd-package-'))
let passed = 0
function check(name, fn) { fn(); passed++; console.log(`  ✓ ${name}`) }
const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n') }

function fixture(name) {
  const root = join(WORK, name)
  mkdirSync(root)
  for (const path of ['plugin.json', 'package.json', '.claude-plugin', '.codex-plugin', '.agents', 'hooks', 'skills', 'scripts']) {
    cpSync(join(ROOT, path), join(root, path), { recursive: true })
  }
  return root
}

function git(root, args) {
  const result = spawnSync('git', ['-c', 'user.name=DDD fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

try {
  check('portable, Claude, Codex, and package versions agree', () => {
    const info = validatePackage(ROOT)
    assert.equal(info.version, readPluginVersion())
    assert.deepEqual(info.skills.sort(), ['ddd-workflow', 'kanban-init'])
  })
  check('Codex version disagreement prevents release', () => {
    const root = fixture('mismatch')
    const file = join(root, '.codex-plugin/plugin.json'), metadata = read(file)
    metadata.version = '0.0.1'; write(file, metadata)
    assert.throws(() => validatePackage(root), /mismatch/)
  })
  check('runtime package identity ignores optional host manifests', () => {
    const root = fixture('canonical')
    const expected = read(join(root, 'package.json')).version
    for (const path of ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
      const file = join(root, path), metadata = read(file)
      metadata.version = '0.0.1'; write(file, metadata)
    }
    assert.equal(readPluginVersion(root), expected)
    assert.throws(() => validatePackage(root), /mismatch/)
    for (const path of ['plugin.json', '.claude-plugin', '.codex-plugin']) rmSync(join(root, path), { recursive: true })
    assert.equal(readPluginVersion(root), expected, 'runtime needs no host metadata')
    rmSync(join(root, 'package.json'))
    write(join(root, '.claude-plugin/plugin.json'), { name: 'demo-driven-development', version: expected })
    const diagnostics = []
    assert.equal(readPluginVersion(root, { onDiagnostic: (message) => diagnostics.push(message) }), null, 'host metadata never supplies a missing runtime identity')
    assert.match(diagnostics.join('\n'), /package\.json.*Rebuild or reinstall/)
  })
  check('missing bundled hook handler is rejected', () => {
    const root = fixture('missing-handler')
    rmSync(join(root, 'scripts/codex-hook.mjs'))
    assert.throws(() => validatePackage(root), /resource/)
  })
  check('hook resource traversal is rejected', () => {
    const root = fixture('traversal')
    for (const path of ['plugin.json', '.codex-plugin/plugin.json']) {
      const file = join(root, path), metadata = read(file)
      if (path === 'plugin.json') metadata.extensions['com.openai'].hooks = './../outside.json'
      else metadata.hooks = './../outside.json'
      write(file, metadata)
    }
    assert.throws(() => validatePackage(root), /resource/)
  })
  check('duplicate skill names are rejected', () => {
    const root = fixture('duplicate-skill')
    cpSync(join(root, 'skills/ddd-workflow'), join(root, 'skills/duplicate'), { recursive: true })
    assert.throws(() => validatePackage(root), /duplicate/)
  })
  check('both marketplaces point to the same package', () => {
    const root = fixture('bad-marketplace')
    const file = join(root, '.agents/plugins/marketplace.json'), metadata = read(file)
    metadata.plugins[0].source.path = './elsewhere'; write(file, metadata)
    assert.throws(() => validatePackage(root), /marketplace/)
  })
  check('release planning is read-only and rejects dirty, off-main, and downgraded releases', () => {
    const root = fixture('release')
    git(root, ['init', '-b', 'main']); git(root, ['add', '.']); git(root, ['commit', '-m', 'fixture'])
    const before = git(root, ['rev-parse', 'HEAD'])
    const plan = releasePlan(root)
    assert.equal(plan.head, before); assert.equal(plan.tagExists, false)
    assert.equal(git(root, ['tag', '--list']), '')
    writeFileSync(join(root, 'untracked.txt'), 'keep me')
    assert.throws(() => releasePlan(root), /clean/)
    rmSync(join(root, 'untracked.txt'))
    git(root, ['checkout', '-b', 'feature'])
    assert.throws(() => releasePlan(root), /main only/)
    git(root, ['checkout', 'main']); git(root, ['tag', `${plan.name}--v99.0.0`])
    assert.throws(() => releasePlan(root), /downgrade/)
    assert.equal(git(root, ['rev-parse', 'HEAD']), before)
  })
  check('an existing release tag may only refer to the same commit', () => {
    const root = fixture('existing-tag')
    git(root, ['init', '-b', 'main']); git(root, ['add', '.']); git(root, ['commit', '-m', 'fixture'])
    const { tag } = releasePlan(root)
    git(root, ['tag', tag]); assert.equal(releasePlan(root).tagExists, true)
    writeFileSync(join(root, 'change.txt'), 'change')
    git(root, ['add', 'change.txt']); git(root, ['commit', '-m', 'change'])
    assert.throws(() => releasePlan(root), /another commit/)
  })
  const codexHome = join(WORK, 'codex-home')
  mkdirSync(codexHome)
  // 部分宿主的启动脚本用 HOME 定位自身;只隔离 Codex 状态,保留启动脚本所需的 HOME。
  const env = { ...process.env, CODEX_HOME: codexHome }
  const cli = spawnSync('codex', ['--version'], { cwd: WORK, env, encoding: 'utf8', timeout: 15000 })
  if (cli.error?.code !== 'ENOENT') {
    assert.equal(cli.status, 0, `Codex CLI version check failed: ${cli.error?.message || cli.stderr}`)
    check('installed Codex discovers the native package without installation', () => {
      const source = fixture('native-source')
      git(source, ['init', '-b', 'main']); git(source, ['add', '.']); git(source, ['commit', '-m', 'native discovery fixture'])
      const { name, version } = validatePackage(source)
      const marketplace = 'ddd-package-validation', out = join(WORK, 'native-export')
      packageCodex({ out, source, ref: git(source, ['rev-parse', 'HEAD']), marketplace })
      const result = spawnSync('codex', ['plugin', 'list',
        '-c', 'marketplaces.ddd-validation.source_type="local"',
        '-c', `marketplaces.ddd-validation.source=${JSON.stringify(out)}`,
        '--marketplace', marketplace, '--available', '--json'], { cwd: WORK, env, encoding: 'utf8', timeout: 15000 })
      assert.equal(result.status, 0, `Codex discovery failed: ${result.error?.message || result.stderr}`)
      const data = JSON.parse(result.stdout), item = data.available?.find((plugin) => plugin.pluginId === `${name}@${marketplace}`)
      assert.ok(item, `Codex did not discover the exported package ${name}@${marketplace}:\n${result.stdout}\n${result.stderr}`)
      assert.deepEqual(data.installed, [], 'isolated discovery must not use a real installation')
      assert.equal(item.version, version)
      assert.equal(item.source.path, out)
      assert.equal(item.marketplaceName, marketplace)
      assert.equal(item.installed, false)
    })
  } else console.log('  · Native Codex discovery skipped: CLI is not installed; package checks still run.')
  console.log(`Codex package: ${passed} groups passed`)
} finally { rmSync(WORK, { recursive: true, force: true }) }
