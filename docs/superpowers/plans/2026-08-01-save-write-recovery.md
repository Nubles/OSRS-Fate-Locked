# Save-Write Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and visibly recover the newest active-profile state when an ordinary browser-storage save fails.

**Architecture:** A page-lifetime registry stages the newest serialized snapshot per profile and owns safe write attempts. `GameProvider` integrates that registry with the existing debounce and exposes active save health; a global guard protects all staged profiles during unload, and a focused banner provides retry and export recovery actions.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, browser `localStorage`, `beforeunload`

## Global Constraints

- Keep gameplay available while storage is unavailable.
- Preserve the current successful-save debounce interval.
- Retain only the newest pending snapshot per profile.
- Preserve pending data across profile switches for the lifetime of the page.
- Do not implement cross-tab merging, IndexedDB, relay changes, or corrupt-metadata recovery.
- Never dismiss the failure banner until browser storage succeeds.
- Export must use current in-memory state and must not claim browser persistence recovered.
- Follow red-green-refactor for every production change.
- Do not deploy until the completed milestone is reviewed with the user.

---

## File map

- Create `utils/pendingSaves.ts`: page-lifetime pending snapshot registry and safe flush API.
- Create `utils/pendingSaves.test.ts`: pure registry replacement, failure, recovery, subscription, and profile-isolation tests.
- Modify `context/GameContext.tsx`: stage state, safely debounce/flush, restore a staged profile, expose `saveStatus` and `retrySave`.
- Extend `context/GameContext.test.tsx` and `context/GameContext.persistence.test.ts`: provider save-health, newest-state, retry, and teardown tests.
- Create `components/SaveRecoveryGuard.tsx`: one global `beforeunload` subscriber.
- Create `components/SaveRecoveryGuard.test.tsx`: unload-listener lifecycle tests.
- Modify `context/ProfileContext.tsx` and create `context/ProfileContext.test.tsx`: discard pending memory after successful profile deletion.
- Create `utils/fateSaveFile.ts` and `utils/fateSaveFile.test.ts`: shared `.fate` download operation.
- Modify `App.tsx` and `components/BackupNagBanner.tsx`: reuse the shared export operation.
- Create `components/SaveFailureBanner.tsx` and `components/SaveFailureBanner.test.tsx`: persistent recovery UI.
- Extend `App.lifecycle.test.tsx`: verify the guard/banner are integrated at the correct lifecycle boundaries.

---

### Task 1: Pending-save registry

**Files:**
- Create: `utils/pendingSaves.ts`
- Create: `utils/pendingSaves.test.ts`

**Interfaces:**
- Produces `SaveStatus = 'saved' | 'saving' | 'failed'`.
- Produces `stagePendingSave(storageKey, data)`, `flushPendingSave(storage, storageKey)`, `getPendingSave(storageKey)`, `getSaveStatus(storageKey)`, `discardPendingSave(storageKey)`, `hasAnyPendingSaves()`, `subscribePendingSaves(listener)`, `getPendingSaveRevision()`, and `resetPendingSavesForTest()`.
- `flushPendingSave` returns `{ ok: true }` or `{ ok: false; reason: 'storage_unavailable' }` and never throws.

- [ ] **Step 1: Write the failing registry tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discardPendingSave,
  flushPendingSave,
  getPendingSave,
  getSaveStatus,
  hasAnyPendingSaves,
  resetPendingSavesForTest,
  stagePendingSave,
  subscribePendingSaves,
} from './pendingSaves';

