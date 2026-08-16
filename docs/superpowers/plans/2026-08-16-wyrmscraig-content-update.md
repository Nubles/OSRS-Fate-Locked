# Wyrmscraig Content Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the released Wyrmscraig content as one coherent Fate Locked update: canonical Wyrmscraig access, Fallen From Grace, the three Tier 6 skilling methods, The Mad Angel, Collection Log additions, and the reviewed August source corrections.

**Architecture:** Keep the existing curated-registry and pinned-source architecture. Add Wyrmscraig as one canonical Open Seas area, extend the existing quest/skill/boss/log registries, refresh generated Chunk Picker and Combat Achievement artifacts from reviewed immutable revisions, and expose everything through the current UI without adding a new roll table or route.

**Tech Stack:** React 18, TypeScript, Vitest, Node.js ESM sync scripts, deterministic gzip, OSRS Wiki APIs, Chunk Picker JSON.

## Global Constraints

- Work only on `codex/wyrmscraig-content-update` in `C:\Users\alexa\Game Production\FLIM\.worktrees\wyrmscraig-content-update`; do not commit to `main`.
- Goat Hunting, Sunstone Mining, Sunstone Golem Crafting, and Mortimer are world content, not random roll-table entries.
- Add the three methods to Skill Progression > Skill Unlocks at Tier 6. Also surface Sunstone rocks and the Sunstone monolith through Map Gathering at Mining 53.
- Wyrmscraig is one canonical named area under `The Open Seas`, backed by chunks `39,34`, `39,35`, `40,34`, and `40,35`. Do not create separate rollable Auchrie or Ardeaglais areas.
- Goat Hunting requires Wyrmscraig, Hunter 60, and Sheep Herder. Sunstone Mining requires Wyrmscraig, Mining 53, and Fallen From Grace. Sunstone Golem Crafting requires Wyrmscraig, Crafting 60, and Fallen From Grace.
- The Mad Angel is explicitly Mid tier. Preserve the existing Mid schedule: two Standard Keys at 30% and 15%.
- Do not add speculative Mad Angel Combat Achievements or a new 3D asset.
- Every network refresh must finish as immutable committed source data. Required CI verification remains offline and deterministic.
- Review generated diffs; never accept a source refresh solely because generation succeeded.
- Use test-first steps and commit only after the focused checks for that task pass.

Reviewed authorities:

- [Wyrmscraig release](https://secure.runescape.com/m=news/wyrmscraig-is-out-today?oldschool=1)
- [Summer Sweep-up follow-up](https://secure.runescape.com/m=news/summer-sweep-up---agility--chambers-of-xeric-changes?oldschool=1)
- Chunk Picker compare: `4eb75a8454eb41cfff71b70819326e0e67bcea7c...a9a5c74760eb76dbe39f90d2b04f023fc1de3746`

---

## File Structure

- `data/items.ts`, `data/subAreaChunks.ts`, `data/activityAccess.ts`: canonical Wyrmscraig geography and roll/access declarations.
- `data/questData.ts`, `data/sources/quest-list.json`, `data/sources/quest-requirement-audit.json`: Fallen From Grace runtime and reviewed source evidence.
- `scripts/sync-quest-sources.mjs`, `data/questRequirementAudit.ts`: incremental quest-source refresh that preserves previously reviewed revisions and supports per-entry Chunk Picker evidence commits.
- `data/skillUnlocks.ts`, `utils/chunkResources.ts`, `utils/skillChunkNodes.ts`: static Skill Unlocks entries and generated Map Gathering classification.
- `data/bossKeyTiers.ts`, `data/activityRequirements.ts`, `data/activityRegions.ts`: The Mad Angel tier and availability metadata.
- `data/collectionLogData.ts`, `scripts/sync-collection-log.mjs`: curated new boss page and synced existing-page additions.
- `scripts/chunk-source.mjs`, `data/sources/chunk-content-source.json`, `data/sources/chunkpicker-chunkinfo-export.json.gz`: exact reviewed Chunk Picker pin.
- `public/chunk-content.json`, `data/chunkContentLite.ts`, `data/sources/chunk-content-transform-audit.json`: regenerated chunk outputs.
- `data/sources/combat-achievement-tasks.json`, `data/caTasks.ts`, `scripts/sync-combat-achievements.mjs`: reviewed Combat Achievement snapshot and generated runtime data.
- `data/changelog.ts`, `docs/CONTENT_SYNC.md`, `docs/SYNC_STATUS.md`: player-facing release and source status.

### Task 1: Pin and regenerate the reviewed August Chunk Picker source

**Files:**
- Modify: `scripts/chunk-source.mjs`
- Modify: `scripts/chunk-source.test.ts`
- Modify: `scripts/chunk-content-transform.test.ts`
- Modify: `scripts/named-task-unlock-locations.test.ts`
- Modify: `data/sources/chunk-content-source.json`
- Modify after evidence review: `data/sources/named-task-unlock-locations.json`
- Replace: `data/sources/chunkpicker-chunkinfo-export.json.gz`
- Regenerate: `public/chunk-content.json`
- Regenerate: `data/chunkContentLite.ts`
- Regenerate: `data/sources/chunk-content-transform-audit.json`
- Regenerate only if changed by the source: `data/banks.ts`
- Modify: `data/contentBaseline.test.ts`

- [ ] **Step 1: Reconfirm the branch tip before changing the pin**

Run:

```powershell
npm run chunks:source-check
git ls-remote https://github.com/source-chunk/chunk-picker-v2.git refs/heads/gh-pages
```

Expected: both identify `a9a5c74760eb76dbe39f90d2b04f023fc1de3746`. If the branch moved, stop and review the additional commits before proceeding.

- [ ] **Step 2: Write failing source identity and content-sentinel tests**

Update the exact manifest expectation in `scripts/chunk-source.test.ts`:

```ts
expect(manifest).toMatchObject({
  schemaVersion: 1,
  repository: 'source-chunk/chunk-picker-v2',
  branch: 'gh-pages',
  commit: 'a9a5c74760eb76dbe39f90d2b04f023fc1de3746',
  blobSha: 'ffdcc10139dde0e11be29047c6c730fd762a33c8',
  rawSha256: '2D75BF70C9E6540CECC1631783A0293D8F28B440D429F6081B2CD4EE4C21CA59',
  rawBytes: 7_518_778,
  policyVersion: 2,
  reviewedAt: '2026-08-16',
});
```

Add focused generated-content assertions in `data/contentBaseline.test.ts`:

```ts
expect(Object.keys(fullChunkContent.chunks)).toHaveLength(938);
expect(fullChunkContent.shortcuts).toHaveLength(219);
expect(Object.keys(fullChunkContent.drops)).toHaveLength(800);
expect(fullChunkContent.chunks['7482']).toBeDefined();
expect(fullChunkContent.drops['Vampyre snail']).toBeDefined();
expect(fullChunkContent.drops['The Mad Angel']).toEqual(expect.arrayContaining([
  'Granite dust',
  'Hallowfell',
  'Ardeaglais teleport',
]));
```

Pin the refreshed clue overlay directly:

```ts
const madAngelClues = fullChunkContent.overlays.Clues
  .filter(point => /Mad Angel/i.test(point.h ?? ''));
expect(madAngelClues).toHaveLength(1);
expect(madAngelClues[0].t).toBe('Medium');
expect(madAngelClues.some(point => point.t === 'Hard')).toBe(false);
```

- [ ] **Step 3: Run the focused tests and verify RED**

```powershell
npx vitest run scripts/chunk-source.test.ts scripts/chunk-content-transform.test.ts scripts/named-task-unlock-locations.test.ts data/contentBaseline.test.ts
```

Expected: FAIL on the old commit, 203 shortcuts, 799 drop tables, and missing August sentinels.

- [ ] **Step 4: Update the two immutable manifest copies**

Use these exact source fields in `pinnedManifest` and `data/sources/chunk-content-source.json`:

```json
{
  "commit": "a9a5c74760eb76dbe39f90d2b04f023fc1de3746",
  "blobSha": "ffdcc10139dde0e11be29047c6c730fd762a33c8",
  "rawSha256": "2D75BF70C9E6540CECC1631783A0293D8F28B440D429F6081B2CD4EE4C21CA59",
  "rawBytes": 7518778,
  "reviewedAt": "2026-08-16",
  "sourceUrl": "https://raw.githubusercontent.com/source-chunk/chunk-picker-v2/a9a5c74760eb76dbe39f90d2b04f023fc1de3746/chunkpicker-chunkinfo-export.json"
}
```

Raise only confirmed count floors: `contentChunks: 938`, `shortcuts: 219`, and `dropTables: 800`. Preserve other floors unless the reviewed transform proves a higher value.

- [ ] **Step 5: Review the named-task registry against the new source**

Change `data/sources/named-task-unlock-locations.json` to the new commit only after verifying every curated `sourceKey` still exists. Add or remove a mapping only when the raw August diff supplies direct evidence. Update the exact-commit tests in `scripts/named-task-unlock-locations.test.ts`.

- [ ] **Step 6: Fetch and regenerate from the approved pin**

```powershell
node scripts/chunk-source.mjs --fetch-approved
npm run chunks:sync
npm run chunks:verify
```

Expected: the byte/hash checks pass before replacement, generation reports 938 content chunks, 219 shortcuts, and 800 drop tables, and offline verification exits 0.

- [ ] **Step 7: Review the semantic diff**

Confirm the 16 shortcut additions/barehanded changes, Chambers of Xeric weight corrections, Vampyre snail table, Medium Mad Angel clue, corrected Mad Angel drops, Mr McGroot naming/rate, Jeweller's chisel 1/300 source record, and task-unlock corrections. Reject unexpected bank removals, source-category losses, unresolved mapping losses, or unrelated name churn.

- [ ] **Step 8: Run the focused source suites and commit**

```powershell
npx vitest run scripts/chunk-source.test.ts scripts/chunk-content-transform.test.ts scripts/chunk-content-collisions.test.ts scripts/named-task-unlock-locations.test.ts data/contentBaseline.test.ts
git add scripts/chunk-source.mjs scripts/chunk-source.test.ts scripts/chunk-content-transform.test.ts scripts/named-task-unlock-locations.test.ts data/sources/chunk-content-source.json data/sources/named-task-unlock-locations.json data/sources/chunkpicker-chunkinfo-export.json.gz public/chunk-content.json data/chunkContentLite.ts data/sources/chunk-content-transform-audit.json data/banks.ts data/contentBaseline.test.ts
git commit -m "data: refresh reviewed August chunk source"
```

### Task 2: Add canonical Wyrmscraig geography and Fallen From Grace

**Files:**
- Modify: `data/items.ts`
- Modify: `data/subAreaChunks.ts`
- Modify: `data/questData.ts`
- Modify: `data/questData.accuracy.test.ts`
- Modify: `data/tasksConsistency.test.ts`
- Modify: `utils/reachability.test.ts`
- Modify: `utils/runeliteBundle.test.ts`
- Modify: `scripts/sync-quest-sources.mjs`
- Modify: `data/questRequirementAudit.ts`
- Modify: `data/questRequirementAudit.test.ts`
- Modify: `data/sources/quest-list.json`
- Modify: `data/sources/quest-requirement-audit.json`

- [ ] **Step 1: Write failing geography and quest tests**

Add exact assertions:

```ts
expect(REGION_GROUPS['The Open Seas']).toContain('Wyrmscraig');
expect(SUB_AREA_CHUNKS.Wyrmscraig).toEqual([
  { cx: 39, cy: 34 },
  { cx: 39, cy: 35 },
  { cx: 40, cy: 34 },
  { cx: 40, cy: 35 },
]);
```

In `data/questData.accuracy.test.ts` assert:

```ts
expect(QUEST_DATA['Fallen From Grace']).toMatchObject({
  kind: 'quest',
  accessPolicy: 'locations',
  regions: ['The Open Seas'],
  skills: { Sailing: 62, Crafting: 60, Runecraft: 47, Mining: 53 },
  prereqs: ['Pandemonium'],
  points: 2,
  difficulty: DropSource.QUEST_EXPERIENCED,
});
expect(QUEST_DATA['Fallen From Grace'].locations).toEqual([
  { id: 'auchrie', label: 'Auchrie', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 40, cy: 35 }] },
  { id: 'wyrmscraig-goat-pasture', label: 'Wyrmscraig Goat Pasture', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 40, cy: 34 }] },
  { id: 'ardeaglais', label: 'Ardeaglais', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 39, cy: 34 }] },
]);
```

Update total assertions to 191 runtime quests, 19 miniquests, and 210 journal entries. Update the flattened region child count from 176 to 177.

- [ ] **Step 2: Run the quest/geography tests and verify RED**

```powershell
npx vitest run data/questData.accuracy.test.ts data/tasksConsistency.test.ts utils/reachability.test.ts utils/runeliteBundle.test.ts
```

- [ ] **Step 3: Add Wyrmscraig and the runtime quest**

Add `'Wyrmscraig'` once to `REGION_GROUPS['The Open Seas']`, add the four exact chunks to `SUB_AREA_CHUNKS`, and insert Fallen From Grace immediately before the miniquest section in `QUEST_DATA` with the tested fields. Use `Wyrmscraig` for every Standard-mode location so Auchrie and Ardeaglais do not become separate geography rolls.

- [ ] **Step 4: Make quest source refresh incremental and evidence-safe**

Evolve the quest audit snapshot to schema version 2 with:

```json
"chunkSourceCommits": [
  "ba2fcebf8b26c84c74f8d9ab328a0ede802be926",
  "a9a5c74760eb76dbe39f90d2b04f023fc1de3746"
]
```

In `sync-quest-sources.mjs`, load the existing official and audit snapshots before refresh. For an unchanged runtime fingerprint, preserve its previously reviewed per-page Wiki revision, audit status, notes, and Chunk Picker commit. Generate a new unresolved row only for a new or changed fingerprint. This prevents a single new quest from discarding 209 completed reviews.

In `questRequirementAudit.ts`, replace the single commit constant with:

```ts
const APPROVED_CHUNK_SOURCE_COMMITS = new Set([
  'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
  'a9a5c74760eb76dbe39f90d2b04f023fc1de3746',
]);
```

Reject entry commits outside this set and require the top-level schema-2 list to contain exactly the commits actually referenced by entries.

- [ ] **Step 5: Refresh sources and curate only the new review**

```powershell
npm run quests:source-refresh
```

Expected: 191 runtime quest entries plus 19 miniquests; the official list's parsed quest-row count is 192 because Recipe for Disaster remains one official row while the runtime retains its established parent-step expansion. The 209 prior audit rows remain byte-for-byte equivalent apart from deterministic container metadata, and Fallen From Grace is the sole new unresolved row.

Review the permanent Wiki revision and set Fallen From Grace to `verified-with-notes`, using the new Chunk Picker commit and these evidence rows:

```json
[
  { "chunkId": "40,35", "role": "first", "place": "Auchrie" },
  { "chunkId": "40,34", "role": "step", "place": "Wyrmscraig Goat Pasture" },
  { "chunkId": "39,34", "role": "step", "place": "Ardeaglais" }
]
```

Record that inventory possession and quest-only interiors are not machine-enforced, all three surface locations map to canonical Wyrmscraig, and the runtime intentionally requires completed Pandemonium plus the four official skill levels.

- [ ] **Step 6: Update quest audit baselines and verify**

Update `scripts/sync-quest-sources.mjs`, `data/questRequirementAudit.test.ts`, and `data/tasksConsistency.test.ts` from `190/19/209` to `191/19/210`. Preserve the three existing unresolved cases; Fallen From Grace must not join them after review.

```powershell
npm run quests:verify
npx vitest run data/questData.accuracy.test.ts data/questRequirementAudit.test.ts data/tasksConsistency.test.ts utils/reachability.test.ts utils/runeliteBundle.test.ts
```

- [ ] **Step 7: Commit**

```powershell
git add data/items.ts data/subAreaChunks.ts data/questData.ts data/questData.accuracy.test.ts data/tasksConsistency.test.ts utils/reachability.test.ts utils/runeliteBundle.test.ts scripts/sync-quest-sources.mjs data/questRequirementAudit.ts data/questRequirementAudit.test.ts data/sources/quest-list.json data/sources/quest-requirement-audit.json
git commit -m "feat: add Wyrmscraig access and Fallen From Grace"
```

### Task 3: Add the three skilling methods to Skill Unlocks and Map Gathering

**Files:**
- Modify: `data/skillUnlocks.ts`
- Create: `data/skillUnlocks.test.ts`
- Modify: `utils/chunkResources.ts`
- Modify: `utils/chunkResources.test.ts`
- Create: `utils/skillChunkNodes.test.ts`

- [ ] **Step 1: Write failing Skill Unlocks tests**

```ts
expect(SKILL_UNLOCK_DATA.Hunter[6]).toContain(
  'Lvl 60: Goat Hunting (Wyrmscraig; Sheep Herder)',
);
expect(SKILL_UNLOCK_DATA.Mining[6]).toContain(
  'Lvl 53: Sunstone Mining (Wyrmscraig; Fallen From Grace)',
);
expect(SKILL_UNLOCK_DATA.Crafting[6]).toContain(
  'Lvl 60: Sunstone Golem Crafting (Wyrmscraig; Fallen From Grace)',
);
for (const method of ['Goat Hunting', 'Sunstone Mining', 'Sunstone Golem Crafting']) {
  expect(MINIGAMES_LIST).not.toContain(method);
}
```

- [ ] **Step 2: Write failing Map Gathering tests**

Add these cases to `utils/chunkResources.test.ts`:

```ts
['Sunstone rocks', 'Mining', 53],
['Sunstone monolith', 'Mining', 53],
```

In `utils/skillChunkNodes.test.ts`, initialize `chunkContentService` with a minimal mocked payload containing Sunstone rocks in Wyrmscraig Goat Pasture and Sunstone rocks plus the monolith in Auchrie. Assert:

```ts
expect(skillChunkNodes('Mining')).toEqual(expect.arrayContaining([
  expect.objectContaining({ name: 'Sunstone rocks', level: 53, tier: 6, chunks: 2 }),
  expect.objectContaining({ name: 'Sunstone monolith', level: 53, tier: 6, chunks: 1 }),
]));
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
npx vitest run data/skillUnlocks.test.ts utils/chunkResources.test.ts utils/skillChunkNodes.test.ts
```

- [ ] **Step 4: Add the methods and Mining classifier**

Add the exact strings to the existing Tier 6 arrays. Add this Mining rule before generic rock rules:

```ts
[/sunstone (rocks|monolith)/i, { skill: 'Mining', level: 53 }],
```

Do not add activity, minigame, or other random-roll entries for these methods.

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run data/skillUnlocks.test.ts utils/chunkResources.test.ts utils/skillChunkNodes.test.ts
git add data/skillUnlocks.ts data/skillUnlocks.test.ts utils/chunkResources.ts utils/chunkResources.test.ts utils/skillChunkNodes.test.ts
git commit -m "feat: surface Wyrmscraig skilling methods"
```

### Task 4: Integrate The Mad Angel into bosses, access, and key economy

**Files:**
- Modify: `data/items.ts`
- Modify: `data/bossKeyTiers.ts`
- Modify: `data/bossKeyTiers.test.ts`
- Modify: `data/activityRequirements.ts`
- Modify: `data/activityRegions.ts`
- Modify: `data/activityAccess.ts`
- Modify: `data/activityAccess.test.ts`
- Modify: `data/activityRequirements.consistency.test.ts`
- Modify: `utils/activityReadiness.test.ts`
- Modify only if the upstream encounter name differs: `utils/bossPlanner.ts`
- Modify: `config/economy.consistency.test.ts`

- [ ] **Step 1: Write failing registry and economy tests**

```ts
expect(BOSSES_LIST).toContain('The Mad Angel');
expect(BOSS_TIERS['The Mad Angel']).toBe('mid');
expect(ACTIVITY_REGIONS['The Mad Angel']).toBe('The Open Seas');
expect(ACTIVITY_ACCESS_AREAS['The Mad Angel']).toEqual(['Wyrmscraig']);
expect(ACTIVITY_REQUIREMENTS['The Mad Angel']).toEqual({
  quests: ['Fallen From Grace'],
  requiredAreas: ['Wyrmscraig'],
});
expect(VANILLA_BOSS_STANDARD_KEY_TOTAL).toBe(118);
```

Add readiness coverage proving the boss is blocked until both Wyrmscraig and Fallen From Grace are present, then becomes ready. Add a tier-schedule assertion for 30% and 15% Standard Keys.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npx vitest run data/bossKeyTiers.test.ts data/activityAccess.test.ts data/activityRequirements.consistency.test.ts utils/activityReadiness.test.ts config/economy.consistency.test.ts
```

- [ ] **Step 3: Add the boss declarations**

Add The Mad Angel to `BOSSES_LIST`, set its explicit tier to `mid`, region to `The Open Seas`, and both hard geography declarations to `Wyrmscraig`. Add the completed quest requirement. Do not add combat recommendations as hard gates.

Check the Boss Planner's existing monster API result. Add an alias only if the source uses a different canonical encounter name; otherwise retain the normal sprite/2D fallback path.

- [ ] **Step 4: Verify and commit**

```powershell
npx vitest run data/bossKeyTiers.test.ts data/activityAccess.test.ts data/activityRequirements.consistency.test.ts data/consistency.test.ts utils/activityReadiness.test.ts config/economy.consistency.test.ts
git add data/items.ts data/bossKeyTiers.ts data/bossKeyTiers.test.ts data/activityRequirements.ts data/activityRegions.ts data/activityAccess.ts data/activityAccess.test.ts data/activityRequirements.consistency.test.ts utils/activityReadiness.test.ts utils/bossPlanner.ts config/economy.consistency.test.ts
git commit -m "feat: add The Mad Angel boss unlock"
```

### Task 5: Add the Wyrmscraig Collection Log records

**Files:**
- Modify: `data/collectionLogData.ts`
- Modify: `data/collectionLog.consistency.test.ts`
- Inspect/run: `scripts/sync-collection-log.mjs`

- [ ] **Step 1: Write failing Collection Log tests**

```ts
expect(COLLECTION_LOG_DATA.Bosses.pages['The Mad Angel'].items.map(item => item.name)).toEqual([
  'Granite dust',
  'Hallowfell',
  'Ardeaglais teleport',
  'Aggy',
  'Jar of light',
]);
expect(COLLECTION_LOG_DATA.Other.pages['All Pets'].items.map(item => item.name))
  .toEqual(expect.arrayContaining(['Aggy', 'Mr McGroot']));
expect(COLLECTION_LOG_DATA.Other.pages.Miscellaneous.items.map(item => item.name))
  .toContain("Jeweller's chisel");
```

Raise the slot floor from 1,905 to 1,913 and the Bosses-page count from 56 to 57.

- [ ] **Step 2: Run the consistency test and verify RED**

```powershell
npx vitest run data/collectionLog.consistency.test.ts data/consistency.test.ts
```

- [ ] **Step 3: Curate the new page, then sync existing pages**

Add the new Bosses page with stable IDs `157001` through `157005` in the tested order. Then run:

```powershell
npm run clog:sync
```

Review the sync diff. It may append Aggy, Mr McGroot, and Jeweller's chisel to known pages, but it must not replace the curated new boss page, remove existing items, or emit unresolved `KEEP + ADD` duplication warnings.

- [ ] **Step 4: Verify and commit**

```powershell
npx vitest run data/collectionLog.consistency.test.ts data/consistency.test.ts
git add data/collectionLogData.ts data/collectionLog.consistency.test.ts
git commit -m "feat: add Wyrmscraig collection log entries"
```

### Task 6: Refresh Combat Achievement tier provenance

**Files:**
- Modify: `scripts/sync-combat-achievements.mjs`
- Modify: `scripts/sync-combat-achievements.test.ts`
- Modify: `data/sources/combat-achievement-tasks.json`
- Regenerate: `data/caTasks.ts`
- Modify: `data/tasksConsistency.test.ts`
- Modify: `data/contentBaseline.test.ts`

- [ ] **Step 1: Write failing provenance and tier tests**

Pin these reviewed values:

```ts
expect(ALL_CA_TASKS).toHaveLength(646);
expect(ALL_CA_TASKS.find(task => task.id === 'ca_640')).toMatchObject({
  name: 'Maggot King Speed Chaser',
  tierId: 'Grandmaster',
});
expect(tierCounts).toEqual({
  Easy: 41,
  Medium: 60,
  Hard: 86,
  Elite: 164,
  Master: 173,
  Grandmaster: 122,
});
```

Update the expected overview source to revision `15296909`, timestamp `2026-08-13T09:19:38Z`, verified date `2026-08-16`, and retrieval timestamp `2026-08-16T15:14:32.746Z`. Keep the six tier-page revision IDs unchanged and change only Master/Grandmaster row counts.

- [ ] **Step 2: Run CA tests and verify RED**

```powershell
npx vitest run scripts/sync-combat-achievements.test.ts data/tasksConsistency.test.ts data/contentBaseline.test.ts
```

- [ ] **Step 3: Update the reviewed source contract and regenerate**

Change the expected counts to Master 173 and Grandmaster 122, move `ca_640` to Grandmaster in the reviewed snapshot, and replace the old stale-637 discrepancy text with:

```text
The overview, authoritative Globals, and six tier task tables reconcile at 646 tasks; Maggot King Speed Chaser is Grandmaster.
```

Run:

```powershell
npm run ca:sync
```

Review that the generator changes only the expected provenance/comment and `ca_640` tier.

- [ ] **Step 4: Verify and commit**

```powershell
npx vitest run scripts/sync-combat-achievements.test.ts data/tasksConsistency.test.ts data/contentBaseline.test.ts
git add scripts/sync-combat-achievements.mjs scripts/sync-combat-achievements.test.ts data/sources/combat-achievement-tasks.json data/caTasks.ts data/tasksConsistency.test.ts data/contentBaseline.test.ts
git commit -m "data: refresh combat achievement tiers"
```

### Task 7: Add the release note and synchronize source documentation

**Files:**
- Modify: `data/changelog.ts`
- Modify: `data/changelog.test.ts`
- Modify: `docs/CONTENT_SYNC.md`
- Modify/regenerate: `docs/SYNC_STATUS.md`

- [ ] **Step 1: Write the failing changelog test**

Set the latest ID to `2026-08-16-wyrmscraig-content` and assert the release includes these exact player claims:

```ts
expect(LATEST_CHANGELOG.sections.added).toEqual(expect.arrayContaining([
  'Fallen From Grace and The Mad Angel are now tracked across quests, bosses, requirements, and the Collection Log.',
  'Hunter, Mining, and Crafting Tier 6 now list Goat Hunting, Sunstone Mining, and Sunstone Golem Crafting with their Wyrmscraig requirements.',
]));
expect(LATEST_CHANGELOG.sections.fixed).toEqual(expect.arrayContaining([
  'The August source refresh adds the latest shortcuts, drop-table corrections, Collection Log items, and the corrected Grandmaster tier for Maggot King Speed Chaser.',
]));
```

- [ ] **Step 2: Run the changelog test and verify RED**

```powershell
npx vitest run data/changelog.test.ts
```

- [ ] **Step 3: Add the newest-first release and update source docs**

Add a `Wyrmscraig Has Arrived` release dated `2026-08-16`. Update `CONTENT_SYNC.md` to 191 quests, 19 miniquests, 210 runtime journal entries, and CA distribution 41/60/86/164/173/122. Document the incremental quest-audit preservation rule and the new Chunk Picker pin.

Run the network freshness report after all source snapshots are final:

```powershell
npm run content:check
```

Review `SYNC_STATUS.md`; it should report 182 quests, 341 Quest Points, 646 Combat Achievements, and no unexplained shipped/runtime drift. If the live source differs, reconcile it rather than editing the status claim manually.

- [ ] **Step 4: Verify and commit**

```powershell
npx vitest run data/changelog.test.ts data/contentBaseline.test.ts
npm run changelog:verify
git add data/changelog.ts data/changelog.test.ts docs/CONTENT_SYNC.md docs/SYNC_STATUS.md data/contentBaseline.test.ts
git commit -m "docs: announce Wyrmscraig content update"
```

### Task 8: Run full automated and visible release verification

**Files:**
- Inspect: all branch changes
- Modify only for defects exposed by verification: files already owned by Tasks 1-7

- [ ] **Step 1: Run all deterministic source verifiers**

```powershell
npm run chunks:verify
npm run quests:verify
npm run content:verify
```

Expected: all exit 0 without modifying tracked files.

- [ ] **Step 2: Run the complete release gate**

```powershell
npm run release:verify
```

This covers changelog verification, the full Vitest suite, TypeScript, offline content verification, and the production build. Do not report success from partial or older output.

- [ ] **Step 3: Review diff and generated-artifact hygiene**

```powershell
git status --short
git diff --check main...HEAD
git diff --stat main...HEAD
git diff main...HEAD -- data/modelManifest.ts package-lock.json
```

Reject unintended lockfile churn, unrelated user files, stale generated output, duplicate registry IDs, or source changes without matching manifest/test updates.

- [ ] **Step 4: Verify the complete visible flow in a real browser**

Use a complete-state or controlled profile and capture evidence for:

1. Quest Log shows Fallen From Grace with Pandemonium, four skill levels, 2 Quest Points, and Wyrmscraig locations.
2. Skill Progression > Skill Unlocks shows Goat Hunting under Hunter Tier 6, Sunstone Mining under Mining Tier 6, and Sunstone Golem Crafting under Crafting Tier 6.
3. Skill Progression > Map Gathering shows Sunstone rocks and the Sunstone monolith at Mining 53 with Wyrmscraig map locations.
4. The Mad Angel appears in Bosses as Mid tier and shows Wyrmscraig plus Fallen From Grace blockers until satisfied.
5. The Mad Angel Collection Log page contains all five items; All Pets contains Aggy and Mr McGroot; Miscellaneous contains Jeweller's chisel.
6. Chunk Info exposes the refreshed Wyrmscraig content and August shortcut changes.

If any view is visibly wrong, fix it and rerun its focused tests plus `npm run release:verify`.

- [ ] **Step 5: Commit verification fixes, if any, and request review**

```powershell
git status --short
```

If verification required code changes, commit them with a scoped message. Then use `superpowers:requesting-code-review` for a fresh spec/diff review before integration. Do not merge to `main` from this task.
