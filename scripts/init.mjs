#!/usr/bin/env node
// kanban-init(设计 §7):把 DDD 看板机制装进目标项目。零依赖,子命令式:
//
//   node scripts/init.mjs scan  [--dir <targetRoot>]           盘点(只读)
//   node scripts/init.mjs plan  [--dir <targetRoot>] [选项]     输出将执行的动作(只读)
//   node scripts/init.mjs apply [--dir <targetRoot>] [选项]     动手(全程持 .init-lock)
//
// 选项:--brand X  --lang zh|en  --port N  --lanes null|lamos-legacy
//       --with-narrative(铺 path-manifest 叙事模块,缺省不铺——D45 拍板③)
//       --take-assets(scan 列出的同层非 HTML 资源随归拢一起迁,缺省只列名不动)
//       --only <p,..> | --exclude <p,..>(归拢挑选,互斥;逗号分隔 repo 相对路径或
//         glob,* 不跨 / 而 ** 跨;应用页面——产品本体 HTML——用 --exclude 挡在归拢外)
//       --remember(与 --exclude 同用:命中的模式写入 config.skipScattered,长期豁免)
//       --yes(跳过确认,非交互环境用)
//
// greenfield 主干:
//   1. 铺骨架:config + 三个 manifest(templates/manifests 变量填充;path-manifest 仅
//      --with-narrative 时铺,缺失时 gen 自动跳过对应标签页)+ demos/ + shots/
//      + demos/.no-card-ok + demos 侧 .gitignore + serve.py + serve-kanban.sh
//   2. settings 注入:templates/settings-inject.json 的 permissions.deny 深合并进
//      <targetRoot>/.claude/settings.json(去重合并,绝不覆盖其他键)
//   3. CLAUDE.md 注入:追加 templates/claude-md-section.md(已含标记节则跳过)
//   4. apply 末尾自跑 gen 冒烟 + 守卫冒烟(首次失败不留给守卫);git 仓库只 add 触碰路径并提交
//
// brownfield 散落归拢(设计 §7 merge 表,先报告后动手):
//   scan  盘点散落 demo(脚本读正文提 <title>/资产引用,报告只含摘要不含正文)、
//         同层非 HTML 资源列名、md 断链预测、旧安装痕迹(manifest/gen/stop-hook 无 config
//         + settings.json 旧 hook 注册)。散落候选三过滤:`_` 前缀 = 探针/草稿、
//         含 package.json 的子目录 = 应用/包源码、manifest 已提及 = 已覆盖数据(守卫同口径)。
//   plan  合并计划:目标 app/kanban/demos/<原名>;同名冲突改名 <名>.vN.html 归档人裁决;
//         git 策略逐文件(tracked→git mv / untracked→mv+git add / 无 git→纯 mv 明示无历史);
//         资产随迁清单;断链清单(策略 B 只列不改写);存根卡 id 预分配。
//   apply 持 .init-lock;先写存根卡进 decisions-manifest(写前 mtime 乐观锁,变了重读重算)
//         再 mv demo/资产;遗留待办(断链、同名冲突)自动落 backlog 卡;末尾 gen+守卫冒烟。
//   无 config 时 apply 只铺骨架不归拢(骨架先立,scan/plan 审阅后再次 apply 归拢)。
//
// 旧装接管(legacy,设计 §7 表后半):无 config 但有旧机制件/manifest 时,apply =
//   生成 config(docs 从旧 gen.mjs 的 REF_DOCS 机械翻译提取)
//   + settings.json 摘除旧 kanban hook 注册(只认 claude-stop-hook / 看板提醒 两枚标记,其他 hook 原样)
//   + 旧机制件(gen/守卫/serve)不删除 —— 落「割接清理」「backnav 换章」backlog 卡,人裁决。
//   数据零改动:四 manifest 只允许 backlog 追加,demos 一字不动。
//
// 幂等:重跑 apply 零变更(存在的文件一律不覆写;合并/追加操作先判重;已归拢/已有卡跳过)。
// 报告/plan 文案走 scripts/strings.mjs 双语表:lang 取 --lang,其次已存在 config.lang,缺省 zh
// (CLI 解析错误发生在 lang 解析之前,保持 zh)。manifest 卡内容是数据不进表,恒 zh。
import {
  chmodSync, copyFileSync, existsSync, mkdirSync,
  readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:net'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { pickStrings } from './strings.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TPL = join(HERE, '..', 'templates')
const MANIFEST_FILES = ['manifest.json', 'decisions-manifest.json', 'backlog-manifest.json', 'path-manifest.json']
const USAGE = `用法: node init.mjs scan|plan|apply [--dir <targetRoot>] [--brand X] [--lang zh|en] [--port N] [--lanes null|lamos-legacy] [--stub-status <status>] [--with-narrative] [--take-assets] [--only <路径|glob,..> | --exclude <路径|glob,..> [--remember]] [--yes]`

let S = pickStrings('zh') // main() 里按 --lang / config.lang 重选

const fail = (msg) => { console.error(`[init] ✗ ${msg}`); process.exit(1) }

// ---- CLI 解析 ----
function parseArgs(argv) {
  const opt = { cmd: null, dir: null, brand: null, lang: null, port: null, lanes: null, stubStatus: null, only: null, exclude: null, remember: false, withNarrative: false, takeAssets: false, yes: false }
  const valued = { '--dir': 'dir', '--brand': 'brand', '--lang': 'lang', '--port': 'port', '--lanes': 'lanes', '--stub-status': 'stubStatus', '--only': 'only', '--exclude': 'exclude' }
  const flags = { '--yes': 'yes', '--with-narrative': 'withNarrative', '--take-assets': 'takeAssets', '--remember': 'remember' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a in valued) {
      if (argv[i + 1] === undefined) fail(`${a} 需要参数\n${USAGE}`)
      opt[valued[a]] = argv[++i]
    } else if (a in flags) opt[flags[a]] = true
    else if (a.startsWith('--')) fail(`未知选项 ${a}\n${USAGE}`)
    else if (!opt.cmd) opt.cmd = a
    else fail(`多余参数 ${a}\n${USAGE}`)
  }
  if (!['scan', 'plan', 'apply'].includes(opt.cmd)) fail(USAGE)
  if (opt.lang !== null && !['zh', 'en'].includes(opt.lang)) fail(`--lang 只支持 zh|en,给了 ${opt.lang}`)
  if (opt.lanes !== null) {
    if (opt.lanes === 'null') opt.lanes = null
    else if (opt.lanes !== 'lamos-legacy') fail(`--lanes 只支持 null|lamos-legacy,给了 ${opt.lanes}`)
  }
  if (opt.port !== null) {
    opt.port = Number(opt.port)
    if (!Number.isInteger(opt.port) || opt.port < 1 || opt.port > 65535) fail('--port 需要 1-65535 的整数')
  }
  if (opt.only !== null && opt.exclude !== null) fail(`--only 与 --exclude 互斥,只能给一个\n${USAGE}`)
  if (opt.remember && opt.exclude === null) fail(`--remember 需与 --exclude 同用(把命中的模式记入 config.skipScattered)\n${USAGE}`)
  return opt
}

// 报告语言:--lang > 已存在 config.lang > zh(拍板⑤;config 写入值另取 opt.lang ?? 'zh')
function resolveLang(root, opt) {
  if (opt.lang) return opt.lang
  try {
    const cfg = JSON.parse(readFileSync(join(root, 'app', 'kanban', 'kanban.config.json'), 'utf8'))
    if (cfg.lang === 'zh' || cfg.lang === 'en') return cfg.lang
  } catch {}
  return 'zh'
}

