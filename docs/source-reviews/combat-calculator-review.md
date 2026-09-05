# Combat calculator repair - 2026-09-05

Super combat boosts now use each skill's own base level, independently. Mystic Might adds 2% and Augury 4% to the ordinary equipment magic-damage bonus before flooring the spell maximum.

Sources reviewed:
- https://oldschool.runescape.wiki/w/Super_combat_potion
- https://oldschool.runescape.wiki/w/Magic_damage
- https://oldschool.runescape.wiki/w/Update:Project_Rebalance:_Combat_Changes
- https://github.com/weirdgloop/osrs-dps-calc/blob/main/src/utils.ts (getCombatStylesForCategory)
- https://github.com/weirdgloop/osrs-dps-calc/blob/main/src/enums/EquipmentCategory.ts

Boss planning preserves the upstream equipment category and evaluates only supported attack types and stances for that category. Unarmed never receives a ranged attack; whip never receives stab, crush or aggressive stance. Unreviewed categories, spell-dependent weapons and unavailable equipped-item data show an unmodelled result rather than invented damage. The equipment cache version changes because the previous normalized records discarded category metadata.

Ranged estimates require an explicit session confirmation of compatible ammunition or internal charges and legal use; changing the loadout clears that confirmation. Prayers/potions default off. These estimates retain the stated baseline limitations for item passives, specials, monster mechanics and supplies. They do not establish activity access or observed inventory.

Tests cover unequal Attack/Strength, additive prayer damage, impossible unarmed/whip styles, unknown categories, unconfirmed ranged supplies, retained source metadata and visible absence of fabricated readiness.
