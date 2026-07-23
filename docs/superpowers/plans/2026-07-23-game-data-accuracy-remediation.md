# Game-data Accuracy Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct current quest, Achievement Diary, and Combat Achievement data and route every recommendation and completion action through shared mode-aware eligibility rules without losing historical progress.

**Architecture:** Add focused requirement primitives to QuestData, then make pure evaluators the only source of Journal eligibility. Rebuild Diary and CA generated datasets from reviewed committed source snapshots, preserve legacy task IDs through explicit migrations, and derive CA reward tiers from cumulative task points.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Node.js 22 data-generation scripts, OSRS Wiki source snapshots.

## Global Constraints

- Do not modify RuneLite plugin code or the runelite-plugin mirror.
- Do not change Fate Point rewards, key odds, adjacency, seeded randomness, or balance rules.
- Keep quest IDs, TableType values, unlocks.arcana, unlocks.diaries, unlocks.cas, and existing completed task IDs backward compatible.
- Previously earned Diary and CA tiers are sticky and must never be revoked.
- Generated data/caTasks.ts and the new generated data/diaryTasks.ts must be changed through their generators, never by hand.
- Pull-request verification must not require live wiki access.
- Every behavior change follows RED, GREEN, REFACTOR: write a failing test, observe the intended failure, implement only enough to pass, and rerun the covering tests.
- Every task ends in a focused commit using a message file, not a quoted multiline PowerShell message.

---

## File Structure

**Create**

- <code>data/questData.accuracy.test.ts</code>: exact current requirements and absence of known stale routes/prerequisites.
- <code>utils/journalCompletion.ts</code> and <code>utils/journalCompletion.test.ts</code>: pure completion decisions used by GameContext.
- <code>data/sources/achievement-diary-tasks.json</code>: reviewed committed 492-task source snapshot.
- <code>scripts/sync-achievement-diaries.mjs</code> and <code>scripts/sync-achievement-diaries.test.ts</code>: deterministic Diary snapshot parser/renderer.
- <code>utils/taskIdMigrations.ts</code> and <code>utils/taskIdMigrations.test.ts</code>: idempotent old-ID migration.
- <code>utils/caProgress.ts</code> and <code>utils/caProgress.test.ts</code>: CA point totals and sticky earned tiers.
- <code>data/contentBaseline.test.ts</code>: exact quest/Diary/CA release baseline.

**Modify**

- <code>data/questData.ts</code>: combat, exact-location, manual, and recent-quest requirements.
- <code>utils/journalStatus.ts</code> and tests: canonical structured eligibility.
- <code>utils/journalProgress.ts</code> and tests: render blockers from the canonical result.
- <code>components/QuestLog.tsx</code>, <code>components/QuestDoabilityPanel.tsx</code>, <code>components/DiaryLog.tsx</code>, and <code>components/CALog.tsx</code>: consume canonical results/actions.
- <code>context/GameContext.tsx</code>: additive completion actions and sticky tier awards.
- <code>utils/questAdvisor.ts</code>, <code>utils/goalPlanner.ts</code>, and their consumers/tests: thread gameModeId consistently.
- <code>data/diaryTasks.ts</code>: generated 492-task output.
- <code>scripts/sync-combat-achievements.mjs</code> and <code>data/caTasks.ts</code>: refreshed 637-task output and source metadata.
- <code>data/caData.ts</code>, <code>components/JournalInsights.tsx</code>, and <code>components/JournalSummaryCard.tsx</code>: current thresholds and cumulative points.
- <code>data/tasksConsistency.test.ts</code>: exact totals, references, locations, and task IDs.
- <code>data/changelog.ts</code>: truthful release wording.
- <code>package.json</code> and <code>docs/CONTENT_SYNC.md</code>: Diary sync command and generated-data instructions.

---

### Task 1: Canonical quest requirements and eligibility

**Files:**

- Create: <code>data/questData.accuracy.test.ts</code>
- Modify: <code>data/questData.ts</code>
- Modify: <code>utils/journalStatus.ts</code>
- Modify: <code>utils/journalStatus.test.ts</code>
- Modify: <code>utils/journalProgress.ts</code>
- Modify: <code>utils/journalProgress.test.ts</code>
- Modify: <code>components/QuestLog.tsx</code>
- Modify: <code>components/QuestDoabilityPanel.tsx</code>
- Modify: <code>data/tasksConsistency.test.ts</code>

**Interfaces:**

- Produces <code>QuestLocationRequirement</code>, <code>EligibilityBlocker</code>, <code>QuestEligibility</code>, <code>locationRequirementMet(location, unlocks, gameModeId)</code>, and <code>evaluateQuestEligibility(quest, unlocks, gameModeId)</code>.
- Preserves <code>getQuestStatus</code> as a wrapper returning <code>evaluateQuestEligibility(...).status</code>.
- Uses <code>combatLevel(unlocks.levels)</code> from <code>utils/slayerReach.ts</code> and exact Chunked checks through <code>isChunkUnlocked(chunkKey(coord), unlocks.chunks)</code>.

