# September accuracy and usability release candidate

Prepared 24 September 2026. **Unreleased.** This document gathers the completed audit repairs and guide improvements for release review. A reviewed source commit, draft pull request and CI checks may be prepared without merging or deploying. No public deployment or live RuneLite verification is claimed.

The player-facing entry is `2026-09-24-unlocks-and-guide-saves` in `data/changelog.ts`. It consolidates the previously separate, unreleased 22 and 24 September entries and removes the repeated map-export note. Entries already present at the baseline remain unchanged.

## Included in the production candidate

### Requirements and content accuracy

- Vanilla Doable, Journal and planning use canonical area and requirement checks, rather than applying Chunked travel logic to Vanilla accounts. Structured alternatives, partial quest milestones, manual confirmations and actual quest-point gates remain visible.
- Required quest equipment is enforced, including Neck T1 for The Restless Ghost. Sheep Shearer gates spinning behind Crafting while allowing confirmation of already-owned, permitted wool. Priest in Peril does not gain an invented ghostspeak-amulet or Prayer prerequisite.
- Diary equipment, Mobility, Arcana and merchant permissions flow through suggestions, counts, completion guards, plans and unlock-impact advice. Known locks cannot be bypassed with a manual confirmation. Corrections include Draynor's Agility unlock, Thessalia's Clothes Shops permission, worn outfit/weapon requirements, Fairy Rings and reviewed alternative methods.
- Quest, Slayer, activity, farming and housing requirements retain source-backed prerequisites and exceptions. Inventory-only tools do not become equipment-slot locks. Retired Aquarium stays compatible with old saves but is removed from active rolls and completion totals.
- Resource plans enforce skill caps, recursively account for ingredients and reusable tools, preserve finite owned supplies, correct recipes and dose conversions, and distinguish raid-only supplies. Confirmed skill-reference and training-advice errors and broken Wiki destinations are corrected.
- Banks and shops retain local entry, quest and diary requirements. Unknown access remains explicit. Merchant categories, transport identities and resource location links are corrected.
- Generated map content preserves interior diary and clue data, underground content and ground spawns. Reviewed entrances, quest starts, Family Crest locations and Aldarin coverage are corrected. Permission exports preserve pending confirmations, boss access and independent interior ownership.

### Equipment and combat tools

- Air, water, earth and fire basic staves share T1. White Knight gear joins black at T2; steel remains T2 under the existing Fate ladder. Reviewed material, cosmetic, ammunition and named-equipment families use consistent rules.
- OSRS facts establish item properties and equivalent variants; Fate tier numbers remain app rules. Remaining statistical estimates are labelled and are not certified by this release.
- A pinned equipment catalogue preserves exact IDs, including charge, cosmetic and quest-item variants. Reviewed tiers alone become definitive RuneLite equipment permissions; estimated tiers stay unknown to that permission export.
- Equipment and monster snapshots ship with the app, with source fingerprints, cache migration and retry handling. Existing equipped IDs and profile progress are retained.
- Boss Planner and DPS controls use the equipped weapon's supported attack types and stances. Unknown categories remain unassessed. Magic-damage units, melee boost calculations, prayer damage and ranged defence categories are corrected. This remains a baseline model, not complete special-attack, item-passive or boss-mechanic simulation.

### RuneProof guidance and saves

- The shared guide interface has one ordered walkthrough, a compact Still needed summary, step-linked requirements, recognizable slot/item/skill artwork, named locations and maps. Optional reference details and coordinates stay collapsed until requested.
- Required actions retain their own permission guards. Owned-supply confirmation can skip the matching preparation actions but cannot bypass later equipment, skill or location requirements.
- Guide item and step checks belong to the run's canonical save and travel in backups and recovery checkpoints. Older restores do not resurrect newer browser-only checks; obsolete action IDs are filtered by guide revision.
- Save ownership, competing-tab warnings, quota recovery, retries and stale-callback protections cover guide progress. Guide checks do not complete Journal quests or issue rewards.
- These shared improvements apply to the **five existing public guides**: Cook's Assistant, Sheep Shearer, The Restless Ghost, Rune Mysteries and Imp Catcher. The production catalogue stays limited to those five.

### Presentation, progress and reliability

