// 只写临时本地 bare remote;不使用真实远程、安装或 hook 信任。
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { publishCodexNative } from '../scripts/publish-codex-native.mjs'
import { checkCodexPackage } from '../scripts/package-codex.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = mkdtempSync(join(realpathSync(tmpdir()), 'ddd-native-publication-'))
let passed = 0
const git = (root, args) => {
  const result = spawnSync('git', ['-c', 'user.name=DDD fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
const check = async (name, fn) => { await fn(); passed++; console.log(`  ✓ ${name}`) }
function fixture(name) {
  const source = join(WORK, name), remote = join(WORK, `${name}.git`)
  mkdirSync(source)
  for (const path of ['plugin.json', 'package.json', '.claude-plugin', '.codex-plugin', '.agents', 'hooks', 'skills', 'scripts']) {
    cpSync(join(ROOT, path), join(source, path), { recursive: true })
  }
  writeFileSync(join(source, 'fixture.txt'), 'first\n')
  git(source, ['init', '-b', 'main']); git(source, ['add', '.']); git(source, ['commit', '-m', 'fixture'])
  git(WORK, ['init', '--bare', remote]); git(source, ['remote', 'add', 'origin', remote]); git(source, ['push', 'origin', 'main'])
  return { source, remote, first: git(source, ['rev-parse', 'HEAD']) }
}
const publish = (f, sourceCommit = git(f.source, ['rev-parse', 'HEAD'])) => publishCodexNative({ source: f.source, sourceCommit })
const tip = (f) => git(f.remote, ['rev-parse', 'refs/heads/codex-native'])
function advance(f) {
  writeFileSync(join(f.source, 'fixture.txt'), 'second\n')
  git(f.source, ['add', '.']); git(f.source, ['commit', '-m', 'advance']); git(f.source, ['push', 'origin', 'main'])
  return git(f.source, ['rev-parse', 'HEAD'])
}

try {
  const f = fixture('publish')
  await check('first publication preserves marketplace identity and verifies committed provenance', () => {
    const result = publish(f)
    assert.equal(result.status, 'published')
    assert.equal(tip(f), result.commit)
    const checkout = join(WORK, 'artifact')
    git(WORK, ['clone', '--quiet', '--branch', 'codex-native', f.remote, checkout])
    rmSync(join(checkout, '.git'), { recursive: true })
    assert.equal(checkCodexPackage({ source: f.source, dir: checkout, expectCommit: f.first }).source.commit, f.first)
    assert.equal(existsSync(join(checkout, 'plugin.json')), false)
    assert.equal(JSON.parse(readFileSync(join(checkout, '.agents/plugins/marketplace.json'))).name, 'demo-driven-development')
    assert.equal(git(f.remote, ['tag', '--list']), '')
  })
  await check('dirty and staged files do not change the export, worktree, or user index', () => {
    writeFileSync(join(f.source, 'fixture.txt'), 'staged private data\n')
    git(f.source, ['add', 'fixture.txt'])
    writeFileSync(join(f.source, 'plugin.json'), 'dirty private data\n')
    writeFileSync(join(f.source, 'untracked.txt'), 'private data\n')
    const status = git(f.source, ['status', '--porcelain']), index = git(f.source, ['write-tree']), before = tip(f)
    assert.equal(publish(f).status, 'unchanged')
    assert.equal(tip(f), before)
    assert.equal(git(f.source, ['status', '--porcelain']), status)
    assert.equal(git(f.source, ['write-tree']), index)
    git(f.source, ['restore', '--staged', '--worktree', '.'])
    rmSync(join(f.source, 'untracked.txt'))
  })
  await check('new main commits append a fast-forward artifact commit', () => {
    const before = tip(f), sourceCommit = advance(f)
    const result = publish(f)
    assert.equal(result.sourceCommit, sourceCommit)
    assert.equal(git(f.remote, ['rev-parse', `${result.commit}^`]), before)
    assert.equal(JSON.parse(git(f.remote, ['show', `${result.commit}:codex-package-provenance.json`])).source.commit, sourceCommit)
  })
  await check('stale tasks and main rollback cannot overwrite newer artifacts', () => {
    const before = tip(f)
    assert.throws(() => publish(f, f.first), /no longer remote main/)
    git(f.remote, ['update-ref', 'refs/heads/main', f.first])
    assert.throws(() => publish(f, f.first), /Git operation failed/)
    assert.equal(tip(f), before)
  })
  await check('competing publishers cannot replace each other through a non-fast-forward push', async () => {
    const race = fixture('race')
    const before = publish(race).commit, sourceCommit = advance(race)
    const bin = join(WORK, 'bin'), barrier = join(WORK, 'barrier')
    mkdirSync(bin); mkdirSync(barrier)
    const executable = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim()
    // 两个进程都完成远程检查后才同时放行 push,确定性覆盖最后一次检查后的竞争窗口。
    writeFileSync(join(bin, 'git'), `#!/usr/bin/env node\nconst { writeFileSync, readdirSync } = require('node:fs'); const { spawnSync } = require('node:child_process');\nconst args=process.argv.slice(2); if(args.includes('push')) { writeFileSync(${JSON.stringify(barrier)}+'/'+process.pid, ''); const start=Date.now(); while(readdirSync(${JSON.stringify(barrier)}).length<2) { if(Date.now()-start>15000) process.exit(99); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10); } }\nconst result=spawnSync(${JSON.stringify(executable)},args,{stdio:'inherit'}); process.exit(result.status ?? 1);\n`, { mode: 0o755 })
    const module = pathToFileURL(join(ROOT, 'scripts/publish-codex-native.mjs')).href
    const code = `import { publishCodexNative } from ${JSON.stringify(module)}; try { console.log(JSON.stringify(publishCodexNative(${JSON.stringify({ source: race.source, sourceCommit })}))) } catch(error) { console.error(error.message); process.exitCode=1 }`
    const launch = (date) => new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } })
      let stderr = ''
      child.stderr.on('data', (chunk) => { stderr += chunk })
      child.on('error', reject)
      child.on('close', (status) => resolveResult({ status, stderr }))
    })
    const results = await Promise.all([launch('2026-01-01T00:00:00Z'), launch('2026-01-01T00:00:01Z')])
    assert.deepEqual(results.map((result) => result.status).sort(), [0, 1], JSON.stringify(results))
    assert.match(results.find((result) => result.status === 1).stderr, /Git operation failed/)
    assert.equal(git(race.remote, ['rev-parse', `${tip(race)}^`]), before)
    assert.equal(git(race.remote, ['rev-parse', 'main']), sourceCommit)
  })
  console.log(`Codex native publication: ${passed} groups passed`)
} finally { rmSync(WORK, { recursive: true, force: true }) }
