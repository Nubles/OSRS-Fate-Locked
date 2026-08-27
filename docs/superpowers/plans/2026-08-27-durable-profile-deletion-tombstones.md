# Durable Profile Deletion Tombstones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile cross-store profile-deletion rollback with a durable, resumable tombstone protocol, then integrate current `main` and produce a fully verified PR candidate.

**Architecture:** Profile metadata version 2 stores deletion intents beside visible profiles. Tombstone commit is the point of no return: the profile becomes hidden and unwritable before idempotent IndexedDB/localStorage cleanup, and failures retain a resumable intent instead of restoring the profile. `ProfileProvider` serializes bounded startup/manual cleanup attempts and exposes truthful cleanup-pending state.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, browser `localStorage`, IndexedDB/fake-indexeddb, Vite.

**Spec:** `docs/superpowers/specs/2026-08-27-durable-profile-deletion-tombstone-design.md`

## Global Constraints

- No cross-store rollback may restore a tombstoned profile to the visible registry.
- Cleanup attempts are bounded; durable intents survive failure, cancellation, reload, and tab loss.
- A tombstoned profile is hidden and cannot acquire a normal writer lease.
- Every target-key removal is read back; failures are counted and reported without exposing save bytes.
- IndexedDB cleanup is target-only and preserves every other profile's head, checkpoints, and metadata.
- Version-1 metadata migrates to version 2 with an empty deletion list; versions greater than 2 remain read-only.
- No new dependency, network request, telemetry, or cloud storage.
- Use strict red-green TDD and one independently reviewable commit per task.

---

### Task 1: Version-2 Profile Registry and Tombstone Parsing

**Files:**
- Modify: `types.ts`
- Modify: `utils/profileMetadata.ts`
- Modify: `utils/profileMetadata.test.ts`
- Modify: `utils/profileMetadataTransaction.test.ts`

**Interfaces:**
- Produces: `ProfileDeletionIntentV1`
- Produces: `ProfileMetadata.deletions: ProfileDeletionIntentV1[]`
- Produces: `PROFILE_METADATA_VERSION = 2`
- Produces: `isProfileDeletionPending(metadata: ProfileMetadata, profileId: string): boolean`

- [ ] **Step 1: Write failing parser and migration tests**

Add tests proving:

```ts
expect(parseProfileMetadata(JSON.stringify({
  version: 1,
  revision: 4,
  profiles: [profileA],
  activeProfileId: profileA.id,
}))).toEqual({
  status: 'legacy',
  metadata: {
    version: 2,
    revision: 4,
    profiles: [profileA],
    activeProfileId: profileA.id,
    deletions: [],
  },
});
```

Add strict version-2 cases for duplicate deletion IDs, duplicate profile IDs, a profile present in both arrays, unsafe IDs, unknown fields, invalid phases, an active tombstoned profile, and bounds. Verify version 3 returns `unsupported` without mutation.

- [ ] **Step 2: Run the parser tests and confirm RED**

Run:

```powershell
npx vitest run utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts
```

Expected: failures because version 2/deletion intents are not accepted and version 1 is still current.

- [ ] **Step 3: Implement the minimal strict schema**

Add:

```ts
export interface ProfileDeletionIntentV1 {
  version: 1;
  deletionId: string;
  profileId: string;
  requestedAt: number;
  phase: 'pending_cleanup';
}

export interface ProfileMetadata {
  version: 2;
  revision: number;
  profiles: Profile[];
  activeProfileId: string;
  deletions: ProfileDeletionIntentV1[];
}
```

Parse version 1 as a legacy migration candidate and version 2 as current. Inspect every record using the existing descriptor-safe pattern; never spread untrusted objects. Reject overlapping visible/tombstoned IDs.

- [ ] **Step 4: Update all fresh/repair metadata constructors**

Every `ProfileMetadata` constructor must explicitly set `version: 2` and `deletions: []`. Registry backup and recovery must round-trip deletion intents exactly.

- [ ] **Step 5: Run focused tests and typecheck**

```powershell
npx vitest run utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts context/ProfileContext.test.tsx
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add -- types.ts utils/profileMetadata.ts utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts context/ProfileContext.test.tsx
git commit -m "feat: add durable profile deletion tombstones"
```

---

### Task 2: Tombstone Commit and Idempotent Cleanup Engine

**Files:**
- Modify: `utils/profileMetadataTransaction.ts`
- Modify: `utils/profileMetadataTransaction.test.ts`
- Modify: `utils/profileWriterLease.ts`
- Modify: `utils/profileWriterLease.test.ts`
- Modify: `utils/recoveryTypes.ts`
- Modify: `utils/recoveryDatabase.ts`
- Modify: `utils/recoveryDatabase.test.ts`
- Modify: `utils/profileStorage.ts`
- Modify: `utils/profileStorage.test.ts`

**Interfaces:**
- Produces: `ProfileDeletionCleanupResult`
- Produces: `commitProfileDeletionTombstone(profileId, deps): Promise<ProfileTransactionResult>` through the existing delete mutation entry point
- Produces: `resumeProfileDeletion(intent, deps): Promise<ProfileDeletionCleanupResult>`
- Consumes: `RecoveryRepository.deleteProfileData(profileId, authorizeWrite)`