- OSRS Wiki artwork replaces decorative emoji and generic game-content artwork across navigation, planners, activities, achievements, rivals, reveals and related views. Ordinary interaction/status controls remain recognizable controls, and image failures retain accessible labels.
- Share cards use the canonical completion metric, stable run identity and local history audit. Stats cards adapt to phone widths and retain dialog keyboard focus. Map exports read current/legacy layouts, wait for rendering, preserve unlock colours and offer retry.
- Quest Cape milestones use canonical quests rather than every optional miniquest. Quest search totals use the filtered set. Journal summaries retain unfinished quests and diary rewards instead of claiming completion prematurely.
- Combat Achievement filters share their counts' predicates. Automatic skill handling includes Sailing, imported legacy modes keep their rules, and stale relay exports cannot overwrite the newly selected profile.
- New ritual records retain actual costs and rewards; older missing facts are marked as estimates. New seeded runs use stable semantic history while existing runs retain their original algorithm.
- Collection Log refresh detects source changes without creating new saved progress identities. Historical conflicts remain preserved for review. Explicit online refresh requests a fresh Wise Old Man snapshot before reading it.
- Collection Log identity provenance stays with each run. Old browser mappings cannot hide newly recorded canonical drops, and entries already known to be ambiguous keep their protection after export, restore or import into another browser. Original counts remain preserved. A historical export without identity metadata or a surviving original cache cannot establish an unknown reused ID's old meaning.

## Private preview: excluded from public guide promotion

The local RuneProof preview contains **24 current F2P quests**, comprising the five public guides plus **19 preview-only guides**. Preview pack text, item flows, source provenance and destination metadata are implemented, but this release preparation does not promote those 19 guides.

Normal production builds must continue excluding the expanded preview payload, including when a preview flag is inherited accidentally. Keep the public release allowlist and guide revisions reviewed; do not solve a release check by broadening that allowlist. Public guide fixes and shared UI/save code may ship without releasing the expanded pack.

The expanded journeys still need actual Vanilla playthrough coverage and the documented route/alternative-method reviews. Learning the Ropes remains an unmapped tutorial reference. Shield of Arrav retains explicit partner confirmations and the documented route limitation. See the [all-F2P preview record](../reviews/2026-09-23-runeproof-all-f2p-preview-verification.md).

## Exclusions and remaining limits

- The rejected scrolling/layout mock-ups are excluded. No compact journal, pagination, unlock overview or new task-workspace design is part of this release.
- Chunked remains unofficial. Earlier map/data corrections are included as existing work, but the recent browser acceptance work was Vanilla-only; do not describe this release as a fresh end-to-end Chunked certification.
- The audit repaired confirmed issues; it does not certify every OSRS fact, item tier, skill-reference row, route or quest journey. Outstanding equipment estimates and unresolved source evidence remain visible.
- Live RuneLite/plugin integration, representative poor-network/offline use and full in-game guide playthroughs are separate evidence. Browser/unit tests do not substitute for them.
- Existing bundle-size/dependency warnings and the entry-bundle performance target remain follow-up work. Bundled catalogues remove separate data-download failures; they do not provide a complete offline app shell.
- No new external announcement, plugin publication, repository setting change or production deployment is authorized by this preparation document.

## Verification record

Historical focused counts overlap and must not be added together. This final candidate is based on `ce55716bfbf43bc73583e1efae70db2bdebf078d` on `codex/fix-audit-findings`. Local verification used Node 25.6.1; GitHub CI uses Node 22. Logs remain locally under ignored `output/`.

