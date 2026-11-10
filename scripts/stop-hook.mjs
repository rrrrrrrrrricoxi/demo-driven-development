#!/usr/bin/env node
// Legacy Claude-compatible Stop entry point. Other runtimes never use Claude caches.
import { checkSettlement } from './hook-settle.mjs'
import { forwardClaudeStop } from './claude-forward.mjs'
import { normalizeHook, readHookInput, writeHookResult } from './hook-protocol.mjs'

const { raw, hook } = readHookInput()
const runtime = process.env.DDD_RUNTIME || 'claude'
const request = normalizeHook(hook, { event: 'settle', runtime })
const forwarded = forwardClaudeStop(request, raw)
if (forwarded) {
  if (forwarded.stderr) process.stderr.write(forwarded.stderr)
  if (forwarded.stdout) process.stdout.write(forwarded.stdout)
  process.exitCode = forwarded.exitCode
} else {
  writeHookResult(checkSettlement(request, { regenerate: true }))
}
