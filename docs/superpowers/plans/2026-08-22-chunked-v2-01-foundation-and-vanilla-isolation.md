# Chunked v2 Foundation and Vanilla Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the exact-mode state, save, migration, action, and concurrency boundaries required by Chunked v2 without changing any Vanilla behavior or serialized Vanilla state.

**Architecture:** `GameState` gains one optional `chunkedV2` envelope that exists only when the exact persisted mode is `chunked`. Pure helpers create and migrate that envelope. Dedicated guarded commands use the existing top-level `runRevision` as compare-and-swap. The legacy shared reducer paths remain intact for Vanilla; current Chunked v2 blocks legacy geography mutations before they can charge or log.

**Tech Stack:** TypeScript 5, React 18 context/reducer, Vitest 4, jsdom, localStorage persistence, existing profile writer lease.

**Spec:** `docs/superpowers/specs/2026-08-22-chunked-v2-fated-frontier-design.md`

## Global Constraints

- Complete this plan before graph, Trial economy, or Loom work.
- Keep `CURRENT_SAVE_VERSION === 4`; `chunkedV2.schemaVersion` is the migration discriminator.
- Accept the resulting down-level trade-off explicitly: the strict parser from baseline `a694c16` must reject a Chunked-v2 v4 document because `chunkedV2` is an unknown root field. This is a safe incompatibility, not backward readability. Never allow an older build to reinterpret that document as legacy Chunked.
- Never add Attack or Strength to shared `getInitialUnlocks()`. Grant them only in exact Chunked initialization and legacy Chunked migration.
- Do not change `getGameMode()` or `resolveModeRules()` fallback semantics in this phase. Reject explicit unknown persisted IDs at the strict save/action boundary instead.
- A missing historical `gameModeId` retains the existing legacy-to-Vanilla normalization. An explicit unsupported value is rejected.
- Exact Vanilla and valid custom saves reject a supplied `chunkedV2` property.
- Reset, profile-switch, and Vanilla/custom import paths delete the `chunkedV2` own property; they must not assign `undefined`. Assert both `Object.hasOwn(state, 'chunkedV2') === false` and exact Vanilla serialized bytes after every cross-mode transition.
- Use only the existing `(GameState.runId, GameState.runRevision)` pair for command CAS. Do not create another revision counter or an unbounded processed-command ledger.
- New Chunked callbacks check exact mode, current envelope, and expected revision before requesting any random draw.
- Generic `UNLOCK` remains byte-for-byte equivalent for non-Chunked-v2 state. It becomes an identity no-op for every table when `gameModeId === 'chunked' && chunkedV2?.schemaVersion === 1`; all current Chunked content and geography spends use dedicated guarded commands.
- Keep the graph implementation out of the eager GameContext bundle. Foundation defines a small runtime interface/registry; Plan 2 installs its lazily imported implementation only for Chunked v2.
- Split command preflight by dependency. The base guard checks exact mode, a current envelope, expected run ID, and expected revision. The graph guard adds matching installed-runtime validation. Existing Trial completion (especially Unbroken) and migration acknowledgement use the base guard; geography, route facts, content spends that refresh a Crossing, and Trial deal/replace use the graph guard. A graph load failure must never disable Unbroken rewards.
- New history kinds and metadata are valid only when the exact persisted mode is `chunked` and a valid current envelope is present. Vanilla/custom histories containing any Chunked kind are rejected, preserving the old save boundary.
- Implement Lumbridge Home Teleport as `canReturnToChunkedRoot(state)` in the mode-scoped rules helper. Do not add an item to `MOBILITY_LIST`, a roll pool, or shared Vanilla reachability.

## File Structure

### New files

