# Required equipment and quest readiness — 22 September 2026

The reported defect was reproduced: The Restless Ghost was marked doable, and its completion action accepted, with Neck tier 0. Official OSRS level requirements were checked, but permission to wear required quest equipment was not modeled.

## Repair

Quest data now has a separate `equipmentRequirements` field. The canonical eligibility check compares every required slot and tier with the current Fate unlocks. A missing tier blocks automatic readiness and manual completion, and explains the required item/step. This does not require pre-owning an amulet or weapon supplied during the quest. Completed quests remain completed in existing saves.

The same result reaches the doable list, Journal cards and summary, completion actions, advisors, map permissions and RuneLite export. Quest and prerequisite plans expose missing Equipment unlocks separately from OSRS skills. RuneProof snapshots and cache identities now include equipment, and its final readiness and confirmation paths preserve these blockers.

The Restless Ghost's RuneProof wear action also has an explicit Neck T1 gate in both the public and reviewed walkthroughs. Starting the quest and collecting the amulet remain possible; the instruction to wear it and speak to the ghost stays blocked until the slot unlocks. The public and preview guide revisions were advanced so older confirmations cannot silently carry over to the changed action.

## Source-backed equipment entries

This is a bounded review of mandatory worn or wielded equipment, not a claim that every quest's operational requirements have been audited.

| Quest | Required Fate equipment |
|---|---|
| [The Restless Ghost](https://oldschool.runescape.wiki/w/index.php?title=The_Restless_Ghost&oldid=15331162) | Neck T1 — ghostspeak amulet |
| [Black Knights' Fortress](https://oldschool.runescape.wiki/w/index.php?title=Black_Knights%27_Fortress&oldid=15350628) | Head T1 and Body T1 — guard disguise |
| [Pirate's Treasure](https://oldschool.runescape.wiki/w/index.php?title=Pirate%27s_Treasure&oldid=15315445) | Body T1 — white apron |
| [Demon Slayer](https://oldschool.runescape.wiki/w/index.php?title=Demon_Slayer&oldid=15309237) | Weapon T2 — Silverlight |
| [Lost City](https://oldschool.runescape.wiki/w/index.php?title=Lost_City&oldid=15326723) | Weapon T2 — dramen staff |
| Plague City | Head T1 — gas mask |
| Biohazard | Head T1, Body T1 and Legs T1 — gas mask and medical disguise |
| The Tourist Trap | Body T1, Legs T1 and Boots T1 — slave disguise |
| Death to the Dorgeshuun | Head, Cape, Neck, Body, Legs, Gloves and Boots T1 — full H.A.M. disguise |
| Tower of Life | Head, Body, Legs and Boots T1 — builder outfit |
| Between a Rock... | Head T1 — gold helmet |
| Ghosts Ahoy | Head T1 and Neck T1 — bedsheet and enchanted ghostspeak amulet |
| Animal Magnetism | Neck T1 — ghostspeak amulet for the old crone |
| Misthalin Mystery | Weapon T1 — killer's knife |

All 14 entries have refreshed pinned Wiki references and requirement fingerprints in the existing quest audit. Current Wiki evidence and item tier results are retained in [the evidence folder](../../../audit/quest-equipment-2026-09-22/). Silverlight and the dramen staff use the current GearService's T2 assignments; zero-bonus quest disguises and items absent from its combat catalogue use the reviewed T1 slot floor.

Inventory-only and optional equipment was deliberately excluded: Waterfall Quest permits carrying the amulet, Prince Ali Rescue's disguise is worn by Ali, and Ghosts Ahoy allows prepared nettle tea without glove use. Generic ghostspeak requirements with a Morytania diary/legs alternative were not converted into unconditional Neck gates.

## Validation

Final validation completed on 23 September 2026:

- Full suite: **276 files, 3,678 tests passed** (`full-tests-final.log`).
- Typecheck, generated content verification, changelog verification and production build passed. Reviewed walkthrough sources regenerate cleanly. The build retains Vite's large-chunk warning; the eager entry is 242.32 kB gzip, above the older roadmap target.
- Independent read-only review found no blocking issue in canonical eligibility, callers, cache identity, completed-quest precedence or the typed wear-action gate.
- Fresh-profile browser verification on port 51946 completed onboarding and checked Chunked mode. The Journal displayed the Neck T1 ghostspeak requirement, and RuneProof displayed the same completion blocker while still allowing the first preparation action. No browser warnings or errors were recorded.
- The existing Vanilla profile at [the local app](http://127.0.0.1:51944/) places The Restless Ghost under **Reachable — reqs left**, outside **Doable now**, with the exact missing Neck T1 reason. Its quest card shows **Almost — Neck T1: Wear the ghostspeak amulet to speak to the ghost**. The browser was left on that filtered card; no existing unlocks or completions were changed.
- Production build `1790118444465`, entry `index-D2dJzl7Q.js`, was confirmed loaded in the browser. The temporary verification tab/server was closed; port 51944 remains running.

During integration, the new Strategy Guide and wear-action regressions initially failed before their fixes. Two older positive-control fixtures also needed their mandatory outfit unlocks: Tower of Life and Black Knights' Fortress. A later full run caught `RuneProof production bundle boundary > separates the private preview payload from the normal production bundle` expecting the former Restless Ghost revision (`expected [true, ...] to deeply equal [true, ...]`, one false result). Updating that pinned test marker to the regenerated reviewed revision restored the private/public bundle checks. All failures are resolved in the final full-suite result; no assertions were removed.

Evidence and verification logs are in [the evidence folder](../../../audit/quest-equipment-2026-09-22/). No public deployment or save reset is included.
