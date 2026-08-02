# Profile Metadata Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser profile registry recoverable, strictly validated, and safe from lost updates when multiple tabs create, rename, switch, or delete profiles.

**Architecture:** A pure metadata module owns the versioned schema, strict parser, exact save-key discovery, and deterministic recovery planning. An asynchronous transaction coordinator owns the expiring cross-tab lock, verified backup/primary commits, typed mutations, and deletion rollback. `ProfileProvider` initializes through that boundary, keeps each tab's still-valid local selection, listens for valid cross-tab registry updates, and exposes pending/error state to a focused switcher and recovery banner.

**Tech Stack:** React 18, TypeScript 5, Vitest 4, Testing Library, browser `localStorage`, `storage` events, existing game-save parser, existing profile writer leases

## Global Constraints

- Preserve all existing game-save keys, save bodies, imports, exports, backups, and writer-lease semantics.
- Treat only strictly parsed metadata as application state; do not use unchecked `JSON.parse` results.
- Keep unsupported future metadata read-only and never overwrite it with an older schema.
- Archive unreadable metadata before automatic durable repair; if archival fails, expose recovered profiles in memory but disable mutations.
- Recover at most 100 exact valid base saves in stable key order; leave invalid and excess saves untouched and report their counts.
- Keep ordinary user-created profiles capped at 10 based on the newest registry read inside the lock.
- Generate create IDs and timestamps once per user action so transaction retries are idempotent.
- Verify lock ownership immediately before backup and primary writes; verify both writes by reading them back.
- Keep each tab on its current profile when that ID still exists; another tab's ordinary selection must not remount the current tab's `GameProvider`.
- Reject deletion of the selected profile in the UI and any profile protected by an unexpired game writer lease in the transaction.
- Preserve pending game-save data unless coordinated deletion succeeds.
- Use specific typed failures and persistent accessible recovery feedback; never claim a failed mutation succeeded.
- Follow red-green-refactor for every production change.
- Do not merge, push, or deploy until the completed milestone and browser walkthrough are reviewed with the user.

---

## File Map

- Modify `types.ts`: replace the unversioned profile metadata type with the versioned durable registry and add the shared mutation/recovery result types consumed by React.
- Create `utils/profileMetadata.ts`: constants, strict parsing, legacy normalization, safe-field salvage, exact base-key discovery, deterministic recovery planning, and recovery-message policy.
- Create `utils/profileMetadata.test.ts`: parser, recovery, overflow, unsupported-version, and storage-failure coverage.
- Create `utils/profileMetadataTransaction.ts`: lock acquisition/release, startup repair, verified commit ordering, typed create/rename/select/delete operations, retries, and deletion rollback.
- Create `utils/profileMetadataTransaction.test.ts`: deterministic lock, interleaving, commit, mutation, writer-lease, and rollback coverage.
- Modify `utils/profileStorage.ts`: retain only exact profile-owned key construction and best-effort removal helpers; remove the superseded cached whole-registry commit/delete transaction.
- Modify `utils/profileStorage.test.ts`: preserve exact-key and removal tests while moving metadata transaction expectations to the new coordinator suite.
- Modify `context/ProfileContext.tsx`: asynchronous validated initialization, transaction client ownership, typed async actions, pending state, persistent recovery state, and cross-tab merge policy.
- Modify `context/ProfileContext.test.tsx`: startup recovery, action state, pending-save cleanup, storage-event merging, and local-selection tests.
- Modify `components/ProfileSwitcher.tsx`: await mutations, prevent duplicates, preserve failed forms, disable selected-profile deletion, and display actionable inline failures.
- Create `components/ProfileSwitcher.test.tsx`: accessible pending, failure, active-delete, and successful form-flow tests.
- Create `components/ProfileRecoveryBanner.tsx` and `components/ProfileRecoveryBanner.test.tsx`: persistent accessible recovery and compatibility notices with acknowledgement.
- Modify `App.tsx` and `App.lifecycle.test.tsx`: mount recovery feedback outside the keyed game provider and verify no invalid registry reaches the application.
- Modify `data/changelog.ts` and `data/changelog.test.ts`: add the player-facing milestone 3 release entry.

---

### Task 1: Versioned Metadata Schema and Strict Parser

**Files:**
- Modify: `types.ts:245-255`
- Create: `utils/profileMetadata.ts`
- Create: `utils/profileMetadata.test.ts`
- Modify: `utils/profileStorage.ts:2-153`
- Modify: `utils/profileStorage.test.ts:9-397`
- Modify: `context/ProfileContext.tsx:3-54`
- Modify: `context/ProfileContext.test.tsx:5-49`
- Modify: `App.lifecycle.test.tsx:73-77`

**Interfaces:**

