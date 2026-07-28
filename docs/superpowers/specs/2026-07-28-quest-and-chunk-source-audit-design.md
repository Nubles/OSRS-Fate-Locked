# Quest, Miniquest, and Chunk Source Audit Design

**Date:** 2026-07-28
**Status:** Approved for implementation planning
**Repository:** `Nubles/OSRS-Fate-Locked`

## Goal

Build a source-pinned, reviewable chunk-data pipeline and use that trusted
evidence to audit every quest and miniquest represented by Fate Locked. Correct
machine-enforced access requirements without weakening completion integrity,
changing key balance, or silently treating incomplete chunk evidence as proof.

## Approved Scope

This work has two ordered deliverables:

1. Verify Fate Locked's transformation of the authoritative OSRS Chunk Picker
   export and refresh the committed snapshot from an exact upstream revision.
2. Audit every official quest and miniquest against the verified chunk snapshot
   and current OSRS Wiki evidence, then route all affected app surfaces through
   the same canonical eligibility result.

The current model contains 207 journal entries: 188 quests and 19 miniquests.
Those are baseline counts, not permanent constants. The audit must reconcile
Fate Locked against the current official quest and miniquest lists at review
time. A newly released official entry must be added or explicitly classified
as pending; an obsolete or duplicate entry must be migrated deliberately.

The audit covers:

- required regions and exact locations;
- Chunked-mode chunk alternatives;
- skill, combat, quest-point, and prerequisite requirements;
- guild requirements and alternative access routes;
- manual requirements that the app already supports;
- item and travel-route evidence as non-blocking audit notes;
- quest and miniquest completion decisions and their downstream consumers.

Official subquests, such as the Recipe for Disaster chapters, are audited as
steps of their parent quest. They do not become separate Fate Locked completion
or key-roll entries unless a separately approved design changes that model.

## Non-Goals

- Do not introduce a completion override or allow manual attestation to bypass
  failed machine requirements.
- Do not add inventory or item-possession tracking in this release.
- Do not change quest or miniquest key rates, Fate Points, pity behavior,
  seeded randomness, or any other balance rule.
- Do not independently re-prove every upstream monster, NPC, object, and drop
  fact from first principles. The source-parity audit proves what Fate Locked
  imported, normalized, excluded, or could not resolve. Suspicious upstream
  facts are separately flagged for OSRS Wiki review.
- Do not make CI depend on live GitHub or OSRS Wiki availability.

## Confirmed Findings

### Quest requirements

- `Witch's Potion` is currently enforced as all of Asgarnia even though its
  unavoidable start and completion are in Rimmington. The Port Sarim eye-of-newt
  route is optional when the player already possesses an eye of newt.
- `Murder Mystery` is currently enforced as all of Kandarin even though its
  required activity is at Sinclair Mansion in the Seers' Village area.
- `QuestData.locations` exists, but the canonical evaluator currently combines
  `regions` and `locations` as mandatory `AND` requirements. Adding an exact
  location without an explicit policy would therefore preserve the incorrect
  coarse-region gate.
- Completion is strict. Manual attestation confirms only declared manual checks
  after machine eligibility passes; it cannot override region, skill, combat,
  or prerequisite blockers.

### Coverage

- Fate Locked currently models 207 combined quest-list entries.
- 3 entries have hand-authored exact location requirements.
- 204 entries are region-only.
- In the current committed chunk snapshot, 187 region-only entries have quest
  chunk evidence and 49 resolve to one mapped place.
- Single-place evidence is a high-value audit lead, not permission to rewrite a
  record automatically.

### Chunk source

The authoritative source is:

- repository: `source-chunk/chunk-picker-v2`;
- default and deployed branch: `gh-pages`;
- export: `chunkpicker-chunkinfo-export.json`;
- inspected upstream commit:
  `ba2fcebf8b26c84c74f8d9ab328a0ede802be926`;
- inspected export blob:
  `6674e5c62cd7a6ec90267def278aca5bc1f05a06`;
- inspected raw SHA-256:
  `95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167`.

