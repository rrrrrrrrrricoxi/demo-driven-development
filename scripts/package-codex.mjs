#!/usr/bin/env node
// 从明确的 Git commit 导出 Codex 原生兼容包;不读工作树内容,不安装、不联网、不改 hook 信任。
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackage } from './release.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const PROVENANCE = 'codex-package-provenance.json'
const fail = (message) => { throw new Error(message) }
const encode = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const inside = (root, path) => { const rel = relative(root, path); return !rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)) }

function noSymlinks(path) {
  for (let current = resolve(path); ; current = dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) fail(`拒绝符号链接路径 / Symlink path refused: ${path}`)
    if (dirname(current) === current) break
  }
}

function git(source, args, input) {
  const result = spawnSync('git', ['--no-replace-objects', ...args], { cwd: source, input, maxBuffer: 128 * 1024 * 1024 })
  if (result.error || result.status !== 0) fail(`Git 读取失败 / Git read failed: ${String(result.stderr || result.error).trim()}`)
  return result.stdout
}

function sourceRoot(source) {
  const root = resolve(source)
  noSymlinks(root)
  if (git(root, ['rev-parse', '--show-toplevel']).toString().trim() !== root) fail('来源须是仓库根目录 / Source must be the repository root')
  return root
}

function safePath(path) {
  if (!path || isAbsolute(path) || /[\\\x00-\x1f\x7f]/.test(path) || path.split('/').some((part) => !part || part === '.' || part === '..' || part.toLowerCase() === '.git')) {
    fail(`不安全的包路径 / Unsafe package path: ${JSON.stringify(path)}`)
  }
}

function snapshot(source, ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || /[\x00-\x1f\x7f]/.test(ref)) fail('无效的提交引用 / Invalid commit reference')
  const commit = git(source, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).toString().trim()
  const tree = git(source, ['rev-parse', `${commit}^{tree}`]).toString().trim()
  const listing = git(source, ['ls-tree', '-rz', '--full-tree', commit])
  if (!Buffer.from(listing.toString('utf8')).equals(listing)) fail('来源路径须是 UTF-8 / Source paths must be UTF-8')
  const entries = listing.toString('utf8').split('\0').filter(Boolean).map((line) => {
    const match = line.match(/^(100644|100755) blob ([0-9a-f]+)\t(.+)$/s)
    if (!match) fail('来源含符号链接、子模块或不支持的条目 / Source contains a symlink, submodule, or unsupported entry')
    const [, mode, oid, path] = match
    safePath(path)
    return { mode: Number.parseInt(mode, 8) & 0o777, oid, path }
  })
  // 批量读 blob 可保留原字节;git archive 的 export-subst/export-ignore 会改变来源快照。
  const blobs = git(source, ['cat-file', '--batch'], entries.map((entry) => entry.oid).join('\n') + '\n')
  let offset = 0
  const files = new Map()
  for (const entry of entries) {
    const end = blobs.indexOf(10, offset)
    const header = blobs.subarray(offset, end).toString().match(/^([0-9a-f]+) blob (\d+)$/)
    if (!header || header[1] !== entry.oid) fail('Git blob 响应无效 / Invalid Git blob response')
    const size = Number(header[2]), start = end + 1
    files.set(entry.path, { data: blobs.subarray(start, start + size), mode: entry.mode })
    offset = start + size + 1
  }
  if (files.has(PROVENANCE)) fail('来源占用 provenance 路径 / Source already contains the provenance path')
  return { commit, tree, files }
}

function writeFiles(root, files) {
  for (const [path, file] of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), file.data, { flag: 'wx', mode: file.mode })
    chmodSync(join(root, path), file.mode)
  }
}

function expected(source, ref, marketplace) {
  if (marketplace !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(marketplace)) fail('marketplace 名称无效 / Invalid marketplace name')
  const { commit, tree, files } = snapshot(source, ref)
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'ddd-native-snapshot-'))
  let info, canonical
  try {
    writeFiles(temporary, files)
    info = validatePackage(temporary)
    canonical = JSON.parse(files.get('plugin.json').data)
  } finally { rmSync(temporary, { recursive: true, force: true }) }
  // provenance 使用 manifest 的公共来源标识,不记录调用者的路径、账号或 Git remote 凭据。
  const repository = new URL(canonical.repository)
  if (repository.protocol !== 'https:' || repository.username || repository.password || repository.search || repository.hash) fail('来源标识须是无凭据 HTTPS URL / Repository identity must be a credential-free HTTPS URL')
  const adaptations = [{ operation: 'remove', path: 'plugin.json', reason: 'Select .codex-plugin/plugin.json for native Codex hooks' }]
  files.delete('plugin.json')
  if (marketplace !== undefined) {
    const path = '.agents/plugins/marketplace.json'
    const metadata = JSON.parse(files.get(path).data)
    metadata.name = marketplace
    files.set(path, { data: encode(metadata), mode: files.get(path).mode })
    adaptations.push({ operation: 'set', path, field: 'name', value: marketplace })
  }
  const provenance = {
    format: 'ddd-codex-native-package-v1',
    source: { repository: canonical.repository, commit, tree, version: info.version },
    package: { name: info.name, version: info.version },
    snapshot: 'git commit; uncommitted and untracked files excluded',
    publication: 'not checked',
    adaptations,
  }
  files.set(PROVENANCE, { data: encode(provenance), mode: 0o644 })
  return { files, provenance }
}

