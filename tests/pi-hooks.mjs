// 只用一次性项目;不加载用户配置,不执行请求中的 shell 命令。
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import extension from '../pi/hooks.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const work = realpathSync(mkdtempSync(join(tmpdir(), 'ddd-pi-')))
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
function fixture(name, lang = 'en') {
  const root = join(work, name), kb = join(root, 'app/kanban')
  mkdirSync(join(kb, 'demos'), { recursive: true })
  const fill = text => text.replaceAll('{{BRAND}}', 'Fixture').replaceAll('{{GH_REPO}}', '').replaceAll('{{BRANCH}}', 'main').replaceAll('{{APP_BASE}}', '').replaceAll('{{DEMO_BASE}}', '')
  const config = JSON.parse(fill(readFileSync(join(repo, 'templates/kanban.config.json'), 'utf8')))
  config.lang = lang
  writeFileSync(join(kb, 'kanban.config.json'), JSON.stringify(config))
  for (const file of readdirSync(join(repo, 'templates/manifests'))) writeFileSync(join(kb, file), fill(readFileSync(join(repo, 'templates/manifests', file), 'utf8')))
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '.')
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
  return { root, kb }
}
function snapshot(root) {
  const files = {}
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) visit(path)
      else files[path] = readFileSync(path).toString('base64')
    }
  }
  visit(root); return files
}
function host(cwd, sessionId = 'session', factory = extension) {
  const handlers = new Map(), messages = [], listeners = new Map()
  const events = {
    on(name, fn) { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list) },
    emit(name, data) { for (const fn of listeners.get(name) || []) fn(data) },
  }
  const pi = { events,
    on(name, fn) { const list = handlers.get(name) || []; list.push(fn); handlers.set(name, list) },
    sendMessage(message, options) { messages.push({ message, options }) },
  }
  factory(pi)
  const ctx = { cwd, mode: 'print', hasUI: false, sessionManager: { getSessionId: () => sessionId } }
  return { ctx, pi, messages, handlers, async emit(type, event = {}) {
    let result
    for (const fn of handlers.get(type) || []) { const value = await fn({ type, ...event }, ctx); if (value !== undefined) result = value; if (result?.block) break }
    return result
  } }
}
const call = (toolName, input, toolCallId = 'call', parentToolCallId) => ({ toolName, input, toolCallId, parentToolCallId })
const result = (command, toolCallId = 'call', isError = false, parentToolCallId) => ({ ...call('bash', { command }, toolCallId, parentToolCallId), content: [{ type: 'text', text: 'original' }], structuredContent: { exit_code: isError ? 1 : 0 }, details: { kept: true }, isError })
const ended = event => ({ type: 'tool_execution_end', toolName: event.toolName, toolCallId: event.toolCallId, parentToolCallId: event.parentToolCallId, result: event, isError: event.isError })
async function completed(h, event) { const value = await h.emit('tool_result', event); await h.emit('tool_execution_end', ended(event)); return value }
const boundary = (overrides = {}) => ({ entries: [], continue: false, context: { canContinue: false }, outcome: 'completed', ...overrides })
let checks = 0
async function check(name, fn) { await fn(); checks++; console.log(`✓ ${name}`) }
try {
  await check('actual Pi tool names map without guessing custom inputs', async () => {
    const f = fixture('mapping'), h = host(f.root)
    for (const event of [call('read', { path: 'app/kanban/index.html' }), call('bash', { command: 'cat app/kanban/index.html' })]) {
      const before = structuredClone(event)
      const denied = await h.emit('tool_call', event)
      assert.equal(denied?.block, true); assert.match(denied.reason, /index.html/); assert.deepEqual(event, before)
    }
    for (const name of ['grep', 'find', 'ls', 'edit', 'write', 'powershell', 'custom', 'Read', 'codemode']) {
      assert.equal(await h.emit('tool_call', call(name, { path: 'app/kanban/index.html', command: 'cat app/kanban/index.html' })), undefined, name)
    }
    assert.equal(await h.emit('tool_call', call('read', { path: 'app/kanban/manifest.json' })), undefined)
    assert.equal(await h.emit('tool_call', call('bash', { command: 'rg needle app/kanban/index.html' })), undefined)
  })
  await check('relative, absolute and Pi-normalized read paths use session cwd', async () => {
    const f = fixture('path bases'), h = host(f.root)
    for (const path of ['app/kanban/index.html', '@app/kanban/index.html', join(f.kb, 'index.html'), new URL('file://' + join(f.kb, 'index.html')).href]) {
      assert.equal((await h.emit('tool_call', call('read', { path })))?.block, true, path)
    }
    const home = process.env.HOME
    try {
      process.env.HOME = f.root
      assert.equal((await h.emit('tool_call', call('read', { path: '~/app/kanban/index.html' })))?.block, true)
    } finally { if (home === undefined) delete process.env.HOME; else process.env.HOME = home }
    h.ctx.cwd = f.kb
    assert.equal((await h.emit('tool_call', call('read', { path: 'index.html' })))?.block, true)
    h.ctx.cwd = join(f.root, 'app')
    assert.equal((await h.emit('tool_call', call('read', { path: 'kanban/index.html', cwd: work, workdir: work })))?.block, true)
    assert.equal((await h.emit('tool_call', call('bash', { command: 'cat kanban/index.html', cwd: work, workdir: work })))?.block, true)
  })
  await check('linked worktrees and non-board sessions ignore stale environment', async () => {
    const f = fixture('canonical'), linked = join(work, 'linked'), empty = join(work, 'empty')
    git(f.root, 'worktree', 'add', '-qb', 'feature', linked); mkdirSync(empty)
    const saved = { DDD_PROJECT_DIR: process.env.DDD_PROJECT_DIR, CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR }
    try {
      process.env.DDD_PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR = f.root
      const h = host(linked)
      mkdirSync(join(linked, 'plans'))
      for (const cwd of [linked, join(linked, 'app'), join(linked, 'app/kanban'), join(linked, 'plans')]) {
        h.ctx.cwd = cwd
        assert.equal((await h.emit('tool_call', call('read', { path: relative(cwd, join(linked, 'app/kanban/index.html')) })))?.block, true)
        assert.equal(await h.emit('tool_call', call('read', { path: join(f.kb, 'index.html') })), undefined)
      }
      const before = snapshot(join(linked, 'app/kanban'))
      assert.notEqual((await h.emit('agent_before_settle', boundary()))?.continue, true)
      assert.deepEqual(snapshot(join(linked, 'app/kanban')), before)
      h.ctx.cwd = empty
      assert.equal(await h.emit('tool_call', call('read', { path: join(f.kb, 'index.html') })), undefined)
      assert.equal(await h.emit('agent_before_settle', boundary()), undefined)
      assert.equal(process.env.DDD_PROJECT_DIR, f.root); assert.equal(process.env.CLAUDE_PROJECT_DIR, f.root)
    } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } }
  })
  await check('nested and parallel tool ids never skip the read guard', async () => {
    const f = fixture('nested'), h = host(f.root)
    const calls = [call('read', { path: 'app/kanban/index.html' }, 'outer/1', 'outer'), call('read', { path: 'app/kanban/shots.html' }, 'outer/2', 'outer'), call('read', { path: 'app/kanban/manifest.json' }, 'sibling')]
    assert.deepEqual((await Promise.all(calls.map(e => h.emit('tool_call', e)))).map(v => v?.block), [true, true, undefined])
    assert.equal((await h.emit('tool_call', calls[0]))?.block, true)
  })
  await check('successful PR reminders are bilingual, deduped and do not replace results', async () => {
    for (const lang of ['en', 'zh']) {
      const f = fixture('reminder ' + lang, lang), h = host(f.root)
      const failed = result('gh pr create', 'failed', true), success = result('gh pr create', 'success'), before = structuredClone(success)
      assert.equal(await completed(h, failed), undefined); assert.equal(h.messages.length, 0)
      assert.equal(await h.emit('tool_result', success), undefined); assert.deepEqual(success, before)
      assert.equal(h.messages.length, 0, 'wait for the complete result chain')
      await h.emit('tool_execution_end', ended(success))
      await completed(h, success); assert.equal(h.messages.length, 1)
      const text = h.messages[0].message.content
      assert.match(text, lang === 'en' ? /read-only.*no automatic generation/i : /只读.*不自动生成/)
      assert.doesNotMatch(text, /Stop guard regenerates automatically|Stop 守卫会自动重生成/)
      assert.equal(h.messages[0].options?.triggerTurn, false)
      await completed(h, result('gh pr merge 12', 'merge', false, 'outer'))
      assert.equal(h.messages.length, 2); assert.match(h.messages[1].message.content, /pr-sync/)
      await completed(h, { ...result('gh pr view', 'exit'), isError: false, structuredContent: { exit_code: 1 } })
      await completed(h, { ...result('gh pr list', 'custom'), toolName: 'custom' })
      await completed(h, result('git status', 'unrelated'))
      assert.equal(h.messages.length, 2)
    }
  })
  await check('pending reminders cannot leak across inputs, sessions or cwd switches', async () => {
    const f = fixture('pending'), h = host(f.root), event = result('gh pr create')
    for (const reset of [() => h.emit('before_agent_start', { messageType: 'custom' }), () => h.emit('message_start', { message: { role: 'user' } }), async () => { h.ctx.sessionManager = { getSessionId: () => 'switched' } }, async () => { h.ctx.cwd = f.kb }]) {
      await h.emit('tool_result', event); await reset(); await h.emit('tool_execution_end', ended(event))
      assert.equal(h.messages.length, 0)
    }
    await Promise.all([completed(h, result('gh pr create', 'outer/1', false, 'outer')), completed(h, result('gh pr create', 'outer/2', false, 'outer'))])
    assert.equal(h.messages.length, 1)
  })
  await check('actionable settlement preserves earlier entries and continues at most once', async () => {
    for (const lang of ['en', 'zh']) {
      const f = fixture('settle ' + lang, lang), h = host(f.root)
      writeFileSync(join(f.kb, 'demos/orphan.html'), '<html>fixture</html>')
      const before = snapshot(f.kb)
      await h.emit('before_agent_start', { messageType: 'user' })
      assert.equal(await h.emit('agent_end'), undefined)
      const prior = { type: 'custom', customType: 'other', data: 1 }
      const first = await h.emit('agent_before_settle', boundary({ entries: [prior] }))
      assert.equal(first?.continue, true); assert.deepEqual(first.entries[0], prior)
      assert.equal(first.entries[1].type, 'custom_message'); assert.match(first.entries[1].content, /orphan.html/)
      assert.doesNotMatch(first.entries[1].content, /guard regenerates automatically|守卫会自动重生成/)
      await h.emit('agent_start'); await h.emit('agent_end')
      const repeated = await h.emit('agent_before_settle', boundary())
      assert.notEqual(repeated?.continue, true); assert.match(repeated.entries[0].content, /orphan.html/)
      assert.match(repeated.entries[0].content, /:\n\s*- app\/kanban\/demos\/orphan\.html/, 'Pi retains the shared multiline audit list')
      assert.match(repeated.entries[0].content, lang === 'en' ? /letting this stop through/ : /本次放行/, 'core receives repeatedStop on the corrective boundary')
      assert.equal(await h.emit('agent_before_settle', boundary()), undefined, 'identical notices must not repeat')
      assert.equal(existsSync(join(f.kb, 'index.html')), false)
      assert.deepEqual(snapshot(f.kb), before)
    }
  })
  await check('fresh runs, queued user messages, sessions and children do not share retry state', async () => {
    const f = fixture('lifecycle'), h = host(f.root)
    writeFileSync(join(f.kb, 'demos/orphan.html'), 'fixture')
    const first = () => h.emit('agent_before_settle', boundary())
    assert.equal((await first()).continue, true)
    for (const trigger of [{ type: 'before_agent_start', messageType: 'user' }, { type: 'before_agent_start', messageType: 'custom' }, { type: 'message_start', message: { role: 'user' } }, { type: 'session_start', reason: 'resume' }]) {
      await h.emit(trigger.type, trigger); assert.equal((await first()).continue, true, trigger.type)
    }
    h.ctx.sessionManager = { getSessionId: () => 'different-session' }
    assert.equal((await first()).continue, true)
    const child = host(f.root, 'child')
    assert.equal((await child.emit('agent_before_settle', boundary())).continue, true)
    assert.notEqual((await first())?.continue, true)
    await h.emit('session_shutdown'); await h.emit('session_start', { reason: 'new' })
    assert.equal((await first()).continue, true)
  })
  await check('aborted and failed host outcomes cannot trigger recovery loops', async () => {
    const f = fixture('cancel'), h = host(f.root)
    writeFileSync(join(f.kb, 'demos/orphan.html'), 'fixture')
    for (const outcome of ['aborted', 'error']) assert.equal(await h.emit('agent_before_settle', boundary({ outcome })), undefined)
    h.ctx.signal = AbortSignal.abort()
    assert.equal(await h.emit('agent_before_settle', boundary()), undefined)
    h.ctx.signal = undefined
    assert.equal((await h.emit('agent_before_settle', boundary())).continue, true)
  })
  await check('duplicate installation and optional safety-owned child inheritance stay runtime-local', async () => {
    const f = fixture('children'), h = host(f.root)
    const registrations = [...h.handlers.values()].reduce((n, list) => n + list.length, 0)
    extension(h.pi)
    assert.equal([...h.handlers.values()].reduce((n, list) => n + list.length, 0), registrations)
    const safetyEntry = { id: 'fixture.safety', path: join(work, 'not-loaded.mjs') }
    const request = { extensions: [safetyEntry], context: h.ctx }
    h.pi.events.emit('pi-safety:collect-child-extensions:v1', request)
    h.pi.events.emit('pi-safety:collect-child-extensions:v1', request)
    assert.deepEqual(request.extensions[0], safetyEntry)
    assert.equal(request.extensions.length, 2)
    assert.equal(request.extensions[1].id, 'ddd.pi.v1')
    assert.equal(request.extensions[1].path, join(repo, 'pi/index.ts'))
    const acks = []
    h.pi.events.on('subagent:acknowledge-extension', payload => acks.push(payload.id))
    await h.emit('session_start', { reason: 'startup' })
    assert.deepEqual(acks, ['ddd.pi.v1'], 'never acknowledge or replace safety')
    const child = host(f.root, 'child')
    const collected = { extensions: [] }
    child.pi.events.emit('pi-safety:collect-child-extensions:v1', collected)
    assert.equal(collected.extensions.length, 1, 'a new child has its own install claim')
  })
  await check('filesystem failure is actionable once, without retry loops or generation', async () => {
    const f = fixture('io failure'), h = host(f.root), original = fs.existsSync
    fs.existsSync = path => { if (String(path) === join(repo, 'scripts/gen.mjs')) throw new Error('fixture EACCES'); return original(path) }
    syncBuiltinESMExports()
    try {
      const first = await h.emit('agent_before_settle', boundary())
      assert.equal(first?.continue, true); assert.match(first.entries[0].content, /fixture EACCES/)
      for (let n = 0; n < 3; n++) assert.notEqual((await h.emit('agent_before_settle', boundary()))?.continue, true)
    } finally { fs.existsSync = original; syncBuiltinESMExports() }
    assert.equal(existsSync(join(f.kb, 'index.html')), false)
  })
  await check('import and factory do not launch processes, write output or mutate environment', () => {
    const source = `
      import cp from 'node:child_process'; import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module';
      for (const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) cp[key] = () => { throw new Error('subprocess:'+key) };
      for (const key of ['writeFileSync','appendFileSync','mkdirSync','rmSync','unlinkSync','renameSync','chmodSync']) fs[key] = () => { throw new Error('filesystem mutation:'+key) };
      syncBuiltinESMExports();
      const before = JSON.stringify(process.env), output = process.stdout.write;
      process.stdout.write = process.stderr.write = () => { throw new Error('output') };
      Object.defineProperty(process, 'stdin', { get() { throw new Error('stdin') } });
      process.exit = () => { throw new Error('exit') };
      const { default: extension } = await import(${JSON.stringify(pathToFileURL(join(repo, 'pi/hooks.mjs')).href)});
      const events = []; extension({ on: name => events.push(name), events: { on() {}, emit() {} } });
      if (before !== JSON.stringify(process.env)) throw new Error('environment mutated');
      if (!events.includes('agent_before_settle') || events.includes('agent_end')) throw new Error('boundary registration');
      output.call(process.stdout, 'clean');
    `
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: work, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, 'clean'); assert.equal(r.stderr, '')
  })
  const runtimePath = process.env.PI_TEST_RUNTIME
  if (runtimePath) {
    const module = path => import(pathToFileURL(join(resolve(runtimePath), 'dist', path)).href)
    const { createExtensionRuntime, loadExtensionFromFactory, loadExtensions } = await module('core/extensions/loader.js')
    const { ExtensionRunner } = await module('core/extensions/runner.js')
    const { createEventBus } = await module('core/event-bus.js')
    const { SessionManager } = await module('core/session-manager.js')
    async function runnerFixture(root, factories = [extension], mode = 'print', fromFile = false) {
      const runtime = createExtensionRuntime(), bus = createEventBus(), messages = [], errors = []
      let extensions
      if (fromFile) {
        const loaded = await loadExtensions([typeof fromFile === 'string' ? fromFile : join(repo, 'pi/index.ts')], root, bus, runtime)
        assert.deepEqual(loaded.errors, []); assert.equal(loaded.extensions.length, 1)
        extensions = loaded.extensions
      } else extensions = await Promise.all(factories.map((factory, n) => loadExtensionFromFactory(factory, root, bus, runtime, `<fixture-${n}>`)))
      const manager = SessionManager.inMemory(root)
      const runner = new ExtensionRunner(extensions, runtime, root, manager, {})
      runner.setUIContext(undefined, mode)
      // 真宿主输出边界:接收上下文消息,不需要模型/凭证或终端。
      runtime.sendMessage = (message, options) => messages.push({ message, options })
      runner.onError(error => errors.push(error))
      await runner.emit({ type: 'session_start', reason: 'startup' })
      return { runner, runtime, manager, messages, errors, bus }
    }
    await check('installed loader accepts the real entry point with no factory side effects', async () => {
      const f = fixture('installed loader'), h = await runnerFixture(f.root, [], 'print', true)
      assert.equal((await h.runner.emitToolCall({ type: 'tool_call', ...call('read', { path: 'app/kanban/index.html' }) })).block, true)
      assert.deepEqual(h.errors, []); assert.equal(h.messages.length, 0)
    })
    await check('installed child entry loads separately and acknowledges only its own adapter', async () => {
      const f = fixture('installed child'), parent = await runnerFixture(f.root, [extension, extension])
      const collected = { extensions: [] }, acknowledgements = []
      parent.bus.emit('pi-safety:collect-child-extensions:v1', collected)
      assert.equal(collected.extensions.length, 1)
      const child = await runnerFixture(f.root, [], 'print', collected.extensions[0].path)
      child.bus.on('subagent:acknowledge-extension', payload => acknowledgements.push(payload.id))
      await child.runner.emit({ type: 'session_start', reason: 'new' })
      assert.deepEqual(acknowledgements, ['ddd.pi.v1'])
      assert.equal((await child.runner.emitToolCall({ type: 'tool_call', ...call('read', { path: 'app/kanban/index.html' }, 'child-read') })).block, true)
      await child.runner.emitToolResult({ type: 'tool_result', ...result('gh pr create') }); await child.runner.emit(ended(result('gh pr create')))
      assert.equal(child.messages.length, 1); assert.equal(parent.messages.length, 0)
      assert.deepEqual(child.errors, []); assert.deepEqual(parent.errors, [])
    })
    await check('installed runner preserves both safety guard orders and first denial reasons', async () => {
      const f = fixture('guard orders')
      for (const first of [true, false]) {
        const safety = pi => pi.on('tool_call', event => {
          if (event.input.safetyDenied) return { block: true, reason: 'fixture safety denial' }
          if (event.input.startupDenied) return { block: true, reason: 'fixture safety not ready' }
        })
        const h = await runnerFixture(f.root, first ? [safety, extension] : [extension, safety])
        for (const flag of ['safetyDenied', 'startupDenied']) {
          const denied = await h.runner.emitToolCall({ type: 'tool_call', ...call('read', { path: 'app/kanban/manifest.json', [flag]: true }) })
          assert.equal(denied.reason, flag === 'safetyDenied' ? 'fixture safety denial' : 'fixture safety not ready')
          const both = await h.runner.emitToolCall({ type: 'tool_call', ...call('read', { path: 'app/kanban/index.html', [flag]: true }) })
          assert.equal(both.block, true)
          assert.match(both.reason, first ? /fixture safety/ : /index.html/)
        }
        assert.equal(await h.runner.emitToolCall({ type: 'tool_call', ...call('read', { path: 'app/kanban/manifest.json' }) }), undefined)
        assert.deepEqual(h.errors, [])
      }
    })
    await check('installed runner composes result errors/content and mode-independent notices', async () => {
      const f = fixture('result chain')
      for (const mode of ['print', 'rpc']) {
        const redact = pi => pi.on('tool_result', event => ({ content: [{ type: 'text', text: 'redacted' }], structuredContent: { redacted: true }, isError: true, details: { redacted: true } }))
        for (const order of [[redact, extension], [extension, redact]]) {
          const h = await runnerFixture(f.root, order, mode)
          const r = await h.runner.emitToolResult({ type: 'tool_result', ...result('gh pr create', 'failed', true) })
          assert.equal(r.isError, true); assert.deepEqual(r.content, [{ type: 'text', text: 'redacted' }]); assert.deepEqual(r.structuredContent, { redacted: true }); assert.deepEqual(r.details, { redacted: true })
          assert.equal(h.messages.length, 0)
          await h.runner.emitToolResult({ type: 'tool_result', ...result('gh pr create', 'changed-later', false) })
          await h.runner.emit({ type: 'tool_execution_end', toolName: 'bash', toolCallId: 'changed-later', isError: true, result: r })
          assert.equal(h.messages.length, 0, 'a later result guard may mark an otherwise successful call as failed')
        }
        const h = await runnerFixture(f.root, [extension], mode)
        const success = result('gh pr create')
        assert.equal(await h.runner.emitToolResult({ type: 'tool_result', ...success }), undefined)
        assert.equal(h.messages.length, 0)
        await h.runner.emit(ended(success))
        assert.equal(h.messages.length, 1); assert.deepEqual(h.errors, [])
      }
    })
    await check('installed SDK executes nested calls and validates bounded settlement without a provider', async () => {
      const { createAgentSession } = await module('core/sdk.js')
      const { ModelRuntime } = await module('core/model-runtime.js')
      const { SettingsManager } = await module('core/settings-manager.js')
      const { createBashToolDefinition } = await module('core/tools/bash.js')
      const runtimeRequire = createRequire(join(resolve(runtimePath), 'package.json'))
      // pi-ai 只有 import 条件,require.resolve 不能选根导出;先用 Node 搜索路径定位包。
      const aiDir = runtimeRequire.resolve.paths('@earendil-works/pi-ai').map(base => join(base, '@earendil-works/pi-ai')).find(base => existsSync(join(base, 'package.json')))
      assert.ok(aiDir, 'installed runtime must resolve its pi-ai dependency')
      const aiPackage = JSON.parse(readFileSync(join(aiDir, 'package.json'), 'utf8'))
      const { AssistantMessageEventStream } = await import(pathToFileURL(join(aiDir, aiPackage.exports['.'].import)).href)
      const f = fixture('sdk'), agentDir = join(work, 'isolated-agent')
      mkdirSync(agentDir); writeFileSync(join(f.root, 'source.txt'), 'fixture source')
      writeFileSync(join(f.kb, 'demos/orphan.html'), 'fixture orphan')
      const originalFetch = globalThis.fetch
      globalThis.fetch = () => { throw new Error('Network is forbidden in the SDK fixture') }
      let session
      try {
        const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json'), modelsStorePath: join(agentDir, 'models-store.json'), allowModelNetwork: false, refreshOnCreate: false })
        // prompt() 的认证预检属于宿主边界;只认可虚构 provider,不读真实凭证。
        modelRuntime.hasConfiguredAuth = provider => { assert.equal(provider, 'fixture'); return true }
        modelRuntime.getAuth = async selected => { assert.equal(typeof selected === 'string' ? selected : selected.provider, 'fixture'); return { auth: { apiKey: 'fixture-not-a-credential' }, env: {} } }
        const runtime = createExtensionRuntime(), bus = createEventBus(), observed = [], lifecycle = [], errors = [], shellRequests = []
        const observer = pi => {
          // 真实 builtin 的进程边界由内存实现接管;请求字符串绝不交给 shell。
          pi.registerTool(createBashToolDefinition(f.root, { exposeSessionEnvironment: false, operations: { async exec(command, cwd, options) {
            assert.equal(cwd, f.root); assert.ok(['gh pr create', 'gh pr list'].includes(command)); shellRequests.push(command)
            options.onData(Buffer.from('fixture output'))
            return { exitCode: command === 'gh pr create' ? 0 : 1 }
          } } }))
          for (const name of ['tool_call', 'tool_result']) pi.on(name, event => { observed.push(structuredClone(event)) })
          for (const name of ['before_agent_start', 'agent_end', 'agent_before_settle', 'agent_settled']) pi.on(name, event => { lifecycle.push(event.type) })
          pi.registerTool({ name: 'nested_fixture', label: 'Fixture', description: 'Disposable nested read fixture', parameters: { type: 'object', properties: {}, required: [] },
            async execute(_id, _args, _signal, _update, ctx) {
              const outcomes = await Promise.all([ctx.executeTool('read', { path: 'app/kanban/index.html' }), ctx.executeTool('read', { path: 'source.txt' })])
              assert.equal(outcomes[0].isError, true); assert.equal(outcomes[1].isError, false)
              return { content: [{ type: 'text', text: 'nested fixture completed' }], details: { statuses: outcomes.map(o => o.isError) } }
            },
          })
        }
        const extensions = await Promise.all([observer, extension].map((factory, i) => loadExtensionFromFactory(factory, f.root, bus, runtime, `<sdk-fixture-${i}>`)))
        const resources = {
          getExtensions: () => ({ extensions, errors: [], runtime }),
          getSkills: () => ({ skills: [], diagnostics: [] }), getPrompts: () => ({ prompts: [], diagnostics: [] }), getThemes: () => ({ themes: [], diagnostics: [] }),
          getAgentsFiles: () => ({ agentsFiles: [] }), getSystemPrompt: () => 'Disposable fixture; no provider.', getSystemPromptSource: () => undefined,
          getAppendSystemPrompt: () => [], getAppendSystemPromptSources: () => [], extendResources() {}, async reload() {},
        }
        const boardBefore = snapshot(f.kb)
        const model = { id: 'fixture', name: 'Fixture', provider: 'fixture', api: 'fixture', baseUrl: 'http://invalid.invalid', reasoning: false, input: ['text'], contextWindow: 100000, maxTokens: 1000, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }
        ;({ session } = await createAgentSession({ cwd: f.root, agentDir, modelRuntime, model, thinkingLevel: 'off', resourceLoader: resources,
          sessionManager: SessionManager.inMemory(f.root), tools: ['read', 'bash', 'nested_fixture'], settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, cacheWarming: 'off' }) }))
        let requests = 0
        // 唯一模拟点是模型传输边界;SDK、事件、工具执行、会话投影与边界校验均为安装版。
        session.agent.streamFunction = () => {
          requests++
          assert.ok(requests <= 3, 'adapter entered an unbounded continuation loop')
          const first = requests === 1
          const message = { role: 'assistant', api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(),
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: first ? 'toolUse' : 'stop', content: first ? [{ type: 'toolCall', id: 'direct', name: 'read', arguments: { path: 'app/kanban/index.html' } }, { type: 'toolCall', id: 'outer', name: 'nested_fixture', arguments: {} }, { type: 'toolCall', id: 'pr-ok', name: 'bash', arguments: { command: 'gh pr create' } }, { type: 'toolCall', id: 'pr-failed', name: 'bash', arguments: { command: 'gh pr list' } }] : [{ type: 'text', text: 'Fixture complete.' }] }
          const stream = new AssistantMessageEventStream()
          stream.push({ type: 'start', partial: message }); stream.push({ type: 'done', reason: message.stopReason, message }); stream.end()
          return stream
        }
        session.subscribe(event => { if (event.type === 'extension_error') errors.push(event) })
        await session.bindExtensions({})
        await session.prompt('Disposable fixture run')
        assert.equal(requests, 3)
        assert.equal(lifecycle.filter(e => e === 'before_agent_start').length, 1)
        assert.equal(lifecycle.filter(e => e === 'agent_before_settle').length, 2)
        assert.equal(lifecycle.filter(e => e === 'agent_settled').length, 1)
        for (const id of ['outer/1', 'outer/2']) {
          const event = observed.find(e => e.type === 'tool_call' && e.toolCallId === id)
          assert.equal(event.parentToolCallId, 'outer'); assert.equal(event.toolName, 'read')
        }
        const direct = session.messages.find(m => m.role === 'toolResult' && m.toolCallId === 'direct')
        assert.equal(direct.isError, true); assert.match(direct.content[0].text, /index.html/)
        const parent = session.messages.find(m => m.role === 'toolResult' && m.toolCallId === 'outer')
        assert.equal(parent.isError, false); assert.deepEqual(parent.details.statuses, [true, false])
        assert.equal(session.messages.filter(m => m.role === 'toolResult' && m.toolCallId.startsWith('outer/')).length, 0)
        assert.equal(parent.nestedCalls.calls.length, 2)
        const contexts = session.messages.filter(m => m.role === 'custom' && m.customType === 'ddd')
        assert.equal(contexts.length, 3); assert.equal(contexts.filter(m => /gh pr command succeeded/.test(m.content)).length, 1)
        assert.equal(session.messages.find(m => m.role === 'toolResult' && m.toolCallId === 'pr-failed').isError, true)
        assert.deepEqual(shellRequests.sort(), ['gh pr create', 'gh pr list'])
        assert.deepEqual(errors, []); assert.deepEqual(snapshot(f.kb), boardBefore)
        assert.deepEqual(JSON.parse(readFileSync(join(agentDir, 'auth.json'), 'utf8')), {}, 'SDK storage may initialize an empty file, but must not persist any credential')
      } finally { session?.dispose(); globalThis.fetch = originalFetch }
    })
  } else console.log('SKIP installed Pi runner/SDK: set PI_TEST_RUNTIME to an installed package directory')
  console.log(`Pi hooks: ${checks} checks passed`)
} finally { rmSync(work, { recursive: true, force: true }) }
