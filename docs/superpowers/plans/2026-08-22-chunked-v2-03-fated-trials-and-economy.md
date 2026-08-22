# Chunked v2 Fated Trials and Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the renewable Fate-Locked progression loop—Fated Trials, Threads, bounded Frontier Keys, bounded Standard prerequisite acquisition, and atomic normal/Cartographer/Chaos weaving—on top of the certified graph.

**Architecture:** Pure Trial generation consumes exact active **zone nodes** and a monster-to-zone evidence catalog. The synchronous reducer accepts only prepared draws and the expected run identity/revision. Each completion atomically validates an active instance, awards Threads, converts overflow, applies at most one Key attempt, updates the unspendable fallback-pity counter, records bounded evidence metadata, and refills open slots only when graph data is available. Content and geography spends are separate guarded commands; all deductions occur only after a distinct unlock has been authorized.

**Tech Stack:** TypeScript 5, React 18 context/reducer, Vitest 4, existing seeded RNG and Key-roll engine, existing chunk-content service.

**Spec:** `docs/superpowers/specs/2026-08-22-chunked-v2-fated-frontier-design.md`

**Execution prerequisite:** Do not begin this plan while the suite is `BLOCKED ON ROUTE EVIDENCE`. Plan 2 must first commit the pinned topology inputs, all gateway/Sailing certificates, the complete 623-target node proof, and a passing verifier.

## Global Constraints

- These initial values are explicit provisional configuration, not scattered literals: three ordinary Trial slots; five Threads per Frontier Key; First Omen = 25 verified start-safe kills and two Threads; Unbroken cycle = 25/50/75/100 kills and one Thread; Trial Key chance = 10%; Trial failure Fate = 1; Unbroken hard pity = ten misses; Cartographer = 40 Fate.
- `Rat`, `Goblin`, and `Man` are the v1 start-safe targets, verified in `public/chunk-content.json` root entry `12850` (`50,50`). Do not add Duck/Woman/Giant spider to the baseline without a separate proof change.
- The normal hand has three slots. The Unbroken Thread is a fourth, independently derived fallback and is never removed, hidden, randomized, cooled down, or made conditional on ordinary candidates.
- The initial v1 ordinary catalog uses only monster-kill definitions with exact active-zone proof. The shipped baseline definitions are the root-zone Rat/Goblin/Man objectives; a whole-chunk monster record is never enough when the chunk contains multiple walkable zones. This intentionally avoids double-paying activities that already have existing Key rolls. Future quest/diary/level definitions remain rejected until they have an atomic event adapter and a test proving no second roll.
- Trial baseline/proof/reward fields are persisted at deal time. No retroactive completion and no reroll on reload.
- Every no-underlying-roll Trial performs exactly one 10% Fated attempt. A miss awards one ordinary Fate. A success follows existing Chunked Standard/Omni award semantics.
- `unbrokenMisses` increments only when the prepared Unbroken result awards zero Standard Keys, including an Omni-only result. It resets whenever that prepared result awards at least one Standard Key. When the count would reach ten, award exactly one hard-pity Standard Key and reset; if the same raw miss triggers ordinary Fate pity and already awards a Standard Key, do not add a second hard-pity Key. Ordinary-hand Trial outcomes do not touch this counter, and the hard-pity award does not subtract ordinary Fate.
- Threads never reset or decrease. Conversion is `floor(total / 5)` Frontier Keys with `total % 5` carried.
- All random values come from `GameContext.nextFloat()` after preflight. Utilities accept prepared unit-interval draws.
- For exact Chunked v2, generic `UNLOCK` and legacy Cartographer remain blocked. Every Standard, Omni, Chaos-content, normal weave, Cartographer, and Chaos-frontier spend uses a dedicated command.
- Permanent Voyage capability and current fitted-state attestations are distinct. A live Voyage requires one compatible active vessel/loadout containing all required fittings; attestations from different vessels or incompatible slots can never accumulate. When it is absent, its proven source-side reacquisition chain remains an attainable Crossing.
- The existing Unbroken instance and migration acknowledgement use the base command guard and remain functional during graph loading or `route-data-error`. On such a completion, all rewards/pity commit normally and any ordinary hand slot simply remains open until a matching runtime can refill it.
- Vanilla keeps its existing `ROLL_RESULT`, `UNLOCK`, Chaos flattening/order, milestone behavior, RNG purposes, call counts, and reveal timing.

