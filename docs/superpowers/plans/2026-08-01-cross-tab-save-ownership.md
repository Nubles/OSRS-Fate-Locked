# Cross-Tab Save Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent simultaneous browser tabs from silently overwriting the same Fate Locked profile while preserving an exportable newest snapshot in every blocked tab.

**Architecture:** A pure local-storage lease module provides versioned, expiring per-profile writer ownership. A focused React hook arbitrates claims and owns renewals/events; `GameProvider` routes every profile-state write through synchronous ownership verification and retains blocked changes in the existing pending-save registry. A separate conflict banner lets the player take over, discard/reload, or export without changing the save-file schema.

**Tech Stack:** React 18, TypeScript 5, Vitest 4, Testing Library, browser `localStorage`, `storage`/`visibilitychange`/`pagehide` events

## Global Constraints

- Keep a blocked tab interactive and preserve only its newest in-memory snapshot.
- Never write profile state while ownership is `checking` or `blocked`.
- Renew an owned lease every 10 seconds and expire it after 30 seconds.
- Recheck ownership on visibility changes and immediately before every write.
- Require confirmation before takeover and before discarding pending local changes.
- Do not merge divergent runs or modify `GameState.version` or `.fate` files.
- Do not implement profile-metadata synchronization or corruption recovery in this milestone.
- Preserve the existing save-write failure banner and unload protection.
- Follow red-green-refactor for every production change.
- Do not merge, push, or deploy until the completed milestone is reviewed with the user.

---

## File Map

- Create `utils/profileWriterLease.ts`: strict lease parsing and synchronous claim, verify, renew, release, and takeover operations.
- Create `utils/profileWriterLease.test.ts`: expiry, foreign ownership, readback arbitration, malformed data, and storage failure tests.
- Create `hooks/useProfileWriterLease.ts`: page identity, acquisition settling, heartbeat, storage/visibility events, and lifecycle cleanup.
- Create `hooks/useProfileWriterLease.test.tsx`: hook acquisition, renewal, foreign takeover, expiry, and cleanup tests.
- Modify `utils/profileStorage.ts` and `utils/profileStorage.test.ts`: register the writer key for exact profile deletion.
- Modify `utils/pendingSaves.ts` and `utils/pendingSaves.test.ts`: retain ownership-block reasons and refuse unauthorized flushes.
- Modify `utils/gamePersistence.ts` and `utils/gamePersistence.test.ts`: add a typed ownership-conflict replacement result.
- Modify `context/GameContext.tsx`, `context/GameContext.test.tsx`, and `context/GameContext.persistence.test.ts`: gate all save paths, expose ownership actions, and support transactional reload-latest.
- Modify `utils/backups.ts` and `utils/backups.test.ts`: make backup writes accept an ownership verifier.
- Create `components/SaveConflictBanner.tsx` and `components/SaveConflictBanner.test.tsx`: accessible takeover, reload, and export recovery actions.
- Modify `components/SaveFailureBanner.tsx` and its test: route foreign ownership to the conflict banner and ownership-storage failure to the existing failure banner.
- Modify `App.tsx` and `App.lifecycle.test.tsx`: mount the conflict banner and verify the application flow.
- Modify `data/changelog.ts`, `data/changelog.test.ts`, and `data/contentBaseline.test.ts`: announce the completed player-facing protection.

---

### Task 1: Pure Profile Writer Lease Boundary

**Files:**
- Create: `utils/profileWriterLease.ts`
- Create: `utils/profileWriterLease.test.ts`
- Modify: `utils/profileStorage.ts:1-31`
- Modify: `utils/profileStorage.test.ts:1-79`

**Interfaces:**
- Produces `SaveOwnershipStatus = 'checking' | 'owner' | 'blocked'` and `SaveOwnershipBlockReason = 'foreign_owner' | 'storage_unavailable' | null`.
- Produces `writerLeaseKey(storageKey)`, `readWriterLease`, `claimWriterLease`, `verifyWriterLease`, `renewWriterLease`, and `releaseWriterLease`.
- Produces `WRITER_LEASE_TTL_MS = 30_000`, `WRITER_LEASE_RENEW_MS = 10_000`, and `WRITER_LEASE_ARBITRATION_MS = 50`.
- Adds the exact writer key to `profileOwnedKeys(profileId)`.

- [ ] **Step 1: Write the failing lease tests**

Create `utils/profileWriterLease.test.ts` with an in-memory storage fixture and these observable behaviours:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimWriterLease,
  readWriterLease,
  releaseWriterLease,
  renewWriterLease,
  verifyWriterLease,
  writerLeaseKey,
  WRITER_LEASE_TTL_MS,
} from './profileWriterLease';

const PROFILE = 'FATE_PROFILE_test';

