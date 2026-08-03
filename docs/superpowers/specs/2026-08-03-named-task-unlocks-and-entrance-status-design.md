# Named task unlocks and entrance status design

**Date:** 2026-08-03

## Objective

Resolve the 140 task-unlock audit records that currently use named locations instead of numeric chunk IDs, while preserving the universal rule that one physical chunk is one unlock. Make each reviewed entrance visible in Chunk Info as locked with its physical chunk and available when that chunk is unlocked.

## Current state

The pinned chunk-content export contains 1,672 task-unlock records. The current transformer imports or normalizes 1,532 and leaves 140 unresolved with the single audit reason `named-location-unmappable`.

Those 140 records cover 47 unique named locations:

- 82 monster records.
- 27 shop records.
- 15 object records.
- 13 spawn records.
- 3 NPC records.

The transformer currently accepts numeric task-unlock locations and deliberately skips named locations. Chunk Info can show whether the selected chunk is locked and can show per-entity requirements, but it has no explicit representation of an entrance whose availability follows the selected physical chunk.

## Approved behavior

### Physical unlock ownership

An entrance belongs to the physical surface chunk containing that entrance.

- While the physical chunk is locked, Chunk Info shows `Entrance to <place> — locked with this chunk`.
- When the physical chunk is unlocked, Chunk Info shows `Entrance to <place> — available`.
- The entrance never costs an additional key or roll.
- If multiple named places or entrances share one physical chunk, unlocking that one chunk makes all entrances in that chunk available.
- Existing overlap aliases continue to obey one physical chunk = one unlock. A named subarea cannot create a second purchase identity for the same physical chunk.

Entrance availability means that the player can reach the entrance. It does not mean every activity inside is usable. Quest, Slayer level, Slayer task, skill, item, and other entity-specific requirements remain independent and continue to appear on the relevant content.

### Multiple entrances

If a named location has multiple independent physical entrances, each entrance follows its own physical chunk. The location is reachable when at least one valid entrance chunk is unlocked and any separate access requirements for that route are met.

Each entrance is displayed only in its own physical chunk's Chunk Info. Unlocking one entrance does not visually mark a different locked entrance chunk as unlocked.

The reviewed mapping may attach the location's task-unlock records to more than one entrance chunk when the content is genuinely reachable through those entrances. This is one-to-many metadata, not multiple unlocks for one physical chunk.

### Instances and non-physical locations

A named location that has no independently purchasable physical entrance is not assigned to a nearby chunk by guesswork. It receives an explicit terminal disposition such as `instance-only` or `non-purchasable`, with a reviewed reason and supporting source.

These records count as explained exclusions, not unresolved records. They do not produce a false entrance row or fabricated chunk content.

## Source policy

Every one of the 47 named locations must be reviewed against all relevant evidence before it receives a mapping:

1. The pinned `source-chunk/chunk-picker-v2` export remains authoritative for the original task-unlock entity, requirement text, and location name.
2. The Old School RuneScape Wiki location and dungeon pages establish named-place identity, entrances, access routes, quest gates, and whether an area is instanced.
3. RuneLite/world-map or game-cache coordinates are used where available to verify the exact entrance tile and therefore the physical chunk.
4. FLIM's canonical reviewed chunk source and overlap policy determine the final physical unlock identity used by the application.

The evidence is captured in a committed reviewed registry. Production builds do not fetch live sources. A later maintenance refresh may compare live sources, but runtime and CI consume only committed, reviewed data.

When sources conflict, the record remains unresolved until a reviewer decides which source reflects the live game. The transformer must not select the nearest surface chunk automatically.

## Reviewed named-location registry

Add one focused source file under `data/sources` for named task-unlock locations. It is reviewed data, not generated output and not a set of hard-coded conditionals in the transformer.

Each record contains:

- The exact upstream location key.
- Optional upstream aliases or subarea suffixes.
- A terminal disposition: `mapped`, `instance-only`, or `non-purchasable`.
- For mapped locations, one or more physical entrance records containing the canonical chunk ID and a player-facing entrance label.
- A mapping kind such as `single-entrance` or `multiple-entrances`.
- Source URLs or pinned source references.
- Verification date and a short reviewer note explaining the mapping.
- Any route-specific access requirement needed to avoid claiming that an unlocked entrance alone is usable.

