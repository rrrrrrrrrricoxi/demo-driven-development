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
- `ddd.mjs` is the write side: create a card, change a field, append a note, attach a link, read the board, export it (see "Card CLI").
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
folded by version) and a timeline. The timeline is one band per version plus
dev, test and the leftovers, around 200px folded; click a band and it expands
in place, packing its pull requests into at most six shared lanes so the
expanded height has a ceiling. The date axis is not linear — a quiet day gets a
few pixels and a day with many pull requests is widened to fit them side by
side, which is where the old one-row-per-pull-request timeline was spending
2400px of height for no information. The data comes from
`release-manifest.json`, written by:

```
node <plugin>/scripts/pr-sync.mjs [--dir <kanban>] [--dry-run] [--limit N]
```

which calls `gh` for the repository's pull requests and releases. `gh` has no
"all" — it takes a count — so `--limit` (default 1000, and `--release-limit`,
default 200, for tags) says how many to ask for, and the script says so on
stderr when the answer came back full, which is the only sign that older ones
exist. Pull requests it did not fetch this run keep the entry they already had
rather than disappearing from the board. The generator
itself makes no network call and reads no clock — "today" and "this may be
stale" are computed in the browser. Run the script after opening or merging a
pull request, and after tagging a release. Left unset, output is byte-identical
to a board without the feature.

## Settling cards against merged pull requests

A `release-manifest.json` is what turns this on — there is no config switch, and
a board without the file renders byte-identically.

With it present, pull request state flows back onto the cards. A card whose pull
requests have all merged while the card itself sits in a non-final status gets
an amber "merged, not settled" chip; a card already in a final status with a
pull request still open gets the opposite one; a card spanning several rounds
shows "2/3 merged". Links to a pull request in this repository carry its real
state wherever they appear, and a state word in the link title that no longer
matches is struck through rather than rewritten — the data stays as its author
left it, the board just stops repeating it. A backlog card that is ready, dated
more than thirty days ago and carrying no pull request picks up a quiet
"dormant N days" note. `gen` bakes only dates: the day counts are worked out in
the browser, since it reads neither the clock nor the network.

The release progress tab collects the unsettled cards into a section at the top,
grouped under the pull request that merged them, and the Stop guard names up to
five cards of each kind without blocking.

To act on that list:

```
node <plugin>/scripts/pr-sync.mjs --settle [--write] [--only <id>[,<id>…]]
```

`--settle` syncs first, then prints each waiting card with the status it should
move to — `done`, or `live` for a decision card. It only prints. `--write`
applies it: the status field, plus one dated line appended to the card's
timeline field where the card kind has one. `--only` narrows the write to the
cards you name while still printing the whole list, so what you skipped stays
visible; an id that is not on the list is refused outright and nothing at all is
written, because a half-applied settle is worse to unpick than an error.

A merged pull request is not the same thing as a finished card: a card routinely
spans several rounds, and the one that just landed may have shipped half of it.
Put a one-line reason in the card's `settleHold` field and the card drops out of
the list, loses its chip, stops being named by the guard, and shows one grey
chip with the reason in its tooltip. Nothing clears the field on its own; delete
it when the card really is ready.

## Rich text in card bodies (optional)

Card prose is written by one session for the next one to read, so it arrives
dense: `**bold**`, backticks, numbered findings, dated updates. Set
`config.richText` to `true` and the long fields of all three card kinds go
through a small renderer that understands `**bold**`, `` `code` ``,
blank-line paragraphs, single newlines, `-` and `1.` lists, `①`–`⑩` lists (the
circled number is kept as the marker), and a `【…】` opening as a dated section
with a hairline above it. It deliberately does not understand headings, tables,
link syntax or HTML, and escaping runs before any of it — a card can quote a
`<script>` tag and it stays text. Fields over 400 characters are baked twice, a
first-paragraph preview and the full text, with a quiet *expand · N more
characters* button between them. The same switch enables an optional `detail`
card field for the long trail of evidence, rendered after every other field as
a collapsed block. A non-blocking guard notice names cards whose prose runs
past 800 characters with no `detail` to move it into. Left unset, output is
byte-identical to a board without the feature.

## Archive tab (optional)

On a board that has been running a while, finished cards outnumber the live
ones several to one, and the backlog becomes a tab you scroll past rather than
work from. Set `config.backlogArchive` to `true` and the backlog lists only
cards that are not `done` — `deferred` stays, being parked rather than finished
— while the finished ones move to their own tab at the end of the tab bar,
rendered by the same card renderer in the same order. Badge counts follow, and
the `done` filter chip drops out of the backlog toolbar. Global search, the
lane and time filters, and deep links (`#CARD-ID`) reach the archive exactly as
they reached the backlog. With `lazyTabs` on it becomes a third part file,
`parts/archive.html`, with its own entry in the card → pane map, so a deep link
to an archived card still fetches the right part. Left unset, output is
byte-identical to a board without the feature.

