// PR 段判定(v0.12.0)。release-manifest.json 的 releases[] + 一条 PR 记录 → 它在哪一段。
// gen(发布进度 tab / 卡头芯片后缀)与测试共用同一口径 —— 顶层无副作用,纯函数,可直接 import。
//
// 段语义固定(宿主只能改 label/hint,见 templates/manifests/release-manifest.json):
//   dev  = 还开着的 PR            test = 已合主线、未随任何版本发出      prod = 已随某版本发出
// 三段之外还有两种「不入段」的:
//   offline = base 不是主线分支(叠 PR / 实验分支,合了也不代表进主线)
//   closed  = 关掉未合
//
// 归版规则(与 gen 的芯片后缀同源):releases[].prs 显式写了就以显式为准;否则找 at ≥ mergedAt
// 的最早 release —— at 是打 tag 的精确时刻,同一天在 tag 之后才合的算「未随版本发出」。

/** releases[] → 归版索引(sorted 按 at 升序;tagOfPr = 人手写在 releases[].prs 里的归属) */
export function relIndex(releases) {
  const sorted = (releases || []).filter((r) => r && r.at).slice().sort((x, y) => (String(x.at) < String(y.at) ? -1 : 1))
  const tagOfPr = new Map()
  for (const r of releases || []) for (const n of (r && r.prs) || []) if (!tagOfPr.has(Number(n))) tagOfPr.set(Number(n), r.tag)
  const tagFor = (pr) => {
    const explicit = tagOfPr.get(Number(pr.number))
    if (explicit) return explicit
    if (!pr.mergedAt) return ''
    const hit = sorted.find((rel) => String(rel.at) >= String(pr.mergedAt))
    return hit ? hit.tag : ''
  }
  return { sorted, tagOfPr, tagFor }
}

/**
 * 一条 PR 记录 → { id, tag }。
 * @param pr         prs[] 元素 { number, state, draft, base, mergedAt, … }
 * @param rel        relIndex(releases) 的返回值
 * @param mainBranch 主线分支名(instance.branch;为空 = 不判「非主线」,宿主没声明主线就不猜)
 * @param stageIds   宿主实际列出的段 id 集合(Set 或数组;缺 test 时 merged-未归版直接算 prod)
 */
export function stageOf(pr, rel, mainBranch, stageIds) {
  const has = (id) => (stageIds instanceof Set ? stageIds.has(id) : (stageIds || []).includes(id))
  const base = String(pr.base || '')
  // 非主线在前:叠 PR 合进的是别人的分支,它的 open/merged 与主线进度无关
  if (mainBranch && base && base !== mainBranch) return { id: 'offline', tag: '' }
  if (pr.state === 'closed') return { id: 'closed', tag: '' }
  if (pr.state === 'open') return { id: 'dev', tag: '' }
  if (pr.state !== 'merged') return { id: 'closed', tag: '' } // 未知 state:不编造进度,归入「其它」
  const tag = rel.tagFor(pr)
  if (tag) return { id: 'prod', tag }
  // 缺 test 的宿主 = 「合了即发」,merged 未归版归 prod 且不带版本号(不是凭空造一段)
  return has('test') ? { id: 'test', tag: '' } : { id: 'prod', tag: '' }
}
