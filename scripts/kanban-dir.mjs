// 看板目录定位(v0.12.0 抽出):gen.mjs 与 pr-sync.mjs 共用同一口径 —— 两个脚本认同一个
// `--dir`,否则「gen 生成的板」与「pr-sync 写的 manifest」会指向两个目录,人却以为是一处。
// 顶层无副作用,可直接 import。保留显式看板路径与旧环境入口,再走 hook 的项目探测。
//
//   --dir <kanbanDir> > 项目环境变量/app/kanban > cwd 看板 > 项目/Git 根探测。
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { detect } from './lib-detect.mjs'

export function resolveKanbanDir(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--dir')
  if (i >= 0) {
    if (!argv[i + 1]) throw new Error('--dir 需要参数:看板目录(含 kanban.config.json)/ --dir requires an argument: the kanban directory (contains kanban.config.json)')
    return resolve(argv[i + 1])
  }
  const project = process.env.DDD_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR
  if (project) {
    const d = join(project, 'app', 'kanban')
    if (existsSync(join(d, 'kanban.config.json'))) return d
  }
  if (existsSync(join(process.cwd(), 'kanban.config.json'))) return process.cwd()
  const found = detect()
  if (found) return found
  throw new Error('定位不到看板目录:传 --dir <kanbanDir>,设 DDD_PROJECT_DIR 或 CLAUDE_PROJECT_DIR,或在项目/看板目录下运行 / Cannot locate the kanban directory: pass --dir <kanbanDir>, set DDD_PROJECT_DIR or CLAUDE_PROJECT_DIR, or run inside the project/kanban directory')
}