- [ ] **Step 1: Write failing requirement and evaluator tests**

Add exact record assertions to <code>data/questData.accuracy.test.ts</code>:

~~~ts
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from './questData';

describe('audited current quest requirements', () => {
  it('uses the real Porcine route', () => {
    const q = QUEST_DATA['A Porcine of Interest'];
    expect(q.regions).not.toContain('Port Sarim');
    expect(q.locations?.map(x => x.id)).toEqual([
      'draynor-village', 'south-falador-farm',
    ]);
    expect(q.locations?.[1].chunkOptions).toEqual([{ cx: 47, cy: 51 }]);
  });

  it('models Dream Mentor as calculated combat', () => {
    const q = QUEST_DATA['Dream Mentor'];
    expect(q.combatLevel).toBe(85);
    expect(q.skills).not.toHaveProperty('Combat');
  });

  it('pins the corrected recent quest block', () => {
    expect(QUEST_DATA['Ethically Acquired Antiquities']).toMatchObject({
      skills: { Thieving: 25 },
      prereqs: ['Children of the Sun', 'Shield of Arrav'],
    });
    expect(QUEST_DATA['Ethically Acquired Antiquities'].locations?.map(x => x.id)).toEqual([
      'civitas-illa-fortis', 'port-sarim', 'varrock-museum',
    ]);
    expect(QUEST_DATA['The Curse of Arrav']).toMatchObject({
      skills: { Agility: 61, Ranged: 62, Strength: 58, Thieving: 62, Mining: 64, Slayer: 37 },
      prereqs: ['Defender of Varrock', 'Troll Romance'],
    });
    expect(QUEST_DATA['The Final Dawn']).toMatchObject({
      skills: { Thieving: 66, Fletching: 52, Runecraft: 52 },
      prereqs: ['The Heart of Darkness', 'Perilous Moons'],
    });
    expect(QUEST_DATA['Shadows of Custodia']).toMatchObject({
      skills: { Slayer: 54, Fishing: 45, Construction: 41, Hunter: 36 },
      prereqs: ['Children of the Sun'],
    });
    expect(QUEST_DATA['Scrambled!']).toMatchObject({
      skills: { Construction: 38, Cooking: 36, Smithing: 35 },
      prereqs: ['Children of the Sun'],
    });
    expect(QUEST_DATA['Pandemonium']).toMatchObject({
      skills: {},
      prereqs: [],
    });
    expect(QUEST_DATA['Pandemonium'].locations?.map(x => x.id)).toEqual(['port-sarim']);
    expect(QUEST_DATA['Prying Times']).toMatchObject({
      skills: { Smithing: 30, Sailing: 12 },
      prereqs: ['Pandemonium', "The Knight's Sword"],
      manualRequirements: ['One open Sailing task slot'],
    });
    expect(QUEST_DATA['Current Affairs']).toMatchObject({
      skills: { Sailing: 22, Fishing: 10 }, prereqs: ['Pandemonium'],
    });
    expect(QUEST_DATA['Troubled Tortugans']).toMatchObject({
      skills: { Slayer: 51, Construction: 48, Sailing: 45, Hunter: 45, Woodcutting: 40, Crafting: 34 },
      prereqs: ['Pandemonium'],
    });
  });
});
~~~

Extend <code>utils/journalStatus.test.ts</code> with combat, exact chunk, and blocker assertions:

~~~ts
it('requires the exact South Falador Farm chunk in Chunked mode', () => {
  const q = QUEST_DATA['A Porcine of Interest'];
  const near = unlocked({ chunks: ['46,51', '48,50'] });
  const exact = unlocked({ chunks: ['47,51', '48,50'] });
  expect(evaluateQuestEligibility(q, near, 'chunked').status).toBe('LOCKED_REGION');
  expect(evaluateQuestEligibility(q, exact, 'chunked').status).toBe('AVAILABLE');
});

it('calculates Dream Mentor combat instead of reading a pseudo-skill', () => {
  const q = QUEST_DATA['Dream Mentor'];
  const base = unlocked({
    regions: ['Fremennik'], quests: ['Lunar Diplomacy', "Eadgar's Ruse"],
    skills: { Attack: 10, Strength: 10, Defence: 10, Hitpoints: 10, Prayer: 10, Ranged: 10, Magic: 10 },
    levels: { Attack: 70, Strength: 70, Defence: 70, Hitpoints: 84, Prayer: 70, Ranged: 70, Magic: 70 },
  });
  expect(evaluateQuestEligibility(q, base).blockers).toContainEqual({
    kind: 'combat', label: 'Combat level 85',
  });
});
~~~

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

