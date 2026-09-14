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
//      v0.17.4 起叠加分支维度(生成物只在主线上生成):不是主线(含游离 HEAD)一律跳过重渲,产物
//      一个字节不碰、审计照跑,且只在「本来会重渲」时出一行。理由是几 MB 的派生状态落在分支上,
//      会在别的会话里反复烧 token(先分辨、再清、合并必冲突)。人手跑 gen.mjs 不受此限(明确意图)。
//   1b. 生成物的三条机械提醒(v0.17.4):分支工作区里已有的脏产物 / 处在冲突状态的产物 /
//      .gitattributes 写了 merge=ours 却没在这个克隆里定义驱动。都非阻断,零命中完全不出声。
//   2. 审计:全部搬去 audits.mjs(v0.17.5)—— 那一份同时供 `ddd.mjs audit` 调用,不许有第二份
//      实现。各类审计做什么、为什么这么判,写在 audits.mjs 的文件头与各函数上;这里只负责
//      「算出来之后怎么说」。
//
// 输出分三级(v0.17.5 评审稿;归级依据是「不处理会怎样」,不是严厉程度):
//   - **阻断**(孤儿 demo、新卡长正文无 detail):照旧全文,两副面孔 —— block 是拦下来时说的,
//     warn 是同一次收工已经拦过一次时(stop_hook_active)降级放行说的。
//   - **坏了**(卡目录缺 / 卡号非法 / 卡 JSON 坏 / 验收清单坏·重复 PR·重复条目·未知卡号 /
//     看板产物混进分支 / 生成物冲突 / merge=ours 驱动未配 / 看板改动落在非主线分支,
//     外加下面 ① 那几条重生成副产品:戳更新、安装异常、非主线不重渲、无戳自愈、gen 跑失败):
//     照旧各出一段全文。这一级平时恒为零 —— 一出现就是真坏了,压成数字等于把它藏起来。
//   - **家务**(长正文老卡、验收反馈未提交、可清截图、待收账、收早了、挂账到期、前置已清、
//     积压超阈,共八类):压成一行计数「看板守卫:长正文 10 · 收早了 1 · … —— 详情 node …/ddd.mjs
//     audit」。零的类别不出现,八类全零这行整条不出。理由:它们平时常有、多半还是别条线的账,
//     每条会话每次收工全文灌一遍,等于人人为别人的家务活付 token;数字就是索引,谁在意谁跑命令。
//     只有「未提交反馈」在括号里带 PR 号 —— 它关乎别人的数据,光给个数判断不了该不该现在管。
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
import { existsSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { cmpVer, readPluginVersion, readStamp } from './lib-version.mjs'
import { loadStrings } from './strings.mjs'
import { boardBranchCheck } from './board-branch-check.mjs'
import { CARD_FILE_KEYS, auditCmd, choreLine, collect, makeCtx, pickLevel } from './audits.mjs'

const KANBAN = detect()
if (!KANBAN) process.exit(0)
if (existsSync(join(KANBAN, '.init-lock'))) process.exit(0)

const S = loadStrings(KANBAN)
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

// ---- 这棵树现在在哪条分支上(v0.17.4 §1)。一次算清,①(要不要重渲)与分支/生成物审计共读 ----
// 口径全在 board-branch-check.mjs:主线名怎么解析、游离 HEAD 算不算一个位置,都不在这儿再写一遍。
// scanned === 0 ⟺ 当前位置就是主线(那份实现把主线本身从待比清单里滤掉了);游离 HEAD 的 cur 是
// 短 sha,滤不掉,于是 scanned === 1 —— 正是「不是主线」。
// skip(不在 git 仓 / git 跑不起来 / 找不到主线)= 问不出分支,那就照旧重渲:宁可多渲一次,
// 也不能让非 git 的板与找不到主线的克隆从此永远停更。
const BRANCH = boardBranchCheck(KANBAN, S)
const ON_MAIN = Boolean(BRANCH.skip) || BRANCH.scanned === 0

// ---- 审计一次跑完(v0.17.5:实现全在 audits.mjs,`ddd.mjs audit` 调的是同一份)----
// 跑在重跑 gen 之前:审计全是只读的,而卡文件那几条正是会让那趟 gen 失败的东西,消息得先备好。
const CTX = makeCtx(KANBAN)
const AUDIT = collect(CTX, S, { branch: BRANCH, gen: GEN })
// 阻断项(孤儿 demo / 新卡长正文):每项两副面孔 —— block 是拦下来时说的,warn 是同一次收工已经
// 拦过一次时(stop_hook_active)降级放行说的。多项合成一条 reason,免得一次只报得出一个。
const blocks = pickLevel(AUDIT, 'block').map((e) => ({ block: e.text, warn: e.warn }))
const BROKEN = pickLevel(AUDIT, 'broken')
// 非阻断通知。卡文件那几条先进去 —— gen 跑失败时要连它们一块喂回去,免得人一个一个试。
const notices = BROKEN.filter((e) => CARD_FILE_KEYS.has(e.key)).map((e) => e.text)

// ---- ① 新鲜度 → 自动重跑 gen(gen.mjs 未随 plugin 落地时跳过) ----
if (existsSync(GEN)) {
  const indexAt = mtime(INDEX)
  const newest = Math.max(
    mtime(GEN),
    mtime(join(KANBAN, 'theme.css')), // v0.4.0 换装:theme 是 gen 输入;缺席时 mtime=0,零影响
    ...CTX.manifests.map((f) => mtime(join(KANBAN, f))),
    ...CTX.demos.map((f) => mtime(join(KANBAN, 'demos', f))),
    ...CTX.cardWatch.map(mtime), // v0.14.0 一卡一文件:卡也是 gen 输入;未配 cardsDir 时为空,零影响
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
  const wouldRegen = newest > indexAt || stampStale || lazyBroken // 「本来会重渲」:§1 那一行只在这时才出
  if (stampNewer) {
    notices.push(S.stampNewer(STAMP, MY_VER)) // 只否决重生成;审计(只读)在下面照做
  } else if (!MY_VER) {
    // gen 读不到自身版本必硬失败——别 spawn 一个注定 exit 2 的 gen 造不可自修的阻断循环
    if (newest > indexAt) notices.push(S.noSelfVersion())
  } else if (!ON_MAIN && wouldRegen) {
    // v0.17.4 §1:生成物只在主线上生成。分支(含游离 HEAD)上产物一个字节不碰 —— 分支带着几 MB
    // 没人改过的大文件收工,下一个会话要先花 token 分辨它们,合并时还必冲突。这一行只在「本来会
    // 重渲」时出:产物不过期的分支收工,守卫照旧一个字不说。人手跑 gen.mjs 不受此限(明确意图)。
    notices.push(S.genOffMain(BRANCH.cur, BRANCH.main, BRANCH.detached))
  } else if (wouldRegen) {
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

// ---- 出口:坏了一级各出全文,家务八类压成一行(v0.17.5)----
// 次序:卡文件那几条已在前面进过 notices(gen 失败要喂它们),其余坏了条目照 audits.mjs 的原序补上;
// 家务那一行永远排最后 —— 它是索引不是内容,压在全文前面会把真坏了的那几条挤下去。
for (const e of BROKEN) if (!CARD_FILE_KEYS.has(e.key)) notices.push(e.text)
{
  const line = choreLine(AUDIT, S, auditCmd(SELF_DIR))
  if (line) notices.push(line)
}

// 阻断项合成一条(孤儿 demo 排最前 —— 它是最老、也最容易一步补掉的那条规矩;次序在 audits.mjs 定)

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
