# Releasing

How a new version is cut. Everything here runs from a clean checkout of `main`.

## Steps

1. Bump the canonical `version` in root `plugin.json` and keep `package.json`,
   `.claude-plugin/plugin.json`, and `.codex-plugin/plugin.json` on that same
   version. Only ever move it up (see [Monotonic versions](#monotonic-versions)).
2. In `CHANGELOG.md`, move the items under `## [Unreleased]` into a new
   `## [X.Y.Z] - <date>` section.
3. Run `npm test`. CI runs it on every push and PR; it must be green.
4. Commit the implementation, manifests, and `CHANGELOG.md` together in a
   feature branch. Open a PR, wait for CI, and merge it. Update a clean `main`
   checkout to the merged commit before tagging. Do not publish an unmerged
   feature branch.

   ```
   node scripts/release.mjs --check
   ```

5. Use the runtime-independent release command. The check validates both
   marketplace entries, shared versions, skill metadata, and bundled hook
   resources. Release planning also requires a clean `main`, rejects downgrades,
   and refuses an existing version tag that points at a different commit:

   ```
   node scripts/release.mjs --dry-run  # preview; no writes
   node scripts/release.mjs --push     # create the annotated tag and push it
   ```

   This creates the annotated tag `demo-driven-development--vX.Y.Z` at `HEAD`
   (with the message `demo-driven-development X.Y.Z`) and pushes it to `origin`.
   The existing `demo-driven-development--v` prefix is preserved for Claude
   marketplace compatibility. `--tag` creates the local tag without pushing;
   `--check` validates the package on any branch. No Claude or Codex installation
   is required to publish. Git credentials remain the caller's responsibility.
6. Publish a GitHub release from the new tag and use that version's CHANGELOG
   section as the release notes. A source archive from the tag can be attached
   for portable installations; validate the extracted package before attaching it.

## Monotonic versions

`gen` stamps its output with the plugin version, and the guard refuses to
overwrite newer output with an older generator. A version regression freezes
every already-stamped board with a permanent "the product is newer than me" veto
until the version climbs back above the stamp. So a downgrade is destructive:
never tag or merge a version lower than what `main` already carries.

## After publishing

Claude Code projects pick up the release with:

```
claude plugin update --scope project demo-driven-development@demo-driven-development
```

Codex users refresh the Git marketplace and install the current package:

```
codex plugin marketplace upgrade demo-driven-development
codex plugin add demo-driven-development@demo-driven-development
```

Review changed hooks through Codex `/hooks`; a plugin update does not grant
hook trust. Start a fresh session to load the updated skills. Portable checkout
users update their checkout and rerun init with `--runtime codex`; project hook
mode refreshes its own absolute paths and preserves unrelated hooks. Codex
does not forward stale hooks through Claude's installation metadata. Version
stamps still prevent older generators from overwriting newer boards.

Since 0.16.2 that no longer has to be followed by a session restart for the
Stop hook's sake: a session still running the old hook sees that the board's
output is stamped newer than itself, finds the new install in
`installed_plugins.json`, and hands the whole hook over to it, saying so in one
line of its output. Restart anyway when you want the session's *skills* on the
new version — forwarding covers the guard, not the rest of the plugin.

For Claude Code only, on a machine that still has long-lived sessions pinned to
a superseded cache, run the retire script so those sessions get a restart notice
instead of overwriting the board with stale output. `<plugin>` below is the
installed plugin directory (under `~/.claude/plugins/`):

```
node <plugin>/scripts/retire-stale-caches.mjs        # dry-run
node <plugin>/scripts/retire-stale-caches.mjs --yes  # apply
```

It automatically skips any cache version still registered as some project's
current install.
