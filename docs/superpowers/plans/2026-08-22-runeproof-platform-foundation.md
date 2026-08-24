# RuneProof Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Milestone 1 foundation that truthfully catalogues all 210 normalized OSRS quests and miniquests, compiles reviewed branch-aware RuneProof packs, migrates isolated progress, and preserves the five existing public guides without publishing any new route.

**Architecture:** A small public-safe 210-entry catalogue supplies identity and lightweight preflight metadata, while independently reviewed pack payloads remain behind separate preview and public manifests. Pure TypeScript engines evaluate typed requirements, branch choice, item ledgers, progress, and coach state; compatibility adapters project the five existing walkthroughs through the new contract. The Goal Planner reads only catalogue headers and a compact progress index until an objective is selected, then lazily loads and analyzes that exact pack.

**Tech Stack:** TypeScript 5, React 18, Vite 5, Vitest 4, Testing Library, Node.js ESM source scripts, JSON provenance snapshots, localStorage.

**Spec:** `docs/superpowers/specs/2026-08-22-runeproof-all-quests-miniquests-design.md`

## Global Constraints

- The authoritative initial scope is exactly 210 normalized IDs: 191 quests and 19 miniquests.
- Preserve the repository's Recipe for Disaster normalized IDs and exact quest display-name identifiers.
- Keep the existing 23-entry F2P snapshot as a verified input; classify the other 187 entries as members content.
- The five existing public packs—Cook's Assistant, Sheep Shearer, The Restless Ghost, Rune Mysteries, and Imp Catcher—are golden regressions.
- RuneProof reads canonical run state but never writes Journal completion, Keys, Fate rolls, rewards, history, integrity events, exports, or sync state.
- Subjective combat capability is reviewed guidance plus explicit player confirmation; it is never an automatic impossibility result.
- Unresolved, contradictory, stale, or unmodelled evidence yields `NEEDS_REVIEW`, not `BLOCKED` or a guessed route.
- Generated draft facts and independently reviewed decisions remain separate; generated confidence never promotes content.
- Runtime use is offline and cannot depend on the Wiki, Chunk Picker, an AI service, or another remote API.
- Pack failures are isolated to the affected branch or pack; the ordinary Goal Planner remains available.
- New content is preview-only unless an exact pack revision is explicitly `PUBLIC_APPROVED`.
- Normal builds must physically exclude private packs, raw source lines, review notes, and private revisions.
- No publish, deployment, announcement, or public promotion is authorized by this plan.
- Milestone 1 ends at a local review gate; Milestone 2 cannot begin until that gate is explicitly approved.
- Add no runtime dependency unless the user separately approves it.

---

## Execution Prerequisite and Baseline

Run these commands before Task 1:

```bash
cd /workspace/scratch/7336590c3402/OSRS-Fate-Locked
git branch --show-current
git status --short
npm ci --no-audit --no-fund
npm test
npm run typecheck
npm run content:verify
npm run build
npm run build:runeproof-preview
```

Expected:

- Branch: `feature/runeproof-all-quests`.
- Worktree: clean apart from this plan commit.
- Every baseline command exits 0. If a baseline command fails before implementation, record the command and output and stop rather than folding an unrelated repair into this programme.

## File Structure

### Catalogue and source boundary

- Create `scripts/runeproof-catalogue-source.mjs`: pure slug, graph-depth, complexity, milestone, and catalogue-generation functions.
- Create `scripts/runeproof-catalogue-source.test.ts`: deterministic source and classification tests.
- Create `scripts/sync-runeproof-catalogue.mjs`: write/check the committed catalogue snapshot.
- Create `data/sources/runeproof-complexity-overrides.json`: independently reviewed member-only classification corrections; initially an empty entry list.
- Create `data/sources/runeproof-quest-catalogue.json`: generated, versioned 210-entry public-safe snapshot.
- Create `data/runeProofQuestCatalogue.ts`: strict runtime validator, immutable indexes, and public types.
- Create `data/runeProofQuestCatalogue.test.ts`: reconciliation and graph invariants.
- Create `data/runeProofCanonicalAreas.ts` and its test: complete canonical named-area registry used by generic pack requirements.

### Pack platform

- Create `utils/questStrategies/packModel.ts`: versioned pack, source, evidence, requirement, action, branch, location, item-effect, combat, migration, finding, and compiled-pack contracts.
- Create `utils/questStrategies/packModel.test.ts`: immutable builder and discriminated-contract tests.
- Create `utils/questStrategies/requirements.ts`: expression validation and immutable account evaluation.
- Create `utils/questStrategies/requirements.test.ts`: all proof-state and typed-gate tests.
- Create `utils/questStrategies/preflight.ts`: compile `QuestData` into lightweight preflight expressions and summaries.
- Create `utils/questStrategies/preflight.test.ts`: canonical quest-point, `ALL`/`ANY`, location, and unresolved-evidence tests.
- Create `utils/questStrategies/itemLedger.ts`: per-branch lifecycle validation plus confirmed active-route quantity replay.
- Create `utils/questStrategies/itemLedger.test.ts`: acquire/produce/consume/retain/return/lend/reuse/quest-provided, quantity, and item-family tests.
- Create `utils/questStrategies/branches.ts`: legal-branch ranking, pinning, deliberate switching, and active-confirmation projection.
- Create `utils/questStrategies/branches.test.ts`: recommendation and switching tests.
- Create `utils/questStrategies/packCompiler.ts`: fail-closed structural compiler with structured pack-wide and branch-local findings.
- Create `utils/questStrategies/packCompiler.test.ts`: graph, evidence, location, combat, migration, and branch-isolation tests.
- Create `utils/questStrategies/legacyPackAdapter.ts`: lossless conversion of current walkthroughs to one-`main`-branch packs.
- Create `utils/questStrategies/legacyPackAdapter.test.ts`: five-pack golden equivalence tests.
- Create `utils/questStrategies/testFixtures.ts`: complete reusable catalogue, pack, account, progress, and performance fixtures used only by tests.

### Authoring and release boundary

- Create `data/runeProofPackRelease.ts`: lifecycle types and strict manifest validator.
- Create `data/sources/runeproof-pack-releases.preview.json`: private exact-revision lifecycle snapshot.
- Create `data/sources/runeproof-pack-releases.public.json`: public exact-revision lifecycle snapshot containing only the five existing guides.
- Create `data/runeProofPackRelease.preview.ts`: private exact-revision manifest.
- Create `data/runeProofPackRelease.public.ts`: public exact-revision manifest containing only the five existing public packs.
- Create `data/runeProofPacks.preview-boundary.ts`: the only private pack/manifest/harness aggregator imported by runtime code.
- Create `data/runeProofPacks.public.ts`: public-safe module with the same loader surface and only the five existing packs.
- Create `data/runeProofPlatformReviewHarness.preview.ts`: synthetic branch/combat model for private Milestone 1 visual review; never a catalogue entry.
- Create `data/runeProofPlatformReviewHarness.public.ts`: same-shape normal-build stub with no private marker or payload.
- Modify `scripts/sync-quest-walkthroughs.mjs`: consume the generic registry and keep generated suggestions separate from review records.
- Modify `scripts/quest-walkthrough-source.mjs`: validate generic catalogue identity without trusting generated decisions.
- Modify `data/questWalkthroughLoader.ts`: load exact compiled packs as well as legacy walkthrough projections.
- Modify `vite.config.ts`: redirect every private pack module to its public-safe counterpart in normal builds.
- Modify `vite.config.runeproof-boundary.test.ts` and `scripts/runeproof-public-bundle.test.ts`: enforce physical isolation.

### Progress and runtime

- Create `utils/questStrategies/progress.ts`: V2 per-run/per-quest records, summary index, validation, and V1 migration.
- Create `utils/questStrategies/progress.test.ts`: isolation, corruption, size, idempotence, and branch-inactive progress tests.
- Create `hooks/useRuneProofProgress.ts`: selected-record lazy hydration and index controls.
- Create `hooks/useRuneProofProgress.test.tsx`: hook scope and storage failure tests.
- Modify `utils/questStrategies/objectives.ts`: five-state readiness and bounded ranking from catalogue headers.
- Modify `utils/questStrategies/objectives.test.ts`: 210-entry ranking and no-deep-analysis tests.
- Modify `utils/questStrategies/coach.ts`: active branch, combat card, proof state, and at-most-one-`DO_NOW` projection.
- Modify `utils/questStrategies/coach.test.ts`: golden, branch, blocker, and combat cases.
- Modify `utils/questRoutes/goalPlannerRuneProof.ts`: expose immutable preflight account data and keep selected-pack deep analysis lazy.
- Modify `utils/questRoutes/goalPlannerRuneProof.test.ts`: effective account/preflight and injected reviewed-root regressions.
- Modify `utils/questRoutes/analyzeQuest.ts` and its test: consume reviewed requirements from the selected immutable snapshot instead of the eight-entry global registry.

### User interface, coverage, and review

- Create `components/questStrategies/RuneProofCatalogueFilters.tsx`: search and six filter groups.
- Create `components/questStrategies/RuneProofCatalogueFilters.test.tsx`: filter and keyboard tests.
- Create `components/questStrategies/RuneProofBranchSelector.tsx`: recommendation, reason, consequences, and explicit switch control.
- Create `components/questStrategies/RuneProofBranchSelector.test.tsx`: pin and switch interaction tests.
- Create `components/questStrategies/RuneProofCombatReadiness.tsx`: reviewed encounter guidance and manual confirmation.
- Create `components/questStrategies/RuneProofCombatReadiness.test.tsx`: no-impossibility and confirmation tests.
- Create `components/questStrategies/RuneProofInitialItems.tsx` and its test: exact canonical/alternative root-item proof controls.
- Create `components/questStrategies/RuneProofManualConfirmations.tsx` and its test: evidence-backed generic manual prompts.
- Modify `components/questStrategies/RuneProofCoach.tsx` and its test: render new branch and combat models without losing map/focus state.
- Modify `components/questStrategies/RuneProofObjectivePicker.tsx` and its test: render at most three explained recommendations.
- Modify `components/GoalPlannerModal.tsx` and its tests: integrate catalogue, progress, filters, fallback, and lazy selected-pack loading.
- Modify `components/Dashboard.runeproof.test.tsx`: full canonical-state and mutation-spy isolation evidence.
- Create `scripts/runeproof-coverage.mjs`, `scripts/runeproof-coverage.types.ts`, and `scripts/runeproof-coverage.test.ts`: generate, type, and verify the 210-row semantic matrix.
- Create `data/sources/runeproof-pack-validation.json`: exact five-pack compiler/semantic evidence consumed by coverage.
- Create `data/sources/runeproof-coverage.json`: truthful Milestone 1 coverage output.
- Create `utils/questStrategies/performance.test.ts`: deterministic work-budget assertions included in the normal test suite.
- Create `scripts/runeproof-performance-benchmark.ts` and `vitest.runeproof-performance.config.ts`: an explicitly invoked Node-only wall-time benchmark excluded from the browser typecheck and normal test suite.
- Modify `.github/workflows/ci.yml`: build the private preview in pull-request CI without changing deployment.
- Create `docs/testing/runeproof-all-quests-milestone-1-acceptance.md`: automated evidence plus the explicit local visual/play review gate.
- Modify `package.json`: add catalogue, coverage, and performance commands to the existing verification chain.

### Compatibility files retained

- Keep `data/f2pQuestMembership.ts` and `data/sources/f2p-quest-membership.json` as verified 23-entry source inputs.
- Keep `data/questWalkthroughs.public.ts` as the normal-build public-safe payload until its five definitions are mechanically moved in a separately reviewed refactor.
- Keep `utils/questRoutes/previewChecks.ts`, `utils/questStrategies/previewActions.ts`, and their hooks readable for V1 migration; do not delete V1 keys in Milestone 1.
- Keep `QuestStrategyDefinition` as the compatibility projection consumed by the existing item-route analyzer while the generic pack is the authoring and release unit.

---

### Task 1: Generate and Validate the 210-Entry Catalogue

**Files:**
- Create: `scripts/runeproof-catalogue-source.mjs`
- Create: `scripts/runeproof-catalogue-source.test.ts`
- Create: `scripts/sync-runeproof-catalogue.mjs`
- Create: `data/sources/runeproof-complexity-overrides.json`
- Create: `data/sources/runeproof-quest-catalogue.json`
- Create: `data/runeProofQuestCatalogue.ts`
- Create: `data/runeProofQuestCatalogue.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `QUEST_DATA: Record<string, QuestData>`, `data/sources/quest-list.json`, `data/sources/quest-requirement-audit.json`, `data/sources/f2p-quest-membership.json`, and `data/sources/runeproof-complexity-overrides.json`.
- Produces: `generateRuneProofCatalogue(input): RuneProofCatalogueSnapshot`, `validateRuneProofQuestCatalogue(value): readonly RuneProofCatalogueEntry[]`, `runeProofCatalogueRevision`, `runeProofQuestCatalogue`, `runeProofCatalogueFor(questId)`, and `runeProofCatalogueBySlug(slug)`.

- [ ] **Step 1: Create the reviewed override input and write failing deterministic source tests**

Create `data/sources/runeproof-complexity-overrides.json` first so the test fixture resolves while the implementation module remains the intentional failure:

```json
{
  "schemaVersion": 1,
  "reviewedAt": "2026-08-22",
  "entries": []
}
```

```ts
import { describe, expect, it } from 'vitest';
import questList from '../data/sources/quest-list.json';
import audit from '../data/sources/quest-requirement-audit.json';
import f2p from '../data/sources/f2p-quest-membership.json';
import overrides from '../data/sources/runeproof-complexity-overrides.json';
import { QUEST_DATA } from '../data/questData';
import {
  classifyRuneProofComplexity,
  generateRuneProofCatalogue,
} from './runeproof-catalogue-source.mjs';

