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

**卡片可选字段(v0.12.0)**:三类卡(进度 task / backlog / 决策)都可加 `pr` —— `230`(本仓,仓取 `instance.ghRepo`)、`[227, 230]`(一张卡跨几个 PR)、`"owner/repo#4"`(跨仓)。卡头长出一枚安静的 PR 芯片;有 `release-manifest.json` 时芯片带状态后缀(开着 / 草稿 / 已合 08-26 / 已发 v0.0.3 / 已关闭)。卡上没写这个字段 = 输出逐字节不变 —— `links[]` 里指向本仓 `/pull/N` 的链接**不会**自作主张长芯片(存量看板一升级就长满芯片,那是伤信任的),但它算进「PR ↔ 卡」的反查集合。

**卡片可选字段(v0.13.1)**:三类卡都可加 `settleHold`(一句话理由,如 `"这一轮 PR 只落了接口,正主还在下一轮"`)。写了它的卡:不出「PR 已合 · 待收账」/「已收账但 PR 未合」芯片,不进「发布进度」的待收账段,收工守卫不点名,`pr-sync --settle` 把它单列成「已 hold」一行且 `--write` 不碰它;卡头改出一枚安静的灰芯片「暂不收账」,理由挂在 title 上。**「PR 合了」不等于「卡能收」** —— 一张卡跨几轮 PR 是常态,这个字段是让人把那句判断写进数据,而不是每周重新做一遍。要收账时删掉字段即可(它不会自己过期)。只在 `release-manifest.json` 在场时有意义;缺省 = 输出逐字节不变。

**卡片可选字段(v0.13.0)**:三类卡都可加 `detail`(长查证 / 逐文件证据,渲染成卡最下面一个默认折叠的「查证细节」块)。只在 `config.richText` 开着时渲染;缺省 = 输出逐字节不变。见下文「卡正文轻 markdown」。

**卡片可选字段(v0.11.4)**:决策卡与 backlog 卡可加 `shots`(现场截图,`["x.png"]` 或 `[{file,caption}]`;纯文件名默认取 `shots/` 下,文件名以卡号打头可与截图廊自动归组),backlog 卡可加 `repro`(复现流程,字符串或步骤数组)。两者都缺省 = 输出逐字节不变。

**存续纪律(v0.11.3)**:init 之后,新写的 spec / 评审稿 / 实施 plan / 交接档 / 运维手册要在**落盘的同一次提交**里进 `config.docs[]` —— 与「demo 必挂卡」同源:产出必须可被发现。详见 ddd-workflow SKILL 第 1 步。

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

## 「验收」tab(acceptanceTab,v0.12.0:opt-in)

`config.acceptanceTab` 缺省关;设 `true` 后看板多一个「验收」tab,清单源是看板目录的 `acceptance-manifest.json`
(**开了这个键就必须有这个文件**,读不到 = 硬报错;缺省/`false` 时即使文件在场也不读,保字节冻结)。模板见 plugin 的
`templates/manifests/acceptance-manifest.json`。

- **一份清单对应一个或多个 PR**:`pr`(数字或数组)、`title`、`revision`(缺省 1)、`env{url,backend,branch,commit,accounts,notes[]}`、
  `rounds[{id,label,date}]`、`groups[{id,title,tip}]`、`items[{id,group,pr?,round?,key?,title,do,data?[],exp,bad?,why?}]`、
  `data{key:{title,rows}}`(rows 是二维数组,首行表头,页面渲染成表并可一键复制成 TSV)、`result?{checked[],at}`、`cards?[]`。
- **`current`** = 正在验收的那个 PR 号(`null` = 没有,合法);它那份清单展开置顶,其余折叠进「排队中 / 已验收」。
- **勾选存这台浏览器**(`localStorage`,键含 PR 串与 `revision`)。清单正文改了就把 `revision` 加一 —— 旧勾选当场作废,
  这是「上一轮的勾不算数」的诚实写法。「复制勾选结果」按钮产出 `{"checked":[…],"at":"…"}`,人贴回清单的 `result` 才进 git;
  gen 读 `result` 烤成预勾选初值。
