// Advisory only: recognize a few verification-report clauses, not product meaning.
// Keep whole-clause anchors: quoting a test result as a product capability is valid.
import { isJourneyDemo } from './journey.mjs'
import { TERMINAL } from './settle.mjs'

export const LONG_TEXT_LIMIT = 800

const REPORTS = [
  /^(?:(?:浏览器|Playwright|Cypress|回归|单元|集成|端到端)\s*[:：]?\s*)?(?:已)?\d+\s*(?:项|个|条)\s*(?:测试|检查|断言|用例)(?:全部|均|已)?通过$/i,
  /^(?:(?:browser|playwright|cypress|unit|integration|e2e)\s*:?\s+)?\d+\s+(?:(?:browser|unit|integration|e2e)\s+)?(?:tests?|checks?|assertions?)\s+(?:all\s+)?passed$/i,
  /^(?:浏览器(?:检查|验证))\s*[:：]\s*无(?:脚本|控制台|console)错误(?:或|和|及)横向溢出$/i,
  /^(?:browser (?:check|verification)|playwright|cypress)\s*:\s*no console errors (?:or|and) (?:no )?horizontal overflow$/i,
]

/** Limited hints for the writing session. Never validate, rewrite, or move evidence. */
export function journeySummaryFields(card) {
  return ['decision', 'progress', 'recent'].filter((field) => {
    const value = card?.journey?.[field]
    return typeof value === 'string' && value.split(/[，,;；。.!?！？\n]/).some((clause) => REPORTS.some((report) => report.test(clause.trim())))
  })
}

/** Long, explicitly dated demo iterations need a readable current view, not more prose. */
export function journeySuggested(card) {
  if (!card || card.journey !== undefined || TERMINAL.has(String(card.status || ''))) return null
  // The demo field is explicit, including hosted demos. General links need a local demo path.
  const hasDemo = (typeof card.demo === 'string' && card.demo.trim()) || (Array.isArray(card.links) && card.links.some((link) => isJourneyDemo(link?.href)))
  if (!hasDemo) return null
  let hit = null
  for (const field of ['note', 'notes', 'decision', 'demoNote']) {
    const text = card[field]
    if (typeof text !== 'string' || text.length <= LONG_TEXT_LIMIT) continue
    // CLI date headings, including repeated updates on one day. Inline dates are references.
    const updates = [...text.matchAll(/(?:^|\n)[ \t]*(?:【\d{4}-\d{2}-\d{2}[^】\n]*】|\[\d{4}-\d{2}-\d{2}[^\]\n]*\])/g)].length
    if (updates >= 3 && (!hit || text.length > hit.n)) hit = { field, n: text.length, updates }
  }
  return hit
}
