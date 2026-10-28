// Shared settlement rules. No host protocol, stdin, installation lookup, or exit.
// Audits are read-only. Automatic generation requires an explicit caller opt-in;
// the existing mainline, version-stamp, and initialization-lock guards still apply.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { cmpVer, readPluginVersion, readStamp } from './lib-version.mjs'
import { loadStrings } from './strings.mjs'
import { boardBranchCheck } from './board-branch-check.mjs'
import { CARD_FILE_KEYS, auditCmd, choreLine, collect, makeCtx, pickLevel } from './audits.mjs'

export function checkSettlement(request, { regenerate = false } = {}) {
  const KANBAN = detect({ cwd: request.cwd, env: {} })
  if (!KANBAN || existsSync(join(KANBAN, '.init-lock'))) return { kind: 'none' }
  const S = loadStrings(KANBAN)
  const SELF_DIR = dirname(fileURLToPath(import.meta.url))
  const GEN = join(SELF_DIR, 'gen.mjs')
  const INDEX = join(KANBAN, 'index.html')
  let stderr = ''
  // 保留独立条目的边界,不靠正文里的换行猜分段;旧调用方仍可直接读取拼好的字符串。
  const result = (value) => ({ ...value,
    ...(value.noticeParts ? { notice: value.noticeParts.join('\n\n') } : {}),
    ...(value.reasonParts ? { reason: value.reasonParts.join('\n\n') } : {}),
    ...(stderr ? { stderr } : {}),
  })
  const MY_VER = readPluginVersion(undefined, { onDiagnostic: (text) => { stderr += text + '\n' } })
  const STAMP = readStamp(INDEX)

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
  // 保留审计原文;各宿主适配器决定段内换行的显示方式。
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
    // Compare the current generator version with the existing output stamp.
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
    } else if (wouldRegen && regenerate === true) {
      const r = spawnSync(process.execPath, [GEN, '--dir', KANBAN], { cwd: KANBAN, stdio: ['ignore', 'ignore', 'pipe'] })
      const err = (r.stderr || r.error?.message || '').toString()
      if (r.status !== 0) {
        // gen 只报得出第一个坏卡,已攒下的 notice(坏卡清单等)一并喂回去,免得一个一个试
        const parts = [S.genFail(err.slice(0, 800)), ...notices]
        if (request.repeatedStop) { // 防死循环:同一次收工已拦过 → 降级警告放行
          return result({ kind: 'none', noticeParts: parts })
        }
        return result({ kind: 'failure', reasonParts: parts }) // 阻断:由适配器送回宿主自修(manifest 语法错等可修项)
      }
      // gen 成功但带警告(themeColors 未知色组/键、sessionTags 灰章、空 theme.css、指南过大、md 退化…)→ 原样透传,别吞
      if (err.trim()) stderr += err
      // 自愈自「无戳产物」= 刚被旧 gen 盖过板(或 0.6.0 前存量)的签名 → 现场指向断火源解药
      if (stampStale && STAMP === null) notices.push(S.healedUnstamped())
    }
  }

  // ---- 出口:坏了一级各出一条全文,家务八类合成一条(v0.17.5 立,v0.17.7 / v0.17.8 两度改形)----
  // 次序:卡文件那几条已在前面进过 notices(gen 失败要喂它们),其余坏了条目照 audits.mjs 的原序补上;
  // 家务那一条永远排最后 —— 它是索引不是内容,压在全文前面会把真坏了的那几条挤下去。
  for (const e of BROKEN) if (!CARD_FILE_KEYS.has(e.key)) notices.push(e.text)
  {
    const line = choreLine(AUDIT, S, auditCmd())
    if (line) notices.push(line)
  }

  // 阻断项合成一条(孤儿 demo 排最前 —— 它是最老、也最容易一步补掉的那条规矩;次序在 audits.mjs 定)

  // 不同审计条目分别返回,段内原有换行照旧,供适配器分别排版。
  if (blocks.length === 0) {
    return result({ kind: 'none', ...(notices.length ? { noticeParts: notices } : {}) })
  }
  if (request.repeatedStop) {
    return result({ kind: 'none', noticeParts: [...blocks.map((b) => b.warn), ...notices] })
  }
  return result({
    kind: 'block-stop',
    reason: blocks.map((b) => b.block).join('\n\n'),
    ...(notices.length ? { noticeParts: notices } : {}),
  })
}