- `test-fixtures/vanilla/fresh-v4.json` — exact baseline fresh Vanilla export captured from `a694c16` with a fixed run ID.
- `test-fixtures/vanilla/progressed-v4.json` — exact baseline progressed Vanilla export, including rolls, pity, and rituals.
- `utils/vanillaIsolation.test.ts` — serialized bytes, pools, seeded draws, and reducer corpus goldens.
- `components/VanillaIsolation.dom.test.tsx` — Vanilla tabs/spend UI golden contract.
- `utils/fatedFrontier/model.ts` — shared persisted/domain/action types.
- `utils/fatedFrontier/state.ts` and `.test.ts` — exact-mode initialization and predicates.
- `utils/fatedFrontier/rules.ts` and `.test.ts` — exact-mode Lumbridge Home Teleport/root-return exemption.
- `utils/fatedFrontier/migration.ts` and `.test.ts` — idempotent legacy Chunked migration.
- `utils/fatedFrontier/runtime.ts` and `.test.ts` — lightweight installed-runtime boundary.
- `utils/fatedFrontier/revision.ts` and `.test.ts` — command and durable-takeover comparisons.
- `utils/fatedFrontier/integrity.ts` and `.test.ts` — nested state/history arithmetic.
- `utils/fatedFrontier/counterRecovery.ts` and `.test.ts` — explicit recovery for saturated identity/Trial counters.

### Existing files

- `types.ts` — optional `chunkedV2` state and additive Chunked log kinds.
- `config/gameModes.ts` — strict supported-persisted-mode predicate; existing resolver unchanged.
- `context/GameContext.tsx` — exact Chunked initialization, dedicated action dispatch, legacy geography guards, and Chunked-only takeover check.
- `context/gameReducer.test.ts` — state identity, baseline, guard, and revision tests.
- `context/GameContext.test.tsx` — callbacks, no-RNG-on-rejection, and stale-tab integration tests.
- `utils/saveSchema.ts` and `.test.ts` — conditional nested schema and migration call.
- `utils/gamePersistence.ts` and `.test.ts` — byte-stable Vanilla serialization and Chunked round trip.
- `utils/profileWriterLease.ts`, `hooks/useProfileWriterLease.ts`, and tests — unchanged lease contract; tests prove the new comparison lives above it.
- `components/OnlineSyncDriver.test.tsx` — pins outbound-only relay behavior.

---

### Task 1: Freeze Vanilla behavior before production edits

**Files:**
- Create: `test-fixtures/vanilla/fresh-v4.json`
- Create: `test-fixtures/vanilla/progressed-v4.json`
- Create: `utils/vanillaIsolation.test.ts`
- Create: `components/VanillaIsolation.dom.test.tsx`
- Read: `context/GameContext.tsx:225-291,728-738,796-1044,1315-1324,1689-1729`
- Read: `utils/gameEngine.ts:13-157`
- Read: `components/GachaSection.tsx:211-334`

**Interfaces:**
- Consumes the current `initialState`, `gameReducer`, seeded RNG helper, `serializeGameState`, and Gacha pool helpers.
- Produces immutable regression fixtures used by every later plan.

- [ ] **Step 1: Capture exact main-branch fixtures**

Before changing production code, serialize a fixed fresh state and a fixed progressed state from commit `a694c16b6fccbbf394e09385eef1a14dcd176e58`. Normalize only the test-controlled `runId`; keep property order and all values as emitted. Each JSON fixture must contain `"version":4`, `"gameModeId":"vanilla"`, and no `chunkedV2` key.

- [ ] **Step 2: Add byte, pool, and seeded-draw characterisation tests**

Use an explicit corpus so later code cannot silently shift Vanilla dispatch behavior:

```ts
const VANILLA_ACTION_CORPUS: Action[] = [
  { type: 'ROLL_RESULT', success: false, isOmni: false, source: 'Level 2 Attack', fateGain: 1 },
  { type: 'UNLOCK', table: TableType.SKILLS, item: 'Attack', costType: 'STANDARD' },
  { type: 'RITUAL_CLEAR' },
];

it('keeps the exact v4 Vanilla bytes and has no Chunked envelope', () => {
  const parsed = parseAndMigrateSave(JSON.stringify(freshFixture));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(Object.hasOwn(parsed.state, 'chunkedV2')).toBe(false);
  expect(serializeGameState(parsed.state)).toBe(JSON.stringify(freshFixture));
});
```

Also pin Standard candidate order, Chaos candidate order, fixed-seed outcomes, PRNG purpose strings/call count, pity arithmetic, ritual costs, completion totals, and export/import round trips.

- [ ] **Step 3: Pin Vanilla DOM**

Render a Vanilla provider and assert the pre-feature tab labels/order, Spend category labels/order, absence of `The Loom`, and absence of Threads/Frontier Keys.

- [ ] **Step 4: Run the characterisation tests and confirm they pass before edits**

