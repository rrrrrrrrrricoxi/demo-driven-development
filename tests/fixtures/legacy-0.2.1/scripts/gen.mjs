#!/usr/bin/env node
/**
 * 看板生成器(零依赖;ddd-kanban plugin 版,配置来自看板目录下 kanban.config.json)。
 *
 *   node scripts/gen.mjs --dir <kanbanDir>   # 缺省:$CLAUDE_PROJECT_DIR/app/kanban,或 cwd(若含 kanban.config.json)
 *   python3 <kanbanDir>/serve.py             # 服务化(:config.port, no-cache),refs/ 文档可点开
 *
 * 做三件事:
 *   1. 读 manifest.json(进度看板)+ backlog-manifest.json(backlog),各自校验。
 *   2. 把开发文档(config.docs)用内置零依赖 md 渲染器渲染进 kanban/refs/*.html
 *      (带返回栏 / 统一样式 / 目录 / 锚点),供卡片站内链接,避免 ../docs/*.md 逃出根 404。
 *   3. 写自包含 index.html:[进度看板] / [决策路径] / [决策/Demo] / [Backlog] / [文档库] tab;
 *      决策 tab 带筛选/排序工具条,文档库是四段 Hub(D46);卡片里
 *      文档链接 → refs/ 渲染页,代码/数据链接 → GitHub blob,commit → GitHub commit。
 *
 * 改任一 manifest 或被引用文档后重跑;refs/*.html 与 index.html 都提交进 git。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { execSync, execFileSync } from 'node:child_process'
import { join, resolve, relative, sep } from 'node:path'

// ---- 看板目录定位:--dir <kanbanDir> > $CLAUDE_PROJECT_DIR/app/kanban > cwd(若含 kanban.config.json)----
function resolveKanbanDir() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--dir')
  if (i >= 0) {
    if (!args[i + 1]) throw new Error('--dir 需要参数:看板目录(含 kanban.config.json)')
    return resolve(args[i + 1])
  }
  if (process.env.CLAUDE_PROJECT_DIR) {
    const d = join(process.env.CLAUDE_PROJECT_DIR, 'app', 'kanban')
    if (existsSync(join(d, 'kanban.config.json'))) return d
  }
  if (existsSync(join(process.cwd(), 'kanban.config.json'))) return process.cwd()
  throw new Error('定位不到看板目录:传 --dir <kanbanDir>,或设 CLAUDE_PROJECT_DIR(取其 app/kanban),或在含 kanban.config.json 的目录下运行')
}
const HERE = resolveKanbanDir()
const REPO_ROOT = join(HERE, '..', '..') // 项目根(读 docs 用)
const REFS_DIR = join(HERE, 'refs')

// ---- kanban.config.json(schemaVersion 缺省 1;lang 缺省 zh;port 由 serve.py 消费,gen 不用)----
let cfg
try { cfg = JSON.parse(readFileSync(join(HERE, 'kanban.config.json'), 'utf8')) }
catch (e) { throw new Error(`读不到 ${join(HERE, 'kanban.config.json')}:${e.message}`) }
if ((cfg.schemaVersion ?? 1) !== 1) console.warn(`[gen] ⚠ 未知 schemaVersion=${cfg.schemaVersion},按 1 读`)
if (!cfg.brand) throw new Error('kanban.config.json 缺 brand')
const BRAND = cfg.brand
const HTML_LANG = (cfg.lang ?? 'zh') === 'zh' ? 'zh-CN' : String(cfg.lang)
const KANBAN_REL = relative(REPO_ROOT, HERE).split(sep).join('/') // 看板目录的 repo-root 相对路径(LAMOS = 'app/kanban')

const m = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'))
const b = JSON.parse(readFileSync(join(HERE, 'backlog-manifest.json'), 'utf8'))
const dm = JSON.parse(readFileSync(join(HERE, 'decisions-manifest.json'), 'utf8'))
// instance.ghRepo/branch 三 manifest 各存一份(现状,避免双真源迁移);不一致仅提醒,不阻断
{
  const three = [['manifest', m], ['backlog-manifest', b], ['decisions-manifest', dm]]
  for (const k of ['ghRepo', 'branch']) {
    if (new Set(three.map(([, x]) => (x.instance || {})[k])).size > 1)
      console.warn(`[gen] ⚠ instance.${k} 三 manifest 不一致:` + three.map(([n, x]) => `${n}=${(x.instance || {})[k]}`).join(' · '))
  }
}
let pm = null // 决策路径叙事(demo 历程 → 拍板项 → C 决策);缺失则不渲染「决策路径」tab
try { pm = JSON.parse(readFileSync(join(HERE, 'path-manifest.json'), 'utf8')) }
catch (e) { console.warn('[gen] ⚠ path-manifest.json 缺失/无效,跳过决策路径 tab:', e.message) }
const DEMOS_DIR = join(HERE, 'demos')

const GH_BLOB = `https://github.com/${m.instance.ghRepo}/blob/${m.instance.branch}/`

// ---- 渲染进 refs/ 的开发文档(config.docs;path 相对 REPO_ROOT;baseDir 解析文档内相对链接)----
const DOC_CATS = ['交接与接手', '设计与决策', '评审与审计', '计划与预案', '环境与指南', '会话日志', '其他']

// ———— 文档库 Hub 四段(D46:地基→流程→操作→存档);category→段名映射,config.docSegments 覆盖 ————
// 段模型是 Hub 设计的固定部分(不做通用 DSL);config 的自定义点 = 哪个 category 归哪段。
const DOC_SEGMENTS = [
  { key: 'fnd', name: '地基', typ: '设计 · 决策', color: '#0f7b6c', desc: '数据模型、口径、决策日志 —— 落 UI 前先站稳' },
  { key: 'prc', name: '流程', typ: '开发 · 协作', color: '#2383e2', desc: '怎么推进:评审、排期、接手' },
  { key: 'ops', name: '操作', typ: '部署 · 环境', color: '#b7791f', desc: '跑起来 / 部署 / 环境' },
  { key: 'arc', name: '存档', typ: 'journal · 历史', color: '#a8a29e', desc: '会话日志与杂项,灰置尾', muted: true },
]
const SEG_BY_NAME = Object.fromEntries(DOC_SEGMENTS.map((s) => [s.name, s]))
// 缺省映射(照 demo B 注释;7 个法定 category 全覆盖);config.docSegments[cat] 逐类覆盖
const DOC_SEG_DEFAULT = {
  设计与决策: '地基',
  评审与审计: '流程', 计划与预案: '流程', 交接与接手: '流程',
  环境与指南: '操作',
  会话日志: '存档', 其他: '存档',
}
const segWarned = new Set()
function segKeyOfCat(cat) {
  const name = (cfg.docSegments && cfg.docSegments[cat]) || DOC_SEG_DEFAULT[cat]
  const seg = name && SEG_BY_NAME[name]
  if (!seg) {
    if (!segWarned.has(cat)) { console.warn(`[gen] ⚠ docSegments 未映射 category「${cat}」→ 落「存档」`); segWarned.add(cat) }
    return 'arc'
  }
  return seg.key
}

// 文档更新时间(真源 = git log 最后提交日;untracked/无 git 退回文件 mtime;都拿不到则空)—— gen 期取好嵌入
function docUpdated(relPath) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ad', '--date=short', '--', relPath], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (out) return out
  } catch { /* 无 git / 命令失败 */ }
  try { return statSync(join(REPO_ROOT, relPath)).mtime.toISOString().slice(0, 10) } catch { return '' }
}

const REF_DOCS = (cfg.docs || []).map((d, i) => {
  const where = `kanban.config.json docs[${i}](${d.path || d.out || '?'})`
  for (const k of ['path', 'out', 'title']) if (!d[k]) throw new Error(`${where} 缺 ${k}`)
  if (d.baseDir === undefined || d.baseDir === null) throw new Error(`${where} 缺 baseDir(可为 "" = repo 根)`)
  if (!DOC_CATS.includes(d.category)) throw new Error(`${where} category 非法:${JSON.stringify(d.category)};合法值:${DOC_CATS.join(' / ')}`)
  return {
    src: d.path, out: d.out, title: d.title, baseDir: d.baseDir, cat: d.category, line: d.line || undefined,
    desc: d.desc || '', // 一句话定位(可选,缺省不渲染该行)
    order: Number.isFinite(d.order) ? d.order : null, // 阅读动线序号(可选)
    seg: segKeyOfCat(d.category), updated: docUpdated(d.path),
  }
})
const RENDERED = {} // repo-root 相对路径 → refs basename
for (const d of REF_DOCS) RENDERED[d.src] = d.out

// ---- 校验 ----------------------------------------------------------------
const iterIds = new Set(m.iterations.map((i) => i.id))
for (const t of m.tasks) {
  if (!iterIds.has(t.iteration)) throw new Error(`task ${t.id} 引用未知迭代 ${t.iteration}`)
  if (!(t.status in m.statuses)) throw new Error(`task ${t.id} 未知状态 ${t.status}`)
}
const blGroupIds = new Set(b.groups.map((g) => g.id))
for (const it of b.items) {
  if (!(it.status in b.statuses)) throw new Error(`backlog ${it.id} 未知状态 ${it.status}`)
  if (!blGroupIds.has(it.status)) throw new Error(`backlog ${it.id} 状态 ${it.status} 不在 groups`)
  if (!(String(it.tier) in b.tiers)) throw new Error(`backlog ${it.id} 未知 tier ${it.tier}`)
  if (!(it.priority in b.priorities)) throw new Error(`backlog ${it.id} 未知优先级 ${it.priority}`)
}
const decGroupIds = new Set(dm.groups.map((g) => g.id))
for (const e of dm.entries) {
  if (!(e.status in dm.statuses)) throw new Error(`decision ${e.id} 未知状态 ${e.status}`)
  if (e.closedKind && !['dropped', 'archived'].includes(e.closedKind)) throw new Error(`decision ${e.id} 未知 closedKind ${e.closedKind}`)
  if (e.closedKind && e.status !== 'closed') throw new Error(`decision ${e.id} closedKind 只配 closed 状态`)
  if (!decGroupIds.has(e.status)) throw new Error(`decision ${e.id} 状态 ${e.status} 不在 groups`)
}

// 语义色(对齐 demo/app:teal=成功、blue=进行/accent、amber=警示、red=超标/阻塞、grey=中性、purple=单列)
const STATUS_COLOR = {
  planned: '#a8a29e', active: '#2383e2', testing: '#b7791f',
  done: '#0f7b6c', blocked: '#d44c47', separate: '#8268b0',
}
const BL_STATUS_COLOR = { ready: '#0f7b6c', blocked: '#b7791f', design: '#2383e2', deferred: '#a8a29e', done: '#3f7d70' }
const PRI_COLOR = { high: '#d44c47', med: '#b7791f', low: '#a8a29e' }
const TIER_COLOR = { 1: '#0f7b6c', 2: '#8268b0', 3: '#2383e2' }
const DEC_STATUS_COLOR = { deciding: '#b7791f', mockup: '#a8a29e', decided: '#0f7b6c', live: '#159b88', closed: '#8a8781' }
const PRI_ORDER = { high: 0, med: 1, low: 2 }
const CODE_EXT = /\.(py|ts|tsx|js|mjs|json|sh|sql|toml|cfg|txt|yml|yaml)$/i

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ———— 线别(lanes)预设制,不做通用 DSL:null = 关(新项目默认)/ 'lamos-legacy' = 原样封装 LAMOS A/B/C 启发式 ————
// 阈值/正则/文案是 rules-as-code;将来真有第二个项目要线别,再谈通用化(YAGNI)。
if ((cfg.lanes ?? null) !== null && cfg.lanes !== 'lamos-legacy')
  throw new Error(`kanban.config.json lanes 非法:${JSON.stringify(cfg.lanes)};合法值:null / "lamos-legacy"`)
const LANE = cfg.lanes === 'lamos-legacy' ? {
  // ———— 线路派生(不手打 tag:从 designDoc 路径 / D 码区间 / id 前缀确定性推断)————
  // A 线在本仓库无自有产物(决策/文档/demo 皆无),只作为「源 A 线」backlog 的来源被兼挂到 B。
  decLine: (e) => {
    if (e.line) return e.line // 手动覆盖:派生看不出的上下文(如 Q8 指标审核=C 已删的旧范式功能)由 manifest 显式定线
    const dd = e.designDoc || ''
    if (dd.includes('/lamos-c/')) return 'C'
    if (dd.includes('/lamos-b/')) return 'B'
    if (/^UXC\d+$/.test(e.id) || (e.iters || []).some((c) => /^C/.test(c)) || (e.demo || '').includes('demos/')) return 'C'
    const n = parseInt(String(e.id).replace(/^\D+/, ''), 10)
    if (/^D/.test(e.id)) return n >= 22 ? 'C' : 'B'
    if (/^Q/.test(e.id)) return n >= 8 ? 'C' : 'B'
    return 'C'
  },
  iterLine: (it) => (/^C\d+$/.test(it.id) ? 'C' : 'B'),
  docLine: (d) => d.line || (/lamos-c|entry-ux-demos/.test(d.src) ? 'C' : /lamos-b/.test(d.src) ? 'B' : 'B C'), // 显式 line 覆盖优先(派生看路径、看不出跨线内容);否则根/journal/环境文档=B/C 共享
  taskLine: (t) => (/^(TC|C)\d/.test(t.id) || /^C\d+$/.test(t.iteration) ? 'C' : 'B'),
  blLine: (it) => {
    const base = /^BL-C/i.test(it.id) ? 'C' : 'B'
    const srcA = /A\s*线|源\s*A/.test(`${it.source || ''}${it.title || ''}${it.problem || ''}`)
    return base === 'B' && String(it.tier) === '3' && srcA ? 'B A' : base // 仅 T3「源 A 线可平移」项兼挂 A(对齐 A hint 口径);T1/T2 的 B 项不漏进 A
  },
  // —— 以下字符串为 LAMOS 冻结原文(与割接前 gen.mjs 逐字节相同),不做模板拼接 ——
  hubbrand: 'LAMOS · C 检验工作区',
  defaultLine: 'C',
  lsLineKey: 'lamosc_hub_line',
  lsTfKey: 'lamosc_hub_tf',
  // v0.2(D46):hubbar 线路钮 → 决策工具条线别分段 + 文档库线别 chips 取代;localStorage key 语义不变
  lineTitles: { A: 'A · 归档', B: 'B · 历史', C: 'C · 当前' },
  typeLabels: { D: '决策', Q: '疑问', UXC: '体验', AD: '审批', REVC: '评审' },
  lineHintsHtml: `
  <div class="linehints">
    <span class="lf-hint" data-line-note="C">demo-7 提单模型 · 当前 live —— 决策 D22+ / lamos-c 文档 / 全部 demo。</span>
    <span class="lf-hint" data-line-note="B">台账 rebuild,已被 C 取代:决策 D1–D21 / Q1–Q7、进度 I0–I9、backlog 全备;这条线主动跳过 demo 阶段,决策直接拍板。</span>
    <span class="lf-hint" data-line-note="A">委托单系统(ADR 码):7 项决策 AD1–AD7 + 6 个对比 demo 已并入本板(源自 dev 分支 <code>decision-map</code>),设计文档链 GitHub。这是 demo-驱动决策的起点。</span>
  </div>`,
  h1RewriteJs: `
    // 顶栏 h1 随档换前缀(内容已随档过滤,标题不能一直写 C):LAMOS-C/LAMOS → LAMOS(-X)
    // 用 ^LAMOS(-C)? 前缀替换:「LAMOS · Backlog」这类中性 label 也要跟档
    document.querySelectorAll('.pane .topbar h1').forEach(function (h) {
      if (h.dataset.base === undefined) h.dataset.base = h.textContent
      const pre = line === 'all' ? 'LAMOS' : 'LAMOS-' + line
      h.textContent = h.dataset.base.replace(/^LAMOS(-C)?/, pre)
    })`,
  savedLineJs: `  // 默认档 = C 线·当前(live 主线);已有记忆(含手选「全部」)按记忆走
  let savedLine = 'C'
  try { savedLine = localStorage.getItem('lamosc_hub_line') || 'C' } catch (e) {}`,
  blSessHtml: `
    <span class="sess">B 线遗留 + C 线新增 · T1 leftover / T2 设计 deferral / T3 源 A 线可平移</span>`,
  blStamp: '由 <code>gen.mjs</code> 生成自 <code>backlog-manifest.json</code> — 收 B 线遗留 + C 线新增待办 + 源 A 线可平移项,改完重跑生成。',
  decStamp: '由 <code>gen.mjs</code> 生成自 <code>decisions-manifest.json</code> — demo 存 <code>kanban/demos/</code>,已决追加到 <code>docs/lamos-b/DECISIONS.md</code>。',
} : {
  // lanes 关闭:线别推导全部返回空,线别 UI(筛选钮/hint/h1 前缀重写)不渲染,其余照常
  decLine: () => '', iterLine: () => '', docLine: () => '', taskLine: () => '', blLine: () => '',
  hubbrand: esc(BRAND),
  defaultLine: 'all',
  lsLineKey: `${BRAND.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'kanban'}_hub_line`,
  lsTfKey: `${BRAND.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'kanban'}_hub_tf`,
  lineTitles: {},
  typeLabels: {},
  lineHintsHtml: '',
  h1RewriteJs: '',
  savedLineJs: `  let savedLine = 'all'`,
  blSessHtml: '',
  blStamp: '由 <code>gen.mjs</code> 生成自 <code>backlog-manifest.json</code> — 改完重跑生成。',
  decStamp: '由 <code>gen.mjs</code> 生成自 <code>decisions-manifest.json</code> — demo 存 <code>kanban/demos/</code>。',
}
const { decLine, iterLine, docLine, taskLine, blLine } = LANE
const LANES_ON = cfg.lanes === 'lamos-legacy' // 线别 UI(工具条分段/文档库 chips/hint/h1 重写)只在此开
const LANE_IDS = LANES_ON ? ['A', 'B', 'C'] : []

// 长文折叠(信息密度):运行期在 pane 可见时量高打 .clamp(字符数近似会被列宽骗——
// 三列栅格下 96 字 ≈5 行;display:none 面板量高为 0,故只量可见元素,见内联 clampScan)

const ghCommit = (hash) => `https://github.com/${m.instance.ghRepo}/commit/${hash}`

// baseDir(repo-root 相对)+ href → 规范化 repo-root 相对路径(POSIX)。
function resolveRepoPath(baseDir, href) {
  const parts = (baseDir ? baseDir.split('/') : []).concat(href.split('/'))
  const stack = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') stack.pop()
    else stack.push(p)
  }
  return stack.join('/')
}

