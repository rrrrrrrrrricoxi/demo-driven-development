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
  return ['decision', 'progress', 'recent'].map((k) => `<div class="journey-summary-row"><dt>${esc(S[k])}</dt><dd class="x">${esc(j[k])}</dd></div>`).join('')
}
// 每组自成一行,覆盖旧卡面两字宽的 float 规则;仅启用 journey 的看板注入。
export const JOURNEY_SUMMARY_CSS = `
  dl.journey-summary { display: grid; gap: 8px; }
  .journey-summary > .journey-summary-row { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 12px; align-items: start; }
  dl.journey-summary > .journey-summary-row > dt { float: none; clear: none; width: auto; white-space: nowrap; color: var(--mut); font-weight: 600; }
  dl.journey-summary > .journey-summary-row > dd { min-width: 0; margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
  @media (max-width: 480px) { .journey-summary > .journey-summary-row { grid-template-columns: minmax(0, 1fr); gap: 2px; } }
`
// 只内嵌站内 demo HTML,不把规格、外部站点或看板自身装进 iframe。
export function isJourneyDemo(href) {
  const s = String(href)
  return /^(?:\.\/)?demos\/[^?#]+\.html?(?:[?#]|$)/i.test(s) && new URL(s, 'https://board.invalid/').pathname.startsWith('/demos/')
}
export function renderJourney(card, { lang, version, resolveLink, shots = '', acceptance = [], appearance = {} }) {
  const S = journeyStrings(lang), j = card.journey
  const href = (s) => esc(journeyHref(resolveLink(s)))
  const link = (l) => `<a class="resource-link" href="${href(l.href)}">${esc(l.title)}</a>`
  const row = (l) => `<article class="record">${l.date ? `<time>${esc(l.date)}</time>` : ''}<h3>${esc(l.title)}</h3>${l.summary ? `<p>${esc(l.summary)}</p>` : ''}${l.href ? `<div class="resources">${link(l)}</div>` : ''}</article>`
  const demo = (l, lazy = true) => `<iframe class="demo-frame" src="${href(l.href)}" title="${esc(l.title)}" loading="${lazy ? 'lazy' : 'eager'}"></iframe><div class="demo-actions"><a class="resource-link" href="${href(l.href)}" target="_blank" rel="noopener">${esc(S.standalone)}</a></div>`
  const currentLinks = j.current.links || []
  const demoLinks = currentLinks.filter((l) => isJourneyDemo(resolveLink(l.href)))
  const documents = currentLinks.filter((l) => !isJourneyDemo(resolveLink(l.href)))
  const originalText = (v) => typeof v === 'string' ? v : Array.isArray(v) ? v.map(originalText).join('\n') : JSON.stringify(v, null, 2)
  const original = ['repro', 'source', 'question', 'decision', 'demoNote', 'problem', 'approach', 'note', 'detail'].filter((k) => card[k]).map((k) => `<dt>${esc(k)}</dt><dd>${esc(originalText(card[k]))}</dd>`).join('')
  const legacy = [...(card.demo ? [{ title: S.originalDemo, href: card.demo }] : []), ...(card.links || [])]
  const rebase = (html) => html.replace(/\b(href|src)="([^"]*)"/g, (_, key, value) => `${key}="${journeyHref(value)}"`)
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(card.id)} · ${esc(card.title)}</title>${appearance.boot || ''}
<style>
  :root { --ink:#37352f; --mut:#6f6e6b; --faint:#8a8884; --line:#ededec; --line-strong:#e3e2e0; --bg:#f6f5f2; --card:#fff; --accent:#2383e2; --accent-deep:#1a6fc4; --accent-soft:#e7f3f8; --brand:#0f7b6c;${appearance.vars || ''} }
  *,*::before,*::after { box-sizing: border-box; }
  html { scrollbar-gutter: stable; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 ${appearance.font || '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif'}; -webkit-font-smoothing: antialiased; }
  a { color: var(--accent); }
  a:focus-visible,summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
  .wrap { max-width: 1060px; margin: 0 auto; padding: 20px; }
  .journey-head { padding-top: 14px; padding-bottom: 12px; }
  .backbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .backbar a { font-size: 12.5px; text-decoration: none; }
  h1 { font-size: 21px; margin: 0 0 8px; letter-spacing: -.01em; }
  h2 { font-size: 17px; margin: 0; }
  h3 { font-size: 15px; margin: 4px 0 8px; }
  .journey-summary { margin: 0; font-size: 13.5px; }
  .nav-shell { position: sticky; top: 0; z-index: 2; background: var(--bg); border-bottom: 1px solid var(--line-strong); }
  .journey-nav { display: flex; gap: 8px; padding-top: 0; padding-bottom: 0; overflow-x: auto; }
  .journey-nav a { flex: none; padding: 9px 16px; border-bottom: 2px solid transparent; color: var(--mut); font-weight: 600; text-decoration: none; }
  .journey-nav a[aria-current="page"] { color: var(--accent); border-bottom-color: var(--accent); }
  main.wrap { padding-bottom: 60px; }
  main > section { scroll-margin-top: 64px; }
  section[hidden] { display: none; }
  .section-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px 16px; padding-bottom: 10px; border-bottom: 1px solid var(--line-strong); margin-bottom: 16px; }
  .current-design { border: 1px solid var(--line); border-radius: 12px; background: var(--card); overflow: hidden; }
  .current-intro { padding: 14px 16px; }
  p { margin: 6px 0 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .current-intro p,.record p { font-size: 13.5px; color: var(--mut); }
  .demo-frame { display: block; width: 100%; height: 720px; border: 0; border-top: 1px solid var(--line); background: var(--card); }
  .demo-actions { padding: 10px 16px; border-top: 1px solid var(--line); }
  .resources { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .resource-link { display: inline-flex; align-items: center; font-size: 12.5px; line-height: 1.6; text-decoration: none; border: 1px solid var(--line-strong); background: var(--card); border-radius: 7px; padding: 3px 11px; overflow-wrap: anywhere; }
  .resource-link:hover { border-color: var(--accent); }
  .resource-link.primary { color: #fff; background: var(--accent); border-color: var(--accent); font-weight: 600; }
  .record,details { min-width: 0; overflow-wrap: anywhere; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; margin: 12px 0; background: var(--card); }
  details > summary { cursor: pointer; font-size: 13.5px; font-weight: 600; }
  details[open] > summary { margin-bottom: 12px; }
  details.journey-status { border: 0; background: transparent; padding: 0; margin: 0; }
  .journey-status > summary { color: var(--mut); font-size: 12.5px; }
  .demo-option { padding: 0; overflow: hidden; }
  .demo-option > summary { padding: 12px 16px; }
  .demo-option[open] > summary { margin-bottom: 0; }
  time { color: var(--faint); font-size: 11.5px; }
  .original-records dl { display: grid; grid-template-columns: max-content minmax(0,1fr); gap: 8px 16px; font-size: 13px; }
  dd { min-width: 0; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .wtshots { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .wtshots a { display: block; width: 138px; color: var(--mut); text-decoration: none; font-size: 11px; }
  .wtshots img { width: 100%; height: 86px; object-fit: cover; object-position: top; border: 1px solid var(--line); border-radius: 6px; }
  .wtshots span { display: block; margin-top: 3px; }
  footer.wrap { color: var(--mut); font-size: 12.5px; border-top: 1px solid var(--line); }
  @media (max-width:600px) { .wrap { padding-left:16px; padding-right:16px; } h1 { font-size:21px; } .journey-nav a { padding:9px 10px; font-size:13px; } .demo-frame { height:650px; } .original-records dl { grid-template-columns:minmax(0,1fr); } }
  ${JOURNEY_SUMMARY_CSS}${appearance.css || ''}
</style>${appearance.theme || ''}</head><body>
<!-- ddd-gen v${esc(version)} -->
<header class="wrap journey-head"><div class="backbar"><a href="../index.html#${esc(card.id)}">← ${esc(S.board)}</a>${appearance.toggle || ''}</div><h1>${esc(card.id)} · ${esc(card.title)}</h1><details class="journey-status"><summary>${esc(S.overview)}</summary><dl class="journey-summary">${journeySummary(card, lang)}</dl></details></header>
<div class="nav-shell"><nav class="wrap journey-nav" aria-label="${esc(S.navigation)}"><a href="#current" aria-current="page">${esc(S.current)}</a><a href="#history">${esc(S.history)}</a><a href="#development">${esc(S.development)}</a></nav></div>
<main class="wrap"><section id="current"><div class="section-head"><h2>${esc(S.current)}</h2></div><article class="current-design"><div class="current-intro"><h3>${esc(j.current.title)}</h3>${j.current.summary ? `<p>${esc(j.current.summary)}</p>` : ''}<div class="resources">${documents.map(link).join('')}${!isJourneyDemo(resolveLink(j.current.href)) ? link(j.current) : ''}</div></div>${isJourneyDemo(resolveLink(j.current.href)) ? demo(j.current, false) : ''}</article>${demoLinks.map((l) => `<details class="demo-option"><summary>${esc(l.title)}</summary>${l.summary ? `<p class="current-intro">${esc(l.summary)}</p>` : ''}${demo(l)}</details>`).join('')}</section>
<section id="history"><h2>${esc(S.history)}</h2><details><summary>${esc(S.history)} · ${j.history.length}</summary>${j.history.map(row).join('')}</details><details><summary>${esc(S.resources)} · ${legacy.length}</summary><div class="resources">${legacy.map(link).join('')}</div><dl>${rebase(shots)}</dl></details></section>
<section id="development"><h2>${esc(S.development)}</h2>${j.development.map(row).join('')}${acceptance.length ? `<h3>${esc(S.acceptance)}</h3><div class="resources">${acceptance.map(link).join('')}</div>` : ''}${original ? `<details class="original-records"><summary>${esc(S.originalRecords)}</summary><dl>${original}</dl></details>` : ''}</section></main><footer class="wrap">${esc(S.source)}</footer>
<script>
  (function () {
    var sections = Array.from(document.querySelectorAll('main > section'))
    var links = Array.from(document.querySelectorAll('.journey-nav a'))
    function showSection() {
      var id = location.hash.slice(1)
      if (!sections.some(function (s) { return s.id === id })) id = 'current'
      sections.forEach(function (s) { s.hidden = s.id !== id })
      links.forEach(function (a) { if (a.hash === '#' + id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current') })
    }
    window.addEventListener('hashchange', showSection)
    showSection()
    document.querySelectorAll('.demo-frame').forEach(function (frame) {
      function wireBacknav() {
        try {
          if (frame.contentDocument) frame.contentDocument.querySelectorAll('#ddd-backnav a').forEach(function (a) {
            a.href = document.querySelector('.backbar a').href
            a.target = '_top'
          })
        } catch (e) { /* A demo may navigate to an external page. */ }
      }
      frame.addEventListener('load', wireBacknav)
      wireBacknav()
    })
  })();${appearance.script || ''}
</script></body></html>
`
}
