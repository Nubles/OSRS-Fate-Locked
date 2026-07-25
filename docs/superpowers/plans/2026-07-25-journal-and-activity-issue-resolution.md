# Journal and Activity Issue Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close tracker issues #7, #8, and #9 and complete the tracker-side diary and pool-discoverability work from RuneLite issue #5 without changing production key rates.

**Architecture:** Keep canonical content in the existing generated diary snapshot, keep eligibility decisions in pure utilities, and make UI components consume those decisions. Manual requirements are explicit confirmation gates, while ownership and readiness remain separate concepts. Pool navigation reuses the existing `fate:nav` event and dashboard datasets.

**Tech Stack:** React 18, TypeScript 5, Vitest 4, Node.js ESM generators, `react-dom/server`, existing Fate Locked context and navigation events.

## Global Constraints

- Do not change any production key rate, Fate Point rule, pity threshold, boss cap, or diminishing-return behavior.
- Canonical location evidence remains authoritative when chunk-content evidence is absent.
- Quest Points are a first-class diary requirement and never a pseudo-skill.
- Do not add Bone Voyage as a prerequisite for 153 Varrock Museum Kudos.
- Advisors and automatic doability counts use `eligible`; manual completion requires `confirmable` plus explicit player attestation.
- Activity ownership counts and search remain ownership-based; readiness never grants an unlock.
- `note` remains informational and never silently becomes a blocker.
- `View pool` remains enabled with zero Keys and never creates a second pool or RNG path.
- Source of truth for generated diary tasks is `data/sources/achievement-diary-tasks.json`; never hand-edit generated task records.
- Use `npm run diary:sync` after changing the diary snapshot.

---

## File Structure

- `utils/questDoability.ts`: pure canonical-evidence and bucket precedence.
- `components/QuestDoabilityPanel.tsx`: adapter from quest, eligibility, and chunk state to a displayed bucket.
- `utils/journalStatus.ts`: quest and diary machine/manual readiness contracts.
- `utils/journalCompletion.ts`: completion authorization and attestation enforcement.
- `data/sources/achievement-diary-tasks.json`: canonical diary requirement records.
- `scripts/sync-achievement-diaries.mjs`: validates and renders the new generated fields.
- `data/diaryTasks.ts`: generated output only.
- `context/GameContext.tsx`: passes attestation to pure completion decisions.
- `components/QuestLog.tsx` and `components/DiaryLog.tsx`: collect explicit player confirmation.
- `utils/activityReadiness.ts`: pure activity readiness evaluator.
- `components/ActivityReadinessBadge.tsx`: focused presentation for readiness.
- `data/activityRequirements.ts`: curated hard activity dependencies.
- `utils/dashboardPoolNavigation.ts`: table-to-dashboard navigation mapping.
- `components/GachaSection.tsx` and `components/Dashboard.tsx`: pool action and target selection.

### Task 1: Preserve `NO_DATA` for quests with no location evidence

**Files:**
- Modify: `utils/questDoability.ts`
- Modify: `utils/questDoability.test.ts`
- Modify: `components/QuestDoabilityPanel.tsx`
- Modify: `components/QuestDoabilityPanel.test.tsx`

**Interfaces:**
- Produces: `hasCanonicalQuestLocationEvidence(quest: QuestData): boolean`
- Changes: `doabilityBucket(completed, reqsMet, chunk, hasCanonicalLocationEvidence): DoabilityBucket`
- Consumes: `QuestData.regions`, `locations`, and `oneOf` location/guild/region fields.

- [ ] **Step 1: Add failing precedence tests**

```ts
it('uses NO_DATA only when canonical and chunk evidence are both absent', () => {
  expect(doabilityBucket(false, true, null, false)).toBe('NO_DATA');
  expect(doabilityBucket(false, false, null, false)).toBe('NO_DATA');
  expect(doabilityBucket(false, true, null, true)).toBe('DOABLE');
  expect(doabilityBucket(false, false, null, true)).toBe('REQS');
});

it('recognises every canonical location shape', () => {
  expect(hasCanonicalQuestLocationEvidence({
    ...baseQuest, regions: ['Misthalin'],
  })).toBe(true);
  expect(hasCanonicalQuestLocationEvidence({
    ...baseQuest, regions: [], locations: [{
      id: 'south-falador-farm',
      label: 'South Falador Farm',
      standardAreas: ['Asgarnia'],
      chunkOptions: [{ cx: 47, cy: 51 }],
    }],
  })).toBe(true);
  expect(hasCanonicalQuestLocationEvidence({
    ...baseQuest, regions: [], oneOf: [{ guilds: ["Wizards' Guild"] }],
  })).toBe(true);
  expect(hasCanonicalQuestLocationEvidence({
    ...baseQuest, regions: [],
  })).toBe(false);
});
```

In `components/QuestDoabilityPanel.test.tsx`, add:

```ts
it('does not report an evidence-free quest as doable', () => {
  const quest: QuestData = {
    id: 'Unknown location quest',
    name: 'Unknown location quest',
    regions: [],
    skills: {},
    prereqs: [],
    points: 0,
    difficulty: DropSource.QUEST_NOVICE,
  };
  expect(evaluateQuestDoability(quest, unlocks(), null).bucket).toBe('NO_DATA');
});

it('keeps explicit canonical access authoritative without chunk data', () => {
  const quest = QUEST_DATA['A Porcine of Interest'];
  expect(evaluateQuestDoability(
    quest,
    unlocks({ regions: ['Draynor Village'] }),
    null,
  ).bucket).toBe('LOCKED');
});
```

- [ ] **Step 2: Run the focused tests and verify the new assertions fail**

Run: `npx vitest run utils/questDoability.test.ts components/QuestDoabilityPanel.test.tsx`

