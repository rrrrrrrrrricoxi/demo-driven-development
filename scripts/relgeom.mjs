// 发布进度时间线的几何(v0.13.1)。纯算术,不碰 DOM、不读时钟、不看数据来源 ——
// gen 把这份源码原样内联进页面(见 gen.mjs 的 REL_GEOM_SRC),测试直接 import 同一份。
// 「打包按估算、绘制按真实」是上一版时间线撞车的根:泳道分配与画条必须走同一个 relBar。
//
// 轴是**非线性**的:一天一格,安静的日子只给 quiet px,有 PR 的日子至少 base px,
// 一天挤了很多个就按 ceil(当日数 / lanes) 格加宽 —— 横向是这张图唯一没被用起来的一维。
// 宽度一律按**全局**日计数算(不是当前筛选后的),所以展开/折叠/筛选都不会让轴跳。
//
// 浏览器侧要跑在没有 const/箭头函数假设的老壳里,这里统一用 var + function。

/** 窗口内的日子 → 每天的 x 与宽度。days = 升序 ISO 日期串;counts = 日 → PR 数 */
export function relAxis(days, counts, o) {
  var x = o.lbl, map = {}, wid = {}, i, d, c
  for (i = 0; i < days.length; i++) {
    d = days[i]
    c = counts[d] || 0
    map[d] = x
    wid[d] = c ? Math.max(o.base, Math.ceil(c / o.lanes) * o.slot) : o.quiet
    x += wid[d]
  }
  return { x: map, w: wid, W: x, t0: days[0], t1: days[days.length - 1] }
}

/**
 * 轴上写不写日期标签。候选 = 每周一 + 每个 tag 日 + 每月 1 日(后两种优先)。
 * 非线性轴上等间隔取样必然撞字(安静的一周只有 35px,繁忙的一天就有 84px),
 * 所以从左往右贪心:与上一个**写了字**的标签不足 min px 就只画短刻度。
 * tag / 月初可以把前一个普通标签的字挤掉,但 min px 这条线本身不破 —— 破了就又是压字。
 * @returns [{ d, x, k: 'wk'|'mo'|'tag', txt }]
 */
export function relTicks(days, ax, special, min) {
  var out = [], lab = [], i, d, k, x, t
  for (i = 0; i < days.length; i++) {
    d = days[i]
    k = special[d] || (new Date(d + 'T00:00:00Z').getUTCDay() === 1 ? 'wk' : '')
    if (!k) continue
    x = ax.x[d]
    t = { d: d, x: x, k: k, txt: false }
    out.push(t)
    if (k !== 'wk') { // 优先刻度:先把挡路的普通标签的字撤掉
      while (lab.length && lab[lab.length - 1].k === 'wk' && x - lab[lab.length - 1].x < min) {
        lab[lab.length - 1].txt = false
        lab.pop()
      }
    }
    if (!lab.length || x - lab[lab.length - 1].x >= min) { t.txt = true; lab.push(t) }
  }
  return out
}

/** 一条 PR 在轴上的像素区间(s / e 为 ISO 日);整段落在窗口外返回 null */
export function relBar(ax, s, e, min) {
  if (e < ax.t0 || s > ax.t1) return null
  if (s < ax.t0) s = ax.t0
  if (e > ax.t1) e = ax.t1
  if (ax.x[s] === undefined || ax.x[e] === undefined) return null
  return { x0: ax.x[s], w: Math.max(min, ax.x[e] + ax.w[e] - ax.x[s] - 1) }
}

/**
 * 跨天 PR 的泳道打包:按开始日贪心塞进第一条空出来的泳道。
 * 泳道数封顶 o.lanes —— 展开后的高度因此与 PR 数无关(这正是「不再一人一行」的落点);
 * 真的满了就塞进最早空出来的那条(宁可两条挨一下,也不让一条带长到看不完)。
 * @param items [{ n, s, e }] · @returns { used, bars: [{ n, lane, x, w, item }] }
 */