```ts
export const PROFILE_METADATA_VERSION = 1 as const;
export const MAX_PROFILES = 10;
export const MAX_RECOVERED_PROFILES = 100;
export const MAX_PROFILE_NAME_LENGTH = 30;
export const PROFILES_KEY = 'FATE_PROFILES';
export const PROFILE_METADATA_BACKUP_KEY = 'FATE_PROFILES__backup';
export const PROFILE_METADATA_LOCK_KEY = 'FATE_PROFILES__lock';
export const PROFILE_METADATA_RECOVERY_KEY = 'FATE_PROFILES__recovery';
export const LEGACY_SAVE_KEY = 'FATE_UIM_SAVE_V1';

export interface ProfileMetadata {
  version: 1;
  revision: number;
  profiles: Profile[];
  activeProfileId: string;
}

export type ProfileMetadataInvalidReason =
  | 'missing'
  | 'invalid_json'
  | 'invalid_root'
  | 'invalid_version'
  | 'invalid_revision'
  | 'invalid_profiles'
  | 'duplicate_id'
  | 'invalid_profile'
  | 'invalid_active_profile'
  | 'unknown_field';

export type ProfileMetadataParseResult =
  | { status: 'current'; metadata: ProfileMetadata }
  | { status: 'legacy'; metadata: ProfileMetadata }
  | { status: 'unsupported'; version: number }
  | { status: 'invalid'; reason: ProfileMetadataInvalidReason };

export declare const parseProfileMetadata: (raw: string | null) => ProfileMetadataParseResult;
export declare const sanitizeProfileName: (name: string) => string;
export declare const isStorageSafeProfileId: (id: string) => boolean;
```

Use `^[A-Za-z0-9-]{1,128}$` for storage-safe IDs. Accept only plain objects with own `version`, `revision`, `profiles`, and `activeProfileId` properties for current records. Reject unknown current-schema root and profile-entry properties, accessors, dangerous keys, duplicate IDs, empty or oversized arrays, invalid names, non-safe timestamps/revisions, and an active ID absent from the array. Accept exactly the old two-field root as legacy and normalize it to version 1, revision 0.

- [ ] **Step 1: Write failing current/legacy parser tests**

Create `utils/profileMetadata.test.ts` with reusable `current()` and `legacy()` fixtures and these first cases:

```ts
it('accepts the exact current schema', () => {
  expect(parseProfileMetadata(JSON.stringify(current()))).toEqual({
    status: 'current',
    metadata: current(),
  });
});

it('normalizes the exact legacy schema to revision zero', () => {
  expect(parseProfileMetadata(JSON.stringify(legacy()))).toEqual({
    status: 'legacy',
    metadata: { version: 1, revision: 0, ...legacy() },
  });
});

it.each([
  null,
  '{bad',
  'null',
  '[]',
  JSON.stringify({ version: 1, revision: 0, profiles: [], activeProfileId: 'a' }),
  JSON.stringify({ version: 1, revision: -1, profiles: legacy().profiles, activeProfileId: 'alpha' }),
])('rejects malformed metadata without throwing: %s', raw => {
  expect(() => parseProfileMetadata(raw)).not.toThrow();
  expect(parseProfileMetadata(raw).status).toBe('invalid');
});
```

- [ ] **Step 2: Add failing boundary and object-safety tests**

Cover duplicate IDs; IDs containing `_`, `/`, whitespace, or more than 128 characters; empty/31-character names; negative, fractional, infinite, and unsafe timestamps; 101 profiles; missing/foreign active IDs; unknown root/entry keys; accessor-backed fields; and `__proto__`, `prototype`, or `constructor` pollution attempts. Add this explicit compatibility assertion:

```ts
it('distinguishes a future schema from corruption', () => {
  expect(parseProfileMetadata(JSON.stringify({
    version: 2,
    revision: 9,
    profiles: legacy().profiles,
    activeProfileId: 'alpha',
  }))).toEqual({ status: 'unsupported', version: 2 });
});
```

- [ ] **Step 3: Run the focused suite and verify RED**

Run:

```powershell
npm test -- utils/profileMetadata.test.ts
```

Expected: FAIL because `utils/profileMetadata.ts` and the versioned `ProfileMetadata` shape do not exist.

- [ ] **Step 4: Implement the smallest strict parser**

Move the metadata constants and name sanitizer out of `ProfileContext`. Use property descriptors and plain-record checks following the defensive pattern in `utils/saveSchema.ts`; do not spread or iterate an unvalidated object. Return typed invalid reasons rather than throwing. Add `version` and `revision` to `ProfileMetadata` in `types.ts`.

Mechanically update every existing `ProfileMetadata` construction in `ProfileContext`, `profileStorage`, their tests, and the lifecycle test to include `version: 1` and `revision: 0`. Preserve `version` and increment `revision` in the old temporary commit/delete helper so the repository remains type-correct until Task 5 removes that helper. This is a compatibility bridge only; do not route startup through the new parser until Task 6.

- [ ] **Step 5: Run focused tests and type checking and verify GREEN**

Run:

```powershell
npm test -- utils/profileMetadata.test.ts
npm run typecheck
```

Expected: parser tests and type checking PASS. Every existing profile fixture uses explicit version/revision fields; do not weaken those fields to optional properties.

- [ ] **Step 6: Commit the parser boundary**

```powershell
git add types.ts utils/profileMetadata.ts utils/profileMetadata.test.ts utils/profileStorage.ts utils/profileStorage.test.ts context/ProfileContext.tsx context/ProfileContext.test.tsx App.lifecycle.test.tsx
git commit -m "feat: validate profile metadata schema"
```

---

### Task 2: Deterministic Recovery Planning

**Files:**
- Modify: `utils/profileMetadata.ts`
- Modify: `utils/profileMetadata.test.ts`

**Interfaces:**