~~~powershell
npm test -- data/questData.accuracy.test.ts utils/journalStatus.test.ts utils/journalProgress.test.ts
~~~

Expected: FAIL because <code>locations</code>, <code>combatLevel</code>, and <code>evaluateQuestEligibility</code> do not exist and the recent quest records are stale.

- [ ] **Step 3: Add the focused requirement types**

Add to <code>data/questData.ts</code>:

~~~ts
export interface QuestLocationRequirement {
  id: string;
  label: string;
  standardAreas: string[];
  chunkOptions: Array<{ cx: number; cy: number }>;
}

export interface QuestRequirementOption {
  regions?: string[];
  guilds?: string[];
  locations?: QuestLocationRequirement[];
}

export interface QuestData {
  id: string;
  name: string;
  regions: string[];
  skills: Record<string, number>;
  combatLevel?: number;
  locations?: QuestLocationRequirement[];
  manualRequirements?: string[];
  prereqs: string[];
  points: number;
  series?: string;
  difficulty: DropSource;
  oneOf?: QuestRequirementOption[];
}
~~~

- [ ] **Step 4: Implement the pure canonical evaluator**

In <code>utils/journalStatus.ts</code>, add these exported contracts and make <code>getQuestStatus</code> a wrapper:

~~~ts
export type EligibilityBlocker =
  | { kind: 'region'; label: string }
  | { kind: 'skill'; label: string }
  | { kind: 'combat'; label: string }
  | { kind: 'quest'; label: string };

export interface QuestEligibility {
  eligible: boolean;
  status: QuestStatus;
  blockers: EligibilityBlocker[];
  evidence: string[];
}

export const locationRequirementMet = (
  location: QuestLocationRequirement,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean => gameModeId === 'chunked'
  ? location.chunkOptions.some(coord =>
      isChunkUnlocked(chunkKey(coord), unlocks.chunks ?? []))
  : location.standardAreas.every(area =>
      isAreaReachable(area, unlocks, gameModeId));

export function evaluateQuestEligibility(
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): QuestEligibility {
  if (unlocks.quests.includes(quest.id)) {
    return { eligible: true, status: 'COMPLETED', blockers: [], evidence: ['Completed'] };
  }
  const blockers: EligibilityBlocker[] = [];
  const evidence: string[] = [];
  for (const region of quest.regions) {
    if (isAreaReachable(region, unlocks, gameModeId)) evidence.push(region);
    else blockers.push({ kind: 'region', label: region });
  }
  for (const location of quest.locations ?? []) {
    if (locationRequirementMet(location, unlocks, gameModeId)) evidence.push(location.label);
    else blockers.push({ kind: 'region', label: location.label });
  }
  if (!questAlternativesMet(quest, unlocks, gameModeId)) {
    blockers.push({ kind: 'region', label: quest.oneOf!.map(questRequirementOptionLabel).join(' or ') });
  }
  const qp = currentQuestPoints(unlocks);
  for (const [skill, required] of Object.entries(quest.skills)) {
    const met = skill === 'Quest Points'
      ? qp >= required
      : meetsSkillRequirement(unlocks, skill, required);
    if (met) evidence.push(skill + ' ' + required);
    else blockers.push({ kind: 'skill', label: skill + ' ' + required });
  }
  if (quest.combatLevel !== undefined) {
    if (combatLevel(unlocks.levels) >= quest.combatLevel) evidence.push('Combat level ' + quest.combatLevel);
    else blockers.push({ kind: 'combat', label: 'Combat level ' + quest.combatLevel });
  }
  for (const prereq of quest.prereqs) {
    if (unlocks.quests.includes(prereq)) evidence.push(prereq);
    else blockers.push({ kind: 'quest', label: prereq });
  }
  const status: QuestStatus = blockers.some(x => x.kind === 'region') ? 'LOCKED_REGION'
    : blockers.some(x => x.kind === 'skill' || x.kind === 'combat') ? 'LOCKED_SKILL'
    : blockers.some(x => x.kind === 'quest') ? 'LOCKED_QUEST'
    : 'AVAILABLE';
  return { eligible: status === 'AVAILABLE', status, blockers, evidence };
}

export function getQuestStatus(
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): QuestStatus {
  return evaluateQuestEligibility(quest, unlocks, gameModeId).status;
}
~~~

Update alternative helpers so <code>locations</code> are checked and labels include their player-facing labels.

- [ ] **Step 5: Correct the audited quest records**

Apply the exact values asserted in Step 1. Use these location records:

~~~ts
const LOCATIONS = {
  draynorVillage: { id: 'draynor-village', label: 'Draynor Village', standardAreas: ['Draynor Village'], chunkOptions: [{ cx: 48, cy: 50 }] },
  southFaladorFarm: { id: 'south-falador-farm', label: 'South Falador Farm', standardAreas: ['Falador'], chunkOptions: [{ cx: 47, cy: 51 }] },
  civitas: { id: 'civitas-illa-fortis', label: 'Civitas illa Fortis', standardAreas: ['Civitas illa Fortis'], chunkOptions: [{ cx: 26, cy: 48 }] },
  portSarim: { id: 'port-sarim', label: 'Port Sarim', standardAreas: ['Port Sarim'], chunkOptions: [{ cx: 47, cy: 50 }] },
  varrockMuseum: { id: 'varrock-museum', label: 'Varrock Museum', standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 53 }] },
  pandemonium: { id: 'the-pandemonium', label: 'The Pandemonium', standardAreas: ['The Pandemonium'], chunkOptions: [{ cx: 47, cy: 46 }] },
} satisfies Record<string, QuestLocationRequirement>;
~~~

