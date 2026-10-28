#!/usr/bin/env node
// 合并前硬闸入口。只对确定的看板分支违规返回 deny;工具故障返回提醒。
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkMerge } from './hook-tool-rules.mjs'
import { normalizeHook, readHookInput, writeHookResult } from './hook-protocol.mjs'

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { hook } = readHookInput()
  const request = normalizeHook(hook, { event: 'before-tool', runtime: process.env.DDD_RUNTIME || 'claude' })
  // 旧入口只认 command;Codex 的 cmd 别名由其统一入口规范化。
  request.tool.command = String(hook.tool_input?.command || '')
  writeHookResult(checkMerge(request))
}
