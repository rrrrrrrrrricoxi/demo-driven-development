// 发布进度时间线的几何(v0.13.1)。纯算术,不碰 DOM、不读时钟、不看数据来源 ——
// gen 把这份源码原样内联进页面(见 gen.mjs 的 REL_GEOM_SRC),测试直接 import 同一份。
// 「打包按估算、绘制按真实」是上一版时间线撞车的根:泳道分配与画条必须走同一个 relBar。
//
// 轴是**非线性**的:一天一格,安静的日子只给 quiet px,有 PR 的日子至少 base px,
// 一天挤了很多个就按 ceil(当日数 / lanes) 格加宽 —— 横向是这张图唯一没被用起来的一维。
// 宽度一律按**全局**日计数算(不是当前筛选后的),所以展开/折叠/筛选都不会让轴跳。
//
// 浏览器侧要跑在没有 const/箭头函数假设的老壳里,这里统一用 var + function。

/**
 * 窗口内的日子 → 每天的 x 与宽度。days = 升序 ISO 日期串;counts = 日 → PR 数。
 * fit(v0.15.10)= 这一格能给轴的实宽(容器宽 − 左栏宽),可省。繁忙度只定**相对**宽窄,
 * 绝对宽度由 fit 拉满:自然宽之和不够宽就整体等比放大 —— 短窗口 = 放大,不是把轴截短
 * (近 30 天从前只画到面板左边小半截,右边空一片)。自然宽已经超过 fit 就原样交出去,
 * 由外层的 overflow-x 横向滚(全时段在窄屏上照旧是滚的,这一条没变)。
 * 逐日走前缀和再取整:总宽正好落在 fit 上,每天的宽还是整数,不会积出半像素的缝。
 */