Run: `npx vitest run utils/vanillaIsolation.test.ts components/VanillaIsolation.dom.test.tsx`

Expected: PASS against the untouched baseline. Record the fixture-producing commit in a test comment.

- [ ] **Step 5: Commit**

```bash
git add test-fixtures/vanilla utils/vanillaIsolation.test.ts components/VanillaIsolation.dom.test.tsx
git commit -m "test: freeze Vanilla behavior before Chunked v2" -m "Captured from a694c16.\n\nCo-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 2: Add exact mode identity and the isolated state envelope

**Files:**
- Create: `utils/fatedFrontier/model.ts`
- Create: `utils/fatedFrontier/state.ts`
- Create: `utils/fatedFrontier/state.test.ts`
- Create: `utils/fatedFrontier/rules.ts`
- Create: `utils/fatedFrontier/rules.test.ts`
- Create: `config/chunkedV2.ts`
- Create: `data/fatedTrialDefinitions.ts`
- Modify: `types.ts:104-125,168-260`
- Modify: `config/gameModes.ts:91-109`
- Modify: `context/GameContext.tsx:225-355,728-738`
- Modify: `context/gameReducer.test.ts`

**Interfaces:**
- Produces `isSupportedPersistedMode()`, `isCurrentChunkedV2()`, `createFreshChunkedV2State()`, `initializeFreshChunkedRun()`, and `canReturnToChunkedRoot()`.
- Later plans extend `FatedTrialObjective`, `FatedCrossingSnapshot`, and the runtime interface without changing the envelope discriminator.

- [ ] **Step 1: Write failing exact-mode tests**

Cover exact Chunked selection, Vanilla selection, valid custom selection, explicit unknown selection, and all new Chunked action tags against Vanilla. Assert `canReturnToChunkedRoot()` is true only for exact current Chunked v2, does not inspect inventory/bank/mobility unlocks, and grants no chunk ownership. Assert `MOBILITY_LIST` and every non-Chunked pool remain unchanged. The wrong-mode assertion must use identity:

```ts
expect(gameReducer(vanilla, chunkedAction)).toBe(vanilla);
```

Exact Chunked initialization must assert HP/Attack/Strength tier 1, unchanged skill levels, three Standard Keys, zero Threads/Frontier Keys, a deterministic First Omen instance, and `chunkedMilestoneClaimed` ignored rather than incremented.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/state.test.ts utils/fatedFrontier/rules.test.ts context/gameReducer.test.ts utils/vanillaIsolation.test.ts`

Expected: FAIL because the envelope and strict predicate do not exist.

- [ ] **Step 3: Add the shared types**

Define this persisted minimum in `utils/fatedFrontier/model.ts`; Plan 3 fills the Trial union with concrete objective variants:

```ts
export const CHUNKED_V2_SCHEMA_VERSION = 1 as const;
export const CHUNKED_V2_RULES_VERSION = 1 as const;
export const CHUNKED_V2_GRAPH_VERSION = 1 as const;

export interface ChunkedV2State {
  schemaVersion: typeof CHUNKED_V2_SCHEMA_VERSION;
  rulesVersion: typeof CHUNKED_V2_RULES_VERSION;
  graphVersion: typeof CHUNKED_V2_GRAPH_VERSION;
  frontierKeys: number;
  threads: number;
  unbrokenMisses: number;
  routePermits: string[];
  voyageCapabilities: string[];
  activeVoyageLoadout: {
    vesselId: string;
    vesselClass: string;
    fittingIds: string[];
    attestedAtRevision: number;
  } | null;
  nextTrialSequence: number;
  activeTrials: FatedTrialInstance[];
  unbroken: { completedCount: number; cycleIndex: number; instanceId: string };
  crossing: FatedCrossingSnapshot | null;
  routeFactsFingerprint: string;
  routeValidationStatus: 'UNVALIDATED' | 'VALIDATED';
  cartographerOffer: ChunkedCartographerOffer | null;
  migration: ChunkedMigrationState;
}

export interface ChunkedCommandBase {
  expectedRunId: string;
  expectedRunRevision: number;
}
```

Define the concrete v1 monster-kill objective, verified-proof, Trial-instance, Crossing-snapshot, and Cartographer-offer shapes used by the envelope. Add `chunkedV2?: ChunkedV2State` to `GameState`. Do not set it in shared `initialState`.