## File Structure

### Configuration and Trial domain

- `config/chunkedV2.ts` and `.test.ts` — validate and consume the centralized provisional v1 constants created in Plan 1.
- `data/fatedTrialDefinitions.ts` and `.test.ts` — validate and consume the Plan 1 First Omen/Unbroken templates and exact start proof.
- `utils/fatedFrontier/trialCandidates.ts` and `.test.ts` — active-zone-certified monster candidates only.
- `utils/fatedFrontier/trials.ts` and `.test.ts` — dealing, baseline, completion, refill, invalid replacement.
- `utils/fatedFrontier/trialRewards.ts` and `.test.ts` — Threads, Frontier conversion, prepared Key outcomes, ordinary Fate, and hard pity.
- `utils/fatedFrontier/eventMetrics.ts` and `.test.ts` — bounded route/faucet metadata recorded at action time.

### Guarded reducer and spending

- `utils/fatedFrontier/contentUnlocks.ts` and `.test.ts` — finite no-duplicate content tables and internal costs.
- `utils/fatedFrontier/cartographer.ts` and `.test.ts` — persisted distinct offers/fingerprints.
- `utils/fatedFrontier/chaosPool.ts` and `.test.ts` — one synthetic Frontier ticket.
- `utils/fatedFrontier/reducer.property.test.ts` — adversarial legal action sequences.
- `context/GameContext.tsx` and tests — callbacks, prepared draws, actions, atomic state transitions.
- `utils/gameEngine.ts` and tests — additive exact-Chunked pool helpers; existing Vanilla helpers unchanged.
- `components/GachaSection.tsx` and tests — exact-Chunked guarded spending/reveal branch.
- `components/VoidAltar.tsx` and new `components/VoidAltar.dom.test.tsx` — persisted Cartographer branch.
- `config/economy.ts` and consistency test — retire old Chunked milestone only; leave all other modes unchanged.

---

### Task 1: Configure and prove the starter Trial definitions

**Files:**
- Modify: `config/chunkedV2.ts`
- Create: `config/chunkedV2.test.ts`
- Modify: `data/fatedTrialDefinitions.ts`
- Create: `data/fatedTrialDefinitions.test.ts`
- Modify: `utils/fatedFrontier/model.ts`
- Test: `services/ChunkContentService.test.ts`

**Interfaces:**
- Produces validated economy constants and concrete `FatedTrialObjective`/definition types.
- Static starter definitions are synchronous and do not depend on lazy content loading.

- [ ] **Step 1: Write failing constant and source-proof tests**

Assert positive safe integers, chance bounds, unique definition IDs, four bounded Unbroken quantities, and exact root content. Load the transformed chunk source and prove `Rat`, `Goblin`, and `Man` all exist at `50,50` with no task/quest/equipment/bank requirement. Bind each record to `50,50#lumbridge-surface` through a checked-in monster-to-zone evidence row whose tile/source witness is validated against Plan 2's zone artifact; a coordinate-only content row is not enough.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run config/chunkedV2.test.ts data/fatedTrialDefinitions.test.ts services/ChunkContentService.test.ts`

Expected: FAIL on the newly required transformed-source/active-zone proof until the Plan 1 templates are bound to the certified graph/content evidence; the centralized numeric constants themselves remain unchanged.

- [ ] **Step 3: Validate the exact centralized configuration**

```ts
export const CHUNKED_V2_ECONOMY = Object.freeze({
  trialHandSize: 3,
  threadsPerFrontierKey: 5,
  firstOmenQuantity: 25,
  firstOmenThreads: 2,
  unbrokenQuantities: [25, 50, 75, 100] as const,
  unbrokenThreads: 1,
  trialKeyChancePercent: 10,
  trialFailureFate: 1,
  unbrokenHardPityMisses: 10,
  cartographerFateCost: 40,
});

export const START_SAFE_MONSTERS = ['Goblin', 'Man', 'Rat'] as const;
```

- [ ] **Step 4: Pin the concrete objective and proof types created in Plan 1**

```ts
export type FatedTrialObjective = {
  type: 'KILL_MONSTER';
  monsters: readonly string[];
  quantity: number;
};

export interface VerifiedTrialProof {
  status: 'VERIFIED';
  sourceVersion: number;
  zoneNodeIds: string[];
  chunkIds: ChunkKey[];
  evidenceIds: string[];
}
```

