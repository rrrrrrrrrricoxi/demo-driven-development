#!/usr/bin/env node
// gh-pr 看板提醒(PostToolUse / matcher: Bash,零依赖)。语义同首宿主接管前的 jq 版:
// gh pr 命令跑完后,注入一条「若这标志阶段完成,检查看板卡状态是否需推进」的上下文。
//
// plugin 化改造(设计 §6-3):
//   - matcher 只能匹配工具名(Bash),「只在 gh pr 命令后提醒」的收窄在本脚本内做:
//     stdin JSON 的 tool_input.command 不以 "gh pr " 开头 → 静默 exit 0。
//   - 反向探测同守卫(共用 lib-detect):非 DDD 项目跑 gh pr 零打扰(验收 A4-③)。
//
// 手测:echo '{"tool_input":{"command":"gh pr view 1"}}' | node scripts/ghpr-remind.mjs
// 接线:hooks/hooks.json → PostToolUse
import { readFileSync } from 'node:fs'
import { detect } from './lib-detect.mjs'
import { loadStrings } from './strings.mjs'

let hook = {}
if (!process.stdin.isTTY) {
  try { hook = JSON.parse(readFileSync(0, 'utf8')) } catch {}
}
const cmd = hook?.tool_input?.command ?? ''
if (!cmd.startsWith('gh pr ')) process.exit(0) // 先验命令,免得每条 Bash 都起 git 子进程

const KANBAN = detect()
if (!KANBAN) process.exit(0)

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: loadStrings(KANBAN).ghprRemind,
  },
}))
