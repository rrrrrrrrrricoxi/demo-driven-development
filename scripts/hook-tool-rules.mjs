// 工具规则只接收规范请求并返回结果。宿主协议与进程输入输出由入口脚本处理。
import { spawnSync } from 'node:child_process'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { loadStrings } from './strings.mjs'
import { boardBranchCheck } from './board-branch-check.mjs'

// 成本守卫,不是安全边界:只认字面路径的直接读取。变量、别名、解释器和嵌套 shell
// 不做猜测;精准 rg/grep 与确定性脚本照常运行。不要拿一个简化解析器冒充 shell。
// 引号中的空格仍属于路径;分隔符切成独立命令。不执行展开或命令替换。
function shellSegments(command) {
  const segments = [], words = []
  let word = '', quote = '', escaped = false, hadWord = false
  const flush = () => { if (hadWord) words.push(word); word = ''; hadWord = false }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (escaped) { word += c; hadWord = true; escaped = false; continue }
    if (c === '\\' && quote !== "'") { escaped = true; continue }
    if (quote) { if (c === quote) quote = ''; else word += c; continue }
    if (c === "'" || c === '"') { quote = c; hadWord = true; continue }
    if (';|&\n'.includes(c)) { flush(); if (words.length) segments.push(words.splice(0)); continue }
    if (/\s/.test(c)) { flush(); continue }
    word += c; hadWord = true
  }
  if (quote || escaped) return [] // 不完整 shell 语句交给宿主,不误拦。
  flush(); if (words.length) segments.push(words)
  return segments
}

