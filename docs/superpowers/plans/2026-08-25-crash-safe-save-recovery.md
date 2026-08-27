# Crash-Safe Save Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a transactional, checksum-validated IndexedDB recovery journal so abrupt shutdowns, full browser storage, and corrupt primary saves cannot silently erase hours of progress.

**Architecture:** Keep the existing `localStorage` profile JSON as a byte-compatible mirror and add an IndexedDB head plus bounded immutable checkpoints. An asynchronous bootstrap arbitrates every durable candidate before `GameProvider` mounts, while one coalescing coordinator writes the journal before the mirror and reports primary durability separately from recovery redundancy.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, browser IndexedDB, Web Crypto SHA-256, `fake-indexeddb` for deterministic transaction tests.

**Spec:** `docs/superpowers/specs/2026-08-25-crash-safe-save-recovery-design.md`

## Global Constraints

- Keep the 500 ms normal-save debounce and the existing synchronous lifecycle mirror.
- Keep `FATE_PROFILE_<profileId>` and serialized `GameState` byte-compatible with current `.fate` files, sync codes, and older builds.
- Retain the existing per-profile writer lease; re-authorize every mutation after each asynchronous boundary.
- Never mount `GameProvider` with a fresh run until startup arbitration has completed.
- Never overwrite corrupt, conflicting, unsupported, or unsequenced durable evidence without explicit player confirmation.
- Keep six recent five-minute checkpoints, seven daily checkpoints, four pre-replacement checkpoints, and no more than eight legacy imports per profile.
- Never reclaim profile data, profile metadata, leases, Discord configuration, feature state, export records, journal heads, or protected checkpoints as disposable storage.
- Keep all save bytes on-device; cloud backup, accounts, telemetry, and authentication are out of scope.
- Preserve existing seeded RNG behavior and do not add recovery metadata to `GameState`.
- Port the quota-recovery behavior from `codex/fix-region-storage-recovery` without cherry-picking its unrelated region changes.
- Use test-first implementation and commit after every task.

## File Map

### New files

- `utils/storageRecovery.ts` — enumerated disposable-cache cleanup and quota classification.
- `utils/saveIntegrity.ts` — UTF-8 SHA-256 checksum generation and verification.
- `utils/recoveryTypes.ts` — journal records, mirror metadata, durability states, typed failures, and repository contracts.
- `utils/recoveryRetention.ts` — pure protected-checkpoint selection and pruning decisions.
- `utils/recoveryDatabase.ts` — IndexedDB open/upgrade and transactional repository implementation.
- `utils/saveRecovery.ts` — pure candidate validation and startup arbitration.
- `utils/saveCoordinator.ts` — per-profile coalescing, journal-first flush ordering, mirror verification, retry, and status subscription.
- `utils/legacyBackupMigration.ts` — idempotent existing-ring import into checkpoints.
- `hooks/usePersistentStorage.ts` — best-effort `navigator.storage.persist()` state.
- `components/SaveBootstrap.tsx` — asynchronous startup boundary and ownership-safe recovery actions.
- `components/SaveRecoveryScreen.tsx` — blocking recovery/checkpoint/start-fresh experience.
- `components/SaveDurabilityStatus.tsx` — saved time and degraded-redundancy warning.
- Matching focused `*.test.ts` and `*.test.tsx` files beside each unit.

### Modified files

- `package.json`, `package-lock.json` — add `fake-indexeddb` as a development dependency.
- `utils/profileStorage.ts` — add mirror-metadata and corrupt-archive keys to owned profile storage.
- `utils/pendingSaves.ts` — verified mirror writes, cache cleanup retry, and async-coordinator status bridging.
- `utils/backups.ts` — compatibility-ring writes plus async journal checkpoint adapter.
- `utils/gamePersistence.ts` — async durable replacement result path.
- `context/GameContext.tsx` — accept an arbitrated initial save and delegate ordinary/replacement persistence to the coordinator.
- `App.tsx` — mount `SaveBootstrap` between profile selection and `GameProvider`.
- `components/SaveFailureBanner.tsx` — await retry and distinguish dual failure from degraded redundancy.
- `components/SyncCodeModal.tsx` — asynchronously list and restore combined journal/legacy checkpoints.
- `components/BackupNagBanner.tsx` — expose persistent-storage request from a user gesture without weakening `.fate` messaging.
- Existing persistence, profile deletion, lifecycle, backup, and app tests — extend compatibility coverage.

---

### Task 1: Storage Safety and Profile-Owned Sidecars

**Files:**
- Create: `utils/storageRecovery.ts`
- Create: `utils/storageRecovery.test.ts`
- Modify: `utils/profileStorage.ts`
- Modify: `utils/profileStorage.test.ts`
- Modify: `utils/pendingSaves.ts`
- Modify: `utils/pendingSaves.test.ts`

**Interfaces:**
- Consumes: existing `SaveWriteAuthorization` and `profileOwnedKeys(profileId)`.
- Produces: `isQuotaExceededError(error)`, `removeDisposableCaches(storage)`, `profileMirrorMetadataKey(storageKey)`, and `profileCorruptArchiveKey(storageKey)`.

- [ ] **Step 1: Write failing cleanup and sidecar-ownership tests**

```ts
it('removes only enumerated disposable caches', () => {
  const removed: string[] = [];
  removeDisposableCaches({ removeItem: key => removed.push(key) });
  expect(removed).toEqual(expect.arrayContaining([
    'fate_osrs_mapping_v1',
    'fate_osrs_prices_v1',
    'fate_uim_wiki_cache_v3',
  ]));
  expect(removed.some(key => key.startsWith('FATE_PROFILE_'))).toBe(false);
});

it('owns mirror metadata and corrupt evidence with the profile', () => {
  expect(profileOwnedKeys('alpha')).toEqual(expect.arrayContaining([
    'FATE_PROFILE_alpha__mirrorMeta',
    'FATE_PROFILE_alpha__corruptArchive',
  ]));
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npx vitest run utils/storageRecovery.test.ts utils/profileStorage.test.ts`

