# Full app review — 24 September 2026

Scope: the whole web app at `6b7c301`, reviewed as nine areas: engine and key
economy, game modes and reachability, saves and profiles, interface, journal
data, advisors and combat tools, RuneProof guides, relay and integrations, plus
a pass of my own. Each finding was reproduced with a temporary test, a
browser run or a script against the real data, or traced through the code,
and is marked as such below.

**Outcome:** 100 distinct findings, after merging duplicates between areas.
99 are fixed on `claude/quirky-archimedes-aponk4`. The last, **G5**, is how
the guides are designed to work, so it is left as is (see
[Decisions](#decisions)). Each behaviour fix is pinned by a test that fails on
the old code, except the phone onboarding layout and the What's New ordering,
which were verified in the browser instead. Fixing them turned up 15 more
issues, three of them risks the first report noted; they are fixed too (see
[Found while fixing](#found-while-fixing)). Of those, the two interiors that
recorded no entry requirement have an interim fix here, and the matching
RuneLite plugin change is in its own pull request (see
[Left as is](#left-as-is)). Nothing has been deployed.

Finding IDs by area: **E** engine, **B** modes and reachability, **P** saves
and profiles, **U** interface, **J** journal data, **H** advisors and combat,
**G** RuneProof, **F** relay and integrations, **R** my own pass.

## Verification

| Check | Base `6b7c301` | This branch |
| --- | --- | --- |
| `npx vitest run` | 311 files, 4,150 passed, **1 failed** (App lifecycle Discord invite test timed out at 5.2 s under load; fixed in `030975a`) | 343 files, **4,494 passed** |
| `npx tsc --noEmit` | clean | clean |
| `npm run content:verify` | passed | passed (441 tests) |
| `npm run diary:verify` | current | current |
| `npm run changelog:verify` | n/a | passed (base `6b7c301`) |
| `VITE_BASE=/OSRS-Fate-Locked/ npm run build` | 239.5 kB gzip entry chunk | 219.9 kB gzip entry chunk, under the new 225 kB budget (it was 243.2 kB before `fea2c55`) |

Browser checks ran in Chromium against the production build, starting from a
fresh profile with localStorage and IndexedDB cleared:

First round (at `288a25e`):

- Onboarding (Next ×4, then Enter The Void) opens **Choose game mode** first. What's New, showing the new release, opens only after the mode is applied.
- On a 390×844 phone viewport, Next and Enter The Void are on screen and receive taps on every card. On the base build Next was clipped below the card.
- After Reset all progress, three reloads open the dashboard. On the base build every reload showed the recovery screen.
- Oracle search with "test" + Enter leaves the run ID and history unchanged, writes no backups and shows no diagnostics.
- The settings menu offers **Export save file (.fate)** and no item says "encrypted". Its tooltip and the export message say the file isn't encrypted, and the download is a `.fate` file.

Second round (at `04f2d66`; later commits change only this report), 14 checks, all passing:

- Onboarding and the mode prompt complete, and What's New lists this round's fixes.
- The Codex's Unlock Systems tab lists 178 Areas on Vanilla.
- With advisor panels on, a Next Best action menu opens, closes on a press on the app title (outside the Dashboard pane), and closes on Escape.
- With the Collection Log chunk delayed, its loading overlay covers only the tab pane, not the header or the side panel, with animations on and with them off.
- The Goal Planner opens on Cook's Assistant without a guide load failure.
- A second tab on the same profile shows "This profile is open in another tab". After the first tab changes a setting and closes, the second tab takes over saving and shows the first tab's newer setting.
- No page errors in either tab. The only console errors are blocked external requests (wiki images, prices), because this sandbox has no outside network access.

## Verified correct

Each area review also checked the following against the code and data, and
found them sound:

- **Secrets and saves:** Discord webhooks, Discord cursors and relay tokens stay outside GameState, and the schema's field whitelist keeps them out of exports, sync codes, backups and checkpoints. Prototype-pollution keys are rejected at every depth. Sync-code and `.fate` decoding is size-bounded and strict. Profile IDs cannot collide with sidecar keys. The save coordinator validates, checksums and reads back both stores.
- **Engine:** roll bins and die offsets are right. Clarity takes the lower of two rolls, Omni rolls only on success, and pity and Greed (including the boss-reserve clamp) behave as documented. Replay matches the reducer apart from the issues listed here. The hash chain survives a save round-trip. Seeded draws never collide, and gameplay never calls `Math.random` apart from the known `rollDice`.
- **Modes:** the roll pool, roll action, reducer guard and forecasts share `randomUnlockPool`. Completion handles Aquarium, the Chunked start chunk and bank locks consistently. Every bank surface goes through `bankLocksActive`/`isBankReachable`. Vanilla location rules cover every boss and minigame.
- **Interface:** components load through `lazyWithRetry`; the RuneProof data loader was the exception (**G3**, now fixed). Spend Keys and farm cards cannot double-spend. Drop rates, task figures, pity and ritual costs shown match config. Every command palette entry has a listener.
- **Journal data:** there are no quest prerequisite cycles, and every quest, diary, skill and area reference resolves. One eligibility check drives every journal surface. Miniquests carry 0 QP, and the collection log covers 1,926/1,926 entries with everything unlocked.
- **Combat maths:** max hit, effective levels, stance bonuses, prayer and potion multipliers, attack and defence rolls, DPS and time to kill match OSRS for non-negative rolls. There is no NaN or division by zero.
- **RuneProof:** the preview/production boundary holds for the guide catalogues (and now for the preview item lists, **G8**). Step confirmation re-checks permissions, and guide checks go through save ownership.
- **Relay and Discord:** the token travels only in POST bodies, and pairing codes are 128-bit and validated. Discord URL validation rejects look-alike hosts, and embeds stay within Discord's limits. The overlay renders text only.

## Fixed

### First round

| Commit | Findings fixed | Pinned by |
| --- | --- | --- |
| `90a3edb` | **P1** (high): after a reset, import or restore, every reload showed the "more than one run" recovery screen. The only way out deleted every checkpoint. | `utils/saveRecovery.test.ts`; browser |
| `957722c` | **R1** (high): Oracle "test" + Enter ran a diagnostic suite in production that replaced the real run with test data. **R4**: Oracle area status assumed Misthalin is free. | `OracleSearch.diagnostics.test.tsx`, `OracleSearch.test.tsx`; browser |
| `6419e6d` | **U2** (high): onboarding could not be finished on a phone. **R2**: What's New opened on top of Choose game mode. | browser (phone and desktop) |
| `0c19fc4` | **R3/F15**: Windows-1252 bytes displayed as replacement characters. | `scripts/source-encoding.test.ts`, which now checks every source and data file |
| `ccb195e` | **R10**: price API error bodies were cached as the price table for an hour. | `services/PriceService.test.ts` |
| `0c1e2a3`, `a813fdc` | **R5**: stale product name, share text, wiki user agent and metadata; the product name is now spelled one way everywhere. | — |
| `71e4336` | **P3**: a `gameModeId` such as "constructor" crashed every load. **P4**: a save paused on an Aquarium reveal became invalid. **P8**: legacy sync codes all shared one run ID. | `utils/saveCompatibility.test.ts` |
| `ab22c91` | **P6**: saves above about 1.97 MB could not be exported as .fate files. | `utils/encryption.test.ts` |
| `c458691` | **F6**: a full localStorage crashed the app from the Roll Inbox on every reload. | `services/rollInboxStore.test.ts` |
| `8b3e54c` | **U4**: one Omni-key paid for two unlocks. **U8/E1**: a second buff overwrote a paid one, and unaffordable rituals were not rejected by the reducer. **E8**: level-ups at 99 rolled rewards. **U3**: Auto-Roll kept levelling after unmount. **E2/E3**: Cartographer offers could be redrawn for free, and small frontiers showed too few offers. **E5**: replay counted a charted Chaos Temple as a Ritual of Chaos. | `gameReducer.test.ts`, `GameContext.test.tsx`, `VoidAltar.test.tsx`, `AutoRollPanel.test.tsx`, `processRepairs.test.ts` |
| `028837f` | **U1** (high): pending legacy compensation left What's New with no working close or claim control. | `ChangelogModal.dom.test.tsx` (real release list) |
| `840b023` | **U5**: Timelapse showed "INTEGRITY: BROKEN" for replay notes; **U17** (Timelapse half). **B2/J5**: Chunked doability started from the wrong chunk. **B4**: reveal toasts repeated when storage was full. | `TimelapseModal.test.tsx`, `QuestDoabilityPanel.chunked.test.tsx`, `FeatureRevealDriver.test.tsx` |
| `adfac70` | **U6**: skill cards ignored Enter and Space. **U7** (first half): Enter on the tour's Next button skipped a step. **U13**: icon-only close buttons had no name. | `Dashboard.skill-card.test.tsx`, `GuidedTour.test.tsx` |
| `bf9fb95` | **U9/E9**: the Codex contradicted the engine on Omni odds, the worked example, Storage and precision. **U12/R6**: retired modes were presented as current. **B3**: Spend Keys offered rolls with an empty pool. **B8**: counters. **B10**: copy. **U16**: skills count and shortcut labels. | `config/economy.consistency.test.ts` (Omni odds against the roll engine), `GachaSection.pool.test.tsx`, `ShortcutsPanel.dom.test.tsx` |
| `4f7c97e` | **J1** (high): level-1 skilling diary tasks had no skill gate. **J7**: Champions' Guild could never read Ready. **J10**: CA reward chips used names that match no boss. | `sync-achievement-diaries.test.ts`, `activityRequirements.consistency.test.ts` (every required area must exist), `data/consistency.test.ts` |
| `6e445ac` | **H3** (high): ammo strength was added for weapons that don't fire it (+59% DPS on darts). **H4**: hit chance could leave 0–100%. **H12**: floating-point rounding. **H13**: prayer label. | `gearStats.test.ts`, `dps.test.ts` |
| `0a022ea` | **F3**: the relay buffered any body size before checking the 256 KiB limit. | `workers/fate-relay/worker.test.ts` |
| `030975a` | **R7**: a flaky 5 s test timeout. | — |
| `677fe61` | **G2**: Cook's Assistant steps 4–9 always read "needs checking". | `utils/questWalkthroughs/evaluator.test.ts` (public catalogue) |
| `dfc8e14` | **F5**: Discord re-announced imported unlocks and went silent after a fast-clock save. | `DiscordSyncDriver.test.tsx`, `discordWebhook.test.ts`, `GameContext.test.tsx` |
| `1ae6f1a` | **H7**: the goal planner counted a quest's own points toward its own QP gate. | `goalPlanner.test.ts` |
| `4a41cef` | **J6**: the Quest Journal area filter hid quests the area gates (Varrock: 29 of 43 shown). | `QuestLog.region-filter.test.tsx` |
| `cdd112f` | **J4**: wilderness_easy_4 accepted the Abyss route without Enter the Abyss. | `journalStatus.test.ts`, `sync-achievement-diaries.test.ts` |
| `3bbaa0b`, `8dc88e1` | **H8**: max hit came from the first number in the text, so Tormented Demons read 0 (Low danger). | `MonsterService.test.ts` (parser table plus the real snapshot) |
| `54ba21d` | **R11** (new): importing or restoring spliced history from the replaced run into legacy saves, or linked hash-less imports to the old run's chain. | `gameReducer.test.ts` |
| `f73243f` | What's New release "Safer Saves, Fairer Keys and Accurate Planners". | `data/changelog.test.ts` |
| `0405db5`, `9feb8b5` | **J2**: quest difficulties match the official OSRS ratings (four changed; see [Decisions](#decisions)). | `data/questDifficulty.source.test.ts` (every quest Quest Helper lists) |
| `840c323` | **H1**: the Boss Planner has a version picker with a standard default. **H2**: the DPS Calculator selects the exact version picked. | `BossKillPlanner.version.test.tsx`, `bossPlanner.test.ts`, `MonsterService.test.ts`, `DpsCalc.weaponOptions.test.tsx` |
| `ee94c9a` | **E4**: new Chunked runs no longer get a key on their first level-up; existing runs keep their schedule. | `gameReducer.test.ts` |
| `1af5a2a` | **P9**: "Export encrypted save" only obfuscated the file. It is now "Export save file (.fate)", and its tooltip and the export message say anyone with the file can read it. | `App.lifecycle.test.tsx`; browser |
| `3fd92bf`, `7670992` | **F1** (security): a relay code lost its owner when its 24-hour data expired, so anyone could claim it and lock the owner out. An owner record now keeps a SHA-256 hash of the write token, never the token, for 90 days after its last refresh. **F14** (security): the pairing dialog no longer says RuneLite requested the connection, and warns that a link from anywhere else lets its sender read the published profile. | `workers/fate-relay/worker.test.ts` (five ownership cases), `utils/runeliteBundle.test.ts`, `RunelitePairingDialog.test.tsx` |
| `d757504` | **J3**: diary tasks that need an item, such as an axe, Karamja Hard's oomlie wrap (`kar_hard_3`) or Varrock Medium's Digsite pendant (`var_med_7`), read as doable without asking. They now ask the player to confirm the item, as Sheep Shearer does. | `journalStatus.test.ts`, `diaryEquipmentMobility.test.ts` |
| `5e3686d` | **G1**: in RuneProof guides, confirming one owned item completed other items' steps; an egg ticked off the milk steps in Cook's Assistant. A confirmed item now completes only the steps that make it. Ticking a step or completing the quest still completes every step before it. | `utils/questStrategies/coach.test.ts`, `objectives.test.ts`, `sheepCrafting.vanilla.test.ts`, `SheepCrafting.vanilla.test.tsx`, `GoalPlannerModal.runeproof.test.tsx` |

### Second round: the 41 open findings

**Saves and profiles**

| Commit | Finding fixed | Pinned by |
| --- | --- | --- |
| `025f1bf` | **P2** (high): a tab that took over saving kept its old revision counter, so the recovery database rejected its writes while the UI said "Saved", and the other tab's older save came back on reload. The coordinator now catches up to the stored revision before writing, retries once on a stale revision and never reports it as saved. A tab that gets the lease back loads the other tab's newer save if it has no unsaved changes, and otherwise shows the save conflict banner ("Another tab saved newer progress"). | `saveCoordinator.test.ts`, `recoveryDatabase.test.ts`, `GameContext.test.tsx` (including a real-IndexedDB takeover), `SaveConflictBanner.test.tsx` |
| `4a8e373` | **P5**: if IndexedDB existed but would not open, the game stayed closed. Startup now offers Try again, Continue with browser save and Export browser save. | `SaveBootstrap.test.tsx` |
| `70636b1` | **P7**: a tab restored from the back-forward cache could write a deleted profile back. A profile the newest metadata no longer lists is read-only, and the profile list is re-read on `pageshow`. | `profileWriterLease.test.ts`, `ProfileContext.test.tsx` |

**Relay and RuneLite**

| Commit | Finding fixed | Pinned by |
| --- | --- | --- |
| `0ad10b2` | **F2**: record versions restarted after the 24-hour expiry, so clients could get `304` for new content and RuneLite kept the expired profile. Versions are now `max(seconds since 2026-01-01, stored + 1)` on every write path, still an integer ETag as the plugin requires. The overlay clears its ETag on 404. | `worker.test.ts` ("Fate relay versions"), `StreamOverlay.test.tsx` |
| `f7e0e66` | **F4**: every tab published its own profile to the shared pairing. The pairing now records its profile; only that profile's tabs publish, and pairing or Disconnect in one tab reaches the others. | `relaySync.test.ts`, `OnlineSyncDriver.test.tsx`, `App.lifecycle.test.tsx` |
| `db9cfd3` | **F7**: the overlay URL dropped a custom relay address. | `relayBase.test.ts`, `RuneLiteOnboarding.test.tsx`, `StreamOverlay.test.tsx` |
| `ad78c4c` | **F8**: the overlay trusted the payload. It now validates each field, refuses inflation past 8 MiB and recovers from render errors. | `StreamOverlay.test.tsx` |
| `2393cc4` | **F9**: a failed rules-data load published an empty ruleset. Relay builds now refuse it; the error shows with Retry and the last good publish stays. | `runeliteBundle.test.ts` |
| `66afe86` | **F10**: the bundle omitted housing and storage unlocks. | `runeliteRulesManifest.test.ts`, `runelitePluginParity.test.ts` |
| `a3db28d` | **F11**: anyone who knew a code could prune its events through legacy `/acks`. Pruning now needs the events token, and the Roll Inbox keeps decisions local. | `worker.test.ts`, `RollInbox.test.tsx` |
| `1e64fd8` | **F12**: relay POSTs had no timeout. They now fail after 15 seconds. | `relaySync.test.ts` |
| `62cd1b1`, `f1ae139`, `84ac2e9` | **F13**: worker errors lacked CORS headers and preflights weren't cached (now 503 with CORS, `Max-Age` 86400), and every action was a KV write. Publishes now wait for a 5-second pause (at most 60 seconds) and go at once when the tab is hidden. | `worker.test.ts`, `OnlineSyncDriver.test.tsx` |

**Interface**

| Commit | Finding fixed | Pinned by |
| --- | --- | --- |
| `246fea7` | **U10**: the tab pane's animation trapped the Equipment Lab slot picker and the DPS monster picker inside the pane. They are portaled to the page. | `Dashboard.tabDialogs.test.tsx` |
| `9efc59a` | **U7** remainder: the tour card now takes and keeps focus and returns it at the end. | `GuidedTour.test.tsx` |
| `611d006`, `d04dd33` | **U11**: Roll Inbox rows (and the same pattern in sync-code tabs and History filters) were defined in render, so they remounted and lost focus. | `RollInbox.test.tsx`, `SyncCodeModal.test.tsx`, `LogViewer.filters.test.tsx` |
| `dc30229` | **U14**: a second unlock or achievement reveal inherited the first one's timer. | `Dashboard.reveals.test.tsx` |
| `2896483` | **U15**: the pairing dialog could not be closed after a failed send. | `RunelitePairingDialog.test.tsx`, `App.lifecycle.test.tsx` |
| `c405003` | **U17** remainder: the share card showed a fixed "/50" Fate. It shows the mode's threshold, and no denominator with pity off. | `RunCard.test.tsx` |
| `b97cd80`, `b544bdc` | **J12**: jumping to a quest (or a diary) didn't clear the filters and search that hid it. | `QuestLog.jump.test.tsx`, `DiaryLog.jump.test.tsx` |
| `6d5cc48` | **G3**: RuneProof loaded its guides with a bare `import()` and showed an empty picker on failure. It now retries through `importWithRetry` and shows an error with Retry and Reload. | `questWalkthroughLoader.test.ts`, `GoalPlannerModal.runeproof.test.tsx` |

**Engine and modes**

| Commit | Finding fixed | Pinned by |
| --- | --- | --- |
| `c44889a` | **E6**: the replay capped Fate at 50 whatever the mode, so pity-off runs read REPLAY WARNING, and legacy compensation used the same fixed 50. Both now follow the run's own pity rule. | `integrity.test.ts`, `fateCompensation.test.ts`, `saveSchema.test.ts`, `RunCard`, `SyncCodeModal` and `TimelapseModal` tests |
| `654a73d` | **E7**: the engine and the Void Altar disagreed on the Gambit's minimum stake in legacy modes. One `ritualFateCost` prices every ritual for both, and for the Codex. | `GameContext.rolls.test.tsx`, `economy.consistency.test.ts`, `VoidAltar.test.tsx` |
| `6d6bb92` | **E10/J11**: accepting a detected RuneLite event ignored the manual rules: recorded progress rolled again, Vanilla boss reserves and clue rates were skipped, skill odds used the wrong formula, the replay missed a level's Chaos Keys on a pity roll, and completed CA and diary tiers went unrecorded. | `fateEventEligibility.test.ts`, `detectedEventAcceptance.test.ts`, `integrity.test.ts` |
| `3802c9b` | **B6**: legacy Xtreme could not roll its eight locked Misthalin areas. `unlockableAreas(mode)` is now the Areas list for the pool, availability, completion and the Spend Keys card. | `gameEngine.test.ts`, `completion.test.ts`, `saveSchema.test.ts`, `GachaSection.pool.test.tsx` |
| `983f16a` | **B5**: area achievements could not be earned in Chunked. They now count reachable areas in every mode. | `achievements.test.ts` |
| `33d9cb6` | **B1**: the share-card map coloured whole continents and treated Misthalin as free. Each chunk is now coloured by its own area. | `RunCard.map.test.tsx`, `RunCard.test.tsx` |
| `677c932` | **B7**: the Region Advisor ranked whole continents, which nothing unlocks. It ranks single areas the Areas table can roll. | `advisor.test.ts`, `RegionAdvisorPanel.test.tsx` |
| `3a29cb0` | **B9**: goal plans turned location labels such as "North Taverley" into area steps (265 in fresh-Vanilla plans). They now plan the areas, or in Chunked the chunks, that unlock the location. | `goalPlanner.test.ts`, `goalRoute.test.ts` |

**Journal, advisors and combat**

| Commit | Finding fixed | Pinned by |
| --- | --- | --- |
| `b2823bb` | **J9**: Enter the Abyss's Wizards' Guild route ignored Magic 66, the guild's entry level. | `journalStatus.test.ts`, `tasksConsistency.test.ts` |
| `2cd9842` | **H11/J8**: Warriors' Guild readiness used raw levels; it now uses tier-capped levels like its diary task. | `activityReadiness.test.ts` |
| `1aa993d` | **H5**: "Boosts on" applied Piety or Rigour without checking the unlock or Prayer level. The planner now assumes the best prayer the player can use, and names it. | `bossPlanner.test.ts`, `BossKillPlanner.boosts.test.tsx` |
| `48b9ecf` | **H6**: the Frontier Advisor scored quests unlocked by an exact chunk as 0. | `frontierAdvisor.test.ts` |
| `7e38008` | **H8** remainder: max hits with no number ("N/A", "Varies", "? (melee)") read as 0. They now read as unknown. | `MonsterService.test.ts`, `bossPlanner.test.ts`, `BossKillPlanner.threat.test.tsx` |
| `7a4d7ae` | **H9**: the Skill Advisor simulated a locked skill as tier 1. | `skillAdvisor.test.ts` |
| `dfaaa70` | **H10**: every goal-plan skill step suggested a Skills key. | `goalPlanner.test.ts`, `goalRoute.test.ts` |
| `04c2e95` | **H14**: the Fate Forecast pace counted key events, not the gaps between them. | `fateForecast.test.ts` |
| `df3e8bc`, `89d0ed5`, `28d7463`, `03722f7` | **H15**: frontier content could outrank a new-area foothold, skill steps sorted Z→A, kill times read "1m 60s", and the Quest Advisor recomputed its context per candidate (1.2 s for 55 quests). | `frontierAdvisor.test.ts`, `goalPlanner.test.ts`, `dps.test.ts`, `questAdvisor.test.ts` |

**RuneProof**

| Commit | Finding fixed | Pinned by |
| --- | --- | --- |
| `a44e3ec` | **G4**: sources behind a locked chunk ranked above usable ones in "Other legal sources". | `coach.test.ts` |
| `44ee57d` | **G6**: a pinned quest's route header always read 0%. | `goalRoute.test.ts` |
| `2dce25a` | **G7**: de-duplication merged an interior source into the surface source at the same chunk, dropping its access. Both are kept; route IDs don't change, and a later variant ranks after an otherwise-equal route. | `goalPlannerRuneProof.test.ts`, `chunkSourceIndex.test.ts`, `ranker.test.ts`, `analyzeQuest.test.ts` |
| `17975e0`, `10c26ef`, `60e102f` | **G8**: three preview-only quest item lists shipped in the production bundle. They now live in a preview module that normal builds replace with an empty one. Item checks for preview guide packs are accepted from each pack's own list. | `vite.config.runeproof-boundary.test.ts`, `runeproof-public-bundle.test.ts` (real production and preview builds), `previewChecks.test.ts`, `useRuneProofPreviewChecks.test.tsx` |

**Build and CI**

| Commit | Finding fixed | Pinned by |
| --- | --- | --- |
| `fea2c55` | **R8**: the entry chunk had grown to 243 kB gzip. On-demand screens now load when first needed, and `npm run build` fails if the entry chunk passes 225 kB. | `check-entry-budget.test.ts` |
| `f085867` | **R9**: content-sync PRs, opened with `GITHUB_TOKEN`, never ran CI. The workflow now dispatches CI on the sync branch. | `ci-contract.test.ts` |

What's New describes the player-facing changes in `e2f5bb9`, `e902525` and
`c2bbf58`.

### Found while fixing

| Commit | Issue fixed | Pinned by |
| --- | --- | --- |
| `8017b9d` | **R13** (was a noted risk): legacy Fate compensation was calculated for every save below the current version, so a v5 bump would offer it again to v4 saves. It is now tied to version 4, the weighted-Fate release. | `saveSchema.test.ts` |
| `217d972`, `ddfe3dc` | Magic accuracy used +8, not +9, and the Magic stance bonuses differed from the Wiki DPS calculator (both were noted risks). | `dps.test.ts`, `gearStats.test.ts` |
| `fcaad7b` | **R12**: a wiki image that failed once was re-stamped on every read and never looked up again. | `WikiService.test.ts` |
| `3c0022c` | The goal planner showed "Wizards' Guild + Magic 66" but planned no Magic step, and joined a route to its steps with a stray "?". | `goalPlanner.test.ts` |
| `535cb71` | The Codex still listed 178 Areas on legacy Xtreme (186 now). | `ReferenceModal.test.tsx` |
| `8c9dfa8` | A detected level-up did not pay the Xtreme or Chunked start-area milestone keys a manual level-up pays. | `detectedEventAcceptance.test.ts` |
| `e32a1a6` | A detected Brutus kill matched no boss, as Brutus is not in `BOSS_TIERS`. | `fateEventEligibility.test.ts` |
| `b6ba9c8` | With one profile open in two tabs, the tab that wasn't saving still published its older state to RuneLite. Only the saving tab publishes now; a blocked tab says why. | `OnlineSyncDriver.test.tsx` |
| `7f6367e` | A stalled chunk-content request never failed, so chunk panels loaded forever with no Retry. It now times out after 30 seconds. | `ChunkContentService.timeout.test.ts` |
| `ea4e8d9` | The Next Best menu's click-outside layer covered only the tab pane (the same trap as U10). It now closes on any outside press or Escape. | `JournalNextBest.menu.test.tsx` |
| `fa9daeb` | Tab loading dimmed only the pane with animations on, but the whole screen with them off. It now dims the tab either way. | `LoadingFallback.test.tsx`; browser |
| `f9f61b3` | Chunked goal plans still planned area requirements as Areas-table unlocks. They plan any chunk of the area. | `goalPlanner.test.ts` |
| `bfed7c5` | Keeping interior sources (**G7**) showed two interiors with no entry requirement, so their sources read as free: the Warriors' Guild basement (interior 11675) and Misthalin Manor. An interim review in `data/sources/interior-access.json` gates them: the basement needs Warriors' Guild access plus a confirmation of its own entry, and the manor needs a confirmation that names Misthalin Mystery. The confirmations block the routes and show their text, as the existing "needs confirmation" entries do. `public/chunk-content.json` is regenerated by the script, and its data version is 14. | `ChunkContentService.interiors.test.ts` (generated entrances, compiled gates, the sources inside), `analyzeQuest.test.ts` |

## Decisions

The six owner decisions were made on 24 September and are done on this branch:

- **J2, match OSRS.** Quest Helper's list of official ratings (the pinned snapshot, and its current master) differs from the app for four quests: At First Light (now Novice), Recipe for Disaster's Sir Amik Varze and King Awowogei parts (now Master) and its finale (now Grandmaster). The reviewer had named six other quests; Quest Helper rates all six Intermediate, as the app already did, so they are unchanged. The wiki itself was unreachable, and web search results mixed in older RuneScape ratings. Three newer quests are not in the snapshot and keep their current rating.
- **H1, add a version picker.** Done, with the post-quest, normal or solo fight (or a fight's opening phase) as the default. **H2** is fixed with it.
- **E4, new runs only.** Choosing the game mode now starts the milestone counters from the run's starting total. Runs that already chose their mode keep their schedule.
- **J3 / G1, confirm owned items.** Every "I already have it" route now needs the one-tap confirmation Sheep Shearer uses, and a confirmation completes only that item's own steps. The app no longer assumes what is in a player's bank; players who have the item tap once more.
- **P9, relabel rather than encrypt.** The export is now "Export save file (.fate)" and says anyone with the file can read it. Passphrase encryption was not added: a forgotten passphrase would lock players out of their only off-device backup, and the file holds little that is sensitive.
- **F1, owner record.** Each code has an owner record, `own:r:<code>`, holding only a SHA-256 hash of the write token and when it was last refreshed. It lasts 90 days from the last refresh, and publishes refresh it at most once a day to spare KV writes; the profile itself keeps its 24-hour lifetime. A code stays claimed while in use and can be claimed again after 90 idle days, which is safe for random 128-bit codes. Codes published before the change are adopted on their owner's next publish, and `docs/online-relay.md` records the new retention. **F14**'s wording is fixed in the same change. Asking players to match a code shown in RuneLite would need a plugin change, so it is not included.

One finding is closed without a change:

- **G5, a guide revision bump drops earlier checks.** This is the design. `docs/reviews/2026-09-22-quest-equipment-readiness.md` says revisions were advanced "so older confirmations cannot silently carry over", and the preview design keeps public revisions stable to preserve progress. Changing it would let a confirmation made against an older step carry over to a changed step.

### Judgment calls to review

The fixes made these choices, which you may want to revisit:

- **P2:** when a tab gets the lease back after another tab saved, it loads the newer save silently if it has no unsaved changes of its own (with a "Loaded newer progress saved in another tab" toast), and otherwise shows the conflict banner.
- **F2:** the ETag stays an integer because the plugin only imports a strictly greater integer version. Two of the owner's writes in the same second can still share a version; `docs/online-relay.md` records this.
- **F4:** pairings made before the change have no profile. Each binds to the profile of the first tab that publishes after the upgrade; re-pairing from the right profile moves it.
- **F11:** the Roll Inbox keeps accept and dismiss decisions local by default. The legacy relay routes stay, as the docs promise installed clients.
- **F13:** a change reaches RuneLite after a 5-second pause (at most 60 seconds during nonstop play), or at once when the tab is hidden.
- **H5:** the in-game unlocks for Piety, Chivalry and Rigour (Knight Waves, prayer scrolls) can't be checked, so their Arcana unlock plus the level and quest gates are enough.
- **G4:** usable sources now lead: on fresh accounts, 13 of the 16 top alternatives in the public guides changed, each from a chunk-locked source to a usable one.
- **G7:** kept interior sources rank after existing routes on a tie, so no public guide's top route or step changed. It surfaced two interiors whose entry requirements were never recorded; `bfed7c5` gates them for now (see below).
- **B5:** World Tour's target follows the mode (186 on legacy Xtreme) but keeps the ID `regions-178`, so it isn't revealed again. A legacy Xtreme run that earned it at 178 areas shows it as unearned until its Misthalin areas are unlocked.
- **B6:** legacy Xtreme's Areas pool grows from 178 to 186, so a seeded Xtreme run's future Areas rolls differ from before. Past rolls and their verification are unaffected.
- **E10:** detected quests and skills that are locked are refused too, as manual completion refuses them, and reviewing an inbox row stands in for the Journal's confirmation prompt.
- **J9:** Enter the Abyss's entry in `data/sources/quest-requirement-audit.json` was updated by hand with a dated note, as `82123bb` did; the refresh script needs the wiki and would reset it.
- **Single publisher (`b6ba9c8`):** a paired tab that isn't saving shows "This tab isn't saving this profile, so it can't publish to RuneLite." as its relay status.

## Left as is

- **The two interiors' exact requirements.** `bfed7c5` is an interim review: it names no requirement that couldn't be checked, and each entry's note says it awaits a wiki-verified one. Replacing the confirmations with the real entry rules, pinned to a wiki revision, needs `oldschool.runescape.wiki`, which this environment's network policy blocks. It stays queued as a separate task.
- **The plugin's inflate cap** is in [Nubles/OSRS-Fate-Locked-Runelite#15](https://github.com/Nubles/OSRS-Fate-Locked-Runelite/pull/15) and ships with the next plugin release, not with the web app. Inflation stops past 8 MiB, the overlay's limit; a fully unlocked account's bundle inflates to about 120 KiB. `repo.runelite.net` is blocked here too, so `gradle clean check` runs in that PR's CI; the changed class and its tests were compiled and run locally against Gson, Lombok and JUnit (8 tests pass).
- **"Fate: N/50" in pity-off roll history.** A failed roll's history details show the mode's threshold even with pity off. History text feeds the seeded-RNG context, so changing it would change future outcomes of seeded runs in progress.
- **Detected Collection Log rolls** record their source as "Collection Log", while manual ones record "Col. Log: <item>", for the same reason.
- **`isValidUnlock` ignores the mode.** Checked: the mode only matters for Chunked, which has no Areas table, so nothing changes.
- **An expected error in the test log.** `GoalPlannerModal.runeproof.test.tsx` deliberately feeds the coach a broken analysis to check that the failure is contained, and jsdom prints the caught `TypeError`.

## Guards against drift

Against `6b7c301`, the branch adds 32 test files and extends 81 more. The broad guards are:

- `scripts/source-encoding.test.ts`: every app source and data file must be strict UTF-8.
- `config/economy.consistency.test.ts`: every Omni percentage and ritual cost the Codex documents must match the engine.
- `data/activityRequirements.consistency.test.ts`: every required area must be a known area.
- `data/consistency.test.ts`: CA reward chips must name real bosses.
- `scripts/sync-achievement-diaries.test.ts`: level-1 skilling tasks must carry the skill gate, and the alternative-route list must match the audit.
- `components/ChangelogModal.dom.test.tsx`: uses the real release list, so a claim buried in an old release can't pass again.
- `data/questDifficulty.source.test.ts`: every quest's difficulty must match the official rating in the pinned Quest Helper snapshot, and new quests missing from it are named.
- `scripts/check-entry-budget.mjs`, run by `npm run build`: the entry chunk must stay under 225 kB gzip.
- `scripts/runeproof-public-bundle.test.ts` and `vite.config.runeproof-boundary.test.ts`: real production and preview builds must keep preview-only guide text out of production.
- `scripts/ci-contract.test.ts`: the content-sync workflow must dispatch CI on its pull request.
- `utils/runelitePluginParity.test.ts`: lists the unlock fields the plugin reads, so the bundle and the Java side can't drift apart.
- `workers/fate-relay/worker.test.ts`: versions must stay importable by the plugin after expiry, and ownership must hold on every write path.

## Not covered

- The RuneLite plugin (Java) and its side of the relay contract, the deployed Cloudflare Worker and KV, a real Discord webhook, and Wise Old Man; all were exercised with mocks only.
- OSRS Wiki facts: the wiki was unreachable from this sandbox, so artwork, wiki-fed data, quest difficulties and the Magic accuracy figures were checked against Quest Helper and the Wiki DPS calculator's published formulas, not the live wiki.
- Browsers other than Chromium, real phones (an emulated 390×844 viewport only), and assistive technology beyond accessible-name and keyboard checks.
- Chunked and legacy modes were covered by unit tests and data checks, not a full browser playthrough.

## Deployment notes

- The web app deploys on merge to `main`. The relay worker changes only go live after `wrangler deploy` from `workers/fate-relay`: the body size limit (`0a022ea`), code ownership (`3fd92bf`), rising versions (`0ad10b2`), the `/acks` token check (`a3db28d`) and CORS on errors (`62cd1b1`). Existing codes gain an owner record on their first publish after that deploy, and the first publish reads as newer to plugins holding old counters. Nothing needs migrating.
- Deploy the worker before or with the web app: the web app's publishing changes work against the old worker, but relay versions and ownership only hold once the worker is deployed.
- Diary tasks that need an item show a **Confirm:** chip, and RuneProof guides count only steps an item's own confirmation completes, so some existing runs show fewer completed steps until the player confirms. Completed diary tasks and quests are unaffected.
- The monster catalogue's `normalizationVersion` is now 3, so cached catalogues are rebuilt once from the shipped file. No network request is needed.
- The chunk content data version is now 14, so browsers fetch the regenerated `chunk-content.json` once.
- Discord cursors saved by the old version reseed silently to the newest history entry. No announcements are replayed.
- Legacy Xtreme runs gain eight rollable Misthalin areas, and World Tour needs them. Chunked runs may earn area achievements on their next check.
- A RuneLite pairing made before this version binds to the first profile that publishes after the update.
- `npm run build` now fails if the entry chunk passes 225 kB gzip.
- Content-sync pull requests now dispatch CI with the workflow's `GITHUB_TOKEN`, which needs `actions: write` (granted in `sync-content.yml`).
- Every player sees the new What's New release once. The Chunked milestone change applies to runs whose mode is chosen after deploy. Boss Planner version choices are stored per device.
