# Named Task Unlocks and Entrance Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 140 named-location task-unlock records a reviewed terminal disposition and show each mapped entrance in Chunk Info as locked with or available through its physical chunk.

**Architecture:** A committed evidence registry maps exact upstream location names to reviewed physical entrance chunks or explicit exclusions. The chunk transformer validates that registry, emits per-chunk task requirements plus a compact entrance index, and fails the release gate on any unexplained name; a focused runtime service and presentation component render entrance state from the existing chunk unlock without changing saves.

**Tech Stack:** Node.js ES modules, JSON source registries, TypeScript, React 18, Vitest, Testing Library, Vite, existing chunk-content generation and audit pipeline.

## Global Constraints

- One physical surface chunk has at most one paid unlock identity.
- Unlocking a physical chunk makes every entrance physically located in that chunk available without another key or roll.
- Entrance availability does not satisfy quest, Slayer task, Slayer level, skill, item, or route-specific requirements.
- Multiple independent entrances follow their own physical chunks; any usable route may provide access.
- Every named source location must end as mapped, instance-only, or non-purchasable; no nearest-chunk guesses are allowed.
- The task-unlock audit must finish with exactly zero unresolved records.
- Legitimate exclusions remain visible as explained exclusions and never produce fabricated entrances.
- The pinned Chunk Picker export remains the authority for source entities and requirement text.
- OSRS Wiki revisions, RuneLite or cache coordinates, and FLIM's canonical chunk policy supply reviewed entrance evidence.
- Production and CI use only committed evidence; they do not fetch live sources.
- Existing saves, chunk ownership, key prices, roll odds, and RuneLite wire formats remain unchanged.
- Generated content is regenerated through `npm run chunks:sync`; generated JSON and audit files are never hand-edited.
- Use tests before implementation and commit after every independently passing task.

---

## File Structure

- `data/sources/named-task-unlock-locations.json`: reviewed evidence, exact upstream keys, dispositions, entrances, coordinates, and provenance.
- `scripts/named-task-unlock-locations.mjs`: reads, indexes, validates, and converts the registry into a per-chunk entrance index.
- `scripts/named-task-unlock-locations.test.ts`: pins registry schema, exact source coverage, valid chunks, provenance, and deterministic entrance output.
- `scripts/chunk-content-transform.mjs`: resolves named task-unlock locations and emits `taskUnlocks` plus `entrances`.
- `scripts/chunk-content-transform.test.ts`: covers mapped, multi-entrance, excluded, duplicate, and unknown named locations.
- `scripts/chunk-source.mjs`: includes the reviewed registry in source preflight.
- `scripts/sync-chunk-content.mjs`: loads the reviewed registry for generation and check mode.
- `scripts/chunk-source.test.ts`: pins zero unresolved task unlocks and the reviewed generated totals.
- `public/chunk-content.json`: generated full content document with task requirements and entrance index.
- `data/sources/chunk-content-transform-audit.json`: generated audit with mapped and explained-exclusion outcomes.
- `data/chunkContentLite.ts`: generated lite output; expected to remain byte-equivalent unless generation proves otherwise.
- `data/contentBaseline.test.ts`: pins zero unresolved records, source metadata, and representative mapped/excluded outcomes.
- `services/ChunkContentService.ts`: defines `ChunkEntrance` and exposes `entrancesFor(cx, cy)`.
- `services/ChunkContentService.test.ts`: proves runtime decoding, lookup, sorting, and empty fallback.
- `components/ChunkEntranceNotices.tsx`: renders locked/available entrance rows and separate route requirements.
- `components/ChunkEntranceNotices.test.tsx`: verifies exact copy, Wiki links, styling semantics, and whole-area suppression.
- `components/ChunkActivityPanel.tsx`: requests entrances for the selected chunk and places the notice near entry requirements.
- `data/changelog.ts`: announces the player-visible accuracy and entrance-status fix.
- `data/changelog.test.ts`: pins the new player-facing claims.

### Task 1: Reviewed registry contract and pure validation

