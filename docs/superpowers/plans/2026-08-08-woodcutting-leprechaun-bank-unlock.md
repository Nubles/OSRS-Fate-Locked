# Virtual Woodcutting Leprechaun Bank Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one virtual `Woodcutting Leprechaun (Forestry)` bank unlock while keeping the physical chunk registry unchanged.

**Architecture:** The reviewed bank-location registry gains a `virtualLocations` collection for services with no canonical chunk. The chunk transform continues to consume only physical `locations`, while the bank generator appends virtual definitions to the player-facing unlock pool. Existing numeric physical bank ids retain their `String(cx * 256 + cy)` contract.

**Tech Stack:** JSON, JavaScript ES modules, generated TypeScript, Vitest, React-facing data, and the existing npm verification scripts.

## Global Constraints

- The registry keeps exactly 126 physical canonical bank/deposit chunk ids.
- The generated player-facing bank pool contains exactly 127 ids: the 126 physical ids plus `woodcutting-leprechaun`.
- The virtual id is exactly `woodcutting-leprechaun` and its label is exactly `Woodcutting Leprechaun (Forestry)`.
- The virtual unlock contributes zero ids to `public/chunk-content.json`, `data/chunkContentLite.ts`, or the chunk transform audit.
- The virtual access description is exactly `Variable Forestry woodcutting area; no fixed chunk`.
- The Woodcutting Leprechaun is removed from registry exclusions once it is represented as a virtual unlock.
- Physical bank ids continue to use the exact formula `String(cx * 256 + cy)`.
- The pinned `chunkpicker-chunkinfo-export.json.gz` artifact remains unchanged.
- Evidence for the virtual entry uses the OSRS Wiki Forestry event URL and its pinned source revision.
- Generated outputs support deterministic `--check` verification.

---

## File Structure

- Modify `data/sources/bank-locations.json`: add the Forestry source revision and one virtual location; remove the now-resolved exclusion.
- Modify `scripts/bank-locations.mjs`: validate virtual ids, access metadata, uniqueness, and evidence; export virtual definitions for generation.
- Modify `scripts/bank-locations.test.ts`: add registry, negative-validation, and zero-physical-contribution tests.
- Modify `scripts/gen-banks.mjs`: append validated virtual definitions after the sorted physical definitions.
- Modify `scripts/gen-banks.test.ts`: pin the 127-entry generated pool and virtual label.
- Regenerate `data/banks.ts`: produce 126 physical definitions followed by the virtual definition.
- Modify `utils/banks.test.ts`: distinguish 126 physical ids from the 127 total unlock ids and assert the virtual id.
- Modify `utils/completion.test.ts`: update the derived completion denominator from 972 to 973.
- Modify `data/changelog.ts` and `data/changelog.test.ts`: describe the virtual Forestry unlock in the existing 2026-08-08 release.
- Modify `ROADMAP.md`: describe 126 physical chunks plus one virtual unlock and update the visible total from 126 to 127.
- Do not modify `public/chunk-content.json`, `data/chunkContentLite.ts`, or `data/sources/chunk-content-transform-audit.json` except to prove their bank arrays remain physically 126.

### Task 1: Add and validate the virtual registry entry

**Files:**
- Modify: `data/sources/bank-locations.json`
- Modify: `scripts/bank-locations.mjs`
- Test: `scripts/bank-locations.test.ts`

**Interfaces:**
- Existing `validateBankLocationRegistry(registry, { validChunkIds, validBankIds })` continues to validate physical locations and label overrides.
- Add `bankVirtualLocations(registry) -> Array<{ id: string, name: string, accessVia: string, facilities: string[], wiki: string[] }>`.
- `bankLocationLabels(registry)` remains limited to physical locations and physical label overrides.

- [ ] **Step 1: Add the failing virtual-registry tests**

In `scripts/bank-locations.test.ts`, add assertions that the real registry contains exactly one virtual entry with:

```ts
expect(registry.virtualLocations).toEqual([
  expect.objectContaining({
    id: 'woodcutting-leprechaun',
    name: 'Woodcutting Leprechaun (Forestry)',
    referenceKind: 'virtual',
    accessVia: 'Variable Forestry woodcutting area; no fixed chunk',
    facilities: ['Woodcutting Leprechaun'],
    wiki: ['https://oldschool.runescape.wiki/w/Forestry_event'],
  }),
]);
expect(registry.locations.some(location => location.id === 'woodcutting-leprechaun')).toBe(false);
expect(registry.exclusions.some(exclusion => exclusion.name === 'Woodcutting Leprechaun')).toBe(false);
```

Add negative cases proving validation rejects a numeric virtual id, a duplicate virtual id, a virtual id colliding with a physical location, blank `accessVia`, blank facilities, blank evidence, and evidence URLs absent from `sourceRevisions`.

Add an API assertion:

```ts
expect(bankVirtualLocations(registry)).toHaveLength(1);
expect(bankVirtualLocations(registry)[0].id).toBe('woodcutting-leprechaun');
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run:

```bash
npx vitest run scripts/bank-locations.test.ts
```

Expected: failures because `virtualLocations` and `bankVirtualLocations` do not yet exist and the current validator has no virtual-entry contract.

- [ ] **Step 3: Add the reviewed source and virtual registry record**

Add this source revision to `sourceRevisions`:

```json
{ "title": "Forestry event", "revision": 14430593, "url": "https://oldschool.runescape.wiki/w/Forestry_event" }
```

Add this collection before `labelOverrides`:

```json
"virtualLocations": [
  {
    "id": "woodcutting-leprechaun",
    "cx": null,
    "cy": null,
    "name": "Woodcutting Leprechaun (Forestry)",
    "referenceKind": "virtual",
    "accessVia": "Variable Forestry woodcutting area; no fixed chunk",
    "facilities": ["Woodcutting Leprechaun"],
    "wiki": ["https://oldschool.runescape.wiki/w/Forestry_event"]
  }
],
```

Remove the `Woodcutting Leprechaun` object from `exclusions`; preserve every other exclusion unchanged.

- [ ] **Step 4: Implement virtual validation and the generator interface**

In `scripts/bank-locations.mjs`:

```js
const VIRTUAL_BANK_ID = /^[a-z][a-z0-9-]*$/;

const assertVirtualBankId = (value, label) => {
  assertNonEmptyString(value, label);
  if (!VIRTUAL_BANK_ID.test(value)) throw new Error(`${label} must be a stable virtual bank id`);
};
```

Require `registry.virtualLocations` to be an array. Validate each virtual entry as `referenceKind === 'virtual'`, a stable nonnumeric id, nonempty name/accessVia/facilities, Wiki evidence covered by `sourceRevisions`, unique id/name, and no collision with physical ids or label override ids. Virtual entries must not be checked against `validChunkIds` or `validBankIds`.

Export:

```js
export function bankVirtualLocations(registry) {
  return registry.virtualLocations.map(({ id, name, accessVia, facilities, wiki }) => ({
    id: String(id), name, accessVia, facilities, wiki,
  }));
}
```

- [ ] **Step 5: Run the focused tests to verify GREEN**

Run:

```bash
npx vitest run scripts/bank-locations.test.ts
```

Expected: all registry tests pass, including every malformed virtual-entry rejection.

- [ ] **Step 6: Commit Task 1**

```bash
git add data/sources/bank-locations.json scripts/bank-locations.mjs scripts/bank-locations.test.ts
git commit -m "feat: register virtual woodcutting leprechaun unlock"
```

### Task 2: Generate the 127-entry bank unlock pool

**Files:**
- Modify: `scripts/gen-banks.mjs`
- Test: `scripts/gen-banks.test.ts`
- Regenerate: `data/banks.ts`
- Test: `utils/banks.test.ts`
- Test: `utils/completion.test.ts`

**Interfaces:**
- Consume `bankVirtualLocations(registry)` from Task 1.
- Keep `buildBankDefinitions(doc, registry)` returning `Array<{ id: string, name: string }>`.
- Return physical definitions sorted by name, followed by virtual definitions in registry order.

- [ ] **Step 1: Write failing generator and runtime tests**

Change generator expectations from 126 to 127 and add:

```ts
expect(defs.at(-1)).toEqual({
  id: 'woodcutting-leprechaun',
  name: 'Woodcutting Leprechaun (Forestry)',
});
expect(BANK_BY_ID['woodcutting-leprechaun'].name).toBe('Woodcutting Leprechaun (Forestry)');
expect(BANK_IDS.filter(id => /^\d+$/.test(id))).toHaveLength(126);
expect(COMPLETION_DENOMINATOR).toBe(973);
```

Add a test that the generated virtual id is absent from `public/chunk-content.json`'s `banks` array.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```bash
npx vitest run scripts/gen-banks.test.ts utils/banks.test.ts utils/completion.test.ts
```

Expected: failures for the missing virtual definition and stale 126/972 expectations.

- [ ] **Step 3: Append virtual definitions in the generator**

In `buildBankDefinitions`, build the existing physical definitions exactly as today, then append:

```js
const virtualDefs = bankVirtualLocations(registry)
  .map(({ id, name }) => ({ id, name: name.trim() }));