describe('profile writer leases', () => {
  let values: Map<string, string>;
  let storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  beforeEach(() => {
    values = new Map();
    storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
    };
  });

  it('claims an empty lease and verifies only its owner', () => {
    expect(claimWriterLease(storage, PROFILE, 'tab-a', 1_000)).toMatchObject({
      status: 'owned',
      lease: { version: 1, ownerId: 'tab-a', expiresAt: 1_000 + WRITER_LEASE_TTL_MS },
    });
    expect(verifyWriterLease(storage, PROFILE, 'tab-a', 1_001).status).toBe('owned');
    expect(verifyWriterLease(storage, PROFILE, 'tab-b', 1_001).status).toBe('blocked');
  });

  it('blocks a normal claim behind an unexpired foreign owner', () => {
    claimWriterLease(storage, PROFILE, 'tab-a', 1_000);
    expect(claimWriterLease(storage, PROFILE, 'tab-b', 1_001).status).toBe('blocked');
    expect(readWriterLease(storage, PROFILE)).toMatchObject({
      ok: true,
      lease: { ownerId: 'tab-a' },
    });
  });

  it('claims an expired or malformed record', () => {
    claimWriterLease(storage, PROFILE, 'tab-a', 1_000);
    expect(claimWriterLease(
      storage,
      PROFILE,
      'tab-b',
      1_000 + WRITER_LEASE_TTL_MS + 1,
    ).status).toBe('owned');

    values.set(writerLeaseKey(PROFILE), '{bad');
    expect(claimWriterLease(storage, PROFILE, 'tab-c', 50_000).status).toBe('owned');
  });

  it('requires matching ownership to renew or release', () => {
    claimWriterLease(storage, PROFILE, 'tab-a', 1_000);
    expect(renewWriterLease(storage, PROFILE, 'tab-b', 2_000).status).toBe('blocked');
    expect(releaseWriterLease(storage, PROFILE, 'tab-b')).toBe('not_owner');
    expect(releaseWriterLease(storage, PROFILE, 'tab-a')).toBe('released');
    expect(values.has(writerLeaseKey(PROFILE))).toBe(false);
  });

  it('supports an explicit forced takeover', () => {
    claimWriterLease(storage, PROFILE, 'tab-a', 1_000);
    expect(claimWriterLease(storage, PROFILE, 'tab-b', 1_001, true)).toMatchObject({
      status: 'owned',
      lease: { ownerId: 'tab-b' },
    });
  });

  it('fails closed when storage cannot be read or written', () => {
    expect(claimWriterLease({
      getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }, PROFILE, 'tab-a', 1_000).status).toBe('unavailable');

    expect(claimWriterLease({
      getItem: () => null,
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem: vi.fn(),
    }, PROFILE, 'tab-a', 1_000).status).toBe('unavailable');
  });

  it('loses arbitration when another owner replaces the just-written claim', () => {
    storage.setItem = (key, value) => {
      values.set(key, value);
      values.set(key, JSON.stringify({ version: 1, ownerId: 'tab-b', expiresAt: 31_000 }));
    };
    expect(claimWriterLease(storage, PROFILE, 'tab-a', 1_000).status).toBe('blocked');
  });
});
```

- [ ] **Step 2: Add the failing profile-owned-key expectation**

In `utils/profileStorage.test.ts`, extend `expectedKeys` with:

```ts
`${base}__writer`,
```

Rename the count assertion from “six” to “seven”. Do not add a prefix scan or remove unrelated browser records.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm test -- utils/profileWriterLease.test.ts utils/profileStorage.test.ts
```

Expected: FAIL because `profileWriterLease.ts` and writer-key registration do not exist.

- [ ] **Step 4: Implement the minimal lease module**

Create `utils/profileWriterLease.ts` with these exact public types and constants:

```ts
export const WRITER_LEASE_VERSION = 1 as const;
export const WRITER_LEASE_TTL_MS = 30_000;
export const WRITER_LEASE_RENEW_MS = 10_000;
export const WRITER_LEASE_ARBITRATION_MS = 50;

export type SaveOwnershipStatus = 'checking' | 'owner' | 'blocked';
export type SaveOwnershipBlockReason = 'foreign_owner' | 'storage_unavailable' | null;
export type ProfileWriterLease = {
  version: typeof WRITER_LEASE_VERSION;
  ownerId: string;
  expiresAt: number;
};
export type WriterLeaseStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type WriterLeaseReadResult =
  | { ok: true; lease: ProfileWriterLease | null }
  | { ok: false; lease: null };
export type WriterLeaseOwnershipResult =
  | { status: 'owned'; lease: ProfileWriterLease }
  | { status: 'blocked'; lease: ProfileWriterLease | null }
  | { status: 'unavailable'; lease: null };
export type WriterLeaseReleaseResult = 'released' | 'not_owner' | 'unavailable';

export const writerLeaseKey = (storageKey: string): string => `${storageKey}__writer`;
```

Implement strict parsing: accept only an object with `version === 1`, a non-empty string `ownerId`, and a finite positive `expiresAt`; otherwise return `{ ok: true, lease: null }`. Catch storage access errors and return `{ ok: false, lease: null }`.

`claimWriterLease(storage, storageKey, ownerId, now, force = false)` must:

1. read the current lease;
2. return `unavailable` on a read error;
3. return `blocked` for an unexpired foreign lease unless `force` is true;
4. write `{ version: 1, ownerId, expiresAt: now + 30_000 }`;
5. read back and return `owned` only when the stored owner still matches;
6. return `blocked` for a valid foreign readback and `unavailable` for storage failure.

`verifyWriterLease` returns `owned` only for a matching, unexpired record. `renewWriterLease` refuses a foreign unexpired owner, writes a fresh expiry for the matching owner, then verifies. `releaseWriterLease` removes the key only after a matching-owner read.

- [ ] **Step 5: Register the writer key for exact deletion**

Import `writerLeaseKey` into `utils/profileStorage.ts` and append
`writerLeaseKey(storageKey)` to `profileOwnedKeys`. Keep the existing stable
order and transactional rollback logic unchanged.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- utils/profileWriterLease.test.ts utils/profileStorage.test.ts context/ProfileContext.test.tsx
```

Expected: all lease, exact-deletion, rollback, and pending-cleanup tests pass.

- [ ] **Step 7: Commit the lease boundary**

```powershell
git add utils/profileWriterLease.ts utils/profileWriterLease.test.ts utils/profileStorage.ts utils/profileStorage.test.ts
git commit -m "feat: add profile writer leases"
```

---

### Task 2: React Ownership Lifecycle

**Files:**
- Create: `hooks/useProfileWriterLease.ts`
- Create: `hooks/useProfileWriterLease.test.tsx`

**Interfaces:**
- Consumes Task 1 lease operations and timing constants.
- Produces `useProfileWriterLease(storageKey, options?)` returning `{ ownerId, status, verify, takeOver, release }`.
- `takeOver()` resolves `true` only after a forced claim survives the arbitration interval.
- `verify()` is synchronous and changes local state to `blocked` after a failed check.

- [ ] **Step 1: Write failing hook tests**

Create `hooks/useProfileWriterLease.test.tsx` under jsdom. Use `renderHook`, fake timers, and an in-memory storage implementation. Inject stable IDs and a fake clock through the options object.

```tsx
// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  writerLeaseKey,
  WRITER_LEASE_ARBITRATION_MS,
  WRITER_LEASE_RENEW_MS,
  WRITER_LEASE_TTL_MS,
} from '../utils/profileWriterLease';
import { useProfileWriterLease } from './useProfileWriterLease';

