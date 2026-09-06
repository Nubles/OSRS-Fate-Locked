# RuneProof — quest completion access

RuneProof answers which destinations, items and permissions are required to complete a quest with the current run. It is a standalone, lazy-loaded quest workspace. The old coach, preview
checklists and route-analysis runtime no longer have a player entry point and
are excluded from both production and preview bundles. The ordinary Goal Planner
continues to serve diary and region goals. Legacy files and saves remain as
archives; the replacement does not import their progress by guessing step IDs.

## Current guide coverage

Twelve independently authored, source-reviewed fresh-start guides are included:
Cook's Assistant, Sheep Shearer, Rune Mysteries, Romeo & Juliet, Imp Catcher,
Doric's Quest, Goblin Diplomacy, Witch's Potion, X Marks the Spot, The Restless
Ghost, Ernest the Chicken and Pirate's Treasure.

All 210 catalogue entries also have individually loaded source walkthroughs.
These are explicitly references, not automatically verified guided routes.
Main instructions retain source panel order; related directions stay attached
to their parent action, and Shield of Arrav preserves both named gang routes.
Custom puzzles that need an in-game overlay are labelled. The reader stores a
per-run reading bookmark and never marks actions or quests complete.

Quest Helper provides 207 mapped quests through 208 helper classes. Three Wiki
references cover Learning the Ropes, The Frozen Door and Into the Tombs. The
compiler preserves 11,164 instruction records, including conditional directions.
The remaining 198 quests still need authored permission/item/state conversion
before gaining the tracked guided-route experience.
These guides assume legally obtained starting supplies. Their preparation notes
are not an exhaustive acquisition planner. Partially completed in-game quest
stages are not inferred from a checkmark or item possession. The player records
completed guide actions and finishes quests through the existing Journal flow.

## Boundaries

- `model.ts`: new typed steps, supplies, questions, sources and progress.
- `engine.ts`: pure action evaluation, branches, consumption, undo and validation.
- `travel.ts`: Chunked travel qualification. UI loads canonical chunk-entry gates;
  untyped transport edges are deliberately excluded. Owned surface connectivity
  is checked from the existing start chunk, not claimed as tile-by-tile routing.
  Unsupported transport can leave a valid player route unestablished.
- `storage.ts`: separate per-run, versioned saves, backup/read-back checks,
  validated guide import/export, stale writer and revision overflow rejection.
- `packs.ts`: reviewed opening guides. Changes require source review and tests.
- `RuneProofWorkspace.tsx` and `runeproof.css`: responsive player experience.

No proposed rulebook changes are implemented. Current actual-level, method,
equipment and area permissions remain shared canonical app services.

Guide exports are separate from the ordinary account export. Existing account
exports do not yet include this new auxiliary guide state. This does not affect
canonical progress or rewards. Players can export guides within RuneProof.

## Verification

Pack tests form part of `content:verify`. Engine, storage and travel regressions
cover unsupported requirements, branches, item effects, recovery and profile
isolation. Browser tests exercise real supplies, maps, completion, reload, undo,
mobile layout and locked steps. Bundle tests reject old public/private payloads
and enforce lazy loading of the replacement.

Quest Helper source reference: Zoinkwiz/quest-helper, revision
633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a. Each pack records its exact Java source
path. Quest Helper's source notice is retained at
`docs/QUEST_HELPER_NOTICE.txt`. Map artwork uses the application's existing OSRS
Wiki map asset and coordinate calibration.

## Artwork and app styling

The workspace uses the existing app's dark gray panels, sans-serif typography
and cyan accents. Quest, map, inventory and supply artwork comes from OSRS Wiki
and is served locally from public/runeproof. sources.json records exact source
URLs, dimensions and checksums for all 49 images.
Game artwork belongs to Jagex. There are no generic content-icon fallbacks.

## Whole-catalogue source pipeline

`scripts/quest-helper-export/export.ps1` exports a pinned Quest Helper object
graph using the upstream mock harness and RuneLite 1.12.38. Conditions are not
executed as player facts. Primary exports use Ironman; three explicit Normal
variants and 29 client-dependent construction diagnostics are retained.
`compile-source-graph.mjs` produces content-addressed public reference files and
private experimental graphs. Offline graphs are losslessly gzip-compressed with
round-trip hashes and never bundled into the app. Copyright notices ship beside
the source reader. Generated data can be checked with the compiler's `--check`.

`sourceGraph.ts` implements three-valued conditions and ordered branches for
future reviewed graph conversion. Its private compiled actions retain unknown
permissions; the player reader does not present them as verified actions.
Source item highlight lists are not interpreted as acquisition prerequisites.

Large guide writes are rejected before primary/backup mutation. Source reading
bookmarks are separate from canonical progression and guide inventory saves.
Chunked travel still requires established surface connectivity; a ferry checkmark
does not prove a transport route. Keys with confirmed retention remain held.

## Primary experience: completion access

All 210 quests open on QuestAccessPanel. questAccess.ts adapts the shared
canonical eligibility result, exact fixed destinations and complete alternative
routes; it does not invent a second readiness verdict. Standard displays its area
permissions, while Chunked displays exact required chunks and their ownership.
Locked chunks and their map outlines are red. Maps reset when the quest or run
unlocks change. Quantities and alternatives remain intact in original item clauses.
Quest-specific partner, spellbook, favour and other manual requirements are shown.

itemSourceEvidence.ts matches only unambiguous complete item names, optionally
with a leading quantity. It shows known source chunks and trustworthy missing
gates, but never calls location ownership proof of legal acquisition or use.
Complex clauses, unreviewed operations and incomplete sources remain unresolved.
No collection-log entry or old guide inventory is treated as current possession.
Walkthroughs and tracked step sessions are secondary supporting information.
