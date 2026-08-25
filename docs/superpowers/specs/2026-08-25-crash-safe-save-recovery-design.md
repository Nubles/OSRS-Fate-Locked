# Crash-Safe Save Recovery

**Date:** 2026-08-25

**Status:** Approved conversational design, awaiting written specification review

## Goal

Prevent a browser storage failure, abrupt power loss, or corrupt primary save
from costing a player hours of Fate Locked progress.

The app will keep its current browser-only and encrypted-export model, but add a
transactional IndexedDB recovery journal beside the existing `localStorage`
save. Startup will select the newest valid durable revision without ever
silently overwriting corrupt evidence with a fresh run.

## Confirmed Failure Model

The current game state is staged in memory and normally flushed to
`localStorage` after 500 milliseconds. A clean browser close also attempts a
synchronous flush. A power cut alone should therefore lose only the newest
fraction of a second when storage is healthy.

Losing hours indicates a longer-lived failure:

- `localStorage` had stopped accepting writes because it was full or
  unavailable, leaving the newest state only in the open tab;
- the primary save became invalid and startup replaced the player experience
  with a fresh in-memory run; or
- the browser's site-data store was damaged or cleared, affecting both the
  primary save and the existing backup ring.

The existing backup ring reduces mistakes around imports and resets and stores
one session-start snapshot. It does not provide a transactional latest-state
journal, timed checkpoints, or an independent storage engine. Its snapshots
also count against the small `localStorage` quota.

## Product Decision

Use **IndexedDB as a transactional recovery journal while retaining
`localStorage` as a compatibility mirror**.

Rejected alternatives are:

- hardening `localStorage` alone, because the primary and every snapshot would
  still share one quota and one failure domain; and
- immediately making IndexedDB the only canonical store, because that would
  increase migration and rollback risk without improving the first release's
  recovery guarantees.

The journal is local recovery, not off-device backup. Encrypted `.fate` export
remains the protection against complete browser-profile, disk, or device loss.

## Scope

This change covers:

- transactional latest-state recovery records in IndexedDB;
- bounded immutable checkpoints for each profile;
- checksums and existing save-schema validation on every recovery candidate;
- startup arbitration between the pending in-memory state, `localStorage`, the
  journal head, and checkpoints;
- a blocking recovery decision before any fresh or replacement save can write;
- distinct primary-save and recovery-protection statuses;
- full-storage recovery for both storage systems;
- one-time import of usable existing local backup-ring entries;
- best-effort persistent-storage permission; and
- focused unit, integration, migration, failure-injection, and browser tests.

## Non-goals

- Adding accounts, authentication, a backend, telemetry, or automatic cloud
  backup.
- Uploading unencrypted player state.
- Changing game rules, RNG ordering, history semantics, run identity, or save
  schema fields.
- Making RuneProof preview state canonical.
- Removing encrypted `.fate` import or export.
- Guaranteeing recovery after the user clears site data, deletes the browser
  profile, loses the disk, or moves to another origin.
- Relying on `beforeunload`, `pagehide`, or an asynchronous write that begins
  only while the page is closing as the main durability mechanism.

## Durability Contract

### Normal saving

Each state transition continues to update the in-memory state immediately.
After the existing 500-millisecond debounce, one save coordinator serializes
the newest state and assigns an internal monotonic persistence revision.

The coordinator performs this order:

1. validate the serialized state with the existing save schema;
2. calculate its SHA-256 checksum;
3. transactionally write and read back the IndexedDB journal head;
4. synchronously mirror the identical bytes to `localStorage` and read them
   back; and
5. report the outcome of the primary mirror and recovery journal separately.

The IndexedDB transaction is considered committed only after its completion
event. A request success event alone is not durable proof. `localStorage` is
considered mirrored only when readback exactly matches the input bytes.

Only one flush may be in flight for a profile. If more state arrives during a
flush, the coordinator retains only the newest staged snapshot and immediately
runs one further flush after the current operation settles. It never allows an
older asynchronous completion to replace a newer revision.

### Page lifecycle

The existing synchronous `pagehide` and provider-teardown mirror remains as a
last chance to save a same-batch state to `localStorage`. It does not release
writer ownership if the final synchronous mirror fails.

The app does not wait for a new IndexedDB transaction during unload. Normal
debounced journal writes provide recovery durability during the session; the
next startup imports a newer valid `localStorage` mirror into the journal when
the final lifecycle mirror was the newest write.

The unavoidable healthy-storage power-loss window remains at most the debounce
interval plus an in-flight journal transaction. A successful journal commit is
recoverable even if power fails before the `localStorage` mirror.

### Writer ownership

