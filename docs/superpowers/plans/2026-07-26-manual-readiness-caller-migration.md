# Manual Readiness Caller Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every automatic journal, goal-planning, and chunk-doability surface respect canonical manual readiness while preserving raw `AVAILABLE` status on interactive catalogue surfaces.

**Architecture:** Canonical eligibility remains owned by `utils/journalStatus.ts`. Automatic callers consume `eligible`, `manualChecks`, and `confirmable`; presentation helpers turn manual checks into the exact `Confirm: …` copy. QuestLog and the Chunk Activity catalogue keep raw status semantics, while recommendation/count/overview paths use full eligibility.

**Tech Stack:** React 18, TypeScript, Vitest, `react-dom/server`, Vite.

## Global Constraints

- Use `evaluateQuestEligibility(...).eligible` for automatic quest recommendations, counts, planner reachability, and Chunk Activity “Can-do / Locked” classification.
- Preserve `getQuestStatus(...) === 'AVAILABLE'` for QuestLog sorting/filtering/status display and for the Chunk Activity catalogue’s machine-compatibility status.
- Render every manual requirement as `Confirm: ${check}` and deduplicate repeated checks without changing their first-seen order.
- Keep completed quests and diary tiers separate from automatically eligible incomplete content.
- Prying Times must never be shown as ready while `One open Sailing task slot` is unconfirmed.
- Varrock Hard must never be shown as ready while `153 Varrock Museum Kudos` is unconfirmed.
- Make no quest, diary, activity, rate, pity, cap, balance, persisted-state, or content-data changes.
- Follow RED → GREEN → REFACTOR for every behavior change and record the failing and passing focused-test output in the task report.
- Run the existing QuestLog/manual-attestation regression tests without changing QuestLog source behavior.
- Never use Base64, `Invoke-Expression`, encoded or obfuscated commands, or dynamically constructed shell payloads.
- Do not modify or stage the pre-existing line-ending-only `utils/taskIdMigrations.ts` worktree change.

---

### Task 1: Journal Automatic Surfaces

**Files:**
- Modify: `utils/journalProgress.ts`
- Modify: `utils/journalProgress.test.ts`
- Modify: `components/JournalNextBest.tsx`
- Modify: `components/JournalNextBest.test.tsx`
- Modify: `components/JournalSummaryCard.tsx`
- Create: `components/JournalSummaryCard.test.tsx`
- Modify: `utils/questDoability.ts`

**Interfaces:**
- Consumes: `evaluateQuestEligibility(quest, unlocks, gameModeId): QuestEligibility` and `evaluateDiaryTaskEligibility(task, unlocks, gameModeId): DiaryTaskEligibility`.
- Produces: `Unmet.kind` extended with `'manual'`; `questUnmet(...)` and `diaryUnmet(...)` append deduplicated `{ kind: 'manual', label: 'Confirm: …' }` entries after machine blockers.
- Produces: exported `JournalQuestRecommendationAnalysis` and `analyzeJournalQuestRecommendations(allQuests, allDiaries, unlocks, gameModeId?)`, returning `{ available, candidates, best }`; both the Journal Summary available count and recommendation consume this same result.
- Preserves: `selectJournalNextBestActions(...)` keeps manual-pending items as close actions (`unmet === 1`) but never counts or styles them as ready (`unmet === 0`).

- [ ] **Step 1: Add failing manual-unmet regressions**

Add the real Prying Times case to `utils/journalProgress.test.ts`:

```ts
it('keeps Prying Times behind its manual Sailing confirmation', () => {
  expect(questUnmet(QUEST_DATA['Prying Times'], u({
    regions: ['The Open Seas'],
    quests: ['Pandemonium', "The Knight's Sword"],
    skills: { Smithing: 3, Sailing: 2 },
    levels: { Smithing: 30, Sailing: 12 },
  }))).toEqual([{
    kind: 'manual',
    label: 'Confirm: One open Sailing task slot',
  }]);
});
```

Add a `Varrock Hard` fixture where every other task in the tier is complete and `var_hard_2` is the only remaining task:

```ts
it('reports the remaining Varrock Kudos confirmation after machine gates pass', () => {
  const completedTasks = ALL_DIARY_TASKS
    .filter(task => task.tierId !== 'Varrock Hard' || task.id !== 'var_hard_2')
    .map(task => task.id);

  expect(diaryUnmet(DIARY_DATA['Varrock Hard'], u({
    regions: ['Varrock'],
    completedTasks,
  }))).toEqual([{
    kind: 'manual',
    label: 'Confirm: 153 Varrock Museum Kudos',
  }]);
});
```

- [ ] **Step 2: Run the journal-progress tests and verify RED**

Run:

```powershell
npm test -- utils/journalProgress.test.ts
```

Expected: FAIL because `Unmet.kind` does not accept `manual`, `questUnmet` returns `[]` for Prying Times, and `diaryUnmet` omits the Kudos check.

- [ ] **Step 3: Add manual checks to the shared unmet model**

In `utils/journalProgress.ts`, import `ALL_DIARY_TASKS` and `evaluateDiaryTaskEligibility`. Extend the type and use one order-preserving helper:

```ts
export interface Unmet {
  kind: 'region' | 'skill' | 'quest' | 'qp' | 'alternative' | 'manual';
  label: string;
}

const manualChecksToUnmet = (checks: readonly string[]): Unmet[] =>
  [...new Set(checks)].map(label => ({
    kind: 'manual',
    label: `Confirm: ${label}`,
  }));

export const questUnmet = (
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): Unmet[] => {
  const eligibility = evaluateQuestEligibility(quest, unlocks, gameModeId);
  return [
    ...eligibility.blockers.map(eligibilityBlockerToUnmet),
    ...manualChecksToUnmet(eligibility.manualChecks),
  ];
};

export const diaryUnmet = (
  diary: DiaryTier,
  unlocks: UnlockState,
  gameModeId?: string,
): Unmet[] => {
  const eligibility = evaluateDiaryTierEligibility(diary, unlocks, gameModeId);
  const manualChecks = ALL_DIARY_TASKS
    .filter(task => task.tierId === diary.id && !unlocks.completedTasks.includes(task.id))
    .flatMap(task => evaluateDiaryTaskEligibility(task, unlocks, gameModeId).manualChecks);
  return [
    ...eligibility.blockers.map(eligibilityBlockerToUnmet),
    ...manualChecksToUnmet(manualChecks),
  ];
};
```

Change the comments above both functions from “empty ⇒ doable” to “empty ⇒ automatically doable”.

- [ ] **Step 4: Verify the shared unmet model is GREEN**

Run:

```powershell
npm test -- utils/journalProgress.test.ts
```

Expected: PASS, including exact `Confirm: One open Sailing task slot` and `Confirm: 153 Varrock Museum Kudos` assertions.

- [ ] **Step 5: Add failing next-best and summary regressions**

In `components/JournalNextBest.test.tsx`, add a reusable machine-ready Prying Times unlock snapshot and assert that the quest is close, not ready:

```ts
const pryingTimesUnlocks = () => ({
  equipment: {},
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: ['The Open Seas'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

it('keeps manually pending quests and diary tiers out of the ready count', () => {
  const prying = selectJournalNextBestActions(pryingTimesUnlocks())
    .find(action => action.id === 'Prying Times');

  expect(prying).toEqual(expect.objectContaining({
    unmet: 1,
    firstBlocker: 'Confirm: One open Sailing task slot',
  }));
});
```

Add the equivalent real diary case:

```ts
it('shows Varrock Hard as close while Kudos needs confirmation', () => {
  const action = selectJournalNextBestActions({
    ...pryingTimesUnlocks(),
    regions: ['Varrock'],
    quests: [],
    completedTasks: ALL_DIARY_TASKS
      .filter(task => task.tierId !== 'Varrock Hard' || task.id !== 'var_hard_2')
      .map(task => task.id),
  }).find(action => action.id === 'Varrock Hard');

  expect(action).toEqual(expect.objectContaining({
    unmet: 1,
    firstBlocker: 'Confirm: 153 Varrock Museum Kudos',
  }));
});
```

Create `components/JournalSummaryCard.test.tsx` with a local `UnlockState` builder and this singleton analysis:

```ts
const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Open Seas'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

it('excludes Prying Times from both the available count and quest recommendation', () => {
  const analysis = analyzeJournalQuestRecommendations(
    [QUEST_DATA['Prying Times']],
    [],
    pryingTimesUnlocks(),
  );

  expect(analysis.available).toBe(0);
  expect(analysis.candidates).toEqual([]);
  expect(analysis.best).toBeNull();
});
```