Each ordinary definition includes exactly one `zoneNodeId` (or an explicit independently verified node set) plus the evidence IDs proving that the source monster occurs in those nodes. Reject every record that can only be located to a coordinate, including records in a multi-zone chunk whose exact zone is unknown. First Omen targets all three safe monsters with quantity 25 and two Threads. Each derived Unbroken instance uses the same set, the current bounded-cycle quantity, one Thread, and a stable ID derived from `runId` plus `completedCount`.

- [ ] **Step 5: Run tests to verify pass**

Run the command from Step 2; expect PASS.

- [ ] **Step 6: Commit**

```bash
git add config/chunkedV2.ts config/chunkedV2.test.ts data/fatedTrialDefinitions.ts data/fatedTrialDefinitions.test.ts utils/fatedFrontier/model.ts services/ChunkContentService.test.ts
git commit -m "feat: define the first Fated Trials" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 2: Generate and persist verified ordinary Trial hands

**Files:**
- Create: `utils/fatedFrontier/trialCandidates.ts`
- Create: `utils/fatedFrontier/trialCandidates.test.ts`
- Create: `utils/fatedFrontier/trials.ts`
- Create: `utils/fatedFrontier/trials.test.ts`
- Modify: `utils/fatedFrontier/runtime.ts`
- Modify: `utils/fatedFrontier/loadRuntime.ts`
- Modify: `context/GameContext.tsx`
- Modify: `context/GameContext.test.tsx`

**Interfaces:**
- Produces `buildVerifiedTrialCandidates()`, `fillTrialHand()`, `replaceInvalidTrial()`, and `deriveUnbrokenTrial()`.
- Candidate arrays are sorted by stable definition ID before a prepared draw selects an index.

- [ ] **Step 1: Write failing candidate/deal tests**

Cover active versus dormant chunks, an active zone versus a sealed zone in the same owned chunk, coordinate-only monster data in a multi-zone chunk, a correctly mapped monster in its active zone, requirement-bearing monster records, unknown proof, duplicate definitions, existing active definitions, fewer than three candidates, First Omen preservation, reload persistence, graph refresh, and invalid replacement. Assert no named-area foothold or whole-chunk content helper is used as proof.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/trialCandidates.test.ts utils/fatedFrontier/trials.test.ts context/GameContext.test.tsx`

Expected: FAIL because candidate generation/dealing do not exist.

- [ ] **Step 3: Implement exact active-zone candidates**

Read candidates from the checked-in verified Trial catalog and retain only entries whose independently evidenced `zoneNodeId` is in `ReachabilitySnapshot.activeNodeIds`. Reject a record with unknown/task/quest/item requirements, coordinate-only provenance, or no zone witness. A multi-zone chunk is always rejected unless the monster's exact zone is certified; do not infer that an active zone contains every coordinate-level monster record. Create stable definitions such as `kill:Goblin:50,50:lumbridge-surface:v1`; snapshot exact node/chunk/evidence IDs into the persisted instance. Do not turn every monster count in an active chunk into a candidate.

- [ ] **Step 4: Implement prepared deterministic dealing**

The context preflights exact mode/runtime/open slots, then requests one draw per slot with `nextFloat('fated-trial-deal', slotIndex)`. The reducer rebuilds the sorted candidate set at commit time, rejects a stale revision, maps each prepared draw to one unused definition, stores its current progress baseline, and increments `nextTrialSequence` safely.

Opening The Loom consumes no draw. A persisted hand is reused after reload. Unlocking a chunk fills only open slots; it never removes a still-valid partial Trial.

- [ ] **Step 5: Keep Unbroken outside the hand**

`deriveUnbrokenTrial(state)` is total for every incomplete valid Chunked v2 state and independent of graph/content runtime. At completion it advances `(cycleIndex + 1) % 4` and `completedCount + 1`, producing a new stable instance ID. The context/reducer base guard explicitly permits this completion during `LOADING` and `ROUTE_DATA_ERROR`; all rewards commit, and graph-dependent ordinary-hand refill is skipped until a matching runtime is installed.

- [ ] **Step 6: Run tests to verify pass**

Run the command from Step 2; expect PASS and assert `nextFloat` is never called for Vanilla, stale state, a full hand, or a hand reopen.

- [ ] **Step 7: Commit**