A Porcine uses Draynor Village plus South Falador Farm. Ethically Acquired Antiquities uses Civitas, Port Sarim, and Varrock Museum. Pandemonium has no skill/quest prerequisite and uses Port Sarim for its real start/access. Do not add unverified extra location gates to the Sailing follow-up quests. Keep <code>manualRequirements</code> display-only.

- [ ] **Step 6: Remove duplicate status refinement from UI blockers**

Change QuestLog and QuestDoabilityPanel to call <code>evaluateQuestEligibility</code> once per quest. Keep <code>questLocations()</code> only for informational location chips/map links; it must no longer override status through <code>requiredRegionsReachable</code>. Change <code>questUnmet</code> to return <code>evaluateQuestEligibility(...).blockers</code> mapped to its existing Unmet shape.

- [ ] **Step 7: Tighten integrity checks and verify GREEN**

Remove <code>Combat</code> from <code>META_SKILL</code>. Validate every standard area, chunk coordinate, alternative location, and prerequisite in <code>data/tasksConsistency.test.ts</code>.

Run:

~~~powershell
npm test -- data/questData.accuracy.test.ts data/tasksConsistency.test.ts utils/journalStatus.test.ts utils/journalProgress.test.ts components/QuestDoabilityPanel.test.tsx utils/advisor.test.ts utils/goalPlanner.test.ts
npx tsc --noEmit
~~~

Expected: all selected tests PASS and TypeScript reports no errors.

- [ ] **Step 8: Commit Task 1**

Stage only the files listed for Task 1 and commit with subject:

~~~text
fix: canonicalize quest eligibility
~~~

---

### Task 2: Eligibility-gated quest and Diary completion actions

**Files:**

- Create: <code>utils/journalCompletion.ts</code>
- Create: <code>utils/journalCompletion.test.ts</code>
- Modify: <code>utils/journalStatus.ts</code>
- Modify: <code>context/GameContext.tsx</code>
- Modify: <code>components/QuestLog.tsx</code>
- Modify: <code>components/DiaryLog.tsx</code>
- Modify: <code>utils/questAdvisor.ts</code>
- Modify: callers/tests of <code>questAdvisor</code>

**Interfaces:**

- Produces <code>CompletionResult</code>, <code>evaluateDiaryTaskEligibility</code>, <code>canEarnDiaryTier</code>, <code>completeQuest(id, x?, y?)</code>, <code>completeDiaryTask(id, x?, y?)</code>, and <code>completeDiaryTier(id)</code>.
- Completion methods are additive; no first-party action removes historical completion.

- [ ] **Step 1: Write failing pure completion tests**

Create <code>utils/journalCompletion.test.ts</code> with real QUEST_DATA/DIARY_DATA fixtures:

~~~ts
it('rejects a quest completion when canonical eligibility is blocked', () => {
  const result = questCompletionDecision(
    QUEST_DATA['A Porcine of Interest'], unlocked({ regions: ['Port Sarim'] }), 'vanilla');
  expect(result).toEqual({ ok: false, reason: 'Requires: South Falador Farm' });
});

it('accepts a Diary task only when task skills quests and regions are met', () => {
  const task = { id: 'x', tierId: 'Falador Medium', skills: { Crafting: 36 }, regions: ['Falador'] };
  expect(diaryTaskCompletionDecision(task, unlocked(), 'vanilla').ok).toBe(false);
  expect(diaryTaskCompletionDecision(task, unlocked({
    regions: ['Falador'], skills: { Crafting: 4 }, levels: { Crafting: 36 },
  }), 'vanilla').ok).toBe(true);
});

