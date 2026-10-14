#!/usr/bin/env node
// 成本守卫,不是安全边界:只认字面路径的直接读取。变量、别名、解释器和嵌套 shell
// 不做猜测;精准 rg/grep 与确定性脚本照常运行。不要拿一个简化解析器冒充 shell。
import { readFileSync } from 'node:fs'
import { basename, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './lib-detect.mjs'
import { loadStrings } from './strings.mjs'

// 引号中的空格仍属于路径;分隔符切成独立命令。不执行展开或命令替换。
function shellSegments(command) {
  const segments = [], words = []
  let word = '', quote = '', escaped = false, hadWord = false
  const flush = () => { if (hadWord) words.push(word); word = ''; hadWord = false }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (escaped) { word += c; hadWord = true; escaped = false; continue }
    if (c === '\\' && quote !== "'") { escaped = true; continue }
    if (quote) { if (c === quote) quote = ''; else word += c; continue }
    if (c === "'" || c === '"') { quote = c; hadWord = true; continue }
    if (';|&\n'.includes(c)) { flush(); if (words.length) segments.push(words.splice(0)); continue }
    if (/\s/.test(c)) { flush(); continue }
    word += c; hadWord = true
  }
  if (quote || escaped) return [] // 不完整 shell 语句交给宿主,不误拦。
  flush(); if (words.length) segments.push(words)
  return segments
}

export function generatedReads(hook, kanban) {
  const input = hook.tool_input || {}
  const cwd = typeof input.workdir === 'string' ? input.workdir
    : typeof input.cwd === 'string' ? input.cwd
    : typeof hook.cwd === 'string' ? hook.cwd : process.env.DDD_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const candidates = []
  if (hook.tool_name === 'Read' || /(?:^|__)read_file$/.test(hook.tool_name || '')) {
    if (typeof input.file_path === 'string') candidates.push(input.file_path)
    else if (typeof input.path === 'string') candidates.push(input.path)
  } else if (!hook.tool_name || hook.tool_name === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : input.cmd
    if (typeof command === 'string') for (const words of shellSegments(command)) {
      if (!['cat', 'head', 'tail', 'sed', 'less', 'more', 'bat'].includes(basename(words[0]))) continue
      // 所有参数只做路径匹配;选项/数量/脚本不会落在看板产物路径上。
      const args = words.slice(1)
      for (let i = 0; i < args.length; i++) {
        if (/^(?:\d*)>>?$/.test(args[i])) { i++; continue } // 输出重定向是写入,不是读取。
        candidates.push(args[i])
      }
    }
  }
  const paths = []
  for (const path of candidates) {
    if (!path || /[$`]/.test(path)) continue
    const rel = relative(kanban, resolve(cwd, path)).split(sep).join('/')
    if (rel === 'index.html' || rel === 'shots.html' || /^(?:refs|parts)\//.test(rel)) paths.push(path)
  }
  return [...new Set(paths)]
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let hook = {}
  try { hook = JSON.parse(readFileSync(0, 'utf8')) } catch {}
  if (!hook || typeof hook !== 'object') process.exit(0)
  const kanban = detect({ cwd: hook.cwd })
  if (!kanban) process.exit(0)
  const paths = generatedReads(hook, kanban)
  if (paths.length) console.log(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: loadStrings(kanban).generatedReadDenied(paths),
  } }))
}