| Gate | Candidate result | Evidence |
| --- | --- | --- |
| Scope, generated sources and sensitive-file review | Passed | 355 candidate files; no credential-pattern hits or NUL text files. Source snapshots/generators included; scratch builds, personal saves and mock-ups excluded. Equipment/monster hashes match their manifest. |
| Player-facing changelog | Passed | `npm run changelog:verify`: 194 player-facing files; 23 focused tests. Latest entry inspected in production app. |
| Full repository test suite | Passed | `npm test -- --maxWorkers=2`: 311 files, 4,151 tests passed in 130.41 s. No exclusions beyond repository config. `output/release-prep-tests-final.log`. |
| TypeScript | Passed | `npm run typecheck`; `output/release-prep-typecheck.log`. |
| Offline deterministic content verification | Passed | `npm run content:verify`: diary, chunk/bank/ocean/walking graph, 212 quest IDs, requirement audit, route, walkthrough, pinned QuestHelper and 63 content regression checks. `output/release-prep-content.log`. |
| Production/preview separation | Passed | Build regressions cover production, preview and inherited preview flags. Production selector has exactly five guides; private markers and preview module absent from normal bundle. |
| Production build | Passed | Base `/OSRS-Fate-Locked/`; build `2026-09-24-audit-candidate`; entry `index-DrPauAG4.js`, 239.49 kB gzip. `output/release-prep-build.log`. Existing large-chunk and Browserslist warnings remain. |
| Vanilla browser smoke | Passed within stated scope | Dedicated Release Check Sept24 profile at port 51946. Desktop and 390x844 guide/share layouts; four basic staves T1; Restless Ghost Neck T1 blocks its next action; Sheep Shearer outside Doable without Crafting/supplies; unarmed DPS offers Crush and valid stances; Draynor task exposes Agility lock and does not complete. Stats card has no horizontal overflow; map preview finishes with export enabled. No console errors/warnings observed. Actual PNG download and in-game playthrough were not covered. |
| Save/export/recovery | Passed | Full-suite persistence/bootstrap/schema/recovery tests. Browser reload retains 2/7 guide checks and Neck blocker while Journal stays incomplete. Existing user preview at port 51945 untouched. |
| Collection Log identity | Passed | 194 focused tests across six files. Fresh canonical drops survive unrelated cache; raw IDs reviewed before migration; ambiguous counts retain keys/quarantine across import; safe aliases still work; unreadable evidence remains retryable. Independent second review cleared the corrected migration-order defect. Missing historical provenance cannot be reconstructed. |
| Whitespace and review | Passed | `git diff --check`; independent guide-boundary and identity reviews. No remaining known blocker in reviewed scope. |
| GitHub CI / quality | Pending draft PR | Require successful check on the prepared commit before merge. |
| Public deployment | Not performed | Candidate remains unreleased. Merge, deployment and live-site verification are separate. |

## Release checklist

- [x] Freeze intended scope; exclude scratch files, credentials, personal saves, previews and rejected layout mock-ups.
- [x] Complete and record local gates from [the release checklist](../RELEASE_CHECKLIST.md), including the production-base build.
- [x] Confirm five public guides and no expanded preview payload in production.
- [x] Review source/generator changes and canonical identities; inspect What's New in the built app.
- [x] Smoke-test Vanilla desktop and phone layouts without changing the user's actual progress.
- [x] Record remaining warnings and untested integrations; independent final review found no remaining blocker.
- [ ] Prepare reviewed branch/commit and draft PR; preparation alone does not publish.
- [ ] Require actual GitHub `CI / quality` success during preparation.
- [ ] Merge/deploy only after publication is authorized, then verify the public site and deployed identity separately.
- [ ] Existing manually imported RuneLite bundles need re-export/reimport; paired clients receive new permissions when republished. Verify real integration before claiming live plugin success.

## Supporting review records

- [Initial audit repairs and compatibility decisions](../reviews/2026-09-22-audit-repairs.md)
- [Second audit and map/source repair register](../reviews/2026-09-22-second-audit-repairs.md)
- [Quest equipment readiness](../reviews/2026-09-22-quest-equipment-readiness.md)
- [Community reports and requirement decisions](../reviews/2026-09-23-community-report-fixes.md)
- [Equipment catalogue, rule families and remaining estimates](../reviews/2026-09-23-equipment-catalogue-audit.md)
- [Simplified guide](../reviews/2026-09-23-runeproof-simple-guide-verification.md), [Still needed summary](../reviews/2026-09-23-runeproof-still-needed-verification.md) and [requirement artwork](../reviews/2026-09-23-runeproof-requirement-images-verification.md)
- [Diary equipment, travel and spell exceptions](../reviews/2026-09-24-diary-equipment-mobility-audit.md)
- [Guide persistence, equipment permissions and combat follow-up](../reviews/2026-09-24-vanilla-follow-up-repairs.md)
- [Wiki artwork audit](../reviews/2026-09-24-wiki-artwork-audit.md)
- [Vanilla presentation and completion follow-up](../reviews/2026-09-24-vanilla-presentation-audit.md)
