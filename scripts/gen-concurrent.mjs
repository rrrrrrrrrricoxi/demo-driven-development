// 并发生成的边界:同一 realpath 看板排队,产物先留内存,输入复核后逐文件原子替换。
// 不是多文件事务:最后才换 index,写入期间若输入变化则留 stale 标记,下轮重建。
// demo 是用户源文件;并发模式不注入/升级返回栏,避免读改写覆盖另一会话的编辑。
import * as fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { isRemoteShot, shotHref } from './accpre.mjs'

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const fail = (zh, en) => new Error(`[gen] ${zh} / ${en}`)
// 锁放在 canonical 看板内,不依赖各会话可能不同的 TMPDIR。空根目录保留以免创建/删除根目录竞态。
export const lockRoot = (board) => join(fs.realpathSync(board), '.ddd-gen-lock')

// 每个竞争者拥有唯一目录,不存在「先检查旧锁再误删新锁」的换主窗口。
// Lamport bakery:目录出现即 choosing,原子发布 ticket 后按 (ticket, id) 排队。
// 只能回收同主机且 kill(pid,0) 明确 ESRCH 的记录;年龄从不证明进程已死。
export async function acquireGenerationLock(board, { timeoutMs = 40000 } = {}) {
  const root = lockRoot(board)
  fs.mkdirSync(root, { recursive: true })
  const id = `${Buffer.from(hostname()).toString('base64url')}.${process.pid}.${randomUUID()}`
  const own = join(root, id)
  fs.mkdirSync(own)
  const release = () => fs.rmSync(own, { recursive: true, force: true })
  const deadline = Date.now() + timeoutMs
  const expired = () => {
    if (Date.now() >= deadline) throw fail('等待并发生成超时;保留现有产物,稍后重试', 'Timed out waiting for concurrent generation; existing output is preserved, retry later')
  }
  const ticket = (other) => {
    const path = join(root, other)
    const [host, pid] = other.split('.')
    if (host === Buffer.from(hostname()).toString('base64url') && /^[1-9][0-9]*$/.test(pid || '')) {
      try { process.kill(Number(pid), 0) }
      catch (e) {
        if (e.code === 'ESRCH') { fs.rmSync(path, { recursive: true, force: true }); return null }
      }
    }
    try {
      const value = fs.readFileSync(join(path, 'ticket'), 'utf8')
      return /^[1-9][0-9]*$/.test(value) ? BigInt(value) : 0n
    } catch (e) {
      if (e.code === 'ENOENT' && !fs.existsSync(path)) return null
      return 0n // 未发布/不可验证的活锁必须等,不能靠年龄抢占。
    }
  }
  try {
    let mine = 1n
    for (const other of fs.readdirSync(root)) {
      if (other === id) continue
      const n = ticket(other)
      if (n !== null && n >= mine) mine = n + 1n
    }
    fs.writeFileSync(join(own, 'choosing'), String(mine))
    fs.renameSync(join(own, 'choosing'), join(own, 'ticket'))
    for (;;) {
      let waiting = false
      for (const other of fs.readdirSync(root)) {
        if (other === id) continue
        const n = ticket(other)
        if (n !== null && (n === 0n || n < mine || (n === mine && other < id))) { waiting = true; break }
      }
      if (!waiting) return release
      expired()
      await sleep(25)
    }
  } catch (e) { release(); throw e }
}

// 根 kanban.log 是 serve-kanban.sh 的默认访问日志;浏览器请求不会改变渲染输入。
// 仅跳过根目录下这份运行输出,显式文档与验收证据仍按各自路径复核。
const OUTPUTS = new Set(['index.html', 'shots.html', 'refs', 'parts', '.ddd-gen-stale', '.ddd-gen-lock', 'kanban.log'])
// 内容 hash 检测保持 mtime 的编辑;mtime 另入 hash,因为卡/文档/截图日期会用它兜底。
function fingerprint(board) {
  const hash = createHash('sha256')
  const add = (value) => hash.update(JSON.stringify(value) + '\n')
  const visit = (path, ancestors = new Set()) => {
    add(path)
    let stat, canonical
    try { stat = fs.statSync(path); canonical = fs.realpathSync(path) }
    catch (e) { if (e.code === 'ENOENT' || e.code === 'ENOTDIR') { add('missing'); return } throw e }
    if (stat.isDirectory()) {
      if (ancestors.has(canonical)) { add('cycle'); return }
      const next = new Set(ancestors).add(canonical)
      for (const name of fs.readdirSync(path).sort()) {
        if (path === board && OUTPUTS.has(name)) continue
        visit(join(path, name), next)
      }
    } else if (stat.isFile()) {
      add([canonical, stat.mtimeMs, stat.size])
      hash.update(fs.readFileSync(path))
    } else add('non-file')
  }
  visit(board)
  const cfg = JSON.parse(fs.readFileSync(join(board, 'kanban.config.json'), 'utf8'))
  const repo = resolve(board, '..', '..')
  for (const doc of cfg.docs || []) if (typeof doc.path === 'string') visit(join(repo, doc.path))
  // 验收证据允许 ../ 路径;这些文件存在与否会改变渲染,也必须纳入输入。
  if (cfg.acceptanceTab === true) {
    let manifest
    try { manifest = JSON.parse(fs.readFileSync(join(board, 'acceptance-manifest.json'), 'utf8')) } catch {}
    for (const list of manifest?.lists || []) for (const item of list.items || []) {
      for (const round of [item, ...(Array.isArray(item.shotsHistory) ? item.shotsHistory : [])]) {
        for (const shot of Array.isArray(round?.shots) ? round.shots : []) {
          const href = shotHref(shot)
          if (href && !isRemoteShot(href)) visit(join(board, href))
        }
      }
    }
  }
  try { add(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 })) }
  catch { add('no-head') }
  return hash.digest('hex')
}

