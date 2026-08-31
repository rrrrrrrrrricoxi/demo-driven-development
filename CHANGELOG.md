# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version on `main` only moves up: `gen` stamps its output with the plugin
version and the guard refuses to overwrite newer output with an older gen, so a
downgrade would freeze every already-stamped board. See
[RELEASING.md](RELEASING.md).

## [0.15.8] - 2026-09-01

### Fixed
- **The long-prose audit notice carries its `⚠` again.** Collapsing it to one
  line in 0.15.7 dropped the leading `⚠ `, which is how every non-blocking guard
  notice marks itself apart from the blocking ones — without it the line read
  like a message that had stopped the session. Restored in both language tables;
  the wording is otherwise unchanged.

## [0.15.7] - 2026-09-01

### Changed
- **The long-prose audit notice is one line.** It used to print a header
  followed by a bulleted list of up to five cards, each with its longest field
  and that field's character count, plus the three writing rules the skills
  already carry. In a terminal that is a paragraph asking to be skimmed for one
  fact: is there anything to tidy, and where do I start. The notice now says
  exactly that — how many cards carry a prose field over 800 characters with no
  `detail`, and which card and field is the longest — in a single sentence with
  no per-card list and no character counts. The audit itself is unchanged: same
  800-character threshold, same terminal-card skip, same non-blocking notice,
  same count.

### Fixed
- **A timezone-dependent test.** The doc- and screenshot-mtime fallback test
  built its expected date from the local calendar while `gen` formats an mtime
  in UTC, so on a machine east of UTC the two assertions failed for the first
  hours of every local day. The test now derives the expected date from the
  file's own mtime the way the product does. No product behaviour changed.

## [0.15.6] - 2026-09-01

### Fixed
- **The long-prose audit skips cards in a terminal status.** The guard notice
  that names cards whose prose runs past 800 characters with no `detail` counted
  every card, including the `done`, `live` and `closed` ones — cards that have
  landed and will never be rewritten. On a board with any history the notice was
  mostly a list of archived cards, and no amount of work could make it shrink,
  so it stopped reading as an ask. The audit now skips terminal cards, reusing
  the same `TERMINAL` set the settle judgements use (`settle.mjs`), so only
  cards someone might still edit get named and the total counts only those. The
  message, the 800-character threshold and the five-card cap are unchanged, and
  nothing about the generated board moved.

## [0.15.5] - 2026-08-28

### Fixed
- **The release timeline's band gutter is clickable as a whole cell.** Expanding
  a band grows its left column to the band's full height, but only the two lines
  of text in it toggled — the tinted area below them looked like part of the same
  control and did nothing. The gutter cell itself is now the trigger
  (`role="button"`, `tabindex="0"`, `aria-expanded`, `cursor: pointer`, a hover
  wash over the whole cell, and Enter/Space from the keyboard, which puts focus
  back on the same band after the redraw). The heading inside is now plain text,
  and the `title` tooltip moved with the trigger, so nothing else about the band
  head changed.
- **The axis row and the bands share one gutter width.** The date axis started
  its days at a hard-coded `TL.lbl` while the band gutters took their width from
  CSS, and the axis row had no gutter cell at all — so its divider sat tens of
  pixels off the bands', and scrolling sideways slid date labels under the band
  names. The width is now defined once (`REL_GUT` → the `--relgut` custom
  property, which `.relgut`, `.relsub` and the axis all read, and which `TL.lbl`
  is generated from), and the axis row renders its own sticky gutter cell with
  the same right border. Both stick to the same scroll container, so the two
  dividers stay aligned at every scroll offset.

## [0.15.4] - 2026-08-28

### Changed
- **The archive pane's title no longer says "Backlog."** A `backlogArchive`
  board's archive tab read `<brand> · Backlog · 归档` — a card that has landed
  and left the backlog was still being introduced as backlog. The `<h1>` is now
  just `<brand> · 归档`, matching how every other pane (docs, acceptance,
  release) names itself off `BRAND` alone. The note under it now says the
  cards are done queuing, not merely moved. The tab label ("归档 · N") is
  unchanged, and boards without `backlogArchive` see no difference.

## [0.15.3] - 2026-08-28

