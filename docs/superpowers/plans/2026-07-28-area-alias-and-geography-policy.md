# Area Alias Migration and Geography Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicate Elf Camp roll, migrate legacy progress safely to Iorwerth Camp with a one-time duplicate-key refund, and require an explicit geographic policy for every rollable area.

**Architecture:** A new pure `data/areaMapPolicy.ts` module owns legacy aliases, non-exclusive surface/entrance references, intentional exemptions, and canonicalization. The existing exclusive `SUB_AREA_CHUNKS` map remains unchanged. Save validation and RuneLite bundle construction consume the same canonicalization helper, while `REGION_GROUPS` remains the single source for roll pools and completion totals.

**Tech Stack:** TypeScript 5, React 18, Vite 5, Vitest 4, existing strict save-schema utilities.

## Global Constraints

- Keep `CURRENT_SAVE_VERSION` at `1`; this is data canonicalization, not a structural save-format change.
- Do not change the RuneLite version 3 wire format or the Java plugin.
- Do not reassign existing exclusive `SUB_AREA_CHUNKS` ownership.
- Non-exclusive surface and entrance references may overlap existing sub-area chunks.
- Preserve the first-seen order of migrated region unlocks.
- Preserve save history byte-for-byte through this migration.
- A save containing only `Elf Camp` receives no refund.
- A save containing both `Elf Camp` and `Iorwerth Camp` receives exactly one regular key.
- Revalidating or re-importing the migrated save must never award another key.
- Saturate a refund at `MAX_COUNTER`; never reject an otherwise valid save because of the refund.
- `Tutorial Island` remains rollable but is explicitly exempt from mapping because a normal account cannot return after leaving.
- The exhaustive chunk-geography audit and per-chunk content audit are separate workstreams and are not implemented by this plan.

**Design source:** `docs/superpowers/specs/2026-07-28-area-alias-and-geography-policy-design.md`

---

## File Structure

- Create `data/areaMapPolicy.ts`: exceptional-area policy data plus pure canonicalization helpers.
- Create `data/areaMapPolicy.test.ts`: coverage, coordinate, alias, and classification invariants.
- Create `utils/gameEngine.test.ts`: public Regions-pool behavior.
- Create `utils/completion.test.ts`: corrected canonical completion denominator.
- Modify `data/items.ts`: remove the legacy `Elf Camp` Tirannwn child.
- Modify `utils/reachability.test.ts`: canonical Tirannwn parent-completion regression.
- Modify `utils/saveSchema.ts`: apply canonicalization and one-time regular-key refund.
- Modify `utils/saveSchema.test.ts`: current, legacy, idempotency, history, ordering, and saturation coverage.
- Modify `utils/runeliteBundle.ts`: canonicalize exported region unlocks defensively.
- Modify `utils/runeliteBundle.test.ts`: canonical names, corrected group, and unchanged overlay coverage.

---

### Task 1: Canonical Area Policy and Corrected Roll Pool

**Files:**
- Create: `data/areaMapPolicy.ts`
- Create: `data/areaMapPolicy.test.ts`
- Create: `utils/gameEngine.test.ts`
- Create: `utils/completion.test.ts`
- Modify: `data/items.ts:190-194`
- Modify: `utils/reachability.test.ts`

**Interfaces:**
- Consumes: `ChunkCoord` from `utils/mapCoords.ts`, `REGION_CHUNKS`, `SUB_AREA_CHUNKS`, `REGION_GROUPS`, `REGIONS_LIST`, `COMPLETION_DENOMINATOR`, `TableType`, `UnlockState`, `getPoolAndStateKey`, and `isRegionUnlocked`.
- Produces:
  - `AREA_ALIASES: Readonly<Record<string, string>>`
  - `AreaReference` with `kind`, `chunks`, and `reason`
  - `AREA_REFERENCES: Readonly<Record<string, AreaReference>>`
  - `INTENTIONALLY_UNMAPPABLE_AREAS: Readonly<Record<string, string>>`
  - `canonicalAreaName(name: string): string`
  - `CanonicalAreaUnlocks`
  - `canonicalizeAreaUnlocks(names: readonly string[]): CanonicalAreaUnlocks`
  - a canonical `REGION_GROUPS.Tirannwn` without `Elf Camp`

- [ ] **Step 1: Write the failing area-policy tests**

