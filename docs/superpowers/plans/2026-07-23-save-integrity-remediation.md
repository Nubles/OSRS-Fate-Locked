# Save Integrity Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (<code>- [ ]</code>) syntax for tracking.

**Goal:** Make every save export current, every import or restore transactional and schema-validated, and every profile deletion remove exactly that profile's complete local footprint.

**Architecture:** Move parsing, structural validation, normalization, and ordered migration into a pure <code>saveSchema</code> boundary. GameContext serializes its live reducer state and accepts only validated current-state replacements, while file/sync decoders enforce resource limits before expansion. A central profile-storage registry owns all per-profile key construction and exact deletion.

**Tech Stack:** React 18, TypeScript, Vitest, browser FileReader/localStorage APIs, CompressionStream/DecompressionStream.

## Global Constraints

- Do not modify RuneLite plugin code or the runelite-plugin mirror.
- Do not add a remote save service, change the sync-code wire format, or include Discord webhook settings in GameState.
- Preserve current version-1 saves and the existing power-to-arcana, poh-to-housing, collection-log, and task-ID migrations.
- Reject unknown future schema versions instead of partially loading them.
- Never dispatch a rejected object or create a pre-import backup for an operation that does not overwrite state.
- A failed protective backup produces a warning; it does not turn a valid explicit import into a failure.
- Never enumerate or delete a localStorage prefix. Profile deletion uses the six exact registered keys only.
- Every behavior change follows RED, GREEN, REFACTOR: write a failing test, observe the intended failure, implement only enough to pass, and rerun the covering tests.
- Every task ends in a focused commit using a message file, not a quoted multiline PowerShell message.

---

## File Structure

**Create**

- <code>utils/saveSchema.ts</code> and <code>utils/saveSchema.test.ts</code>: current schema, resource limits, recursive validation, normalization, and migrations.
- <code>utils/gamePersistence.ts</code> and <code>utils/gamePersistence.test.ts</code>: pure live-state serialization and transactional import/restore preparation.
- <code>utils/encryption.test.ts</code>: bounded legacy/plain and obfuscated file decoding.
- <code>utils/profileStorage.ts</code> and <code>utils/profileStorage.test.ts</code>: exact profile-owned key registry and deletion result.

**Modify**

- <code>types.ts</code>: shared import result and save error types where they are part of public context APIs.
- <code>context/GameContext.tsx</code>: use the schema boundary on initial load/import/restore, export live state, and return results.
- <code>context/GameContext.test.tsx</code> or the nearest existing context test: state-level stale-export and transactional replacement coverage without adding a DOM test dependency.
- <code>utils/encryption.ts</code>: return a stable decode result and enforce raw/expanded file limits.
- <code>utils/syncCode.ts</code> and <code>utils/syncCode.test.ts</code>: encoded and expanded sync limits plus stable error codes.
- <code>utils/backups.ts</code> and <code>utils/backups.test.ts</code>: report whether a protective snapshot was stored.
- <code>App.tsx</code>: file-size preflight and success-only-after-acceptance behavior.
- <code>components/SyncCodeModal.tsx</code>: schema validation at verify/import, inline errors, warning display, and success-only close.
- <code>components/BackupNagBanner.tsx</code>: consume the non-null live export contract.
- <code>components/TestSuiteRunner.tsx</code>: adapt internal diagnostic imports to the explicit result contract.
- <code>context/ProfileContext.tsx</code>: exact sidecar cleanup before metadata persistence.
- <code>utils/backupNag.ts</code>, <code>utils/backups.ts</code>, <code>utils/discordWebhook.ts</code>, and <code>components/FeatureRevealDriver.tsx</code>: consume exported centralized key constructors.
- <code>data/changelog.ts</code>: describe only the save-integrity changes that actually landed.

---

### Task 1: Define the strict, version-aware save boundary

**Files:**

- Create: <code>utils/saveSchema.ts</code>
- Create: <code>utils/saveSchema.test.ts</code>
- Modify: <code>types.ts</code>
- Modify: <code>utils/clogIdMigrations.ts</code> only if an exported pure adapter is required
- Modify: <code>utils/taskIdMigrations.ts</code> from the data plan only if an exported pure adapter is required

**Interfaces:**

