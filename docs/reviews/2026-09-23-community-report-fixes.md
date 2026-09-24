# Community report fixes — 23 September 2026

Scope: local Vanilla preview only. No public deployment or player unlock/completion changes.

## Report decisions

- **White equipment:** confirmed website classification defect. White Knight weapons and armour, including poisoned daggers, now share Fate Tier 2 with black metal gear. White cosmetics are not treated as White Knight equipment. Steel stays Tier 2 under the existing Fate Codex; OSRS Attack requirements are a separate scale. The cached gear catalogue is reclassified by the shared function and both RuneLite export maps contain the corrected tiers.
- **Draynor diary lap:** missing Agility gate. Current Draynor rooftops require level 1, so the Easy task now requires an Agility unlock even when a recorded level is present.
- **Thessalia:** browsing requires Clothes Shops. Added typed merchant requirements throughout diary eligibility, completion, counts, planning and UI. Also corrected five equivalent omissions: Sarah, Stonemason, Warrens General Store, Catherby candles and Seers' pub stew. Warrens uses the canonical Piscarilius area rather than Kourend Castle. Source data and generator are synchronized.
- **Sheep Shearer:** spinning needs Crafting, but the quest permits pre-obtained balls of wool. Locked Crafting no longer produces an unconditional doable verdict: the player must unlock the spinning method or confirm 20 unnoted balls from a permitted source. The recipe, actual guide action and resource planner all gate spinning at Crafting 1. Replaced the unsupported Wyson/Crafting Guild purchase entry with Aemad's Adventuring Supplies, requiring General Stores and East Ardougne.
- **Priest in Peril:** not a Neck-slot defect. The reviewed quest has no required ghostspeak amulet or Prayer action; Drezel blesses the water. Prayer XP is a reward, not a skill prerequisite. The existing Restless Ghost Neck T1 gate remains intact. No new rule about quest reward XP was invented.

## Guide behaviour

The guide has a separate owned-supplies confirmation for reviewed player-obtained outputs. This can skip preparation even if its method is locked. It clears only the corresponding item-source blocker, retaining equipment, skill and location requirements for later actions. Hand-in and quest-completion actions remain separate. Undo restores the preparation checks and no guide confirmation awards Journal rewards.

Sheep's public guide revision advanced to v2 and its older reviewed definition was regenerated with the same skill gate. Other guide revisions and existing progress remain unchanged. Regeneration exposed two stale compiler assumptions from the 24-quest expansion; it now accepts the exact Tutorial main-page title and preserves Daddy's Home as a legacy source outside F2P membership.

## Sources

- [OSRS melee armour](https://oldschool.runescape.wiki/w/Armour/Melee_armour) and [weapon requirements](https://oldschool.runescape.wiki/w/Attack/Weapons_table).
- [Rooftop courses](https://oldschool.runescape.wiki/w/Rooftop_Agility_Courses), [Varrock Diary](https://oldschool.runescape.wiki/w/Varrock_Diary), [Warrens General Store](https://oldschool.runescape.wiki/w/Warrens_General_Store), [Kandarin Diary](https://oldschool.runescape.wiki/w/Kandarin_Diary), [Fremennik Diary](https://oldschool.runescape.wiki/w/Fremennik_Diary), [Sarah](https://oldschool.runescape.wiki/w/Sarah).
- [Sheep Shearer revision 15271780](https://oldschool.runescape.wiki/w/Sheep_Shearer?oldid=15271780), [Crafting level table](https://oldschool.runescape.wiki/w/Crafting/Level_up_table), [East Ardougne](https://oldschool.runescape.wiki/w/East_Ardougne).
- [Priest in Peril revision 15317644](https://oldschool.runescape.wiki/w/Priest_in_Peril?oldid=15317644).
- [Plugin warning implementation](https://github.com/Nubles/OSRS-Fate-Locked-Runelite/blob/main/src/main/java/com/fatelocked/FateLockedPlugin.java#L952). The plugin reads exported tiers; missing warnings alone cannot establish a different steel tier. The reporter's settings/bundle were unavailable, so their particular warning suppression remains undiagnosed.

## Verification

Confirmed failures were reproduced before fixes. Focused Vanilla and pure-data tests cover tier classification/export, diary prerequisites and completion guards, conditional quest preparation, resource alternatives, actual guide action blocking, owned-item confirmation and downstream hand-in. TypeScript, preview build and generator checks are recorded in the sibling audit directory. Browser verification uses the existing Vanilla Preview profile on port 51945; no in-game playthrough or Chunked validation is claimed.

Final verification: 162 focused checks passed across 12 Vanilla/data suites; 2 public/preview bundle checks passed. Separate focused checks covered the Quest Journal rendering (8), compiler compatibility (15), and RuneLite equipment export. Typecheck, preview build, diary source verification, walkthrough source verification and scoped whitespace checks passed. Existing build-size/dependency-tool warnings remain.

Browser: white/black/steel daggers each displayed T2; Thessalia displayed Clothes Shops; Draynor lap displayed Agility1; Sheep Journal card displayed Needs confirmation rather than Ready. The guide showed the Crafting card and blocked spinning; owned wool advanced 0/5 to 3/5 with hand-in available, and Undo returned 0/5. Journal remained 0/212 and no browser warnings/errors were recorded. The preview remains open on Sheep Shearer at http://127.0.0.1:51945/.
