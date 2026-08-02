# One Physical Chunk, One Unlock and Surface Data Audit Design

**Date:** 2026-08-02
**Status:** Approved for specification review
**Repository:** `Nubles/OSRS-Fate-Locked`

## Goal

Enforce the rule that one physical surface chunk can require at most one paid
area unlock, migrate existing progress without taking value from players, and
correct the confirmed accuracy gaps found while auditing the current surface
map and chunk-source pipeline.

The immediate reported defect is that unlocking `Otto's Grotto` consumes an
area key but leaves chunk `39,54` locked because that physical chunk is owned
by `Baxtorian Falls`. The same rule applies to every equivalent overlapping
surface pair, not only this report.

## Confirmed Policy

A physical surface chunk has one canonical paid unlock identity.

- A named area with exclusive `SUB_AREA_CHUNKS` ownership remains the
  canonical identity.
- A second rollable surface name whose representative coordinate is already
  exclusively owned by that area becomes an alias of the canonical identity.
- Alias names remain valid inputs for diaries, quests, generated content,
  searches, map links, imports, and legacy saves, but they cannot be rolled or
  purchased independently.
- Interface copy may show both recognizable place names without creating a
  second progression unit.
- A genuinely separate physical chunk remains a separate unlock even when it
  is geographically nearby.

This rule applies to Standard mode's named-area economy and to every
named-location lookup used by Chunked mode. Chunked mode continues to unlock
coordinates directly; alias resolution ensures named requirements point to
the same coordinate rather than a second conceptual unlock.

## Evidence and Current Accuracy

### Authoritative sources

The audit uses:

1. the committed, hash-pinned export from
   `source-chunk/chunk-picker-v2` as the primary machine-readable source for
   surface coordinates and chunk content;
2. the current `gh-pages` export and upstream world-map asset to detect source
   drift;
3. OSRS Wiki location and world-map pages as secondary evidence for named
   geography and ambiguous boundaries; and
4. Fate Locked's roll pools, area policy, region ownership, subarea ownership,
   generated content, reachability, map rendering, save normalization, and
   RuneLite export as the complete set of local consumers.

Relevant reviewed references:

- Chunk Picker repository:
  <https://github.com/source-chunk/chunk-picker-v2>
- Reviewed upstream comparison:
  <https://github.com/source-chunk/chunk-picker-v2/compare/ba2fcebf8b26c84c74f8d9ab328a0ede802be926...4eb75a8454eb41cfff71b70819326e0e67bcea7c>
- Otto's Grotto:
  <https://oldschool.runescape.wiki/w/Otto%27s_Grotto>
- Baxtorian Falls:
  <https://oldschool.runescape.wiki/w/Baxtorian_Falls>
- OSRS world map:
  <https://oldschool.runescape.wiki/w/World_map>

### Coverage against the committed pin

The pinned source contains 1,172 numeric walkable chunks: 552 classified as
ocean and 620 non-ocean chunks. `REGION_CHUNKS` contains exactly those 620
non-ocean coordinates, with no missing or extra coordinate relative to the
pin.

`SUB_AREA_CHUNKS` gives named ownership to 511 of the 620 coordinates. The
remaining 109 are intentionally continent-only connective chunks established
by the earlier geography review. They are not counted as missing named data.

Therefore the current surface universe is complete against its pin, but the
pin and some authored ownership details require correction as described
below.

### Upstream source drift

At audit time, the pinned commit
`ba2fcebf8b26c84c74f8d9ab328a0ede802be926` is two `gh-pages` revisions behind
the reviewed upstream commit `4eb75a8454eb41cfff71b70819326e0e67bcea7c`.
The newer source classifies or names four surface coordinates around
Ardeaglais, Auchrie, and Wyrmscraig:

- `39,34`
- `39,35`
- `40,34`
- `40,35`

The reviewed transform comparison also changes six connections, adds one
content chunk, one Slayer master, four shortcuts, two shops, one drop table,
one bank, and one tag, while changing several existing Slayer task lists.
These changes must be regenerated from a newly verified exact source revision,
not copied from the audit prose.

