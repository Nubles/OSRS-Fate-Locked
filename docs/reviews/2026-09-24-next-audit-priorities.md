# Next audit priorities — 24 September 2026

Scope: remaining risks after the September update, focused on Vanilla mode. This is the original review handoff, not a declaration that the app is fully fact-checked or release-ready. Follow-up repairs and current verification are recorded in [the repair report](2026-09-24-vanilla-follow-up-repairs.md); the original evidence below is retained.

Paths and line numbers refer to the working tree reviewed on this date. `../audit/` is the adjacent local evidence directory. Confirmed behavior, unverified risks, and test gaps are distinguished below.

## Confirmed defects to address first

### High priority — Diary eligibility and completion miss equipment and mobility locks

- `data/diaryTasks.ts:8` and `:27` define requirement options/tasks without equipment gates; the shared evaluator is `utils/journalStatus.ts:318`, with the completion guard at `utils/journalCompletion.ts:69`.
- Isolated Vanilla reproduction: `wild_easy_8` (equip a team cape, `data/diaryTasks.ts:516`) returned eligible and completion succeeded with `equipment: {}` and Ferox Enclave unlocked. Cape was still locked.
- `des_easy_4` (desert robes, `data/diaryTasks.ts:98`) likewise passed with every equipment slot locked.
- `ard_med_1` (fairy-ring travel to the zoo, `data/diaryTasks.ts:63`) returned eligible with `mobility: []` and Fairytale II complete. Fairy Rings is a separate Fate unlock in `data/items.ts:19`.
- The [Wilderness Diary](https://oldschool.runescape.wiki/w/Wilderness_Diary) and [Ardougne Diary](https://oldschool.runescape.wiki/w/Ardougne_Diary) corroborate the named task actions. These findings concern missing app unlock checks, not newly discovered OSRS mechanics.
- Regression needed: locked/unlocked equipment and mobility matrices shared by suggestions and completion; inspect other diary actions requiring worn equipment or unlocked travel.

### P2 — RuneProof progress is absent from save exports and recovery snapshots

- `utils/gamePersistence.ts:99` serializes GameState; `context/GameContext.tsx:2782` uses that serialization for export.
- Guide item/action confirmations instead live under separate keys in `utils/questRoutes/previewChecks.ts:13` and `utils/questStrategies/previewActions.ts:9`.
- Player scenario: transferring a `.fate` backup to another browser loses guide confirmations. Restoring an older save with the same run ID leaves the newer local guide confirmations in place.
- Evidence: confirmed by tracing serialization, save-schema fields, and independent guide storage. Canonical quest completion is separate; this finding concerns guide progress.
- Regression needed: export/import with empty destination storage, then restore an earlier checkpoint of the same run and verify both guide and canonical state agree with the chosen snapshot.

### P2 — A stale tab can overwrite newer RuneProof checks

- `hooks/useRuneProofPreviewChecks.ts:68` and `hooks/useRuneProofPreviewActions.ts:80` build writes from their cached hook state.
- These writes do not use profile writer ownership or subscribe to cross-tab storage changes. `components/GoalPlannerModal.tsx:383` consumes the guide controls independently of save ownership.
- Isolated reproduction using the real checklist read/write helpers and an in-memory Map: both tabs read empty; tab A checks Cook's Assistant's egg; tab B checks flour from its stale snapshot; final stored state contains only `pot of flour`. The egg check is lost.
- No user storage was touched. No live multi-tab browser session was exercised for this reproduction.
- Regression needed: two mounted guide sessions and a tab blocked from saving the profile; unrelated checks must survive and ownership behavior must be explicit.

### P2 — Failed RuneProof writes are silently accepted in the UI

- Storage exceptions are swallowed at `utils/questRoutes/previewChecks.ts:62` and `utils/questStrategies/previewActions.ts:91`.
- The hooks retain the checkmarks in memory; failures do not reach pending-save status or the unload guard in `components/SaveRecoveryGuard.tsx:10`.
- Player scenario: storage quota or browser denial prevents persistence, yet checks appear accepted and disappear after reload. The main save indicator can still report the canonical save as saved.
- Existing hook tests confirm in-memory operation after rejected writes, but do not verify a durability warning or recovery.
- Regression needed: reject writes, expose unsaved guide progress, recover after retry, and verify it survives reload.

### P2 — Boss Planner can recommend attacks the equipped weapon cannot perform

- `utils/bossPlanner.ts:62-77` tries stab, slash, crush, and ranged for any supplied weapon, using aggressive melee stance. `PlayerCombat` does not carry the weapon's allowed attack styles.
- Isolated reproduction: existing whip fixture with slash accuracy 82, strength bonus 82, speed 4, Attack/Strength 99 and Ranged 1; synthetic target HP 150, Defence 100, stab/crush defence 0 and slash/ranged defence 300.
- Result: the planner selected stab, reported approximately 2.556 DPS and 58.685 seconds to kill.
- The [OSRS Wiki's Abyssal whip page](https://oldschool.runescape.wiki/w/Abyssal_whip) confirms that the whip is slash-only and has no aggressive stance.
- Regression needed: restrict candidate styles/stances to the equipped weapon, including whip, ranged-only weapons, and weapons with unusual attack options. This was a synthetic calculation, not an in-game kill-time benchmark.

## Gear and RuneLite contract review

### P2 review risk — Estimated tiers become definitive plugin permissions

- `services/GearService.ts:292` and `:300` export numeric tiers without the website's estimated/reviewed distinction.
- Inspected plugin source `../audit/2026-09-23-FateRuleEngine.java:100` consumes the numeric tier to decide LOCKED/ALLOWED.
- Confirmed: provenance is missing from the exported contract. Unverified: the resulting player experience in a live RuneLite session; no live-game test was performed.
- Decide how estimated tiers should affect enforcement, then add website/export/plugin parity tests for reviewed and estimated equipment. There are 893 remaining tier estimates to review.

### Unverified risk — Upstream data can change permission estimates between clients

- Equipment is fetched from mutable upstream `main`, cached for 30 days, and exported under fixed rules-version identifiers.
- Stat-anchor estimates can therefore differ between clients with different catalogue snapshots without a corresponding rule-version distinction.
- Two current local equipment snapshots had zero differences; no actual current divergence was observed.
- Review catalogue pinning/fingerprints, cache provenance, and rule-version policy before treating estimates as stable enforcement rules.

### Test gap — Relay size tests omit the real equipment catalogue

- An actual Vanilla payload containing 5,436 equipment IDs and 938 chunks measured 229,970 bytes against the 262,144-byte limit: 32,174 bytes of headroom.
- The actual payload POST returned HTTP 200 against a local relay with mocked KV. This is not production-relay or in-game verification.
- `utils/runeliteBundle.test.ts:176` returns HTTP 404 for equipment, leaving the existing size test without the full item map.
- Add representative catalogue payload coverage and enforce a growth margin; repeat the integrated website-to-plugin check before release.

## Remaining review priorities

1. **Remaining skill/activity requirements.** The September 22 audit cohort contained 1,221 skill rows that were not all individually fact-checked. This is a historical cohort count, not a current recount. Reconcile that list with today's data before claiming coverage.
2. **All 24 F2P quest journeys.** Complete real Vanilla playthrough coverage, especially alternative supply methods, already-owned items, equipment locks, prerequisite completion, and recovery after guide updates. Unit tests and source extraction are not complete playthrough evidence.
3. **Phone, offline, and integrated release behavior.** Review narrow screens, touch controls, first-load offline failure, cached offline sessions, profile switching, export/import, and the actual Vanilla website/plugin workflow. Keep release readiness separate from local preview success.
4. **Entry-bundle performance.** The current preview entry measured 244.90 kB gzip against the 130 kB guidance in `ROADMAP.md:327`. This is a performance concern requiring device/network measurements, not a demonstrated runtime failure.
5. **Stale maintenance documentation.** `docs/CONTENT_SYNC.md:24-40` still claims collection-log runtime updates append new items and assign synthetic IDs. Current `services/CollectionLogSyncService.ts:209` only exposes a notice for additions. Update the documented contract to match reviewed-data behavior.

## Suggested next sequence

Address diary unlock enforcement first, then guide durability and legal weapon styles. Settle estimated-tier enforcement and add the full relay fixture. Finish with the outstanding source audit, F2P playthroughs, and phone/offline/integrated Vanilla checks before making broader readiness claims.

This handoff contains no production deployment, live-game test, or user-data mutation.