~~~ts
export const CURRENT_SAVE_VERSION = 1;
export const MAX_SAVE_BYTES = 5 * 1024 * 1024;
export const MAX_HISTORY_ENTRIES = 100_000;
export const MAX_IDENTIFIER_ARRAY = 25_000;
export const MAX_COLLECTION_LOG_ENTRIES = 25_000;
export const MAX_USER_NOTES = 5_000;
export const MAX_NOTE_CHARS = 20_000;
export const MAX_IDENTIFIER_CHARS = 512;
export const MAX_HISTORY_DETAILS_CHARS = 20_000;
export const MAX_SEED_CHARS = 256;
export const MAX_COUNTER = 2_147_483_647;

export type SaveErrorCode =
  | 'too_large'
  | 'invalid_json'
  | 'invalid_root'
  | 'unsupported_version'
  | 'invalid_field'
  | 'invalid_number'
  | 'invalid_history'
  | 'invalid_unlocks'
  | 'decode_failed';

export type SaveWarning = {
  code: 'migrated' | 'storage_warning';
  message: string;
};

export type SaveValidationResult =
  | { ok: true; state: GameState; sourceVersion: number; warnings: SaveWarning[] }
  | { ok: false; code: SaveErrorCode; message: string; path?: string };

export const validateAndMigrateSave = (
  input: unknown,
  defaults: GameState,
): SaveValidationResult => { /* pure */ };

export const parseAndMigrateSave = (
  json: string,
  defaults: GameState,
): SaveValidationResult => { /* size check, parse, delegate */ };
~~~

- [ ] **Step 1: Pin accepted current and historical fixtures with failing tests**

In <code>utils/saveSchema.test.ts</code>, construct fixtures from an explicit test-only <code>defaults</code> clone and prove:

~~~ts
it('accepts a complete current export and preserves every GameState field', () => {
  const current = fullStateFixture();
  expect(validateAndMigrateSave(current, defaults)).toEqual({
    ok: true,
    state: current,
    sourceVersion: CURRENT_SAVE_VERSION,
    warnings: [],
  });
});

it('migrates the supported legacy aliases exactly once', () => {
  const legacy = legacyFixture({ power: ['Protect from Melee'], poh: ['Kitchen'] });
  const first = expectAccepted(validateAndMigrateSave(legacy, defaults));
  const second = expectAccepted(validateAndMigrateSave(first.state, defaults));
  expect(first.state.unlocks.arcana).toContain('Protect from Melee');
  expect(first.state.unlocks.housing).toContain('Kitchen');
  expect(second.state).toEqual(first.state);
});
~~~

Include collection-log and Diary/CA task-ID legacy fixtures. Assert de-duplication preserves first-seen order and does not sum duplicate collection-log aliases twice.

Run:

~~~powershell
npx vitest run utils/saveSchema.test.ts
~~~

Expected: FAIL because <code>utils/saveSchema.ts</code> does not exist.

- [ ] **Step 2: Add malicious-shape and numeric boundary tests**

Cover every exported limit and representative nested paths:

~~~ts
it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 2_147_483_648])(
  'rejects invalid key counters: %s', value => {
    expectRejected(candidate({ keys: value }), 'invalid_number', 'keys');
  },
);

it.each([0, 100, 1.5])('rejects impossible skill levels: %s', level => {
  expectRejected(candidate({ unlocks: { levels: { Attack: level } } }), 'invalid_number', 'unlocks.levels.Attack');
});

it.each(['__proto__', 'prototype', 'constructor'])('rejects dangerous key %s at any depth', key => {
  expectRejected(parsedDangerousFixture(key), 'invalid_field');
});
~~~

Add explicit tests for:

- non-plain roots, arrays, null, unknown top-level fields, and unknown <code>unlocks</code> fields;
- a missing version treated as the supported pre-version legacy shape, version 1 accepted, and an unknown future <code>version</code> rejected;
- history at 100,000 entries accepted and 100,001 rejected without quadratic work;
- identifier arrays at 25,000 accepted and 25,001 rejected;
- collection log at 25,000 entries accepted and 25,001 rejected;
- 5,000 notes accepted, 5,001 rejected, and 20,001-character note rejected;
- general identifier, history details, and seed string boundaries;
- skill method tiers 0–10, skill levels 1–99, equipment integers 0 through <code>EQUIPMENT_TIER_MAX[slot]</code>, non-negative safe counters, timestamps, booleans, enums, <code>customMode</code>, <code>loadout</code>, <code>rival</code>, and <code>linkedAccount</code>;
- invalid history records, metadata depth, metadata strings, sparse arrays, symbols/functions/BigInt/cycles when the API is called programmatically;
- absent optional fields receiving documented defaults without accepting unknown fields.

