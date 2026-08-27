// 守卫 + init 消息表(zh/en)。按看板 kanban.config.json 的 lang 字段选表,缺省 zh。
// zh 文案自首宿主项目的原版 claude-stop-hook.mjs / settings.json jq 提醒原样搬入,
// 孤儿报警增补竞态核实提示(设计 §6-4)。init 段(scan/plan/apply 报告)zh 原样自 init.mjs 提出。
// 注意:manifest 卡内容(存根卡 question、backlog 卡 title/problem/approach、tiers 词汇)
// 是数据不是报告,不进本表 —— 跨语言幂等,保持 zh。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const zhPortCaveat = '端口探测只避得开「当下正被监听」的端口,避不开别的项目 config 里写了但没起的 —— 同机多项目端口需人工分配(设计 §5)。'

const zh = {
  genFail: (err) =>
    `看板守卫:gen.mjs 重跑失败(多半是 manifest JSON 语法错),请修好再收工:\n${err}`,
  stampNewer: (stamp, mine) =>
    `⚠ 看板守卫:index.html 由更新的 ddd-gen v${stamp} 生成,本 session 的 plugin 是 v${mine}(更旧)——已跳过重生成以免旧版盖板;看板将保持现状,升级 plugin(若已升级,重启 session)后自动恢复。`,
  noSelfVersion:
    () => '⚠ 看板守卫:plugin 安装异常(读不到自身 plugin.json 的纯数字版本),已跳过看板重生成——请重装/升级 plugin。',
  healedUnstamped:
    () => '看板守卫:检测到 index.html 为无戳(旧版 gen)产物,已用当前版重生成自愈;若本机仍有旧版长寿 session 在跑,可执行 plugin scripts/retire-stale-caches.mjs 断火源(先 dry-run,--yes 落盘)。',
  orphanWarn: (n, list) =>
    `⚠ 看板守卫:仍有 ${n} 个 demo 未挂看板卡(本次放行):\n${list}`,
  orphanBlock: (n, list) =>
    `看板守卫:发现 ${n} 个 demo 未挂任何看板卡(违反「demo 必挂卡」审计规则):\n${list}\n请立即在 app/kanban/decisions-manifest.json 或 backlog-manifest.json 为其补卡(字段风格照现有卡);若确属无需挂卡,把文件名加入 app/kanban/demos/.no-card-ok(一行一个)。不必手动跑 gen.mjs,守卫会自动重生成。处理前先 grep 核实文件名是否已在 manifest——多会话并行存在补链竞态,报警可能已过时。`,
  accParseFail: (err) =>
    `⚠ 看板守卫:acceptance-manifest.json 无法解析,验收审计跳过(「验收」tab 也会跟着报错):${err}`,
  accCurrentNoList: (cur) =>
    `⚠ 看板守卫:acceptance-manifest.json 的 current = ${cur},但没有任何一份清单含这个 PR —— 「验收」tab 的当前面板会是空的;补一份清单,或把 current 改回 null。`,
  accDupPr: (pr, a, c) =>
    `⚠ 看板守卫:PR #${pr} 同时出现在两份验收清单(${a} 与 ${c})—— 勾选进度会分家,请合并成一份或改掉其中一处的 pr。`,
  accDupItem: (list, id) =>
    `⚠ 看板守卫:验收清单 ${list} 里条目 id「${id}」重复 —— 勾选状态按 id 存,重复即互相顶掉,请改成唯一 id。`,
  accUnknownCard: (list, id) =>
    `⚠ 看板守卫:验收清单 ${list} 的 cards 引用了看板上不存在的卡号「${id}」—— 芯片会点不动,请核对卡号。`,
  richLongText: (hits, total) =>
    `⚠ 看板守卫:${total} 张卡的正文字段超过 800 字,却没有 detail 字段 —— 卡正文留结论(problem ≤ 2 句、approach 结论先行、note 只记时间线),逐文件证据与灰盒记录移进 detail:\n` +
    hits.map((h) => `  - ${h.id} 的 ${h.key} 有 ${h.n} 字`).join('\n'),
  respSettle: (ids, total) =>
    `⚠ 看板守卫:${total} 张卡的关联 PR 都已合并,卡却还停在非终态(待收账):${ids.join(' ')}${total > ids.length ? ` …等 ${total} 张` : ''}\n  跑 \`node <plugin>/scripts/pr-sync.mjs --settle\` 看完整清单(卡 → 建议 status),确认后加 --write 收账(挑着收加 --only 卡号)。\n  这一轮不该收的卡(PR 只落了一半),在卡上写 "settleHold": "理由" —— 它从此不进清单、不出芯片,守卫这条也不再点它。`,
  respReopen: (ids, total) =>
    `⚠ 看板守卫:${total} 张卡已收到终态,却还有关联 PR 开着:${ids.join(' ')}${total > ids.length ? ` …等 ${total} 张` : ''}\n  要么 PR 还没合(卡收早了),要么卡上挂了不该算它的 PR —— 核一下,机器不替你改。`,
  wipOver: (n, hard) =>
    `⚠ 看板守卫:可立即做(ready)的卡有 ${n} 张,超过 config.wip.hard = ${hard} —— 在建的活比手能覆盖的多,新卡再立就是往堆里加。先清一批(收掉已落地的、把等外部的改 blocked、把不打算近期做的改 deferred),再立新卡。`,
  cardsDirMissing: (rel) =>
    `⚠ 看板守卫:config.cardsDir 开着,但卡目录 ${rel} 不在 —— gen 会硬失败,看板停在上一版。建目录或把 cardsDir 从 kanban.config.json 去掉。`,
  cardIdBad: (rows, total) =>
    `⚠ 看板守卫:${total} 个卡文件的文件名与卡里的 id 对不上 —— 文件名就是卡号(一个真源),对不上 gen 会硬失败:\n` +
    rows.map((r) => `  - ${r.file}(id 是「${r.id}」)`).join('\n'),
  cardParseBad: (rows, total) =>
    `⚠ 看板守卫:${total} 个卡文件不是合法 JSON —— gen 会硬失败,看板停在上一版:\n` +
    rows.map((r) => `  - ${r.file}:${r.message}`).join('\n'),
  ghprRemindMerge:
    '[看板提醒] 刚合了一个 PR。跑 `node <plugin>/scripts/pr-sync.mjs --settle`:它先把 gh 上的 PR 与版本同步进 release-manifest.json,再列出「PR 都合了、卡还没收」的卡与建议 status(默认只打印;确认无误后加 --write 收账)。顺手核一遍卡的 links 标题:状态词(开而不合 / 待合 / 已合)不必手写,看板会按实际状态渲染。与看板无关则忽略。',
  ghprRemind:
    '[看板提醒] 刚运行了 gh pr 命令。若这标志某功能/阶段完成:检查 app/kanban 对应看板卡状态是否需要推进(改完 manifest 不必手动跑 gen,Stop 守卫会自动重生成);顺手把 PR 挂上卡 —— `node <plugin>/scripts/ddd.mjs card link <卡号> "<这个 PR 干了什么>" <PR 链接>`(它顺手写 pr 字段),开/合 PR 后跑 `node <plugin>/scripts/pr-sync.mjs` 刷新 release-manifest.json。与看板无关则忽略。',
  prSync: {
    noRepo: () => 'pr-sync:三份 manifest 的 instance.ghRepo 都是空的,不知道该同步哪个仓 —— 先在 manifest.json 的 instance.ghRepo 填 "owner/repo"。',
    ghMissing: () => 'pr-sync:找不到 gh 命令。装 GitHub CLI(https://cli.github.com)并 `gh auth login` 之后重跑;本次一个字节都没写。',
    ghFailed: (what, err) => `pr-sync:${what} 失败(gh 未登录 / 无权访问该仓 / 网络不通都会这样):${err}\n本次一个字节都没写,修好后重跑。`,
    ghBadJson: (what, err) => `pr-sync:${what} 的输出不是合法 JSON(gh 版本太旧?需要支持 --json 的 gh 2.x):${err}\n本次一个字节都没写。`,
    manifestBad: (err) => `pr-sync:release-manifest.json 存在但不是合法 JSON,拒绝覆盖(人手写的 note/prs 可能就在里面):${err}`,
    done: (prs, rels, added, file) => `pr-sync:${prs} 个 PR · ${rels} 个版本(新增 ${added})→ ${file}`,
    dry: (prs, rels, added) => `pr-sync --dry-run:将写入 ${prs} 个 PR · ${rels} 个版本(新增 ${added});未写文件。`,
    settleNone: () => 'pr-sync --settle:没有待收账的卡 —— 关联 PR 都合了的卡,status 都已经在终态了。',
    settleHead: (n) => `pr-sync --settle:${n} 张卡的关联 PR 都已合并,status 还没收:`,
    settleRow: (id, from, to, prs) => `  ${id}  ${from} → ${to}  ${prs}`,
    settleDry: (sample) => `干跑:一个字节都没写。核对无误后加 --write 收账 —— 只改这些卡的 status,并在有时间线字段的卡(note / notes)末尾追加一行「【日期 收账】PR#N 已合(自动)」。\n  只收其中几张:--write --only ${sample || '<卡号>'}(逗号分隔多张)。一张卡这一轮本来就不该收(PR 只落了一半)→ 在卡上写 "settleHold": "理由",它不再进这份清单。`,
    settleWrote: (n, files) => `pr-sync --settle --write:已收账 ${n} 张卡 → ${files}`,
    settleHeld: (ids, n) => `  已 hold(${n}):${ids.join(' ')} —— 这些卡的 PR 也都合了,但卡上写了 settleHold(理由见卡头灰芯片),本次不收、守卫也不催。要收就先删掉那个字段。`,
    settleOnlyEmpty: () => 'pr-sync --settle --only:没给卡号。写法 --only BL-1 或 --only BL-1,D2(逗号分隔);本次一个字节都没写。',
    settleOnlyBad: (ids) => `pr-sync --settle --only:这些卡号不在上面的待收账清单里,本次一个字节都没写:${ids.join(' ')}\n  对着清单核卡号;写了 settleHold 的卡本来就不在清单里(要收它,先删掉卡上的 settleHold)。`,
    settleDryWins: () => 'pr-sync:--dry-run 与 --write 同时给了,按 --dry-run 处理 —— 只打印,不写。',
    settleReformat: (file) => `pr-sync --settle --write:${file} 的排版不是 JSON.stringify(…, null, 2) 的标准形制,拒绝改写(重排会动到其它卡的字节)。这几张卡请手工收账。`,
  },
  cards: {
    alreadySplit: (dir) => `cards-split:kanban.config.json 已经配了 cardsDir = "${dir}",这块板已是一卡一文件。要反向合回单文件用 cards-join.mjs。`,
    notSplit: () => 'cards-join:kanban.config.json 没配 cardsDir,这块板还是单文件形制,没什么可合的。',
    headNoArray: (file, key) => `cards-split:${file} 里没有 ${key} 数组,不知道要拆什么 —— 这块板的形制不对,先核对 manifest。`,
    headHasArray: (file, key) => `cards-join:${file} 里已经有 ${key} 数组(一个真源被破坏了)——先手工清理头文件再合。`,
    dirNotEmpty: (rel) => `cards-split:${rel} 已存在且非空,拒绝往里拆(怕盖掉已有的卡)。换一个目录名,或先清空。`,
    idBad: (id, why) => `卡 id「${id}」${why}`,
    idEmpty: () => '是空的 —— 每张卡都要有 id,文件名就是它',
    idUnsafe: () => '不能当文件名(含 / \\ 或 .. 或前后空白)',
    idDup: (id) => `卡 id「${id}」出现了两次 —— 拆开之后会是同一个文件名,先把重复的改掉`,
    orderTaken: (id) => `卡「${id}」已经有 order 字段了 —— 拆分要用这个名字记原数组下标,请先给它改个名`,
    dirMissing: (rel) => `cards-join:卡目录 ${rel} 不在(相对看板目录),没得可合`,
    parseBad: (rel, err) => `cards-join:卡文件 ${rel} 不是合法 JSON,拒绝合并(会把这张卡弄丢):${err}`,
    idMismatch: (rel, id) => `cards-join:卡文件 ${rel} 的文件名与卡里的 id「${id}」对不上,先改一致再合`,
    dryRun: (rows, total) =>
      `cards-split --dry-run:将生成 ${total} 个卡文件\n` + rows.map((r) => `  ${r.rel}/  ${r.n} 个`).join('\n') + '\n未写任何文件。',
    dryRunJoin: (rows, total) =>
      `cards-join --dry-run:将合回 ${total} 张卡\n` + rows.map((r) => `  ${r.rel}/  ${r.n} 个 → ${r.file} 的 ${r.key}`).join('\n') + '\n未写任何文件。',
    genFailed: (err) => `gen.mjs 跑不过,已回滚(看板与拆分前一模一样):\n${err}`,
    diffFound: (files) => `拆分前后的产物对不上,已回滚(看板与拆分前一模一样)。对不上的:${files}\n这是 0.14.0 的验收门 —— 不相同就不算拆成功,请把差异报上游。`,
    diffFoundJoin: (files) => `合并前后的产物对不上,已回滚(看板与合并前一模一样)。对不上的:${files}`,
    splitDone: (total, rows, dir) =>
      `cards-split:${total} 张卡 → ${rows.map((r) => `${r.rel}/ ${r.n} 个`).join(' · ')};头文件已去掉数组,kanban.config.json 写入 cardsDir = "${dir}"。\n` +
      '产物与拆分前逐字节相同(除新增的每卡「更新」时间戳)。请把整批改动作为一个 commit 提交,message 写明是 rename 性质。',
    joinDone: (total, files) => `cards-join:${total} 张卡合回 ${files};卡文件与目录已删除,kanban.config.json 去掉了 cardsDir。产物与合并前逐字节相同。`,
    baselineFailed: (err) => `跑不出「改动前」的基准产物(gen.mjs 先失败了),一个字节都没写:\n${err}`,
  },
  cli: {
    usage: () => `ddd —— 看板写操作 CLI(v0.14.0,零依赖)

  node <plugin>/scripts/ddd.mjs <命令> [参数] [--dir <看板目录>] [--json]

卡:
  card new backlog|decision [--title "…"] [--line C] [--session dev] [--from f.json]
      建卡。卡号由脚本分配并独占预留(一卡一文件时用 openSync 'wx',抢输的自己退到下一号)。
      模板里的占位写成 <…>,建完把它们填掉;--from 给的字段覆盖模板。
  card set <id> <field> <value> [--json]
      改一个字段。--json:值按 JSON 解析(要写数组/对象用它,顺带把结果也打成 JSON)。
      校验:status ∈ 该类卡的 statuses、date 形如 YYYY-MM-DD、pr 形如 12 / "#12" / "owner/repo#12"、
      line ∈ config.lanes.ids、session ∈ config.sessionTags;links/shots 这类数组字段要 --json;
      id 与 order 不许改;不认识的字段只警告不拒。
  card status <id> <status> [--no-note]
      改状态,并在时间线字段末尾追一行「【日期】status → …」(--no-note 关掉这一行)。
  card note <id> "<text>"           时间线末尾追一行「【日期】text」
  card link <id> "<title>" <href>   links 追一条(href 去重);指向本仓 PR 的链接顺手写进 pr 字段
  card show <id> [--json]
  card list [--status s] [--line X] [--session Y] [--since YYYY-MM-DD] [--json]
  card history <id>                 这张卡文件的 git 历史(未拆成一卡一文件时不可用)

其它:
  export [--out f.json]             合成与 manifest 同形的一坨(backlog / decisions 两段),默认打到 stdout
  pr-sync […]                       转调 pr-sync.mjs,参数原样透传

看板目录:--dir > $CLAUDE_PROJECT_DIR/app/kanban > 当前目录(含 kanban.config.json)。
本命令从不 commit —— 写完的卡按纪律自己 git add 那几个文件。`,
    unknownFlag: (flag) => `ddd:不认识的旗子 ${flag}。看 --help;要把它当普通参数传就先写一个 -- 隔开。`,
    flagNeedsValue: (name) => `ddd:--${name} 后面要跟一个值。`,
    unknownCmd: (cmd) => `ddd:不认识的命令「${cmd}」。可用:card … / export / pr-sync;看 --help。`,
    unknownCardCmd: (cmd, list) => `ddd card:不认识的子命令「${cmd}」。可用:${list.join(' / ')};看 --help。`,
    kindBad: (kind) => `ddd card new:第一个参数要写 backlog 或 decision(给的是「${kind}」)。`,
    readFailed: (what, err) => `ddd:读不了 ${what}(不在,或不是合法 JSON):${err}`,
    headNoArray: (file, key) => `ddd:${file} 里没有 ${key} 数组,也没配 cardsDir —— 这块板的形制不对,先核对 manifest。`,
    headHasArray: (file, key, dir) => `ddd:kanban.config.json 配了 cardsDir = "${dir}",${file} 里却还留着 ${key} 数组(一个真源被破坏了)。卡的真源是 ${dir}/ 下的文件,先把头文件的 ${key} 删掉。`,
    dirMissing: (rel) => `ddd:卡目录 ${rel} 不在(相对看板目录)—— gen 也会硬失败。建目录,或把 cardsDir 从 kanban.config.json 去掉。`,
    cardParseBad: (rel, err) => `ddd:卡文件 ${rel} 不是合法 JSON,本次一个字节都没写(gen 也会在这儿硬失败):${err}`,
    cardIdMismatch: (rel, id) => `ddd:卡文件 ${rel} 的文件名与卡里的 id「${id}」对不上,本次一个字节都没写 —— 文件名就是卡号(一个真源)。`,
    cardNotFound: (id) => `ddd:板上没有卡号「${id}」。用 card list 核一遍(拆成一卡一文件之后,文件名就是卡号)。`,
    orderLocked: () => 'ddd:order 是拆分时记下的原数组下标(它就是显示顺序),不许用 CLI 改 —— 真要挪位置,直接编辑卡文件并说明理由。',
    idLocked: () => 'ddd:id 是这张卡的身份 —— 一卡一文件时它就是文件名,改了之后 gen 立刻硬失败(文件名与 id 对不上),而 CLI 见到坏卡也拒跑,连改回来的那条命令都用不了。要换卡号:用 card new 建新卡把内容搬过去,或者停下 gen、手工把文件与 id 一起改。本次一个字节都没写。',
    arrayField: (field) => `ddd:${field} 的形制是数组,给的是标量 —— gen 会在渲染它的时候 TypeError,整块板生成不出来。写法:--json '[…]',例如 card set <id> ${field} --json '[]'。本次一个字节都没写。`,
    statusBad: (v, list) => `ddd:status「${v}」不在这类卡的 statuses 里。可用:${list.join(' / ')}`,
    dateBad: (v) => `ddd:日期「${v}」形制不对,要 YYYY-MM-DD(板上按字符串比大小,补零不能省)。`,
    lineBad: (v, list) => `ddd:线别「${v}」不在 config.lanes.ids 里。可用:${list.join(' / ')}(多线共享写成空格分隔,如 "B C")`,
    sessionBad: (v, list) => `ddd:session 标签「${v}」不在 config.sessionTags 里。可用:${list.join(' / ')}(多标写成空格分隔,如 "dev release")`,
    prBad: (v) => `ddd:pr 值 ${v} 形制不对。要 12(本仓号)/ "#12" / "owner/repo#12";一张卡跨几个 PR 用 --json '[227,230]'。`,
    unknownField: (field, kind) => `⚠ ddd:「${field}」不是${kind}卡认得的字段,还是写进去了 —— 板上不会渲染它。是笔误就用 card set 改回来。`,
    fromNotObject: (file) => `ddd --from:${file} 的顶层不是一个 JSON 对象(要的是一张卡的字段表)。`,
    valueNotJson: (err) => `ddd --json:值不是合法 JSON:${err}\n  (shell 里记得整段加单引号,如 --json '["a","b"]')`,
    writeFailed: (where, err) => `ddd:写 ${where} 失败,原文件一个字节都没变(临时文件 + rename,半截文件不会落到卡的位置上):${err}`,
    noTiers: () => 'ddd card new backlog:这块板的 backlog-manifest.json 里 tiers 是空的,而 gen 硬要求每张卡的 tier 在 tiers 里 —— 先定义至少一个工作类型再建卡。',
    newExhausted: (prefix) => `ddd card new:从当前最大号往后 1000 个「${prefix}N」都被占了,没往下试。先看看卡目录里是不是有一批空占位文件。`,
    newDone: (id, file) => `ddd card new:${id} → ${file}\n  模板里的 <…> 是占位,用 card set 填掉(至少 title / problem / approach)。`,
    newNoLine: () => '⚠ ddd card new:这张卡没有 line —— 配了 lanes 的板上,它只在「全部」档出现,默认视图里看不见。用 card set <id> line <档> 补上。',
    tplTitle: () => '<一句话说清这张卡要解决什么>',
    tplProblem: () => '<用户看到什么、为什么这是问题;≤ 2 句,别写查证过程>',
    tplApproach: () => '<怎么改、改哪、代价;结论先行,1–3 行>',
    tplNote: () => '<决策与进展的时间线,一段一条;用 ddd card note 追加>',
    tplQuestion: () => '<要定的是什么;一句话>',
    tplDecision: () => '<拍板结论;还没拍板就先留着这行>',
    setUsage: () => 'ddd card set:写法 card set <id> <字段> <值>;值是数组/对象时加 --json。',
    setDone: (id, field, value, file) => `ddd card set:${id} 的 ${field} = ${value.length > 60 ? value.slice(0, 60) + '…' : value} → ${file}`,
    statusUsage: () => 'ddd card status:写法 card status <id> <status> [--no-note]。',
    statusDone: (id, from, to, noteField) => `ddd card status:${id} ${from || '(空)'} → ${to}` + (noteField ? `,并在 ${noteField} 末尾记了一行时间线` : '(--no-note:没记时间线)'),
    noteUsage: () => 'ddd card note:写法 card note <id> "<一句话进展>"。',
    noteDone: (id, field, line) => `ddd card note:${id} 的 ${field} 追加了「${line}」`,
    linkUsage: () => 'ddd card link:写法 card link <id> "<标题>" <链接>。标题只写这个链接干了什么 —— 状态词(待合 / 已合)看板会自己渲染。',
    linkDup: (id, href) => `ddd card link:${id} 上已经有这条链接了,一个字节都没写:${href}`,
    linkDone: (id, href, pr) => `ddd card link:${id} + ${href}` + (pr ? `;顺手把 PR #${pr} 写进了 pr 字段(卡头芯片只认这一档)` : ''),
    showUsage: () => 'ddd card show:写法 card show <id> [--json]。',
    showHead: (id, kind, file) => `${id}  (${kind === 'backlog' ? 'backlog' : '决策'}卡 · ${file})`,
    listEmpty: () => 'ddd card list:这组筛选下一张卡都没有。',
    listHead: () => '卡号          状态      线别  session   建卡日      标题',
    listCount: (n) => `  —— 共 ${n} 张`,
    historyUsage: () => 'ddd card history:写法 card history <id>。',
    historyUnsplit: () => 'ddd card history:这块板还没拆成一卡一文件,单张卡没有自己的文件,也就没有自己的 git 历史。要么先跑 scripts/cards-split.mjs,要么 git log -p 整份 manifest 自己翻。',
    historyFailed: (err) => `ddd card history:git log 跑不动(不是 git 仓库?):${err}`,
    historyEmpty: (id, file) => `ddd card history:${id}(${file})还没进过任何一次 commit。`,
    historyHead: (id, file) => `${id}  ${file}`,
    exportWrote: (file) => `ddd export:已写入 ${file}`,
  },
  init: {
    portCaveat: zhPortCaveat,
    scenario: {
      greenfield: 'greenfield(全新项目)',
      installed: '已初始化(有 kanban.config.json;重跑 apply = 幂等补齐机制件 + 归拢散落 demo,不覆写数据)',
      legacy: '旧版安装(有 manifest/机制件/demos 无 config;apply = 机制接管,数据零改动)',
      scattered: '散落资源(repo 内有零散 HTML,无看板)',
    },
    gitAction: {
      tracked: 'git mv(历史保留)',
      untracked: 'mv + git add(此前未入库,无历史可保)',
      'no-git': '纯 mv(无 git:无历史可保、无 commit 回退点)',
    },
    hookLabel: { stop: '旧 Stop 守卫(claude-stop-hook.mjs)', ghpr: '旧 gh-pr 看板提醒' },
    portExhausted: (start) => `自 ${start} 起探测 100 个端口全被占用,请用 --port 指定`,
    portNoteExisting: '沿用现有 kanban.config.json',
    portNoteManual: '--port 指定(未探测占用,请自行确认)',
    portNoteProbed: (start) => `自 ${start} 起探测到当下空闲位。${zhPortCaveat}`,
    mergeAbortStatus: (status, usable) =>
      `既有 decisions-manifest 的 statuses/groups 不含「${status}」;请人先用 --stub-status 指定落位状态(可选:${usable.join(' / ') || '(无)'}),本次 apply 中止。`,
    skipIdentical: (name) => `与 demos/${name} 逐字节一致(已归拢的副本?),原地保留,人工删除`,
    skipMentioned: (name) => `decisions-manifest 已提及 ${name},不再造存根卡(文件照迁)`,
    skipSiblingConflict: (name) => `同层资产 ${name} 与既有归拢目标同名,--take-assets 不覆盖,人工处理`,
    assetOutside: '引用越出 demo 所在目录,随迁会改变相对关系',
    assetMissing: '引用目标不存在(本来就断)',
    assetSharedSkipped: '被跳过候选仍引用此资产,随迁会弄断留在原地的它;去留人工裁决',
    // ---- 归拢挑选(--only/--exclude/--remember;tag = scan|plan|apply) ----
    selReasonExclude: (pat) => `--exclude 命中 ${pat}`,
    selReasonOnly: '--only 未命中',
    selNoHit: (tag, pats) => `[${tag}] ⚠ 模式未命中任何候选:${pats.join(' · ')}(核对笔误/大小写/是否 repo 相对路径且用 / 分隔;--remember 不记未命中模式)`,
    selKeep: (tag, rel) => `[${tag}] [归拢] ${rel}`,
    selSkip: (tag, rel, reason) => `[${tag}] [跳过:${reason}] ${rel}`,
    selStats: (tag, kept, skipped) => `[${tag}] 挑选统计:归拢 ${kept} 个 / 跳过 ${skipped} 个(跳过项不写卡不动文件,仍是散落态,重跑 scan 会再列出)`,
    selRemember: (tag, pats) => `[${tag}] --remember:命中模式 ${pats.join(' · ')} 将写入 config.skipScattered(此后 scan 标注[配置跳过],不再当候选)`,
    selRememberHint: (tag) => `[${tag}] 提示:长期豁免勿用 .no-card-ok(那只管已在 demos/ 内的免挂卡);散落态长期跳过用 --exclude … --remember 记入 config.skipScattered`,
    applyRemember: (n, pats) => `[apply] ± kanban.config.json(skipScattered 记入 ${n} 条:${pats.join(' · ')})`,
    scanConfigSkipped: (rel, pat) => `[scan] [配置跳过] ${rel}(kanban.config.json skipScattered 命中「${pat}」,不当候选)`,
    // ---- plan ----
    planTarget: (root) => `[plan] 目标:${root}`,
    planScenario: (label) => `[plan] 场景:${label}`,
    planVars: (brand, branch, ghRepo) =>
      `[plan] 变量:brand=${brand ?? '(缺,apply 需 --brand)'} branch=${branch || '(空)'} ghRepo=${ghRepo || '(空)'}`,
    planPort: (port, note) => `[plan] 端口:${port}(${note})`,
    planDirs: (dirs) => `[plan] 将建目录:\n${dirs.map((d) => `  + ${d}`).join('\n')}`,
    planCreates: (files) => `[plan] 将建文件(存在的一律不覆写):\n${files.map((f) => `  + ${f}`).join('\n')}`,
    planNoCreates: '[plan] 骨架文件已齐,零新建',
    planNarrativeSkip: '[plan] path-manifest.json:缺省不铺(「决策路径」标签页自动不出现);要叙事模块加 --with-narrative',
    planGitignoreMerge: (items) => `[plan] app/kanban/.gitignore 已在,将并入缺失条目(去重):${items.join(' · ')}`,
    planSettingsAdd: (items) =>
      `[plan] .claude/settings.json 将并入 permissions.deny(去重,不动其他键):\n${items.map((d) => `  + ${d}`).join('\n')}`,
    planSettingsOk: '[plan] .claude/settings.json:deny 三条已在,跳过',
    planClaudeAdd: (marker) => `[plan] CLAUDE.md 将追加节「${marker}」`,
    planClaudeOk: '[plan] CLAUDE.md:标记节已在,跳过',
    planMergeDeferred: '[plan] ⚠ 检出散落 demo 但骨架未立:本轮 apply 只铺骨架;骨架就绪后重跑 scan/plan/apply 归拢',
    planGitRepo: '[plan] git:apply 后只 add 本次触碰路径并 commit(回退点)',
    planGitNone: '[plan] git:目标非 git 仓库 —— 无历史可保、无 commit 回退点',
    planSmoke: '[plan] apply 末尾自跑 gen 冒烟 + 守卫冒烟(期望 exit 0)',
    legacyHeader: '[plan] —— 旧装接管(设计 §7 表后半)——',
    legacyDocs: (n) => `[plan] config.docs:从旧 gen.mjs 的 REF_DOCS 机械翻译提取 ${n} 条,随 config 写入`,
    legacyDocsNone: '[plan] ⚠ config.docs:旧 gen.mjs 里提取不到 REF_DOCS,置空 —— refs 文档表请人工补填 kanban.config.json',
    legacyHooks: (list) => `[plan] 摘除旧 kanban hook 注册(.claude/settings.json):${list} —— plugin hooks.json 已接管,避免双守卫;其他 hook/键原样`,
    legacyHooksNone: '[plan] 旧 hook 注册:未发现(已摘除或从未注册),跳过',
    legacyMech: (list) => `[plan] 旧机制件标记退役(不删除,人裁决):${list}`,
    legacyCards: (n, list) => `[plan] 接管遗留落 backlog 卡 ${n} 张:${list} —— 除此之外 manifest 零改动`,
    legacyCardsNone: '[plan] 接管遗留卡:已在,零新增',
    mergeHeader: '[plan] —— 散落归拢(设计 §7)——',
    mergeAbort: (msg) => `[plan] ✗ 中止条件:${msg}`,
    mergeMove: (from, to, act) => `[plan] 归拢 ${from} → ${to}(${act})`,
    mergeConflict: (from, to, act) => `[plan] 冲突 ${from} → ${to}(同名不同内容,归档人裁决;${act})`,
    mergeAsset: (from, to, act) => `[plan] 资产随迁 ${from} → ${to}(${act})`,
    mergeSibling: (from, to, act) => `[plan] 同层资产归拢(--take-assets)${from} → ${to}(${act})`,
    mergeAssetReview: (demo, ref, note) => `[plan] ⚠ 资产待裁决 ${demo} 引用「${ref}」:${note}`,
    mergeSkip: (from, reason) => `[plan] 跳过 ${from}:${reason}`,
    mergeStubs: (n, status, list) => `[plan] 存根卡 ${n} 张 → decisions-manifest(status=${status},code=id):${list}`,
    mergeStubsNone: '[plan] 存根卡:无需新增',
    mergeBroken: (n, list) => `[plan] 断链预测 ${n} 处(策略 B 只列不改写):${list}`,
    mergeBrokenNone: '[plan] 断链预测:无',
    mergeCards: (n, list) => `[plan] 遗留待办落 backlog 卡 ${n} 张:${list}`,
    mergeCardsNone: '[plan] 遗留待办卡:无需新增',
    // ---- apply ----
    applyMtimeRace: (label) => `[apply] ⚠ ${label} 自盘点后被并发修改 —— 已重读重算(mtime 乐观锁)`,
    applyStubs: (n, status) => `[apply] ± decisions-manifest.json(存根卡 ${n} 张,status=${status})`,
    applyLeftoverCards: (n) => `[apply] ± backlog-manifest.json(遗留待办卡 ${n} 张)`,
    applyGone: (from) => `[apply] ⚠ ${from} 已不在(并发挪走?),跳过`,
    applyMove: (from, to, act) => `[apply] → ${from} ⇒ ${to}(${act})`,
    applySkip: (from, reason) => `[apply] 跳过 ${from}:${reason}`,
    applyBroken: (n) => `[apply] 断链 ${n} 处按策略 B 未改写文档,已落 backlog 卡`,
    applyLegacyCards: (n) => `[apply] ± backlog-manifest.json(接管遗留卡 ${n} 张;manifest 其余零改动)`,
    applyHooksRemoved: (n, list) => `[apply] ± .claude/settings.json(摘除旧 kanban hook 注册 ${n} 条:${list})`,
    applyMechKeep: (f) => `[apply] 旧机制件保留待割接(不删除):app/kanban/${f}`,
    failSettingsJson: (rel, err) => `${rel} 已存在但不是合法 JSON,拒绝合并(绝不覆盖):${err}`,
    failNeedBrand: 'greenfield 需要 --brand(短 token,喂看板标题等 ~8 处)',
    failNeedYes: '非交互环境请加 --yes 确认执行',
    confirmPrompt: '[apply] 确认执行以上计划?[y/N] ',
    cancelled: '已取消',
    failLock: (lockPath) => `${lockPath} 已存在(另一 init 进行中?)。确认无并行 init 后删除锁重试。`,
    applyCreate: (rel) => `[apply] + ${rel}`,
    applyGitignoreMerge: (n) => `[apply] ± app/kanban/.gitignore(并入 ${n} 条,去重)`,
    applySettings: (n) => `[apply] ± .claude/settings.json(并入 deny ${n} 条)`,
    applyClaudeMd: '[apply] ± CLAUDE.md(追加 token 保护节)',
    applyGenOk: '[apply] ✓ gen 冒烟通过(index.html/shots.html/refs 已生成)',
    failGen: (err) => `gen 冒烟失败(未提交,锁已清):\n${err}`,
    failGuard: (status, err) => `守卫冒烟失败 exit ${status}:\n${err}`,
    failGuardOrphan: (out) => `守卫冒烟报孤儿 demo(不应出现):\n${out}`,
    applyGuardOk: '[apply] ✓ 守卫冒烟通过(exit 0)',
    commitMerge: (mv, cf, stubs, cards) =>
      `chore(kanban): kanban-init apply(散落归拢:demo ${mv} 迁 + 冲突归档 ${cf} + 存根卡 ${stubs} + 遗留卡 ${cards})`,
    commitLegacy: (hooks, cards) =>
      `chore(kanban): kanban-init apply(旧装接管:config 生成 + 旧 hook 摘除 ${hooks} 条 + 遗留卡 ${cards} 张;数据零改动)`,
    commitGreen: (brand, port) => `chore(kanban): kanban-init apply(greenfield 骨架,brand=${brand}, port=${port})`,
    applyCommitted: (sha) => `[apply] ✓ 已提交回退点:${sha}(只含本次触碰路径)`,
    applyNoChange: '[apply] ✓ 零变更(幂等重跑,无需提交)',
    applyNoGit: '[apply] ⚠ 目标非 git 仓库:无历史可保、无 commit 回退点,出问题只能手工回退。',
    applyMergeDeferred: '[apply] ⚠ 检出散落 demo:本轮只铺了骨架;请跑 scan/plan 审阅归拢计划后再次 apply 归拢。',
    applyDone: (port) => `[apply] 完成。端口 ${port} —— ${zhPortCaveat}`,
    applyServe: (port) => `[apply] 起看板:bash app/kanban/serve-kanban.sh(或 python3 app/kanban/serve.py ${port})`,
    // ---- scan ----
    scanTarget: (root, isRepo, branch) => `[scan] 目标:${root}${isRepo ? `(git 分支 ${branch || '?'})` : '(非 git 仓库)'}`,
    scanScenario: (label) => `[scan] 场景:${label}`,
    scanConfig: (has) => `[scan] kanban.config.json:${has ? '存在' : '不存在'}`,
    scanDemo: (rel, size, gitSt, title, assets) =>
      `[scan] demo ${rel}(${size}B,${gitSt})title=「${title || '(无)'}」 资产引用:${assets.length ? assets.map((a) => `${a.ref}${a.exists ? '' : '(缺)'}`).join(', ') : '无'}`,
    scanClaimed: (c) => `[scan] 已被 manifest/config 提及(视为已覆盖数据,不动):${c}`,
    scanFrag: (n) => `[scan] 另有 ${n} 个 .html 不含 <html(片段/模板),不当 demo 候选`,
    scanSibling: (rel, size) => `[scan] 同层非 HTML 资源(只列名不读内容):${rel}(${size}B)`,
    scanBroken: (md, ref, demo) => `[scan] 断链预测:${md} 经「${ref}」指向 ${demo}(归拢后断,策略 B 只报告不改写)`,
    scanLegacyTraces: (manifests, mech, n) =>
      `[scan] 旧安装痕迹(有 manifest/机制件但无 config):manifest=[${manifests.join(', ')}] 机制件=[${mech.join(', ')}] demos/*.html=${n} 个`,
    scanLegacyHooks: (list) => `[scan] 旧 kanban hook 注册(.claude/settings.json):${list}(apply 接管时摘除)`,
    scanHintGreen: '[scan] 未发现散落 demo,未发现旧安装 —— 可走 greenfield:plan 预览,apply 铺骨架',
    scanHintScattered: '[scan] 散落归拢流程:apply 先铺骨架 → 重跑 scan/plan 审阅 → 再 apply 归拢',
    scanHintInstalled: '[scan] 骨架已立,散落 demo 待归拢:plan 审阅合并计划 → apply 归拢',
    scanHintLegacy: '[scan] 旧装接管:plan 审阅 → apply = config 生成(docs 提取自旧 gen.mjs)+ 摘旧 hook 注册 + 遗留卡落 backlog;manifest/demos 数据零改动',
    scanSummaryHead: '[scan] 摘要 JSON:',
  },
}

