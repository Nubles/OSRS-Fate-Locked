# Current-Main RuneLite Integration Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale tracker PRs #11/#12 with a draft integration branch built from current `main`, preserving current tracker fixes while porting the tested Fate Guardian, Roll Inbox, rules bundle, exact RuneLite mirror, and Travel Guardian support.

**Architecture:** Start from the then-current reviewed tracker `main` and port the old feature branch in five reviewable layers. The historical branch is a source of tested commits and files, not a merge target. The standalone plugin remains authoritative; the tracker mirror is copied byte-for-byte from commit `5cc1ffc4e4f684a99211f12342a69ceb6d16de30` and checked in CI.

**Tech Stack:** React 18, TypeScript 5, Vitest 4, Cloudflare Worker tests, Node.js ESM, Java 11/Gradle mirror, GitHub Actions.

## Global Constraints

- Base the replacement on current `OSRS-Fate-Locked/main`; do not force-rebase or merge the stale PR #12 conflict set.
- Preserve current decimal key rolls, one-decimal display/save behavior, strict save validation, content verification, and Windows-portable Diary verification.
- Canonical standalone repository: `Nubles/OSRS-Fate-Locked-Runelite`.
- Exact standalone/mirror commit: `5cc1ffc4e4f684a99211f12342a69ceb6d16de30`.
- `runelite-plugin/SOURCE_COMMIT` and the mirror workflow `ref` must contain that full SHA.
- RuneLite-detected events are confirmation-first; the plugin never rolls or completes tracker content automatically.
- Strict Mode remains opt-in and off by default.
- Travel Guardian cancels only fresh, correct-account, supported actions proven `LOCKED`; Unknown, stale, malformed, future, legacy, and wrong-account inputs fail open.
- The replacement PR stays draft until the issue #1 clean-client matrix and Travel Guardian live matrix pass.
- No extra Plugin Hub code pin is needed while the Hub already resolves to `5cc1ffc`.
- Do not copy the stale feature branch’s old repository URL, old release scripts, or old dependency versions over current `main`.

---

## File Structure

- `utils/chunkPermissionSnapshot.ts` and `utils/runeliteRulesManifest.ts`: compact app-authored rules.
- `utils/runeliteBundle.ts` and `utils/runeliteExport.ts`: bundle v4 and transport.
- `services/fateEventProtocol.ts`, `services/fateEventRelay.ts`, `services/rollInboxStore.ts`: durable event contract and storage.
- `utils/fateEventEligibility.ts` and `config/detectorPolicies.ts`: canonical detector review policy.
- `components/RollInbox.tsx` and `components/RollInboxDriver.tsx`: explicit player review UI.
- `workers/fate-relay/*`: append/acknowledge event relay.
- `runelite-plugin/`: exact standalone source mirror only.
- `scripts/check-runelite-mirror.mjs`: byte-for-byte source/mirror verifier.
- `.github/workflows/runelite-mirror.yml`: canonical standalone checkout and parity gate.

### Task 1: Create a current-main replacement branch and freeze invariants

**Files:**
- Create: `docs/integration/fate-guardian-current-main-baseline.md`
- Modify: none of the feature source files.

**Interfaces:**
- Produces branch `feature/fate-guardian-current-main`.
- Records current base SHA and exact source branch/commit map.

- [ ] **Step 1: Confirm prerequisite plans are merged into current main**

Run:

```bash
git fetch origin
git switch main
git pull --ff-only
git log -1 --oneline
npm run release:verify
```

Expected: current `main` includes the approved journal/activity, portable-verification, and evidence work selected for this release; the full release gate passes before integration starts.

- [ ] **Step 2: Create an isolated worktree from current main**

Follow `superpowers:using-git-worktrees` and create:

```bash
git worktree add .worktrees/fate-guardian-current-main -b feature/fate-guardian-current-main origin/main
```

Expected: new clean worktree at exactly `origin/main`. Never reuse the stale PR branch.

- [ ] **Step 3: Record immutable source commits**

Capture `git rev-parse origin/main` as `BASE_SHA`, then write:

```markdown
# Fate Guardian current-main rebuild baseline

- Tracker base: the exact `BASE_SHA` captured immediately before this branch
  was created.
- Historical integration source:
  `origin/feature/strict-travel-known-mobility`
- Historical merge base:
  `d563f4e72a7900762c02ad6449e1ce7f81e5ab02`
- Standalone RuneLite source:
  `5cc1ffc4e4f684a99211f12342a69ceb6d16de30`

The historical tracker branch is a source of tested feature commits only. It
must not be merged or force-rebased. Current-main decimal-roll, save-integrity,
content, and release-verification behavior remains authoritative.
```

- [ ] **Step 4: Capture invariant tests**

Run:

```bash
npx vitest run utils/keyRoll.test.ts utils/rollDistribution.test.ts utils/saveSchema.test.ts utils/gamePersistence.test.ts scripts/sync-achievement-diaries.test.ts
```


Expected: PASS. Record the exact command and result in the baseline document.

- [ ] **Step 5: Commit the baseline record**

```bash
git add docs/integration/fate-guardian-current-main-baseline.md
git commit -m "docs: freeze current-main integration baseline"
```

### Task 2: Port compact permissions and rules-manifest foundations

**Files:**
- Create from tested commits: `utils/chunkPermissionSnapshot.ts`
- Create from tested commits: `utils/chunkPermissionSnapshot.test.ts`
- Create from tested commits: `utils/runeliteRulesManifest.ts`
- Create from tested commits: `utils/runeliteRulesManifest.test.ts`
- Modify: `services/ChunkContentService.ts`

**Interfaces:**
- Tested source commits, in dependency order:
  - `f0eac910cb286601c170c0df8429e4e2f1c253b6`
  - `8b6c4aa2cf08f6c3bf6419c05769043b2678dc7c`
- Produces pure compact chunk permissions and the shared rules-manifest builder.
- Does not activate bundle v4; that waits for stable run identity in Task 3.

- [ ] **Step 1: Inspect the exact source tests before applying implementation**

Run:

```bash
git show --stat f0eac91
git show f0eac91:utils/chunkPermissionSnapshot.test.ts
git show --stat 8b6c4aa
git show 8b6c4aa:utils/runeliteRulesManifest.test.ts
```

Expected: the first commit touches only `services/ChunkContentService.ts` and
its new utility/test; the second creates the manifest utility/test and adds one
deferred type-only import to `utils/runeliteExport.ts`.

- [ ] **Step 2: Port the two foundations without committing**

```bash
git cherry-pick --no-commit f0eac910cb286601c170c0df8429e4e2f1c253b6
git cherry-pick --no-commit 8b6c4aa2cf08f6c3bf6419c05769043b2678dc7c
git restore --source=HEAD --staged --worktree -- utils/runeliteExport.ts
```

The restore removes only the unused `GameModeRules` import whose caller arrives
with bundle v4. For a conflict, inspect the unresolved paths and both candidate source patches:

```bash
git diff --name-only --diff-filter=U
git diff --cc
git show --stat f0eac91
git show --stat 8b6c4aa
```

Keep current-main service behavior and add only the exported permission methods
and manifest contracts asserted by the two source tests. After editing every
unresolved path, stage the resolutions and require the final command to print
nothing:

```bash
git add --update
git diff --name-only --diff-filter=U
```

- [ ] **Step 3: Run the foundation tests and typecheck**

```bash
npx vitest run utils/chunkPermissionSnapshot.test.ts utils/runeliteRulesManifest.test.ts
npm run typecheck
```

Expected: PASS while the tracker still emits its current pre-v4 bundle.

- [ ] **Step 4: Commit the foundation layer**

```bash
git add services/ChunkContentService.ts utils/chunkPermissionSnapshot.ts utils/chunkPermissionSnapshot.test.ts utils/runeliteRulesManifest.ts utils/runeliteRulesManifest.test.ts
git diff --cached --check
git commit -m "feat: rebuild shared RuneLite rule foundations"
```

### Task 3: Port durable event protocol and activate rules bundle v4

