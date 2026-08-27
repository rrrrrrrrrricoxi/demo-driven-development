---
name: ddd-workflow
description: Demo-driven development workflow for a project that has the demo-driven kanban installed (an app/kanban/kanban.config.json exists). Use when building or changing any UI/UX or feature so it follows the house rhythm — one HTML demo per decision, a kanban card, human review, then code, verify, PR — and to enforce the token-economy hard rules for day-to-day work on the kanban (never read generated files, verify from source-of-truth). Step 0 (inside the skill) gates only the demo ritual to SEE-IT taste forks — load the skill even for correctness/derivable (KNOW-IT) work; it routes those to spec-and-verify and the token rules still apply. Not for initial setup; see kanban-init for that.
---

# ddd-workflow —— demo 驱动开发工作流

固化首宿主项目长出来的节奏:**机制归 plugin、数据归项目**。仅当项目已装看板(存在 `app/kanban/kanban.config.json`)时适用。

## 第 0 步:场景自检(动手前先答,两问)

接活先答两问,并把判断对用户报一行(如「SEE-IT:5 个布局方向,得并排看」)——记录本身就是刹车,但只报一行,别造新仪式:

1. 这是「看一眼才判得准」的选择(SEE-IT)还是「想清楚就有对错」的问题(KNOW-IT)?KNOW-IT(正确性 / 可推导 / schema / 口径 / 迁移)→ 不走 demo,走 spec → 测试 / 对抗验证,并说明为什么。
2. 真有岔路吗?已定 / 可推导 / 不值得定的选择不配仪式 → 直接做,不立卡不做 demo。

人点名「做个 demo」时不拦,判断仍报一行。分流只免 demo / 立卡 / ★评审的仪式;分支、验证、PR 节奏照旧。**收敛规则**:并排发散不限;串行(评审后再来一轮)第 3 轮起,每轮先答「这轮会改变选择,还是只在磨已选中的?」答不出这轮会改变什么 → 陈述边际递减、建议就地拍板,别重演「logo-20 轮」。边界全文与实证:plugin 根 `docs/scene-fit.md`(拿不准再读,别默认加载)。

## 流程:①设计 + demo → ★评审 → ②代码 → ③验证 → ④PR

每个功能一条 feature 分支、一个 PR。顺序不可跳:

1. **设计 + demo**:每个过了第 0 步自检的 UI/UX 决策,先做独立自包含 HTML demo(认知验证、秒级选型;并排展示比抽象规则快得多)。设计文稿进 repo(`docs/` 或 `plans/`)。**每个 demo 必挂一张卡**(决策卡 / backlog 卡的 links)—— 守卫会阻断孤儿 demo。
   **文稿必挂文档库(v0.11.3 起为机制,与「demo 必挂卡」同源)**:spec / 评审稿 / 实施 plan / 交接档 / 运维手册落进 `docs/` 或 `plans/` 的**同一次提交**里,就要加进 `config.docs[]`(字段 `path` / `out` 纯文件名不重名 / `title` / `baseDir` / `category` / `desc` 一句话定位 / 可选 `order`、`line`),让它在看板文档库可读。**产出必须可被发现**——只躺在仓库里的文稿,协作者和其他会话线都看不见,等于没写。别攒着批量补:攒出来的欠账要靠「`config.docs` 的 path 集合 vs `docs/`+`plans/` 下 .md 求差集」才盘得回来。挂之前先扫一眼内容是否还准,过期或与现状冲突的先修再挂(挂上一份错的比不挂更伤信任),确属只考古的就别挂。
   **demo 形制(宿主实战定型,v0.10.0 起为机制)**:
   - **多方案选型 demo 一律单 HTML 文件**,一页含全部变体。禁止一方案一文件——拍板的动作是并排比较,分文件等于把比较成本转嫁给用户,让人在看板与 demo 之间点出点进。
   - **方案 ≥3 或页面长,左侧带固定可导航目录**(`position:fixed`,点击直达 + scrollspy 高亮)。两个实测坑:①守卫注入的返回栏占顶部 44px,目录的 `top` 要让位(参考值 76px);②页底最后一节的 `offsetTop` 可能永远够不到判定线,须加「滚到底 = 点亮末项」的兜底。
   - **多轮 demo 时,卡片的 `demo` 字段(主按钮)必须指向最新一轮**;旧轮留在 `links` 里并标注轮次。旧轮的多个文件可按「合订术」归并成单页存档(同源 iframe 组装,交互零损失,配方见 plugin 根 `docs/demo-binding.md`);被已挂卡 demo 用 iframe 内嵌的子页,守卫自动豁免,不必挂占位链接。
   **建卡时的现场留存(v0.11.4 起为机制)**:
   - **prompt 里带了截图,就把它留进卡**:图片存进看板的 `shots/`(文件名以卡号打头,如 `bl-c72-filter-jump.png` —— 截图廊会据此自动归组并跳回该卡),卡上加 `"shots": ["bl-c72-filter-jump.png"]`(要配说明就写 `[{"file":"…","caption":"点 chip 后整页横移"}]`)。卡片详情里直接看得到缩略图,点开原图。**理由**:隔一段时间回来翻卡,一句文字描述常唤不回当时看到的东西,一张现场图能。
   - **bug 卡必须带复现流程**:`"repro"` 字段,单行写字符串,多步写数组 `["打开 X","点 Y","看到 Z(应为 W)"]`。写到「照着点就能重现」的程度——省掉的每一步,都是未来某个人(可能是你自己)重新试错的时间。
   **正文写法:摘要与细节分家(v0.13.0 起为机制,板上开了 `richText` 时)**:卡正文是会话写给会话看的,一段到底谁都不会读第二遍。分工是死的:
   - `problem` ≤ 2 句 —— 用户看到什么、为什么这是问题。别写查证过程。
   - `approach` **结论先行** —— 1–3 行说清怎么改、改哪、代价。判断放最上面,读的人才可能只读最上面。
   - `note` 只记决策与进展的时间线,一段一条,`【2026-08-26 更新】` 开头(渲染时自动分节)。
   - 逐文件证据、灰盒记录、排查全过程 → `"detail"` 字段。它渲染在卡最下面一个默认折叠的「查证细节」块里,想看的人点开,不想看的人不被它挡路。
   - 正文认轻 markdown:`**粗体**`、`` `代码` ``、空行分段、`- ` 与 `1.` 列表、`①…⑩` 列表。**不认**标题、表格、链接语法(链接走 `links[]`)与 HTML。
   - 某个字段过了 800 字而卡上没有 `detail`,守卫会在收工时点名 —— 那是「该拆了」的信号,不是错误。
