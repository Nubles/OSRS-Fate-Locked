# RuneProof Progression Coach Redesign

**Date:** 2026-08-20

**Status:** Approved design, awaiting document review

**Scope:** Replace the local RuneProof preview's audit-report experience with a quest-first progression coach, beginning with Cook's Assistant

## 1. Context

The current RuneProof preview proved that FLIM can evaluate reviewed quest requirements, enumerate item sources, resolve transformations, project route locations, and retain evidence without changing the player's main save. It also exposed why that foundation is not yet a useful player product.

RuneProof currently renders its internal analysis almost directly inside the existing Goal Planner. The result is crowded, contradictory, and overly technical. Players see route-budget warnings, incomplete evidence, repeated preparation and walkthrough steps, and dozens of alternative sources before they receive a clear instruction.

Cook's Assistant demonstrates the deeper problem. Its reviewed Wiki source already gives a sensible local route: take a pot near the Cook, collect the nearby ingredients, pick grain outside Mill Lane Mill, make flour, and return. The current walkthrough reduces that guidance to a generic “Prepare 1 pot of flour through RuneProof” action. The independent item solver does not model “pick wheat to obtain grain,” measures travel without a player or quest origin, and therefore recommends killing Black Knights for flour because that is a technically valid one-step source.

This is an architectural failure, not a wording defect. Quest guidance, account validation, and generic source discovery must have separate responsibilities.

## 2. Product Decision

RuneProof is a **progression coach** whose primary promise is:

> Tell me the best objective for my run and exactly what I should do next.

Reviewed quest guidance is the default path. RuneProof validates that path against the player's Fate Locked state, explains blockers, and offers legal alternatives only as secondary choices. A generic item source must never silently replace a sensible reviewed quest method.

The selected architecture is **quest-first guidance with solver fallback**. The existing resolver remains valuable as an evidence and alternative-source engine; it no longer owns the primary route by itself.

## 3. Goals

1. Present one trustworthy next action instead of a raw analysis report.
2. Recommend an overall objective with a short, deterministic explanation.
3. Preserve reviewed quest strategy as the canonical default route.
4. Validate every strategy action against the current run's unlocks and progress.
5. Explain the exact blocker and the best unblock action when the default route is unavailable.
6. Offer technically legal alternatives without allowing unreasonable sources to outrank reviewed local guidance.
7. Keep evidence, provenance, and incomplete-data warnings available without making them the main experience.
8. Capture reliable progress automatically through canonical FLIM and RuneLite state while distinguishing manual confirmation.
9. Expand through individually reviewed quest waves, beginning with the existing pilot set and then F2P content.
10. Keep all work local and preview-only until Alex has visually tested and explicitly approved it for release.

## 4. Non-goals

- Publicly enable RuneProof in this milestone.
- Publish every quest at once.
- Treat generated or inferred guidance as reviewed fact.
- Build a full expected-time optimiser for every OSRS activity.
- Let analysis mutate canonical unlocks, quest completion, or integrity history.
- Restore preview confirmation state into the current main save schema without an explicit future migration design.
- Remove the existing Goal Planner for unsupported quests, diaries, or regions.
- Expose route-search budgets, raw evidence records, or compiler terminology in the normal player journey.

## 5. Experience Design

RuneProof becomes a dedicated progression-coach workspace rather than a panel appended beneath Goal Planner output.

### 5.1 Entry and target selection

- Preview mode exposes a clear RuneProof entry from the progression dashboard.
- Once multiple reviewed strategies are available, opening RuneProof shows up to three recommended reviewed objectives. The Cook's Assistant vertical slice opens directly on its single proven route.
- The highest-ranked objective is selected by default when no objective is pinned.
- Players can search for and pin another supported objective at any time.
- Unsupported targets continue to use the existing Goal Planner and are never presented as fully analysed RuneProof routes.

### 5.2 Active objective

The active objective view contains, in order:

1. **Objective summary:** the target, why RuneProof recommends it, and overall route progress.
2. **Next action:** one prominent, concrete instruction with its location and relevant requirement.
3. **Upcoming route:** a compact ordered timeline of completed, current, upcoming, blocked, and confirmation-required actions.
4. **Blocker explanation:** the exact missing condition and the recommended action that removes it.
5. **Alternatives:** collapsed secondary methods, shown when the guide route is blocked or the player asks for them.
6. **Proof:** a separate drawer containing pinned sources, revisions, evidence wording, review metadata, and data-quality notes.

Requirements are integrated into the ordered route. RuneProof does not render a separate checklist, preparation list, walkthrough list, and item-route list that repeat the same work.

### 5.3 Action language

Player-facing actions must be concrete and local:

> Pick up the empty pot beside the Cook in Lumbridge Castle.

They must not use internal placeholders such as:

> Prepare 1 pot of flour through RuneProof.

Map controls appear only when a verified location helps the current action. Evidence uncertainty is expressed concisely in the Proof drawer rather than as repeated warnings on every step.

## 6. Architecture

RuneProof separates three kinds of truth.

### 6.1 Guide truth

Reviewed strategy packs define the normal way to complete a quest. They own ordered actions, action dependencies, intended acquisition methods, reviewed locations, and evidence references.

### 6.2 Account truth

An immutable account snapshot describes what the current Fate Locked run can access: skills, levels, regions, chunks, quests, merchants, mobility, guilds, minigames, and other canonical unlock facts.

### 6.3 Source truth

The item resolver describes every known direct source and transformation that could legally satisfy a requirement. This truth powers fallback routes and proof; it does not replace guide truth by default.

### 6.4 Processing order

1. Load a compiled, reviewed strategy pack.
2. Materialize the current account and progress snapshot.
3. Validate the strategy's ordered actions against that snapshot.
4. Select the first incomplete action as the next-action candidate.
5. If it is blocked, derive and explain the root blocker and an unblock action.
6. Run fallback source resolution only when the preferred method is blocked, interchangeable, or explicitly expanded by the player.
7. Project the result into the coach view.
8. Keep source provenance and analysis diagnostics in the Proof view.

## 7. Reviewed Strategy Packs

Each supported quest receives a compiled strategy definition with the following conceptual shape:

```ts
interface QuestStrategyDefinition {
  questId: string;
  revision: string;
  progressionPriority: number;
  unlockSummary: readonly StrategyUnlock[];
  source: ReviewedSourceReference;
  actions: readonly QuestStrategyAction[];
}

interface QuestStrategyAction {
  id: string;
  sourceOrder: number;
  kind: 'TALK' | 'TRAVEL' | 'COLLECT' | 'TRANSFORM' | 'TRAIN' | 'COMPLETE';
  instruction: string;
  dependsOn: readonly string[];
  requirements: readonly StrategyRequirement[];
  fulfils: readonly ItemQuantity[];
  location?: ReviewedLocationReference;
  preferredMethod?: ReviewedMethodReference;
  fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES' | 'INTERCHANGEABLE' | 'NONE';
  evidenceIds: readonly string[];
}
```

The exact TypeScript names may change during implementation, but these responsibilities are required.

### 7.1 Authoring boundary

- Source capture may scaffold strategy actions.
- A quest is not eligible for RuneProof recommendation until its strategy is reviewed and compiles successfully.
- The compiler rejects missing dependencies, duplicate action IDs, invalid evidence references, invalid locations, and preferred methods that cannot satisfy their declared outputs.
- Published strategy packs are immutable generated data.
- Incomplete drafts remain outside the published catalogue.

## 8. Guide Validation and Action States

Each strategy action resolves to exactly one player-facing state:

- **COMPLETED:** canonical or confirmed progress proves the action is done.
- **DO_NOW:** all known requirements pass and this is the first incomplete action.
- **AVAILABLE_NEXT:** requirements pass but an earlier action remains.
- **BLOCKED:** a known account or access requirement fails.
- **NEEDS_CONFIRMATION:** automation cannot safely determine completion.

