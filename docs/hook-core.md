# Shared hook API

DDD supports Claude Code and Codex through adapters, and Pi through an
[explicit opt-in extension](pi.md). The shared API in `scripts/hook-core.mjs`
lets adapters call the same rules. This API does not install or enable a host.
The Pi adapter always passes `regenerate: false`.

## Responsibilities

The core locates the board, checks generated reads and merges, builds PR
reminders, and audits settlement. It returns a result without reading stdin,
writing stdout or stderr, changing environment variables, or exiting the
process. Importing these modules does not execute a hook.

Adapters normalize host events, select the project and tool working directories,
translate results, and control retries. Adapters also own host authorization,
installation, and lifecycle behavior. A DDD result cannot grant permission that
the host or another guard denied.

`hook-protocol.mjs` contains the existing Claude/Codex JSON normalization and
encoding. `claude-forward.mjs` contains Claude installation lookup and stale-cache
forwarding. Neither module belongs to the shared rule interface. The existing
hook script paths remain available for installed configurations.

## CLI use without a host adapter

The shared scripts need Node.js 18 or later. They do not require a Claude,
Codex, or Pi session. Resolve `<plugin>` from the package location and pass the
board directory explicitly when the caller's working directory is uncertain:

```sh
node <plugin>/scripts/ddd.mjs audit --dir <kanbanDir> --json
node <plugin>/scripts/ddd.mjs card show <id> --dir <kanbanDir> --json
node <plugin>/scripts/gen.mjs --dir <kanbanDir>
```

`audit --json` reports `block`, `broken`, and `chore` arrays. A successful audit
command can return exit code 0 with findings in those arrays. Inspect the
findings; exit code 0 does not mean the board is clean or authorize a tool call.
Shared CLI discovery uses `DDD_PROJECT_DIR` or the working directory, with an
explicit `--dir` taking precedence. Host environment variables belong to the
adapter and do not select a board for the CLI.

An explicit `gen` writes generated output. Run it on the project's main board
branch and keep source-writing sessions coordinated.

For a new board without host configuration, use init. Its default runtime is
`portable`; these commands make that choice explicit:

```sh
node <plugin>/scripts/init.mjs plan --dir <projectRoot> --brand Example --runtime portable
node <plugin>/scripts/init.mjs apply --dir <projectRoot> --brand Example --runtime portable --yes --no-commit
```

Portable init prepares board data without installing a host adapter or changing
host configuration. The shared engine reads its canonical version from
`package.json`; host manifests and installed-plugin registries are not core
version sources. Loading skills, running audits, and scheduling generation
remain the caller's work.
CLI availability does not establish lifecycle integration with that caller's
host. Existing boards can use the CLI and shared API without running init again.

## Request

```js
import { runHook } from './scripts/hook-core.mjs'

const result = runHook({
  event: 'before-tool', // before-tool | after-tool | settle
  cwd: '/absolute/project/path',
  tool: {
    kind: 'shell', // shell | read | other
    command: 'cat app/kanban/index.html',
    // path: '/absolute/path', // for structured reads
    // cwd: '/absolute/tool/path', // optional base for relative read paths
  },
  repeatedStop: false,
})
```

Supply an absolute `cwd` for board discovery. The core does not use
`DDD_PROJECT_DIR` or `CLAUDE_PROJECT_DIR` to override it. A tool event must use the
project that the tool operates in, including linked worktrees. `tool.cwd`
defaults to `cwd` and only controls relative read-path resolution. Settlement
does not need `tool`. Unknown events return `none`.

## Result

| `kind` | Meaning |
| --- | --- |
| `none` | DDD has no blocking decision; optional notices can still apply. |
| `deny-tool` | Reject this tool call; `reason` explains why. |
| `block-stop` | Continue the session to resolve `reason`. |
| `failure` | Settlement could not complete; `reason` describes the failure. |

Results can also contain `notice`, `additionalContext`, and diagnostic `stderr`
strings. Settlement preserves line breaks within each notice and separates
independent notices with a blank line. It also returns optional `noticeParts`
and `reasonParts` arrays for notice and failure entries. These arrays preserve
entry boundaries when the text itself contains blank lines. Adapters can use
the strings directly or format the entries for their host. The existing
Claude/Codex encoder emits tool denial and stop blocking as JSON with exit code
0. It emits `failure` on stderr with exit code 2. Do not infer permission from
exit code 0 alone. To preserve its existing display, this encoder compacts each
notice and failure entry to one line using these arrays; block reasons and
results without entry arrays keep their line breaks.

