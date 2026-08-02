# One Physical Chunk, One Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse every confirmed overlapping surface pair into one paid unlock while preserving names, save value, reachability, map behavior, completion, and RuneLite exports.

**Architecture:** Extend the existing central area policy with typed alias metadata. Roll pools and persisted progress retain stable canonical owner IDs; every named-area boundary canonicalizes through the same helpers, while display copy derives the five recognizable overlap labels from policy metadata.

**Tech Stack:** TypeScript, React 18, Vitest, Vite, existing save-schema and RuneLite bundle contracts.

## Global Constraints

- One physical surface chunk has at most one paid unlock identity.
- Canonical owner IDs remain `Taverley`, `Goblin Village`, `Hemenster`, `Baxtorian Falls`, and `Mage Arena`.
- `Giants' Plateau` remains an independent rollable surface reference.
- The canonical rollable area count changes from 181 to exactly 176.
- Alias-only saves receive no refund; each redundant distinct paid identity refunds exactly one regular key.
- Refunds saturate at `MAX_COUNTER`, are idempotent, and never rewrite history.
- Alias names remain valid for requirements, searches, map links, imports, and legacy saves.
- Do not change the save schema version, RuneLite bundle wire format, key prices, roll odds, completion rewards, or historical event descriptions.
- Use tests before implementation and commit after each independently passing task.

---

## File Structure

- `data/areaMapPolicy.ts`: owns alias metadata, canonicalization, display names, and equivalence-class refund counting.
- `data/items.ts`: owns the canonical roll pools and derived `REGIONS_LIST`.
- `data/areaMapPolicy.test.ts`: pins the exact mappings and physical-overlap invariants.
- `data/consistency.test.ts`: pins the canonical roll count and pool uniqueness.
- `utils/saveSchema.test.ts`: proves migration, compensation, history, and idempotence at the persistence boundary.
- `utils/reachability.ts`: canonicalizes Standard and Chunked named-area checks.
- `utils/reachability.test.ts`: proves every alias and owner share reachability.
- `utils/chunkLocations.ts`: canonicalizes place links and constructs recognizable physical labels.
- `utils/chunkLocations.test.ts`: proves alias navigation, display labels, and physical unlocking.
- `components/RegionMap.tsx`: shows policy-derived display names in map markers and authoring choices without changing stored values.
- `components/ChunkActivityPanel.tsx`: shows the same policy-derived display name in the selected-chunk heading.
- `components/OracleSearch.tsx`: indexes overlap aliases through display copy while retaining canonical IDs for status and links.
- `components/OracleSearch.test.tsx`: proves searching an alias returns the canonical unlocked area.
- `utils/runeliteBundle.test.ts`: pins canonical root/rules exports and the 176-area region groups.
- `utils/runelitePluginParity.test.ts`: keeps web and RuneLite reachability semantics aligned.
- `data/changelog.ts`: records the player-facing fix.

### Task 1: Canonical overlap policy, roll pools, and save migration

**Files:**
- Modify: `data/areaMapPolicy.ts`
- Modify: `data/areaMapPolicy.test.ts`
- Modify: `data/items.ts`
- Modify: `data/consistency.test.ts`
- Modify: `utils/saveSchema.test.ts`

**Interfaces:**
- Consumes: existing `ChunkCoord`, `SUB_AREA_CHUNKS`, `REGION_GROUPS`, `REGIONS_LIST`, `validateAndMigrateSave`, and `MAX_COUNTER`.
- Produces: `AREA_ALIAS_POLICIES`, `AREA_ALIASES`, `canonicalAreaName(name: string): string`, `canonicalizeAreaUnlocks(names: readonly string[]): CanonicalAreaUnlocks`, and `displayAreaName(name: string): string`.

- [ ] **Step 1: Write failing policy and roll-pool tests**

Replace the exact alias assertion and surface-reference list in `data/areaMapPolicy.test.ts`, then add physical ownership and display assertions:

```ts
expect(AREA_ALIASES).toEqual({
  'Elf Camp': 'Iorwerth Camp',
  "Heroes' Guild": 'Taverley',
  'Ice Mountain': 'Goblin Village',
  'Ranging Guild': 'Hemenster',
  "Otto's Grotto": 'Baxtorian Falls',
  'Resource Area': 'Mage Arena',
});

expect(sorted(surface)).toEqual(["Giants' Plateau"]);

for (const [alias, policy] of Object.entries(AREA_ALIAS_POLICIES)) {
  if (policy.kind !== 'surface-overlap') continue;
  const owned = new Set(
    (SUB_AREA_CHUNKS[policy.canonical] ?? []).map(({ cx, cy }) => `${cx},${cy}`),
  );
  expect(policy.chunks.every(({ cx, cy }) => owned.has(`${cx},${cy}`)), alias).toBe(true);
}

expect(displayAreaName("Otto's Grotto")).toBe("Baxtorian Falls · Otto's Grotto");
expect(displayAreaName('Baxtorian Falls')).toBe("Baxtorian Falls · Otto's Grotto");
expect(displayAreaName('Iorwerth Camp')).toBe('Iorwerth Camp');
```

Add these count assertions to `data/consistency.test.ts`:

```ts
expect(REGIONS_LIST).toHaveLength(176);
expect(new Set(REGIONS_LIST).size).toBe(176);
for (const alias of Object.keys(AREA_ALIASES)) {
  expect(REGIONS_LIST, alias).not.toContain(alias);
}
```

- [ ] **Step 2: Write failing equivalence-class and save migration tests**

Extend the `canonicalizes legacy names` test in `data/areaMapPolicy.test.ts`:

```ts
expect(canonicalizeAreaUnlocks([
  "Otto's Grotto",
  'Baxtorian Falls',
  "Heroes' Guild",
  'Taverley',
])).toEqual({
  regions: ['Baxtorian Falls', 'Taverley'],
  duplicateAliasRefunds: 2,
  migrated: true,
});

expect(canonicalizeAreaUnlocks([
  "Otto's Grotto",
  "Otto's Grotto",
])).toEqual({
  regions: ['Baxtorian Falls'],
  duplicateAliasRefunds: 0,
  migrated: true,
});
```

Add a table-driven migration test beside the existing Elf Camp cases in `utils/saveSchema.test.ts`:

```ts
it.each([
  ["Heroes' Guild", 'Taverley'],
  ['Ice Mountain', 'Goblin Village'],
  ['Ranging Guild', 'Hemenster'],
  ["Otto's Grotto", 'Baxtorian Falls'],
  ['Resource Area', 'Mage Arena'],
])('migrates %s to %s without refunding an alias-only save', (alias, canonical) => {
  const result = expectAccepted(validateAndMigrateSave(
    candidate({}, { regions: [alias] }),
    defaultsFixture(),
  ));
  expect(result.state.keys).toBe(17);
  expect(result.state.unlocks.regions).toEqual([canonical]);
  expect(result.warnings).toHaveLength(1);
});

it('refunds every redundant overlapping unlock once and preserves history', () => {
  const input = candidate({}, {
    regions: [
      'Falador',
      "Otto's Grotto", 'Baxtorian Falls',
      "Heroes' Guild", 'Taverley',
      'Resource Area', 'Mage Arena',
    ],
  }) as GameState;
  const history = structuredClone(input.history);
  const first = expectAccepted(validateAndMigrateSave(input, defaultsFixture()));
  const second = expectAccepted(validateAndMigrateSave(first.state, defaultsFixture()));

  expect(first.state.keys).toBe(20);
  expect(first.state.unlocks.regions).toEqual([
    'Falador', 'Baxtorian Falls', 'Taverley', 'Mage Arena',
  ]);
  expect(first.state.history).toEqual(history);
  expect(second.state).toEqual(first.state);
  expect(second.warnings).toEqual([]);
});

it('does not mint keys for a repeated identical alias and saturates real refunds', () => {
  const repeated = expectAccepted(validateAndMigrateSave(
    candidate({}, { regions: ["Otto's Grotto", "Otto's Grotto"] }),
    defaultsFixture(),
  ));
  const saturated = expectAccepted(validateAndMigrateSave(
    candidate({ keys: MAX_COUNTER }, { regions: ["Otto's Grotto", 'Baxtorian Falls'] }),
    defaultsFixture(),
  ));
  expect(repeated.state.keys).toBe(17);
  expect(saturated.state.keys).toBe(MAX_COUNTER);
});
```

- [ ] **Step 3: Run the focused tests and verify the new cases fail**

Run:

```powershell
npx vitest run data/areaMapPolicy.test.ts data/consistency.test.ts utils/saveSchema.test.ts
```

Expected: FAIL because the five names remain rollable, are still surface references, do not canonicalize, and the area count is still 181.

- [ ] **Step 4: Implement typed alias metadata and general refund counting**

Replace the single alias literal in `data/areaMapPolicy.ts` with this policy shape and exact records:

```ts
export type AreaAliasPolicy =
  | { kind: 'legacy'; canonical: string }
  | {
      kind: 'surface-overlap';
      canonical: string;
      chunks: readonly [ChunkCoord, ...ChunkCoord[]];
    };

export const AREA_ALIAS_POLICIES = {
  'Elf Camp': { kind: 'legacy', canonical: 'Iorwerth Camp' },
  "Heroes' Guild": {
    kind: 'surface-overlap', canonical: 'Taverley', chunks: [{ cx: 45, cy: 54 }],
  },
  'Ice Mountain': {
    kind: 'surface-overlap', canonical: 'Goblin Village', chunks: [{ cx: 46, cy: 54 }],
  },
  'Ranging Guild': {
    kind: 'surface-overlap', canonical: 'Hemenster', chunks: [{ cx: 41, cy: 53 }],
  },
  "Otto's Grotto": {
    kind: 'surface-overlap', canonical: 'Baxtorian Falls', chunks: [{ cx: 39, cy: 54 }],
  },
  'Resource Area': {
    kind: 'surface-overlap', canonical: 'Mage Arena', chunks: [{ cx: 49, cy: 61 }],
  },
} as const satisfies Readonly<Record<string, AreaAliasPolicy>>;

export const AREA_ALIASES = Object.fromEntries(
  Object.entries(AREA_ALIAS_POLICIES).map(([alias, policy]) => [alias, policy.canonical]),
) as Readonly<Record<string, string>>;
```

Derive display copy only from `surface-overlap` policies:

```ts
const DISPLAY_ALIASES_BY_CANONICAL = Object.entries(AREA_ALIAS_POLICIES)
  .reduce<Record<string, string[]>>((groups, [alias, policy]) => {
    if (policy.kind === 'surface-overlap') {
      (groups[policy.canonical] ??= []).push(alias);
    }
    return groups;
  }, {});

export const displayAreaName = (name: string): string => {
  const canonical = canonicalAreaName(name);
  return [canonical, ...(DISPLAY_ALIASES_BY_CANONICAL[canonical] ?? [])].join(' · ');
};
```

Replace the refund calculation with distinct paid identifiers grouped by canonical target:

```ts
const paidByCanonical = new Map<string, Set<string>>();
for (const name of new Set(names)) {
  const canonical = canonicalAreaName(name);
  const paid = paidByCanonical.get(canonical) ?? new Set<string>();
  paid.add(name);
  paidByCanonical.set(canonical, paid);
}
const duplicateAliasRefunds = [...paidByCanonical.values()]
  .reduce((total, paid) => total + Math.max(0, paid.size - 1), 0);
```

Remove the five overlap records from `AREA_REFERENCES`; leave the `Giants' Plateau` surface record and all entrance records unchanged.

- [ ] **Step 5: Remove only the five alias sources from roll pools**

Edit the existing arrays in `data/items.ts` so the affected portions contain these canonical names:

```ts
'Asgarnia': [
  'Falador', 'Port Sarim', 'Rimmington', 'Taverley', 'Burthorpe', "Warriors' Guild",
  'Crafting Guild', 'Dwarven Mine', 'Asgarnian Ice Dungeon', 'Motherlode Mine',
  'Goblin Village', 'Mudskipper Point', "Void Knights' Outpost", 'Entrana',
],
'Kandarin': [
  'East Ardougne', 'West Ardougne', 'Catherby', "Seers' Village", 'Camelot', 'Yanille',
  'Port Khazard', 'Hemenster', 'Fishing Guild', "Legends' Guild",
  'Tree Gnome Stronghold', 'Gnome Village', 'Witchaven', 'Piscatoris Fishing Colony',
  'Feldip Hills', 'Baxtorian Falls', 'Barbarian Outpost', 'Fight Arena',
  'Castle Wars', 'Corsair Cove', "Eagles' Peak", 'Observatory', 'Ourania Altar',
],
'Wilderness': [
  'Ferox Enclave', 'Wilderness Volcano', 'Chaos Temple', "Rogues' Castle", 'Lava Maze',
  "Wilderness Bandit Camp", "Dark Warriors' Fortress", 'Graveyard of Shadows',
  'Forgotten Cemetery', 'Mage Arena', "Scorpia's Cave", 'Fountain of Rune',
  'Wilderness God Wars Dungeon', "Daimon's Crater",
],
```

Do not remove `Heroes' Guild` or `Ranging Guild` from `GUILDS_LIST`; this task changes area unlock identity, not guild progression.

