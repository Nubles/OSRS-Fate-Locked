# Final Review Fix Report — One Physical Chunk, One Unlock

## Status

Complete: final-review overlap-identity fixes are implemented on
codex/chunk-accuracy-remediation from base
a9fe90f414464f14167c2e24fc7a30a3fd150bf2.

This is intentionally the overlap-identity phase only. The separately queued
source refresh, surface classifications, continent corrections, Windows
newline verifier, and final full-suite gate were not changed here.

## Findings and resolutions

### 1. Stale completion contract

Finding: utils/completion.test.ts still pinned 181 paid areas and a 951
completion denominator, although production derives the current 176-area pool
and denominator 946.

Resolution: updated the consumer-facing completion contract to assert exactly
176 paid areas and denominator 946. It continues to check the legacy Elf Camp
alias is excluded from the roll pool.

### 2. Goal routing retained raw geographic aliases

Finding: goal planning retained geographic blocker labels as raw identifiers.
A Kandarin Medium Ranging Guild location requirement therefore reached
suggestTables as Ranging Guild, which can match the separate Guilds-table
entry rather than Areas-table Hemenster. Other overlap aliases could likewise
miss their canonical area recommendation.

Resolution:

- Goal planner now makes geographic area steps from canonical IDs and
  policy-derived display names.
- Geographic blockers from quests, diary tasks, region/location alternatives,
  and direct region goals canonicalize at the planner boundary.
- Goal routing carries a step ID, not display copy, into table matching.
- Strategy and Resource Engine geographic region inputs canonicalize before
  recommendation matching.
- Real guild alternatives retain their raw IDs. A regression test confirms
  Heroes' Guild and Ranging Guild remain valid Guilds-table recommendations
  when they are actual guild requirements.

Regression coverage proves Kandarin Medium renders Hemenster · Ranging Guild,
recommends Hemenster from Areas, and never recommends Ranging Guild from
Guilds. The shared planner table also covers Ice Mountain -> Goblin Village,
Heroes' Guild -> Taverley, and Resource Area -> Mage Arena. Otto's Grotto has
no matching diary geographic-blocker fixture; its alias behavior remains
covered at save, reachability, map, and RuneLite boundaries by existing
overlap gates.

### 3. Save compatibility matrix

Finding: the save-schema tests covered alias-only cases plus a partial
multi-pair refund scenario, but did not pin alias-only, owner-only, and mixed
alias+owner outcomes for every overlap pair across both current and
unversioned saves.

Resolution: replaced the narrow alias-only case with a table-driven
five-pair matrix. Each pair now checks three input shapes across current and
unversioned saves, including one key refund for mixed pair inputs,
canonicalized region output, source version, migration warning semantics,
history preservation, and idempotent re-validation.

## Files changed

- utils/completion.test.ts
- utils/goalPlanner.ts
- utils/goalPlanner.test.ts
- utils/goalRoute.ts
- utils/goalRoute.test.ts
- utils/saveSchema.test.ts
- .superpowers/sdd/2026-08-02-one-physical-chunk-one-unlock-implementation/final-review-fix-report.md

## Test-first evidence

Red:

    npx vitest run utils/completion.test.ts
    FAIL: expected REGIONS_LIST length 181 but received 176.

    npx vitest run utils/completion.test.ts utils/goalPlanner.test.ts utils/goalRoute.test.ts utils/saveSchema.test.ts
    5 intentional failures, 137 passing:
    - four geographic planner cases retained raw alias IDs and labels;
    - Kandarin Medium route showed Ranging Guild instead of
      Hemenster · Ranging Guild.
    Completion and the expanded save matrix passed because their production
    behavior was already correct; their tests repaired stale or incomplete
    contracts.

Green:

    npx vitest run utils/completion.test.ts utils/goalPlanner.test.ts utils/goalRoute.test.ts utils/saveSchema.test.ts
    PASS: 4 files, 142 tests.

    npx vitest run data/areaMapPolicy.test.ts data/consistency.test.ts utils/completion.test.ts utils/saveSchema.test.ts utils/goalPlanner.test.ts utils/goalRoute.test.ts utils/reachability.test.ts utils/chunkLocations.test.ts utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts components/ChunkActivityPanel.test.tsx components/OracleSearch.test.tsx
    PASS: 12 files, 236 tests.

    npx vitest run utils/goalRoute.test.ts
    PASS: 1 file, 15 tests.

    npm run typecheck
    PASS: tsc --noEmit.

The Vitest runner emits pre-existing Vite esbuild deprecation warnings and one
Node localstorage-file warning; none are test failures.

## Review and commit

Self-review completed:

- git diff --check exited 0.
- The planner uses canonical IDs only for geographic/region identities;
  Guilds-table identifiers remain raw.
- UI copy derives from displayAreaName, avoiding a second alias list.
- Save matrix expectations are literal, table-driven, and exercise the real
  migration function, including history/idempotence behavior.
- No protected Unreal project, Unreal process, source refresh, continent data,
  or Windows verifier was touched.

Commit: one commit on codex/chunk-accuracy-remediation with message
fix: canonicalize geographic goal area aliases. The resulting hash is reported
in the task handoff.

## Concerns

None for this scoped fix wave. The intentional remaining work is the separate
source-refresh/accuracy and verification plans listed in Status.