const enPortCaveat = 'Port probing only avoids ports that are being listened on right now — it cannot see ports another project wrote into its config but has not started. Multi-project machines need manual port allocation (design §5).'

const en = {
  genFail: (err) =>
    `Kanban guard: gen.mjs re-run failed (most likely a manifest JSON syntax error). Please fix it before wrapping up:\n${err}`,
  stampNewer: (stamp, mine) =>
    `⚠ Kanban guard: index.html was generated by a newer ddd-gen v${stamp}, but this session's plugin is v${mine}. Regeneration is skipped so the older gen cannot overwrite newer output; the board stays as-is and recovers once the plugin is upgraded (or, if already upgraded, once the session restarts).`,
  noSelfVersion:
    () => '⚠ Kanban guard: broken plugin install (cannot read a plain-numeric version from its own plugin.json); board regeneration skipped — reinstall/upgrade the plugin.',
  healedUnstamped:
    () => 'Kanban guard: index.html carried no gen stamp (output of an old gen) — regenerated with the current version. If old long-lived sessions are still running on this machine, run the plugin\'s scripts/retire-stale-caches.mjs to cut off the source (dry-run first, --yes to apply).',
  orphanWarn: (n, list) =>
    `⚠ Kanban guard: still ${n} demo(s) not linked to any board card (letting this stop through):\n${list}`,
  orphanBlock: (n, list) =>
    `Kanban guard: found ${n} demo(s) not linked to any board card (violates the "every demo links to a card" audit rule):\n${list}\nAdd a card for each in app/kanban/decisions-manifest.json or backlog-manifest.json right away (follow the field style of existing cards); if a demo genuinely needs no card, add its filename to app/kanban/demos/.no-card-ok (one per line). No need to run gen.mjs manually — the guard regenerates automatically. Before acting, grep to verify the filename is not already in a manifest — with parallel sessions there is a card-linking race window, so this alert may already be stale.`,
  accParseFail: (err) =>
    `⚠ Kanban guard: acceptance-manifest.json could not be parsed, so the acceptance audit was skipped (the "acceptance" tab will fail on it too): ${err}`,
  accCurrentNoList: (cur) =>
    `⚠ Kanban guard: acceptance-manifest.json has current = ${cur}, but no checklist covers that PR — the acceptance tab's current panel will be empty. Add a checklist, or set current back to null.`,
  accDupPr: (pr, a, c) =>
    `⚠ Kanban guard: PR #${pr} appears in two acceptance checklists (${a} and ${c}) — the tick-off progress would split in two. Merge them into one, or change one of the pr values.`,
  accDupItem: (list, id) =>
    `⚠ Kanban guard: acceptance checklist ${list} has a duplicate item id "${id}" — tick state is stored by id, so duplicates overwrite each other. Make the ids unique.`,
  accUnknownCard: (list, id) =>
    `⚠ Kanban guard: acceptance checklist ${list} references card id "${id}" in cards, but no such card exists on the board — the chip would not go anywhere. Check the id.`,
  richLongText: (hits, total) =>
    `⚠ Kanban guard: ${total} card(s) carry a prose field over 800 characters with no detail field — keep the card body to conclusions (problem ≤ 2 sentences, approach conclusion-first, note a dated timeline) and move file-by-file evidence into detail:\n` +
    hits.map((h) => `  - ${h.id}: ${h.key} is ${h.n} characters`).join('\n'),
  respSettle: (ids, total) =>
    `⚠ Kanban guard: ${total} card(s) have all their pull requests merged but are still in a non-final status (unsettled): ${ids.join(' ')}${total > ids.length ? ` … ${total} in total` : ''}\n  Run \`node <plugin>/scripts/pr-sync.mjs --settle\` for the full list (card → suggested status), then add --write to settle them (add --only <ids> to pick some).\n  For a card that should not be settled this round (its pull request only landed half the work), put "settleHold": "reason" on it — it then leaves the list, drops its chip, and this notice stops naming it.`,
  respReopen: (ids, total) =>
    `⚠ Kanban guard: ${total} card(s) are in a final status but still have an open pull request: ${ids.join(' ')}${total > ids.length ? ` … ${total} in total` : ''}\n  Either the pull request is not merged yet (the card was settled early), or the card links a pull request that is not really its own — check it; nothing is changed for you.`,
  wipOver: (n, hard) =>
    `⚠ Kanban guard: ${n} card(s) are in the ready status, over config.wip.hard = ${hard} — more work is in flight than can be covered, and a new card only adds to the pile. Clear some first (settle what has landed, move waiting-on-others to blocked, move what is not happening soon to deferred), then add new ones.`,
  cardsDirMissing: (rel) =>
    `⚠ Kanban guard: config.cardsDir is set but the card directory ${rel} is not there — gen will fail hard and the board stays on its last version. Create the directory, or drop cardsDir from kanban.config.json.`,
  cardIdBad: (rows, total) =>
    `⚠ Kanban guard: ${total} card file(s) have a filename that does not match the id inside — the filename is the card id (one source of truth), and gen fails hard on a mismatch:\n` +
    rows.map((r) => `  - ${r.file} (its id is "${r.id}")`).join('\n'),
  cardParseBad: (rows, total) =>
    `⚠ Kanban guard: ${total} card file(s) are not valid JSON — gen will fail hard and the board stays on its last version:\n` +
    rows.map((r) => `  - ${r.file}: ${r.message}`).join('\n'),
  ghprRemindMerge:
    '[Kanban reminder] A pull request was just merged. Run `node <plugin>/scripts/pr-sync.mjs --settle`: it syncs pull requests and releases from gh into release-manifest.json, then lists the cards whose pull requests are all merged while the card is not settled, with a suggested status (printing only by default; add --write once the list looks right). While you are there, check the link titles on those cards — hand-written status words are no longer needed, the board renders the real state.',
  ghprRemind:
    '[Kanban reminder] A gh pr command just ran. If this marks a feature/phase as complete: check whether the corresponding board card status in app/kanban needs advancing (after editing a manifest, no need to run gen manually — the Stop guard regenerates automatically), and attach the pull request to the card with `node <plugin>/scripts/ddd.mjs card link <id> "<what this pull request did>" <pr-url>` (it writes the pr field too); after opening or merging a pull request, run `node <plugin>/scripts/pr-sync.mjs` to refresh release-manifest.json. Ignore if unrelated to the board.',
  prSync: {
    noRepo: () => 'pr-sync: instance.ghRepo is empty in all three manifests, so there is no repository to sync — set it to "owner/repo" in manifest.json first.',
    ghMissing: () => 'pr-sync: the gh command was not found. Install the GitHub CLI (https://cli.github.com), run `gh auth login`, then try again; nothing was written.',
    ghFailed: (what, err) => `pr-sync: ${what} failed (not logged in, no access to the repository, or no network all look like this): ${err}\nNothing was written; fix it and re-run.`,
    ghBadJson: (what, err) => `pr-sync: the output of ${what} is not valid JSON (a gh old enough to lack --json?; gh 2.x is required): ${err}\nNothing was written.`,
    manifestBad: (err) => `pr-sync: release-manifest.json exists but is not valid JSON, refusing to overwrite it (hand-written notes and prs may be in there): ${err}`,
    done: (prs, rels, added, file) => `pr-sync: ${prs} pull request(s) · ${rels} release(s) (${added} new) → ${file}`,
    dry: (prs, rels, added) => `pr-sync --dry-run: would write ${prs} pull request(s) · ${rels} release(s) (${added} new); nothing written.`,
    settleNone: () => 'pr-sync --settle: nothing to settle — every card whose pull requests are all merged is already in a final status.',
    settleHead: (n) => `pr-sync --settle: ${n} card(s) have all their pull requests merged but are not settled yet:`,
    settleRow: (id, from, to, prs) => `  ${id}  ${from} → ${to}  ${prs}`,
    settleDry: (sample) => `Dry run: nothing was written. Once the list looks right, add --write to settle — it only changes the status of these cards and, where the card kind has a timeline field (note / notes), appends one dated line to it.\n  To settle only some of them: --write --only ${sample || '<card-id>'} (comma-separated). If a card should not be settled this round at all (its pull request only landed half the work), put "settleHold": "reason" on the card and it drops out of this list.`,
    settleWrote: (n, files) => `pr-sync --settle --write: settled ${n} card(s) → ${files}`,
    settleHeld: (ids, n) => `  On hold (${n}): ${ids.join(' ')} — their pull requests are all merged too, but the cards carry settleHold (the reason shows in the grey chip on the card). They are not settled here and the guard stays quiet about them; remove the field to settle one.`,
    settleOnlyEmpty: () => 'pr-sync --settle --only: no card id given. Write it as --only BL-1 or --only BL-1,D2 (comma-separated); nothing was written.',
    settleOnlyBad: (ids) => `pr-sync --settle --only: these card ids are not in the list above, so nothing was written: ${ids.join(' ')}\n  Check them against the list; a card carrying settleHold is never in it (remove that field first if you mean to settle it).`,
    settleDryWins: () => 'pr-sync: both --dry-run and --write were given; --dry-run wins — printing only, nothing written.',
    settleReformat: (file) => `pr-sync --settle --write: ${file} is not formatted the way JSON.stringify(…, null, 2) writes it, so it is left alone (rewriting it would touch bytes of other cards). Settle those cards by hand.`,
  },
  cards: {
    alreadySplit: (dir) => `cards-split: kanban.config.json already sets cardsDir = "${dir}"; this board is already one file per card. Use cards-join.mjs to go back to single files.`,
    notSplit: () => 'cards-join: kanban.config.json has no cardsDir, so this board is still single-file — nothing to join.',
    headNoArray: (file, key) => `cards-split: ${file} has no ${key} array, so there is nothing to split — check the manifest shape first.`,
    headHasArray: (file, key) => `cards-join: ${file} already has a ${key} array (the one-source-of-truth rule is broken); clean up the header file by hand before joining.`,
    dirNotEmpty: (rel) => `cards-split: ${rel} already exists and is not empty; refusing to split into it (existing cards could be overwritten). Pick another directory name, or empty it first.`,
    idBad: (id, why) => `card id "${id}" ${why}`,
    idEmpty: () => 'is empty — every card needs an id, and the filename is it',
    idUnsafe: () => 'cannot be a filename (it contains / \\ or .. or leading/trailing whitespace)',
    idDup: (id) => `card id "${id}" appears twice — after the split both would be the same filename; rename one first`,
    orderTaken: (id) => `card "${id}" already has an "order" field — the split needs that name to record the original array index; rename the field first`,
    dirMissing: (rel) => `cards-join: the card directory ${rel} is not there (relative to the kanban directory); nothing to join`,
    parseBad: (rel, err) => `cards-join: card file ${rel} is not valid JSON, refusing to join (that card would be lost): ${err}`,
    idMismatch: (rel, id) => `cards-join: card file ${rel} does not match the id "${id}" inside it; make them agree first`,
    dryRun: (rows, total) =>
      `cards-split --dry-run: would write ${total} card file(s)\n` + rows.map((r) => `  ${r.rel}/  ${r.n}`).join('\n') + '\nNothing was written.',
    dryRunJoin: (rows, total) =>
      `cards-join --dry-run: would join ${total} card(s) back\n` + rows.map((r) => `  ${r.rel}/  ${r.n} → ${r.key} of ${r.file}`).join('\n') + '\nNothing was written.',
    genFailed: (err) => `gen.mjs failed; rolled back (the board is exactly as it was before):\n${err}`,
    diffFound: (files) => `The generated output differs before and after the split; rolled back (the board is exactly as it was before). Differing: ${files}\nByte-for-byte equality is the acceptance gate for this change — please report the difference upstream.`,
    diffFoundJoin: (files) => `The generated output differs before and after the join; rolled back (the board is exactly as it was before). Differing: ${files}`,
    splitDone: (total, rows, dir) =>
      `cards-split: ${total} card(s) → ${rows.map((r) => `${r.rel}/ ${r.n}`).join(' · ')}; the array was removed from each header file and kanban.config.json now has cardsDir = "${dir}".\n` +
      'The generated output is byte-for-byte identical to before the split (apart from the new per-card "updated" stamps). Commit the whole batch as one commit and say in the message that it is a rename.',
    joinDone: (total, files) => `cards-join: ${total} card(s) joined back into ${files}; the card files and directories are gone and cardsDir was removed from kanban.config.json. The generated output is byte-for-byte identical to before the join.`,
    baselineFailed: (err) => `Could not produce the "before" baseline (gen.mjs failed first); nothing was written:\n${err}`,
  },
  cli: {
    usage: () => `ddd — the kanban write CLI (v0.14.0, no dependencies)

  node <plugin>/scripts/ddd.mjs <command> [args] [--dir <kanban dir>] [--json]

Cards:
  card new backlog|decision [--title "…"] [--line C] [--session dev] [--from f.json]
      Create a card. The script allocates the id and reserves it exclusively (with one file per
      card it uses openSync 'wx', so whoever loses the race steps to the next number instead).
      Template placeholders are written as <…>; fill them in. Fields from --from win over them.
  card set <id> <field> <value> [--json]
      Change one field. --json parses the value as JSON (use it for arrays and objects; the
      report comes back as JSON too).
      Checked: status is one of that card kind's statuses, date looks like YYYY-MM-DD, pr looks
      like 12 / "#12" / "owner/repo#12", line is in config.lanes.ids, session is in
      config.sessionTags. Array fields such as links/shots need --json. "id" and "order" cannot
      be changed; an unrecognised field only warns.
  card status <id> <status> [--no-note]
      Change the status and append one timeline line "【date】status → …" (--no-note skips it).
  card note <id> "<text>"           append one timeline line "【date】text"
  card link <id> "<title>" <href>   append a link (href deduped); a link to this repository's
                                    pull request is written into the pr field as well
  card show <id> [--json]
  card list [--status s] [--line X] [--session Y] [--since YYYY-MM-DD] [--json]
  card history <id>                 git history of that card's file (needs one file per card)

Other:
  export [--out f.json]             one object shaped like the manifests (a backlog and a
                                    decisions section); goes to stdout unless --out is given
  pr-sync […]                       hands over to pr-sync.mjs with the arguments unchanged

Kanban directory: --dir > $CLAUDE_PROJECT_DIR/app/kanban > the current directory (if it holds a
kanban.config.json). This command never commits — git add the card files yourself.`,
    unknownFlag: (flag) => `ddd: unknown flag ${flag}. See --help; to pass it as a plain argument, put a -- in front of it.`,
    flagNeedsValue: (name) => `ddd: --${name} needs a value after it.`,
    unknownCmd: (cmd) => `ddd: unknown command "${cmd}". Available: card … / export / pr-sync; see --help.`,
    unknownCardCmd: (cmd, list) => `ddd card: unknown subcommand "${cmd}". Available: ${list.join(' / ')}; see --help.`,
    kindBad: (kind) => `ddd card new: the first argument must be backlog or decision (got "${kind}").`,
    readFailed: (what, err) => `ddd: cannot read ${what} (missing, or not valid JSON): ${err}`,
    headNoArray: (file, key) => `ddd: ${file} has no ${key} array and cardsDir is not configured — check the manifest shape first.`,
    headHasArray: (file, key, dir) => `ddd: kanban.config.json sets cardsDir = "${dir}", yet ${file} still has a ${key} array (the one-source-of-truth rule is broken). The cards live under ${dir}/; delete ${key} from the header file.`,
    dirMissing: (rel) => `ddd: the card directory ${rel} is not there (relative to the kanban directory) — gen would fail too. Create it, or drop cardsDir from kanban.config.json.`,
    cardParseBad: (rel, err) => `ddd: card file ${rel} is not valid JSON; nothing was written (gen fails on this too): ${err}`,
    cardIdMismatch: (rel, id) => `ddd: card file ${rel} does not match the id "${id}" inside it; nothing was written — the filename is the card id (one source of truth).`,
    cardNotFound: (id) => `ddd: no card "${id}" on this board. Check with card list (with one file per card, the filename is the id).`,
    orderLocked: () => 'ddd: "order" is the original array index recorded by the split (it is the display order) and the CLI will not change it. To really move a card, edit its file and say why.',
    idLocked: () => 'ddd: "id" is the card\'s identity — with one file per card it is the filename. Change it and the next gen fails hard (filename does not match the id), and the CLI refuses to run on a board with a bad card, so even the command that would change it back is locked out. To renumber a card: create a new one with card new and move the content, or stop gen and change the file and the id together by hand. Nothing was written.',
    arrayField: (field) => `ddd: ${field} is an array field and a scalar was given — gen throws a TypeError while rendering it and the whole board fails to build. Write it as --json '[…]', e.g. card set <id> ${field} --json '[]'. Nothing was written.`,
    statusBad: (v, list) => `ddd: status "${v}" is not one of this card kind's statuses. Available: ${list.join(' / ')}`,
    dateBad: (v) => `ddd: the date "${v}" is malformed; it must be YYYY-MM-DD (the board compares them as strings, so the zero padding matters).`,
    lineBad: (v, list) => `ddd: lane "${v}" is not in config.lanes.ids. Available: ${list.join(' / ')} (a card on several lanes is space-separated, e.g. "B C")`,
    sessionBad: (v, list) => `ddd: session tag "${v}" is not in config.sessionTags. Available: ${list.join(' / ')} (several tags are space-separated, e.g. "dev release")`,
    prBad: (v) => `ddd: the pr value ${v} is malformed. It must be 12 (a number in this repository) / "#12" / "owner/repo#12"; for a card spanning several, use --json '[227,230]'.`,
    unknownField: (field, kind) => `⚠ ddd: "${field}" is not a field a ${kind} card knows, and it was written anyway — the board will not render it. If it is a typo, put it right with card set.`,
    fromNotObject: (file) => `ddd --from: the top level of ${file} is not a JSON object (it should be one card's fields).`,
    valueNotJson: (err) => `ddd --json: the value is not valid JSON: ${err}\n  (remember the single quotes in a shell, e.g. --json '["a","b"]')`,
    writeFailed: (where, err) => `ddd: writing ${where} failed and the file is byte-for-byte as it was (temp file + rename, so a half-written file never lands where a card belongs): ${err}`,
    noTiers: () => 'ddd card new backlog: tiers is empty in backlog-manifest.json, and gen requires every card\'s tier to be one of them — define at least one kind of work before creating cards.',
    newExhausted: (prefix) => `ddd card new: the next 1000 "${prefix}N" after the current highest are all taken, so it stopped trying. Look for a batch of empty placeholder files in the card directory.`,
    newDone: (id, file) => `ddd card new: ${id} → ${file}\n  The <…> in the template are placeholders; fill them in with card set (at least title / problem / approach).`,
    newNoLine: () => '⚠ ddd card new: this card has no line — on a board with lanes it only shows under "all", so the default view will not show it. Set one with card set <id> line <lane>.',
    tplTitle: () => '<one line saying what this card is for>',
    tplProblem: () => '<what the user sees and why it is a problem; 2 sentences at most, no investigation notes>',
    tplApproach: () => '<what to change, where, and at what cost; conclusion first, 1-3 lines>',
    tplNote: () => '<timeline of decisions and progress, one entry per paragraph; append with ddd card note>',
    tplQuestion: () => '<what has to be decided; one line>',
    tplDecision: () => '<the call, once it is made; leave this line until then>',
    setUsage: () => 'ddd card set: card set <id> <field> <value>; add --json when the value is an array or object.',
    setDone: (id, field, value, file) => `ddd card set: ${field} of ${id} = ${value.length > 60 ? value.slice(0, 60) + '…' : value} → ${file}`,
    statusUsage: () => 'ddd card status: card status <id> <status> [--no-note].',
    statusDone: (id, from, to, noteField) => `ddd card status: ${id} ${from || '(empty)'} → ${to}` + (noteField ? `, with one timeline line appended to ${noteField}` : ' (--no-note: no timeline line)'),
    noteUsage: () => 'ddd card note: card note <id> "<one line of progress>".',
    noteDone: (id, field, line) => `ddd card note: appended "${line}" to ${field} of ${id}`,
    linkUsage: () => 'ddd card link: card link <id> "<title>" <href>. The title says what the link is; the board renders the status (open / merged) itself.',
    linkDup: (id, href) => `ddd card link: ${id} already has this link, nothing was written: ${href}`,
    linkDone: (id, href, pr) => `ddd card link: ${id} + ${href}` + (pr ? `; pull request #${pr} went into the pr field too (the chip on the card only reads that one)` : ''),
    showUsage: () => 'ddd card show: card show <id> [--json].',
    showHead: (id, kind, file) => `${id}  (${kind} card · ${file})`,
    listEmpty: () => 'ddd card list: no card matches those filters.',
    listHead: () => 'id          status    lane  session   created     title',
    listCount: (n) => `  — ${n} card(s)`,
    historyUsage: () => 'ddd card history: card history <id>.',
    historyUnsplit: () => 'ddd card history: this board is not split into one file per card, so a single card has no file of its own and no history of its own. Run scripts/cards-split.mjs first, or read git log -p over the whole manifest.',
    historyFailed: (err) => `ddd card history: git log failed (not a git repository?): ${err}`,
    historyEmpty: (id, file) => `ddd card history: ${id} (${file}) has never been part of a commit.`,
    historyHead: (id, file) => `${id}  ${file}`,
    exportWrote: (file) => `ddd export: written to ${file}`,
  },
  init: {
    portCaveat: enPortCaveat,
    scenario: {
      greenfield: 'greenfield (brand-new project)',
      installed: 'already initialized (kanban.config.json present; re-running apply = idempotently backfill mechanism files + merge scattered demos, never overwrites data)',
      legacy: 'legacy install (manifests/mechanism files/demos without config; apply = mechanism takeover, zero data changes)',
      scattered: 'scattered resources (loose HTML in the repo, no board)',
    },
    gitAction: {
      tracked: 'git mv (history preserved)',
      untracked: 'mv + git add (was never committed, no history to preserve)',
      'no-git': 'plain mv (no git: no history to preserve, no commit rollback point)',
    },
    hookLabel: { stop: 'legacy Stop guard (claude-stop-hook.mjs)', ghpr: 'legacy gh-pr kanban reminder' },
    portExhausted: (start) => `All 100 ports probed from ${start} are taken; specify one with --port`,
    portNoteExisting: 'from existing kanban.config.json',
    portNoteManual: 'given via --port (not probed, please verify yourself)',
    portNoteProbed: (start) => `probed from ${start}, free right now. ${enPortCaveat}`,
    mergeAbortStatus: (status, usable) =>
      `Existing decisions-manifest statuses/groups do not contain "${status}"; pick a landing status with --stub-status first (options: ${usable.join(' / ') || '(none)'}). This apply is aborted.`,
    skipIdentical: (name) => `byte-identical to demos/${name} (already-merged copy?), left in place — delete manually`,
    skipMentioned: (name) => `decisions-manifest already mentions ${name}; no stub card created (file still moves)`,
    skipSiblingConflict: (name) => `sibling asset ${name} collides with an existing merge target; --take-assets never overwrites — resolve manually`,
    assetOutside: 'reference escapes the demo directory; moving it would change the relative layout',
    assetMissing: 'referenced target does not exist (was already broken)',
    assetSharedSkipped: 'still referenced by a skipped candidate; moving it would break that page in place — resolve manually',
    // ---- merge selection (--only/--exclude/--remember; tag = scan|plan|apply) ----
    selReasonExclude: (pat) => `--exclude hit ${pat}`,
    selReasonOnly: 'not matched by --only',
    selNoHit: (tag, pats) => `[${tag}] ⚠ pattern(s) matched no candidate: ${pats.join(' · ')} (check typos/case/repo-relative path with / separators; --remember never records unmatched patterns)`,
    selKeep: (tag, rel) => `[${tag}] [merge] ${rel}`,
    selSkip: (tag, rel, reason) => `[${tag}] [skip: ${reason}] ${rel}`,
    selStats: (tag, kept, skipped) => `[${tag}] selection: ${kept} to merge / ${skipped} skipped (skipped items get no card and no move; still scattered — future scans will list them again)`,
    selRemember: (tag, pats) => `[${tag}] --remember: matched pattern(s) ${pats.join(' · ')} will be written to config.skipScattered (future scans mark them [config-skip] and drop them as candidates)`,
    selRememberHint: (tag) => `[${tag}] hint: .no-card-ok is not for this (it only waives cards for files already inside demos/); for a long-term scattered skip use --exclude … --remember to record config.skipScattered`,
    applyRemember: (n, pats) => `[apply] ± kanban.config.json (skipScattered += ${n}: ${pats.join(' · ')})`,
    scanConfigSkipped: (rel, pat) => `[scan] [config-skip] ${rel} (kanban.config.json skipScattered hit "${pat}", not a candidate)`,
    // ---- plan ----
    planTarget: (root) => `[plan] target: ${root}`,
    planScenario: (label) => `[plan] scenario: ${label}`,
    planVars: (brand, branch, ghRepo) =>
      `[plan] vars: brand=${brand ?? '(missing, apply needs --brand)'} branch=${branch || '(empty)'} ghRepo=${ghRepo || '(empty)'}`,
    planPort: (port, note) => `[plan] port: ${port} (${note})`,
    planDirs: (dirs) => `[plan] directories to create:\n${dirs.map((d) => `  + ${d}`).join('\n')}`,
    planCreates: (files) => `[plan] files to create (existing files are never overwritten):\n${files.map((f) => `  + ${f}`).join('\n')}`,
    planNoCreates: '[plan] skeleton complete, nothing to create',
    planNarrativeSkip: '[plan] path-manifest.json: not laid by default (the "decision path" tab simply will not appear); add --with-narrative for the narrative module',
    planGitignoreMerge: (items) => `[plan] app/kanban/.gitignore exists; missing entries will be merged in (deduped): ${items.join(' · ')}`,
    planSettingsAdd: (items) =>
      `[plan] .claude/settings.json will gain permissions.deny entries (deduped, other keys untouched):\n${items.map((d) => `  + ${d}`).join('\n')}`,
    planSettingsOk: '[plan] .claude/settings.json: all three deny entries present, skipping',
    planClaudeAdd: (marker) => `[plan] CLAUDE.md will gain section "${marker}"`,
    planClaudeOk: '[plan] CLAUDE.md: marker section present, skipping',
    planMergeDeferred: '[plan] ⚠ scattered demos found but no skeleton yet: this apply only lays the skeleton; re-run scan/plan/apply to merge once it is in place',
    planGitRepo: '[plan] git: apply will add only the paths it touched and commit (rollback point)',
    planGitNone: '[plan] git: target is not a git repo — no history to preserve, no commit rollback point',
    planSmoke: '[plan] apply ends with a gen smoke run + guard smoke run (expect exit 0)',
    legacyHeader: '[plan] —— legacy takeover (design §7, lower half) ——',
    legacyDocs: (n) => `[plan] config.docs: mechanically extracted ${n} entries from the old gen.mjs REF_DOCS, written with config`,
    legacyDocsNone: '[plan] ⚠ config.docs: no REF_DOCS extractable from the old gen.mjs, leaving empty — fill the refs doc table in kanban.config.json manually',
    legacyHooks: (list) => `[plan] removing legacy kanban hook registrations (.claude/settings.json): ${list} — plugin hooks.json has taken over, avoiding double guards; other hooks/keys untouched`,
    legacyHooksNone: '[plan] legacy hook registrations: none found (already removed or never registered), skipping',
    legacyMech: (list) => `[plan] legacy mechanism files marked for retirement (not deleted, human decides): ${list}`,
    legacyCards: (n, list) => `[plan] takeover leftovers become ${n} backlog card(s): ${list} — beyond that, manifests are untouched`,
    legacyCardsNone: '[plan] takeover leftover cards: already present, none added',
    mergeHeader: '[plan] —— scattered-demo merge (design §7) ——',
    mergeAbort: (msg) => `[plan] ✗ abort condition: ${msg}`,
    mergeMove: (from, to, act) => `[plan] merge ${from} → ${to} (${act})`,
    mergeConflict: (from, to, act) => `[plan] conflict ${from} → ${to} (same name, different content; archived for human decision; ${act})`,
    mergeAsset: (from, to, act) => `[plan] asset moves along ${from} → ${to} (${act})`,
    mergeSibling: (from, to, act) => `[plan] sibling asset merge (--take-assets) ${from} → ${to} (${act})`,
    mergeAssetReview: (demo, ref, note) => `[plan] ⚠ asset needs review: ${demo} references "${ref}": ${note}`,
    mergeSkip: (from, reason) => `[plan] skip ${from}: ${reason}`,
    mergeStubs: (n, status, list) => `[plan] ${n} stub card(s) → decisions-manifest (status=${status}, code=id): ${list}`,
    mergeStubsNone: '[plan] stub cards: none needed',
    mergeBroken: (n, list) => `[plan] ${n} predicted broken link(s) (policy B: listed, never rewritten): ${list}`,
    mergeBrokenNone: '[plan] predicted broken links: none',
    mergeCards: (n, list) => `[plan] leftovers become ${n} backlog card(s): ${list}`,
    mergeCardsNone: '[plan] leftover cards: none needed',
    // ---- apply ----
    applyMtimeRace: (label) => `[apply] ⚠ ${label} was modified concurrently since the scan — re-read and recomputed (mtime optimistic lock)`,
    applyStubs: (n, status) => `[apply] ± decisions-manifest.json (${n} stub card(s), status=${status})`,
    applyLeftoverCards: (n) => `[apply] ± backlog-manifest.json (${n} leftover card(s))`,
    applyGone: (from) => `[apply] ⚠ ${from} is gone (moved concurrently?), skipping`,
    applyMove: (from, to, act) => `[apply] → ${from} ⇒ ${to} (${act})`,
    applySkip: (from, reason) => `[apply] skip ${from}: ${reason}`,
    applyBroken: (n) => `[apply] ${n} broken link(s) left unrewritten per policy B, backlog card filed`,
    applyLegacyCards: (n) => `[apply] ± backlog-manifest.json (${n} takeover leftover card(s); manifests otherwise untouched)`,
    applyHooksRemoved: (n, list) => `[apply] ± .claude/settings.json (removed ${n} legacy kanban hook registration(s): ${list})`,
    applyMechKeep: (f) => `[apply] legacy mechanism file kept until cutover (not deleted): app/kanban/${f}`,
    failSettingsJson: (rel, err) => `${rel} exists but is not valid JSON; refusing to merge (never overwrite): ${err}`,
    failNeedBrand: 'greenfield needs --brand (a short token that feeds the board title etc., ~8 places)',
    failNeedYes: 'non-interactive environment: add --yes to confirm',
    confirmPrompt: '[apply] Execute the plan above? [y/N] ',
    cancelled: 'cancelled',
    failLock: (lockPath) => `${lockPath} already exists (another init in progress?). Verify no parallel init is running, delete the lock, and retry.`,
    applyCreate: (rel) => `[apply] + ${rel}`,
    applyGitignoreMerge: (n) => `[apply] ± app/kanban/.gitignore (merged ${n} ${n === 1 ? 'entry' : 'entries'}, deduped)`,
    applySettings: (n) => `[apply] ± .claude/settings.json (merged ${n} deny ${n === 1 ? 'entry' : 'entries'})`,
    applyClaudeMd: '[apply] ± CLAUDE.md (appended the token-protection section)',
    applyGenOk: '[apply] ✓ gen smoke passed (index.html/shots.html/refs generated)',
    failGen: (err) => `gen smoke failed (nothing committed, lock cleared):\n${err}`,
    failGuard: (status, err) => `guard smoke failed, exit ${status}:\n${err}`,
    failGuardOrphan: (out) => `guard smoke reported orphan demos (should not happen):\n${out}`,
    applyGuardOk: '[apply] ✓ guard smoke passed (exit 0)',
    commitMerge: (mv, cf, stubs, cards) =>
      `chore(kanban): kanban-init apply (scattered merge: ${mv} demo(s) moved + ${cf} conflict(s) archived + ${stubs} stub card(s) + ${cards} leftover card(s))`,
    commitLegacy: (hooks, cards) =>
      `chore(kanban): kanban-init apply (legacy takeover: config generated + ${hooks} legacy hook(s) removed + ${cards} leftover card(s); zero data changes)`,
    commitGreen: (brand, port) => `chore(kanban): kanban-init apply (greenfield skeleton, brand=${brand}, port=${port})`,
    applyCommitted: (sha) => `[apply] ✓ rollback point committed: ${sha} (only paths touched this run)`,
    applyNoChange: '[apply] ✓ zero changes (idempotent re-run, nothing to commit)',
    applyNoGit: '[apply] ⚠ target is not a git repo: no history preserved, no commit rollback point — manual rollback only.',
    applyMergeDeferred: '[apply] ⚠ scattered demos detected: only the skeleton was laid this round; run scan/plan to review the merge plan, then apply again to merge.',
    applyDone: (port) => `[apply] Done. Port ${port} — ${enPortCaveat}`,
    applyServe: (port) => `[apply] Serve the board: bash app/kanban/serve-kanban.sh (or python3 app/kanban/serve.py ${port})`,
    // ---- scan ----
    scanTarget: (root, isRepo, branch) => `[scan] target: ${root}${isRepo ? ` (git branch ${branch || '?'})` : ' (not a git repo)'}`,
    scanScenario: (label) => `[scan] scenario: ${label}`,
    scanConfig: (has) => `[scan] kanban.config.json: ${has ? 'present' : 'absent'}`,
    scanDemo: (rel, size, gitSt, title, assets) =>
      `[scan] demo ${rel} (${size}B, ${gitSt}) title="${title || '(none)'}" asset refs: ${assets.length ? assets.map((a) => `${a.ref}${a.exists ? '' : ' (missing)'}`).join(', ') : 'none'}`,
    scanClaimed: (c) => `[scan] already mentioned by a manifest/config (treated as covered data, untouched): ${c}`,
    scanFrag: (n) => `[scan] ${n} more .html file(s) without <html (fragments/templates), not demo candidates`,
    scanSibling: (rel, size) => `[scan] sibling non-HTML asset (name only, content unread): ${rel} (${size}B)`,
    scanBroken: (md, ref, demo) => `[scan] predicted broken link: ${md} via "${ref}" → ${demo} (breaks after merge; policy B: report only, never rewrite)`,
    scanLegacyTraces: (manifests, mech, n) =>
      `[scan] legacy install traces (manifests/mechanism files without config): manifests=[${manifests.join(', ')}] mech=[${mech.join(', ')}] demos/*.html=${n}`,
    scanLegacyHooks: (list) => `[scan] legacy kanban hook registrations (.claude/settings.json): ${list} (removed on takeover apply)`,
    scanHintGreen: '[scan] no scattered demos, no legacy install — greenfield path: plan to preview, apply to lay the skeleton',
    scanHintScattered: '[scan] scattered-merge flow: apply lays the skeleton first → re-run scan/plan to review → apply again to merge',
    scanHintInstalled: '[scan] skeleton in place, scattered demos pending merge: review the plan, then apply to merge',
    scanHintLegacy: '[scan] legacy takeover: review plan → apply = generate config (docs extracted from old gen.mjs) + remove legacy hook registrations + leftover backlog cards; manifest/demo data untouched',
    scanSummaryHead: '[scan] summary JSON:',
  },
}

