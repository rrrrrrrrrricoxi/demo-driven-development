#!/usr/bin/env node
// 看板守卫(Claude Code Stop hook,零依赖)。CC 每次收工前自动运行,做两件事:
//
//   1. 新鲜度:manifest / demos/*.html / theme.css(v0.4.0 换装,可缺席)/ gen.mjs
//      任一比 index.html 新 → 自动重跑 gen.mjs,看板即刻最新,无需人发「更新看板」prompt。
//      (plugin 期:gen.mjs 与本脚本同目录;尚未落地时跳过本段,只做审计。)
//      v0.6.0 起叠加版本戳维度(防旧版盖板):mtime 分不出「谁写的」——旧版 session 的旧 gen 盖完板
//      产物反而最新。戳缺失/低于本 plugin 版 = 旧 gen 产物 → 视为过期重跑(自愈,与 mtime OR);
//      戳高于本 plugin 版 = 本 session 才是旧的 → 一票否决重生成(含 mtime 判过期),出警告但
//      绝不 exit 2——「重启我自己」是 Claude 修不了的状态,阻断只会造死循环。审计(只读)照做。
//   2. 审计:demos/*.html 凡未被任何 *.json manifest 引用、且不在 demos/.no-card-ok
//      豁免名单(一行一个文件名)的,即「孤儿 demo」→ 阻断收工,要求当场补卡。
//      v0.10.0 起认「合订引用」:被已豁免 demo 用 iframe(data-src/src)内嵌的同目录子页
//      不算孤儿,逐层传递——合订页挂卡即可,子页不必挂占位链接(见 docs/demo-binding.md)。
//      防死循环:同一次收工最多拦一次(stop_hook_active 时只警告并放行)。
//   3. 验收审计(v0.12.0,只在 config.acceptanceTab 开且 acceptance-manifest.json 在场时):
//      current 指向的 PR 没清单 / 同一 PR 落进两份清单 / 条目 id 重复 / cards 引用不存在的卡号,
//      各出一条非阻断 notice;清单 JSON 坏了也只报一条,不崩、不拦。
//   4. 正文长度审计(v0.13.0,只在 config.richText 开时):某长文本字段 > 800 字且卡无 detail
//      字段 → 一条非阻断 notice(摘要与细节分家的写法规矩见 ddd-workflow)。
//      v0.15.6 起跳过终态卡(TERMINAL,与 settle.mjs 同一份口径):已 done / live / closed 的卡
//      不会再改写,点名它们只会让这条通知永远缩不掉。
//      v0.15.7 起这条通知只一行:张数 + 最长的那张(卡号 + 字段),不铺逐卡清单、不报字数。
//      v0.16.2 起分两档:**新卡阻断**、老卡照旧一行提醒。新卡 = 卡文件还没提交进 HEAD(未拆卡的板
//      问不出这个,退卡上的 date == 今天)。理由是时机:正文刚写出来还在手边,当场拆最省事;等它
//      进了历史再回头拆,改的就是别人也在读的卡了。阻断走孤儿 demo 那一套(decision: block +
//      stop_hook_active 降级放行),点名卡号 / 字段 / 字数,并给出 detail 的那条命令。
//   5. 进度响应审计(v0.13.0,只在 release-manifest.json 在场时):关联 PR 全合了却没收账的卡、
//      已收账却还有 PR 开着的卡,各出一条非阻断 notice(各最多点名 5 张 + 总数)。收账动作在
//      pr-sync.mjs --settle,守卫只提示 —— 静默改 manifest 会跟并行会话抢写。
//   5b. 挂账到期(v0.15.14,BL-C112 §3):写了 settleHold 的卡挂满 14 天 → 一行安静的提醒
//      (「已 N 天,仍成立就重设一下,收账就删」,最多点名 5 张)。只提醒:不解除静音、不改卡。
//      起算日取卡上的 settleHoldAt(CLI 写 settleHold 时记的);老卡没有就退卡文件最后提交日。
//   5c. 前置已清(v0.16.0,卡上写了 after 才跑):前置刚刚全清(清除日在 7 天内)且卡仍 ready →
//      一行安静的「前置已清:BL-C132(#266 已合)…」(最多点名 5 张,最近清的先)。不需要状态
//      文件:清除日是从卡 status / PR mergedAt / 版本 at 推导出来的。环与未知卡号是 gen 硬报错,
//      走现有「gen 失败喂回」那条路,守卫这里不另做。
//   6. 卡文件审计(v0.14.0,只在 config.cardsDir 开时):文件名与卡里的 id 不符 / JSON 解析失败
//      → 点名文件(各最多 5 个 + 总数)。这几种 gen 会硬失败,但一次只报得出第一个。
//      同一个键还让新鲜度盯住 <cardsDir>/**/*.json(卡也是 gen 输入)、让孤儿语料纳入卡文件正文。
//   6b. 验收反馈共享(v0.17.0,只在 config.acceptanceFeedback 开时):acceptance-feedback.jsonl 里
//      有没提交的新增行 → 一行「#277 新增 3 条未提交(Rico 2 · codev 1)」(依据一条 git diff,
//      没 git 就闭嘴);可清的反馈截图攒到 10 张 → 一行,给出 acc-feedback-prune.mjs 那条命令。
//      两条都非阻断,也绝不代为提交或删图。
//   7. 分支审计(v0.15.14,BL-C112 §1):当前分支相对主线带着看板改动 → 一条非阻断 notice。
//      看板只在主线上改:带回来的头文件 items/entries 会让 gen 硬报错,分支上的旧卡快照
//      会静默盖掉主线上改过的卡。口径与 board-branch-check.mjs 同一份;零命中完全不出声。
//
// plugin 化改造(设计 §6):
//   - 反向探测:detect() 找不到 kanban.config.json → 静默 exit 0(非 DDD 项目零打扰)。
//   - 看板目录有 .init-lock(kanban-init --apply 进行中)→ 放行本轮。
//   - 消息文案走 strings.mjs(zh/en,按 config.lang 选)。
//   - 版本转发(v0.16.2):hook 进程绑在起 session 那一版上,升级 plugin 后不重启 session,守卫
//     就一直是旧的 —— 而旧 gen 不许盖新板(上面的戳一票否决),看板在这个 session 里彻底停更。
//     本机已经装了不比产物旧的版本时没必要停:把整个 hook(stdin / env / cwd 原样)交给那一版的
//     stop-hook.mjs,它的 stdout 与退出码原样带回来,顺带在输出里说一行「已转发到 vX」。
//     只转发一次(DDD_HOOK_FORWARDED);读不到安装表 / 没有更新的安装 → 什么都不做,退回旧行为。
//     gen.mjs 自己那条拒绝不动:人手跑一个旧路径的 gen,照旧该被拒。
//
// 手测:echo '{}' | node scripts/stop-hook.mjs
// 接线:hooks/hooks.json → Stop
// ponytail: 新鲜度只盯 manifest/demos/gen.mjs 自身,不追 gen 引用的全仓 docs/*.md;
// 纯文档改动导致的 refs/ 过期仍需人跑 gen——要堵再解析 REF_DOCS。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { cmpVer, readPluginVersion, readStamp } from './lib-version.mjs'
import { loadStrings } from './strings.mjs'
import { prsOfCard } from './prlink.mjs'
import { SETTLE_HOLD_DAYS, TERMINAL, settleHold, settleHoldSince, settleOf } from './settle.mjs'
import { CARD_KINDS, boardRepo, cardUpdatedMap, cardsDirOf, daysBetween, localDate, scanCardDir } from './cards.mjs'
import { DEPS_FRESH_DAYS, afterOf, afterStates, clearedAt, depCtxFrom, openCount } from './deps.mjs'
import { boardBranchCheck } from './board-branch-check.mjs'
import { ACC_FB_PRUNE_DAYS, ACC_FB_PRUNE_MIN, prunable } from './acc-feedback-prune.mjs'