Expected: FAIL because `hasCanonicalQuestLocationEvidence` and the fourth `doabilityBucket` argument do not exist and the adapter currently returns `DOABLE`.

- [ ] **Step 3: Implement canonical evidence and bucket precedence**

```ts
import { QuestData } from '../data/questData';

export const hasCanonicalQuestLocationEvidence = (quest: QuestData): boolean =>
  quest.regions.length > 0
  || (quest.locations?.length ?? 0) > 0
  || (quest.oneOf?.some(option =>
    (option.regions?.length ?? 0) > 0
    || (option.guilds?.length ?? 0) > 0
    || (option.locations?.length ?? 0) > 0
  ) ?? false);

export function doabilityBucket(
  completed: boolean,
  reqsMet: boolean,
  chunk: QuestChunkStatus | null,
  hasCanonicalLocationEvidence = false,
): DoabilityBucket {
  if (completed) return 'DONE';
  if (!chunk || chunk.chunkCount === 0) {
    if (!hasCanonicalLocationEvidence) return 'NO_DATA';
    return reqsMet ? 'DOABLE' : 'REQS';
  }
  if (chunk.access === 'LOCKED') return 'LOCKED';
  if (chunk.access === 'STRANDED') return 'STRANDED';
  return reqsMet ? 'DOABLE' : 'REQS';
}
```

Update the adapter’s chunk branch:

```ts
} else {
  bucket = doabilityBucket(
    false,
    reqsMet,
    chunk,
    hasCanonicalQuestLocationEvidence(quest),
  );
}
```

Keep the completed and explicit canonical-blocker branches before this call.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run utils/questDoability.test.ts components/QuestDoabilityPanel.test.tsx`

Expected: PASS, including the existing `Enter the Abyss` and method-cap cases.

- [ ] **Step 5: Commit**

```bash
git add utils/questDoability.ts utils/questDoability.test.ts components/QuestDoabilityPanel.tsx components/QuestDoabilityPanel.test.tsx
git commit -m "fix: preserve unknown quest location status"
```

### Task 2: Generate first-class Quest Point and manual diary requirements

**Files:**
- Modify: `scripts/sync-achievement-diaries.mjs`
- Modify: `scripts/sync-achievement-diaries.test.ts`
- Modify: `data/sources/achievement-diary-tasks.json`
- Regenerate: `data/diaryTasks.ts`
- Verify unchanged: `utils/taskIdMigrations.ts`
- Modify: `data/contentBaseline.test.ts`

**Interfaces:**
- Produces on both `DiaryTask` and `DiaryTaskRequirementOption`: `questPoints?: number`, `manualRequirements?: string[]`
- Snapshot values: `var_med_2.questPoints = 32`; `var_hard_2.manualRequirements = ['153 Varrock Museum Kudos']`.

- [ ] **Step 1: Add failing generator and baseline tests**

Extend the deterministic-render fixture:

```ts
snapshot.tasks[0].questPoints = 32;
snapshot.tasks[0].manualRequirements = ['Confirm external progress'];
```

Assert:

```ts
expect(first).toContain('questPoints?: number;');
expect(first).toContain('manualRequirements?: string[];');
expect(first).toContain(
  "questPoints: 32, manualRequirements: ['Confirm external progress']",
);
```

Add malformed-input checks:

```ts
const badQuestPoints: any = structuredClone(SIX_TASK_SNAPSHOT);
badQuestPoints.tasks[0].questPoints = 0;
expect(() => renderDiaryTasks(badQuestPoints)).toThrow(/questPoints/i);

const badManual: any = structuredClone(SIX_TASK_SNAPSHOT);
badManual.tasks[0].manualRequirements = [''];
expect(() => renderDiaryTasks(badManual)).toThrow(/manualRequirements.*non-empty string/i);
```

In `data/contentBaseline.test.ts`, assert:

```ts
const varMediumGuild = ALL_DIARY_TASKS.find(({ id }) => id === 'var_med_2')!;
const varHardKudos = ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!;
expect(varMediumGuild).toMatchObject({ questPoints: 32 });
expect(varHardKudos).toMatchObject({
  manualRequirements: ['153 Varrock Museum Kudos'],
});
expect(varHardKudos.quests ?? []).not.toContain('Bone Voyage');
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx vitest run scripts/sync-achievement-diaries.test.ts data/contentBaseline.test.ts`

Expected: FAIL because the generator does not validate/render the fields and the source records do not contain them.

- [ ] **Step 3: Extend validation and rendering**

In `renderRequirementProperties`:

```js
if (requirement.questPoints) properties.push('questPoints: ' + requirement.questPoints);
if (requirement.manualRequirements?.length > 0) {
  properties.push(
    'manualRequirements: ' + renderStringArray(requirement.manualRequirements),
  );
}
```

In `validateRequirementShape`, include `manualRequirements` in the string-array loop and `questPoints` in the positive-integer loop:

```js
for (const field of ['items', 'quests', 'cas', 'regions', 'manualRequirements']) {
  // retain the existing array and non-empty-string validation body
}
for (const field of ['combatLevel', 'anySkillLevel', 'questPoints']) {
  // retain the existing positive-integer validation body
}
```

Add both fields to `hasRequirement`, and emit these exact interface members in both generated interfaces:

```ts
questPoints?: number;
manualRequirements?: string[];
```

- [ ] **Step 4: Edit the canonical snapshot and regenerate**

Add to `var_med_2`:

```json
"questPoints": 32
```

Add to `var_hard_2`:

```json
"manualRequirements": [
  "153 Varrock Museum Kudos"
]
```

Run: `npm run diary:sync`

Expected: `data/diaryTasks.ts` gains the two fields and records; `utils/taskIdMigrations.ts` remains semantically unchanged.

- [ ] **Step 5: Run generator and content tests**

Run: `npx vitest run scripts/sync-achievement-diaries.test.ts data/contentBaseline.test.ts data/tasksConsistency.test.ts utils/taskIdMigrations.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit only source, generator, generated output, and tests**