Add this control using the same real requirements with the manual field removed:

```ts
it('keeps an automatically eligible quest in the count and recommendation pool', () => {
  const automatic: QuestData = {
    ...QUEST_DATA['Prying Times'],
    id: 'Automatic test quest',
    name: 'Automatic test quest',
    manualRequirements: [],
  };
  const analysis = analyzeJournalQuestRecommendations(
    [automatic],
    [],
    pryingTimesUnlocks(),
  );

  expect(analysis.available).toBe(1);
  expect(analysis.candidates.map(quest => quest.id)).toEqual([automatic.id]);
  expect(analysis.best).toEqual(expect.objectContaining({ name: automatic.name }));
});
```

- [ ] **Step 6: Run the component tests and verify RED**

Run:

```powershell
npm test -- components/JournalNextBest.test.tsx components/JournalSummaryCard.test.tsx
```

Expected: FAIL because next-best still treats manual checks as zero blockers and `analyzeJournalQuestRecommendations` does not exist.

- [ ] **Step 7: Centralize Journal Summary automatic quest analysis**

In `components/JournalSummaryCard.tsx`, import `evaluateQuestEligibility` and export:

```ts
export interface JournalQuestRecommendationAnalysis {
  available: number;
  candidates: QuestData[];
  best: { name: string; nq: number; nd: number; impact: number } | null;
}

export function analyzeJournalQuestRecommendations(
  allQuests: QuestData[],
  allDiaries: DiaryTier[],
  unlocks: UnlockState,
  gameModeId?: string,
): JournalQuestRecommendationAnalysis
```

Implement it with these exact rules:

```ts
const baseQ = new Map(allQuests.map(quest => [
  quest.id,
  evaluateQuestEligibility(quest, unlocks, gameModeId),
]));
const candidates = allQuests.filter(quest => (
  !unlocks.quests.includes(quest.id) && baseQ.get(quest.id)!.eligible
));
const wasOpen = (questId: string) => {
  const result = baseQ.get(questId);
  return result?.status === 'COMPLETED' || result?.eligible === true;
};
```

The candidate simulation must increment `nq` only when the simulated quest changes from not open to `evaluateQuestEligibility(...).eligible === true`. Keep the existing diary-impact scoring and tie behavior unchanged. Return `available: candidates.length`.

Make `recommendNextAction(...)` call the helper with `Object.values(QUEST_DATA)` and `Object.values(DIARY_DATA)`. Make the stats memo use the same helper’s `available` count rather than `getQuestStatus(...) === 'AVAILABLE'`. Do not add manual-pending quests back through a fallback path.

`JournalNextBest.tsx` requires no branching change after `questUnmet`/`diaryUnmet` are corrected; keep `unmet === 0` as the sole ready criterion.

Update the stale comment in `utils/questDoability.ts` so it refers to canonical `eligibility.eligible`, not `getQuestStatus(...) === 'AVAILABLE'`; do not change behavior in that file.

- [ ] **Step 8: Run the complete Task 1 focused regression set**

Run:

```powershell
npm test -- utils/journalProgress.test.ts components/JournalNextBest.test.tsx components/JournalSummaryCard.test.tsx utils/journalCompletion.test.ts utils/manualAttestation.test.ts
```

Expected: PASS with Prying Times and Varrock Kudos shown only as manual-confirmation actions, and the existing manual-attestation flow unchanged.

- [ ] **Step 9: Commit Task 1**

```powershell
git add utils/journalProgress.ts utils/journalProgress.test.ts components/JournalNextBest.tsx components/JournalNextBest.test.tsx components/JournalSummaryCard.tsx components/JournalSummaryCard.test.tsx utils/questDoability.ts
git diff --cached --check
git commit -m "fix: respect manual checks in journal recommendations"
```

Before committing, verify `git diff --cached --name-only` does not contain `utils/taskIdMigrations.ts`.

---

### Task 2: Goal Planner Confirmation Steps

**Files:**
- Modify: `utils/goalPlanner.ts`
- Modify: `utils/goalPlanner.test.ts`
- Modify: `components/GoalPlannerModal.tsx`
- Modify: `components/GoalPlannerModal.test.tsx`

