# Shared Rules and Compact Chunk Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export one versioned permission snapshot from the web app and use it to render a compact, category-first “what can I do here?” panel in RuneLite.

**Architecture:** The app derives concise per-chunk permission rows from its canonical rules and content data, then ships them in bundle v4 alongside the underlying unlock snapshot. RuneLite parses v4 atomically, exposes all decisions through a focused `FateRuleEngine`, and renders one shared view model in the side panel and optional overlay; legacy bundles retain their current map behavior with Unknown for new categories.

**Tech Stack:** React/TypeScript/Vitest, gzip bundle export, Java 11/Gson/JUnit, RuneLite Swing panel and overlays.

## Global Constraints

- Category-first layout; omit empty categories.
- Banks and shops show only the name plus positive status or `Locked`.
- Quests show only their name and a green tick, orange circle, or red cross.
- Combat access shows only the name and a tick or cross.
- Skilling/resources may show a concise current cap and requirement.
- Green = available now, orange = relevant but not ready, red = explicitly locked, grey = Unknown.
- Unknown must remain visually distinct and must never become a blocking decision.
- The app remains the canonical rules engine; RuneLite consumes the exported snapshot.
- v1–v3 bundles must continue loading; a malformed or future bundle must not replace the last valid bundle.
- Bundle v4 compressed relay payload must stay below the existing 256 KiB relay limit.
- Do not implement click cancellation in this project.
- Approved design: `docs/superpowers/specs/2026-07-24-fate-guardian-runelite-design.md`.
- Durable Roll Inbox Project 1 must be complete first.

---

## Shared interfaces

```ts
export type PermissionStatus = 'ALLOWED' | 'NOT_READY' | 'LOCKED' | 'UNKNOWN';
export type ChunkCategoryId =
  | 'SKILLING' | 'BANKS' | 'SHOPS' | 'QUESTS' | 'COMBAT'
  | 'TRAVEL' | 'FARMING' | 'ACTIVITIES';

export interface ChunkPermissionRow {
  key: string;
  name: string;
  status: PermissionStatus;
  detail?: string;
  targetKind?: 'NPC' | 'OBJECT' | 'SHOP' | 'BANK' | 'TELEPORT' | 'ACTIVITY';
}

export interface ChunkPermissionSnapshot {
  chunkKey: string;
  name: string | null;
  region: string | null;
  entry: PermissionStatus;
  categories: Partial<Record<ChunkCategoryId, ChunkPermissionRow[]>>;
  counts: { allowed: number; notReady: number; locked: number; unknown: number };
}
```

Bundle v4 adds:

```ts
interface RuneliteRulesManifest {
  rulesVersion: string;
  contentVersion: number;
  detectorContractVersion: number;
  runId: string;
  runRevision: number;
  account: string | null;
  gameModeId: string;
  exportedAt: string;
  bankLocks: boolean;
  unlocks: {
    regions: string[];
    chunks: string[];
    skills: Record<string, number>;
    levels: Record<string, number>;
    equipment: Record<string, number>;
    banks: string[];
    merchants: string[];
    bosses: string[];
    minigames: string[];
    mobility: string[];
    arcana: string[];
    guilds: string[];
    farming: string[];
    slayer: string[];
    quests: string[];
  };
  chunks: Record<string, ChunkPermissionSnapshot>;
}
```

### Task 1: Define and test permission status derivation

**Files:**
- Create: `utils/chunkPermissionSnapshot.ts`
- Create: `utils/chunkPermissionSnapshot.test.ts`
- Modify: `services/ChunkContentService.ts`

**Interfaces:**
- `buildChunkPermissionSnapshot(content, coord, context): ChunkPermissionSnapshot`.
- `ChunkContentService.allChunkCoords(): {cx:number, cy:number}[]`.
- `ChunkPermissionContext` contains `unlocks`, `gameModeId`, `customMode`, `reachableChunks`, and canonical helper indexes.

- [ ] **Step 1: Write representative failing tests**