export function packageCodex({ out, source = ROOT, ref = 'HEAD', marketplace } = {}) {
  if (!out) fail('必须指定输出目录 / Output directory is required')
  const root = sourceRoot(source), target = resolve(out)
  noSymlinks(target)
  if (inside(root, target)) fail('输出不得位于来源仓库内 / Output must be outside the source repository')
  if (existsSync(target)) fail('输出目录已存在 / Output directory already exists')
  const result = expected(root, ref, marketplace)
  let created = false
  try {
    mkdirSync(target); created = true
    writeFiles(target, result.files)
  } catch (error) {
    if (created) rmSync(target, { recursive: true, force: true })
    throw error
  }
  return result.provenance
}

function inventory(root, prefix = '', result = new Map()) {
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    safePath(path)
    const stat = lstatSync(join(root, path))
    if (stat.isDirectory()) { result.set(`${path}/`, null); inventory(root, path, result) }
    else if (stat.isFile()) result.set(path, { data: readFileSync(join(root, path)), mode: stat.mode & 0o777 })
    else fail(`包含不支持的条目 / Package contains an unsupported entry: ${path}`)
  }
  return result
}

export function checkCodexPackage({ dir, source = ROOT, expectCommit } = {}) {
  if (!dir) fail('必须指定校验目录 / Check directory is required')
  const root = sourceRoot(source), target = resolve(dir)
  noSymlinks(target)
  const actual = inventory(target)
  const provenance = JSON.parse(actual.get(PROVENANCE)?.data.toString() || 'null')
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(provenance?.source?.commit || '')) fail('provenance 提交无效 / Invalid provenance commit')
  if (expectCommit !== undefined) {
    const pinned = git(root, ['rev-parse', '--verify', '--end-of-options', `${expectCommit}^{commit}`]).toString().trim()
    if (provenance.source.commit !== pinned) fail('提交与外部预期不符 / Commit does not match external expectation')
  }
  const rename = provenance.adaptations?.find((item) => item.operation === 'set' && item.path === '.agents/plugins/marketplace.json' && item.field === 'name')
  const result = expected(root, provenance.source.commit, rename?.value)
  const wanted = new Map(result.files)
  for (const path of result.files.keys()) {
    let parent = dirname(path)
    while (parent !== '.') { wanted.set(`${parent}/`, null); parent = dirname(parent) }
  }
  const changes = []
  for (const [path, file] of wanted) {
    if (!actual.has(path)) changes.push(`missing ${path}`)
    else if (file && (!actual.get(path) || !file.data.equals(actual.get(path).data) || file.mode !== actual.get(path).mode)) changes.push(`modified ${path}`)
  }
  for (const path of actual.keys()) if (!wanted.has(path)) changes.push(`added ${path}`)
  if (changes.length) fail(`包与提交快照不符 / Package differs from commit snapshot:\n${changes.join('\n')}`)
  return result.provenance
}

function main() {
  const options = {}, args = process.argv.slice(2)
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (!['--out', '--check', '--source', '--ref', '--marketplace', '--expect-commit'].includes(flag) || Object.hasOwn(options, flag) || !args[index + 1] || args[index + 1].startsWith('--')) {
      fail('用法 / Usage: node scripts/package-codex.mjs --out DIR [--source REPO] [--ref COMMIT] [--marketplace NAME] | --check DIR [--source REPO] [--expect-commit COMMIT]')
    }
    options[flag] = args[++index]
  }
  if (Boolean(options['--out']) === Boolean(options['--check']) || (options['--out'] && options['--expect-commit']) || (options['--check'] && (options['--ref'] || options['--marketplace']))) fail('导出与校验参数冲突 / Export and check options conflict')
  const provenance = options['--out']
    ? packageCodex({ out: options['--out'], source: options['--source'], ref: options['--ref'], marketplace: options['--marketplace'] })
    : checkCodexPackage({ dir: options['--check'], source: options['--source'], expectCommit: options['--expect-commit'] })
  console.log(`提交快照 / Snapshot from commit ${provenance.source.commit}; version ${provenance.source.version}; publication not checked`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error(`打包失败 / Package failed: ${error.message}`); process.exitCode = 1 }
}
