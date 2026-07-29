# RuneProof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a proof-carrying Fate Locked goal engine that determines exactly what the current reachable chunks make obtainable, explains minimal blockers, preserves alternative valid routes, and exports compact verifiable proofs to the RuneLite plugin.

**Architecture:** The web app owns an audited, versioned AND/OR constraint graph. It compiles the current run into immutable facts, calculates exact reachable locations, evaluates ordinary goals with a deterministic fixed-point engine, and selectively performs bounded blocker/alternative analysis. Every positive result includes a replayable witness; negative results become `IMPOSSIBLE` only when all relevant source families have verified coverage. RuneLite never solves—it validates proof freshness and displays the app-authored result.

**Tech Stack:** TypeScript 5, React 19, Vite, Vitest, Web Workers, Java 11, Gson, JUnit 5, Gradle.

## Global Constraints

- The quest/chunk source audit in `docs/superpowers/plans/2026-07-28-quest-and-chunk-source-audit.md` is a hard prerequisite. Do not implement RuneProof against unaudited chunk or quest data.
- Reason only about the current run revision and current reachable chunks. Do not recommend future rolls, Key-table purchases, unlock-rule changes, or hypothetical regions.
- Treat an unlocked but stranded surface chunk as unavailable.
- Model dungeons, basements, islands, quest instances, and other interiors as gated child locations of an exact reachable entrance. Interior coordinates never imply a separate Fate Locked roll.
- Model capability, not possession. Inventory, bank, equipment contents, and consumable stock are out of scope.
- Preserve every valid acquisition route. Rank only the preferred route, using: deterministic; fewer prerequisites; fewer recursive ingredients; shorter reachable-chunk route; higher RNG probability; stable route ID.
- Emit `OBTAINABLE_RNG` only when no fully deterministic route exists.
- Emit `IMPOSSIBLE` only when coverage is verified for the goal and every explored dependency. Missing or unaudited evidence emits `UNKNOWN`.
- Reject unsupported recursive cycles; do not turn a cycle into evidence.
- Do not add gameplay automation to RuneLite.
- Do not add a SAT dependency until the bounded hypergraph solver is benchmarked and a checked-in fixture demonstrates a correctness or performance need it cannot meet.

---

## Task 1: Enforce the audited-data prerequisite

**Files:**

- Create: `data/runeProofSourceAudit.ts`
- Create: `data/runeProofSourceAudit.test.ts`
- Create: `utils/runeproof/sourceGate.ts`
- Test: `utils/runeproof/sourceGate.test.ts`

- [ ] Verify the prerequisite branch has completed all checks from `2026-07-28-quest-and-chunk-source-audit.md`:

```powershell
npm test -- --run scripts/chunk-source.test.ts scripts/chunk-content-transform.test.ts data/questRequirementAudit.test.ts data/contentBaseline.test.ts utils/questDoability.test.ts
```

Expected: all audit and cross-surface tests pass. If any test or file is absent, stop this plan and execute the prerequisite plan first.

- [ ] Write the failing source-gate tests:

```ts
import { describe, expect, it } from 'vitest';
import { requireRuneProofSources } from './sourceGate';

describe('requireRuneProofSources', () => {
  it('accepts a verified snapshot', () => {
    expect(requireRuneProofSources({
      sourceVersion: 'osrs-2026-07-29',
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'VERIFIED',
    }).sourceVersion).toBe('osrs-2026-07-29');
  });

  it('rejects data that could create a false impossibility claim', () => {
    expect(() => requireRuneProofSources({
      sourceVersion: 'draft',
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'PARTIAL',
    })).toThrow('RuneProof requires verified acquisition coverage');
  });
});
```

- [ ] Run the test and confirm it fails because `sourceGate.ts` does not exist:

```powershell
npm test -- --run utils/runeproof/sourceGate.test.ts
```

- [ ] Implement the narrow gate:

```ts
export type AuditCoverage = 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';

export interface RuneProofSourceAudit {
  sourceVersion: string;
  questCoverage: AuditCoverage;
  chunkCoverage: AuditCoverage;
  acquisitionCoverage: AuditCoverage;
}

export function requireRuneProofSources(
  audit: RuneProofSourceAudit,
): RuneProofSourceAudit {
  const checks: Array<[keyof RuneProofSourceAudit, string]> = [
    ['questCoverage', 'quest'],
    ['chunkCoverage', 'chunk'],
    ['acquisitionCoverage', 'acquisition'],
  ];
  for (const [key, label] of checks) {
    if (audit[key] !== 'VERIFIED') {
      throw new Error(`RuneProof requires verified ${label} coverage`);
    }
  }
  return Object.freeze({ ...audit });
}
```

- [ ] Implement `data/runeProofSourceAudit.ts` as a pure adapter over the checked-in chunk transform audit and quest requirement audit. Set acquisition coverage to `VERIFIED` only after the acquisition-source checks added in Task 5 pass; until then initialization must remain gated.

