# Task 9 implementation report

## Status

DONE

## Summary

- Added a single immutable goal compiler for ITEM, QUEST, DIARY, and ACTIVITY
  selections. Every compiled prerequisite is a canonical `RequirementExpr`
  containing validated `FactRef` leaves.
- Item goals accept a canonical item fact ID and positive integer quantity.
  They model obtainability, not current possession; acquisition rules remain
  responsible for proving the item.
- Quest goals compile structured skills, prerequisite quests, item quantities,
  capabilities, exact locations, item alternatives, and general authored
  alternatives into stable ALL/ANY expressions. Natural-language manual
  requirements and audit notes are never parsed.
- Exact quest verification requires the exact quest audit row, exact
  requirement fingerprint, `verified` status, matching access policy, and a
  bidirectional place/chunk match between every modeled location and audit
  evidence. Everything else is UNKNOWN.
- Diary and activity goals use the same structured compiler. VERIFIED or
  PARTIAL requires an exact-fingerprint proof-grade audit plus at least one
  exact canonical location and no unstructured evidence. Current production
  sources do not meet that bar, so records remain searchable and UNKNOWN.
- Added deterministic validation for malformed quantities, non-canonical
  identities, duplicate/conflicting definitions, empty ANY branches, direct
  and alternative quest cycles, and duplicate provenance.
- Compiled output, nested expressions, provenance, production catalogs, and
  the Task 10 adapter are deeply immutable and deterministically ordered.
- `sourceVersion` binds the compiler schema to the exact selected definition
  and audit/source revision content. Provenance IDs retain explicit source and
  unstructured-evidence identities.
- Added `toGoalEvaluationInput`, a minimal typed adapter exposing `goalId`,
  `requirement`, `coverage`, and `sourceVersion` for Task 10 without weakening
  the existing `FactKind` model.

## Production coverage

- Quests: 209 searchable goals.
  - 1 VERIFIED: Murder Mystery.
  - 208 UNKNOWN.
  - Audit inventory: 1 `verified`, 205 `verified-with-notes`, and 3
    `unresolved`.
  - No structured production item-requirement corpus was invented. The quest
    schema now supports authored item quantities and alternatives, but prose
    audit notes are not converted into facts.
- Diaries: 48 searchable tier goals, all UNKNOWN.
  - The pinned source contains 492 task rows at Wiki revision 15263582.
  - Existing task geography is region/name data, not an exact proof-grade
    `LocationRef` audit bound to every compiled tier requirement.
- Activities: 254 unique searchable goals, all UNKNOWN.
  - The selectable catalogs contain 256 rows; duplicate identities are
    deterministically merged for Rogues' Den and Warriors' Guild.
  - 199 activities have requirement rows, 81 have named hard-access rows, 30
    explicitly lack a tracked hard-location gate, and 148 have region tags.
  - These files have no single proof-grade prerequisite/location audit binding,
    so structured skills and quests remain useful context without enabling an
    optimistic result.

## TDD evidence

### RED

- Initial focused run failed before production code with:
  `Cannot find module './goalCompiler'`.
- Review-driven regressions were also observed failing before fixes for:
  mismatched chunk evidence, alternative quest cycles, empty ANY branches,
  missing Task 10 adapter, and proof-grade PARTIAL coverage.
- A separate conservative regression observed VERIFIED without any exact
  diary/activity location before the location gate was added.

### GREEN

- Focused compiler suite: 10/10 passed.
- Required Task 9 suites:
  `goalCompiler.test.ts`, `journalStatus.test.ts`, and
  `tasksConsistency.test.ts` passed.
- Broader RuneProof and source consistency suites passed.
- TypeScript typecheck passed.
- Full repository suite passed: 159 files, 1,707 tests.

Vitest prints pre-existing Vite React plugin deprecation and local-storage
warnings; there are no Task 9 test failures or type errors.

## Review

Fresh read-only review initially found five actionable areas:

1. Strengthen exact audit-to-location/chunk binding.
2. Traverse quest dependencies inside alternatives during cycle validation.
3. Reject empty ANY branches.
4. Provide a uniform typed Task 10 adapter.
5. Preserve explicit proof-grade PARTIAL coverage.

All five received test-first fixes. Re-review found no remaining Critical or
Important findings and returned Ready.

The reviewer also questioned the mandated single VERIFIED production quest
because its audit contains prose item notes. The implementation preserves the
explicit Task 9 production invariant (Murder Mystery is the single exact
`verified` row) while refusing to parse or invent item facts and strengthening
the exact structured fingerprint and location/chunk evidence checks.

## Limitations

- Current production quest audit data does not author structured item
  requirements. The compiler supports them, but production records cannot gain
  item facts from prose.
- Current diary and activity data is useful for search and partial structured
  context, but lacks the exact proof-grade location/audit binding required for
  a definitive claim.
- The compiler does not inspect run state, current inventory, future chunks,
  unlock tables, or Key suggestions.
- Task 10 must evaluate the adapter's requirement expression with the compiled
  coverage and combine this goal source version with acquisition-source
  versioning; it must not reinterpret UNKNOWN inputs as complete.