describe('RuneProof catalogue source', () => {
  it('classifies the three unresolved audits into milestone 5', () => {
    for (const questId of ['Bear Your Soul', 'Desert Treasure I', 'The Enchanted Key']) {
      const assessment = classifyRuneProofComplexity({
        quest: { difficulty: 'QUEST_NOVICE', prereqs: [], skills: {}, regions: [] },
        audit: { status: 'unresolved', notes: { items: [], travel: [], instances: [], partialCompletion: [] } },
        prerequisiteDepth: 0,
      });
      expect(assessment.assignedMilestone).toBe(5);
      expect(assessment.flags).toContain('UNRESOLVED_AUDIT');
    }
  });

  it('normalizes script and runtime difficulty spellings identically', () => {
    const base = {
      prereqs: [], skills: {}, regions: [], oneOf: [], manualRequirements: [],
    };
    const reviewed = {
      status: 'verified',
      notes: { items: [], travel: [], instances: [], partialCompletion: [] },
    };
    expect(classifyRuneProofComplexity({
      quest: { ...base, difficulty: 'QUEST_MASTER' },
      audit: reviewed,
      prerequisiteDepth: 0,
    })).toEqual(classifyRuneProofComplexity({
      quest: { ...base, difficulty: 'Quest (Master)' },
      audit: reviewed,
      prerequisiteDepth: 0,
    }));
  });

  it('generates one unique, sourced entry for every normalized identity', () => {
    const snapshot = generateRuneProofCatalogue({
      questList,
      audit,
      f2p,
      overrides,
      questData: QUEST_DATA,
    });
    expect(snapshot.entries).toHaveLength(210);
    expect(snapshot.entries.filter(entry => entry.kind === 'quest')).toHaveLength(191);
    expect(snapshot.entries.filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
    expect(snapshot.entries.filter(entry => entry.membership === 'F2P')).toHaveLength(23);
    expect(snapshot.entries.filter(entry => entry.membership === 'MEMBERS')).toHaveLength(187);
    expect(snapshot.entries.filter(entry => entry.milestone === 1)).toHaveLength(5);
    expect(snapshot.entries.filter(entry => entry.milestone === 2)).toHaveLength(18);
    expect(snapshot.entries.filter(entry => entry.milestone === 3)).toHaveLength(91);
    expect(snapshot.entries.filter(entry => entry.milestone === 4)).toHaveLength(62);
    expect(snapshot.entries.filter(entry => entry.milestone === 5)).toHaveLength(34);
    expect(new Set(snapshot.entries.map(entry => entry.questId)).size).toBe(210);
    expect(new Set(snapshot.entries.map(entry => entry.slug)).size).toBe(210);
    expect(snapshot.entries.map(entry => entry.progressionPriority)).toEqual(
      Array.from({ length: 210 }, (_, index) => index + 1),
    );
    expect(questList.parsedCounts).toEqual({ quests: 192, miniquests: 19 });
    expect(Object.values(QUEST_DATA).reduce(
      (count, quest) => count + quest.prereqs.length, 0,
    )).toBe(258);
    const priority = new Map(snapshot.entries.map(entry =>
      [entry.questId, entry.progressionPriority]));
    for (const quest of Object.values(QUEST_DATA)) {
      for (const prerequisite of quest.prereqs) {
        expect(priority.get(prerequisite)).toBeLessThan(priority.get(quest.id));
      }
    }
    expect(snapshot.entries.filter(entry => entry.questId.startsWith('RFD:'))
      .map(entry => entry.questId).sort()).toEqual([
        'RFD: Dwarf', 'RFD: Evil Dave', 'RFD: Finale', 'RFD: Goblins',
        'RFD: King Awowogei', 'RFD: Lumbridge Guide', 'RFD: Pirate Pete',
        'RFD: Sir Amik Varze', 'RFD: Skrach Uglogwee', 'RFD: The Cook',
      ]);
    expect(snapshot.entries.some(entry => entry.questId === 'Recipe for Disaster')).toBe(false);
  });

  it('rejects an unreviewed or dishonest complexity override', () => {
    expect(() => generateRuneProofCatalogue({
      questList,
      audit,
      f2p,
      questData: QUEST_DATA,
      overrides: {
        schemaVersion: 1,
        reviewedAt: '2026-08-22',
        entries: [{
          questId: "Cook's Assistant",
          fromMilestone: 3,
          toMilestone: 4,
          reviewer: '',
          reviewedAt: '2026-08-22',
          reason: '',
        }],
      },
    })).toThrow(/complexity override/);
  });
});
```

- [ ] **Step 2: Run the source tests and confirm the missing module failure**

Run:

```bash
npx vitest run scripts/runeproof-catalogue-source.test.ts
```

Expected: FAIL because `./runeproof-catalogue-source.mjs` does not exist.

- [ ] **Step 3: Implement the pure catalogue generator and exact complexity formula**

```js
export const classifyRuneProofComplexity = ({ quest, audit, prerequisiteDepth }) => {
  const skillGateCount = Object.keys(quest.skills ?? {})
    .filter(skill => skill !== 'Quest Points').length;
  const partialNotes = audit.notes.partialCompletion
    .map(note => note.trim())
    .filter(note => note.length > 0 && note !==
      'No additional unavoidable manual or alternative completion gate was identified beyond the recorded runtime fields.');
  const uniqueRegions = new Set([
    ...(quest.regions ?? []),
    ...(quest.oneOf ?? []).flatMap(option => option.regions ?? []),
  ]);
  const uniqueLocations = new Set([
    ...(quest.locations ?? []).map(location => location.id),
    ...(quest.oneOf ?? []).flatMap(option =>
      (option.locations ?? []).map(location => location.id)),
  ]);
  const difficultyName = String(quest.difficulty).toUpperCase();
  const difficultyWeight = difficultyName.includes('GRANDMASTER') ? 12
    : difficultyName.includes('MASTER') ? 8
      : difficultyName.includes('EXPERIENCED') ? 4
        : difficultyName.includes('INTERMEDIATE') ? 2
          : 0;
  const dimensions = Object.freeze({
    prerequisiteDepth,
    prerequisiteFanOut: (quest.prereqs ?? []).length,
    skillGateCount,
    questPointGate: Number((quest.skills ?? {})['Quest Points'] ?? 0) > 0,
    combatGate: Number.isFinite(quest.combatLevel),
    uniqueRegionCount: uniqueRegions.size,
    uniqueLocationCount: uniqueLocations.size,
    itemNoteCount: audit.notes.items.length,
    travelNoteCount: audit.notes.travel.length,
    instanceSignal: audit.notes.instances.some(note => note.trim().length > 0),
    positivePartialSignal: partialNotes.length > 0,
    manualConditionCount: (quest.manualRequirements ?? []).length,
    alternativeRequirementCount: (quest.oneOf ?? []).length,
  });
  const flags = [
    ...(audit.status === 'unresolved' ? ['UNRESOLVED_AUDIT'] : []),
    ...(dimensions.instanceSignal ? ['INSTANCE_EVIDENCE'] : []),
    ...(dimensions.positivePartialSignal ? ['PARTIAL_COMPLETION'] : []),
    ...(dimensions.manualConditionCount > 0 ? ['MANUAL_CONDITION'] : []),
    ...(dimensions.alternativeRequirementCount > 0 ? ['ALTERNATIVE_REQUIREMENT'] : []),
    ...(dimensions.questPointGate ? ['QUEST_POINT_GATE'] : []),
    ...(dimensions.combatGate ? ['COMBAT_GATE'] : []),
    ...(difficultyName.includes('GRANDMASTER') ? ['GRANDMASTER'] : []),
    ...(!difficultyName.includes('GRANDMASTER') && difficultyName.includes('MASTER')
      ? ['MASTER'] : []),
  ];
  const score = difficultyWeight
    + prerequisiteDepth
    + dimensions.prerequisiteFanOut
    + Math.min(skillGateCount, 6)
    + (dimensions.questPointGate ? 2 : 0)
    + Math.ceil((dimensions.uniqueRegionCount + dimensions.uniqueLocationCount) / 2)
    + (dimensions.instanceSignal ? 2 : 0)
    + (dimensions.positivePartialSignal ? 2 : 0)
    + (dimensions.manualConditionCount > 0 ? 4 : 0)
    + (dimensions.alternativeRequirementCount > 0 ? 4 : 0)
    + (dimensions.combatGate ? 3 : 0)
    + (audit.status === 'unresolved' ? 20 : 0);
  const milestone = flags.includes('UNRESOLVED_AUDIT')
    || flags.includes('MASTER')
    || flags.includes('GRANDMASTER')
    || score >= 20
    ? 5
    : score <= 9
      ? 3
      : 4;
  return Object.freeze({
    schemaVersion: 1,
    score,
    baselineMilestone: milestone,
    assignedMilestone: milestone,
    dimensions,
    flags,
  });
};
```

In the same module:

- Load `questData.ts` with the established TypeScript transpilation technique from `scripts/sync-quest-sources.mjs`; do not duplicate a handwritten quest list.
- Compute prerequisite depth with a memoized DFS that throws on a dangling ID or cycle.
- Reuse the reviewed F2P slug, kind, wave, and priority for all 23 F2P entries.
- Assign milestone 1 to the five current public quest IDs and milestone 2 to the other 18 F2P entries.
- For members entries, apply the formula above and use a stable Kahn topological sort whose ready-node tie tuple is `[milestone, score, questId]`; assign priorities 24 through 210 so every prerequisite has a lower priority than its dependent.
- Validate `runeproof-complexity-overrides.json` as exact schema 1 with a valid top-level review date and unique member-only entries. Each entry must name the computed `fromMilestone`, a `toMilestone` in 3–5, a nonblank reviewer/reason, and a valid review date. Apply it only when `fromMilestone` still matches; retain `baselineMilestone`, set `assignedMilestone` and the entry milestone to `toMilestone`, and store the applied record under `requirementComplexity.override`. Never hand-edit the generated catalogue.
- Use the quest-list `pageTitle` as `wikiTitle` for all 210 entries. Do not derive a quick-guide title; each reviewed pack pins its own exact guide source.
- Copy `series` only from canonical `QuestData`; absence remains `undefined`.
- Use `source.revision` and `source.revisionTimestamp`; generate a normalized slug for every entry, assert it equals all 23 curated F2P slugs, and reject collisions.
- Hash canonicalized entries with SHA-256 into `catalogueRevision`; do not include wall-clock generation time in byte-compared output.

Create the initial reviewed-override container exactly as:

```json
{
  "schemaVersion": 1,
  "reviewedAt": "2026-08-22",
  "entries": []
}
```

- [ ] **Step 4: Generate the snapshot in write/check modes**

```js
const output = generateRuneProofCatalogue({
  questList: readJson(QUEST_LIST_PATH),
  audit: readJson(AUDIT_PATH),
  f2p: readJson(F2P_PATH),
  overrides: readJson(OVERRIDES_PATH),
  questData: readRuntimeQuestData(),
});
const serialized = stableJson(output);
if (process.argv.includes('--check')) {
  const committed = readFileSync(OUTPUT_PATH, 'utf8').replace(/\r\n?/g, '\n');
  if (committed !== serialized.replace(/\r\n?/g, '\n')) {
    throw new Error('RuneProof catalogue is out of sync; run npm run runeproof:catalogue:sync');
  }
} else {
  writeFileSync(OUTPUT_PATH, serialized);
}
```

Add:

```json
{
  "scripts": {
    "runeproof:catalogue:sync": "node scripts/sync-runeproof-catalogue.mjs",
    "runeproof:catalogue:verify": "node scripts/sync-runeproof-catalogue.mjs --check && vitest run scripts/runeproof-catalogue-source.test.ts data/runeProofQuestCatalogue.test.ts"
  }
}
```

Run:

```bash
npm run runeproof:catalogue:sync
```

Expected: creates `data/sources/runeproof-quest-catalogue.json` with 210 entries and exits 0.

- [ ] **Step 5: Write failing runtime-validator tests**

```ts
import { describe, expect, it } from 'vitest';
import snapshot from './sources/runeproof-quest-catalogue.json';
import {
  runeProofQuestCatalogue,
  validateRuneProofQuestCatalogue,
} from './runeProofQuestCatalogue';

describe('RuneProof quest catalogue', () => {
  it('reconciles the exact normalized catalogue', () => {
    expect(runeProofQuestCatalogue).toHaveLength(210);
    expect(runeProofQuestCatalogue.filter(entry => entry.kind === 'quest')).toHaveLength(191);
    expect(runeProofQuestCatalogue.filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
    expect(Object.isFrozen(runeProofQuestCatalogue)).toBe(true);
  });

  it('rejects a source revision that is not pinned', () => {
    const changed = structuredClone(snapshot);
    changed.entries[0].sourceRevision = '';
    expect(() => validateRuneProofQuestCatalogue(changed))
      .toThrow(/sourceRevision must be a non-empty string/);
  });
});
```

- [ ] **Step 6: Run the validator tests and confirm the missing module failure**

Run:

```bash
npx vitest run data/runeProofQuestCatalogue.test.ts
```

Expected: FAIL because `./runeProofQuestCatalogue` does not exist.

- [ ] **Step 7: Implement strict runtime types, validation, freezing, and indexes**

```ts
export type RuneProofMembership = 'F2P' | 'MEMBERS';
export type RuneProofObjectiveKind = 'quest' | 'miniquest';
export type RuneProofPackMilestone = 1 | 2 | 3 | 4 | 5;

export interface RuneProofComplexityAssessment {
  readonly schemaVersion: 1;
  readonly score: number;
  readonly baselineMilestone: 3 | 4 | 5;
  readonly assignedMilestone: 3 | 4 | 5;
  readonly dimensions: Readonly<Record<string, number | boolean>>;
  readonly flags: readonly string[];
  readonly override?: Readonly<{
    fromMilestone: 3 | 4 | 5;
    toMilestone: 3 | 4 | 5;
    reviewer: string;
    reviewedAt: string;
    reason: string;
  }>;
}

export interface RuneProofCatalogueEntry {
  readonly questId: string;
  readonly slug: string;
  readonly kind: RuneProofObjectiveKind;
  readonly membership: RuneProofMembership;
  readonly wikiTitle: string;
  readonly sourceRevision: string;
  readonly sourceRevisionTimestamp: string;
  readonly requirementStatus: 'VERIFIED' | 'VERIFIED_WITH_NOTES' | 'UNRESOLVED';
  readonly series?: string;
  readonly progressionPriority: number;
  readonly milestone: RuneProofPackMilestone;
  readonly requirementComplexity: RuneProofComplexityAssessment;
}

export interface RuneProofCatalogueSnapshot {
  readonly schemaVersion: 1;
  readonly catalogueRevision: string;
  readonly sourceFiles: readonly string[];
  readonly entries: readonly RuneProofCatalogueEntry[];
}
```

The offline generator and its source tests—not the browser runtime module—must assert all four 210-ID sets are equal; 191/19 kind counts; F2P 22/1 and members 169/18 counts; source URL/revision equality between list and audit; current requirement fingerprints; 258 unique prerequisite edges with no self/dangling/cyclic edge and maximum depth 7; audit statuses 1/206/3; exact milestone counts 5/18/91/62/34; the ten normalized RFD IDs; and absence of a `Recipe for Disaster` parent ID.

`validateRuneProofQuestCatalogue` imports only the normalized generated snapshot and public `QUEST_DATA`. It rejects extra fields, sparse arrays, duplicate IDs/slugs/priorities, invalid timestamps, noncontiguous priorities, normalized count drift, source-ID drift against `QUEST_DATA`, kind drift, an entry milestone different from its assigned assessment milestone for members content, and the three unresolved entries outside milestone 5. It must never import the raw audit, quest-list, F2P review record, review notes, or source lines into the browser graph. Deep-freeze the snapshot and create `Map` indexes only after validation.

- [ ] **Step 8: Run catalogue gates**

Run:

```bash
npm run runeproof:catalogue:verify
npm run quests:verify
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit the catalogue**

```bash
git add package.json scripts/runeproof-catalogue-source.mjs scripts/runeproof-catalogue-source.test.ts scripts/sync-runeproof-catalogue.mjs data/sources/runeproof-complexity-overrides.json data/sources/runeproof-quest-catalogue.json data/runeProofQuestCatalogue.ts data/runeProofQuestCatalogue.test.ts
git commit -m "feat: add RuneProof 210-objective catalogue"
```

---

### Task 2: Define the Versioned Quest-Pack Contract

**Files:**
- Create: `utils/questStrategies/packModel.ts`
- Create: `utils/questStrategies/packModel.test.ts`

**Interfaces:**
- Consumes: `ChunkKey`, `QuestItemRequirement`, `WalkthroughActionKind`, and catalogue types from Task 1.
- Produces: every generic pack-domain type, `requirementAll(...requirements)`, `requirementAny(...requirements)`, and `defineRuneProofQuestPack(pack)`.

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  defineRuneProofQuestPack,
  requirementAll,
  runeProofFindingId,
  type RequirementExpression,
  type RuneProofQuestPack,
} from './packModel';

describe('RuneProof pack model', () => {
  it('builds immutable, versioned expressions and packs', () => {
    const preflight = requirementAll({
      kind: 'QUEST_COMPLETED',
      id: 'quest:example',
      questId: 'Example',
      evidenceIds: ['quest-data:Example'],
    });
    const pack = defineRuneProofQuestPack({
      schemaVersion: 1,
      questId: 'Example',
      revision: 'pack-revision',
      catalogueRevision: 'catalogue-revision',
      sources: [],
      evidence: [],
      initialItems: [],
      preflight,
      branches: [],
      sharedActions: [],
      completion: {
        canonicalQuestId: 'Example',
        branchActionIds: {},
        evidenceIds: [],
      },
      migrations: [],
    });
    expect(Object.isFrozen(pack)).toBe(true);
    expect(Object.isFrozen(preflight.requirements)).toBe(true);
    expectTypeOf(pack).toMatchTypeOf<RuneProofQuestPack>();
    expectTypeOf(preflight).toMatchTypeOf<RequirementExpression>();
  });

  it('distinguishes absent finding scope from a literal dash ID', () => {
    const absent = runeProofFindingId({
      code: 'DUPLICATE_ID', scope: 'PACK', questId: 'Example',
    }, 'same');
    const literalDash = runeProofFindingId({
      code: 'DUPLICATE_ID', scope: 'PACK', questId: 'Example', branchId: '-',
    }, 'same');
    expect(absent).not.toBe(literalDash);
  });
});
```

- [ ] **Step 2: Run the contract test and confirm the missing module failure**

Run:

```bash
npx vitest run utils/questStrategies/packModel.test.ts
```

Expected: FAIL because `./packModel` does not exist.

- [ ] **Step 3: Implement the exact discriminated unions**

```ts
import type { ChunkKey, QuestItemRequirement } from '../questRoutes/model';
import type { WalkthroughActionKind } from '../questWalkthroughs/model';
import type { RuneProofCatalogueEntry } from '../../data/runeProofQuestCatalogue';

export type RuneProofProofState =
  | 'READY'
  | 'CONFIRM'
  | 'BLOCKED'
  | 'NEEDS_REVIEW'
  | 'COMPLETE';

interface RequirementBase {
  readonly id: string;
  readonly evidenceIds: readonly string[];
}

export type RuneProofAtomicRequirement = RequirementBase & (
  | { readonly kind: 'QUEST_COMPLETED'; readonly questId: string }
  | { readonly kind: 'QUEST_POINTS'; readonly points: number }
  | { readonly kind: 'SKILL_LEVEL'; readonly skill: string; readonly level: number }
  | {
      readonly kind: 'TEMPORARY_BOOST';
      readonly skill: string;
      readonly baseLevel: number;
      readonly targetLevel: number;
      readonly boostSourceIds: readonly string[];
      readonly timingPolicy: 'QUEST_START' | 'ACTION_WINDOW' | 'MANUAL_TIMING';
    }
  | { readonly kind: 'COMBAT_LEVEL'; readonly level: number }
  | { readonly kind: 'REGION_ACCESS'; readonly regionId: string }
  | { readonly kind: 'CHUNK_ACCESS'; readonly chunk: ChunkKey; readonly plane: number }
  | {
      readonly kind: 'TRANSPORT_ACCESS';
      readonly transportId: string;
      readonly origin: ChunkKey;
      readonly destination: ChunkKey;
      readonly oneWay: boolean;
      readonly fare?: Readonly<{ itemKey: string; quantity: number }>;
    }
  | {
      readonly kind: 'INSTANCE_ACCESS';
      readonly instanceId: string;
      readonly entranceChunks: readonly ChunkKey[];
      readonly plane: number;
    }
  | {
      readonly kind: 'ITEM';
      readonly itemKey: string;
      readonly quantity: number;
    }
  | {
      readonly kind: 'CANONICAL_UNLOCK';
      readonly unlockType:
        | 'EQUIPMENT' | 'MOBILITY' | 'ARCANA' | 'HOUSING'
        | 'GUILD' | 'MERCHANT' | 'MINIGAME' | 'BOSS'
        | 'STORAGE' | 'FARMING' | 'SLAYER' | 'BANK'
        | 'DIARY' | 'COMBAT_ACHIEVEMENT' | 'TASK' | 'COLLECTION_ITEM';
      readonly unlockId: string;
    }
  | { readonly kind: 'BRANCH_STATE'; readonly branchId: string; readonly checkpointId?: string }
  | { readonly kind: 'MANUAL_CONFIRMATION'; readonly confirmationId: string; readonly prompt: string }
  | {
      readonly kind: 'UNRESOLVED_EVIDENCE';
      readonly evidenceId: string;
      readonly reason: string;
    }
);

export type RequirementExpression =
  | { readonly kind: 'ALL'; readonly requirements: readonly RequirementExpression[] }
  | { readonly kind: 'ANY'; readonly requirements: readonly RequirementExpression[] }
  | RuneProofAtomicRequirement;

export interface ReviewedSourceReference {
  readonly id: string;
  readonly kind: 'QUEST_DATA' | 'WIKI_REVISION' | 'CHUNK_PICKER' | 'INDEPENDENT_REVIEW';
  readonly uri: string;
  readonly revision: string;
  readonly revisionTimestamp: string;
  readonly reviewedAt: string;
  readonly author?: string;
  readonly methodology?: string;
}

export interface ReviewedEvidenceReference {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceLocator: string;
  readonly decision: string;
}

export type ReviewedLocationReference =
  | {
      readonly kind: 'SURFACE';
      readonly label: string;
      readonly chunks: readonly ChunkKey[];
      readonly plane: number;
      readonly evidenceIds: readonly string[];
    }
  | {
      readonly kind: 'INSTANCE';
      readonly label: string;
      readonly instanceId: string;
      readonly entranceChunks: readonly ChunkKey[];
      readonly plane: number;
      readonly evidenceIds: readonly string[];
    };

export type RuneProofItemEffect =
  | { readonly kind: 'ACQUIRE'; readonly itemKey: string; readonly quantity: number }
  | {
      readonly kind: 'PRODUCE';
      readonly itemKey: string;
      readonly quantity: number;
      readonly from: readonly Readonly<{ itemKey: string; quantity: number }>[];
    }
  | { readonly kind: 'CONSUME'; readonly itemKey: string; readonly quantity: number }
  | { readonly kind: 'RETAIN'; readonly itemKey: string; readonly quantity: number }
  | { readonly kind: 'RETURN'; readonly itemKey: string; readonly quantity: number }
  | {
      readonly kind: 'LEND';
      readonly itemKey: string;
      readonly quantity: number;
      readonly replacementItemKey?: string;
    }
  | { readonly kind: 'REUSE'; readonly itemKey: string; readonly quantity: number }
  | { readonly kind: 'QUEST_PROVIDED'; readonly itemKey: string; readonly quantity: number };

export type RuneProofActionCompletion =
  | { readonly kind: 'ACTION_CONFIRMED' }
  | { readonly kind: 'MANUAL'; readonly confirmationId: string }
  | { readonly kind: 'ITEM_CONFIRMED'; readonly itemKey: string }
  | { readonly kind: 'BRANCH_CHECKPOINT'; readonly checkpointId: string }
  | { readonly kind: 'CANONICAL_QUEST_COMPLETED'; readonly questId: string };

export interface ReviewedMethodReference {
  readonly id: string;
  readonly label: string;
  readonly kind: 'DIRECT_SOURCE' | 'TRANSFORMATION' | 'QUEST_ROUTE';
  readonly evidenceIds: readonly string[];
}

export interface ReviewedAlternativeReference extends ReviewedMethodReference {
  readonly requirements: RequirementExpression;
  readonly location?: ReviewedLocationReference;
}

export interface RuneProofCombatReadiness {
  readonly id: string;
  readonly encounter: string;
  readonly phases: readonly string[];
  readonly mandatoryMechanics: readonly string[];
  readonly equipmentCapabilities: readonly string[];
  readonly recommendedSupplies: readonly string[];
  readonly deathAndEscape: string;
  readonly reentry: string;
  readonly confirmationId: string;
  readonly evidenceIds: readonly string[];
}

export interface RuneProofAction {
  readonly id: string;
  readonly sourceOrder: number;
  readonly instruction: string;
  readonly kind: WalkthroughActionKind;
  readonly dependsOn: readonly string[];
  readonly requirements: RequirementExpression;
  readonly itemEffects: readonly RuneProofItemEffect[];
  readonly location: ReviewedLocationReference;
  readonly completion: RuneProofActionCompletion;
  readonly preferredMethod?: ReviewedMethodReference;
  readonly alternatives: readonly ReviewedAlternativeReference[];
  readonly combat?: RuneProofCombatReadiness;
  readonly evidenceIds: readonly string[];
}

export interface ReviewedBranchRank {
  readonly localRoutePenalty: number;
  readonly newUnlockCount: number;
  readonly riskCost: number;
  readonly tieBreak: number;
}

export interface RuneProofBranch {
  readonly id: string;
  readonly label: string;
  readonly requirements: RequirementExpression;
  readonly rank: ReviewedBranchRank;
  readonly actions: readonly RuneProofAction[];
  readonly checkpointIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

export type RuneProofInitialItemRequirement = QuestItemRequirement & Readonly<{
  evidenceIds: readonly string[];
}>;

export interface RuneProofCompletionDefinition {
  readonly canonicalQuestId: string;
  readonly branchActionIds: Readonly<Record<string, string>>;
  readonly evidenceIds: readonly string[];
}

export interface RuneProofProgressMigration {
  readonly id: string;
  readonly fromRevision: string;
  readonly actionIds: Readonly<Record<string, string>>;
  readonly itemKeys: Readonly<Record<string, string>>;
  readonly branchIds: Readonly<Record<string, string>>;
  readonly manualConfirmationIds: Readonly<Record<string, string>>;
  readonly checkpointIds: Readonly<Record<string, string>>;
}

export interface RuneProofQuestPack {
  readonly schemaVersion: 1;
  readonly questId: string;
  readonly revision: string;
  readonly catalogueRevision: string;
  readonly sources: readonly ReviewedSourceReference[];
  readonly evidence: readonly ReviewedEvidenceReference[];
  readonly initialItems: readonly RuneProofInitialItemRequirement[];
  readonly preflight: RequirementExpression;
  readonly branches: readonly RuneProofBranch[];
  readonly sharedActions: readonly RuneProofAction[];
  readonly completion: RuneProofCompletionDefinition;
  readonly migrations: readonly RuneProofProgressMigration[];
}

export type RuneProofFindingCode =
  | 'IDENTITY_MISMATCH' | 'SOURCE_MISMATCH' | 'STALE_EVIDENCE'
  | 'UNRESOLVED_REQUIREMENT' | 'INVALID_REQUIREMENT_REFERENCE'
  | 'INVALID_LOCATION' | 'INVALID_TRANSPORT' | 'INVALID_PROOF_REFERENCE'
  | 'DUPLICATE_ID' | 'DANGLING_DEPENDENCY' | 'DEPENDENCY_CYCLE'
  | 'INVALID_ORDER' | 'INVALID_RANK' | 'UNREACHABLE_COMPLETION'
  | 'BROKEN_ITEM_LEDGER' | 'CONFLICTING_COMPLETION'
  | 'MISSING_COMBAT_CONFIRMATION' | 'INVALID_MIGRATION';

export interface RuneProofCompileFinding {
  readonly id: string;
  readonly severity: 'BLOCKING' | 'WARNING';
  readonly code: RuneProofFindingCode;
  readonly scope: 'PACK' | 'BRANCH' | 'ACTION';
  readonly questId: string;
  readonly branchId?: string;
  readonly actionId?: string;
  readonly message: string;
  readonly evidenceIds: readonly string[];
}

export interface RuneProofCompiledPack extends RuneProofQuestPack {
  readonly catalogue: RuneProofCatalogueEntry;
  readonly branches: readonly RuneProofBranch[];
  readonly findings: readonly RuneProofCompileFinding[];
}

export interface RuneProofCompileResult {
  readonly pack?: RuneProofCompiledPack;
  readonly findings: readonly RuneProofCompileFinding[];
  readonly rejectedBranchIds: readonly string[];
}
```

Implement recursive `deepFreeze`, and make the builders copy their input arrays before freezing:

```ts
export const requirementAll = (
  ...requirements: readonly RequirementExpression[]
): Extract<RequirementExpression, { kind: 'ALL' }> =>
  deepFreeze({ kind: 'ALL', requirements: [...requirements] });

export const requirementAny = (
  ...requirements: readonly RequirementExpression[]
): Extract<RequirementExpression, { kind: 'ANY' }> =>
  deepFreeze({ kind: 'ANY', requirements: [...requirements] });

export const runeProofFindingId = (
  identity: Pick<
    RuneProofCompileFinding,
    'code' | 'scope' | 'questId' | 'branchId' | 'actionId'
  >,
  discriminator: string,
): string => [
  identity.code,
  identity.scope,
  identity.questId,
  identity.branchId === undefined ? '0' : `1:${identity.branchId}`,
  identity.actionId === undefined ? '0' : `1:${identity.actionId}`,
  discriminator,
].map(part => encodeURIComponent(part)).join('|');

export const defineRuneProofQuestPack = (
  pack: RuneProofQuestPack,
): RuneProofQuestPack => deepFreeze(structuredClone(pack));
```

- [ ] **Step 4: Run the contract test and typecheck**

Run:

```bash
npx vitest run utils/questStrategies/packModel.test.ts
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the domain contract**

```bash
git add utils/questStrategies/packModel.ts utils/questStrategies/packModel.test.ts
git commit -m "feat: define RuneProof quest-pack contract"
```

---

### Task 3: Compile and Evaluate Typed Preflight Requirements

**Files:**
- Create: `utils/questStrategies/requirements.ts`
- Create: `utils/questStrategies/requirements.test.ts`
- Create: `utils/questStrategies/preflight.ts`
- Create: `utils/questStrategies/preflight.test.ts`
- Create: `data/runeProofCanonicalAreas.ts`
- Create: `data/runeProofCanonicalAreas.test.ts`
- Modify: `utils/goalPlanner.ts`
- Modify: `utils/questRoutes/goalPlannerRuneProof.ts`
- Create: `utils/questRoutes/goalPlannerRuneProof.test.ts`

**Interfaces:**
- Consumes: `RequirementExpression`, `QuestData`, the public-safe `RuneProofCatalogueEntry.requirementStatus`, `UnlockState`, `effectiveSkillLevel(unlocks, skill)`, `effectiveCombatLevel(unlocks)`, canonical area reachability, and `chunkUnlocked(...)`.
- Produces: `currentQuestPoints(unlocks): number`, `requirementExpressionForQuestData(quest, catalogueEntry)`, `evaluateRequirementExpression(expression, snapshot)`, and `preflightSnapshot(unlocks, gameModeId)`.

- [ ] **Step 1: Export and test canonical quest-point calculation**

In `utils/goalPlanner.test.ts`, add `currentQuestPoints` to the existing local import and use its existing `maxedUnlocks` fixture:

```ts
it('counts quest points but not miniquest points', () => {
  expect(currentQuestPoints(maxedUnlocks({
    quests: ["Cook's Assistant", "Daddy's Home"],
  }))).toBe(1);
});
```

Change only the existing declaration:

```ts
export function currentQuestPoints(unlocks: Pick<UnlockState, 'quests'>): number {
  return unlocks.quests.reduce(
    (total, questId) => total + questPointsForEntry(QUEST_DATA[questId]),
    0,
  );
}
```

Run:

```bash
npx vitest run utils/goalPlanner.test.ts
```

Expected: PASS after exporting the existing canonical calculation.

- [ ] **Step 2: Write failing expression-evaluator tests**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateRequirementExpression } from './requirements';

const snapshot = {
  completedQuestIds: new Set(['Rune Mysteries']),
  questPoints: 7,
  levels: { Mining: 15 },
  combatLevel: 20,
  regions: new Set(['Misthalin']),
  chunks: new Set(['50,50']),
  canonicalUnlocks: {
    equipment: new Set<string>(),
    mobility: new Set<string>(),
    arcana: new Set<string>(),
    housing: new Set<string>(),
    guilds: new Set<string>(),
    merchants: new Set<string>(),
    minigames: new Set<string>(),
    bosses: new Set<string>(),
    storage: new Set<string>(),
    farming: new Set<string>(),
    slayer: new Set<string>(),
    banks: new Set<string>(),
    diaries: new Set<string>(),
    combatAchievements: new Set<string>(),
    tasks: new Set<string>(),
    collectionItems: new Set<string>(),
  },
  transportIds: new Set<string>(),
  availableBoostSourceIds: new Set<string>(),
  itemQuantities: undefined,
  confirmedManualIds: new Set<string>(),
  selectedBranchId: undefined,
  branchCheckpointIds: new Set<string>(),
  observedCanonicalCompletion: false,
} as const;

describe('requirement expressions', () => {
  it('uses BLOCKED only for a known unmet deterministic gate', () => {
    const result = evaluateRequirementExpression({
      kind: 'SKILL_LEVEL', id: 'skill:mining:30', skill: 'Mining', level: 30, evidenceIds: ['quest-data'],
    }, snapshot);
    expect(result).toMatchObject({ state: 'BLOCKED', blockerIds: ['skill:mining:30'] });
  });

  it('uses CONFIRM when deterministic gates pass but manual proof remains', () => {
    const result = evaluateRequirementExpression({
      kind: 'ALL',
      requirements: [
        { kind: 'REGION_ACCESS', id: 'region:misthalin', regionId: 'Misthalin', evidenceIds: ['quest-data'] },
        {
          kind: 'MANUAL_CONFIRMATION',
          id: 'manual:partner',
          confirmationId: 'partner-ready',
          prompt: 'Confirm the opposite-gang partner is ready.',
          evidenceIds: ['review:partner'],
        },
      ],
    }, snapshot);
    expect(result).toMatchObject({ state: 'CONFIRM', manualConfirmationIds: ['partner-ready'] });
  });

  it('propagates unresolved evidence as NEEDS_REVIEW through ANY', () => {
    const result = evaluateRequirementExpression({
      kind: 'ANY',
      requirements: [{
        kind: 'UNRESOLVED_EVIDENCE',
        id: 'unknown:route',
        evidenceId: 'audit:route',
        reason: 'Route wording is unresolved.',
        evidenceIds: ['audit:route'],
      }],
    }, snapshot);
    expect(result.state).toBe('NEEDS_REVIEW');
  });

  it('uses reviewed boost evidence but confirms timing that cannot be observed', () => {
    const result = evaluateRequirementExpression({
      kind: 'TEMPORARY_BOOST',
      id: 'boost:mining:57:60',
      skill: 'Mining',
      baseLevel: 57,
      targetLevel: 60,
      boostSourceIds: ['dwarven-stout-m'],
      timingPolicy: 'ACTION_WINDOW',
      evidenceIds: ['review:boost'],
    }, {
      ...snapshot,
      levels: { Mining: 57 },
      availableBoostSourceIds: new Set(['dwarven-stout-m']),
    });
    expect(result.state).toBe('CONFIRM');
  });

  it('proves instance access from a reviewed reachable entrance', () => {
    const result = evaluateRequirementExpression({
      kind: 'INSTANCE_ACCESS',
      id: 'instance:example',
      instanceId: 'example-instance',
      entranceChunks: ['50,50'],
      plane: 0,
      evidenceIds: ['review:instance'],
    }, snapshot);
    expect(result.state).toBe('READY');
  });

  it('resolves an exact reviewed item alternative through its canonical root', () => {
    const result = evaluateRequirementExpression({
      kind: 'ITEM',
      id: 'item:bronze-pickaxe',
      itemKey: 'bronze pickaxe',
      quantity: 1,
      evidenceIds: ['review:pickaxe-family'],
    }, {
      ...snapshot,
      itemQuantities: { pickaxe: 1 },
      itemAliases: { 'bronze pickaxe': 'pickaxe' },
    });
    expect(result.state).toBe('READY');
  });

  it('blocks a reviewed transport when its origin is unreachable', () => {
    const result = evaluateRequirementExpression({
      kind: 'TRANSPORT_ACCESS',
      id: 'transport:example-ferry',
      transportId: 'example-ferry',
      origin: '99,99',
      destination: '100,100',
      oneWay: true,
      evidenceIds: ['review:ferry'],
    }, {
      ...snapshot,
      transportIds: new Set(['example-ferry']),
    });
    expect(result).toMatchObject({
      state: 'BLOCKED',
      blockerIds: ['transport:example-ferry'],
    });
  });
});
```

- [ ] **Step 3: Run the evaluator tests and confirm the missing module failure**

Run:

```bash
npx vitest run utils/questStrategies/requirements.test.ts
```

Expected: FAIL because `./requirements` does not exist.

- [ ] **Step 4: Implement finite validation and five-state evaluation**

```ts
export interface RuneProofRequirementSnapshot {
  readonly completedQuestIds: ReadonlySet<string>;
  readonly questPoints: number;
  readonly levels: Readonly<Record<string, number>>;
  readonly combatLevel: number;
  readonly regions: ReadonlySet<string>;
  readonly chunks: ReadonlySet<string>;
  readonly canonicalUnlocks: Readonly<{
    equipment: ReadonlySet<string>;
    mobility: ReadonlySet<string>;
    arcana: ReadonlySet<string>;
    housing: ReadonlySet<string>;
    guilds: ReadonlySet<string>;
    merchants: ReadonlySet<string>;
    minigames: ReadonlySet<string>;
    bosses: ReadonlySet<string>;
    storage: ReadonlySet<string>;
    farming: ReadonlySet<string>;
    slayer: ReadonlySet<string>;
    banks: ReadonlySet<string>;
    diaries: ReadonlySet<string>;
    combatAchievements: ReadonlySet<string>;
    tasks: ReadonlySet<string>;
    collectionItems: ReadonlySet<string>;
  }>;
  readonly transportIds: ReadonlySet<string>;
  readonly availableBoostSourceIds?: ReadonlySet<string>;
  readonly itemQuantities?: Readonly<Record<string, number>>;
  readonly itemAliases?: Readonly<Record<string, string>>;
  readonly confirmedManualIds: ReadonlySet<string>;
  readonly selectedBranchId?: string;
  readonly branchCheckpointIds: ReadonlySet<string>;
  readonly observedCanonicalCompletion: boolean;
}

export interface RuneProofRequirementResult {
  readonly state: RuneProofProofState;
  readonly blockerIds: readonly string[];
  readonly manualConfirmationIds: readonly string[];
  readonly unresolvedEvidenceIds: readonly string[];
  readonly reasons: readonly string[];
  readonly unblockActions: readonly string[];
  readonly advisories: readonly string[];
}
```

Implementation rules:

- Validate maximum expression depth 32, maximum node count 2,048, dense arrays, nonblank stable IDs, positive finite quantities/levels, integer planes, and known discriminants.
- Evaluate `COMPLETE` first when `observedCanonicalCompletion` is true.
- Aggregate `ALL` by precedence `NEEDS_REVIEW > BLOCKED > CONFIRM > READY`; empty `ALL` is `READY`.
- Aggregate nonempty `ANY` as `READY` if any child is ready, then `CONFIRM`, then `BLOCKED` only when every child is a known blocker, otherwise `NEEDS_REVIEW`. If uncompiled input somehow supplies empty `ANY`, fail closed as `NEEDS_REVIEW` with an unresolved validation reason.
- Treat `TEMPORARY_BOOST` with `MANUAL_TIMING` as `CONFIRM` after the base-level gate passes.
- For every `TEMPORARY_BOOST`, return `READY` when the current level already meets the target; otherwise require the base level. When boost-source inventory is unobserved, return `CONFIRM`; when it is explicitly observed, a missing exact reviewed source is `BLOCKED` and a present source is `CONFIRM` because active boost/timing/decay is not canonical account state.
- Evaluate `TRANSPORT_ACCESS` only when its origin chunk is reachable, the exact transport ID is unlocked, and any fare quantity is present after resolving item aliases; unknown fare inventory yields `CONFIRM`, not an invented deterministic blocker. The atom proves directed travel from `origin` to `destination`, so the destination need not already be reachable. It does not mutate global reachability. A `oneWay` atom contributes stable one-way consequence copy, and any later return must be represented by a separate reverse transport/access requirement.
- Evaluate `INSTANCE_ACCESS` as legal when at least one reviewed entrance chunk is currently accessible; a blank instance ID or empty entrance list is a compiler error, not a runtime guess.
- Evaluate `ITEM` from exact ledger/confirmed item quantities when supplied; unknown inventory yields `CONFIRM`. Resolve a requested exact alternative through `snapshot.itemAliases` to the canonical reviewed root ledger key before checking quantity. Reviewed interchangeable items are expressed as `ANY` children (and method alternatives), not as an unevaluated capability string. Equipment-capability recommendations for combat never reuse store-tier `UnlockState.equipment` as proof of currently equipped gear.
- Map every `CANONICAL_UNLOCK` discriminant exhaustively to its same-named snapshot set. Bank IDs remain the canonical stored strings, and collection-log numeric IDs are encoded with `String(itemId)`; no display label is accepted as identity.
- Evaluate `BRANCH_STATE` from the selected branch and exact observed checkpoint IDs.
- Treat every `MANUAL_CONFIRMATION` as `CONFIRM` until its exact confirmation ID is present.
- Return stable, de-duplicated ID and reason arrays in expression order.

Construct player-facing copy from atom data only; never parse source prose or compiler messages. Use these exact templates (pluralize `Point`/`Points` conventionally):

| Atom/result | `reasons[0]` | `unblockActions[0]` or advisory |
|---|---|---|
| `QUEST_COMPLETED` blocked | `Requires quest completion: {questId}.` | `Complete {questId}.` |
| `QUEST_POINTS` blocked | `Requires {points} Quest Points; current total is {current}.` | `Earn {deficit} more Quest Point(s).` |
| `SKILL_LEVEL` blocked | `Requires {skill} {level}; effective level is {current}.` | `Raise {skill} to {level}.` |
| `TEMPORARY_BOOST` base blocked | `Requires base {skill} {baseLevel}; effective level is {current}.` | `Raise {skill} to {baseLevel}.` |
| `TEMPORARY_BOOST` source blocked | `Requires a reviewed boost source for {skill} {targetLevel}.` | `Obtain one of: {ordered boostSourceIds}.` |
| `TEMPORARY_BOOST` source unobserved | `Confirm a reviewed boost source is available for {skill} {targetLevel}.` | Same text prefixed with `Confirm: ` |
| `TEMPORARY_BOOST` confirm | `Confirm the reviewed {skill} boost to {targetLevel} at the required timing.` | Same text prefixed with `Confirm: ` |
| `COMBAT_LEVEL` blocked | `Requires combat level {level}; current level is {current}.` | `Raise combat level to {level}.` |
| `REGION_ACCESS` blocked | `Requires access to {regionId}.` | `Unlock or reach {regionId}.` |
| `CHUNK_ACCESS` blocked | `Requires chunk {chunk} on plane {plane}.` | `Unlock chunk {chunk}.` |
| `TRANSPORT_ACCESS` origin blocked | `Requires access to transport origin {origin}.` | `Unlock chunk {origin}.` |
| `TRANSPORT_ACCESS` transport blocked | `Requires transport {transportId}.` | `Unlock transport {transportId}.` |
| `TRANSPORT_ACCESS` fare blocked | `Requires {quantity} × {itemKey} for transport {transportId}; confirmed {current}.` | `Confirm or obtain {quantity} × {itemKey}.` |
| `TRANSPORT_ACCESS` fare unobserved | `Confirm {quantity} × {itemKey} is available for transport {transportId}.` | Same text prefixed with `Confirm: ` |
| `TRANSPORT_ACCESS` one-way ready/confirm | — | advisory: `Transport {transportId} is one-way from {origin} to {destination}; review a separate return route.` |
| `INSTANCE_ACCESS` blocked | `Requires a reachable entrance to {instanceId}.` | `Unlock one reviewed entrance chunk: {ordered entranceChunks}.` |
| `ITEM` blocked | `Requires {quantity} × {itemKey}; confirmed {current}.` | `Confirm or obtain {quantity} × {itemKey}.` |
| `ITEM` inventory unobserved | `Confirm you have {quantity} × {itemKey}.` | Same text prefixed with `Confirm: ` |
| `CANONICAL_UNLOCK` blocked | `Requires {unlockType} unlock {unlockId}.` | `Unlock {unlockId}.` |
| `BRANCH_STATE` blocked | `Requires route {branchId}{optional checkpoint suffix}.` | `Select route {branchId}{optional checkpoint instruction}.` |
| `MANUAL_CONFIRMATION` pending | exact authored `prompt` | `Confirm: {prompt}` |
| `UNRESOLVED_EVIDENCE` | exact authored `reason` | none; this remains `NEEDS_REVIEW` |

Successful deterministic atoms return empty `reasons`/`unblockActions`; advisories remain separate. `ALL` concatenates blocker/reason/unblock/confirmation/unresolved arrays only from non-ready children, concatenates advisories from every child, preserves source order, stable-de-duplicates, then applies the documented state precedence. `ANY` selects the first child in source order at its winning state—first `READY`, otherwise first `CONFIRM`, otherwise first `BLOCKED` only when every child is blocked, otherwise first `NEEDS_REVIEW`—and returns only that child's blockers, reasons, unblocks, confirmations, unresolved IDs, and advisories. Losing alternatives never leak blocker copy into a legal route.

- [ ] **Step 5: Write failing QuestData compilation tests**

```ts
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../../data/questData';
import { runeProofCatalogueFor } from '../../data/runeProofQuestCatalogue';
import { requirementExpressionForQuestData } from './preflight';

const catalogueFor = (questId: string) => runeProofCatalogueFor(questId)!;

describe('QuestData preflight compiler', () => {
  it('compiles Quest Points separately from skill levels', () => {
    const expression = requirementExpressionForQuestData(
      QUEST_DATA["Black Knights' Fortress"],
      catalogueFor("Black Knights' Fortress"),
    );
    expect(JSON.stringify(expression)).toContain('"kind":"QUEST_POINTS"');
    expect(JSON.stringify(expression)).not.toContain('"skill":"Quest Points"');
  });

  it('preserves one-of access routes as ANY', () => {
    const quest = Object.values(QUEST_DATA).find(value => (value.oneOf?.length ?? 0) > 1)!;
    expect(JSON.stringify(requirementExpressionForQuestData(quest, catalogueFor(quest.id))))
      .toContain('"kind":"ANY"');
  });

  it('fails closed for unresolved requirement audits', () => {
    const expression = requirementExpressionForQuestData(
      QUEST_DATA['Bear Your Soul'],
      catalogueFor('Bear Your Soul'),
    );
    expect(JSON.stringify(expression)).toContain('"kind":"UNRESOLVED_EVIDENCE"');
  });

  it('compiles a finite combat-level gate', () => {
    const quest = Object.values(QUEST_DATA)
      .find(value => value.combatLevel !== undefined)!;
    expect(requirementExpressionForQuestData(quest, catalogueFor(quest.id)))
      .toEqual(expect.objectContaining({
        kind: 'ALL',
        requirements: expect.arrayContaining([
          expect.objectContaining({
            kind: 'COMBAT_LEVEL',
            level: quest.combatLevel,
          }),
        ]),
      }));
  });
});
```

- [ ] **Step 6: Run preflight tests and confirm the missing module failure**

Run:

```bash
npx vitest run utils/questStrategies/preflight.test.ts
```

Expected: FAIL because `./preflight` does not exist.

- [ ] **Step 7: Implement QuestData compilation and immutable account materialization**

First create `utils/questRoutes/goalPlannerRuneProof.test.ts` with a complete immutable fixture:

```ts
import { expect, it } from 'vitest';
import type { UnlockState } from '../../types';
import { preflightSnapshot } from '../questStrategies/preflight';

const unlocks: UnlockState = {
  equipment: {},
  skills: { Mining: 2 },
  levels: { Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Mining: 99 },
  regions: ['Misthalin'],
  chunks: ['50,50'],
  mobility: ['Canoe'],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  banks: [],
  quests: ["Cook's Assistant"],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
};

it('materializes a detached preflight account snapshot', () => {
  const before = structuredClone(unlocks);
  const snapshot = preflightSnapshot(unlocks, 'chunked');
  expect(snapshot.completedQuestIds).toEqual(new Set(["Cook's Assistant"]));
  expect(snapshot.transportIds).toEqual(new Set(['Canoe']));
  expect(snapshot.chunks).toContain('50,50');
  expect(snapshot.levels.Mining).toBe(20);
  expect(snapshot.regions).toContain('Lumbridge');
  expect(unlocks).toEqual(before);
});
```

```ts
export const requirementExpressionForQuestData = (
  quest: QuestData,
  catalogue: RuneProofCatalogueEntry,
): RequirementExpression => requirementAll(
  ...quest.prereqs.map(questId => ({
    kind: 'QUEST_COMPLETED' as const,
    id: `quest:${questId}`,
    questId,
    evidenceIds: [`quest-data:${quest.id}`],
  })),
  ...Object.entries(quest.skills).map(([skill, level]) => skill === 'Quest Points'
    ? {
        kind: 'QUEST_POINTS' as const,
        id: `quest-points:${level}`,
        points: level,
        evidenceIds: [`quest-data:${quest.id}`],
      }
    : {
        kind: 'SKILL_LEVEL' as const,
        id: `skill:${skill}:${level}`,
        skill,
        level,
        evidenceIds: [`quest-data:${quest.id}`],
      }),
  ...quest.combatLevel === undefined
    ? []
    : [{
        kind: 'COMBAT_LEVEL' as const,
        id: 'combat-level:' + quest.combatLevel,
        level: quest.combatLevel,
        evidenceIds: ['quest-data:' + quest.id],
      }],
  ...regionAndLocationExpression(quest),
  ...manualRequirementExpressions(quest),
  ...catalogue.requirementStatus === 'UNRESOLVED'
    ? [unresolvedCatalogueExpression(catalogue)]
    : [],
);
```

`regionAndLocationExpression` must obey `accessPolicy`: `regions` compiles every required region into the surrounding `ALL`; `locations` compiles every top-level reviewed location into the surrounding `ALL`, while each individual location is an `ANY` over its chunk options; and `regions-and-locations` requires both groups. Each `oneOf` option becomes one child of an `ANY`; within an option, regions, guilds, and locations form an `ALL` with the same per-location `ANY` rule.

`manualRequirementExpressions` normalizes each prompt with Unicode NFKC, trim, and internal-whitespace collapse, rejects blank or duplicate normalized prompts, and derives `confirmationId` as `manual:<percent-encoded quest ID>:<percent-encoded normalized prompt>`. It never uses array position or display order. Task 6 collects these preflight declarations into the pack's manual-confirmation registry, and Task 9 treats the same IDs as valid persisted/migrated manual proofs, so a canonical manual preflight survives reload.

Extend `materializeRuneProofAccount` or add `preflightSnapshot` without mutating `UnlockState`:

Create `RUNE_PROOF_CANONICAL_AREA_IDS` as the frozen, sorted, de-duplicated canonical reachability registry—not a QuestData-derived subset. Build it from `Misthalin`, `MISTHALIN_AREAS`, all `REGION_GROUPS` parents/children, every `REGION_CHUNKS` and `SUB_AREA_CHUNKS` key, and every canonical target in `AREA_ALIAS_POLICIES`, applying `canonicalAreaName` before de-duplication. Its test proves every canonical name accepted by the repository's existing area/region consistency suites is present, aliases normalize to a member, and a known area unused by current QuestData remains available to a generic pack. Task 6 rejects a `REGION_ACCESS.regionId` outside this registry; underground/instance-only names use `INSTANCE_ACCESS` instead of inventing named-area reachability.

Materialize the registry's reachable subset with the existing `isAreaReachable` function; do not equate the raw `unlocks.regions` array with reachability because free areas, aliases, and chunked footholds are canonical rules.

```ts
export const preflightSnapshot = (
  unlocks: UnlockState,
  gameModeId: string | undefined,
): RuneProofRequirementSnapshot => ({
  completedQuestIds: new Set(unlocks.quests),
  questPoints: currentQuestPoints(unlocks),
  levels: Object.fromEntries(
    [...new Set([
      ...Object.keys(unlocks.levels),
      ...Object.keys(unlocks.skills),
    ])]
      .sort()
      .map(skill => [skill, effectiveSkillLevel(unlocks, skill)]),
  ),
  combatLevel: effectiveCombatLevel(unlocks),
  regions: new Set(RUNE_PROOF_CANONICAL_AREA_IDS.filter(area =>
    isAreaReachable(area, unlocks, gameModeId))),
  chunks: new Set(materializeRuneProofAccount(unlocks, gameModeId).unlockedChunks),
  canonicalUnlocks: {
    equipment: new Set(Object.keys(unlocks.equipment).filter(key => unlocks.equipment[key] > 0)),
    mobility: new Set(unlocks.mobility),
    arcana: new Set(unlocks.arcana),
    housing: new Set(unlocks.housing),
    guilds: new Set(unlocks.guilds),
    merchants: new Set(unlocks.merchants),
    minigames: new Set(unlocks.minigames),
    bosses: new Set(unlocks.bosses),
    storage: new Set(unlocks.storage),
    farming: new Set(unlocks.farming),
    slayer: new Set(unlocks.slayerUnlocks),
    banks: new Set(unlocks.banks ?? []),
    diaries: new Set(unlocks.diaries),
    combatAchievements: new Set(unlocks.cas),
    tasks: new Set(unlocks.completedTasks),
    collectionItems: new Set(Object.keys(unlocks.collectionLog)
      .filter(itemId => unlocks.collectionLog[Number(itemId)] > 0)),
  },
  transportIds: new Set(unlocks.mobility),
  availableBoostSourceIds: undefined,
  itemQuantities: undefined,
  itemAliases: undefined,
  confirmedManualIds: new Set(),
  selectedBranchId: undefined,
  branchCheckpointIds: new Set(),
  observedCanonicalCompletion: false,
});
```

- [ ] **Step 8: Run requirement and preflight gates**

Run:

```bash
npx vitest run data/runeProofCanonicalAreas.test.ts utils/goalPlanner.test.ts utils/questStrategies/requirements.test.ts utils/questStrategies/preflight.test.ts utils/questRoutes/goalPlannerRuneProof.test.ts
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit typed preflight**

```bash
git add data/runeProofCanonicalAreas.ts data/runeProofCanonicalAreas.test.ts utils/goalPlanner.ts utils/questStrategies/requirements.ts utils/questStrategies/requirements.test.ts utils/questStrategies/preflight.ts utils/questStrategies/preflight.test.ts utils/questRoutes/goalPlannerRuneProof.ts utils/questRoutes/goalPlannerRuneProof.test.ts
git commit -m "feat: evaluate RuneProof preflight requirements"
```

---

### Task 4: Validate a Separate Item Ledger for Every Branch

**Files:**
- Create: `utils/questStrategies/itemLedger.ts`
- Create: `utils/questStrategies/itemLedger.test.ts`

**Interfaces:**
- Consumes: `QuestItemRequirement`, `RuneProofAction`, `RuneProofCompileFinding`, and `RuneProofItemEffect`.
- Produces: `evaluateRuneProofItemLedger(input): RuneProofItemLedgerResult` and `replayRuneProofConfirmedItemLedger(input): Readonly<Record<string, number>>`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  evaluateRuneProofItemLedger,
  replayRuneProofConfirmedItemLedger,
} from './itemLedger';

const action = (id: string, sourceOrder: number, itemEffects: readonly any[]) => ({
  id,
  sourceOrder,
  dependsOn: [],
  itemEffects,
});

describe('RuneProof branch item ledger', () => {
  it('balances transformation, reuse, return, and quest-provided supply', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems: [{
        item: { key: 'knife', name: 'Knife' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
      actions: [
        action('example:receive', 1, [
          { kind: 'QUEST_PROVIDED', itemKey: 'raw token', quantity: 1 },
        ]),
        action('example:cut', 2, [
          { kind: 'REUSE', itemKey: 'knife', quantity: 1 },
          {
            kind: 'PRODUCE',
            itemKey: 'cut token',
            quantity: 1,
            from: [{ itemKey: 'raw token', quantity: 1 }],
          },
        ]),
        action('example:return', 3, [
          { kind: 'RETURN', itemKey: 'cut token', quantity: 1 },
        ]),
      ],
    });
    expect(result.findings).toEqual([]);
    expect(result.finalQuantities).toEqual({ knife: 1 });
  });

  it('rejects only the branch that consumes unavailable quantity', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'remote',
      initialItems: [],
      actions: [action('example:pay', 1, [
        { kind: 'CONSUME', itemKey: 'coins', quantity: 10 },
      ])],
    });
    expect(result.findings).toEqual([
      expect.objectContaining({
        code: 'BROKEN_ITEM_LEDGER',
        scope: 'BRANCH',
        branchId: 'remote',
        actionId: 'example:pay',
      }),
    ]);
    expect(result.finalQuantities).not.toHaveProperty('phantom output');
  });

  it('does not add a produced output after an input underflow', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'remote',
      initialItems: [],
      actions: [action('example:craft', 1, [{
        kind: 'PRODUCE',
        itemKey: 'phantom output',
        quantity: 1,
        from: [{ itemKey: 'missing input', quantity: 1 }],
      }])],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.finalQuantities).toEqual({});
  });

  it('does not turn quest-provided items into preflight acquisitions', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems: [{
        item: { key: 'quest tool', name: 'Quest tool' },
        quantity: 1,
        supplyPolicy: 'QUEST_PROVIDED',
      }],
      actions: [action('example:use', 1, [
        { kind: 'RETAIN', itemKey: 'quest tool', quantity: 1 },
      ])],
    });
    expect(result.findings[0]?.message).toContain('quest tool');
  });

  it('replays exact confirmed root quantities and removes spent items', () => {
    const roots = [{
      item: { key: 'coins', name: 'Coins' },
      quantity: 10,
      supplyPolicy: 'PLAYER_OBTAINED' as const,
    }];
    expect(replayRuneProofConfirmedItemLedger({
      initialItems: roots,
      actions: [],
      confirmedInitialItemKeys: new Set(['coins']),
      completedActionIds: new Set(),
    })).toEqual({ coins: 10 });
    expect(replayRuneProofConfirmedItemLedger({
      initialItems: roots,
      actions: [action('example:pay', 1, [
        { kind: 'CONSUME', itemKey: 'coins', quantity: 10 },
      ])],
      confirmedInitialItemKeys: new Set(['coins']),
      completedActionIds: new Set(['example:pay']),
    })).toEqual({});
  });

  it('accepts an exact reviewed family alternative as canonical root proof', () => {
    expect(replayRuneProofConfirmedItemLedger({
      initialItems: [{
        item: { key: 'pickaxe', name: 'Pickaxe' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED',
        alternatives: [
          { key: 'bronze pickaxe', name: 'Bronze pickaxe' },
          { key: 'iron pickaxe', name: 'Iron pickaxe' },
        ],
      }],
      actions: [],
      confirmedInitialItemKeys: new Set(['bronze pickaxe']),
      completedActionIds: new Set(),
    })).toEqual({ pickaxe: 1 });
  });
});
```

- [ ] **Step 2: Run the tests and confirm the missing module failure**

Run:

```bash
npx vitest run utils/questStrategies/itemLedger.test.ts
```

Expected: FAIL because `./itemLedger` does not exist.

- [ ] **Step 3: Implement deterministic ledger processing**

```ts
export interface RuneProofItemLedgerInput {
  readonly questId: string;
  readonly branchId: string;
  readonly initialItems: readonly QuestItemRequirement[];
  readonly actions: readonly Pick<RuneProofAction, 'id' | 'sourceOrder' | 'itemEffects'>[];
}