```ts
export interface ProfileRecoveryEnvelopeV1 {
  version: 1;
  capturedAt: number;
  primary: string | null;
  backup: string | null;
}

export type ProfileRecoveryNotice = {
  kind: 'repaired' | 'partial' | 'read_only' | 'unsupported' | 'remote_removal';
  recoveredProfiles: number;
  generatedNames: number;
  unreadableSaves: number;
  overflowSaves: number;
  rollbackFailures: number;
};

export type ProfileMetadataResolution =
  | { mode: 'durable'; metadata: ProfileMetadata; repair: null; notice: ProfileRecoveryNotice | null }
  | { mode: 'repair'; metadata: ProfileMetadata; repair: ProfileRepairPlan; notice: ProfileRecoveryNotice | null }
  | { mode: 'read_only'; metadata: ProfileMetadata; repair: null; notice: ProfileRecoveryNotice };

export interface ProfileMetadataStorageReader {
  readonly length: number;
  getItem(key: string): string | null;
  key(index: number): string | null;
}

export type GameSaveValidator = (raw: string) => boolean;

export interface ProfileRepairPlan {
  cause: 'legacy' | 'backup' | 'reconstructed' | 'fresh';
  candidate: ProfileMetadata;
  archive: ProfileRecoveryEnvelopeV1 | null;
  legacyCopy: { fromKey: typeof LEGACY_SAVE_KEY; toProfileId: string } | null;
}

export interface ResolveProfileMetadataInput {
  primary: string | null;
  backup: string | null;
  legacySave: string | null;
  storage: ProfileMetadataStorageReader;
  now: number;
  validateGameSave: GameSaveValidator;
  createProfileId: () => string;
}

export declare const discoverProfileSaveIds: (storage: ProfileMetadataStorageReader) => string[];
export declare const resolveProfileMetadata: (input: ResolveProfileMetadataInput) => ProfileMetadataResolution;
```

`ProfileRepairPlan` must contain the exact raw primary and backup strings for the rotating recovery envelope, a cause (`legacy`, `backup`, `reconstructed`, or `fresh`), and the validated candidate. It must never contain game-save bodies.

- [ ] **Step 1: Write failing exact-key discovery tests**

Use a storage fixture containing these keys:

```ts
[
  'FATE_PROFILE_alpha',
  'FATE_PROFILE_zulu',
  'FATE_PROFILE_alpha__backups',
  'FATE_PROFILE_alpha__writer',
  'FATE_PROFILE_alpha__discord',
  'FATE_PROFILE_alpha_misleading',
  'fate_features_seen_v1_alpha',
  'FATE_PROFILES',
]
```

Assert discovery returns only `['alpha', 'zulu']` in sorted order. The matcher must be the exact inverse of `profileBaseKey` for the storage-safe ID grammar, not a broad prefix test.

- [ ] **Step 2: Write failing primary/backup resolution tests**

Cover:

```ts
it('uses a valid primary without requesting a write', () => {
  expect(resolve().mode).toBe('durable');
  expect(resolve().repair).toBeNull();
});

it('requests legacy migration through a repair plan', () => {
  const result = resolve({ primary: JSON.stringify(legacy()), backup: null, ...deps });
  expect(result).toMatchObject({
    mode: 'repair',
    repair: { cause: 'legacy', candidate: { version: 1, revision: 0 } },
  });
});

it('prefers a valid backup when primary is corrupt', () => {
  const result = resolve({ primary: '{bad', backup: JSON.stringify(current()), ...deps });
  expect(result).toMatchObject({ mode: 'repair', repair: { cause: 'backup' } });
});
```

Also assert that an unsupported primary or backup results in `mode: 'read_only'` and is not converted into a repair plan.

- [ ] **Step 3: Write failing reconstruction tests**

Inject a validator that accepts only known raw values. Assert:

- valid exact base saves become profiles in sorted-key order;
- independently safe legacy name and `createdAt` fields are retained for matching IDs;
- generated labels are unique and deterministic (`Recovered Profile 1`, `Recovered Profile 2`);
- the previous active ID is preserved only when recovered;
- unreadable saves are counted and left untouched;
- the 101st valid save is counted as overflow and not deleted;
- any recovered run prevents fallback to `FATE_UIM_SAVE_V1` or a fresh profile;
- a valid legacy single save is copied to the generated profile only by the later repair executor;
- with no recoverable save, the plan creates `Main Account` using injected ID and time.

- [ ] **Step 4: Run the focused suite and verify RED**

Run:

```powershell
npm test -- utils/profileMetadata.test.ts
```

Expected: FAIL because discovery and recovery planning are not implemented.

- [ ] **Step 5: Implement pure, bounded recovery planning**

Read primary and backup before enumerating keys. Bound validation work after 100 accepted saves plus the remaining exact candidates needed only for unreadable/overflow counts. Recover safe fields from malformed metadata by parsing to `unknown` and inspecting each entry independently; never treat the surrounding registry as valid. Return counts, candidate metadata, archive inputs, and legacy-copy instructions without mutating storage.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
npm test -- utils/profileMetadata.test.ts
npm run typecheck
```

Expected: all metadata parsing and recovery tests PASS and type checking succeeds.

- [ ] **Step 7: Commit recovery planning**

```powershell
git add utils/profileMetadata.ts utils/profileMetadata.test.ts
git commit -m "feat: plan safe profile recovery"
```

---

### Task 3: Expiring Metadata Lock and Verified Commit Primitive

**Files:**
- Create: `utils/profileMetadataTransaction.ts`
- Create: `utils/profileMetadataTransaction.test.ts`

**Interfaces:**

```ts
export const PROFILE_METADATA_LOCK_VERSION = 1 as const;
export const PROFILE_METADATA_LOCK_TTL_MS = 2_000;
export const PROFILE_METADATA_LOCK_ARBITRATION_MS = 25;
export const PROFILE_METADATA_LOCK_RETRY_MS = 25;
export const PROFILE_METADATA_LOCK_TIMEOUT_MS = 1_500;

