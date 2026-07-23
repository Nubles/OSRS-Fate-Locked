# Tracker Fixes and What's New Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the reported tracker defects, rename the user-facing Arcana category to Combat Powers without changing saves, and add a once-per-release What's New dialog.

**Architecture:** Persistent table identifiers stay unchanged while a presentation helper supplies player-facing names. <code>utils/journalStatus.ts</code> becomes the canonical eligibility layer for regions, alternative routes, levels, and method caps. Authored release notes remain local; a small tested utility owns browser seen-state while <code>App.tsx</code> owns dialog visibility.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Tailwind CSS, lucide-react.

## Global Constraints

- Do not modify RuneLite plugin code.
- Do not rebalance rewards, probabilities, diminishing returns, or adjacency.
- Keep <code>TableType.ARCANA === 'Arcana'</code>, <code>ARCANA_LIST</code>, and <code>unlocks.arcana</code>.
- Missing or empty <code>QuestData.oneOf</code> preserves existing behavior.
- Keep changelog release IDs separate from <code>__BUILD_ID__</code>.
- Changelog seen-state is browser-local and never enters profiles, <code>GameState</code>, or save files.
- Storage failures cannot block the application.
- Do not edit the user's existing <code>README.md</code> or <code>docs/media/</code>.
- Work test-first and commit each task separately.

---

## File Structure

**Create**

- <code>utils/tableDisplay.ts</code> and <code>utils/tableDisplay.test.ts</code>: user-facing table names with persistence coverage.
- <code>utils/journalStatus.test.ts</code>: quest-alternative and method-cap regressions.
- <code>data/changelog.ts</code>: typed authored release content.
- <code>utils/changelogState.ts</code> and <code>utils/changelogState.test.ts</code>: safe once-per-release behavior.
- <code>components/ChangelogModal.tsx</code>: accessible release-note dialog.

**Modify**

- <code>config/economy.ts</code>, <code>config/economy.consistency.test.ts</code>, and the player-facing Arcana components.
- <code>data/resourceData.ts</code> and <code>data/resourceConsistency.test.ts</code>.
- <code>data/questData.ts</code>, <code>utils/journalStatus.ts</code>, <code>utils/journalProgress.ts</code>, their tests, and <code>components/QuestLog.tsx</code>.
- <code>App.tsx</code> for dialog state, lazy loading, and utility-menu access.

---

### Task 1: Combat Powers presentation compatibility

**Files:**

- Create: <code>utils/tableDisplay.ts</code>
- Create: <code>utils/tableDisplay.test.ts</code>
- Modify: <code>config/economy.ts</code>
- Modify: <code>config/economy.consistency.test.ts</code>
- Modify: <code>components/Dashboard.tsx</code>
- Modify: <code>components/GachaSection.tsx</code>
- Modify: <code>components/FateThread.tsx</code>
- Modify: <code>components/FateForecastModal.tsx</code>
- Modify: <code>components/OracleSearch.tsx</code>
- Modify: <code>components/ShareModal.tsx</code>
- Modify: <code>components/VoidReveal.tsx</code>

**Interfaces:**

- Produces <code>COMBAT_POWERS_LABEL</code>, <code>COMBAT_POWERS_DESCRIPTION</code>, and <code>tableDisplayName(table: string)</code>.
- Preserves all Arcana engine and save identifiers.

- [ ] **Step 1: Write the failing presentation test**

Create <code>utils/tableDisplay.test.ts</code>:

~~~ts
import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import {
  COMBAT_POWERS_DESCRIPTION,
  COMBAT_POWERS_LABEL,
  tableDisplayName,
} from './tableDisplay';

describe('Combat Powers presentation', () => {
  it('maps only the persistent Arcana table to Combat Powers', () => {
    expect(TableType.ARCANA).toBe('Arcana');
    expect(tableDisplayName(TableType.ARCANA)).toBe('Combat Powers');
    expect(tableDisplayName(TableType.BOSSES)).toBe('Bosses');
    expect(COMBAT_POWERS_LABEL).toBe('Combat Powers');
    expect(COMBAT_POWERS_DESCRIPTION).toBe(
      'Spellbooks, prayers, and special combat systems.',
    );
  });

  it('leaves the persisted save field named arcana', () => {
    const unlocks = { arcana: ['Dwarf Cannon'] };
    expect(unlocks.arcana).toEqual(['Dwarf Cannon']);
  });
});
~~~

