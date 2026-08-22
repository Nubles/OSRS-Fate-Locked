# RuneProof Cook's Assistant Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cook's Assistant RuneProof audit panel with a local-preview progression coach that recommends the reviewed Lumbridge and Mill Lane route, explains blockers, and keeps generic sources secondary.

**Architecture:** Extend the existing reviewed walkthrough pack into a strategy-capable pack instead of creating a competing quest-data system. Add the missing wheat gathering transformation, project reviewed actions into one next-action coach model, and retain the existing resolver only for fallback alternatives and proof. Integrate the coach as the primary supported-quest surface inside a wider RuneProof workspace while preserving the ordinary Goal Planner for unsupported targets.

**Tech Stack:** React 18, TypeScript, Vite 5, Vitest 4, Testing Library, Tailwind CSS, existing RuneProof walkthrough compiler and route resolver

**Spec:** `docs/superpowers/specs/2026-08-20-runeproof-progression-coach-design.md`

## Global Constraints

- Keep RuneProof available only when `VITE_RUNEPROOF_PREVIEW=1`.
- Reviewed quest guidance is the primary route; generic item resolution is fallback and proof only.
- The Cook's Assistant mill route must outrank Black Knight and other monster-drop flour sources.
- Do not mutate canonical FLIM unlocks, quest completion, integrity history, exports, or the current main save schema.
- Keep preview progress isolated by run ID and bounded to reviewed action and item IDs.
- Do not invent exact locations; use reviewed source evidence and the pinned chunk dataset.
- Keep raw source wording, route budgets, review metadata, and data diagnostics out of the main journey.
- Preserve the existing Goal Planner for unsupported quests, diaries, and regions.
- Do not push, merge, deploy, publicly enable, or announce RuneProof without Alex's explicit approval after local visual testing.

---

## File Structure

### Existing files to extend

- `data/questRouteRecipes.ts` — add the reviewed wheat-to-grain gathering method.
- `data/questRouteRecipes.test.ts` — prove recipe identity, coverage, and validation.
- `data/sources/quest-walkthrough-review.json` — replace generic Cook's Assistant preparation placeholders with reviewed local actions and coach metadata.
- `data/questWalkthroughs.generated.json` — regenerated immutable strategy-capable walkthrough catalogue.
- `scripts/quest-walkthrough-source.mjs` — validate optional coach metadata during compilation.
- `scripts/quest-walkthrough-source.test.ts` — fail closed on malformed strategy metadata.
- `utils/questWalkthroughs/model.ts` — define the strategy metadata carried by reviewed actions.
- `utils/questRoutes/ranker.ts` — add route-origin travel and combat-risk ordering for fallback routes.
- `utils/questRoutes/ranker.test.ts` — prove origin-aware and risk-aware ordering.
- `utils/questRoutes/previewChecks.ts` — retain the existing isolated final-item confirmation contract unchanged.
- `hooks/useRuneProofPreviewChecks.ts` — retain the existing final-item controls unchanged.
- `components/GoalPlannerModal.tsx` — render the coach as the primary supported-quest surface and keep ordinary planning for unsupported targets.
- `components/GoalPlannerModal.runeproof.test.tsx` — cover workspace routing, stale requests, world-map handoff, and fallback behavior.
- `components/Dashboard.tsx` — label the preview entry RuneProof without changing normal-build copy.

### New focused files

- `utils/questStrategies/model.ts` — turn a strategy-capable walkthrough into a validated `QuestStrategyDefinition`.
- `utils/questStrategies/model.test.ts` — prove eligibility and fail-closed conversion.
- `utils/questStrategies/coach.ts` — project analysis and preview progress into objective, action, blocker, alternative, and proof view models.
- `utils/questStrategies/coach.test.ts` — prove next-action ordering and Cook's Assistant behavior.
- `utils/questStrategies/previewActions.ts` — normalize and persist action confirmations only after an exact reviewed strategy is loaded.
- `utils/questStrategies/previewActions.test.ts` — prove reviewed-ID bounds, run isolation, and corrupt-storage behavior.
- `hooks/useRuneProofPreviewActions.ts` — expose reactive action confirmation for one loaded strategy.
- `hooks/useRuneProofPreviewActions.test.tsx` — prove per-run and per-strategy action progress.
- `components/questStrategies/RuneProofCoach.tsx` — render the objective summary, next action, route timeline, blockers, and collapsed alternatives.
- `components/questStrategies/RuneProofCoach.test.tsx` — cover player-visible hierarchy and interactions.
- `components/questStrategies/RuneProofProofDrawer.tsx` — render provenance and diagnostics only when requested.
- `components/questStrategies/RuneProofProofDrawer.test.tsx` — prove technical evidence stays hidden by default.
- `components/Dashboard.runeproof.test.tsx` — prove the Dashboard entry copy changes only in preview mode.
- `docs/testing/runeproof-cooks-assistant-local-acceptance.md` — exact desktop, mobile, and run-state checks for Alex.

---

