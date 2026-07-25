# Decimal Skill-Roll Odds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the upcoming skill-level Key chance on every actionable skill card and make the engine honor the exact `level / 5` decimal probability.

**Architecture:** Add a pure `utils/keyRoll.ts` contract for level odds, d1000-resolution Key draws, effective thresholds, and formatting. `GameContext` consumes that contract and records both base and effective thresholds; small presentation and statistics helpers keep decimal roll values safe throughout existing consumers.

**Tech Stack:** React 18, TypeScript 5, Vitest 4, Vite 5, React DOM server rendering for isolated component tests.

## Global Constraints

- The level being rolled is the newly gained level.
- `skillLevelKeyChance(level)` clamps to levels 1–99 and returns exact `level / 5`.
- Level 41 is 8.2%; level 42 is 8.4%; level 99 is 19.8%.
- General Key success draws use 1–1000 integer units and are stored on the 0.1–100.0 percentage scale.
- Existing whole-percentage Key sources retain exactly the same probabilities.
- A mode bonus adds percentage points before the effective threshold is clamped to 0–100%; sub-1% odds must not be raised to 1%.
- Luck continues to select the lower of two Key draws.
- The separate level-up Chaos Key chance remains 2%.
- Previous history is not migrated or reinterpreted; new fields are optional.
- Fixed Key rates, Fate Points, pity behavior, Omni-Key odds, level progression, and the Auto-Roll queue do not change.
- Existing unrelated working-tree changes must not be staged or committed.

---

## File Structure

- Create `utils/keyRoll.ts`: pure source of truth for level odds, decimal Key resolution, and one-decimal formatting.
- Create `utils/keyRoll.test.ts`: boundary, compatibility, Luck, modifier, and formatting tests.
- Modify `context/GameContext.tsx`: use the shared roll resolver and persist base/effective thresholds.
- Modify `context/gameReducer.test.ts`: protect decimal history metadata for all result shapes.
- Modify `types.ts`: add optional `baseThreshold` to `LogEntry`.
- Create `components/SkillRollOdds.tsx`: isolated skill-card odds line and tooltip.
- Create `components/SkillRollOdds.test.tsx`: server-rendered card-state tests without adding a test dependency.
- Modify `components/Dashboard.tsx`: render `SkillRollOdds` from the existing card state.
- Create `utils/rollDistribution.ts`: decimal-safe 20-bucket roll distribution.
- Create `utils/rollDistribution.test.ts`: decimal and legacy-integer bucket boundary tests.
- Modify `components/StatsModal.tsx`: consume the roll-distribution helper.
- Modify `components/StatsChartsView.tsx`: describe the new 0.1–100.0 scale.
- Modify `utils/integrity.ts`: accept generated decimal rolls in the 0.1–100.0 range.
- Modify `utils/integrity.test.ts`: protect new and legacy valid ranges.
- Modify `components/EffectsLayer.tsx`: render one-decimal rolls and thresholds.
- Modify `components/LogViewer.tsx`: render decimal roll, effective chance, and differing base chance.
- Modify `config/economy.ts`: derive the 19.8% maximum from the shared helper.
- Modify `config/economy.consistency.test.ts`: pin the exact curve.
- Modify `components/ActionSection.tsx`: show exact level-up copy.
- Modify `components/ReferenceModal.tsx`: explain 0.1% roll precision and inclusive success.
- Modify `components/AutoRollPanel.tsx`: remove the obsolete `ceil` comment.

### Task 1: Shared Decimal Key-Roll Contract

**Files:**
- Create: `utils/keyRoll.ts`
- Create: `utils/keyRoll.test.ts`

**Interfaces:**
- Consumes: no project-local interface.
- Produces:
  - `skillLevelKeyChance(level: number): number`
  - `formatKeyPercent(percent: number): string`
  - `formatKeyRollValue(roll: number): string`
  - `resolveKeyRoll(input: KeyRollInput): KeyRollResolution`
  - `KeyRollInput`
  - `KeyRollResolution`

- [ ] **Step 1: Write the failing helper tests**