Add to <code>config/economy.consistency.test.ts</code>, importing <code>TableType</code>:

~~~ts
it('presents Arcana as Combat Powers without changing its type', () => {
  const table = SPEND_TABLES.find(t => t.type === TableType.ARCANA);
  expect(TableType.ARCANA).toBe('Arcana');
  expect(table).toMatchObject({
    label: 'Combat Powers',
    blurb: 'Spellbooks, prayers, and special combat systems.',
  });
});
~~~

- [ ] **Step 2: Verify the tests fail**

Run:

~~~powershell
npm test -- utils/tableDisplay.test.ts config/economy.consistency.test.ts
~~~

Expected: FAIL because the helper is absent and the economy label is Arcana.

- [ ] **Step 3: Add the presentation helper**

Create <code>utils/tableDisplay.ts</code>:

~~~ts
import { TableType } from '../types';

export const COMBAT_POWERS_LABEL = 'Combat Powers' as const;
export const COMBAT_POWERS_DESCRIPTION =
  'Spellbooks, prayers, and special combat systems.' as const;

export const tableDisplayName = (table: string): string =>
  table === TableType.ARCANA ? COMBAT_POWERS_LABEL : table;
~~~

- [ ] **Step 4: Replace static user-facing labels**

Import the helper constants and make these exact substitutions:

~~~ts
// config/economy.ts ? SPEND_TABLES
{
  type: TableType.ARCANA,
  label: COMBAT_POWERS_LABEL,
  count: ARCANA_LIST.length,
  blurb: COMBAT_POWERS_DESCRIPTION,
}

// components/Dashboard.tsx
{ id: 'ARCANA', label: COMBAT_POWERS_LABEL, color: 'text-violet-400',
  bar: 'bg-violet-500', list: ARCANA_LIST, unlocked: unlocks.arcana,
  type: TableType.ARCANA }

// components/GachaSection.tsx
{ type: TableType.ARCANA, label: COMBAT_POWERS_LABEL,
  subLabel: COMBAT_POWERS_DESCRIPTION, iconSrc: OSRS_GACHA_ICONS.ARCANA,
  unlocked: (unlocks.arcana ?? []).length, total: ARCANA_LIST.length,
  can: canUnlock.arcana }

// components/FateThread.tsx
[TableType.ARCANA, COMBAT_POWERS_LABEL, unlocks.arcana]

// components/OracleSearch.tsx
addGroup(ARCANA_LIST, COMBAT_POWERS_LABEL, TableType.ARCANA, Zap,
  'Requires a Key in the Combat Powers table');
~~~

In <code>components/ShareModal.tsx</code>, render <code>COMBAT_POWERS_LABEL</code> beside the existing Sparkles icon.

- [ ] **Step 5: Map dynamic displays without changing engine values**

In <code>components/FateForecastModal.tsx</code>:

~~~ts
{ table: TableType.ARCANA, singular: 'combat power' }

// while mapping categories
return {
  table,
  label: tableDisplayName(table),
  singular,
  remaining,
  headline: keysToTarget(remaining).p50,
};
~~~

Render <code>c.label</code>, <code>active.label</code>, and <code>active.label.toLowerCase()</code>; retain <code>table</code> for selection and engine calls.

In <code>components/VoidReveal.tsx</code>, retain theme matching against <code>itemType</code>, but use:

~~~ts
const displayItemType = tableDisplayName(itemType);

const text = '?? Fate-Locked UIM Update ??\nJust unlocked: **' +
  itemName + '** (' + displayItemType + ')!\n#OSRS #FateLocked';

// heading
{isChaos ? 'CHAOS UNLOCK' : displayItemType.toUpperCase() + ' UNLOCKED'}
~~~

- [ ] **Step 6: Verify labels and compatibility**

Run:

~~~powershell
npm test -- utils/tableDisplay.test.ts config/economy.consistency.test.ts
rg -ni "arcana" -g "*.ts" -g "*.tsx" -g "!*.test.ts" .
~~~

Expected: tests PASS. Remaining matches are internal identifiers, migration logic, theme checks, list names, or comments.

- [ ] **Step 7: Commit**

~~~powershell
git add utils/tableDisplay.ts utils/tableDisplay.test.ts config/economy.ts config/economy.consistency.test.ts components/Dashboard.tsx components/GachaSection.tsx components/FateThread.tsx components/FateForecastModal.tsx components/OracleSearch.tsx components/ShareModal.tsx components/VoidReveal.tsx
git commit -m "feat: present arcana as combat powers"
~~~

---

### Task 2: Dragon Claws source correction

**Files:**

- Modify: <code>data/resourceConsistency.test.ts</code>
- Modify: <code>data/resourceData.ts</code>

**Interfaces:**

- Produces a merged Dragon Claws source list with Chambers of Xeric/Ancient Chest and no Tormented Demon.

- [ ] **Step 1: Write the failing regression**

Append to <code>data/resourceConsistency.test.ts</code>:

~~~ts
describe('reported item-source corrections', () => {
  it('keeps Dragon Claws in Chambers of Xeric and removes Tormented Demon', () => {
    const sources = RESOURCE_MAP['Dragon Claws'];
    expect(sources.some(source =>
      source.name === 'Ancient Chest' ||
      source.unlockId === 'Chambers of Xeric'
    )).toBe(true);
    expect(sources.some(source =>
      source.name === 'Tormented Demon'
    )).toBe(false);
  });
});
~~~

- [ ] **Step 2: Verify the test fails**

Run <code>npm test -- data/resourceConsistency.test.ts</code>.

Expected: FAIL on the Tormented Demon assertion.

- [ ] **Step 3: Remove only the incorrect curated source**

Use this <code>data/resourceData.ts</code> entry:

~~~ts
'Dragon Claws': [
  { type: 'DROP', name: 'Chambers of Xeric',
    regions: ['Kourend & Kebos'], unlockId: 'Chambers of Xeric' },
],
~~~

Do not alter the Ancient Chest enrichment or unrelated Tormented Demon content.

- [ ] **Step 4: Verify and commit**

Run <code>npm test -- data/resourceConsistency.test.ts</code>; expect PASS.

~~~powershell
git add data/resourceData.ts data/resourceConsistency.test.ts
git commit -m "fix: correct dragon claws source"
~~~

---

### Task 3: Canonical quest and skill-cap eligibility

**Files:**

- Create: <code>utils/journalStatus.test.ts</code>
- Modify: <code>data/questData.ts</code>
- Modify: <code>utils/journalStatus.ts</code>
- Modify: <code>utils/journalProgress.ts</code>
- Modify: <code>utils/journalProgress.test.ts</code>
- Modify: <code>components/QuestLog.tsx</code>

**Interfaces:**

- Produces <code>QuestRequirementOption</code>, <code>QuestData.oneOf</code>, <code>meetsSkillRequirement</code>, <code>questRequirementOptionMet</code>, <code>questAlternativesMet</code>, and <code>questRequirementOptionLabel</code>.
- Extends <code>getQuestStatus</code> with an optional required-region refinement.
- Preserves existing status strings and QuestLog chunk refinement.

- [ ] **Step 1: Write failing eligibility regressions**

Create <code>utils/journalStatus.test.ts</code>:

~~~ts
import { describe, expect, it } from 'vitest';
import { QUEST_DATA, QuestData } from '../data/questData';
import { DropSource, UnlockState } from '../types';
import {
  countDoableTasks, getQuestStatus, meetsSkillRequirement,
} from './journalStatus';

const unlocked = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: { Slayer: 10 }, levels: { Slayer: 99 },
  regions: [], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...over,
});