- [ ] Run the focused and prerequisite tests:

```powershell
npm test -- --run utils/runeproof/sourceGate.test.ts data/runeProofSourceAudit.test.ts data/questRequirementAudit.test.ts data/contentBaseline.test.ts
```

- [ ] Commit:

```powershell
git add data/runeProofSourceAudit.ts data/runeProofSourceAudit.test.ts utils/runeproof/sourceGate.ts utils/runeproof/sourceGate.test.ts
git commit -m "test: gate RuneProof on audited source coverage"
```

---

## Task 2: Define the canonical proof model

**Files:**

- Create: `utils/runeproof/model.ts`
- Create: `utils/runeproof/model.test.ts`

- [ ] Write tests that enforce stable IDs, status invariants, and unknown-safe coverage:

```ts
import { describe, expect, it } from 'vitest';
import {
  assertRuneProofReport,
  factId,
  type RuneProofReport,
} from './model';

describe('RuneProof model', () => {
  it('builds stable normalized fact IDs', () => {
    expect(factId('ITEM', 'Oak plank')).toBe('item:oak-plank');
  });

  it('rejects impossible reports without verified coverage', () => {
    const report = {
      goalId: 'item:oak-plank',
      status: 'IMPOSSIBLE',
      coverage: 'PARTIAL',
      routes: [],
      blockers: [],
    } as unknown as RuneProofReport;
    expect(() => assertRuneProofReport(report)).toThrow(
      'IMPOSSIBLE requires VERIFIED coverage',
    );
  });
});
```

- [ ] Run the test and confirm the missing-module failure:

```powershell
npm test -- --run utils/runeproof/model.test.ts
```

- [ ] Implement these canonical interfaces in `model.ts`:

```ts
export type RuneProofStatus =
  | 'OBTAINABLE'
  | 'OBTAINABLE_RNG'
  | 'BLOCKED'
  | 'IMPOSSIBLE'
  | 'UNKNOWN';

export type Coverage = 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
export type FactKind =
  | 'ITEM'
  | 'QUEST'
  | 'SKILL_LEVEL'
  | 'UNLOCK'
  | 'LOCATION'
  | 'CAPABILITY';
export type SourceKind =
  | 'SHOP'
  | 'DROP'
  | 'SPAWN'
  | 'PRODUCTION'
  | 'GATHERING'
  | 'QUEST_REWARD'
  | 'MINIGAME'
  | 'PICKPOCKET'
  | 'CLUE';

export interface FactRef {
  id: string;
  kind: FactKind;
  label: string;
  quantity?: number;
}

export type RequirementExpr =
  | { op: 'FACT'; fact: FactRef }
  | { op: 'ALL'; terms: RequirementExpr[] }
  | { op: 'ANY'; terms: RequirementExpr[] };

export interface LocationRef {
  id: string;
  label: string;
  surfaceChunk: string;
  parentId?: string;
}

export interface AcquisitionRule {
  id: string;
  output: FactRef;
  outputQuantity: number;
  sourceKind: SourceKind;
  sourceLabel: string;
  locationId: string;
  requirements: RequirementExpr;
  repeatability: 'REPEATABLE' | 'ONE_TIME' | 'UNKNOWN';
  probability: number | null;
  coverage: Coverage;
  provenanceIds: string[];
}

export interface WitnessStep {
  ruleId: string;
  proves: FactRef;
  chosenTerms: string[];
  childStepIds: string[];
}

export interface ProofWitness {
  rootFactId: string;
  steps: Record<string, WitnessStep>;
  sourceVersion: string;
  runId: string;
  runRevision: number;
  proofHash: string;
}

export interface ProofRoute {
  id: string;
  deterministic: boolean;
  prerequisiteCount: number;
  recursiveIngredientCount: number;
  travelDistance: number;
  probability: number | null;
  witness: ProofWitness;
}

export interface MinimalBlocker {
  factIds: string[];
  labels: string[];
}

export interface RuneProofReport {
  goalId: string;
  status: RuneProofStatus;
  coverage: Coverage;
  routes: ProofRoute[];
  blockers: MinimalBlocker[];
  unavoidableBlockerFactIds: string[];
  routesComplete: boolean;
  explanation?: string;
}
```

- [ ] Add `normalizeId`, `factId`, `assertRequirementExpr`, and `assertRuneProofReport`. Enforce:

  - `OBTAINABLE` has a deterministic first route.
  - `OBTAINABLE_RNG` has routes and none are deterministic.
  - `BLOCKED` has at least one blocker.
  - `IMPOSSIBLE` requires `VERIFIED` coverage and `routesComplete: true`.
  - `UNKNOWN` cannot claim complete minimal blockers.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/model.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add utils/runeproof/model.ts utils/runeproof/model.test.ts
