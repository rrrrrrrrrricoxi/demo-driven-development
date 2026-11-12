// 共用现行资料只解析显式卡号引用,不从状态、正文或 PR 推断产品结论。
import { journeyError } from './journey.mjs'
import { currentRecordsStrings } from './strings.mjs'
export { currentRecordsStrings } from './strings.mjs'

export const CURRENT_FIELDS = ['decision', 'progress', 'recent', 'current']
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const object = (v) => v && typeof v === 'object' && !Array.isArray(v)

// Date.parse 会把 2 月 30 日归一到 3 月;先逐项检查真实日历日期和时区。
export function isContentUpdatedAt(value) {
  if (typeof value !== 'string') return false
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):(\d{2}))$/)
  if (!m) return false
  const [, y, month, day, hour, minute, second = '0', , zone, , zoneHour = '0', zoneMinute = '0'] = m
  const year = Number(y), mon = Number(month)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mon - 1]
  return Boolean(days && Number(day) >= 1 && Number(day) <= days && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59 &&
    (zone === 'Z' || (Number(zoneHour) <= 23 && Number(zoneMinute) <= 59)) && Number.isFinite(Date.parse(value)))
}

export function contentUpdatedAtError(card, lang) {
  return card.contentUpdatedAt !== undefined && !isContentUpdatedAt(card.contentUpdatedAt)
    ? currentRecordsStrings(lang).invalid(card.id, 'contentUpdatedAt (ISO 8601)') : ''
}

/** 校验源数据并返回同序有效卡;无引用卡保留对象身份,所有输入对象均不修改。 */
export function resolveCurrentRecords(cards, lang) {
  const S = currentRecordsStrings(lang)
  const byId = new Map(cards.map((card) => [String(card.id), card]))
  for (const card of cards) {
    const atError = contentUpdatedAtError(card, lang)
    if (atError) throw new Error(atError)
    const j = card.journey
    if (object(j) && own(j, 'currentFrom')) {
      if (typeof j.currentFrom !== 'string' || !j.currentFrom.trim() || j.currentFrom !== j.currentFrom.trim()) throw new Error(S.invalid(card.id, 'journey.currentFrom'))
      if (CURRENT_FIELDS.some((field) => own(j, field))) throw new Error(S.mixed(card.id))
      const err = journeyError(card, lang)
      if (err) throw new Error(err)
    } else {
      const err = journeyError(card, lang)
      if (err) throw new Error(err)
    }
  }
  const resolved = new Map(), visiting = []
  const visit = (card) => {
    const id = String(card.id)
    if (resolved.has(id)) return resolved.get(id)
    if (visiting.includes(id)) throw new Error(S.cycle([...visiting.slice(visiting.indexOf(id)), id]))
    const j = card.journey
    if (!object(j) || !own(j, 'currentFrom')) { resolved.set(id, card); return card }
    const targetId = j.currentFrom
    if (targetId === id) throw new Error(S.self(id))
    const target = byId.get(targetId)
    if (!target) throw new Error(S.missing(id, targetId))
    if (target.journey === undefined) throw new Error(S.noJourney(id, targetId))
    visiting.push(id)
    const source = visit(target)
    visiting.pop()
    const sourceIsReference = own(source.journey, 'currentFrom')
    const sourceId = sourceIsReference ? source.journey.currentSource.id : String(source.id)
    const sourceAt = sourceIsReference ? source.journey.currentSource.contentUpdatedAt : source.contentUpdatedAt
    const next = {
      ...card,
      journey: {
        ...j,
        ...Object.fromEntries(CURRENT_FIELDS.map((field) => [field, source.journey[field]])),
        currentSource: { id: sourceId, via: targetId, ...(sourceAt !== undefined ? { contentUpdatedAt: sourceAt } : {}) },
      },
    }
    resolved.set(id, next)
    return next
  }
  return cards.map(visit)
}

/** 只提示引用关系;不改关联卡,也不把状态当作资料来源。 */
export function currentRecordDependents(cards, id) {
  const byId = new Map(cards.map((card) => [String(card.id), card]))
  return cards.filter((card) => {
    let current = card
    const seen = new Set([String(card.id)])
    while (typeof current?.journey?.currentFrom === 'string') {
      const target = current.journey.currentFrom
      if (target === String(id)) return true
      if (seen.has(target)) return false
      seen.add(target)
      current = byId.get(target)
    }
    return false
  }).map((card) => String(card.id))
}