Expected: FAIL because the new module and key helpers do not exist.

- [ ] **Step 3: Implement enumerated cache cleanup and sidecar keys**

```ts
const DISPOSABLE_CACHE_KEYS = [
  'fate_osrs_mapping_v1',
  'fate_osrs_prices_v1',
  'fate_osrs_monsters_v1',
  'fate_osrs_monsters_v2',
  'fate_osrs_gear_v1',
  'fate_uim_wiki_cache_v2',
  'fate_uim_wiki_cache_v3',
  'fate_clog_sync_v1',
  'fate_clog_sync_v2',
] as const;

export const profileMirrorMetadataKey = (storageKey: string): string =>
  `${storageKey}__mirrorMeta`;

export const profileCorruptArchiveKey = (storageKey: string): string =>
  `${storageKey}__corruptArchive`;
```

Copy only the quota classification and disposable-cache behavior from commit
`ba4e0ad`; do not cherry-pick that commit because it also contains region work.

- [ ] **Step 4: Add verified quota retry to the existing mirror flush**

Update `flushPendingSave` to accept `getItem` and optional `removeItem`, retry
once after cache cleanup on quota, and consider the write successful only when
`getItem(storageKey) === entry.data`.

```ts
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>
  & Partial<Pick<Storage, 'removeItem'>>;
```

Add tests for successful retry, retry failure, readback mismatch, and a
non-quota exception that must not delete caches.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run utils/storageRecovery.test.ts utils/profileStorage.test.ts utils/pendingSaves.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add utils/storageRecovery.ts utils/storageRecovery.test.ts utils/profileStorage.ts utils/profileStorage.test.ts utils/pendingSaves.ts utils/pendingSaves.test.ts
git commit -m "fix: recover verified profile writes from full storage"
```

### Task 2: Recovery Types, Checksums, and Retention Policy

**Files:**
- Create: `utils/saveIntegrity.ts`
- Create: `utils/saveIntegrity.test.ts`
- Create: `utils/recoveryTypes.ts`
- Create: `utils/recoveryRetention.ts`
- Create: `utils/recoveryRetention.test.ts`

**Interfaces:**
- Consumes: existing `sha256Hex(value)` from `utils/integrity.ts`.
- Produces: `checksumSave(data)`, `verifySaveChecksum(data, expected)`, `RecoveryHead`, `RecoveryCheckpoint`, `MirrorMetadata`, `RecoveryRepository`, `RecoveryProtectionStatus`, `SaveDurabilitySnapshot`, and `selectRetainedCheckpointKeys(records, now)`.

- [ ] **Step 1: Write failing checksum tests**

```ts
it('round-trips a UTF-8 save checksum', async () => {
  const data = JSON.stringify({ note: 'Rune Ω' });
  const checksum = await checksumSave(data);
  expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  await expect(verifySaveChecksum(data, checksum)).resolves.toBe(true);
  await expect(verifySaveChecksum(`${data} `, checksum)).resolves.toBe(false);
});
```

- [ ] **Step 2: Write failing retention tests**

Build records with explicit IDs and local-day timestamps. Assert that the keep
set contains the six newest intervals, one per previous seven days, four newest
pre-replacement records, and at most eight legacy imports. Also assert that a
record satisfying two buckets appears once and that `head` is never returned as
a deletion candidate.

```ts
expect(selectRetainedCheckpointKeys(records, NOW)).toEqual(new Set([
  'alpha:31', 'alpha:30', 'alpha:29', 'alpha:28', 'alpha:27', 'alpha:26',
  'alpha:20', 'alpha:12', 'alpha:7',
]));
```

- [ ] **Step 3: Run the new tests and verify they fail**

Run: `npx vitest run utils/saveIntegrity.test.ts utils/recoveryRetention.test.ts`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 4: Define exact recovery contracts**

```ts
export type RecoveryCheckpointReason =
  | 'interval'
  | 'session-start'
  | 'pre-replacement'
  | 'legacy-import';

export interface RecoveryHead {
  profileId: string;
  persistenceRevision: number;
  runId: string;
  runRevision: number;
  capturedAt: number;
  checksum: string;
  data: string;
}

export interface RecoveryCheckpoint extends RecoveryHead {
  reason: RecoveryCheckpointReason;
}

export interface MirrorMetadata {
  version: 1;
  persistenceRevision: number;
  capturedAt: number;
  checksum: string;
}

export type RecoveryProtectionStatus = 'checking' | 'protected' | 'degraded';

export interface SaveDurabilitySnapshot {
  primary: 'saved' | 'saving' | 'failed';
  recovery: RecoveryProtectionStatus;
  savedAt: number | null;
}

export type RecoveryWriteResult =
  | { stored: true }
  | {
      stored: false;
      reason: 'ownership_conflict' | 'storage_unavailable' | 'quota' | 'stale_revision';
    };