export interface RuneProofItemLedgerResult {
  readonly finalQuantities: Readonly<Record<string, number>>;
  readonly findings: readonly RuneProofCompileFinding[];
}

export interface RuneProofConfirmedItemLedgerInput {
  readonly initialItems: readonly QuestItemRequirement[];
  readonly actions: readonly Pick<
    RuneProofAction,
    'id' | 'sourceOrder' | 'dependsOn' | 'itemEffects'
  >[];
  readonly confirmedInitialItemKeys: ReadonlySet<string>;
  readonly completedActionIds: ReadonlySet<string>;
}
```

For actions sorted by `sourceOrder` then ID, snapshot the quantity map before each action. If any effect in that action is invalid or underflows, restore the snapshot and skip its remaining effects so findings never produce an impossible returned ledger:

1. Seed only `PLAYER_OBTAINED` initial items.
2. Validate `RETAIN` and `REUSE` against the opening quantity without subtracting.
3. Subtract `CONSUME`, `RETURN`, and `LEND`.
4. For `PRODUCE`, subtract every `from` input before adding the output.
5. Add `ACQUIRE`, `QUEST_PROVIDED`, `PRODUCE` output, and an optional `LEND.replacementItemKey`.
6. Reject nonpositive/noninteger quantities and any subtraction below zero with a branch-scoped `BROKEN_ITEM_LEDGER` finding.
7. Preserve reusable tools unless an explicit later effect consumes, returns, or lends them.
8. Return a sorted frozen plain-object snapshot; do not expose the mutable `Map`.

Core subtraction:

```ts
const subtract = (
  quantities: Map<string, number>,
  itemKey: string,
  quantity: number,
  actionId: string,
): boolean => {
  const available = quantities.get(itemKey) ?? 0;
  if (available < quantity) {
    findings.push(brokenLedgerFinding(input, actionId, itemKey, quantity, available));
    return false;
  }
  const next = available - quantity;
  if (next === 0) quantities.delete(itemKey);
  else quantities.set(itemKey, next);
  return true;
};
```

For `PRODUCE`, require every `from` subtraction to return `true` before adding the output. An underflow finding rejects the branch later in Task 6, but the ledger result itself must also remain physically possible. Create findings through the shared stable-ID helper from Task 2 using the item key as discriminator, so repeated compilation returns byte-identical finding IDs.

`replayRuneProofConfirmedItemLedger` reuses the same effect reducer without findings. Seed only the exact quantities of `PLAYER_OBTAINED` roots whose canonical item key or one declared exact `alternatives` key is explicitly confirmed; always store that quantity under the canonical root key. An unconfirmed root contributes zero, and a boolean key never proves more than the reviewed root quantity. Build a separate alternative→canonical alias table for the requirement snapshot; reject ambiguous alternatives during compilation. In stable route order, replay only completed actions whose dependencies have also replayed. Apply `ACQUIRE`, `QUEST_PROVIDED`, transformation, consumption, return, lend, and replacement effects exactly; if an old/corrupt completion would underflow, skip that action's effects rather than create inventory. Return the exact quantities remaining after completed active-route actions. This projection is runtime evidence for `ITEM` and transport-fare gates; it is never written to canonical game state.

- [ ] **Step 4: Run ledger tests and typecheck**

Run:

```bash
npx vitest run utils/questStrategies/itemLedger.test.ts
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the ledger**

```bash
git add utils/questStrategies/itemLedger.ts utils/questStrategies/itemLedger.test.ts
git commit -m "feat: validate RuneProof branch item ledgers"
```

---

### Task 5: Recommend, Pin, and Deliberately Switch Branches

**Files:**
- Create: `utils/questStrategies/branches.ts`
- Create: `utils/questStrategies/branches.test.ts`
- Create: `utils/questStrategies/testFixtures.ts`

**Interfaces:**
- Consumes: `RuneProofCompiledPack`, `RuneProofProofState`, and globally unique action/manual IDs.
- Produces: `rankRuneProofBranches(input)`, `resolveRuneProofBranch(input)`, `activeRuneProofConfirmations(input)`, and `withSelectedRuneProofBranch(progress, branchId, pack, evaluations)`.

- [ ] **Step 1: Write failing recommendation and pinning tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  activeRuneProofConfirmations,
  rankRuneProofBranches,
  resolveRuneProofBranch,
  withSelectedRuneProofBranch,
} from './branches';
import { branchingPack } from './testFixtures';

const evaluations = {
  local: { state: 'READY', evidenceComplete: true },
  remote: { state: 'READY', evidenceComplete: true },
} as const;

describe('RuneProof branch selection', () => {
  it('recommends legal, evidenced, local, low-unlock, low-risk, authored order', () => {
    const ranked = rankRuneProofBranches({ pack: branchingPack, evaluations });
    expect(ranked.map(branch => branch.branchId)).toEqual(['local', 'remote']);
    expect(ranked[0].recommendationReason).toContain('local reviewed route');
  });

  it('pins after branch-specific progress even if the recommendation changes', () => {
    const selection = resolveRuneProofBranch({
      pack: branchingPack,
      evaluations: {
        local: { state: 'BLOCKED', evidenceComplete: true },
        remote: { state: 'READY', evidenceComplete: true },
      },
      progress: {
        selectedBranchId: undefined,
        confirmedActionIds: ['local:step'],
        confirmedItemKeys: [],
        manualConfirmationIds: [],
        confirmedCheckpointIds: [],
      },
    });
    expect(selection).toMatchObject({ branchId: 'local', pinned: true });
  });

  it.each([
    ['item', { confirmedItemKeys: ['local token'] }],
    ['manual proof', { manualConfirmationIds: ['local:manual'] }],
    ['checkpoint', { confirmedCheckpointIds: ['local:checkpoint'] }],
  ])('also pins from branch-specific %s', (_label, confirmation) => {
    const selection = resolveRuneProofBranch({
      pack: branchingPack,
      evaluations,
      progress: {
        selectedBranchId: undefined,
        confirmedActionIds: [],
        confirmedItemKeys: [],
        manualConfirmationIds: [],
        confirmedCheckpointIds: [],
        ...confirmation,
      },
    });
    expect(selection).toMatchObject({ branchId: 'local', pinned: true });
  });

  it('does not pin when one proof target completes actions on multiple branches', () => {
    const pack = packWithSharedBranchItemTarget(branchingPack, 'shared token');
    const selection = resolveRuneProofBranch({
      pack,
      evaluations,
      progress: {
        selectedBranchId: undefined,
        confirmedActionIds: [],
        confirmedItemKeys: ['shared token'],
        manualConfirmationIds: [],
        confirmedCheckpointIds: [],
      },
    });
    expect(selection).toMatchObject({ branchId: 'local', pinned: false });
  });

  it('switches only through an explicit update and retains inactive confirmations', () => {
    const switched = withSelectedRuneProofBranch({
      selectedBranchId: 'local',
      confirmedActionIds: ['shared:start', 'local:step', 'remote:step'],
      confirmedItemKeys: [],
      manualConfirmationIds: [],
      confirmedCheckpointIds: [],
    }, 'remote', branchingPack, evaluations);
    expect(switched.selectedBranchId).toBe('remote');
    expect(switched.confirmedActionIds).toEqual(['shared:start', 'local:step', 'remote:step']);
    expect(activeRuneProofConfirmations({ pack: branchingPack, progress: switched })
      .actionIds).toEqual(new Set(['shared:start', 'remote:step']));
  });

  it('never recommends a needs-review branch as playable', () => {
    const ranked = rankRuneProofBranches({
      pack: branchingPack,
      evaluations: {
        local: { state: 'NEEDS_REVIEW', evidenceComplete: false },
        remote: { state: 'BLOCKED', evidenceComplete: true },
      },
    });
    expect(ranked[0].branchId).toBe('remote');
    expect(ranked.find(branch => branch.branchId === 'local')?.playable).toBe(false);
  });

  it('returns no recommendation when every route needs review', () => {
    const allReview = {
      local: { state: 'NEEDS_REVIEW', evidenceComplete: false },
      remote: { state: 'NEEDS_REVIEW', evidenceComplete: false },
    } as const;
    expect(rankRuneProofBranches({
      pack: branchingPack,
      evaluations: allReview,
    }).every(branch => branch.recommended === false)).toBe(true);
    expect(resolveRuneProofBranch({
      pack: branchingPack,
      evaluations: allReview,
      progress: {
        selectedBranchId: undefined,
        confirmedActionIds: [],
        confirmedItemKeys: [],
        manualConfirmationIds: [],
        confirmedCheckpointIds: [],
      },
    })).toMatchObject({
      branchId: undefined,
      recommendedBranchId: undefined,
      pinned: false,
    });
  });

  it('rejects a direct switch to a needs-review branch', () => {
    expect(() => withSelectedRuneProofBranch({
      selectedBranchId: 'local',
      confirmedActionIds: [],
      confirmedItemKeys: [],
      manualConfirmationIds: [],
      confirmedCheckpointIds: [],
    }, 'remote', branchingPack, {
      local: { state: 'READY', evidenceComplete: true },
      remote: { state: 'NEEDS_REVIEW', evidenceComplete: false },
    })).toThrow(/remote.*needs review/i);
  });
});
```

Create `exampleCatalogueEntry`, a raw `branchingPackDefinition: RuneProofQuestPack`, a separate `branchingPack: RuneProofCompiledPack`, and `packWithSharedBranchItemTarget` in `utils/questStrategies/testFixtures.ts` during this step. The raw definition has one shared `ACTION_CONFIRMED` action, `local:step` and `remote:step` as `ACTION_CONFIRMED`, deterministic rank fields, and one distinct canonical completion action per route named by `completion.branchActionIds`. Give the local route the exact owned proof IDs `local token`, `local:manual`, and declared `checkpointIds: ['local:checkpoint']`; the remote route has disjoint equivalents. The shared-target helper changes one branch step per route to `ITEM_CONFIRMED` with the same item key without changing their recommendation ranks. This makes action, item, manual, checkpoint, and ambiguous-target pinning tests non-vacuous. Build the compiled fixture by deep-freezing a clone of the raw definition plus `catalogue: exampleCatalogueEntry` and `findings: []`; do not make the compiled fixture an input to Task 6's strict raw-pack compiler.

- [ ] **Step 2: Run the branch tests and confirm the missing module failure**

Run:

```bash
npx vitest run utils/questStrategies/branches.test.ts
```

Expected: FAIL because `./branches` does not exist.

- [ ] **Step 3: Implement branch ranking and progress projection**

```ts
export interface RuneProofBranchProgressView {
  readonly selectedBranchId?: string;
  readonly confirmedActionIds: readonly string[];
  readonly confirmedItemKeys: readonly string[];
  readonly manualConfirmationIds: readonly string[];
  readonly confirmedCheckpointIds: readonly string[];
}

export interface RuneProofBranchEvaluation {
  readonly state: Exclude<RuneProofProofState, 'COMPLETE'>;
  readonly evidenceComplete: boolean;
}

export interface RankedRuneProofBranch {
  readonly branchId: string;
  readonly playable: boolean;
  readonly recommended: boolean;
  readonly recommendationReason: string;
  readonly rank: readonly [number, number, number, number, number, number];
}

export function activeRuneProofConfirmations(input: {
  readonly pack: RuneProofCompiledPack;
  readonly progress: RuneProofBranchProgressView;
  readonly branchId?: string;
}): Readonly<{
  actionIds: ReadonlySet<string>;
  itemKeys: ReadonlySet<string>;
  manualIds: ReadonlySet<string>;
  checkpointIds: ReadonlySet<string>;
}>;

export function withSelectedRuneProofBranch<T extends RuneProofBranchProgressView>(
  progress: T,
  branchId: string,
  pack: RuneProofCompiledPack,
  evaluations: Readonly<Record<string, RuneProofBranchEvaluation>>,
): Omit<T, 'selectedBranchId'> & { readonly selectedBranchId: string };
```

Build the rank tuple exactly as:

```ts
const proofRank = (state: RuneProofBranchEvaluation['state']): number =>
  state === 'READY' || state === 'CONFIRM' ? 0
    : state === 'BLOCKED' ? 1
      : 2;

const tupleFor = (
  branch: RuneProofBranch,
  evaluation: RuneProofBranchEvaluation,
): RankedRuneProofBranch['rank'] => [
  proofRank(evaluation.state),
  evaluation.evidenceComplete ? 0 : 1,
  branch.rank.localRoutePenalty,
  branch.rank.newUnlockCount,
  branch.rank.riskCost,
  branch.rank.tieBreak,
];
```

Sort tuples numerically and use branch ID only as a final stability fallback. The first non-`NEEDS_REVIEW` branch is recommended; when none exists, every `recommended` flag is false and the recommendation ID is `undefined`. Produce the explanation from the first decisive tuple position: legal now, complete evidence, local route, fewer unlocks, lower reviewed risk/resource cost, or authored tie-break.

`resolveRuneProofBranch` chooses:

1. A valid explicit `selectedBranchId`.
2. For each newly satisfied proof, collect every branch action whose declared action/item/manual/checkpoint target it satisfies. Pin only when that complete owner set has exactly one branch; explicit action-ID proof is naturally unique because action IDs are global. Then consider any uniquely branch-owned requirement proof not attached to an action. Among unambiguous candidates use first authored occurrence then branch ID; never let authored order choose one owner of a multi-branch item/manual/checkpoint proof.
3. The current recommendation when one exists.

If none exists and there is no already-selected branch, return `branchId: undefined`, `recommendedBranchId: undefined`, and `pinned:false`; never use a non-null assertion to invent a playable route.

It reports `pinned: true` for cases 1 and 2. `activeRuneProofConfirmations` returns structured action/item/manual/checkpoint sets for globally shared definitions plus the supplied branch ID, or the selected branch when no branch ID is supplied. Build a proof-ID ownership set by walking pack preflight, initial roots/alternatives, shared/branch action completions and effects, combat declarations, manual requirements, and branch checkpoint declarations. Pack/shared occurrences have global ownership; a semantically identical manual or item proof referenced by multiple branches owns that exact branch set and is active only on one of those routes. Pinning is based first on the owner of the satisfied branch action—not merely the raw proof ID—so a globally meaningful root item that completes one branch's action still pins that route. A standalone proof with one branch owner may then pin; a global or multi-branch proof is ambiguous and does not pin by itself. Branch checkpoint IDs are globally unique, owned by exactly one branch, and targeted only by that branch's actions; shared actions may not use `BRANCH_CHECKPOINT`. Incompatible branch-specific item/manual/checkpoint proof remains stored but inactive exactly like action proof. `withSelectedRuneProofBranch(progress, branchId, pack, evaluations)` rejects unknown branches and rejects any branch whose supplied current evaluation is missing or `NEEDS_REVIEW`; its return type omits and widens only `selectedBranchId` while preserving every other V2 field and confirmation array without a cast. The hook and Goal Planner must pass the same evaluated options used to render the selector, so a lower-level direct call cannot bypass the disabled UI.

- [ ] **Step 4: Run branch tests and typecheck**

Run:

```bash
npx vitest run utils/questStrategies/branches.test.ts
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit branch behavior**

```bash
git add utils/questStrategies/branches.ts utils/questStrategies/branches.test.ts utils/questStrategies/testFixtures.ts
git commit -m "feat: add RuneProof branch selection"
```

---

### Task 6: Compile Packs with Structured, Branch-Local Findings

**Files:**
- Create: `utils/questStrategies/packCompiler.ts`
- Create: `utils/questStrategies/packCompiler.test.ts`
- Modify: `utils/questStrategies/requirements.ts`
- Modify: `utils/questStrategies/testFixtures.ts`

**Interfaces:**
- Consumes: `RuneProofQuestPack`, `RuneProofCatalogueEntry`, `validateRequirementExpression(expression)`, and `evaluateRuneProofItemLedger(input)`.
- Produces: `compileRuneProofQuestPack(definition, context): RuneProofCompileResult`.

- [ ] **Step 1: Write failing compiler tests for pack-wide and branch-local rejection**

```ts
import { describe, expect, it } from 'vitest';
import { compileRuneProofQuestPack } from './packCompiler';
import { validateRequirementExpression } from './requirements';
import {
  branchingPackDefinition,
  exampleCatalogueEntry,
} from './testFixtures';

const context = {
  catalogue: exampleCatalogueEntry,
  expectedCatalogueRevision: 'catalogue-revision',
} as const;

describe('RuneProof pack compiler', () => {
  it('accepts no-gate ALL, rejects empty ANY, and stops at the node cap', () => {
    expect(validateRequirementExpression({ kind: 'ALL', requirements: [] }).valid)
      .toBe(true);
    expect(validateRequirementExpression({ kind: 'ANY', requirements: [] }).valid)
      .toBe(false);
    const requirements = Array.from({ length: 3_000 }, (_, index) => ({
      kind: 'MANUAL_CONFIRMATION',
      id: `manual:${index}`,
      confirmationId: `manual:${index}`,
      prompt: `Confirm ${index}.`,
      evidenceIds: ['review:example'],
    }));
    Object.defineProperty(requirements, 2_500, {
      enumerable: true,
      get: () => { throw new Error('traversed beyond global cap'); },
    });
    const validation = validateRequirementExpression({ kind: 'ALL', requirements });
    expect(validation.errors.filter(error => error.includes('2048 nodes')))
      .toHaveLength(1);
  });

  it('deep-freezes a valid pack and keeps both valid branches', () => {
    const result = compileRuneProofQuestPack(branchingPackDefinition, context);
    expect(result.findings).toEqual([]);
    expect(result.rejectedBranchIds).toEqual([]);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['local', 'remote']);
    expect(Object.isFrozen(result.pack)).toBe(true);
    expect(Object.isFrozen(result.pack?.branches[0].actions)).toBe(true);
  });

  it('rejects one broken ledger without hiding a valid sibling branch', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].actions[0].itemEffects = [
      { kind: 'CONSUME', itemKey: 'missing item', quantity: 1 },
    ];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['local']);
    expect(Object.keys(result.pack!.completion.branchActionIds)).toEqual(['local']);
    expect(result.rejectedBranchIds).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'BROKEN_ITEM_LEDGER',
      branchId: 'remote',
    }));
  });

  it('emits deterministic unique finding IDs', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].actions[0].itemEffects = [
      { kind: 'CONSUME', itemKey: 'missing item', quantity: 1 },
    ];
    const first = compileRuneProofQuestPack(changed, context).findings;
    const second = compileRuneProofQuestPack(changed, context).findings;
    expect(first.map(finding => finding.id)).toEqual(second.map(finding => finding.id));
    expect(new Set(first.map(finding => finding.id)).size).toBe(first.length);
  });

  it('isolates missing player-visible evidence to its owning branch', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].evidenceIds = [];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.rejectedBranchIds).toEqual(['local']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH',
      branchId: 'local',
      severity: 'BLOCKING',
    }));
  });

  it.each([
    ['blank source ID', (pack: any) => { pack.sources[0].id = ' '; }],
    ['invalid source timestamp', (pack: any) => {
      pack.sources[0].revisionTimestamp = 'not-a-time';
    }],
    ['review before source revision', (pack: any) => {
      pack.sources[0].revisionTimestamp = '2026-08-22T12:00:00.000Z';
      pack.sources[0].reviewedAt = '2026-08-22T11:00:00.000Z';
    }],
    ['blank evidence decision', (pack: any) => { pack.evidence[0].decision = ''; }],
  ])('rejects malformed pack provenance: %s', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH',
      scope: 'PACK',
    }));
  });

  it('rejects duplicate temporary-boost source IDs in its owning branch', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = temporaryBoostRequirement({
      boostSourceIds: ['spicy stew', 'spicy stew'],
    });
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_REQUIREMENT_REFERENCE',
      branchId: 'local',
    }));
  });

  it('rejects a mixed deterministic/manual ANY whose completion path is ambiguous', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = requirementAny(
      skillRequirement('Mining', 99),
      manualRequirement('manual:fallback', 'Confirm the reviewed fallback.'),
    );
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_REQUIREMENT_REFERENCE',
      branchId: 'local',
    }));
  });

  it('rejects duplicate migration source revisions', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    const migration = (id: string) => ({
      id,
      fromRevision: 'pack-v0',
      actionIds: {},
      itemKeys: {},
      branchIds: {},
      manualConfirmationIds: {},
      checkpointIds: {},
    });
    changed.migrations = [migration('migration:a'), migration('migration:b')];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_MIGRATION',
      severity: 'BLOCKING',
    }));
  });

  it.each([
    ['source order', (pack: any) => {
      pack.branches[0].actions[0].sourceOrder = Number.POSITIVE_INFINITY;
    }, 'INVALID_ORDER'],
    ['branch rank', (pack: any) => {
      pack.branches[0].rank.riskCost = Number.NaN;
    }, 'INVALID_RANK'],
  ])('isolates invalid numeric %s', (_label, mutate, code) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code,
      branchId: 'local',
    }));
  });

  it.each([
    ['checkpoint', (pack: any) => {
      pack.branches[0].actions[0].completion = {
        kind: 'BRANCH_CHECKPOINT', checkpointId: 'missing:checkpoint',
      };
    }],
    ['item', (pack: any) => {
      pack.branches[0].actions[0].completion = {
        kind: 'ITEM_CONFIRMED', itemKey: 'missing item',
      };
    }],
    ['branch state', (pack: any) => {
      pack.branches[0].requirements = {
        kind: 'BRANCH_STATE',
        id: 'branch-state:missing',
        branchId: 'local',
        checkpointId: 'missing:checkpoint',
        evidenceIds: ['review:example'],
      };
    }],
  ])('rejects a branch-local unresolved %s proof target', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE',
      branchId: 'local',
    }));
  });

  it.each([
    ['item requirement', () => unresolvedRouteItemRequirement('missing item')],
    ['transport fare', () => transportRequirementWithFare('missing fare', 1)],
  ])('rejects an unsatisfiable route %s', (_label, requirement) => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = requirement();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE',
      branchId: 'local',
    }));
  });

  it('fails closed for a pack-wide duplicate ID', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].actions[0].id = 'local:step';
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID',
      severity: 'BLOCKING',
    }));
  });

  it('fails closed for duplicate branch IDs before completion-map lookup', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].id = changed.branches[0].id;
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID',
      severity: 'BLOCKING',
    }));
  });

  it.each([
    ['duplicate canonical roots', [initialRoot('token'), initialRoot('token')]],
    ['an alternative owned by another canonical root', [
      initialRoot('first', ['second']),
      initialRoot('second'),
    ]],
  ])('fails closed for ambiguous item families: %s', (_label, initialItems) => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.initialItems = initialItems;
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE',
      scope: 'PACK',
    }));
  });

  it('rejects duplicate preferred/alternative method IDs within one action', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    addDuplicateReviewedMethods(changed.branches[0].actions[0], 'method:same');
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID',
      branchId: 'local',
    }));
  });

  it.each([
    ['dangling dependency', (pack: any) => {
      pack.branches[0].actions[0].dependsOn = ['missing'];
    }, 'DANGLING_DEPENDENCY'],
    ['cycle', (pack: any) => {
      pack.branches[0].actions[0].dependsOn = ['local:complete'];
      pack.branches[0].actions[1].dependsOn = ['local:step'];
    }, 'DEPENDENCY_CYCLE'],
  ])('isolates a branch-local %s', (_label, mutate, code) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(Object.keys(result.pack!.completion.branchActionIds)).toEqual(['remote']);
    expect(result.rejectedBranchIds).toEqual(['local']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code,
      branchId: 'local',
      severity: 'BLOCKING',
    }));
  });

  it('requires subjective combat guidance to have manual confirmation and evidence', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].combat = {
      id: 'combat:example',
      encounter: 'Example guardian',
      phases: ['Single phase'],
      mandatoryMechanics: ['Avoid the marked tile.'],
      equipmentCapabilities: ['A reviewed damage option'],
      recommendedSupplies: ['Food'],
      deathAndEscape: 'Escape through the entrance.',
      reentry: 'Return through the reviewed entrance.',
      confirmationId: '',
      evidenceIds: [],
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'MISSING_COMBAT_CONFIRMATION',
      branchId: 'local',
    }));
  });
});
```

- [ ] **Step 2: Run the compiler tests and confirm the missing module failure**

Run:

```bash
npx vitest run utils/questStrategies/packCompiler.test.ts
```

Expected: FAIL because `./packCompiler` does not exist.

- [ ] **Step 3: Export strict finite expression validation**

Add:

```ts
export interface RuneProofRequirementValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export const validateRequirementExpression = (
  expression: unknown,
): RuneProofRequirementValidation => {
  const errors: string[] = [];
  let nodes = 0;
  let nodeLimitReached = false;
  const visit = (value: unknown, depth: number, path: string): void => {
    if (nodeLimitReached) return;
    nodes += 1;
    if (nodes > 2_048) {
      errors.push('requirement expression exceeds 2048 nodes');
      nodeLimitReached = true;
      return;
    }
    if (depth > 32) {
      errors.push(`${path} exceeds depth 32`);
      return;
    }
    if (!isRecord(value) || typeof value.kind !== 'string') {
      errors.push(`${path} must be a requirement object`);
      return;
    }
    if (value.kind === 'ALL' || value.kind === 'ANY') {
      rejectUnexpectedKeys(value, ['kind', 'requirements'], path, errors);
      if (!Array.isArray(value.requirements) || !hasDenseIndexes(value.requirements)) {
        errors.push(`${path}.requirements must be a dense array`);
        return;
      }
      if (value.kind === 'ANY' && value.requirements.length === 0) {
        errors.push(`${path}.requirements must not be empty for ANY`);
        return;
      }
      for (let index = 0;
        index < value.requirements.length && !nodeLimitReached;
        index += 1) {
        visit(value.requirements[index], depth + 1, `${path}.requirements[${index}]`);
      }
      return;
    }
    errors.push(...atomicRequirementErrors(value, path));
  };
  visit(expression, 0, '$');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
};
```

Define private `isRecord`, `hasDenseIndexes`, `rejectUnexpectedKeys`, and `atomicRequirementErrors` in the same file. `hasDenseIndexes` compares array length with own numeric keys without reading element values. `atomicRequirementErrors` uses an exhaustive switch over every Task 2 atomic discriminant and its exact declared field names. Empty `ALL` is the intentional no-gate identity; empty `ANY` is invalid. Arrays must be dense, IDs/evidence must be nonblank, quantities and levels must be positive integers, chunk keys must be canonical `cx,cy`, and planes must be integers; the default switch branch returns `${path}.kind is unknown`.

- [ ] **Step 4: Implement compiler phases and stable finding codes**

```ts
export interface RuneProofPackCompileContext {
  readonly catalogue: RuneProofCatalogueEntry;
  readonly expectedCatalogueRevision: string;
}

export const compileRuneProofQuestPack = (
  definition: RuneProofQuestPack,
  context: RuneProofPackCompileContext,
): RuneProofCompileResult => {
  const findings: RuneProofCompileFinding[] = [];
  validatePackIdentityAndExactKeys(definition, context, findings);
  validatePackSourcesAndSharedEvidence(definition, findings);
  validateDeclarationsAndMigrationShape(definition, findings);
  if (hasPackBlockingFinding(findings)) {
    return freezeResult({ findings, rejectedBranchIds: [] });
  }

  const rejectedBranchIds: string[] = [];
  const branches = definition.branches.filter((branch) => {
    const branchFindings = validateBranchAndItsEvidence(definition, branch);
    findings.push(...branchFindings);
    if (branchFindings.some(finding => finding.severity === 'BLOCKING')) {
      rejectedBranchIds.push(branch.id);
      return false;
    }
    return true;
  });

  if (branches.length === 0) {
    findings.push(packFinding(definition.questId, 'UNREACHABLE_COMPLETION',
      'Every reviewed branch was rejected.'));
    return freezeResult({ findings, rejectedBranchIds });
  }

  const acceptedBranchIds = new Set(branches.map(branch => branch.id));
  const acceptedMigrations = pruneAndValidateMigrations(
    definition,
    branches,
    findings,
  );
  if (hasPackBlockingFinding(findings)) {
    return freezeResult({ findings, rejectedBranchIds });
  }
  return freezeResult({
    pack: {
      ...definition,
      catalogue: context.catalogue,
      branches,
      migrations: acceptedMigrations,
      completion: {
        ...definition.completion,
        branchActionIds: Object.fromEntries(
          Object.entries(definition.completion.branchActionIds)
            .filter(([branchId]) => acceptedBranchIds.has(branchId)),
        ),
      },
      findings,
    },
    findings,
    rejectedBranchIds,
  });
};
```

Implement these exact phases:

