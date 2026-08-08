# RuneProof Local Preview Port Design

**Status:** Approved conversational design

**Date:** 2026-08-08

**Scope:** Port the transferred RuneProof quest-route feature into current FLIM as a local-only, explicitly enabled preview

## 1. Context

RuneProof was previously removed from FLIM after its first production design produced broad verification warnings instead of useful route answers. The transfer package at `C:\Users\alexa\Downloads\flitest-main\RuneProof-Transfer-2026-08-02.zip` contains a later redesign built from that rollback point. The replacement is an item-route and verified-walkthrough feature inside the existing Goal Planner, not a separate proof product.

The transfer package has a clear source boundary:

- base commit `69d07f36dce6f44544a8cde137001e4b0ce32c92`;
- RuneProof head `674a97730c4a671648c18a3c6715d35645975148`;
- 85 RuneProof commits and 99 changed or added files; and
- matching SHA-256 hashes for the history bundle, complete patch, final-files archive, and commit-patches archive.

Current FLIM shares the transfer's Git ancestry but is 165 commits beyond the base. Seventeen files were changed by both current FLIM and RuneProof, including the Goal Planner, game context, save validation, chunk services, and package scripts. The transfer must therefore be adapted to current FLIM rather than extracted over it wholesale.

## 2. Product Decision

The first milestone is a safe compatibility port with these fixed boundaries:

- local development access only;
- activation only when `VITE_RUNEPROOF_PREVIEW=1`;
- exactly four reviewed pilot quests;
- current FLIM behavior remains authoritative wherever the transfer overlaps it;
- the transferred preview experience remains functionally intact; and
- visual, wording, and content-expansion refinements follow only after the port is stable.

The four pilot quests are:

1. Cook's Assistant
2. Daddy's Home
3. Doric's Quest
4. Elemental Workshop I

## 3. Goals

1. Restore the final transferred RuneProof engine, reviewed data, walkthroughs, route map, requirement checklist, and tests against current FLIM.
2. Integrate RuneProof into the current Goal Planner without restoring obsolete shared application files.
3. Keep the feature absent unless an explicit local preview build enables it.
4. Keep preview-only walkthrough definitions and source wording out of a normal production build.
5. Preserve existing runs, saves, exports, sync payloads, integrity history, and non-RuneProof behavior.
6. Establish a verified baseline from which player-facing refinement can proceed safely.

## 4. Non-Goals

This milestone does not:

- enable RuneProof publicly or add an in-app beta switch;
- deploy a preview for external testers;
- add quests beyond the four reviewed pilots;
- promote any walkthrough from `PREVIEW_ONLY` to `APPROVED`;
- change FLIM's main save format for RuneProof;
- redesign the transferred panel, route map, cards, legends, or source display;
- remove the evidence dropdown or data-note presentation;
- expand RuneProof to diaries, activities, regions, or free-form goals; or
- refactor unrelated current FLIM systems.

## 5. Porting Strategy

### 5.1 Selected approach: hybrid feature-first port

Import the final state of files owned by RuneProof, then manually adapt its integration points to current FLIM. Feature-owned code includes:

- `utils/questRoutes/` and `utils/questWalkthroughs/`;
- `components/questRoutes/`;
- the reviewed quest-item, recipe, walkthrough, and source data;
- RuneProof verification and source-pipeline scripts;
- the transferred feature tests; and
- the original RuneProof design and implementation records where they remain useful provenance.

The port must not replay obsolete versions of shared application files over current FLIM. Current implementations of the Goal Planner, game context, save handling, chunk services, types, content checks, and build scripts remain the starting point. RuneProof integrates through narrow additions or adapters.

### 5.2 Rejected approaches

**Replay all 85 commits.** This preserves granular history, but the same shared files would conflict repeatedly across a branch that is 165 current-FLIM commits behind. It adds conflict work without improving the final compatibility boundary.

**Rebuild only from the specifications.** This gives maximum architectural freedom, but discards tested edge cases and is slower and riskier than adapting the final transferred implementation.

### 5.3 Conflict rule

When a transferred assumption conflicts with current FLIM behavior:

1. Preserve current FLIM semantics.
2. Add a narrow RuneProof adapter at the boundary.
3. Update transferred tests only when they assert an obsolete integration detail, never merely to silence a behavioral failure.
4. Keep the solver's deterministic route semantics and reviewed-data boundaries intact.

## 6. Architecture

### 6.1 Preview gate

`runeProofAvailability(import.meta.env)` remains the single availability decision. This milestone recognizes `VITE_RUNEPROOF_PREVIEW=1` and otherwise returns `OFF`; public activation is outside scope.