const tables = { zh, en }

/** 直接按 lang 取表(init 用:--lang / config.lang / 'zh')。未知 lang 回落 zh。 */
export function pickStrings(lang) {
  return tables[lang] ?? tables.zh
}

/** @param {string} kanbanDir 看板目录(detect() 的返回值) */
export function loadStrings(kanbanDir) {
  let lang = 'zh'
  try {
    const cfg = JSON.parse(readFileSync(join(kanbanDir, 'kanban.config.json'), 'utf8'))
    if (typeof cfg.lang === 'string' && tables[cfg.lang]) lang = cfg.lang
  } catch {}
  return tables[lang]
}

// ---- gen 硬失败文案(gen.mjs 专用)----
// gen 读到 kanban.config.json 后按 config.lang 选表(genStrings);读 config **之前**的少数硬失败
// 在 gen.mjs 内用中英合排字面量(那时还不知道 lang)。守卫把 gen 的 stderr 原样喂回,故须双语。
// 动态值(out/type/category/lanes)由调用方先 JSON.stringify,保 zh 输出与历史逐字节一致。
const genZh = {
  cfgMissingBrand: () => 'kanban.config.json 缺 brand',
  docMissing: (where, k) => `${where} 缺 ${k}`,
  docOutNotBasename: (where, out) => `${where} out 须是纯文件名,不得含路径分隔符或 ..:${out}`,
  docUnknownType: (where, type) => `${where} 未知 type ${type};省略 = markdown 渲染,"html" = 自包含 HTML 指南原样复制`,
  docHtmlUnreadable: (where, path) => `${where} type:"html" 但 path 读不到(相对 repo 根):${path}`,
  docHtmlNotPage: (where) => `${where} type:"html" 但内容不含 <html —— 不是自包含完整页面(片段/模板不收)`,
  docMissingBaseDir: (where) => `${where} 缺 baseDir(可为 "" = repo 根)`,
  docBadCategory: (where, cat, cats) => `${where} category 非法:${cat};合法值:${cats}`,
  docOutConflict: (out, a, b) => `kanban.config.json docs out 同名冲突:${out}(${a} 与 ${b})—— refs/ 下互相覆盖`,
  taskUnknownIteration: (id, iter) => `task ${id} 引用未知迭代 ${iter}`,
  taskUnknownStatus: (id, s) => `task ${id} 未知状态 ${s}`,
  blUnknownStatus: (id, s) => `backlog ${id} 未知状态 ${s}`,
  blStatusNotInGroups: (id, s) => `backlog ${id} 状态 ${s} 不在 groups`,
  blUnknownTier: (id, t) => `backlog ${id} 未知 tier ${t}`,
  blUnknownPriority: (id, p) => `backlog ${id} 未知优先级 ${p}`,
  decUnknownStatus: (id, s) => `decision ${id} 未知状态 ${s}`,
  decUnknownClosedKind: (id, k) => `decision ${id} 未知 closedKind ${k}`,
  decClosedKindNeedsClosed: (id) => `decision ${id} closedKind 只配 closed 状态`,
  decStatusNotInGroups: (id, s) => `decision ${id} 状态 ${s} 不在 groups`,
  decMissingCode: (id) => `decisions-manifest entry ${id} 缺 code 字段`,
  themeNotFile: () => 'theme.css 不是文件(是目录?)—— 换装源须是普通文件',
  themeHasCloseTag: () => 'theme.css 不得含 </style>(内联注入会被截断)',
  unknownToken: (n) => `未知主题令牌 ${n}`,
  unknownRefToken: (n) => `未知 refs 主题令牌 ${n}`,
  lanesInvalid: (v) => `kanban.config.json lanes 非法:${v};合法值:null 或对象 { "ids": [...], ... }(见 kanban-init SKILL)`,
  accManifestMissing: (err) => `kanban.config.json 开了 acceptanceTab,但看板目录的 acceptance-manifest.json 读不到或不是合法 JSON:${err}(模板见 plugin templates/manifests/acceptance-manifest.json;不想开就把 acceptanceTab 去掉)`,
  relManifestMissing: (err) => `kanban.config.json 开了 releaseTab,但看板目录的 release-manifest.json 读不到或不是合法 JSON:${err}(模板见 plugin templates/manifests/release-manifest.json,内容由 scripts/pr-sync.mjs 填;不想开就把 releaseTab 去掉)`,
  relStagesNoDev: () => 'release-manifest.json 的 stages 里没有 id 为 "dev" 的段:dev(开着的 PR)是必备段,宿主可以只列两段但不能省掉 dev(缺 test = 合了即发,是允许的)',
  cardsDirHeadHasItems: (file, key, dir) => `kanban.config.json 配了 cardsDir = "${dir}"(一卡一文件),${file} 里却还留着 ${key} 数组 —— 两处都能写的字段迟早对不上。卡的真源是 ${dir}/ 下的文件,把头文件的 ${key} 删掉(或跑 scripts/cards-join.mjs 合回单文件并去掉 cardsDir)`,
  cardsDirMissing: (rel) => `kanban.config.json 配了 cardsDir,但卡目录 ${rel} 不在(相对看板目录)—— 建目录并把卡放进去,或把 cardsDir 去掉退回单文件形制`,
  cardParseFail: (rel, err) => `卡文件 ${rel} 不是合法 JSON:${err}`,
  cardIdMismatch: (rel, id) => `卡文件 ${rel} 的文件名与卡里的 id「${id}」对不上 —— 文件名就是卡号(一个真源),改文件名或改 id`,
  cardDupId: (id, a, z) => `卡 id「${id}」出现了两次:${a} 与 ${z} —— 深链、截图廊归组、懒加载定位全按 id 走,重复即互相顶掉`,
}
const genEn = {
  cfgMissingBrand: () => 'kanban.config.json is missing "brand"',
  docMissing: (where, k) => `${where} is missing ${k}`,
  docOutNotBasename: (where, out) => `${where} "out" must be a bare filename, no path separators or ..: ${out}`,
  docUnknownType: (where, type) => `${where} unknown type ${type}; omit for markdown rendering, "html" copies a self-contained HTML guide verbatim`,
  docHtmlUnreadable: (where, path) => `${where} has type:"html" but its path is unreadable (relative to the repo root): ${path}`,
  docHtmlNotPage: (where) => `${where} has type:"html" but the content has no <html>, so it is not a self-contained page (fragments and templates are rejected)`,
  docMissingBaseDir: (where) => `${where} is missing baseDir (may be "" for the repo root)`,
  docBadCategory: (where, cat, cats) => `${where} has an invalid category: ${cat}; valid values: ${cats}`,
  docOutConflict: (out, a, b) => `kanban.config.json docs "out" collision: ${out} (${a} vs ${b}); the copies would overwrite each other under refs/`,
  taskUnknownIteration: (id, iter) => `task ${id} references unknown iteration ${iter}`,
  taskUnknownStatus: (id, s) => `task ${id} has unknown status ${s}`,
  blUnknownStatus: (id, s) => `backlog ${id} has unknown status ${s}`,
  blStatusNotInGroups: (id, s) => `backlog ${id} status ${s} is not in groups`,
  blUnknownTier: (id, t) => `backlog ${id} has unknown tier ${t}`,
  blUnknownPriority: (id, p) => `backlog ${id} has unknown priority ${p}`,
  decUnknownStatus: (id, s) => `decision ${id} has unknown status ${s}`,
  decUnknownClosedKind: (id, k) => `decision ${id} has unknown closedKind ${k}`,
  decClosedKindNeedsClosed: (id) => `decision ${id} closedKind requires status "closed"`,
  decStatusNotInGroups: (id, s) => `decision ${id} status ${s} is not in groups`,
  decMissingCode: (id) => `decisions-manifest entry ${id} is missing the code field`,
  themeNotFile: () => 'theme.css is not a regular file (a directory?); the theme source must be a plain file',
  themeHasCloseTag: () => 'theme.css must not contain </style> (inline injection would be truncated)',
  unknownToken: (n) => `unknown theme token ${n}`,
  unknownRefToken: (n) => `unknown refs theme token ${n}`,
  lanesInvalid: (v) => `kanban.config.json lanes is invalid: ${v}; valid values: null, or an object { "ids": [...], ... } (see the kanban-init skill)`,
  accManifestMissing: (err) => `kanban.config.json enables acceptanceTab, but the board's acceptance-manifest.json is unreadable or not valid JSON: ${err} (template: the plugin's templates/manifests/acceptance-manifest.json; drop acceptanceTab to turn the tab off)`,
  relManifestMissing: (err) => `kanban.config.json enables releaseTab, but the board's release-manifest.json is unreadable or not valid JSON: ${err} (template: the plugin's templates/manifests/release-manifest.json, filled in by scripts/pr-sync.mjs; drop releaseTab to turn the tab off)`,
  relStagesNoDev: () => 'release-manifest.json has no stage with id "dev": dev (open pull requests) is required. A board may list only two stages, but not drop dev (dropping test — "merged means shipped" — is fine)',
  cardsDirHeadHasItems: (file, key, dir) => `kanban.config.json sets cardsDir = "${dir}" (one file per card), yet ${file} still has a ${key} array — two writable places for the same field drift apart sooner or later. The cards live under ${dir}/; delete ${key} from the header file (or run scripts/cards-join.mjs to go back to single files and drop cardsDir)`,
  cardsDirMissing: (rel) => `kanban.config.json sets cardsDir, but the card directory ${rel} is not there (relative to the kanban directory) — create it and put the cards in, or drop cardsDir to stay on single-file manifests`,
  cardParseFail: (rel, err) => `card file ${rel} is not valid JSON: ${err}`,
  cardIdMismatch: (rel, id) => `card file ${rel} does not match the id "${id}" inside it — the filename is the card id (one source of truth); rename the file or change the id`,
  cardDupId: (id, a, z) => `card id "${id}" appears twice: ${a} and ${z} — deep links, screenshot grouping and lazy-pane routing all work by id, so duplicates shadow each other`,
}
export function genStrings(lang) { return lang === 'en' ? genEn : genZh }
