# Curated requirement review decisions

## 2026-09-05: Volcanic Mine historical gate correction

The supplied full audit correctly identified the removal of the Kudos and fossil-reward claim requirements on 8 May 2024. The previous activity review accidentally used the historical requirements and was wrong on this point. The [Volcanic Mine change log](https://oldschool.runescape.wiki/w/Volcanic_Mine#Changes) explicitly records their removal. After initially reading an indexed extract, the MediaWiki API returned current revision 15329062 on 5 September 2026. Its introduction lists 50 Mining and the 30 numulite entry fee or 3,000 permanent payment. Museum Camp building is also absent from the current entry requirements and has been removed from the confirmation.

Removed Kudos and fossil reward claims from the operational confirmation. Retained 50 Mining, Bone Voyage, entry payment/permanent payment and a legal pickaxe. The confirmation remains required because the app does not track these current operational facts.

## Provenance and review procedure

`data/sources/activity-requirement-provenance.json` covers all 222 curated activity keys. This follow-up retrieved exact current page content and revision metadata through the MediaWiki API, resolved redirects and ambiguous room/item/quest names, and inspected access/use summaries for 221 entries. Their source identities and revisions are now pinned. Aquarium remains a deliberately acknowledged unresolved catalog entry with an UNKNOWN predicate; it is not assigned an invented page. Missing source mappings for new normal entries fail the offline gate. The older reports retained here are historical review records, superseded by this decision where they disagree.

The review covers access/use and distinguishes current possession from acquisition. It is not a proof of every possible upgrade, combat loadout, boost, or branch of every source page. External conditions remain explicit confirmations. The monitor watches page revisions, not gameplay truth; CURRENT means no detected source drift from these baselines, not independently verified readiness.

The exact-source pass also added Sire first-Abyss access, Hydra heat protection, valid boss-task alternatives, Perilous Moons completion for repeat encounters, Yama contract access, Tithe tools, Mixology materials and access quest, Tears weekly eligibility, and selected transport-route prerequisites. Rat Pits uses partial progression and an explicit non-Ironman/selected-cat check. It does not demand full quest completion for every pit.
Run `node scripts/check-requirement-freshness.mjs --output=requirement-freshness.json` for deterministic structural coverage. Offline success does not mean the sources are current. Run with `--upstream` to read current Wiki revisions and fail with a review report when sources change, become unavailable, lack baselines, or exceed 90 days. Acknowledged Aquarium uncertainty is visible but does not repeatedly fail the monitor while its rule remains UNKNOWN. A failed fetch is never treated as no change. The scheduled workflow has read-only repository permissions, uploads evidence even on failure and never updates a rule, baseline, review date, issue or pull request.

To close a flag, review the relevant current source and update the rule and regression together if needed. Record the actual reviewed revision ID and review date, link the decision here, and preserve any unknown facts. Fetching a newer revision alone is not a semantic review. Update-history changes on tracked pages are caught as page revisions; the checker does not scrape all Jagex update prose or claim exhaustive update-impact inference. That broader mapping remains a manual maintenance task.

The note-word check catches wholly unclassified notes. It cannot prove that a typed predicate models every phrase, nor that an informational note is truthful. Semantic review remains necessary.

## Same-day upstream change detected and reviewed

The live freshness check caught Giants' Foundry changing from revision 15331459 to 15331483 during this work. A read-only content comparison showed strategy edits about sweet-spot bonuses and difficulty, with no entry or material requirement change. The reviewed baseline was advanced only after this comparison; no game rule was rewritten automatically. This supplies an actual source-change detection example in addition to unit tests.
