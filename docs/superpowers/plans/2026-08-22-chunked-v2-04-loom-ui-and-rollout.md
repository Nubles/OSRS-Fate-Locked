# Chunked v2 Loom UI and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the proven Fated Frontier through an always-available, accessible Loom; show authoritative route state on the map; explain migration; collect balance evidence; and complete release verification without altering Vanilla UI or exports.

**Architecture:** `FatedLoom` consumes one derived view model and guarded context callbacks. Focused child cards render Trials, the permanent fallback, currency, Crossings, route errors, and migration. `RegionMap` receives a pure presentation map that distinguishes active/dormant/Path/Passage/Voyage states. RuneLite exports receive one optional Chunked-v2 block; existing fields and all Vanilla output remain unchanged.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS 3, Vitest 4, Testing Library/jsdom, Vite, existing RuneLite bundle/parity utilities, browser verification with agent-browser.

**Spec:** `docs/superpowers/specs/2026-08-22-chunked-v2-fated-frontier-design.md`

**Execution prerequisite:** Do not begin this plan while the suite is `BLOCKED ON ROUTE EVIDENCE`. Plans 1–3 and the complete 623-target verifier must pass first.

## Global Constraints

- The Loom tab exists only for exact current Chunked v2. Non-Chunked tab labels, order, default active tab, DOM, and snapshots remain golden-identical.
- The Loom is never hidden behind progressive feature gates or adviser settings.
- Render three ordinary Trial slots plus The Unbroken Thread separately. The fallback is visible and enabled in every incomplete valid state.
- Show objective, post-baseline progress/attestation, Thread reward, Key chance, proof status, exact reachable chunks, and disabled reason in text. Do not rely on colour, hover, or a tooltip.
- Show Threads with a labelled progress bar, Frontier Key count, normal Weave action, 40-Fate Cartographer state, current Crossing/prerequisite chain, and the permanent Lumbridge Home Teleport exemption.
- Map states distinguish active owned, dormant legacy, Path frontier, Passage frontier, Voyage frontier, blocked Crossing, and locked. Never label stored dormant ownership reachable.
- A `route-data-error` preserves all currency, names the graph/certificate failure, and never presents completion.
- Minimum interactive target is 44×44 CSS pixels; phone layout is one column; focus order follows visual order; animations respect reduced motion.
- Migration copy states exactly: Attack/Strength baseline refunds, stored-root removal, quarantined identifiers, zero historical chunk refunds, and dormant ownership behavior.
- Chunked evidence contains aggregate metrics only—no raw run IDs, exact timestamps, account names, or free-form notes.
- Do not edit standalone RuneLite Java sources in this repository. Additive web bundle fields must be optional and ignored by older consumers.
- Player-facing mode/guide changes require a changelog entry and `npm run changelog:verify`, but the entry and auto-open selector must be scoped to exact Chunked. Vanilla must neither render nor auto-open it; existing unscoped releases keep their current behavior.

## File Structure

### Loom UI

- `utils/fatedFrontier/loomViewModel.ts` and `.test.ts` — one pure UI projection.
- `components/FatedLoom.tsx` and `.dom.test.tsx` — page composition and actions.
- `components/fated-frontier/TrialCard.tsx` and `.dom.test.tsx` — ordinary Trial card.
- `components/fated-frontier/UnbrokenThreadCard.tsx` and `.dom.test.tsx` — permanent fallback.
- `components/fated-frontier/FrontierWeaveCard.tsx` — currencies and normal weave.
- `components/fated-frontier/CrossingCard.tsx` — route/prerequisite/certificate state.
- `components/fated-frontier/CounterRecoveryCard.tsx` and `.dom.test.tsx` — local no-reward recovery for saturated identity counters.
- `components/fated-frontier/ChunkedMigrationSummary.tsx` and `.dom.test.tsx` — non-blocking migration disclosure.
- `components/Dashboard.tsx` and new `components/Dashboard.chunked.test.tsx` — exact-mode tab composition.

### Map, evidence, and integration

