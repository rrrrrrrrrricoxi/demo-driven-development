---
name: kanban-init
description: Set up or adopt the demo-driven kanban in a project — greenfield scaffolding, brownfield merge of scattered demos, or takeover of a legacy hand-rolled install (旧装接管). Use when initializing (init) or embedding (嵌入) the kanban (看板) into a new or existing project, migrating an older in-repo kanban to the plugin, wiring manifests / serve.py / settings deny rules / the CLAUDE.md section, or re-running after a plugin upgrade (idempotent). Enforces the init-phase token rules — inventory via script summary, never read demo bodies or generated html.
---

# kanban-init —— 脚手架 + 兼容合并 + 旧装接管

把看板机制种入项目。**机制归 plugin、数据归项目**:init 只敢动机制,绝不覆写数据。
执行器是确定性脚本 `${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs`(零依赖);Claude 只负责跑它、读摘要、陪人审计划——确定性的活儿全部下沉给脚本。

## 前置:plugin 两步启用(缺一不可)

1. `/plugin marketplace add <org>/demo-driven-development --scope project`(或项目 settings 写 `extraKnownMarketplaces`)——没有这步,协作者拿不到 marketplace;
2. `/plugin install demo-driven-development@demo-driven-development --scope project` —— 写入项目 enabledPlugins,守卫双 hook 随装生效。

