# Opt-In Strict Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default-off RuneLite checkbox that can cancel only actions the shared rules snapshot proves are forbidden, with immediate explanation and a visible 60-second pause control.

**Architecture:** A pure `StrictModeGuard` evaluates normalized menu actions through the Project 2 `FateRuleEngine`; the event subscriber only consumes clicks when the result is `BLOCK`. Runtime activation, account/freshness safety, the pause timer, and a bounded local audit log are separate concerns so Unknown can never accidentally collapse into Blocked.

**Tech Stack:** Java 11, RuneLite `MenuOptionClicked`, RuneLite Config/Swing, Gson, JUnit 4.

## Global Constraints

- `Strict Mode — prevent actions that are certainly against this run's rules` is one checkbox.
- The checkbox default is exactly `false`; Strict Mode activates only after the player checks it.
- Strict Mode never performs a gameplay action.
- Strict Mode never cancels `UNKNOWN` or `NOT_READY`; only `LOCKED` may produce `BLOCK`.
- Wrong account, missing rules, future/invalid bundle, or stale online snapshot disables blocking.
- Server-authoritative movement remains warning-only; never consume `WALK`.
- The first release covers proven chunk-targeted NPCs/objects, banks, known teleports, and over-tier equipment only.
- The panel provides **Pause Strict Mode for 60 seconds**, a visible countdown, immediate resume, and immediate disable through the checkbox.
- Every prevented click gives one concise rule explanation and writes a bounded local troubleshooting record.
- No prevention log is uploaded.
- Submit this as a focused Plugin Hub update without detector expansion.
- Approved design: `docs/superpowers/specs/2026-07-24-fate-guardian-runelite-design.md`.
- Shared Rules and Compact Chunk Panel Project 2 must be complete first.

---

## Required Project 2 interface extension

Before Task 1, confirm bundle v4 contains:

```ts
itemRules: Record<string, { tier: number; slot: string }>;
```

`utils/runeliteRulesManifest.ts` must build this from `gearService`, and `RuneliteRulesManifest` must parse it as an immutable map. The relay size test from Project 2 must still pass. This gives Java an exact slot for equipment decisions instead of guessing from menu text.

### Task 1: Export and parse exact equipment rules

**Files:**
- Modify: `utils/runeliteRulesManifest.ts` in the app repository
- Modify: `utils/runeliteRulesManifest.test.ts`
- Modify: `services/GearService.ts`
- Modify: `src/main/java/com/fatelocked/rules/RuneliteRulesManifest.java` in the plugin repository
- Modify: `src/main/java/com/fatelocked/rules/FateRuleEngine.java`
- Modify: `src/test/java/com/fatelocked/rules/FateRuleEngineTest.java`

**Interfaces:**
- `FateRuleEngine.equipment(int itemId): RuleDecision`.
- Known item + tier above unlocked slot tier returns `LOCKED`.
- Unknown item ID or missing slot/tier returns `UNKNOWN`.

- [ ] **Step 1: Write failing app and Java tests**

```ts
expect(manifest.itemRules['4151']).toEqual({
  tier: expect.any(Number),
  slot: 'Weapon',
});
```

```java
assertEquals(PermissionStatus.LOCKED,
    engine.equipment(4151).getStatus());
assertEquals(PermissionStatus.UNKNOWN,
    engine.equipment(999999).getStatus());
```

- [ ] **Step 2: Run the failing tests**

App: `npm test -- utils/runeliteRulesManifest.test.ts`

Plugin: `gradle test --tests com.fatelocked.rules.FateRuleEngineTest --no-daemon`

Expected: FAIL because `itemRules` and `equipment(...)` are absent.

- [ ] **Step 3: Implement the exact lookup**

Export canonical item ID, tier, and app slot name. Compare the item tier to `rules.unlocks.equipment[slot]`. Do not infer a slot from `Wear`, `Wield`, item name, or equipment stats in RuneLite.

- [ ] **Step 4: Re-run size and parity tests**

App:

```bash
npm test -- utils/runeliteRulesManifest.test.ts utils/runeliteBundle.test.ts
```

Plugin:

```bash
gradle test --tests com.fatelocked.rules.FateRuleEngineTest --no-daemon
```

Expected: PASS; compressed bundle remains below 256 KiB.

- [ ] **Step 5: Commit in each repository**

App:

```bash
git add services/GearService.ts utils/runeliteRulesManifest.ts utils/runeliteRulesManifest.test.ts
git commit -m "feat: export exact equipment permission rules"
```

Plugin:

```bash
git add src/main/java/com/fatelocked/rules src/test/java/com/fatelocked/rules
git commit -m "feat: evaluate equipment permissions"
```

### Task 2: Add the default-off checkbox

