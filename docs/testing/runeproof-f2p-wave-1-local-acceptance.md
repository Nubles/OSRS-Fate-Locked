# RuneProof F2P Wave 1 release-candidate acceptance

RuneProof must pass both automated release verification and Alex's local visual/play review of the normal production build before it can be pushed, merged, deployed, announced, or released.

## Review record

| Field | Value |
|---|---|
| Candidate | `feature/runeproof-flagship-preview` working tree; final commit recorded after verification |
| Public scope | Cook's Assistant, Sheep Shearer, The Restless Ghost, Rune Mysteries, and Imp Catcher |
| Private preview scope | Daddy's Home, Doric's Quest, Elemental Workshop I, and future unfinished guides |
| Private preview URL | `http://127.0.0.1:4175/` |
| Production-candidate URL | `http://127.0.0.1:4176/` |
| Preview review | Alex approved the interaction design and authorised preparation of a release candidate on 2026-08-22 |
| Production approval | **PENDING ALEX** |

## Safety rules

1. Use a disposable QA profile and only app-supported import/export flows. Never record sync payloads here.
2. Inspect the rendered application and actual interactions. Automated assertions support but do not replace visual approval.
3. RuneProof confirmation must remain run-scoped guide tracking. It must not complete the Journal quest or grant Keys, Fate rolls, rewards, history, or canonical save progress.
4. The public production bundle must contain only the five independently authored guides. The private preview catalogue and its source-review metadata must remain absent even if a deployment environment accidentally contains `VITE_RUNEPROOF_PREVIEW=1`.
5. Final production approval is distinct from approval to prepare this candidate.

## Required visual scenarios

### 1. Public RuneProof scope

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- The normal build is labelled RuneProof and offers exactly the five public Wave 1 quests.
- Daddy's Home, Doric's Quest, Elemental Workshop I, and unsupported quests are not shown in its quest picker.

### 2. Cook's Assistant

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- The accepted nine-step local route is intact, each step shows its chunk, the temporary map returns to the same active step, and final confirmation reaches 9/9.

### 3. Sheep Shearer

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- Five ordered steps cover the local shear/spin route and quantity 20, with chunk display, map return, persistence, and final confirmation.

### 4. The Restless Ghost

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- Seven ordered steps cover the complete route, retain the avoidable-skeleton guidance, and support chunk display, map return, persistence, and final confirmation.

### 5. Rune Mysteries

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- Five ordered hand-offs cover Lumbridge, Wizards' Tower, and Varrock, with chunk display, map return, persistence, and final confirmation.

### 6. Imp Catcher

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- Four beads are independently confirmable. RuneProof promotes a reachable legal Imp source in an unlocked chunk instead of waiting for Falador, then returns to Wizards' Tower.

### 7. Temporary-map context

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- Opening and closing a step map returns to the exact quest and active step without a stale previous-quest flicker.

### 8. Persistence and game-state isolation

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- Switching among all five quests and reloading preserves run-scoped guide progress.
- Final confirmation changes only RuneProof tracking: Journal completion, Keys, Fate rolls, rewards, exports, sync, and history are unchanged.

### 9. Public/private build boundary

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- The normal build shows the independently authored public guides and no private-source wording or preview-only quests.
- The explicit `runeproof-preview` mode still provides the private catalogue for future local development.

### 10. Desktop and mobile layout

- [ ] PASS  [ ] FAIL  **Status: PENDING ALEX ON PRODUCTION CANDIDATE**
- Desktop `1440 x 900` and mobile `390 x 844` views have readable chunks, reachable controls, correct focus order, no overlap, and no horizontal overflow.

## Fresh automated evidence

These results are from the final working-tree candidate; no earlier preview-only run is counted as release evidence.

| Gate | Result | Evidence |
|---|---:|---|
| Focused RuneProof and release-safety tests | PASS | 14 files / 195 tests passed; the final production-bundle/boundary check also passed 2 files / 4 tests |
| Contaminated-environment production-boundary regression | PASS | Normal production mode retained the public pack and excluded the private walkthrough payload plus all eight private release revisions with `VITE_RUNEPROOF_PREVIEW=1` present |
| Typecheck | PASS | `tsc --noEmit` completed without diagnostics |
| Content verification | PASS | Diary, chunk, quest, route, walkthrough, baseline, task, migration, and progress checks passed |
| Full release gate | PASS | `npm run release:verify`: 233 test files / 2,851 tests, typecheck, content verification, and normal production build all passed |
| Private preview build | PASS | `npm run build:runeproof-preview`: 2,686 modules transformed; private and public catalogue chunks remained separate |
| Normal production build visual smoke | SUPPORTING PASS | Codex checked desktop `1440 x 900` and mobile `390 x 844` at `http://127.0.0.1:4176/`; exact five-quest scope, chunk display, temporary-map return, local Imp route, 9/9 final confirmation, reload persistence, and state isolation behaved correctly with no console errors |
| Diff and worktree review | PASS | `git diff --check` reported no whitespace errors; only the existing Windows line-ending warnings were emitted |

## Sign-off

| Gate | Status | Tester | Evidence/notes |
|---|---|---|---|
| Preview interaction design | **APPROVED TO PREPARE RC** | Alex | Each step chunk, temporary-map return, final confirmation without Key rolls, five-quest visibility, stale-quest flicker fix, and reachable Imp-source correction were reviewed locally. |
| Fresh automated release gates | **PASS** | Codex | Full release verification, private preview build, production bundle contamination regression, and diff check passed on the final working-tree candidate. |
| Production browser supporting review | **PASS - SUPPORTING EVIDENCE ONLY** | Codex | The production build at `http://127.0.0.1:4176/` passed desktop/mobile inspection, complete Cook flow, temporary-map return, Imp route, reload persistence, state-isolation comparison, provenance inspection, and console check. |
| Final production build visual/play review | **REQUIRED - PENDING** | Alex | No release action is authorised until Alex explicitly approves the locally served normal production build. |
