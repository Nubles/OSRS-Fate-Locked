# RuneProof Local Preview Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the final transferred RuneProof quest-route feature into current FLIM for four reviewed quests behind an explicit local preview build, without changing normal saves or public behavior.

**Architecture:** Use a hybrid feature-first port: restore final feature-owned files from the verified transfer archive, while adapting shared integration points to current FLIM instead of overwriting them. Keep analysis deterministic and read-only; store item confirmations in a separate per-run preview namespace; select preview walkthrough data at build time so normal builds receive the empty public catalogue.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Vitest 4, Testing Library, browser `localStorage`, existing FLIM chunk-content data and Goal Planner.

## Global Constraints

- Source archive: `C:\Users\alexa\Downloads\flitest-main\RuneProof-Transfer-2026-08-02.zip`.
- Verified source boundary: base `69d07f36dce6f44544a8cde137001e4b0ce32c92`, RuneProof head `674a97730c4a671648c18a3c6715d35645975148`, 85 commits, 99 files.
- Recheck `SHA256SUMS.txt` before importing; stop if any embedded artifact hash differs.
- Before Task 1, use `superpowers:using-git-worktrees` to start execution in an isolated worktree from the commit containing this plan and `docs/superpowers/specs/2026-08-08-runeproof-preview-port-design.md`; do not disturb the current root's unrelated untracked plans.
- Current FLIM wins every shared-file conflict. Never replace current `GoalPlannerModal.tsx`, `Dashboard.tsx`, `ChunkContentService.ts`, `package.json`, or `vite.config.ts` wholesale with transfer versions.
- Enable RuneProof only when `VITE_RUNEPROOF_PREVIEW=1`; do not implement `VITE_RUNEPROOF_PUBLIC` or an in-app toggle.
- Support exactly Cook's Assistant, Daddy's Home, Doric's Quest, and Elemental Workshop I.
- Keep every walkthrough release `PREVIEW_ONLY`; do not promote data.
- Do not add `questItemChecks` to `GameState`, change `CURRENT_SAVE_VERSION`, or edit save/import/export/sync formats.
- Preview confirmation key: `fate_runeproof_preview_checks_v1:<runId>`; reject raw values longer than 65,536 characters before parsing.
- A normal production build must not contain preview walkthrough instructions, reviewed source wording, or raw review data.
- Preserve the transferred preview UI during this port. The Data note, evidence dropdown, map-label compression, overlay styling, and legend refinements remain outside this plan.
- Preserve all current entrance, bank, chunk, content, persistence, and Goal Planner behavior and tests.
- Do not add a public `data/changelog.ts` entry for a feature that is absent from normal builds. Revisit the branch-level changelog policy only when a public release is designed.
- This is a web application change. Do not launch Unreal Engine or touch `C:\Users\alexa\Game Production\UE5_SyntyAI`.

---

## File Structure

### Restore from the transfer as feature-owned files

- `utils/questRoutes/` — route models, gates, exact-source indexing, bounded resolution, ranking, analysis, presentation, checklist, and map projection.
- `utils/questWalkthroughs/` — reviewed walkthrough models, entity requests, location resolution, evaluation, and presentation.
- `data/questItemRequirements.ts`, `data/questRouteRecipes.ts` — reviewed four-quest item and recipe catalogues.
- `data/questWalkthrough*.ts`, `data/questWalkthroughs.generated.json` — validated preview/public-safe catalogue boundary.
- `data/sources/quest-walkthrough-sources.json`, `data/sources/quest-walkthrough-review.json` — pinned source and review ledgers.
- `components/questRoutes/` — checklist, walkthrough, route map, and composed RuneProof panel.
- `scripts/check-quest-route-data.mjs`, `scripts/quest-walkthrough-source.mjs`, `scripts/sync-quest-walkthroughs.mjs` — offline data verification and refresh.
- Matching transferred tests for every feature-owned unit.

### Create specifically for current FLIM

- `utils/questRoutes/previewChecks.ts` and test — bounded parser and per-run preview storage adapter.
- `hooks/useRuneProofPreviewChecks.ts` and test — React state with session fallback on write failure.
- `components/questRoutes/RuneProofErrorBoundary.tsx` and test — concise panel-local render fallback.
- `.env.runeproof-preview` — cross-platform Vite preview mode flag.
- `scripts/runeproof-public-bundle.test.ts` — normal/preview bundle content boundary.

### Modify current FLIM narrowly

- `utils/shopClassification.ts`, `utils/merchantShops.ts` — share the current merchant classifier and reviewed exact-name cases.
- `services/ChunkContentService.ts` and test — add exact source records while preserving every newer API and test.
- `components/GoalPlannerModal.tsx` and test — materialize account snapshot, run cancellable analysis, render RuneProof.
- `components/Dashboard.tsx`, `utils/chunkLocations.ts` and test — World-map handoff.
- `vite.config.ts`, `package.json`, `.gitignore` — build boundary and offline commands.
- `scripts/player-facing-changelog.test.ts` — update only the exact `content:verify` command contract.

---

## Task 1: Restore the route model, preview gate, and reviewed catalogues

**Files:**
- Create: `utils/questRoutes/model.ts`
- Create: `utils/questRoutes/model.test.ts`
- Create: `utils/questRoutes/featureFlag.ts`
- Create: `utils/questRoutes/featureFlag.test.ts`
- Create: `data/questItemRequirements.ts`
- Create: `data/questItemRequirements.test.ts`
- Create: `data/questRouteRecipes.ts`
- Create: `data/questRouteRecipes.test.ts`

**Interfaces:**
- Produces: `RuneProofAvailability = 'OFF' | 'PREVIEW'`.
- Produces: `runeProofAvailability(env)`, `canRenderQuestWalkthrough(availability, releaseStatus)`.
- Produces: `reviewedQuestRequirements(questId)`, `isRuneProofQuestSupported(questId)`.
- Produces: `routeRecipes`, `recipesFor`, `transformationCoverageFor`, `resolveRecipeStations`.
- Produces: `ChunkKey`, `ItemRef`, `QuestItemRequirement`, `RawRouteRequirement`, `RouteGate`, `ExactItemSource`, `ItemRoute`, and `ItemRouteAnalysis`.