**Files:**
- Modify: `src/main/java/com/fatelocked/FateLockedConfig.java`
- Create: `src/test/java/com/fatelocked/FateLockedConfigTest.java`

**Interfaces:**
- Produces `boolean strictMode()` under a new `Guardian` config section.
- Default is `false`.

- [ ] **Step 1: Write the default-value test**

```java
@Test
public void strictModeDefaultsOff()
{
    FateLockedConfig config = new FateLockedConfig() {};
    assertFalse(config.strictMode());
}
```

- [ ] **Step 2: Run the failing test**

Run: `gradle test --tests com.fatelocked.FateLockedConfigTest --no-daemon`

Expected: FAIL because `strictMode()` does not exist.

- [ ] **Step 3: Add the checkbox**

```java
@ConfigSection(
    name = "Guardian",
    description = "Optional prevention for actions proven to break this run's rules",
    position = 2
)
String guardianSection = "guardianSection";

@ConfigItem(
    keyName = "strictMode",
    name = "Strict Mode",
    description = "Prevent actions that are certainly against this run's rules. Unknown actions are never prevented. Off by default.",
    section = guardianSection,
    position = 0
)
default boolean strictMode()
{
    return false;
}
```

Move the Rendering section position from 2 to 3. Do not add another enable switch in the panel.

- [ ] **Step 4: Add one-time activation guidance**

Handle `ConfigChanged` for `strictMode`. On the first transition to true, show a dismissible side-panel card containing exactly:

```text
Strict Mode is now on. It prevents only actions proven locked by the current
rules. Unknown actions and walking are never blocked. You can pause it for
60 seconds here or turn it off immediately in plugin settings.
```

Persist the dismissed-card flag internally as `strictModeIntroSeen=true` through `ConfigManager`; do not expose a second user-facing checkbox.

- [ ] **Step 5: Verify**

Run: `gradle test --tests com.fatelocked.FateLockedConfigTest --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/FateLockedConfig.java src/test/java/com/fatelocked/FateLockedConfigTest.java
git commit -m "feat: add default-off Strict Mode checkbox"
```

### Task 3: Normalize menu actions without deciding policy

**Files:**
- Create: `src/main/java/com/fatelocked/guardian/GuardedAction.java`
- Create: `src/main/java/com/fatelocked/guardian/GuardedActionFactory.java`
- Create: `src/test/java/com/fatelocked/guardian/GuardedActionFactoryTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`

**Interfaces:**
- `GuardedActionFactory.from(MenuEntry, Client): GuardedAction`.
- Kinds: `NPC`, `OBJECT`, `BANK`, `TELEPORT`, `EQUIPMENT`, `MOVEMENT`, `UNKNOWN`.
- Contains normalized option, normalized target, nullable chunk, and nullable item ID.

- [ ] **Step 1: Write menu fixture tests**

Cover NPC actor location, object scene coordinates, invalid coordinates, known teleport name, `Bank`/`Collect` bank actions, `Wear`/`Wield`/`Equip` inventory actions, `WALK`, examine, and an unrelated widget action.