**Files:**
- Create: `data/sources/named-task-unlock-locations.json`
- Create: `scripts/named-task-unlock-locations.mjs`
- Create: `scripts/named-task-unlock-locations.test.ts`

**Interfaces:**
- Consumes: a registry JSON object, exact upstream named-location keys, and canonical numeric chunk IDs.
- Produces: `readNamedTaskUnlockRegistry()`, `collectNamedTaskUnlockSourceInventory(data)`, `validateNamedTaskUnlockRegistry(registry, context)`, `indexNamedTaskUnlockRegistry(registry)`, and `buildEntranceIndex(registry)`.

- [ ] **Step 1: Create a minimal versioned registry document**

Create the file with the stable top-level contract below. It is intentionally empty until Task 2 performs the source review.

```json
{
  "schemaVersion": 1,
  "policyVersion": 1,
  "sourceRepository": "source-chunk/chunk-picker-v2",
  "sourceCommit": "4eb75a8454eb41cfff71b70819326e0e67bcea7c",
  "reviewedAt": "2026-08-03",
  "locations": []
}
```

- [ ] **Step 2: Write failing pure-validator tests**

Add fixtures that exercise one mapped location, one two-entrance location, and one explicit exclusion:

```ts
const manifest = { commit: '4eb75a8454eb41cfff71b70819326e0e67bcea7c' };
const validRegistry = {
  schemaVersion: 1,
  policyVersion: 1,
  sourceRepository: 'source-chunk/chunk-picker-v2',
  sourceCommit: manifest.commit,
  reviewedAt: '2026-08-03',
  locations: [
    {
      name: 'Example Cave',
      sourceKeys: ['Example Cave', 'Example Cave#Lower level'],
      disposition: 'mapped',
      mappingKind: 'multiple-entrances',
      entrances: [
        { chunkId: '256', x: 64, y: 0, label: 'Entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] },
        { chunkId: '513', x: 128, y: 64, label: 'Eastern entrance to Example Cave', wikiPage: 'Example_Cave', requirements: ['Example Quest'] },
      ],
      sources: [
        { kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Cave', revision: '100' },
        { kind: 'coordinate', source: 'RuneLite cache', revision: 'cache-1' },
      ],
      note: 'Two independently reachable entrances.',
    },
    {
      name: 'Example Instance',
      sourceKeys: ['Example Instance'],
      disposition: 'instance-only',
      sources: [{ kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Instance', revision: '200' }],
      note: 'Created only inside the activity instance.',
    },
  ],
};

expect(() => validateNamedTaskUnlockRegistry(validRegistry, {
  sourceCommit: manifest.commit,
  sourceLocationKeys: ['Example Cave', 'Example Cave#Lower level', 'Example Instance'],
  validChunkIds: new Set(['256', '513']),
})).not.toThrow();

expect(indexNamedTaskUnlockRegistry(validRegistry).get('Example Cave#Lower level')?.name)
  .toBe('Example Cave');

expect(buildEntranceIndex(validRegistry)).toEqual({
  256: [{ location: 'Example Cave', label: 'Entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] }],
  513: [{ location: 'Example Cave', label: 'Eastern entrance to Example Cave', wikiPage: 'Example_Cave', requirements: ['Example Quest'] }],
});
```

Add rejection cases for duplicate source keys, missing source keys, stale source commit, unknown chunk IDs, mapped records without entrances, exclusions with entrances, empty evidence, duplicate entrance labels in one chunk, and a mismatch between `chunkId` and `Math.floor(x / 64) * 256 + Math.floor(y / 64)`.

- [ ] **Step 3: Run the validator test and verify it fails**

Run:

```powershell
npx vitest run scripts/named-task-unlock-locations.test.ts
```

Expected: FAIL because the registry module and exports do not exist.

- [ ] **Step 4: Implement the pure registry module**

Use `fileURLToPath` and `readFileSync` only in the reader; keep indexing and validation pure:

```js
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const NAMED_TASK_UNLOCK_REGISTRY_PATH = resolve(
  ROOT,
  'data',
  'sources',
  'named-task-unlock-locations.json',
);

export function readNamedTaskUnlockRegistry(path = NAMED_TASK_UNLOCK_REGISTRY_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function indexNamedTaskUnlockRegistry(registry) {
  const index = new Map();
  for (const record of registry.locations ?? []) {
    for (const sourceKey of record.sourceKeys ?? []) {
      if (index.has(sourceKey)) throw new Error(`Duplicate named task-unlock source key: ${sourceKey}`);
      index.set(sourceKey, record);
    }
  }
  return index;
}

export function entranceChunkId({ x, y }) {
  return String(Math.floor(x / 64) * 256 + Math.floor(y / 64));
}

export function collectNamedTaskUnlockSourceInventory(data) {
  const rows = [];
  const locations = new Set();
  for (const [category, entities] of Object.entries(data.taskUnlocks ?? {})) {
    for (const [name, value] of Object.entries(entities)) {
      if (Array.isArray(value)) continue;
      for (const location of Object.keys(value ?? {})) {
        if (/^\d+$/.test(String(location).split('-')[0])) continue;
        rows.push(`${category}/${name}/${location}`);
        locations.add(location);
      }
    }
  }
  return { rows: rows.sort(), locationKeys: [...locations].sort() };
}
```

Implement `validateNamedTaskUnlockRegistry` as an error-collecting validator that throws one deterministic `Invalid named task-unlock registry:\n...` message with sorted errors. Require exact coverage of `sourceLocationKeys`, exact source commit, mapped-only entrances, exclusion-only absence of entrances, nonempty sources and notes, coordinate/chunk agreement, valid chunks, unique labels per chunk, and allowed dispositions `mapped`, `instance-only`, and `non-purchasable`.

Implement `buildEntranceIndex` by flattening only mapped records, de-duplicating the tuple `(chunkId, location, label)`, and sorting chunk IDs numerically and rows by label.

- [ ] **Step 5: Run the pure-validator test**

Run:

```powershell
npx vitest run scripts/named-task-unlock-locations.test.ts
```

Expected: PASS for synthetic fixtures. Do not validate the still-empty production registry against the pinned source in this task.

- [ ] **Step 6: Commit the registry contract**

```powershell
git add data/sources/named-task-unlock-locations.json scripts/named-task-unlock-locations.mjs scripts/named-task-unlock-locations.test.ts
git commit -m "feat: define named task unlock registry"
```

### Task 2: Source-backed review of all 47 named locations

**Files:**
- Modify: `data/sources/named-task-unlock-locations.json`
- Modify: `scripts/named-task-unlock-locations.test.ts`

**Interfaces:**
- Consumes: the pinned Chunk Picker source, OSRS Wiki page revisions, RuneLite/cache coordinates, and canonical physical chunks.
- Produces: complete reviewed records covering the exact 47 upstream location keys and all 140 source rows.

- [ ] **Step 1: Add a failing production-coverage test**

Read the pinned source and calculate exact nonnumeric task-unlock locations without using the generated audit:

```ts
const { data, manifest } = await readPinnedChunkSource();
const { rows, locationKeys } = collectNamedTaskUnlockSourceInventory(data);
const registry = readNamedTaskUnlockRegistry();

expect(rows).toHaveLength(140);
expect(locationKeys).toHaveLength(47);
expect(() => validateNamedTaskUnlockRegistry(registry, {
  sourceCommit: manifest.commit,
  sourceLocationKeys: locationKeys,
  validChunkIds: new Set((data.walkableChunks ?? []).map(String)),
})).not.toThrow();
```

- [ ] **Step 2: Run the production-coverage test and verify it fails**

Run:

```powershell
npx vitest run scripts/named-task-unlock-locations.test.ts
```

Expected: FAIL with 47 missing source keys because the production registry is empty.

- [ ] **Step 3: Review the 47 locations in three evidence batches**

Use the exact inventory in the approved design specification. For each source key:

1. Open the pinned source record and retain its exact spelling and subarea suffix.
2. Open the relevant OSRS Wiki location page and record the permanent revision ID in the registry.
3. Identify every independent overworld entrance or prove that the location is instance-only/non-purchasable.
4. Verify each entrance tile with RuneLite world-map or cache evidence and record exact world `x` and `y` coordinates.
5. Calculate `chunkId` with `Math.floor(x / 64) * 256 + Math.floor(y / 64)` and compare it with FLIM's canonical chunk ownership and overlap policy.
6. Record route-specific requirements separately from the physical entrance.
7. Add a concise note explaining why the disposition and entrance set are complete.

Review high-volume locations first, then ordinary dungeons/mines/basements, then quest-specific, teleported, or instanced locations. Never use a nearby chunk merely because an entrance coordinate is unavailable.

- [ ] **Step 4: Populate the registry with reviewed values**

Use the exact mapped record contract exercised by `validRegistry` in Task 1. Each mapped production record must contain its real player-facing name, every exact upstream source key it owns, the reviewed mapping kind, all independent entrances, exact world coordinates, derived numeric chunk IDs, Wiki pages, route requirements, permanent evidence identifiers, and a conclusive note. Instance-only and non-purchasable records omit `mappingKind` and `entrances` and include source evidence proving the exclusion. Do not commit zero coordinates, invented revisions, generic evidence strings, or records that have not passed the validator.

- [ ] **Step 5: Run coverage and inspect the deterministic entrance index**

Run:

```powershell
npx vitest run scripts/named-task-unlock-locations.test.ts
```

Expected: PASS with 47 exact source keys, 140 covered source rows, no coordinate/chunk mismatches, and no duplicate physical entrance rows.

- [ ] **Step 6: Commit the reviewed evidence**

```powershell
git add data/sources/named-task-unlock-locations.json scripts/named-task-unlock-locations.test.ts
git commit -m "data: review named task unlock locations"
```

### Task 3: Named-location transformation and fail-closed audit

**Files:**
- Modify: `scripts/chunk-content-transform.mjs`
- Modify: `scripts/chunk-content-transform.test.ts`
- Modify: `scripts/chunk-source.mjs`
- Modify: `scripts/sync-chunk-content.mjs`

**Interfaces:**
- Consumes: `transformChunkContent(data, sourceManifest, namedLocationRegistry?)` and the registry helpers from Task 1.
- Produces: chunk-content schema version 9 with `entrances`, mapped/excluded terminal audit outcomes, and a zero-unresolved release assertion.

- [ ] **Step 1: Write failing transform tests for every disposition**

Add a synthetic registry fixture and assert one-to-many mapping, duplicate merging, entrance output, explicit exclusion, and unknown-name behavior:

```ts
const mappedRegistry = {
  schemaVersion: 1,
  policyVersion: 1,
  sourceRepository: 'source-chunk/chunk-picker-v2',
  sourceCommit: manifest.commit,
  reviewedAt: '2026-08-03',
  locations: [{
    name: 'Example Cave',
    sourceKeys: ['Example Cave'],
    disposition: 'mapped',
    mappingKind: 'multiple-entrances',
    entrances: [
      { chunkId: '256', x: 64, y: 0, label: 'Entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] },
      { chunkId: '513', x: 128, y: 64, label: 'Eastern entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] },
    ],
    sources: [
      { kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Cave', revision: '100' },
      { kind: 'coordinate', source: 'RuneLite cache', revision: 'cache-1' },
    ],
    note: 'Two independently reachable entrances.',
  }],
};

const result = transformChunkContent({
  walkableChunks: [256, 513],
  chunks: { 256: {}, 513: {} },
  slayerMonsters: {},
  taskUnlocks: {
    Monsters: {
      'Cave beast': {
        'Example Cave': [{ 'Quest One Complete the quest': true }],
      },
    },
  },
}, manifest, mappedRegistry);

expect(result.full.version).toBe(9);
expect(result.full.taskUnlocks).toEqual({
  Monsters: {
    'Cave beast': {
      256: ['Quest One'],
      513: ['Quest One'],
    },
  },
});
expect(result.full.entrances).toEqual(buildEntranceIndex(mappedRegistry));
expect(result.audit.events).toContainEqual(expect.objectContaining({
  category: 'taskUnlocks',
  sourceKey: 'Monsters/Cave beast/Example Cave',
  disposition: 'normalized',
  reason: 'named-location-mapped',
  targetKeys: ['Cave beast/256', 'Cave beast/513'],
}));
```

