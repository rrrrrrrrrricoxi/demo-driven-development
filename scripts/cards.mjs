// 一卡一文件(v0.14.0,config.cardsDir)。gen / 守卫 / pr-sync / 迁移脚本共用同一条读卡口径 ——
// 顶层无副作用,可直接 import。
//
//   <kanban>/<cardsDir>/backlog/BL-C87.json    = 原 backlog-manifest.json items[] 的一个元素
//   <kanban>/<cardsDir>/decisions/D77.json     = 原 decisions-manifest.json entries[] 的一个元素
//
// 为什么:并行会话写同一份 400KB manifest 会互相带走(整文件重写,git 不报冲突);按卡写之后
// 每张卡自己一个路径,冲突要么不发生、要么 git 拦得住,顺带每张卡有了自己的 git 历史。
//
// 一个真源:头文件里还留着 items/entries 即硬报错;文件名必须等于卡的 id,同一 id 只许出现一次。
//
// 顺序:数组顺序在 gen 里就是显示顺序 —— decisionRank 决定截图廊的组序、LAZY_IDMAP 决定深链表
// 的键序、byDateDesc 是稳定排序(同日同号时数组先后即先后)。所以拆分时给每张卡写入 order =
// 原数组下标,读回时按 order 再按 id 排,排完把 order 删掉:卡对象与拆分前逐字段相同。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { pickStrings } from './strings.mjs'

/** 拆分的两类卡(manifest.json 的 tasks 不拆:34 条、迭代级摘要、改动少) */
export const CARD_KINDS = [
  { sub: 'backlog', manifest: 'backlog-manifest.json', key: 'items' },
  { sub: 'decisions', manifest: 'decisions-manifest.json', key: 'entries' },
]

/**
 * 卡目录名必须是看板目录下的一个纯目录名 —— 与 gen 对 docs[].out 同一条规矩。
 * 带路径分隔符或 .. 的值会把整个卡库搬到看板目录外面:gen / CLI / 守卫都跟着走,一切看着正常,
 * 而 `git add app/kanban` 提交出去的板一张卡都没有,别人克隆下来就是空的。
 */
export const cardsDirUnsafe = (s) => /[/\\]/.test(s) || s === '.' || s === '..'

/**
 * 每类卡的时间线字段(一处定,ddd 与 pr-sync 共用)。
 * manifest.json 的 tasks 用 notes、backlog 的 items 用 note,决策卡没有 —— gen 的 decCard 不渲染
 * note/notes 里的任何一个字,往那儿写就是写一个没人读得到的字段,还骗人说「记下了」。
 */
export const NOTE_FIELD = { tasks: 'notes', items: 'note', entries: '' }

/**
 * 本地日历日的 'YYYY-MM-DD'(v0.15.16 起从 ddd.mjs 抠出来,ddd 与测试床共用同一份口径)。
 * 卡上的 date / settleHoldAt 记的都是「人在本地过的哪一天」,取 getFullYear/Month/Date;
 * 与 cardUpdatedMap 那条 toISOString().slice(0, 10) 的 UTC mtime 兜底是两码事,别混——那条
 * 兜底本就该按 UTC(gen 也是 UTC 格式化 mtime),这条要的是本地日历。
 * @param d 默认取当前时刻
 */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** config.cardsDir 归一:非空字符串才算开,首尾斜杠去掉;其它一切(缺席/false/空串)= 关。
 *  值逃出看板目录时抛 —— 悄悄当「没配」会让 gen 拿不到卡却也不报错,那更难查。 */
export function cardsDirOf(cfg) {
  const v = cfg && cfg.cardsDir
  if (typeof v !== 'string') return ''
  const dir = v.trim().replace(/^\/+|\/+$/g, '')
  if (dir && cardsDirUnsafe(dir)) throw new Error(pickStrings(cfg && cfg.lang).cards.cardsDirUnsafe(v))
  return dir
}

/**
 * 扫一个卡目录。不抛 —— 调用方(gen 硬报错 / 守卫非阻断 notice)自己决定怎么处置。
 * 文件按名排序后读,保证与文件系统的返回顺序无关。
 * @returns { missing, files, cards: [{ file, card }], bad: [{ file, kind, id?, message? }] }
 */
export function scanCardDir(dir) {
  let names
  try { names = readdirSync(dir) } catch { return { missing: true, files: [], cards: [], bad: [] } }
  const files = names.filter((f) => f.endsWith('.json')).sort()
  const cards = [], bad = []
  for (const f of files) {
    let card = null
    try { card = JSON.parse(readFileSync(join(dir, f), 'utf8')) }
    catch (e) { bad.push({ file: f, kind: 'parse', message: e.message }); continue }
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      bad.push({ file: f, kind: 'parse', message: 'not a JSON object / 不是 JSON 对象' })
      continue
    }
    const id = String(card.id ?? '')
    if (id !== f.slice(0, -5)) { bad.push({ file: f, kind: 'id', id }); continue }
    cards.push({ file: f, card })
  }
  return { missing: false, files, cards, bad }
}