**Files:**
- Create: `services/fateEventProtocol.ts`
- Create: `services/fateEventProtocol.test.ts`
- Create: `services/fateEventRelay.ts`
- Create: `services/fateEventRelay.test.ts`
- Create: `services/rollInboxStore.ts`
- Create: `services/rollInboxStore.test.ts`
- Modify: `services/relaySync.ts`
- Modify: `services/GearService.ts`
- Modify: `workers/fate-relay/protocol.js`
- Modify: `workers/fate-relay/worker.js`
- Modify: `workers/fate-relay/worker.test.ts`
- Modify: `utils/runeliteBundle.ts`
- Modify: `utils/runeliteBundle.test.ts`
- Modify: `utils/runeliteExport.ts`
- Modify: `utils/runelitePluginParity.test.ts`
- Modify: `utils/runeliteRulesManifest.ts`
- Modify: `utils/runeliteRulesManifest.test.ts`
- Modify: `types.ts`
- Modify: `context/GameContext.tsx`
- Create from tested commit: `context/GameContext.test.tsx`
- Modify: `context/gameReducer.test.ts`
- Modify: `App.tsx`
- Modify: `components/OnlineSyncDriver.tsx`
- Modify: `components/RegionMap.tsx`
- Modify: `docs/online-relay.md`

**Interfaces:**
- Protocol source commits, in order:
  - `f2218e8adb855b83bc81dc42c95bbd2d45e58136`
  - `ae91fa0a424a9b807eecfd31c13ff69d198964e0`
  - `24f4b0de590851997321d24dc3e2bb3f2ea330a0`
  - `e346b7086ba5d857adec41d3529c49b7bce01a66`
- Bundle activation commits, after stable identity exists:
  - `7bf80999f8a76ee5b85ce8127585e7a2ca479f00`
  - `c0906d67efcced84c32b38863100b435cfc9cbb6`
  - `f9e8e2d32ddf4a2adb607bcab88234ff419020bb`
- Produces stable run identity, append/acknowledge events, relay polling,
  durable local inbox storage, bundle v4, and exact equipment permission rules.

- [ ] **Step 1: Inspect the protocol and activation patches**

```bash
git show --stat f2218e8
git show --stat ae91fa0
git show --stat 24f4b0d
git show --stat e346b70
git show --stat 7bf8099
git show --stat c0906d6
git show --stat f9e8e2d
```

Confirm `git merge-base --is-ancestor 24f4b0d 7bf8099` exits 0. This is the
reason bundle v4 must not be applied in Task 2.

- [ ] **Step 2: Port the protocol commits in order**

```bash
git cherry-pick --no-commit f2218e8adb855b83bc81dc42c95bbd2d45e58136
git cherry-pick --no-commit ae91fa0a424a9b807eecfd31c13ff69d198964e0
git cherry-pick --no-commit 24f4b0de590851997321d24dc3e2bb3f2ea330a0
git cherry-pick --no-commit e346b7086ba5d857adec41d3529c49b7bce01a66
```

In `context/GameContext.tsx`, retain:

- current reducer transaction boundaries;
- current `CompletionResult` and manual-attestation paths;
- decimal `LogEntry` fields;
- save-schema-compatible state shape.

Add stable identity and reconcile actions through current reducer conventions
instead of copying the old reducer wholesale.

- [ ] **Step 3: Activate bundle v4 only after stable identity exists**

```bash
git cherry-pick --no-commit 7bf80999f8a76ee5b85ce8127585e7a2ca479f00
git cherry-pick --no-commit c0906d67efcced84c32b38863100b435cfc9cbb6
git cherry-pick --no-commit f9e8e2d32ddf4a2adb607bcab88234ff419020bb
```

For a conflict in either Step 2 or Step 3, inspect the unresolved paths and the
source SHA from the command that failed. These exact source-stat commands cover
the whole layer:

```bash
git diff --name-only --diff-filter=U
git diff --cc
git show --stat f2218e8
git show --stat ae91fa0
git show --stat 24f4b0d
git show --stat e346b70
git show --stat 7bf8099
git show --stat c0906d6
git show --stat f9e8e2d
```

After editing every unresolved path, stage resolutions with `git add --update`
and require `git diff --name-only --diff-filter=U` to print nothing before
running the next cherry-pick command.

Resolve against current-main UI and export guards. Call sites must pass `runId`,
`runRevision`, game mode, linked account, and the Task 2 rules manifest. Keep
current-main saved numeric values as numbers; add no `Math.round`, integer
coercion, or `toFixed` to serialized roll fields.

- [ ] **Step 4: Verify the protocol and bundle boundaries**

The imported protocol must retain:

```ts
export interface FateEventEnvelope {
  version: number;
  runId: string;
  sequence: number;
  events: FateEvent[];
}
```

The relay must append idempotently, acknowledge monotonically, reject malformed
or future versions, and never apply an event directly to game state. Bundle v4
must retain the source commit's root identity and manifest contracts while
preserving exact decimal `rollValue`, `baseThreshold`, and `threshold` values.
Use source names directly; do not create aliases with duplicate meaning.

- [ ] **Step 5: Run protocol, bundle, persistence, and save tests**

```bash
npx vitest run services/fateEventProtocol.test.ts services/fateEventRelay.test.ts services/rollInboxStore.test.ts workers/fate-relay/worker.test.ts context/GameContext.test.tsx context/gameReducer.test.ts utils/chunkPermissionSnapshot.test.ts utils/runeliteRulesManifest.test.ts utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts utils/keyRoll.test.ts utils/rollDistribution.test.ts utils/saveSchema.test.ts utils/gamePersistence.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the durable protocol and bundle layer**

```bash
git add App.tsx components/OnlineSyncDriver.tsx components/RegionMap.tsx context/GameContext.tsx context/GameContext.test.tsx context/gameReducer.test.ts docs/online-relay.md services/GearService.ts services/fateEventProtocol.ts services/fateEventProtocol.test.ts services/fateEventRelay.ts services/fateEventRelay.test.ts services/relaySync.ts services/rollInboxStore.ts services/rollInboxStore.test.ts types.ts utils/runeliteBundle.ts utils/runeliteBundle.test.ts utils/runeliteExport.ts utils/runelitePluginParity.test.ts utils/runeliteRulesManifest.ts utils/runeliteRulesManifest.test.ts workers/fate-relay/protocol.js workers/fate-relay/worker.js workers/fate-relay/worker.test.ts
git diff --cached --check
git commit -m "feat: rebuild durable RuneLite protocol and rules bundle"
```
### Task 4: Port confirmation-first policies and Roll Inbox UI

**Files:**
- Create: `config/detectorPolicies.ts`
- Create: `config/detectorPolicies.test.ts`
- Create: `utils/fateEventEligibility.ts`
- Create: `utils/fateEventEligibility.test.ts`
- Create: `utils/detectorPlaytestReport.ts`
- Create: `utils/detectorPlaytestReport.test.ts`
- Create: `services/rollInboxRuntime.ts`
- Create: `components/RollInbox.tsx`
- Create: `components/RollInbox.test.tsx`
- Create: `components/RollInboxDriver.tsx`
- Create: `components/DetectorPlaytestExport.tsx`
- Delete: `components/SuggestionBanner.tsx`
- Delete: `components/SuggestionQueue.tsx`
- Delete: `services/suggestSync.ts`
- Delete: `services/suggestSync.test.ts`
- Modify: `App.tsx`
- Modify: `components/AutoRollPanel.tsx`
- Modify: `components/CoachStrip.tsx`
- Modify: `components/Dashboard.tsx`
- Modify: `components/DiscordSyncDriver.tsx`
- Modify: `components/FeatureRevealDriver.tsx`
- Modify: `context/GameContext.tsx`
- Modify: `types.ts`
- Modify: `utils/runeliteBundle.ts`
- Modify: `utils/runeliteRulesManifest.ts`
- Modify: `services/fateEventProtocol.ts`
- Modify: `services/rollInboxStore.ts`
- Modify: `README.md`
- Modify: `docs/online-relay.md`
- Create: `docs/detectors/promotion-log.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Tested source commits:
  - `ed58d145c0ebe3a04d30d7e74b3bf450cff2d561`
  - `57c6ef31d5720ee1abe55b41977ce4f37b698521`
  - `199355186512485e7c959431908717a18460f7e3`
  - `8006d5dc05e2f70c36c6968366091980cf590dd0`
  - `a13c6e9c5a1dd7780cdc90800eeb8728868f032f`
  - `86067507f1d7daed5c04993601a1006eb7e377bc`
  - `e220d08192db7c5f9629de9b1993ccac30a4a3cb`
  - `b953a016f3b97eb358b2c91a4d1940118be756e6`
- Produces explicit review/accept/dismiss UI and detector confidence policies.

- [ ] **Step 1: Add the exact test dependencies without replacing current scripts**

