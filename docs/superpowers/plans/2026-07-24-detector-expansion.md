# Fate Guardian Detector Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the durable Roll Inbox to Slayer, individual Diary tasks, pets, supported minigames, and more precise boss sources while proving that ordinary farming does not create ineligible rolls, without weakening the player-controlled roll or conservative confidence model.

**Architecture:** Each detector is a small state machine with checked-in fixtures and a stable ID/version. The app owns a detector policy registry that initially downgrades every new detector to Needs confirmation; promotion to Ready is a separate data-only change backed by fixture coverage and exported local playtest evidence.

**Tech Stack:** Java 11/RuneLite events/JUnit, React/TypeScript/Vitest, existing v1 event protocol and v4 rules manifest.

## Global Constraints

- Every detector added by this project starts in **Needs confirmation**.
- A detector may become Ready only through the app's approved detector policy registry.
- Promotion requires fixture coverage, real playtesting, and evidence that exact-detector false positives remain below 0.5%.
- At least 95% of promoted detections should require no correction.
- No detector invokes RNG, presses Roll, awards keys, selects unlocks, or performs gameplay.
- Only the web Roll Inbox's player-operated Roll button calls `rollForKey`.
- Unsupported, ambiguous, stale, wrong-account, joined-mid-state, and unknown events remain Needs confirmation.
- Detection evidence stays minimal and primitive.
- No behavioral analytics are uploaded; playtest reports are local JSON exports.
- Strict Mode scope must not expand in the same Plugin Hub submission.
- Approved design: `docs/superpowers/specs/2026-07-24-fate-guardian-runelite-design.md`.
- Projects 1–3 must be complete first.

---

## Detector policy contract

```ts
export interface DetectorPolicy {
  detectorId: string;
  maxApprovedVersion: number;
  handling: 'CONFIRMATION' | 'EXACT';
  eventTypes: FateEventType[];
}
```

New policy entries use `handling: 'CONFIRMATION'`. The classifier computes:

```ts
const canBeReady =
  policy.handling === 'EXACT' &&
  event.detectorVersion <= policy.maxApprovedVersion &&
  event.confidence === 'EXACT';
```

All three conditions are required.

### Task 1: Add the app-owned detector policy registry

**Files:**
- Create: `config/detectorPolicies.ts`
- Create: `config/detectorPolicies.test.ts`
- Modify: `utils/fateEventEligibility.ts`
- Modify: `utils/fateEventEligibility.test.ts`
- Modify: `utils/runeliteRulesManifest.ts`

**Interfaces:**
- `policyFor(detectorId: string): DetectorPolicy | null`.
- Exports policies in bundle v4 as `detectorPolicies`.
- Unknown detectors always require confirmation.

- [ ] **Step 1: Write failing policy tests**

```ts
it.each([
  'slayer-task-v1',
  'diary-task-v1',
  'pet-drop-v1',
  'minigame-completion-v1',
  'boss-kill-v2',
])('%s starts confirmation-only', detectorId => {
  expect(policyFor(detectorId)?.handling).toBe('CONFIRMATION');
});

it('does not trust a plugin confidence claim above app policy', () => {
  const result = classifyFateEvent(event({
    detectorId: 'pet-drop-v1',
    detectorVersion: 1,
    confidence: 'EXACT',
  }), state);
  expect(result.state).toBe('NEEDS_CONFIRMATION');
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- config/detectorPolicies.test.ts utils/fateEventEligibility.test.ts`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement fail-closed policy lookup**

Add all existing Project 1 detectors with their approved state, then add the six new IDs above as confirmation-only. An absent ID, newer version, or event-type mismatch returns confirmation with reason `Detector version is not approved for exact handling`.

- [ ] **Step 4: Verify manifest size and tests**

Run:

```bash
npm test -- config/detectorPolicies.test.ts utils/fateEventEligibility.test.ts utils/runeliteBundle.test.ts
```

Expected: PASS; compressed bundle remains below 256 KiB.

- [ ] **Step 5: Commit**

```bash
git add config/detectorPolicies.ts config/detectorPolicies.test.ts utils/fateEventEligibility.ts utils/fateEventEligibility.test.ts utils/runeliteRulesManifest.ts
git commit -m "feat: gate detector confidence in the app"
```

### Task 2: Detect Slayer task completion with persisted assignment state