export interface ProfileMetadataLockV1 {
  version: 1;
  ownerId: string;
  expiresAt: number;
}

export interface ProfileTransactionDependencies {
  storage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
  ownerId: string;
  now: () => number;
  wait: (milliseconds: number) => Promise<void>;
  validateGameSave: GameSaveValidator;
  createProfileId: () => string;
}

export type ProfileMutationFailure =
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

export type ProfileLockResult =
  | { status: 'acquired'; lock: ProfileMetadataLockV1 }
  | { status: 'busy'; lock: null }
  | { status: 'storage_unavailable'; lock: null };

export type ProfileLockReleaseResult = 'released' | 'not_owner' | 'storage_unavailable';

export type ProfileTransactionResult =
  | { ok: true; metadata: ProfileMetadata; notice: ProfileRecoveryNotice | null }
  | { ok: false; reason: ProfileMutationFailure; metadata: ProfileMetadata | null; notice: ProfileRecoveryNotice | null };

export declare const acquireProfileMetadataLock: (deps: ProfileTransactionDependencies) => Promise<ProfileLockResult>;
export declare const releaseProfileMetadataLock: (deps: ProfileTransactionDependencies) => ProfileLockReleaseResult;
export declare const commitProfileMetadataCandidate: (deps: ProfileTransactionDependencies, previous: ProfileMetadata, candidate: ProfileMetadata) => ProfileTransactionResult;
```

- [ ] **Step 1: Write failing lock parser and ownership tests**

Cover absent, expired, malformed, and unexpired foreign locks; storage read/write failure; wrong-owner release; and owner-checked release. Use an injected manual clock and a `wait` spy so no test sleeps in real time.

- [ ] **Step 2: Write the simultaneous-claim arbitration test**

Create two dependency objects sharing one storage map. Interleave their wait promises so both observe an empty lock before writes, then allow arbitration to finish. Assert exactly one receives `acquired` and the loser retries or returns `busy`; never allow both to enter the critical section.

- [ ] **Step 3: Write failing verified-commit ordering tests**

Assert the observable calls are:

```ts
[
  'get:FATE_PROFILES__lock',
  'set:FATE_PROFILES__backup',
  'get:FATE_PROFILES__backup',
  'set:FATE_PROFILES',
  'get:FATE_PROFILES',
]
```

The candidate must have `revision === previous.revision + 1`. Add separate cases for backup throw, backup readback mismatch, primary throw, primary readback mismatch, and lock replacement immediately before commit. No primary write may occur after backup or lock verification fails.

- [ ] **Step 4: Run the focused suite and verify RED**

```powershell
npm test -- utils/profileMetadataTransaction.test.ts
```

Expected: FAIL because the transaction module does not exist.

- [ ] **Step 5: Implement lock acquisition, verified release, and commit**

Acquisition must reread immediately before claim, write a claim, read it back, await the arbitration interval, and verify the matching unexpired owner again. Retry until the injected deadline. In `finally`, remove the lock only if a final parsed read still belongs to this owner. Serialize metadata once and compare exact readback strings for backup and primary verification.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
npm test -- utils/profileMetadataTransaction.test.ts utils/profileMetadata.test.ts
npm run typecheck
```

Expected: lock and verified-commit tests PASS with no real timer delays.

- [ ] **Step 7: Commit the transaction primitive**

```powershell
git add utils/profileMetadataTransaction.ts utils/profileMetadataTransaction.test.ts
git commit -m "feat: serialize profile metadata writes"
```

---

### Task 4: Startup Repair and Typed Create, Rename, and Select

**Files:**
- Modify: `utils/profileMetadataTransaction.ts`
- Modify: `utils/profileMetadataTransaction.test.ts`

**Interfaces:**

```ts
export type ProfileMutation =
  | { type: 'create'; profile: Profile }
  | { type: 'rename'; profileId: string; name: string }
  | { type: 'select'; profileId: string }
  | { type: 'delete'; profileId: string };

export declare const initializeProfileMetadata:
  (deps: ProfileTransactionDependencies) => Promise<ProfileTransactionResult>;

export declare const mutateProfileMetadata:
  (deps: ProfileTransactionDependencies, mutation: ProfileMutation) => Promise<ProfileTransactionResult>;
```

- [ ] **Step 1: Write failing startup repair tests**

Cover valid current startup with no writes, legacy durable migration, corrupt-primary backup repair, dual-corrupt reconstruction, legacy single-save migration, and fresh initialization. Assert repair writes this exact sequence while holding the lock:

```ts
[
  'set:FATE_PROFILES__recovery',
  'get:FATE_PROFILES__recovery',
  'set:FATE_PROFILES__backup',
  'get:FATE_PROFILES__backup',
  'set:FATE_PROFILES',
  'get:FATE_PROFILES',
]
```

For a valid legacy registry, recovery-envelope archival is not needed; backup and primary verification still are. For corrupt data, fail recovery-envelope writes/readback closed: return recovered metadata with a `read_only` notice, do not overwrite primary or backup, and reject later mutation calls.

- [ ] **Step 2: Write failing unsupported-version startup tests**

Assert a future primary or backup is never rewritten. Resolve supported backup/save keys for an in-memory profile list, return `unsupported_metadata`/read-only notice, and leave primary, backup, and lock byte-for-byte unchanged. Write and verify only the rotating recovery envelope so the unsupported raw value is archived; if that archival fails, retain the same in-memory read-only result and notice.

- [ ] **Step 3: Write failing mutation tests against the newest locked revision**