```ts
it('uses category-specific compact rows', () => {
  const view = buildFixture({
    bank: { name: 'Lumbridge bank', unlocked: false },
    shops: [{ name: 'Lumbridge General Store', category: 'General Stores' }],
    quests: [{ name: "Cook's Assistant", status: 'NOT_READY' }],
    combat: [{ name: 'Goblin', status: 'ALLOWED' }],
  });
  expect(view.categories.BANKS).toEqual([
    expect.objectContaining({ name: 'Lumbridge bank', status: 'LOCKED',
      detail: undefined }),
  ]);
  expect(view.categories.QUESTS?.[0]).toMatchObject({
    name: "Cook's Assistant", status: 'NOT_READY', detail: undefined,
  });
  expect(view.categories.COMBAT?.[0]).toMatchObject({
    name: 'Goblin', status: 'ALLOWED', detail: undefined,
  });
});

it('keeps useful skilling requirements concise', () => {
  expect(buildYewFixture().categories.SKILLING?.[0]).toMatchObject({
    name: 'Yew tree',
    status: 'NOT_READY',
    detail: 'Woodcutting 45/60 · cap 50',
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- utils/chunkPermissionSnapshot.test.ts`

Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement category derivation**

Use existing canonical helpers:

- entry: `isChunkUnlocked`, region/sub-area reachability, and `chunkReachability`;
- banks: `isBankReachable`;
- shops: `classifyShop` plus `unlocks.merchants`;
- quests: `doabilityBucket` and quest prerequisite status;
- skilling: `resourceReqFor` and `resourceUsable`;
- combat: Slayer requirement plus boss/activity unlocks;
- travel: shortcut/transport requirements and `unlocks.mobility`;
- farming: patch name plus `unlocks.farming`;
- activities: `BOSS_TIERS`, `BOSSES_LIST`, and `MINIGAMES_LIST`.

Map `DOABLE`/`DONE` to `ALLOWED`, `REQS`/`STRANDED` to `NOT_READY`, and `LOCKED` to `LOCKED`. Unknown content or incomplete mappings remain `UNKNOWN`.

- [ ] **Step 4: Enforce copy density in tests**

Assert no bank/shop/quest/combat row contains these strings:

```ts
['Unlock from', 'Spend Keys', 'This individual', 'has not been rolled',
 'Complete this quest to', 'Combat access requires']
```

- [ ] **Step 5: Verify**

Run: `npm test -- utils/chunkPermissionSnapshot.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/chunkPermissionSnapshot.ts utils/chunkPermissionSnapshot.test.ts services/ChunkContentService.ts
git commit -m "feat: derive compact chunk permissions"
```

### Task 2: Build the versioned rules manifest

**Files:**
- Create: `utils/runeliteRulesManifest.ts`
- Create: `utils/runeliteRulesManifest.test.ts`
- Modify: `utils/runeliteExport.ts`

**Interfaces:**
- `buildRuneliteRulesManifest(input: RulesManifestInput): Promise<RuneliteRulesManifest>`.
- Uses `RULES_VERSION`, `CONTENT_VERSION`, and `DETECTOR_CONTRACT_VERSION` created in Project 1.
- Returns rows sorted by category order and then `name.localeCompare`.

- [ ] **Step 1: Write manifest completeness tests**

```ts
it('exports every rule family and a stable chunk snapshot', async () => {
  const manifest = await buildRuneliteRulesManifest(fixtureInput);
  expect(manifest).toMatchObject({
    rulesVersion: '1',
    contentVersion: 1,
    detectorContractVersion: 1,
    runId: 'run-1',
    runRevision: 41,
    gameModeId: 'vanilla',
    bankLocks: true,
  });
  expect(manifest.unlocks).toEqual(expect.objectContaining({
    regions: expect.any(Array),
    skills: expect.any(Object),
    equipment: expect.any(Object),
    merchants: expect.any(Array),
    slayer: expect.any(Array),
  }));
  expect(manifest.chunks['50,50']).toBeDefined();
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- utils/runeliteRulesManifest.test.ts`

Expected: FAIL because the manifest builder does not exist.

- [ ] **Step 3: Implement deterministic manifest construction**