export interface RecoveryRepository {
  getHead(profileId: string): Promise<RecoveryHead | null>;
  putHead(
    record: RecoveryHead,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult>;
  listCheckpoints(profileId: string): Promise<RecoveryCheckpoint[]>;
  putCheckpoint(
    record: RecoveryCheckpoint,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult>;
  deleteCheckpoints(
    profileId: string,
    revisions: readonly number[],
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult>;
  getMetadata<T>(key: string): Promise<T | null>;
  putMetadata<T>(
    key: string,
    value: T,
    authorizeWrite: () => SaveWriteAuthorization,
  ): Promise<RecoveryWriteResult>;
  close(): void;
}
```

- [ ] **Step 5: Implement checksum wrappers and pure retention selection**

Delegate hashing to the already-tested `sha256Hex` implementation; do not add a
second SHA-256 implementation. Use local calendar keys built from year, month,
and date. Sort by `capturedAt`, then `persistenceRevision`, then stable key.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run utils/saveIntegrity.test.ts utils/recoveryRetention.test.ts utils/integrity.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```text
git add utils/saveIntegrity.ts utils/saveIntegrity.test.ts utils/recoveryTypes.ts utils/recoveryRetention.ts utils/recoveryRetention.test.ts
git commit -m "feat: define recovery integrity and retention contracts"
```

### Task 3: Transactional IndexedDB Repository

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `utils/recoveryDatabase.ts`
- Create: `utils/recoveryDatabase.test.ts`

**Interfaces:**
- Consumes: `RecoveryRepository`, recovery records, and `selectRetainedCheckpointKeys` from Task 2.
- Produces: `openRecoveryDatabase(options?)`, `RecoveryDatabaseError`, and a standards-based repository implementation.

- [ ] **Step 1: Install deterministic IndexedDB test support**

Run: `npm install --save-dev fake-indexeddb`

Expected: `package.json` and `package-lock.json` record the new development dependency.

- [ ] **Step 2: Write failing repository transaction tests**

```ts
import 'fake-indexeddb/auto';

it('commits and reads back an exact journal head', async () => {
  const repo = await openRecoveryDatabase({ databaseName: uniqueDbName() });
  await repo.putHead(head({ persistenceRevision: 4 }), allowWrite);
  await expect(repo.getHead('alpha')).resolves.toEqual(
    head({ persistenceRevision: 4 }),
  );
});

it('cannot publish an older head over a newer revision', async () => {
  const repo = await openRecoveryDatabase({ databaseName: uniqueDbName() });
  await repo.putHead(head({ persistenceRevision: 9 }), allowWrite);
  await expect(repo.putHead(head({ persistenceRevision: 8 }), allowWrite))
    .resolves.toMatchObject({ stored: false, reason: 'stale_revision' });
});
```

Also inject an ownership function that changes after the request begins and
assert the transaction aborts without changing the prior head.

- [ ] **Step 3: Run the repository test and verify it fails**

Run: `npx vitest run utils/recoveryDatabase.test.ts`

Expected: FAIL because `openRecoveryDatabase` does not exist.

- [ ] **Step 4: Implement database open and upgrade**

Create database `fate-locked-recovery-v1`, version `1`, with:

```ts
heads: keyPath 'profileId'
checkpoints: keyPath ['profileId', 'persistenceRevision']
metadata: keyPath 'key'
```

Add a `checkpoints.byProfileCapturedAt` index over
`['profileId', 'capturedAt']`. Reject blocked upgrades and translate DOM
exceptions into codes: `unavailable`, `quota`, `aborted`, `blocked`, and
`unknown`.

- [ ] **Step 5: Implement transaction-complete durability**

Wrap IDB requests and transaction completion separately:

```ts
const transactionDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new DOMException('Aborted', 'AbortError'));
    tx.onerror = () => reject(tx.error ?? new DOMException('Failed', 'UnknownError'));
  });
```

For `putHead`, read the current head inside the same read-write transaction,
reject stale revisions, re-authorize immediately before `put`, await the put
request, and then await transaction completion. Do the equivalent ownership
check for every checkpoint, metadata, and deletion transaction.

- [ ] **Step 6: Add pruning and quota-retry tests**

Inject a transaction adapter that throws `QuotaExceededError` for the first
head write. Assert the repository deletes only keys excluded by the retention
keep set, retries exactly once, and returns `degraded` after a second quota
failure without deleting the prior head.

- [ ] **Step 7: Run focused tests**

Run: `npx vitest run utils/recoveryDatabase.test.ts utils/recoveryRetention.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```text
git add package.json package-lock.json utils/recoveryDatabase.ts utils/recoveryDatabase.test.ts
git commit -m "feat: add transactional recovery database"
```

### Task 4: Pure Startup Candidate Arbitration

**Files:**
- Create: `utils/saveRecovery.ts`
- Create: `utils/saveRecovery.test.ts`

**Interfaces:**
- Consumes: recovery records, `MirrorMetadata`, checksum verification, and `parseAndMigrateSave(json, defaults)`.
- Produces: `resolveSaveRecovery(input): Promise<SaveRecoveryDecision>` and `ValidatedRecoveryCandidate`.

- [ ] **Step 1: Write failing candidate-validation tests**

```ts
it('selects a newer valid journal head after an interrupted mirror', async () => {
  const decision = await resolveSaveRecovery(fixture({
    mirror: candidate({ revision: 4, note: 'older' }),
    mirrorMetadata: metadata({ revision: 4 }),
    head: candidate({ revision: 5, note: 'newest' }),
  }));
  expect(decision).toMatchObject({
    kind: 'ready',
    source: 'journal',
    reason: 'interrupted_mirror',
    persistenceRevision: 5,
  });
});

it('requires confirmation when corrupt primary falls back to a checkpoint', async () => {
  const decision = await resolveSaveRecovery(fixture({
    primaryRaw: '{bad',
    checkpoints: [candidate({ revision: 3, note: 'safe' })],
  }));
  expect(decision).toMatchObject({ kind: 'recovery_required' });
});
```