// 卡片 link(相对 kanban/)→ 渲染页 / GitHub blob / 原样。
function cardLink(href) {
  const raw = String(href || '')
  if (/^https?:/i.test(raw)) return { href: raw, ext: true }
  let frag = '', path = raw
  const hi = raw.indexOf('#')
  if (hi >= 0) { frag = raw.slice(hi); path = raw.slice(0, hi) }
  const repoPath = resolveRepoPath(KANBAN_REL, path)
  if (RENDERED[repoPath]) return { href: 'refs/' + RENDERED[repoPath] + frag }
  if (CODE_EXT.test(repoPath)) return { href: GH_BLOB + repoPath + frag, ext: true }
  return { href: raw }
}
const linkA = (l) => {
  const r = cardLink(l.href)
  return `<a href="${esc(r.href)}"${r.ext ? ' target="_blank" rel="noopener"' : ''}>↗ ${esc(l.title)}</a>`
}

// ---- demo 返回栏(幂等注入 demos/*.html 顶部;回看板「决策/Demo」tab)----
// 版本号 bump 时:旧版本块整块剥离后重注入,文案/样式跟着 gen 演进(否则幂等守卫会让旧文案永远留在已注入的 demo 里)
const BACKNAV_VER = 'lamos-b-backnav v2'
const BACKNAV_BLOCK = `<!-- ${BACKNAV_VER} -->
<style id="lamos-b-backnav-style">
 body{padding-top:44px}
 #lamos-b-backnav{position:fixed;top:0;left:0;right:0;height:44px;z-index:9999;display:flex;align-items:center;gap:10px;padding:0 16px;background:#f6f5f2;border-bottom:1px solid #e3e2e0;font:13px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
 #lamos-b-backnav a{display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:600;color:#2383e2;border:1px solid #e3e2e0;border-radius:8px;padding:5px 11px;background:#fff}
 #lamos-b-backnav a:hover{border-color:#2383e2}
 #lamos-b-backnav .ctx{color:#6f6e6b;font-size:12px}
</style>
<nav id="lamos-b-backnav"><a href="../index.html#decisions">← 返回看板</a><span class="ctx">LAMOS Demo · mock 数据</span></nav>`

function injectDemoBacknav() {
  let files = []
  try { files = readdirSync(DEMOS_DIR).filter((f) => f.toLowerCase().endsWith('.html')) } catch { return }
  let injected = 0, upgraded = 0, skipped = 0
  for (const f of files) {
    const p = join(DEMOS_DIR, f)
    let html = readFileSync(p, 'utf8')
    if (html.includes(BACKNAV_VER)) { skipped++; continue }
    // 旧版本块(<!-- lamos-b-backnav vN --> … </nav>)剥离,随后按当前版本重注入
    const stripped = html.replace(/\n?<!-- lamos-b-backnav v[0-9]+ -->[\s\S]*?<\/nav>/, '')
    const hadOld = stripped !== html
    html = stripped
    if (!/<body[^>]*>/.test(html)) { console.warn(`[gen] ⚠ demo ${f} 无 <body>,跳过`); continue }
    writeFileSync(p, html.replace(/(<body[^>]*>)/, `$1\n${BACKNAV_BLOCK}`), 'utf8')
    hadOld ? upgraded++ : injected++
  }
  console.log(`[gen] ↩ demo 返回栏:注入 ${injected} · 升级 ${upgraded}(${skipped} 已是当前版)`)
}

// ============================================================================
//  零依赖 markdown → HTML 渲染器(移植自 A 线 decision-map/gen.mjs)
// ============================================================================
function makeSlugger() {
  const used = new Set()
  let sec = 0
  return function slug(rawText) {
    const adr = rawText.match(/^ADR-(\d+)/i)
    const dq = rawText.match(/^([DQ])-?(\d+)\b/i)
    let base
    if (adr) base = 'adr-' + adr[1]
    else if (dq) base = dq[1].toLowerCase() + '-' + dq[2]
    else {
      base = rawText.toLowerCase().replace(/`[^`]*`/g, ' ').replace(/[*~_]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      if (!base) base = 'sec-' + ++sec
    }
    let s = base, n = 2
    while (used.has(s)) s = base + '-' + n++
    used.add(s)
    return s
  }
}

// 文档内链接重写:已渲染文档 → 同目录 basename;代码/数据 → GitHub blob;否则不可点 span。
function makeRelinker(baseDir) {
  return function (rawHref) {
    let href = String(rawHref).trim()
    if (/^(https?:|mailto:|tel:)/i.test(href)) return { href, external: true }
    if (href.startsWith('#')) return { href }
    let frag = ''
    const h = href.indexOf('#')
    if (h >= 0) { frag = href.slice(h); href = href.slice(0, h) }
    if (!href) return { href: frag || '#' }
    const repoPath = resolveRepoPath(baseDir, href)
    if (RENDERED[repoPath]) return { href: RENDERED[repoPath] + frag }
    if (CODE_EXT.test(repoPath)) return { href: GH_BLOB + repoPath + frag, external: true }
    return { dead: true, repoPath }
  }
}

function inlineMd(text, relink) {
  const codes = []
  let t = String(text).replace(/`([^`\n]+)`/g, (mm, body) => { codes.push(body); return '\u0000' + (codes.length - 1) + '\u0000' })
  t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (mm, txt, href) => {
    const r = relink(href)
    if (r.dead) return '<span class="ref-dead" title="未渲染引用:' + esc(r.repoPath) + '">' + txt + '</span>'
    const ext = r.external ? ' target="_blank" rel="noopener"' : ''
    return '<a href="' + esc(r.href) + '"' + ext + '>' + txt + '</a>'
  })
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  t = t.replace(/\u0000(\d+)\u0000/g, (mm, n) => '<code>' + esc(codes[+n]) + '</code>')
  return t
}

const isTableSep = (s) => /\|/.test(s) && /^[\s|:\-]+$/.test(s) && /--/.test(s)
const isListLine = (s) => /^\s*([-*+]|\d+[.)])\s+/.test(s)
const isHr = (s) => /^\s*([-*_])\1{2,}\s*$/.test(s) && !s.includes('|')
const isFence = (s) => /^\s*(`{3,}|~{3,})/.test(s)
const isHeading = (s) => /^#{1,6}\s+/.test(s)

function splitRow(s) {
  let t = s.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((c) => c.trim())
}

function renderListSiblings(items, lo, hi, inline) {
  let html = ''
  let j = lo
  while (j < hi) {
    const ordered = items[j].ordered
    const tag = ordered ? 'ol' : 'ul'
    html += '<' + tag + '>'
    while (j < hi && items[j].ordered === ordered) {
      const it = items[j]
      let k = j + 1
      while (k < hi && items[k].indent > it.indent) k++
      html += '<li>' + inline(it.text) + (k > j + 1 ? renderListSiblings(items, j + 1, k, inline) : '') + '</li>'
      j = k
    }
    html += '</' + tag + '>'
  }
  return html
}

function renderQuoteInner(text, inline) {
  return text.split(/\n\s*\n/).filter((p) => p.trim())
    .map((p) => '<p>' + p.split('\n').map(inline).join('<br>') + '</p>').join('')
}

function mdToHtml(src, baseDir) {
  const relink = makeRelinker(baseDir)
  const slug = makeSlugger()
  const inline = (t) => inlineMd(t, relink)
  const headings = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let warned = 0
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/)
    if (fence) {
      const ch = fence[2][0], len = fence[2].length
      const lang = (fence[3] || '').trim().split(/\s+/)[0] || ''
      const buf = []
      i++
      while (i < lines.length) {
        const cl = lines[i].match(/^(\s*)(`{3,}|~{3,})\s*$/)
        if (cl && cl[2][0] === ch && cl[2].length >= len) { i++; break }
        buf.push(lines[i]); i++
      }
      const cls = lang ? ' class="language-' + esc(lang) + '"' : ''
      out.push('<pre><code' + cls + '>' + buf.map(esc).join('\n') + '</code></pre>')
      continue
    }
    if (/^\s*$/.test(line)) { i++; continue }
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (h) {
      const level = h[1].length, rawt = h[2], id = slug(rawt)
      headings.push({ level, text: rawt, slug: id })
      out.push('<h' + level + ' id="' + esc(id) + '">' + inline(rawt) + '</h' + level + '>')
      i++; continue
    }
    if (isHr(line)) { out.push('<hr>'); i++; continue }
    if (/^\s*>/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++ }
      try { out.push('<blockquote>' + renderQuoteInner(buf.join('\n'), inline) + '</blockquote>') }
      catch { out.push('<pre class="md-fallback">' + esc(buf.join('\n')) + '</pre>'); warned++ }
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const start = i
      try {
        const aligns = splitRow(lines[i + 1]).map((c) => {
          const l = c.startsWith(':'), r = c.endsWith(':')
          return l && r ? 'center' : r ? 'right' : l ? 'left' : ''
        })
        const ths = splitRow(lines[i])
        let j = i + 2
        const rows = []
        while (j < lines.length && lines[j].includes('|') && lines[j].trim() && !isFence(lines[j]) && !isHeading(lines[j])) {
          rows.push(splitRow(lines[j])); j++
        }
        const al = (k) => (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '')
        let tbl = '<table><thead><tr>'
        ths.forEach((c, k) => { tbl += '<th' + al(k) + '>' + inline(c) + '</th>' })
        tbl += '</tr></thead><tbody>'
        rows.forEach((r) => {
          tbl += '<tr>'
          for (let k = 0; k < ths.length; k++) tbl += '<td' + al(k) + '>' + inline(r[k] || '') + '</td>'
          tbl += '</tr>'
        })
        tbl += '</tbody></table>'
        out.push(tbl); i = j
      } catch {
        const buf = []
        let j = start
        while (j < lines.length && lines[j].includes('|') && lines[j].trim()) { buf.push(lines[j]); j++ }
        out.push('<pre class="md-fallback">' + esc(buf.join('\n')) + '</pre>'); i = j; warned++
      }
      continue
    }
    if (isListLine(line)) {
      const start = i
      try {
        const items = []
        while (i < lines.length && isListLine(lines[i])) {
          const mm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
          items.push({ indent: mm[1].length, ordered: /\d/.test(mm[2]), text: mm[3] }); i++
        }
        out.push(renderListSiblings(items, 0, items.length, inline))
      } catch {
        const buf = []
        let j = start
        while (j < lines.length && isListLine(lines[j])) { buf.push(lines[j]); j++ }
        out.push('<pre class="md-fallback">' + esc(buf.join('\n')) + '</pre>'); i = j; warned++
      }
      continue
    }
    {
      const buf = []
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isHeading(lines[i]) && !isFence(lines[i]) &&
        !/^\s*>/.test(lines[i]) && !isListLine(lines[i]) && !isHr(lines[i]) &&
        !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
        buf.push(lines[i]); i++
      }
      out.push('<p>' + buf.map(inline).join('<br>') + '</p>')
    }
  }
  return { html: out.join('\n'), headings, warned }
}

const REF_VARS = `:root{
  --bg:#f6f5f2; --panel:#ffffff; --border:#e3e2e0; --text:#37352f; --muted:#6f6e6b;
  --primary:#0f7b6c; --accent:#2383e2;
  --font-body:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  --font-mono:"SF Mono",ui-monospace,Menlo,"JetBrains Mono",monospace;
  --shadow:0 1px 2px rgba(40,38,34,.04),0 4px 16px rgba(40,38,34,.05);
}`
const REF_CSS = `${REF_VARS}
  *{box-sizing:border-box}
  body{margin:0;padding-top:46px;background:var(--bg);color:var(--text);font-family:var(--font-body);
    font-size:14px;line-height:1.72;-webkit-font-smoothing:antialiased}
  code,pre{font-family:var(--font-mono)}
  html{scroll-behavior:smooth}
  #refnav{position:fixed;top:0;left:0;right:0;height:46px;z-index:50;display:flex;align-items:center;gap:12px;
    padding:0 18px;background:var(--panel);border-bottom:1px solid var(--border);box-shadow:var(--shadow)}
  #refnav a.back{display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:600;color:var(--accent);
    border:1px solid var(--border);border-radius:8px;padding:5px 11px;background:var(--panel);font-size:13px}
  #refnav a.back:hover{border-color:var(--accent)}
  #refnav .src{color:var(--muted);font-size:12.5px;font-family:var(--font-mono)}
  .reftoc{position:fixed;top:46px;left:0;width:280px;height:calc(100vh - 46px);overflow-y:auto;
    background:var(--panel);border-right:1px solid var(--border);padding:16px 8px 50px}
  .reftoc-h{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;padding:0 12px 9px}
  .reftoc-nav{display:flex;flex-direction:column;gap:1px}
  .reftoc-nav a{display:flex;align-items:baseline;gap:7px;text-decoration:none;border-left:2px solid transparent;
    border-radius:0 7px 7px 0;padding:5px 12px;color:var(--text);line-height:1.4}
  .reftoc-nav a:hover{background:rgba(55,53,47,.05)}
  .reftoc-nav a.active{background:rgba(35,131,226,.10);border-left-color:var(--accent)}
  .reftoc-nav a.lvl3{padding-left:26px}
  .toc-t{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .reftoc-nav a.active .toc-t{color:var(--text)}
  .refmain{max-width:900px;margin:0 auto;padding:24px 22px 90px}
  .reflayout.has-toc .refmain{margin:0 0 0 280px;max-width:940px;padding:24px 30px 90px}
  @media (max-width:880px){ .reftoc{display:none} .reflayout.has-toc .refmain{margin:0 auto;max-width:900px;padding:24px 22px 90px} }
  article.md{word-wrap:break-word}
  article.md h1{font-size:24px;margin:6px 0 16px}
  article.md h2{font-size:19px;margin:30px 0 10px;border-bottom:1px solid var(--border);padding-bottom:5px}
  article.md h3{font-size:16px;margin:22px 0 8px}
  article.md h4{font-size:14px;margin:18px 0 6px}
  article.md h1,article.md h2,article.md h3,article.md h4{font-weight:700;letter-spacing:.1px;scroll-margin-top:58px}
  article.md p{margin:10px 0}
  article.md ul,article.md ol{margin:10px 0;padding-left:26px}
  article.md li{margin:3px 0}
  article.md del{color:var(--muted)}
  article.md hr{border:none;border-top:1px solid var(--border);margin:24px 0}
  article.md a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(35,131,226,.30)}
  article.md a:hover{border-bottom-color:var(--accent)}
  article.md a[target=_blank]::after{content:" ↗";font-size:.82em;color:var(--muted)}
  article.md .ref-dead{color:var(--muted);border-bottom:1px dotted #c9c6c0;cursor:help}
  article.md :not(pre) > code{background:rgba(55,53,47,.07);color:var(--text);padding:1px 6px;border-radius:5px;font-size:12.6px}
  article.md pre{overflow-x:auto;background:#0f172a;color:#e2e8f0;border-radius:10px;padding:14px 16px;margin:12px 0;font-size:12.6px;line-height:1.62}
  article.md pre code{background:none;color:inherit;padding:0;font-size:inherit}
  article.md pre.md-fallback{background:#fff7ed;color:#7c2d12;border:1px solid #f3cd9b;white-space:pre-wrap}
  article.md table{border-collapse:collapse;width:100%;margin:14px 0;font-size:13px;display:block;overflow-x:auto}
  article.md th,article.md td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}
  article.md thead th{background:#f1f0ed;font-weight:700;white-space:nowrap}
  article.md tbody tr:nth-child(even){background:#faf9f7}
  article.md blockquote{margin:12px 0;padding:9px 15px;border-left:3px solid var(--accent);background:#eff6fb;color:#3a4150;border-radius:0 8px 8px 0}
  article.md blockquote p{margin:5px 0}`