The existing per-profile writer lease remains authoritative. The same
authorization check gates journal writes, checkpoint creation, mirror writes,
restoration, migration, pruning, and recovery confirmation.

Every asynchronous boundary rechecks ownership before performing another
mutation. Losing the lease cannot cause an old tab to publish a journal head or
checkpoint over the current owner.

## Recovery Database

Use a versioned database named `fate-locked-recovery-v1` with two stores.

### `heads`

One replaceable latest record per profile:

```ts
interface RecoveryHead {
  profileId: string;
  persistenceRevision: number;
  runId: string;
  runRevision: number;
  capturedAt: number;
  checksum: string;
  data: string;
}
```

### `checkpoints`

Immutable checkpoint records keyed by profile and persistence revision:

```ts
interface RecoveryCheckpoint extends RecoveryHead {
  reason: 'interval' | 'session-start' | 'pre-replacement' | 'legacy-import';
}
```

The persisted game JSON remains byte-for-byte compatible with current exports.
Journal metadata is not inserted into `GameState`, so loading an old save does
not require a save-schema migration.

The persistence revision belongs only to the recovery layer. It is monotonic
per profile and distinguishes settings or notes changes that may not correspond
to a gameplay history event. The stored `runId` and `runRevision` remain useful
cross-checks and prevent a snapshot from one run being attached to another.

### Mirror metadata

Because the compatible `GameState` JSON does not contain the recovery-layer
revision, each profile also receives a small `localStorage` sidecar at
`<profile-key>__mirrorMeta`:

```ts
interface MirrorMetadata {
  version: 1;
  persistenceRevision: number;
  capturedAt: number;
  checksum: string;
}
```

Normal mirroring writes the primary bytes first and the sidecar second. Startup
never trusts the sidecar without checking that its checksum matches the primary
bytes. The sidecar is included in profile-owned cleanup and must never be
mistaken for a base profile during metadata reconstruction.

## Checkpoint Policy

The journal head is replaced after every successful flush. An immutable
checkpoint is added only when the state changed and at least five minutes have
elapsed since the newest interval checkpoint.

Retention is bounded per profile:

- the six newest interval checkpoints, covering roughly the latest 30 minutes;
- the newest checkpoint from each of the previous seven local calendar days;
- the four newest pre-replacement checkpoints; and
- at most eight imported legacy backup entries until normal pruning absorbs
  them into the same limits.

A single record may satisfy more than one retention bucket. Pruning calculates
the keep set first and deletes everything else in one transaction. It never
deletes the current journal head.

When IndexedDB reports quota exhaustion, the coordinator prunes non-protected
old checkpoints and retries the head write once. It does not delete the latest
head, today's newest checkpoint, or the only valid candidate. A second failure
marks recovery protection unavailable while leaving a successfully mirrored
primary save usable.

## Startup Arbitration

Game state must not mount until save arbitration completes. Add an asynchronous
bootstrap boundary above `GameProvider`; do not mount a fresh provider and
replace it later, because its autosave could destroy recoverable evidence.

Startup gathers these candidates without mutating them:

1. a valid staged pending snapshot from the current JavaScript lifetime;
2. the exact `localStorage` primary;
3. the IndexedDB journal head; and
4. retained IndexedDB checkpoints, newest first.

Every candidate must pass:

- byte-size limits;
- SHA-256 verification when journal metadata supplies a checksum;
- the existing parse, migration, normalization, and validation pipeline;
- profile identity and safe run-identity checks; and
- supported-version checks.

The selection rules are deterministic:

- a valid staged pending snapshot remains first for same-lifetime remounts;
- between valid durable candidates from the same run, select the highest
  persistence revision, breaking a legacy tie by captured time;
- a valid journal head newer than the mirror is loaded automatically and
  described as an interrupted-mirror recovery;
- a valid mirror newer than the journal, as can happen after `pagehide`, is
  loaded automatically and journaled once ownership is established;
- future-version candidates remain untouched and force the existing read-only
  compatibility state; and
- candidates from conflicting run identities are never silently combined.

The mirror sidecar makes interrupted ordering unambiguous. If the primary and
sidecar match, their recorded persistence revision participates normally. If
the journal is newer than that verified pair, the journal wins. If a valid
primary differs while the sidecar still matches the journal head, the primary
is the newer synchronous lifecycle write and is imported. If the primary
matches neither a verified sidecar nor the journal, it is an unsequenced
candidate and requires recovery confirmation rather than timestamp guessing.

## Corruption Recovery Experience

If the primary is unreadable or invalid but an older valid checkpoint exists,
the app enters a blocking recovery screen before `GameProvider` mounts.

The screen shows:

- that the current browser save failed validation;
- the newest valid recovery time and a concise run summary;
- **Recover latest safe save**;
- **Choose another checkpoint**;
- **Export recovery file**; and
- a deliberately secondary **Start a new run** action with a destructive
  confirmation.

The selected recovery is loaded for preview but no primary, journal, metadata,
or checkpoint is overwritten until the player confirms recovery. Confirmation
first preserves the corrupt primary in a bounded diagnostic envelope, then
writes the selected valid state through the normal journal-and-mirror flow.

If no valid candidate exists, the screen offers export of any readable raw
evidence and explains that local recovery was unsuccessful. Starting fresh
still requires explicit confirmation. Raw save bytes never appear in an error
message or console log.

## Status and Player Feedback

Primary durability and recovery redundancy are separate state axes.

Player-visible states are:

- **Saving…** — a newest snapshot is staged or flushing;
- **Saved just now** — the primary mirror or journal contains the newest state;
- **Saved, backup protection unavailable** — the newest state is durable in
  one store but the second store failed;
- **Progress is not being saved** — neither store accepted the newest state;
  and
- **Recovery required** — startup has invalid or conflicting durable state and
  no write may proceed.

The existing red failure banner remains for total save failure and keeps its
retry and encrypted-export actions. A lower-severity persistent warning covers
degraded redundancy. Successful retry clears the relevant warning only after
verified readback.

The header exposes the most recent verified save time without creating a toast
on every autosave. Screen-reader status announcements are throttled so frequent
saves do not become noisy.

## Existing Backup Migration

On the first successful journal startup for a profile:

1. read the existing `__backups` ring without changing it;
2. validate every entry independently;
3. import valid unique entries as `legacy-import` checkpoints;
4. commit and verify the import; and
5. mark migration complete in recovery-database metadata.

Invalid entries are skipped and counted for the recovery notice. The old ring
remains available during this release so rollback to an older app does not lose
its recovery list. New manual, import, reset, and restore snapshots write to the
IndexedDB checkpoint store and retain the existing ring as a best-effort
compatibility copy until a separately approved cleanup release.

## Full-Storage Handling

The existing quota-recovery work from `codex/fix-region-storage-recovery` is
part of this feature but will be reapplied or cherry-picked without its
unrelated region changes.

For a `localStorage` quota error:

1. remove only the enumerated disposable cache keys;
2. retry the exact profile bytes once;
3. verify byte-for-byte readback; and
4. retain the pending newest state plus the red failure banner if retry fails.

For an IndexedDB quota error:

1. prune old unprotected checkpoints;
2. retry the head transaction once; and
3. report degraded recovery protection if the retry fails.

Save code never deletes profiles, profile metadata, writer leases, Discord
configuration, feature settings, export records, current journal heads, or
protected checkpoints to reclaim space.

## Persistent Storage

After the first meaningful progress and from a user-initiated settings or
backup interaction, the app may call `navigator.storage.persist()` on a
best-effort basis. Denial is not an error and does not block saving. The UI may
explain whether the browser granted persistent site storage, but must not imply
that persistence is an off-device backup or protection from disk failure.

## Architecture

### Modules

- `utils/recoveryDatabase.ts` owns IndexedDB opening, versioning, transactions,
  head/checkpoint records, pruning, and typed errors.
- `utils/saveIntegrity.ts` owns checksum generation and verification.
- `utils/saveCoordinator.ts` owns serialization ordering, coalescing, writer
  authorization, mirror metadata, storage retries, and combined status
  results.
- `utils/saveRecovery.ts` owns pure candidate validation, comparison, and
  deterministic recovery decisions.
- `components/SaveBootstrap.tsx` resolves startup before mounting the game.
- `components/SaveRecoveryScreen.tsx` presents blocking recovery choices.
- `components/SaveDurabilityStatus.tsx` presents saved time and degraded
  redundancy without gameplay logic.

Exact filenames may be adjusted to match an existing boundary when
implementation proves a smaller clean composition, but these responsibilities
must remain independently testable.

### Data flow

```text
Game transition
  -> newest in-memory snapshot
  -> 500 ms coalescing coordinator
  -> validate + checksum
  -> IndexedDB journal transaction
  -> byte-identical localStorage mirror
  -> combined save/recovery status

Startup
  -> read all candidates without mutation
  -> checksum + schema validation
  -> deterministic candidate decision
  -> normal mount OR blocking recovery screen
  -> confirmed recovery through the same coordinator
```

### Compatibility boundary

The `localStorage` profile key and serialized `GameState` remain unchanged.
Current `.fate` files, sync codes, profiles, and older app versions continue to
understand the mirror. IndexedDB records are additive and ignored by old builds.

## Error Handling

- Database open, upgrade, blocked, transaction-abort, quota, and security
  failures become typed results rather than uncaught exceptions.