Create `utils/keyRoll.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatKeyPercent,
  formatKeyRollValue,
  resolveKeyRoll,
  skillLevelKeyChance,
} from './keyRoll';

describe('skillLevelKeyChance', () => {
  it('uses exact level / 5 odds', () => {
    expect(skillLevelKeyChance(2)).toBe(0.4);
    expect(skillLevelKeyChance(41)).toBe(8.2);
    expect(skillLevelKeyChance(42)).toBe(8.4);
    expect(skillLevelKeyChance(99)).toBe(19.8);
  });

  it('clamps invalid and out-of-range levels', () => {
    expect(skillLevelKeyChance(0)).toBe(0.2);
    expect(skillLevelKeyChance(100)).toBe(19.8);
    expect(skillLevelKeyChance(Number.NaN)).toBe(0.2);
  });
});

describe('resolveKeyRoll', () => {
  it('honours the exact 8.2% boundary', () => {
    expect(resolveKeyRoll({
      primaryFloat: 0.081,
      advantageFloat: 0.9,
      baseThreshold: 8.2,
      successBonus: 0,
      luck: false,
    })).toMatchObject({ roll: 8.2, baseThreshold: 8.2, effectiveThreshold: 8.2, success: true });

    expect(resolveKeyRoll({
      primaryFloat: 0.082,
      advantageFloat: 0.9,
      baseThreshold: 8.2,
      successBonus: 0,
      luck: false,
    })).toMatchObject({ roll: 8.3, success: false });
  });

  it('preserves integer-rate outcomes from the old d100 rule', () => {
    for (const randomFloat of [0, 0.049, 0.05, 0.1499, 0.15, 0.999]) {
      const oldSuccess = Math.floor(randomFloat * 100) + 1 <= 15;
      const next = resolveKeyRoll({
        primaryFloat: randomFloat,
        advantageFloat: 0.999,
        baseThreshold: 15,
        successBonus: 0,
        luck: false,
      });
      expect(next.success).toBe(oldSuccess);
    }
  });

  it('keeps sub-1% odds exact and adds real mode bonuses', () => {
    expect(resolveKeyRoll({
      primaryFloat: 0,
      advantageFloat: 0.9,
      baseThreshold: 0.4,
      successBonus: 0,
      luck: false,
    }).effectiveThreshold).toBe(0.4);
    expect(resolveKeyRoll({
      primaryFloat: 0,
      advantageFloat: 0.9,
      baseThreshold: 0.4,
      successBonus: 1,
      luck: false,
    }).effectiveThreshold).toBe(1.4);
  });

  it('uses the lower draw under Luck', () => {
    expect(resolveKeyRoll({
      primaryFloat: 0.9,
      advantageFloat: 0.01,
      baseThreshold: 5,
      successBonus: 0,
      luck: true,
    })).toMatchObject({ roll: 1.1, success: true });
  });
});

describe('decimal roll formatting', () => {
  it('always exposes one decimal place', () => {
    expect(formatKeyPercent(8.2)).toBe('8.2%');
    expect(formatKeyPercent(15)).toBe('15.0%');
    expect(formatKeyRollValue(42)).toBe('42.0');
  });
});
```

- [ ] **Step 2: Run the helper tests and verify they fail**

Run:

```bash
npx vitest run utils/keyRoll.test.ts
```

Expected: FAIL because `./keyRoll` does not exist.

- [ ] **Step 3: Implement the pure Key-roll contract**

Create `utils/keyRoll.ts`:

```ts
const KEY_ROLL_UNITS = 1000;
const UNITS_PER_PERCENT = 10;

export interface KeyRollInput {
  primaryFloat: number;
  advantageFloat: number;
  baseThreshold: number;
  successBonus: number;
  luck: boolean;
}

export interface KeyRollResolution {
  roll: number;
  baseThreshold: number;
  effectiveThreshold: number;
  success: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundToTenth = (value: number): number =>
  Math.round(value * UNITS_PER_PERCENT) / UNITS_PER_PERCENT;

const normalizedFloat = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1 - Number.EPSILON);
};

const rollFromFloat = (value: number): number =>
  (Math.floor(normalizedFloat(value) * KEY_ROLL_UNITS) + 1) / UNITS_PER_PERCENT;

export const skillLevelKeyChance = (level: number): number => {
  const finiteLevel = Number.isFinite(level) ? Math.trunc(level) : 1;
  return clamp(finiteLevel, 1, 99) / 5;
};

export const formatKeyPercent = (percent: number): string =>
  `${percent.toFixed(1)}%`;

export const formatKeyRollValue = (roll: number): string =>
  roll.toFixed(1);

export const resolveKeyRoll = (input: KeyRollInput): KeyRollResolution => {
  const baseThreshold = roundToTenth(clamp(input.baseThreshold, 0, 100));
  const effectiveThreshold = roundToTenth(
    clamp(baseThreshold + input.successBonus, 0, 100),
  );
  const primaryRoll = rollFromFloat(input.primaryFloat);
  const advantageRoll = rollFromFloat(input.advantageFloat);
  const roll = input.luck ? Math.min(primaryRoll, advantageRoll) : primaryRoll;

  return {
    roll,
    baseThreshold,
    effectiveThreshold,
    success: roll <= effectiveThreshold,
  };
};
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npx vitest run utils/keyRoll.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit the shared contract**

```bash
git add utils/keyRoll.ts utils/keyRoll.test.ts
git commit -m "feat: add decimal key roll contract"
```

### Task 2: Engine and History Integration

**Files:**
- Modify: `types.ts:78-97`
- Modify: `context/GameContext.tsx:30-47,227-243,353-440,854-896,924-933`
- Modify: `context/gameReducer.test.ts:15-76`

**Interfaces:**
- Consumes:
  - `skillLevelKeyChance(level: number): number`
  - `resolveKeyRoll(input: KeyRollInput): KeyRollResolution`
  - `formatKeyPercent(percent: number): string`
  - `formatKeyRollValue(roll: number): string`
- Produces:
  - `LogEntry.baseThreshold?: number`
  - `ROLL_RESULT.payload.baseThreshold: number`
  - `RollEventMeta.baseThreshold: number`

- [ ] **Step 1: Extend reducer tests with decimal and base-threshold expectations**

In `context/gameReducer.test.ts`, change the roll fixture to:

```ts
const roll = (over: Partial<{
  success: boolean;
  omni: boolean;
  pity: boolean;
  roll: number;
  baseThreshold: number;
  threshold: number;
  source: string;
}>) => ({
  type: 'ROLL_RESULT' as const,
  payload: {
    success: false,
    omni: false,
    pity: false,
    roll: 50,
    baseThreshold: 50,
    threshold: 50,
    source: 'Test',
    ...over,
  },
});
```

Add this test inside `describe('ROLL_RESULT')`:

```ts
it('preserves decimal roll, base chance, and effective chance in every result shape', () => {
  const cases = [
    {
      state: gameReducer(base(), roll({
        success: true, roll: 8.2, baseThreshold: 8.2, threshold: 9.2,
      })),
      expectedRoll: 8.2,
    },
    {
      state: gameReducer(base(), roll({
        success: true, omni: true, roll: 8.2, baseThreshold: 8.2, threshold: 9.2,
      })),
      expectedRoll: 8.2,
    },
    {
      state: gameReducer(base(), roll({
        roll: 9.3, baseThreshold: 8.2, threshold: 9.2,
      })),
      expectedRoll: 9.3,
    },
    {
      state: gameReducer({ ...base(), fatePoints: 49 }, roll({
        pity: true, roll: 9.3, baseThreshold: 8.2, threshold: 9.2,
      })),
      expectedRoll: 9.3,
    },
  ];

  for (const { state, expectedRoll } of cases) {
    const entry = state.history.at(-1)!;
    expect(entry.rollValue).toBe(expectedRoll);
    expect(entry.baseThreshold).toBe(8.2);
    expect(entry.threshold).toBe(9.2);
    expect(entry.meta).toMatchObject({ baseThreshold: 8.2, threshold: 9.2 });
  }
});
```

- [ ] **Step 2: Run reducer tests and verify the new assertions fail**

Run:

```bash
npx vitest run context/gameReducer.test.ts
```

Expected: FAIL because `baseThreshold` is not part of the action or history.

- [ ] **Step 3: Extend the history and event types**

In `types.ts`, add the optional field beside `threshold`:

```ts
rollValue?: number;
baseThreshold?: number;
threshold?: number;
```

In `context/GameContext.tsx`, change the roll metadata and action definitions:

```ts
type RollEventMeta = { roll: number; baseThreshold: number; threshold: number };
```

```ts
| {
    type: 'ROLL_RESULT';
    payload: {
      success: boolean;
      omni: boolean;
      pity: boolean;
      roll: number;
      baseThreshold: number;
      threshold: number;
      source: string;
      x?: number;
      y?: number;
    };
  }