Create the starter constants/templates needed by synchronous initialization in `config/chunkedV2.ts` and `data/fatedTrialDefinitions.ts`: three hand slots, five Threads per Frontier Key, First Omen quantity 25/reward 2, Unbroken quantities `[25, 50, 75, 100]`/reward 1, safe monsters `['Goblin', 'Man', 'Rat']`, Trial chance 10%, failure Fate 1, hard pity 10, and Cartographer cost 40. Reserve the stable root travel-node ID `50,50#lumbridge-surface`; Plan 2's zone artifact must prove that node and Plan 3 binds the templates to its source evidence.

- [ ] **Step 4: Add strict identity without changing shared resolution**

```ts
export const isSupportedPersistedMode = (
  id: unknown,
  customRules: unknown,
): id is 'vanilla' | 'chunked' | 'custom' =>
  id === 'vanilla' || id === 'chunked' || (id === 'custom' && isGameModeRules(customRules));
```

Add `isGameModeRules(value: unknown)` beside this predicate. It requires an own plain record, the five required boolean/finite-number fields within `CUSTOM_RULE_BOUNDS`, and validates optional `startArea`, `chunkGranularity`, and `bankLocks` with the same allowed values as `normalizeCustomMode`; it does not coerce. Keep `getGameMode()` and `resolveModeRules()` unchanged. In `SET_GAME_MODE`, accept only selectable built-ins plus structurally valid custom, and initialize the envelope only for exact `chunked`.

- [ ] **Step 5: Implement deterministic fresh initialization**

Use the existing `runId` and sequence counter for stable Trial IDs; do not call time or UUID APIs. Clone only the nested `skills` map and set Attack/Strength to at least tier 1. In the same exact-Chunked initialization transition, append one bounded `CHUNKED_V2_ACTIVATED` marker with `origin: 'fresh'`. This independent marker makes later envelope stripping detectable before any legacy refund can run. Leave every Vanilla property untouched.

Initialize `activeVoyageLoadout` to `null`, initialize the route-facts fingerprint from the exact persisted facts without importing graph data, and set `routeValidationStatus: 'UNVALIDATED'`. The fingerprint is an invalidation token only; a persisted Crossing is trusted only when status is `VALIDATED` and a matching graph runtime re-derives it.

- [ ] **Step 6: Run tests to verify pass**

Run: `npx vitest run utils/fatedFrontier/state.test.ts utils/fatedFrontier/rules.test.ts context/gameReducer.test.ts utils/vanillaIsolation.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add types.ts config/gameModes.ts config/chunkedV2.ts data/fatedTrialDefinitions.ts context/GameContext.tsx context/gameReducer.test.ts utils/fatedFrontier/model.ts utils/fatedFrontier/state.ts utils/fatedFrontier/state.test.ts utils/fatedFrontier/rules.ts utils/fatedFrontier/rules.test.ts
git commit -m "feat: add isolated Chunked v2 state" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 3: Implement idempotent legacy Chunked migration

**Files:**
- Create: `utils/fatedFrontier/migration.ts`
- Create: `utils/fatedFrontier/migration.test.ts`
- Modify: `utils/saveSchema.ts:1-1057`
- Modify: `utils/saveSchema.test.ts`
- Modify: `utils/gamePersistence.test.ts`
- Modify: `context/GameContext.persistence.test.ts`

**Interfaces:**
- Consumes a normalized global v4 state with exact `gameModeId === 'chunked'` and no current envelope.
- Produces `migrateLegacyChunkedState(state): GameState` and `normalizeChunkedV2State(value): Result<ChunkedV2State>`.
- `migrateLegacyChunkedState()` is pure, deterministic, and returns the same object for an already-current save.

- [ ] **Step 1: Write the migration matrix as failing tests**

Cover all four Attack/Strength ownership combinations; stored `50,50`; duplicate canonical chunks; malformed strings; unknown authored coordinates; valid disconnected coordinates; empty and missing chunk arrays; counter underflow/overflow; repeated migration; imports performed after an earlier profile migrated; Vanilla/custom with an envelope; explicit unknown/removed mode; and the unchanged historical missing-mode case.

Exercise the complete marker/envelope matrix: `CHUNKED_V2_ACTIVATED` with a missing envelope for both origins; current envelope with no activation marker; `origin: 'fresh'` with a legacy migration source/preimage; `origin: 'legacy-v4'` with a fresh migration record; duplicate activation markers; marker/envelope schema-version mismatch; and a valid matching pair for each origin. Reject every mismatch with a stable code (using `MISSING_CHUNKED_V2_ENVELOPE` for the stripped-envelope case); do not recreate the envelope or issue starter refunds.

Assert these exact economic rules:

```ts
expect(result.state.keys).toBe(before.keys + Number(oldAttackTier >= 1) + Number(oldStrengthTier >= 1));
expect(result.state.unlocks.skills.Attack).toBeGreaterThanOrEqual(1);
expect(result.state.unlocks.skills.Strength).toBeGreaterThanOrEqual(1);
expect(result.state.unlocks.chunks).not.toContain('50,50');
expect(result.state.chunkedV2?.migration.chunkKeyRefunds).toBe(0);
```

When `keys` is at `MAX_COUNTER`, store the exact unpaid starter amount in `migration.pendingStarterRefunds`; settle it after later Standard spending instead of saturating away the approved refund.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/migration.test.ts utils/saveSchema.test.ts utils/gamePersistence.test.ts context/GameContext.persistence.test.ts utils/vanillaIsolation.test.ts`

