# Release Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (<code>- [ ]</code>) syntax for tracking.

**Goal:** Make each pull request and Pages deployment prove a clean lockfile install, full tests, type safety, deterministic local content integrity, and a production build before code can merge or publish.

**Architecture:** Define one local release-gate contract in package scripts, backed by a deterministic Vitest content suite and an offline generated-file check. A read-only pull-request workflow and the existing Pages build run the same commands in the same order; focused workflow-contract tests pin triggers, permissions, command order, and non-deployment guarantees.

**Tech Stack:** GitHub Actions, Node.js 22, npm ci, Vitest, TypeScript, Vite, GitHub Pages.

## Global Constraints

- Do not modify RuneLite plugin code or its Java workflow.
- Do not change GitHub repository settings automatically; branch protection remains a documented maintainer action.
- Do not deploy pull requests, expose Pages permissions to pull-request code, or require secrets in CI.
- Do not make live OSRS Wiki availability part of <code>content:verify</code> or a merge/deploy gate.
- Keep <code>content:check</code> as the separate network-backed freshness command; required CI must not invoke it or modify <code>docs/SYNC_STATUS.md</code>.
- Do not upgrade application dependencies or GitHub Actions as an incidental part of this plan.
- Keep official GitHub actions on their already-reviewed major versions in this scope.
- Every behavior change follows RED, GREEN, REFACTOR: write a failing test, observe the intended failure, implement only enough to pass, and rerun the covering tests.
- Every task ends in a focused commit using a message file, not a quoted multiline PowerShell message.

---

## File Structure

**Create**

- <code>.github/workflows/ci.yml</code>: read-only pull-request and manual quality workflow.
- <code>scripts/ci-contract.test.ts</code>: static workflow/package contract tests.
- <code>docs/RELEASE_CHECKLIST.md</code>: exact local gate and branch-protection follow-up.

**Modify**

- <code>package.json</code>: deterministic <code>content:verify</code> and <code>release:verify</code> commands.
- <code>scripts/sync-achievement-diaries.mjs</code> and its test: <code>--check</code> mode for byte-for-byte offline generation verification.
- <code>data/contentBaseline.test.ts</code>: importable local content assertions from the game-data plan.
- <code>data/tasksConsistency.test.ts</code>, <code>utils/taskIdMigrations.test.ts</code>, and <code>utils/caProgress.test.ts</code>: included in the deterministic content gate.
- <code>.github/workflows/deploy.yml</code>: lockfile install and all quality gates before artifact upload.
- <code>ROADMAP.md</code>: point maintainers at the release checklist and required check name.
- <code>docs/CONTENT_SYNC.md</code>: distinguish deterministic verification from live freshness/sync commands.

---

### Task 1: Establish a deterministic local content gate

**Files:**

- Modify: <code>scripts/sync-achievement-diaries.mjs</code>
- Modify: <code>scripts/sync-achievement-diaries.test.ts</code>
- Modify: <code>data/contentBaseline.test.ts</code>
- Modify: <code>data/tasksConsistency.test.ts</code>
- Modify: <code>utils/taskIdMigrations.test.ts</code>
- Modify: <code>utils/caProgress.test.ts</code>
- Modify: <code>package.json</code>
- Modify: <code>docs/CONTENT_SYNC.md</code>

**Command contract:**

~~~json
{
  "scripts": {
    "diary:verify": "node scripts/sync-achievement-diaries.mjs --check",
    "content:verify": "npm run diary:verify && vitest run data/contentBaseline.test.ts data/tasksConsistency.test.ts utils/taskIdMigrations.test.ts utils/caProgress.test.ts"
  }
}
~~~

The command reads committed inputs and outputs only, emits no files, performs no network requests, and exits non-zero on any contract violation.

- [ ] **Step 1: Write a failing offline generator-check test**

Extend <code>scripts/sync-achievement-diaries.test.ts</code> so the renderer/checker receives strings or explicit paths and returns all mismatches without writing:

~~~ts
it('reports generated output drift without rewriting the file', async () => {
  const output = 'sentinel old output';
  const result = await checkGeneratedDiary(snapshotFixture, output);
  expect(result).toEqual({ ok: false, errors: ['data/diaryTasks.ts is out of date'] });
  expect(output).toBe('sentinel old output');
});

it('accepts byte-identical generated output', async () => {
  const expected = renderDiaryTasks(snapshotFixture);
  expect(await checkGeneratedDiary(snapshotFixture, expected)).toEqual({ ok: true, errors: [] });
});
~~~

Add a test that stubs <code>globalThis.fetch</code> to throw and proves <code>--check</code>'s core path never calls it.

