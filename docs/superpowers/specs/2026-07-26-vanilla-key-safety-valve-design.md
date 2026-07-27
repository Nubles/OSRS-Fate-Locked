# Vanilla Key Safety-Valve Balance Design

**Date:** 2026-07-26
**Status:** Approved design
**Scope:** Vanilla mode only

## Summary

Vanilla's repeatable key economy will become a bounded progression safety valve rather than an unlimited boss-farming engine. Bosses will have per-encounter standard-key reserves with diminishing chances, while the first three clue-earned keys receive a shared onboarding boost. Vanilla random boss and minigame unlocks will also respect hard location access requirements so a random key does not award unusable content.

Chunked mode, Fate Point awards, pity thresholds, Altar costs, and non-boss rewards are unchanged.

## Context

A fresh Vanilla run contains 950 paid unlocks after accounting for the free first Hitpoints tier. It starts with three standard keys. The current finite sources average approximately:

- 963.3 standard-key successes;
- 25.4 additional Omni-Keys;
- 46.9 Chaos Keys from level-ups; and
- three starting standard keys.

This is approximately 1,039 expected unlocks before pity keys. That theoretical supply requires nearly complete account progression, including all skill levels, Combat Achievements, diaries, quests, and Collection Log slots. The balance problem is therefore access and pacing rather than insufficient lifetime supply.

Current bosses roll indefinitely at 15%, 30%, 50%, or 65% according to tier. Once an efficient encounter is available, repeatedly farming that encounter is economically preferable to varied progression. The new system bounds this income while preserving bosses as drought relief.

## Goals

- Give Vanilla a bounded reserve of roughly 100–125 standard boss keys.
- Make Brutus a useful but non-abusable early safety valve.
- Reward harder and slower encounters with larger reserves.
- Improve the first few clue keys without making Beginner clues the permanent best strategy.
- Prevent random boss and minigame unlocks from being unusable solely because their hard location is inaccessible.
- Make every rate, remaining reserve, and prerequisite visible to the player.
- Preserve current Fate, pity, Omni, Greed, CA, Collection Log, pet, and loot behavior except where cap accounting is explicitly defined below.

## Non-goals

- Rebalancing Chunked or Custom modes.
- Changing the 50-failure Vanilla pity threshold.
- Weighting Fate Points by task difficulty.
- Changing Altar ritual prices or effects.
- Rebalancing quests, diaries, Combat Achievements, Collection Log, Slayer, activities, pets, or level-up rates.
- Making Vanilla named-area rolls adjacent.
- Automatically bundling a location and its boss or minigame into one unlock.
- Revoking unlocks from existing saves.

## Boss Safety-Valve Economy

### Rate and reserve table

| Encounter class | Chance by standard key already awarded | Standard-key reserve |
|---|---|---:|
| Brutus | 10% | 1 |
| Low boss | 15% | 1 |
| Mid boss | 30%, then 15% | 2 |
| High boss | 50%, then 25% | 2 |
| Raid | 65%, then 32.5%, then 16.25% | 3 |

The existing 66 boss classifications yield 113 standard-key allowances. Brutus adds one, producing a 114-key maximum standard reserve, or 12% of Vanilla's 950 paid unlocks.

The percentages are exact. Fractional percentages must use the shared continuous percentage-roll path rather than rounding to an integer `1–100` threshold.

### Brutus

Brutus is shown as a named Farm Keys encounter in Vanilla and is always eligible there. He remains outside the Boss spend table and therefore does not add another paid boss unlock. His sole 10% standard-key allowance is intended as early drought relief.

Brutus remains available to Combat Achievement and Collection Log systems under their independent rules.

### Cap accounting

Each named boss stores the number of standard keys it has awarded. The next rate and remaining reserve derive from that number.

The following awards consume the named boss's standard-key reserve:

- a normal standard-key success;
- a standard key accompanying an Omni upgrade;
- a pity key caused by a failed boss roll; and
- each standard key paid by Ritual of Greed.

The reducer clamps standard-key payout to the remaining reserve. If Greed would award two keys but only one allowance remains, it awards one and exhausts the boss.

An Omni-Key awarded on a successful boss roll does not consume a second standard-key allowance. Existing behavior in which an Omni success also awards one standard key remains unchanged.

Once the standard-key reserve reaches zero:

- the boss cannot initiate another key roll;
- it cannot generate Fate Points;
- it cannot trigger pity through further kills; and
- its CA, Collection Log, pet, and ordinary loot outcomes remain available and independent.

The cap is enforced in the state transition, not only in the interface, so repeated clicks, stale callbacks, imported state, or automated delivery cannot exceed it.

### Boss roll identity

Every boss roll carries both the exact boss name and its tier/source. The boss name selects and updates its reserve; the tier/source retains rate presentation, statistics, Omni rules, and compatibility with existing reporting.

