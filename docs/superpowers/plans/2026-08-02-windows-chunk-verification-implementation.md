# Windows Chunk Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chunk generation verification ignore CRLF-versus-LF checkout conversion while still failing on every real generated-content difference.

**Architecture:** Add one pure generated-text comparison helper that normalizes only newline encoding. Keep source hashing byte-exact and keep generated serialization unchanged; use the helper solely at the checked-out text comparison boundary.

**Tech Stack:** Node.js ESM, Vitest, existing `sync-chunk-content.mjs` generator.

## Global Constraints

- Do not change global or repository Git line-ending configuration.
- Do not weaken raw Chunk Picker byte-length or SHA-256 verification.
- Normalize only `\r\n` and lone `\r` to `\n` for generated text comparison.
- Real content, whitespace, ordering, punctuation, and malformed-data changes must still fail.
- `npm run chunks:verify` remains read-only.
- Use tests before implementation and commit after the independently passing task.

---

## File Structure

- `scripts/generated-text.mjs`: pure newline normalization and equality helper.
- `scripts/generated-text.test.ts`: LF, CRLF, lone-CR, and real-drift regression tests.
- `scripts/sync-chunk-content.mjs`: uses the helper when checking generated text outputs.

### Task 1: Newline-stable generated-text comparison

**Files:**
- Create: `scripts/generated-text.mjs`
- Create: `scripts/generated-text.test.ts`
- Modify: `scripts/sync-chunk-content.mjs`

**Interfaces:**
- Consumes: actual checked-out text and canonical generator text as strings.
- Produces: `normalizeGeneratedText(value: string): string` and `generatedTextMatches(actual: string, expected: string): boolean`.

- [ ] **Step 1: Write the failing pure comparison tests**

Create `scripts/generated-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  generatedTextMatches,
  normalizeGeneratedText,
} from './generated-text.mjs';

describe('generated text comparison', () => {
  it('treats LF, CRLF, and lone CR as the same newline', () => {
    const expected = '{\n  "count": 140\n}\n';
    expect(generatedTextMatches('{\r\n  "count": 140\r\n}\r\n', expected)).toBe(true);
    expect(generatedTextMatches('{\r  "count": 140\r}\r', expected)).toBe(true);
    expect(normalizeGeneratedText(expected)).toBe(expected);
  });

  it('still rejects content, spacing, order, and trailing-newline drift', () => {
    const expected = '{\n  "count": 140\n}\n';
    expect(generatedTextMatches('{\n  "count": 139\n}\n', expected)).toBe(false);
    expect(generatedTextMatches('{\n "count": 140\n}\n', expected)).toBe(false);
    expect(generatedTextMatches('{\n  "count": 140\n}', expected)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```powershell
npx vitest run scripts/generated-text.test.ts
```

Expected: FAIL because `scripts/generated-text.mjs` does not exist.

- [ ] **Step 3: Implement the minimal pure helper**

Create `scripts/generated-text.mjs`:

```js
export const normalizeGeneratedText = (value) =>
  String(value).replace(/\r\n?/g, '\n');

export const generatedTextMatches = (actual, expected) =>
  normalizeGeneratedText(actual) === normalizeGeneratedText(expected);
```

- [ ] **Step 4: Route only generated-output checks through the helper**

Import the helper in `scripts/sync-chunk-content.mjs`:

```js
import { generatedTextMatches } from './generated-text.mjs';
```

Replace `check(expected)` with:

```js
function check(expected) {
  const stale = expected
    .filter(([path, text]) => !existsSync(path)
      || !generatedTextMatches(readFileSync(path, 'utf8'), text))
    .map(([path]) => path);
  if (stale.length) {
    throw new Error(`Chunk content outputs are stale:\n${stale
      .map((path) => `  ${path}`)
      .join('\n')}`);
  }
}
```

Do not use this helper in `scripts/chunk-source.mjs`; source bytes remain hash-exact.

- [ ] **Step 5: Run unit and real repository verification**

Run:

```powershell
npx vitest run scripts/generated-text.test.ts scripts/chunk-source.test.ts scripts/chunk-content-transform.test.ts
npm run chunks:verify
```

Expected: PASS. On the current Windows checkout, `chunks:verify` must stop reporting `data/chunkContentLite.ts` and `data/sources/chunk-content-transform-audit.json` as stale solely because of CRLF conversion.

- [ ] **Step 6: Prove a real edit still fails without changing committed files**

In the unit test only, retain the changed-count assertion from Step 1. Do not modify a generated repository artifact to test failure. Run:

```powershell
npx vitest run scripts/generated-text.test.ts
```

Expected: PASS, including all three `false` drift assertions.

- [ ] **Step 7: Commit the verification fix**

```powershell
git add scripts/generated-text.mjs scripts/generated-text.test.ts scripts/sync-chunk-content.mjs
git commit -m "fix: normalize line endings in chunk verification"
```

### Task 2: Final coordinated release gate

**Files:**
- Verify only; no file changes expected.

**Interfaces:**
- Consumes: the completed overlap plan, source/geography plan, and newline-stable verifier.
- Produces: evidence that all three independently tested changes coexist.

- [ ] **Step 1: Confirm only intended files differ from the implementation base**

Run:

```powershell
git status --short
git diff --check HEAD~7..HEAD
```

Expected: no unstaged implementation files and no whitespace errors. Preserve the unrelated `docs/superpowers/plans/2026-08-02-fate-locked-discord-server.md` file if it remains untracked.

- [ ] **Step 2: Run the complete release verification**

Run:

```powershell
npm run release:verify
```

Expected: changelog verification, all tests, type-check, offline content verification, and production build all exit 0.

- [ ] **Step 3: Recheck deterministic source and working-tree state**

Run:

```powershell
npm run chunks:source-verify
npm run chunks:verify
git status --short
```

Expected: both verification commands exit 0 and generate no new tracked changes.