**Files:**
- Create: `src/main/java/com/fatelocked/detectors/SlayerTaskDetector.java`
- Create: `src/main/java/com/fatelocked/detectors/SlayerAssignmentState.java`
- Create: `src/test/java/com/fatelocked/detectors/SlayerTaskDetectorTest.java`
- Modify: `src/main/java/com/fatelocked/events/FateEventType.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Modify: app `services/fateEventProtocol.ts`

**Interfaces:**
- Adds event type `SLAYER_TASK`.
- Evidence: assignment name, master when known, start count, completion signature, and `joinedMidAssignment`.
- State persists under `${RuneLite.RUNELITE_DIR}/fate-locked/slayer-assignment.json`.

- [ ] **Step 1: Write state-machine fixtures**

```text
assignment received + count reaches zero + completion message -> one event
login during an active assignment + completion message         -> joinedMidAssignment=true
task cancelled or replaced                                    -> no completion event
duplicate completion messages                                  -> one event
unknown master                                                 -> event retained for confirmation
restart after assignment received                              -> state restored
```

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.detectors.SlayerTaskDetectorTest --no-daemon`

Expected: FAIL because the detector does not exist.

- [ ] **Step 3: Implement the state machine**

Use exact assignment and completion chat patterns plus Slayer task varp/count where available. Persist after every transition. Emit only after a tracked assignment transitions to complete. Joined-mid-assignment always sets evidence that forces confirmation.

- [ ] **Step 4: Add app mapping**

Map known masters to the existing `DropSource.SLAYER_*` rates. Unknown master produces candidate selection. Keep `slayer-task-v1` confirmation-only.

- [ ] **Step 5: Verify both repositories**

Plugin: `gradle test --tests com.fatelocked.detectors.SlayerTaskDetectorTest --no-daemon`

App: `npm test -- services/fateEventProtocol.test.ts utils/fateEventEligibility.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Plugin:

```bash
git add src/main/java/com/fatelocked/detectors src/main/java/com/fatelocked/events/FateEventType.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/detectors
git commit -m "feat: detect tracked Slayer completions"
```

App:

```bash
git add services/fateEventProtocol.ts services/fateEventProtocol.test.ts utils/fateEventEligibility.ts utils/fateEventEligibility.test.ts
git commit -m "feat: review Slayer events in Roll Inbox"
```

### Task 3: Resolve individual Diary tasks from an exact tier completion

**Files:**
- Create: `src/main/java/com/fatelocked/detectors/DiaryTierReviewDetector.java`
- Create: `src/test/java/com/fatelocked/detectors/DiaryTierReviewDetectorTest.java`
- Modify: `src/main/java/com/fatelocked/events/FateEventType.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Modify: app `services/fateEventProtocol.ts`
- Modify: app `utils/fateEventEligibility.ts`
- Modify: app `utils/fateEventEligibility.test.ts`

**Interfaces:**
- Adds event type `DIARY_TASK` with nullable canonical label.
- Plugin evidence is `{tierId: string, previousValue: 0, completedValue: 1}` using the existing 48 `Varbits.DIARY_*` tier constants.
- The app builds review candidates from `ALL_DIARY_TASKS.filter(task => task.tierId === tierId && !completedTasks.includes(task.id))`.
- A tier completion never fabricates one event per task; the player selects the individual tasks actually completed.

- [ ] **Step 1: Write detector and candidate fixtures**

Test login baseline, one `0 -> 1` tier transition, duplicate varbit notifications, a reversed/reset transition, unrelated varbit, an already-completed app task, and a tier with three unresolved candidates.

```java
assertEquals("Ardougne Easy",
    detector.onVarbit(DIARY_ARDOUGNE_EASY, 0, 1).get().getEvidence().get("tierId"));
assertFalse(detector.onVarbit(DIARY_ARDOUGNE_EASY, 1, 1).isPresent());
```

```ts
expect(classifyFateEvent(diaryTierEvent('Ardougne Easy'), state)).toMatchObject({
  state: 'NEEDS_CONFIRMATION',
  candidates: expect.arrayContaining([
    expect.objectContaining({ canonicalLabel: 'ard_easy_1' }),
  ]),
});
```

- [ ] **Step 2: Run the failing tests**

Plugin: `gradle test --tests com.fatelocked.detectors.DiaryTierReviewDetectorTest --no-daemon`

App: `npm test -- services/fateEventProtocol.test.ts utils/fateEventEligibility.test.ts`

Expected: FAIL because the detector and `DIARY_TASK` handling do not exist.

- [ ] **Step 3: Implement one review event per tier**

