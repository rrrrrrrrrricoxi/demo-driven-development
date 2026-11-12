#!/usr/bin/env node
// 发版入口不依赖宿主 CLI。package.json 是版本真源;各宿主声明必须同版,避免不同宿主写不同的戳。
// --check 只验包;--dry-run 另验干净主线与单调版本;--tag/--push 才明确写入 Git。
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cmpVer } from './lib-version.mjs'
import { validatePackage } from './package-manifest.mjs'
export { validatePackage } from './package-manifest.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fail = (message) => { throw new Error(message) }

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.error || result.status !== 0) fail(String(result.stderr || result.error || `git ${args.join(' ')} failed`).trim())
  return result.stdout.trim()
}

export function releasePlan(root = ROOT) {
  const info = validatePackage(root)
  if (git(root, ['branch', '--show-current']) !== 'main') fail('只在 main 发版 / Release from main only')
  if (git(root, ['status', '--porcelain']).length) fail('发版工作区须干净 / Release checkout must be clean')
  const head = git(root, ['rev-parse', 'HEAD'])
  const tags = git(root, ['tag', '--list', `${info.name}--v*`]).split('\n').filter(Boolean)
  for (const tag of tags) {
    const version = tag.slice(`${info.name}--v`.length)
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue
    if (cmpVer(version, info.version) > 0) fail(`禁止降版 / Version downgrade refused: ${tag}`)
    if (cmpVer(version, info.version) === 0 && git(root, ['rev-parse', `${tag}^{commit}`]) !== head) fail(`版本号已指向别的提交 / Version tag points at another commit: ${tag}`)
  }
  return { ...info, head, tagExists: tags.includes(info.tag) }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--check', '--dry-run', '--tag', '--push'].includes(args[0])) {
    console.error('Usage: node scripts/release.mjs --check|--dry-run|--tag|--push')
    process.exitCode = 1
    return
  }
  const info = args[0] === '--check' ? validatePackage() : releasePlan()
  if (args[0] === '--tag' || args[0] === '--push') {
    if (!info.tagExists) git(ROOT, ['tag', '-a', info.tag, '-m', `${info.name} ${info.version}`])
    if (args[0] === '--push') git(ROOT, ['push', 'origin', `refs/tags/${info.tag}`])
  }
  console.log(JSON.stringify({ mode: args[0], ...info }, null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
