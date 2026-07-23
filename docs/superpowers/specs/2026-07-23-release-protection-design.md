# Release protection design

**Date:** 2026-07-23

## Objective

Make every pull request prove that the web application installs from its lockfile, passes tests and type checking, contains internally consistent curated data, and builds for production before it can be merged or deployed.

## Scope

This change will:

- Add a dedicated pull-request CI workflow.
- Install dependencies with npm ci from the committed package-lock.json.
- Run the full unit/integration suite, TypeScript checking, deterministic local content verification, and production build.
- Make the GitHub Pages build run the same pre-deploy quality gates and use npm ci.
- Keep deployment credentials out of pull-request jobs.
- Add focused tests for the deterministic content verifier and document the branch-protection check name.

This change will not:

- Change repository branch-protection settings automatically.
- Deploy pull requests or expose GitHub Pages credentials to forked code.
- Make live OSRS Wiki availability a prerequisite for merging.
- Upgrade application dependencies or GitHub Actions solely as part of this remediation.
- Add third-party CI services, release bots, or automatic merging.
- Modify the RuneLite plugin repository or its Java workflow.

## Workflow structure

### Pull-request workflow

A new .github/workflows/ci.yml workflow runs on:

- pull_request targeting main or master.
- workflow_dispatch for an explicit maintainer rerun.

It has one read-only job named quality with:

- ubuntu-latest.
- contents: read permission only.
- concurrency grouped by workflow and pull-request branch, with an obsolete run cancelled when a newer commit is pushed.
- Node.js 22 and npm cache through actions/setup-node.

The job performs these steps in order:

1. Checkout the exact pull-request commit.
2. Install with npm ci --no-audit --no-fund.
3. Run npm test.
4. Run npx tsc --noEmit.
5. Run npm run content:verify.
6. Run npm run build with the repository-relative VITE_BASE used by production.

A single job keeps the required check simple and ensures later steps cannot hide an earlier failure. Test output remains visible in the Actions log.

The stable branch-protection check name is CI / quality. Repository settings are a maintainer action after the workflow lands; the project documentation states that this check should be required before merge.

### Deploy workflow

The existing Pages workflow keeps its push-to-main/master and manual triggers. Its build job is changed to use the same deterministic gates:

1. npm ci --no-audit --no-fund.
2. npm test.
3. npx tsc --noEmit.
4. npm run content:verify.
5. npm run build with VITE_BASE and BUILD_ID.
6. Upload the built artifact.

Only the deploy workflow retains pages: write and id-token: write permissions. Its deploy job still depends on the gated build job, so no artifact reaches Pages after a failed test, type check, content check, or build.

The pull-request workflow does not call the deploy actions and has no environment or deployment permissions.

## Deterministic content verification

The current content:check command contacts the OSRS Wiki and rewrites docs/SYNC_STATUS.md. That behavior is useful for scheduled/manual freshness detection but unsuitable as a required pull-request check because network failures are tolerated and upstream changes can alter results without a code change.

A new content:verify script performs only local, deterministic assertions against committed application data and source snapshots. It exits non-zero on a contract violation and does not modify the worktree.

It verifies at least:

- Expected quest records and reference integrity.
- 492 current Achievement Diary tasks with unique IDs and valid migrations.
- 646 Combat Achievement tasks with exact 41/60/86/164/174/121 per-tier counts.
- CA point values and thresholds.
- No duplicate generated IDs or unresolved references.
- Generated-file/source metadata is present and internally consistent.
- Any generated file is byte-for-byte equal to output produced from its committed snapshot when an offline generator exists.

Pure validation logic is importable and unit-tested. The command-line wrapper only reads files, reports all detected errors in a concise list, and sets the exit code.

The existing content:check command remains the live freshness detector and may continue to update docs/SYNC_STATUS.md during an explicit maintenance run. It is not placed in required PR or deploy CI.

## Lockfile policy

package-lock.json is authoritative for automated installation. Both workflows use npm ci so a package.json/package-lock mismatch fails immediately instead of being reconciled on the runner.

The implementation first proves npm ci succeeds in a clean local environment. If it exposes a legitimate lockfile mismatch, the lockfile is regenerated intentionally with the repository's Node/npm toolchain, reviewed as its own dependency metadata change, and no package upgrades are accepted incidentally.

npm audit is not a required build gate in this scope because registry advisories can change independently of the commit. The already completed audit result is reported in the PR, and dependency remediation remains an explicit reviewed activity. This keeps the quality check reproducible while still allowing scheduled security monitoring later.

## Failure behavior

- A failed npm ci stops all later steps and indicates a lockfile mismatch or install error.
- A failed test/type/content/build command fails CI and blocks deployment.
- The content verifier prints every local data-contract failure found in one run where practical.
- A live wiki outage cannot fail content:verify because it performs no network calls.
- A cancelled superseded run is not treated as a result for the newest commit.
- Manual deployment cannot bypass the build job's quality gates.

## Security and permissions

- Pull-request CI uses contents: read only.
- No secrets are required by the quality job.
- Pull-request code never receives Pages write or OIDC token permissions.
- Deployment permissions remain scoped to the deploy workflow/jobs that need them.
- npm lifecycle behavior remains whatever the committed dependency tree declares; no new remote install script or unpinned curl step is introduced.
- The workflow does not persist artifacts containing local saves, tokens, or environment dumps.

Official GitHub-maintained actions remain on their current reviewed major versions in this scope. Full commit-SHA pinning is a separate supply-chain hardening change because it requires a maintenance process for digest updates.

## Documentation

The release checklist in ROADMAP.md and the content-sync documentation are updated to show the exact local gate:

- npm ci for a clean-install proof when dependency metadata changes.
- npm test.
- npx tsc --noEmit.
- npm run content:verify.
- npm run build.

The documentation distinguishes deterministic content:verify from network-backed content:check/content:sync and states that generated data must be changed through its source snapshot or generator.

The branch-protection note instructs a maintainer to require CI / quality after the workflow appears in GitHub. No repository setting is changed without separate authorization.

## Testing and verification

Implementation follows test-first development for the content verifier. Required evidence includes:

- Unit fixtures where each pinned count/reference invariant fails with the expected diagnostic.
- content:verify succeeds twice consecutively without changing git status.
- npm ci succeeds from the committed lockfile in a clean temporary dependency directory or equivalent clean-install check.
- npm test passes in full.
- npx tsc --noEmit passes.
- npm run build passes with production base variables.
- The workflow files parse and contain the intended triggers, permissions, command order, and stable job name.
- The deploy workflow no longer uses npm install.
- git diff --check reports no whitespace errors.

After pushing, the pull request's CI / quality run is observed to a terminal result. A green local run is not substituted for the actual GitHub workflow result.

## Success criteria

- Every new pull-request commit receives one clear CI / quality result.
- The check uses the lockfile and fails on tests, types, deterministic data drift, or production build errors.
- Pull-request jobs have no deployment permissions and never deploy.
- Pages deployment cannot run from an artifact that skipped the same gates.
- Required checks are reproducible without live wiki access.
- The project documentation makes the manual branch-protection step and local release gate unambiguous.