Initialize `chunkContentService`, obtain all chunk coordinates, compute the reachability set once, and build each chunk snapshot. Sort every exported array and object key so identical run state yields identical JSON apart from `exportedAt`.

- [ ] **Step 4: Verify**

Run: `npm test -- utils/runeliteRulesManifest.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/runeliteRulesManifest.ts utils/runeliteRulesManifest.test.ts utils/runeliteExport.ts
git commit -m "feat: build shared RuneLite rules manifest"
```

### Task 3: Upgrade the app export to bundle v4

**Files:**
- Modify: `utils/runeliteBundle.ts`
- Modify: `utils/runeliteBundle.test.ts`
- Modify: `utils/runelitePluginParity.test.ts`
- Modify: `utils/runeliteExport.ts`

**Interfaces:**
- `buildRuneliteBundle(...)` emits `version: 4` and `rules: RuneliteRulesManifest`.
- Keeps all v3 root fields during one compatibility release.
- `buildBundlePayload(...)` returns `{json, compressed}` unchanged.

- [ ] **Step 1: Write failing v4 and size-budget tests**

```ts
it('emits v4 while preserving v3 map fields', async () => {
  const bundle = await buildFixture();
  expect(bundle.version).toBe(4);
  expect(bundle.rules.runId).toBe('run-1');
  expect(bundle.chunks).toBeDefined();
  expect(bundle.chunkContent).toBeDefined();
});

it('fits the relay after FLGZ compression', async () => {
  const { compressed } = await buildFullFixturePayload();
  expect(new TextEncoder().encode(compressed).byteLength).toBeLessThan(256 * 1024);
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts`

Expected: FAIL because the bundle version is 3 and `rules` is absent.

- [ ] **Step 3: Emit v4 and remove duplicate bulk where safe**

Add `rules` while preserving v3 fields. If the full payload exceeds the limit, remove only information duplicated exactly inside `rules.chunks`; keep `chunks`, `subAreaChunks`, `regionGroups`, `unlockedRegions`, and `state` for legacy compatibility. Do not raise the relay limit to hide an oversized manifest.

- [ ] **Step 4: Update TypeScript parity simulation**

Teach `utils/runelitePluginParity.test.ts` to read both v3 root fields and v4 `rules`, asserting identical lock, free-area, bank, and account results.

- [ ] **Step 5: Verify**

Run: `npm test -- utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts`

Expected: PASS and compressed size below 256 KiB.

- [ ] **Step 6: Commit**

```bash
git add utils/runeliteBundle.ts utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts utils/runeliteExport.ts
git commit -m "feat: export RuneLite bundle v4"
```

### Task 4: Parse v4 atomically in the plugin

**Files:**
- Create: `src/main/java/com/fatelocked/rules/PermissionStatus.java`
- Create: `src/main/java/com/fatelocked/rules/ChunkPermissionRow.java`
- Create: `src/main/java/com/fatelocked/rules/ChunkPermissionSnapshot.java`
- Create: `src/main/java/com/fatelocked/rules/RuneliteRulesManifest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedBundle.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Create: `src/test/resources/bundles/v4-rules.json`
- Create: `src/test/resources/bundles/v5-future.json`
- Modify: `src/test/java/com/fatelocked/FateLockedBundleTest.java`

**Interfaces:**
- `FateLockedBundle.getRules(): RuneliteRulesManifest`.
- `FateLockedBundle.permissionsAt(CanonicalChunk): Optional<ChunkPermissionSnapshot>`.
- `FateLockedBundle.isLegacyRules(): boolean`.
- `FateLockedBundle.loadFromJson` rejects versions above 4 with `IllegalArgumentException`.

- [ ] **Step 1: Write parser and atomic-replacement tests**

```java
@Test
public void parsesV4PermissionRows()
{
    FateLockedBundle b = fixture("bundles/v4-rules.json");
    ChunkPermissionSnapshot c = b.permissionsAt(new CanonicalChunk(50, 50)).get();
    assertEquals(PermissionStatus.ALLOWED, c.getEntry());
    assertEquals("Lumbridge General Store",
        c.getCategories().get("SHOPS").get(0).getName());
}