```

- [ ] **Step 4: Record base and effective odds in every reducer result**

Import the formatters at the top of `context/GameContext.tsx`:

```ts
import {
  formatKeyPercent,
  formatKeyRollValue,
  resolveKeyRoll,
  skillLevelKeyChance,
} from '../utils/keyRoll';
```

At the start of `ROLL_RESULT`, destructure `baseThreshold` and prepare exact display text:

```ts
const { success, omni, pity, roll, baseThreshold, threshold, source, x, y } = action.payload;
const rollText = formatKeyRollValue(roll);
const chanceText = baseThreshold === threshold
  ? formatKeyPercent(threshold)
  : `${formatKeyPercent(baseThreshold)} base, ${formatKeyPercent(threshold)} effective`;
```

For each of `ROLL_OMNI`, `ROLL_SUCCESS`, `PITY`, and `ROLL_FAIL`:

- Set top-level `baseThreshold`.
- Keep top-level `threshold` as the effective threshold.
- Use `meta: { roll, baseThreshold, threshold, source }`.
- Use `meta: { roll, baseThreshold, threshold }` for `lastEvent`.
- Format `details` with `rollText` and `chanceText`.

The success detail becomes:

```ts
details: `Rolled ${rollText} (≤ ${formatKeyPercent(threshold)}; ${chanceText}).`,
```

The Omni detail becomes:

```ts
details: `Critical Success! Rolled ${rollText} vs ${formatKeyPercent(threshold)}; ${chanceText}.`,
```

The pity detail becomes:

```ts
details: `Rolled ${rollText} at ${chanceText}, but Fate intervened.`,
```

The failure detail becomes:

```ts
details: `Rolled ${rollText} (> ${formatKeyPercent(threshold)}; ${chanceText}). Fate: ${newState.fatePoints}/${resolveModeRules(state.gameModeId, state.customMode).pityThreshold}`,
```

- [ ] **Step 5: Replace d100 Key resolution and the rounded level formula**

In `rollForKey`, retain `nextDice` for Omni rolls, but resolve Key success from the two existing seeded floats:

```ts
const mode = resolveModeRules(state.gameModeId, state.customMode);
let successBonus = 0;
let omniBonus = 0;

if (mode.regionModifiers) {
  const bonuses = getActiveRegionBonuses(state.unlocks.regions);
  successBonus = bonuses.successBonus;
  omniBonus = bonuses.omniBonus;
}

const result = resolveKeyRoll({
  primaryFloat: nextFloat('roll', 0),
  advantageFloat: nextFloat('roll', 1),
  baseThreshold: threshold,
  successBonus,
  luck: state.activeBuff === 'LUCK',
});
const { roll, baseThreshold, effectiveThreshold, success } = result;
```

Dispatch:

```ts
dispatch({
  type: 'ROLL_RESULT',
  payload: {
    success,
    omni,
    pity,
    roll,
    baseThreshold,
    threshold: effectiveThreshold,
    source,
    x,
    y,
  },
});
```

Update the callback dependencies to include both `nextFloat` and `nextDice`.

In `levelUpSkill`, replace `Math.ceil(newLevel / 5)` with:

```ts
const rollChance = skillLevelKeyChance(newLevel);
```

- [ ] **Step 6: Run engine and helper tests**

Run:

```bash
npx vitest run utils/keyRoll.test.ts context/gameReducer.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the engine integration**