```bash
git add utils/fatedFrontier/trialCandidates.ts utils/fatedFrontier/trialCandidates.test.ts utils/fatedFrontier/trials.ts utils/fatedFrontier/trials.test.ts utils/fatedFrontier/runtime.ts utils/fatedFrontier/loadRuntime.ts context/GameContext.tsx context/GameContext.test.tsx
git commit -m "feat: deal reachable Fated Trials" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 3: Complete Trials atomically with Threads and bounded hard pity

**Files:**
- Create: `utils/fatedFrontier/trialRewards.ts`
- Create: `utils/fatedFrontier/trialRewards.test.ts`
- Create: `utils/fatedFrontier/eventMetrics.ts`
- Create: `utils/fatedFrontier/eventMetrics.test.ts`
- Modify: `context/GameContext.tsx:309-355,366-501,796-990,1315-1324,1689-1729`
- Modify: `context/gameReducer.test.ts`
- Modify: `types.ts`
- Modify: `utils/saveSchema.ts`
- Modify: `utils/saveSchema.test.ts`

**Interfaces:**
- Produces `prepareFatedTrialRoll()` and `applyFatedTrialCompletion()`.
- Extends `LogEntry.type` with `FATED_TRIAL`, `THREAD_WEAVE`, and the migration/recovery markers introduced by Plan 1. The save history whitelist accepts their bounded metadata only when `gameModeId === 'chunked'` and a valid current envelope is present; the same entries make Vanilla/custom saves invalid.

- [ ] **Step 1: Characterize the existing roll reducer before extraction**

Add normal miss, normal success, Omni success, ordinary pity, Greed, Luck, and Fate-reset cases around the existing `ROLL_RESULT` branch. Run `npx vitest run context/gameReducer.test.ts utils/vanillaIsolation.test.ts` and confirm PASS before refactoring.

- [ ] **Step 2: Write failing atomic completion tests**

Cover wrong mode, stale run ID/revision, missing/old instance ID, below-target observed total, invalid proof, double submit, First Omen, every Unbroken cycle step, Thread overflow, multiple Frontier awards, 9 zero-Standard outcomes, the 10th all-miss hard pity, natural Standard success reset, Omni-only outcomes, ordinary Fate spent between every zero-Standard outcome, graph loading/error, and counter-recovery boundaries. Assert one ordinary successful action increments `runRevision` once and a rejected action is identity.

Pin the collision case: start with `unbrokenMisses = 9` and ordinary Fate exactly one miss below its own pity award; prepare a raw miss that ordinary pity converts to one Standard Key. The transition resets `unbrokenMisses` and awards exactly that one Standard Key—never an additional Unbroken hard-pity Key. Generate arbitrary ten-outcome streams of raw success, raw miss, ordinary-pity conversion, and Omni-only upgrade; every stream must contain a spendable Standard Key by the tenth Unbroken completion.

- [ ] **Step 3: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/trialRewards.test.ts context/gameReducer.test.ts utils/vanillaIsolation.test.ts`

Expected: FAIL because the reward transaction does not exist.

- [ ] **Step 4: Extract the existing prepared-roll state transition without semantic edits**

Move the body of `ROLL_RESULT` into a pure `applyPreparedRollResult(state, payload)` helper and make the existing case delegate to it. Run the characterisation/Vanilla tests immediately; their output, history, Fate, and Key arithmetic must remain exact.

- [ ] **Step 5: Prepare Trial draws only after preflight**

For a completable no-underlying-roll instance, call `nextFloat('fated-trial')`; call `nextFloat('fated-trial-omni')` only if the success path needs the existing Omni-upgrade draw. Build a `PreparedTrialRoll` containing the resolved outcome, not a callable RNG. Stale/wrong-mode/incomplete actions consume zero draws.

- [ ] **Step 6: Apply one atomic reward transition**

In order: revalidate instance/proof/objective; apply exactly one prepared Key result; inspect the **actual Standard-Key delta** from that result; add configured Threads; convert `floor(total / 5)` to Frontier Keys; reset `unbrokenMisses` when the Standard delta is positive or otherwise increment it; only if the zero-Standard count reaches ten, award one additional Standard without subtracting ordinary Fate and record `pityKind: 'unbroken-hard'`; replace/remove the instance; refill only with supplied prepared deal draws when a matching runtime is installed; append bounded history; return the new state. An Omni-only result has zero Standard delta and therefore advances the bounded Standard fallback.

