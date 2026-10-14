#!/usr/bin/env node
// Codex 当前 hook 协议与 Claude 的阻断/提醒协议兼容。只规范输入与项目上下文,
// 三条规则仍交给原脚本;不复制审计、主线判断或版本戳逻辑。
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

let hook = {}
try { hook = JSON.parse(readFileSync(0, 'utf8')) } catch {}
if (!hook || typeof hook !== 'object' || Array.isArray(hook)) hook = {}
const input = hook.tool_input && typeof hook.tool_input === 'object' && !Array.isArray(hook.tool_input) ? hook.tool_input : {}
// 正式 Bash 事件用 command;cmd 接受原始 unified-exec 事件/直接测试调用。
const command = typeof input.command === 'string' ? input.command : input.cmd
const shellNames = new Set(['Bash', 'exec_command', 'functions.exec_command', 'shell', 'shell_command'])
const event = process.argv[2] || hook.hook_event_name
// 工具的 workdir/cwd 可跨出会话项目;用实际执行目录找板,不拿会话所在的板替别人做判断。
const sessionCwd = typeof hook.cwd === 'string' && hook.cwd ? hook.cwd : process.cwd()
const toolEvent = ['pre-tool', 'post-tool', 'PreToolUse', 'PostToolUse'].includes(event)
const toolCwd = toolEvent ? (typeof input.workdir === 'string' && input.workdir ? input.workdir
  : typeof input.cwd === 'string' && input.cwd ? input.cwd : null) : null
const effectiveCwd = resolve(sessionCwd, toolCwd || '.')
const normalized = { ...hook, cwd: effectiveCwd,
  ...(shellNames.has(hook.tool_name) ? { tool_name: 'Bash' } : {}),
  tool_input: { ...input,
    ...(toolCwd ? { workdir: effectiveCwd, cwd: effectiveCwd } : {}),
    ...(typeof command === 'string' ? { command } : {}) } }
const handlers = { Stop: ['stop-hook.mjs'], PreToolUse: ['read-gate.mjs', 'merge-gate.mjs'], PostToolUse: ['ghpr-remind.mjs'] }
const aliases = { stop: 'Stop', 'pre-tool': 'PreToolUse', 'post-tool': 'PostToolUse' }
const selected = handlers[aliases[event] || event]
if (!selected) process.exit(0)
for (const handler of selected) {
  const r = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), handler)], {
    input: JSON.stringify(normalized), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    cwd: effectiveCwd,
    env: { ...process.env, DDD_RUNTIME: 'codex',
      DDD_PROJECT_DIR: effectiveCwd },
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.error) { process.stderr.write(`${r.error.message}\n`); process.exit(1) }
  // 读闸只在阻断时出声;拒绝后不再跑合并闸。不返回 allow,权限流程仍由宿主处理。
  if (r.status !== 0 || r.stdout) process.exit(r.status ?? 1)
}
