# Quest source harvest verification

Verified locally on 2026-09-23. This covers the offline importer and the reviewed Restless Ghost facts, not approval of the whole imported catalogue.

## Final checks

```text
npx vitest run
Test Files  280 passed (280)
Tests       3707 passed (3707)

npx tsc --noEmit
Exit code 0; no diagnostics.

npx vite build
Exit code 0; built in 8.22s.

npm run content:verify
Exit code 0.
Quest Helper source verified offline: 369 files at a52646118f0e5ea63a6b3331cefa98087a7b4d6c.
Quest evidence verified: 2218 Chunk Picker tasks; 9647 Quest Helper step definitions; 0 automatically approved guides.
```

Focused source, parser, chunk, pilot and equipment checks passed: 5 files / 32 tests. The independent final review found no remaining actionable issues within its bounded importer review. A search of the production output confirmed that the candidate evidence marker, snapshot marker and source snapshot hash are absent.

The production build reports its large-chunk warning: `Some chunks are larger than 500 kB after minification.` Its index chunk is 242.33 kB gzip. Vite also reports its existing esbuild/oxc option deprecations. This source-import work does not change application imports or address bundle sizing.

## Failures encountered and resolved

- The sandboxed test runner initially failed with `spawn EPERM`; running the same tests with approved subprocess access succeeded.
- `scripts/quest-step-evidence.test.ts > combined quest evidence and reviewed Restless Ghost pilot > reproduces all generated evidence offline with the recorded source hashes` reported `Candidate catalogue differs from offline extraction; regenerate and review changes` while the parser was still changing. Regeneration after the parser fixes made the deterministic check pass.
- The first full run had 3,706 passing tests and one failure: `scripts/player-facing-changelog.test.ts > quest and chunk audit release contracts > runs quest verification once in the offline aggregate release order`. It reported `AssertionError: expected 'npm run diary:verify && npm run chunk…' to be 'npm run diary:verify && npm run chunk…' // Object.is equality`. The expected command omitted the newly added `npm run quest-evidence:verify`. Updating that integration expectation was followed by the fully passing 3,707-test run above.

## Remaining review work

- The catalogue contains 9,647 source step definitions, not 9,647 reviewed player actions. It retains 6,727 parser review flags, including unresolved expressions and dynamic behavior.
- Of 2,218 Chunk Picker tasks, 2,104 have location candidates, 54 have unresolved locations, and 60 have no source location. A portable action may legitimately have no location.
- Name matching finds candidates for 188 of 211 Chunk Picker groups; the remaining identities are listed in the [coverage report](2026-09-23-quest-source-harvest.md).
- Coordinates and entrance candidates do not prove legal travel through intervening chunks. Alternative locations are not interpreted as requiring every candidate chunk.
- Restless Ghost's reviewed destination and equipment facts are pinned against both source datasets and the existing public guide. Broader quest semantics and publication require separate review.

No new player guides, deployment, save migration or public release were performed.
