#!/usr/bin/env node
// 发版入口不依赖宿主 CLI。根 manifest 是版本真源;各宿主声明必须同版,避免不同宿主写不同的戳。
// --check 只验包;--dry-run 另验干净主线与单调版本;--tag/--push 才明确写入 Git。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cmpVer } from './lib-version.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fail = (message) => { throw new Error(message) }
const json = (root, path) => JSON.parse(readFileSync(join(root, path), 'utf8'))

function packagePath(root, path) {
  if (typeof path !== 'string' || !path.startsWith('./') || isAbsolute(path)) fail(`包路径须以 ./ 开头 / Package path must start with ./: ${path}`)
  const target = resolve(root, path)
  const rel = relative(root, target)
  if (rel === '..' || rel.startsWith('../') || !existsSync(target)) fail(`包资源缺失或越界 / Missing or escaping package resource: ${path}`)
  return target
}

export function validatePackage(root = ROOT) {
  const canonical = json(root, 'plugin.json')
  if (!/^\d+\.\d+\.\d+$/.test(canonical.version || '')) fail('发版版本须是 X.Y.Z / Release version must be X.Y.Z')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonical.name || '')) fail('插件名非法 / Invalid plugin name')
  for (const path of ['package.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const other = json(root, path)
    if (other.name !== canonical.name || other.version !== canonical.version) fail(`版本或名称不一致 / Manifest identity mismatch: ${path}`)
  }
  const codex = json(root, '.codex-plugin/plugin.json')
  const nativeHooks = canonical.extensions?.['com.openai']?.hooks
  if (nativeHooks !== codex.hooks) fail('Codex hook 声明不一致 / Codex hook declarations disagree')
  packagePath(root, codex.skills)
  for (const path of [nativeHooks, './hooks/hooks.json']) {
    const hookFile = packagePath(root, path)
    const spec = JSON.parse(readFileSync(hookFile, 'utf8'))
    for (const event of ['Stop', 'PreToolUse', 'PostToolUse']) {
      if (!Array.isArray(spec.hooks?.[event]) || !spec.hooks[event].length) fail(`缺少 hook / Missing hook: ${event} (${path})`)
      for (const group of spec.hooks[event]) for (const hook of group.hooks || []) {
        const match = String(hook.command || '').match(/\$\{(?:CLAUDE_)?PLUGIN_ROOT\}\/([^"\s]+)/)
        if (!match || hook.type !== 'command') fail(`hook 命令不能定位包内脚本 / Hook must invoke a bundled script: ${event}`)
        packagePath(root, `./${match[1]}`)
      }
    }
  }
  const skillDirs = readdirSync(join(root, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory())
  if (!skillDirs.length) fail('包里没有 skill / Package has no skills')
  const names = new Set()
  for (const entry of skillDirs) {
    const text = readFileSync(join(root, 'skills', entry.name, 'SKILL.md'), 'utf8')
    const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    const name = front?.[1].match(/^name:\s*(\S+)/m)?.[1]
    if (!name || !/^description:\s*\S/m.test(front[1]) || names.has(name)) fail(`skill 元数据缺失或重复 / Missing or duplicate skill metadata: ${entry.name}`)
    names.add(name)
  }
  const marketplace = json(root, '.agents/plugins/marketplace.json')
  const entry = marketplace.plugins?.find((plugin) => plugin.name === canonical.name)
  if (!entry || marketplace.name !== canonical.name || entry.source?.source !== 'local' || entry.source.path !== './') fail('Codex marketplace 指向错误 / Codex marketplace must point at the packaged root')
  const claudeMarketplace = json(root, '.claude-plugin/marketplace.json')
  if (!claudeMarketplace.plugins?.some((plugin) => plugin.name === canonical.name && plugin.source === './')) fail('Claude marketplace 指向错误 / Claude marketplace must point at the packaged root')
  return { name: canonical.name, version: canonical.version, tag: `${canonical.name}--v${canonical.version}`, skills: [...names] }
}

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