const KANBAN = detect()
if (!KANBAN) process.exit(0)
if (existsSync(join(KANBAN, '.init-lock'))) process.exit(0)

const S = loadStrings(KANBAN)
const DEMOS = join(KANBAN, 'demos')
const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const GEN = join(SELF_DIR, 'gen.mjs')

// stdin 原文留着:转发时要把同一份字节交给新版 hook(重新序列化会丢掉本版不认识的字段)
let hookRaw = ''
if (!process.stdin.isTTY) {
  try { hookRaw = readFileSync(0, 'utf8') } catch {}
}
let hook = {}
try { hook = JSON.parse(hookRaw) } catch {}

// 版本三件套一处取(下面的转发与①的戳判定共读同一份;readStamp 只读 index 头 1KB,读两遍也是浪费)
const INDEX = join(KANBAN, 'index.html')
const MY_VER = readPluginVersion() // null = 安装异常(plugin.json 缺失/损坏/非纯数字版本)
const STAMP = readStamp(INDEX) // 版本串 | null(有产物无戳=旧 gen 产物)| undefined(无产物,首跑)

/**
 * 本机装着的、不比产物戳旧的那一版本 plugin(v0.16.2 版本转发用)。
 * 只认同名 plugin 的安装项:先取 projectPath 命中本项目的(scope project / local),一条都没有
 * 才退到没写 projectPath 的(user 档,对所有项目生效)。version 不是纯数字点分("unknown")时
 * cmpVer 全程 NaN、比较恒 false —— 自然出局,不必另判。
 * @returns {{version: string, path: string} | null}
 */