Move the current diary varbit baseline/transition logic into `DiaryTierReviewDetector`. Emit detector ID `diary-task-v1`, version 1, and confirmation confidence. The app displays unresolved `ALL_DIARY_TASKS` as checkboxes; confirming reconciles only the selected task IDs and creates one Ready row per selected task, all linked to the original event ID plus a deterministic `:<taskId>` suffix.

- [ ] **Step 4: Preserve roll control and deduplication**

Each selected task becomes its own Inbox occurrence and uses its diary tier's existing `DropSource.DIARY_*` rate. Merely selecting or reconciling a task does not roll. Reopening the review cannot recreate a task suffix already present in active inbox state or roll history.

- [ ] **Step 5: Verify and commit**

Plugin:

```bash
gradle test --tests com.fatelocked.detectors.DiaryTierReviewDetectorTest --no-daemon
git add src/main/java/com/fatelocked/detectors/DiaryTierReviewDetector.java src/main/java/com/fatelocked/events/FateEventType.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/detectors/DiaryTierReviewDetectorTest.java
git commit -m "feat: queue Diary tier task review"
```

App:

```bash
npm test -- services/fateEventProtocol.test.ts utils/fateEventEligibility.test.ts components/RollInbox.test.tsx
git add services/fateEventProtocol.ts services/fateEventProtocol.test.ts utils/fateEventEligibility.ts utils/fateEventEligibility.test.ts components/RollInbox.tsx components/RollInbox.test.tsx
git commit -m "feat: resolve individual Diary task rolls"
```

### Task 4: Detect exact pet identity where RuneLite exposes it

**Files:**
- Create: `src/main/java/com/fatelocked/detectors/PetDropDetector.java`
- Create: `src/main/resources/pet-identities.json`
- Create: `src/test/java/com/fatelocked/detectors/PetDropDetectorTest.java`
- Modify: `src/main/java/com/fatelocked/events/FateEventType.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Modify: app protocol and eligibility tests

**Interfaces:**
- Adds event type `PET_DROP`.
- Evidence: new-pet chat signature and follower NPC/composition ID when available.
- Exact canonical label requires one mapped follower identity; otherwise null with candidates.

- [ ] **Step 1: Write pet fixtures**

Test exact new-pet message plus mapped follower ID, generic “funny feeling” without follower, reclaim/insurance messages, follower change without a new-pet message, and duplicate event callbacks.

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.detectors.PetDropDetectorTest --no-daemon`

Expected: FAIL because the detector does not exist.

- [ ] **Step 3: Implement two-signal correlation**

Open a five-second correlation window only after an allowlisted new-pet chat signature. Resolve the current follower ID against `pet-identities.json`. A follower change alone emits nothing. A generic message without identity emits one uncertain event.

- [ ] **Step 4: Map to the app**

All resolved pets use `DropSource.PET` and its existing rate. Keep `pet-drop-v1` confirmation-only.

- [ ] **Step 5: Verify and commit**

Plugin:

```bash
gradle test --tests com.fatelocked.detectors.PetDropDetectorTest --no-daemon
git add src/main/java/com/fatelocked/detectors/PetDropDetector.java src/main/resources/pet-identities.json src/main/java/com/fatelocked/events/FateEventType.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/detectors/PetDropDetectorTest.java
git commit -m "feat: correlate new pet detections"
```

App:

```bash
npm test -- services/fateEventProtocol.test.ts utils/fateEventEligibility.test.ts
git add services/fateEventProtocol.ts services/fateEventProtocol.test.ts utils/fateEventEligibility.ts utils/fateEventEligibility.test.ts
git commit -m "feat: review pet drops in Roll Inbox"
```

### Task 5: Add a dedicated Pest Control completion detector

**Files:**
- Create: `src/main/java/com/fatelocked/detectors/MinigameCompletionDetector.java`
- Create: `src/main/resources/minigame-completions.json`
- Create: `src/test/java/com/fatelocked/detectors/MinigameCompletionDetectorTest.java`
- Modify: plugin `FateEventType.java` and `FateLockedPlugin.java`
- Modify: app protocol, eligibility, and tests

**Interfaces:**
- Adds `MINIGAME_COMPLETION`.
- Initial mapping ID is `pest-control-win-v1`, canonical label `Pest Control`.
- A completion requires both `WidgetID.PEST_CONTROL_GROUP_ID` and the normalized exact game message `You have won the game!` within a five-second correlation window.
- Ordinary harvests, Farming contract messages, patch-state changes, and Hespori planting emit no event because the current economy defines no farming key source; Hespori kills remain boss events.