### Task 1: Restore the reviewed wheat-to-grain route

**Files:**
- Modify: `data/questRouteRecipes.ts`
- Modify: `data/questRouteRecipes.test.ts`
- Modify: `utils/questRoutes/analyzeQuest.test.ts`

**Interfaces:**
- Consumes: existing `RouteRecipe`, `routeRecipes`, `transformationCoverageFor`, and `analyzeQuestPreparation`.
- Produces: recipe ID `pick-wheat`, output item key `grain`, exact station lookup for object `Wheat`, and complete transformation coverage for `grain`.

- [ ] **Step 1: Write the failing catalogue test**

Add an assertion with the exact reviewed method:

```ts
expect(routeRecipes).toContainEqual({
  id: 'pick-wheat',
  kind: 'GATHER',
  output: { key: 'grain', name: 'Grain' },
  outputQuantity: 1,
  ingredients: [],
  tools: [],
  stations: [{ entityKind: 'object', names: ['Wheat'] }],
  gates: [],
  deterministic: true,
  sourceRevision: '15183493',
});
expect(transformationCoverageFor('grain')).toBe('COMPLETE');
```

- [ ] **Step 2: Write the failing Cook's Assistant route regression**

In `utils/questRoutes/analyzeQuest.test.ts`, build a snapshot with:

- unlocked chunks `50,50`, `50,51`, and `49,51`;
- a Pot spawn in `50,50`;
- a Black Knight flour drop in `50,50`;
- exact `Wheat` and `Hopper` objects in `49,51`; and
- recipes `pick-wheat` and `grain-to-flour`.

Assert the reviewed deterministic chain wins:

```ts
const analysis = analyzeQuestPreparation("Cook's Assistant", snapshot);
const flour = analysis.items.find(item => item.requirement.item.key === 'pot of flour');

expect(flour?.currentRoutes[0].sourceLabel).toBe('grain-to-flour');
expect(flour?.currentRoutes[0].deterministic).toBe(true);
expect(flour?.currentRoutes[0].steps.map(step => step.label)).toEqual(
  expect.arrayContaining(['Use Hopper', 'Use Wheat', 'Pot']),
);
expect(flour?.currentRoutes[0].steps.map(step => step.label)).not.toContain('Black Knight');
```

- [ ] **Step 3: Run the tests and confirm the regression fails**

Run:

```powershell
npx vitest run data/questRouteRecipes.test.ts utils/questRoutes/analyzeQuest.test.ts
```

Expected: FAIL because `pick-wheat` and complete Grain transformation coverage do not exist and the chance-based flour source remains eligible to rank first.

- [ ] **Step 4: Add the minimal reviewed gathering method**

Add this recipe immediately before `grain-to-flour`:

```ts
{
  id: 'pick-wheat',
  kind: 'GATHER',
  output: item('Grain'),
  outputQuantity: 1,
  ingredients: [],
  tools: [],
  stations: [{ entityKind: 'object', names: ['Wheat'] }],
  gates: [],
  deterministic: true,
  sourceRevision: '15183493',
},
```

Add `grain` to `COMPLETE_TRANSFORMATION_OUTPUTS`. Do not add a direct Grain spawn or hard-coded Mill Lane route; exact Wheat and Hopper locations must still come through the content snapshot.

- [ ] **Step 5: Run the focused tests**

Run:

```powershell
npx vitest run data/questRouteRecipes.test.ts utils/questRoutes/analyzeQuest.test.ts
```

Expected: PASS, including the assertion that `grain-to-flour` is the first flour route.

- [ ] **Step 6: Commit**

```powershell
git add -- data/questRouteRecipes.ts data/questRouteRecipes.test.ts utils/questRoutes/analyzeQuest.test.ts
git commit -m "fix: restore local Cook's Assistant flour route"
```

---

### Task 2: Compile strategy-capable walkthrough actions

**Files:**
- Create: `utils/questStrategies/model.ts`
- Create: `utils/questStrategies/model.test.ts`
- Modify: `utils/questWalkthroughs/model.ts`
- Modify: `scripts/quest-walkthrough-source.mjs`
- Modify: `scripts/quest-walkthrough-source.test.ts`

**Interfaces:**
- Consumes: `QuestWalkthroughDefinition`, `QuestWalkthroughActionDefinition`, canonical `ItemRef`, and the existing walkthrough compiler.
- Produces: `QuestActionCompletionRule`, `QuestActionPreferredMethod`, `QuestActionCoachMetadata`, `QuestStrategyDefinition`, and `questStrategyFromWalkthrough(walkthrough)`.

- [ ] **Step 1: Write failing strategy eligibility tests**

Create `utils/questStrategies/model.test.ts` with these cases:

```ts
it('accepts a fully reviewed ordered strategy', () => {
  const strategy = questStrategyFromWalkthrough(strategyWalkthroughFixture());
  expect(strategy?.questId).toBe("Cook's Assistant");
  expect(strategy?.actions.map(action => action.id)).toEqual([
    'cooks-assistant:start-quest',
    'cooks-assistant:take-pot',
    'cooks-assistant:take-bucket',
    'cooks-assistant:milk-cow',
    'cooks-assistant:take-egg',
    'cooks-assistant:pick-grain',
    'cooks-assistant:make-flour',
    'cooks-assistant:return-to-cook',
    'cooks-assistant:complete',
  ]);
});

it.each([
  ['missing coach metadata', walkthroughWithoutCoachMetadata()],
  ['missing dependency', walkthroughWithMissingStrategyDependency()],
  ['duplicate action ID', walkthroughWithDuplicateStrategyAction()],
  ['unknown completion item', walkthroughWithUnknownCompletionItem()],
  ['blank preferred method', walkthroughWithBlankPreferredMethod()],
])('fails closed for %s', (_label, walkthrough) => {
  expect(questStrategyFromWalkthrough(walkthrough)).toBeNull();
});
```

- [ ] **Step 2: Define the strategy metadata types**

Add these exact responsibilities to `utils/questWalkthroughs/model.ts`:

```ts
export type QuestActionCompletionRule =
  | { readonly kind: 'MANUAL' }
  | { readonly kind: 'ITEM_CONFIRMED'; readonly itemKey: string }
  | { readonly kind: 'QUEST_COMPLETED'; readonly questId: string };

export type QuestActionPreferredMethod =
  | { readonly kind: 'DIRECT_SOURCE'; readonly itemKey: string; readonly sourceLabel: string }
  | { readonly kind: 'TRANSFORMATION'; readonly recipeId: string };

export interface QuestActionCoachMetadata {
  readonly fulfils: readonly WalkthroughItemRef[];
  readonly completion: QuestActionCompletionRule;
  readonly preferredMethod?: QuestActionPreferredMethod;
  readonly fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES' | 'INTERCHANGEABLE' | 'NONE';
}
```

Add optional `coach?: QuestActionCoachMetadata` to `QuestWalkthroughActionDefinition`. Keeping it optional preserves the three pilot packs that are not migrated in this phase.

- [ ] **Step 3: Implement fail-closed strategy conversion**

Create `utils/questStrategies/model.ts` with a public shape that narrows every action to required coach metadata:

```ts
export type QuestStrategyAction = QuestWalkthroughActionDefinition & {
  readonly coach: QuestActionCoachMetadata;
};

export interface QuestStrategyDefinition {
  readonly questId: string;
  readonly revision: string;
  readonly source: QuestWalkthroughDefinition['source'];
  readonly sourceLines: QuestWalkthroughDefinition['sourceLines'];
  readonly actions: readonly QuestStrategyAction[];
}

export function questStrategyFromWalkthrough(
  walkthrough: QuestWalkthroughDefinition,
): QuestStrategyDefinition | null;
```

The converter must return `null` unless every action in the candidate strategy has coach metadata, all IDs are unique, every dependency exists, the graph is acyclic, completion item keys occur in `items` or `fulfils`, preferred method IDs are non-blank, and source order is stable. Ordinary walkthroughs containing any action without coach metadata remain valid walkthroughs but return `null` from strategy conversion.

A reviewed `DIRECT_SOURCE` method is validated from its action's reviewed location and evidence; it does not require the generic spawn index to repeat the same source. This is necessary for interior or chunk-level guide locations such as the Lumbridge Castle cellar. Generic source records remain required for fallback enumeration, not for accepting reviewed guide truth.

- [ ] **Step 4: Add compiler validation tests**

In `scripts/quest-walkthrough-source.test.ts`, assert compilation rejects a reviewed action whose coach metadata contains a missing dependency, blank transformation ID, or non-canonical completion item key. Assert legacy pilot actions without coach metadata still compile as walkthroughs but are not strategy-eligible at runtime.

- [ ] **Step 5: Add the compiler checks**

Extend `compileWalkthroughCatalogue` validation without changing generated ordering or revision hashing. Coach metadata must remain part of the hashed definition so any strategy edit changes the walkthrough revision.

- [ ] **Step 6: Run the focused tests**

Run:

```powershell
npx vitest run utils/questStrategies/model.test.ts scripts/quest-walkthrough-source.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- utils/questStrategies/model.ts utils/questStrategies/model.test.ts utils/questWalkthroughs/model.ts scripts/quest-walkthrough-source.mjs scripts/quest-walkthrough-source.test.ts
git commit -m "feat: compile reviewed RuneProof strategies"
```

---

### Task 3: Encode the reviewed Cook's Assistant strategy

**Files:**
- Modify: `data/sources/quest-walkthrough-review.json`
- Modify: `data/questWalkthroughs.generated.json`
- Modify: `data/questWalkthroughs.test.ts`
- Modify: `utils/questStrategies/model.test.ts`

**Interfaces:**
- Consumes: Task 2 coach metadata and existing reviewed source line IDs.
- Produces: the only Phase 1 strategy-eligible quest, with nine ordered actions and reviewed locations in chunks `50,50`, `50,51`, and `49,51`.

