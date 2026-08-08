# Complete Bank Location Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add every reviewed fixed-location bank and deposit service to the bank-lock pool, producing 126 stable chunk unlocks with accurate labels and deterministic generation.

**Architecture:** A reviewed JSON registry owns local bank additions, label overrides, evidence, and explicit exclusions without modifying the pinned upstream Chunk Picker artifact. The chunk transform unions registry ids into `public/chunk-content.json`, while the bank generator reads the same registry for player-facing labels. Validation and focused tests keep upstream refreshes, the web app, and RuneLite exports aligned.

**Tech Stack:** TypeScript, JavaScript ES modules, JSON, Vitest, React, Node.js generation scripts.

## Global Constraints

- The final pool contains exactly 126 unique canonical chunk ids.
- Canonical ids use the exact formula `String(cx * 256 + cy)`.
- Physical facilities use their physical chunk; fixed NPC services use the NPC chunk; internal facilities use a stable walkable access chunk.
- Multiple facilities resolving to one canonical chunk remain one unlock.
- The Woodcutting Leprechaun remains excluded.
- Tutorial Island, The Node, Gravedigger Mausoleum, tool leprechauns, servants, the Ferox mercenary, and removed banks remain excluded for the reasons recorded in the approved specification.
- The pinned `chunkpicker-chunkinfo-export.json.gz` artifact remains unchanged.
- Player-facing proxy labels identify the facility first and place access details in `accessVia`.
- All generated outputs must support a deterministic `--check` path.

---

## File Structure

- Create `data/sources/bank-locations.json`: reviewed additions, label overrides, source revisions, and explicit exclusions.
- Create `scripts/bank-locations.mjs`: read, validate, and index the reviewed registry.
- Create `scripts/bank-locations.test.ts`: registry completeness and validation tests.
- Modify `scripts/chunk-content-transform.mjs`: union reviewed additions into transformed bank ids.
- Modify `scripts/chunk-content-transform.test.ts`: prove curated union and upstream audit behavior.
- Modify `scripts/sync-chunk-content.mjs`: load and validate the registry during generation.
- Modify `scripts/chunk-source.mjs`: validate and apply the registry while approving pinned source data.
- Modify `scripts/chunk-source.test.ts`: pass the registry and pin the 126-bank baseline.
- Modify `data/contentBaseline.test.ts`: pin the generated 126-bank runtime baseline.
- Modify `public/chunk-content.json`: generated complete bank-id set.
- Modify `scripts/gen-banks.mjs`: generate registry-aware labels and support `--check`.
- Create `scripts/gen-banks.test.ts`: generator label and determinism tests.
- Modify `data/banks.ts`: generated 126-entry player-facing bank pool.
- Modify `utils/banks.test.ts`: pin pool size, ids, labels, and exclusions.
- Modify `package.json`: add bank generation checks to the chunk sync workflow.
- Modify `components/ShareModal.tsx`: derive the copied bank total from `BANK_IDS.length`.
- Modify `components/ShareModal.test.tsx`: prove the copied summary uses the generated total.
- Modify `data/changelog.ts`: add the player-facing complete-bank-pool release note.
- Modify `data/changelog.test.ts`: pin the new newest release.
- Modify `ROADMAP.md`: replace the stale `X/100` bank-pool reference.

---

### Task 1: Reviewed registry and validator

**Files:**
- Create: `data/sources/bank-locations.json`
- Create: `scripts/bank-locations.mjs`
- Create: `scripts/bank-locations.test.ts`

**Interfaces:**
- Produces: `readBankLocationRegistry(url?) -> object`
- Produces: `validateBankLocationRegistry(registry, { validChunkIds }) -> registry`
- Produces: `bankLocationLabels(registry) -> Map<string, string>`
- Consumes: the pinned source's `walkableChunks` for chunk validation.

- [ ] **Step 1: Write the failing registry tests**