// ---- git 探查(全部 best-effort,非 git 场景返回空) ----
function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch { return null }
}
function gitInfo(root) {
  const isRepo = git(root, ['rev-parse', '--is-inside-work-tree']) === 'true'
  if (!isRepo) return { isRepo: false, branch: '', ghRepo: '' }
  // symbolic-ref 空仓库(无 commit)也能拿到分支名;rev-parse 兜底
  const branch = git(root, ['symbolic-ref', '--short', 'HEAD']) ?? git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? ''
  const url = git(root, ['remote', 'get-url', 'origin']) ?? ''
  const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/)
  return { isRepo: true, branch, ghRepo: m ? `${m[1]}/${m[2]}` : '' }
}

// ---- 场景识别(设计 §7 三种进场景) ----
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', 'coverage', 'vendor', '__pycache__', '.claude'])
function findScatteredHtml(root) {
  // 只收路径/不读正文(token 纪律);标题/资产引用等完整盘点随 brownfield 落地
  const found = []
  const kanban = join(root, 'app', 'kanban')
  const walk = (dir, depth) => {
    if (depth > 8 || found.length >= 200) return
    let ents = []
    try { ents = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      if (e.isSymbolicLink()) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (EXCLUDE_DIRS.has(e.name) || p === kanban) continue
        if (existsSync(join(p, 'package.json'))) continue // 应用/包源码目录,里面的 html 是页面不是 demo
        walk(p, depth + 1)
      } else if (e.name.toLowerCase().endsWith('.html') && !e.name.startsWith('_')) found.push(p) // `_` 前缀 = 探针/草稿
    }
  }
  walk(root, 0)
  return found
}
function classify(root) {
  const kanban = join(root, 'app', 'kanban')
  const hasConfig = existsSync(join(kanban, 'kanban.config.json'))
  const legacyTraces = MANIFEST_FILES.filter((f) => existsSync(join(kanban, f)))
  // 旧安装机制件:repo 自带 gen/守卫(设计 §7「机制接管」识别信号)。
  // serve.py 是 init 模板种入件,单独出现不算旧装信号 —— 只在核心旧件在场时随队进退役清单。
  const legacyCore = ['gen.mjs', 'stop-hook.mjs', 'claude-stop-hook.mjs'].filter((f) => existsSync(join(kanban, f)))
  const legacyMech = legacyCore.length ? [...legacyCore, ...['serve.py'].filter((f) => existsSync(join(kanban, f)))] : []
  let kanbanDemos = []
  try { kanbanDemos = readdirSync(join(kanban, 'demos')).filter((f) => f.endsWith('.html')) } catch {}
  const scattered = findScatteredHtml(root)
  const scenario = hasConfig ? 'installed'
    : (legacyTraces.length || legacyMech.length || kanbanDemos.length) ? 'legacy'
    : scattered.length ? 'scattered'
    : 'greenfield'
  return { kanban, hasConfig, legacyTraces, legacyMech, legacyHooks: findLegacyHooks(root), kanbanDemos, scattered, scenario }
}

// ---- 旧装接管:settings.json 旧 hook 注册识别与摘除(设计 §7「机制接管」) ----
// 只认两枚旧机制标记 —— Stop 守卫命令含 claude-stop-hook、gh-pr 提醒命令含「看板提醒」;
// 其他 hook 一概不碰(只敢动机制,绝不动别人的配置)。
const isLegacyHookCmd = (cmd) => cmd.includes('claude-stop-hook') || cmd.includes('看板提醒')
const legacyHookKind = (cmd) => (cmd.includes('claude-stop-hook') ? 'stop' : 'ghpr')
const hookList = (found) => found.map((f) => `${f.event}→${S.init.hookLabel[f.kind]}`)
function findLegacyHooks(root) {
  const path = join(root, '.claude', 'settings.json')
  const out = { path, found: [] }
  if (!existsSync(path)) return out
  let s
  try { s = JSON.parse(readFileSync(path, 'utf8')) } catch { return out } // 非法 JSON 由 settings 合并环节统一报错
  for (const [event, groups] of Object.entries(s.hooks || {})) {
    if (!Array.isArray(groups)) continue
    for (const g of groups) {
      for (const h of (Array.isArray(g?.hooks) ? g.hooks : [])) {
        const cmd = String(h?.command || '')
        if (isLegacyHookCmd(cmd)) out.found.push({ event, kind: legacyHookKind(cmd) })
      }
    }
  }
  return out
}
function stripLegacyHooks(s) {
  let removed = 0
  for (const event of Object.keys(s.hooks || {})) {
    const groups = s.hooks[event]
    if (!Array.isArray(groups)) continue
    s.hooks[event] = groups.filter((g) => {
      if (!Array.isArray(g?.hooks)) return true
      const before = g.hooks.length
      g.hooks = g.hooks.filter((h) => !isLegacyHookCmd(String(h?.command || '')))
      removed += before - g.hooks.length
      return !(before > g.hooks.length && g.hooks.length === 0) // 只丢被我们摘空的组
    })
    if (!s.hooks[event].length) delete s.hooks[event]
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks
  return removed
}

// ---- 旧装接管:从旧 gen.mjs 提取 REF_DOCS → config.docs(机械翻译:src→path,cat→category,line 缺省 null) ----
function extractLegacyDocs(kanban) {
  const genPath = join(kanban, 'gen.mjs')
  if (!existsSync(genPath)) return null
  const m = readFileSync(genPath, 'utf8').match(/const REF_DOCS = \[([\s\S]*?)\n\]/)
  if (!m) return null
  const docs = []
  for (const em of m[1].matchAll(/\{([^}]*)\}/g)) {
    const o = {}
    for (const kv of em[1].matchAll(/(\w+):\s*'((?:[^'\\]|\\.)*)'/g)) o[kv[1]] = kv[2].replace(/\\(.)/g, '$1')
    if (!o.src || !o.out || o.baseDir === undefined || !o.title || !o.cat) return null // 结构对不上,放弃提取交人工
    docs.push({ path: o.src, out: o.out, baseDir: o.baseDir, title: o.title, category: o.cat, line: o.line ?? null })
  }
  return docs.length ? docs : null
}

// ---- 归拢挑选:--only/--exclude/config.skipScattered 共用的简易 glob(零依赖) ----
// 匹配对象 = demo 候选的 repo 相对路径(/ 分隔,大小写敏感);* 不跨 /,** 跨;
// 无通配符 = 精确路径。前缀 ./ 自动剥;其余写法未命中由 selNoHit ⚠ 兜底(防笔误静默失效)。
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function compileGlobs(spec) {
  const pats = (Array.isArray(spec) ? spec : String(spec).split(',')).map((s) => s.trim().replace(/^(\.\/)+/, '')).filter(Boolean)
  return pats.map((pat) => ({
    pat,
    re: new RegExp(`^${pat.split('**').map((seg) => seg.split('*').map(escRe).join('[^/]*')).join('.*')}$`),
  }))
}
const globHit = (globs, rel) => globs.find((g) => g.re.test(rel.split(sep).join('/')))?.pat ?? null

// 挑选裁决:selected 进归拢;skipped 不写卡不动文件——仍是散落态,重跑 scan 会再列出(诚实)。
// hitPats = --exclude 里真命中过候选的模式(--remember 只记这些,防笔误模式进 config)。
// missPats = 一个候选都没命中的模式 → ⚠ 单行警告(笔误/大小写/写法错静默失效 = 应用页被误搬)。
function selectDemos(demos, opt) {
  if (!opt.only && !opt.exclude) return { active: false, selected: demos, skipped: [], hitPats: [], missPats: [] }
  const globs = compileGlobs(opt.only ?? opt.exclude)
  const selected = [], skipped = [], hit = new Set()
  for (const d of demos) {
    const pat = globHit(globs, d.rel)
    if (pat) hit.add(pat)
    if (opt.only) { pat ? selected.push(d) : skipped.push({ rel: d.rel, reason: S.init.selReasonOnly }) }
    else { pat ? skipped.push({ rel: d.rel, reason: S.init.selReasonExclude(pat) }) : selected.push(d) }
  }
  return { active: true, selected, skipped, hitPats: [...hit], missPats: globs.map((g) => g.pat).filter((p) => !hit.has(p)) }
}
function printSelection(tag, sel, opt) {
  for (const d of sel.selected) console.log(S.init.selKeep(tag, d.rel))
  for (const s of sel.skipped) console.log(S.init.selSkip(tag, s.rel, s.reason))
  console.log(S.init.selStats(tag, sel.selected.length, sel.skipped.length))
  if (sel.missPats.length) console.log(S.init.selNoHit(tag, sel.missPats))
  if (opt.remember && sel.hitPats.length) console.log(S.init.selRemember(tag, sel.hitPats))
  else if (sel.skipped.length) console.log(S.init.selRememberHint(tag))
}