The Goal Planner mounts RuneProof only when:

- availability is `PREVIEW`;
- the selected target is a quest;
- that quest has a reviewed RuneProof item definition; and
- its pilot walkthrough has a matching preview release record.

Unsupported quests continue through the existing Goal Planner without a disabled, empty, or warning-only RuneProof panel.

### 6.2 Feature units

The port retains the transfer's bounded units:

- **Requirement catalogue:** owns reviewed, canonical quest-item requirements.
- **Source and recipe catalogues:** expose exact chunk sources and transformations.
- **Account requirement adapter:** derives route facts from current FLIM unlock, reachability, merchant, mobility, skill, and quest rules.
- **Route resolver and ranker:** deterministically enumerate, block, combine, and rank current-chunk and missing-chunk routes.
- **Walkthrough evaluator:** checks reviewed quest actions against the account snapshot and resolved locations.
- **Presenters:** convert engine results to player-facing status, routes, blockers, and walkthrough actions.
- **Map projector:** creates preparation and quest-path layers from presented results.
- **Goal Planner integration:** supplies the current account snapshot and renders the feature without owning solver logic.

Each engine and projector remains pure for a fixed input snapshot. React components own only interaction and presentation state.

### 6.3 Public-source boundary

Preview walkthroughs load only through the preview catalogue boundary. A normal build uses the public-safe catalogue, which contains no pilot definitions until a later release decision explicitly promotes them.

The build and test boundary must prevent preview-only walkthrough definitions, reviewed source wording, and raw source-review data from entering the normal production bundle. Setting the preview variable is an explicit local build decision, not a runtime user preference.

## 7. Runtime Data Flow

1. The player selects a quest in the existing Goal Planner.
2. The preview gate and reviewed-catalogue lookup decide whether RuneProof is present.
3. The integration layer creates an immutable account snapshot from current FLIM state: chunks, skills, completed quests, unlocks, merchants, mobility, and other canonical access facts.
4. The route analyzer evaluates reviewed item requirements against exact sources and recursive recipes.
5. The walkthrough evaluator checks reviewed quest actions and location evidence against the same snapshot.
6. Presenters build player-facing statuses, blockers, routes, actions, and map labels.
7. The map projector creates separate preparation and quest-path layers.
8. The RuneProof panel renders the checklist, map, walkthrough, and route cards.
9. Confirmed items are applied as a presentation and remaining-work filter; they do not assert or mutate canonical game unlocks.

No RuneProof analysis writes to game history or alters progression state.

## 8. Preview Confirmation Storage

The transfer stored confirmed quest items in `GameState.questItemChecks` and described that addition as save version 4. Current FLIM already uses save version 4 for newer state without that field. Reusing the version number with a different required shape would create an unsafe schema collision.

For this local preview milestone, confirmed quest items use separate preview-only storage.

### 8.1 Storage shape

- Storage key: `fate_runeproof_preview_checks_v1:<runId>`.
- Stored value: an object whose own keys are reviewed quest IDs and whose values are arrays of confirmed reviewed item keys.
- A raw stored value longer than 64 KiB is discarded before JSON parsing.
- Only `PLAYER_OBTAINED` requirements from the current reviewed catalogue are retained.
- Normalization can retain no more quest entries than the current reviewed catalogue and no more item keys for a quest than that quest's reviewed `PLAYER_OBTAINED` requirements.
- Unknown quests, inherited properties, unknown item keys, duplicates, and malformed arrays are discarded during normalization.
- Empty quest arrays are removed; an entirely empty record removes the storage key.

### 8.2 Behavior

- Confirmation state survives a reload and remains isolated by run ID.
- Switching profiles or starting a new run selects a different storage key.
- Confirming an item never modifies `GameState`, the save version, exports, backups, sync codes, relay payloads, or integrity history.
- A storage read failure yields an empty confirmation set.
- A storage write failure keeps the current in-memory interaction usable for the session and does not affect the run.
- Corrupt preview storage may be replaced or removed without touching any main FLIM storage key.

A future public design may migrate this state into the main save format with a new, explicit save version. That decision is not implicit in this port.

## 9. Preview Experience

RuneProof remains inside the existing Goal Planner. It has three coordinated views:

1. **Requirement checklist.** Reviewed requirements remain visible and reversible when confirmed.
2. **Preparation and walkthrough details.** Ranked routes, verified quest actions, blockers, and alternatives explain what can be done now and what is missing.
3. **Two-layer route map.** Preparation and quest-path layers show the selected main path, preserve full details in the selected-chunk panel, and retain the existing handoff to FLIM's World map.

