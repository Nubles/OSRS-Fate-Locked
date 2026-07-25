# Tracker Portable Verification and Reference Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make offline release verification portable across LF and CRLF checkouts and make the renamed OSRS RuneLite repository canonical in maintained tracker guidance.

**Architecture:** Normalize line endings only inside generated-output comparisons, leaving generation and files untouched. Treat repository identity as maintained operational metadata: update executable guidance and current issue links, while preserving historical commit messages and the design’s description of the rename.

**Tech Stack:** Node.js ESM, TypeScript, Vitest, npm scripts, Markdown, GitHub Actions.

## Global Constraints

- Canonical repository: `Nubles/OSRS-Fate-Locked-Runelite`.
- Canonical clone URL: `https://github.com/Nubles/OSRS-Fate-Locked-Runelite.git`.
- Normalize `\r\n` and lone `\r` to `\n` only at comparison boundaries.
- Do not trim whitespace, normalize semantic content, rewrite generated files during `--check`, or weaken drift detection.
- README build guidance must use the standard standalone build: `gradle clean test jar --no-daemon` or `gradle build`.
- Do not claim a Gradle wrapper or `shadowJar` task exists in the canonical standalone plugin.
- Do not rewrite historical Git commit messages.
- Cross-repository workflow checkout and exact mirror pin are implemented by the current-main integration rebuild plan, not guessed in this cleanup branch.

---

## File Structure

- `scripts/sync-achievement-diaries.mjs`: comparison-boundary EOL normalization.
- `scripts/sync-achievement-diaries.test.ts`: LF, CRLF, drift, multi-file, and read-only contracts.
- `.claude/skills/fate-locked-workflow/SKILL.md`: current maintainer commands and repository identity.
- `README.md`: canonical companion and actual standalone build instructions.
- `ROADMAP.md`: canonical companion repository link.
- `docs/superpowers/specs/2026-07-13-nearest-bank-shop-hud-design.md`: still-executable source-of-truth guidance.
- `docs/superpowers/plans/2026-07-13-nearest-bank-shop-hud.md`: still-executable cross-repository workflow guidance.

### Task 1: Accept equivalent LF and CRLF generated output

**Files:**
- Modify: `scripts/sync-achievement-diaries.mjs`
- Modify: `scripts/sync-achievement-diaries.test.ts`

**Interfaces:**
- Produces: `normalizeComparisonEol(value: string): string`
- Preserves: `renderDiaryTasks`, `renderTaskIdMigrations`, `checkGeneratedDiary`, `checkGeneratedDiaryFiles`, and `runDiaryMain` public names.

- [ ] **Step 1: Add failing in-memory line-ending tests**

Add:

```ts
const asCrlf = (value: string): string => value.replace(/\n/g, '\r\n');

it('accepts equivalent LF and CRLF output for both generated files', () => {
  const diary = renderDiaryTasks(SIX_TASK_SNAPSHOT);
  const migrations = renderTaskIdMigrations(SIX_TASK_SNAPSHOT);

  expect(checkGeneratedDiary(
    SIX_TASK_SNAPSHOT,
    diary,
    migrations,
  )).toEqual({ ok: true, errors: [] });

  expect(checkGeneratedDiary(
    SIX_TASK_SNAPSHOT,
    asCrlf(diary),
    asCrlf(migrations),
  )).toEqual({ ok: true, errors: [] });
});

it('rejects semantic drift after line-ending normalization', () => {
  const diary = renderDiaryTasks(SIX_TASK_SNAPSHOT)
    .replace("id: 'fal_easy_1'", "id: 'fal_easy_changed'");
  expect(checkGeneratedDiary(
    SIX_TASK_SNAPSHOT,
    asCrlf(diary),
    asCrlf(renderTaskIdMigrations(SIX_TASK_SNAPSHOT)),
  )).toEqual({
    ok: false,
    errors: ['data/diaryTasks.ts is out of date'],
  });
});
```

- [ ] **Step 2: Extend the explicit-file test to cover CRLF and read-only behavior**

After writing the valid fixture, overwrite both outputs with CRLF versions:

```ts
const crlfDiaryText = asCrlf(diaryText);
const crlfMigrationText = asCrlf(migrationText);
writeFileSync(diaryPath, crlfDiaryText, 'utf8');
writeFileSync(migrationPath, crlfMigrationText, 'utf8');

expect(checkGeneratedDiaryFiles({
  snapshotPath,
  diaryPath,
  migrationPath,
})).toEqual({ ok: true, errors: [] });
expect(readFileSync(diaryPath, 'utf8')).toBe(crlfDiaryText);
expect(readFileSync(migrationPath, 'utf8')).toBe(crlfMigrationText);
```

Then create real drift in both:

```ts
const staleDiaryText = crlfDiaryText + 'stale diary byte';
const staleMigrationText = crlfMigrationText + 'stale migration byte';
```

Assert both errors and byte-identical post-check files.

- [ ] **Step 3: Run the focused test and verify failure**

Run: `npx vitest run scripts/sync-achievement-diaries.test.ts`

Expected: FAIL because `checkGeneratedDiary` performs byte-string equality.

- [ ] **Step 4: Normalize only the comparison operands**

Add:

```js
export const normalizeComparisonEol = value =>
  value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
```

Change only the two comparisons:

```js
if (
  normalizeComparisonEol(diaryOutput)
  !== normalizeComparisonEol(renderDiaryTasks(snapshot))
) {
  errors.push('data/diaryTasks.ts is out of date');
}
if (
  normalizeComparisonEol(migrationOutput)
  !== normalizeComparisonEol(renderTaskIdMigrations(snapshot))
) {
  errors.push('utils/taskIdMigrations.ts is out of date');
}
```

Do not call this helper from a renderer, file read, or file write.

- [ ] **Step 5: Run focused and CLI-entry tests**

Run: `npx vitest run scripts/sync-achievement-diaries.test.ts`

Expected: PASS, including exact exit codes and no network access.

- [ ] **Step 6: Run the failing Windows command**

Run: `npm run diary:verify`

Expected: exit 0 with `[diary:verify] generated files are current.` even when Git exposes the tracked generated files as CRLF.

- [ ] **Step 7: Commit**

```bash
git add scripts/sync-achievement-diaries.mjs scripts/sync-achievement-diaries.test.ts
git commit -m "fix: make diary verification line-ending portable"
```

### Task 2: Replace operational old-name references

**Files:**
- Modify: `.claude/skills/fate-locked-workflow/SKILL.md`
- Modify: `ROADMAP.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-13-nearest-bank-shop-hud-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-nearest-bank-shop-hud.md`
- Create: `scripts/repositoryReferences.test.ts`

**Interfaces:**
- Produces a regression that scans maintained operational files for `Nubles/RS3-Fate-Locked-Runelite`.
- Does not scan Git history or the approved rename design’s sentence describing the old value.

- [ ] **Step 1: Add a failing maintained-reference test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const maintained = [
  '.claude/skills/fate-locked-workflow/SKILL.md',
  'README.md',
  'ROADMAP.md',
  'docs/superpowers/specs/2026-07-13-nearest-bank-shop-hud-design.md',
  'docs/superpowers/plans/2026-07-13-nearest-bank-shop-hud.md',
];

describe('canonical RuneLite repository references', () => {
  it.each(maintained)('%s does not use the retired repository name', path => {
    const content = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    expect(content).not.toContain('Nubles/RS3-Fate-Locked-Runelite');
    expect(content).not.toContain(
      'github.com/Nubles/RS3-Fate-Locked-Runelite',
    );
  });
});
```

- [ ] **Step 2: Run the test and verify the stale files are named**

Run: `npx vitest run scripts/repositoryReferences.test.ts`

Expected: FAIL for the workflow skill, roadmap, and two 2026-07-13 operational documents.

- [ ] **Step 3: Update exact repository identifiers**

Replace current operational occurrences with:

```text
Nubles/OSRS-Fate-Locked-Runelite
https://github.com/Nubles/OSRS-Fate-Locked-Runelite
https://api.github.com/repos/Nubles/OSRS-Fate-Locked-Runelite/actions/runs?per_page=1
```

In the old plan, replace the obsolete `scratchpad/plugin` instruction with:

```markdown
- Source of truth: `Nubles/OSRS-Fate-Locked-Runelite`. Build and test the
  standalone commit first, then mirror the exact pinned commit into
  `runelite-plugin/` and update `runelite-plugin/SOURCE_COMMIT`; verify with
  `npm run runelite:mirror-check`.