Run:

~~~powershell
npx vitest run scripts/sync-achievement-diaries.test.ts
~~~

Expected: FAIL because check mode does not exist.

- [ ] **Step 2: Implement <code>--check</code> without changing normal sync behavior**

Refactor the existing offline snapshot renderer so both write mode and check mode call the same pure <code>renderDiaryTasks(snapshot)</code>. In executable check mode:

1. Read <code>data/sources/achievement-diary-tasks.json</code>.
2. Render in memory.
3. Read <code>data/diaryTasks.ts</code>.
4. Print a concise mismatch and set <code>process.exitCode = 1</code> if bytes differ.
5. Do not call <code>writeFile</code>, <code>fetch</code>, or update status documentation.

Normal <code>npm run diary:sync</code> remains the explicit write operation.

- [ ] **Step 3: Pin the full local data contract**

Make <code>data/contentBaseline.test.ts</code> assert and report independently:

- the audited recent quest records and exact A Porcine of Interest locations;
- 492 Diary tasks, unique current IDs, valid tier/region references, and source metadata;
- every historical Diary ID classified by the task migration table;
- 646 CA tasks with 41/60/86/164/174/121 tier counts;
- CA points 1/2/3/4/5/6 and thresholds 41/161/419/1075/1945/2671;
- no duplicate generated IDs, dangling task references, or unresolved migration targets.

Do not combine all assertions behind one early throw: when practical, one CI run should show every violated invariant as separate Vitest failures.

- [ ] **Step 4: Add the package commands and prove the command is read-only**

Add the exact scripts above. Run:

~~~powershell
npm run content:verify
git status --short
npm run content:verify
git status --short
~~~

Expected: both commands exit 0 and the two status snapshots are identical. The only existing changes should be the implementation already in progress; verification must add or modify nothing.

Then temporarily change a generated Diary byte in a disposable test fixture—not the tracked application file—and prove the checker returns non-zero. Restore the fixture through normal test teardown.

- [ ] **Step 5: Document deterministic versus network-backed commands**

In <code>docs/CONTENT_SYNC.md</code>, state:

- <code>content:verify</code>: offline, read-only, required in PR/deploy CI;
- <code>content:check</code>: live freshness inspection that may update <code>docs/SYNC_STATUS.md</code>;
- <code>content:sync</code>, <code>diary:sync</code>, and <code>ca:sync</code>: explicit maintenance writes reviewed in their own diff;
- generated data is never hand-edited.

- [ ] **Step 6: Verify and commit**

~~~powershell
npm run content:verify
npx tsc --noEmit
git diff --check
~~~

Expected: all commands exit 0.

Commit: <code>test: add deterministic content verification</code>

---

### Task 2: Pin the pull-request and deployment workflow contract

**Files:**

- Create: <code>scripts/ci-contract.test.ts</code>
- Create: <code>.github/workflows/ci.yml</code>
- Modify: <code>.github/workflows/deploy.yml</code>
- Modify: <code>package.json</code>

**Workflow contract:**

- Stable required check: <code>CI / quality</code> from workflow <code>name: CI</code> and job id <code>quality</code>.
- Pull-request permissions: <code>contents: read</code> only.
- Command order in both quality/build jobs: install, test, type-check, content verify, production build.
- PR workflow has no deploy/upload-pages action, environment, <code>pages: write</code>, or <code>id-token: write</code>.

- [ ] **Step 1: Write failing workflow contract tests first**

Create <code>scripts/ci-contract.test.ts</code>. Read files relative to repository root using <code>import.meta.url</code>; do not depend on the caller's working directory. Add helpers that find command offsets and fail with focused messages:

~~~ts
const commandOrder = [
  'npm ci --no-audit --no-fund',
  'npm test',
  'npx tsc --noEmit',
  'npm run content:verify',
  'npm run build',
];

const expectInOrder = (text: string, commands: string[]) => {
  let cursor = -1;
  for (const command of commands) {
    const next = text.indexOf(command, cursor + 1);
    expect(next, command + ' missing or out of order').toBeGreaterThan(cursor);
    cursor = next;
  }
};
~~~

Tests must assert:

- <code>ci.yml</code> exists, is named <code>CI</code>, triggers on pull requests targeting both <code>main</code> and <code>master</code>, and supports <code>workflow_dispatch</code>;
- job id <code>quality</code>, <code>ubuntu-latest</code>, Node 22, npm cache, read-only contents permission, and cancel-in-progress concurrency;
- the exact command order and <code>VITE_BASE: /${{ github.event.repository.name }}/</code> on build;
- absence of <code>npm install</code>, deploy/upload Pages actions, write permissions, secrets, and environment in <code>ci.yml</code>;
- <code>deploy.yml</code> retains push/manual triggers, Pages/OIDC permissions, build→deploy dependency, official action major versions, and now uses the same command order;
- <code>package.json</code> exposes <code>content:verify</code> and <code>release:verify</code> with the expected gate order.

