// 卡片前置依赖 `after`(v0.16.0)。「这张卡要等 X 清掉才能动」以前只能写成散文(blockedOn 里
// 一句「等 #266 合」),守卫核不动、WIP 也照数不误;现在它是一个结构化字段,清没清由已提交的
// 事实推导出来 —— gen(卡头 chip / 反向 chip / WIP 口径)、ddd CLI(写与校验)、守卫(前置已清
// 那一行)import 同一份口径。三处各写一遍就是三套账,那是 BL-C112 的教训。
//
//   "after": ["BL-C74", "D89", "#266", "owner/repo#12", "v0.0.5"]
//
// 四种 ref 与它们的清除判据(全部取自已提交的事实,不读时钟 —— gen 零时间是硬纪律):
//
//   卡(backlog / 决策)   status ∈ TERMINAL(done / live / closed,沿用 settle.mjs)  清除日 = 卡文件最后改动日
//   PR(#N / owner/repo#N) release-manifest 的 prs[] 里该号 state === 'merged'        清除日 = mergedAt
//   版本 tag(v 开头)      release-manifest 的 releases[] 里有这个 tag                清除日 = at
//
// PR / 版本还没出现在 release-manifest 里 = 未清,不报错(它们本来就是「还没发生」);
// 未知卡号是错(与「文件名≠id」同级),自指与环也是错 —— CLI 拒写、gen 硬报错。
//
// 顶层无副作用,可直接 import。`blockedOn`(自由文本,给「等人 / 等外部」用)不动、不迁移。
import { TERMINAL } from './settle.mjs'

/** 守卫那行「前置已清」的新鲜窗口(天)。gen 不认这个数 —— 它不读时钟,窗口只在守卫里。 */
export const DEPS_FRESH_DAYS = 7

/** 反向 chip 面上最多列几个卡号,多的折成「+N」(全列在 title 里) */
export const DEPS_UNLOCK_SHOW = 3

const CROSS_RE = /^([\w.-]+\/[\w.-]+)#(\d+)$/
const NUM_RE = /^#?(\d+)$/

/**
 * 一条 ref 的形制判定。三种写法互不重叠,靠语法分,不靠「板上查得到就算卡号」——
 * 后者会把打错的卡号(BL-C740)静默降级成一个「还没发生的版本」,而未知卡号本该硬报错。
 *   PR   #266 / 266 / owner/repo#12   (语法同 `pr` 字段)
 *   版本 v 开头且紧跟数字             (语法同 releases[].tag)
 *   卡号 其余(不许带空白与路径分隔符)
 * @returns { kind: 'pr'|'tag'|'card', raw, ref, num?, repo?, tag?, id? } | null(形制不合法)
 */
export function parseAfterRef(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const cross = s.match(CROSS_RE)
  if (cross) return { kind: 'pr', raw: s, ref: s, repo: cross[1], num: Number(cross[2]) }
  const num = s.match(NUM_RE)
  if (num) {
    const n = Number(num[1])
    return n > 0 ? { kind: 'pr', raw: s, ref: `#${n}`, repo: '', num: n } : null
  }
  if (/^v\d/.test(s)) return { kind: 'tag', raw: s, ref: s, tag: s }
  if (/[\s/\\]/.test(s)) return null
  return { kind: 'card', raw: s, ref: s, id: s }
}