2. **★评审**:人审设计 + demo,拍板后才动代码。别默默替用户拍板。
3. **代码**:实现落地;改 manifest 后跑 `node app/kanban/gen.mjs` 重生成看板。
4. **验证**:定义成功标准并跑到验证(测试 / 构建 / 手工 smoke);"写完了"≠"验证过了"。
   **要人实测的,清单写进 `acceptance-manifest.json`,不再手搭 HTML 页**(v0.12.0,板上开了 `acceptanceTab` 时):一份清单挂一个或多个 PR,`current` 指向正在测的那个;条目写「做什么 / 预期 / 不对的样子 / 为什么」,数据块用 `rows` 二维数组。人在页面上勾,勾完点「复制勾选结果」,把那段 JSON 贴回清单的 `result` —— 勾选结果这才进 git,而不是留在某一台浏览器里。清单正文改了就把 `revision` 加一(旧勾选当场作废)。
5. **PR**:开 PR 合入;PR 后推进相关卡状态(gh-pr 提醒 hook 会提示)。
   **开 PR 的同时在卡上写 `pr` 字段**(`230` / `[227, 230]` / `"owner/repo#4"`)—— 卡与实现它的那段工作从此是数据关系,不是散文。
   **开完 / 合完 PR 跑一次 `node <plugin>/scripts/pr-sync.mjs`**(板上开了 `releaseTab` 时):它调 `gh` 把 PR 状态与版本写进 `release-manifest.json`。gen 不联网也不读时钟,不跑这个脚本,发布进度就停在上次同步的那一刻。
   **合完 PR 用 `pr-sync.mjs --settle` 收账**(v0.13.0):它同步之后列出「关联 PR 都合了、卡还停在非终态」的卡与建议 status(backlog / 进度卡 `done`,决策卡 `live`),**默认只打印**;核对无误再加 `--write`(改 status,并在 `note` / `notes` 末尾追一行时间线)。守卫在收工时也会点名这两种卡(待收账 / 已收账但 PR 未合),非阻断。
   **一张卡跨几轮 PR 时写 `settleHold`**(v0.13.1):这一轮的 PR 只落了一半 / 只落了接口,卡该留在 `ready` —— 在卡上写一句 `"settleHold": "理由"`,它从此不进待收账清单、不出芯片、守卫不催,卡头换成一枚灰芯片「暂不收账」(理由挂 title)。新一轮 PR 开了就把号加进卡的 `pr` 数组;真收账时删掉 `settleHold`。清单上只有几张该收时,用 `--settle --write --only BL-1,D2` 挑着收(点名了清单外的卡号会报错,一个字节都不写)。
   **`links[]` 的标题不写状态词**:「(开而不合)」「(待合)」「(已合并)」这类手写注解一定会过时 —— 板上有了 `release-manifest.json` 之后,指向本仓 PR 的链接自动带真实状态(开着 / 已合 08-26 / 已发 v0.0.3),写过的旧词若与实际不符会被划掉。标题只写这个 PR 干了什么。

**发版时**(不是每个功能都发版,所以不占流程的一环):打完 tag 再跑一次 `pr-sync` —— 新版本被追加进 `releases[]`,区间内合并的 PR 自动归版;版本说明写进那条 `releases[]` 的 `note`,脚本不覆盖人写的 `note` 与 `prs`。

## 日常段 token 硬规则(命令式,不是建议)

成本大头是"Claude 亲手读了本可由脚本确定性产出的东西"。脚本读正文不算,Claude 读才算。

- **永不读生成物**:`app/kanban/index.html`、`shots.html`、`refs/**` 是 `gen.mjs` 的产物(单文件可达几十万字符)。禁止 Read,禁止 `cat`/`head`/`sed` 绕读。deny 规则会硬拦。
- **manifest 不整读**:查卡状态 / 某字段一律 `jq` 点查或 `Grep`,不整读(可达数百 KB)。
- **查证走源头,不碰像素**:卡状态 → `jq` 查 manifest;文档正文 → 读 `docs/` 的 md 源;渲染对不对 → 跑 `gen.mjs` 看报错(守卫已把失败喂回),不 Read `index.html` 肉眼找。
- **`gen.mjs` 大文件**:`Grep` 定位或 `offset`+`limit` 分片读,不整读第二遍。
- **孤儿报警先核实再动手**:守卫报某 demo 无卡时,先 `grep` 核实文件名是否已在 manifest —— 多会话并行有"落 demo → 补链接"竞态窗口,报警可能已过时,别急着补卡返工。

完整讲解见 plugin 根的 `TOKEN-ECONOMY.md`。