For runtime loading/error, validate Unbroken from its persisted start-safe proof using the base guard, commit the same Thread/Key/Fate transaction, and leave ordinary slots open. Do not read or refresh the graph, and do not reject the reward because a hand refill cannot be derived.

Record bounded action-time evidence metadata needed later: a stable route-state code before/after, stable blocker code when present, coarse elapsed bucket, `verifiedFaucetCountAfter` on each geography unlock, unlock source, Trial kind, Threads awarded, actual Standard delta, and pity kind. Use fixed enums/safe integers only; no account/run ID, note, exact timestamp, or arbitrary diagnostic string enters this metadata. Route-state transitions caused by another action are embedded in that action's single history entry, not appended through a second dispatch.

- [ ] **Step 7: Run tests to verify pass**

Run: `npx vitest run utils/fatedFrontier/trialRewards.test.ts context/gameReducer.test.ts utils/saveSchema.test.ts utils/vanillaIsolation.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add utils/fatedFrontier/trialRewards.ts utils/fatedFrontier/trialRewards.test.ts utils/fatedFrontier/eventMetrics.ts utils/fatedFrontier/eventMetrics.test.ts context/GameContext.tsx context/gameReducer.test.ts types.ts utils/saveSchema.ts utils/saveSchema.test.ts
git commit -m "feat: weave Threads through bounded Fated Trials" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 4: Guard every Chunked content spend and retire the finite bootstrap

**Files:**
- Create: `utils/fatedFrontier/contentUnlocks.ts`
- Create: `utils/fatedFrontier/contentUnlocks.test.ts`
- Modify: `utils/gameEngine.ts`
- Modify: `utils/gameEngine.test.ts`
- Modify: `context/GameContext.tsx:991-1044,1184-1203,1727-1735`
- Modify: `context/gameReducer.test.ts`
- Modify: `components/GachaSection.tsx:211-243,307-334`
- Modify: `components/GachaSection.test.tsx`
- Modify: `components/Dashboard.tsx:482-516`
- Modify: `components/Dashboard.activity-card.test.tsx`
- Modify: `config/economy.ts:100-106`
- Modify: `config/economy.consistency.test.ts`

**Interfaces:**
- Produces `getChunkedContentPool()`, `authorizeChunkedContentUnlock()`, and `CHUNKED_CONTENT_UNLOCK` for Standard, Omni, and Chaos content costs.
- The existing generic pool and unlock functions remain unchanged for non-Chunked callers.

- [ ] **Step 1: Write failing finite-spend tests**

Cover every table, tier cap, duplicate array item, unknown item, `CHUNKS`, `REGIONS`, insufficient currency, stale run identity/revision, fixed cost of one, negative/oversized payload attempts, pending starter-refund settlement, and all three `STANDARD | OMNI | CHAOS` source types. A Chaos request must carry the prepared discriminated content ticket from the current guarded Chaos pool; merely writing `costType: 'CHAOS'` cannot authorize an arbitrary item. A successful spend must add one permanent unlock then deduct exactly one matching currency; every rejected spend must be identity/no history.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/contentUnlocks.test.ts utils/gameEngine.test.ts context/gameReducer.test.ts components/GachaSection.test.tsx utils/vanillaIsolation.test.ts`

Expected: FAIL because the guarded path does not exist.

- [ ] **Step 3: Implement the finite exact-Chunked pools**

Reuse existing table definitions and validity checks, but exclude `CHUNKS` and `REGIONS`, stable-sort candidates exactly as the current table exposes them, and require the chosen result to change the commit-time state. Costs come from `costType`, never a numeric action payload. For Chaos, revalidate the prepared ticket's pool fingerprint and item at commit time before deducting one Chaos Key. If a Standard spend creates counter space and `pendingStarterRefunds > 0`, settle one pending refund in the same transaction.

- [ ] **Step 4: Switch exact Chunked UI/callbacks before reveal**

Only in current Chunked v2, remove the Chunks Standard card, choose from the guarded pool using the existing `gacha` purpose, commit the dedicated action, and show the reveal only after the commit succeeds. Route `Dashboard` Omni confirmations for non-geography content through the same guarded action; regions/chunks remain unavailable. Standard/Omni/Chaos content all use the guarded reducer. Preserve the original non-Chunked code paths and call order verbatim.

- [ ] **Step 5: Retire the old milestone only for current Chunked v2**