Add an instance fixture expecting `disposition: 'excluded'`, reason `named-location-instance-only`, and no target. Keep the existing no-registry test expecting `named-location-unmappable`; this proves unknown names remain visible and fail closed.

- [ ] **Step 2: Run transform tests and verify they fail**

Run:

```powershell
npx vitest run scripts/chunk-content-transform.test.ts
```

Expected: FAIL because the transformer ignores the third argument and emits schema version 8 without entrances.

- [ ] **Step 3: Implement registry-aware transformation**

Add these audit reasons:

```js
'named-location-mapped',
'named-location-instance-only',
'named-location-non-purchasable',
```

Change the public signature and pass the registry index into `buildTaskUnlocks`:

```js
export function transformChunkContent(data, sourceManifest, namedLocationRegistry = null) {
  const namedLocationIndex = namedLocationRegistry
    ? indexNamedTaskUnlockRegistry(namedLocationRegistry)
    : new Map();
```

For a nonnumeric location:

- No indexed record: retain `unresolved/named-location-unmappable`.
- `instance-only`: emit `excluded/named-location-instance-only`.
- `non-purchasable`: emit `excluded/named-location-non-purchasable`.
- `mapped`: merge cleaned requirements into every reviewed entrance chunk and emit one normalized terminal event whose targets contain every entity/chunk pair.

Emit nonterminal `duplicate-deduped` and `variant-name-cleaned` events when those existing normalization conditions occur; keep the named mapping reason on the terminal event.

Build `full.entrances` through `buildEntranceIndex(namedLocationRegistry)`, increment `full.version` from 8 to 9, and add `namedLocationPolicyVersion` plus `namedLocationReviewedAt` to `sourceMeta`.

- [ ] **Step 4: Make generation and source preflight load the registry**

In `scripts/sync-chunk-content.mjs`, read and validate the registry against the pinned source before transforming it:

```js
const namedLocationRegistry = readNamedTaskUnlockRegistry();
const inventory = collectNamedTaskUnlockSourceInventory(data);
validateNamedTaskUnlockRegistry(namedLocationRegistry, {
  sourceCommit: manifest.commit,
  sourceLocationKeys: inventory.locationKeys,
  validChunkIds: new Set((data.walkableChunks ?? []).map(String)),
});
const result = transformChunkContent(data, manifest, namedLocationRegistry);
```

In `scripts/chunk-source.mjs`, transform and run the existing count-floor assertion first, then validate the registry before replacing a source artifact. This preserves the current malformed-source failure while still rejecting added, removed, or renamed named locations:

```js
const namedLocationRegistry = readNamedTaskUnlockRegistry();
const result = transformChunkContent(data, manifest, namedLocationRegistry);
assertChunkTransform(result, manifest);
const inventory = collectNamedTaskUnlockSourceInventory(data);
validateNamedTaskUnlockRegistry(namedLocationRegistry, {
  sourceCommit: manifest.commit,
  sourceLocationKeys: inventory.locationKeys,
  validChunkIds: new Set((data.walkableChunks ?? []).map(String)),
});
```

After existing audit-balance checks, make `assertChunkTransform` reject any unresolved task-unlock event:

```js
const unresolved = result.audit.events.filter(
  event => event.category === 'taskUnlocks' && event.disposition === 'unresolved',
);
if (unresolved.length) {
  throw new Error(`Unresolved task-unlock records: ${unresolved.length}`);
}
```

- [ ] **Step 5: Run transformer and registry tests**

Run:

```powershell
npx vitest run scripts/named-task-unlock-locations.test.ts scripts/chunk-content-transform.test.ts scripts/chunk-content-collisions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the transformer**

```powershell
git add scripts/chunk-content-transform.mjs scripts/chunk-content-transform.test.ts scripts/chunk-source.mjs scripts/sync-chunk-content.mjs
git commit -m "fix: resolve named task unlock locations"
```

### Task 4: Regenerate content and pin the zero-unresolved baseline

**Files:**
- Modify generated: `public/chunk-content.json`
- Modify generated: `data/sources/chunk-content-transform-audit.json`
- Modify generated only if changed: `data/chunkContentLite.ts`
- Modify: `scripts/chunk-source.test.ts`
- Modify: `data/contentBaseline.test.ts`

**Interfaces:**
- Consumes: the reviewed registry and schema-9 transformer.
- Produces: deterministic generated files with all 140 records mapped or explicitly excluded and zero unresolved.

- [ ] **Step 1: Change baseline expectations before regeneration**

In both baseline suites, replace the old unresolved expectation with:

```ts
unresolvedTaskUnlocks: 0,
```

Pass `readNamedTaskUnlockRegistry()` as the third argument to the direct `transformChunkContent` call in `scripts/chunk-source.test.ts`. Then pin the source count and balanced terminal dispositions using that test's `audit` variable:

```ts
const taskUnlockTotals = audit.categoryTotals.taskUnlocks;
expect(taskUnlockTotals.source).toBe(1672);
expect(taskUnlockTotals.unresolved).toBe(0);
expect(taskUnlockTotals.imported + taskUnlockTotals.normalized + taskUnlockTotals.excluded)
  .toBe(1672);
```

In `data/contentBaseline.test.ts`, read the equivalent generated totals from `chunkAudit` and pin the new schema and registry provenance:

```ts
const taskUnlockTotals = (chunkAudit as {
  categoryTotals: {
    taskUnlocks: { source: number; imported: number; normalized: number; excluded: number; unresolved: number };
  };
}).categoryTotals.taskUnlocks;
expect(taskUnlockTotals.source).toBe(1672);
expect(taskUnlockTotals.unresolved).toBe(0);
expect(taskUnlockTotals.imported + taskUnlockTotals.normalized + taskUnlockTotals.excluded)
  .toBe(1672);
