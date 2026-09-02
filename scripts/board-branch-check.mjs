#!/usr/bin/env node
// 看板改动落在哪条分支上(v0.15.14,BL-C112 §1)。规矩是「看板只在主线上改」,这里是合并前的一眼。
//
//   node scripts/board-branch-check.mjs [--dir <kanbanDir>] [--branch <ref>] [--all] [--json] [--strict]
//
// 为什么要有:feature 分支带着看板改动合回主线,会撞上两类事故 ——
//   1. 一卡一文件(v0.14.0)之前分叉的分支,身上还带着头文件里的 items / entries 数组:合回来
//      git 会把它当「分支新增的一段」原样放回去,gen 立刻硬报错(cards.mjs 的「一个真源」)。
//      那道硬报错是事后兜底 —— 报出来的时候主线上已经脏了,这里是「合并之前就知道」。
//   2. 分支上那份卡是分叉当时的旧快照,而主线上的卡一直在往前走:合并把旧的盖回新的,
//      整份数组重写,git 不报冲突,看板静默退版 —— 这一类连硬报错都没有。
// 所以规则(A)与检查(B)是一对:规则说清「在哪改」,脚本在合并前把违规的分支指出来。
// 不做自动修复:分支上那份是旧快照,自动拆回 cards/ 等于拿旧数据静默覆盖新数据。
//
// 出声纪律:零命中完全不说话(守卫里那条尤其 —— 提示多了会被无视)。
// 退出码:默认恒 0(它是提醒不是闸);--strict 才在命中时 exit 1,给 CI 当门用。
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { resolveKanbanDir } from './kanban-dir.mjs'
import { loadStrings } from './strings.mjs'
import { CARD_KINDS, cardsDirOf } from './cards.mjs'

/** 看板里的数据文件:一改就是「板变了」。产物另算(见 GEN_RE),demo / 文档等归「其它」。 */
const dataRe = (cardsDir) => new RegExp(`(?:^|/)(?:${cardsDir ? `${cardsDir}/.+\\.json|` : ''}[a-z-]*manifest\\.json|kanban\\.config\\.json)$`)
const GEN_RE = /(?:^|\/)(?:index\.html|shots\.html|parts\/|refs\/)/

const git = (cwd, args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return r.error || r.status !== 0 ? null : String(r.stdout)
}

/**
 * 一条分支相对主线带了哪些看板改动。
 * @returns { ref, data[], gen[], other[], hazard[] } | null(这条分支没有看板改动)
 *          hazard = 头文件里带回了 items / entries 的那几个文件(第 1 类事故,gen 会硬报错)
 */
export function branchFindings({ kanbanDir, prefix, main, ref, cardsDir }) {
  // pathspec 相对 cwd(就是看板目录),所以是 '.';--name-only 吐的路径仍相对仓根,分类正则按此写
  const out = git(kanbanDir, ['diff', '--name-only', `${main}...${ref}`, '--', '.'])
  if (out === null) return null
  const files = out.split('\n').map((s) => s.trim()).filter(Boolean)
  if (!files.length) return null
  const data = [], gen = [], other = []
  const DATA_RE = dataRe(cardsDir)
  for (const f of files) (DATA_RE.test(f) ? data : GEN_RE.test(f) ? gen : other).push(f)
  // 第 1 类事故只在这块板已经拆过卡时才成立;且只有头文件本身进了 diff 才可能带回数组
  const hazard = []
  if (cardsDir) {
    for (const k of CARD_KINDS) {
      const path = `${prefix}${k.manifest}`
      if (!files.includes(path)) continue
      const text = git(kanbanDir, ['show', `${ref}:${path}`])
      if (text === null) continue
      let head = null
      try { head = JSON.parse(text) } catch { continue } // 坏 JSON 是另一回事,gen / 守卫各有其话
      if (head && head[k.key] !== undefined) hazard.push({ file: path, key: k.key, n: (head[k.key] || []).length })
    }
  }
  return { ref, data, gen, other, hazard }
}

