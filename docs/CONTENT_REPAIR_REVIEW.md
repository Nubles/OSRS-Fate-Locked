# Content and access repairs — 21 September 2026

This change repairs the 16 issues identified in the repository review, refreshes
the reviewed sources, and adds regression coverage. It does not certify that a
community snapshot contains every current OSRS entity or route.

## Coverage

- 938 populated surface records retained.
- 909 interior records preserved, including 756 with a surface entrance route.
- 153 interior records retained without an established entrance; listed below.
- 439 active shop stock records, all with indexed locations. Empty stock is
  explicit for shops that only resell player stock. NPC services have their own
  category mappings; removed seasonal shops are excluded.
- 548 ocean chunks treated as navigation, outside the 624-chunk land roll pool.
- 128 bank unlocks, including Keldagrim/Blast Furnace at their entrance and the
  existing virtual Forestry deposit service. Mapped interior bank facilities are
  checked against the bank registry and keep source entry requirements.
- All 624 land chunks can eventually enter the Chunked frontier with Sailing.
- 212 journal entries represent 184 official quests plus miniquests and RFD
  stages. A Ruff Situation and Crab Quest are included.
- 655 Combat Achievement tasks and the official cumulative point thresholds.

## Review findings and repairs

| Finding | Result |
| --- | --- |
| F01: discarded interior content | Preserve physical source IDs, entrance paths, per-entity requirements, and named supplements. Avoid counting the same interior twice in area aggregates. |
| F02: ocean content always locked | Add a generated ocean registry and explicit navigation access. |
| F03: 256 land chunks outside the original frontier component | Extend the frontier across connected water and four reviewed boat landings; keep every paid roll a land chunk. |
| F04: merchant access ignored quests | Use shared source requirement evaluation in the directory, drawer, item sources, and permission export. |
| F05: loaded snapshot claimed complete coverage | Keep item-source coverage partial; positive evidence remains usable, absent evidence is inconclusive. |
| F06: duplicate Venator collection slots | Move the original IDs to Slayer, retire duplicate IDs, and merge saved progress by maximum count. |
| F07: stale content and broken sync checks | Refresh the pinned source, quests, collection log, and CAs. Update exact source baselines without removing evidence-preservation assertions. |
| F08: quest completion wording lost | Preserve completion wording; compile canonical quest gates and RFD guest counts. Unsupported partial stages remain unresolved unless the completed quest proves them. |
| F09: Slayer families and locations mismatched | Use reviewed exact NPC families and assignment location constraints, shared by the panel and export. |
| F10: Mad Angel bypassed boss unlock | Canonicalize the source boss alias. |
| F11: quest aliases and RFD stages mismatched | Resolve display/source names to stable journal IDs and retain separate RFD stages. |
| F12: place chips selected a locked chunk | Prefer an owned representative when a named place spans multiple chunks. |
| F13: shops, stock, services, and categories missing | Restore interior merchants, supplement reviewed reward stocks, classify services, and distinguish empty stock from missing evidence. |
| F14: empty collection pages produced invalid IDs | Allocate finite globally unique IDs, reserve retired IDs, and preserve identities across moves. |
| F15: failed freshness requests reported success | Report UNKNOWN on unavailable sources and compare official quest totals separately from journal entries. |
| F16: failed data loading could not recover | Add shared observable loading and retry controls for the shop and Slayer panels. |

## Save compatibility and rule changes

Existing quest, CA, land-chunk, and collection identities are preserved. The two
duplicate Venator IDs migrate to their original IDs using the higher saved count,
so a physical drop does not award a second collection slot. The runtime collection
cache and chunk data cache are versioned to discard stale generated results.

Chunked frontier rules deliberately change: after Sailing is unlocked and
Pandemonium is complete, reachable ocean and documented boat landings may expose
new land rolls. Rolling a destination does not complete its travel quest or waive
its entity requirements. Existing owned chunks remain owned.

Export a fresh RuneLite bundle after updating to receive the repaired permission
rows. Wire-format versions are unchanged because the payload shape is compatible.

## Evidence limits

The source connection graph does not describe every door, shortcut, teleport,
instance, or quest stage. An indexed entrance is source evidence, not proof of a
complete navigable route. The general transport graph remains a connectivity
hint; precise entry and entity requirements must also pass.

Started-quest and partial-stage requirements use explicit quest-progress gates.
They remain unknown when the journal cannot establish the required stage.
Completion proves only reviewed permanent milestones; it blocks access to the
quest-only Crabclaw lower chamber. The app does not yet record intermediate
quest progress or live inventory/door/assignment state.
The Lost Property shop likewise cannot infer which replacement quest rewards a
player has already earned. New quests have journal requirements and source
evidence; this change does not invent walkthroughs for them.