**Interfaces:**
- Consumes: canonical quest `status`, `eligible`, `confirmable`, and `manualChecks`; canonical incomplete diary-task eligibility.
- Produces: `PlanStep.kind` extended with `'manual'`; `GoalPlan.manualSteps: PlanStep[]`; `GoalPlan.steps` includes manual steps before the quest-completion steps; `GoalPlan.needsConfirmation` is true only when the selected target’s machine gates pass but its manual checks remain.
- Produces: exported `goalPlannerTargetState(target, unlocks, gameModeId?): 'done' | 'ready' | 'confirm' | 'locked'`.
- Produces: exported `GoalPlanReadiness` presentation that renders the exact outstanding confirmation reason and is used by `GoalPlannerModal`.
- Preserves: a quest-completion step remains separate from its manual prerequisite, so Prying Times has two remaining steps: confirm the Sailing slot, then complete the quest.

- [ ] **Step 1: Add failing planner-model regressions**

In `utils/goalPlanner.test.ts`, add:

```ts
it('plans Prying Times as a manual confirmation followed by quest completion', () => {
  const plan = planForTarget('quest', 'Prying Times', maxedUnlocks({
    regions: ['The Open Seas'],
    quests: ['Pandemonium', "The Knight's Sword"],
  }))!;

  expect(plan.alreadyReachable).toBe(false);
  expect(plan.needsConfirmation).toBe(true);
  expect(plan.manualSteps).toEqual([expect.objectContaining({
    kind: 'manual',
    label: 'Confirm: One open Sailing task slot',
    detail: 'Required for Prying Times',
    done: false,
  })]);
  expect(plan.steps.map(step => step.kind)).toEqual(['manual', 'quest']);
  expect(plan.remaining).toBe(2);
});
```

Add a diary regression with all `Varrock Hard` tasks except `var_hard_2` complete:

```ts
it('adds the remaining Varrock Kudos check to a diary plan', () => {
  const completedTasks = ALL_DIARY_TASKS
    .filter(task => task.tierId !== 'Varrock Hard' || task.id !== 'var_hard_2')
    .map(task => task.id);
  const plan = planForTarget('diary', 'Varrock Hard', maxedUnlocks({
    regions: ['Varrock'],
    completedTasks,
  }))!;

  expect(plan.manualSteps).toContainEqual(expect.objectContaining({
    kind: 'manual',
    label: 'Confirm: 153 Varrock Museum Kudos',
  }));
  expect(plan.alreadyReachable).toBe(false);
  expect(plan.needsConfirmation).toBe(true);
});
```

- [ ] **Step 2: Run planner tests and verify RED**

Run:

```powershell
npm test -- utils/goalPlanner.test.ts
```

Expected: FAIL because manual steps are absent and Prying Times is marked already reachable.

- [ ] **Step 3: Add manual steps to the pure plan model**

Extend `PlanStep.kind` and `GoalPlan`:

```ts
kind: 'quest' | 'region' | 'skill' | 'qp' | 'manual';

export interface GoalPlan {
  // Existing target and step fields remain.
  manualSteps: PlanStep[];
  needsConfirmation: boolean;
}
```

Add an order-preserving manual-step map to `collectQuestChain`:

```ts
const manualSteps = new Map<string, PlanStep>();

for (const check of eligibility.manualChecks) {
  const key = `${qid}|${check}`;
  if (!manualSteps.has(key)) {
    manualSteps.set(key, {
      kind: 'manual',
      id: `manual:${qid}:${check}`,
      label: `Confirm: ${check}`,
      detail: `Required for ${q.name}`,
      done: false,
    });
  }
}
```

Return and merge `manualSteps` through `buildPlanFromRequirements`. When planning a diary, also add each incomplete task eligibility’s `manualChecks`, keyed by `${task.id}|${check}`, with `detail: \`Required for ${task.description}\``. Merge manual steps from every quest chain reached through a quest or diary target.

Add `manualSteps: new Map<string, PlanStep>()` to every requirements object. Add `manualSteps: []` and `needsConfirmation: false` to the standalone region plan return so every `GoalPlan` construction satisfies the same interface.

Build the final ordered steps as:

```ts
const steps = [
  ...regionSteps,
  ...skillSteps,
  ...alternativeSteps,
  ...(qpStep ? [qpStep] : []),
  ...manualSteps,
  ...questSteps,
];
```

For quest targets, set `alreadyReachable` from `eligibility.status === 'COMPLETED' || eligibility.eligible`, and set `needsConfirmation` from `eligibility.confirmable && !eligibility.eligible && eligibility.manualChecks.length > 0`. For diary targets, evaluate every incomplete canonical task once: `alreadyReachable` is true only when completed or every task is eligible; `needsConfirmation` is true only when every task is machine-eligible, at least one task has manual checks, and the tier is not completed. Keep `alreadyDone` based only on stored completion. Pass both booleans into `buildPlanFromRequirements` and include them in every returned `GoalPlan`.

- [ ] **Step 4: Verify planner-model GREEN**

Run:

```powershell
npm test -- utils/goalPlanner.test.ts
```

Expected: PASS, including Prying Times `remaining === 2` and the Varrock Kudos manual step.

- [ ] **Step 5: Add failing picker and rendered-reason tests**

In `components/GoalPlannerModal.test.tsx`, import `renderToStaticMarkup`, `UnlockState`, `listGoalTargets`, `planForTarget`, `goalPlannerTargetState`, and `GoalPlanReadiness`. Add:

```tsx
const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Open Seas'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

it('gives Prying Times a distinct confirmation state', () => {
  const unlocks = pryingTimesUnlocks();
  const target = listGoalTargets().find(target => (
    target.kind === 'quest' && target.id === 'Prying Times'
  ))!;

  expect(goalPlannerTargetState(target, unlocks)).toBe('confirm');
});

it('renders the outstanding Prying Times confirmation instead of ready copy', () => {
  const plan = planForTarget('quest', 'Prying Times', pryingTimesUnlocks())!;
  const markup = renderToStaticMarkup(<GoalPlanReadiness plan={plan} />);

  expect(markup).toContain('Confirm: One open Sailing task slot');
  expect(markup).not.toContain('Available right now');
});
```

Add a `goalPlannerStepHasWikiLink` assertion showing a `manual` step returns `false`.

- [ ] **Step 6: Run modal tests and verify RED**

Run:

```powershell
npm test -- components/GoalPlannerModal.test.tsx
```

Expected: FAIL because the `confirm` state, `GoalPlanReadiness`, and manual step icon/link rules do not exist.

- [ ] **Step 7: Present confirmation state and steps in the modal**

In `components/GoalPlannerModal.tsx`:

```ts
export type TargetState = 'done' | 'ready' | 'confirm' | 'locked';

export function goalPlannerTargetState(
  target: GoalTarget,
  unlocks: UnlockState,
  gameModeId?: string,
): TargetState
```

Use full quest eligibility for quests. Return `confirm` only when `confirmable` is true, `eligible` is false, and `manualChecks.length > 0`. For diary targets, evaluate every incomplete canonical task: `ready` only when all are eligible, `confirm` when all are machine-eligible and at least one has manual checks, otherwise `locked`. Preserve `done` for completed quests/diaries and reachable regions.

Add `confirm` to `STATE_DOT` with a distinct cyan/purple dot and rank it after `ready` but before `locked`.

Extend `STEP_ICON` with a manual icon and make `goalPlannerStepHasWikiLink(step)` return `false` when `step.kind === 'manual'`.

Export and use:

```tsx
export const GoalPlanReadiness: React.FC<{ plan: GoalPlan }> = ({ plan }) => {
  if (plan.alreadyDone) return <>Already complete — nothing left to do!</>;
  if (plan.alreadyReachable && plan.targetKind !== 'region') {
    return <>Available right now — go do it!</>;
  }
  if (plan.needsConfirmation) {
    return (
      <>
        Needs confirmation: {plan.manualSteps.map(step => step.label).join(' · ')}
      </>
    );
  }
  return <>{plan.remaining} step{plan.remaining !== 1 ? 's' : ''} remaining</>;
};
```

Replace the modal’s existing inline readiness paragraph with `GoalPlanReadiness`. Add:

```tsx
<PlanSection
  title="Confirm manually"
  icon={<Compass size={12} />}
  steps={plan.manualSteps}
/>
```

before the quest sequence. The visible step label must retain the exact `Confirm: …` prefix.

