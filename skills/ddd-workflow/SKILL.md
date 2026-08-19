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
   **demo 形制(宿主实战定型,v0.10.0 起为机制)**:
   - **多方案选型 demo 一律单 HTML 文件**,一页含全部变体。禁止一方案一文件——拍板的动作是并排比较,分文件等于把比较成本转嫁给用户,让人在看板与 demo 之间点出点进。
   - **方案 ≥3 或页面长,左侧带固定可导航目录**(`position:fixed`,点击直达 + scrollspy 高亮)。两个实测坑:①守卫注入的返回栏占顶部 44px,目录的 `top` 要让位(参考值 76px);②页底最后一节的 `offsetTop` 可能永远够不到判定线,须加「滚到底 = 点亮末项」的兜底。
   - **多轮 demo 时,卡片的 `demo` 字段(主按钮)必须指向最新一轮**;旧轮留在 `links` 里并标注轮次。旧轮的多个文件可按「合订术」归并成单页存档(同源 iframe 组装,交互零损失,配方见 plugin 根 `docs/demo-binding.md`);被已挂卡 demo 用 iframe 内嵌的子页,守卫自动豁免,不必挂占位链接。
2. **★评审**:人审设计 + demo,拍板后才动代码。别默默替用户拍板。
3. **代码**:实现落地;改 manifest 后跑 `node app/kanban/gen.mjs` 重生成看板。
4. **验证**:定义成功标准并跑到验证(测试 / 构建 / 手工 smoke);"写完了"≠"验证过了"。
5. **PR**:开 PR 合入;PR 后推进相关卡状态(gh-pr 提醒 hook 会提示)。

## 日常段 token 硬规则(命令式,不是建议)

成本大头是"Claude 亲手读了本可由脚本确定性产出的东西"。脚本读正文不算,Claude 读才算。

- **永不读生成物**:`app/kanban/index.html`、`shots.html`、`refs/**` 是 `gen.mjs` 的产物(单文件可达几十万字符)。禁止 Read,禁止 `cat`/`head`/`sed` 绕读。deny 规则会硬拦。
- **manifest 不整读**:查卡状态 / 某字段一律 `jq` 点查或 `Grep`,不整读(可达数百 KB)。
- **查证走源头,不碰像素**:卡状态 → `jq` 查 manifest;文档正文 → 读 `docs/` 的 md 源;渲染对不对 → 跑 `gen.mjs` 看报错(守卫已把失败喂回),不 Read `index.html` 肉眼找。
- **`gen.mjs` 大文件**:`Grep` 定位或 `offset`+`limit` 分片读,不整读第二遍。
- **孤儿报警先核实再动手**:守卫报某 demo 无卡时,先 `grep` 核实文件名是否已在 manifest —— 多会话并行有"落 demo → 补链接"竞态窗口,报警可能已过时,别急着补卡返工。

完整讲解见 plugin 根的 `TOKEN-ECONOMY.md`。