## WIP limits (optional)

Set `config.wip` to an object — `{ "soft": 10, "hard": 20 }`; the object itself
is the switch, and the two thresholds default to those values. The count is the
`ready` cards only: `blocked` is waiting on somebody else and `deferred` is
parked, so neither takes up room in what can be started today. Over `soft`, the
backlog tab gets an amber dot and the pane a quiet grey line reading how many
cards are ready; over `hard`, the dot turns red and the line becomes a standing
banner suggesting the pile be cleared before new cards are added. With lanes
configured the numbers follow the selected lane, recomputed with the same
visibility rule that drives the tab badges. A non-blocking guard notice fires
at stop time when the total across lanes is over `hard`. Left unset, output is
byte-identical to a board without the feature.

## One file per card (optional)

Set `config.cardsDir` to a directory name — `"cards"` by convention, relative to
the kanban directory — and the backlog and decision cards move out of their
manifests into `<cardsDir>/backlog/<id>.json` and
`<cardsDir>/decisions/<id>.json`, one file each. The two manifests keep only
their headers; leaving an `items`/`entries` array behind in one is a hard error,
as is a filename that disagrees with the `id` inside it, or the same id twice.

The problem this solves is concurrent writes. Several sessions editing one large
manifest each rewrite the whole file, so they quietly take each other's in-flight
cards with them and git reports no conflict, because textually there wasn't one.
One path per card either avoids that or turns it into a conflict git can stop.
A board only one session ever writes to does not need this.

Each card carries an `order` field written by the migration — the array index it
had before, because array order *was* display order in several places. `gen`
sorts by `order` then by `id` and deletes the field afterwards. Cards created by
hand or by the CLI can leave it out; they sort last, by id. With the directory
configured, each card header also shows the date its file was last committed
(falling back to the file's mtime), and the "dormant N days" note counts from
that date instead of the card's creation date.

Migrate with:

```
node <plugin>/scripts/cards-split.mjs --dir app/kanban [--dry-run]
```

It writes the files, re-runs `gen`, and compares the output byte for byte with
what was there before; on any difference it puts everything back exactly as it
was and exits non-zero. `cards-join.mjs` is the way back, with the same check.
Upgrade every session before splitting — an older `gen` cannot see the card
directory. Left unset, output is byte-identical to a board without the feature.

## Card CLI

```
node <plugin>/scripts/ddd.mjs card new backlog|decision [--title "…"] [--line C] [--session dev]
node <plugin>/scripts/ddd.mjs card set <id> <field> <value> [--json]
node <plugin>/scripts/ddd.mjs card status <id> <status> [--no-note]
node <plugin>/scripts/ddd.mjs card note <id> "<text>"
node <plugin>/scripts/ddd.mjs card link <id> "<title>" <href>
node <plugin>/scripts/ddd.mjs card show|history <id>
node <plugin>/scripts/ddd.mjs card list [--status s] [--line X] [--session Y] [--since YYYY-MM-DD]
node <plugin>/scripts/ddd.mjs export [--out f.json]
node <plugin>/scripts/ddd.mjs pr-sync […]
```

`card new` allocates the next id and reserves it: with one file per card it
creates the file with `openSync(path, 'wx')`, so two sessions racing for the same
number both succeed and the loser steps to the next one. It fills a template
whose prose fields are `<…>` placeholders to be replaced; `--from file.json`
overrides any of them.

The write commands check what they write — the status has to be one the board
declares, a date has to look like `YYYY-MM-DD`, a `pr` has to be a number, `#12`
or `owner/repo#12`, a lane has to be in `config.lanes.ids` and a session tag in
`config.sessionTags`. Fields that hold arrays (`links`, `shots`, `walkthroughs`
and friends) have to be given as arrays, through `--json`. An unrecognised field
only warns, since boards grow fields; `id` and `order` cannot be changed at all,
the first because it is the card's identity and with one file per card its
filename too, the second because it is the display order. A link's scheme has to
be `http`, `https`, `mailto` or a path relative to the repository — anything
else would render as a live link on the board's own origin.

`card status` appends a dated timeline line unless told not to, on the card kinds
that have such a field; decision cards do not, so there only the status changes,
and `card note` says so rather than writing somewhere the board never reads.
`card link` dedupes by href and writes a link to this repository's pull request
into the `pr` field too. A new card with no `--line` lands in the board's default
lane, since a card with no lane is invisible in every lane view.

Every write goes through a temp file and a rename, keeps the card's existing key
order, slots only new keys into place, and ends with two-space indentation and a
trailing newline. Nothing is ever committed for you. `--json` gives machine
output (on `card set` it also means the value itself is JSON), and `--dir` picks
the board the same way `gen` does. Boards without a card directory work too: the
CLI rewrites the manifest as a whole there.

## License

[MIT](LICENSE)