export function generatedReads(request, kanban) {
  const tool = request.tool || {}
  const cwd = tool.cwd || request.cwd
  const candidates = []
  if (tool.kind === 'read') {
    if (typeof tool.path === 'string') candidates.push(tool.path)
  } else if (tool.kind === 'shell') {
    const command = tool.command
    if (typeof command === 'string') for (const words of shellSegments(command)) {
      if (!['cat', 'head', 'tail', 'sed', 'less', 'more', 'bat'].includes(basename(words[0]))) continue
      // 所有参数只做路径匹配;选项/数量/脚本不会落在看板产物路径上。
      const args = words.slice(1)
      for (let i = 0; i < args.length; i++) {
        if (/^(?:\d*)>>?$/.test(args[i])) { i++; continue } // 输出重定向是写入,不是读取。
        candidates.push(args[i])
      }
    }
  }
  const paths = []
  for (const path of candidates) {
    if (!path || /[$`]/.test(path)) continue
    const rel = relative(kanban, resolve(cwd, path)).split(sep).join('/')
    if (rel === 'index.html' || rel === 'shots.html' || /^(?:refs|parts)\//.test(rel)) paths.push(path)
  }
  return [...new Set(paths)]
}

export function checkGeneratedRead(request) {
  if (request.event !== 'before-tool') return { kind: 'none' }
  const kanban = detect({ cwd: request.cwd, env: {} })
  if (!kanban) return { kind: 'none' }
  const paths = generatedReads(request, kanban)
  return paths.length
    ? { kind: 'deny-tool', reason: loadStrings(kanban).generatedReadDenied(paths) }
    : { kind: 'none' }
}

const MERGE_RE = /^gh\s+pr\s+merge(?:\s|$)/
// ponytail: 只认裸 PR 号与 .../pull/N 形式的选择符;`gh pr merge <branch>` 会退到「当前分支」那一档。
// 要认分支选择符,把第一个非 flag 参数原样交给 gh pr view —— 但那需要一张「带值的 flag」清单,
// 而认错了就是拿错分支下判断。退到当前分支最坏也只是漏拦一次,不会误拦。
const PR_NUM_RE = /^gh\s+pr\s+merge\s+(?:.*?\s)?(?:(\d+)|\S*\/pull\/(\d+))(?:\s|$)/
// -R/--repo 指向别的仓:PR 号属于那边,而这道闸只问得出「当前仓的同号 PR 是哪条分支」——
// PR 号在两个仓之间撞号是常事,照样判就会拿一条毫不相干的分支去 deny 一次别处的合并。
// 闸的立身之本是「只拦确定的违规」,误拦比漏拦坏,所以这一档放行并说一句。
// 认死 -R 的三种写法(`-R x` / `-R=x` / cobra 允许的贴着写 `-Rx`)与 --repo。宁可多认一种:
// 认错了是放行,放行只漏拦;认漏了才会落到「拿同号 PR 顶包」那条错路上。
const OTHER_REPO_RE = /\s(?:-R\b|-R[^\s=]|--repo\b)/

export function checkMerge(request) {
  if (request.event !== 'before-tool' || request.tool?.kind !== 'shell') return { kind: 'none' }
  const cmd = typeof request.tool.command === 'string' ? request.tool.command.trim() : ''
  if (!MERGE_RE.test(cmd)) return { kind: 'none' } // 其它命令不探测看板。
  const KANBAN = detect({ cwd: request.cwd, env: {} })
  if (!KANBAN) return { kind: 'none' } // 非 DDD 项目:一个字都不说
  const S = loadStrings(KANBAN)
  const skipped = (reason) => ({ kind: 'none', notice: reason })
  const GEN = join(dirname(fileURLToPath(import.meta.url)), 'gen.mjs')

  const git = (args) => {
    const r = spawnSync('git', args, { cwd: KANBAN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })
    return r.error || r.status !== 0 ? null : String(r.stdout)
  }

  if (OTHER_REPO_RE.test(cmd)) return skipped(S.mergeGate.skipped(S.mergeGate.otherRepo()))

  const m = PR_NUM_RE.exec(cmd)
  const num = m ? (m[1] || m[2]) : null
  let ref = null
  if (num) {
    const r = spawnSync('gh', ['pr', 'view', num, '--json', 'headRefName'],
      { cwd: KANBAN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 })
    if (r.error) return skipped(S.mergeGate.skipped(S.mergeGate.noGh()))
    let head = ''
    if (r.status === 0) { try { head = String(JSON.parse(r.stdout || '{}').headRefName || '').trim() } catch {} }
    if (!head) return skipped(S.mergeGate.skipped(S.mergeGate.ghFailed(num)))
    // 本地没有那条分支就退到 origin/<分支>(平时的克隆只 fetch 过远端,本地并没有 PR 的头分支)
    const local = git(['rev-parse', '--verify', '--quiet', head]) !== null ? head
      : git(['rev-parse', '--verify', '--quiet', `origin/${head}`]) !== null ? `origin/${head}` : null
    if (!local) return skipped(S.mergeGate.skipped(S.mergeGate.noRef(head)))
    ref = local
  }

  const r = boardBranchCheck(KANBAN, S, ref ? { refs: [ref] } : {})
  if (r.skip) return skipped(S.mergeGate.skipped(r.skip))
  if (!r.hits.length) return { kind: 'none' } // 干净:放行,不出声
  // onIt:这棵树此刻就站在那条分支上(= 没给 PR 号那一档)。给了号时人多半正站在主线上准备合,
  // 补救那条命令得先说清切到哪儿去跑,否则照字面在当下跑等于什么都没做。
  return { kind: 'deny-tool', reason: r.hits.map((h) => S.mergeGate.deny(h.ref, h, r.main, r.prefix || 'app/kanban/', GEN, KANBAN, h.ref === r.cur)).join('\n\n') }
}

export function remindPullRequest(request) {
  if (request.event !== 'after-tool') return { kind: 'none' }
  const cmd = request.tool?.command
  if (typeof cmd !== 'string' || !cmd.startsWith('gh pr ')) return { kind: 'none' }
  const kanban = detect({ cwd: request.cwd, env: {} })
  if (!kanban) return { kind: 'none' }
  const S = loadStrings(kanban)
  return { kind: 'none', additionalContext: /^gh pr merge\b/.test(cmd) ? S.ghprRemindMerge : S.ghprRemind }
}