describe('reported quest access', () => {
  it('requires Port Sarim for A Porcine of Interest', () => {
    const quest = QUEST_DATA['A Porcine of Interest'];
    expect(quest.regions).toEqual(['Misthalin', 'Port Sarim']);
    expect(getQuestStatus(quest, unlocked())).toBe('LOCKED_REGION');
    expect(getQuestStatus(quest,
      unlocked({ regions: ['Port Sarim'] }))).toBe('AVAILABLE');
  });

  it.each([
    ['East Ardougne', { regions: ['East Ardougne'] }],
    ['Tree Gnome Stronghold', { regions: ['Tree Gnome Stronghold'] }],
    ["Wizards' Guild", { guilds: ["Wizards' Guild"] }],
  ])('allows Enter the Abyss through %s', (_name, route) => {
    expect(getQuestStatus(QUEST_DATA['Enter the Abyss'], unlocked({
      quests: ['Rune Mysteries'], ...route,
    }))).toBe('AVAILABLE');
  });

  it('locks Enter the Abyss without a third provider', () => {
    expect(getQuestStatus(QUEST_DATA['Enter the Abyss'],
      unlocked({ quests: ['Rune Mysteries'] }))).toBe('LOCKED_REGION');
  });

  it('treats an empty alternative list as no alternative requirement', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      regions: ['Misthalin'],
      oneOf: [],
    };
    expect(getQuestStatus(quest, unlocked())).toBe('AVAILABLE');
  });
});

describe('skill-method caps', () => {
  const quest: QuestData = {
    id: 'cap', name: 'cap', regions: ['Misthalin'],
    skills: { Woodcutting: 15 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE,
  };

  it('requires level and method cap', () => {
    const tier1 = unlocked({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    });
    const tier2LowLevel = unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 14 },
    });
    const tier2 = unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    });
    expect(meetsSkillRequirement(tier1, 'Woodcutting', 15)).toBe(false);
    expect(getQuestStatus(quest, tier1)).toBe('LOCKED_SKILL');
    expect(meetsSkillRequirement(tier2LowLevel, 'Woodcutting', 15)).toBe(false);
    expect(getQuestStatus(quest, tier2LowLevel)).toBe('LOCKED_SKILL');
    expect(meetsSkillRequirement(tier2, 'Woodcutting', 15)).toBe(true);
    expect(getQuestStatus(quest, tier2)).toBe('AVAILABLE');
  });

  it('applies the same cap to diary tasks', () => {
    const tasks = [{ id: 'wc15', skills: { Woodcutting: 15 } }];
    expect(countDoableTasks(tasks, unlocked({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    }))).toBe(0);
    expect(countDoableTasks(tasks, unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    }))).toBe(1);
  });
});
~~~

Add to <code>utils/journalProgress.test.ts</code>:

~~~ts
it('reports method-cap and alternative-access blockers', () => {
  expect(questUnmet(quest({ skills: { Woodcutting: 15 } }), u({
    skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
  }))).toEqual([{ kind: 'skill', label: 'Woodcutting 15' }]);

  expect(questUnmet(quest({ oneOf: [
    { regions: ['East Ardougne'] },
    { guilds: ["Wizards' Guild"] },
  ] }), u({}))).toEqual([{
    kind: 'region', label: "East Ardougne or Wizards' Guild",
  }]);
});
~~~

- [ ] **Step 2: Verify the new tests fail**

Run:

~~~powershell
npm test -- utils/journalStatus.test.ts utils/journalProgress.test.ts
~~~

Expected: FAIL because the alternative and cap APIs do not exist.

- [ ] **Step 3: Add alternative quest data**

In <code>data/questData.ts</code>:

~~~ts
export interface QuestRequirementOption {
  regions?: string[];
  guilds?: string[];
}

export interface QuestData {
  id: string;
  name: string;
  regions: string[];
  skills: Record<string, number>;
  prereqs: string[];
  points: number;
  series?: string;
  difficulty: DropSource;
  oneOf?: QuestRequirementOption[];
}
~~~

Use:

~~~ts
'A Porcine of Interest': {
  id: 'A Porcine of Interest', name: 'A Porcine of Interest',
  regions: ['Misthalin', 'Port Sarim'],
  skills: { Slayer: 1 }, prereqs: [], points: 1,
  difficulty: DropSource.QUEST_NOVICE,
},