Use boundary-safe matching so <code>npm install</code> does not falsely match the <code>npm ci</code> line and comments cannot satisfy required commands.

Run:

~~~powershell
npx vitest run scripts/ci-contract.test.ts
~~~

Expected: FAIL because <code>ci.yml</code> and <code>release:verify</code> are missing and deploy still uses <code>npm install</code>.

- [ ] **Step 2: Add the local aggregate gate**

Add:

~~~json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "release:verify": "npm test && npm run typecheck && npm run content:verify && npm run build"
  }
}
~~~

The workflows may use the explicit commands from the approved design; <code>release:verify</code> is the convenient local equivalent. Do not add <code>npm audit</code> to the deterministic release gate.

- [ ] **Step 3: Create the read-only pull-request workflow**

Create <code>.github/workflows/ci.yml</code>:

~~~yaml
name: CI

on:
  pull_request:
    branches: [main, master]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci --no-audit --no-fund
      - name: Run tests
        run: npm test
      - name: Type-check
        run: npx tsc --noEmit
      - name: Verify content
        run: npm run content:verify
      - name: Build
        run: npm run build
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
~~~

Use literal GitHub expression syntax in the actual YAML; the escaped dollar notation above exists only so plan rendering cannot interpolate it.

Do not add <code>pull_request_target</code>, a checkout of a mutable base ref, secrets, uploads, artifacts, or deploy steps.

- [ ] **Step 4: Gate the Pages build identically**

In <code>.github/workflows/deploy.yml</code>:

- replace <code>npm install --no-audit --no-fund</code> with <code>npm ci --no-audit --no-fund</code> and remove the stale reconciliation comment;
- insert <code>npm test</code>, <code>npx tsc --noEmit</code>, and <code>npm run content:verify</code> before the existing build;
- preserve <code>VITE_BASE</code>, <code>BUILD_ID</code>, Pages artifact upload, <code>needs: build</code>, environment URL, and Pages/OIDC permissions;
- keep checkout/setup/upload/deploy actions on their existing major versions.

The deploy job may run only after the gated build produces an artifact.

- [ ] **Step 5: Verify contract and commit**

~~~powershell
npx vitest run scripts/ci-contract.test.ts
npm run content:verify
npx tsc --noEmit
git diff --check
~~~

Expected: contract tests pin <code>CI / quality</code>, workflow permissions/order pass, and no whitespace errors appear.

Commit: <code>ci: gate pull requests and pages deploys</code>

---

### Task 3: Prove the lockfile and document the release handoff

**Files:**

- Create: <code>docs/RELEASE_CHECKLIST.md</code>
- Modify: <code>ROADMAP.md</code>
- Modify: <code>docs/CONTENT_SYNC.md</code>
- Modify: <code>scripts/ci-contract.test.ts</code>
- Modify: <code>package-lock.json</code> only if a clean <code>npm ci</code> proves it is legitimately out of sync

- [ ] **Step 1: Write failing documentation contract assertions**

Extend <code>scripts/ci-contract.test.ts</code> to assert <code>docs/RELEASE_CHECKLIST.md</code> names:

- <code>npm ci --no-audit --no-fund</code> for dependency-metadata changes;
- <code>npm test</code>, <code>npx tsc --noEmit</code>, <code>npm run content:verify</code>, and <code>npm run build</code> in order;
- required GitHub check <code>CI / quality</code>;
- that branch protection is a manual repository-maintainer setting;
- that <code>content:verify</code> is offline/read-only and <code>content:check</code> is network-backed;
- generated data must be updated through its source snapshot/generator.

Assert <code>ROADMAP.md</code> links to the checklist.

Run the focused test and observe failure because the checklist does not exist.

- [ ] **Step 2: Prove <code>npm ci</code> from the committed lockfile**

Before changing dependency metadata, record:

~~~powershell
node --version
npm --version
git status --short package.json package-lock.json
npm ci --no-audit --no-fund
git status --short package.json package-lock.json
~~~

Expected: Node reports major 22 in the intended release environment, npm ci exits 0, and dependency metadata status is unchanged.

