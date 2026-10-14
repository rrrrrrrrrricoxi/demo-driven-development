// 跨宿主包与发版门的实测:不改真实安装,不联网发版。Codex CLI 若在场,只用本进程的配置覆盖验发现。
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackage, releasePlan } from '../scripts/release.mjs'
import { readPluginVersion } from '../scripts/lib-version.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = mkdtempSync(join(tmpdir(), 'ddd-package-'))
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
  const result = spawnSync('git', ['-c', 'user.name=DDD fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, encoding: 'utf8' })
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
  check('portable version protects generated output from mismatched Claude packaging', () => {
    const root = fixture('canonical')
    const file = join(root, '.claude-plugin/plugin.json'), metadata = read(file)
    metadata.version = '0.0.1'; write(file, metadata)
    assert.equal(readPluginVersion(root), null)
    rmSync(join(root, 'plugin.json'))
    assert.equal(readPluginVersion(root), '0.0.1', 'legacy Claude-only bundles retain version discovery')
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
  const cli = spawnSync('codex', ['--version'], { encoding: 'utf8' })
  if (cli.status === 0) {
    check('installed Codex discovers the native package without installation', () => {
      const result = spawnSync('codex', ['plugin', 'list',
        '-c', 'marketplaces.ddd-validation.source_type="local"',
        '-c', `marketplaces.ddd-validation.source=${JSON.stringify(ROOT)}`,
        '--marketplace', 'demo-driven-development', '--available', '--json'], { cwd: ROOT, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
      const data = JSON.parse(result.stdout), item = data.available.find((plugin) => plugin.name === 'demo-driven-development')
      assert.equal(item.version, readPluginVersion())
      assert.equal(item.source.path, ROOT)
      assert.equal(item.pluginId, 'demo-driven-development@demo-driven-development')
    })
  } else console.log('  · Native Codex discovery skipped: CLI is not installed; package checks still run.')
  console.log(`Codex package: ${passed} groups passed`)
} finally { rmSync(WORK, { recursive: true, force: true }) }