## Second entrance pass (local review, not deployed)

The follow-up review establishes entrances for **30 additional records**, including
all previously unlocated named interiors in this snapshot. The 153 remaining
records have no source location name. Of those, 61 contain monsters, NPCs, shops
or item spawns; 92 contain only object/quest/diary/clue evidence. These are source
records, not a count of distinct active dungeons.

| Content | Surface entrance(s) | Access evidence retained |
| --- | --- | --- |
| Crabclaw Caves | 25,53 | Read the quest book; the lower quest chamber closes on completion. |
| Crash Site Cavern | 38,55 | Permanent gorillas require Monkey Madness II completion. |
| Kruk's Dungeon | 42,43 | The actual jungle-grass trapdoor; the partial quest milestone stays unknown until proven. |
| Lumbridge Swamp Caves and Ancient Guthixian Temple | 49,49 | The swamp entrance needs no Lost Tribe progress; temple and tormented-demon quest gates remain separate. |
| Waterbirth Island Dungeon | 39,58 | Deeper-room doors and routes need confirmation. The Lighthouse connection is not an island entrance. |
| Brimhaven Dungeon and Hieve's chamber | 42,49 or 43,47 | Separate payments/tool requirements; upper dragons also require a current matching Slayer assignment. |
| Underground Pass | 38,51 or 36,50 | Room/quest phase remains unknown; completing the quest does not prove every route. |
| Mourner Tunnels, Temple of Light and Death Altar | 39,51 | Reviewed Mourning's End Part II stages; altar entry equipment/alternative method remains unverified. |
| God Wars source record 11346 | 45,58 | Geography established; entry and encampment conditions remain unverified. |
| Rune essence mine | 50,53; 48,49; 41,51 | Three reviewed NPC teleport routes, each requiring Rune Mysteries. |

The source registry records Wiki revision links and coordinate evidence where
available. Curated coordinates are checked against their surface chunk before
regeneration. Named dungeon rules also apply to their section records, and
record-specific requirements are retained separately from other copies of an
entity. A missing explicit interior source can no longer fall back to an
unrestricted surface copy.

A routing regression is also fixed: an indirect route discovered earlier could
hide a later direct entrance to the same chunk, then be discarded as too long.
The shortest recorded route now replaces it without inheriting unrelated gates.

No save schema or RuneLite wire-format change is required. Existing quest and
collection identities are unchanged. A fresh bundle includes the updated rows.
The content cache version is incremented so browsers request the new snapshot.

## Validation

The follow-up full suite passes all **3,283 tests**, run with two workers in the
review workspace. The audit baseline increases by one event (an additional lite
summary cap); the 30 newly mapped records change disposition without changing
source identities or source totals. Typechecking, offline content verification,
changelog verification and the production build also pass.

Regression coverage exercises restored and gated shops, all retained stock hosts,
RFD stages, boss aliases, constrained Slayer locations, all 624 land-frontier
destinations, collection ID migrations, failed freshness requests, and shared
loading recovery. The final PR records full-suite, typecheck, content verification,
freshness, and production-build results.

Interactive local browser verification was unavailable because the browser
rejected the workspace's localhost URL. Component interaction tests cover the
changed drawer and Slayer panel; this is not a claim of a successful browser run.

The four-pilot planner inspection baseline rises from 30,000 to 40,000 work units
for the larger source catalogue (the observed refresh workload was 33,825).
Production search limits and the independent route-combination regression are
unchanged. This is source inspection growth, not permission to remove runtime
search bounds.

## Interior records awaiting entrance evidence

These records remain in the generated full dataset and transform audit. They are
excluded from positive location/permission indexes until their entrance is known.
No active shop stock table depends on these records.