describe('pending save registry', () => {
  beforeEach(resetPendingSavesForTest);

  it('keeps only the newest staged snapshot for each profile', () => {
    stagePendingSave('profile-a', '{"keys":1}');
    stagePendingSave('profile-a', '{"keys":2}');
    stagePendingSave('profile-b', '{"keys":7}');

    expect(getPendingSave('profile-a')?.data).toBe('{"keys":2}');
    expect(getPendingSave('profile-b')?.data).toBe('{"keys":7}');
    expect(getSaveStatus('profile-a')).toBe('saving');
    expect(hasAnyPendingSaves()).toBe(true);
  });

  it('contains write failure and later recovers the newest snapshot', () => {
    const setItem = vi.fn()
      .mockImplementationOnce(() => { throw new DOMException('full', 'QuotaExceededError'); })
      .mockImplementation(() => undefined);
    stagePendingSave('profile-a', '{"keys":1}');
    expect(flushPendingSave({ setItem }, 'profile-a')).toEqual({
      ok: false,
      reason: 'storage_unavailable',
    });
    expect(getSaveStatus('profile-a')).toBe('failed');

    stagePendingSave('profile-a', '{"keys":3}');
    expect(flushPendingSave({ setItem }, 'profile-a')).toEqual({ ok: true });
    expect(setItem).toHaveBeenLastCalledWith('profile-a', '{"keys":3}');
    expect(getPendingSave('profile-a')).toBeNull();
  });

  it('notifies subscribers and discards only the selected profile', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingSaves(listener);
    stagePendingSave('profile-a', 'a');
    stagePendingSave('profile-b', 'b');
    discardPendingSave('profile-a');
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(3);
    expect(getPendingSave('profile-a')).toBeNull();
    expect(getPendingSave('profile-b')?.data).toBe('b');
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- utils/pendingSaves.test.ts`

Expected: FAIL because `utils/pendingSaves.ts` does not exist.

- [ ] **Step 3: Implement the minimal registry**

```ts
export type SaveStatus = 'saved' | 'saving' | 'failed';
export type PendingSaveEntry = {
  data: string;
  status: Exclude<SaveStatus, 'saved'>;
  reason: 'storage_unavailable' | null;
};
export type PendingSaveFlushResult =
  | { ok: true }
  | { ok: false; reason: 'storage_unavailable' };

const entries = new Map<string, PendingSaveEntry>();
const listeners = new Set<() => void>();
let revision = 0;

const emit = () => {
  revision += 1;
  for (const listener of listeners) listener();
};

export const stagePendingSave = (storageKey: string, data: string): void => {
  entries.set(storageKey, { data, status: 'saving', reason: null });
  emit();
};

export const flushPendingSave = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
): PendingSaveFlushResult => {
  const entry = entries.get(storageKey);
  if (!entry) return { ok: true };
  try {
    storage.setItem(storageKey, entry.data);
    entries.delete(storageKey);
    emit();
    return { ok: true };
  } catch {
    entries.set(storageKey, {
      ...entry,
      status: 'failed',
      reason: 'storage_unavailable',
    });
    emit();
    return { ok: false, reason: 'storage_unavailable' };
  }
};

export const getPendingSave = (storageKey: string): PendingSaveEntry | null =>
  entries.get(storageKey) ?? null;
export const getSaveStatus = (storageKey: string): SaveStatus =>
  entries.get(storageKey)?.status ?? 'saved';
export const discardPendingSave = (storageKey: string): void => {
  if (entries.delete(storageKey)) emit();
};
export const hasAnyPendingSaves = (): boolean => entries.size > 0;
export const subscribePendingSaves = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getPendingSaveRevision = (): number => revision;
export const resetPendingSavesForTest = (): void => {
  entries.clear();
  revision = 0;
  listeners.clear();
};
```

- [ ] **Step 4: Run the registry tests and verify GREEN**

Run: `npm test -- utils/pendingSaves.test.ts`

Expected: 3 tests pass with no unhandled storage exception.

- [ ] **Step 5: Commit the registry**

```powershell
git add utils/pendingSaves.ts utils/pendingSaves.test.ts
git commit -m "feat: add pending save registry"
```

---

### Task 2: GameProvider save health and recovery

**Files:**
- Modify: `context/GameContext.tsx:1199-1258,1391-1403,1536-1608`
- Modify: `context/GameContext.test.tsx`

**Interfaces:**
- Consumes every registry API from Task 1 except the global subscription helpers.
- Adds `saveStatus: SaveStatus` and `retrySave: () => boolean` to `GameContextType`.
- Preserves the existing synchronous explicit-replacement API.

- [ ] **Step 1: Add failing unit tests for safe flush behavior**

Extend `context/GameContext.persistence.test.ts` with an exported helper contract that stages and flushes ordinary state without throwing:

```ts
it('contains an ordinary save failure and retains the newest snapshot', () => {
  const result = GameContext.persistStagedSaveForTest({
    setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
  }, 'profile', '{"keys":9}');

  expect(result).toEqual({ ok: false, reason: 'storage_unavailable' });
  expect(getPendingSave('profile')).toMatchObject({
    data: '{"keys":9}',
    status: 'failed',
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- context/GameContext.persistence.test.ts`

Expected: FAIL because `persistStagedSaveForTest` is not exported.

- [ ] **Step 3: Add the minimal ordinary-save helper and imports**

In `GameContext.tsx`, import the registry and add:

```ts
export const persistStagedSaveForTest = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
  data: string,
) => {
  stagePendingSave(storageKey, data);
  return flushPendingSave(storage, storageKey);
};
```

Run the focused test and confirm it passes before continuing.

- [ ] **Step 4: Write failing provider tests for failure, newest state, and retry**

Use fake timers and the existing `GameCapture` pattern in
`context/GameContext.test.tsx`:

```tsx
it('exposes failed save health and retries the newest state', async () => {
  vi.useFakeTimers();
  let writesFail = true;
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (writesFail) throw new DOMException('full', 'QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  });

  let game: ReturnType<typeof useGame> | undefined;
  render(<GameProvider storageKey="profile"><GameCapture onGame={v => { game = v; }} /></GameProvider>);
  act(() => game!.saveNote('goal', 'first'));
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(game!.saveStatus).toBe('failed');

  act(() => game!.saveNote('goal', 'newest'));
  writesFail = false;
  act(() => { expect(game!.retrySave()).toBe(true); });
  expect(JSON.parse(values.get('profile')!).userNotes.goal).toBe('newest');
  expect(game!.saveStatus).toBe('saved');
});
```

Add a second test that unmounts after a failed write, remounts the same
`storageKey`, and expects the pending note to load instead of the older stored
note. Add a third test that unmounts inside the debounce window and expects an
immediate successful flush.

- [ ] **Step 5: Run provider tests and verify RED**

Run: `npm test -- context/GameContext.test.tsx context/GameContext.persistence.test.ts`

Expected: FAIL because `saveStatus`, `retrySave`, pending-first initialization,
and teardown flushing are not implemented.

- [ ] **Step 6: Implement provider integration minimally**

Make these exact behavioral changes:

```ts
interface GameContextType extends GameState {
  saveStatus: SaveStatus;
  retrySave: () => boolean;
  // existing fields remain unchanged
}
```

During reducer initialization, try `getPendingSave(key)?.data` first. Validate
it with `parseAndMigrateSave`; discard it and continue to `localStorage` only if
the internally staged snapshot unexpectedly fails validation.

Replace the unguarded debounce with:

```ts
const [saveStatus, setSaveStatus] = useState<SaveStatus>(() => getSaveStatus(storageKey));
const mountedRef = useRef(false);
const flushCurrentSave = useCallback((): boolean => {
  const result = flushPendingSave(localStorage, storageKey);
  if (mountedRef.current) setSaveStatus(result.ok ? 'saved' : 'failed');
  return result.ok;
}, [storageKey]);

useEffect(() => {
  stagePendingSave(storageKey, serializeGameState(state));
  setSaveStatus('saving');
  if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
  saveTimeoutRef.current = window.setTimeout(() => {
    saveTimeoutRef.current = null;
    flushCurrentSave();
  }, SAVE_DEBOUNCE_MS);
  return () => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
  };
}, [flushCurrentSave, state, storageKey]);

useEffect(() => {
  mountedRef.current = true;
  return () => {
    mountedRef.current = false;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    flushPendingSave(localStorage, storageKey);
  };
}, [storageKey]);

const retrySave = useCallback((): boolean => {
  stagePendingSave(storageKey, serializeCurrent());
  setSaveStatus('saving');
  return flushCurrentSave();
}, [flushCurrentSave, serializeCurrent, storageKey]);
```

After a successful explicit replacement write, call
`discardPendingSave(storageKey)` so an obsolete staged snapshot cannot survive
an import/restore. Add `saveStatus` and `retrySave` to the memoized context.

- [ ] **Step 7: Run provider tests and verify GREEN**

Run: `npm test -- context/GameContext.test.tsx context/GameContext.persistence.test.ts`

Expected: all focused tests pass; no uncaught `QuotaExceededError`.

- [ ] **Step 8: Commit provider recovery**

```powershell
git add context/GameContext.tsx context/GameContext.test.tsx context/GameContext.persistence.test.ts
git commit -m "fix: retain failed game saves"
```

---

### Task 3: Global unload guard and profile deletion cleanup

**Files:**
- Create: `components/SaveRecoveryGuard.tsx`
- Create: `components/SaveRecoveryGuard.test.tsx`
- Modify: `context/ProfileContext.tsx:123-128`
- Create: `context/ProfileContext.test.tsx`

**Interfaces:**
- Consumes `subscribePendingSaves`, `getPendingSaveRevision`,
  `hasAnyPendingSaves`, and `discardPendingSave` from Task 1.
- Produces a renderless `<SaveRecoveryGuard />` component.

- [ ] **Step 1: Write the failing unload lifecycle tests**

```tsx
// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stagePendingSave, discardPendingSave, resetPendingSavesForTest } from '../utils/pendingSaves';
import { SaveRecoveryGuard } from './SaveRecoveryGuard';

describe('SaveRecoveryGuard', () => {
  beforeEach(resetPendingSavesForTest);
  afterEach(cleanup);

  it('guards unload only while any profile has staged data', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    render(<SaveRecoveryGuard />);
    act(() => stagePendingSave('profile-a', 'data'));
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    act(() => discardPendingSave('profile-a'));
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});
```

- [ ] **Step 2: Run the guard test and verify RED**

Run: `npm test -- components/SaveRecoveryGuard.test.tsx`

Expected: FAIL because `SaveRecoveryGuard` does not exist.

- [ ] **Step 3: Implement the renderless guard**

```tsx
import React, { useEffect, useSyncExternalStore } from 'react';
import {
  getPendingSaveRevision,
  hasAnyPendingSaves,
  subscribePendingSaves,
} from '../utils/pendingSaves';

export const SaveRecoveryGuard: React.FC = () => {
  useSyncExternalStore(subscribePendingSaves, getPendingSaveRevision, getPendingSaveRevision);
  const pending = hasAnyPendingSaves();
  useEffect(() => {
    if (!pending) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [pending]);
  return null;
};
```

- [ ] **Step 4: Add a failing successful-deletion cleanup test**

Render `ProfileProvider` with a small `useProfiles` capture component. Seed two
profiles and stage pending data for the profile being deleted. Call the captured
`deleteProfile(id)` and assert `getPendingSave(profileBaseKey(id))` is `null`.
Add a second test whose metadata write throws and assert the pending snapshot is
still present. These tests must exercise the provider callback and observe the
real registry rather than mocking `discardPendingSave`.

- [ ] **Step 5: Run focused tests and verify RED**

Run: `npm test -- components/SaveRecoveryGuard.test.tsx context/ProfileContext.test.tsx`

Expected: the guard test passes; deletion cleanup fails because
`ProfileContext.deleteProfile` does not discard pending state.

- [ ] **Step 6: Clear pending memory only after confirmed deletion**

In `ProfileContext.deleteProfile`, add:

```ts
if (result.status === 'deleted') {
  discardPendingSave(profileBaseKey(id));
  setMetadata(result.metadata);
}
```

Do not clear pending state on `last_profile` or `metadata_write_failed`.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm test -- components/SaveRecoveryGuard.test.tsx context/ProfileContext.test.tsx utils/profileStorage.test.ts`

Expected: all focused tests pass.

```powershell
git add components/SaveRecoveryGuard.tsx components/SaveRecoveryGuard.test.tsx context/ProfileContext.tsx context/ProfileContext.test.tsx
git commit -m "fix: protect staged saves across profile lifecycle"
```

---

### Task 4: Shared export operation and failure banner

**Files:**
- Create: `utils/fateSaveFile.ts`
- Create: `utils/fateSaveFile.test.ts`
- Create: `components/SaveFailureBanner.tsx`
- Create: `components/SaveFailureBanner.test.tsx`
- Modify: `components/BackupNagBanner.tsx:24-46`
- Modify: `App.tsx:370-394`

**Interfaces:**
- Produces `downloadFateSave(rawData, storageKey, environment?)` returning
  `{ ok: true }` or `{ ok: false; message: string }`.
- `SaveFailureBanner` consumes `saveStatus`, `retrySave`, and `getExportData`
  from `useGame`, plus the active profile storage key.

- [ ] **Step 1: Write failing tests for the shared download operation**

```ts
it('downloads encoded current state and marks the profile exported', () => {
  const click = vi.fn();
  const mark = vi.fn();
  const result = downloadFateSave('{"keys":9}', 'profile', {
    now: () => 123,
    createObjectURL: () => 'blob:test',
    revokeObjectURL: vi.fn(),
    createAnchor: () => ({ href: '', download: '', click }),
    markExported: mark,
  });
  expect(result).toEqual({ ok: true });
  expect(click).toHaveBeenCalledOnce();
  expect(mark).toHaveBeenCalledWith('profile');
});

it('returns a safe error without marking export for invalid data', () => {
  expect(downloadFateSave('{bad', 'profile', testEnvironment)).toEqual({
    ok: false,
    message: 'Export failed',
  });
  expect(testEnvironment.markExported).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run file-export tests and verify RED**

Run: `npm test -- utils/fateSaveFile.test.ts`

Expected: FAIL because `fateSaveFile.ts` does not exist.

- [ ] **Step 3: Implement and adopt the shared export operation**

Implement the existing `JSON.parse` → `encodeFateSaveExport` → `Blob` → object
URL → temporary anchor flow behind `downloadFateSave`. Always revoke a created
object URL in `finally`. Return encoder messages unchanged; convert unexpected
exceptions to `Export failed`.

Replace the duplicated implementations in `Header` and `BackupNagBanner` with
this operation. `BackupNagBanner` hides itself only when `{ ok: true }`; both
callers preserve their existing success and error toast copy.

- [ ] **Step 4: Run export and existing backup tests and verify GREEN**

Run: `npm test -- utils/fateSaveFile.test.ts utils/backupNag.test.ts`

Expected: all focused tests pass.

- [ ] **Step 5: Write the failing failure-banner tests**

```tsx
it('shows retry and export recovery until a save succeeds', async () => {
  const retrySave = vi.fn().mockReturnValue(false);
  renderBanner({ saveStatus: 'failed', retrySave, getExportData: () => '{"keys":9}' });
  expect(screen.getByRole('alert')).toHaveTextContent("Progress isn't being saved");
  await userEvent.click(screen.getByRole('button', { name: 'Retry save' }));
  expect(retrySave).toHaveBeenCalledOnce();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export backup' })).toBeEnabled();
});

it('renders nothing after storage recovers', () => {
  renderBanner({ saveStatus: 'saved' });
  expect(screen.queryByRole('alert')).toBeNull();
});
```

Export a `SaveFailureBannerView` that receives `saveStatus`, `retrySave`, and
`exportBackup` props. Test that view directly; keep retry state and action
handling inside the view. The default `SaveFailureBanner` wrapper must be thin:
read both real contexts, build `exportBackup` with `downloadFateSave`, and pass
those exact values to the view.

- [ ] **Step 6: Run the banner tests and verify RED**

Run: `npm test -- components/SaveFailureBanner.test.tsx`

Expected: FAIL because `SaveFailureBanner` does not exist.

- [ ] **Step 7: Implement the accessible banner**

Render `null` unless `saveStatus === 'failed'`. Render a red, responsive bar
with `role="alert"`, the approved copy, **Retry save**, and **Export backup**.
Disable Retry while a local retry click is executing. Call `downloadFateSave`
with `getExportData()` and the active profile key. Show existing toast feedback,
but never clear save health after export.

- [ ] **Step 8: Run focused tests and commit**

Run: `npm test -- components/SaveFailureBanner.test.tsx utils/fateSaveFile.test.ts utils/backupNag.test.ts`

Expected: all focused tests pass.

```powershell
git add utils/fateSaveFile.ts utils/fateSaveFile.test.ts components/SaveFailureBanner.tsx components/SaveFailureBanner.test.tsx components/BackupNagBanner.tsx App.tsx
git commit -m "feat: add failed-save recovery banner"
```

---

### Task 5: App integration and milestone verification

**Files:**
- Modify: `App.tsx:969-1027,1082-1091`
- Modify: `App.lifecycle.test.tsx`
- Modify: `CHANGELOG.md` or the project-owned player-facing changelog data only if required by `npm run changelog:verify`

**Interfaces:**
- Consumes `<SaveFailureBanner />` and `<SaveRecoveryGuard />` from Tasks 3–4.
- Produces the final user-visible milestone without changing live deployment.

- [ ] **Step 1: Add the failing app lifecycle integration test**

Extend `App.lifecycle.test.tsx` to use a storage implementation whose active
profile write can be toggled between throwing and succeeding. Perform a real
game action through the rendered app, advance fake timers, and assert:

```ts
expect(await screen.findByRole('alert')).toHaveTextContent("Progress isn't being saved");
expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled();
```

Then allow writes, click Retry, and assert the alert disappears and the stored
profile JSON contains the latest action.

- [ ] **Step 2: Run the lifecycle test and verify RED**

Run: `npm test -- App.lifecycle.test.tsx`

Expected: FAIL because the guard/banner are not mounted in `App`.

- [ ] **Step 3: Mount components at the correct boundaries**

Mount `<SaveRecoveryGuard />` once inside `ProfileProvider` but outside the
keyed `GameProviderBridge`:

```tsx
<ProfileProvider>
  <SaveRecoveryGuard />
  <GameProviderBridge>
    <GameLayout />
  </GameProviderBridge>
</ProfileProvider>
```

Mount `<SaveFailureBanner />` immediately after `<Header />` so it appears
above CoachStrip and the backup nag for the active profile.

- [ ] **Step 4: Run focused lifecycle tests and verify GREEN**

Run: `npm test -- App.lifecycle.test.tsx components/SaveFailureBanner.test.tsx components/SaveRecoveryGuard.test.tsx`

Expected: all focused tests pass.

- [ ] **Step 5: Run the complete verification gates**

Run in this order:

```powershell
npm test
npm run typecheck
$env:VITE_BASE='/OSRS-Fate-Locked/'; npm run build
git diff --check
git status --short
```

Expected:

- 149 existing test files plus the new test files all pass.
- TypeScript exits 0.
- Production build exits 0; existing bundle warnings may remain but no new
  warning is introduced by this milestone.
- `git diff --check` is clean.
- Only intentional milestone files are modified before the final commit.

On Windows, restore only the build-generated line-ending change to
`data/modelManifest.ts` with `git checkout-index --force -- data/modelManifest.ts`
before the status check. Do not alter the known generated-content line-ending
issue in this milestone.

- [ ] **Step 6: Commit the verified integration**

```powershell
git add App.tsx App.lifecycle.test.tsx
git commit -m "test: verify failed-save recovery flow"
```

- [ ] **Step 7: Stop for joint review**

Report the commit list, exact verification counts, screenshots or a local
preview walkthrough of the failed-save banner, and any known limitations. Do
not push, merge, or deploy until the user approves the completed milestone.
