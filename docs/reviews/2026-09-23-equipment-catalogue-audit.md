# Equipment catalogue audit — 23 September 2026

Scope: local Vanilla preview, equipment import, tier classification, picker display and exported equipment rules. No public deployment, RuneLite release or in-game playthrough is claimed. This extends the [community report fixes](2026-09-23-community-report-fixes.md).

The audit corrected confirmed family inconsistencies and import defects. **It did not individually fact-check every equipment item, and OSRS does not define Fate's nine tiers.** OSRS facts establish materials, equivalent variants, requirements and mechanics; the placement of those facts into Fate's ladder is a project rule.

## Snapshot and counting

The source is the [OSRS Wiki DPS calculator equipment dataset](https://github.com/weirdgloop/osrs-dps-calc/blob/main/cdn/json/equipment.json), fetched on 23 September 2026. The recorded dataset blob is `294c0a5ab539ea503cb22f0fafe1cb4521049724` (a Git blob identifier, not a release commit).

| Measure | Count | Meaning |
| --- | ---: | --- |
| Raw dataset entries | 5,436 | Snapshot entries, including charge, degradation and cosmetic variants. |
| Exact IDs retained in equipment rules | 5,436 | These IDs remain resolvable and appear in the export maps. |
| Combat picker rows | 2,405 | One selected usable variant per slot/name; zero-bonus items are excluded from this picker. |
| Picker rows matching a named/material rule | 1,512 | Includes existing rules; this is not a count of individually Wiki-reviewed items. |
| Picker rows using a stat estimate | 893 | Still inferred, displayed as `Est. T…`. |
| Changed tiers in the audit comparison | 411 | Includes changes caused by corrected imports and recalculated fallback anchors; **not 411 independently confirmed errors**. |

Local evidence: [raw snapshot](../../../audit/equipment-2026-09-23.json), [baseline classification](../../../audit/equipment-tiers-before.json), [updated classification and counts](../../../audit/equipment-tiers-after.json), and [preview build output](../../../audit/equipment-preview-build.log). Counts describe this snapshot, not all equipment that exists in OSRS or future upstream data.

## Import and identity repairs

`services/GearService.ts` now preserves each supported exact item ID instead of using the deduplicated picker as the rules catalogue. This retains charged, uncharged, broken, locked, imbued and poisoned IDs, plus zero-bonus quest equipment. Both `itemRuleExport()` and `tierExport()` use the full ID catalogue; hiding a cosmetic from the combat picker no longer removes its equipment rule.

Picker selection is deterministic: a default or normal variant is preferred over broken/empty variants, and IDs break equal-rank ties. The chosen picker rows also supply tier anchors once per slot/name, so an item with many charge-state IDs does not receive extra influence over the fallback ladder.

The upstream `bonuses.magic_str` field is measured in per-mille. The [upstream damage calculation](https://github.com/weirdgloop/osrs-dps-calc/blob/main/src/lib/PlayerVsNPCCalc.ts#L928-L946) uses `/ 1000`; this app's `GearBonuses.magicStr` and calculations use percentage points. Import therefore divides by **10**, so upstream `150` means **15%**, and `30` means **3%**. The former import overstated magic-damage bonuses and distorted fallback tiers.

The normalized cache advances to `fate_osrs_gear_v3`. Legacy v1/v2 data is converted once and marked for refresh because older caches discarded IDs. If the refresh fails, the usable migrated cache remains available; missing historic IDs can only be recovered after a successful fetch. Validation rejects malformed/empty datasets, and explicit retry remains available.

## Confirmed facts and family consistency

The existing material ladder remains: bronze/iron T1; steel/black/white T2; mithril T3; adamant T4; rune T5; dragon T6. This preserves the Codex rather than treating OSRS equip levels as Fate tier numbers.

| Reviewed issue | OSRS evidence | Result in the current rules |
| --- | --- | --- |
| White Knight equipment was below black | [White equipment](https://oldschool.runescape.wiki/w/White_equipment) has black-equivalent combat stats with a Prayer benefit. | White equipment, including poisoned daggers, joins black at T2. Steel remains T2 under the existing ladder. |
| Heraldic crests changed the apparent material | [Rune equipment](https://oldschool.runescape.wiki/w/Rune_equipment) distinguishes decoration from the underlying armour. A crest named Dragon is not dragon metal. | Steel/adamant/rune heraldic helms and shields remain T2/T4/T5 regardless of crest. |
| God rune armour names omit “rune” | [Rune god armour and gilded equipment](https://oldschool.runescape.wiki/w/Rune_equipment) belong to the rune family; small Prayer/attack differences do not make them God Wars boss armour. | The six gods' full helms, platebodies, legs, skirts and kiteshields use T5. Real Armadyl/Bandos boss armour retains its separate rule. |
| Blessed d'hide pieces split by god/name | [Blessed dragonhide](https://oldschool.runescape.wiki/w/Blessed_dragonhide_armour) shares black d'hide offense, improves defense and adds Prayer. | All six gods' bodies, chaps, bracers, coifs, boots and shields use the black-family T7 placement. |
| Gilded ranged items inherited rune metal T5 | [Gilded dragonhide](https://oldschool.runescape.wiki/w/Dragonhide_armour) has green d'hide offense and higher defense. | Gilded d'hide body/chaps/vambraces follow green progression at T4. Gilded metal armour, axe and pickaxe remain T5. |
| Mystic equivalents had different tiers | [Enchanted robes and robes of darkness](https://oldschool.runescape.wiki/w/Mystic_robes) are statistically identical to their mystic counterparts. | These robes use T4 consistently. |
| God vestments were mistaken for God Wars gear | [Vestment robes](https://oldschool.runescape.wiki/w/Vestment_robes) have the same bonuses across all six gods. | Corresponding pieces share one Fate placement: vestments T3, croziers T4. Those numbers are Fate choices; the cross-god equivalence is the OSRS fact. |
| Jewellery variants fell through name matching | [Trimmed Strength amulet](https://oldschool.runescape.wiki/w/Strength_amulet_%28t%29) is cosmetic; [eternal glory](https://oldschool.runescape.wiki/w/Infinite_glory) shares glory's stats but has unlimited teleport charges. | Strength variants use T3; glory variants T4. |
| Cape combinations fell through name matching | [Max cape combinations](https://oldschool.runescape.wiki/w/Max_cape) inherit the attached cape's stats; the [Masori crafting kit](https://oldschool.runescape.wiki/w/Masori_crafting_kit) is cosmetic. | Infernal/max T9, god/max T8, mythical/max and Ardougne max T6. All assembler cosmetics share the chosen assembler T7 placement. |
| Oathplate cosmetics overrode the base item | [Radiant oathplate](https://oldschool.runescape.wiki/w/Radiant_oathplate_armour) is cosmetic; [Slayer recolours](https://oldschool.runescape.wiki/w/Slayer_helmet) retain their base bonuses, including the [Demonic Pacts overrides](https://oldschool.runescape.wiki/w/Demonic_Pacts_League). | Radiant/base oathplate T8; Slayer helmets T6, imbued T7. Slayer rules take precedence over an armour word in their name. |
| Castle Wars melee pieces scattered across tiers | [Melee decorative sets](https://oldschool.runescape.wiki/w/Free-to-play) have steel, mithril and adamant equivalents. | Red/white/gold melee sets use T2/T3/T4. Separate magic/ranged decorative sets are not included in this match. |
| Justiciar faceguard was isolated from its set | [Justiciar](https://oldschool.runescape.wiki/w/Justiciar_armour) is one Theatre of Blood armour set. | The faceguard now follows the existing Justiciar T9 family. The number is the existing Fate set policy. |
| Cape of skulls differed from Obsidian cape | [Obsidian cape](https://oldschool.runescape.wiki/w/Obsidian_cape) documents equal bonuses for the cape of skulls, with different weight and its skull effect. | Both use T7; this does not imply their side effects are identical. |

Rock-shell helm/plate/legs use the rune-family T5 placement; their defense is rune-like with smaller ranged penalties. Spined helm/body/chaps use the green-family T4 placement. These are reviewed family placements, not claims that every piece has identical stats. Their weak boots/gloves are deliberately excluded. See [melee armour](https://oldschool.runescape.wiki/w/Armour/Melee_armour) and [ranged armour](https://oldschool.runescape.wiki/w/Armour/Ranged_armour).

Spiky dragonhide vambraces retain their colour's T4/T5/T6/T7 placement. Their added melee Strength bonus is real, but does not change the chosen dragonhide family band. [Crafting](https://oldschool.runescape.wiki/w/Crafting#Dragonhides)

## Ammunition: materials versus chosen bands

The [Wiki Fletching table](https://oldschool.runescape.wiki/w/Fletching#Tipped_bolts) establishes the base materials below. Both ordinary and enchanted gem-tipped bolts use that material's Fate band. Gem tips and enchantments improve damage/effects; these are not claims of identical power.

| Bolt tip | Base | Fate tier |
| --- | --- | ---: |
| Opal | Bronze | 1 |
| Jade | Blurite | 1 |
| Pearl | Iron | 1 |
| Topaz | Steel | 2 |
| Sapphire / emerald | Mithril | 3 |
| Ruby / diamond | Adamant | 4 |
| Dragonstone / onyx | Runite | 5 |
| Any supported dragon-bolt gem tip | Dragon | 6 |

Broad bolts have adamant's +100 ranged Strength and use T4; amethyst broad bolts have runite's +115 and use T5. Amethyst broad bolts are made from broad bolts, not literally runite. [Bolts](https://oldschool.runescape.wiki/w/Bolts)

Broad arrows are **not** adamant-equivalent: their +28 lies between mithril's +22 and adamant's +31. The chosen T4 uses the upper neighbouring Fate band. Amethyst arrows, darts and javelins similarly sit between rune and dragon and use the chosen upper band T6. Arrow Strength is 49/55/60, dart Strength 26/28/35, and javelin Strength 124/135/150 for rune/amethyst/dragon respectively. [Broad arrows](https://oldschool.runescape.wiki/w/Broad_arrows), [ammunition](https://oldschool.runescape.wiki/w/Ammunition), [darts](https://oldschool.runescape.wiki/w/Dart), [javelins](https://oldschool.runescape.wiki/w/Javelin)

## Deliberate Fate placements

Raw accuracy/defense does not encode spell power, attack speed, area damage, ammunition recovery or other item mechanics. These explicit rules prevent the generic estimate from being presented as the intended progression. **The sources support the underlying mechanics and progression, not the numerical Fate tiers.**

| Family | Current Fate choices | Source and distinction |
| --- | --- | --- |
| Basic staves | Staff, magic staff and basic elemental staves T1; bare battlestaff T3; elemental/combination battlestaves T4; mystic staves T4 | [Elemental staves](https://oldschool.runescape.wiki/w/Elemental_staves). Basic elemental staves should not split by differing melee bonuses. T3/T4 distinctions are the selected Fate progression. |
| Wands | Beginner T2, apprentice T3, teacher T4, master T6, Kodai T9 | [Wands](https://oldschool.runescape.wiki/w/Wands). Their accuracy, equip requirements and autocast capabilities inform these choices; the Wiki does not specify these Fate bands. |
| Magic weapons with important spell mechanics | Warped sceptre T6; ancient sceptre variants T7; Slayer's staff T5 and enchanted T7; sea/swamp tridents T8 | [Powered staves](https://oldschool.runescape.wiki/w/Powered_staff) and the [magic weapon tables](https://oldschool.runescape.wiki/w/Elemental_staves). Powered spells need more than raw bonus comparisons. Ancient sceptres and Slayer's staves are not being reclassified as powered staves. |
| Chinchompas | Grey T5, red T6, black T7 | [Chinchompas](https://oldschool.runescape.wiki/w/Chinchompa_%28weapon%29) have area damage and special accuracy behaviour. “Black” is not black metal. |
| Salamanders | Swamp lizard T3, orange T4, red T6, black T7, tecu T8 | Their attack modes and ammunition affect damage; [tecu](https://oldschool.runescape.wiki/w/Tecu_salamander) is the strongest salamander. The Fate sequence is explicit policy. |
| Ava's devices and quivers | Attractor T3, accumulator T5, assembler T7; Dizana's quiver family T9 | [Ava's devices](https://oldschool.runescape.wiki/w/Ava%27s_device) have progressively stronger ammunition recovery. Assembler cosmetic parity is factual; the T3/T5/T7 sequence and quiver T9 are Fate placements. |
| Accomplishment capes | Named skill, quest, music, diary and max capes T6 | This implements the existing Codex's accomplishment-cape band; level 99 does not itself translate into Fate T6. |

Narrow matches also keep ordinary coloured capes, unenchanted jewellery, quest props, trophies and other cosmetics from inheriting a combat material or boss tier simply because their name contains “black”, “dragon”, a god name or another equipment word.

## Display consistency

The Equipment Lab inherited obsolete material labels from `utils/combatPower.ts`: these described rune as T6 and steel as T4 despite the actual T5/T2 equipment rules. The labels now use the Codex ladder, with a regression check connecting the displayed material labels to the classifier.

The gear picker also opened inside a transformed, clipped dashboard ancestor. Rendering its overlay through a portal to `document.body` restores the intended full-viewport dialog. Browser inspection confirmed the corrected placement.

## Limits and remaining work

- **893 picker rows still use estimates.** `Est. T…` distinguishes them in the gear picker and equipped-item display. The estimate uses combat-style anchors from named/material items; it does not fully model item effects, spell damage, set effects or use restrictions.
- A named/material match is not proof of a complete individual review. Existing broad family rules remain, and new upstream names can still need narrower handling.
- Gilded coif was not forced into ordinary coif equivalence: it has +4 ranged accuracy versus +2. Dragonstone gauntlets were not forced into Rune gloves equivalence either. These and excluded Rock-shell/Spined minor pieces remain estimates. [Gilded coif](https://oldschool.runescape.wiki/w/Gilded_coif)
- Catalogue retention proves ID coverage of this source snapshot, not normal-world availability, ownership, quest access, ammunition compatibility or permission to acquire every item. Temporary minigame and special-mode entries still need contextual review where exposed.
- This audit does not claim comprehensive DPS correctness, a RuneLite in-game equipment test, a complete content sync, or Chunked readiness.

## Verification and handoff

Recorded for this equipment pass: **109 focused tests passed across eight files**, plus **one Vanilla equipment export/plugin-parity check**, for **110 checks total**. Coverage includes family matching and negative cases, label consistency, import units, exact-ID preservation, deterministic picker selection, cache migration/reload/offline recovery, and exported tier/slot rules. Relevant suites include `utils/gearTiers.test.ts`, `utils/gearTierFamilies.regression.test.ts`, `services/GearService.test.ts`, and the scoped Vanilla parity test.

Final verification after the label correction passed: TypeScript no-emit checking exited 0, and the preview Vite build exited 0 in 10.51 seconds. Existing bundle-size/chunk warnings remain; a successful build is not a claim that those warnings were resolved.

The local Vanilla browser verification confirmed basic staves T1, Justiciar faceguard T9, amethyst broad bolts T5 and amethyst arrows T6. Searching Armadyl body gear showed robe top T3, rune-family platebody T5, blessed d'hide T7 and boss chestplate T8. The gear dialog occupied the viewport correctly and no browser errors were recorded. No public rollout is recorded here.
