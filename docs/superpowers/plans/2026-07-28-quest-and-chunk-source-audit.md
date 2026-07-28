# Quest, Miniquest, and Chunk Source Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin and account for the authoritative Chunk Picker export, then audit every official quest and miniquest and enforce their reviewed requirements consistently across Fate Locked.

**Architecture:** The chunk pipeline reads a committed, compressed export pinned to one upstream commit and emits both runtime snapshots and a deterministic transformation ledger. Quest records gain explicit `kind` and `accessPolicy` fields, while a reviewed source registry provides one-to-one provenance for every quest and miniquest; the existing canonical eligibility evaluator remains the only enforcement boundary.

**Tech Stack:** TypeScript 5, React 18, Vite 5, Vitest 4, Node.js ESM scripts, Node `zlib`/`crypto`, OSRS Wiki MediaWiki API snapshots, GitHub-hosted `source-chunk/chunk-picker-v2` data.

## Global Constraints

- Pin `source-chunk/chunk-picker-v2` commit `ba2fcebf8b26c84c74f8d9ab328a0ede802be926`, export blob `6674e5c62cd7a6ec90267def278aca5bc1f05a06`, and raw SHA-256 `95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167`.
- If upstream moves during execution, report the newer commit but do not silently change the approved pin.
- Normal tests and CI must not require live GitHub or OSRS Wiki access.
- Keep all quest and miniquest IDs and existing completed progress backward compatible.
- Do not add a completion override or let manual attestation bypass machine blockers.
- Do not add item-possession tracking; items and travel remain audit notes.
- Do not change key rates, Fate Points, pity behavior, seeded randomness, or other balance rules.
- Miniquests remain key-bearing completion entries at their existing difficulties, but never contribute Quest Points or Quest Point Cape membership.
- Recipe for Disaster subquests remain steps of the parent quest rather than separate completion/key entries.
- Every behavior change follows RED, GREEN, REFACTOR: write a failing test, observe the intended failure, implement only enough to pass, and rerun covering tests.
- Each task ends with its own focused commit.

---

## File Structure

### Create

- `data/sources/chunkpicker-chunkinfo-export.json.gz` — deterministic gzip of the exact pinned 7.8 MB upstream export.
- `data/sources/chunk-content-source.json` — pinned repository, commit, blob, raw hash, raw size, generator policy version, and reviewed count floors.
- `data/sources/chunk-content-transform-audit.json` — deterministic category accounting and all normalization/exclusion/unresolved records.
- `scripts/chunk-source.mjs` — source manifest validation, deterministic gzip/gunzip, and optional network drift check.
- `scripts/chunk-content-transform.mjs` — pure transformation from raw export to full snapshot, RuneLite-lite source, and audit ledger.
- `scripts/chunk-source.test.ts` — manifest, compressed artifact, hash, and offline source verification.
- `scripts/chunk-content-transform.test.ts` — transformation accounting and policy fixtures.
- `data/sources/quest-list.json` — reviewed official quest/miniquest coverage snapshot with stable Wiki revisions.
- `data/sources/quest-requirement-audit.json` — one reviewed provenance and requirement record per canonical journal ID.
- `data/questRequirementAudit.ts` — audit types, access-policy types, canonical requirement projection, and registry validation helpers.
- `data/questRequirementAudit.test.ts` — one-to-one official/runtime/audit coverage and batch review gates.
- `scripts/sync-quest-sources.mjs` — explicit network refresh for official list/page revision metadata; normal validation is offline.

### Modify

- `scripts/sync-chunk-content.mjs` — consume the pinned compressed source and pure transformer; support `--check`.
- `public/chunk-content.json` — refreshed full output with pinned source metadata and current upstream drops/yields.
- `data/chunkContentLite.ts` — deterministically regenerated RuneLite-lite output.
- `services/ChunkContentService.ts` — accept the new data revision and expose source metadata without changing consumer contracts.
- `package.json` — add offline chunk/quest verification commands to `content:verify`.
- `docs/CONTENT_SYNC.md` — document pinned update, audit review, and offline verification workflows.
- `data/questData.ts` — add `kind`, `accessPolicy`, audited locations, and corrected requirements.
- `data/questData.accuracy.test.ts` — exact Witch's Potion, Murder Mystery, miniquest, and audited-batch assertions.
- `data/contentBaseline.test.ts` — source pins, official counts, audit coverage, and cross-surface requirements.
- `utils/journalStatus.ts` and `utils/journalStatus.test.ts` — enforce access policy.
- `utils/journalCompletion.ts` and `utils/journalCompletion.test.ts` — preserve strict completion contract.
- `utils/questLocations.ts` and `utils/questLocations.test.ts` — keep chunk-derived locations as display/audit evidence only.
- `components/QuestLog.tsx` and relevant tests — use `kind` for counts and canonical eligibility for access.
- `components/QuestDoabilityPanel.tsx` and tests — show chunk evidence without replacing canonical blockers.
- `components/JournalNextBest.tsx` and tests — consume canonical blockers.
- `utils/questAdvisor.ts` and tests — consume canonical eligibility.
- `utils/goalPlanner.ts` and tests — consume canonical blockers and count Quest Points by `kind`.
- `utils/journalProgress.ts` and tests — render canonical blockers.
- `utils/chunkPermissionSnapshot.ts` and tests — consume canonical quest status.
- `utils/unlockImpact.ts` and `utils/advisor.test.ts` — preserve canonical simulated eligibility.
- `utils/runeliteBundle.ts` and tests — verify regenerated chunk content and unchanged bundle contract.
- `utils/saveSchema.test.ts` and `context/GameContext.test.tsx` — prove old-save compatibility.
- `data/changelog.ts` — truthful player-facing release entry.

---

### Task 1: Pin the Authoritative Chunk Picker Export Offline

**Files:**

- Create: `data/sources/chunkpicker-chunkinfo-export.json.gz`
- Create: `data/sources/chunk-content-source.json`
- Create: `scripts/chunk-source.mjs`
- Create: `scripts/chunk-source.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produces `readPinnedChunkSource(): Promise<{ manifest: ChunkSourceManifest; raw: Buffer; data: unknown }>`
- Produces `verifyPinnedChunkSource(): Promise<ChunkSourceManifest>`
- Produces `checkChunkSourceDrift(fetchImpl = fetch): Promise<{ pinnedCommit: string; latestCommit: string; moved: boolean }>`
- The manifest schema is:

```ts
interface ChunkSourceManifest {
  schemaVersion: 1;
  repository: 'source-chunk/chunk-picker-v2';
  branch: 'gh-pages';
  exportPath: 'chunkpicker-chunkinfo-export.json';
  commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926';
  blobSha: '6674e5c62cd7a6ec90267def278aca5bc1f05a06';
  rawSha256: '95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167';
  rawBytes: 7802950;
  policyVersion: 1;
  reviewedAt: '2026-07-28';
  sourceUrl: string;
  countFloors: Record<string, number>;
}
```

- [ ] **Step 1: Write failing pinned-source tests**

Create `scripts/chunk-source.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  checkChunkSourceDrift,
  readPinnedChunkSource,
  verifyPinnedChunkSource,
} from './chunk-source.mjs';