/** 卡上的 after:去重、去空、保留书写顺序(顺序即显示顺序);不是数组 = 没写 */
export function afterOf(card) {
  const raw = card && card.after
  if (!Array.isArray(raw)) return []
  const out = [], seen = new Set()
  for (const v of raw) {
    const s = String(v ?? '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/**
 * 一条 ref 的当前状态。
 * @param ctx { repo, cardById: Map<id, card>, cardUpd: (id) => 'YYYY-MM-DD'|'', relPr: Map<num, prRecord>, relTag: Map<tag, at> }
 * @returns { kind, raw, ref, cleared, at, unknown? } —— at = 清除日('' = 没清 / 不知道)
 */
export function resolveAfter(raw, ctx = {}) {
  const p = parseAfterRef(raw)
  if (!p) return { kind: 'bad', raw: String(raw ?? ''), ref: String(raw ?? ''), cleared: false, at: '', unknown: true }
  if (p.kind === 'card') {
    const c = ctx.cardById && ctx.cardById.get(p.id)
    if (!c) return { ...p, cleared: false, at: '', unknown: true }
    const cleared = TERMINAL.has(String(c.status || ''))
    return { ...p, cleared, at: cleared && ctx.cardUpd ? String(ctx.cardUpd(p.id) || '') : '' }
  }
  if (p.kind === 'pr') {
    // 跨仓 PR 的状态不在这份 manifest 里 —— 不知道就算「还没清」(与 settleOf 的「不知道就不判」
    // 不同:那边判的是「催不催人」,这边判的是「能不能开工」,缺数据时保守的方向正好相反)。
    const own = !p.repo || (ctx.repo && p.repo === ctx.repo)
    const r = own && ctx.relPr ? ctx.relPr.get(p.num) : null
    const cleared = Boolean(r && String(r.state) === 'merged')
    return { ...p, cleared, at: cleared ? String(r.mergedAt || '').slice(0, 10) : '' }
  }
  const at = ctx.relTag ? ctx.relTag.get(p.tag) : undefined
  return { ...p, cleared: at !== undefined, at: at ? String(at).slice(0, 10) : '' }
}

/** 一张卡的全部前置(顺序即书写顺序) */
export const afterStates = (card, ctx) => afterOf(card).map((r) => resolveAfter(r, ctx))

/** 还没清的项数(0 = 全清;没写 after 也是 0) */
export const openCount = (list) => list.filter((r) => !r.cleared).length

/** 全清之后的「前置已清日」= 各项清除日的最大值;取不到任何一个日期时为 ''(不硬编一个假日期) */
export function clearedAt(list) {
  let max = ''
  for (const r of list) if (r.at && r.at > max) max = r.at
  return max
}

/** 状态词(zh)。en 表在 strings.mjs 里另译,格式化函数共用下面两个 —— 一份实现,两种语言。 */
export const DEP_WORDS_ZH = { card: ['已收', '未收'], pr: ['已合', '开着'], tag: ['已发', '未发'], bad: ['', '写错了'] }

/** 逐项长形(芯片 title / CLI card show):「✓ BL-C74 已收 09-04」「#266 开着」 */
export function depItemText(r, words = DEP_WORDS_ZH) {
  const w = (words[r.kind] || words.bad)[r.cleared ? 0 : 1]
  return r.cleared ? `✓ ${r.ref} ${w}${r.at ? ` ${r.at.slice(5)}` : ''}` : `${r.ref} ${w}`
}

/** 逐项短形(守卫那一行的括号里):「#266 已合」—— 不带勾也不带日期,一行装得下 */
export function depItemShort(r, words = DEP_WORDS_ZH) {
  return `${r.ref} ${(words[r.kind] || words.bad)[r.cleared ? 0 : 1]}`
}

/** 环:DFS 三色,按 edges 的插入序走,同一块板每次给同一条环(gen 的报错要可复现) */
function findCycle(edges) {
  const state = new Map() // 1 = 在栈上,2 = 走完了
  const stack = []
  let hit = null
  const walk = (id) => {
    if (hit) return
    const st = state.get(id)
    if (st === 2) return
    if (st === 1) { hit = [...stack.slice(stack.indexOf(id)), id]; return }
    state.set(id, 1)
    stack.push(id)
    for (const nx of edges.get(id) || []) { walk(nx); if (hit) return }
    stack.pop()
    state.set(id, 2)
  }
  for (const id of edges.keys()) { walk(id); if (hit) return hit }
  return null
}

/**
 * 全板校验。gen 拿它硬报错,CLI 拿它在写之前拦下。
 * @param cards 全板卡(三种都算:反向 chip 与环都以 id 为键,不分卡种)
 * @returns { unknown: [{ id, ref }], cycle: [id…] | null } —— cycle 首尾同号,可直接 join(' → ')
 */
export function auditAfter(cards) {
  const byId = new Map()
  for (const c of cards) if (c && c.id != null) byId.set(String(c.id), c)
  const unknown = []
  const edges = new Map()
  for (const c of cards) {
    const id = String((c && c.id) ?? '')
    const outs = []
    for (const raw of afterOf(c)) {
      const p = parseAfterRef(raw)
      if (!p) { unknown.push({ id, ref: raw }); continue }
      if (p.kind !== 'card') continue
      if (!byId.has(p.id)) { unknown.push({ id, ref: raw }); continue }
      outs.push(p.id)
    }
    edges.set(id, outs)
  }
  return { unknown, cycle: findCycle(edges) }
}

/**
 * 反查:被谁 after 指着。
 * @returns Map<被依赖卡号, [依赖它的卡号…]>(值按全板卡序,与显示序一致)
 */
export function reverseAfter(cards) {
  const out = new Map()
  for (const c of cards) {
    const id = String((c && c.id) ?? '')
    for (const raw of afterOf(c)) {
      const p = parseAfterRef(raw)
      if (!p || p.kind !== 'card') continue
      if (!out.has(p.id)) out.set(p.id, [])
      const list = out.get(p.id)
      if (!list.includes(id)) list.push(id)
    }
  }
  return out
}
