# Active Issues and Repository Cleanup Design

**Date:** 2026-07-25
**Status:** Approved design, pending implementation plan
**Repository:** `Nubles/OSRS-Fate-Locked`
**Companion repository:** `Nubles/OSRS-Fate-Locked-Runelite`

## Objective

Resolve the tracker-side portions of the currently open issue set, remove stale
references left by the RuneLite repository rename, restore a portable release
verification command, and replace the stale integration pull-request stack with
a reviewable branch based on current `main`.

The work must preserve player control, existing save compatibility, current
production key rates, and the distinction between machine-verifiable
eligibility and requirements that need player confirmation or real-world
evidence.

## Current Baseline

- `main` is `fc45d3d614025b8d4e47863d9ba420e24b722795`.
- All 89 test files and 929 tests pass.
- `npm run typecheck` passes.
- `npm audit --json` reports no known vulnerabilities.
- `npm run release:verify` fails on Windows during `diary:verify` even though
  regenerating the two reported files produces the same Git blobs. The check is
  comparing LF renderer output with CRLF working-tree text byte-for-byte.
- Draft PR #12 is 82 commits behind current `main`, 30 commits ahead of its
  merge base, changes 128 files, and conflicts in core application state,
  package metadata, UI, bundle generation, and the RuneLite mirror.
- Draft PR #11 is an ancestor of PR #12.

## Scope

### Included

- Finish the acceptance criteria for issues #7 and #8 and close them with test
  evidence.
- Implement explicit coupled activity dependencies for issue #9.
- Implement the tracker-side diary and unlock-pool portions of RuneLite issue
  #5.
- Define an actionable, privacy-safe evidence protocol for issue #10 without
  changing rates.
- Fix Windows line-ending portability in diary verification.
- Replace active references to
  `Nubles/RS3-Fate-Locked-Runelite` with
  `Nubles/OSRS-Fate-Locked-Runelite`.
- Replace the stale PR #11/#12 stack with a current-main integration branch.
- Correct active README build and companion-repository instructions.

### Excluded

- Any production key-rate, Fate Point, pity, boss-cap, or diminishing-return
  change.
- Automatic collection or transmission of player telemetry.
- Promotion of confirmation-only RuneLite detectors.
- Merging Travel Guardian before its live interaction matrix passes.
- Rewriting historical Git commit messages.

## 1. Quest Location Completion: Issue #7

The reported functional defects are already fixed on `main`:

- `A Porcine of Interest` requires Draynor Village and the exact South Falador
  Farm chunk.
- `Enter the Abyss` requires Misthalin plus one of East Ardougne, Tree Gnome
  Stronghold, or the Wizards' Guild.

Focused quest, advisor, completion, and content-baseline tests already exercise
the corrected data. One acceptance gap remains: missing location evidence must
not be presented as a positive doability result.

### Design

The quest doability adapter will use this precedence:

1. Completed quests remain `DONE`.
2. Explicit canonical region/location blockers remain `LOCKED`.
3. Known chunk reachability determines `DOABLE`, `REQS`, `STRANDED`, or
   `LOCKED`.
4. When neither canonical location evidence nor chunk-location evidence exists,
   return the existing `NO_DATA` bucket.

An explicit canonical location requirement remains authoritative even if the
chunk-content lookup has no matching entity record. `NO_DATA` is only for the
absence of both sources, not a replacement for known rules.

Add a regression proving that an artificial quest with no canonical location
evidence and no chunk record is `NO_DATA`, while the two reported quests retain
their corrected statuses. Close issue #7 after the full suite passes.

## 2. Diary Method Caps: Issue #8

The shared `effectiveSkillLevel` and `meetsSkillRequirement` path already caps
every skill by its unlocked training-method band. Diary eligibility, advisor
counts, goal planning, and display consumers already use this path.

### Design

Add a regression using the real `lum_easy_7` task:

- Woodcutting and Firemaking levels at 15 with only their first method band
  unlocked must be `Not ready`.
- Unlocking the next method band, while retaining level 15, must make the task
  machine-eligible.

The product exposes method bands in ten-level increments, so the executable
case is cap 10 versus the next band that permits level 15, rather than inventing
a persistent cap-15 tier. Close issue #8 with this explanation and the passing
test evidence.

## 3. Activity Readiness and Coupled Dependencies: Issue #9