```bash
git add scripts/sync-achievement-diaries.mjs scripts/sync-achievement-diaries.test.ts data/sources/achievement-diary-tasks.json data/diaryTasks.ts data/contentBaseline.test.ts
git diff --cached --check
git commit -m "fix: model diary quest points and manual checks"
```

Do not stage `utils/taskIdMigrations.ts` if its only difference is checkout line endings.

### Task 3: Make quest and diary eligibility manual-aware

**Files:**
- Modify: `utils/journalStatus.ts`
- Modify: `utils/journalStatus.test.ts`
- Modify: `utils/questAdvisor.ts`
- Modify: `utils/questAdvisor.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ManualEligibility {
  machineEligible: boolean;
  manualChecks: string[];
  confirmable: boolean;
}

export interface QuestEligibility extends ManualEligibility {
  eligible: boolean;
  status: QuestStatus;
  blockers: EligibilityBlocker[];
  evidence: string[];
}

export interface DiaryTaskEligibility extends ManualEligibility {
  eligible: boolean;
  blockers: EligibilityBlocker[];
  evidence: string[];
}
```

- `status` continues to describe machine blockers for compatibility; `eligible` is the advisor/doability decision.

- [ ] **Step 1: Add failing readiness tests**

Add real-data cases. Define this exact shared fixture above them:

```ts
const unlocksReadyForPryingTimes = (): UnlockState => unlocked({
  regions: ['The Open Seas'],
  quests: ['Pandemonium', "The Knight's Sword"],
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
});
```

Then add:

```ts
it('requires 32 canonical Quest Points for the Champions Guild task', () => {
  const task = ALL_DIARY_TASKS.find(({ id }) => id === 'var_med_2')!;
  const low = evaluateDiaryTaskEligibility(task, unlocked({
    quests: ['Cook\'s Assistant'],
    regions: ['Varrock'],
  }));
  expect(low.machineEligible).toBe(false);
  expect(low.blockers).toContainEqual({
    kind: 'quest',
    label: 'Quest Points 32',
  });

  const enough = evaluateDiaryTaskEligibility(task, unlocked({
    quests: questIdsWorthAtLeast(32),
    regions: ['Varrock'],
  }));
  expect(enough).toMatchObject({
    machineEligible: true,
    eligible: true,
    confirmable: true,
    manualChecks: [],
  });
});

it('makes 153 Kudos confirmable but not automatically doable', () => {
  const result = evaluateDiaryTaskEligibility(
    ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!,
    unlocked({ regions: ['Varrock'] }),
  );
  expect(result).toMatchObject({
    machineEligible: true,
    eligible: false,
    confirmable: true,
    manualChecks: ['153 Varrock Museum Kudos'],
    blockers: [],
  });
});

it('keeps machine blockers ahead of manual confirmation', () => {
  const result = evaluateDiaryTaskEligibility(
    ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!,
    unlocked(),
  );
  expect(result.machineEligible).toBe(false);
  expect(result.confirmable).toBe(false);
  expect(result.manualChecks).toEqual(['153 Varrock Museum Kudos']);
});

it('activates Prying Times manual metadata', () => {
  const result = evaluateQuestEligibility(
    QUEST_DATA['Prying Times'],
    unlocksReadyForPryingTimes(),
  );
  expect(result).toMatchObject({
    machineEligible: true,
    eligible: false,
    confirmable: true,
    manualChecks: ['One open Sailing task slot'],
  });
});
```

Use a local test helper `questIdsWorthAtLeast(points)` that iterates `QUEST_DATA` entries with `points > 0` until the sum reaches the requested value; do not hard-code a fragile quest list.

- [ ] **Step 2: Run the focused tests**

Run: `npx vitest run utils/journalStatus.test.ts utils/questAdvisor.test.ts`

Expected: FAIL because Quest Points and manual checks are ignored.

- [ ] **Step 3: Implement shared manual readiness**

Add:

```ts
export interface ManualEligibility {
  machineEligible: boolean;
  manualChecks: string[];
  confirmable: boolean;
}

const uniqueStrings = (values: readonly string[]): string[] => [
  ...new Set(values),
];

const readinessFields = (
  blockers: readonly EligibilityBlocker[],
  manualChecks: readonly string[],
): ManualEligibility & { eligible: boolean } => {
  const machineEligible = blockers.length === 0;
  const checks = uniqueStrings(manualChecks);
  return {
    machineEligible,
    manualChecks: checks,
    confirmable: machineEligible,
    eligible: machineEligible && checks.length === 0,
  };
};
```

In quest evaluation, return:

```ts
const manual = readinessFields(blockers, quest.manualRequirements ?? []);
return { ...manual, status, blockers, evidence };
```

In diary requirement evaluation:

```ts
const manual = readinessFields(
  blockers,
  requirement.manualRequirements ?? [],
);
return { ...manual, blockers, evidence };
```

Evaluate `questPoints` after quests:

```ts
if (requirement.questPoints !== undefined) {
  const label = 'Quest Points ' + requirement.questPoints;
  if (currentQuestPoints(unlocks) >= requirement.questPoints) evidence.push(label);
  else blockers.push({ kind: 'quest', label });
}
```

For `oneOf`, select the first route with `eligible`; otherwise select the first route with `confirmable`; combine shared and route manual checks with `uniqueStrings`. Only build the existing `alternative` blocker when no route is machine-eligible.

- [ ] **Step 4: Make the quest advisor use the complete readiness result**

Replace the `getQuestStatus(...) === 'AVAILABLE'` filter in `utils/questAdvisor.ts` with:

```ts
const available = allQuests.filter(
  quest => evaluateQuestEligibility(quest, unlocks, gameModeId).eligible,
);
```

