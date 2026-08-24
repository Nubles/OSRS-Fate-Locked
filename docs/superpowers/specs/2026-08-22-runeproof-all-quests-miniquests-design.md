# RuneProof All Quests and Miniquests

**Date:** 2026-08-22

**Status:** Approved for implementation planning

**Scope:** Expand RuneProof from its five public F2P quest packs to the complete versioned OSRS catalogue of 210 normalized objectives: 191 quests and 19 miniquests

## 1. Context

RuneProof currently exposes five independently authored public F2P guides: Cook's Assistant, Sheep Shearer, The Restless Ghost, Rune Mysteries, and Imp Catcher. Its shared coach can evaluate reviewed item routes, action dependencies, chunks, blockers, alternatives, run-scoped confirmations, and temporary-map context without mutating canonical Journal progression or awarding Keys, Fate rolls, or rewards.

The repository's pinned quest-list snapshot contains 210 normalized current identities: 191 quest records and 19 miniquests. The source parser reports 192 quests because Recipe for Disaster is represented by the repository's existing normalized parent-step IDs. The 210 normalized identities are the authoritative RuneProof scope for this programme.

The existing foundation is intentionally strict but cannot scale unchanged. Membership is hard-coded to a fixed 23-entry F2P roster; reviewed root item requirements cover only eight raw walkthroughs; the generated preview produces only five selectable strategies; requirements do not model several members-quest conditions; branches are not first-class; and progress uses two catalogue-wide records capped at 65,536 characters.

This design generalizes RuneProof into a source-backed quest-pack platform while preserving the accepted player experience and safety boundaries. It does not authorize public promotion of any new pack.

## 2. Product Decision

RuneProof will use a **generic quest-pack platform with independently curated packs**.

The platform will compile all packs through one versioned schema, evidence model, requirement evaluator, branch engine, item ledger, progress store, coach, and release pipeline. Quest-specific facts remain isolated in their packs. No quest receives a separate React interface.

Source automation may prepare draft facts and identify missing evidence. It may not turn unreviewed Wiki prose into trusted guidance. A pack becomes selectable only after its player-facing route decisions, locations, branches, requirements, item flow, and completion evidence pass strict validation.

Rejected approaches are:

- extending the hard-coded F2P structures indefinitely, because members content would accumulate special cases and duplicated semantics;
- generating and publishing all 210 walkthroughs directly from Wiki guides, because prose cannot safely determine exact chunks, Fate Locked legality, route branches, item lifecycles, or subjective combat readiness; and
- building one combined all-quest guide, because it would prevent per-pack review, failure isolation, and selective public approval.

## 3. Goals

1. Represent every one of the 210 normalized current quest and miniquest identities in a versioned RuneProof catalogue.
2. Give every supported objective one independently compiled, source-backed quest pack.
3. Prove deterministic access requirements from the current Fate Locked run without modifying that run.
4. Recommend the best legal reviewed branch while allowing the player to switch branches deliberately.
5. Model item acquisition, transformation, consumption, retention, return, and reuse across every valid branch.
6. Represent reviewed surface chunks, planes, entrances, transports, and instances without inventing locations.
7. Treat subjective combat capability as reviewed guidance plus explicit player confirmation rather than a false automatic proof.
8. Explain exact blockers and give the next useful unblock action.
9. Preserve run-scoped progress, including branch choices, across reloads and pack revisions where mappings remain valid.
10. Fail closed per pack or action when evidence is incomplete or contradictory.
11. Deliver the programme through five major milestone reviews.
12. Keep unapproved content physically absent from normal production bundles.

## 4. Non-goals

- Automatically publish, deploy, announce, or release packs when they compile or pass a milestone review.
- Make RuneProof confirmations complete Journal quests or grant Keys, Fate rolls, rewards, history, integrity events, exports, or sync changes.
- Claim that a player cannot defeat a quest encounter based on an inferred gear or skill assessment.
- Treat unreviewed imported text, entity matches, or geometric chunk guesses as trusted route evidence.
- Require a live Wiki, external API, or remote solver while a player uses RuneProof.
- Build 210 quest-specific components.
- Add diaries, bosses, collection-log goals, or other non-quest objective types during this programme.
- Classify future, retired, or hidden content without an explicit versioned catalogue update.