### Added
- **`config.stickyTabs`: the tab bar freezes under the hub bar.** Scroll a long
  pane and the tab bar was gone — switching panes meant scrolling all the way
  back up. `stickyTabs: true` makes `.tabbar` `position: sticky` at the hub
  bar's measured height (`--ddd-hubh`, remeasured on load and on resize through
  a rAF, because the hub bar's flex-wrap changes height with the window), so
  the tabs stay one click away wherever you are on the page. It sits at
  `z-index: 50` — under the hub bar (60), the lazy-load progress line (70) and
  the release peek card (65), over everything in the panes — takes the hub
  bar's own `--bg` so cards do not show through, and paints its 14px bottom
  margin with a same-colour shadow rather than changing the layout (turning
  that margin into padding would push the underline away from the tabs and
  break the active tab's -1px overlap). Horizontal scrolling of the tab bar
  itself is untouched: `overflow-x` on the sticky element does not affect its
  own stickiness.

  Everything that used to compensate for one sticky bar now compensates for
  two: the global anchor offset becomes
  `calc(var(--ddd-hubh) + var(--ddd-tabh) + 12px)` instead of a flat `58px`, so
  a deep link no longer parks the card's header behind the tab bar; the docs
  library's own sticky nav strip and its scroll-spy boundary move down by the
  tab bar's height as well. `--ddd-tabh` is measured from the live element next
  to the existing hub-bar measurement, not guessed.

  With `tabRail` also on, the rail is suppressed — the two are answers to the
  same problem ("the tab bar left" versus "the tab bar never leaves"), and
  `stickyTabs` is now the recommended one. Unset or `false` leaves the output
  byte-for-byte frozen.

### Fixed
- **The tab rail's hand-off gap.** The hub bar is `position: sticky`, but the
  IntersectionObserver watching the tab bar used the viewport as its root — so
  while the tab bar slid *under* the hub bar it still counted as intersecting,
  and the extra `boundingClientRect.top < 0` condition kept the rail hidden.
  For that whole stretch neither the tab bar nor the rail was on screen. The
  observer now carries `rootMargin: '-<hub height>px 0px 0px 0px'` so the
  covered strip stops counting as visible, and the decision is a single
  measured test — `bar.getBoundingClientRect().bottom <= hubH + 1` — shared by
  the observer, a rAF-throttled `scroll` fallback (for boundary jitter) and the
  media-query listener, with no scroll-direction condition left. The observer
  is rebuilt on resize, since `rootMargin` is fixed at construction time and
  the hub bar's height is not. Clicking a rail item still lands the tab bar
  against the hub bar's lower edge, which now puts its bottom edge below
  `hubH`, so the rail retracts on its own. The rail also fades in from 8px to
  the left over 120ms, skipped under `prefers-reduced-motion`.

## [0.15.2] - 2026-08-27

### Added
- **Hover peek cards on the release timeline.** A PR opened and merged the same
  day is drawn as a square a handful of pixels wide — too narrow for its own
  number, let alone a title. All it had was the browser's native `title`
  tooltip: it truncates, it takes a second to appear, and it would stack as a
  second layer under anything the board drew itself. Hovering a bar or a square
  (150 ms, so sweeping across a row does not flicker a trail of cards) or
  tabbing onto one now floats a small card beside it: `PR #N` with the full
  title, status and date, branch, the linked card chips (clicking one switches
  pane, as in the table), and the acceptance count when that PR has a checklist.
  Every field is read from data already baked into the page — the row in the
  table right below — so nothing is baked a second time. The native `title` is
  gone, bars and squares carry an explicit `tabindex`, `Esc` dismisses, and the
  card stays put while the pointer is inside it so the chips are reachable.
  On a collapsed version band, each segment stands for one day: hovering it
  lists that day's PRs (number plus short title, capped at ten with "还有 N 个"),
  while clicking the band header still expands it. Touch gets the two-tap
  pattern — first tap shows the card, second follows the link. Works the same
  with `lazyTabs` on and off; the whole thing lives in the shell, so
  `parts/release.html` is byte-for-byte what it was.

### Changed
- **`card new backlog`'s default tier is no longer always the first key in
  `tiers`.** A board adopted through legacy takeover gets a `tiers."0"` entry
  as init leftover, so that first key sat there as the default long after the
  board had moved on to real tiers — nearly every `card new` needed a manual
  `--tier` fix-up. The default is now whichever tier is most common among the
  existing non-done cards (ties go to the tier listed earlier in `tiers`;
  falling back to the first key when there are no non-done cards yet). An
  explicit `--tier` still wins over the computed default.

## [0.15.1] - 2026-08-27

### Fixed
- **Clicking the left tab rail landed one screen too far down.** The rail exists
  only while the tab bar is off the top of the viewport, and the click scrolled
  to the top of the target pane — which puts the tab bar just above the fold.
  So the bar was out of sight and the rail, having done its job, hid itself:
  both ways back were gone at once and the reader had no idea where they were.
  The click now scrolls to the *tab bar* instead, parking it against the bottom
  edge of the sticky hub bar. The tab bar is visible, the rail steps aside by
  its own rule, and the pane starts right below. A lazily loaded pane needs no
  second scroll after its content arrives, because everything injected sits
  below the tab bar and does not move it. The `IntersectionObserver` now states
  its threshold of `0` explicitly, so "the tab bar is showing even a sliver"
  counts as in-viewport, and the rail is no longer pulled out from under a
  keyboard user: while `:focus-visible` focus is inside it, it stays put.
  Rail items also pick up the hover treatment on keyboard focus.

## [0.15.0] - 2026-08-27

### Added
- **An overview landing pane** (`config.overviewTab`, opt-in). The first thing a
  board shows was the iteration task table — on a project a year in, that is a
  page of mostly-finished rows that changes once every few weeks. With this on,
  the first pane becomes a narrative strip read in the order the questions
  actually come up: which iteration is running, which PR is in acceptance and
  how far through its checklist, how many cards are ready to pick up, which
  cards have merged PRs but are not closed out, which have been asleep for over
  a month, what moved in the last seven days, and what is out in dev / test /
  prod. Every row is derived from data the board already keeps — no new
  manifest, no new field — and a row whose source is absent is not rendered at
  all, because an empty row is noisier than no row. The counts share their
  definitions with the places that already own them: the ready count is the WIP
  reminder's count with the WIP thresholds' colours and it recomputes with the
  lane filter, the settle list is `settleOf`'s (with `settleHold` cards counted
  separately, as everywhere else), the acceptance numerator is read through the
  same localStorage key as the acceptance tab. The pane keeps the id `progress`
  and the bare `#` hash, so old links still land on it, and the iteration table
  is folded whole into an iteration-history block at the bottom — nothing
  dropped, and a deep link into a card inside it opens the fold on the way
  instead of scrolling to an invisible element. Dates stay dates in the
  generated file: day counts, the seven-day window and checklist progress are
  computed in the browser. Left unset, output is byte-identical.
