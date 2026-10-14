# Host integration

The plugin shares skills, scripts, and project data across supported hosts. Host adapters provide lifecycle hooks and project instructions. Resolve `<plugin>` from the installed plugin root; when working from a skill, its file is at `<plugin>/skills/<skill-name>/SKILL.md`. Do not make shared skill commands depend on a host-specific plugin-root environment variable.

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
codex plugin marketplace add https://github.com/rrrrrrrrrricoxi/demo-driven-development.git
codex plugin add demo-driven-development@demo-driven-development
```

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

## Shared workflow rules

The SEE-IT versus KNOW-IT distinction, source-only token discipline, orphan-demo guard, mainline-only board changes, and human review remain shared workflow rules. Apply each project's explicit runtime, data, service, and browser ownership rules. A precheck can report observations; it cannot make a human acceptance decision.

The card and generation CLIs locate the board from the project root, a subdirectory, or the board directory. Set `DDD_PROJECT_DIR` to choose a project root, or pass `--dir` to choose a kanban directory explicitly.
