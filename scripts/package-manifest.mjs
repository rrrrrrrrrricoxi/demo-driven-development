// 包清单与资源校验:只读文件,不执行发版、Git 或宿主命令。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  const canonical = json(root, 'package.json')
  const descriptor = json(root, 'plugin.json')
  const codex = json(root, '.codex-plugin/plugin.json')
  if (!/^\d+\.\d+\.\d+$/.test(canonical.version || '')) fail('发版版本须是 X.Y.Z / Release version must be X.Y.Z')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonical.name || '')) fail('插件名非法 / Invalid plugin name')
  for (const [path, other] of [
    ['plugin.json', descriptor],
    ['.claude-plugin/plugin.json', json(root, '.claude-plugin/plugin.json')],
    ['.codex-plugin/plugin.json', codex],
  ]) {
    if (other.name !== canonical.name || other.version !== canonical.version) fail(`版本或名称不一致 / Manifest identity mismatch: ${path}`)
  }
  const nativeHooks = descriptor.extensions?.['com.openai']?.hooks
  if (nativeHooks !== codex.hooks) fail('Codex hook 声明不一致 / Codex hook declarations disagree')
  packagePath(root, codex.skills)
  for (const path of [nativeHooks, './hooks/hooks.json']) {
    const hookFile = packagePath(root, path)
    const spec = JSON.parse(readFileSync(hookFile, 'utf8'))
    for (const event of ['Stop', 'PreToolUse', 'PostToolUse']) {
      const groups = spec?.hooks?.[event]
      if (!Array.isArray(groups) || !groups.length) fail(`缺少 hook / Missing hook: ${event} (${path})`)
      for (const group of groups) {
        if (!Array.isArray(group?.hooks) || !group.hooks.length) fail(`缺少 hook / Missing hook: ${event} (${path})`)
        for (const hook of group.hooks) {
          const match = String(hook?.command || '').match(/\$\{(?:CLAUDE_)?PLUGIN_ROOT\}\/([^"\s]+)/)
          if (!match || hook?.type !== 'command') fail(`hook 命令不能定位包内脚本 / Hook must invoke a bundled script: ${event}`)
          packagePath(root, `./${match[1]}`)
        }
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