Add cases for valid pending state, verified mirror newer than head, lifecycle
mirror whose stale sidecar still matches the head, checksum mismatch, invalid
schema, too-large candidate, future version, conflicting run IDs, equal
timestamps, and no candidates.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run utils/saveRecovery.test.ts`

Expected: FAIL because the arbitration module does not exist.

- [ ] **Step 3: Define the decision union**

```ts
export interface SaveRecoveryInput {
  profileId: string;
  pendingRaw: string | null;
  primaryRaw: string | null;
  mirrorMetadataRaw: string | null;
  head: RecoveryHead | null;
  checkpoints: readonly RecoveryCheckpoint[];
  defaults: GameState;
}

export type SaveRecoveryDecision =
  | {
      kind: 'ready';
      source: 'pending' | 'mirror' | 'journal';
      reason: 'normal' | 'interrupted_mirror' | 'lifecycle_mirror' | 'legacy';
      data: string;
      state: GameState;
      persistenceRevision: number;
      needsJournalImport: boolean;
    }
  | {
      kind: 'recovery_required';
      primaryRaw: string | null;
      candidates: readonly ValidatedRecoveryCandidate[];
      cause: 'corrupt_primary' | 'conflicting_runs' | 'unsequenced_primary';
    }
  | {
      kind: 'unsupported';
      rawCandidates: readonly string[];
    }
  | { kind: 'empty' };
```

- [ ] **Step 4: Implement independent validation and deterministic selection**

Validate each candidate without mutation. Journal candidates require matching
SHA-256. A mirror sidecar participates only when its checksum matches the
primary bytes. Prefer a valid pending same-lifetime snapshot. Never use wall
clock time to decide between an unsequenced primary and a differing head.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run utils/saveRecovery.test.ts utils/saveSchema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add utils/saveRecovery.ts utils/saveRecovery.test.ts
git commit -m "feat: arbitrate durable save recovery candidates"
```

### Task 5: Coalescing Journal-First Save Coordinator

**Files:**
- Create: `utils/saveCoordinator.ts`
- Create: `utils/saveCoordinator.test.ts`

**Interfaces:**
- Consumes: `RecoveryRepository`, checksum utilities, sidecar key, quota cleanup, and writer authorization.
- Produces: `createSaveCoordinator(options): SaveCoordinator`.

- [ ] **Step 1: Write failing ordering and coalescing tests**

```ts
it('commits the journal before mirroring identical bytes', async () => {
  const events: string[] = [];
  const coordinator = createSaveCoordinator(harness({ events }));
  coordinator.stage(save('newest'));
  await coordinator.flush();
  expect(events).toEqual([
    'validate:newest',
    'hash:newest',
    'journal:newest',
    'mirror:newest',
    'mirror-meta:newest',
  ]);
});

it('runs one follow-up flush with the newest state', async () => {
  const gate = deferred<void>();
  const coordinator = createSaveCoordinator(harness({ journalGate: gate }));
  coordinator.stage(save('first'));
  const flushing = coordinator.flush();
  coordinator.stage(save('second'));
  coordinator.stage(save('third'));
  gate.resolve();
  await flushing;
  await coordinator.whenIdle();
  expect(harness.writtenNotes()).toEqual(['first', 'third']);
});
```

Add ownership-loss-after-hash, journal-only success, mirror-only success,
dual failure, stale completion, byte-readback mismatch, and retry tests.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run utils/saveCoordinator.test.ts`

Expected: FAIL because the coordinator does not exist.

- [ ] **Step 3: Define the coordinator interface**

```ts
export interface SaveCoordinator {
  stage(data: string): void;
  flush(): Promise<SaveDurabilitySnapshot>;
  retry(): Promise<SaveDurabilitySnapshot>;
  mirrorLifecycle(data: string): boolean;
  writeReplacement(data: string, reason: string): Promise<SaveDurabilitySnapshot>;
  createCheckpoint(data: string, reason: RecoveryCheckpointReason): Promise<BackupWriteResult>;
  getSnapshot(): SaveDurabilitySnapshot;
  subscribe(listener: () => void): () => void;
  whenIdle(): Promise<void>;
  dispose(): void;
}

