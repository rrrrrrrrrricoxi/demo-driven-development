// Claude-only legacy cache forwarding. Keep raw stdin and subprocess output
// byte-for-byte; the shared core never reads a harness installation registry.
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { cmpVer, readPluginVersion, readStamp } from './lib-version.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))

function newerInstall(kanban, minVer, selfVer, env) {
  const cfgDir = env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
  let db = null, name = ''
  try { db = JSON.parse(readFileSync(join(cfgDir, 'plugins', 'installed_plugins.json'), 'utf8')) } catch { return null }
  try { name = JSON.parse(readFileSync(join(SELF_DIR, '..', '.claude-plugin', 'plugin.json'), 'utf8')).name } catch { return null }
  const rows = []
  for (const [key, list] of Object.entries((db && db.plugins) || {})) {
    if (key.split('@')[0] !== name || !Array.isArray(list)) continue
    for (const e of list) if (e && typeof e.installPath === 'string') rows.push(e)
  }
  const here = resolve(kanban, '..', '..') // 看板在 <项目根>/app/kanban,倒推两级就是 detect 认定的那个项目根
  const mine = rows.filter((e) => e.projectPath && resolve(String(e.projectPath)) === here)
  const selfRoot = resolve(SELF_DIR, '..')
  let best = null
  for (const e of (mine.length ? mine : rows.filter((e) => !e.projectPath))) {
    const v = String(e.version || '')
    if (!(cmpVer(v, minVer) >= 0) || cmpVer(v, selfVer) === 0) continue
    if (resolve(e.installPath) === selfRoot) continue // 就是我自己:版本号撞了也别自己转给自己
    if (!existsSync(join(e.installPath, 'scripts', 'stop-hook.mjs'))) continue
    if (!best || cmpVer(v, best.version) > 0) best = { version: v, path: e.installPath }
  }
  return best
}

export function forwardClaudeStop(request, raw, { env = process.env, cwd = process.cwd() } = {}) {
  // No runtime means the legacy Claude entry point. Unknown runtimes must not
  // borrow Claude installs; this opt-in is deliberately not "anything but Codex".
  if ((env.DDD_RUNTIME || 'claude') !== 'claude' || env.DDD_HOOK_FORWARDED) return null
  const kanban = detect({ cwd: request.cwd, env: {} })
  if (!kanban || existsSync(join(kanban, '.init-lock'))) return null
  const version = readPluginVersion(undefined, { onDiagnostic: () => {} })
  const stamp = readStamp(join(kanban, 'index.html'))
  if (!version || !stamp || !(cmpVer(stamp, version) > 0)) return null
  const target = newerInstall(kanban, stamp, version, env)
  if (!target) return null
  const child = spawnSync(process.execPath, [join(target.path, 'scripts', 'stop-hook.mjs')], {
    cwd, input: raw, encoding: 'utf8', env: { ...env, DDD_HOOK_FORWARDED: target.version },
  })
  if (child.error) return null
  return { stdout: child.stdout || '', stderr: child.stderr || '', exitCode: child.status ?? 0 }
}