@Test(expected = IllegalArgumentException.class)
public void rejectsFutureBundle()
{
    fixture("bundles/v5-future.json");
}
```

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.FateLockedBundleTest --no-daemon`

Expected: FAIL because v4 rule types are absent.

- [ ] **Step 3: Implement immutable parsing**

Normalize null collections to empty immutable collections. Validate required v4 fields before constructing the bundle. In `applyPastedBundle` and file reload, assign `bundle = parsed` only after full validation; on failure, retain the previous valid bundle and show `import failed — using previous rules`.

- [ ] **Step 4: Preserve v1–v3 behavior**

Legacy bundles must continue region/chunk/bank behavior. `permissionsAt` returns empty and the new panel uses legacy content with `UNKNOWN` status rather than inventing permissions.

- [ ] **Step 5: Verify**

Run: `gradle test --tests com.fatelocked.FateLockedBundleTest --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/rules src/main/java/com/fatelocked/FateLockedBundle.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test
git commit -m "feat: parse shared rules bundle v4"
```

### Task 5: Centralize plugin rule queries

**Files:**
- Create: `src/main/java/com/fatelocked/rules/FateRuleEngine.java`
- Create: `src/main/java/com/fatelocked/rules/RuleDecision.java`
- Create: `src/test/java/com/fatelocked/rules/FateRuleEngineTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`

**Interfaces:**
- `entry(CanonicalChunk): RuleDecision`.
- `target(CanonicalChunk, String targetKind, String targetName): RuleDecision`.
- `RuleDecision` contains `PermissionStatus status`, `String label`, and nullable concise `reason`.
- Wrong account returns `UNKNOWN`; missing v4 mapping returns `UNKNOWN`.

- [ ] **Step 1: Write decision tests**

Test allowed, not-ready, locked, unknown, wrong account, stale import, case-insensitive names, and legacy bundles. Assert Unknown is never converted to Locked.

```java
assertEquals(PermissionStatus.UNKNOWN,
    wrongAccount.target(chunk, "SHOP", "Lumbridge General Store").getStatus());
```

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.rules.FateRuleEngineTest --no-daemon`

Expected: FAIL because the engine does not exist.

- [ ] **Step 3: Implement lookup-only decisions**

Resolve current chunk entry first, then exact normalized kind/name matches. A locked chunk may lock a mapped target; an unauthored chunk is Unknown. Preserve the app-provided status rather than re-deriving quest/skill rules in Java.

- [ ] **Step 4: Replace duplicate warning lookups**

Route locked-bank and locked-menu warning labels through `FateRuleEngine`, while leaving existing overlay tint calculations on `FateLockedBundle` for v1–v3 compatibility.

- [ ] **Step 5: Verify**

Run: `gradle test --tests com.fatelocked.rules.FateRuleEngineTest --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/rules src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/rules
git commit -m "refactor: centralize RuneLite rule decisions"
```

### Task 6: Build the category-first chunk view model

**Files:**
- Create: `src/main/java/com/fatelocked/panel/ChunkPanelViewModel.java`
- Create: `src/main/java/com/fatelocked/panel/ChunkPanelViewModelFactory.java`
- Create: `src/test/java/com/fatelocked/panel/ChunkPanelViewModelFactoryTest.java`

**Interfaces:**
- `create(FateLockedBundle, CanonicalChunk, boolean accountMatches, Instant importedAt): ChunkPanelViewModel`.
- View model contains header, coordinates, entry status, freshness label, counts, and non-empty ordered categories.
- Category order: Skilling, Banks, Shops, Quests, Combat, Travel, Farming, Activities.

- [ ] **Step 1: Write exact density tests**

```java
assertEquals(Arrays.asList("SKILLING", "BANKS", "SHOPS", "QUESTS", "COMBAT"),
    view.getCategories().stream().map(CategoryView::getId).collect(toList()));
assertEquals("Locked", bank.getStatusText());
assertNull(bank.getDetail());
assertEquals("○", quest.getStatusGlyph());
assertNull(quest.getDetail());
assertEquals("✓", combat.getStatusGlyph());
```

Also assert empty categories are omitted and counts match visible rows.

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.panel.ChunkPanelViewModelFactoryTest --no-daemon`