Create `data/areaMapPolicy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { REGION_CHUNKS } from './regionChunks';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { REGIONS_LIST } from './items';
import {
  AREA_ALIASES,
  AREA_REFERENCES,
  INTENTIONALLY_UNMAPPABLE_AREAS,
  canonicalAreaName,
  canonicalizeAreaUnlocks,
} from './areaMapPolicy';

const sorted = (values: Iterable<string>) => [...values].sort();

const AUTHORED_CHUNKS = new Set(
  Object.values(REGION_CHUNKS)
    .flat()
    .map(({ cx, cy }) => `${cx},${cy}`),
);

const EXPECTED_EXCEPTIONAL_NAMES = [
  'Asgarnian Ice Dungeon',
  'Braindeath Island',
  'Catacombs of Kourend',
  'Dwarven Mine',
  'Elf Camp',
  "Giants' Plateau",
  "Heroes' Guild",
  'Ice Mountain',
  'Keldagrim',
  'Mor Ul Rek (TzHaar City)',
  'Motherlode Mine',
  "Otto's Grotto",
  'Ranging Guild',
  'Resource Area',
  'Tutorial Island',
  'Wilderness God Wars Dungeon',
  'Zanaris',
];

describe('area map policy', () => {
  it('classifies the exact seventeen audited exceptional names', () => {
    const exceptional = new Set([
      ...Object.keys(AREA_ALIASES),
      ...Object.keys(AREA_REFERENCES),
      ...Object.keys(INTENTIONALLY_UNMAPPABLE_AREAS),
    ]);
    expect(sorted(exceptional)).toEqual(sorted(EXPECTED_EXCEPTIONAL_NAMES));
  });

  it('gives every rollable area exactly one current geography route', () => {
    const invalid = REGIONS_LIST
      .map((name) => ({
        name,
        routes: Number(Object.hasOwn(SUB_AREA_CHUNKS, name))
          + Number(Object.hasOwn(AREA_REFERENCES, name))
          + Number(Object.hasOwn(INTENTIONALLY_UNMAPPABLE_AREAS, name)),
      }))
      .filter(({ routes }) => routes !== 1);

    expect(invalid).toEqual([]);
  });

  it('keeps aliases out of rolls and points them directly at current areas', () => {
    for (const [legacy, canonical] of Object.entries(AREA_ALIASES)) {
      expect(REGIONS_LIST, legacy).not.toContain(legacy);
      expect(REGIONS_LIST, canonical).toContain(canonical);
      expect(Object.hasOwn(AREA_ALIASES, canonical), canonical).toBe(false);
      expect(canonicalAreaName(legacy)).toBe(canonical);
    }
  });

  it('uses only authored chunks for surface and entrance references', () => {
    const invalid = Object.entries(AREA_REFERENCES).flatMap(([name, policy]) =>
      policy.chunks
        .filter(({ cx, cy }) => !AUTHORED_CHUNKS.has(`${cx},${cy}`))
        .map(({ cx, cy }) => `${name}: ${cx},${cy}`),
    );
    expect(invalid).toEqual([]);
  });

  it('uses current areas for references and exemptions without overlap', () => {
    const referenced = Object.keys(AREA_REFERENCES);
    const exempted = Object.keys(INTENTIONALLY_UNMAPPABLE_AREAS);
    expect(referenced.filter((name) => !REGIONS_LIST.includes(name))).toEqual([]);
    expect(exempted.filter((name) => !REGIONS_LIST.includes(name))).toEqual([]);
    expect(referenced.filter((name) => exempted.includes(name))).toEqual([]);
  });

  it('canonicalizes legacy names, preserves order, and reports only paid duplicates', () => {
    expect(canonicalizeAreaUnlocks(['Elf Camp', 'Prifddinas'])).toEqual({
      regions: ['Iorwerth Camp', 'Prifddinas'],
      duplicateAliasRefunds: 0,
      migrated: true,
    });
    expect(canonicalizeAreaUnlocks([
      'Prifddinas',
      'Elf Camp',
      'Iorwerth Camp',
      'Lletya',
    ])).toEqual({
      regions: ['Prifddinas', 'Iorwerth Camp', 'Lletya'],
      duplicateAliasRefunds: 1,
      migrated: true,
    });
    expect(canonicalizeAreaUnlocks(['Prifddinas', 'Iorwerth Camp'])).toEqual({
      regions: ['Prifddinas', 'Iorwerth Camp'],
      duplicateAliasRefunds: 0,
      migrated: false,
    });
  });
});
```

