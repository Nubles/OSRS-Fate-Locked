# Task 8 implementation report

## Status

DONE

## Summary

- Added exact, bounded current-run blocker analysis for failed requirement and
  acquisition-rule graphs.
- A failed leaf fact contributes a singleton. Failed nested ALL and ANY
  expressions and multiple acquisition rules for the same fact are combined by
  Cartesian union, with stable-ID normalization, deduplication, and strict
  superset removal after each merge.
- Added deterministic blocker ordering, exact unavoidable-factor intersection,
  and defensive deep immutability.
- Enforced maxBlockerSets = 128 and maxSetSize = 16; any intermediate or final
  cap breach returns incomplete UNKNOWN with no partial blocker or unavoidable
  claims.
- Unsupported dependency cycles, ambiguous repeatability, partial/unknown
  coverage, and incomplete route enumeration return incomplete UNKNOWN.
- Unreachable acquisition locations are treated only as eliminated current-run
  branches. They never appear as blockers or future-unlock advice.
- BLOCKED is restricted to an exact minimal blocker containing a level, quest,
  unlock, or capability fact reached through a rule at a currently reachable
  location. Missing items alone remain verified IMPOSSIBLE, not BLOCKED.
- Replaced evaluator's selected-path blocker heuristic with the exact Task 8
  result, including unavoidableBlockerFactIds.

## TDD evidence

### RED

- npm test -- --run utils/runeproof/blockers.test.ts
  - Exit 1; one failed suite and zero tests because ./blockers did not exist.
  - This was the intended feature-missing failure before production code.

### GREEN

- npm test -- --run utils/runeproof/blockers.test.ts
  - 1 file passed; 12 tests passed.
- npm test -- --run utils/runeproof/blockers.test.ts utils/runeproof/evaluator.test.ts
  - 2 files passed; 31 tests passed.
- npm run typecheck
  - Passed.
- npm test -- --run utils/runeproof
  - 10 files passed; 177 tests passed.
- npm test -- --run
  - 158 files passed; 1,697 tests passed.

Vitest prints pre-existing Vite React plugin deprecation and local-storage
warnings; there are no Task 8 test failures or type errors.

## Legacy assertion changes

- Partial/ambiguous repeatability remains UNKNOWN, but now explicitly has
  routesComplete false and no unavoidable claims because blocker enumeration
  is incomplete.
- Unsupported cycles changed from IMPOSSIBLE to incomplete UNKNOWN, with empty
  blocker/unavoidable output and a deterministic cycle diagnostic.
- Exact, verified one-time exhaustion remains IMPOSSIBLE because evaluator
  route enumeration has fully applied its known global capacity constraint.
- Previous tests that accepted one selected ANY or acquisition-rule blocker now
  assert the exact combined antichain and its true unavoidable intersection.
  Their missing facts are items, so the conservative status is IMPOSSIBLE, not
  BLOCKED.

## Review

Fresh read-only review checked the Task 8 diff against the brief's exact
semantics and the focused/full verification evidence. No Critical or Important
finding remained. Verdict: APPROVED; no fix round was required.

## Limitations

- The current model has no separate provenance field saying why an arbitrary
  rule fact is unmet. BLOCKED therefore uses only canonical gate fact kinds
  reached through an exact currently reachable acquisition chain; anything
  less explicit remains IMPOSSIBLE or UNKNOWN rather than being guessed.
- No cheapest-rule-change, future chunk, Key-table, or rules-change suggestion
  is produced.