'Enter the Abyss': {
  id: 'Enter the Abyss', name: 'Enter the Abyss',
  regions: ['Misthalin'],
  oneOf: [
    { regions: ['East Ardougne'] },
    { regions: ['Tree Gnome Stronghold'] },
    { guilds: ["Wizards' Guild"] },
  ],
  skills: {}, prereqs: ['Rune Mysteries'], points: 0,
  series: 'Order of Wizards',
  difficulty: DropSource.QUEST_INTERMEDIATE,
},
~~~

- [ ] **Step 4: Implement the canonical helpers**

In <code>utils/journalStatus.ts</code>, import <code>UnlockState</code> and <code>QuestRequirementOption</code>, then add:

~~~ts
export interface QuestStatusOptions {
  requiredRegionsReachable?: boolean;
}

export const meetsSkillRequirement = (
  unlocks: Pick<UnlockState, 'skills' | 'levels'>,
  skill: string,
  required: number,
): boolean => {
  const tier = unlocks.skills[skill] ?? 0;
  const level = unlocks.levels[skill] ?? 1;
  const cap = Math.min(99, tier * 10);
  return tier > 0 && level >= required && cap >= required;
};

export const questRequirementOptionMet = (
  option: QuestRequirementOption,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean =>
  (option.regions ?? []).every(region =>
    isAreaReachable(region, unlocks, gameModeId)) &&
  (option.guilds ?? []).every(guild =>
    unlocks.guilds.includes(guild));

export const questAlternativesMet = (
  quest: QuestData, unlocks: UnlockState, gameModeId?: string,
): boolean =>
  !quest.oneOf?.length ||
  quest.oneOf.some(option =>
    questRequirementOptionMet(option, unlocks, gameModeId));

export const questRequirementOptionLabel = (
  option: QuestRequirementOption,
): string => [...(option.regions ?? []), ...(option.guilds ?? [])].join(' + ');
~~~

Replace <code>getQuestStatus</code> with:

~~~ts
export function getQuestStatus(
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
  options: QuestStatusOptions = {},
): QuestStatus {
  if (unlocks.quests.includes(quest.id)) return 'COMPLETED';

  const regionsMet = options.requiredRegionsReachable ??
    quest.regions.every(region =>
      isAreaReachable(region, unlocks, gameModeId));
  if (!regionsMet || !questAlternativesMet(quest, unlocks, gameModeId)) {
    return 'LOCKED_REGION';
  }

  const qp = unlocks.quests.reduce(
    (total, id) => total + (QUEST_DATA[id]?.points ?? 0), 0);
  const missingSkill = Object.entries(quest.skills).some(
    ([skill, level]) => skill === 'Quest Points'
      ? qp < level
      : !meetsSkillRequirement(unlocks, skill, level));
  if (missingSkill) return 'LOCKED_SKILL';

  if (quest.prereqs.some(id => !unlocks.quests.includes(id))) {
    return 'LOCKED_QUEST';
  }
  return 'AVAILABLE';
}
~~~

In <code>countDoableTasks</code>:

~~~ts
if (task.skills && !Object.entries(task.skills).every(
  ([skill, level]) => meetsSkillRequirement(unlocks, skill, level),
)) return false;
~~~

- [ ] **Step 5: Share the helpers with blocker summaries**

In <code>utils/journalProgress.ts</code>, import the three relevant helpers. Replace normal skill checking with:

~~~ts
if (!meetsSkillRequirement(unlocks, skill, lvl)) {
  out.push({ kind: 'skill', label: skill + ' ' + lvl });
}
~~~

After required-region checking in <code>questUnmet</code>:

~~~ts
if (!questAlternativesMet(q, unlocks, gameModeId)) {
  out.push({
    kind: 'region',
    label: q.oneOf!.map(questRequirementOptionLabel).join(' or '),
  });
}
~~~

- [ ] **Step 6: Delegate QuestLog while retaining chunk refinement**

Import the canonical helpers in <code>components/QuestLog.tsx</code>. Replace its local status body with:

~~~ts
const getStatus = (quest: QuestData) => {
  const authoredMet = quest.regions.every(region =>
    isAreaReachable(region, unlocks, gameModeId));
  const refined = refineQuestRegion(
    authoredMet, questLocations(quest.name, unlocks, gameModeId));
  return getQuestStatus(quest, unlocks, gameModeId, {
    requiredRegionsReachable: refined.met,
  });
};
~~~

Use <code>meetsSkillRequirement</code> in <code>metSkills</code>. Count <code>oneOf</code> as one progress requirement:

~~~ts
const hasAlternative = Boolean(quest.oneOf?.length);
const alternativeMet = questAlternativesMet(quest, unlocks, gameModeId);
const totalReqs = gatedRegions.length + skillReqs.length +
  prereqReqs.length + (hasAlternative ? 1 : 0);
const totalMet = metRegions.length + metSkills.length +
  metPrereqs.length + (hasAlternative && alternativeMet ? 1 : 0);
~~~

Render this chip with the existing requirement chips:

~~~tsx
{hasAlternative && (
  <span className={'text-[10px] px-2 py-1 rounded border ' +
    (alternativeMet
      ? 'bg-black/30 border-white/5 text-gray-500'
      : 'bg-red-900/20 border-red-500/30 text-red-300')}>
    One of: {quest.oneOf.map(questRequirementOptionLabel).join(' or ')}
  </span>
)}
~~~

- [ ] **Step 7: Verify dependent consumers and types**

Run:

~~~powershell
npm test -- utils/journalStatus.test.ts utils/journalProgress.test.ts utils/advisor.test.ts utils/goalPlanner.test.ts utils/questDoability.test.ts
npx tsc --noEmit
~~~

Expected: every selected test PASS and TypeScript reports no errors.

- [ ] **Step 8: Commit**

~~~powershell
git add data/questData.ts utils/journalStatus.ts utils/journalStatus.test.ts utils/journalProgress.ts utils/journalProgress.test.ts components/QuestLog.tsx
git commit -m "fix: enforce quest access and skill caps"
~~~

---

### Task 4: Authored changelog state

**Files:**

- Create: <code>data/changelog.ts</code>
- Create: <code>utils/changelogState.ts</code>
- Create: <code>utils/changelogState.test.ts</code>

**Interfaces:**

- Produces typed releases, <code>LATEST_CHANGELOG</code>, safe storage functions, and <code>changelogVisibilityReducer</code>.

- [ ] **Step 1: Write failing state tests**

Create <code>utils/changelogState.test.ts</code>:

~~~ts
import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_STORAGE_KEY, ChangelogStorage,
  changelogVisibilityReducer, markChangelogSeen, shouldShowChangelog,
} from './changelogState';