## 5. Authoritative Catalogue

### 5.1 Catalogue boundary

The initial catalogue version contains exactly the 210 normalized IDs reconciled across:

- `data/sources/quest-list.json`;
- `data/questData.ts`; and
- `data/sources/quest-requirement-audit.json`.

The catalogue contains 191 `quest` entries and 19 `miniquest` entries. Recipe for Disaster retains the repository's established normalized subquest IDs. IDs remain exact display-name identifiers for compatibility with `QuestData`, saved quest completion, source audits, and existing walkthroughs.

### 5.2 Registry contract

The F2P-only registry will be generalized into a versioned RuneProof catalogue registry. Conceptually:

```ts
type RuneProofMembership = 'F2P' | 'MEMBERS';
type RuneProofObjectiveKind = 'quest' | 'miniquest';
type RuneProofPackMilestone = 1 | 2 | 3 | 4 | 5;

interface RuneProofCatalogueEntry {
  readonly questId: string;
  readonly slug: string;
  readonly kind: RuneProofObjectiveKind;
  readonly membership: RuneProofMembership;
  readonly wikiTitle: string;
  readonly sourceRevision: string;
  readonly sourceRevisionTimestamp: string;
  readonly progressionPriority: number;
  readonly milestone: RuneProofPackMilestone;
  readonly requirementComplexity: RuneProofComplexityAssessment;
}
```

Every entry must have an explicit membership classification and pinned evidence. The existing 23-entry F2P snapshot remains a verified input and regression boundary, not the general registry implementation.

Catalogue changes are blocking review events. New, removed, renamed, or reclassified objectives do not silently enter or leave RuneProof.

## 6. System Architecture

### 6.1 Processing flow

```text
Versioned 210-entry catalogue
  -> pinned quest and requirement sources
  -> generated draft facts
  -> independently reviewed pack decisions
  -> strict pack compiler and coverage report
  -> private preview catalogue
  -> immutable account and progress snapshot
  -> preflight ranking and selected-route analysis
  -> shared RuneProof coach
  -> separately approved public catalogue
```

### 6.2 Responsibility boundaries

- **Catalogue truth** defines the 210 identities, membership, kind, source revision, priority, and milestone.
- **QuestData truth** supplies canonical prerequisite, skill, quest-point, combat-level, region, location, and existing manual requirement facts.
- **Guide truth** defines the reviewed actions, branches, preferred legal route, alternatives, item flow, and combat recommendations.
- **Source truth** records pinned evidence for every trusted fact.
- **Account truth** is an immutable snapshot of the current Fate Locked run.
- **RuneProof progress truth** stores only branch selections and guide confirmations for that run.
- **Release truth** decides which exact pack revisions may enter a private or public catalogue.

No layer may silently overwrite another. A generic item source may be offered as a reviewed alternative, but it cannot replace a legal preferred quest method. RuneProof progress cannot become canonical completion.

### 6.3 Shared runtime

All packs use the same:

- catalogue and release loaders;
- requirement expression evaluator;
- item-route resolver and branch item ledger;
- action and branch state projector;
- blocker and unblock explanation model;
- objective ranker;
- progress store and migration layer;
- coach, branch selector, map, and proof drawer; and
- validation and release tooling.

Cook's Assistant and the other four public Wave 1 packs remain golden regression packs.

## 7. Quest Pack Contract

### 7.1 Pack structure

Conceptually, a compiled pack contains:

```ts
interface RuneProofQuestPack {
  readonly questId: string;
  readonly revision: string;
  readonly catalogueRevision: string;
  readonly sources: readonly ReviewedSourceReference[];
  readonly preflight: RequirementExpression;
  readonly branches: readonly RuneProofBranch[];
  readonly sharedActions: readonly RuneProofAction[];
  readonly completion: RuneProofCompletionDefinition;
  readonly migrations: readonly RuneProofProgressMigration[];
}

interface RuneProofBranch {
  readonly id: string;
  readonly label: string;
  readonly requirements: RequirementExpression;
  readonly rank: ReviewedBranchRank;
  readonly actions: readonly RuneProofAction[];
  readonly evidenceIds: readonly string[];
}

interface RuneProofAction {
  readonly id: string;
  readonly instruction: string;
  readonly kind: RuneProofActionKind;
  readonly dependsOn: readonly RuneProofActionRef[];
  readonly requirements: RequirementExpression;
  readonly itemEffects: readonly RuneProofItemEffect[];
  readonly location: ReviewedLocationReference;
  readonly completion: RuneProofActionCompletion;
  readonly preferredMethod?: ReviewedMethodReference;
  readonly alternatives: readonly ReviewedAlternativeReference[];
  readonly evidenceIds: readonly string[];
}
```

Exact implementation names may follow repository conventions, but these responsibilities are mandatory.

### 7.2 Stable identity

- Quest IDs remain the canonical repository quest IDs.
- Pack, branch, action, evidence, method, and migration IDs are stable and unique within their scopes.
- Reordering actions does not change their IDs.
- Cross-branch shared actions use shared IDs rather than duplicated branch-specific confirmations.
- An unavoidable ID change requires an explicit old-to-new migration entry.

### 7.3 Action graph

- Dependencies form an acyclic graph.
- Every dependency resolves to a shared or active-branch action.
- Every active branch reaches exactly one explicit completion definition.
- Player-visible actions have concrete instructions and reviewed location context.
- The compiler rejects dangling dependencies, cycles, unreachable actions, duplicated IDs, and branches that cannot reach completion.

## 8. Requirement and Proof Model

### 8.1 Requirement expressions

Requirements use a typed expression tree:

```ts
type RequirementExpression =
  | { readonly kind: 'ALL'; readonly requirements: readonly RequirementExpression[] }
  | { readonly kind: 'ANY'; readonly requirements: readonly RequirementExpression[] }
  | RuneProofAtomicRequirement;
```

Atomic requirements cover:

- completed prerequisite quest or miniquest;
- quest points;
- skill and level;
- explicitly permitted temporary boost and timing policy;
- combat level where the source makes it a deterministic gate;
- region, chunk, plane, entrance, or instance access;
- transport method, fare, consumable, return condition, or mobility unlock;
- item, quantity, equipment capability, or reusable tool;
- guild, merchant, minigame, Slayer, or other canonical unlock;
- selected quest branch or prior quest-state checkpoint; and
- manual confirmation for cooperation, dialogue, puzzle, stealth, timing, randomness, or subjective readiness.

Unknown source wording becomes an unresolved evidence requirement. It cannot be treated as satisfied.

### 8.2 Proof states

Every objective and action projects one of:

- **READY:** all deterministic requirements are proved and no manual confirmation remains;
- **CONFIRM:** deterministic requirements are proved, but player knowledge or capability must be confirmed;
- **BLOCKED:** a known deterministic requirement is unmet;
- **NEEDS_REVIEW:** evidence is incomplete, contradictory, stale, or unmodelled, so RuneProof makes no feasibility claim; or
- **COMPLETE:** canonical completion is observed or the isolated guide completion has been confirmed.

`NEEDS_REVIEW` is not a synonym for impossible. `BLOCKED` requires a known unmet condition and must identify an actionable unblock step when one exists.

### 8.3 Temporary boosts

- A boost is considered only when pinned reviewed evidence says the requirement is boostable.
- The requirement records the base skill, target level, acceptable boost sources, timing window, and any step ordering constraint.
- If timing or decay cannot be modelled deterministically, RuneProof uses a manual confirmation rather than claiming readiness.
- Non-boostable quest-start requirements remain strict account gates.