### Confirmed parent-continent mismatches

Twenty-four named coordinates have a parent-continent assignment inconsistent
with their canonical subarea group and source geography. This can produce
labels such as `Falador · Misthalin` and `Port Sarim · Karamja`.

| Named area | Coordinates requiring review |
|---|---:|
| Al Kharid | 2 |
| Arandar | 1 |
| Burgh de Rott | 1 |
| Camelot | 1 |
| Catherby | 1 |
| Falador | 3 |
| Haunted Mine | 1 |
| Lighthouse | 1 |
| Mort Myre Swamp | 2 |
| Mort'ton | 1 |
| Port Sarim | 2 |
| Seers' Village | 1 |
| Stranglewood | 6 |
| Witchaven | 1 |

Each coordinate must be corrected only after an individual evidence check.
The implementation must not bulk-assign chunks solely from the parent group
name, because a boundary chunk can legitimately cross a regional border.

### Unresolved content evidence

The deterministic transformation ledger currently records 26,907 decisions.
Within it, 140 named `taskUnlocks` locations cannot yet be mapped safely to a
numeric chunk:

| Source category | Unresolved mappings |
|---|---:|
| Monsters | 82 |
| Shops | 27 |
| Objects | 15 |
| Spawns | 13 |
| NPCs | 3 |
| **Total** | **140** |

These 140 entries are the concrete missing-information backlog. Large excluded
counts elsewhere in the ledger mostly represent documented policies such as
non-walkable content and deliberately suppressed broad gates; they must not be
reported as missing facts.

Resolving the 140 mappings requires a separate item-by-item Wiki and Chunk
Picker review. This change will preserve and clearly report that backlog, but
will not guess coordinates or silently promote unresolved evidence into
runtime requirements.

### Verification defect

The generated full snapshot is current against the committed source. The
lightweight snapshot and audit ledger are also semantically identical to fresh
generation, but the verification command can report them as stale on Windows
because the checkout uses CRLF and the generator compares LF text. This is a
verification-tool defect rather than content drift.

## Canonical Overlap Set

The six existing non-exclusive surface references were reviewed against their
representative coordinates and exclusive owners.

| Alias or area | Representative chunk | Canonical owner | Result |
|---|---|---|---|
| Heroes' Guild | `45,54` | Taverley | Alias to Taverley |
| Ice Mountain | `46,54` | Goblin Village | Alias to Goblin Village |
| Ranging Guild | `41,53` | Hemenster | Alias to Hemenster |
| Otto's Grotto | `39,54` | Baxtorian Falls | Alias to Baxtorian Falls |
| Resource Area | `49,61` | Mage Arena | Alias to Mage Arena |
| Giants' Plateau | `52,49` | No exclusive named owner | Keep independent |

The exact canonical mappings are therefore:

```text
Heroes' Guild  -> Taverley
Ice Mountain   -> Goblin Village
Ranging Guild  -> Hemenster
Otto's Grotto  -> Baxtorian Falls
Resource Area  -> Mage Arena
```

The owner names are retained as stable canonical identifiers. Introducing new
combined identifiers such as `Baxtorian Falls & Otto's Grotto` was rejected
because it would unnecessarily churn saves, requirements, history labels,
exports, and authored content. Leaving both names rollable with multi-owner
rendering was rejected because it violates the confirmed progression rule.

## Data Model

Extend the central policy in `data/areaMapPolicy.ts` rather than creating a
second mapping system.

- Add the five mappings to `AREA_ALIASES`.
- Remove those five alias sources from their `REGION_GROUPS` roll pools.
- Remove their obsolete classification as current rollable surface references.
- Keep `Giants' Plateau` as a rollable surface reference.
- Keep entrance/access references and `Tutorial Island` policy unchanged.
- Add a pure display helper or static display metadata that can render a
  canonical owner with its well-known aliases without changing the stored ID.

Alias sources are non-rollable by contract. Targets must be current rollable
areas, cannot themselves be aliases, and must have the exclusive physical
ownership that justified the mapping. Multiple future aliases may target the
same owner, but alias chains are forbidden.

