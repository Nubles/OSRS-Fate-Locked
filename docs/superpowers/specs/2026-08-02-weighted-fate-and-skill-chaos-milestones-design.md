# Weighted Fate and Skill Chaos Milestones Design

**Date:** 2026-08-02

## Goal

Rebalance Fate Point income so failed rolls from harder activities award more
Fate, while preserving the rule that successful rolls reset Fate. Add guaranteed
Chaos Keys at defined skill levels without removing the existing independent 2%
Chaos Key chance.

## Scope

This change covers:

- failure-Fate awards for every activity in the supplied balance table;
- pity-threshold calculation and overflow;
- skill-level Fate bands;
- guaranteed skill-level Chaos Key milestones;
- history and analytics metadata;
- the in-app economy reference and player-facing changelog; and
- focused automated tests.

Key drop rates, Omni-Key odds, ritual costs, game-mode thresholds, success Fate
resets, Xtreme/Chunked anti-softlock keys, and other economy rules are outside
this change.

## Failure-Fate Schedule

Fate is awarded only when a roll fails. A roll that succeeds, including a
guaranteed 100% roll, cannot award failure Fate.

| Activity | +1 Fate | +2 Fate | +3 Fate |
| --- | --- | --- | --- |
| Skill level | Levels 2-19 | Levels 20-79 | Levels 80-99 |
| Quest | Novice, Intermediate | Experienced | Master |
| Diary | Easy, Medium | Hard | Elite |
| Combat Achievement | Easy, Medium | Hard, Elite | Master, Grandmaster |
| Clue | Beginner, Easy, Medium | Hard, Elite | Master |
| Slayer | Turael/Spria through Chaeldar | Konar through Duradel/Kuradal | Boss task |
| Bossing | Low boss | Mid or high boss | Raid |
| Other | Collection Log, minigame | - | - |

Grandmaster quests and pet drops are guaranteed successes under the current
rules, so they do not produce failure Fate and are omitted from the reward
schedule.

## Pity Threshold and Overflow

The resolved failure-Fate award participates in the pity check. If adding that
award reaches or crosses the active mode's pity threshold, the failure becomes a
Pity Key award.

One threshold is consumed and any excess Fate remains on the new bar. For
example, at a threshold of 50, a player with 49 Fate who receives a +3 failure
gets one Pity Key and finishes with 2 Fate.

The configured minimum custom threshold is 10 and the maximum failure award is
3, so one roll cannot cross more than one pity threshold. Ordinary successful
rolls continue to reset Fate to zero.

Ritual of Greed behavior remains unchanged. Its refund is not part of the base
failure-Fate schedule, and a roll converted into a Pity Key is a success rather
than a Greed-refund failure.

## Skill Chaos Keys

Reaching skill levels 30, 40, 50, 60, 70, 80, 90, and 99 grants one guaranteed
Chaos Key.

The existing independent 2% Chaos Key roll remains active on every level. At a
guaranteed milestone, a successful 2% roll therefore produces two Chaos Keys in
total. Both rewards must be represented accurately in the level-up event and
player feedback.

## Architecture and Data Flow

The economy configuration will be the source of truth for failure-Fate values.
A pure resolver will map fixed `DropSource` values to +1, +2, or +3 and calculate
the skill value from the attained level band.

Roll preparation will resolve the numeric failure-Fate award before evaluating
pity and will place that value on the prepared roll result. The reducer will use
the same prepared value to update Fate and write `fatePointsEarned` history
metadata. This prevents the pity calculation, persisted history, and analytics
from disagreeing.

Manual UI rolls and RuneLite-detected events will use the same resolver. Dynamic
display labels such as a Collection Log item name or `Attack Level 42` will not
be treated as the authoritative balance key; their callers will supply enough
structured context to resolve the reward safely.

The level-up transition will test the attained level against a shared guaranteed
milestone set. It will then add the guaranteed award and the existing random
award independently, allowing a total of zero, one, or two Chaos Keys depending
on the level and random result.

## Player-Facing Updates

The in-app economy reference will describe the three failure-Fate bands and the
guaranteed Chaos milestones. Copy that currently says every failure awards one
Fate or that Chaos Keys only come from the 2% level roll will be corrected where
it describes the economy rule.

A player-facing changelog entry will announce the weighted Fate schedule, pity
overflow, and guaranteed Chaos milestones.

## Compatibility

No save-schema migration is required. Fate and Chaos Key balances remain numeric
counters, while new history entries will continue using the existing extensible
metadata object. Historical entries that lack an exact `fatePointsEarned` value
retain the analytics fallback of one Fate for a failed or pity roll.

The deterministic run transition remains reproducible because the guaranteed
milestone award uses no new random draw, and the existing 2% draw remains in its
current level-up RNG position.

## Testing

Focused tests will verify:

- every fixed activity maps to the correct +1, +2, or +3 reward;
- skill levels 2-19, 20-79, and 80-99 resolve to the correct Fate value at their
  boundaries;
- a weighted failure records and adds the exact Fate amount;
- crossing the pity threshold awards one Key and retains overflow Fate;
- a normal success still resets Fate to zero;
- guaranteed 100% sources do not award failure Fate;
- only levels 30, 40, 50, 60, 70, 80, 90, and 99 guarantee a Chaos Key;
- milestone and 2% random rewards stack to two Chaos Keys;
- non-milestone levels retain only the 2% chance; and
- the in-app economy content stays consistent with the engine configuration.

Relevant reducer, economy-consistency, detected-event, history/analytics, and UI
copy tests will be run alongside type checking and the production build.