- [ ] **Step 1: Write tombstone point-of-no-return tests**

Use deterministic dependencies to assert that deleting a profile first commits metadata equivalent to:

```ts
{
  version: 2,
  revision: previous.revision + 1,
  profiles: previous.profiles.filter(profile => profile.id !== targetId),
  activeProfileId: fallbackId,
  deletions: [{
    version: 1,
    deletionId,
    profileId: targetId,
    requestedAt,
    phase: 'pending_cleanup',
  }],
}
```

Before this verified write, inject failures and assert no target keys or IndexedDB records change. After it, inject cancellation/failure at every cleanup boundary and assert the visible profile never returns.

- [ ] **Step 2: Write bounded cleanup and cross-tab RED tests**

Add real fake-indexeddb regressions for:

- continuous foreign metadata-lock contention returning `cleanup_pending` within a bounded attempt;
- initiating tab cancellation after tombstone and after IndexedDB commit;
- deletion worker death followed by a new worker resuming the same intent;
- normal and forced writer takeover being rejected while the intent exists;
- local `removeItem` exception and a key reappearing before readback;
- accurate `removedEntries`, `removalFailures`, and `rollbackFailures`/cleanup counts;
- target-only head/checkpoint/metadata deletion with another profile unchanged;
- duplicate cleanup and remote completion remaining idempotent.

Run the new named tests and confirm they fail for the current rollback/arbitration implementation.

- [ ] **Step 3: Implement tombstone-first mutation**

Refactor delete mutation into explicit phases. The existing metadata transaction writes the tombstone and returns committed metadata even if cleanup later fails. Extend delete details with:

```ts
type ProfileDeleteDetails = {
  removedEntries: number;
  removalFailures: number;
  cleanupPending: boolean;
  deletionId: string | null;
};
```

Do not restore old registry/local/IndexedDB state after tombstone commit.

- [ ] **Step 4: Implement idempotent cleanup**

Add a bounded `resumeProfileDeletion` operation that:

1. verifies the intent still exists;
2. claims a deletion lease bound to `deletionId`;
3. transactionally deletes target IndexedDB records;
4. removes the independently hard-coded `profileOwnedKeys(profileId)` contract;
5. reads back every key;
6. reacquires metadata authority once per bounded attempt;
7. removes the exact intent only when both stores verify clean;
8. releases the deletion lease in `finally` when owned.

Metadata contention returns cleanup pending; it never loops indefinitely and never restores the visible profile.

- [ ] **Step 5: Deny normal writers for tombstoned IDs**

Update lease authorization/claim call sites so normal save, recovery, sidecar, archive, backup, and deletion writes reject any profile ID in `metadata.deletions`. Only the matching deletion worker may hold the deletion lease.

- [ ] **Step 6: Run focused storage tests and typecheck**

```powershell
npx vitest run utils/profileMetadataTransaction.test.ts utils/profileWriterLease.test.ts utils/recoveryDatabase.test.ts utils/profileStorage.test.ts
npm run typecheck
```

Expected: all state-machine, cleanup, authority, and isolation tests pass.

- [ ] **Step 7: Commit**

```powershell
git add -- utils/profileMetadataTransaction.ts utils/profileMetadataTransaction.test.ts utils/profileWriterLease.ts utils/profileWriterLease.test.ts utils/recoveryTypes.ts utils/recoveryDatabase.ts utils/recoveryDatabase.test.ts utils/profileStorage.ts utils/profileStorage.test.ts
git commit -m "fix: make profile deletion resumable"
```

---

### Task 3: Provider Resumption and Cleanup-Pending User Experience

**Files:**
- Modify: `context/ProfileContext.tsx`
- Modify: `context/ProfileContext.test.tsx`
- Modify: `components/ProfileSwitcher.tsx`
- Modify: `components/ProfileSwitcher.test.tsx`
- Modify: `utils/profileMetadata.ts`
- Modify: `utils/profileMetadata.test.ts`

**Interfaces:**
- Produces: `pendingDeletionCount: number` on `ProfileContextType`
- Produces: `retryProfileDeletionCleanup(): Promise<void>` on `ProfileContextType`
- Consumes: `resumeProfileDeletion(intent, deps)`

- [ ] **Step 1: Write provider startup/resume tests**

Add tests proving the provider:

- installs visible version-2 metadata before cleanup finishes;
- never exposes tombstoned IDs in `profiles` or `activeProfileId`;
- runs only one serialized cleanup worker;
- resumes after reload and relevant storage events;
- cancels stale UI completion on unmount without removing the intent;
- does not write when metadata is future-version read-only;
- excludes tombstoned IDs during metadata reconstruction/repair.

- [ ] **Step 2: Write cleanup-pending UI RED tests**

Render the profile manager with `pendingDeletionCount > 0`. Assert accessible copy, one Retry button, disabled/in-flight behavior, truthful success/failure feedback, stale completion suppression, and no raw profile/save bytes.

- [ ] **Step 3: Implement serialized resumption**

