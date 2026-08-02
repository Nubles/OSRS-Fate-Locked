# Weighted Fate, Chaos Milestones, and Compensation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Rebalance failure-Fate awards, add guaranteed skill-milestone Chaos Keys alongside the existing 2% chance, and offer each eligible legacy profile a permanent three-way compensation choice.

**Architecture:** Keep reward values in config/economy.ts and pass the resolved numeric award through prepared roll actions so pity and reducer state cannot disagree. Calculate legacy compensation in a pure utility, freeze it during the v3-to-v4 save migration, resolve it once through the reducer, and expose the pending choice in the latest What's New panel.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, localStorage-backed versioned saves.

## Global Constraints

- Skill failures award +1 Fate at levels 2-19, +2 at levels 20-79, and +3 at levels 80-99.
- Quests award +1 for Novice/Intermediate failures, +2 for Experienced, and +3 for Master.
- Diaries award +1 for Easy/Medium failures, +2 for Hard, and +3 for Elite.
- Combat Achievements award +1 for Easy/Medium failures, +2 for Hard/Elite, and +3 for Master/Grandmaster.
- Clues award +1 for Beginner/Easy/Medium failures, +2 for Hard/Elite, and +3 for Master.
- Slayer awards +1 from Turael/Spria through Chaeldar, +2 from Konar through Duradel/Kuradal, and +3 for Boss tasks.
- Bossing awards +1 for Low, +2 for Mid/High, and +3 for Raids.
- Collection Log and minigame failures award +1.
- Guaranteed 100% rolls cannot award failure Fate.
- Skill levels 30, 40, 50, 60, 70, 80, 90, and 99 guarantee one Chaos Key.
- The independent 2% per-level Chaos Key chance remains and can stack with a guaranteed milestone.
- A weighted failure that reaches the active pity threshold grants one Standard Pity Key and retains overflow Fate.
- Legacy compensation uses a 50-point replay bar and never re-awards an existing Pity Key.
- Each eligible legacy profile must choose No compensation, Chaos Keys only, or Full compensation exactly once.
- Full compensation grants missed Chaos Keys, missed Standard Pity Keys, and applies the replayed Fate remainder.
- No compensation changes no balances; Chaos Keys only changes no Standard Key or Fate balance.
- Unknown legacy sources remain +1 Fate.
- Do not add dependencies or change drop rates, Omni odds, ritual costs, or anti-softlock milestone rules.
- Preserve the unrelated untracked Discord plan.

---

### Task 1: Canonical Failure-Fate and Skill-Milestone Rules

**Files:**
- Modify: types.ts
- Modify: config/economy.ts
- Modify: config/economy.consistency.test.ts

**Interfaces:**
- Produces in types.ts: type FailureFateAward = 1 | 2 | 3
- Produces: failureFateForSource(source: DropSource): FailureFateAward
- Produces: failureFateForSkillLevel(level: number): FailureFateAward
- Produces: SKILL_CHAOS_MILESTONES: readonly number[]
- Produces: isSkillChaosMilestone(level: number): boolean
- Consumes: DropSource from types.ts

- [ ] **Step 1: Write failing economy-rule tests**

Add table-driven tests that pin all boundaries and fixed sources:

    expect([
      failureFateForSkillLevel(2),
      failureFateForSkillLevel(19),
      failureFateForSkillLevel(20),
      failureFateForSkillLevel(79),
      failureFateForSkillLevel(80),
      failureFateForSkillLevel(99),
    ]).toEqual([1, 1, 2, 2, 3, 3]);

    expect(failureFateForSource(DropSource.QUEST_EXPERIENCED)).toBe(2);
    expect(failureFateForSource(DropSource.DIARY_ELITE)).toBe(3);
    expect(failureFateForSource(DropSource.CA_ELITE)).toBe(2);
    expect(failureFateForSource(DropSource.CLUE_MASTER)).toBe(3);
    expect(failureFateForSource(DropSource.SLAYER_DURADEL)).toBe(2);
    expect(failureFateForSource(DropSource.RAID)).toBe(3);
    expect(failureFateForSource(DropSource.COLLECTION_LOG)).toBe(1);

    expect(SKILL_CHAOS_MILESTONES).toEqual([30, 40, 50, 60, 70, 80, 90, 99]);
    expect(isSkillChaosMilestone(70)).toBe(true);
    expect(isSkillChaosMilestone(79)).toBe(false);