export interface SaveCoordinatorOptions {
  profileId: string;
  storageKey: string;
  storage: SaveStorage;
  repository: RecoveryRepository;
  authorizeWrite: () => SaveWriteAuthorization;
  validate: (data: string) => SaveValidationResult;
  checksum: (data: string) => Promise<string>;
  now: () => number;
  initialPersistenceRevision: number;
}
```

- [ ] **Step 4: Implement monotonic revisions and verified mirror metadata**

Initialize the next revision from the maximum verified journal and mirror
metadata revision. For each flush, validate, hash, re-authorize, commit the head,
then write and verify the primary bytes, then write and verify
`__mirrorMeta`. Treat exact journal success as durable even if the mirror fails.

- [ ] **Step 5: Implement status and failure semantics**

Map results exactly:

```text
journal yes + mirror yes -> primary saved, recovery protected
journal yes + mirror no  -> primary saved, recovery degraded
journal no  + mirror yes -> primary saved, recovery degraded
journal no  + mirror no  -> primary failed, recovery degraded; keep pending
```

`savedAt` changes only after at least one verified durable write. `dispose()`
must not discard a pending newest snapshot.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run utils/saveCoordinator.test.ts utils/recoveryDatabase.test.ts utils/pendingSaves.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```text
git add utils/saveCoordinator.ts utils/saveCoordinator.test.ts
git commit -m "feat: coordinate journal-first profile saves"
```

### Task 6: Asynchronous Save Bootstrap

**Files:**
- Create: `components/SaveBootstrap.tsx`
- Create: `components/SaveBootstrap.test.tsx`
- Modify: `App.tsx`
- Modify: `App.lifecycle.test.tsx`

**Interfaces:**
- Consumes: active profile ID/key, recovery repository, `resolveSaveRecovery`, and `createFreshState()`/save validation.
- Produces: `SaveBootstrapResult`, `SaveBootstrap` render boundary, and a `GameProviderBridge` that receives arbitrated state.

- [ ] **Step 1: Write a failing no-early-mount test**

```tsx
it('does not mount the game while durable candidates are unresolved', async () => {
  const arbitration = deferred<SaveRecoveryDecision>();
  render(
    <SaveBootstrap dependencies={deps({ arbitration })} profileId="alpha" storageKey="FATE_PROFILE_alpha">
      {() => <div>game mounted</div>}
    </SaveBootstrap>,
  );
  expect(screen.queryByText('game mounted')).toBeNull();
  expect(screen.getByText('Checking saved progress…')).toBeVisible();
});
```

Add tests for ready mirror, interrupted-mirror journal, empty fresh profile,
unsupported future state, profile switch cancellation, and a rejected stale
promise after the profile changes.

- [ ] **Step 2: Run the component tests and verify they fail**

Run: `npx vitest run components/SaveBootstrap.test.tsx App.lifecycle.test.tsx`

Expected: FAIL because the bootstrap does not exist.

- [ ] **Step 3: Implement bootstrap dependency injection and loading state**

```ts
export interface SaveBootstrapResult {
  initialState: GameState;
  initialData: string | null;
  persistenceRevision: number;
  source: 'empty' | 'pending' | 'mirror' | 'journal' | 'recovery';
  needsJournalImport: boolean;
}
```

The production dependency factory reads pending state, exact primary and
sidecar values, head, and checkpoints. It closes the repository and ignores
late completion on profile switch or unmount.

- [ ] **Step 4: Insert bootstrap above `GameProvider`**

Change the bridge from:

```tsx
<GameProvider key={activeProfileId} storageKey={storageKeyForActiveProfile}>
```

to:

```tsx
<SaveBootstrap profileId={activeProfileId} storageKey={storageKeyForActiveProfile}>
  {bootstrap => (
    <GameProvider
      key={activeProfileId}
      storageKey={storageKeyForActiveProfile}
      bootstrap={bootstrap}
    >
      {children}
    </GameProvider>
  )}
</SaveBootstrap>
```

At this task, the reducer initializer must use `bootstrap.initialState` and seed
its persisted baseline from `bootstrap.initialData`; it must not reread the
primary. The existing debounced persistence effect may remain until Task 8
replaces it.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run components/SaveBootstrap.test.tsx App.lifecycle.test.tsx context/GameContext.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add components/SaveBootstrap.tsx components/SaveBootstrap.test.tsx App.tsx App.lifecycle.test.tsx context/GameContext.tsx context/GameContext.test.tsx
git commit -m "feat: arbitrate saves before mounting the game"
```

### Task 7: Blocking Corruption Recovery Experience

**Files:**
- Create: `components/SaveRecoveryScreen.tsx`
- Create: `components/SaveRecoveryScreen.test.tsx`
- Modify: `components/SaveBootstrap.tsx`
- Modify: `components/SaveBootstrap.test.tsx`
- Modify: `utils/profileStorage.ts`

**Interfaces:**
- Consumes: `recovery_required` and `unsupported` decisions from Task 4.
- Produces: accessible checkpoint selection, recovery-file export, confirmed recovery, confirmed fresh start, and corrupt-evidence archival.

- [ ] **Step 1: Write failing recovery-screen behavior tests**

```tsx
it('offers recovery without mounting or writing the game', async () => {
  const recover = vi.fn();
  render(<SaveRecoveryScreen decision={corruptDecision()} onRecover={recover} {...actions} />);
  expect(screen.getByRole('heading', { name: 'Saved progress needs recovery' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Recover latest safe save' })).toBeEnabled();
  expect(actions.writePrimary).not.toHaveBeenCalled();
});

it('requires destructive confirmation before starting fresh', async () => {
  render(<SaveRecoveryScreen decision={corruptDecision()} {...actions} />);
  await user.click(screen.getByRole('button', { name: 'Start a new run' }));
  expect(screen.getByText('This preserves no recoverable checkpoint as the active run.')).toBeVisible();
  expect(actions.startFresh).not.toHaveBeenCalled();
});
```

Add keyboard navigation, checkpoint summary, unsupported-version, export
failure, archive failure, raw-data-redaction, and corrupt-primary-with-no-valid-
checkpoint tests. The last case must allow exporting bounded raw evidence and
must not enable recovery until the player explicitly confirms a fresh run.

- [ ] **Step 2: Run component tests and verify they fail**

Run: `npx vitest run components/SaveRecoveryScreen.test.tsx components/SaveBootstrap.test.tsx`

Expected: FAIL because the screen does not exist.

- [ ] **Step 3: Implement the blocking screen**

Use the existing dark OSRS-style surface and real buttons. Show captured time,
keys, visible regions, and event count from validated candidates. Default to the
newest valid candidate. Keep **Start a new run** visually secondary and require
a second explicit confirmation.

- [ ] **Step 4: Implement archive-before-replacement recovery**

Before confirmed recovery or fresh start, write this bounded envelope to
`profileCorruptArchiveKey(storageKey)` and verify readback:

```ts
interface CorruptSaveArchive {
  version: 1;
  capturedAt: number;
  primary: string | null;
  mirrorMetadata: string | null;
}
```