If <code>npm ci</code> fails specifically because <code>package.json</code> and <code>package-lock.json</code> disagree, stop and inspect the named mismatch. Regenerate the lockfile with the same Node/npm toolchain only after confirming no dependency range or version was unintentionally upgraded. Review <code>git diff -- package-lock.json</code> and commit that metadata change separately as <code>chore: align npm lockfile</code>. Do not convert a registry/network outage into a lockfile edit.

- [ ] **Step 3: Write the release checklist**

Document this exact maintainer flow:

1. When dependency metadata changed, run the clean lockfile install.
2. Run <code>npm test</code>.
3. Run <code>npx tsc --noEmit</code>.
4. Run <code>npm run content:verify</code>.
5. Run <code>npm run build</code> with the production repository base when reproducing Pages exactly.
6. Review <code>git diff --check</code>, generated-data diff, scope, and secrets.
7. Push and wait for the actual <code>CI / quality</code> result.
8. After the workflow first appears, a repository maintainer enables branch protection requiring <code>CI / quality</code>; this project change does not alter settings automatically.

Explain that Pages deployment cannot bypass the build job and that live wiki maintenance remains separate.

- [ ] **Step 4: Link the checklist and verify docs**

Add a concise link from the relevant ROADMAP release/maintenance section and keep the detailed commands in the checklist. Update CONTENT_SYNC only to remove duplication or clarify the deterministic/live distinction; do not make the docs disagree.

Run:

~~~powershell
npx vitest run scripts/ci-contract.test.ts
~~~

Expected: all documentation/workflow contract assertions pass.

- [ ] **Step 5: Run the complete local release gate**

~~~powershell
npm test
npx tsc --noEmit
npm run content:verify
$env:VITE_BASE='/OSRS-Fate-Locked/'; npm run build
npm run content:verify
git diff --check
git status --short
~~~

Expected:

- full Vitest suite exits 0;
- TypeScript exits 0;
- deterministic content succeeds before and after build;
- production build exits 0 with the repository-relative base;
- no verification command changes tracked source/content files;
- whitespace check exits 0.

Use the actual PowerShell environment assignment in execution; the escaped dollar in this plan prevents accidental interpolation while writing the document.

- [ ] **Step 6: Commit documentation**

Commit: <code>docs: add release verification checklist</code>

---

### Task 4: Push and observe the real GitHub quality check

**Files:** none unless the actual CI run reveals a repository defect.

- [ ] **Step 1: Review scope before push**

~~~powershell
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
rg -n "pull_request_target|pages: write|id-token: write|actions/(upload-pages-artifact|deploy-pages)" .github\workflows\ci.yml
rg -n "content:check|content:sync" .github\workflows package.json
~~~

Expected:

- no RuneLite/plugin files;
- PR CI contains no write/deploy markers;
- network-backed content commands are absent from workflow run steps;
- deploy permissions/actions appear only in <code>deploy.yml</code>.

The first <code>rg</code against <code>ci.yml</code> is expected to return no matches; treat exit 1 as the intended absence result, not a failure.

- [ ] **Step 2: Push the implementation branch**

Push <code>feature/tracker-fixes-changelog</code> using the already validated GitHub login. Do not reinterpret a restricted-sandbox keyring error as invalid authentication; if network access is restricted, rerun the same Git operation through the approved unrestricted path.

- [ ] **Step 3: Observe the actual check to a terminal result**

Use the pull request's check list and wait for <code>CI / quality</code>. Record its final conclusion and link. A local green result is not a substitute.

If it fails:

1. Read the failing step/log.
2. Use <code>superpowers:systematic-debugging</code> before editing.
3. Reproduce locally with the exact failing command.
4. Add or adjust a regression test when the defect is in application/workflow logic.
5. Commit the smallest fix, rerun the complete local gate, push, and observe the replacement check.

Do not weaken or skip a gate to turn it green.

- [ ] **Step 4: Confirm deployment protection without manually deploying**

Inspect the workflow graph/config to prove the deploy job depends on <code>build</code>. This pull request does not merge or trigger a production Pages deployment unless the user separately authorizes that external state change.

---

## Plan Completion Criteria

- <code>content:verify</code> is offline, deterministic, read-only, and proves current quest/Diary/CA contracts plus offline generated Diary bytes.
- <code>CI / quality</code> runs on pull requests to main/master with contents-read-only permissions and no deployment capability.
- Pull-request and Pages build jobs both run lockfile install, full tests, type checking, content verification, and production build in order.
- Pages artifact upload and deployment are downstream of the gated build only.
- <code>npm ci</code> succeeds without opportunistic dependency changes.
- The release checklist names the exact local gate and the manual branch-protection action.
- Full local verification and the actual GitHub <code>CI / quality</code> run reach a green terminal result.