export function relAxis(days, counts, o, fit) {
  var nat = [], sum = 0, map = {}, wid = {}, i, d, c, k, x, cum, nx
  for (i = 0; i < days.length; i++) {
    c = counts[days[i]] || 0
    nat.push(c ? Math.max(o.base, Math.ceil(c / o.lanes) * o.slot) : o.quiet)
    sum += nat[i]
  }
  k = fit > 0 && sum > 0 && fit > sum ? fit / sum : 1
  for (i = 0, x = o.lbl, cum = 0; i < days.length; i++) {
    d = days[i]
    cum += nat[i]
    nx = o.lbl + Math.round(cum * k)
    map[d] = x
    wid[d] = nx - x
    x = nx
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
 * m / s 都封了顶(见 relPack / relGrid / relGridBig),所以展开后的高度有上界,与带里有多少 PR 无关。
 * rm / rs(v0.15.11)= 两组各自的行距,不传就是老的 o.row —— 放大档的方块 / 芯片比 13px 高,
 * 带高必须跟着长,不然字形放大了却挤在原来的行距里。
 */
export function relBandH(m, s, o, open, rm, rs) {
  var a = rm || o.row, b = rs || o.row
  return o.head + (open ? (m ? o.sub + m * a + 2 : 0) + (s ? o.sub + s * b + 2 : 0) + o.pad : 0)
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

// ———— 放大之后的字形(v0.15.11)————
// 轴按面板拉满(v0.15.10)之后,窗口越短一天越宽:本周两天时一天有五百多 px,而当天开当天合的
// PR 仍是一枚 11px 的方块贴在格子最左边,点不中也读不出是谁;开→合的横杠则各自拉满整条轨,
// 三条一样长——它们只是都「跨了一天」。数据是日粒度的,这个缩放下长度这一维已经不携带信息,
// 满屏实心块反而在宣称一种数据没有的精度。三档字形由同一个「一天多少 px」驱动,窄窗口原样不动。

/**
 * 这一屏该用哪一套字形。track = 轨道宽(轴宽 − 左栏),days = 窗口天数。
 * 0 = 现状(< 40px/天:方块 12px 定距、横杠整段实心,与 0.15.10 逐字节相同)
 * 1 = 字形缩放(≥ 40:方块随日宽长大,横杠退成两端实心 + 细线)
 * 2 = 日格芯片(≥ 120:每个 PR 一枚带号芯片,跨度退成一条 whisker)
 * 40 这条线不是拍脑袋:40 × 0.6 = 24px,正好是方块还点得中的下限;120 是一格里放得下两枚芯片。
 */
export function relRegime(track, days) {
  var px = days > 0 ? track / days : 0
  return px >= 120 ? 2 : px >= 40 ? 1 : 0
}

/** 放大档的方块边长:clamp(日宽 × 0.6, 12, 28) —— 12 是现状那枚,28 是再大就抢戏 */
export function relSqSize(track, days) {
  var px = days > 0 ? track / days : 0
  return Math.max(12, Math.min(28, Math.round(px * 0.6)))
}

/**
 * 芯片宽:按全图最大的 PR 号算一次,整张图一个宽度 —— 列对得齐,四五位数的仓库也不被切掉半个号。
 * 三位数(#248)= 42px,与 demo 逐格相同;每多一位加 8px。
 */
export function relChipW(maxN) {
  return 12 + Math.ceil(7.5 * (String(maxN > 0 ? Math.floor(maxN) : 0).length + 1))
}

/**
 * 字形缩放档的当日方块:先横后竖排进那一天的格子(13px 的行距装不下 28px 的方块,
 * 排布只能从「先竖后横」翻过来 —— 日格宽了,横向本来就够)。
 * 行数仍封顶 o.lanes:展开后的高度与 PR 数无关这一条不因放大而破。
 */
export function relGridBig(byDay, ax, size, o) {
  var pitch = size + 4, out = [], used = 0, d, arr, cols, i, col, lane
  for (d in byDay) {
    if (ax.x[d] === undefined) continue
    arr = byDay[d].slice().sort(function (a, b) { return a.n - b.n })
    cols = Math.max(1, Math.floor((ax.w[d] - 4) / pitch))
    for (i = 0; i < arr.length; i++) {
      col = i % cols
      lane = Math.floor(i / cols)
      if (lane >= o.lanes) { lane = o.lanes - 1; col = cols - 1 } // 兜底:轴宽按全局计数算过,正常走不到这里
      out.push({ n: arr[i].n, lane: lane, x: ax.x[d] + 2 + col * pitch, w: size, item: arr[i] })
      if (lane + 1 > used) used = lane + 1
    }
  }
  return { used: used, bars: out }
}

/**
 * 芯片档的当日 PR:一格一行,按号横排;格子装不下的收进一枚 +N。
 * 只画一行是有意的 —— 芯片本身就是「这一格里有谁」的答案,叠成一叠反而又要数。
 */
export function relGridChip(byDay, ax, cw) {
  var pitch = cw + 6, out = [], d, arr, cols, show, i, fold
  for (d in byDay) {
    if (ax.x[d] === undefined) continue
    arr = byDay[d].slice().sort(function (a, b) { return a.n - b.n })
    cols = Math.max(1, Math.floor((ax.w[d] - 8) / pitch))
    show = arr.length > cols ? Math.max(1, cols - 1) : arr.length // 放不下就腾一格给 +N
    for (i = 0; i < show; i++) out.push({ n: arr[i].n, lane: 0, x: ax.x[d] + 4 + i * pitch, w: cw, item: arr[i] })
    if (arr.length > show) {
      // 被收起来的是哪几个,这里就说清楚(v0.15.15):+N 的悬停卡只列它们,不再退回整天
      fold = []
      for (i = show; i < arr.length; i++) fold.push(arr[i].n)
      out.push({ more: fold.length, fold: fold, lane: 0, d: d, x: ax.x[d] + 4 + show * pitch, w: cw - 8 })
    }
  }
  return { used: out.length ? 1 : 0, bars: out }
}

/**
 * 芯片档的跨天 PR:按(开始日 → 结束日 → 开着没)分组,一组一行 —— 同一天开同一天合的
 * 几个 PR 共用一行也共用一条 whisker,whisker 才不会含糊指向谁。
 * 芯片落在**锚点日**那一格:合了的落合并日,还开着的落开 PR 那天 —— 与轴宽的日计数同一条口径
 * (DAYC 按锚点日落桶),否则格子的宽与格子里的芯片数对不上。
 * 细线连的是芯片块与跨度的另一端;开始日被窗口裁掉时留一个 ‹ 在左沿。
 * @returns { used, rows: [{ lane, clip, open, x0, x1, cx, show, list }] } x0→x1 = 细线,cx = 芯片起点
 */
export function relPackChip(multi, ax, cw, o) {
  var pitch = cw + 6, gm = {}, order = [], rows = [], ends = [], i, j, q, k, it, g, an, clip, cx, cols, show, blk, x0, x1, lo, hi
  for (i = 0; i < multi.length; i++) {
    it = multi[i]
    if (it.e < ax.t0 || it.s > ax.t1) continue
    k = it.s + '>' + it.e + (it.open ? '>o' : '')
    if (!gm[k]) { gm[k] = { s: it.s, e: it.e, open: !!it.open, list: [] }; order.push(k) }
    gm[k].list.push(it)
  }
  order.sort(function (a, b) {
    var A = gm[a], B = gm[b]
    return A.s < B.s ? -1 : A.s > B.s ? 1 : A.e < B.e ? -1 : A.e > B.e ? 1 : A.open === B.open ? 0 : A.open ? 1 : -1
  })
  for (i = 0; i < order.length; i++) {
    g = gm[order[i]]
    clip = g.s < ax.t0
    an = g.open ? (clip ? ax.t0 : g.s) : g.e
    if (ax.x[an] === undefined || ax.x[g.e] === undefined) continue
    g.list.sort(function (a, b) { return a.n - b.n })
    cx = g.open && clip ? o.lbl + 14 : ax.x[an] + 4 // 裁掉的那端给 ‹ 让出一点位置
    cols = Math.max(1, Math.floor((ax.x[an] + ax.w[an] - cx - 4) / pitch))
    show = g.list.length > cols ? Math.max(1, cols - 1) : g.list.length
    blk = (show + (g.list.length > show ? 1 : 0)) * pitch - 6 // 芯片块占的横向
    x0 = g.open ? cx + blk : (clip ? o.lbl + 11 : ax.x[g.s] + 5)
    x1 = g.open ? ax.x[g.e] + ax.w[g.e] - 4 : cx
    // 横向不打架的两组并作一行,行数照旧封顶 o.lanes —— 与 relPack 同一条规矩:
    // 宁可两条挨一下,也不让一条带长到看不完(真挤到了,芯片各在自己那一格,含糊的只是细线)
    lo = Math.min(x0, cx)
    hi = Math.max(x1, cx + blk)
    for (j = 0; j < ends.length; j++) if (ends[j] + o.gap <= lo) break
    if (j >= o.lanes) { j = 0; for (q = 1; q < ends.length; q++) if (ends[q] < ends[j]) j = q }
    ends[j] = hi
    rows.push({ lane: j, clip: clip, open: g.open, an: an, cx: cx, show: show, list: g.list, x0: x0, x1: x1 })
  }
  return { used: ends.length > o.lanes ? o.lanes : ends.length, rows: rows }
}

/**
 * 字形缩放档的横杠:两端实心帽 + 中间细线。真实区间原样保留,只是不再拿一整条实心块占满屏。
 * 被窗口左缘裁掉的那一端不画帽,交给一个 ‹;短到两顶帽要碰上时退成一整条 —— 那时它本来就没虚长。
 * @returns { solid: true, x, w } | { solid: false, a, aw, b, bw, lx, lw }
 */
export function relCaps(x, w, size, clip) {
  if (w <= size * 2 + 4) return { solid: true, x: x, w: w }
  var a = clip ? x + 10 : x, aw = clip ? 0 : size
  return { solid: false, a: a, aw: aw, b: x + w - size, bw: size, lx: a + aw, lw: x + w - size - a - aw }
}
