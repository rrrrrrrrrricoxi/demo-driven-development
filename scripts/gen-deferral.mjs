// 预期暂缓只跨明确的生成边界传播;未知故障仍保留原异常与堆栈。
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runtimeStrings } from './runtime-strings.mjs'

export const GENERATION_DEFERRED = Object.freeze({
  'sources-changed': 75,
  'lock-timeout': 76,
  'startup-config-race': 77,
})
export class GenerationDeferred extends Error {
  constructor(code, lang) {
    const message = (language) => runtimeStrings(language).genDeferred[code]
    super(`[gen] ${lang ? message(lang) : `${message('zh')} / ${message('en')}`}`)
    this.name = 'GenerationDeferred'
    this.code = code
    this.exitCode = GENERATION_DEFERRED[code]
  }
}
export function deferGeneration(board, code, lang) {
  // marker 是重跑信号,不是产物事务或锁拥有权的凭据。
  writeFileSync(join(board, '.ddd-gen-stale'), `${code}; retry\n`)
  return new GenerationDeferred(code, lang)
}
export function reportGenerationDeferral(error) {
  if (!(error instanceof GenerationDeferred)) throw error
  console.error(error.message)
  process.exit(error.exitCode)
}