Also assert that every non-dynamic DropSource documented in EARN_METHODS has an explicit failure-Fate value unless its rate is 100%.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: npx vitest run config/economy.consistency.test.ts

Expected: FAIL because the reward types, resolver functions, and milestone constants do not exist.

- [ ] **Step 3: Implement the canonical mappings**

In types.ts, define FailureFateAward. In config/economy.ts, add the continuous skill bands, exact milestone set, and a fixed source map. Use these approved bands:

    export type FailureFateAward = 1 | 2 | 3;

    export const failureFateForSkillLevel = (level: number): FailureFateAward =>
      level >= 80 ? 3 : level >= 20 ? 2 : 1;

    export const SKILL_CHAOS_MILESTONES = [30, 40, 50, 60, 70, 80, 90, 99] as const;

    const SKILL_CHAOS_MILESTONE_SET = new Set<number>(SKILL_CHAOS_MILESTONES);

    export const isSkillChaosMilestone = (level: number): boolean =>
      SKILL_CHAOS_MILESTONE_SET.has(level);

Define FAILURE_FATE_BY_SOURCE with every approved fixed source. Keep guaranteed Grandmaster quests and pets conservative at +1 because their 100% rate makes the failure value unreachable. Return +1 for CUSTOM and unknown enum additions so old data is never guessed upward.

Add optional Fate-on-failure display metadata to EarnTier and populate EARN_METHODS from the same mapping. Replace the Level Ups bonus copy with the three level bands and both Chaos reward paths.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: npx vitest run config/economy.consistency.test.ts

Expected: PASS with every source mapped once and every skill boundary pinned.

- [ ] **Step 5: Commit the canonical rules**

    git add types.ts config/economy.ts config/economy.consistency.test.ts
    git commit -m "feat: define weighted fate rewards"

---

### Task 2: Weighted Roll Resolution and Stacking Chaos Awards

**Files:**
- Modify: types.ts
- Modify: context/GameContext.tsx
- Modify: context/gameReducer.test.ts
- Modify: utils/fateEventEligibility.ts
- Modify: utils/fateEventEligibility.test.ts
- Modify: components/CollectionLog.tsx
- Modify: App.tsx
- Modify: utils/rarity.ts
- Modify: utils/rarity.test.ts

**Interfaces:**
- Consumes: FailureFateAward, failureFateForSource(), failureFateForSkillLevel(), and isSkillChaosMilestone() from Task 1
- Changes: RollIntent gains failureFate: FailureFateAward
- Changes: PreparedRollResult gains failureFate: FailureFateAward
- Changes: prepareKeyRollAction receives an explicit FailureFateAward before RNG coordinates
- Produces: Level-up event metadata with chaosKeysAwarded: number and chaosKeyAwarded: boolean

- [ ] **Step 1: Write failing reducer tests for weighted failure and pity overflow**

Extend the roll test helper so every prepared result carries failureFate. Add:

    const previous = { ...base(), fatePoints: 10 };
    const failed = gameReducer(previous, roll({
      success: false,
      failureFate: 3,
    }));
    expect(failed.fatePoints).toBe(13);
    expect(failed.history.at(-1)?.meta?.fatePointsEarned).toBe(3);

    const pity = gameReducer({ ...base(), fatePoints: 49 }, roll({
      success: false,
      pity: true,
      failureFate: 3,
    }));
    expect(pity.keys).toBe(initialState.keys + 1);
    expect(pity.fatePoints).toBe(2);
    expect(pity.history.at(-1)?.meta?.fatePointsEarned).toBe(3);

Add a prepareKeyRollAction test proving 49 + 3 sets pity while 46 + 3 does not.

- [ ] **Step 2: Write failing level-up tests for guaranteed and double Chaos Keys**

Add cases for a level 30 milestone with chaosRoll 0.5, a level 30 milestone with chaosRoll 0.01, and level 31 with chaosRoll 0.5:

    expect(milestone.chaosKeys).toBe(initialState.chaosKeys + 1);
    expect(doubleDrop.chaosKeys).toBe(initialState.chaosKeys + 2);
    expect(nonMilestone.chaosKeys).toBe(initialState.chaosKeys);

Assert lastEvent metadata reports 1, 2, and 0 respectively and the boolean remains true whenever the count is positive.

- [ ] **Step 3: Run reducer tests and confirm RED**

Run: npx vitest run context/gameReducer.test.ts utils/rarity.test.ts

Expected: FAIL because roll results do not carry weighted Fate, pity resets to zero, and milestones do not guarantee Chaos Keys.