Create `scripts/bank-locations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readPinnedChunkSource } from './chunk-source.mjs';
import {
  bankLocationLabels,
  readBankLocationRegistry,
  validateBankLocationRegistry,
} from './bank-locations.mjs';

const ADDITION_IDS = [
  '5678', '6454', '6458', '6711', '6712', '6961', '7225', '8499',
  '8508', '8751', '8756', '8757', '8999', '9274', '10553', '11047',
  '11056', '11062', '11572', '11578', '12082', '12337', '12838',
  '12849', '14132',
];

describe('reviewed bank-location registry', () => {
  it('contains the exact reviewed addition set and validates against walkable chunks', async () => {
    const registry = readBankLocationRegistry();
    const { data } = await readPinnedChunkSource();
    const validChunkIds = new Set((data.walkableChunks ?? []).map(String));

    expect(() => validateBankLocationRegistry(registry, { validChunkIds })).not.toThrow();
    expect(registry.locations.map(({ id }: { id: string }) => id).sort((a: string, b: string) => +a - +b))
      .toEqual([...ADDITION_IDS].sort((a, b) => +a - +b));
    expect(new Set(registry.locations.map(({ id }: { id: string }) => id)).size).toBe(25);
  });

  it('keeps canonical coordinates, unique names, reviewed labels, and exclusions explicit', () => {
    const registry = readBankLocationRegistry();
    const labels = bankLocationLabels(registry);

    for (const location of registry.locations) {
      expect(location.id).toBe(String(location.cx * 256 + location.cy));
    }
    expect(new Set(registry.locations.map(({ name }: { name: string }) => name))).toHaveLength(25);
    expect(labels.get('10275')).toBe('Wyrmscraig bank chest');
    expect(labels.get('11830')).toBe('Ruins of Camdozaal (via Ice Mountain)');
    expect(registry.exclusions.map(({ name }: { name: string }) => name)).toContain('Woodcutting Leprechaun');
    expect(registry.locations.some(({ name }: { name: string }) => /Woodcutting Leprechaun/i.test(name))).toBe(false);
  });

  it('rejects duplicate ids and coordinate mismatches', () => {
    const registry = readBankLocationRegistry();
    const duplicate = structuredClone(registry);
    duplicate.locations.push(structuredClone(duplicate.locations[0]));
    expect(() => validateBankLocationRegistry(duplicate))
      .toThrow(/duplicate bank location id/i);

    const mismatch = structuredClone(registry);
    mismatch.locations[0].cx += 1;
    expect(() => validateBankLocationRegistry(mismatch))
      .toThrow(/canonical chunk id mismatch/i);
  });
});
```

- [ ] **Step 2: Run the tests and confirm the missing-module failure**

Run: `npx vitest run scripts/bank-locations.test.ts`

Expected: FAIL because `scripts/bank-locations.mjs` does not exist.

- [ ] **Step 3: Add the complete reviewed JSON registry**

Create `data/sources/bank-locations.json` with this structure and exact entries:

```json
{
  "schemaVersion": 1,
  "reviewedAt": "2026-08-08",
  "sourceRevisions": [
    { "title": "List of banks", "revision": 15282054, "url": "https://oldschool.runescape.wiki/w/List_of_banks" },
    { "title": "Bank Deposit Box", "revision": 15267085, "url": "https://oldschool.runescape.wiki/w/Bank_Deposit_Box" },
    { "title": "Sangvesti bank", "revision": 15262093, "url": "https://oldschool.runescape.wiki/w/Sangvesti_bank" },
    { "title": "Castle Drakan", "revision": 15283343, "url": "https://oldschool.runescape.wiki/w/Castle_Drakan" }
  ],
  "locations": [
    { "id": "5678", "cx": 22, "cy": 46, "name": "Aldarin dock deposit box", "referenceKind": "physical", "facilities": ["Aldarin dock deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "6454", "cx": 25, "cy": 54, "name": "East Woodcutting Guild deposit box", "referenceKind": "physical", "facilities": ["East Woodcutting Guild deposit box", "Ent dungeon bank chest"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box", "https://oldschool.runescape.wiki/w/List_of_banks"] },
    { "id": "6458", "cx": 25, "cy": 58, "name": "Arceuus bank and deposit box", "referenceKind": "physical", "facilities": ["Arceuus bank", "Arceuus deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks", "https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "6711", "cx": 26, "cy": 55, "name": "Saltpetre mine deposit box", "referenceKind": "physical", "facilities": ["Saltpetre mine deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "6712", "cx": 26, "cy": 56, "name": "Hosidius Kitchen bank chest", "referenceKind": "physical", "facilities": ["Hosidius Kitchen bank chest"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks"] },
    { "id": "6961", "cx": 27, "cy": 49, "name": "Fortis Cothon deposit box", "referenceKind": "physical", "facilities": ["Fortis Cothon deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "7225", "cx": 28, "cy": 57, "name": "Port Piscarilius dock deposit box", "referenceKind": "physical", "facilities": ["Port Piscarilius dock deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "8499", "cx": 33, "cy": 51, "name": "West Prifddinas dock deposit box", "referenceKind": "physical", "facilities": ["West Prifddinas dock deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "8508", "cx": 33, "cy": 60, "name": "Lunar Isle dock deposit box", "referenceKind": "physical", "facilities": ["Lunar Isle dock deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "8751", "cx": 34, "cy": 47, "name": "Zul-Andra deposit chest", "referenceKind": "physical", "facilities": ["Zul-Andra deposit chest"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "8756", "cx": 34, "cy": 52, "name": "Prifddinas north bank and Gauntlet deposit box", "referenceKind": "entrance", "accessVia": "Amlodd and Hefin access", "facilities": ["Prifddinas north bank", "Gauntlet deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks", "https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "8757", "cx": 34, "cy": 53, "name": "Gwenith deposit box", "referenceKind": "physical", "facilities": ["Gwenith deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "8999", "cx": 35, "cy": 39, "name": "Bank boat", "referenceKind": "physical", "facilities": ["Bank boat"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks"] },
    { "id": "9274", "cx": 36, "cy": 58, "name": "Neitiznot dock deposit box", "referenceKind": "physical", "facilities": ["Neitiznot dock deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "10553", "cx": 41, "cy": 57, "name": "Peer the Seer deposit service", "referenceKind": "npc", "facilities": ["Peer the Seer"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "11047", "cx": 43, "cy": 39, "name": "Red Rock bank chest", "referenceKind": "physical", "facilities": ["Red Rock bank chest"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks"] },
    { "id": "11056", "cx": 43, "cy": 48, "name": "Rionasta deposit service", "referenceKind": "npc", "facilities": ["Rionasta"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "11062", "cx": 43, "cy": 54, "name": "Camelot PvP bank chest", "referenceKind": "physical", "facilities": ["Camelot PvP bank chest"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks"] },
    { "id": "11572", "cx": 45, "cy": 52, "name": "Falador west deposit box", "referenceKind": "physical", "facilities": ["Falador west deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "11578", "cx": 45, "cy": 58, "name": "Ancient Prison bank", "referenceKind": "entrance", "accessVia": "God Wars Dungeon", "facilities": ["Ancient Prison bank"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks"] },
    { "id": "12082", "cx": 47, "cy": 50, "name": "Port Sarim deposit boxes", "referenceKind": "physical", "facilities": ["Port Sarim deposit boxes"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "12337", "cx": 48, "cy": 49, "name": "Guardians of the Rift bank and deposit pool", "referenceKind": "entrance", "accessVia": "Wizards' Tower route", "facilities": ["Guardians of the Rift bank chest", "Guardians of the Rift deposit pool"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks", "https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "12838", "cx": 50, "cy": 38, "name": "Great Conch Sacred Grove deposit box", "referenceKind": "physical", "facilities": ["Great Conch Sacred Grove deposit box"], "wiki": ["https://oldschool.runescape.wiki/w/Bank_Deposit_Box"] },
    { "id": "12849", "cx": 50, "cy": 49, "name": "Zanaris bank", "referenceKind": "entrance", "accessVia": "Lumbridge Swamp shed", "facilities": ["Zanaris bank"], "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks"] },
    { "id": "14132", "cx": 55, "cy": 52, "name": "Sangvesti and Castle Drakan banking", "referenceKind": "entrance", "accessVia": "Castle Drakan and Vampyrium", "facilities": ["Sangvesti bank", "Castle Drakan deposit chests"], "wiki": ["https://oldschool.runescape.wiki/w/Sangvesti_bank", "https://oldschool.runescape.wiki/w/Castle_Drakan"] }
  ],
  "labelOverrides": [
    { "id": "10275", "name": "Wyrmscraig bank chest", "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks"] },
    { "id": "11830", "name": "Ruins of Camdozaal (via Ice Mountain)", "wiki": ["https://oldschool.runescape.wiki/w/List_of_banks"] }
  ],
  "exclusions": [
    { "name": "Woodcutting Leprechaun", "reason": "Variable location; explicitly deferred." },
    { "name": "Tutorial Island bank", "reason": "Onboarding-only and absent from the walkable chunk registry." },
    { "name": "The Node bank", "reason": "Group Ironman onboarding-only and absent from the walkable chunk registry." },
    { "name": "Gravedigger Mausoleum", "reason": "Random-event-only internal service without a stable surface entrance." },
    { "name": "Tool leprechauns", "reason": "Produce-noting service, not a bank or deposit facility." },
    { "name": "Player-owned house servants", "reason": "Variable-location fetching service, not a fixed bank or deposit facility." },
    { "name": "Ferox Enclave mercenary", "reason": "Unnoting and token exchange service, not a deposit facility." },
    { "name": "Removed banks", "reason": "No longer accessible in normal play." }
  ]
}
```