Regenerating from that revision is not byte-identical to Fate Locked's current
full snapshot. The observed semantic drift is limited to drop and skill-yield
data, including Maggot King and Stingray drops, Tarnished-item Crafting yields,
and several Slayer rates. Quest locations, chunk contents, connections, entry
gates, banks, and overlays did not differ in the structural comparison. The
lightweight RuneLite chunk file is semantically identical and differs only in
file formatting.

These findings are a starting point. Implementation must regenerate and report
the final diff again from the pinned source rather than trusting this prose.

## Source Authority and Evidence

### Chunk facts

The pinned Chunk Picker export is the primary source for:

- walkable chunks and chunk sections;
- per-chunk monsters, NPCs, objects, shops, spawns, quests, diaries, and clues;
- transport connections;
- chunk-entry requirements;
- entity requirements;
- Slayer masters and task tables;
- shortcuts, drops, shops, overlays, skill yields, banks, and tags.

The OSRS Wiki is the secondary source for resolving suspicious or ambiguous
entries, especially quest routes, underground entrances, instances, and named
locations that do not map directly to numeric chunk identifiers.

### Quest and miniquest facts

Each audited record must cite:

- a permanent OSRS Wiki revision or equivalent stable source reference;
- the pinned Chunk Picker commit used for chunk evidence;
- the review date;
- any discrepancy between the two sources;
- a concise reviewer note when items, travel, instances, or partial-completion
  routes are intentionally not machine-enforced.

The official quest list and miniquest list define coverage. Quest points alone
must not be used to infer the kind because special or future content could make
that assumption brittle.

## Architecture

### 1. Pinned chunk source manifest

Add a committed manifest that contains:

- repository, branch, upstream commit, export blob SHA, and raw SHA-256;
- generator policy version and output schema version;
- generated output hashes;
- source and output counts by category;
- the timestamp of human review;
- the upstream URL and attribution.

Normal generation reads the pinned commit, not the moving `gh-pages` URL. An
explicit source-update command discovers a newer upstream commit, downloads it
to a temporary location, verifies its hash, regenerates outputs, and presents
the manifest and audit diff for review.

### 2. Transformation ledger

The chunk generator must produce a deterministic audit ledger. Every relevant
upstream record is accounted for as one of:

- `imported`: preserved without semantic change;
- `normalized`: preserved after a documented name, section, or coordinate
  normalization;
- `excluded`: intentionally omitted with a stable reason code;
- `unresolved`: not safely transformable and requiring review.

The ledger covers every consumed source category. It also reports:

- source chunks absent from `walkableChunks`;
- walkable chunks without content;
- non-walkable connector chunks retained in the transport graph;
- section content merged into its base chunk;
- name cleaning and collisions caused by `#` variants or quest subpaths;
- named `taskUnlocks` locations that lack numeric chunk coordinates;
- sub-area suffixes collapsed to base chunk IDs;
- quest-entry requirements removed by the broad-gate sanity policy;
- duplicate and conflicting quest roles, where `first` wins over `step`;
- lightweight RuneLite caps: 6 monsters and 8 entries for shops, farms, and
  points of interest per chunk;
- content excluded from the lightweight file but retained in the full file.

No exclusion may be silent. The current `MAX_CHUNKS_PER_REQ = 150` protection
remains conservative, but every suppressed requirement and affected chunk count
must appear in the ledger.

### 3. Deterministic offline verification

The repository commits:

- a compressed copy of the exact verified upstream export under
  `data/sources/chunkpicker-chunkinfo-export.json.gz`, allowing the full transform to run offline without adding the
  7.8 MB uncompressed JSON to normal application assets;
- the compact full chunk snapshot;
- the lightweight RuneLite snapshot;
- the source manifest;
- the transformation ledger or a deterministic compact summary sufficient to
  reproduce every count and exclusion.

CI does not fetch live sources. It decompresses the committed verified export
to a temporary location, validates its raw hash, and requires byte-identical
full and lightweight regeneration. It also validates schema versions, coverage
equations, reason codes, and reviewed count floors.