Run:

```bash
npm install --save-dev @testing-library/react@16.3.2 @testing-library/user-event@14.6.1 jsdom@29.1.1
```

Expected: `package.json` retains `diary:verify`, `content:verify`, `typecheck`, and `release:verify`; only the three dev dependencies and lockfile resolution are added.

- [ ] **Step 2: Port the policy/UI commits in order**

```bash
git cherry-pick --no-commit ed58d145c0ebe3a04d30d7e74b3bf450cff2d561
git cherry-pick --no-commit 57c6ef31d5720ee1abe55b41977ce4f37b698521
git cherry-pick --no-commit 199355186512485e7c959431908717a18460f7e3
git cherry-pick --no-commit 8006d5dc05e2f70c36b6968366091980cf590dd0
git cherry-pick --no-commit a13c6e9c5a1dd7780cdc90800eeb8728868f032f
git cherry-pick --no-commit 86067507f1d7daed5c04993601a1006eb7e377bc
git cherry-pick --no-commit e220d08192db7c5f9629de9b1993ccac30a4a3cb
git cherry-pick --no-commit b953a016f3b97eb358b2c91a4d1940118be756e6
```

For `package.json`/`package-lock.json` conflicts, keep the npm-install result and current scripts; do not take the historical whole file. For `App.tsx`, `Dashboard.tsx`, `CoachStrip.tsx`, and context conflicts, retain current-main navigation, activity readiness, evidence export, manual journal confirmation, and decimal-roll changes, then add the Roll Inbox mounting/deep link.

- [ ] **Step 3: Enforce confirmation-first behavior**

The final eligibility path must have these properties:

```ts
// CERTAIN machine evidence may be offered for explicit reconciliation.
// CONFIRMATION evidence always requires the player to accept it.
// INFORMATIONAL evidence never mutates progress.
// No detector invokes rollForKey.
```

Verify:

```bash
rg -n "rollForKey|completeQuest|completeDiaryTask|completeCATask" components/RollInbox.tsx components/RollInboxDriver.tsx services/rollInboxRuntime.ts utils/fateEventEligibility.ts
```

Expected: completion APIs appear only in the explicit accepted-event reconciliation path; `rollForKey` is absent from all four files.

- [ ] **Step 4: Run policy and UI tests**

Run:

```bash
npx vitest run config/detectorPolicies.test.ts utils/fateEventEligibility.test.ts utils/detectorPlaytestReport.test.ts services/rollInboxStore.test.ts components/RollInbox.test.tsx context/GameContext.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run current tracker regression tests**

Run:

```bash
npx vitest run components/StatsModal.test.tsx utils/keyEconomyEvidence.test.ts utils/journalStatus.test.ts utils/journalCompletion.test.ts utils/saveSchema.test.ts scripts/sync-achievement-diaries.test.ts
```

Expected: PASS. Fix integration code when these fail; never remove current-main assertions.

- [ ] **Step 6: Commit the confirmation-first layer**

```bash
git add App.tsx README.md components config context docs package.json package-lock.json services types.ts utils
git diff --cached --check
git commit -m "feat: rebuild confirmation-first Roll Inbox"
```

Before committing, verify `git diff --cached --name-status` shows the four obsolete Suggestion files as deleted and the new Roll Inbox files as added.

### Task 5: Mirror standalone commit `5cc1ffc` exactly and add parity CI

**Files:**
- Replace from tested final branch: `runelite-plugin/**`
- Create: `runelite-plugin/SOURCE_COMMIT`
- Create: `scripts/check-runelite-mirror.mjs`
- Create: `scripts/check-runelite-mirror.test.ts`
- Create: `.github/workflows/runelite-mirror.yml`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `ROADMAP.md`

**Interfaces:**
- Produces script: `"runelite:mirror-check": "node scripts/check-runelite-mirror.mjs"`.
- Workflow checks out canonical source at full SHA `5cc1ffc4e4f684a99211f12342a69ceb6d16de30`.

- [ ] **Step 1: Restore the tested final mirror, not intermediate mirror commits**

Run:

```bash
git restore --source origin/feature/strict-travel-known-mobility -- runelite-plugin scripts/check-runelite-mirror.mjs scripts/check-runelite-mirror.test.ts
```

Expected: the whole mirror matches the final historical branch and `runelite-plugin/SOURCE_COMMIT` reads:

```text
5cc1ffc4e4f684a99211f12342a69ceb6d16de30
```

- [ ] **Step 2: Add the current script without replacing other npm scripts**

Add:

```json
"runelite:mirror-check": "node scripts/check-runelite-mirror.mjs"
```

Keep all current release/content scripts and the UI-test dependencies from Task 4.

- [ ] **Step 3: Create canonical mirror CI**

```yaml
name: RuneLite mirror

on:
  pull_request:
  push:
    branches: [main]

jobs:
  parity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          path: app
      - uses: actions/checkout@v4
        with:
          repository: Nubles/OSRS-Fate-Locked-Runelite
          ref: 5cc1ffc4e4f684a99211f12342a69ceb6d16de30
          path: plugin
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
        working-directory: app
      - run: npm run runelite:mirror-check
        working-directory: app
        env:
          RUNELITE_SOURCE_DIR: ${{ github.workspace }}/plugin
```

- [ ] **Step 4: Verify against the standalone worktree**

Point to a clean standalone checkout at exactly `5cc1ffc`:

```powershell
$env:RUNELITE_SOURCE_DIR='C:\tmp\strict-travel-guardian'
npm run runelite:mirror-check
Remove-Item Env:RUNELITE_SOURCE_DIR
```

Before running the verifier, require
`git -C C:\tmp\strict-travel-guardian rev-parse HEAD` to print
`5cc1ffc4e4f684a99211f12342a69ceb6d16de30`. If it does not, stop and restore
that exact tested source revision before comparing. Expected:
`RuneLite mirror matches 5cc1ffc...`.

- [ ] **Step 5: Test real drift and restore it**

Append one harmless byte to a temporary copy through the verifier’s explicit `RUNELITE_MIRROR_DIR` fixture path; do not modify the tracked mirror. Run the script and expect:

```text
changed: README.md
```

The existing `scripts/check-runelite-mirror.test.ts` must also prove added, removed, and changed file reporting.

- [ ] **Step 6: Canonicalize active operational docs**

Use only:

```text
Nubles/OSRS-Fate-Locked-Runelite
https://github.com/Nubles/OSRS-Fate-Locked-Runelite
```

Update README/ROADMAP source ownership and exact `SOURCE_COMMIT`. Do not restore historical old-name text from the stale feature branch.

- [ ] **Step 7: Run mirror and workflow tests**

Run:

```bash
npx vitest run scripts/check-runelite-mirror.test.ts
npm run runelite:mirror-check
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/runelite-mirror.yml README.md ROADMAP.md package.json package-lock.json runelite-plugin scripts/check-runelite-mirror.mjs scripts/check-runelite-mirror.test.ts
git diff --cached --check
git commit -m "chore: mirror canonical RuneLite release"
```

### Task 6: Port known-mobility rules and prove Travel Guardian fail-open semantics

**Files:**
- Modify: `utils/runeliteRulesManifest.ts`
- Modify: `utils/runeliteRulesManifest.test.ts`
- Modify: `utils/runeliteBundle.ts`
- Modify: `utils/runeliteBundle.test.ts`
- Modify: `utils/runeliteExport.ts`
- Modify: `docs/online-relay.md`

**Interfaces:**
- Tested source commits:
  - `263fabe19c66adbdaba55d06865d29113c8c9a58`
  - `f153a3e851ac32078d24dc92d016fc0b940569db`
- Produces authoritative known-mobility rules while retaining fallback mobility authority for older bundles.

- [ ] **Step 1: Port the two commits in order**

```bash
git cherry-pick --no-commit 263fabe19c66adbdaba55d06865d29113c8c9a58
git cherry-pick --no-commit f153a3e851ac32078d24dc92d016fc0b940569db
```

Resolve bundle conflicts by retaining current-main decimal serialization and Task 2’s bundle v4 fields, then adding the exact known-mobility/fallback fields asserted by these commits.

- [ ] **Step 2: Run exact mobility rules tests**

Run:

```bash
npx vitest run utils/runeliteRulesManifest.test.ts utils/runeliteBundle.test.ts utils/runelitePluginParity.test.ts
```

Expected: PASS for:

- published known mobility;
- fallback authority when the explicit field is absent;
- malformed/future version rejection;
- stale and wrong-account non-authority.

- [ ] **Step 3: Verify the mirror pin did not move**

Run:

```bash
git diff -- runelite-plugin
git show HEAD:runelite-plugin/SOURCE_COMMIT
```

Expected: no mirror change in this task; full SHA remains `5cc1ffc4e4f684a99211f12342a69ceb6d16de30`.

- [ ] **Step 4: Commit**

```bash
git add docs/online-relay.md utils/runeliteBundle.ts utils/runeliteBundle.test.ts utils/runeliteExport.ts utils/runeliteRulesManifest.ts utils/runeliteRulesManifest.test.ts
git commit -m "feat: publish Travel Guardian mobility authority"
```

### Task 7: Run complete verification and open the replacement draft PR

**Files:**
- Modify: PR metadata only.
- No new production file required.

**Interfaces:**
- Produces a draft replacement PR from `feature/fate-guardian-current-main`.

- [ ] **Step 1: Run the full tracker release gate**

Run:

```bash
npm test
npm run typecheck
npm run content:verify
npm run build
npm run runelite:mirror-check
```

Expected: all pass.

- [ ] **Step 2: Run standalone automated verification**

In the canonical standalone worktree at `5cc1ffc`:

```bash
gradle clean test jar --no-daemon
```

Expected: 198 tests pass and the standard JAR is produced.

- [ ] **Step 3: Audit preserved current-main behavior**

Run:

```bash
rg -n "toFixed\\(1\\)|formatKeyRoll" components utils context
rg -n "diary:verify|content:verify|release:verify|runelite:mirror-check" package.json
rg -n --hidden "Nubles/RS3-Fate-Locked-Runelite" . --glob "!.git/**" --glob "!node_modules/**"
git diff origin/main...HEAD --stat
git diff --check
```

Expected:

- decimal display helpers remain;
- all four scripts exist;
- old repository name appears only in explicit historical rename prose, never an operational URL/command;
- no conflict markers or whitespace errors.

- [ ] **Step 4: Push the new branch**

```bash
git push -u origin feature/fate-guardian-current-main
```

- [ ] **Step 5: Open a draft PR with exact gate status**

Use title:

```text
Rebuild Fate Guardian integration from current main
```

Body:

```markdown
## Layers

1. compact permission/rules bundle v4;
2. durable event protocol, relay, and local inbox;
3. confirmation-first detector policies and Roll Inbox UI;
4. exact standalone mirror at `5cc1ffc4e4f684a99211f12342a69ceb6d16de30`;
5. known-mobility authority for Travel Guardian.

## Preserved current-main behavior

- exact decimal key rolls and one-decimal presentation;
- current save-integrity and import validation;
- current content/Diary verification, including Windows EOL portability;
- current journal/activity readiness and evidence-export work.

## Automated evidence

- tracker tests/typecheck/content verification/build: passed;
- mirror verifier against canonical standalone checkout: passed;
- standalone `gradle clean test jar --no-daemon`: 198 tests passed.

## Open manual gates

- RuneLite issue #1 clean-client install/re-enable matrix;
- Travel Guardian live interaction matrix.

This PR intentionally remains draft. It must not merge before both live gates
pass. Plugin Hub already resolves to `5cc1ffc`; this PR does not request another
Hub code pin.
```

- [ ] **Step 6: Close superseded PRs without deleting their branches**

Comment on tracker PR #11:

```text
Superseded by #12, which contains this commit stack. Closing the older draft to keep one historical thread; no branch or discussion is deleted.
```

Close #11.

Read the replacement PR URL returned by the create-PR action, then comment on
tracker PR #12 with that URL as the Markdown link target:

```text
Superseded by the current-main replacement PR linked in this comment. The replacement ports the tested work in reviewable layers, preserves the tracker changes merged since this branch diverged, and uses the canonical `5cc1ffc` mirror. This stale branch is not force-rebased or merged.
```

Close #12 only after the replacement draft exists and the comment links back to
its returned URL.

- [ ] **Step 7: Keep the replacement draft pending manual evidence**

Do not mark ready or merge. Link the plugin PR #4 live-matrix result when available. If any Travel Guardian safety case fails, leave the tracker PR draft and follow the standalone rollback plan before further integration.