- [ ] **Step 4: Thread explicit Fate values through roll preparation**

Change RollIntent and PreparedRollResult to carry failureFate. Make prepareKeyRollAction use:

    } else if (
      mode.pityEnabled
      && state.fatePoints + failureFate >= mode.pityThreshold
    ) {
      pity = true;
    }

Update every caller:
- fixed manual rolls use failureFateForSource(source);
- Collection Log keeps its item display source but passes failureFateForSource(DropSource.COLLECTION_LOG);
- quest, diary, combat-achievement, boss, clue, slayer, minigame, pet, and detected-event paths pass their canonical source value;
- skill rewards pass failureFateForSkillLevel(newLevel);
- CUSTOM remains +1.

Do not infer balance values from player-facing labels.

- [ ] **Step 5: Apply weighted Fate and pity overflow in the reducer**

On an ordinary failure, add failureFate before any unchanged Greed refund. On pity:

    const threshold = resolveModeRules(
      state.gameModeId,
      state.customMode,
    ).pityThreshold;
    newState.fatePoints = state.fatePoints + failureFate - threshold;

Write the base award, plus Greed refund only when applicable, to fatePointsEarned metadata. Preserve the existing success reset to zero.

- [ ] **Step 6: Add guaranteed Chaos milestones without consuming more RNG**

In LEVEL_UP, compute the independent awards:

    const randomChaosAwarded = chaosRoll < RNG_CHAOS_CHANCE;
    const guaranteedChaosAwarded = isSkillChaosMilestone(newLevel);
    const chaosKeysAwarded =
      Number(randomChaosAwarded) + Number(guaranteedChaosAwarded);

Increment chaosKeys by that count. Update history and lastEvent metadata so App.tsx can display singular or plural Chaos Key feedback. Keep chaosKeyAwarded as chaosKeysAwarded > 0 for rarity compatibility.

- [ ] **Step 7: Update detected-event and rarity tests**

Assert classified fixed events carry their table reward and classified skill levels use the attained level band. Assert both one-key and two-key level events remain epic.

Run: npx vitest run context/gameReducer.test.ts utils/fateEventEligibility.test.ts utils/rarity.test.ts

Expected: PASS.

- [ ] **Step 8: Run context integration tests**

Run: npx vitest run context/GameContext.test.tsx App.lifecycle.test.tsx

Expected: PASS without changing RNG draw ordering or save timing.

- [ ] **Step 9: Commit roll and milestone behavior**

    git add types.ts context/GameContext.tsx context/gameReducer.test.ts utils/fateEventEligibility.ts utils/fateEventEligibility.test.ts components/CollectionLog.tsx App.tsx utils/rarity.ts utils/rarity.test.ts
    git commit -m "feat: apply weighted fate and chaos milestones"

---

### Task 3: Pure Legacy Compensation Calculator

**Files:**
- Create: utils/fateCompensation.ts
- Create: utils/fateCompensation.test.ts

**Interfaces:**
- Consumes: GameState and LogEntry from types.ts
- Consumes: failureFateForSource(), failureFateForSkillLevel(), and SKILL_CHAOS_MILESTONES from Task 1
- Produces: LEGACY_FATE_COMPENSATION_ID = "2026-08-02-weighted-fate"
- Produces: interface LegacyFateCompensation { chaosKeys: number; pityKeys: number; fatePoints: number }
- Produces: calculateLegacyFateCompensation(state: Pick<GameState, "unlocks" | "history" | "fatePoints">): LegacyFateCompensation

- [ ] **Step 1: Write failing milestone-entitlement tests**

Create a state fixture with Attack 30 and Strength 80. Assert the calculator returns seven Chaos Keys: one for Attack 30 and six for Strength milestones 30 through 80. Include a historical random Chaos event and assert the entitlement remains seven.

- [ ] **Step 2: Write failing Fate replay tests**

Construct 40 recognized +1 failures followed by five Master-quest failures. The legacy balance is 45; the new replay total is 55. Assert:

    expect(result).toMatchObject({
      pityKeys: 1,
      fatePoints: 5,
    });

Add focused cases proving:
- an ordinary or Omni success resets the replay bar;
- an existing PITY consumes one 50-point crossing without incrementing pityKeys;
- overflow at an existing PITY is retained;
- if a prior new crossing leaves an existing PITY below 50, that already-owned Key resets the replay bar;
- Greed metadata preserves the recorded refund while replacing only the old base +1;
- an unknown source remains +1;
- no history plus no reached milestone produces all zeroes.

