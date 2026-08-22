# RuneProof All-F2P Quest Packs

**Date:** 2026-08-21

**Status:** Approved conversational design, awaiting written specification review

**Scope:** Expand the local RuneProof progression coach from the accepted Cook's Assistant route to every current F2P quest and F2P miniquest through independently reviewed, fail-closed quest packs

## 1. Context

The Cook's Assistant RuneProof preview established the player experience that the wider F2P rollout must preserve. RuneProof presents one ordered quest route, shows the relevant chunk on every step, opens a temporary closable map without losing the player's place, retains isolated preview progress, and ends with an explicit quest-completion confirmation. It does not award keys or change canonical Journal progression.

The all-F2P expansion is not a collection of unrelated handwritten interfaces. It extends the existing progression-coach engine with independently reviewed quest content. Each quest must remain understandable, testable, and approvable on its own while sharing one runtime, compiler, presentation system, and safety boundary.

The work is local and preview-only. Alex reviews each delivery wave before work advances to the next wave. Completing all waves does not itself authorize a public release.

## 2. Product Decision

RuneProof will use **independent quest packs on the shared progression-coach engine**.

Each pack owns the reviewed facts and route decisions for one quest. The shared engine owns validation, action-state projection, blocker analysis, alternative ranking, progress restoration, chunk presentation, temporary-map behavior, and final confirmation behavior.

Cook's Assistant is the golden reference pack. A change to the shared system must continue to satisfy the accepted Cook's Assistant route and completion experience while adding new quests.

Rejected alternatives are:

- one combined F2P guide, because it would couple unrelated quests and make partial approval unsafe;
- direct automatic guide import, because imported text cannot safely determine Fate Locked legality, exact chunks, preferred routes, or item transformations without review; and
- permissive publication of partial packs, because incomplete guidance could produce misleading recommendations.

## 3. Goals

1. Support every current F2P quest and F2P miniquest in the local RuneProof preview.
2. Give every supported quest a complete, source-backed, independently validated quest pack.
3. Show the relevant reviewed chunk on every player-visible step.
4. Preserve the temporary map flow: open from a step, close it, and return to the same quest and step.
5. Model required items as acquisition and transformation chains instead of generic inventory requirements.
6. Explain exact blockers and give an actionable next-best step.
7. Offer legal alternatives without displacing the reviewed preferred method.
8. Restore preview progress reliably without mutating the real run, Journal, keys, rewards, saves, or integrity history.
9. Fail closed when membership, sources, locations, dependencies, or completion rules are incomplete.
10. Deliver the catalogue in local review waves, with a mandatory Alex approval pause after each wave.

## 4. Non-goals

- Publicly release or deploy RuneProof during this work.
- Automatically approve a quest because automated checks pass.
- Treat visual approval as release approval.
- Generate trusted routes from unreviewed Wiki prose.
- Invent exact chunks or coordinates when source review is incomplete.
- Add P2P quests, diaries, activities, or free-form goals.
- Award keys, roll Fate, or alter canonical quest completion from RuneProof preview confirmations.
- Replace the ordinary Goal Planner for unsupported or rejected quests.
- Build separate quest-specific React interfaces.

## 5. Authoritative F2P Catalogue

Implementation begins with a reviewed F2P membership snapshot. The snapshot records the current quest identity, quest or miniquest classification, membership status, source URL or identifier, and reviewed source revision.

The expected rollout catalogue is:

1. Cook's Assistant
2. Sheep Shearer
3. The Restless Ghost
4. Rune Mysteries
5. Imp Catcher
6. Daddy's Home
7. X Marks the Spot
8. Romeo & Juliet
9. Demon Slayer
10. Ernest the Chicken
11. Doric's Quest
12. Goblin Diplomacy
13. Witch's Potion
14. The Knight's Sword
15. Black Knights' Fortress
16. Vampyre Slayer
17. Prince Ali Rescue
18. Pirate's Treasure
19. Misthalin Mystery
20. Below Ice Mountain
21. The Corsair Curse
22. Shield of Arrav
23. Dragon Slayer I

The reviewed membership snapshot, not section placement in `questData.ts`, is authoritative. Retired, hidden, or members-only records cannot become RuneProof candidates merely because they exist in another catalogue. If source review contradicts the expected roster, the discrepancy blocks quest authoring until it is resolved explicitly.

## 6. Architecture

### 6.1 Shared system

The existing RuneProof engine and coach interface remain the only runtime. Quest packs are immutable inputs to that system. Shared behavior includes:

- supported-objective selection;
- ordered action evaluation;
- account and access validation;
- item-chain evaluation;
- root-blocker explanations;
- next-best-action selection;
- reviewed alternative ranking;
- step progress and reload restoration;
- inline chunk context;
- temporary-map navigation and return; and
- final quest-completion confirmation.

### 6.2 Processing flow

```text
Reviewed F2P membership snapshot
  -> reviewed quest source and strategy pack
  -> fail-closed compiler validation
  -> preview-only supported quest catalogue
  -> immutable account and progress snapshot
  -> RuneProof action and blocker evaluation
  -> shared coach interface
```

Only compiled packs may enter the preview catalogue. Only catalogue entries may be recommended or selected as RuneProof objectives.

### 6.3 Truth boundaries

- **Membership truth** decides which quests belong to the F2P rollout.
- **Guide truth** defines the reviewed preferred quest route.
- **Account truth** describes the current Fate Locked run without being changed by RuneProof.
- **Source truth** supplies known item sources and transformations for validation and alternatives.
- **Preview progress truth** records only the player's RuneProof confirmations for the current run.

No truth source may silently replace another. In particular, a generic item source cannot override an available reviewed quest method.

## 7. Quest Pack Contract

Every quest pack contains the following conceptual information:

```ts
interface RuneProofQuestPack {
  questId: string;
  revision: string;
  membership: ReviewedF2PMembershipReference;
  sources: readonly ReviewedSourceReference[];
  progressionPriority: number;
  objectives: readonly RuneProofObjective[];
  completion: QuestCompletionDefinition;
}

interface RuneProofAction {
  id: string;
  instruction: string;
  kind: ActionKind;
  dependsOn: readonly string[];
  requirements: readonly StrategyRequirement[];
  consumes: readonly ItemQuantity[];
  produces: readonly ItemQuantity[];
  location: ReviewedChunkReference;
  preferredMethod?: ReviewedMethodReference;
  alternatives: readonly ReviewedAlternativeReference[];
  evidenceIds: readonly string[];
}
```

Exact implementation names may follow existing repository conventions, but these responsibilities are mandatory.

### 7.1 Step rules

- Every player-visible action has a stable ID and reviewed canonical chunk.
- Every step displays that chunk directly in the coach timeline.
- **Show on map** opens the existing temporary map focused on that step's chunk.
- Closing the map restores the same quest, scroll context, active step, and progress state.
- Instructions are concrete player actions rather than generic preparation placeholders.
- Dependencies form one valid, acyclic completion sequence.
- Consumed and produced items connect across actions so the compiler can detect broken chains.
- Completion is an explicit final confirmation after all preceding actions are complete.

### 7.2 Preferred methods and alternatives

The reviewed preferred method remains primary while it is legal. If it is blocked, RuneProof shows the preferred route, the exact blocker, and the best unblock action before offering alternatives. Alternatives must be reviewed, legal for the current run, and deterministically ordered. Random drops cannot outrank a local deterministic method merely because they require fewer modelled steps.

## 8. Pack Lifecycle and Publication Boundary

Each pack moves through four conceptual states:

1. **Draft:** incomplete authoring data kept outside the compiled preview catalogue.
2. **Reviewable:** source-complete and compiler-valid, with automated checks passing; available in the local preview for its assigned wave.
3. **Wave approved:** visually tested and explicitly accepted by Alex; retained as preview-only content while later waves are built.
4. **Release approved:** a separate future decision that may authorize promotion, integration, and deployment.

No lifecycle transition is inferred. Automated checks cannot grant visual approval, and approval of one wave cannot approve another wave or a release.

## 9. Runtime Behaviour

For a selected supported quest, RuneProof:

1. loads the immutable compiled pack;
2. combines canonical account facts with isolated RuneProof progress;
3. evaluates every action in dependency order;
4. selects the first incomplete legal action as **Do now**;
5. identifies the root blocker when the preferred next action is unavailable;
6. derives an actionable unblock step and any reviewed alternatives;
7. renders completed, current, upcoming, blocked, and confirmation-required actions;
8. opens and closes map context without leaving the quest workspace; and
9. offers **Confirm quest complete** only after every preceding action is complete.

Confirming completion moves the preview route to its completed state and survives reload for the same run. It does not award keys, perform Fate rolls, update Journal totals, or assert canonical OSRS completion.

## 10. Failure Handling

RuneProof fails closed and locally:

- missing or contradictory F2P membership rejects the affected pack;
- missing sources or invalid evidence references reject the affected pack;
- missing step chunks or unresolved locations reject the affected pack;
- duplicate action IDs, cycles, impossible dependencies, or broken item chains reject the affected pack;
- missing final completion behavior rejects the affected pack;
- a rejected quest is absent from RuneProof recommendations and selection;
- the ordinary Goal Planner remains available for unsupported or rejected quests; and
- diagnostics identify the quest, action, and failed rule without exposing compiler language in the player journey.

