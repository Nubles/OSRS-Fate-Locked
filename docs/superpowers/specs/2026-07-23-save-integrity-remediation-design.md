# Save integrity remediation design

**Date:** 2026-07-23

## Objective

Make exports, imports, backup restoration, and profile deletion behave transactionally and predictably: the exported file reflects the state visible on screen, malformed input cannot enter the reducer, failed imports never report success, and deleting a profile removes all of that profile's local data.

## Scope

This change will:

- Export the current in-memory game state instead of rereading a debounced localStorage copy.
- Add one strict, version-aware validation and migration boundary for file imports, sync codes, backup restores, and initial profile loading.
- Reject malformed, non-finite, out-of-range, oversized, or structurally dangerous input before state mutation.
- Return an explicit result from every import/restore attempt and show success only after acceptance.
- Preserve supported historical saves through explicit migrations and defaults.
- Centralize profile-owned storage keys and remove every sidecar when a profile is deleted.
- Add test coverage for stale exports, malformed nested data, storage sidecars, and failure UI behavior.

This change will not:

- Send save data to a new service or change the relay protocol.
- Include Discord webhook URLs, relay write tokens, or other local secrets in GameState exports.
- Encrypt local saves or introduce account authentication.
- Redesign the profile user interface.
- Silently repair arbitrary corrupt data when the intended value cannot be determined.
- Remove global browser preferences, changelog seen-state, or onboarding preferences when one profile is deleted.

## Current failure modes

The audit found four connected problems:

1. State persistence is delayed by 500 ms, while getExportData rereads localStorage. Exporting immediately after a change can therefore produce the previous state.
2. isValidSaveData checks only a few top-level types. Invalid nested unlocks, history entries, numeric values, and object shapes can pass into migration/reducer code.
3. file and sync-code flows close or show success after calling importSave even though importSave does not report acceptance.
4. profile deletion removes only FATE_PROFILE_<id>, leaving backups, export-nag state, Discord configuration/cursor, and feature-seen state behind.

These are addressed as one integrity boundary rather than separate UI patches.

## Canonical serialization

GameContext owns a pure serializeCurrent function that serializes the state currently held by React after applying the same safe normalization used for persistence. getExportData returns that string directly and no longer reads localStorage.

Consequences:

- An export made immediately after a roll, unlock, note edit, level change, or import contains that visible change.
- Auto-backup and file export use the same serialization path.
- A localStorage write delay or quota failure cannot make an export stale.
- Secrets stored outside GameState remain excluded.

The persistence debounce remains an implementation detail for browser writes. It is not an authority for exports.

## Validation and migration boundary

A new pure save-schema module owns parsing, validation, normalization, and version migration. GameContext and UI components consume its result; they do not cast parsed JSON to Partial<GameState>.

The public result is a discriminated union:

- success: ok true, a complete normalized GameState, source version, and non-fatal warnings.
- failure: ok false, a stable error code, a concise player-facing message, and an optional field path for tests/logging.

No reducer action is dispatched on failure.

### Processing order

Every external save follows the same order:

1. Enforce encoded/input size before expensive decoding or parsing.
2. Parse JSON or decode the sync payload with expanded-size protection.
3. Require a plain object and reject dangerous property names.
4. Validate the declared version against supported versions.
5. Validate each known field recursively with field-specific rules.
6. Run ordered, idempotent migrations on the validated historical shape.
7. Merge only whitelisted fields with fresh defaults.
8. Revalidate the complete current GameState and return it.

Initial local profile loading and backup restoration use the same validator. A corrupt stored profile falls back through the existing recovery path with a visible warning; it is never spread into initialState unchecked.

### Structural rules

Validation is strict at security- and reducer-sensitive boundaries:

- Objects must be plain objects or null-prototype records where a record is expected.
- __proto__, prototype, and constructor keys are rejected at every depth.
- Unknown top-level GameState and UnlockState fields are rejected as unsupported rather than copied into state.
- Optional fields may be absent; required current fields are supplied only by a documented migration/default.
- Arrays contain only the expected primitive or validated object type.
- Identifier arrays are de-duplicated while preserving first-seen order.
- Numbers must be finite. Counts and levels that are defined as integers must be safe integers.
- Enum-like strings must match the application's declared values.
- Record keys and string values have bounded lengths.
- History entries are validated as records with bounded metadata depth and size; functions, symbols, BigInt, cyclic data, and non-JSON values are impossible at the parsed boundary and are rejected if supplied programmatically in tests.

Unknown future save versions return an unsupported-version error. Older supported versions use explicit migrations; the old power-to-arcana, poh-to-housing, collection-log ID, and newly required task-ID migrations remain covered.

### Resource limits

The following limits are deliberately generous compared with legitimate application data while preventing accidental or hostile memory amplification:

- Raw file or expanded JSON: 5 MiB.
- Encoded sync payload: 2 MiB before expansion and 5 MiB after expansion.
- History: 100,000 entries.
- Any unlock identifier array, completedTasks, or pinnedGoals: 25,000 entries.
- Collection log: 25,000 item IDs.
- User notes: 5,000 entries and 20,000 characters per note.
- General identifiers/labels: 512 characters unless a narrower domain rule exists.
- History details: 20,000 characters per entry.
- Seed text: 256 characters.
- Numeric currencies/counters: integers from 0 through 2,147,483,647.
- Skill levels: 1 through 99.
- Skill method tiers: 0 through 10.
- Equipment tiers: 0 through the configured slot maximum.

Limits are exported constants and pinned by boundary tests. A future legitimate expansion changes a named constant and its test rather than weakening validation generally.

## Transactional import behavior

GameContext.importSave accepts unknown input and returns an ImportResult. Callers do not parse-and-cast around it.

For a successful file or sync import:

1. Validate and migrate the candidate fully.
2. Snapshot the current in-memory state as a pre-import backup.
3. Replace state with the accepted normalized GameState.
4. Return success and any migration warnings.
5. Only then close the dialog, clear temporary input, and show a success message.

For a failed import:

- Current state is unchanged.
- No pre-import backup is created because no overwrite occurred.
- The dialog remains open with the returned error.
- No success toast is shown.
- The input remains available for correction or copying unless it violates a size limit.

Backup restore follows the same validation-first ordering. It validates the selected backup before snapshotting and replacing the current run. An invalid backup reports failure and leaves both current state and the backup ring untouched.

If writing the protective backup fails because browser storage is unavailable, the import result includes a warning. The explicit user import may still proceed because the current in-memory snapshot and downloaded source remain available; the UI states that the automatic safety copy could not be stored. This warning behavior is covered by tests.

## Error presentation

Stable error codes distinguish at least:

- too_large
- invalid_json
- invalid_root
- unsupported_version
- invalid_field
- invalid_number
- invalid_history
- invalid_unlocks
- decode_failed
- storage_warning

Player-facing messages identify the first useful field path without dumping the save or secret values. Detailed test diagnostics may include the path and code, never the full imported content.

File import and SyncCodeModal render these results inline and through the existing toast system where appropriate. Success wording is emitted only from the success branch.

## Profile-owned storage registry

A pure profile-storage module becomes the single registry for keys owned by a profile. Given a profile ID and its base storage key, it returns all current keys:

- FATE_PROFILE_<id>
- FATE_PROFILE_<id>__backups
- FATE_PROFILE_<id>__exportNag
- FATE_PROFILE_<id>__discord
- FATE_PROFILE_<id>__discordCursor
- fate_features_seen_v1_<id>

Profile deletion calls one deleteProfileStorage helper over this exact registry before committing the updated profile metadata. The helper tolerates an unavailable individual key removal, returns the keys it could not remove, and never targets a prefix or wildcard.

Any future profile-specific localStorage feature must add its key constructor to this registry and its deletion test. Global keys such as profile metadata, What's New seen-state, relay session data, coach/tour preferences, and RuneLite onboarding preferences are not removed.

Deleting the last profile remains forbidden. Deleting the active profile selects an existing profile exactly as today.

## Versioning and compatibility

CURRENT_VERSION is the schema version, not a release number. It increments only if the persisted GameState shape or semantics require a migration.

Compatibility guarantees:

- Current version-1 exports remain accepted.
- Missing optional fields receive current defaults.
- Legacy power and poh unlock names continue to migrate.
- Existing collection-log and task-ID migrations run exactly once and de-duplicate results.
- Internal Arcana save names remain unchanged.
- Unknown future versions are rejected rather than partially loaded.
- Export followed by import is a lossless round trip for all GameState fields.
- Discord webhook configuration and other sidecars never enter the export.

## Testing

Implementation follows test-first development. Required coverage includes:

- An immediate state change followed by getExportData includes the change before the persistence debounce expires.
- Export output equals serializeCurrent and does not depend on localStorage contents or availability.
- Valid current and historical fixtures migrate to the expected complete GameState.
- Every nested field type, range, enum, and size boundary has an accept/reject test.
- NaN, Infinity, negative currencies, impossible levels/tiers, oversized arrays/strings, dangerous keys, and unknown fields are rejected.
- Migrations are idempotent and an export/import round trip is stable.
- File import, sync import, initial load, and backup restore call the same schema entry point.
- Failed imports leave state unchanged, keep the dialog open, and never emit success.
- Successful imports back up the exact current state before replacement and report warnings accurately.
- Deleting a profile removes every registered sidecar and preserves global/other-profile keys.
- The storage registry test fails when a known profile sidecar is not listed.
- Full tests, TypeScript checking, and production build pass.

## Success criteria

- Exporting immediately after any visible state change cannot return the previous state.
- No unvalidated external object reaches the game reducer or migration spread.
- A rejected file, sync code, or backup restore produces an actionable error and zero state mutation.
- Supported old saves continue to load without progress loss.
- Deleting a profile removes all six currently known profile-owned keys and nothing belonging to another profile or global settings.
- Import/export behavior is deterministic, bounded, and covered by pure tests.
