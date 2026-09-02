// 进度响应的三个判定(v0.13.0)。卡的 status 与它的 PR 实际状态对不上时,看板要出声。
// 纯函数、顶层无副作用 —— gen(芯片 / 待收账段)、守卫、pr-sync --settle 三处 import 同一份口径。
//
//   settle   所有关联 PR 已合(或已发),卡却还没收账      → 卡头琥珀芯片「PR 已合 · 待收账」
//   reopen   卡已在终态,却还有关联 PR 开着(含草稿)      → 卡头芯片「已收账但 PR 未合」
//   (部分合并不算 settle:2/3 已合是正常进行时,渲染层另说)
//
// 终态按卡种分:backlog / 进度卡 done,决策卡 live(已落地)或 closed(不做 / 归档)。三种卡的
// status 取值不重叠(backlog 无 live/closed、决策无 done),所以一个并集就够,不必让调用方报卡种。
//
// 判定只认「本仓 + release-manifest 里有记录」的 PR:跨仓 PR 的状态不在这份 manifest 里,
// 没同步过的号也一样 —— 不知道就不判,别拿缺数据当「还开着」去催人。

/** 三种卡的终态并集(pr-sync 建议 status 时按卡种各取一个,见 KIND_TERMINAL) */
export const TERMINAL = new Set(['done', 'live', 'closed'])

/** 卡种 → 收账时该落的 status(pr-sync --settle 的建议值) */
export const KIND_TERMINAL = { tasks: 'done', items: 'done', entries: 'live' }

/**
 * 卡 × PR 集合 → 不一致判定。
 * @param card    卡对象(只读 status)
 * @param prRefs  prsOfCard(card, repo) 的结果:[{ repo, num }]
 * @param relPr   Map<number, prRecord>(release-manifest 的 prs[],按号索引)
 * @param mainRepo 本仓 "owner/repo"
 * @returns { kind: 'settle' | 'reopen' | null, merged, total } —— total = 判得动的 PR 个数
 */
export function settleOf(card, prRefs, relPr, mainRepo) {
  const recs = []
  for (const p of prRefs || []) {
    if (!p || p.repo !== mainRepo) continue
    const r = relPr && relPr.get(Number(p.num))
    if (r) recs.push(r)
  }
  const total = recs.length
  if (!total) return { kind: null, merged: 0, total: 0 }
  const merged = recs.filter((r) => String(r.state) === 'merged').length
  const open = recs.filter((r) => String(r.state) === 'open').length
  const done = TERMINAL.has(String((card && card.status) || ''))
  if (merged === total && !done) return { kind: 'settle', merged, total }
  if (done && open > 0) return { kind: 'reopen', merged, total }
  return { kind: null, merged, total }
}

// links[].title 里手写的状态词。长的排前面:「已合并」得先于「已合」命中,否则剩一个「并」字在外面。
const WORD_RE = /开而不合|待合|已合并|已合|已发/
const WORD_OPEN = new Set(['开而不合', '待合'])
// 本仓 /pull/N —— 与 prlink.mjs 的 links 兼容同一条口径(仓不同的不认:板上有旧仓链接,号会撞)
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 一条 link 的手写状态词是否已过时。
 * @param link  { title, href }
 * @param relPr Map<number, prRecord>
 * @param repo  本仓 "owner/repo";给了就只认指向它的链接(不给 = 只按 /pull/N 认号,测试用)
 * @returns { num, word, real } | null —— real ∈ open | merged | closed(草稿算 open)
 */
export function staleLink(link, relPr, repo) {
  const href = String((link && link.href) || '')
  const re = repo
    ? new RegExp(`^https?://(?:www\\.)?github\\.com/${reEsc(repo)}/pull/(\\d+)(?:[/?#]|$)`, 'i')
    : /^https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)(?:[/?#]|$)/i
  const hit = href.match(re)
  if (!hit) return null
  const num = Number(hit[1])
  const r = relPr && relPr.get(num)
  if (!r) return null
  const w = String((link && link.title) || '').match(WORD_RE)
  if (!w) return null
  const word = w[0]
  const state = String(r.state)
  const real = state === 'open' ? 'open' : state === 'merged' ? 'merged' : 'closed'
  const want = WORD_OPEN.has(word) ? 'open' : 'merged'
  return want === real ? null : { num, word, real }
}

// 沉睡:能排队却一直没人动的卡。天数不在这里算 —— gen 零时间,只把日期烤给浏览器。
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 卡是否够格进「沉睡」判定(status = ready 且有正经日期)。
 * 「无 PR」那一半由调用方补(它才拿得到 prsOfCard 的结果)。
 * @returns 'YYYY-MM-DD' | ''
 */
export function dormantDate(card) {
  if (!card || String(card.status || '') !== 'ready') return ''
  const d = String(card.date || '')
  return DATE_RE.test(d) ? d : ''
}

// 「PR 合了」≠「卡能收」。一张卡跨几轮 PR(这一轮只落了一半、只落了接口)时,机器判出来的
// settle 是对的判断、错的动作 —— 人看过之后写一句 settleHold 把这张卡的账挂起,看板与守卫就闭嘴,
// 卡头改出一枚安静的灰芯片说明这事有人管着。要收账时删掉这个字段即可。

/**
 * 卡上的「暂不收账」理由。
 * @returns 非空字符串 = 挂起中(即理由本身);'' = 正常参与 settle/reopen 判定
 */
export function settleHold(card) {
  return String((card && card.settleHold) || '').trim()
}

// 挂起不是永久静音(v0.15.14,BL-C112 §3)。hold 是「人看过、判过、承诺了下一轮」,承诺该有寿命:
// 超过 SETTLE_HOLD_DAYS 天,卡头那枚灰芯片转回琥珀并把天数写在面上,守卫安静地说一行。
// 它永远只是提醒 —— 不解除静音、不改数据、不阻断:到期的判断仍然只能由人做。
// 阈值 14 比沉睡的 30 短一半:沉睡是「从没人碰过」,hold 是「有人承诺过」,承诺该问得更勤。
export const SETTLE_HOLD_DAYS = 14

/**
 * 挂起的起算日。settleHoldAt 是 CLI 写 settleHold 时顺手记的(重设 = 续期,日期跟着归零);
 * 0.15.14 之前挂上的老卡没有这个字段 —— 调用方退到「卡文件最后改动日」(与 .udate 同源),
 * 那正好也是「在卡上再写一句近况就算续期」的口径。天数不在这里算:gen 零时间。
 * @returns 'YYYY-MM-DD' | ''
 */
export function settleHoldSince(card) {
  const d = String((card && card.settleHoldAt) || '').trim()
  return DATE_RE.test(d) ? d : ''
}