- [ ] **Step 1: Write the failing generated-pack test**

Assert the preview loader returns a strategy with this exact action contract:

```ts
const walkthrough = await loadQuestWalkthroughFor('PREVIEW', release);
const strategy = walkthrough && questStrategyFromWalkthrough(walkthrough);

expect(strategy?.actions.map(action => ({
  id: action.id,
  instruction: action.displayText,
  method: action.coach.preferredMethod,
}))).toEqual([
  { id: 'cooks-assistant:start-quest', instruction: 'Talk to the Cook in Lumbridge Castle.', method: undefined },
  { id: 'cooks-assistant:take-pot', instruction: 'Pick up the empty pot beside the Cook in Lumbridge Castle.', method: { kind: 'DIRECT_SOURCE', itemKey: 'pot', sourceLabel: 'Pot' } },
  { id: 'cooks-assistant:take-bucket', instruction: 'Pick up the bucket from the Lumbridge Castle cellar.', method: { kind: 'DIRECT_SOURCE', itemKey: 'bucket', sourceLabel: 'Bucket' } },
  { id: 'cooks-assistant:milk-cow', instruction: 'Use the bucket on a dairy cow in the Lumbridge cow field.', method: { kind: 'TRANSFORMATION', recipeId: 'milk-cow' } },
  { id: 'cooks-assistant:take-egg', instruction: 'Pick up the egg at the chicken farm beside the cow field.', method: { kind: 'DIRECT_SOURCE', itemKey: 'egg', sourceLabel: 'Egg' } },
  { id: 'cooks-assistant:pick-grain', instruction: 'Pick grain outside Mill Lane Mill.', method: { kind: 'TRANSFORMATION', recipeId: 'pick-wheat' } },
  { id: 'cooks-assistant:make-flour', instruction: 'Use the grain in Mill Lane Mill and collect the flour in the pot.', method: { kind: 'TRANSFORMATION', recipeId: 'grain-to-flour' } },
  { id: 'cooks-assistant:return-to-cook', instruction: 'Return to the Cook with the bucket of milk, egg, and pot of flour.', method: undefined },
  { id: 'cooks-assistant:complete', instruction: "Cook's Assistant complete.", method: undefined },
]);
```

- [ ] **Step 2: Replace the generic reviewed actions**

Remove the Grand Exchange information card, the generic self-source information card, and the three generic preparation actions for milk, egg, and flour from Cook's Assistant. Add the nine actions above with a single dependency chain in the same order.

Use these exact reviewed locations. For item spawns that cannot use `EXACT_ENTITY`, add a `REVIEWED_ALIAS` reviewed by `OpenAI Codex` on `2026-08-20`; its evidence must cite both the pinned Wiki source line and the pinned chunk-content entry, and its rationale must state that only chunk precision is claimed:

| Action | Location directive | Evidence |
|---|---|---|
| start quest, return | `EXACT_ENTITY` Cook entity / chunk `50,50` | tasks `t_7591`/`t_7595`, source line 6, and pinned Cook entity |
| take pot | `REVIEWED_ALIAS` chunk `50,50` | source line 5 and pinned Lumbridge Castle Pot spawn |
| take bucket | `REVIEWED_ALIAS` chunk `50,50` | source line 3 names the Lumbridge Castle cellar; the pinned chunk is named Lumbridge Castle |
| milk cow | `EXACT_ENTITY` Dairy cow object / chunk `50,51` | source line 3 and pinned Dairy cow entity |
| take egg | `REVIEWED_ALIAS` chunk `50,51` | source line 4 and pinned Groats' Farm Egg spawn |
| pick grain | `EXACT_ENTITY` Wheat object / chunk `49,51` | source line 5 and pinned Wheat entity |
| make flour | `EXACT_ENTITY` Hopper object / chunk `49,51` | source line 5 and pinned Hopper entity |
| complete | explicit chunk `50,50` | completion task `t_7596` |

Use `BLOCK_THEN_ALTERNATIVES` for the three final ingredient-producing actions, `NONE` for travel/talk/completion actions, `ITEM_CONFIRMED` for milk, egg, and flour completion, `QUEST_COMPLETED` for the final action, and `MANUAL` for remaining actions.

- [ ] **Step 3: Regenerate the immutable catalogue**

Run:

```powershell
npm run walkthroughs:refresh
```

Expected: `data/questWalkthroughs.generated.json` changes only for the Cook's Assistant definition and its revision.

- [ ] **Step 4: Run source and loader verification**

Run:

```powershell
npm run walkthroughs:verify
npx vitest run data/questWalkthroughs.test.ts utils/questStrategies/model.test.ts
```

Expected: PASS. Daddy's Home, Doric's Quest, and Elemental Workshop I remain valid walkthroughs and remain strategy-ineligible.

- [ ] **Step 5: Commit**

```powershell
git add -- data/sources/quest-walkthrough-review.json data/questWalkthroughs.generated.json data/questWalkthroughs.test.ts utils/questStrategies/model.test.ts
git commit -m "data: add reviewed Cook's Assistant strategy"
```

