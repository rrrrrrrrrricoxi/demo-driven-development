# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version on `main` only moves up: `gen` stamps its output with the plugin
version and the guard refuses to overwrite newer output with an older gen, so a
downgrade would freeze every already-stamped board. See
[RELEASING.md](RELEASING.md).

## [Unreleased]

### Added
- Optional **rich text for card prose** (`"richText": true` in
  `kanban.config.json`). Card bodies are written by one session for the next
  one to read, and until now they arrived as one wall of text: the newlines
  were collapsed by `white-space`, and `**` and backticks showed up raw. With
  the switch on, the long fields of all three card kinds (background / approach
  / note, question / conclusion / demo note, problem / plan / notes) go through
  a small renderer that understands `**bold**`, `` `code` ``, blank-line
  paragraphs, single newlines, `-` and `1.` lists, `①`–`⑩` lists (the circled
  number stays as the marker), and a `【…】` opening as a dated section with a
  hairline above it. It deliberately does not understand headings, tables, link
  syntax or HTML — escaping happens first, so a card can carry a `<script>` in
  a code span and it stays text. With the switch off (the default), output is
  byte-identical to 0.12.0.
- A 400-character preview for long fields, under the same switch. A field over
  that length is baked twice — a first-paragraph preview and the full text —
  with a quiet "expand · M more characters" button between them. The existing
  height-based fold stays for everything else and steps aside for fields that
  were split, so the two never stack. Fold state is not remembered.
- An optional `detail` card field for the long trail of evidence — file-by-file
  findings, gray-box notes — rendered after every other field as a collapsed
  "verification detail · N characters" block. Cards without the field render
  byte-identically, and the field is only read when `richText` is on.
- The `source` field of decision cards is now rendered (as the same quiet badge
  backlog cards use). It has always been part of the data and was never shown.
- A non-blocking guard notice when a prose field runs past 800 characters on a
  card that has no `detail` field — it names up to five cards and the field to
  move. It only runs when `richText` is on.
- `scripts/lite.mjs` — the renderer as a pure module, so the rules and the
  escaping are unit-testable on their own.
- **Progress response** — pull request state now flows back onto the cards.
  Whenever `release-manifest.json` is present (the file `pr-sync.mjs` writes),
  a card whose pull requests are all merged while the card itself is still in a
  non-final status gets an amber "merged · not settled" chip; a card already in
  a final status that still has an open pull request gets the opposite one; a
  card spanning several pull requests shows "2/3 merged". A board without the
  file renders byte-identically.
- Links to a pull request in this repository now carry the real state (open /
  merged on a date / shipped in a release) wherever they appear in `links[]`,
  and a hand-written state word in the link title that no longer matches
  ("open", "to be merged", "merged") is struck through rather than edited —
  the data stays as the author wrote it, the board just stops repeating it.
- A quiet "dormant N days" note on backlog cards that are ready, dated more
  than 30 days ago and carry no pull request. The day count is computed in the
  browser; `gen` bakes only the date, as it neither reads the clock nor the
  network.
- An "unsettled" section at the top of the release progress tab, grouping those
  cards under the pull request that merged them, and two non-blocking guard
  notices at stop time naming up to five cards of each kind.
- `scripts/pr-sync.mjs --settle` prints, after syncing, the cards whose pull
  requests are all merged along with the status each one should move to
  (`done`, or `live` for decision cards). It only prints; `--settle --write`
  applies it — the status field, plus one dated line appended to the card's
  timeline field where the card kind has one. It refuses to rewrite a manifest
  that is not formatted the way `JSON.stringify(…, null, 2)` writes it, so a
  settle run can never reflow bytes somebody else wrote by hand.
- `scripts/settle.mjs` — the three judgements as a pure module shared by the
  generator, the guard and `pr-sync`, so there is one definition of "settled"
  rather than three.

### Changed
- The reminder injected after a `gh pr merge` now points at
  `pr-sync.mjs --settle` (sync, then see which cards are waiting to be
  settled) instead of the generic "check whether a card needs advancing". Every
  other `gh pr` subcommand keeps the reminder it had.

