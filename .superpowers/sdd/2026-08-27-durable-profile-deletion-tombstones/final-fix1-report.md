# Final Audit Fix Round 1 — Recovery Mutation Commit Authorization

## Outcome

Addressed the final-review P1 from exact starting HEAD
`d81bebc55ffd82796577ff1c531266a47031e964`.

Every ordinary authorized IndexedDB mutation in `utils/recoveryDatabase.ts`
now performs a final authorization check after its last mutating request has
succeeded and before transaction completion can be reported. Ownership loss
aborts and rolls back head writes, checkpoint writes, explicit checkpoint
deletions, retention pruning, metadata writes, and profile-data deletion.
`deleteProfileData` already had the correct final check and remains covered by
its existing post-delete rollback regression.

`putHead` additionally reads the head back inside the same read/write
transaction and compares every own field exactly before it can return
`stored: true`. Missing, stale, or otherwise mismatched readback aborts the
transaction, returns `storage_unavailable`, and preserves the prior head.

## Root cause and implementation

The repository checked authorization initially and immediately before each
mutation request, but head, checkpoint, metadata, and checkpoint-deletion
transactions returned their success result as soon as the request promise
resolved. A lease takeover during that request therefore had no final gate
before commit.

The scoped correction:

- reauthorizes after successful head `put` plus exact in-transaction readback;
- reauthorizes after successful checkpoint `put`;
- reauthorizes after the final issued checkpoint `delete`, covering both the
  public deletion API and automatic retention pruning;
- reauthorizes after successful metadata `put`;
- preserves the existing final authorization in `deleteProfileData`;
- leaves read-only transactions, stale/no-op branches, and schema upgrade
  setup unchanged.

The transaction-wrapper audit found no additional masking defect. Both wrapper
paths install their completion handlers before work starts, await the request
body and transaction completion before returning, abort and drain completion
on body failure, and only convert an `OwnershipAbort` to its typed result after
the abort path has run. A transaction completion rejection is therefore not
replaced by a successful body result. The version-upgrade transaction is the
only mutation outside the authorized repository methods; it runs before a
repository exists and already aborts when store/index creation fails.

## TDD evidence

RED, tests only:

```text
npx vitest run utils/recoveryDatabase.test.ts
Test Files  1 failed (1)
Tests       8 failed | 21 passed (29)
```

The eight expected failures were:

- missing post-put head readback reported `{ stored: true }`;
- stale post-put head readback reported `{ stored: true }`;
- field-mismatched post-put head readback reported `{ stored: true }`;
- ownership loss after a successful head put still committed;
- ownership loss after a successful checkpoint put committed and was
  misreported as a later prune failure;
- ownership loss after a successful metadata put still committed;
- ownership loss after a successful explicit checkpoint delete still
  committed;
- ownership loss after the retention delete request still committed the prune.

GREEN, implementation applied:

```text
npx vitest run utils/recoveryDatabase.test.ts
Test Files  1 passed (1)
Tests       29 passed (29)
```

## Verification

Focused recovery/profile/save boundary:

```text
npx vitest run utils/recoveryDatabase.test.ts utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts utils/profileStorage.test.ts utils/profileWriterLease.test.ts utils/saveCoordinator.test.ts utils/saveIntegrity.test.ts utils/saveRecovery.test.ts utils/saveRecoveryIntegration.test.ts utils/saveSchema.test.ts
Test Files  10 passed (10)
Tests       357 passed (357)
```

Typecheck:

```text
npm run typecheck
exit 0
```

Full release gate:

```text
npm run release:verify
exit 0
What's New: 27 player-facing files verified
Main suite: 250 files, 3,161 tests passed
Quest requirements: 1 file, 27 tests passed
Quest routes: 1 file, 7 tests passed
Content baseline/consistency/migrations/CA: 4 files, 62 tests passed
Combined release-gate Vitest total: 256 files, 3,257 tests passed
Diary source: 492 official rows, 485 classified existing rows, 0 unresolved
Quest source: 191 quests, 19 miniquests, 210 unique IDs/revisions
Walkthrough source: 8 reviewed source quest records
Production build: 2,693 modules transformed
Model manifest: 59 models, generated file unchanged
```

Separate production build:

```text
npm run build
exit 0
2,693 modules transformed
59-model manifest generated with no tracked diff
```

Diff checks:

```text
git diff --check
exit 0 (repository line-ending warnings only)
git diff --exit-code -- data/modelManifest.ts
exit 0
```

The full suite/build retained known non-failing Vite deprecation and chunk-size
warnings, Node `--localstorage-file` warnings, and intentional Goal Planner
negative-path console traces. No warning originated from this fix.