- [ ] **Step 1: Recheck the transfer artifact hashes**

Hash the four embedded artifacts directly from the outer archive and compare with `SHA256SUMS.txt`:

```powershell
$archive = 'C:\Users\alexa\Downloads\flitest-main\RuneProof-Transfer-2026-08-02.zip'
$verifyRoot = Join-Path ([IO.Path]::GetTempPath()) 'runeproof-transfer-verify-20260808'
if (Test-Path -LiteralPath $verifyRoot) { throw "Verification directory already exists: $verifyRoot" }
New-Item -ItemType Directory -Path $verifyRoot | Out-Null
tar -xf $archive -C $verifyRoot
$payload = Join-Path $verifyRoot 'RuneProof-Transfer-2026-08-02'
Get-FileHash -Algorithm SHA256 -LiteralPath @(
  (Join-Path $payload 'runeproof-history.bundle'),
  (Join-Path $payload 'runeproof-complete.patch'),
  (Join-Path $payload 'runeproof-final-files.zip'),
  (Join-Path $payload 'runeproof-commit-patches.zip')
)
Get-Content -LiteralPath (Join-Path $payload 'SHA256SUMS.txt')
```

Expected values:

```text
B243035813386C5ADB6638B839150EE66416DD7B331606594E5EAE156E3150EC  runeproof-history.bundle
EAABF1731FD198C7DAEF86669E6FAE272C3E024D32EE5E9A5B74AD8137998766  runeproof-complete.patch
57C378931113E251759A496C234135A49325713361D241D324D3BB398798939F  runeproof-final-files.zip
4D7FA6D974E492593EDF7E47E67FB31BFCA9B4ABAD36B405A8C53A1C470D9204  runeproof-commit-patches.zip
```

Expected: all four hashes match. Stop without importing if any value differs.

- [ ] **Step 2: Restore transferred tests first and narrow the feature-flag cases**

Copy the four test files from `runeproof-final-files.zip`. Replace old public-mode cases with:

```ts
describe('runeProofAvailability', () => {
  it('is off unless the exact preview flag is supplied', () => {
    expect(runeProofAvailability({})).toBe('OFF');
    expect(runeProofAvailability({ VITE_RUNEPROOF_PREVIEW: true })).toBe('OFF');
    expect(runeProofAvailability({ VITE_RUNEPROOF_PUBLIC: '1' })).toBe('OFF');
  });

  it('enables only the explicit private preview', () => {
    expect(runeProofAvailability({ VITE_RUNEPROOF_PREVIEW: '1' })).toBe('PREVIEW');
  });
});

it('renders reviewed walkthroughs only in preview', () => {
  expect(canRenderQuestWalkthrough('PREVIEW', 'PREVIEW_ONLY')).toBe(true);
  expect(canRenderQuestWalkthrough('PREVIEW', 'APPROVED')).toBe(true);
  expect(canRenderQuestWalkthrough('OFF', 'APPROVED')).toBe(false);
});
```

- [ ] **Step 3: Run the tests to verify the missing implementation fails**

```bash
npx vitest run utils/questRoutes/model.test.ts utils/questRoutes/featureFlag.test.ts data/questItemRequirements.test.ts data/questRouteRecipes.test.ts
```

Expected: FAIL because the implementation modules do not exist.

- [ ] **Step 4: Restore final model and catalogue implementations**

Copy final transferred `model.ts`, `questItemRequirements.ts`, and `questRouteRecipes.ts`. Implement the narrower flag module:

```ts
export type RuneProofAvailability = 'OFF' | 'PREVIEW';

export const runeProofAvailability = (
  env: Record<string, string | boolean | undefined>,
): RuneProofAvailability => (
  env.VITE_RUNEPROOF_PREVIEW === '1' ? 'PREVIEW' : 'OFF'
);

export const canRenderQuestWalkthrough = (
  availability: RuneProofAvailability,
  _releaseStatus: 'PREVIEW_ONLY' | 'APPROVED',
): boolean => availability === 'PREVIEW';
```

Retain exactly the four reviewed quest definitions and transferred revisions. Do not infer new requirements from current audit data.

- [ ] **Step 5: Run the focused tests**

```bash
npx vitest run utils/questRoutes/model.test.ts utils/questRoutes/featureFlag.test.ts data/questItemRequirements.test.ts data/questRouteRecipes.test.ts
```

Expected: PASS with exactly four supported quest IDs.

- [ ] **Step 6: Commit the foundations**

```bash
git add utils/questRoutes/model.ts utils/questRoutes/model.test.ts utils/questRoutes/featureFlag.ts utils/questRoutes/featureFlag.test.ts data/questItemRequirements.ts data/questItemRequirements.test.ts data/questRouteRecipes.ts data/questRouteRecipes.test.ts
git commit -m "feat: restore RuneProof route foundations"
```

---

## Task 2: Expose exact item sources through the current chunk service

**Files:**
- Create: `utils/shopClassification.ts`
- Modify: `utils/merchantShops.ts:1-90`
- Modify: `services/ChunkContentService.ts:1-25, 100-220, 350-470, end of file`
- Modify: `services/ChunkContentService.test.ts:1-160`
- Modify: `utils/merchantShops.test.ts`

**Interfaces:**
- Consumes: `Coverage` and `RawRouteRequirement` from Task 1.
- Produces: `classifyShop(shopName: string): string | null`.
- Produces: `ItemSourceRecord` with exact `itemName`, `kind`, `hostName`, `cx`, `cy`, and `rawRequirements`.
- Produces: `chunkContentService.itemSourceRecords(itemName)` and `itemSourceCoverage()`.
- Preserves: current entrances, banks, tags, source metadata, search, and cache revision behavior.

- [ ] **Step 1: Extend service tests without deleting current coverage**

Keep the current Dwarven Mine entrance tests, metadata assertions, banks, and fixture setup. Add synthetic shops before singleton initialization, then append:

```ts
it('preserves exact host, chunk, and access evidence', () => {
  expect(chunkContentService.itemSourceRecords('Plank')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        itemName: 'Plank',
        kind: expect.stringMatching(/spawn|shop|monster/),
        hostName: expect.any(String),
        cx: expect.any(Number),
        cy: expect.any(Number),
        rawRequirements: expect.any(Array),
      }),
    ]),
  );
});

it('fails closed for an unclassified synthetic merchant', () => {
  expect(chunkContentService.itemSourceRecords('RuneProof audit token')).toEqual([
    expect.objectContaining({
      hostName: 'Unreviewed audit shop',
      rawRequirements: [{
        raw: 'Unknown merchant category: Unreviewed audit shop',
        origin: 'ENTITY',
      }],
    }),
  ]);
});
```

Add classifier assertions for `Durrik's Goods`, `Gunslik's Assorted Items`, and one existing current-FLIM shop.

- [ ] **Step 2: Run focused tests to verify they fail**

```bash
npx vitest run services/ChunkContentService.test.ts utils/merchantShops.test.ts
```

Expected: FAIL because exact-source APIs and extracted classifier are absent.

- [ ] **Step 3: Extract the shop classifier without changing callers**

Move ordered rules into `shopClassification.ts`, preserving order. Add ahead of generic rules:

```ts
[/^(?:Durrik's Goods|Gunslik's Assorted Items)$/i, 'General Stores'],
```

Change `merchantShops.ts` to consume and preserve the public export:

```ts
import { classifyShop } from './shopClassification';
export { classifyShop } from './shopClassification';
```

- [ ] **Step 4: Add exact source records to the current service**

Do not replace the class or lower `DATA_REV`. Add:

```ts
export interface ItemSourceRecord {
  itemName: string;
  kind: 'spawn' | 'shop' | 'monster';
  hostName: string;
  cx: number;
  cy: number;
  rawRequirements: RawRouteRequirement[];
}

itemSourceRecords(itemName: string): readonly ItemSourceRecord[];
itemSourceCoverage(): Coverage;
```

Port final `buildItemSourceRecordIdx()`. Preserve fail-closed merchant evidence:

```ts
const category = classifyShop(hostName);
return category
  ? [{ raw: `Use the ${category}`, origin: 'ENTITY' }]
  : [{ raw: `Unknown merchant category: ${hostName}`, origin: 'ENTITY' }];
```

Include entity-specific and chunk-entry requirements on every record. Clone returned requirements so callers cannot mutate the cache.

- [ ] **Step 5: Run service and current regressions**

```bash
npx vitest run services/ChunkContentService.test.ts utils/merchantShops.test.ts utils/chunkLocations.test.ts data/banks.test.ts
```

Expected: PASS, including all pre-existing entrance and bank assertions.

- [ ] **Step 6: Commit the source adapter**

```bash
git add utils/shopClassification.ts utils/merchantShops.ts utils/merchantShops.test.ts services/ChunkContentService.ts services/ChunkContentService.test.ts
git commit -m "feat: expose exact RuneProof item sources"
```

---

## Task 3: Restore the bounded recursive route solver

**Files:**

- Create: `utils/questRoutes/accountRequirements.ts`
- Create: `utils/questRoutes/accountRequirements.test.ts`
- Create: `utils/questRoutes/chunkSourceIndex.ts`
- Create: `utils/questRoutes/chunkSourceIndex.test.ts`
- Create: `utils/questRoutes/missingChunks.ts`
- Create: `utils/questRoutes/missingChunks.test.ts`
- Create: `utils/questRoutes/ranker.ts`
- Create: `utils/questRoutes/ranker.test.ts`
- Create: `utils/questRoutes/resolver.ts`
- Create: `utils/questRoutes/resolver.test.ts`

- [ ] **Step 1: Add account-gate tests**

Cover raw requirement parsing, member-only gates, skill thresholds, quest prerequisites, unknown requirements, and the rule that unknown evidence fails closed.

```ts
expect(evaluateRouteRequirements([{ raw: 'Mining 15', origin: 'ENTITY' }], account)).toEqual({
  status: 'MET',
  blockers: [],
});
expect(evaluateRouteRequirements([{ raw: 'Unknown merchant category: General Store', origin: 'ENTITY' }], account).status)
  .toBe('UNKNOWN');
```

- [ ] **Step 2: Add indexing, missing-chunk, ranking, and resolver tests**

Use small synthetic graphs to prove:

- source records are indexed without losing requirement evidence;
- already-unlocked chunks have zero acquisition cost;
- duplicate target chunks are counted once;
- recipes can depend on other quest items recursively;
- cycles terminate without reporting a false route;
- station and account blockers remain visible;
- ties are deterministic;
- exact search stops at its combination and work-unit limits;
- the pilot budget returns a bounded incomplete result instead of freezing.

```ts
expect(resolveItemRequirement(requirement, {
  ...sourceSnapshot,
  unlocks,
  connectGraph,
})).toMatchObject({ state: 'OBTAINABLE_NOW' });
```

- [ ] **Step 3: Run the new tests to prove the solver is absent**

```bash
npx vitest run utils/questRoutes/accountRequirements.test.ts utils/questRoutes/chunkSourceIndex.test.ts utils/questRoutes/missingChunks.test.ts utils/questRoutes/ranker.test.ts utils/questRoutes/resolver.test.ts
```

Expected: FAIL because the five solver modules do not exist.

- [ ] **Step 4: Port the solver modules from the reviewed transfer**

Keep the search limits explicit and unchanged:

```ts
export const MAX_EXACT_ROUTE_COMBINATIONS = 200_000;
export const MAX_ROUTE_SEARCH_WORK_UNITS = 500_000;
export const PILOT_ROUTE_SEARCH_WORK_UNIT_BUDGET = 30_000;
```

The resolver consumes recipes, exact source coverage, account state, station requirements, and the chunk graph. Its input snapshot must preserve every evidence source rather than guessing when data is incomplete:

```ts
export interface DirectRouteResolutionSnapshot extends ChunkSourceSnapshot {
  unlocks: UnlockState;
  recipesFor?(itemKey: string): readonly RouteRecipe[];
  entityLocations?: ExactEntityLocationLookup;
  stationRequirements?: StationRequirementLookup;
  connectGraph?: ConnectGraph;
  fingerprint?: string;
}
```

Retain stable sorting at every boundary so equivalent inputs produce byte-for-byte stable snapshots.

- [ ] **Step 5: Run focused solver tests**