---

### Task 4: Store bounded action progress in the local preview

**Files:**
- Create: `utils/questStrategies/previewActions.ts`
- Create: `utils/questStrategies/previewActions.test.ts`
- Create: `hooks/useRuneProofPreviewActions.ts`
- Create: `hooks/useRuneProofPreviewActions.test.tsx`

**Interfaces:**
- Consumes: one loaded `QuestStrategyDefinition`, existing `RuneProofStorage`, and `runId`.
- Produces: `RuneProofPreviewActions`, `confirmedActionIds`, and `setActionConfirmed(actionId, confirmed)` without changing item confirmation storage.

- [ ] **Step 1: Write failing normalization and isolation tests**

Cover this exact public shape:

```ts
export type RuneProofPreviewActions = Record<string, readonly string[]>;
```

Assert that:

- a valid Cook action ID survives normalization;
- an unknown action ID and inherited property are removed;
- the 64 KiB limit remains enforced;
- corrupt JSON returns empty progress;
- one run ID cannot read another run's actions;
- changing from Cook's Assistant to a different loaded strategy returns only that strategy's reviewed action IDs; and
- existing `fate_runeproof_preview_checks_v1:<runId>` item storage is never read, rewritten, or removed.

- [ ] **Step 2: Implement strategy-scoped normalization**

Keep `RuneProofStorage` unchanged. Add:

```ts
export const runeProofPreviewActionStorageKey = (runId: string): string =>
  `fate_runeproof_preview_actions_v1:${runId}`;

export function normalizeRuneProofPreviewActions(
  value: unknown,
  strategy: QuestStrategyDefinition,
): RuneProofPreviewActions;
```

Normalization must retain only the loaded strategy's quest ID and exact reviewed action IDs. Empty quest records must be removed. Reads and writes must not occur until a non-null strategy exists. Storage failures must remain contained.

- [ ] **Step 3: Implement the strategy-scoped hook**

Return:

```ts
export interface RuneProofPreviewActionControls {
  readonly confirmedActionIds: ReadonlySet<string>;
  setActionConfirmed(actionId: string, confirmed: boolean): void;
}
```

The hook signature is:

```ts
export function useRuneProofPreviewActions(
  runId: string,
  strategy: QuestStrategyDefinition | null,
  storage?: RuneProofStorage,
): RuneProofPreviewActionControls;
```

Preserve in-memory interaction when a write fails. Reload the correct action set when `runId` or the loaded strategy identity changes. A null strategy returns an empty set and performs no storage access.

- [ ] **Step 4: Run the focused tests**

Run:

```powershell
npx vitest run utils/questStrategies/previewActions.test.ts hooks/useRuneProofPreviewActions.test.tsx utils/questRoutes/previewChecks.test.ts hooks/useRuneProofPreviewChecks.test.tsx
```

Expected: PASS, including the unchanged legacy item-confirmation tests.

- [ ] **Step 5: Commit**

```powershell
git add -- utils/questStrategies/previewActions.ts utils/questStrategies/previewActions.test.ts hooks/useRuneProofPreviewActions.ts hooks/useRuneProofPreviewActions.test.tsx
git commit -m "feat: track RuneProof preview action progress"
```

---

### Task 5: Project one trustworthy next action

**Files:**
- Create: `utils/questStrategies/coach.ts`
- Create: `utils/questStrategies/coach.test.ts`

**Interfaces:**
- Consumes: `QuestStrategyDefinition`, `RuneProofRouteAnalysis`, confirmed item keys, confirmed action IDs, completed quest IDs, and fallback routes.
- Produces: `RuneProofCoachModel` through `buildRuneProofCoachModel(input)`.

- [ ] **Step 1: Write failing Cook's Assistant projection tests**

Define tests for these transitions:

```ts
expect(model.nextAction?.id).toBe('cooks-assistant:start-quest');
expect(model.nextAction?.instruction).toBe('Talk to the Cook in Lumbridge Castle.');
expect(model.mainJourneyText).not.toMatch(/route budget|source wording|Black Knight/i);
```

After confirming `start-quest` and `take-pot`:

```ts
expect(model.nextAction?.id).toBe('cooks-assistant:take-bucket');
expect(model.actions.filter(action => action.state === 'DO_NOW')).toHaveLength(1);
```

When chunk `49,51` is locked:

```ts
expect(model.nextAction?.id).toBe('cooks-assistant:pick-grain');
expect(model.nextAction?.state).toBe('BLOCKED');
expect(model.nextAction?.blockerText).toBe('Unlock chunk 49,51 to use Mill Lane Mill.');
expect(model.alternativeSources
  .find(source => source.itemKey === 'pot of flour')
  ?.routes.some(route => route.label === 'Black Knight')).toBe(true);
```

When the mill is available:

```ts
expect(model.actions.find(action => action.id === 'cooks-assistant:make-flour')?.preferredMethodLabel)
  .toBe('Mill Lane Mill');
expect(model.nextAction?.instruction).toBe('Pick grain outside Mill Lane Mill.');
```

