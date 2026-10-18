#!/usr/bin/env node
// Codex input/output adapter. No Claude installation lookup or process env mutation.
import { runHook } from './hook-core.mjs'
import { normalizeHook, readHookInput, writeHookResult } from './hook-protocol.mjs'

const { hook } = readHookInput()
const request = normalizeHook(hook, { event: process.argv[2], runtime: 'codex' })
writeHookResult(runHook(request, { regenerate: true }))
