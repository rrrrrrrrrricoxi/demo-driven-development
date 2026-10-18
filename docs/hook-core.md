# Shared hook API

DDD supports Claude Code and Codex through adapters. The shared API in
`scripts/hook-core.mjs` lets another adapter call the same rules. This API does
not install or enable a new host. Pi integration is not included yet.

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
strings. The adapter decides how its host displays these fields. The existing
Claude/Codex encoder emits tool denial and stop blocking as JSON with exit code
0. It emits `failure` on stderr with exit code 2. Do not infer permission from
exit code 0 alone.

## Generation and retries

Settlement is read-only by default:

```js
runHook({ event: 'settle', cwd: projectRoot })
```

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