// ---- 散落 demo 盘点(设计 §7:脚本读正文提摘要不违反 token 纪律,报告绝不含正文) ----
const isRelRef = (r) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(r)
function gitStatusOf(root, gi, abs) {
  if (!gi.isRepo) return 'no-git'
  return git(root, ['ls-files', '--', abs]) ? 'tracked' : 'untracked'
}
function walkFiles(root, extRe, cap = 2000) {
  const kanban = join(root, 'app', 'kanban')
  const found = []
  const walk = (dir, depth) => {
    if (depth > 8 || found.length >= cap) return
    let ents = []
    try { ents = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      if (e.isSymbolicLink()) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (EXCLUDE_DIRS.has(e.name) || p === kanban) continue
        walk(p, depth + 1)
      } else if (extRe.test(e.name)) found.push(p)
    }
  }
  walk(root, 0)
  return found
}
function collectScan(root, st, gi) {
  const rel = (p) => relative(root, p)
  // manifest / config 已提及的文件名 = 已覆盖数据(守卫同口径:看板目录任意 json 文本提到即算;
  // config.docs 登记的 type:"html" 指南由 gen 托管副本,亦算已覆盖),不当散落候选 —— 挪走反而会弄断链接/活 serve
  const manifestText = [...MANIFEST_FILES, 'kanban.config.json'].map((f) => { try { return readFileSync(join(st.kanban, f), 'utf8') } catch { return '' } }).join('\n')
  // config.skipScattered = 人拍板的长期豁免(--exclude --remember 写入):命中即不当候选,scan 标注[配置跳过]
  let cfgGlobs = []
  try { cfgGlobs = compileGlobs(JSON.parse(readFileSync(join(st.kanban, 'kanban.config.json'), 'utf8')).skipScattered || []) } catch {}
  const configSkipped = []
  const cfgSkipAssets = [] // 配置跳过页仍引用的相对目标(abs):不当兄弟资产、不自动随迁(页留资产走=弄断跳过页)
  const claimedByManifest = []
  const demos = []
  for (const abs of st.scattered) {
    const skipPat = globHit(cfgGlobs, rel(abs))
    if (skipPat) {
      configSkipped.push({ rel: rel(abs), pat: skipPat })
      try {
        for (const m of readFileSync(abs, 'utf8').matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
          const ref = m[1].split(/[?#]/)[0]
          if (ref && isRelRef(ref)) cfgSkipAssets.push(resolve(dirname(abs), ref))
        }
      } catch {}
      continue
    }
    if (manifestText.includes(basename(abs))) { claimedByManifest.push(rel(abs)); continue }
    let text = ''
    try { text = readFileSync(abs, 'utf8') } catch { continue }
    if (!/<html/i.test(text)) continue // 非完整页面(片段/模板),不当 demo 候选
    const title = (text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim()
    const assets = []
    for (const m of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const ref = m[1].split(/[?#]/)[0]
      if (!ref || !isRelRef(ref) || ref.toLowerCase().endsWith('.html')) continue
      const aAbs = resolve(dirname(abs), ref)
      if (assets.some((a) => a.abs === aAbs)) continue
      const inDemoDir = aAbs.startsWith(dirname(abs) + sep)
      assets.push({ ref, abs: aAbs, rel: rel(aAbs), exists: existsSync(aAbs), inDemoDir })
    }
    demos.push({ abs, rel: rel(abs), size: statSync(abs).size, title, git: gitStatusOf(root, gi, abs), assets })
  }
  // 同层非 HTML 资源:只列名与大小,不读内容(被引用资产另入随迁清单,此处剔除;
  // 配置跳过页的引用目标同剔 —— 防 --take-assets 把跳过页的 css 当无主兄弟扫走)
  const claimed = new Set([...demos.flatMap((d) => d.assets.map((a) => a.abs)), ...cfgSkipAssets])
  const siblings = []
  for (const dir of new Set(demos.map((d) => dirname(d.abs)))) {
    let ents = []
    try { ents = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of ents) {
      if (!e.isFile() || e.name.toLowerCase().endsWith('.html')) continue
      const p = join(dir, e.name)
      if (claimed.has(p)) continue
      siblings.push({ abs: p, rel: rel(p), size: statSync(p).size })
    }
  }
  // 断链预测:全仓 *.md 里指向这些 demo 的相对链接(策略 B:归拢后只报告不改写)
  const demoAbs = new Map(demos.map((d) => [d.abs, d]))
  const brokenLinks = []
  for (const md of walkFiles(root, /\.md$/i)) {
    let text = ''
    try { text = readFileSync(md, 'utf8') } catch { continue }
    for (const m of text.matchAll(/\]\(\s*<?([^)\s>]+?)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const ref = m[1].split('#')[0]
      if (!ref || !isRelRef(ref)) continue
      const target = resolve(dirname(md), ref)
      if (demoAbs.has(target)) brokenLinks.push({ md: rel(md), ref: m[1], demo: rel(target) })
    }
  }
  return { demos, siblings, brokenLinks, claimed: claimedByManifest, configSkipped, cfgSkipAssets }
}

// ---- 端口探测:自 8898 起找当下未被监听的(承诺边界见 strings portCaveat) ----
function portFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.listen({ port, host: '0.0.0.0', exclusive: true }, () => srv.close(() => res(true)))
  })
}
async function probePort(start) {
  for (let p = start; p < start + 100; p++) if (await portFree(p)) return p
  fail(S.init.portExhausted(start))
}

// ---- settings 深合并:只添不改,数组去重并入,绝不覆盖已有标量/异型键 ----
function deepMerge(dst, src) {
  let changed = false
  for (const [k, v] of Object.entries(src)) {
    if (Array.isArray(v)) {
      if (!(k in dst)) { dst[k] = [...v]; changed = true }
      else if (Array.isArray(dst[k])) {
        for (const item of v) if (!dst[k].includes(item)) { dst[k].push(item); changed = true }
      } // 异型(已有非数组):不动,保守让人裁决
    } else if (v && typeof v === 'object') {
      if (!(k in dst)) { dst[k] = {}; changed = true }
      if (dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) {
        if (deepMerge(dst[k], v)) changed = true
      }
    } else if (!(k in dst)) { dst[k] = v; changed = true }
  }
  return changed
}

// ---- gitignore 种子/合并(templates/gitignore;新装种入,已有则并入缺失条目) ----
const gitignoreTplLines = () =>
  readFileSync(join(TPL, 'gitignore'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
function gitignoreMissing(giPath) {
  const have = new Set(readFileSync(giPath, 'utf8').split('\n').map((l) => l.trim()))
  return gitignoreTplLines().filter((l) => !have.has(l))
}

// ---- 合并计划(brownfield 散落归拢,设计 §7 merge 表) ----
const today = () => new Date().toISOString().slice(0, 10)
const filesEqual = (a, b2) => {
  try { return readFileSync(a).equals(readFileSync(b2)) } catch { return false }
}
// id 预分配:读现有条目各前缀取最常用者的最大号递增;无既有词汇则 fallback 前缀从 1 起
// 前缀允许字母+连字符混排(如 BL-C36:前缀 BL-C,号 36)
function idAllocator(ids, fallback) {
  const byPrefix = new Map()
  for (const id of ids) {
    const m = /^([A-Za-z][A-Za-z-]*?)(\d+)$/.exec(String(id || ''))
    if (!m) continue
    const cur = byPrefix.get(m[1]) || { n: 0, max: 0 }
    cur.n++; cur.max = Math.max(cur.max, Number(m[2]))
    byPrefix.set(m[1], cur)
  }
  let prefix = fallback, next = 1
  if (byPrefix.size) {
    prefix = [...byPrefix.entries()].sort((a, b2) => b2[1].n - a[1].n)[0][0]
    next = byPrefix.get(prefix).max + 1
  }
  return () => `${prefix}${next++}`
}
function nextArchiveName(demosDir, name, taken) {
  const m = /^(.*?)(\.[^.]+)$/.exec(name)
  const [stem, ext] = m ? [m[1], m[2]] : [name, '']
  for (let n = 1; ; n++) {
    const cand = `${stem}.v${n}${ext}`
    if (!taken.has(cand) && !existsSync(join(demosDir, cand))) { taken.add(cand); return cand }
  }
}
// 存根卡去重口径与守卫一致:manifest 文本任意处提到该文件名即视为已覆盖
const mentioned = (json, name) => JSON.stringify(json).includes(name)

function buildMergePlan(root, st, det, gi, opt) {
  const demosDir = join(st.kanban, 'demos')
  const dmPath = join(st.kanban, 'decisions-manifest.json')
  const blPath = join(st.kanban, 'backlog-manifest.json')
  const dm = JSON.parse(readFileSync(dmPath, 'utf8')); dm.entries ||= []
  const bl = JSON.parse(readFileSync(blPath, 'utf8')); bl.items ||= []
  // 归拢挑选(--only/--exclude):跳过的候选不写卡不动文件;断链预测/兄弟资产只跟被选中者走
  const sel = selectDemos(det.demos, opt)
  const selRel = new Set(sel.selected.map((d) => d.rel))
  // 被跳过候选(挑选跳过 + 配置豁免)仍引用的资产:自动随迁会弄断留在原地的跳过页,改列人工裁决
  const skippedRefAbs = new Set([
    ...(det.cfgSkipAssets || []),
    ...det.demos.filter((d) => !selRel.has(d.rel)).flatMap((d) => d.assets.map((a) => a.abs)),
  ])
  const merge = {
    stubStatus: opt.stubStatus || 'deciding', abort: null, sel, remember: opt.remember,
    moves: [], conflicts: [], skips: [], assets: [], assetReview: [],
    stubs: [], cards: [], brokenLinks: det.brokenLinks.filter((l) => selRel.has(l.demo)),
    dmPath, blPath, dmMtime: statSync(dmPath).mtimeMs, blMtime: statSync(blPath).mtimeMs,
  }

  // 落位状态必须在既有 statuses/groups 里(防「合规但看板上找不到卡」)
  const groupIds = new Set((dm.groups || []).map((g) => g.id))
  if (!(merge.stubStatus in (dm.statuses || {})) || !groupIds.has(merge.stubStatus)) {
    const usable = Object.keys(dm.statuses || {}).filter((s) => groupIds.has(s))
    merge.abort = S.init.mergeAbortStatus(merge.stubStatus, usable)
    return merge
  }

  // demo 逐个:目标 demos/<原名>;同名冲突不静默覆盖,改名 .vN 归档人裁决
  const taken = new Set()
  for (const d of sel.selected) {
    const name = basename(d.abs)
    const target = join(demosDir, name)
    if (existsSync(target) || taken.has(name)) {
      if (filesEqual(d.abs, target)) {
        merge.skips.push({ from: d.rel, reason: S.init.skipIdentical(name) })
      } else {
        const archiveName = nextArchiveName(demosDir, name, taken)
        merge.conflicts.push({ from: d.rel, abs: d.abs, name, archiveName, to: `app/kanban/demos/${archiveName}`, git: d.git })
      }
      continue
    }
    taken.add(name)
    merge.moves.push({ from: d.rel, abs: d.abs, name, to: `app/kanban/demos/${name}`, git: d.git, title: d.title })
    // 资产随迁:同目录树内的相对引用保持相对结构迁入 demos/;目录外/缺失的列出人裁决
    for (const a of d.assets) {
      if (a.exists && a.inDemoDir) {
        if (skippedRefAbs.has(a.abs)) {
          merge.assetReview.push({ demo: d.rel, ref: a.ref, exists: true, note: S.init.assetSharedSkipped })
          continue
        }
        const relPath = relative(dirname(d.abs), a.abs)
        if (!merge.assets.some((x) => x.abs === a.abs)) {
          merge.assets.push({ from: a.rel, abs: a.abs, to: `app/kanban/demos/${relPath}`, git: gitStatusOf(root, gi, a.abs) })
        }
      } else {
        merge.assetReview.push({ demo: d.rel, ref: a.ref, exists: a.exists, note: a.exists ? S.init.assetOutside : S.init.assetMissing })
      }
    }
  }

  // --take-assets:scan 列出的同层非 HTML 资源随同归拢(缺省只列名不动;不覆盖同名目标;
  // 只跟被选中 demo 的同层走 —— 被 --only/--exclude 跳过的 demo,其兄弟资产原地不动)
  if (opt.takeAssets) {
    const selDirs = new Set(sel.selected.map((d) => dirname(d.abs)))
    for (const s2 of det.siblings.filter((x) => selDirs.has(dirname(x.abs)))) {
      const name = basename(s2.abs)
      const to = `app/kanban/demos/${name}`
      if (existsSync(join(demosDir, name)) || merge.assets.some((x) => x.to === to)) {
        merge.skips.push({ from: s2.rel, reason: S.init.skipSiblingConflict(name) })
      } else {
        merge.assets.push({ from: s2.rel, abs: s2.abs, to, git: gitStatusOf(root, gi, s2.abs), sibling: true })
      }
    }
  }

  // 存根卡预分配(已有卡跳过;code=id,gen 硬校验缺 code 即 throw)
  const nextDec = idAllocator(dm.entries.map((e) => e.id), 'C-')
  for (const mv of merge.moves) {
    if (mentioned(dm, mv.name)) { merge.skips.push({ from: mv.from, reason: S.init.skipMentioned(mv.name), moveOnly: true }); continue }
    const id = nextDec()
    merge.stubs.push({
      id, code: id, status: merge.stubStatus, date: today(),
      title: mv.title || mv.name,
      question: `init 归拢存根:原路径 ${mv.from};问题/结论待补`,
      demo: `demos/${mv.name}`,
      links: [{ title: 'demo', href: `demos/${mv.name}` }],
    })
  }

  // 遗留待办自动落 backlog 卡(设计 §7 配套机制 5:报告会被冲走,卡不会丢)
  const nextBl = idAllocator(bl.items.map((it) => it.id), 'BL-')
  const kanbanRel = (p) => relative(st.kanban, join(root, p))
  if (merge.brokenLinks.length && !bl.items.some((it) => it.initKind === 'broken-links')) {
    merge.cards.push({
      id: nextBl(), initKind: 'broken-links',
      title: `init 归拢遗留:${merge.brokenLinks.length} 处 md 链接断链(策略 B 未改写)`,
      tier: 0, area: 'docs', priority: 'med', status: 'ready', date: today(),
      source: 'kanban-init apply',
      problem: `散落 demo 迁入 app/kanban/demos/ 后,以下文档相对链接断链:${merge.brokenLinks.map((l) => `${l.md} →(${l.ref})→ ${l.demo}`).join(';')}。`,
      approach: '人工把链接改指 app/kanban/demos/ 新路径(或删除引用);init 按已拍板策略 B 不自动改写文档。',
      links: [...new Set(merge.brokenLinks.map((l) => l.md))].map((mdRel) => ({ title: mdRel, href: kanbanRel(mdRel) })),
    })
  }
  for (const c of merge.conflicts) {
    if (bl.items.some((it) => it.initKind === `conflict:${c.archiveName}`)) continue
    merge.cards.push({
      id: nextBl(), initKind: `conflict:${c.archiveName}`,
      title: `init 归拢冲突裁决:${c.name} 与既有同名 demo 内容不同,新来者归档为 ${c.archiveName}`,
      tier: 0, area: 'kanban', priority: 'med', status: 'ready', date: today(),
      source: 'kanban-init apply',
      problem: `散落 demo ${c.from} 与 app/kanban/demos/${c.name} 同名但内容不同;为不覆盖既有数据,新来者归档为 demos/${c.archiveName}。`,
      approach: `人工比对 demos/${c.name} 与 demos/${c.archiveName} 定去留;若采用归档版,更新对应卡的 demo 链接后删旧文件。`,
      links: [{ title: '归档版(新来者)', href: `demos/${c.archiveName}` }, { title: '既有版', href: `demos/${c.name}` }],
    })
  }
  return merge
}

// ---- 旧装接管计划(设计 §7 merge 表后半:机制接管,数据只允许 backlog 追加) ----
function buildLegacyPlan(root, st) {
  const blPath = join(st.kanban, 'backlog-manifest.json')
  const lg = { hooks: st.legacyHooks, mech: st.legacyMech, cards: [], blPath, blMtime: null, docs: null }
  let items = []
  if (existsSync(blPath)) {
    lg.blMtime = statSync(blPath).mtimeMs
    try { items = JSON.parse(readFileSync(blPath, 'utf8')).items || [] } catch {}
  }
  const want = []
  if (lg.mech.length) {
    want.push({
      initKind: 'legacy-retire',
      title: '割接清理:退役旧机制件(plugin 已接管)',
      tier: 0, area: '看板', priority: 'med', status: 'ready', date: today(),
      source: 'kanban-init apply(旧装接管)',
      problem: `init 接管只摘 hook 注册、不删文件:${lg.mech.map((f) => `app/kanban/${f}`).join(' / ')} 仍在 repo。守卫/gen 已由 plugin(hooks.json + \${CLAUDE_PLUGIN_ROOT}/scripts)接管,旧件留着只会漂移。`,
      approach: 'plugin 稳定运行一段时间后单独 PR 删除旧机制件;serve 起停切到 serve-kanban.sh。避开上线冲刺窗口(设计:割接晚切)。',
      links: lg.mech.map((f) => ({ title: `app/kanban/${f}`, href: f })),
    })
  }
  if (lg.mech.length && st.kanbanDemos.length) {
    want.push({
      initKind: 'legacy-backnav',
      title: '割接清理:demos backnav 统一换章(旧 tag 冻结中)',
      tier: 0, area: '看板', priority: 'low', status: 'ready', date: today(),
      source: 'kanban-init apply(旧装接管)',
      problem: `存量 demo(${st.kanbanDemos.length} 个)的返航条仍是旧注入 tag;init 按「存量冻结」裁决零重写(保数据零改动),plugin gen 视旧 tag 为已注入。长期两套 tag 并存,升级逻辑要一直背着旧 tag 的剥离正则。`,
      approach: '割接完成后单独批量 PR:重跑注入把全部 demo 换到 plugin 当前 tag(预期 diff 大而机械,逐文件可审)。',
      links: [],
    })
  }
  const nextBl = idAllocator(items.map((it) => it.id), 'BL-')
  for (const c of want) if (!items.some((it) => it.initKind === c.initKind)) lg.cards.push({ ...c, id: nextBl() })
  return lg
}

// ---- 计划:scan 结果 + 选项 → 将执行的动作清单(plan 打印它,apply 执行它) ----
async function buildPlan(root, st, gi, opt, det) {
  const plan = { creates: [], dirs: [], port: null, portNote: '', settingsAdd: [], gitignoreAdd: [], narrativeSkip: false, needsClaudeMd: false, brand: opt.brand, merge: null, mergeDeferred: false }
  const rel = (p) => p.slice(root.length + 1)

  if (st.hasConfig) {
    const cfg = JSON.parse(readFileSync(join(st.kanban, 'kanban.config.json'), 'utf8'))
    plan.port = cfg.port
    plan.portNote = S.init.portNoteExisting
    plan.brand = cfg.brand
  } else if (opt.port !== null) {
    plan.port = opt.port
    plan.portNote = S.init.portNoteManual
  } else {
    plan.port = await probePort(8898)
    plan.portNote = S.init.portNoteProbed(8898)
  }

  if (!st.hasConfig) plan.creates.push('app/kanban/kanban.config.json')
  // path-manifest 缺省不铺(D45 拍板③:新项目不写该文件,标签页自动不出现);--with-narrative 才铺;已有则原样尊重
  plan.layManifests = MANIFEST_FILES.filter((f) => f !== 'path-manifest.json' || opt.withNarrative)
  for (const f of plan.layManifests) if (!existsSync(join(st.kanban, f))) plan.creates.push(`app/kanban/${f}`)
  plan.narrativeSkip = !st.hasConfig && !opt.withNarrative && !existsSync(join(st.kanban, 'path-manifest.json'))
  for (const d of ['demos', 'shots']) if (!existsSync(join(st.kanban, d))) plan.dirs.push(`app/kanban/${d}/`)
  if (!existsSync(join(st.kanban, 'demos', '.no-card-ok'))) plan.creates.push('app/kanban/demos/.no-card-ok')
  // .gitignore:新装(无 config)种入;已有该文件则只并入缺失条目(去重)
  if (!st.hasConfig) {
    const giPath = join(st.kanban, '.gitignore')
    if (!existsSync(giPath)) plan.creates.push('app/kanban/.gitignore')
    else plan.gitignoreAdd = gitignoreMissing(giPath)
  }
  for (const f of ['serve.py', 'serve-kanban.sh']) if (!existsSync(join(st.kanban, f))) plan.creates.push(`app/kanban/${f}`)

  // settings:模拟合并,列出将新增的 deny 条目
  const inject = JSON.parse(readFileSync(join(TPL, 'settings-inject.json'), 'utf8'))
  const settingsPath = join(root, '.claude', 'settings.json')
  let cur = {}
  if (existsSync(settingsPath)) {
    try { cur = JSON.parse(readFileSync(settingsPath, 'utf8')) }
    catch (e) { fail(S.init.failSettingsJson(rel(settingsPath), e.message)) }
  }
  const have = Array.isArray(cur?.permissions?.deny) ? cur.permissions.deny : []
  plan.settingsAdd = inject.permissions.deny.filter((d) => !have.includes(d))

  // CLAUDE.md:以模板首个非空行为标记节,已含则跳过
  const section = readFileSync(join(TPL, 'claude-md-section.md'), 'utf8')
  plan.claudeMarker = section.split('\n').find((l) => l.trim()).trim()
  plan.claudeSection = section
  const cmPath = join(root, 'CLAUDE.md')
  const cm = existsSync(cmPath) ? readFileSync(cmPath, 'utf8') : ''
  plan.needsClaudeMd = !cm.includes(plan.claudeMarker)

  // 旧装接管:摘旧 hook 注册 + 遗留卡;config 缺失时 docs 从旧 gen.mjs 提取
  if (st.legacyMech.length || st.legacyHooks.found.length) {
    plan.legacy = buildLegacyPlan(root, st)
    if (!st.hasConfig) plan.legacy.docs = extractLegacyDocs(st.kanban)
  }

  // brownfield 散落归拢:骨架先立(manifest 是存根卡落点),无 config/manifest 时本轮只铺骨架
  if (det?.demos.length) {
    const ready = st.hasConfig
      && existsSync(join(st.kanban, 'decisions-manifest.json'))
      && existsSync(join(st.kanban, 'backlog-manifest.json'))
    if (ready) plan.merge = buildMergePlan(root, st, det, gi, opt)
    else plan.mergeDeferred = true
  }
  return plan
}

function printPlan(root, st, gi, plan, opt) {
  console.log(S.init.planTarget(root))
  console.log(S.init.planScenario(S.init.scenario[st.scenario]))
  console.log(S.init.planVars(plan.brand, gi.branch, gi.ghRepo))
  console.log(S.init.planPort(plan.port, plan.portNote))
  if (plan.dirs.length) console.log(S.init.planDirs(plan.dirs))
  if (plan.creates.length) console.log(S.init.planCreates(plan.creates))
  if (!plan.dirs.length && !plan.creates.length) console.log(S.init.planNoCreates)
  if (plan.narrativeSkip) console.log(S.init.planNarrativeSkip)
  if (plan.gitignoreAdd.length) console.log(S.init.planGitignoreMerge(plan.gitignoreAdd))
  console.log(plan.settingsAdd.length ? S.init.planSettingsAdd(plan.settingsAdd) : S.init.planSettingsOk)
  console.log(plan.needsClaudeMd ? S.init.planClaudeAdd(plan.claudeMarker) : S.init.planClaudeOk)
  if (plan.mergeDeferred) console.log(S.init.planMergeDeferred)
  if (plan.legacy) printLegacyPlan(plan.legacy, st.hasConfig)
  if (plan.merge) printMergePlan(plan.merge, opt)
  console.log(gi.isRepo ? S.init.planGitRepo : S.init.planGitNone)
  console.log(S.init.planSmoke)
}

function printLegacyPlan(lg, hasConfig) {
  console.log(S.init.legacyHeader)
  if (!hasConfig) {
    console.log(lg.docs ? S.init.legacyDocs(lg.docs.length) : S.init.legacyDocsNone)
  }
  console.log(lg.hooks.found.length ? S.init.legacyHooks(hookList(lg.hooks.found).join(';')) : S.init.legacyHooksNone)
  if (lg.mech.length) console.log(S.init.legacyMech(lg.mech.map((f) => `app/kanban/${f}`).join(' · ')))
  console.log(lg.cards.length
    ? S.init.legacyCards(lg.cards.length, lg.cards.map((c) => `${c.id}(${c.initKind})`).join(' · '))
    : S.init.legacyCardsNone)
}

function printMergePlan(mg, opt) {
  const act = (g) => S.init.gitAction[g]
  console.log(S.init.mergeHeader)
  if (mg.abort) { console.log(S.init.mergeAbort(mg.abort)); return }
  if (mg.sel.active) printSelection('plan', mg.sel, opt)
  for (const m of mg.moves) console.log(S.init.mergeMove(m.from, m.to, act(m.git)))
  for (const c of mg.conflicts) console.log(S.init.mergeConflict(c.from, c.to, act(c.git)))
  for (const a of mg.assets) console.log((a.sibling ? S.init.mergeSibling : S.init.mergeAsset)(a.from, a.to, act(a.git)))
  for (const r of mg.assetReview) console.log(S.init.mergeAssetReview(r.demo, r.ref, r.note))
  for (const s of mg.skips) console.log(S.init.mergeSkip(s.from, s.reason))
  console.log(mg.stubs.length
    ? S.init.mergeStubs(mg.stubs.length, mg.stubStatus, mg.stubs.map((s) => `${s.id}=${s.demo}`).join(' · '))
    : S.init.mergeStubsNone)
  console.log(mg.brokenLinks.length
    ? S.init.mergeBroken(mg.brokenLinks.length, mg.brokenLinks.map((l) => `${l.md} → ${l.demo}`).join(' · '))
    : S.init.mergeBrokenNone)
  console.log(mg.cards.length
    ? S.init.mergeCards(mg.cards.length, mg.cards.map((c) => `${c.id}(${c.initKind})`).join(' · '))
    : S.init.mergeCardsNone)
}

// ---- 模板渲染 ----
const renderTpl = (text, vars) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m))

// ---- 归拢执行(apply 内、持锁中调用;顺序=先写卡后动文件,孤儿窗口压为零) ----
// mtime 乐观锁:写前与盘点时比对,变了打招呼;mutate 一律基于「现读」内容重算(去重/id 重分配)
function updateManifest(path, expectMtime, label, mutate) {
  if (expectMtime != null && statSync(path).mtimeMs !== expectMtime) console.log(S.init.applyMtimeRace(label))
  const json = JSON.parse(readFileSync(path, 'utf8'))
  const n = mutate(json)
  if (n) writeFileSync(path, JSON.stringify(json, null, 2) + '\n')
  return n
}
function doMerge(root, gi, mg, touched) {
  // ① 存根卡 → decisions-manifest(已有卡跳过;code=id)
  const nStubs = updateManifest(mg.dmPath, mg.dmMtime, 'decisions-manifest.json', (dm) => {
    dm.entries ||= []
    const nextDec = idAllocator(dm.entries.map((e) => e.id), 'C-')
    let n = 0
    for (const s of mg.stubs) {
      if (mentioned(dm, basename(s.demo))) continue
      const id = nextDec()
      dm.entries.push({ ...s, id, code: id })
      n++
    }
    return n
  })
  if (nStubs) { touched.push('app/kanban/decisions-manifest.json'); console.log(S.init.applyStubs(nStubs, mg.stubStatus)) }

  // ② 遗留待办 → backlog 卡(断链一张、同名冲突各一张;initKind 判重,幂等)
  const nCards = updateManifest(mg.blPath, mg.blMtime, 'backlog-manifest.json', (bl) => {
    bl.items ||= []
    const need = mg.cards.filter((c) => !bl.items.some((it) => it.initKind === c.initKind))
    if (!need.length) return 0
    bl.tiers ||= {}
    if (!('0' in bl.tiers)) bl.tiers['0'] = 'init 遗留' // gen 硬校验 tier 需在词表;最小词汇追加(归拢/接管共用)
    const nextBl = idAllocator(bl.items.map((it) => it.id), 'BL-')
    for (const c of need) bl.items.push({ ...c, id: nextBl() })
    return need.length
  })
  if (nCards) { touched.push('app/kanban/backlog-manifest.json'); console.log(S.init.applyLeftoverCards(nCards)) }

  // ③ 文件归拢(卡已就位):git 策略逐文件
  const mvOne = (fromAbs, fromRel, toRel, gitSt) => {
    const toAbs = join(root, toRel)
    if (!existsSync(fromAbs)) { console.log(S.init.applyGone(fromRel)); return }
    mkdirSync(dirname(toAbs), { recursive: true })
    if (gitSt === 'tracked') {
      execFileSync('git', ['mv', '--', fromAbs, toAbs], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
      touched.push(fromRel) // rename 的删除侧也要进 commit pathspec
    } else {
      renameSync(fromAbs, toAbs) // ponytail: 跨文件系统 rename 会 EXDEV;目标与源同 repo,现实中同盘
      if (gitSt === 'untracked' && gi.isRepo) execFileSync('git', ['add', '--', toAbs], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
    }
    touched.push(toRel)
    console.log(S.init.applyMove(fromRel, toRel, S.init.gitAction[gitSt]))
  }
  for (const m of mg.moves) mvOne(m.abs, m.from, m.to, m.git)
  for (const c of mg.conflicts) mvOne(c.abs, c.from, c.to, c.git)
  for (const a of mg.assets) mvOne(a.abs, a.from, a.to, a.git)
  for (const s of mg.skips.filter((x) => !x.moveOnly)) console.log(S.init.applySkip(s.from, s.reason))
  // 挑选跳过的候选:不写卡不动文件(仍是散落态,重跑 scan 会再列出)
  if (mg.sel.active) {
    for (const s of mg.sel.skipped) console.log(S.init.selSkip('apply', s.rel, s.reason))
    console.log(S.init.selStats('apply', mg.sel.selected.length, mg.sel.skipped.length))
    if (mg.sel.missPats.length) console.log(S.init.selNoHit('apply', mg.sel.missPats))
    if (!mg.remember && mg.sel.skipped.length) console.log(S.init.selRememberHint('apply'))
  }
  // ④ --remember:--exclude 里真命中候选的模式记入 config.skipScattered(长期豁免;
  //    此后 scan 标注[配置跳过]不再当候选;仅追加去重,config 其余键原样)
  let nRemember = 0
  if (mg.remember && mg.sel.hitPats.length) {
    const cfgPath = join(root, 'app', 'kanban', 'kanban.config.json')
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
    cfg.skipScattered ||= []
    const add = mg.sel.hitPats.filter((p) => !cfg.skipScattered.includes(p))
    if (add.length) {
      cfg.skipScattered.push(...add)
      writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')
      touched.push('app/kanban/kanban.config.json')
      nRemember = add.length
      console.log(S.init.applyRemember(add.length, add))
    }
  }
  if (mg.brokenLinks.length) console.log(S.init.applyBroken(mg.brokenLinks.length))
  return nStubs + nCards + mg.moves.length + mg.conflicts.length + mg.assets.length + nRemember
}

// ---- 旧装接管执行(apply 内、持锁中调用;数据只追加 backlog,机制注册摘除,旧件不删) ----
function doLegacy(root, lg, touched) {
  // ① 接管遗留 → backlog 卡(initKind 判重,幂等;与归拢同一词表/同一乐观锁口径)
  if (lg.cards.length) {
    const n = updateManifest(lg.blPath, lg.blMtime, 'backlog-manifest.json', (bl) => {
      bl.items ||= []
      const need = lg.cards.filter((c) => !bl.items.some((it) => it.initKind === c.initKind))
      if (!need.length) return 0
      bl.tiers ||= {}
      if (!('0' in bl.tiers)) bl.tiers['0'] = 'init 遗留'
      const nextBl = idAllocator(bl.items.map((it) => it.id), 'BL-')
      for (const c of need) bl.items.push({ ...c, id: nextBl() })
      return need.length
    })
    if (n) { touched.push('app/kanban/backlog-manifest.json'); console.log(S.init.applyLegacyCards(n)) }
  }
  // ② settings.json 摘除旧 kanban hook 注册(只认两枚标记;deny/其他键原样)
  if (lg.hooks.found.length && existsSync(lg.hooks.path)) {
    const s = JSON.parse(readFileSync(lg.hooks.path, 'utf8'))
    const removed = stripLegacyHooks(s)
    if (removed) {
      writeFileSync(lg.hooks.path, JSON.stringify(s, null, 2) + '\n')
      touched.push('.claude/settings.json')
      console.log(S.init.applyHooksRemoved(removed, hookList(lg.hooks.found).join('、')))
    }
  }
  // ③ 旧机制件:不删除,报告 + 「割接清理」卡跟踪
  for (const f of lg.mech) console.log(S.init.applyMechKeep(f))
}

// ---- apply ----
async function doApply(root, st, gi, opt, plan) {
  if (plan.merge?.abort) fail(plan.merge.abort)
  if (!st.hasConfig && !plan.brand) fail(S.init.failNeedBrand)

  if (!opt.yes) {
    if (!process.stdin.isTTY) fail(S.init.failNeedYes)
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const ans = (await rl.question(S.init.confirmPrompt)).trim().toLowerCase()
    rl.close()
    if (ans !== 'y' && ans !== 'yes') fail(S.init.cancelled)
  }

  const touched = [] // repo 相对路径;git 只 add 这些(多会话脏工作树,绝不 add -A)
  const createdKanban = !st.hasConfig // greenfield:整个 app/kanban 树都是本次产物(含 gen 生成物)
  const vars = { BRAND: plan.brand, BRANCH: gi.branch, GH_REPO: gi.ghRepo, APP_BASE: '', DEMO_BASE: '' }

  mkdirSync(st.kanban, { recursive: true })
  const lockPath = join(st.kanban, '.init-lock')
  if (existsSync(lockPath)) fail(S.init.failLock(lockPath))
  writeFileSync(lockPath, `pid=${process.pid} at=${new Date().toISOString()}\n`)
  const unlock = () => { try { unlinkSync(lockPath) } catch {} }
  process.on('exit', unlock) // fail()=process.exit 会跳过 finally,exit 事件兜底清锁
  process.on('SIGINT', () => { unlock(); process.exit(130) })
  process.on('SIGTERM', () => { unlock(); process.exit(143) })

  try {
    // -- 1. 骨架(存在即跳过,幂等) --
    for (const d of ['demos', 'shots']) mkdirSync(join(st.kanban, d), { recursive: true })
    const writeOnce = (relPath, content, mode) => {
      const p = join(root, relPath)
      if (existsSync(p)) return
      writeFileSync(p, content)
      if (mode) chmodSync(p, mode)
      touched.push(relPath)
      console.log(S.init.applyCreate(relPath))
    }
    if (!st.hasConfig) {
      const cfg = JSON.parse(renderTpl(readFileSync(join(TPL, 'kanban.config.json'), 'utf8'), vars))
      cfg.lang = opt.lang ?? 'zh'
      cfg.port = plan.port
      cfg.lanes = opt.lanes
      if (plan.legacy?.docs) cfg.docs = plan.legacy.docs // 旧装接管:docs 提取自旧 gen.mjs 的 REF_DOCS
      writeOnce('app/kanban/kanban.config.json', JSON.stringify(cfg, null, 2) + '\n')
    }
    for (const f of plan.layManifests) {
      writeOnce(`app/kanban/${f}`, renderTpl(readFileSync(join(TPL, 'manifests', f), 'utf8'), vars))
    }
    writeOnce('app/kanban/demos/.no-card-ok', readFileSync(join(TPL, 'no-card-ok'), 'utf8'))
    // .gitignore:新装种入;已有则并入缺失条目(去重,不动既有行)
    if (!st.hasConfig) {
      const giPath = join(st.kanban, '.gitignore')
      if (!existsSync(giPath)) writeOnce('app/kanban/.gitignore', readFileSync(join(TPL, 'gitignore'), 'utf8'))
      else {
        const add = gitignoreMissing(giPath)
        if (add.length) {
          const cur = readFileSync(giPath, 'utf8')
          writeFileSync(giPath, cur + (cur === '' || cur.endsWith('\n') ? '' : '\n') + add.join('\n') + '\n')
          touched.push('app/kanban/.gitignore')
          console.log(S.init.applyGitignoreMerge(add.length))
        }
      }
    }
    writeOnce('app/kanban/serve.py', readFileSync(join(TPL, 'serve.py'), 'utf8'), 0o755)
    writeOnce('app/kanban/serve-kanban.sh', readFileSync(join(TPL, 'serve-kanban.sh'), 'utf8'), 0o755)

    // -- 2. settings deny 注入(深合并,变了才写) --
    if (plan.settingsAdd.length) {
      const settingsPath = join(root, '.claude', 'settings.json')
      const cur = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {}
      const inject = JSON.parse(readFileSync(join(TPL, 'settings-inject.json'), 'utf8'))
      if (deepMerge(cur, inject)) {
        mkdirSync(join(root, '.claude'), { recursive: true })
        writeFileSync(settingsPath, JSON.stringify(cur, null, 2) + '\n')
        touched.push('.claude/settings.json')
        console.log(S.init.applySettings(plan.settingsAdd.length))
      }
    }

    // -- 3. CLAUDE.md 段注入(标记节判重) --
    if (plan.needsClaudeMd) {
      const cmPath = join(root, 'CLAUDE.md')
      const cur = existsSync(cmPath) ? readFileSync(cmPath, 'utf8') : ''
      const sep = cur === '' ? '' : (cur.endsWith('\n') ? '\n' : '\n\n')
      writeFileSync(cmPath, cur + sep + plan.claudeSection)
      touched.push('CLAUDE.md')
      console.log(S.init.applyClaudeMd)
    }

    // -- 3.5 散落归拢(先写卡后 mv;守卫见 .init-lock 放行本轮) --
    if (plan.merge) doMerge(root, gi, plan.merge, touched)

    // -- 3.6 旧装接管(遗留卡 + 摘旧 hook 注册;旧机制件不删) --
    if (plan.legacy) doLegacy(root, plan.legacy, touched)

    // -- 4a. gen 冒烟(仍持锁:gen 写 app/kanban 生成物,属本次变更;首次失败不留给守卫) --
    try {
      execFileSync(process.execPath, [join(HERE, 'gen.mjs'), '--dir', st.kanban], { stdio: ['ignore', 'ignore', 'pipe'] })
      console.log(S.init.applyGenOk)
    } catch (e) {
      fail(S.init.failGen((e.stderr || e.message || '').toString().slice(0, 1200)))
    }
  } finally { unlock() }

  // -- 4b. 守卫冒烟(锁已释放,让审计真跑;期望 exit 0 且无 block 决定) --
  let hookOut = ''
  try {
    hookOut = execFileSync(process.execPath, [join(HERE, 'stop-hook.mjs')], {
      input: '{}',
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString()
  } catch (e) {
    fail(S.init.failGuard(e.status, (e.stderr || '').toString().slice(0, 800)))
  }
  if (hookOut.includes('"decision":"block"')) fail(S.init.failGuardOrphan(hookOut.slice(0, 800)))
  console.log(S.init.applyGuardOk)

  // -- 5. git:只 add 触碰路径,commit 也限定 pathspec(不卷别的会话的暂存区) --
  if (gi.isRepo) {
    // 归拢时 gen 生成物/卡/demo 全在 app/kanban 下,整目录纳入 pathspec(同 greenfield)
    const wholeKanban = createdKanban || !!plan.merge
    const paths = [...new Set(wholeKanban ? ['app/kanban', ...touched.filter((p) => !p.startsWith('app/kanban'))] : touched)]
    const dirty = paths.length
      ? (git(root, ['status', '--porcelain', '--', ...paths]) ?? '')
      : ''
    if (dirty) {
      // git mv 的删除侧路径已不在工作树,git add 对它会报 pathspec 不匹配;add 只喂仍存在的,commit pathspec 全量
      const addable = paths.filter((p) => existsSync(join(root, p)))
      if (addable.length) execFileSync('git', ['add', '--', ...addable], { cwd: root, stdio: 'inherit' })
      const msg = plan.merge
        ? S.init.commitMerge(plan.merge.moves.length, plan.merge.conflicts.length, plan.merge.stubs.length, plan.merge.cards.length)
        : plan.legacy && (plan.legacy.cards.length || plan.legacy.hooks.found.length)
          ? S.init.commitLegacy(plan.legacy.hooks.found.length, plan.legacy.cards.length)
          : S.init.commitGreen(plan.brand, plan.port)
      execFileSync('git', ['commit', '-m', msg, '--', ...paths],
        { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] })
      console.log(S.init.applyCommitted(git(root, ['rev-parse', '--short', 'HEAD'])))
    } else {
      console.log(S.init.applyNoChange)
    }
  } else {
    console.log(S.init.applyNoGit)
  }
  if (plan.mergeDeferred) console.log(S.init.applyMergeDeferred)
  console.log(S.init.applyDone(plan.port))
  console.log(S.init.applyServe(plan.port))
}

// ---- scan ----
function doScan(root, st, gi, det, opt) {
  console.log(S.init.scanTarget(root, gi.isRepo, gi.branch))
  console.log(S.init.scanScenario(S.init.scenario[st.scenario]))
  console.log(S.init.scanConfig(st.hasConfig))
  for (const d of det.demos) console.log(S.init.scanDemo(d.rel, d.size, d.git, d.title, d.assets))
  for (const c of det.configSkipped) console.log(S.init.scanConfigSkipped(c.rel, c.pat))
  for (const c of det.claimed) console.log(S.init.scanClaimed(c))
  const nFrag = st.scattered.length - det.demos.length - det.claimed.length - det.configSkipped.length
  if (nFrag > 0) console.log(S.init.scanFrag(nFrag))
  // --only/--exclude 预演:候选逐个标注 [归拢]/[跳过](真正裁决在 plan/apply,口径同一函数)
  const sel = selectDemos(det.demos, opt)
  if (sel.active) printSelection('scan', sel, opt)
  for (const s of det.siblings) console.log(S.init.scanSibling(s.rel, s.size))
  for (const l of det.brokenLinks) console.log(S.init.scanBroken(l.md, l.ref, l.demo))
  if (!st.hasConfig && (st.legacyTraces.length || st.legacyMech.length || st.kanbanDemos.length)) {
    console.log(S.init.scanLegacyTraces(st.legacyTraces, st.legacyMech, st.kanbanDemos.length))
  }
  if (st.legacyHooks.found.length) {
    console.log(S.init.scanLegacyHooks(hookList(st.legacyHooks.found).join(';')))
  }
  if (st.scenario === 'greenfield') console.log(S.init.scanHintGreen)
  if (st.scenario === 'scattered') console.log(S.init.scanHintScattered)
  if (st.scenario === 'installed' && det.demos.length) console.log(S.init.scanHintInstalled)
  if (st.scenario === 'legacy') console.log(S.init.scanHintLegacy)
  // 摘要 JSON(文件名/title/git 状态/资产/大小;绝不含正文)
  const summary = {
    scenario: st.scenario,
    demos: det.demos.map((d) => ({ file: d.rel, title: d.title, size: d.size, git: d.git, assets: d.assets.map((a) => ({ ref: a.ref, exists: a.exists, inDemoDir: a.inDemoDir })) })),
    configSkipped: det.configSkipped,
    claimedByManifest: det.claimed,
    siblings: det.siblings.map((s) => ({ file: s.rel, size: s.size })),
    brokenLinks: det.brokenLinks,
    legacy: st.hasConfig ? null : { manifests: st.legacyTraces, mech: st.legacyMech, kanbanDemos: st.kanbanDemos.length, hooks: st.legacyHooks.found.map((f) => ({ event: f.event, label: S.init.hookLabel[f.kind] })) },
  }
  console.log(S.init.scanSummaryHead)
  console.log(JSON.stringify(summary, null, 2))
}

// ---- main ----
async function main() {
  const opt = parseArgs(process.argv.slice(2))
  const root = resolve(opt.dir || process.cwd())
  if (!existsSync(root)) fail(`目标目录不存在:${root}`)
  S = pickStrings(resolveLang(root, opt))
  const st = classify(root)
  const gi = gitInfo(root)
  const det = st.scattered.length ? collectScan(root, st, gi) : { demos: [], siblings: [], brokenLinks: [], claimed: [], configSkipped: [], cfgSkipAssets: [] }
  if (opt.cmd === 'scan') return doScan(root, st, gi, det, opt)
  const plan = await buildPlan(root, st, gi, opt, det)
  printPlan(root, st, gi, plan, opt)
  if (opt.cmd === 'apply') await doApply(root, st, gi, opt, plan)
}

await main()
