# Cross-Tab Save Ownership Design

**Date:** 2026-08-01
**Status:** Approved design
**Scope:** Prevent simultaneous browser tabs from silently overwriting the same profile

## Summary

Fate Locked will assign one browser tab at a time as the writer for each
profile. A second tab may remain fully usable, but it cannot write profile
state until the player explicitly takes ownership. Its newest in-memory state
stays staged through the save-write recovery system and can be exported.

This is the second deployable remediation from the project audit. It builds on
the page-lifetime pending-save registry introduced by the save-write recovery
milestone. It does not merge divergent runs, change the save-file schema, or
repair corrupt profile metadata.

## Goals

- Prevent an older or divergent tab from silently overwriting stored progress.
- Keep a non-owning tab usable so its state can be inspected and exported.
- Retain the newest non-owning-tab snapshot in memory without writing it.
- Make ownership loss visible and persistent until the conflict is resolved.
- Let the player deliberately take over or discard the local tab state and
  reload the latest stored save.
- Recover after an owning tab closes or crashes without permanent stale locks.
- Apply the ownership rule to every write of profile game state.
- Preserve existing save files, profile IDs, and successful single-tab use.

## Non-goals

- Automatically merging actions, rolls, histories, or unlocks from divergent
  tabs.
- Synchronizing browser storage across devices.
- Replacing `localStorage` with IndexedDB or a server-side store.
- Repairing malformed `FATE_PROFILES` metadata or coordinating concurrent
  profile-list edits. That remains the next separate remediation.
- Changing the online relay protocol or RuneLite event ordering.
- Encrypting browser storage or adding user authentication.

## Why Ownership Instead of Merging

Game state contains RNG outcomes, chained history hashes, monotonic run
revisions, currencies, and unlock decisions. Two divergent states cannot be
combined field by field without inventing an ordering or duplicating rewards.
Revision checks alone also leave a narrow read-then-write race when two tabs
save at nearly the same time.

A renewable writer lease makes the rule explicit: one tab may write and every
other tab must preserve its state without touching durable profile storage.
The player resolves divergence deliberately.

## Ownership Record

Each profile has a sibling ownership key derived from its existing storage key:

```text
FATE_PROFILE_<profile-id>__writer
```

The value is a small versioned JSON record:

```ts
type ProfileWriterLease = {
  version: 1;
  ownerId: string;
  expiresAt: number;
};
```

`ownerId` is a random page-lifetime identifier generated with
`crypto.randomUUID()` and never included in exports, telemetry, logs, profile
metadata, or game state. The identifier is not authentication; it exists only
to distinguish open tabs in the same browser origin.

The lease is renewed every 10 seconds and expires 30 seconds after its most
recent successful claim or renewal. A tab also rechecks ownership when it
becomes visible and immediately before every profile-state write. Background
timer throttling therefore cannot authorize an obsolete writer: if another tab
claimed the expired lease, the returning tab sees the different `ownerId` and
pauses before writing.

An absent, expired, structurally invalid, or unsupported-version record may be
replaced by a new claim. An unexpired foreign record may not be replaced except
through the player's explicit takeover action.

## Claim and Arbitration

On `GameProvider` mount, the tab attempts to claim the active profile:

1. Read and parse the ownership record.
2. If an unexpired foreign owner exists, enter `blocked` state without writing.
3. Otherwise write this tab's lease.
4. Read the record back and verify that the owner ID still matches.
5. Recheck once after a short arbitration interval before enabling writes.

The ordinary save debounce is longer than the arbitration interval, and every
flush performs another owner-ID check. If two tabs start against an empty key,
the last verified lease becomes authoritative and the loser pauses before its
debounced game-state write.

The coordinator listens for the browser `storage` event on the active writer
key. A foreign claim changes the current tab to `blocked` immediately. Because
same-document storage writes do not produce a `storage` event, claim, renewal,
takeover, and release update local ownership state directly as well.

## Ownership States

The game context exposes a separate ownership state rather than treating a
conflict as a browser-storage failure:

```ts
type SaveOwnershipStatus = 'checking' | 'owner' | 'blocked';
type SaveOwnershipBlockReason = 'foreign_owner' | 'storage_unavailable' | null;
```

