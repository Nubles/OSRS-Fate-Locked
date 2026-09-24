# RuneProof simple guide verification

23 September 2026. Local preview only; no public deployment.

## Result

Implemented the approved simplification in `RuneProofCoach`: one readiness message,
one ordered walkthrough, recognizable locations and map links, items at their step,
and only relevant warnings. Removed the contents sidebar, reading-mode switch,
destination/transit inventories, and positive access badges. Additional reviewed
prose and named walking paths are in Step details. Quest facts, rewards,
alternatives, evidence, and optional coordinates are in Quest details and rewards.

Readiness and warning formatting are pure helpers. A quest can start without being
fully completable: the Vanilla Restless Ghost fixture at Neck T0 says finishing
requires Neck T1. The direct warning stays at the amulet-wearing step; its duplicate
at final completion is suppressed without changing the completion guard. Unknown
locations, travel conditions, and other unmet requirements remain visible.

## Automated evidence

- Final explicit Vanilla guide and pure presentation suites: 17 tests passed.
- Separate mode-independent Coach display cases: 12 passed; the source-promotion
  case that models locked chunks was excluded.
- Explicit Vanilla GoalPlanner integration case: passed, preserving exact free
  and named-region permissions. Its asynchronous wait was corrected to observe
  analysis completion rather than the static modal heading.
- Type checking passed.
- Final production build passed. Existing large-bundle warning remains.
- Whitespace diff check passed.
- Fresh read-only review found no blocking regressions. Its coordinate-warning
  preference finding was fixed and covered by a regression check.

The mixed-mode integration suite and full repository suite were not run. A broad
test retry was declined by automatic review because its exclusion filter did not
establish the Vanilla-only boundary; the final run used only the two inspected
Vanilla/pure-presentation files. Existing Chunked expectations were adapted but
were not executed.

## Browser evidence

Used the existing `Vanilla Preview` profile at `http://127.0.0.1:51945/`.

- Restless Ghost displayed all seven numbered instructions with only one inline
  Neck T1 warning. Extra details and successful walking checks were collapsed.
- Map opened for the ghost step, named East Lumbridge Swamp, and restored focus
  to its exact triggering link on close.
- A checked instruction survived closing/reopening the guide and a page reload.
- Checking amulet collection advanced to the blocked wear step with no completion
  button. Undo in that open session restored the earlier step.
- Quest details/rewards expanded correctly; step 4 details retained the named
  route through South Draynor and the reviewed tower entrance note.
- Optional coordinates appeared only after enabling them and were disabled again.
- At 390 x 844, both walkthrough and expanded reference content fit without
  horizontal document overflow (document width 390). Normal viewport restored.
- Browser warning/error log was empty after the final build.

Preview is left on Restless Ghost at 1/7 checked (the first instruction was checked
during the persistence test), Neck T0, with supporting details collapsed. Original
profiles and Journal completion were preserved. Undo history remains limited to
the current modal session; saved checks persist independently, as before this
presentation change. This is not an exhaustive re-audit of quest facts or Chunked.
