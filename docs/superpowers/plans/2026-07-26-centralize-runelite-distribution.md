# Centralize RuneLite Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Nubles/OSRS-Fate-Locked-Runelite` the sole owner and distributor of the Java plugin while preserving the companion app's RuneLite integration.

**Architecture:** Delete the Java mirror and every plugin build, download, release, and parity mechanism from `OSRS-Fate-Locked`. Retain the app-authored bundle, relay, Roll Inbox, detector, onboarding, and Travel Guardian contracts, and protect the boundary with a Vitest repository-structure regression.

**Tech Stack:** React 18, TypeScript 5, Vitest 4, GitHub Actions, Git.

## Global Constraints

- `Nubles/OSRS-Fate-Locked-Runelite` is the only Java plugin source, build, release, download, and Plugin Hub repository.
- The companion app must retain RuneLite onboarding, bundle/rules export, Online sync, durable relay, Roll Inbox, detector policies, and Travel Guardian rule authority.
- Do not modify the standalone repository or commit anything under `C:\tmp\strict-travel-guardian`.
- Do not remove the app's link to `https://github.com/Nubles/OSRS-Fate-Locked-Runelite`.
- Active companion documentation must not instruct contributors to mirror, build, download, or release the Java plugin from `OSRS-Fate-Locked`.
- Archived plans/specifications may preserve historical mirror text.
- The cleanup is merged only after focused tests, the full release gate, GitHub CI, and post-merge Pages verification pass.

---

## File Structure

- `scripts/runeliteRepositoryBoundary.test.ts`: pins the companion/standalone ownership boundary.
- `.github/workflows/runelite-plugin.yml`: obsolete companion plugin build/download workflow; delete.
- `.github/workflows/runelite-mirror.yml`: obsolete mirror parity workflow; delete.
- `runelite-plugin/`: obsolete Java mirror; delete completely.
- `scripts/check-runelite-mirror.mjs` and `scripts/check-runelite-mirror.test.ts`: obsolete mirror verifier; delete.
- `package.json`: remove only `runelite:mirror-check`.
- `.gitignore`: remove only companion-mirror Gradle output entries.
- `README.md`, `ROADMAP.md`, `.claude/skills/fate-locked-workflow/SKILL.md`: describe standalone ownership while retaining app integration guidance.

### Task 1: Remove companion plugin source and distribution machinery

**Files:**
- Create: `scripts/runeliteRepositoryBoundary.test.ts`
- Delete: `runelite-plugin/**`
- Delete: `.github/workflows/runelite-plugin.yml`
- Delete: `.github/workflows/runelite-mirror.yml`
- Delete: `scripts/check-runelite-mirror.mjs`
- Delete: `scripts/check-runelite-mirror.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the approved ownership design in `docs/superpowers/specs/2026-07-26-runelite-repository-ownership-design.md`.
- Produces: a companion repository with no embedded Java plugin or plugin distribution pipeline, plus a structural regression test.

- [ ] **Step 1: Write the failing repository-boundary test**

Create `scripts/runeliteRepositoryBoundary.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const atRoot = (relativePath: string) => join(repositoryRoot, relativePath);