Use a stale caller fixture but replace storage with a newer revision before the lock settles. Assert:

- create preserves the newer profiles and adds one profile;
- create rejects the 11th ordinary profile with `max_profiles` and no writes;
- retrying the same create ID is idempotent and does not duplicate it;
- rename preserves an interleaved create;
- rename/select return `not_found` for a removed ID without rewriting;
- select writes the requested valid ID and increments exactly once;
- every success returns the verified durable registry.

- [ ] **Step 4: Run focused tests and verify RED**

```powershell
npm test -- utils/profileMetadataTransaction.test.ts
```

Expected: FAIL because startup execution and typed mutations are absent.

- [ ] **Step 5: Implement startup and the three non-destructive operations**

Every public operation acquires the lock, rereads primary/backup, resolves them through `resolveProfileMetadata`, applies one typed mutation, validates the complete candidate, commits, and releases in `finally`. A create whose pre-generated ID already exists with the same name/timestamp returns the latest metadata as success without another write; a conflicting duplicate ID returns `invalid_metadata`.

- [ ] **Step 6: Run focused and legacy-profile tests and verify GREEN**

```powershell
npm test -- utils/profileMetadata.test.ts utils/profileMetadataTransaction.test.ts utils/profileStorage.test.ts context/ProfileContext.test.tsx
npm run typecheck
```

Expected: new transaction tests PASS. Existing context/storage tests may remain RED only where they still assert the deliberately superseded synchronous API; record those exact assertions for Task 5 rather than adding compatibility shims.

- [ ] **Step 7: Commit startup and typed mutations**

```powershell
git add utils/profileMetadataTransaction.ts utils/profileMetadataTransaction.test.ts
git commit -m "feat: recover and mutate latest profile registry"
```

---

### Task 5: Coordinated Deletion and Exact Rollback

**Files:**
- Modify: `utils/profileMetadataTransaction.ts`
- Modify: `utils/profileMetadataTransaction.test.ts`
- Modify: `utils/profileStorage.ts:1-153`
- Modify: `utils/profileStorage.test.ts:1-397`

**Interfaces:**

Extend success/failure details without exposing stored values:

```ts
export type ProfileDeleteDetails = {
  removedEntries: number;
  removalFailures: number;
  rollbackFailures: number;
};

export type ProfileTransactionResult =
  | { ok: true; metadata: ProfileMetadata; notice: ProfileRecoveryNotice | null; deleteDetails?: ProfileDeleteDetails }
  | { ok: false; reason: ProfileMutationFailure; metadata: ProfileMetadata | null; notice: ProfileRecoveryNotice | null; deleteDetails?: ProfileDeleteDetails };
```

- [ ] **Step 1: Write failing deletion guard tests**

Assert `delete` returns `not_found` for an absent ID, `last_profile` for the only profile, and `profile_in_use` whenever `readWriterLease(storage, profileBaseKey(id))` returns an unexpired lease at injected `now()`. Expired/malformed leases do not block deletion. No key is removed in any rejected case.

- [ ] **Step 2: Write failing exact-key and rollback tests**

Seed all seven keys from `profileOwnedKeys(id)`, unrelated profile keys, misleading prefixes, primary metadata, and backup metadata. Assert:

- backup verification completes before the first profile-owned removal;
- only the seven registered owned keys are snapshotted and removed;
- the replacement active ID is the first remaining profile when required;
- a primary throw or mismatched readback restores every successfully removed value;
- individual removal failures are counted but do not delete unrelated data;
- rollback failures report a count, never raw keys or values;
- a successful delete is not followed by rollback and increments revision once.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
npm test -- utils/profileMetadataTransaction.test.ts utils/profileStorage.test.ts
```

Expected: FAIL because the new transaction does not yet coordinate writer leases and rollback.

- [ ] **Step 4: Implement delete inside the held metadata lock**

Use `readWriterLease` and `profileOwnedKeys`. Snapshot exact values, verify the previous registry backup, remove owned keys, then write and verify primary. If primary commit fails, restore only keys that had values and were successfully removed. Keep the old primary registry as the returned metadata. Release the metadata lock in `finally` regardless of rollback outcome.

- [ ] **Step 5: Remove the superseded cached metadata transaction**

Delete `ProfileMetadataCell`, `commitProfileMetadata`, `deleteProfileTransaction`, and `profileDeletionNotice` from `utils/profileStorage.ts`. Remove their tests, retaining the exact `profileOwnedKeys` and `deleteProfileStorage` coverage. All registry writes must now go through `profileMetadataTransaction.ts`.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
npm test -- utils/profileMetadataTransaction.test.ts utils/profileStorage.test.ts utils/profileWriterLease.test.ts
npm run typecheck
```

Expected: coordinated deletion, exact storage ownership, and existing writer-lease tests PASS.

- [ ] **Step 7: Commit coordinated deletion**

```powershell
git add utils/profileMetadataTransaction.ts utils/profileMetadataTransaction.test.ts utils/profileStorage.ts utils/profileStorage.test.ts
git commit -m "fix: protect profile deletion transactions"
```

---

### Task 6: Provider Initialization and Cross-Tab State Policy

**Files:**
- Modify: `context/ProfileContext.tsx:1-164`
- Modify: `context/ProfileContext.test.tsx:1-96`
- Modify: `context/GameContext.tsx:1247-1518`
- Modify: `context/GameContext.persistence.test.ts`
- Modify: `App.tsx:1062-1080`

**Context contract:**