- [ ] **Step 6: Run policy, consistency, and save tests**

Run:

```powershell
npx vitest run data/areaMapPolicy.test.ts data/consistency.test.ts utils/saveSchema.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the canonical policy and migration**

```powershell
git add data/areaMapPolicy.ts data/areaMapPolicy.test.ts data/items.ts data/consistency.test.ts utils/saveSchema.test.ts
git commit -m "fix: collapse overlapping surface unlocks"
```

### Task 2: Runtime reachability, map links, and recognizable labels

**Files:**
- Modify: `utils/reachability.ts`
- Modify: `utils/reachability.test.ts`
- Modify: `utils/chunkLocations.ts`
- Modify: `utils/chunkLocations.test.ts`
- Modify: `components/RegionMap.tsx`
- Modify: `components/ChunkActivityPanel.tsx`
- Modify: `components/OracleSearch.tsx`
- Modify: `components/OracleSearch.test.tsx`

**Interfaces:**
- Consumes: `canonicalAreaName`, `displayAreaName`, `SUB_AREA_CHUNKS`, `REGION_CHUNKS`, and existing `UnlockState` semantics.
- Produces: alias-aware `isNamedAreaReachableViaChunks`, `isAreaReachable`, `chunkForPlace`, `placeOf`, and policy-derived UI labels.

- [ ] **Step 1: Write failing Standard and Chunked reachability tests**

Add this exact case table to `utils/reachability.test.ts`:

```ts
const OVERLAPS = [
  ["Heroes' Guild", 'Taverley', '45,54'],
  ['Ice Mountain', 'Goblin Village', '46,54'],
  ['Ranging Guild', 'Hemenster', '41,53'],
  ["Otto's Grotto", 'Baxtorian Falls', '39,54'],
  ['Resource Area', 'Mage Arena', '49,61'],
] as const;

it.each(OVERLAPS)('%s shares Standard reachability with %s', (alias, canonical) => {
  expect(isAreaReachable(alias, { ...baseUnlocks, regions: [canonical] }, 'vanilla')).toBe(true);
  expect(isAreaReachable(canonical, { ...baseUnlocks, regions: [alias] }, 'vanilla')).toBe(true);
});

it.each(OVERLAPS)('%s shares Chunked reachability with %s', (alias, canonical, chunk) => {
  expect(isNamedAreaReachableViaChunks(alias, [chunk])).toBe(true);
  expect(isNamedAreaReachableViaChunks(alias, []))
    .toBe(isNamedAreaReachableViaChunks(canonical, []));
});
```

- [ ] **Step 2: Write failing map-link and display tests**

Import `chunkForPlace` in `utils/chunkLocations.test.ts` and add:

```ts
it('routes an overlap alias to its exact canonical-owned physical chunk', () => {
  expect(chunkForPlace("Otto's Grotto")).toEqual({ cx: 39, cy: 54 });
  expect(placeOf(39, 54).subArea).toBe('Baxtorian Falls');
  expect(chunkForPlace("Heroes' Guild")).toEqual({ cx: 45, cy: 54 });
  expect(placeOf(45, 54).subArea).toBe('Taverley');
});

it('shows recognizable overlap names without changing physical ownership', () => {
  expect(placeOf(39, 54)).toMatchObject({
    subArea: 'Baxtorian Falls',
    region: 'Kandarin',
    label: "Baxtorian Falls · Otto's Grotto · Kandarin",
  });
  expect(placeOf(45, 54).label).toBe("Taverley · Heroes' Guild · Asgarnia");
});

it('unlocks the reported physical chunk from either name', () => {
  expect(chunkUnlocked(39, 54, unlocksWith(['Baxtorian Falls']))).toBe(true);
  expect(chunkUnlocked(39, 54, unlocksWith(["Otto's Grotto"]))).toBe(true);
});
```

- [ ] **Step 3: Run the focused tests and verify alias lookups fail**

Run:

```powershell
npx vitest run utils/reachability.test.ts utils/chunkLocations.test.ts
```

Expected: FAIL because reachability and place lookup currently use raw names and `placeOf` does not show overlap aliases.

- [ ] **Step 4: Canonicalize reachability at the shared boundary**

Import `canonicalAreaName` in `utils/reachability.ts` and change the two named-area paths:

```ts
export const isNamedAreaReachableViaChunks = (
  name: string,
  unlockedChunkKeys: readonly string[],
): boolean => {
  const canonical = canonicalAreaName(name);
  const chunks = SUB_AREA_CHUNKS[canonical] || REGION_CHUNKS[canonical];
  if (!chunks || chunks.length === 0) return false;
  return chunks.some((chunk) => isChunkUnlocked(chunkKey(chunk), unlockedChunkKeys));
};