Keep completed-quest exclusion unchanged.

- [ ] **Step 5: Run status, advisor, goal, and progress tests**

Run:

```bash
npx vitest run utils/journalStatus.test.ts utils/questAdvisor.test.ts utils/advisor.test.ts utils/goalPlanner.test.ts utils/journalCompletion.test.ts
```

Expected: PASS. If an existing test constructs a literal `QuestEligibility` or `DiaryTaskEligibility`, add the four exact readiness fields rather than weakening the interfaces.

- [ ] **Step 6: Commit**

```bash
git add utils/journalStatus.ts utils/journalStatus.test.ts utils/questAdvisor.ts utils/questAdvisor.test.ts
git commit -m "fix: distinguish tracked and manual journal readiness"
```

### Task 4: Require explicit attestation for manual completion

**Files:**
- Modify: `utils/journalCompletion.ts`
- Modify: `utils/journalCompletion.test.ts`
- Create: `utils/manualAttestation.ts`
- Create: `utils/manualAttestation.test.ts`
- Modify: `context/GameContext.tsx`
- Modify: `components/QuestLog.tsx`
- Modify: `components/DiaryLog.tsx`

**Interfaces:**
- Produces: `CompletionAttestation = { manualConfirmed?: boolean }`
- Produces: `requestManualAttestation(label, eligibility, confirm): CompletionAttestation | null`
- Changes:

```ts
questCompletionDecision(quest, unlocks, gameModeId?, attestation?): CompletionResult
diaryTaskCompletionDecision(task, unlocks, gameModeId?, attestation?): CompletionResult
completeQuest(id, x?, y?, attestation?): CompletionResult
completeDiaryTask(id, x?, y?, attestation?): CompletionResult
```

- [ ] **Step 1: Add failing pure completion tests**

```ts
it('requires and accepts an explicit quest manual attestation', () => {
  const task = QUEST_DATA['Prying Times'];
  const ready = unlocksReadyForPryingTimes();
  expect(questCompletionDecision(task, ready, 'vanilla')).toEqual({
    ok: false,
    reason: 'Confirm: One open Sailing task slot',
  });
  expect(questCompletionDecision(
    task,
    ready,
    'vanilla',
    { manualConfirmed: true },
  )).toEqual({ ok: true });
});

it('does not let attestation bypass a machine blocker', () => {
  const task = ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!;
  expect(diaryTaskCompletionDecision(
    task,
    unlocked(),
    'vanilla',
    { manualConfirmed: true },
  ).ok).toBe(false);
});

it('accepts the Kudos task only after confirmation', () => {
  const task = ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!;
  const ready = unlocked({ regions: ['Varrock'] });
  expect(diaryTaskCompletionDecision(task, ready, 'vanilla')).toEqual({
    ok: false,
    reason: 'Confirm: 153 Varrock Museum Kudos',
  });
  expect(diaryTaskCompletionDecision(
    task,
    ready,
    'vanilla',
    { manualConfirmed: true },
  )).toEqual({ ok: true });
});
```

- [ ] **Step 2: Run completion tests**

Run: `npx vitest run utils/journalCompletion.test.ts`

Expected: FAIL because attestation is not accepted.

- [ ] **Step 3: Enforce the readiness contract**

```ts
export interface CompletionAttestation {
  manualConfirmed?: boolean;
}

const manualDecision = (
  result: Pick<ManualEligibility, 'machineEligible' | 'manualChecks' | 'confirmable'>,
  attestation: CompletionAttestation,
): CompletionResult | null => {
  if (!result.machineEligible) return null;
  if (result.manualChecks.length === 0) return { ok: true };
  return result.confirmable && attestation.manualConfirmed
    ? { ok: true }
    : { ok: false, reason: 'Confirm: ' + result.manualChecks.join(', ') };
};
```

In each completion decision:

1. keep the already-completed guard;
2. evaluate the full quest/diary result;
3. reject machine blockers with the existing `Requires:` copy;
4. call `manualDecision`;
5. never allow `manualConfirmed` to bypass blockers.

Pass the attestation through the two `GameContext` methods and update their
context type declarations. The pure decision tests pin the context boundary's
accepted value; TypeScript pins both callback signatures.

- [ ] **Step 4: Add failing prompt-decision tests**

Create `utils/manualAttestation.test.ts` with an injected confirmation function:

```ts
it('returns an attestation only after the player confirms', () => {
  const confirm = vi.fn(() => true);
  expect(requestManualAttestation(
    'Varrock Hard task',
    { machineEligible: true, manualChecks: ['153 Varrock Museum Kudos'] },
    confirm,
  )).toEqual({ manualConfirmed: true });
  expect(confirm).toHaveBeenCalledWith(
    'Confirm Varrock Hard task\n\n- 153 Varrock Museum Kudos',
  );
});

it('cancels completion when the player declines', () => {
  expect(requestManualAttestation(
    'Prying Times',
    { machineEligible: true, manualChecks: ['One open Sailing task slot'] },
    () => false,
  )).toBeNull();
});

it('does not prompt when there is a machine blocker', () => {
  const confirm = vi.fn(() => true);
  expect(requestManualAttestation(
    'Blocked task',
    { machineEligible: false, manualChecks: ['Manual check'] },
    confirm,
  )).toEqual({});
  expect(confirm).not.toHaveBeenCalled();
});
```

Run: `npx vitest run utils/manualAttestation.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 5: Implement one shared prompt boundary and wire both components**

Implement:

```ts
import type { CompletionAttestation } from './journalCompletion';

export interface ManualAttestationEligibility {
  machineEligible: boolean;
  manualChecks: string[];
}

