#!/usr/bin/env node
// 合成板与生成脚本运行时验证;不读取用户看板。
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'
import { journeyError, currentResources, renderJourney } from '../scripts/journey.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = mkdtempSync(join(tmpdir(), 'ddd-current-render-'))
const board = join(root, 'app/kanban')
mkdirSync(join(board, 'cards/decisions'), { recursive: true })
mkdirSync(join(board, 'cards/backlog'), { recursive: true })
mkdirSync(join(board, 'demos'), { recursive: true })
const save = (name, value) => writeFileSync(join(board, name), JSON.stringify(value, null, 2) + '\n')
const fill = (s) => s.replaceAll('{{BRAND}}', 'CURRENT').replaceAll('{{GH_REPO}}', 'owner/repo').replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '')
const cfg = JSON.parse(fill(readFileSync(join(repo, 'templates/kanban.config.json'), 'utf8')))
Object.assign(cfg, { cardsDir: 'cards', concurrentSessions: true, lazyTabs: true })
save('kanban.config.json', cfg)
for (const name of ['manifest', 'backlog-manifest', 'decisions-manifest']) {
  const value = JSON.parse(fill(readFileSync(join(repo, 'templates/manifests', name + '.json'), 'utf8')))
  if (name === 'backlog-manifest') delete value.items
  if (name === 'decisions-manifest') delete value.entries
  save(name + '.json', value)
}
const source = { id: 'D1', code: 'D1', title: 'Authority', status: 'decided', contentUpdatedAt: '2026-11-12T01:02:03.000Z', designDoc: './refs/spec.html', journey: {
  decision: 'Shared decision', progress: 'Shared progress', recent: 'Shared recent',
  current: { title: 'Current demo', href: 'demos/current.html', links: [
    { title: 'Repeated main', href: './demos/current.html' },
    { title: 'Specification', href: 'refs/spec.html', role: 'document' },
    { title: 'Same specification', href: './refs/spec.html', role: 'document' },
    { title: 'Query variant', href: 'refs/spec.html?q=1', role: 'document' },
    { title: 'Fragment variant', href: 'refs/spec.html#details', role: 'document' },
    { title: 'External preview', href: 'https://example.test/demo.html', role: 'preview' },
    { title: 'Local preview', href: 'demos/preview.html', role: 'preview' },
  ] }, history: [{ title: 'Authority history' }], development: [],
} }
const reference = { id: 'D2', code: 'D2', title: 'Reference', status: 'decided', contentUpdatedAt: '2026-11-10T12:00:00Z', designDoc: 'refs/old-spec.html', detail: 'Local development evidence', links: [{ title: 'Historical resource', href: 'demos/historical.html' }], shots: [{ file: 'original.png', caption: 'Original screenshot' }], journey: { currentFrom: 'D1', history: [{ title: 'Local history', href: 'demos/old.html' }], development: [{ title: 'Local verification' }] } }
save('cards/decisions/D1.json', source); save('cards/decisions/D2.json', reference)
for (const name of ['current', 'preview', 'historical', 'old']) writeFileSync(join(board, 'demos', name + '.html'), `<html><body>${name}</body></html>`)
const run = (cmd, args, env = {}) => {
  const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout
}
run('git', ['init', '-q'])
run('git', ['add', '.'])
run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'Fixture'], { GIT_AUTHOR_DATE: '2026-11-09T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-09T00:00:00Z' })
const generate = () => run(process.execPath, [join(repo, 'scripts/gen.mjs'), '--dir', board])
const part = () => readFileSync(join(board, 'parts/decisions.html'), 'utf8')
const cardHtml = (id) => part().match(new RegExp(`<article[^>]*id="${id}"[\\s\\S]*?</article>`))[0]
const beforeSource = readFileSync(join(board, 'cards/decisions/D1.json'), 'utf8')
const beforeRef = readFileSync(join(board, 'cards/decisions/D2.json'), 'utf8')
generate()
let html = readFileSync(join(board, 'journeys/D2.html'), 'utf8')
assert.match(cardHtml('D2'), /Shared decision/)
assert.match(cardHtml('D2'), /href="journeys\/D1.html">现行资料来自 D1/)
assert.match(html, /<summary>现行资料来自 D1<\/summary>/)
assert.match(html, /href="D1.html">现行资料来自 D1/)
assert.match(html, /Local history/); assert.match(html, /Local verification/)
assert.match(html, /Local development evidence/); assert.match(html, /Historical resource/)
assert.match(html, /shots\/original.png/)
assert.doesNotMatch(html, /Authority history/)
const currentMenu = html.match(/<div class="resource-menu">[\s\S]*?<details class="journey-status">/)[0]
assert.doesNotMatch(currentMenu, /Historical resource/)
assert.doesNotMatch(currentMenu, /old-spec.html/)
assert.doesNotMatch(cardHtml('D2'), /old-spec.html/)
assert.match(html.match(/<details id="history-resources">[\s\S]*?<\/details>/)[0], /href="\.\.\/refs\/old-spec.html"/)
assert.equal((currentMenu.match(/href="\.\.\/refs\/spec.html"/g) || []).length, 1)
assert.match(currentMenu, /spec.html\?q=1/); assert.match(currentMenu, /spec.html#details/)
assert.doesNotMatch(html, /<iframe[^>]*preview.html/)
assert.doesNotMatch(cardHtml('D1'), /Repeated main|Same specification/)
assert.match(cardHtml('D2'), /内容更新 11-12/)
assert.match(cardHtml('D2'), /title="现行资料来自 D1；内容更新 2026-11-12T01:02:03.000Z"/)
assert.match(cardHtml('D2'), /提交 11-09/)
assert.equal(readFileSync(join(board, 'cards/decisions/D1.json'), 'utf8'), beforeSource)
assert.equal(readFileSync(join(board, 'cards/decisions/D2.json'), 'utf8'), beforeRef)

reference.contentUpdatedAt = '2026-11-13T02:03:04+08:00'; save('cards/decisions/D2.json', reference)
generate()
assert.match(cardHtml('D2'), /title="D2 内容更新 2026-11-13T02:03:04\+08:00"/)
assert.match(cardHtml('D2'), /内容更新 11-13/)
assert.match(cardHtml('D2'), /提交 11-09/)

const legacy = { id: 'D3', code: 'D3', title: 'Legacy dates', status: 'decided', question: 'Question', decision: 'Decision' }
save('cards/decisions/D3.json', legacy)
generate()
const oldCard = cardHtml('D3')
assert.match(oldCard, /title="卡文件最后改动 /)
assert.doesNotMatch(oldCard, /内容更新|提交 /)
const newCard = { ...legacy, id: 'D4', code: 'D4', contentUpdatedAt: '2026-11-14T02:03:04Z' }
save('cards/decisions/D4.json', newCard)
generate()
assert.match(cardHtml('D4'), /内容更新 11-14/)
assert.doesNotMatch(cardHtml('D4'), /提交 /)
const dated = cardHtml('D4')
utimesSync(join(board, 'cards/decisions/D4.json'), new Date('2040-01-01Z'), new Date('2040-01-01Z'))
generate()
assert.equal(cardHtml('D4'), dated, 'content date never follows file mtime')

assert.equal(journeyError(reference, 'en'), '')
assert.ok(journeyError({ ...reference, journey: { ...reference.journey, decision: 'Mixed' } }, 'en'))
assert.ok(journeyError({ ...source, journey: { ...source.journey, current: { ...source.journey.current, links: [{ title: 'Bad role', href: 'demos/current.html', role: 'video' }] } } }, 'en'))
for (const href of ['https://', 'https:', 'https:example.test/demo', 'http:/example.test/demo', 'http://[::1', 'https://example.test:99999/demo']) {
  const invalid = { ...source, journey: { ...source.journey, current: { title: 'Malformed URL', href } } }
  assert.match(journeyError(invalid, 'en'), /current\.href/, `reject malformed current URL ${href}`)
  assert.match(journeyError({ ...source, journey: { ...source.journey, current: { ...source.journey.current, links: [{ title: 'Malformed URL', href }] } } }, 'en'), /current\.links\[0\]\.href/)
  assert.match(journeyError({ ...source, designDoc: href }, 'en'), /designDoc/, `reject malformed current design document ${href}`)
}
for (const href of ['demos/current.html?mode=1#plot', './refs/spec.html', '../docs/spec.md?view=1#details', '/demos/current.html', '#D1', '?mode=1#plot', 'https://example.test/demo?q=1#plot']) {
  const valid = { ...source, designDoc: undefined, journey: { ...source.journey, current: { title: 'Valid URL', href } } }
  assert.equal(journeyError(valid, 'en'), '', `retain valid URL ${href}`)
  assert.doesNotThrow(() => currentResources(valid), `validated URL reaches resource rendering: ${href}`)
}
// 无效源数据必须在写生成物前报告字段错误,不能泄漏 URL parser 的 TypeError。
const indexBeforeInvalid = readFileSync(join(board, 'index.html'), 'utf8')
save('cards/decisions/D1.json', { ...source, journey: { ...source.journey, current: { title: 'Malformed URL', href: 'https://' } } })
const rejectedGeneration = spawnSync(process.execPath, [join(repo, 'scripts/gen.mjs'), '--dir', board], { cwd: root, encoding: 'utf8' })
assert.notEqual(rejectedGeneration.status, 0)
assert.match(rejectedGeneration.stderr, /current\.href/)
assert.doesNotMatch(rejectedGeneration.stderr, /TypeError|Invalid URL/)
assert.equal(readFileSync(join(board, 'index.html'), 'utf8'), indexBeforeInvalid)
writeFileSync(join(board, 'cards/decisions/D1.json'), beforeSource)
const resolvedResources = currentResources({ ...source, journey: { ...source.journey, current: { title: 'Main', href: '../docs/spec.md', links: [{ title: 'Resolved duplicate', href: 'refs/spec.html' }, { title: 'Query', href: 'refs/spec.html?q' }, { title: 'Hash', href: 'refs/spec.html#h' }] } } }, (h) => h === '../docs/spec.md' ? 'refs/spec.html' : h)
assert.deepEqual(resolvedResources.map((l) => l.title), ['Main', 'Query', 'Hash'])
const boardResources = currentResources({ ...source, designDoc: undefined, journey: { ...source.journey, current: { title: 'Board anchor', href: '#D1', links: [{ title: 'Same board anchor', href: 'index.html#D1' }, { title: 'Other anchor', href: 'index.html#D2' }, { title: 'Query variant', href: 'index.html?q=1#D1' }] } } })
assert.deepEqual(boardResources.map((l) => l.title), ['Board anchor', 'Other anchor', 'Query variant'], 'deduplicate the final clickable board URL and retain distinct query/hash')

// 执行生成器实际输出的包装函数,让功能 header 与纯返回区同时存在。
html = renderJourney(source, { lang: 'en', version: 'test', resolveLink: (s) => s })
const wire = html.match(/function wireBacknav\(\) \{[\s\S]*?\n      \}/)[0]
const boardUrl = 'https://board.test/index.html#D1'
const anchor = () => ({ href: boardUrl, matches: (s) => s === 'a', querySelector: () => null, querySelectorAll: () => [], style: {} })
const back = anchor()
const pure = { style: {}, matches: () => false, querySelector: () => null, querySelectorAll: () => [back] }
const functional = { ...pure, style: {}, querySelector: () => ({ tagName: 'BUTTON' }) }
const unmarked = { ...pure, style: {} }
const generated = { ...pure, style: {}, getBoundingClientRect: () => ({ top: 0, height: 44 }) }
const frameStyle = new Map()
const frame = { style: { removeProperty: (key) => frameStyle.delete(key), setProperty: (key, value) => frameStyle.set(key, value) }, contentWindow: { getComputedStyle: () => ({ position: 'fixed' }) }, contentDocument: { querySelectorAll: (selector) => selector === '#ddd-backnav' ? [generated] : selector === '[data-ddd-backnav]' ? [pure, functional, back] : [unmarked] } }
runInNewContext(`(${wire})();`, { frame, URL, document: { querySelector: () => ({ href: boardUrl }) } })
assert.equal(pure.style.display, 'none'); assert.equal(back.style.display, 'none')
assert.equal(functional.style.display, undefined); assert.equal(unmarked.style.display, undefined)
assert.equal(frameStyle.get('--demo-backnav'), '44px')
assert.equal(back.target, '_top')
frame.contentDocument.querySelectorAll = (selector) => selector === '#ddd-backnav' ? [{ ...generated, querySelector: () => ({ tagName: 'BUTTON' }) }] : []
runInNewContext(`(${wire})();`, { frame, URL, document: { querySelector: () => ({ href: boardUrl }) } })
assert.equal(frameStyle.has('--demo-backnav'), false, 'functional generated header is not clipped')
assert.equal(readFileSync(join(board, 'demos/current.html'), 'utf8'), '<html><body>current</body></html>')
console.log('Current record rendering, resources, dates, and explicit backnav checks passed')
