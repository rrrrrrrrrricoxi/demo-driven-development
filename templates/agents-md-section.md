<!-- ddd:agents-guidance -->
## Demo Driven Development board

Read board sources to understand work: `app/kanban/*-manifest.json`, card files, and the markdown documents named in `app/kanban/kanban.config.json`. Query individual fields with the DDD CLI. Run `audit` for board checks and `gen` to verify rendering.

Do not read generated `app/kanban/index.html`, `shots.html`, `refs/**`, or `parts/**` in full. Do not use `cat`, `head`, or `sed` to read them. Use `rg` for a targeted string check when needed. Deterministic scripts may read generated files.

Generate board output on the main board branch. Edit source files, then let the DDD Stop hook regenerate output. Do not hand-edit generated output or resolve its conflicts by reading the full files. Restore the generated paths from the board branch and regenerate there.

Project hooks require the project `.codex/` layer and the hook definitions to be trusted. Use Codex `/hooks` to review new or changed hooks. Keep one DDD hook source: project hooks for a portable clone, or native plugin hooks with init `--codex-hooks plugin`.