function newerInstall(minVer, selfVer) {
  const cfgDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
  let db = null, name = ''
  try { db = JSON.parse(readFileSync(join(cfgDir, 'plugins', 'installed_plugins.json'), 'utf8')) } catch { return null }
  try { name = JSON.parse(readFileSync(join(SELF_DIR, '..', '.claude-plugin', 'plugin.json'), 'utf8')).name } catch { return null }
  const rows = []
  for (const [key, list] of Object.entries((db && db.plugins) || {})) {
    if (key.split('@')[0] !== name || !Array.isArray(list)) continue
    for (const e of list) if (e && typeof e.installPath === 'string') rows.push(e)
  }
  const here = resolve(KANBAN, '..', '..') // 看板在 <项目根>/app/kanban,倒推两级就是 detect 认定的那个项目根
  const mine = rows.filter((e) => e.projectPath && resolve(String(e.projectPath)) === here)
  const selfRoot = resolve(SELF_DIR, '..')
  let best = null
  for (const e of (mine.length ? mine : rows.filter((e) => !e.projectPath))) {
    const v = String(e.version || '')
    if (!(cmpVer(v, minVer) >= 0) || cmpVer(v, selfVer) === 0) continue
    if (resolve(e.installPath) === selfRoot) continue // 就是我自己:版本号撞了也别自己转给自己
    if (!existsSync(join(e.installPath, 'scripts', 'stop-hook.mjs'))) continue
    if (!best || cmpVer(v, best.version) > 0) best = { version: v, path: e.installPath }
  }
  return best
}

// ---- 版本转发(v0.16.2):产物比我新,而本机已装不比产物旧的版本 → 整个 hook 交给它跑 ----
{
  const stale = !process.env.DDD_HOOK_FORWARDED && MY_VER && STAMP && cmpVer(STAMP, MY_VER) > 0
  const to = stale ? newerInstall(STAMP, MY_VER) : null
  if (to) {
    const r = spawnSync(process.execPath, [join(to.path, 'scripts', 'stop-hook.mjs')], {
      cwd: process.cwd(),
      input: hookRaw,
      encoding: 'utf8',
      env: { ...process.env, DDD_HOOK_FORWARDED: to.version },
    })
    if (!r.error) { // 起不来(node 没了 / 权限)才当没转发过,退回下面的旧行为
      const note = S.hookForwarded(to.version, MY_VER, STAMP)
      const code = r.status ?? 0
      if (r.stderr) process.stderr.write(r.stderr)
      let payload = null
      // 退出码非零那一档,CC 只读 stderr、stdout 被忽略 —— 那种时候转发这行只能走 stderr
      if (code === 0) { try { payload = JSON.parse((r.stdout || '').trim() || '{}') } catch {} }
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        payload.systemMessage = payload.systemMessage ? `${note}\n${payload.systemMessage}` : note
        process.stdout.write(JSON.stringify(payload))
      } else {
        if (r.stdout) process.stdout.write(r.stdout) // 认不出的 stdout 原样透传,不吞
        process.stderr.write(`${note}\n`)
      }
      process.exit(code)
    }
  }
}

const mtime = (p) => { try { return statSync(p).mtimeMs } catch { return 0 } }
const manifests = readdirSync(KANBAN).filter((f) => f.endsWith('.json'))
let demos = []
try { demos = readdirSync(DEMOS).filter((f) => f.endsWith('.html')) } catch {}

// 非阻断通知(戳警告 / 安装异常 / 自愈提示),最终与审计结果合并成单条 JSON 输出
const notices = []
// 阻断项(孤儿 demo / 新卡长正文):每项两副面孔 —— block 是拦下来时说的,warn 是同一次收工已经
// 拦过一次时(stop_hook_active)降级放行说的。多项合成一条 reason,免得一次只报得出一个。
const blocks = []

