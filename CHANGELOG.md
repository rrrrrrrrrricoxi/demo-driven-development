# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version on `main` only moves up: `gen` stamps its output with the plugin
version and the guard refuses to overwrite newer output with an older gen, so a
downgrade would freeze every already-stamped board. See
[RELEASING.md](RELEASING.md).

## [Unreleased]

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