- [ ] **Step 3: Run the calculator tests and confirm RED**

Run: npx vitest run utils/fateCompensation.test.ts

Expected: FAIL because the calculator does not exist.

- [ ] **Step 4: Implement source classification and replay**

Recognize exact DropSource values, skill sources ending in " Level N", and legacy Collection Log sources beginning with "Col. Log:". For a failed entry, calculate:

    const recorded = validRecordedFate(entry) ?? 1;
    const weighted = recognizedFailureFate(entry);
    const replayAward = recorded + (weighted - 1);

Process ROLL_SUCCESS and ROLL_OMNI as resets. Process ROLL_FAIL crossings as new pityKeys. Process existing PITY entries using the approved consume-or-reset rule. Count skill Chaos entitlement from the frozen level map rather than history so sparse legacy level logs cannot lose compensation.

- [ ] **Step 5: Add defensive bounds**

Clamp parsed skill levels to 2-99, reject non-finite metadata, never produce negative counters, and use the existing MAX_COUNTER policy when this result is validated by the save layer. Keep the calculator pure and deterministic.

- [ ] **Step 6: Run calculator tests and confirm GREEN**

Run: npx vitest run utils/fateCompensation.test.ts

Expected: PASS.

- [ ] **Step 7: Commit the calculator**

    git add utils/fateCompensation.ts utils/fateCompensation.test.ts
    git commit -m "feat: calculate legacy fate compensation"

---

### Task 4: Versioned Compensation State and One-Time Claims

**Files:**
- Modify: types.ts
- Modify: context/GameContext.tsx
- Modify: context/gameReducer.test.ts
- Modify: utils/saveSchema.ts
- Modify: utils/saveSchema.test.ts
- Modify: utils/integrity.ts
- Modify: utils/integrity.test.ts

**Interfaces:**
- Consumes: calculateLegacyFateCompensation() and LEGACY_FATE_COMPENSATION_ID from Task 3
- Produces: type FateCompensationChoice = "none" | "chaos" | "full"
- Produces: interface FateCompensationState with releaseId, status, chaosKeys, pityKeys, fatePoints, and optional choice
- Changes: GameState gains fateCompensation: FateCompensationState
- Produces: resolveFateCompensation(choice: FateCompensationChoice): void on GameContextType
- Adds: LogEntry type "COMPENSATION"

- [ ] **Step 1: Write failing v3-to-v4 migration tests**

Bump the expected CURRENT_SAVE_VERSION to 4 in fixtures. Add a v3 legacy save with eligible levels/history and assert migration produces a pending frozen offer with exact calculator totals. Add a zero-benefit v3 save and assert it produces status "not_eligible" with zero awards. Assert a fresh v4 state also starts "not_eligible".

- [ ] **Step 2: Write failing strict-validation tests**

Add v4 cases rejecting:
- an unknown releaseId;
- an invalid status or choice;
- negative, fractional, non-finite, or over-MAX_COUNTER award values;
- a resolved status whose choice is missing;
- a pending status that already has a choice.

Add an export/import round-trip proving a resolved choice stays resolved.

- [ ] **Step 3: Run save tests and confirm RED**

Run: npx vitest run utils/saveSchema.test.ts

Expected: FAIL because save version 4 and fateCompensation are not defined.

- [ ] **Step 4: Add versioned state and migration**

Define statuses "pending", "not_eligible", "none", "chaos", and "full". Initialize new runs to a zeroed not_eligible state. During normalization:
- source versions 0-3 calculate and freeze legacy compensation after unlocks and history are validated;
- create pending only when chaosKeys > 0, pityKeys > 0, or replayed fatePoints differs from the saved fatePoints;
- otherwise create not_eligible;
- strict v4 saves must contain and validate fateCompensation;
- imports of resolved v4 saves must never recalculate eligibility.

- [ ] **Step 5: Write failing reducer claim tests**

For a pending offer, assert:
- "none" changes no balances;
- "chaos" adds only chaosKeys;
- "full" adds chaosKeys and pityKeys, then sets fatePoints to the frozen remainder;
- a second RESOLVE_FATE_COMPENSATION action returns the unchanged state;
- every resolution appends one COMPENSATION history entry with the choice and actual awarded amounts.

- [ ] **Step 6: Implement atomic claim resolution**