- `utils/fatedFrontier/mapPresentation.ts` and `.test.ts` — exact map state/legend data.
- `components/RegionMap.tsx` and new `components/RegionMap.chunked.dom.test.tsx` — Fated Frontier rendering.
- `components/FrontierAdvisorPanel.tsx` and tests — suppress the legacy optimistic adviser in exact v2; the Loom owns Crossing guidance.
- `components/ChunkActivityPanel.tsx` and tests — consume certified zone presentation in exact v2 instead of `connectGraph()`/`chunkUnlocked()`.
- `utils/fatedFrontier/evidence.ts` and `.test.ts` — aggregate metrics/report section.
- `components/KeyEconomyEvidenceExport.tsx` and tests — conditional Chunked section.
- `docs/testing/chunked-v2-balance-evidence.md` — frozen-sample report and provisional-value decision.
- `utils/runeliteRulesManifest.ts`, `utils/runeliteBundle.ts`, and existing tests — optional Chunked-v2 contract.
- `data/runeliteGuide.ts`, `components/runelite-guide/RunelitePluginGuide.tsx`, and tests — accurate released-mode guidance.
- `config/gameModes.ts` — updated Chunked description only.
- `data/changelog.ts` — player-facing release entry.

---

### Task 1: Build one authoritative Loom view model

**Files:**
- Create: `utils/fatedFrontier/loomViewModel.ts`
- Create: `utils/fatedFrontier/loomViewModel.test.ts`
- Modify: `utils/fatedFrontier/model.ts`

**Interfaces:**
- Consumes `GameState` and installed `FatedFrontierRuntime` derivations.
- Produces a discriminated `LoomViewModel`; React components perform no independent reachability or economy calculation.

- [ ] **Step 1: Write failing projection tests**

Cover loading, current valid state, full/incomplete Threads, no Frontier Key, live frontier, blocked Crossing, route-data-error, complete map, dormant legacy ownership, stale Cartographer offer, unacknowledged migration, and exact non-Chunked absence.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/loomViewModel.test.ts`

Expected: FAIL because the projection does not exist.

- [ ] **Step 3: Define the UI contract**

```ts
export type LoomRouteStatus =
  | { kind: 'LOADING' }
  | { kind: 'FRONTIER'; candidates: FrontierCandidateView[] }
  | { kind: 'CROSSING'; crossing: CrossingView }
  | { kind: 'ROUTE_DATA_ERROR'; diagnostics: string[] }
  | { kind: 'COMPLETE'; ownedTargets: 623 };

export interface LoomViewModel {
  threads: { value: number; threshold: 5; label: string };
  frontierKeys: number;
  trials: TrialView[];
  unbroken: TrialView;
  route: LoomRouteStatus;
  cartographer: CartographerView;
  homeTeleportExempt: true;
  migration: MigrationSummaryView | null;
  counterRecovery: CounterRecoveryView | null;
}
```

Use stable reason codes mapped to player-facing copy. Never infer a usable route in the component.

- [ ] **Step 4: Implement and verify**

Run: `npx vitest run utils/fatedFrontier/loomViewModel.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/fatedFrontier/loomViewModel.ts utils/fatedFrontier/loomViewModel.test.ts utils/fatedFrontier/model.ts
git commit -m "feat: project the Fated Loom state" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 2: Add the exact-Chunked Loom tab and accessible controls

**Files:**
- Create: `components/FatedLoom.tsx`
- Create: `components/FatedLoom.dom.test.tsx`
- Create: `components/fated-frontier/TrialCard.tsx`
- Create: `components/fated-frontier/TrialCard.dom.test.tsx`
- Create: `components/fated-frontier/UnbrokenThreadCard.tsx`
- Create: `components/fated-frontier/UnbrokenThreadCard.dom.test.tsx`
- Create: `components/fated-frontier/FrontierWeaveCard.tsx`
- Create: `components/fated-frontier/CrossingCard.tsx`
- Create: `components/fated-frontier/CounterRecoveryCard.tsx`
- Create: `components/fated-frontier/CounterRecoveryCard.dom.test.tsx`
- Modify: `components/Dashboard.tsx:89-96,351-372,703-857`
- Create: `components/Dashboard.chunked.test.tsx`
- Modify: `styles.css` only if Tailwind cannot express the reduced-motion/focus requirement

**Interfaces:**
- Consumes only `LoomViewModel` and guarded context methods: complete/replace Trial, weave, create/select Cartographer, attest permit/capability, replace/clear the active Voyage loadout, recover counters, and acknowledge migration.
- Produces no direct reducer action and calls no RNG utility.

- [ ] **Step 1: Write failing tab/isolation tests**