Remove/skip `CHUNKED_MILESTONE_INTERVAL` awards when the current envelope exists. Preserve old behavior for non-v2 test fixtures during migration loading and preserve Xtreme/Vanilla code exactly. Previously awarded keys remain in state.

- [ ] **Step 6: Run tests to verify pass**

Run the command from Step 2 plus `npx vitest run components/Dashboard.activity-card.test.tsx`; expect PASS.

- [ ] **Step 7: Commit**

```bash
git add utils/fatedFrontier/contentUnlocks.ts utils/fatedFrontier/contentUnlocks.test.ts utils/gameEngine.ts utils/gameEngine.test.ts context/GameContext.tsx context/gameReducer.test.ts components/GachaSection.tsx components/GachaSection.test.tsx components/Dashboard.tsx components/Dashboard.activity-card.test.tsx config/economy.ts config/economy.consistency.test.ts
git commit -m "feat: guard Chunked content spending" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 5: Implement normal Frontier weaving and route-permit attainment

**Files:**
- Modify: `utils/fatedFrontier/authorization.ts`
- Modify: `utils/fatedFrontier/authorization.test.ts`
- Modify: `utils/fatedFrontier/model.ts`
- Modify: `context/GameContext.tsx`
- Modify: `context/gameReducer.test.ts`
- Modify: `utils/fatedFrontier/integrity.ts`
- Modify: `utils/fatedFrontier/integrity.test.ts`

**Interfaces:**
- Produces `weaveFrontier(draw, state, runtime)`, `attestRoutePermit()`, `attestVoyageCapability()`, `replaceActiveVoyageLoadout()`, `clearActiveVoyageLoadout()`, and centralized `finalizeChunkedRouteFacts()` reducer transitions.
- Route/capability attestations are accepted only when the active Crossing requires them and its source-side certificate facts currently pass.

- [ ] **Step 1: Write failing weave/attestation tests**

Cover zero keys, empty frontier, blocked Crossing, draw boundaries `0` and `1 - Number.EPSILON`, stale run identity/revision, duplicate/owned target, dormant source, one-way edge, exactly one successful addition/debit, and reload/no-reroll. For permit/capability/loadout, cover unrelated ID, missing manual route-stage confirmation, unmet source certificate, completed-quest alternate, duplicate, destination-dependent certificate, absent fitting blocking a Voyage, valid capability plus compatible loadout, two different vessels whose fittings must not combine, mutually exclusive slots, vessel-class mismatch, atomic loadout replacement, explicit loadout clear, and same-transition Crossing refresh.

Exercise every `ChunkedRequirementFacts` source: skill level, unlocked method tier, quest completion, content unlock, route permit, permanent Voyage capability, active loadout, fitting clear, owned chunk, migration/import, and runtime installation. Assert the facts fingerprint and persisted Crossing change in the **same** reducer transition that changes the fact; no follow-up dispatch or second revision increment is permitted.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/authorization.test.ts context/gameReducer.test.ts utils/fatedFrontier/integrity.test.ts`

Expected: FAIL because reducers are not implemented.

- [ ] **Step 3: Implement prepared normal weaving**

The context checks a Frontier Key and non-empty runtime frontier, then calls `nextFloat('fated-frontier')`. The reducer recomputes the sorted commit-time frontier, maps the supplied draw, authorizes the chosen node, appends the chunk, and only then deducts one Frontier Key. It records edge/kind/source plus `verifiedFaucetCountAfter` and route-transition metadata, then refills open Trial slots from separately prepared deal draws.

- [ ] **Step 4: Implement source-certified permanent attestations**

Add `CHUNKED_ATTEST_ROUTE_PERMIT`, `CHUNKED_ATTEST_VOYAGE_CAPABILITY`, `CHUNKED_REPLACE_VOYAGE_LOADOUT`, and `CHUNKED_CLEAR_VOYAGE_LOADOUT`. The action contains the manifest ID, expected run ID/revision, and for a route-stage permit the literal `confirmed: true` produced by the labelled player confirmation; it cannot supply requirements or raw quest-step values. The reducer finds the active Crossing certificate, recomputes source-side feasibility, and records the stable permit objective ID plus confirmation provenance. Full quest completion is the certificate's machine-known alternate.

Permanent capability proof is required before a loadout can be attested. The replacement action supplies one manifest-known vessel ID and the complete current fitting set, never incremental additions. Validate vessel class, slot capacity/types, mutually exclusive groups, and coexistence of every route-required fitting before replacing `activeVoyageLoadout` atomically. Clearing the whole record is always available so the tracker never claims a Voyage currently usable after the player changes ships or fittings. Duplicates cost nothing.

