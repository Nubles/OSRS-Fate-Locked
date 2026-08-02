# Chunk Source Refresh and Geography Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Fate Locked to the exact reviewed Chunk Picker revision, add its four newly named surface chunks, and correct the 24 confirmed parent-continent mismatches without changing unresolved content by guesswork.

**Architecture:** Keep the existing hash-pinned, offline generation pipeline. Update its immutable manifest and compressed source together, regenerate all derived content deterministically, then enforce exact source/map set equality and parent-continent compatibility with tests.

**Tech Stack:** Node.js ESM scripts, deterministic gzip, TypeScript geography data, Vitest, Chunk Picker JSON, OSRS Wiki evidence.

## Global Constraints

- Reviewed source commit: `4eb75a8454eb41cfff71b70819326e0e67bcea7c`.
- Reviewed export blob: `e6591f67609a37792361df25a10835d9e36ee45f`.
- Reviewed raw bytes: `7510818`.
- Reviewed SHA-256: `370F0F51BED8938988E368C41038A05197026CD8F524C0F87C2F3E773A32B4E4`.
- The refreshed numeric walkable universe contains 1,172 chunks: 548 `Ocean Chunk` entries and 624 named/non-ocean surface chunks.
- The refreshed transform contains exactly 937 content chunks and retains exactly 140 unresolved `taskUnlocks` mappings.
- The four newly named coordinates are `39,34`, `39,35`, `40,34`, and `40,35`; they belong to `The Open Seas` at continent level and do not create new paid subarea IDs.
- Review every semantic transform diff; do not infer coordinates for the 140 unresolved records.
- A network, schema, byte-length, hash, or transform failure must leave committed source artifacts unchanged.
- Do not modify the 109 previously reviewed continent-only connective chunks except for the four newly named source additions.
- Complete Task 1 of `2026-08-02-windows-chunk-verification-implementation.md` before running this plan's generation checks.
- Use tests before implementation and commit after each independently passing task.

---

## File Structure

- `data/sources/chunk-content-source.json`: exact reviewed source identity and count floors.
- `data/sources/chunkpicker-chunkinfo-export.json.gz`: deterministic compressed bytes of the reviewed export.
- `scripts/chunk-source.mjs`: immutable in-code pin and source verification.
- `scripts/chunk-source.test.ts`: exact commit/blob/hash/size and reviewed transform totals.
- `public/chunk-content.json`: regenerated full runtime content.
- `data/chunkContentLite.ts`: regenerated RuneLite subset.
- `data/sources/chunk-content-transform-audit.json`: regenerated accounting ledger.
- `data/regionChunks.ts`: unique continent ownership for all 624 named/non-ocean surface coordinates.
- `data/regionChunks.test.ts`: exact source/map set equality and new-coordinate regression coverage.
- `data/subAreaChunks.test.ts`: unique subarea ownership and parent-continent compatibility.
- `data/changelog.ts`: extends the approved release note with the reviewed map refresh.

### Task 1: Pin and regenerate the exact reviewed source

**Files:**
- Modify: `scripts/chunk-source.test.ts`
- Modify: `scripts/chunk-source.mjs`
- Modify: `data/sources/chunk-content-source.json`
- Replace: `data/sources/chunkpicker-chunkinfo-export.json.gz`
- Regenerate: `public/chunk-content.json`
- Regenerate: `data/chunkContentLite.ts`
- Regenerate: `data/sources/chunk-content-transform-audit.json`

**Interfaces:**
- Consumes: `verifyPinnedChunkSource()`, `readPinnedChunkSource()`, `transformChunkContent()`, and `assertChunkTransform()`.
- Produces: an offline-verifiable source pin whose manifest, gzip, generated snapshots, and ledger all identify commit `4eb75a8454eb41cfff71b70819326e0e67bcea7c`.

- [ ] **Step 1: Confirm upstream has not moved beyond the reviewed revision**

Run:

```powershell
npm run chunks:source-check
```

Expected before refresh:

```json
{"pinnedCommit":"ba2fcebf8b26c84c74f8d9ab328a0ede802be926","latestCommit":"4eb75a8454eb41cfff71b70819326e0e67bcea7c","moved":true}
```

If `latestCommit` differs from `4eb75a8454eb41cfff71b70819326e0e67bcea7c`, stop this task and review the additional upstream commits and transform diff before changing the pin.

- [ ] **Step 2: Write failing exact-source and transform-total tests**

Update the exact manifest object in `scripts/chunk-source.test.ts`:

```ts
expect(manifest).toMatchObject({
  schemaVersion: 1,
  repository: 'source-chunk/chunk-picker-v2',
  branch: 'gh-pages',
  commit: '4eb75a8454eb41cfff71b70819326e0e67bcea7c',
  blobSha: 'e6591f67609a37792361df25a10835d9e36ee45f',
  rawSha256: '370F0F51BED8938988E368C41038A05197026CD8F524C0F87C2F3E773A32B4E4',
  rawBytes: 7510818,
  policyVersion: 2,
  reviewedAt: '2026-08-02',
});
```

Change the raw length assertion to `7510818` and update the drift fixture's expected `pinnedCommit`. Import `transformChunkContent` and add:

```ts
it('pins reviewed transform totals and the unresolved named-location backlog', async () => {
  const { data, manifest } = await readPinnedChunkSource();
  const result = transformChunkContent(data, manifest);
  const { full, audit } = result;
  expect({
    contentChunks: Object.keys(full.chunks).length,
    connections: Object.keys(full.connect).length,
    slayerMasters: Object.keys(full.slayerMasters).length,
    shortcuts: full.shortcuts.length,
    shops: Object.keys(full.shopItems).length,
    dropTables: Object.keys(full.drops).length,
    questSections: Object.keys(full.questSections).length,
    banks: full.banks.length,
    tags: Object.keys(full.tags).length,
    auditEvents: audit.events.length,
    unresolvedTaskUnlocks: audit.events.filter(
      (event) => event.category === 'taskUnlocks'
        && event.disposition === 'unresolved',
    ).length,
  }).toEqual({
    contentChunks: 937,
    connections: 1110,
    slayerMasters: 10,
    shortcuts: 203,
    shops: 435,
    dropTables: 799,
    questSections: 134,
    banks: 101,
    tags: 27,
    auditEvents: 27035,
    unresolvedTaskUnlocks: 140,
  });
});
```

- [ ] **Step 3: Run the source test and verify it fails on the old pin**

Run:

```powershell
npx vitest run scripts/chunk-source.test.ts
```

Expected: FAIL because the committed pin still identifies `ba2fce…`, has 7,802,950 raw bytes, and transforms 936 content chunks.

- [ ] **Step 4: Update both immutable manifest copies**

Use this exact identity and floor object in both `pinnedManifest` inside `scripts/chunk-source.mjs` and `data/sources/chunk-content-source.json`:

```json
{
  "schemaVersion": 1,
  "repository": "source-chunk/chunk-picker-v2",
  "branch": "gh-pages",
  "exportPath": "chunkpicker-chunkinfo-export.json",
  "commit": "4eb75a8454eb41cfff71b70819326e0e67bcea7c",
  "blobSha": "e6591f67609a37792361df25a10835d9e36ee45f",
  "rawSha256": "370F0F51BED8938988E368C41038A05197026CD8F524C0F87C2F3E773A32B4E4",
  "rawBytes": 7510818,
  "policyVersion": 2,
  "reviewedAt": "2026-08-02",
  "sourceUrl": "https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/4eb75a8454eb41cfff71b70819326e0e67bcea7c/chunkpicker-chunkinfo-export.json",
  "countFloors": {
    "contentChunks": 937,
    "connections": 1110,
    "slayerMasters": 10,
    "shortcuts": 203,
    "shops": 435,
    "dropTables": 799,
    "questSections": 134,
    "banks": 101,
    "tags": 27
  }
}
```

In `scripts/chunk-source.mjs`, use JavaScript property syntax rather than quoted JSON keys but preserve the exact values.

- [ ] **Step 5: Fetch, byte-verify, and deterministically compress the approved source**

Run:

```powershell
node scripts/chunk-source.mjs --fetch-approved
node scripts/chunk-source.mjs
```

Expected: both commands exit 0. The first command must validate 7,510,818 bytes and SHA-256 `370F0F51BED8938988E368C41038A05197026CD8F524C0F87C2F3E773A32B4E4` before replacing the gzip.

- [ ] **Step 6: Regenerate all reviewed outputs**

Run:

```powershell
npm run chunks:sync
npm run chunks:verify
```

Expected: the generator reports 937 content chunks and verification exits 0. Review the diff and confirm the known changes: one added content chunk, six connections, one Slayer master, four shortcuts, two shops, one drop table, one bank, one tag, and changed Slayer task lists. No unresolved `taskUnlocks` entry may disappear unless the source itself supplied a numeric mapping.

- [ ] **Step 7: Run source, transform, and collision suites**

Run:

```powershell
npx vitest run scripts/chunk-source.test.ts scripts/chunk-content-transform.test.ts scripts/chunk-content-collisions.test.ts
```

Expected: PASS. If a collision count assertion changes, compare every affected raw and canonical contribution before updating the expected count; retain all source evidence.

- [ ] **Step 8: Commit the exact source refresh**