An activity's roll state and its usability state are different. The player may
own Pest Control while Void Knights' Outpost remains locked. The current
dashboard shows only owned versus locked and treats `ACTIVITY_REGIONS` as an
informational continent tag.

### Data Model

Extend `ActivityReq` with machine-readable hard gates:

```ts
interface ActivityReq {
  skills?: Record<string, number>;
  quests?: string[];
  requiredAreas?: string[];
  combatLevel?: number;
  manualRequirements?: string[];
  note?: string;
}
```

- `requiredAreas` names unlock-system areas and is evaluated through
  `isAreaReachable`, so standard and chunked modes share the same rule.
- `combatLevel` replaces prose for exact combat gates.
- `manualRequirements` contains hard requirements the tracker cannot prove.
- `note` remains explanatory and does not silently become a blocker.

### Eligibility Result

Create a pure activity-readiness evaluator returning:

```ts
type ActivityReadiness =
  | { status: 'LOCKED'; blockers: [] }
  | { status: 'NOT_READY'; blockers: ActivityBlocker[] }
  | { status: 'NEEDS_CONFIRMATION'; checks: string[] }
  | { status: 'READY' };
```

Evaluation order:

1. If the activity itself has not been rolled, it is `LOCKED`.
2. Missing area, quest, skill-cap, or combat requirements yield `NOT_READY`.
3. With all machine gates met but unresolved manual requirements, return
   `NEEDS_CONFIRMATION`.
4. Otherwise return `READY`.

Dashboard cards retain their ownership icon but gain a compact readiness badge
and blocker summary. Search and category counts continue to count ownership;
they do not pretend that readiness is another unlock.

### Dependency Audit

The initial curated audit covers only clear one-location hard dependencies that
already exist in the region unlock data:

- Pest Control -> Void Knights' Outpost
- Barbarian Assault -> Barbarian Outpost
- Castle Wars -> Castle Wars
- Fishing Trawler -> Port Khazard
- Gnome Ball -> Tree Gnome Stronghold
- Gnome Restaurant -> Tree Gnome Stronghold
- Nightmare Zone -> Yanille
- TzHaar Fight Pit -> Mor Ul Rek (TzHaar City)
- Burthorpe Games Room -> Burthorpe
- Mage Training Arena -> Mage Training Arena
- Warriors' Guild -> Warriors' Guild

Do not infer vague continent dependencies or encode recommended levels as hard
gates. Tests cover Pest Control-only, outpost-only, both, and neither, plus at
least one standard/chunked parity case and one manual-confirmation case.

## 4. Diary Accuracy and Unlock-Pool Discoverability: RuneLite Issue #5

### Varrock Medium

Add a first-class `questPoints?: number` field to generated diary task
requirements. The evaluator derives current Quest Points from completed
canonical quests, as quest eligibility already does.

The generated source record for entering the Champions' Guild requires 32 Quest
Points. Do not encode Quest Points as a pseudo-skill because method-cap logic is
not applicable.

### Varrock Hard

Do not add Bone Voyage as a prerequisite for 153 Kudos. Bone Voyage unlocks
additional fossil Kudos, but is not itself required to reach the diary
threshold.

Add `manualRequirements?: string[]` to diary task data and set:

```ts
manualRequirements: ['153 Varrock Museum Kudos']
```

Diary evaluation will distinguish:

- `machineEligible`: all tracked gates pass;
- `manualChecks`: requirements the app cannot prove;
- `eligible`: machine gates pass and no manual checks remain;
- `confirmable`: machine gates pass and the player may attest the manual check.

Advisors and automatic doability counts use `eligible`, preventing a false
recommendation. Manual completion uses `confirmable`, presents the check
clearly, and records the player's existing completed-task action as the
attestation. The tracker never fabricates a Kudos total.

Existing quest `manualRequirements` will use the same presentation semantics so
the currently dead `Prying Times` requirement becomes visible rather than
remaining inert metadata.

### Unlock Pools

The dashboard already renders owned and locked entries without requiring Keys.
The missing feature is discoverability from the spending workflow.

Add a `View pool` action beside every spend-category roll control. It remains
enabled with zero Keys and navigates to the matching dashboard category with
the existing search, ownership state, progress count, and notes intact. No
second pool dataset or alternative RNG path is introduced.