## [0.12.0] - 2026-08-26

### Added
- An optional `pr` card field on progress, backlog and decision cards — `230`,
  `[227, 230]`, or `"owner/repo#4"` for another repository. It renders a quiet
  chip in the card head next to the session seals, linking to the pull request.
  This is the first structured link between a card and the work that implements
  it; until now it lived in prose. Cards without the field render
  byte-identically to 0.11.4.
- An optional **acceptance tab** (`"acceptanceTab": true` in
  `kanban.config.json`), fed by a new `acceptance-manifest.json` next to the
  other manifests. One checklist per pull request (or per group of them):
  environment notes, grouped items with what to do / what to expect / what is
  wrong / why, data blocks rendered as tables and copyable as TSV, round and PR
  filters, tick-off state in `localStorage` keyed by revision, a group index
  with per-group progress, and a "copy result" button that produces the JSON to
  paste back into the manifest so a finished round of acceptance lands in git
  rather than in one browser. The card head of a pull request that has a
  checklist gains a link to it and a live `n/N` counter.
- Four non-blocking guard notices for the acceptance data: `current` pointing
  at a pull request no checklist covers, one pull request claimed by two
  checklists, duplicate item ids, and card ids that do not exist on the board.
  A malformed manifest produces one notice instead of a crash.
- `scripts/prlink.mjs` — the single definition of "which pull requests does this
  card belong to" (the explicit field, plus `links[]` entries pointing at
  `/pull/N` in the board's own repository). Chips render only from the explicit
  field, so an existing board full of pull-request links does not sprout chips.
- An optional **release progress tab** (`"releaseTab": true`), fed by a new
  `release-manifest.json`. Every pull request lands in one of three fixed stages
  — `dev` (open), `test` (merged into the main branch, not yet shipped), `prod`
  (shipped with a release) — with labels and hints the board may rename, and a
  board that ships on merge may list only two. Pull requests based on another
  branch, and ones closed without merging, are counted apart rather than forced
  into a stage. A merged pull request belongs to the earliest release tagged at
  or after its merge — the precise tagging instant, so something merged an hour
  after the tag counts as not yet shipped; an explicit `releases[].prs` list
  wins over that interval. Instants, not strings: a hand-written `+08:00` `at`
  and the UTC stamps `gh` returns can sit in the same file. Two views of the
  same data: a sortable, searchable table (number, title, stage, status and
  date, cards, branch, acceptance progress; ordered by stage before date, so
  open pull requests stay on top instead of sinking below the newest version's
  block; shipped ones folded by version, newest open) and a timeline (one bar
  per pull request from opened to merged, open ones dashed to today, releases as
  vertical lines). Every table row carries a `pr-<number>` anchor for deep links.
- `scripts/pr-sync.mjs` — the script that fills that manifest from `gh pr list`
  and `gh release list`. It rewrites `prs[]` wholesale, appends release tags it
  has not seen, and never overwrites a hand-written `note` or `prs` list. If
  `gh` is missing, logged out, or offline it exits non-zero without touching a
  byte. `--dry-run` prints what it would write. The generator stays free of
  network and clock: "today" and "this may be stale" are computed in the browser
  from the baked `syncedAt`.
- The card chips gained their state suffix (open / draft / merged 08-26 /
  shipped v0.0.3 / closed, and off-mainline for one based on another branch),
  which the release manifest now supplies. Same caliber as the tab, so a chip
  and a table row never disagree about the same pull request. It works whenever
  the file is present, whether or not the tab is on.
- `scripts/relstage.mjs` (the stage decision as a pure function) and
  `scripts/kanban-dir.mjs` (one definition of `--dir`, shared by the generator
  and `pr-sync`).
- A new board created by `init` gets both new manifests as empty templates.
  Existing boards are left alone — both tabs default to off, and a board with
  neither key set nor either manifest present generates byte-identical output to
  0.11.4.