- A journal failure never suppresses a successful primary mirror.
- A mirror failure never suppresses a successful journal commit.
- Failure of both stores retains the newest serialized state in memory and
  keeps the unload guard active.
- Invalid journal checksums exclude only the affected record and retain older
  candidates.
- Unsupported future saves are preserved byte-for-byte and never downgraded.
- A corrupt primary is archived before confirmed replacement when storage
  permits; archive failure blocks replacement rather than destroying the only
  evidence.
- Recovery UI errors expose safe codes and actions, not raw player data.
- Database migration is idempotent and restartable after interruption.

## Testing

### Pure recovery tests

- Candidate ordering selects the newest valid persistence revision.
- Invalid JSON, invalid schema, excessive size, and checksum mismatch are
  rejected independently.
- A corrupt newest candidate falls back to the next newest valid checkpoint.
- Future-version candidates force read-only behavior.
- Conflicting run identities require an explicit recovery choice.
- Selection and retention are deterministic when timestamps match.

### IndexedDB tests

- A committed head round-trips exact bytes and metadata.
- An aborted transaction never exposes a partial head.
- A newer head cannot be replaced by an older completion.
- Checkpoint pruning retains every protected bucket and the head.
- Quota pruning retries once and reports a typed degraded result afterward.
- Database upgrade and legacy-ring migration are idempotent.

Use a standards-compatible fake IndexedDB implementation for deterministic unit
tests, plus real-browser verification for transaction and shutdown behavior.

### Coordinator tests

- Rapid changes coalesce to the newest snapshot.
- A change arriving during a flush runs once more afterward.
- Journal commit precedes primary mirror.
- Ownership is rechecked across asynchronous boundaries.
- Local quota recovery removes only disposable caches and verifies retry.
- Journal success plus mirror failure remains recoverable.
- Mirror success plus journal failure reports degraded redundancy.
- Dual failure retains pending state and activates unload protection.
- Same-batch `pagehide` still mirrors the newest state synchronously.

### Startup and component tests

- The game provider never mounts before arbitration completes.
- A newer valid journal head automatically repairs an interrupted mirror.
- A newer valid lifecycle mirror is imported into the journal.
- A corrupt primary produces the blocking recovery screen without writes.
- Recovery confirmation archives evidence before replacement.
- Starting fresh requires destructive confirmation.
- Saved, degraded, failed, and recovery-required states have correct accessible
  labels and actions.
- Existing backup browsing, import, restore, reset, profiles, and encrypted
  export remain compatible.

### Real-browser failure verification

In Chromium, Firefox, and WebKit where supported:

- accumulate progress, reload, and confirm exact recovery;
- terminate the page after journal commit but before mirror and recover the
  journal head;
- terminate after a synchronous lifecycle mirror and import it on startup;
- corrupt the primary through a controlled fixture and recover a checkpoint;
- simulate quota pressure and verify cache cleanup, pruning, and warnings;
- use two tabs and prove a stale owner cannot write either store; and
- inspect desktop and phone-width recovery and warning layouts.

The public release gate remains the repository's full `release:verify` command
plus an interactively loaded deployed build. Automated browser termination is
evidence for crash behavior, not a substitute for reviewing the visible
recovery experience.

## Rollout

1. Ship the additive journal while retaining the old backup ring and primary
   key.
2. Record only local, non-sensitive diagnostic counters for the current
   session; do not add telemetry.
3. Visually approve the recovery screen and durability statuses in a local
   preview.
4. Run the complete release gate and deployed-build verification only after
   explicit launch approval.
5. Consider removal of compatibility backup writes in a later separately
   reviewed release after the journal has proven stable.

Rollback is safe because the `localStorage` mirror remains in its current
format. An older build ignores IndexedDB and continues from the latest mirrored
state.

## Acceptance Criteria

1. Healthy storage loses no more than the documented debounce/in-flight window
   under abrupt termination.
2. A committed journal head is recoverable when the primary mirror is missing,
   older, unreadable, or invalid.
3. The app never autosaves a fresh run over corrupt or conflicting durable
   evidence.
4. Timed and pre-replacement checkpoints provide bounded rollback without
   unbounded storage growth.
5. Every recovery candidate is checksum-checked where applicable and validated
   by the existing save schema.
6. Local quota recovery never deletes player-owned or protected recovery data.
7. Primary-save failure and degraded recovery redundancy are visibly distinct.
8. Existing profiles, `.fate` files, sync codes, backup UI, writer ownership,
   and seeded gameplay remain compatible.
9. No save bytes leave the device as part of this feature.
10. Focused failure injection, the full automated suite, typecheck, production
    build, and real-browser crash-recovery checks pass before release.