After metadata initialization, enqueue each intent through one worker. Each attempt is bounded. On success, install finalized metadata; on failure, keep the installed tombstone metadata and expose pending count. Storage events schedule another attempt without overlapping the active worker.

- [ ] **Step 4: Implement the warning and Retry action**

Use concise copy:

```text
Profile removed; storage cleanup pending.
```

The Retry action calls `retryProfileDeletionCleanup`, disables while active, and reports `profile_in_use` separately from `storage_unavailable`.

- [ ] **Step 5: Run focused UI/provider tests and typecheck**

```powershell
npx vitest run context/ProfileContext.test.tsx components/ProfileSwitcher.test.tsx utils/profileMetadata.test.ts
npm run typecheck
```

Expected: all pass with no act/unhandled-promise warnings.

- [ ] **Step 6: Commit**

```powershell
git add -- context/ProfileContext.tsx context/ProfileContext.test.tsx components/ProfileSwitcher.tsx components/ProfileSwitcher.test.tsx utils/profileMetadata.ts utils/profileMetadata.test.ts
git commit -m "feat: resume pending profile cleanup"
```

---

### Task 4: Crash Matrix, Changelog Accuracy, and Pre-Integration Review

**Files:**
- Modify: `App.lifecycle.test.tsx`
- Modify: `data/changelog.ts` only if current copy needs a truthful tombstone/cleanup note
- Modify: `data/changelog.test.ts`
- Modify: `.superpowers/sdd/2026-08-25-crash-safe-save-recovery/progress.md` (ignored evidence only)
- Modify: `.superpowers/sdd/2026-08-25-crash-safe-save-recovery/task-12-report.md` (ignored evidence only)

**Interfaces:**
- Consumes all Tasks 1–3 interfaces.
- Produces a reviewed pre-integration tombstone feature commit set.

- [ ] **Step 1: Add end-to-end crash-boundary tests**

Cover tombstone commit followed by immediate reload, crash before/after IndexedDB commit, local cleanup failure followed by restart, continuous lock contention followed by manual retry, two tabs racing cleanup, and future-version registry read-only behavior.

- [ ] **Step 2: Verify changelog wording**

The changelog may claim resumable deletion only if tests prove it. Do not claim secure erasure or Firefox/WebKit verification.

- [ ] **Step 3: Run pre-integration gates**

```powershell
npx vitest run utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts utils/profileWriterLease.test.ts utils/recoveryDatabase.test.ts context/ProfileContext.test.tsx components/ProfileSwitcher.test.tsx App.lifecycle.test.tsx
npm run typecheck
npm run release:verify
npm run build
```

Expected: all pass.

- [ ] **Step 4: Obtain a fresh Sol read-only review**

Review the tombstone commits against the approved spec. Fix every P1/P2 finding through the normal TDD/re-review loop before integrating `main`.

- [ ] **Step 5: Commit any test/changelog-only adjustments**

```powershell
git add -- App.lifecycle.test.tsx data/changelog.ts data/changelog.test.ts
git commit -m "test: lock resumable profile deletion"
```

Skip the commit if no tracked file changed.

---

### Task 5: Integrate Current Main and Produce the PR Candidate

**Files:**
- Merge resolution expected in: `data/changelog.ts`
- Merge resolution expected in: `data/changelog.test.ts`
- Merge resolution expected in: `utils/pendingSaves.ts`
- Merge resolution expected in: `utils/pendingSaves.test.ts`
- Review new current-main file: `utils/storageRecovery.ts`
- Modify other files only when required to preserve both current-main behavior and the approved design.

**Interfaces:**
- Consumes the reviewed tombstone branch and latest `origin/main`.
- Produces the exact candidate intended for one PR against `main`.

- [ ] **Step 1: Fetch and merge current main**

```powershell
git fetch origin main
git merge --no-ff origin/main
```

Never force-push or discard either side. Resolve conflicts by preserving current-main behavior plus crash-safe-save/tombstone invariants.

- [ ] **Step 2: Run conflict-focused tests**

```powershell
npx vitest run data/changelog.test.ts utils/pendingSaves.test.ts utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts context/ProfileContext.test.tsx App.lifecycle.test.tsx
```

Expected: all pass.

- [ ] **Step 3: Run the exact final automated gates**

```powershell
npm run typecheck
npm run release:verify
npm run build
git diff --check origin/main...HEAD
```

Record exact file/test totals and build results.

- [ ] **Step 4: Run Chromium behavior checks**

Verify ordinary save/reload, interrupted recovery, confirmed checkpoint rollback, deletion cleanup pending/retry, deletion completion after reload, two-tab ownership, future-version read-only behavior, and narrow-screen accessibility. Record console errors and screenshots for new deletion states.

- [ ] **Step 5: Obtain final Sol review**

The fresh reviewer inspects `origin/main...HEAD`, the final reports, conflicts, and Chromium evidence. Any actionable finding returns to TDD before PR creation.

- [ ] **Step 6: Prepare one PR**

After a PASS, push `codex/crash-safe-save-recovery` and create one PR against `main`. Keep the worktree for CI/review fixes. Do not deploy until `CI / quality` passes and the user authorizes release.