describe('pinned Chunk Picker source', () => {
  it('verifies the exact reviewed commit, blob, bytes, and raw hash offline', async () => {
    const manifest = await verifyPinnedChunkSource();
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      repository: 'source-chunk/chunk-picker-v2',
      branch: 'gh-pages',
      commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
      blobSha: '6674e5c62cd7a6ec90267def278aca5bc1f05a06',
      rawSha256: '95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167',
      rawBytes: 7802950,
      policyVersion: 1,
      reviewedAt: '2026-07-28',
    });
  });

  it('loads valid JSON from the committed gzip without network access', async () => {
    const { raw, data } = await readPinnedChunkSource();
    expect(raw).toHaveLength(7802950);
    expect(data).toMatchObject({
      chunks: expect.any(Object),
      walkableChunks: expect.any(Array),
      questSections: expect.any(Object),
      taskUnlocks: expect.any(Object),
    });
  });

  it('reports upstream movement without mutating the pin', async () => {
    const result = await checkChunkSourceDrift(async () => new Response(JSON.stringify({
      commit: { sha: 'new-upstream-sha' },
    }), { status: 200 }));
    expect(result).toEqual({
      pinnedCommit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
      latestCommit: 'new-upstream-sha',
      moved: true,
    });
  });
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run:

```powershell
npm test -- scripts/chunk-source.test.ts
```

Expected: FAIL because the manifest, compressed source, and module do not exist.

- [ ] **Step 3: Implement deterministic source pinning**

Create `scripts/chunk-source.mjs` using `readFile`, `gunzip`, `gzip`, and
`createHash('sha256')`. Reject the source before JSON parsing when byte length or
hash differs. The optional drift check calls:

```text
https://api.github.com/repos/source-chunk/chunk-picker-v2/branches/gh-pages
```

Fetch the exact approved file from the commit-addressed GitHub URL, verify the
known hash and byte length, and write a deterministic gzip with level 9 and
`mtime: 0` to `data/sources/chunkpicker-chunkinfo-export.json.gz`. Write the
manifest with the exact schema above and these reviewed floors:

```json
{
  "contentChunks": 936,
  "connections": 1104,
  "slayerMasters": 9,
  "shortcuts": 199,
  "shops": 433,
  "dropTables": 798,
  "questSections": 134,
  "banks": 100,
  "tags": 26
}
```

Add:

```json
{
  "chunks:source-check": "node scripts/chunk-source.mjs --check-upstream",
  "chunks:source-verify": "vitest run scripts/chunk-source.test.ts"
}
```

- [ ] **Step 4: Verify GREEN and deterministic compression**

Run:

```powershell
npm test -- scripts/chunk-source.test.ts
Copy-Item data\sources\chunkpicker-chunkinfo-export.json.gz C:\tmp\chunk-source-first.gz
node scripts\chunk-source.mjs --rewrite
Compare-Object (Get-FileHash C:\tmp\chunk-source-first.gz).Hash (Get-FileHash data\sources\chunkpicker-chunkinfo-export.json.gz).Hash
Remove-Item -LiteralPath C:\tmp\chunk-source-first.gz -Force
```

Expected: tests PASS and `Compare-Object` emits no difference.

- [ ] **Step 5: Commit**

```powershell
git add data/sources/chunkpicker-chunkinfo-export.json.gz data/sources/chunk-content-source.json scripts/chunk-source.mjs scripts/chunk-source.test.ts package.json
git commit -m "data: pin authoritative chunk picker export"
```

---

### Task 2: Make Chunk Transformation Accounting Complete

**Files:**

- Create: `scripts/chunk-content-transform.mjs`
- Create: `scripts/chunk-content-transform.test.ts`
- Create: `data/sources/chunk-content-transform-audit.json`
- Modify: `scripts/sync-chunk-content.mjs`

**Interfaces:**

- Produces:

```ts
type TransformDisposition = 'imported' | 'normalized' | 'excluded' | 'unresolved';

interface TransformAuditEvent {
  category: string;
  sourceKey: string;
  terminal: boolean;
  disposition: TransformDisposition;
  reason:
    | 'base-record'
    | 'section-merged'
    | 'variant-name-cleaned'
    | 'quest-subpath-collapsed'
    | 'subarea-suffix-collapsed'
    | 'named-location-unmappable'
    | 'non-walkable-content'
    | 'empty-walkable-chunk'
    | 'broad-quest-gate-suppressed'
    | 'lite-cap'
    | 'duplicate-deduped'
    | 'role-promoted-to-first';
  targetKeys: string[];
  detail?: string;
}

interface ChunkTransformResult {
  full: Record<string, unknown>;
  liteSource: string;
  audit: {
    schemaVersion: 1;
    policyVersion: 1;
    sourceCommit: string;
    categoryTotals: Record<string, {
      source: number;
      imported: number;
      normalized: number;
      excluded: number;
      unresolved: number;
    }>;
    events: TransformAuditEvent[];
  };
}

export function transformChunkContent(
  data: Record<string, unknown>,
  sourceManifest: ChunkSourceManifest,
): ChunkTransformResult;
```

- [ ] **Step 1: Write failing pure-transform tests**

Create fixtures directly in `scripts/chunk-content-transform.test.ts` covering:

```ts
import { describe, expect, it } from 'vitest';
import { transformChunkContent } from './chunk-content-transform.mjs';

const manifest = {
  schemaVersion: 1,
  repository: 'source-chunk/chunk-picker-v2',
  branch: 'gh-pages',
  exportPath: 'chunkpicker-chunkinfo-export.json',
  commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
  blobSha: '6674e5c62cd7a6ec90267def278aca5bc1f05a06',
  rawSha256: '95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167',
  rawBytes: 7802950,
  policyVersion: 1,
  reviewedAt: '2026-07-28',
  sourceUrl: 'https://github.com/source-chunk/chunk-picker-v2',
  countFloors: {},
};

it('accounts for merged sections and promotes quest starts', () => {
  const result = transformChunkContent({
    walkableChunks: [256],
    chunks: {
      256: {
        Quest: { 'Example Quest': 'step' },
        Sections: {
          basement: { Quest: { 'Example Quest': 'first' } },
        },
      },
    },
    slayerMonsters: {},
  }, manifest);
  expect(result.full.chunks['256'].q).toEqual({ 'Example Quest': 'first' });
  expect(result.audit.events).toEqual(expect.arrayContaining([
    expect.objectContaining({
      terminal: true, disposition: 'normalized', reason: 'section-merged',
    }),
    expect.objectContaining({
      terminal: false, disposition: 'normalized', reason: 'role-promoted-to-first',
    }),
  ]));
});

it('reports named locations and broad quest gates instead of silently dropping them', () => {
  const broad = Object.fromEntries(Array.from({ length: 151 }, (_, index) => [
    String(1000 + index),
    ['Pandemonium Complete the quest'],
  ]));
  const result = transformChunkContent({
    walkableChunks: [],
    chunks: {},
    slayerMonsters: {},
    questSections: broad,
    taskUnlocks: {
      NPCs: { Banker: { 'Stronghold Slayer Cave': [{ 'Quest X Complete the quest': true }] } },
    },
  }, manifest);
  expect(result.audit.events).toEqual(expect.arrayContaining([
    expect.objectContaining({ reason: 'named-location-unmappable', disposition: 'unresolved' }),
    expect.objectContaining({ reason: 'broad-quest-gate-suppressed', disposition: 'excluded' }),
  ]));
});
```