```bash
npx vitest run utils/questRoutes/accountRequirements.test.ts utils/questRoutes/chunkSourceIndex.test.ts utils/questRoutes/missingChunks.test.ts utils/questRoutes/ranker.test.ts utils/questRoutes/resolver.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the type checker**

```bash
npm run typecheck
```

Expected: PASS with no widening of current game-state types.

- [ ] **Step 7: Commit the bounded solver**

```bash
git add utils/questRoutes/accountRequirements.ts utils/questRoutes/accountRequirements.test.ts utils/questRoutes/chunkSourceIndex.ts utils/questRoutes/chunkSourceIndex.test.ts utils/questRoutes/missingChunks.ts utils/questRoutes/missingChunks.test.ts utils/questRoutes/ranker.ts utils/questRoutes/ranker.test.ts utils/questRoutes/resolver.ts utils/questRoutes/resolver.test.ts
git commit -m "feat: restore bounded RuneProof route solver"
```

---

## Task 4: Restore the reviewed walkthrough catalogue and offline source pipeline

**Files:**

- Create: `utils/questWalkthroughs/model.ts`
- Create: `utils/questWalkthroughs/entityRequests.ts`
- Create: `data/questWalkthroughs.generated.json`
- Create: `data/questWalkthroughs.ts`
- Create: `data/questWalkthroughs.test.ts`
- Create: `data/questWalkthroughRelease.ts`
- Create: `data/questWalkthroughLoader.ts`
- Create: `data/questWalkthroughs.preview-boundary.ts`
- Create: `data/questWalkthroughs.public.ts`
- Create: `data/sources/quest-walkthrough-sources.json`
- Create: `data/sources/quest-walkthrough-review.json`
- Create: `scripts/quest-walkthrough-source.mjs`
- Create: `scripts/quest-walkthrough-source.test.ts`
- Create: `scripts/sync-quest-walkthroughs.mjs`
- Create: `scripts/runeproof-source-encoding.test.ts`

- [ ] **Step 1: Add catalogue and source-pipeline tests**

Assert that the generated catalogue contains exactly the four approved quests, every walkthrough references its reviewed source ledger, revisions agree, entity requests are normalized, and source text has valid UTF-8 without replacement characters.

```ts
expect([
  "Cook's Assistant",
  "Daddy's Home",
  "Doric's Quest",
  'Elemental Workshop I',
].map(questId => questWalkthroughFor(questId)?.questId)).toEqual([
  "Cook's Assistant",
  "Daddy's Home",
  "Doric's Quest",
  'Elemental Workshop I',
]);
```

Test the source script as a pure conversion boundary: the checked-in ledgers generate deterministic JSON and `--check` reports drift without rewriting files.

- [ ] **Step 2: Run the catalogue tests to prove the pipeline is absent**

```bash
npx vitest run data/questWalkthroughs.test.ts scripts/quest-walkthrough-source.test.ts scripts/runeproof-source-encoding.test.ts
```

Expected: FAIL because the catalogue, ledgers, and scripts do not exist.

- [ ] **Step 3: Restore the walkthrough types, ledgers, generator, and generated catalogue**

Port the reviewed transfer data without editorial changes. Keep source wording and provenance in the preview-only path. Preserve the per-quest release contract and transferred SHA-256 revisions:

```ts
export interface QuestWalkthroughRelease {
  readonly questId: string;
  readonly revision: string;
  readonly releaseStatus: 'PREVIEW_ONLY' | 'APPROVED';
}