Add the reducer action and GameContext callback. Validate pending status in the reducer before any balance change. For full compensation use:

    keys: state.keys + offer.pityKeys,
    chaosKeys: state.chaosKeys + offer.chaosKeys,
    fatePoints: offer.fatePoints

For chaos-only, preserve keys and fatePoints exactly. For none, preserve all three balances. Mark the offer with the selected terminal status and choice in the same transition.

- [ ] **Step 7: Teach integrity replay about compensation**

Add COMPENSATION to saveSchema's history-type allowlist. In integrity.ts, replay awarded Standard and Chaos Keys from the history metadata for chaos/full choices and set Fate to the recorded full-compensation remainder. Assert tampered compensation metadata causes the same balance mismatch behavior as other award events.

- [ ] **Step 8: Run state, save, and integrity tests**

Run: npx vitest run context/gameReducer.test.ts utils/saveSchema.test.ts utils/integrity.test.ts

Expected: PASS.

- [ ] **Step 9: Commit migration and claims**

    git add types.ts context/GameContext.tsx context/gameReducer.test.ts utils/saveSchema.ts utils/saveSchema.test.ts utils/integrity.ts utils/integrity.test.ts
    git commit -m "feat: add one-time fate compensation claims"

---

### Task 5: Gated Three-Choice What's New Experience

**Files:**
- Modify: data/changelog.ts
- Modify: data/changelog.test.ts
- Modify: components/ChangelogModal.tsx
- Modify: components/ChangelogModal.test.tsx
- Modify: components/ChangelogModal.dom.test.tsx
- Modify: utils/changelogState.ts
- Modify: utils/changelogState.test.ts
- Modify: App.tsx

**Interfaces:**
- Consumes: FateCompensationState and FateCompensationChoice from Task 4
- Changes: ChangelogModal accepts compensation and onResolveCompensation props
- Changes: shouldAutoOpenChangelog accepts hasPendingCompensation
- Consumes: resolveFateCompensation() from GameContextType

- [ ] **Step 1: Add the final release entry and failing static-render tests**

Insert the newest release with id 2026-08-02-weighted-fate. Its Balance notes must mention weighted +1/+2/+3 Fate, overflow after Pity, guaranteed Chaos milestones, and the unchanged independent 2% chance.

Render a pending offer and assert the panel shows exact totals plus buttons labelled:
- Continue without compensation
- Claim Chaos Keys only
- Claim full compensation

Assert singular/plural labels are correct for one and multiple Keys.

- [ ] **Step 2: Add failing DOM interaction tests**

Mount ChangelogModal with a pending offer and spies. Assert:
- X, footer close, and Escape cannot dismiss while pending;
- each button emits exactly one corresponding choice;
- after rerendering with a terminal status, normal close behavior returns;
- a not_eligible or resolved offer renders no claim controls.

- [ ] **Step 3: Add failing auto-open policy tests**

Assert hasPendingCompensation opens What's New after onboarding even when the release id is already marked seen. Preserve all existing exclusions for first-run mode choice, sync prompts, and the RuneLite guide.

- [ ] **Step 4: Run changelog tests and confirm RED**

Run: npx vitest run data/changelog.test.ts components/ChangelogModal.test.tsx components/ChangelogModal.dom.test.tsx utils/changelogState.test.ts

Expected: FAIL because compensation props, controls, and pending-open policy do not exist.

- [ ] **Step 5: Implement the compensation panel**

Place the offer inside the newest expanded release. Show:
- missed Chaos total;
- missed Standard Pity Key total;
- resulting Fate balance;
- a short statement that the choice is permanent.

Use three distinct buttons and require an explicit choice. Disable the header X, footer button, and Escape handler only while status is pending. Do not mark closing the historical changelog as a compensation choice.

- [ ] **Step 6: Integrate per-profile pending behavior in App.tsx**

Read fateCompensation and resolveFateCompensation from useGame. Pass them to ChangelogModal. Include pending status in initial and profile-switch auto-open conditions. Guard closeChangelog so it cannot close a pending offer. Once a choice resolves, mark the release seen and allow the player to close.

- [ ] **Step 7: Run changelog and app lifecycle tests**

Run: npx vitest run data/changelog.test.ts components/ChangelogModal.test.tsx components/ChangelogModal.dom.test.tsx utils/changelogState.test.ts App.lifecycle.test.tsx

Expected: PASS.