describe('useProfileWriterLease', () => {
  let values: Map<string, string>;
  let nowRef: { current: number };
  let storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  beforeEach(() => {
    vi.useFakeTimers();
    values = new Map();
    nowRef = { current: 1_000 };
    storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('settles an uncontested claim before becoming owner', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    expect(lease.result.current.status).toBe('checking');
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    expect(lease.result.current.status).toBe('owner');
    expect(lease.result.current.verify()).toBe(true);
  });

  it('stays blocked behind a live foreign owner and claims after expiry', async () => {
    values.set(writerLeaseKey('profile'), JSON.stringify({
      version: 1,
      ownerId: 'tab-a',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.blockedReason).toBe('foreign_owner');

    nowRef.current += WRITER_LEASE_TTL_MS + 1;
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_RENEW_MS));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    expect(lease.result.current.status).toBe('owner');
    expect(lease.result.current.blockedReason).toBeNull();
  });

  it('distinguishes unavailable storage from a foreign owner', async () => {
    const unavailableStorage = {
      getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage: unavailableStorage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));
    await act(async () => Promise.resolve());
    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.blockedReason).toBe('storage_unavailable');
  });

  it('becomes blocked when a foreign storage event replaces its lease', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    expect(lease.result.current.status).toBe('owner');

    const key = writerLeaseKey('profile');
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-b',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key })));

    expect(lease.result.current.status).toBe('blocked');
    expect(lease.result.current.verify()).toBe(false);
  });

  it('renews ownership and rechecks when the document becomes visible', async () => {
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-a',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));
    const key = writerLeaseKey('profile');
    const firstExpiry = JSON.parse(values.get(key)!).expiresAt;

    nowRef.current += WRITER_LEASE_RENEW_MS;
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_RENEW_MS));
    expect(JSON.parse(values.get(key)!).expiresAt).toBeGreaterThan(firstExpiry);

    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-b',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(lease.result.current.status).toBe('blocked');
  });

  it('forces takeover and cleans every timer and listener on unmount', async () => {
    const key = writerLeaseKey('profile');
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: 'tab-a',
      expiresAt: nowRef.current + WRITER_LEASE_TTL_MS,
    }));
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const lease = renderHook(() => useProfileWriterLease('profile', {
      storage,
      ownerId: 'tab-b',
      now: () => nowRef.current,
    }));
    await act(async () => vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS));

    let tookOver = false;
    await act(async () => {
      const result = lease.result.current.takeOver();
      await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
      tookOver = await result;
    });
    expect(tookOver).toBe(true);
    expect(JSON.parse(values.get(key)!).ownerId).toBe('tab-b');

    lease.unmount();
    expect(removeWindow).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
```

The storage-event test must dispatch a real jsdom `StorageEvent`; do not call a test-only production handler.

- [ ] **Step 2: Run the hook tests and verify RED**

Run:

```powershell
npm test -- hooks/useProfileWriterLease.test.tsx
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook with injected test boundaries**

Create `hooks/useProfileWriterLease.ts` with:

```ts
export interface ProfileWriterLeaseOptions {
  storage?: WriterLeaseStorage;
  ownerId?: string;
  now?: () => number;
  arbitrationMs?: number;
  renewMs?: number;
}

export interface ProfileWriterLeaseHandle {
  ownerId: string;
  status: SaveOwnershipStatus;
  blockedReason: SaveOwnershipBlockReason;
  verify: () => boolean;
  takeOver: () => Promise<boolean>;
  release: () => boolean;
}
```

Use one lazily created module-level page owner ID in production. Generate it with `crypto.randomUUID()` and retain the existing date/random fallback pattern used elsewhere when unavailable. Tests pass `ownerId` explicitly.

The hook must:

- enter `checking`, claim normally, wait `WRITER_LEASE_ARBITRATION_MS`, then verify before entering `owner`;
- enter `blocked` with `foreign_owner` after a foreign result and with `storage_unavailable` after a storage error;
- run one interval every `WRITER_LEASE_RENEW_MS`: renew when owner, otherwise attempt a normal claim so expired/crashed ownership recovers;
- listen to `storage` only for `writerLeaseKey(storageKey)` and re-run claim/verification;
- listen to `visibilitychange` and recheck only when `document.visibilityState === 'visible'`;
- invalidate an earlier asynchronous arbitration attempt with a monotonically increasing attempt token;
- clean the interval, arbitration timeout, and both listeners on unmount;
- make `verify` read synchronously and fail closed;
- make `takeOver` force-claim, arbitrate, and resolve `true` only if the same owner still verifies;
- make `release` remove only a matching lease and never release automatically from the hook cleanup.

Do not place game serialization, pending-save access, confirmation copy, or toast logic in this hook.

- [ ] **Step 4: Run hook and lease tests and verify GREEN**

Run:

```powershell
npm test -- hooks/useProfileWriterLease.test.tsx utils/profileWriterLease.test.ts
```

Expected: all ownership lifecycle tests pass with no leaked fake timers or listeners.

- [ ] **Step 5: Commit lifecycle coordination**

```powershell
git add hooks/useProfileWriterLease.ts hooks/useProfileWriterLease.test.tsx
git commit -m "feat: coordinate profile writer lifecycle"
```

---

### Task 3: Typed Ownership-Blocked Persistence

**Files:**
- Modify: `utils/pendingSaves.ts`
- Modify: `utils/pendingSaves.test.ts`
- Modify: `utils/gamePersistence.ts`
- Modify: `utils/gamePersistence.test.ts`
- Modify: `utils/backups.ts`
- Modify: `utils/backups.test.ts`
- Modify: `context/GameContext.tsx` only to satisfy the new required callback signatures

**Interfaces:**
- Adds `PendingSaveReason = 'storage_unavailable' | 'ownership_conflict'`.
- Changes `flushPendingSave(storage, storageKey, canWrite)` so authorization is mandatory.
- Adds `blockPendingSave(storageKey)` while keeping ownership-blocked entries in `saving`, not `failed`, status.
- Adds `SaveOwnershipConflictError` and `ownershipConflictResult()`.
- Extends `ImportErrorCode` and `BackupWriteResult` with `ownership_conflict`.
- Changes `pushBackup(storageKey, data, reason, canWrite)` so authorization is mandatory.