it('earns a Diary tier only after every current task is complete', () => {
  expect(canEarnDiaryTier('Falador Easy', ['fal_easy_1'], [
    { id: 'fal_easy_1', tierId: 'Falador Easy' },
    { id: 'fal_easy_2', tierId: 'Falador Easy' },
  ])).toBe(false);
  expect(canEarnDiaryTier('Falador Easy', ['fal_easy_1', 'fal_easy_2'], [
    { id: 'fal_easy_1', tierId: 'Falador Easy' },
    { id: 'fal_easy_2', tierId: 'Falador Easy' },
  ])).toBe(true);
});
~~~

- [ ] **Step 2: Run the test and confirm RED**

Run <code>npm test -- utils/journalCompletion.test.ts</code>.

Expected: FAIL because the completion-decision module does not exist.

- [ ] **Step 3: Implement the pure decisions**

Use this contract in <code>utils/journalCompletion.ts</code>:

~~~ts
export type CompletionResult =
  | { ok: true }
  | { ok: false; reason: string };

export const questCompletionDecision = (
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): CompletionResult => {
  const result = evaluateQuestEligibility(quest, unlocks, gameModeId);
  if (result.status === 'COMPLETED') return { ok: false, reason: 'Already completed' };
  return result.eligible
    ? { ok: true }
    : { ok: false, reason: 'Requires: ' + result.blockers.map(x => x.label).join(', ') };
};

export const diaryTaskCompletionDecision = (
  task: DiaryTask,
  unlocks: UnlockState,
  gameModeId?: string,
): CompletionResult => {
  if (unlocks.completedTasks.includes(task.id)) return { ok: false, reason: 'Already completed' };
  const blockers = taskEligibilityBlockers(task, unlocks, gameModeId);
  return blockers.length === 0
    ? { ok: true }
    : { ok: false, reason: 'Requires: ' + blockers.map(x => x.label).join(', ') };
};

export const canEarnDiaryTier = (
  tierId: string,
  completedTaskIds: readonly string[],
  tasks: readonly Pick<DiaryTask, 'id' | 'tierId'>[],
): boolean => {
  const tierTasks = tasks.filter(task => task.tierId === tierId);
  const done = new Set(completedTaskIds);
  return tierTasks.length > 0 && tierTasks.every(task => done.has(task.id));
};
~~~

Expose <code>taskEligibilityBlockers</code> from journalStatus and make countDoableTasks use it.

- [ ] **Step 4: Replace toggles with additive GameContext completion methods**

Add reducer actions <code>COMPLETE_QUEST</code>, <code>COMPLETE_DIARY</code>, and <code>COMPLETE_TASK</code> that append only when absent. In callbacks, read <code>stateRef.current</code>, call the pure decision, show the returned reason on failure, dispatch only on success, and roll with the record's existing difficulty/rate only after a successful decision.

The public methods are:

~~~ts
completeQuest: (id: string, x?: number, y?: number) => CompletionResult;
completeDiaryTask: (id: string, x?: number, y?: number) => CompletionResult;
completeDiaryTier: (id: string) => CompletionResult;
~~~

When a successful Diary task completes the last current task in its tier, dispatch <code>COMPLETE_DIARY</code> once. Keep already stored tiers untouched.

- [ ] **Step 5: Wire the Quest and Diary UI**

QuestLog calls <code>completeQuest</code> and fires the reward-scroll event only when <code>result.ok</code>. DiaryLog calls <code>completeDiaryTask</code> and <code>completeDiaryTier</code>; remove its duplicated all-tasks and direct <code>rollForKey</code> logic.

Update <code>questAdvisor</code> to accept and forward <code>gameModeId</code>, then update every caller. A repository search for direct quest availability must show only canonical wrapper/evaluator calls:

~~~powershell
rg -n "getQuestStatus|evaluateQuestEligibility|unlocks.quests.includes" components utils -g "*.ts" -g "*.tsx"
~~~

Review every remaining direct completion check; history/display checks are allowed, eligibility branches are not.

- [ ] **Step 6: Verify and commit Task 2**

Run:

~~~powershell
npm test -- utils/journalCompletion.test.ts utils/journalStatus.test.ts utils/advisor.test.ts utils/goalPlanner.test.ts components/QuestDoabilityPanel.test.tsx
npx tsc --noEmit
~~~

Expected: all selected tests PASS.

Commit subject:

~~~text
fix: gate journal completion actions
~~~

---

### Task 3: Reproducible 492-task Achievement Diary dataset and ID migration

**Files:**

- Create: <code>data/sources/achievement-diary-tasks.json</code>
- Create: <code>scripts/sync-achievement-diaries.mjs</code>
- Create: <code>scripts/sync-achievement-diaries.test.ts</code>
- Create: <code>utils/taskIdMigrations.ts</code>
- Create: <code>utils/taskIdMigrations.test.ts</code>
- Modify: <code>data/diaryTasks.ts</code> (generator output)
- Modify: <code>data/tasksConsistency.test.ts</code>
- Modify: <code>context/GameContext.tsx</code>
- Modify: <code>package.json</code>
- Modify: <code>docs/CONTENT_SYNC.md</code>