describe('RuneLite repository ownership boundary', () => {
  it.each([
    'runelite-plugin',
    '.github/workflows/runelite-plugin.yml',
    '.github/workflows/runelite-mirror.yml',
    'scripts/check-runelite-mirror.mjs',
    'scripts/check-runelite-mirror.test.ts',
  ])('does not keep plugin source or distribution machinery at %s', (relativePath) => {
    expect(existsSync(atRoot(relativePath))).toBe(false);
  });

  it('does not expose a mirror verification npm command', () => {
    const packageJson = JSON.parse(readFileSync(atRoot('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts).not.toHaveProperty('runelite:mirror-check');
  });

  it.each([
    'components/RuneLiteOnboarding.tsx',
    'components/RollInbox.tsx',
    'components/RollInboxDriver.tsx',
    'services/fateEventProtocol.ts',
    'services/fateEventRelay.ts',
    'services/relaySync.ts',
    'utils/runeliteBundle.ts',
    'utils/runeliteExport.ts',
    'utils/runeliteRulesManifest.ts',
    'workers/fate-relay/worker.js',
  ])('retains the app-side RuneLite integration at %s', (relativePath) => {
    expect(existsSync(atRoot(relativePath))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run scripts/runeliteRepositoryBoundary.test.ts
```

Expected: failures show that `runelite-plugin/`, both plugin workflows, both mirror verifier files, and `runelite:mirror-check` still exist. The retained app-integration assertions pass.

- [ ] **Step 3: Verify the destructive target and delete only companion-owned plugin files**

Run:

```powershell
$target = Resolve-Path 'runelite-plugin'
if (-not $target.Path.StartsWith((Resolve-Path '.').Path)) { throw 'Refusing out-of-workspace deletion' }
git rm -r -- runelite-plugin
git rm -- .github/workflows/runelite-plugin.yml .github/workflows/runelite-mirror.yml
git rm -- scripts/check-runelite-mirror.mjs scripts/check-runelite-mirror.test.ts
```

Expected: Git stages deletions only inside `OSRS-Fate-Locked`; `C:\tmp\strict-travel-guardian` is untouched.

- [ ] **Step 4: Remove the obsolete package script and ignore entries**

In `package.json`, remove only:

```json
"runelite:mirror-check": "node scripts/check-runelite-mirror.mjs",
```

In `.gitignore`, remove only:

```gitignore
# RuneLite plugin build artifacts
runelite-plugin/build/
runelite-plugin/.gradle/
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
npx vitest run scripts/runeliteRepositoryBoundary.test.ts
```

Expected: one test file passes; every absence and retention assertion is green.

- [ ] **Step 6: Verify package metadata did not drift**

Run:

```powershell
git diff -- package-lock.json
git diff -- package.json
```

Expected: `package-lock.json` has no changes; `package.json` removes exactly one script.

- [ ] **Step 7: Commit the repository boundary**

Run:

```powershell
git add .gitignore package.json scripts/runeliteRepositoryBoundary.test.ts
git diff --cached --check
git commit -m "chore: centralize RuneLite plugin distribution"
```

Expected: the commit contains the structural regression, mirror/source deletions, workflow deletions, and the two narrow configuration edits.

### Task 2: Canonicalize active ownership documentation

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `.claude/skills/fate-locked-workflow/SKILL.md`
- Modify: `scripts/runeliteRepositoryBoundary.test.ts`

**Interfaces:**
- Consumes: Task 1's file boundary and the standalone repository URL.
- Produces: active instructions that send plugin source/build/release work to the standalone repository without removing web integration guidance.

- [ ] **Step 1: Extend the boundary test with active-document assertions**

Append to the existing `describe` block in `scripts/runeliteRepositoryBoundary.test.ts`:

```ts
  it('documents standalone ownership without companion mirror instructions', () => {
    const activeDocs = [
      'README.md',
      'ROADMAP.md',
      '.claude/skills/fate-locked-workflow/SKILL.md',
    ].map((relativePath) => readFileSync(atRoot(relativePath), 'utf8')).join('\n');

    expect(activeDocs).toContain('https://github.com/Nubles/OSRS-Fate-Locked-Runelite');
    expect(activeDocs).not.toMatch(/runelite-plugin\/SOURCE_COMMIT/);
    expect(activeDocs).not.toMatch(/byte-for-byte (?:CRLF )?mirror/i);
    expect(activeDocs).not.toContain('runelite:mirror-check');
    expect(activeDocs).not.toContain('Nubles/RS3-Fate-Locked-Runelite');
  });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run scripts/runeliteRepositoryBoundary.test.ts
```

Expected: the new documentation test fails on the current mirror instructions and old repository name.

- [ ] **Step 3: Update the README ownership statement**

Replace the mirror paragraph in `README.md` with:

```markdown
The companion [RuneLite plugin](https://github.com/Nubles/OSRS-Fate-Locked-Runelite)
renders the tracker rules in-game, warns before locked actions, and—only when
the player enables Online sync—queues supported completions for the app. Plugin
source, installation instructions, builds, and releases live exclusively in
the standalone repository. This web app remains responsible for exporting the
rules bundle and operating the confirmation-first Roll Inbox.
```

Keep the following paragraphs describing validation, Roll Inbox ownership, and relay TTLs.

- [ ] **Step 4: Update ROADMAP ownership and architecture guidance**

In `ROADMAP.md`:

- keep the shipped Plugin Hub status and standalone link;
- replace mirror-refresh instructions with: future plugin releases are built and published only from `OSRS-Fate-Locked-Runelite`;
- replace the `Plugin mirror` architecture bullet with a `Plugin boundary` bullet explaining that the app exports rules and processes events but contains no Java plugin or download pipeline;
- leave historical feature descriptions intact.

- [ ] **Step 5: Update the project workflow skill**

In `.claude/skills/fate-locked-workflow/SKILL.md`:

- replace `Nubles/RS3-Fate-Locked-Runelite` with `Nubles/OSRS-Fate-Locked-Runelite`;
- remove every instruction to copy plugin files into `runelite-plugin/`;
- state that plugin Gradle tests, CI, releases, and Plugin Hub work occur only in the standalone repository;
- retain the bundle-contract and app verification guidance;
- update the plugin verification section to use `gradle clean test jar --no-daemon` in the standalone checkout.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```powershell
npx vitest run scripts/runeliteRepositoryBoundary.test.ts
```

Expected: repository and documentation boundary assertions all pass.

- [ ] **Step 7: Audit active references**

Run:

```powershell
rg -n "runelite-plugin/SOURCE_COMMIT|byte-for-byte (CRLF )?mirror|runelite:mirror-check|Nubles/RS3-Fate-Locked-Runelite" README.md ROADMAP.md .claude package.json .github scripts
```

Expected: no matches. Archived `docs/superpowers/plans/` and `docs/superpowers/specs/` are intentionally excluded.

- [ ] **Step 8: Commit active documentation**

Run:

```powershell
git add README.md ROADMAP.md .claude/skills/fate-locked-workflow/SKILL.md scripts/runeliteRepositoryBoundary.test.ts
git diff --cached --check
git commit -m "docs: point plugin work to standalone repository"
```

### Task 3: Run complete verification and independent review

**Files:**
- No production files added.
- Restore if generated: `data/modelManifest.ts`.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: fresh evidence that app-side RuneLite behavior remains intact and standalone plugin state is unchanged.

- [ ] **Step 1: Run the focused boundary test**

```powershell
npx vitest run scripts/runeliteRepositoryBoundary.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full companion release gate**

```powershell
npm test
npm run typecheck
npm run content:verify
npm run build
```

Expected:

- all Vitest files pass, including existing RuneLite bundle, eligibility, relay, Roll Inbox, and Travel Guardian tests;
- TypeScript passes;
- Diary/content verification passes;
- the production Vite build succeeds.

- [ ] **Step 3: Restore the build-only manifest rewrite**

```powershell
git restore --worktree -- data/modelManifest.ts
git status --short
```

Expected: only intentional cleanup changes remain; after Tasks 1 and 2 are committed, the worktree is clean.

- [ ] **Step 4: Audit ownership and retained app integration**

```powershell
git ls-tree -r --name-only HEAD runelite-plugin
rg -n "runelite-plugin/SOURCE_COMMIT|runelite:mirror-check|Nubles/RS3-Fate-Locked-Runelite" README.md ROADMAP.md .claude package.json .github scripts
rg -n "RuneLiteOnboarding|RollInboxDriver|buildRuneliteRulesManifest|FateEventEnvelope" components services utils
```

Expected:

- the first two commands print no obsolete companion ownership references;
- the retained-integration scan finds the onboarding, Roll Inbox, manifest, and event contracts.

- [ ] **Step 5: Prove the standalone repository was not modified**

```powershell
git -C C:\tmp\strict-travel-guardian rev-parse HEAD
git -C C:\tmp\strict-travel-guardian status --short
```

Expected: HEAD remains `5cc1ffc4e4f684a99211f12342a69ceb6d16de30`; status is clean.

- [ ] **Step 6: Request independent review**

Ask a review agent to inspect `origin/main...HEAD` for:

- accidental deletion of app-side RuneLite integration;
- incomplete plugin source/download/mirror removal;
- stale active ownership instructions;
- test weaknesses that would allow the mirror or release workflow to return.

Expected: APPROVE or actionable findings fixed and re-verified before publication.

### Task 4: Publish, merge, and verify production

**Files:**
- PR metadata only.

**Interfaces:**
- Consumes: independently approved, fully verified branch.
- Produces: a merged cleanup with green CI and a successful GitHub Pages deployment.

- [ ] **Step 1: Push the branch**

```powershell
git push -u origin chore/centralize-runelite-distribution
```

- [ ] **Step 2: Open a focused pull request**

Use title:

```text
Centralize RuneLite plugin ownership
```

Use body:

```markdown
## Outcome

`Nubles/OSRS-Fate-Locked-Runelite` is now the sole Java plugin source,
build, release, download, and Plugin Hub repository.

## Removed from the companion app

- embedded `runelite-plugin/` Java mirror;
- plugin build/download release workflow;
- mirror parity workflow and verifier;
- mirror-specific npm and maintainer instructions.

## Retained in the companion app

- RuneLite onboarding and Plugin Hub link;
- rules bundle and manifest export;
- Online sync and durable relay;
- confirmation-first Roll Inbox;
- detector policies and Travel Guardian authority.

## Verification

- repository-boundary regression: passed;
- full tests/typecheck/content verification/build: passed;
- independent review: approved;
- standalone repository unchanged at `5cc1ffc`.
```

- [ ] **Step 3: Wait for all PR checks**

```powershell
gh pr checks --watch --interval 10
```

Expected: every required check passes. There is no companion plugin build or mirror-parity check because those workflows were intentionally removed.

- [ ] **Step 4: Merge the PR**

Use a squash merge after CI is green:

```powershell
gh pr merge --squash --delete-branch
```

Expected: GitHub returns the new `main` commit SHA.

- [ ] **Step 5: Verify post-merge Actions and Pages**

```powershell
gh run list --repo Nubles/OSRS-Fate-Locked --branch main --limit 10 --json databaseId,name,status,conclusion,headSha,url
```

Expected:

- the new `main` commit's Pages workflow completes successfully;
- no `Build RuneLite plugin` workflow runs for the cleanup commit;
- no `RuneLite mirror` workflow runs for the cleanup commit.

- [ ] **Step 6: Verify final repository inventory**

```powershell
gh api repos/Nubles/OSRS-Fate-Locked/contents/runelite-plugin
gh api repos/Nubles/OSRS-Fate-Locked/contents/.github/workflows/runelite-plugin.yml
gh api repos/Nubles/OSRS-Fate-Locked-Runelite/commits/5cc1ffc4e4f684a99211f12342a69ceb6d16de30
```

Expected: the first two calls return 404; the standalone commit remains available.
