# Wyrmscraig Content Update Design

**Date:** 2026-08-16  
**Status:** Approved in conversation  
**Branch:** `codex/wyrmscraig-content-update` (from `main`)

## Summary

Fate Locked already contains the Wyrmscraig landmass, bank, and part of its
chunk data, but it does not yet present the July 29 release and August 12
follow-up as a complete, internally consistent content set.

This update will add Fallen From Grace and The Mad Angel as first-class Fate
Locked content, expose the new training methods in the existing Skill Unlocks
view, add the new Collection Log records, and refresh the reviewed upstream
quest, Combat Achievement, and Chunk Picker sources. It will not introduce a
new roll category or change the core Fate Locked rules.

The implementation must distinguish between:

- a method being listed at the appropriate skill tier;
- the player having the required skill tier;
- the player satisfying the quest and geography requirements needed to use it.

## Goals

- Represent the released Wyrmscraig content across every existing Fate Locked
  surface that consumes quests, bosses, skill methods, Collection Log data,
  Combat Achievements, or chunk content.
- Keep Goat Hunting, Sunstone Mining, Sunstone Golem Crafting, and Mortimer as
  automatically available world content once their real requirements are met.
- Classify The Mad Angel explicitly as a Mid-tier boss in Fate Locked's key
  economy.
- Refresh pinned source data as a single reviewed update rather than layering
  isolated manual fixes over stale generated files.
- Preserve the current product structure and avoid adding a Wyrmscraig-only UI.

## Non-goals

- No new Activity, Minigame, Slayer-master, or training-method roll table.
- No change to skill-tier costs, key rates, geography rules, or save format.
- No automatic live-source ingestion redesign.
- No new 3D model asset. The Mad Angel may use the existing 2D sprite fallback.
- No implementation of unreleased or unverified Mad Angel Combat Achievements.

## Source authority

Use the following source hierarchy:

1. Official Old School RuneScape release and follow-up posts for access rules,
   requirements, rewards, and announced balance changes.
2. The live OSRS Wiki quest, Collection Log, and Combat Achievement datasets
   already used by Fate Locked's sync tooling.
3. The reviewed `source-chunk/chunk-picker-v2` export for chunk-local entities,
   skill yields, shortcuts, drop tables, and task unlocks.
4. Fate Locked's curated registries for product decisions that upstream data
   cannot make, including boss roll membership, key tier, and activity region.

At implementation time, source checks must be rerun before pinning a revision.
Generated outputs must be regenerated from the selected source rather than
edited independently.

## Player-facing rules

### Wyrmscraig access

Wyrmscraig remains part of The Open Seas and requires 62 Sailing to reach. In
modes that track narrower geography, the relevant Wyrmscraig chunk or named
area must also be reachable. Unlocking some unrelated Open Seas location must
not by itself satisfy a Wyrmscraig-specific gate.

### Fallen From Grace

Add Fallen From Grace as a members quest with:

- Experienced difficulty;
- 2 Quest Points;
- 62 Sailing;
- 60 Crafting;
- 47 Runecraft;
- 53 Mining;
- Wyrmscraig/Open Seas location coverage;
- Pandemonium completed.

Completing the quest grants access to the repeatable Mad Angel encounter,
Sunstone Mining, and Sunstone Golem Crafting.

The quest refresh is expected to move the tracked totals to 182 quests and 341
Quest Points. These figures must be verified against the selected live source,
not treated as timeless constants.

### Skill Unlocks view

The current interface calls the skill-method view **Skill Unlocks**. The update
must add the following entries to its Tier 6 cards:

- **Hunter, level 60:** Goat Hunting — Wyrmscraig; requires Sheep Herder.
- **Mining, level 53:** Sunstone Mining — Wyrmscraig; requires Fallen From Grace.
- **Crafting, level 60:** Sunstone Golem Crafting — Wyrmscraig; requires Fallen
  From Grace.

These entries are informational skill unlocks, not random unlock-table entries.
They become usable only when all skill, quest, and geography requirements are
met.