Assert current Chunked gets a visible `The Loom` tab independent of `revealAllFeatures`/advisers, it becomes the first explanatory destination after mode selection, and it remains reachable by keyboard. Assert Vanilla/custom keep exact tab order/default/DOM from the golden test and never mount/import `FatedLoom`.

- [ ] **Step 2: Write failing accessibility/mobile tests**

Assert labelled Thread `role="progressbar"` with `aria-valuemin="0"`, `aria-valuemax="5"`, and the current remainder; all ordinary cards; always-visible Unbroken card; 10%/hard-pity text; proof/reachability text; Home Teleport exemption; disabled reasons; route error; distinct Cartographer choices; and no essential detail hidden in a tooltip. For a `COUNTER_RECOVERY_REQUIRED` fixture, show a blocking exact-Chunked repair card that explains no progress/currency will be lost, dispatches only the base-guarded recovery command, and returns to the Loom. Inspect class contracts for one-column base layout, wider breakpoint grid, 44-pixel controls, visible focus, and reduced motion.

- [ ] **Step 3: Run tests to verify failure**

Run: `npx vitest run components/FatedLoom.dom.test.tsx components/fated-frontier/TrialCard.dom.test.tsx components/fated-frontier/UnbrokenThreadCard.dom.test.tsx components/fated-frontier/CounterRecoveryCard.dom.test.tsx components/Dashboard.chunked.test.tsx components/VanillaIsolation.dom.test.tsx`

Expected: FAIL because the Loom UI does not exist.

- [ ] **Step 4: Implement thin components**

Use Fate-Locked language consistently: “The Loom,” “Threads of Fate,” “Frontier Key,” “Weave the Path,” “Fated Crossing,” “The First Omen,” and “The Unbroken Thread.” Each button sends the current `runId` and `runRevision` through its context callback; components do not calculate candidates or costs. A pre-completion route permit names the exact preceding quest objective and requires an explicit honour confirmation; it is never inferred from merely opening the card. Voyage Crossings distinguish permanent capability proof from the player's one current vessel/loadout attestation and always expose a clear/replace control for that full loadout.

The Unbroken card remains rendered even when three ordinary cards are completable. Its bounded cycle displays `25 → 50 → 75 → 100 → 25`, current miss count out of 10, one-Thread reward, and the real 10% Standard attempt.

- [ ] **Step 5: Run tests to verify pass**

Run the command from Step 3; expect PASS.

- [ ] **Step 6: Commit**

```bash
git add components/FatedLoom.tsx components/FatedLoom.dom.test.tsx components/fated-frontier components/Dashboard.tsx components/Dashboard.chunked.test.tsx styles.css
git commit -m "feat: open the Fated Loom for Chunked runs" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 3: Render certified frontier states on the world map

**Files:**
- Create: `utils/fatedFrontier/mapPresentation.ts`
- Create: `utils/fatedFrontier/mapPresentation.test.ts`
- Modify: `components/RegionMap.tsx:471-608,1222-1257,1893-1942`
- Create: `components/RegionMap.chunked.dom.test.tsx`
- Modify: `components/FrontierAdvisorPanel.tsx`
- Create: `components/FrontierAdvisorPanel.test.tsx`
- Modify: `components/ChunkActivityPanel.tsx`
- Modify: `components/ChunkActivityPanel.dom.test.tsx`
- Modify: `components/ChunkActivityPanel.test.tsx`

**Interfaces:**
- Produces `buildChunkedMapPresentation(state, runtime): ReadonlyMap<ChunkKey, ChunkMapPresentation>`.
- `RegionMap` branches to it only for exact current Chunked v2; every existing non-Chunked fill/lens/comparator remains unchanged.

- [ ] **Step 1: Write failing pure presentation tests**

Cover root, fully active paid, partially active multi-zone paid, dormant legacy, live Path, live Passage, live Voyage, active blocked Crossing, ordinary locked, and route-data-error. Assert one coordinate has exactly one priority-resolved state and stable label/evidence/reason fields.

- [ ] **Step 2: Write failing DOM tests**

Assert visible legend labels, colour-independent icons/pattern names, selected-drawer active/sealed zone details, edge type, route label, unmet requirements, evidence status, dormant explanation, and Home Teleport root marker. Assert no tooltip is required to understand a state. Render a chunk whose zone A is active and zone B sealed; both `ChunkActivityPanel` and the map must show partial activation and must not use optimistic coordinate ownership. Assert `FrontierAdvisorPanel` is absent in exact v2 and unchanged in legacy/non-v2 controls.

- [ ] **Step 3: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/mapPresentation.test.ts components/RegionMap.chunked.dom.test.tsx components/FrontierAdvisorPanel.test.tsx components/ChunkActivityPanel.dom.test.tsx components/ChunkActivityPanel.test.tsx components/VanillaIsolation.dom.test.tsx`