Add focused tests for non-walkable content, empty walkable chunks, `#` variants,
quest subpaths, sub-area suffixes, duplicate roles, and every RuneLite-lite cap.

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- scripts/chunk-content-transform.test.ts
```

Expected: FAIL because the pure transformer and audit ledger do not exist.

- [ ] **Step 3: Extract the current transform into a pure module**

Move factual transformations from `sync-chunk-content.mjs` into
`chunk-content-transform.mjs`. Preserve current output semantics while recording
an event at every normalization/exclusion boundary. Sort audit events by
`category`, `sourceKey`, `disposition`, and `reason`; sort object keys and arrays
where source order is not semantically meaningful.

The accounting assertion for each category is:

```ts
source === imported + normalized + excluded + unresolved
```

One source record receives exactly one event with `terminal: true`. Supporting
events such as `role-promoted-to-first` use `terminal: false`; category totals
count only terminal events, so explanatory notes cannot double-count the
terminal equation.

- [ ] **Step 4: Make sync offline and checkable**

Change `sync-chunk-content.mjs` to:

1. call `readPinnedChunkSource()`;
2. call `transformChunkContent(data, manifest)`;
3. serialize `public/chunk-content.json`, `data/chunkContentLite.ts`, and
   `data/sources/chunk-content-transform-audit.json`;
4. under `--check`, compare expected bytes with committed bytes and exit
   non-zero without writing;
5. under normal mode, write only after every accounting equation and floor
   passes.

- [ ] **Step 5: Verify GREEN**

```powershell
npm test -- scripts/chunk-content-transform.test.ts scripts/chunk-source.test.ts
node scripts\sync-chunk-content.mjs
node scripts\sync-chunk-content.mjs --check
git diff --check
```

Expected: tests PASS, `--check` exits 0, and the ledger contains no unclassified
event or unknown reason code.

- [ ] **Step 6: Commit**

```powershell
git add scripts/chunk-content-transform.mjs scripts/chunk-content-transform.test.ts scripts/sync-chunk-content.mjs data/sources/chunk-content-transform-audit.json
git commit -m "feat: account for every chunk source transform"
```

---

### Task 3: Refresh Full and RuneLite Chunk Snapshots

**Files:**

- Modify: `public/chunk-content.json`
- Modify: `data/chunkContentLite.ts`
- Modify: `services/ChunkContentService.ts`
- Modify: `utils/runeliteBundle.test.ts`
- Modify: `data/contentBaseline.test.ts`
- Modify: `package.json`

**Interfaces:**

- Full output embeds:

```ts
sourceMeta: {
  repository: 'source-chunk/chunk-picker-v2';
  commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926';
  blobSha: '6674e5c62cd7a6ec90267def278aca5bc1f05a06';
  rawSha256: '95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167';
  policyVersion: 1;
}
```

- `ChunkContentService.sourceMetadata()` returns that object or `null`.

- [ ] **Step 1: Write failing current-source baseline tests**

Add assertions to `data/contentBaseline.test.ts`:

```ts
import chunkSource from './sources/chunk-content-source.json';
import chunkAudit from './sources/chunk-content-transform-audit.json';
import fullChunkContent from '../public/chunk-content.json';

it('pins the reviewed Chunk Picker source and complete transform totals', () => {
  expect(chunkSource).toMatchObject({
    commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
    blobSha: '6674e5c62cd7a6ec90267def278aca5bc1f05a06',
    rawSha256: '95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167',
  });
  expect(Object.keys(fullChunkContent.chunks)).toHaveLength(936);
  expect(Object.keys(fullChunkContent.connect)).toHaveLength(1104);
  expect(Object.keys(fullChunkContent.questSections)).toHaveLength(134);
  expect(fullChunkContent.banks).toHaveLength(100);
  expect(Object.keys(fullChunkContent.tags)).toHaveLength(26);
  expect(chunkAudit.unclassified ?? []).toEqual([]);
});

it('contains the refreshed reviewed Sailing-era data', () => {
  expect(fullChunkContent.drops['Maggot King']).toContain('Adamantite ore');
  expect(fullChunkContent.drops['Maggot King']).toContain('Brimstone key');
  expect(fullChunkContent.skillItems.Crafting['Tarnished 2h sword loot'])
    .toEqual([
      ['Adamant 2h sword', '4/10'],
      ['Mithril 2h sword', '1/10'],
      ['Rune 2h sword', '5/10'],
    ]);
  expect(fullChunkContent.skillItems.Slayer['Shellbane gryphon']
    .some(([, rate]) => rate === '1/75')).toBe(true);
});
```

Add a RuneLite test proving every lite record is a capped subset of the full
record and that the bundle schema version remains 4.

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- data/contentBaseline.test.ts utils/runeliteBundle.test.ts
```

Expected: FAIL on missing source metadata and stale drops/yields.

- [ ] **Step 3: Regenerate and update runtime revision**

Run the offline generator. Bump `DATA_REV` from 8 to 9 in
`ChunkContentService.ts`. Extend `RawDoc` with optional typed `sourceMeta` and
add:

```ts
sourceMetadata(): RawDoc['sourceMeta'] | null {
  return this.doc?.sourceMeta ?? null;
}
```

Do not change existing entity, connection, or RuneLite bundle APIs.

- [ ] **Step 4: Add offline verification to release gates**

Set:

```json
{
  "chunks:verify": "node scripts/sync-chunk-content.mjs --check",
  "content:verify": "npm run diary:verify && npm run chunks:verify && vitest run data/contentBaseline.test.ts data/tasksConsistency.test.ts data/questRequirementAudit.test.ts utils/taskIdMigrations.test.ts utils/caProgress.test.ts"
}
```

The quest audit test is added in Task 5; until then, add it to the script in the
same commit that creates the file.

- [ ] **Step 5: Verify GREEN**