RuneProof never invents a location, silently skips an invalid action, or labels a quest impossible when it has only proved that the reviewed route is currently blocked.

## 11. Delivery Waves

### Foundation

- Create and verify the authoritative current F2P membership snapshot.
- Generalize the release catalogue and compiler from the pilot set to independent quest packs.
- Enforce the pack contract and draft-versus-reviewable boundary.
- Preserve Cook's Assistant as the golden regression pack.

### Wave 1: Lumbridge starters

- Cook's Assistant
- Sheep Shearer
- The Restless Ghost
- Rune Mysteries
- Imp Catcher

### Wave 2: Early exploration

- Daddy's Home
- X Marks the Spot
- Romeo & Juliet
- Demon Slayer
- Ernest the Chicken

### Wave 3: Asgarnia

- Doric's Quest
- Goblin Diplomacy
- Witch's Potion
- The Knight's Sword
- Black Knights' Fortress

### Wave 4: Wider-world quests

- Vampyre Slayer
- Prince Ali Rescue
- Pirate's Treasure
- Misthalin Mystery
- Below Ice Mountain

### Wave 5: Advanced F2P

- The Corsair Curse
- Shield of Arrav
- Dragon Slayer I

Each wave ends with automated verification, a running local preview, and Alex's visual review. Work pauses at that gate. A rejected quest remains in the current wave until corrected and re-approved.

## 12. Automated Verification

### 12.1 Membership and compiler tests

- The reviewed snapshot contains only current F2P quests and approved F2P miniquests.
- Every reviewable pack maps to exactly one membership record.
- Draft or invalid packs cannot enter the supported preview catalogue.
- IDs, dependencies, evidence, sources, chunks, item changes, alternatives, and completion definitions validate.

### 12.2 Per-quest behaviour tests

- Action order and dependency states are deterministic.
- Exactly one primary **Do now** action is projected.
- Item consumption and production chains balance across the route.
- Preferred methods remain primary while legal.
- Blockers identify the failed requirement and an actionable recovery step.
- Alternatives appear only under their reviewed conditions.
- Every visible step projects its reviewed chunk.
- Map close restores the same quest and active step.
- Progress survives reload for the same run and does not leak between runs.
- Final confirmation is unavailable early, idempotent when used, and produces the completed preview state.

### 12.3 Integration and regression tests

- Objective recommendation includes only compiled supported packs.
- Unsupported and rejected quests continue through the ordinary Goal Planner.
- RuneProof progress remains isolated from `GameState`, Journal progress, keys, rewards, exports, sync, and history.
- Cook's Assistant continues to recommend the nearby mill route rather than Black Knights.
- Preview-only content remains absent from the normal production bundle.
- The full test suite, typecheck, content verification, normal build, and preview build pass for every wave.

## 13. Visual Review Gate

For every quest in a wave, Alex receives a local preview and checks:

1. quest selection and recommendation wording;
2. the full ordered route and concrete **Do now** instruction;
3. the chunk shown on every step;
4. temporary map focus, close behavior, and return to the same place;
5. item acquisition and transformation routes;
6. blocker explanations and next-best actions;
7. alternative-route presentation;
8. progress persistence after reload;
9. final quest-completion confirmation; and
10. completed-route presentation without key rolls or Journal changes.

Desktop and mobile layouts must remain usable. Automated success is evidence for review, not a substitute for it.

## 14. Release Boundary

All packs remain behind `VITE_RUNEPROOF_PREVIEW=1` throughout this programme. Wave approval authorizes the next local implementation wave only.

No push, merge, deployment, public enablement, announcement, or release follows automatically from wave approval or completion of the full catalogue. Those actions require a separate explicit release instruction after the final locally running result has been visually approved.

## 15. Acceptance Criteria

The all-F2P build is complete when:

1. The reviewed membership snapshot identifies the full current F2P quest and miniquest roster.
2. Every roster entry has one independently compiled RuneProof quest pack.
3. Every player-visible step shows a reviewed chunk and supports temporary-map return.
4. Every pack contains complete item chains, blockers, next-best actions, alternatives, and final confirmation behavior.
5. Invalid or incomplete packs fail closed without affecting the ordinary Goal Planner.
6. Cook's Assistant and all previously approved RuneProof behavior remain intact.
7. All automated project gates pass after every wave.
8. Alex has visually approved every wave in sequence.
9. Preview confirmations remain isolated from canonical progression, keys, rewards, and saves.
10. The full catalogue remains local and preview-only until a separate release decision.
