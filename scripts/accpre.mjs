// 验收「代验」与证据分轮(v0.17.16)的共用件:gen、ddd.mjs(acc 子命令)、audits.mjs 三处读同一份。
//
// 代验 = agent 先在临时口上跑一遍清单的某一条,把看到的截下来绑到那一条上,记一句
// 「ok / 不对 / 没跑成 · 看到了什么」。它只是给人的先手证据:判定(✓ / ✕)仍然只有人能点,
// 代验不进「已判 N/M」,也不动清单的 revision(人的勾选不因为 agent 跑了一遍就作废)。
//
// 数据(acceptance-manifest.json 的 lists[].items[]):
//   precheck      可选 { at, by, result, note, env } —— 最新一轮的代验
//   shots         0.17.15 的形状,含义不变 = 最新一轮的证据
//   shotsHistory  可选 [{ round, at, precheck?, shots }] —— 旧轮,按时间先后,最后一项是最近的旧轮
// 三个字段都缺省的板,产物与 0.17.15 逐字节相同。

/** 代验结论的三档:ok = 与 exp 一致;bad = 与 exp 不一致;blocked = 没跑成(环境 / 数据 / 权限) */
export const PRE_RESULTS = ['ok', 'bad', 'blocked']

/**
 * shots 的一条 → 相对看板根的 href:纯文件名默认落在 shots/ 下,带 / 的按相对看板根原样用。
 * 卡片的 shots、验收条目的证据图、代验写回时的 --shot 校验共用这一把尺(v0.17.16 从 gen.mjs 抽出;
 * 走查留痕的 shots 是另一回事 —— 它的 file 一律当相对看板根,不补 shots/,见 gen.mjs 的 wtBlock)。
 */
export const shotHref = (s) => {
  const file = typeof s === 'string' ? s : (s && s.file) || ''
  return !file ? '' : file.includes('/') ? file : 'shots/' + file
}

/** 远程图:存不存在只有浏览器知道,gen 不拿 existsSync 去量它 */
export const isRemoteShot = (href) => /^https?:/i.test(href)

/** ISO 时刻的形制(带时区):gen 只把它原文烤进 data- 属性,显示时间由浏览器按本地时区算 */
export const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/
export const isIso = (s) => typeof s === 'string' && ISO_RE.test(s) && !Number.isNaN(Date.parse(s))

/**
 * 条目里一段合法的 precheck(不合法 → null,原因写进 why[])。gen 与 audit 共用这一道筛:
 * 板上画出来的「不对」与守卫数出来的「不对」必须是同一批。
 */
export function readPrecheck(p, why = []) {
  if (p == null) return null
  if (typeof p !== 'object' || Array.isArray(p)) { why.push('不是对象'); return null }
  if (!PRE_RESULTS.includes(p.result)) { why.push(`result「${p.result}」不在 ${PRE_RESULTS.join(' / ')} 里`); return null }
  return p
}

/** 一轮里 shots 的去重键:同一个文件两种写法(x.png 与 shots/x.png)算一张 */
export const shotKey = (s) => shotHref(s)

/**
 * 把当前这一轮(shots + precheck)整体搬进 shotsHistory 末尾,shots 清空、precheck 删除。
 * 只算新条目,不落盘;键序:原有键原位不动,新出现的键追在末尾。
 * @returns {{ item, round } | { empty: true }}
 */
export function rotateItem(it, { round = '', at }) {
  const hist = Array.isArray(it.shotsHistory) ? it.shotsHistory : []
  const shots = Array.isArray(it.shots) ? it.shots : []
  if (!shots.length && !it.precheck) return { empty: true }
  const r = round || `r${hist.length + 1}`
  const entry = { round: r, at, ...(it.precheck ? { precheck: it.precheck } : {}), shots }
  const next = { ...it, shots: [], shotsHistory: [...hist, entry] }
  delete next.precheck
  return { item: next, round: r }
}

// ---- 只改一条的 JSON 写回 ----------------------------------------------------------------
// 清单是人和几条会话一起写的大文件(melon 那份六千多行):改一条的代验,别的条目一个字节都不该动。
// 做法是先在原文里量出 lists[li].items[ii] 那一段的字节区间,只把那一段换成新序列化的条目 ——
// 缩进照那一段原来的样子(多行就按它自己的缩进单位展开,单行就单行),其余原文照抄。

/** 带位置的最小 JSON 扫描(输入已经过 JSON.parse,这里不再校验语法) */
function spans(text) {
  let i = 0
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i])) i++ }
  const str = () => {
    const s = i
    i++
    while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1
    i++
    return JSON.parse(text.slice(s, i))
  }
  const val = () => {
    ws()
    const start = i
    const c = text[i]
    if (c === '{' || c === '[') {
      const isObj = c === '{'
      const kids = []
      i++; ws()
      if (text[i] === (isObj ? '}' : ']')) { i++; return { start, end: i, kids, isObj } }
      for (;;) {
        ws()
        let key = null
        if (isObj) { key = str(); ws(); i++ /* : */ }
        const v = val()
        kids.push(isObj ? [key, v] : v)
        ws()
        if (text[i++] === ',') continue
        return { start, end: i, kids, isObj }
      }
    }
    if (c === '"') { str(); return { start, end: i } }
    while (i < text.length && !' \t\n\r,]}'.includes(text[i])) i++
    return { start, end: i }
  }
  return val()
}

const child = (node, key) => {
  if (!node || !node.kids) return null
  if (node.isObj) { const hit = node.kids.find(([k]) => k === key); return hit ? hit[1] : null }
  return node.kids[key] || null
}

/**
 * 原文里 lists[li].items[ii] 那一段换成 item,返回新全文。
 * 那一段原来多行 → 按它自己的缩进单位展开;原来单行 → 单行。
 */
export function spliceItem(text, li, ii, item) {
  const node = child(child(child(child(spans(text), 'lists'), li), 'items'), ii)
  if (!node) throw new Error(`lists[${li}].items[${ii}] 不在原文里`)
  const old = text.slice(node.start, node.end)
  let out
  if (!old.includes('\n')) out = JSON.stringify(item)
  else {
    const lineStart = text.lastIndexOf('\n', node.start - 1) + 1
    const lead = text.slice(lineStart, node.start)
    const base = /^[ \t]*$/.test(lead) ? lead : ''
    const inner = (/\n([ \t]*)"/.exec(old) || [])[1] || base + '  '
    const unit = inner.startsWith(base) && inner.length > base.length ? inner.slice(base.length) : '  '
    const nl = old.includes('\r\n') ? '\r\n' : '\n' // CRLF 的清单(Windows 检出)换进去的这一段也是 CRLF,不混行尾
    out = JSON.stringify(item, null, unit).replace(/\n/g, nl + base)
  }
  return text.slice(0, node.start) + out + text.slice(node.end)
}