- **条目正文**只认 `**粗体**` 与换行,其余一律转义 —— 清单是人写的正文,不是可信 HTML。
- **守卫**会为四种坏数据各出一条非阻断 notice:`current` 没有清单覆盖、同一 PR 落进两份清单、条目 id 重复、`cards` 引用不存在的卡号。
- **字节冻结**:不配或 `false` 时输出逐字节不变。

## 「发布进度」tab(releaseTab + pr-sync,v0.12.0:opt-in)

`config.releaseTab` 缺省关;设 `true` 后看板多一个「发布进度」tab,数据源是 `release-manifest.json`(同样**开了就必须在场**)。
模板见 `templates/manifests/release-manifest.json`。

- **三段语义固定**:`dev`(开着的 PR)/ `test`(已合主线,未随版本发出)/ `prod`(已随 release 发出)。宿主只改 `label` / `hint`,
  **可以只列两段**(缺 `test` = 合了即发,merged 未归版直接算 prod 且不带版本号);**不能省掉 `dev`**(硬报错)。
  `base` 不是 `instance.branch` 的 PR 标「非主线」、关掉未合的标「已关闭」,两者都不入三段,计进「其它」。
- **归版按打 tag 的精确时刻**:一个 merged 的 PR 归进 `at ≥ mergedAt` 的最早那个 release —— 同一天但在 tag 之后才合的,
  算「未随版本发出」。`releases[].prs` 写了就以显式为准(人的裁量优先于区间推算)。
- **两个视图切换**:表格(号 / 标题 / 段 / 状态·日期 / 关联卡 / 分支 / 验收进度;表头可按日期与号排序,搜索,已发按版本折叠、
  最新版展开)与时间线(v0.13.1 重做:一版一带 —— dev / test / 各版本 / 其它,折叠态六条带约 200px;点带头就地展开,
  带内 PR 贪心打包进最多 6 条泳道,当天开当天合的按号横排,展开高度因此有上界。轴是非线性的:安静的日子只给几个像素,
  一天挤了很多个 PR 就把那一天加宽 —— 横轴是那张老图唯一没用起来的一维。窗口芯片「近 60 天 / 全部」,release 是竖线)。
  默认表格,选择记在浏览器里。每行有 `id="pr-<号>"` 锚,`#pr-230` 深链直达(深链一律落到表格)。
- **数据由脚本写,不由 gen 取**:

  ```
  node <plugin>/scripts/pr-sync.mjs [--dir <kanbanDir>] [--dry-run]
  ```

  它调 `gh pr list` / `gh release list`,全量重写 `prs[]`(号降序,`cards` 反查三份 manifest)、追加新 tag(已有条目的 `note` 与
  人手写的 `prs` 一律不覆盖)、写 `syncedAt`。gh 缺席 / 未登录 / 网络不通 → 一条文案 + exit 1,**文件一个字节都不动**。
  开/合 PR 之后、发版打完 tag 之后各跑一次。**gen 永远不联网、不读时钟** —— 页面上的「今天」与「可能过时」都在浏览器里算。
- **卡头芯片的状态后缀**只要 `release-manifest.json` 在场就生效,不需要开这个 tab。
- **字节冻结**:不配或 `false` 时输出逐字节不变;两份 manifest 都不在场时同样不变。

## 卡正文轻 markdown(richText,v0.13.0:opt-in)

`config.richText` 缺省关;设 `true` 后三类卡的长文本字段(backlog 的 `problem`/`approach`/`note`、决策的
`question`/`decision`/`demoNote`/`source`、进度 task 的 `problem`/`approach`/`notes`)不再只 `esc()` 一遍塞进 dd,
而是过一个内置小渲染器。**开之前先知道:存量板一开就换了样子**(换行不再被吃掉、`**` 与反引号不再露原文),
这是它做成 opt-in 而不是默认开的原因。