- [ ] **Step 1: Write failing pending-save authorization tests**

Extend `utils/pendingSaves.test.ts`:

```ts
it('keeps a blocked snapshot without invoking storage', () => {
  const setItem = vi.fn();
  stagePendingSave('profile-a', '{"keys":9}');

  expect(flushPendingSave({ setItem }, 'profile-a', () => false)).toEqual({
    ok: false,
    reason: 'ownership_conflict',
  });
  expect(setItem).not.toHaveBeenCalled();
  expect(getPendingSave('profile-a')).toMatchObject({
    data: '{"keys":9}',
    status: 'saving',
    reason: 'ownership_conflict',
  });
  expect(getSaveStatus('profile-a')).toBe('saving');
});
```

Update every existing `flushPendingSave` call in the test to pass `() => true`.

- [ ] **Step 2: Write failing replacement and backup authorization tests**

In `utils/gamePersistence.test.ts`, add a replacement callback that throws
`new SaveOwnershipConflictError()` and assert:

```ts
expect(result).toEqual({
  ok: false,
  code: 'ownership_conflict',
  message: 'This profile is being saved by another tab. Take over before replacing it.',
});
expect(replace).not.toHaveBeenCalled();
```

In `utils/backups.test.ts`, update existing calls to pass `() => true`, then add:

```ts
it('does not read or write the backup ring without ownership', () => {
  const getItem = vi.spyOn(localStorage, 'getItem');
  const setItem = vi.spyOn(localStorage, 'setItem');
  expect(pushBackup(KEY, save(), 'blocked', () => false)).toEqual({
    stored: false,
    reason: 'ownership_conflict',
  });
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npm test -- utils/pendingSaves.test.ts utils/gamePersistence.test.ts utils/backups.test.ts
```

Expected: FAIL because ownership-conflict types and mandatory authorizers do not exist.

- [ ] **Step 4: Implement the pending-save gate**

In `utils/pendingSaves.ts`:

```ts
export type PendingSaveReason = 'storage_unavailable' | 'ownership_conflict';
```

Require `canWrite: () => boolean` in `flushPendingSave`. If it returns false,
retain the entry with `status: 'saving'` and `reason: 'ownership_conflict'`, emit
only when the entry changes, and return the typed conflict without calling
storage. `blockPendingSave` applies the same state to an already staged entry.
Storage exceptions still produce `status: 'failed'` and
`reason: 'storage_unavailable'`. A successful write still clears the entry.

- [ ] **Step 5: Implement typed replacement conflicts**

In `utils/gamePersistence.ts`:

```ts
export class SaveOwnershipConflictError extends Error {
  constructor() {
    super('Profile save ownership is held by another tab.');
    this.name = 'SaveOwnershipConflictError';
  }
}

export const ownershipConflictResult = (): ImportResult => ({
  ok: false,
  code: 'ownership_conflict',
  message: 'This profile is being saved by another tab. Take over before replacing it.',
});
```

Add `'ownership_conflict'` to `ImportErrorCode`. In the replacement write catch,
return `ownershipConflictResult()` only for `SaveOwnershipConflictError`; keep
all other exceptions mapped to `storage_unavailable`. Add
`'ownership_conflict'` to the false `BackupWriteResult.reason` union.

- [ ] **Step 6: Gate backup writes before reading the ring**

Change `pushBackup` to require `canWrite: () => boolean`. Return
`{ stored: false, reason: 'ownership_conflict' }` before `readAll` when false.
Do not gate `listBackups` or `getBackupData`, which are read-only.
Update every existing `pushBackup` call in `utils/gamePersistence.test.ts`
to pass `() => true`. Update the current `GameContext` calls to
`flushPendingSave` and `pushBackup` with an explicit `() => true` only as
a compile-preserving bridge. Task 4 replaces every bridge callback with
`lease.verify`; no production authorizer may remain hard-coded true afterward.


- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- utils/pendingSaves.test.ts utils/gamePersistence.test.ts utils/backups.test.ts
npm run typecheck
```

Expected: all tests pass, blocked callbacks perform zero durable reads/writes, and storage failures remain distinct.

- [ ] **Step 8: Commit typed persistence gates**

```powershell
git add utils/pendingSaves.ts utils/pendingSaves.test.ts utils/gamePersistence.ts utils/gamePersistence.test.ts utils/backups.ts utils/backups.test.ts context/GameContext.tsx
git commit -m "fix: gate profile persistence by ownership"
```

---

### Task 4: GameProvider Ownership Integration

**Files:**
- Modify: `context/GameContext.tsx:20-74,128-176,1212-1314,1439-1483,1588-1650`
- Modify: `context/GameContext.test.tsx:1-130`
- Modify: `context/GameContext.persistence.test.ts:1-46`

**Interfaces:**
- Consumes `useProfileWriterLease`, mandatory persistence authorizers, and typed conflict results.
- Adds `saveOwnershipStatus`, `saveOwnershipBlockReason`, `hasPendingChanges`, `takeOverSaveOwnership()`, and `reloadLatestSave()` to `GameContextType`.
- `takeOverSaveOwnership(): Promise<boolean>` flushes the newest local snapshot only after verified takeover.
- `reloadLatestSave(): ImportResult` replaces state only after reading and validating durable storage.

- [ ] **Step 1: Add failing ordinary-save conflict tests**

Extend the `ordinary save recovery` suite in `context/GameContext.test.tsx`. Make
the renderer accept hook ownership through the real lease storage records; do
not mock `useProfileWriterLease`.

Add these tests with fake timers:

```tsx
import type { ImportResult } from '../utils/gamePersistence';
import { getPendingSave } from '../utils/pendingSaves';
import { profileBackupKey } from '../utils/profileStorage';
import {
  writerLeaseKey,
  WRITER_LEASE_ARBITRATION_MS,
  WRITER_LEASE_TTL_MS,
} from '../utils/profileWriterLease';
import type { ProfileWriterLeaseOptions } from '../hooks/useProfileWriterLease';

