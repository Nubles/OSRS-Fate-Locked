# Monster catalogue source

The DPS calculator and boss planner load a complete, release-pinned snapshot
from the app's own origin. First use no longer requires a browser request to
`raw.githubusercontent.com`.

The source is the [OSRS Wiki DPS calculator monster dataset](https://github.com/weirdgloop/osrs-dps-calc/blob/main/cdn/json/monsters.json).
Facts and images originate from the [Old School RuneScape Wiki](https://oldschool.runescape.wiki/).
The 24 November 2026 capture was taken from the `main` branch on
raw.githubusercontent.com. The GitHub contents API was not reachable from the
capture environment, so the Git blob was computed from the exact bytes
(`git hash-object`, which the source test repeats): its 2,414,798 bytes have
Git blob `5eb1ea8c755d41a4ccfbf284feee30472e416463` and SHA-256
`40b6bae96c49227fcb4ae07cc97fa62d704cdd3b160f61e335b91e8ba0485c34`.
It replaces the 22 September 2026 capture (blob
`c9f6dafdb70c20751d171fbc4f5b5d1701117c47`, 2,860 rows).

`data/monsterCatalogue.ts` records that identity, capture/verification dates,
2,927 raw rows, and the normalization version. The shipped filename contains
the blob identity; the source test verifies both complete byte fingerprints.
The service retains existing name/version deduplication (2,913 picker rows)
and separate light/standard/heavy ranged defences. Max hit is the largest
single hit in the wiki text: markup and hit counts ("17x2", "2 (x3)") are
ignored, and text with no number (N/A, Varies, "? (melee)") is unknown
(null), which the boss planner shows as an unknown danger rather than Low.
That rule is normalization version 3. Version 2 read text with no number as
0, and version 1 took the first number, so markup-first text such as
Tormented Demons read as 0.

Version 4 adds a small reviewed Defence override (`DEFENCE_OVERRIDES` in
`services/MonsterService.ts`) for rows whose upstream Defence is 0 while the
Wiki gives a real one. Only Vardorvis needs it: upstream lists all three of
his fights at Defence 0, and the Wiki gives 215 to 145 (Post-quest), 268 to
181 (Awakened) and 180 to 130 (Quest), falling as his HP drops. The service
uses the start-of-fight value and applies the override only while upstream
still says 0, so a corrected capture wins. A test checks that no planned boss
row is left at Defence 0.

Version 5 carries each row's `flat_armour` as `flatArmour` (0 when absent).
The DPS engine (`utils/dps.ts`) takes it off every successful melee or ranged
hit after the 0-to-1 rule, as the Wiki's Flat armour page describes; negative
values add damage, misses stay 0 and player magic ignores it. The Wiki page
states no floor; like the Wiki DPS calculator, a hit never goes below 0.
This does not certify every statistic or add
encounter mechanics.

## The 24 November 2026 capture

Against the 22 September capture: 86 rows added, 19 removed and 25 changed.
Added: The Fractured Archive (20 October 2026) with Archive Guardian, Ezekiel,
Bork, The Smorks, Moia, Dreadnoth the Jellied, the Dagon'hai, Xarth and
Ocellus (three phases) and their adds; quest versions of Phantom Muspah,
Shellbane gryphon and Brutus; sparring partners, outlaws and other new NPCs.
Most removals are renamed versions (for example Nylocas "Entry mode" became
"Entry Mode", Nechryael "Slayer task" became "Slayer Tower basement", the
quest Strange Creature rows became Phantom Muspah quest versions). Changed:
Nex crush defence 60 to 35 (20 October 2026), Vorkath (Dragon Slayer II)
magic strength 42, Port Roberts guards' stats, Nightmare totem defences -100,
Calvar'ion hellhound sizes, and attack-style and max-hit text on a few rows.
Spot-checked against the Wiki: Nex, Vorkath, Barrelchest, Brawler, Guard
(Port Roberts), both Calvar'ion hellhounds, Shadow Rift, Spawn, Totem (The
Nightmare), Ocellus, Archive Guardian and Xarth.

Known gaps in this capture: Vardorvis is still listed at Defence 0 (see the
override above), and Xarth has 2,600 hitpoints where the Wiki infobox now
gives 2,450 (its HP values were revised on 20 November 2026). Raid bosses'
hitpoints scale with party size, and the catalogue gives one value. The Boss Kill Planner keeps
The Fractured Archive under Encounters, like the other raids, while the DPS
tab can target each of its bosses.

Normalized caches must match the source SHA-256 and normalization version and
contain valid, nonempty targets. Unfingerprinted older caches refresh from the
shipped asset. A matching fixed-source cache remains usable offline without a
time expiry; a changed source or normalization version invalidates it. Empty
or unavailable data leaves the service unready with an explicit Retry path.
Cache quota failures leave successfully loaded targets available in memory.
No profile saves or selected target IDs are rewritten.

To update, capture the complete primary JSON, verify its Git blob via GitHub,
and ship it under the new fingerprinted filename. Update the metadata and
full-source test expectations together; review changed target statistics
before release. Increment normalizationVersion when normalized semantics
change. Do not restore a mutable upstream browser fetch.
