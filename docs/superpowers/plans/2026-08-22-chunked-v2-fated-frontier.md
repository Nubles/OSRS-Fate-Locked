# Chunked v2 Fated Frontier Implementation Plan Suite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this suite task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Chunked mode's finite shared-key/orthogonal-frontier loop with a Fate-Locked, provably live Fated Frontier loop in which every authored paid chunk remains attainable, while Vanilla behavior and persistence remain exactly unchanged.

**Architecture:** The work is split into four ordered plans. A mode-scoped state envelope and guarded reducer commands establish isolation first. A versioned target/gateway graph then establishes geographic and prerequisite liveness. Fated Trials provide renewable Threads, bounded Frontier Keys, and bounded Standard-Key prerequisite acquisition. The Loom presents the system without hiding its permanent fallback, and release verification blocks any target, graph, migration, or Vanilla-equivalence regression.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Vitest 4, jsdom, fast-check-style deterministic property loops using the repository's existing test stack, and the generated RuneLite web bundle contract.

**Spec:** `docs/superpowers/specs/2026-08-22-chunked-v2-fated-frontier-design.md`

**Execution status:** **BLOCKED ON ROUTE EVIDENCE.** Plan 1 may establish the isolated save/command foundation, but Plan 2 cannot pass its mandatory research gate—and Plans 3–4 must not begin—until an owner-reviewed, pinned cache/collision input and complete zone/gateway/Sailing certificates exist. In particular, all 31 proposed first-entry Sailing arcs currently lack sufficient origin/corridor/direction/return proof. This status is not permission to reduce the 623-target manifest.

## Global Constraints

- Work only on `design/chunked-v2-fated-frontier`; do not merge, push to `main`, or open a pull request without a separate user instruction.
- A valid incomplete Chunked v2 save must always have a finite legal route to another distinct paid chunk. Tracker RNG, reloads, favourable OSRS drops, real-world time, or admin repair cannot be premises of the proof.
- The free root is `50,50`. `CHUNKED_TARGETS` contains exactly the other 623 authored coordinates. Completion is set equality, never raw array length.
- Lumbridge Home Teleport is a permanent Chunked-v2-only return-to-root exemption. It does not unlock, own, or seed a chunk.
- The Unbroken Thread is enabled and visible in every incomplete Chunked v2 save. It repeats a bounded objective cycle, awards Threads deterministically, performs a real low-value Standard-Key attempt, and advances an unspendable hard-pity counter.
- Every chunk mutation uses a dedicated atomic Chunked command. Generic `UNLOCK`, Standard, Omni, and ordinary Chaos paths cannot inject chunks into a Chunked v2 save.
- A normal weave costs exactly one Frontier Key. Cartographer costs exactly 40 Fate and no Frontier Key. Chaos contains exactly one synthetic Frontier ticket and consumes one Chaos Key only when the guarded chunk commit succeeds.
- Unlock first and debit second inside one reducer transition. A stale, duplicate, invalid, unaffordable, wrong-mode, or revision-mismatched command returns the original state object and consumes no currency, RNG state, timestamp, or revision.
- Legacy valid disconnected chunks remain owned but dormant until a proven route connects them. They cannot seed frontier candidates, Trials, Crossings, or reachability.
- Legacy Chunked migration refunds only already-owned Attack tier 1 and Strength tier 1, because those become free baseline tiers. It does not refund historical chunk purchases. It preserves a recoverable relevant snapshot and is idempotent.
- Keep `CURRENT_SAVE_VERSION` at `4`. Add an optional, internally versioned `chunkedV2` envelope only to exact Chunked saves. Fresh and imported Vanilla saves must never instantiate or serialize that field.
- Treat the new envelope as an intentionally fail-closed v4 dialect for older app builds: the baseline v4 parser rejects the unknown root field instead of misreading a v2 save as legacy Chunked. Test that down-level rejection explicitly. If an otherwise-current save carries the migration history marker but has lost its envelope, reject it as tampered/incomplete; never rerun starter refunds.
- Unknown mode IDs fail closed at the save boundary. Existing exact `vanilla`, exact `chunked`, and structurally valid legacy `custom` saves retain their established handling; no resolver may silently turn an unknown persisted ID into Vanilla.
- Vanilla initial state, serialized bytes, action no-op identity, pool order, seeded draw values, PRNG purpose strings, PRNG call counts, pity, rituals, exports, imports, tabs, and snapshots are golden-fixture invariants.
- Gameplay randomness is obtained only through `GameContext.nextFloat(purpose)`. Pure utilities accept prepared draws and never call `Math.random()`.
- Keep pure graph, migration, Trial, authorization, and presentation logic outside React. `GameContext` remains the reducer/orchestration boundary and components remain thin.
- Do not hand-edit generated content artifacts. Add source data and tests, then use the repository generation scripts where required.
- Do not assume existing RuneLite consumers ignore additive Chunked fields. Pin and run an acceptance fixture against the supported standalone plugin revision before claiming parity; a missing external proof blocks the RuneLite/release exit condition. Do not edit standalone Java sources in this repository.
- No release may proceed with an unproven target, a requirement cycle, an optimistic/unknown route, a failing Vanilla golden, or an incomplete migration test.

