# RuneProof F2P Foundation and Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fail-closed all-F2P quest-pack foundation and deliver Cook's Assistant, Sheep Shearer, The Restless Ghost, Rune Mysteries, and Imp Catcher as the first locally reviewable RuneProof wave.

**Architecture:** Keep the accepted RuneProof coach as one shared runtime and compile independently reviewed quest packs into its preview-only catalogue. Add a reviewed F2P membership registry, generalize the four-pilot source pipeline, strengthen the pack contract, preserve progress for several quests in the existing run-scoped preview storage, and author four new Wave 1 packs. End with a verified local desktop/mobile preview and stop for Alex's approval before Wave 2.

**Tech Stack:** React 18, TypeScript, Vite 5, Vitest 4, Testing Library, JSON source snapshots, Node.js source compiler, existing RuneProof route resolver and coach

**Spec:** `docs/superpowers/specs/2026-08-21-runeproof-all-f2p-quest-packs-design.md`

## Global Constraints

- Support every current F2P quest and F2P miniquest through the approved 23-entry membership snapshot; this plan publishes only Wave 1 into the reviewable preview catalogue.
- Keep all packs behind `VITE_RUNEPROOF_PREVIEW=1`.
- Every player-visible action must carry a reviewed canonical chunk and render it inline.
- **Show on map** must open the temporary map and closing it must restore the same quest, active step, scroll context, and progress.
- Reviewed preferred methods remain primary; generic sources are alternatives and proof only.
- Missing membership, sources, evidence, chunks, dependencies, item flow, or final completion must reject only the affected pack.
- Preserve Cook's Assistant as the golden regression pack, including its local Mill Lane flour route and accepted 9/9 completion behavior.
- Keep preview confirmations isolated from `GameState`, Journal progress, keys, rewards, Fate rolls, exports, sync, saves, and integrity history.
- Use plain `cmd.exe`-compatible commands; do not introduce PowerShell scripts or encoded/obfuscated command forms.
- Do not push, merge, deploy, publicly enable, announce, or release RuneProof at this checkpoint.
- Stop after Wave 1 automated and local visual verification so Alex can review it before Wave 2 begins.

---

## File Structure

### New focused files

- `data/sources/f2p-quest-membership.json` — reviewed 23-entry membership, wave, order, and evidence snapshot.
- `data/f2pQuestMembership.ts` — validate, freeze, and query the membership snapshot at runtime.
- `data/f2pQuestMembership.test.ts` — prove exact coverage, classifications, ordering, and fail-closed validation.
- `utils/questStrategies/objectives.ts` — rank compiled supported strategies into up to three deterministic RuneProof recommendations.
- `utils/questStrategies/objectives.test.ts` — prove completion exclusion, readiness ordering, priority, and stable reasons.
- `components/questStrategies/RuneProofObjectivePicker.tsx` — display and select the recommended compiled objectives.
- `components/questStrategies/RuneProofObjectivePicker.test.tsx` — prove accessible selection and completed-objective exclusion.
- `data/questWalkthroughs.wave1.test.ts` — assert every Wave 1 action ID, instruction, chunk, item flow, method, and completion rule.
- `docs/testing/runeproof-f2p-wave-1-local-acceptance.md` — the exact local desktop/mobile review checklist.

### Existing files to extend

- `scripts/quest-walkthrough-source.mjs` — replace four-pilot assumptions with an explicit allowed roster and selected quest refresh.
- `scripts/sync-quest-walkthroughs.mjs` — load membership, add one reviewed quest candidate by stable slug, and keep promotion atomic.
- `scripts/quest-walkthrough-source.test.ts` — cover subset catalogues, selected refresh, roster rejection, and promotion.
- `data/questWalkthroughs.ts` — validate a changing generated subset against membership plus the retained Elemental Workshop I pilot.
- `data/questWalkthroughs.test.ts` — prove generated subset and release consistency.
- `data/questWalkthroughs.preview-boundary.ts` — expose compiled strategy lookup and the immutable strategy catalogue only in preview.
- `data/questWalkthroughLoader.ts` — load one strategy or the whole strategy catalogue through the preview boundary.
- `data/questWalkthroughRelease.ts` — add each compiled Wave 1 revision as `PREVIEW_ONLY`.
- `data/sources/quest-walkthrough-sources.json` — add pinned source and task records as each Wave 1 pack is promoted.
- `data/sources/quest-walkthrough-review.json` — add reviewed actions and source-line digests for each Wave 1 pack.
- `data/questWalkthroughs.generated.json` — generated immutable walkthrough and strategy data.
- `utils/questWalkthroughs/model.ts` — record consumed item flow on coach actions.
- `utils/questStrategies/model.ts` — require membership metadata, reviewed chunks, valid item flow, and one final confirmation.
- `utils/questStrategies/model.test.ts` — reject malformed pack boundaries and preserve Cook's Assistant.
- `utils/questStrategies/previewActions.ts` — normalize action progress against the full loaded strategy catalogue.
- `utils/questStrategies/previewActions.test.ts` — prove several quests coexist under the existing per-run storage key.
- `hooks/useRuneProofPreviewActions.ts` — expose quest-scoped confirmation controls from one catalogue-scoped state.
- `hooks/useRuneProofPreviewActions.test.tsx` — prove switching quests preserves both routes and accepted Cook progress.
- `data/questItemRequirements.ts` — add Wave 1 root requirements and allow source-backed quests with no player-obtained items.
- `data/questItemRequirements.test.ts` — prove exact quantities and empty-root quests.
- `data/questRouteRecipes.ts` — add reviewed shear-sheep and spin-wool transformations.
- `data/questRouteRecipes.test.ts` — prove the Sheep Shearer chain and exact coverage.
- `utils/questRoutes/analyzeQuest.test.ts` — prove all Wave 1 analyses, including empty root requirements and Imp alternatives.
- `utils/questStrategies/coach.test.ts` — cover independent bead actions, item flow, chunks, blockers, and final confirmations.
- `components/GoalPlannerModal.tsx` — load the strategy catalogue, choose the best supported objective, and share multi-quest preview progress.
- `components/GoalPlannerModal.runeproof.test.tsx` — cover recommendations, target switching, stale loads, storage, map return, and unsupported fallback.
- `components/questStrategies/RuneProofCoach.test.tsx` — exercise each Wave 1 route in the shared interface.

---

### Task 1: Add the authoritative F2P membership registry

**Files:**
- Create: `data/sources/f2p-quest-membership.json`
- Create: `data/f2pQuestMembership.ts`
- Create: `data/f2pQuestMembership.test.ts`

**Interfaces:**
- Consumes: reviewed records in `data/sources/quest-list.json` and `data/sources/quest-requirement-audit.json`.
- Produces: `F2PQuestMembership`, `f2pQuestMembership`, `f2pQuestMembershipFor(questId)`, and `f2pQuestMembershipBySlug(slug)`.

- [ ] **Step 1: Write the failing exact-roster tests**

Create `data/f2pQuestMembership.test.ts` with the approved order and classifications:

```ts
const EXPECTED = [
  "Cook's Assistant", 'Sheep Shearer', 'The Restless Ghost', 'Rune Mysteries', 'Imp Catcher',
  "Daddy's Home", 'X Marks the Spot', 'Romeo & Juliet', 'Demon Slayer', 'Ernest the Chicken',
  "Doric's Quest", 'Goblin Diplomacy', "Witch's Potion", "The Knight's Sword", "Black Knights' Fortress",
  'Vampyre Slayer', 'Prince Ali Rescue', "Pirate's Treasure", 'Misthalin Mystery', 'Below Ice Mountain',
  'The Corsair Curse', 'Shield of Arrav', 'Dragon Slayer I',
] as const;

expect(f2pQuestMembership.map(entry => entry.questId)).toEqual(EXPECTED);
expect(f2pQuestMembershipFor("Daddy's Home")?.kind).toBe('miniquest');
expect(f2pQuestMembership.filter(entry => entry.kind === 'miniquest').map(entry => entry.questId))
  .toEqual(["Daddy's Home"]);
expect(f2pQuestMembershipFor('Learning the Ropes')).toBeUndefined();
expect(f2pQuestMembershipFor('Elemental Workshop I')).toBeUndefined();
expect(f2pQuestMembership.map(entry => entry.progressionPriority)).toEqual(
  Array.from({ length: 23 }, (_value, index) => index + 1),
);
```

Add mutation fixtures that reject a duplicate ID, duplicate slug, non-contiguous priority, invalid wave, missing evidence reference, and any kind other than `quest` or `miniquest`.

- [ ] **Step 2: Run the test and verify the registry is missing**

```cmd
npx vitest run data/f2pQuestMembership.test.ts
```

Expected: FAIL because the JSON snapshot and TypeScript registry do not exist.

- [ ] **Step 3: Create the reviewed JSON snapshot**

Use this exact record contract for all 23 entries:

```json
{
  "schemaVersion": 1,
  "reviewedAt": "2026-08-21",
  "evidenceFiles": [
    "data/sources/quest-list.json",
    "data/sources/quest-requirement-audit.json"
  ],
  "quests": [
    {
      "questId": "Cook's Assistant",
      "slug": "cooks-assistant",
      "kind": "quest",
      "wave": 1,
      "progressionPriority": 1,
      "wikiTitle": "Cook's Assistant/Quick guide",
      "evidenceQuestId": "Cook's Assistant"
    }
  ]
}
```

Populate the remaining records in the exact `EXPECTED` order. Use waves `1,1,1,1,1`, `2,2,2,2,2`, `3,3,3,3,3`, `4,4,4,4,4`, and `5,5,5`; use contiguous priorities `1` through `23`; use lowercase apostrophe-free hyphenated slugs; classify only Daddy's Home as `miniquest`; set `wikiTitle` to the exact quest name plus `/Quick guide`; and set `evidenceQuestId` to the exact matching audit ID.

- [ ] **Step 4: Implement strict runtime validation**

Create `data/f2pQuestMembership.ts` with these public types and functions:

```ts
export interface F2PQuestMembership {
  readonly questId: string;
  readonly slug: string;
  readonly kind: 'quest' | 'miniquest';
  readonly wave: 1 | 2 | 3 | 4 | 5;
  readonly progressionPriority: number;
  readonly wikiTitle: string;
  readonly evidenceQuestId: string;
}

export function validateF2PQuestMembership(value: unknown): readonly F2PQuestMembership[];
export const f2pQuestMembership: readonly F2PQuestMembership[];
export function f2pQuestMembershipFor(questId: string): F2PQuestMembership | undefined;
export function f2pQuestMembershipBySlug(slug: string): F2PQuestMembership | undefined;
```

Validation must enforce schema version `1`, date `2026-08-21`, the two exact evidence paths, 23 records, unique IDs/slugs, exact contiguous priority, wave distribution `5/5/5/5/3`, exact `wikiTitle`, exact `evidenceQuestId`, and the approved quest order. Deep-freeze the validated snapshot before exporting it.

- [ ] **Step 5: Run the focused test**

```cmd
npx vitest run data/f2pQuestMembership.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the membership boundary**

```cmd
git add -- data/sources/f2p-quest-membership.json data/f2pQuestMembership.ts data/f2pQuestMembership.test.ts
git commit -m "data: add reviewed F2P quest membership"
```

---

### Task 2: Generalize the walkthrough source pipeline to independent quest packs

**Files:**
- Modify: `scripts/quest-walkthrough-source.mjs`
- Modify: `scripts/sync-quest-walkthroughs.mjs`
- Modify: `scripts/quest-walkthrough-source.test.ts`
- Modify: `data/questWalkthroughs.ts`
- Modify: `data/questWalkthroughs.test.ts`

**Interfaces:**
- Consumes: Task 1 membership records, the retained Elemental Workshop I pilot, the existing reviewed source/review/generated files, the pinned Chunk Picker commit, and official Wiki revision responses.
- Produces: `extractQuestTasks(chunkPicker, questIds, tasksMap)`, `parseWalkthroughSyncArgs(argv)`, and selected refresh through `--quest-id=<membership-slug>`.

- [ ] **Step 1: Write failing pipeline-generalization tests**

Replace four-pilot assertions with these boundaries:

```ts
expect(extractQuestTasks(chunkPickerFixture(), ["Cook's Assistant", 'Sheep Shearer']))
  .toEqual(expect.objectContaining({
    "Cook's Assistant": expect.any(Array),
    'Sheep Shearer': expect.any(Array),
  }));

expect(parseWalkthroughSyncArgs(['--refresh', '--quest-id=sheep-shearer'])).toEqual({
  mode: 'refresh',
  questIds: ['sheep-shearer'],
});
expect(() => parseWalkthroughSyncArgs(['--check', '--quest-id=sheep-shearer']))
  .toThrow(/quest-id.*refresh/i);
expect(() => parseWalkthroughSyncArgs(['--refresh', '--quest-id=elemental-workshop-i']))
  .toThrow(/F2P membership/i);