```powershell
npm test -- scripts/chunk-source.test.ts scripts/chunk-content-transform.test.ts data/contentBaseline.test.ts utils/runeliteBundle.test.ts
npm run chunks:verify
npm run typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add public/chunk-content.json data/chunkContentLite.ts services/ChunkContentService.ts utils/runeliteBundle.test.ts data/contentBaseline.test.ts package.json
git commit -m "data: refresh verified chunk content"
```

---

### Task 4: Add Explicit Quest Kind and Access Policy

**Files:**

- Modify: `data/questData.ts`
- Modify: `utils/journalStatus.ts`
- Modify: `utils/journalStatus.test.ts`
- Modify: `components/QuestLog.tsx`
- Modify: `utils/goalPlanner.ts`
- Modify: `data/tasksConsistency.test.ts`

**Interfaces:**

```ts
export type QuestKind = 'quest' | 'miniquest';
export type QuestAccessPolicy = 'regions' | 'locations' | 'regions-and-locations';

export interface QuestData {
  id: string;
  name: string;
  kind: QuestKind;
  accessPolicy: QuestAccessPolicy;
  regions: string[];
  locations?: QuestLocationRequirement[];
  skills: Record<string, number>;
  combatLevel?: number;
  manualRequirements?: string[];
  prereqs: string[];
  points: number;
  series?: string;
  difficulty: DropSource;
  oneOf?: QuestRequirementOption[];
}
```

- [ ] **Step 1: Write failing schema and evaluator tests**

Add to `utils/journalStatus.test.ts`:

```ts
it('uses exact locations instead of descriptive regions under locations policy', () => {
  const quest = {
    id: 'Exact quest',
    name: 'Exact quest',
    kind: 'quest',
    accessPolicy: 'locations',
    regions: ['Asgarnia'],
    locations: [{
      id: 'rimmington',
      label: 'Rimmington',
      standardAreas: ['Rimmington'],
      chunkOptions: [{ cx: 46, cy: 50 }],
    }],
    skills: {},
    prereqs: [],
    points: 1,
    difficulty: DropSource.QUEST_NOVICE,
  } satisfies QuestData;
  expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Asgarnia'] })))
    .toMatchObject({ status: 'LOCKED_REGION' });
  expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Rimmington'] })))
    .toMatchObject({ status: 'AVAILABLE' });
});

it('requires both sources under regions-and-locations policy', () => {
  const quest = {
    id: 'Combined quest',
    name: 'Combined quest',
    kind: 'quest',
    accessPolicy: 'regions-and-locations',
    regions: ['Asgarnia'],
    locations: [{
      id: 'rimmington',
      label: 'Rimmington',
      standardAreas: ['Rimmington'],
      chunkOptions: [{ cx: 46, cy: 50 }],
    }],
    skills: {},
    prereqs: [],
    points: 1,
    difficulty: DropSource.QUEST_NOVICE,
  } satisfies QuestData;
  expect(evaluateQuestEligibility(quest, unlocked({ regions: ['Rimmington'] })).status)
    .toBe('LOCKED_REGION');
  expect(evaluateQuestEligibility(
    quest,
    unlocked({ regions: ['Rimmington', 'Asgarnia'] }),
  ).status).toBe('AVAILABLE');
});
```

Add consistency tests requiring every record to have a valid `kind` and
`accessPolicy`, every miniquest to have zero points, and every Quest Point Cape
ID to reference `kind: 'quest'`.

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- utils/journalStatus.test.ts data/tasksConsistency.test.ts
```

Expected: FAIL because the fields and access semantics do not exist.

- [ ] **Step 3: Add explicit fields to all 207 records**

Set `kind: 'quest'` for the 188 main records and `kind: 'miniquest'` for the 19
records under the Miniquests section. Set `accessPolicy: 'regions'` everywhere
initially except the three existing exact-location records:

- `A Porcine of Interest`: `regions-and-locations` to preserve its already
  reviewed Draynor plus South Falador route.
- `Ethically Acquired Antiquities`: `regions-and-locations` to preserve its
  reviewed Varlamore plus Port Sarim and Varrock Museum route.
- `Pandemonium`: `locations`.

Do not change other requirements in this mechanical commit.

- [ ] **Step 4: Implement access policy in the canonical evaluator**

In `evaluateQuestEligibility`:

```ts
const enforceRegions =
  quest.accessPolicy === 'regions' ||
  quest.accessPolicy === 'regions-and-locations';
const enforceLocations =
  quest.accessPolicy === 'locations' ||
  quest.accessPolicy === 'regions-and-locations';
```

Only add blockers/evidence from fields enabled by the policy. Keep `oneOf`,
skills, combat, prerequisites, and manual checks unchanged.

Update Quest Log counts and Goal Planner Quest Point totals to use `kind`, not
`points === 0` inference.

- [ ] **Step 5: Verify GREEN**

```powershell
npm test -- utils/journalStatus.test.ts data/tasksConsistency.test.ts components/QuestLog.test.tsx utils/goalPlanner.test.ts
npm run typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add data/questData.ts utils/journalStatus.ts utils/journalStatus.test.ts components/QuestLog.tsx utils/goalPlanner.ts data/tasksConsistency.test.ts
git commit -m "refactor: make quest access policy explicit"
```

---

### Task 5: Establish Official Quest and Miniquest Audit Coverage

**Files:**

- Create: `data/sources/quest-list.json`
- Create: `data/sources/quest-requirement-audit.json`
- Create: `data/questRequirementAudit.ts`
- Create: `data/questRequirementAudit.test.ts`
- Create: `scripts/sync-quest-sources.mjs`
- Modify: `package.json`

**Interfaces:**

```ts
export type QuestAuditStatus =
  | 'verified'
  | 'verified-with-notes'
  | 'unresolved';

export interface QuestRequirementAuditEntry {
  id: string;
  kind: QuestKind;
  status: QuestAuditStatus;
  reviewedAt: string;
  source: {
    url: string;
    revision: number;
    revisionTimestamp: string;
  };
  chunkSourceCommit: string;
  accessPolicy: QuestAccessPolicy;
  requirementFingerprint: string;
  chunkEvidence: Array<{
    chunkId: string;
    role: 'first' | 'step';
    place: string;
  }>;
  notes: {
    items: string[];
    travel: string[];
    instances: string[];
    partialCompletion: string[];
  };
  discrepancy?: string;
  conservativeReason?: string;
}

export function questRequirementFingerprint(quest: QuestData): string;
export function validateQuestRequirementAudit(
  questData: Record<string, QuestData>,
  officialList: unknown,
  audit: unknown,
): { errors: string[] };
```

- [ ] **Step 1: Write failing one-to-one coverage tests**

Create `data/questRequirementAudit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import official from './sources/quest-list.json';
import audit from './sources/quest-requirement-audit.json';
import { QUEST_DATA } from './questData';
import {
  questRequirementFingerprint,
  validateQuestRequirementAudit,
} from './questRequirementAudit';

