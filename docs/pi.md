# Pi integration

The opt-in extension at `pi/index.ts` calls the [shared hook API](hook-core.md)
directly. It does not install hooks, initialize boards, change settings, forward
through Claude caches, or start processes while loading. **Settlement is always
read-only.** The adapter has no option to enable automatic generation.

## Compatibility

Tested with `@earendil-works/pi-coding-agent` **1.3.0**, including its
`agent_before_settle` boundary, final `tool_execution_end` events, and nested
`ctx.executeTool` hook pipeline. Pi requires Node.js **22.19+**; the standalone
DDD scripts keep their existing Node requirement. Older Pi versions are not
claimed compatible. Path normalization targets POSIX hosts; Windows/PowerShell
and arbitrary custom-tool execution semantics are not covered.

This is an extension adapter, not a Pi installer or an end-to-end unattended
workflow. `init.mjs` still accepts only `claude`, `codex`, and `both`.

## Activation and rollback

Review the source before loading executable extension code. Start a **new** Pi
invocation from the intended development checkout or feature worktree:

```sh
cd /path/to/project-or-worktree
pi --extension /absolute/path/to/demo-driven-development/pi/index.ts
```

Do not disable existing safety extensions. `--no-extensions` would remove other
guards and is not part of activation. Load the entry file, not the repository
directory: no Pi package manifest or conventional `extensions/` directory is
provided. This command adds no saved configuration and does not generate output.

Rollback: finish/cancel work and exit that invocation, then start Pi without the
DDD `--extension` argument. Any existing children keep their own loaded runtime
until they finish or are stopped through normal subagent controls. No board or
settings restoration is needed because the adapter does not write them. For a
managed setup, review and apply any future resource declaration in that setup's
authoritative source; do not patch a deployed release in place. No managed
configuration change is included here.

## Workflow skill and project context

The extension supplies guards; load the workflow skill separately for its
SEE-IT/KNOW-IT decision process and card, demo, verification, and acceptance
rules. Pin one reviewed checkout and use that same checkout for both resources:

```sh
cd /path/to/development-worktree
pi --extension /absolute/pinned/ddd/pi/index.ts \
   --skill /absolute/pinned/ddd/skills/ddd-workflow/SKILL.md \
   --append-system-prompt /absolute/project-session-context.md
```

The optional context file should point to the current project instructions and
handoff, identify development/production boundaries, and state that Pi does not
automatically generate the board. Keep changing facts such as PR status, ports,
and active owners in their authoritative project records. Loading this profile
is not permission to operate services, write board data, or accept work for a
human. Start a new process when changing the profile or its pinned resources;
do not update the checkout underneath a running session.

Parent CLI flags do not establish child context or skill inheritance. In
pi-subagents 0.79.0, a child with `inheritProjectContext: true` discovers project
context from its own cwd; it does not copy the parent's appended system prompt.
A role with `inheritSkills: false` does not receive the parent's skill catalog.
For these roles, put the required project context and the absolute pinned
`SKILL.md` path in the child task, and require the child to read that skill before
DDD feature work. Preserve the role's tools and reporting contract. Do not pass
an absolute path as `options.skill`: that option selects discovered skill names,
not arbitrary files. Use the installed subagent documentation when configuring
role-specific skill discovery instead.

Verify fresh parent loading and actual child reads independently. The extension
collector described below handles executable guard inheritance; it does not
supply workflow instructions. A skill catalog entry is not proof its body was
read, and a successful process exit is not a human acceptance decision.

## Tool event mapping

| Pi event | DDD request / action |
| --- | --- |
| `tool_call` for `bash` | `before-tool`, `shell`, literal `input.command` |
| `tool_call` for `read` | `before-tool`, `read`, normalized `input.path` |
| Other tools | No guessed shell/read semantics |
| Successful `bash` `tool_result` | Record a bounded PR-reminder candidate only |
| Final `tool_execution_end` | Evaluate eligible successful PR reminder with `after-tool` |
| `agent_before_settle` | Read-only `settle` with adapter-managed `repeatedStop` |

Every request explicitly uses **`ctx.cwd`**, the directory used by Pi's built-in
tools, including a linked worktree or subdirectory. Pi built-in inputs do not
support a per-call `cwd` or `workdir`: bogus fields do not override the session
base. `DDD_PROJECT_DIR`, `CLAUDE_PROJECT_DIR`, and the process launch directory
cannot replace the selected context. Start a separate Pi session in the intended
worktree rather than attaching unsupported directory fields to tools.

