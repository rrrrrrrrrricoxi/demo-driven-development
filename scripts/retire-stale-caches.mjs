#!/usr/bin/env node
// 扑灭存量(旧版盖板事故的火源):向 plugin cache 里被本版取代的旧版本目录写「拒执行 shim」。
//
// 为什么必须有这一步:长寿旧 session 的 hooks 在会话启动时就把 ${CLAUDE_PLUGIN_ROOT} 解析到
// ~/.claude/plugins/cache/<marketplace>/<plugin>/<旧版>/,发多少新版都改不了它们的行为;
// 但 hook 每次事件都从盘上重新 spawn 脚本——覆盖旧盘上的脚本,旧 session 下次收工即缴械。
// 版本戳体系(gen/stop-hook)防的是「将来」的版本错位;本脚本灭的是「现在」活着的火源。
//
// 用法:node retire-stale-caches.mjs                 # dry-run:列出将 shim 的文件,不动盘
//       node retire-stale-caches.mjs --yes           # 落盘(幂等:已 shim 的跳过)
//       node retire-stale-caches.mjs --cache-root D  # 测试用:覆盖 cache 根目录
//       --include-registered                          # 连仍被项目注册在用的版本一起退役(慎)
//
// 安全边界:
//   - 只动 < 自身版本 的版本目录;同版/更新/比不出(NaN)一律不动;
//   - 仍被 installed_plugins.json 注册为某项目现役安装的版本,缺省跳过(shim 掉现役版本会让
//     该项目重启后装回的还是 shim,守卫永久缴械且提示语失真)——那些项目先升级,或显式
//     --include-registered;
//   - 版本目录是软链的跳过(开发者把 cache 软链到工作树的调试形态,穿透写会毁工作树);
//   - 两个脚本都 shim:只灭 gen 的话,旧 stop-hook 走 genFail → exit 2,旧 session 每次收工
//     死阻断;stop-hook shim 用 systemMessage + exit 0 提示重启。ghpr-remind 无害,不动;
//   - 写入走 tmp+rename(原子),避免活会话 hook 恰好 spawn 到半截文件。
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cmpVer, readPluginVersion } from './lib-version.mjs'

const SHIM_MARK = 'ddd-retired-shim'
const MY_VER = readPluginVersion()
if (!MY_VER) { console.error('[retire] 读不到自身 .claude-plugin/plugin.json 的纯数字版本,中止'); process.exit(1) }
let MY_NAME
try {
  MY_NAME = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.claude-plugin', 'plugin.json'), 'utf8')).name
} catch {}
if (!MY_NAME) { console.error('[retire] 读不到自身 plugin name,中止'); process.exit(1) }

// 插值一律过 JSON.stringify(名字/版本含引号等特殊字符时,生成的 shim 仍是合法 JS)
const stopShim = (ver) => `#!/usr/bin/env node
// ${SHIM_MARK}(由 v${MY_VER} 的 retire-stale-caches 写入):本版本已退役——
// 旧 gen 会把过期 backnav/UI 盖回新产物(盖板事故),故本版守卫缴械,只提示重启。
console.log(JSON.stringify({ systemMessage: ['[ddd] 本 session 加载的 ', ${JSON.stringify(MY_NAME)}, ' v', ${JSON.stringify(ver)}, ' 已退役,看板守卫已停用——请重启 session 载入新版。'].join('') }))
process.exit(0)
`
const genShim = (ver) => `#!/usr/bin/env node
// ${SHIM_MARK}(由 v${MY_VER} 的 retire-stale-caches 写入)
console.error(['[gen] ', ${JSON.stringify(MY_NAME)}, ' v', ${JSON.stringify(ver)}, ' 的 gen 已退役(旧版会把过期 backnav/UI 盖回新产物);请用当前版 plugin 的 gen,或重启 session。'].join(''))
process.exit(1)
`

const argv = process.argv.slice(2)
const apply = argv.includes('--yes')
const includeRegistered = argv.includes('--include-registered')
const crIdx = argv.indexOf('--cache-root')
const cacheRoot = crIdx >= 0 && argv[crIdx + 1] ? argv[crIdx + 1] : join(homedir(), '.claude', 'plugins', 'cache')

