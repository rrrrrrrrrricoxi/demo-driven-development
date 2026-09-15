#!/usr/bin/env node
// 看板审计(共用模块,零依赖)。v0.17.5 起守卫(stop-hook.mjs)与 `ddd.mjs audit` 共读这一份 ——
// 两边算的是同一批事实,只是打印方式不同:守卫把「家务」八类压成一条(0.17.8),audit 把三级全文原样打出来。
// 不许有第二份实现:同一件事两处各算一遍,迟早一处改了另一处没改,而人只会看见其中一处。
//
// 三级(0.17.5 评审稿 §1)。归级的依据是「不处理会怎样」,不是严厉程度:
//   阻断 block  —— 不拦就出事、且此刻改最省事:孤儿 demo、新卡长正文无 detail。
//   坏了 broken —— 平时恒为零,出现就是真坏了:卡目录缺 / 卡文件名与 id 不符 / 卡 JSON 坏 /
//                 验收清单 JSON 坏 / current 无清单 / 同一 PR 落进两份清单 / 条目 id 重复 /
//                 清单引用未知卡号 / 分支工作区里有生成物改动 / 生成物处在冲突里 /
//                 .gitattributes 写了 merge=ours 而驱动未配 / 看板改动落在非主线分支。
//   家务 chore  —— 平时常有,是每条线各自的日常账,谁在意谁去看:长正文(老卡)、验收反馈未提交、
//                 可清截图、待收账、收早了、挂账到期、前置已清、积压超阈 —— 共八类,顺序见 CHORE_KEYS。
//
// 「产物版本戳更新 / plugin 安装异常 / 非主线不重渲 / 无戳自愈 / gen 跑失败」那几条不在这份模块里:
// 它们不是审计结论,是「要不要重生成」那一步的副产品(audit 只读、从不 gen,根本算不出它们),
// 照旧留在 stop-hook.mjs 里,按坏了级全文照出。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { prsOfCard } from './prlink.mjs'
import { SETTLE_HOLD_DAYS, TERMINAL, settleHold, settleHoldSince, settleOf } from './settle.mjs'
import { CARD_KINDS, boardRepo, cardUpdatedMap, cardsDirOf, daysBetween, localDate, scanCardDir } from './cards.mjs'
import { DEPS_FRESH_DAYS, afterOf, afterStates, clearedAt, depCtxFrom, openCount } from './deps.mjs'
import { GEN_RE, dirtyBoardFiles, genAttrPaths } from './board-branch-check.mjs'
import { accFeedback } from './accfb.mjs'
import { ACC_FB_PRUNE_DAYS, ACC_FB_PRUNE_MIN, prunable } from './acc-feedback-prune.mjs'

/** 三份头文件 →(文件, 数组键, 卡目录子目录);cardsDir 开着时后两者的真源在卡目录 */
export const CARD_SOURCES = [['manifest.json', 'tasks', null], ['backlog-manifest.json', 'items', 'backlog'], ['decisions-manifest.json', 'entries', 'decisions']]

/**
 * 家务八类在那一条里的固定次序 —— 也正是 0.17.4 及以前守卫各段的出场次序。
 * 固定,是因为这一条每次收工都出:次序一变,人就得重新读一遍才知道哪个数是哪类。
 */
export const CHORE_KEYS = ['longText', 'accFbUncommitted', 'accFbPrunable', 'settle', 'reopen', 'hold', 'depsUnlocked', 'wip']

/**
 * 家务那几条里点得到名的卡号上限(v0.17.7)。点名是为了「不必先跑一条命令才知道是哪张卡」,
 * 不是为了列全 —— 列全那一条就长回一段;剩下的写「等 N 张」,正文照旧在 `ddd audit`。
 */
export const CHORE_IDS = 3

/** 卡文件审计那几条:gen 会栽在它们上,所以守卫要赶在重跑 gen 之前就把话备好 */
export const CARD_FILE_KEYS = new Set(['cardsDirMissing', 'cardIdBad', 'cardParseBad'])

const hasTok = (v, want) => String(v || '').split(/\s+/).filter(Boolean).includes(want)

/**
 * 一块板的读取现场:配置、卡目录、三份头文件、release-manifest、按需算的 git 事实。
 * 建一次、下面各段共读 —— 每段自己读一遍卡目录的话,一次审计要把整块板读七八遍。
 * @param session 只收窄「按线分的家务」到这个 session 标签(`ddd audit --line dev`;见下面 cardsOf);
 *                空 = 全板。守卫恒为空。
 */
