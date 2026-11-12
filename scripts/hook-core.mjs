// Harness-neutral dispatcher. Callers own event normalization, authorization,
// lifecycle invocation, and translating results back to their harness.
import { checkGeneratedRead, checkMerge, remindPullRequest, followUpCardWrite } from './hook-tool-rules.mjs'
import { checkSettlement } from './hook-settle.mjs'

export function runHook(request, { regenerate = false } = {}) {
  switch (request.event) {
    case 'before-tool': {
      const read = checkGeneratedRead(request)
      if (read.kind !== 'none' || read.notice || read.additionalContext) return read
      return checkMerge(request)
    }
    case 'after-tool': {
      const card = followUpCardWrite(request)
      return card.additionalContext ? card : remindPullRequest(request)
    }
    case 'settle': return checkSettlement(request, { regenerate })
    default: return { kind: 'none' }
  }
}