git commit -m "feat: define RuneProof proof model"
```

---

## Task 3: Compile the current Fate Locked run into immutable facts

**Files:**

- Create: `utils/runeproof/runSnapshot.ts`
- Create: `utils/runeproof/runSnapshot.test.ts`
- Modify: `types.ts`

- [ ] Add failing tests proving the snapshot includes current restrictions but never possession:

```ts
it('captures only rule capabilities from the current revision', () => {
  const snapshot = buildRuneProofRunSnapshot(gameState);
  expect(snapshot.runId).toBe(gameState.runId);
  expect(snapshot.runRevision).toBe(gameState.runRevision);
  expect(snapshot.unlockedChunks).toEqual(
    [...(gameState.unlocks.chunks ?? [])].sort(),
  );
  expect(snapshot.completedQuests).toEqual(
    [...gameState.unlocks.quests].sort(),
  );
  expect(snapshot).not.toHaveProperty('inventory');
  expect(snapshot).not.toHaveProperty('bank');
});
```

- [ ] Run and confirm failure:

```powershell
npm test -- --run utils/runeproof/runSnapshot.test.ts
```

- [ ] Define `RuneProofRunSnapshot` with `runId`, `runRevision`, `gameModeId`, sorted unlocked chunks/areas/banks, completed quests, skill caps, current levels, and every Fate Locked rule category already represented by `UnlockState`.

- [ ] Implement `buildRuneProofRunSnapshot(state: GameState)` as a pure canonicalizing function. Freeze nested arrays and records. Do not read React context inside the function.

- [ ] Add an optional, versioned `runeProof?: { selectedGoalId?: string }` UI preference to `GameState` only if persistence is needed; do not store generated proofs in run state.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/runSnapshot.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add types.ts utils/runeproof/runSnapshot.ts utils/runeproof/runSnapshot.test.ts
git commit -m "feat: snapshot current Fate Locked capabilities"
```

---

## Task 4: Build exact surface and child-location reachability

**Files:**

- Create: `utils/runeproof/locationGraph.ts`
- Create: `utils/runeproof/locationGraph.test.ts`
- Modify: `services/ChunkContentService.ts`
- Modify: `public/chunk-content.json`

- [ ] Extend the audited source schema with directed, requirement-bearing edges:

```ts
export interface LocationNodeSource {
  id: string;
  label: string;
  surfaceChunk: string;
  parentId?: string;
  coverage: 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
}

export interface LocationEdgeSource {
  id: string;
  from: string;
  to: string;
  requirements: RequirementExpr;
  bidirectional: boolean;
  provenanceIds: string[];
}
```

- [ ] Write failing fixtures for:

  - two adjacent unlocked chunks are reachable from the start;
  - an unlocked disconnected chunk is stranded;
  - a dungeon is reachable only through its reachable entrance and satisfied gate;
  - an interior coordinate does not require a separate chunk unlock;
  - a boat or teleport edge remains blocked when its exact requirements fail.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/locationGraph.test.ts
```

- [ ] Add typed `locationNodes()` and `locationEdges()` accessors to `ChunkContentService`. Keep the legacy `connectGraph()` method for existing consumers, but do not use it as proof-grade evidence.

- [ ] Implement `calculateReachability(graph, snapshot)` with breadth-first traversal over satisfied directed edges. Return:

```ts
export interface ReachabilityResult {
  reachable: ReadonlySet<string>;
  strandedSurfaceChunks: ReadonlySet<string>;
  distance: ReadonlyMap<string, number>;
  predecessorEdge: ReadonlyMap<string, string>;
  coverage: Coverage;
}
```

- [ ] Make missing edge requirements and partial location coverage propagate `UNKNOWN`; never assume an unlabelled transport edge is usable.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/locationGraph.test.ts utils/chunkReach.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add services/ChunkContentService.ts public/chunk-content.json utils/runeproof/locationGraph.ts utils/runeproof/locationGraph.test.ts
git commit -m "feat: add proof-grade location reachability"
```

---

## Task 5: Compile audited acquisition data into the constraint graph

**Files:**

- Create: `utils/runeproof/acquisitionIndex.ts`
- Create: `utils/runeproof/acquisitionIndex.test.ts`
- Create: `scripts/build-runeproof-sources.mjs`
- Create: `public/runeproof-sources.json`
- Modify: `package.json`
- Modify: `services/ChunkContentService.ts`
- Modify: `data/runeProofSourceAudit.ts`
- Modify: `data/runeProofSourceAudit.test.ts`

- [ ] Write failing tests proving source compilation:

  - resolves shop stock to the exact shop location;
  - resolves drops to the exact monster location;
  - resolves floor spawns directly to their location;
  - recursively records production inputs and output quantities;
  - preserves one-time and repeatability metadata;
  - refuses region-only or `"Any"` locations as proof-grade evidence;
  - carries provenance and per-rule coverage.

- [ ] Add these scripts:

```json
{
  "runeproof:sources": "node scripts/build-runeproof-sources.mjs",
  "runeproof:check": "node scripts/build-runeproof-sources.mjs --check"
}
```