describe('official quest and miniquest audit coverage', () => {
  it('matches official, runtime, and audit IDs one-to-one', () => {
    expect(validateQuestRequirementAudit(QUEST_DATA, official, audit).errors)
      .toEqual([]);
  });

  it('pins the current reviewed baseline by explicit kind', () => {
    expect(official.entries.filter(entry => entry.kind === 'quest')).toHaveLength(188);
    expect(official.entries.filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
    expect(Object.values(QUEST_DATA).filter(entry => entry.kind === 'quest')).toHaveLength(188);
    expect(Object.values(QUEST_DATA).filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
  });

  it('matches every runtime requirement fingerprint', () => {
    const byId = new Map(audit.entries.map(entry => [entry.id, entry]));
    expect(Object.values(QUEST_DATA).flatMap(quest => {
      const entry = byId.get(quest.id);
      return entry?.requirementFingerprint === questRequirementFingerprint(quest)
        ? []
        : [quest.id];
    })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- data/questRequirementAudit.test.ts
```

Expected: FAIL because source snapshots and helpers do not exist.

- [ ] **Step 3: Implement the offline audit schema**

`questRequirementFingerprint` serializes these fields in fixed key order:

```ts
{
  kind,
  accessPolicy,
  regions,
  locations,
  skills,
  combatLevel,
  prereqs,
  oneOf,
  manualRequirements,
  points,
}
```

Store the fixed-key canonical JSON string directly as
`requirementFingerprint`. Do not use browser-only state, platform-specific
hashing, or live services.

Create official and audit snapshots for all current 207 IDs. Initial audit
entries may be `unresolved`, but must contain a real stable Wiki revision,
current chunk evidence, and a non-empty `conservativeReason`. No entry may use a
dummy revision, empty URL, or missing date.

- [ ] **Step 4: Implement explicit network refresh**

`sync-quest-sources.mjs --refresh` calls the OSRS Wiki MediaWiki API with a
descriptive User-Agent to retrieve:

- `Quests/List` current revision and parsed quest/miniquest rows;
- current revision metadata for each canonical page;
- redirects so canonical Fate Locked IDs are preserved.

Without `--refresh`, it validates committed snapshots offline and does not
write. Add:

```json
{
  "quests:source-refresh": "node scripts/sync-quest-sources.mjs --refresh",
  "quests:verify": "node scripts/sync-quest-sources.mjs --check && vitest run data/questRequirementAudit.test.ts"
}
```

- [ ] **Step 5: Verify GREEN**

```powershell
npm run quests:verify
npm test -- data/questRequirementAudit.test.ts data/tasksConsistency.test.ts
```

Expected: 188 quests, 19 miniquests, 207 unique IDs, 207 source revisions, and
207 matching fingerprints.

- [ ] **Step 6: Commit**

```powershell
git add data/sources/quest-list.json data/sources/quest-requirement-audit.json data/questRequirementAudit.ts data/questRequirementAudit.test.ts scripts/sync-quest-sources.mjs package.json
git commit -m "data: establish complete quest audit coverage"
```

---

### Task 6: Correct Witch's Potion and Murder Mystery First

**Files:**

- Modify: `data/questData.ts`
- Modify: `data/questData.accuracy.test.ts`
- Modify: `utils/journalStatus.test.ts`
- Modify: `utils/journalCompletion.test.ts`
- Modify: `data/sources/quest-requirement-audit.json`

**Interfaces:**

- Add canonical locations:

```ts
rimmington: {
  id: 'rimmington',
  label: 'Rimmington',
  standardAreas: ['Rimmington'],
  chunkOptions: [{ cx: 46, cy: 50 }],
},
sinclairMansion: {
  id: 'sinclair-mansion',
  label: 'Sinclair Mansion',
  standardAreas: ["Seers' Village"],
  chunkOptions: [{ cx: 42, cy: 55 }],
},
seersVillage: {
  id: 'seers-village',
  label: "Seers' Village",
  standardAreas: ["Seers' Village"],
  chunkOptions: [{ cx: 42, cy: 54 }],
},
```

The pinned export identifies Rimmington at `(46, 50)`, the Murder Mystery start
at Sinclair Mansion `(42, 55)`, and its Seers' Village step at `(42, 54)`.

- [ ] **Step 1: Write failing exact-record tests**

Add:

```ts
it("pins Witch's Potion to Rimmington without enforcing all Asgarnia", () => {
  expect(QUEST_DATA["Witch's Potion"]).toMatchObject({
    kind: 'quest',
    accessPolicy: 'locations',
    regions: ['Asgarnia'],
  });
  expect(QUEST_DATA["Witch's Potion"].locations?.map(location => location.id))
    .toEqual(['rimmington']);
});

it("pins Murder Mystery to Sinclair Mansion and Seers' Village", () => {
  expect(QUEST_DATA['Murder Mystery']).toMatchObject({
    kind: 'quest',
    accessPolicy: 'locations',
    regions: ['Kandarin'],
  });
  expect(QUEST_DATA['Murder Mystery'].locations?.map(location => location.id))
    .toEqual(['sinclair-mansion', 'seers-village']);
});
```

Add standard and Chunked eligibility cases showing:

- Asgarnia alone does not satisfy Witch's Potion;
- Rimmington satisfies it without all Asgarnia;
- Kandarin alone does not satisfy Murder Mystery;
- Sinclair Mansion/Seers' Village satisfies it without all Kandarin.

Add completion tests proving blocked states return `Requires:` and roll no key.

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- data/questData.accuracy.test.ts utils/journalStatus.test.ts utils/journalCompletion.test.ts
```

Expected: FAIL on missing exact locations and policy.

- [ ] **Step 3: Implement the two reviewed records**

Add the verified locations, set both policies to `locations`, retain coarse
regions for descriptive grouping, and refresh the two audit rows with permanent
Wiki revisions, chunk evidence, notes about optional item routes, and matching
fingerprints.

- [ ] **Step 4: Verify GREEN**

```powershell
npm test -- data/questData.accuracy.test.ts utils/journalStatus.test.ts utils/journalCompletion.test.ts data/questRequirementAudit.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add data/questData.ts data/questData.accuracy.test.ts utils/journalStatus.test.ts utils/journalCompletion.test.ts data/sources/quest-requirement-audit.json
git commit -m "fix: use exact Witch and Murder quest access"
```

---

### Task 7: Audit All 19 Miniquests

**Files:**

- Modify: `data/questData.ts`
- Modify: `data/sources/quest-requirement-audit.json`
- Modify: `data/questData.accuracy.test.ts`
- Modify: `data/questRequirementAudit.test.ts`

**Interfaces:**

- Reviews exactly these canonical IDs:

```text
Alfred Grimhand's Barcrawl
Barbarian Training
Bear Your Soul
Curse of the Empty Lord
Daddy's Home
The Enchanted Key
Enter the Abyss
Family Pest
The Frozen Door
The General's Shadow
His Faithful Servants
Hopespear's Will
In Search of Knowledge
Into the Tombs
Lair of Tarn Razorlor
Mage Arena I
Mage Arena II
Skippy and the Mogres
Vale Totems
```

- [ ] **Step 1: Write the failing miniquest review gate**

```ts
it('has reviewed evidence and matching requirements for all 19 miniquests', () => {
  const rows = audit.entries.filter(entry => entry.kind === 'miniquest');
  expect(rows).toHaveLength(19);
  expect(rows.flatMap(entry => {
    if (entry.status !== 'unresolved') return [];
    return entry.discrepancy && entry.conservativeReason ? [] : [entry.id];
  })).toEqual([]);
  expect(rows.flatMap(entry => {
    const quest = QUEST_DATA[entry.id];
    return entry.requirementFingerprint === questRequirementFingerprint(quest)
      ? []
      : [entry.id];
  })).toEqual([]);
});
```

Add exact assertions for every miniquest whose runtime requirement changes.

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- data/questRequirementAudit.test.ts data/questData.accuracy.test.ts
```

Expected: FAIL while miniquest entries remain initial unresolved baselines or
their runtime fingerprints differ from reviewed findings.

- [ ] **Step 3: Review and update every miniquest**

For each listed ID:

1. open the pinned Wiki revision and record unavoidable locations;
2. compare every pinned Chunk Picker `first`/`step` record;
3. verify skills, combat, prerequisites, guilds, and alternatives;
4. record items, travel, instances, and partial completion as notes;
5. choose the narrowest supported access policy;
6. update runtime requirements and the audit fingerprint together;
7. use `unresolved` only with a specific source discrepancy and conservative
   retained requirement.

Do not infer requirements from `points: 0`.

- [ ] **Step 4: Verify GREEN**

```powershell
npm test -- data/questRequirementAudit.test.ts data/questData.accuracy.test.ts utils/journalStatus.test.ts
npm run typecheck
```

Expected: all 19 rows are reviewed and tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add data/questData.ts data/sources/quest-requirement-audit.json data/questData.accuracy.test.ts data/questRequirementAudit.test.ts
git commit -m "data: audit all Fate Locked miniquests"
```

---

### Task 8: Audit Quests A-F

**Files:**

- Modify: `data/questData.ts`
- Modify: `data/sources/quest-requirement-audit.json`
- Modify: `data/questData.accuracy.test.ts`
- Modify: `data/questRequirementAudit.test.ts`

**Interfaces:**

- Batch predicate:

```ts
entry.kind === 'quest' &&
entry.id.localeCompare('A') >= 0 &&
entry.id.localeCompare('G') < 0
```

- [ ] **Step 1: Add the failing batch gate**

Add this shared helper and its A-F invocation:

```ts
const expectReviewedBatch = (start: string, end?: string) => {
  const rows = audit.entries.filter(entry =>
    entry.kind === 'quest' &&
    entry.id.localeCompare(start) >= 0 &&
    (end === undefined || entry.id.localeCompare(end) < 0));

  expect(rows.length).toBeGreaterThan(0);
  expect(rows.flatMap(entry => {
    const quest = QUEST_DATA[entry.id];
    if (!quest) return [`${entry.id}:missing-runtime`];
    if (!entry.source.url.startsWith('https://oldschool.runescape.wiki/w/')) {
      return [`${entry.id}:unstable-source-url`];
    }
    if (!Number.isInteger(entry.source.revision) || entry.source.revision <= 0) {
      return [`${entry.id}:missing-source-revision`];
    }
    if (entry.chunkSourceCommit !== 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926') {
      return [`${entry.id}:wrong-chunk-source`];
    }
    if (entry.requirementFingerprint !== questRequirementFingerprint(quest)) {
      return [`${entry.id}:stale-fingerprint`];
    }
    if (entry.status === 'unresolved' &&
        (!entry.discrepancy || !entry.conservativeReason)) {
      return [`${entry.id}:unexplained-unresolved`];
    }
    return [];
  })).toEqual([]);
};

it('reviews every A-F quest', () => expectReviewedBatch('A', 'G'));
```

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- data/questRequirementAudit.test.ts
```

Expected: FAIL listing every A-F quest that is not yet reviewed.

- [ ] **Step 3: Audit each listed A-F quest**

For every listed quest:

1. open the pinned Wiki revision and record unavoidable locations;
2. compare every pinned Chunk Picker `first`/`step` record;
3. verify skills, combat, quest points, prerequisites, guilds, and alternatives;
4. record items, travel, instances, and partial completion as notes;
5. choose the narrowest supported access policy;
6. update runtime requirements, audit fingerprint, and exact regression tests
   together;
7. use `unresolved` only with a specific source discrepancy and conservative
   retained requirement.

Verify all location IDs against `areaMapPolicy`, standard areas, and the pinned
chunk universe.

- [ ] **Step 4: Verify GREEN**

```powershell
npm test -- data/questRequirementAudit.test.ts data/questData.accuracy.test.ts utils/journalStatus.test.ts
```

Expected: the A-F gate and focused tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add data/questData.ts data/sources/quest-requirement-audit.json data/questData.accuracy.test.ts data/questRequirementAudit.test.ts
git commit -m "data: audit quest requirements A through F"
```

---

### Task 9: Audit Quests G-M

**Files:**

- Modify: `data/questData.ts`
- Modify: `data/sources/quest-requirement-audit.json`
- Modify: `data/questData.accuracy.test.ts`
- Modify: `data/questRequirementAudit.test.ts`

**Interfaces:**

```ts
entry.kind === 'quest' &&
entry.id.localeCompare('G') >= 0 &&
entry.id.localeCompare('N') < 0
```

- [ ] **Step 1: Add and run the failing G-M batch gate**

Add:

```ts
it('reviews every G-M quest', () => expectReviewedBatch('G', 'N'));
```

Then run:

```powershell
npm test -- data/questRequirementAudit.test.ts
```

Expected: FAIL listing unreviewed G-M quests.

- [ ] **Step 2: Audit every G-M quest**

For every listed quest:

1. open the pinned Wiki revision and record unavoidable locations;
2. compare every pinned Chunk Picker `first`/`step` record;
3. verify skills, combat, quest points, prerequisites, guilds, and alternatives;
4. record items, travel, instances, and partial completion as notes;
5. choose the narrowest supported access policy;
6. update runtime requirements, audit fingerprint, and exact regression tests
   together;
7. use `unresolved` only with a specific source discrepancy and conservative
   retained requirement.

Pay particular attention to multi-region routes, underground content,
instances, and prerequisite miniquests.

- [ ] **Step 3: Verify and commit**

```powershell
npm test -- data/questRequirementAudit.test.ts data/questData.accuracy.test.ts utils/journalStatus.test.ts
git add data/questData.ts data/sources/quest-requirement-audit.json data/questData.accuracy.test.ts data/questRequirementAudit.test.ts
git commit -m "data: audit quest requirements G through M"
```

---

### Task 10: Audit Quests N-S

**Files:**

- Modify: `data/questData.ts`
- Modify: `data/sources/quest-requirement-audit.json`
- Modify: `data/questData.accuracy.test.ts`
- Modify: `data/questRequirementAudit.test.ts`

**Interfaces:**

```ts
entry.kind === 'quest' &&
entry.id.localeCompare('N') >= 0 &&
entry.id.localeCompare('T') < 0
```

- [ ] **Step 1: Add and run the failing N-S batch gate**

Add:

```ts
it('reviews every N-S quest', () => expectReviewedBatch('N', 'T'));
```

Then run:

```powershell
npm test -- data/questRequirementAudit.test.ts
```

Expected: FAIL listing unreviewed N-S quests.

- [ ] **Step 2: Audit every N-S quest**

For every listed quest:

1. open the pinned Wiki revision and record unavoidable locations;
2. compare every pinned Chunk Picker `first`/`step` record;
3. verify skills, combat, quest points, prerequisites, guilds, and alternatives;
4. record items, travel, instances, and partial completion as notes;
5. choose the narrowest supported access policy;
6. update runtime requirements, audit fingerprint, and exact regression tests
   together;
7. use `unresolved` only with a specific source discrepancy and conservative
   retained requirement.

Treat Recipe for Disaster subquests as parent-route evidence, not separate
completion records.

- [ ] **Step 3: Verify and commit**

```powershell
npm test -- data/questRequirementAudit.test.ts data/questData.accuracy.test.ts utils/journalStatus.test.ts
git add data/questData.ts data/sources/quest-requirement-audit.json data/questData.accuracy.test.ts data/questRequirementAudit.test.ts
git commit -m "data: audit quest requirements N through S"
```

---

### Task 11: Audit Quests T-Z and Reconcile Official Coverage

**Files:**

- Modify: `data/questData.ts`
- Modify: `data/sources/quest-list.json`
- Modify: `data/sources/quest-requirement-audit.json`
- Modify: `data/questData.accuracy.test.ts`
- Modify: `data/questRequirementAudit.test.ts`

**Interfaces:**

```ts
entry.kind === 'quest' && entry.id.localeCompare('T') >= 0
```

- [ ] **Step 1: Add and run the failing T-Z batch gate**

Add:

```ts
it('reviews every T-Z quest', () => expectReviewedBatch('T'));
```

Then run:

```powershell
npm test -- data/questRequirementAudit.test.ts
```

Expected: FAIL listing unreviewed T-Z quests.

- [ ] **Step 2: Audit every T-Z quest**

For every listed quest, including current Sailing-era entries:

1. open the pinned Wiki revision and record unavoidable locations;
2. compare every pinned Chunk Picker `first`/`step` record;
3. verify skills, combat, quest points, prerequisites, guilds, and alternatives;
4. record items, travel, instances, and partial completion as notes;
5. choose the narrowest supported access policy;
6. update runtime requirements, audit fingerprint, and exact regression tests
   together;
7. use `unresolved` only with a specific source discrepancy and conservative
   retained requirement.

- [ ] **Step 3: Reconcile the official list**

Run the explicit source refresh in a temporary worktree state and compare IDs.
For any official entry absent locally:

- add the canonical runtime record with its official ID and kind;
- add complete source/audit evidence;
- update baseline counts intentionally.

For any local entry absent officially:

- verify redirects, renames, and miniquest classification;
- preserve old completed IDs through an explicit alias/migration when a rename
  is confirmed;
- otherwise retain it as unresolved with a precise discrepancy.

Do not change the 188/19 baseline merely because a live request returned fewer
rows; require stable revision metadata and manual review.

- [ ] **Step 4: Require complete reviewed coverage**

Add:

```ts
it('has no unaudited official or runtime entry', () => {
  expect(validateQuestRequirementAudit(QUEST_DATA, official, audit).errors)
    .toEqual([]);
  expect(audit.entries.filter(entry =>
    entry.status === 'unresolved' &&
    (!entry.discrepancy || !entry.conservativeReason),
  )).toEqual([]);
});
```

- [ ] **Step 5: Verify and commit**

```powershell
npm run quests:verify
npm test -- data/questRequirementAudit.test.ts data/questData.accuracy.test.ts utils/journalStatus.test.ts data/tasksConsistency.test.ts
npm run typecheck
git add data/questData.ts data/sources/quest-list.json data/sources/quest-requirement-audit.json data/questData.accuracy.test.ts data/questRequirementAudit.test.ts
git commit -m "data: complete quest and miniquest requirement audit"
```

---

### Task 12: Enforce Cross-Surface Canonical Eligibility

**Files:**

- Modify: `data/contentBaseline.test.ts`
- Modify: `components/QuestLog.tsx`
- Modify: `components/QuestDoabilityPanel.tsx`
- Modify: `components/JournalNextBest.tsx`
- Modify: `utils/questLocations.ts`
- Modify: `utils/questLocations.test.ts`
- Modify: `utils/questAdvisor.ts`
- Modify: `utils/questAdvisor.test.ts`
- Modify: `utils/goalPlanner.ts`
- Modify: `utils/goalPlanner.test.ts`
- Modify: `utils/journalProgress.ts`
- Modify: `utils/journalProgress.test.ts`
- Modify: `utils/chunkPermissionSnapshot.ts`
- Modify: `utils/chunkPermissionSnapshot.test.ts`
- Modify: `utils/unlockImpact.ts`
- Modify: `utils/advisor.test.ts`

**Interfaces:**

- `evaluateQuestEligibility` remains the only quest requirement evaluator.
- `questLocations` is evidence/display only and may not promote a blocked
  canonical requirement to available.

- [ ] **Step 1: Write failing cross-surface cases**

Extend the existing cross-surface contract in `data/contentBaseline.test.ts`
for:

- Witch's Potion before/after Rimmington;
- Murder Mystery before/after Sinclair Mansion/Seers' Village;
- one audited `regions-and-locations` quest;
- one audited alternative-route quest;
- one audited miniquest with prerequisites.

For each snapshot, compare:

```ts
[
  questLogEligibility(quest, unlocks, gameModeId).status,
  rankAvailableQuests(unlocks, gameModeId).some(candidate => candidate.id === quest.id),
  planForTarget('quest', quest.id, unlocks, gameModeId)?.alreadyReachable,
  journalNextBestQuestAction(quest, unlocks, gameModeId)?.unmet === 0,
  questCompletionDecision(quest, unlocks, gameModeId).ok,
  prepareUnlockImpactContext(unlocks, gameModeId).questStatusById.get(quest.id),
]
```

Normalize booleans to status labels and require exact equality.

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- data/contentBaseline.test.ts utils/questAdvisor.test.ts utils/goalPlanner.test.ts utils/journalProgress.test.ts utils/chunkPermissionSnapshot.test.ts utils/advisor.test.ts
```

Expected: at least one direct field consumer or chunk-evidence fallback differs
from canonical access policy.

- [ ] **Step 3: Delegate all enforcement to canonical helpers**

Remove direct requirement reconstruction. Keep direct `QUEST_DATA` reads only
for display metadata, dependency traversal, and IDs. Replace
`refineQuestRegion` with a display-only helper or delete it if no production
caller remains; its tests must state that chunk evidence cannot change machine
eligibility.

- [ ] **Step 4: Verify GREEN**

```powershell
npm test -- data/contentBaseline.test.ts components/QuestDoabilityPanel.test.tsx utils/questLocations.test.ts utils/questAdvisor.test.ts utils/goalPlanner.test.ts utils/journalProgress.test.ts utils/chunkPermissionSnapshot.test.ts utils/advisor.test.ts
npm run typecheck
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add data/contentBaseline.test.ts components/QuestLog.tsx components/QuestDoabilityPanel.tsx components/JournalNextBest.tsx utils/questLocations.ts utils/questLocations.test.ts utils/questAdvisor.ts utils/questAdvisor.test.ts utils/goalPlanner.ts utils/goalPlanner.test.ts utils/journalProgress.ts utils/journalProgress.test.ts utils/chunkPermissionSnapshot.ts utils/chunkPermissionSnapshot.test.ts utils/unlockImpact.ts utils/advisor.test.ts
git commit -m "refactor: unify quest eligibility consumers"
```

---

### Task 13: Prove Strict Completion, Key Safety, and Old-Save Compatibility

**Files:**

- Modify: `utils/journalCompletion.test.ts`
- Modify: `context/GameContext.test.tsx`
- Modify: `utils/saveSchema.test.ts`
- Modify: `utils/runeliteBundle.test.ts`

**Interfaces:**

- No new completion attestation fields.
- No new history event types.
- Existing `completeQuest(id, x, y, attestation)` signature remains.

- [ ] **Step 1: Write failing integration regressions**

Add tests proving:

1. Witch's Potion cannot complete with Asgarnia but without Rimmington.
2. Murder Mystery cannot complete with Kandarin but without Sinclair Mansion.
3. A rejected completion does not add the ID and does not append a roll.
4. A valid quest completion adds the ID and appends exactly one roll.
5. A valid miniquest completion adds the ID and appends exactly one roll.
6. Repeating either completion adds no roll.
7. `manualConfirmed: true` does not bypass a machine blocker.
8. A version-3 save containing completed quest and miniquest IDs loads with
   those IDs unchanged.

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- utils/journalCompletion.test.ts context/GameContext.test.tsx utils/saveSchema.test.ts utils/runeliteBundle.test.ts
```

Expected: any hidden direct requirement path or kind inference fails.

- [ ] **Step 3: Apply minimal fixes**

Keep `questCompletionDecision` machine-first. Update only tests/consumers exposed
by new `kind` and policy fields. Do not add override metadata, history types, or
save migration fields.

- [ ] **Step 4: Verify GREEN**

```powershell
npm test -- utils/journalCompletion.test.ts context/GameContext.test.tsx utils/saveSchema.test.ts utils/runeliteBundle.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add utils/journalCompletion.test.ts context/GameContext.test.tsx utils/saveSchema.test.ts utils/runeliteBundle.test.ts
git commit -m "test: protect audited quest completion integrity"
```

---

### Task 14: Documentation, Player-Facing Notes, and Final Verification

**Files:**

- Modify: `docs/CONTENT_SYNC.md`
- Modify: `data/changelog.ts`
- Modify: `data/contentBaseline.test.ts`
- Modify: `package.json`

**Interfaces:**

- `npm run chunks:source-check` is networked and informational.
- `npm run chunks:verify`, `npm run quests:verify`, and
  `npm run content:verify` are offline and deterministic.

- [ ] **Step 1: Write failing documentation and changelog baseline tests**

Require the latest player-facing release to mention:

- Witch's Potion now checks Rimmington;
- Murder Mystery now checks Sinclair Mansion/Seers' Village;
- all quests and miniquests have reviewed requirement evidence;
- chunk data is pinned and refreshed;
- completion remains strict.

Do not claim inventory tracking, completion overrides, or balance changes.

- [ ] **Step 2: Run and confirm RED**

```powershell
npm test -- data/contentBaseline.test.ts scripts/player-facing-changelog.test.ts
```

Expected: FAIL until truthful release notes and sync documentation exist.

- [ ] **Step 3: Document the operational workflow**

In `docs/CONTENT_SYNC.md`, document:

```text
npm run chunks:source-check
npm run chunks:verify
npm run quests:source-refresh
npm run quests:verify
npm run content:verify
```

State which commands use network access, where source pins live, how to review
ledger exclusions, how to update Wiki revisions, and why normal CI is offline.

- [ ] **Step 4: Update release notes and release verification**

Add `npm run quests:verify` to `content:verify` without duplicating its Vitest
file. Keep `release:verify` ordering:

```text
changelog -> tests -> typecheck -> content -> build
```

- [ ] **Step 5: Run the focused gate**

```powershell
npm run chunks:verify
npm run quests:verify
npm run content:verify
npm test -- data/contentBaseline.test.ts scripts/player-facing-changelog.test.ts
npm run typecheck
git diff --check
```

Expected: all PASS.

- [ ] **Step 6: Run the full release gate**

```powershell
npm run release:verify
git status -sb
git diff --check main...HEAD
```

Expected:

- every Vitest file passes;
- type-check passes;
- diary, chunk, quest, and generated-content verification passes offline;
- production build succeeds;
- only intentional feature files differ from `main`;
- no generated manifest or line-ending noise remains.

- [ ] **Step 7: Commit**

```powershell
git add docs/CONTENT_SYNC.md data/changelog.ts data/contentBaseline.test.ts package.json
git commit -m "docs: publish verified quest and chunk audit"
```

---

## Plan Self-Review Checklist

- Every approved design requirement maps to a task:
  - pinned chunk source: Tasks 1-3;
  - complete transformation accounting: Task 2;
  - refreshed stale source facts: Task 3;
  - explicit quest/miniquest kind and access policy: Task 4;
  - official one-to-one coverage: Task 5;
  - Witch's Potion and Murder Mystery: Task 6;
  - all 19 miniquests: Task 7;
  - all quests: Tasks 8-11;
  - downstream consistency: Task 12;
  - strict completion and old saves: Task 13;
  - offline recurrence protection and release notes: Task 14.
- No task introduces item possession, requirement overrides, new history event
  types, or balance changes.
- Every production behavior change has a preceding failing test.
- Every generated artifact has an offline deterministic check.
- Every audit batch ends with a separately reviewable commit.
