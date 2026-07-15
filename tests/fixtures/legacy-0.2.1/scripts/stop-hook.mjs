#!/usr/bin/env node
// 看板守卫(Claude Code Stop hook,零依赖)。CC 每次收工前自动运行,做两件事:
//
//   1. 新鲜度:manifest / demos/*.html / gen.mjs 任一比 index.html 新
//      → 自动重跑 gen.mjs,看板即刻最新,无需人发「更新看板」prompt。
//      (plugin 期:gen.mjs 与本脚本同目录;尚未落地时跳过本段,只做审计。)
//   2. 审计:demos/*.html 凡未被任何 *.json manifest 引用、且不在 demos/.no-card-ok
//      豁免名单(一行一个文件名)的,即「孤儿 demo」→ 阻断收工,要求当场补卡。
//      防死循环:同一次收工最多拦一次(stop_hook_active 时只警告并放行)。
//
// plugin 化改造(设计 §6):
//   - 反向探测:detect() 找不到 kanban.config.json → 静默 exit 0(非 DDD 项目零打扰)。
//   - 看板目录有 .init-lock(kanban-init --apply 进行中)→ 放行本轮。
//   - 消息文案走 strings.mjs(zh/en,按 config.lang 选)。
//
// 手测:echo '{}' | node scripts/stop-hook.mjs
// 接线:hooks/hooks.json → Stop
// ponytail: 新鲜度只盯 manifest/demos/gen.mjs 自身,不追 gen 引用的全仓 docs/*.md;
// 纯文档改动导致的 refs/ 过期仍需人跑 gen——要堵再解析 REF_DOCS。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { loadStrings } from './strings.mjs'

const KANBAN = detect()
if (!KANBAN) process.exit(0)
if (existsSync(join(KANBAN, '.init-lock'))) process.exit(0)

const S = loadStrings(KANBAN)
const DEMOS = join(KANBAN, 'demos')
const GEN = join(dirname(fileURLToPath(import.meta.url)), 'gen.mjs')

let hook = {}
if (!process.stdin.isTTY) {
  try { hook = JSON.parse(readFileSync(0, 'utf8')) } catch {}
}

const mtime = (p) => { try { return statSync(p).mtimeMs } catch { return 0 } }
const manifests = readdirSync(KANBAN).filter((f) => f.endsWith('.json'))
let demos = []
try { demos = readdirSync(DEMOS).filter((f) => f.endsWith('.html')) } catch {}

// ---- ① 新鲜度 → 自动重跑 gen(gen.mjs 未随 plugin 落地时跳过) ----
if (existsSync(GEN)) {
  const indexAt = mtime(join(KANBAN, 'index.html'))
  const newest = Math.max(
    mtime(GEN),
    ...manifests.map((f) => mtime(join(KANBAN, f))),
    ...demos.map((f) => mtime(join(DEMOS, f))),
  )
  if (newest > indexAt) {
    try {
      execFileSync(process.execPath, [GEN], { cwd: KANBAN, stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (e) {
      const err = (e.stderr || e.message || '').toString().slice(0, 800)
      process.stderr.write(S.genFail(err))
      process.exit(2) // 阻断:stderr 喂回给 Claude 自修
    }
  }
}

// ---- ② 孤儿 demo 审计 ----
const corpus = manifests
  .map((f) => { try { return readFileSync(join(KANBAN, f), 'utf8') } catch { return '' } })
  .join('\n')
let allow = []
try {
  allow = readFileSync(join(DEMOS, '.no-card-ok'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
} catch {}
const orphans = demos.filter((f) => !corpus.includes(f) && !allow.includes(f))

if (orphans.length === 0) process.exit(0)

const list = orphans.map((f) => `  - app/kanban/demos/${f}`).join('\n')
if (hook.stop_hook_active) {
  console.log(JSON.stringify({ systemMessage: S.orphanWarn(orphans.length, list) }))
  process.exit(0)
}
console.log(JSON.stringify({ decision: 'block', reason: S.orphanBlock(orphans.length, list) }))