```java
assertEquals(GuardedAction.Kind.MOVEMENT, factory.from(walkEntry, client).getKind());
assertEquals(GuardedAction.Kind.UNKNOWN, factory.from(widgetEntry, client).getKind());
assertNull(factory.from(invalidSceneEntry, client).getChunk());
```

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.guardian.GuardedActionFactoryTest --no-daemon`

Expected: FAIL because the guardian package does not exist.

- [ ] **Step 3: Implement safe normalization**

Move `menuTargetWorldPoint(...)` out of the plugin class into the factory. Use typed `MenuEntry` accessors and validate scene coordinates against `Constants.SCENE_SIZE`. Strip tags with `Text.removeTags` and normalize whitespace/case. Examine actions always return `UNKNOWN`, because examining content does not use it.

- [ ] **Step 4: Keep existing red menu tags working**

Change `onMenuEntryAdded` to use `GuardedActionFactory` for target resolution, but preserve current tag behavior. This is a refactor only; no click is consumed yet.

- [ ] **Step 5: Verify**

Run: `gradle test --tests com.fatelocked.guardian.GuardedActionFactoryTest --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/guardian src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/guardian
git commit -m "refactor: normalize guardable menu actions"
```

### Task 4: Implement the pure Strict Mode decision table

**Files:**
- Create: `src/main/java/com/fatelocked/guardian/GuardResult.java`
- Create: `src/main/java/com/fatelocked/guardian/StrictModeGuard.java`
- Create: `src/test/java/com/fatelocked/guardian/StrictModeGuardTest.java`

**Interfaces:**
- `decide(GuardedAction action, GuardContext context): GuardResult`.
- Outcomes: `ALLOW`, `BLOCK`, `WARN_ONLY`.
- `GuardContext` contains enabled, paused, account match, rules freshness, and `FateRuleEngine`.

- [ ] **Step 1: Write the complete truth-table test**

```java
@Test
public void onlyFreshCertainLockedActionsBlock()
{
    assertEquals(ALLOW, decide(disabled, lockedNpc));
    assertEquals(ALLOW, decide(paused, lockedNpc));
    assertEquals(ALLOW, decide(wrongAccount, lockedNpc));
    assertEquals(ALLOW, decide(stale, lockedNpc));
    assertEquals(ALLOW, decide(enabled, unknownNpc));
    assertEquals(ALLOW, decide(enabled, notReadyQuestObject));
    assertEquals(WARN_ONLY, decide(enabled, lockedWalk));
    assertEquals(BLOCK, decide(enabled, lockedNpc));
    assertEquals(BLOCK, decide(enabled, lockedBank));
    assertEquals(BLOCK, decide(enabled, lockedTeleport));
    assertEquals(BLOCK, decide(enabled, overTierEquipment));
}
```

- [ ] **Step 2: Run the failing test**

Run: `gradle test --tests com.fatelocked.guardian.StrictModeGuardTest --no-daemon`

Expected: FAIL because the guard does not exist.

- [ ] **Step 3: Implement the decision table**

Apply gates in this order:

```text
disabled -> ALLOW
paused -> ALLOW
wrong account -> ALLOW
missing/legacy/stale rules -> ALLOW
movement -> WARN_ONLY when locked, otherwise ALLOW
unknown kind or Unknown decision -> ALLOW
Not ready -> ALLOW
Locked proven category -> BLOCK
everything else -> ALLOW
```

Use a 15-minute freshness window for online snapshots. A successful `304 Not Modified` refreshes online freshness. Manual imports remain usable for warnings, but blocking expires 15 minutes after import unless a fresh online poll confirms them.

- [ ] **Step 4: Add one property-style invariant**

Iterate every `PermissionStatus` and assert `BLOCK` implies status is exactly `LOCKED`. This protects against a future enum branch accidentally blocking Unknown.

- [ ] **Step 5: Verify**

Run: `gradle test --tests com.fatelocked.guardian.StrictModeGuardTest --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/guardian src/test/java/com/fatelocked/guardian
git commit -m "feat: decide certain Strict Mode violations"
```

### Task 5: Consume proven-invalid clicks and explain them

**Files:**
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Create: `src/test/java/com/fatelocked/guardian/StrictModeClickHandlerTest.java`

**Interfaces:**
- Adds `@Subscribe onMenuOptionClicked(MenuOptionClicked event)`.
- Calls `event.consume()` only for `GuardResult.BLOCK`.
- Emits one chat line: `[Fate Locked] Prevented: <target> — <concise reason>.`

- [ ] **Step 1: Write click-handler tests**

Mock the menu event and verify consume count for disabled, paused, Unknown, movement, wrong account, stale, and certain locked actions.

```java
verify(lockedEvent, times(1)).consume();
verify(unknownEvent, never()).consume();
verify(walkEvent, never()).consume();
```

- [ ] **Step 2: Run the failing test**

Run: `gradle test --tests com.fatelocked.guardian.StrictModeClickHandlerTest --no-daemon`

Expected: FAIL because the subscriber does not exist.

- [ ] **Step 3: Implement the subscriber**

Create the normalized action, create guard context from current config/bundle/account/freshness, decide, and consume only on `BLOCK`. Strip any existing `(LOCKED)` tag from the target before constructing the explanation.

Required reason examples:

```text
Falador bank is locked
Vorkath is locked
Teleport destination is in a locked chunk
Abyssal whip is T7; Weapon is unlocked to T5
```

- [ ] **Step 4: Verify**

Run: `gradle test --tests com.fatelocked.guardian.StrictModeClickHandlerTest --no-daemon`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/guardian/StrictModeClickHandlerTest.java
git commit -m "feat: prevent proven Strict Mode violations"
```

### Task 6: Add the 60-second pause and visible countdown

**Files:**
- Create: `src/main/java/com/fatelocked/guardian/StrictModePause.java`
- Create: `src/test/java/com/fatelocked/guardian/StrictModePauseTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPanel.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`

**Interfaces:**
- `pauseFor(Duration)`, `resume()`, `isPaused()`, `remainingSeconds()`.
- Uses injected/testable `Clock`.
- Pause is runtime-only and clears on plugin restart.

- [ ] **Step 1: Write clock-controlled tests**

```java
pause.pauseFor(Duration.ofSeconds(60));
assertEquals(60, pause.remainingSeconds());
clock.advance(Duration.ofSeconds(17));
assertEquals(43, pause.remainingSeconds());
clock.advance(Duration.ofSeconds(43));
assertFalse(pause.isPaused());
```