If the raw values exceed the existing save-size bound, store hashes and byte
lengths plus the complete primary only when it fits. Archive failure blocks the
replacement and leaves the export action available. Never log the envelope.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run components/SaveRecoveryScreen.test.tsx components/SaveBootstrap.test.tsx utils/profileStorage.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add components/SaveRecoveryScreen.tsx components/SaveRecoveryScreen.test.tsx components/SaveBootstrap.tsx components/SaveBootstrap.test.tsx utils/profileStorage.ts utils/profileStorage.test.ts
git commit -m "feat: add blocking corrupt-save recovery"
```

### Task 8: Integrate the Coordinator with GameContext

**Files:**
- Modify: `context/GameContext.tsx`
- Modify: `context/GameContext.test.tsx`
- Modify: `context/GameContext.persistence.test.ts`
- Modify: `utils/gamePersistence.ts`
- Modify: `utils/gamePersistence.test.ts`
- Modify: `components/SaveRecoveryGuard.tsx`
- Modify: `components/SaveRecoveryGuard.test.tsx`

**Interfaces:**
- Consumes: `SaveBootstrapResult` and `SaveCoordinator` from Tasks 5–6.
- Produces: async `retrySave`, coordinator-backed ordinary saves and replacements, `saveDurability`, and unchanged gameplay callbacks.

- [ ] **Step 1: Write failing GameContext integration tests**

```tsx
it('journals a state change before mirroring it', async () => {
  const game = renderGame({ coordinator });
  act(() => game.current().saveNote('goal', 'newest'));
  await act(() => vi.advanceTimersByTimeAsync(500));
  await coordinator.whenIdle();
  expect(events.indexOf('journal:newest')).toBeLessThan(events.indexOf('mirror:newest'));
});

it('keeps unload protection after both durable writes fail', async () => {
  coordinator.failJournalAndMirror();
  act(() => game.current().saveNote('goal', 'memory only'));
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(game.current().saveDurability.primary).toBe('failed');
  expect(game.current().hasPendingChanges).toBe(true);
});
```

Add same-batch pagehide, unmount, takeover, foreign-owner, profile eviction,
reload-latest, import, restore, reset, and migration-rewrite cases.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npx vitest run context/GameContext.test.tsx context/GameContext.persistence.test.ts utils/gamePersistence.test.ts components/SaveRecoveryGuard.test.tsx`

Expected: FAIL because `GameProvider` does not delegate to the coordinator.

- [ ] **Step 3: Finish coordinator initialization from the arbitrated state**

Remove the obsolete initial-load warning path that predates bootstrap. Initialize
the coordinator revision and verified baselines from the bootstrap result, and
request a journal import after writer ownership is settled when
`needsJournalImport` is true.

- [ ] **Step 4: Replace the ordinary debounced flush**

Keep `stateRef` and `stagePendingSave`, but have the timeout call:

```ts
coordinator.stage(serializeCurrent());
void coordinator.flush();
```

Subscribe with `useSyncExternalStore` and expose:

```ts
saveDurability: SaveDurabilitySnapshot;
retrySave: () => Promise<boolean>;
```

The lifecycle handler calls `coordinator.mirrorLifecycle(serializeCurrent())`
before releasing ownership. Release only after success or when no state differs
from a verified durable source.

- [ ] **Step 5: Make replacements durable before state replacement**

Add `applyValidatedReplacementAsync` to `utils/gamePersistence.ts`. It writes a
pre-replacement checkpoint, awaits `coordinator.writeReplacement`, and invokes
`replaceState` only when at least one durable store succeeds. Preserve existing
warning semantics when only backup protection fails.

- [ ] **Step 6: Keep unload protection tied to genuinely pending state**

`SaveRecoveryGuard` remains active when staged bytes are newer than both stores
or a dual failure exists. A successful journal-only write is durable and may
clear the unload guard even while the mirror warning stays visible.

- [ ] **Step 7: Run focused tests**

Run: `npx vitest run context/GameContext.test.tsx context/GameContext.persistence.test.ts utils/gamePersistence.test.ts components/SaveRecoveryGuard.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```text
git add context/GameContext.tsx context/GameContext.test.tsx context/GameContext.persistence.test.ts utils/gamePersistence.ts utils/gamePersistence.test.ts components/SaveRecoveryGuard.tsx components/SaveRecoveryGuard.test.tsx
git commit -m "feat: persist game state through crash-safe coordinator"
```

### Task 9: Checkpoints and Existing Backup Migration

**Files:**
- Create: `utils/legacyBackupMigration.ts`
- Create: `utils/legacyBackupMigration.test.ts`
- Modify: `utils/backups.ts`
- Modify: `utils/backups.test.ts`
- Modify: `context/GameContext.tsx`
- Modify: `components/SyncCodeModal.tsx`
- Modify: `components/SyncCodeModal.test.tsx`

**Interfaces:**
- Consumes: coordinator checkpoints, repository metadata, existing `__backups` ring.
- Produces: `migrateLegacyBackupRing(input)`, async `listBackups()`, async `restoreBackup(ts)`, five-minute interval checkpoints, and compatibility-ring copies.

- [ ] **Step 1: Write failing idempotent migration tests**

```ts
it('imports valid unique legacy backups once', async () => {
  const result = await migrateLegacyBackupRing({
    profileId: 'alpha',
    rawRing: JSON.stringify([legacy(3), legacy(2), corruptLegacy()]),
    repository,
    authorizeWrite: allowWrite,
  });
  expect(result).toEqual({ imported: 2, skipped: 1, alreadyMigrated: false });
  await expect(migrateLegacyBackupRing(sameInput)).resolves.toMatchObject({
    imported: 0,
    alreadyMigrated: true,
  });
});
```

- [ ] **Step 2: Write failing checkpoint-list tests**

Assert combined listing deduplicates equal checksums, sorts newest first, keeps
reason and summary, and still returns legacy entries when IndexedDB is
unavailable.

- [ ] **Step 3: Run focused tests and verify they fail**

Run: `npx vitest run utils/legacyBackupMigration.test.ts utils/backups.test.ts components/SyncCodeModal.test.tsx`

Expected: FAIL because migration and async combined listing do not exist.

- [ ] **Step 4: Implement migration metadata and legacy imports**

Use metadata key `legacy-backups:<profileId>` with value:

```ts
{ version: 1, completedAt: number, imported: number, skipped: number }
```

Validate each legacy entry through the same save pipeline, compute its checksum,
deduplicate by checksum, and commit imports plus migration metadata only after
ownership checks. Leave the old ring unchanged.

- [ ] **Step 5: Add automatic checkpoints**

After a successful head flush, add an `interval` checkpoint only when the bytes
changed and five minutes elapsed. Keep the existing session-start behavior as a
`session-start` checkpoint. Imports, restore, and reset use
`pre-replacement`. Continue best-effort writes to the eight-entry old ring for
rollback compatibility.

- [ ] **Step 6: Make the backup UI asynchronous**

Change the context contract to:

```ts
listBackups: () => Promise<BackupMeta[]>;
restoreBackup: (id: string) => Promise<ImportResult>;
```

Give `BackupMeta` a stable `id` instead of relying on timestamp uniqueness.
Show a loading state, ignore completion after modal close, and route restore
through the durable replacement coordinator.

- [ ] **Step 7: Run focused tests**

Run: `npx vitest run utils/legacyBackupMigration.test.ts utils/backups.test.ts components/SyncCodeModal.test.tsx context/GameContext.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```text
git add utils/legacyBackupMigration.ts utils/legacyBackupMigration.test.ts utils/backups.ts utils/backups.test.ts context/GameContext.tsx context/GameContext.test.tsx components/SyncCodeModal.tsx components/SyncCodeModal.test.tsx
git commit -m "feat: retain timed recovery checkpoints"
```