export function makeCtx(kanbanDir, { session = '' } = {}) {
  const KANBAN = kanbanDir
  let cfg = {}
  try { cfg = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8')) } catch {}
  let CARDS_DIR = ''
  try { CARDS_DIR = cardsDirOf(cfg) } catch {}

  // 一卡一文件(config.cardsDir):扫一遍卡目录,新鲜度 / 孤儿语料 / 下面几段审计共用。
  // 未配 cardsDir = 全为空,一切照旧走头文件里的数组。
  const cardScan = {} // sub → scanCardDir 的结果
  const cardWatch = [] // 新鲜度要盯的路径:两个子目录本身(增删改名会动目录 mtime)+ 每个卡文件
  if (CARDS_DIR) {
    for (const k of CARD_KINDS) {
      const dir = join(KANBAN, CARDS_DIR, k.sub)
      const s = scanCardDir(dir)
      cardScan[k.sub] = s
      if (s.missing) continue
      cardWatch.push(dir, ...s.files.map((f) => join(dir, f)))
    }
  }

  const manifests = (() => { try { return readdirSync(KANBAN).filter((f) => f.endsWith('.json')) } catch { return [] } })()
  const demos = (() => { try { return readdirSync(join(KANBAN, 'demos')).filter((f) => f.endsWith('.html')) } catch { return [] } })()

  // release-manifest:进度响应 / 挂账 / 前置已清 / 可清截图共读这一份;坏 JSON 与缺席都是 null,
  // 各段各自按「没有依据」处理(坏 JSON 时 gen 已经出过声,守卫不重复吵)。
  let RLM = null
  {
    const relPath = join(KANBAN, 'release-manifest.json')
    if (existsSync(relPath)) { try { RLM = JSON.parse(readFileSync(relPath, 'utf8')) } catch {} }
  }

  /** 卡的读法一处定:cardsDir 开 = 逐文件,关 = 头文件里的数组 */
  const rawCardsOf = (file, key, sub) => {
    if (CARDS_DIR && sub) {
      const s = cardScan[sub]
      return s && !s.missing ? s.cards.map((x) => x.card) : []
    }
    try { return JSON.parse(readFileSync(join(KANBAN, file), 'utf8'))[key] || [] } catch { return [] }
  }
  const SESSION = String(session || '').trim()
  /** 这张卡算不算在 --line 挑的那条线上(没给 --line 时全算) */
  const inLine = (c) => !SESSION || Boolean(c && hasTok(c.session, SESSION))
  /**
   * 「该点名哪些卡」用这个(带 --line 过滤),而且只有**按线分的家务**该用它:长正文(老卡)、
   * 待收账、收早了、挂账到期、前置已清。别的一律走 rawCardsOf ——
   *   · 依赖图与卡号宇宙不能跟着过滤缩水,不然 A 线的卡等着 B 线的前置会被算成「写错了卡号」;
   *   · 阻断一级更不能:守卫拦人从不看线别,`--line dev` 要是把 release 线的新卡长正文滤没了,
   *     dev 的人看到的是「三级都是零」,回头照样被拦(0.17.5 评审复盘坐实过这一条);
   *   · 积压的阈值 config.wip.hard 是全板的一个数,分子跟着线缩、分母不缩,那个数就没法读。
   */
  const cardsOf = (file, key, sub) => {
    const rows = rawCardsOf(file, key, sub)
    return SESSION ? rows.filter(inLine) : rows
  }

  const gitq = (args) => {
    const r = spawnSync('git', args, { cwd: KANBAN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return r.error || r.status !== 0 ? null : String(r.stdout)
  }

  /**
   * 卡目录里已经进了 HEAD 的卡文件,键取路径末两段(`<sub>/<id>.json`)—— git 报的路径相对仓根还是
   * 相对 cwd 随命令而变,末两段两种都对得上。按需算一次(一条 git ls-tree)。
   * 返回 null = 这块板问不出「提交了没」(没配 cardsDir / 没有 git / 还没有 HEAD)。
   */
  let COMMITTED
  const committedCards = () => {
    if (COMMITTED !== undefined) return COMMITTED
    COMMITTED = null
    if (CARDS_DIR) {
      const r = spawnSync('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', CARDS_DIR],
        { cwd: KANBAN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      if (!r.error && r.status === 0) {
        COMMITTED = new Set(r.stdout.split('\0').filter(Boolean).map((p) => p.split('/').slice(-2).join('/')))
      }
    }
    return COMMITTED
  }

  /** 每卡最后改动日,按需算一次(一条 git log)。未拆卡 = 空表 —— 那种板取不到「这张卡什么时候动的」。 */
  let CARD_UPD = null
  const cardUpdAll = () => {
    if (CARD_UPD) return CARD_UPD
    CARD_UPD = new Map()
    if (!CARDS_DIR) return CARD_UPD
    const srcOf = new Map()
    for (const k of CARD_KINDS) {
      const s = cardScan[k.sub]
      if (!s || s.missing) continue
      for (const x of s.cards) srcOf.set(String(x.card.id), `${CARDS_DIR}/${k.sub}/${x.file}`)
    }
    CARD_UPD = cardUpdatedMap(KANBAN, CARDS_DIR, srcOf)
    return CARD_UPD
  }

  /** 前置依赖(after)的推导上下文,按需建一次 —— 积压计数与前置已清共用同一份口径(deps.mjs) */
  let DEP_CTX = null
  const depCtx = () => {
    if (DEP_CTX) return DEP_CTX
    const cards = []
    const heads = []
    for (const [f, k, sub] of CARD_SOURCES) {
      for (const c of rawCardsOf(f, k, sub)) if (c && c.id) cards.push(c)
      try { heads.push(JSON.parse(readFileSync(join(KANBAN, f), 'utf8'))) } catch { heads.push(null) }
    }
    DEP_CTX = depCtxFrom({ cards, repo: boardRepo(...heads), rlm: RLM })
    return DEP_CTX
  }

  const TODAY = localDate() // 一处取:同一次审计里「今天」不该在逐卡循环中间翻页
  /** 「刚立的卡」:卡文件还没提交进 HEAD,或卡上的 date 就是今天。 */
  const isFreshCard = (c, sub) => {
    if (String(c.date || '') === TODAY) return true
    const done = sub ? committedCards() : null // manifest.json 的 tasks 不拆卡,只走 date 那一档
    return Boolean(done && !done.has(`${sub}/${String(c.id ?? '')}.json`))
  }

  return {
    dir: KANBAN, cfg, cardsDir: CARDS_DIR, cardScan, cardWatch, manifests, demos, rlm: RLM,
    today: TODAY, session: SESSION,
    rawCardsOf, cardsOf, inLine, gitq, committedCards, cardUpdAll, depCtx, isFreshCard,
  }
}

// ---- 各段审计。每段返回一串条目 {key, level, n, text, …}(零命中就是空串)----------------

/**
 * 卡文件审计(坏了):gen 遇到这些直接 throw,但一次只报得出第一个;这里一次列全,少来回几趟。
 * 守卫要在重跑 gen 之前就把这几条备好 —— 正是它们会让那趟 gen 失败。
 */
export function auditCardFiles(ctx, S) {
  const out = []
  const idBad = [], parseBad = []
  for (const k of CARD_KINDS) {
    const s = ctx.cardScan[k.sub]
    if (!s) continue
    const rel = `${ctx.cardsDir}/${k.sub}`
    if (s.missing) { out.push({ key: 'cardsDirMissing', level: 'broken', n: 1, text: S.cardsDirMissing(rel) }); continue }
    for (const x of s.bad) {
      if (x.kind === 'parse') parseBad.push({ file: `${rel}/${x.file}`, message: x.message })
      else idBad.push({ file: `${rel}/${x.file}`, id: x.id })
    }
  }
  if (idBad.length) out.push({ key: 'cardIdBad', level: 'broken', n: idBad.length, text: S.cardIdBad(idBad.slice(0, 5), idBad.length) })
  if (parseBad.length) out.push({ key: 'cardParseBad', level: 'broken', n: parseBad.length, text: S.cardParseBad(parseBad.slice(0, 5), parseBad.length) })
  return out
}

/**
 * 生成物的三条机械提醒(坏了,v0.17.4 §1 §2 §4):分支工作区里已有的脏产物 / 处在冲突状态的产物 /
 * .gitattributes 写了 merge=ours 却没在这个克隆里定义驱动。零命中完全不出声。
 * 只在 branch 问得出分支时才探:git 跑不起来的板,这三件事无从谈起。
 */
export function auditGenFiles(ctx, S, branch, genPath) {
  const out = []
  if (!branch || branch.skip) return out
  const onMain = branch.scanned === 0
  const repoRoot = resolve(ctx.dir, ...(branch.prefix || '').split('/').filter(Boolean).map(() => '..'))
  if (!onMain) {
    const dirtyGen = (branch.hits.length ? branch.dirty : dirtyBoardFiles(ctx.dir)).filter((f) => GEN_RE.test(f))
    if (dirtyGen.length) out.push({ key: 'genOffMainDirty', level: 'broken', n: dirtyGen.length, text: S.genOffMainDirty(dirtyGen, branch.main) })
  }
  const unmerged = (ctx.gitq(['diff', '--name-only', '--diff-filter=U', '--', '.']) || '')
    .split('\n').map((s) => s.trim()).filter((f) => f && GEN_RE.test(f))
  if (unmerged.length) out.push({ key: 'genConflict', level: 'broken', n: unmerged.length, text: S.genConflict(unmerged, branch.main, genPath, ctx.dir) })
  let attrs = ''
  try { attrs = readFileSync(join(repoRoot, '.gitattributes'), 'utf8') } catch {}
  const want = genAttrPaths(branch.prefix)
  const armed = attrs.split('\n').some((l) => l.includes('merge=ours') && want.some((p) => l.trim().startsWith(p)))
  if (armed && !((ctx.gitq(['config', '--get', 'merge.ours.driver']) || '').trim())) {
    out.push({ key: 'mergeDriverMissing', level: 'broken', n: 1, text: S.mergeDriverMissing() })
  }
  return out
}

/**
 * 验收审计(坏了,v0.12.0):acceptanceTab 开 + 清单在场才跑。
 * 清单是人写的正文,坏一条不该拦收工;这里只负责「让人看见」,gen 侧另有同款 console.warn。
 */
export function auditAcceptance(ctx, S) {
  const out = []
  if (ctx.cfg.acceptanceTab !== true) return out
  const accPath = join(ctx.dir, 'acceptance-manifest.json')
  if (!existsSync(accPath)) return out
  let acm = null
  try { acm = JSON.parse(readFileSync(accPath, 'utf8')) }
  catch (e) { out.push({ key: 'accParseFail', level: 'broken', n: 1, text: S.accParseFail(e.message) }) }
  if (!acm) return out
  const lists = (acm.lists || []).map((l) => {
    const nums = (Array.isArray(l.pr) ? l.pr : [l.pr]).map(Number).filter((n) => Number.isFinite(n) && n > 0)
    return { ...l, nums, key: nums.join('-') }
  })
  const cur = acm.current == null ? null : Number(acm.current)
  if (cur !== null && !lists.some((l) => l.nums.includes(cur))) out.push({ key: 'accCurrentNoList', level: 'broken', n: 1, text: S.accCurrentNoList(cur) })
  const owner = new Map()
  for (const l of lists) for (const n of l.nums) {
    if (owner.has(n)) out.push({ key: 'accDupPr', level: 'broken', n: 1, text: S.accDupPr(n, owner.get(n), l.key) })
    else owner.set(n, l.key)
  }
  // 卡号全集:三份 manifest 的 tasks / items / entries —— 走不过滤的那一份,--line 不该让卡号凭空消失
  const ids = new Set()
  for (const [f, k, sub] of CARD_SOURCES) {
    for (const c of ctx.rawCardsOf(f, k, sub)) if (c && c.id) ids.add(String(c.id))
  }
  for (const l of lists) {
    const seen = new Set()
    for (const it of l.items || []) {
      const id = String((it || {}).id ?? '')
      if (seen.has(id)) out.push({ key: 'accDupItem', level: 'broken', n: 1, text: S.accDupItem(l.key, id) })
      seen.add(id)
    }
    for (const c of l.cards || []) if (!ids.has(String(c))) out.push({ key: 'accUnknownCard', level: 'broken', n: 1, text: S.accUnknownCard(l.key, c) })
  }
  return out
}

/**
 * 正文长度审计(v0.13.0,只在 config.richText 开时跑):超长字段而无 detail 的卡。
 * 分两档(v0.16.2):**刚立的卡阻断**,已提交的老卡是家务一行里的「长正文 N」。
 * 分档的依据是时机不是严厉程度 —— 新卡的正文刚写出来还在手边,当场拆最省事、也只有此刻拆得动;
 * 老卡是历史,拦下来只会逼人去改一份别人也在读的卡,于是通知永远缩不掉(0.15.6 的终态豁免同理)。
 * --line 只收窄老卡那一格(它是按线分的家务);新卡那一档是阻断,守卫拦人从不看线别,
 * 跟着线缩就会让 `audit --line dev` 报「三级都是零」,而同一块板上收工照样被拦。
 */
export function auditRichText(ctx, S) {
  const out = []
  if (ctx.cfg.richText !== true) return out // detail 字段本身受 richText 门控,没开的板催也白催
  const LONG = 800
  let total = 0, worst = null // 老卡那一格只需要这两样:张数,与最长的那张(卡号 + 字段)
  const fresh = [] // 新卡逐张列:阻断消息要说清「改哪张的哪个字段、多长」
  for (const [f, k, sub, fields] of [
    ['manifest.json', 'tasks', null, ['problem', 'approach', 'notes']],
    ['backlog-manifest.json', 'items', 'backlog', ['problem', 'approach', 'note']],
    ['decisions-manifest.json', 'entries', 'decisions', ['question', 'decision', 'demoNote', 'source']],
  ]) {
    for (const c of ctx.rawCardsOf(f, k, sub)) {
      if (!c || c.detail) continue
      if (TERMINAL.has(String(c.status || ''))) continue // 终态卡(done / live / closed)不会再改写,点名只会让这条通知永远缩不掉
      let hit = null // 一张卡只算一次,取最长的那个字段
      for (const key of fields) {
        const n = typeof c[key] === 'string' ? c[key].length : 0
        if (n > LONG && (!hit || n > hit.n)) hit = { key, n }
      }
      if (!hit) continue
      if (ctx.isFreshCard(c, sub)) { fresh.push({ id: String(c.id ?? '?'), key: hit.key, n: hit.n }); continue }
      if (!ctx.inLine(c)) continue // 老卡那一格是按线分的家务,--line 到这儿才收窄
      total++
      if (!worst || hit.n > worst.n) worst = { id: String(c.id ?? '?'), key: hit.key, n: hit.n }
    }
  }
  if (total) out.push({ key: 'longText', level: 'chore', n: total, worst: worst.id, text: S.richLongText(worst, total) })
  if (fresh.length) {
    fresh.sort((a, z) => z.n - a.n) // 最长的排前面 —— 点名封顶 5 张时,先说最该拆的那几张
    const top = fresh.slice(0, 5)
    out.push({ key: 'richLongNew', level: 'block', n: fresh.length, text: S.richLongNewBlock(top, fresh.length), warn: S.richLongNewWarn(top, fresh.length) })
  }
  return out
}

/**
 * 验收反馈共享(家务,v0.17.0,只在 config.acceptanceFeedback 开时跑):
 * (a) acceptance-feedback.jsonl 里新增了几行还没提交 —— 那是验收现场的账,留在工作区里等于没留;
 *     依据一条 git diff(没 git / 问不出来就闭嘴,不拿不确定当依据)。
 * (b) 可清的反馈截图攒到 10 张 —— 说一个数,绝不自动删(删图是人的决定,脚本只报数)。
 */
export function auditAccFeedback(ctx, S) {
  const out = []
  if (!accFeedback(ctx.cfg).on) return out // v0.17.6:开关两种写法(true / { pin }),读法只有 accfb.mjs 一处
  const fbPath = join(ctx.dir, 'acceptance-feedback.jsonl')
  if (!existsSync(fbPath)) return out
  // (a) 未提交的新增行:git diff 认得已跟踪文件的增行;还没 add 过的整份文件全算新增
  const git = (args) => spawnSync('git', args, { cwd: ctx.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const tracked = git(['ls-files', '--error-unmatch', '--', fbPath])
  let added = []
  if (!tracked.error) {
    if (tracked.status === 0) {
      const d = git(['diff', '-U0', '--no-color', 'HEAD', '--', fbPath])
      if (!d.error && d.status === 0) {
        added = d.stdout.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1))
      }
    } else { // 文件在,但 git 里还没有它 —— 整份都是没提交的
      const inside = git(['rev-parse', '--is-inside-work-tree'])
      if (!inside.error && inside.status === 0) {
        try { added = readFileSync(fbPath, 'utf8').split('\n') } catch {}
      }
    }
  }
  const byPr = new Map()
  for (const raw of added) {
    let o = null
    try { o = JSON.parse(raw) } catch { continue } // 空行与坏行都在这儿落地
    if (!o || o.pr == null || !o.who) continue
    const pr = Number(o.pr)
    if (!byPr.has(pr)) byPr.set(pr, new Map())
    const w = byPr.get(pr)
    w.set(String(o.who), (w.get(String(o.who)) || 0) + 1)
  }
  if (byPr.size) {
    const rows = [...byPr.entries()]
      .map(([pr, w]) => ({ pr, n: [...w.values()].reduce((a, x) => a + x, 0), who: [...w.entries()].map(([id, n]) => `${id} ${n}`) }))
      .sort((a, z) => z.n - a.n)
    // 八类里只有这一类在一行里带对象(PR 号):它关乎别人的数据,光给个数没法判断该不该现在管
    out.push({
      key: 'accFbUncommitted', level: 'chore',
      n: rows.reduce((a, r) => a + r.n, 0),
      prs: rows.slice(0, 2).map((r) => r.pr), prTotal: rows.length,
      text: S.accFbUncommitted(rows.slice(0, 2), rows.length),
    })
  }
  // (b) 可清的截图:与 acc-feedback-prune.mjs 同一把尺(合并日取 release-manifest)
  if (ctx.rlm) {
    let files = []
    try { files = readdirSync(join(ctx.dir, 'shots')).filter((f) => f.startsWith('acc-')) } catch {}
    if (files.length >= ACC_FB_PRUNE_MIN) {
      const rows = prunable(files, ctx.rlm, ACC_FB_PRUNE_DAYS, ctx.today)
      if (rows.length >= ACC_FB_PRUNE_MIN) out.push({ key: 'accFbPrunable', level: 'chore', n: rows.length, text: S.accFbPrunable(rows.length, ACC_FB_PRUNE_DAYS) })
    }
  }
  return out
}

/**
 * 进度响应审计(家务,v0.13.0,只在 release-manifest.json 在场时跑):待收账 / 收早了 / 挂账到期。
 * 与卡上的芯片同一口径(settle.mjs),两边都只提示 —— 「PR 合了」≠「卡可以收」,静默改 manifest
 * 会跟并行会话抢写。收账走 pr-sync.mjs --settle(默认还只打印)。
 */
export function auditResponse(ctx, S) {
  const out = []
  const rlm = ctx.rlm
  if (!rlm) return out
  const relPr = new Map()
  for (const p of (rlm && rlm.prs) || []) if (p && p.number != null) relPr.set(Number(p.number), p)
  const settle = [], reopen = [], held = [] // held:写了 settleHold 的卡 + 起算日(下面算到期)
  if (relPr.size) {
    for (const [f, k, sub] of CARD_SOURCES) {
      let data = null
      try { data = JSON.parse(readFileSync(join(ctx.dir, f), 'utf8')) } catch { continue }
      const repo = String((data.instance || {}).ghRepo || '') // instance 始终在头文件里,与卡拆不拆无关
      if (!repo) continue
      for (const c of ctx.cardsOf(f, k, sub)) {
        if (!c || !c.id) continue
        if (settleHold(c)) { held.push({ id: String(c.id), since: settleHoldSince(c) }); continue } // settleHold = 人看过了,别再催(只记下起算日,见下面的到期提醒)
        const s = settleOf(c, prsOfCard(c, repo), relPr, repo)
        if (s.kind === 'settle') settle.push(String(c.id))
        else if (s.kind === 'reopen') reopen.push(String(c.id))
      }
    }
  }
  if (settle.length) out.push({ key: 'settle', level: 'chore', n: settle.length, ids: settle.slice(0, CHORE_IDS), text: S.respSettle(settle.slice(0, 5), settle.length) })
  if (reopen.length) out.push({ key: 'reopen', level: 'chore', n: reopen.length, ids: reopen.slice(0, CHORE_IDS), text: S.respReopen(reopen.slice(0, 5), reopen.length) })

  // 挂账到期提醒(v0.15.14,BL-C112 §3):hold 是承诺不是遗忘,挂满 SETTLE_HOLD_DAYS 天说一行。
  // 只提醒 —— 不解除静音、不改卡:到期的判断仍然只能由人做,替人记的只是「多久了」。
  // 0.15.14 之前挂上的老卡没有 settleHoldAt,退到卡文件最后改动日(与 gen 的 .udate 同一份口径);
  // 未拆卡的板取不到「这张卡什么时候动的」,那种老卡就不催 —— 宁可不出声,也不拿假日期点名。
  if (held.length) {
    if (held.some((h) => !h.since)) {
      const upd = ctx.cardUpdAll()
      for (const h of held) if (!h.since) h.since = upd.get(h.id) || ''
    }
    const old = held
      .map((h) => ({ id: h.id, days: daysBetween(h.since, ctx.today) }))
      .filter((h) => Number.isFinite(h.days) && h.days >= SETTLE_HOLD_DAYS)
      .sort((a, z) => z.days - a.days)
    if (old.length) out.push({ key: 'hold', level: 'chore', n: old.length, ids: old.slice(0, CHORE_IDS).map((h) => h.id), text: S.respHoldOld(old.slice(0, 5).map((h) => h.id), old[0].days, old.length) })
  }
  return out
}

/**
 * 前置已清(家务,v0.16.0):等前置的卡刚被解锁,说一行。
 * 与卡头那枚芯片同一份 deps.mjs 判据。清除日是推导出来的(卡 status / PR mergedAt / 版本 at),
 * 所以不需要状态文件、也不必记「上次说过没有」—— 7 天窗口过了它自己就闭嘴。
 */
export function auditDeps(ctx, S) {
  const out = []
  const cards = []
  for (const [f, k, sub] of CARD_SOURCES) for (const c of ctx.cardsOf(f, k, sub)) if (c && c.id) cards.push(c)
  if (!cards.some((c) => afterOf(c).length)) return out
  const ctxDep = ctx.depCtx()
  const rows = []
  for (const c of cards) {
    if (String(c.status || '') !== 'ready') continue
    const list = afterStates(c, ctxDep)
    if (!list.length || openCount(list)) continue
    const at = clearedAt(list)
    if (!at) continue // 取不到清除日(未拆卡的板上,卡号前置就是这样)—— 宁可不出声,也不拿假日期点名
    const days = daysBetween(at, ctx.today)
    if (!Number.isFinite(days) || days > DEPS_FRESH_DAYS) continue
    rows.push({ id: String(c.id), at, items: list })
  }
  rows.sort((a, z) => (a.at < z.at ? 1 : a.at > z.at ? -1 : 0)) // 最近清的先(同日保持板上顺序)
  if (rows.length) out.push({ key: 'depsUnlocked', level: 'chore', n: rows.length, ids: rows.slice(0, CHORE_IDS).map((r) => r.id), text: S.depsUnlocked(rows.slice(0, 5), rows.length) })
  return out
}

/**
 * 看板改动落在非主线分支上(坏了,v0.15.14,BL-C112 §1)。
 * 规矩是「看板只在主线上改」;这里只看当前分支(全表走 board-branch-check.mjs --all)。
 */
export function auditBoardBranch(ctx, S, branch) {
  const out = []
  if (!branch || branch.skip) return out
  // dirty = 工作区里没提交的看板改动:补救那条 checkout 会连它们一起盖掉,清单不说就是安静地丢内容
  for (const h of branch.hits) out.push({ key: 'boardBranchGuard', level: 'broken', n: 1, text: S.boardBranchGuard(h, branch.main, branch.dirty) })
  return out
}

/**
 * 积压审计(家务,v0.13.0,只在 config.wip 配了对象时跑):ready 超 hard 就报一个数。
 * 与卡上的横幅同一口径(只数 ready),但守卫看的是全线别的总数 —— 分线别的账在页面上看。
 * 正因为口径是全板的,--line 在这儿不收窄:阈值 config.wip.hard 是全板的一个数,
 * 分子跟着线缩、分母不缩,报出来的 `N/阈值` 就没法读,还会把真超阈的板报成没事。
 */
export function auditWip(ctx, S) {
  const out = []
  const w = ctx.cfg.wip
  if (!w || typeof w !== 'object' || Array.isArray(w)) return out
  const hard = Number.isFinite(w.hard) ? w.hard : 20
  // 口径与卡上的横幅同一条(v0.16.0):ready 且前置已清才算「可立即做」,等前置的另报一个数。
  // 板上一条 after 都没有时 waiting 恒 0,这句话与 0.15.x 一字不差。
  const ready = ctx.rawCardsOf('backlog-manifest.json', 'items', 'backlog').filter((it) => it && it.status === 'ready')
  const waiting = ready.some((it) => afterOf(it).length)
    ? ready.filter((it) => openCount(afterStates(it, ctx.depCtx()))).length
    : 0
  const n = ready.length - waiting
  if (n > hard) out.push({ key: 'wip', level: 'chore', n, hard, waiting, text: S.wipOver(n, hard, waiting) })
  return out
}

/** demo 合订引用:被已豁免 demo 用 iframe(data-src/src)内嵌的同目录子页随之豁免,逐层传递 */
const IFRAME_REF_RE = /<iframe\b[^>]*?\b(?:data-src|src)\s*=\s*(?:"([^"#?]+)"|'([^'#?]+)')/gi

/**
 * 孤儿 demo(阻断):demos/*.html 凡未被任何 *.json manifest / 卡文件引用、又不在
 * demos/.no-card-ok 豁免名单里的,即孤儿。v0.10.0 起认「合订引用」(见 docs/demo-binding.md)。
 */
export function auditOrphans(ctx, S) {
  const DEMOS = join(ctx.dir, 'demos')
  // 语料 = 三份 manifest + 卡文件(cardsDir 开着时 demo 链接就写在卡里,不纳入即全员误报孤儿)
  const corpus = ctx.manifests
    .map((f) => { try { return readFileSync(join(ctx.dir, f), 'utf8') } catch { return '' } })
    .concat(ctx.cardWatch.map((p) => { try { return readFileSync(p, 'utf8') } catch { return '' } }))
    .join('\n')
  let allow = []
  try {
    allow = readFileSync(join(DEMOS, '.no-card-ok'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {}
  // 只认同目录裸文件名引用(同源内嵌是合订术前提;带路径/锚/查询串的不认),引用断了照常报孤儿。
  const refsOf = new Map()
  for (const f of ctx.demos) {
    let html = ''
    try { html = readFileSync(join(DEMOS, f), 'utf8') } catch { continue }
    const set = new Set()
    for (const m of html.matchAll(IFRAME_REF_RE)) {
      const t = (m[1] ?? m[2]).trim().replace(/^\.\//, '')
      if (t && !t.includes('/') && t.endsWith('.html') && t !== f) set.add(t)
    }
    if (set.size) refsOf.set(f, set)
  }
  const covered = new Set(ctx.demos.filter((f) => corpus.includes(f) || allow.includes(f)))
  for (let grew = true; grew;) {
    grew = false
    for (const [f, set] of refsOf) {
      if (!covered.has(f)) continue
      for (const t of set) if (!covered.has(t) && ctx.demos.includes(t)) { covered.add(t); grew = true }
    }
  }
  const orphans = ctx.demos.filter((f) => !covered.has(f))
  if (!orphans.length) return []
  const list = orphans.map((f) => `  - app/kanban/demos/${f}`).join('\n')
  return [{ key: 'orphan', level: 'block', n: orphans.length, text: S.orphanBlock(orphans.length, list), warn: S.orphanWarn(orphans.length, list) }]
}

/**
 * 全部审计跑一遍。条目次序就是 0.17.4 及以前守卫各段的出场次序 —— 阻断项提到最前(孤儿 demo
 * 在阻断里又排第一),其余原序不动,于是家务全零时守卫那份 stdout 与 0.17.4 逐字节相同。
 * @param branch boardBranchCheck 的结果(问不出分支就传 null:三条生成物提醒与分支审计一起缺席)
 * @param gen gen.mjs 的绝对路径 —— 冲突那条要把命令填实
 */
export function collect(ctx, S, { branch = null, gen = '' } = {}) {
  return [
    ...auditOrphans(ctx, S),
    ...auditCardFiles(ctx, S),
    ...auditGenFiles(ctx, S, branch, gen),
    ...auditAcceptance(ctx, S),
    ...auditRichText(ctx, S),
    ...auditAccFeedback(ctx, S),
    ...auditResponse(ctx, S),
    ...auditDeps(ctx, S),
    ...auditBoardBranch(ctx, S, branch),
    ...auditWip(ctx, S),
  ]
}

export const pickLevel = (entries, level) => entries.filter((e) => e.level === level)

/**
 * 家务那一条(0.17.5 §1 立的一行 → 0.17.7 §9 每类一行 → 0.17.8 §10 收回一条)。零的类别不出现;
 * 八类全零则返回 ''(整条不出)。类别次序固定 —— 这一条每次收工都出,次序一变人就得重读一遍。
 *
 * 0.17.5 那版是「标签 + 计数」,压过头了:标签是行话、数字又不点名,读的人两头都落不到实处。
 * 0.17.7 改成每类一行,人话与卡号都有了,可 Claude Code 把 `systemMessage` 里的每个换行渲染成一个
 * 独立的「Stop says」气泡 —— 六行就是六个气泡,在手机上比一行还占地方。0.17.8 因此把那几行原样
 * 拼回一条(以「 · 」分隔),人话标签与卡号一个不丢,照旧不带命令、不带路径(那是 `ddd audit` 的活)。
 * 返回值保证不含换行 —— 上头 stop-hook 与 `ddd audit --json` 的 summary 都指着这一点。
 * @param cmd 详情那条命令(v0.17.6 起不带路径)
 */
export function choreLine(entries, S, cmd) {
  const parts = []
  for (const key of CHORE_KEYS) {
    const e = entries.find((x) => x.level === 'chore' && x.key === key)
    if (e) parts.push(S.chore[key](e))
  }
  return parts.length ? S.choreLine(parts, cmd) : ''
}

/**
 * 详情那条命令。v0.17.6 起不带路径:这一行每次收工都印一遍,插件的绝对路径在手机上要占四行,
 * 而 ddd.mjs 装在哪由 README 与 CLAUDE.md 的看板段落说 —— 守卫不替它们重复一遍。
 */
export const auditCmd = () => 'ddd audit'