### Fixed
- Status badges wrapped one character per line on cards with long titles,
  stretching a 38px row to 88px and pushing the title down to a sliver. The row
  head is a flex line whose children are all `flex: none` except the title and
  the badge, so those two were the only shrinkable items — and flex distributes
  shrinkage between them in proportion to their sizes rather than exhausting the
  title first. The badge had no `white-space` declaration, and CJK text breaks
  between any two characters, so its min-content width was a single character:
  under pressure it collapsed into a vertical strip of stacked characters and
  became the tallest thing in the row. `.badge` is now `white-space: nowrap` and
  `flex: none`, leaving the title (`min-width: 0`, ellipsis) as the one item
  that gives way. The session seal (`.cardsess`) gains `nowrap` for the same
  reason — it was only spared because its container is `flex: none`. This
  changes rendered output on every board, not only affected ones.

## [0.11.4] - 2026-08-20

### Added
- Two optional card fields for keeping the scene with the card, so a card still
  makes sense months later:
  - `shots` on decision and backlog cards — `["x.png"]` or
    `[{"file":"x.png","caption":"…"}]`. A bare filename resolves under the
    board's `shots/` directory (naming the file after the card id also groups
    it in the screenshot gallery and links back to the card); a path is used
    as-is. Thumbnails render inside the card body and open the full image.
    When a screenshot arrives with the request that creates a card, it now has
    a place to live — a line of prose rarely brings back what an image does.
  - `repro` on backlog cards — a string, or an array of steps rendered as a
    numbered list. Bug cards carry their own reproduction path.
- Both rules are written into the `ddd-workflow` skill (card-creation step) and
  `kanban-init`. Neither field adds CSS — the existing thumbnail styling is
  reused — and cards without them render byte-identically to 0.11.3.

## [0.11.3] - 2026-08-20

### Added
- A documentation-mounting rule in the `ddd-workflow` skill, promoted from host
  practice and framed as the sibling of "every demo hangs off a card": a spec,
  review write-up, implementation plan, handover, or ops runbook goes into
  `config.docs[]` **in the same commit that lands the file**, so it is readable
  from the board's document library. Output must be discoverable — a document
  that only exists in the repo is invisible to collaborators and to other
  sessions. The rule also states the timing (do not batch up a backlog; the way
  back is a set-difference between mounted paths and the markdown on disk) and
  the quality gate (check the content is still accurate; fix a stale or
  contradicted document before mounting it, and leave the purely-archival ones
  off). `kanban-init` carries the same rule as a post-init note.

## [0.11.2] - 2026-08-20

### Fixed
- Horizontal jump when filtering. Filters hide cards with `display: none`, so
  narrowing a board to a couple of cards collapses the page below one viewport
  and the vertical scrollbar disappears; the wider viewport re-centres the
  `margin: 0 auto` container and the whole page shifts sideways. `<html>` now
  reserves the scrollbar gutter (`scrollbar-gutter: stable`) on the board, doc
  pages, and the screenshot gallery, so width stays constant across filtering.
  Only visible with classic (space-taking) scrollbars; no effect where the OS
  uses overlay scrollbars.

## [0.11.1] - 2026-08-20

### Fixed
- Theme flash on load (FOUC) when a manual light/dark choice differs from the
  system preference: the stored choice was only restored by script at the very
  end of the document, so on large boards or slow links the page rendered in
  the system theme for seconds before snapping to the chosen one. A three-line
  synchronous boot script now stamps `data-theme` in `<head>` before the
  stylesheet on all three page kinds (board, doc pages, screenshot gallery),
  so the first painted frame is already the chosen theme. Boards without
  `darkMode` are unaffected (byte-identical).

## [0.11.0] - 2026-08-20

### Added
- Lazy tab loading, opt-in via `config.lazyTabs: true`, for boards grown heavy
  on slow links. The two largest panes (decisions, backlog) are emitted as
  `parts/*.html` and fetched on first visit; the first-paint shell keeps every
  tab (with baked badge counts), skeleton cards in the lazy panes, and a thin
  top progress bar driven by real byte counts (the uncompressed pane size is
  baked in as the denominator, so gzip transfer still reports true progress).
  After injection the runtime re-wires the pane — toolbar factory, global
  search stamps, time-filter stamps, all idempotent — so deep links (via a
  baked card-id → pane map), cross-tab search, lane/time/session filters, and
  hash routing behave exactly as in single-file mode. A failed fetch shows a
  quiet retry line. Serving through the bundled `serve.py` is assumed (the
  documented path). Unset or `false`: single-file output, byte-identical, and
  any stale `parts/` directory is cleaned up.

