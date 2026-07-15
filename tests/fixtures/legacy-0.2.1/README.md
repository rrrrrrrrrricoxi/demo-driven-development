# legacy-0.2.1 fixture

Byte-exact copies of four scripts from this repo's `v0.2.1` tag (`git show v0.2.1:scripts/<f>`), frozen here so the time-machine tests stay reproducible on any machine.

v0.2.1 is the "arsonist" version from issue #7: its backnav strip regex only recognizes `lamos-b-backnav`, so when its Stop hook regenerates a board it stacks a stale v2 bar on top of the current one and wipes the version stamp. `tests/run.mjs` uses these scripts to recreate that incident for real, then asserts that the current guard heals it.

Do not edit these files. If a test needs different legacy behavior, extract another tagged version into a sibling fixture directory instead.