- [ ] **Step 2: Define the view model**

Implement these stable outputs:

```ts
export type RuneProofCoachActionState =
  | 'COMPLETED'
  | 'DO_NOW'
  | 'AVAILABLE_NEXT'
  | 'BLOCKED'
  | 'NEEDS_CONFIRMATION';

export interface RuneProofCoachAction {
  readonly id: string;
  readonly instruction: string;
  readonly state: RuneProofCoachActionState;
  readonly locationLabel?: string;
  readonly mapChunks: readonly ChunkKey[];
  readonly blockerText?: string;
  readonly preferredMethodLabel?: string;
  readonly confirmationAllowed: boolean;
}

export interface RuneProofAlternativeSourceGroup {
  readonly itemKey: string;
  readonly itemName: string;
  readonly routes: readonly PresentedRoute[];
}

export interface RuneProofCoachModel {
  readonly questId: string;
  readonly recommendationReason: string;
  readonly progress: Readonly<{ completed: number; total: number }>;
  readonly nextAction?: RuneProofCoachAction;
  readonly actions: readonly RuneProofCoachAction[];
  readonly alternativeSources: readonly RuneProofAlternativeSourceGroup[];
  readonly proof: Readonly<{
    source: QuestWalkthroughAnalysis['source'];
    sourceLines: QuestWalkthroughAnalysis['sourceLines'];
    diagnostics: readonly string[];
  }>;
}
```

- [ ] **Step 3: Implement deterministic action-state projection**

Use source order plus dependency order. Apply explicit action confirmations and item/quest completion rules. When a later action is proven complete, mark its transitive dependencies complete for display. Select the first incomplete action as the only `DO_NOW` or `BLOCKED` action; later valid actions are `AVAILABLE_NEXT`.

Preferred strategy instructions and locations always supply the main journey. Group generic resolver routes under objective-level `alternativeSources` only for final required items whose producing strategy action permits fallback. This keeps a whole-chain fallback such as a Pot of flour drop available even when the current blocked substep is `pick-grain`. Keep analysis `dataNotes` only in `proof.diagnostics`.

- [ ] **Step 4: Run the focused tests**

Run:

```powershell
npx vitest run utils/questStrategies/coach.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- utils/questStrategies/coach.ts utils/questStrategies/coach.test.ts
git commit -m "feat: project RuneProof next actions"
```

---

### Task 6: Rank fallback routes from quest context

**Files:**
- Modify: `utils/questRoutes/ranker.ts`
- Modify: `utils/questRoutes/ranker.test.ts`
- Modify: `utils/questStrategies/coach.ts`
- Modify: `utils/questStrategies/coach.test.ts`

**Interfaces:**
- Consumes: `ItemRoute`, `ConnectGraph`, and an optional prior-action `ChunkKey`.
- Produces: `RouteRankContext` and `rankFallbackRoutes(routes, graph, context)` without changing the existing primary resolver's `rankRoutes` contract.

- [ ] **Step 1: Write failing origin and risk tests**

Add exact comparisons:

```ts
expect(rankFallbackRoutes([farSpawn, nearbySpawn], graph, { origin: '50,50' })[0].id)
  .toBe(nearbySpawn.id);

expect(rankFallbackRoutes([nearbyDrop, nearbyDeterministicGather], graph, { origin: '50,50' })[0].id)
  .toBe(nearbyDeterministicGather.id);

expect(rankFallbackRoutes([nearbyDrop, nearbyChanceGather], graph, { origin: '50,50' })[0].id)
  .toBe(nearbyChanceGather.id);
```

- [ ] **Step 2: Extend ranking context**

Add:

```ts
export interface RouteRankContext {
  readonly origin?: ChunkKey;
}
```

Origin travel is the graph distance from `origin` to the first unique route chunk plus existing internal route travel. Implement a fallback-only lexicographic tuple in this exact order: usable evidence, determinism, total journey travel, recursive cost, consumed-ingredient cost, skill unlock cost, skill-level cost, combat risk, probability, stable route ID. DROP routes have risk `1`; SPAWN, SHOP, GATHER, and RECIPE routes have risk `0`.

Keep `rankRoutes(routes, graph)` and its existing tuple unchanged. The new fallback ranker must be opt-in so ordinary resolver semantics and existing route tests do not drift.

- [ ] **Step 3: Apply context only to coach alternatives**

In `buildRuneProofCoachModel`, rank alternatives from the previous completed strategy action's first verified chunk. Do not run the fallback ranker to choose the preferred strategy action.

- [ ] **Step 4: Run focused regression tests**

Run:

```powershell
npx vitest run utils/questRoutes/ranker.test.ts utils/questStrategies/coach.test.ts utils/questRoutes/resolver.test.ts
```

Expected: PASS with no changes to route availability semantics.

- [ ] **Step 5: Commit**

