# Vanilla Key Safety Valve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Vanilla-only finite key safety valve, location-aware random unlock pools, Codex coverage, and a complete expandable “What’s New” history without changing Chunked or Custom mode balance.

**Architecture:** Put all balance constants and progression calculations in typed, pure modules. Persist only the two new progression counters, derive rates and caps from shared configuration, and make the reducer the final authority for awards. Reuse one access-policy helper for Standard and Chaos random pools while leaving direct Omni unlocks available with a warning. Feed both the Codex and player-facing UI from the same configuration, and model release notes as authored data rendered by a reusable history modal.

**Tech Stack:** React 19, TypeScript, Vitest, React DOM server rendering, Vite, localStorage.

## Global Constraints

- The new balance rules activate only when the resolved mode id is exactly `vanilla`.
- Chunked and Custom retain their existing boss rates, unlimited boss awards, clue rates, and unlock behavior.
- Boss and clue percentages use a continuous `0.01%` roll path. Whole-number probabilities must remain mathematically unchanged.
- The reducer, not the UI, enforces boss caps and rejects stale capped requests without consuming RNG results, buffs, Fate progress, or pity progress.
- Existing saves migrate defensively: missing counters become zero, invalid values are normalized, boss counts are capped, and unknown boss names are discarded.
- Fate awards remain one point per failure, the Vanilla pity threshold remains 50, Altar costs/effects stay unchanged, and the existing update banner keeps its current responsibility.
- Do not edit the user-modified root `README.md` or unrelated untracked media.
- This plan supersedes the unimplemented roll-precision portion of `docs/superpowers/plans/2026-07-25-decimal-skill-roll-odds.md` and the latest-only behavior in `docs/superpowers/plans/2026-07-23-whats-new-changelog.md`.

---

## Task 1: Add exact roll math and the shared Vanilla economy configuration

**Files:**

- Create: `utils/keyRoll.ts`
- Create: `utils/keyRoll.test.ts`
- Create: `config/vanillaKeyEconomy.ts`
- Create: `config/vanillaKeyEconomy.test.ts`
- Modify: `config/economy.ts`

- [ ] **Step 1: Write failing tests for continuous percentage rolls**

Create `utils/keyRoll.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveKeyRoll } from './keyRoll';

describe('resolveKeyRoll', () => {
  it('keeps exact 32.5% and 16.25% boundaries', () => {
    expect(resolveKeyRoll(0.3249, 32.5)).toEqual({ roll: 32.5, success: true });
    expect(resolveKeyRoll(0.325, 32.5)).toEqual({ roll: 32.51, success: false });
    expect(resolveKeyRoll(0.1624, 16.25)).toEqual({ roll: 16.25, success: true });
    expect(resolveKeyRoll(0.1625, 16.25)).toEqual({ roll: 16.26, success: false });
  });

  it('preserves whole-number probability boundaries', () => {
    expect(resolveKeyRoll(0.2499, 25)).toEqual({ roll: 25, success: true });
    expect(resolveKeyRoll(0.25, 25)).toEqual({ roll: 25.01, success: false });
  });

  it('clamps malformed inputs', () => {
    expect(resolveKeyRoll(-1, -4)).toEqual({ roll: 0.01, success: false });
    expect(resolveKeyRoll(4, 140)).toEqual({ roll: 100, success: true });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
npx vitest run utils/keyRoll.test.ts
```

Expected: failure because `utils/keyRoll.ts` does not exist.

- [ ] **Step 3: Implement the shared roll primitive**

Create `utils/keyRoll.ts`:

```ts
const ROLL_UNITS = 10_000;
const UNITS_PER_PERCENT = 100;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const normalizePercent = (value: number): number =>
  Math.round(clamp(Number.isFinite(value) ? value : 0, 0, 100) * 100) / 100;

export const resolveKeyRoll = (
  randomFloat: number,
  thresholdPercent: number,
): { roll: number; success: boolean } => {
  const normalizedFloat = clamp(
    Number.isFinite(randomFloat) ? randomFloat : 0,
    0,
    1 - Number.EPSILON,
  );
  const units = Math.floor(normalizedFloat * ROLL_UNITS) + 1;
  const roll = units / UNITS_PER_PERCENT;
  return { roll, success: roll <= normalizePercent(thresholdPercent) };
};
```

- [ ] **Step 4: Write failing tests for the boss schedules, reserve total, and clue floor**