Run the test and confirm failures identify missing validation rather than fixture mistakes.

- [ ] **Step 3: Implement plain-object inspection and field validators**

Implement small path-aware helpers before the top-level validator:

~~~ts
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const invalid = (
  code: SaveErrorCode,
  message: string,
  path?: string,
): SaveValidationResult => ({ ok: false, code, message, path });
~~~

Walk own enumerable keys, reject dangerous names at every depth, and use explicit allowed-key sets for <code>GameState</code>, <code>UnlockState</code>, history records, custom rules, loadout, and rival records. Validate before copying. Do not spread untrusted records.

Build a fresh normalized object from <code>defaults</code>, copy only accepted fields, run ordered migrations on validated legacy fields, stamp <code>CURRENT_SAVE_VERSION</code>, and validate the resulting current object once more. Keep migration functions pure and idempotent.

- [ ] **Step 4: Add JSON byte-size and round-trip tests**

Use <code>TextEncoder</code> byte length, not JavaScript character count:

~~~ts
expect(parseAndMigrateSave('x'.repeat(MAX_SAVE_BYTES + 1), defaults)).toMatchObject({
  ok: false,
  code: 'too_large',
});

const accepted = expectAccepted(validateAndMigrateSave(fullStateFixture(), defaults));
const reparsed = expectAccepted(parseAndMigrateSave(JSON.stringify(accepted.state), defaults));
expect(reparsed.state).toEqual(accepted.state);
~~~

Include invalid JSON and ensure messages contain only code/path context, never the full input.

- [ ] **Step 5: Run focused verification and commit**

~~~powershell
npx vitest run utils/saveSchema.test.ts utils/clogIdMigrations.test.ts utils/taskIdMigrations.test.ts
npx tsc --noEmit
~~~

Expected: all selected tests pass and TypeScript exits 0.

Commit: <code>feat: add strict save schema boundary</code>

---

### Task 2: Bound file and sync-code decoding before expansion

**Files:**

- Create: <code>utils/encryption.test.ts</code>
- Modify: <code>utils/encryption.ts</code>
- Modify: <code>utils/syncCode.ts</code>
- Modify: <code>utils/syncCode.test.ts</code>
- Modify: <code>utils/saveSchema.ts</code> only to reuse exported byte-limit helpers/types

**Interfaces:**

~~~ts
export const MAX_SYNC_CODE_CHARS = 2 * 1024 * 1024;

export type SaveDecodeResult =
  | { ok: true; value: unknown }
  | { ok: false; code: 'too_large' | 'invalid_json' | 'decode_failed'; message: string };

export const deobfuscateFateSave = (cipher: string): SaveDecodeResult => { /* bounded */ };

export interface DecodeResult {
  ok: boolean;
  state?: unknown;
  checksumOk?: boolean;
  code?: 'too_large' | 'decode_failed' | 'invalid_json';
  error?: string;
}
~~~

- [ ] **Step 1: Write failing file-decoder compatibility and limit tests**

Test plain JSON and <code>FATE_LOCKED::</code> fixtures, invalid hex, odd-length hex, invalid Base64/URI sequences, and empty input. Pin raw and expanded byte limits:

~~~ts
it('rejects oversized input before decoding', () => {
  expect(deobfuscateFateSave('x'.repeat(MAX_SAVE_BYTES + 1))).toMatchObject({
    ok: false,
    code: 'too_large',
  });
});

it('rejects an obfuscated payload whose decoded JSON exceeds the limit', () => {
  const encoded = obfuscateFateSave({ note: 'x'.repeat(MAX_SAVE_BYTES) });
  expect(deobfuscateFateSave(encoded)).toMatchObject({ ok: false, code: 'too_large' });
});
~~~

Run:

~~~powershell
npx vitest run utils/encryption.test.ts
~~~

Expected: FAIL against the current nullable decoder and missing limits.

- [ ] **Step 2: Implement bounded file decoding**

Check raw byte length before JSON parsing or hex expansion. For obfuscated input, validate the prefix, even hex length, hex alphabet, and conservative decoded-size estimate before allocating strings. Check the final UTF-8 JSON byte length again before parsing. Return a discriminated result; do not log imported content.

Keep <code>obfuscateFateSave</code> wire-compatible. A valid save produced before this change must still decode.

- [ ] **Step 3: Write failing sync-code expansion tests**

Add tests for:

- code text at exactly <code>MAX_SYNC_CODE_CHARS</code> and one character above;
- raw payload whose decoded JSON is above 5 MiB;
- gzip “zip bomb” fixture whose compressed code is under 2 MiB and output crosses 5 MiB;
- checksum mismatch, unknown method, malformed Base64URL, truncated code, invalid JSON, and valid old raw/gzip codes;
- failure results having a stable <code>code</code> and no accepted <code>state</code>.

Run:

~~~powershell
npx vitest run utils/syncCode.test.ts
~~~

Expected: the new limit cases fail before implementation.

- [ ] **Step 4: Enforce streaming/decompressed limits**

Reject the encoded code before <code>split</code>/Base64 allocation when it exceeds the encoded cap. For raw content, reject the decoded byte array above <code>MAX_SAVE_BYTES</code>. For gzip, read the <code>DecompressionStream</code> in chunks and abort once accumulated output exceeds <code>MAX_SAVE_BYTES</code>; do not call <code>Response(...).arrayBuffer()</code> on unbounded decompressed output.

Compute and compare the checksum only after bounded UTF-8 decoding. Preserve the existing checksum and format identifiers.

- [ ] **Step 5: Verify and commit**

~~~powershell
npx vitest run utils/encryption.test.ts utils/syncCode.test.ts utils/saveSchema.test.ts
npx tsc --noEmit
~~~

Expected: all selected tests pass.

Commit: <code>fix: bound save and sync decoding</code>

---

### Task 3: Make GameContext export and replacement transactional

**Files:**

- Create: <code>utils/gamePersistence.ts</code>
- Create: <code>utils/gamePersistence.test.ts</code>
- Modify: <code>utils/backups.ts</code>
- Modify: <code>utils/backups.test.ts</code>
- Modify: <code>context/GameContext.tsx</code>
- Modify: <code>context/GameContext.test.tsx</code> if present; otherwise keep state-transition coverage in the pure helper test
- Modify: <code>components/TestSuiteRunner.tsx</code>

**Interfaces:**

~~~ts
export type ImportResult =
  | { ok: true; warnings: SaveWarning[] }
  | { ok: false; code: SaveErrorCode; message: string; path?: string };

export type BackupWriteResult =
  | { stored: true }
  | { stored: false; reason: 'empty' | 'duplicate' | 'storage_unavailable' };

export const serializeCurrent = (
  state: GameState & { lastEvent?: unknown },
): string => {
  const { lastEvent: _lastEvent, ...persisted } = state;
  return JSON.stringify(persisted);
};

export const prepareReplacement = (
  input: unknown,
  current: GameState,
  defaults: GameState,
): SaveValidationResult => validateAndMigrateSave(input, defaults);
~~~

GameContext public contract becomes:

~~~ts
importSave: (data: unknown) => ImportResult;
restoreBackup: (ts: number) => ImportResult;
getExportData: () => string;
createBackup: (reason: string) => BackupWriteResult;
~~~

- [ ] **Step 1: Write failing live-state serialization tests**

Prove serialization is pure, excludes transient <code>lastEvent</code> without emitting a null/undefined field, does not call localStorage, and includes an immediate reducer change even when a supplied persisted string is stale:

~~~ts
it('serializes the visible state instead of a persisted snapshot', () => {
  const visible = { ...defaults, keys: 4 };
  expect(JSON.parse(serializeCurrent(visible)).keys).toBe(4);
});
~~~

Add a state-transition regression around the GameContext reducer/export closure if existing test infrastructure supports it without installing jsdom. Otherwise export the reducer/current serializer through a test-only-neutral module and test the exact functions GameContext calls.