Where the refreshed Chunk Picker source exposes Sunstone rocks and the Sunstone
monolith as Mining nodes, the existing Map Gathering tab should display them at
level 53 and link to their mapped Wyrmscraig locations. The static Skill Unlocks
entry remains required even if the map nodes are generated correctly.

### Goat Hunting

Goat Hunting unlocks automatically when the player has:

- Wyrmscraig access;
- 60 Hunter;
- Sheep Herder completed.

It must not be added to `MINIGAMES_LIST` or any other roll pool. Its method entry
and requirement metadata are enough for this release.

### Sunstone Mining and Golem Crafting

Sunstone Mining unlocks automatically after Fallen From Grace with 53 Mining
and Wyrmscraig access.

Sunstone Golem Crafting unlocks automatically after Fallen From Grace with 60
Crafting and Wyrmscraig access. The quest's Mining requirement already ensures
the player can obtain Sunstone through the intended method.

Neither method is added to a roll pool.

### Mortimer

Mortimer is a Slayer service rather than a Fate Locked roll. His access rule is:

- Wyrmscraig and the required Fallen From Grace progress;
- 70 Slayer and 100 Combat, or 99 Slayer regardless of Combat.

Fate Locked tracks quest completion rather than arbitrary in-quest progress.
The runtime should not invent a new partial-quest state for this update. The
exact official alternative gate should be preserved in descriptive or chunk
requirement text; where a binary completion gate is required, completed Fallen
From Grace is the conservative representation.

## The Mad Angel

Add The Mad Angel as a first-class entry in the existing Bosses system:

- boss roll membership;
- Mid key tier;
- The Open Seas region with Wyrmscraig-specific access;
- Fallen From Grace requirement;
- Collection Log page association;
- Boss Planner/monster API resolution when a matching source entity exists;
- normal wiki link and 2D image fallback behavior.

The explicit Mid classification follows Jagex's description of the repeatable
fight as a mid-level PvM encounter. The existing Mid schedule applies unchanged:
30% for the first Standard Key and 15% for the second.

Adding one Mid boss increases the finite Vanilla boss-key reserve by two. Tests
and player-facing derived totals must update from the shared configuration, not
from duplicated handwritten values.

## Collection Log

Add the new **The Mad Angel** boss page with:

- Granite dust;
- Hallowfell;
- Ardeaglais teleport;
- Aggy;
- Jar of light.

Refresh existing pages so they also include:

- Aggy under All Pets;
- Mr McGroot under All Pets;
- Jeweller's chisel under Miscellaneous.

The exact spelling, apostrophes, and capitalization must follow the selected
source and be normalized consistently with existing Fate Locked identifiers.
The new boss page requires curated static insertion because runtime syncing can
add items to known pages but does not safely create a brand-new product page.

## August follow-up refresh

Refresh the reviewed Chunk Picker source and regenerate all derived chunk
artifacts. The expected change set includes:

- 16 additional or newly barehanded Agility shortcuts;
- corrected Chambers of Xeric unique weights;
- Vampyre snail drop-table support;
- The Mad Angel's clue entry changing from Hard to Medium;
- revised Mad Angel unique and clue rates;
- Mr McGroot's corrected name and rate;
- Jeweller's chisel changing to 1/300;
- upstream task-unlock corrections, including existing Barbarian Training and
  Sailing-era entries.

The generated diff must be reviewed for unexpected losses, count regressions,
or unrelated source churn before it is accepted.

Refresh Combat Achievements from the live source. The currently expected tier
change is **Maggot King Speed Chaser** moving from Master to Grandmaster, giving
expected tier totals of Master 173 and Grandmaster 122 while retaining 646
tasks overall. If the live source differs at implementation time, stop and
reconcile the difference rather than silently updating test constants.

## Architecture and integration points

### Quest data

The quest sync and curated requirement path must update together:

- the approved quest-list source snapshot;
- the quest requirement audit source;
- generated/audited requirement data;
- the runtime quest registry;
- source and baseline tests;
- sync-status documentation.