- [ ] Compile the audited quest/chunk snapshot, exact `shopItems`, exact `drops`, exact spawns, audited production recipes, and reviewed Resource Engine entries into `public/runeproof-sources.json`.

- [ ] Give each rule a deterministic ID derived from output, source kind, source host, and location ID. Sort every emitted map and array so identical input produces byte-identical JSON.

- [ ] Export a `RuneProofSourceDocument` accessor from `ChunkContentService` rather than exposing the private raw document.

- [ ] Run and inspect the first expected failure from unresolvable legacy Resource Engine sources:

```powershell
npm run runeproof:sources
npm test -- --run utils/runeproof/acquisitionIndex.test.ts
```

- [ ] Classify every unresolved entry as `PARTIAL`/`UNKNOWN`; do not guess its chunk. Keep it searchable but exclude it from `IMPOSSIBLE` evidence until reviewed.

- [ ] Verify deterministic generation:

```powershell
npm run runeproof:check
npm test -- --run utils/runeproof/acquisitionIndex.test.ts data/runeProofSourceAudit.test.ts
```

- [ ] Commit:

```powershell
git add package.json scripts/build-runeproof-sources.mjs public/runeproof-sources.json services/ChunkContentService.ts data/runeProofSourceAudit.ts data/runeProofSourceAudit.test.ts utils/runeproof/acquisitionIndex.ts utils/runeproof/acquisitionIndex.test.ts
git commit -m "feat: compile audited RuneProof acquisition sources"
```

---

## Task 6: Implement fixed-point obtainability and route ranking

**Files:**

- Create: `utils/runeproof/evaluator.ts`
- Create: `utils/runeproof/evaluator.test.ts`
- Create: `utils/runeproof/ranking.ts`
- Create: `utils/runeproof/ranking.test.ts`

- [ ] Write failing evaluator tests for direct sources, `ALL`, `ANY`, quantities, recursive ingredients, one-time rewards, RNG fallback, and cycles.

- [ ] Define the route comparator exactly:

```ts
export function compareRoutes(a: ProofRoute, b: ProofRoute): number {
  return Number(b.deterministic) - Number(a.deterministic)
    || a.prerequisiteCount - b.prerequisiteCount
    || a.recursiveIngredientCount - b.recursiveIngredientCount
    || a.travelDistance - b.travelDistance
    || (b.probability ?? 0) - (a.probability ?? 0)
    || a.id.localeCompare(b.id);
}
```

- [ ] Implement a monotone fixed-point evaluator:

  1. Seed facts supplied by the run snapshot and reachable locations.
  2. Evaluate acquisition rules in stable ID order.
  3. Add a fact when at least one rule's expression is satisfied.
  4. Retain every non-dominated route family and group equivalent display routes without discarding their witness identities.
  5. Continue until no new fact or route is added.
  6. Mark a recursive strongly connected component unsupported unless it contains an externally seeded or independently provable fact.
  7. Apply a hard safety limit only to prevent resource exhaustion. If it is exceeded, set `routesComplete: false`, emit `UNKNOWN`, and include a diagnostic; never silently truncate a complete answer.

- [ ] Ensure quantity multiplication uses integer ceiling:

```ts
const operations = Math.ceil(requiredQuantity / rule.outputQuantity);
```

- [ ] Treat `repeatability: 'ONE_TIME'` as able to prove at most its known reward quantity. Treat `UNKNOWN` repeatability as partial coverage for quantities above the known output.

- [ ] Calculate route probability only when every stochastic edge has numeric probability; otherwise retain `null` and rank it below known probabilities after the deterministic routes.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/evaluator.test.ts utils/runeproof/ranking.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add utils/runeproof/evaluator.ts utils/runeproof/evaluator.test.ts utils/runeproof/ranking.ts utils/runeproof/ranking.test.ts
git commit -m "feat: evaluate and rank obtainable routes"
```

---

## Task 7: Generate and replay proof certificates

**Files:**

- Create: `utils/runeproof/proof.ts`
- Create: `utils/runeproof/proof.test.ts`
- Create: `utils/runeproof/canonicalJson.ts`
- Create: `utils/runeproof/canonicalJson.test.ts`

- [ ] Write failing tests proving:

  - a witness replays from root to run facts without consulting evaluator state;
  - deleting a child step makes verification fail;
  - changing `runRevision` makes the certificate stale;
  - changing source version makes the certificate stale;
  - identical proof content produces the same SHA-256 hash.

- [ ] Implement a canonical JSON serializer that recursively sorts object keys, preserves array order, rejects `undefined`, and normalizes negative zero.

- [ ] Implement:

```ts
export interface VerifyProofInput {
  witness: ProofWitness;
  rules: ReadonlyMap<string, AcquisitionRule>;
  runFacts: ReadonlySet<string>;
  runId: string;
  runRevision: number;
  sourceVersion: string;
}

