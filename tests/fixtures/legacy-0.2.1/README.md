# legacy-0.2.1 fixture

Near-verbatim copies of four scripts from the 0.2.1 release, frozen here so the
time-machine tests stay reproducible on any machine. (0.2.1 predates this public
repository, so its tag is not in this repo; these are the archived sources.) The
only edit from the original is a redacted default host address, which the tests
never render.

0.2.1 is the "arsonist" release: its back-navigation strip regex only recognizes
the old `lamos-b-backnav` marker, so when its Stop hook regenerates a board it
stacks a stale bar on top of the current one and wipes the version stamp.
`tests/run.mjs` uses these scripts to recreate that incident for real, then
asserts that the current guard heals it.

Do not otherwise edit these files. If a test needs different legacy behavior,
archive another release's sources into a sibling fixture directory instead.
