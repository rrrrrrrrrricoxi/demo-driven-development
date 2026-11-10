# Host integration

The plugin shares skills, scripts, and project data across supported hosts. Host adapters provide lifecycle hooks and project instructions. Resolve `<plugin>` from the installed plugin root; when working from a skill, its file is at `<plugin>/skills/<skill-name>/SKILL.md`. Do not make shared skill commands depend on a host-specific plugin-root environment variable.

The [shared hook API](hook-core.md) defines the boundary between rule evaluation and host integration. The opt-in [Pi adapter](pi.md) also calls it directly, without Claude cache forwarding or automatic generation. The init runtimes are `claude`, `codex`, `both`, and `portable`. The portable mode initializes shared board data without installing a host adapter.

## Claude Code

Install the marketplace and plugin from a Claude Code session:

```text
/plugin marketplace add rrrrrrrrrricoxi/demo-driven-development --scope project
/plugin install demo-driven-development@demo-driven-development --scope project
```

The Claude adapter uses the Claude plugin manifest and hook configuration. Claude-specific settings, deny rules, and `CLAUDE.md` instructions belong to that adapter. Keep them conditional when describing behavior shared with other hosts.

## Codex

Install from the Git marketplace with the Codex CLI:

```sh
codex plugin marketplace add https://github.com/rrrrrrrrrricoxi/demo-driven-development.git --ref codex-native
codex plugin add demo-driven-development@demo-driven-development
```

`codex-native` is a generated Git distribution branch in the same repository.
The publication workflow tests a `main` commit, exports it with
`scripts/package-codex.mjs`, verifies the package, and updates the branch.
The package records its source commit in `codex-package-provenance.json`.
Keep shared changes on `main`; do not edit the distribution branch.

Codex 0.167.0 discovers the root Agent Plugin manifest on `main` but omits
its hook extension. The native distribution omits that manifest so Codex
loads `.codex-plugin/plugin.json`. Hooks, scripts, and skills retain their
source bytes. Claude, Pi, and portable users continue to use the canonical
source package on `main`.