```

Add an injected refresh test proving a Sheep Shearer candidate contains the existing four source records plus Sheep Shearer, while the committed source, review, and generated files remain byte-identical. Add a promotion test proving the fifth record is accepted only after source-line digests, reviewed actions, and task dependencies agree.

- [ ] **Step 2: Run the focused pipeline test**

```cmd
npx vitest run scripts/quest-walkthrough-source.test.ts data/questWalkthroughs.test.ts
```

Expected: FAIL on the hard-coded `PILOT_QUESTS`, exact-four catalogue assertion, and unsupported CLI argument.

- [ ] **Step 3: Replace pilot extraction with explicit quest extraction**

In `scripts/quest-walkthrough-source.mjs`, replace the exported constant and function with:

```js
export function extractQuestTasks(chunkPicker, questIds, tasksMap = undefined) {
  const result = Object.fromEntries(questIds.map(questId => [questId, []]));
  // Keep the existing exact task parsing, ID mapping, graph validation, and stable ordering.
  // Select only tasks whose BaseQuest occurs in questIds.
  return result;
}
```

Reject duplicate or blank requested IDs. Keep task ID conversion, dependency validation, pinned mapping checks, and deterministic output unchanged.

- [ ] **Step 4: Add selected membership refresh**

In `scripts/sync-quest-walkthroughs.mjs`, add membership to `DEFAULT_PATHS`, parse `--quest-id=<slug>`, and resolve each slug through the Task 1 JSON. `--check` and `--promote` accept no quest IDs. `--refresh` with no quest IDs refreshes only the existing source records; with quest IDs it appends missing selected membership records to the candidate in progression-priority order.

Use this stable parser result:

```js
export function parseWalkthroughSyncArgs(argv = process.argv.slice(2)) {
  return { mode, questIds };
}
```

The refresh path must fetch only official Wiki API revisions for each record's exact `wikiTitle`, read only the pinned Chunk Picker commit, and write only `quest-walkthrough-candidate.json`. Promotion remains offline and atomic.

- [ ] **Step 5: Make source and review validation subset-aware**

Validation must enforce:

```js
const allowedQuestIds = new Set([
  ...membership.quests.map(entry => entry.questId),
  'Elemental Workshop I',
]);
```

Require unique source IDs, require review keys to exactly match current source IDs, require every F2P source ID to occur in membership, retain Elemental Workshop I only as the existing legacy pilot, and reject every other ID. Remove exact-four counts and messages. Preserve source order as committed; objective order comes from membership priority, not JSON insertion order.

- [ ] **Step 6: Generalize runtime generated-catalogue validation**

In `data/questWalkthroughs.ts`, remove `PILOT_QUEST_IDS` and the exact-four final assertion. Validate each generated definition against membership or the one retained legacy pilot, retain duplicate detection, and require at least one definition. Export a readonly `questWalkthroughCatalogue` in addition to `questWalkthroughFor` so the preview boundary can compile strategies without importing raw JSON elsewhere.

- [ ] **Step 7: Run the focused pipeline tests**

```cmd
npx vitest run scripts/quest-walkthrough-source.test.ts data/questWalkthroughs.test.ts
npm run walkthroughs:verify
```

Expected: PASS against the unchanged four-record committed catalogue.

- [ ] **Step 8: Commit the generalized pipeline**

```cmd
git add -- scripts/quest-walkthrough-source.mjs scripts/sync-quest-walkthroughs.mjs scripts/quest-walkthrough-source.test.ts data/questWalkthroughs.ts data/questWalkthroughs.test.ts
git commit -m "feat: generalize RuneProof quest pack pipeline"
```

---

### Task 3: Enforce the full pack contract and preserve multi-quest progress

**Files:**
- Modify: `utils/questWalkthroughs/model.ts`
- Modify: `utils/questStrategies/model.ts`
- Modify: `utils/questStrategies/model.test.ts`
- Modify: `scripts/quest-walkthrough-source.mjs`
- Modify: `scripts/quest-walkthrough-source.test.ts`
- Modify: `data/sources/quest-walkthrough-review.json`
- Modify: `data/questWalkthroughs.generated.json`
- Modify: `data/questWalkthroughRelease.ts`
- Modify: `data/questWalkthroughs.preview-boundary.ts`
- Modify: `data/questWalkthroughLoader.ts`
- Modify: `utils/questStrategies/previewActions.ts`
- Modify: `utils/questStrategies/previewActions.test.ts`
- Modify: `hooks/useRuneProofPreviewActions.ts`
- Modify: `hooks/useRuneProofPreviewActions.test.tsx`

**Interfaces:**
- Consumes: membership metadata, reviewed root item requirements, generated walkthroughs, and existing storage key `fate_runeproof_preview_actions_v1:<runId>`.
- Produces: strict `QuestStrategyDefinition`, `questStrategyFor`, `questStrategyCatalogue`, `loadQuestStrategyFor`, `loadQuestStrategyCatalogue`, and catalogue-scoped preview action controls.

- [ ] **Step 1: Write failing pack-contract tests**

Add cases that reject a strategy with an action lacking a chunk-bearing `REVIEWED_ALIAS` or `EXPLICIT_CHUNKS`, a consumed item that was neither produced earlier nor declared as a root requirement, multiple `QUEST_COMPLETED` actions, an early final action, a final quest ID mismatch, missing membership, or missing `consumes`.

Assert the accepted shape includes membership metadata:

```ts
expect(strategy).toMatchObject({
  questId: "Cook's Assistant",
  kind: 'quest',
  rolloutWave: 1,
  progressionPriority: 1,
});
expect(strategy?.actions.every(action => action.mapChunks.length > 0)).toBe(true);
expect(strategy?.actions.at(-1)?.coach.completion).toEqual({
  kind: 'QUEST_COMPLETED',
  questId: "Cook's Assistant",
});
```

- [ ] **Step 2: Write failing multi-quest persistence tests**

Use a catalogue containing Cook's Assistant and Sheep Shearer:

```ts
const normalized = normalizeRuneProofPreviewActions({
  "Cook's Assistant": ['cooks-assistant:complete'],
  'Sheep Shearer': ['sheep-shearer:start-with-fred'],
  'Unknown Quest': ['unknown:action'],
}, catalogue);

expect(normalized).toEqual({
  "Cook's Assistant": ['cooks-assistant:complete'],
  'Sheep Shearer': ['sheep-shearer:start-with-fred'],
});
```

In the hook test, confirm one action in each quest, switch the active quest twice, remount, and assert both arrays survive under the unchanged v1 key. Assert the existing Cook final action remains readable so Alex's accepted 9/9 preview is not lost.

- [ ] **Step 3: Extend the coach action data contract**

Add required consumed item flow:

```ts
export interface QuestActionCoachMetadata {
  readonly consumes: readonly WalkthroughItemRef[];
  readonly fulfils: readonly WalkthroughItemRef[];
  readonly completion: QuestActionCompletionRule;
  readonly preferredMethod?: QuestActionPreferredMethod;
  readonly fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES' | 'INTERCHANGEABLE' | 'NONE';
}
```

Add `consumes` to every Cook's Assistant coach action. Record Bucket for `milk-cow`, Grain and Pot for `make-flour`, and Bucket of milk, Egg, and Pot of flour for `return-to-cook`; use empty arrays for the other Cook actions.

- [ ] **Step 4: Require reviewed chunks and valid pack completion**

Use this strategy context and output:

```ts
export interface QuestStrategyContext {
  readonly membership: F2PQuestMembership;
  readonly rootRequirements: readonly QuestItemRequirement[];
}

export interface QuestStrategyDefinition {
  readonly questId: string;
  readonly kind: F2PQuestMembership['kind'];
  readonly rolloutWave: F2PQuestMembership['wave'];
  readonly progressionPriority: number;
  readonly revision: string;
  readonly source: QuestWalkthroughDefinition['source'];
  readonly sourceLines: QuestWalkthroughDefinition['sourceLines'];
  readonly actions: readonly (QuestStrategyAction & { readonly mapChunks: readonly ChunkKey[] })[];
}