export const requestManualAttestation = (
  label: string,
  eligibility: ManualAttestationEligibility,
  confirm: (message: string) => boolean,
): CompletionAttestation | null => {
  if (!eligibility.machineEligible || eligibility.manualChecks.length === 0) {
    return {};
  }
  const message = `Confirm ${label}\n\n${eligibility.manualChecks
    .map(check => `- ${check}`)
    .join('\n')}`;
  return confirm(message) ? { manualConfirmed: true } : null;
};
```

For quest completion:

```ts
const eligibility = evaluateQuestEligibility(quest, unlocks, gameModeId);
const attestation = requestManualAttestation(
  quest.name,
  eligibility,
  message => window.confirm(message),
);
if (attestation === null) return;
const result = completeQuest(
  quest.id,
  e.clientX,
  e.clientY,
  attestation,
);
```

For diary completion, use the exact equivalent:

```ts
const eligibility = evaluateDiaryTaskEligibility(task, unlocks, gameModeId);
const attestation = requestManualAttestation(
  task.description,
  eligibility,
  message => window.confirm(message),
);
if (attestation === null) return;
const result = completeDiaryTask(
  task.id,
  e.clientX,
  e.clientY,
  attestation,
);
```

Keep each existing already-completed guard ahead of this code. Machine-blocked
entries receive an empty attestation without prompting, then the canonical
completion decision rejects them.

- [ ] **Step 6: Run focused and type tests**

Run:

```bash
npx vitest run utils/journalCompletion.test.ts utils/manualAttestation.test.ts components/DiaryLog.test.tsx
npm run typecheck
```

Expected: PASS. The existing DiaryLog server-render regression ensures the new
imports do not require a browser merely to render the journal.

- [ ] **Step 7: Commit**

```bash
git add utils/journalCompletion.ts utils/journalCompletion.test.ts utils/manualAttestation.ts utils/manualAttestation.test.ts context/GameContext.tsx components/QuestLog.tsx components/DiaryLog.tsx
git diff --cached --check
git commit -m "fix: require manual journal completion attestation"
```
### Task 5: Pin the real Lumbridge method-cap regression

**Files:**
- Modify: `utils/journalStatus.test.ts`

**Interfaces:**
- Consumes: `evaluateDiaryTaskEligibility`, `ALL_DIARY_TASKS`, tier 1 cap 10, tier 2 cap 20.
- Produces no runtime interface.

- [ ] **Step 1: Add the exact real-task regression**

```ts
it('blocks lum_easy_7 at cap 10 and permits level 15 in the next method band', () => {
  const task = ALL_DIARY_TASKS.find(({ id }) => id === 'lum_easy_7')!;
  const common = {
    regions: ['Lumbridge'],
    levels: { Woodcutting: 15, Firemaking: 15 },
  };

  expect(evaluateDiaryTaskEligibility(task, unlocked({
    ...common,
    skills: { Woodcutting: 1, Firemaking: 1 },
  }))).toMatchObject({
    machineEligible: false,
    eligible: false,
  });

  expect(evaluateDiaryTaskEligibility(task, unlocked({
    ...common,
    skills: { Woodcutting: 2, Firemaking: 2 },
  }))).toMatchObject({
    machineEligible: true,
    eligible: true,
  });
});
```

- [ ] **Step 2: Run the regression**

Run: `npx vitest run utils/journalStatus.test.ts -t "lum_easy_7"`

Expected: PASS on the existing shared method-cap implementation. A failure is a regression in `meetsSkillRequirement`; fix that shared helper, not this test's data.

- [ ] **Step 3: Commit**

```bash
git add utils/journalStatus.test.ts
git commit -m "test: pin diary method cap behavior"
```

### Task 6: Add pure activity readiness and curated dependencies

**Files:**
- Create: `utils/activityReadiness.ts`
- Create: `utils/activityReadiness.test.ts`
- Modify: `data/activityRequirements.ts`

**Interfaces:**
- Produces:

```ts
export type ActivityBlocker =
  | { kind: 'area'; label: string }
  | { kind: 'quest'; label: string }
  | { kind: 'skill'; label: string }
  | { kind: 'combat'; label: string };

export type ActivityReadiness =
  | { status: 'LOCKED'; blockers: [] }
  | { status: 'NOT_READY'; blockers: ActivityBlocker[] }
  | { status: 'NEEDS_CONFIRMATION'; checks: string[] }
  | { status: 'READY' };

export function evaluateActivityReadiness(
  isOwned: boolean,
  requirement: ActivityReq | undefined,
  unlocks: UnlockState,
  gameModeId?: string,
): ActivityReadiness;
```

- [ ] **Step 1: Add failing evaluator tests**

```ts
const combatReady = {
  skills: { Attack: 4, Strength: 4, Defence: 4, Hitpoints: 4, Prayer: 4 },
  levels: { Attack: 40, Strength: 40, Defence: 40, Hitpoints: 40, Prayer: 40 },
};

it('evaluates ownership before all other requirements', () => {
  expect(evaluateActivityReadiness(
    false,
    { requiredAreas: ["Void Knights' Outpost"], combatLevel: 40 },
    unlocked(),
  )).toEqual({ status: 'LOCKED', blockers: [] });
});

it('separates Pest Control ownership from usable access', () => {
  const req = getActivityReq('Pest Control');
  expect(evaluateActivityReadiness(
    true,
    req,
    unlocked({ regions: ["Void Knights' Outpost"] }),
  )).toEqual({
    status: 'NOT_READY',
    blockers: [{ kind: 'combat', label: 'Combat level 40' }],
  });
  expect(evaluateActivityReadiness(
    true,
    req,
    unlocked(combatReady),
  )).toEqual({
    status: 'NOT_READY',
    blockers: [{ kind: 'area', label: "Void Knights' Outpost" }],
  });
  expect(evaluateActivityReadiness(
    true,
    req,
    unlocked({
      ...combatReady,
      regions: ["Void Knights' Outpost"],
    }),
  )).toEqual({ status: 'READY' });
});

