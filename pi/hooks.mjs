import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runHook } from '../scripts/hook-core.mjs'
import { detect } from '../scripts/lib-detect.mjs'
import { loadStrings, pickStrings } from '../scripts/strings.mjs'

// 对齐 Pi 的 POSIX read 输入约定;不解析 shell,也不改工具原始参数。
function readPath(path) {
  if (typeof path !== 'string') return path
  path = path.replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ').replace(/^@/, '')
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return join(homedir(), path.slice(2))
  return path.startsWith('file://') ? fileURLToPath(path) : path
}

// 只认 Pi 已声明的输入协议;自定义工具与 PowerShell 不冒充字面 bash。
function tool(event, cwd) {
  if (event.toolName === 'bash') return { kind: 'shell', command: event.input.command, cwd }
  if (event.toolName === 'read') return { kind: 'read', path: readPath(event.input.path), cwd }
  return { kind: 'other', cwd }
}

export default function ddd(pi) {
  // ambient 与 required-child 两条加载路径可相遇;事件总线只属于此运行时。
  const claim = {}
  pi.events.emit('ddd:installation:v1', claim)
  if (claim.installed) return
  pi.events.on('ddd:installation:v1', request => { request.installed = true })
  // 可选宿主接缝:安全扩展仍独占 required-child 注册/释放与启动门控。
  // 没有该 collector 时不假装能自动继承,也不引入 pi-subagents 硬依赖。
  pi.events.on('pi-safety:collect-child-extensions:v1', request => {
    if (!Array.isArray(request?.extensions) || request.extensions.some(entry => entry.id === 'ddd.pi.v1')) return
    request.extensions.push({ id: 'ddd.pi.v1', path: fileURLToPath(new URL('./index.ts', import.meta.url)) })
  })
  // 工厂实例属于一个扩展运行时;不在进程/环境/磁盘保存重试状态。
  let state
  const fresh = ctx => ({ session: ctx.sessionManager.getSessionId(), cwd: ctx.cwd, attempted: false, seen: new Set(), pending: new Map() })
  function scope(ctx) {
    if (!isAbsolute(ctx.cwd)) throw new Error(pickStrings('en').piFailure('cwd'))
    if (!state || state.session !== ctx.sessionManager.getSessionId() || state.cwd !== ctx.cwd) state = fresh(ctx)
    return state
  }
  function table(ctx) {
    const board = detect({ cwd: ctx.cwd, env: {} })
    return board ? loadStrings(board) : pickStrings('zh')
  }
  function unseen(current, key) {
    // 单次输入至多保留 256 个去重键;超额静默,绝不因淘汰又重发。
    if (current.seen.has(key) || current.seen.size >= 256) return false
    current.seen.add(key)
    return true
  }
  function publish(ctx, text) {
    if (!text || !unseen(scope(ctx), text)) return
    pi.sendMessage({ customType: 'ddd', content: text, display: true }, { triggerTurn: false })
  }
  pi.on('session_start', (_event, ctx) => {
    state = fresh(ctx)
    pi.events.emit('subagent:acknowledge-extension', { id: 'ddd.pi.v1' })
  })
  pi.on('session_shutdown', () => { state = undefined })
  // 低层 agent_start/end 可能是恢复或收工修正,不能在那儿重置预算。
  pi.on('before_agent_start', (_event, ctx) => { state = fresh(ctx) })
  // 排队的 steer/followUp 会直接入消息流,不保证经过 before_agent_start。
  pi.on('message_start', (event, ctx) => {
    if (event.message.role === 'user') state = fresh(ctx)
  })
  pi.on('tool_call', (event, ctx) => {
    scope(ctx)
    const result = runHook({ event: 'before-tool', cwd: ctx.cwd, tool: tool(event, ctx.cwd) }, { regenerate: false })
    publish(ctx, [result.notice, result.stderr].filter(Boolean).join('\n'))
    if (result.kind === 'deny-tool') return { block: true, reason: result.reason }
    // none 不是 allow;后续安全扩展仍有否决权,输入不改写。
  })
  const callKey = event => `${event.toolName}\0${event.toolCallId}\0${event.parentToolCallId || ''}`
  pi.on('tool_result', (event, ctx) => {
    // 结果链仍可被后续守卫改成错误;只记候选,绝不修改/包装结果。
    if (event.toolName !== 'bash' || event.isError || (event.structuredContent?.exit_code !== undefined && event.structuredContent.exit_code !== 0)) return
    const current = scope(ctx)
    if (typeof event.input.command !== 'string' || !event.input.command.startsWith('gh pr ') || current.pending.size >= 256) return
    current.pending.set(callKey(event), event.input.command)
  })
  pi.on('tool_execution_end', (event, ctx) => {
    const current = scope(ctx), key = callKey(event), command = current.pending.get(key)
    current.pending.delete(key)
    if (!command || event.isError || event.result?.isError || (event.result?.structuredContent?.exit_code !== undefined && event.result.structuredContent.exit_code !== 0)) return
    const result = runHook({ event: 'after-tool', cwd: ctx.cwd, tool: { kind: 'shell', command, cwd: ctx.cwd } }, { regenerate: false })
    if (!result.additionalContext) return
    const S = table(ctx)
    // 独立上下文消息在 print/RPC 同样有效,不会触发另一个 agent run。
    publish(ctx, /^gh pr merge\b/.test(command) ? S.piRemindMerge : S.piRemind)
  })
  pi.on('agent_before_settle', (event, ctx) => {
    if (event.outcome !== 'completed' || ctx.signal?.aborted) return
    const current = scope(ctx), repeatedStop = current.attempted
    current.attempted = true
    const S = table(ctx)
    let result
    try {
      result = runHook({ event: 'settle', cwd: ctx.cwd, repeatedStop }, { regenerate: false })
    } catch (error) {
      result = { kind: 'failure', reason: S.piFailure(error instanceof Error ? error.message : String(error)) }
    }
    const text = [result.reason, result.notice, result.additionalContext, result.stderr].filter(Boolean).join('\n\n')
    if (!text) return
    const content = text + '\n\n' + S.piReadOnly
    if (!unseen(current, content)) return
    const entries = [...event.entries, { type: 'custom_message', customType: 'ddd', content, display: true }]
    // 插入 custom_message 后 Pi 会重建可运行 context;原 context.canContinue=false
    // (通常末条是 assistant)不是否决条件。只为本次输入请求一次修正。
    const corrective = result.kind === 'block-stop' || result.kind === 'failure'
    return { entries, ...(!repeatedStop && corrective ? { continue: true } : {}) }
  })
}