**Interfaces:**

- Snapshot schema: <code>{ source, verifiedAt, tasks: DiarySourceTask[], retired: RetiredDiaryTask[] }</code>.
- Produces <code>renderDiaryTasks(snapshot)</code>, <code>DIARY_TASK_ID_MIGRATIONS</code>, and <code>migrateCompletedTaskIds(ids)</code>.
- Existing IDs are canonical when their task still exists; new IDs use <code>&lt;area-prefix&gt;_&lt;tier-prefix&gt;_&lt;official-ordinal&gt;</code> and are frozen in the snapshot after creation.

- [ ] **Step 1: Write failing parser, total, and migration tests**

In <code>scripts/sync-achievement-diaries.test.ts</code>, use a six-row HTML fixture spanning two tiers and assert decoded text, requirements, stable IDs, deterministic rendering, and refusal of duplicates/empty input.

In <code>data/tasksConsistency.test.ts</code>, add:

~~~ts
it('pins the current 492-task Diary baseline', () => {
  expect(ALL_DIARY_TASKS).toHaveLength(492);
  expect(new Set(ALL_DIARY_TASKS.map(task => task.id)).size).toBe(492);
});
~~~

In <code>utils/taskIdMigrations.test.ts</code>, add:

~~~ts
it('migrates aliases once and preserves unknown historical ids', () => {
  expect(migrateCompletedTaskIds(['old_a', 'old_a', 'current_b', 'retired_x'])).toEqual([
    'current_a', 'current_b', 'retired_x',
  ]);
  expect(migrateCompletedTaskIds(migrateCompletedTaskIds(['old_a']))).toEqual(['current_a']);
});
~~~

- [ ] **Step 2: Run tests and confirm RED**

Run:

~~~powershell
npm test -- scripts/sync-achievement-diaries.test.ts data/tasksConsistency.test.ts utils/taskIdMigrations.test.ts
~~~

Expected: parser/migration modules are missing and the current total is 485 rather than 492.

- [ ] **Step 3: Implement the deterministic snapshot renderer**

The renderer accepts only a committed JSON snapshot and emits the existing DiaryTask interface plus a generated-file header. It sorts by DIARY_DATA order and snapshot ordinal, escapes backslashes/apostrophes, refuses duplicate IDs or unknown tiers, and never contacts the network while rendering.

Export this pure signature from <code>scripts/sync-achievement-diaries.mjs</code>:

~~~js
export function renderDiaryTasks(snapshot) {
  validateSnapshot(snapshot);
  const lines = [
    'export interface DiaryTask {',
    '  id: string;',
    '  tierId: string;',
    '  description: string;',
    '  skills?: Record<string, number>;',
    '  quests?: string[];',
    '  regions?: string[];',
    '}',
    '',
    '// Generated from data/sources/achievement-diary-tasks.json.',
    '// Run npm run diary:sync; do not hand-edit this file.',
    'export const ALL_DIARY_TASKS: DiaryTask[] = [',
  ];
  for (const task of snapshot.tasks) lines.push(renderTask(task));
  lines.push('];', '');
  return lines.join('\n');
}
~~~

The executable entry reads the JSON snapshot, renders, and writes <code>data/diaryTasks.ts</code>. Add <code>"diary:sync": "node scripts/sync-achievement-diaries.mjs"</code> to package.json.

- [ ] **Step 4: Build and review the 492-task snapshot**

Fetch the authoritative Achievement Diary/All achievements page through the documented desktop-user-agent curl path, decode the returned table into a temporary candidate, and join it to the 485 current records by normalized area, tier, and task text. Classify every existing row as an exact semantic match, a genuine renamed/replaced predecessor, or retired. The committed snapshot must contain all 492 official rows, retain the ID of every semantic match, assign and freeze a new ID only when an official row has no legitimate predecessor, and include explicit aliases only for genuine renamed/replaced successors. Do not assume the seven-row total increase means exactly seven new canonical IDs: replacements and retirements must be reported from the actual comparison.

Before writing generated output, print and review these reports:

~~~text
official rows: 492
existing rows classified: 485
unresolved existing rows: 0
unresolved duplicate ids: 0
unknown tiers/skills/quests/regions: 0
~~~

In the same report, print numeric counts for preserved exact/semantic IDs, renamed/replaced aliases, retired existing IDs, and new canonical IDs. Those category counts must come from the actual comparison and sum consistently; they are review output, not preselected targets. Abort instead of committing unless official rows equal 492, all 485 existing rows are classified, unresolved/duplicate/reference counts are zero, and every alias target exists. Run <code>npm run diary:sync</code> twice and require a byte-identical second result.

