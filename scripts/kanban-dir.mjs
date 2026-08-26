// 看板目录定位(v0.12.0 抽出):gen.mjs 与 pr-sync.mjs 共用同一口径 —— 两个脚本认同一个
// `--dir`,否则「gen 生成的板」与「pr-sync 写的 manifest」会指向两个目录,人却以为是一处。
// 顶层无副作用,可直接 import。语义与 0.11.4 的 gen 内联版逐字一致(错误文案也是)。
//
//   --dir <kanbanDir> > $CLAUDE_PROJECT_DIR/app/kanban > cwd(若含 kanban.config.json)
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export function resolveKanbanDir(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--dir')
  if (i >= 0) {
    if (!argv[i + 1]) throw new Error('--dir 需要参数:看板目录(含 kanban.config.json)/ --dir requires an argument: the kanban directory (contains kanban.config.json)')
    return resolve(argv[i + 1])
  }
  if (process.env.CLAUDE_PROJECT_DIR) {
    const d = join(process.env.CLAUDE_PROJECT_DIR, 'app', 'kanban')
    if (existsSync(join(d, 'kanban.config.json'))) return d
  }
  if (existsSync(join(process.cwd(), 'kanban.config.json'))) return process.cwd()
  throw new Error('定位不到看板目录:传 --dir <kanbanDir>,或设 CLAUDE_PROJECT_DIR(取其 app/kanban),或在含 kanban.config.json 的目录下运行 / Cannot locate the kanban directory: pass --dir <kanbanDir>, set CLAUDE_PROJECT_DIR (its app/kanban is used), or run inside a directory containing kanban.config.json')
}
