#!/usr/bin/env node
// 真子进程验证排队/崩溃回收;fs 预加载桩把源编辑固定在渲染读取之后,避免竞速测试碰运气。
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquireGenerationLock, lockRoot } from '../scripts/gen-concurrent.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gen = join(repo, 'scripts/gen.mjs')
const work = mkdtempSync(join(tmpdir(), 'ddd-concurrent-gen-'))
const children = new Set()
let checks = 0
const ok = (condition, name) => { assert.ok(condition, name); checks++; console.log(`  ✓ ${name}`) }
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const until = async (test) => {
  const deadline = Date.now() + 8000
  while (!test()) { assert.ok(Date.now() < deadline, 'timed out waiting for child'); await sleep(10) }
}
const fixture = (name, concurrent = true) => {
  const board = join(work, name, 'app/kanban')
  mkdirSync(join(board, 'demos'), { recursive: true })
  const fill = (text) => text.replaceAll('{{BRAND}}', 'CONCURRENT').replaceAll('{{GH_REPO}}', '').replaceAll('{{BRANCH}}', '').replaceAll('{{APP_BASE}}', '')
  const cfg = JSON.parse(fill(readFileSync(join(repo, 'templates/kanban.config.json'), 'utf8')))
  if (concurrent !== null) cfg.concurrentSessions = concurrent
  cfg.lazyTabs = true
  writeFileSync(join(board, 'kanban.config.json'), JSON.stringify(cfg))
  for (const name of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) writeFileSync(join(board, name), fill(readFileSync(join(repo, 'templates/manifests', name), 'utf8')))
  writeFileSync(join(board, 'demos/user.html'), '<html><body>user source</body></html>')
  return board
}
const preload = join(work, 'preload.cjs')
writeFileSync(preload, `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const { join } = require('node:path');
const read = fs.readFileSync, rename = fs.renameSync;
let entered = false, changed = false, configRead = false;
const signal = (text) => fs.appendFileSync(process.env.TEST_EVENTS, text + '\\n');
fs.readFileSync = function(path, ...args) {
  const result = read.call(this, path, ...args);
  if (!configRead && String(path).endsWith('/kanban.config.json') && process.env.TEST_CONFIG_RACE) {
    configRead = true;
    if (process.env.TEST_CONFIG_RACE === 'half') return '{';
    const cfg = JSON.parse(result); delete cfg.concurrentSessions; return JSON.stringify(cfg);
  }
  const caller = new Error().stack.split('\\n')[2] || '';
  if (!entered && String(path).endsWith('/manifest.json') && /scripts\\/gen.mjs:/.test(caller)) {
    entered = true;
    signal('enter:' + process.env.TEST_ID);
    if (process.env.TEST_HOLD) {
      const deadline = Date.now() + 8000;
      while (!fs.existsSync(process.env.TEST_HOLD)) {
        if (Date.now() > deadline) throw Error('test hold timed out');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
    }
    if (process.env.TEST_CHANGE === 'source') {
      const stat = fs.statSync(path);
      const data = JSON.parse(result); data.instance.name = 'EDIT-DURING-GENERATION';
      fs.writeFileSync(path, JSON.stringify(data)); fs.utimesSync(path, stat.atime, stat.mtime);
    }
    if (['log', 'log-card'].includes(process.env.TEST_CHANGE)) {
      fs.appendFileSync(join(process.env.TEST_BOARD, 'kanban.log'), 'GET /index.html during generation\\n');
      if (process.env.TEST_CHANGE === 'log-card') {
        const cardPath = join(process.env.TEST_BOARD, 'backlog-manifest.json');
        const data = JSON.parse(read(cardPath, 'utf8')); data.items[0].title = 'CARD EDIT DURING GENERATION';
        fs.writeFileSync(cardPath, JSON.stringify(data));
      }
    }
    if (process.env.TEST_CHANGE === 'asset') fs.unlinkSync(process.env.TEST_ASSET);
    if (process.env.TEST_CHANGE === 'doc') {
      fs.writeFileSync(process.env.TEST_DOC, '# EDIT-DURING-GENERATION');
    }
    if (process.env.TEST_CHANGE === 'newer') {
      fs.writeFileSync(join(process.env.TEST_BOARD, 'index.html'), '<!-- ddd-gen v999.0.0 -->NEWER');
    }
  }
  return result;
};
fs.renameSync = function(src, dest) {
  const result = rename.call(this, src, dest);
  if (String(dest).endsWith('/index.html')) signal('publish:' + process.env.TEST_ID);
  if (!changed && process.env.TEST_CHANGE === 'late' && String(dest).endsWith('/parts/decisions.html')) {
    changed = true;
    const path = join(process.env.TEST_BOARD, 'manifest.json');
    const data = JSON.parse(read(path, 'utf8')); data.instance.name = 'LATE-EDIT';
    fs.writeFileSync(path, JSON.stringify(data));
  }
  return result;
};
syncBuiltinESMExports();
`)
const launch = (board, id, extra = {}) => {
  const events = extra.TEST_EVENTS || join(work, `${id}.events`)
  const child = spawn(process.execPath, ['--require', preload, gen, '--dir', board], {
    env: { ...process.env, TEST_EVENTS: events, TEST_ID: id, TEST_BOARD: board, ...extra }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  let stdout = '', stderr = ''
  child.stdout.on('data', (data) => { stdout += data })
  child.stderr.on('data', (data) => { stderr += data })
  const done = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (status, signal) => { children.delete(child); resolve({ status, signal, stdout, stderr }) })
  })
  return { child, done, events }
}
const eventsOf = (path) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const run = (board, args = []) => spawnSync(process.execPath, [gen, '--dir', board, ...args], { encoding: 'utf8' })

