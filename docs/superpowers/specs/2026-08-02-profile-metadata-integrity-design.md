# Profile Metadata Integrity Design

**Date:** 2026-08-02
**Status:** Approved design
**Scope:** Validate, recover, and coordinate the browser profile registry

## Summary

Fate Locked will treat `FATE_PROFILES` as a versioned, strictly validated
record and will serialize every profile-list mutation through a short-lived
cross-tab transaction lock. Each mutation rereads the newest durable registry,
applies one operation, preserves the previous valid registry as a backup, and
verifies the result before updating React state.

If the primary registry is malformed, startup will recover from a validated
backup. If both metadata copies are unusable, it will discover exact underlying
profile save keys, validate each run through the existing save parser, and
rebuild entries up to a bounded 100-profile recovery ceiling. Additional valid
runs remain untouched and are reported. Original names and creation dates are
retained when their individual fields are safe; otherwise the run receives a
deterministic `Recovered Profile N` label.

This is the third deployable remediation from the project audit. It builds on
save-write recovery and per-profile writer ownership. It does not change the
game save schema, merge divergent runs, or move persistence away from browser
storage.

## Current Failure Modes

`ProfileProvider` currently accepts any JSON value from `FATE_PROFILES` and
assumes it has a usable `profiles` array and `activeProfileId`. Syntactically
valid but structurally invalid metadata can therefore break startup or profile
rendering.

Each tab also keeps an independent cached copy of the whole registry.
`createProfile`, `switchProfile`, `renameProfile`, and `deleteProfile` derive a
replacement from that cached object and overwrite the full storage value. Two
tabs can consequently lose each other's changes even though each individual
write succeeds. The synchronous in-tab transaction helper prevents stale
same-tick React updates, but it cannot coordinate separate documents.

Deletion is more dangerous than an ordinary lost update because it removes the
profile save and sidecars before committing the replacement registry. Existing
rollback behavior protects a failed metadata write in one tab, but it cannot
prevent a different tab from concurrently rewriting the registry or continuing
to use a profile that was removed underneath it.

## Goals

- Reject malformed, duplicate, oversized, and unsupported profile metadata.
- Preserve every valid underlying run up to the recovery ceiling, leaving and
  reporting any excess rather than deleting it.
- Restore the last known good registry before reconstructing generic entries.
- Prevent concurrent profile operations from silently overwriting one another.
- Apply the ten-profile limit to the newest durable registry inside the
  transaction.
- Synchronize profile additions, renames, and deletions across open tabs.
- Keep each tab on its current profile when another tab merely changes its own
  active selection.
- Prevent deletion of a profile that is actively open under an unexpired game
  writer lease.
- Preserve existing profile IDs, game save keys, exports, backups, and normal
  single-tab behavior.
- Fail closed when storage or transaction ownership cannot be verified.

## Non-goals

- Merging divergent game histories or pending game snapshots.
- Synchronizing profile metadata between devices.
- Replacing `localStorage` with IndexedDB or server persistence.
- Recovering a game save that fails the existing strict save parser.
- Adding profile cloud accounts, authentication, or encryption.
- Keeping an unlimited history of metadata revisions.
- Allowing deletion of an actively open profile through a cross-tab handoff.
- Changing the RuneLite relay or game-state writer lease protocol.

## Persisted Metadata Schema

The primary and backup records use one strict schema:

```ts
interface ProfileMetadataV1 {
  version: 1;
  revision: number;
  profiles: Profile[];
  activeProfileId: string;
}
```

`revision` is a non-negative safe integer and increases by exactly one for each
committed mutation or durable repair. A profile entry remains:

```ts
interface Profile {
  id: string;
  name: string;
  createdAt: number;
}
```

Validation requires:

- an exact supported metadata version;
- one to 100 profiles as a corruption-recovery safety ceiling;
- unique, storage-safe profile IDs;
- non-empty names no longer than the existing 30-character UI limit after
  normalization;
- finite, non-negative creation timestamps;
- an `activeProfileId` present in the profile list; and
- no unknown values that could change key construction or object semantics.

Ordinary profile creation still stops at ten profiles. The larger parser
ceiling exists only so recovery can surface valid orphaned runs instead of
discarding everything beyond the normal UI limit. If more than 100 exact,
valid base saves exist, the first 100 in stable key order are recovered and the
remainder stay untouched and are reported.

The parser accepts the current unversioned `{ profiles, activeProfileId }`
shape only as a legacy input. A valid legacy record normalizes to version 1 at
revision 0 and is durably migrated through the same repair transaction. A
record with a future version is unsupported rather than corrupt and is never
silently downgraded.

