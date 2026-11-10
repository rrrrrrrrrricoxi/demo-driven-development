// cards-split / cards-join 共用件(v0.14.0)。两个脚本是一件事的两个方向,所以「跑一遍 gen 拿产物
// 快照 → 改文件 → 再跑一遍 gen → 逐字节比 → 不同就把改动前的文件写回」这套动作只写一份。
//
// 为什么要自带这一步:一卡一文件是纯搬运,产物不该变。「产物变了」= 搬运有 bug,这时候最不该做的
// 事就是把一块搬坏的板留在人家仓库里 —— 所以不是报个警了事,是原样写回,让人看不出发生过。
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripCardUpdated } from './cards.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/** 产物集:index.html + shots.html + parts/*.html + refs/*(refs 只比 sha,里面是整份文档) */
export function productFiles(kanbanDir) {
  const out = []
  for (const f of ['index.html', 'shots.html']) if (existsSync(join(kanbanDir, f))) out.push(f)
  for (const sub of ['parts', 'refs']) {
    let names = []
    try { names = readdirSync(join(kanbanDir, sub)).sort() } catch { continue }
    for (const n of names) {
      try { if (!statSync(join(kanbanDir, sub, n)).isFile()) continue } catch { continue }
      out.push(`${sub}/${n}`)
    }
  }
  return out
}

// 去戳:版本戳每次生成都一样,但拆分前后若跨了版本就会差一行,先剥掉再比。
// 去「更新」时间戳:一卡一文件唯一被允许新增的字节(卡头灰字 + 它那条 CSS),见 cards.mjs。
const norm = (text) => stripCardUpdated(String(text).replace(/<!-- ddd-gen v[0-9.]+ -->\n?/g, ''))

/** 产物快照:相对路径 → 归一化后的内容(refs 里可能是二进制复制件,读不成文本就退 base64) */
export function snapshot(kanbanDir) {
  const snap = new Map()
  for (const rel of productFiles(kanbanDir)) {
    const buf = readFileSync(join(kanbanDir, rel))
    snap.set(rel, rel.endsWith('.html') ? norm(buf.toString('utf8')) : buf.toString('base64'))
  }
  return snap
}

/** 两份快照的差异清单(缺件也算差异) */
export function snapDiff(a, z) {
  const keys = [...new Set([...a.keys(), ...z.keys()])].sort()
  return keys.filter((k) => a.get(k) !== z.get(k))
}

/** 跑 gen(与本脚本同目录的那份);返回 { ok, err } */
export function runGen(kanbanDir) {
  const r = spawnSync(process.execPath, [join(HERE, 'gen.mjs'), '--dir', kanbanDir], { encoding: 'utf8' })
  return { ok: r.status === 0, err: (r.stderr || r.error?.message || `exit ${r.status}`).toString().trim() }
}

/**
 * 改动前的现场:记下将被改写的文件原文与将被创建的路径,回滚时原样写回 / 删掉。
 * 只管自己动过的东西 —— 不碰别人的文件是回滚敢做的前提。
 */
export function makeUndo() {
  const restore = [] // { path, text } —— 回滚时按原文写回(可能当下已被删掉)
  const created = [] // 本次新建的文件,回滚时删掉
  const dirs = [] // 本次新建的目录,回滚时逆序删(空才删得掉,正合意)
  return {
    /** 就地改写一个已有文件:先记原文 */
    keep(path) { restore.push({ path, text: readFileSync(path, 'utf8') }) },
    /** 新建一个文件 */
    write(path, text) { created.push(path); writeFileSync(path, text) },
    /** 新建一个目录(顺手建出来的每一层父目录也记下,回滚时一起收走 —— 别留空壳) */
    mkdir(path) {
      if (existsSync(path)) return
      const missing = []
      for (let p = path; !existsSync(p) && dirname(p) !== p; p = dirname(p)) missing.unshift(p)
      mkdirSync(path, { recursive: true })
      dirs.push(...missing)
    },
    /** 删掉一个已有文件:先记原文,回滚时连目录一起补回来 */
    drop(path) { restore.push({ path, text: readFileSync(path, 'utf8') }); rmSync(path) },
    /** 删掉一个(此刻应已空的)目录 */
    dropDir(path) { try { rmdirSync(path) } catch {} },
    rollback() {
      for (const p of created) { try { rmSync(p) } catch {} }
      for (const r of restore) { mkdirSync(dirname(r.path), { recursive: true }); writeFileSync(r.path, r.text) }
      for (const d of [...dirs].reverse()) { try { rmdirSync(d) } catch {} }
    },
  }
}

/** 原子落盘:同目录 tmp + rename(半截文件永远不会出现在 manifest 的位置上) */
export function atomicWrite(path, text) {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, text)
  renameSync(tmp, path)
}

/** JSON 读写:形制与三份 manifest 一致(2 空格 + 末尾换行) */
export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
export const jsonText = (o) => JSON.stringify(o, null, 2) + '\n'
