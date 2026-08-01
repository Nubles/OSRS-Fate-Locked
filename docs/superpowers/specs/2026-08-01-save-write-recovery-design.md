# Save-Write Recovery Design

**Date:** 2026-08-01
**Status:** Approved design
**Scope:** Ordinary active-profile persistence failures only

## Summary

Fate Locked will stop treating an in-memory state transition as safely saved
when the corresponding browser-storage write fails. The app will retain the
newest unsaved profile snapshot for the lifetime of the page, keep gameplay
available, display a persistent recovery banner, and allow the player to retry
or export the current run.

This is the first deployable remediation from the project audit. It includes
regression tests and the corresponding production fix. It does not address
simultaneous-tab conflicts, corrupted profile metadata, relay concurrency, or
a storage-engine migration.

## Goals

- Never allow an ordinary debounced save failure to escape as an uncaught
  exception.
- Make an unsaved run unmistakable until browser storage succeeds again.
- Retain the newest unsaved snapshot while the page remains open.
- Preserve that snapshot across profile switches within the same page.
- Let the player continue using the app while recovery is pending.
- Provide immediate retry and export-backup actions.
- Warn before closing or reloading a page that still owns unsaved data.
- Preserve the current successful-save behavior and debounce interval.

## Non-goals

- Replacing `localStorage` with IndexedDB or a server-side store.
- Merging or serializing writes made by multiple browser tabs.
- Repairing corrupt primary saves or malformed `FATE_PROFILES` metadata.
- Changing import, restore, reset, or profile-deletion transaction semantics
  except for clearing an intentionally deleted profile's pending memory entry.
- Blocking gameplay while storage is unavailable.
- Persisting recovery data after the browser page has closed; when storage is
  unavailable there is no second local durable store in this milestone.

## Architecture

### Page-lifetime pending-save registry

A small persistence module owns an in-memory registry keyed by the profile's
existing storage key. Each entry contains:

- the newest serialized `GameState`;
- whether the entry is queued for its normal debounce or has failed a write;
- the most recent safe, user-facing error category; and
- enough subscription state for React consumers and the global unload guard.

The registry is deliberately independent of `GameProvider`. `GameProvider`
remounts when the active profile changes, so provider-local recovery state
would otherwise disappear during a profile switch.

The registry exposes focused operations to stage the newest snapshot, attempt
a write, inspect a profile entry, discard an intentionally deleted profile,
and subscribe to changes. It does not contain game rules, UI copy, imports, or
backup-ring behavior.

### Game context integration

`GameProvider` continues to own game state and serialization. On every
persistent state change it stages the newest serialized snapshot immediately,
then schedules the existing debounced write.

When the write succeeds, the registry entry is cleared and save health returns
to `saved`. When the write throws, the exception is contained, the entry is
marked `failed`, and the provider exposes failed save health plus a retry
action. A subsequent state change replaces the failed entry with the newest
snapshot and schedules another attempt; stale snapshots are never retried over
newer state.

On profile-provider mount, an internally staged snapshot takes precedence over
the older browser-storage value. Because staged snapshots are produced only by
the app's normal serializer, they still pass through the ordinary save parser
before becoming active state. An unexpectedly invalid staged snapshot is
discarded and the normal stored-save path is used.

Provider teardown attempts to flush the newest staged snapshot before the
profile remount completes. If that write fails, the registry retains it so
switching back to the profile restores the unsaved state.

### Global unload protection

A once-mounted guard subscribes to the registry outside the profile-specific
provider lifecycle. While any queued or failed snapshot exists it registers a
`beforeunload` handler. The handler is removed as soon as every staged snapshot
has been written or intentionally discarded.

This guard covers the short debounce window as well as confirmed failures. It
does not use custom browser copy because modern browsers display their own
standard unsaved-changes warning.

## Save-health contract

The active `GameContext` exposes:

- `saveStatus`: `saved`, `saving`, or `failed`;
- `retrySave()`: immediately attempts to persist the newest active snapshot;
  and
- the existing `getExportData()`, which already serializes current in-memory
  state and therefore remains the source for an emergency export.