For an existing installation pinned to a different ref, first preserve active
caches as described in [release guidance](../RELEASING.md#after-publishing).
Codex 0.167.0 rejects adding the same marketplace name with a different source.
Remove its old registration, then add the Git distribution branch:

```sh
codex plugin marketplace remove demo-driven-development
codex plugin marketplace add https://github.com/rrrrrrrrrricoxi/demo-driven-development.git --ref codex-native
codex plugin add demo-driven-development@demo-driven-development
```

Check project and user configuration: an old project-level marketplace ref can
override the user-level registration. Update or remove that old entry as part
of the switch. Disable the old local plugin in every configuration layer that
enabled it. Keep one active DDD source and review the Git-installed hooks
through `/hooks`.

For an explicit commit or offline package check, the exporter remains available:

```sh
node scripts/package-codex.mjs --out <new-external-directory> --ref <commit>
node scripts/package-codex.mjs --check <new-external-directory> --expect-commit <commit>
```

The exporter does not install plugins or grant hook trust. Its provenance
records the source and adaptations; it does not by itself prove publication.
See [release packaging](../RELEASING.md#runtime-package-provenance).

The Codex plugin bundles hooks in the plugin root. Codex expands `${PLUGIN_ROOT}` in plugin hook commands; `${CLAUDE_PLUGIN_ROOT}` is a compatibility variable. Project hook mode instead records absolute paths to the selected plugin checkout in `.codex/hooks.json`. Rerun init after moving that checkout or cloning the project onto another host.

The adapter runs `node ${PLUGIN_ROOT}/scripts/codex-hook.mjs` for Stop, PreToolUse, and PostToolUse. Codex shell calls, including unified exec and calls nested in code mode, match `Bash`; the adapter also accepts raw `exec_command` inputs. Keep scripts and their referenced resources inside the plugin bundle so hooks resolve after installation. This Git marketplace distribution does not claim submission to Codex's public plugin directory.

Codex requires a user to review and trust non-managed hook definitions. Installing the plugin does not trust its hooks. Use `/hooks` to inspect and trust the current definitions. If the user disabled hooks with `features.hooks = false`, preserve that setting and report that the adapter cannot run. Do not enable hooks or trust them on the user's behalf.

Use the init runtime that matches the project:

```sh
# Portable project hooks for a cloned project; this is the Codex init default.
node <plugin>/scripts/init.mjs plan --dir <projectRoot> --brand <name> --runtime codex
node <plugin>/scripts/init.mjs apply --dir <projectRoot> --brand <name> --runtime codex --yes --no-commit

# Native plugin hooks; use this when the plugin is installed in Codex.
node <plugin>/scripts/init.mjs plan --dir <projectRoot> --brand <name> --runtime codex --codex-hooks plugin
node <plugin>/scripts/init.mjs apply --dir <projectRoot> --brand <name> --runtime codex --codex-hooks plugin --yes --no-commit
```

Project mode writes project-local hook entries with absolute plugin paths. These paths work across sessions started in subdirectories on the same machine while the plugin remains at that path; they do not travel with a clone to another machine. Rerun `init` with `--runtime codex --codex-hooks project` after cloning to another machine, switching hosts, or changing the plugin path, then review and apply the plan so DDD-owned entries use the current path.

Plugin mode uses the installed plugin's bundled hooks and removes canonical DDD-owned project entries to avoid duplicates. Project mode adds or updates those entries. Both modes preserve unrelated hooks and settings. Customized or mixed handler groups remain user-owned: review them through `/hooks` to avoid duplicate DDD guards. When switching from project to plugin mode, rerun `init` with `--codex-hooks plugin`; when switching back, rerun it with `--codex-hooks project` to write paths for the current installation. If project mode encounters existing inline hooks in `config.toml`, review the plan's refusal and resolve the configuration explicitly; plugin mode preserves inline hooks. Both Codex modes default to no commit. The `init` command defaults to `--runtime claude`; specify `--runtime codex` or `--runtime both` to select another adapter. `--no-commit` explicitly disables init's commit behavior.

To refresh the native Git marketplace, run `codex plugin marketplace upgrade demo-driven-development`. For plugin code updates, use the Codex plugin manager's supported update flow. If you use a repository clone, update that clone and rerun `init` with `--runtime codex` and the selected hook mode when its path changes. The Claude-only cache retirement script does not apply to Codex. Codex has no Claude cache-forwarding behavior; the generator's version stamp still prevents an older plugin from overwriting newer board output.

## Pi

Load `pi/index.ts` explicitly in a new Pi invocation; keep other guards enabled.
See [Pi integration](pi.md) for activation/rollback, exact event mapping,
read-only settlement, and optional child inheritance. No `--runtime pi` init
mode or automatic installed-configuration changes are provided.

## Other harnesses and standalone CLI use

Use a verified source checkout with Node.js and Git. Initialize the board without
host configuration, then call the shared CLIs from the project:

```sh
node <plugin>/scripts/init.mjs plan --dir <projectRoot> --brand <name> --runtime portable
node <plugin>/scripts/init.mjs apply --dir <projectRoot> --brand <name> --runtime portable --yes --no-commit
node <plugin>/scripts/ddd.mjs audit --dir <projectRoot>/app/kanban --json
```

Portable init preserves existing host files and runs generation plus the shared
audit. It does not parse host runtime settings; Markdown instructions may still
be scanned as ordinary documents when checking links to moved demos. It does not activate automatic lifecycle checks. A harness can call the
[shared hook API](hook-core.md) through an explicit adapter that maps its events,
tool requests, permissions, and continuation behavior. Verify those mappings in
that harness before claiming native support. The portable CLI and shared rules
do not imply that every host can enforce the same hook behavior.

## Shared workflow rules

The SEE-IT versus KNOW-IT distinction, source-only token discipline, orphan-demo guard, mainline-only board changes, and human review remain shared workflow rules. Apply each project's explicit runtime, data, service, and browser ownership rules. A precheck can report observations; it cannot make a human acceptance decision.

The card and generation CLIs locate the board from the project root, a subdirectory, or the board directory. Set `DDD_PROJECT_DIR` to choose a project root, or pass `--dir` to choose a kanban directory explicitly.