A separate networked source-check command reports whether upstream moved. An
upstream change is informational until a maintainer runs the explicit update
flow and reviews the resulting data diff.

### 4. Quest access policy

Preserve the existing quest IDs and completion arrays. Add `kind: 'quest' | 'miniquest'` and an explicit access policy to every runtime record. This avoids
inferring miniquests from quest points and removes the ambiguity between
descriptive geography and enforced requirements:

- `regions`: enforce the coarse `regions` list;
- `locations`: enforce exact `locations`; `regions` remains descriptive;
- `regions-and-locations`: enforce both when the audited route genuinely needs
  both.

`oneOf` continues to represent alternative complete access routes. The
canonical evaluator interprets the policy; components do not combine fields
themselves.

There is no implicit access-policy default: auditing a record includes choosing
its policy. Validation rejects:

- any record without `kind` or `accessPolicy`;
- locations without a policy;
- `locations` policy without location definitions;
- `regions-and-locations` without both requirement sets;
- duplicate location IDs;
- location definitions without standard areas or Chunked-mode coordinates;
- standard-area names absent from the canonical area policy;
- chunk coordinates absent from the verified chunk universe unless explicitly
  classified as an entrance, instance, or intentional external coordinate.

For the two confirmed corrections:

- `Witch's Potion` uses `locations` and requires Rimmington.
- `Murder Mystery` uses `locations` and requires Sinclair Mansion/Seers'
  Village.

### 5. Quest and miniquest audit registry

Add a machine-readable audit registry keyed by canonical journal ID. Each entry
contains:

- `kind`: `quest` or `miniquest`;
- `status`: `verified`, `verified-with-notes`, or `unresolved`;
- stable source references and review date;
- expected access policy and a deterministic fingerprint of the runtime
  machine requirements;
- chunk evidence summary;
- non-blocking item, travel, instance, or partial-completion notes;
- discrepancy and conservative-retention notes where applicable.

Coverage validation requires a one-to-one relationship between the official
reviewed coverage list, `QUEST_DATA`, and the registry. Missing, duplicate,
renamed, or extra entries fail with specific diagnostics.

`unresolved` entries retain the conservative current runtime requirement. They
may not be automatically loosened from chunk activity evidence.

### 6. Canonical eligibility data flow

The data flow is:

1. `QUEST_DATA` supplies machine requirements.
2. The audit registry proves those requirements were reviewed.
3. The canonical eligibility evaluator applies access policy, skills, combat,
   quest points, prerequisites, alternatives, and manual checks.
4. Quest Log, quest doability, completion, Goal Planner, advisor and journal
   output, chunk permissions, and unlock-impact calculations consume that
   canonical result or its shared blocker helpers.
5. Completion rejects failed machine eligibility before changing progress.
6. A successful quest or miniquest completion records the existing completion
   ID and performs the existing key roll exactly once.

No consumer may independently reconstruct region, location, skill, or
prerequisite eligibility.

## Quest and Miniquest Review Method

Review all entries, not only the single-place candidates.

For each entry:

1. Confirm whether it is an official quest or miniquest.
2. Confirm start, unavoidable steps, completion location, and any remote route.
3. Compare OSRS Wiki evidence with every Chunk Picker `first` and `step` chunk.
4. Verify skills, combat level, quest points, prerequisites, guild gates, and
   alternative routes.
5. Identify item sources, teleports, transport, underground areas, instances,
   and partial-completion conditions.
6. Decide the minimal machine-enforceable access requirement supported by both
   the game rules and Fate Locked's unlock model.
7. Record untracked considerations without converting item possession into a
   blocker.
8. Mark discrepancies and retain conservative requirements where evidence is
   incomplete.

Chunk evidence never grants access by itself. Activity chunks can omit remote
items, travel routes, quest instances, prerequisite areas, or transitions
represented outside the base chunk.

## Completion Integrity

Completion remains strict:

- machine blockers always reject completion;
- manual confirmation applies only to declared manual checks after machine
  eligibility passes;
- there is no warning-based requirement override;
- failed completion cannot add the quest or miniquest ID;
- failed completion cannot generate a key roll;
- repeated completion cannot generate another key roll.