Quest status uses this conservative precedence:

1. A known blocker produces **Cannot complete yet**.
2. With no known blocker, unresolved evidence produces **Analysis incomplete**.
3. **Ready now** appears only when every machine-relevant check passes.

RuneProof reports current known conditions and never labels a route or quest impossible.

The compatibility milestone intentionally retains the transferred evidence dropdown, data notes, map-label format, blocked overlay styling, and repeated blocker presentation. These are known preview-quality issues, not accepted public-release UX.

## 10. Failure Isolation

RuneProof failures must not take down or corrupt the Goal Planner.

- An incomplete source affects only the relevant item and produces an incomplete-data state.
- An ambiguous or unmapped walkthrough action affects only the walkthrough status and relevant action.
- An out-of-bounds map chunk remains available in textual detail without a broken marker.
- A map-image failure leaves checklist, route, and walkthrough details usable.
- Invalid preview confirmation storage falls back to an empty normalized state.
- An unexpected panel-level exception produces a concise preview-unavailable fallback while the ordinary Goal Planner remains usable.

No failure path writes substitute data into the player's run.

## 11. Verification Strategy

### 11.1 Feature-unit verification

Port and run the transferred tests covering:

- route models, source indexing, access gates, recursion, cycles, missing chunks, ranking, and presentation;
- reviewed item and recipe catalogue integrity;
- walkthrough source transformation, release attribution, location resolution, action evaluation, and presentation;
- route-map geometry, projection, focus behavior, and accessibility;
- requirement checklist derivation and confirmed-item filtering; and
- source encoding and public-bundle boundaries.

### 11.2 Compatibility verification

Add or adapt tests proving:

- RuneProof is absent with the preview variable off;
- it appears only for the four supported quests with the preview variable on;
- unsupported quests retain current Goal Planner behavior;
- current account facts feed the resolver through canonical FLIM rules;
- preview confirmation storage is per run, normalized, reversible, reload-safe, and isolated from `GameState`;
- the World-map handoff still consumes a selected canonical chunk once;
- stale quest, map-focus, and confirmation state cannot leak between selected quests or runs;
- normal save validation and migration remain unchanged; and
- preview-only walkthrough data and source wording are absent from the normal production bundle.

### 11.3 Full-project verification

The acceptance run includes:

- the complete Vitest suite;
- TypeScript type-checking;
- content verification, including RuneProof route and walkthrough checks;
- a normal production build with the preview variable absent; and
- a preview production build with `VITE_RUNEPROOF_PREVIEW=1`.

### 11.4 Manual local smoke test

Exercise all four quests in the Goal Planner and verify:

- checklist confirmation and reversal;
- persistence across reload for the same run and isolation across runs;
- preparation and quest-path map layers;
- map selection, focus, pan/zoom, selected-chunk details, and World-map handoff;
- complete, blocked, and incomplete statuses;
- behavior with corrupt preview storage and a failed map image; and
- disappearance of RuneProof after restarting without the preview variable.

## 12. Acceptance Criteria

The milestone is complete when:

1. The final transferred RuneProof behavior is available locally for the four pilots behind `VITE_RUNEPROOF_PREVIEW=1`.
2. Normal Goal Planner behavior is unchanged when preview is off or a quest is unsupported.
3. Preview confirmations never enter or change the main save and synchronization surfaces.
4. All ported RuneProof tests and new compatibility tests pass.
5. Existing Goal Planner, persistence, bank, chunk-location, content, and release-boundary tests pass.
6. The full test, type-check, content-verification, normal-build, and preview-build commands succeed.
7. Manual smoke testing covers every scenario in section 11.4.
8. No preview-only walkthrough definition or source wording appears in a normal production bundle.
9. No quest coverage, public release, save migration, or presentation refinement is mixed into this milestone.

## 13. Follow-On Refinement Backlog

After the compatibility baseline is accepted, the next design cycle may address the transfer's recorded polish requests:

- remove the player-facing **Data note** section while retaining diagnostics internally;
- remove technical missing-evidence sentences from the player view;
- make blocked orange chunk overlays translucent while retaining a clear boundary or pattern;
- compress map step labels into ranges such as `1–9, 12–14, 16`;
- retain complete step numbers and names in selected-chunk details and accessible labels;
- decide whether to remove the entire **Evidence and source wording** dropdown from the player interface;
- reduce repeated blocker text and simplify the legend;
- emphasize the next actionable step and soften completed or confirmed steps; and
- use one player-friendly location fallback only where the absence of a map action would otherwise be confusing.

Each refinement remains separate from the compatibility port so its behavior and visual impact can be reviewed against a stable preview.
