// PR ↔ 卡关联(v0.12.0)。一张卡的 PR 集合 = 显式 `pr` 字段 ∪ links[] 里指向本仓的 /pull/N 链接。
// gen(芯片 / 验收 pane / 反查)与独立脚本(pr-sync)共用同一口径 —— 顶层无副作用,可直接 import。
//
//   "pr": 230                → 本仓 230 号(仓取 instance.ghRepo)
//   "pr": [227, 230]         → 同一张卡跨了几个 PR
//   "pr": "owner/repo#4"     → 跨仓
//   links[].href = "https://github.com/<本仓>/pull/230"  → 也算(仓不同的不算:板上有旧仓链接,号会撞)
//
// 两档故意分开:declaredPrs = 人写在卡上的(渲染芯片只认这一档,存量看板逐字节冻结);
// prsOfCard = 加上 links 兼容的全集(「PR ↔ 卡」反查的唯一来源)。

const REF_RE = /^([\w.-]+\/[\w.-]+)#(\d+)$/

/** { repo, num } → "owner/repo#230";集合去重的键 */
export const prKey = (p) => `${p.repo}#${p.num}`

/** 单个 pr 值 → { repo, num } | null(不合法/无宿主仓可挂靠时 null,不猜) */
export function parsePr(v, repo) {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 && repo ? { repo, num: v } : null
  const s = String(v ?? '').trim()
  const cross = s.match(REF_RE)
  if (cross) return { repo: cross[1], num: Number(cross[2]) }
  if (/^#?\d+$/.test(s)) { const n = Number(s.replace('#', '')); return n > 0 && repo ? { repo, num: n } : null }
  return null
}

function dedupe(list) {
  const seen = new Set()
  const out = []
  for (const p of list) {
    const k = prKey(p)
    if (!seen.has(k)) { seen.add(k); out.push(p) }
  }
  return out
}

const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 卡上显式写的 pr(不含 links 兼容)—— 卡头芯片只渲染这一档 */
export function declaredPrs(card, repo) {
  const raw = card && card.pr
  if (raw === undefined || raw === null) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return dedupe(list.map((v) => parsePr(v, repo)).filter(Boolean))
}

/** 卡的 PR 全集 = 显式 pr 字段(出现序在前)∪ links[] 里本仓 /pull/N 的链接 */
export function prsOfCard(card, repo) {
  const out = declaredPrs(card, repo)
  if (repo && card && Array.isArray(card.links)) {
    const re = new RegExp(`^https?://(?:www\\.)?github\\.com/${reEsc(repo)}/pull/(\\d+)(?:[/?#]|$)`, 'i')
    for (const l of card.links) {
      const hit = String((l && l.href) || '').match(re)
      if (hit) out.push({ repo, num: Number(hit[1]) })
    }
  }
  return dedupe(out)
}