- [ ] **Step 4: Implement the registry reader, validator, and label index**

Create `scripts/bank-locations.mjs`:

```js
import { readFileSync } from 'node:fs';

const REGISTRY_URL = new URL('../data/sources/bank-locations.json', import.meta.url);
const REFERENCE_KINDS = new Set(['physical', 'npc', 'entrance']);

const assertNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
};

export function readBankLocationRegistry(url = REGISTRY_URL) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function validateBankLocationRegistry(registry, { validChunkIds } = {}) {
  if (registry?.schemaVersion !== 1) throw new Error('Unsupported bank-location registry schema');
  if (!Array.isArray(registry.locations) || !Array.isArray(registry.labelOverrides)
    || !Array.isArray(registry.exclusions) || !Array.isArray(registry.sourceRevisions)) {
    throw new Error('Bank-location registry arrays are missing');
  }

  const ids = new Set();
  const names = new Set();
  for (const location of registry.locations) {
    assertNonEmptyString(location.id, 'Bank location id');
    assertNonEmptyString(location.name, `Bank location ${location.id} name`);
    if (!Number.isInteger(location.cx) || !Number.isInteger(location.cy)) {
      throw new Error(`Bank location ${location.id} coordinates must be integers`);
    }
    if (location.id !== String(location.cx * 256 + location.cy)) {
      throw new Error(`Canonical chunk id mismatch for bank location ${location.id}`);
    }
    if (ids.has(location.id)) throw new Error(`Duplicate bank location id: ${location.id}`);
    if (names.has(location.name)) throw new Error(`Duplicate bank location name: ${location.name}`);
    if (!REFERENCE_KINDS.has(location.referenceKind)) {
      throw new Error(`Unknown bank reference kind for ${location.id}: ${location.referenceKind}`);
    }
    if (location.referenceKind === 'entrance') assertNonEmptyString(location.accessVia, `Bank location ${location.id} accessVia`);
    if (!Array.isArray(location.facilities) || !location.facilities.length) throw new Error(`Bank location ${location.id} has no facilities`);
    if (!Array.isArray(location.wiki) || !location.wiki.length) throw new Error(`Bank location ${location.id} has no Wiki evidence`);
    if (validChunkIds && !validChunkIds.has(location.id)) throw new Error(`Bank location ${location.id} is not walkable`);
    ids.add(location.id);
    names.add(location.name);
  }

  for (const override of registry.labelOverrides) {
    assertNonEmptyString(override.id, 'Bank label override id');
    assertNonEmptyString(override.name, `Bank label override ${override.id} name`);
    if (names.has(override.name)) throw new Error(`Duplicate bank location name: ${override.name}`);
    if (!Array.isArray(override.wiki) || !override.wiki.length) throw new Error(`Bank label override ${override.id} has no Wiki evidence`);
    names.add(override.name);
  }

  for (const source of registry.sourceRevisions) {
    assertNonEmptyString(source.title, 'Bank source title');
    assertNonEmptyString(source.url, `Bank source ${source.title} URL`);
    if (!Number.isInteger(source.revision)) throw new Error(`Bank source ${source.title} revision must be an integer`);
  }
  for (const exclusion of registry.exclusions) {
    assertNonEmptyString(exclusion.name, 'Bank exclusion name');
    assertNonEmptyString(exclusion.reason, `Bank exclusion ${exclusion.name} reason`);
  }
  return registry;
}

export function bankLocationLabels(registry) {
  return new Map([
    ...registry.locations.map(({ id, name }) => [String(id), name]),
    ...registry.labelOverrides.map(({ id, name }) => [String(id), name]),
  ]);
}
```

- [ ] **Step 5: Run the registry tests**