export interface VerifyProofResult {
  valid: boolean;
  stale: boolean;
  errors: string[];
}
```

- [ ] Verify each witness step by loading its rule, checking the rule proves the named fact, resolving all chosen `ALL`/`ANY` terms, and requiring each leaf to be either a run fact or another valid witness step.

- [ ] Detect repeated step traversal and fail closed on cycles.

- [ ] Use the browser Web Crypto SHA-256 API in production and a test-compatible implementation under Vitest. Hash the canonical witness with `proofHash` omitted.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/proof.test.ts utils/runeproof/canonicalJson.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add utils/runeproof/proof.ts utils/runeproof/proof.test.ts utils/runeproof/canonicalJson.ts utils/runeproof/canonicalJson.test.ts
git commit -m "feat: generate replayable RuneProof certificates"
```

---

## Task 8: Compute exact minimal blockers selectively

**Files:**

- Create: `utils/runeproof/blockers.ts`
- Create: `utils/runeproof/blockers.test.ts`

- [ ] Write failing tests for minimal blocker antichains:

```ts
it('removes blocker supersets', () => {
  expect(minimizeBlockerSets([
    new Set(['item:plank']),
    new Set(['item:plank', 'skill:construction:15']),
    new Set(['location:shop']),
  ])).toEqual([
    ['item:plank'],
    ['location:shop'],
  ]);
});
```

- [ ] Implement recursive blocker analysis over the failed AND/OR graph:

  - a failed `FACT` contributes one blocker set;
  - failed `ALL` combines child blocker alternatives by cartesian union;
  - failed `ANY` must block every alternative, so combine one blocker set from each branch;
  - after every merge, normalize IDs, deduplicate, and remove strict supersets.

- [ ] Bound combinatorial growth with `maxBlockerSets = 128` and `maxSetSize = 16`. If either bound is exceeded, return `UNKNOWN` with a diagnostic; do not claim minimality.

- [ ] Calculate unavoidable blockers as the sorted intersection of every inclusion-minimal blocker set. Sort blocker sets by cardinality first so the smallest set is presented first.

- [ ] Classify a fully covered goal with no valid route as:

  - `BLOCKED` when at least one minimal blocker references a current-run fact that could already be satisfied by a current reachable route but is gated by an unmet level/quest/rule;
  - `IMPOSSIBLE` when every acquisition branch is eliminated by current-run restrictions, coverage is verified, and route enumeration is complete;
  - `UNKNOWN` whenever explored coverage is not verified.

- [ ] Do not implement “cheapest rule change.” The public UI wording is “Why can’t I do this now?” and “Smallest missing requirements,” not unlock advice.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/blockers.test.ts utils/runeproof/evaluator.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add utils/runeproof/blockers.ts utils/runeproof/blockers.test.ts
git commit -m "feat: explain minimal current-run blockers"
```

---

## Task 9: Compile item, quest, diary, and activity goals

**Files:**

- Create: `utils/runeproof/goalCompiler.ts`
- Create: `utils/runeproof/goalCompiler.test.ts`
- Modify: `data/questData.ts`
- Modify: `data/diaryData.ts`

- [ ] Write failing compiler tests proving:

  - quest skills, prerequisite quests, exact step locations, and required items become one `ALL` expression;
  - quest alternatives become `ANY`;
  - item quantities are retained;
  - incomplete manual requirements force `UNKNOWN`;
  - diary/activity goals share the same expression model.

- [ ] Add structured item requirements to audited quest data:

```ts
export interface ItemRequirement {
  item: string;
  quantity: number;
  consumed: boolean;
}

export interface QuestData {
  // existing fields remain
  items?: ItemRequirement[];
  itemAlternatives?: ItemRequirement[][];
  requirementCoverage?: Coverage;
}
```

- [ ] Implement:

```ts
export type GoalKind = 'ITEM' | 'QUEST' | 'DIARY' | 'ACTIVITY';

export interface CompiledGoal {
  id: string;
  kind: GoalKind;
  label: string;
  requirement: RequirementExpr;
  coverage: Coverage;
  provenanceIds: string[];
}
```

- [ ] Reuse audited `QuestData` and diary structures as inputs. Do not parse natural-language `manualRequirements` into facts at runtime.

- [ ] Keep unstructured or disputed requirements visible in provenance and downgrade coverage to `PARTIAL`.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/goalCompiler.test.ts utils/journalStatus.test.ts data/tasksConsistency.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add data/questData.ts data/diaryData.ts utils/runeproof/goalCompiler.ts utils/runeproof/goalCompiler.test.ts
git commit -m "feat: compile goals into RuneProof constraints"
```

---

## Task 10: Add the asynchronous RuneProof engine facade

**Files:**

- Create: `utils/runeproof/engine.ts`
- Create: `utils/runeproof/engine.test.ts`
- Create: `workers/runeproof.worker.ts`
- Create: `services/RuneProofService.ts`
- Create: `services/RuneProofService.test.ts`

- [ ] Write failing facade tests for initialization, query cancellation, cache identity, and stale revision rejection.