| Source ID | Source location |
| --- | --- |
| 10055 | Interior 10055 |
| 10056 | Interior 10056 |
| 10058 | Interior 10058 |
| 10070 | Interior 10070 |
| 10138 | Interior 10138 |
| 10310 | Interior 10310 |
| 10311 | Interior 10311 |
| 10314 | Interior 10314 |
| 10336 | Interior 10336 |
| 10567 | Interior 10567 |
| 10591 | Interior 10591 |
| 10592 | Interior 10592 |
| 10846 | Interior 10846 |
| 10847 | Interior 10847 |
| 10848 | Interior 10848 |
| 10895 | Interior 10895 |
| 11081 | Interior 11081 |
| 11102 | Interior 11102 |
| 11104 | Interior 11104 |
| 11154 | Interior 11154 |
| 11343 | Interior 11343 |
| 11358 | Interior 11358 |
| 11359 | Interior 11359 |
| 11360 | Interior 11360 |
| 11408 | Interior 11408 |
| 11591 | Interior 11591 |
| 11616 | Interior 11616 |
| 11666 | Interior 11666 |
| 11857 | Interior 11857 |
| 12369 | Interior 12369 |
| 12436 | Interior 12436 |
| 12448 | Interior 12448 |
| 12619 | Interior 12619 |
| 12621 | Interior 12621 |
| 12622 | Interior 12622 |
| 12623 | Interior 12623 |
| 12636 | Interior 12636 |
| 12637 | Interior 12637 |
| 12638 | Interior 12638 |
| 12639 | Interior 12639 |
| 12640 | Interior 12640 |
| 12690 | Interior 12690 |
| 12893 | Interior 12893 |
| 12896 | Interior 12896 |
| 13128 | Interior 13128 |
| 13134 | Interior 13134 |
| 13135 | Interior 13135 |
| 13136 | Interior 13136 |
| 13138 | Interior 13138 |
| 13139 | Interior 13139 |
| 13140 | Interior 13140 |
| 13141 | Interior 13141 |
| 13145 | Interior 13145 |
| 13148 | Interior 13148 |
| 13149 | Interior 13149 |
| 13210 | Interior 13210 |
| 13390 | Interior 13390 |
| 13391 | Interior 13391 |
| 13394 | Interior 13394 |
| 13395 | Interior 13395 |
| 13396 | Interior 13396 |
| 13397 | Interior 13397 |
| 13401 | Interior 13401 |
| 13404 | Interior 13404 |
| 13405 | Interior 13405 |
| 13406 | Interior 13406 |
| 13407 | Interior 13407 |
| 13408 | Interior 13408 |
| 13641 | Interior 13641 |
| 13642 | Interior 13642 |
| 13643 | Interior 13643 |
| 13644 | Interior 13644 |
| 13645 | Interior 13645 |
| 13646 | Interior 13646 |
| 13647 | Interior 13647 |
| 13658 | Interior 13658 |
| 13659 | Interior 13659 |
| 13899 | Interior 13899 |
| 13900 | Interior 13900 |
| 13914 | Interior 13914 |
| 13915 | Interior 13915 |
| 14154 | Interior 14154 |
| 14156 | Interior 14156 |
| 14393 | Interior 14393 |
| 14476 | Interior 14476 |
| 14477 | Interior 14477 |
| 14478 | Interior 14478 |
| 14653 | Interior 14653 |
| 14732 | Interior 14732 |
| 14733 | Interior 14733 |
| 14734 | Interior 14734 |
| 14909 | Interior 14909 |
| 16013 | Interior 16013 |
| 16014 | Interior 16014 |
| 16269 | Interior 16269 |
| 16270 | Interior 16270 |
| 16782 | Interior 16782 |
| 17038 | Interior 17038 |
| 5278 | Interior 5278 |
| 5530 | Interior 5530 |
| 6303 | Interior 6303 |
| 6473 | Interior 6473 |
| 6488 | Interior 6488 |
| 6494 | Interior 6494 |
| 6495 | Interior 6495 |
| 6729 | Interior 6729 |
| 6731 | Interior 6731 |
| 6742 | Interior 6742 |
| 6744 | Interior 6744 |
| 6745 | Interior 6745 |
| 6750 | Interior 6750 |
| 6751 | Interior 6751 |
| 6851 | Interior 6851 |
| 6985 | Interior 6985 |
| 6994 | Interior 6994 |
| 7007 | Interior 7007 |
| 7234 | Interior 7234 |
| 7247 | Interior 7247 |
| 7494 | Interior 7494 |
| 7499 | Interior 7499 |
| 7500 | Interior 7500 |
| 7501 | Interior 7501 |
| 7502 | Interior 7502 |
| 7504 | Interior 7504 |
| 7509 | Interior 7509 |
| 7513 | Interior 7513 |
| 7514 | Interior 7514 |
| 7754 | Interior 7754 |
| 7758 | Interior 7758 |
| 7763 | Interior 7763 |
| 7769 | Interior 7769 |
| 7770 | Interior 7770 |
| 8010 | Interior 8010 |
| 8011 | Interior 8011 |
| 8012 | Interior 8012 |
| 8014 | Interior 8014 |
| 8025 | Interior 8025 |
| 8026 | Interior 8026 |
| 8261 | Interior 8261 |
| 8269 | Interior 8269 |
| 8278 | Interior 8278 |
| 8524 | Interior 8524 |
| 8525 | Interior 8525 |
| 9038 | Interior 9038 |
| 9287 | Interior 9287 |
| 9293 | Interior 9293 |
| 9294 | Interior 9294 |
| 9522 | Interior 9522 |
| 9549 | Interior 9549 |
| 9550 | Interior 9550 |
| 9802 | Interior 9802 |
| 9806 | Interior 9806 |
| 9812 | Interior 9812 |
