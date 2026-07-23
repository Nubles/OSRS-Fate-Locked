# Game-data accuracy remediation design

**Date:** 2026-07-23

## Objective

Make quest, Achievement Diary, and Combat Achievement guidance match the current Old School RuneScape rules, and make every surface that recommends or awards progress use the same mode-aware eligibility result.

## Scope

This change will:

- Correct the known quest requirement drift identified by the full-app audit.
- Represent normal skills, calculated combat level, named areas, exact chunks, prerequisites, alternative routes, and display-only manual requirements without quest-specific conditionals.
- Replace the broad Port Sarim approximation for A Porcine of Interest with the actual Draynor and South Falador Farm route.
- Refresh all Achievement Diary tasks to the current total of 492 while preserving existing completion IDs wherever the same task still exists.
- Refresh Combat Achievements to 646 tasks and current reward thresholds.
- Calculate Combat Achievement rewards from cumulative task points across every tier.
- Make the Journal, planner, advisor, task counters, and any key-awarding completion action consume the same eligibility evaluators.
- Correct the authored What's New text so it claims only behavior that is actually fixed.
- Add deterministic source metadata and consistency tests that expose future drift.

This change will not:

- Modify the RuneLite plugin or its Plugin Hub behavior.
- Change Fate Point rewards, key odds, adjacency rules, seeded randomness, or other balance decisions.
- Rebuild all content around a general-purpose rules engine.
- Automatically trust live wiki data during a production build or pull-request check.
- Revoke quest, diary, or Combat Achievement rewards already recorded in a player's save.
- Attempt to model inventory items, temporary boosts, recommended levels, or every quest-step instruction as hard eligibility gates.

## Authoritative sources

The curated data will be checked against the Old School RuneScape Wiki pages for the individual quest, Achievement Diary, and Combat Achievements. The implementation records the source URL and verification date alongside generated or curated snapshots.

The release baseline for this remediation is:

- Achievement Diaries: 492 tasks across 12 regions.
- Combat Achievements: 646 tasks.
- Combat Achievement tier counts: Easy 41, Medium 60, Hard 86, Elite 164, Master 174, Grandmaster 121.
- Combat Achievement reward thresholds: 41, 161, 419, 1075, 1945, and 2671 cumulative points.
- Combat Achievement point values: 1 through 6 points for Easy through Grandmaster tasks.

Primary reference pages for this baseline:

**Authoritative-source update (2026-07-23):** During implementation, the
official overview revision still displayed the earlier 637-row summary, while
the official live Globals and six tier API tables had advanced to 646 after
nine Maggot King tasks were added. The live structured sources take precedence
over the stale prose table. The committed API snapshot records both results,
the exact retrieval query/time, and current page revisions so this discrepancy
is explicit and reproducible offline.