/** 按 order(拆分写入的原下标)再按 id 排序;就地排,返回同一数组 */
export function sortCards(cards) {
  return cards.sort((a, z) => {
    const oa = Number.isFinite(a.order) ? a.order : Infinity
    const oz = Number.isFinite(z.order) ? z.order : Infinity
    if (oa !== oz) return oa < oz ? -1 : 1
    const ia = String(a.id ?? ''), iz = String(z.id ?? '')
    return ia < iz ? -1 : ia > iz ? 1 : 0
  })
}

/** order 是读期排序键,排完即删 —— 卡对象从此与拆分前逐字段相同(gen 用;写回文件的不许删) */
export function stripOrder(cards) {
  for (const c of cards) delete c.order
  return cards
}

/** 卡文件文本:2 空格缩进 + 末尾换行(拆分、CLI、任何写卡的地方同一份) */
export function cardText(card) { return JSON.stringify(card, null, 2) + '\n' }

/**
 * 每卡最后改动日(v0.14.0 起 gen 在用,v0.15.14 起守卫也读同一份)。一条 git log 批量取每个卡
 * 文件的最后提交日,不是一卡一条命令;git 失败 / 文件还没提交 → 文件 mtime → 空。
 * 取的是已提交的事实:同一个 commit 下同输出,不破 gen 的确定性。
 * @param kanbanDir 看板目录(git 命令的 cwd,也是相对路径的根)
 * @param cardsDir  config.cardsDir
 * @param srcOf     Map<id, '<cardsDir>/<sub>/<id>.json'>(相对看板目录)
 * @returns Map<id, 'YYYY-MM-DD' | ''>
 */
export function cardUpdatedMap(kanbanDir, cardsDir, srcOf) {
  const byPath = new Map() // git 的路径相对仓根,不相对看板目录,故只认末两段
  try {
    const out = execFileSync('git', ['log', '--format=%cs', '--name-only', '--', cardsDir],
      { cwd: kanbanDir, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString()
    let day = ''
    for (const raw of out.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      if (/^\d{4}-\d{2}-\d{2}$/.test(line)) { day = line; continue }
      const k = line.split('/').slice(-2).join('/')
      if (day && !byPath.has(k)) byPath.set(k, day) // git log 是新→旧,第一次见到即最后一次改动
    }
  } catch { /* 无 git / 命令失败 → 整批退 mtime */ }
  const out = new Map()
  for (const [id, rel] of srcOf) {
    let d = byPath.get(rel.split('/').slice(-2).join('/')) || ''
    if (!d) { try { d = statSync(join(kanbanDir, rel)).mtime.toISOString().slice(0, 10) } catch { d = '' } }
    out.set(id, d)
  }
  return out
}

/**
 * 去掉「每卡更新日期」带来的字节。拆前 / 拆后对比时用:除了这个日期本身,一卡一文件
 * 不该改动产物的任何一个字节。它波及三处 ——
 *   1. 卡头那枚灰字与它那条 CSS(新增的标记);
 *   2. LAZY_BYTES(parts 的未压缩长度,多几枚 span 就多几个字节;parts 本身另比,漏不掉真差异);
 *   3. data-dorm 的取值(沉睡天数改从卡文件最后改动日起算,这是 cardsDir 的既定行为);
 *   4. data-hold 的取值(v0.15.14:没写 settleHoldAt 的老卡,挂账天数同样从卡文件最后改动日起算)。
 */
export function stripCardUpdated(html) {
  return String(html)
    .replace(/<span class="udate"[^>]*>[^<]*<\/span>/g, '')
    .replace(/\n +\/\* =+ 每卡更新日期[^\n]*\n +\.udate \{[^\n]*/g, '')
    .replace(/const LAZY_BYTES = \{[^}]*\}/g, 'const LAZY_BYTES = {}')
    .replace(/ data-dorm="[^"]*"/g, ' data-dorm=""')
    .replace(/ data-hold="[^"]*"/g, ' data-hold=""')
    // backlogSort 的排序尺子(v0.15.12)也是拆分之后才有的新事实,与 .udate / data-dorm 同一类
    .replace(/ data-udate="[^"]*"/g, ' data-udate=""')
    // 总览的「近 7 天动过的卡」也只在一卡一文件之后才有事实可依(v0.15.0)——
    // 与 .udate 同一类:拆分带来的新事实,不是拆分改坏了看板
    .replace(/\n +<section class="ovrow[^"]*" data-ovrow="recent">[\s\S]*?<\/section>/g, '')
}