- **The decision path can move into the doc library** (`config.pathTab: "docs"`,
  opt-in). That tab is a read-it-once account of how the design got its current
  shape — valuable to whoever picks the project up, and dead weight in the top
  bar for everyone else. Set this and the tab and its pane stop rendering; the
  same `path-manifest.json` renders instead into `refs/design-path.html`, a
  document with the usual back bar, listed in the doc library under 交接与接手
  (`config.pathDocCategory` overrides the category). Not a byte of data is
  dropped and no link dies: the markup and the stylesheet are the same ones the
  pane used (pulled into shared constants rather than written twice), links
  inside it are rewritten a directory level out, and an old `#path` deep link
  now lands on the doc library entry and flashes it. Turning it back off removes
  the generated page again. Left unset, output is byte-identical.

### Changed
- **The acceptance and release panes join the lazy split** (`config.lazyTabs`).
  Since 0.11.0 the shell has been the first thing a reader waits for, and two
  tabs added since then had been going into it whole: a checklist pane with its
  items baked in, and a release table with a row per pull request plus the four
  lookup tables the table and the timeline share. On the board this was written
  for they were most of what was left — the shell had grown back to 653KB, and
  most of it was content behind a tab nobody had clicked yet. Both now travel
  as their own part files, `parts/acceptance.html` and `parts/release.html`,
  fetched on first visit like the other three. The same shell is now 306KB
  (133.7KB → 71.4KB gzipped), and the two panes are no longer paid for by
  readers who never open them.
- Their baked-in data moved with them. Each part carries a
  `<script type="application/json">` block that the runtime reads once on
  injection; the two former IIFEs became `initAcceptance(root)` /
  `initRelease(root)`, guarded so the tab click, the idle prefetch and a deep
  link cannot initialise the same pane twice. The timeline's geometry stays in
  the shell — it is code, not data, and the tests import the same source.