export const questWalkthroughReleaseFor = (
  questId: string,
): QuestWalkthroughRelease | undefined => releaseByQuestId.get(questId);
```

Keep all four release entries `PREVIEW_ONLY`. The revision for each quest must match its reviewed transfer value and generated definition; do not invent or consolidate revisions.

- [ ] **Step 4: Implement the local-only loader boundary**

The loader must return no definition unless preview availability is active, and it must reject revision mismatches:

```ts
export async function loadQuestWalkthroughFor(
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestWalkthroughDefinition | undefined> {
  if (availability !== 'PREVIEW') return undefined;
  const catalogue = await import('./questWalkthroughs.preview-boundary');
  const definition = catalogue.questWalkthroughFor(release.questId);
  return definition?.revision === release.revision ? definition : undefined;
}
```

`questWalkthroughs.public.ts` exports an empty typed catalogue. It is the normal-build replacement target; it must not import generated data or source ledgers.

- [ ] **Step 5: Check generated-data drift and run focused tests**

```bash
node scripts/sync-quest-walkthroughs.mjs --check
npx vitest run data/questWalkthroughs.test.ts scripts/quest-walkthrough-source.test.ts scripts/runeproof-source-encoding.test.ts
```

Expected: both commands PASS and leave the worktree unchanged.

- [ ] **Step 6: Commit the reviewed walkthrough catalogue**

```bash
git add utils/questWalkthroughs/model.ts utils/questWalkthroughs/entityRequests.ts data/questWalkthroughs.generated.json data/questWalkthroughs.ts data/questWalkthroughs.test.ts data/questWalkthroughRelease.ts data/questWalkthroughLoader.ts data/questWalkthroughs.preview-boundary.ts data/questWalkthroughs.public.ts data/sources/quest-walkthrough-sources.json data/sources/quest-walkthrough-review.json scripts/quest-walkthrough-source.mjs scripts/quest-walkthrough-source.test.ts scripts/sync-quest-walkthroughs.mjs scripts/runeproof-source-encoding.test.ts
git commit -m "data: restore reviewed RuneProof walkthroughs"
```

---

## Task 5: Combine route analysis with walkthrough evaluation

**Files:**

- Create: `utils/questWalkthroughs/evaluator.ts`
- Create: `utils/questWalkthroughs/evaluator.test.ts`
- Create: `utils/questWalkthroughs/locationResolver.ts`
- Create: `utils/questWalkthroughs/locationResolver.test.ts`
- Create: `utils/questWalkthroughs/presenter.ts`
- Create: `utils/questWalkthroughs/presenter.test.ts`
- Create: `utils/questRoutes/analyzeQuest.ts`
- Create: `utils/questRoutes/analyzeQuest.test.ts`
- Create: `utils/questRoutes/questRouteStatus.ts`
- Create: `utils/questRoutes/presenter.ts`
- Create: `utils/questRoutes/presenter.test.ts`
- Create: `utils/questRoutes/confirmedItems.ts`
- Create: `utils/questRoutes/confirmedItems.test.ts`
- Create: `utils/questRoutes/requirementChecklist.ts`
- Create: `utils/questRoutes/requirementChecklist.test.ts`

- [ ] **Step 1: Add failing analysis and presentation tests**

Cover these contracts:

- a quest analysis joins the quest requirement catalogue, recipes, source index, account state, and chunk graph;
- walkthrough locations resolve against exact chunk and entity evidence;
- unsupported or unresolved steps remain explicitly incomplete;
- route and walkthrough presenters are deterministic;
- requirement checklists distinguish system-known completion from player confirmation;
- confirmation filtering changes presentation only and never triggers route analysis again.

```ts
const analysis = analyzeQuest(
  "Cook's Assistant",
  snapshot,
  walkthroughDefinition,
);
expect(analysis.questId).toBe("Cook's Assistant");
expect(analysis.items.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run the tests to prove the orchestration layer is absent**

```bash
npx vitest run utils/questWalkthroughs/evaluator.test.ts utils/questWalkthroughs/locationResolver.test.ts utils/questWalkthroughs/presenter.test.ts utils/questRoutes/analyzeQuest.test.ts utils/questRoutes/presenter.test.ts utils/questRoutes/confirmedItems.test.ts utils/questRoutes/requirementChecklist.test.ts
```

Expected: FAIL because the analysis, evaluator, and presenter modules do not exist.

- [ ] **Step 3: Port the walkthrough evaluator and location resolver**

Preserve transferred status semantics and exact evidence. Do not silently substitute a nearby entity or chunk. The evaluator must propagate `BLOCKED` and `INCOMPLETE` when location or requirement evidence is unresolved.

- [ ] **Step 4: Port the quest analysis and presenter pipeline**

Use a canonical analysis input key containing quest id, account snapshot, unlocked chunks, content revision, and source coverage revision. Keep the cached analysis independent of preview confirmations:

```ts
const analysis = analyzeQuest(questId, snapshot, walkthroughDefinition);
const checklistRows = buildQuestRequirementChecklist(plan, reviewed, confirmedItemKeys);
const remainingAnalysis = remainingQuestRouteAnalysis(analysis, confirmedItemKeys);
```

`confirmedItemKeys` may mark `PLAYER_OBTAINED` rows complete and remove those items from the remaining presentation. It must not enter the analysis snapshot, mutate the source analysis, or alter game state.

- [ ] **Step 5: Run focused domain tests**

```bash
npx vitest run utils/questWalkthroughs utils/questRoutes
```

Expected: PASS.

- [ ] **Step 6: Run the type checker**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the analysis layer**

```bash
git add utils/questWalkthroughs/evaluator.ts utils/questWalkthroughs/evaluator.test.ts utils/questWalkthroughs/locationResolver.ts utils/questWalkthroughs/locationResolver.test.ts utils/questWalkthroughs/presenter.ts utils/questWalkthroughs/presenter.test.ts utils/questRoutes/analyzeQuest.ts utils/questRoutes/analyzeQuest.test.ts utils/questRoutes/questRouteStatus.ts utils/questRoutes/presenter.ts utils/questRoutes/presenter.test.ts utils/questRoutes/confirmedItems.ts utils/questRoutes/confirmedItems.test.ts utils/questRoutes/requirementChecklist.ts utils/questRoutes/requirementChecklist.test.ts
git commit -m "feat: analyze RuneProof quest routes"
```

---

## Task 6: Restore the route-map model and geometry

**Files:**

- Create: `utils/questRoutes/routeMapGeometry.ts`
- Create: `utils/questRoutes/routeMapGeometry.test.ts`
- Create: `utils/questRoutes/routeMapModel.ts`
- Create: `utils/questRoutes/routeMapModel.test.ts`

- [ ] **Step 1: Add route-map model tests**

Verify world-to-map projection, stable bounds, repeated-node coalescing, segment ordering, path roles, and route-state styling. Preserve the reviewed enum values:

```ts
export type QuestRouteMapLayerId = 'QUEST_PATH' | 'PREPARATION';
export type QuestRouteMapMarkerState = 'USABLE' | 'BLOCKED' | 'INCOMPLETE';
```

Include empty, one-point, multi-point, and unresolved-location cases.

- [ ] **Step 2: Run the model test to prove the modules are absent**

```bash
npx vitest run utils/questRoutes/routeMapGeometry.test.ts utils/questRoutes/routeMapModel.test.ts
```

Expected: FAIL because the map model and geometry do not exist.

- [ ] **Step 3: Port the transferred geometry and model unchanged**

Keep this task at compatibility parity: no new marker clustering, visual restyling, animation, zoom model, or route interaction. The model must expose enough evidence for the transferred route map and retain deterministic coordinates for snapshot assertions.

- [ ] **Step 4: Run the route-map and domain tests**

```bash
npx vitest run utils/questRoutes/routeMapGeometry.test.ts utils/questRoutes/routeMapModel.test.ts utils/questRoutes utils/questWalkthroughs
```

Expected: PASS.

- [ ] **Step 5: Commit the route-map model**

```bash
git add utils/questRoutes/routeMapGeometry.ts utils/questRoutes/routeMapGeometry.test.ts utils/questRoutes/routeMapModel.ts utils/questRoutes/routeMapModel.test.ts
git commit -m "feat: restore RuneProof route map model"
```

---

## Task 7: Add isolated, per-run preview confirmation storage

**Files:**

- Create: `utils/questRoutes/previewChecks.ts`
- Create: `utils/questRoutes/previewChecks.test.ts`
- Create: `hooks/useRuneProofPreviewChecks.ts`
- Create: `hooks/useRuneProofPreviewChecks.test.tsx`

- [ ] **Step 1: Add storage-boundary tests**

Define an injectable storage interface and exercise the full safety boundary:

```ts
export interface RuneProofStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const RUNEPROOF_PREVIEW_MAX_CHARS = 65_536;
export const runeProofPreviewStorageKey = (runId: string) =>
  `fate_runeproof_preview_checks_v1:${runId}`;
```

Tests must cover:

- separate keys and values for two run ids;
- rejection of payloads larger than 65,536 characters;
- malformed JSON, arrays, primitives, inherited properties, and unsupported quest ids;
- normalization to reviewed `PLAYER_OBTAINED` item keys only;
- duplicate item removal and stable output ordering;
- empty state removes the storage key;
- storage read/write exceptions do not crash the feature.

- [ ] **Step 2: Add hook tests**

Use `renderHook` to prove that the hook initializes from the current run, switches cleanly when `runId` changes, persists changes, and keeps an in-memory result when browser storage throws.

```ts
const { result, rerender } = renderHook(
  ({ runId }) => useRuneProofPreviewChecks(runId, storage),
  { initialProps: { runId: 'run-a' } },
);
```

- [ ] **Step 3: Run the tests to prove the boundary is absent**

```bash
npx vitest run utils/questRoutes/previewChecks.test.ts hooks/useRuneProofPreviewChecks.test.tsx
```

Expected: FAIL because the preview storage utility and hook do not exist.

- [ ] **Step 4: Implement normalization, reading, and writing**

Keep all persistence outside `GameState` and the save schema. Export narrow pure functions for unit testing:

```ts
export function normalizeRuneProofPreviewChecks(value: unknown): RuneProofPreviewChecks;
export function readRuneProofPreviewChecks(storage: RuneProofStorage, runId: string): RuneProofPreviewChecks;
export function writeRuneProofPreviewChecks(
  storage: RuneProofStorage,
  runId: string,
  checks: RuneProofPreviewChecks,
): void;
```

Reject invalid or oversized input to `{}`. Use own-property checks when traversing parsed objects.

- [ ] **Step 5: Implement the per-run React hook**

Expose only the data and operations needed by the planner:

```ts
export interface RuneProofPreviewCheckControls {
  checks: RuneProofPreviewChecks;
  confirmedItemKeys(questId: string): ReadonlySet<string>;
  setItemConfirmed(questId: string, itemKey: string, confirmed: boolean): void;
}
```

The setter validates quest and item keys before changing memory or storage. Browser storage failures are caught at this boundary and never surfaced as a planner crash.

- [ ] **Step 6: Run storage and hook tests**

```bash
npx vitest run utils/questRoutes/previewChecks.test.ts hooks/useRuneProofPreviewChecks.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run save-schema regressions**

```bash
npx vitest run context/GameContext.test.tsx context/GameContext.persistence.test.ts
npm run typecheck
```

Expected: PASS, with no `questItemChecks` field in `GameState`, migrations, or serialized saves.

- [ ] **Step 8: Commit preview-only persistence**

```bash
git add utils/questRoutes/previewChecks.ts utils/questRoutes/previewChecks.test.ts hooks/useRuneProofPreviewChecks.ts hooks/useRuneProofPreviewChecks.test.tsx
git commit -m "feat: isolate RuneProof preview confirmations"
```

---

## Task 8: Restore the transferred planner UI with a focused error boundary

**Files:**

- Create: `components/questRoutes/QuestRouteMap.tsx`
- Create: `components/questRoutes/QuestRouteMap.test.tsx`
- Create: `components/questRoutes/QuestWalkthrough.tsx`
- Create: `components/questRoutes/QuestWalkthrough.test.tsx`
- Create: `components/questRoutes/QuestRequirementChecklist.tsx`
- Create: `components/questRoutes/QuestRequirementChecklist.test.tsx`
- Create: `components/questRoutes/QuestRoutePanel.tsx`
- Create: `components/questRoutes/QuestRoutePanel.test.tsx`
- Create: `components/questRoutes/RuneProofErrorBoundary.tsx`
- Create: `components/questRoutes/RuneProofErrorBoundary.test.tsx`

- [ ] **Step 1: Add failing component tests from the reviewed transfer**

Port the transferred tests first. Cover useful, blocked, and incomplete map states; visible and unavailable walkthroughs; checked and unchecked player-obtained requirements; quest switching; and the optional “open on world map” callback.

```tsx
render(
  <QuestRoutePanel
    questId="Cook's Assistant"
    analysis={analysis}
    checklistRows={rows}
    confirmedItemKeys={new Set()}
    onSetItemConfirmed={onSetItemConfirmed}
    onOpenWorldChunk={onOpenWorldChunk}
  />,
);
```

- [ ] **Step 2: Add a focused error-boundary test**

Render a child that throws. Assert that the boundary contains the failure to the RuneProof panel and presents one concise message without stack traces or raw error text:

```txt
RuneProof preview is unavailable. The Goal Planner is still available.
```

- [ ] **Step 3: Run the component tests to prove the UI is absent**

```bash
npx vitest run components/questRoutes
```

Expected: FAIL because the components do not exist.

- [ ] **Step 4: Port the four transferred UI components unchanged**

Retain the reviewed markup, responsive classes, wording, controls, and status presentation. Make only compatibility changes required by current FLIM types or imports. Defer visual polish, copy revision, and broader planner redesign.

- [ ] **Step 5: Implement the focused class error boundary**

The boundary catches render failures from the RuneProof panel only. It must not replace the whole Goal Planner and must not reuse the app-wide technical error-details view.

- [ ] **Step 6: Run component tests and accessibility smoke assertions**

```bash
npx vitest run components/questRoutes
```

Expected: PASS, including accessible labels for confirmation controls and actionable map buttons.

- [ ] **Step 7: Commit the transferred UI**

```bash
git add components/questRoutes/QuestRouteMap.tsx components/questRoutes/QuestRouteMap.test.tsx components/questRoutes/QuestWalkthrough.tsx components/questRoutes/QuestWalkthrough.test.tsx components/questRoutes/QuestRequirementChecklist.tsx components/questRoutes/QuestRequirementChecklist.test.tsx components/questRoutes/QuestRoutePanel.tsx components/questRoutes/QuestRoutePanel.test.tsx components/questRoutes/RuneProofErrorBoundary.tsx components/questRoutes/RuneProofErrorBoundary.test.tsx
git commit -m "feat: restore RuneProof preview panel"
```

---

## Task 9: Integrate RuneProof into the current Goal Planner and world map

**Files:**

- Modify: `components/GoalPlannerModal.tsx`
- Modify: `components/GoalPlannerModal.test.tsx`
- Modify: `components/Dashboard.tsx`
- Modify: `utils/chunkLocations.ts`
- Modify: `utils/chunkLocations.test.ts`
- Modify: `services/ChunkContentService.ts`
- Modify: `services/ChunkContentService.test.ts`

- [ ] **Step 1: Add Goal Planner integration tests before changing the component**

Adapt the reviewed transfer tests to current FLIM. Mock only the context values the integration needs (`unlocks`, `gameModeId`, and `runId`) and inject a `RuneProofIntegration` so the tests stay deterministic:

```ts
export interface RuneProofContentService {
  init(): Promise<boolean>;
  itemSourceRecords(itemName: string): readonly ItemSourceRecord[];
  itemSourceCoverage(itemName: string): Coverage;
  entityLocations(name: string, kinds?: EntityKind[]): EntityHit | null;
  taskRequirements(name: string, kind: EntityKind, cx: number, cy: number): string[];
  chunkEntryRequirements(cx: number, cy: number): string[];
  connectGraph(): ConnectGraph;
}

export interface RuneProofIntegration {
  availability: RuneProofAvailability;
  chunkDataVersion: number;
  contentService: RuneProofContentService;
  analyze: typeof analyzeQuest;
  analyzePreparation: typeof analyzeQuestPreparation;
  loadWalkthrough: typeof loadQuestWalkthroughFor;
  walkthroughReleaseFor: typeof questWalkthroughReleaseFor;
}
```

Cover:

- feature OFF renders the current Goal Planner with no RuneProof requests;
- unsupported quests show the current planner only;
- PREVIEW starts one analysis for the selected supported quest;
- quest changes replace the panel data;
- stale asynchronous walkthrough responses are ignored;
- a walkthrough load failure leaves route analysis usable;
- equivalent account and unlock inputs reuse the canonical analysis;
- toggling a confirmation updates checklist presentation without re-analysis;
- confirmation state uses the current `runId` storage key;
- quest changes clear stale walkthrough and route-map focus state;
- “open on world map” invokes the optional callback with the exact chunk.

- [ ] **Step 2: Extend chunk-map handoff tests**

Require `showChunkOnMap()` to request the World tab in map mode before emitting the chunk focus event:

```ts
expect(navListener).toHaveBeenCalledWith(expect.objectContaining({
  detail: { target: 'tab:WORLD', worldView: 'MAP' },
}));
```

Also prove the focused chunk request is consumed once and does not replay on unrelated navigation.

- [ ] **Step 3: Run current planner and navigation tests to capture the failures**

```bash
npx vitest run components/GoalPlannerModal.test.tsx utils/chunkLocations.test.ts components/CommandPalette.test.tsx
```

Expected: FAIL only for the newly asserted RuneProof integration and `worldView: 'MAP'` contract.

- [ ] **Step 4: Add the integration adapter without replacing current planner behavior**

Extend the current props rather than porting the transfer’s older component wholesale:

```ts
interface GoalPlannerModalProps {
  onClose: () => void;
  initialTarget?: { kind: GoalKind; id: string } | null;
  onOpenWorldChunk?: (cx: number, cy: number) => void;
  runeProofIntegration?: RuneProofIntegration;
}
```

Create a default adapter from the current content service, reviewed analyzer, local-only loader, and release metadata. Rename the current private `DATA_REV` constant to exported read-only `CHUNK_CONTENT_DATA_VERSION` and use that same constant in the fetch cache-buster and analysis snapshot; do not duplicate or replace the current service cache.

- [ ] **Step 5: Materialize a stable analysis input and guard async work**

Derive a plain account snapshot from current context fields and canonicalize unlocked chunks before analysis. Use a monotonically increasing request id or cleanup guard so a late walkthrough response cannot replace a newer quest selection.

```ts
const requestId = ++walkthroughRequestRef.current;
const definition = await integration.loadWalkthrough(
  integration.availability,
  walkthroughRelease,
);
if (requestId !== walkthroughRequestRef.current) return;
setWalkthrough(definition);
```

Analysis stays synchronous and memoized by canonical domain inputs. Preview confirmations are read through `useRuneProofPreviewChecks(runId)` and enter checklist presentation only.

- [ ] **Step 6: Mount the panel behind the explicit availability and support checks**

Render the panel only when:

```ts
integration.availability === 'PREVIEW'
  && isRuneProofQuestSupported(selectedQuestId)
  && questWalkthroughReleaseFor(selectedQuestId)?.releaseStatus === 'PREVIEW_ONLY'
```

Wrap just this panel with `RuneProofErrorBoundary`. Preserve all current Goal Planner rows, filters, selection, close behavior, and responsive sizing, applying only the transferred narrow layout compatibility classes needed to fit the panel.

- [ ] **Step 7: Complete the world-map callback path**

Pass `showChunkOnMap` from `Dashboard` into `GoalPlannerModal`. Extend the existing navigation event detail with optional `worldView: 'MAP' | 'LIST'`. When `worldView` is present, honor it; otherwise retain the current World-tab default. Never change unrelated navigation callers.

- [ ] **Step 8: Run planner and navigation regressions**

```bash
npx vitest run components/GoalPlannerModal.test.tsx utils/chunkLocations.test.ts components/CommandPalette.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Locate and run the current world-map tests**

```bash
rg --files components | rg "(RegionMap|World).*test"
```

Run each returned test file with `npx vitest run <files>`, then run:

```bash
npm run typecheck
```

Expected: all located world-map tests and type checking PASS. If the search returns no files, record that result in the implementation notes and rely on the chunk handoff test plus the manual smoke test in Task 10.

- [ ] **Step 10: Commit the planner integration**

```bash
git add components/GoalPlannerModal.tsx components/GoalPlannerModal.test.tsx components/Dashboard.tsx utils/chunkLocations.ts utils/chunkLocations.test.ts
git add services/ChunkContentService.ts services/ChunkContentService.test.ts
git commit -m "feat: integrate RuneProof preview planner"
```

---

## Task 10: Enforce build boundaries and complete acceptance verification

**Files:**

- Create: `.env.runeproof-preview`
- Create: `scripts/check-quest-route-data.mjs`
- Create: `scripts/check-quest-route-data.test.ts`
- Create: `scripts/runeproof-public-bundle.test.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `scripts/player-facing-changelog.test.ts`

- [ ] **Step 1: Add failing route-data and bundle-boundary tests**

Port the reviewed route-data verifier tests. Add an integration test that builds both modes and asserts:

- the normal production bundle does not contain a unique private walkthrough marker or import preview catalogue data;
- the RuneProof preview bundle contains that marker and renders the preview code path;
- each build uses a separate output directory.

Choose one exact, stable marker already present in the reviewed walkthrough source; do not add synthetic copy solely for the test.

- [ ] **Step 2: Run the new verification tests before configuring the build**

```bash
npx vitest run scripts/check-quest-route-data.test.ts scripts/runeproof-public-bundle.test.ts
```

Expected: FAIL because route verification and the preview build boundary are not configured.

- [ ] **Step 3: Add the explicit local preview environment**

Create exactly:

```dotenv
VITE_RUNEPROOF_PREVIEW=1
```

Do not define a public mode. Normal development and production environments leave the variable absent.

- [ ] **Step 4: Add the normal-build replacement plugin**

Convert the existing Vite config to a mode-aware function while preserving the current React, version-json, chunking, and other settings:

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const runeProofPreview = env.VITE_RUNEPROOF_PREVIEW === '1';

  return {
    plugins: [
      react(),
      runeProofPreviewBoundaryPlugin(runeProofPreview),
      emitVersionJsonPlugin(),
    ],
    // preserve the current config below
  };
});
```

In normal mode, the plugin resolves `data/questWalkthroughs.preview-boundary` to `data/questWalkthroughs.public.ts`. In preview mode, it leaves the reviewed preview module intact. Match normalized absolute paths so Windows separators and extension-bearing imports are handled reliably.

- [ ] **Step 5: Add scripts without weakening current release gates**

Update `package.json` with:

```json
{
  "scripts": {
    "build:runeproof-preview": "vite build --mode runeproof-preview --outDir dist-runeproof-preview",
    "quest-routes:verify": "node scripts/check-quest-route-data.mjs",
    "walkthroughs:refresh": "node scripts/sync-quest-walkthroughs.mjs",
    "walkthroughs:verify": "node scripts/sync-quest-walkthroughs.mjs --check"
  }
}
```

Append `npm run quest-routes:verify` and `npm run walkthroughs:verify` to the existing `content:verify` chain. Preserve `release:verify`, `build`, and all current checks. Update only the exact `content:verify` expectation in `scripts/player-facing-changelog.test.ts`.

Add `dist-runeproof-preview/` to `.gitignore`. Do not add the preview build to the normal CI or Pages publishing flow.

- [ ] **Step 6: Verify the focused data and bundle boundaries**

```bash
npx vitest run scripts/check-quest-route-data.test.ts scripts/quest-walkthrough-source.test.ts scripts/runeproof-source-encoding.test.ts scripts/runeproof-public-bundle.test.ts scripts/player-facing-changelog.test.ts
npm run quest-routes:verify
npm run walkthroughs:verify
```

Expected: PASS. Both verification scripts must leave tracked files unchanged.

- [ ] **Step 7: Run the complete automated acceptance sequence**

Run these commands in this order:

```bash
npm test
npm run typecheck
npm run content:verify
npm run build:runeproof-preview
npm run build
```

Expected: every command exits zero. `dist-runeproof-preview/` contains the preview feature; `dist/` is the normal production build and excludes reviewed walkthrough wording.

- [ ] **Step 8: Inspect build output and repository scope**

```bash
npx vitest run scripts/runeproof-public-bundle.test.ts
git status --short
git diff --check
git diff --stat
```

Expected: bundle-boundary test PASS; only the intended implementation files are modified; no generated build output is tracked; no protected-project paths or unrelated user files appear.

Do not create an entry in `data/changelog.ts` for this local-only preview. Revisit the public changelog policy only if a later design promotes RuneProof into a user-facing release.

- [ ] **Step 9: Smoke-test the explicit preview mode**

Start the local preview:

```bash
npm run dev -- --mode runeproof-preview
```

In the browser, verify the full design smoke matrix:

1. Open the Goal Planner and select each of the four supported quests.
2. Confirm requirement, preparation, walkthrough, and map information renders for each quest, including ready, blocked, and incomplete states where the current run produces them.
3. Mark a `PLAYER_OBTAINED` requirement confirmed, verify the checklist changes immediately, then reverse it and verify the row returns.
4. Confirm both Preparation and Quest path map layers, marker selection, target focus, pan/zoom, and selected-chunk details work.
5. Reload and verify a confirmation remains for the same run; switch to a different run and verify it does not leak.
6. Seed corrupt preview storage and verify RuneProof falls back to empty confirmations without changing the run.
7. Block the map image request and verify checklist, route, and walkthrough details remain usable.
8. Use “open on world map” and verify World opens in map view focused on the requested chunk.
9. Rapidly switch supported quests and verify stale walkthrough or map-focus state never appears in the current quest.
10. Force a RuneProof panel render failure in the test harness and verify the planner remains usable with the concise fallback.

Stop only the preview server process started for this task.

- [ ] **Step 10: Smoke-test normal mode exclusion**

Start the ordinary local app:

```bash
npm run dev
```

Verify the current Goal Planner remains unchanged, no RuneProof panel appears, and the four preview walkthroughs are unavailable. Stop only the server process started for this task.

- [ ] **Step 11: Commit the build and verification gates**

```bash
git add .env.runeproof-preview scripts/check-quest-route-data.mjs scripts/check-quest-route-data.test.ts scripts/runeproof-public-bundle.test.ts vite.config.ts package.json .gitignore scripts/player-facing-changelog.test.ts
git commit -m "build: gate RuneProof behind local preview mode"
```

- [ ] **Step 12: Perform the final post-commit verification**

```bash
npm test
npm run typecheck
npm run content:verify
npm run build:runeproof-preview
npm run build
git status --short
```

Expected: all commands PASS. The only status entries allowed are unrelated files that were already present before implementation; the RuneProof implementation itself is fully committed. Keep execution local—do not push, deploy, publish, or open a pull request without a separate user request.