Expected: FAIL because certified map presentation is absent.

- [ ] **Step 4: Implement the exact-mode map branch**

Use this precedence: route-data-error marker; root; active owned; dormant owned; active Crossing; live Voyage; live Passage; live Path; locked. Include the runtime graph/fingerprint in memo dependencies so a new weave/permit updates immediately. Do not call old `isFrontierChunk()` or coarse reachability in this branch. Route exact v2 `ChunkActivityPanel` through the same `ChunkMapPresentation`/zone-node view model. Do not mount the legacy `FrontierAdvisorPanel` for exact v2 because its `rankFrontierChunks()` logic is optimistic and the Loom's Crossing card replaces it. Preserve both legacy components verbatim for every non-v2 state.

- [ ] **Step 5: Run tests to verify pass**

Run the command from Step 3; expect PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/fatedFrontier/mapPresentation.ts utils/fatedFrontier/mapPresentation.test.ts components/RegionMap.tsx components/RegionMap.chunked.dom.test.tsx components/FrontierAdvisorPanel.tsx components/FrontierAdvisorPanel.test.tsx components/ChunkActivityPanel.tsx components/ChunkActivityPanel.dom.test.tsx components/ChunkActivityPanel.test.tsx
git commit -m "feat: map the certified Fated Frontier" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 4: Explain migration non-blockingly and update player guidance

**Files:**
- Create: `components/fated-frontier/ChunkedMigrationSummary.tsx`
- Create: `components/fated-frontier/ChunkedMigrationSummary.dom.test.tsx`
- Modify: `context/GameContext.tsx`
- Modify: `context/gameReducer.test.ts`
- Modify: `config/gameModes.ts:70-85`
- Modify: `data/runeliteGuide.ts`
- Modify: `data/runeliteGuide.test.ts`
- Modify: `components/runelite-guide/RunelitePluginGuide.tsx`
- Modify: `components/runelite-guide/RunelitePluginGuide.dom.test.tsx`

**Interfaces:**
- `CHUNKED_ACK_MIGRATION` changes only `migration.acknowledged` under expected-revision guard.
- The summary reads the immutable migration preimage/provenance; dismissing it never changes rewards or quarantined data.

- [ ] **Step 1: Write failing migration-copy tests**

Cover fresh state (no summary), zero/one/two starter refunds, pending refunds, stored-root removal, malformed/unknown quarantine, valid dormant legacy chunks, explicit zero chunk refunds, acknowledgement/reload, stale acknowledgement, and keyboard dismissal. Assert it does not reuse or block behind the Fate-compensation modal.

- [ ] **Step 2: Write failing guide/mode-copy tests**

Replace the statement “Chunked mode is not finished” with the released v2 loop and exact currency rules. Assert the guide says Standard cannot buy chunks, Unbroken is permanent, normal weave is random, Cartographer is 40 Fate/no Frontier, Chaos has one Frontier ticket, and Home Teleport is exempt. Keep all Vanilla guide copy unchanged.

- [ ] **Step 3: Run tests to verify failure**

Run: `npx vitest run components/fated-frontier/ChunkedMigrationSummary.dom.test.tsx context/gameReducer.test.ts data/runeliteGuide.test.ts components/runelite-guide/RunelitePluginGuide.dom.test.tsx components/VanillaIsolation.dom.test.tsx`

Expected: FAIL on new UI/copy.

- [ ] **Step 4: Implement summary, acknowledgement, and released copy**

The summary is an ordinary Loom card, not a modal. Include a “Copy migration report” action that copies bounded JSON from the nested migration record and never includes account name/history/notes.

- [ ] **Step 5: Run tests to verify pass**

Run the command from Step 3; expect PASS.

- [ ] **Step 6: Commit**

