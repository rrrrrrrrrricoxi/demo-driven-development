// 反向探测(设计 §6):本 plugin 的 hook 全局生效,必须先判定「这是不是 DDD 看板项目」。
//
// 探测键 = <项目根>/app/kanban/kanban.config.json 文件存在(不是目录存在!
// 目录探测会误伤 Next.js app-router 的 app/kanban/ 路由,见 §6-1)。
// 路径 v0.1 写死 app/kanban/(YAGNI,monorepo 自定义路径将来再议)。
//
// P = DDD_PROJECT_DIR > 事件 cwd > CLAUDE_PROJECT_DIR > 进程 cwd。
// 先认看板目录本身,再试 P/app/kanban,最后经 Git 根查找(含 worktree)。
// 全不中 → 返回 null(调用方静默 exit 0)。
import { statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const CONFIG = 'kanban.config.json'

/** @returns {string|null} 看板目录绝对路径(含 kanban.config.json),非 DDD 项目返回 null */
export function detect({ cwd } = {}) {
  // DDD 显式上下文优先;事件 cwd 防止从别的目录启动 hook 时误判项目。
  const eventCwd = typeof cwd === 'string' && cwd ? cwd : null
  const P = resolve(process.env.DDD_PROJECT_DIR || eventCwd || process.env.CLAUDE_PROJECT_DIR || process.cwd())
  const configured = (dir) => { try { return statSync(join(dir, CONFIG)).isFile() } catch { return false } }
  if (configured(P)) return P // 保留直接从看板目录运行 CLI 的入口。
  const direct = join(P, 'app', 'kanban')
  if (configured(direct)) return direct
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd: P,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
    if (root) {
      const viaRoot = join(root, 'app', 'kanban')
      if (configured(viaRoot)) return viaRoot
    }
  } catch {}
  return null
}