- Numbers that live in one pane and are computed from another's data still add
  up. A card's `验收中 · n/N` chip and the release table's acceptance column are
  both rendered from acceptance ticks, so injecting any pane that carries a
  `[data-acc]` element now fetches the acceptance part first and syncs after —
  otherwise the numerator would sit at its baked-in `0/N` until the reader
  happened to open the acceptance tab.
- Deep links keep working across the split: `#acc-<pr>`, `#acc-<checklist>` and
  `#pr-<number>` are registered in the card → pane map, so the runtime knows
  which part to fetch before it looks for the anchor. The Stop guard's
  missing-part self-heal knows about the two new files as well, gated the same
  way generation is — a tab that is off has no part to miss.
- Turning either tab off while `lazyTabs` stays on removes just that part file,
  the way the archive part already behaved. With `lazyTabs` unset, output is
  byte-identical to 0.14.1: both panes render into the single file exactly as
  before, data and all.

### Fixed
- `kanban-init` now denies reading `app/kanban/parts/**` alongside
  `index.html`, `shots.html` and `refs/**`. The lazy split has been writing
  generated part files since 0.11.0 and they were never covered: a part file of
  a mature board is a six-figure-character generated blob, and nothing stopped a
  session opening one. Existing boards pick the entry up by re-running
  `kanban-init apply` (the merge is deduped and touches no other key).

## [0.14.1] - 2026-08-27

### Added
- **A left tab rail** (`config.tabRail`, opt-in). Scroll past the tab bar on a
  long board and there is no way back to the other tabs without scrolling to
  the top first. With this on, a narrow vertical copy of the tab bar fades into
  the left margin once the bar leaves the top of the viewport: the same labels
  and count badges, the current tab highlighted, one click to switch. Clicking
  routes through the same `show()` the tab buttons use — deep links, lazily
  loaded panes and the hash all behave exactly as before — and then scrolls
  back to the top of the pane, because the content underneath has just been
  replaced. The rail is *derived* from the tab bar at generation time rather
  than written out a second time, so an added or removed tab (the optional
  acceptance, release and archive ones included) appears in both places at
  once, and the screenshot gallery's outbound link stays an outbound link. Its
  badges are copied from the tab buttons whenever a filter recomputes them, so
  the two can never disagree. It sits in the page margin, not the content
  column, and so does not compete with the acceptance pane's section index or
  the doc library's left navigation; below 1200px there is no margin to sit in
  and it never appears; without `IntersectionObserver` it stays silent. Left
  unset, output is byte-identical to a board without the feature.

## [0.14.0] - 2026-08-27

### Added
- **A write CLI**, `scripts/ddd.mjs`, so a session never hand-edits card JSON
  again. `card new backlog|decision` allocates the next id and *reserves* it —
  with one file per card it creates the file with `openSync(path, 'wx')`, so
  two sessions racing for the same number both succeed and the loser steps to
  the next one. Until now every session computed "highest + 1" for itself and
  nothing stopped two of them landing on the same number; the night that
  produced this change had two lines allocating cards minutes apart and missing
  a collision by luck. `card set` / `card status` / `card note` / `card link`
  change one thing at a time and check it: the status has to be one the board
  declares, a date has to look like `YYYY-MM-DD`, a `pr` has to be a number,
  `#12` or `owner/repo#12`, a lane has to be in `config.lanes.ids` and a session
  tag in `config.sessionTags`. An unrecognised field is only warned about — the
  board grows fields faster than this list does — but `id` and `order` cannot be
  touched at all: the first *is* the card's identity (and, with one file per
  card, its filename), the second *is* the display order. `card status` appends a dated
  timeline line by default (`--no-note` to skip), `card link` dedupes by href
  and writes a link to this repository's pull request into the `pr` field as
  well. `card show` / `card list` / `card history` read; `export` merges
  everything back into one object shaped like the manifests; `pr-sync` is the
  same script under this entry point. Every write goes through a temp file and
  a rename, keeps the existing key order and only slots *new* keys into place
  (id and title first, long prose in the middle, `links`/`shots`/`pr` last), and
  ends with two-space indentation and a trailing newline. Boards that were never
  split work too — the CLI rewrites the whole manifest there, which is the same
  race those boards always had, but at least the checks and the shape hold.