function buildTocHtml(headings) {
  const items = (headings || []).filter((h) => h.level >= 2 && h.level <= 3)
  if (items.length < 2) return ''
  const clean = (t) => esc(String(t).replace(/`([^`]*)`/g, '$1').replace(/[*~]/g, ''))
  let nav = ''
  for (const h of items) {
    const cls = h.level === 3 ? ' class="lvl3"' : ''
    nav += '<a' + cls + ' href="#' + esc(h.slug) + '"><span class="toc-t">' + clean(h.text) + '</span></a>'
  }
  return '<aside class="reftoc"><div class="reftoc-h">目录 · ' + items.length + ' 项</div><nav class="reftoc-nav">' + nav + '</nav></aside>'
}

function renderRefPage({ title, bodyHtml, srcLabel, headings }) {
  const toc = buildTocHtml(headings)
  const spy = toc
    ? `<script>
(function(){
  var links=[].slice.call(document.querySelectorAll('.reftoc-nav a'));
  var toc=document.querySelector('.reftoc'); if(!links.length) return;
  var map={},heads=[];
  links.forEach(function(a){var id=a.getAttribute('href').slice(1);var el=document.getElementById(id);if(el){map[id]=a;heads.push(el);}});
  if(!heads.length) return; var active=null;
  function keepInView(a){ if(!toc) return; var top=a.offsetTop; if(top<toc.scrollTop+8||top>toc.scrollTop+toc.clientHeight-30){ toc.scrollTop=top-toc.clientHeight/2; } }
  function onScroll(){ var y=window.scrollY+72,cur=heads[0];
    for(var i=0;i<heads.length;i++){ if(heads[i].offsetTop<=y) cur=heads[i]; else break; }
    var a=map[cur.id]; if(a&&a!==active){ if(active)active.classList.remove('active'); a.classList.add('active'); active=a; keepInView(a); } }
  window.addEventListener('scroll',onScroll,{passive:true}); window.addEventListener('resize',onScroll,{passive:true}); onScroll();
})();
</script>`
    : ''
  return `<!doctype html>
<html lang="${HTML_LANG}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(BRAND)} 看板</title>
<style>${REF_CSS}</style>
</head>
<body>
<nav id="refnav"><a class="back" href="../index.html">← 决策看板</a><span class="src">${esc(srcLabel)}</span></nav>
<div class="reflayout${toc ? ' has-toc' : ''}">
${toc}
<main class="refmain"><article class="md">
${bodyHtml}
</article></main>
</div>
${spy}
</body>
</html>
`
}

function writeRefs() {
  mkdirSync(REFS_DIR, { recursive: true })
  let totalWarn = 0
  for (const d of REF_DOCS) {
    let bodyHtml, headings = []
    try {
      const raw = readFileSync(join(REPO_ROOT, d.src), 'utf8')
      const r = mdToHtml(raw, d.baseDir)
      bodyHtml = r.html; headings = r.headings || []; totalWarn += r.warned || 0
      if (r.warned) console.warn(`[gen] ⚠ refs: ${d.src} 有 ${r.warned} 个块退化为 <pre>`)
    } catch (e) {
      let raw = ''
      try { raw = readFileSync(join(REPO_ROOT, d.src), 'utf8') } catch {}
      bodyHtml = '<pre class="md-fallback">' + esc(raw || `(读取失败:${d.src}\n${e.message})`) + '</pre>'
      totalWarn++
      console.warn(`[gen] ⚠ refs: fell back for ${d.src}: ${e.message}`)
    }
    writeFileSync(join(REFS_DIR, d.out), renderRefPage({ title: d.title, bodyHtml, srcLabel: d.src, headings }), 'utf8')
  }
  console.log(`[gen] 📄 refs 渲染 ${REF_DOCS.length} 篇 → refs/${totalWarn ? `(${totalWarn} 块退化兜底)` : ''}`)
}

// ============================================================================
//  截图廊(shots.html):验证截图存档,随 PR 入库;静态站无目录列举能力 → gen 期扫描
// ============================================================================
let SHOT_COUNT = 0 // 提级入口徽章用(tab 行「截图 · N ↗」)
{
  const SHOTS_DIR = join(HERE, 'shots')
  const ALL_CARD_IDS = new Set([...dm.entries.map((e) => e.id), ...b.items.map((i) => i.id), ...m.tasks.map((t) => t.id)])
  /* 前缀 → 看板卡:blc27→BL-C27 / bl2→BL-2 / uxc34→UXC34 / d38→D38;命不中给裸前缀 */
  const shotCardId = (prefix) => {
    const cands = []
    const mb = prefix.match(/^bl(c?)(\d+)$/)
    if (mb) cands.push(`BL-${mb[1].toUpperCase()}${mb[2]}`)
    const mg = prefix.match(/^([a-z]+)(\d+)$/)
    if (mg) cands.push(mg[1].toUpperCase() + mg[2])
    return cands.find((id) => ALL_CARD_IDS.has(id)) ?? null
  }
  /* 入库日期取 git 提交日;未跟踪(预览提取件)退回文件 mtime */
  const shotDate = (file) => {
    try {
      const d = execSync(`git log -1 --format=%cs -- "shots/${file}"`, { cwd: HERE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      if (d) return d
    } catch { /* 非 git 环境退 mtime */ }
    try { return statSync(join(SHOTS_DIR, file)).mtime.toISOString().slice(0, 10) } catch { return '' }
  }
  let shotFiles = []
  try { shotFiles = readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.png')).sort() } catch { /* 目录缺失=空态 */ }
  SHOT_COUNT = shotFiles.length
  const shotMeta = new Map(shotFiles.map((f) => [f, shotDate(f)]))
  const groups = new Map()
  for (const f of shotFiles) {
    const key = (f.match(/^([a-z]+[0-9]+)/) || [null, f.split('-')[0]])[1]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(f)
  }
  const newest = (files) => Math.max(...files.map((f) => Date.parse(shotMeta.get(f) || '') || 0))
  // 导航按「最新决策」降序:决策清单 entries 是新→旧,组按其对应卡在清单里的位次排(位次小=决策新);
  // 无决策卡映射的组(如 backlog/老 D 码)排在决策组之后,同档以入库日期新→旧兜底。
  const decisionRank = new Map(dm.entries.map((e, i) => [e.id, i]))
  const groupRank = (key) => {
    const card = shotCardId(key)
    return card != null && decisionRank.has(card) ? decisionRank.get(card) : Infinity
  }
  const groupsSorted = [...groups.entries()].sort((a, z) => {
    const ra = groupRank(a[0]), rz = groupRank(z[0])
    if (ra !== rz) return ra - rz
    return newest(z[1]) - newest(a[1])
  })
  const shotsBody = shotFiles.length === 0
    ? `<p class="shots-empty">暂无截图——各 PR 的验证截图入库后会出现在这里。</p>`
    : groupsSorted.map(([key, files]) => {
        const card = shotCardId(key)
        const head = `<h2 id="g-${esc(key)}">${esc(key)}${card ? ` <a class="cardlink" href="index.html#${esc(card)}">→ 卡片 ${esc(card)}</a>` : ''}<span class="gn">×${files.length}</span></h2>`
        const cells = files.map((f) => `<a class="shot" href="shots/${esc(f)}" target="_blank" rel="noopener">
  <img loading="lazy" src="shots/${esc(f)}" alt="${esc(f)}">
  <span class="fn">${esc(f)}</span><span class="dt">${esc(shotMeta.get(f) || '')}</span></a>`).join('\n')
        return `${head}\n<div class="shotgrid">\n${cells}\n</div>`
      }).join('\n')
  /* 侧边快捷目录:组序与正文一致(最新决策在前);≥2 组才渲染,复用 refs 页 .reftoc 布局与滚动高亮 */
  const shotsToc = groupsSorted.length < 2
    ? ''
    : `<aside class="reftoc"><div class="reftoc-h">截图组 · ${groupsSorted.length} 组</div><nav class="reftoc-nav">` +
      groupsSorted.map(([key, files]) => {
        const card = shotCardId(key)
        return `<a href="#g-${esc(key)}"><span class="toc-t">${esc(key)}${card ? ` · ${esc(card)}` : ''}</span><span class="toc-n">×${files.length}</span></a>`
      }).join('') +
      `</nav></aside>`
  const shotsSpy = shotsToc
    ? `<script>
(function(){
  var links=[].slice.call(document.querySelectorAll('.reftoc-nav a'));
  var toc=document.querySelector('.reftoc'); if(!links.length) return;
  var map={},heads=[];
  links.forEach(function(a){var id=a.getAttribute('href').slice(1);var el=document.getElementById(id);if(el){map[id]=a;heads.push(el);}});
  if(!heads.length) return; var active=null;
  function keepInView(a){ if(!toc) return; var top=a.offsetTop; if(top<toc.scrollTop+8||top>toc.scrollTop+toc.clientHeight-30){ toc.scrollTop=top-toc.clientHeight/2; } }
  function onScroll(){ var y=window.scrollY+72,cur=heads[0];
    for(var i=0;i<heads.length;i++){ if(heads[i].offsetTop<=y) cur=heads[i]; else break; }
    var a=map[cur.id]; if(a&&a!==active){ if(active)active.classList.remove('active'); a.classList.add('active'); active=a; keepInView(a); } }
  window.addEventListener('scroll',onScroll,{passive:true}); window.addEventListener('resize',onScroll,{passive:true}); onScroll();
})();
</script>`
    : ''
  const SHOTS_CSS = `
  .shotsmain{max-width:1060px;margin:0 auto;padding:24px 22px 90px}
  .reflayout.has-toc .shotsmain{margin:0 0 0 280px;max-width:1180px;padding:24px 30px 90px}
  @media (max-width:880px){ .reflayout.has-toc .shotsmain{margin:0 auto;max-width:1060px;padding:24px 22px 90px} }
  .reftoc-nav a{justify-content:space-between}
  .toc-n{font-size:11px;color:var(--muted);font-family:var(--font-mono);flex:none}
  .shotsmain h2{scroll-margin-top:58px}
  .shotsmain h1{font-size:22px;margin:6px 0 4px}
  .shotsmain .sub{color:var(--muted);font-size:13px;margin:0 0 18px}
  .shotsmain h2{font-size:15px;margin:26px 0 10px;display:flex;align-items:baseline;gap:10px;font-family:var(--font-mono)}
  .shotsmain h2 .gn{color:var(--muted);font-size:12px;font-weight:400}
  .cardlink{font-size:12.5px;font-weight:600;color:var(--accent);text-decoration:none}
  .cardlink:hover{text-decoration:underline}
  .shotgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
  .shot{display:flex;flex-direction:column;gap:3px;text-decoration:none;border:1px solid var(--border);
    border-radius:10px;padding:8px;background:var(--panel);box-shadow:var(--shadow)}
  .shot:hover{border-color:var(--accent)}
  .shot img{width:100%;height:130px;object-fit:cover;object-position:top;border-radius:6px;background:#f1f0ed}
  .shot .fn{font-size:11px;color:var(--text);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .shot .dt{font-size:10.5px;color:var(--muted)}
  .shots-empty{color:var(--muted);padding:40px 0;text-align:center}`
  writeFileSync(join(HERE, 'shots.html'), `<!doctype html>
<html lang="${HTML_LANG}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>截图廊 · ${esc(BRAND)} 看板</title>
<style>${REF_CSS}${SHOTS_CSS}</style>
</head>
<body>
<nav id="refnav"><a class="back" href="index.html">← 决策看板</a><span class="src">${KANBAN_REL}/shots/ · 验证截图存档,随 PR 入库</span></nav>
<div class="reflayout${shotsToc ? ' has-toc' : ''}">
${shotsToc}
<main class="shotsmain">
<h1>截图廊</h1>
<p class="sub">共 ${shotFiles.length} 张 · ${groups.size} 组——按前缀归组,组名可跳对应看板卡;点图开原图。</p>
${shotsBody}
</main>
</div>
${shotsSpy}
</body>
</html>
`, 'utf8')
  console.log(`[gen] 截图廊 ${shotFiles.length} 张 / ${groups.size} 组 → shots.html`)
}

// ============================================================================
//  进度看板
// ============================================================================
const real = m.tasks.filter((t) => t.status !== 'separate')
const doneCount = real.filter((t) => t.status === 'done').length
const pct = real.length ? Math.round((doneCount / real.length) * 100) : 0

const iterStats = m.iterations.map((it) => {
  const ts = m.tasks.filter((t) => t.iteration === it.id)
  const done = ts.filter((t) => t.status === 'done').length
  const active = ts.some((t) => t.status === 'active' || t.status === 'testing')
  const separate = ts.length > 0 && ts.every((t) => t.status === 'separate')
  const state = separate ? 'separate' : ts.length && done === ts.length ? 'done' : active ? 'active' : 'planned'
  return { ...it, total: ts.length, done, state }
})

const statusBadge = (s) => `<span class="badge" style="--c:${STATUS_COLOR[s]}">${esc(m.statuses[s])}</span>`

// 迭代 → 该步落定的决策(首个 iter=决策落定,其余=后续落地/修订);进度面板 + 决策路径 timeline 共用
const decByIter = {}
for (const e of dm.entries) {
  if (!Array.isArray(e.iters)) continue
  e.iters.forEach((c, i) => (decByIter[c] ||= []).push({ e, decide: i === 0 }))
}
const iterDecChips = (id) =>
  (decByIter[id] || [])
    .map(
      ({ e, decide }) =>
        `<a class="tl-dec ${decide ? 'decide' : 'land'}" href="#${esc(e.code)}" title="${esc(e.title)}">${decide ? '' : '↳ '}${esc(e.code)} ${esc(e.title)}</a>`,
    )
    .join('')

// pathmap 节点:点开=在下方详情面板显示该步内容(总览页自足,不必往下翻);plink 携两侧线路交集
const pnodeItems = iterStats.map((it) => ({
  line: iterLine(it),
  html: `
    <button class="pnode pnode-${it.state}" data-iter="${esc(it.id)}" data-line="${iterLine(it)}" style="--c:${STATUS_COLOR[it.state]}">
      <span class="pdot">${esc(it.id)}</span>
      <span class="ptitle">${esc(it.title)}</span>
      <span class="pcount">${it.done}/${it.total}</span>
    </button>`,
}))
const pathNodes = pnodeItems
  .map((n, i) => (i ? `<span class="plink" data-line="${pnodeItems[i - 1].line === n.line ? n.line : ''}"></span>` : '') + n.html)
  .join('')

// ———— 统一行卡(collapsed = 单行等高,点 .rhead 展开 .rbody;杀「忽大忽小」)————
const lineTag = (l) =>
  String(l || '')
    .split(' ')
    .filter(Boolean)
    .map((x) => `<span class="rline line-${esc(x)}">${esc(x)}</span>`)
    .join('')
const rowHead = ({ id, badge, title, tags = '', line = '', date = '' }) => `
    <div class="rhead">
      <span class="tid">${esc(id)}</span>
      ${badge}
      <span class="rtitle">${esc(title)}</span>
      ${tags ? `<span class="rtags">${tags}</span>` : ''}
      <span class="rspacer"></span>
      ${lineTag(line)}
      ${date ? `<span class="cdate">${esc(date.slice(5))}</span>` : ''}
      <span class="rtoggle" aria-hidden="true">▾</span>
    </div>`

const card = (t) => `
  <article class="card lcard rcard card-${t.status}" id="${esc(t.id)}" data-line="${taskLine(t)}" style="--c:${STATUS_COLOR[t.status]}">
    ${rowHead({ id: t.id, badge: statusBadge(t.status), title: t.title, line: taskLine(t) })}
    <div class="rbody">
      <dl>
        ${t.problem ? `<dt>问题</dt><dd class="x">${esc(t.problem)}</dd>` : ''}
        <dt>方案</dt><dd class="x">${esc(t.approach)}</dd>
      </dl>
      ${
        t.commits?.length
          ? `<div class="row commits">${t.commits
              .map((c) => `<a class="commit" href="${ghCommit(c.hash)}" target="_blank" title="${esc(c.msg)}"><code>${esc(c.hash.slice(0, 7))}</code> ${esc(c.msg)}</a>`)
              .join('')}</div>`
          : ''
      }
      ${t.links?.length ? `<div class="row links">${t.links.map(linkA).join('')}</div>` : ''}
      ${t.notes ? `<p class="notes">${esc(t.notes)}</p>` : ''}
    </div>
  </article>`

// 每个迭代一块详情面板(默认隐藏,点 pathmap 节点显示对应块);任务卡在面板里常展开
// 任务 .lcard 留在 DOM(隐藏面板里也在)→ setLine 的进度/计数用 querySelectorAll 照数得到
const pathPanels = iterStats
  .map((it) => {
    const ts = m.tasks.filter((t) => t.iteration === it.id)
    if (!ts.length) return ''
    const decs = iterDecChips(it.id)
    return `
  <section class="pathpanel" id="${esc(it.id)}" data-iter="${esc(it.id)}" data-line="${iterLine(it)}">
    <header class="pp-head" style="--c:${STATUS_COLOR[it.state]}">
      <span class="gid">${esc(it.id)}</span>
      <h2>${esc(it.title)}</h2>
      <span class="gdetail">${esc(it.detail)}</span>
      <span class="gprog">${it.done}/${it.total}</span>
    </header>
    ${decs ? `<div class="pp-decs"><span class="pp-lbl">落定决策</span><span class="tl-chips">${decs}</span></div>` : ''}
    <div class="cards">${ts.map(card).join('')}</div>
  </section>`
  })
  .join('')

const legend = Object.entries(m.statuses)
  .map(([k, v]) => `<span class="lg"><i style="background:${STATUS_COLOR[k]}"></i>${esc(v)}</span>`)
  .join('')

const progressPane = `
  <div class="topbar">
    <h1>${esc(m.instance.label || BRAND + ' · 开发进度')}</h1>
    <span class="sess">${esc(m.instance.session)}</span>
    <a class="plan" href="${esc(cardLink(m.instance.planDoc).href)}">迭代计划 ↗</a>
    <span class="branch">branch: ${esc(m.instance.branch)}</span>
  </div>
  <div class="progress">
    <div class="pbar"><i style="width:${pct}%"></i></div>
    <span class="ptext" data-sep="${m.tasks.length > real.length ? '1' : ''}">${doneCount}/${real.length} 完成(${pct}%)${m.tasks.length > real.length ? '· 派单模块单独计' : ''}</span>
  </div>
  <nav class="pathmap">${pathNodes}</nav>
  <p class="pathhint">↑ 点任一步,下面直接看它的进展、落定的决策与提交 —— 这是总览,不用往下翻。</p>
  <div class="pathdetail">${pathPanels}</div>
  <p class="pane-empty">本线路在此分区无条目</p>
  <div class="legend">${legend}</div>
  <p class="stamp">由 <code>gen.mjs</code> 生成自 <code>manifest.json</code> — 状态以 manifest 为准,改完重跑生成。</p>`

// ============================================================================
//  工具条(D46 方案A,决策/Backlog 两 tab 共用):状态 chips + 线别分段(lanes 时)
//  + 维度/排序下拉 + 标题+编号搜索 + 行内清除钮 + meta 行;运行期逻辑见内联 initToolbar 工厂
//  控件自身即状态显示(chips 高亮/分段选中/下拉显值/搜索显文字),不另设已选摘要行
//  id 约定:<pre>chips / <pre>lineseg / <pre>dim / <pre>sort / <pre>search(clear) / <pre>clearall / <pre>meta / <pre>empty(clear)
// ============================================================================
const tbPrefix = (id) => (String(id).match(/^[A-Za-z]+/) || [''])[0]
// 状态 chips:计数是初始总数,运行期 refresh 按「除状态外的其余筛选维度」重算
const tbChips = (groups, labels, colors, countOf) => groups
  .map((g) => {
    const n = countOf(g.id)
    return n ? `<button type="button" class="stchip" data-k="${esc(g.id)}" data-lbl="${esc(labels[g.id])}" style="--c:${colors[g.id]}"><span class="dot"></span>${esc(labels[g.id])}<span class="cn">${n}</span></button>` : ''
  })
  .join('')
const tbLineSeg = (pre) => !LANES_ON ? '' : `
    <div class="tgroup"><span class="tlab">线别</span>
      <div class="lseg" id="${pre}lineseg">
        <button type="button" data-line="all" class="on">全部</button>
        ${LANE_IDS.map((l) => `<button type="button" data-line="${l}" title="${esc(LANE.lineTitles[l] || l)}">${l}</button>`).join('')}
      </div>
    </div>`
// 工具条 = 有意的两行:第 1 行状态 chips 独占(它最宽),第 2 行线别/下拉/搜索 ——
// 单行 flex-wrap 会把搜索框甩成孤悬第二行(margin-left:auto 推到右缘,看着像溢出),两行是设计而非挤压
const tbHtml = (pre, chips, dimOpts, dimAria) => `
  <div class="dectb">
    <div class="tbrow">
      <div class="tgroup stchips" id="${pre}chips" aria-label="状态筛选">${chips}</div>
    </div>
    <div class="tbrow">${tbLineSeg(pre)}
      <div class="tgroup">
        <select id="${pre}dim" aria-label="${dimAria}">${dimOpts}</select>
        <select id="${pre}sort" aria-label="排序">
          <option value="date-desc">排序 · 日期新→旧</option>
          <option value="date-asc">排序 · 日期旧→新</option>
          <option value="id">排序 · 按编号</option>
        </select>
      </div>
      <div class="tsearch">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.2" stroke="#8a8884" stroke-width="1.4"/><path d="M9.4 9.4L12.5 12.5" stroke="#8a8884" stroke-width="1.4" stroke-linecap="round"/></svg>
        <input id="${pre}search" type="search" placeholder="搜索标题 / 编号…" autocomplete="off">
        <button type="button" id="${pre}searchclear" class="tclear" aria-label="清除搜索">×</button>
      </div>
      <button type="button" class="clearall" id="${pre}clearall" style="display:none">清除筛选</button>
    </div>
  </div>
  <div class="decmeta" id="${pre}meta"></div>`
const tbEmpty = (pre) => `
  <div class="dec-empty" id="${pre}empty" style="display:none"><p>没有符合当前筛选的卡片。</p><button type="button" id="${pre}emptyclear">清除筛选</button></div>`

// ============================================================================
//  Backlog
// ============================================================================
const blCount = b.items.length
// 时间降序(2026-07-07 用户定向:打开当页先看到最新卡):date 新的在前,无 date 的按 id 数字倒序垫底
const numOf = (id) => parseInt(String(id).replace(/^\D+/, ''), 10) || 0
const byDateDesc = (a, b2) => {
  const da = a.date || ''
  const db = b2.date || ''
  if (da !== db) return db < da ? -1 : 1 // ISO 字符串比较;'' 恒垫底
  return numOf(b2.id) - numOf(a.id)
}
const blByStatus = (id) => b.items.filter((it) => it.status === id).sort(byDateDesc)

// Backlog 工具条:状态 chips + 优先级下拉(中文标签+计数)
const blChips = tbChips(b.groups, b.statuses, BL_STATUS_COLOR, (id) => b.items.filter((it) => it.status === id).length)
const blDimOpts = [`<option value="all">全部优先级 (${blCount})</option>`]
  .concat(Object.entries(b.priorities).map(([k, v]) => {
    const n = b.items.filter((it) => it.priority === k).length
    return n ? `<option value="${esc(k)}">${esc(v)} (${n})</option>` : ''
  }))
  .join('')

// 走查留痕(决策/backlog 通用):反复讨论期的测试证据 —— 截图存 kanban/shots/,
// manifest 里挂 walkthroughs:[{date,title,note?,shots:[{file,caption}]}],缩略图点开原图
const wtBlock = (list) =>
  !list?.length
    ? ''
    : `<div class="wtwrap">${list
        .map(
          (w) => `<div class="wt">
      <div class="wthead"><span class="wtdate">${esc(w.date || '')}</span>${esc(w.title || '走查留痕')}${w.note ? `<span class="wtnote">${esc(w.note)}</span>` : ''}</div>
      <div class="wtshots">${(w.shots || [])
        .map(
          (s) =>
            `<a href="${esc(s.file)}" target="_blank" rel="noopener" title="${esc(s.caption || '')}"><img src="${esc(s.file)}" loading="lazy" alt="${esc(s.caption || '')}"><span>${esc(s.caption || '')}</span></a>`,
        )
        .join('')}</div>
    </div>`,
        )
        .join('')}</div>`

const blCard = (it) => `
  <article class="blcard lcard rcard bl-${it.status}" id="${esc(it.id)}" data-line="${blLine(it)}" data-date="${esc(it.date || '')}" data-status="${esc(it.status)}" data-priority="${esc(it.priority)}" data-search="${esc((it.id + ' ' + it.title).toLowerCase())}" style="--c:${BL_STATUS_COLOR[it.status]}">
    ${rowHead({
      id: it.id,
      badge: `<span class="badge" style="--c:${BL_STATUS_COLOR[it.status]}">${esc(b.statuses[it.status])}</span>`,
      title: it.title,
      tags: `<span class="rtag" style="--c:${TIER_COLOR[it.tier]}">T${esc(it.tier)}</span><span class="rtag" style="--c:${PRI_COLOR[it.priority]}">${esc(b.priorities[it.priority])}</span>${it.blockedOn ? '<span class="rtag blk">⛔</span>' : ''}`,
      line: blLine(it),
      date: it.date,
    })}
    <div class="rbody">
      <div class="blbadges">
        <span class="bbadge" style="--c:${TIER_COLOR[it.tier]}">T${esc(it.tier)} · ${esc(b.tiers[it.tier])}</span>
        <span class="bbadge area">${esc(it.area)}</span>
        <span class="bbadge" style="--c:${PRI_COLOR[it.priority]}">优先级 ${esc(b.priorities[it.priority])}</span>
        <span class="bbadge src">${esc(it.source)}</span>
      </div>
      ${it.blockedOn ? `<p class="blockedon">⛔ 卡在:${esc(it.blockedOn)}</p>` : ''}
      <dl>
        <dt>背景</dt><dd class="x">${esc(it.problem)}</dd>
        <dt>解法</dt><dd class="x">${esc(it.approach)}</dd>
      </dl>
      ${it.note ? `<p class="notes">${esc(it.note)}</p>` : ''}
      ${wtBlock(it.walkthroughs)}
      ${it.links?.length ? `<div class="row links">${it.links.map(linkA).join('')}</div>` : ''}
    </div>
  </article>`

const blGroups = b.groups
  .map((g) => {
    const items = blByStatus(g.id)
    if (!items.length) return ''
    return `
  <section class="group" id="g-${esc(g.id)}">
    <header class="ghead" style="--c:${BL_STATUS_COLOR[g.id]}">
      <span class="gid">${items.length}</span>
      <h2>${esc(g.title)}</h2>
      <span class="gdetail">${esc(g.detail)}</span>
    </header>
    <div class="cards">${items.map(blCard).join('')}</div>
  </section>`
  })
  .join('')

const blLegend =
  Object.entries(b.statuses).map(([k, v]) => `<span class="lg"><i style="background:${BL_STATUS_COLOR[k]}"></i>${esc(v)}</span>`).join('') +
  '<span class="lg sep"></span>' +
  Object.entries(b.tiers).map(([k, v]) => `<span class="lg"><i style="background:${TIER_COLOR[k]}"></i>T${esc(k)} ${esc(v)}</span>`).join('')

const backlogPane = `
  <div class="topbar">
    <h1>${esc(b.instance.label || BRAND + ' · Backlog')}</h1>${LANE.blSessHtml}
    <span class="branch">branch: ${esc(b.instance.branch)}</span>
  </div>
  ${tbHtml('bl', blChips, blDimOpts, '优先级筛选')}
  ${blGroups}
  ${tbEmpty('bl')}
  <div class="legend">${blLegend}</div>
  <p class="stamp">${LANE.blStamp}</p>`

// ============================================================================
//  决策 / Demo
// ============================================================================
const decCount = dm.entries.length
const decByStatus = (id) => dm.entries.filter((e) => e.status === id).sort(byDateDesc)

// 决策工具条:状态 chips + 类型下拉(按实际存在的 id 前缀生成,出现序;lamos-legacy 附中文标签)
const decChips = tbChips(dm.groups, dm.statuses, DEC_STATUS_COLOR, (id) => decByStatus(id).length)
const decDimOpts = (() => {
  const counts = new Map()
  for (const e of dm.entries) { const p = tbPrefix(e.id); counts.set(p, (counts.get(p) || 0) + 1) }
  return [`<option value="all">全部类型 (${decCount})</option>`]
    .concat([...counts].map(([p, n]) => `<option value="${esc(p)}">${esc(p)}${LANE.typeLabels[p] ? ' · ' + LANE.typeLabels[p] : ''} (${n})</option>`))
    .join('')
})()

// 「去 live 页」:route 挂到 appBase(:8898 是静态站,裸 /templates 只会 404);
// 参数化路由(/t/:id 的 :id 是占位符,不是可达路径)退回对应列表页
const APP_BASE = dm.instance.appBase || 'http://localhost:5174'
const liveUrl = (route) => APP_BASE + (route.includes(':') ? '/tickets' : route)

// 每条决策 entry 必须有 code(decByCode / becameD / refines 全以 code 为 join 键,缺了静默断链)
for (const e of dm.entries) {
  if (!e.code) throw new Error(`decisions-manifest entry ${e.id} 缺 code 字段`)
}

// 设计文档章节锚点 chip(designSec:{anchor:'#..',label:'§..'})→ refs/design-c.html#anchor
const secChip = (e, s) => `<a class="secchip" href="${esc(cardLink((e.designDoc || '') + s.anchor).href)}">${esc(s.label)}</a>`

const decCard = (e) => {
  const secs = (e.designSec || []).map((s) => secChip(e, s)).join('')
  const iters = (e.iters || []).map((c) => `<a class="iterchip" href="#TC${esc(c.slice(1))}" title="迭代 ${esc(c)}">${esc(c)}</a>`).join('')
  const refines = (e.refines || []).map((r) => `<a class="refchip" href="#${esc(r.code)}" title="${esc(r.note)}">⤴ 修订 ${esc(r.code)}</a>`).join('')
  const hasMeta = secs || iters || refines
  const tags = e.demo ? `<span class="rtag demo">demo</span>` : ''
  return `
  <article class="deccard lcard rcard dec-${e.status}" id="${esc(e.id)}" data-line="${decLine(e)}" data-date="${esc(e.date || '')}" data-status="${esc(e.status)}" data-type="${esc(tbPrefix(e.id))}" data-search="${esc((e.id + ' ' + e.title).toLowerCase())}" style="--c:${DEC_STATUS_COLOR[e.status]}">
    ${rowHead({
      id: e.id,
      badge: `<span class="badge" style="--c:${DEC_STATUS_COLOR[e.status]}">${esc(e.status === 'closed' ? (e.closedKind === 'dropped' ? '不做' : '归档') : dm.statuses[e.status])}</span>`,
      title: e.title,
      tags,
      line: decLine(e),
      date: e.date,
    })}
    <div class="rbody">
      <dl>
        <dt>问题</dt><dd class="x">${esc(e.question)}</dd>
        ${e.decision ? `<dt>结论</dt><dd class="decided">✓ ${esc(e.decision)}</dd>` : `<dd class="pending">⏳ 待决——看 demo 后在此记结论,升 D 码</dd>`}
        ${e.demoNote ? `<dt>demo</dt><dd class="demonote">${esc(e.demoNote)}</dd>` : ''}
      </dl>
      ${hasMeta ? `<div class="pathmeta">
        ${secs ? `<span class="pm-lbl">设计</span>${secs}` : ''}
        ${iters ? `<span class="pm-lbl">迭代</span>${iters}` : ''}
        ${refines ? `<span class="pm-lbl">修订</span>${refines}` : ''}
      </div>` : ''}
      ${wtBlock(e.walkthroughs)}
      <div class="row links">
        ${e.demo ? `<a class="demolink" href="${esc(e.demo)}">▶ 打开 demo</a>` : ''}
        ${e.designDoc ? linkA({ title: '设计文档', href: e.designDoc }) : ''}
        ${e.route && e.routeLive ? `<a href="${esc(liveUrl(e.route))}" target="_blank" rel="noopener">→ 去 live 页</a>` : ''}
        ${(e.links || []).map(linkA).join('')}
      </div>
    </div>
  </article>`
}

const decGroups = dm.groups
  .map((g) => {
    const items = decByStatus(g.id)
    if (!items.length) return ''
    return `
  <section class="group" id="dg-${esc(g.id)}">
    <header class="ghead" style="--c:${DEC_STATUS_COLOR[g.id]}">
      <span class="gid">${items.length}</span>
      <h2>${esc(g.title)}</h2>
      <span class="gdetail">${esc(g.detail)}</span>
    </header>
    <div class="cards">${items.map(decCard).join('')}</div>
  </section>`
  })
  .join('')

const decLegend = Object.entries(dm.statuses)
  .map(([k, v]) => `<span class="lg"><i style="background:${DEC_STATUS_COLOR[k]}"></i>${esc(v)}</span>`)
  .join('')

const decisionsPane = `
  <div class="topbar">
    <h1>${esc(dm.instance.label || BRAND + ' · 决策 / Demo')}</h1>
    <span class="sess">demo-驱动决策 · 动 schema/后端前先用自包含 demo 跑 UI/操作流确认认知</span>
    <span class="branch">branch: ${esc(dm.instance.branch)}</span>
  </div>
  ${tbHtml('dec', decChips, decDimOpts, '类型筛选')}
  ${decGroups}
  ${tbEmpty('dec')}
  <div class="legend">${decLegend}</div>
  <p class="stamp">${LANE.decStamp}</p>`

// ============================================================================
//  决策路径(C 线叙事:理念转向 → demo 探索历程 → 五拍板项 → 服务化决策 D22–D30)
//  数据:path-manifest.json(叙事)+ decisions-manifest.json(D 码,已带 iters/designSec/demoNote)
// ============================================================================
const decByCode = Object.fromEntries(dm.entries.map((e) => [e.code, e]))
const cIters = m.iterations.filter((it) => /^C\d+$/.test(it.id))
const cTaskByIter = Object.fromEntries(m.tasks.filter((t) => /^TC\d+$/.test(t.id)).map((t) => [t.iteration, t]))
// decByIter 已在进度看板区提升定义(进度面板 + 本 timeline 共用)
const DESIGN_C_DOC = '../../docs/lamos-c/01-design.md'

function buildPathPane() {
  if (!pm) return '<p class="stamp">path-manifest.json 缺失,决策路径不可用。</p>'
  const demoBase = pm.demoBase || ''

  // ——三纪元脊柱:A 委托单(ADR·对比 demo)→ B 台账(直接拍板·0 demo)→ C 提单模型(demo 成熟)——
  // 脊柱是全history 叙事,不随线路筛选收敛;当前筛选的那一纪元高亮(CSS .wrap[data-line] .epoch)
  const epochSpine = `
  <div class="epochs">${(pm.epochs || [])
    .map(
      (e) => `
    <div class="epoch ep-${esc(e.line)}">
      <div class="ep-rail">
        <span class="ep-tag line-${esc(e.line)}">${esc(e.line)} 线</span>
        <span class="ep-period">${esc(e.period)}</span>
      </div>
      <div class="ep-body">
        <div class="ep-name">${esc(e.name)}</div>
        <p class="ep-axis"><b>主轴</b>${esc(e.axis)}</p>
        <p class="ep-how"><b>决策方式</b>${esc(e.how)}</p>
        <div class="ep-foot"><span class="ep-tally">${esc(e.tally)}</span><span class="ep-see">${esc(e.see)}</span></div>
      </div>
    </div>`,
    )
    .join('')}</div>`

  // A 线对比 demo(存本看板 demos/,:8898 直接可看)——每个回链自己的决策卡(跨 tab)
  const aDemoRail = (pm.aDemos || []).length
    ? `
  <div class="secband"><h2><span class="sec-line line-A">A</span> 对比 demo <span class="sub">schema / 字段 / 审批 UI 的选型,先做 demo 再拍板(6 个,存本板 demos/)</span></h2></div>
  <div class="demorail arail">${pm.aDemos
        .map(
          (d) => `
    <div class="demonode anode">
      <a class="dn-main" href="demos/${esc(d.file)}" target="_blank" rel="noopener" title="${esc(d.gist)}">
        <span class="dn-id">${esc(d.id)}</span>
        <span class="dn-name">${esc(d.name)}</span>
        <span class="dn-bet">${esc(d.gist)}</span>
      </a>
      <a class="dn-jump" href="#${esc(d.id)}" title="跳到决策卡 ${esc(d.id)}">决策卡 ${esc(d.id)} ↗</a>
    </div>`,
        )
        .join('')}</div>
  <p class="railnote">A 线 <code>decision-map</code> 的对比原型,是 demo-驱动决策最早的证据;点「决策卡」跨到「决策 / Demo」看结论。</p>`
    : ''

  // 为什么是提单模型:方向重考 + C 线设计原则(一切的起点)
  const originBlock = `
  <div class="secband"><h2>为什么是提单模型 <span class="sub">C 线设计原则的由来(整条路的起点)</span></h2></div>
  <div class="pivot"><span class="pivot-lbl">方向重考</span>${esc(pm.pivot || '')}</div>
  <div class="principles">
    <span class="pr-lbl">C 线已定版设计原则(区别 A / B 线,不回退)</span>
    <ul>${(pm.principles || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  </div>`

  // C 线 demo 探索历程:七 demo(旗舰高亮)→ 链 :8890;下方 demo-7 八轮打磨轨
  const demoNodes = pm.demos
    .map(
      (d) => `
    <a class="demonode${d.flagship ? ' flag' : ''}" href="${esc(demoBase + d.file)}" target="_blank" rel="noopener" title="${esc(d.bet)}">
      <span class="dn-id">${esc(d.id)}</span>
      <span class="dn-name">${esc(d.name)}</span>
      <span class="dn-bet">${esc(d.bet)}</span>
      <span class="dn-role">${esc(d.role)}</span>
    </a>`,
    )
    .join('')
  const rounds = pm.rounds
    .map(
      (r) => `
    <div class="roundnode">
      <span class="rn-n">${esc(r.n)}</span>
      <div class="rn-body"><b>${esc(r.title)}</b><span>${esc(r.gist)}</span></div>
    </div>`,
    )
    .join('<span class="rn-link"></span>')
  const demoDocsLinks = [
    pm.demoHandover ? linkA({ title: 'demo 探索交接(七 demo / 八轮全记录)', href: pm.demoHandover }) : '',
    pm.demoBrief ? linkA({ title: 'demo 设计简报(差异化主线)', href: pm.demoBrief }) : '',
  ].join('')
  const demoJourney = `
  <div class="secband">
    <h2><span class="sec-line line-C">C</span> demo 探索 <span class="sub">七个录入范式 → 收敛到 demo-7 提单模型</span></h2>
    <div class="secband-links">${demoDocsLinks}</div>
  </div>
  <div class="demorail">${demoNodes}</div>
  <p class="railnote">链接指向 <code>entry-ux-demos/serve.py :8890</code> 的活体 demo(需起服);demo-3 / demo-7 为两代旗舰。</p>
  <div class="roundhdr">demo-7(旗舰 v2)八轮打磨 —— 提单模型如何长成 C 线的 spec</div>
  <div class="rounds">${rounds}</div>`

  // ② demo 阶段五拍板项 → C 线 D 码
  const pins = pm.pinboard
    .map((p) => {
      const d = decByCode[p.becameD]
      return `
    <article class="pin">
      <header>
        <span class="pin-id">${esc(p.id)} · ${esc(p.no)}</span>
        <b>${esc(p.title)}</b>
        <a class="pin-arrow" href="#${esc(p.becameD)}" title="${esc(d ? d.title : '')}">→ ${esc(p.becameD)}${d ? ' ' + esc(d.title) : ''}</a>
      </header>
      <div class="pin-row"><span class="pin-lbl">demo 默认</span><span>${esc(p.demoDefault)}</span></div>
      <div class="pin-row"><span class="pin-lbl land">服务化落地</span><span>${esc(p.landed)}</span></div>
    </article>`
    })
    .join('')
  const pinboard = `
  <div class="secband"><h2><span class="sec-line line-C">C</span> demo 拍板项 → 服务化决策 <span class="sub">第八轮五提案,直接变成 C 线 D 码</span></h2></div>
  <div class="pins">${pins}</div>`

  // ① C 线落地路径时间线(迭代 / 决策 / 设计§ / demo 源头 四行泳道)——由新到旧,最新迭代在最上
  const bands = [...cIters]
    .reverse()
    .map((it) => {
      const task = cTaskByIter[it.id]
      const st = task ? task.status : 'planned'
      const decs = decByIter[it.id] || []
      const decChips = decs
        .map(
          ({ e, decide }) =>
            `<a class="tl-dec ${decide ? 'decide' : 'land'}" href="#${esc(e.code)}" title="${esc(e.title)}">${decide ? '' : '↳ '}${esc(e.code)} ${esc(e.title)}</a>`,
        )
        .join('')
      const secMap = {}
      decs.forEach(({ e }) => (e.designSec || []).forEach((s) => (secMap[s.anchor] = s.label)))
      const secChips = Object.entries(secMap)
        .map(([a, l]) => `<a class="tl-sec" href="${esc(cardLink(DESIGN_C_DOC + a).href)}">${esc(l)}</a>`)
        .join('')
      const demoNotes = decs.filter((x) => x.decide).map((x) => x.e.demoNote).filter(Boolean)
      // 大批次(如 C14 打磨 14 决策)demoNote 全拼会变成一堵墙;超长就截首条 + 计数,详情去决策卡看
      let demoLine = demoNotes.join(' · ')
      if (demoLine.length > 150) demoLine = demoNotes[0].slice(0, 128).replace(/\s+$/, '') + ` … 等 ${demoNotes.length} 条(点上方决策卡看)`
      return `
    <div class="tlband tl-${st}" id="path-${esc(it.id)}">
      <div class="tl-rail"><span class="tl-dot" style="--c:${STATUS_COLOR[st]}">${esc(it.id)}</span></div>
      <div class="tl-main">
        <div class="tl-head">
          <b>${esc(it.title)}</b>
          ${task ? `<a class="tl-task" href="#${esc(task.id)}" title="看进度看板任务卡">${esc(task.title)}</a>` : ''}
          <span class="tl-st" style="--c:${STATUS_COLOR[st]}">${esc(m.statuses[st] || st)}</span>
        </div>
        ${decChips ? `<div class="tl-lane"><span class="tl-lbl">决策</span><span class="tl-chips">${decChips}</span></div>` : `<div class="tl-lane"><span class="tl-lbl">迭代</span><span class="tl-implnote">实现前序决策,无新决策落定</span></div>`}
        ${secChips ? `<div class="tl-lane"><span class="tl-lbl">设计</span><span class="tl-chips">${secChips}</span></div>` : ''}
        ${demoNotes.length ? `<div class="tl-lane"><span class="tl-lbl">demo</span><span class="tl-demonote">${esc(demoLine)}</span></div>` : ''}
      </div>
    </div>`
    })
    .join('')
  const timeline = `
  <div class="secband first"><h2><span class="sec-line line-C">C</span> 落地路径 <span class="sub">由新到旧(最新一步在最上):每步落定哪条决策(点 D 码跳决策卡)、写进设计哪一节、源自 demo 哪个功能</span></h2></div>
  <div class="timeline">${bands}</div>`

  // 由脊柱(A→B→C 全景)到细节:C 落地路径(当下)→ C 拍板项 → C demo 探索 → A 对比 demo → 为什么这么设计(起点)
  return `
  <div class="topbar">
    <h1>决策路径</h1>
    <span class="sess">A 委托单(ADR · 对比 demo)→ B 台账(直接拍板)→ C 提单模型(demo 成熟):demo-驱动决策自 A 线起步,到 C 线成熟</span>
    <span class="cnote">A / B / C 三线全叙事 · 不随线路筛选收敛,当前线高亮</span>
    <span class="branch">branch: ${esc(dm.instance.branch)}</span>
  </div>
  ${epochSpine}
  ${timeline}
  ${pinboard}
  ${demoJourney}
  ${aDemoRail}
  ${originBlock}
  <p class="stamp">由 <code>gen.mjs</code> 生成自 <code>path-manifest.json</code>(三纪元叙事)+ <code>decisions-manifest.json</code>(D/AD 码)。A 线对比 demo 存本板 <code>demos/</code>,C 线 demo 链 <code>:8890</code>;§ 链接跳 <code>refs/design-c.html</code>,D/TC/AD 链接跨 tab 定位卡片。</p>`
}
const pathPane = buildPathPane()

// ============================================================================
//  文档库 Hub(D46 方案B):地基→流程→操作→存档 四段卡片墙 + 阅读顺序 stepper + 已读进度
//  v0.2 起从顶部 <details> 平铺条升级为独立 tab;卡片 = 标题 + 一句话(desc)+ 类别色带 + 线别徽标 + hover 更新时间
// ============================================================================
const DOC_ORDERED = REF_DOCS.filter((d) => d.order != null).sort((a, b) => a.order - b.order)
const docLineBadges = (d) =>
  String(docLine(d) || '').split(' ').filter(Boolean).map((l) => `<span class="dlb dlb-${esc(l)}">${esc(l)}</span>`).join('')
const docCard = (d) => {
  const seg = DOC_SEGMENTS.find((s) => s.key === d.seg)
  const badges = LANES_ON ? docLineBadges(d) : ''
  return `
      <a class="doccard lcard" href="refs/${esc(d.out)}" data-doc="${esc(d.out)}" data-line="${docLine(d)}"${d.order != null ? ` data-order="${d.order}"` : ''} data-updated="${esc(d.updated)}" style="--c:${seg.color}">
        <div class="dchead">${d.order != null ? `<span class="obadge">${d.order}</span>` : ''}<h3>${esc(d.title)}</h3>${badges ? `<span class="dbadges">${badges}</span>` : ''}</div>
        ${d.desc ? `<p class="doneline">${esc(d.desc)}</p>` : ''}
        <div class="dmeta"><span class="dcat">${esc(d.cat)}</span><span class="dupdated"></span></div>
      </a>`
}
const docsPane = (() => {
  if (!REF_DOCS.length) return `
  <div class="topbar"><h1>${esc(BRAND)} · 文档库</h1></div>
  <p class="pane-empty" style="display:block">config.docs 暂无文档 —— 在 kanban.config.json 的 docs[] 登记后重跑 gen。</p>
  <p class="stamp">由 <code>gen.mjs</code> 生成自 <code>kanban.config.json</code> docs[]。</p>`
  const stepper = `
  <div class="hstepper" id="docstepper">${DOC_SEGMENTS.map((s, i) => {
    return `${i ? '<span class="harrow">→</span>' : ''}<a class="hstep${s.muted ? ' muted' : ''}" href="#dseg-${s.key}" data-seg="${s.key}">${s.muted ? '' : `<span class="hno" style="background:${s.color}">${i + 1}</span>`}<span class="hname">${esc(s.name)}</span><span class="htyp">${esc(s.typ)}</span></a>`
  }).join('')}${DOC_ORDERED.length ? `<span class="hprog" id="docprog"></span>` : ''}</div>`
  const chips = !LANES_ON ? '' : `
  <div class="dchips" id="docchips">
    <button type="button" class="dchip on" data-line="all">全部<span class="n">${REF_DOCS.length}</span></button>
    ${LANE_IDS.map((l) => `<button type="button" class="dchip" data-line="${l}" title="${esc(LANE.lineTitles[l] || l)}">${l} 线<span class="n">${REF_DOCS.filter((d) => docLine(d).split(' ').includes(l)).length}</span></button>`).join('')}
  </div>`
  const segs = DOC_SEGMENTS.map((s, i) => {
    const docs = REF_DOCS.filter((d) => d.seg === s.key)
      .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0)) // 段内按更新时间倒序:最近先读
    return `
  <section class="dseg${s.muted ? ' arc' : ''}" id="dseg-${s.key}" data-seg="${s.key}">
    <div class="dseghead">${s.muted ? '' : `<span class="dsn" style="background:${s.color}">${i + 1}</span>`}<h2>${esc(s.name)}</h2><span class="dstag">${esc(s.typ)}</span><span class="dscnt" data-seg-cnt="${s.key}">${docs.length} 篇</span><span class="dsdesc">${esc(s.desc)}</span></div>
    <div class="dgrid2">${docs.map(docCard).join('')}<div class="dsegempty" data-seg-empty="${s.key}" style="display:none"></div></div>
  </section>`
  }).join('')
  return `
  <div class="topbar">
    <h1>${esc(BRAND)} · 文档库</h1>
    <span class="sess">${REF_DOCS.length} 篇按 地基 → 流程 → 操作 → 存档 四段归组 · 段内按更新时间倒序 · 悬停卡片看更新时间</span>
  </div>
  <div class="docsnav">${stepper}${chips}</div>
  <div class="docstatus" id="docstatus"></div>
  ${segs}
  <p class="stamp">由 <code>gen.mjs</code> 生成自 <code>kanban.config.json</code> docs[](category→四段映射见 <code>docSegments</code>;更新时间取 <code>git log</code>)。</p>`
})()

// ============================================================================
//  组装 index.html
// ============================================================================
const html = `<!doctype html>
<html lang="${HTML_LANG}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(BRAND)} 决策看板</title>
<style>
  /* 令牌对齐 app/demo:暖纸底 + ink 阶梯 + Notion 蓝 accent + teal 品牌/成功色(见 index.css) */
  :root { --ink:#37352f; --mut:#6f6e6b; --faint:#8a8884; --line:#ededec; --line-strong:#e3e2e0;
          --bg:#f6f5f2; --card:#fff; --side:#f7f7f5;
          --accent:#2383e2; --accent-deep:#1a6fc4; --accent-soft:#e7f3f8;
          --brand:#0f7b6c; --brand-soft:#eaf5f1; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
               "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
         -webkit-font-smoothing: antialiased; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  a { color: inherit; }
  .wrap { max-width: 1060px; margin: 0 auto; padding: 20px 20px 80px; }

  .tabbar { display: flex; gap: 8px; border-bottom: 1px solid var(--line); margin-bottom: 14px; }
  .tab { appearance: none; border: 0; background: none; cursor: pointer; font: inherit;
         padding: 9px 16px; margin-bottom: -1px; color: var(--mut); font-weight: 600;
         border-bottom: 2px solid transparent; }
  .tab:hover { color: var(--ink); }
  .tab-active { color: var(--accent); border-bottom-color: var(--accent); }
  /* 链接型 tab(出站到 shots.html):形制同 tab,右端对齐,尾缀 ↗ 标出站 */
  a.tab-shots { text-decoration: none; margin-left: auto; color: var(--mut); }
  a.tab-shots:hover { color: var(--ink); }
  .pane { display: none; }
  .pane-active { display: block; }

  /* ———— 线路筛选(A/B/C 纪元)———— */
  /* 全局吸顶导航:工作区身份 + 线路切换(线路是全局作用域,不属于任何单个 tab) */
  .hubbar { position: sticky; top: 0; z-index: 60; background: var(--bg); border-bottom: 1px solid var(--line-strong); }
  .hubbar-in { max-width: 1060px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 9px 20px; }
  .hubbrand { font-size: 11.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--brand); }
  .hubsp { flex: 1; }
  .linehints { margin: 0; }
  .wrap:not([data-line="all"]) .linehints { margin: 0 0 12px; }
  .lf-lbl { font-size: 12px; color: var(--faint); margin-right: 2px; }
  .lf { appearance: none; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 600;
        color: var(--mut); background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 3px 12px; }
  .lf:hover { color: var(--ink); border-color: var(--line-strong); }
  .lf-active { color: var(--accent-deep); background: var(--accent-soft);
               border-color: color-mix(in srgb, var(--accent) 40%, #fff); }
  .tf-active { color: var(--accent-deep); background: var(--accent-soft);
               border-color: color-mix(in srgb, var(--accent) 40%, #fff); }
  /* 时间筛选(决策/Backlog 卡):不在窗口内(或无日期)的卡隐藏 */
  .lcard.tf-hide { display: none !important; }
  .cdate { margin-left: auto; font-size: 10.5px; color: var(--faint); flex: none; }
  .hublink { font-size: 12.5px; font-weight: 600; color: var(--mut); text-decoration: none; margin-left: 12px; }
  .hublink:hover { color: var(--ink); }
  .lf-hint { display: none; font-size: 12px; color: var(--mut); margin-left: 6px; max-width: 66ch; }
  .wrap[data-line="C"] .lf-hint[data-line-note="C"],
  .wrap[data-line="B"] .lf-hint[data-line-note="B"],
  .wrap[data-line="A"] .lf-hint[data-line-note="A"] { display: inline; }
  /* 卡片按线路过滤(lcard 携 data-line;~= 让「B A」同时命中 B 与 A 视图) */
  .wrap[data-line="C"] .lcard:not([data-line~="C"]),
  .wrap[data-line="B"] .lcard:not([data-line~="B"]),
  .wrap[data-line="A"] .lcard:not([data-line~="A"]) { display: none; }
  /* 该线路下无卡的组整组隐藏(:has) */
  .wrap[data-line="C"] .group:not(:has(.lcard[data-line~="C"])),
  .wrap[data-line="B"] .group:not(:has(.lcard[data-line~="B"])),
  .wrap[data-line="A"] .group:not(:has(.lcard[data-line~="A"])) { display: none; }
  /* 文档库卡片是 .lcard,线路过滤走上面的通用规则 */
  /* 路线图节点随线路收敛(pnode/plink 携 data-line,与 lcard 同款过滤);进度条/汇总计数不再隐藏,由 setLine 按线路重算 */
  .wrap[data-line="C"] .pnode:not([data-line~="C"]), .wrap[data-line="C"] .plink:not([data-line~="C"]),
  .wrap[data-line="B"] .pnode:not([data-line~="B"]), .wrap[data-line="B"] .plink:not([data-line~="B"]),
  .wrap[data-line="A"] .pnode:not([data-line~="A"]), .wrap[data-line="A"] .plink:not([data-line~="A"]) { display: none; }
  /* 该线路下路线图一个节点都不剩:整块收起,不留空壳 */
  .wrap[data-line="C"] .pathmap:not(:has(.pnode[data-line~="C"])),
  .wrap[data-line="B"] .pathmap:not(:has(.pnode[data-line~="B"])),
  .wrap[data-line="A"] .pathmap:not(:has(.pnode[data-line~="A"])) { display: none; }
  /* 决策路径是 C 线专属叙事:筛选激活时挂一枚说明,免得被读成所选线路的路径 */
  .topbar .cnote { display: none; font-size: 12px; color: var(--mut);
                   border: 1px dashed var(--line-strong); border-radius: 999px; padding: 2px 10px; }
  .wrap:not([data-line="all"]) .cnote { display: inline-block; }
  /* 某线路把 pane 筛空时的占位(setLine 按可见卡数切换),避免空壳像坏页 */
  .pane-empty { display: none; margin: 22px 0; padding: 24px; text-align: center; font-size: 13px;
                color: var(--faint); border: 1px dashed var(--line-strong); border-radius: 12px; }

  /* ———— 工具条(D46 方案A,决策/Backlog 共用):状态 chips 静止无灰盒/hover 浮底/选中软底 ———— */
  /* 有意的两行:第 1 行状态 chips 独占,第 2 行线别/下拉/搜索;极窄时第 2 行自然换行 */
  .dectb { padding: 12px 0 4px; max-width: 100%; }
  .tbrow { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; }
  .tbrow + .tbrow { margin-top: 8px; }
  .dectb .tgroup { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .dectb .tlab { font-size: 11px; color: var(--faint); margin-right: 2px; letter-spacing: .02em; }
  .stchips { gap: 2px; }
  .stchip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 6px; cursor: pointer;
            border: 1px solid transparent; background: transparent; font: inherit; font-size: 12.5px; color: var(--ink);
            transition: background .12s ease; }
  .stchip .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--c); flex: none; transition: box-shadow .12s ease; }
  .stchip .cn { color: var(--faint); font-variant-numeric: tabular-nums; font-size: 11.5px; }
  .stchip:hover { background: #efeeeb; }
  .stchip.on { background: color-mix(in srgb, var(--c) 12%, #fff); color: var(--c); font-weight: 600; }
  .stchip.on .cn { color: var(--c); opacity: .8; }
  .stchip.on .dot { box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 18%, #fff); }
  .lseg { display: inline-flex; background: #eceae6; border-radius: 7px; padding: 2px; }
  .lseg button { border: 0; background: transparent; font: inherit; font-size: 12.5px; color: var(--mut);
                 padding: 3px 12px; border-radius: 5px; cursor: pointer; line-height: 1.4; }
  .lseg button:hover { color: var(--ink); }
  .lseg button.on { background: #fff; color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgba(40,38,34,.08); }
  .dectb select { font: inherit; font-size: 12.5px; color: var(--ink); background: var(--card); border: 1px solid var(--line-strong);
    border-radius: 6px; padding: 5px 26px 5px 10px; cursor: pointer; appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236f6e6b' stroke-width='1.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
    background-repeat: no-repeat; background-position: right 9px center; }
  .dectb select:hover { border-color: #cfcecb; }
  .dectb select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  /* 搜索框:第 2 行右侧弹性伸缩,上限 320 看着是刻意布局;min(…,100%) 兜底窄容器不越界;无 :focus 宽度跳变 */
  .tsearch { margin-left: auto; position: relative; display: flex; align-items: center;
    flex: 1 1 150px; min-width: 140px; max-width: min(320px, 100%); }
  .tsearch svg { position: absolute; left: 9px; pointer-events: none; }
  .tsearch input { font: inherit; font-size: 12.5px; color: var(--ink); background: var(--card); border: 1px solid var(--line-strong);
    border-radius: 6px; padding: 6px 26px 6px 28px; width: 100%; transition: border-color .12s; }
  .tsearch input::placeholder { color: var(--faint); }
  .tsearch input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .tsearch .tclear { position: absolute; right: 7px; border: 0; background: transparent; color: var(--faint); cursor: pointer;
    font-size: 15px; line-height: 1; padding: 2px; display: none; }
  .tsearch .tclear:hover { color: var(--ink); }
  /* 行内清除钮(第 2 行末尾,任一筛选生效时才出现;控件自身即状态显示,不另设摘要行)+ meta 行(陈述事实) */
  .clearall { border: 0; background: transparent; color: var(--accent); cursor: pointer; font: inherit;
    font-size: 12px; font-weight: 600; padding: 3px 4px; border-radius: 5px; flex: none; }
  .clearall:hover { background: var(--accent-soft); }
  .decmeta { font-size: 12px; color: var(--mut); margin: 8px 0 14px; font-variant-numeric: tabular-nums; }
  .decmeta b { color: var(--ink); font-weight: 600; }
  .flt-hide { display: none !important; }
  .dec-empty { margin: 22px 0; padding: 40px 20px; text-align: center; font-size: 13px; color: var(--mut);
    border: 1px dashed var(--line-strong); border-radius: 12px; }
  .dec-empty p { margin: 0 0 8px; }
  .dec-empty button { border: 0; background: transparent; color: var(--accent); cursor: pointer; font: inherit;
    font-size: 12.5px; font-weight: 600; padding: 4px 8px; border-radius: 6px; }
  .dec-empty button:hover { background: var(--accent-soft); }

  /* ———— 文档库 Hub(D46 方案B):四段卡片墙 + 阅读顺序 stepper + 已读进度 ———— */
  /* 导航切片吸顶(BL-C43):stepper+chips 冻在 hubbar 之下,滚到中下部仍能看当前段/跳段/切线;
     top 不写死 —— hubbar flex-wrap 换行高度可变,JS 量高写 --hubh;背景不透明防卡片叠影;z 低于 hubbar(60)高于卡片 */
  .docsnav { position: sticky; top: var(--hubh, 41px); z-index: 50; background: var(--bg);
    padding: 2px 0 8px; border-bottom: 1px solid var(--line); margin: 14px 0 10px; }
  .hstepper { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0 0 2px; }
  .hstep { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line-strong); background: var(--card);
    border-radius: 9px; padding: 6px 13px 6px 8px; cursor: pointer; font-size: 12.5px; color: var(--ink); text-decoration: none;
    transition: border-color .14s, box-shadow .14s; white-space: nowrap; }
  .hstep:hover { border-color: var(--accent); }
  .hstep.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .hstep .hno { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%;
    color: #fff; font-size: 11.5px; font-weight: 700; flex-shrink: 0; }
  .hstep .hname { font-weight: 600; }
  .hstep .htyp { color: var(--faint); font-size: 11.5px; }
  .hstep.muted { color: var(--mut); background: transparent; border-style: dashed; padding-left: 13px; }
  .harrow { color: var(--faint); font-size: 13px; user-select: none; }
  .hprog { margin-left: auto; font-size: 12px; color: var(--mut); font-variant-numeric: tabular-nums; }
  .hprog b { color: var(--brand); font-weight: 600; }
  .dchips { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0 0; }
  .dchip { border: 1px solid var(--line-strong); background: var(--card); border-radius: 999px; padding: 4px 13px;
    font: inherit; font-size: 12.5px; cursor: pointer; color: var(--mut); transition: .14s; }
  .dchip:hover { border-color: var(--accent); }
  .dchip .n { color: var(--faint); font-size: 11px; margin-left: 5px; font-variant-numeric: tabular-nums; }
  .dchip.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-deep); font-weight: 600; }
  .dchip.on .n { color: var(--accent-deep); }
  .docstatus { font-size: 12.5px; color: var(--faint); margin: 9px 2px 2px; font-variant-numeric: tabular-nums; }
  .docstatus b { color: var(--mut); font-weight: 600; }
  .dseg { margin-top: 26px; }
  /* 锚点补偿 = hubbar + docsnav 实高(JS 量高写变量)+ 12px 呼吸;.dseg[id] 提特异度,防后面的 [id] 通配盖掉 */
  .dseg[id] { scroll-margin-top: calc(var(--hubh, 41px) + var(--dnavh, 0px) + 12px); }
  .dseghead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 0 0 11px; padding-bottom: 7px; border-bottom: 1px solid var(--line-strong); }
  .dseghead .dsn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%;
    color: #fff; font-size: 11.5px; font-weight: 700; align-self: center; }
  .dseghead h2 { font-size: 15px; margin: 0; }
  .dseghead .dstag { font-size: 12px; color: var(--faint); }
  .dseghead .dscnt { font-size: 11.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
  .dseghead .dsdesc { font-size: 12px; color: var(--mut); margin-left: auto; text-align: right; }
  .dseg.arc .dseghead { opacity: .86; }
  .dgrid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(258px, 1fr)); gap: 12px; }
  .doccard { position: relative; background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--c);
    border-radius: 12px; padding: 12px 14px 11px; text-decoration: none; color: inherit; display: flex; flex-direction: column;
    box-shadow: 0 1px 2px rgba(40,38,34,.04); transition: transform .14s ease, box-shadow .14s ease; }
  .doccard:hover { transform: translateY(-2px); box-shadow: 0 2px 5px rgba(40,38,34,.06), 0 10px 24px rgba(40,38,34,.09); }
  .dchead { display: flex; gap: 8px; align-items: flex-start; }
  .doccard h3 { font-size: 13.5px; margin: 0 0 5px; line-height: 1.42; font-weight: 600; flex: 1; }
  .doneline { font-size: 12px; color: var(--mut); line-height: 1.55; margin: 0; flex: 1; }
  .dbadges { display: flex; gap: 4px; flex-shrink: 0; margin-top: 1px; }
  .dlb { font-size: 10.5px; font-weight: 700; min-width: 17px; height: 17px; line-height: 15px; text-align: center;
    border-radius: 5px; padding: 0 2px; border: 1px solid var(--line-strong); color: var(--mut); background: var(--side); }
  .dlb-A { color: var(--accent-deep); background: #eaf1fa; border-color: #cfe0f4; }
  .dlb-B { color: var(--brand); background: var(--brand-soft); border-color: #c9e6dd; }
  .dlb-C { color: #9a6410; background: #fbf3e4; border-color: #eddcc0; }
  .obadge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 999px;
    flex: none; font-size: 10.5px; font-weight: 700; color: var(--accent); border: 1.4px solid var(--accent); background: #fff;
    font-variant-numeric: tabular-nums; margin-top: 1px; }
  .obadge.done { color: #fff; background: var(--brand); border-color: var(--brand); }
  .dmeta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; min-height: 15px; }
  .dcat { font-size: 11px; color: var(--faint); }
  .dupdated { font-size: 11px; color: var(--faint); opacity: 0; transition: opacity .14s; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .doccard:hover .dupdated { opacity: 1; }
  .dsegempty { font-size: 12.5px; color: var(--faint); padding: 8px 2px; }

  .topbar { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; }
  .topbar h1 { margin: 0; font-size: 25px; font-weight: 700; letter-spacing: -.01em; }
  .topbar .sess { color: var(--mut); font-size: 13px; }
  .topbar .branch { margin-left: auto; font-size: 12px; color: var(--mut);
    border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; background: var(--card); }
  .topbar .plan { font-size: 13px; color: var(--accent); text-decoration: none; }
  .topbar .plan:hover { text-decoration: underline; }

  .progress { margin: 18px 0 6px; display: flex; align-items: center; gap: 12px; }
  .pbar { flex: 1; height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
  .pbar i { display: block; height: 100%; background: var(--brand); border-radius: 999px; transition: width .3s; }
  .ptext { font-size: 13px; color: var(--mut); white-space: nowrap; }

  .pathmap { display: flex; align-items: stretch; flex-wrap: wrap; gap: 0; margin: 14px 0 30px;
             padding: 14px 12px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
  .pnode { display: flex; flex-direction: column; align-items: center; gap: 3px; text-decoration: none;
           padding: 4px 10px; border-radius: 10px; min-width: 86px; }
  .pnode:hover { background: var(--bg); }
  .pdot { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
          font-size: 12px; font-weight: 700; color: #fff; background: var(--c); }
  .pnode-planned .pdot { background: #fff; color: var(--mut); border: 2px solid var(--c); }
  .ptitle { font-size: 12.5px; font-weight: 600; }
  .pcount { font-size: 11px; color: var(--mut); }
  .plink { flex: 0 0 18px; align-self: center; height: 2px; background: var(--line); margin-top: -18px; }

  .group { margin-bottom: 26px; }
  .ghead { display: flex; align-items: baseline; gap: 10px; padding: 6px 2px; border-bottom: 2px solid var(--c); }
  .gid { font-size: 12px; font-weight: 700; color: #fff; background: var(--c); border-radius: 6px; padding: 1px 7px; }
  .ghead h2 { margin: 0; font-size: 17px; }
  .gdetail { color: var(--mut); font-size: 13px; }
  .gprog { margin-left: auto; font-size: 12.5px; color: var(--mut); }

  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; margin-top: 12px; }
  .card, .blcard { background: var(--card); border: 1px solid var(--line); border-radius: 12px;
          padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
  .card-active { border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
                 box-shadow: 0 1px 8px color-mix(in srgb, var(--accent) 12%, transparent); }
  .card-done { opacity: .92; }
  .blcard { border-left: 3px solid var(--c); }
  .card header, .blcard header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .tid { font-size: 11px; font-weight: 700; color: var(--mut); border: 1px solid var(--line); border-radius: 6px; padding: 0 6px; }
  .badge { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 1px 9px;
           color: color-mix(in srgb, var(--c) 62%, #2b2723);
           background: color-mix(in srgb, var(--c) 13%, #fff);
           border: 1px solid color-mix(in srgb, var(--c) 26%, #fff); }
  .card h3, .blcard h3 { margin: 0; font-size: 15px; flex-basis: 100%; }
  .card dl, .blcard dl { margin: 0; font-size: 13.5px; }
  .card dt, .blcard dt { float: left; clear: left; width: 34px; color: var(--mut); font-weight: 600; }
  .card dd, .blcard dd { margin: 0 0 6px 44px; color: #44403c; }

  .blbadges { display: flex; flex-wrap: wrap; gap: 5px 6px; }
  .bbadge { font-size: 11px; font-weight: 600; border-radius: 6px; padding: 1px 7px;
            color: color-mix(in srgb, var(--c) 60%, #2b2723);
            background: color-mix(in srgb, var(--c) 13%, #fff);
            border: 1px solid color-mix(in srgb, var(--c) 26%, #fff); }
  .bbadge.area { color: var(--ink); background: var(--bg); border: 1px solid var(--line); }
  .bbadge.src { color: var(--mut); background: var(--bg); border: 1px solid var(--line); font-weight: 500; }
  .blockedon { margin: 0; font-size: 12.5px; font-weight: 600; color: #b45309;
               background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 4px 9px; }

  .row { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12.5px; }
  .commit { text-decoration: none; color: var(--mut); }
  .commit:hover { color: var(--ink); }
  .commit code { background: var(--bg); border: 1px solid var(--line); border-radius: 5px; padding: 0 5px; }
  .links a { color: var(--accent); text-decoration: none; }
  .links a:hover { text-decoration: underline; }
  .notes { margin: 0; font-size: 12.5px; color: var(--mut); border-top: 1px dashed var(--line); padding-top: 8px; }

  /* 走查留痕:讨论期测试证据(截图 kanban/shots/),缩略图点开原图 */
  .wtwrap { border-top: 1px dashed var(--line); padding-top: 8px; display: grid; gap: 10px; }
  .wthead { font-size: 12px; color: var(--mut); margin-bottom: 5px; }
  .wtdate { display: inline-block; background: var(--bg); border: 1px solid var(--line); border-radius: 5px;
            padding: 0 5px; margin-right: 6px; font-size: 11px; }
  .wtnote { display: block; margin-top: 2px; }
  .wtshots { display: flex; flex-wrap: wrap; gap: 8px; }
  .wtshots a { display: block; width: 138px; text-decoration: none; color: var(--mut); }
  .wtshots img { width: 100%; height: 86px; object-fit: cover; object-position: top;
                 border: 1px solid var(--line); border-radius: 6px; background: var(--bg); }
  .wtshots a:hover img { border-color: var(--accent); }
  .wtshots span { display: block; font-size: 11px; line-height: 1.35; margin-top: 3px; }

  .legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 34px; padding-top: 14px;
            border-top: 1px solid var(--line); font-size: 12.5px; color: var(--mut); }
  .lg { display: inline-flex; align-items: center; gap: 6px; }
  .lg i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .lg.sep { width: 1px; height: 14px; background: var(--line); padding: 0; }

  .deccard { background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--c);
             border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
  .deccard header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .deccard h3 { margin: 0; font-size: 15px; flex-basis: 100%; }
  .deccard dl { margin: 0; font-size: 13.5px; }
  .deccard dt { float: left; clear: left; width: 34px; color: var(--mut); font-weight: 600; }
  .deccard dd { margin: 0 0 6px 44px; color: #44403c; }
  /* 长文折叠(信息密度):默认收 2 行(3.3em 容住两整行),点击展开;渐隐只压裁切缘 */
  .lcard .clamp { position: relative; max-height: 3.3em; overflow: hidden; cursor: pointer; }
  .lcard .clamp:not(.open)::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0;
    height: .9em; background: linear-gradient(rgba(255,255,255,0), var(--card) 92%); pointer-events: none; }
  .lcard .clamp:not(.open)::before { content: "展开 ▾"; position: absolute; right: 0; bottom: 0; z-index: 1;
    background: var(--card); color: var(--accent); font-size: 11px; line-height: 1.5; padding-left: 8px; }
  .lcard .clamp.open { max-height: none; }
  .lcard .clamp.open::before { content: none; }
  .lcard .clamp.open::after { content: " 收起 ▴"; position: static; display: inline; height: auto;
    background: none; color: var(--accent); font-size: 11px; }
  .deccard dd.decided { color: #047857; }
  /* closed(不做/归档):整卡灰化沉底,hover 恢复可读——终态卡不与待办抢注意力 */
  .deccard.dec-closed { opacity: .58; transition: opacity .15s; }
  .deccard.dec-closed:hover { opacity: 1; }
  .deccard.dec-closed h3 { font-weight: 500; color: #78716c; }
  .deccard.dec-closed dd.decided { color: #78716c; }
  .deccard dd.pending { margin-left: 0; color: #b45309; font-weight: 600; }
  /* .links a.demolink 提高特异性:否则 .links a{color:var(--accent)} 把白字压成蓝字(蓝底蓝字隐形) */
  .links a.demolink { color: #fff; background: var(--accent); border-radius: 7px; padding: 3px 11px;
              font-weight: 600; text-decoration: none; }
  .links a.demolink:hover { background: var(--accent-deep); }

  /* ---- decCard 路径元数据(设计§ / 迭代 / 修订) ---- */
  .deccard dd.demonote { color: #6b5d3e; }
  .pathmeta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 6px; font-size: 12px;
              border-top: 1px dashed var(--line); padding-top: 8px; }
  .pm-lbl { color: var(--mut); font-weight: 600; }
  .pm-lbl:not(:first-child) { margin-left: 8px; }
  .secchip, .iterchip, .refchip { text-decoration: none; border-radius: 6px; padding: 1px 8px; font-weight: 600; }
  .secchip { color: #1f5066; background: #e8f0f4; }
  .secchip:hover { background: #d7e6ee; }
  .iterchip { color: var(--mut); background: var(--bg); border: 1px solid var(--line); }
  .iterchip:hover { color: var(--ink); }
  .refchip { color: #7c3aed; background: #f1ebfb; }
  .refchip:hover { background: #e6dbf7; }

  /* ============ 决策路径 pane ============ */
  .secband { display: flex; align-items: baseline; gap: 10px; margin: 34px 0 4px; padding-bottom: 6px;
             border-bottom: 2px solid var(--line); }
  .secband.first { margin-top: 10px; }
  .secband h2 { margin: 0; font-size: 17px; }
  .secband h2 span { font-size: 13px; font-weight: 400; color: var(--mut); margin-left: 8px; }
  .secband-links { margin-left: auto; display: flex; flex-wrap: wrap; gap: 12px; font-size: 12.5px; }
  .secband-links a { color: var(--accent); text-decoration: none; }
  .secband-links a:hover { text-decoration: underline; }

  /* ① 理念转向 */
  .shift { display: grid; grid-template-columns: 1fr 46px 1fr; gap: 10px; margin: 14px 0; }
  .shift-lane { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; background: var(--card); }
  .shift-lane.from { border-left: 3px solid #a8a29e; }
  .shift-lane.to { border-left: 3px solid #0f7b6c; background: #f5fbfa; }
  .shift-tag { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; border-radius: 6px;
               padding: 1px 9px; margin-bottom: 7px; }
  .shift-lane.from .shift-tag { background: #a8a29e; }
  .shift-lane.to .shift-tag { background: #0f7b6c; }
  .shift-lane p { margin: 0; font-size: 13px; color: #44403c; line-height: 1.6; }
  .shift-arrow { display: grid; place-items: center; gap: 2px; color: #0f7b6c; }
  .shift-arrow::before { content: "→"; font-size: 22px; font-weight: 700; }
  .shift-arrow span { font-size: 10.5px; color: var(--mut); }
  .pivot { font-size: 13px; color: #44403c; line-height: 1.6; background: #fbfaf7;
           border: 1px solid var(--line); border-left: 3px solid #d97706; border-radius: 10px; padding: 10px 14px; }
  .pivot-lbl { display: inline-block; font-size: 11px; font-weight: 700; color: #b45309; background: #fffbeb;
               border: 1px solid #fde68a; border-radius: 6px; padding: 0 7px; margin-right: 8px; }
  .principles { margin-top: 12px; border: 1px solid var(--line); border-radius: 12px; padding: 10px 16px; background: var(--card); }
  .pr-lbl { font-size: 12.5px; font-weight: 700; color: #0f7b6c; }
  .principles ul { margin: 8px 0 2px; padding-left: 20px; columns: 2; column-gap: 26px; }
  .principles li { font-size: 12.5px; color: #44403c; line-height: 1.5; margin: 3px 0; break-inside: avoid; }
  @media (max-width: 720px) { .shift { grid-template-columns: 1fr; } .shift-arrow::before { content: "↓"; } .principles ul { columns: 1; } }

  /* ② demo 探索历程 */
  .demorail { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
  .demonode { flex: 1 1 150px; min-width: 138px; display: flex; flex-direction: column; gap: 3px;
              text-decoration: none; border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px;
              background: var(--card); color: var(--ink); }
  .demonode:hover { border-color: var(--accent); }
  .demonode.flag { border-color: #0f7b6c; background: #f5fbfa; box-shadow: 0 1px 6px #0f7b6c20; }
  .dn-id { font-size: 11px; font-weight: 700; color: var(--mut); font-family: ui-monospace, monospace; }
  .demonode.flag .dn-id { color: #0f7b6c; }
  .dn-name { font-size: 14px; font-weight: 700; }
  .dn-bet { font-size: 11.5px; color: #57534e; line-height: 1.45; }
  .dn-role { font-size: 11px; color: var(--mut); margin-top: 2px; }
  .railnote { font-size: 12px; color: var(--mut); margin: 6px 0 0; }
  .roundhdr { margin: 20px 0 8px; font-size: 13.5px; font-weight: 700; color: #44403c; }
  .rounds { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px 0; }
  .roundnode { flex: 1 1 150px; min-width: 148px; border: 1px solid var(--line); border-radius: 10px;
               padding: 8px 10px; background: var(--card); display: flex; gap: 8px; }
  .rn-n { font-size: 12px; font-weight: 700; color: #fff; background: #0f7b6c; border-radius: 6px;
          padding: 1px 6px; height: fit-content; white-space: nowrap; }
  .rn-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .rn-body b { font-size: 12.5px; }
  .rn-body span { font-size: 11px; color: var(--mut); line-height: 1.4; }
  .rn-link { flex: 0 0 10px; align-self: center; height: 2px; background: var(--line); }

  /* ③ 拍板项 → D 码 */
  .pins { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; margin: 12px 0; }
  .pin { border: 1px solid var(--line); border-left: 3px solid #d97706; border-radius: 12px;
         padding: 12px 14px; background: var(--card); display: flex; flex-direction: column; gap: 7px; }
  .pin header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .pin-id { font-size: 11px; font-weight: 700; color: #b45309; background: #fffbeb;
            border: 1px solid #fde68a; border-radius: 6px; padding: 0 7px; }
  .pin header b { font-size: 14.5px; }
  .pin-arrow { margin-left: auto; font-size: 12px; font-weight: 700; color: #0f7b6c; text-decoration: none;
               background: #f0faf8; border: 1px solid #b8e2da; border-radius: 999px; padding: 2px 10px; }
  .pin-arrow:hover { background: #e0f3ee; }
  .pin-row { display: grid; grid-template-columns: 72px 1fr; gap: 8px; font-size: 12.5px; color: #44403c; line-height: 1.5; }
  .pin-lbl { font-weight: 600; color: var(--mut); }
  .pin-lbl.land { color: #0f7b6c; }

  /* ④ C1→C10 时间线泳道 */
  .timeline { margin: 14px 0 0; }
  .tlband { display: grid; grid-template-columns: 52px 1fr; gap: 6px; }
  .tl-rail { display: flex; justify-content: center; position: relative; }
  .tl-rail::before { content: ""; position: absolute; top: 12px; bottom: -6px; left: 50%; width: 2px;
                     margin-left: -1px; background: var(--line); z-index: 0; }
  .tlband:last-child .tl-rail::before { display: none; }
  .tl-dot { position: relative; z-index: 1; width: 36px; height: 24px; border-radius: 8px; display: grid;
            place-items: center; font-size: 11px; font-weight: 700; color: #fff; background: var(--c); margin-top: 6px; }
  .tl-main { padding: 4px 0 18px; min-width: 0; }
  .tl-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .tl-head b { font-size: 14.5px; }
  .tl-task { font-size: 12px; color: var(--accent); text-decoration: none; }
  .tl-task:hover { text-decoration: underline; }
  .tl-st { font-size: 11px; font-weight: 600; color: #fff; background: var(--c); border-radius: 999px; padding: 1px 8px; }
  .tl-lane { display: flex; align-items: flex-start; gap: 8px; margin-top: 6px; font-size: 12.5px; }
  .tl-lbl { flex: 0 0 34px; color: var(--mut); font-weight: 600; padding-top: 2px; }
  .tl-chips { display: flex; flex-wrap: wrap; gap: 5px 6px; min-width: 0; }
  .tl-dec { text-decoration: none; border-radius: 7px; padding: 2px 9px; font-weight: 600; font-size: 12px; }
  .tl-dec.decide { color: #065f46; background: #d1f0e6; border: 1px solid #a7ddca; }
  .tl-dec.land { color: var(--mut); background: var(--bg); border: 1px dashed var(--line); }
  /* D 码 chip 是跨 tab 链接(#Dxx → 决策卡定位+闪烁),hover 给明确的「可点」信号 */
  .tl-dec:hover { border-color: var(--accent); border-style: solid; color: var(--accent-deep); background: var(--accent-soft); }
  .tl-sec { text-decoration: none; color: #1f5066; background: #e8f0f4; border-radius: 7px; padding: 2px 9px;
            font-weight: 600; font-size: 12px; }
  .tl-sec:hover { background: #d7e6ee; }
  .tl-demonote { color: #6b5d3e; line-height: 1.5; }
  .tl-implnote { color: var(--mut); font-style: italic; }

  [id] { scroll-margin-top: 58px; } /* 锚点跳转别钻到吸顶栏底下 */
  .flash-target { animation: flashpulse 1.6s ease; border-radius: 12px; }
  @keyframes flashpulse { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 18% { box-shadow: 0 0 0 3px #0f7b6c66; } }

  .stamp { margin-top: 10px; font-size: 12px; color: var(--mut); }

  /* ============ 统一行卡(rcard):collapsed 单行等高,点 .rhead 展开 —— 杀「忽大忽小」 ============ */
  .cards { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .lcard.rcard { padding: 0; gap: 0; display: block; border: 1px solid var(--line);
                 border-left: 3px solid var(--c); border-radius: 10px; background: var(--card);
                 overflow: hidden; transition: border-color .12s, box-shadow .12s; }
  .lcard.rcard:hover { border-color: color-mix(in srgb, var(--c) 40%, var(--line));
                       box-shadow: 0 1px 6px color-mix(in srgb, var(--c) 12%, transparent); }
  .rhead { display: flex; align-items: center; gap: 8px; padding: 7px 12px; cursor: pointer;
           user-select: none; min-height: 38px; }
  .rhead:hover { background: color-mix(in srgb, var(--c) 5%, var(--card)); }
  .rhead .tid { flex: none; }
  .rtitle { flex: 0 1 auto; font-size: 14px; font-weight: 600; color: var(--ink);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .rtags { display: flex; gap: 4px; flex: none; }
  .rtag { font-size: 10.5px; font-weight: 600; border-radius: 5px; padding: 0 6px; line-height: 17px; white-space: nowrap;
          color: color-mix(in srgb, var(--c, #999) 66%, #2b2723);
          background: color-mix(in srgb, var(--c, #999) 12%, #fff);
          border: 1px solid color-mix(in srgb, var(--c, #999) 24%, #fff); }
  .rtag.demo { --c: #2383e2; }
  .rtag.blk { --c: #d97706; }
  .rspacer { flex: 1 1 auto; }
  .rline { flex: none; font-size: 10px; font-weight: 700; letter-spacing: .04em; border-radius: 4px;
           padding: 0 5px; line-height: 16px; color: #fff; }
  .line-A { background: #b5843a; } .line-B { background: #7a8590; } .line-C { background: #0f7b6c; }
  .rhead .cdate { margin-left: 0; }
  .rtoggle { flex: none; color: var(--faint); font-size: 11px; transition: transform .15s; width: 12px; text-align: center; }
  .rcard.open .rtoggle { transform: rotate(180deg); }
  .rbody { display: none; padding: 2px 14px 13px; border-top: 1px solid var(--line); }
  .rcard.open .rbody { display: block; }
  .rcard.open { border-color: color-mix(in srgb, var(--c) 34%, var(--line)); }
  .rbody dl { margin: 8px 0 0; font-size: 13px; }
  .rbody dt { float: left; clear: left; width: 34px; color: var(--mut); font-weight: 600; }
  .rbody dd { margin: 0 0 6px 44px; color: #44403c; }
  .rbody .blbadges { margin-top: 10px; }
  .search-hide { display: none !important; }

  /* ============ 三纪元脊柱(决策路径顶部:A 委托单 → B 台账 → C 提单)============ */
  .epochs { display: grid; gap: 0; margin: 16px 0 24px; }
  .epoch { display: grid; grid-template-columns: 132px 1fr; gap: 14px; position: relative; padding-bottom: 16px; }
  .epoch:not(:last-child)::before { content: ""; position: absolute; left: 21px; top: 28px; bottom: -2px;
                     width: 2px; background: var(--line); }
  .ep-rail { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; padding-top: 2px; position: relative; z-index: 1; }
  .ep-tag { font-size: 12.5px; font-weight: 800; color: #fff; border-radius: 7px; padding: 3px 12px; letter-spacing: .02em; }
  .ep-period { font-size: 11px; color: var(--faint); font-family: ui-monospace, monospace; }
  .ep-body { border: 1px solid var(--line); border-radius: 12px; padding: 12px 15px; background: var(--card);
             transition: border-color .15s, box-shadow .15s; }
  .ep-name { font-size: 15.5px; font-weight: 700; margin-bottom: 6px; }
  .ep-axis, .ep-how { margin: 4px 0; font-size: 12.5px; color: #44403c; line-height: 1.55; }
  .ep-axis b, .ep-how b { display: inline-block; min-width: 4.4em; margin-right: 8px; font-size: 11px;
             font-weight: 700; color: var(--mut); }
  .ep-foot { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 9px; padding-top: 8px;
             border-top: 1px dashed var(--line); font-size: 11.5px; }
  .ep-tally { color: var(--mut); font-family: ui-monospace, monospace; }
  .ep-see { color: var(--accent); }
  .epoch.ep-A { --c-ep: #b5843a; } .epoch.ep-B { --c-ep: #7a8590; } .epoch.ep-C { --c-ep: #0f7b6c; }
  .epoch.ep-A .ep-tag { background: #b5843a; } .epoch.ep-B .ep-tag { background: #7a8590; } .epoch.ep-C .ep-tag { background: #0f7b6c; }
  /* 筛某条线时:该纪元描边高亮(全景始终清晰可读,不淡出其余纪元) */
  .wrap[data-line="A"] .epoch.ep-A .ep-body, .wrap[data-line="B"] .epoch.ep-B .ep-body, .wrap[data-line="C"] .epoch.ep-C .ep-body {
     border-color: color-mix(in srgb, var(--c-ep) 45%, var(--line)); box-shadow: 0 1px 10px color-mix(in srgb, var(--c-ep) 14%, transparent); }
  @media (max-width: 640px) { .epoch { grid-template-columns: 1fr; } .epoch::before { display: none; } }

  /* §标题前的线路字母 chip */
  .secband h2 .sec-line { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 6px;
     color: #fff; font-size: 12px; font-weight: 800; margin-right: 3px; vertical-align: -3px; }
  .sec-line.line-A { background: #b5843a; } .sec-line.line-B { background: #7a8590; } .sec-line.line-C { background: #0f7b6c; }
  .secband h2 .sub { font-size: 13px; font-weight: 400; color: var(--mut); margin-left: 8px; }

  /* A 线 demo rail(卡内含「打开 demo」+「决策卡↗」两段) */
  .demorail.arail .anode { flex: 1 1 158px; min-width: 152px; display: flex; flex-direction: column;
     border: 1px solid var(--line); border-left: 3px solid #b5843a; border-radius: 10px; background: var(--card); overflow: hidden; }
  .anode .dn-main { display: flex; flex-direction: column; gap: 3px; text-decoration: none; color: var(--ink); padding: 9px 11px 8px; }
  .anode:hover { border-color: #b5843a; }
  .anode .dn-jump { font-size: 11px; color: var(--accent); text-decoration: none; padding: 5px 11px;
     border-top: 1px dashed var(--line); background: #fafaf8; }
  .anode .dn-jump:hover { background: #f0f6fb; }

  /* hubbar 搜索框 */
  #hubsearch { appearance: none; font: inherit; font-size: 12.5px; color: var(--ink); background: var(--card);
     border: 1px solid var(--line); border-radius: 999px; padding: 4px 13px; min-width: 156px; }
  #hubsearch:focus { outline: none; border-color: var(--accent); }
  #hubsearch::placeholder { color: var(--faint); }

  /* ============ pathmap 主从:点节点 → 下方面板看该步详情(总览页自足,不必往下翻)============ */
  .pnode { appearance: none; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
  .pnode.pnode-sel { background: var(--bg); }
  .pnode.pnode-sel .pdot { box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 34%, #fff); }
  .pathhint { margin: -20px 0 16px; font-size: 12px; color: var(--faint); }
  .pathpanel { display: none; }
  .pathpanel.active { display: block; animation: ppfade .18s ease; }
  @keyframes ppfade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
  .pp-head { display: flex; align-items: baseline; gap: 10px; padding: 6px 2px; border-bottom: 2px solid var(--c); }
  .pp-head h2 { margin: 0; font-size: 17px; }
  .pp-decs { display: flex; align-items: flex-start; gap: 8px; margin: 12px 0 2px; font-size: 12.5px; }
  .pp-lbl { flex: 0 0 auto; color: var(--mut); font-weight: 600; padding-top: 3px; }
  /* 面板内任务卡常展开(面板本身就是详情视图),去折叠交互 */
  .pathpanel .rcard .rbody { display: block; }
  .pathpanel .rcard .rhead { cursor: default; }
  .pathpanel .rcard .rhead:hover { background: none; }
  .pathpanel .rcard .rtoggle { display: none; }
</style>
<nav class="hubbar">
  <div class="hubbar-in">
    <span class="hubbrand">${LANE.hubbrand}</span>
    <input id="hubsearch" type="search" placeholder="搜索 id / 标题 / 内容…" autocomplete="off" spellcheck="false">
    <button class="lf" id="hubexpand" title="展开 / 收起当前 tab 的全部卡片">展开全部</button>
    <span class="hubsp"></span>
    <button class="lf" id="linepill" style="display:none" title="全局线别筛选生效中(作用于所有 tab)——点击回到全部">线别</button>
    <span class="lf-lbl" style="margin-left:10px">时间</span>
    <button class="tf lf tf-active" data-days="0">全部</button>
    <button class="tf lf" data-days="3">近 3 天</button>
    <button class="tf lf" data-days="7">近 7 天</button>
    <button class="tf lf" data-days="30">近 30 天</button>
  </div>
</nav>
<div class="wrap" data-line="all">${LANE.lineHintsHtml}
  <div class="tabbar">
    <button class="tab tab-active" data-pane="progress">进度看板</button>
    ${pm ? `<button class="tab" data-pane="path">决策路径</button>` : ''}
    <button class="tab" data-pane="decisions" data-label="决策/Demo">决策/Demo · ${decCount}</button>
    <button class="tab" data-pane="backlog" data-label="Backlog">Backlog · ${blCount}</button>
    <button class="tab" data-pane="docs" data-label="文档库">文档库 · ${REF_DOCS.length}</button>
    <a class="tab tab-shots" href="shots.html" title="验证截图存档(随 PR 入库)">截图 · ${SHOT_COUNT} ↗</a>
  </div>
  <section class="pane pane-active" id="pane-progress">${progressPane}</section>
  ${pm ? `<section class="pane" id="pane-path">${pathPane}</section>` : ''}
  <section class="pane" id="pane-decisions">${decisionsPane}</section>
  <section class="pane" id="pane-backlog">${backlogPane}</section>
  <section class="pane" id="pane-docs">${docsPane}</section>
</div>
<script>
  const tabs = document.querySelectorAll('.tab')
  // 长文折叠:pane 可见时才量高(display:none 下 scrollHeight=0 会误判);量过的打 data-cl 不重复
  function clampScan(pane) {
    if (!pane) return
    pane.querySelectorAll('dd.x, dd.decided, dd.demonote, p.notes').forEach(function (el) {
      if (el.dataset.cl || el.offsetParent === null) return
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 21
      el.dataset.cl = '1'
      if (el.scrollHeight > lh * 3.3) el.classList.add('clamp')
    })
  }
  const show = (name) => {
    tabs.forEach((t) => t.classList.toggle('tab-active', t.dataset.pane === name))
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('pane-active', p.id === 'pane-' + name))
    clampScan(document.getElementById('pane-' + name))
    if (name === 'docs') docsNavSync() // docsnav 在隐藏 pane 里 offsetHeight=0,切进来才量得到真高(函数声明提升,此处可前向引用)
  }
  tabs.forEach((t) => t.addEventListener('click', () => { show(t.dataset.pane); history.replaceState(null, '', t.dataset.pane === 'progress' ? '#' : '#' + t.dataset.pane) }))
  const PANES = new Set(['progress', 'path', 'decisions', 'backlog', 'docs'])
  function routeHash() {
    const id = decodeURIComponent(location.hash.slice(1))
    if (!id) return
    if (PANES.has(id)) { show(id); return }
    const el = document.getElementById(id)
    if (!el) return
    const pane = el.closest('.pane')
    if (pane) show(pane.id.replace('pane-', ''))
    // 目标卡被线路/时间筛掉时先放开筛选,否则跳到 display:none 元素=毫无反应(A 线卡在 C 档下就是这样)
    if (el.classList.contains('lcard')) {
      const cl = el.dataset.line || ''
      const curL = wrapEl.getAttribute('data-line')
      if (curL !== 'all' && cl && !cl.split(' ').includes(curL)) setLine(cl.split(' ')[0])
      if (el.classList.contains('tf-hide')) setTime(0)
      if (el.classList.contains('flt-hide')) toolbars.forEach((tb) => tb.clearAll()) // 被工具条筛掉:放开筛选再跳
    }
    const ppanel = el.closest('.pathpanel') // 目标在某步详情面板里(如决策路径跳 TCx 任务卡)→ 先激活该面板
    if (ppanel) selectIter(ppanel.dataset.iter)
    if (el.classList.contains('rcard')) el.classList.add('open') // 跳到某卡时自动展开看详情
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('flash-target')
    setTimeout(() => el.classList.remove('flash-target'), 1600)
  }
  window.addEventListener('hashchange', routeHash)

  // 行卡展开 / 长文折叠:点击 .rhead 展开该卡;链接/按钮点击不触发(它们冒泡到此已导航)
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('a, button')) return
    const head = ev.target.closest('.rhead')
    if (head) { head.parentElement.classList.toggle('open'); return }
    const d = ev.target.closest('.clamp')
    if (d) d.classList.toggle('open')
  })

  // 线路筛选(A/B/C 纪元):切 .wrap[data-line],纯 CSS 过滤卡/组;记忆选择
  // v0.2(D46):线别控件 = 决策工具条分段 + 文档库 chips,共享同一全局线别状态与 localStorage key
  const wrapEl = document.querySelector('.wrap')
  const lineBtns = document.querySelectorAll('.lseg [data-line], .dchips [data-line]')

  // pathmap 主从:点节点 → 下方面板显示该步详情(总览页自足,不必往下翻);curIter 记住选中步
  const progPane = document.getElementById('pane-progress')
  function selectIter(id) {
    if (!progPane) return
    const nodes = [...progPane.querySelectorAll('.pnode')]
    if (!nodes.length) return
    const line = wrapEl.getAttribute('data-line')
    const vis = (n) => line === 'all' || (n.dataset.line || '').split(' ').includes(line)
    let node = id ? nodes.find((n) => n.dataset.iter === id) : null
    if (!node || !vis(node)) { const v = nodes.filter(vis); node = v[v.length - 1] || null } // 选中步被筛掉/未指定 → 退回最新可见步
    const iter = node ? node.dataset.iter : null
    curIter = iter
    nodes.forEach((n) => n.classList.toggle('pnode-sel', n.dataset.iter === iter))
    progPane.querySelectorAll('.pathpanel').forEach((p) => p.classList.toggle('active', p.dataset.iter === iter))
  }
  if (progPane) progPane.addEventListener('click', (e) => {
    const n = e.target.closest('.pnode')
    if (n) selectIter(n.dataset.iter)
  })

  function setLine(line) {
    curLine = line // setTime 重算时要拿到当前档
    wrapEl.setAttribute('data-line', line)
    lineBtns.forEach((b) => b.classList.toggle('on', b.dataset.line === line))
    // 全局线别 pill(hubbar,所有 tab 可见):线别控件只住在决策工具条/文档库,别的 tab 得有个可见指示,否则筛选像凭空生效
    const lpG = document.getElementById('linepill')
    if (lpG) { lpG.style.display = line === 'all' ? 'none' : ''; lpG.textContent = '线别 ' + line + ' ×' }${LANE.h1RewriteJs}
    // 可见谓词 = 线路 ∧ 时间 ∧ 搜索 ∧ 工具条(tf-hide 由 setTime 打、search-hide 由 applySearch 打、flt-hide 由工具条 apply 打)
    const visOk = (c) =>
      (line === 'all' || (c.dataset.line || '').split(' ').includes(line)) &&
      !c.classList.contains('tf-hide') &&
      !c.classList.contains('search-hide') &&
      !c.classList.contains('flt-hide')
    // 组头计数随筛选重算(决策/backlog 组是数字;进度组 gid=迭代号,跳过);
    // 时间筛选是 JS 维度,CSS :has 只管线路 —— 组显隐在这里统一接管(决策/Backlog 面板)
    document.querySelectorAll('.group').forEach((g) => {
      const gid = g.querySelector('.gid')
      if (!gid) return
      if (gid.dataset.n0 === undefined) gid.dataset.n0 = gid.textContent.trim()
      if (!/^\\d+$/.test(gid.dataset.n0)) return
      const vis = [...g.querySelectorAll('.lcard')].filter(visOk).length
      gid.textContent = String(vis) // 无筛选时 vis 即原始总数;有任一维度筛选时是可见数
      const pane = g.closest('.pane')
      if (pane && (pane.id === 'pane-decisions' || pane.id === 'pane-backlog')) {
        g.style.display = vis ? '' : 'none'
      }
    })
    // 当前筛选下的可见卡计数
    const nVis = (root, sel) => [...root.querySelectorAll(sel)].filter(visOk).length
    // tab 徽章随线路重算(决策/Backlog;进度/路径 tab 无数字)
    document.querySelectorAll('.tab[data-label]').forEach((t) => {
      const pane = document.getElementById('pane-' + t.dataset.pane)
      if (pane) t.textContent = t.dataset.label + ' · ' + nVis(pane, '.lcard')
    })
    // 汇总行(决策/Backlog 各一条):总数 + 分状态 chip 重算
    // 进度条按线路重算(与 gen 同口径:separate 不计;非全部档加线路前缀)
    const pbi = document.querySelector('#pane-progress .pbar i')
    const ptx = document.querySelector('#pane-progress .ptext')
    if (pbi && ptx) {
      const pane = document.getElementById('pane-progress')
      const tot = [...pane.querySelectorAll('.lcard:not(.card-separate)')].filter(
        (c) => line === 'all' || (c.dataset.line || '').split(' ').includes(line),
      )
      const done = tot.filter((c) => c.classList.contains('card-done')).length
      const pcv = tot.length ? Math.round((done / tot.length) * 100) : 0
      pbi.style.width = pcv + '%'
      ptx.textContent = (line === 'all' ? '' : line + ' 线 ') + done + '/' + tot.length + ' 完成(' + pcv + '%)' + (ptx.dataset.sep ? '· 派单模块单独计' : '')
    }
    // 筛空的 pane 显示占位,避免空壳像坏页
    document.querySelectorAll('.pane .pane-empty').forEach((pe) => {
      pe.style.display = nVis(pe.closest('.pane'), '.lcard') ? 'none' : 'block'
    })
    try { localStorage.setItem('${LANE.lsLineKey}', line) } catch (e) {}
    clampScan(document.querySelector('.pane-active')) // 换档后新露出的卡补量折叠
    selectIter(curIter) // 保持选中步;若被本线路筛掉则退回最新可见步
    toolbars.forEach((tb) => tb.refresh()) // 决策/Backlog 工具条:chips 计数/摘要行/meta/空态跟随所有筛选维度
    docsHubRefresh() // 文档库 Hub:段计数/空段/状态行跟随线别与搜索
  }
  lineBtns.forEach((b) => b.addEventListener('click', () => setLine(b.dataset.line)))
  const lpBtn = document.getElementById('linepill')
  if (lpBtn) lpBtn.addEventListener('click', () => setLine('all'))

  // 时间筛选(2026-07-07 用户定向):近 N 天,只作用于 决策/Backlog 卡;无日期的卡只在「全部」可见
  const tfBtns = document.querySelectorAll('.tf')
  let curLine = '${LANE.defaultLine}'
  let curIter = null // 当前选中的 pathmap 步(selectIter 读写)
  function setTime(days) {
    tfBtns.forEach((b2) => b2.classList.toggle('tf-active', Number(b2.dataset.days) === days))
    let cutoff = ''
    if (days > 0) {
      const d = new Date(Date.now() - days * 86400000)
      cutoff = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    }
    document.querySelectorAll('#pane-decisions .lcard, #pane-backlog .lcard').forEach((c) => {
      const dd = c.dataset.date || ''
      c.classList.toggle('tf-hide', days > 0 && (!dd || dd < cutoff))
    })
    try { localStorage.setItem('${LANE.lsTfKey}', String(days)) } catch (e) {}
    setLine(curLine) // 计数/组显隐/空态统一重算
  }
  tfBtns.forEach((b2) => b2.addEventListener('click', () => setTime(Number(b2.dataset.days))))

  // 搜索:按 id / 标题 / 全文(含折叠 body 的 textContent)过滤 lcard;走 setLine 统一重算计数/组/空态
  const searchInput = document.getElementById('hubsearch')
  function applySearch() {
    const q = (searchInput.value || '').trim().toLowerCase()
    document.querySelectorAll('.lcard').forEach((c) => {
      c.classList.toggle('search-hide', q !== '' && !c.textContent.toLowerCase().includes(q))
    })
    setLine(curLine)
  }
  if (searchInput) searchInput.addEventListener('input', applySearch)
  document.addEventListener('keydown', (ev) => {
    const ae = document.activeElement || {}
    if (ev.key === '/' && searchInput && ae !== searchInput && !/^(INPUT|TEXTAREA)$/.test(ae.tagName || '')) {
      ev.preventDefault(); searchInput.focus()
    }
  })

  // 展开 / 收起当前 tab 的全部行卡
  const expandBtn = document.getElementById('hubexpand')
  let allOpen = false
  if (expandBtn) expandBtn.addEventListener('click', () => {
    allOpen = !allOpen
    const pane = document.querySelector('.pane-active')
    if (pane) pane.querySelectorAll('.rcard').forEach((c) => c.classList.toggle('open', allOpen))
    expandBtn.textContent = allOpen ? '收起全部' : '展开全部'
  })

  // ———— 工具条工厂(D46 方案A,决策/Backlog 共用):状态多选 / 维度下拉 / 排序 / 标题+编号搜索;线别分段走全局 setLine ————
  const tbNum = (id) => parseInt(String(id).replace(/^\\D+/, ''), 10) || 0
  const tbPre = (id) => (String(id).match(/^[A-Za-z]+/) || [''])[0]
  const TB_SORT_LABEL = { 'date-desc': '日期新→旧', 'date-asc': '日期旧→新', 'id': '按编号' }
  const tbDateCmp = (dir) => (a, b) => {
    const da = a.dataset.date || '', db = b.dataset.date || ''
    if (!da && !db) return tbNum(b.id) - tbNum(a.id) // 都无日期:编号新→旧
    if (!da) return 1 // 无日期沉底
    if (!db) return -1
    return dir * (da < db ? -1 : da > db ? 1 : 0)
  }
  const toolbars = []
  // opts:{ pane, pre, cardSel, dimAttr };控件 id 走 <pre>chips/<pre>dim/<pre>sort/… 约定(gen 期 tbHtml 同款)
  function initToolbar(opts) {
    const pane = document.getElementById(opts.pane)
    if (!pane) return
    const cards = [...pane.querySelectorAll(opts.cardSel)]
    const state = { statuses: new Set(), dim: 'all', sort: 'date-desc', q: '' }
    const el = (sfx) => document.getElementById(opts.pre + sfx)
    const dimSel = el('dim'), sortSel = el('sort'), searchIn = el('search'), searchClear = el('searchclear')
    // 本工具条维度(状态/下拉维度/搜索)打 .flt-hide;线别/时间/全局搜索由 setLine/setTime/applySearch 管
    function apply() {
      cards.forEach((c) => {
        const okS = !state.statuses.size || state.statuses.has(c.dataset.status)
        const okD = state.dim === 'all' || c.dataset[opts.dimAttr] === state.dim
        const okQ = !state.q || (c.dataset.search || '').indexOf(state.q) >= 0
        c.classList.toggle('flt-hide', !(okS && okD && okQ))
      })
      // 排序:组内重排(看板保留状态分组,排序作用于每组内部;编号=前缀字母序+数字)
      const cmp = state.sort === 'id'
        ? (a, b) => tbPre(a.id).localeCompare(tbPre(b.id)) || tbNum(a.id) - tbNum(b.id) || a.id.localeCompare(b.id)
        : tbDateCmp(state.sort === 'date-asc' ? 1 : -1)
      pane.querySelectorAll('.group .cards').forEach((box) => {
        const cs = [...box.children].filter((n) => n.matches(opts.cardSel))
        cs.sort(cmp).forEach((n) => box.appendChild(n))
      })
      setLine(curLine) // 统一重算组计数/tab 徽章/空态;尾部回调各工具条 refresh
    }
    function clearAll() {
      state.statuses.clear(); state.dim = 'all'; state.q = ''
      if (dimSel) dimSel.value = 'all'
      if (searchIn) searchIn.value = ''
      if (searchClear) searchClear.style.display = 'none'
      curLine = 'all' // 线别归位(apply → setLine 会同步分段/chips 高亮与存储)
      setTime(0) // 时间筛选一并归位:否则「近 N 天」独自筛空时,空态的「清除筛选」点了没效果(死胡同)
      apply()
    }
    // setLine 尾部回调:chips 高亮+计数(除状态维度外的其余筛选下各状态余量)/行内清除钮/meta/空态
    function refresh() {
      const line = wrapEl.getAttribute('data-line')
      const passGlobal = (c) =>
        (line === 'all' || (c.dataset.line || '').split(' ').includes(line)) &&
        !c.classList.contains('tf-hide') && !c.classList.contains('search-hide')
      const passD = (c) => state.dim === 'all' || c.dataset[opts.dimAttr] === state.dim
      const passQ = (c) => !state.q || (c.dataset.search || '').indexOf(state.q) >= 0
      const passS = (c) => !state.statuses.size || state.statuses.has(c.dataset.status)
      const chipEls = el('chips') ? [...el('chips').querySelectorAll('.stchip')] : []
      chipEls.forEach((ch) => {
        const k = ch.dataset.k
        ch.classList.toggle('on', state.statuses.has(k))
        const n = cards.filter((c) => c.dataset.status === k && passGlobal(c) && passD(c) && passQ(c)).length
        const cn = ch.querySelector('.cn'); if (cn) cn.textContent = n
      })
      const vis = cards.filter((c) => passGlobal(c) && passS(c) && passD(c) && passQ(c)).length
      const active = state.statuses.size > 0 || state.dim !== 'all' || state.q !== '' || line !== 'all'
      const meta = el('meta')
      if (meta) meta.innerHTML = '<b>' + vis + '</b> 条' + (active ? ' · 已筛(共 ' + cards.length + ')' : '') + ' · 按' + TB_SORT_LABEL[state.sort]
      const empty = el('empty')
      if (empty) empty.style.display = vis ? 'none' : 'block'
      // 行内清除钮:控件自身即状态显示,仅在任一筛选生效时出现(不另设已选摘要行)
      const ca = el('clearall')
      if (ca) ca.style.display = active ? '' : 'none'
    }
    // 接线
    if (el('chips')) el('chips').querySelectorAll('.stchip').forEach((ch) => ch.addEventListener('click', () => {
      const k = ch.dataset.k
      state.statuses.has(k) ? state.statuses.delete(k) : state.statuses.add(k)
      apply()
    }))
    if (dimSel) dimSel.addEventListener('change', () => { state.dim = dimSel.value; apply() })
    if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; apply() })
    if (searchIn) searchIn.addEventListener('input', () => {
      state.q = searchIn.value.trim().toLowerCase()
      if (searchClear) searchClear.style.display = searchIn.value ? 'block' : 'none'
      apply()
    })
    if (searchClear && searchIn) searchClear.addEventListener('click', () => {
      searchIn.value = ''; state.q = ''; searchClear.style.display = 'none'; searchIn.focus(); apply()
    })
    if (el('clearall')) el('clearall').addEventListener('click', clearAll)
    if (el('emptyclear')) el('emptyclear').addEventListener('click', clearAll)
    toolbars.push({ refresh, clearAll })
  }
  initToolbar({ pane: 'pane-decisions', pre: 'dec', cardSel: '.deccard', dimAttr: 'type' })
  initToolbar({ pane: 'pane-backlog', pre: 'bl', cardSel: '.blcard', dimAttr: 'priority' })

  // ———— 文档库 Hub(D46 方案B):已读进度(localStorage)+ 更新时间标签 + scrollspy + 段计数/空段/状态行 ————
  const docsPaneEl = document.getElementById('pane-docs')
  const docCardsAll = docsPaneEl ? [...docsPaneEl.querySelectorAll('.doccard')] : []
  const docOrdered = docCardsAll.filter((c) => c.dataset.order)
  const DOCS_READ_KEY = '${LANE.lsLineKey.replace(/_line$/, '_docsread')}'
  let docsRead = new Set()
  try { docsRead = new Set(JSON.parse(localStorage.getItem(DOCS_READ_KEY) || '[]')) } catch (e) {}
  function docsReadRefresh() {
    docOrdered.forEach((c) => {
      const done = docsRead.has(c.dataset.doc)
      const b = c.querySelector('.obadge')
      if (b) { b.classList.toggle('done', done); b.textContent = done ? '✓' : c.dataset.order }
    })
    const prog = document.getElementById('docprog')
    if (prog) {
      const n = docOrdered.filter((c) => docsRead.has(c.dataset.doc)).length
      prog.innerHTML = '阅读动线 <b>' + n + ' / ' + docOrdered.length + '</b> 已读' + (n > 0 && n === docOrdered.length ? ' · 动线走完' : '')
    }
  }
  if (docsPaneEl) docsPaneEl.addEventListener('click', (e) => {
    const card = e.target.closest('.doccard')
    if (card && card.dataset.order) {
      docsRead.add(card.dataset.doc) // 点开即计已读;导航照常进行
      try { localStorage.setItem(DOCS_READ_KEY, JSON.stringify([...docsRead])) } catch (e2) {}
      docsReadRefresh()
    }
  })
  // 更新时间(gen 期嵌 data-updated 绝对日期,运行期算相对天数;hover 才显示)
  docCardsAll.forEach((c) => {
    const u = c.dataset.updated, el = c.querySelector('.dupdated')
    if (!el || !u) return
    const days = Math.round((Date.now() - Date.parse(u + 'T00:00:00')) / 86400000)
    el.textContent = '更新于 ' + u.slice(5) + ' · ' + (days <= 0 ? '今天' : days === 1 ? '昨天' : days + ' 天前')
  })
  function docsHubRefresh() {
    if (!docsPaneEl) return
    const line = wrapEl.getAttribute('data-line')
    let total = 0
    docsPaneEl.querySelectorAll('.dseg').forEach((sec) => {
      const vis = [...sec.querySelectorAll('.doccard')].filter((c) =>
        (line === 'all' || (c.dataset.line || '').split(' ').includes(line)) && !c.classList.contains('search-hide')).length
      total += vis
      const cnt = sec.querySelector('.dscnt'); if (cnt) cnt.textContent = vis + ' 篇'
      const empty = sec.querySelector('.dsegempty')
      if (empty) {
        empty.style.display = vis ? 'none' : ''
        if (!vis) empty.textContent = line === 'all' ? '本段暂无文档' : '本段无 ' + line + ' 线文档'
      }
    })
    const sl = document.getElementById('docstatus')
    if (sl) sl.innerHTML = line === 'all'
      ? '<b>' + total + ' 篇</b> · 四段归组 · 段内按更新时间倒序 · 悬停卡片看更新时间'
      : '<b>' + total + ' 篇</b> ' + line + ' 线 · 共 ' + docCardsAll.length + ' 篇(未标线别的文档在其它线视图下隐去)'
  }
  // 阅读顺序 stepper:点击平滑滚动 + scrollspy 点亮当前段
  const stepperEl = document.getElementById('docstepper')
  let buildDocSpy = () => {}
  if (stepperEl) {
    const steps = {}
    stepperEl.querySelectorAll('.hstep').forEach((a) => {
      steps[a.dataset.seg] = a
      a.addEventListener('click', (ev) => {
        ev.preventDefault()
        const t = document.getElementById('dseg-' + a.dataset.seg)
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
    // IO 的 rootMargin 不吃 CSS 变量,建时用量到的 hubh+dnavh 算死;高度变了(resize/切进 docs tab)由 docsNavSync 重建
    let io = null
    buildDocSpy = () => {
      if (io) io.disconnect()
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return
          Object.keys(steps).forEach((k) => steps[k].classList.remove('active'))
          const k = en.target.dataset.seg
          if (steps[k]) steps[k].classList.add('active')
        })
      }, { rootMargin: '-' + (hubH + dnavH + 10) + 'px 0px -62% 0px', threshold: 0 })
      docsPaneEl.querySelectorAll('.dseg').forEach((sec) => io.observe(sec))
    }
  }
  // ———— 导航吸顶量高(BL-C43):hubbar/docsnav 都因 flex-wrap 换行高度可变,吸顶 top、锚点补偿、scrollspy 边界一律量出来 ————
  const hubbarEl = document.querySelector('.hubbar')
  const docsnavEl = docsPaneEl ? docsPaneEl.querySelector('.docsnav') : null
  let hubH = 41, dnavH = 0
  function docsNavSync() {
    if (hubbarEl && hubbarEl.offsetHeight) hubH = hubbarEl.offsetHeight
    if (docsnavEl && docsnavEl.offsetHeight) dnavH = docsnavEl.offsetHeight // pane display:none 时量得 0:保留旧值,切进 docs tab 再补量
    const rs = document.documentElement.style
    rs.setProperty('--hubh', hubH + 'px')
    rs.setProperty('--dnavh', dnavH + 'px')
    buildDocSpy()
  }
  docsNavSync()
  window.addEventListener('load', docsNavSync)
  let navRaf = 0
  window.addEventListener('resize', () => { cancelAnimationFrame(navRaf); navRaf = requestAnimationFrame(docsNavSync) })
  docsReadRefresh()

${LANE.savedLineJs}
  curLine = savedLine
  let savedTf = 0
  try { savedTf = Number(localStorage.getItem('${LANE.lsTfKey}') || 0) || 0 } catch (e) {}
  setTime(savedTf) // 内部会 setLine(curLine)
  routeHash() // 初始 hash 路由放最后:此时 setLine/setTime/wrapEl 都就位,跳隐藏卡能先放开筛选
</script>
`

injectDemoBacknav()
writeRefs()
writeFileSync(join(HERE, 'index.html'), html)
console.log(
  `index.html 已生成:进度 ${m.tasks.length} 任务/${pct}% · backlog ${blCount} 条` +
    `(${b.groups.map((g) => `${b.statuses[g.id]} ${b.items.filter((it) => it.status === g.id).length}`).join(' / ')})` +
    ` · 决策/Demo ${dm.entries.length} 条`,
)
