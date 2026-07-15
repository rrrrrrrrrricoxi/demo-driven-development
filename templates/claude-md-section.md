## 看板生成物不读全文(token 保护)

`app/kanban/` 下的 `index.html`、`shots.html`、`refs/**` 是 `gen.mjs` 的生成物(单文件几十万字符),已用权限 deny 规则禁止 Read,也**不要用 `cat`/`head`/`sed` 绕读**。原则:脚本读正文不算成本,Claude 亲手读才烧 token —— 确定性的活儿下沉到脚本。

要查证内容,走源头,别碰像素:

| 想查 | 走这里 |
|---|---|
| 卡片状态 / 某条目字段 | `jq` 点查 manifest JSON(不整读) |
| 文档正文 | 读 `docs/` 下的 markdown 源 |
| 渲染对不对 | 跑 `node app/kanban/gen.mjs`,报错自会喂回(守卫兜底) |
| 生成物里某字符串在不在 | `Grep` 精确匹配,不 Read 全文 |