- **One file per card** (`config.cardsDir`, opt-in). Point it at a directory
  name — `"cards"` by convention — and backlog cards are read from
  `<cardsDir>/backlog/<id>.json` and decision cards from
  `<cardsDir>/decisions/<id>.json`, one file each, while the two manifests keep
  only their headers. The problem this solves is concurrent writes: several
  sessions editing one 400KB manifest rewrite the whole file and quietly take
  each other's in-flight cards with them, and git reports no conflict because
  nothing conflicted textually. One path per card either avoids that or turns
  it into a conflict git can stop. The filename must equal the `id` inside, an
  `items`/`entries` array left behind in a header file is a hard error (one
  source of truth), and so is the same id appearing twice. Card files are read
  in filename order, so the filesystem's own ordering never reaches the output.
  Not configured means nothing changes, byte for byte. `manifest.json`'s tasks,
  the acceptance manifest and the release manifest are not split.
- Each card carries an **`order`** field written by the migration: the array
  index it had before the split. Array order *was* display order in several
  places — the screenshot gallery groups by a decision's position, the deep-link
  pane map is a plain object whose key order is the array's, and the by-date
  sort is stable, so two cards sharing a date and a number kept their array
  order. `gen` sorts by `order` then by `id` and deletes the field afterwards,
  so a card object is identical to what it was inside the array.
- A **per-card update date** on the card header, a quiet `更新 MM-DD` next to
  the creation date, taken from one batched `git log` over the card directory
  (last commit date per file; falls back to the file's mtime, then to nothing —
  the same silent chain the document library already uses). The dormancy chip
  measures from this date instead of the card's creation date when cards are
  split, which is the honest number: a card written in January and touched
  yesterday is not dormant.
- **`scripts/cards-split.mjs`** and **`scripts/cards-join.mjs`** for the
  migration and the way back. Both write the files, re-run `gen`, and compare
  the output byte for byte against what was there before; on any difference
  they put the changed files back exactly as they were and exit non-zero. The
  split is pure movement, so different output means the movement has a bug, and
  a board that was moved wrong should not be left in someone's repository. The
  two comparisons ignore exactly what the split is allowed to change: the new
  per-card timestamps, the dormancy dates now measured from them, and the lazy
  panes' byte counts (whose panes are themselves compared byte for byte).
  `--dry-run` reports the file counts and any id that cannot be a filename.

### Changed
- The guard watches `<cardsDir>/**/*.json` for freshness, includes card files
  in the corpus that decides whether a demo is orphaned, and names card files
  whose filename disagrees with the id inside or that fail to parse. Those two
  are hard errors in `gen`, which can only report the first one, so the guard
  lists them all and hands them over with the failure.
- `pr-sync.mjs` reads cards from the card directory when one is configured, so
  the pull-request-to-card reverse lookup and `--settle` keep working after a
  split; `--settle --write` then writes the individual card file.
- Both skills now show card work as CLI commands rather than JSON to type by
  hand; editing the JSON is documented as the way out when the CLI cannot say
  what you mean. The `gh pr` reminder points at `ddd card link` instead of
  telling you to write a `pr` field.
- After `card new`, the CLI counts `ready` cards the way the guard does and
  prints the same warning when the pile is over `config.wip.hard` — better at
  the moment the card is created than at the end of the session.

### Fixed
- `gen` built the screenshot `git log` command by pasting a filename into a
  shell string. A file named `a";touch X;".png` in `shots/` therefore ran an
  arbitrary command as the user, silently — the surrounding `try/catch` ate the
  non-zero exit — and the Stop guard runs `gen` at the end of every session, so
  the file only had to arrive through a pull or a checkout. It is an argv call
  now, and `execSync` is gone from the file.
- Link hrefs are escaped but were never checked for a scheme, so a
  `javascript:` url in a card link or a hand-written pull request url rendered
  as a live link on the board's own origin, where the acceptance checklist keeps
  its stored state. Only `http`, `https`, `mailto` and relative paths reach an
  `href` now; anything else renders inert with a warning naming it. `ddd card
  link` refuses such a value outright.
- `cards-split` accepted `--cards-dir ../../X` and wrote the whole card store
  outside the kanban directory, reporting a clean migration — its byte-identity
  check passes, because `gen` follows the same escaped path — and persisted the
  escape into the config, so the next `git add app/kanban` committed a board
  whose cards were untracked. A card directory must now be a plain name, checked
  both at the flag and when reading the config.
- `cards-split` and `cards-join` recorded everything needed to undo a migration
  but only used it when the verification `gen` failed. An I/O error during the
  writes threw straight out, leaving the header files stripped, the cards half
  moved and `gen` dying on `b.items is not iterable`. The write phase now rolls
  back and says so.