```bash
git add types.ts context/GameContext.tsx context/gameReducer.test.ts
git commit -m "feat: use exact decimal odds for key rolls"
```

### Task 3: Skill-Card Odds Display

**Files:**
- Create: `components/SkillRollOdds.tsx`
- Create: `components/SkillRollOdds.test.tsx`
- Modify: `components/Dashboard.tsx:1-20,475-560`

**Interfaces:**
- Consumes:
  - `skillLevelKeyChance(level: number): number`
  - `formatKeyPercent(percent: number): string`
- Produces:
  - `SkillRollOdds({ currentLevel, isUnlocked }): React.ReactElement | null`

- [ ] **Step 1: Write server-rendered component tests**

Create `components/SkillRollOdds.test.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkillRollOdds } from './SkillRollOdds';

describe('SkillRollOdds', () => {
  it('shows the exact chance for the next level', () => {
    const html = renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked />,
    );
    expect(html).toContain('Next Lv 42');
    expect(html).toContain('8.4% Key');
    expect(html).toContain('separate 2% Chaos Key chance');
  });

  it('shows nothing for locked or maxed skills', () => {
    expect(renderToStaticMarkup(
      <SkillRollOdds currentLevel={41} isUnlocked={false} />,
    )).toBe('');
    expect(renderToStaticMarkup(
      <SkillRollOdds currentLevel={99} isUnlocked />,
    )).toBe('');
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
npx vitest run components/SkillRollOdds.test.tsx
```

Expected: FAIL because `SkillRollOdds.tsx` does not exist.

- [ ] **Step 3: Implement the isolated odds line**

Create `components/SkillRollOdds.tsx`:

```tsx
import React from 'react';
import { formatKeyPercent, skillLevelKeyChance } from '../utils/keyRoll';

interface Props {
  currentLevel: number;
  isUnlocked: boolean;
}

export const SkillRollOdds: React.FC<Props> = ({ currentLevel, isUnlocked }) => {
  if (!isUnlocked || currentLevel >= 99) return null;

  const nextLevel = currentLevel + 1;
  const chance = formatKeyPercent(skillLevelKeyChance(nextLevel));

  return (
    <div
      className="text-[8px] text-blue-300/80 mt-0.5 leading-none whitespace-nowrap"
      title={`Next level Key chance: ${chance}. Every level also has a separate 2% Chaos Key chance.`}
    >
      Next Lv {nextLevel} · {chance} Key
    </div>
  );
};
```

- [ ] **Step 4: Insert the odds line into each skill card**

Import the component in `components/Dashboard.tsx`:

```ts
import { SkillRollOdds } from './SkillRollOdds';
```

Render it immediately below the existing `Lvl {level}/99` line and above `Methods`:

```tsx
<div className="text-[9px] text-gray-400 font-mono leading-none mt-0.5">
  {isUnlocked ? `Lvl ${level}/99` : 'Locked'}
</div>
<SkillRollOdds currentLevel={level} isUnlocked={isUnlocked} />
<div className="text-[8px] text-gray-500 mt-0.5 leading-none">
  Methods: <span className="text-gray-400">{methodRange}</span>
</div>
```

Increase the skill card's minimum height from `min-h-[60px]` to
`min-h-[68px]` so the new line does not crowd the methods line or segmented
progress bar.

- [ ] **Step 5: Run the component and helper tests**

Run:

```bash
npx vitest run components/SkillRollOdds.test.tsx utils/keyRoll.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the skill-card display**

```bash
git add components/SkillRollOdds.tsx components/SkillRollOdds.test.tsx components/Dashboard.tsx
git commit -m "feat: show next key odds on skill cards"
```

### Task 4: Decimal History Compatibility

**Files:**
- Modify: `utils/integrity.ts:116-146`
- Modify: `utils/integrity.test.ts:216-226`
- Create: `utils/rollDistribution.ts`
- Create: `utils/rollDistribution.test.ts`
- Modify: `components/StatsModal.tsx:65-71`
- Modify: `components/StatsChartsView.tsx:85-90`

**Interfaces:**
- Consumes: `LogEntry.rollValue?: number`.
- Produces:
  - `RollBucket`
  - `buildRollDistribution(rolls: Array<Pick<LogEntry, 'rollValue'>>): RollBucket[]`

- [ ] **Step 1: Update integrity tests for the decimal range**

Replace the range tests in `utils/integrity.test.ts` with:

```ts
it('flags roll values outside 0.1-100.0', () => {
  const zero = replayInvariants([fail({ rollValue: 0 })], 0).violations;
  const high = replayInvariants([fail({ rollValue: 100.1 })], 0).violations;
  expect(zero.some(v => v.kind === 'ROLL_OUT_OF_RANGE')).toBe(true);
  expect(high.some(v => v.kind === 'ROLL_OUT_OF_RANGE')).toBe(true);
});

it('accepts decimal and legacy integer roll values in range', () => {
  const { violations } = replayInvariants([
    fail({ rollValue: 0.1 }),
    fail({ rollValue: 8.2 }),
    success({ rollValue: 1 }),
    success({ rollValue: 100 }),
  ], 0);
  expect(violations.some(v => v.kind === 'ROLL_OUT_OF_RANGE')).toBe(false);
});
```

- [ ] **Step 2: Update the invariant range and run its tests**

In `utils/integrity.ts`, change the comment, guard, and message:

```ts
// physically impossible (negative keys, fate over cap, roll outside 0.1-100.0).
```

```ts
if (e.rollValue !== undefined && (e.rollValue < 0.1 || e.rollValue > 100)) {
  violations.push({
    index: i,
    kind: 'ROLL_OUT_OF_RANGE',
    message: `roll ${e.rollValue} out of 0.1-100.0`,
  });
}
```

Run:

```bash
npx vitest run utils/integrity.test.ts
```

Expected: PASS.

- [ ] **Step 3: Write failing roll-distribution tests**

Create `utils/rollDistribution.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRollDistribution } from './rollDistribution';

describe('buildRollDistribution', () => {
  it('places decimal boundaries into the correct five-point buckets', () => {
    const buckets = buildRollDistribution([
      { rollValue: 0.1 },
      { rollValue: 5.0 },
      { rollValue: 5.1 },
      { rollValue: 100.0 },
    ]);
    expect(buckets[0]).toMatchObject({ range: '0.1–5.0', count: 2 });
    expect(buckets[1]).toMatchObject({ range: '5.1–10.0', count: 1 });
    expect(buckets[19]).toMatchObject({ range: '95.1–100.0', count: 1 });
  });

  it('accepts legacy integers and ignores missing values', () => {
    const buckets = buildRollDistribution([
      { rollValue: 1 },
      { rollValue: 42 },
      {},
    ]);
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
  });
});
```

- [ ] **Step 4: Run the distribution tests and verify they fail**

Run:

```bash
npx vitest run utils/rollDistribution.test.ts
```

Expected: FAIL because `rollDistribution.ts` does not exist.

- [ ] **Step 5: Implement decimal-safe buckets**

Create `utils/rollDistribution.ts`:

```ts
import { LogEntry } from '../types';

export interface RollBucket {
  range: string;
  count: number;
  min: number;
}

export const buildRollDistribution = (
  rolls: Array<Pick<LogEntry, 'rollValue'>>,
): RollBucket[] => {
  const buckets = Array.from({ length: 20 }, (_, index) => {
    const min = index === 0 ? 0.1 : index * 5 + 0.1;
    const max = (index + 1) * 5;
    return {
      range: `${min.toFixed(1)}–${max.toFixed(1)}`,
      count: 0,
      min,
    };
  });

  for (const roll of rolls) {
    if (typeof roll.rollValue !== 'number') continue;
    const index = Math.min(19, Math.max(0, Math.ceil(roll.rollValue / 5) - 1));
    buckets[index].count += 1;
  }

  return buckets;
};
```

In `components/StatsModal.tsx`, import `buildRollDistribution` and replace the inline bucket construction/mutation with:

```ts
const buckets = buildRollDistribution(rolls);
```

In `components/StatsChartsView.tsx`, change the chart title to:

```tsx
<BarChart3 size={14} /> Roll Distribution (0.1–100.0)
```

- [ ] **Step 6: Run compatibility tests**

Run:

```bash
npx vitest run utils/integrity.test.ts utils/rollDistribution.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit compatibility updates**

