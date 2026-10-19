# Screenshot retention

DDD manages temporary screenshots that you explicitly register. The same CLI
works in Claude Code, Codex, Pi, or a shell. Terminal image rendering is a host
feature and is separate from this lifecycle.

## Default behavior

| Screenshot | Card open | Card closed |
| --- | --- | --- |
| Registered, unlinked; retention off (default) | Keep | Delete at the next cleanup |
| Registered, unlinked; retention on | Keep | Keep for the configured grace period, then delete |
| Linked in board source data or promoted | Keep | Keep |
| Unregistered file | Untouched | Untouched |

Retention defaults to **off**. Turning it on gives closed cards a **14-day**
grace period unless you set another value. Expiry permanently deletes eligible
managed copies. There is no second archive or trash period.

Reports, session transcripts, logs, fixtures, and build caches are outside this
feature. Existing screenshots and the separate human-feedback pruning command
keep their existing behavior.

## Register and review

Use the plugin checkout that contains this feature. Replace the placeholders:

```sh
node <plugin>/scripts/ddd.mjs evidence add BL-1 /absolute/path/capture.png --dir <board>
node <plugin>/scripts/ddd.mjs evidence list --dir <board>
```

`add` copies the image into `<board>/.ddd-evidence/tmp/` and returns an evidence
ID and path. It leaves the source untouched. PNG, JPEG, WebP, and GIF filenames
are supported. Use the returned managed path for temporary inspection. The
source remains the caller's responsibility; registration does not reclaim disk
space occupied by existing captures. If the owning card is already closed and
the copy is immediately eligible, the same command can delete it; the result
reports its final state. Reopen the card or configure retention before adding
new temporary evidence that you still need to review.

Before closing the card, preserve screenshots that should appear on the board:

```sh
node <plugin>/scripts/ddd.mjs evidence promote <evidence-id> --dir <board>
```

Promotion copies the image into `shots/<card>-evidence-<id>.<ext>` and appends
that path to the owning card's `shots`. It preserves existing references and is
safe to repeat. Commit the durable image and card change under the project's
normal board workflow. Promotion does not generate the board or record human
acceptance. Run the project's permitted generation step to update the page.

An acceptance item can also reference the durable image through the existing
`acc precheck --shot` command. Card references, acceptance history, walkthroughs,
and other board source references protect registered images from cleanup.
Directly linking a temporary copy protects it locally, but does not make that
ignored file available to another machine. Use promotion for shared evidence.
The original managed copy is also kept after promotion so old local references
continue to work.

## Configure retention

Set the project default:

```sh
node <plugin>/scripts/ddd.mjs evidence config --enabled true --grace-days 14 --dir <board>
```

Set an override for one card, or return it to the project default:

```sh
node <plugin>/scripts/ddd.mjs evidence config --card BL-1 --grace-days 30 --dir <board>
node <plugin>/scripts/ddd.mjs evidence config --card BL-1 --inherit --dir <board>
```

Omitted fields inherit. A card that sets only `graceDays` still inherits the
project's `enabled` value. Use `--enabled false` for deletion without a grace
period. Grace days must be a whole number from 0 through 36500. Zero makes a
closed card immediately eligible. Configuration queries without update flags
are read-only:

```sh
node <plugin>/scripts/ddd.mjs evidence config --card BL-1 --dir <board>
```

The persisted field is `screenshotRetention` in `kanban.config.json` and,
optionally, on the card:

```json
{ "screenshotRetention": { "enabled": true, "graceDays": 14 } }
```

Use the CLI for changes. Follow the project's branch and board ownership rules.
Changing policy can make existing registered copies eligible at the next
cleanup; it does not grant a fresh grace period.

## Closure, reopening, and cleanup

DDD uses its existing terminal statuses: `done`, `live`, and `closed`. The grace
period starts when maintenance first observes a terminal card. It does not
invent a closure date for older cards. Reopening through the DDD CLI cancels the
countdown. Closing again starts a new countdown. Deleted images cannot be
restored by reopening.

Successful card writes, acceptance writes, and applied PR settlement run
maintenance. It rereads board sources before deleting. No daemon runs, so an
expired image can remain until the next eligible command. Read-only commands,
including `list`, `audit`, precheck listing, and Pi's settlement hook, do not
clean up. Changes made outside the CLI are observed on the next maintenance
run; an external reopen-and-close sequence between runs cannot be detected.

Preview cleanup, then apply it if the preview matches your intent:

```sh
node <plugin>/scripts/ddd.mjs evidence prune --dir <board>
node <plugin>/scripts/ddd.mjs evidence prune --apply --dir <board>
```

The preview does not persist timestamps, create a registry, or delete images.
`--json` provides machine-readable output for evidence commands.

## Storage and safeguards

The board-local `.ddd-evidence/` directory holds registered copies, a registry,
and a temporary lock. Its contents are ignored by Git except for its own
`.gitignore`. The registry keeps small deletion records with IDs, hashes,
timestamps, and reasons. Reports remain available after image deletion.
This is local state: it is not a cross-machine retention service or a backup.

Cleanup only unlinks individual registered temporary files whose content still
matches their recorded hash. It preserves changed files, unknown owners or
statuses, and unsafe paths. It rejects symlink or hardlink targets. Malformed
registry, configuration, or required board sources stop cleanup. A lock prevents
overlapping evidence operations. A maintenance warning after a card write means
the card write succeeded but cleanup did not complete; repair the reported
condition and preview again.

No registry means no cleanup and no new local state. There is no recursive
folder purge and no automatic adoption of legacy screenshots. Keep independent
backups for evidence that must survive disk loss.