```ts
export type ProfilePendingAction = 'initializing' | 'create' | 'rename' | 'select' | 'delete' | null;

interface ProfileContextType {
  profiles: Profile[];
  activeProfileId: string;
  activeProfileName: string;
  storageKeyForActiveProfile: string;
  pendingAction: ProfilePendingAction;
  mutationFailure: ProfileMutationFailure | null;
  recoveryNotice: ProfileRecoveryNotice | null;
  metadataReadOnly: boolean;
  createProfile(name: string): Promise<ProfileTransactionResult>;
  switchProfile(id: string): Promise<ProfileTransactionResult>;
  renameProfile(id: string, newName: string): Promise<ProfileTransactionResult>;
  deleteProfile(id: string): Promise<ProfileTransactionResult>;
  dismissRecoveryNotice(): void;
  recentlyCreatedId: string | null;
  registerProfileEvictionHandler(handler: (profileId: string) => void): () => void;
  clearRecentlyCreated(): void;
}
```

- [ ] **Step 1: Rewrite provider fixtures for versioned metadata and async actions**

Update every seeded registry in `context/ProfileContext.test.tsx` to include `version: 1` and `revision: 0`. Change mutation calls to:

```ts
await act(async () => {
  await current().deleteProfile('target');
});
```

Preserve the existing assertions that pending game-save data is discarded only after verified deletion and retained after any metadata failure.

- [ ] **Step 2: Write failing initialization tests**

Cover invalid structural JSON, backup recovery, exact-save reconstruction, storage read failure, and unsupported metadata. Assert children do not render with an invalid/empty context while initialization is pending; then assert recovered/read-only profiles render with accurate notice state.

- [ ] **Step 3: Write failing async action-state tests**

Use a controllable transaction promise. Assert only one mutation starts while `pendingAction` is non-null, success installs returned metadata, failure keeps prior metadata, a successful create sets `recentlyCreatedId` only in that provider, and failed create does not set it.

- [ ] **Step 4: Write failing storage-event merge tests**

Dispatch real `StorageEvent` objects for `FATE_PROFILES`. Assert:

```ts
// Local selection survives a remote rename/create/select.
expect(current().activeProfileId).toBe('target');

// An invalid or unsupported event never enters state.
expect(current().profiles).toEqual(previousProfiles);

// A valid event that removed the local ID selects incoming active or first.
expect(current().recoveryNotice?.kind).toBe('remote_removal');
```

Also assert `recentlyCreatedId` stays null in the receiving provider and equal/lower revisions are ignored. A lock-key storage event may trigger a bounded reread after pending contention but must not install data directly.

Before accepting an incoming registry that removed the locally selected ID, assert the registered eviction handler runs first. Its game-provider implementation must synchronously stage the newest serialized snapshot under the removed profile's existing base key, mark that pending entry ownership-blocked, and make subsequent writes from the old mounted provider fail closed before the provider changes selection.

- [ ] **Step 5: Run provider tests and verify RED**

```powershell
npm test -- context/ProfileContext.test.tsx
```

Expected: FAIL because the provider is still synchronous and trusts primary JSON.

- [ ] **Step 6: Implement the provider integration**

Create one page-lifetime owner ID and one dependency object per provider mount. Validate saves with `parseAndMigrateSave(raw, initialState).ok`. Start with no metadata; render an accessible `Loading profiles...` status until `initializeProfileMetadata` settles. Route all actions through `mutateProfileMetadata`; keep a ref only for the newest validated local view, never as the transaction source of truth.

For incoming valid newer metadata, merge the durable registry with the local active-selection policy before `setMetadata`: keep the local ID when present; otherwise invoke the registered eviction handler, use incoming active ID or the first profile, and set a persistent `remote_removal` notice. Remove listeners on unmount and ignore late promises.

Expose `stageForProfileEviction()` from `GameProvider`: set an eviction ref synchronously, stage `serializeCurrent()` through `pendingSaves`, block it with `ownership_conflict`, and release the old writer lease. Add a small bridge inside `GameProvider` in `App.tsx` that registers this callback with `ProfileProvider`; unregister it when the keyed game provider unmounts. Include the eviction ref in every write authorization check so no old-profile write can occur after the storage event.

- [ ] **Step 7: Run provider and ownership regressions and verify GREEN**

```powershell
npm test -- context/ProfileContext.test.tsx hooks/useProfileWriterLease.test.tsx context/GameContext.persistence.test.ts
npm run typecheck
```

Expected: provider, save ownership, and persistence tests PASS.

- [ ] **Step 8: Commit provider integration**

```powershell
git add context/ProfileContext.tsx context/ProfileContext.test.tsx context/GameContext.tsx context/GameContext.persistence.test.ts App.tsx
git commit -m "feat: synchronize validated profile state"
```

---

### Task 7: Pending Profile UI and Persistent Recovery Banner

**Files:**
- Modify: `components/ProfileSwitcher.tsx:1-151`
- Create: `components/ProfileSwitcher.test.tsx`
- Create: `components/ProfileRecoveryBanner.tsx`
- Create: `components/ProfileRecoveryBanner.test.tsx`
- Modify: `App.tsx:1-37,960-975`

**UI result policy:**

