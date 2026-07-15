# TOKEN-ECONOMY —— 降本增效指南

给人看的版本(讲道理,方便日后调整)。硬约束落在两个 skill 里(`skills/kanban-init/SKILL.md` 的 init 段、`skills/ddd-workflow/SKILL.md` 的日常段),执行层由 init 注入目标项目的 deny 规则 + CLAUDE.md 段兜底。

## 第一原则

**成本大头不在"写的文件多",在 Claude 亲手读写了本可由脚本确定性完成的东西。**

实测尺度:一个成熟看板的 `index.html` 可达 ~50 万字符,Claude 读一次 ≈ 烧十几万 token。

推论:**确定性的活儿下沉到脚本,Claude 只花 token 做判断。脚本读正文不算违规,Claude 读才算。**

## 规则表

| 规则 | 段 | 省在哪 |
|---|---|---|
| 盘点走 `init.mjs --scan` 摘要,禁读 demo 正文 | init | 71 个 demo:摘要 ~70 行 vs 正文几十万 token |
| **永不读生成物**(`index.html` / `shots.html` / `refs/**`)—— deny 规则硬拦 + CLAUDE.md 注入段拦 `cat` 绕读 | 日常 | 单次省 10 万+ |
| 查证走源头:卡状态 → `jq` 点查 manifest;文档 → 读 md 源;渲染对错 → gen 报错已由守卫喂回 | 日常 | manifest 是地基,`index.html` 是像素 |
| manifest 不整读(可达数百 KB):`jq` / `Grep` 点查、聚合 | 日常 | 几百 token 替代几万 |
| 归拢 / `mv` / 写存根由 `--apply` 一次批量完成 | init | N 次工具调用 → 1 次 |
| 机械段派便宜模型 sub agent(现行策略:默认 opus,关键判断才上更贵档) | 两者 | 单价降档 |
| 补卡内容不在 init 会话做,后续按需补 | init | 认知开销挪出一次性动作 |
| 孤儿报警先 `grep` 核实再动手(并行会话有"落 demo → 补链接"竞态窗口,报警可能已过时) | 日常 | 避免重复补卡返工 |

## 查证走源头:对照表(别碰像素)

| 想查 | 走这里(源头) | 别做 |
|---|---|---|
| 卡片状态 / 某字段 | `jq` 点查对应 manifest | Read 整个 manifest |
| 文档正文 | 读 `docs/` 下 markdown 源 | Read 渲染后的 `refs/*.html` |
| 渲染对不对 | 跑 `node gen.mjs`,看报错 | Read `index.html` 肉眼找 |
| 某字符串在不在生成物里 | `Grep` 精确匹配 | Read 全文 |
| `gen.mjs` 某段逻辑 | `Grep` 定位 / `offset`+`limit` 分片读 | 整读第二遍 |

## 一句话

**地基(manifest / md 源 / gen 报错)是真源,像素(index.html / refs.html / shots.html)是产物;查证永远回真源,产物交给脚本生成、交给 deny 规则挡在门外。**