Application code consumes only parsed `ProfileMetadataV1`; direct
`JSON.parse(localStorage.getItem('FATE_PROFILES'))` calls are not allowed.

## Supporting Storage Records

Three sibling keys support the registry:

```text
FATE_PROFILES__backup
FATE_PROFILES__lock
FATE_PROFILES__recovery
```

`FATE_PROFILES__backup` contains the last validated registry that existed
before the newest successful primary replacement. It uses the same schema and
parser as the primary.

`FATE_PROFILES__lock` is a short-lived transaction record:

```ts
interface ProfileMetadataLockV1 {
  version: 1;
  ownerId: string;
  expiresAt: number;
}
```

The random page-lifetime owner ID is browser coordination metadata, not
authentication, and is never exported. The lock lifetime is long enough to
complete one bounded localStorage transaction but short enough to recover
quickly from a closed or crashed tab.

`FATE_PROFILES__recovery` is a single rotating recovery envelope containing
the exact unreadable primary and backup strings plus the capture time. The
envelope must be written before automatic repair overwrites corrupt metadata.
It never contains game save bodies. A new recovery replaces the previous
envelope so corruption cannot create unbounded storage growth.

If the recovery envelope cannot be written, reconstructed metadata may be used
in memory so valid runs remain accessible, but durable profile mutations stay
disabled and the corrupt source is not overwritten.

## Strict Parsing and Recovery Order

Startup resolves metadata in this order:

1. Read and strictly parse the primary registry.
2. If primary is valid, use it. Normalize and migrate a valid legacy record
   through the repair transaction.
3. If primary has an unsupported future version, do not replace it. Resolve a
   supported backup or exact underlying saves for in-memory, read-only access,
   display a persistent compatibility notice, and disable metadata mutations
   until a compatible app version is used.
4. If primary is corrupt, strictly parse the backup. An unsupported future
   backup also enters the same read-only compatibility state rather than being
   downgraded.
5. If backup is valid, archive the unreadable primary, write a new revision of
   the backup to primary, verify it, and use it.
6. If neither metadata copy is usable, archive both raw values before any
   replacement.
7. Enumerate localStorage and match only exact base keys of the form supported
   by `profileBaseKey`; keys with registered sidecar suffixes or misleading
   prefixes are excluded.
8. Parse each candidate game save through the existing strict save boundary.
   Invalid saves stay untouched and are counted in the recovery notice.
9. Build one profile entry per valid run, up to the 100-profile recovery
   ceiling. Safely parse individual legacy metadata entries to recover a
   matching name or creation date without trusting the surrounding object.
   Missing names become deterministic, unique `Recovered Profile N` labels.
   Missing timestamps use the recovery time.
10. Preserve a valid previous active ID when its run was recovered; otherwise
   select the first recovered entry in stable key order.
11. If no valid profile save is recoverable, migrate the legacy single-save
    key when valid or create a fresh `Main Account` as today.
12. Validate the complete reconstructed registry, write it as a new primary
    revision, read it back, and only then expose it as durable React state.

Recovery never deletes invalid metadata, unreadable game saves, legacy saves,
or sidecars. Cleanup is a separate explicit maintenance decision.

## Short-Lived Transaction Lock

Every create, rename, switch, delete, migration, or repair runs through one
asynchronous metadata transaction coordinator.

Lock acquisition:

1. Read and parse the lock immediately before attempting a claim.
2. Wait while an unexpired foreign claim exists.
3. For an absent, expired, or malformed claim, reread once immediately before
   writing this tab's claim.
4. Write the claim, read it back, wait through a short arbitration interval,
   and verify the matching owner again.
5. Retry contention with a bounded delay. If the deadline expires, return a
   typed `busy` result without changing metadata.

The coordinator verifies the matching, unexpired lock again immediately before
backup and primary writes. Release removes the lock only when the stored owner
still matches. Correctness does not depend on release because expiry always
permits recovery.

Once locked, the coordinator:

1. Rereads and resolves the newest metadata through the strict parser and
   recovery policy.
2. Applies one typed operation to that latest registry.
3. Validates the candidate replacement.
4. Writes the previous valid registry to the backup key and verifies it.
5. Writes the candidate to the primary with `revision + 1` and reads it back.
6. Compares the verified value with the exact candidate before committing
   local state.
7. Releases the lock in `finally`.

An old client that ignores the lock may still overwrite metadata. Exact
read-back verification detects that loss during the transaction. The current
operation then retries against the newest valid revision when doing so is
safe; it never reports success for a value that is no longer stored.

## Typed Profile Operations

The coordinator exposes operations rather than accepting an arbitrary whole
object updater:

