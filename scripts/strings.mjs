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
  ghprRemind:
    '[看板提醒] 刚运行了 gh pr 命令。若这标志某功能/阶段完成:检查 app/kanban 对应看板卡状态是否需要推进(改完 manifest 不必手动跑 gen,Stop 守卫会自动重生成)。与看板无关则忽略。',
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
  ghprRemind:
    '[Kanban reminder] A gh pr command just ran. If this marks a feature/phase as complete: check whether the corresponding board card status in app/kanban needs advancing (after editing a manifest, no need to run gen manually — the Stop guard regenerates automatically). Ignore if unrelated to the board.',
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
}
export function genStrings(lang) { return lang === 'en' ? genEn : genZh }