- **认**:`**粗体**`、`` `代码` ``、空行分段、单换行 `<br>`、行首 `- `/`* ` 无序列表、行首 `1.` 有序列表(保原编号)、
  行首 `①`–`⑩` 有序列表(圈号留作标号、悬挂缩进)、`【…】` 开头的段视作时间戳小节(段前一条细线)。
- **不认**:标题、表格、链接语法(链接走卡的 `links[]`)、HTML。转义发生在认标记之前 —— 卡里写一段带 `<script>`
  的反引号代码,渲染出来仍是文本。规则与转义在 `scripts/lite.mjs`(纯函数,单测覆盖每条规则与三个 XSS 方向)。
- **长字段折叠**:超过 400 字的字段烤成两份 —— 第一段(按段落边界截)作预览 + 灰字「展开 · 还有 M 字」的钮,
  点开是全文,再点收起,**不记忆折叠状态**。没超阈值的、以及整段没有空行可切的,照旧走既有的按高度折叠;
  两套折叠不叠加。
- **`detail` 可选字段**(三类卡):长查证 / 逐文件证据 / 灰盒记录写这里,渲染在卡内所有字段之后,默认折叠成
  「查证细节 · N 字」。**它也受 `richText` 门控** —— 没开这个键的板不渲染 `detail`。卡上没这个字段 = 输出逐字节不变。
- **决策卡的 `source`** 从此渲染成与 backlog 同款的小徽章(此前是有数据没渲染的死数据)。这一条同样在门控内,
  否则存量板一升级就多出一行。
- **守卫**:开着这个键时,某长文本字段超过 800 字而卡上没有 `detail` → 一条非阻断 notice,最多点名 5 张卡。
  写法规矩(`problem` ≤ 2 句 / `approach` 结论先行 / `note` 只记时间线 / 查证进 `detail`)在 ddd-workflow 里。
- **字节冻结**:不配或 `false` 时输出逐字节不变。验收沿既有模式:看板整目录拷到 scratch,用已装的上一版缓存 gen
  与本版 gen 各跑一遍,`cmp` index/shots/parts + 逐文件 `shasum` refs。

## done 卡归档(backlogArchive,v0.13.0:opt-in)

`config.backlogArchive` 缺省关;设 `true` 后 Backlog pane 只列 status ≠ `done` 的卡,done 卡搬进独立的
「归档」tab(tab 条最末、文档库之后)。**跑久的板 done 会压过在办的卡**,Backlog 变成一条要往下划很远才见到活的长条 ——
这是它存在的理由。

- **`deferred` 不进归档**:推后是搁置不是完成,留在 Backlog 里(否则「暂时不做」会被当成「做完了」)。
- **渲染完全相同**:同一张卡的模板、同一个顺序(日期新→旧)。归档 pane 没有自己的工具条 —— 全局搜索 +
  线别 + 时间筛选够用,再加一排控件是噪音。
- **计数跟着走**:Backlog tab 徽章 = 非 done 数,归档 tab 徽章 = done 数;Backlog 状态筛选芯片里的 done 一档自动消失。
- **深链照旧**:`#卡号` 直接落到归档 pane;`lazyTabs` 开着时归档是**第三个 part**(`parts/archive.html`),
  归档卡在卡号→pane 映射里指向 `archive`,深链跨 part 会先取回再跳。关掉归档时这个 part 的陈迹一并清除。
- **一期只归 backlog**:决策卡的 `live`/`closed` 不归档(决策是走过的路径,不是待办)。
- **字节冻结**:不配或 `false` 时输出逐字节不变。

## 积压提醒(wip,v0.13.0:opt-in)

`config.wip` 缺省无;**给一个对象就算开**:`{ "soft": 10, "hard": 20 }`(两个阈值都可省,缺省即 10 / 20)。