Implement `finalizeChunkedRouteFacts(previous, next, runtime)` as the one post-transition reducer finalizer for exact current Chunked v2. It hashes the closed `ChunkedRequirementFacts` projection (owned chunks, skills plus method tiers, quests, content, permits, capabilities, and full active loadout). When that fingerprint changes and a matching runtime exists, it recomputes active nodes/frontier/Crossing, stores the fingerprint, and marks `routeValidationStatus: 'VALIDATED'` before the outer reducer increments `runRevision`; when unchanged it preserves them. When an ordinary shared progress action (for example a level or quest event) changes facts while the runtime is unavailable, the progress still commits, but the same transition clears the untrusted Crossing, stores the new fingerprint, and marks `UNVALIDATED`; the next successful runtime installation validates it.

Parse-time import/migration never invokes this runtime finalizer: it writes `crossing: null`, the pure facts fingerprint, and `UNVALIDATED`. After the lazy module resolves under Plan 2's generation/run-identity fence, `CHUNKED_REFRESH_ROUTE_STATE` is the sole post-load initial finalization and uses the same derivation logic. No callback dispatches a second refresh after an ordinary fact mutation. Graph-dependent spends remain identity no-ops without a runtime; base-only Trial completion/migration acknowledgement remain legal and do not change route facts.

- [ ] **Step 5: Run tests to verify pass**

Run the command from Step 2; expect PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/fatedFrontier/authorization.ts utils/fatedFrontier/authorization.test.ts utils/fatedFrontier/model.ts context/GameContext.tsx context/gameReducer.test.ts utils/fatedFrontier/integrity.ts utils/fatedFrontier/integrity.test.ts
git commit -m "feat: weave certified Fated Frontier paths" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 6: Persist Cartographer offers and add one Chaos Frontier ticket

**Files:**
- Create: `utils/fatedFrontier/cartographer.ts`
- Create: `utils/fatedFrontier/cartographer.test.ts`
- Create: `utils/fatedFrontier/chaosPool.ts`
- Create: `utils/fatedFrontier/chaosPool.test.ts`
- Modify: `context/GameContext.tsx:1100-1118,1727-1755`
- Modify: `context/gameReducer.test.ts`
- Modify: `components/VoidAltar.tsx:26-77`
- Create: `components/VoidAltar.dom.test.tsx`
- Modify: `components/GachaSection.tsx:245-305`
- Modify: `components/GachaSection.test.tsx`

**Interfaces:**
- Produces persisted `ChunkedCartographerOffer`, `createCartographerOffer()`, `selectCartographerChoice()`, and discriminated `ChunkedChaosTicket` pools.

- [ ] **Step 1: Write failing Cartographer tests**

Assert no local-only offer state, no draw on reopen, zero cost to create, at most three distinct live choices, all choices when frontier has one/two, persisted offer ID/fingerprint/created revision, exact 40-Fate selection, no Frontier cost, stale revision identity, changed-frontier invalidation with zero Fate cost, and successful one-chunk atomic commit.

- [ ] **Step 2: Write failing Chaos tests**

Assert exactly one `{ kind: 'FATED_FRONTIER' }` ticket when a live frontier exists, zero when only a blocked Crossing exists, ticket weight independent of frontier size, content order unchanged, one Chaos debit only after successful geography or guarded content commit, no Frontier debit, no forged Chaos content ticket, and no direct Omni geography path. Include Vanilla pool/order/call-count controls.