- [ ] Expose this app-facing API:

```ts
export interface RuneProofQuery {
  goal: CompiledGoal;
  includeAlternatives?: boolean;
  includeBlockers?: boolean;
}

export interface RuneProofEngine {
  evaluate(
    query: RuneProofQuery,
    snapshot: RuneProofRunSnapshot,
    signal?: AbortSignal,
  ): Promise<RuneProofReport>;
}
```

- [ ] Implement pure `evaluateRuneProof` orchestration in `engine.ts`: source gate, location reachability, acquisition index, fixed point, proof construction, proof replay, status classification.

- [ ] Move orchestration into `runeproof.worker.ts`. Use structured-cloneable arrays and records across the worker boundary; reconstruct maps/sets inside the worker.

- [ ] Cache immutable compiled source data by `sourceVersion`. Cache reports only by:

```ts
`${sourceVersion}|${runId}|${runRevision}|${goal.id}|${flags}`
```

- [ ] Abort superseded searches and discard any response whose run revision no longer matches current state.

- [ ] If workers are unavailable, use the same pure engine on the main thread and preserve identical results.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/engine.test.ts services/RuneProofService.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add utils/runeproof/engine.ts utils/runeproof/engine.test.ts workers/runeproof.worker.ts services/RuneProofService.ts services/RuneProofService.test.ts
git commit -m "feat: expose asynchronous RuneProof evaluation"
```

---

## Task 11: Prove the plank scenario end to end

**Files:**

- Create: `utils/runeproof/fixtures/plank.ts`
- Create: `utils/runeproof/runeproof.integration.test.ts`

- [ ] Add the canonical fixture:

  - the goal requires one plank;
  - no plank-selling shop is reachable;
  - Construction and production are unavailable;
  - a verified monster drop exists in a reachable current chunk;
  - the source has no unavailable child-location gate.

- [ ] Assert:

```ts
expect(report.status).toBe('OBTAINABLE_RNG');
expect(Object.values(report.routes[0].witness.steps)).toContainEqual(
  expect.objectContaining({ proves: expect.objectContaining({ id: 'item:plank' }) }),
);
expect(verifyResult).toEqual({ valid: true, stale: false, errors: [] });
expect(report.explanation).not.toContain('unlock');
```

- [ ] Add adjacent fixtures:

  - deterministic floor spawn beats an RNG drop;
  - a drop in an unlocked but stranded chunk is excluded;
  - a drop inside a gated dungeon is excluded until the entrance and gate are valid;
  - all known sources excluded plus verified coverage yields `IMPOSSIBLE`;
  - the same graph with partial source coverage yields `UNKNOWN`;
  - a production cycle with no seed yields no proof.

- [ ] Run the integration suite twice to verify deterministic output:

```powershell
npm test -- --run utils/runeproof/runeproof.integration.test.ts
npm test -- --run utils/runeproof/runeproof.integration.test.ts
```

- [ ] Commit:

```powershell
git add utils/runeproof/fixtures/plank.ts utils/runeproof/runeproof.integration.test.ts
git commit -m "test: prove current-chunk plank acquisition"
```

---

## Task 12: Replace the Goal Planner experience with RuneProof

**Files:**

- Create: `components/RuneProofModal.tsx`
- Create: `components/RuneProofModal.test.tsx`
- Create: `components/runeproof/ProofStatusCard.tsx`
- Create: `components/runeproof/ProofRouteList.tsx`
- Create: `components/runeproof/BlockerList.tsx`
- Modify: `components/Dashboard.tsx`
- Modify: `App.tsx`

- [ ] Write UI tests for:

  - searching items, quests, diaries, and activities;
  - loading and cancellation;
  - `OBTAINABLE`, `OBTAINABLE_RNG`, `BLOCKED`, `IMPOSSIBLE`, and `UNKNOWN`;
  - alternatives collapsed by default;
  - no future-unlock or Key-table suggestion;
  - stale results disappear when `runRevision` changes.

- [ ] Use player-facing labels:

  - `OBTAINABLE`: “Obtainable now”
  - `OBTAINABLE_RNG`: “Obtainable now — random drop”
  - `BLOCKED`: “Missing requirements”
  - `IMPOSSIBLE`: “No valid route in your current chunks”
  - `UNKNOWN`: “Not enough verified data”

- [ ] Show the preferred route as numbered steps. Each step includes source, exact chunk/section, required capability, quantity, RNG rate when known, and provenance disclosure.

- [ ] Show alternative routes in a collapsed “Other valid routes” section. Show minimal blockers as separate compact cards, with requirements shared by every blocked route labelled “Unavoidable.” The UI may render the first 32 ranked route families initially, but the engine result remains complete and can page the rest.

- [ ] Keep proof jargon out of the primary UI. Put source version, run revision, proof hash, and replay status in an expandable “Verification details” section.

- [ ] Replace the Dashboard entry point labelled Goal Planner with “RuneProof.” Keep the current `GoalPlannerModal` reachable behind a development-only comparison flag until Task 13 completes.

- [ ] Run:

```powershell
npm test -- --run components/RuneProofModal.test.tsx
npm run typecheck
npm run build
```

- [ ] Commit:

```powershell
git add App.tsx components/Dashboard.tsx components/RuneProofModal.tsx components/RuneProofModal.test.tsx components/runeproof
git commit -m "feat: add RuneProof goal experience"
```

---

## Task 13: Retire conflicting planner heuristics

**Files:**

- Modify: `utils/goalPlanner.ts`
- Modify: `utils/goalRoute.ts`
- Modify: `utils/supplyChain.ts`
- Modify: `components/GoalPlannerModal.tsx`
- Modify: `components/GoalRouteView.tsx`
- Create: `utils/runeproof/legacyParity.test.ts`
- Modify: affected tests and callers

- [ ] Add characterization tests comparing legacy answers with RuneProof across a checked-in corpus of at least 25 goals.

- [ ] Categorize every difference as:

  - RuneProof fixes an approximation;
  - RuneProof is `UNKNOWN` because proof coverage is incomplete;
  - source data is wrong and must be corrected before migration.

- [ ] Change Resource Engine and journal surfaces to consume RuneProof reports when they state current-run obtainability. Preserve unrelated browsing and collection features.

- [ ] Remove future unlock suggestions from the RuneProof path, including calls to `suggestTables`. Do not delete Key-table functionality used elsewhere in Fate Locked.

- [ ] Remove the development comparison flag and old Goal Planner entry point after the corpus has no unexplained conflicts. Delete dead components only when no production imports remain.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/legacyParity.test.ts utils/goalPlanner.test.ts utils/goalRoute.test.ts
npm test -- --run
npm run typecheck
```