const renderGame = (
  storageKey: string,
  leaseOptions: ProfileWriterLeaseOptions = { ownerId: 'test-tab' },
) => {
  let current: Game | undefined;
  const rendered = render(
    <GameProvider storageKey={storageKey} leaseOptions={leaseOptions}>
      <GameCapture onGame={game => { current = game; }} />
    </GameProvider>,
  );
  return {
    ...rendered,
    current: () => {
      if (!current) throw new Error('Game provider did not initialize');
      return current;
    },
  };
};

const settleOwnership = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
  });
};

const seedForeignWriterLease = (storageKey: string, ownerId: string) => {
  storage.values.set(writerLeaseKey(storageKey), JSON.stringify({
    version: 1,
    ownerId,
    expiresAt: Date.now() + WRITER_LEASE_TTL_MS,
  }));
};

const readStoredNote = (storageKey: string, noteId: string): string | undefined =>
  JSON.parse(storage.values.get(storageKey) ?? '{}').userNotes?.[noteId];

it('retains the newest blocked-tab state without writing the profile', async () => {
  seedForeignWriterLease('profile', 'tab-a');
  const game = renderGame('profile', { ownerId: 'tab-b' });
  await settleOwnership();
  expect(game.current().saveOwnershipStatus).toBe('blocked');

  act(() => game.current().saveNote('goal', 'first'));
  act(() => game.current().saveNote('goal', 'newest'));
  await act(async () => vi.advanceTimersByTimeAsync(500));

  expect(game.current().hasPendingChanges).toBe(true);
  expect(getPendingSave('profile')?.data).toContain('newest');
  expect(readStoredNote('profile', 'goal')).not.toBe('newest');
});

it('stops a queued save after ownership changes before the debounce', async () => {
  const game = renderGame('profile', { ownerId: 'tab-a' });
  await settleOwnership();
  await act(async () => vi.advanceTimersByTimeAsync(500));
  const durableBeforeChange = storage.values.get('profile');

  act(() => game.current().saveNote('goal', 'must stay local'));
  const writerKey = writerLeaseKey('profile');
  storage.values.set(writerKey, JSON.stringify({
    version: 1,
    ownerId: 'tab-b',
    expiresAt: Date.now() + WRITER_LEASE_TTL_MS,
  }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: writerKey })));
  await act(async () => vi.advanceTimersByTimeAsync(500));

  expect(game.current().saveOwnershipStatus).toBe('blocked');
  expect(storage.values.get('profile')).toBe(durableBeforeChange);
  expect(getPendingSave('profile')?.data).toContain('must stay local');
});

it('takes over and flushes the newest blocked state', async () => {
  seedForeignWriterLease('profile', 'tab-a');
  const game = renderGame('profile', { ownerId: 'tab-b' });
  await settleOwnership();
  act(() => game.current().saveNote('goal', 'first'));
  act(() => game.current().saveNote('goal', 'newest'));

  let tookOver = false;
  await act(async () => {
    const takeover = game.current().takeOverSaveOwnership();
    await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS);
    tookOver = await takeover;
  });

  expect(tookOver).toBe(true);
  expect(game.current().saveOwnershipStatus).toBe('owner');
  expect(readStoredNote('profile', 'goal')).toBe('newest');
  expect(getPendingSave('profile')).toBeNull();
});
```

Expose a test-only optional `leaseOptions?: ProfileWriterLeaseOptions` prop on
`GameProvider`; production callers omit it. This is dependency injection, not a
test-only ownership bypass.

- [ ] **Step 2: Add failing transactional reload and replacement tests**

Add provider tests proving:

1. `reloadLatestSave()` validates the stored state, replaces the reducer,
   updates the durable-baseline reference, clears pending data, and leaves
   ownership blocked.
2. Invalid stored JSON returns the parser error and leaves both current state
   and pending data unchanged.
3. `importSave` and `restoreBackup` return `ownership_conflict` while blocked
   and do not write the profile or backup ring.
4. `createBackup` returns `ownership_conflict` and performs no write while blocked.
5. A reset may update the blocked tab's in-memory state, but the resulting
   snapshot remains pending and the backup ring is untouched.

Use the real provider API in the tests:

```tsx
it('reloads the latest valid durable state and clears local pending data', async () => {
  seedForeignWriterLease('profile', 'tab-a');
  const game = renderGame('profile', { ownerId: 'tab-b' });
  await settleOwnership();
  const durable = JSON.parse(game.current().getExportData());
  durable.userNotes.goal = 'durable';
  storage.values.set('profile', JSON.stringify(durable));

  act(() => game.current().saveNote('goal', 'local-only'));
  expect(game.current().hasPendingChanges).toBe(true);
  let result: ImportResult | undefined;
  act(() => { result = game.current().reloadLatestSave(); });

  expect(result?.ok).toBe(true);
  expect(game.current().userNotes.goal).toBe('durable');
  expect(game.current().hasPendingChanges).toBe(false);
  expect(game.current().saveOwnershipStatus).toBe('blocked');
});

it('leaves local state and pending data untouched when reload validation fails', async () => {
  seedForeignWriterLease('profile', 'tab-a');
  const game = renderGame('profile', { ownerId: 'tab-b' });
  await settleOwnership();
  act(() => game.current().saveNote('goal', 'keep me'));
  const pendingBefore = getPendingSave('profile')?.data;
  const stateBefore = game.current().getExportData();
  storage.values.set('profile', '{bad');

  let result: ImportResult | undefined;
  act(() => { result = game.current().reloadLatestSave(); });

  expect(result?.ok).toBe(false);
  expect(game.current().getExportData()).toBe(stateBefore);
  expect(getPendingSave('profile')?.data).toBe(pendingBefore);
});

it('blocks import, restore, and backup writes behind foreign ownership', async () => {
  seedForeignWriterLease('profile', 'tab-a');
  const game = renderGame('profile', { ownerId: 'tab-b' });
  await settleOwnership();
  const candidate = game.current().getExportData();
  storage.values.set(profileBackupKey('profile'), JSON.stringify([{
    ts: 7,
    reason: 'fixture',
    summary: 'fixture',
    data: candidate,
  }]));
  const durableBefore = storage.values.get('profile');
  const backupsBefore = storage.values.get(profileBackupKey('profile'));

  expect(game.current().importSave(candidate)).toMatchObject({
    ok: false,
    code: 'ownership_conflict',
  });
  expect(game.current().restoreBackup(7)).toMatchObject({
    ok: false,
    code: 'ownership_conflict',
  });
  expect(game.current().createBackup('blocked')).toEqual({
    stored: false,
    reason: 'ownership_conflict',
  });
  expect(storage.values.get('profile')).toBe(durableBefore);
  expect(storage.values.get(profileBackupKey('profile'))).toBe(backupsBefore);
});