export function questStrategyFromWalkthrough(
  walkthrough: QuestWalkthroughDefinition,
  context: QuestStrategyContext,
): QuestStrategyDefinition | null;
```

Convert Cook's start and return locations from `EXACT_ENTITY` to reviewed chunk aliases at `50,50`, retaining the Cook entity and evidence. Require every strategy action to carry a non-empty static chunk list; validate consumes/fulfils keys and quantities; validate consumed items against earlier fulfils or root requirements; and require exactly one matching `QUEST_COMPLETED` rule on the final action.

- [ ] **Step 5: Apply the same validation in the Node compiler**

Extend `validateCoachMetadata` and `validateCoachActions` to enforce `consumes`, static reviewed chunks, item flow, and final completion before hashing. Keep non-coach legacy walkthroughs valid but strategy-ineligible.

- [ ] **Step 6: Expose strategies only through the preview boundary**

In `data/questWalkthroughs.preview-boundary.ts`, compile the immutable catalogue by joining each walkthrough to membership and root requirements:

```ts
export const questStrategyCatalogue: readonly QuestStrategyDefinition[];
export const questStrategyFor = (questId: string): QuestStrategyDefinition | undefined =>
  questStrategyCatalogue.find(strategy => strategy.questId === questId);
```

Include a strategy only when `questWalkthroughReleaseFor(walkthrough.questId)` exists and its revision exactly equals the walkthrough revision. This keeps source-complete but unreleased drafts out of selection and recommendation.

Add these loaders:

```ts
export async function loadQuestStrategyFor(
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestStrategyDefinition | undefined>;

export async function loadQuestStrategyCatalogue(
  availability: RuneProofAvailability,
): Promise<readonly QuestStrategyDefinition[]>;
```

Both return no preview data when availability is not `PREVIEW`. Individual loading must still require exact release revision agreement.

- [ ] **Step 7: Make action progress catalogue-scoped**

Change normalization and the hook to these signatures:

```ts
export function normalizeRuneProofPreviewActions(
  value: unknown,
  strategies: readonly QuestStrategyDefinition[],
): RuneProofPreviewActions;

export interface RuneProofPreviewActionControls {
  readonly actionsByQuest: RuneProofPreviewActions;
  confirmedActionIdsFor(questId: string): ReadonlySet<string>;
  setActionConfirmed(questId: string, actionId: string, confirmed: boolean): void;
}

export function useRuneProofPreviewActions(
  runId: string,
  strategies: readonly QuestStrategyDefinition[],
  storage?: RuneProofStorage,
): RuneProofPreviewActionControls;
```

Preserve all valid strategy records on every write, remove unknown quests/actions and inherited properties, keep the 64 KiB limit, and preserve in-memory interaction on storage failure.

- [ ] **Step 8: Regenerate Cook and update its release revision**

```cmd
node scripts/sync-quest-walkthroughs.mjs --promote
npm run walkthroughs:verify
```

Update Cook's Assistant in `data/questWalkthroughRelease.ts` to the new generated revision. Action IDs and count must remain unchanged.

- [ ] **Step 9: Run the focused contract and storage tests**

```cmd
npx vitest run utils/questStrategies/model.test.ts scripts/quest-walkthrough-source.test.ts utils/questStrategies/previewActions.test.ts hooks/useRuneProofPreviewActions.test.tsx data/questWalkthroughs.test.ts
```

Expected: PASS, including retained Cook completion after remount.

- [ ] **Step 10: Commit the strict pack boundary**

```cmd
git add -- utils/questWalkthroughs/model.ts utils/questStrategies/model.ts utils/questStrategies/model.test.ts scripts/quest-walkthrough-source.mjs scripts/quest-walkthrough-source.test.ts data/sources/quest-walkthrough-review.json data/questWalkthroughs.generated.json data/questWalkthroughRelease.ts data/questWalkthroughs.preview-boundary.ts data/questWalkthroughLoader.ts utils/questStrategies/previewActions.ts utils/questStrategies/previewActions.test.ts hooks/useRuneProofPreviewActions.ts hooks/useRuneProofPreviewActions.test.tsx
git commit -m "feat: enforce RuneProof quest pack contract"
```

---

### Task 4: Add Wave 1 item requirements and the Sheep Shearer item chain

**Files:**
- Modify: `data/questItemRequirements.ts`
- Modify: `data/questItemRequirements.test.ts`
- Modify: `data/questRouteRecipes.ts`
- Modify: `data/questRouteRecipes.test.ts`
- Modify: `utils/questRoutes/analyzeQuest.test.ts`

**Interfaces:**
- Consumes: current item resolver, exact entity lookup, and pinned quest revisions in `quest-requirement-audit.json`.
- Produces: reviewed root requirements for the four new quests, recipe IDs `shear-sheep` and `spin-wool`, and complete transformation coverage for Wool and Ball of wool.

- [ ] **Step 1: Write failing requirement tests**

```ts
expect(reviewedQuestRequirements('Sheep Shearer')).toMatchObject({
  wikiRevision: '15271780',
  reviewedAt: '2026-08-21',
  items: [{
    item: { key: 'ball of wool', name: 'Ball of wool' },
    quantity: 20,
    supplyPolicy: 'PLAYER_OBTAINED',
  }],
});
expect(reviewedQuestRequirements('The Restless Ghost')?.items).toEqual([]);
expect(reviewedQuestRequirements('Rune Mysteries')?.items).toEqual([]);
expect(reviewedQuestRequirements('Imp Catcher')?.items).toEqual([
  expect.objectContaining({ item: { key: 'black bead', name: 'Black bead' }, quantity: 1 }),
  expect.objectContaining({ item: { key: 'red bead', name: 'Red bead' }, quantity: 1 }),
  expect.objectContaining({ item: { key: 'white bead', name: 'White bead' }, quantity: 1 }),
  expect.objectContaining({ item: { key: 'yellow bead', name: 'Yellow bead' }, quantity: 1 }),
]);
```

Pin Restless Ghost to revision `15268042`, Rune Mysteries to `15275863`, and Imp Catcher to `15266902`; use review date `2026-08-21` for all four.

- [ ] **Step 2: Write failing recipe tests**

```ts
expect(recipesFor('wool')).toContainEqual(expect.objectContaining({
  id: 'shear-sheep',
  kind: 'GATHER',
  outputQuantity: 1,
  tools: [expect.objectContaining({
    item: { key: 'shears', name: 'Shears' },
    consumed: false,
  })],
  stations: [{ entityKind: 'npc', names: ['Sheep'] }],
  deterministic: true,
  sourceRevision: '15271780',
}));
expect(recipesFor('ball of wool')).toContainEqual(expect.objectContaining({
  id: 'spin-wool',
  kind: 'RECIPE',
  outputQuantity: 1,
  ingredients: [{ item: { key: 'wool', name: 'Wool' }, quantity: 1 }],
  stations: [{ entityKind: 'object', names: ['Spinning wheel'] }],
  deterministic: true,
  sourceRevision: '15271780',
}));
expect(transformationCoverageFor('wool')).toBe('COMPLETE');
expect(transformationCoverageFor('ball of wool')).toBe('COMPLETE');
```

- [ ] **Step 3: Run focused tests and verify the catalogue gaps**

```cmd
npx vitest run data/questItemRequirements.test.ts data/questRouteRecipes.test.ts utils/questRoutes/analyzeQuest.test.ts
```

Expected: FAIL because the four requirements and two transformations are missing and empty item arrays are rejected.

- [ ] **Step 4: Add the exact requirements and recipes**

Add the four requirement records in Step 1. Remove only the `items.length` rejection from `validateReviewedQuestCatalogue`; retain all source, date, key, quantity, policy, and alternative validation.

Add these two recipes:

```ts
{
  id: 'shear-sheep', kind: 'GATHER', output: item('Wool'), outputQuantity: 1,
  ingredients: [],
  tools: [{ item: item('Shears'), consumed: false }],
  stations: [{ entityKind: 'npc', names: ['Sheep'] }],
  gates: [], deterministic: true, sourceRevision: '15271780',
},
{
  id: 'spin-wool', kind: 'RECIPE', output: item('Ball of wool'), outputQuantity: 1,
  ingredients: [{ item: item('Wool'), quantity: 1 }],
  tools: [],
  stations: [{ entityKind: 'object', names: ['Spinning wheel'] }],
  gates: [], deterministic: true, sourceRevision: '15271780',
},
```

Add `wool` and `ball of wool` to `COMPLETE_TRANSFORMATION_OUTPUTS`.

- [ ] **Step 5: Prove empty-root and Imp analyses**

In `analyzeQuest.test.ts`, assert Restless Ghost and Rune Mysteries return `items: []` without throwing. Assert Imp Catcher preserves four requirements in black/red/white/yellow order and can enumerate Imp drop routes without making one generic drop the reviewed preferred quest action.

- [ ] **Step 6: Run focused tests**

```cmd
npx vitest run data/questItemRequirements.test.ts data/questRouteRecipes.test.ts utils/questRoutes/analyzeQuest.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the Wave 1 item model**

```cmd
git add -- data/questItemRequirements.ts data/questItemRequirements.test.ts data/questRouteRecipes.ts data/questRouteRecipes.test.ts utils/questRoutes/analyzeQuest.test.ts
git commit -m "data: add RuneProof Wave 1 item routes"
```

---

### Task 5: Author the Sheep Shearer quest pack

**Files:**
- Modify: `data/sources/quest-walkthrough-sources.json`
- Modify: `data/sources/quest-walkthrough-review.json`
- Modify: `data/questWalkthroughs.generated.json`
- Modify: `data/questWalkthroughRelease.ts`
- Create: `data/questWalkthroughs.wave1.test.ts`
- Modify: `utils/questStrategies/coach.test.ts`

**Interfaces:**
- Consumes: selected refresh from Task 2, the Task 3 pack contract, and Task 4 sheep transformations.
- Produces: five-action strategy `Sheep Shearer`, reviewable only in preview.

- [ ] **Step 1: Refresh a pinned Sheep Shearer candidate**

```cmd
npm run walkthroughs:refresh -- --quest-id=sheep-shearer
```

Expected: candidate contains the current reviewed catalogue plus Sheep Shearer, with a permanent official Wiki quick-guide revision, source lines, pinned task records, and no committed-file changes.

- [ ] **Step 2: Write the failing exact-pack test**

```ts
expect(strategyFor('Sheep Shearer').actions.map(action => ({
  id: action.id,
  chunk: action.mapChunks[0],
  instruction: action.displayText,
}))).toEqual([
  { id: 'sheep-shearer:start-with-fred', chunk: '49,51', instruction: 'Talk to Fred the Farmer north of Lumbridge and ask for a quest.' },
  { id: 'sheep-shearer:shear-wool', chunk: '49,51', instruction: "Use Fred's shears to collect 20 wool from the sheep in his pen." },
  { id: 'sheep-shearer:spin-wool', chunk: '50,50', instruction: 'Spin the 20 wool into 20 balls of wool upstairs in Lumbridge Castle.' },
  { id: 'sheep-shearer:return-to-fred', chunk: '49,51', instruction: 'Return to Fred the Farmer with 20 unnoted balls of wool.' },
  { id: 'sheep-shearer:complete', chunk: '49,51', instruction: 'Sheep Shearer complete.' },
]);
```

Assert source orders `1..5`, dependencies form one chain, progress is `0/5`, and only the final action uses `QUEST_COMPLETED`.

Define the shared helpers in the new test file so later quest tasks use concrete interfaces:

```ts
const strategyFor = (questId: string): QuestStrategyDefinition => {
  const strategy = questStrategyFor(questId);
  if (!strategy) throw new Error(`Missing Wave 1 strategy: ${questId}`);
  return strategy;
};

const actionSummary = (questId: string): [string, string, string][] =>
  strategyFor(questId).actions.map(action => [
    action.id,
    action.mapChunks[0],
    action.displayText,
  ]);
```

- [ ] **Step 3: Review and encode the five actions**

Use reviewed aliases for Fred's farm/sheep pen at `49,51` and Lumbridge Castle at `50,50`. Evidence must pair the pinned quick-guide lines with the pinned content/audit location; rationale must claim chunk precision only.

Use this item and method contract:

| Action | Consumes | Fulfils | Preferred method | Completion | Fallback |
|---|---|---|---|---|---|
| start-with-fred | none | 1 Shears, quest-provided | none | MANUAL | NONE |
| shear-wool | none | 20 Wool, player-obtained | `shear-sheep` | MANUAL | NONE |
| spin-wool | 20 Wool | 20 Ball of wool, player-obtained | `spin-wool` | ITEM_CONFIRMED `ball of wool` | BLOCK_THEN_ALTERNATIVES |
| return-to-fred | 20 Ball of wool | none | none | MANUAL | NONE |
| complete | none | none | none | QUEST_COMPLETED `Sheep Shearer` | NONE |

Declare one quest-provided Shears requirement in `shear-wool.items`; it is reusable and therefore does not occur in `consumes`.

Consume every imported source line exactly once, record exact source-line digests, and preserve direct task dependency edges.

- [ ] **Step 4: Promote and pin the release revision**

```cmd
node scripts/sync-quest-walkthroughs.mjs --promote
npm run walkthroughs:verify
```

Add the generated Sheep Shearer revision to `questWalkthroughRelease.ts` with `PREVIEW_ONLY`.

- [ ] **Step 5: Run pack and coach tests**

```cmd
npx vitest run data/questWalkthroughs.wave1.test.ts utils/questStrategies/model.test.ts utils/questStrategies/coach.test.ts scripts/quest-walkthrough-source.test.ts
```

Expected: PASS. Confirming `ball of wool` completes the spin action but not the return or final confirmation.

- [ ] **Step 6: Commit Sheep Shearer**

```cmd
git add -- data/sources/quest-walkthrough-sources.json data/sources/quest-walkthrough-review.json data/questWalkthroughs.generated.json data/questWalkthroughRelease.ts data/questWalkthroughs.wave1.test.ts utils/questStrategies/coach.test.ts
git commit -m "data: add Sheep Shearer RuneProof pack"
```

---

### Task 6: Author The Restless Ghost quest pack

**Files:**
- Modify: `data/sources/quest-walkthrough-sources.json`
- Modify: `data/sources/quest-walkthrough-review.json`
- Modify: `data/questWalkthroughs.generated.json`
- Modify: `data/questWalkthroughRelease.ts`
- Modify: `data/questWalkthroughs.wave1.test.ts`
- Modify: `utils/questStrategies/coach.test.ts`

**Interfaces:**
- Consumes: strict pack compiler and empty root-item analysis.
- Produces: seven-action strategy `The Restless Ghost`, including the avoidable skeleton instruction.

- [ ] **Step 1: Refresh the selected candidate**

```cmd
npm run walkthroughs:refresh -- --quest-id=the-restless-ghost
```

- [ ] **Step 2: Write the failing exact-pack test**

Assert this exact action contract:

```ts
expect(actionSummary('The Restless Ghost')).toEqual([
  ['the-restless-ghost:start-with-aereck', '50,50', 'Talk to Father Aereck in Lumbridge church to start the quest.'],
  ['the-restless-ghost:get-amulet', '49,49', 'Talk to Father Urhney in the western Lumbridge Swamp and take the ghostspeak amulet.'],
  ['the-restless-ghost:talk-to-ghost', '50,49', 'Equip the ghostspeak amulet and talk to the ghost in Lumbridge graveyard.'],
  ['the-restless-ghost:take-skull', '48,49', "Search the altar in the Wizards' Tower basement for the ghost's skull, then leave without fighting the skeleton."],
  ['the-restless-ghost:return-to-ghost', '50,49', 'Return to the restless ghost with its skull.'],
  ['the-restless-ghost:use-skull', '50,49', "Use the ghost's skull on the coffin in Lumbridge graveyard."],
  ['the-restless-ghost:complete', '50,49', 'The Restless Ghost complete.'],
]);
```

- [ ] **Step 3: Encode reviewed locations and item flow**

Use aliases `Lumbridge church` `50,50`, `Father Urhney's house` `49,49`, `Lumbridge graveyard` `50,49`, and `Wizards' Tower` `48,49`. Cite the selected quick-guide revision and the pinned location evidence. Do not add a kill requirement: the skull instruction explicitly says the level 13 skeleton may be avoided.

Use `get-amulet` to fulfil one quest-provided Ghostspeak amulet, `take-skull` to fulfil one quest-provided Ghost's skull, and `use-skull` to consume the skull. All non-final actions are `MANUAL`, all fallbacks are `NONE`, and the final action is `QUEST_COMPLETED` for The Restless Ghost.

Declare the Ghostspeak amulet in `talk-to-ghost.items` as quest-provided. It is equipped but not consumed.

- [ ] **Step 4: Promote and pin the release revision**

```cmd
node scripts/sync-quest-walkthroughs.mjs --promote
npm run walkthroughs:verify
```

Add the exact generated revision as `PREVIEW_ONLY`.

- [ ] **Step 5: Run pack and blocker tests**

```cmd
npx vitest run data/questWalkthroughs.wave1.test.ts utils/questStrategies/coach.test.ts scripts/quest-walkthrough-source.test.ts
```

Expected: PASS. With `48,49` locked, the skull action says to unlock `48,49`; it never says the skeleton must be killed.

- [ ] **Step 6: Commit The Restless Ghost**

```cmd
git add -- data/sources/quest-walkthrough-sources.json data/sources/quest-walkthrough-review.json data/questWalkthroughs.generated.json data/questWalkthroughRelease.ts data/questWalkthroughs.wave1.test.ts utils/questStrategies/coach.test.ts
git commit -m "data: add Restless Ghost RuneProof pack"
```

---

### Task 7: Author the Rune Mysteries quest pack

**Files:**
- Modify: `data/sources/quest-walkthrough-sources.json`
- Modify: `data/sources/quest-walkthrough-review.json`
- Modify: `data/questWalkthroughs.generated.json`
- Modify: `data/questWalkthroughRelease.ts`
- Modify: `data/questWalkthroughs.wave1.test.ts`
- Modify: `utils/questStrategies/coach.test.ts`

**Interfaces:**
- Consumes: strict quest-provided item-flow validation.
- Produces: five-action Lumbridge–Wizards' Tower–Varrock hand-off strategy.

- [ ] **Step 1: Refresh the selected candidate**

```cmd
npm run walkthroughs:refresh -- --quest-id=rune-mysteries
```

- [ ] **Step 2: Write the failing exact-pack test**

```ts
expect(actionSummary('Rune Mysteries')).toEqual([
  ['rune-mysteries:start-with-duke', '50,50', 'Ask Duke Horacio in Lumbridge Castle for a quest and take the air talisman.'],
  ['rune-mysteries:take-talisman-to-sedridor', '48,49', "Give the air talisman to Archmage Sedridor in the Wizards' Tower basement."],
  ['rune-mysteries:take-package-to-aubury', '50,53', "Take Sedridor's research package to Aubury in the Varrock rune shop."],
  ['rune-mysteries:return-notes-to-sedridor', '48,49', "Return Aubury's research notes to Sedridor in the Wizards' Tower basement."],
  ['rune-mysteries:complete', '48,49', 'Rune Mysteries complete.'],
]);
```

- [ ] **Step 3: Encode the reviewed hand-off chain**

Use Lumbridge Castle `50,50`, Wizards' Tower `48,49`, and Aubury's rune shop `50,53` for every step. Item flow is exact:

```text
start-with-duke fulfils 1 Air talisman
take-talisman-to-sedridor consumes 1 Air talisman and fulfils 1 Research package
take-package-to-aubury consumes 1 Research package and fulfils 1 Research notes
return-notes-to-sedridor consumes 1 Research notes
complete confirms Rune Mysteries
```

Mark all three hand-off items `QUEST_PROVIDED`, use `MANUAL` before the final confirmation, and use fallback `NONE` throughout.

- [ ] **Step 4: Promote and pin the release revision**

```cmd
node scripts/sync-quest-walkthroughs.mjs --promote
npm run walkthroughs:verify
```

Add the generated revision as `PREVIEW_ONLY`.

- [ ] **Step 5: Run pack and flow tests**

```cmd
npx vitest run data/questWalkthroughs.wave1.test.ts utils/questStrategies/model.test.ts utils/questStrategies/coach.test.ts scripts/quest-walkthrough-source.test.ts
```

Expected: PASS, including compiler rejection when any hand-off is reordered or removed.

- [ ] **Step 6: Commit Rune Mysteries**

```cmd
git add -- data/sources/quest-walkthrough-sources.json data/sources/quest-walkthrough-review.json data/questWalkthroughs.generated.json data/questWalkthroughRelease.ts data/questWalkthroughs.wave1.test.ts utils/questStrategies/coach.test.ts
git commit -m "data: add Rune Mysteries RuneProof pack"
```

---

### Task 8: Author the Imp Catcher quest pack

**Files:**
- Modify: `data/sources/quest-walkthrough-sources.json`
- Modify: `data/sources/quest-walkthrough-review.json`
- Modify: `data/questWalkthroughs.generated.json`
- Modify: `data/questWalkthroughRelease.ts`
- Modify: `data/questWalkthroughs.wave1.test.ts`
- Modify: `utils/questStrategies/coach.test.ts`

**Interfaces:**
- Consumes: four reviewed bead requirements, generic Imp drop evidence, and independent action completion.
- Produces: six-action strategy with a reviewed south-Falador method and unlocked-chunk alternatives.

- [ ] **Step 1: Refresh the selected candidate**

```cmd
npm run walkthroughs:refresh -- --quest-id=imp-catcher
```

- [ ] **Step 2: Write the failing exact-pack test**

```ts
expect(actionSummary('Imp Catcher')).toEqual([
  ['imp-catcher:get-black-bead', '47,51', 'Kill imps south-east of Falador until you obtain a black bead.'],
  ['imp-catcher:get-red-bead', '47,51', 'Kill imps south-east of Falador until you obtain a red bead.'],
  ['imp-catcher:get-white-bead', '47,51', 'Kill imps south-east of Falador until you obtain a white bead.'],
  ['imp-catcher:get-yellow-bead', '47,51', 'Kill imps south-east of Falador until you obtain a yellow bead.'],
  ['imp-catcher:give-beads-to-mizgog', '48,49', "Take all four beads to Wizard Mizgog on the top floor of the Wizards' Tower."],
  ['imp-catcher:complete', '48,49', 'Imp Catcher complete.'],
]);
```

- [ ] **Step 3: Encode independent bead acquisition**

All four bead actions have no dependencies on one another. Each fulfils its matching player-obtained bead, uses `ITEM_CONFIRMED`, uses a reviewed `DIRECT_SOURCE` labelled `Imps south-east of Falador`, and uses `INTERCHANGEABLE` so other legal Imp locations remain secondary choices. Use reviewed alias `South-east Falador` at `47,51`, citing the F2P quick-guide recommendation plus the pinned `47,51` Imp content entry.

The Mizgog action depends on all four bead actions and consumes one black, red, white, and yellow bead. It is `MANUAL`, fallback `NONE`, and uses Wizards' Tower `48,49`. The final action depends on Mizgog and uses `QUEST_COMPLETED` for Imp Catcher.

- [ ] **Step 4: Add out-of-order progress and blocker tests**

```ts
const yellowOnly = buildImpCoach({ confirmedItemKeys: new Set(['yellow bead']) });
expect(yellowOnly.actions.find(action => action.id === 'imp-catcher:get-yellow-bead')?.state)
  .toBe('COMPLETED');
expect(yellowOnly.actions.find(action => action.id === 'imp-catcher:get-black-bead')?.state)
  .not.toBe('COMPLETED');
```

Define `buildImpCoach` in `utils/questStrategies/coach.test.ts` as a fixture wrapper around `buildRuneProofCoachModel`. Import `questStrategyFor` from `data/questWalkthroughs.preview-boundary`, require its `Imp Catcher` result, accept partial overrides for `confirmedItemKeys`, `confirmedActionIds`, completed quests, analysis, and connect graph, and default every omitted set to empty.

With `47,51` locked and another unlocked Imp source available, assert the primary card explains the `47,51` blocker before `Other legal sources` exposes the alternative.

- [ ] **Step 5: Promote and pin the release revision**

```cmd
node scripts/sync-quest-walkthroughs.mjs --promote
npm run walkthroughs:verify
```

Add the generated revision as `PREVIEW_ONLY`.

- [ ] **Step 6: Run pack, progress, and alternative tests**

```cmd
npx vitest run data/questWalkthroughs.wave1.test.ts utils/questStrategies/coach.test.ts utils/questRoutes/analyzeQuest.test.ts scripts/quest-walkthrough-source.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Imp Catcher**

```cmd
git add -- data/sources/quest-walkthrough-sources.json data/sources/quest-walkthrough-review.json data/questWalkthroughs.generated.json data/questWalkthroughRelease.ts data/questWalkthroughs.wave1.test.ts utils/questStrategies/coach.test.ts
git commit -m "data: add Imp Catcher RuneProof pack"
```

---

### Task 9: Add deterministic multi-objective routing to the shared coach

**Files:**
- Create: `utils/questStrategies/objectives.ts`
- Create: `utils/questStrategies/objectives.test.ts`
- Create: `components/questStrategies/RuneProofObjectivePicker.tsx`
- Create: `components/questStrategies/RuneProofObjectivePicker.test.tsx`
- Modify: `components/GoalPlannerModal.tsx`
- Modify: `components/GoalPlannerModal.runeproof.test.tsx`
- Modify: `components/questStrategies/RuneProofCoach.test.tsx`

**Interfaces:**
- Consumes: `loadQuestStrategyCatalogue`, canonical target state, catalogue-scoped preview actions, and progression priority.
- Produces: up to three supported recommendations and automatic first-objective selection when no explicit target is supplied.

- [ ] **Step 1: Write failing objective-ranking tests**

Use this public model:

```ts
export type RuneProofObjectiveReadiness = 'READY' | 'CONFIRM' | 'BLOCKED';

export interface RuneProofObjectiveCandidate {
  readonly strategy: QuestStrategyDefinition;
  readonly readiness: RuneProofObjectiveReadiness;
  readonly completed: boolean;
  readonly progress: Readonly<{ completed: number; total: number }>;
}

export interface RuneProofObjectiveRecommendation {
  readonly questId: string;
  readonly reason: string;
  readonly progress: RuneProofObjectiveCandidate['progress'];
  readonly readiness: RuneProofObjectiveReadiness;
}

export function rankRuneProofObjectives(
  candidates: readonly RuneProofObjectiveCandidate[],
  limit?: number,
): readonly RuneProofObjectiveRecommendation[];
```

Assert completed objectives are excluded; READY sorts before CONFIRM before BLOCKED; progression priority breaks readiness ties; quest ID is the final stable tie-breaker; and the default limit is three. Use exact reasons `Ready with your current unlocks.`, `Continue its reviewed route after confirming the current step.`, and `Has a reviewed route with an actionable blocker.`.

- [ ] **Step 2: Implement the pure objective ranker**

Do not run five route analyses in the picker. Adapt existing canonical target states to the three readiness values. Add a pure `questStrategyProgress(strategy, confirmedActionIds, confirmedItemKeys, completedQuestIds)` helper that applies the same manual, item-confirmed, quest-completed, and transitive-dependency rules as the coach. Use it for objective progress and treat the matching final `QUEST_COMPLETED` action as preview completion. The selected quest still receives the full RuneProof analysis and exact blocker model.

- [ ] **Step 3: Write failing picker component tests**

```ts
expect(screen.getByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();
expect(screen.getAllByRole('button')).toHaveLength(3);
await user.click(screen.getByRole('button', { name: /Sheep Shearer/i }));
expect(onSelect).toHaveBeenCalledWith('Sheep Shearer');
expect(screen.queryByText('Cook\'s Assistant')).toBeNull(); // completed fixture
```

Each button must show quest name, reason, and progress; readiness cannot rely on colour alone.

- [ ] **Step 4: Implement the objective picker**

Render `RuneProofObjectivePicker` above the normal search list in preview mode. It consumes only ranked recommendations and `onSelect(questId)`. Keep the full Goal Planner target search available for unsupported targets.

- [ ] **Step 5: Load catalogue and progress once at the modal boundary**

Load the preview strategy catalogue when the modal opens. Pass the whole catalogue to `useRuneProofPreviewActions`, pass the selected quest's confirmed action set to the coach workspace, and call `previewChecks.confirmedItemKeys(questId)` when calculating each objective's progress. Remove the per-workspace hook call so switching quests cannot discard another quest's progress.

When there is no `initialTarget`, select the first ranked recommendation after catalogue load. Preserve an explicit `initialTarget` even when unsupported so ordinary Goal Planner behavior remains unchanged.

- [ ] **Step 6: Add integration tests for all five strategies**

Assert:

```ts
expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
expect(screen.getByRole('region', { name: 'Recommended RuneProof quests' })).toBeTruthy();
```

Then select every Wave 1 quest, assert its expected total `9`, `5`, `7`, `5`, or `6`, confirm one action, switch away and back, and assert progress persists. Confirm Cook completely in preview, reopen the modal, and assert Sheep Shearer becomes the first recommendation while canonical Journal and key displays remain unchanged.

- [ ] **Step 7: Run objective and UI tests**

```cmd
npx vitest run utils/questStrategies/objectives.test.ts components/questStrategies/RuneProofObjectivePicker.test.tsx components/GoalPlannerModal.runeproof.test.tsx components/questStrategies/RuneProofCoach.test.tsx hooks/useRuneProofPreviewActions.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit multi-objective routing**

```cmd
git add -- utils/questStrategies/objectives.ts utils/questStrategies/objectives.test.ts components/questStrategies/RuneProofObjectivePicker.tsx components/questStrategies/RuneProofObjectivePicker.test.tsx components/GoalPlannerModal.tsx components/GoalPlannerModal.runeproof.test.tsx components/questStrategies/RuneProofCoach.test.tsx
git commit -m "feat: route RuneProof Wave 1 objectives"
```

---

### Task 10: Verify Wave 1 and stop at Alex's local visual gate

**Files:**
- Create: `docs/testing/runeproof-f2p-wave-1-local-acceptance.md`
- Modify only if a verification failure identifies a defect: files owned by Tasks 1–9

**Interfaces:**
- Consumes: complete foundation and five Wave 1 strategies.
- Produces: fresh automated evidence, a running local preview, the reproducible review checklist, and the required pause before Wave 2.

- [ ] **Step 1: Write the exact acceptance checklist**

Record these scenarios in `docs/testing/runeproof-f2p-wave-1-local-acceptance.md`:

1. Normal build contains no RuneProof pack source wording and retains Goal Planner behavior.
2. Preview opens on the highest-ranked incomplete supported objective and shows no more than three recommendations.
3. Cook's Assistant still follows the accepted nine steps, nearby mill route, temporary map behavior, 9/9 final confirmation, and no keys or Journal changes.
4. Sheep Shearer shows five steps, chunks `49,51` and `50,50`, the local shear/spin route, quantity 20, map return, persistence, and final confirmation.
5. The Restless Ghost shows seven steps, all four route chunks, the avoidable-skeleton wording, map return, persistence, and final confirmation.
6. Rune Mysteries shows five ordered hand-offs across `50,50`, `48,49`, and `50,53`, map return, persistence, and final confirmation.
7. Imp Catcher shows four independently confirmable beads, south-Falador preferred guidance, locked-chunk explanation before alternatives, Wizards' Tower return, persistence, and final confirmation.
8. Switching through all five quests preserves each quest's progress after reload.
9. Closing a temporary map returns to the exact quest and active step that opened it.
10. Completing a preview route changes recommendation order but never canonical completion, keys, Fate rolls, rewards, exports, sync, or history.
11. Unsupported Daddy's Home and retained Elemental Workshop I continue through ordinary Goal Planner behavior in this wave.
12. Desktop `1440 × 900` and mobile `390 × 844` layouts have readable chunks, reachable controls, correct focus order, no overlap, and no horizontal overflow.

- [ ] **Step 2: Run the focused source and pack gate**

```cmd
npm run walkthroughs:verify
npx vitest run data/f2pQuestMembership.test.ts data/questWalkthroughs.test.ts data/questWalkthroughs.wave1.test.ts utils/questStrategies/model.test.ts utils/questStrategies/coach.test.ts utils/questStrategies/objectives.test.ts hooks/useRuneProofPreviewActions.test.tsx components/GoalPlannerModal.runeproof.test.tsx components/questStrategies/RuneProofCoach.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the full automated gate serially**

Run each command separately:

```cmd
npx vitest run --maxWorkers=1
npm run typecheck
npm run content:verify
npm run build:runeproof-preview
npm run build
git diff --check
git status --short --branch
```

Expected: every test, type, content, preview build, and normal build command passes; `git diff --check` is silent; only the acceptance checklist is uncommitted before its commit.

- [ ] **Step 4: Run the actual local preview**

Start or restart the preview with the existing RuneProof environment at `http://127.0.0.1:4175/`. Use the in-app browser to complete all twelve scenarios. Inspect the actual visible result rather than relying on DOM assertions. Capture desktop and mobile evidence for each quest's first action, one temporary map, one blocked route, one restored-progress state, and each final confirmation state.

- [ ] **Step 5: Commit the completed acceptance record**

After recording exact command results and screenshot paths:

```cmd
git add -- docs/testing/runeproof-f2p-wave-1-local-acceptance.md
git commit -m "docs: add RuneProof F2P Wave 1 acceptance"
```

- [ ] **Step 6: Present Wave 1 and pause**

Leave the verified preview running locally. Report the local URL, focused and full gate results, five quest totals, known preview limitations, and branch commits. Ask Alex to test every quest and approve or reject Wave 1.

Do not begin Wave 2, push, open a pull request, merge, deploy, release, or announce anything at this checkpoint.

---

## Completion Boundary

This plan is complete only when the reviewed membership registry and independent-pack compiler are working, all five Wave 1 strategies pass the pack contract and automated gates, the real desktop/mobile preview has been inspected, and Alex has received a running local build for review.

Wave 1 completion does **not** authorize Wave 2 or any release action. Alex's explicit visual approval is the only input that permits the next implementation plan to begin.