- Pack exact-key/schema/identity validation: schema 1, exact quest ID, exact catalogue revision, nonblank pack revision, nonempty sources/evidence/branches, and no unknown fields.
- Evidence validation is deliberately split by isolation scope. Pack-wide validation covers unique source/evidence rows, evidence→source resolution, every evidence-bearing initial root, pack preflight, shared actions, and completion metadata. Every source has a nonblank ID, URI, revision, ISO `revisionTimestamp`, and ISO `reviewedAt`; `reviewedAt` must not precede `revisionTimestamp`. Every evidence row has nonblank ID, source ID, source locator, and decision. `WIKI_REVISION` URIs must be absolute HTTPS oldschool.runescape.wiki URLs pinned to their revision; other source kinds still require a nonblank stable URI. `INDEPENDENT_REVIEW` requires nonblank `author` and `methodology`. Branch validation owns that branch, its checkpoint declarations (covered by the branch's evidence), requirements/actions, locations, methods, alternatives, combat, and route completion reference. Every evidence-bearing player-visible semantic record must have a nonempty evidence array and every ID must resolve; empty `ALL` is the only intentional evidence-free no-gate identity. A bare checkpoint ID is not a semantic record by itself: its nonempty branch evidence plus the targeting action's evidence supply provenance. A missing branch/action/location/method/alternative record rejects only that branch; a malformed source/evidence table or shared record rejects the pack.
- Declaration/reference validation: branch IDs and action IDs are each globally unique. Validate branch-ID uniqueness before building maps or looking up completion entries; duplicate branch IDs are pack-wide `DUPLICATE_ID`. Within each action, the preferred-method ID and every alternative-method ID form one unique namespace; duplicate method IDs reject that branch with `DUPLICATE_ID`, while the same stable method ID may be reused in a different action because UI/storage identity is `(actionId, methodId)`. Branch checkpoint IDs are globally unique and targeted only by actions in their owner branch; a shared action using `BRANCH_CHECKPOINT` is invalid. Every `BRANCH_STATE` branch/checkpoint pair resolves to that exact branch. `ACTION_CONFIRMED` has no fields and implicitly uses its enclosing globally unique action ID; every `ITEM_CONFIRMED` key resolves to a canonical root, a declared root alternative, or a route effect item. Build manual declarations from every `MANUAL_CONFIRMATION` atom, combat record, and explicit `MANUAL` action completion; the latter uses that action's normalized instruction and evidence as its declaration semantics. Repeated manual declarations are allowed only when normalized prompt/kind/evidence semantics are identical, including identical occurrences reused across branches; conflicting reuse is pack-wide `DUPLICATE_ID`. Collect pack-preflight manual declarations too.
- Item-family validation: canonical initial-root keys are unique, every root/alternative key is nonblank and canonical, and each key across the union of canonical and alternative keys has one owner. A canonical key owns itself; it may appear in its own alternatives only as an exact redundant self-alias that normalization removes, and it may not be an alternative of a different root. Route effects use canonical root keys for family operations. Duplicate roots or ambiguous family ownership are pack-wide `INVALID_PROOF_REFERENCE`.
- Migration validation: IDs and `fromRevision` values are both unique; source revisions are nonblank and differ from the current revision; map keys/values are nonblank, source and destination differ, and a source maps once. Unchanged IDs are omitted rather than encoded as self-maps. Validate exact action/item/branch/manual/checkpoint keys before branch compilation. After branch-local rejection, prune mappings whose destinations belong only to rejected branches, then validate every remaining destination against the accepted graph. An unresolved or ambiguous surviving destination is pack-wide `INVALID_MIGRATION`; never retain a mapping to a stripped branch.
- Graph/numeric validation per branch: merge shared plus that branch's actions, require every `sourceOrder` to be a finite positive integer, order by `sourceOrder` then ID, disallow equal source order within the merged route, disallow shared actions depending on branch actions, and reject cross-branch dependencies, dangling IDs, forward dependencies, cycles, and unreachable nodes. Require every branch rank component to be a finite nonnegative integer so recommendation sorting cannot receive `NaN`/Infinity.
- Completion validation: `completion.canonicalQuestId` equals the pack ID; compare `branchActionIds` key count with the original branch-array cardinality and require one exact key per unique branch ID; each mapped action is in that route, is the single route action with `CANONICAL_QUEST_COMPLETED`, names the pack quest ID, and is terminal.
- Location validation: surface actions have at least one unique canonical chunk and an integer plane; instances have at least one reviewed entrance chunk, a nonblank instance ID/label, and an integer plane.
- Requirements: call `validateRequirementExpression` for pack, branch, action, and alternative expressions. Reject any `ANY` node that contains a `MANUAL_CONFIRMATION` anywhere beneath it unless every atomic descendant of every child is `MANUAL_CONFIRMATION`; deterministic/manual fallback choices must be explicit branches, because the compact progress index intentionally has no account snapshot. Manual-only `ANY` remains a valid acknowledgement choice and preserves normal source-order winning-child semantics. Require `TEMPORARY_BOOST.boostSourceIds` to be a nonempty source-order array of unique nonblank canonical item IDs. Validate every `REGION_ACCESS` against `RUNE_PROOF_CANONICAL_AREA_IDS`, every branch/checkpoint reference against declarations, and transport origin/destination canonical chunks. Validate every `ITEM` atom and `TRANSPORT_ACCESS.fare` key against the proof/ledger universe available at that exact gate: pack/branch preflight may use only reviewed initial root families; an action may additionally use effects from earlier composite-completable actions in its merged route. Resolve aliases to their canonical family, replay quantities/consumption in source order, and require the optimistic reviewed quantity at the gate to cover the atom/fare quantity. A key first produced by the same or later action is not available. Missing or deterministically insufficient supply is branch-local `INVALID_PROOF_REFERENCE`; a pack-preflight failure is pack-wide. Combat recommendations have no hidden expression; deterministic encounter/access gates belong in the containing action requirements.
- Combat: a combat record requires nonblank encounter/mechanic/death/re-entry copy and nonempty evidence. Its confirmation ID is a manual declaration with the fixed combat acknowledgement semantics; identical references may reuse it, conflicting declarations may not. Recommendations never become deterministic blockers.
- Ledger: call Task 4 once for each merged branch route.
- Isolation: pack-wide identity/source-table/shared-record/conflicting-declaration/migration errors reject the pack; branch evidence/graph/numeric/location/requirement/proof-reference/combat/ledger errors reject only that branch; warnings never reject.

`hasPackBlockingFinding` checks only `severity === 'BLOCKING' && scope === 'PACK'`; branch/action findings are consumed by their owning branch filter and can never accidentally reject a valid sibling. Every finding helper requires a stable discriminator and calls Task 2's shared `runeProofFindingId`, whose percent-encoded segments tag each optional scope segment as absent `0` or present `1:<value>` before forming the delimited ID. A literal `-`, `0`, or delimiter inside a real ID therefore cannot collide with absence. Use semantic discriminators such as source ID, evidence ID, dependency ID, item key, location field, confirmation ID, or migration ID—never message text or traversal index. Reject duplicate finding IDs, sort findings by ID before freezing, and ensure Task 4 ledger findings use the same helper. When branch-local rejection succeeds, rebuild `completion.branchActionIds` to contain exactly the accepted branch keys and emit only the pruned, destination-valid migration maps; never leave completion or migration references to stripped branches.

- [ ] **Step 5: Run compiler and upstream tests**

Run:

```bash
npx vitest run utils/questStrategies/requirements.test.ts utils/questStrategies/itemLedger.test.ts utils/questStrategies/branches.test.ts utils/questStrategies/packCompiler.test.ts
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the compiler**

```bash
git add utils/questStrategies/requirements.ts utils/questStrategies/packCompiler.ts utils/questStrategies/packCompiler.test.ts utils/questStrategies/testFixtures.ts
git commit -m "feat: compile RuneProof packs with findings"
```

---

### Task 7: Adapt the Five Golden Walkthroughs Without Changing Their Journeys

**Files:**
- Create: `utils/questStrategies/legacyPackAdapter.ts`
- Create: `utils/questStrategies/legacyPackAdapter.test.ts`
- Modify: `utils/questStrategies/model.ts`
- Modify: `utils/questStrategies/model.test.ts`
- Modify: `data/questWalkthroughs.public.ts`
- Modify: `data/questWalkthroughs.preview-boundary.ts`

**Interfaces:**
- Consumes: current `QuestStrategyDefinition`, the generic catalogue entry, typed preflight expression, reviewed roots, and Task 6 compiler.
- Produces: `legacyStrategyToRuneProofPack(strategy, context): RuneProofQuestPack`; existing `questStrategyFromWalkthrough` remains available as the compatibility projection for the route analyzer.

- [ ] **Step 1: Write failing five-pack adapter regressions**

```ts
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../../data/questData';
import { reviewedQuestRequirements } from '../../data/questItemRequirements';
import {
  runeProofCatalogueFor,
  runeProofCatalogueRevision,
} from '../../data/runeProofQuestCatalogue';
import { questStrategyCatalogue } from '../../data/questWalkthroughs.public';
import { compileRuneProofQuestPack } from './packCompiler';
import { requirementExpressionForQuestData } from './preflight';
import { legacyStrategyToRuneProofPack } from './legacyPackAdapter';

const PUBLIC_IDS = [
  "Cook's Assistant",
  'Sheep Shearer',
  'The Restless Ghost',
  'Rune Mysteries',
  'Imp Catcher',
];

describe('legacy RuneProof pack adapter', () => {
  it('compiles exactly the five public journeys as one main branch', () => {
    expect(questStrategyCatalogue.map(strategy => strategy.questId)).toEqual(PUBLIC_IDS);
    for (const strategy of questStrategyCatalogue) {
      const catalogue = runeProofCatalogueFor(strategy.questId)!;
      const quest = QUEST_DATA[strategy.questId];
      const pack = legacyStrategyToRuneProofPack(strategy, {
        catalogue,
        catalogueRevision: runeProofCatalogueRevision,
        preflight: requirementExpressionForQuestData(quest, catalogue),
        reviewedRoots: reviewedQuestRequirements(strategy.questId)!.items,
      });
      const result = compileRuneProofQuestPack(pack, {
        catalogue,
        expectedCatalogueRevision: pack.catalogueRevision,
      });
      expect(result.findings.filter(finding => finding.severity === 'BLOCKING')).toEqual([]);
      expect(unresolvedManualCompletionIds(pack)).toEqual([]);
      expect(result.pack?.branches.map(branch => branch.id)).toEqual(['main']);
      expect([
        ...result.pack!.sharedActions,
        ...result.pack!.branches[0].actions,
      ].map(action => action.id)).toEqual(strategy.actions.map(action => action.id));
    }
  });

  it('retains the accepted Cook route and does not pre-seed route-produced ingredients', () => {
    const strategy = questStrategyCatalogue.find(value => value.questId === "Cook's Assistant")!;
    const catalogue = runeProofCatalogueFor(strategy.questId)!;
    const pack = legacyStrategyToRuneProofPack(strategy, {
      catalogue,
      catalogueRevision: runeProofCatalogueRevision,
      preflight: { kind: 'ALL', requirements: [] },
      reviewedRoots: reviewedQuestRequirements(strategy.questId)!.items,
    });
    expect(pack.branches[0].actions.find(action => action.id === 'cooks-assistant:pick-grain'))
      .toMatchObject({
        instruction: 'Pick grain outside Mill Lane Mill.',
        location: { kind: 'SURFACE', chunks: ['49,51'] },
      });
    expect(pack.initialItems.map(item => item.item.key)).not.toContain('grain');
    expect(pack.initialItems.map(item => item.item.key)).not.toContain('pot of flour');
  });
});
```

- [ ] **Step 2: Run the adapter tests and confirm the missing module failure**

Run:

```bash
npx vitest run utils/questStrategies/legacyPackAdapter.test.ts
```

Expected: FAIL because `./legacyPackAdapter` does not exist.

- [ ] **Step 3: Generalize strategy metadata while retaining compatibility**

Replace the F2P-only context:

```ts
export interface QuestStrategyContext {
  readonly catalogue: RuneProofCatalogueEntry;
  readonly rootRequirements: readonly QuestItemRequirement[];
}

export interface QuestStrategyDefinition {
  readonly questId: string;
  readonly kind: RuneProofCatalogueEntry['kind'];
  readonly membership: RuneProofCatalogueEntry['membership'];
  /** Compatibility name retained while existing consumers migrate. */
  readonly rolloutWave: RuneProofCatalogueEntry['milestone'];
  readonly progressionPriority: number;
  readonly revision: string;
  readonly source: QuestWalkthroughDefinition['source'];
  readonly sourceLines: QuestWalkthroughDefinition['sourceLines'];
  readonly actions: readonly (QuestStrategyAction & {
    readonly mapChunks: readonly ChunkKey[];
  })[];
}
```

`legacyStrategyContextFor` now resolves `runeProofCatalogueFor(walkthrough.questId)` and reviewed roots. Explicit callers pass the same generic catalogue entry. Keep all existing strict action/location/graph checks and all current tests.

- [ ] **Step 4: Implement lossless semantic conversion**

```ts
export interface LegacyStrategyPackContext {
  readonly catalogue: RuneProofCatalogueEntry;
  readonly catalogueRevision: string;
  readonly preflight: RequirementExpression;
  readonly reviewedRoots: readonly QuestItemRequirement[];
}

export const legacyStrategyToRuneProofPack = (
  strategy: QuestStrategyDefinition,
  context: LegacyStrategyPackContext,
): RuneProofQuestPack => {
  const actions = strategy.actions.map(action => adaptAction(action, strategy));
  const externallyRequired = externalItemKeys(actions);
  const initialItems = context.reviewedRoots
    .filter(root => root.supplyPolicy === 'PLAYER_OBTAINED'
      && externallyRequired.has(root.item.key))
    .map(root => ({
      ...structuredClone(root),
      evidenceIds: [initialItemEvidenceId(root.item.key)],
    }));
  const sources = sourceReferencesFor(strategy, context.catalogue);
  const evidence = evidenceReferencesFor({
    strategy,
    catalogue: context.catalogue,
    preflight: context.preflight,
    initialItems,
    sources,
  });
  const completionAction = actions.find(action =>
    action.completion.kind === 'CANONICAL_QUEST_COMPLETED');

  if (!completionAction) {
    throw new Error(`Legacy strategy ${strategy.questId} has no completion action.`);
  }

  return defineRuneProofQuestPack({
    schemaVersion: 1,
    questId: strategy.questId,
    revision: strategy.revision,
    catalogueRevision: context.catalogueRevision,
    sources,
    evidence,
    initialItems,
    preflight: context.preflight,
    branches: [{
      id: 'main',
      label: 'Reviewed route',
      requirements: requirementAll(),
      rank: {
        localRoutePenalty: 0,
        newUnlockCount: 0,
        riskCost: 0,
        tieBreak: 0,
      },
      actions,
      checkpointIds: [],
      evidenceIds: actions.flatMap(action => action.evidenceIds),
    }],
    sharedActions: [],
    completion: {
      canonicalQuestId: strategy.questId,
      branchActionIds: { main: completionAction.id },
      evidenceIds: completionAction.evidenceIds,
    },
    migrations: [],
  });
};
```

`adaptAction` applies these exact mappings:

- Preserve ID, source order, display text, dependencies, and static `mapChunks`.
- Convert map chunks to `SURFACE`; use the reviewed alias as the label when present and otherwise use the action display text; carry plane 0 and action evidence.
- Convert legacy `QUEST_COMPLETED` to `CANONICAL_QUEST_COMPLETED`; `ITEM_CONFIRMED` preserves its item key; ordinary legacy `MANUAL` becomes `ACTION_CONFIRMED` so documented V1 action-ID confirmations remain valid. Reserve explicit `MANUAL` completion with stable ID `manual:<action-id>` for future authored packs that intentionally persist a named manual proof rather than the action ID.
- If a transformation fulfils an output, emit one `PRODUCE` whose `from` list is the legacy consumes list; do not also emit duplicate `CONSUME` effects for those inputs.
- Emit remaining consumes as `CONSUME`.
- Emit quest-provided fulfils as `QUEST_PROVIDED`; other non-transformation fulfils as `ACQUIRE`.
- Emit action items not consumed as `REUSE` when a transformation uses them and `RETAIN` otherwise.
- Convert only existing accepted direct-source/transformation metadata into a reviewed preferred method. Preserve an accepted `INTERCHANGEABLE` route as an explicitly labelled legacy alternative; never admit arbitrary new resolver output.
- Build one independent-review evidence record per action, plus evidence records for every retained source line.
- `sourceReferencesFor` includes the strategy sources plus canonical `quest-data:<quest-id>` and `reviewed-roots:<quest-id>` sources, and every explicitly named audit source required by unresolved preflight evidence. `evidenceReferencesFor` recursively walks the complete `context.preflight`, appends one row for every referenced preflight evidence ID, and resolves `quest-data:<quest-id>` to the quest-data source and audit evidence to its exact catalogue/audit source. An unknown referenced evidence ID throws; the adapter never invents a source.
- Build one `initialItemEvidenceId(itemKey)` record per retained reviewed root, attach that nonempty ID to the `RuneProofInitialItemRequirement`, and include the row in `evidence`; its decision names the exact root quantity and accepted alternatives and cites `reviewed-roots:<quest-id>` without treating route-produced items as roots.
- Merge action, source-line, preflight, and initial-item evidence by exact ID. Identical duplicates collapse; a duplicate ID with different source IDs or decision text throws. The resulting compiler test must therefore prove that every `quest-data:<quest-id>` preflight reference and every initial-item evidence reference resolves before any of the five packs can compile.

`externalItemKeys` walks source order and marks a key external only when a `CONSUME`, `RETAIN`, `REUSE`, `RETURN`, or `LEND` requires it before any earlier `ACQUIRE`, `PRODUCE`, or `QUEST_PROVIDED` effect supplies it.

In the test, `unresolvedManualCompletionIds` collects every explicit `MANUAL` action completion and checks it against declarations from manual requirement atoms, combat records, and the action completion's own normalized instruction/evidence. Also assert that every ordinary legacy-manual action adapts to `ACTION_CONFIRMED` with the unchanged action ID, so Task 9's V1 migration retains it. These assertions run for all five adapted packs in addition to the compiler result.

- [ ] **Step 5: Compile public and preview catalogues with generic contexts**

In both catalogue modules:

```ts
const catalogue = runeProofCatalogueFor(walkthrough.questId);
const roots = reviewedQuestRequirements(walkthrough.questId);
if (!catalogue || !roots || !release || release.revision !== walkthrough.revision) return [];

const strategy = questStrategyFromWalkthrough(walkthrough, {
  catalogue,
  rootRequirements: roots.items,
});
```

Do not change the set of current public quest IDs or any public action definition.

- [ ] **Step 6: Run all five golden suites**

Run:

```bash
npx vitest run utils/questStrategies/model.test.ts utils/questStrategies/legacyPackAdapter.test.ts data/questWalkthroughs.wave1.test.ts data/questWalkthroughs.public.test.ts utils/questStrategies/coach.test.ts components/questStrategies/RuneProofCoach.test.tsx components/GoalPlannerModal.runeproof.test.tsx
npm run typecheck
```

Expected: all commands exit 0, including the existing Mill Lane, all-five public, coach, map, and Goal Planner regressions.

- [ ] **Step 7: Commit the adapter**

```bash
git add utils/questStrategies/model.ts utils/questStrategies/model.test.ts utils/questStrategies/legacyPackAdapter.ts utils/questStrategies/legacyPackAdapter.test.ts data/questWalkthroughs.public.ts data/questWalkthroughs.preview-boundary.ts
git commit -m "refactor: adapt public guides to RuneProof packs"
```

---

### Task 8: Separate Draft, Preview, Milestone, and Public Release Truth

**Files:**
- Create: `data/runeProofPackRelease.ts`
- Create: `data/runeProofPackRelease.test.ts`
- Create: `data/sources/runeproof-pack-releases.preview.json`
- Create: `data/sources/runeproof-pack-releases.public.json`
- Create: `data/runeProofPackRelease.preview.ts`
- Create: `data/runeProofPackRelease.public.ts`
- Create: `data/runeProofPacks.preview-boundary.ts`
- Create: `data/runeProofPacks.public.ts`
- Create: `data/runeProofPlatformReviewHarness.preview.ts`
- Create: `data/runeProofPlatformReviewHarness.public.ts`
- Modify: `scripts/sync-quest-walkthroughs.mjs`
- Modify: `scripts/quest-walkthrough-source.mjs`
- Modify: `scripts/quest-walkthrough-source.test.ts`
- Modify: `data/questWalkthroughLoader.ts`
- Create: `data/questWalkthroughLoader.test.ts`
- Modify: `vite.config.ts`
- Modify: `vite.config.runeproof-boundary.test.ts`
- Modify: `scripts/runeproof-public-bundle.test.ts`

**Interfaces:**
- Consumes: catalogue revision, compiled packs, the existing generated/reviewed walkthrough files, and `RuneProofAvailability`.
- Produces: explicit lifecycle manifests; `loadRuneProofCatalogue(availability)`; `loadRuneProofPackFor(availability, release)`; and `loadRuneProofPlatformReviewHarness(availability)`.

- [ ] **Step 1: Write failing lifecycle-manifest tests**

```ts
import { describe, expect, it } from 'vitest';
import { runeProofCatalogueRevision } from './runeProofQuestCatalogue';
import { publicRuneProofPackReleases } from './runeProofPackRelease.public';
import { validateRuneProofPackReleaseManifest } from './runeProofPackRelease';

const PUBLIC_IDS = [
  "Cook's Assistant",
  'Sheep Shearer',
  'The Restless Ghost',
  'Rune Mysteries',
  'Imp Catcher',
];

describe('RuneProof pack lifecycle', () => {
  it('contains exactly the five already-public exact revisions', () => {
    expect(publicRuneProofPackReleases.map(release => release.questId)).toEqual(PUBLIC_IDS);
    expect(publicRuneProofPackReleases.every(release =>
      release.lifecycle === 'PUBLIC_APPROVED')).toBe(true);
    expect(publicRuneProofPackReleases.every(release =>
      release.catalogueRevision === runeProofCatalogueRevision)).toBe(true);
  });

  it.each(['DRAFT', 'PREVIEW_VALIDATED', 'MILESTONE_APPROVED'] as const)(
    'does not admit %s into a public manifest',
    (lifecycle) => {
      expect(() => validateRuneProofPackReleaseManifest([{
        questId: 'Example',
        packRevision: 'revision',
        catalogueRevision: runeProofCatalogueRevision,
        lifecycle,
      }], {
        target: 'PUBLIC',
        catalogueRevision: runeProofCatalogueRevision,
        packRevisions: new Map([['Example', 'revision']]),
      })).toThrow(/PUBLIC requires PUBLIC_APPROVED/);
    },
  );

  it('invalidates approval when the exact pack revision changes', () => {
    expect(() => validateRuneProofPackReleaseManifest([{
      questId: 'Example',
      packRevision: 'old-revision',
      catalogueRevision: runeProofCatalogueRevision,
      lifecycle: 'PREVIEW_VALIDATED',
    }], {
      target: 'PREVIEW',
      catalogueRevision: runeProofCatalogueRevision,
      packRevisions: new Map([['Example', 'new-revision']]),
    })).toThrow(/does not match compiled pack revision/);
  });
});
```

- [ ] **Step 2: Run the release tests and confirm the missing module failure**

Run:

```bash
npx vitest run data/runeProofPackRelease.test.ts
```

Expected: FAIL because `./runeProofPackRelease` does not exist.

- [ ] **Step 3: Implement exact lifecycle validation**

```ts
export type RuneProofPackLifecycle =
  | 'DRAFT'
  | 'PREVIEW_VALIDATED'
  | 'MILESTONE_APPROVED'
  | 'PUBLIC_APPROVED';

export interface RuneProofPackRelease {
  readonly questId: string;
  readonly packRevision: string;
  readonly catalogueRevision: string;
  readonly lifecycle: RuneProofPackLifecycle;
}

export interface RuneProofPackHeader {
  readonly questId: string;
  readonly packRevision: string;
  readonly catalogueRevision: string;
}

export interface RuneProofReleaseValidationContext {
  readonly target: 'PREVIEW' | 'PUBLIC';
  readonly catalogueRevision: string;
  readonly packRevisions: ReadonlyMap<string, string>;
}
```

`validateRuneProofPackReleaseManifest` rejects extra fields, sparse arrays, duplicate IDs, blank revisions, catalogue mismatch, absent compiled packs, and stale pack revisions. `DRAFT` is absent from both compiled catalogues. Preview accepts `PREVIEW_VALIDATED`, `MILESTONE_APPROVED`, and `PUBLIC_APPROVED`; public accepts only `PUBLIC_APPROVED`. Lifecycle is never inferred from build mode, passing tests, milestone number, prior approval, merge status, or source freshness.

Populate the two JSON snapshots from exact existing revisions and make the TypeScript modules validate/freeze those snapshots:

- Public manifest: the same five IDs/revisions already in `data/questWalkthroughPublicRelease.ts`, all `PUBLIC_APPROVED`.
- Preview manifest: those same five exact releases. Do not add Daddy's Home, Doric's Quest, or Elemental Workshop I merely because draft walkthrough material exists; their current drafts have not compiled into approved generic packs.

- [ ] **Step 4: Write failing loader and public-boundary tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  loadRuneProofCatalogue,
  loadRuneProofPackFor,
  loadRuneProofPlatformReviewHarness,
} from './questWalkthroughLoader';
import { publicRuneProofPackReleases } from './runeProofPackRelease.public';

describe('RuneProof pack loaders', () => {
  it('shows 210 audit summaries without inventing lifecycle for absent packs', async () => {
    const summaries = await loadRuneProofCatalogue('PREVIEW');
    expect(summaries).toHaveLength(210);
    expect(summaries.filter(summary => summary.playable)).toHaveLength(5);
    const daddy = summaries.find(summary => summary.questId === "Daddy's Home");
    expect(daddy).toMatchObject({
      packDisposition: 'NO_PACK',
      reviewStatus: 'NO_PACK',
      proofState: 'NEEDS_REVIEW',
      playable: false,
    });
    expect(daddy?.lifecycle).toBeUndefined();
    expect(daddy?.packRevision).toBeUndefined();
  });

  it('keeps public loading to the five explicit approvals', async () => {
    const summaries = await loadRuneProofCatalogue('PUBLIC');
    expect(summaries.map(summary => summary.questId))
      .toEqual(publicRuneProofPackReleases.map(release => release.questId));
  });

  it('loads only the exact requested approved pack', async () => {
    const release = publicRuneProofPackReleases[0];
    const pack = await loadRuneProofPackFor('PUBLIC', release);
    expect(pack?.pack).toMatchObject({
      questId: release.questId,
      revision: release.packRevision,
    });
    expect(await loadRuneProofPackFor('PUBLIC', {
      ...release,
      packRevision: 'stale',
    })).toBeUndefined();
    expect(await loadRuneProofPackFor('PUBLIC', {
      ...release,
      catalogueRevision: 'stale-catalogue',
    })).toBeUndefined();
    expect(await loadRuneProofPackFor('PUBLIC', {
      ...release,
      lifecycle: 'MILESTONE_APPROVED',
    })).toBeUndefined();
  });

  it('exposes the synthetic review harness only in private preview', async () => {
    expect(await loadRuneProofPlatformReviewHarness('PUBLIC')).toBeUndefined();
    expect(await loadRuneProofPlatformReviewHarness('PREVIEW'))
      .toMatchObject({ marker: 'RUNEPROOF_PLATFORM_REVIEW_HARNESS_V1' });
  });
});
```

- [ ] **Step 5: Run loader tests and confirm missing exports**

Run:

```bash
npx vitest run data/questWalkthroughLoader.test.ts
```

Expected: FAIL because the three generic loader exports do not exist.

- [ ] **Step 6: Build one private aggregator and a same-shape public module**

```ts
export type RuneProofPackDisposition = 'NO_PACK' | 'REJECTED' | 'RELEASED';
export type RuneProofCatalogueReviewStatus =
  | RuneProofPackDisposition
  | RuneProofPackLifecycle;

export interface RuneProofCatalogueSummary extends RuneProofCatalogueEntry {
  readonly catalogueRevision: string;
  readonly packDisposition: RuneProofPackDisposition;
  readonly reviewStatus: RuneProofCatalogueReviewStatus;
  readonly lifecycle?: RuneProofPackLifecycle;
  readonly packRevision?: string;
  readonly preflight: RequirementExpression;
  readonly proofState: RuneProofProofState;
  readonly playable: boolean;
}

export interface RuneProofPlatformReviewHarness {
  readonly marker: 'RUNEPROOF_PLATFORM_REVIEW_HARNESS_V1';
  readonly scenarios: readonly RuneProofPlatformReviewScenario[];
}

export interface RuneProofPlatformReviewScenario {
  readonly id: 'READY' | 'CONFIRM' | 'BLOCKED' | 'NEEDS_REVIEW' | 'COMPLETE';
  readonly label: string;
  readonly pack: RuneProofCompiledPack;
  readonly snapshot: RuneProofRequirementSnapshot;
  readonly completedQuestIds: readonly string[];
}

export interface RuneProofLoadedPack {
  readonly pack: RuneProofCompiledPack;
  readonly legacyProjection?: Readonly<{
    walkthrough: QuestWalkthroughDefinition;
    strategy: QuestStrategyDefinition;
    reviewedRequirements: ReviewedQuestRequirements;
  }>;
}
```

`data/runeProofPacks.preview-boundary.ts`:

- Validate the preview manifest against action-free headers containing the five exact compiled revisions.
- Join all 210 catalogue entries to an exact release, a recorded compiler rejection, or a public-safe `NO_PACK / NEEDS_REVIEW / playable:false` summary. Lifecycle and pack revision are absent for `NO_PACK`; never infer `DRAFT` from missing content.
- Build each summary's preflight expression from canonical `QuestData` plus its public-safe catalogue requirement status.
- Export lookup functions; do not import or compile action payloads while returning summaries.
- Inside the selected-pack lookup, compare the entire supplied `RuneProofPackRelease`—quest ID, pack revision, catalogue revision, and lifecycle—to one exact manifest entry before importing any payload. The current compatibility import contains all five public definitions in one module; compile and return only the selected strategy, but describe this as a logical selected-pack compile rather than a byte-level one-pack import. Return its walkthrough, strategy, and full reviewed requirement record as the optional legacy analysis projection.
- Dynamically import `data/runeProofPlatformReviewHarness.preview.ts` only inside the dedicated harness loader. The marker-validated harness contains five review scenarios over reviewed synthetic compiled packs: `READY`, `CONFIRM`, `BLOCKED`, `NEEDS_REVIEW`, and `COMPLETE`. Across those scenarios it exercises two legal branches, recommendation/pinning/switch consequences, shared and inactive confirmations, exact blocker/unblock copy, a reviewed alternative, surface and instance entrance/plane locations, a temporary-map action, one subjective combat card, and a later combat card that must stay hidden until current. It is not in either release manifest and is not counted in 210 coverage.

`data/runeProofPacks.public.ts`:

- Validate only the public manifest against action-free exact-revision headers.
- Export summaries for exactly those five and the same lookup signatures.
- Compare all four supplied release fields to the public manifest, then use the same five-definition compatibility module and compile only the selected independently authored public strategy.
- Return `undefined` for the review harness.
- Import no preview manifest, raw source lines, review record, private pack, or harness.

Add loaders:

```ts
export const loadRuneProofCatalogue = async (
  availability: RuneProofAvailability,
): Promise<readonly RuneProofCatalogueSummary[]> => {
  if (availability === 'OFF') return [];
  const catalogue = availability === 'PUBLIC'
    ? await import('./runeProofPacks.public')
    : await import('./runeProofPacks.preview-boundary');
  return catalogue.runeProofCatalogueSummaries;
};

export const loadRuneProofPackFor = async (
  availability: RuneProofAvailability,
  release: RuneProofPackRelease,
): Promise<RuneProofLoadedPack | undefined> => {
  if (availability === 'OFF') return undefined;
  const catalogue = availability === 'PUBLIC'
    ? await import('./runeProofPacks.public')
    : await import('./runeProofPacks.preview-boundary');
  return catalogue.runeProofPackFor(release);
};

export const loadRuneProofPlatformReviewHarness = async (
  availability: RuneProofAvailability,
): Promise<RuneProofPlatformReviewHarness | undefined> => {
  if (availability !== 'PREVIEW') return undefined;
  const catalogue = await import('./runeProofPacks.preview-boundary');
  return catalogue.loadRuneProofPlatformReviewHarness();
};
```

Keep current `loadQuestWalkthroughFor`, `loadQuestStrategyFor`, and `loadQuestStrategyCatalogue` exports as tested compatibility functions until Goal Planner migration in Task 13.

- [ ] **Step 7: Generalize the source compiler without broadening trust**

In `scripts/sync-quest-walkthroughs.mjs`:

- Replace `DEFAULT_PATHS.membership` with the committed generic catalogue path.
- Replace `validateF2PMembership` with a strict reader of schema 1, catalogue revision, 210 unique IDs/slugs, and exact quest kind.
- Permit a source/review/candidate entry only when its ID and slug resolve in the generic catalogue.
- Refresh only explicitly requested quest IDs or IDs already present in the source snapshot; never fetch 210 guides implicitly.
- Keep `quest-walkthrough-candidate.json` generated suggestions separate from `quest-walkthrough-review.json` decisions.
- Keep source-line/entity/chunk suggestions untrusted until an independent review record names the exact source and decision.
- Remove `LEGACY_QUEST_ID` and hard-coded `allowedQuestIds`; catalogue membership is the identity boundary.
- Preserve deterministic offline `--check`.

Add a test that a generated candidate with high confidence and no matching review record is absent from `compileWalkthroughCatalogue(...).walkthroughs`, and a test that an unknown 211th ID is rejected.

- [ ] **Step 8: Extend the normal-build redirect and contamination tests**

```ts
const runeProofPreviewModuleRedirects = new Map([
  ['questWalkthroughs', 'questWalkthroughs.public'],
  ['questWalkthroughs.preview-boundary', 'questWalkthroughs.public'],
  ['runeProofPacks.preview-boundary', 'runeProofPacks.public'],
  ['runeProofPackRelease.preview', 'runeProofPackRelease.public'],
  ['runeProofPlatformReviewHarness.preview', 'runeProofPlatformReviewHarness.public'],
]);
```

Resolve every exact basename, with or without a TypeScript extension, to its public counterpart when `mode !== 'test' && mode !== 'runeproof-preview'`. Near matches remain untouched, and `VITE_RUNEPROOF_PREVIEW=1` cannot override production mode.

`data/runeProofPlatformReviewHarness.public.ts` exports the same loader signature and always returns `undefined`; it contains no marker, scenario, revision, source, or review text. Add a source-ownership test that fails when any runtime module other than `data/runeProofPacks.preview-boundary.ts` directly imports `runeProofPackRelease.preview` or `runeProofPlatformReviewHarness.preview`. The Vite resolver test must cover exact imports for all five redirects, with/without extensions, plus near-match non-redirects.

In `scripts/runeproof-public-bundle.test.ts`, derive exact revision markers from both manifests and the private harness, then assert:

- normal build contains all five public exact revisions;
- normal build does not contain the harness revision/marker or the preview QA marker;
- normal build does not contain the raw audit-note marker `The pinned Wiki item requirements for A Kingdom Divided were reviewed; inventory possession and pre-obtained supplies are not machine-enforced.`;
- preview build contains the harness revision/marker and preview QA marker;
- raw catalogue audit notes remain absent from both runtime builds because source reconciliation is offline-only;
- when a future preview manifest introduces a private pack revision, the test automatically requires that revision in preview and forbids it in normal;
- quest IDs alone are not contamination markers because public-safe `QuestData` already contains all 210.

- [ ] **Step 9: Run source, release, loader, and boundary gates**

Run:

```bash
npx vitest run scripts/quest-walkthrough-source.test.ts data/runeProofPackRelease.test.ts data/questWalkthroughLoader.test.ts vite.config.runeproof-boundary.test.ts scripts/runeproof-public-bundle.test.ts
npm run walkthroughs:verify
npm run build
npm run build:runeproof-preview
```

Expected: all commands exit 0; the normal bundle exposes only the five existing public payloads and contains none of the private markers.

- [ ] **Step 10: Commit explicit release isolation**

```bash
git add data/runeProofPackRelease.ts data/runeProofPackRelease.test.ts data/sources/runeproof-pack-releases.preview.json data/sources/runeproof-pack-releases.public.json data/runeProofPackRelease.preview.ts data/runeProofPackRelease.public.ts data/runeProofPacks.preview-boundary.ts data/runeProofPacks.public.ts data/runeProofPlatformReviewHarness.preview.ts data/runeProofPlatformReviewHarness.public.ts data/questWalkthroughLoader.ts data/questWalkthroughLoader.test.ts scripts/sync-quest-walkthroughs.mjs scripts/quest-walkthrough-source.mjs scripts/quest-walkthrough-source.test.ts vite.config.ts vite.config.runeproof-boundary.test.ts scripts/runeproof-public-bundle.test.ts
git commit -m "feat: isolate RuneProof pack lifecycles"
```

---

### Task 9: Migrate to Isolated V2 Progress Records and a Compact Index

**Files:**
- Create: `utils/questStrategies/progress.ts`
- Create: `utils/questStrategies/progress.test.ts`
- Create: `hooks/useRuneProofProgress.ts`
- Create: `hooks/useRuneProofProgress.test.tsx`
- Modify: `utils/questStrategies/previewActions.test.ts`
- Modify: `utils/questRoutes/previewChecks.test.ts`
- Modify: `hooks/useRuneProofPreviewActions.test.tsx`
- Modify: `hooks/useRuneProofPreviewChecks.test.tsx`

**Interfaces:**
- Consumes: `RuneProofStorage`, compiled packs, the two documented V1 storage-key formats, branch selection, and an injected clock.
- Produces: V2 key/read/write/migration functions and `useRuneProofProgress(runId, packs, selectedQuestId?, storage?)`.

- [ ] **Step 1: Write failing storage-key, normalization, and isolation tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  migrateRuneProofQuestProgressRevision,
  readRuneProofProgressIndex,
  readRuneProofQuestProgress,
  runeProofProgressIndexStorageKey,
  runeProofProgressStorageKey,
  writeRuneProofQuestProgress,
} from './progress';
import { branchingPack } from './testFixtures';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

