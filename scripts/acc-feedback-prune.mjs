#!/usr/bin/env node
// 验收反馈截图的清理(v0.17.0,config.acceptanceFeedback 那套的收尾)。
//
// 反馈截图落在 <看板>/shots/acc-<PR>-<条目>-<UTC 时刻>.jpg,默认不进 git(见 README 的
// `app/kanban/shots/acc-*` 那行);它们是验收现场的证物,PR 合进去、放上一段时间之后就没人再看。
// 本脚本按「对应 PR 已合并,且合并日超过 N 天」删图 —— 判据取 release-manifest.json 的 mergedAt,
// 不联网、不看文件时间(文件时间会被 rsync / 拷贝改掉,合并日不会)。
//
//   node acc-feedback-prune.mjs --dir app/kanban            # 删(默认 30 天)
//   node acc-feedback-prune.mjs --dir app/kanban --dry-run  # 只列,不动盘
//   node acc-feedback-prune.mjs --days 60                   # 换窗口
//
// 不动的东西:acceptance-feedback.jsonl 一行不删(账要留;图没了那行照旧读得到「谁说了什么」),
// 非 acc- 前缀的截图一张不碰(那些是卡上 shots 字段的证据,进 git 的),PR 还开着 / 清单外的图不删。
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { daysBetween, localDate } from './cards.mjs'
import { resolveKanbanDir } from './kanban-dir.mjs'

/** 默认窗口:PR 合并满这么多天的反馈截图算「可清」;守卫那条提示与本脚本同一把尺 */
export const ACC_FB_PRUNE_DAYS = 30
/** 守卫只在攒够这么多张时才说一行(说得太早比不说更烦) */
export const ACC_FB_PRUNE_MIN = 10

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const DAYS = (() => {
  const i = argv.indexOf('--days')
  if (i < 0) return ACC_FB_PRUNE_DAYS
  const n = Number(argv[i + 1])
  if (!Number.isFinite(n) || n < 0) {
    console.error('[acc-prune] --days 需要一个 ≥ 0 的天数')
    process.exit(1)
  }
  return n
})()

/** shots/ 里的反馈截图 → PR 号(认不出 PR 的一律不碰) */
const accShotPr = (file) => {
  const m = /^acc-(\d+)-.+\.(?:jpg|png)$/.exec(file)
  return m ? Number(m[1]) : null
}

/** PR 号 → 合并日(YYYY-MM-DD);没合 / 没这条记录 = 表里没有它 */
const mergedDays = (rlm) => {
  const out = new Map()
  for (const p of (rlm && rlm.prs) || []) {
    if (!p || p.number == null || !p.mergedAt) continue
    out.set(Number(p.number), String(p.mergedAt).slice(0, 10))
  }
  return out
}

/** 可删清单:PR 已合 + 合并日满 days 天。纯函数,守卫与本脚本共用同一把尺。 */
export function prunable(files, rlm, days, today) {
  const merged = mergedDays(rlm)
  const out = []
  for (const f of files) {
    const pr = accShotPr(f)
    if (pr == null) continue
    const at = merged.get(pr)
    if (!at) continue // 还开着 / 关了没合 / manifest 里没有它 —— 都不算「过期」
    const age = daysBetween(at, today)
    if (Number.isFinite(age) && age >= days) out.push({ file: f, pr, at, age })
  }
  return out.sort((a, z) => (a.pr - z.pr) || (a.file < z.file ? -1 : 1))
}

// 直接跑才动盘;被 import(测试用纯函数)时上面几个导出就是全部
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const KANBAN = resolveKanbanDir(argv)
  const SHOTS = join(KANBAN, 'shots')
  let rlm = null
  const relPath = join(KANBAN, 'release-manifest.json')
  if (existsSync(relPath)) {
    try { rlm = JSON.parse(readFileSync(relPath, 'utf8')) }
    catch (e) { console.error(`[acc-prune] release-manifest.json 不是合法 JSON:${e.message}`); process.exit(1) }
  }
  if (!rlm) {
    console.error(`[acc-prune] ${relPath} 不在 —— 合并日是唯一判据,没有它一张都不敢删`)
    process.exit(1)
  }
  let files = []
  try { files = readdirSync(SHOTS).filter((f) => f.startsWith('acc-')) } catch {}
  // 「今天」取本地日历日 —— 守卫那头是 localDate(),两边差一天就会出现「守卫说 11 张、
  // 这条命令删 10 张」(UTC+8 的每天 00:00–08:00 都撞得上)。同一把尺,就一把。
  const today = localDate()
  const rows = prunable(files, rlm, DAYS, today)
  if (!rows.length) {
    console.log(`[acc-prune] 没有可清的反馈截图(shots/ 里 ${files.length} 张 acc-*,判据:PR 已合并满 ${DAYS} 天)`)
    process.exit(0)
  }
  let bytes = 0
  for (const r of rows) { // 一趟走完:先记大小(删了就问不出来了)、报一行、再动盘
    try { bytes += statSync(join(SHOTS, r.file)).size } catch {}
    console.log(`  ${DRY ? '将删' : '已删'} shots/${r.file}(#${r.pr} 合于 ${r.at},${r.age} 天前)`)
    if (!DRY) rmSync(join(SHOTS, r.file), { force: true })
  }
  console.log(`[acc-prune] ${DRY ? '将删' : '已删'} ${rows.length} 张 · ${(bytes / 1024).toFixed(0)}KB` +
    `(判据:PR 已合并满 ${DAYS} 天,合并日取 release-manifest)${DRY ? ' —— dry-run,盘上一个字节没动' : ''}`)
  console.log('[acc-prune] acceptance-feedback.jsonl 一行未删 —— 图没了,那几行「谁说了什么」照旧在。')
}