### 8.4 Transport and access

Transport is represented as route actions or requirements, not hidden travel cost. A reviewed transport record may include:

- origin and destination;
- entrance and exit chunks and planes;
- prerequisite quest, unlock, item, fare, or dialogue state;
- consumed and retained resources;
- one-way or return-route constraints; and
- instance or destination identity.

If an instance has no meaningful surface coordinates, RuneProof shows the reviewed entrance chunk plus instance label and plane context.

## 9. Branching Behaviour

### 9.1 Recommendation

For a branching quest, RuneProof ranks reviewed branches by:

1. legal now over blocked;
2. complete evidence over incomplete evidence;
3. deterministic local route over random or remote route;
4. fewer new Fate Locked unlocks;
5. reviewed risk and resource cost; and
6. the pack's explicit deterministic tie-break order.

The highest-ranked legal branch is recommended. RuneProof explains the decisive reason rather than displaying an unexplained default.

### 9.2 Selection and switching

- Before branch-specific progress, the recommendation may update when the account snapshot changes.
- Once the player selects a branch or confirms a branch-specific action, that branch is pinned for the run.
- The player may deliberately switch through the branch selector.
- Shared confirmations and actions that remain semantically valid are retained.
- Incompatible branch-specific confirmations remain stored but inactive, allowing a safe return to the earlier branch.
- Switching never changes canonical quest state.

### 9.3 Cooperation and mutually exclusive states

Another-player requirements, gang choices, allegiance choices, and similar conditions use explicit manual or observed branch state. RuneProof cannot infer another player's cooperation or silently choose a mutually exclusive state.

## 10. Item Lifecycle and Alternatives

### 10.1 Item effects

Each action records item effects using explicit semantics:

- acquire;
- produce or transform;
- consume;
- retain or require-present;
- return or remove;
- lend or temporarily replace;
- reuse as a tool; and
- quest-provided.

Quantities are mandatory where meaningful. Capability requirements such as "any slash weapon" or "a usable pickaxe" reference a reviewed item family rather than pretending one named item is mandatory.

### 10.2 Branch ledger

The compiler evaluates a separate item ledger for every valid branch:

- consumption cannot exceed available quantity;
- reusable tools are not consumed unless a specific action says so;
- returned and removed quest items leave the ledger at the correct step;
- quest-provided items cannot be treated as pre-quest acquisition blockers;
- shared actions contribute consistently to every branch that uses them; and
- completion cannot depend on an item that no earlier valid action or reviewed account source can provide.

A broken or ambiguous ledger rejects the affected branch. If every branch is rejected, the pack cannot enter preview.

### 10.3 Preferred methods and alternatives

The reviewed preferred method remains primary while legal. If blocked, RuneProof shows:

1. the preferred method;
2. its exact blocker;
3. the best reviewed unblock action; and
4. any reviewed legal alternatives.

Generic resolver output remains supporting evidence. It cannot override the authored main journey or introduce an unreviewed route.

## 11. Combat Readiness

RuneProof separates deterministic combat access from subjective combat capability.

It automatically evaluates:

- required quest, skill, region, chunk, instance, item, and equipment-capability gates;
- mandatory protection, damage type, or encounter item where evidence is deterministic; and
- access to reviewed recommended supplies when those supplies are part of the route.

It presents a reviewed combat-readiness card containing:

- encounter and phase summary;
- mandatory mechanics and protection;
- recommended minimum equipment capabilities;
- recommended food, potions, prayer, runes, ammunition, or recovery items;
- death, escape, and re-entry notes; and
- an explicit player confirmation.

RuneProof does not label an encounter impossible because the player's gear, reflexes, strategy, or risk tolerance cannot be proved. The confirmation acknowledges readiness for the guide; it does not claim verified combat skill.

## 12. Source and Authoring Pipeline

### 12.1 Inputs

