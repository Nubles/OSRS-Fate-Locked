# Diary permission audit — 24 September 2026

Scope: local Vanilla preview. All 492 authoritative diary descriptions, pinned source requirements and existing alternative routes were screened for mandatory worn equipment and explicit travel. This pass changes 90 unique task rows: 51 now have equipment requirements, 27 Mobility requirements and 17 Arcana requirements, with overlap. Two additional purchase actions now require their existing shop category. The exact changed IDs are recorded in `permissionAudit.changedTaskIds` in the authoritative source JSON.

This is a permission audit, not a claim that every diary item, minigame or future OSRS change has been fully verified. The original Wiki revision metadata is preserved; targeted current Wiki evidence supplements those pinned pages. The source file, generator and generated output remain synchronized, with all 492 canonical rows and historical task IDs preserved.

## Behaviour

- Equipment, Mobility and Arcana are enforced by the shared task evaluator and completion guard. A manual completion attestation cannot bypass a known locked slot, tier, transport network or spellbook.
- The Diary Journal, available counts/filter, skill advisor, unlock-impact simulations, Journal summary, goal planner and goal route use canonical eligibility. The planner identifies the Equipment, Mobility, Arcana or Merchants table that can resolve a missing permission.
- A quest completion or accessible destination does not substitute for its separate Fate travel or Arcana unlock.
- Required named gear whose Fate tier is still estimated gets only the proven minimum slot requirement, T1, plus confirmation that the player has a permitted item. An estimated Granite body tier, for example, does not become a hard Body T8 diary gate. These tasks remain **Needs confirmation**, not automatically available.
- Reviewed named/material tiers remain exact: Initiate T3, Proselyte T5, Barrows/Void T7, crystal bows T8, god staves T6, Mithril grapple T3 and the existing cape policies. These are Fate rules, not an OSRS level-to-tier claim.

## Important alternatives and exclusions

- Fairy Ring actions require the network and a permitted wielded dramen/lunar staff. Completed Lumbridge Elite waives the staff requirement, not the network unlock.
- Dragontooth Isle accepts a worn ghostspeak amulet (Neck T1), or player-owned Morytania legs 2 or better with Legs permission and item confirmation. Diary completion alone does not waive the worn equipment requirement.
- Bare-handed butterfly/impling methods remain alternatives to a wielded net. The Lumbridge essence-impling alternative requires Hunter 52, rather than the net route's 42.
- Iban staff upgrading can satisfy the Ardougne task without wielding the staff. Its upgrade fee and owned staff remain an explicit confirmation route.
- Raiments reductions require the corresponding number of wearable outfit pieces; all slot combinations are retained. Higher Runecraft routes without the outfit remain available.
- Cooking Guild alternatives require the actual worn chef's hat, cooking cape or Varrock armour. Having completed the Varrock diary alone is insufficient.
- Cormorant and falconry gloves use the Weapon slot. Pickaxes, axes, teasing sticks, salamander traps and other inventory-only tools do not acquire invented equipment locks.
- Volcanic sulphur requires worn breathing protection. Cave-horror protection is not turned into an unconditional Neck lock because alternative combat methods exist.
- Purchasing Barrows gloves requires Cooking Shops; purchasing the white 2h sword from Sir Vyvin requires Platebody Shops. Buying an item does not require permission to wear it, and already-owned gear does not require its acquisition shop.
- Explicit Ancient/Lunar/Arceuus spellbook use, God Spells, Piety and Bones to Peaches use their existing Arcana names. Normal spellbook spells, astral-rune crafting and cannonball smithing receive no invented Arcana requirement.

## Evidence

The per-task `sourceRequirements` and pinned supporting pages in the source JSON provide the baseline. Targeted primary sources used for exceptions and corrections include:

- [Wilderness Diary](https://oldschool.runescape.wiki/w/Wilderness_Diary): wearing a team cape, god spells and required god staff.
- [Ardougne Diary](https://oldschool.runescape.wiki/w/Ardougne_Diary) and [Lumbridge & Draynor Diary](https://oldschool.runescape.wiki/w/Lumbridge_%26_Draynor_Diary): fairy-ring travel and the Elite staff exemption.
- [Morytania Diary](https://oldschool.runescape.wiki/w/Morytania_Diary), [Dragontooth clue requirements](https://oldschool.runescape.wiki/w/Clue_scroll_(elite)_-_12.31N_43.11E) and [Morytania legs 3](https://oldschool.runescape.wiki/w/Morytania_legs_3): ghostspeak alternatives and the legs' worn requirement.
- [Essence impling](https://oldschool.runescape.wiki/w/Essence_impling), [Impling](https://oldschool.runescape.wiki/w/Impling), [Hunter](https://oldschool.runescape.wiki/w/Hunter) and [Teasing stick](https://oldschool.runescape.wiki/w/Teasing_stick): net/barehanded alternatives and inventory-only tools.
- [Fletching cape](https://oldschool.runescape.wiki/w/Fletching_cape): crossbow and grapple equipment for shortcuts.
- [Raiments of the Eye](https://oldschool.runescape.wiki/w/Raiments_of_the_Eye): worn pieces and rune production bonuses.
- [Head chef transcript](https://oldschool.runescape.wiki/w/Transcript:Head_chef) and [Diary rewards](https://oldschool.runescape.wiki/w/Achievement_Diary/Rewards): Cooking Guild worn-item alternatives.
- [Falconry](https://oldschool.runescape.wiki/w/Falconry), [Falconer's glove equipment image](https://oldschool.runescape.wiki/w/File:Falconer%27s_glove.png), [Aerial fishing](https://oldschool.runescape.wiki/w/Aerial_fishing) and [Alry transcript](https://oldschool.runescape.wiki/w/Transcript:Alry_the_Angler): mandatory gloves and their use.
- [Volcanic sulphur rock](https://oldschool.runescape.wiki/w/Volcanic_sulphur_%28rock%29): mining is blocked without worn breathing protection.
- [Barrows gloves](https://oldschool.runescape.wiki/w/Barrows_gloves), [Culinaromancer's Chest](https://oldschool.runescape.wiki/w/Chest_(Culinaromancer%27s)) and [White Knight Armoury](https://oldschool.runescape.wiki/w/White_Knight_Armoury): purchase locations. Shop-category mapping is the existing Fate classifier.

The 17 explicit Arcana task IDs are `ard_elite_8`, `des_elite_2`, `des_hard_3`, `des_hard_7`, `frem_hard_8`, `kan_elite_7`, `kan_hard_4`, `kou_elite_6`, `kou_hard_10`, `kou_med_6`, `lum_hard_1`, `mor_elite_3`, `mor_hard_8`, `var_elite_2`, `var_hard_4`, `wild_elite_2` and `wild_hard_1`. Their task descriptions/source requirements explicitly identify the relevant spell, spellbook, prayer or spellbook-dependent tablet.

## Validation

- 205 tests passed across the focused equipment/Mobility/Arcana, generator, diary UI, planner, route and Journal summary suites.
- 31 selected existing Vanilla diary eligibility tests passed; 26 unrelated cases were not run.
- 11 Vanilla skill-advisor tests passed; the one Chunked case was deliberately skipped.
- Eight original community diary regression tests passed.
- TypeScript no-emit check passed after the Arcana integration.
- `diary:verify` passed: generated files current, 492 official rows, zero unknown references, unresolved IDs or duplicate IDs; 471 historical IDs preserved, 14 retired and 21 new canonical IDs remain unchanged.

No Chunked testing, public deployment or changes to player progress were performed in this lane. Root task owns final preview build and browser verification.