History entries record:

- boss name;
- tier;
- effective rate;
- standard keys awarded;
- reserve remaining;
- normal, pity, Greed, or Omni outcome; and
- whether the roll exhausted the reserve.

## Shared Clue Onboarding Boost

Vanilla stores the total number of standard keys awarded by clue rolls. The first three standard clue keys use these minimum chances:

| Standard clue keys already awarded | Minimum chance |
|---:|---:|
| 0 | 25% |
| 1 | 15% |
| 2 | 10% |
| 3 or more | No minimum |

The effective chance is:

`max(normal clue-tier rate, current onboarding minimum)`

Consequently, high-tier clues are never weakened. After three standard clue keys, every tier returns to its existing rate.

Normal, pity, and Greed standard keys all advance this counter by the number of standard keys actually awarded. The standard key accompanying an Omni clue success advances it by one; the Omni-Key itself does not. Greed can therefore consume two onboarding stages in one successful roll.

The boost is shared across every clue tier. There is no separate bonus ladder per tier and no permanent reduction below existing clue rates.

## Vanilla Location-aware Random Unlocks

### Eligibility

Vanilla Standard-key and Chaos-key random pools exclude locked bosses and minigames whose hard access location is not currently reachable. This prevents random awards such as Pest Control before Void Knights' Outpost is available.

Location access uses an explicit, curated mapping from each boss or minigame to one or more exact Vanilla named areas. An entry is location-eligible when at least one mapped access area is free or unlocked. Every boss and minigame must have a mapping or an explicit declaration that it has no hard location gate; a consistency test rejects missing declarations.

Only hard geographic access is considered. Skill, combat-level, quest, item, and ordinary OSRS requirements remain the player's responsibility and do not filter the random unlock pool.

### Random versus deliberate unlocks

- Standard-key table rolls honor location eligibility.
- Chaos-key global rolls honor location eligibility.
- Omni-Key direct unlocks may deliberately select location-ineligible content because the player is choosing to reserve permission for later. The interface warns that the activity is not yet reachable.
- Existing saves retain already-unlocked bosses and minigames even when their location is currently inaccessible.
- No location unlock automatically grants its associated boss or minigame, and no activity unlock automatically grants a location.

### Empty pools

When a boss or minigame table has locked entries but none are currently location-eligible:

- no key is spent;
- no random draw occurs; and
- the table explains that a location unlock is required and lists a small sample of blocked activities and their required areas.

## Vanilla Geography Rules

Vanilla named-area rolls remain scattered across the complete locked-area pool. No adjacency filtering is added.

Player-facing rules must say that Vanilla awards a random locked named area from anywhere in its pool. Claims that region unlocks are always adjacent or logically connected are removed from Vanilla text. Adjacency language remains exclusive to Chunked mode.

## State and Migration

Vanilla state adds:

- a record of standard boss keys awarded, keyed by canonical boss name; and
- a single count of standard clue keys awarded.

Missing counters migrate to empty/zero values. Existing histories use tier-only boss sources and cannot reliably reconstruct the named encounter, so existing saves receive the full new reserves rather than an inaccurate inferred balance.

Imported counters are normalized as follows:

- unknown boss names are discarded;
- negative, fractional, non-numeric, or non-finite values become zero;
- values above a boss's reserve are clamped to that reserve; and
- the clue counter is a non-negative whole number, with values above three retained for historical accuracy but treated identically for rate purposes.

The new economy is selected only when the resolved mode ID is `vanilla`. Chunked and Custom retain their existing rates, unlimited boss rolls, random-pool rules, and state behavior.

## Player Experience

Each Vanilla boss row displays:

- exact current chance;
- keys awarded versus reserve;
- the next lower chance when another stage exists; and
- `Key reserve exhausted` when capped.

Brutus is marked as an always-available early encounter.

The clue section displays the current onboarding stage until three standard clue keys have been awarded, then states that normal tier rates apply.

Rate reference and Codex surfaces render these rules from shared economy configuration rather than duplicating literals.

## Codex Coverage

The permanent Vanilla rules are documented in the existing Codex sections rather than adding another top-level tab:

- **Key Economy** explains that bossing is a bounded 114-standard-key safety reserve, not an unlimited completion engine.
- **Drop Rates** renders every boss class's diminishing sequence and standard-key reserve, including Brutus.
- **Drop Rates** also renders the shared clue onboarding minimums of 25%, 15%, and 10%, followed by normal tier rates.
- **Unlocks** explains location-aware Standard and Chaos pools, empty-pool behavior, and the deliberate Omni bypass.
- **Areas** states that Vanilla named-area unlocks are scattered while adjacency is exclusive to Chunked.