```powershell
git add -- utils/questRoutes/ranker.ts utils/questRoutes/ranker.test.ts utils/questStrategies/coach.ts utils/questStrategies/coach.test.ts
git commit -m "feat: rank RuneProof fallbacks from quest context"
```

---

### Task 7: Build the progression-coach interface

**Files:**
- Create: `components/questStrategies/RuneProofCoach.tsx`
- Create: `components/questStrategies/RuneProofCoach.test.tsx`
- Create: `components/questStrategies/RuneProofProofDrawer.tsx`
- Create: `components/questStrategies/RuneProofProofDrawer.test.tsx`

**Interfaces:**
- Consumes: `RuneProofCoachModel`, action confirmation callback, and world-map callback.
- Produces: `RuneProofCoach` and `RuneProofProofDrawer` React components.

- [ ] **Step 1: Write failing visible-hierarchy tests**

Render a Cook model and assert:

```ts
expect(screen.getByRole('heading', { name: "Cook's Assistant" })).toBeTruthy();
expect(screen.getByText('Recommended because this local quest is ready with your current unlocks.')).toBeTruthy();
expect(screen.getByRole('heading', { name: 'Next action' })).toBeTruthy();
expect(screen.getByText('Pick up the empty pot beside the Cook in Lumbridge Castle.')).toBeTruthy();
expect(screen.getByRole('list', { name: 'Cook\'s Assistant route' })).toBeTruthy();
expect(screen.queryByText(/route budget/i)).toBeNull();
expect(screen.queryByText(/Black Knight/i)).toBeNull();
```

Click `Other legal sources` and assert the alternatives become visible. Click `Proof and sources` and assert Wiki revision and diagnostics become visible only in the drawer.

- [ ] **Step 2: Implement the coach shell**

Use this semantic hierarchy:

```tsx
<section aria-labelledby="runeproof-objective-heading">
  <header>{/* RuneProof label, objective, recommendation reason, progress */}</header>
  <section aria-labelledby="runeproof-next-action-heading">{/* one primary action */}</section>
  <ol aria-label={`${model.questId} route`}>{/* compact action timeline */}</ol>
  <RuneProofProofDrawer proof={model.proof} />
</section>
```

The next-action card owns the primary map button and confirmation control. Timeline rows use text plus icons; do not rely on colour alone. Only the current action expands by default.

- [ ] **Step 3: Implement collapsed alternatives and Proof drawer**

Alternatives must use a disclosure labelled `Other legal sources`. Proof must use a disclosure labelled `Proof and sources`. Neither disclosure is open by default. Route budgets and source wording may appear only under Proof.

- [ ] **Step 4: Add responsive component tests**

Assert the component has no fixed pixel width, keeps the primary action before the timeline in DOM order, and exposes one map action at a time. Component tests do not replace the later real-browser visual check.

- [ ] **Step 5: Run the component tests**

Run:

```powershell
npx vitest run components/questStrategies/RuneProofCoach.test.tsx components/questStrategies/RuneProofProofDrawer.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- components/questStrategies/RuneProofCoach.tsx components/questStrategies/RuneProofCoach.test.tsx components/questStrategies/RuneProofProofDrawer.tsx components/questStrategies/RuneProofProofDrawer.test.tsx
git commit -m "feat: add RuneProof progression coach UI"
```

---

### Task 8: Integrate the coach without breaking Goal Planner

**Files:**
- Modify: `components/GoalPlannerModal.tsx`
- Modify: `components/GoalPlannerModal.runeproof.test.tsx`
- Modify: `components/Dashboard.tsx`
- Create: `components/Dashboard.runeproof.test.tsx`

**Interfaces:**
- Consumes: strategy loader/converter, route analysis, preview progress controls, `buildRuneProofCoachModel`, `RuneProofCoach`, preview availability, and existing map handoff.
- Produces: a dedicated supported-quest workspace inside the modal and preview-only Dashboard label `RuneProof`.

- [ ] **Step 1: Write the failing integration tests**

Cover these exact behaviors:

```ts
expect(await screen.findByRole('heading', { name: 'Next action' })).toBeTruthy();
expect(screen.queryByText('Quest requirements')).toBeNull();
expect(screen.queryByText('Best route: Black Knight')).toBeNull();
expect(screen.queryByText('Analysis incomplete')).toBeNull();
```

Also assert:

- RuneProof OFF renders the unchanged Goal Planner and Dashboard label `Goal Planner`;
- preview mode labels the Dashboard entry `RuneProof`;
- selecting Daddy's Home still renders ordinary Goal Planner output because it is not strategy-eligible in Phase 1;
- switching rapidly between targets cannot render stale Cook analysis;
- closing and reopening retains isolated action progress; and
- the current-action map button closes the modal and forwards the exact reviewed chunk; and
- a coach projection or render failure is contained by `RuneProofErrorBoundary` and leaves the target picker and ordinary Goal Planner usable.

- [ ] **Step 2: Build the coach model at the integration boundary**