```

The `runelite:mirror-check` command is delivered by the integration rebuild before this historical plan becomes executable again.

- [ ] **Step 4: Correct README companion/build guidance**

Replace the current RuneLite section with copy containing:

````markdown
## RuneLite plugin

The maintained companion is
[`Nubles/OSRS-Fate-Locked-Runelite`](https://github.com/Nubles/OSRS-Fate-Locked-Runelite).
Its source is mirrored under `runelite-plugin/` at the commit recorded in
`runelite-plugin/SOURCE_COMMIT` once the current integration branch lands.

Build the standalone plugin with JDK 11 and Gradle:

```bash
gradle clean test jar --no-daemon
```

Plugin Hub installation is the supported player path. The standard standalone
build does not provide a repository Gradle wrapper or a `shadowJar` task.
````

Do not claim the current unpinned mirror already has `SOURCE_COMMIT`; phrase the sentence conditionally until the integration rebuild merges.

- [ ] **Step 5: Run the reference regression**

Run: `npx vitest run scripts/repositoryReferences.test.ts`

Expected: PASS.

- [ ] **Step 6: Review all remaining old-name text**

Run:

```bash
rg -n --hidden "Nubles/RS3-Fate-Locked-Runelite|github.com/Nubles/RS3-Fate-Locked-Runelite" . --glob "!.git/**" --glob "!node_modules/**"
```

Expected: only the approved 2026-07-25 rename design/spec language that explicitly describes replacement of the old value. No executable command, active URL, README, roadmap, maintainer skill, or workflow target may remain.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/fate-locked-workflow/SKILL.md README.md ROADMAP.md docs/superpowers/specs/2026-07-13-nearest-bank-shop-hud-design.md docs/superpowers/plans/2026-07-13-nearest-bank-shop-hud.md scripts/repositoryReferences.test.ts
git commit -m "docs: canonicalize RuneLite repository guidance"
```

### Task 3: Correct issue source links and verify the full Windows release gate

**Files:**
- GitHub metadata: tracker issues #7, #8, #9, and #10.
- No additional local source file is required.

**Interfaces:**
- Produces current issue links to `Nubles/OSRS-Fate-Locked-Runelite`.

- [ ] **Step 1: Inspect each issue body before editing**

For issues #7 through #10, record any body or comment link beginning with:

```text
https://github.com/Nubles/RS3-Fate-Locked-Runelite
```

Expected: only current source/reference links are edited; quoted historical discussion remains intact when changing it would alter meaning.

- [ ] **Step 2: Replace current source links**

Use the canonical prefix:

```text
https://github.com/Nubles/OSRS-Fate-Locked-Runelite
```

Do not change issue state in this task. Issue closure follows the implementation/evidence plan for that issue.

- [ ] **Step 3: Run the complete release gate on Windows**

Run: `npm run release:verify`

Expected:

1. all Vitest files pass;
2. TypeScript emits no errors;
3. `diary:verify` reports current files instead of CRLF drift;
4. content baseline tests pass;
5. Vite build completes.

- [ ] **Step 4: Confirm `--check` did not write tracked files**

Run:

```bash
git status --short
git diff -- data/diaryTasks.ts utils/taskIdMigrations.ts
```

Expected: no semantic generated-file diff. If the worktree already has known line-ending-only modifications, compare blob hashes:

```bash
git hash-object data/diaryTasks.ts
git rev-parse HEAD:data/diaryTasks.ts
git hash-object utils/taskIdMigrations.ts
git rev-parse HEAD:utils/taskIdMigrations.ts
```

Expected: each working-file hash matches its corresponding `HEAD` blob hash.

- [ ] **Step 5: Record verification evidence**

Use the PR description:

```text
Portable verification:
- LF generated output: accepted
- CRLF-equivalent output: accepted
- semantic drift: rejected
- simultaneous Diary/migration drift: both reported
- --check: read-only
- npm run release:verify on Windows: passed

Repository identity:
- canonical companion: Nubles/OSRS-Fate-Locked-Runelite
- maintained operational old-name scan: clear
```