describe('RuneProof V2 progress', () => {
  it('uses exact per-run/per-quest and per-run-index keys', () => {
    expect(runeProofProgressStorageKey('run-a', 'cooks-assistant'))
      .toBe('fate_runeproof_progress_v2:run-a:cooks-assistant');
    expect(runeProofProgressIndexStorageKey('run-a'))
      .toBe('fate_runeproof_progress_index_v2:run-a');
  });

  it('writes, rereads, and indexes only one quest record', () => {
    const storage = memoryStorage();
    const result = writeRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack: branchingPack,
      now: () => '2026-08-22T10:00:00.000Z',
      progress: {
        schemaVersion: 2,
        runId: 'run-a',
        questId: 'Example',
        packRevision: branchingPack.revision,
        selectedBranchId: 'local',
        confirmedActionIds: ['shared:start', 'local:step', 'remote:step'],
        confirmedItemKeys: [],
        manualConfirmationIds: [],
        confirmedCheckpointIds: [],
        updatedAt: '2026-08-22T10:00:00.000Z',
      },
    });
    expect(result).toBe(true);
    expect(readRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack: branchingPack,
    })?.confirmedActionIds).toEqual(['shared:start', 'local:step', 'remote:step']);
    expect(storage.values.has(runeProofProgressIndexStorageKey('run-b'))).toBe(false);
  });

  it('recomputes summary counts from only the selected active route', () => {
    const storage = memoryStorage();
    const base = {
      ...emptyProgressFor(branchingPack, 'run-a'),
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
    };
    expect(writeRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack: branchingPack,
      now: () => '2026-08-22T10:00:00.000Z',
      progress: base,
    })).toBe(true);
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries.example)
      .toMatchObject({ completedActionCount: 1, totalActionCount: 3, complete: false });

    expect(writeRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack: branchingPack,
      now: () => '2026-08-22T10:01:00.000Z',
      progress: { ...base, selectedBranchId: 'remote' },
    })).toBe(true);
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries.example)
      .toMatchObject({ completedActionCount: 0, totalActionCount: 3, complete: false });
  });

  it('does not complete a combat action from its target alone', () => {
    const pack = combatSummaryPack();
    const storage = memoryStorage();
    const targetOnly = {
      ...emptyProgressFor(pack, 'run-a'),
      selectedBranchId: 'main',
      confirmedActionIds: ['guardian:fight'],
    };
    expect(writeRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: 'combat-example',
      pack,
      now: () => '2026-08-22T10:00:00.000Z',
      progress: targetOnly,
    })).toBe(true);
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries['combat-example'])
      .toMatchObject({ completedActionCount: 0, totalActionCount: 1, complete: false });
    expect(writeRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: 'combat-example',
      pack,
      now: () => '2026-08-22T10:01:00.000Z',
      progress: {
        ...targetOnly,
        manualConfirmationIds: ['combat:guardian:ready'],
      },
    })).toBe(true);
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries['combat-example'])
      .toMatchObject({ completedActionCount: 1, totalActionCount: 1, complete: true });
  });

  it('isolates malformed and oversized data to one quest', () => {
    const storage = memoryStorage();
    storage.setItem(runeProofProgressStorageKey('run-a', 'broken'), '{bad json');
    storage.setItem(runeProofProgressStorageKey('run-a', 'oversized'), 'x'.repeat(65_537));
    expect(readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: 'broken', pack: branchingPack,
    })).toBeNull();
    expect(readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: 'oversized', pack: branchingPack,
    })).toBeNull();
  });

  it('does not advance the index after a failed write or failed reread', () => {
    const storage = memoryStorage();
    storage.setItem = vi.fn(() => { throw new Error('quota'); });
    const result = writeRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack: branchingPack,
      now: () => '2026-08-22T10:00:00.000Z',
      progress: emptyProgressFor(branchingPack, 'run-a'),
    });
    expect(result).toBe(false);
    expect(storage.values.has(runeProofProgressIndexStorageKey('run-a'))).toBe(false);
  });

  it('rolls the quest record back when the index write fails', () => {
    const storage = seededProgressStorage(branchingPack);
    const beforeRecord = storage.getItem(
      runeProofProgressStorageKey('run-a', 'example'),
    );
    const beforeIndex = storage.getItem(runeProofProgressIndexStorageKey('run-a'));
    storage.failNextIndexWrite();
    expect(writeRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack: branchingPack,
      now: () => '2026-08-22T10:00:00.000Z',
      progress: confirmedProgressFor(branchingPack, 'run-a', 'local:step'),
    })).toBe(false);
    expect(storage.getItem(runeProofProgressStorageKey('run-a', 'example')))
      .toBe(beforeRecord);
    expect(storage.getItem(runeProofProgressIndexStorageKey('run-a')))
      .toBe(beforeIndex);
  });

  it('keeps a worst-case 210-entry compact index within its cap', () => {
    const index = worstCaseProgressIndex(210);
    expect(canonicalProgressJson(index).length)
      .toBeLessThanOrEqual(RUNEPROOF_PROGRESS_INDEX_MAX_CHARS);
  });

  it('migrates every V2 proof namespace and updates the index atomically', () => {
    const storage = seededRevisionOneProgressStorage();
    const pack = packWithMigration(branchingPack, {
      id: 'example-v1-to-v2',
      fromRevision: 'pack-v1',
      actionIds: { 'old:action': 'local:step' },
      itemKeys: { 'old token': 'local token' },
      branchIds: { 'old-local': 'local' },
      manualConfirmationIds: { 'old:manual': 'local:manual' },
      checkpointIds: { 'old:checkpoint': 'local:checkpoint' },
    });
    const migrated = migrateRuneProofQuestProgressRevision({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack,
      now: () => '2026-08-22T10:00:00.000Z',
    });
    expect(migrated).toMatchObject({
      packRevision: pack.revision,
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
      confirmedItemKeys: ['local token'],
      manualConfirmationIds: ['local:manual'],
      confirmedCheckpointIds: ['local:checkpoint'],
    });
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries.example)
      .toMatchObject({ packRevision: pack.revision, selectedBranchId: 'local' });
  });

  it('leaves an old revision untouched without an exact migration', () => {
    const storage = seededRevisionOneProgressStorage();
    const beforeRecord = storage.getItem(runeProofProgressStorageKey('run-a', 'example'));
    const beforeIndex = storage.getItem(runeProofProgressIndexStorageKey('run-a'));
    expect(migrateRuneProofQuestProgressRevision({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack: packWithoutMigrations(branchingPack),
      now: () => '2026-08-22T10:00:00.000Z',
    })).toBeNull();
    expect(storage.getItem(runeProofProgressStorageKey('run-a', 'example')))
      .toBe(beforeRecord);
    expect(storage.getItem(runeProofProgressIndexStorageKey('run-a')))
      .toBe(beforeIndex);
  });

  it('rolls a revision migration back when its index update fails', () => {
    const { storage, pack } = seededMigratableProgressWithIndexFailure();
    const beforeRecord = storage.getItem(runeProofProgressStorageKey('run-a', 'example'));
    const beforeIndex = storage.getItem(runeProofProgressIndexStorageKey('run-a'));
    expect(migrateRuneProofQuestProgressRevision({
      storage,
      runId: 'run-a',
      questSlug: 'example',
      pack,
      now: () => '2026-08-22T10:00:00.000Z',
    })).toBeNull();
    expect(storage.getItem(runeProofProgressStorageKey('run-a', 'example')))
      .toBe(beforeRecord);
    expect(storage.getItem(runeProofProgressIndexStorageKey('run-a')))
      .toBe(beforeIndex);
  });
});
```

Define `emptyProgressFor` in the test as a complete V2 object with empty action, item, manual, and checkpoint confirmation arrays plus the injected timestamp. Define the revision fixtures as bounded raw JSON so the read path, explicit mapping, and transaction journal—not an already-normalized object—are exercised.

- [ ] **Step 2: Run progress tests and confirm the missing module failure**

Run:

```bash
npx vitest run utils/questStrategies/progress.test.ts
```

Expected: FAIL because `./progress` does not exist.

- [ ] **Step 3: Implement exact V2 records, index, and successful-write protocol**

```ts
export const RUNEPROOF_PROGRESS_MAX_CHARS = 65_536;
export const RUNEPROOF_PROGRESS_INDEX_MAX_CHARS = 65_536;
export const RUNEPROOF_PROGRESS_TRANSACTION_MAX_CHARS = 393_216;

export interface RuneProofQuestProgressV2 {
  readonly schemaVersion: 2;
  readonly runId: string;
  readonly questId: string;
  readonly packRevision: string;
  readonly selectedBranchId?: string;
  readonly confirmedActionIds: readonly string[];
  readonly confirmedItemKeys: readonly string[];
  readonly manualConfirmationIds: readonly string[];
  readonly confirmedCheckpointIds: readonly string[];
  readonly updatedAt: string;
}

export interface RuneProofProgressSummary {
  readonly questId: string;
  readonly packRevision: string;
  readonly selectedBranchId?: string;
  readonly completedActionCount: number;
  readonly totalActionCount: number;
  readonly complete: boolean;
  readonly updatedAt: string;
}

export interface RuneProofProgressIndexV2 {
  readonly schemaVersion: 2;
  readonly runId: string;
  readonly entries: Readonly<Record<string, RuneProofProgressSummary>>;
}

export interface RuneProofProgressIndexReadResult {
  readonly index: RuneProofProgressIndexV2;
  readonly warnings: readonly string[];
}

export function readRuneProofProgressIndex(
  storage: RuneProofStorage,
  runId: string,
): RuneProofProgressIndexReadResult;

export const runeProofProgressStorageKey = (
  runId: string,
  questSlug: string,
): string => `fate_runeproof_progress_v2:${runId}:${questSlug}`;

export const runeProofProgressIndexStorageKey = (
  runId: string,
): string => `fate_runeproof_progress_index_v2:${runId}`;

export const runeProofProgressTransactionStorageKey = (
  runId: string,
): string => `fate_runeproof_progress_tx_v2:${runId}`;
```

Normalization rules:

- Require exact keys, schema 2, exact run/quest/pack revision, valid ISO timestamp, and a valid selected branch.
- Keep only globally valid action IDs; item keys referenced by canonical roots, each root's exact `alternatives`, completion targets, or effects; manual confirmation IDs declared anywhere in pack/branch/action/alternative requirements (including canonical preflight), `MANUAL` action completions, or combat records; and declared branch checkpoint IDs. Migration validation uses those same complete proof-ID universes.
- Preserve confirmation order according to the pack's stable action/item/manual order; remove duplicates and sparse entries.
- On a revision change, `migrateRuneProofQuestProgressRevision` applies only one explicit migration whose `fromRevision` matches; for each action, item, branch, manual, and checkpoint ID, use its explicit map when present, otherwise retain the same ID only if it remains valid in the current accepted pack, and otherwise drop it. Normalize the result, then commit the migrated quest record and compact index through the same journaled write protocol. Never guess renamed semantic equivalence, and leave the old record/index untouched when no exact migration exists.
- Keep confirmations from every branch. Active/inactive projection is Task 5's responsibility.
- Reject a malformed or oversized record as `null` without deleting or rewriting another quest.

Write protocol:

1. Normalize and serialize the one quest record and next compact index; reject either normal cap before writing.
2. Capture the previous raw quest record and raw index.
3. Write and reread a bounded per-run transaction journal containing the quest slug plus those exact previous values; abort without mutation if journalling fails.
4. Write and reread the quest record through `readRuneProofQuestProgress`; compare canonical JSON.
5. Write and reread the compact index; compare canonical JSON.
6. Remove the transaction journal only after both records verify.
7. On any failure after Step 3, restore/remove both target keys to their captured values, reread both, and remove the journal only if rollback verifies.
8. If rollback itself fails, leave the journal. `readRuneProofProgressIndex` resolves a journal before returning: it restores the captured pair, verifies them, appends a stable recoverable warning to its explicit `{ index, warnings }` result, then removes the journal. This recovery path may read one quest record; the ordinary path remains one index read and zero quest-record reads. The hook copies those warnings directly into `RuneProofProgressControls.warnings`.
9. Return `false` on any storage/parse/verification/index failure; never throw into Goal Planner or commit hook UI state.

The index map key is already the quest slug, so `RuneProofProgressSummary` does not repeat it. Test a synthetically worst-case 210-entry index against the 65,536-character cap.

Export `selectRuneProofManualObligations(expression, confirmedIds)`, returning `{ satisfied, requirements }`, and reuse it in persistence and coaching. A manual atom returns itself and is satisfied only when confirmed; a non-manual expression has no manual obligation; `ALL` unions each child's selected requirements and requires all manual-bearing children; a manual-bearing `ANY` chooses the first source-order satisfied child, otherwise its first child. Task 6 guarantees that every manual-bearing `ANY` is manual-only recursively, so this progress-only selection cannot disagree with deterministic evaluator readiness. Thus a losing manual choice never leaks, while an already-confirmed non-first choice remains visible and can be unchecked. Stable-deduplicate identical declarations and rely on compiler conflict rejection.

Export `isRuneProofActionComplete(action, progress)` and use it for the index, coach, first-incomplete selection, and confirmed-item replay. It returns true only when the action's declared action/item/manual/checkpoint completion target is satisfied in the corresponding progress array, `selectRuneProofManualObligations(action.requirements, progress.manualConfirmationIds).satisfied` is true, and every combat record attached to that action has its separate `confirmationId` in `manualConfirmationIds`. A target confirmation can remain stored while a selected action manual gate or combat readiness is unconfirmed, but it cannot advance the route, apply item effects, hide its required control, increment the summary, or make the route complete.

Also export `isRuneProofRouteComplete(pack, branch, progress)`. It requires a nonempty active route, composite completion of every shared/branch action, and satisfied selected manual obligations for pack preflight and the selected branch requirements. It is the only proof-based isolated completion predicate. Observed canonical quest completion is handled separately by the coach and may override these planning acknowledgements; merely checking every action target may not. Add regressions for `ANY([manual A, manual B])` completing when either A or B alone is confirmed; the compiler regression in Task 6 proves a blocked deterministic child plus manual fallback cannot enter this progress-only contract.

Build each `RuneProofProgressSummary` with those same predicates. Resolve the active route from a valid explicit selected branch, otherwise a uniquely owned branch-specific proof, otherwise the pack's sole branch; for an empty ambiguous multi-branch record, report `completedActionCount:0`, `totalActionCount:0`, and `complete:false`. For the resolved route, total the ordered shared + branch actions once and count only compositely complete actions. Inactive-branch proof never contributes. Set `complete` from `isRuneProofRouteComplete`, so unconfirmed pack/branch manual gates keep it false even when every action target is stored. Branch switching recomputes the index summary in the same journaled transaction as the quest record. Define `combatSummaryPack` locally as a compiled one-action fixture whose `ACTION` target is `guardian:fight` and whose distinct subjective combat confirmation is `combat:guardian:ready`.

- [ ] **Step 4: Write failing V1 migration tests**

```ts
import {
  migrateRuneProofProgressV1,
  runeProofProgressStorageKey,
} from './progress';
import { runeProofPreviewActionStorageKey } from './previewActions';
import { runeProofPreviewStorageKey } from '../questRoutes/previewChecks';

it('migrates V1 once, filters unknown IDs, and leaves both old records untouched', () => {
  const storage = memoryStorage();
  const oldActions = JSON.stringify({
    Example: ['shared:start', 'local:step', 'unknown:action'],
    Unknown: ['unknown'],
  });
  const oldItems = JSON.stringify({
    Example: ['valid item', 'unknown item'],
  });
  storage.setItem(runeProofPreviewActionStorageKey('run-a'), oldActions);
  storage.setItem(runeProofPreviewStorageKey('run-a'), oldItems);

  const first = migrateRuneProofProgressV1({
    storage,
    runId: 'run-a',
    packs: [branchingPack],
    questSlugs: new Map([['Example', 'example']]),
    now: () => '2026-08-22T10:00:00.000Z',
  });
  const second = migrateRuneProofProgressV1({
    storage,
    runId: 'run-a',
    packs: [branchingPack],
    questSlugs: new Map([['Example', 'example']]),
    now: () => '2026-08-22T11:00:00.000Z',
  });

  expect(first).toEqual({ migratedQuestIds: ['Example'], failedQuestIds: [] });
  expect(second).toEqual({ migratedQuestIds: [], failedQuestIds: [] });
  expect(storage.getItem(runeProofPreviewActionStorageKey('run-a'))).toBe(oldActions);
  expect(storage.getItem(runeProofPreviewStorageKey('run-a'))).toBe(oldItems);
  expect(storage.getItem(runeProofProgressStorageKey('run-a', 'example'))).not.toBeNull();
});

it('never applies revision-specific rename maps to revisionless V1 data', () => {
  const pack = packWithAmbiguousHistoricalActionMaps();
  const storage = storageWithV1Actions({ Example: ['renamed:legacy-action'] });
  const result = migrateRuneProofProgressV1({
    storage,
    runId: 'run-a',
    packs: [pack],
    questSlugs: new Map([['Example', 'example']]),
    now: () => '2026-08-22T10:00:00.000Z',
  });
  expect(result).toEqual({ migratedQuestIds: ['Example'], failedQuestIds: [] });
  expect(readRuneProofQuestProgress({
    storage, runId: 'run-a', questSlug: 'example', pack,
  })?.confirmedActionIds).toEqual([]);
});
```

- [ ] **Step 5: Implement idempotent V1 migration**

```ts
export interface RuneProofProgressMigrationResult {
  readonly migratedQuestIds: readonly string[];
  readonly failedQuestIds: readonly string[];
}
```

Read the two V1 catalogue-wide records once with a new bounded compatibility parser in `progress.ts`; do not call `readRuneProofPreviewItems` or `readRuneProofPreviewActions`, because those helpers intentionally filter through the old eight-entry requirement/strategy catalogues and cannot migrate a generic pack. The raw parser accepts only a dense plain-object map of exact quest IDs to dense arrays of nonblank strings, rejects extra nesting and values over 65,536 characters, and treats a malformed action or item record independently. For each known compiled pack with matching V1 data:

- Skip it if a valid V2 record already exists.
- V1 carries no source pack revision, so never apply any revision-specific migration map. Retain an action or item ID only when that exact ID is valid in the target pack; otherwise drop it. This remains deterministic even when the target pack has multiple `fromRevision` maps that rename the same historical ID differently.
- Create no selected branch unless one can be derived unambiguously from one branch's specific actions.
- Write and reread that quest independently using the Step 3 protocol.
- Add only that quest to `failedQuestIds` on error and continue.
- Never remove or mutate either V1 storage key in Milestone 1.

Keep the existing V1 helper suites unchanged as compatibility regressions. The synthetic `Example` migration test proves the new raw parser is catalogue-independent; add a malformed-one-key test proving a broken V1 action record does not prevent a valid V1 item record for another pack from migrating.

- [ ] **Step 6: Write failing hook scope and lazy-hydration tests**

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRuneProofProgress } from './useRuneProofProgress';

it('reads the index once and hydrates only the selected quest record', async () => {
  const storage = instrumentedStorage();
  const { result, rerender } = renderHook(
    ({ selected }) => useRuneProofProgress(
      'run-a', [localPack, remotePack], selected, storage,
    ),
    { initialProps: { selected: undefined as string | undefined } },
  );
  await waitFor(() => expect(result.current.isIndexHydrated).toBe(true));
  expect(storage.questRecordReads()).toBe(0);

  rerender({ selected: localPack.questId });
  await waitFor(() => expect(result.current.selectedQuestId).toBe(localPack.questId));
  expect(storage.readsForSlug(localPack.catalogue.slug)).toBe(1);
  expect(storage.readsForSlug(remotePack.catalogue.slug)).toBe(0);
});

it('keeps run transitions and failed writes isolated', async () => {
  const storage = throwingWriteStorage();
  const { result, rerender } = renderHook(
    ({ runId }) => useRuneProofProgress(runId, [localPack], localPack.questId, storage),
    { initialProps: { runId: 'run-a' } },
  );
  await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
  act(() => result.current.setActionConfirmed('local:step', true));
  expect(result.current.selectedProgress?.confirmedActionIds).toEqual([]);
  rerender({ runId: 'run-b' });
  await waitFor(() => expect(result.current.runId).toBe('run-b'));
  expect(result.current.selectedProgress?.confirmedActionIds).toEqual([]);
});

it('pins and reloads after the first branch-specific non-action proof', async () => {
  const storage = instrumentedStorage();
  const first = renderHook(() => useRuneProofProgress(
    'run-a', [branchingPack], branchingPack.questId, storage,
  ));
  await waitFor(() => expect(first.result.current.isSelectedHydrated).toBe(true));
  act(() => first.result.current.setManualConfirmed('local:manual', true));
  expect(first.result.current.selectedProgress).toMatchObject({
    selectedBranchId: 'local',
    manualConfirmationIds: ['local:manual'],
  });
  first.unmount();

  const second = renderHook(() => useRuneProofProgress(
    'run-a', [branchingPack], branchingPack.questId, storage,
  ));
  await waitFor(() => expect(second.result.current.selectedProgress)
    .toMatchObject({ selectedBranchId: 'local' }));
});

it('migrates an old V2 revision before considering V1 fallback', async () => {
  const storage = storageWithOldV2AndConflictingV1();
  const currentPack = currentPackWithExactRevisionMigration();
  const { result } = renderHook(() => useRuneProofProgress(
    'run-a', [currentPack], currentPack.questId, storage,
  ));
  await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
  expect(result.current.selectedProgress).toMatchObject({
    packRevision: currentPack.revision,
    confirmedActionIds: ['current:action'],
  });
  expect(result.current.selectedProgress?.confirmedActionIds)
    .not.toContain('v1:conflicting-action');
  expect(result.current.index.entries[currentPack.catalogue.slug].packRevision)
    .toBe(currentPack.revision);
});
```

Define `instrumentedStorage`, `throwingWriteStorage`, `localPack`, and `remotePack` as complete deterministic fixtures in the test file.

- [ ] **Step 7: Implement the V2 hook controls**

```ts
export interface RuneProofProgressControls {
  readonly runId: string;
  readonly index: RuneProofProgressIndexV2;
  readonly isIndexHydrated: boolean;
  readonly selectedQuestId?: string;
  readonly selectedProgress?: RuneProofQuestProgressV2;
  readonly isSelectedHydrated: boolean;
  readonly warnings: readonly string[];
  summaryFor(questId: string): RuneProofProgressSummary | undefined;
  setActionConfirmed(actionId: string, confirmed: boolean): void;
  setItemConfirmed(itemKey: string, confirmed: boolean): void;
  setManualConfirmed(confirmationId: string, confirmed: boolean): void;
  setCheckpointConfirmed(checkpointId: string, confirmed: boolean): void;
  selectBranch(
    branchId: string,
    evaluations: Readonly<Record<string, RuneProofBranchEvaluation>>,
  ): void;
}

export function useRuneProofProgress(
  runId: string,
  packs: readonly RuneProofCompiledPack[],
  selectedQuestId?: string,
  storage?: RuneProofStorage,
): RuneProofProgressControls;
```

The hook:

- Reads the V2 index once per `runId` and hydrates only the selected pack record. For that selected slug, first use an internal bounded structural V2 reader that validates schema, exact run/quest identity, dense namespaces, timestamp, size cap, and a nonblank source `packRevision`, but deliberately does not require the current pack revision. If the structurally valid record already matches, normalize it through the public exact-current reader. If its revision differs, call `migrateRuneProofQuestProgressRevision`, then hydrate the migrated exact-current record and index. If no exact `fromRevision` migration exists or migration fails, preserve the old raw record, expose no fabricated empty progress, and surface a warning.
- Only when no structurally valid V2 record exists for that slug may the hook attempt V1 migration for a newly available exact pack. A malformed current-key V2 record is reported and never silently replaced from V1. This selected-only order prevents revisionless V1 data from overriding known V2 provenance and never rereads unrelated quest records.
- Uses functional state updates and commits UI state only after `writeRuneProofQuestProgress` returns `true`.
- After every action/item/manual/checkpoint setter, derive which action completion target became satisfied across all four proof namespaces. Automatically pin only when the first new satisfied branch-specific action has one unambiguous branch owner; persist the branch and proof in the same journaled write so reload cannot separate them.
- Delegates explicit switching to `withSelectedRuneProofBranch` with the same branch evaluations rendered by the coach; a missing or `NEEDS_REVIEW` evaluation is rejected without a write.
- Surfaces a stable recoverable warning when transaction-journal recovery was required; it never silently reports a failed confirmation as committed.
- Never imports or calls GameContext dispatch, canonical save, export, relay, history, integrity, reward, Key, or Fate functions.

- [ ] **Step 8: Run old and new persistence suites**

Run:

```bash
npx vitest run utils/questStrategies/progress.test.ts hooks/useRuneProofProgress.test.tsx utils/questStrategies/previewActions.test.ts utils/questRoutes/previewChecks.test.ts hooks/useRuneProofPreviewActions.test.tsx hooks/useRuneProofPreviewChecks.test.tsx
npm run typecheck
```

Expected: all commands exit 0, preserving old corruption, remount, run-switch, unknown-ID, and failed-write regressions.

- [ ] **Step 9: Commit V2 progress**

```bash
git add utils/questStrategies/progress.ts utils/questStrategies/progress.test.ts hooks/useRuneProofProgress.ts hooks/useRuneProofProgress.test.tsx utils/questStrategies/previewActions.test.ts utils/questRoutes/previewChecks.test.ts hooks/useRuneProofPreviewActions.test.tsx hooks/useRuneProofPreviewChecks.test.tsx
git commit -m "feat: isolate RuneProof progress per quest"
```

---

### Task 10: Rank 210 Objectives from Headers Without Deep Analysis

**Files:**
- Modify: `utils/questStrategies/objectives.ts`
- Modify: `utils/questStrategies/objectives.test.ts`

**Interfaces:**
- Consumes: `RuneProofCatalogueSummary`, `RuneProofRequirementSnapshot`, `RuneProofProgressIndexV2`, and Task 3 evaluator.
- Produces: `preflightRuneProofObjectives(input): RuneProofObjectivePreflightResult` and the existing `rankRuneProofObjectives(candidates, limit?)` with a five-state candidate contract.

- [ ] **Step 1: Replace full-strategy fixtures with a failing 210-header test**

```ts
import { describe, expect, it } from 'vitest';
import {
  preflightRuneProofObjectives,
  rankRuneProofObjectives,
} from './objectives';
import {
  candidate,
  catalogueSummary,
  makeCatalogueSummaries,
  progressSummary,
  readyRequirementSnapshot,
} from './testFixtures';

describe('RuneProof objective preflight', () => {
  it('evaluates 210 lightweight headers and no action graph', () => {
    const summaries = makeCatalogueSummaries(210, {
      noPackQuestIds: new Set(['Quest 210']),
    });
    const result = preflightRuneProofObjectives({
      summaries,
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {},
      },
    });
    expect(result.candidates).toHaveLength(210);
    expect(result.metrics).toEqual({
      headerEvaluations: 210,
      progressIndexLookups: 210,
      packLoads: 0,
      deepAnalyses: 0,
    });
    expect(result.candidates.at(-1)?.proofState).toBe('NEEDS_REVIEW');
  });

  it('returns at most three playable recommendations in the exact sort order', () => {
    const recommendations = rankRuneProofObjectives([
      candidate('ready-late', 'READY', 2, 20, 0, 10),
      candidate('confirm', 'CONFIRM', 1, 10, 5, 10),
      candidate('blocked', 'BLOCKED', 1, 8, 9, 10),
      candidate('ready-progress', 'READY', 1, 9, 7, 10),
      candidate('ready-empty', 'READY', 1, 9, 0, 10),
      candidate('review', 'NEEDS_REVIEW', 1, 1, 0, 10),
      candidate('complete', 'COMPLETE', 1, 1, 10, 10),
    ]);
    expect(recommendations.map(value => value.questId)).toEqual([
      'ready-progress',
      'ready-empty',
      'ready-late',
    ]);
    expect(recommendations).toHaveLength(3);
  });

  it('ignores stale progress summaries from another pack revision', () => {
    const summary = catalogueSummary({
      questId: 'Revised quest',
      packRevision: 'pack-v2',
      packDisposition: 'RELEASED',
      lifecycle: 'PREVIEW_VALIDATED',
      playable: true,
    });
    const result = preflightRuneProofObjectives({
      summaries: [summary],
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {
          'revised-quest': progressSummary({
            questId: 'Revised quest',
            packRevision: 'pack-v1',
            complete: true,
          }),
        },
      },
    });
    expect(result.candidates[0].proofState).not.toBe('COMPLETE');
    expect(result.candidates[0].progress).toEqual({ completed: 0, total: 0 });
  });
});
```

Before running this test, add all five imported helpers to `testFixtures.ts`: `candidate` returns a complete objective candidate; `catalogueSummary` returns one exact action-free summary; `makeCatalogueSummaries` returns the requested number of complete action-free summaries; `progressSummary` returns a complete compact-index row; and `readyRequirementSnapshot` returns the complete canonical Task 3 snapshot with deterministic gates ready and optional field overrides. No action-free fixture may contain an `actions` property. Task 11 reuses the same exported snapshot helper rather than introducing a test-local duplicate.

- [ ] **Step 2: Run the objective tests and confirm type/behavior failures**

Run:

```bash
npx vitest run utils/questStrategies/objectives.test.ts
```

Expected: FAIL because candidates still require `QuestStrategyDefinition`, `NEEDS_REVIEW` and `COMPLETE` are not accepted, and `preflightRuneProofObjectives` does not exist.

- [ ] **Step 3: Implement the action-free candidate contract**

```ts
export type RuneProofObjectiveReadiness = RuneProofProofState;

export interface RuneProofObjectiveCandidate {
  readonly questId: string;
  readonly milestone: 1 | 2 | 3 | 4 | 5;
  readonly progressionPriority: number;
  readonly proofState: RuneProofObjectiveReadiness;
  readonly progress: Readonly<{ completed: number; total: number }>;
  readonly actionable: boolean;
  readonly blockerReason?: string;
  readonly unblockAction?: string;
}

export interface RuneProofObjectiveRecommendation {
  readonly questId: string;
  readonly reason: string;
  readonly progress: RuneProofObjectiveCandidate['progress'];
  readonly readiness: Exclude<RuneProofObjectiveReadiness, 'NEEDS_REVIEW' | 'COMPLETE'>;
}

export interface RuneProofPreflightMetrics {
  readonly headerEvaluations: number;
  readonly progressIndexLookups: number;
  readonly packLoads: 0;
  readonly deepAnalyses: 0;
}

export interface RuneProofObjectivePreflightResult {
  readonly candidates: readonly RuneProofObjectiveCandidate[];
  readonly metrics: RuneProofPreflightMetrics;
}
```

`preflightRuneProofObjectives` loops summaries exactly once:

1. Look up the slug once in the compact index. Use it only when its quest ID and pack revision exactly match the summary; stale entries contribute neither completion nor progress and wait for Task 9's explicit migration.
2. Project `COMPLETE` for canonical completion or a complete isolated guide summary.
3. Project `NEEDS_REVIEW` when `packDisposition !== 'RELEASED'`, the exact lifecycle/summary is not playable, or canonical evidence status is unresolved.
4. Otherwise call `evaluateRequirementExpression(summary.preflight, snapshot)`.
5. Copy only progress counts from the index; never read a V2 quest record.
6. Copy the first blocker reason and first concrete unblock action; mark `BLOCKED` actionable only when both are present.
7. Return frozen candidates and exact operation counters.

- [ ] **Step 4: Implement exact recommendation ordering and reasons**

```ts
const readinessRank = (
  readiness: RuneProofObjectiveRecommendation['readiness'],
): number => readiness === 'READY' ? 0 : readiness === 'CONFIRM' ? 1 : 2;

const retainedProgressRatio = (
  progress: RuneProofObjectiveCandidate['progress'],
): number => progress.total === 0 ? 0 : progress.completed / progress.total;

export function rankRuneProofObjectives(
  candidates: readonly RuneProofObjectiveCandidate[],
  limit = 3,
): readonly RuneProofObjectiveRecommendation[] {
  return candidates
    .filter((candidate): candidate is RuneProofObjectiveCandidate & {
      proofState: 'READY' | 'CONFIRM' | 'BLOCKED';
    } => candidate.proofState !== 'COMPLETE'
      && candidate.proofState !== 'NEEDS_REVIEW'
      && (candidate.proofState !== 'BLOCKED' || candidate.actionable))
    .slice()
    .sort((left, right) =>
      readinessRank(left.proofState) - readinessRank(right.proofState)
      || left.milestone - right.milestone
      || left.progressionPriority - right.progressionPriority
      || retainedProgressRatio(right.progress) - retainedProgressRatio(left.progress)
      || right.progress.completed - left.progress.completed
      || compareQuestIds(left.questId, right.questId))
    .slice(0, Math.max(0, Math.min(3, Math.floor(limit))))
    .map(toRecommendation);
}
```

`toRecommendation` returns:

- READY: `Ready with your current unlocks.`
- CONFIRM: `Deterministic gates pass; confirm the reviewed manual requirement.`
- BLOCKED: the exact first reviewed blocker plus its first unblock action.

Never produce a playable recommendation for `NEEDS_REVIEW` or `COMPLETE`.

- [ ] **Step 5: Run objective and type gates**

Run:

```bash
npx vitest run utils/questStrategies/objectives.test.ts
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit bounded ranking**

```bash
git add utils/questStrategies/objectives.ts utils/questStrategies/objectives.test.ts utils/questStrategies/testFixtures.ts
git commit -m "feat: preflight RuneProof objectives from headers"
```

---

### Task 11: Project Branch-Aware Coach and Combat Readiness Models

**Files:**
- Modify: `utils/questStrategies/coach.ts`
- Modify: `utils/questStrategies/coach.test.ts`
- Modify: `utils/questStrategies/testFixtures.ts`

**Interfaces:**
- Consumes: compiled pack, requirement snapshot, V2 progress, branch engine, optional selected-route legacy analysis, and canonical completions.
- Produces: branch-aware `buildRuneProofPackCoachModel(input): RuneProofPackCoachModel` while retaining the existing `buildRuneProofCoachModel(input): RuneProofCoachModel` compatibility surface and exporting it as `buildLegacyRuneProofCoachModel`.

- [ ] **Step 1: Add failing branch, proof-state, and combat tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildRuneProofPackCoachModel } from './coach';
import type { RuneProofCompiledPack } from './packModel';
import {
  acquiredItemPack,
  branchNeedsReviewPack,
  branchingPack,
  combatPack,
  emptyProgressFor,
  everyBranchNeedsReviewPack,
  fullyConfirmedProgress,
  initialItemPack,
  itemQuantityPack,
  manualAnyPack,
  manualGatePack,
  readyRequirementSnapshot,
  spentItemPack,
} from './testFixtures';

describe('branch-aware RuneProof coach', () => {
  it('selects the recommended branch and exactly one current action', () => {
    const model = buildRuneProofPackCoachModel({
      pack: branchingPack,
      progress: emptyProgressFor(branchingPack, 'run-a'),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model.branch).toMatchObject({
      selectedBranchId: 'local',
      recommendedBranchId: 'local',
      pinned: false,
    });
    expect(model.actions.filter(action => action.current)).toHaveLength(1);
    expect(model.doNow?.id).toBe(model.actions.find(action => action.current)?.id);
  });

  it('keeps incompatible branch confirmation stored but inactive', () => {
    const model = buildRuneProofPackCoachModel({
      pack: branchingPack,
      progress: {
        ...emptyProgressFor(branchingPack, 'run-a'),
        selectedBranchId: 'remote',
        confirmedActionIds: ['shared:start', 'local:step', 'remote:step'],
      },
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model.branch.selectedBranchId).toBe('remote');
    expect(model.progress.inactiveConfirmations.actionIds).toEqual(['local:step']);
    expect(model.progress.activeConfirmations.actionIds)
      .toEqual(['shared:start', 'remote:step']);
  });

  it('keeps pack and current-action gates in the selected coach', () => {
    const pack: any = structuredClone(branchingPack);
    pack.preflight = {
      kind: 'SKILL_LEVEL',
      id: 'skill:mining:99',
      skill: 'Mining',
      level: 99,
      evidenceIds: ['quest-data:Example'],
    };
    const model = buildRuneProofPackCoachModel({
      pack,
      progress: emptyProgressFor(pack, 'run-a'),
      requirementSnapshot: readyRequirementSnapshot({ levels: { Mining: 1 } }),
      completedQuestIds: new Set(),
    });
    expect(model.proofState).toBe('BLOCKED');
    expect(model.doNow?.blockerText).toMatch(/Mining 99/);
    expect(model.doNow?.unblockActions).toContain('Raise Mining to 99.');
  });

  it('proves only the exact reviewed quantity for a confirmed root item', () => {
    const oneCoin = itemQuantityPack({ reviewedQuantity: 1, requiredQuantity: 2 });
    const twoCoins = itemQuantityPack({ reviewedQuantity: 2, requiredQuantity: 2 });
    const progressFor = (pack: RuneProofCompiledPack) => ({
      ...emptyProgressFor(pack, 'run-a'),
      confirmedItemKeys: ['coins'],
    });
    expect(buildRuneProofPackCoachModel({
      pack: oneCoin,
      progress: progressFor(oneCoin),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    }).proofState).toBe('BLOCKED');
    expect(buildRuneProofPackCoachModel({
      pack: twoCoins,
      progress: progressFor(twoCoins),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    }).proofState).toBe('CONFIRM');
  });

  it('projects canonical and alternative root-item proof without double counting', () => {
    const pack = initialItemPack({
      canonicalItemKey: 'bucket of milk',
      alternativeItemKey: 'milk substitute',
      reviewedQuantity: 2,
    });
    const empty = buildRuneProofPackCoachModel({
      pack,
      progress: emptyProgressFor(pack, 'run-a'),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(empty.initialItems[0]).toMatchObject({
      canonicalItemKey: 'bucket of milk',
      quantity: 2,
    });
    expect(empty.initialItems[0].options.map(option => option.itemKey))
      .toEqual(['bucket of milk', 'milk substitute']);

    const alternative = buildRuneProofPackCoachModel({
      pack,
      progress: {
        ...emptyProgressFor(pack, 'run-a'),
        confirmedItemKeys: ['milk substitute'],
      },
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(alternative.initialItems[0].options)
      .toContainEqual(expect.objectContaining({ itemKey: 'milk substitute', confirmed: true }));
    expect(alternative.doNow?.blockerText).toBeUndefined();

    const both = buildRuneProofPackCoachModel({
      pack,
      progress: {
        ...emptyProgressFor(pack, 'run-a'),
        confirmedItemKeys: ['bucket of milk', 'milk substitute'],
      },
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(both.doNow?.blockerText).toBeUndefined();
    expect(both.initialItems[0].provenQuantity).toBe(2);
  });

  it.each(['PREFLIGHT', 'ACTION'] as const)(
    'keeps a %s manual requirement actionable and prevents target-only completion',
    (scope) => {
      const pack = manualGatePack(scope);
      const targetOnly = buildRuneProofPackCoachModel({
        pack,
        progress: {
          ...emptyProgressFor(pack, 'run-a'),
          confirmedActionIds: ['manual-gate:action'],
        },
        requirementSnapshot: readyRequirementSnapshot(),
        completedQuestIds: new Set(),
      });
      expect(targetOnly.proofState).toBe('CONFIRM');
      expect(targetOnly.manualConfirmations).toContainEqual(expect.objectContaining({
        id: `manual:${scope.toLowerCase()}`,
        confirmed: false,
      }));
      expect(targetOnly.proofState).not.toBe('COMPLETE');
      if (scope === 'PREFLIGHT') {
        expect(targetOnly.doNow).toBeUndefined();
        expect(targetOnly.actions.every(action => action.current === false)).toBe(true);
      }
    },
  );

  it('does not project a losing manual choice from ANY', () => {
    const pack = manualAnyPack();
    const model = buildRuneProofPackCoachModel({
      pack,
      progress: {
        ...fullyConfirmedProgress(pack, 'main'),
        manualConfirmationIds: ['manual:first'],
      },
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model.manualConfirmations).toEqual([
      expect.objectContaining({ id: 'manual:first', confirmed: true }),
    ]);
    expect(model.proofState).toBe('COMPLETE');
  });

  it('selects an already-confirmed manual alternative from ANY', () => {
    const pack = manualAnyPack();
    const model = buildRuneProofPackCoachModel({
      pack,
      progress: {
        ...fullyConfirmedProgress(pack, 'main'),
        manualConfirmationIds: ['manual:second'],
      },
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model.manualConfirmations).toEqual([
      expect.objectContaining({ id: 'manual:second', confirmed: true }),
    ]);
    expect(model.proofState).toBe('COMPLETE');
  });

  it.each(['CONSUME', 'RETURN'] as const)(
    'does not use a %s item to satisfy a later gate',
    (effectKind) => {
      const pack = spentItemPack(effectKind);
      const model = buildRuneProofPackCoachModel({
        pack,
        progress: {
          ...emptyProgressFor(pack, 'run-a'),
          confirmedItemKeys: ['quest token'],
          confirmedCheckpointIds: ['payment-complete'],
        },
        requirementSnapshot: readyRequirementSnapshot(),
        completedQuestIds: new Set(),
      });
      expect(model.doNow?.id).toBe('example:needs-token-again');
      expect(model.proofState).toBe('BLOCKED');
      expect(model.doNow?.blockerText).toMatch(/quest token/i);
    },
  );

  it('replays effects for an item-confirmed action before the next gate', () => {
    const pack = acquiredItemPack();
    const model = buildRuneProofPackCoachModel({
      pack,
      progress: {
        ...emptyProgressFor(pack, 'run-a'),
        confirmedItemKeys: ['quest token'],
      },
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model.doNow?.id).toBe('example:use-acquired-token');
    expect(model.proofState).toBe('CONFIRM');
    expect(model.doNow?.blockerText).toBeUndefined();
  });

  it('projects no current action when every branch needs review', () => {
    const pack = everyBranchNeedsReviewPack();
    const model = buildRuneProofPackCoachModel({
      pack,
      progress: emptyProgressFor(pack, 'run-a'),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model).toMatchObject({
      proofState: 'NEEDS_REVIEW',
      doNow: undefined,
      branch: {
        selectedBranchId: undefined,
        recommendedBranchId: undefined,
      },
    });
  });

  it('keeps a pinned route visible but suppresses play when its evidence regresses', () => {
    const pack = branchNeedsReviewPack(branchingPack, 'local');
    const model = buildRuneProofPackCoachModel({
      pack,
      progress: {
        ...emptyProgressFor(pack, 'run-a'),
        selectedBranchId: 'local',
      },
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model).toMatchObject({
      proofState: 'NEEDS_REVIEW',
      doNow: undefined,
      branch: { selectedBranchId: 'local', pinned: true },
    });
    expect(model.actions.every(action => action.current === false)).toBe(true);
  });

  it('uses CONFIRM for subjective combat and never says impossible', () => {
    const model = buildRuneProofPackCoachModel({
      pack: combatPack,
      progress: emptyProgressFor(combatPack, 'run-a'),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model.proofState).toBe('CONFIRM');
    expect(model.currentCombatCards).toHaveLength(1);
    expect(JSON.stringify(model).toLowerCase()).not.toContain('impossible');
    expect(model.currentCombatCards[0]).toMatchObject({
      confirmed: false,
      confirmationId: 'combat:guardian:ready',
    });
  });

  it('keeps combat current when its action target is confirmed without readiness', () => {
    const fightActionId = combatPack.branches[0].actions[0].id;
    const model = buildRuneProofPackCoachModel({
      pack: combatPack,
      progress: {
        ...emptyProgressFor(combatPack, 'run-a'),
        confirmedActionIds: [fightActionId],
      },
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model.proofState).toBe('CONFIRM');
    expect(model.doNow?.id).toBe(fightActionId);
    expect(model.currentCombatCards).toHaveLength(1);
    expect(model.progress.completed).toBe(0);
  });

  it('projects COMPLETE from canonical state or isolated full-route confirmation', () => {
    const canonical = buildRuneProofPackCoachModel({
      pack: branchingPack,
      progress: emptyProgressFor(branchingPack, 'run-a'),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(['Example']),
    });
    expect(canonical.proofState).toBe('COMPLETE');

    const isolated = buildRuneProofPackCoachModel({
      pack: branchingPack,
      progress: fullyConfirmedProgress(branchingPack, 'local'),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(isolated.proofState).toBe('COMPLETE');
  });

  it('keeps canonical completion above unresolved branch evidence', () => {
    const pack = everyBranchNeedsReviewPack();
    const model = buildRuneProofPackCoachModel({
      pack,
      progress: emptyProgressFor(pack, 'run-a'),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set([pack.questId]),
    });
    expect(model.proofState).toBe('COMPLETE');
  });

  it('keeps isolated composite completion above later evidence regression', () => {
    const pack = branchNeedsReviewPack(branchingPack, 'local');
    const model = buildRuneProofPackCoachModel({
      pack,
      progress: fullyConfirmedProgress(pack, 'local'),
      requirementSnapshot: readyRequirementSnapshot(),
      completedQuestIds: new Set(),
    });
    expect(model.proofState).toBe('COMPLETE');
  });
});
```