### Boss Suggestions

Brutus, diminishing odds, and per-boss lifetime caps are not implemented in
this change. Summarize them on issue #10 and close RuneLite issue #5 only after
the diary and pool work lands and the unresolved balance proposal is visibly
tracked there.

## 5. Evidence Before Rebalancing: Issue #10

Keep issue #10 open. Current history and Fate Report data already provide:

- attempt count;
- source/category;
- expected and actual successes;
- roll thresholds;
- longest drought and hot streak;
- timestamps stored in the local run.

They do not reliably provide active playtime, comparable run stage, participant
consent, or a representative sample.

### Evidence Protocol

Document a voluntary, privacy-safe report schema:

- anonymous report ID generated for the export;
- game mode;
- declared stage: early, mid, or late, with published classification rules;
- observed play-hours for the reporting window, entered by the player;
- per-source attempts, successes, expected successes, and Fate Points;
- overall and per-source drought summaries;
- schema/app version.

Exclude account names, run IDs, raw history, exact event timestamps, relay
codes/tokens, chat, and device/network identifiers.

Define the review gate before modeling:

- reports from at least 10 independent runs;
- at least 500 scoreable attempts in each stage;
- at least three materially different source categories represented per stage;
- publish median keys/hour, interquartile range, and drought percentiles;
- model proposed variants offline from the same immutable sample;
- require a separate design and approval before changing production rates.

The first implementation may document the schema and provide a local aggregate
export, but issue #10 cannot close until the sample threshold is actually met.

## 6. Portable Release Verification

`renderDiaryTasks` and `renderTaskIdMigrations` intentionally render LF text.
Git may expose tracked files as CRLF in a Windows checkout. The current
byte-string comparison therefore reports false drift.

Normalize `\r\n` and lone `\r` to `\n` only at comparison boundaries. Do not
normalize semantic content, trim whitespace, or weaken stale-content
detection.

Tests must prove:

- LF output is accepted;
- equivalent CRLF output is accepted;
- a real textual change is rejected;
- both generated files are reported when both drift;
- `--check` remains read-only.

After the fix, `npm run release:verify` must pass on Windows and CI.

## 7. Canonical Repository References

Replace maintained references to the previous RuneLite repository name in:

- `.claude/skills/fate-locked-workflow/SKILL.md`;
- `ROADMAP.md`;
- README companion/build guidance;
- active GitHub Actions workflow checkout configuration;
- cross-repository design and plan documents where the old name is still
  operational guidance;
- issue #7-#10 source links.

The canonical value is:

```text
Nubles/OSRS-Fate-Locked-Runelite
https://github.com/Nubles/OSRS-Fate-Locked-Runelite
```

README build instructions must describe the actual standard RuneLite build
(`gradle test jar` or `gradle build`) and must not claim that a missing Gradle
wrapper or `shadowJar` task exists.

## 8. Pull-Request Cleanup

### PR #11

Close as superseded by #12, with a comment linking the successor and explaining
that its commits are already contained there.

### PR #12

Do not resolve its large conflict set directly and do not force-rewrite it.
Create a new branch from current `main` and port the intended integration in
reviewable layers:

1. canonical rules/bundle contract;
2. durable Roll Inbox and relay changes;
3. detector policies and confirmation UI;
4. exact RuneLite source mirror and `SOURCE_COMMIT`;
5. Travel Guardian mobility contract and documentation.

Each layer must preserve the current decimal-roll, strict-save, generated diary,
and state-commit behavior added since the old merge base. Open a replacement
draft PR, cross-link it, then close #12 as superseded.

The replacement remains draft until the companion RuneLite live matrix passes.

## 9. Verification and Closure

Required tracker verification:

- focused regressions for issues #7, #8, #9, and #5;
- generator unit tests, including CRLF;
- full `npm test`;
- `npm run typecheck`;
- `npm run content:verify`;
- `npm run build`;
- exact RuneLite mirror verification on the replacement integration branch.

Issue comments must state what was verified, link the implementing PR/commit,
and distinguish closed code defects from remaining release/evidence gates.

## Rollback

The tracker changes are additive data/evaluator/UI changes and can be reverted
by their focused commits. Generated diary-source and renderer changes must
revert together. The replacement integration PR remains draft, so it has no
production effect until explicitly merged.