- [ ] **Step 2: Run the failing test**

Run: `gradle test --tests com.fatelocked.guardian.StrictModePauseTest --no-daemon`

Expected: FAIL because the pause class does not exist.

- [ ] **Step 3: Implement pause state**

Store only `Instant pausedUntil`. Round remaining seconds up so the panel never shows `0s` while still paused.

- [ ] **Step 4: Add panel controls**

When the config checkbox is on, render **Pause Strict Mode for 60 seconds**. While paused, replace it with **Resume Strict Mode · 43s** and refresh once per second on the Swing event thread. When the checkbox is off, show `Strict Mode off` and no pause button.

- [ ] **Step 5: Verify**

Run: `gradle test --tests com.fatelocked.guardian.StrictModePauseTest --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/guardian/StrictModePause.java src/main/java/com/fatelocked/FateLockedPanel.java src/main/java/com/fatelocked/FateLockedPlugin.java src/test/java/com/fatelocked/guardian/StrictModePauseTest.java
git commit -m "feat: pause Strict Mode for sixty seconds"
```

### Task 7: Add a bounded local prevention log

**Files:**
- Create: `src/main/java/com/fatelocked/guardian/StrictModeAuditLog.java`
- Create: `src/test/java/com/fatelocked/guardian/StrictModeAuditLogTest.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPlugin.java`
- Modify: `src/main/java/com/fatelocked/FateLockedPanel.java`

**Interfaces:**
- `append(StrictModeAuditEntry)`, `recent(int limit)`.
- Persists to `${RuneLite.RUNELITE_DIR}/fate-locked/strict-mode-events.json`.
- Entry fields: timestamp, action kind, normalized target, chunk, and reason; no account name or inventory.

- [ ] **Step 1: Write persistence and cap tests**

Append 101 entries, restart the log, and assert only the newest 100 remain. Assert serialized JSON does not contain `account`, `inventory`, `chat`, or relay token fields.

- [ ] **Step 2: Run the failing tests**

Run: `gradle test --tests com.fatelocked.guardian.StrictModeAuditLogTest --no-daemon`

Expected: FAIL because the audit log does not exist.

- [ ] **Step 3: Implement atomic bounded storage**

Use the same temp-file and atomic-move pattern as the Roll Inbox outbox. A log write failure must never change the click decision or crash the client.

- [ ] **Step 4: Wire only blocked actions**

Append after `event.consume()`. Show the latest five records behind a collapsed **Recent prevented actions** section; do not log allowed, Unknown, warning-only, or paused actions.

- [ ] **Step 5: Verify**

Run: `gradle test --tests com.fatelocked.guardian.StrictModeAuditLogTest --no-daemon`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fatelocked/guardian src/main/java/com/fatelocked/FateLockedPlugin.java src/main/java/com/fatelocked/FateLockedPanel.java src/test/java/com/fatelocked/guardian
git commit -m "feat: log prevented actions locally"
```

### Task 8: Focused Plugin Hub release gate

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `plugins/fate-locked-ironman` in a `runelite/plugin-hub` checkout

**Interfaces:**
- Produces: one standalone commit SHA and one Hub manifest update containing Strict Mode but no detector expansion.

- [ ] **Step 1: Document user control exactly**

State:

```text
Strict Mode is off by default. It activates only when you check its config
checkbox. It cancels only actions the current rules snapshot proves are locked,
never Unknown actions, and can be paused for 60 seconds from the side panel.
```

- [ ] **Step 2: Run all plugin tests**

Run: `gradle clean test jar --no-daemon`

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Run the manual safety matrix**

Verify:

1. Fresh install: checkbox unchecked; no click is consumed.
2. Checkbox checked: known locked NPC/object/bank/teleport/equipment is consumed once.
3. Unknown mapping: never consumed.
4. Walk into locked territory: warning only.
5. Wrong account: never consumed.
6. Rules older than 15 minutes without a successful online refresh: never consumed.
7. Pause: no clicks consumed for 60 seconds; countdown reaches zero; protection resumes.
8. Disable checkbox: protection stops immediately.
9. Restart: checkbox keeps the user's RuneLite setting; temporary pause clears.
10. Prevention log stays local and capped.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: explain opt-in Strict Mode"
```

- [ ] **Step 5: Update the Hub pin only**

Run `git rev-parse HEAD` in the verified standalone plugin checkout, copy that exact 40-character SHA, and use `apply_patch` to replace the Hub manifest's `commit=` value with it. Inspect that the manifest has one changed line, commit, and open a focused PR. The PR body must say:

```text
Adds an optional, default-off rules guard. It only consumes player clicks for
certain locked decisions; it performs no gameplay actions, never blocks Unknown,
and makes no additional network requests.
```