export async function beginConcurrentGeneration(board) {
  // 缺省路径保留原有读配置报错与逐字节输出;此时尚未选 lang,错误采用双语。
  let cfg
  try { cfg = JSON.parse(fs.readFileSync(join(board, 'kanban.config.json'), 'utf8')) } catch { return null }
  if (cfg.concurrentSessions !== true) return null
  board = fs.realpathSync(board)
  const release = await acquireGenerationLock(board)
  let closed = false
  const cleanup = () => {
    if (closed) return
    closed = true
    release()
    process.removeListener('exit', cleanup)
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', terminate)
  }
  const interrupt = () => process.exit(130)
  const terminate = () => process.exit(143)
  process.on('exit', cleanup)
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', terminate)
  try {
    const baseline = fingerprint(board)
    const pending = new Map()
    const pathOf = (path) => {
      const absolute = resolve(path)
      const rel = relative(board, absolute)
      if (rel === 'index.html' || rel === 'shots.html' || rel === 'refs' || rel.startsWith('refs/') || rel === 'parts' || rel.startsWith('parts/')) return absolute
      throw fail('并发生成拒绝写入源文件', 'Concurrent generation refuses to write a source file')
    }
    const stale = join(board, '.ddd-gen-stale')
    const check = () => {
      let current
      try { current = fingerprint(board) } catch { /* 读到半写入的源文件同样必须延后。 */ }
      if (current !== baseline) {
        // 保留 mtime 的编辑也会令旧 index 失效,必须让下一轮守卫有持久的重试信号。
        fs.writeFileSync(stale, 'sources changed; retry\n')
        throw fail('生成期间源文件变化;产物未完成发布,稍后重试', 'Sources changed during generation; output publication was deferred, retry later')
      }
    }
    return {
      board,
      writeFileSync(path, data, options) { pending.set(pathOf(path), { kind: 'write', data: Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(data, typeof options === 'string' ? options : options?.encoding) }) },
      copyFileSync(src, dest) { pending.set(pathOf(dest), { kind: 'write', data: fs.readFileSync(src) }) },
      mkdirSync(path) { pathOf(path) },
      rmSync(path) { pending.set(pathOf(path), { kind: 'remove' }) },
      finish(assertVersion) {
        let publishing = false
        try {
          check()
          assertVersion()
          // index 是最后一道发布点;每个文件 rename 原子,整块看板没有快照隔离保证。
          const entries = [...pending].sort(([a], [b]) => (a === join(board, 'index.html')) - (b === join(board, 'index.html')))
          fs.writeFileSync(stale, 'generation pending\n')
          publishing = true
          for (const [path, op] of entries) {
            if (path === join(board, 'index.html')) { check(); assertVersion() }
            if (op.kind === 'remove') {
              // 目录只允许删空目录,保留非生成文件和用户添加的内容。
              try { if (fs.statSync(path).isDirectory()) fs.rmdirSync(path); else fs.rmSync(path, { force: true }) }
              catch (e) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(e.code)) throw e }
            } else {
              fs.mkdirSync(dirname(path), { recursive: true })
              const temp = `${path}.ddd-gen-${process.pid}-${randomUUID()}`
              try { fs.writeFileSync(temp, op.data); fs.renameSync(temp, path) }
              finally { fs.rmSync(temp, { force: true }) }
            }
          }
          check()
          fs.rmSync(stale, { force: true })
        } catch (e) {
          if (publishing) fs.writeFileSync(stale, 'generation incomplete; retry\n')
          throw e
        } finally { cleanup() }
      },
    }
  } catch (e) { cleanup(); throw e }
}