class MemoryStorage implements ChangelogStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('changelog state', () => {
  it('shows once, then shows a later release', () => {
    const storage = new MemoryStorage();
    expect(shouldShowChangelog('r1', storage)).toBe(true);
    markChangelogSeen('r1', storage);
    expect(storage.getItem(CHANGELOG_STORAGE_KEY)).toBe('r1');
    expect(shouldShowChangelog('r1', storage)).toBe(false);
    expect(shouldShowChangelog('r2', storage)).toBe(true);
  });

  it('survives blocked storage', () => {
    const storage: ChangelogStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(shouldShowChangelog('r1', storage)).toBe(true);
    expect(() => markChangelogSeen('r1', storage)).not.toThrow();
  });

  it('allows manual reopening', () => {
    const closed = changelogVisibilityReducer(true, { type: 'DISMISS' });
    expect(closed).toBe(false);
    expect(changelogVisibilityReducer(closed, { type: 'OPEN' })).toBe(true);
  });
});
~~~

- [ ] **Step 2: Verify the state test fails**

Run <code>npm test -- utils/changelogState.test.ts</code>.

Expected: FAIL because the state module is absent.

- [ ] **Step 3: Implement safe browser state**

Create <code>utils/changelogState.ts</code>:

~~~ts
export const CHANGELOG_STORAGE_KEY = 'fate-locked:last-seen-changelog';