```powershell
git add scripts/chunk-source.mjs scripts/chunk-source.test.ts data/sources/chunk-content-source.json data/sources/chunkpicker-chunkinfo-export.json.gz public/chunk-content.json data/chunkContentLite.ts data/sources/chunk-content-transform-audit.json
git commit -m "data: refresh reviewed chunk source"
```

### Task 2: Enforce exact surface coverage and correct continent ownership

**Files:**
- Create: `data/regionChunks.test.ts`
- Modify: `data/regionChunks.ts`
- Modify: `data/subAreaChunks.test.ts`

**Interfaces:**
- Consumes: refreshed `readPinnedChunkSource()`, `REGION_CHUNKS`, `SUB_AREA_CHUNKS`, `REGION_GROUPS`, and `MISTHALIN_AREAS`.
- Produces: exact equality between the 624 reviewed non-ocean source coordinates and the authored map, plus zero subarea/parent continent mismatches.

- [ ] **Step 1: Write the failing exact-source coverage test**

Create `data/regionChunks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readPinnedChunkSource } from '../scripts/chunk-source.mjs';
import { REGION_CHUNKS } from './regionChunks';

const coord = ({ cx, cy }: { cx: number; cy: number }) => `${cx},${cy}`;

describe('reviewed continent chunk universe', () => {
  it('matches every named/non-ocean numeric walkable source chunk exactly once', async () => {
    const { data } = await readPinnedChunkSource();
    const source = (data.walkableChunks as Array<string | number>)
      .map(String)
      .filter((id) => /^\d+$/.test(id))
      .filter((id) => {
        const chunk = data.chunks[id];
        return (chunk?.Nickname ?? chunk?.Name) !== 'Ocean Chunk';
      })
      .map((id) => `${Number(id) >> 8},${Number(id) & 255}`)
      .sort();
    const authored = Object.values(REGION_CHUNKS).flat().map(coord).sort();

    expect(source).toHaveLength(624);
    expect(new Set(authored).size).toBe(authored.length);
    expect(authored).toEqual(source);
  });

  it('classifies the four newly named islands under The Open Seas', () => {
    const openSeas = new Set(REGION_CHUNKS['The Open Seas'].map(coord));
    expect([...openSeas].filter((key) => [
      '39,34', '39,35', '40,34', '40,35',
    ].includes(key)).sort()).toEqual(['39,34', '39,35', '40,34', '40,35']);
  });
});
```

- [ ] **Step 2: Write the failing parent-continent invariant**

Add this test to `data/subAreaChunks.test.ts`:

```ts
it('keeps every named sub-area in its canonical parent continent', () => {
  const parent = new Map<string, string>();
  for (const [continent, areas] of Object.entries(REGION_GROUPS)) {
    for (const area of areas) parent.set(area, continent);
  }
  for (const area of MISTHALIN_AREAS) parent.set(area, 'Misthalin');

  const actual = new Map<string, string>();
  for (const [continent, chunks] of Object.entries(REGION_CHUNKS)) {
    for (const chunk of chunks) actual.set(`${chunk.cx},${chunk.cy}`, continent);
  }

  const mismatches = Object.entries(SUB_AREA_CHUNKS).flatMap(([area, chunks]) =>
    chunks.flatMap(({ cx, cy }) => {
      const expected = parent.get(area);
      const found = actual.get(`${cx},${cy}`);
      return expected && found !== expected
        ? [`${area} ${cx},${cy}: ${found} -> ${expected}`]
        : [];
    }),
  );
  expect(mismatches).toEqual([]);
});
```

- [ ] **Step 3: Run geography tests and verify the exact failures**

Run:

```powershell
npx vitest run data/regionChunks.test.ts data/subAreaChunks.test.ts
```

Expected: FAIL with four missing source coordinates and exactly these 24 parent mismatches:

```text
Al Kharid 51,50: Misthalin -> Kharidian Desert
Al Kharid 51,51: Misthalin -> Kharidian Desert
Arandar 37,52: Kandarin -> Tirannwn
Burgh de Rott 54,49: Kharidian Desert -> Morytania
Camelot 43,54: Asgarnia -> Kandarin
Catherby 44,53: Asgarnia -> Kandarin
Falador 47,51: Misthalin -> Asgarnia
Falador 47,52: Misthalin -> Asgarnia
Falador 47,53: Misthalin -> Asgarnia
Haunted Mine 53,50: Kharidian Desert -> Morytania
Lighthouse 39,56: Kandarin -> Fremennik
Mort Myre Swamp 53,52: Misthalin -> Morytania
Mort Myre Swamp 53,53: Misthalin -> Morytania
Mort'ton 53,51: Kharidian Desert -> Morytania
Port Sarim 46,49: Karamja -> Asgarnia
Port Sarim 47,50: Misthalin -> Asgarnia
Seers' Village 43,55: Asgarnia -> Kandarin
The Stranglewood 17,51: Kourend & Kebos -> Varlamore
The Stranglewood 17,52: Kourend & Kebos -> Varlamore
The Stranglewood 17,53: Kourend & Kebos -> Varlamore
The Stranglewood 18,51: Kourend & Kebos -> Varlamore
The Stranglewood 18,52: Kourend & Kebos -> Varlamore
The Stranglewood 18,53: Kourend & Kebos -> Varlamore
Witchaven 43,51: Karamja -> Kandarin
```