The canonical rollable area count falls from 181 to 176.

## Canonicalization Boundaries

Every consumer that accepts a named place must resolve it through the central
area policy before testing ownership or selecting a coordinate.

Required boundaries include:

- save loading and import;
- standard area reachability;
- quest, diary, task, goal, and generated-content requirements;
- map search and `chunkForPlace` links;
- unlock-impact and completion calculations;
- RuneLite `unlockedRegions` and `regionGroups` export; and
- any validation that compares an authored area name with the roll pool.

Canonicalization is a compatibility boundary, not permission to rewrite all
authored source strings. Generated records may continue to say `Otto's
Grotto`; their runtime requirement resolves to `Baxtorian Falls`.

For physical lookup, an alias resolves to the canonical owner's representative
or owned coordinate. Standard reachability checks canonical unlock membership.
Chunked reachability resolves the named requirement to the same physical
coordinate already used by the owner.

## Save Migration and Refunds

The existing save schema version remains unchanged because the stored shape is
unchanged.

During normalization:

1. validate and normalize the incoming region list;
2. retain distinct paid identifiers long enough to calculate compensation;
3. canonicalize all aliases;
4. preserve the first-seen order of each canonical identity; and
5. refund one regular key for every redundant distinct paid identifier that
   collapses within a canonical equivalence class.

Examples:

- `Otto's Grotto` alone becomes `Baxtorian Falls` with no refund.
- `Baxtorian Falls` alone is unchanged.
- Both names become one `Baxtorian Falls` unlock and refund one regular key.
- If a future class contains three separately purchased identifiers, it
  retains one unlock and refunds two keys.

Repeated identical entries caused by malformed duplication do not prove
multiple purchases and do not earn compensation. The refund saturates at
`MAX_COUNTER`. History remains unchanged. Once normalized, no alias source
remains in state, so revalidation and later imports cannot refund again.

## Interface and Map Behavior

The map still paints each coordinate from its single exclusive owner. An
unlocked canonical owner therefore unlocks the physical chunk regardless of
which alias name originated the requirement or legacy purchase.

Recognizable names remain visible through combined presentation such as:

- `Baxtorian Falls · Otto's Grotto`
- `Taverley · Heroes' Guild`

The canonical portion remains first so saved identifiers, completion, and
exports remain stable. Combined labels must be derived from central policy or
central display metadata; components must not maintain independent alias
lists.

Search accepts both canonical and alias names and navigates to the same chunk.
An alias must never appear as a separately locked, rollable, or completable
entry.

## RuneLite and External Contract

`buildRuneliteBundle` canonicalizes and deduplicates unlocked region names as
defense in depth. Exported region groups contain only the 176 canonical
rollable names. Existing overlay coordinates remain owned by the canonical
area, so the current bundle schema does not change.

Legacy callers may submit an alias and receive the canonical owner in output.
No Java plugin change or wire-format version increase is required unless
implementation verification reveals a consumer that relies on aliases as
distinct rollable IDs.

## Source Refresh and Geography Corrections

The source refresh is an explicit reviewed update:

1. query the current upstream `gh-pages` revision at execution time;
2. download it to a temporary location;
3. verify the commit, blob, and raw hash;
4. regenerate the full snapshot, lightweight snapshot, manifest, and ledger;
5. review every semantic category diff;
6. assign the four newly classified surface coordinates using Chunk Picker,
   world-map, and Wiki evidence;
7. review and correct the 24 parent-continent mismatches individually; and
8. commit the exact reviewed revision and deterministic outputs.

If upstream has moved beyond the audit revision, the implementation must
report and review the additional diff rather than silently pinning a new
revision. A network or hash failure leaves all committed source data unchanged.

## Verification Fix

Generated-text verification must be insensitive to checkout line-ending
conversion while remaining sensitive to semantic and formatting drift.
Normalize CRLF and LF consistently at the comparison boundary, or compare
parsed data plus a generator-controlled canonical serialization. Do not
rewrite user checkout settings or global Git configuration.

A Windows regression test must prove that LF-generated expected text and a
CRLF checkout compare as current, while a real content change still fails.