```ts
export const profileMutationMessage = (reason: ProfileMutationFailure): string => ({
  busy: 'Another tab is updating profiles. Try again in a moment.',
  profile_in_use: 'That profile is open in another tab. Switch away from it in every tab, then try again.',
  max_profiles: 'Maximum of 10 profiles reached.',
  not_found: 'That profile no longer exists. The list has been refreshed.',
  last_profile: 'You cannot delete the last profile.',
  unsupported_metadata: 'Profiles are read-only until this app supports the stored profile version.',
  storage_unavailable: 'Browser storage is unavailable. Your profile list is unchanged.',
  invalid_metadata: 'Profile data could not be validated. Your profile list is unchanged.',
  backup_failed: 'The safety backup could not be verified. Your profile list is unchanged.',
  verification_failed: 'The profile change could not be verified. Your profile list is unchanged.',
}[reason]);
```

- [ ] **Step 1: Write failing switcher interaction tests**

Mock `useProfiles` with deferred promises. Assert:

- create/rename inputs and submit buttons disable while pending;
- a double click starts exactly one transaction;
- failed create/rename keeps the input text and form open;
- successful create/rename clears and closes the form;
- switch closes only after success;
- the active profile delete button is disabled with title `Switch profiles before deleting this profile`;
- a foreign in-use delete failure leaves the menu open and shows the exact message;
- controls are disabled while metadata is read-only.

- [ ] **Step 2: Write failing recovery-banner accessibility tests**

Render each notice shape and assert `role="status"` for successful repair and `role="alert"` for partial/read-only/unsupported/remote-removal states. Assert text includes only counts and actions, never raw storage keys or stored values. Verify `Dismiss profile recovery notice` calls the provided callback and returns focus predictably.

- [ ] **Step 3: Run component tests and verify RED**

```powershell
npm test -- components/ProfileSwitcher.test.tsx components/ProfileRecoveryBanner.test.tsx
```

Expected: FAIL because the async UI contract and recovery banner do not exist.

- [ ] **Step 4: Implement awaited switcher actions**

Make each form handler async, await the result, and close/reset only when `result.ok`. Disable duplicate submissions from context pending state, retain the existing 30-character input limit, keep the native destructive confirmation, and use the shared message mapper for focused feedback. Keep the selected profile's delete control visible but disabled so the restriction is discoverable.

- [ ] **Step 5: Implement and mount the recovery banner**

Create a view component receiving `notice` and `onDismiss`, plus a context-connected wrapper. Mount `<ProfileRecoveryBanner />` directly after `<Header />` and before the save-conflict/failure banners. This keeps it within `ProfileProvider` but outside any profile-keyed component.

- [ ] **Step 6: Run component/provider tests and verify GREEN**

```powershell
npm test -- components/ProfileSwitcher.test.tsx components/ProfileRecoveryBanner.test.tsx context/ProfileContext.test.tsx components/SaveConflictBanner.test.tsx components/SaveFailureBanner.test.tsx
npm run typecheck
```

Expected: all profile and existing save-banner tests PASS.

- [ ] **Step 7: Commit the user-facing controls**

```powershell
git add components/ProfileSwitcher.tsx components/ProfileSwitcher.test.tsx components/ProfileRecoveryBanner.tsx components/ProfileRecoveryBanner.test.tsx App.tsx
git commit -m "feat: surface profile recovery and pending state"
```

---

### Task 8: Application Lifecycle and Multi-Client Regression Coverage

**Files:**
- Modify: `App.lifecycle.test.tsx`
- Modify: `context/ProfileContext.test.tsx`
- Modify: `utils/profileMetadataTransaction.test.ts`

- [ ] **Step 1: Add failing full-application corruption tests**

In `App.lifecycle.test.tsx`, seed syntactically valid but malformed profile metadata, one valid exact profile save, and onboarding-complete state. Render `<App />` and assert the dashboard loads on the recovered profile, the recovery notice appears, and no error boundary/white screen appears. Add a future-version case that loads a supported recovered run read-only without changing the stored future JSON.

- [ ] **Step 2: Add deterministic two-client transaction tests**

Use two transaction dependency objects with distinct owner IDs and a shared storage map. Control arbitration waits to cover:

- concurrent distinct creates preserve both IDs;
- concurrent rename plus create preserves both operations;
- concurrent selects each return a valid result and leave a valid persisted active ID;
- delete contending with rename/create cannot resurrect or lose a profile;
- a crashed holder blocks before expiry and allows progress immediately after expiry;
- an old-client overwrite between primary write and readback produces `verification_failed`, never false success.

- [ ] **Step 3: Add provider-level local-selection regression tests**

Mount two provider harnesses over a shared storage implementation and manually deliver storage events as browsers do. Assert the receiving provider sees create/rename/delete changes, retains any still-valid local selection, never receives the creator's `recentlyCreatedId`, and switches only when its selected ID is actually absent.


For the forced-removal case, mount the registered game bridge and assert its latest serialized state exists in `getPendingSave(removedBaseKey)`, has reason `ownership_conflict`, and cannot flush through the evicted provider before the profile selection changes.

- [ ] **Step 4: Run lifecycle/integration tests and verify RED then GREEN**

Run once before filling the missing behavior and once after the minimal fixes:

```powershell
npm test -- App.lifecycle.test.tsx context/ProfileContext.test.tsx utils/profileMetadataTransaction.test.ts
```

Expected before final fixes: at least one new regression test FAILS. Expected after fixes: all listed tests PASS.

- [ ] **Step 5: Run the save-compatibility regression slice**

```powershell
npm test -- context/GameContext.test.tsx context/GameContext.persistence.test.ts utils/gamePersistence.test.ts utils/saveSchema.test.ts utils/backups.test.ts utils/pendingSaves.test.ts hooks/useProfileWriterLease.test.tsx
```

Expected: existing saves, imports, backups, pending-save recovery, and writer ownership remain PASSING without schema changes.