it('uses the same area rule in chunked mode', () => {
  const req = getActivityReq('Barbarian Assault');
  expect(evaluateActivityReadiness(
    true,
    req,
    unlocked({ chunks: ['39,55'] }),
    'chunked',
  )).toEqual({ status: 'READY' });
});

it('returns manual checks only after machine gates pass', () => {
  const req = getActivityReq('Nex');
  expect(evaluateActivityReadiness(
    true,
    req,
    unlocked(),
  )).toEqual({
    status: 'NEEDS_CONFIRMATION',
    checks: ['A complete Frozen key from all four God Wars Dungeon generals'],
  });
});
```


- [ ] **Step 2: Run the new tests**

Run: `npx vitest run utils/activityReadiness.test.ts`

Expected: FAIL because the evaluator and structured fields do not exist.

- [ ] **Step 3: Extend the activity schema**

```ts
export interface ActivityReq {
  skills?: Record<string, number>;
  quests?: string[];
  requiredAreas?: string[];
  combatLevel?: number;
  manualRequirements?: string[];
  note?: string;
}
```

Apply these exact dependencies:

```ts
'Pest Control': {
  requiredAreas: ["Void Knights' Outpost"],
  combatLevel: 40,
  note: 'Novice boat.',
},
'Barbarian Assault': { requiredAreas: ['Barbarian Outpost'] },
'Castle Wars': { requiredAreas: ['Castle Wars'] },
'Fishing Trawler': {
  skills: { Fishing: 15 },
  requiredAreas: ['Port Khazard'],
},
'Gnome Ball': { requiredAreas: ['Tree Gnome Stronghold'] },
'Gnome Restaurant': { requiredAreas: ['Tree Gnome Stronghold'] },
'Nightmare Zone': {
  requiredAreas: ['Yanille'],
  note: 'Requires several quests completed for the dream bosses.',
},
'TzHaar Fight Pit': {
  requiredAreas: ['Mor Ul Rek (TzHaar City)'],
},
'Burthorpe Games Room': { requiredAreas: ['Burthorpe'] },
'Mage Training Arena': { requiredAreas: ['Mage Training Arena'] },
"Warriors' Guild": {
  requiredAreas: ["Warriors' Guild"],
  note: '99 Attack or Strength, or 130 combined.',
},
'Nex': {
  manualRequirements: [
    'A complete Frozen key from all four God Wars Dungeon generals',
  ],
},
```

Retain useful explanatory text, but remove duplicated prose that has become a structured field.

- [ ] **Step 4: Implement the evaluator in the specified order**

```ts
export function evaluateActivityReadiness(
  isOwned: boolean,
  requirement: ActivityReq | undefined,
  unlocks: UnlockState,
  gameModeId?: string,
): ActivityReadiness {
  if (!isOwned) return { status: 'LOCKED', blockers: [] };
  const blockers: ActivityBlocker[] = [];
  for (const area of requirement?.requiredAreas ?? []) {
    if (!isAreaReachable(area, unlocks, gameModeId)) {
      blockers.push({ kind: 'area', label: area });
    }
  }
  for (const quest of requirement?.quests ?? []) {
    if (!unlocks.quests.includes(quest)) {
      blockers.push({ kind: 'quest', label: quest });
    }
  }
  for (const [skill, level] of Object.entries(requirement?.skills ?? {})) {
    if (!meetsSkillRequirement(unlocks, skill, level)) {
      blockers.push({ kind: 'skill', label: `${skill} ${level}` });
    }
  }
  if (
    requirement?.combatLevel !== undefined
    && effectiveCombatLevel(unlocks) < requirement.combatLevel
  ) {
    blockers.push({
      kind: 'combat',
      label: `Combat level ${requirement.combatLevel}`,
    });
  }
  if (blockers.length > 0) return { status: 'NOT_READY', blockers };
  const checks = [...new Set(requirement?.manualRequirements ?? [])];
  return checks.length > 0
    ? { status: 'NEEDS_CONFIRMATION', checks }
    : { status: 'READY' };
}
```

- [ ] **Step 5: Run readiness and reachability tests**

Run: `npx vitest run utils/activityReadiness.test.ts utils/runelitePluginParity.test.ts utils/banks.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/activityReadiness.ts utils/activityReadiness.test.ts data/activityRequirements.ts
git commit -m "feat: model activity readiness dependencies"
```

### Task 7: Display readiness without changing ownership counts

**Files:**
- Create: `components/ActivityReadinessBadge.tsx`
- Create: `components/ActivityReadinessBadge.test.tsx`
- Modify: `components/Dashboard.tsx`

**Interfaces:**
- Consumes: `ActivityReadiness`
- Produces: `ActivityReadinessBadge({ readiness }: { readiness: ActivityReadiness })`
- `UnlockCard` gains `readiness?: ActivityReadiness`.

- [ ] **Step 1: Add failing server-rendered presentation tests**

```tsx
it('renders machine blockers and manual checks distinctly', () => {
  expect(renderToStaticMarkup(
    <ActivityReadinessBadge readiness={{
      status: 'NOT_READY',
      blockers: [{ kind: 'area', label: "Void Knights' Outpost" }],
    }} />,
  )).toContain("Void Knights' Outpost");

  expect(renderToStaticMarkup(
    <ActivityReadinessBadge readiness={{
      status: 'NEEDS_CONFIRMATION',
      checks: ['Complete Frozen key'],
    }} />,
  )).toContain('Confirm: Complete Frozen key');
});

it('keeps locked, ready, and not-ready labels distinct', () => {
  expect(markup({ status: 'LOCKED', blockers: [] })).toContain('Not owned');
  expect(markup({ status: 'READY' })).toContain('Ready');
  expect(markup({
    status: 'NOT_READY',
    blockers: [{ kind: 'combat', label: 'Combat level 40' }],
  })).toContain('Not ready');
});
```

- [ ] **Step 2: Run the component test**

Run: `npx vitest run components/ActivityReadinessBadge.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the focused badge**