The history schema is unchanged because no override event is introduced. The
existing roll history and integrity chain remain authoritative.

## Compatibility and Migration

- Quest and miniquest IDs do not change.
- Existing completed IDs remain completed even if requirements are corrected.
- Existing saves need no schema migration for the new audit metadata or access
  policy because both are static application data.
- Quest Point totals continue to count only records with `kind: 'quest'` and
  their actual quest points; miniquests remain excluded from Quest Point Cape
  requirements.
- Existing key-rate and difficulty assignments remain unchanged unless a
  separate balance change is explicitly approved.
- RuneLite exports consume regenerated chunk facts but retain their current
  bundle contract unless verification proves a contract change is necessary.

## Error Handling

Generation and validation fail clearly when:

- the upstream commit, blob, or raw hash does not match the manifest;
- source JSON is malformed or required top-level fields are missing;
- output hashes do not match the committed manifest;
- a source category shrinks past its reviewed floor;
- imported, normalized, excluded, and unresolved counts do not reconcile with
  source counts;
- exclusions use unknown or empty reason codes;
- normalization creates an unreviewed collision;
- a quest or miniquest lacks an audit record or stable source;
- the official coverage list and local IDs differ;
- an exact-location policy is structurally invalid;
- two downstream consumers disagree with canonical eligibility.

Network errors in the optional source-update command leave committed files
unchanged and identify the failing URL and stage. The normal application and CI
continue to use the last reviewed committed snapshot.

## Testing Strategy

### Chunk source tests

- Pin and validate repository, commit, blob, and raw SHA.
- Assert category-level source and output totals.
- Assert the transformation accounting equation for every category.
- Exercise every exclusion and normalization reason with focused fixtures.
- Prove `first` quest roles beat `step` without losing locations.
- Prove sections merge without double counting.
- Prove non-walkable connectors survive in the connection graph.
- Prove named/unmappable locations and broad quest gates are reported.
- Prove repeated generation from the same source is byte-identical.
- Prove the lightweight RuneLite snapshot contains only documented capped
  subsets of the full snapshot.

### Quest and miniquest tests

- Require complete one-to-one audit coverage for all reviewed official entries.
- Require the current baseline split of 188 quests and 19 miniquests until the
  official reconciliation intentionally updates it.
- Pin Witch's Potion to Rimmington and Murder Mystery to Sinclair
  Mansion/Seers' Village.
- Test standard and Chunked modes for exact locations, additional regions, and
  alternative routes.
- Test that coarse descriptive regions do not remain hidden blockers under the
  `locations` policy.
- Test every audited machine-requirement fingerprint.
- Test that unresolved entries retain conservative requirements.
- Test Quest Point totals and Quest Point Cape exclusions for miniquests.

### Cross-surface and integrity tests

Use shared snapshots to prove Quest Log, doability, completion, Goal Planner,
advisor and journal output, chunk permissions, and unlock-impact calculations
agree before and after relevant unlocks.

Test that:

- invalid completion returns its canonical blockers;
- manual attestation cannot bypass a machine blocker;
- valid completion records progress once;
- valid completion triggers one existing key roll;
- rejected and repeated completion trigger no key roll;
- old saves load with completed quest and miniquest IDs unchanged;
- RuneLite export remains valid after chunk regeneration.

Final verification runs the complete test suite, type-check, content
verification, deterministic generation checks, save migration tests, RuneLite
bundle tests, and production build.

## Acceptance Criteria

The work is complete when:

- the current authoritative Chunk Picker revision is pinned and regenerated;
- every consumed upstream record is accounted for by the transformation ledger;
- the observed stale drop and skill-yield data is reviewed and refreshed;
- all official quests and miniquests are reconciled with Fate Locked;
- every local quest and miniquest has a reviewed audit record;
- Witch's Potion and Murder Mystery enforce their exact audited locations;
- no unresolved entry is automatically loosened;
- all named downstream surfaces agree with canonical eligibility;
- completion remains strict and key balance is unchanged;
- offline CI and the full release verification gate pass.