- [ ] **Step 3: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/cartographer.test.ts utils/fatedFrontier/chaosPool.test.ts components/VoidAltar.dom.test.tsx components/GachaSection.test.tsx context/gameReducer.test.ts utils/vanillaIsolation.test.ts`

Expected: FAIL because persistent offers/synthetic tickets do not exist.

- [ ] **Step 4: Implement persistent offers**

Preflight then request `min(3, frontier.length)` draws with `nextFloat('cartographer', index)`. Select without replacement from the stable commit-time frontier and persist:

```ts
export interface ChunkedCartographerOffer {
  id: string;
  choices: ChunkKey[];
  fateCost: 40;
  frontierFingerprint: string;
  createdAtRevision: number;
}
```

Reopening returns the existing offer unchanged. A current-revision selection whose fingerprint/choice is no longer live clears the offer without charging; a stale revision remains an identity no-op. A valid choice adds the target before deducting 40 Fate and clears the offer.

- [ ] **Step 5: Implement the discriminated Chaos pool**

Replace all per-coordinate Chunk tickets only in current Chunked v2 with one synthetic ticket at the existing Chunk-table insertion point. Use the existing `nextFloat('chaos')` for global ticket selection and persist the selected discriminated ticket plus pool fingerprint in the prepared command. If Frontier wins, preflight again and call `nextFloat('chaos-frontier')` for the commit-time chunk; dispatch `CHUNKED_CHAOS_WEAVE`. Content tickets dispatch the guarded content action with `costType: 'CHAOS'`, where the reducer revalidates that prepared ticket and fingerprint. Preserve the non-Chunked branch verbatim.

- [ ] **Step 6: Run tests to verify pass**

Run the command from Step 3; expect PASS.

- [ ] **Step 7: Commit**

```bash
git add utils/fatedFrontier/cartographer.ts utils/fatedFrontier/cartographer.test.ts utils/fatedFrontier/chaosPool.ts utils/fatedFrontier/chaosPool.test.ts context/GameContext.tsx context/gameReducer.test.ts components/VoidAltar.tsx components/VoidAltar.dom.test.tsx components/GachaSection.tsx components/GachaSection.test.tsx
git commit -m "feat: add Cartographer and Chaos frontier weaves" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 7: Prove reducer-level liveness under adversarial choices

**Files:**
- Create: `utils/fatedFrontier/reducer.property.test.ts`
- Create: `utils/fatedFrontier/economySimulation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Extends `npm run chunked:verify` with economy/reducer properties.
- Simulation output is pacing evidence only; structural assertions are deterministic.

- [ ] **Step 1: Write the deterministic all-miss properties**

From every valid incomplete fixture, repeatedly complete Unbroken with prepared zero-Standard draws while spending ordinary Fate through any legal ritual between completions. Assert a Frontier Key exists within five completions and a spendable Standard Key exists within ten completions. Then generate arbitrary ten-outcome streams containing raw Standard success, raw miss, ordinary-pity conversion, and Omni-only upgrade; assert at least one Standard is available by completion ten and the ordinary-pity collision never double-awards. Assert Thread/Key counters never fall below zero and every replay/stale/invalid command is identity.

- [ ] **Step 2: Prove finite prerequisite acquisition**

For each `CONTENT_UNLOCK` certificate requirement, follow the legal strategy of spending each hard-pity Standard Key on that requirement's finite table. Since every successful spend removes one eligible permanent result, assert the required result appears no later than the table's initial eligible-unit count. Repeat through every certificate DAG.

- [ ] **Step 3: Prove all geography sources charge iff they add**

Generate legal and adversarial sequences mixing normal weave, Cartographer, Chaos Frontier, stale identities/revisions, duplicate commands, every route-fact mutation, graph refresh, dormant legacy ownership, loadout replacement/clear, and tab takeover. Assert each successful geography history entry corresponds to exactly one new target, one source-specific debit, `verifiedFaucetCountAfter`, and an in-transition route-state snapshot; no rejected command changes state and no fact change requires a second refresh revision. Include loading and route-data-error sequences proving Unbroken still advances Threads/Standard pity while ordinary hand refill waits.

Inject each saturating identity counter. Assert it is classified recoverable rather than valid, the explicit recovery preserves gameplay/economy and changes the run identity, and liveness resumes; never include a saturated incomplete state in the “valid state” quantifier.

- [ ] **Step 4: Run the proof and pacing simulations**

Run: `npx vitest run utils/fatedFrontier/reducer.property.test.ts utils/fatedFrontier/economySimulation.test.ts`

Expected: PASS. Economy simulation records percentiles for first paid chunk and longest no-frontier interval but is not used to waive any deterministic invariant.

- [ ] **Step 5: Extend and run the gate**

Ensure `npm run chunked:verify` includes both files, then run:

```bash
npm run chunked:verify
npx vitest run
npx tsc --noEmit
npx vite build
```

Expected: all pass and Vanilla fixture bytes remain exact.

- [ ] **Step 6: Commit**

```bash
git add utils/fatedFrontier/reducer.property.test.ts utils/fatedFrontier/economySimulation.test.ts package.json
git commit -m "test: prove the renewable Chunked economy" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```