## Ordered Plans

| Order | Plan | Exit condition |
|---:|---|---|
| 1 | [`2026-08-22-chunked-v2-01-foundation-and-vanilla-isolation.md`](./2026-08-22-chunked-v2-01-foundation-and-vanilla-isolation.md) | Exact-mode envelope, migration boundary, atomic command guards, and Vanilla goldens pass. |
| 2 | [`2026-08-22-chunked-v2-02-frontier-graph-and-liveness.md`](./2026-08-22-chunked-v2-02-frontier-graph-and-liveness.md) | All 623 paid targets have a verified path and acyclic prerequisite route; the executable proof passes. |
| 3 | [`2026-08-22-chunked-v2-03-fated-trials-and-economy.md`](./2026-08-22-chunked-v2-03-fated-trials-and-economy.md) | Threads, Frontier Keys, Trials, hard pity, normal/Cartographer/Chaos weaving, and adversarial reducer properties pass. |
| 4 | [`2026-08-22-chunked-v2-04-loom-ui-and-rollout.md`](./2026-08-22-chunked-v2-04-loom-ui-and-rollout.md) | Loom/map/migration UI, evidence, RuneLite parity, fresh-profile browser checks, and the full release gate pass. |

## Shared Domain Interfaces

Create `utils/fatedFrontier/model.ts` in Plan 1 and keep later files dependent on these discriminated types:

```ts
export type ChunkKey = `${number},${number}`;

export interface ChunkedV2State {
  schemaVersion: 1;
  rulesVersion: 1;
  graphVersion: 1;
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
  unbroken: {
    completedCount: number;
    cycleIndex: number;
    instanceId: string;
  };
  crossing: FatedCrossingSnapshot | null;
  routeFactsFingerprint: string;
  routeValidationStatus: 'UNVALIDATED' | 'VALIDATED';
  cartographerOffer: ChunkedCartographerOffer | null;
  migration: ChunkedMigrationState;
}

export interface FatedTrialInstance {
  id: string;
  definitionId: string;
  kind: 'first-omen' | 'ordinary' | 'unbroken';
  objective: FatedTrialObjective;
  baseline: number;
  proof: VerifiedTrialProof;
  requiredZoneNodeIds: string[];
  requiredChunks: ChunkKey[];
  requiredUnlocks: string[];
  threadsReward: number;
  performsStandardAttempt: boolean;
  dealtAtRevision: number;
}

export interface ChunkedCommandBase {
  expectedRunId: string;
  expectedRunRevision: number;
}
```

Use the existing `(GameState.runId, GameState.runRevision)` pair as the compare-and-swap identity; do not add a second competing revision counter. Every ordinary successful persistent transition increments `runRevision` once in `gameReducer`. Saturated identity counters are not valid liveness states: they enter an explicit local recovery path that preserves ownership/economy, starts a fresh run segment, rekeys live Trial instances, and returns to a valid state before gameplay resumes.

## Cross-Plan Proof Obligations

The final `npm run chunked:verify` command must establish these as executable facts:

1. The target manifest is the canonical authored universe minus `50,50`, with 623 unique sorted coordinates.
2. Every target has a finite route from the certified `50,50#lumbridge-surface` zone through directed Path, Passage, or Voyage arcs whose end-to-end zone evidence is verified. Every proof arrival edge's `fromNodeId` itself has a machine-verifiable, lower-ranked node-activation chain from the root; chunk ownership alone is never a proof parent.
3. The Crossing prerequisite graph is acyclic and no prerequisite requires the destination it unlocks.
4. Every non-complete valid state has a live adjacent target or an attainable Crossing.
5. The always-legal Unbroken cycle works while graph data is loading or invalid, produces one Frontier Key within five completions, and produces a spendable Standard Key within ten completions under every prepared outcome stream (including ordinary-pity and Omni outcomes), without a double hard-pity award.
6. Every successful chunk spend adds exactly one previously unowned target; every rejected spend is an identity no-op.
7. Dormant legacy ownership cannot act as a route root.
8. Cartographer choices are distinct, persisted, live at commit, and cost exactly 40 Fate; stale choices cost zero.
9. Chaos has at most one synthetic Frontier ticket, independent of frontier cardinality.
10. For every Vanilla fixture and action corpus, pre-feature and post-feature states, serialized JSON, histories, and seeded draws are identical.

Simulation reports remain balance evidence only; they do not substitute for these exhaustive checks.

## Suite Completion

- [ ] Execute Plans 1 through 4 in order, checking off each task only after its focused test and commit succeed.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run content:verify`.
- [ ] Run `npm run build`.
- [ ] Run `npm run release:verify`.
- [ ] Run the fresh-profile browser script described in Plan 4 for both Vanilla and Chunked.
- [ ] Review `git diff main...HEAD` and verify that every behavior change is gated by exact `gameModeId === 'chunked'` plus valid `chunkedV2` state.
- [ ] Use superpowers:requesting-code-review, address findings with superpowers:receiving-code-review, then use superpowers:verification-before-completion.
- [ ] Use superpowers:finishing-a-development-branch and present the user with merge/PR/keep/discard choices; do not choose for them.