- [ ] **Step 4: Apply the reviewed continent moves and four additions**

Edit `REGION_CHUNKS` by removing each coordinate from the left-hand continent and inserting it once into the right-hand continent:

```ts
const REVIEWED_MOVES = {
  'Kharidian Desert': ['51,50', '51,51'],
  Tirannwn: ['37,52'],
  Morytania: ['54,49', '53,50', '53,51', '53,52', '53,53'],
  Kandarin: ['43,51', '43,54', '43,55', '44,53'],
  Asgarnia: ['46,49', '47,50', '47,51', '47,52', '47,53'],
  Fremennik: ['39,56'],
  Varlamore: ['17,51', '17,52', '17,53', '18,51', '18,52', '18,53'],
  'The Open Seas': ['39,34', '39,35', '40,34', '40,35'],
} as const;
```

The literal above is an edit ledger, not a runtime constant: place the `{ cx, cy }` values into the existing sorted arrays and do not add `REVIEWED_MOVES` to production code. Remove from the old continents exactly as listed in Step 3. Preserve the existing total order by `cy`, then `cx`, used throughout `regionChunks.ts`.

- [ ] **Step 5: Run geography, map-location, and RuneLite parity tests**

Run:

```powershell
npx vitest run data/regionChunks.test.ts data/subAreaChunks.test.ts data/areaMapPolicy.test.ts utils/chunkLocations.test.ts utils/reachability.test.ts utils/runelitePluginParity.test.ts
```

Expected: PASS with 624 unique authored continent coordinates, zero orphaned subarea coordinates, and zero parent mismatches.

- [ ] **Step 6: Commit geography corrections**

```powershell
git add data/regionChunks.ts data/regionChunks.test.ts data/subAreaChunks.test.ts
git commit -m "fix: align chunk continent ownership"
```

### Task 3: Record the reviewed refresh and run the data gate

**Files:**
- Modify: `data/changelog.ts`

**Interfaces:**
- Consumes: the `2026-08-02-one-physical-chunk-one-unlock` changelog release created by the preceding overlap plan.
- Produces: player-facing notice of updated Wyrmscraig-area coverage and corrected map labels.

- [ ] **Step 1: Extend the existing release note**

Append these items to the existing release sections:

```ts
changed: [
  "Heroes' Guild, Ice Mountain, Ranging Guild, Otto's Grotto, and the Resource Area now share their physical chunk's single area unlock.",
  'Existing saves automatically keep the canonical area and receive one regular Key for each duplicate overlap they previously purchased.',
  'Chunk data is refreshed to the reviewed 2 August Chunk Picker revision, including newly named waters around Ardeaglais, Auchrie, and Wyrmscraig.',
],
fixed: [
  "Unlocking Otto's Grotto now visibly unlocks the Baxtorian Falls chunk containing it.",
  'Twenty-four boundary chunks now use the correct parent continent, fixing labels such as Falador · Misthalin and Port Sarim · Karamja.',
],
```

- [ ] **Step 2: Run deterministic content and data verification**

Run:

```powershell
npm run chunks:source-verify
npm run chunks:verify
npx vitest run scripts/chunk-content-transform.test.ts scripts/chunk-content-collisions.test.ts data/regionChunks.test.ts data/subAreaChunks.test.ts data/areaMapPolicy.test.ts utils/chunkLocations.test.ts utils/runelitePluginParity.test.ts
npm run typecheck
npm run changelog:verify
npm run build
```

Expected: all commands exit 0; `chunks:verify` performs no writes and reports commit `4eb75a8454eb41cfff71b70819326e0e67bcea7c`.

- [ ] **Step 3: Confirm the upstream drift check is clean after pinning**

Run:

```powershell
npm run chunks:source-check
```

Expected:

```json
{"pinnedCommit":"4eb75a8454eb41cfff71b70819326e0e67bcea7c","latestCommit":"4eb75a8454eb41cfff71b70819326e0e67bcea7c","moved":false}
```

- [ ] **Step 4: Commit the reviewed release note**

```powershell
git add data/changelog.ts
git commit -m "docs: record reviewed chunk refresh"
```
