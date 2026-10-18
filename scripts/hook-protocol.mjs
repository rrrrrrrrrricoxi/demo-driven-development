// Claude/Codex wire protocol only. Shared rules consume normalized requests and
// return semantic results; they do not read stdin, emit hook JSON, or exit.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const events = { Stop: 'settle', stop: 'settle', settle: 'settle',
  PreToolUse: 'before-tool', 'pre-tool': 'before-tool', 'before-tool': 'before-tool',
  PostToolUse: 'after-tool', 'post-tool': 'after-tool', 'after-tool': 'after-tool' }
const shellNames = new Set(['Bash', 'exec_command', 'functions.exec_command', 'shell', 'shell_command'])

export function readHookInput() {
  let raw = '', hook = {}
  if (!process.stdin.isTTY) { try { raw = readFileSync(0, 'utf8') } catch {} }
  try { hook = object(JSON.parse(raw)) } catch {}
  return { raw, hook }
}

export function normalizeHook(value, { event, runtime = 'claude', env = process.env, cwd = process.cwd() } = {}) {
  const hook = object(value), input = object(hook.tool_input)
  const selected = events[event || hook.hook_event_name] || null
  const eventCwd = typeof hook.cwd === 'string' && hook.cwd ? hook.cwd : null
  const sessionCwd = eventCwd || cwd
  const override = typeof input.workdir === 'string' && input.workdir ? input.workdir
    : typeof input.cwd === 'string' && input.cwd ? input.cwd : null
  const toolEvent = selected === 'before-tool' || selected === 'after-tool'
  const projectCwd = runtime === 'codex'
    ? resolve(cwd, sessionCwd, toolEvent && override ? override : '.')
    : resolve(cwd, env.DDD_PROJECT_DIR || eventCwd || env.CLAUDE_PROJECT_DIR || cwd)
  // Legacy Claude Read supports a path base separate from board discovery.
  // Codex dispatch always chooses the actual tool directory for both.
  const pathCwd = runtime === 'codex' ? projectCwd
    : resolve(cwd, override || eventCwd || env.DDD_PROJECT_DIR || env.CLAUDE_PROJECT_DIR || cwd)
  const name = hook.tool_name
  const kind = name === 'Read' || /(?:^|__)read_file$/.test(name || '') ? 'read'
    : !name || name === 'Bash' || (runtime === 'codex' && shellNames.has(name)) ? 'shell' : 'other'
  const command = typeof input.command === 'string' ? input.command : typeof input.cmd === 'string' ? input.cmd : ''
  const path = typeof input.file_path === 'string' ? input.file_path : typeof input.path === 'string' ? input.path : ''
  return { event: selected, cwd: projectCwd, tool: { kind, command, path, cwd: pathCwd }, repeatedStop: Boolean(hook.stop_hook_active) }
}

export function encodeHookResult(result) {
  let payload = null, stderr = result.stderr || '', exitCode = 0
  switch (result.kind) {
    case 'none':
      if (result.additionalContext) payload = { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: result.additionalContext } }
      if (result.notice) payload = { ...payload, systemMessage: result.notice }
      break
    case 'deny-tool':
      payload = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: result.reason } }
      break
    case 'block-stop':
      payload = { decision: 'block', reason: result.reason, ...(result.notice ? { systemMessage: result.notice } : {}) }
      break
    case 'failure':
      stderr += result.reason || ''
      exitCode = 2
      break
    default: throw new Error(`Unknown DDD hook result: ${result.kind}`)
  }
  return { stdout: payload ? JSON.stringify(payload) + '\n' : '', stderr, exitCode }
}

export function writeHookResult(result) {
  const encoded = encodeHookResult(result)
  if (encoded.stdout) process.stdout.write(encoded.stdout)
  if (encoded.stderr) process.stderr.write(encoded.stderr)
  process.exitCode = encoded.exitCode
}