### Task 10: Save Durability Status and Persistent Storage

**Files:**
- Create: `components/SaveDurabilityStatus.tsx`
- Create: `components/SaveDurabilityStatus.test.tsx`
- Create: `hooks/usePersistentStorage.ts`
- Create: `hooks/usePersistentStorage.test.tsx`
- Modify: `components/SaveFailureBanner.tsx`
- Modify: `components/SaveFailureBanner.test.tsx`
- Modify: `components/BackupNagBanner.tsx`
- Modify: `components/BackupNagBanner.test.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `saveDurability`, async `retrySave`, and browser Storage Manager.
- Produces: visible saved time, degraded-redundancy warning, dual-failure banner, and user-initiated persistent-storage request.

- [ ] **Step 1: Write failing status-matrix tests**

```tsx
it.each([
  [{ primary: 'saving', recovery: 'checking', savedAt: null }, 'Saving…'],
  [{ primary: 'saved', recovery: 'protected', savedAt: NOW }, 'Saved just now'],
  [{ primary: 'saved', recovery: 'degraded', savedAt: NOW }, 'Saved, backup protection unavailable'],
  [{ primary: 'failed', recovery: 'degraded', savedAt: null }, "Progress isn't being saved"],
])('renders %s as %s', (snapshot, label) => {
  render(<SaveDurabilityStatus snapshot={snapshot} now={NOW} />);
  expect(screen.getByText(label)).toBeVisible();
});
```

- [ ] **Step 2: Write failing persistent-storage tests**

Cover granted, denied, unsupported, thrown `SecurityError`, repeated requests,
and verify the request happens only from the explicit backup/settings button.

- [ ] **Step 3: Run component tests and verify they fail**

Run: `npx vitest run components/SaveDurabilityStatus.test.tsx hooks/usePersistentStorage.test.tsx components/SaveFailureBanner.test.tsx components/BackupNagBanner.test.tsx`

Expected: FAIL because the status component and hook do not exist.

- [ ] **Step 4: Implement accessible durability feedback**

Throttle polite screen-reader announcements to state transitions, not every
timestamp update. Render the red failure banner only for dual failure. Render
degraded redundancy in amber with **Retry protection** and **Export backup**.
Await async retries and disable the button while running.

- [ ] **Step 5: Add best-effort persistent-storage request**

```ts
export type PersistentStorageStatus =
  | 'unknown'
  | 'unsupported'
  | 'granted'
  | 'denied';