```bash
git add components/fated-frontier/ChunkedMigrationSummary.tsx components/fated-frontier/ChunkedMigrationSummary.dom.test.tsx context/GameContext.tsx context/gameReducer.test.ts config/gameModes.ts data/runeliteGuide.ts data/runeliteGuide.test.ts components/runelite-guide/RunelitePluginGuide.tsx components/runelite-guide/RunelitePluginGuide.dom.test.tsx
git commit -m "docs: explain the released Chunked v2 rules" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 5: Add aggregate Chunked evidence and freeze provisional values

**Files:**
- Create: `utils/fatedFrontier/evidence.ts`
- Create: `utils/fatedFrontier/evidence.test.ts`
- Modify: `utils/keyEconomyEvidence.ts`
- Modify: `utils/keyEconomyEvidence.test.ts`
- Modify: `components/KeyEconomyEvidenceExport.tsx`
- Modify: `components/KeyEconomyEvidenceExport.test.tsx`
- Create: `docs/testing/chunked-v2-balance-evidence.md`
- Test: `utils/fateAnalytics.test.ts`

**Interfaces:**
- Produces `buildChunkedV2Evidence(state): ChunkedV2EvidenceSection | null`.
- Existing Vanilla evidence schema/output is unchanged; exact Chunked appends one namespaced section.

- [ ] **Step 1: Write failing aggregation/privacy tests**

Aggregate actions/time-to-first-paid-chunk, Threads and Frontier Keys per active hour, longest no-frontier interval, verified faucet count after each unlock, ordinary-versus-Unbroken completions, usable/dead/unknown content unlock share, Trial Fate/pity, Crossing wait/blockers, and unlock source split (normal/Cartographer/Chaos). Read per-unlock faucet snapshots and route-state transitions from Plan 3's bounded event-time metadata; do not attempt to reconstruct them from final state. Assert no raw `runId`, account, free-form note, exact event timestamp, or arbitrary diagnostic string appears.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/fatedFrontier/evidence.test.ts utils/keyEconomyEvidence.test.ts components/KeyEconomyEvidenceExport.test.tsx utils/fateAnalytics.test.ts utils/vanillaIsolation.test.ts`

Expected: FAIL because the Chunked section is absent.

- [ ] **Step 3: Implement conditional composition**

Do not modify Fate Analytics calculations. Derive Chunked metrics from the fixed-enum/safe-integer action metadata and coarse elapsed buckets recorded in Plan 3. Crossing wait is the difference between recorded route-state transition buckets, and `verifiedFaucetCountAfter` is read directly from each successful geography event. Return `null` for every non-Chunked state so existing output remains byte-identical.

- [ ] **Step 4: Execute the frozen-sample protocol**

Run at least ten seeded runs for each early/mid/late stage, at least 500 scoreable attempts per stage, across three materially different mixes: varied ordinary Trials, fallback-heavy play, and Crossing-prerequisite targeting. Record median/IQR and worst observed drought for the metrics above. The report states whether each provisional constant remains unchanged or gives the evidence-backed replacement value before code constants change.

The report must not waive structural proof based on simulation. If evidence calls for a value change, update only `config/chunkedV2.ts`, update its tests, rerun the same frozen sample, and record both samples.

- [ ] **Step 5: Run tests to verify pass**

Run the command from Step 2; expect PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/fatedFrontier/evidence.ts utils/fatedFrontier/evidence.test.ts utils/keyEconomyEvidence.ts utils/keyEconomyEvidence.test.ts components/KeyEconomyEvidenceExport.tsx components/KeyEconomyEvidenceExport.test.tsx docs/testing/chunked-v2-balance-evidence.md config/chunkedV2.ts config/chunkedV2.test.ts
git commit -m "test: document Chunked v2 balance evidence" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 6: Export additive Chunked-v2 RuneLite state

**Files:**
- Create: `docs/research/runelite-chunked-v2-compatibility.md`
- Create: `test-fixtures/runelite/chunked-v2-active.json`
- Create: `test-fixtures/runelite/chunked-v2-partial-dormant.json`
- Create: `scripts/verify-runelite-chunked-v2.mjs`
- Modify: `utils/runeliteRulesManifest.ts`
- Modify: `utils/runeliteRulesManifest.test.ts`
- Modify: `utils/runeliteBundle.ts`
- Modify: `utils/runeliteBundle.test.ts`
- Modify: `utils/runelitePluginParity.test.ts`
- Modify: `utils/runeliteExport.ts`