```bash
git add utils/integrity.ts utils/integrity.test.ts utils/rollDistribution.ts utils/rollDistribution.test.ts components/StatsModal.tsx components/StatsChartsView.tsx
git commit -m "fix: support decimal rolls in history consumers"
```

### Task 5: Result, History, and Rules Presentation

**Files:**
- Modify: `components/EffectsLayer.tsx:1-20,123-136`
- Modify: `components/LogViewer.tsx:1-15,95-135`
- Modify: `config/economy.ts:24-27,195-205`
- Modify: `config/economy.consistency.test.ts:1-43`
- Modify: `components/ActionSection.tsx:587-593`
- Modify: `components/ReferenceModal.tsx:168-176,267-276`
- Modify: `components/AutoRollPanel.tsx:153-156`

**Interfaces:**
- Consumes:
  - `formatKeyPercent(percent: number): string`
  - `formatKeyRollValue(roll: number): string`
  - `skillLevelKeyChance(level: number): number`
  - `LogEntry.baseThreshold?: number`
- Produces: consistent visible copy and one-decimal roll presentation.

- [ ] **Step 1: Make the economy consistency test require 19.8%**

Import `skillLevelKeyChance` in `config/economy.consistency.test.ts`:

```ts
import { skillLevelKeyChance } from '../utils/keyRoll';
```

Replace the dynamic level assertion with:

```ts
it('represents Level Ups as the exact Level ÷ 5 curve', () => {
  const lvl = EARN_METHODS.find(m => m.category === 'Level Ups');
  expect(lvl?.dynamic).toBe(true);
  expect(LEVEL_ROLL_MAX).toBe(19.8);
  expect(LEVEL_ROLL_MAX).toBe(skillLevelKeyChance(99));
  expect(lvl?.tiers[0].rateLabel).toBe('Level ÷ 5 (up to 19.8% at level 99)');
});
```

- [ ] **Step 2: Run the economy test and verify it fails**

Run:

```bash
npx vitest run config/economy.consistency.test.ts
```

Expected: FAIL because `LEVEL_ROLL_MAX` is still 20 and the label says `max 20%`.

- [ ] **Step 3: Derive economy copy from the shared helper**

In `config/economy.ts`, import `skillLevelKeyChance` and replace the constant:

```ts
export const LEVEL_ROLL_MAX = skillLevelKeyChance(99);
```

Set the dynamic tier label to:

```ts
rateLabel: `Level ÷ 5 (up to ${LEVEL_ROLL_MAX.toFixed(1)}% at level 99)`,
```

In `components/ActionSection.tsx`, use:

```tsx
rate={`Chance = Level / 5 (up to ${LEVEL_ROLL_MAX.toFixed(1)}%)`}
```

In `components/AutoRollPanel.tsx`, replace the obsolete comment with:

```ts
// level-up engine — every level fires its exact level/5 Key roll,
```

- [ ] **Step 4: Format animated and history roll values**

Import `formatKeyPercent` and `formatKeyRollValue` into `components/EffectsLayer.tsx`. Replace its feedback comparison with:

```tsx
{formatKeyRollValue(f.roll)} {f.type === 'FAIL' ? '>' : '≤'} {formatKeyPercent(f.threshold)}
```

Import both formatters into `components/LogViewer.tsx`, read:

```ts
const baseThreshold = entry.baseThreshold;
```

Replace the roll visualizer contents with:

```tsx
<span className={`text-[10px] font-mono font-bold ${rollVal <= threshold ? 'text-green-400' : 'text-red-400'}`}>
  {formatKeyRollValue(rollVal)}
</span>
<span className="text-[8px] text-gray-600">vs</span>
<span className="text-[10px] font-mono text-gray-400">
  {formatKeyPercent(threshold)}
</span>
{baseThreshold !== undefined && baseThreshold !== threshold && (
  <span
    className="text-[8px] font-mono text-blue-300/70"
    title="Base chance before mode modifiers"
  >
    ({formatKeyPercent(baseThreshold)} base)
  </span>
)}
```