`saving` includes a staged snapshot waiting for its debounce. It is available
for status and tests but does not display an alarming banner. `failed` remains
active across repeated failures and clears only after a successful write.

No raw exception text is shown to the player. Quota and unavailable-storage
errors use the same recovery instructions, while the original exception may be
logged once for diagnostics without repeated console or toast spam.

## Player experience

When the active profile has a failed save, a compact red warning bar appears
directly below the sticky header:

> **Progress isn't being saved**  
> Your latest changes are safe in this tab, but they may be lost if the browser closes.

The banner provides:

- **Retry save** — attempts the newest snapshot immediately and reports an
  in-progress state without allowing duplicate retry clicks; and
- **Export backup** — downloads the current in-memory `.fate` save through the
  existing export path.

The banner uses `role="alert"`, names its actions, and exposes retry progress to
assistive technology. It does not have a dismiss action. Exporting provides an
external recovery copy but does not claim browser persistence has recovered,
so the banner remains until a storage write succeeds.

If the player switches profiles, the failed profile's pending snapshot remains
in the registry and the global unload warning remains active. Returning to that
profile restores its unsaved state and banner. Successfully deleting that
profile discards its registry entry because deletion is an explicit request to
remove the run.

## Error and boundary behavior

- A failed write never cancels or replaces the pending newest snapshot.
- Multiple changes during an outage collapse to one newest snapshot.
- Manual retry and automatic debounce use the same write operation.
- A successful later automatic write clears the failure without requiring a
  reload.
- A failed retry leaves the banner and unload protection in place.
- Switching profiles during the debounce flushes immediately; a failed flush
  remains recoverable in memory.
- Export failure is reported through the existing export feedback and does not
  alter save health.
- Import/restore/reset continue using their existing explicit durable-write
  rules and are not weakened by the ordinary-save recovery path.

## Testing strategy

Implementation follows red-green-refactor. Each behavior is demonstrated by a
failing test before production code is added.

### Registry unit tests

- Staging records the newest serialized snapshot for a profile.
- Staging again replaces, rather than queues behind, an older snapshot.
- A successful flush writes the newest snapshot and clears the entry.
- A throwing flush contains the exception and marks the entry failed.
- A later successful flush recovers the same entry.
- Entries for separate profiles remain independent.
- Deleting a profile discards only that profile's entry.

### Game provider tests

- The existing successful debounced-save behavior is unchanged.
- A quota or unavailable-storage exception does not become an uncaught error.
- Failure exposes `saveStatus: failed` and retains current game state.
- Changes made after failure replace the pending snapshot with the newest
  serialized state.
- `retrySave()` writes that newest snapshot and returns the status to `saved`.
- A later automatic write can recover without manual retry.
- Switching away after a failed flush and returning restores the pending state.
- A pending normal debounce is flushed rather than lost on provider teardown.

### UI and lifecycle tests

- The failure banner appears with accessible alert semantics and both recovery
  actions.
- Retry cannot be double-submitted and the banner disappears only after a
  successful storage write.
- Export uses the latest in-memory state and does not clear the failure banner.
- `beforeunload` is registered while any profile has queued or failed data and
  removed after all entries are resolved.

### Full regression checks

- The complete Vitest suite passes.
- Type checking passes.
- The production build succeeds.
- Existing import, restore, reset, backup, onboarding, and profile tests remain
  unchanged in behavior.

## Acceptance criteria

- Reproducing a `QuotaExceededError` during an ordinary gameplay save shows the
  persistent warning without an uncaught runtime error.
- The visible game state and the registry contain the newest change, not the
  last successfully stored snapshot.
- Manual retry or a later successful automatic write persists the newest state
  and removes the warning.
- Switching profiles cannot silently discard a staged or failed snapshot.
- Closing or reloading while any snapshot is pending invokes the browser's
  unsaved-changes protection.
- Export always contains the active in-memory state and never falsely marks a
  failed browser save as recovered.
- Normal successful saves retain the existing debounce and player experience.
- No live deployment occurs until the completed implementation and verification
  results have been reviewed with the user.