### Changed
- `templates/serve.py` gains the two host-proven patches upstream: a threading
  server (one slow client no longer blocks everyone) and per-request gzip for
  text types (~75% transfer cut), plus a `Vary: Accept-Encoding` header and a
  directory-redirect edge fix.

## [0.10.0] - 2026-08-19

### Added
- Demo form conventions in the `ddd-workflow` skill, promoted from host-project
  practice to plugin mechanism: a multi-variant selection demo is one single
  HTML page (never one file per variant); three or more variants get a fixed
  left-side navigable TOC (click-to-jump plus scrollspy, with the two
  field-tested pitfalls documented — the injected back-nav bar's 44px offset,
  and a bottom-of-page fallback so the last item still lights up); on
  multi-round decisions the card's `demo` field always points at the latest
  round, with older rounds kept in `links` and labeled by round.
- `docs/demo-binding.md` — the binding recipe for consolidating an old
  multi-file round into a single archive page via same-origin iframes with
  zero interaction loss (lazy `data-src`, back-nav stripping inside the child
  document, auto-height with re-measure and MutationObserver, hard fallback).
- The Stop guard's orphan audit now recognizes binding references: a demo
  embedded via iframe (`data-src`/`src`, same-directory) from an already
  covered demo is not an orphan, and the exemption propagates through nested
  bindings. Placeholder card links for bound children are no longer needed;
  a broken reference makes the child an orphan again.

## [0.9.0] - 2026-07-16

### Added
- Dark mode, opt-in via `config.darkMode: true`. The board, doc pages, and the
  screenshot gallery follow the system light/dark preference, with a manual
  toggle in the top bar that remembers the choice (shared across the three page
  kinds). Every color — including the per-card inline status colors — is baked
  as a CSS `light-dark()` pair; the dark side is a warm pastel palette tuned
  for night reading rather than an inversion. Requires a 2024+ browser when
  enabled. Boards without `darkMode` (or with `false`) render byte-identically
  to 0.8.0.

## [0.8.0] - 2026-07-16

### Changed
- Lanes are now config-driven. A board that tracks parallel timelines sets
  `config.lanes` to an object (`ids`, `titles`, `hints`, and so on) and gives
  each card an explicit `line`; the generator no longer carries any host-specific
  derivation heuristics or hardcoded profile. Boards with `lanes` unset render
  byte-identically to 0.7.0. The old string form `"lanes": "lamos-legacy"` is
  accepted as a deprecated alias (with a warning) for one release and will be
  removed next.

### Removed
- The first host project's baked-in lanes profile, back-navigation marker, and
  the byte-copied legacy test fixture. The time-machine regression is now
  reproduced synthetically (a stale `ddd-backnav v2` block), so the guard's
  self-heal is still covered without shipping the old sources.

## [0.7.0] - 2026-07-15

Initial public release. The plugin grew inside its first host project and was
extracted as a standalone Claude Code plugin, carrying the full feature set
through 0.6.3 and an 88-assertion adversarial test bed (`npm test`).

> Releases before 0.7.0 predate this public repository. They are recorded below
> for lineage; their tags and commit history live in the maintainer's private
> archive, not in this repo.

## [0.6.3] - 2026-07-15

### Changed
- Toolbar layout when session ownership tags are configured. The control row now
  splits by meaning into a set-filters row (lanes / ownership / type) and a
  view-actions row (sort / full-width search / clear), so the search box no
  longer gets squeezed onto an unstructured second line. Boards without
  `sessionTags` render byte-identically to 0.6.2.

## [0.6.2] - 2026-07-15

Repository maintenance ahead of the public release. No intended user-facing
change; the only output difference is that boards which never set
`instance.appBase` now produce site-relative links instead of a hardcoded
default host.

## [0.6.1] - 2026-07-15