export interface ChangelogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ChangelogVisibilityAction =
  { type: 'OPEN' } | { type: 'DISMISS' };

const browserStorage = (): ChangelogStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const shouldShowChangelog = (
  releaseId: string,
  storage: ChangelogStorage | undefined = browserStorage(),
): boolean => {
  try {
    return storage?.getItem(CHANGELOG_STORAGE_KEY) !== releaseId;
  } catch {
    return true;
  }
};

export const markChangelogSeen = (
  releaseId: string,
  storage: ChangelogStorage | undefined = browserStorage(),
): void => {
  try {
    storage?.setItem(CHANGELOG_STORAGE_KEY, releaseId);
  } catch {
    // Storage restrictions must not block the app.
  }
};

export const changelogVisibilityReducer = (
  _state: boolean, action: ChangelogVisibilityAction,
): boolean => action.type === 'OPEN';
~~~

- [ ] **Step 4: Author the first release**

Create <code>data/changelog.ts</code>:

~~~ts
export type ChangelogSection = 'added' | 'changed' | 'fixed';

export interface ChangelogRelease {
  id: string;
  title: string;
  date: string;
  sections: Partial<Record<ChangelogSection, readonly string[]>>;
}

export const CHANGELOG_RELEASES = [{
  id: '2026-07-23-tracker-accuracy',
  title: 'Tracker Accuracy & Combat Powers',
  date: '23 July 2026',
  sections: {
    added: ["A What's New dialog now summarizes each player-facing release."],
    changed: [
      'Arcana is now called Combat Powers, covering spellbooks, prayers, and special combat systems such as Dwarf Cannon.',
    ],
    fixed: [
      'Dragon Claws now list Chambers of Xeric instead of Tormented Demons.',
      'A Porcine of Interest and Enter the Abyss now check their required access routes.',
      'Quest and diary recommendations now respect unlocked skill-method caps as well as recorded levels.',
    ],
  },
}] as const satisfies readonly ChangelogRelease[];

export const LATEST_CHANGELOG: ChangelogRelease = CHANGELOG_RELEASES[0];
~~~

- [ ] **Step 5: Verify and commit**

Run <code>npm test -- utils/changelogState.test.ts</code>; expect PASS.

~~~powershell
git add data/changelog.ts utils/changelogState.ts utils/changelogState.test.ts
git commit -m "feat: add authored changelog state"
~~~

---

### Task 5: What's New dialog integration

**Files:**

- Create: <code>components/ChangelogModal.tsx</code>
- Modify: <code>App.tsx</code>

**Interfaces:**

- Consumes <code>LATEST_CHANGELOG</code> and changelog state helpers.
- Produces <code>ChangelogModal({ release, onClose })</code> and a permanent utility-menu action.

- [ ] **Step 1: Build the accessible modal**

Create <code>components/ChangelogModal.tsx</code>:

~~~tsx
import React, { useRef } from 'react';
import { CheckCircle2, RefreshCw, Sparkles, X } from 'lucide-react';
import type { ChangelogRelease, ChangelogSection } from '../data/changelog';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props { release: ChangelogRelease; onClose: () => void; }

const META: Array<{
  key: ChangelogSection; label: string;
  icon: typeof Sparkles; color: string;
}> = [
  { key: 'added', label: 'Added', icon: Sparkles, color: 'text-amber-300' },
  { key: 'changed', label: 'Changed', icon: RefreshCw, color: 'text-cyan-300' },
  { key: 'fixed', label: 'Fixed', icon: CheckCircle2, color: 'text-emerald-300' },
];