- [Achievement Diary](https://oldschool.runescape.wiki/w/Achievement_Diary) and [all achievements](https://oldschool.runescape.wiki/w/Achievement_Diary/All_achievements).
- [Combat Achievements](https://oldschool.runescape.wiki/w/Combat_Achievements).
- [Quest requirements by quest](https://oldschool.runescape.wiki/w/Quests/Requirements_by_quest).
- [The Curse of Arrav release requirements](https://oldschool.runescape.wiki/w/Update%3AThe_Curse_of_Arrav_%26_Mobile_Anniversary_Update).
- [The Final Dawn release requirements](https://oldschool.runescape.wiki/w/Update%3AVarlamore%3A_The_Final_Dawn_Out_Now).
- [Sailing launch requirements](https://oldschool.runescape.wiki/w/Update%3APrepare_for_Sailing_-_Launching_November_19th%21).

Live source access is a maintenance input, not an application runtime dependency. Generated files are committed, reviewed, and verified locally. This design supersedes the Porcine location approximation and related changelog wording in the earlier user-reported tracker-fixes design.

## Requirement model

### Additive quest contract

Existing QuestData fields remain valid so the current dataset and saved quest IDs do not need a wholesale migration. The following focused fields are added:

- combatLevel: an optional minimum calculated combat level.
- locations: an optional list of logical locations that are all required.
- manualRequirements: optional official requirements that the app cannot observe, shown to the player but not treated as automatically satisfied or failed.
- oneOf options may include locations in addition to their existing named-area and guild alternatives.

A logical location has a stable ID and player-facing label plus two access representations:

- standardAreas: the named areas that must be reachable in named-area game modes.
- chunkOptions: the exact map chunks of which at least one must be unlocked in Chunked mode.

All logical locations in a quest's locations list are required. Within one logical location, the evaluator uses the representation for the active game mode. This gives South Falador Farm an exact Chunked-mode check without treating any Port Sarim or Falador chunk as equivalent.

Location records are data, not branches inside the evaluator. Their exact coordinates must exist in the canonical map data and are pinned by consistency tests.

### Skill and combat semantics

Ordinary skill requirements remain in QuestData.skills. The pseudo-skill name Combat is removed from authored data.

Skill eligibility requires all of the following:

1. The skill has an unlocked method tier.
2. The recorded level meets the official requirement.
3. The method cap from the unlocked tier meets the official requirement.

Quest Points retain their existing special calculation and are not treated as a trainable skill.

Combat-level requirements use the existing exported combatLevel calculation in utils/slayerReach.ts. Dream Mentor therefore checks a real calculated combat level of 85 rather than looking for an unlock tier named Combat.

### Shared evaluation results

The implementation exposes pure evaluators for quests, diary tasks, and Combat Achievement tasks. They share the same primitives for skills, combat, areas, locations, prerequisites, and active game-mode rules.

Each evaluator returns a structured result containing:

- eligible: the final boolean.
- status: the existing compatible status used by the UI where applicable.
- blockers: typed unmet requirements with player-facing labels.
- evidence: satisfied requirements when a progress display needs them.

The existing getQuestStatus function remains as a compatibility wrapper over the canonical quest evaluator. Consumers must not reimplement eligibility with direct unlock-array checks.

The canonical result is used by:

- QuestLog and Journal summaries.
- Goal Planner and strategy/advisor calculations.
- Doable-task counts and recommendations.
- Quest, diary, and Combat Achievement completion controls that can award a key.
- Reveal and impact calculations that simulate a future unlock.

The active gameModeId and custom rules are threaded through every one of these paths. Historical completed entries remain viewable even if the current evaluator would block a new completion.

## Corrected quest baseline

The remediation explicitly audits and corrects these known drifted records:

- A Porcine of Interest: Misthalin/Draynor access plus the real South Falador Farm location; Port Sarim is not a substitute.
- Dream Mentor: calculated combat level 85.
- Ethically Acquired Antiquities: 25 Thieving; Children of the Sun and Shield of Arrav; travel through Civitas illa Fortis, Port Sarim, and Varrock Museum.
- The Curse of Arrav: Defender of Varrock and Troll Romance, with 64 Mining, 62 Ranged, 62 Thieving, 61 Agility, 58 Strength, and 37 Slayer. While Guthix Sleeps is not a prerequisite.
- The Final Dawn: The Heart of Darkness and Perilous Moons, with 66 Thieving, 52 Fletching, and 52 Runecraft.
- Shadows of Custodia: Children of the Sun, 54 Slayer, 45 Fishing, 41 Construction, and 36 Hunter.
- Scrambled!: Children of the Sun, 38 Construction, 36 Cooking, and 35 Smithing.
- Pandemonium: no skill or quest prerequisite, with its real Port Sarim start/access.
- Prying Times: Pandemonium and The Knight's Sword, 30 Smithing and 12 Sailing. Its open-task-slot requirement is displayed as manual because the app cannot observe Sailing task slots.
- Current Affairs: Pandemonium, 22 Sailing, and 10 Fishing.
- Troubled Tortugans: Pandemonium, 51 Slayer, 48 Construction, 45 Sailing, 45 Hunter, 40 Woodcutting, and 34 Crafting.

The implementation also compares every quest record added in the same recent-content block, rather than limiting tests to the examples above. Any discrepancy found during that source pass is corrected in the same data-focused task and recorded in the source audit fixture.

## Achievement Diary refresh

Achievement Diary data becomes reproducible from a committed, reviewed source snapshot and a deterministic generator. The generated task module is not hand-edited.

Identity rules:

- An unchanged in-game task keeps its current application ID.
- A wording-only update keeps the existing ID and updates its label/requirements.
- A replaced task receives a new canonical ID plus an explicit old-ID-to-new-ID migration only when the new task is the genuine successor for completion purposes.
- A removed task with no successor remains a recognized legacy ID for history/import compatibility but is excluded from current totals and reward qualification.
- Migrations are idempotent and de-duplicate completedTasks.

The snapshot records area, tier, task text, skills, quests, access requirements, canonical ID, legacy aliases, source URL, and verification date. A generated-data test fails on duplicate IDs, unresolved aliases, unknown areas/skills/quests, or a total other than 492.

Diary tier rewards remain sticky. Existing unlocks.diaries entries are never deleted. New completion and key awards require every current task in that area/tier and any preceding tier semantics already required by the app.

## Combat Achievement refresh and points

The existing sync-combat-achievements script remains the source of data/caTasks.ts; generated CA data is not hand-edited. The sync script keeps the stable in-game task ID and emits source metadata. It aborts before writing on empty tiers, duplicates, or implausible totals.

Reward qualification changes from all-tasks-in-this-tier semantics to cumulative points from completed tasks across all tiers:

- Easy tasks award 1 point.
- Medium tasks award 2 points.
- Hard tasks award 3 points.
- Elite tasks award 4 points.
- Master tasks award 5 points.
- Grandmaster tasks award 6 points.

A reward tier is newly earned when total completed-task points meet its threshold. Stored unlocks.cas entries are sticky compatibility markers: an imported or historical earned tier is never revoked, and crossing a threshold only awards its key once. The UI shows current points, the next threshold, and earned reward tiers from this same calculation.

Task-level availability uses the shared access primitives only where the dataset has reliable encounter/location requirements. Missing machine-readable combat constraints are displayed as task information and are not invented as hard gates.

## Data provenance and drift protection

Source-aware tests pin:

- The 492 Diary total and uniqueness of every current task ID.
- The 646 Combat Achievement total, per-tier counts, point values, and thresholds.
- The corrected quest records and absence of the known wrong prerequisites/routes.
- Every referenced skill, quest, area, guild, and chunk against canonical application data.
- Stable ID migrations, idempotence, and no silent loss of completed task IDs.
- The exact South Falador Farm location mapping in standard and Chunked modes.
- Dream Mentor combat evaluation using the standard formula.
- Cumulative Combat Achievement points across mixed tiers and one-time tier awards.

A network-backed freshness check may continue as a scheduled/manual maintenance tool. Pull-request checks use only committed snapshots and deterministic local validation so transient wiki availability cannot make an otherwise identical commit pass or fail.

## Error handling and compatibility

- Missing new fields preserve current legacy behavior.
- Empty locations or oneOf arrays do not make a quest impossible.
- Malformed generated records fail validation during development/CI rather than being ignored at runtime.
- Unknown legacy completed-task IDs remain stored and visible to migration code; they do not count toward current totals unless explicitly aliased.
- Quest IDs, diary reward IDs, CA task IDs, TableType values, and save field names remain stable.
- Previously earned diary and CA reward tiers remain earned.
- No plugin bundle contract changes are required.

## Testing

Implementation follows test-first development. Required regression coverage includes:

- Every corrected quest record and each blocker type.
- A Porcine of Interest failing with Port Sarim alone and passing through the correct standard and Chunked routes.
- Dream Mentor at combat levels 84 and 85 using representative combat-stat combinations.
- Skill level high enough but method cap too low.
- Alternative access routes in named-area and Chunked modes.
- The same quest result across Journal, planner, advisor, and completion action adapters.
- Diary generator totals, stable IDs, alias migrations, replaced/retired task behavior, and tier completion.
- CA generator totals, mixed-tier point accumulation, exact thresholds, sticky historical tiers, and no duplicate key award.
- Changelog wording contains no claim that remains false.
- Full application tests, TypeScript checking, deterministic content verification, and production build.

## Success criteria

- The known inaccurate quest records show the current official requirements and locations.
- All 492 current Diary tasks and all 646 current Combat Achievement tasks are represented with pinned totals.
- CA reward tiers use 41/161/419/1075/1945/2671 cumulative points.
- The same player state cannot be reported as eligible by one first-party surface and ineligible by another.
- Existing saves keep their quest, diary, CA, and completed-task progress without duplicate rewards.
- Future content drift produces a clear deterministic test or source-status change instead of silently changing runtime behavior.