// 注册安装表(cache 的兄弟文件):版本 → 仍在用它的项目列表
const registered = new Map()
try {
  const reg = JSON.parse(readFileSync(join(cacheRoot, '..', 'installed_plugins.json'), 'utf8'))
  for (const [key, entries] of Object.entries(reg.plugins || {})) {
    if (!key.startsWith(`${MY_NAME}@`)) continue
    for (const e of entries || []) {
      if (!e?.version) continue
      const who = e.projectPath || `(${e.scope || 'user'})`
      registered.set(e.version, [...(registered.get(e.version) || []), who])
    }
  }
} catch {}

const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const inUse = (verDir) => {
  try {
    return readdirSync(join(verDir, '.in_use')).map((f) => {
      const pid = Number(f)
      return `${pid}${pidAlive(pid) ? '(存活)' : '(已死)'}`
    })
  } catch { return [] }
}

let marketplaces = []
try { marketplaces = readdirSync(cacheRoot) } catch { console.log(`[retire] 无 plugin cache 目录(${cacheRoot}),无事可做`); process.exit(0) }

const plan = []
for (const mp of marketplaces) {
  const pluginDir = join(cacheRoot, mp, MY_NAME)
  let vers = []
  try { vers = readdirSync(pluginDir) } catch { continue }
  for (const v of vers) {
    if (!/^\d+[\d.]*$/.test(v)) continue
    if (!(cmpVer(v, MY_VER) < 0)) continue // 只退役更旧的
    const verDir = join(pluginDir, v)
    try {
      if (lstatSync(verDir).isSymbolicLink()) {
        console.log(`[retire] ⚠ 跳过软链版本目录 ${verDir} → ${realpathSync(verDir)}(穿透写会毁链接目标)`)
        continue
      }
    } catch { continue }
    if (registered.has(v) && !includeRegistered) {
      console.log(`[retire] ⚠ 跳过 v${v}:仍是 ${registered.get(v).join(' · ')} 的注册安装——先升级这些项目,或显式 --include-registered`)
      continue
    }
    const pids = inUse(verDir)
    for (const [file, shim] of [['stop-hook.mjs', stopShim(v)], ['gen.mjs', genShim(v)]]) {
      const p = join(verDir, 'scripts', file)
      if (!existsSync(p)) continue
      let cur = ''
      try { cur = readFileSync(p, 'utf8') } catch {}
      if (cur.includes(SHIM_MARK)) continue // 幂等:已 shim 的跳过
      plan.push({ p, shim, note: pids.length ? `活会话标记:${pids.join(' ')}` : '' })
    }
  }
}

if (!plan.length) { console.log(`[retire] 没有需要退役的旧版缓存(当前 v${MY_VER},cache=${cacheRoot})`); process.exit(0) }
let done = 0
const failed = []
for (const { p, shim, note } of plan) {
  if (!apply) { console.log(`[retire] 将 shim:${p}${note ? `  [${note}]` : ''}`); continue }
  try {
    writeFileSync(`${p}.tmp`, shim, 'utf8')
    renameSync(`${p}.tmp`, p) // 原子换入:读方要么旧内容要么完整 shim
    done++
    console.log(`[retire] ✂ ${p}${note ? `  [${note}]` : ''}`)
  } catch (e) {
    failed.push(`${p}(${e.code || e.message})`)
  }
}
if (!apply) {
  console.log(`[retire] dry-run:以上 ${plan.length} 个文件将被覆盖为拒执行 shim;确认后加 --yes 落盘`)
} else if (failed.length) {
  console.error(`[retire] 部分失败:成功 ${done} / 失败 ${failed.length}:\n${failed.map((f) => `  ✗ ${f}`).join('\n')}\n重跑可续(幂等)。`)
  process.exit(1)
} else {
  console.log(`[retire] 完成:${done} 个文件已 shim;活着的旧 session 下次收工即缴械(收到重启提示)`)
}
