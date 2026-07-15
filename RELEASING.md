# Releasing

How a new version is cut. Everything here runs from a clean checkout of `main`.

## Steps

1. Bump `version` in `.claude-plugin/plugin.json`. Only ever move it up (see
   [Monotonic versions](#monotonic-versions)).
2. In `CHANGELOG.md`, move the items under `## [Unreleased]` into a new
   `## [X.Y.Z] - <date>` section.
3. Run `npm test`. CI runs it on every push and PR; it must be green.
4. Commit `plugin.json` and `CHANGELOG.md` together, then push the branch:

   ```
   git push origin main
   ```

5. Tag and push with the plugin CLI, which validates that `plugin.json` and the
   marketplace entry agree before it tags:

   ```
   claude plugin tag --dry-run    # preview
   claude plugin tag --push       # create the tag and push it
   ```

   This creates the annotated tag `demo-driven-development--vX.Y.Z` at `HEAD`
   (with the message `demo-driven-development X.Y.Z`) and pushes it to `origin`.
   The `demo-driven-development--v` prefix is the plugin CLI's convention and is
   the only tag form this repo uses, so the same command works every release.
6. Optional: draft a GitHub release from the new tag and paste in that version's
   CHANGELOG section.

## Monotonic versions

`gen` stamps its output with the plugin version, and the guard refuses to
overwrite newer output with an older generator. A version regression freezes
every already-stamped board with a permanent "the product is newer than me" veto
until the version climbs back above the stamp. So a downgrade is destructive:
never tag or merge a version lower than what `main` already carries.

## After publishing

Downstream projects pick up the release with:

```
claude plugin update --scope project demo-driven-development@demo-driven-development
```

and a session restart. On a machine that still has long-lived sessions pinned to
a superseded cache, run the retire script so those sessions get a restart notice
instead of overwriting the board with stale output. `<plugin>` below is the
installed plugin directory (under `~/.claude/plugins/`):

```
node <plugin>/scripts/retire-stale-caches.mjs        # dry-run
node <plugin>/scripts/retire-stale-caches.mjs --yes  # apply
```

It automatically skips any cache version still registered as some project's
current install.