Expected: FAIL because nested normalization and migration do not exist.

- [ ] **Step 3: Implement a recoverable migration record**

Use a compact exact preimage:

```ts
export interface ChunkedMigrationState {
  migrationVersion: 1;
  source: 'fresh' | 'legacy-v4';
  acknowledged: boolean;
  starterKeyRefunds: number;
  pendingStarterRefunds: number;
  chunkKeyRefunds: 0;
  removedStoredStart: boolean;
  quarantinedChunks: Array<{ raw: string; reason: 'malformed' | 'unknown' }>;
  preimage: {
    keys: number;
    attackTier: number;
    strengthTier: number;
    chunks: string[];
    chunkedMilestoneClaimed: number;
  } | null;
}
```

The successful migration appends one bounded `CHUNKED_V2_ACTIVATED` history marker with `origin: 'legacy-v4'` in the same transition. The marker is legal only for exact Chunked with a valid envelope. Fresh initialization writes the same marker with `origin: 'fresh'`; either variant is an independent anti-remigration sentinel if a document is later stripped or corrupted, and the parser rejects every marker/envelope mismatch.

Canonical valid chunks remain in `unlocks.chunks`. Plan 2 derives whether each is active or dormant. Do not let a disconnected legacy chunk become a graph root during migration.

- [ ] **Step 4: Integrate conditional v4 schema handling**

Add `chunkedV2` to the strict root key set, but keep `CURRENT_SAVE_VERSION = 4`. Normalize `gameModeId` before mode-specific fields. Preserve the existing v4 Fate-compensation condition exactly; never key it to a newly changed current version.

Rules:

```ts
if (mode === 'chunked' && chunkedV2 === undefined) migrate;
if (mode === 'chunked' && chunkedV2 !== undefined) validateCurrentEnvelope;
if (mode !== 'chunked' && chunkedV2 !== undefined) reject;
```

Add a baseline-parser compatibility harness copied from commit `a694c16`'s strict root-key behavior. It must accept both frozen Vanilla fixtures, reject a current Chunked-v2 v4 save at the unknown `chunkedV2` field, and prove the new parser returns a specific “newer Chunked schema required” error rather than treating it as legacy.

Test Chunked → reset, Chunked → profile switch, and Chunked → Vanilla/custom import. Each path must delete the own property, reject Chunked-only history in the resulting non-Chunked state, and preserve the exact frozen Vanilla serialization.

- [ ] **Step 5: Run tests to verify pass and byte equality**

Run: `npx vitest run utils/fatedFrontier/migration.test.ts utils/saveSchema.test.ts utils/gamePersistence.test.ts context/GameContext.persistence.test.ts utils/vanillaIsolation.test.ts`

Expected: PASS; both Vanilla fixture strings remain exact.

- [ ] **Step 6: Commit**

