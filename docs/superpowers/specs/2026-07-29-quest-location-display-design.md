# Quest Location Display Design

**Date:** 2026-07-29

## Goal

Make Quest Log geography chips accurately distinguish enforced completion
requirements from incomplete Chunk Picker evidence. Exact audited quests must
show only the chunks required to complete them, without duplicate parent-area
or activity-marker chips.

## Problem

Quest cards currently render three geography sources together:

1. `quest.regions`, including legacy parent regions retained on every quest;
2. canonical `quest.locations`, used by exact access policies; and
3. `questLocations(...)`, derived from raw Chunk Picker activity markers.

This makes the same place appear more than once and can present an intermediate
activity marker as though it were a completion requirement. For example,
`A Porcine of Interest` has exact gates for Draynor Village and South Falador
Farm, while its raw evidence also contains Draynor/Falador-derived labels and a
Champions' Guild marker that the audit explicitly says is not a third gate.

## Display Policy

The quest's canonical `accessPolicy` decides which geography is shown as a
requirement:

- `locations`: show only the authored location requirements.
- `regions-and-locations`: show both authored region and location requirements.
- `regions`: show the authored region requirements.

Raw Chunk Picker places are never mixed into the requirement chip group.

For `regions` quests, raw places may still help the player despite being
incomplete. Show them in a separate group labelled **Known steps**. These chips
remain informational map links and do not contribute to eligibility or progress
totals.

Do not show **Known steps** for `locations` or `regions-and-locations` quests:
their authored location list is the reviewed completion geography, and showing
raw activity markers would reintroduce duplicates and non-required stops.

## Deduplication

Canonical location requirements are unique by location ID. Known-step evidence
is unique by its stable `cx,cy` chunk identity; repeated evidence for the same
chunk renders once. The renderer must not rely only on matching display labels,
because source names and authored names may use aliases such as `Falador Farm`
and `South Falador Farm`.

## Progress and Eligibility

This change is presentational only:

- canonical eligibility continues to use `evaluateQuestEligibility`;
- progress totals count only the requirements selected by `accessPolicy`;
- Known steps never satisfy or block a quest;
- skill, combat, prerequisite, alternative, and manual requirements are
  unchanged.

For a `locations` quest, retained legacy regions must not appear in the progress
denominator. For a `regions-and-locations` quest, both region and location
requirements remain in the denominator.

## Implementation Shape

Add a pure Quest Log display helper that receives a quest and its summarised
Chunk Picker places and returns:

- canonical regions to render;
- canonical locations to render; and
- informational known steps to render.

The Quest card consumes this result for geography chips and canonical progress
accounting. Keeping the decision pure makes every access-policy branch directly
testable without rendering the entire application.

## Tests

Regression tests must prove:

1. `A Porcine of Interest` displays only Draynor Village and South Falador Farm
   as canonical geography, with no Misthalin, Asgarnia, duplicate Draynor, or
   extra activity marker.
2. A `regions` quest retains its region requirements and exposes raw places only
   as Known steps.
3. A `regions-and-locations` quest retains both canonical requirement types and
   suppresses raw places.
4. Canonical progress counts follow the same policy-selected requirements.
5. Existing Quest Log, eligibility, content, and release verification remain
   green.

## Non-goals

- Changing quest eligibility or audit conclusions.
- Treating Chunk Picker activity markers as complete requirements.
- Re-auditing quest geography.
- Redesigning unrelated Quest Log chips.