**Interfaces:**
- Adds an optional `chunkedV2` block only when the exact current mode/runtime snapshot is supplied.
- Exact-v2 legacy chunk arrays remain shape/order compatible but contain only fully active certified chunks; the additive block carries partial-zone detail. Compatibility with older plugins is a measured release gate, not an assumption.

- [ ] **Step 1: Write failing additive-contract tests**

Assert Vanilla bundle JSON is golden-identical and lacks `chunkedV2`. Assert Chunked exports schema/graph/rules version, root, active zone-node IDs, active chunks, fully active chunks, dormant chunks, live frontier with edge kinds, current Crossing ID/status, and `lumbridgeHomeTeleportExempt: true`. Assert exact-v2 `unlockedChunks` and `rules.unlocks.chunks` are deterministically replaced with `fullyActiveChunks` only—never dormant or partially active coordinates—while field shape/order stays compatible. Assert no optimistic `connect` closure is used.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run utils/runeliteRulesManifest.test.ts utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts utils/vanillaIsolation.test.ts`

Expected: FAIL because the optional block does not exist.

- [ ] **Step 3: Add the optional contract without bumping bundle v4**

```ts
export interface RuneliteChunkedV2Snapshot {
  schemaVersion: 1;
  rulesVersion: 1;
  graphVersion: 1;
  root: '50,50';
  activeZoneNodeIds: string[];
  activeChunks: string[];
  fullyActiveChunks: string[];
  dormantChunks: string[];
  frontier: Array<{ chunk: string; edgeKind: 'PATH' | 'PASSAGE' | 'VOYAGE' }>;
  crossing: { id: string; destination: string; status: 'BLOCKED' | 'READY' } | null;
  lumbridgeHomeTeleportExempt: true;
}
```

Pass this snapshot from the already-loaded runtime. Do not dynamically load the graph inside a Vanilla export. For exact v2 only, write sorted `fullyActiveChunks` into both legacy chunk-level permission arrays; `chunkedV2.activeChunks` may additionally name partially active coordinates, while `activeZoneNodeIds` is authoritative for a zone-aware plugin. Keep bundle `version: 4`, identity fields, chunk content, field shapes, and ordering unchanged. Vanilla and legacy Chunked export values remain byte-identical.

- [ ] **Step 4: Prove supported standalone-plugin compatibility**

Pin the supported standalone RuneLite plugin repository/release revision and obtain its real parser/permission behavior as a licensed source checkout, built test fixture, or owner-supplied acceptance artifact. Feed it Vanilla, legacy Chunked, exact-v2 with unknown additive block, partial-zone, dormant, and fully-active bundles. It must ignore or safely parse the new block, must not grant dormant/partial chunks through legacy arrays, and must preserve existing Vanilla results. The TypeScript `pluginSim` remains a fast unit test but is not accepted as proof of Java behavior. If this artifact cannot be obtained or any case fails, keep the release/RuneLite-parity exit condition blocked; do not merely document a future dependency and continue.

- [ ] **Step 5: Run tests to verify pass**

Run the command from Step 2 plus the pinned standalone-plugin acceptance command recorded in the test fixture; expect PASS. Do not add Java here or weaken either proof.

- [ ] **Step 6: Commit**

```bash
git add docs/research/runelite-chunked-v2-compatibility.md test-fixtures/runelite/chunked-v2-active.json test-fixtures/runelite/chunked-v2-partial-dormant.json scripts/verify-runelite-chunked-v2.mjs utils/runeliteRulesManifest.ts utils/runeliteRulesManifest.test.ts utils/runeliteBundle.ts utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts utils/runeliteExport.ts
git commit -m "feat: export certified Chunked v2 state" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

---

### Task 7: Complete release, browser, and branch verification

**Files:**
- Modify: `data/changelog.ts`
- Modify: `utils/changelogState.ts`
- Modify: `utils/changelogState.test.ts`
- Modify: `App.tsx`
- Create: `App.test.tsx`
- Modify: `App.lifecycle.test.tsx`
- Modify: `README.md` only where it currently documents old Chunked mechanics
- Verify: all changed files on `design/chunked-v2-fated-frontier`

**Interfaces:**
- Produces a reviewed branch ready for the user's chosen integration action; it does not merge or open a PR automatically.

- [ ] **Step 1: Add the player-facing changelog entry and integration tests**

