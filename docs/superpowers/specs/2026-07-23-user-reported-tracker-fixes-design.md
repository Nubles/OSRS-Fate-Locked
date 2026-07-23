# User-Reported Tracker Fixes Design

**Date:** 2026-07-23

## Objective

Resolve the concrete tracker defects reported in GitHub issues while preserving existing saves and keeping subjective balance changes out of scope.

## Scope

This change will:

- Rename the user-facing **Arcana** unlock table to **Combat Powers**.
- Remove Tormented Demons as a source of Dragon Claws.
- Make **A Porcine of Interest** require access to the Falador Farm location as represented by the authored Port Sarim area.
- Make **Enter the Abyss** require a third Rune Essence Mine teleport provider beyond the two always available in Misthalin.
- Make quest and diary eligibility respect the player's unlocked skill-method cap as well as their recorded level.
- Consolidate quest eligibility so the journal, advisors, planners, reveal hooks, and activity panels use the same rules.
- Add focused regression coverage for each corrected behavior.

This change will not:

- Modify the RuneLite plugin or attempt to fix Plugin Hub discovery or re-enabling behavior.
- Rebalance Fate Point rewards, key probabilities, diminishing returns, or unlock adjacency.
- Change the internal `ARCANA` table identifier or stored `unlocks.arcana` field.
- Introduce a general-purpose rules language for every possible future requirement.

## Design

### Combat Powers naming

The table's persistent identity remains `TableType.ARCANA`, and saved unlocks continue to use `unlocks.arcana`. Only user-facing labels, descriptions, search text, and documentation change to **Combat Powers**. Its description will explain that it contains spellbooks, prayers, and special combat systems. This keeps every existing profile compatible while making Dwarf Cannon understandable within the category.

### Dragon Claws source correction

The manually curated `RESOURCE_MAP['Dragon Claws']` entry currently includes both Chambers of Xeric and Tormented Demon. The Tormented Demon source will be removed. The wiki-generated enrichment already supplies the correct Ancient Chest source, so Dragon Claws will remain obtainable through Chambers of Xeric without duplicate or RS3-derived data.

A consistency test will assert that Dragon Claws have a Chambers of Xeric/Ancient Chest source and no Tormented Demon source.

### Quest location requirements

`QuestData.regions` remains the list of areas that are all required. A new optional `oneOf` field will express alternative access routes without quest-name-specific conditionals:

```ts
interface QuestRequirementOption {
  regions?: string[];
  guilds?: string[];
}

interface QuestData {
  // existing fields
  oneOf?: QuestRequirementOption[];
}
```

A quest with `oneOf` is available only when at least one option is fully satisfied. Region checks use the existing mode-aware `isAreaReachable`; guild checks use `unlocks.guilds`.

The two affected quests will be represented as follows:

- **A Porcine of Interest:** required regions `Misthalin` and `Port Sarim`. Port Sarim is the authored map area containing Falador Farm.
- **Enter the Abyss:** required region `Misthalin`, prerequisite `Rune Mysteries`, and one satisfied option among East Ardougne, Tree Gnome Stronghold, or Wizards' Guild.

Unsatisfied alternatives report the existing `LOCKED_REGION` status. No new UI status is introduced.

### Skill-method eligibility

Recorded RuneLite levels do not determine which methods the challenge rules permit. A shared helper will require all three conditions:

1. The skill has at least one unlocked tier.
2. The recorded level meets the task requirement.
3. The unlocked method cap (`tier * 10`, capped at 99) meets the task requirement.

The helper will be used by quest eligibility and diary-task doability. For example, a player with Woodcutting level 15 but only tier 1 remains unable to perform a level-15 diary method because their permitted cap is 10.

### Shared quest eligibility

`utils/journalStatus.ts` becomes the canonical quest-status implementation. The duplicate calculation inside `components/QuestLog.tsx` will delegate to it while retaining the component's chunk-location refinement. All existing consumers of `getQuestStatus` will automatically receive `oneOf` and skill-cap behavior.

The change will remain focused: diary-tier display semantics will not be redesigned. `countDoableTasks` will receive the corrected skill-cap check, which controls the actionable task counts and recommendations reported by users.

## Error Handling and Compatibility

- Missing `oneOf` means no alternative requirement, preserving every existing quest record.
- Empty `oneOf` is treated like no alternative requirement rather than making a quest impossible.
- Missing skill tier or level data uses the existing locked/default behavior.
- The internal Arcana enum and save field remain unchanged, so no migration is required.
- Alternative requirements use existing unlock arrays and reachability functions; no new persisted state is introduced.

## Testing

Implementation will follow test-first development. Regression tests will cover:

- Dragon Claws do not list Tormented Demon and retain a valid Chambers of Xeric source.
- Combat Powers is the displayed label while `TableType.ARCANA` and `unlocks.arcana` remain unchanged.
- A Porcine of Interest is region-locked without Port Sarim and available when all other requirements plus Port Sarim are met.
- Enter the Abyss is locked with only Misthalin and becomes available through each supported alternative independently.
- Enter the Abyss remains locked when none of its alternatives is available.
- A diary task requiring level 15 is not doable with tier 1 even when the recorded level is 15 or higher.
- The same task becomes doable after the skill tier permits level 15 and the recorded level also meets the requirement.
- Existing quest, diary, data-consistency, TypeScript, and production-build checks continue to pass.

## Success Criteria

- GitHub issues #3 and #4 in the tracker repository are addressed by observable application behavior and regression tests.
- The three concrete tracker defects described in plugin issue #2 are addressed without changing plugin code.
- Existing saves load without migration or loss of Arcana unlocks.
- All automated tests, TypeScript checking, and the production build pass.