Render these exact labels:

```ts
const label = readiness.status === 'LOCKED' ? 'Not owned'
  : readiness.status === 'NOT_READY' ? 'Not ready'
  : readiness.status === 'NEEDS_CONFIRMATION' ? 'Check required'
  : 'Ready';

const summary = readiness.status === 'NOT_READY'
  ? readiness.blockers.map(blocker => blocker.label).join(', ')
  : readiness.status === 'NEEDS_CONFIRMATION'
    ? 'Confirm: ' + readiness.checks.join(', ')
    : '';
```

Use existing Tailwind colors: gray for `LOCKED`, red for `NOT_READY`, cyan for `NEEDS_CONFIRMATION`, and emerald for `READY`.

- [ ] **Step 4: Wire readiness into `UnlockCard`**

In `renderGridSection`:

```tsx
const req = getActivityReq(label);
const readiness = evaluateActivityReadiness(
  isUnlocked,
  req,
  unlocks,
  gameModeId,
);
```

Pass both `req` and `readiness`. Render `<ActivityReadinessBadge>` below the region/requirement chips. Do not alter:

```ts
const isUnlocked = unlocked.includes(item);
const got = c.unlocked.length;
```

Those lines preserve ownership semantics.

- [ ] **Step 5: Run component and type tests**

Run: `npx vitest run components/ActivityReadinessBadge.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ActivityReadinessBadge.tsx components/ActivityReadinessBadge.test.tsx components/Dashboard.tsx
git commit -m "feat: show activity readiness on dashboard"
```

### Task 8: Add zero-key `View pool` navigation

**Files:**
- Create: `utils/dashboardPoolNavigation.ts`
- Create: `utils/dashboardPoolNavigation.test.ts`
- Modify: `components/GachaSection.tsx`
- Create: `components/GachaSection.test.tsx`
- Modify: `components/Dashboard.tsx`

**Interfaces:**
- Produces:

```ts
export interface DashboardPoolTarget {
  target: 'tab:CHARACTER' | 'tab:WORLD' | 'tab:ACTIVITIES';
  activityCategory?: string;
}

export function dashboardPoolTarget(table: TableType): DashboardPoolTarget;
export function openDashboardPool(table: TableType): void;
```

- `fate:nav` detail gains optional `activityCategory`.

- [ ] **Step 1: Add failing table-mapping tests**

```ts
it.each([
  [TableType.EQUIPMENT, { target: 'tab:CHARACTER' }],
  [TableType.SKILLS, { target: 'tab:CHARACTER' }],
  [TableType.REGIONS, { target: 'tab:WORLD' }],
  [TableType.CHUNKS, { target: 'tab:WORLD' }],
  [TableType.BOSSES, { target: 'tab:ACTIVITIES', activityCategory: 'BOSSES' }],
  [TableType.MINIGAMES, { target: 'tab:ACTIVITIES', activityCategory: 'MINIGAMES' }],
  [TableType.FARMING_LAYERS, { target: 'tab:ACTIVITIES', activityCategory: 'FARMING' }],
  [TableType.MOBILITY, { target: 'tab:ACTIVITIES', activityCategory: 'MOBILITY' }],
  [TableType.GUILDS, { target: 'tab:ACTIVITIES', activityCategory: 'GUILDS' }],
  [TableType.ARCANA, { target: 'tab:ACTIVITIES', activityCategory: 'ARCANA' }],
  [TableType.POH, { target: 'tab:ACTIVITIES', activityCategory: 'POH' }],
  [TableType.STORAGE, { target: 'tab:ACTIVITIES', activityCategory: 'STORAGE' }],
  [TableType.MERCHANTS, { target: 'tab:ACTIVITIES', activityCategory: 'MERCHANTS' }],
  [TableType.SLAYER_UNLOCKS, { target: 'tab:ACTIVITIES', activityCategory: 'SLAYER' }],
  [TableType.BANKS, { target: 'tab:ACTIVITIES', activityCategory: 'BANKS' }],
])('maps %s to its existing dashboard pool', (table, expected) => {
  expect(dashboardPoolTarget(table)).toEqual(expected);
});
```

- [ ] **Step 2: Run the mapping test**

Run: `npx vitest run utils/dashboardPoolNavigation.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the exhaustive mapping and event**

```ts
const ACTIVITY_CATEGORY: Partial<Record<TableType, string>> = {
  [TableType.BOSSES]: 'BOSSES',
  [TableType.MINIGAMES]: 'MINIGAMES',
  [TableType.FARMING_LAYERS]: 'FARMING',
  [TableType.MOBILITY]: 'MOBILITY',
  [TableType.GUILDS]: 'GUILDS',
  [TableType.ARCANA]: 'ARCANA',
  [TableType.POH]: 'POH',
  [TableType.STORAGE]: 'STORAGE',
  [TableType.MERCHANTS]: 'MERCHANTS',
  [TableType.SLAYER_UNLOCKS]: 'SLAYER',
  [TableType.BANKS]: 'BANKS',
};

export const dashboardPoolTarget = (table: TableType): DashboardPoolTarget => {
  if (table === TableType.EQUIPMENT || table === TableType.SKILLS) {
    return { target: 'tab:CHARACTER' };
  }
  if (table === TableType.REGIONS || table === TableType.CHUNKS) {
    return { target: 'tab:WORLD' };
  }
  const activityCategory = ACTIVITY_CATEGORY[table];
  if (!activityCategory) {
    throw new Error(`No dashboard pool target for ${table}`);
  }
  return { target: 'tab:ACTIVITIES', activityCategory };
};