## Tests and Release Invariants

### Overlap policy

- Assert the exact five aliases and canonical targets above.
- Assert no alias source is present in `REGIONS_LIST`.
- Assert every target is rollable, non-aliased, and owns the referenced
  physical coordinate.
- Assert no independently rollable surface reference overlaps an exclusive
  rollable owner.
- Assert `Giants' Plateau` remains independent and classified.
- Assert the canonical area count is 176.

### Save compatibility

- Test alias-only, owner-only, and mixed saves for all five pairs.
- Test multiple overlapping pairs in one save and refund the exact sum.
- Test first-seen canonical ordering, unchanged history, saturation at
  `MAX_COUNTER`, current-version and unversioned saves, and idempotent second
  normalization.
- Test that repeated identical entries do not mint keys.

### Runtime behavior

- Prove each alias and owner has identical Standard reachability.
- Prove each alias resolves to its owner's physical coordinate in Chunked
  mode.
- Prove generated diary/task requirements using aliases become reachable from
  the canonical unlock.
- Prove rolls, forecasts, completion denominators, goal routing, and unlock
  impact contain only canonical identities.
- Prove search finds both names and combined display labels do not create
  additional progression entries.

### RuneLite contract

- Export alias-only and mixed inputs as one canonical owner.
- Assert region groups omit all five alias sources.
- Assert every existing physical overlay is retained.
- Run the web/RuneLite reachability parity suite.

### Geography and source integrity

- Require exact equality between the reviewed non-ocean source universe and
  `REGION_CHUNKS` after refresh.
- Require unique continent ownership and unique exclusive subarea ownership.
- Require every subarea coordinate to have a reviewed compatible parent
  continent.
- Pin the four new coordinates and all reviewed continent corrections.
- Require every transformation-ledger category to reconcile and preserve the
  explicit count of unresolved records.

### Verification tooling

- Test LF, CRLF, unchanged content, changed content, and malformed generated
  data.
- Run source verification, focused unit tests, full tests, type-check,
  production build, and deterministic regeneration before completion.

## Error Handling

Invalid, chained, cyclic, or dangling aliases fail validation. A surface alias
whose coordinate is not owned by its target fails the overlap invariant.
Unclassified rollable areas and overlapping paid identities fail release
tests rather than degrading silently.

Save input continues through strict validation before canonicalization. Refunds
cannot overflow, history is not rewritten, and a failed migration cannot
partially mutate committed state.

Source-update network, schema, hash, or generation failures leave the existing
pin and generated artifacts intact. Unresolved content remains explicitly
unresolved; it never receives an inferred coordinate merely to reduce the
backlog count.

## Scope Boundaries

This implementation includes:

- the five universal overlapping-surface aliases;
- roll-pool, migration, refund, reachability, display, search, completion, and
  export consistency;
- the reviewed source refresh and four new surface classifications;
- individual correction of the 24 confirmed parent-continent mismatches; and
- the Windows line-ending verification fix.

This implementation does not include:

- resolving all 140 named-location backlog entries;
- changing the meaning of the 109 reviewed continent-only connective chunks;
- creating multi-owner overlays;
- changing the RuneLite bundle wire format;
- changing key prices, roll odds, or completion rewards; or
- rewriting historical event descriptions.

## Success Criteria

The work is complete when:

- rolling or importing `Otto's Grotto` grants the same physical unlock as
  `Baxtorian Falls` and the map visibly unlocks chunk `39,54`;
- all five overlapping pairs behave as one paid unlock everywhere;
- no current or legacy save loses paid value, and duplicate purchases receive
  exactly one regular-key refund per redundant unlock;
- the canonical area pool contains 176 entries;
- recognizable alias names remain searchable and visible without becoming
  separate progression entries;
- all non-ocean chunks from the newly reviewed pin are represented exactly
  once;
- the four new upstream surface classifications and 24 reviewed continent
  corrections are applied with evidence;
- the 140 unresolved content mappings remain accurately reported without
  guesswork;
- Windows generation verification distinguishes line endings from real data
  drift; and
- focused and full release verification pass.