- [ ] **Step 8: Run the complete Task 2 focused regression set**

Run:

```powershell
npm test -- utils/goalPlanner.test.ts components/GoalPlannerModal.test.tsx utils/journalCompletion.test.ts utils/manualAttestation.test.ts
```

Expected: PASS with Prying Times shown as confirmation-required in the picker, plan header, and manual-step section.

- [ ] **Step 9: Commit Task 2**

```powershell
git add utils/goalPlanner.ts utils/goalPlanner.test.ts components/GoalPlannerModal.tsx components/GoalPlannerModal.test.tsx
git diff --cached --check
git commit -m "fix: model manual checks in goal plans"
```

Before committing, verify `git diff --cached --name-only` does not contain `utils/taskIdMigrations.ts`.

---

### Task 3: Chunk Activity Mixed Status and Doability

**Files:**
- Modify: `components/ChunkActivityPanel.tsx`
- Create: `components/ChunkActivityPanel.test.tsx`

**Interfaces:**
- Consumes: `getQuestStatus(...)` only for catalogue status and `evaluateQuestEligibility(...)` for automatic doability.
- Produces: exported `ChunkQuestRow` carrying `{ name, kind, status, eligibility }`.
- Produces: exported `chunkQuestOverviewItem(row, areaUnlocked)` returning `null` for completed/untracked rows or `{ can, label }` for incomplete tracked rows.
- Produces: exported `chunkQuestPresentation(row)` returning one of `completed | available | confirmation | locked | untracked` plus the exact title used by the detailed catalogue row.
- Preserves: the detailed catalogue remains status-oriented, but manual-pending `AVAILABLE` rows have a distinct confirmation marker/title rather than the fully-doable amber marker.

- [ ] **Step 1: Add failing pure presentation and overview regressions**

Create `components/ChunkActivityPanel.test.tsx`:

```ts
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import { evaluateQuestEligibility, getQuestStatus } from '../utils/journalStatus';
import {
  chunkQuestOverviewItem,
  chunkQuestPresentation,
  type ChunkQuestRow,
} from './ChunkActivityPanel';

const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Open Seas'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

const rowForPryingTimes = (): ChunkQuestRow => {
  const unlocks = pryingTimesUnlocks();
  const quest = QUEST_DATA['Prying Times'];
  return {
    name: quest.name,
    kind: 'first',
    status: getQuestStatus(quest, unlocks),
    eligibility: evaluateQuestEligibility(quest, unlocks),
  };
};

it('puts a machine-available manual-pending quest in Locked with its reason', () => {
  expect(rowForPryingTimes().status).toBe('AVAILABLE');
  expect(chunkQuestOverviewItem(rowForPryingTimes(), true)).toEqual({
    can: false,
    label: 'Prying Times — Confirm: One open Sailing task slot',
  });
});

it('gives manual-pending catalogue rows a distinct confirmation indicator', () => {
  expect(chunkQuestPresentation(rowForPryingTimes())).toEqual({
    kind: 'confirmation',
    title: 'Confirm: One open Sailing task slot',
  });
});
```

Add controls for completed, automatically eligible, machine-locked, and untracked rows:

```ts
it('preserves automatic, completed, locked, and untracked catalogue semantics', () => {
  const manual = rowForPryingTimes();
  const automatic: ChunkQuestRow = {
    ...manual,
    eligibility: {
      ...manual.eligibility!,
      eligible: true,
      machineEligible: true,
      confirmable: true,
      manualChecks: [],
    },
  };
  const completed: ChunkQuestRow = { ...automatic, status: 'COMPLETED' };
  const locked: ChunkQuestRow = {
    ...automatic,
    status: 'LOCKED_REGION',
    eligibility: {
      ...automatic.eligibility!,
      eligible: false,
      machineEligible: false,
    },
  };
  const untracked: ChunkQuestRow = {
    name: 'Miniquest',
    kind: 'present',
    status: null,
    eligibility: null,
  };

  expect(chunkQuestOverviewItem(automatic, true)).toEqual({
    can: true,
    label: 'Prying Times',
  });
  expect(chunkQuestOverviewItem(completed, true)).toBeNull();
  expect(chunkQuestOverviewItem(locked, true)).toEqual({
    can: false,
    label: 'Prying Times',
  });
  expect(chunkQuestOverviewItem(untracked, true)).toBeNull();
});
```