export const openDashboardPool = (table: TableType): void => {
  window.dispatchEvent(new CustomEvent('fate:nav', {
    detail: dashboardPoolTarget(table),
  }));
};
```

- [ ] **Step 4: Split the spend card’s roll and pool actions**

Export `SpendCard` for its focused test. Add `onViewPool: () => void`. Its outer element must be a `<div>`, with:

```tsx
<button
  type="button"
  onClick={onClick}
  disabled={!isClickable}
  aria-label={`Roll ${label}`}
>
  {/* existing icon, title, progress, roll state, and key overlay */}
</button>
<button
  type="button"
  onClick={onViewPool}
  className="mt-1.5 w-full text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-white"
>
  View pool
</button>
```

The disabled key overlay belongs inside the roll button only. Pass:

```tsx
onViewPool={() => openDashboardPool(c.type)}
```

- [ ] **Step 5: Teach Dashboard to select the requested category**

Extend its event detail and handler:

```ts
const {
  target = '',
  query,
  activityCategory: requestedActivityCategory,
} = (e as CustomEvent<{
  target?: string;
  query?: string;
  activityCategory?: string;
}>).detail ?? {};

if (target.startsWith('tab:')) {
  const [tab, subTab] = target.slice(4).split('/');
  setActiveTab(tab);
  if (requestedActivityCategory && tab === 'ACTIVITIES') {
    setActivityCategory(requestedActivityCategory);
  }
  if (tab === 'WORLD') setWorldView('LIST');
  // retain existing Journal sub-tab and query behavior
}
```

- [ ] **Step 6: Prove `View pool` is rendered when Keys are zero**

In `components/GachaSection.test.tsx`, server-render `SpendCard`:

```tsx
const html = renderToStaticMarkup(
  <SpendCard
    type={TableType.BOSSES}
    label="Bosses"
    subLabel="Major Encounters"
    unlocked={0}
    total={10}
    disabled={false}
    keysAvailable={false}
    complete={false}
    onClick={() => undefined}
    onViewPool={() => undefined}
  />,
);
expect(html).toContain('View pool');
expect(html).toContain('Need Keys');
expect(html).toContain('aria-label="Roll Bosses"');
```

- [ ] **Step 7: Run the focused tests and typecheck**

Run:

```bash
npx vitest run utils/dashboardPoolNavigation.test.ts components/GachaSection.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add utils/dashboardPoolNavigation.ts utils/dashboardPoolNavigation.test.ts components/GachaSection.tsx components/GachaSection.test.tsx components/Dashboard.tsx
git commit -m "feat: expose spend category pools without keys"
```

### Task 9: Verify, document, and update issue state

**Files:**
- No source-file changes.
- GitHub issue metadata after the implementation branch is pushed and merged.
- No production-rate files.

**Interfaces:**
- Produces release evidence for tracker issues #7, #8, #9 and RuneLite issue #5.

- [ ] **Step 1: Run the full deterministic gate**

Run:

```bash
npm test
npm run typecheck
npm run content:verify
npm run build
```

Expected: all tests pass, typecheck passes, content verification reports current generated files, and Vite builds.

- [ ] **Step 2: Prove no balance files changed**

Run:

```bash
git diff origin/main...HEAD -- config/gameModes.ts data/bossKeyTiers.ts context/GameContext.tsx
```

Expected: no rate/pity/cap changes. The only permitted `GameContext.tsx` diff is attestation plumbing.

- [ ] **Step 3: Perform a local UI smoke check**

Run: `npm run dev -- --host 127.0.0.1`

Check:

1. Spend Keys shows `View pool` on every category at zero Keys.
2. Bosses opens Dashboard → Activities → Bosses.
3. Regions/Chunks opens Dashboard → World list.
4. Owned Pest Control without the outpost shows `Not ready`.
5. Adding the outpost and combat 40 shows `Ready`.
6. Varrock Hard Kudos is not counted in “now”, but completion asks for confirmation.
7. Cancelling confirmation leaves the task incomplete.

Expected: all seven pass. Stop the dev server after the check.

- [ ] **Step 4: Confirm maintained help copy remains truthful**

Run:

```bash
rg -n "Spend Keys|View pool|require.*Key|need.*Key" README.md components/GachaSection.tsx
```

Expected: README describes spending Keys but does not claim a Key is required
to inspect a category pool; `GachaSection.tsx` exposes `View pool` separately
from the disabled roll action. Make no README commit.

- [ ] **Step 5: Update tracker issues after the implementation branch is pushed**

Use these evidence points in comments:

- #7: canonical blockers precede chunk evidence; absent canonical and chunk evidence now returns `NO_DATA`; include the focused and full test commands.
- #8: `lum_easy_7` is blocked at method cap 10 and passes at the next band with levels still 15; no cap model changed.
- #9: list the eleven curated dependency pairs, ownership/readiness separation, and activity readiness test.

Close #7, #8, and #9 only after the PR containing these commits is merged.

- [ ] **Step 6: Update RuneLite issue #5 without losing the balance proposal**

Comment with:

```text
Tracker-side work completed:
- Varrock Medium Champions' Guild now requires 32 derived Quest Points.
- Varrock Hard uses an explicit player confirmation for 153 Museum Kudos; Bone Voyage was not made mandatory.
- Every spend category now exposes View pool even at zero Keys.

The Brutus/diminishing-odds/per-boss-cap proposal is not included. It is tracked with the broader evidence-first balance work in OSRS-Fate-Locked#10. No production rates changed here.
```

Close RuneLite issue #5 only after the tracker PR is merged and issue #10 visibly contains the deferred boss proposal.

- [ ] **Step 7: Record the final verification commit**

```bash
git status --short
git log --oneline origin/main..HEAD
```

Expected: only intentional commits, no generated drift, no staged build output, and no untracked secrets.