Read paths follow Pi's POSIX `@`, `~`, file-URL, and Unicode-space normalization;
the original input is not mutated. Discovery and generated-read rules are scoped
to the session's board. Absolute reads into another project's board are not a
global cross-project protection layer. A shell's internal `cd`, expansions,
aliases, interpreter source, and arbitrary custom tools are not interpreted.

Nested tool calls, including calls from codemode, receive normal checks; a
`parentToolCallId` does not exempt them. Parallel siblings are independent. The
outer codemode script is not scanned for imagined nested requests. Human `!`
commands and trusted extension code are outside these model-tool hooks.

### Guard and result composition

DDD returns `{ block: true, reason }` only for its own denial; otherwise it
returns no authorization decision. Pi stops at the first denial, so the first
rejecting guard retains its reason in either load order. DDD does not modify
arguments, replace tools, or clear another guard's decision. Handler exceptions
on `tool_call` retain Pi's fail-safe behavior.

The adapter never replaces result content, structured content, error status,
details, or usage. Reminders wait for final execution status so a later result
handler converting success into error cannot produce a false-success reminder.
Reminders are separate, non-triggering context messages, usable without a UI.
Identical reminder text is deduplicated for each input. Existing Claude/Codex
messages are unchanged; Pi-specific bilingual messages do not promise automatic
generation or authorize synchronization commands.

## Settlement and retries

`agent_end` is too early: recovery or queued work may follow. `agent_settled` is
notification-only and too late to request correction. The adapter therefore
uses `agent_before_settle` and preserves earlier boundary entries.

For a completed, non-aborted run, the core audits with `regenerate: false`.
Findings become a custom-message boundary draft. A first `block-stop` or
operational failure requests **one** corrective continuation. Subsequent
boundaries use `repeatedStop: true`, retain the core's warning downgrade, and
never request another DDD continuation. Repeated identical notices are omitted.
One recovery opportunity does not guarantee the issue was fixed.

The budget is runtime-local and scoped to session ID and cwd. Session changes,
new user/custom-trigger runs, and delivery of a queued user message reset it;
low-level `agent_start`/`agent_end` do not. Aborted/error outcomes and cancelled
signals do not trigger corrective turns. Other extensions can independently
request continuations; DDD does not override their budgets or decisions.
Deduplication and pending-result maps are each capped at 256 entries per input;
excess reminders may be omitted rather than allowing unbounded memory growth.

## Subagents and duplicate loading

Each child must actually load the adapter; parent loading alone is insufficient.
A runtime-local event-bus claim prevents duplicate handlers when ambient loading
and a required-child entry converge. Child/session retry state is independent,
and the adapter acknowledges only its own `ddd.pi.v1` ID.

For a trusted companion that already owns required-child registration, the
adapter optionally listens to `pi-safety:collect-child-extensions:v1` and appends
its own `{ id, path }`. The companion retains registration, disposal, startup
gating, runner requirements, and all safety decisions. DDD does not import or
replace the companion or depend on `pi-subagents` itself. The acknowledgement
uses `subagent:acknowledge-extension`.

Without that collector, automatic child inheritance is **not guaranteed**.
Explicitly load the adapter in each supported child or configure inheritance
through the host's reviewed source workflow. An acknowledgement is not proof
that every runner loaded the extension; verify required-extension snapshots and
actual child behavior before relying on a fleet deployment. Tests exercise the
collector and a separate installed child runtime, not a live subagent fleet.

## Verification

```sh
npm test
# Optional installed Pi contract tests; no installation or real model request:
PI_TEST_RUNTIME=/absolute/path/to/node_modules/@earendil-works/pi-coding-agent \
  node tests/pi-hooks.mjs
node scripts/release.mjs --check
```

The portable suite uses disposable boards and linked Git worktrees. The optional
suite uses the actual installed loader, runner, and SDK, in-memory sessions,
synthetic auth preflight, deterministic in-process model transport, and injected
bash process operations. Simulated shell commands are not executed. It checks
nested calls, final error composition in both guard orders, boundary validation,
one corrective continuation, optional inheritance, and duplicate loading.
It does not load user settings or make a real provider request. Guard fixtures
are not a substitute for validating a deployment's actual safety extension.

These are workflow/cost guards, **not a sandbox or security boundary**. Existing
host permissions, project/production boundaries, and human acceptance remain
necessary. No live activation or generation is implied by source tests.