- [ ] **Step 6: Commit integration coverage and minimal fixes**

```powershell
git add App.lifecycle.test.tsx context/ProfileContext.test.tsx utils/profileMetadataTransaction.test.ts utils/profileMetadataTransaction.ts context/ProfileContext.tsx App.tsx
git commit -m "test: cover profile metadata recovery workflows"
```

---

### Task 9: Player-Facing Changelog and Release Verification

**Files:**
- Modify: `data/changelog.ts:1-30`
- Modify: `data/changelog.test.ts:1-55`

- [ ] **Step 1: Write the failing changelog assertion**

Add a test requiring the newest entry:

```ts
it('announces profile registry recovery and multi-tab safety', () => {
  expect(LATEST_CHANGELOG).toMatchObject({
    id: '2026-08-02-profile-metadata-integrity',
    title: 'Safer Profile Management',
    date: '2026-08-02',
  });
  expect(LATEST_CHANGELOG.sections.fixed).toEqual(expect.arrayContaining([
    'Damaged profile lists now recover every valid browser save they can find instead of leaving the app on a blank screen.',
    'Creating, renaming, switching, and deleting profiles in multiple tabs no longer silently loses profile-list changes.',
    'Profiles that are still open in another tab cannot be deleted until that tab switches away or closes.',
  ]));
});
```

- [ ] **Step 2: Run the changelog test and verify RED**

```powershell
npm test -- data/changelog.test.ts
```

Expected: FAIL because the new release is absent.

- [ ] **Step 3: Add the exact player-facing release**

Insert the tested entry at the top of `CHANGELOG_RELEASES`. Keep implementation terms such as localStorage keys, locks, revisions, and leases out of player-facing copy.

- [ ] **Step 4: Run focused changelog checks and verify GREEN**

```powershell
npm test -- data/changelog.test.ts scripts/player-facing-changelog.test.ts
npm run changelog:verify
```

Expected: all changelog requirements PASS.

- [ ] **Step 5: Run the full automated release gate**

```powershell
npm test
npm run typecheck
npm run changelog:verify
npm run content:verify
$env:VITE_BASE='/OSRS-Fate-Locked/'; npm run build
```

Expected: every command exits 0. Review generated-file changes after content/build commands and do not commit unrelated generated drift. Confirm the built `dist/index.html` references assets under `/OSRS-Fate-Locked/`.

- [ ] **Step 6: Perform the real two-tab browser walkthrough**

Serve the production build locally and use two tabs at the same preview origin:

1. Open the same existing profile in both tabs and confirm milestone 2's writer conflict remains visible in the blocked tab.
2. Switch one tab away, create a profile, and confirm it appears in the other tab without changing that tab's selected profile.
3. Rename the new profile and confirm both lists update.
4. Attempt deletion while that profile is open in the other tab; confirm deletion is rejected with the in-use message.
5. Switch the other tab away, delete again, and confirm exact profile data disappears while unrelated profiles remain.
6. Seed malformed current metadata with a valid backup; refresh and confirm repair plus the persistent notice.
7. Seed malformed primary and backup metadata with valid and invalid exact base saves; refresh and confirm valid runs recover, invalid saves remain untouched, and counts are accurate.
8. Seed an unexpired metadata lock, confirm a mutation reports busy, advance/remove the expired claim, and confirm retry succeeds.
9. Refresh both tabs and confirm the final registry and active profiles remain usable with no blank screen or console error.

- [ ] **Step 7: Commit the changelog after all gates pass**

```powershell
git add data/changelog.ts data/changelog.test.ts
git commit -m "docs: announce safer profile management"
```

- [ ] **Step 8: Stop for user review**

Provide the user with:

- the branch name and commit list;
- automated verification results;
- the browser walkthrough results and screenshots where useful;
- any remaining limitations or risks;
- confirmation that no merge, push, or deployment has occurred.

Do not merge to `main`, push to GitHub, or update the live app until the user explicitly approves this milestone.

---

## Final Spec-Coverage Checklist

- [ ] Current and legacy metadata are strictly distinguished and normalized.
- [ ] Unsupported future metadata stays byte-for-byte untouched and read-only.
- [ ] Primary, backup, exact-save reconstruction, legacy single-save, and fresh-start recovery order is tested.
- [ ] Corrupt raw metadata is archived before replacement; archive failure stays in-memory/read-only.
- [ ] Recovery retains safe names/timestamps, bounds work at 100 recovered profiles, and reports unreadable/overflow saves.
- [ ] Every mutation locks, rereads, validates, backs up, writes, reads back, and owner-checks release.
- [ ] Create is idempotent and enforces the newest durable 10-profile limit.
- [ ] Rename/select/delete return typed safe failures for stale IDs.
- [ ] Delete rejects the last, selected-at-UI, and live-writer profiles and rolls exact owned data back after commit failure.
- [ ] Storage events install only newer validated registries and preserve still-valid local selection.
- [ ] `recentlyCreatedId` remains local to the creating provider.
- [ ] Forced removal stages the newest game snapshot and blocks old-provider writes before switching profiles.
- [ ] Pending controls reject duplicate submissions and failed forms retain user input.
- [ ] Recovery feedback is persistent, accessible, count-only, and dismissible.
- [ ] Game save schema, import/export, backup, pending-save, and writer-ownership regressions pass.
- [ ] Full tests, type checking, changelog validation, content validation, base-path production build, and two-tab walkthrough pass.
- [ ] The user reviews the milestone before any merge, push, or live deployment.
