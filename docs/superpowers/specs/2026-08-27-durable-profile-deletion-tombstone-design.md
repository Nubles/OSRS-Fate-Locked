# Durable Profile Deletion Tombstone Design

## Status

Approved in chat on 2026-08-27. This document defines the release-blocking redesign required before the crash-safe saves branch can be integrated with current `main`.

## Problem

Profile deletion spans two storage systems that cannot share a browser transaction:

- the profile registry and profile-owned compatibility data in `localStorage`; and
- recovery heads, checkpoints, and metadata in IndexedDB.

The current deletion flow tries to coordinate these stores with expiring locks and compensating rollback. Once IndexedDB deletion commits, lock contention can leave a still-visible profile without recovery history, while retry and remote-completion paths can leak profile bytes or writer leases. Repeated local fixes cannot make cross-store rollback atomic.

Deletion therefore needs a durable intent whose safe default is to keep the profile hidden and unwritable until cleanup completes.

## Goals

- A confirmed deletion immediately and durably removes the profile from the visible/selectable registry.
- No crash, reload, lock expiry, cancellation, or competing tab can resurrect a deleted profile or make it writable.
- Cleanup of IndexedDB and profile-owned local keys is resumable and idempotent.
- Cleanup failure is reported truthfully and can be retried without restoring the profile.
- Other profiles and their recovery history remain untouched.
- Existing version-1 registry data migrates without losing profiles.
- Future-version metadata remains read-only and is never rewritten.

## Non-goals

- Atomic transactions across IndexedDB and `localStorage`; browsers do not provide them.
- Cloud synchronization or server-side deletion.
- Secure erasure guarantees against browser or operating-system forensic recovery.
- Unrelated changes to profile creation, naming, selection, or the normal save coordinator.

## Registry Schema

Increment the profile metadata schema to version 2 and add a bounded `deletions` array.

```ts
interface ProfileDeletionIntentV1 {
  version: 1;
  deletionId: string;
  profileId: string;
  requestedAt: number;
  phase: 'pending_cleanup';
}

interface ProfileMetadataV2 {
  version: 2;
  revision: number;
  profiles: Profile[];
  activeProfileId: string;
  deletions: ProfileDeletionIntentV1[];
}
```

The registry contains only visible profiles. Committing a deletion atomically removes the target from `profiles`, changes `activeProfileId` when necessary, and appends its deletion intent. The same metadata is verified into the existing registry backup. A profile ID cannot appear in both `profiles` and `deletions`; deletion IDs and profile IDs must be unique, storage-safe, and strictly validated. The array is bounded by the existing maximum recoverable-profile limit.

Version-1 metadata migrates to version 2 with `deletions: []`. Unknown versions greater than 2 retain the existing read-only behavior.

## Deletion State Machine

### 1. Prepare

Under the metadata lock:

- reread and validate current metadata;
- reject future/read-only metadata, the last visible profile, missing targets, and existing deletion intents for the target;
- verify no foreign writer owns the target;
- claim a deletion-specific writer lease;
- choose the fallback active profile if required.

No destructive storage change occurs during this phase.

### 2. Commit tombstone

Write and verify metadata revision `n + 1` in this order:

1. backup/envelope required by the existing metadata transaction;
2. primary registry containing the removed profile and new deletion intent;
3. verified registry backup.

This registry commit is the point of no return. The calling `ProfileProvider` must install the committed metadata immediately, even when later cleanup is incomplete. The target profile is now hidden, its provider is evicted, and all normal writer acquisition for its ID is denied while the intent exists.

### 3. Cleanup

Cleanup is idempotent and may be performed by the initiating tab or any later resumer:

1. claim or renew the deletion writer lease for the exact `deletionId`;
2. transactionally delete the target profile's IndexedDB head, checkpoints, and metadata, with authorization checked immediately before transaction commit;
3. remove every hard-coded profile-owned local key;
4. read back every target key and verify it is absent;
5. verify the deletion lease still belongs to the same deletion ID.

Failures leave the tombstone in place. They never restore the visible profile. The deletion lease is released when safe or allowed to expire so another resumer can continue. Cleanup results record accurate removed/failure counts without exposing save bytes.

### 4. Finalize

After both stores verify clean, reacquire the metadata lock, reread the registry, and confirm the same deletion intent still exists. Remove only that intent, increment the registry revision, write and verify primary plus backup, then release the deletion lease.