export function relPack(items, ax, o) {
  var ends = [], used = 0, bars = [], i, j, q, g
  var list = items.slice().sort(function (a, b) { return a.s < b.s ? -1 : a.s > b.s ? 1 : a.n - b.n })
  for (i = 0; i < list.length; i++) {
    g = relBar(ax, list[i].s, list[i].e, o.min)
    if (!g) continue
    for (j = 0; j < ends.length; j++) if (ends[j] + o.gap <= g.x0) break
    if (j >= o.lanes) {
      j = 0
      for (q = 1; q < ends.length; q++) if (ends[q] < ends[j]) j = q
    }
    ends[j] = g.x0 + g.w
    bars.push({ n: list[i].n, lane: j, x: g.x0, w: g.w, item: list[i] })
    if (j + 1 > used) used = j + 1
  }
  return { used: used, bars: bars }
}

/**
 * 当天开当天合的 PR:不再竖着堆成一列,而是在那一天的格子里按号横排 ——
 * 轴宽已经按 ceil(当日数 / lanes) 加宽过,所以列数总是够用。
 * @param byDay { 日: [{ n }] } · @returns { used, bars }
 */
export function relGrid(byDay, ax, o) {
  var out = [], used = 0, d, arr, cols, i, lane, col
  for (d in byDay) {
    if (ax.x[d] === undefined) continue
    arr = byDay[d].slice().sort(function (a, b) { return a.n - b.n })
    cols = Math.max(1, Math.floor(ax.w[d] / o.slot))
    for (i = 0; i < arr.length; i++) {
      lane = i % o.lanes
      col = Math.floor(i / o.lanes)
      if (col >= cols) col = cols - 1 // 兜底:轴宽按全局计数算过,正常走不到这里
      out.push({ n: arr[i].n, lane: lane, x: ax.x[d] + col * o.slot, w: Math.max(o.min, o.slot - 1), item: arr[i] })
      if (lane + 1 > used) used = lane + 1
    }
  }
  return { used: used, bars: out }
}

/**
 * 一条带的高度:折叠 = 带头;展开 = 带头 + 两组泳道(各自带一行小标题)+ 底衬。
 * m / s 都封了顶(见 relPack / relGrid),所以展开后的高度有上界,与带里有多少 PR 无关。
 */
export function relBandH(m, s, o, open) {
  return o.head + (open ? (m ? o.sub + m * o.row + 2 : 0) + (s ? o.sub + s * o.row + 2 : 0) + o.pad : 0)
}

/**
 * 时间线的时间窗(v0.15.9):五档预设 → 升序 ISO 日期串,末位永远是「今天」。
 * 本地时钟由调用方递进来(now),这里照旧只做算术 —— gen 侧零时间的老规矩不动。
 * win:'30' / '14' = 近 N 天(含今天);'week' = 本周一起(本地);'1' = 当日;
 * 'all' = 全时段 —— 从 60 天窗口起往回够到最早的一条带,与从前的「全部」同一口径。
 * @param los 各带最早锚点日的毫秒(带里没有 PR 就传今天)· @returns ['2026-08-31', '2026-09-01']
 */
export function relWindow(win, now, los) {
  var tms = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()), t0, i, out = []
  if (win === 'all') {
    t0 = tms - 59 * 864e5
    for (i = 0; i < los.length; i++) if (los[i] < t0) t0 = los[i]
  } else if (win === 'week') t0 = tms - ((now.getDay() + 6) % 7) * 864e5 // 周一 = 0 格,周日 = 6 格
  else t0 = tms - (Number(win) - 1) * 864e5
  if (t0 > tms) t0 = tms // 带的日子比今天还新(时区 / 时钟)时窗口不倒着长
  for (i = 0; t0 + i * 864e5 <= tms; i++) out.push(new Date(t0 + i * 864e5).toISOString().slice(0, 10))
  return out
}
