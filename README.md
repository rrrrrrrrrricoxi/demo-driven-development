# demo-driven-development

A Claude Code plugin that turns UI/UX decisions into things you can look at before you commit code: one self-contained HTML demo per decision, a single-file kanban that tracks every decision to its demo, and guard hooks that keep the two consistent.

## The idea

Some decisions are SEE-IT decisions: layout, visual weight, interaction feel, copy tone. You can't judge them from a description, but you can judge them in seconds once the options sit side by side in a browser. Other decisions are KNOW-IT decisions, like data models, correctness questions, and migrations. A demo tells you nothing there; specs and tests do.

This plugin packages the SEE-IT half as a workflow:

1. For each real fork in the road, build cheap self-contained HTML demos of the options.
2. Link every demo to a card on a decision kanban. A guard hook blocks orphan demos, so the audit trail stays complete.
3. A human picks. Then you write the real code.

`docs/scene-fit.md` describes the applicability boundary, including when *not* to use this. Step 0 of the workflow skill runs that check before every task, so the plugin itself will tell you when a demo is the wrong tool.

## What's in the box

- Two skills. `ddd-workflow` is the day-to-day rhythm: scene-fit check, demo, human review, then code, verify, PR. `kanban-init` scaffolds a new board, merges scattered demos into one, or takes over a legacy hand-rolled board.
- Two hooks. A Stop guard regenerates the board when inputs change and blocks demos that aren't linked to any card. A second hook nudges card status after `gh pr` actions. Both check whether the project actually uses this plugin before doing anything, so they stay silent everywhere else.
- `gen.mjs` builds the kanban (`index.html`) from four manifest JSONs, renders project markdown into board-local pages, and injects a back-navigation bar into each demo.
- `init.mjs` runs a deterministic scan, prints a plan for human review, and applies it without overwriting project data.
- `retire-stale-caches.mjs` defuses superseded plugin versions that long-lived sessions are still pinned to (see "Upgrading").

The plugin has no npm dependencies: plain Node, plus one optional Python file server.

## Install

Inside the target project's Claude Code session:

```
/plugin marketplace add rrrrrrrrrricoxi/demo-driven-development --scope project
/plugin install demo-driven-development@demo-driven-development --scope project
```

`--scope project` writes both entries into the repo's `.claude/settings.json`, so teammates get the workflow with no per-machine setup. Outside a session, the same two steps are `claude plugin marketplace add …` and `claude plugin install …`.

## Quick start (new project)

```
node <plugin>/scripts/init.mjs scan  --dir <projectRoot>
node <plugin>/scripts/init.mjs plan  --dir <projectRoot> --brand MyApp
node <plugin>/scripts/init.mjs apply --dir <projectRoot> --brand MyApp --yes
python3 app/kanban/serve.py        # then open the printed port
```

`apply` seeds the board skeleton (config, empty manifests, `demos/`, a file server), adds deny rules so Claude never wastes tokens reading generated files, and appends a short section to the project's CLAUDE.md. Re-running it is a no-op. For projects that already have scattered demos or an older hand-rolled board, `scan` detects the situation and `plan` shows the merge or takeover before you confirm it. Details live in `skills/kanban-init/SKILL.md`.

## How the guard works

On every Stop, the guard compares mtimes: if any manifest, demo, theme file, or the generator itself is newer than `index.html`, it regenerates the board, so nobody has to remember to ask for an update. `gen` also writes a version stamp (`<!-- ddd-gen vX.Y.Z -->`) on line 2 of `index.html`. A session running an older plugin refuses to overwrite newer output and warns instead; a newer plugin heals older output automatically. Separately, every `demos/*.html` must be referenced by a manifest or listed in `demos/.no-card-ok`, otherwise the session is blocked until the demo gets a card.

## Upgrading

The plugin version on `main` only moves up. A downgrade would freeze every stamped board, so never merge a lower version.

After an upgrade, the first regeneration changes exactly one line of `index.html` (the stamp). Byte-equivalence checks normalize it first: `sed '/<!-- ddd-gen v/d'`.