- **只数 `ready`**:`blocked` 是等外部、`deferred` 是搁置,都不占「今天能动手」的额度。
- **两档**:超 `soft` → Backlog tab 一个琥珀点 + pane 顶一条安静的灰条「可做的卡 N 张 · 已超 <soft>」;
  超 `hard` → 点转红 + 常驻红横幅「可做的卡 N 张 · 超过 <hard> —— 先清一些再立新卡」。
- **跟着线别走**:配了 lanes 时数的是当前线别下可见的 ready 卡(与 tab 徽章同一把可见性尺子),切线别即重算。
- **守卫**:收工时全线别 ready 总数超 `hard` → 一条非阻断 notice。它不改任何 manifest,只说一声。
- **字节冻结**:不配时输出逐字节不变。

## 一卡一文件(cardsDir,v0.14.0:opt-in)

`config.cardsDir` 缺省无;**给一个目录名就算开**(惯例 `"cards"`,相对看板目录)。开着之后:

```
app/kanban/
  backlog-manifest.json      # 只剩表头:$comment / instance / statuses / priorities / tiers / groups
  decisions-manifest.json    # 同上(无 entries)
  cards/backlog/BL-C87.json  # = 原 items[] 的一个元素
  cards/decisions/D77.json   # = 原 entries[] 的一个元素
```

- **治的是并行写冲突**:几个 session 同时改一份 400KB 的 manifest,整文件重写会互相带走,git 连冲突都不报。
  按卡写之后每张卡自己一个路径,冲突要么不发生、要么 git 拦得住。**一块板只有一个 session 在写,就不必开**。
- **文件名 = 卡的 id**,大小写与卡里的 `id` 逐字相同;头文件里再留 `items`/`entries` 即硬报错(一个真源)。
  同一个 id 在两个子目录里各出现一次也是硬报错(深链、截图廊、懒加载定位全按 id 走)。
- **`order` 字段**:拆分时写入的原数组下标。数组顺序在 gen 里就是显示顺序(截图廊组序、深链表键序、
  同日同号时的先后),所以得记下来;gen 按 `order` 再按 id 排,**排完就把它删掉**,卡对象与拆分前逐字段相同。
  手工新建的卡不写 `order` 也行(排在最后,按 id)。
- **每卡更新日期**:卡头多一枚灰字「更新 MM-DD」= 该卡文件的 git 最后提交日(一条 `git log` 批量取;
  取不到退文件 mtime,再取不到就不渲染)。「沉睡」判定同时改用它 —— 比建卡 `date` 诚实。
- **`manifest.json` 的 tasks 不拆**(34 条上下、迭代级摘要、改动少);`acceptance-manifest.json` /
  `release-manifest.json` 也不拆(写它们的是单一条线)。
- **字节冻结**:不配 `cardsDir` 时输出逐字节不变;配了之后,除了那枚「更新」灰字,产物一个字节都不变。

**迁移顺序**(顺序是硬的,别跳):

1. **所有会话先升到 0.14.0** —— 旧版 gen 读不到卡目录,只会生成一块空板(版本戳守卫挡得住覆盖,但别赌)。
2. 主工作树 `git status` 干净;**通知各会话暂停写卡**(几分钟)。
3. `node <plugin>/scripts/cards-split.mjs --dir app/kanban --dry-run` 先看文件数与 id 异常,再去掉 `--dry-run` 真跑。
   它拆完会自动跑一遍 gen 与拆分前的产物逐字节比,**对不上就把改动前的文件原样写回并 exit 1**。
   两份头 manifest 逐字节不变(只是少了数组);`kanban.config.json` 会被重写成标准 2 空格形制
   (行内写的对象展开、补末尾换行)—— 那点排版差异一并进这个 commit,别单独较真。