expect(fullChunkContent.version).toBe(9);
expect(fullChunkContent.sourceMeta).toMatchObject({
  namedLocationPolicyVersion: 1,
  namedLocationReviewedAt: '2026-08-03',
});
expect(Object.keys(fullChunkContent.entrances).length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run baselines and verify stale-output failure**

Run:

```powershell
npx vitest run scripts/chunk-source.test.ts data/contentBaseline.test.ts
```

Expected: FAIL because committed generated outputs still contain 140 unresolved records and no entrance index.

- [ ] **Step 3: Regenerate from the pinned source and reviewed registry**

Run:

```powershell
npm run chunks:sync
```

Then print the exact deterministic totals:

```powershell
node -e "const a=require('./data/sources/chunk-content-transform-audit.json'); console.log(JSON.stringify({events:a.events.length,taskUnlocks:a.categoryTotals.taskUnlocks},null,2))"
```

Copy the emitted `events` total into the existing exact `auditEvents` expectations in both baseline tests. Copy the full emitted `taskUnlocks` category total into a new exact equality assertion. Do not estimate either number.

- [ ] **Step 4: Add representative mapping and exclusion assertions**

Choose at least one reviewed record from each source category present in the original backlog: Monsters, Shops, Objects, Spawns, and NPCs. Assert its exact requirement is attached to every reviewed entrance chunk. For every explicit exclusion disposition present in the registry, assert an audit event carries its exact reason and an empty target list.

Also assert all generated entrance rows have unique `(location, label)` pairs per chunk and that the Otto's Grotto/Baxtorian Falls physical chunk remains a single canonical chunk identity.

- [ ] **Step 5: Verify deterministic outputs**

Run:

```powershell
npm run chunks:verify
npm run chunks:source-verify
npx vitest run data/contentBaseline.test.ts
```

Expected: all commands exit 0 and `chunks:verify` reports that outputs match reviewed source commit `4eb75a8454eb41cfff71b70819326e0e67bcea7c`.

- [ ] **Step 6: Commit generated data and baselines**

```powershell
git add public/chunk-content.json data/sources/chunk-content-transform-audit.json data/chunkContentLite.ts scripts/chunk-source.test.ts data/contentBaseline.test.ts
git commit -m "data: publish reviewed entrance mappings"
```

### Task 5: Runtime entrance service

**Files:**
- Modify: `services/ChunkContentService.ts`
- Modify: `services/ChunkContentService.test.ts`

**Interfaces:**
- Consumes: generated `RawDoc.entrances` keyed by numeric chunk ID.
- Produces: `ChunkEntrance` and `chunkContentService.entrancesFor(cx: number, cy: number): ChunkEntrance[]`.

- [ ] **Step 1: Write failing service tests**

After the existing service initialization, select a mapped chunk from the reviewed registry and assert the exact generated rows. Add a unit-level fallback assertion:

```ts
expect(chunkContentService.entrancesFor(-1, -1)).toEqual([]);
```

Assert the returned array is sorted by label and that calling the method twice does not expose a mutable internal array.

- [ ] **Step 2: Run the service test and verify it fails**

Run:

```powershell
npx vitest run services/ChunkContentService.test.ts
```

Expected: FAIL because `entrancesFor` is not defined.

- [ ] **Step 3: Add the runtime type and query**

Add the exact public shape:

```ts
export interface ChunkEntrance {
  location: string;
  label: string;
  wikiPage: string;
  requirements: string[];
}
```

Extend `RawDoc` with:

```ts
entrances?: Record<string, ChunkEntrance[]>;
```

Extend `RawDoc.sourceMeta` with the registry provenance emitted in Task 3:

```ts
namedLocationPolicyVersion?: number;
namedLocationReviewedAt?: string;
```

Add the service method:

```ts
entrancesFor(cx: number, cy: number): ChunkEntrance[] {
  return (this.doc?.entrances?.[String(cx * 256 + cy)] ?? [])
    .map(entrance => ({ ...entrance, requirements: [...entrance.requirements] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
```

- [ ] **Step 4: Run service and type tests**

Run:

```powershell
npx vitest run services/ChunkContentService.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the service API**

```powershell
git add services/ChunkContentService.ts services/ChunkContentService.test.ts
git commit -m "feat: expose reviewed chunk entrances"
```

### Task 6: Chunk Info entrance presentation

**Files:**
- Create: `components/ChunkEntranceNotices.tsx`
- Create: `components/ChunkEntranceNotices.test.tsx`
- Modify: `components/ChunkActivityPanel.tsx`

**Interfaces:**
- Consumes: `ChunkEntrance[]`, `mode: 'chunk' | 'region'`, and the selected physical chunk's existing `unlocked` boolean.
- Produces: locked/available entrance rows with separate route requirements and Wiki links.

- [ ] **Step 1: Write failing presentation tests**

Use Testing Library with this exact fixture:

```tsx
const entrance: ChunkEntrance = {
  location: 'Taverley Dungeon',
  label: 'Entrance to Taverley Dungeon',
  wikiPage: 'Taverley_Dungeon',
  requirements: ['Example Quest'],
};

render(<ChunkEntranceNotices mode="chunk" entrances={[entrance]} unlocked={false} />);
const link = screen.getByRole('link', { name: /Taverley Dungeon/ });
expect(link.parentElement?.textContent)
  .toContain('Entrance to Taverley Dungeon — locked with this chunk');
expect(screen.getByText('Also requires: Example Quest')).toBeTruthy();
expect(link.getAttribute('href'))
  .toBe('https://oldschool.runescape.wiki/w/Taverley_Dungeon');
```

Add cases for unlocked copy `Entrance to Taverley Dungeon — available`, multiple entrances inheriting the same chunk state, empty entrances returning no markup, and `mode="region"` returning no markup.

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```powershell
npx vitest run components/ChunkEntranceNotices.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the focused notice component**

Use the existing `Lock`, `Check`, and `WikiLink` components. The component returns `null` for region mode or an empty list. For chunk mode, render one row per entrance with these exact state strings:

```ts
const state = unlocked ? 'available' : 'locked with this chunk';
```

Use the existing green available treatment when `unlocked` is true and the existing red/amber locked treatment otherwise. Render route requirements on a second line as `Also requires: <requirements joined with comma and space>`. Do not strike through the requirement text and do not calculate quest completion in this component.

- [ ] **Step 4: Integrate the component into Chunk Info**

In `ChunkActivityPanel`, derive only the selected chunk's entrances:

```tsx
const entrances = mode === 'chunk' && chunkContentService.ready
  ? chunkContentService.entrancesFor(chunk.cx, chunk.cy)
  : [];
```

Render the notice after the existing `chunkEntryRequirements` notice and before bank state and the Can-do/Locked overview:

```tsx
<ChunkEntranceNotices mode={mode} entrances={entrances} unlocked={unlocked} />
```

Do not add entrances to the Can-do/Locked activity overview and do not show an aggregate state in Whole Area mode.

- [ ] **Step 5: Run component and panel tests**

Run:

```powershell
npx vitest run components/ChunkEntranceNotices.test.tsx components/ChunkActivityPanel.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the Chunk Info behavior**

```powershell
git add components/ChunkEntranceNotices.tsx components/ChunkEntranceNotices.test.tsx components/ChunkActivityPanel.tsx
git commit -m "feat: show physical entrance availability"
```

### Task 7: Player-facing release note and complete verification

**Files:**
- Modify: `data/changelog.ts`
- Modify: `data/changelog.test.ts`

**Interfaces:**
- Consumes: the completed registry, generated content, runtime service, and Chunk Info component.
- Produces: accurate release copy and full release evidence.

- [ ] **Step 1: Write the failing changelog assertion**

Extend the current 2026-08-02 chunk-accuracy release test with these exact claims:

```ts
expect(JSON.stringify(LATEST_CHANGELOG.sections)).toContain(
  'Named dungeon, cave, mine, and basement task unlocks now follow their reviewed physical entrances instead of being omitted.',
);
expect(JSON.stringify(LATEST_CHANGELOG.sections)).toContain(
  'Chunk Info now shows each reviewed entrance as locked with its chunk or available.',
);
```

- [ ] **Step 2: Run the changelog test and verify it fails**

Run:

```powershell
npx vitest run data/changelog.test.ts
```

Expected: FAIL because the release entry does not contain the two claims.

- [ ] **Step 3: Add only verified player-facing copy**

Add the two asserted sentences to the existing chunk-accuracy release in `data/changelog.ts`. Do not claim all 140 records were imported if the reviewed registry contains explicit exclusions; use `resolved` only when describing the audit total.

- [ ] **Step 4: Run focused source, transform, service, UI, and overlap gates**

Run:

```powershell
npx vitest run scripts/named-task-unlock-locations.test.ts scripts/chunk-content-transform.test.ts scripts/chunk-content-collisions.test.ts scripts/chunk-source.test.ts data/contentBaseline.test.ts services/ChunkContentService.test.ts components/ChunkEntranceNotices.test.tsx components/ChunkActivityPanel.test.tsx data/areaMapPolicy.test.ts utils/chunkLocations.test.ts utils/reachability.test.ts data/changelog.test.ts
```

Expected: all tests pass, the named-location source coverage is 47/47, the task-unlock source coverage is 1,672/1,672, and unresolved task unlocks equal zero.

- [ ] **Step 5: Run the complete release gate**

Run:

```powershell
npm run release:verify
```

Expected: changelog verification, the complete Vitest suite, TypeScript checking, content verification, deterministic chunk verification, and the production Vite build all exit 0.

- [ ] **Step 6: Inspect the final diff and generated scope**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Confirm that the unrelated `docs/superpowers/plans/2026-08-02-fate-locked-discord-server.md` file remains unmodified and uncommitted. Confirm no generated file changed outside the three chunk outputs expected by `scripts/sync-chunk-content.mjs`.

- [ ] **Step 7: Commit the release evidence**

```powershell
git add data/changelog.ts data/changelog.test.ts
git commit -m "docs: announce reviewed chunk entrances"
```

- [ ] **Step 8: Perform a fresh final review**

Review the complete branch diff against the approved specification. Reject completion if any named location lacks source provenance, any exclusion lacks a reason, any entrance creates a second physical unlock identity, or the full release gate has not passed in the final worktree state.