return [...physicalDefs, ...virtualDefs];
```

Keep duplicate-name protection across the combined array. Update the generated header to describe 127 total unlocks with 126 physical chunk entries plus virtual registry entries, and keep `--check` based on `generatedTextMatches`.

- [ ] **Step 4: Regenerate and verify the generated data**

Run:

```bash
npm run banks:sync
npm run banks:verify
npx vitest run scripts/gen-banks.test.ts utils/banks.test.ts utils/completion.test.ts
```

Expected: `data/banks.ts` contains 127 entries, its final entry is the virtual unlock, and focused tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add scripts/gen-banks.mjs scripts/gen-banks.test.ts data/banks.ts utils/banks.test.ts utils/completion.test.ts
git commit -m "feat: include virtual woodcutting leprechaun unlock"
```

### Task 3: Update player-facing copy and roadmap accounting

**Files:**
- Modify: `data/changelog.ts`
- Test: `data/changelog.test.ts`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Write the failing changelog test**

Extend the existing latest-release expectation with this exact fixed note:

```ts
'The temporary Forestry Woodcutting Leprechaun is represented as one virtual bank unlock without a fixed chunk.',
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run:

```bash
npx vitest run data/changelog.test.ts
```

Expected: the new note/accounting assertions fail before the copy changes.

- [ ] **Step 3: Implement the copy updates**

Add the exact changelog sentence to the existing `2026-08-08-complete-bank-pool` fixed section. Replace the roadmap's `Each of the 126 canonical...` wording with `The bank pool contains 126 physical canonical bank/deposit chunks plus 1 virtual Forestry unlock`, and replace `X/126` with `X/127` where it describes the player-facing bank pool.

- [ ] **Step 4: Run the focused copy checks**

Run:

```bash
npx vitest run data/changelog.test.ts
npm run changelog:verify
rg -n "126 physical canonical bank/deposit chunks plus 1 virtual Forestry unlock|X/127" ROADMAP.md
```

Expected: the tests and changelog verifier pass, and both roadmap phrases are present.

- [ ] **Step 5: Commit Task 3**

```bash
git add data/changelog.ts data/changelog.test.ts ROADMAP.md
git commit -m "docs: describe virtual woodcutting bank unlock"
```

### Task 4: End-to-end verification and generated-output audit

**Files:**
- No planned source edits; only verify the committed outputs.

- [ ] **Step 1: Verify physical chunk output did not change**

Run:

```bash
npm run chunks:verify
```

Expected: chunk content outputs and generated bank definitions are current; the physical bank array remains 126 and `woodcutting-leprechaun` is absent from `public/chunk-content.json`.

- [ ] **Step 2: Run the full release verification**

Run:

```bash
npm run release:verify
```

Expected: changelog verification, the full test suite, typecheck, content verification, and production build all exit successfully. Existing Vite/Node warnings are non-failing diagnostics.

- [ ] **Step 3: Audit the final diff**

Run:

```bash
git diff --check HEAD~3..HEAD
git diff --name-only HEAD~3..HEAD
```

Confirm that `public/chunk-content.json`, `data/chunkContentLite.ts`, and `data/sources/chunk-content-transform-audit.json` have no semantic changes, and that no pinned upstream artifact changed.