After walkthrough loading and route analysis, call `questStrategyFromWalkthrough`. If it returns a strategy, build the coach model with current confirmed item/action IDs and render `RuneProofCoach`. If it returns `null`, preserve the existing Goal Planner behavior.

Do not render `QuestRoutePanel` in the primary supported-strategy path. Keep the component and tests available until the remaining pilot packs are migrated or explicitly retired.

- [ ] **Step 3: Make the supported workspace visually primary**

For strategy-eligible targets:

- widen the modal to `max-w-5xl`;
- collapse the target picker behind a `Change objective` control on narrow screens;
- let the coach occupy the full available plan column; and
- remove the duplicate ordinary goal-plan readiness header from the coach path.

Unsupported targets retain the current `max-w-3xl` planner layout.

- [ ] **Step 4: Add the preview-only Dashboard entry label**

Use the existing feature-flag function rather than reading the environment in multiple places. In preview mode, render label `RuneProof` and title `Get the next reviewed action for your run`. In normal mode, preserve `Goal Planner` and its existing title.

- [ ] **Step 5: Run integration tests**

Run:

```powershell
npx vitest run components/GoalPlannerModal.runeproof.test.tsx components/GoalPlannerModal.test.tsx components/Dashboard.runeproof.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- components/GoalPlannerModal.tsx components/GoalPlannerModal.runeproof.test.tsx components/Dashboard.tsx components/Dashboard.runeproof.test.tsx
git commit -m "feat: integrate RuneProof coach workspace"
```

---

### Task 9: Add the local acceptance gate and verify the complete slice

**Files:**
- Create: `docs/testing/runeproof-cooks-assistant-local-acceptance.md`
- Modify only if required by a failing gate: files already owned by Tasks 1–8

**Interfaces:**
- Consumes: the complete Cook's Assistant slice.
- Produces: a reproducible local acceptance checklist and fresh automated/visual evidence for Alex.

- [ ] **Step 1: Write the acceptance checklist**

The document must contain these exact scenarios:

1. Normal build: Dashboard still says Goal Planner and contains no RuneProof coach or private source wording.
2. Fresh preview run: RuneProof opens on Cook's Assistant with `Talk to the Cook` as the only next action.
3. Manual progression: confirming each manual action advances exactly one step and survives reload.
4. Ingredient progression: confirming milk, egg, or flour marks the relevant action and transitive prerequisite chain complete.
5. Available mill: `Pick grain outside Mill Lane Mill` and the mill flour action are primary; Black Knight is absent until alternatives are opened.
6. Blocked mill: the exact `49,51` blocker appears before alternatives.
7. Proof: source revision and route diagnostics are hidden until `Proof and sources` opens.
8. Map: current-action map handoff opens the exact reviewed chunk and closes RuneProof.
9. Unsupported target: Daddy's Home uses ordinary Goal Planner behavior.
10. Mobile: at 390 × 844 the next action appears before the route timeline, controls remain reachable, and no horizontal overflow occurs.
11. Desktop: at 1440 × 900 the coach has clear hierarchy and the target picker does not dominate the workspace.

- [ ] **Step 2: Run the full automated gate**

Run each command separately and preserve its fresh result:

```powershell
npm test
npm run typecheck
npm run content:verify
npm run build:runeproof-preview
npm run build
git diff --check
git status --short --branch
```

Expected: all test, type, content, and build commands PASS; `git diff --check` is silent; only the acceptance document is uncommitted before its commit.

- [ ] **Step 3: Run real-browser visual verification**

Start the preview locally with `VITE_RUNEPROOF_PREVIEW=1`, open it in the in-app browser, and complete all eleven checklist scenarios. Capture desktop and mobile screenshots of:

- the fresh next-action view;
- the available Mill Lane flour route;
- the blocked-mill explanation;
- expanded alternatives;
- expanded Proof drawer; and
- the unsupported-target fallback.

Do not mark the slice complete from component tests or DOM text alone. Inspect the actual visible hierarchy, scrolling, overlap, focus order, and responsive layout.

- [ ] **Step 4: Commit the acceptance checklist**

```powershell
git add -- docs/testing/runeproof-cooks-assistant-local-acceptance.md
git commit -m "docs: add RuneProof local acceptance gate"
```

- [ ] **Step 5: Present the local build to Alex**

Leave the verified preview open locally. Report the exact commands and scenarios that passed, known limitations, branch commits, and the local URL. Request Alex's visual/playthrough approval.

Do not push, open a pull request, merge, deploy, publicly enable, or announce RuneProof at this checkpoint.

---

## Completion Boundary

This plan is complete only when Cook's Assistant works as a trustworthy local progression coach, the mill route is the reviewed default, generic drops are secondary, automated gates pass, real desktop/mobile checks pass, and Alex has been given the local build to test.

Completion of this plan does **not** authorize:

- migrating the other three pilot quests;
- enabling global top-three objective recommendation;
- expanding RuneLite observation beyond current reliable inputs;
- authoring the F2P quest waves; or
- any public release action.

Those are separate follow-on plans after the Cook's Assistant slice is approved.