## Generation and retries

Settlement is read-only by default:

```js
runHook({ event: 'settle', cwd: projectRoot })
```

Shared audit and PR reminder text does not promise automatic generation. A
read-only adapter can use this guidance without rewriting it. Pi adds its own
read-only reminder after the shared settlement text.

An adapter must explicitly enable automatic generation:

```js
runHook({ event: 'settle', cwd: projectRoot }, { regenerate: true })
```

Claude and Codex retain this opt-in to preserve their existing Stop behavior.
Generation still checks the initialization lock, output version, freshness, and
branch state. Known feature branches and detached HEADs skip generation. The
existing behavior permits generation when Git or the mainline cannot be
resolved, including non-Git boards. This is not a strict mainline authorization
gate.

The adapter sets `repeatedStop` only when its lifecycle indicates a repeated
settlement attempt. The core then downgrades recoverable stop blocks and
generation failures to notices, as the existing hooks do. It does not maintain
retry state for the host.

## Compatibility limits

The generated-read and merge rules keep their existing literal shell parsing.
They do not interpret arbitrary shell expansions or code, and they are not a
security boundary. Host tool permissions remain necessary.

Claude stale-cache forwarding is restricted to the legacy Claude entry point
with an unset or `claude` `DDD_RUNTIME`. Explicit non-Claude runtimes never use
the Claude installation table. Forwarding preserves the original input, process
working directory, subprocess output, and exit status. Codex calls the core
directly and never imports the forwarding module.

Run `npm test` to check the existing hook behavior and the shared API contract.

## Journey rules and adapter conformance

Journey validation, summary hints, and iteration-history suggestions live in
shared modules. Card writes call `journey-summary.mjs`; both `ddd audit` and
settlement call the same collectors in `audits.mjs`. They do not select rules
by host name.

`journeySummary` flags a few fixed verification-report phrases in the three
summary fields. `journeySuggested` identifies a nonterminal card without a journey
that has a demo, more than 800 characters in a supported history field, and at
least three explicit dated headings. Both are advisory chores. They preserve
card data and do not request a corrective continuation. Other findings on the
same board can still block settlement. These heuristics cannot determine a
product requirement, choose the current design, or approve a decision. The
writing session must check the source evidence before organizing a card.

`tests/harness-contract.mjs` uses the same synthetic card data in English and
Chinese to check the following boundaries:

| Caller | Checked behavior |
| --- | --- |
| `ddd audit --json` | Both findings are chores; card sources and board files remain unchanged. |
| Direct `runHook` | Both findings are notices on first and repeated settlement; default settlement is read-only. |
| Claude and Codex script entry points | Existing adapters return the shared notices without blocking and preserve card JSON; their existing generation stays enabled. |
| Pi adapter callbacks | Notices preserve earlier boundary entries, request no continuation, and leave the board unchanged. |

The test also checks that generated journey reads are denied through the
existing mappings. The direct core and Pi checks leave unknown tool kinds
unclassified. Claude/Codex checks invoke the installed-configuration entry
scripts as subprocesses; they do not install or trust hooks. Pi checks load the
real DDD adapter with a small event driver; they do not claim an installed Pi
runtime test. The separate optional installed-Pi checks are described in
[Pi integration](pi.md#verification).

## Adding another host

A host can first call the shared CLI for explicit work. To add lifecycle
integration, implement only the host boundary:

1. Supply the actual project or tool working directory as an absolute `cwd`.
   Map only tool inputs whose semantics the host defines. Do not guess that a
   custom tool, PowerShell command, or outer code-mode script is a shell read.
2. Call `runHook` at the host's before-tool, after-tool, and settlement
   boundaries as applicable. The core returns a semantic result; it does not
   register events, install configuration, or manage the host's permissions.
3. Translate `deny-tool` into that host's denial and `block-stop` into its
   supported correction mechanism. Preserve other guards' decisions. Display
   notices and diagnostics without turning `none` into an authorization grant.
4. Keep settlement read-only unless generation is explicitly part of the
   adapter's contract. Track repeated settlement attempts in the host's own
   lifecycle and pass `repeatedStop`; bound corrective continuations.
5. Test the real host's working-directory selection, event timing, nested tool
   calls, error composition, retry resets, and hook loading. Reuse synthetic
   journey fixtures to check advisory delivery and evidence preservation.

Passing the shared contract tests proves the rules and the tested adapter
mappings. It does not establish compatibility with an untested host, automatic
child inheritance, hook trust, or a live unattended workflow. Add a supported
host claim only with that host's implementation and validation evidence.