### Added
- CONTRIBUTING guide, including the language policy (Chinese-first comments and
  design docs; user-visible strings go through `strings.mjs` in both `zh` and
  `en`; repo-facing docs in English).

### Changed
- The generator's hard-failure errors are now bilingual. Errors raised after the
  config is read follow the board's `config.lang`; the few that fire before the
  config is readable carry both languages.

## [0.6.0] - 2026-07-14

Guard version-stamp system. From this release the plugin version is monotonic:
downgrades are destructive because the guard refuses to overwrite newer output.

### Added
- `gen` writes a version stamp (`<!-- ddd-gen vX.Y.Z -->`) on line 2 of
  `index.html`.
- The guard heals output written by an older generator and refuses to let a
  session on an older plugin overwrite newer output, warning instead of
  clobbering.
- `retire-stale-caches.mjs`, which shims superseded plugin-cache versions so
  long-lived old sessions get a restart notice instead of silently overwriting a
  board with stale output.

### Fixed
- The demo back-navigation strip logic now clears every stale block (not just the
  first) and preserves manual edits when re-injecting, ending a loop where an old
  generator could repeatedly re-stack an outdated back-bar.

## [0.5.2] - 2026-07-14

### Added
- Scene-fit guidance. `docs/scene-fit.md` describes when the demo-driven approach
  applies (SEE-IT taste forks) and when it does not (KNOW-IT correctness work),
  and step 0 of the `ddd-workflow` skill runs that check before each task. A
  convergence rule guards against serial over-iteration on an already-good
  choice.

## [0.5.1] - 2026-07-14

### Fixed
- Color values injected into `style` attributes are now HTML-escaped.
- The theme.css `</style>` guard is case-insensitive and covers whitespace and
  slash variants.
- theme.css edge cases: a directory now errors clearly, and an empty file is
  treated as "no theme" so byte-freeze holds.
- `docs[].out` is validated as a bare filename, closing a path-traversal gap.
- The Stop hook uses `spawnSync` and passes generator warnings through instead of
  surfacing them only on failure.

## [0.5.0] - 2026-07-13

### Added
- Session ownership tags. `config.sessionTags` plus per-card badges and a toolbar
  filter-chip group let you attribute cards to parallel work-streams. Boards
  without `sessionTags` render byte-identically to 0.4.0.

## [0.4.0] - 2026-07-13

### Added
- Project theming. Drop a `theme.css` next to `kanban.config.json` to reskin every
  page, and use `config.themeColors` for the semantic colors injected as inline
  styles. With neither configured, output is byte-identical to the previous
  release.
- Standalone HTML guide archiving. A `config.docs[]` entry with `type:"html"`
  copies a self-contained page into `refs/` verbatim (source left in place for
  live serving), with an optional `liveUrl` badge.

## [0.3.1] - 2026-07-13

### Fixed
- init merge-selection hardening: unmatched `--only`/`--exclude` patterns warn
  instead of silently doing nothing, a `./` path prefix is stripped, and assets
  referenced only by skipped pages are no longer mis-migrated.

## [0.3.0] - 2026-07-13

### Added
- Rebrand support. `config.brand` is templated across the board, and the demo
  back-navigation bar uses a neutral, project-independent marker.

## [0.2.1] - 2026-07-13

### Fixed
- Sticky navigation in the document library.

## [0.2.0] - 2026-07-13

### Added
- Board polish: a decision-tab filter toolbar (status chips, type dropdown, sort,
  search), a four-section document-library hub with `config.docSegments` to remap
  a category to a different section, and per-document read-progress tracking.

## [0.1.0] - 2026-07-13

Initial plugin.

### Added
- Two skills: `ddd-workflow` (the design-demo, review, code, verify, PR rhythm)
  and `kanban-init` (scaffold a new board, merge scattered demos, or take over a
  legacy hand-rolled board).
- Two guard hooks: a Stop guard that regenerates the board and blocks demos not
  linked to any card, and a `gh pr` reminder that nudges card status.
- A zero-dependency generator (`gen.mjs`) that builds the single-file kanban from
  four manifest JSONs, and a deterministic `init.mjs` (scan, plan for review,
  then apply without overwriting project data).