These sections read the same typed schedules, caps, onboarding minimums, and location rules used by the engine. Consistency tests fail if a displayed value drifts from gameplay configuration. When the active mode is not Vanilla, Vanilla-only rules are labelled as inapplicable rather than presented as the current run's behavior.

## What's New Release History

The balance release is included in the authored **What's New** data under a **Balance** section. Its player-facing notes summarize:

- bounded, diminishing boss-key reserves;
- Brutus's single early-game key opportunity;
- the shared first-three-clue-key boost;
- location-aware boss and minigame random pools; and
- corrected Vanilla area wording.

What's New is a dated release history rather than a latest-release-only dialog:

- releases are stored newest-first with stable ID, title, date, and optional Added, Changed, Fixed, and Balance sections;
- the latest release is expanded when the dialog opens;
- older releases appear as collapsed, independently expandable dated sections;
- empty content sections are omitted;
- manually opening What's New always exposes the complete authored history;
- automatic opening still occurs only when the latest stable release ID differs from the browser-local last-seen ID;
- dismissing records only the latest release ID as seen;
- expanding an older release does not change seen state; and
- adding or correcting older history without changing the latest release ID does not trigger automatic reopening.

Release expansion state is local to the open dialog and is not added to profile or save serialization. Release headers are buttons with `aria-expanded` and `aria-controls`, and expanded content remains keyboard navigable.

This history model supersedes the latest-release-only presentation in the 2026-07-23 tracker-fixes changelog design wherever the two documents conflict.

## Failure and Concurrency Handling

- The reducer recomputes remaining reserve at award time.
- A roll begun before another award exhausts the same boss cannot exceed the reserve.
- A capped or location-ineligible roll request is rejected without consuming buffs, keys, Fate, or RNG progression.
- A rejected imported event records no gameplay history entry.
- Seeded runs include the boss name and rate stage in the draw purpose so a rate-stage transition is deterministic and auditable.

## Testing

### Economy configuration

- Every boss has a valid tier and derived Vanilla schedule.
- Brutus has exactly one 10% allowance and is absent from the Boss spend table.
- Existing tier counts produce exactly 113 allowances; Brutus raises the total to 114.
- Fractional raid rates are preserved exactly.

### Boss state transitions

- Each boss begins at its first rate.
- Normal success advances one allowance.
- Failure awards Fate and leaves the allowance unchanged.
- Pity awards one key and consumes one allowance.
- Greed awards two and consumes two when available.
- Greed awards only one when one allowance remains.
- Omni awards one standard key plus one Omni-Key and consumes one allowance.
- Capped bosses reject further rolls and award neither keys nor Fate.
- CA, Collection Log, and pet paths remain usable after the key cap.
- Simulated duplicate/stale awards cannot exceed a cap.

### Clues

- The effective minimum follows 25%, 15%, 10%, then the normal rate.
- Higher normal rates override the onboarding minimum.
- Standard, pity, Greed, and Omni-associated standard keys advance the count correctly.
- The boost is shared between clue tiers.
- No clue rate is reduced below its existing base.

### Location eligibility

- Pest Control is excluded before Void Knights' Outpost is reachable and included afterwards.
- Standard and Chaos pools use the same location rule.
- Omni direct selection remains possible with an unreachable warning.
- Existing inaccessible unlocks are retained.
- Empty pools do not spend a key or advance RNG.
- Every boss and minigame has a hard-location mapping or explicit no-gate declaration.

### Modes and migration

- Missing counters migrate safely.
- Invalid imported counters normalize and clamp.
- Vanilla enables the new economy.
- Chunked and Custom behavior is unchanged.

### Codex and What's New

- Codex values are sourced from the same Vanilla schedules used by gameplay.
- Vanilla-only Codex copy is not presented as active rules in other modes.
- The balance release contains the approved Balance notes.
- Releases render newest-first with the latest expanded initially.
- Older releases expand and collapse independently with accessible state.
- Empty Added, Changed, Fixed, or Balance sections are omitted.
- Manual opening displays the full release history.
- Auto-open and last-seen state depend only on the latest stable release ID.
- Adding older history without changing the latest ID does not auto-open the dialog.

## Acceptance Criteria

- Vanilla offers no more than 114 standard keys through named boss reserves. Greed is clamped within that total; separately awarded Omni-Keys do not count against it.
- No named boss can produce standard keys or Fate after exhausting its reserve.
- The first three standard clue keys receive the approved shared minimum chances, and later clues use existing rates.
- A Vanilla random roll cannot award a geographically inaccessible boss or minigame.
- Vanilla rules no longer claim that named-area unlocks are adjacent.
- The Codex documents every permanent balance rule from shared gameplay configuration.
- What's New includes the balance release and provides expandable, dated access to all authored releases.
- Existing saves load without losing unlocks or currency.
- Chunked and Custom behavior remain unchanged.