- `create(name, id, createdAt)` checks the latest profile count and ID
  uniqueness, adds the entry, and selects it only in the initiating tab.
- `rename(id, name)` updates the matching latest entry. An already-removed ID
  returns `not_found` without rewriting metadata.
- `select(id)` persists the most recently selected profile for future page
  loads, but other live tabs keep their own valid local selection.
- `delete(id)` rejects the last profile, an absent profile, and any profile
  with an unexpired game writer lease. If the deleted ID is the registry's
  persisted `activeProfileId` but has no live writer, the transaction selects
  a deterministic remaining replacement. It snapshots registered sidecars,
  verifies the metadata backup, removes the exact registered keys, commits the
  registry, and restores removed values if the primary write or verification
  fails.

Profile IDs and timestamps are generated once before a retried create so one
user action cannot produce duplicate profiles. Name sanitization remains at
the UI boundary and is repeated by the transaction validator.

Results distinguish at least:

```ts
type ProfileMutationFailure =
  | 'busy'
  | 'storage_unavailable'
  | 'unsupported_metadata'
  | 'invalid_metadata'
  | 'backup_failed'
  | 'verification_failed'
  | 'max_profiles'
  | 'not_found'
  | 'last_profile'
  | 'profile_in_use';
```

No failure path updates React state as though the operation succeeded.

## Cross-Tab Synchronization

`ProfileProvider` listens only for storage events on `FATE_PROFILES` and the
metadata lock. A valid newer primary event updates the visible profile list.
Malformed or unsupported incoming metadata is ignored and surfaces the
recovery warning; it is never installed into React state.

Incoming list changes merge with each tab's local selection policy:

- If the tab's selected profile still exists, it stays selected even when the
  incoming `activeProfileId` differs.
- A newly created or renamed profile appears without remounting the current
  `GameProvider`.
- A normally coordinated deletion cannot remove a profile with a live writer
  lease, so a profile actively open in another current client is protected.
- If metadata from an older client, manual edit, or expired-owner deletion no
  longer contains the selected ID, the tab stages its newest game snapshot,
  fails closed on further writes, displays a clear notice, and switches to the
  incoming valid active profile or first remaining profile. This is a fallback
  boundary, not the ordinary deletion path.

The initiating tab updates its own local selection after verified success
because same-document localStorage writes do not emit a storage event.
`recentlyCreatedId` remains local to the creating tab so another tab never
opens the game-mode prompt for a profile it did not create.

## User Experience

Profile menu actions show a small pending state and disable duplicate
submissions until the transaction settles.

User-facing outcomes are specific and actionable:

- Busy: another tab is updating profiles; retry shortly.
- Profile in use: switch that profile away in every open tab, then delete it.
- Storage or backup failure: the profile list is unchanged.
- Already removed: refreshes to the latest list without pretending the action
  succeeded.
- Recovery success: states how many profiles were restored and whether names
  had to be reconstructed.
- Partial recovery: states how many unreadable saved runs were left untouched.
- In-memory-only recovery: explains that runs are accessible but profile-list
  changes cannot be saved until browser storage is available.

Recovery feedback is persistent until acknowledged rather than a short toast
when unreadable data remains or durable repair failed. Routine contention and
successful mutations continue using concise inline or toast feedback.

Deletion of the currently selected profile is disabled. The player first
switches to another profile, which releases the selected profile's game writer
lease after its pending save is flushed. This makes deletion intent explicit
and prevents the profile menu from destroying the mounted run.

## Components and Responsibilities

### `utils/profileMetadata.ts`

Owns schema constants, strict parsing, legacy normalization, profile ID/name
validation, exact base-key discovery, safe field salvage, recovery planning,
and recovery notice data. It has no React state or timers.

### `utils/profileMetadataTransaction.ts`

Owns lock parsing, acquisition, arbitration, retry deadline, verified release,
backup/primary commit ordering, typed mutations, and delete rollback. Storage,
clock, timers, ID generation, and game-save validation are injectable for
deterministic tests.

### `ProfileProvider`

Initializes from the recovery result, owns the page transaction client, listens
for relevant storage events, merges incoming registries with the local
selection policy, and exposes asynchronous typed profile actions plus pending
state and recovery feedback.

### `ProfileSwitcher`

Renders pending/disabled actions, keeps forms open when a mutation fails,
disables deletion of the selected profile, and shows targeted messages without
duplicating storage policy.

### Recovery banner

A focused accessible banner presents durable-repair and partial-recovery
notices. It does not expose raw storage keys or corrupt content. Routine
successful legacy migration remains silent.

## Error and Boundary Behavior