Run the test and observe the missing helper/old localStorage behavior.

- [ ] **Step 2: Write failing transactional preparation tests**

Cover:

- invalid input returns failure and invokes neither backup nor dispatch callback;
- valid input snapshots the exact current serialized state before replacement;
- backup storage failure adds one <code>{ code: 'storage_warning' }</code> warning but still returns success/replaces;
- duplicate backup is not a storage warning;
- restore validates selected backup before protective snapshot/replacement;
- missing or corrupt backup returns failure and leaves the ring unchanged.

Use injected callbacks in the pure helper so ordering is asserted without React rendering:

~~~ts
const events: string[] = [];
const result = applyPreparedReplacement(candidate, {
  current,
  defaults,
  writeBackup: data => { events.push('backup:' + JSON.parse(data).keys); return { stored: true }; },
  replace: state => { events.push('replace:' + state.keys); },
});
expect(result.ok).toBe(true);
expect(events).toEqual(['backup:3', 'replace:9']);
~~~

- [ ] **Step 3: Make backup writes observable**

Change <code>pushBackup</code> to return <code>BackupWriteResult</code>. Keep empty and duplicate inputs as successful no-op semantics for callers by distinguishing them from <code>storage_unavailable</code>. Pin quota failure and retry behavior in <code>utils/backups.test.ts</code>.

- [ ] **Step 4: Integrate the boundary into GameContext**

Remove local <code>isValidSaveData</code> and <code>migrateSave</code>. Initial profile loading must call <code>parseAndMigrateSave</code>; corrupt storage returns <code>initialState</code> and emits one player-visible warning after mount, without spreading the invalid object.

Implement:

~~~ts
const serializeCurrent = useCallback(
  () => serializeGameState(stateRef.current),
  [],
);

const getExportData = useCallback((): string => serializeCurrent(), [serializeCurrent]);
~~~

Maintain <code>stateRef.current</code> synchronously with accepted reducer transitions so an import/export invoked in the same browser turn reads the latest visible state. Persistence may remain debounced by 500 ms.

For <code>importSave</code>, validate first, call <code>pushBackup(storageKey, serializeCurrent(), 'Before import')</code> only on accepted input, dispatch one fully normalized <code>LOAD_SAVE</code>, update the ref, and return the explicit result. Do not validate again in the reducer and do not accept <code>Partial&lt;GameState&gt;</code> there.

For <code>restoreBackup</code>, read the string, pass it through <code>parseAndMigrateSave</code>, then use the same replacement helper. Do not remove or rewrite the selected backup on failure.

- [ ] **Step 5: Adapt internal diagnostics and verify**

Update <code>components/TestSuiteRunner.tsx</code> to assert/ignore the returned result deliberately. It must use complete fixtures or the documented historical partial-save migration path; do not cast around the schema.

Run:

~~~powershell
npx vitest run utils/gamePersistence.test.ts utils/backups.test.ts utils/saveSchema.test.ts
npx tsc --noEmit
~~~

Expected: all selected tests and type checking pass.

Commit: <code>fix: make save replacement transactional</code>

---

### Task 4: Report file, sync, and restore outcomes honestly

**Files:**

- Modify: <code>App.tsx</code>
- Modify: <code>components/SyncCodeModal.tsx</code>
- Modify: <code>components/BackupNagBanner.tsx</code>
- Modify: <code>utils/gamePersistence.test.ts</code>
- Modify: <code>utils/syncCode.test.ts</code>

- [ ] **Step 1: Add failing outcome-policy tests before UI changes**

Keep UI decision logic pure and small instead of adding a new browser-test stack solely for this task:

~~~ts
export const importUiDecision = (result: ImportResult) => result.ok
  ? { close: true, success: 'Fate restored successfully', error: null }
  : { close: false, success: null, error: result.message };
~~~

Place this helper in <code>utils/gamePersistence.ts</code> if both file and sync flows use it. Test success, failure, and success-with-backup-warning. The warning must be displayed and the operation still closes as accepted.

Run <code>npx vitest run utils/gamePersistence.test.ts</code> and observe RED.

- [ ] **Step 2: Fix file import behavior**

In <code>App.tsx</code>:

1. Reject <code>file.size &gt; MAX_SAVE_BYTES</code> before creating <code>FileReader</code>.
2. Decode through <code>deobfuscateFateSave</code> and branch on its result.
3. Call <code>importSave(decoded.value)</code> without a cast or a separate <code>createBackup</code> call.
4. Show success only when <code>result.ok</code> is true.
5. Show the returned error on failure and leave the current state unchanged.
6. Clear the native file input after the handler completes so the same file can be retried.

Do not print imported content to the console.

- [ ] **Step 3: Fix SyncCodeModal verify/import/restore behavior**

At verify time, decode and validate for preview using the same schema function and defaults exported through a safe helper. Store only the normalized accepted candidate for import; an invalid nested save cannot reach the confirmation button.

At import time, call <code>importSave(decoded)</code> once. Remove the modal's separate <code>createBackup('Before sync import')</code>. Close and clear input only on success. On failure, keep the modal and source text open and render <code>result.message</code> inline.

At restore time, call <code>restoreBackup</code> and close only on success. Render invalid-backup errors without mutating the selected list. Show storage warnings through the existing toast and inline status, not as a false failure.

- [ ] **Step 4: Adapt export consumers to the non-null contract**

Remove stale <code>null</code> fallbacks in <code>App.tsx</code>, <code>SyncCodeModal.tsx</code>, and <code>BackupNagBanner.tsx</code>. Parse the live serializer only at the legacy encoder boundary. A localStorage read/quota failure must not prevent file/sync export.

- [ ] **Step 5: Verify and commit**

~~~powershell
npx vitest run utils/gamePersistence.test.ts utils/encryption.test.ts utils/syncCode.test.ts
npx tsc --noEmit
npm run build
~~~

Expected: tests, types, and production build pass.

Commit: <code>fix: surface real save import outcomes</code>

---

### Task 5: Centralize and delete exact profile-owned storage

**Files:**

- Create: <code>utils/profileStorage.ts</code>
- Create: <code>utils/profileStorage.test.ts</code>
- Modify: <code>context/ProfileContext.tsx</code>
- Modify: <code>utils/backups.ts</code>
- Modify: <code>utils/backupNag.ts</code>
- Modify: <code>utils/discordWebhook.ts</code>
- Modify: <code>components/FeatureRevealDriver.tsx</code>
- Modify: related tests for each existing sidecar helper if imports change

**Interfaces:**

~~~ts
export const profileBaseKey = (profileId: string): string => 'FATE_PROFILE_' + profileId;
export const profileBackupKey = (storageKey: string): string => storageKey + '__backups';
export const profileExportNagKey = (storageKey: string): string => storageKey + '__exportNag';
export const profileDiscordKey = (storageKey: string): string => storageKey + '__discord';
export const profileDiscordCursorKey = (storageKey: string): string => storageKey + '__discordCursor';
export const profileFeatureSeenKey = (profileId: string): string =>
  'fate_features_seen_v1_' + profileId;

export const profileOwnedKeys = (profileId: string): readonly string[] => { /* six exact keys */ };

export interface ProfileDeleteResult { removed: string[]; failed: string[] }
export const deleteProfileStorage = (
  storage: Pick<Storage, 'removeItem'>,
  profileId: string,
): ProfileDeleteResult => { /* exact registry only */ };
~~~

- [ ] **Step 1: Write the failing registry/deletion contract**

Assert the exact ordered six-key list from the approved design. Seed a fake storage map with:

- all six target keys;
- all six keys for a different profile;
- <code>FATE_PROFILES</code>, changelog, coach/tour, relay, and onboarding global keys;
- a misleading key beginning with the same profile prefix.

After deletion, assert only the exact six target keys were passed to <code>removeItem</code>. Add a test where one removal throws and prove later keys are still attempted and the failed list is exact.

Run:

~~~powershell
npx vitest run utils/profileStorage.test.ts
~~~

Expected: FAIL because the registry does not exist.

- [ ] **Step 2: Implement the registry and remove duplicate key literals**

Export the constructors and make backups, backup nag, Discord config/cursor, FeatureRevealDriver, ProfileContext active storage key, and profile initialization consume them. A repository search for these suffix literals should leave only the registry and test expectations:

~~~powershell
rg -n "__backups|__exportNag|__discordCursor|__discord|fate_features_seen_v1_|FATE_PROFILE_" context components utils
~~~

Review every remaining result. Constants for global profile metadata are allowed; per-profile constructors are not duplicated.

- [ ] **Step 3: Integrate transactional profile deletion**

Inside <code>ProfileContext.deleteProfile</code>, keep last-profile protection and active-profile replacement exactly as today. For an allowed deletion:

1. Call <code>deleteProfileStorage(localStorage, id)</code> before persisting the updated profile metadata.
2. Persist the remaining profile list and chosen active profile even if an individual sidecar removal fails.
3. Show one concise warning naming the number of entries that could not be removed; never expose values.
4. Do not delete by prefix or enumerate all browser storage.

If metadata persistence itself fails, keep React metadata consistent with the previous state and show a storage failure rather than pretending deletion completed. Extract a pure deletion-plan helper if needed so this ordering is testable without jsdom.

- [ ] **Step 4: Verify cross-profile isolation and commit**

~~~powershell
npx vitest run utils/profileStorage.test.ts utils/backups.test.ts utils/backupNag.test.ts utils/discordWebhook.test.ts
npx tsc --noEmit
~~~

Expected: all selected tests pass.

Commit: <code>fix: remove all profile-owned sidecars</code>

---

### Task 6: Compatibility, changelog, and complete integrity verification

**Files:**

- Modify: <code>data/changelog.ts</code>
- Modify: <code>docs/superpowers/specs/2026-07-23-save-integrity-remediation-design.md</code> only if implementation discovered a factual correction that has already been approved
- Test: all save, migration, profile, and application suites

- [ ] **Step 1: Add truthful changelog bullets**

Describe the user-visible results only after the relevant implementation commits exist:

- exports now capture the run currently visible on screen;
- malformed/oversized imports and backups are rejected without overwriting progress;
- file/sync/restore dialogs now report real outcomes;
- deleting a profile clears its local backups and settings.

Do not claim relay security changes, encryption, authentication, plugin fixes, or remote backups.

- [ ] **Step 2: Run focused compatibility searches**

~~~powershell
rg -n "isValidSaveData|migrateSave|Partial<GameState>|createBackup\('Before (file|sync) import'" App.tsx components context utils
rg -n "localStorage\.getItem\(storageKey\)" context\GameContext.tsx
rg -n "__backups|__exportNag|__discordCursor|__discord|fate_features_seen_v1_" context components utils
~~~

Expected:

- old shallow validation and UI-side import casts are gone;
- <code>getExportData</code> does not read localStorage;
- sidecar literals live in the central registry and explicit tests only.

- [ ] **Step 3: Run the complete project gate**

~~~powershell
npm test
npx tsc --noEmit
npm run build
git diff --check
~~~

Expected: every command exits 0. Record test file/test totals from the actual output; do not reuse an earlier count.

- [ ] **Step 4: Review final diff for scope and secrets**

~~~powershell
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
rg -n "discord(app)?\.com/api/webhooks|gho_|BEGIN (RSA|OPENSSH|PRIVATE)" . --glob "!node_modules/**" --glob "!.git/**"
~~~

Expected: no RuneLite plugin files, no relay protocol changes, and no committed secrets. Any documentation example must use placeholders, never a functional credential.

- [ ] **Step 5: Commit any final documentation-only adjustment**

If Step 1 changed the changelog after the functional commits, commit it separately:

Commit: <code>docs: describe save integrity fixes</code>

If there is no remaining diff, do not create an empty commit.

---

## Plan Completion Criteria

- Export serialization reads the current reducer state and is independent of debounced storage.
- File, sync, local-profile, and backup inputs all cross the same strict schema/migration boundary.
- Every public import/restore call returns a discriminated result; failure causes zero replacement and zero pre-overwrite snapshot.
- Raw file, encoded sync, decompressed JSON, histories, identifier arrays, collection logs, notes, strings, and counters have tested limits.
- Version-1 and supported legacy saves migrate idempotently without losing progress.
- The exact six profile-owned keys are centralized and isolated deletion tests preserve other-profile and global keys.
- Full tests, TypeScript, production build, whitespace checks, and secret/scope review pass.
