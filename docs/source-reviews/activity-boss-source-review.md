# Boss access source review — 5 September 2026

This bounded pass changes 17 boss entries. It is not an exhaustive audit of combat equipment, every boss, or every travel route. Source evidence was retrieved through web search from OSRS Wiki pages; direct Wiki page access was blocked by robots.txt. Some indexed extracts are several months old. No claim of live in-game verification is made.

| Entries | Reviewed correction | Evidence |
| --- | --- | --- |
| General Graardor, Commander Zilyana, Kree'arra, K'ril Tsutsaroth | Added chamber skill gates, travel/rope checks, chamber equipment, and essence-or-key alternatives. Essence confirmation explicitly allows Combat Achievement reductions. Zamorak allows a confirmed current Hitpoints boost; Bandos/Saradomin/Armadyl skill gates remain unboostable. | [God Wars Dungeon](https://oldschool.runescape.wiki/w/God_Wars_Dungeon), [Ecumenical key](https://oldschool.runescape.wiki/w/Ecumenical_key) |
| Grotesque Guardians | Permanent rooftop unlock differs from carrying a fresh brittle key. A valid gargoyle or boss assignment and a finishing hammer remain required. | [Strategies](https://oldschool.runescape.wiki/w/Grotesque_Guardians/Strategies), [Boss mechanics](https://oldschool.runescape.wiki/w/Grotesque_Guardians) |
| Araxxor | Explicit araxyte, spider, or Araxxor boss assignment alternatives; existing Slayer and quest checks retained. | [Araxxor](https://oldschool.runescape.wiki/w/Araxxor) |
| Thermonuclear Smoke Devil | Current assignment or the first off-task Western Provinces diary kill; 93 attained Slayer retained. | [Boss](https://oldschool.runescape.wiki/w/Thermonuclear_smoke_devil), [Diary task requirements](https://oldschool.runescape.wiki/w/Achievement_Diary) |
| Skotizo | Dark totem is consumed for entry. | [Catacombs altar](https://oldschool.runescape.wiki/w/Altar_(Catacombs_of_Kourend)) |
| Galvek | During-quest battle or completed-quest replay. | [Jagex update mirrored by Wiki](https://oldschool.runescape.wiki/w/Update:The_Return_of_Galvek) |
| Zulrah | Regicide need only reach Port Tyras; sacrifice permission remains a separate fact. | [Zulrah](https://oldschool.runescape.wiki/w/Zulrah) |
| Mimic | Active Mimic casket; source note corrected to elite/master reward caskets. | [Mimic item](https://oldschool.runescape.wiki/w/Mimic) |
| Obor, Bryophyta | First key permanently unlocks the gate; future fights do not require another key. Bryophyta also requires a growthling finishing tool. Reward chests still consume keys, which is distinct from fight entry. | [Obor gate](https://oldschool.runescape.wiki/w/Gate_(Obor)), [Bryophyta](https://oldschool.runescape.wiki/w/Bryophyta), [Growthling](https://oldschool.runescape.wiki/w/Growthling) |
| Fortis Colosseum, The Hueycoatl | Children of the Sun access quest; no arbitrary combat-level gate. | [Colosseum requirements](https://oldschool.runescape.wiki/w/Money_making_guide/Completing_the_Fortis_Colosseum_(Wave_12)), [Hueycoatl requirements](https://oldschool.runescape.wiki/w/Money_making_guide/Killing_Hueycoatl_(Solo)) |
| The Royal Titans, TzHaar Fight Cave | Existing geography and ownership still apply; recommended combat levels are not hard entry gates. | [Royal Titans strategies](https://oldschool.runescape.wiki/w/Royal_Titans/Strategies), [Fight Cave strategies](https://oldschool.runescape.wiki/w/Fight_caves_guide) |

## Validation

Dedicated regression tests cover permanent unlocks, assignment alternatives, the diary exception, partial quest access, inventory gates, key bypasses that retain skill gates, and entry-level recommendations. Targeted boss/access suite passed; see `work/activity-boss-tests.json` for machine results.

## Remaining uncertainty and scope

- Coral Nursery remains UNKNOWN: this pass did not retrieve sufficient source evidence for the quest and diving-equipment alternatives.
- Nex was outside the assigned edit range. Its existing frozen-key-only metadata still needs the chamber/entrance and essence alternatives reviewed; the God Wars source identifies this gap.
- Existing Abyssal Sire, Hydra, Cerberus, Kraken and newer boss entries were not comprehensively reclassified. Boss-task alternatives and operational equipment can need further work.
- External checks are fresh confirmations, not automatically verified facts. God Wars geography is not modeled as a canonical access area, so legal map access remains an explicit confirmation.
- Access readiness does not establish sufficient combat supplies, player skill, or a complete legal loadout. Strictly operational combat-style restrictions remain a separate coverage gap.

Final integration review: Galvek quest completion also requires confirmation of reachable, legal Pool of Dreams replay access; quest-stage confirmation includes access to the instance.