- Unsupported future metadata is archived and reported, never downgraded.
- A malformed lock may be replaced; an unexpired valid foreign lock may not.
- Storage read failure fails closed before any mutation.
- Backup write or verification failure prevents the primary replacement.
- Primary write or verification failure returns the prior registry and
  restores deletion snapshots where possible.
- Rollback failure reports exactly how many profile-owned entries could not be
  restored without exposing stored values.
- Retried operations are applied to the newest validated revision.
- Duplicate creates reuse their pre-generated ID and become idempotent.
- Incoming storage events never install invalid metadata.
- The profile count limit is enforced after recovery and against the locked,
  newest registry.
- Exact base-key discovery never treats backups, writer leases, feature flags,
  Discord settings, or misleading prefixes as game saves.
- Recovery parsing has deterministic ordering and bounded work for browser
  storage.

## Testing Strategy

Implementation follows red-green-refactor. Each production behavior begins
with a failing test.

### Parser and recovery unit tests

- Current and legacy valid records parse and normalize.
- Invalid JSON, wrong roots, missing fields, empty/oversized arrays, duplicate
  IDs, unsafe IDs, invalid names/timestamps, invalid active IDs, revisions,
  and unsupported versions are rejected with typed reasons.
- Valid primary wins; valid backup repairs invalid primary.
- Dual metadata failure discovers only exact base keys.
- Valid game saves become recovered profiles in stable order.
- Safe names and timestamps are salvaged independently from malformed
  metadata.
- Unreadable runs remain untouched and appear in the notice count.
- A non-empty recovered set never falls back to legacy migration or a fresh
  Main Account; valid overflow remains untouched and appears in the notice.
- Recovery archive failure prevents durable overwrite but still exposes valid
  recovered runs in memory.

### Transaction unit tests

- Absent and expired locks are claimed; unexpired foreign locks block.
- Simultaneous empty-lock claims leave one arbitrated owner.
- Contention retries are bounded and lock release is owner-checked.
- Every operation rereads the newest revision after locking.
- Backup precedes primary, both are verified, and revision increments once.
- Create enforces the latest ten-profile limit and stays idempotent on retry.
- Rename/select/delete against a removed ID return typed safe failures.
- The UI rejects deletion of its locally selected profile; the transaction
  rejects the last profile and every profile with a live game-writer lease.
- Delete rollback restores exact registered sidecars after commit failure.
- Storage, backup, verification, and rollback failures leave accurate results.

### Provider and UI tests

- Initialization never renders structurally invalid metadata.
- Storage events add and rename profiles without changing a still-valid local
  selection or remounting its game provider.
- Remote active selection does not force a local switch.
- Incoming removal fallback switches safely and reports the event.
- The creating tab alone receives `recentlyCreatedId`.
- Pending actions prevent duplicate clicks and preserve form input on failure.
- Active and foreign-in-use profiles cannot be deleted.
- Recovery notices have accessible semantics and accurate counts.

### Integration and regression tests

- Two tabs concurrently create distinct profiles without loss.
- Concurrent rename and create preserve both operations.
- Concurrent select operations keep each live tab local while persisting a
  valid last-active profile.
- Delete and rename/create contention never resurrects or loses profiles.
- A crashed lock holder becomes recoverable after expiry.
- Existing profile save ownership, pending-save recovery, import/export,
  backup restore, reset, legacy migration, onboarding, and single-tab flows
  retain their current behavior.
- A real two-tab browser walkthrough covers create, rename, synchronization,
  contention, in-use deletion protection, and lock expiry.
- The complete Vitest suite, type checking, changelog verification, content
  checks, and GitHub Pages production build pass.

## Acceptance Criteria

- Syntactically valid but malformed `FATE_PROFILES` data cannot crash profile
  startup or enter React state.
- Every valid underlying profile save up to the recovery ceiling remains
  accessible after dual metadata corruption.
- Original safe profile details are retained when recoverable; generated names
  are deterministic and clearly marked.
- Two current tabs cannot silently lose a create, rename, switch, or delete
  operation through stale whole-object writes.
- Every successful mutation is based on and increments the newest validated
  durable revision.
- The previous valid registry is verified in backup before primary
  replacement.
- A closed or crashed transaction holder cannot permanently block profile
  management.
- Another tab's profile switch does not force the current tab away from its
  still-existing selection.
- An actively open profile cannot be deleted until its game writer lease is
  released or expires.
- Storage and verification failures leave the visible list consistent with
  durable metadata and provide actionable feedback.
- Existing game saves require no migration and normal single-tab profile use
  remains functionally unchanged apart from brief pending feedback.
- No merge, push, or live deployment occurs until implementation and browser
  verification have been reviewed with the user.