- The Stop guard's "a lazy board with a missing part is stale" rule never
  learned about `parts/archive.html`, added in 0.13.0. With that one file gone
  the guard exited cleanly and never regenerated it, so every deep link to an
  archived card silently missed and the archive tab showed its fetch-failure
  panel.
- `ddd card set` accepted `id` and scalars for array fields, both of which make
  the next `gen` fail hard; the second one only after `TypeError: it.links.map
  is not a function`. Worse for `id`: the CLI refuses to run on a board with a
  card whose filename and id disagree, so the command that would undo it was
  locked out too. Both are refused now.
- `ddd card new` wrote `line: ""` when `--line` was omitted, and on a board with
  lanes such a card appears in no lane view at all. It now takes the configured
  default lane. The exclusive id reservation also wrote a 0-byte file before
  filling it, which `gen` reads as a broken card; the body is prepared first and
  a failed write takes the reservation back.
- `ddd card note` and `card status` wrote a timeline field onto decision cards,
  which `gen` has never rendered — the command reported the note as recorded and
  the board never showed it. The rule now lives in one place, shared with
  `pr-sync`, which already had it right.
- `pr-sync` replaced the whole `prs` array with whatever `gh` returned, so
  anything past the limit was deleted from `release-manifest.json` without a
  word. It merges by number now, keeps entries `gh` did not return, and warns
  when the answer came back full. The limit is `--limit` (default 1000) with
  `--release-limit` (default 200).
- The 400-character preview took the first paragraph whole, so a field whose
  first paragraph was longer produced a preview far past the limit — and,
  because baking a preview suppresses the height clamp, that field also lost its
  fallback and rendered in full while a same-length field with no blank line in
  it folded to three lines. An over-length first paragraph now leaves the height
  clamp to do the job, as a single-paragraph text already did.
- The backlog banner counted only the cards visible under the current lane and
  printed that one number, while the guard's notice used the whole-board count.
  It now names both whenever a filter hides something.
- With `lazyTabs` on, the lane filter segments ("all / A / B / C") in the
  backlog and decisions toolbars did nothing when clicked. Those toolbars ride
  along in `parts/*.html` and only enter the DOM when their fetch resolves, but
  the shell collected the lane buttons once during startup — a static NodeList
  from `document.querySelectorAll` — and attached a click listener to each
  element that existed at that moment. Segments injected later were bound to
  nothing. The same stale snapshot also drove the `.on` highlight, and the
  injected markup ships with "all" pre-lit: on a board whose lanes default to
  C, the toolbar showed "all" as the active filter while the cards on screen
  were filtered to C. A control that misreports the state of the page is worse
  than one that is merely inert. Lane clicks now go through a single delegated
  listener on `document`, the highlight is recomputed by querying the DOM
  fresh inside `setLine` (a few dozen nodes, no measurable cost), and
  `onPaneInjected` syncs it the moment a pane lands, alongside the
  toolbar/search/time-filter catch-up it already ran. The document-library
  chips live in the shell and were never affected; the archive pane has no
  toolbar. Behaviour with `lazyTabs` off is unchanged, though the rendered
  script changes on every board.

### Performance
- `gen` forked `git` once per document and once per screenshot to date them. On
  a repository with a thousand commits, 55 documents and 43 screenshots that was
  98% of its running time — around 3.9s of a 3.9s run, paid at every session end
  and twice by `cards-split`. Both are one batched `git log` now, the same shape
  0.14.0 already used for per-card dates: the same run takes about 0.23s, and the
  output is byte-identical.

## [0.13.1] - 2026-08-27

### Added
- An optional `settleHold` card field (all three card kinds) — a one-line reason
  for why a card is *not* being settled yet. "The pull request merged" is not
  "the card is done": a card routinely spans several rounds, and the round that
  just landed may have shipped only half of it. A card carrying the field drops
  out of the settle list, loses its "merged · unsettled" / "settled but the pull
  request is open" chip, stops being named by the Stop guard, and shows one
  quiet grey chip instead, with the reason in its tooltip. Delete the field when
  the card really is ready to settle; it never expires on its own. Cards without
  the field render byte-identically.
- `pr-sync.mjs --settle --write --only <id>[,<id>…]` — settle the named cards
  only. The full list is still printed, so what was skipped stays visible. An id
  that is not on that list (a typo, or a card already on hold) is refused
  outright and nothing is written at all — a partial write that half-succeeded
  is worse to unpick than an error. The dry run now points at the flag, and
  cards on hold are summarised as one "on hold (N)" line rather than dropped
  silently.