Draft facts may be assembled from:

- the pinned 210-entry quest list;
- the pinned quest requirement audit;
- canonical `QuestData`;
- pinned Wiki quick-guide source lines;
- reviewed root item requirements;
- approved Chunk Picker evidence where attribution and mapping are valid;
- exact entity and chunk datasets; and
- independently authored review records.

### 12.2 Generated and reviewed layers

Generated draft data is stored separately from reviewed decisions. Generated data may suggest:

- source-line-to-action grouping;
- candidate entities and locations;
- prerequisite and skill gates;
- item mentions and possible transformations; and
- possible branch points.

Review records decide:

- the actual player instruction;
- exact action boundaries and ordering;
- trusted location, entrance, plane, and instance context;
- branch meaning and recommendation rank;
- item lifecycle;
- manual versus deterministic requirements;
- combat-readiness wording; and
- allowed alternatives.

The compiler never promotes a suggestion merely because it has high matching confidence.

### 12.3 Validation report

For every pack, the compiler produces structured findings for:

- identity and source mismatch;
- missing or stale evidence;
- unresolved requirement wording;
- ambiguous or absent location context;
- unsupported transport or instance semantics;
- dependency cycles, dangling references, and unreachable completion;
- broken item ledgers per branch;
- conflicting branch or completion rules;
- missing combat/manual confirmation where required; and
- missing migration coverage for renamed stable IDs.

Blocking findings exclude only the affected branch or pack. Other compiled packs remain usable.

### 12.4 Offline runtime

All approved catalogue, pack, source-summary, and map data required by the player experience is compiled into the relevant build. Runtime use does not require the Wiki, Chunk Picker, an AI service, or another external API.

## 13. Pack Lifecycle and Release Boundary

Each exact pack revision has one explicit lifecycle state:

1. **DRAFT:** incomplete or unreviewed; absent from compiled catalogues.
2. **PREVIEW_VALIDATED:** compiler-valid and available only in the private preview build.
3. **MILESTONE_APPROVED:** accepted during the relevant major local review; still private unless separately promoted.
4. **PUBLIC_APPROVED:** explicitly authorized for the public catalogue at that exact revision.

No state is inferred from test success, source freshness, prior revision approval, milestone completion, merge status, or deployment state.

Preview and public catalogues are compiled separately from the same canonical packs and explicit release manifests. Normal builds must not import private pack payloads, raw source lines, review notes, or private revisions. The existing Vite module boundary and contamination tests remain mandatory.

Before any future public promotion, the repository's Wave 1 production acceptance record must be reconciled with the already-merged public configuration so approval evidence and deployed state do not conflict.

## 14. Runtime Behaviour

### 14.1 Catalogue preflight

Opening RuneProof does not run 210 full route analyses. A bounded lightweight pass evaluates:

- catalogue membership and kind;
- canonical completion;
- prerequisite quests and quest points;
- skills and explicit basic gates;
- known region, chunk, and access blockers;
- selected-branch and progress summary; and
- pack evidence status.

This pass produces searchable/filterable readiness metadata and candidate recommendations.

### 14.2 Deep analysis

Full item-route, branch, action, transport, alternative, and blocker analysis runs only for:

- the selected quest; and
- the small bounded set of strongest recommendation candidates needed to resolve ties.

The ranker must not launch one full resolver query per catalogue entry.

### 14.3 Objective ranking

RuneProof shows up to three uncompleted recommendations. Ranking uses:

1. ready;
2. confirmation needed;
3. blocked with an actionable reviewed route;
4. milestone/progression priority;
5. amount of retained progress; and
6. stable quest ID tie-break.

`NEEDS_REVIEW` packs are not recommended as playable objectives, but remain visible in the audit-oriented catalogue view with their review status.

### 14.4 Selected quest journey

For a selected compiled pack, RuneProof:

1. loads the immutable pack and account snapshot;
2. selects the pinned or highest-ranked branch;
3. combines canonical facts with isolated RuneProof progress;
4. evaluates dependencies, item state, gates, locations, and manual confirmations;
5. chooses the first incomplete legal action as **Do now**;
6. shows the root blocker and best reviewed unblock action when blocked;
7. renders shared, active-branch, completed, upcoming, blocked, and confirmation actions;
8. exposes reviewed alternatives below the preferred route;
9. opens temporary map context without unmounting the coach; and
10. offers guide completion only after the active route's completion conditions are met.

## 15. Player Interface

RuneProof retains the accepted coach hierarchy and adds scale-aware controls:

- search across all 210 objectives;
- filters for quest/miniquest, F2P/members, series, readiness, milestone, and review status;
- three explained recommendations;
- selected objective progress and current branch;
- branch selector with recommendation reason and switch consequences;
- one concrete **Do now** card;
- ordered route timeline with exact reviewed location context;
- blocker and unblock card;
- reviewed alternatives disclosure;
- combat-readiness confirmation card where needed;
- temporary map with entrance chunk, plane, and instance label; and
- collapsible proof, source revision, and diagnostics drawer.

The ordinary Goal Planner remains available when a pack is absent, rejected, or needs review. Player-facing errors use quest and action language; compiler terminology belongs in the proof or maintainer diagnostics surface.

Desktop and mobile interfaces must keep controls reachable, focus order logical, background scrolling locked while modals are open, and branch/map close actions returning to the exact prior coach state.

## 16. Progress Storage and Migration

### 16.1 Versioned per-quest records

The current catalogue-wide action and item records will migrate to per-run, per-quest records:

```text
fate_runeproof_progress_v2:<runId>:<questSlug>
```

Conceptually:

```ts
interface RuneProofQuestProgressV2 {
  readonly schemaVersion: 2;
  readonly runId: string;
  readonly questId: string;
  readonly packRevision: string;
  readonly selectedBranchId?: string;
  readonly confirmedActionIds: readonly string[];
  readonly confirmedItemKeys: readonly string[];
  readonly manualConfirmationIds: readonly string[];
  readonly updatedAt: string;
}
```

A compact per-run summary index stores progress counts, completion state, selected branch, pack revision, and last update for catalogue ranking. It does not duplicate the full action record.

### 16.2 Compatibility

- Existing `fate_runeproof_preview_checks_v1:<runId>` and `fate_runeproof_preview_actions_v1:<runId>` data is read and migrated for the five public Wave 1 quests and any valid preview records.
- Migration is idempotent.
- The old records remain untouched until the new records have been written and reread successfully.
- Unknown quests, items, actions, or branches are discarded from the affected record.
- Pack-provided migration maps translate renamed IDs only when semantics are explicitly equivalent.
- Incompatible branch-specific confirmations remain inactive rather than being reassigned.

### 16.3 Failure isolation

Malformed, oversized, stale, or write-failing progress affects only one quest record. RuneProof continues with empty isolated progress for that quest and never interrupts the ordinary Goal Planner or canonical save handling.

## 17. Failure Handling

RuneProof fails closed and locally:

- catalogue mismatch blocks the catalogue build;
- pack identity or source mismatch rejects the pack;
- incomplete evidence rejects the affected branch or pack;
- unresolved requirement semantics yield `NEEDS_REVIEW`;
- missing or ambiguous location evidence yields `NEEDS_REVIEW`;
- known unmet deterministic requirements yield `BLOCKED`;
- missing item sources or broken item ledgers reject the affected branch;
- dependency cycles or unreachable completion reject the pack;
- invalid migration entries reject the new pack revision;
- corrupt progress resets only the affected quest's RuneProof state; and
- rejected objectives remain available through the ordinary Goal Planner.

RuneProof never invents coordinates, silently skips an invalid action, silently switches branches after progress, or labels incomplete evidence as impossibility.

## 18. Major Milestones

### Milestone 1: Platform foundation