export const isAreaReachable = (
  name: string,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean => {
  const canonical = canonicalAreaName(name);
  if (gameModeId === 'chunked') {
    return isNamedAreaReachableViaChunks(canonical, unlocks.chunks ?? []);
  }
  return isFreeArea(canonical)
    || unlocks.regions.some((unlocked) => canonicalAreaName(unlocked) === canonical);
};
```

Do not add alias logic to quest, diary, activity, or goal components; those consumers already call `isAreaReachable` and must inherit the central behavior.

- [ ] **Step 5: Canonicalize place lookup and labels**

Import the policy and display helpers in `utils/chunkLocations.ts`:

```ts
import {
  AREA_ALIAS_POLICIES,
  canonicalAreaName,
  displayAreaName,
} from '../data/areaMapPolicy';
```

Replace `chunkForPlace` and the subarea portion of `placeOf`:

```ts
export const chunkForPlace = (name: string): ChunkCoord | null => {
  const trimmed = name.trim();
  const alias = AREA_ALIAS_POLICIES[trimmed as keyof typeof AREA_ALIAS_POLICIES];
  if (alias?.kind === 'surface-overlap') return alias.chunks[0];
  const canonical = canonicalAreaName(trimmed);
  return PLACE_CHUNK[canonical.toLowerCase()] ?? null;
};

const displaySubArea = subArea ? displayAreaName(subArea) : null;
const label = displaySubArea && region && subArea !== region
  ? `${displaySubArea} · ${region}`
  : displaySubArea ?? region ?? `chunk (${cx}, ${cy})`;
```

Keep `ChunkPlace.subArea` canonical; only `label` is expanded.

- [ ] **Step 6: Use the central display helper in visible map copy**

Import `displayAreaName` into `components/RegionMap.tsx` and replace visible area text while preserving canonical React keys and `<option value>` values:

```tsx
{displayAreaName(area)}
{displayAreaName(name)}{count ? ` (${count})` : ''}
```

Import `displayAreaName` into `components/ChunkActivityPanel.tsx` and change only the heading text:

```tsx
{subArea && (
  <> · <span className="text-cyan-300/90 font-semibold">{displayAreaName(subArea)}</span></>
)}
```

- [ ] **Step 7: Keep alias names searchable with canonical status semantics**

Import `displayAreaName` in `components/OracleSearch.tsx`, add optional display copy to `SearchItem`, and construct region entries separately from the generic groups:

```ts
type SearchItem = {
  name: string;
  displayName?: string;
  type: string;
  category: TableType | 'COLLECTION_LOG_ITEM';
  icon: any;
  reqText: string;
  id?: string | number;
};

REGIONS_LIST.forEach((name) => items.push({
  name,
  displayName: displayAreaName(name),
  type: 'Region',
  category: TableType.REGIONS,
  icon: Map,
  reqText: 'Requires Key in Regions Table',
}));
```

Remove the existing `addGroup(REGIONS_LIST, ...)` call. Score and render the display name, but keep status and Wiki lookup on canonical `item.name`:

```ts
const searchName = item.displayName ?? item.name;
const r = score(searchName);

{item.displayName ?? item.name}
href={getWikiUrl(item.name)}
```

In `components/OracleSearch.test.tsx`, replace the existing hoisted game state and React mock with the code below, then add the alias case in the same file:

```tsx
const mockQuery = vi.hoisted(() => ({ current: 'Easy Tier' }));
const mockGame = vi.hoisted(() => ({
  current: {
    unlocks: {
      completedTasks: [] as string[],
      cas: [] as string[],
      regions: [] as string[],
      chunks: [] as string[],
    },
    gameModeId: 'standard',
  },
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState<T>(initial: T) {
      if (initial === '') return [mockQuery.current, vi.fn()];
      return actual.useState(initial);
    },
  };
});

it("finds Otto's Grotto as the unlocked Baxtorian Falls area", () => {
  mockQuery.current = "Otto's Grotto";
  mockGame.current.unlocks.regions = ['Baxtorian Falls'];
  mockGame.current.unlocks.chunks = [];

  const markup = renderToStaticMarkup(<OracleSearch onClose={vi.fn()} />);

  expect(markup).toContain("Baxtorian Falls \u00b7 Otto&#x27;s Grotto");
  expect(markup).toContain('Unlocked');
  expect(markup).not.toContain('No fate found');
});
```

Restore `mockQuery.current = 'Easy Tier'` in the existing Combat Achievement test setup so the two cases remain independent.

- [ ] **Step 8: Run runtime and component-focused tests**

Run:

```powershell
npx vitest run utils/reachability.test.ts utils/chunkLocations.test.ts components/ChunkActivityPanel.test.tsx components/OracleSearch.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit runtime, display, and search behavior**

```powershell
git add utils/reachability.ts utils/reachability.test.ts utils/chunkLocations.ts utils/chunkLocations.test.ts components/RegionMap.tsx components/ChunkActivityPanel.tsx components/OracleSearch.tsx components/OracleSearch.test.tsx
git commit -m "fix: resolve area aliases at runtime"
```

### Task 3: RuneLite contract, completion totals, changelog, and release verification

**Files:**
- Modify: `utils/runeliteBundle.test.ts`
- Modify: `utils/runelitePluginParity.test.ts`
- Modify: `data/changelog.ts`

**Interfaces:**
- Consumes: canonical `REGION_GROUPS`, `canonicalizeAreaUnlocks`, `buildRuneliteBundle`, and shared web/plugin reachability fixtures.
- Produces: regression coverage proving aliases never reappear as exported paid identities.

- [ ] **Step 1: Add exact RuneLite bundle assertions**

Extend `utils/runeliteBundle.test.ts`:

```ts
it('canonicalizes every overlapping surface alias in root and rules unlocks', async () => {
  const aliases = [
    "Heroes' Guild", 'Ice Mountain', 'Ranging Guild', "Otto's Grotto", 'Resource Area',
  ];
  const canonical = [
    'Taverley', 'Goblin Village', 'Hemenster', 'Baxtorian Falls', 'Mage Arena',
  ];
  const bundle = await buildRuneliteBundle([...aliases, ...canonical], state);

  expect(bundle.unlockedRegions).toEqual(canonical);
  expect(bundle.rules.unlocks.regions).toEqual([...canonical].sort());
  expect(Object.values(bundle.regionGroups).flat()).toHaveLength(176);
  for (const alias of aliases) {
    expect(Object.values(bundle.regionGroups).flat()).not.toContain(alias);
  }
  expect(bundle.subAreaChunks['Baxtorian Falls']).toContainEqual({ cx: 39, cy: 54 });
});
```

Add an alias case to the existing Standard-mode section of `utils/runelitePluginParity.test.ts`: export a run unlocked with `Baxtorian Falls` and assert both web `isAreaReachable("Otto's Grotto", ...)` and the bundle-backed plugin fixture report the owner chunk unlocked.

- [ ] **Step 2: Run RuneLite and completion-sensitive tests**

Run:

```powershell
npx vitest run utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts utils/achievements.test.ts components/ShareModal.test.tsx data/consistency.test.ts
```

Expected: PASS. If the parity fixture exposes raw-name lookup, update that fixture to canonicalize with the bundle's canonical region groups; do not add aliases back into `regionGroups`.

- [ ] **Step 3: Add the player-facing changelog entry**

Prepend this release to `CHANGELOG_RELEASES` in `data/changelog.ts`:

```ts
{
  id: '2026-08-02-one-physical-chunk-one-unlock',
  title: 'One Chunk, One Unlock',
  date: '2026-08-02',
  sections: {
    changed: [
      "Heroes' Guild, Ice Mountain, Ranging Guild, Otto's Grotto, and the Resource Area now share their physical chunk's single area unlock.",
      'Existing saves automatically keep the canonical area and receive one regular Key for each duplicate overlap they previously purchased.',
    ],
    fixed: [
      "Unlocking Otto's Grotto now visibly unlocks the Baxtorian Falls chunk containing it.",
    ],
  },
},
```

- [ ] **Step 4: Run the complete overlap verification gate**

Run:

```powershell
npx vitest run data/areaMapPolicy.test.ts data/consistency.test.ts utils/saveSchema.test.ts utils/reachability.test.ts utils/chunkLocations.test.ts utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts components/ChunkActivityPanel.test.tsx components/OracleSearch.test.tsx
npm run typecheck
npm run changelog:verify
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit contract tests and changelog**

```powershell
git add utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts data/changelog.ts
git commit -m "test: protect one-chunk unlock contract"
```