- `checking`: acquisition or revalidation is in progress; no profile-state
  write is allowed.
- `owner`: this tab may write after one final synchronous lease check.
- `blocked`: profile-state writes are paused. `foreign_owner` means another
  tab owns the lease; `storage_unavailable` means the browser could not safely
  read or write ownership metadata.

The existing `SaveStatus` continues to describe pending and failed storage
writes. Foreign ownership does not masquerade as a quota error. Ownership
storage failure sets the existing failed-save state and uses its recovery
warning instead of falsely claiming that another tab is open. Every blocked
tab's newest serialized state remains in the pending-save registry so the
global unload guard continues to protect it.

## Save Pipeline Integration

Every durable write of profile game state must pass through the ownership
coordinator. This includes:

- ordinary debounced saves;
- teardown flushes during profile switches;
- manual retry after a storage failure;
- imports and backup restores;
- resets when their resulting state is persisted; and
- automatic or manual backup-ring writes derived from the profile.

Before each write, the coordinator reads the lease and verifies an unexpired
matching owner ID. If verification fails, it returns a typed ownership-conflict
result without calling `localStorage.setItem` for game state or backups.

Normal reducer actions remain available in a blocked tab. Each state change
replaces that tab's pending snapshot with the newest serialized state. There is
never a queue of stale states and no automatic retry occurs while ownership is
blocked.

Single-tab startup remains unchanged after the brief ownership check. Existing
saves are parsed and migrated through the current strict save boundary. The
writer lease is browser metadata and does not change `GameState.version` or the
`.fate` export format.

## Player Experience

An active profile blocked by a `foreign_owner` displays a persistent warning
directly below the header:

> **This profile is open in another tab**
> Changes in this tab are not being saved. Choose which tab should keep the
> profile before continuing.

The tab remains interactive and provides three actions:

### Take over and save this tab

The player must confirm that taking over may replace progress saved by the
other tab. After confirmation, the tab writes and verifies its lease, waits for
arbitration, then flushes its newest pending snapshot. The old owner receives
the writer-key storage event and becomes blocked. If acquisition or the flush
fails, the current tab stays blocked and retains its pending data.

### Discard this tab and reload latest

If the tab has a pending snapshot, the player must confirm that its local
changes will be discarded. The action reads the stored profile, validates it
with the strict save parser, replaces the reducer state only after validation,
and clears this tab's pending snapshot. It does not steal ownership. Invalid or
unreadable stored data leaves the current state untouched and displays a safe
error.

### Export backup

Export uses the current in-memory state through the shared `.fate` download
operation. Export never changes ownership, clears pending state, or claims that
browser persistence recovered.

The warning uses `role="alert"`, provides named buttons, exposes acquisition
progress to assistive technology, and cannot be dismissed while the tab is
blocked.

## Profile Switching and Lifecycle

When leaving a profile, an owning tab first attempts the existing immediate
flush. It releases the lease only after no pending snapshot remains. A blocked
or failed tab keeps its pending snapshot in memory and never removes another
tab's lease.

On `pagehide` or clean teardown, the owner makes a best-effort release only if
the stored owner ID still matches. Correctness never depends on release because
the lease expires automatically. A crash, terminated browser, or unavailable
storage can therefore delay automatic acquisition for at most 30 seconds; the
player may still use the explicit takeover action sooner.

The writer key is added to `profileOwnedKeys`. Successful profile deletion
removes it with the profile's other browser records. Failed deletion keeps the
existing transactional and recovery behaviour.

## Error and Boundary Behaviour

- A tab never writes profile state while ownership is `checking` or `blocked`.
- A failed claim, renewal, or verification fails closed and preserves the
  newest pending snapshot.
- A malformed writer record is treated as stale metadata, not as game data.
- Only the matching owner may renew or release an unexpired lease.
- A storage event for an unrelated profile does not affect the active profile.
- Repeated foreign events do not create repeated toasts or duplicate timers.
- A forced takeover does not delete or merge the other tab's in-memory state.
- Reload-latest is transactional: parse or storage failure leaves the current
  tab unchanged.
- Import and restore return a specific ownership-conflict result while blocked
  instead of reporting success or overwriting storage.
- Storage quota and unavailable-storage errors continue through the existing
  save-failure recovery path after ownership has been verified.
