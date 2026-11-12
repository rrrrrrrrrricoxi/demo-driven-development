// 写卡后的局部收尾:只报告明确目标卡的事实,不认领整板、不改资料或人工判定。
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditJourneySuggestions, auditJourneySummaries, auditRichText, makeCtx } from './audits.mjs'
import { loadStrings } from './strings.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'"

export function cardCloseout(kanban, id) {
  const S = loadStrings(kanban)
  const command = `node ${quote(join(HERE, 'ddd.mjs'))}`
  const target = `--dir ${quote(kanban)}`
  const audit = `${command} audit ${target} --json`
  // 收尾是附加核对;其它源文件损坏时不能把已经成功的写卡变成失败。
  try {
    const ctx = makeCtx(kanban)
    // 用相同审计判据,仅收窄卡集合;Git 新旧卡判定和配置仍来自真实看板。
    const only = read => (...args) => read(...args).filter(card => String(card?.id) === String(id))
    const scoped = { ...ctx, rawCardsOf: only(ctx.rawCardsOf), cardsOf: only(ctx.cardsOf) }
    const findings = [...auditJourneySuggestions(scoped, S), ...auditJourneySummaries(scoped, S), ...auditRichText(scoped, S)]
    if (!findings.length) return ''
    return S.cardCloseout(String(id), findings.map(entry => entry.text).join('\n'), {
      show: `${command} card show ${quote(id)} ${target} --json`,
      audit,
      detail: `${command} card set ${quote(id)} detail ${target}`,
      journey: `${command} card set ${quote(id)} journey ${target} --json`,
    })
  } catch { return S.cardCloseoutUnavailable(String(id), audit) }
}
