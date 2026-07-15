// 版本戳共用件(gen.mjs / stop-hook.mjs / retire-stale-caches.mjs 共用,零依赖)。
// 背景(盖板事故):长寿旧版 session 的 Stop hook 会拿旧 gen 反复盖板;mtime 新鲜度分不出「谁写的」——
// 旧 gen 盖完板产物反而最新。版本戳补上这一维:index.html 第二行 <!-- ddd-gen vX.Y.Z --> 由
// gen 烙下,守卫据此判「产物比我新还是比我旧」,自愈旧 gen 覆盖、拒绝降级覆盖。
import { closeSync, openSync, readFileSync, readSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 本 plugin 版本(../.claude-plugin/plugin.json 为真源)。读不到或**非纯数字点分**返回 null——
 * 版本文法必须闭环:readStamp 只认 [0-9.],若放行 0.7.0-rc1 这类版本,烙出的戳读回是 null →
 * 「戳缺失→重跑」变永动;cmpVer 也会全程 NaN 让拒降级/退役静默失效。调用方自行决定降级或硬失败。
 */
export function readPluginVersion() {
  try {
    const p = join(dirname(fileURLToPath(import.meta.url)), '..', '.claude-plugin', 'plugin.json')
    const v = JSON.parse(readFileSync(p, 'utf8')).version
    if (typeof v !== 'string' || !/^\d+(\.\d+)*$/.test(v)) {
      if (v) console.error(`[lib-version] ⚠ plugin.json version「${v}」非纯数字点分(勿用 -rc/-beta 后缀),视同读不到——戳体系要求版本文法闭环`)
      return null
    }
    return v
  } catch { return null }
}

/**
 * 读 index.html 的 gen 版本戳。戳固定在文件头部(doctype 后第二行),定长只读前 1KB(index 可达几十万字符,别整读)。
 * @returns {string|null|undefined} 版本串;null = 文件在但无戳(旧 gen 产物);undefined = 文件读不到(首跑/无产物)
 */
export function readStamp(indexPath) {
  let head
  try {
    const fd = openSync(indexPath, 'r')
    try {
      const buf = Buffer.alloc(1024)
      head = buf.toString('utf8', 0, readSync(fd, buf, 0, 1024, 0))
    } finally { closeSync(fd) }
  } catch { return undefined }
  const m = head.match(/<!-- ddd-gen v([0-9][0-9.]*) -->/)
  return m ? m[1] : null
}

// 数值元组比较(0.10 > 0.9;长度补零)。禁字符串比较。任一位 NaN 返回 NaN——NaN 参与 >/< 恒为
// false,调用方的「更新→拒跑」「更旧→重跑」两个分支都天然不触发,退回纯 mtime 口径(方向安全)。
export function cmpVer(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0
    if (Number.isNaN(x) || Number.isNaN(y)) return NaN
    if (x !== y) return x - y
  }
  return 0
}
