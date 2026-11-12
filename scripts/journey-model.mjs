// Journey 的源数据校验与路径规则;不依赖 HTML 渲染。
import { journeyStrings } from './strings.mjs'
const object = (v) => v && typeof v === 'object' && !Array.isArray(v)
const text = (v) => typeof v === 'string' && v.trim().length > 0
// 绝对 URL 必须能独立解析;相对路径、query 和 hash 使用看板基址。
export const parseJourneyUrl = (value) => new URL(value, /^[a-z][a-z0-9+.-]*:/i.test(value) ? undefined : 'https://board.invalid/')
export const journeyPath = (id) => `journeys/${id}.html`
export function journeyError(card, lang) {
  if (card.journey === undefined) return ''
  const j = card.journey, S = journeyStrings(lang)
  const bad = (field) => S.invalid(card.id, field)
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(String(card.id))) return bad('id')
  if (!object(j)) return bad('journey')
  const referenced = j.currentFrom !== undefined
  if (referenced) {
    if (!text(j.currentFrom) || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(j.currentFrom)) return bad('currentFrom')
    for (const k of ['decision', 'progress', 'recent', 'current']) if (j[k] !== undefined) return bad(k)
  } else for (const k of ['decision', 'progress', 'recent']) if (!text(j[k])) return bad(k)
  const url = (v) => {
    if (!text(v) || /[\u0000-\u0020\u007f\\]/.test(v) || v.startsWith('//') || (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v))) return false
    try { parseJourneyUrl(v); return true } catch { return false }
  }
  const row = (v, where, required) => {
    if (!object(v) || !text(v.title)) return bad(where + '.title')
    if ((required || v.href !== undefined) && !url(v.href)) return bad(where + '.href')
    for (const k of ['summary', 'date']) if (v[k] !== undefined && typeof v[k] !== 'string') return bad(where + '.' + k)
    if (v.date && !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return bad(where + '.date')
    return ''
  }
  if (!referenced && card.designDoc && !url(card.designDoc)) return bad('designDoc')
  let err = referenced ? '' : row(j.current, 'current', true); if (err) return err
  if (!referenced && j.current.links !== undefined) {
    if (!Array.isArray(j.current.links)) return bad('current.links')
    for (const [i, l] of j.current.links.entries()) {
      err = row(l, `current.links[${i}]`, true); if (err) return err
      if (l.role !== undefined && !['demo', 'document', 'preview'].includes(l.role)) return bad(`current.links[${i}].role`)
    }
  }
  for (const key of ['history', 'development']) {
    if (!Array.isArray(j[key])) return bad(key)
    for (const [i, l] of j[key].entries()) { err = row(l, `${key}[${i}]`, false); if (err) return err }
  }
  return ''
}
// 入口位于 journeys/;卡链接先按原有文档规则解析,再退一级。hash 指向看板。
export function journeyHref(href) {
  const s = String(href ?? '')
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return /^https?:/i.test(s) ? s : '#'
  if (/[\u0000-\u0020\u007f\\]/.test(s) || s.startsWith('//')) return '#'
  return s.startsWith('#') ? '../index.html' + s : s.startsWith('/') ? s : '../' + s
}
// 只内嵌站内 demo HTML,不把规格、外部站点或看板自身装进 iframe。
export function isJourneyDemo(href) {
  const s = String(href)
  return /^(?:\.\/)?demos\/[^?#]+\.html?(?:[?#]|$)/i.test(s) && new URL(s, 'https://board.invalid/').pathname.startsWith('/demos/')
}