Before running, export complete `emptyProgressFor`, `everyBranchNeedsReviewPack`, `combatPack`, `fullyConfirmedProgress`, `initialItemPack`, `manualGatePack`, `manualAnyPack`, `itemQuantityPack`, `spentItemPack`, `acquiredItemPack`, and `branchNeedsReviewPack` fixtures from `testFixtures.ts`. The combat pack has deterministic access requirements that pass, reviewed encounter copy, and one unconfirmed subjective readiness ID. `initialItemPack` has a two-unit player-obtained canonical root, one reviewed alias, and a first action requiring the canonical quantity. `manualGatePack` puts the exact same reviewed prompt either in preflight or the current action and uses a distinct action target. `manualAnyPack` contains exactly two manual-only choices, `manual:first` and `manual:second`. `itemQuantityPack` has a current manually confirmed action requiring the requested coin quantity, so an adequate item ledger yields `CONFIRM` while an inadequate one remains `BLOCKED`. `spentItemPack` consumes (and in a parameterized twin returns) its reviewed token at a confirmed checkpoint before a later action requests it again. `acquiredItemPack` completes its first action through `ITEM_CONFIRMED`, acquires two quest tokens through that action's effects, and requires both at the next manually confirmed action. `branchNeedsReviewPack` deep-clones a compiled fixture and replaces only the named branch requirement with reviewed unresolved evidence. `fullyConfirmedProgress` populates every target, selected manual obligation, combat, and checkpoint proof required by the selected route.

- [ ] **Step 2: Run coach tests and confirm the new input/model failures**

Run:

```bash
npx vitest run utils/questStrategies/coach.test.ts
```

Expected: FAIL because the coach input has no pack/progress/branch/combat fields and the model has no proof state or current-action marker.

- [ ] **Step 3: Preserve the old projector and add a named compatibility alias**

Leave the current `RuneProofCoachInput`, `RuneProofCoachModel`, and `buildRuneProofCoachModel` exports and function body byte-for-byte unchanged so Task 11 remains type-compatible with the existing Goal Planner and components. Export an additional alias:

```ts
export const buildLegacyRuneProofCoachModel = buildRuneProofCoachModel;
```

Keep the existing flat-strategy tests on `buildRuneProofCoachModel`, and add one identity assertion showing the alias returns the same model. Keep every current expected instruction, Mill Lane location, alternative route, blocker, action order, proof source, and map chunk unchanged.

- [ ] **Step 4: Define the new coach input and output**

```ts
export interface RuneProofPackCoachInput {
  readonly pack: RuneProofCompiledPack;
  readonly progress: RuneProofQuestProgressV2;
  readonly requirementSnapshot: RuneProofRequirementSnapshot;
  readonly completedQuestIds: ReadonlySet<string>;
  readonly legacyProjection?: Readonly<{
    strategy: QuestStrategyDefinition;
    analysis: RuneProofRouteAnalysis;
    connectGraph?: ConnectGraph;
  }>;
}

export interface RuneProofCoachBranchModel {
  readonly selectedBranchId?: string;
  readonly recommendedBranchId?: string;
  readonly recommendationReason: string;
  readonly pinned: boolean;
  readonly options: readonly RuneProofBranchOptionModel[];
}

export interface RuneProofBranchOptionModel {
  readonly id: string;
  readonly label: string;
  readonly state: 'READY' | 'CONFIRM' | 'BLOCKED' | 'NEEDS_REVIEW';
  readonly evidenceComplete: boolean;
  readonly recommended: boolean;
  readonly recommendationReason: string;
  readonly selected: boolean;
  readonly pinned: boolean;
  readonly progress: Readonly<{ completed: number; total: number }>;
  readonly switchConsequence: Readonly<{
    sharedRetained: number;
    inactive: number;
    reactivated: number;
  }>;
}

export interface RuneProofCombatReadinessModel {
  readonly actionId: string;
  readonly id: string;
  readonly title: string;
  readonly encounterSummary: string;
  readonly phases: readonly string[];
  readonly mandatoryMechanics: readonly string[];
  readonly recommendedCapabilities: readonly string[];
  readonly recommendedSupplies: readonly string[];
  readonly deathEscapeReentryNotes: readonly string[];
  readonly deterministicBlockers: readonly string[];
  readonly confirmationId: string;
  readonly confirmed: boolean;
}

export interface RuneProofReviewedAlternativeModel {
  readonly id: string;
  readonly label: string;
  readonly state: 'READY' | 'CONFIRM' | 'BLOCKED' | 'NEEDS_REVIEW';
  readonly blockerReasons: readonly string[];
  readonly unblockActions: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly reviewedLocation?: RuneProofCoachLocationModel;
  readonly manualConfirmations: readonly RuneProofManualConfirmationModel[];
}

export interface RuneProofManualConfirmationModel {
  readonly id: string;
  readonly prompt: string;
  readonly scopes: readonly ('PREFLIGHT' | 'BRANCH' | 'ACTION' | 'ALTERNATIVE')[];
  readonly evidenceIds: readonly string[];
  readonly confirmed: boolean;
}

export interface RuneProofInitialItemOptionModel {
  readonly itemKey: string;
  readonly label: string;
  readonly confirmed: boolean;
}

export interface RuneProofInitialItemModel {
  readonly canonicalItemKey: string;
  readonly label: string;
  readonly quantity: number;
  readonly provenQuantity: number;
  readonly evidenceIds: readonly string[];
  readonly options: readonly RuneProofInitialItemOptionModel[];
}

export type RuneProofCoachCompletionTarget =
  | { readonly kind: 'ACTION'; readonly id: string }
  | { readonly kind: 'ITEM'; readonly id: string }
  | { readonly kind: 'MANUAL'; readonly id: string }
  | { readonly kind: 'CHECKPOINT'; readonly id: string };

export type RuneProofCoachLocationModel =
  | {
      readonly kind: 'SURFACE';
      readonly label: string;
      readonly plane: number;
      readonly mapChunks: readonly ChunkKey[];
    }
  | {
      readonly kind: 'INSTANCE';
      readonly label: string;
      readonly instanceId: string;
      readonly plane: number;
      readonly entranceChunks: readonly ChunkKey[];
      readonly mapChunks: readonly ChunkKey[];
    };

export type RuneProofPackCoachAction = RuneProofCoachAction & {
  readonly current: boolean;
  readonly completionTarget: RuneProofCoachCompletionTarget;
  readonly reviewedLocation: RuneProofCoachLocationModel;
  readonly unblockActions: readonly string[];
  readonly requirementAdvisories: readonly string[];
};

export interface RuneProofConfirmationProjection {
  readonly actionIds: readonly string[];
  readonly itemKeys: readonly string[];
  readonly manualIds: readonly string[];
  readonly checkpointIds: readonly string[];
}

export interface RuneProofPackCoachModel {
  readonly questId: string;
  readonly proofState: RuneProofProofState;
  readonly branch: RuneProofCoachBranchModel;
  readonly progress: Readonly<{
    completed: number;
    total: number;
    activeConfirmations: RuneProofConfirmationProjection;
    inactiveConfirmations: RuneProofConfirmationProjection;
  }>;
  readonly doNow?: RuneProofPackCoachAction;
  readonly actions: readonly RuneProofPackCoachAction[];
  readonly initialItems: readonly RuneProofInitialItemModel[];
  readonly manualConfirmations: readonly RuneProofManualConfirmationModel[];
  readonly currentCombatCards: readonly RuneProofCombatReadinessModel[];
  readonly reviewedAlternatives: readonly RuneProofReviewedAlternativeModel[];
  readonly alternativeSources: readonly RuneProofAlternativeSourceGroup[];
  readonly mainJourneyText: string;
  readonly proof: Readonly<{
    sources: RuneProofCompiledPack['sources'];
    evidence: RuneProofCompiledPack['evidence'];
    diagnostics: readonly string[];
  }>;
}
```

- [ ] **Step 5: Implement active-route projection and exact state precedence**

```ts
export function buildRuneProofPackCoachModel(
  input: RuneProofPackCoachInput,
): RuneProofPackCoachModel {
  const routeEvidence = new Map(input.pack.branches.map(branch => {
    const ordered = [...input.pack.sharedActions, ...branch.actions]
      .sort((left, right) => left.sourceOrder - right.sourceOrder
        || compareIds(left.id, right.id));
    const activeConfirmed = activeRuneProofConfirmations({
      pack: input.pack,
      progress: input.progress,
      branchId: branch.id,
    });
    const snapshot = withActiveRouteProgress({
      base: input.requirementSnapshot,
      pack: input.pack,
      branch,
      ordered,
      activeConfirmed,
      progress: input.progress,
    });
    return [branch.id, { ordered, activeConfirmed, snapshot }] as const;
  }));
  const branchEvaluations = Object.fromEntries(input.pack.branches.map(branch => [
    branch.id,
    toBranchEvaluation(evaluateRequirementExpression(
      requirementAll(input.pack.preflight, branch.requirements),
      routeEvidence.get(branch.id)!.snapshot,
    )),
  ]));
  const selection = resolveRuneProofBranch({
    pack: input.pack,
    evaluations: branchEvaluations,
    progress: input.progress,
  });
  const branch = selection.branchId === undefined
    ? undefined
    : input.pack.branches.find(value => value.id === selection.branchId);
  if (input.completedQuestIds.has(input.pack.questId)) {
    return projectCanonicalComplete({
      input,
      selection,
      branch,
      branchEvaluations,
      routeEvidence: branch ? routeEvidence.get(branch.id) : undefined,
    });
  }
  if (!branch) {
    return projectNoPlayableRoute({ input, selection, branchEvaluations });
  }
  const selectedRouteEvidence = routeEvidence.get(branch.id)!;
  if (isRuneProofRouteComplete(input.pack, branch, input.progress)) {
    return projectIsolatedComplete({
      input,
      selection,
      branch,
      branchEvaluations,
      routeEvidence: selectedRouteEvidence,
    });
  }
  if (branchEvaluations[branch.id]?.state === 'NEEDS_REVIEW') {
    return projectPinnedRouteNeedsReview({
      input,
      selection,
      branch,
      branchEvaluations,
      routeEvidence: selectedRouteEvidence,
    });
  }
  const { ordered, activeConfirmed, snapshot } = selectedRouteEvidence;
  const currentAction = ordered.find(action =>
    !isRuneProofActionComplete(action, input.progress));
  if (!currentAction) {
    return projectRouteRequirementsOnly({
      input,
      selection,
      branch,
      ordered,
      activeConfirmed,
      branchEvaluations,
      snapshot,
    });
  }
  return projectCoach({
    input,
    selection,
    branch,
    ordered,
    activeConfirmed,
    branchEvaluations,
    snapshot,
    currentAction,
  });
}
```

`toBranchEvaluation` maps evaluator `COMPLETE` to branch-legality `READY` while preserving evidence completeness and empty blockers; canonical/isolated completion is projected only by the two explicit early-completion paths above. Add a direct `observedCanonicalCompletion:true` regression so the ranker never receives a state outside `RuneProofBranchEvaluation`.

`withActiveRouteProgress` sets the prospective branch ID, active manual/checkpoint proofs, the alternative→canonical `itemAliases`, and exact runtime `itemQuantities` on a cloned requirement snapshot. Derive `completedActionIds` by calling Task 9's `isRuneProofActionComplete` for each action; a satisfied completion target with an unconfirmed attached combat record is not complete. Then call Task 4's `replayRuneProofConfirmedItemLedger` with only the selected branch's ordered route and that composite-complete action set. A confirmed canonical root or accepted alternative key seeds only its reviewed `PLAYER_OBTAINED` root quantity; completed action effects then acquire, transform, consume, return, or lend items in source order. Inactive-branch effects never enter the snapshot. Use a separate prospective snapshot for every branch evaluation so a confirmation from one route cannot make a sibling route legal.

Call Task 9's `selectRuneProofManualObligations` separately for pack preflight, the selected branch requirements, the current action requirements, and each displayed alternative requirement. Project only each expression's selected path: losing `ANY` manuals remain hidden, while a confirmed alternative remains visible for unchecking. Normalize identical selected declarations by ID and reject conflicts at compile time. When one identical ID occurs in multiple active contexts, merge its `scopes` in fixed traversal order `PREFLIGHT`, `BRANCH`, `ACTION`, `ALTERNATIVE`, with each value once. Project active pack/branch/action declarations as `manualConfirmations`, and alternative-scoped declarations on their `RuneProofReviewedAlternativeModel`; each retains exact prompt, evidence, scopes, and confirmed state. A selected preflight or branch manual confirmation remains visible even when no action is incomplete.

Project every `pack.initialItems` family as one `RuneProofInitialItemModel`: canonical key/label, exact reviewed quantity, evidence, canonical option followed by source-order alternatives, per-key confirmation state, and `provenQuantity`. Use Task 4's alias-aware ledger, so confirming canonical plus one or more alternatives proves the reviewed family quantity once, never once per key. These are player-obtained root proofs, not action-completion controls.

When every action is composite-complete but pack/branch manual or deterministic requirements keep `isRuneProofRouteComplete` false, `projectRouteRequirementsOnly` evaluates `requirementAll(input.pack.preflight, branch.requirements)`, projects the same exact state/blocker/unblock/manual controls, sets `doNow:undefined`, marks every action `current:false`, and exposes no combat card. It never dereferences a missing current action.

Otherwise `projectCoach` evaluates the supplied first composite-incomplete action with `requirementAll(input.pack.preflight, branch.requirements, currentAction.requirements)`; pack-level quest, QP, skill, combat, region, access, and manual gates must therefore remain visible after branch selection. It applies:

1. Observed canonical completion or `isRuneProofRouteComplete` → `COMPLETE` through the two early paths above.
2. Current action/branch unresolved evidence → `NEEDS_REVIEW`.
3. Current known deterministic blocker → `BLOCKED`.
4. Any active pending manual gate, current manual action, or unconfirmed current combat readiness → `CONFIRM`.
5. Otherwise → `READY`.

Copy the winning requirement result's `unblockActions` and `advisories` to `RuneProofPackCoachAction.unblockActions` and `.requirementAdvisories`. Render unblocks as exact concrete next steps and advisories as reviewed route consequences, never as blockers. This is where a one-way transport's origin/destination warning remains visible.

`projectNoPlayableRoute` returns `NEEDS_REVIEW`, no `doNow`, no active actions, the full disabled option list, and exact unresolved reasons. An already selected route that has become `NEEDS_REVIEW` may remain visibly selected/pinned for progress continuity, but it projects no playable current action until its evidence is reviewed.

`projectPinnedRouteNeedsReview` preserves the selected option, pin, stored active/inactive progress counts, proof sources, and unresolved diagnostics, but sets every action's `current` flag false, exposes no `doNow` or combat card, and never falls through to normal route projection.

Choose the first active-route action for which `isRuneProofActionComplete` is false as the sole `current:true` action and `doNow`. A completion-target confirmation alone therefore cannot skip an unconfirmed combat card. A blocked current action remains the one concrete card and includes its exact root blocker/unblock copy. Do not silently advance past an invalid action.

Project each action's completion target exactly: `ACTION_CONFIRMED` and canonical completion become `{ kind:'ACTION', id:actionId }`; `ITEM_CONFIRMED` becomes `{ kind:'ITEM', id:itemKey }`; `MANUAL` becomes `{ kind:'MANUAL', id:confirmationId }`; and `BRANCH_CHECKPOINT` becomes `{ kind:'CHECKPOINT', id:checkpointId }`. The action checkbox still writes only that target, while composite completion additionally requires the selected action-manual obligation and every attached combat confirmation through `isRuneProofActionComplete`; migrated action/item/manual/checkpoint confirmations retain their accepted meaning without conflating them with subjective combat acknowledgement.

Project every reviewed pack location without loss: surface label/chunks/plane; or instance label/ID/plane plus entrance chunks. For an instance, `mapChunks` is the entrance chunk list because the world map cannot draw instance-local geometry. The UI must label it as an entrance and retain the instance ID/plane instead of presenting it as a surface destination.

Use `buildLegacyRuneProofCoachModel` only inside the new pack projector to enrich matching action IDs with current approved item-route alternatives, map labels, and diagnostics. Generic resolver output cannot replace pack instructions unless the legacy adapter supplied an explicit reviewed alternative.

Project the current action's generic `alternatives` independently of legacy route groups. Evaluate each alternative's typed requirements into state, blocker/unblock copy, retain its evidence IDs, project its optional reviewed location, and expose its manual confirmation prompts. Generic alternatives are advisory methods only and have no `itemEffects` or selected state. Any method that changes the ledger or later route must be authored as a distinct branch, where its actions/effects are compiled, selected, persisted, and replayed. `alternativeSources` remains only the five-pack legacy route enrichment; every future non-legacy reviewed advisory alternative is representable through `reviewedAlternatives`.

For every branch option, compute retained shared confirmations, confirmations becoming inactive, and confirmations reactivated when returning. A one-branch pack still has a branch model but the UI may hide its selector.

For combat:

- Deterministic combat/access requirements may add blockers.
- Recommended capability/supply copy never adds a blocker.
- Missing combat evidence yields `NEEDS_REVIEW`.
- An unconfirmed subjective readiness ID yields `CONFIRM`.
- Confirmation acknowledges following the reviewed guide; it does not prove gear, reflexes, skill, or risk tolerance.
- Set `actionId` on every card and expose only cards whose action is the current action as `currentCombatCards`; a later encounter is absent until its action becomes current.

- [ ] **Step 6: Run new and golden coach tests**

Run:

```bash
npx vitest run utils/questStrategies/coach.test.ts utils/questStrategies/legacyPackAdapter.test.ts data/questWalkthroughs.public.test.ts
npm run typecheck
```

Expected: all commands exit 0; old journey expectations and new branch/combat cases both pass.

- [ ] **Step 7: Commit the coach model**

```bash
git add utils/questStrategies/coach.ts utils/questStrategies/coach.test.ts utils/questStrategies/testFixtures.ts
git commit -m "feat: project branch-aware RuneProof coaching"
```

---

### Task 12: Render Filters, Deliberate Branch Switching, and Combat Confirmation

**Files:**
- Create: `components/questStrategies/RuneProofCatalogueFilters.tsx`
- Create: `components/questStrategies/RuneProofCatalogueFilters.test.tsx`
- Create: `components/questStrategies/RuneProofBranchSelector.tsx`
- Create: `components/questStrategies/RuneProofBranchSelector.test.tsx`
- Create: `components/questStrategies/RuneProofCombatReadiness.tsx`
- Create: `components/questStrategies/RuneProofCombatReadiness.test.tsx`
- Create: `components/questStrategies/RuneProofInitialItems.tsx`
- Create: `components/questStrategies/RuneProofInitialItems.test.tsx`
- Create: `components/questStrategies/RuneProofManualConfirmations.tsx`
- Create: `components/questStrategies/RuneProofManualConfirmations.test.tsx`
- Modify: `components/questStrategies/RuneProofCoach.tsx`
- Modify: `components/questStrategies/RuneProofCoach.test.tsx`
- Modify: `components/questStrategies/RuneProofObjectivePicker.tsx`
- Modify: `components/questStrategies/RuneProofObjectivePicker.test.tsx`
- Modify: `components/questStrategies/RuneProofProofDrawer.tsx`
- Modify: `components/questStrategies/RuneProofProofDrawer.test.tsx`
- Modify: `components/GoalPlannerModal.tsx`
- Modify: `utils/questStrategies/testFixtures.ts`

**Interfaces:**
- Consumes: Task 10 summaries/recommendations, Task 11 branch/combat/coach models, and callback-only V2 controls.
- Produces: accessible stateless UI with a discriminated legacy/pack-coach prop surface; no component imports GameContext mutation functions.

- [ ] **Step 1: Write failing pure-filter and control tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  filterRuneProofCatalogue,
  RuneProofCatalogueFilters,
  type RuneProofCatalogueFilterState,
} from './RuneProofCatalogueFilters';
import {
  catalogueSummary,
  makeCatalogueSummaries,
} from '../../utils/questStrategies/testFixtures';

const ALL_FILTERS: RuneProofCatalogueFilterState = {
  query: '',
  kind: 'ALL',
  membership: 'ALL',
  series: 'ALL',
  readiness: 'ALL',
  milestone: 'ALL',
  reviewStatus: 'ALL',
};

describe('RuneProof catalogue filters', () => {
  it('preserves exact unfiltered counts and combines every dimension', () => {
    const summaries = makeCatalogueSummaries(210);
    expect(filterRuneProofCatalogue(summaries, ALL_FILTERS)).toHaveLength(210);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      kind: 'miniquest',
    })).toHaveLength(19);
    expect(filterRuneProofCatalogue(summaries, {
      ...ALL_FILTERS,
      membership: 'F2P',
    })).toHaveLength(23);
    const wanted = {
      ...ALL_FILTERS,
      query: 'match',
      kind: 'quest',
      membership: 'MEMBERS',
      series: 'Dragonkin',
      readiness: 'BLOCKED',
      milestone: 4,
      reviewStatus: 'PREVIEW_VALIDATED',
    } as const;
    const matching = catalogueSummary({
      questId: 'Dragon match',
      kind: 'quest',
      membership: 'MEMBERS',
      series: 'Dragonkin',
      proofState: 'BLOCKED',
      milestone: 4,
      reviewStatus: 'PREVIEW_VALIDATED',
    });
    const nearMisses = [
      catalogueSummary({ ...matching, questId: 'No wyrm here' }),
      catalogueSummary({ ...matching, questId: 'Match kind', kind: 'miniquest' }),
      catalogueSummary({ ...matching, questId: 'Match membership', membership: 'F2P' }),
      catalogueSummary({ ...matching, questId: 'Match series', series: 'Mahjarrat' }),
      catalogueSummary({ ...matching, questId: 'Match readiness', proofState: 'READY' }),
      catalogueSummary({ ...matching, questId: 'Match milestone', milestone: 3 }),
      catalogueSummary({ ...matching, questId: 'Match review', reviewStatus: 'NO_PACK' }),
    ];
    expect(filterRuneProofCatalogue([matching, ...nearMisses], wanted)
      .map(value => value.questId)).toEqual(['Dragon match']);
  });

  it('emits a deterministic reset and keeps focus on the activated control', () => {
    const onChange = vi.fn();
    render(<RuneProofCatalogueFilters
      value={{ ...ALL_FILTERS, query: 'dragon', kind: 'quest' }}
      seriesOptions={['Dragonkin']}
      resultCount={1}
      totalCount={210}
      onChange={onChange}
    />);
    expect(screen.getByText('Showing 1 of 210 objectives')).toBeInTheDocument();
    const reset = screen.getByRole('button', { name: 'Reset RuneProof filters' });
    reset.focus();
    fireEvent.click(reset);
    expect(onChange).toHaveBeenCalledWith(ALL_FILTERS);
    expect(reset).toHaveFocus();
  });

  it('converts the milestone select string to the numeric filter union', () => {
    const onChange = vi.fn();
    render(<RuneProofCatalogueFilters
      value={ALL_FILTERS}
      seriesOptions={[]}
      resultCount={210}
      totalCount={210}
      onChange={onChange}
    />);
    fireEvent.change(screen.getByLabelText('Milestone'), {
      target: { value: '4' },
    });
    expect(onChange).toHaveBeenCalledWith({ ...ALL_FILTERS, milestone: 4 });
  });
});
```

- [ ] **Step 2: Run filter tests and confirm the missing module failure**

Run:

```bash
npx vitest run components/questStrategies/RuneProofCatalogueFilters.test.tsx
```

Expected: FAIL because `./RuneProofCatalogueFilters` does not exist.

- [ ] **Step 3: Implement exact filter state and labelled controls**

```ts
export interface RuneProofCatalogueFilterState {
  readonly query: string;
  readonly kind: 'ALL' | 'quest' | 'miniquest';
  readonly membership: 'ALL' | 'F2P' | 'MEMBERS';
  readonly series: 'ALL' | string;
  readonly readiness: 'ALL' | RuneProofProofState;
  readonly milestone: 'ALL' | 1 | 2 | 3 | 4 | 5;
  readonly reviewStatus: 'ALL' | RuneProofCatalogueReviewStatus;
}

export const DEFAULT_RUNE_PROOF_FILTERS: RuneProofCatalogueFilterState =
  Object.freeze({
    query: '',
    kind: 'ALL',
    membership: 'ALL',
    series: 'ALL',
    readiness: 'ALL',
    milestone: 'ALL',
    reviewStatus: 'ALL',
  });
```

`filterRuneProofCatalogue` uses case-insensitive quest ID/series search and exact equality for the other six dimensions. The component accepts exact `resultCount` and `totalCount` props, renders `Showing {resultCount} of {totalCount} objectives`, and renders `<input type="search" aria-label="Search RuneProof objectives">`, six labelled selects, and a reset button. Parse the milestone DOM value through an exhaustive `ALL | '1' | ... | '5'` switch and emit the corresponding numeric literal; an unknown value resets to `ALL` rather than leaking a string. Each change emits one complete immutable state object; it never loads a pack or calls an analyzer.

- [ ] **Step 4: Write failing deliberate-switch tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RuneProofBranchSelector } from './RuneProofBranchSelector';
import { branchOption } from '../../utils/questStrategies/testFixtures';

it('requires an explicit route button and reports switch consequences', () => {
  const onSelectBranch = vi.fn();
  const local = branchOption('local', {
    selected: true,
    recommended: true,
    pinned: true,
  });
  const remote = branchOption('remote', {
    selected: false,
    recommended: false,
    pinned: false,
    switchConsequence: { sharedRetained: 2, inactive: 3, reactivated: 1 },
  });
  const { rerender } = render(<RuneProofBranchSelector
    branches={[local, remote]}
    onSelectBranch={onSelectBranch}
  />);
  expect(screen.getByText(/2 shared confirmations stay active/i)).toBeInTheDocument();
  expect(screen.getByText(/3 become inactive/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use Remote route' }));
  expect(onSelectBranch).toHaveBeenCalledTimes(1);
  expect(onSelectBranch).toHaveBeenCalledWith('remote');
  expect(screen.getByRole('article', { name: 'Local route' }))
    .toHaveAttribute('aria-current', 'true');
  rerender(<RuneProofBranchSelector
    branches={[
      { ...local, selected: false },
      { ...remote, selected: true, pinned: true },
    ]}
    onSelectBranch={onSelectBranch}
  />);
  expect(screen.getByRole('article', { name: 'Remote route' })).toHaveFocus();
});

it('hides for one branch and disables needs-review routes', () => {
  const { rerender } = render(<RuneProofBranchSelector
    branches={[branchOption('main', { selected: true })]}
    onSelectBranch={vi.fn()}
  />);
  expect(screen.queryByRole('group', { name: 'Quest route' })).not.toBeInTheDocument();
  rerender(<RuneProofBranchSelector
    branches={[
      branchOption('main', { selected: true }),
      branchOption('unknown', { state: 'NEEDS_REVIEW' }),
    ]}
    onSelectBranch={vi.fn()}
  />);
  expect(screen.getByRole('button', { name: 'Use Unknown route' })).toBeDisabled();
});

it('does not move focus until the requested branch is actually selected', () => {
  const local = branchOption('local', { selected: true });
  const remote = branchOption('remote', { selected: false });
  const { rerender } = render(<RuneProofBranchSelector
    branches={[local, remote]}
    onSelectBranch={vi.fn()}
  />);
  fireEvent.click(screen.getByRole('button', { name: 'Use Remote route' }));
  rerender(<RuneProofBranchSelector
    branches={[{ ...local }, { ...remote }]}
    onSelectBranch={vi.fn()}
  />);
  expect(screen.getByRole('article', { name: 'Remote route' })).not.toHaveFocus();
  rerender(<RuneProofBranchSelector
    branches={[{ ...local, selected: false }, { ...remote, selected: true }]}
    onSelectBranch={vi.fn()}
  />);
  expect(screen.getByRole('article', { name: 'Remote route' })).toHaveFocus();
});
```

- [ ] **Step 5: Implement the selector with pending-focus restoration**

```tsx
export interface RuneProofBranchSelectorProps {
  readonly branches: readonly RuneProofBranchOptionModel[];
  readonly onSelectBranch: (branchId: string) => void;
}

export function RuneProofBranchSelector({
  branches,
  onSelectBranch,
}: RuneProofBranchSelectorProps) {
  const pendingFocus = React.useRef<string | null>(null);
  const containers = React.useRef(new Map<string, HTMLElement>());
  React.useEffect(() => {
    if (!pendingFocus.current) return;
    const selected = branches.find(branch =>
      branch.id === pendingFocus.current && branch.selected);
    if (!selected) return;
    containers.current.get(selected.id)?.focus();
    pendingFocus.current = null;
  }, [branches]);
  if (branches.length < 2) return null;
  return (
    <section role="group" aria-label="Quest route">
      {branches.map(branch => (
        <article
          key={branch.id}
          ref={(node) => {
            if (node) containers.current.set(branch.id, node);
            else containers.current.delete(branch.id);
          }}
          tabIndex={-1}
          aria-label={`${branch.label} route`}
          aria-current={branch.selected ? 'true' : undefined}
        >
          <h4>{branch.label}</h4>
          <p>{branch.recommendationReason}</p>
          <p>{branch.switchConsequence.sharedRetained} shared confirmations stay active; {' '}
            {branch.switchConsequence.inactive} become inactive; {' '}
            {branch.switchConsequence.reactivated} reactivate.</p>
          <button
            type="button"
            disabled={branch.state === 'NEEDS_REVIEW' || branch.selected}
            onClick={() => {
              pendingFocus.current = branch.id;
              onSelectBranch(branch.id);
            }}
          >
            Use {branch.label} route
          </button>
        </article>
      ))}
    </section>
  );
}
```

Extend the concrete article above with visible readiness, recommended/pinned badges, and progress. On click, store the ID in `pendingFocus` and call the callback once; do not optimistically change selected state. Focus only after a later branches model marks that exact pending ID selected; a failed write or warning-only rerender leaves focus where it was and keeps the request pending. After confirmed selection, focus its `tabIndex={-1}` route article rather than the now-disabled selected button. `NEEDS_REVIEW` is disabled. `BLOCKED` remains selectable so the player can pursue its reviewed unblock path. Export complete `branchOption` and `initialItemModel` builders from the shared test fixtures before running Task 12; the latter returns every `RuneProofInitialItemModel` field and supports exact overrides.