```

Expose the request beside the existing `.fate` export action after meaningful
progress. Copy must say persistent site storage reduces automatic eviction but
does not survive cleared data or device loss.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run components/SaveDurabilityStatus.test.tsx hooks/usePersistentStorage.test.tsx components/SaveFailureBanner.test.tsx components/BackupNagBanner.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```text
git add components/SaveDurabilityStatus.tsx components/SaveDurabilityStatus.test.tsx hooks/usePersistentStorage.ts hooks/usePersistentStorage.test.tsx components/SaveFailureBanner.tsx components/SaveFailureBanner.test.tsx components/BackupNagBanner.tsx components/BackupNagBanner.test.tsx App.tsx
git commit -m "feat: surface save durability and storage protection"
```

### Task 11: Cross-Profile, Multi-Tab, and Compatibility Regression Gate

**Files:**
- Modify: `context/ProfileContext.test.tsx`
- Modify: `utils/profileMetadata.test.ts`
- Modify: `utils/profileMetadataTransaction.test.ts`
- Modify: `hooks/useProfileWriterLease.test.tsx`
- Modify: `App.lifecycle.test.tsx`
- Modify: `data/changelog.ts`
- Modify: `data/changelog.test.ts`

**Interfaces:**
- Consumes: the completed recovery subsystem.
- Produces: regression proof for profile reconstruction/deletion, future saves, multiple tabs, migrations, and player-facing release notes.

- [ ] **Step 1: Add profile reconstruction and deletion regressions**

Test that `__mirrorMeta` and `__corruptArchive` are never reconstructed as base
profiles, both are deleted only with their owning profile, and unrelated
profiles/journal records survive. Verify a future-version registry remains
read-only without journal mutation.

- [ ] **Step 2: Add multi-tab race regressions**

Use two owners and a controlled repository. Prove that a stale tab cannot write
a head, checkpoint, mirror, sidecar, archive, or deletion after ownership
changes. Prove takeover flushes the newest staged bytes only after arbitration.

- [ ] **Step 3: Add startup matrix regressions**

Cover legacy primary without sidecar, primary plus sidecar, head ahead of
mirror, lifecycle mirror ahead of head, checksum-corrupt head with valid older
checkpoint, completely empty profile, unsupported future primary, and profile
switch while recovery UI is open.

- [ ] **Step 4: Add a player-facing changelog entry**

Use factual copy:

```ts
{
  id: '2026-08-25-crash-safe-saves',
  title: 'Crash-Safe Saves',
  date: '2026-08-25',
  sections: {
    added: [
      'Progress now keeps a transactional local recovery journal with timed restore points.',
    ],
    fixed: [
      'Corrupt or interrupted browser saves now stop for recovery instead of silently starting over.',
      'Full browser storage now clears disposable caches and retries profile saves safely.',
    ],
  },
}
```

- [ ] **Step 5: Run the persistence regression group**

Run: `npx vitest run context/ProfileContext.test.tsx utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts hooks/useProfileWriterLease.test.tsx App.lifecycle.test.tsx data/changelog.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add context/ProfileContext.test.tsx utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts hooks/useProfileWriterLease.test.tsx App.lifecycle.test.tsx data/changelog.ts data/changelog.test.ts
git commit -m "test: lock crash-safe save compatibility"
```

### Task 12: Full Verification and Visible Crash-Recovery Review

**Files:**
- Modify only files required by failures proven during this task.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: complete automated and visible evidence; no release, push, merge, or deployment.

- [ ] **Step 1: Run focused save-system tests together**

Run:

```text
npx vitest run utils/storageRecovery.test.ts utils/saveIntegrity.test.ts utils/recoveryRetention.test.ts utils/recoveryDatabase.test.ts utils/saveRecovery.test.ts utils/saveCoordinator.test.ts utils/legacyBackupMigration.test.ts context/GameContext.test.tsx context/GameContext.persistence.test.ts components/SaveBootstrap.test.tsx components/SaveRecoveryScreen.test.tsx components/SaveDurabilityStatus.test.tsx components/SaveFailureBanner.test.tsx components/SyncCodeModal.test.tsx App.lifecycle.test.tsx
```

Expected: PASS with no unhandled promise rejection or act warning introduced by
the recovery work.

- [ ] **Step 2: Run the full repository release gate**

Run: `npm run release:verify`

Expected: changelog verification, all tests, typecheck, content verification,
and production build pass. If Windows returns the known sandbox `spawn EPERM`,
rerun the identical command with approved outside-sandbox execution; do not
change code to hide an environment failure.

- [ ] **Step 3: Start a local production preview**

Run: `npm run preview -- --host 127.0.0.1 --port 4176`

Expected: the built app responds at `http://127.0.0.1:4176/OSRS-Fate-Locked/`.

- [ ] **Step 4: Verify the healthy-save path in a real browser**

Create a fresh profile, complete onboarding, make a visible note or gameplay
change, wait for **Saved just now**, reload, and confirm the exact state. Inspect
IndexedDB and verify one head plus bounded checkpoints for the active profile.

- [ ] **Step 5: Verify interrupted ordering**

Use browser storage inspection with save data created and exported by the local
app; do not add a production debug endpoint. Recreate the two already
failure-injected automated states:

1. retain the newer journal head while restoring the prior verified mirror and
   sidecar, then reload and verify automatic interrupted-mirror recovery; and
2. retain the current head and sidecar while writing a newer valid app-exported
   primary, then reload and verify lifecycle-mirror import into the journal.

Restore the exact healthy local state after each check. Never use player data or
an external save for these fixtures.

- [ ] **Step 6: Verify corruption and quota recovery visibly**

In the disposable local profile, corrupt only the primary through browser
storage inspection, reload, and verify the blocking recovery screen. Exercise
latest checkpoint, older checkpoint, export, and confirmed fresh start. Use the
focused failure-injection tests as the quota proof, then inspect their equivalent
amber degraded warning, red dual-failure banner, and retry states through
component previews without deleting recovery data.

- [ ] **Step 7: Verify multiple tabs and responsive UI**

Open the same profile in two tabs, confirm only the owner writes, take over, and
confirm the newest staged state wins. Review recovery and durability surfaces at
desktop and phone widths, including keyboard focus, screen-reader labels, long
profile names, and checkpoint summaries. Repeat the healthy reload and corrupt-
primary recovery checks in Chromium, Firefox, and WebKit where the available
browser runner supports storage inspection; record a browser as unsupported
rather than claiming it passed when inspection or IndexedDB control is absent.

- [ ] **Step 8: Inspect final diff and commit verification-only fixes**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors, no generated build output, no debug recovery
endpoint in production, and no unrelated files. If verification proves a code
defect, return to the task that owns that behavior, add the regression to that
task's named test file, make the minimal fix in that task's named source file,
rerun its focused command and `npm run release:verify`, and commit those named
files with message `fix: complete crash-safe save verification`.

- [ ] **Step 9: Stop for visual approval**

Report the local preview URL, automated totals, failure-injection results, and
any remaining browser-specific limitation. Do not push, merge, deploy, release,
or announce until Alex explicitly approves the visible result.
