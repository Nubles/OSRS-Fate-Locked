# Fate Guardian current-main rebuild baseline

- Tracker base: `44b978a66e3c8bdaba8515873146232ec8032f1b`
  captured immediately before this branch was created.
- Historical integration source:
  `origin/feature/strict-travel-known-mobility`
- Historical merge base:
  `d563f4e72a7900762c02ad6449e1ce7f81e5ab02`
- Standalone RuneLite source:
  `5cc1ffc4e4f684a99211f12342a69ceb6d16de30`

The historical tracker branch is a source of tested feature commits only. It
must not be merged or force-rebased. Current-main decimal-roll, save-integrity,
content, and release-verification behavior remains authoritative.

## Baseline invariant verification

Command:

```text
npx vitest run utils/keyRoll.test.ts utils/rollDistribution.test.ts utils/saveSchema.test.ts utils/gamePersistence.test.ts scripts/sync-achievement-diaries.test.ts
```

Result: PASS — 5 test files passed, 107 tests passed, 0 failures.

The prerequisite `npm run release:verify` gate also passed at this base: 100
test files and 1,027 tests passed, typecheck passed, content verification passed
(39 tests), Diary verification reported generated files current, and the
production build completed successfully.