```bash
git add utils/fatedFrontier/migration.ts utils/fatedFrontier/migration.test.ts utils/saveSchema.ts utils/saveSchema.test.ts utils/gamePersistence.test.ts context/GameContext.persistence.test.ts
git commit -m "feat: migrate legacy Chunked saves safely" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 4: Establish the dedicated command/runtime boundary

**Files:**
- Create: `utils/fatedFrontier/runtime.ts`
- Create: `utils/fatedFrontier/runtime.test.ts`
- Modify: `utils/fatedFrontier/model.ts`
- Modify: `context/GameContext.tsx:309-355,991-1118,1315-1324,1689-1755`
- Modify: `context/gameReducer.test.ts`
- Modify: `context/GameContext.test.tsx`

**Interfaces:**
- Produces a tiny eager `FatedFrontierRuntime` interface, `installFatedFrontierRuntime()`, `readFatedFrontierRuntime()`, and `clearFatedFrontierRuntimeForTests()`.
- Plan 2 implements and dynamically installs the runtime.
- Produces dedicated action tags whose full reducers land in Plan 3.

- [ ] **Step 1: Write failing guard tests**

For every action tag below, assert wrong mode, absent envelope, stale `expectedRunId`, and stale `expectedRunRevision` return the same object. For graph-dependent actions, also assert absent/mismatched runtime returns the same object. For base-only actions, prove an absent or failed graph runtime does **not** block a valid Unbroken completion or migration acknowledgement. Context tests pass a spy `nextFloat` and assert zero calls on every rejected preflight.

```ts
type ChunkedAction =
  | ({ type: 'CHUNKED_CONTENT_UNLOCK'; table: TableType; item: string; costType: 'STANDARD' | 'OMNI' | 'CHAOS' } & ChunkedCommandBase)
  | ({ type: 'CHUNKED_COMPLETE_TRIAL'; trialId: string; observedTotal: number; preparedRoll: PreparedTrialRoll | null } & ChunkedCommandBase)
  | ({ type: 'CHUNKED_WEAVE_FRONTIER'; draw: number } & ChunkedCommandBase)
  | ({ type: 'CHUNKED_CREATE_CARTOGRAPHER_OFFER'; draws: number[] } & ChunkedCommandBase)
  | ({ type: 'CHUNKED_SELECT_CARTOGRAPHER'; offerId: string; chunk: ChunkKey } & ChunkedCommandBase)
  | ({ type: 'CHUNKED_CHAOS_WEAVE'; draw: number } & ChunkedCommandBase)
  | ({ type: 'CHUNKED_REFRESH_ROUTE_STATE' } & ChunkedCommandBase)
  | ({ type: 'CHUNKED_ACK_MIGRATION' } & ChunkedCommandBase)
  | ({ type: 'CHUNKED_RECOVER_COUNTERS' } & ChunkedCommandBase);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/runtime.test.ts context/gameReducer.test.ts context/GameContext.test.tsx utils/vanillaIsolation.test.ts`

Expected: FAIL because the runtime and actions do not exist.

- [ ] **Step 3: Implement the minimal runtime registry**

```ts
export interface FatedFrontierRuntime {
  graphVersion: 1;
  authorizeContentUnlock(state: GameState, table: TableType, item: string): ChunkedDecision;
  authorizeChunkUnlock(state: GameState, source: ChunkUnlockSource, chunk: ChunkKey): ChunkedDecision;
  deriveFrontier(state: GameState): readonly ChunkKey[];
}
```

The registry holds one immutable installed runtime module, rejects version mismatch, and exposes an explicit test reset. It contains no graph data or side effects at import time.

- [ ] **Step 4: Add exact-mode action gating and legacy backstops**

Add the action union and the two explicit preflights:

```ts
const canApplyChunkedBaseCommand = (
  state: GameState,
  expectedRunId: string,
  expectedRunRevision: number,
): boolean =>
  state.gameModeId === 'chunked' &&
  state.chunkedV2?.schemaVersion === CHUNKED_V2_SCHEMA_VERSION &&
  state.runId === expectedRunId &&
  state.runRevision === expectedRunRevision;

const canApplyChunkedGraphCommand = (
  state: GameState,
  command: ChunkedCommandBase,
): boolean =>
  canApplyChunkedBaseCommand(state, command.expectedRunId, command.expectedRunRevision) &&
  readFatedFrontierRuntime()?.graphVersion === state.chunkedV2!.graphVersion;