Long-lived sessions keep whatever plugin version they started with. After upgrading, run `node <plugin>/scripts/retire-stale-caches.mjs` (dry-run by default, `--yes` to apply). It shims superseded cache versions so old sessions get a restart notice instead of silently overwriting your board with stale output. The script skips versions that are still registered as some project's current install.

Release history is in [CHANGELOG.md](CHANGELOG.md); the process for cutting a release is in [RELEASING.md](RELEASING.md).

## Assumptions

- Card links point at GitHub (blob and commit URLs).
- The PR reminder hook watches the `gh` CLI.
- `serve.py` needs Python 3; the helper scripts assume macOS or Linux.
- The board lives at `app/kanban/` (fixed path, on purpose).
- Skills, docs, and code comments are written in Chinese; runtime guard messages follow the board's `config.lang` (`zh` or `en`). Claude executes either language equally well. Chinese-first docs are a maintainer choice, not a runtime limitation.

## Token economy

A mature board's `index.html` can reach hundreds of thousands of characters. `TOKEN-ECONOMY.md` is the cost discipline that keeps Claude from ever reading generated files: verify from the source of truth (manifests, markdown sources, generator exit codes) instead. `kanban-init` wires deny rules into the target project, so the discipline is enforced rather than advisory.

## Lanes (optional)

Most boards do not need this. When a board tracks parallel timelines or eras (say A archived, B history, C current), set `config.lanes` to an object (`ids`, `titles`, `hints`, and so on) and give each card an explicit `line`. The kanban then renders per-lane filter chips and hints. Left unset, lanes are off and output is byte-identical to a board without the feature. See the kanban-init skill for the full shape.

## Dark mode (optional)

Set `config.darkMode` to `true` and the board (plus doc pages and the screenshot gallery) follows the system light/dark preference, with a manual toggle in the top bar that remembers your choice. Colors are baked as CSS `light-dark()` pairs — the dark side is a warm pastel tuned for night reading, not an inversion. Left unset, output is byte-identical to a board without the feature. Needs a 2024+ browser.

## Lazy tabs (optional)

For boards that have grown heavy on slow links, `config.lazyTabs: true` splits the two biggest tabs (decisions, backlog) into `parts/*.html` fetched on first visit, leaving a small first-paint shell with skeleton cards and a thin real-progress bar. Deep links, global search, and every filter keep working — the runtime re-wires each pane after injection. Requires serving via the bundled `serve.py` (the documented path anyway). Left unset, output is a single file, byte-identical to a board without the feature.

## Acceptance tab (optional)

Set `config.acceptanceTab` to `true` and the board grows a tab fed by a new
`acceptance-manifest.json` sitting next to the other manifests: one checklist
per pull request (or per group of them), with the environment under test, items
built from *what to do / what to expect / what is wrong / why*, data blocks
rendered as tables and copyable as TSV, and round and pull-request filters.
Ticks live in `localStorage`, keyed by the checklist's `revision` — bump it and
the previous round's ticks retire. A "copy result" button produces the JSON to
paste back into the manifest's `result`, so a finished round of acceptance lands
in git instead of in one browser. Cards whose pull request has a checklist gain a
link to it and a live `n/N` counter. Left unset, output is byte-identical to a
board without the feature; turning it on without the manifest is a hard error.

## Release progress (optional)

Set `config.releaseTab` to `true` and the board grows a tab showing where every
pull request stands: **dev** (open), **test** (merged into the main branch, not
yet shipped), **prod** (shipped with a release). A board that ships on merge can
list only two stages. Pull requests based on another branch, and ones closed
without merging, are counted separately rather than forced into a stage. The tab
offers two views of the same data — a table (number, title, stage, status and
date, cards, branch, acceptance progress; sortable, searchable, released ones
folded by version) and a timeline (one bar per pull request from opened to
merged, release tags as vertical lines). The data comes from
`release-manifest.json`, written by:

```
node <plugin>/scripts/pr-sync.mjs [--dir <kanban>] [--dry-run]
```

which calls `gh` for the repository's pull requests and releases. The generator
itself makes no network call and reads no clock — "today" and "this may be
stale" are computed in the browser. Run the script after opening or merging a
pull request, and after tagging a release. Left unset, output is byte-identical
to a board without the feature.

## License

[MIT](LICENSE)
