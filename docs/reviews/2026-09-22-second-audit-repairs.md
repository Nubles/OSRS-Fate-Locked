# Second audit repairs — 22 September 2026

Repairs the 28 confirmed groups from the second audit, on top of the earlier 63-group repair set. The original audit evidence remains an as-found record. No app save has been reset, migrated by hand, or used for synthetic test progress. No commit, push or public deployment is included.

## Repair register

| IDs | Changes |
|---|---|
| T01 | Preserve and deduplicate diary references and residual clue counts from named interior records; enforce field-level conservation during generation. |
| T02 | Generate map categories from surface content, interior entrance projections and ground spawns. |
| T03 | Project connected Catacombs content to six reviewed entrances, retaining separate prior-vine requirements. |
| T04 | Locate the verified potato-cactus chamber, Historical Archive, missing sulphur-lizard section and during-quest Fisher Realm; preserve route and phase restrictions. |
| T05 | Resolve the source's Knight's Sword spelling to the existing canonical quest identity. |
| QG01–QG03 | Correct Ratcatchers first/step roles, add nine RFD stage starts at Lumbridge Castle, and retain both pre-quest elven start alternatives. |
| G01 | Resolve reference-only areas in Chunked ownership; incomplete quests do not need completion to satisfy ownership. Route restrictions remain separate. |
| G02 | Align Gandius and Wilderness Agility Course with their existing canonical map owners; link Emir's Arena to the arena's own chunk. |
| G03 | Require a real Boot/mine entrance for Family Crest, and separately retain the Chronozon/Edgeville visit. |
| G04 | Add Aldarin's central alchemical/winery chunk to its area. |
| PP01 | Preserve pending quest confirmations as unknown in exported permissions. |
| PP02 | Use canonical boss readiness in map/export access, including actual skill levels and untracked requirements. |
| PP03 | Carry each source's interior area with its route alternatives and enforce independent Fate ownership. |
| PP04–PP05 | Evaluate the map lens in the current mode and start traversal from the actual free Lumbridge courtyard chunk. |
| PP06 | Share the existing farming-patch identity resolver between the panel and permission export. |
| L01 | Recognize four reviewed non-generic banking facilities by identity and location, preserving Cabin Fever and other entry requirements. |
| L02 | Register Sawmill Operator, Estate agent and Sbott in their existing merchant categories. |
| L03–L04 | Use reviewed object/NPC transport identities, exclude inert scenery, and avoid inferring unrelated graph routes from a nearby service. |
| L05 | Add the reviewed Chase location with its adoption quest requirement. |
| L06 | Restore map links for five Mage Arena Shop rows and nineteen reviewed cross-kind resource hosts without broadening arbitrary entity lookups. |
| S01–S04 | Correct all 23 confirmed skill-reference rows: thresholds, compound entries, zenyte products and wrong skill/activity claims. Preserve correct neighboring entries and the earlier Agility-cape fix. |

## Important behavior boundaries

- Named-area ownership is distinct from physical access. An owned alternative Catacombs entrance can still need confirmation of its vine unlock.
- Resource location chips identify where a reviewed source is found; they do not approve obtaining an item or bypass resource requirements.
- RuneLite bundle field meanings and canonical saved quest/area identities remain stable. Exported permissions are tested on the web side; the separate Java plugin was not changed.
- Unknown bank, inventory, quest-phase and route conditions remain explicit. The original audit's unresolved candidates are not silently promoted to verified facts.
- Aldarin boundary 20,45 remains unchanged. Keldagrim's reference is aligned with its reviewed source/index entrance 11066, without treating the nearby mine marker as an exact surveyed cave coordinate.

## Validation

- **Full suite:** 273 test files and 3,636 tests passed (`full-tests-final.log`). Lane totals overlap and are not additional tests to sum.
- **Typecheck:** passed (`typecheck-final.log`).
- **Generated content:** diary, chunk, bank, ocean, quest-source, quest-route and walkthrough verification passed (`content-final.log`). The source pin remains `fa71ed3b207e6a501444987dee23b875ec27cacd`.
- **Player-facing changelog:** passed for 70 affected files (`changelog-final.log`).
- **Production build:** passed in 8.46 seconds; build `1790090917255`, entry `index-DHDkuPgX.js` (`build-final.log`). Existing bundler deprecation and large-bundle warnings remain; these checks do not certify performance.
- **Browser:** completed fresh onboarding on an isolated local origin, selected Chunked mode, confirmed Mining has 194 chunks, confirmed fresh reachability is 1 reachable / 1 owned, and visually checked the separate level-70 divine single-stat potions and level-97 divine super combat entry. No console warnings or errors were observed. The user's existing preview at `http://127.0.0.1:51944/` was reloaded and its entry asset matches the new production build. Original profile progress was not edited.
- **Independent review:** all 28 finding IDs are represented exactly once in an owning repair ledger; no coverage omissions found. Geography/resource changes also received a separate review, including a prototype-key lookup regression fix.

The initial integrated run caught stale generated-total expectations and the Family Crest requirement fingerprint. Those were updated to the reviewed output and retained Wiki revision 15352494, then the entire suite was repeated successfully. No production assertion was removed to make the checks pass. The sandbox initially prevented some test/build/Git subprocesses from starting; the same checks passed with subprocess access.

Detailed logs and domain evidence are retained in the [repair evidence folder](../../../audit/deep-2026-09-22/repairs/). The updated output contains 938 surface records and 932 interior records, with 149 interiors still explicitly unlocated. Compared with the as-found audit, the transformation recovers 91 diary references and 82 clue steps; Mining and Slayer categories now cover 194 and 77 chunks respectively.

## Remaining audit coverage

The original audit cohort of 1,221 partially checked skill-reference rows, one source conflict and two wording ambiguities remains a separate verification backlog, alongside unresolved shortcut/resource names, uncertain interior records and unsurveyed boundaries. The original banking audit also contained 17 metadata gaps and three intended manual checks beyond the four repaired name omissions; this is a historical cohort, not a new measured total of unknown banks. Fixing the confirmed defects does not certify every fact in OSRS. Manual route conditions remain visible where the app does not track the necessary game state. No logged-in OSRS/RuneLite replay or separate Java-plugin execution was performed.