```

Use a named action-to-guard table in tests: `CHUNKED_COMPLETE_TRIAL`, `CHUNKED_ACK_MIGRATION`, and `CHUNKED_RECOVER_COUNTERS` use the base guard; content/geography, Cartographer, Chaos Frontier, Trial deal/replace, route permits, Voyage loadouts, and `CHUNKED_REFRESH_ROUTE_STATE` use the graph guard. Route refresh takes no derived payload: the reducer reads the installed runtime, derives from commit-time state, consumes no RNG/currency, returns identity when the validated fingerprint/Crossing are already equal, and increments revision exactly once only when persisted route state changes. At this phase, valid commands may remain guarded no-ops until their task lands, but all invalid paths must be exact identity no-ops. In generic `UNLOCK` and legacy `RITUAL_CARTOGRAPHER`, return `state` for every current Chunked v2 attempt before deduction/logging; leave every non-Chunked branch textually unchanged.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run utils/fatedFrontier/runtime.test.ts context/gameReducer.test.ts context/GameContext.test.tsx utils/vanillaIsolation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/fatedFrontier/model.ts utils/fatedFrontier/runtime.ts utils/fatedFrontier/runtime.test.ts context/GameContext.tsx context/gameReducer.test.ts context/GameContext.test.tsx
git commit -m "feat: establish guarded Chunked commands" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 5: Reject stale Chunked tab takeovers without changing Vanilla

**Files:**
- Create: `utils/fatedFrontier/revision.ts`
- Create: `utils/fatedFrontier/revision.test.ts`
- Modify: `context/GameContext.tsx:1533-1591,1647-1664`
- Modify: `context/GameContext.test.tsx`
- Test: `utils/profileWriterLease.test.ts`
- Test: `hooks/useProfileWriterLease.test.tsx`
- Test: `components/OnlineSyncDriver.test.tsx`

**Interfaces:**
- Consumes the last persisted snapshot string, current durable snapshot string, local state, and exact mode.
- Produces `canTakeOverChunkedWriter(input): { ok: true } | { ok: false; reason: 'durable-advanced' | 'run-mismatch' | 'revision-mismatch' }`.
- Existing writer lease semantics remain unchanged.

- [ ] **Step 1: Write the stale-writer integration tests**

Simulate owner A and blocked tab B from one baseline. Advance and persist A. Give B divergent pending state, then request takeover. Assert B does not flush, shows/reports reload-required state, and cannot spend the same Frontier Key. Add a same-revision/different-bytes case so a corrupt or non-revisioned change also fails.

Add a Vanilla control asserting the existing takeover/flush behavior is unchanged. Add an OnlineSync test proving the relay publishes `runRevision` but has no inbound state-commit path.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/revision.test.ts context/GameContext.test.tsx utils/profileWriterLease.test.ts hooks/useProfileWriterLease.test.tsx components/OnlineSyncDriver.test.tsx utils/vanillaIsolation.test.ts`

Expected: FAIL on the Chunked stale-takeover cases.

- [ ] **Step 3: Implement double-read takeover protection**

For current Chunked v2 only, compare durable JSON to `persistedSnapshotRef.current` immediately before claiming and again after lease arbitration. Also parse and compare `runId`/`runRevision`. If either read differs, release/refuse ownership, keep durable data, clear no user data, and expose the existing reload-latest-save route. Never flush B's pending snapshot in that case.

- [ ] **Step 4: Run tests to verify pass**

Run the focused command from Step 2.

Expected: PASS, including unchanged Vanilla takeover behavior.

- [ ] **Step 5: Commit**

```bash
git add utils/fatedFrontier/revision.ts utils/fatedFrontier/revision.test.ts context/GameContext.tsx context/GameContext.test.tsx components/OnlineSyncDriver.test.tsx
git commit -m "fix: reject stale Chunked takeover writes" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 6: Add bounded-counter recovery, integrity checks, and the foundation gate

**Files:**
- Create: `utils/fatedFrontier/integrity.ts`
- Create: `utils/fatedFrontier/integrity.test.ts`
- Create: `utils/fatedFrontier/counterRecovery.ts`
- Create: `utils/fatedFrontier/counterRecovery.test.ts`
- Modify: `utils/fatedFrontier/model.ts`
- Modify: `context/GameContext.tsx`
- Modify: `context/gameReducer.test.ts`
- Modify: `utils/integrity.ts`
- Modify: `utils/integrity.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `auditChunkedV2State(state): ChunkedIntegrityIssue[]`.
- Produces `needsChunkedCounterRecovery()` and guarded `CHUNKED_RECOVER_COUNTERS`.
- Existing `auditRunIntegrity()` adds Chunked issues only for exact Chunked v2 and returns its pre-feature result for all other states.
- Introduces `npm run chunked:verify`; Plan 2 extends its test set.

