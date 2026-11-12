// 临时 Git 仓库验证原生导出边界;不访问真实 CODEX_HOME、不安装、不联网。
import assert from 'node:assert/strict'
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkCodexPackage, packageCodex, PROVENANCE } from '../scripts/package-codex.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = mkdtempSync(join(realpathSync(tmpdir()), 'ddd-native-package-'))
const SOURCE = join(WORK, 'source')
const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
let passed = 0
function check(name, fn) { fn(); passed++; console.log(`  ✓ ${name}`) }
function git(args) {
  const result = spawnSync('git', ['-c', 'user.name=DDD fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: SOURCE, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
function exported(name, options = {}) {
  const out = join(WORK, name)
  packageCodex({ out, source: SOURCE, ref: BASE, ...options })
  return out
}
function cli(args) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts/package-codex.mjs'), ...args], { cwd: WORK, encoding: 'utf8' })
}
let BASE, VERSION

try {
  mkdirSync(SOURCE)
  for (const path of ['plugin.json', 'package.json', '.claude-plugin', '.codex-plugin', '.agents', 'hooks', 'skills', 'scripts']) cpSync(join(ROOT, path), join(SOURCE, path), { recursive: true })
  // archive 属性不能使快照丢文件或展开占位符。
  writeFileSync(join(SOURCE, '.gitattributes'), 'snapshot.txt export-ignore\nsubstitution.txt export-subst\n')
  writeFileSync(join(SOURCE, 'snapshot.txt'), 'keep tracked bytes\n')
  writeFileSync(join(SOURCE, 'substitution.txt'), '$Format:%H$\n')
  writeFileSync(join(SOURCE, 'binary.dat'), Buffer.from([0, 255, 10, 128]))
  chmodSync(join(SOURCE, 'scripts/package-codex.mjs'), 0o755)
  git(['init', '-b', 'main']); git(['add', '.']); git(['commit', '-m', 'native fixture'])
  BASE = git(['rev-parse', 'HEAD'])
  VERSION = read(join(SOURCE, 'plugin.json')).version

  check('commit export preserves source, hook and skill bytes, modes, and native discovery paths', () => {
    const before = git(['status', '--porcelain'])
    const out = exported('exact')
    assert.equal(git(['status', '--porcelain']), before)
    assert.equal(existsSync(join(out, 'plugin.json')), false)
    assert.equal(existsSync(join(out, '.claude-plugin')), false)
    assert.deepEqual(readFileSync(join(out, 'package.json')), readFileSync(join(SOURCE, 'package.json')))
    const native = read(join(out, '.codex-plugin/plugin.json'))
    assert.equal(native.version, VERSION)
    assert.equal(native.skills, './skills/')
    assert.equal(native.hooks, './hooks/codex-hooks.json')
    const paths = git(['ls-files', 'hooks', 'skills', 'scripts', '.codex-plugin']).split('\n')
    for (const path of paths) assert.deepEqual(readFileSync(join(out, path)), readFileSync(join(SOURCE, path)), path)
    for (const path of ['snapshot.txt', 'substitution.txt', 'binary.dat']) assert.deepEqual(readFileSync(join(out, path)), readFileSync(join(SOURCE, path)))
    assert.equal(lstatSync(join(out, 'scripts/package-codex.mjs')).mode & 0o777, 0o755)
    const hooks = read(join(out, native.hooks)).hooks
    for (const event of ['Stop', 'PreToolUse', 'PostToolUse']) assert.ok(hooks[event].length)
    assert.match(readFileSync(join(out, 'skills/ddd-workflow/SKILL.md'), 'utf8'), /^---\nname: ddd-workflow/m)
    assert.equal(checkCodexPackage({ dir: out, source: SOURCE }).source.commit, BASE)
    const provenance = read(join(out, PROVENANCE))
    assert.equal(provenance.source.tree, git(['rev-parse', `${BASE}^{tree}`]))
    assert.equal(provenance.source.version, VERSION)
    assert.equal(provenance.publication, 'not checked')
    assert.deepEqual(provenance.adaptations.filter((item) => item.operation === 'remove').map((item) => item.path),
      ['plugin.json', ...git(['ls-files', '.claude-plugin']).split('\n').sort()])
    assert.equal(JSON.stringify(provenance).includes(WORK), false)
    assert.deepEqual(readFileSync(join(SOURCE, 'plugin.json')), Buffer.from(git(['show', `${BASE}:plugin.json`]) + '\n'))
  })
  check('dirty and untracked work is excluded, and explicit older commits remain reproducible', () => {
    const path = join(SOURCE, 'snapshot.txt')
    writeFileSync(path, 'second committed version\n'); git(['add', '.']); git(['commit', '-m', 'second'])
    writeFileSync(path, 'uncommitted change\n')
    writeFileSync(join(SOURCE, 'private-untracked.txt'), 'never package this\n')
    const before = git(['status', '--porcelain'])
    const out = exported('older')
    assert.equal(readFileSync(join(out, 'snapshot.txt'), 'utf8'), 'keep tracked bytes\n')
    assert.equal(existsSync(join(out, 'private-untracked.txt')), false)
    assert.equal(git(['status', '--porcelain']), before)
    assert.equal(readFileSync(path, 'utf8'), 'uncommitted change\n')
    assert.equal(readFileSync(join(SOURCE, 'private-untracked.txt'), 'utf8'), 'never package this\n')
    const latest = exported('head', { ref: 'HEAD' })
    assert.equal(readFileSync(join(latest, 'snapshot.txt'), 'utf8'), 'second committed version\n')
    assert.throws(() => checkCodexPackage({ dir: latest, source: SOURCE, expectCommit: BASE }), /external expectation/)
    checkCodexPackage({ dir: out, source: SOURCE, expectCommit: BASE })
  })
  check('only the requested marketplace name changes; provenance records the adaptation', () => {
    const out = exported('renamed', { marketplace: 'ddd-native-local' })
    const original = read(join(SOURCE, '.agents/plugins/marketplace.json'))
    const actual = read(join(out, '.agents/plugins/marketplace.json'))
    assert.deepEqual(actual, { ...original, name: 'ddd-native-local' })
    assert.equal(read(join(out, PROVENANCE)).adaptations.find((item) => item.operation === 'set').value, 'ddd-native-local')
    checkCodexPackage({ dir: out, source: SOURCE })
    assert.equal(read(join(SOURCE, '.agents/plugins/marketplace.json')).name, original.name)
  })
  check('added, missing, modified, hook, skill, version, marketplace, provenance, and mode tampering fail', () => {
    const cases = [
      ['added', (out) => writeFileSync(join(out, 'extra.txt'), 'extra')],
      ['claude-metadata', (out) => { mkdirSync(join(out, '.claude-plugin')); json(join(out, '.claude-plugin/plugin.json'), read(join(SOURCE, '.claude-plugin/plugin.json'))) }],
      ['root-manifest', (out) => cpSync(join(SOURCE, 'plugin.json'), join(out, 'plugin.json'))],
      ['package-version', (out) => { const path = join(out, 'package.json'), value = read(path); value.version = '99.0.0'; json(path, value) }],
      ['missing', (out) => rmSync(join(out, 'snapshot.txt'))],
      ['modified', (out) => writeFileSync(join(out, 'snapshot.txt'), 'tampered')],
      ['hook', (out) => writeFileSync(join(out, 'hooks/codex-hooks.json'), '{}')],
      ['skill', (out) => writeFileSync(join(out, 'skills/ddd-workflow/SKILL.md'), 'tampered')],
      ['version', (out) => { const path = join(out, '.codex-plugin/plugin.json'), value = read(path); value.version = '99.0.0'; json(path, value) }],
      ['marketplace', (out) => { const path = join(out, '.agents/plugins/marketplace.json'), value = read(path); value.name = 'tampered'; json(path, value) }],
      ['provenance', (out) => { const path = join(out, PROVENANCE), value = read(path); value.source.tree = '0'.repeat(40); json(path, value) }],
      ['provenance-extra', (out) => { const path = join(out, PROVENANCE), value = read(path); value.untrusted = true; json(path, value) }],
      ['provenance-removals', (out) => { const path = join(out, PROVENANCE), value = read(path); value.adaptations = value.adaptations.filter((item) => !item.path.startsWith('.claude-plugin/')); json(path, value) }],
      ['mode', (out) => chmodSync(join(out, 'scripts/package-codex.mjs'), 0o644)],
      ['empty-directory', (out) => mkdirSync(join(out, 'extra-directory'))],
      ['symlink', (out) => symlinkSync('snapshot.txt', join(out, 'link'))],
    ]
    for (const [name, mutate] of cases) {
      const out = exported(`tamper-${name}`); mutate(out)
      assert.throws(() => checkCodexPackage({ dir: out, source: SOURCE }), /differs|unsupported/, name)
    }
  })
  check('unsafe output, reference, marketplace, and source paths do not overwrite or mutate data', () => {
    const existing = join(WORK, 'existing'); mkdirSync(existing); writeFileSync(join(existing, 'keep.txt'), 'keep')
    assert.throws(() => packageCodex({ out: existing, source: SOURCE }), /already exists/)
    assert.equal(readFileSync(join(existing, 'keep.txt'), 'utf8'), 'keep')
    assert.throws(() => packageCodex({ out: join(SOURCE, 'nested'), source: SOURCE }), /outside/)
    assert.equal(existsSync(join(SOURCE, 'nested')), false)
    assert.throws(() => exported('bad-ref', { ref: '--output=unsafe' }), /reference/)
    assert.throws(() => exported('unknown-ref', { ref: 'missing-commit' }), /Git read/)
    assert.throws(() => exported('bad-marketplace', { marketplace: '../escape' }), /marketplace/)
    symlinkSync(SOURCE, join(WORK, 'source-link'))
    assert.throws(() => packageCodex({ out: join(WORK, 'bad-source'), source: join(WORK, 'source-link') }), /Symlink/)
    symlinkSync(WORK, join(WORK, 'parent-link'))
    assert.throws(() => packageCodex({ out: join(WORK, 'parent-link/output'), source: SOURCE }), /Symlink/)
    for (const path of ['bad-ref', 'unknown-ref', 'bad-marketplace', 'bad-source']) assert.equal(existsSync(join(WORK, path)), false)
  })
  check('source symlinks, escaping paths, and invalid snapshots are rejected before output creation', () => {
    symlinkSync('snapshot.txt', join(SOURCE, 'tracked-link')); git(['add', 'tracked-link']); git(['commit', '-m', 'symlink'])
    assert.throws(() => exported('symlink-source', { ref: 'HEAD' }), /symlink/)
    git(['rm', 'tracked-link']); writeFileSync(join(SOURCE, 'unsafe\\path.txt'), 'unsafe'); git(['add', '.']); git(['commit', '-m', 'unsafe path'])
    assert.throws(() => exported('unsafe-path', { ref: 'HEAD' }), /Unsafe package path/)
    git(['rm', 'unsafe\\path.txt'])
    const path = join(SOURCE, '.codex-plugin/plugin.json'), value = read(path)
    value.version = '99.0.0'; json(path, value); git(['add', '.']); git(['commit', '-m', 'invalid version'])
    assert.throws(() => exported('invalid-snapshot', { ref: 'HEAD' }), /mismatch/)
    for (const path of ['symlink-source', 'unsafe-path', 'invalid-snapshot']) assert.equal(existsSync(join(WORK, path)), false)
  })
  check('CLI reports commit snapshots and bilingual failures, with externally pinned check support', () => {
    const out = join(WORK, 'cli')
    const result = cli(['--out', out, '--source', SOURCE, '--ref', BASE])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Snapshot from commit/)
    assert.match(result.stdout, /publication not checked/)
    const checked = cli(['--check', out, '--source', SOURCE, '--expect-commit', BASE])
    assert.equal(checked.status, 0, checked.stderr)
    for (const args of [[], ['--unknown'], ['--out', out], ['--check', out, '--ref', BASE], ['--out', out, '--check', out]]) {
      const failed = cli(args)
      assert.equal(failed.status, 1)
      assert.match(failed.stderr, /打包失败 \/ Package failed:/)
    }
  })
  console.log(`Native package: ${passed} groups passed`)
} finally { rmSync(WORK, { recursive: true, force: true }) }