- [ ] **Step 1: Write failing positive and negative tests**

Test the paired Pest Control signal, the widget without the win message, the win message outside Pest Control, `You have lost the game.`, login baseline, duplicate callbacks, and these non-events: herb-patch harvest, Farming contract completion, Hespori seed planting, and Hespori growth.

```java
assertEquals(Optional.of("Pest Control"),
    detector.onSignals(PEST_CONTROL_GROUP_ID, "You have won the game!", now)
        .map(DetectedEvent::getCanonicalLabel));
assertFalse(detector.onMessage("You have won the game!", now.plusSeconds(6)).isPresent());
assertFalse(detector.onMessage("You have completed a farming contract.", now).isPresent());
```

- [ ] **Step 2: Run the failing test**

Run: `gradle test --tests com.fatelocked.detectors.MinigameCompletionDetectorTest --no-daemon`

Expected: FAIL because the class does not exist.

- [ ] **Step 3: Implement the two-signal detector**

Open the correlation window when the Pest Control widget loads, accept only the exact normalized win message inside that window, close the window after one event, and deduplicate by game cycle. Do not add a catch-all `game complete` regex. Emit detector ID `minigame-completion-v1`, version 1, and confirmation confidence.

- [ ] **Step 4: Map the event in the app**

Require `Pest Control` in `unlocks.minigames`, then map to `DropSource.ACTIVITY_MINIGAME`. A locked Pest Control run classifies Blocked. Keep `minigame-completion-v1` confirmation-only.

- [ ] **Step 5: Verify and commit**

Plugin:

```bash
gradle test --tests com.fatelocked.detectors.MinigameCompletionDetectorTest --no-daemon
git add src/main/java/com/fatelocked/detectors src/main/resources/minigame-completions.json src/main/java/com/fatelocked/events/FateEventType.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/detectors
git commit -m "feat: detect Pest Control completions"
```

App:

```bash
npm test -- services/fateEventProtocol.test.ts utils/fateEventEligibility.test.ts
git add services/fateEventProtocol.ts services/fateEventProtocol.test.ts utils/fateEventEligibility.ts utils/fateEventEligibility.test.ts
git commit -m "feat: review Pest Control events in Roll Inbox"
```

### Task 6: Replace boss combat-level heuristics with named encounter evidence

**Files:**
- Create: `src/main/java/com/fatelocked/detectors/BossKillDetectorV2.java`
- Create: `src/main/resources/boss-encounters.json`
- Create: `src/test/java/com/fatelocked/detectors/BossKillDetectorV2Test.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Modify: app `config/detectorPolicies.ts`
- Modify: app `utils/fateEventEligibility.ts`

**Interfaces:**
- Detector ID `boss-kill-v2`.
- Mapping contains canonical boss, accepted RuneLite loot/NPC identity, encounter kind, and whether group loot can prove participation.
- Combat level is supplementary evidence only.

- [ ] **Step 1: Write encounter fixtures**

Test exact named boss loot, raid reward, ordinary high-level Slayer monster, boss add/minion, group encounter without personal completion evidence, duplicate loot callback, and an app boss name alias.

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.detectors.BossKillDetectorV2Test --no-daemon`

Expected: FAIL because v2 does not exist.

- [ ] **Step 3: Implement canonical named mapping**

Require a mapping hit; never use `combatLevel >= threshold` to emit exact confidence. Group encounters without personal completion proof remain uncertain. Preserve the Project 1 detector for one compatibility release but have it emit only when v2 has no mapping.

- [ ] **Step 4: Verify and commit**

Keep the policy confirmation-only.

Plugin:

```bash
gradle test --tests com.fatelocked.detectors.BossKillDetectorV2Test --no-daemon
git add src/main/java/com/fatelocked/detectors/BossKillDetectorV2.java src/main/resources/boss-encounters.json src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/detectors/BossKillDetectorV2Test.java
git commit -m "feat: identify named boss encounters"
```

App:

```bash
npm test -- config/detectorPolicies.test.ts utils/fateEventEligibility.test.ts
git add config/detectorPolicies.ts config/detectorPolicies.test.ts utils/fateEventEligibility.ts utils/fateEventEligibility.test.ts
git commit -m "feat: review boss detector v2 events"
```

### Task 7: Export local detector quality reports

**Files:**
- Create: `utils/detectorPlaytestReport.ts`
- Create: `utils/detectorPlaytestReport.test.ts`
- Create: `components/DetectorPlaytestExport.tsx`
- Modify: `components/RollInbox.tsx`

