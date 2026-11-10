#!/usr/bin/env node
// 只发布明确提交的原生快照。临时 index 不接触用户 index;普通 push 保留生成分支历史。
import { lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkCodexPackage, packageCodex, PROVENANCE } from './package-codex.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN = 'refs/heads/main', TARGET = 'refs/heads/codex-native'
const fail = (message) => { throw new Error(message) }

export function publishCodexNative({ source = ROOT, sourceCommit, remote = 'origin' } = {}) {
  source = resolve(source)
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sourceCommit || '')) fail('须指定完整来源提交 / A full source commit is required')
  if (!remote || remote.startsWith('-') || /[\x00-\x1f\x7f]/.test(remote)) fail('远程名称无效 / Invalid remote')
  const run = (args, { input, env = {}, allowed = [0] } = {}) => {
    const result = spawnSync('git', ['--no-replace-objects', '-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: source, input, env: { ...process.env, ...env }, maxBuffer: 128 * 1024 * 1024,
    })
    if (result.error || !allowed.includes(result.status)) fail(`Git 操作失败 / Git operation failed: ${String(result.stderr || result.error).trim()}`)
    return result.stdout.toString().trim()
  }
  if (run(['rev-parse', '--show-toplevel']) !== source) fail('来源须是仓库根目录 / Source must be the repository root')
  if (run(['rev-parse', '--verify', `${sourceCommit}^{commit}`]) !== sourceCommit) fail('来源提交无效 / Invalid source commit')
  const heads = () => new Map(run(['ls-remote', '--heads', remote, MAIN, TARGET]).split('\n').filter(Boolean).map((line) => {
    const match = line.match(/^([0-9a-f]{40}(?:[0-9a-f]{24})?)\t(refs\/heads\/(?:main|codex-native))$/)
    if (!match) fail('远程引用无效 / Invalid remote reference')
    return [match[2], match[1]]
  }))
  const before = heads()
  if (before.get(MAIN) !== sourceCommit) fail('来源已不是远程 main / Source is no longer remote main')
  const parent = before.get(TARGET)
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'ddd-native-publish-'))
  try {
    const out = join(temporary, 'package')
    const provenance = packageCodex({ source, ref: sourceCommit, out })
    checkCodexPackage({ source, dir: out, expectCommit: sourceCommit })
    if (parent) {
      run(['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, parent])
      const previous = JSON.parse(run(['show', `${parent}:${PROVENANCE}`]))
      const previousCommit = previous?.source?.commit
      if (previous?.format !== provenance.format || previous?.source?.repository !== provenance.source.repository || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(previousCommit || '')) {
        fail('目标分支缺少有效来源记录 / Target branch has no valid provenance')
      }
      // 来源只能沿 main 前进;即使 main 被回退,旧任务也不能覆盖较新的原生包。
      run(['merge-base', '--is-ancestor', previousCommit, sourceCommit])
    }
    const env = { GIT_INDEX_FILE: join(temporary, 'index') }
    run(['read-tree', '--empty'], { env })
    const entries = []
    const add = (prefix = '') => {
      for (const name of readdirSync(join(out, prefix)).sort()) {
        const path = prefix ? `${prefix}/${name}` : name
        const stat = lstatSync(join(out, path))
        if (stat.isDirectory()) add(path)
        else {
          const oid = run(['hash-object', '-w', '--stdin', '--no-filters'], { input: readFileSync(join(out, path)) })
          entries.push(`${stat.mode & 0o111 ? '100755' : '100644'} ${oid}\t${path}\0`)
        }
      }
    }
    add()
    run(['update-index', '-z', '--index-info'], { input: entries.join(''), env })
    const tree = run(['write-tree'], { env })
    if (parent && run(['rev-parse', `${parent}^{tree}`]) === tree) return { status: 'unchanged', sourceCommit, commit: parent }
    if (parent) {
      const previous = JSON.parse(run(['show', `${parent}:${PROVENANCE}`]))
      if (previous.source.commit === sourceCommit) fail('同一来源的目标内容已改变 / Target content changed for the same source')
    }
    const current = heads()
    if (current.get(MAIN) !== sourceCommit || current.get(TARGET) !== parent) fail('远程引用已改变,请重新运行 / Remote references changed; rerun publication')
    const commit = run(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Codex native package from ${sourceCommit}`], { env: {
      GIT_AUTHOR_NAME: 'github-actions[bot]', GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'github-actions[bot]', GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    } })
    // 不用 force 或 lease;另一个发布者先写入时,服务器会拒绝非快进更新。
    run(['-c', 'push.followTags=false', 'push', '--porcelain', '--no-verify', remote, `${commit}:${TARGET}`])
    return { status: 'published', sourceCommit, commit }
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 2 || args[0] !== '--source-commit') fail('用法 / Usage: node scripts/publish-codex-native.mjs --source-commit SHA')
    console.log(JSON.stringify(publishCodexNative({ sourceCommit: args[1] }), null, 2))
  } catch (error) { console.error(`发布失败 / Publication failed: ${error.message}`); process.exitCode = 1 }
}