- [ ] **Step 5: Correct the in-app rulebook's roll-resolution examples**

In `components/ReferenceModal.tsx`, replace the general roll copy with:

```tsx
The app draws to 0.1% precision, from 0.1 to 100.0.
<br/>
<span className="text-green-400">Success:</span> Roll at or under the threshold to get a Key.
```

Replace the worked example's second step with:

```tsx
<li><b className="text-white">2.</b> The app draws to <span className="font-mono">0.1%</span> precision against its <b className="text-purple-400">95.0%</b> threshold. You roll <span className="font-mono text-green-400">42.0</span> → a Key!</li>
```

Replace its failure example with:

```tsx
<li className="text-gray-500 text-xs pt-1">Roll <span className="font-mono">95.1–100.0</span> instead and you'd get no Key — but you'd gain a Fate Point{rules.pityEnabled ? <>, inching toward a guaranteed Key at <b>{rules.pityThreshold}</b></> : ''}.</li>
```

- [ ] **Step 6: Run focused tests and stale-copy checks**

Run:

```bash
npx vitest run utils/keyRoll.test.ts config/economy.consistency.test.ts context/gameReducer.test.ts
```

Expected: PASS.

Run:

```bash
rg -n "Math\\.ceil\\(newLevel / 5\\)|ceil\\(level/5\\)|Roll Distribution \\(1-100\\)|It rolls 1-100|1–100</span>" context components config utils
```

Expected: no matches.

- [ ] **Step 7: Commit presentation consistency**

```bash
git add components/EffectsLayer.tsx components/LogViewer.tsx config/economy.ts config/economy.consistency.test.ts components/ActionSection.tsx components/ReferenceModal.tsx components/AutoRollPanel.tsx
git commit -m "docs: align key roll displays with decimal odds"
```

### Task 6: Full Verification

**Files:**
- Verify only; no planned production edits.

**Interfaces:**
- Consumes: all outputs from Tasks 1–5.
- Produces: evidence that the complete feature is safe to hand off.

- [ ] **Step 1: Run all targeted regression tests together**

Run:

```bash
npx vitest run utils/keyRoll.test.ts context/gameReducer.test.ts components/SkillRollOdds.test.tsx utils/integrity.test.ts utils/rollDistribution.test.ts config/economy.consistency.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all Vitest files pass.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite build exits 0 and writes `dist/`.

- [ ] **Step 4: Inspect the final diff and working tree**

Run:

```bash
git status --short
git diff --check HEAD~5..HEAD
git log -6 --oneline
```

Expected:

- No uncommitted feature files.
- No whitespace errors in the feature commits.
- The pre-existing unrelated `README.md`, `.superpowers/`, or `docs/media/` changes, if still present, remain unstaged and uncommitted.
- Five focused implementation commits follow the plan/spec commits.

- [ ] **Step 5: Manually verify the user-facing states**

Run:

```powershell
$skillOddsServer = Start-Process -FilePath npm.cmd -ArgumentList 'run','dev','--','--host','127.0.0.1','--port','5173','--strictPort' -PassThru -WindowStyle Hidden
$skillOddsServer.Id
```

Open `http://127.0.0.1:5173` in the in-app browser, then verify:

1. A locked skill shows no Key odds.
2. An unlocked level-41 skill shows `Next Lv 42 · 8.4% Key`.
3. The tooltip mentions the separate 2% Chaos Key chance.
4. A level-99 skill shows no next-roll odds.
5. A recorded level roll names the skill/new level and displays one-decimal roll and threshold values.
6. A mode bonus records both base and effective thresholds in the Log Viewer.
7. Stats opens successfully after a roll below 1.0.

- [ ] **Step 6: Stop the development server and report verification evidence**

Stop only the process started in Step 5:

```powershell
Stop-Process -Id $skillOddsServer.Id
```

Report the exact targeted-test, full-suite, and build results; do not claim
completion from code inspection alone.
