# Mandatory Player-Facing What's New Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing RuneLite companion release entry and prevent future player-facing changes from passing release verification without an authored What's New update.

**Architecture:** Keep authored release copy in the existing `data/changelog.ts` history. Add a dependency-free Node module that classifies repository paths, a thin Git-aware command that collects committed and local changes, and wire that command into pull-request CI and the local release gate.

**Tech Stack:** TypeScript, React, Vitest, Node.js ESM, GitHub Actions, GitHub Pages.

## Global Constraints

- The new release is dated `2026-07-28` and remains the first item in `CHANGELOG_RELEASES`.
- Player copy must use the labels **Keys**, **Omni Keys**, and **Chaos Keys**.
- The release entry must not claim that RuneLite Plugin Hub review is complete.
- Gameplay events remain local to RuneLite; the companion supplies app-authored run rules.
- Tests, documentation, workflows, and maintainer scripts do not require a What's New entry by themselves.
- The gate must work with both `/` and `\` path separators.
- The implementation adds no production dependency.
- The user's unrelated main-worktree changes must remain untouched.

---

## File map

- `data/changelog.ts`: authored player-facing release history.
- `data/changelog.test.ts`: exact copy and newest-release contract.
- `scripts/player-facing-changelog.mjs`: pure path classification and gate decision.
- `scripts/player-facing-changelog.test.ts`: unit tests for classification and decisions.
- `scripts/verify-player-facing-changelog.mjs`: Git-backed command-line adapter.
- `scripts/ci-contract.test.ts`: workflow, package-command, and release-documentation contracts.
- `.github/workflows/ci.yml`: pull-request enforcement with complete Git history.
- `package.json`: local `changelog:verify` command and aggregate release gate.
- `docs/RELEASE_CHECKLIST.md`: maintainer-facing mandatory rule and exemptions.

### Task 1: Add the missing RuneLite companion release

**Files:**
- Modify: `data/changelog.test.ts`
- Modify: `data/changelog.ts`

**Interfaces:**
- Consumes: existing `CHANGELOG_RELEASES` and `LATEST_CHANGELOG` exports.
- Produces: newest release id `2026-07-28-runelite-companion-update`.

- [ ] **Step 1: Write the failing authored-release test**

Update the newest-release assertion and add this focused contract:

```ts
expect(LATEST_CHANGELOG).toMatchObject({
  id: '2026-07-28-runelite-companion-update',
  title: 'RuneLite Companion Update',
  date: '2026-07-28',
});
expect(LATEST_CHANGELOG.sections.added).toContain(
  'Connect the companion to RuneLite with one guided, copyable pairing command.',
);
expect(LATEST_CHANGELOG.sections.changed).toEqual(expect.arrayContaining([
  'RuneLite reads your app-authored run rules while detected gameplay events remain local to RuneLite.',
  'The complete RuneLite experience now lives in one panel with collapsible sections.',
]));
expect(LATEST_CHANGELOG.sections.fixed).toEqual(expect.arrayContaining([
  'RuneLite controls no longer appear clipped or overlap adjacent colour settings.',
  'Run balances are now labelled Keys, Omni Keys, and Chaos Keys.',
]));
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```powershell
npx vitest run data/changelog.test.ts
```

Expected: failure because `LATEST_CHANGELOG.id` is still
`2026-07-26-vanilla-key-safety-valve`.

- [ ] **Step 3: Add the minimal newest-first release object**

Insert this object at the start of `CHANGELOG_RELEASES`:

```ts
{
  id: '2026-07-28-runelite-companion-update',
  title: 'RuneLite Companion Update',
  date: '2026-07-28',
  sections: {
    added: [
      'Connect the companion to RuneLite with one guided, copyable pairing command.',
    ],
    changed: [
      'RuneLite reads your app-authored run rules while detected gameplay events remain local to RuneLite.',
      'The complete RuneLite experience now lives in one panel with collapsible sections.',
    ],
    fixed: [
      'RuneLite controls no longer appear clipped or overlap adjacent colour settings.',
      'Run balances are now labelled Keys, Omni Keys, and Chaos Keys.',
    ],
  },
},
```

- [ ] **Step 4: Run the focused test and verify the green state**

Run:

```powershell
npx vitest run data/changelog.test.ts
```

Expected: all tests in `data/changelog.test.ts` pass.

- [ ] **Step 5: Commit the player-facing correction**

```powershell
git add -- data/changelog.ts data/changelog.test.ts
git commit -m "fix: add RuneLite companion whats new release"
```

### Task 2: Build the deterministic player-facing path gate