- [ ] **Step 2: Run the new Chunk Activity tests and verify RED**

Run:

```powershell
npm test -- components/ChunkActivityPanel.test.tsx
```

Expected: FAIL because `ChunkQuestRow`, `chunkQuestOverviewItem`, and `chunkQuestPresentation` do not exist and the current overview uses raw `status`.

- [ ] **Step 3: Carry eligibility through quest rows**

In `components/ChunkActivityPanel.tsx`, import `QuestEligibility` and `evaluateQuestEligibility`. Export:

```ts
export interface ChunkQuestRow {
  name: string;
  kind: string;
  status: QuestStatus | null;
  eligibility: QuestEligibility | null;
}

export const chunkQuestOverviewItem = (
  row: ChunkQuestRow,
  areaUnlocked: boolean,
): { can: boolean; label: string } | null => {
  if (!row.status || row.status === 'COMPLETED') return null;
  const checks = row.eligibility?.manualChecks ?? [];
  return {
    can: areaUnlocked && row.eligibility?.eligible === true,
    label: checks.length > 0
      ? `${row.name} — ${checks.map(check => `Confirm: ${check}`).join(' · ')}`
      : row.name,
  };
};

export const chunkQuestPresentation = (
  row: ChunkQuestRow,
): { kind: 'completed' | 'available' | 'confirmation' | 'locked' | 'untracked'; title: string } => {
  if (row.status === 'COMPLETED') return { kind: 'completed', title: 'Completed' };
  if (!row.status) return { kind: 'untracked', title: 'miniquest / not tracked' };
  if (row.status === 'AVAILABLE' && row.eligibility && !row.eligibility.eligible) {
    return {
      kind: 'confirmation',
      title: row.eligibility.manualChecks.map(check => `Confirm: ${check}`).join(' · '),
    };
  }
  if (row.status === 'AVAILABLE') {
    return { kind: 'available', title: QUEST_BADGE.AVAILABLE.label };
  }
  return { kind: 'locked', title: QUEST_BADGE[row.status].label };
};
```

When constructing `questRows`, compute both status and eligibility from the same quest and unlock snapshot. Do not replace or remove the raw status.

- [ ] **Step 4: Use eligibility in the overview and confirmation presentation in the catalogue**

Replace the quest portion of the overview loop with:

```ts
for (const row of questRows) {
  const item = chunkQuestOverviewItem(row, unlocked);
  if (item) push(item.can, 'Quests', item.label);
}
```

In the detailed quest list, derive `presentation = chunkQuestPresentation(row)` once. Keep the green completed check, amber available dot, gray lock, and untracked dot. Add a visually distinct cyan/purple confirmation symbol for `presentation.kind === 'confirmation'`, and set the row `title` to `presentation.title`. Keep the wiki link text color based on raw `status` so this catalogue continues to communicate machine compatibility.

- [ ] **Step 5: Run Task 3 focused tests and intentional QuestLog boundary regressions**

Run:

```powershell
npm test -- components/ChunkActivityPanel.test.tsx components/QuestDoabilityPanel.test.tsx utils/journalCompletion.test.ts utils/manualAttestation.test.ts
```

Expected: PASS. Prying Times is in the Chunk Activity “Locked” overview with the confirmation reason, its detailed catalogue row has a distinct confirmation indicator, and QuestLog/manual attestation still accepts the raw `AVAILABLE` quest only after explicit confirmation.

- [ ] **Step 6: Type-check the three migrated interface groups**

Run:

```powershell
npm run typecheck
```

Expected: PASS with exhaustive `PlanStep.kind`, `TargetState`, and chunk presentation unions updated.

- [ ] **Step 7: Commit Task 3**

```powershell
git add components/ChunkActivityPanel.tsx components/ChunkActivityPanel.test.tsx
git diff --cached --check
git commit -m "fix: distinguish chunk quest confirmation readiness"
```

Before committing, verify `git diff --cached --name-only` does not contain `utils/taskIdMigrations.ts`.

After this task, the controller must request a fresh whole-branch review and then run fresh `npm test`, `npm run typecheck`, `npm run content:verify`, and `npm run build` at the exact final head before presenting integration options.