- [ ] Commit:

```powershell
git add utils/goalPlanner.ts utils/goalRoute.ts utils/supplyChain.ts utils/runeproof/legacyParity.test.ts components/GoalPlannerModal.tsx components/GoalRouteView.tsx
git add -u
git commit -m "refactor: make RuneProof the canonical goal engine"
```

---

## Task 14: Export compact proofs in the app bundle

**Files:**

- Modify: `utils/runeliteRulesManifest.ts`
- Modify: `utils/runeliteRulesManifest.test.ts`
- Modify: `utils/runeliteBundle.ts`
- Modify: `utils/runeliteBundle.test.ts`
- Modify: `components/RunelitePairingDialog.tsx`
- Modify: `components/RunelitePairingDialog.test.tsx`

- [ ] Add failing bundle tests for a compact proof summary:

```ts
export interface RuneProofBundleSummary {
  goalId: string;
  goalLabel: string;
  status: RuneProofStatus;
  explanation: string;
  routeLabels: string[];
  blockerLabels: string[];
  unavoidableBlockerLabels: string[];
  proofHash: string | null;
  sourceVersion: string;
  runRevision: number;
}
```

- [ ] Add `runeProof?: RuneProofBundleSummary[]` to the canonical rules manifest and normalize summaries by goal ID.

- [ ] Export only the current selected/pinned proofs, capped at 20. Do not export the full constraint graph, source database, or solver state.

- [ ] Increment `CONTENT_VERSION`; increment `RULES_VERSION` only if existing manifest compatibility tests demonstrate the wire contract requires it.

- [ ] Before export, replay each positive proof and omit any invalid or stale summary. Export `UNKNOWN` for a selected goal whose current proof cannot be verified.

- [ ] Show proof count and source version in the sync modal.

- [ ] Run:

```powershell
npm test -- --run utils/runeliteRulesManifest.test.ts utils/runeliteBundle.test.ts
npm run typecheck
```

- [ ] Commit:

```powershell
git add utils/runeliteRulesManifest.ts utils/runeliteRulesManifest.test.ts utils/runeliteBundle.ts utils/runeliteBundle.test.ts components/RunelitePairingDialog.tsx components/RunelitePairingDialog.test.tsx
git commit -m "feat: export compact RuneProof summaries"
```

---

## Task 15: Display proof results in RuneLite without solving

**Repository:** `C:\Users\alexa\Downloads\flitest-main\RS3-Fate-Locked-Runelite`

**Files:**

- Modify: `src/main/java/com/fatelocked/rules/RuneliteRulesManifest.java`
- Create: `src/main/java/com/fatelocked/rules/RuneProofSummary.java`
- Create: `src/test/java/com/fatelocked/rules/RuneProofSummaryTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedBundle.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPanel.java`
- Modify: `src/test/java/com/fatelocked/FateLockedBundleTest.java`

- [ ] Before editing, confirm the plugin worktree and branch. Preserve the existing untracked `.superpowers` file:

```powershell
git status --short --branch
```

- [ ] Add failing Java tests proving:

  - Gson parses every status;
  - normalization sorts summaries by goal ID and makes lists immutable;
  - a summary with a different `runRevision` is stale;
  - a positive summary without a proof hash displays as unverified;
  - unknown fields from future app versions remain forward compatible.