- [ ] **Step 1: Write failing integrity tests**

Cover schema/rules/graph version coherence, bounded non-negative integer counters, canonical unique ownership, implicit-root exclusion, migration refund arithmetic, pending refund arithmetic, Trial ID uniqueness, active Cartographer shape, and the invariant that rejected commands add no history/revision. A valid incomplete state may not have `runRevision`, `nextTrialSequence`, or `unbroken.completedCount` at its maximum incrementable value; classify such an import as `COUNTER_RECOVERY_REQUIRED`, not as a valid liveness fixture.

Add focused recovery tests at each boundary and all three together. At `runRevision === MAX_COUNTER`, or when an action would increment a saturated Trial identity counter, every ordinary command is an identity no-op that exposes recovery-required status. Put the revision-cap check at the top-level exact-Chunked-v2 `gameReducer` wrapper **before** `rawReducer`, exempting only `CHUNKED_RECOVER_COUNTERS`; dedicated-command preflights alone are insufficient because shared `ROLL_RESULT`, detected-progress acceptance, rituals, and other existing actions also mutate state. Test representative shared and dedicated actions at the cap, including zero RNG/history/timestamp change, and retain exact pre-feature behavior for the same Vanilla actions. `CHUNKED_RECOVER_COUNTERS` uses the base guard, consumes no currency/gameplay RNG/reward, preserves all ownership/progress/baselines, starts a fresh run segment through the existing run-ID factory, resets revision/sequence/completion identity counters, rekeys every active/Unbroken instance with a persisted old→new mapping, and records one bounded recovery marker. Replaying the old command tuple after recovery is rejected by `expectedRunId`.

The current outer `gameReducer` increments `state.runRevision + 1` after any state change, so add an explicit exact-action revision policy: ordinary transitions retain that wrapper unchanged; a successful `CHUNKED_RECOVER_COUNTERS` result whose run ID changed and revision is reset to zero returns through a `new-run-segment` branch that bypasses the ordinary increment. Test recovery at `runRevision === MAX_COUNTER`, verify the returned revision is exactly zero rather than overflowed/overwritten, and assert no other action—including any Vanilla action—can select this policy.

Use a Vanilla fixture control:

```ts
expect(auditRunIntegrity(vanillaFixture)).toEqual(VANILLA_BASELINE_AUDIT);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/integrity.test.ts utils/integrity.test.ts utils/vanillaIsolation.test.ts`

Expected: FAIL because the nested audit does not exist.

- [ ] **Step 3: Implement mode-scoped audit composition**

Do not teach the existing Vanilla replay calculator to infer Threads or Frontier Keys. Call the separate nested audit only when the exact Chunked discriminator is present, then concatenate stable issue codes.

Implement counter recovery as an explicit local repair state, not saturation or silent clamping. Save parsing returns a recoverable result that the exact-Chunked UI can action; Vanilla/custom never see the path. This keeps saturated incomplete data outside the liveness theorem while providing a finite, non-admin recovery that cannot mint rewards.

- [ ] **Step 4: Add the focused verification script**

```text
"chunked:verify": "vitest run utils/fatedFrontier/**/*.test.ts utils/vanillaIsolation.test.ts"
```

Plan 2 will add target/graph/proof tests to this command without changing its name.

- [ ] **Step 5: Run the foundation verification**

Run:

```bash
npm run chunked:verify
npx vitest run
npx tsc --noEmit
npx vite build
```

Expected: all pass. Inspect the build report and confirm graph data has not entered the eager bundle.

- [ ] **Step 6: Commit**

```bash
git add utils/fatedFrontier/counterRecovery.ts utils/fatedFrontier/counterRecovery.test.ts utils/fatedFrontier/integrity.ts utils/fatedFrontier/integrity.test.ts utils/fatedFrontier/model.ts utils/integrity.ts utils/integrity.test.ts context/GameContext.tsx context/gameReducer.test.ts package.json
git commit -m "test: enforce Chunked foundation integrity" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```
