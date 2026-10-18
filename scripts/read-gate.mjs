#!/usr/bin/env node
// Claude/Codex 读闸入口。字面路径检查共用宿主无关的工具规则。
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkGeneratedRead, generatedReads as ruleGeneratedReads } from './hook-tool-rules.mjs'
import { normalizeHook, readHookInput, writeHookResult } from './hook-protocol.mjs'

// 保留旧调用接口;新调用方直接传规范请求给工具规则。
export function generatedReads(hook, kanban) {
  return ruleGeneratedReads(normalizeHook(hook, { event: 'before-tool' }), kanban)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { hook } = readHookInput()
  const request = normalizeHook(hook, { event: 'before-tool', runtime: process.env.DDD_RUNTIME || 'claude' })
  writeHookResult(checkGeneratedRead(request))
}
