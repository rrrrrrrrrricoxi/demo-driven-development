// 可选多轮导航。摘要只在卡面出现;资料保留在稳定入口,不改旧 demo。
import { journeyStrings } from './strings.mjs'
const object = (v) => v && typeof v === 'object' && !Array.isArray(v)
const text = (v) => typeof v === 'string' && v.trim().length > 0
const esc = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
export const journeyPath = (id) => `journeys/${id}.html`
export function journeyError(card, lang) {
  if (card.journey === undefined) return ''
  const j = card.journey, S = journeyStrings(lang)
  const bad = (field) => S.invalid(card.id, field)
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(String(card.id))) return bad('id')
  if (!object(j)) return bad('journey')
  for (const k of ['decision', 'progress', 'recent']) if (!text(j[k])) return bad(k)
  const url = (v) => text(v) && !/[\u0000-\u0020\u007f\\]/.test(v) && !v.startsWith('//') && (!/^[a-z][a-z0-9+.-]*:/i.test(v) || /^https?:/i.test(v))
  const row = (v, where, required) => {
    if (!object(v) || !text(v.title)) return bad(where + '.title')
    if ((required || v.href !== undefined) && !url(v.href)) return bad(where + '.href')
    for (const k of ['summary', 'date']) if (v[k] !== undefined && typeof v[k] !== 'string') return bad(where + '.' + k)
    if (v.date && !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return bad(where + '.date')
    return ''
  }
  let err = row(j.current, 'current', true); if (err) return err
  if (j.current.links !== undefined) {
    if (!Array.isArray(j.current.links)) return bad('current.links')
    for (const [i, l] of j.current.links.entries()) { err = row(l, `current.links[${i}]`, true); if (err) return err }
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
export function journeySummary(card, lang) {
  if (!card.journey) return ''
  const S = journeyStrings(lang), j = card.journey
  return ['decision', 'progress', 'recent'].map((k) => `<dt>${esc(S[k])}</dt><dd class="x">${esc(j[k])}</dd>`).join('')
}
export function renderJourney(card, { lang, version, resolveLink, shots = '', acceptance = [] }) {
  const S = journeyStrings(lang), j = card.journey
  const href = (s) => esc(journeyHref(resolveLink(s)))
  const link = (l) => `<a href="${href(l.href)}">${esc(l.title)}</a>`
  const row = (l) => `<article>${l.date ? `<time>${esc(l.date)}</time>` : ''}<h3>${l.href ? link(l) : esc(l.title)}</h3>${l.summary ? `<p>${esc(l.summary)}</p>` : ''}</article>`
  const originalText = (v) => typeof v === 'string' ? v : Array.isArray(v) ? v.map(originalText).join('\n') : JSON.stringify(v, null, 2)
  const original = ['repro', 'source', 'question', 'decision', 'demoNote', 'problem', 'approach', 'note', 'detail'].filter((k) => card[k]).map((k) => `<dt>${esc(k)}</dt><dd>${esc(originalText(card[k]))}</dd>`).join('')
  const legacy = [...(card.demo ? [{ title: S.originalDemo, href: card.demo }] : []), ...(card.links || [])]
  const rebase = (html) => html.replace(/\b(href|src)="([^"]*)"/g, (_, key, value) => `${key}="${journeyHref(value)}"`)
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(card.id)} · ${esc(card.title)}</title>
<style>*,*::before,*::after{box-sizing:border-box}a:focus-visible,summary:focus-visible{outline:3px solid #176b8c;outline-offset:4px}body{margin:0;background:#faf9f6;color:#292824;font:16px/1.7 system-ui,sans-serif}header,main{max-width:1000px;margin:auto;padding:24px}nav{position:sticky;top:0;background:#faf9f6;border-bottom:1px solid #dedbd5;padding:12px;display:flex;gap:24px;flex-wrap:wrap;z-index:2}a{color:#176b8c}section{scroll-margin-top:100px;margin-bottom:32px}h1{font-size:26px}h2{font-size:21px}h3{font-size:17px;margin:8px 0}article,details{min-width:0;overflow-wrap:anywhere;padding:16px;border:1px solid #dedbd5;border-radius:8px;margin:12px 0;background:white}p{white-space:pre-wrap}dl{display:grid;grid-template-columns:110px 1fr;gap:12px}dd{min-width:0;overflow-wrap:anywhere;margin:0;white-space:pre-wrap}summary{cursor:pointer}time{font-size:13px;color:#666}img{max-width:180px;max-height:140px;object-fit:contain}.wtshots{display:flex;gap:12px;flex-wrap:wrap}.wtshots a{display:flex;flex-direction:column;max-width:190px}.resources{display:flex;flex-wrap:wrap;gap:16px}.detail .dbody{white-space:normal}footer{padding:24px;color:#666}@media(max-width:600px){header,main{padding:16px}dl{display:block}dt{font-weight:600}dd{margin-bottom:12px}nav{gap:16px}}</style></head><body>
<!-- ddd-gen v${esc(version)} -->
<header><a href="../index.html#${esc(card.id)}">← ${esc(S.board)}</a><h1>${esc(card.id)} · ${esc(card.title)}</h1><dl>${journeySummary(card, lang)}</dl></header>
<nav aria-label="${esc(S.navigation)}"><a href="#current">${esc(S.current)}</a><a href="#history">${esc(S.history)}</a><a href="#development">${esc(S.development)}</a></nav>
<main><section id="current"><h2>${esc(S.current)}</h2>${row(j.current)}<div class="resources">${(j.current.links || []).map(link).join('')}</div></section>
<section id="history"><h2>${esc(S.history)}</h2><details><summary>${esc(S.history)} · ${j.history.length}</summary>${j.history.map(row).join('')}</details><details><summary>${esc(S.resources)} · ${legacy.length}</summary><div class="resources">${legacy.map(link).join('')}</div><dl>${rebase(shots)}</dl></details></section>
<section id="development"><h2>${esc(S.development)}</h2>${j.development.map(row).join('')}${acceptance.length ? `<h3>${esc(S.acceptance)}</h3><div class="resources">${acceptance.map(link).join('')}</div>` : ''}${original ? `<details class="original-records"><summary>${esc(S.originalRecords)}</summary><dl>${original}</dl></details>` : ''}</section></main><footer>${esc(S.source)}</footer></body></html>
`
}