4. **一个 commit** 提交整批(message 写明是 rename 性质),再通知各会话恢复。
5. 从此只写 `cards/<sub>/<id>.json` —— 「只 `git add` 具体文件」这条纪律自然成立。
6. **各会话改用写操作 CLI**(下一节):拆完还继续手搓 JSON 的话,一卡一文件治的那半个问题(整份重写互相带走)是治了,另半个(撞号)没治。

反悔用 `node <plugin>/scripts/cards-join.mjs --dir app/kanban`(同样自带 gen 比对与回滚)。

## 左侧竖向 tab 导航(tabRail,v0.14.1:opt-in)

`config.tabRail` 缺省关;设 `true` 后:板子往下滑、tab 条从视口顶端离开之后,页面左侧留白里浮出
一条竖排 tab 导航(同样的文案与「· N」徽章、当前 tab 高亮、点一下就切)。

- **清单不是第二份**:gen 直接从 tab 条那段标记解析出来 —— 加/减一个 tab(验收、发布进度、归档
  这些可选的也算)两边一起变,不会各说各话;截图廊那项照旧是出站链接。
- **徽章同源**:线别/时间/搜索重算 tab 徽章时,rail 文案直接抄 tab 按钮的现值,两边不可能对不上。
- **点击 = 同一条路**:走 tab 按钮那个 `show()` + `history.replaceState`,深链、懒加载 pane 行为不变;
  切完滚回该 pane 顶部(内容整个换了,停在原来的滚动位置没有意义)。
- **三道显隐门**:tab 条向上离开视口才出现(`IntersectionObserver`);窗口窄于 1200px 没有左侧留白,
  永不出现;浏览器没有 `IntersectionObserver` 就静默不出现。
- **不跟人抢地方**:它住在内容列之外的留白里,验收 pane 的分组目录、文档库的左导航都在列内,互不遮挡。
- **字节冻结**:不配或 `false` 时输出逐字节不变。

## 写操作 CLI(ddd.mjs,v0.14.0)

`node <plugin>/scripts/ddd.mjs`,零依赖,`--dir` 与 gen 同一口径。两种形制都认:配了 `cardsDir` 就逐卡文件读写(一张卡一次原子写),没配就从头文件的数组读、整文件重写(竞态照旧,但校验与形制一致)。

```
card new backlog|decision [--title "…"] [--line C] [--session dev] [--from f.json]
card set <id> <field> <value> [--json]      card status <id> <status> [--no-note]
card note <id> "<text>"                     card link <id> "<title>" <href>
card show <id> [--json]                     card list [--status s --line X --session Y --since YYYY-MM-DD]
card history <id>                           export [--out f.json]        pr-sync […]
```

- **`card new` 分配并预留卡号**:拆分模式用 `openSync(path,'wx')` 独占创建,两个会话同时算出同一个号时,抢输的自己退到下一号 —— 号是预留出来的,不是各算各的。backlog 取板上现有 id 的主流前缀(如 `BL-C`),决策固定 `D`。模板正文是 `<…>` 占位,`--from f.json` 的字段覆盖模板。
- **写之前先验**:status ∈ 该类卡的 statuses、date 形如 `YYYY-MM-DD`、`pr` 形如 `12` / `"#12"` / `"owner/repo#12"`、`line` ∈ `config.lanes.ids`、`session` ∈ `config.sessionTags`。不认识的字段只警告不拒(板上的字段一直在长),`order` 一律不许改 —— 它就是显示顺序。
- **形制由脚本保证**:临时文件 + rename 原子替换,已有键的相对顺序原样保留、新键按规范插位(id/title 在前,长文居中,`links`/`shots`/`pr` 收尾),2 空格缩进 + 末尾换行。**从不 commit** —— `git add` 那几个文件仍是会话自己的事。
- **`card new` 之后照守卫的口径数一遍 `ready`**,超 `config.wip.hard` 就在 stderr 上给同一句提醒(不是收工才说)。
- **退路**:CLI 说不清的(重排一整段结构、批量改)直接编辑卡文件,形制照旧。

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
