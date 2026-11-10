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
  const link = (l) => `<a href="${href(l.href)}">${esc(l.title)}</a>`
  const row = (l) => `<article class="record">${l.date ? `<time>${esc(l.date)}</time>` : ''}<h3>${esc(l.title)}</h3>${l.summary ? `<p>${esc(l.summary)}</p>` : ''}${l.href ? `<div class="acts">${link(l)}</div>` : ''}</article>`
  const currentLinks = j.current.links || []
  const demoLinks = currentLinks.filter((l) => isJourneyDemo(resolveLink(l.href)))
  const documents = currentLinks.filter((l) => !isJourneyDemo(resolveLink(l.href)))
  const designs = [j.current, ...demoLinks]
  const designId = (i) => i ? 'current-' + i : 'current'
  const originalText = (v) => typeof v === 'string' ? v : Array.isArray(v) ? v.map(originalText).join('\n') : JSON.stringify(v, null, 2)
  const original = ['repro', 'source', 'question', 'decision', 'demoNote', 'problem', 'approach', 'note', 'detail'].filter((k) => card[k]).map((k) => `<dt>${esc(k)}</dt><dd>${esc(originalText(card[k]))}</dd>`).join('')
  const legacy = [...(card.demo ? [{ title: S.originalDemo, href: card.demo }] : []), ...(card.links || [])]
  const rebase = (html) => html.replace(/\b(href|src)="([^"]*)"/g, (_, key, value) => `${key}="${journeyHref(value)}"`)
  const recordNav = (items) => `<nav class="record-nav" aria-label="${esc(S.navigation)}">${items.map(([id, title]) => `<a href="#${id}">${esc(title)}</a>`).join('')}</nav>`
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(card.id)} · ${esc(card.title)}</title>${appearance.boot || ''}
<style>
  :root { --ink:#37352f; --mut:#6f6e6b; --faint:#8a8884; --line:#ededec; --line-strong:#e3e2e0; --bg:#f6f5f2; --card:#fff; --side:#f7f7f5; --accent:#2383e2; --accent-deep:#1a6fc4; --accent-soft:#e7f3f8; --brand:#0f7b6c;${appearance.vars || ''} }
  *,*::before,*::after { box-sizing: border-box; }
  html,body { height: 100%; overflow: hidden; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 ${appearance.font || '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif'}; -webkit-font-smoothing: antialiased; }
  a { color: var(--accent); text-decoration: none; }
  a:focus-visible,summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  /* 原 demo 的 44px 返回栏与 c176 .acts 控件;不另加一层页面标题或卡框。 */
  .backbar { position: fixed; top: 0; left: 0; right: 0; height: 44px; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: var(--bg); border-bottom: 1px solid var(--line-strong); font-size: 13px; }
  .backbar > a { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; border: 1px solid var(--line-strong); border-radius: 8px; padding: 5px 11px; background: var(--card); white-space: nowrap; }
  .backbar > a:hover { border-color: var(--accent); }
  .ctx { color: var(--mut); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .journey-nav { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
  .journey-nav a { padding: 4px 10px; border-radius: 7px; color: var(--mut); white-space: nowrap; font-size: 12.5px; }
  .journey-nav a:hover { background: var(--card); }
  .journey-nav a[aria-current="page"] { background: var(--accent-soft); color: var(--accent-deep); font-weight: 600; }
  .acts { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
  .acts a,.acts button,.acts > details > summary { font: inherit; cursor: pointer; font-size: 12.5px; padding: 4px 10px; border: 1px solid var(--line-strong); border-radius: 7px; background: var(--card); color: var(--ink); text-decoration: none; }
  .acts a:hover,.acts button:hover,.acts > details > summary:hover { border-color: var(--accent); color: var(--accent-deep); }
  .acts .pri { border-color: var(--accent); color: var(--accent-deep); }
  .journey-tools { margin-left: auto; flex-wrap: nowrap; flex-shrink: 0; }
  .journey-tools > a { white-space: nowrap; }
  .journey-tools details > summary { list-style: none; white-space: nowrap; }
  .journey-tools details > summary::-webkit-details-marker { display: none; }
  .journey-tools details[open] > summary { border-color: var(--accent); }
  .resource-menu { position: absolute; top: 43px; right: 16px; width: min(540px,calc(100vw - 32px)); max-height: calc(100dvh - 60px); overflow: auto; padding: 14px 16px; border: 1px solid var(--line-strong); border-radius: 7px; background: var(--card); }
  .resource-menu h2 { font-size: 14px; margin: 0 0 6px; }
  .resource-menu p { color: var(--mut); font-size: 13px; }
  .resource-menu .acts { margin: 10px 0; }
  main { position: fixed; inset: 44px 0 0; }
  main > section { width: 100%; height: 100%; }
  section[hidden] { display: none; }
  .demo-viewport { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--card); }
  .demo-frame { position: absolute; left: 0; top: calc(-1 * var(--demo-backnav,0px)); width: 100%; height: calc(100% + var(--demo-backnav,0px)); border: 0; background: var(--card); }
  /* 记录页复用 c176 的固定目录,现行 demo 保留自己的侧栏。 */
  .record-view { overflow-y: auto; }
  .record-nav { position: fixed; top: 44px; left: 0; bottom: 0; width: 180px; overflow-y: auto; padding: 16px 8px 60px; background: var(--side); border-right: 1px solid var(--line); }
  .record-nav a { display: block; color: var(--ink); font-size: 13px; padding: 6px 10px; border-left: 2px solid transparent; border-radius: 0 7px 7px 0; }
  .record-nav a:hover { background: var(--card); }
  .record-nav a[aria-current="location"] { background: var(--accent-soft); border-left-color: var(--accent); font-weight: 600; }
  .record-content { margin-left: 180px; padding: 18px 22px 60px; }
  h1 { font-size: 17px; margin: 0 0 14px; }
  h2 { font-size: 17px; margin: 0 0 12px; }
  h3 { font-size: 15px; margin: 4px 0 8px; }
  p { margin: 6px 0 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .record { padding: 12px 0; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
  .record p { font-size: 13.5px; color: var(--mut); }
  .record-content > details { min-width: 0; overflow-wrap: anywhere; margin: 12px 0; padding: 11px 14px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
  details > summary { cursor: pointer; font-size: 13.5px; font-weight: 600; }
  .record-content > details[open] > summary { margin-bottom: 12px; }
  time { color: var(--faint); font-size: 11.5px; }
  .journey-summary { margin: 0; font-size: 13.5px; }
  .original-records dl { display: grid; grid-template-columns: max-content minmax(0,1fr); gap: 8px 16px; font-size: 13px; }
  dd { min-width: 0; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .wtshots { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .wtshots a { display: block; width: 138px; color: var(--mut); text-decoration: none; font-size: 11px; }
  .wtshots img { width: 100%; height: 86px; object-fit: cover; object-position: top; border: 1px solid var(--line); border-radius: 6px; }
  .wtshots span { display: block; margin-top: 3px; }
  footer { color: var(--mut); font-size: 12.5px; margin-top: 24px; }
  @media (max-width:800px) { .ctx { display:none; } .backbar { gap:6px; padding:0 8px; } .journey-nav a { padding:4px 7px; } }
  @media (max-width:600px) { .record-nav { display:none; } .record-content { margin-left:0; padding-left:16px; padding-right:16px; } .backbar > a { font-size:12px; padding:5px 7px; } .journey-nav { gap:0; } .journey-nav a { font-size:12px; padding:4px 5px; } .journey-tools > a,.journey-tools #themetoggle { display:none; } .journey-tools > details > summary { font-size:12px; padding:4px 6px; } .original-records dl { grid-template-columns:minmax(0,1fr); } }
  ${JOURNEY_SUMMARY_CSS}${appearance.css || ''}
</style>${appearance.theme || ''}</head><body>
<!-- ddd-gen v${esc(version)} -->
<header class="backbar"><a href="../index.html#${esc(card.id)}">← ${esc(S.board)}</a><span class="ctx">${esc(card.id)} · ${esc(card.title)}</span><nav class="journey-nav" aria-label="${esc(S.navigation)}"><a href="#current" aria-current="page">${esc(S.current)}</a><a href="#history">${esc(S.history)}</a><a href="#development">${esc(S.development)}</a></nav><div class="acts journey-tools"><details class="journey-current-links"><summary>${esc(S.currentResources)}</summary><div class="resource-menu"><h2>${esc(j.current.title)}</h2>${j.current.summary ? `<p>${esc(j.current.summary)}</p>` : ''}<div class="acts">${designs.map((l, i) => `<a href="#${designId(i)}">${esc(l.title)}</a>`).join('')}${documents.map(link).join('')}</div><details class="journey-status"><summary>${esc(S.overview)}</summary><dl class="journey-summary">${journeySummary(card, lang)}</dl></details><div class="acts"><a href="${href(j.current.href)}" target="_blank" rel="noopener">${esc(S.open)}</a></div></div></details><a class="pri standalone-demo" href="${href(j.current.href)}" target="_blank" rel="noopener">${esc(S.open)}</a>${appearance.toggle || ''}</div></header>
<main>${designs.map((l, i) => `<section id="${designId(i)}" class="current-design"${i ? ' hidden' : ''}>${isJourneyDemo(resolveLink(l.href)) ? `<div class="demo-viewport"><iframe class="demo-frame" src="${href(l.href)}" title="${esc(l.title)}" loading="${i ? 'lazy' : 'eager'}"></iframe></div>` : `<div class="record-content"><h1>${esc(l.title)}</h1>${l.summary ? `<p>${esc(l.summary)}</p>` : ''}<div class="acts">${link(l)}</div></div>`}</section>`).join('')}
<section id="history" class="record-view" hidden>${recordNav([['history', S.history], ['history-resources', S.resources]])}<div class="record-content"><h1>${esc(S.history)}</h1><details id="history-records"><summary>${esc(S.history)} · ${j.history.length}</summary>${j.history.map(row).join('')}</details><details id="history-resources"><summary>${esc(S.resources)} · ${legacy.length}</summary><div class="acts">${legacy.map(link).join('')}</div><dl>${rebase(shots)}</dl></details><footer>${esc(S.source)}</footer></div></section>
<section id="development" class="record-view" hidden>${recordNav([['development', S.development], ...(acceptance.length ? [['development-acceptance', S.acceptance]] : []), ...(original ? [['development-original', S.originalRecords]] : [])])}<div class="record-content"><h1>${esc(S.development)}</h1>${j.development.map(row).join('')}${acceptance.length ? `<h2 id="development-acceptance">${esc(S.acceptance)}</h2><div class="acts">${acceptance.map(link).join('')}</div>` : ''}${original ? `<details id="development-original" class="original-records"><summary>${esc(S.originalRecords)}</summary><dl>${original}</dl></details>` : ''}<footer>${esc(S.source)}</footer></div></section></main>
<script>
  (function () {
    var sections = Array.from(document.querySelectorAll('main > section'))
    var links = Array.from(document.querySelectorAll('.journey-nav a'))
    var currentUrls = ${JSON.stringify(designs.map((l) => journeyHref(resolveLink(l.href)))).replaceAll('<', '\\u003c')}
    function showSection() {
      var target = document.getElementById(location.hash.slice(1))
      var section = target && target.closest('main > section')
      var id = section ? section.id : 'current'
      sections.forEach(function (s) { s.hidden = s.id !== id })
      links.forEach(function (a) { if (a.hash === '#' + (id.indexOf('current') === 0 ? 'current' : id)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current') })
      document.querySelectorAll('.record-nav a').forEach(function (a) { if (a.hash === location.hash || (!location.hash && a.hash === '#current')) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current') })
      var index = id === 'current' ? 0 : Number(id.replace('current-', ''))
      var standalone = document.querySelector('.standalone-demo')
      standalone.href = currentUrls[index] || currentUrls[0]
      document.querySelector('.journey-current-links').open = false
      var active = document.getElementById(id)
      active.querySelectorAll('.demo-frame').forEach(function (frame) { frame.dispatchEvent(new Event('ddd-show')) })
      if (target && target !== section) { if (target.tagName === 'DETAILS') target.open = true; target.scrollIntoView() }
    }
    window.addEventListener('hashchange', showSection)
    showSection()
    document.querySelectorAll('.demo-frame').forEach(function (frame) {
      function wireBacknav() {
        frame.style.removeProperty('--demo-backnav')
        try {
          var doc = frame.contentDocument
          if (!doc) return
          var board = new URL(document.querySelector('.backbar > a').href)
          var bars = Array.from(doc.querySelectorAll('#ddd-backnav,nav'))
          var bar = bars.find(function (nav) {
            var style = frame.contentWindow.getComputedStyle(nav), bounds = nav.getBoundingClientRect()
            return style.position === 'fixed' && bounds.top === 0 && bounds.height > 0 && bounds.height <= 64 && Array.from(nav.querySelectorAll('a')).some(function (a) { return new URL(a.href).pathname === board.pathname })
          })
          if (bar) {
            // 裁去旧返回栏的高度,保持内页原始 viewport 与固定控件坐标。
            frame.style.setProperty('--demo-backnav', bar.getBoundingClientRect().height + 'px')
            bar.querySelectorAll('a').forEach(function (a) {
              if (new URL(a.href).pathname === board.pathname) { a.href = board.href; a.target = '_top' }
            })
          }
        } catch (e) { /* A demo may navigate to an external page. */ }
      }
      frame.addEventListener('load', wireBacknav)
      frame.addEventListener('ddd-show', wireBacknav)
      wireBacknav()
    })
  })();${appearance.script || ''}
</script></body></html>
`
}