**Files:**
- Create: `scripts/player-facing-changelog.test.ts`
- Create: `scripts/player-facing-changelog.mjs`
- Create: `scripts/verify-player-facing-changelog.mjs`

**Interfaces:**
- Produces: `normalizeRepositoryPath(path: string): string`.
- Produces: `isPlayerFacingPath(path: string): boolean`.
- Produces: `evaluatePlayerFacingChangelog(paths: string[]): { required: boolean; satisfied: boolean; playerFacingPaths: string[] }`.
- Consumes: optional CLI argument or `CHANGELOG_BASE_REF`; defaults to `origin/main`.

- [ ] **Step 1: Write failing pure-decision tests**

Create table-driven tests that assert:

```ts
expect(isPlayerFacingPath('components/RuneLiteOnboarding.tsx')).toBe(true);
expect(isPlayerFacingPath('components\\RuneLiteOnboarding.tsx')).toBe(true);
expect(isPlayerFacingPath('services/relaySync.ts')).toBe(true);
expect(isPlayerFacingPath('data/changelog.test.ts')).toBe(false);
expect(isPlayerFacingPath('docs/RELEASE_CHECKLIST.md')).toBe(false);
expect(isPlayerFacingPath('scripts/sync-chunk-content.mjs')).toBe(false);
expect(isPlayerFacingPath('.github/workflows/ci.yml')).toBe(false);
```

Add decision assertions:

```ts
expect(evaluatePlayerFacingChangelog(['App.tsx'])).toMatchObject({
  required: true,
  satisfied: false,
});
expect(evaluatePlayerFacingChangelog(['App.tsx', 'data/changelog.ts'])).toMatchObject({
  required: true,
  satisfied: true,
});
expect(evaluatePlayerFacingChangelog(['README.md', 'App.lifecycle.test.tsx'])).toMatchObject({
  required: false,
  satisfied: true,
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run:

```powershell
npx vitest run scripts/player-facing-changelog.test.ts
```

Expected: failure because `scripts/player-facing-changelog.mjs` does not exist.

- [ ] **Step 3: Implement the pure module**

Use these exact path rules:

```js
export const CHANGELOG_PATH = 'data/changelog.ts';

const playerFacingFiles = new Set([
  'App.tsx',
  'constants.ts',
  'index.html',
  'index.tsx',
  'styles.css',
  'types.ts',
]);
const playerFacingDirectories = [
  'components/',
  'data/',
  'hooks/',
  'public/',
  'services/',
  'utils/',
  'workers/',
];
const testPath =
  /(?:^|\/)(?:__tests__|fixtures|test|tests)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;
```

Normalize `\` to `/`, remove a leading `./`, exclude test paths before matching,
sort the reported player-facing paths, and only set `required` when a
player-facing path other than `data/changelog.ts` changed.

- [ ] **Step 4: Implement the Git-backed CLI**

Use `execFileSync` without a shell to collect and de-duplicate:

```js
git diff --name-only --diff-filter=ACMRT <base>...HEAD
git diff --name-only --diff-filter=ACMRT
git diff --cached --name-only --diff-filter=ACMRT
git ls-files --others --exclude-standard
```

Pass the resulting paths to `evaluatePlayerFacingChangelog`. Exit `0` when
satisfied. Otherwise print:

```text
Player-facing files changed without updating data/changelog.ts:
- <path>
Add a newest-first What's New release before publishing.
```

and set `process.exitCode = 1`.

- [ ] **Step 5: Run the focused tests and direct command**

Run:

```powershell
npx vitest run scripts/player-facing-changelog.test.ts
node scripts/verify-player-facing-changelog.mjs origin/main
```

Expected: unit tests pass; the command passes because Task 1 changed
`data/changelog.ts` on this branch.

- [ ] **Step 6: Commit the gate implementation**

```powershell
git add -- scripts/player-facing-changelog.mjs scripts/player-facing-changelog.test.ts scripts/verify-player-facing-changelog.mjs
git commit -m "feat: require whats new for player-facing changes"
```

### Task 3: Enforce the rule in CI and maintainer releases

**Files:**
- Modify: `scripts/ci-contract.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `docs/RELEASE_CHECKLIST.md`

**Interfaces:**
- Consumes: `node scripts/verify-player-facing-changelog.mjs [base-ref]`.
- Produces: package command `changelog:verify`.
- Produces: pull-request CI step using `CHANGELOG_BASE_REF`.

- [ ] **Step 1: Write failing integration contracts**

Update the pull-request command order to:

```ts
[
  'npm ci --no-audit --no-fund',
  'npm run changelog:verify',
  'npm test',
  'npx tsc --noEmit',
  'npm run content:verify',
  'npm run build',
]
```

Assert the checkout step contains `fetch-depth: 0`, the changelog step is
limited to `github.event_name == 'pull_request'`, and its environment contains:

```yaml
CHANGELOG_BASE_REF: ${{ github.event.pull_request.base.sha }}
```

Update the package contract to require:

```ts
expect(packageJson.scripts?.['changelog:verify']).toBe(
  'node scripts/verify-player-facing-changelog.mjs',
);
expect(packageJson.scripts?.['release:verify']).toBe(
  'npm run changelog:verify && npm test && npm run typecheck && npm run content:verify && npm run build',
);
```

Add a release-checklist assertion matching `player-facing`, `data/changelog.ts`,
and `changelog:verify`.

- [ ] **Step 2: Run the contracts and verify the red state**

Run:

```powershell
npx vitest run scripts/ci-contract.test.ts
```

Expected: failures for the missing command, workflow step, full-history
checkout, package scripts, and checklist wording.

- [ ] **Step 3: Wire the command into the package and workflow**

Add:

```json
"changelog:verify": "node scripts/verify-player-facing-changelog.mjs"
```

Prefix `release:verify` with `npm run changelog:verify &&`.

In `.github/workflows/ci.yml`, configure checkout with:

```yaml
with:
  fetch-depth: 0
```

After dependency installation add:

```yaml
- name: Verify player-facing What's New
  if: github.event_name == 'pull_request'
  run: npm run changelog:verify
  env:
    CHANGELOG_BASE_REF: ${{ github.event.pull_request.base.sha }}
```

- [ ] **Step 4: Document the mandatory release rule**

Add a release-checklist item before the test suite:

```markdown
For every player-facing change, add a newest-first entry to
`data/changelog.ts`, then run `npm run changelog:verify`. Tests,
documentation, workflows, and maintainer-only scripts are exempt when they are
the only files changed.
```

- [ ] **Step 5: Run the focused contracts and aggregate local gate**

Run:

```powershell
npx vitest run scripts/ci-contract.test.ts scripts/player-facing-changelog.test.ts data/changelog.test.ts
npm run changelog:verify
```

Expected: all focused tests and the gate pass.

- [ ] **Step 6: Commit CI and documentation enforcement**

```powershell
git add -- .github/workflows/ci.yml package.json scripts/ci-contract.test.ts docs/RELEASE_CHECKLIST.md
git commit -m "ci: enforce player-facing whats new entries"
```

### Task 4: Verify and publish the focused correction

**Files:**
- Verify: all branch changes
- Publish: GitHub pull request targeting `main`

**Interfaces:**
- Consumes: the three implementation commits and the committed design/plan.
- Produces: reviewed `main` commit and successful GitHub Pages deployment.

- [ ] **Step 1: Run the complete release gate**

Run:

```powershell
npm run release:verify
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: 1,270 existing tests plus the new tests pass, TypeScript passes,
deterministic content verification passes, production build passes, whitespace
is clean, and only intended branch commits are present.

- [ ] **Step 2: Perform a final scope and secret review**

Run:

```powershell
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: only the design/plan, changelog, gate, CI, package, tests, and release
checklist appear; no credentials, save data, generated content, or unrelated
main-worktree files appear.

- [ ] **Step 3: Push and open a focused pull request**

Push `fix/mandatory-player-facing-whats-new`, then create a pull request titled:

```text
Require What's New entries for player-facing updates
```

The body must summarize the missing RuneLite entry, the automated gate and
exemptions, and the exact verification results.

- [ ] **Step 4: Wait for GitHub CI and merge**

Wait for `CI / quality` to succeed. If it fails, inspect the logs and repair the
branch test-first. When green and mergeable, merge the pull request into
`main`.

- [ ] **Step 5: Confirm the live deployment**

Wait for the `Deploy to GitHub Pages` workflow triggered by the merge. Confirm:

```text
https://nubles.github.io/OSRS-Fate-Locked/
https://nubles.github.io/OSRS-Fate-Locked/version.json
```

The page must return HTTP 200, `version.json` must contain the merged commit
identifier, and the app's newest What's New release must be
`2026-07-28-runelite-companion-update`.

- [ ] **Step 6: Restart the local companion preview**

Build the merged branch and restart the local preview on
`http://127.0.0.1:4173/` in a hidden process. Confirm HTTP 200 so the user can
manually inspect the same release entry locally.