- [ ] Implement `RuneProofSummary` as a normalized data class containing only the exported display fields.

- [ ] Add a `runeProof` list to `RuneliteRulesManifest`. Normalize to an empty immutable list when absent so older app bundles still load.

- [ ] Add `FateLockedBundle.getRuneProofSummaries()` and:

```java
public boolean isRuneProofFresh(RuneProofSummary summary)
{
    return summary != null
        && summary.getRunRevision() == runRevision
        && summary.getSourceVersion() != null
        && !summary.getSourceVersion().trim().isEmpty();
}
```

- [ ] Add a collapsed “RUNEPROOF” panel section. Display goal, status, one-line explanation, preferred route labels, blocker labels, and a fresh/stale/unverified badge.

- [ ] Do not port the graph, fixed-point evaluator, blocker enumeration, or SHA-256 proof replay into RuneLite. The plugin validates identity/freshness and renders the app-authored certificate summary.

- [ ] Run:

```powershell
.\gradlew.bat test
```

- [ ] Commit in the plugin repository:

```powershell
git add src/main/java/com/fatelocked/rules/RuneliteRulesManifest.java src/main/java/com/fatelocked/rules/RuneProofSummary.java src/main/java/com/fatelocked/FateLockedBundle.java src/main/java/com/fatelocked/FateLockedPanel.java src/test/java/com/fatelocked/rules/RuneProofSummaryTest.java src/test/java/com/fatelocked/FateLockedBundleTest.java
git commit -m "feat: display RuneProof summaries"
```

---

## Task 16: Validate performance and decide whether SAT is justified

**Files:**

- Create: `utils/runeproof/performance.test.ts`
- Create: `docs/runeproof-performance.md`

- [ ] Add deterministic benchmarks using the full audited source graph:

  - cold source compilation;
  - ordinary direct-item goal;
  - deeply recursive production goal;
  - quest with alternatives;
  - worst checked-in blocker fixture;
  - 20 pinned proof exports.

- [ ] Use these acceptance budgets on a typical development machine:

  - cached ordinary query: under 50 ms;
  - cold ordinary query: under 250 ms;
  - bounded blocker query: under 1 second;
  - worker keeps the React UI responsive;
  - no fixture exceeds the configured route/blocker bounds silently;
  - a bound breach returns `UNKNOWN` with `routesComplete: false`.

- [ ] Record median and 95th percentile over 20 runs in `docs/runeproof-performance.md`.

- [ ] Add a SAT or pseudo-Boolean library only if a checked-in fixture exceeds a bound or the hypergraph method cannot produce the exact required result. If added, keep it behind:

```ts
export interface AlternativeSolver {
  minimalBlockers(goal: CompiledGoal, context: SolverContext): SolverResult;
}
```

The fixed-point evaluator and proof replay remain authoritative regardless of the alternative solver.

- [ ] Run:

```powershell
npm test -- --run utils/runeproof/performance.test.ts
npm run build
```

- [ ] Commit:

```powershell
git add utils/runeproof/performance.test.ts docs/runeproof-performance.md package.json package-lock.json
git commit -m "perf: validate RuneProof selective solving"
```

---

## Task 17: Complete cross-repository release verification

**App files:**

- Modify: `README.md`
- Modify: `data/changelog.ts`
- Create: `docs/runeproof.md`

**Plugin files:**

- Modify: `README.md`

- [ ] Document:

  - what “current chunks” means;
  - why stranded chunks do not count;
  - child-location semantics;
  - capability versus possession;
  - status meanings;
  - proof verification and freshness;
  - coverage limitations and `UNKNOWN`;
  - absence of future unlock advice and gameplay automation.

- [ ] Run full app verification:

```powershell
npm run runeproof:check
npm test -- --run
npm run typecheck
npm run build
npm run release:verify
```

- [ ] Run full plugin verification:

```powershell
.\gradlew.bat clean test
```

- [ ] Manually verify one fresh bundle and one deliberately stale bundle:

  1. Select the plank goal in the app.
  2. Confirm the app displays the reachable drop/spawn route.
  3. Export and import the bundle into RuneLite.
  4. Confirm RuneLite shows the same status and labels.
  5. Advance the app run revision without re-exporting.
  6. Confirm RuneLite marks the old proof stale after the next bundle/state comparison.

- [ ] Commit app documentation:

```powershell
git add README.md data/changelog.ts docs/runeproof.md
git commit -m "docs: document RuneProof guarantees"
```

- [ ] Commit plugin documentation:

```powershell
git add README.md
git commit -m "docs: describe RuneProof display"
```

- [ ] Use `superpowers:requesting-code-review` for a final review of both repositories.

- [ ] Use `superpowers:verification-before-completion` and attach the exact verification output before claiming completion.

- [ ] Use `superpowers:finishing-a-development-branch` to choose merge, PR, or local handoff.