- [ ] **Step 6: Write failing combat-card tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RuneProofCombatReadiness } from './RuneProofCombatReadiness';
import { RuneProofInitialItems } from './RuneProofInitialItems';
import { RuneProofManualConfirmations } from './RuneProofManualConfirmations';
import { initialItemModel } from '../../utils/questStrategies/testFixtures';

it('shows reviewed guidance and records only the explicit readiness ID', () => {
  const onSetConfirmed = vi.fn();
  render(<RuneProofCombatReadiness
    model={{
      actionId: 'guardian:encounter',
      id: 'guardian',
      title: 'Guardian readiness',
      encounterSummary: 'One reviewed encounter.',
      phases: ['Opening'],
      mandatoryMechanics: ['Avoid the marked tile.'],
      recommendedCapabilities: ['A reviewed damage option'],
      recommendedSupplies: ['Food'],
      deathEscapeReentryNotes: ['Escape through the entrance.', 'Re-enter there.'],
      deterministicBlockers: [],
      confirmationId: 'combat:guardian:ready',
      confirmed: false,
    }}
    onSetConfirmed={onSetConfirmed}
  />);
  expect(screen.getByText('Avoid the marked tile.')).toBeInTheDocument();
  expect(screen.queryByText(/impossible/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /I am ready to follow this reviewed guide/i }));
  expect(onSetConfirmed).toHaveBeenCalledWith('combat:guardian:ready', true);
});

it('confirms and unconfirms the exact reviewed root option', () => {
  const onSetItemConfirmed = vi.fn();
  const model = initialItemModel({
    canonicalItemKey: 'bucket of milk',
    quantity: 2,
    options: [
      { itemKey: 'bucket of milk', label: 'Bucket of milk', confirmed: false },
      { itemKey: 'milk substitute', label: 'Milk substitute', confirmed: false },
    ],
  });
  const { rerender } = render(<RuneProofInitialItems
    items={[model]}
    onSetItemConfirmed={onSetItemConfirmed}
  />);
  expect(screen.getByText(/2 × Bucket of milk/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Milk substitute/i }));
  expect(onSetItemConfirmed).toHaveBeenCalledWith('milk substitute', true);
  rerender(<RuneProofInitialItems
    items={[{
      ...model,
      provenQuantity: 2,
      options: model.options.map(option => option.itemKey === 'milk substitute'
        ? { ...option, confirmed: true }
        : option),
    }]}
    onSetItemConfirmed={onSetItemConfirmed}
  />);
  fireEvent.click(screen.getByRole('checkbox', { name: /Milk substitute/i }));
  expect(onSetItemConfirmed).toHaveBeenLastCalledWith('milk substitute', false);
});

it('writes the exact pending manual requirement ID and prompt', () => {
  const onSetManualConfirmed = vi.fn();
  render(<RuneProofManualConfirmations
    confirmations={[{
      id: 'manual:preflight',
      prompt: 'I have checked the reviewed one-way consequence.',
      scopes: ['PREFLIGHT'],
      evidenceIds: ['review:manual'],
      confirmed: false,
    }]}
    onSetManualConfirmed={onSetManualConfirmed}
  />);
  fireEvent.click(screen.getByRole('checkbox', {
    name: 'I have checked the reviewed one-way consequence.',
  }));
  expect(onSetManualConfirmed).toHaveBeenCalledWith('manual:preflight', true);
});
```

- [ ] **Step 7: Implement explicit combat acknowledgement**

```tsx
export interface RuneProofCombatReadinessProps {
  readonly model: RuneProofCombatReadinessModel;
  readonly onSetConfirmed: (confirmationId: string, confirmed: boolean) => void;
}

export interface RuneProofInitialItemsProps {
  readonly items: readonly RuneProofInitialItemModel[];
  readonly onSetItemConfirmed: (itemKey: string, confirmed: boolean) => void;
}

export interface RuneProofManualConfirmationsProps {
  readonly confirmations: readonly RuneProofManualConfirmationModel[];
  readonly onSetManualConfirmed: (confirmationId: string, confirmed: boolean) => void;
}
```

Render encounter summary, phases, mandatory mechanics, recommended capabilities, supplies, death/escape/re-entry notes, and known deterministic blockers. Use this exact checkbox copy:

```text
I am ready to follow this reviewed guide. This confirms my choice; it does not prove my gear, reflexes, combat skill, or risk tolerance.
```

The combat checkbox writes only `model.confirmationId`. `RuneProofInitialItems` renders one fieldset per canonical family, exact reviewed quantity/proven quantity/evidence cue, and a checkbox for the canonical and each accepted alternative key; each checkbox writes only its displayed key and never changes a sibling optimistically. `RuneProofManualConfirmations` renders the exact reviewed prompts and writes only their IDs. Both components are controlled and render confirmed state only after persisted progress returns through the model. Do not render `impossible` or derive subjective blocker copy.

- [ ] **Step 8: Integrate the new stateless models into the coach**

Update props:

```ts
interface LegacyRuneProofCoachProps {
  readonly variant: 'LEGACY';
  readonly model: RuneProofCoachModel;
  readonly onConfirmAction: (actionId: string) => void;
  readonly onSetCompletion?: never;
  readonly onSelectBranch?: never;
  readonly onSetItemConfirmed?: never;
  readonly onSetManualConfirmed?: never;
}

interface RuneProofPackCoachProps {
  readonly variant: 'PACK';
  readonly model: RuneProofPackCoachModel;
  readonly onSetCompletion: (
    target: RuneProofCoachCompletionTarget,
    confirmed: boolean,
  ) => void;
  readonly onSelectBranch: (branchId: string) => void;
  readonly onSetItemConfirmed: (itemKey: string, confirmed: boolean) => void;
  readonly onSetManualConfirmed: (confirmationId: string, confirmed: boolean) => void;
}

export type RuneProofCoachProps =
  | LegacyRuneProofCoachProps
  | RuneProofPackCoachProps;
```

Extract the current rendering body unchanged into a private `LegacyRuneProofCoachView`. In the exported component, discriminate on `props.variant`: `LEGACY` renders that compatibility view, while `PACK` renders the new ordered surface below. Keep the whole `props` object intact until after this top-level discrimination so TypeScript narrows the correlated callback set safely. Update the existing Goal Planner workspace and existing component fixtures to pass `variant="LEGACY"`; Task 13 replaces the live workspace call with `variant="PACK"`. This lets Task 12 typecheck before Goal Planner migrates in Task 13; no no-op callback is introduced.

The pack-coach action control calls `onSetCompletion(action.completionTarget, checked)`; it never assumes the action ID is the persisted proof ID. Add component regressions for `ACTION`, `ITEM`, `MANUAL`, and `CHECKPOINT` targets. Root-item options call `onSetItemConfirmed`; generic manual prompts and combat acknowledgement call `onSetManualConfirmed` with their exact distinct IDs. Render `model.initialItems`, active `model.manualConfirmations`, and alternative-scoped manual confirmations through the controlled components above.

Add a pack-coach rendering regression with one surface action, one instance action, one one-way transport advisory, one exact blocker plus `Raise Mining to 99.` unblock action, and one generic reviewed alternative. Assert the visible labels preserve the blocker and unblock as distinct copy, surface chunks/plane, instance ID/entrance chunks/plane, directed transport consequence, alternative state, and evidence-backed method copy; the temporary map may use only the instance entrance chunks and must call it an entrance rather than a surface destination.

Render order:

1. Quest header, proof state, branch progress.
2. Branch selector when two or more branches exist.
3. Reviewed root-item checklist and active generic manual confirmations.
4. Combat card associated with the current action.
5. One concrete `Do now` card, when an action remains.
6. Ordered shared/active timeline.
7. Blocker/unblock and reviewed alternatives, including alternative manual prompts.
8. Temporary map without unmounting the coach.
9. Updated proof drawer using generic pack sources/evidence and maintainer diagnostics.

Keep objective-picker labels for `READY`, `CONFIRM`, and actionable `BLOCKED`; `NEEDS_REVIEW` and `COMPLETE` appear only in catalogue rows. Pass the picker only Task 10 recommendations and keep the visible maximum at three.

- [ ] **Step 9: Run all component suites**

Run:

```bash
npx vitest run components/questStrategies/RuneProofCatalogueFilters.test.tsx components/questStrategies/RuneProofBranchSelector.test.tsx components/questStrategies/RuneProofCombatReadiness.test.tsx components/questStrategies/RuneProofInitialItems.test.tsx components/questStrategies/RuneProofManualConfirmations.test.tsx components/questStrategies/RuneProofCoach.test.tsx components/questStrategies/RuneProofObjectivePicker.test.tsx components/questStrategies/RuneProofProofDrawer.test.tsx components/GoalPlannerModal.runeproof.test.tsx
npm run typecheck
```

Expected: all commands exit 0; five single-branch golden views remain free of a branch selector.

- [ ] **Step 10: Commit reusable UI**

```bash
git add components/questStrategies/RuneProofCatalogueFilters.tsx components/questStrategies/RuneProofCatalogueFilters.test.tsx components/questStrategies/RuneProofBranchSelector.tsx components/questStrategies/RuneProofBranchSelector.test.tsx components/questStrategies/RuneProofCombatReadiness.tsx components/questStrategies/RuneProofCombatReadiness.test.tsx components/questStrategies/RuneProofInitialItems.tsx components/questStrategies/RuneProofInitialItems.test.tsx components/questStrategies/RuneProofManualConfirmations.tsx components/questStrategies/RuneProofManualConfirmations.test.tsx components/questStrategies/RuneProofCoach.tsx components/questStrategies/RuneProofCoach.test.tsx components/questStrategies/RuneProofObjectivePicker.tsx components/questStrategies/RuneProofObjectivePicker.test.tsx components/questStrategies/RuneProofProofDrawer.tsx components/questStrategies/RuneProofProofDrawer.test.tsx components/GoalPlannerModal.tsx utils/questStrategies/testFixtures.ts
git commit -m "feat: render RuneProof branch and combat controls"
```

---

### Task 13: Integrate the 210-Entry Catalogue into Goal Planner Lazily

**Files:**
- Modify: `utils/questRoutes/analyzeQuest.ts`
- Modify: `utils/questRoutes/analyzeQuest.test.ts`
- Modify: `utils/questRoutes/goalPlannerRuneProof.ts`
- Modify: `utils/questRoutes/goalPlannerRuneProof.test.ts`
- Modify: `components/GoalPlannerModal.tsx`
- Modify: `components/GoalPlannerModal.runeproof.test.tsx`
- Modify: `components/Dashboard.runeproof.test.tsx`
- Modify: `data/questWalkthroughLoader.ts`

**Interfaces:**
- Consumes: `loadRuneProofCatalogue`, `loadRuneProofPackFor`, optional private review harness, V2 progress hook, action-free preflight, selected legacy projection, and new UI callbacks.
- Produces: 210-row private audit catalogue, five-row public catalogue, selected-only pack/deep analysis, ordinary-planner fallback, and private platform review workspace.

- [ ] **Step 1: Inject the complete reviewed requirement record into deep analysis**

Add a failing test:

```ts
it('uses injected reviewed requirements for an ID outside the global eight', () => {
  const reviewedRequirements = {
    questId: 'A members quest without legacy roots',
    wikiRevision: '15300000',
    reviewedAt: '2026-08-22',
    items: [{
      item: { key: 'example item', name: 'Example item' },
      quantity: 1,
      supplyPolicy: 'PLAYER_OBTAINED' as const,
    }],
  };
  const selectedWalkthrough = {
    ...walkthrough,
    questId: reviewedRequirements.questId,
    revision: 'members-pack-v1',
  };
  const itemSourceRecords = vi.fn(() => []);
  const snapshot = materializeQuestRouteSnapshot(
    'A members quest without legacy roots',
    account,
    { ...contentService, itemSourceRecords },
    1,
    selectedWalkthrough,
    reviewedRequirements,
  );
  expect(itemSourceRecords).toHaveBeenCalledWith('Example item');
  expect(snapshot.reviewedRequirements).toEqual(reviewedRequirements);
  expect(() => analyzeQuest(
    reviewedRequirements.questId,
    snapshot,
    selectedWalkthrough,
  )).not.toThrow();
});
```

Add this field to the existing immutable snapshot contract:

```ts
readonly reviewedRequirements: DeepReadonly<ReviewedQuestRequirements>;
```

Add the final `reviewedRequirements` parameter to materialization:

```ts
export const materializeQuestRouteSnapshot = (
  questId: string,
  account: RuneProofAccountSnapshot,
  contentService: RuneProofContentService,
  chunkDataVersion: number,
  walkthrough: QuestWalkthroughDefinition,
  reviewedRequirements: ReviewedQuestRequirements,
): QuestRouteAnalysisSnapshot;
```

Remove this global lookup from the existing implementation:

```ts
const catalogue = reviewedQuestRequirements(questId);
if (!catalogue) throw new Error(`RuneProof has no reviewed item catalogue for ${questId}.`);
```

Validate and clone the injected record instead:

```ts
if (reviewedRequirements.questId !== questId) {
  throw new Error('RuneProof reviewed requirement identity does not match ' + questId + '.');
}
const catalogue = structuredClone(reviewedRequirements);
```

Return a deep-frozen clone as `snapshot.reviewedRequirements`. Remove the runtime import of `reviewedQuestRequirements` from both `goalPlannerRuneProof.ts` and `analyzeQuest.ts`. Replace `analyzeQuestItems`' current `NonNullable<ReturnType<typeof reviewedQuestRequirements>>` annotation with the imported `ReviewedQuestRequirements` type wrapped in the repository's deep-readonly type; then validate `snapshot.reviewedRequirements.questId === questId` and resolve every item from `snapshot.reviewedRequirements.items`. In `analyzeQuest`, use the injected `wikiRevision` in the cache key. Include the full normalized reviewed-requirement record in `contentStateFingerprint`, so a same-revision content change cannot reuse a stale result.

Keep the remainder of the immutable item/source/recipe/entity snapshot body unchanged. Update every current caller and test fixture to pass its complete `ReviewedQuestRequirements` object, not just its item list. This deliberately separates route-analysis roots from `pack.initialItems`: Task 7 removes route-produced inputs from the ledger roots, while deep route analysis must retain the full reviewed egg/milk/flour requirements and alternatives.

Run:

```bash
npx vitest run utils/questRoutes/analyzeQuest.test.ts utils/questRoutes/goalPlannerRuneProof.test.ts
```

Expected: PASS after the injected-requirement change, including cache invalidation and a non-global quest ID.

- [ ] **Step 2: Write failing action-free catalogue and lazy-load integration tests**

Extend the existing loader mock with `loadCatalogue`, `loadPack`, and `loadReviewHarness` spies, then add:

```tsx
it('searches and filters 210 summaries without loading or analyzing a pack', async () => {
  const summaries = makeCatalogueSummaries(210, {
    playableQuestIds: new Set(),
  });
  const loadPack = vi.fn();
  const analyze = vi.fn();
  renderGoalPlanner({
    availability: 'PREVIEW',
    loadCatalogue: vi.fn(async () => summaries),
    loadPack,
    analyze,
  });

  await screen.findByText('210 objectives');
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search RuneProof objectives' }), 'dragon');
  await userEvent.selectOptions(screen.getByLabelText('Objective kind'), 'quest');
  await userEvent.selectOptions(screen.getByLabelText('Membership'), 'MEMBERS');
  await userEvent.selectOptions(screen.getByLabelText('Readiness'), 'NEEDS_REVIEW');
  expect(loadPack).not.toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
});

it('loads and deeply analyzes only the selected playable objective', async () => {
  const first = loadedGoldenPack("Cook's Assistant");
  const second = loadedGoldenPack('Sheep Shearer');
  const loadPack = vi.fn(async (_availability, release) =>
    release.questId === first.pack.questId ? first : second);
  const analyze = vi.fn(analyzeQuest);
  renderGoalPlanner({
    availability: 'PREVIEW',
    loadCatalogue: vi.fn(async () => summariesFor(first, second)),
    loadPack,
    analyze,
  });

  await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(1));
  expect(analyze).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('button', { name: /Open reviewed route/i }).length)
    .toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('button', { name: /Sheep Shearer.*Open reviewed route/i }));
  await waitFor(() => expect(loadPack).toHaveBeenCalledTimes(2));
  expect(analyze).toHaveBeenCalledTimes(2);
});

it('keeps an unreleased row visible but falls back to the ordinary planner', async () => {
  renderGoalPlanner({
    availability: 'PREVIEW',
    loadCatalogue: vi.fn(async () => makeCatalogueSummaries(210, {
      noPackQuestIds: new Set(["Daddy's Home"]),
    })),
  });
  await userEvent.click(await screen.findByRole('button', { name: /Daddy's Home/i }));
  expect(screen.getByText('Needs review')).toBeInTheDocument();
  expect(screen.queryByText('Do now')).not.toBeInTheDocument();
  expect(screen.getByText(/Goal Planner/i)).toBeInTheDocument();
});

it('does not load a released row whose account preflight needs review', async () => {
  const summary = releasedSummaryWithUnresolvedPreflight('Reviewed later');
  const loadPack = vi.fn();
  renderGoalPlanner({
    availability: 'PREVIEW',
    loadCatalogue: vi.fn(async () => [summary]),
    loadPack,
  });
  await userEvent.click(await screen.findByRole('button', { name: /Reviewed later/i }));
  expect(screen.getByText('Needs review')).toBeInTheDocument();
  expect(loadPack).not.toHaveBeenCalled();
});

it('suppresses the old coach in the selection render before the next effect', async () => {
  const { firstInstruction, secondLoad, selectSecond } =
    renderLoadedGoldenWithDeferredSecondPack();
  expect(await screen.findByText(firstInstruction)).toBeInTheDocument();
  await selectSecond();
  expect(screen.queryByText(firstInstruction)).not.toBeInTheDocument();
  expect(secondLoad.isPending()).toBe(true);
  secondLoad.resolve();
});

it('invalidates a cached coach when exact release truth changes', async () => {
  const { oldInstruction, replaceRelease, replacementLoad } =
    renderLoadedGoldenWithMutableRelease();
  expect(await screen.findByText(oldInstruction)).toBeInTheDocument();
  replaceRelease({
    catalogueRevision: 'catalogue-next',
    lifecycle: 'PUBLIC_APPROVED',
  });
  expect(screen.queryByText(oldInstruction)).not.toBeInTheDocument();
  expect(replacementLoad.isPending()).toBe(true);
  replacementLoad.resolve();
  await waitFor(() => expect(screen.getByText(/replacement reviewed route/i))
    .toBeInTheDocument());
});

it('invalidates cached analysis when an injected service identity changes', async () => {
  const firstAnalyze = vi.fn(analyzeQuest);
  const secondAnalyze = vi.fn(analyzeQuest);
  const { rerender, oldInstruction } = renderLoadedGolden({ analyze: firstAnalyze });
  expect(await screen.findByText(oldInstruction)).toBeInTheDocument();
  rerender({ analyze: secondAnalyze });
  expect(screen.queryByText(oldInstruction)).not.toBeInTheDocument();
  await waitFor(() => expect(secondAnalyze).toHaveBeenCalledTimes(1));
});
```

Define `loadedGoldenPack`, `summariesFor`, `releasedSummaryWithUnresolvedPreflight`, the deferred loader, and the enhanced `renderGoalPlanner` next to the existing complete test fixtures. Retain the current stale-request generation tests.

- [ ] **Step 3: Extend the injectable integration contract**

```ts
export type RuneProofLegacyAnalyze = (
  questId: string,
  snapshot: QuestRouteAnalysisSnapshot,
  walkthrough: QuestWalkthroughDefinition,
) => RuneProofRouteAnalysis;

export interface RuneProofIntegration {
  readonly availability: RuneProofAvailability;
  readonly chunkDataVersion: number;
  readonly contentService: RuneProofContentService;
  readonly analyze: RuneProofLegacyAnalyze;
  readonly loadCatalogue?: typeof loadRuneProofCatalogue;
  readonly loadPack?: typeof loadRuneProofPackFor;
  readonly loadReviewHarness?: typeof loadRuneProofPlatformReviewHarness;
  /** Optional persistence seam for deterministic tests; production omits it. */
  readonly progressStorage?: RuneProofStorage;
}
```

Remove `walkthroughReleaseFor` and the synthesized `PUBLIC => APPROVED` fallback. Every selected route must carry an exact `RuneProofPackRelease` derived from its loaded summary:

```ts
const releaseForSummary = (
  summary: RuneProofCatalogueSummary,
): RuneProofPackRelease | undefined => {
  if (
    summary.packDisposition !== 'RELEASED'
    || summary.packRevision === undefined
    || summary.lifecycle === undefined
  ) return undefined;
  return {
    questId: summary.questId,
    packRevision: summary.packRevision,
    catalogueRevision: summary.catalogueRevision,
    lifecycle: summary.lifecycle,
  };
};
```

- [ ] **Step 4: Replace full-strategy catalogue state with headers and selected pack state**

```ts
const {
  availability,
  chunkDataVersion,
  contentService,
  analyze,
  progressStorage,
  loadCatalogue: injectedLoadCatalogue,
  loadPack: injectedLoadPack,
  loadReviewHarness: injectedLoadReviewHarness,
} = runeProofIntegration;
const loadCatalogue = injectedLoadCatalogue ?? loadRuneProofCatalogue;
const loadPack = injectedLoadPack ?? loadRuneProofPackFor;
const loadReviewHarness = injectedLoadReviewHarness
  ?? loadRuneProofPlatformReviewHarness;
const serviceToken = useMemo(() => Object.freeze({
  loadCatalogue,
  loadPack,
  loadReviewHarness,
  analyze,
  contentService,
}), [loadCatalogue, loadPack, loadReviewHarness, analyze, contentService]);

interface RuneProofLoadedQuestWorkspace {
  readonly requestKey: string;
  readonly serviceToken: typeof serviceToken;
  readonly loaded: RuneProofLoadedPack;
  readonly routeAnalysis?: RuneProofRouteAnalysis;
}

const [runeProofSummaries, setRuneProofSummaries] =
  useState<readonly RuneProofCatalogueSummary[]>([]);
const [questWorkspace, setQuestWorkspace] =
  useState<RuneProofLoadedQuestWorkspace>();
const [reviewWorkspace, setReviewWorkspace] = useState<Readonly<{
  harness: RuneProofPlatformReviewHarness;
  scenarioId: RuneProofPlatformReviewScenario['id'];
}>>();
const latestRequestKey = useRef<string>();
const cachedQuestWorkspace = useRef<RuneProofLoadedQuestWorkspace>();
const reviewStorage = useMemo<RuneProofStorage>(
  () => createEphemeralRuneProofStorage(),
  [],
);

const requirementSnapshot = useMemo(
  () => preflightSnapshot(unlocks, gameModeId),
  [unlocks, gameModeId],
);
const questProgress = useRuneProofProgress(
  runId,
  questWorkspace ? [questWorkspace.loaded.pack] : [],
  questWorkspace?.loaded.pack.questId,
  progressStorage,
);
const preflight = useMemo(() => preflightRuneProofObjectives({
  summaries: runeProofSummaries,
  snapshot: requirementSnapshot,
  progressIndex: questProgress.index,
}), [runeProofSummaries, requirementSnapshot, questProgress.index]);
const recommendations = useMemo(
  () => rankRuneProofObjectives(preflight.candidates),
  [preflight.candidates],
);
const candidateByQuestId = useMemo(
  () => new Map(preflight.candidates.map(candidate => [candidate.questId, candidate])),
  [preflight.candidates],
);
const catalogueRows = useMemo(
  () => runeProofSummaries.map(summary => ({
    ...summary,
    proofState: candidateByQuestId.get(summary.questId)?.proofState ?? 'NEEDS_REVIEW',
  })),
  [candidateByQuestId, runeProofSummaries],
);
const selectedCandidate = selectedSummary
  ? candidateByQuestId.get(selectedSummary.questId)
  : undefined;
const selectedLoadEligible = selectedCandidate !== undefined
  && selectedCandidate.proofState !== 'NEEDS_REVIEW';
const selectedRelease = useMemo(
  () => selectedSummary && selectedLoadEligible
    ? releaseForSummary(selectedSummary)
    : undefined,
  [
    selectedLoadEligible,
    selectedSummary?.catalogueRevision,
    selectedSummary?.lifecycle,
    selectedSummary?.packDisposition,
    selectedSummary?.packRevision,
    selectedSummary?.questId,
  ],
);
const desiredRequestKey = selectedRelease
  ? JSON.stringify([
      availability,
      selectedRelease.questId,
      selectedRelease.packRevision,
      selectedRelease.catalogueRevision,
      selectedRelease.lifecycle,
      runeProofAccountIdentity,
      chunkDataVersion,
    ])
  : undefined;
const currentQuestWorkspace = questWorkspace?.requestKey === desiredRequestKey
  && questWorkspace.serviceToken === serviceToken
  ? questWorkspace
  : undefined;
const reviewScenario = reviewWorkspace?.harness.scenarios.find(
  scenario => scenario.id === reviewWorkspace.scenarioId,
);
const reviewProgress = useRuneProofProgress(
  'runeproof-platform-review',
  reviewScenario ? [reviewScenario.pack] : [],
  reviewScenario?.pack.questId,
  reviewStorage,
);
const activeWorkspace = reviewScenario
  ? { kind: 'HARNESS' as const, scenario: reviewScenario }
  : currentQuestWorkspace
    ? { kind: 'QUEST' as const, workspace: currentQuestWorkspace }
    : undefined;
const activeProgress = activeWorkspace?.kind === 'HARNESS'
  ? reviewProgress
  : questProgress;
```

`createEphemeralRuneProofStorage` is a module-private in-memory implementation of the same `RuneProofStorage` interface. The harness therefore exercises the production hook, transaction, branch, and coach paths under the fixed synthetic run ID, but none of its five non-catalogue records can enter the real run's compact index or durable storage. `questProgress.index` remains the one real catalogue index.

State and effect rules:

- Catalogue load imports only summaries; it does not import or inspect actions.
- Search/filter/ranking reads `catalogueRows` and one compact index; account-specific proof state comes from the preflight candidate, not a lifecycle guess.
- Auto-selection may choose the first recommendation only when query is empty; it triggers exactly one pack load.
- Selecting a playable row increments the existing request generation, loads its exact release, then performs one legacy deep analysis when `legacyProjection` exists.
- Selecting a no-pack/rejected/`NEEDS_REVIEW` row cancels RuneProof loading and leaves ordinary Goal Planner available without inventing a lifecycle.
- A stale load/analyze result never renders after selection, account, catalogue revision, lifecycle, pack-revision, or injected service-identity changes.
- Changing filters, search, progress, or branch selection does not rerun deep route analysis when quest ID, exact catalogue revision, lifecycle, pack revision, account identity, and chunk-data version are unchanged.
- Remove `useRuneProofPreviewActions` and `useRuneProofPreviewChecks` from Goal Planner; keep their modules only for Task 9 migration.

Use one cancellable effect keyed only by the complete selected exact release identity (quest ID, catalogue revision, lifecycle, and pack revision), account identity, chunk-data version, availability, and injected services. The implementation shape is:

```ts
const reviewMode = reviewWorkspace !== undefined;

useEffect(() => {
  if (reviewMode) return;
  const release = selectedRelease;
  const requestKey = desiredRequestKey;
  if (!release || !requestKey) {
    latestRequestKey.current = 'no-selected-release';
    setQuestWorkspace(undefined);
    setRuneProofUnavailable(false);
    return;
  }

  latestRequestKey.current = requestKey;
  if (cachedQuestWorkspace.current?.requestKey === requestKey
    && cachedQuestWorkspace.current.serviceToken === serviceToken) {
    setQuestWorkspace(cachedQuestWorkspace.current);
    setRuneProofUnavailable(false);
    return;
  }
  setQuestWorkspace(undefined);
  setRuneProofUnavailable(false);
  let active = true;

  void (async () => {
    const loaded = await loadPack(availability, release);
    if (!active || latestRequestKey.current !== requestKey) return;
    if (!loaded) throw new Error('Exact RuneProof pack is unavailable.');

    const routeAnalysis = loaded.legacyProjection
      ? await contentService.init().then(initialized => {
          if (!initialized) throw new Error('RuneProof content service unavailable.');
          const snapshot = materializeQuestRouteSnapshot(
            loaded.pack.questId,
            runeProofAccount,
            contentService,
            chunkDataVersion,
            loaded.legacyProjection.walkthrough,
            loaded.legacyProjection.reviewedRequirements,
          );
          return analyze(
            loaded.pack.questId,
            snapshot,
            loaded.legacyProjection.walkthrough,
          );
        })
      : undefined;
    if (!active || latestRequestKey.current !== requestKey) return;
    const nextWorkspace = { requestKey, serviceToken, loaded, routeAnalysis } as const;
    cachedQuestWorkspace.current = nextWorkspace;
    setQuestWorkspace(nextWorkspace);
    setRuneProofUnavailable(false);
  })().catch(() => {
    if (!active || latestRequestKey.current !== requestKey) return;
    setQuestWorkspace(undefined);
    if (cachedQuestWorkspace.current?.requestKey === requestKey
      && cachedQuestWorkspace.current.serviceToken === serviceToken) {
      cachedQuestWorkspace.current = undefined;
    }
    setRuneProofUnavailable(true);
  });

  return () => {
    active = false;
  };
}, [
  runeProofAccountIdentity,
  analyze,
  availability,
  chunkDataVersion,
  contentService,
  desiredRequestKey,
  loadPack,
  runeProofAccount,
  reviewMode,
  selectedRelease,
  serviceToken,
]);
```

Catch load, initialization, and analysis failures inside the effect, recheck the same request key, then clear selected RuneProof state and expose the existing unavailable/fallback UI. Render quest coaching only from `currentQuestWorkspace`, whose stored key and service-token identity must already equal the render-time values; effect-time clearing is only cleanup and is never the stale-render guard. Thus a selection, account, revision, or injected-service change suppresses the old coach in the same render, before the effect runs. Memoize the default integration object, selected exact release, canonical `runeProofAccountIdentity`, account snapshot, desired key, and injected loader functions so search/filter/progress renders do not restart the effect. The destructure above is the only source of bare integration names and makes every optional loader callable through its production default.

- [ ] **Step 5: Project the selected coach and wire only V2 callbacks**

```tsx
const coachModel = activeWorkspace && activeProgress.selectedProgress
  ? buildRuneProofPackCoachModel({
      pack: activeWorkspace.kind === 'HARNESS'
        ? activeWorkspace.scenario.pack
        : activeWorkspace.workspace.loaded.pack,
      progress: activeProgress.selectedProgress,
      requirementSnapshot: activeWorkspace.kind === 'HARNESS'
        ? activeWorkspace.scenario.snapshot
        : requirementSnapshot,
      completedQuestIds: activeWorkspace.kind === 'HARNESS'
        ? new Set(activeWorkspace.scenario.completedQuestIds)
        : new Set(unlocks.quests),
      legacyProjection: activeWorkspace.kind === 'QUEST'
        && activeWorkspace.workspace.loaded.legacyProjection
        && activeWorkspace.workspace.routeAnalysis
        ? {
            strategy: activeWorkspace.workspace.loaded.legacyProjection.strategy,
            analysis: activeWorkspace.workspace.routeAnalysis,
            connectGraph,
          }
        : undefined,
    })
  : undefined;

{coachModel && (
  <RuneProofCoach
    variant="PACK"
    model={coachModel}
    onSetCompletion={(target, confirmed) => {
      if (target.kind === 'ITEM') {
        activeProgress.setItemConfirmed(target.id, confirmed);
      } else if (target.kind === 'MANUAL') {
        activeProgress.setManualConfirmed(target.id, confirmed);
      } else if (target.kind === 'CHECKPOINT') {
        activeProgress.setCheckpointConfirmed(target.id, confirmed);
      } else {
        activeProgress.setActionConfirmed(target.id, confirmed);
      }
    }}
    onSelectBranch={(branchId) => activeProgress.selectBranch(
      branchId,
      Object.fromEntries(coachModel.branch.options.map(option => [
        option.id,
        {
          state: option.state,
          evidenceComplete: option.evidenceComplete,
        },
      ])),
    )}
    onSetItemConfirmed={activeProgress.setItemConfirmed}
    onSetManualConfirmed={activeProgress.setManualConfirmed}
  />
)}
```

No callback may call GameContext dispatch. Keep temporary map opening, close behavior, focus return, request cancellation, and background scroll lock.

- [ ] **Step 6: Add the private platform-review workspace**

Show `Review branch and combat controls` based only on `availability === 'PREVIEW'`; do not call the loader to decide whether the button exists. On activation, set `latestRequestKey.current = 'platform-review'` before awaiting anything, call the harness loader once, validate the exact marker and all five scenario IDs, then open the first scenario. Scenario controls switch the active `scenarioId` without loading a quest or running legacy deep analysis. Derive the review hook's pack/quest ID and coach snapshot/completed IDs from the active scenario, as shown above, so a previously loaded golden pack cannot steal harness progress.

Render every scenario through the same progress hook, pack coach, branch selector, combat card, generic alternative/location surfaces, temporary map, and proof drawer. Label the workspace `Platform review harness — not a quest`; exclude it from search results, recommendations, counts, manifests, and coverage. A close button clears `reviewWorkspace` and restores the previously cached quest pack/analysis and focus without another load/analyze when its exact request key is still current. Account/revision changes invalidate that cache normally.

Add tests:

```tsx
it('reviews branch/combat controls privately without canonical mutation or reanalysis', async () => {
  const before = structuredClone(gameSnapshot);
  const durableStorage = instrumentedStorage();
  const beforeEntries = [...durableStorage.values.entries()]
    .sort(([left], [right]) => left.localeCompare(right));
  const analyze = vi.fn();
  const loadPack = vi.fn();
  const loadReviewHarness = vi.fn(async () => platformReviewHarness);
  renderGoalPlanner({
    availability: 'PREVIEW',
    loadCatalogue: vi.fn(async () => makeCatalogueSummaries(210, {
      playableQuestIds: new Set(),
    })),
    loadReviewHarness,
    loadPack,
    analyze,
    progressStorage: durableStorage,
  });
  expect(loadReviewHarness).not.toHaveBeenCalled();
  await userEvent.click(await screen.findByRole('button', {
    name: 'Review branch and combat controls',
  }));
  expect(loadReviewHarness).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('tab', { name: 'Ready scenario' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Use Remote route' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Confirm scenario' }));
  await userEvent.click(screen.getByRole('checkbox', {
    name: /I am ready to follow this reviewed guide/i,
  }));
  expect(loadPack).not.toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
  expect([...durableStorage.values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))).toEqual(beforeEntries);
  expect(gameSnapshot).toEqual(before);
});

it('reviews all five harness states and returns to the cached quest', async () => {
  const { loadPack, analyze } = renderLoadedGoldenThenHarness();
  for (const label of ['Ready', 'Confirm', 'Blocked', 'Needs review', 'Complete']) {
    await userEvent.click(screen.getByRole('tab', { name: label + ' scenario' }));
    expect(screen.getByRole('status', { name: 'RuneProof state' }))
      .toHaveTextContent(label);
  }
  expect(screen.getByText(/instance entrance/i)).toBeInTheDocument();
  expect(screen.getByText(/plane 1/i)).toBeInTheDocument();
  expect(screen.getByText(/reviewed alternative/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Close platform review' }));
  expect(loadPack).toHaveBeenCalledTimes(1);
  expect(analyze).toHaveBeenCalledTimes(1);
});

it('never exposes the platform harness in public mode', async () => {
  const loadReviewHarness = vi.fn();
  renderGoalPlanner({ availability: 'PUBLIC', loadReviewHarness });
  expect(screen.queryByRole('button', {
    name: 'Review branch and combat controls',
  })).not.toBeInTheDocument();
  expect(loadReviewHarness).not.toHaveBeenCalled();
});
```

- [ ] **Step 7: Preserve public scope and explicit recommendation limits**

Add/retain assertions:

- PUBLIC renders exactly the five current quest IDs and no private lifecycle/review/harness marker.
- PREVIEW reports 210 identities, 191/19 kinds, and 23/187 membership counts.
- Recommendations contain at most three entries and never a `NEEDS_REVIEW` objective.
- Expanding audit metadata does not load a pack; only `Open reviewed route` does.
- Branch switching writes one V2 quest record, does not reload the pack, does not rerun deep analysis, retains shared progress, and reactivates returning-branch progress.
- Completing every guide action changes isolated RuneProof state only; before/after canonical unlocks, Keys, Fate, rewards, history, export/sync, and integrity fixtures remain equal.

Extend `components/Dashboard.runeproof.test.tsx` with a full-boundary isolation test, not only the partial `gameSnapshot` assertion above. Its hoisted `useGame` mock starts from a complete nonempty clone of `initialState` with keys, special/chaos keys, Fate, unlocks, rewards/progress fields, history hashes, run identity/revision, loadout, linked account, and integrity-relevant history populated. Replace every `GameContextType` mutator with a named spy. Resolve the exact selected quest's `runeProofProgressStorageKey`, the run's `runeProofProgressIndexStorageKey`, and its `runeProofProgressTransactionStorageKey`; snapshot sorted `[key,value]` entries for every other storage key. Open the real RuneProof modal from Dashboard; confirm an `ACTION`, `ITEM`, generic manual requirement, combat acknowledgement, and branch switch; then assert:

- the complete canonical game-state projection is byte-equal before/after;
- every game mutation, reward, Key/Fate, completion, import/export, backup, profile/sync, and integrity-affecting spy has zero calls;
- every unrelated storage `[key,value]` entry is byte-equal; the exact quest record and exact run index changed as expected; the transaction key is absent after the verified commit; and no other RuneProof or canonical key changed; and
- closing/reopening the modal restores the isolated confirmations without changing the canonical projection.

Keep the existing callback-only unit assertions too; the Dashboard test is the evidence boundary for Task 16's broader canonical-state claim.

- [ ] **Step 8: Run Goal Planner integration and golden suites**

Run:

```bash
npx vitest run utils/questRoutes/analyzeQuest.test.ts utils/questRoutes/goalPlannerRuneProof.test.ts components/GoalPlannerModal.runeproof.test.tsx components/Dashboard.runeproof.test.tsx components/questStrategies/RuneProofCoach.test.tsx hooks/useRuneProofProgress.test.tsx
npm run typecheck
```

Expected: all commands exit 0; action-free interactions cause zero pack loads/analyses, and each selected golden pack causes exactly one of each.

- [ ] **Step 9: Commit selected-only integration**

```bash
git add utils/questRoutes/analyzeQuest.ts utils/questRoutes/analyzeQuest.test.ts utils/questRoutes/goalPlannerRuneProof.ts utils/questRoutes/goalPlannerRuneProof.test.ts components/GoalPlannerModal.tsx components/GoalPlannerModal.runeproof.test.tsx components/Dashboard.runeproof.test.tsx data/questWalkthroughLoader.ts
git commit -m "feat: integrate RuneProof catalogue lazily"
```

---

### Task 14: Generate a Truthful 210-Row Coverage Matrix

**Files:**
- Create: `data/sources/runeproof-pack-validation.json`
- Create: `scripts/runeproof-coverage.mjs`
- Create: `scripts/runeproof-coverage.types.ts`
- Create: `scripts/runeproof-coverage.test.ts`
- Create: `data/sources/runeproof-coverage.json`
- Modify: `package.json`
- Modify: `scripts/player-facing-changelog.test.ts`
- Modify: `scripts/runeproof-source-encoding.test.ts`
- Modify: `docs/CONTENT_SYNC.md`

**Interfaces:**
- Consumes: the generated catalogue, exact compiler-validation records, and exact preview/public JSON manifests.
- Produces: `generateRuneProofCoverage(input): RuneProofCoverageSnapshot`, deterministic sync/check commands, and optional `--require-complete` final-programme enforcement.

- [ ] **Step 1: Write failing per-row coverage tests**

```ts
import { describe, expect, it } from 'vitest';
import catalogue from '../data/sources/runeproof-quest-catalogue.json';
import validation from '../data/sources/runeproof-pack-validation.json';
import preview from '../data/sources/runeproof-pack-releases.preview.json';
import publicReleases from '../data/sources/runeproof-pack-releases.public.json';
import {
  assertRuneProofCoverageComplete,
  COVERAGE_DIMENSIONS,
  generateRuneProofCoverage,
} from './runeproof-coverage.mjs';

describe('RuneProof coverage', () => {
  it('derives all aggregate counts from exactly 210 rows', () => {
    const snapshot = generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases,
    });
    expect(snapshot.rows).toHaveLength(210);
    expect(new Set(snapshot.rows.map(row => row.questId)).size).toBe(210);
    expect(snapshot.rows.every(row =>
      Object.keys(row.dimensions).sort().join(',')
        === [...COVERAGE_DIMENSIONS].sort().join(','))).toBe(true);
    expect(snapshot.summary).toEqual(recomputeCoverageSummary(snapshot.rows));
    expect(snapshot.summary.compilerValidPacks).toBe(5);
    expect(snapshot.summary.previewApprovedPacks).toBe(5);
    expect(snapshot.summary.publicApprovedPacks).toBe(5);
  });

  it('does not turn absent packs into false not-required claims', () => {
    const snapshot = generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases,
    });
    const absent = snapshot.rows.find(row => row.questId === "Daddy's Home")!;
    expect(absent.dimensions.coreRoute).toMatchObject({
      applicability: 'REQUIRED',
      modelled: false,
      validated: false,
    });
    for (const dimension of ['transport', 'instances', 'branches', 'combatManual']) {
      expect(absent.dimensions[dimension].applicability).toBe('NEEDS_REVIEW');
    }
  });

  it('keeps unresolved requirements visibly under review', () => {
    const snapshot = generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases,
    });
    for (const questId of ['Bear Your Soul', 'Desert Treasure I', 'The Enchanted Key']) {
      expect(snapshot.rows.find(row => row.questId === questId)?.dimensions.preflight)
        .toMatchObject({
          applicability: 'NEEDS_REVIEW',
          validated: false,
        });
    }
  });

  it('rejects stale manifest or validation revisions', () => {
    const changed = structuredClone(publicReleases);
    changed.entries[0].packRevision = 'stale';
    expect(() => generateRuneProofCoverage({
      catalogue,
      validation,
      preview,
      publicReleases: changed,
    })).toThrow(/stale pack revision/);
  });

  it.each([
    ['validation catalogue revision', (changed: any) => {
      changed.validation.catalogueRevision = 'stale-catalogue';
    }],
    ['validation pack revision', (changed: any) => {
      changed.validation.packs[0].packRevision = 'stale-pack';
    }],
  ])('rejects stale %s', (_label, mutate) => {
    const changed = {
      catalogue: structuredClone(catalogue),
      validation: structuredClone(validation),
      preview: structuredClone(preview),
      publicReleases: structuredClone(publicReleases),
    };
    mutate(changed);
    expect(() => generateRuneProofCoverage(changed)).toThrow(/stale/i);
  });

  it.each([
    ['VALIDATED', { applicability: 'REQUIRED', modelled: true, validated: true }],
    ['NOT_REQUIRED', { applicability: 'NOT_REQUIRED', modelled: true, validated: true }],
    ['NEEDS_REVIEW', { applicability: 'NEEDS_REVIEW', modelled: false, validated: false }],
  ] as const)('maps %s to one exact coverage cell', (disposition, expected) => {
    const snapshot = generateRuneProofCoverage(
      coverageInputForDisposition('transport', disposition),
    );
    expect(snapshot.rows[0].dimensions.transport).toMatchObject(expected);
  });

  it('rejects final-programme enforcement while any dimension needs review', () => {
    const completeLooking = makeSyntheticCompleteCoverageInput(210);
    completeLooking.validation.packs[0].semanticDisposition.transport = 'NEEDS_REVIEW';
    const snapshot = generateRuneProofCoverage(completeLooking);
    expect(snapshot.summary.compilerValidPacks).toBe(210);
    expect(() => assertRuneProofCoverageComplete(snapshot))
      .toThrow(/transport.*NEEDS_REVIEW/i);
  });
});
```

Implement `recomputeCoverageSummary` in the test as a direct reduction over rows; do not import the production summary helper into this assertion.

- [ ] **Step 2: Run coverage tests and confirm missing files**

Run:

```bash
npx vitest run scripts/runeproof-coverage.test.ts
```

Expected: FAIL because the coverage module and validation snapshot do not exist.

- [ ] **Step 3: Create and verify exact five-pack validation records**

Declare this exact schema in `scripts/runeproof-coverage.types.ts` and use it to validate the JSON:

```ts
interface RuneProofPackValidationSnapshot {
  readonly schemaVersion: 1;
  readonly catalogueRevision: string;
  readonly packs: readonly {
    readonly questId: string;
    readonly packRevision: string;
    readonly blockingFindingIds: readonly string[];
    readonly findingDimensions: Readonly<Record<
      string,
      readonly RuneProofCoverageDimensionId[]
    >>;
    readonly semanticDisposition: Readonly<Record<
      Exclude<RuneProofCoverageDimensionId, 'identity'>,
      'VALIDATED' | 'NOT_REQUIRED' | 'NEEDS_REVIEW'
    >>;
  }[];
}
```

Write the generated catalogue's literal revision into the JSON at execution time and add these five literal pack revisions:

```js
const PUBLIC_PACK_REVISIONS = Object.freeze({
  "Cook's Assistant": 'runeproof-public-cooks-assistant-v1',
  'Sheep Shearer': 'runeproof-public-sheep-shearer-v1',
  'The Restless Ghost': 'runeproof-public-the-restless-ghost-v1',
  'Rune Mysteries': 'runeproof-public-rune-mysteries-v1',
  'Imp Catcher': 'runeproof-public-imp-catcher-v1',
});
```

These are the independently authored public definition revisions from `data/questWalkthroughPublicRelease.ts`, which Task 7 carries into each adapted pack. Do not substitute the generated private SHA revisions in `data/questWalkthroughRelease.ts`.

For each record set preflight, core route, locations, items, combat/manual, evidence, progress migration, and completion to `VALIDATED`; the legacy packs exercise manual action confirmation even though they have no subjective combat card. Set transport, instances, and branches to `NOT_REQUIRED` only after the independent compiled-pack check below confirms absence. In `scripts/runeproof-coverage.test.ts`, load each exact pack through the public loader and independently recompute its validation record from the compiled pack:

- blocking compiler findings must be empty;
- core route, locations, items, evidence, and completion must validate;
- `NOT_REQUIRED` is allowed only after inspecting the compiled pack and finding no transport, instance, second branch, or combat/manual requirement;
- progress migration is `VALIDATED` for the five V1-compatible packs;
- record and pack revisions must match exactly.

The committed validation record is evidence for coverage generation; the test above prevents it from becoming an unsupported assertion.

- [ ] **Step 4: Implement the tri-state matrix and implication invariants**

```js
export const COVERAGE_DIMENSIONS = Object.freeze([
  'identity',
  'preflight',
  'coreRoute',
  'locations',
  'transport',
  'instances',
  'items',
  'branches',
  'combatManual',
  'evidence',
  'progressMigration',
  'completion',
]);

