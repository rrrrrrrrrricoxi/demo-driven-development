# Contributing

## House rules

- One feature per branch, one branch per PR.
- The version stamp makes downgrades destructive, so `plugin.json` on `main` only moves up. Bump the version in your PR whenever runtime behavior changes, and never merge a lower one.
- `npm test` must pass; CI runs it on every PR. If you touch the guard, the generator's backnav logic, or the version-stamp code, add assertions to `tests/run.mjs`.
- Byte freeze applies to optional features: with the feature unconfigured, generated output must be byte-identical to the previous release. Normalize the stamp line first (`sed '/<!-- ddd-gen v/d'`), then compare.
- Cutting a release (version bump, [CHANGELOG.md](CHANGELOG.md), tag) follows [RELEASING.md](RELEASING.md).

## Language policy

- Code comments and design docs are Chinese first. They carry the design reasoning, and the maintainers think in Chinese; translation tends to lose exactly the nuance the comments exist for.
- Anything a user can see at runtime (guard messages, gen's hard-failure errors) must go through the tables in `scripts/strings.mjs` and exist in both `zh` and `en`. The board's `config.lang` picks the table. The few gen failures that happen before the config is readable carry both languages in one string.
- Repo-facing documents (README, CONTRIBUTING, LICENSE) are English.

Claude reads both languages equally well; the split above is for the humans who audit and maintain this.
