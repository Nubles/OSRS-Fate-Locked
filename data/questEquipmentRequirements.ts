import type { RequirementPredicate } from '../utils/requirementPredicates';

/** Necessary slot gates, not a claim that the entire quest action contract is reviewed.
 * Source: Quest Helper 633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a.
 * Keep explicit alternates in a complete ANY route; never infer gates from carrying items.
 */
export const QUEST_EQUIPMENT_REQUIREMENTS: Readonly<Record<string, RequirementPredicate[]>> = {
  // BlackKnightFortress.java:178-182 declares both disguise pieces equipped.
  "Black Knights' Fortress": [
    { kind: 'equipment', slot: 'Head', tier: 1, label: 'Head slot T1: wear the bronze med helm disguise' },
    { kind: 'equipment', slot: 'Body', tier: 1, label: 'Body slot T1: wear the iron chainbody disguise' },
  ],
  // LostCity.java:126,174 explicitly requires the equipped dramen staff.
  // Minimum slot permission; unresolved combat and item-specific checks remain separate.
  'Lost City': [
    { kind: 'equipment', slot: 'Weapon', tier: 1, label: 'Weapon slot T1 or higher: wield the dramen staff' },
  ],
  // ATailOfTwoCats.java:126-129,189,198,232; mandatory worn item, not an optional reward.
  "A Tail of Two Cats": [
    { kind: 'equipment', slot: 'Neck', tier: 1, label: "Necklace slot unlocked: wear catspeak amulet (e) (item tier still subject to review)" },
  ],
  // DragonSlayerII.java:419,773; mandatory worn item, not an optional reward.
  "Dragon Slayer II": [
    { kind: 'equipment', slot: 'Neck', tier: 1, label: "Necklace slot unlocked: wear catspeak amulet (e) (item tier still subject to review)" },
  ],
  // MonkeyMadnessI.java:295,324,725,868-869; mandatory worn item, not an optional reward.
  "Monkey Madness I": [
    { kind: 'equipment', slot: 'Neck', tier: 1, label: "Necklace slot unlocked: wear monkeyspeak amulet and 10th squad sigil (item tier still subject to review)" },
  ],
  // MonkeyMadnessII.java:264,470,520,549; mandatory worn item, not an optional reward.
  "Monkey Madness II": [
    { kind: 'equipment', slot: 'Neck', tier: 1, label: "Necklace slot unlocked: wear monkeyspeak amulet (item tier still subject to review)" },
  ],
  // RFDAwowogei.java:128,211-216; mandatory worn item, not an optional reward.
  "RFD: King Awowogei": [
    { kind: 'equipment', slot: 'Neck', tier: 1, label: "Necklace slot unlocked: wear monkeyspeak amulet (item tier still subject to review)" },
  ],
  // WaterfallQuest.java:173,281-282; mandatory worn item, not an optional reward.
  "Waterfall Quest": [
    { kind: 'equipment', slot: 'Neck', tier: 1, label: "Necklace slot unlocked: wear Glarial amulet (item tier still subject to review)" },
  ],
  // TempleOfIkov.java:177,289; mandatory worn item, not an optional reward.
  "Temple of Ikov": [
    { kind: 'equipment', slot: 'Neck', tier: 1, label: "Necklace slot unlocked: wear pendant of Lucien (item tier still subject to review)" },
  ],
  // LunarDiplomacy.java:431-439,749,755: all nine pieces worn for dream entry.
  'Lunar Diplomacy': [
    ...(['Head', 'Body', 'Legs', 'Boots', 'Gloves', 'Cape', 'Neck', 'Ring', 'Weapon'] as const).map(slot => ({
      kind: 'equipment' as const, slot, tier: 1, label: `${slot} slot unlocked: wear the required lunar equipment (item tier still subject to review)`,
    })),
  ],
};