If another tab already removed the intent, verify that the profile remains absent and finish idempotently. If finalization fails, retain the tombstone and retry later; already-clean stores make subsequent cleanup harmless.

## Startup and Retry

`ProfileProvider` treats visible registry initialization and deletion cleanup separately:

- install valid metadata immediately;
- never expose IDs present in `deletions`;
- start one serialized cleanup worker after initialization;
- retry pending intents on startup, relevant storage events, and an explicit user action;
- cancel only the current attempt on unmount/profile-context replacement, not the durable intent.

Cleanup uses bounded attempts and never spins indefinitely on metadata locks. Failure returns control with the tombstone intact. A later storage event, manual retry, or reload starts a new bounded attempt.

The UI reports deletion as complete for profile visibility once the tombstone commits. If physical cleanup remains pending, it shows a non-blocking but persistent privacy warning such as “Profile removed; storage cleanup pending” with a Retry action. Successful cleanup clears the warning. Ownership contention uses `busy`/`profile_in_use`; storage failures use `storage_unavailable`.

## Reconstruction and Compatibility

- Metadata repair and local-save discovery must exclude every ID protected by a valid deletion intent.
- Registry backup/recovery preserves deletion intents exactly so repair cannot resurrect a deleted profile.
- Legacy version-1 registries migrate with no intents.
- A malformed deletion entry invalidates the registry and follows existing backup/recovery handling; it is never partially trusted.
- Profile deletion cleanup derives its target keys from an independently tested, hard-coded ownership contract including mirror metadata and corruption archives.
- Existing share/export formats and game save schema are unchanged.

## Failure Semantics

| Failure point | Visible profile | Tombstone | Cleanup behavior |
| --- | --- | --- | --- |
| Before tombstone commit | unchanged | absent | operation fails with no destructive change |
| After tombstone, before IndexedDB delete | hidden | retained | retry deletes both stores |
| After IndexedDB delete, before local cleanup | hidden | retained | retry sees IndexedDB already clean and removes local keys |
| Local removal/readback failure | hidden | retained | report cleanup pending and retry later |
| Final registry write failure | hidden | retained | stores remain clean; retry finalization |
| Another tab finishes first | hidden | absent | verify remote completion and return success |

No failure path rolls a tombstoned profile back into the visible registry.

## Testing

Tests must cover real storage implementations where applicable and use deterministic deferred boundaries:

- version-1 to version-2 migration and strict version-2 parsing;
- atomic tombstone commit and immediate provider eviction;
- crash/reload after every state-machine boundary;
- continuous foreign metadata-lock contention returns bounded cleanup-pending rather than spinning;
- cancellation after tombstone and after IndexedDB commit;
- initiating-tab death and startup resumption;
- late writer takeover attempts and protected deletion-lease behavior;
- IndexedDB transaction failure, local `removeItem` exception, and key reappearance after removal;
- accurate cleanup counts and user-facing failure classification;
- other-profile head/checkpoint/metadata/local-key isolation;
- idempotent duplicate cleanup and remote completion;
- registry backup repair preserving tombstones;
- reconstruction refusing to resurrect tombstoned IDs;
- future-version metadata causing zero registry or journal writes;
- UI cleanup-pending warning, Retry locking, stale completion suppression, and accessibility.

The final candidate must pass focused suites, typecheck, `npm run release:verify`, a separate production build, and Chromium flows for deletion pending/retry and ordinary crash recovery.

## Current `main` Integration

After the tombstone implementation is complete and independently reviewed:

1. fetch and integrate current `origin/main` into the feature branch;
2. resolve overlapping changelog, pending-save, and storage-recovery changes by preserving both current-main behavior and this design's invariants;
3. rerun focused tests, typecheck, the complete release gate, standalone build, and browser verification on the integrated commit;
4. obtain a fresh Sol read-only review of the integrated diff;
5. prepare one pull request against `main`; do not cherry-pick partial crash-safe-save commits.

## Release Gate

The branch is PR-ready only when:

- no profile-deletion intent can be lost before cleanup completes;
- no deleted profile can become visible or writable during retry;
- cleanup attempts are bounded and resumable;
- target data removal is verified and failures are truthful;
- other profiles remain unchanged;
- current `main` is integrated with no unresolved drift;
- all automated and Chromium gates pass on the exact PR head.
