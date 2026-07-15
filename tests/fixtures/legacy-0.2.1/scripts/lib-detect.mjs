// 反向探测(设计 §6):本 plugin 的 hook 全局生效,必须先判定「这是不是 DDD 看板项目」。
//
// 探测键 = <项目根>/app/kanban/kanban.config.json 文件存在(不是目录存在!
// 目录探测会误伤 Next.js app-router 的 app/kanban/ 路由,见 §6-1)。
// 路径 v0.1 写死 app/kanban/(YAGNI,monorepo 自定义路径将来再议)。
//
// 两级查找(§6-2,防「子目录起会话守卫无声下岗」):
//   1. P = $CLAUDE_PROJECT_DIR,缺失回落 process.cwd() → 试 P/app/kanban
//   2. 不中 → 从 P 跑 git rev-parse --show-toplevel 得 root → 试 root/app/kanban
// 两级都不中 → 返回 null(调用方静默 exit 0)。
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const CONFIG = 'kanban.config.json'

/** @returns {string|null} 看板目录绝对路径(含 kanban.config.json),非 DDD 项目返回 null */
export function detect() {
  const P = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const direct = join(P, 'app', 'kanban')
  if (existsSync(join(direct, CONFIG))) return direct
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd: P,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
    if (root) {
      const viaRoot = join(root, 'app', 'kanban')
      if (existsSync(join(viaRoot, CONFIG))) return viaRoot
    }
  } catch {}
  return null
}
