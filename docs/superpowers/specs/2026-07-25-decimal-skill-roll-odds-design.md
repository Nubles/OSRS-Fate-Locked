# Decimal Skill-Roll Odds Design

**Date:** 2026-07-25  
**Status:** Approved for planning

## Goal

Make the probability attached to every skill-level roll visible and trustworthy. The displayed rule, the roll engine, the Codex, result history, and tests must all use the same exact `level / 5` probability.

Examples:

- Level 41: `8.2%`
- Level 42: `8.4%`
- Level 99: `19.8%`

This replaces the current whole-percentage `ceil(level / 5)` behavior. It is a real probability change, not display-only rounding.

## Probability Contract

Add one pure shared helper:

```ts
skillLevelKeyChance(level: number): number
```

The helper clamps the supplied level to the valid OSRS range of 1–99 and returns `level / 5`. It is the only source of truth for level-up Key odds.

The level being rolled is the newly gained level. If a skill card currently shows level 41, clicking it records level 42 and rolls at `8.4%`.

The separate level-up Chaos Key chance remains unchanged at 2%.

## RNG Precision

General Key rolls will use a 1–1000 integer draw instead of a 1–100 draw:

```ts
rollUnits = floor(randomFloat * 1000) + 1
thresholdUnits = round(effectivePercent * 10)
success = rollUnits <= thresholdUnits
```

This gives exact one-decimal percentage resolution. A threshold of `8.2%` succeeds on 82 of 1000 outcomes.

Existing whole-percentage sources remain mathematically unchanged: a 15% source still succeeds on exactly 150 of 1000 outcomes. Seeded runs remain deterministic because they continue to derive the draw from the existing seeded random float. Luck continues to use the lower of two draws.

History and result UI store the roll as its percentage-scale value (`rollUnits / 10`) and retain the decimal threshold. Existing history entries need no migration because `rollValue` and `threshold` are already numeric.

## Skill Card UI

For an unlocked skill below level 99, add a compact line beneath the current level:

```text
Next Lv 42 · 8.4% Key
```

The label explicitly says `Next` so a player at level 41 does not mistake the previous level's `8.2%` rate for the upcoming level-42 roll.

For locked skills, no roll odds are shown. At level 99, show no next-roll rate because there is no further level action.

The existing 2% Chaos Key chance stays out of the compact card to avoid visual clutter. The card's accessible title/tooltip explains that every level also receives a separate 2% Chaos Key roll.

The displayed percentage is the level-up base chance. Mode-specific region bonuses remain general roll modifiers and continue to be reflected in the effective threshold recorded by the result/history UI. Luck remains a visible global buff that changes the roll to advantage; it does not change the base percentage label.

## Codex and Supporting UI

Replace wording that implies whole-number rounding or a reachable 20% rate:

```text
Chance = Level ÷ 5 (up to 19.8% at level 99)
```

All supporting UI imports the same helper or constants derived from it. No component independently repeats the formula.

## Result and History Presentation

Level-roll results identify:

- The skill and newly gained level.
- The decimal base chance used for the level roll.
- The effective threshold after any applicable region modifier.
- The random roll at one-decimal precision.

When the base and effective thresholds are identical, the UI shows one percentage rather than duplicating it.

## Boundaries and Compatibility

- Clamp invalid helper inputs to levels 1–99.
- After adding any mode-specific percentage-point bonus, clamp the effective
  Key threshold to 0–100%. The lower bound must not round a valid sub-1% level
  chance up to 1%.
- Do not rewrite or reinterpret previous history entries.
- Do not change fixed Key rates, Fate Points, pity behavior, Omni-Key odds, Chaos-Key odds, or level progression.
- Do not change the Auto-Roll queue: it continues to call the same level-up action once per gained level and automatically receives the new exact rate.

## Tests

Add focused tests for:

1. `skillLevelKeyChance(2) === 0.4`
2. `skillLevelKeyChance(41) === 8.2`
3. `skillLevelKeyChance(99) === 19.8`
4. Invalid levels are clamped to 1–99.
5. A d1000 roll at the decimal threshold succeeds and the next unit fails.
6. Existing integer rates preserve their success boundaries.
7. The skill card at level 41 renders `Next Lv 42 · 8.4% Key`.
8. Locked and maxed skill cards do not advertise a next roll.
9. Codex/economy configuration describes the exact curve and 19.8% maximum.
10. Result history records the newly gained level, decimal base chance, effective threshold, and decimal roll.
11. A mode with region modifiers preserves a sub-1% base chance unless an
    actual percentage-point bonus raises it.

## Acceptance Criteria

- A player can see the upcoming Key chance before recording a level.
- Level 41 rolls at exactly 8.2%, and a card currently at level 41 advertises the upcoming level-42 roll at exactly 8.4%.
- The roll engine can honor one-decimal percentages without approximating or rounding them to whole percentages.
- Existing integer-rate Key sources retain their current probabilities.
- UI copy, roll logs, and the Codex agree with the engine.
- The full test suite and production build pass.
