#!/usr/bin/env node
// gh pr 运行后注入看板上下文;合并完成时使用收账提醒。
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { remindPullRequest } from './hook-tool-rules.mjs'
import { normalizeHook, readHookInput, writeHookResult } from './hook-protocol.mjs'

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { hook } = readHookInput()
  const request = normalizeHook(hook, { event: 'after-tool', runtime: process.env.DDD_RUNTIME || 'claude' })
  // 旧入口只检查命令,不限制工具名。
  request.tool.command = hook.tool_input?.command ?? ''
  writeHookResult(remindPullRequest(request))
}
