# RuneProof Wiki-style guide verification

Implemented and verified locally on 2026-09-23. Preview: http://127.0.0.1:51945/

## Delivered

- All five reviewed public guides use Details, separate Fate restrictions, a full ordered Walkthrough and Rewards, with contents navigation and quick/detailed reading.
- Article metadata covers all 32 public actions and is bound to each reviewed guide revision. Private preview routes cannot inherit public location labels. Promoted item alternatives retain their actual destinations and omit the original method's explanatory metadata.
- Each step shows destination chunks and explicit unlocked, locked or unknown access. Preparation deduplicates destinations while retaining links to each affected step. Interior context stays with its step. Travel between destinations remains explicitly unreviewed.
- Future known blockers are shown before the player reaches them. Obtaining the ghostspeak amulet and wearing it remain separate actions; the wear step requires Neck T1.
- One searchable catalogue is hidden while reading. Selected quest and guide checks persist per run. Undo restores the last explicit confirmation in the current guide session, without changing Journal progress or rewards.
- Map return preserves scroll and focus. Confirmation and Undo focus the affected step and bring it into view, including after analysis remounts. Focus requests are consumed once and isolated by run/quest.

## Automated verification

```text
npx vitest run
Test Files  283 passed (283)
Tests       3729 passed (3729)

npx tsc --noEmit
Exit code 0; no diagnostics.

npx vite build
Exit code 0; built in 9.34s.

npm run content:verify
Exit code 0.
Quest Helper source verified offline: 369 files at a52646118f0e5ea63a6b3331cefa98087a7b4d6c.
Quest evidence verified: 2218 Chunk Picker tasks; 9647 Quest Helper step definitions; 0 automatically approved guides.
```

Focused integration: 67 tests passed. Final guide/equipment UI checks: 20 tests passed after the restriction-label refinement. The final browser pass additionally covered the small focus-scroll refinement. Diff whitespace checks passed. Candidate-harvest markers remain absent from the production bundle.

The build retains the existing large-chunk warning (`Some chunks are larger than 500 kB after minification.`); the eager index is 242.31 kB gzip. Existing Vite esbuild/oxc deprecations and test-environment storage warnings remain. No new dependency was added.

## Browser verification

The production build was served on a separate local test origin. Reviewed desktop 1440×900, phone 390×844 and narrow 320×844 layouts. The guide, article and details table had matching client/scroll widths with no horizontal overflow. The final mobile Close control is 44×44px and the catalogue toggle is 44px high. Temporary viewport overrides were reset afterward.

- All five guides rendered their article details, action lists and rewards: Cook 9 steps, Sheep 5, Restless 7, Rune Mysteries 5, Imp Catcher 6.
- Restless Ghost at Neck T0 showed the distinct Fate requirement, allowed its initial church action, and exposed the later wear and locked-chunk blockers. Its four destination chunks and Tower basement context were visible. The T0/T1 transition and allowed amulet acquisition were checked against real analysis in automated tests.
- Explicit confirmation changed the checklist from 0 to 1; Undo restored 0. Reloading afterward retained the selected Restless Ghost guide and the newly checked first step.
- Cook's Assistant action confirmation focused the completed step. Ingredient confirmation and Undo restored the pot step; the final focused section was within the viewport (top 561.78px, bottom 872.44px, viewport 900px).
- Opening the pot map showed chunk 50,50 and the kitchen location. Closing restored the same map button and retained guide progress.
- Final browser error/warning log was empty. Restless Ghost was left open as the preview deliverable.

## Failures found and fixed during implementation

- Sandboxed test runs reported `Error: spawn EPERM`; the approved subprocess-enabled runs succeeded.
- Concurrent implementation briefly caused `TS2307: Cannot find module './questStrategies/RuneProofCoach'` while the component was being replaced. The final file resolves and typechecks.
- The new test fixture initially reported `TS2322: Type 'string[]' is not assignable to type 'readonly \`${number},${number}\`[]'`. It now uses the canonical `ChunkKey` type.
- A repeated metadata patch caused `TS2300: Duplicate identifier 'guideRevision'` and `TS1117: An object literal cannot have multiple properties with the same name.` Duplicate insertions were removed; final typecheck passed.
- Old UI assertions expected a duplicate current-action card, one map button and `All reviewed actions are complete.` They failed with `expected +0 to be 4`, `expected ... to have a length of 1 but got 3`, and missing-text errors. Tests now assert the intended single full walkthrough, maps on each valid step, and guide-check completion language. Exact-text queries and a fixture that changed only `nextAction` were corrected to inspect the actual rendered row.
- Integration tests initially retained stale current-step elements and old header wording; they now resolve the current row after each interaction. An accidental catalogue ID change in legacy OFF mode was removed, preserving its unchanged-markup contract. Test storage uses the existing in-memory mock convention.
- Review found public metadata could override private preview locations, hidden alternative-source restrictions, and lost/off-screen focus after confirmation or Undo. Revision binding, visible restrictions and scoped focus restoration resolved these findings.

## Boundaries

The later [walking route verification](2026-09-23-runeproof-walking-verification.md)
supersedes the initial travel limitation below. A compact directed walking graph
now connects reviewed guide steps against the current account's chunk permissions.

No new quests were approved, published or deployed. The large Quest Helper/Chunk Picker harvest remains offline review material. Destination checks do not certify travel paths, and guide checks do not grant rewards, unlocks, Keys, Fate or Journal completion. Broad catalogue expansion remains separate work.