Expected: FAIL because the panel package does not exist.

- [ ] **Step 3: Implement pure view-model creation**

Use glyphs `✓`, `○`, `✕`, and `?`; status text only where the category requires it. Quests use all three semantic glyphs. Combat uses `✓` for Allowed and `✕` for both Not ready and Locked, so it remains a binary access scan; Unknown uses `?`. Freshness is `Synced now`, `Synced Xm ago`, or `Offline snapshot`; it is a header fact, not repeated in rows.

- [ ] **Step 4: Verify**

Run: `gradle test --tests com.fatelocked.panel.ChunkPanelViewModelFactoryTest --no-daemon`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fatelocked/panel src/test/java/com/fatelocked/panel
git commit -m "feat: model compact chunk permissions"
```

### Task 7: Render the polished narrow panel and overlay

**Files:**
- Modify: `src/main/java/com/fatelocked/FateLockedPanel.java`
- Modify: `src/main/java/com/fatelocked/FateLockedContentOverlay.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Create: `src/test/java/com/fatelocked/panel/ChunkPanelRenderingTest.java`

**Interfaces:**
- Both surfaces consume `ChunkPanelViewModel`; neither formats rule explanations itself.
- Normal side-panel target width: 225–280 px.

- [ ] **Step 1: Write rendering contract tests**

Inspect Swing component text recursively and assert:

```text
header contains area, region, coordinates, entry, freshness
summary contains Can do, Not ready, Locked
banks/shops contain no paragraph or unlock-route copy
quests contain one glyph per row
combat contains one glyph per row
no empty category heading is rendered
```

- [ ] **Step 2: Run the failing test**

Run: `gradle test --tests com.fatelocked.panel.ChunkPanelRenderingTest --no-daemon`

Expected: FAIL against the current prose/list panel.

- [ ] **Step 3: Implement the side-panel layout**

Use a compact header card, three count chips, category headers, and 24–28 px rows. Truncate long names with a tooltip. Use RuneLite dark surfaces, muted separators, and status colors: green `#10B981`, amber `#F59E0B`, red `#EF4444`, grey `#9CA3AF`.

- [ ] **Step 4: Reuse the model in the optional overlay**

Cap the overlay at five rows per category with `+N more`; keep the full list in the side panel. Do not reintroduce the old `"Monsters: a, b, c"` paragraph format.

- [ ] **Step 5: Verify**

Run:

```bash
gradle test --tests 'com.fatelocked.panel.*' --no-daemon
gradle jar --no-daemon
```

Expected: PASS and BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/FateLockedPanel.java src/main/java/com/fatelocked/FateLockedContentOverlay.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/panel
git commit -m "feat: render compact category-first chunk panel"
```

### Task 8: Full parity and manual visual gate

**Files:**
- Modify: `CONTRIBUTING.md` in the standalone plugin
- Modify: `docs/online-relay.md` in the app repository

**Interfaces:**
- Produces: documented v4 schema and legacy fallback.

- [ ] **Step 1: Run app verification**

```bash
npm test
npm run typecheck
npm run content:verify
npm run build
```

Expected: all commands pass, including the compressed size budget.

- [ ] **Step 2: Run plugin verification**

Run: `gradle clean test jar --no-daemon`

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Visually inspect representative chunks**

At normal RuneLite width, inspect:

1. Lumbridge with multiple categories.
2. A bank-locked chunk.
3. A shop whose merchant category is locked.
4. A quest with each of the three statuses.
5. A resource above the player's cap.
6. A legacy v3 bundle.
7. A wrong-account and offline snapshot.

Confirm names remain readable, rows have no redundant prose, empty categories disappear, and the optional overlay stays draggable.

- [ ] **Step 4: Document and commit**

Document v4 fields, the 256 KiB compressed budget, status meanings, and v1–v3 fallback:

```bash
git add docs/online-relay.md
git commit -m "docs: document RuneLite rules bundle v4"
```

Standalone plugin:

```bash
git add CONTRIBUTING.md
git commit -m "docs: document compact rules panel"
```