Run: `npx vitest run scripts/bank-locations.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit the reviewed registry**

```bash
git add data/sources/bank-locations.json scripts/bank-locations.mjs scripts/bank-locations.test.ts
git commit -m "data: add reviewed bank location registry"
```

---

### Task 2: Chunk transform integration

**Files:**
- Modify: `scripts/chunk-content-transform.mjs`
- Modify: `scripts/chunk-content-transform.test.ts`
- Modify: `scripts/sync-chunk-content.mjs`
- Modify: `scripts/chunk-source.mjs`
- Modify: `scripts/chunk-source.test.ts`
- Modify: `data/contentBaseline.test.ts`
- Modify: `public/chunk-content.json`

**Interfaces:**
- Consumes: validated registry records from Task 1.
- Changes: `transformChunkContent(data, sourceManifest, namedLocationRegistry?, bankLocationRegistry?)`.
- Produces: `result.full.banks` containing sorted upstream plus reviewed ids.

- [ ] **Step 1: Write the failing transform-union test**

Add to `scripts/chunk-content-transform.test.ts`:

```ts
it('unions reviewed bank locations without changing upstream bank audit accounting', () => {
  const result = transformChunkContent({
    walkableChunks: [256, 512],
    chunks: { 256: { Nickname: 'Upstream bank' }, 512: { Nickname: 'Reviewed bank' } },
    slayerMonsters: {},
    rollingChunks: { bank: ['256'] },
  }, manifest, null, {
    locations: [{ id: '512' }],
  });

  expect(result.full.banks).toEqual(['256', '512']);
  expect(result.audit.categoryTotals.banks).toEqual({
    source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
  });
});
```

- [ ] **Step 2: Run the transform test and confirm it fails**

Run: `npx vitest run scripts/chunk-content-transform.test.ts -t "unions reviewed bank locations"`

Expected: FAIL because the fourth transform argument is ignored and the result is `['256']`.

- [ ] **Step 3: Union reviewed ids in the transform**

Replace `buildBanks` in `scripts/chunk-content-transform.mjs` with:

```js
function buildBanks(data, audit, bankLocationRegistry) {
  const set = new Set();
  for (const [index, raw] of (data.rollingChunks?.bank ?? []).entries()) {
    const sourceKey = `${raw}@${index}`, base = String(raw).split('-')[0];
    if (!/^\d+$/.test(base)) { audit.add('banks', sourceKey, 'excluded', 'non-walkable-content', []); continue; }
    const duplicate = set.has(base); set.add(base);
    audit.add('banks', sourceKey, duplicate || String(raw).includes('-') ? 'normalized' : 'imported', duplicate ? 'duplicate-deduped' : String(raw).includes('-') ? 'subarea-suffix-collapsed' : 'base-record', [base]);
  }
  for (const location of bankLocationRegistry?.locations ?? []) set.add(String(location.id));
  return [...set].sort(numericSort);
}

