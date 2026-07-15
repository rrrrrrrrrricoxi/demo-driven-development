#!/usr/bin/env node
// 看板守卫(Claude Code Stop hook,零依赖)。CC 每次收工前自动运行,做两件事:
//
//   1. 新鲜度:manifest / demos/*.html / theme.css(v0.4.0 换装,可缺席)/ gen.mjs
//      任一比 index.html 新 → 自动重跑 gen.mjs,看板即刻最新,无需人发「更新看板」prompt。
//      (plugin 期:gen.mjs 与本脚本同目录;尚未落地时跳过本段,只做审计。)
//      v0.6.0 起叠加版本戳维度(防旧版盖板):mtime 分不出「谁写的」——旧版 session 的旧 gen 盖完板
//      产物反而最新。戳缺失/低于本 plugin 版 = 旧 gen 产物 → 视为过期重跑(自愈,与 mtime OR);
//      戳高于本 plugin 版 = 本 session 才是旧的 → 一票否决重生成(含 mtime 判过期),出警告但
//      绝不 exit 2——「重启我自己」是 Claude 修不了的状态,阻断只会造死循环。审计(只读)照做。
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
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { cmpVer, readPluginVersion, readStamp } from './lib-version.mjs'
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

// 非阻断通知(戳警告 / 安装异常 / 自愈提示),最终与审计结果合并成单条 JSON 输出
const notices = []

// ---- ① 新鲜度 → 自动重跑 gen(gen.mjs 未随 plugin 落地时跳过) ----
if (existsSync(GEN)) {
  const indexPath = join(KANBAN, 'index.html')
  const indexAt = mtime(indexPath)
  const newest = Math.max(
    mtime(GEN),
    mtime(join(KANBAN, 'theme.css')), // v0.4.0 换装:theme 是 gen 输入;缺席时 mtime=0,零影响
    ...manifests.map((f) => mtime(join(KANBAN, f))),
    ...demos.map((f) => mtime(join(DEMOS, f))),
  )
  const myVer = readPluginVersion() // null = 安装异常(plugin.json 缺失/损坏/非纯数字版本)
  const stamp = readStamp(indexPath) // 版本串 | null(有产物无戳=旧 gen 产物)| undefined(无产物,首跑)
  const stampNewer = Boolean(myVer && stamp && cmpVer(stamp, myVer) > 0)
  const stampStale = Boolean(myVer && stamp !== undefined && (stamp === null || cmpVer(stamp, myVer) < 0))
  if (stampNewer) {
    notices.push(S.stampNewer(stamp, myVer)) // 只否决重生成;审计(只读)在下面照做
  } else if (!myVer) {
    // gen 读不到自身版本必硬失败——别 spawn 一个注定 exit 2 的 gen 造不可自修的阻断循环
    if (newest > indexAt) notices.push(S.noSelfVersion())
  } else if (newest > indexAt || stampStale) {
    const r = spawnSync(process.execPath, [GEN], { cwd: KANBAN, stdio: ['ignore', 'ignore', 'pipe'] })
    const err = (r.stderr || r.error?.message || '').toString()
    if (r.status !== 0) {
      if (hook.stop_hook_active) { // 防死循环:同一次收工已拦过 → 降级警告放行
        console.log(JSON.stringify({ systemMessage: S.genFail(err.slice(0, 800)) }))
        process.exit(0)
      }
      process.stderr.write(S.genFail(err.slice(0, 800)))
      process.exit(2) // 阻断:stderr 喂回给 Claude 自修(manifest 语法错等可修项)
    }
    // gen 成功但带警告(themeColors 未知色组/键、sessionTags 灰章、空 theme.css、指南过大、md 退化…)→ 原样透传,别吞
    if (err.trim()) process.stderr.write(err)
    // 自愈自「无戳产物」= 刚被旧 gen 盖过板(或 0.6.0 前存量)的签名 → 现场指向断火源解药
    if (stampStale && stamp === null) notices.push(S.healedUnstamped())
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

if (orphans.length === 0) {
  if (notices.length) console.log(JSON.stringify({ systemMessage: notices.join('\n') }))
  process.exit(0)
}

const list = orphans.map((f) => `  - app/kanban/demos/${f}`).join('\n')
if (hook.stop_hook_active) {
  console.log(JSON.stringify({ systemMessage: [S.orphanWarn(orphans.length, list), ...notices].join('\n') }))
  process.exit(0)
}
console.log(JSON.stringify({
  decision: 'block',
  reason: S.orphanBlock(orphans.length, list),
  ...(notices.length ? { systemMessage: notices.join('\n') } : {}),
}))