Create `config/vanillaKeyEconomy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BRUTUS_BOSS_NAME,
  VANILLA_BOSS_STANDARD_KEY_TOTAL,
  effectiveVanillaClueRate,
  vanillaBossKeyStage,
} from './vanillaKeyEconomy';

describe('Vanilla key economy', () => {
  it('exposes the approved finite reserve', () => {
    expect(VANILLA_BOSS_STANDARD_KEY_TOTAL).toBe(114);
  });

  it('uses the approved Brutus and tier schedules', () => {
    expect(vanillaBossKeyStage(BRUTUS_BOSS_NAME, 0).rates).toEqual([10]);
    expect(vanillaBossKeyStage('Obor', 0).rates).toEqual([15]);
    expect(vanillaBossKeyStage('Zulrah', 0).rates).toEqual([30, 15]);
    expect(vanillaBossKeyStage('Vardorvis', 0).rates).toEqual([50, 25]);
    expect(vanillaBossKeyStage('Theatre of Blood', 0).rates).toEqual([65, 32.5, 16.25]);
  });

  it('reports progress, next rate, and capped state', () => {
    expect(vanillaBossKeyStage('Zulrah', 1)).toMatchObject({
      awarded: 1,
      cap: 2,
      currentRate: 15,
      remaining: 1,
      capped: false,
    });
    expect(vanillaBossKeyStage('Zulrah', 2)).toMatchObject({
      awarded: 2,
      currentRate: null,
      remaining: 0,
      capped: true,
    });
  });

  it('shares clue onboarding floors across all clue tiers', () => {
    expect(effectiveVanillaClueRate(2.5, 0)).toBe(25);
    expect(effectiveVanillaClueRate(5, 1)).toBe(15);
    expect(effectiveVanillaClueRate(8, 2)).toBe(10);
    expect(effectiveVanillaClueRate(20, 3)).toBe(20);
  });
});
```

- [ ] **Step 5: Implement the typed Vanilla balance source**

Create `config/vanillaKeyEconomy.ts` with these public contracts:

```ts
import { BOSSES_LIST } from '../data/items';
import { bossTier, type BossTier } from '../data/bossKeyTiers';

export const BRUTUS_BOSS_NAME = 'Brutus' as const;
export type VanillaBossClass = BossTier | 'brutus';
export type KeyRollContext =
  | { kind: 'boss'; bossName: string; bossClass: VanillaBossClass }
  | { kind: 'clue'; clueTier: string };

export const VANILLA_BOSS_KEY_RATES: Readonly<Record<VanillaBossClass, readonly number[]>> = {
  brutus: [10],
  low: [15],
  mid: [30, 15],
  high: [50, 25],
  raid: [65, 32.5, 16.25],
};

export const CLUE_ONBOARDING_MINIMUMS = [25, 15, 10] as const;

export const vanillaBossKeySchedule = (bossName: string): readonly number[] => {
  if (bossName === BRUTUS_BOSS_NAME) return VANILLA_BOSS_KEY_RATES.brutus;
  return VANILLA_BOSS_KEY_RATES[bossTier(bossName)];
};

export const vanillaBossKeyStage = (bossName: string, rawAwarded: number) => {
  const rates = vanillaBossKeySchedule(bossName);
  const awarded = Math.min(rates.length, Math.max(0, Math.floor(rawAwarded || 0)));
  return {
    rates,
    awarded,
    cap: rates.length,
    remaining: rates.length - awarded,
    currentRate: rates[awarded] ?? null,
    nextRate: rates[awarded + 1] ?? null,
    capped: awarded >= rates.length,
  };
};

export const clueOnboardingMinimum = (awarded: number): number =>
  CLUE_ONBOARDING_MINIMUMS[Math.max(0, Math.floor(awarded || 0))] ?? 0;

export const effectiveVanillaClueRate = (baseRate: number, awarded: number): number =>
  Math.max(baseRate, clueOnboardingMinimum(awarded));

export const VANILLA_BOSS_STANDARD_KEY_TOTAL =
  1 + BOSSES_LIST.reduce((sum, name) => sum + vanillaBossKeySchedule(name).length, 0);
```

If a current boss name does not resolve through `bossTier`, fail loudly in development instead of silently assigning a tier. Keep Brutus outside `BOSSES_LIST` and the existing boss-spend table.

- [ ] **Step 6: Expose the config through the economy module and run tests**

Re-export the Vanilla constants/helpers from `config/economy.ts`, then run:

```powershell
npx vitest run utils/keyRoll.test.ts config/vanillaKeyEconomy.test.ts data/bossKeyTiers.test.ts
```

Expected: all pass and the reserve assertion proves the current 66 classifications yield 113 tier allowances plus Brutus.

- [ ] **Step 7: Commit**

```powershell
git add utils/keyRoll.ts utils/keyRoll.test.ts config/vanillaKeyEconomy.ts config/vanillaKeyEconomy.test.ts config/economy.ts
git commit -m "feat: add vanilla key economy configuration"
```

---

## Task 2: Persist and normalize Vanilla key progression

**Files:**

- Modify: `types.ts`
- Create: `utils/vanillaKeyProgress.ts`
- Create: `utils/vanillaKeyProgress.test.ts`
- Modify: `context/GameContext.tsx`
- Modify: `context/gameReducer.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `utils/vanillaKeyProgress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeBossStandardKeysAwarded,
  normalizeClueStandardKeysAwarded,
} from './vanillaKeyProgress';