The production mutation each test catches is, respectively: a missing audit
classification, an unclassified new rollable area, a legacy name returning
to the pool, an invalid reference coordinate, overlapping policy categories,
or broken canonicalization/refund detection.

- [ ] **Step 2: Write the failing Regions-pool test**

Create `utils/gameEngine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TableType } from '../types';
import { REGION_GROUPS } from '../data/items';
import { getPoolAndStateKey } from './gameEngine';

describe('canonical Regions unlock pool', () => {
  it('offers Iorwerth Camp once and never offers the legacy Elf Camp name', () => {
    const { pool, stateKey } = getPoolAndStateKey(TableType.REGIONS);
    expect(stateKey).toBe('region');
    expect(pool.filter((name) => name === 'Iorwerth Camp')).toHaveLength(1);
    expect(pool).not.toContain('Elf Camp');
    expect(REGION_GROUPS.Tirannwn).toEqual([
      'Prifddinas',
      'Lletya',
      'Tyras Camp',
      'Isafdar',
      'Zul-Andra',
      'Arandar',
      'Gwenith',
      'Iorwerth Camp',
      'Poison Waste',
    ]);
  });
});
```

- [ ] **Step 3: Write the failing Tirannwn-completion test**

Append to `utils/reachability.test.ts` and add `isRegionUnlocked` to its import:

```ts
import {
  isAreaReachable,
  isNamedAreaReachableViaChunks,
  isRegionUnlocked,
} from './reachability';

describe('canonical Tirannwn completion', () => {
  it('completes without the removed Elf Camp duplicate', () => {
    const canonicalChildren = [
      'Prifddinas',
      'Lletya',
      'Tyras Camp',
      'Isafdar',
      'Zul-Andra',
      'Arandar',
      'Gwenith',
      'Iorwerth Camp',
      'Poison Waste',
    ];
    expect(isRegionUnlocked('Tirannwn', canonicalChildren)).toBe(true);
  });
});
```

- [ ] **Step 4: Write the failing completion-denominator test**

Create `utils/completion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { REGIONS_LIST } from '../data/items';
import { COMPLETION_DENOMINATOR } from './completion';

describe('canonical area completion accounting', () => {
  it('removes the duplicate Elf Camp point from the global denominator', () => {
    expect(REGIONS_LIST).toHaveLength(181);
    expect(REGIONS_LIST).not.toContain('Elf Camp');
    expect(COMPLETION_DENOMINATOR).toBe(951);
  });
});
```

The literal values intentionally pin this content migration: before the fix
the corresponding values are 182 regions and a denominator of 952.

- [ ] **Step 5: Run the new tests and verify RED**

Run:

```powershell
npm test -- data/areaMapPolicy.test.ts utils/gameEngine.test.ts utils/completion.test.ts utils/reachability.test.ts
```

Expected: FAIL because `data/areaMapPolicy.ts` does not exist, `Elf Camp`
remains in the Regions pool, and canonical Tirannwn children do not complete
the existing ten-child group.

- [ ] **Step 6: Implement the central area policy**

Create `data/areaMapPolicy.ts`:

```ts
import type { ChunkCoord } from '../utils/mapCoords';

export const AREA_ALIASES = {
  'Elf Camp': 'Iorwerth Camp',
} as const satisfies Readonly<Record<string, string>>;

export interface AreaReference {
  kind: 'surface' | 'entrance';
  chunks: readonly ChunkCoord[];
  reason: string;
}

export const AREA_REFERENCES = {
  "Heroes' Guild": {
    kind: 'surface',
    chunks: [{ cx: 45, cy: 54 }],
    reason: 'The guild surface lies between Taverley and Burthorpe.',
  },
  'Ice Mountain': {
    kind: 'surface',
    chunks: [{ cx: 46, cy: 54 }],
    reason: 'Representative surface chunk for Ice Mountain.',
  },
  'Ranging Guild': {
    kind: 'surface',
    chunks: [{ cx: 41, cy: 53 }],
    reason: 'The guild surface overlaps the Hemenster map chunk.',
  },
  "Otto's Grotto": {
    kind: 'surface',
    chunks: [{ cx: 39, cy: 54 }],
    reason: 'The grotto surface overlaps Baxtorian Falls.',
  },
  "Giants' Plateau": {
    kind: 'surface',
    chunks: [{ cx: 52, cy: 49 }],
    reason: 'Representative surface chunk east of Al Kharid.',
  },
  'Resource Area': {
    kind: 'surface',
    chunks: [{ cx: 49, cy: 61 }],
    reason: 'The enclosed Wilderness surface overlaps the Mage Arena chunk.',
  },
  'Dwarven Mine': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 53 }],
    reason: 'Ice Mountain surface entrance to the underground mine.',
  },
  'Asgarnian Ice Dungeon': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 49 }],
    reason: 'Surface entrance south of Port Sarim near Mudskipper Point.',
  },
  'Motherlode Mine': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 52 }],
    reason: 'Falador access route into the Dwarven Mine and Motherlode Mine.',
  },
  'Mor Ul Rek (TzHaar City)': {
    kind: 'entrance',
    chunks: [{ cx: 44, cy: 49 }],
    reason: 'Karamja Volcano entrance to the underground TzHaar city.',
  },
  'Braindeath Island': {
    kind: 'entrance',
    chunks: [{ cx: 57, cy: 55 }],
    reason: 'Pirate Pete departure point north of Port Phasmatys.',
  },
  'Keldagrim': {
    kind: 'entrance',
    chunks: [{ cx: 42, cy: 57 }],
    reason: 'Surface cave entrance east of Rellekka.',
  },
  'Wilderness God Wars Dungeon': {
    kind: 'entrance',
    chunks: [{ cx: 47, cy: 58 }],
    reason: 'Wilderness surface entrance to the underground dungeon.',
  },
  'Catacombs of Kourend': {
    kind: 'entrance',
    chunks: [{ cx: 25, cy: 57 }],
    reason: 'Statue of King Rada I in the Kourend Castle courtyard.',
  },
  'Zanaris': {
    kind: 'entrance',
    chunks: [{ cx: 50, cy: 49 }],
    reason: 'Lumbridge Swamp shed entrance to Zanaris.',
  },
} as const satisfies Readonly<Record<string, AreaReference>>;

export const INTENTIONALLY_UNMAPPABLE_AREAS = {
  'Tutorial Island': 'A normal account cannot return after leaving the tutorial.',
} as const satisfies Readonly<Record<string, string>>;

export interface CanonicalAreaUnlocks {
  regions: string[];
  duplicateAliasRefunds: number;
  migrated: boolean;
}

export const canonicalAreaName = (name: string): string =>
  Object.hasOwn(AREA_ALIASES, name)
    ? AREA_ALIASES[name as keyof typeof AREA_ALIASES]
    : name;

export const canonicalizeAreaUnlocks = (
  names: readonly string[],
): CanonicalAreaUnlocks => {
  const input = new Set(names);
  const seen = new Set<string>();
  const regions: string[] = [];

  for (const name of names) {
    const canonical = canonicalAreaName(name);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    regions.push(canonical);
  }

  const duplicateAliasRefunds = Object.entries(AREA_ALIASES)
    .filter(([legacy, canonical]) => input.has(legacy) && input.has(canonical))
    .length;
  const migrated = names.length !== regions.length
    || names.some((name, index) => regions[index] !== name);

  return { regions, duplicateAliasRefunds, migrated };
};
```

- [ ] **Step 7: Remove the legacy roll entry**

Change the Tirannwn group in `data/items.ts` to:

```ts
  'Tirannwn': [
    'Prifddinas', 'Lletya', 'Tyras Camp', 'Isafdar', 'Zul-Andra',
    'Arandar', 'Gwenith', 'Iorwerth Camp', 'Poison Waste'
  ],
```

Do not add `Elf Camp` to `SUB_AREA_CHUNKS`; the alias is a compatibility
input, not a second current overlay.

- [ ] **Step 8: Run the focused tests and verify GREEN**

Run:

```powershell
npm test -- data/areaMapPolicy.test.ts data/subAreaChunks.test.ts utils/gameEngine.test.ts utils/completion.test.ts utils/reachability.test.ts
```

Expected: all focused tests PASS. The existing exclusive-overlay tests must
remain green because no `SUB_AREA_CHUNKS` ownership changed.

- [ ] **Step 9: Run the mutation check**

Temporarily reason through these mutations without changing the tests:

- adding `Elf Camp` back to Tirannwn fails pool, alias, and coverage tests;
- deleting any of the sixteen current exception records fails coverage;
- changing a reference to an unauthored coordinate fails coordinate validity;
- adding a second policy route for one area fails exact-one coverage;
- changing the alias target breaks alias and canonicalization assertions.

- [ ] **Step 10: Commit Task 1**

```powershell
git add data/areaMapPolicy.ts data/areaMapPolicy.test.ts data/items.ts utils/gameEngine.test.ts utils/completion.test.ts utils/reachability.test.ts
git commit -m "fix: canonicalize Elf Camp area policy"
```

---

### Task 2: Idempotent Save Migration and Duplicate-Key Refund

**Files:**
- Modify: `utils/saveSchema.ts:1-7,285-396,710-823`
- Modify: `utils/saveSchema.test.ts:1-220`

**Interfaces:**
- Consumes: `canonicalizeAreaUnlocks(names)` from Task 1 and existing
  `MAX_COUNTER`, `identifierArray`, `normalizeUnlocks`, `normalizeState`.
- Produces: `normalizeUnlocks` result field
  `regularKeyRefunds: number`; canonical `state.unlocks.regions`; saturated
  `state.keys`; existing `{ code: 'migrated' }` warning on the first load.

- [ ] **Step 1: Write the failing current-save migration tests**

Add these tests inside `describe('save schema compatibility', ...)` in
`utils/saveSchema.test.ts`:

```ts
  it('renames a lone Elf Camp unlock without refunding a key', () => {
    const input = candidate({}, {
      regions: ['Prifddinas', 'Elf Camp', 'Lletya'],
    });
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.keys).toBe(17);
    expect(result.state.unlocks.regions).toEqual([
      'Prifddinas',
      'Iorwerth Camp',
      'Lletya',
    ]);
    expect(result.warnings).toEqual([{
      code: 'migrated',
      message: 'Save data was migrated to the current format.',
    }]);
  });

  it('refunds exactly one regular key when both Elf Camp names were paid for', () => {
    const input = candidate({}, {
      regions: ['Prifddinas', 'Elf Camp', 'Iorwerth Camp', 'Lletya'],
    });
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.keys).toBe(18);
    expect(result.state.unlocks.regions).toEqual([
      'Prifddinas',
      'Iorwerth Camp',
      'Lletya',
    ]);
  });

  it('does not modify a canonical Iorwerth Camp save', () => {
    const input = candidate({}, {
      regions: ['Prifddinas', 'Iorwerth Camp', 'Lletya'],
    });
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.keys).toBe(17);
    expect(result.state.unlocks.regions).toEqual([
      'Prifddinas',
      'Iorwerth Camp',
      'Lletya',
    ]);
    expect(result.warnings).toEqual([]);
  });
```

- [ ] **Step 2: Write the failing idempotency, history, legacy, and saturation tests**

Add:

```ts
  it('does not refund twice when a migrated save is revalidated', () => {
    const input = candidate({}, {
      regions: ['Elf Camp', 'Iorwerth Camp'],
    });
    const first = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));
    const second = expectAccepted(validateAndMigrateSave(first.state, defaultsFixture()));

    expect(first.state.keys).toBe(18);
    expect(second.state).toEqual(first.state);
    expect(second.warnings).toEqual([]);
  });

  it('preserves complete history and unrelated region order during migration', () => {
    const input = candidate({}, {
      regions: ['Karamja', 'Elf Camp', 'Iorwerth Camp', 'Falador'],
    }) as GameState;
    const originalHistory = structuredClone(input.history);
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.history).toEqual(originalHistory);
    expect(result.state.unlocks.regions).toEqual([
      'Karamja',
      'Iorwerth Camp',
      'Falador',
    ]);
  });

  it('applies the same duplicate refund to an unversioned legacy save', () => {
    const input = candidate({}, {
      regions: ['Elf Camp', 'Iorwerth Camp'],
    }) as Record<string, unknown>;
    delete input.version;
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.sourceVersion).toBe(0);
    expect(result.state.keys).toBe(18);
    expect(result.state.unlocks.regions).toEqual(['Iorwerth Camp']);
  });

  it('saturates a duplicate refund at MAX_COUNTER', () => {
    const input = candidate({ keys: MAX_COUNTER }, {
      regions: ['Elf Camp', 'Iorwerth Camp'],
    });
    const result = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));

    expect(result.state.keys).toBe(MAX_COUNTER);
    expect(result.state.unlocks.regions).toEqual(['Iorwerth Camp']);
    expect(result.warnings).toHaveLength(1);
  });
```