## Scope and release status

Tracked implementation/test scope is limited to:

- `utils/recoveryDatabase.ts`
- `utils/recoveryDatabase.test.ts`
- this report

No push, pull request, merge to `main`, deployment, or release was performed.
The existing `codex/crash-safe-save-recovery` worktree and branch are preserved.

---

## Final Review Fix Round 2 — Deterministic Post-Success Regressions

Starting HEAD: `0186a6fb75b7619620072a6db0c94e0ba0906a4b`.

### Reviewer finding

The round-1 rollback regressions changed their ownership state from
`transactionAdapter.beforeRequest`. That proved a request was about to be
issued, but the test names called the request completed without observing its
actual `success` event. The head-readback matrix also covered only missing,
stale-revision, and checksum mismatch cases.

### Test correction

The round-2 harness wraps the standard `IDBObjectStore.get`, `put`, and
`delete` methods only long enough to attach standard `IDBRequest` `success`
listeners. Authorization remains allowed until every operation-specific
success label has actually fired. Only then does the next authorization check
return `ownership_conflict`.

The deterministic boundaries now cover:

- head `put` success followed by exact head-readback `get` success;
- checkpoint `put` success;
- metadata `put` success;
- explicit checkpoint `delete` success;
- retention-prune checkpoint `delete` success;
- profile head, checkpoint, and metadata `delete` successes, all observed
  before final denial.

Each test asserts the complete success-label sequence as well as the typed
failure and durable rollback state. The tests no longer infer post-request
timing from authorization call counts or `beforeRequest`.

The exact head-readback matrix now independently corrupts or removes the
stored record after the original head `put` emits success. It covers:

- missing readback;
- stale readback;
- `profileId`;
- `persistenceRevision`;
- `runId`;
- `runRevision`;
- `capturedAt`;
- `checksum`;
- `data`.

The `profileId` case uses real key-path behavior: after the candidate `put`
succeeds, it deletes the candidate key and writes the mismatched profile key
before readback. The transaction must abort, preserve the prior `alpha` head,
and leave no `beta` head.

### Mutation-test RED evidence

After writing the strengthened tests, the round-1 production guards were
temporarily removed from the working tree: exact head readback plus final
authorization for head, checkpoint, metadata, checkpoint deletion/prune, and
profile deletion. No temporary production mutation was committed.

```text
npx vitest run utils/recoveryDatabase.test.ts
Test Files  1 failed (1)
Tests       15 failed | 20 passed (35)
```

All intended mutations were caught:

- nine missing/stale/per-field head-readback failures;
- head post-success ownership loss;
- checkpoint post-success ownership loss;
- metadata post-success ownership loss;
- explicit checkpoint-delete post-success ownership loss;
- retention-prune delete post-success ownership loss;
- profile head/checkpoint/metadata delete success followed by ownership loss.

The production file was then restored exactly. `git diff --exit-code --
utils/recoveryDatabase.ts` returned exit 0.

### GREEN and gate evidence

```text
npx vitest run utils/recoveryDatabase.test.ts
Test Files  1 passed (1)
Tests       35 passed (35)

npx vitest run utils/recoveryDatabase.test.ts utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts utils/profileStorage.test.ts utils/profileWriterLease.test.ts utils/saveCoordinator.test.ts utils/saveIntegrity.test.ts utils/saveRecovery.test.ts utils/saveRecoveryIntegration.test.ts utils/saveSchema.test.ts
Test Files  10 passed (10)
Tests       363 passed (363)

npm run typecheck
exit 0

npm run release:verify
exit 0
What's New: 27 player-facing files verified
Main suite: 250 files, 3,167 tests passed
Quest requirements: 1 file, 27 tests passed
Quest routes: 1 file, 7 tests passed
Content baseline/consistency/migrations/CA: 4 files, 62 tests passed
Combined release-gate Vitest total: 256 files, 3,263 tests passed
Diary source: 492 official rows, 485 classified existing rows, 0 unresolved
Quest source: 191 quests, 19 miniquests, 210 unique IDs/revisions
Walkthrough source: 8 reviewed source quest records
Production build: 2,693 modules transformed
Model manifest: 59 models, generated file unchanged

npm run build
exit 0
2,693 modules transformed
59-model manifest generated with no tracked diff
```

Round 2 changes only `utils/recoveryDatabase.test.ts` and this report. No
production file remains modified. The known non-failing repository warnings
listed above were unchanged. No push, pull request, merge, deployment, or
release was performed.
