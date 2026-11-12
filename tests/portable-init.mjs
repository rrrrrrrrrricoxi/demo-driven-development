#!/usr/bin/env node
// portable 只用共享 CLI:隔离安装/项目/用户目录,不依赖任何宿主适配器。
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = mkdtempSync(join(tmpdir(), 'ddd-portable-init-'))
const PLUGIN = join(WORK, "shared plugin's path $literal")
const HOME = join(WORK, 'isolated home')
mkdirSync(HOME)
for (const dir of ['scripts', 'templates']) cpSync(join(REPO, dir), join(PLUGIN, dir), { recursive: true })
cpSync(join(REPO, 'package.json'), join(PLUGIN, 'package.json'))
// 删掉宿主入口:portable 若误调适配器,本测试必须失败。
for (const name of ['stop-hook.mjs', 'codex-hook.mjs', 'pi-hook.mjs']) rmSync(join(PLUGIN, 'scripts', name), { force: true })
const env = { ...process.env, HOME, CODEX_HOME: join(HOME, '.codex'), CLAUDE_PROJECT_DIR: '', DDD_PROJECT_DIR: '' }
let checks = 0
const check = (fn) => { fn(); checks++ }
const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
function write(root, rel, text) {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), text)
}
function fixture(name) {
  const root = join(WORK, name)
  mkdirSync(root)
  return root
}
function run(root, script, args, success = true) {
  const result = spawnSync(process.execPath, [join(PLUGIN, 'scripts', script), ...args], { cwd: root, env, encoding: 'utf8' })
  assert.equal(result.status === 0, success, `${script} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
  return result.stdout + result.stderr
}
function init(root, cmd, args = [], success = true) {
  return run(root, 'init.mjs', [cmd, '--dir', root, '--lang', 'en', '--port', '19877', ...args], success)
}
function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}
function repository(root) {
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.name', 'DDD fixture')
  git(root, 'config', 'user.email', 'ddd-fixture@example.invalid')
  write(root, 'README.md', 'fixture\n')
  git(root, 'add', '--', 'README.md')
  git(root, 'commit', '-qm', 'fixture')
}
function snapshot(root) {
  const found = {}
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue
      const rel = prefix + entry.name
      if (entry.isDirectory()) walk(join(dir, entry.name), rel + '/')
      else found[rel] = readFileSync(join(root, rel))
    }
  }
  walk(root)
  return found
}
function noHosts(root) {
  for (const rel of ['CLAUDE.md', 'AGENTS.md', '.claude', '.codex', '.agents', '.pi']) {
    check(() => assert.equal(existsSync(join(root, rel)), false, rel))
  }
}
function audit(root) {
  return JSON.parse(run(root, 'ddd.mjs', ['audit', '--json', '--dir', join(root, 'app/kanban')]))
}

try {
  const root = fixture("portable project's path")
  repository(root)
  const before = snapshot(root)
  const scan = init(root, 'scan')
  check(() => assert.match(scan, /"runtime": "portable"/))
  check(() => assert.match(scan, /"codexHooks": null/))
  check(() => assert.match(scan, /"scenario": "greenfield"/))
  const plan = init(root, 'plan', ['--brand', 'PORTABLE'])
  check(() => assert.match(plan, /skip host hooks\/skills\/config/))
  check(() => assert.doesNotMatch(plan, /CLAUDE.md:|AGENTS.md:|settings.json:|hooks.json:/))
  check(() => assert.match(init(root, 'plan', ['--brand', 'PORTABLE', '--lang', 'zh']), /跳过宿主 hooks\/skills\/config/))
  check(() => assert.deepEqual(snapshot(root), before))
  const applied = init(root, 'apply', ['--brand', 'PORTABLE', '--yes'])
  check(() => assert.match(applied, /shared audit smoke passed/))
  check(() => assert.doesNotMatch(applied, /✓ guard smoke/))
  noHosts(root)
  check(() => assert.ok(existsSync(join(root, 'app/kanban/index.html'))))
  check(() => assert.equal(git(root, 'rev-list', '--count', 'HEAD').trim(), '1'))
  check(() => assert.equal(git(root, 'diff', '--cached'), ''))
  check(() => assert.deepEqual(audit(root).block, []))
  run(root, 'gen.mjs', ['--dir', join(root, 'app/kanban')])
  const once = snapshot(root)
  init(root, 'apply', ['--yes'])
  check(() => assert.deepEqual(snapshot(root), once))
  // 显式 portable 与无宿主默认值共享同一条路径。
  init(root, 'apply', ['--runtime', 'portable', '--yes'])
  check(() => assert.deepEqual(snapshot(root), once))

  // 既有宿主配置含旧 hook、禁用开关与私有规则:portable 连格式都不能重写。
  const configured = fixture('existing host files')
  const hostFiles = {
    'CLAUDE.md': '# Keep Claude guidance\r\n',
    'AGENTS.md': '# Keep agent guidance\n',
    '.claude/settings.json': '{ "hooks": {"Stop": [{"hooks": [{"type":"command","command":"node claude-stop-hook.mjs"}]}]}, "private": true }\n',
    '.codex/config.toml': '# keep comments\n[features]\nhooks = false\n[hooks]\ncustom = "keep"\n',
    '.codex/hooks.json': '{ "hooks": {"Stop": []}, "private": true }\n',
    '.agents/skills/local/SKILL.md': '# Existing skill\n',
    '.claude/cache/demo.html': '<html><title>host metadata</title></html>',
    '.codex/cache/demo.html': '<html><title>host metadata</title></html>',
    '.agents/cache/demo.html': '<html><title>host metadata</title></html>',
    '.pi/settings.json': '{ "extensions": ["keep"] }\n',
    '.pi/cache/demo.html': '<html><title>host metadata</title></html>',
  }
  for (const [rel, text] of Object.entries(hostFiles)) write(configured, rel, text)
  const hostBefore = snapshot(configured)
  check(() => assert.match(init(configured, 'scan'), /"scenario": "greenfield"/))
  init(configured, 'apply', ['--brand', 'KEEP', '--yes'])
  for (const [rel, bytes] of Object.entries(hostBefore)) check(() => assert.deepEqual(readFileSync(join(configured, rel)), bytes, rel))
  check(() => assert.deepEqual(Object.keys(snapshot(configured)).filter((rel) => !rel.startsWith('app/kanban/')), Object.keys(hostBefore)))
  const configuredOnce = snapshot(configured)
  init(configured, 'apply', ['--yes'])
  check(() => assert.deepEqual(snapshot(configured), configuredOnce))
  const malformed = fixture('opaque malformed host configuration')
  write(malformed, '.claude/settings.json', '{invalid JSON')
  write(malformed, '.codex/hooks.json', '[invalid JSON')
  write(malformed, '.codex/config.toml', '[invalid TOML')
  const malformedBefore = snapshot(malformed)
  init(malformed, 'apply', ['--brand', 'OPAQUE', '--yes'])
  for (const [rel, bytes] of Object.entries(malformedBefore)) check(() => assert.deepEqual(readFileSync(join(malformed, rel)), bytes, rel))

  // 旧板数据与机制文件留在原处,只追加迁移待办;不声称宿主适配器已接管。
  const legacy = fixture('legacy board')
  for (const name of ['manifest.json', 'decisions-manifest.json', 'backlog-manifest.json', 'path-manifest.json']) {
    write(legacy, `app/kanban/${name}`, read(PLUGIN, `templates/manifests/${name}`).replaceAll('{{BRAND}}', 'LEGACY').replace(/\{\{[A-Z_]+\}\}/g, ''))
  }
  const decisionPath = 'app/kanban/decisions-manifest.json'
  const decisions = JSON.parse(read(legacy, decisionPath))
  decisions.entries.push({ id: 'D1', code: 'D1', title: 'Existing decision', status: 'decided', demo: 'demos/legacy.html' })
  write(legacy, decisionPath, JSON.stringify(decisions, null, 4) + '\n')
  const legacyBacklog = JSON.parse(read(legacy, 'app/kanban/backlog-manifest.json'))
  legacyBacklog.tiers.old = 'Existing tier'
  legacyBacklog.items.push({ id: 'BL-7', title: 'Keep existing backlog', tier: 'old', priority: 'low', status: 'deferred' })
  write(legacy, 'app/kanban/backlog-manifest.json', JSON.stringify(legacyBacklog, null, 4) + '\n')
  write(legacy, 'app/kanban/demos/legacy.html', '<html><title>Legacy</title><body>\n<!-- ddd-backnav v3 -->\n<style id="ddd-backnav-style">/* keep */</style>\n<nav id="ddd-backnav">Keep navigation</nav><p>Keep demo bytes</p></body></html>')
  write(legacy, 'app/kanban/gen.mjs', '// legacy generator: preserve\n')
  write(legacy, '.claude/settings.json', hostFiles['.claude/settings.json'])
  const legacyBefore = snapshot(legacy)
  init(legacy, 'apply', ['--brand', 'LEGACY', '--yes'])
  for (const [rel, bytes] of Object.entries(legacyBefore)) {
    if (rel !== 'app/kanban/backlog-manifest.json') check(() => assert.deepEqual(readFileSync(join(legacy, rel)), bytes, rel))
  }
  const backlog = JSON.parse(read(legacy, 'app/kanban/backlog-manifest.json'))
  check(() => assert.deepEqual(backlog.items[0], legacyBacklog.items[0]))
  check(() => assert.equal(backlog.tiers.old, legacyBacklog.tiers.old))
  const retire = backlog.items.find((item) => item.initKind === 'legacy-retire')
  check(() => assert.ok(retire))
  check(() => assert.match(retire.title, /待确认接管/))
  check(() => assert.match(retire.problem, /未安装宿主适配器/))
  check(() => assert.deepEqual(audit(legacy).block, []))
  const legacyOnce = snapshot(legacy)
  init(legacy, 'apply', ['--yes'])
  check(() => assert.deepEqual(snapshot(legacy), legacyOnce))

  // 散落归拢仍分两轮,并保留用户暂存区。
  const scattered = fixture('scattered demos')
  repository(scattered)
  write(scattered, 'draft/demo.html', '<html><title>Demo</title><body>shared demo</body></html>')
  git(scattered, 'add', '--', 'draft/demo.html')
  git(scattered, 'commit', '-qm', 'tracked demo')
  write(scattered, 'README.md', 'staged user edit\n')
  git(scattered, 'add', '--', 'README.md')
  const staged = git(scattered, 'diff', '--cached')
  init(scattered, 'apply', ['--brand', 'SCATTERED', '--yes'])
  check(() => assert.ok(existsSync(join(scattered, 'draft/demo.html'))))
  init(scattered, 'apply', ['--yes'])
  check(() => assert.equal(existsSync(join(scattered, 'draft/demo.html')), false))
  check(() => assert.ok(existsSync(join(scattered, 'app/kanban/demos/demo.html'))))
  check(() => assert.equal(git(scattered, 'diff', '--cached'), staged))
  check(() => assert.equal(git(scattered, 'rev-list', '--count', 'HEAD').trim(), '2'))
  noHosts(scattered)
  check(() => assert.deepEqual(audit(scattered).block, []))
  const scatteredOnce = snapshot(scattered)
  init(scattered, 'apply', ['--yes'])
  check(() => assert.deepEqual(snapshot(scattered), scatteredOnce))

  // 同轮归拢与旧装接管都往 backlog 追加:第二次写须基于第一轮现读结果分配 id。
  const combined = fixture('merge and legacy together')
  init(combined, 'apply', ['--brand', 'COMBINED', '--yes'])
  const combinedBacklogPath = 'app/kanban/backlog-manifest.json'
  const existingBacklog = JSON.parse(read(combined, combinedBacklogPath))
  existingBacklog.tiers['0'] = 'Keep custom tier'
  existingBacklog.items.push({ id: 'BL-7', title: 'Keep existing item', tier: 0, priority: 'low', status: 'deferred', links: [{ title: 'Existing demo', href: 'demos/existing.html' }] })
  write(combined, combinedBacklogPath, JSON.stringify(existingBacklog, null, 2) + '\n')
  write(combined, 'app/kanban/gen.mjs', '// preserve legacy generator\n')
  write(combined, 'app/kanban/demos/existing.html', '<html><title>Existing</title><body>keep demo</body></html>')
  write(combined, 'draft/combined.html', '<html><title>Combined</title><body>demo</body></html>')
  write(combined, 'README.md', '[Demo](draft/combined.html)\n')
  init(combined, 'apply', ['--yes'])
  const combinedBacklog = JSON.parse(read(combined, combinedBacklogPath))
  check(() => assert.deepEqual(combinedBacklog.items[0], existingBacklog.items[0]))
  check(() => assert.equal(combinedBacklog.tiers['0'], existingBacklog.tiers['0']))
  check(() => assert.deepEqual(combinedBacklog.items.slice(1).map((item) => item.initKind), ['broken-links', 'legacy-retire', 'legacy-backnav']))
  check(() => assert.equal(new Set(combinedBacklog.items.map((item) => item.id)).size, combinedBacklog.items.length))
  check(() => assert.equal(existsSync(join(combined, 'draft/combined.html')), false))
  check(() => assert.ok(existsSync(join(combined, 'app/kanban/demos/combined.html'))))
  const combinedOnce = snapshot(combined)
  init(combined, 'apply', ['--yes'])
  check(() => assert.deepEqual(snapshot(combined), combinedOnce))

  // 共用安全门仍有效:必要选项、既有锁、版本防退与阻断审计。
  const missingBrand = fixture('missing brand')
  init(missingBrand, 'apply', ['--yes'], false)
  check(() => assert.deepEqual(snapshot(missingBrand), {}))
  init(missingBrand, 'apply', ['--brand', 'NEED-YES'], false)
  check(() => assert.deepEqual(snapshot(missingBrand), {}))
  write(root, 'app/kanban/.init-lock', 'another init owns this lock\n')
  const locked = snapshot(root)
  init(root, 'apply', ['--yes'], false)
  check(() => assert.deepEqual(snapshot(root), locked))
  rmSync(join(root, 'app/kanban/.init-lock'))
  write(root, 'app/kanban/index.html', '<!-- ddd-gen v9999.0.0 -->\nkeep newer output\n')
  const newer = read(root, 'app/kanban/index.html')
  check(() => assert.match(init(root, 'apply', ['--yes'], false), /newer|更新/))
  check(() => assert.equal(read(root, 'app/kanban/index.html'), newer))
  check(() => assert.equal(existsSync(join(root, 'app/kanban/.init-lock')), false))
  write(configured, 'app/kanban/demos/orphan.html', '<html><title>Orphan</title><body>unbound</body></html>')
  rmSync(join(configured, 'app/kanban/demos/.no-card-ok'))
  check(() => assert.match(init(configured, 'apply', ['--yes'], false), /shared audit smoke failed/))
  check(() => assert.equal(existsSync(join(configured, 'app/kanban/.init-lock')), false))
  const invalidRuntime = init(root, 'scan', ['--runtime', 'unknown'], false)
  check(() => assert.match(invalidRuntime, /claude\|codex\|both\|portable/))
  check(() => assert.match(run(root, 'init.mjs', [], false), /--runtime claude\|codex\|both\|portable/))
  check(() => assert.deepEqual(snapshot(HOME), {}))
  console.log(`portable-init: ${checks} checks passed (isolated fixtures; no host adapters or configuration writes)`)
} finally {
  rmSync(WORK, { recursive: true, force: true })
}