## 三段式:scan → plan → 人审 → apply

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs scan  --dir <projectRoot>
node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs plan  --dir <projectRoot> --brand X [--lang zh|en] [--port N] [--with-narrative] [--take-assets] [--only <路径|glob,…> | --exclude <路径|glob,…> [--remember]]
node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs apply --dir <projectRoot> <同 plan 参数> --yes
```

1. **scan(只读盘点)**:场景判定 + 散落 demo 摘要(文件名 / `<title>` / 大小 / git 状态 / 资产引用,**不含正文**)+ 旧装痕迹(manifest、机制件、settings 旧 hook 注册)。散落候选三过滤:`_` 前缀 = 探针/草稿、含 package.json 的子目录 = 应用源码、manifest / config 已提及 = 已覆盖数据(守卫同口径——挪走反而弄断链接;config.docs 登记的 `type:"html"` 指南同此)。
2. **plan(只读计划)**:将建文件、settings deny 增量、CLAUDE.md 注入、归拢清单(git 策略逐文件)、接管动作、遗留卡预分配 id。**把 plan 原样给人审,拿到确认才 apply。**
3. **apply(动手,幂等)**:全程持 `app/kanban/.init-lock`(守卫见锁放行本轮);先写卡后 mv(孤儿窗口压为零);末尾自跑 gen + 守卫双冒烟;git 只 add 本次触碰路径并提交回退点。重跑 apply = 零变更。

## 三种进场景

**greenfield(全新项目)**:无 config、无散落、无旧装。apply 从 templates 铺骨架(config + 三 manifest + demos/ + shots/ + .no-card-ok + 看板侧 .gitignore + serve.py + serve-kanban.sh;path-manifest 叙事模块缺省不铺——对应标签页自动不出现,要就加 `--with-narrative`,已有该文件则原样尊重),settings 并入三条 deny(生成物不读),CLAUDE.md 追加 token 保护节。需要 `--brand`(喂看板标题等 ~8 处);端口缺省自 8898 探测当下空闲位——探测避不开「别的项目 config 里写了但没起」的端口,同机多项目需人工分配。

**散落资源(brownfield)**:repo 里有零散 demo、无看板。流程两轮:第一轮 apply 只铺骨架(manifest 是存根卡落点,骨架先立);重跑 scan/plan 审归拢计划,再次 apply 归拢——tracked → `git mv`、untracked → mv + git add、无 git 仓库明示「无历史可保、无回退点」;同名冲突不覆盖、改名 `.vN` 归档人裁决;demo 引用的兄弟资产随迁;同层非 HTML 资源(如 .xlsx)缺省只列名不动,`--take-assets` 才随归拢一起迁(同名不覆盖);md 断链只报告不改写(策略 B);每个归拢 demo 落最小存根卡(id + code + 标题 + 日期 + demo 链接 + status);断链/冲突自动落 backlog 遗留卡——报告会被冲走,卡不会丢。

**归拢挑选(--only / --exclude)**:候选不都该进看板——⚠ **应用页面勿归拢**:产品本体 HTML(如 webapp/app.html 这类被应用直接 serve 的页面)含 `<html` 就会被当 demo 候选,一锅端 `git mv` 进 demos/ 会弄断项目自己的 serve 路径。归拢前先看 plan,把这类页面用 `--exclude` 挡在外面。两旗互斥、scan/plan/apply 通吃:`--only <逗号分隔相对路径|glob>` 只归拢命中的,`--exclude <同格式>` 跳过命中的(glob 支持 `*` 不跨 `/`、`**` 跨;匹配 repo 相对路径——`/` 分隔、大小写敏感,前缀 `./` 自动剥)。plan 给每个候选标注 [归拢] / [跳过:…] 并单独一行跳过统计;一个候选都没命中的模式单独 ⚠ 警告——笔误/大小写错若静默失效,应用页就被误搬,见警告必查。被跳过的候选**不写存根卡不动文件**,仍是散落态——重跑 scan 会再列出(诚实口径);被跳过候选(挑选跳过或配置豁免)仍引用的资产不自动随迁,列入人工裁决行——页留资产走会弄断留在原地的页。长期豁免加 `--remember`(仅与 `--exclude` 同用):apply 时把真命中候选的模式写入 config 新键 `skipScattered:[]`,此后 scan 标注[配置跳过]、不再当候选;`skipScattered` 在候选盘点阶段先裁,`--only`/`--exclude` 只在剩余候选里挑——`--only` 召不回配置跳过的路径,要召回先从 config 删该模式。注意 `.no-card-ok` 管不到这——那只豁免「已在 demos/ 内的免挂卡」。

**旧版安装(legacy,机制接管)**:有 manifest/机制件/demos、无 config(= 项目里手工长出的旧看板)。apply = ①生成 config——docs 从旧 gen.mjs 的 REF_DOCS 机械翻译提取,`--brand` 按旧板实况给(要线别 UI 则接管后手工在 config 补 `lanes` 对象,见「线别」节);②settings.json 摘除旧 kanban hook 注册(只认 claude-stop-hook / 「看板提醒」两枚标记,其他 hook 与键一律原样),deny 三条缺则补齐;③旧机制件(gen/守卫/serve)**不删除**——自动落「割接清理」+「backnav 换章」两张 backlog 卡,退役与换章由人在割接后单独 PR。**数据合同:四 manifest 只允许 backlog 追加(卡 + `tiers."0"` 词汇),demos 与其余 manifest 逐字节不动。**

已初始化(有 config)时重跑 apply = 幂等补齐机制件 + 归拢新散落,是「升级 plugin 后重跑 init」的安全日常操作。

v0.2 起 config.docs[] 支持可选 `desc`(一句话定位,文档库 Hub 卡片第二行)与 `order`(阅读动线序号,点开计已读);顶层可选 `docSegments`(category→地基/流程/操作/存档 段名覆盖映射,缺省映射见 templates/kanban.config.json 的 $comment)。都可后补,缺省不渲染对应 UI。

## 项目换装(v0.4.0)

看板配色/字体的项目级替换,两个旋钮,全部可选、不启用则**生成物逐字节不变**:

1. **theme.css(CSS 侧)**:看板目录放 `theme.css`(与 kanban.config.json 同层)→ gen 把它原样内联为三种页面(index.html / refs/*.html / shots.html)head 的**最后一个 `<style>`**,盖过前面所有规则;同时生成器改走 var() 间接层,原字面量成为 `:root` 缺省 —— 主题只覆盖变量,不必重写规则。模板(带全变量清单与注释)抄 `templates/theme.css.example`。注意两套 :root 命名不同:主看板用 `--ink/--card/--line/--mut` 族 + v0.4.0 换装令牌,refs/shots 用 `--panel/--text/--border/--muted` 族。theme.css 里不得出现字面的 style 闭合标签(gen 报错,大小写与 `</style`+空白/斜杠变体均拦)。须是非空普通文件:空/纯空白 = 视同未换装(warn,输出仍逐字节冻结),是目录则报错。
2. **config.themeColors(JS 侧)**:状态/优先级/tier/文档段六套语义色以 `style="--c:…"` 烤进 HTML 属性,样式表盖不住,走 config 顶层键 `themeColors` 浅覆盖(键限 STATUS_COLOR / BL_STATUS_COLOR / PRI_COLOR / TIER_COLOR / DEC_STATUS_COLOR / DOC_SEGMENTS;格式见 templates/kanban.config.json 的 $comment 与 theme.css.example 文末)。这些色值注入属性前会过 HTML 转义(引号逃逸被堵),纯 hex 不受影响。

**存量项目迁移路径**:升级 plugin 后什么都不做 = 输出逐字节不变(可用 regen + cmp/shasum 自证);要换装时在看板目录建 theme.css(从 example 起步)→ 重跑 gen → 三种页面即换肤,config 可以完全不动;JS 注入色不满意再补 themeColors。守卫重生成天然保留换装(theme.css / config 都是项目文件,gen 只读它们)。demos 返回栏(backnav)不在换装范围 —— 动它会 churn 全体 demo 文件,留待将来 BACKNAV_VER bump 一并换。

## 独立 HTML 指南归档(v0.4.0)

看板认三种物料:demo(demos/)、markdown 文档(→ refs/ 渲染)、以及**自包含 HTML 指南**(如某个用独立端口活 serve 的 onboarding 走查页)。第三种在 config.docs[] 登记 `type:"html"` 归档,**迁入 + 链出双轨并用**:

- **迁入 = 复制托管,不是搬家**:gen 把 `path`(repo 相对)**原样复制**到 `refs/<out>` —— 不做 md 渲染、不注返回栏、不改一个字节;每次重生成重新复制 = 副本自动跟源。**勿 `git mv` 活 serve 的文件进看板** —— 源文件留原地,活 serve 不断,这正是「复制而非移动」的理由。
- **链出 = liveUrl(可选)**:文档库卡片加一枚「live ↗」小徽标,新 tab 直达活实例。副本保证看板自足(离线/异机可看),liveUrl 保证看到的是活的 —— 两轨各管一头。
- **卡片字段全兼容**:title / desc / category(→四段)/ order / line 同 md 条目;点卡片开 refs/ 副本;`baseDir` 可省(不走 md 渲染用不上)。
- **校验**:path 须存在且含 `<html`(片段/模板报错);>2MB 警告(考虑瘦身或只留 liveUrl 链出);out 与其它条目同名报错(refs/ 下互相覆盖)。
- 登记进 config.docs 的 html 被 scan 视为已覆盖,不再当散落 demo 候选;未启用 `type:"html"`/`liveUrl` 的存量安装,生成物逐字节不变。

## session 权责标签(v0.5.0)

一个项目多个 Claude session 并行(如 dev 产品开发线 / release 发版线 / ops 上线线)时,给看板卡标权责归属。**机制归 plugin、数据归项目**,全部可选、不启用则**生成物逐字节不变**:

1. **config.sessionTags(顶层,可选、保插入序)**:`{ "dev": {"label":"dev","desc":"产品开发线","color":"#3b82c4"}, "release": {...}, "ops": {...} }`。`label` 缺省用 id,`desc` 可选(章/chip 的 hover 提示),`color` 可选 —— 缺省从一个安静的内置轮换色板按序取(低饱和,不跟数据抢戏)。空对象 `{}` = 视同不存在。
2. **卡片挂标**:`decisions-manifest` / `backlog-manifest` 的卡片条目加可选 `"session"` 字段 = 空格分隔的标签 id,可多标(沿文档库 `line` 字段 `"B C"` 先例),例 `"session": "dev release"`。
3. **gen 渲染**:①卡上小章(安静低饱和,贴现有 rtag/bbadge chip 习语);②决策/Backlog 工具条各加一组筛选 chips(带计数,交互/持久化/ARIA 沿线别 dchips 习语,localStorage key 走看板 slug 前缀:`<slug>_dec_sess` / `<slug>_bl_sess`);③语义:「全部」显示一切,选中某标签只显示 session 含该标签的卡,未标卡在具体标签视图下隐去;④与线别滑块 / 搜索 / 时间 / 状态 / 维度是**交集**组合,互不打架。
4. **健壮性**:卡上出现 config 未定义的标签 id → gen 打印警告并按**灰章**渲染(不崩、不进筛选 chips);标签 label 过 `esc()` 防注入。

**字节冻结**:config 无 `sessionTags`(或空对象)时,index.html / refs/** / shots.html 输出与 v0.4.0 逐字节一致。验收沿既有模式:把看板整目录拷到 scratch,分别用已装 0.4.0 缓存 gen 与本版 gen 各跑一遍,`cmp` index/shots + 逐文件 `shasum` refs。

## 版本戳与旧版退役(v0.6.0)

gen 在 index.html 第二行烙 `<!-- ddd-gen vX.Y.Z -->`(守卫据此自愈「旧版 session 盖板」、拒绝降级覆盖;背景与设计见 stop-hook.mjs / lib-version.mjs 头注释)。两条随之更新的口径:

- **等价验收**:升版后戳行是**预期的唯一一行 index.html diff**;cmp/shasum 前先归一化(`sed '/<!-- ddd-gen v/d'`),归一化后仍须逐字节一致。
- **升级后扑灭存量**:升级 plugin 后、**在新起的 session 里**跑一次 `node ${CLAUDE_PLUGIN_ROOT}/scripts/retire-stale-caches.mjs`(dry-run 先看,`--yes` 落盘;旧 session 的 `CLAUDE_PLUGIN_ROOT` 指旧版目录,里面没有这脚本),给被取代的旧版本缓存写拒执行 shim——否则活着的旧版长寿 session 仍会拿旧 gen 反复盖板(版本戳只能事后自愈,shim 才能断火源);shim 后旧 session 收工会收到「请重启」提示。脚本自动跳过**仍被任何项目注册在用**的版本(那些项目先升级,或显式 `--include-registered`)与软链版本目录,dry-run 会列出各版本的活会话标记。
- **存量产物的一次性自愈 churn**:凡 v0.6.0 前生成的无戳 index.html(存量 worktree、checkout 旧分支、bisect),该处首次收工会自愈重生成(index 全量重写 + demos backnav 升到当前版),即使 manifest 一字未改——属预期一次性 diff,建议单独 commit 或 `git checkout -- app/kanban` 丢弃、以主干重生成产物为准。
- **人向排障**:产物戳异常偏高(手改/坏合并)时,删 `app/kanban/index.html` 再收工即全新重生成;或按 gen 报错里的产物版本显式传 `--force-downgrade=<该版本>`(human-only,勿让 agent 代跑)。

## 线别(lanes,v0.8.0:config 驱动)

多数项目用不到;一个看板要把卡分成几条**平行时间线/纪元**(如 A 归档 / B 历史 / C 当前)时开启。`config.lanes` 缺省 `null`(关);开启给一个对象:

```json
"lanes": {
  "ids": ["A", "B", "C"],
  "default": "C",
  "titles": { "A": "A · 归档", "B": "B · 历史", "C": "C · 当前" },
  "typeLabels": { "D": "决策", "Q": "疑问" },
  "hints": { "C": "当前 live …", "B": "已被 C 取代 …" },
  "hubSuffix": " · C 工作区",
  "blSess": "B 线遗留 + C 线新增"
}
```

- **归属靠显式 `line`**:每条卡(decisions / backlog / tasks / iterations / 文档库 docs)加 `"line"` 字段声明所属线,空格分隔可多线共享(如 `"line": "B C"`)。无 `line` 的卡只在「全部」视图出现。**没有隐式启发式**——线别是数据自描述的,这也是可审计性的来源。
- **UI**:`ids` 派生决策/Backlog 工具条的线别分段 + 文档库线别 chips;`titles` 是各线标签;`typeLabels` 给类型下拉加中文后缀;`hints` 是各线一段说明(选中该线时显示,值按可信 HTML 原样注入);`hubSuffix` 接在品牌名后作工作区标题;`blSess` 是 Backlog 顶的一句线别注记。
- **字节冻结**:`lanes` 为 `null`(或缺省)时,输出与未开线别逐字节一致。
- **弃用别名**:旧字符串形式 `"lanes": "lamos-legacy"` 仍被接受(= 最小 A/B/C 默认 + 弃用警告),将在下一版移除;存量看板请改为对象形式,并给各卡补显式 `line`。

## 明暗模式(darkMode,v0.9.0:opt-in)

`config.darkMode` 缺省关;设 `true` 后看板(index / 文档页 / 截图廊)获得暗夜模式:默认跟随系统
`prefers-color-scheme`,顶栏多一个 ☾/☀ 手动切换钮(记忆手选、盖过系统,三类页面共享偏好)。
实现是每个色值烤成 CSS `light-dark(浅,深)`(连逐卡内联状态色也随主题变),深色是一套暖 pastel
(暖炭底 #242220,强调色压饱和),需现代浏览器(2024+)。**字节冻结**:不配或 `false` 时输出逐字节不变。

## init 段 token 硬规则(命令式,不是建议)

- **盘点走 `init.mjs scan` 摘要,禁读 demo 正文**:几十个 demo 的正文是几十万 token,摘要只有几十行。脚本读正文不算成本,Claude 亲手读才算。
- **永不读生成物**(index.html / shots.html / refs/**,含各类 *.baseline*):校验一律 cmp / shasum / grep / jq;refs 用逐文件 shasum 比对(diff/ls 这类命令会被 deny 规则按路径误伤)。
- **归拢 / mv / 写存根 / 摘 hook 由 `--apply` 一次批量完成**:N 次工具调用压成 1 次,不逐个手搬。
- **补卡内容不在 init 会话做**:存根卡只落最小骨架,正文后续按需补——认知开销挪出这次一次性动作。
- **manifest 不整读**:jq 点查/聚合;等价校验先 `shasum app/kanban/*.json` 固化指纹,apply 后逐处解释差异。
- **机械段派便宜模型 sub agent**:确定性搬运判断少,单价降档(现行策略:默认 opus,关键判断才上更贵档)。

## dogfood 注意事项(2026-07 首宿主实测)

- **割接前勿在真项目预放 kanban.config.json**:config 在场即判「已初始化」,apply 走幂等补齐而不是接管——旧 hook 摘不掉,双守卫并存。试装/演练一律在快照副本上跑。
- **接管后的等价复验口径**:gen 重生成后,index.html 与接管前的差异应**仅**来自新增 backlog 卡(几行计数 chip + 一段新卡插入,diff hunk 可数);shots.html 逐字节一致、refs 逐文件 shasum 一致、demos 全量 shasum 一致、守卫 exit 0、重跑 apply 零变更。多出来的差异必须逐条解释,解释不了就是接管不干净。
- **探针/草稿命名走 `_` 前缀**:天然不进散落盘点,免得反复人工排除。
- **serve.py 单独在场不算旧装信号**(它本来就是模板种入件);旧装判定看 gen.mjs / claude-stop-hook.mjs 这类核心旧件。

完整讲解见 plugin 根的 `TOKEN-ECONOMY.md`;日常流程约定(①设计+demo → ★评审 → ②代码 → ③验证 → ④PR)见 `/demo-driven-development:ddd-workflow`。