export const ChangelogModal: React.FC<Props> = ({ release, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  useEscapeKey(onClose, true);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div ref={ref} role="dialog" aria-modal="true"
        aria-labelledby="changelog-title" aria-describedby="changelog-summary"
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-amber-500/25 bg-[#121212] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#1a1a1a] p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
              What's New ? {release.date}
            </p>
            <h2 id="changelog-title" className="mt-1 text-xl font-black text-white">
              {release.title}
            </h2>
            <p id="changelog-summary" className="mt-1 text-sm text-gray-400">
              The latest additions, changes, and tracker corrections.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close What's New"
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </header>

        <div className="custom-scrollbar space-y-5 overflow-y-auto p-5">
          {META.map(({ key, label, icon: Icon, color }) => {
            const entries = release.sections[key];
            if (!entries?.length) return null;
            return (
              <section key={key} aria-labelledby={'changelog-' + key}>
                <h3 id={'changelog-' + key}
                  className={'flex items-center gap-2 text-sm font-bold ' + color}>
                  <Icon size={15} /> {label}
                </h3>
                <ul className="mt-2 space-y-2">
                  {entries.map(entry => (
                    <li key={entry}
                      className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-gray-300">
                      {entry}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="flex justify-end border-t border-white/10 bg-[#171717] p-4">
          <button type="button" onClick={onClose}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-black hover:bg-amber-500">
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ChangelogModal;
~~~

- [ ] **Step 2: Wire lazy loading and visibility**

In <code>App.tsx</code>, add <code>useReducer</code>, <code>Newspaper</code>, the latest release, and changelog helpers. Add:

~~~ts
const ChangelogModal = lazy(() =>
  import('./components/ChangelogModal').then(module => ({
    default: module.ChangelogModal,
  }))
);
~~~

Inside <code>GameLayout</code>:

~~~ts
const [showChangelog, dispatchChangelog] = useReducer(
  changelogVisibilityReducer,
  undefined,
  () => hasSeenOnboarding && shouldShowChangelog(LATEST_CHANGELOG.id),
);

const openChangelog = () => dispatchChangelog({ type: 'OPEN' });
const closeChangelog = () => {
  markChangelogSeen(LATEST_CHANGELOG.id);
  dispatchChangelog({ type: 'DISMISS' });
};
~~~

A browser still in onboarding remains unseen and receives the automatic dialog on its next load, avoiding stacked onboarding modals.

Render inside the existing <code>Suspense</code> block:

~~~tsx
{showChangelog && (
  <ChangelogModal release={LATEST_CHANGELOG} onClose={closeChangelog} />
)}
~~~

- [ ] **Step 3: Add permanent utility-menu reopening**

Add <code>onOpenChangelog: () => void</code> to <code>HeaderProps</code>, receive it in <code>Header</code>, and add:

~~~tsx
<button onClick={() => {
    setShowUtilMenu(false);
    onOpenChangelog();
  }}
  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-amber-300">
  <Newspaper size={13} className="text-amber-400" />
  What's New
</button>
<div className="my-1 border-t border-white/10" />
~~~

Pass <code>onOpenChangelog={openChangelog}</code> to <code>Header</code>. Do not touch profile/save serialization.

- [ ] **Step 4: Run automated verification**

~~~powershell
npm test -- utils/changelogState.test.ts utils/tableDisplay.test.ts utils/journalStatus.test.ts
npx tsc --noEmit
npm run build
~~~

Expected: selected tests PASS, TypeScript reports no errors, and Vite builds successfully.

- [ ] **Step 5: Manually verify lifecycle and accessibility**

Run <code>npm run dev</code>, then:

1. Remove <code>fate-locked:last-seen-changelog</code> from local storage.
2. Reload an already-onboarded profile; confirm the dialog opens.
3. Confirm focus starts inside, Tab stays trapped, and Escape closes.
4. Reload; confirm it does not auto-open again.
5. Use gear menu ? What's New; confirm manual reopening.
6. Store an older release ID and reload; confirm the latest release opens.
7. Confirm the existing update banner remains independent.

Expected: all checks succeed.

- [ ] **Step 6: Run the full release gate**

~~~powershell
npm test
npx tsc --noEmit
npm run build
git diff --check
git status --short
~~~

Expected: all tests, types, and build pass; no whitespace errors; only intended files plus the user's existing <code>README.md</code> and <code>docs/media/</code> changes appear.

- [ ] **Step 7: Commit and inspect history**

~~~powershell
git add components/ChangelogModal.tsx App.tsx
git commit -m "feat: add what's new dialog"
git log -7 --oneline
git status --short
~~~

Expected: five implementation commits follow the two design commits. The user's README and media work remains untouched.