- [ ] **Step 3: Run the save tests and verify RED**

Run:

```powershell
npm test -- utils/saveSchema.test.ts
```

Expected: FAIL because current save normalization still preserves `Elf Camp`,
does not expose a refund count, and does not increment `keys`.

- [ ] **Step 4: Add canonicalization to unlock normalization**

At the top of `utils/saveSchema.ts`, add:

```ts
import { canonicalizeAreaUnlocks } from '../data/areaMapPolicy';
```

Change the `normalizeUnlocks` return type:

```ts
): Outcome<{
  value: UnlockState;
  migrated: boolean;
  regularKeyRefunds: number;
}> => {
```

Immediately after the `UNLOCK_ARRAY_KEYS` loop, canonicalize regions:

```ts
  const canonicalRegions = canonicalizeAreaUnlocks(arrays.regions);
  arrays.regions = canonicalRegions.regions;
  migrated ||= canonicalRegions.migrated;
```

Change the final return:

```ts
  return {
    ok: true,
    value: {
      value: unlocks,
      migrated,
      regularKeyRefunds: canonicalRegions.duplicateAliasRefunds,
    },
  };
```

- [ ] **Step 5: Apply the refund while assembling canonical state**

In `normalizeState`, change only the `keys` field of the `GameState` literal:

```ts
  const state: GameState = {
    version: CURRENT_SAVE_VERSION,
    keys: Math.min(
      MAX_COUNTER,
      keys.value + unlocks.value.regularKeyRefunds,
    ),
    specialKeys: specialKeys.value,
    chaosKeys: chaosKeys.value,
    fatePoints: fatePoints.value,
    activeBuff: selectedBuff.value,
    unlocks: unlocks.value.value,
    history: history.value,
    pinnedGoals: pinnedGoals.value,
    userNotes: userNotes.value,
  };
```

Do not add a history entry. The existing first-pass `migrated` flag drives
the warning, while the existing second normalization pass sees canonical
regions and a zero refund count.

- [ ] **Step 6: Run save tests and verify GREEN**

Run:

```powershell
npm test -- utils/saveSchema.test.ts utils/gamePersistence.test.ts context/GameContext.persistence.test.ts
```

Expected: all tests PASS, including strict current saves, unversioned saves,
storage-backed imports, and repeated normalization.

- [ ] **Step 7: Run the mutation check**

Confirm the tests fail under each conceptual mutation:

- refund on `Elf Camp` alone;
- omit the refund when both names exist;
- always add a key on each validation;
- sort regions instead of preserving first-seen order;
- modify or append to history;
- add beyond `MAX_COUNTER`.

- [ ] **Step 8: Commit Task 2**

```powershell
git add utils/saveSchema.ts utils/saveSchema.test.ts
git commit -m "fix: migrate duplicate Elf Camp unlocks"
```

---

### Task 3: Canonical RuneLite Export

**Files:**
- Modify: `utils/runeliteBundle.ts:6-45`
- Modify: `utils/runeliteBundle.test.ts`

**Interfaces:**
- Consumes: `canonicalizeAreaUnlocks(unlockedRegions)` from Task 1 and the
  corrected `REGION_GROUPS` from Task 1.
- Produces: version 3 bundles whose `unlockedRegions` and
  `regionGroups.Tirannwn` contain only canonical names, with the existing
  `subAreaChunks['Iorwerth Camp']` unchanged.

- [ ] **Step 1: Write the failing RuneLite canonicalization tests**

Append to `utils/runeliteBundle.test.ts`:

```ts
describe('buildRuneliteBundle — canonical area names', () => {
  it('exports a legacy Elf Camp unlock as Iorwerth Camp', async () => {
    const bundle = await buildRuneliteBundle(['Elf Camp'], state);
    expect(bundle.unlockedRegions).toEqual(['Iorwerth Camp']);
  });

  it('deduplicates mixed legacy and canonical Elf Camp unlocks', async () => {
    const bundle = await buildRuneliteBundle([
      'Prifddinas',
      'Elf Camp',
      'Iorwerth Camp',
      'Lletya',
    ], state);
    expect(bundle.unlockedRegions).toEqual([
      'Prifddinas',
      'Iorwerth Camp',
      'Lletya',
    ]);
  });

  it('exports canonical Tirannwn children and retains the Iorwerth overlay', async () => {
    const bundle = await buildRuneliteBundle([], state);
    expect(bundle.regionGroups.Tirannwn).toEqual([
      'Prifddinas',
      'Lletya',
      'Tyras Camp',
      'Isafdar',
      'Zul-Andra',
      'Arandar',
      'Gwenith',
      'Iorwerth Camp',
      'Poison Waste',
    ]);
    expect(bundle.regionGroups.Tirannwn).not.toContain('Elf Camp');
    expect(bundle.subAreaChunks['Iorwerth Camp']).toEqual([
      { cx: 33, cy: 50 },
      { cx: 34, cy: 50 },
    ]);
  });
});
```

- [ ] **Step 2: Run the bundle tests and verify RED**

Run:

```powershell
npm test -- utils/runeliteBundle.test.ts
```

Expected: the group/overlay assertion passes after Task 1, but the two
defense-in-depth input canonicalization tests FAIL because the bundle
currently serializes its input unchanged.

- [ ] **Step 3: Canonicalize bundle input**

Add this import to `utils/runeliteBundle.ts`:

```ts
import { canonicalizeAreaUnlocks } from '../data/areaMapPolicy';
```

At the beginning of `buildRuneliteBundle`, before the dynamic import, add:

```ts
  const canonicalRegions = canonicalizeAreaUnlocks(unlockedRegions).regions;
```

Change the returned field:

```ts
    unlockedRegions: canonicalRegions,
```

Do not change `version`, `chunks`, `subAreaChunks`, `regionGroups`, or add a
new policy field.

- [ ] **Step 4: Run bundle and cross-project parity tests**

Run:

```powershell
npm test -- utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts
```

Expected: all tests PASS. Web/RuneLite lock semantics remain aligned because
only names are canonicalized and the Iorwerth coordinates are unchanged.

- [ ] **Step 5: Run the mutation check**

Confirm the tests catch:

- serializing `Elf Camp` unchanged;
- emitting both legacy and canonical names;
- restoring `Elf Camp` to `regionGroups.Tirannwn`;
- removing or changing Iorwerth Camp overlay chunks;
- changing the bundle version or shape.

- [ ] **Step 6: Commit Task 3**

```powershell
git add utils/runeliteBundle.ts utils/runeliteBundle.test.ts
git commit -m "fix: canonicalize RuneLite area exports"
```

---

### Task 4: Integrated Verification

**Files:**
- Verify only; no production files should be added in this task.

**Interfaces:**
- Consumes: all Task 1-3 deliverables.
- Produces: evidence that mapping policy, save compatibility, roll/completion
  behavior, RuneLite parity, type checking, content checks, and production
  build all pass together.

- [ ] **Step 1: Run all directly affected tests together**

Run:

```powershell
npm test -- data/areaMapPolicy.test.ts data/subAreaChunks.test.ts utils/gameEngine.test.ts utils/completion.test.ts utils/reachability.test.ts utils/saveSchema.test.ts utils/gamePersistence.test.ts context/GameContext.persistence.test.ts utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts
```

Expected: all listed test files PASS with no warnings or unhandled errors.

- [ ] **Step 2: Run the TypeScript checker**

Run:

```powershell
npm run typecheck
```

Expected: exit code `0` with no TypeScript diagnostics.

- [ ] **Step 3: Run the full release gate**

Run:

```powershell
npm run release:verify
```

Expected: the full Vitest suite, typecheck, content verification, and Vite
production build all PASS.

- [ ] **Step 4: Review the final diff**

Run:

```powershell
git diff HEAD~3 --check
git diff HEAD~3 --stat
git status --short
```

Expected:

- `git diff --check` reports no whitespace errors;
- the stat contains only the implementation and test files named by Tasks 1-3;
- `git status --short` is empty.

- [ ] **Step 5: Record follow-up audit boundary in the handoff**

The completion handoff must explicitly state:

- the urgent migration and policy release gate are complete;
- no exhaustive `REGION_CHUNKS` corrections were made;
- no `CHUNK_CONTENT_LITE` corrections were made; and
- the next workstream is a separate evidence-backed geography-audit spec,
  followed by a separate per-chunk content-audit spec.