/**
 * 这块板的检查现场。git 不可用 / 板不在仓里 / 找不到主线 → { skip: <说明> },调用方自己决定说不说。
 * @param refs 要比的分支;缺省 = 当前分支(HEAD)
 */
export function boardBranchCheck(kanbanDir, S, { refs = null, all = false } = {}) {
  const head = git(kanbanDir, ['rev-parse', '--abbrev-ref', 'HEAD', '--show-prefix'])
  if (head === null) return { skip: S.boardBranch.noGit() }
  const [cur, rawPrefix = ''] = head.split('\n')
  const prefix = rawPrefix.trim() // 看板目录相对仓根;仓根就是看板目录时为空串
  let cfg = {}
  try { cfg = JSON.parse(readFileSync(`${kanbanDir}/kanban.config.json`, 'utf8')) } catch {}
  let cardsDir = ''
  try { cardsDir = cardsDirOf(cfg) } catch {}
  // 主线名取 instance.branch(三份 manifest 里第一个非空),没写就按 main
  let main = ''
  for (const k of ['manifest.json', ...CARD_KINDS.map((x) => x.manifest)]) {
    if (main) break
    try { main = String((JSON.parse(readFileSync(`${kanbanDir}/${k}`, 'utf8')).instance || {}).branch || '').trim() } catch {}
  }
  main = main || 'main'
  // 本地没有主线分支就退到 origin/<main>(worktree / 只 fetch 过远端的克隆都是这样)
  const mainRef = git(kanbanDir, ['rev-parse', '--verify', '--quiet', main]) !== null ? main
    : git(kanbanDir, ['rev-parse', '--verify', '--quiet', `origin/${main}`]) !== null ? `origin/${main}` : ''
  if (!mainRef) return { skip: S.boardBranch.noMain(main) }
  let list = refs
  if (!list) {
    list = all
      ? (git(kanbanDir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes']) || '')
        .split('\n').map((s) => s.trim()).filter(Boolean).filter((r) => !/(?:^|\/)HEAD$/.test(r))
      : [cur]
  }
  list = list.filter((r) => r !== main && r !== `origin/${main}` && r !== 'HEAD')
  const hits = []
  for (const ref of list) {
    const f = branchFindings({ kanbanDir, prefix, main: mainRef, ref, cardsDir })
    if (f) hits.push(f)
  }
  return { main: mainRef, prefix, scanned: list.length, hits }
}

// ---- CLI(被 import 时不跑:守卫也读这份口径)----
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ARGV = process.argv.slice(2)
  const flag = (n) => ARGV.includes(`--${n}`)
  const val = (n) => {
    const i = ARGV.findIndex((a) => a === `--${n}` || a.startsWith(`--${n}=`))
    return i < 0 ? null : ARGV[i].startsWith(`--${n}=`) ? ARGV[i].slice(n.length + 3) : ARGV[i + 1]
  }
  let KANBAN
  try { KANBAN = resolveKanbanDir() } catch (e) { console.error(e.message); process.exit(1) }
  if (!existsSync(KANBAN)) { console.error(`board-branch-check: ${KANBAN} 不在`); process.exit(1) }
  const S = loadStrings(KANBAN)
  const one = val('branch')
  const r = boardBranchCheck(KANBAN, S, { refs: one ? [one] : null, all: flag('all') })
  if (flag('json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exit(flag('strict') && r.hits && r.hits.length ? 1 : 0)
  }
  if (r.skip) { console.log(r.skip); process.exit(0) }
  if (!r.hits.length) { console.log(r.scanned ? S.boardBranch.clean(r.scanned, r.main) : S.boardBranch.onMain(r.main)); process.exit(0) }
  console.log(S.boardBranch.head(r.hits.length, r.main))
  for (const h of r.hits) console.log(S.boardBranch.row(h))
  console.log(S.boardBranch.rule(r.prefix || 'app/kanban/', r.main))
  process.exit(flag('strict') ? 1 : 0)
}