**Interfaces:**
- `buildDetectorPlaytestReport(inbox, history): DetectorPlaytestReport`.
- Contains per detector/version: received, confirmed unchanged, corrected, dismissed, blocked, duplicate, rolled, and false-positive rate.
- Export is a local JSON download; no network function exists in this module.

- [ ] **Step 1: Write aggregation and privacy tests**

```ts
expect(report.detectors['slayer-task-v1']).toMatchObject({
  received: 20,
  corrected: 1,
  falsePositiveRate: 0.05,
});
expect(JSON.stringify(report)).not.toContain('relayToken');
expect(JSON.stringify(report)).not.toContain('chatSignature');
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- utils/detectorPlaytestReport.test.ts`

Expected: FAIL because the report builder does not exist.

- [ ] **Step 3: Implement aggregate-only reporting**

Include app/rules/content versions and date range, but omit account name, event evidence, exact timestamps, relay code/token, and full history. Add **Export detector playtest report** under Roll Inbox diagnostics.

- [ ] **Step 4: Verify**

Run: `npm test -- utils/detectorPlaytestReport.test.ts components/RollInbox.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/detectorPlaytestReport.ts utils/detectorPlaytestReport.test.ts components/DetectorPlaytestExport.tsx components/RollInbox.tsx components/RollInbox.test.tsx
git commit -m "feat: export private detector playtest metrics"
```

### Task 8: Promote detectors through a data-only evidence gate

**Files:**
- Modify: `config/detectorPolicies.ts`
- Modify: `config/detectorPolicies.test.ts`
- Create: `docs/detectors/promotion-log.md`

**Interfaces:**
- A promotion changes only `handling` and `maxApprovedVersion`, plus its tests and evidence log.
- No Java code change is bundled with a confidence promotion.

- [ ] **Step 1: Collect real sessions before promotion**

For each detector/version, require at least 200 reviewed detections across at least five accounts and three RuneLite restarts. The exported aggregate must show:

```text
false positives < 0.5%
unchanged confirmations >= 95%
zero duplicate rolls
zero events rolled without a player click
```

- [ ] **Step 2: Record the evidence**

Add one table row per detector/version with sample count, unchanged confirmations, corrections, false-positive rate, test fixture commit, and review date. Do not commit raw player event data.

- [ ] **Step 3: Write the policy-change test first**

```ts
expect(policyFor('slayer-task-v1')).toMatchObject({
  maxApprovedVersion: 1,
  handling: 'EXACT',
});
```

Run: `npm test -- config/detectorPolicies.test.ts`

Expected: FAIL while the policy remains confirmation-only.

- [ ] **Step 4: Promote only the proven detector**

Change that one registry entry to `EXACT`. Leave every detector without sufficient evidence at `CONFIRMATION`.

- [ ] **Step 5: Verify the entire system**

App:

```bash
npm test
npm run typecheck
npm run content:verify
npm run build
```

Plugin:

```bash
gradle clean test jar --no-daemon
```

Expected: all commands pass.

- [ ] **Step 6: Commit the data-only promotion**

```bash
git add config/detectorPolicies.ts config/detectorPolicies.test.ts docs/detectors/promotion-log.md
git commit -m "data: approve Slayer detector v1"
```

This plan promotes only `slayer-task-v1`. Write a new focused promotion plan for each later detector after its own evidence threshold is met; never batch an unproven detector into another detector's promotion.

### Task 9: Detector-expansion release gate

**Files:**
- Modify: plugin `README.md` and `CONTRIBUTING.md`
- Modify: app `docs/online-relay.md`
- Modify: `plugins/fate-locked-ironman` in the Plugin Hub checkout

**Interfaces:**
- Produces separate Hub updates for detector implementation and later confidence promotions.

- [ ] **Step 1: Verify safety manually**

For every new detector, confirm duplicate callbacks create one inbox row, restart recovery works, uncertain events have Review rather than Roll, and Roll remains a web-only explicit action.

- [ ] **Step 2: Document supported and confirmation-only detectors**

Publish a table of detector ID, version, signal, current handling, and known limitations. State that app policy can downgrade but never upgrade a newer unknown version.

- [ ] **Step 3: Commit docs**

Use `docs: document expanded Fate detectors` in each repository.

- [ ] **Step 4: Submit the focused Hub update**

Update only the Hub manifest pin to the verified standalone detector commit. The PR body must state that the release adds observation and queueing only, keeps all new detectors confirmation-first, performs no gameplay actions, and does not expand Strict Mode.