### Skill methods and requirements

Add the three Skill Unlocks strings at their real levels. Add or extend
requirement metadata only where an existing consumer can use it without making
the methods rollable. Reuse the canonical Wyrmscraig area/chunk identity from
the refreshed source.

### Boss registry and economy

Update the boss list, explicit key-tier registry, activity requirements, region
mapping, and any Boss Planner alias needed by the monster dataset. Existing
consistency tests must continue to prove that every boss has exactly one tier
and no orphan tier entry exists.

### Collection Log

Regenerate additions that the sync pipeline owns, then curate the brand-new
boss page and validate its relationship to the Bosses registry. Do not hand-edit
a generated source file without updating or documenting its authority.

### Chunk content

Pin one reviewed upstream revision and regenerate:

- the source manifest and compressed source;
- transform audit;
- public chunk payload;
- lightweight chunk index;
- any bank or region artifacts legitimately affected by the source revision.

Unexpected bank, region, or named-location changes require inspection rather
than blanket acceptance.

### UI

No new component or navigation route is required. Existing consumers should
surface the update through their data registries:

- Quest Log;
- Skill Progression > Skill Unlocks;
- Skill Progression > Map Gathering for Sunstone nodes;
- Bosses and boss-key farming;
- Boss Planner;
- Collection Log;
- Chunk Info;
- changelog/release notes.

## Error handling and safety

- Source scripts should fail closed when their expected schemas or review pins
  do not match.
- A missing Mad Angel key tier is a test failure, never an implicit fallback.
- Quest/activity requirements must reference canonical quest names.
- A missing monster-model match may use the supported 2D fallback and must not
  block the release.
- A missing new Collection Log page, incorrect page category, or orphan boss
  association blocks the release.
- Existing user saves require no migration because all additions extend
  name-based registries and derived content.

## Verification

### Automated checks

The implementation plan must include focused tests for:

- Fallen From Grace's type, difficulty, points, skills, Pandemonium prerequisite,
  and geography;
- current quest and Quest Point totals;
- all three Skill Unlocks entries at Tier 6;
- Goat Hunting, Sunstone Mining, and Golem Crafting remaining absent from random
  roll pools;
- The Mad Angel's boss membership, Mid tier, requirements, and region;
- the resulting Vanilla boss-key reserve;
- The Mad Angel Collection Log page and the three existing-page additions;
- exact Combat Achievement tier placement and totals;
- refreshed shortcut and drop-table sentinels;
- source pin and generated-artifact consistency;
- no duplicate or orphan registry entries.

Run the complete release gate:

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. source freshness checks relevant to quests, Collection Log, Combat
   Achievements, and chunk content
5. diff and generated-artifact hygiene review

### Visible verification

Use a real complete-state profile or controlled test state and verify that:

- Fallen From Grace appears with the right requirements;
- Hunter Tier 6 lists Goat Hunting;
- Mining Tier 6 lists Sunstone Mining;
- Crafting Tier 6 lists Sunstone Golem Crafting;
- Sunstone map nodes appear at Wyrmscraig when source data provides them;
- The Mad Angel appears as a Mid boss and shows its requirements;
- The Mad Angel Collection Log page shows all five entries;
- Chunk Info reflects the refreshed shortcuts and Wyrmscraig content.

Passing tests or a successful build alone is not sufficient evidence for these
player-facing surfaces.

## Release documentation

Add a changelog entry that groups the work as one Wyrmscraig content update:

- Fallen From Grace and The Mad Angel;
- Goat Hunting, Sunstone Mining, and Golem Crafting in Skill Unlocks;
- the new Collection Log page and pets/items;
- the August shortcut, drop, and Combat Achievement corrections.

Update content-sync status and pinned-source documentation to reflect the
actual reviewed revisions and verification date.

## Delivery boundary

The feature will be implemented on `codex/wyrmscraig-content-update`, created
from `main`. Unrelated branches, untracked documents, and maintainer-owned files
remain outside the change. A detailed implementation plan will be written only
after this specification is reviewed and accepted.