describe('Vanilla key progress normalization', () => {
  it('keeps known integers, rejects fractions, and clamps at each cap', () => {
    expect(normalizeBossStandardKeysAwarded({
      Brutus: 9,
      Zulrah: 1,
      'Theatre of Blood': 8,
      Unknown: 2,
      Obor: -4,
      Vardorvis: 1.9,
    })).toEqual({
      Brutus: 1,
      Zulrah: 1,
      'Theatre of Blood': 3,
    });
  });

  it('normalizes the shared clue counter without reducing valid history', () => {
    expect(normalizeClueStandardKeysAwarded(undefined)).toBe(0);
    expect(normalizeClueStandardKeysAwarded(-2)).toBe(0);
    expect(normalizeClueStandardKeysAwarded(4.9)).toBe(0);
    expect(normalizeClueStandardKeysAwarded(4)).toBe(4);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```powershell
npx vitest run utils/vanillaKeyProgress.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Add save fields and pure normalizers**

Add to `GameState` in `types.ts`:

```ts
bossStandardKeysAwarded?: Record<string, number>;
clueStandardKeysAwarded?: number;
```

Create `utils/vanillaKeyProgress.ts`. Build the known-name set from `BOSSES_LIST` plus `BRUTUS_BOSS_NAME`; retain only positive integer entries and clamp them with `vanillaBossKeyStage(name, value).cap`. Normalize the clue value to a non-negative integer without an upper cap.

- [ ] **Step 4: Initialize and migrate the counters**

In `context/GameContext.tsx`:

- Add `{}` and `0` to `initialState`.
- During `migrateSave`, normalize both values after the existing top-level merge.
- Increment `CURRENT_VERSION`.
- Ensure this migration applies to both loaded local saves and imported save data.

Add reducer coverage to `context/gameReducer.test.ts`:

```ts
it('migrates missing and malformed Vanilla key counters', () => {
  const loaded = gameReducer(baseState, {
    type: 'LOAD_SAVE',
    payload: {
      ...baseState,
      bossStandardKeysAwarded: { Brutus: 5, Unknown: 3 },
      clueStandardKeysAwarded: -4,
    },
  });
  expect(loaded.bossStandardKeysAwarded).toEqual({ Brutus: 1 });
  expect(loaded.clueStandardKeysAwarded).toBe(0);
});
```

- [ ] **Step 5: Run focused tests**

```powershell
npx vitest run utils/vanillaKeyProgress.test.ts context/gameReducer.test.ts
```

Expected: all pass, including an old-save fixture with both fields absent.

- [ ] **Step 6: Commit**

```powershell
git add types.ts utils/vanillaKeyProgress.ts utils/vanillaKeyProgress.test.ts context/GameContext.tsx context/gameReducer.test.ts
git commit -m "feat: persist vanilla key progression"
```

---

## Task 3: Enforce caps and clue accounting in the roll engine

**Files:**

- Modify: `context/GameContext.tsx`
- Modify: `context/gameReducer.test.ts`

- [ ] **Step 1: Add failing reducer tests for every cap-consuming award**

Extend `context/gameReducer.test.ts` with table-driven cases proving that, in Vanilla:

```ts
const bossContext = {
  kind: 'boss' as const,
  bossName: 'Zulrah',
  bossClass: 'mid' as const,
};

it.each([
  ['normal success', { success: true, omni: false, pity: false }, 1],
  ['standard with Omni', { success: true, omni: true, pity: false }, 1],
  ['pity award', { success: false, omni: false, pity: true }, 1],
])('%s consumes one boss allowance', (_label, outcome, expected) => {
  const next = gameReducer(vanillaState, rollAction(outcome, bossContext));
  expect(next.bossStandardKeysAwarded?.Zulrah).toBe(expected);
});
```

Also add explicit tests that:

- Greed awards two Standard Keys when two allowances remain.
- Greed awards only one Standard Key when one allowance remains.
- The Omni extra does not consume a second Standard allowance.
- A capped boss request returns the unchanged state object, including active buff, Fate, pity, keys, RNG state, and history.
- A failed non-capped boss roll can still earn Fate/pity as today.
- Normal, pity, Greed, and Standard-with-Omni clue awards increment the shared clue counter by the actual Standard amount.
- Non-Vanilla boss and clue actions do not read or change these counters.

- [ ] **Step 2: Run the reducer suite and confirm failures**

```powershell
npx vitest run context/gameReducer.test.ts
```

Expected: the new assertions fail because roll context and counters are not yet handled.

- [ ] **Step 3: Extend the roll interface and action payload**

Change the public context signature to:

```ts
rollForKey: (
  source: string,
  threshold: number,
  x?: number,
  y?: number,
  context?: KeyRollContext,
) => void;
```

Add optional `context: KeyRollContext` to `ROLL_RESULT`. Store the exact boss name/class or clue tier in `LogEntry.meta` so history never has to infer identity from the generic `DropSource`.

- [ ] **Step 4: Preflight capped bosses before drawing RNG**

At the top of `rollForKey`, first read `const snapshot = stateRef.current`. When `snapshot.gameModeId === 'vanilla'` and `context.kind === 'boss'`:

1. Read the normalized count for `context.bossName`.
2. Derive the current stage from `vanillaBossKeyStage`.
3. Return immediately when capped.
4. Replace the caller-supplied base threshold with `stage.currentRate`.

For Vanilla clues, replace the base threshold with:

```ts
effectiveVanillaClueRate(threshold, snapshot.clueStandardKeysAwarded ?? 0)
```

Use `resolveKeyRoll(nextFloat(purpose, 0), effectiveThreshold)`. The seeded purpose must include the exact progression identity:

```ts
const purpose =
  context?.kind === 'boss'
    ? `roll:boss:${context.bossName}:${awarded}`
    : context?.kind === 'clue'
      ? `roll:clue:${context.clueTier}:${snapshot.clueStandardKeysAwarded ?? 0}`
      : 'roll';
```

Use `snapshot` for every decision in this callback so the cap, buff, Fate, mode, and region-modifier checks all observe one current state. Luck still takes the better of two independently derived draws. Omni remains an independent roll. Generic non-context rolls keep their existing purpose and behavior.

- [ ] **Step 5: Make the reducer the final award authority**

Before any roll-result mutation, repeat the capped-boss check against the reducer’s current state. If capped, `return state`.

Calculate requested Standard Keys exactly once:

```ts
const requestedStandardKeys =
  success || pity
    ? success && !omni && activeBuff === 'GREED' ? 2 : 1
    : 0;
const standardKeysAwarded =
  isVanillaBoss
    ? Math.min(requestedStandardKeys, bossStage.remaining)
    : requestedStandardKeys;
```

Use `standardKeysAwarded` in every success, Omni, pity, and Greed branch rather than separate hard-coded increments. Then:

- Increment the named boss record by `standardKeysAwarded`.
- Increment the shared clue count by `standardKeysAwarded`.
- Preserve the independent `specialKeys += 1` for an Omni result.
- Consume Greed only on an accepted result; if one allowance remained, log one awarded Standard Key.
- Put `standardKeysAwarded`, current stage, remaining stage, `outcome` (`normal`, `pity`, `greed`, or `omni`), `exhausted`, and context into history metadata.
- Keep combat achievements, collection logs, pets, and ordinary boss loot outside this subsystem. Add capped-state regression assertions that `TOGGLE_CA` and `LOG_ITEM` still mutate their independent state.

- [ ] **Step 6: Run focused engine tests**

```powershell
npx vitest run context/gameReducer.test.ts utils/keyRoll.test.ts
```

Expected: all cap, Greed, Omni, pity, clue, stale-action, and non-Vanilla tests pass.

- [ ] **Step 7: Commit**

```powershell
git add context/GameContext.tsx context/gameReducer.test.ts
git commit -m "feat: enforce vanilla key award limits"
```

---

## Task 4: Show boss and clue progression in Farm Keys

**Files:**

- Create: `components/VanillaKeyProgress.tsx`
- Create: `components/VanillaKeyProgress.test.tsx`
- Modify: `components/ActionSection.tsx`

- [ ] **Step 1: Write failing render tests**

Create server-render tests that assert:

```tsx
expect(renderToStaticMarkup(
  <BossKeyProgress stage={vanillaBossKeyStage('Zulrah', 0)} />
)).toContain('30% current');
expect(renderToStaticMarkup(
  <BossKeyProgress stage={vanillaBossKeyStage('Zulrah', 1)} />
)).toContain('1 / 2 keys');
expect(renderToStaticMarkup(
  <BossKeyProgress stage={vanillaBossKeyStage('Zulrah', 2)} />
)).toContain('Key reserve exhausted');
expect(renderToStaticMarkup(
  <ClueKeyProgress awarded={1} baseRate={5} />
)).toContain('15% onboarding rate');
```

- [ ] **Step 2: Implement compact progress components**

`BossKeyProgress` must display current chance, awarded/cap, next chance when present, and a clear capped state. `ClueKeyProgress` must display the shared count, call out the onboarding floor when it exceeds the clue's normal base rate, and state `Normal tier rates apply` once three Standard clue keys have been awarded.

- [ ] **Step 3: Wire ActionSection to exact contexts**

In `ActionSection.tsx`:

- In Vanilla, show Brutus first, followed by unlocked bosses.
- In other modes, preserve the current boss list and behavior.
- For each Vanilla boss, derive `bossClass`, `source`, and `stage`; pass the exact `KeyRollContext`.
- Disable the roll button when capped.
- Use `BRUTUS_BOSS_NAME` with the `brutus` class and the low-boss drop source, but do not add Brutus to the spend/unlock boss table.
- Pass clue contexts with the visible clue tier and display the effective shared onboarding rate.
- Keep non-key boss rewards independent; the UI copy should say only the key/Fate roll is exhausted.

- [ ] **Step 4: Run component and engine tests**

```powershell
npx vitest run components/VanillaKeyProgress.test.tsx context/gameReducer.test.ts
```

Expected: render tests pass and the engine remains authoritative.

- [ ] **Step 5: Commit**

```powershell
git add components/VanillaKeyProgress.tsx components/VanillaKeyProgress.test.tsx components/ActionSection.tsx
git commit -m "feat: show vanilla key reserve progress"
```

---

## Task 5: Define exact activity access requirements

**Files:**

- Create: `data/activityAccess.ts`
- Create: `data/activityAccess.test.ts`
- Create: `utils/activityAccess.ts`
- Create: `utils/activityAccess.test.ts`

- [ ] **Step 1: Write failing coverage and reachability tests**

The data test must assert that every item in `BOSSES_LIST` and `MINIGAMES_LIST` is covered by exactly one of:

1. The exact `ACTIVITY_ACCESS_AREAS` map.
2. The explicit `NO_HARD_LOCATION_GATE` set.

The helper tests must cover:

- Pest Control requires `Void Knights' Outpost`.
- Last Man Standing requires `Ferox Enclave`.
- Giant Mole becomes eligible only when its exact `Falador` access area is reachable.
- Obor becomes eligible through its exact `Edgeville` access area.
- Mimic, Shooting Stars, Mahogany Homes, Forestry, and Rat Pits have no hard location gate.
- Skill, quest, and item requirements do not affect this helper.
- A missing declaration fails closed in Vanilla and returns a useful blocker description.

- [ ] **Step 2: Add a complete curated exact-area map**

Create `data/activityAccess.ts` with a literal `ACTIVITY_ACCESS_AREAS` entry for every geographically gated item in `BOSSES_LIST` and `MINIGAMES_LIST`. Values must be exact names from `REGIONS_LIST`, not broad parent-region labels. Seed the literal with the known corrections:

```ts
export const ACTIVITY_ACCESS_AREAS: Readonly<Record<string, readonly string[]>> = {
  'Pest Control': ["Void Knights' Outpost"],
  'Last Man Standing': ['Ferox Enclave'],
  'Giant Mole': ['Falador'],
  'Obor': ['Edgeville'],
};

export const NO_HARD_LOCATION_GATE = new Set([
  'Mimic',
  'Shooting Stars',
  'Mahogany Homes',
  'Forestry',
  'Rat Pits',
]);

export const VANILLA_RANDOM_ACCESS_POLICY = {
  filteredTables: [TableType.BOSSES, TableType.MINIGAMES],
  randomCosts: ['key', 'chaosKey'],
  omniDirectBypasses: true,
} as const;
```

During implementation, audit each existing `ACTIVITY_REGIONS` entry and its location comment to choose its exact named-area value. Do not fall back at runtime to a parent region or to “any member” of a region group. The consistency test is the completion gate: every current boss/minigame must occur in exactly one of the literal map or no-gate set, every mapped value must exist in `REGIONS_LIST`, and no stale extra activity names are allowed.

- [ ] **Step 3: Implement the pure access policy**

Create `utils/activityAccess.ts` with:

```ts
export interface ActivityAccessResult {
  eligible: boolean;
  requiredAreas: readonly string[];
  explanation: string;
}

export const getActivityAccess = (
  activity: string,
  unlocks: UnlockState,
  modeId: string,
): ActivityAccessResult => {
  if (modeId !== 'vanilla' || NO_HARD_LOCATION_GATE.has(activity)) {
    return { eligible: true, requiredAreas: [], explanation: '' };
  }
  const requiredAreas = ACTIVITY_ACCESS_AREAS[activity];
  if (!requiredAreas) {
    return { eligible: false, requiredAreas: [], explanation: 'Missing location declaration' };
  }
  const eligible = requiredAreas.some(area => isAreaReachable(area, unlocks, modeId));
  return {
    eligible,
    requiredAreas,
    explanation: eligible ? '' : `Needs ${requiredAreas.join(' or ')}`,
  };
};
```

For modes other than Vanilla, return eligible without applying the new geography filter. In Vanilla, a missing declaration fails closed with a diagnostic explanation. Use the existing free-area and reachability helpers; do not duplicate their mode rules.

- [ ] **Step 4: Run the complete access test set**

```powershell
npx vitest run data/activityAccess.test.ts utils/activityAccess.test.ts utils/reachability.test.ts
```

Expected: every current boss/minigame is classified and exact exceptions behave as documented.

- [ ] **Step 5: Commit**

```powershell
git add data/activityAccess.ts data/activityAccess.test.ts utils/activityAccess.ts utils/activityAccess.test.ts
git commit -m "feat: define vanilla activity access rules"
```

---

## Task 6: Filter Standard and Chaos pools, while warning on Omni bypass

**Files:**

- Modify: `utils/gameEngine.ts`
- Modify: `utils/gameEngine.test.ts`
- Modify: `components/GachaSection.tsx`
- Modify: `components/Dashboard.tsx`
- Create: `components/ActivityAccessWarning.tsx`
- Create: `components/ActivityAccessWarning.test.tsx`

- [ ] **Step 1: Write failing pool-policy tests**

Add tests for:

```ts
expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', lockedOutpost, 'vanilla')).toBe(false);
expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', openOutpost, 'vanilla')).toBe(true);
expect(isRandomUnlockEligible(TableType.MINIGAMES, 'Pest Control', lockedOutpost, 'chunked')).toBe(true);
expect(isRandomUnlockEligible(TableType.REGIONS, 'Morytania', lockedState, 'vanilla')).toBe(
  isValidUnlock(TableType.REGIONS, 'Morytania', lockedState),
);
```

Also test a blocker-summary helper returns a deterministic sample and does not draw RNG.

- [ ] **Step 2: Add one shared random-eligibility helper**

In `utils/gameEngine.ts`, add:

```ts
export const isRandomUnlockEligible = (
  table: TableType,
  item: string,
  unlocks: UnlockState,
  modeId: string,
): boolean => {
  if (!isValidUnlock(table, item, unlocks)) return false;
  if (modeId !== 'vanilla') return true;
  if (!VANILLA_RANDOM_ACCESS_POLICY.filteredTables.some(candidate => candidate === table)) return true;
  return getActivityAccess(item, unlocks, modeId).eligible;
};
```

Add a pure `describeRandomPoolBlockers` helper that lists the first few location blockers and a remaining count.

- [ ] **Step 3: Apply the same helper to both random key paths**

In `GachaSection.tsx`:

- Standard-table candidate construction uses `isRandomUnlockEligible`.
- Chaos global-pool construction uses the same helper.
- Build/filter the pool before any random draw.
- If the pool is empty, award nothing, consume no key, consume no RNG, and show a message containing a blocker sample such as `Pest Control — needs Void Knights' Outpost`.
- Do not bundle an activity with its access area; each unlock remains a separate purchase/roll.

- [ ] **Step 4: Keep Omni direct unlocks available with a warning**

Create `ActivityAccessWarning` using `getActivityAccess`. In `Dashboard.tsx`, when a Vanilla player selects a locked boss/minigame for a direct Omni unlock and its location is inaccessible, show:

```text
Omni Keys can unlock this now, but you still need access to: {areas}.
```

The confirmation remains enabled. Existing inaccessible unlocks remain owned and are never removed.

- [ ] **Step 5: Run policy and UI tests**

```powershell
npx vitest run utils/gameEngine.test.ts components/ActivityAccessWarning.test.tsx
```

Expected: Standard and Chaos share the filter, non-Vanilla is unchanged, empty pools are deterministic, and Omni renders a warning without blocking.

- [ ] **Step 6: Commit**

```powershell
git add utils/gameEngine.ts utils/gameEngine.test.ts components/GachaSection.tsx components/Dashboard.tsx components/ActivityAccessWarning.tsx components/ActivityAccessWarning.test.tsx
git commit -m "feat: filter vanilla random unlock pools"
```

---

## Task 7: Put the complete Vanilla policy into the existing Codex tabs

**Files:**

- Modify: `components/ReferenceModal.tsx`
- Modify: `config/economy.consistency.test.ts`
- Modify: `config/rules.ts`
- Create: `components/ReferenceModal.test.tsx`

- [ ] **Step 1: Write failing Codex content tests**

Render `ReferenceModal` and assert the existing tabs contain:

- Key Economy: `114` finite boss safety-reserve Standard Keys.
- Drop Rates: Brutus and all four schedules, caps, and `25% → 15% → 10%` shared clue onboarding floors.
- Unlocks: Standard and Chaos respect hard location access; Omni direct unlocks bypass the filter with a warning.
- Areas: Vanilla unlocks can be scattered; adjacency belongs only to Chunked.
- A clear label that these rules are active only in Vanilla.

Do not add a new tab.

- [ ] **Step 2: Drive Codex values from shared configuration**

Import `VANILLA_BOSS_KEY_RATES`, `VANILLA_BOSS_STANDARD_KEY_TOTAL`, `CLUE_ONBOARDING_MINIMUMS`, and `VANILLA_RANDOM_ACCESS_POLICY`; format them rather than repeating numeric literals or maintaining a second unlock-policy table. Add the content to the existing Economy, Drop Rates, Unlocks, and Areas tabs. Read the active `gameModeId` from `useGame()` and label these panels `Vanilla-only (not active for this run)` whenever it is not `vanilla`.

Correct the current Vanilla area wording that says unlocks are adjacent/logical. State that Vanilla rolls can be scattered and that Chunked alone enforces adjacent expansion.

- [ ] **Step 3: Add anti-drift assertions**

Extend `config/economy.consistency.test.ts` to assert:

- The computed reserve is 114.
- Every `BOSSES_LIST` entry has a schedule.
- Brutus is not in `BOSSES_LIST`.
- The Codex formatter consumes the exported economy and random-access policy config rather than maintaining a second table.

Update the obsolete `805`/one-time economy comment in `config/rules.ts` to match the current 950 paid-unlock model and finite reserve. Do not change rule values in this task.

- [ ] **Step 4: Run Codex and consistency tests**

```powershell
npx vitest run components/ReferenceModal.test.tsx config/economy.consistency.test.ts config/vanillaKeyEconomy.test.ts
```

Expected: all pass with no duplicated schedule constants.

- [ ] **Step 5: Commit**

```powershell
git add components/ReferenceModal.tsx components/ReferenceModal.test.tsx config/economy.consistency.test.ts config/rules.ts
git commit -m "docs: add vanilla key policy to codex"
```

---

## Task 8: Model complete, authored release history and seen-state behavior

**Files:**

- Create: `data/changelog.ts`
- Create: `data/changelog.test.ts`
- Create: `utils/changelogState.ts`
- Create: `utils/changelogState.test.ts`

- [ ] **Step 1: Write failing data and state tests**

Test that:

- Release ids are unique and newest-first by date.
- Empty sections are omitted.
- Allowed sections are `added`, `changed`, `fixed`, and `balance`.
- The latest release contains balance notes for boss reserve/diminishing rates, Brutus, clue onboarding, location-aware random pools, and corrected Vanilla area wording.
- At least the prior 2026-07-23 release remains in history.
- Auto-open is true only when the latest id differs from the stored id.
- Marking seen writes only the latest id.
- Adding or correcting an older release without changing the latest id does not auto-open.

- [ ] **Step 2: Implement the release data contract**

Create `data/changelog.ts`:

```ts
export type ChangelogSection = 'added' | 'changed' | 'fixed' | 'balance';

export interface ChangelogRelease {
  id: string;
  title: string;
  date: string;
  sections: Partial<Record<ChangelogSection, readonly string[]>>;
}

export const CHANGELOG_RELEASES: readonly ChangelogRelease[] = [
  {
    id: '2026-07-26-vanilla-key-safety-valve',
    title: 'Vanilla Key Safety Valve',
    date: '2026-07-26',
    sections: {
      balance: [
        'Bosses now provide a finite, diminishing Vanilla key reserve.',
        'Brutus joins Farm Keys as a one-key early safety valve.',
        'The first three clue-earned Standard Keys share 25%, 15%, and 10% minimum chances.',
        'Standard and Chaos boss/minigame rolls now respect hard location access.',
        'The Codex now correctly explains that Vanilla area unlocks can be scattered.',
      ],
    },
  },
  {
    id: '2026-07-23-tracker-accuracy',
    title: 'Tracker Accuracy & Combat Powers',
    date: '2026-07-23',
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
  },
];

export const LATEST_CHANGELOG = CHANGELOG_RELEASES[0];
```

Use ISO dates for sorting and format them for display in the modal; release order remains authored and newest-first.

- [ ] **Step 3: Implement local latest-seen storage**

Create `utils/changelogState.ts`:

```ts
export const CHANGELOG_SEEN_KEY = 'flitest.whats-new.latest-seen';

export const shouldAutoOpenChangelog = (
  latestId: string,
  storedId: string | null,
): boolean => storedId !== latestId;

export const readLatestSeen = (storage: Pick<Storage, 'getItem'>): string | null =>
  storage.getItem(CHANGELOG_SEEN_KEY);

export const markLatestSeen = (
  storage: Pick<Storage, 'setItem'>,
  latestId: string,
): void => storage.setItem(CHANGELOG_SEEN_KEY, latestId);
```

Catch storage access errors in the App integration, not in these pure helpers. Expansion state is component-local and never enters save serialization.

- [ ] **Step 4: Run focused tests**

```powershell
npx vitest run data/changelog.test.ts utils/changelogState.test.ts
```

Expected: newest-first and seen-state contracts pass.

- [ ] **Step 5: Commit**

```powershell
git add data/changelog.ts data/changelog.test.ts utils/changelogState.ts utils/changelogState.test.ts
git commit -m "feat: add authored changelog history"
```

---

## Task 9: Render expandable “What’s New” history and integrate it into App

**Files:**

- Create: `components/ChangelogModal.tsx`
- Create: `components/ChangelogModal.test.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Write failing initial-render accessibility tests**

Using `renderToStaticMarkup`, assert:

- Every release title and date is rendered.
- The newest release button has `aria-expanded="true"`.
- Older release buttons have `aria-expanded="false"`.
- Each button’s `aria-controls` matches a stable panel id.
- Empty section headings do not render.
- Balance renders alongside Added/Changed/Fixed when present.

Extract and unit-test a pure `toggleExpandedRelease(set, id)` helper so releases expand independently and opening an older entry does not alter latest-seen state.

- [ ] **Step 2: Implement the history modal**

`ChangelogModal` accepts:

```ts
interface ChangelogModalProps {
  releases: readonly ChangelogRelease[];
  onClose: () => void;
}
```

Initialize local expanded ids with `releases[0]?.id`. Render all release headers newest-first; render section content only for expanded releases. Use one button per release with `aria-expanded`, `aria-controls`, keyboard-native behavior, and independent toggle state. Hide empty/missing sections. Follow the existing modal conventions for `role="dialog"`, labelling, focus trapping, Escape close, and focus restoration.

- [ ] **Step 3: Add manual and automatic App entry points**

In `App.tsx`:

- Lazy-load `ChangelogModal`.
- Add a “What’s New” item to the existing utility/gear menu.
- Manual opening always shows the full history and must not depend on seen state.
- After onboarding is no longer active, compare `LATEST_CHANGELOG.id` with localStorage and auto-open only when different.
- Dismissing the modal marks the current latest id seen.
- Expanding/collapsing any release does not write storage.
- Storage errors must leave the app usable; auto-opening once in that session is acceptable.

Keep this state outside `GameState`, exports, imports, and save migration.

- [ ] **Step 4: Run component and state tests**

```powershell
npx vitest run components/ChangelogModal.test.tsx data/changelog.test.ts utils/changelogState.test.ts
```

Expected: latest expanded, older collapsed, all history discoverable, and storage behavior tied only to latest id/dismissal.

- [ ] **Step 5: Commit**

```powershell
git add components/ChangelogModal.tsx components/ChangelogModal.test.tsx App.tsx
git commit -m "feat: add expandable whats new history"
```

---

## Task 10: Run cross-feature regression verification

**Files:**

- Modify only files implicated by verification failures
- Review: `docs/superpowers/specs/2026-07-26-vanilla-key-safety-valve-design.md`

- [ ] **Step 1: Run the focused balance matrix**

```powershell
npx vitest run config/vanillaKeyEconomy.test.ts utils/keyRoll.test.ts utils/vanillaKeyProgress.test.ts context/gameReducer.test.ts data/activityAccess.test.ts utils/activityAccess.test.ts utils/gameEngine.test.ts components/VanillaKeyProgress.test.tsx components/ActivityAccessWarning.test.tsx components/ReferenceModal.test.tsx data/changelog.test.ts utils/changelogState.test.ts components/ChangelogModal.test.tsx
```

Expected: all pass.

- [ ] **Step 2: Run the complete automated suite**

```powershell
npm test
npx tsc --noEmit
npm run build
```

Expected: all commands exit zero. Treat any existing warning separately from failures and record it in the handoff.

- [ ] **Step 3: Perform deterministic manual checks in a fresh Vanilla save**

Verify:

1. Brutus appears first with 10%, awards at most one Standard Key, then shows exhausted.
2. A mid boss progresses 30% → 15% → exhausted.
3. Greed with one allowance remaining awards one Standard Key.
4. Omni from a boss adds one Standard and one Omni while consuming one boss allowance.
5. The shared clue display progresses 25% → 15% → 10% → normal tier rate.
6. A capped boss cannot earn Fate or pity, but ordinary boss rewards remain described as available.
7. Standard and Chaos omit Pest Control until `Void Knights' Outpost` is reachable.
8. An empty random pool explains blockers and consumes neither key nor RNG.
9. Omni can directly unlock an inaccessible activity after displaying the warning.
10. The Codex presents all four Vanilla policy sections and says Vanilla areas may be scattered.
11. “What’s New” opens automatically once for the latest id; dismissing prevents a repeat; the menu reopens the full history; older releases expand independently.
12. Chunked and Custom behavior matches the pre-change rules.

- [ ] **Step 4: Inspect the final diff for scope and duplicated constants**

```powershell
git status --short
git diff --check
git grep -n "65, 32.5, 16.25" -- ':!config/vanillaKeyEconomy.ts' ':!docs'
git grep -n "25, 15, 10" -- ':!config/vanillaKeyEconomy.ts' ':!docs'
```

Expected: no whitespace errors, no duplicate runtime schedules, and unrelated root `README.md`, `.superpowers/`, and `docs/media/` remain untouched.

- [ ] **Step 5: Commit any verification-only corrections**

If verification required corrections, stage only the implicated files and commit:

```powershell
git commit -m "fix: complete vanilla safety valve verification"
```

If no corrections were necessary, do not create an empty commit.