try {
  const board = fixture('shared')
  const beforeDemo = hash(join(board, 'demos/user.html'))
  const release = join(work, 'release')
  const events = join(work, 'shared.events')
  const a = launch(board, 'a', { TEST_HOLD: release, TEST_EVENTS: events })
  await until(() => eventsOf(events).includes('enter:a'))
  const alias = join(work, 'board-alias'); symlinkSync(board, alias)
  const otherTmp = join(work, 'different-tmp'); mkdirSync(otherTmp)
  const b = launch(alias, 'b', { TEST_EVENTS: events, TMPDIR: otherTmp, TMP: otherTmp, TEMP: otherTmp })
  await until(() => readdirSync(lockRoot(board)).length === 2)
  await sleep(100)
  ok(!eventsOf(events).includes('enter:b'), 'different TMPDIR and symlink alias still serialize same canonical board')
  const other = fixture('independent-worktree')
  const c = launch(other, 'c')
  ok((await c.done).status === 0, 'different worktree board runs while first board is locked')
  writeFileSync(release, 'go')
  const [ra, rb] = await Promise.all([a.done, b.done])
  assert.equal(ra.status, 0, ra.stderr); assert.equal(rb.status, 0, rb.stderr)
  ok(true, 'both same-board generators complete')
  const log = eventsOf(events)
  ok(log.indexOf('publish:a') < log.indexOf('enter:b'), 'first publication precedes second renderer source read')
  ok(hash(join(board, 'demos/user.html')) === beforeDemo, 'concurrent generator preserves user demo bytes')
  ok(readdirSync(lockRoot(board)).length === 0, 'successful generators release contender records')

  // 自带服务器会在浏览器 GET 时追加根日志;只忽略它,同一时段的真实卡片编辑仍要延后。
  for (const mutation of ['log', 'log-card']) {
    const kb = fixture(mutation), cardPath = join(kb, 'backlog-manifest.json')
    const backlog = JSON.parse(readFileSync(cardPath, 'utf8'))
    backlog.tiers = { '1': 'Feature' }
    backlog.items = [{ id: 'BL-1', title: 'Original card', status: 'ready', tier: 1, priority: 'med' }]
    writeFileSync(cardPath, JSON.stringify(backlog))
    writeFileSync(join(kb, 'kanban.log'), 'GET /index.html before generation\n')
    assert.equal(run(kb).status, 0)
    const indexBefore = hash(join(kb, 'index.html')), sourceBefore = hash(cardPath)
    const p = launch(kb, mutation, { TEST_CHANGE: mutation })
    const result = await p.done
    ok(readFileSync(join(kb, 'kanban.log'), 'utf8').includes('during generation'), `${mutation}: browser access log changes during rendering`)
    if (mutation === 'log') {
      assert.equal(result.status, 0, result.stderr)
      ok(eventsOf(p.events).includes('publish:log') && !existsSync(join(kb, '.ddd-gen-stale')), 'browser access log alone permits complete publication')
      ok(hash(cardPath) === sourceBefore, 'log-only generation preserves card source bytes')
    } else {
      ok(result.status !== 0 && result.stderr.includes('Sources changed'), 'card editing with browser traffic still defers generation')
      ok(hash(join(kb, 'index.html')) === indexBefore && existsSync(join(kb, '.ddd-gen-stale')), 'card edit preserves previous index and requests retry')
      ok(readFileSync(cardPath, 'utf8').includes('CARD EDIT DURING GENERATION'), 'card edit survives deferred generation')
    }
    ok(readdirSync(lockRoot(kb)).length === 0, `${mutation}: generator releases contender record`)
  }

  for (const mutation of ['source', 'doc', 'asset', 'late', 'newer']) {
    const kb = fixture(mutation)
    const doc = join(work, mutation, 'doc.md')
    writeFileSync(doc, '# ORIGINAL-DOC')
    const cfgPath = join(kb, 'kanban.config.json')
    const cfg = JSON.parse(readFileSync(cfgPath)); cfg.docs = [{ path: 'doc.md', out: 'doc.html', title: 'Doc', baseDir: '', category: '其他' }]
    const asset = join(work, mutation, 'asset.png')
    if (mutation === 'asset') {
      cfg.acceptanceTab = true
      writeFileSync(asset, 'asset')
      writeFileSync(join(kb, 'acceptance-manifest.json'), JSON.stringify({ lists: [{ pr: 1, title: 'Asset', items: [{ id: 'one', shots: ['../../asset.png'] }] }] }))
    }
    writeFileSync(cfgPath, JSON.stringify(cfg))
    if (mutation === 'source') utimesSync(join(kb, 'manifest.json'), new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))
    assert.equal(run(kb).status, 0)
    const sourceMtime = statSync(join(kb, 'manifest.json')).mtimeMs
    const indexBefore = hash(join(kb, 'index.html'))
    const refBefore = hash(join(kb, 'refs/doc.html'))
    const p = launch(kb, mutation, { TEST_CHANGE: mutation, TEST_DOC: doc, TEST_ASSET: asset })
    const result = await p.done
    ok(result.status !== 0, `${mutation}: deterministic edit causes bounded failure`)
    if (mutation === 'newer') {
      ok(readFileSync(join(kb, 'index.html'), 'utf8').includes('v999.0.0'), 'late newer generator stamp remains protected')
      ok(result.stderr.includes('newer'), 'newer stamp rejection remains explicit')
    } else {
      ok(hash(join(kb, 'index.html')) === indexBefore, `${mutation}: existing index is preserved`)
      ok(result.stderr.includes('Sources changed'), `${mutation}: changed-source defer explains retry`)
      ok(existsSync(join(kb, '.ddd-gen-stale')), `${mutation}: changed input leaves retry marker`)
      if (mutation !== 'late') ok(hash(join(kb, 'refs/doc.html')) === refBefore, `${mutation}: staged refs remain unpublished`)
      if (mutation === 'source') {
        ok(readFileSync(join(kb, 'manifest.json'), 'utf8').includes('EDIT-DURING'), 'mtime-preserving user source edit survives defer')
        ok(statSync(join(kb, 'manifest.json')).mtimeMs === sourceMtime, 'source-change detection works with exactly unchanged mtime')
      }
      if (mutation === 'late') {
        ok(existsSync(join(kb, '.ddd-gen-stale')), 'late partial publish leaves explicit stale marker')
        ok(run(kb).status === 0 && !existsSync(join(kb, '.ddd-gen-stale')), 'successful retry clears stale marker')
      }
    }
    ok(readdirSync(lockRoot(kb)).length === 0, `${mutation}: failure releases owner record`)
  }

  for (const race of ['half', 'enable']) {
    const kb = fixture(`config-race-${race}`)
    const demoBefore = hash(join(kb, 'demos/user.html'))
    const child = launch(kb, `config-race-${race}`, { TEST_CONFIG_RACE: race })
    const result = await child.done
    ok(result.status !== 0 && result.stderr.includes('configuration changed'), `${race}: configuration detection race fails closed`)
    ok(hash(join(kb, 'demos/user.html')) === demoBefore && !existsSync(join(kb, 'index.html')), `${race}: configuration race preserves demo and publishes nothing`)
  }

  const broken = fixture('failure-cleanup')
  const bad = JSON.parse(readFileSync(join(broken, 'manifest.json'))); bad.tasks = [{ id: 'bad', iteration: 'missing' }]
  writeFileSync(join(broken, 'manifest.json'), JSON.stringify(bad))
  ok(run(broken).status !== 0 && readdirSync(lockRoot(broken)).length === 0, 'renderer validation failure cleans up lock and publishes nothing')
  ok(!existsSync(join(broken, 'index.html')), 'first-run renderer failure creates no index')

  const crashed = fixture('crashed')
  const hold = join(work, 'never-release')
  const owner = launch(crashed, 'crashed-owner', { TEST_HOLD: hold })
  await until(() => eventsOf(owner.events).includes('enter:crashed-owner'))
  owner.child.kill('SIGKILL'); await owner.done
  ok(readdirSync(lockRoot(crashed)).length === 1, 'SIGKILL leaves real dead owner record')
  ok(run(crashed).status === 0 && readdirSync(lockRoot(crashed)).length === 0, 'next generator safely reclaims crashed owner')

  const live = fixture('live-owner')
  const root = lockRoot(live); mkdirSync(root, { recursive: true })
  const own = join(root, `${Buffer.from(hostname()).toString('base64url')}.${process.pid}.live-test`)
  mkdirSync(own); writeFileSync(join(own, 'ticket'), '1')
  utimesSync(own, new Date(0), new Date(0))
  await assert.rejects(acquireGenerationLock(live, { timeoutMs: 70 }), /Timed out/)
  ok(existsSync(own) && readdirSync(root).length === 1, 'old live owner is never evicted; timed-out waiter cleans itself')
  rmSync(own, { recursive: true })
  const unknown = join(root, 'unverifiable-owner'); mkdirSync(unknown)
  await assert.rejects(acquireGenerationLock(live, { timeoutMs: 70 }), /Timed out/)
  ok(existsSync(unknown) && readdirSync(root).length === 1, 'unverifiable owner is preserved and causes bounded defer')
  rmSync(unknown, { recursive: true })

  const plain = fixture('default', null)
  const result = run(plain)
  ok(result.status === 0 && readFileSync(join(plain, 'demos/user.html'), 'utf8').includes('ddd-backnav v3'), 'absent flag retains default demo backnav injection')
  const enabled = fixture('output-match')
  // 与普通模式同一输入比较;mtime 影响的 demo 不在产物模板中。
  for (const name of ['manifest.json', 'backlog-manifest.json', 'decisions-manifest.json']) cpSync(join(plain, name), join(enabled, name))
  ok(run(enabled).status === 0, 'concurrent output fixture renders')
  for (const name of ['index.html', 'shots.html', 'parts/decisions.html', 'parts/backlog.html']) ok(hash(join(plain, name)) === hash(join(enabled, name)), `concurrent output bytes match default: ${name}`)
  console.log(`concurrent-gen: ${checks} checks passed`)
} finally {
  for (const child of children) child.kill('SIGKILL')
  // 测试只清自己的 fixture 与看板内锁记录。
  rmSync(work, { recursive: true, force: true })
}