The registry has exactly one terminal record for every named location found in the task-unlock source. Aliases may point to one canonical named-location record, but they cannot create new physical unlock identities.

## Transformation and generated data

The chunk-content transformer consumes the reviewed registry when a task-unlock location is nonnumeric.

For a mapped location it:

1. Cleans the entity name and requirement strings using the existing normalization rules.
2. Emits the requirement under every reviewed applicable chunk ID.
3. De-duplicates requirements when multiple upstream variants resolve to the same entity and physical chunk.
4. Records an imported or normalized terminal audit event with the named-location mapping reason and generated targets.
5. Emits the entrance metadata needed by Chunk Info.

For an explicit instance or non-purchasable disposition it emits an excluded terminal audit event with the reviewed reason and no chunk target.

For a missing, malformed, conflicting, or stale registry record it keeps the audit record unresolved and causes the release content gate to fail. Unknown named locations may never disappear silently.

Generated `public/chunk-content.json` gains a compact entrance index keyed by canonical numeric chunk ID. The service exposes a read-only query for entrances in one chunk. Entrance metadata is not added to saved player data because its state is derived from the existing chunk unlock state.

`chunk-content-lite` only gains entrance data if another existing consumer needs it. Chunk Info can use the full lazy-loaded content document, so duplicating the index is not required by this design.

## Chunk Info presentation

In `This chunk` mode, entrance rows appear near the existing area-lock and chunk-entry-requirement notices, before the content sections.

For a locked physical chunk:

`Entrance to Taverley Dungeon — locked with this chunk`

For an unlocked physical chunk:

`Entrance to Taverley Dungeon — available`

Presentation requirements:

- Locked entrances use the panel's existing locked/red or amber treatment and lock icon.
- Available entrances use the existing available/green treatment and check icon.
- Each entrance name links to the corresponding Wiki page using the existing Wiki-link behavior.
- Multiple entrances in one physical chunk are listed individually but inherit the same chunk state.
- Entrance state is not shown in `Whole area` mode because aggregating mixed locked and unlocked physical entrances into one status would be misleading.
- The existing `Requires <quest> to enter this chunk` notice remains separate. If an entrance route has an additional access requirement, its row displays that requirement without overriding the physical chunk state.
- The general locked-area preview remains unchanged.

## Data-flow boundaries

The change is divided into three focused units:

1. **Reviewed registry:** owns evidence, aliases, entrance chunks, and explicit exclusions.
2. **Transformer and service:** validate and convert reviewed mappings into per-chunk task requirements and entrance queries.
3. **Chunk Info:** renders the derived entrance state from the selected physical chunk and the existing unlock state.

Chunk Info does not interpret upstream location names or choose mappings. The transformer does not inspect player saves. The registry does not contain UI styling or game-state logic.

## Validation and error handling

The deterministic content gate must reject:

- A named source location without a registry record.
- A registry record that no longer appears in the pinned source unless explicitly retained as a documented legacy alias.
- A mapped record with no entrance.
- A duplicate upstream key with conflicting dispositions.
- A chunk ID absent from the canonical reviewed chunk source.
- Two canonical physical unlock identities assigned to the same entrance coordinate.
- An alias that resolves in a cycle or to an unknown canonical location.
- An entrance label that is empty or duplicated within the same chunk.
- A generated task requirement targeting an entity/chunk pairing that cannot be justified by the reviewed mapping.

The audit reports separate totals for imported, normalized, explicitly excluded, and unresolved named-location records. Success requires zero unresolved task-unlock records, but it does not require falsely importing legitimate instances.

## Testing

Implementation follows test-first development. Required coverage includes:

- A single named location mapping to one physical entrance chunk.
- Multiple upstream records sharing one named location.
- Variant names containing `#` resolving through reviewed aliases.
- A location with multiple independent entrance chunks.
- Duplicate requirements collapsing to one entity/chunk requirement.
- An instance-only location producing an explicit exclusion and no entrance.
- An unknown named location failing the source/content gate.
- A stale or invalid chunk ID failing validation.
- A shared physical chunk exposing multiple entrances while remaining one unlock.
- Locked and unlocked entrance rendering in Chunk Info.
- Additional quest or task requirements remaining visible independently of entrance availability.
- `Whole area` mode not presenting a misleading aggregate entrance state.
- Existing numeric task-unlock behavior remaining unchanged.
- The Otto's Grotto/Baxtorian Falls and other reviewed overlap pairs continuing to resolve as one physical unlock.
- Regenerated full and lite content remaining deterministic.
- Full application tests, TypeScript checking, content verification, and production build.

## Review batches

The evidence review should be performed in three batches:

1. High-volume locations first, beginning with Ruins of Tapoyauik, Temple of Ikov, RFD Dining Room, Edgeville Dungeon Wilderness, Chasm of Fire, Tower of Life Basement, Desert Mining Camp Underground Mines, Stronghold Slayer Cave, and Asgarnian Ice Dungeon.
2. Standard dungeons, caves, mines, basements, and guild interiors with stable physical entrances.
3. Ambiguous, quest-specific, teleported, instanced, or otherwise nonstandard locations requiring an explicit inclusion or exclusion decision.

No batch is released with unexplained records. Partial work may be committed for review, but the release gate remains red until every source record has a terminal disposition.

## Current named-location inventory

| Named location | Unresolved records |
|---|---:|
| Ruins of Tapoyauik | 15 |
| Temple of Ikov | 12 |
| RFD Dining Room | 11 |
| Edgeville Dungeon#Wilderness | 9 |
| Chasm of Fire | 6 |
| Tower of Life#Basement | 6 |
| Desert Mining Camp#Underground Mines | 5 |
| Stronghold Slayer Cave | 5 |
| Asgarnian Ice Dungeon | 5 |
| Slayer Tower#Basement | 4 |
| Wilderness Slayer Cave | 4 |
| Zanaris | 4 |
| Temple of the Eye | 4 |
| Task Only Wyvern Cave | 4 |
| Kalphite Cave | 3 |
| Kraken Cove | 3 |
| Enchanted Valley | 3 |
| Mining Guild | 3 |
| Smoke Devil Dungeon | 2 |
| Varrock Sewers | 2 |
| Rogues' Den | 2 |
| Dwarven Mine | 2 |
| Lithkren Vault | 2 |
| Giants' Foundry | 1 |
| Morytania Spider Nest | 1 |
| Karuulm Slayer Dungeon | 1 |
| The Warrens | 1 |
| Zemouregal's Base | 1 |
| Edgeville Dungeon | 1 |
| Abyssal Nexus | 1 |
| Varrock West Bank#Basement | 1 |
| Myreque hideout#Meiyerditch Hideout | 1 |
| Mage Arena bank | 1 |
| Dorgesh-Kaan mine | 1 |
| Dorgesh-Kaan South Dungeon | 1 |
| Brutus' Arena | 1 |
| Ruins of Camdozaal | 1 |
| Cerberus' Lair | 1 |
| Elemental Workshop | 1 |
| Crandor and Karamja Dungeon#South | 1 |
| Grotesque Guardians' Lair | 1 |
| Taverley Dungeon | 1 |
| Sourhog Cave | 1 |
| Zemouregal's Fortress#Basement | 1 |
| Lizardman Caves | 1 |
| Ogre Enclave | 1 |
| Shellbane Gryphon Cave | 1 |

## Success criteria

- All 140 current task-unlock records have a source-backed terminal disposition.
- The task-unlock audit reports zero unresolved records.
- Explicit legitimate exclusions are counted and explained separately from missing mappings.
- Every mapped entrance follows exactly one canonical physical chunk identity, while locations with multiple independent entrances may reference multiple physical chunks.
- Unlocking a physical chunk makes every entrance physically located in that chunk available without another key or roll.
- Chunk Info clearly distinguishes entrance availability from activity-specific requirements inside the location.
- No automatic nearest-chunk guess or undocumented manual exception is introduced.
- Existing saves require no migration and retain identical chunk ownership.
- The content outputs, source audit, tests, typecheck, and production build all pass deterministically.