- Create and validate the generic 210-entry registry.
- Add the generic pack, requirement, branch, item-effect, location, combat, release, and progress contracts.
- Generalize the compiler and source pipeline.
- Add preflight ranking and bounded deep analysis.
- Add per-quest progress V2 and safe V1 migration.
- Migrate the five public Wave 1 packs without changing accepted behavior.
- Preserve public/private module isolation.

Exit state: the platform can represent the approved semantics, the existing five guides are regression-equivalent, and no new public content is released.

### Milestone 2: Complete F2P catalogue

- Compile all 23 approved F2P objectives, including Daddy's Home.
- Exercise F2P item families, quantities, cooperation, basic combat, and advanced route blockers.
- Retain the ordinary Goal Planner for any rejected pack until corrected.

Exit state: 23/23 F2P objectives are preview validated and locally reviewed.

### Milestone 3: Linear members quests

- Build the committed roster of straightforward members objectives.
- Establish reviewed patterns for transports, fares, equipment capabilities, explicit boosts, combat confirmations, and simple instances.
- Validate performance with a materially larger catalogue.

The exact roster and count are frozen by the committed complexity assessment before authoring starts.

### Milestone 4: Complex and branching content

- Build the committed roster requiring route branches, cooperation, mutually exclusive state, extensive transport, multi-stage instances, puzzles, stealth, timing, randomness, or advanced item lifecycles.
- Verify branch switching and inactive confirmation retention across representative complex packs.

The exact roster and count are frozen by the same reviewed complexity assessment.

### Milestone 5: Complete catalogue

- Complete all remaining master/grandmaster quests and miniquests.
- Resolve or explicitly review the known requirement-audit exceptions, including Bear Your Soul, Desert Treasure I, and The Enchanted Key.
- Reach 210/210 registry classification and pack disposition.
- Run the complete coverage, regression, performance, build, and local visual/play review.

Exit state: every one of the 210 objectives is either a validated private RuneProof pack or has a blocking review finding that must be resolved before the programme can be called complete. Final acceptance requires 210 validated packs; a list containing unresolved placeholders does not count as coverage.

## 19. Complexity Assessment

Before Milestone 3 authoring, a deterministic assessment classifies every non-F2P objective using source-backed dimensions:

- prerequisite depth and fan-out;
- skill, quest-point, combat, and boost requirements;
- number of regions, exact locations, transports, planes, and instances;
- item count and lifecycle complexity;
- branch and partial-completion notes;
- cooperation or manual conditions;
- combat encounter count and phase complexity; and
- unresolved audit notes.

The assessment produces a committed roster for Milestones 3–5. Human review may correct a misclassification with a recorded reason. Counts and assignments do not drift during a milestone unless the catalogue or evidence version changes explicitly.

## 20. Automated Verification

### 20.1 Catalogue and graph tests

- Exactly 210 normalized identities exist: 191 quests and 19 miniquests.
- Every identity has reviewed membership, kind, slug, source, milestone, and complexity metadata.
- Registry, `QuestData`, quest-list, and requirement-audit IDs reconcile.
- The canonical prerequisite graph has no dangling IDs or cycles.
- Recipe for Disaster normalized IDs remain stable.

### 20.2 Compiler tests

- Only allowed fields and versioned schema values compile.
- Every source and evidence reference resolves.
- Requirement expressions are typed, finite, and evaluable.
- Branch and action IDs are unique and stable.
- Dependencies are acyclic and reach completion.
- Locations contain reviewed chunk, plane, entrance, or instance evidence as required.
- Every branch item ledger balances.
- Combat/manual conditions use confirmations where deterministic proof is impossible.
- Invalid drafts and stale revisions cannot enter preview or public catalogues.

### 20.3 Per-pack generated tests

Every validated pack generates table-driven checks for:

- preflight readiness;
- each branch's legal, blocked, and needs-review conditions;
- recommended-branch selection and deterministic ties;
- action order and dependency projection;
- item acquisition, transformation, consumption, return, and reuse;
- exact blocker and unblock explanation;
- location and temporary-map context;
- combat/manual confirmation gates;
- final completion timing and idempotence; and
- source and pack revision integrity.

### 20.4 Runtime and integration tests

- Exactly one selected **Do now** action is projected.
- Recommendations never require 210 full route analyses.
- Branch choice pins after progress and switches only deliberately.
- Shared progress survives branch changes; incompatible progress stays inactive.
- Progress survives reload, remains isolated by run and quest, and migrates from V1 safely.
- Canonical completion is read-only and RuneProof confirmation has no canonical mutation path.
- Unsupported or rejected packs retain ordinary Goal Planner behavior.
- Cook's Assistant retains its accepted Mill Lane route and all five public Wave 1 packs remain behaviorally equivalent.
- Private payloads remain absent from normal builds even with contaminated environment variables.

### 20.5 Performance gates

Performance fixtures cover the complete 210-entry catalogue and realistic high-action packs. Tests establish budgets for:

- initial catalogue preflight;
- search and filter updates;
- recommendation ranking;
- selected-pack load and analysis;
- branch switching; and
- progress index read/write.

Budgets are measured on representative desktop and constrained mobile profiles before Milestone 3 is approved. Regressions block later milestones.

## 21. Visual and Play Review

At each major milestone, the locally running private preview is reviewed on desktop and mobile. The review covers:

1. catalogue search, filters, counts, and recommendations;
2. representative ready, confirm, blocked, needs-review, and complete states;
3. exact **Do now** wording and route hierarchy;
4. branch recommendation, explanation, switching, and progress retention;
5. item acquisition, transformation, consumption, and reusable tools;
6. blocker and unblock explanations;
7. combat-readiness cards;
8. entrance, plane, instance, and temporary-map context;
9. reload, run isolation, and migration;
10. completed-route presentation without Journal, Key, Fate, reward, export, sync, history, or integrity mutation;
11. proof/source disclosures; and
12. keyboard, focus, scroll locking, mobile width, and control reachability.

Milestone approval allows the next milestone to begin. It does not approve public promotion.

## 22. Coverage Reporting

The repository will generate a 210-row coverage matrix. For every objective and semantic dimension it reports:

- required;
- modelled;
- validated;
- preview approved; and
- public approved.

Dimensions include identity, preflight, core route, locations, transport, instances, items, branches, combat/manual conditions, evidence, progress migration, and completion.

Aggregate counts cannot hide per-pack gaps. Programme completion requires all required dimensions to be validated for all 210 packs.

## 23. Acceptance Criteria

The all-quest RuneProof programme is complete when:

1. The versioned registry contains exactly all 210 normalized current quest and miniquest IDs with reviewed membership and source evidence.
2. Every registry entry has one compiler-valid, independently source-reviewed pack.
3. Every valid route branch reaches explicit completion through an acyclic action graph.
4. Every deterministic requirement evaluates from typed account state or fails closed.
5. Every player-visible location has reviewed chunk, plane, entrance, or instance context.
6. Every branch item ledger balances acquisition, transformation, consumption, retention, return, reuse, and quest-provided supply.
7. Branching quests recommend the best legal reviewed route and permit deliberate run-scoped switching.
8. Combat capability uses reviewed guidance and explicit player confirmation without false impossibility claims.
9. Exact blockers and useful unblock actions are presented when known; incomplete evidence is labelled `NEEDS_REVIEW`.
10. Recommendations and catalogue interaction remain performant with all 210 packs.
11. Existing RuneProof progress migrates safely and all progress remains isolated by run and quest.
12. The five existing public packs retain accepted behavior.
13. Private packs and source payloads remain absent from normal production bundles until explicitly approved.
14. All automated project gates pass at each milestone.
15. Alex has completed the local visual/play review for each major milestone.
16. No public promotion, deployment, or announcement occurs without a separate explicit instruction for exact approved pack revisions.