it('keeps a blocked reset in memory without writing a backup', async () => {
  seedForeignWriterLease('profile', 'tab-a');
  const game = renderGame('profile', { ownerId: 'tab-b' });
  await settleOwnership();
  const backupsBefore = storage.values.get(profileBackupKey('profile'));

  act(() => game.current().resetGame());

  expect(game.current().hasPendingChanges).toBe(true);
  expect(getPendingSave('profile')).not.toBeNull();
  expect(storage.values.get(profileBackupKey('profile'))).toBe(backupsBefore);
});
```

In `context/GameContext.persistence.test.ts`, change `DurableWriter` to include
`canWrite: () => boolean`, update the successful/failing calls with
`() => true`, and add a blocked call that throws `SaveOwnershipConflictError`
before writing or cancelling the debounce.

- [ ] **Step 3: Run provider tests and verify RED**

Run:

```powershell
npm test -- context/GameContext.test.tsx context/GameContext.persistence.test.ts
```

Expected: FAIL because ownership context fields, provider injection, and guarded write paths are absent.

- [ ] **Step 4: Add a durable-state baseline**

Before the reducer initializer, create:

```ts
const persistedSnapshotRef = useRef<string | null>(null);
```

During initialization, retain the exact durable profile string in this ref.
If a page-lifetime pending snapshot loads ahead of durable storage, keep the
durable string as the baseline. The persistence effect must serialize current
state and skip staging when it equals the durable baseline and there is no
pending entry. This prevents a blocked read-only tab from claiming unsaved
changes merely by mounting.

After every successful normal or replacement write, set the baseline to the
exact serialized string that was written. A migrated/normalized save whose
canonical serialization differs from durable storage remains eligible for one
owned write, preserving the current migration behaviour.

- [ ] **Step 5: Integrate ownership with ordinary writes and lifecycle**

Call `useProfileWriterLease(storageKey, leaseOptions)` and expose its status.
Pass `lease.verify` to every `flushPendingSave` call.

`flushCurrentSave` must:

1. capture the pending data before flushing;
2. call the mandatory authorization-aware flush;
3. set the baseline and `saveStatus: 'saved'` on success;
4. set `saveStatus: 'failed'` for an unavailable profile write or
   `saveOwnershipBlockReason === 'storage_unavailable'`;
5. keep `saveStatus` at the registry's `saving` value for a
   `foreign_owner` conflict.

The state effect depends on ownership status. It stages changed state in every
status, schedules the normal 500 ms flush only as owner, and calls
`blockPendingSave` while checking/blocked. When ownership changes to owner with
a pending snapshot, schedule the normal flush unless takeover requested an
immediate one.

On provider teardown and `pagehide`, attempt a guarded immediate flush. Release
the lease only when the flush succeeded and `getPendingSave(storageKey)` is
null. Never release a foreign lease or release after an unavailable-storage or
ownership-conflict result.

- [ ] **Step 6: Gate explicit writes and backups**

Change `writeReplacementNow` to require `canWrite`. Throw
`SaveOwnershipConflictError` before `storage.setItem` when false; preserve the
existing rule that the obsolete debounce is cancelled only after a successful
write.

Create one provider-local `pushOwnedBackup(data, reason)` wrapper passing
`lease.verify` into `pushBackup`. Use it for session-start, import, restore,
manual backup, and reset paths. Reads remain allowed.

Every explicit replacement routes through guarded `writeReplacementNow`.
Update the durable baseline and discard pending data only after that write
succeeds.

- [ ] **Step 7: Implement takeover and reload-latest**

Add:

```ts
const takeOverSaveOwnership = useCallback(async (): Promise<boolean> => {
  const owned = await lease.takeOver();
  if (!owned) return false;
  stagePendingSave(storageKey, serializeCurrent());
  setSaveStatus(getSaveStatus(storageKey));
  return flushCurrentSave();
}, [flushCurrentSave, lease, serializeCurrent, storageKey]);
```

Keep dependencies stable by destructuring stable hook callbacks/status rather
than depending on a newly allocated handle object.

`reloadLatestSave` must read `localStorage.getItem(storageKey)`, fail with a
safe `invalid_json` result if missing, call `parseAndMigrateSave`, and only on a
successful parse:

- serialize the accepted normalized state;
- set `persistedSnapshotRef.current` to that serialization;
- discard the pending snapshot;
- set save status to `saved`;
- replace reducer state without calling the durable writer.

On storage access or validation failure, return the typed failure and leave
state, baseline, and pending data unchanged.

- [ ] **Step 8: Expose context state and run focused tests GREEN**

Add to `GameContextType` and `contextValue`:

```ts
saveOwnershipStatus: SaveOwnershipStatus;
saveOwnershipBlockReason: SaveOwnershipBlockReason;
hasPendingChanges: boolean;
takeOverSaveOwnership: () => Promise<boolean>;
reloadLatestSave: () => ImportResult;
```

Derive `hasPendingChanges` from the active storage key and subscribe to the
pending registry with `useSyncExternalStore`, rather than reading the registry
only once per render.

Run:

```powershell
npm test -- context/GameContext.test.tsx context/GameContext.persistence.test.ts utils/pendingSaves.test.ts utils/backups.test.ts utils/gamePersistence.test.ts
```

Expected: all ordinary recovery, ownership, import/restore/reset, and backup tests pass.

- [ ] **Step 9: Commit provider protection**

```powershell
git add context/GameContext.tsx context/GameContext.test.tsx context/GameContext.persistence.test.ts
git commit -m "fix: protect game saves from tab conflicts"
```

---

### Task 5: Accessible Conflict Recovery Banner

**Files:**
- Create: `components/SaveConflictBanner.tsx`
- Create: `components/SaveConflictBanner.test.tsx`
- Modify: `components/SaveFailureBanner.tsx`
- Modify: `components/SaveFailureBanner.test.tsx`

**Interfaces:**
- Produces `SaveConflictBannerView` with injected status/actions/confirmation for deterministic tests.
- Produces a thin `SaveConflictBanner` wrapper over real game/profile contexts.
- Shows `SaveConflictBanner` only for `foreign_owner`; keeps `SaveFailureBanner` active for ownership-storage failure.

- [ ] **Step 1: Write failing conflict-banner tests**

Create `components/SaveConflictBanner.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveConflictBannerView } from './SaveConflictBanner';