- Profile metadata concurrency and corruption remain outside this milestone.

## Components and Responsibilities

### `utils/profileWriterLease.ts`

Owns writer-key construction, strict lease parsing, claim, verification,
renewal, release, and takeover operations. Operations accept storage and clock
dependencies so expiry and failures are deterministic in unit tests. The
module contains no React state, game rules, or UI copy.

### `hooks/useProfileWriterLease.ts`

Owns the page ID, acquisition arbitration, heartbeat, visibility recheck, and
storage-event subscription. It exposes ownership status, the typed block reason,
and explicit takeover to `GameProvider`. It creates one timer and one storage
listener per mounted active profile and cleans both up on unmount.

### Pending-save registry

Extends its failure reason to distinguish `storage_unavailable` from
`ownership_conflict`. It continues retaining only the newest snapshot per
profile and driving the existing unload guard.

### `GameProvider`

Stages current state as it does today, but routes all durable profile writes
through verified ownership. It exposes ownership status, the typed block
reason, takeover, reload-latest, and whether this tab has pending changes.
Explicit replacement operations return an ownership-conflict result without
modifying storage or React state.

### Conflict banner

A new focused component renders the conflict copy and actions. The existing
storage-failure banner remains responsible only for unavailable browser
storage, keeping the two recovery paths understandable and independently
testable.

## Testing Strategy

Implementation follows red-green-refactor. Each production behaviour is first
demonstrated by a failing test.

### Lease unit tests

- A tab claims an absent or expired lease and verifies ownership.
- An unexpired foreign lease blocks an ordinary claim.
- Only the owner can renew or release a lease.
- Forced takeover replaces a foreign lease.
- Malformed and unsupported records are treated as stale.
- Storage read and write failures return typed safe failures without throwing.
- Simultaneous claim ordering leaves one verified owner.

### Hook lifecycle tests

- Acquisition remains `checking` until arbitration completes.
- Heartbeats renew only while this tab owns the active profile.
- Foreign storage events transition the tab to `blocked`.
- Visibility changes recheck ownership before allowing writes.
- Profile switches clean up timers and listeners without releasing a foreign
  lease.
- Teardown releases only a matching owned lease when no pending data remains.

### Provider and persistence tests

- A blocked normal save never calls the profile-state writer.
- Multiple blocked-tab changes retain only the newest pending snapshot.
- Losing ownership before a debounce fires prevents the queued write.
- Manual save retry remains blocked until ownership is acquired.
- Import, restore, reset persistence, and backups cannot bypass ownership.
- Confirmed takeover flushes the newest local state after verification.
- Reload-latest validates and replaces state transactionally, then clears the
  discarded pending snapshot.
- Existing storage-unavailable recovery continues to work for the owner.

### UI and real-browser tests

- The conflict warning has accessible alert semantics and all three actions.
- Takeover and discard actions require confirmation when data may be replaced.
- Buttons expose progress and prevent duplicate submissions.
- Export preserves the warning and ownership state.
- Two real same-origin tabs demonstrate: first-tab ownership, second-tab
  blocking, takeover notification, old-tab blocking, reload-latest, and crash
  expiry recovery.

### Full regression checks

- The complete Vitest suite passes.
- Type checking passes.
- The GitHub Pages production build succeeds with
  `VITE_BASE=/OSRS-Fate-Locked/`.
- Existing save import, restore, reset, backup, profile, onboarding, and
  single-tab flows retain their current behaviour.

## Acceptance Criteria

- Two tabs cannot both complete an ordinary profile-state write while each
  believes it owns the same unexpired lease.
- The second tab visibly enters blocked state and does not alter the stored
  profile.
- Changes made while blocked remain available in that tab and in its emergency
  export.
- A confirmed takeover transfers ownership, saves the newest local state, and
  blocks the previous owner before its next write.
- Reload-latest never replaces in-memory state unless the stored save validates.
- Import, restore, reset persistence, teardown flushes, and backups cannot
  bypass ownership.
- Closing or crashing the owner cannot create a permanent lock.
- Existing save files require no migration and single-tab play remains
  functionally unchanged.
- No merge, push, or live deployment occurs until the completed implementation
  and verification results have been reviewed with the user.