export const COVERAGE_APPLICABILITY = Object.freeze([
  'REQUIRED',
  'NOT_REQUIRED',
  'NEEDS_REVIEW',
]);
```

Put the following type-only contract in `scripts/runeproof-coverage.types.ts`. Import it with `import type` in the TypeScript test; in `runeproof-coverage.mjs`, use JSDoc `import()` typedefs so the executable remains valid JavaScript:

```ts
export type RuneProofCoverageDimensionId =
  | 'identity' | 'preflight' | 'coreRoute' | 'locations'
  | 'transport' | 'instances' | 'items' | 'branches'
  | 'combatManual' | 'evidence' | 'progressMigration' | 'completion';

export type RuneProofCoverageDisposition =
  | 'VALIDATED' | 'NOT_REQUIRED' | 'NEEDS_REVIEW';

export interface RuneProofCoverageDimension {
  readonly applicability: 'REQUIRED' | 'NOT_REQUIRED' | 'NEEDS_REVIEW';
  readonly modelled: boolean;
  readonly validated: boolean;
  readonly previewApproved: boolean;
  readonly publicApproved: boolean;
  readonly findingIds: readonly string[];
}

export interface RuneProofCoverageRow {
  readonly questId: string;
  readonly slug: string;
  readonly kind: 'quest' | 'miniquest';
  readonly membership: 'F2P' | 'MEMBERS';
  readonly milestone: 1 | 2 | 3 | 4 | 5;
  readonly progressionPriority: number;
  readonly packRevision?: string;
  readonly compilerValid: boolean;
  readonly previewApproved: boolean;
  readonly publicApproved: boolean;
  readonly dimensions: Readonly<Record<
    RuneProofCoverageDimensionId,
    RuneProofCoverageDimension
  >>;
}

export interface RuneProofCoverageDimensionSummary {
  readonly required: number;
  readonly notRequired: number;
  readonly needsReview: number;
  readonly modelled: number;
  readonly validated: number;
  readonly previewApproved: number;
  readonly publicApproved: number;
  readonly findingCount: number;
}

export interface RuneProofCoverageSummary {
  readonly totalObjectives: number;
  readonly quests: number;
  readonly miniquests: number;
  readonly f2p: number;
  readonly members: number;
  readonly compilerValidPacks: number;
  readonly previewApprovedPacks: number;
  readonly publicApprovedPacks: number;
  readonly dimensions: Readonly<Record<
    RuneProofCoverageDimensionId,
    RuneProofCoverageDimensionSummary
  >>;
}

export interface RuneProofCoverageSnapshot {
  readonly schemaVersion: 1;
  readonly catalogueRevision: string;
  readonly rows: readonly RuneProofCoverageRow[];
  readonly summary: RuneProofCoverageSummary;
}
```

Generation rules:

- Derive rows by iterating catalogue entries; never accept aggregate counts as input.
- `identity` is required/modelled/validated for all 210.
- `preflight` is required/modelled/validated for entries with verified requirement status; unresolved entries use `NEEDS_REVIEW` and are not validated.
- Without an exact validation record, `coreRoute`, `locations`, `items`, `evidence`, and `completion` are required but unmodelled/unvalidated; conditional dimensions are `NEEDS_REVIEW`, never `NOT_REQUIRED`.
- With an exact record, map each inspected semantic disposition exactly: `VALIDATED` → `REQUIRED`, modelled and validated; `NOT_REQUIRED` → `NOT_REQUIRED`, modelled and validated because inspected absence is itself the model; `NEEDS_REVIEW` → `NEEDS_REVIEW`, neither modelled nor validated. No other combination is emitted.
- Approval booleans require the exact same catalogue and pack revisions in the relevant manifest.
- Enforce `publicApproved => previewApproved => validated => modelled`.
- A `NEEDS_REVIEW` dimension cannot be validated or approved.
- Recompute summary counts exclusively from rows.
- Require sorted unique `blockingFindingIds`; `findingDimensions` must have exactly those keys, each with one or more unique known dimensions. Copy a finding ID into every named cell, reject unallocated/unknown IDs or dimensions, and derive each dimension's `findingCount` from its row cells. A row is compiler-valid only when it has an exact pack-validation record and zero blocking findings.
- Include no wall-clock field; canonicalize object keys and line endings for deterministic output.
- `--require-complete` fails unless exactly 210 packs are compiler-valid, no cell in the 210-row matrix has `applicability:'NEEDS_REVIEW'`, and every `REQUIRED` cell is modelled and validated. Conditional transport, instance, branch, and combat/manual cells must therefore reach an inspected `REQUIRED`+validated or `NOT_REQUIRED` disposition; aggregate compiler-valid counts cannot mask an unresolved conditional cell. Export the same `assertRuneProofCoverageComplete(snapshot)` predicate used by the CLI so the regression test exercises the exact gate. Do not use that option at Milestone 1.

In the test file, implement `coverageInputForDisposition` as a one-row exact catalogue/validation/manifest fixture and `makeSyntheticCompleteCoverageInput(count)` as a dense `count`-row fixture with unique IDs/slugs/priorities, matching catalogue/pack revisions, zero blocking findings, `VALIDATED` for every intrinsically required dimension, and inspected `NOT_REQUIRED` for every absent conditional dimension. Neither helper may call the production generator or summary reducer.

- [ ] **Step 5: Add deterministic CLI and package gates**

```json
{
  "scripts": {
    "runeproof:coverage:sync": "node scripts/runeproof-coverage.mjs",
    "runeproof:coverage:verify": "node scripts/runeproof-coverage.mjs --check && vitest run scripts/runeproof-coverage.test.ts"
  }
}
```

Add `npm run runeproof:catalogue:verify && npm run runeproof:coverage:verify` to `content:verify`. Update the exact `content:verify` contract assertion in `scripts/player-facing-changelog.test.ts`.

Document in `docs/CONTENT_SYNC.md`:

```bash
npm run runeproof:catalogue:sync
npm run runeproof:catalogue:verify
npm run runeproof:coverage:sync
npm run runeproof:coverage:verify
```

Explain that catalogue sync reads only pinned local sources, coverage sync reports gaps rather than blessing them, and final 210-pack enforcement requires `node scripts/runeproof-coverage.mjs --check --require-complete`.

Extend `scripts/runeproof-source-encoding.test.ts` to scan `utils/questStrategies`, `components/questStrategies`, all new RuneProof source JSON, and the catalogue/coverage scripts for UTF-8/line-ending invariants.

- [ ] **Step 6: Generate and verify the Milestone 1 matrix**

Run:

```bash
npm run runeproof:coverage:sync
npm run runeproof:coverage:verify
npm run content:verify
```

Expected: all commands exit 0; the matrix has 210 rows, five compiler-valid/public packs, and 205 rows that truthfully retain pack gaps.

- [ ] **Step 7: Commit coverage reporting**

```bash
git add data/sources/runeproof-pack-validation.json scripts/runeproof-coverage.mjs scripts/runeproof-coverage.types.ts scripts/runeproof-coverage.test.ts data/sources/runeproof-coverage.json package.json scripts/player-facing-changelog.test.ts scripts/runeproof-source-encoding.test.ts docs/CONTENT_SYNC.md
git commit -m "feat: report RuneProof coverage per objective"
```

---

### Task 15: Enforce Work Budgets and Record Performance Baselines

**Files:**
- Create: `utils/questStrategies/performance.test.ts`
- Create: `scripts/runeproof-performance-benchmark.ts`
- Create: `vitest.runeproof-performance.config.ts`
- Create: `data/sources/runeproof-performance-budgets.json`
- Modify: `components/GoalPlannerModal.runeproof.test.tsx`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: 210 action-free summaries, pure filter/ranker/preflight functions, a synthetic high-action pack, an eight-branch pack, and V2 index serialization.
- Produces: deterministic blocking CI operation caps and an explicitly recorded, named reference-profile median/p95 baseline that is not enforced on unlike hosts.

- [ ] **Step 1: Write failing deterministic operation-cap tests**

```ts
import { describe, expect, it } from 'vitest';
import { preflightRuneProofObjectives, rankRuneProofObjectives } from './objectives';
import { readRuneProofProgressIndex } from './progress';
import { makeCatalogueSummaries, readyRequirementSnapshot } from './testFixtures';

describe('RuneProof deterministic performance gates', () => {
  it('preflights 210 headers with zero pack loads and deep analyses', () => {
    const result = preflightRuneProofObjectives({
      summaries: makeCatalogueSummaries(210),
      snapshot: readyRequirementSnapshot(),
      progressIndex: { schemaVersion: 2, runId: 'run-a', entries: {} },
    });
    expect(result.metrics).toEqual({
      headerEvaluations: 210,
      progressIndexLookups: 210,
      packLoads: 0,
      deepAnalyses: 0,
    });
    expect(rankRuneProofObjectives(result.candidates)).toHaveLength(3);
  });

  it('reads one compact index and zero quest records for catalogue ranking', () => {
    const storage = instrumentedProgressStorage();
    const result = readRuneProofProgressIndex(storage, 'run-a');
    expect(result.index.runId).toBe('run-a');
    expect(result.warnings).toEqual([]);
    expect(storage.indexReads).toBe(1);
    expect(storage.questRecordReads).toBe(0);
  });
});
```

Define `instrumentedProgressStorage` locally in `performance.test.ts` as a complete `RuneProofStorage` with explicit index/quest read counters; do not import a test-local Task 9 helper. Add integration assertions in `components/GoalPlannerModal.runeproof.test.tsx`, using its Task 13 fixture, that the first selected legacy pack totals one logical pack load/deep analysis, a second selected legacy pack totals two, and an in-pack branch switch adds zero pack loads, zero deep analyses, exactly one bounded 210-header preflight after the compact index changes, and one V2 record write. The Task 12 exact-result test covers filter correctness; do not use unattached loader/analyzer spies as a performance assertion.

- [ ] **Step 2: Run the operation tests and confirm fixture/instrumentation failures**

Run:

```bash
npx vitest run utils/questStrategies/performance.test.ts
```

Expected: FAIL until the operation counters, storage instrumentation, and action-free helper fixtures are exported.

- [ ] **Step 3: Expose deterministic counters without production side effects**

Keep counters as returned values from pure functions or injected test spies; do not add global mutable telemetry. Export Task 9's explicit `{ index, warnings }` `readRuneProofProgressIndex(storage, runId)` result and use the existing Goal Planner injected loader/analyzer contract for call counts.

Run:

```bash
npx vitest run utils/questStrategies/performance.test.ts components/GoalPlannerModal.runeproof.test.tsx
```

Expected: PASS with the exact caps from Step 1.

- [ ] **Step 4: Add an explicitly recorded reference-profile benchmark**

`scripts/runeproof-performance-benchmark.ts` measures these pure operations. Keeping the Node-only benchmark under the root TypeScript project's excluded `scripts/` tree allows `node:os` and `process` without leaking Node globals into `npm run typecheck`. `vitest.runeproof-performance.config.ts` extends the repository's normal Vitest configuration but includes only that benchmark file, so `npm test` never runs host-timing assertions:

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vite.config';

export default defineConfig(async (env) => {
  const resolvedBase = typeof baseConfig === 'function'
    ? await baseConfig(env)
    : await baseConfig;
  return mergeConfig(resolvedBase, {
    test: {
      include: ['scripts/runeproof-performance-benchmark.ts'],
    },
  });
});
```

The benchmark file measures:

- 210-entry preflight;
- combined search/filter;
- three-result recommendation rank;
- selected 100-action pack coach projection;
- branch switch on an eight-branch/160-action pack;
- compact 210-entry progress-index parse and serialize.

Measurement procedure:

```ts
const WARMUP_SAMPLES = 5;
const MEASURED_SAMPLES = 25;

const ceilingFor = (p95Milliseconds: number): number =>
  Math.max(5, Math.ceil((p95Milliseconds * 1.5) / 5) * 5);
```

Use `performance.now()`; run five unrecorded warmups, then 25 samples; sort samples numerically; median is sample 13 and p95 is sample 24. The command always validates operation results and prints median/p95 deltas against the committed reference. It asserts the p95 ceiling only when the current runtime profile exactly matches the committed profile and `RUNEPROOF_ENFORCE_REFERENCE_PROFILE=1`; unlike CI or developer hosts report `REFERENCE PROFILE NOT ENFORCED` and do not fail on wall time. When `RUNEPROOF_RECORD_REFERENCE_PROFILE=1`, write canonical JSON with:

```ts
interface RuneProofPerformanceBudgets {
  readonly schemaVersion: 1;
  readonly profiles: readonly Readonly<{
    id: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuModel: string;
    logicalCpuCount: number;
    warmups: 5;
    samples: 25;
    operations: Readonly<Record<string, {
      medianMilliseconds: number;
      p95Milliseconds: number;
      ceilingMilliseconds: number;
    }>>;
  }>[];
}
```

Derive hardware fields from `process.version`, `process.platform`, `process.arch`, and `node:os`. Profile IDs are human-reviewed labels, not hardware-match inputs. Require an explicit nonblank `RUNEPROOF_REFERENCE_PROFILE_ID` when recording; replace only that ID or append it, sort profiles by ID, require IDs and hardware signatures both unique, and preserve all other profiles. Measurement without an ID selects the sole exact hardware match and otherwise reports `REFERENCE PROFILE NOT ENFORCED`. Enforcement requires both `RUNEPROOF_ENFORCE_REFERENCE_PROFILE=1` and an explicit profile ID whose hardware fields exactly match; a missing/mismatched ID reports not enforced rather than comparing unlike hosts. Round recorded median/p95 values to three decimal places. Do not record a wall-clock timestamp. Re-record only through the explicit reviewed command. The deterministic caps remain the portable blocking gate; before Milestone 3 approval, add and separately approve representative `desktop` and `constrained-mobile` profiles in this same file as required by the design.

- [ ] **Step 5: Record once, then verify read-only**

Add:

```json
{
  "scripts": {
    "runeproof:performance:record": "RUNEPROOF_RECORD_REFERENCE_PROFILE=1 vitest run --config vitest.runeproof-performance.config.ts",
    "runeproof:performance:measure": "vitest run --config vitest.runeproof-performance.config.ts",
    "runeproof:performance:enforce-reference": "RUNEPROOF_ENFORCE_REFERENCE_PROFILE=1 vitest run --config vitest.runeproof-performance.config.ts",
    "runeproof:performance:verify": "vitest run utils/questStrategies/performance.test.ts",
    "runeproof:verify": "npm run runeproof:catalogue:verify && npm run runeproof:coverage:verify && npm run runeproof:performance:verify && vitest run data/runeProofPackRelease.test.ts data/questWalkthroughLoader.test.ts vite.config.runeproof-boundary.test.ts scripts/runeproof-public-bundle.test.ts"
  }
}
```

Run:

```bash
RUNEPROOF_REFERENCE_PROFILE_ID=milestone-1-local npm run runeproof:performance:record
RUNEPROOF_REFERENCE_PROFILE_ID=milestone-1-local npm run runeproof:performance:enforce-reference
npm run runeproof:performance:verify
npm run runeproof:performance:measure
npm run runeproof:verify
```

Expected: all commands exit 0; only the explicit record command changes the baseline JSON, deterministic verification is portable and blocking, and measurement reports whether the current machine matches the named reference without enforcing unlike-host wall time.

- [ ] **Step 6: Add the private build to pull-request CI without changing deployment**

After the normal build step in `.github/workflows/ci.yml`, add:

```yaml
      - name: Build RuneProof private preview
        run: npm run build:runeproof-preview
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
```

Do not modify `.github/workflows/deploy.yml`; deployment remains normal-build-only and is not invoked by this plan.

- [ ] **Step 7: Run performance and build gates**

Run:

```bash
npm run runeproof:verify
npm run build
npm run build:runeproof-preview
```

Expected: all commands exit 0; operation caps and recorded ceilings pass, and neither build changes source files.

- [ ] **Step 8: Commit performance gates**

```bash
git add utils/questStrategies/performance.test.ts scripts/runeproof-performance-benchmark.ts vitest.runeproof-performance.config.ts data/sources/runeproof-performance-budgets.json components/GoalPlannerModal.runeproof.test.tsx package.json .github/workflows/ci.yml
git commit -m "test: gate RuneProof catalogue performance"
```

---

### Task 16: Record the Milestone 1 Review and Stop at the Gate

**Files:**
- Create: `docs/testing/runeproof-all-quests-milestone-1-acceptance.md`

**Interfaces:**
- Consumes: exact committed catalogue/coverage/performance outputs, automated gates, normal/private builds, private review harness, and the existing Wave 1 acceptance record.
- Produces: a factual Milestone 1 evidence record with status `PENDING ALEX`; it grants no public release authority.

- [ ] **Step 1: Run focused RuneProof verification from a clean dependency install**

Run:

```bash
npm ci --no-audit --no-fund
npm run runeproof:verify
npx vitest run data/runeProofCanonicalAreas.test.ts data/runeProofQuestCatalogue.test.ts data/runeProofPackRelease.test.ts data/questWalkthroughLoader.test.ts utils/questRoutes/analyzeQuest.test.ts utils/questStrategies/packModel.test.ts utils/questStrategies/requirements.test.ts utils/questStrategies/preflight.test.ts utils/questStrategies/itemLedger.test.ts utils/questStrategies/branches.test.ts utils/questStrategies/packCompiler.test.ts utils/questStrategies/legacyPackAdapter.test.ts utils/questStrategies/progress.test.ts utils/questStrategies/objectives.test.ts utils/questStrategies/coach.test.ts hooks/useRuneProofProgress.test.tsx components/questStrategies/RuneProofCatalogueFilters.test.tsx components/questStrategies/RuneProofBranchSelector.test.tsx components/questStrategies/RuneProofCombatReadiness.test.tsx components/questStrategies/RuneProofInitialItems.test.tsx components/questStrategies/RuneProofManualConfirmations.test.tsx components/questStrategies/RuneProofCoach.test.tsx components/GoalPlannerModal.runeproof.test.tsx components/Dashboard.runeproof.test.tsx vite.config.runeproof-boundary.test.ts scripts/runeproof-public-bundle.test.ts
```

Expected: every command exits 0.

- [ ] **Step 2: Run every non-release project gate**

Run:

```bash
npm test
npm run typecheck
npm run content:verify
npm run build
npm run build:runeproof-preview
git diff --check
```

Expected: every command exits 0. Do not run or claim `npm run release:verify`: runtime changes under `data/`, `utils/`, `hooks/`, and `components/` intentionally trigger the player-facing changelog gate, while this programme has no authorization to publish a changelog, PR, merge, deployment, announcement, or new public pack.

- [ ] **Step 3: Verify generated outputs are stable and truthful**

Run:

```bash
npm run runeproof:catalogue:verify
npm run runeproof:coverage:verify
npm run runeproof:performance:verify
npm run runeproof:performance:measure
git diff --exit-code -- data/sources/runeproof-quest-catalogue.json data/sources/runeproof-coverage.json data/sources/runeproof-performance-budgets.json
```

Expected:

- 210 entries: 191 quests, 19 miniquests.
- 23 F2P and 187 members.
- Milestones 1–5: 5, 18, 91, 62, 34.
- Five compiler-valid/preview/public exact packs; 205 entries retain honest pack gaps.
- Three unresolved audits remain `NEEDS_REVIEW` and in Milestone 5.
- No command rewrites a generated source file.

- [ ] **Step 4: Serve and review both exact built artifacts**

Serve the already-built private and normal outputs on strict separate ports:

```bash
npx vite preview --outDir dist-runeproof-preview --host 0.0.0.0 --port 4175 --strictPort
npx vite preview --outDir dist --host 0.0.0.0 --port 4176 --strictPort
```

Run the two long-lived commands in separate terminals. Using `vercel:agent-browser-verify` at execution time, review `http://127.0.0.1:4175/` and `http://127.0.0.1:4176/` at 1440×900 and 390×844. Record the reviewed commit and URLs:

1. 210 catalogue count, search, every filter, reset, and three recommendation cap.
2. Ready, confirm, blocked, needs-review, and complete examples.
3. One concrete `Do now` card and ordered route hierarchy.
4. Private `Platform review harness — not a quest`: recommendation reason, branch pinning, deliberate switch, retained shared progress, inactive incompatible progress, and return reactivation.
5. Combat-readiness sections, exact acknowledgement copy, confirm/unconfirm, and absence of impossible-capability claims.
6. Blocker/unblock copy and reviewed alternatives.
7. Entrance/chunk/plane/instance context and temporary map close returning to the same coach state.
8. Reload and run isolation: a golden pack restores only within its run; the review harness intentionally resets on full reload and never writes durable/run-index state.
9. Proof/source disclosures and maintainer diagnostics.
10. Keyboard order, focus after branch/map close, background scroll lock, mobile width, and reachable controls.
11. Canonical run snapshot before/after all confirmations: unlocks, Journal quests, Keys, Fate, rewards, history, export/sync, and integrity data unchanged.
12. Normal artifact on port 4176: exactly five existing guides, no 210-row private audit view, no review harness, and no private marker.

Stop both servers after review.

- [ ] **Step 5: Write the factual acceptance record**

Capture the two dynamic identities first:

```bash
git rev-parse HEAD
jq -r '.catalogueRevision' data/sources/runeproof-quest-catalogue.json
```

Create the document with the literal outputs from those commands and these fixed sections:

```markdown
# RuneProof All Quests — Milestone 1 Acceptance

**Milestone state:** PENDING ALEX
**Public promotion:** NOT AUTHORIZED
**Next milestone:** BLOCKED UNTIL EXPLICIT APPROVAL

## Build identity

- Branch: feature/runeproof-all-quests
- Review date: 2026-08-22

## Scope evidence

- Catalogue: 210
- Quests / miniquests: 191 / 19
- F2P / members: 23 / 187
- Milestones 1 / 2 / 3 / 4 / 5: 5 / 18 / 91 / 62 / 34
- Compiler-valid packs: 5
- Public packs: Cook's Assistant; Sheep Shearer; The Restless Ghost; Rune Mysteries; Imp Catcher
- Unresolved requirement audits: Bear Your Soul; Desert Treasure I; The Enchanted Key

## Automated evidence

Record every Step 1–3 command, exit code 0, and concise result.

## Desktop review — 1440×900

Record SUPPORTING PASS — ALEX PENDING plus observed evidence for each Step 4 scenario.

## Mobile review — 390×844

Record SUPPORTING PASS — ALEX PENDING plus observed evidence for each Step 4 scenario.

## Canonical-state isolation

Record the literal before/after snapshot comparison and PASS.

## Bundle isolation

Record the normal/preview marker scan and PASS.

## Governance

- The five currently public packs remain the only public payloads.
- The earlier Wave 1 local production checklist still says PENDING ALEX despite already-merged public configuration; that conflict must be reconciled before any future promotion.
- release:verify, changelog publication, PR, merge, deployment, announcement, and new public pack promotion were not authorized or performed.
- Milestone approval allows Milestone 2 planning/execution only; it does not authorize public promotion.

## Required reviewer decision

- [ ] Alex approves Milestone 1 and authorizes Milestone 2 to begin.
```

Immediately below `Branch`, add `Commit reviewed` and `Catalogue revision` bullets containing the two captured literal values. If any automated or visual row fails, stop Task 16 before the commit, record the failure accurately in the working document, and return to the relevant implementation task. The review-request commit is created only when every automated row says `PASS` and every agent-assisted visual row says `SUPPORTING PASS — ALEX PENDING`; Alex's checkbox remains unchecked and the milestone visual review is not described as complete.

- [ ] **Step 6: Confirm the plan did not alter release surfaces**

Run:

```bash
git diff --name-only main...HEAD
git status --short
```

Expected:

- `data/changelog.ts` is absent.
- `.github/workflows/deploy.yml` is absent.
- No generated deployment directory is staged.
- Only the five existing exact public revisions appear in the public release snapshot.

- [ ] **Step 7: Commit the pending review record**

```bash
git add docs/testing/runeproof-all-quests-milestone-1-acceptance.md
git commit -m "docs: record RuneProof milestone 1 review"
```

- [ ] **Step 8: Stop and request the major milestone decision**

Report:

- automated gate outcome;
- desktop/mobile review outcome;
- catalogue and coverage counts;
- five golden regressions;
- normal/private bundle isolation;
- canonical-state isolation;
- the unresolved Wave 1 governance conflict; and
- the exact acceptance-document path.

Do not begin Milestone 2, change `data/changelog.ts`, open a PR, push, merge, deploy, announce, or promote any pack until the user explicitly approves the Milestone 1 review and separately authorizes any release action.

---

## Programme Continuation After This Plan

After explicit Milestone 1 approval:

1. Write a separate Milestone 2 implementation plan for the remaining 18 F2P objectives, reaching 23/23 private reviewed F2P packs.
2. Review the committed complexity overrides and freeze the exact 91-entry Milestone 3 roster before members authoring.
3. Write separate Milestone 3, 4, and 5 implementation plans against their frozen 91/62/34 rosters and stop at each major review gate.
4. Keep every new pack private unless an exact revision receives separate `PUBLIC_APPROVED` authorization.