// ---- 一卡一文件(v0.14.0,config.cardsDir):扫一遍卡目录,新鲜度/孤儿语料/下面几段审计共用 ----
// 未配 cardsDir = 全为空,一切照旧。
let CARDS_DIR = ''
try { CARDS_DIR = cardsDirOf(JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8'))) } catch {}
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
/** 卡的读法一处定:cardsDir 开 = 逐文件,关 = 头文件里的数组(下面几段审计共用) */
const cardsOf = (file, key, sub) => {
  if (CARDS_DIR && sub) {
    const s = cardScan[sub]
    return s && !s.missing ? s.cards.map((x) => x.card) : []
  }
  try { return JSON.parse(readFileSync(join(KANBAN, file), 'utf8'))[key] || [] } catch { return [] }
}
const CARD_SOURCES = [['manifest.json', 'tasks', null], ['backlog-manifest.json', 'items', 'backlog'], ['decisions-manifest.json', 'entries', 'decisions']]

/**
 * 卡目录里已经进了 HEAD 的卡文件,键取路径末两段(`<sub>/<id>.json`)—— git 报的路径相对仓根还是
 * 相对 cwd 随命令而变,末两段两种都对得上。按需算一次(一条 git ls-tree)。
 * 返回 null = 这块板问不出「提交了没」(没配 cardsDir / 没有 git / 还没有 HEAD)——那种时候
 * 「新卡」只由卡上的 date 判定:宁可不拦,也不拿不确定当阻断的依据。
 */
let COMMITTED
function committedCards() {
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

/** 「刚立的卡」(v0.16.2):卡文件还没提交进 HEAD,或卡上的 date 就是今天。 */
const TODAY = localDate() // 一处取:同一次收工里「今天」不该在逐卡循环中间翻页
const isFreshCard = (c, sub) => {
  if (String(c.date || '') === TODAY) return true
  const done = sub ? committedCards() : null // manifest.json 的 tasks 不拆卡,只走 date 那一档
  return Boolean(done && !done.has(`${sub}/${String(c.id ?? '')}.json`))
}

/** 每卡最后改动日,按需算一次(一条 git log)。未拆卡 = 空表 —— 那种板取不到「这张卡什么时候动的」。 */
let CARD_UPD = null
function cardUpdAll() {
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

/** 前置依赖(after)的推导上下文,按需建一次 —— ⑥ 积压计数与 ⑧ 前置已清共用同一份口径(deps.mjs) */
let DEP_CTX = null
function depCtx() {
  if (DEP_CTX) return DEP_CTX
  const cards = []
  const heads = []
  for (const [f, k, sub] of CARD_SOURCES) {
    for (const c of cardsOf(f, k, sub)) if (c && c.id) cards.push(c)
    try { heads.push(JSON.parse(readFileSync(join(KANBAN, f), 'utf8'))) } catch { heads.push(null) }
  }
  DEP_CTX = depCtxFrom({ cards, repo: boardRepo(...heads), rlm: RLM })
  return DEP_CTX
}

// 卡文件审计:gen 遇到这些直接 throw,但一次只报得出第一个;这里一次列全,少来回几趟。
// 排在新鲜度之前 —— 正是这些错会让下面那趟 gen 失败,消息得赶在那之前备好。
{
  const idBad = [], parseBad = []
  for (const k of CARD_KINDS) {
    const s = cardScan[k.sub]
    if (!s) continue
    const rel = `${CARDS_DIR}/${k.sub}`
    if (s.missing) { notices.push(S.cardsDirMissing(rel)); continue }
    for (const x of s.bad) {
      if (x.kind === 'parse') parseBad.push({ file: `${rel}/${x.file}`, message: x.message })
      else idBad.push({ file: `${rel}/${x.file}`, id: x.id })
    }
  }
  if (idBad.length) notices.push(S.cardIdBad(idBad.slice(0, 5), idBad.length))
  if (parseBad.length) notices.push(S.cardParseBad(parseBad.slice(0, 5), parseBad.length))
}

// ---- ① 新鲜度 → 自动重跑 gen(gen.mjs 未随 plugin 落地时跳过) ----
if (existsSync(GEN)) {
  const indexAt = mtime(INDEX)
  const newest = Math.max(
    mtime(GEN),
    mtime(join(KANBAN, 'theme.css')), // v0.4.0 换装:theme 是 gen 输入;缺席时 mtime=0,零影响
    ...manifests.map((f) => mtime(join(KANBAN, f))),
    ...demos.map((f) => mtime(join(DEMOS, f))),
    ...cardWatch.map(mtime), // v0.14.0 一卡一文件:卡也是 gen 输入;未配 cardsDir 时为空,零影响
  )
  // v0.11.0:lazyTabs 板若 parts/ 缺件(手删/半拷贝),index 再新也是残废态 → 视同过期重跑自愈
  // v0.14.0:归档是 0.13.0 起的第三个 part —— 漏掉它,深链到已归档的卡就静默落空,而 index 是
  // 新的,守卫永远不会重跑。门控照 gen:backlogArchive 开着才有 archive.html。
  let lazyBroken = false
  try {
    const c = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8'))
    // v0.15.0:验收与发布进度也进了 parts,门控照 gen(各自的 tab 开着才有那一份)
    const parts = ['decisions.html', 'backlog.html', ...(c.backlogArchive === true ? ['archive.html'] : []),
      ...(c.acceptanceTab === true ? ['acceptance.html'] : []), ...(c.releaseTab === true ? ['release.html'] : [])]
    lazyBroken = c.lazyTabs === true && !parts.every((f) => existsSync(join(KANBAN, 'parts', f)))
  } catch {}
  // MY_VER / STAMP 在文件头取过一份(版本转发与这里同一份口径);走到这儿说明没转发出去。
  const stampNewer = Boolean(MY_VER && STAMP && cmpVer(STAMP, MY_VER) > 0)
  const stampStale = Boolean(MY_VER && STAMP !== undefined && (STAMP === null || cmpVer(STAMP, MY_VER) < 0))
  if (stampNewer) {
    notices.push(S.stampNewer(STAMP, MY_VER)) // 只否决重生成;审计(只读)在下面照做
  } else if (!MY_VER) {
    // gen 读不到自身版本必硬失败——别 spawn 一个注定 exit 2 的 gen 造不可自修的阻断循环
    if (newest > indexAt) notices.push(S.noSelfVersion())
  } else if (newest > indexAt || stampStale || lazyBroken) {
    const r = spawnSync(process.execPath, [GEN], { cwd: KANBAN, stdio: ['ignore', 'ignore', 'pipe'] })
    const err = (r.stderr || r.error?.message || '').toString()
    if (r.status !== 0) {
      // gen 只报得出第一个坏卡,已攒下的 notice(坏卡清单等)一并喂回去,免得一个一个试
      const why = S.genFail(err.slice(0, 800)) + (notices.length ? '\n' + notices.join('\n') : '')
      if (hook.stop_hook_active) { // 防死循环:同一次收工已拦过 → 降级警告放行
        console.log(JSON.stringify({ systemMessage: why }))
        process.exit(0)
      }
      process.stderr.write(why)
      process.exit(2) // 阻断:stderr 喂回给 Claude 自修(manifest 语法错等可修项)
    }
    // gen 成功但带警告(themeColors 未知色组/键、sessionTags 灰章、空 theme.css、指南过大、md 退化…)→ 原样透传,别吞
    if (err.trim()) process.stderr.write(err)
    // 自愈自「无戳产物」= 刚被旧 gen 盖过板(或 0.6.0 前存量)的签名 → 现场指向断火源解药
    if (stampStale && STAMP === null) notices.push(S.healedUnstamped())
  }
}

// ---- ② 孤儿 demo 审计 ----
// 语料 = 三份 manifest + 卡文件(cardsDir 开着时 demo 链接就写在卡里,不纳入即全员误报孤儿)
const corpus = manifests
  .map((f) => { try { return readFileSync(join(KANBAN, f), 'utf8') } catch { return '' } })
  .concat(cardWatch.map((p) => { try { return readFileSync(p, 'utf8') } catch { return '' } }))
  .join('\n')
let allow = []
try {
  allow = readFileSync(join(DEMOS, '.no-card-ok'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
} catch {}
// 合订引用(v0.10.0):被已豁免 demo 用 iframe 内嵌的同目录子页随之豁免,逐层传递(合订页可再被合订)。
// 只认同目录裸文件名引用(同源内嵌是合订术前提;带路径/锚/查询串的不认),引用断了照常报孤儿。
const IFRAME_REF_RE = /<iframe\b[^>]*?\b(?:data-src|src)\s*=\s*(?:"([^"#?]+)"|'([^'#?]+)')/gi
const refsOf = new Map()
for (const f of demos) {
  let html = ''
  try { html = readFileSync(join(DEMOS, f), 'utf8') } catch { continue }
  const set = new Set()
  for (const m of html.matchAll(IFRAME_REF_RE)) {
    const t = (m[1] ?? m[2]).trim().replace(/^\.\//, '')
    if (t && !t.includes('/') && t.endsWith('.html') && t !== f) set.add(t)
  }
  if (set.size) refsOf.set(f, set)
}
const covered = new Set(demos.filter((f) => corpus.includes(f) || allow.includes(f)))
for (let grew = true; grew;) {
  grew = false
  for (const [f, set] of refsOf) {
    if (!covered.has(f)) continue
    for (const t of set) if (!covered.has(t) && demos.includes(t)) { covered.add(t); grew = true }
  }
}
const orphans = demos.filter((f) => !covered.has(f))

// ---- ③ 验收审计(v0.12.0):acceptanceTab 开 + 清单在场才跑,全部非阻断 notice ----
// 清单是人写的正文,坏一条不该拦收工;这里只负责「让人看见」,gen 侧另有同款 console.warn。
{
  let accOn = false
  try { accOn = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8')).acceptanceTab === true } catch {}
  const accPath = join(KANBAN, 'acceptance-manifest.json')
  if (accOn && existsSync(accPath)) {
    let acm = null
    try { acm = JSON.parse(readFileSync(accPath, 'utf8')) }
    catch (e) { notices.push(S.accParseFail(e.message)) }
    if (acm) {
      const lists = (acm.lists || []).map((l) => {
        const nums = (Array.isArray(l.pr) ? l.pr : [l.pr]).map(Number).filter((n) => Number.isFinite(n) && n > 0)
        return { ...l, nums, key: nums.join('-') }
      })
      const cur = acm.current == null ? null : Number(acm.current)
      if (cur !== null && !lists.some((l) => l.nums.includes(cur))) notices.push(S.accCurrentNoList(cur))
      const owner = new Map()
      for (const l of lists) for (const n of l.nums) {
        if (owner.has(n)) notices.push(S.accDupPr(n, owner.get(n), l.key))
        else owner.set(n, l.key)
      }
      // 卡号全集:三份 manifest 的 tasks / items / entries(cardsDir 开着时后两者来自卡目录)
      const ids = new Set()
      for (const [f, k, sub] of CARD_SOURCES) {
        for (const c of cardsOf(f, k, sub)) if (c && c.id) ids.add(String(c.id))
      }
      for (const l of lists) {
        const seen = new Set()
        for (const it of l.items || []) {
          const id = String((it || {}).id ?? '')
          if (seen.has(id)) notices.push(S.accDupItem(l.key, id))
          seen.add(id)
        }
        for (const c of l.cards || []) if (!ids.has(String(c))) notices.push(S.accUnknownCard(l.key, c))
      }
    }
  }
}

// ---- ④ 正文长度审计(v0.13.0,只在 config.richText 开时跑):超长字段而无 detail 的卡 ----
// detail 字段本身受 richText 门控,没开的板催也白催。
// 分两档(v0.16.2):**刚立的卡阻断**,已提交的老卡照旧一行非阻断提醒(张数 + 最长的那张)。
// 分档的依据是时机不是严厉程度 —— 新卡的正文刚写出来还在手边,当场拆最省事、也只有此刻拆得动;
// 老卡是历史,拦下来只会逼人去改一份别人也在读的卡,于是通知永远缩不掉(0.15.6 的终态豁免同理)。
{
  let richOn = false
  try { richOn = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8')).richText === true } catch {}
  if (richOn) {
    const LONG = 800
    let total = 0, worst = null // 老卡那一行只需要这两样:张数,与最长的那张(卡号 + 字段)
    const fresh = [] // 新卡逐张列:阻断消息要说清「改哪张的哪个字段、多长」
    for (const [f, k, sub, fields] of [
      ['manifest.json', 'tasks', null, ['problem', 'approach', 'notes']],
      ['backlog-manifest.json', 'items', 'backlog', ['problem', 'approach', 'note']],
      ['decisions-manifest.json', 'entries', 'decisions', ['question', 'decision', 'demoNote', 'source']],
    ]) {
      for (const c of cardsOf(f, k, sub)) {
        if (!c || c.detail) continue
        if (TERMINAL.has(String(c.status || ''))) continue // 终态卡(done / live / closed)不会再改写,点名只会让这条通知永远缩不掉
        let hit = null // 一张卡只算一次,取最长的那个字段
        for (const key of fields) {
          const n = typeof c[key] === 'string' ? c[key].length : 0
          if (n > LONG && (!hit || n > hit.n)) hit = { key, n }
        }
        if (!hit) continue
        if (isFreshCard(c, sub)) { fresh.push({ id: String(c.id ?? '?'), key: hit.key, n: hit.n }); continue }
        total++
        if (!worst || hit.n > worst.n) worst = { id: String(c.id ?? '?'), key: hit.key, n: hit.n }
      }
    }
    if (total) notices.push(S.richLongText(worst, total))
    if (fresh.length) {
      fresh.sort((a, z) => z.n - a.n) // 最长的排前面 —— 点名封顶 5 张时,先说最该拆的那几张
      const top = fresh.slice(0, 5)
      blocks.push({ block: S.richLongNewBlock(top, fresh.length), warn: S.richLongNewWarn(top, fresh.length) })
    }
  }
}

// release-manifest:⑤(进度响应)与 ⑧(前置已清)共读这一份;坏 JSON / 缺席 = null,两段各自按「没有依据」处理
let RLM = null
{
  const relPath = join(KANBAN, 'release-manifest.json')
  if (existsSync(relPath)) {
    try { RLM = JSON.parse(readFileSync(relPath, 'utf8')) } catch {} // 坏 JSON:gen 已经出过声,守卫不重复吵
  }
}

// ---- ⑨ 验收反馈共享(v0.17.0,只在 config.acceptanceFeedback 开时跑):两条非阻断 notice ----
// (a) acceptance-feedback.jsonl 里新增了几行还没提交 —— 那是验收现场的账,留在工作区里等于没留;
//     依据一条 git diff(没 git / 问不出来就闭嘴,不拿不确定当依据)。
// (b) 可清的反馈截图攒到 10 张 —— 说一行,绝不自动删(删图是人的决定,脚本只报数)。
{
  let fbOn = false
  try { fbOn = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8')).acceptanceFeedback === true } catch {}
  const fbPath = join(KANBAN, 'acceptance-feedback.jsonl')
  if (fbOn && existsSync(fbPath)) {
    // (a) 未提交的新增行:git diff 认得已跟踪文件的增行;还没 add 过的整份文件全算新增
    const git = (args) => spawnSync('git', args, { cwd: KANBAN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
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
      notices.push(S.accFbUncommitted(rows.slice(0, 2), rows.length))
    }
    // (b) 可清的截图:与 acc-feedback-prune.mjs 同一把尺(合并日取 release-manifest)
    if (RLM) {
      let files = []
      try { files = readdirSync(join(KANBAN, 'shots')).filter((f) => f.startsWith('acc-')) } catch {}
      if (files.length >= ACC_FB_PRUNE_MIN) {
        const rows = prunable(files, RLM, ACC_FB_PRUNE_DAYS, TODAY)
        if (rows.length >= ACC_FB_PRUNE_MIN) notices.push(S.accFbPrunable(rows.length, ACC_FB_PRUNE_DAYS))
      }
    }
  }
}

// ---- ⑤ 进度响应审计(v0.13.0,只在 release-manifest.json 在场时跑):待收账 / 已收账但 PR 未合 ----
// 与卡上的芯片同一口径(settle.mjs),两边都只提示 —— 「PR 合了」≠「卡可以收」,静默改 manifest
// 会跟并行会话抢写。收账走 pr-sync.mjs --settle(默认还只打印)。
{
  const rlm = RLM
  if (rlm) {
    const relPr = new Map()
    for (const p of (rlm && rlm.prs) || []) if (p && p.number != null) relPr.set(Number(p.number), p)
    const settle = [], reopen = [], held = [] // held:写了 settleHold 的卡 + 起算日(下面算到期)
    if (relPr.size) {
      for (const [f, k, sub] of CARD_SOURCES) {
        let data = null
        try { data = JSON.parse(readFileSync(join(KANBAN, f), 'utf8')) } catch { continue }
        const repo = String((data.instance || {}).ghRepo || '') // instance 始终在头文件里,与卡拆不拆无关
        if (!repo) continue
        for (const c of cardsOf(f, k, sub)) {
          if (!c || !c.id) continue
          if (settleHold(c)) { held.push({ id: String(c.id), since: settleHoldSince(c) }); continue } // settleHold = 人看过了,别再催(只记下起算日,见下面的到期提醒)
          const s = settleOf(c, prsOfCard(c, repo), relPr, repo)
          if (s.kind === 'settle') settle.push(String(c.id))
          else if (s.kind === 'reopen') reopen.push(String(c.id))
        }
      }
    }
    if (settle.length) notices.push(S.respSettle(settle.slice(0, 5), settle.length))
    if (reopen.length) notices.push(S.respReopen(reopen.slice(0, 5), reopen.length))

    // 挂账到期提醒(v0.15.14,BL-C112 §3):hold 是承诺不是遗忘,挂满 SETTLE_HOLD_DAYS 天说一行。
    // 只提醒 —— 不解除静音、不改卡:到期的判断仍然只能由人做,守卫替人记的只是「多久了」。
    // 0.15.14 之前挂上的老卡没有 settleHoldAt,退到卡文件最后改动日(与 gen 的 .udate 同一份口径);
    // 未拆卡的板取不到「这张卡什么时候动的」,那种老卡就不催 —— 宁可不出声,也不拿假日期点名。
    if (held.length) {
      if (held.some((h) => !h.since)) {
        const upd = cardUpdAll()
        for (const h of held) if (!h.since) h.since = upd.get(h.id) || ''
      }
      const today = localDate()
      const old = held
        .map((h) => ({ id: h.id, days: daysBetween(h.since, today) }))
        .filter((h) => Number.isFinite(h.days) && h.days >= SETTLE_HOLD_DAYS)
        .sort((a, z) => z.days - a.days)
      if (old.length) notices.push(S.respHoldOld(old.slice(0, 5).map((h) => h.id), old[0].days, old.length))
    }
  }
}

// ---- ⑧ 前置已清(v0.16.0):等前置的卡刚被解锁,说一行 ----
// 与卡头那枚芯片同一份 deps.mjs 判据。清除日是推导出来的(卡 status / PR mergedAt / 版本 at),
// 所以不需要状态文件、也不必记「上次说过没有」—— 7 天窗口过了它自己就闭嘴。
// 「今天」用 localDate(本地日历,与 CLI 写 date 的口径同源);gen 那边一个时钟都不读,窗口只住在这儿。
{
  const cards = []
  for (const [f, k, sub] of CARD_SOURCES) for (const c of cardsOf(f, k, sub)) if (c && c.id) cards.push(c)
  if (cards.some((c) => afterOf(c).length)) {
    const ctx = depCtx()
    const today = localDate()
    const rows = []
    for (const c of cards) {
      if (String(c.status || '') !== 'ready') continue
      const list = afterStates(c, ctx)
      if (!list.length || openCount(list)) continue
      const at = clearedAt(list)
      if (!at) continue // 取不到清除日(未拆卡的板上,卡号前置就是这样)—— 宁可不出声,也不拿假日期点名
      const days = daysBetween(at, today)
      if (!Number.isFinite(days) || days > DEPS_FRESH_DAYS) continue
      rows.push({ id: String(c.id), at, items: list })
    }
    rows.sort((a, z) => (a.at < z.at ? 1 : a.at > z.at ? -1 : 0)) // 最近清的先(同日保持板上顺序)
    if (rows.length) notices.push(S.depsUnlocked(rows.slice(0, 5), rows.length))
  }
}

// ---- ⑦ 看板改动落在非主线分支上(v0.15.14,BL-C112 §1):非阻断,零命中完全不出声 ----
// 规矩是「看板只在主线上改」;这里只看当前分支(全表走 board-branch-check.mjs --all)。
// git 不可用 / 找不到主线 / 就在主线上 → 一个字都不说,也不多花一次 spawn。
{
  const r = boardBranchCheck(KANBAN, S)
  // dirty = 工作区里没提交的看板改动:补救那条 checkout 会连它们一起盖掉,清单不说就是安静地丢内容
  if (!r.skip) for (const h of r.hits) notices.push(S.boardBranchGuard(h, r.main, r.dirty))
}

// ---- ⑥ 积压审计(v0.13.0,只在 config.wip 配了对象时跑):ready 超 hard 就说一声 ----
// 与卡上的横幅同一口径(只数 ready),但守卫看的是全线别的总数 —— 分线别的账在页面上看。
{
  let wip = null
  try {
    const c = JSON.parse(readFileSync(join(KANBAN, 'kanban.config.json'), 'utf8'))
    if (c.wip && typeof c.wip === 'object' && !Array.isArray(c.wip)) wip = c.wip
  } catch {}
  if (wip) {
    const hard = Number.isFinite(wip.hard) ? wip.hard : 20
    // 口径与卡上的横幅同一条(v0.16.0):ready 且前置已清才算「可立即做」,等前置的另报一个数。
    // 板上一条 after 都没有时 waiting 恒 0,这句话与 0.15.x 一字不差。
    const ready = cardsOf('backlog-manifest.json', 'items', 'backlog').filter((it) => it && it.status === 'ready')
    const waiting = ready.some((it) => afterOf(it).length)
      ? ready.filter((it) => openCount(afterStates(it, depCtx()))).length
      : 0
    const n = ready.length - waiting
    if (n > hard) notices.push(S.wipOver(n, hard, waiting))
  }
}

// ---- 出口:阻断项合成一条(孤儿 demo 排最前 —— 它是最老、也最容易一步补掉的那条规矩)----
if (orphans.length) {
  const list = orphans.map((f) => `  - app/kanban/demos/${f}`).join('\n')
  blocks.unshift({ block: S.orphanBlock(orphans.length, list), warn: S.orphanWarn(orphans.length, list) })
}

if (blocks.length === 0) {
  if (notices.length) console.log(JSON.stringify({ systemMessage: notices.join('\n') }))
  process.exit(0)
}

if (hook.stop_hook_active) { // 防死循环:同一次收工已拦过 → 全体降级成警告放行
  console.log(JSON.stringify({ systemMessage: [...blocks.map((b) => b.warn), ...notices].join('\n') }))
  process.exit(0)
}
console.log(JSON.stringify({
  decision: 'block',
  reason: blocks.map((b) => b.block).join('\n\n'),
  ...(notices.length ? { systemMessage: notices.join('\n') } : {}),
}))