- [ ] **Step 5: Implement idempotent completed-task migration**

Generate <code>DIARY_TASK_ID_MIGRATIONS</code> from snapshot aliases and implement:

~~~ts
export const migrateCompletedTaskIds = (ids: readonly string[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const canonical = DIARY_TASK_ID_MIGRATIONS[id] ?? id;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
};
~~~

Call it in the existing save migration after loading <code>completedTasks</code>. Do not drop unknown retired IDs.

- [ ] **Step 6: Verify dataset, migration, and generator discipline**

Run:

~~~powershell
npm run diary:sync
npm test -- scripts/sync-achievement-diaries.test.ts data/tasksConsistency.test.ts utils/taskIdMigrations.test.ts utils/journalStatus.test.ts
git diff --exit-code -- data/diaryTasks.ts
npx tsc --noEmit
~~~

Expected: 492 tasks, all tests PASS, the second generator run produces no diff, and types pass.

Update CONTENT_SYNC.md with the snapshot source, review report, ID rules, and exact command.

- [ ] **Step 7: Commit Task 3**

Commit subject:

~~~text
fix: refresh achievement diary tasks
~~~

---

### Task 4: Current Combat Achievement data and cumulative points

**Files:**

- Create: <code>utils/caProgress.ts</code>
- Create: <code>utils/caProgress.test.ts</code>
- Modify: <code>scripts/sync-combat-achievements.mjs</code>
- Modify: <code>data/caTasks.ts</code> (generator output)
- Modify: <code>data/caData.ts</code>
- Modify: <code>data/tasksConsistency.test.ts</code>
- Modify: <code>context/GameContext.tsx</code>
- Modify: <code>components/CALog.tsx</code>
- Modify: <code>components/JournalInsights.tsx</code>
- Modify: <code>components/JournalSummaryCard.tsx</code>

**Interfaces:**

- Produces <code>CA_TIER_ORDER</code>, <code>CA_TASK_POINTS</code>, <code>completedCAPoints</code>, <code>earnedCATiers</code>, <code>newlyEarnedCATiers</code>, <code>completeCATask(id, x?, y?)</code>, and <code>completeCATier(id)</code>.

- [ ] **Step 1: Write failing threshold and point tests**

Create <code>utils/caProgress.test.ts</code>:

~~~ts
it('adds points across mixed tiers', () => {
  const tasks = [
    { id: 'e', tierId: 'Easy' },
    { id: 'm', tierId: 'Medium' },
    { id: 'g', tierId: 'Grandmaster' },
  ];
  expect(completedCAPoints(['e', 'm', 'g'], tasks)).toBe(9);
});

it('uses current cumulative reward thresholds', () => {
  expect(Object.values(CA_DATA).map(tier => tier.pointsRequired)).toEqual([
    41, 161, 416, 1064, 1904, 2630,
  ]);
});

it('keeps stored historical tiers while adding newly qualified tiers', () => {
  expect(earnedCATiers(161, ['Master'])).toEqual(['Easy', 'Medium', 'Master']);
  expect(newlyEarnedCATiers(161, ['Easy'])).toEqual(['Medium']);
});
~~~

Extend <code>data/tasksConsistency.test.ts</code> with exact total and tier counts:

~~~ts
expect(ALL_CA_TASKS).toHaveLength(637);
expect(counts).toEqual({ Easy: 41, Medium: 60, Hard: 85, Elite: 162, Master: 168, Grandmaster: 121 });
~~~

- [ ] **Step 2: Run tests and confirm RED**

Run <code>npm test -- utils/caProgress.test.ts data/tasksConsistency.test.ts</code>.

Expected: CA progress module is missing and thresholds/totals are stale.

- [ ] **Step 3: Implement cumulative point helpers**

Use:

~~~ts
export const CA_TIER_ORDER = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'] as const;
export const CA_TASK_POINTS: Record<(typeof CA_TIER_ORDER)[number], number> = {
  Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6,
};

export const completedCAPoints = (
  completedIds: readonly string[],
  tasks: readonly Pick<CATask, 'id' | 'tierId'>[] = ALL_CA_TASKS,
): number => {
  const done = new Set(completedIds);
  return tasks.reduce((sum, task) => sum + (done.has(task.id)
    ? CA_TASK_POINTS[task.tierId as keyof typeof CA_TASK_POINTS] ?? 0
    : 0), 0);
};

export const earnedCATiers = (points: number, stored: readonly string[] = []): string[] => {
  const sticky = new Set(stored);
  for (const tier of CA_TIER_ORDER) if (points >= CA_DATA[tier].pointsRequired) sticky.add(tier);
  return CA_TIER_ORDER.filter(tier => sticky.has(tier));
};

export const newlyEarnedCATiers = (points: number, stored: readonly string[]): string[] => {
  const previous = new Set(stored);
  return earnedCATiers(points, stored).filter(tier => !previous.has(tier));
};
~~~

Set CA_DATA thresholds to 41, 161, 416, 1064, 1904, 2630.

- [ ] **Step 4: Harden and run the CA generator**

Make the sync script emit source URL/verified date metadata and require the exact six tier counts before writing. Retain stable <code>ca_&lt;official-id&gt;</code> IDs. Run <code>npm run ca:sync</code>; require 637 rows and a byte-identical second run.

- [ ] **Step 5: Add additive CA completion actions**

A CA task completion rejects already-completed IDs, dispatches COMPLETE_TASK once, rolls once at the task tier's existing difficulty, calculates points including the candidate task, and dispatches every newly crossed tier as sticky COMPLETE_CA actions. Manual tier completion succeeds only when the cumulative threshold is met; it never checks whether every task in that same tier is complete.

Expose:

~~~ts
completeCATask: (id: string, x?: number, y?: number) => CompletionResult;
completeCATier: (id: string) => CompletionResult;
~~~

- [ ] **Step 6: Replace CALog tier-local semantics**

CALog displays total points and each cumulative threshold, calls the context completion methods, and removes tier-local <code>allDone</code>/<code>otherTasksDone</code> logic. JournalInsights and JournalSummaryCard use <code>completedCAPoints</code> and <code>earnedCATiers</code> rather than task-count approximations.

- [ ] **Step 7: Verify and commit Task 4**

Run:

~~~powershell
npm run ca:sync
npm test -- utils/caProgress.test.ts data/tasksConsistency.test.ts components/JournalInsights.test.tsx utils/achievements.test.ts
git diff --exit-code -- data/caTasks.ts
npx tsc --noEmit
~~~

Expected: 637 tasks with 41/60/85/162/168/121 distribution; tests and types PASS; second sync has no diff.

Commit subject:

~~~text
fix: use current combat achievement points
~~~

---

### Task 5: Cross-surface consistency, truthful release notes, and final data gate

**Files:**

- Create: <code>data/contentBaseline.test.ts</code>
- Modify: <code>utils/questAdvisor.ts</code> and tests/callers
- Modify: <code>utils/goalPlanner.ts</code> and tests if a direct requirement branch remains
- Modify: <code>components/JournalNextBest.tsx</code>
- Modify: <code>components/JournalSummaryCard.tsx</code>
- Modify: <code>data/changelog.ts</code>
- Modify: <code>docs/SYNC_STATUS.md</code> through the documented generator only

**Interfaces:**

- Produces one deterministic baseline suite proving the current quest records, 492 Diaries, 637 CAs, tier distribution, thresholds, and valid source metadata.

- [ ] **Step 1: Write the failing cross-surface regression**

Add a test that builds one Chunked-mode unlock snapshot and asserts QuestLog's exported eligibility adapter, questAdvisor, goalPlanner, JournalNextBest ranking input, and the completion decision all return the same status for A Porcine of Interest before and after chunk 47,51 is added. If a component has no pure adapter, extract only the selector it already computes and test that selector.

- [ ] **Step 2: Run and confirm RED**

Run:

~~~powershell
npm test -- data/contentBaseline.test.ts utils/advisor.test.ts utils/goalPlanner.test.ts utils/journalCompletion.test.ts
~~~

Expected: at least one consumer omits gameModeId or recomputes requirements differently.

- [ ] **Step 3: Delegate every remaining consumer to canonical helpers**

Thread <code>gameModeId</code> through questAdvisor and all callers. Replace direct skill/region/prerequisite branches in planner/advisor selectors with <code>evaluateQuestEligibility</code> or <code>taskEligibilityBlockers</code>. Direct array membership remains only for historical display/counting.

- [ ] **Step 4: Correct release wording**

Update the latest changelog entry to state that A Porcine of Interest now checks Draynor Village and South Falador Farm, recent quest requirements were refreshed, Diaries now contain 492 current tasks, CA rewards use cumulative points, and imports/profile cleanup were hardened only after their later plan is implemented. Do not claim plugin, relay, balance, or not-yet-landed save work in this Task 5 commit; save wording is added by the save plan's final task.

- [ ] **Step 5: Run the complete game-data verification gate**

Run:

~~~powershell
npm test
npx tsc --noEmit
npm run build
git diff --check
~~~

Expected: every test passes, TypeScript has no errors, production build succeeds, and no whitespace errors appear.

Run the data generators a final second time and require no changes:

~~~powershell
npm run diary:sync
npm run ca:sync
git diff --exit-code -- data/diaryTasks.ts data/caTasks.ts
~~~

- [ ] **Step 6: Commit Task 5**

Commit subject:

~~~text
fix: align journal eligibility surfaces
~~~
