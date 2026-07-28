# Area Alias Migration and Geography Policy Design

**Date:** 2026-07-28

## Goal

Remove the duplicate `Elf Camp` unlock without losing legitimate player
progress, migrate existing saves to the canonical `Iorwerth Camp` name, and
make geographic coverage an enforced requirement for every rollable area.

This design also establishes the boundary for two follow-up audits:

1. an exhaustive audit of authored chunk geography; and
2. a separate audit of monsters, shops, farming patches, banks, points of
   interest, quests, and activities inside each chunk.

The confirmed Elf Camp defect must ship independently of those larger audits.

## Current Problem

`Tirannwn` currently contains both `Elf Camp` and `Iorwerth Camp` in the area
roll pool. Only `Iorwerth Camp` has an authored map overlay. As a result,
`Elf Camp` can consume a key, inflate the area and completion denominators,
block canonical Tirannwn completion, and appear in a RuneLite export without
any corresponding overlay coordinates.

The broader dataset also contains sixteen other rollable names without an
exclusive `SUB_AREA_CHUNKS` entry. Some are missing surface references, some
are underground or off-map locations that need entrance references, and one
is intentionally unavailable after account creation. Treating all of them as
missing exclusive overlays would be incorrect because the current overlay
model permits only one named owner per chunk.

## Scope

This implementation will:

- remove `Elf Camp` from all new area rolls;
- canonicalize legacy `Elf Camp` progress to `Iorwerth Camp`;
- refund one regular key when a save contains both names;
- keep the migration idempotent;
- update Tirannwn and overall completion through the canonical area pool;
- canonicalize RuneLite bundle area names defensively;
- classify every current rollable area as an exclusive overlay, a
  non-exclusive geographic reference, or an intentional exemption; and
- add tests that reject future unclassified rollable areas.

This implementation will not:

- change the RuneLite bundle wire format;
- change the Java plugin;
- reassign existing exclusive overlay ownership;
- perform the exhaustive chunk-boundary audit; or
- validate per-chunk monsters, shops, farming, banks, points of interest,
  quests, or activities.

Those audits are independent follow-up workstreams described below.

## Chosen Approach

Create one central area-geography policy alongside the existing exclusive
overlay dataset.

`SUB_AREA_CHUNKS` remains the source of exclusive overlay ownership. A new
policy module owns:

- legacy aliases;
- non-exclusive surface and entrance/access coordinates; and
- intentional non-mappable exemptions.

This preserves existing rendering semantics while allowing an entrance or
surface reference to overlap a chunk already owned by another named area.
It avoids both destructive deletion of legitimate locations and a broad
multi-label overlay rewrite.

The rejected alternatives are:

- patching Elf Camp alone and maintaining ad hoc exemptions, which would
  allow the same drift to recur; and
- converting the entire map to overlapping named areas, which would require
  coordinated web-map and RuneLite overlay changes far beyond this defect.

## Geographic Classifications

### Legacy alias

| Legacy name | Canonical name | Rule |
|---|---|---|
| Elf Camp | Iorwerth Camp | Never roll the legacy name; canonicalize it at save and export boundaries. |

### Non-exclusive surface references

These are real surface locations whose representative chunks may overlap an
existing exclusive label:

- Heroes' Guild
- Ice Mountain
- Ranging Guild
- Otto's Grotto
- Giants' Plateau
- Resource Area

### Entrance or access references

These locations are underground, off the main surface map, in another realm,
or reached through a specific surface access point:

- Dwarven Mine
- Asgarnian Ice Dungeon
- Motherlode Mine
- Mor Ul Rek (TzHaar City)
- Braindeath Island
- Keldagrim
- Wilderness God Wars Dungeon
- Catacombs of Kourend
- Zanaris

### Intentional exemption

`Tutorial Island` is intentionally non-mappable for an active run because a
normal account cannot return after leaving the tutorial. It remains an
explicit exemption rather than being silently ignored.

## Data Model

Create `data/areaMapPolicy.ts` with three public concepts:

1. `AREA_ALIASES`, mapping a legacy name directly to one current canonical
   name;
2. `AREA_REFERENCES`, mapping exceptional current names to a policy record
   containing:
   - `kind: 'surface' | 'entrance'`;
   - one or more canonical `{ cx, cy }` references; and
   - a concise reason explaining what the coordinates represent; and
3. `INTENTIONALLY_UNMAPPABLE_AREAS`, mapping an exceptional current name to
   its reason.

The module also exposes pure helpers that:

- canonicalize one area name;
- canonicalize a list while preserving the first-seen order; and
- report how many legacy entries collapsed into an already present canonical
  unlock.

Aliases are single-hop by contract. An alias source cannot be rollable, its
target must be rollable, and its target cannot itself be another alias.

## Save Migration

The existing save schema remains at version 1. This is a data
canonicalization within the current schema, not a structural format change.

During unlock normalization:

1. normalize and deduplicate the input region identifiers as today;
2. canonicalize region names through the central area policy;
3. preserve the first-seen position of each canonical name; and
4. return the count of duplicate legacy/canonical pairs that collapsed.

During top-level state normalization:

- add one regular key only when the raw normalized region list contained both
  `Elf Camp` and `Iorwerth Camp`;
- do not refund a save containing only `Elf Camp`;
- do not refund a save containing only `Iorwerth Camp`;
- cap the resulting balance at `MAX_COUNTER`;
- leave history unchanged; and
- mark the save as migrated so the existing migration warning is emitted.