export function transformChunkContent(data, sourceManifest, namedLocationRegistry = null, bankLocationRegistry = null) {
```

This replaces only the existing declaration; keep its body and closing brace.
Within that body, replace the existing bank builder call with:

```js
const banks = buildBanks(data, audit, bankLocationRegistry);
```

Keep local registry records outside the upstream transform audit totals. The
validator in Task 1 is their audit boundary.

- [ ] **Step 4: Run the focused transform tests**

Run: `npx vitest run scripts/chunk-content-transform.test.ts`

Expected: PASS.

- [ ] **Step 5: Load and validate the registry in both generation paths**

In `scripts/sync-chunk-content.mjs`, import the Task 1 functions, then add:

```js
const bankLocationRegistry = readBankLocationRegistry();
validateBankLocationRegistry(bankLocationRegistry, {
  validChunkIds: new Set((data.walkableChunks ?? []).map(String)),
});
const result = transformChunkContent(data, manifest, namedLocationRegistry, bankLocationRegistry);
```

In `scripts/chunk-source.mjs`, read and validate the same registry inside
`writeApprovedChunkSource`, then call:

```js
const result = transformChunkContent(data, manifest, namedLocationRegistry, bankLocationRegistry);
```

- [ ] **Step 6: Pin the complete runtime baseline in failing tests**

In `scripts/chunk-source.test.ts`, import `readBankLocationRegistry`, pass it as
the fourth transform argument, and change the expected bank total from `101`
to `126`.

In `data/contentBaseline.test.ts`, change the expected bank total from `101`
to `126` and add:

```ts
const reviewedBankIds = [
  '5678', '6454', '6458', '6711', '6712', '6961', '7225', '8499',
  '8508', '8751', '8756', '8757', '8999', '9274', '10553', '11047',
  '11056', '11062', '11572', '11578', '12082', '12337', '12838',
  '12849', '14132',
];
expect(fullChunkContent.banks).toEqual(expect.arrayContaining(reviewedBankIds));
```

- [ ] **Step 7: Run the baseline tests and confirm generated content is stale**

Run: `npx vitest run scripts/chunk-source.test.ts data/contentBaseline.test.ts`

Expected: FAIL because `public/chunk-content.json` still contains 101 bank ids.

- [ ] **Step 8: Regenerate chunk content**

Run: `node scripts/sync-chunk-content.mjs`

Expected: `public/chunk-content.json` is regenerated with 126 sorted bank ids;
the lite output and upstream audit remain semantically unchanged.

- [ ] **Step 9: Run transform and content verification**

Run: `npx vitest run scripts/chunk-content-transform.test.ts scripts/chunk-source.test.ts data/contentBaseline.test.ts`

Run: `node scripts/sync-chunk-content.mjs --check`

Expected: both commands PASS.

- [ ] **Step 10: Commit transform integration and generated content**

```bash
git add scripts/chunk-content-transform.mjs scripts/chunk-content-transform.test.ts scripts/sync-chunk-content.mjs scripts/chunk-source.mjs scripts/chunk-source.test.ts data/contentBaseline.test.ts public/chunk-content.json
git commit -m "feat: merge reviewed banks into chunk content"
```

---

### Task 3: Registry-aware bank source generation

**Files:**
- Modify: `scripts/gen-banks.mjs`
- Create: `scripts/gen-banks.test.ts`
- Modify: `data/banks.ts`
- Modify: `utils/banks.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `bankLocationLabels(registry)` from Task 1.
- Produces: `buildBankDefinitions(doc, registry) -> Array<{ id: string; name: string }>`.
- Produces: `generateBankSource(doc, registry) -> string`.
- CLI: `node scripts/gen-banks.mjs [--check]`.

- [ ] **Step 1: Write failing generator tests**

Create `scripts/gen-banks.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readBankLocationRegistry } from './bank-locations.mjs';
import { buildBankDefinitions, generateBankSource } from './gen-banks.mjs';
import { generatedTextMatches } from './generated-text.mjs';

describe('bank source generator', () => {
  it('uses reviewed labels before chunk nicknames and emits all 126 banks', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const defs = buildBankDefinitions(doc, registry);
    const byId = Object.fromEntries(defs.map(def => [def.id, def.name]));

    expect(defs).toHaveLength(126);
    expect(byId['10275']).toBe('Wyrmscraig bank chest');
    expect(byId['11830']).toBe('Ruins of Camdozaal (via Ice Mountain)');
    expect(byId['14132']).toBe('Sangvesti and Castle Drakan banking');
  });

  it('matches the committed generated TypeScript', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    expect(generatedTextMatches(
      readFileSync('data/banks.ts', 'utf8'),
      generateBankSource(doc, registry),
    )).toBe(true);
  });
});
```

- [ ] **Step 2: Run the generator tests and confirm the missing-export failure**

Run: `npx vitest run scripts/gen-banks.test.ts`

Expected: FAIL because `buildBankDefinitions` and `generateBankSource` are not
exported and the committed bank file is stale.

- [ ] **Step 3: Refactor the generator into testable functions**

Update `scripts/gen-banks.mjs` to:

```js
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bankLocationLabels,
  readBankLocationRegistry,
  validateBankLocationRegistry,
} from './bank-locations.mjs';
import { generatedTextMatches } from './generated-text.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC_PATH = resolve(ROOT, 'public', 'chunk-content.json');
const OUTPUT_PATH = resolve(ROOT, 'data', 'banks.ts');

export function buildBankDefinitions(doc, registry) {
  const chunks = doc.chunks ?? {};
  const labels = bankLocationLabels(registry);
  const bankIds = [...new Set((doc.banks ?? []).map(String))];
  const defs = bankIds
    .map(id => ({ id, name: (labels.get(id) ?? chunks[id]?.n ?? chunks[id]?.name ?? `Bank ${id}`).trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const seen = new Set();
  for (const def of defs) {
    if (seen.has(def.name)) def.name = `${def.name} (${def.id})`;
    seen.add(def.name);
  }
  return defs;
}

export function generateBankSource(doc, registry) {
  const defs = buildBankDefinitions(doc, registry);
  const body = defs.map(def => `  { id: '${def.id}', name: ${JSON.stringify(def.name)} },`).join('\n');
  return `// AUTO-GENERATED by scripts/gen-banks.mjs — do not edit by hand.
// The ${defs.length} bankable locations (banks + deposit boxes) from the chunk
// dataset and reviewed local bank-location policy. Each is its own unlock in
// bank-locked modes, keyed by canonical chunk id "cx*256+cy".

export interface BankDef { id: string; name: string }

export const BANKS: BankDef[] = [
${body}
];

/** All bank ids, for the roll pool. */
export const BANK_IDS: string[] = BANKS.map((b) => b.id);

/** id → definition, for label lookups. */
export const BANK_BY_ID: Record<string, BankDef> =
  Object.fromEntries(BANKS.map((b) => [b.id, b]));

/** Canonical chunk id for a chunk coordinate — the bank's unlock key. */
export const bankId = (cx: number, cy: number): string => String(cx * 256 + cy);
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/gen-banks.mjs [--check]');
  const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8'));
  const registry = readBankLocationRegistry();
  validateBankLocationRegistry(registry, {
    validChunkIds: new Set(Object.keys(doc.chunks ?? {})),
  });
  const expected = generateBankSource(doc, registry);
  if (args.includes('--check')) {
    if (!existsSync(OUTPUT_PATH) || !generatedTextMatches(readFileSync(OUTPUT_PATH, 'utf8'), expected)) {
      throw new Error('Generated bank definitions are stale: data/banks.ts');
    }
    console.log('Generated bank definitions are current.');
  } else {
    writeFileSync(OUTPUT_PATH, expected);
    console.log('Wrote data/banks.ts with 126 banks.');
  }
}
```

- [ ] **Step 4: Add bank generation to the chunk workflow**

Update `package.json` scripts to:

```json
"banks:sync": "node scripts/gen-banks.mjs",
"banks:verify": "node scripts/gen-banks.mjs --check",
"chunks:sync": "node scripts/sync-chunk-content.mjs && node scripts/gen-banks.mjs",
"chunks:verify": "node scripts/sync-chunk-content.mjs --check && node scripts/gen-banks.mjs --check"
```

- [ ] **Step 5: Regenerate the player-facing bank pool**

Run: `npm run banks:sync`

Expected: `data/banks.ts` contains 126 definitions with reviewed labels.

- [ ] **Step 6: Strengthen bank pool tests**

Change the first test in `utils/banks.test.ts` to expect 126 entries and add:

```ts
it('contains every reviewed fixed-location addition with facility-first labels', () => {
  const additions = [
    '5678', '6454', '6458', '6711', '6712', '6961', '7225', '8499',
    '8508', '8751', '8756', '8757', '8999', '9274', '10553', '11047',
    '11056', '11062', '11572', '11578', '12082', '12337', '12838',
    '12849', '14132',
  ];
  expect(BANK_IDS).toEqual(expect.arrayContaining(additions));
  expect(BANK_BY_ID['10275'].name).toBe('Wyrmscraig bank chest');
  expect(BANK_BY_ID['11830'].name).toBe('Ruins of Camdozaal (via Ice Mountain)');
  expect(BANK_BY_ID['14132'].name).toBe('Sangvesti and Castle Drakan banking');
  expect(BANKS.some(bank => /Woodcutting Leprechaun/i.test(bank.name))).toBe(false);
});
```

- [ ] **Step 7: Run generator and bank tests**

Run: `npx vitest run scripts/gen-banks.test.ts utils/banks.test.ts utils/runelitePluginParity.test.ts`

Run: `npm run banks:verify`

Expected: all commands PASS.

- [ ] **Step 8: Commit the registry-aware generator and output**

```bash
git add scripts/gen-banks.mjs scripts/gen-banks.test.ts data/banks.ts utils/banks.test.ts package.json
git commit -m "feat: generate complete bank unlock pool"
```

---

### Task 4: Dynamic totals and player-facing release note

**Files:**
- Modify: `components/ShareModal.tsx`
- Modify: `components/ShareModal.test.tsx`
- Modify: `data/changelog.ts`
- Modify: `data/changelog.test.ts`
- Modify: `ROADMAP.md`

**Interfaces:**
- Consumes: `BANK_IDS.length` from generated `data/banks.ts`.
- Produces: copied summary text `Banks: <owned>/126`.

- [ ] **Step 1: Write the failing ShareModal total test**

Import `BANK_IDS` in `components/ShareModal.test.tsx`, reset bank state in
`beforeEach`, and add:

```ts
it('uses the generated bank pool size in the copied summary', async () => {
  mockGame.current.unlocks.banks = ['5678', '6454'];
  const view = render(<ShareModal onClose={vi.fn()} />);

  fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  expect(writeText.mock.calls[0][0]).toContain(`Banks: 2/${BANK_IDS.length}`);
  expect(BANK_IDS).toHaveLength(126);
});
```

Also change the mocked unlock field to `banks: [] as string[]` so assigning
reviewed bank ids remains type-safe.

- [ ] **Step 2: Run the focused UI test and confirm it fails**

Run: `npx vitest run components/ShareModal.test.tsx -t "generated bank pool size"`

Expected: FAIL because the copied summary still contains `/100`.

- [ ] **Step 3: Replace the hard-coded total**

In `components/ShareModal.tsx`, import `BANK_IDS` from `../data/banks` and
change the summary line to:

```ts
🏦 Banks: ${(unlocks.banks ?? []).length}/${BANK_IDS.length}
```

- [ ] **Step 4: Write the failing changelog test**

At the top of `data/changelog.test.ts`, update the newest-release expectation
and add:

```ts
it('announces the complete reviewed bank pool', () => {
  expect(LATEST_CHANGELOG).toMatchObject({
    id: '2026-08-08-complete-bank-pool',
    title: 'Every Bank Has Its Place',
    date: '2026-08-08',
  });
  expect(LATEST_CHANGELOG.sections.fixed).toEqual(expect.arrayContaining([
    'Bank-locked modes now include every reviewed fixed-location bank, chest, deposit box, and deposit service, including Wyrmscraig and Sangvesti access.',
    'Bank rolls now use clear facility names for reviewed underground and instanced access chunks.',
  ]));
});
```

Update the existing `LATEST_CHANGELOG` assertions so they locate the
`2026-08-04-polished-chunk-info` release by id instead of treating it as the
latest release.

- [ ] **Step 5: Run the changelog test and confirm it fails**

Run: `npx vitest run data/changelog.test.ts`

Expected: FAIL because the 2026-08-08 release does not exist.

- [ ] **Step 6: Add the newest-first changelog release**

Add to the beginning of `CHANGELOG_RELEASES` in `data/changelog.ts`:

```ts
{
  id: '2026-08-08-complete-bank-pool',
  title: 'Every Bank Has Its Place',
  date: '2026-08-08',
  sections: {
    fixed: [
      'Bank-locked modes now include every reviewed fixed-location bank, chest, deposit box, and deposit service, including Wyrmscraig and Sangvesti access.',
      'Bank rolls now use clear facility names for reviewed underground and instanced access chunks.',
    ],
  },
},
```

- [ ] **Step 7: Run the UI and changelog tests**

Run: `npx vitest run components/ShareModal.test.tsx data/changelog.test.ts`

Run: `npm run changelog:verify`

Expected: all commands PASS.

- [ ] **Step 8: Commit dynamic totals and release notes**

Before committing, change the completed roadmap note from `X/100` to
`X/126` in `ROADMAP.md`.

```bash
git add components/ShareModal.tsx components/ShareModal.test.tsx data/changelog.ts data/changelog.test.ts ROADMAP.md
git commit -m "fix: show the complete bank pool total"
```

---

### Task 5: End-to-end verification

**Files:**
- Verify only; make no source changes unless a check reveals a defect.

**Interfaces:**
- Consumes: all outputs from Tasks 1-4.
- Produces: evidence that generation, runtime data, UI totals, and RuneLite parity agree on the 126-bank set.

- [ ] **Step 1: Verify deterministic generated outputs**

Run: `npm run chunks:verify`

Expected: chunk content and bank definitions are current.

- [ ] **Step 2: Run focused feature coverage**

Run:

```bash
npx vitest run scripts/bank-locations.test.ts scripts/gen-banks.test.ts scripts/chunk-content-transform.test.ts scripts/chunk-source.test.ts data/contentBaseline.test.ts utils/banks.test.ts utils/runelitePluginParity.test.ts components/ShareModal.test.tsx data/changelog.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 4: Run static and production verification**

Run: `npm run typecheck`

Run: `npm run build`

Run: `npm run changelog:verify`

Expected: all commands exit successfully.

- [ ] **Step 5: Inspect the final change set**

Run: `git status --short`

Run: `git diff --check HEAD~4..HEAD`

Expected: only the planned feature files and the user's pre-existing untracked
plan files are present; no whitespace errors are reported.