- [ ] **Step 8: Commit the update experience**

    git add data/changelog.ts data/changelog.test.ts components/ChangelogModal.tsx components/ChangelogModal.test.tsx components/ChangelogModal.dom.test.tsx utils/changelogState.ts utils/changelogState.test.ts App.tsx
    git commit -m "feat: offer legacy fate compensation"

---

### Task 6: Player-Facing Economy Copy and Analytics Consistency

**Files:**
- Modify: config/economy.ts
- Modify: config/economy.consistency.test.ts
- Modify: components/ReferenceModal.tsx
- Modify: components/ReferenceModal.test.tsx
- Modify: components/CoachStrip.tsx
- Modify: components/SectionGuide.tsx
- Modify: components/OnboardingWizard.tsx
- Modify: utils/keyEconomyEvidence.test.ts

**Interfaces:**
- Consumes: EARN_METHODS Fate metadata and milestone constants from Task 1
- Consumes: exact fatePointsEarned history metadata from Task 2
- Produces no new gameplay interfaces

- [ ] **Step 1: Write failing player-copy assertions**

Assert the in-app reference contains:
- Levels 2-19: +1 Fate
- Levels 20-79: +2 Fate
- Levels 80-99: +3 Fate
- the exact guaranteed Chaos milestone list;
- the separate 2% chance;
- Pity overflow wording;
- the fixed activity difficulty bands.

Assert old claims such as every failed roll equals one Fate and Chaos only comes from a random 2% level roll are absent from current rule surfaces.

- [ ] **Step 2: Run copy tests and confirm RED**

Run: npx vitest run config/economy.consistency.test.ts components/ReferenceModal.test.tsx


Expected: FAIL on missing weighted Fate and guaranteed milestone copy.

- [ ] **Step 3: Render the shared reward metadata**

Update ReferenceModal's earn table to show Fate on failure beside each fixed tier and a compact three-band skill row. Derive milestone copy from SKILL_CHAOS_MILESTONES.join(", ") so display and engine cannot drift.

Update general guidance to say harder failed rolls award more Fate. Keep short onboarding copy conceptual; do not duplicate the full table across multiple screens.

- [ ] **Step 4: Verify analytics preserves exact weighted awards**

Add a keyEconomyEvidence test with +2 and +3 failure metadata and assert totals use the exact values. Retain the historical fallback test proving old entries without metadata count as +1.

- [ ] **Step 5: Run copy and analytics tests**

Run: npx vitest run config/economy.consistency.test.ts utils/keyEconomyEvidence.test.ts

Expected: PASS.

- [ ] **Step 6: Commit player-facing documentation**

    git add config/economy.ts config/economy.consistency.test.ts components/ReferenceModal.tsx components/ReferenceModal.test.tsx components/CoachStrip.tsx components/SectionGuide.tsx components/OnboardingWizard.tsx utils/keyEconomyEvidence.test.ts
    git commit -m "docs: explain weighted fate economy"

---

### Task 7: Full Verification and Release Safety

**Files:**
- Modify only files required by failures directly caused by Tasks 1-6
- Do not modify docs/superpowers/plans/2026-08-02-fate-locked-discord-server.md

**Interfaces:**
- Consumes all prior task outputs
- Produces a verified production build with no new interface

- [ ] **Step 1: Run all focused balance and migration tests together**

Run: npx vitest run config/economy.consistency.test.ts context/gameReducer.test.ts utils/fateCompensation.test.ts utils/fateEventEligibility.test.ts utils/saveSchema.test.ts utils/integrity.test.ts utils/keyEconomyEvidence.test.ts components/ChangelogModal.test.tsx components/ChangelogModal.dom.test.tsx utils/changelogState.test.ts App.lifecycle.test.tsx

Expected: PASS with no skipped new tests.

- [ ] **Step 2: Run the complete test suite**

Run: npm test

Expected: PASS.

- [ ] **Step 3: Run static type checking**

Run: npm run typecheck

Expected: exit code 0.

- [ ] **Step 4: Build the production app**

Run: npm run build

Expected: exit code 0 and a successful Vite production build.

- [ ] **Step 5: Verify the final diff and workspace boundaries**

Run: git diff --check

Expected: no whitespace errors.

Run: git status --short

Expected: only intended Fate-rebalance files plus the pre-existing untracked Discord plan.

- [ ] **Step 6: Commit any verification-only corrections**

If Steps 1-5 required a correction, stage only the files named by that correction and commit:

    git commit -m "fix: complete fate rebalance verification"

If no correction was required, do not create an empty commit.
