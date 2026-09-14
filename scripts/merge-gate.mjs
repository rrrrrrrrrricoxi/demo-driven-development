#!/usr/bin/env node
// 合并前硬闸(Claude Code PreToolUse hook,零依赖)。v0.17.4 §3。
//
// 规矩是「看板只在主线上改、生成物只在主线上生成」。守卫(Stop hook)是收工时的提醒,提醒拦不住
// 一次 `gh pr merge` —— 分支上那几 MB 派生状态一旦合回主线,冲突、静默退版、以及此后每次同步都要
// 花 token 过一遍,都已经发生了。所以在工具调用之前站一道闸:
//
//   - 只对 `^gh pr merge` 出手。别的 Bash 命令零输出、零延迟(连看板都不去探)。
//   - 给了 PR 号就 `gh pr view <n> --json headRefName` 取头分支;没给号就按当前分支。
//     判定跑 board-branch-check 同一份口径(不写第二份实现)。
//   - 命中 → deny,理由列出命中的文件与一行机械解法。
//   - 干净 → 放行,一个字不出。
//   - gh 不在 / 查不到分支 / 任何工具层失败 → 放行并一行说明:闸只拦确定的违规,不拦工具故障。
//
// 放行那一档刻意不返回 permissionDecision: 'allow' —— 'allow' 会替人跳过权限确认,把一道
// 「拦违规」的闸变成「自动批准合并」。放行 = 不作决定,权限流程照常走;要说的话走 systemMessage。
//
// 手测:echo '{"tool_name":"Bash","tool_input":{"command":"gh pr merge 12"}}' | node scripts/merge-gate.mjs
// 接线:hooks/hooks.json → PreToolUse(matcher Bash,timeout 15)
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { loadStrings } from './strings.mjs'
import { boardBranchCheck } from './board-branch-check.mjs'

const MERGE_RE = /^gh\s+pr\s+merge(?:\s|$)/
// ponytail: 只认裸 PR 号与 .../pull/N 形式的选择符;`gh pr merge <branch>` 会退到「当前分支」那一档。
// 要认分支选择符,把第一个非 flag 参数原样交给 gh pr view —— 但那需要一张「带值的 flag」清单,
// 而认错了就是拿错分支下判断。退到当前分支最坏也只是漏拦一次,不会误拦。
const PR_NUM_RE = /^gh\s+pr\s+merge\s+(?:.*?\s)?(?:(\d+)|\S*\/pull\/(\d+))(?:\s|$)/

/** 决策 JSON 的形状按 Claude Code 的 PreToolUse 契约写(写错等于没拦) */
const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }))
  process.exit(0)
}
/** 放行:不作决定(不是 allow),要说的话走 systemMessage */
const pass = (msg) => {
  if (msg) process.stdout.write(JSON.stringify({ systemMessage: msg }))
  process.exit(0)
}

let raw = ''
if (!process.stdin.isTTY) { try { raw = readFileSync(0, 'utf8') } catch {} }
let hook = {}
try { hook = JSON.parse(raw) } catch {}
if (hook.tool_name && hook.tool_name !== 'Bash') process.exit(0)
const cmd = String((hook.tool_input || {}).command || '').trim()
if (!MERGE_RE.test(cmd)) process.exit(0) // 其它命令:零输出、零延迟

const KANBAN = detect()
if (!KANBAN) process.exit(0) // 非 DDD 项目:一个字都不说
const S = loadStrings(KANBAN)
const GEN = join(dirname(fileURLToPath(import.meta.url)), 'gen.mjs')

const git = (args) => {
  const r = spawnSync('git', args, { cwd: KANBAN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })
  return r.error || r.status !== 0 ? null : String(r.stdout)
}

const m = PR_NUM_RE.exec(cmd)
const num = m ? (m[1] || m[2]) : null
let ref = null
if (num) {
  const r = spawnSync('gh', ['pr', 'view', num, '--json', 'headRefName'],
    { cwd: KANBAN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 })
  if (r.error) pass(S.mergeGate.skipped(S.mergeGate.noGh()))
  let head = ''
  if (r.status === 0) { try { head = String(JSON.parse(r.stdout || '{}').headRefName || '').trim() } catch {} }
  if (!head) pass(S.mergeGate.skipped(S.mergeGate.ghFailed(num)))
  // 本地没有那条分支就退到 origin/<分支>(平时的克隆只 fetch 过远端,本地并没有 PR 的头分支)
  const local = git(['rev-parse', '--verify', '--quiet', head]) !== null ? head
    : git(['rev-parse', '--verify', '--quiet', `origin/${head}`]) !== null ? `origin/${head}` : null
  if (!local) pass(S.mergeGate.skipped(S.mergeGate.noRef(head)))
  ref = local
}

const r = boardBranchCheck(KANBAN, S, ref ? { refs: [ref] } : {})
if (r.skip) pass(S.mergeGate.skipped(r.skip))
if (!r.hits.length) process.exit(0) // 干净:放行,不出声
deny(r.hits.map((h) => S.mergeGate.deny(h.ref, h, r.main, r.prefix || 'app/kanban/', GEN, KANBAN)).join('\n\n'))