Describe the renewable Trial/Thread loop, Frontier Keys, certified Crossings, starter tiers, migration, Cartographer/Chaos behavior, and Vanilla isolation. Add `gameModeIds?: RunMode[]` to changelog records with default “all modes” semantics for every existing entry; mark only the new release `['chunked']`. Derive both visible releases and the latest auto-open key through one exact-mode selector so Vanilla neither sees nor auto-opens the Chunked entry. Add Vanilla golden controls and app lifecycle tests for lazy graph loading/error recovery, saturated-counter recovery, and reset/import across exact modes. Include delayed-import races for Chunked → Vanilla, profile A → B, reset, stale revision, and failure → retry; assert the generation/run-identity fence prevents late runtime installation, refresh dispatch, or any Vanilla-visible error.

- [ ] **Step 2: Run focused release tests and commit the checkpoint**

Run the changelog/lifecycle/Vanilla controls, then commit all release edits before diff review:

```bash
npx vitest run utils/changelogState.test.ts App.test.tsx App.lifecycle.test.tsx components/VanillaIsolation.dom.test.tsx
npm run changelog:verify
git add data/changelog.ts utils/changelogState.ts utils/changelogState.test.ts App.tsx App.test.tsx App.lifecycle.test.tsx README.md
git commit -m "feat: release the Fated Frontier in Chunked v2" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

- [ ] **Step 3: Run the complete automated gate as separate commands**

```bash
npm run changelog:verify
npm test
npm run typecheck
npm run content:verify
npm run build
npm run release:verify
```

Expected: every command exits zero. Capture the `chunked:verify` line reporting `624 authored / 623 paid / 623 proven / 0 route errors`. Review the Vite report and confirm route manifests remain in a lazy Chunked asset.

- [ ] **Step 4: Run fresh-profile Vanilla browser verification**

Start the app with `npm run dev`, then use the repository's agent-browser verification workflow with a new profile. Select Vanilla and verify: no Loom/Threads/Frontier UI; no Chunked release note or auto-open; original tab and Spend order; same three starting Standard Keys; seeded Standard and Chaos flows; import/export equals the Vanilla fixture; map behavior unchanged; browser console has no graph import/error.

- [ ] **Step 5: Run fresh-profile Chunked browser verification**

With another new profile, select Chunked and verify at desktop and 390×844: HP/Attack/Strength tier 1; three Standard Keys; Loom default; **three total ordinary slots initially (First Omen plus two catalog fills), then three catalog fills after First Omen completes**; always-visible fourth Unbroken card; Thread progress; Unbroken completion during graph loading/error; Home Teleport exemption; normal weave commit-before-reveal; persistent Cartographer reopen; one Chaos Frontier ticket; Crossing prerequisites; route permit attestation; compatible full-vessel loadout replace/clear; active/partial/dormant map legend; migration summary on an imported legacy fixture; visible route-data-error on a deliberately invalid test fixture; counter-recovery UI; keyboard/focus flow and reduced motion.

- [ ] **Step 6: Review exact Vanilla isolation and branch scope**

Run:

```bash
git diff --check
git diff --stat main...HEAD
git diff main...HEAD -- test-fixtures/vanilla utils/vanillaIsolation.test.ts components/VanillaIsolation.dom.test.tsx
git status --short --branch
```

Confirm branch is `design/chunked-v2-fated-frontier`, no generated/unrelated files are present, every new behavioral branch uses exact current Chunked v2 identity, and no fixture was rewritten to hide a regression.

- [ ] **Step 7: Request and address code review**

Use superpowers:requesting-code-review. Give the reviewer the design spec, this four-plan suite, target/proof verifier output, Vanilla golden output, migration matrix, standalone RuneLite acceptance output, browser evidence, and balance report. Apply accepted findings with superpowers:receiving-code-review, commit each accepted fix, and rerun Step 3 plus affected browser checks. Review `main...HEAD` only after those commits.

- [ ] **Step 8: Verify before claiming completion and finish last**

Use superpowers:verification-before-completion and record fresh command output from the committed branch. Confirm `git status --short` is empty and `git diff main...HEAD` includes every reviewed release change. Only then use superpowers:finishing-a-development-branch to offer merge locally, push/open PR, keep branch, or discard. Do not merge, push to `main`, or open a PR without the user's choice.