After the first normalization, the state contains only `Iorwerth Camp`.
The schema's existing revalidation pass and every later import therefore see
no legacy/canonical pair and cannot award another key.

## Roll Pools and Completion

Remove `Elf Camp` from `REGION_GROUPS.Tirannwn`. Because `REGIONS_LIST` is
derived from `REGION_GROUPS`, this one canonical source updates:

- standard area rolls;
- Chaos rolls;
- area availability;
- forecasts;
- goal routing;
- search and progression totals;
- Tirannwn child completion; and
- the overall completion denominator.

An existing `Elf Camp` unlock becomes `Iorwerth Camp`, so it continues to
grant the intended access. A save that had paid for both names receives one
regular key and retains one canonical completion point. Tirannwn completes
when every canonical Tirannwn child, including `Iorwerth Camp`, is unlocked.

## RuneLite Export

`buildRuneliteBundle` canonicalizes and deduplicates `unlockedRegions` before
serializing. This is defense in depth for callers that bypass validated
persistence.

The exported `regionGroups.Tirannwn` comes from the corrected canonical area
pool, so it contains `Iorwerth Camp` and not `Elf Camp`. The existing
`Iorwerth Camp` entry in `SUB_AREA_CHUNKS` remains unchanged. No new bundle
field is added, and older or current Java plugins continue to consume the
same version 3 shape.

## Geographic Integrity Invariants

The test suite enforces all of the following:

- every current rollable area has exactly one coverage route:
  - an exclusive `SUB_AREA_CHUNKS` entry;
  - an `AREA_REFERENCES` entry; or
  - an intentional exemption;
- every reference coordinate exists in `REGION_CHUNKS`;
- exclusive overlay chunks remain uniquely owned;
- non-exclusive references may overlap exclusive ownership;
- alias sources do not appear in `REGIONS_LIST`;
- alias targets do appear in `REGIONS_LIST`;
- alias targets are not aliases;
- references and exemptions use current rollable names; and
- no area is simultaneously a reference and an exemption.

These rules convert the current audit into a permanent release gate.

## Testing

### Area policy

Add focused tests for:

- complete classification of every `REGIONS_LIST` entry;
- valid authored reference coordinates;
- valid, non-chained aliases;
- disjoint reference and exemption sets; and
- the exact classification of all seventeen exceptional names.

### Save compatibility

Extend the save-schema tests to prove:

- `Elf Camp` alone becomes `Iorwerth Camp` without a refund;
- both names collapse to `Iorwerth Camp` with exactly one regular key;
- `Iorwerth Camp` alone remains unchanged;
- a migrated state revalidates without another refund or warning;
- unrelated region order and the full history remain unchanged;
- current-version and unversioned legacy saves both migrate; and
- a refund at `MAX_COUNTER` saturates safely.

### Roll and completion behavior

Tests must prove:

- the Regions pool cannot return `Elf Camp`;
- normal and Chaos validation cannot select the legacy name;
- Tirannwn has one fewer canonical child;
- owning every canonical Tirannwn child completes the parent; and
- overall completion derives from the corrected denominator and migrated
  unlock count.

### RuneLite contract

Tests must prove:

- legacy-only and mixed legacy/canonical input exports only
  `Iorwerth Camp`;
- `regionGroups.Tirannwn` contains no `Elf Camp`;
- the Iorwerth Camp overlay chunks are still present; and
- the existing web/RuneLite reachability parity suite remains green.

## Error Handling

Invalid aliases or unclassified areas fail tests during development and
release verification rather than degrading silently at runtime.

Save inputs still pass through the existing strict validation boundary.
Canonicalization operates only on already validated identifier arrays. The
refund cannot overflow because it saturates at `MAX_COUNTER`. History is not
rewritten, rehashed, or supplemented during migration.

## Follow-up Workstream 1: Exhaustive Geography Audit

After the urgent migration ships, create a separate specification and plan
that audits every authored and adjacent candidate chunk.

That audit will:

- compare `REGION_CHUNKS` against the current authoritative world-map source;
- enumerate every authored chunk and every gap surrounded by authored chunks;
- verify continent ownership, coastlines, islands, new landmasses, and map
  edges;
- verify every `SUB_AREA_CHUNKS` assignment against the actual location;
- detect missing, duplicate, orphaned, and suspiciously isolated chunks;
- verify all surface and entrance references from the area policy;
- produce a reviewed correction report before changing geography; and
- rerun map rendering, reachability, completion, and RuneLite parity tests
  after approved corrections.

Corrections from this audit must be evidence-backed and reviewed in batches;
the audit must not automatically claim every gap or reassign overlapping
locations.

## Follow-up Workstream 2: Per-Chunk Content Audit

After geographic ownership is verified, create a second specification and
plan for `CHUNK_CONTENT_LITE` and its upstream source.

That audit will separately validate:

- monsters and Slayer coverage;
- shops and merchants;
- farming patches;
- banks and deposit boxes;
- points of interest;
- quest and diary activities; and
- other activity requirements that consume chunk data.

Content corrections must not be mixed with geography corrections because
they use different evidence sources and affect different game systems.

## Success Criteria

The work is successful when:

- no new roll can produce `Elf Camp`;
- every existing Elf Camp unlock grants Iorwerth Camp access;
- a player who rolled both names receives exactly one regular key once;
- Tirannwn and overall completion use only canonical areas;
- RuneLite exports contain only the canonical name and retain the overlay;
- every current rollable area has a tested geography policy; and
- the full geography and content audits are explicitly queued as separate,
  evidence-driven workstreams.