afterEach(cleanup);

describe('SaveConflictBannerView', () => {
  it('confirms takeover and keeps the warning after a failed claim', async () => {
    const takeOver = vi.fn().mockResolvedValue(false);
    const confirmAction = vi.fn().mockReturnValue(true);
    render(<SaveConflictBannerView
      status="blocked"
      hasPendingChanges
      takeOver={takeOver}
      reloadLatest={() => ({ ok: true, warnings: [] })}
      exportBackup={() => ({ ok: true })}
      confirmAction={confirmAction}
    />);
    await userEvent.click(screen.getByRole('button', { name: 'Take over and save this tab' }));
    expect(confirmAction).toHaveBeenCalledOnce();
    expect(takeOver).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('does not discard pending changes when confirmation is cancelled', async () => {
    const reloadLatest = vi.fn();
    render(<SaveConflictBannerView
      status="blocked"
      hasPendingChanges
      takeOver={async () => false}
      reloadLatest={reloadLatest}
      exportBackup={() => ({ ok: true })}
      confirmAction={() => false}
    />);
    await userEvent.click(screen.getByRole('button', { name: 'Discard this tab and reload latest' }));
    expect(reloadLatest).not.toHaveBeenCalled();
  });

  it('reloads without confirmation when the tab has no pending changes', async () => {
    const reloadLatest = vi.fn().mockReturnValue({ ok: true, warnings: [] });
    const confirmAction = vi.fn().mockReturnValue(true);
    render(
      <SaveConflictBannerView
        status="blocked"
        hasPendingChanges={false}
        takeOver={async () => false}
        reloadLatest={reloadLatest}
        exportBackup={() => ({ ok: true })}
        confirmAction={confirmAction}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Discard this tab and reload latest' }));
    expect(reloadLatest).toHaveBeenCalledOnce();
    expect(confirmAction).not.toHaveBeenCalled();
  });

  it('exports without dismissing or changing ownership', async () => {
    const exportBackup = vi.fn().mockReturnValue({ ok: true });
    render(
      <SaveConflictBannerView
        status="blocked"
        hasPendingChanges
        takeOver={async () => false}
        reloadLatest={() => ({ ok: true, warnings: [] })}
        exportBackup={exportBackup}
        confirmAction={() => true}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(exportBackup).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders nothing while checking or owning', () => {
    const props = {
      hasPendingChanges: false,
      takeOver: async () => false,
      reloadLatest: () => ({ ok: true as const, warnings: [] }),
      exportBackup: () => ({ ok: true as const }),
      confirmAction: () => true,
    };
    const { rerender } = render(
      <SaveConflictBannerView status="checking" {...props} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<SaveConflictBannerView status="owner" {...props} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
```

Use the exact approved copy and button labels from the design.

- [ ] **Step 2: Add a failing storage-banner priority test**

Update `SaveFailureBannerView` to accept an ownership block reason and add two
tests: `foreign_owner` suppresses the storage-failure alert, while
`storage_unavailable` keeps it visible. Update existing tests with a null
block reason.

- [ ] **Step 3: Run banner tests and verify RED**

Run:

```powershell
npm test -- components/SaveConflictBanner.test.tsx components/SaveFailureBanner.test.tsx
```

Expected: FAIL because the conflict banner and ownership-priority behaviour do not exist.

- [ ] **Step 4: Implement the conflict banner view**

`SaveConflictBannerView` accepts:

```ts
interface SaveConflictBannerViewProps {
  status: SaveOwnershipStatus;
  hasPendingChanges: boolean;
  takeOver: () => Promise<boolean>;
  reloadLatest: () => ImportResult;
  exportBackup: () => FateSaveDownloadResult;
  confirmAction?: (message: string) => boolean;
}
```

Render nothing unless `status === 'blocked'`. Use `role="alert"` and
`aria-live="assertive"`. Keep separate `takingOver` and `reloading` state,
disable all destructive actions while either operation is active, and expose
`Taking over…` / `Reloading…` button text.

Takeover confirmation text:

```text
Another tab may have newer saved progress. Take over and save this tab instead?
```

Pending reload confirmation text:

```text
Discard this tab's unsaved changes and reload the latest saved progress?
```

Show existing toast feedback for success/failure. A failed action never hides
the banner. Export uses the shared download helper and never changes ownership.

- [ ] **Step 5: Implement thin context wrappers and priority**

`SaveConflictBanner` reads the ownership status, block reason, recovery
actions, current export data, and profile key. It renders the view only for
`blocked` plus `foreign_owner`, and passes `window.confirm` and
`downloadFateSave(getExportData(), storageKeyForActiveProfile)` to it.

`SaveFailureBanner` suppresses its view only for `foreign_owner`. It remains
visible for `storage_unavailable` so a browser-storage failure never claims
that another tab is open; keep its existing quota recovery copy unchanged.

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
npm test -- components/SaveConflictBanner.test.tsx components/SaveFailureBanner.test.tsx utils/fateSaveFile.test.ts
```

Expected: all conflict, storage-failure, and export tests pass.

```powershell
git add components/SaveConflictBanner.tsx components/SaveConflictBanner.test.tsx components/SaveFailureBanner.tsx components/SaveFailureBanner.test.tsx
git commit -m "feat: add cross-tab save conflict banner"
```

---

### Task 6: App Integration, Release Notes, and Milestone Verification

**Files:**
- Modify: `App.tsx:24-31,954-972`
- Modify: `App.lifecycle.test.tsx`
- Modify: `data/changelog.ts:1-30`
- Modify: `data/changelog.test.ts:1-31`
- Modify: `data/contentBaseline.test.ts` only where it asserts the latest release ID or count

**Interfaces:**
- Mounts `<SaveConflictBanner />` directly below `<Header />` and before `<SaveFailureBanner />`.
- Produces the completed player-facing milestone without changing deployment configuration.

- [ ] **Step 1: Add the failing application lifecycle test**

Extend the App lifecycle storage fixture so tests can seed and inspect
`writerLeaseKey(profileKey)`. Stub `crypto.randomUUID()` with a stable local tab
ID and `window.confirm` with `true`.

Add one integrated test:

```tsx
it('blocks a foreign-owned profile and saves only after confirmed takeover', async () => {
  const profileKey = profileBaseKey(PROFILE_ID);
  const readyState = JSON.parse(seedOnboardingRun());
  readyState.hasSeenOnboarding = true;
  storage.setItem(profileKey, JSON.stringify(readyState));
  storage.setItem(writerLeaseKey(profileKey), JSON.stringify({
    version: 1,
    ownerId: 'other-tab',
    expiresAt: Date.now() + 30_000,
  }));
  storage.setItem(changelogStorageKey, latestChangelogId);
  const user = userEvent.setup();
  render(<App />);

  const conflict = await screen.findByRole('alert');
  expect(conflict.textContent).toContain('This profile is open in another tab');
  await user.click(screen.getByRole('button', { name: 'Settings & save tools' }));
  await user.click(screen.getByRole('button', { name: /Animations/ }));
  await new Promise(resolve => window.setTimeout(resolve, 550));
  expect(JSON.parse(values.get(profileKey)!).animationsEnabled).toBe(readyState.animationsEnabled);

  await user.click(screen.getByRole('button', { name: 'Take over and save this tab' }));
  await waitFor(() => expect(screen.queryByText('This profile is open in another tab')).toBeNull());
  expect(window.confirm).toHaveBeenCalledOnce();
  expect(JSON.parse(values.get(profileKey)!).animationsEnabled).toBe(!readyState.animationsEnabled);
});
```

Also assert the beforeunload guard is active while the blocked tab has pending
changes and clears after successful takeover flush.

- [ ] **Step 2: Run the lifecycle test and verify RED**

Run:

```powershell
npm test -- App.lifecycle.test.tsx
```

Expected: FAIL because the conflict banner is not mounted.

- [ ] **Step 3: Mount the banner and update release notes**

Import and render:

```tsx
<Header ... />
<SaveConflictBanner />
<SaveFailureBanner />
```

Add the newest changelog release:

```ts
{
  id: '2026-08-01-cross-tab-safety',
  title: 'Safer Multi-Tab Play',
  date: '2026-08-01',
  sections: {
    added: [
      'A clear warning now appears when the same profile is open in another tab, with takeover, reload, and export recovery actions.',
    ],
    fixed: [
      'Two browser tabs can no longer silently overwrite the same profile while both appear to be saving.',
    ],
  },
},
```

Update the latest-ID test to `2026-08-01-cross-tab-safety` and add a focused
assertion for both player-facing notes. Change content-baseline expectations
only if they explicitly count or name the latest release.

- [ ] **Step 4: Run focused integration and release checks GREEN**

Run:

```powershell
npm test -- App.lifecycle.test.tsx components/SaveConflictBanner.test.tsx components/SaveFailureBanner.test.tsx hooks/useProfileWriterLease.test.tsx context/GameContext.test.tsx utils/profileWriterLease.test.ts data/changelog.test.ts data/contentBaseline.test.ts
npm run changelog:verify
```

Expected: all focused tests pass and player-facing changelog verification exits 0.

- [ ] **Step 5: Run the complete automated verification gates**

Run in this order:

```powershell
npm test
npm run typecheck
$env:VITE_BASE='/OSRS-Fate-Locked/'; npm run build
git diff --check
git status --short
```

Expected:

- More than the current 1,498 tests pass with zero failures.
- TypeScript exits 0.
- The GitHub Pages production build exits 0.
- Existing Vite deprecation and bundle-size warnings may remain; no new runtime
  or ownership warning is introduced.
- Only intentional milestone files are modified before the final commit.

On Windows, restore only the build-generated line-ending change to
`data/modelManifest.ts` with:

```powershell
git checkout-index --force -- data/modelManifest.ts
```

Do not alter the known generated-content line-ending issue in
`data/chunkContentLite.ts` or
`data/sources/chunk-content-transform-audit.json` in this milestone.

- [ ] **Step 6: Commit verified integration**

```powershell
git add App.tsx App.lifecycle.test.tsx data/changelog.ts data/changelog.test.ts data/contentBaseline.test.ts
git commit -m "test: verify cross-tab save ownership flow"
```

Stage `data/contentBaseline.test.ts` only if Step 3 required an intentional
change; otherwise leave it untouched.

- [ ] **Step 7: Perform the real two-tab browser walkthrough**

Build and serve the branch with the correct GitHub Pages base:

```powershell
$env:VITE_BASE='/OSRS-Fate-Locked/'
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Using the in-app browser workflow, open two same-origin tabs at
`http://127.0.0.1:4173/OSRS-Fate-Locked/` and verify:

1. Tab A settles as owner with no warning.
2. Tab B shows the conflict warning and may still navigate/change a setting.
3. Tab B's change does not alter stored progress before takeover.
4. Export backup succeeds from Tab B without dismissing the warning.
5. Confirmed takeover in Tab B saves its newest state.
6. Tab A receives the storage event and becomes blocked before another write.
7. Discard/reload in Tab A loads Tab B's saved state transactionally.
8. Closing the current owner allows the other tab to claim after lease expiry;
   explicit takeover remains available immediately.
9. No console error, duplicate timer warning, or white screen occurs.

Capture screenshots of the blocked warning and post-takeover state for the
review handoff. Do not inspect or expose unrelated local-storage values.

- [ ] **Step 8: Stop for joint review**

Report:

- the exact commit list;
- full test count, typecheck, build, and changelog results;
- the two-tab walkthrough results and screenshots;
- known browser/runtime limitations;
- confirmation that the branch has not been merged, pushed, or deployed.

Do not update the live app until the user approves this milestone.