### Changed
- The **timeline view of the release progress tab was rebuilt** around version
  bands and lane packing. The 0.12.0 timeline gave every pull request its own
  row, which on a board with 240 of them was a 2400px column — and it spent
  that height on a dimension that carries almost no information: 87% of those
  pull requests were opened and merged on the same day, so their bars were all
  the same minimum-width dot. What the height did not show was the one thing
  the axis could: when the work actually happened. So the view now folds into
  one band per version plus dev, test and the off-stage leftovers — six rows,
  around 200px folded, instead of one row per pull request. Click a band and it
  expands in place: pull requests that span days are greedily packed into
  shared lanes, same-day ones are laid out by number across that day's cell,
  and both are capped at six lanes, so an expanded band has a height ceiling
  regardless of how many pull requests are in it. Bars link to GitHub and carry
  number, title and cards as their hover title.
- The axis is now **non-linear**: a quiet day gets 5px, a day with pull
  requests at least 14px, and a busy day widens by `ceil(count / 6)` slots —
  the day with 41 merges gets seven times the width of a quiet one instead of
  stacking 41 dots on one pixel column. Widths come from the whole board's day
  counts, so expanding, folding or filtering never makes the axis jump.
- Date labels on that axis are placed rather than sampled. Candidates are each
  Monday, each release day and each month start; they are laid out left to
  right and a label is dropped to a bare tick when it would land within 48px of
  the previous one. Release days and month starts may evict an ordinary label,
  but never break the 48px rule — which is exactly how the old evenly-spaced
  ticks ended up printing `06-2907-0207-05` on top of each other.
- The band gutter is a fixed 200px and now sets the name on its own line above
  `N PR · first→last`, so a band no longer reads `155 PR · 05-10→…`. When the
  window hides part of a band, the second line says how many fall inside it.
- New `scripts/relgeom.mjs`: the axis, the tick placement, the bar geometry,
  the lane packing and the band height as pure functions with no DOM and no
  clock. The generator inlines that file into the page verbatim, so the packing
  and the drawing cannot drift apart (they did in the prototype), and the tests
  exercise the same source the browser runs.

### Fixed
- Tab labels wrapped onto two lines at medium viewport widths, doubling the
  height of the tab bar. `.tabbar` is a flex row and `.tab` had no
  `white-space` declaration, so CJK text breaks between any two characters and
  a label like "决策·Demo · 112" could fold at the character before or after
  "·". `.tab` (and the linked "截图" tab, which shares the class) is now
  `white-space: nowrap` and `flex: none`; `.tabbar` scrolls horizontally
  instead of wrapping when its tabs no longer fit. This changes rendered
  output on every board, not only affected ones.

## [0.13.0] - 2026-08-27

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
- An optional **archive tab** for finished cards (`"backlogArchive": true` in
  `kanban.config.json`). On a board that has been running a while, `done` cards
  outnumber the live ones several to one and the backlog tab becomes a place
  you scroll past rather than work from. With the switch on, the backlog lists
  only cards that are not `done` — `deferred` stays, being parked rather than
  finished — and the finished ones move to their own tab at the end of the tab
  bar, rendered by the same card renderer in the same order. The badge counts
  follow, and the `done` filter chip drops out of the backlog toolbar. Global
  search, the lane and time filters, and deep links (`#CARD-ID`) all reach the
  archive exactly as they reached the backlog. With `lazyTabs` on, the archive
  is a third part file (`parts/archive.html`) with its own entry in the card →
  pane map, so a deep link to an archived card still fetches the right part.
  Not configured, output is byte-identical.
- Optional **WIP limits** (`"wip": { "soft": 10, "hard": 20 }` — an object is
  the switch; the thresholds default to 10 and 20). The count is the `ready`
  cards only: `blocked` is waiting on somebody else and `deferred` is parked,
  and neither takes up room in what can be started today. Over `soft`, the
  backlog tab gets an amber dot and the pane a quiet grey line; over `hard`,
  the dot turns red and the line becomes a standing banner suggesting the pile
  be cleared before new cards are added. With lanes configured the numbers
  follow the selected lane, recomputed with the same visibility rule that
  drives the tab badges. A non-blocking guard notice fires at stop time when
  the total (across lanes) is over `hard`.

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