Only one action may be projected as the primary next action.

A blocked preferred method remains visible with a plain explanation. RuneProof must not silently substitute a fallback and make the reviewed route disappear.

## 9. Preferred Methods and Fallback Routes

### 9.1 Governing rule

For an action with a reviewed preferred method:

1. Use the preferred method when valid.
2. If blocked, show its blocker and best unblock action.
3. Offer valid alternatives under a secondary control when policy allows.
4. Never promote an unreviewed random drop above an available reviewed deterministic method.

### 9.2 Context-aware fallback ranking

Fallbacks use a deterministic ordering based on the whole journey rather than an isolated source step:

1. Valid with current unlocks.
2. Reviewed method before unreviewed source.
3. Deterministic before chance-based.
4. Travel from the prior completed/current quest action, not merely travel inside the item route.
5. Lower expected effort.
6. Lower combat risk.
7. Lower randomness.
8. Fewer additional unlocks and skill requirements.
9. Stable route identity as the final tie-breaker.

Unknown effort or probability is treated conservatively. It must not receive an artificial advantage over known local methods.

### 9.3 Route context

The ranker receives a route context containing:

- the prior strategy action's verified location;
- the current action's target location;
- an optional recent RuneLite player location when it is reliable and permitted; and
- the remaining actions that consume the result.

The first implementation may use the prior strategy location as the stable origin. Live player position is an enhancement, not a prerequisite for correct Cook's Assistant guidance.

## 10. Gathering and Transformation Coverage

Quest strategies require transformations that are not represented by spawn, shop, or drop records. RuneProof therefore gains reviewed gathering methods tied to exact entities and outputs.

Cook's Assistant requires at least:

```text
Wheat object -> Pick wheat -> Grain
Empty pot + Grain + Mill/Hopper -> Pot of flour
Empty bucket + Dairy cow -> Bucket of milk
```

These methods use the same reviewed evidence, exact-entity location, account-gate, and fail-closed compilation rules as other RuneProof data.

Generic transformation coverage must not be marked complete when a normal gathering step is missing from the resolver's model.

## 11. Cook's Assistant Acceptance Route

The first vertical slice encodes a local route equivalent to:

1. Talk to the Cook in Lumbridge Castle.
2. Take the empty pot near the Cook.
3. Take the nearby bucket.
4. Use the bucket on a dairy cow in the Lumbridge cow field.
5. Collect the egg at the nearby chicken farm.
6. Pick grain outside Mill Lane Mill.
7. Use the grain with the hopper, operate the mill, and collect flour in the pot.
8. Return to the Cook with all three ingredients.
9. Complete the quest.

Exact action splitting may follow verified location and interaction evidence, but the route semantics may not be replaced by a generic item search.

Acceptance requirements:

- The nearby mill method is the recommended flour route.
- A Black Knight drop is never the recommended route while the reviewed mill method is available.
- If Mill Lane Mill is genuinely blocked by the run, RuneProof explains that blocker before showing alternative flour sources.
- The main journey contains no route-budget messages or raw source wording.
- The Proof drawer retains the source revision and evidence needed to audit the recommendation.
- Goal Planner and RuneProof do not display contradictory readiness headings.

## 12. Objective Recommendation

Only compiled, reviewed, published strategy packs are recommendation candidates.

Completed objectives are excluded. Remaining candidates are ordered deterministically by:

1. Currently completable, or possessing a concrete actionable unblock step.
2. Number and importance of downstream unlocks.
3. Fit with the player's current regions and route context.
4. Estimated effort and randomness.
5. Reviewed new-player progression priority.

RuneProof shows up to three recommendations with plain explanations derived from those facts. It must not expose a raw numeric score as justification.

A player-pinned objective overrides automatic selection. The active objective remains stable until it is completed, manually changed, newly hard-blocked, or explicitly recalculated.

## 13. Progress and Provenance

Progress facts retain their source internally:

- canonical FLIM run state;
- RuneLite observation;
- explicit player confirmation; or
- unknown.

RuneLite may automatically update skills, completed quests, access facts, and observable inventory progress when the signal is reliable. Manual confirmation remains available only where automation cannot safely prove completion.

RuneProof never converts an observation or inference into a canonical unlock. Analysis remains read-only with respect to the run.

The local preview continues to use isolated per-run confirmation storage. Any public save integration requires a separate schema migration and release design.

## 14. Failure and Evidence Handling

- A missing or invalid strategy pack makes that quest ineligible for RuneProof recommendation.
- A localised data gap affects only the relevant action or fallback method.
- An unresolved location produces a concise confirmation requirement; it does not invent coordinates.
- A source or map failure leaves textual next-action guidance usable when the strategy remains valid.
- An analysis failure is contained within RuneProof and leaves the existing Goal Planner usable.
- Raw evidence, compiler diagnostics, route budgets, and incomplete-source notes appear only in the Proof drawer or development diagnostics.
- RuneProof never labels a quest impossible when the evidence only proves that the current known route is blocked.

## 15. Delivery Sequence

### Phase 1: Cook's Assistant vertical slice

- Introduce strategy and reviewed gathering-method models.
- Compile the full Cook's Assistant strategy.
- Add guide validation, action-state projection, and context-aware fallback ranking.
- Build the dedicated coach interface and Proof drawer.
- Add regression coverage for the flour recommendation.

### Phase 2: Complete pilot set

Migrate Daddy's Home, Doric's Quest, and Elemental Workshop I. Together they exercise gathering, crafting, shops, skills, quest locations, and alternative access conditions.

### Phase 3: Objective intelligence and progress capture

- Rank the reviewed pilot objectives.
- Explain recommendation reasons.
- Preserve pinned objectives and recommendation stability.
- Integrate reliable RuneLite observations without changing canonical run history.

### Phase 4: Progressive F2P expansion

Publish reviewed F2P quests individually in sensible new-player order. Each quest becomes recommendation-eligible only after its strategy, evidence, tests, and visual review pass independently.

## 16. Verification and Release Gates

Every phase requires proportionate automated and visual verification.

### 16.1 Automated verification

- Strategy compiler validation and fail-closed publication tests.
- Action-state and root-blocker tests.
- Preferred-method and fallback-ranking tests.
- Gathering-transformation coverage tests.
- Objective-ordering and recommendation-stability tests.
- RuneLite/manual provenance tests where progress capture is included.
- Regression tests proving Cook's Assistant recommends Mill Lane Mill, not Black Knights.
- Normal and preview build checks proving private evidence is absent from the normal bundle.
- Existing FLIM test, typecheck, content verification, and production build gates.

### 16.2 Local visual verification

- Desktop and mobile RuneProof workspace review.
- Ready, blocked, confirmation-required, incomplete-evidence, and completed states.
- Target search, pinning, recalculation, alternative expansion, Proof drawer, and map handoff.
- Realistic local run states for every pilot quest.
- A complete local Cook's Assistant route walkthrough.

### 16.3 Human release gate

Alex must locally and visually test each completed system before release. No RuneProof work is pushed, merged, deployed, publicly enabled, or announced until Alex explicitly approves the tested result.

## 17. Success Criteria

The redesign succeeds when:

1. A player can open RuneProof and understand the recommended objective and next action without reading technical diagnostics.
2. Cook's Assistant follows the reviewed local ingredient route and never recommends Black Knights over an available mill route.
3. Known blockers produce exact explanations and actionable unblock steps.
4. Alternatives remain available without displacing reviewed guidance.
5. Recommendations are deterministic, explainable, stable, and limited to reviewed strategies.
6. Automatic and manual progress remain distinguishable and conservative.
7. Unsupported or incomplete content fails closed.
8. The normal production bundle and existing saves remain unaffected during local preview development.
9. Automated verification passes and Alex approves the visible local result before any release action.
